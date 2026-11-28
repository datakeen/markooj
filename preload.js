// Markooj — preload: Markdown rendering, flavor detection, HTML→Markdown, front matter, file bridge.
const { contextBridge, ipcRenderer, webUtils, webFrame } = require('electron');
const MarkdownIt = require('markdown-it');
const katex = require('katex');
const hljs = require('highlight.js');
const TurndownService = require('turndown');
const { gfm } = require('turndown-plugin-gfm');
const YAML = require('yaml');

// ---------- sanitizer (DOMPurify on the preload's window) ----------
let purify = null;
try {
  const createDOMPurify = require('dompurify');
  if (typeof window !== 'undefined') purify = createDOMPurify(window);
  if (purify && !purify.isSupported) purify = null;
} catch (e) { console.error('DOMPurify failed to load', e); }
const PURIFY_CFG = {
  ADD_TAGS: ['#comment', 'semantics', 'annotation', 'iframe', 'foreignObject'],
  ADD_ATTR: ['contenteditable', 'align', 'target', 'encoding', 'checked', 'disabled', 'type', 'start', 'allowfullscreen', 'frameborder', 'xmlns', 'display', 'mathvariant', 'stretchy', 'fence', 'separator', 'lspace', 'rspace', 'accent', 'accentunder', 'columnalign', 'rowspacing', 'columnspacing', 'scriptlevel', 'displaystyle', 'width', 'height', 'depth', 'voffset', 'minsize', 'maxsize'],
  FORBID_TAGS: ['script', 'style', 'link', 'meta', 'base', 'object', 'embed', 'frame', 'frameset'],
  ALLOW_DATA_ATTR: true, ALLOW_ARIA_ATTR: true,
  SAFE_FOR_XML: false, // keeps Mermaid sources like "A --> B" in data-src and <!-- comment: … --> nodes
  SANITIZE_DOM: false, // heading ids such as "title" or "contents" must survive for the table of contents
  // [a-z]:[\\/] keeps Windows paths such as C:/Users/…/image.png (MarkText, Typora) and C:\pics\x.png
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|file|data|blob|markooj):|[a-z]:[\\/]|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};
if (purify) {
  purify.addHook('afterSanitizeAttributes', node => {
    if (node.nodeName === 'IFRAME') {
      const src = node.getAttribute('src') || '';
      if (!/^https?:\/\//i.test(src)) node.remove();
      else node.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
    }
    if (node.nodeName === 'A' && /^\s*javascript:/i.test(node.getAttribute('href') || '')) node.removeAttribute('href');
    // SANITIZE_DOM is off (heading ids must survive), so named elements must not shadow document.createElement & co.
    if (/^(IMG|FORM|IFRAME|EMBED|OBJECT)$/.test(node.nodeName) && node.hasAttribute('name')) node.removeAttribute('name');
  });
}
function sanitize(html) {
  if (!purify) return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  return purify.sanitize(String(html || ''), PURIFY_CFG);
}

// ---------- KaTeX macros: object, or text with \newcommand / \def / "\name: body" lines ----------
function normMacros(m) {
  if (!m) return {};
  if (typeof m === 'object') return { ...m };
  const o = {};
  const s = String(m);
  const group = '\\{((?:[^{}]|\\{(?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*\\})*)\\}';
  for (const x of s.matchAll(new RegExp('\\\\(?:re|provide)?newcommand\\*?\\s*\\{?\\s*(\\\\[A-Za-z@]+)\\s*\\}?\\s*(?:\\[(\\d)\\])?\\s*' + group, 'g'))) o[x[1]] = x[3];
  for (const x of s.matchAll(new RegExp('\\\\def\\s*(\\\\[A-Za-z@]+)\\s*(?:#\\d)*\\s*' + group, 'g'))) o[x[1]] = x[2];
  for (const line of s.split(/\r?\n/)) { const x = /^\s*(\\[A-Za-z@]+)\s*[:=]\s*(.+?)\s*$/.exec(line); if (x && !(x[1] in o)) o[x[1]] = x[2]; }
  return o;
}
function katexOpts(display, macros) {
  return { displayMode: display, throwOnError: false, output: 'htmlAndMathml', trust: false, strict: 'ignore', macros: macros || {} };
}

// ---------- labels: Pandoc attribute blocks {#eq:x}, {#fig:x .class}, {-} ----------
// The first item must be #id, .class or "-" so TeX groups like {2} are never mistaken for attributes.
const ATTR_SRC = '\\{[ \\t]*(?:[#.][^\\s{}]+|-)(?:[ \\t]+(?:[#.][^\\s{}]+|-|[\\w-]+=(?:"[^"\\n]*"|[^\\s{}"]*)))*[ \\t]*\\}';
const ATTR_TAIL = new RegExp('^([\\s\\S]*?)[ \\t]*(' + ATTR_SRC + ')[ \\t]*$');
const ATTR_HEAD = new RegExp('^[ \\t]*(' + ATTR_SRC + ')');
function parseAttrs(raw) {
  const a = { id: null, classes: [], kv: [], unnumbered: false, raw: String(raw || '') };
  const inner = a.raw.replace(/^\{\s*|\s*\}$/g, '');
  for (const p of inner.match(/[\w-]+=(?:"[^"]*"|\S*)|\S+/g) || []) {
    if (p === '-') a.unnumbered = true;
    else if (p[0] === '#') a.id = a.id || p.slice(1);
    else if (p[0] === '.') { a.classes.push(p.slice(1)); if (p === '.unnumbered') a.unnumbered = true; }
    else a.kv.push(p);
  }
  return a;
}
function buildAttrs(id, prev, unnumbered) {
  const a = prev ? parseAttrs(prev) : { classes: [], kv: [] };
  const parts = [];
  if (id) parts.push('#' + id);
  for (const c of a.classes) if (c !== 'unnumbered') parts.push('.' + c);
  if (unnumbered) parts.push('-');
  parts.push(...a.kv);
  return parts.length ? `{${parts.join(' ')}}` : '';
}
// Equation metadata that KaTeX cannot (or must not) draw: \label{…}, \tag{…}, \notag. Markooj shows numbers in its own gutter.
function eqMeta(src) {
  let t = String(src || ''), label = null, tag = null, tagStar = false, notag = false;
  t = t.replace(/\\label\s*\{([^{}]*)\}/g, (_m, l) => { if (!label) label = l.trim(); return ''; });
  t = t.replace(/\\tag(\*?)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_m, s, x) => { if (tag == null) { tag = x.trim(); tagStar = !!s; } return ''; });
  if (/\\(?:notag|nonumber)(?![A-Za-z])/.test(t)) { notag = true; t = t.replace(/\\(?:notag|nonumber)(?![A-Za-z])/g, ''); }
  const env = /^\s*\\begin\{(equation|align|gather|multline|eqnarray|flalign|alignat)(\*?)\}/.exec(t);
  return { render: t, label, tag, tagStar, notag, env: env ? env[1] : null, envStar: env ? !!env[2] : false };
}
const XREF_KEY = /^(eq|fig|tbl|sec):[\w.:-]*\w$/i;

// ---------- math: $…$  $$…$$  \(…\)  \[…\] ----------
function mathPlugin(md) {
  const tex = (src, display, env) => {
    try { return katex.renderToString(src, katexOpts(display, env && env.macros)); }
    catch (e) { return `<code class="math-error">${md.utils.escapeHtml(src)}</code>`; }
  };
  const esc = s => md.utils.escapeHtml(String(s));
  // labelAttrs: extra attributes for a display equation that sits inside a paragraph (blocks carry them on the div)
  const wrap = (src, display, delim, env, labelAttrs = '') => {
    let draw = src, extra = '';
    if (display) {
      const m = eqMeta(src); draw = m.render;
      if (m.label) extra += ` data-tex-label="${esc(m.label)}"`;
      if (m.tag != null) extra += ` data-tag="${esc(m.tag)}"${m.tagStar ? ' data-tag-star="1"' : ''}`;
      if (m.notag) extra += ' data-notag="1"';
      if (m.env) extra += ` data-env="${m.env}${m.envStar ? '*' : ''}"`;
    }
    return `<span class="mk-math${display ? ' display' : ''}" contenteditable="false" data-tex="${esc(src)}" data-delim="${delim}"${extra}${labelAttrs}>${tex(draw, display, env)}</span>`;
  };
  const labelAttrs = (a, texLabel) => {
    const id = (a && a.id) || texLabel || '';
    let s = '';
    if (id) s += ` id="${esc(id)}" data-label="${esc(id)}"`;
    if (a) s += ` data-attrs="${esc(a.raw)}"`;
    if (a && a.unnumbered) s += ' data-unnumbered="1"';
    return s;
  };

  md.inline.ruler.before('escape', 'math_inline', (state, silent) => {
    const s = state.src, p = state.pos;
    const pairs = [['\\(', '\\)', 'paren'], ['\\[', '\\]', 'bracket'], ['$$', '$$', 'dd'], ['$', '$', 'd']];
    for (const [open, close, kind] of pairs) {
      if (!s.startsWith(open, p)) continue;
      if (kind === 'd' && (/\s/.test(s[p + 1] || ' ') || s[p + 1] === '$')) return false;
      let q = p + open.length;
      while ((q = s.indexOf(close, q)) !== -1) {
        if (s[q - 1] === '\\' && kind !== 'paren' && kind !== 'bracket') { q++; continue; }
        if (kind === 'd' && (/\s/.test(s[q - 1]) || /\d/.test(s[q + 1] || ''))) { q++; continue; }
        break;
      }
      if (q === -1 || q === p + open.length) return false;
      const display = kind === 'dd' || kind === 'bracket';
      // a label right after display math in running text: $$ … $$ {#eq:x}
      const am = display ? ATTR_HEAD.exec(s.slice(q + close.length)) : null;
      if (!silent) { const t = state.push('math', '', 0); t.content = s.slice(p + open.length, q); t.meta = { display, delim: kind, attrs: am ? parseAttrs(am[1]) : null }; }
      state.pos = q + close.length + (am ? am[0].length : 0);
      return true;
    }
    return false;
  });
  md.block.ruler.before('fence', 'math_block', (state, start, end, silent) => {
    const line = i => state.src.slice(state.bMarks[i] + state.tShift[i], state.eMarks[i]);
    const first = line(start).trim();
    let open, close, kind;
    if (first.startsWith('$$')) { open = '$$'; close = '$$'; kind = 'dd'; }
    else if (first.startsWith('\\[')) { open = '\\['; close = '\\]'; kind = 'bracket'; }
    else if (/^\\begin\{(equation|align|gather|multline|eqnarray)\*?\}/.test(first)) { open = ''; close = null; kind = 'env'; }
    else return false;
    let body = '', i = start, found = false, attrsRaw = null;
    // the closing line may carry a label: "$$ {#eq:x}" or "\end{equation} {#eq:x}"
    const closeOf = l => {
      let x = l.trim();
      const am = ATTR_TAIL.exec(x);
      if (am && am[1].endsWith(close)) return { text: am[1], attrs: am[2] };
      return x.endsWith(close) ? { text: x, attrs: null } : null;
    };
    const firstRest = first.slice(open.length);
    if (kind === 'env') {
      const env = first.match(/^\\begin\{([a-z*]+)\}/)[1];
      const endTag = `\\end{${env}}`;
      for (; i < end; i++) {
        let l = line(i); const k = l.indexOf(endTag);
        if (k >= 0) { const am = new RegExp('^[ \\t]*(' + ATTR_SRC + ')[ \\t]*$').exec(l.slice(k + endTag.length)); if (am) { attrsRaw = am[1]; l = l.slice(0, k + endTag.length); } body += l + '\n'; found = true; break; }
        body += l + '\n';
      }
    } else {
      const one = closeOf(firstRest);
      if (one && one.text.length >= close.length) {
        body = one.text.slice(0, -close.length); attrsRaw = one.attrs; found = true;
      } else {
        body = firstRest + '\n';
        for (i = start + 1; i < end; i++) { const l = line(i); const c = closeOf(l); if (c) { body += c.text.slice(0, -close.length); attrsRaw = c.attrs; found = true; break; } body += l + '\n'; }
      }
    }
    if (!found) return false;
    if (silent) return true;
    const t = state.push('math_block', '', 0); t.content = body.trim(); t.meta = { delim: kind, attrs: attrsRaw ? parseAttrs(attrsRaw) : null }; t.map = [start, i + 1];
    state.line = i + 1; return true;
  }, { alt: ['paragraph'] });
  md.renderer.rules.math = (t, i, _o, env) => {
    const m = t[i].meta;
    const la = m.display && (m.attrs || /\\label\s*\{/.test(t[i].content)) ? labelAttrs(m.attrs, eqMeta(t[i].content).label) : '';
    return wrap(t[i].content, m.display, m.delim, env, la);
  };
  md.renderer.rules.math_block = (t, i, _o, env) => {
    const m = t[i].meta;
    return `<div class="mk-math-block" data-line="${t[i].map[0]}"${labelAttrs(m.attrs, eqMeta(t[i].content).label)}>${wrap(t[i].content, true, m.delim, env)}</div>\n`;
  };
}

// ---------- labels on pictures, headings and tables; figures with captions ----------
function labelPlugin(md) {
  const CAP = /^(Table:|table:|:)[ \t]+(\S[^\n]*)$/;
  const newTok = (state, type, tag, nesting, props) => Object.assign(new state.Token(type, tag, nesting), props);
  // Table captions ": Caption {#tbl:x}" before or after a table. Runs before inline parsing so the caption text is parsed as Markdown.
  md.core.ruler.after('block', 'mk_table_caption', state => {
    const toks = state.tokens;
    // a caption typed on the line right under the table becomes a last row in GFM: move it out again
    for (let i = 0; i < toks.length; i++) {
      if (toks[i].type !== 'table_close') continue;
      let j = i - 1; if (toks[j] && toks[j].type === 'tbody_close') j--;
      if (!toks[j] || toks[j].type !== 'tr_close') continue;
      let k = j; while (k > 0 && toks[k].type !== 'tr_open') k--;
      if (toks[k - 1] && toks[k - 1].type === 'thead_open') continue;
      const cells = toks.slice(k, j + 1).filter(x => x.type === 'inline');
      if (!cells.length || !CAP.test(cells[0].content.trim()) || cells.slice(1).some(c => c.content.trim())) continue;
      const map = toks[k].map, text = cells[0].content.trim(), level = toks[i].level;
      toks.splice(k, j - k + 1); i -= j - k + 1;
      if (toks[k - 1] && toks[k - 1].type === 'tbody_open' && toks[k] && toks[k].type === 'tbody_close') { toks.splice(k - 1, 2); i -= 2; }
      const tableOpen = (() => { let d = 0; for (let x = i; x >= 0; x--) { if (toks[x].type === 'table_close') d++; if (toks[x].type === 'table_open' && --d === 0) return toks[x]; } return null; })();
      if (tableOpen && tableOpen.map && map) tableOpen.map = [tableOpen.map[0], map[0]];
      toks.splice(i + 1, 0,
        newTok(state, 'paragraph_open', 'p', 1, { map, level, block: true }),
        newTok(state, 'inline', '', 0, { map, level: level + 1, content: text, children: [] }),
        newTok(state, 'paragraph_close', 'p', -1, { level, block: true }));
    }
    for (let i = 0; i < toks.length; i++) {
      if (toks[i].type !== 'paragraph_open' || toks[i].hidden) continue;
      const inl = toks[i + 1]; if (!inl || inl.type !== 'inline') continue;
      const m = CAP.exec(inl.content.trim()); if (!m) continue;
      const prev = toks[i - 1], next = toks[i + 3];
      let table = null, pos = null;
      if (prev && prev.type === 'table_close' && prev.level === toks[i].level) {
        let d = 0; for (let x = i - 1; x >= 0; x--) { if (toks[x].type === 'table_close') d++; if (toks[x].type === 'table_open' && --d === 0) { table = toks[x]; break; } }
        if (table && table.meta && table.meta.caption) table = null; else pos = 'after';
      }
      if (!table && next && next.type === 'table_open' && next.level === toks[i].level && !(next.meta && next.meta.caption)) { table = next; pos = 'before'; }
      if (!table) continue;
      let cap = m[2].trim(), attrs = null;
      const am = ATTR_TAIL.exec(cap); if (am) { attrs = parseAttrs(am[2]); cap = am[1].trim(); }
      inl.content = cap;
      table.meta = Object.assign({}, table.meta, { caption: { text: cap, line: inl.map ? inl.map[0] : null, pos, attrs, label: attrs && attrs.id || null } });
      toks[i].attrJoin('class', 'mk-tcaption');
      toks[i].attrSet('data-pos', pos);
      toks[i].attrSet('data-prefix', m[1]);
      if (attrs) toks[i].attrSet('data-attrs', attrs.raw);
      if (attrs && attrs.id) { table.attrSet('id', attrs.id); table.attrSet('data-label', attrs.id); toks[i].attrSet('data-for', attrs.id); }
    }
  });
  // Attributes after pictures and at the end of headings; a labeled picture alone in its paragraph becomes a figure.
  md.core.ruler.after('text_join', 'mk_labels', state => {
    const toks = state.tokens;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.type !== 'inline' || !t.children) continue;
      const ch = t.children;
      for (let k = 0; k < ch.length; k++) {
        const c = ch[k], n = ch[k + 1];
        if (c.type !== 'image' || !n || n.type !== 'text') continue;
        const am = ATTR_HEAD.exec(n.content); if (!am) continue;
        const a = parseAttrs(am[1]);
        c.meta = Object.assign({}, c.meta, { attrs: a });
        if (a.id) { c.attrSet('id', a.id); c.attrSet('data-label', a.id); }
        c.attrSet('data-attrs', a.raw);
        n.content = n.content.slice(am[0].length);
      }
      const open = toks[i - 1];
      if (open && open.type === 'heading_open') {
        const last = ch[ch.length - 1];
        const am = last && last.type === 'text' ? ATTR_TAIL.exec(last.content) : null;
        if (am) {
          const a = parseAttrs(am[2]);
          last.content = am[1].replace(/[ \t]+$/, '');
          if (a.id) { open.attrSet('id', a.id); open.attrSet('data-label', a.id); }
          open.attrSet('data-attrs', a.raw);
          if (a.unnumbered) open.attrSet('data-unnumbered', '1');
        }
      }
      if (open && open.type === 'paragraph_open' && !open.hidden && toks[i + 1] && toks[i + 1].type === 'paragraph_close') {
        const real = ch.filter(c => !((c.type === 'text' && !c.content.trim()) || c.type === 'softbreak'));
        if (real.length === 1 && real[0].type === 'image' && real[0].meta && real[0].meta.attrs && real[0].meta.attrs.id) {
          const img = real[0];
          open.meta = Object.assign({}, open.meta, { figure: img });
          toks[i + 1].meta = Object.assign({}, toks[i + 1].meta, { figure: true });
          img.meta.figure = true;
        }
      }
    }
  });
  const r = md.renderer.rules;
  const pOpen = r.paragraph_open, pClose = r.paragraph_close, image = r.image;
  r.paragraph_open = (t, i, o, e, self) => {
    const img = t[i].meta && t[i].meta.figure;
    if (img) {
      const a = img.meta.attrs;
      const extra = [['id', a.id], ['data-label', a.id], ['data-attrs', a.raw]].filter(x => x[1]).map(([k, v]) => ` ${k}="${md.utils.escapeHtml(v)}"`).join('');
      return `<figure class="mk-figure"${extra}${self.renderAttrs(t[i])}>`;
    }
    return pOpen ? pOpen(t, i, o, e, self) : self.renderToken(t, i, o);
  };
  r.paragraph_close = (t, i, o, e, self) => (t[i].meta && t[i].meta.figure ? '</figure>\n' : (pClose ? pClose(t, i, o, e, self) : self.renderToken(t, i, o)));
  r.image = (t, i, o, e, self) => {
    const tk = t[i];
    if (!(tk.meta && tk.meta.figure)) return image(t, i, o, e, self);
    const keep = tk.attrs; tk.attrs = keep.filter(([k]) => k !== 'id' && k !== 'data-label' && k !== 'data-attrs');
    const html = image(t, i, o, e, self); tk.attrs = keep;
    return `${html}<figcaption>${self.renderInline(tk.children, o, e)}</figcaption>`;
  };
}

// ---------- cross-references: @eq:x, [@fig:x], [-@tbl:x], [@eq:a; @eq:b] ----------
function xrefPlugin(md) {
  md.inline.ruler.before('emphasis', 'xref_bare', (state, silent) => {
    const s = state.src, p = state.pos;
    if (s.charCodeAt(p) !== 0x40 /* @ */) return false;
    if (p > 0 && /[\w@.\-\]]/.test(s[p - 1])) return false; // e-mail addresses, [@…] handled by the citation rule
    const m = /^@((?:eq|fig|tbl|sec|Eq|Fig|Tbl|Sec):[\w.:-]*\w)/.exec(s.slice(p));
    if (!m) return false;
    if (!silent) { const t = state.push('xref', '', 0); t.meta = { keys: [m[1]], raw: m[0], form: 'bare' }; }
    state.pos = p + m[0].length; return true;
  });
  md.renderer.rules.xref = (t, i) => {
    const m = t[i].meta, esc = md.utils.escapeHtml;
    const keys = m.keys.map(k => k.replace(/^[A-Z][a-z]+(?=:)/, x => x.toLowerCase()));
    const cap = m.keys.some(k => /^[A-Z]/.test(k));
    return `<span class="mk-xref" contenteditable="false" data-ref="${esc(keys.join(';'))}" data-raw="${esc(m.raw)}" data-form="${m.form}"${m.suppress ? ' data-suppress="1"' : ''}${cap ? ' data-cap="1"' : ''}>${esc(keys.join('; '))}</span>`;
  };
}

// Footnotes keep their original label ([^note]) and inline-ness (^[…]) so they round-trip exactly.
function footnoteLabels(md) {
  const r = md.renderer.rules;
  const ref = r.footnote_ref, open = r.footnote_open;
  const attrs = m => (m.label != null ? ` data-label="${md.utils.escapeHtml(String(m.label))}"` : ' data-inline="1"');
  // an inline note ^[…] carries its own source, so converting only the paragraph (Word mode) keeps the note text
  const srcOf = (m, e) => {
    if (m.label != null) return '';
    const f = e && e.footnotes && e.footnotes.list && e.footnotes.list[m.id];
    return f && typeof f.content === 'string' ? ` data-src="${md.utils.escapeHtml(f.content)}"` : '';
  };
  if (ref) r.footnote_ref = (t, i, o, e, s) => ref(t, i, o, e, s).replace('<sup class="footnote-ref"', `<sup class="footnote-ref"${attrs(t[i].meta)}${srcOf(t[i].meta, e)}`);
  if (open) r.footnote_open = (t, i, o, e, s) => open(t, i, o, e, s).replace('<li ', `<li${attrs(t[i].meta)} `);
}

// ---------- [[wikilinks]], ==mark== handled by plugin, citations [@key] ----------
function wikiPlugin(md) {
  md.inline.ruler.before('link', 'wikilink', (state, silent) => {
    const s = state.src, p = state.pos;
    if (!s.startsWith('[[', p)) return false;
    const q = s.indexOf(']]', p + 2); if (q < 0) return false;
    const [target, label] = s.slice(p + 2, q).split('|');
    if (!silent) { const t = state.push('wikilink', '', 0); t.meta = { target, label: label || target }; }
    state.pos = q + 2; return true;
  });
  md.renderer.rules.wikilink = (t, i) => `<a class="mk-wiki" href="${md.utils.escapeHtml(t[i].meta.target)}.md">${md.utils.escapeHtml(t[i].meta.label)}</a>`;
  // Obsidian picture embeds ![[photo.png]], ![[photo.png|300]] (src/pictures.js finds the file in the vault's usual folders)
  md.inline.ruler.before('wikilink', 'wiki_embed', (state, silent) => {
    const s = state.src, p = state.pos;
    if (!s.startsWith('![[', p)) return false;
    const q = s.indexOf(']]', p + 3); if (q < 0) return false;
    const [target, opt] = s.slice(p + 3, q).split('|');
    if (!/\.(png|jpe?g|gif|webp|avif|bmp|ico|svg)$/i.test((target || '').trim())) return false;
    if (!silent) { const t = state.push('wiki_embed', '', 0); t.meta = { target: target.trim(), opt: (opt || '').trim(), raw: s.slice(p, q + 2) }; }
    state.pos = q + 2; return true;
  });
  md.renderer.rules.wiki_embed = (t, i) => {
    const m = t[i].meta, esc = md.utils.escapeHtml, w = /^(\d+)(?:x(\d+))?$/.exec(m.opt);
    return `<img class="mk-wiki-embed" src="${esc(encodeURI(m.target))}" alt="${w ? '' : esc(m.opt)}"${w ? ` width="${w[1]}"${w[2] ? ` height="${w[2]}"` : ''}` : ''} data-raw="${esc(m.raw)}">`;
  };
}
// Pandoc citations: [@key], [@a; @b, p. 5], [see @key, chap. 3; also @lee2019, p. 5], [-@key], and narrative @key.
const CITE_KEY_SRC = '[\\w][\\w:.#$%&\\-+?<>~/]*';
function parseCiteItems(inner) {
  const items = [];
  for (const part of String(inner).split(/;|,(?=\s*-?@)/)) {
    const m = new RegExp('(^|[\\s(])(-?)@(' + CITE_KEY_SRC + ')').exec(part);
    if (!m) return null; // every item needs a key
    let key = m[3], suffix = part.slice(m.index + m[0].length);
    const tail = /[.:#$%&\-+?<>~/]+$/.exec(key); // trailing punctuation is not part of the key
    if (tail) { key = key.slice(0, -tail[0].length); suffix = tail[0] + suffix; }
    if (!key) return null;
    items.push({ key, prefix: part.slice(0, m.index + m[1].length).trim(), suppress: m[2] === '-', locator: suffix.replace(/^\s*,\s*/, '').trim() });
  }
  return items.length ? items : null;
}
const citeSig = (keys, locator) => `${keys.join(';')}|${locator || ''}`;
function citePlugin(md) {
  md.inline.ruler.before('link', 'citation', (state, silent) => {
    const s = state.src, p = state.pos;
    if (s.charCodeAt(p) !== 0x5b /* [ */) return false;
    const m = /^\[([^\[\]]*)\]/.exec(s.slice(p));
    if (!m || !/(^|[\s;(])-?@\w/.test(m[1])) return false;
    if (/^[(\[:]/.test(s.slice(p + m[0].length))) return false; // [text @x](url) and [label]: are links
    const items = parseCiteItems(m[1]);
    if (!items) return false;
    // [@fig:x] and [-@eq:y] are cross-references, not citations
    if (items.every(it => XREF_KEY.test(it.key))) {
      if (items.some(it => it.prefix || it.locator)) return false;
      if (!silent) { const t = state.push('xref', '', 0); t.meta = { keys: items.map(it => it.key), raw: m[0], form: 'bracket', suppress: items.some(it => it.suppress) }; }
      state.pos = p + m[0].length; return true;
    }
    if (!silent) { const t = state.push('citation', '', 0); t.meta = { items, raw: m[0] }; }
    state.pos = p + m[0].length; return true;
  });
  // narrative citation: "@smith2020 says" (only when a library is loaded, so e-mail style handles stay text)
  md.inline.ruler.before('emphasis', 'cite_bare', (state, silent) => {
    const s = state.src, p = state.pos;
    if (s.charCodeAt(p) !== 0x40 /* @ */) return false;
    if (p > 0 && /[\w@.\-\]\\]/.test(s[p - 1])) return false;
    const bib = state.env && state.env.bib;
    if (!bib || !Object.keys(bib).length) return false;
    const m = new RegExp('^@(' + CITE_KEY_SRC + ')').exec(s.slice(p));
    if (!m) return false;
    let key = m[1]; const tail = /[.:#$%&\-+?<>~/]+$/.exec(key); if (tail) key = key.slice(0, -tail[0].length);
    if (!key || XREF_KEY.test(key)) return false;
    if (!silent) { const t = state.push('citation', '', 0); t.meta = { items: [{ key, prefix: '', locator: '', suppress: false }], raw: '@' + key, narrative: true }; }
    state.pos = p + 1 + key.length; return true;
  });
  md.renderer.rules.citation = (t, i, _o, envr) => {
    const esc = md.utils.escapeHtml;
    const { items, raw, narrative } = t[i].meta; const bib = envr.bib || {}; envr.cited = envr.cited || [];
    const name = e => `${e.author.split(/ and /)[0].split(',')[0].trim()}${e.author.includes(' and ') ? ' et al.' : ''}`;
    const cites = items.filter(it => !XREF_KEY.test(it.key));
    const keys = cites.map(it => it.key);
    for (const k of keys) if (!envr.cited.includes(k)) envr.cited.push(k);
    const parts = items.map(it => {
      if (XREF_KEY.test(it.key)) return `<span class="mk-xref" contenteditable="false" data-ref="${esc(it.key.replace(/^[A-Z][a-z]+(?=:)/, x => x.toLowerCase()))}" data-raw="${esc((it.suppress ? '-@' : '@') + it.key)}" data-form="bare"${it.suppress ? ' data-suppress="1"' : ''}>${esc(it.key)}</span>`;
      const e = bib[it.key];
      const who = e ? (it.suppress ? String(e.year) : narrative ? `${name(e)} (${e.year}${it.locator ? ', ' + it.locator : ''})` : `${name(e)}, ${e.year}`) : '@' + it.key;
      return esc([it.prefix, who].filter(Boolean).join(' ') + (!narrative && it.locator ? ', ' + it.locator : ''));
    });
    // one locator for the whole citation keeps the older single-locator attributes working
    const locs = cites.map(it => it.locator).filter(Boolean);
    const locator = locs.length === 1 && cites[cites.length - 1].locator ? locs[0] : '';
    const rich = narrative || items.some(it => it.prefix || it.suppress || XREF_KEY.test(it.key)) || locs.length > (locator ? 1 : 0);
    const data = rich ? ` data-items="${esc(JSON.stringify(cites.map(it => ({ key: it.key, prefix: it.prefix, locator: it.locator, suppress: it.suppress }))))}"` : '';
    const text = narrative ? parts.join('; ') : `(${parts.join('; ')})`;
    return `<span class="mk-cite" contenteditable="false" data-keys="${esc(keys.join(';'))}" data-locator="${esc(locator)}"${data}${narrative ? ' data-narrative="1"' : ''} data-sig="${esc(citeSig(keys, locator))}" data-raw="${esc(raw || '')}">${text}</span>`;
  };
}

function makeMd() {
  const md = new MarkdownIt({
    html: true, linkify: true, typographer: false, breaks: false, // typographer off: Word-mode edits must not turn straight quotes curly in the source
    highlight(code, lang) {
      if (lang === 'mermaid') return `<pre class="mermaid" contenteditable="false" data-src="${md.utils.escapeHtml(code)}">${md.utils.escapeHtml(code)}</pre>`;
      const l = (lang || '').replace(/^\{|\}$/g, '').split(/[\s,]/)[0];
      try { if (l && hljs.getLanguage(l)) return `<pre class="hljs" data-lang="${l}"><code>${hljs.highlight(code, { language: l, ignoreIllegals: true }).value}</code></pre>`; } catch {}
      return `<pre class="hljs"${l ? ` data-lang="${md.utils.escapeHtml(l)}"` : ''}><code>${md.utils.escapeHtml(code)}</code></pre>`;
    },
  });
  md.use(mathPlugin).use(wikiPlugin).use(citePlugin).use(xrefPlugin).use(labelPlugin)
    .use(require('markdown-it-footnote')).use(footnoteLabels).use(require('markdown-it-task-lists'), { enabled: true, label: true })
    .use(require('markdown-it-mark')).use(require('markdown-it-sub')).use(require('markdown-it-sup'))
    .use(require('markdown-it-deflist')).use(require('markdown-it-abbr'));
  const emoji = require('markdown-it-emoji'); md.use(emoji.full || emoji.default || emoji);
  // Pandoc / Quarto fenced divs: "::: note", "::: {.callout-note}", "::: {#thm-1 .theorem key=val}" (more colons nest)
  const container = require('markdown-it-container');
  const fenceInfo = p => String(p || '').trim().replace(/\s*:+\s*$/, '').trim();
  md.use(container, 'div', {
    validate: p => /^(?:[\w-]+|\{[^{}\n]*\})$/.test(fenceInfo(p)),
    render(t, i) {
      const tk = t[i];
      if (tk.nesting !== 1) return '</div>\n';
      const esc = md.utils.escapeHtml, info = fenceInfo(tk.info);
      let id = null, classes = [];
      if (info[0] === '{') { const a = parseAttrs(info); id = a.id; classes = a.classes; } else classes = [info];
      const callout = (classes.find(c => /^callout-\w+/.test(c)) || '').replace(/^callout-/, '');
      const cls = callout ? ['callout', ...classes] : classes;
      const line = tk.map ? ` data-line="${tk.map[0]}"` : '';
      const title = callout ? `<div class="callout-title" data-mk-ui="1" contenteditable="false">${esc(callout[0].toUpperCase() + callout.slice(1))}</div>` : '';
      return `<div${cls.length ? ` class="${esc(cls.join(' '))}"` : ''}${id ? ` id="${esc(id)}"` : ''} data-fence="${esc(info)}" data-colons="${(tk.markup || ':::').length}"${line}>${title}\n`;
    },
  });
  md.use(require('markdown-it-anchor').default || require('markdown-it-anchor'), { failOnNonUnique: false, slugify: s =>s.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') });
  // source line mapping for scroll sync and for Word mode (every block needs one, or editing its neighbor rewrites it)
  for (const r of ['paragraph_open', 'heading_open', 'table_open', 'bullet_list_open', 'ordered_list_open', 'blockquote_open', 'hr', 'code_block', 'dl_open']) {
    const prev = md.renderer.rules[r];
    md.renderer.rules[r] = (t, i, o, e, self) => { if (t[i].map) t[i].attrSet('data-line', String(t[i].map[0])); return prev ? prev(t, i, o, e, self) : self.renderToken(t, i, o); };
  }
  // fences: highlight() already returns a whole <pre>, so the attribute goes onto that markup
  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (t, i, o, e, self) => {
    const html = fence(t, i, o, e, self);
    return t[i].map ? html.replace(/^<pre\b/, `<pre data-line="${t[i].map[0]}"`) : html;
  };
  const htmlBlock = md.renderer.rules.html_block;
  md.renderer.rules.html_block = (t, i, o, e, self) => {
    const html = htmlBlock(t, i, o, e, self);
    return t[i].map ? html.replace(/^(\s*<[A-Za-z][\w-]*)(?=[\s/>])/, `$1 data-line="${t[i].map[0]}"`) : html;
  };
  // remember which links were typed as <https://…> or as a bare URL, so Word mode writes them back the same way
  const linkOpen = md.renderer.rules.link_open;
  md.renderer.rules.link_open = (t, i, o, e, self) => {
    if (t[i].markup === 'linkify') t[i].attrSet('data-auto', 'bare');
    else if (t[i].markup === 'autolink') t[i].attrSet('data-auto', 'angle');
    return linkOpen ? linkOpen(t, i, o, e, self) : self.renderToken(t, i, o);
  };
  return md;
}
const md = makeMd();

// Obsidian / GitHub callouts:  > [!NOTE] Title
function callouts(html) {
  return html.replace(/<blockquote([^>]*)>\s*<p>\[!(\w+)\][+-]?\s*([^\n<]*)\n?/gi, (_m, attrs, kind, title) =>
    `<blockquote${attrs} class="callout callout-${kind.toLowerCase()}"><p><strong class="callout-title">${title || kind[0].toUpperCase() + kind.slice(1).toLowerCase()}</strong><br>`);
}

// ---------- YAML / MultiMarkdown front matter ----------
const FM_RE = /^﻿?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
function splitFrontMatter(text) {
  text = String(text ?? '');
  const m = FM_RE.exec(text);
  if (m) {
    const inner = m[1] || '';
    let meta = null;
    try { meta = inner.trim() ? YAML.parse(inner, { prettyErrors: false }) : {}; } catch { meta = null; }
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) return { meta, raw: m[0], inner, body: text.slice(m[0].length), style: 'yaml' };
  }
  const mm = /^((?:[A-Za-z][\w -]*:[^\n]*\r?\n)+)\r?\n/.exec(text);
  if (mm && !/^#/.test(text) && /^[A-Za-z][\w -]*:\s/.test(text) && !/^(https?|ftp|mailto):/i.test(text)) return { meta: parseMmd(mm[1]), raw: mm[0], inner: mm[1], body: text.slice(mm[0].length), style: 'mmd' };
  return { meta: {}, raw: '', inner: '', body: text, style: null };
}
function parseMmd(s) {
  const o = {}; let key = null;
  for (const line of s.split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w -]*):\s*(.*)$/.exec(line);
    if (kv) { key = kv[1].trim().toLowerCase().replace(/\s+/g, '-'); o[key] = kv[2].trim(); }
    else if (key && /^\s+\S/.test(line)) o[key] += ' ' + line.trim();
  }
  return o;
}
const isEmptyVal = v => v == null || v === '' || (Array.isArray(v) && !v.filter(x => x != null && x !== '').length);
function frontMatterParse(text) {
  const fm = splitFrontMatter(text);
  return { meta: fm.meta, body: fm.body, raw: fm.raw, style: fm.style };
}
// Replace (or add, or remove) the front matter. Keeps the order, comments and formatting of keys that did not change.
function frontMatterWrite(text, meta = {}) {
  const fm = splitFrontMatter(text);
  const nl = /\r\n/.test(String(text ?? '')) ? '\r\n' : '\n';
  const entries = Object.entries(meta || {}).filter(([k, v]) => k && !isEmptyVal(v))
    .map(([k, v]) => [k, Array.isArray(v) ? v.filter(x => x != null && x !== '') : v]);
  let body = fm.body;
  if (!entries.length) return body.replace(/^(\r?\n)+/, '');
  let doc = null;
  if (fm.style === 'yaml' && fm.inner.trim()) {
    try { doc = YAML.parseDocument(fm.inner); if (doc.errors.length || !YAML.isMap(doc.contents)) doc = null; } catch { doc = null; }
  }
  if (!doc) doc = new YAML.Document({});
  const keep = new Set(entries.map(([k]) => k));
  for (const item of [...doc.contents.items]) {
    const k = YAML.isScalar(item.key) ? String(item.key.value) : String(item.key);
    if (!keep.has(k)) doc.delete(item.key);
  }
  const current = doc.toJS() || {};
  for (const [k, v] of entries) {
    if (JSON.stringify(current[k]) !== JSON.stringify(v)) doc.set(k, v);
  }
  const yaml = doc.toString({ lineWidth: 0, indentSeq: true, flowCollectionPadding: false }).replace(/\s+$/, '').replace(/\r?\n/g, nl);
  if (body && !/^\r?\n/.test(body)) body = nl + body;
  return `---${nl}${yaml}${nl}---${nl}${body}`;
}
const metaGet = (meta, key) => { for (const k of Object.keys(meta || {})) if (k.toLowerCase() === key) return meta[k]; return undefined; };
const metaText = v => (v == null ? '' : Array.isArray(v) ? v.map(metaText).filter(Boolean).join(', ') : typeof v === 'object' ? String(v.name || v.literal || v.text || Object.values(v)[0] || '') : String(v));

// BibTeX (small and forgiving)
// LaTeX accents and symbols in BibTeX fields: {\"u} → ü, \'{e} → é, {\ss} → ß, -- → –
const BIB_COMB = { '"': '̈', "'": '́', '`': '̀', '^': '̂', '~': '̃', '=': '̄', '.': '̇', u: '̆', v: '̌', H: '̋', c: '̧', k: '̨', r: '̊' };
const BIB_SYM = { ss: 'ß', ae: 'æ', AE: 'Æ', oe: 'œ', OE: 'Œ', aa: 'å', AA: 'Å', o: 'ø', O: 'Ø', l: 'ł', L: 'Ł', i: 'ı' };
function bibText(s) {
  s = String(s || '');
  if (s.includes('\\')) {
    s = s.replace(/\\([`'^"~=.])\s*(?:\{\s*(\\?[A-Za-z])\s*\}|(\\?[A-Za-z]))/g, (_m, a, b, c) => (b || c).replace(/^\\/, '') + BIB_COMB[a])
      .replace(/\\([uvHckr])(?:\s*\{\s*(\\?[A-Za-z])\s*\}|\s+([A-Za-z]))/g, (_m, a, b, c) => (b || c).replace(/^\\/, '') + BIB_COMB[a])
      .replace(/\\(ss|ae|AE|oe|OE|aa|AA|o|O|l|L|i)(?![A-Za-z])(?:\{\})?\s?/g, (_m, a) => BIB_SYM[a])
      .replace(/\\([&%_$#])/g, '$1');
  }
  return s.replace(/---/g, '—').replace(/--/g, '–').replace(/[{}]/g, '').normalize('NFC');
}
function parseBib(src) {
  const out = {};
  for (const m of src.matchAll(/@(\w+)\s*\{\s*([^,\s]+)\s*,([\s\S]*?)\n\}/g)) {
    const e = { type: m[1].toLowerCase(), key: m[2] };
    for (const f of m[3].matchAll(/(\w+)\s*=\s*(\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}|"([^"]*)"|(\w+))/g)) e[f[1].toLowerCase()] = bibText(f[3] ?? f[4] ?? f[5] ?? '');
    e.author = e.author || e.editor || 'Anon.'; e.year = e.year || 'n.d.';
    out[e.key] = e;
  }
  return out;
}
function bibliography(env) {
  if (!env.cited || !env.cited.length || !env.bib) return '';
  const items = env.cited.map(k => env.bib[k]).filter(Boolean).sort((a, b) => a.author.localeCompare(b.author));
  if (!items.length) return '';
  const esc = md.utils.escapeHtml;
  return `<section class="mk-bibliography" contenteditable="false"><h2>References</h2><ol>${items.map(e =>
    `<li id="ref-${esc(e.key)}">${esc(e.author.replace(/ and /g, ', '))} (${esc(e.year)}). <em>${esc(e.title || '')}</em>${e.journal ? '. ' + esc(e.journal) : ''}${e.volume ? ', ' + esc(e.volume) : ''}${e.pages ? ', ' + esc(e.pages) : ''}${e.publisher ? '. ' + esc(e.publisher) : ''}.${e.doi ? ` <a href="https://doi.org/${esc(e.doi)}">doi:${esc(e.doi)}</a>` : ''}</li>`).join('')}</ol></section>`;
}

// MDX: import/export lines and top-level JSX elements show as locked chips (data-raw keeps the source exactly).
// The line count never changes, so data-line numbers still point at the right source lines.
const MDX_LINE = /^(?:import\s.+\sfrom\s|import\s+['"]|export\s+(?:const|default|function|let|var|class|async)\b)/;
const MDX_TAG = /^<([A-Z][\w.]*)(?=[\s/>]|$)/;
function mdxPlaceholders(body) {
  if (!/^(?:import|export)\s|^<[A-Z]/m.test(body)) return body;
  const lines = body.split('\n'), out = [];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const chip = group => {
    const raw = group.join('\n').replace(/\r/g, '');
    const open = `<div class="mk-mdx" contenteditable="false" data-raw="${esc(raw).replace(/\n/g, '&#10;')}">`;
    return group.map((l, k) => (k === 0 ? open : '') + esc(l.replace(/\r$/, '')) + (k === group.length - 1 ? '</div>' : '') + (/\r$/.test(l) ? '\r' : ''));
  };
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], f = /^\s{0,3}(`{3,}|~{3,})/.exec(l);
    if (fence) { out.push(l); if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null; continue; }
    if (f) { fence = f[1]; out.push(l); continue; }
    const prevBlank = i === 0 || !lines[i - 1].trim();
    if (prevBlank && MDX_LINE.test(l)) {
      const group = [l]; while (i + 1 < lines.length && lines[i + 1].trim() && !MDX_TAG.test(lines[i + 1])) group.push(lines[++i]);
      out.push(...chip(group)); continue;
    }
    const tag = prevBlank ? MDX_TAG.exec(l) : null;
    if (tag) {
      const group = [l]; const close = new RegExp('</' + tag[1].replace(/\./g, '\\.') + '>\\s*$');
      // the opening tag may span lines; a self-closing tag ends there, otherwise the group runs to </Name>
      let tagEnded = /\/?>/.test(l.slice(tag[0].length)), selfClosed = /\/>\s*$/.test(l) && !/>[^>]*</.test(l);
      let done = selfClosed || close.test(l);
      while (!done && i + 1 < lines.length && lines[i + 1].trim() && group.length < 80) {
        const n = lines[++i]; group.push(n);
        if (!tagEnded && /\/>\s*$/.test(n)) done = true;
        else { if (!tagEnded && />/.test(n)) tagEnded = true; done = close.test(n); }
      }
      out.push(...chip(group)); continue;
    }
    out.push(l);
  }
  return out.join('\n');
}

// Pictures written by other editors (MarkText, Typora, Zettlr …): a path with spaces and no <…>, or a file:/// URL.
// Only what is drawn changes (same line count); the document keeps the path exactly as typed.
function picturePaths(body) {
  if (!/!\[/.test(body)) return body;
  let fence = null;
  return body.split('\n').map(l => {
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(l);
    if (fence) { if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null; return l; }
    if (f) { fence = f[1]; return l; }
    if (!/!\[/.test(l)) return l;
    return l.replace(/(!\[(?:[^[\]\n]|\[[^\]\n]*\])*\]\()([^()<>\n]*?)(\s+"[^"\n]*")?\)/g, (m, head, dest, title, off) => {
      if ((l.slice(0, off).match(/`/g) || []).length % 2) return m; // inside `code`
      const was = dest.trim();
      let d = was.replace(/^file:\/\/(?:localhost)?\/?(?=[A-Za-z]:[\\/])/i, '').replace(/^file:\/\/(?:localhost)?(?=\/)/i, '');
      if (/^[A-Za-z]:\\/.test(d)) d = d.replace(/\\/g, '/'); // C:\pics\x.png (a backslash would be read as an escape)
      if (d === was && !/\s/.test(d)) return m;
      return `${head}<${d}>${title || ''})`;
    });
  }).join('\n');
}

function render(text, opts = {}) {
  const fm = splitFrontMatter(text);
  // one macro copy per render: \gdef in one equation is visible to later ones, never leaks into the caller's object
  const env = { bib: opts.bib || {}, macros: normMacros(opts.macros) };
  let body = fm.body;
  // R Markdown / Quarto chunks ```{r} → ```r
  body = body.replace(/^```\{(\w+)[^}]*\}/gm, '```$1');
  body = mdxPlaceholders(body);
  body = picturePaths(body);
  let html = callouts(md.render(body, env)) + bibliography(env);
  let head = '';
  const esc = md.utils.escapeHtml, m = fm.meta;
  const title = metaText(metaGet(m, 'title')), subtitle = metaText(metaGet(m, 'subtitle'));
  const author = metaText(metaGet(m, 'author')), date = metaText(metaGet(m, 'date')), abstract = metaText(metaGet(m, 'abstract'));
  if (title) head += `<h1 class="mk-title">${esc(title)}</h1>`;
  if (subtitle) head += `<p class="mk-subtitle">${esc(subtitle)}</p>`;
  if (author) head += `<p class="mk-author">${esc(author)}</p>`;
  if (date) head += `<p class="mk-date">${esc(date)}</p>`;
  if (abstract) head += `<div class="mk-abstract"><strong>Abstract.</strong> ${md.renderInline(abstract, Object.assign({}, env, { footnotes: undefined }))}</div>`; // own footnote list: the body's footnotes must not be repeated in the box
  if (head) html = `<header class="mk-front" contenteditable="false">${head}</header>` + html;
  return { html: sanitize(html), meta: fm.meta, frontMatter: fm.raw, cited: env.cited || [] };
}

// ---------- cross-reference scan: every heading, display equation, picture, table and footnote in source order ----------
// Uses the same parser as render(), so what it finds is exactly what is drawn. Lines are 0-based in the full text.
function inlineText(children) {
  let s = '';
  for (const c of children || []) {
    if (c.type === 'text' || c.type === 'code_inline') s += c.content;
    else if (c.type === 'math') s += c.meta && c.meta.display ? ' ' : '$' + c.content + '$';
    else if (c.type === 'softbreak' || c.type === 'hardbreak') s += ' ';
    else if (c.type === 'image') s += inlineText(c.children);
    else if (c.type === 'citation' || c.type === 'xref') s += c.meta && c.meta.raw || '';
  }
  return s.replace(/\s+/g, ' ').trim();
}
function xrefScan(text) {
  text = String(text ?? '');
  const fm = splitFrontMatter(text);
  const off = (fm.raw.match(/\n/g) || []).length;
  let toks = [];
  const env = {};
  try { toks = md.parse(picturePaths(fm.body.replace(/^```\{(\w+)[^}]*\}/gm, '```$1')), env); } catch (e) { console.error('xref scan failed', e); }
  const items = [];
  const L = map => (map ? map[0] + off : null);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.type === 'heading_open') {
      const inl = toks[i + 1];
      items.push({ kind: 'sec', level: +t.tag.slice(1), text: inlineText(inl && inl.children), id: t.attrGet('id'), label: t.attrGet('data-label') || null, attrs: t.attrGet('data-attrs'), unnumbered: !!t.attrGet('data-unnumbered'), line: L(t.map), endLine: t.map ? t.map[1] - 1 + off : null });
    } else if (t.type === 'math_block') {
      const m = eqMeta(t.content), a = t.meta && t.meta.attrs;
      items.push({ kind: 'eq', block: true, tex: t.content, label: (a && a.id) || m.label || null, labelFrom: a && a.id ? 'attrs' : m.label ? 'tex' : null, attrs: a ? a.raw : null, tag: m.tag, tagStar: m.tagStar, unnumbered: !!((a && a.unnumbered) || m.notag || m.envStar), env: m.env, delim: t.meta.delim, line: L(t.map), endLine: t.map ? t.map[1] - 1 + off : null });
    } else if (t.type === 'table_open') {
      const c = t.meta && t.meta.caption;
      items.push({ kind: 'tbl', label: (c && c.label) || null, caption: c ? c.text : '', captionPos: c ? c.pos : null, captionLine: c && c.line != null ? c.line + off : null, attrs: c && c.attrs ? c.attrs.raw : null, line: L(t.map), endLine: t.map ? t.map[1] - 1 + off : null });
    } else if (t.type === 'footnote_open') {
      const label = t.meta && t.meta.label;
      let j = i + 1; while (j < toks.length && toks[j].type !== 'inline' && toks[j].type !== 'footnote_close') j++;
      if (label != null) items.push({ kind: 'fn', label: String(label), text: toks[j] && toks[j].type === 'inline' ? inlineText(toks[j].children) : '', line: null });
    } else if (t.type === 'inline' && t.children) {
      // table cells: markdown-it puts the line on the row (tr_open), not on the cell
      if (!t.map) for (let k = i - 1; k >= 0 && k > i - 400; k--) { if (toks[k].type === 'tr_open') { t.map = toks[k].map; break; } if (toks[k].type === 'table_open') break; }
      let imgIndex = 0;
      for (const c of t.children) {
        if (c.type === 'math' && c.meta && c.meta.display) {
          const m = eqMeta(c.content), a = c.meta.attrs;
          items.push({ kind: 'eq', block: false, tex: c.content, label: (a && a.id) || m.label || null, labelFrom: a && a.id ? 'attrs' : m.label ? 'tex' : null, attrs: a ? a.raw : null, tag: m.tag, tagStar: m.tagStar, unnumbered: !!((a && a.unnumbered) || m.notag || m.envStar), env: m.env, delim: c.meta.delim, line: L(t.map), endLine: t.map ? t.map[1] - 1 + off : null });
        } else if (c.type === 'image') {
          const a = c.meta && c.meta.attrs;
          items.push({ kind: 'fig', label: (a && a.id) || null, attrs: a ? a.raw : null, caption: inlineText(c.children), src: c.attrGet('src') || '', figure: !!(c.meta && c.meta.figure), index: imgIndex++, line: L(t.map), endLine: t.map ? t.map[1] - 1 + off : null });
        }
      }
    }
  }
  const title = metaText(metaGet(fm.meta, 'title'));
  return { items, title, hasTitle: !!title, meta: fm.meta, frontLines: off };
}

// ---------- flavor detection ----------
function detectFlavor(text) {
  // fenced code keeps only its fence line, and inline code spans are emptied, so $HOME in code is not "math"
  const t = String(text ?? '').replace(/\r\n/g, '\n')
    .replace(/```[\s\S]*?```/g, m => (/^```\{/.test(m) ? '```{chunk}```' : m.slice(0, 3) + m.split('\n')[0].slice(3) + '\n```'))
    .replace(/(`+)(?!`)[^\n]*?[^`]\1(?!`)/g, '``');
  const has = re => re.test(t);
  const features = [];
  // same rule as the renderer: no space after the opening $ or before the closing $, and no digit right after it ($5 … $10 is money)
  const math = has(/(^|[^\\$])\$(?=\S)[^$\n]*?\S\$(?!\d)|(^|[^\\$])\$[^\s$\d]\$(?!\d)|\$\$[\s\S]+?\$\$|\\\(|\\\[|\\begin\{(equation|align)/m);
  if (math) features.push('LaTeX math');
  if (has(/^```\{(r|python|julia)/m) || has(/^```\{chunk\}/m)) return { name: /^---[\s\S]*?format:/m.test(text) ? 'Quarto' : 'R Markdown', features };
  if (has(/^(?:import\s.+\sfrom\s|export\s+(?:const|default|function)\b)/m) || has(/^<[A-Z][\w.]*(?:\s[^\n]*)?\/?>\s*$/m)) return { name: 'MDX', features };
  const wiki = has(/\[\[[^\]]+\]\]/), callout = has(/^>\s*\[!\w+\]/m);
  const obs = wiki || callout;
  const pandoc = has(/\[[^\]\n]*@[\w:.-]+/) || has(/^:::+\s*[\w{]/m) || has(/\^\[/) || has(/^[^\n]+\n:\s{1,3}\S/m) || has(/\{#[\w:.-]+[^}\n]*\}/) || has(/^---\n[\s\S]*?\n(title|bibliography|csl|author):/m);
  const gfmF = has(/^\|.+\|\s*\n\|[\s:|-]+\|/m) || has(/^\s*[-*]\s\[[ xX]\]/m) || has(/~~[^~]+~~/) || has(/^```\w*/m);
  const mmd = !/^---/.test(t) && /^([A-Za-z][\w ]*):\s.+\n(?:[A-Za-z][\w ]*:\s.+\n)*\n/.test(t);
  const foot = has(/\[\^[^\]]+\]/);
  if (wiki) features.push('wikilinks');
  if (foot) features.push('footnotes');
  if (has(/```mermaid/)) features.push('Mermaid');
  let name = 'CommonMark';
  if (callout) features.push('callouts');
  // Pandoc syntax (citations, ::: divs) outweighs a lone callout; wikilinks always mean Obsidian
  if (wiki || (obs && !pandoc)) name = 'Obsidian';
  else if (pandoc) name = 'Pandoc';
  else if (mmd) name = 'MultiMarkdown';
  else if (gfmF) name = 'GitHub (GFM)';
  if (math && (name === 'CommonMark' || name === 'Pandoc')) name = name === 'Pandoc' ? 'Pandoc + LaTeX' : 'LaTeX Markdown';
  return { name, features };
}

// ---------- HTML → Markdown (used by Word mode and imports) ----------
const cls = (n, c) => !!(n && n.classList && n.classList.contains(c));
// Attribute block for a labeled element: the exact source while it still says the same thing, else rebuilt.
function attrText(n, texLabel) {
  const id = n.getAttribute('data-label') || '';
  const unnum = n.hasAttribute('data-unnumbered');
  const raw = n.getAttribute('data-attrs');
  const want = id && id !== texLabel ? id : '';
  if (raw) { const a = parseAttrs(raw); if ((a.id || '') === want && a.unnumbered === unnum) return raw; }
  return buildAttrs(want, raw, unnum);
}
const texLabelOf = n => { const m = n.querySelector && n.querySelector('.mk-math'); return (m && eqMeta(m.getAttribute('data-tex') || '').label) || ''; };
const commentText = s =>String(s || '').replace(/--+>/g, '—>').replace(/<!--/g, '<!—');
// Elements that are empty on purpose (Turndown would drop them as "blank").
function specialBlank(n) {
  if (cls(n, 'mk-comment')) return `<!-- comment: ${commentText(n.getAttribute('data-text'))} -->`;
  if (cls(n, 'mk-htmlcomment')) return `<!--${n.getAttribute('data-raw') || ''}-->`;
  if (cls(n, 'page-break')) return '\n\n<div class="page-break"></div>\n\n';
  if (n.nodeName === 'PRE' && cls(n, 'mermaid')) return '\n\n```mermaid\n' + (n.getAttribute('data-src') || '').trim() + '\n```\n\n';
  if (cls(n, 'mk-mdx')) return '\n\n' + (n.getAttribute('data-raw') || '') + '\n\n';
  // empty anchors such as <a id="sec-2"></a> are link targets the author placed on purpose
  if (n.nodeName === 'A' && !n.hasAttribute('href') && (n.id || n.getAttribute('name'))) return rawOpenTag(n) + '</a>';
  return null;
}
// Attributes the renderer or the editors add; everything else on an inline element is the author's.
const UI_ATTR = /^(data-line|data-done|data-mk-.*|data-auto|contenteditable|spellcheck|draggable|tabindex)$/;
function rawOpenTag(n) {
  const at = Array.from(n.attributes).filter(a => !UI_ATTR.test(a.name)).map(a => (a.value === '' ? ` ${a.name}` : ` ${a.name}="${String(a.value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)).join('');
  return `<${n.nodeName.toLowerCase()}${at}>`;
}
const RENDER_CLASS = /^(mk-|katex|footnote|header-anchor|hljs|callout|task-list|contains-task|eq-|mkr-|mke-|mkx-|math)/;
function authorInline(n) {
  if (!/^(SPAN|A|SUP|SUB|SMALL|CITE|Q|DFN|VAR|SAMP|BDI|BDO|TIME|DATA|S|U|EM|STRONG|B|I|CODE|MARK)$/.test(n.nodeName)) return false;
  if (n.hasAttribute('data-mk-ui') || n.getAttribute('contenteditable') === 'false') return false;
  if ((n.getAttribute('class') || '').split(/\s+/).some(c => c && RENDER_CLASS.test(c))) return false;
  if (n.nodeName === 'A' && n.hasAttribute('data-auto')) return false;
  return Array.from(n.attributes).some(a => a.name === 'class' || a.name === 'id' || a.name === 'lang' || a.name === 'dir' || (a.name.startsWith('data-') && !UI_ATTR.test(a.name)));
}
function makeTurndown(prefs = {}) {
  const td = new TurndownService({
    headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*', strongDelimiter: '**', hr: '---',
    blankReplacement: (content, n) => { const s = specialBlank(n); return s != null ? s : (n.isBlock ? '\n\n' : ''); },
  });
  td.use(gfm);
  // a literal "$" was typed as \$ (markdown-it drops the backslash); math atoms have their own rule
  const baseEscape = td.escape.bind(td);
  // (only where two dollars would pair up as math, so "costs $5 or $10" stays as typed)
  td.escape = s => { const e = baseEscape(s); return /\$(?=[^\s$])[^$]*?\S\$(?!\d)|\$\$/.test(e) ? e.replace(/\$/g, '\\$') : e; };
  td.addRule('listItem', {
    filter: 'li',
    replacement: (content, node) => {
      let prefix = '- ';
      const parent = node.parentNode;
      if (parent && parent.nodeName === 'OL') {
        const start = parent.getAttribute('start');
        const index = Array.prototype.indexOf.call(parent.children, node);
        prefix = (start ? Number(start) + index : index + 1) + '. ';
      }
      const isParagraph = /\n$/.test(content);
      content = content.replace(/^\n+/, '').replace(/\n+$/, '') + (isParagraph ? '\n' : '');
      content = content.replace(/\n(?=[^\n])/g, '\n' + ' '.repeat(prefix.length)); // blank lines stay empty
      return prefix + content + (node.nextSibling ? '\n' : '');
    },
  });
  td.addRule('comment', { filter: n => cls(n, 'mk-comment') || cls(n, 'mk-htmlcomment'), replacement: (_c, n) => specialBlank(n) });
  td.addRule('pageBreak', { filter: n => cls(n, 'page-break'), replacement: (_c, n) => specialBlank(n) });
  td.addRule('aligned', {
    filter: n => (n.nodeName === 'DIV' || n.nodeName === 'P') && /^(left|center|right|justify)$/i.test(n.getAttribute('align') || '') && !cls(n, 'mk-math-block'),
    replacement: (c, n) => `\n\n<div align="${n.getAttribute('align').toLowerCase()}">\n\n${c.trim()}\n\n</div>\n\n`,
  });
  td.addRule('br', { filter: 'br', replacement: () => '<br>' });
  td.addRule('deflist', { filter: 'dl', replacement: c => `\n\n${c.trim()}\n\n` });
  td.addRule('dt', { filter: 'dt', replacement: c => `\n\n${c.trim()}\n` });
  td.addRule('dd', { filter: 'dd', replacement: c => `:   ${c.trim().replace(/\n/g, '\n    ')}\n` });
  const inlineDelims = { d: ['$', '$'], paren: ['\\(', '\\)'], dd: ['$$', '$$'], bracket: ['\\[', '\\]'] };
  td.addRule('math', {
    filter: n => n.classList && n.classList.contains('mk-math'),
    replacement: (_c, n) => {
      const tex = n.getAttribute('data-tex'); let delim = n.getAttribute('data-delim') || (n.classList.contains('display') ? 'dd' : prefs.inlineMath || 'd');
      if (delim === 'env') return `\n\n${tex}\n\n`;
      const [o, c] = inlineDelims[delim] || inlineDelims.d;
      const block = n.classList.contains('display') && n.parentNode && cls(n.parentNode, 'mk-math-block');
      if (block) return `\n\n${o}\n${tex}\n${c}\n\n`;
      const a = n.classList.contains('display') ? attrText(n, eqMeta(tex).label || '') : '';
      return `${o}${tex}${c}${a ? ' ' + a : ''}`;
    },
  });
  td.addRule('mathBlock', { filter: n => n.classList && n.classList.contains('mk-math-block'), replacement: (c, n) => { const a = attrText(n, texLabelOf(n)); return `\n\n${c.trim()}${a ? ' ' + a : ''}\n\n`; } });
  // numbers, caption prefixes and other screen-only pieces the app adds to the page
  td.addRule('mkUi', { filter: n => n.nodeType === 1 && n.hasAttribute && n.hasAttribute('data-mk-ui'), replacement: () => '' });
  td.addRule('xref', {
    filter: n => cls(n, 'mk-xref'),
    replacement: (_c, n) => {
      const keys = (n.getAttribute('data-ref') || '').split(';').filter(Boolean);
      const raw = n.getAttribute('data-raw') || '';
      const rawKeys = (raw.match(/-?@[\w.:-]*\w/g) || []).map(k => k.replace(/^-?@/, '').replace(/^[A-Z][a-z]+(?=:)/, x => x.toLowerCase()));
      if (raw && rawKeys.join(';') === keys.join(';')) return raw;
      if (!keys.length) return '';
      const cap = n.getAttribute('data-cap') === '1', sup = n.getAttribute('data-suppress') === '1';
      const k = keys.map(x => (cap ? x[0].toUpperCase() + x.slice(1) : x));
      if (n.getAttribute('data-form') === 'bare' && k.length === 1 && !sup) return '@' + k[0];
      return `[${k.map(x => (sup ? '-@' : '@') + x).join('; ')}]`;
    },
  });
  td.addRule('figure', {
    filter: n => n.nodeName === 'FIGURE' && cls(n, 'mk-figure'),
    replacement: (_c, n) => {
      const img = n.querySelector('img'); if (!img) return '';
      const fc = n.querySelector('figcaption');
      let cap = img.getAttribute('alt') || '';
      if (fc) { const c = fc.cloneNode(true); c.querySelectorAll('[data-mk-ui]').forEach(x => x.remove()); cap = td.turndown(c.innerHTML).replace(/\s*\n+\s*/g, ' ').trim(); }
      const src = img.getAttribute('data-mk-src') || img.getAttribute('src') || '';
      const title = img.getAttribute('title');
      return `\n\n![${cap}](${/\s/.test(src) ? '<' + src + '>' : src}${title ? ` "${title.replace(/"/g, '\\"')}"` : ''})${attrText(n, '')}\n\n`;
    },
  });
  td.addRule('imgAttrs', {
    filter: n => n.nodeName === 'IMG' && (n.hasAttribute('data-attrs') || n.hasAttribute('data-label')) && !(n.parentNode && cls(n.parentNode, 'mk-figure')),
    replacement: (_c, n) => {
      const src = n.getAttribute('data-mk-src') || n.getAttribute('src') || '', title = n.getAttribute('title');
      return `![${(n.getAttribute('alt') || '').replace(/([[\]])/g, '\\$1')}](${/\s/.test(src) ? '<' + src + '>' : src}${title ? ` "${title.replace(/"/g, '\\"')}"` : ''})${attrText(n, '')}`;
    },
  });
  td.addRule('headingAttrs', {
    filter: n => /^H[1-6]$/.test(n.nodeName) && (n.hasAttribute('data-attrs') || n.hasAttribute('data-label')) && !cls(n, 'mk-title'),
    replacement: (c, n) => { const a = attrText(n, ''); return `\n\n${'#'.repeat(+n.nodeName[1])} ${c.trim()}${a ? ' ' + a : ''}\n\n`; },
  });
  td.addRule('tableCaption', {
    filter: n => n.nodeName === 'P' && cls(n, 'mk-tcaption'),
    replacement: (c, n) => {
      const pre = n.getAttribute('data-prefix') || ':';
      const id = n.getAttribute('data-for') || '';
      const raw = n.getAttribute('data-attrs');
      let a = raw || '';
      if (raw) { const x = parseAttrs(raw); if ((x.id || '') !== id) a = buildAttrs(id, raw, x.unnumbered); } else if (id) a = `{#${id}}`;
      return `\n\n${pre} ${c.trim()}${a ? ' ' + a : ''}\n\n`;
    },
  });
  td.addRule('katexLoose', { filter: n => n.classList && (n.classList.contains('katex') || n.classList.contains('katex-display')), replacement: (_c, n) => { const a = n.querySelector('annotation'); return a ? `$${a.textContent}$` : ''; } });
  td.addRule('mermaid', { filter: n => n.nodeName === 'PRE' && n.classList.contains('mermaid'), replacement: (_c, n) => '\n\n```mermaid\n' + (n.getAttribute('data-src') || n.textContent).trim() + '\n```\n\n' });
  td.addRule('codeLang', { filter: n => n.nodeName === 'PRE' && n.hasAttribute('data-lang'), replacement: (_c, n) => '\n\n```' + n.getAttribute('data-lang') + '\n' + n.textContent.replace(/\n$/, '') + '\n```\n\n' });
  td.addRule('cite', {
    filter: n => n.classList && n.classList.contains('mk-cite'),
    replacement: (_c, n) => {
      const keys = (n.getAttribute('data-keys') || '').split(';').filter(Boolean);
      const loc = n.getAttribute('data-locator') || '';
      const raw = n.getAttribute('data-raw') || '';
      // the exact source wins while it still names the same keys and locator
      if (raw) {
        const sig = n.getAttribute('data-sig');
        if (sig != null) { if (sig === citeSig(keys, loc)) return raw; }
        else {
          const m = /^\[([^\[\]]*)\]$/.exec(raw), items = m && parseCiteItems(m[1]);
          if (items && items.map(it => it.key).join(';') === keys.join(';') && (items[items.length - 1].locator || '') === loc) return raw;
        }
      }
      if (n.getAttribute('data-narrative') === '1' && keys.length === 1 && !loc) return '@' + keys[0];
      return `[${keys.map(k => '@' + k).join('; ')}${loc ? ', ' + loc : ''}]`;
    },
  });
  td.addRule('front', { filter: n => n.classList && (n.classList.contains('mk-front') || n.classList.contains('mk-bibliography')), replacement: () => '' });
  td.addRule('wiki', { filter: n => n.nodeName === 'A' && n.classList.contains('mk-wiki'), replacement: (c, n) => { const t = n.getAttribute('href').replace(/\.md$/, ''); return t === c ? `[[${t}]]` : `[[${t}|${c}]]`; } });
  td.addRule('wikiEmbed', { filter: n => n.nodeName === 'IMG' && n.classList.contains('mk-wiki-embed') && n.hasAttribute('data-raw'), replacement: (_c, n) => n.getAttribute('data-raw') });
  td.addRule('mark', { filter: ['mark'], replacement: c => `==${c}==` });
  td.addRule('del', { filter: ['del', 's', 'strike'], replacement: c => `~~${c}~~` });
  td.addRule('sub', { filter: ['sub'], replacement: c => `~${c}~` });
  td.addRule('sup', { filter: n => n.nodeName === 'SUP' && !n.classList.contains('footnote-ref'), replacement: c => `^${c}^` });
  td.addRule('u', { filter: ['u', 'ins'], replacement: c => `<u>${c}</u>` });
  const fnBody = li => { const c = li.cloneNode(true); c.querySelectorAll('.footnote-backref').forEach(x => x.remove()); return td.turndown(c.innerHTML).trim(); };
  const fnItem = (root, id) => { try { return root.querySelector(`li.footnote-item[id="fn${id}"]`); } catch { return null; } };
  td.addRule('fnref', {
    filter: n => n.nodeName === 'SUP' && n.classList.contains('footnote-ref'),
    replacement: (_c, n) => {
      const a = n.querySelector('a'); const id = (a && a.getAttribute('href') || '').replace(/^#fn/, '').replace(/:\d+$/, '');
      if (n.getAttribute('data-inline') === '1') {
        if (n.hasAttribute('data-src')) return `^[${n.getAttribute('data-src')}]`;
        let root = n; while (root.parentNode) root = root.parentNode;
        const li = root.querySelector ? fnItem(root, id) : null;
        if (li) return `^[${fnBody(li).replace(/\n+/g, ' ')}]`;
      }
      return `[^${n.getAttribute('data-label') || id}]`;
    },
  });
  td.addRule('fnsec', {
    filter: n => n.nodeName === 'SECTION' && n.classList.contains('footnotes'),
    replacement: (_c, n) => {
      const items = [...n.querySelectorAll('li.footnote-item, li')].filter((li, i, a) => a.indexOf(li) === i && li.getAttribute('data-inline') !== '1');
      if (!items.length) return '\n\n';
      return '\n\n' + items.map((li, i) => {
        const label = li.getAttribute('data-label') || (li.id || '').replace(/^fn/, '') || String(i + 1);
        return `[^${label}]: ${fnBody(li).replace(/\n/g, '\n    ').replace(/\n {4}\n/g, '\n\n')}`;
      }).join('\n') + '\n';
    },
  });
  td.addRule('fnsep', { filter: n => n.nodeName === 'HR' && n.classList.contains('footnotes-sep'), replacement: () => '' });
  td.addRule('callout', { filter: n => n.nodeName === 'BLOCKQUOTE' && /callout-/.test(n.className), replacement: (c, n) => { const kind = (n.className.match(/callout-(\w+)/) || [, 'note'])[1].toUpperCase(); const t = n.querySelector('.callout-title'); let body = c.trim(); const title = t ? t.textContent : ''; body = body.replace(/^\*\*[^*]*\*\*\s*(<br>\s*)?/, ''); return '\n\n' + `[!${kind}]${title && title.toUpperCase() !== kind ? ' ' + title : ''}\n${body}`.split('\n').map(l => '> ' + l).join('\n') + '\n\n'; } });
  // fenced divs write their original fence line back; an outer div gets more colons than the ones inside it
  const divDepth = n => { let d = 0; for (const c of n.querySelectorAll('div[data-fence]')) { let k = 1, p = c.parentNode; while (p && p !== n) { if (p.nodeName === 'DIV' && p.hasAttribute('data-fence')) k++; p = p.parentNode; } d = Math.max(d, k); } return d; };
  td.addRule('container', {
    filter: n => n.nodeName === 'DIV' && (n.hasAttribute('data-fence') || /^(note|tip|warning|important|caution|info|abstract|theorem|proof|definition|lemma|example|columns|center)$/.test(n.className)),
    replacement: (c, n) => {
      const info = n.getAttribute('data-fence') || n.className;
      const colons = ':'.repeat(Math.max(Number(n.getAttribute('data-colons')) || 3, 3 + divDepth(n)));
      return `\n\n${colons} ${info}\n${c.trim()}\n${colons}\n\n`;
    },
  });
  td.addRule('mdx', { filter: n => cls(n, 'mk-mdx'), replacement: (_c, n) => specialBlank(n) });
  td.addRule('task', { filter: n => n.nodeName === 'INPUT' && n.type === 'checkbox', replacement: (_c, n) => (n.checked ? '[x] ' : '[ ] ') });
  td.addRule('anchorHeading', { filter: n => n.nodeName === 'A' && n.classList.contains('header-anchor'), replacement: () => '' });
  // <https://…> and bare URLs stay as typed (Turndown alone would write [url](url) with escapes)
  td.addRule('autolink', {
    filter: n => n.nodeName === 'A' && n.hasAttribute('data-auto') && n.hasAttribute('href'),
    replacement: (c, n) => {
      const href = n.getAttribute('href'), text = n.textContent;
      const same = href === text || href === 'mailto:' + text || href === 'http://' + text;
      if (!same) return `[${c}](${href})`;
      return n.getAttribute('data-auto') === 'angle' ? `<${text}>` : text;
    },
  });
  // raw inline HTML with the author's own attributes (<span class="smallcaps">, <sup id=…>, <a id=…>) is kept as HTML
  td.addRule('rawInline', {
    filter: n => n.nodeType === 1 && authorInline(n),
    replacement: (c, n) => `${rawOpenTag(n)}${c}</${n.nodeName.toLowerCase()}>`,
  });
  td.keep(['kbd', 'abbr', 'iframe', 'video', 'audio', 'details', 'summary']);
  return td;
}
const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function toMarkdown(html, prefs) {
  let src = String(html ?? '');
  // line numbers and editor flags must never reach raw HTML that Turndown keeps as it is (<details>, <iframe> …)
  src = src.replace(/<[A-Za-z][^<>]*>/g, tag => tag.replace(/\s(?:data-line|data-done)="[^"]*"/g, ''))
    .replace(/<(details|summary|iframe|video|audio|kbd|abbr)\b[^<>]*>/gi, tag => tag.replace(/\s(?:contenteditable|spellcheck|draggable)(?:="[^"]*")?/g, ''));
  src = src.replace(/<(th|td)\b([^>]*?)\sstyle="text-align:\s*(left|right|center);?"/gi, '<$1$2 align="$3"');
  // raw HTML comments survive as markers (Turndown ignores comment nodes)
  src = src.replace(/<!--([\s\S]*?)-->/g, (_m, t) => {
    const c = /^\s*comment:\s*([\s\S]*?)\s*$/i.exec(t);
    return c ? `<span class="mk-comment" data-text="${escAttr(c[1])}"></span>` : `<span class="mk-htmlcomment" data-raw="${escAttr(t)}"></span>`;
  });
  return makeTurndown(prefs).turndown(src)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^(\s*(?:[-*]|\d+\.)\s+)\\\[([ xX])\\\]/gm, '$1[$2]')
    .replace(/^(\s*-)\s+\[/gm, '$1 [')
    .replace(/^(\s*(?:[-*]|\d+\.) \[[ xX]\]) {2,}/gm, '$1 ')
    .trim() + '\n';
}
// ---------- spelling (writing module): nspell + Hunspell dictionaries, all offline ----------
// en-US (dictionary-en) and en-GB (dictionary-en-gb) are bundled; other languages arrive as aff/dic text
// through mk.spell.register (language packs). Dictionaries load on first use (about 0.2 s each).
const spellState = { dicts: new Map(), raw: new Map(), personal: new Set() };
const SPELL_PKG = { 'en-US': 'dictionary-en', 'en-GB': 'dictionary-en-gb' };
const spellCode = c => {
  const s = String(c || 'en-US').trim().replace('_', '-');
  if (/^en(-us)?$/i.test(s)) return 'en-US';
  if (/^en-(gb|uk|au|nz|ie|za|in|pk)$/i.test(s)) return 'en-GB';
  const [a, b] = s.split('-'); return b ? a.toLowerCase() + '-' + b.toUpperCase() : a.toLowerCase();
};
function spellFor(code) {
  code = spellCode(code);
  if (spellState.dicts.has(code)) return spellState.dicts.get(code);
  let sp = null;
  try {
    const nspell = require('nspell');
    let aff, dic;
    if (SPELL_PKG[code]) {
      const fs = require('fs'), path = require('path');
      const dir = path.dirname(require.resolve(SPELL_PKG[code]));
      aff = fs.readFileSync(path.join(dir, 'index.aff')); dic = fs.readFileSync(path.join(dir, 'index.dic'));
      spellState.raw.set(code, dic);
    } else if (spellState.raw.has(code + ':aff')) { aff = spellState.raw.get(code + ':aff'); dic = spellState.raw.get(code); }
    if (aff && dic) { sp = nspell(aff, dic); for (const w of spellState.personal) sp.add(w); }
  } catch (e) { console.error('spelling dictionary', code, e); sp = null; }
  if (sp || SPELL_PKG[code]) spellState.dicts.set(code, sp);
  return sp;
}
// British dictionaries use -ise; Oxford spelling (-ize) is British too, so it is never a spelling mistake there.
function spellOk(sp, code, w) {
  if (sp.correct(w)) return true;
  if (code === 'en-GB' && /iz(e|es|ed|ing|ation|ations|er|ers|able)$/i.test(w) && sp.correct(w.replace(/iz(?=(e|es|ed|ing|ation|ations|er|ers|able)$)/i, 'is'))) return true;
  // curly apostrophes as typed by smart quotes
  if (/[’‘]/.test(w) && sp.correct(w.replace(/[’‘]/g, "'"))) return true;
  return false;
}
const spellApi = {
  // Chromium's checker (kept for old callers)
  misspelled: w => { try { return !!webFrame.isWordMisspelled(String(w)); } catch { return false; } },
  suggestions: w => { try { return webFrame.getWordSuggestions(String(w)) || []; } catch { return []; } },
  normalize: spellCode,
  /** Languages that can check spelling now (bundled + registered). */
  languages: () => [...new Set(['en-US', 'en-GB', ...[...spellState.raw.keys()].filter(k => k.endsWith(':aff')).map(k => k.slice(0, -4))])],
  has: code => !!SPELL_PKG[spellCode(code)] || spellState.raw.has(spellCode(code) + ':aff'),
  /** Load a dictionary now (returns true when it is ready). */
  load: code => !!spellFor(code),
  /** Add a Hunspell dictionary from text (language packs). */
  register(code, aff, dic) {
    code = spellCode(code);
    if (typeof aff !== 'string' || typeof dic !== 'string' || !aff || !dic || aff.length > 20e6 || dic.length > 60e6) return false;
    spellState.raw.set(code + ':aff', aff); spellState.raw.set(code, dic); spellState.dicts.delete(code);
    return true;
  },
  /** Words from `words` the dictionary does not know (returns their indexes). */
  check(code, words) {
    code = spellCode(code); const sp = spellFor(code); if (!sp || !Array.isArray(words)) return [];
    const out = [];
    for (let i = 0; i < words.length; i++) { const w = String(words[i]); try { if (!spellOk(sp, code, w)) out.push(i); } catch {} }
    return out;
  },
  correct(code, word) { code = spellCode(code); const sp = spellFor(code); try { return sp ? spellOk(sp, code, String(word)) : true; } catch { return true; } },
  suggest(code, word, n = 8) {
    const sp = spellFor(code); if (!sp) return [];
    try { return sp.suggest(String(word)).slice(0, n); } catch { return []; }
  },
  /** The user's own dictionary (kept in settings by the writing module; applied to every language). */
  setPersonal(words) {
    const next = new Set((Array.isArray(words) ? words : []).map(String).filter(w => w && w.length < 80));
    for (const sp of spellState.dicts.values()) { if (!sp) continue; for (const w of spellState.personal) if (!next.has(w)) { try { sp.remove(w); } catch {} } for (const w of next) if (!spellState.personal.has(w)) { try { sp.add(w); } catch {} } }
    spellState.personal = next; return next.size;
  },
  /** Plain word list of a dictionary (stems without affix flags), for word completion. */
  words(code) {
    code = spellCode(code); spellFor(code);
    const raw = spellState.raw.get(code); if (!raw) return [];
    const text = typeof raw === 'string' ? raw : raw.toString('utf8');
    const out = [];
    for (const line of text.split('\n').slice(1)) { const w = line.split('/')[0].trim(); if (w && /^[\p{L}][\p{L}'’-]*$/u.test(w)) out.push(w); }
    return out;
  },
};

const inlineMath = (src, macros) => { try { return katex.renderToString(String(src), katexOpts(false, normMacros(macros))); } catch { return src; } };
const displayMath = (src, macros) => { try { return katex.renderToString(String(src), katexOpts(true, normMacros(macros))); } catch { return src; } };

// Errors from main may carry actions (Try again, Save to another folder …) and technical details after a marker
// (main.js errorForIpc). The window gets the plain message; mk.errorInfo(e) gives the rest back. contextBridge copies
// only an Error's message, so the extras are kept here, keyed by the plain message.
const ERR_MARK = String.fromCharCode(10, 0x2063) + 'mk-info:'; // newline, invisible separator, tag
const errInfos = new Map();
const plainText = m => String(m || '').replace(/^Error invoking remote method '[^']+':\s*/, '').replace(/^(?:\w*Error:\s*)+/, '').trim();
function takeErrorInfo(e) {
  const msg = String((e && e.message) || e || '');
  const at = msg.indexOf(ERR_MARK);
  if (at < 0) return e;
  let info = {};
  try { info = JSON.parse(msg.slice(at + ERR_MARK.length)) || {}; } catch {}
  const clean = msg.slice(0, at);
  const plain = plainText(clean);
  errInfos.set(plain, { message: plain, actions: Array.isArray(info.actions) ? info.actions : [], details: String(info.details || ''), code: info.code || null, tool: info.tool || null });
  while (errInfos.size > 50) errInfos.delete(errInfos.keys().next().value);
  const x = new Error(clean);
  if (info.code) x.code = info.code;
  return x;
}
function errorInfo(e) {
  const plain = plainText((e && e.message) || e);
  const hit = errInfos.get(plain) || [...errInfos.values()].find(i => plain && (plain.includes(i.message) || i.message.includes(plain)));
  return hit ? { ...hit, actions: hit.actions.map(a => ({ ...a })) } : null;
}

contextBridge.exposeInMainWorld('mk', {
  render, detectFlavor, toMarkdown, parseBib, sanitize,
  frontMatter: { parse: frontMatterParse, write: frontMatterWrite },
  parseMacros: normMacros,
  // labels and cross-references (used by src/xref.js)
  xref: { scan: xrefScan, parseAttrs, buildAttrs, eqMeta: src => { const m = eqMeta(src); delete m.render; return m; }, attrPattern: ATTR_SRC },
  inlineMath, displayMath,
  // spelling for the writing module (nspell; Chromium's checker kept as misspelled/suggestions)
  spell: spellApi,
  platform: process.platform,
  // the user's home folder, for pictures written as ~/Pictures/x.png (src/core.js assetUrl, src/pictures.js)
  homeDir: (() => { try { return require('os').homedir(); } catch { return ''; } })(),
  versions: { electron: process.versions.electron, chrome: process.versions.chrome },
  invoke: (ch, ...a) => ipcRenderer.invoke(ch, ...a).catch(e => { throw takeErrorInfo(e); }),
  // {message, actions:[{id, label, url?, text?, tool?, path?}], details, code, tool} for an error from invoke, or null
  errorInfo,
  // put text on the clipboard (Copy command, Copy details)
  copyText: text => ipcRenderer.invoke('clipboard-write', String(text ?? '')),
  // Electron 32+ has no File.path: dropped files get their real path here
  pathForFile: f => { try { return webUtils.getPathForFile(f) || null; } catch { return null; } },
  // interface translations (src/i18n.js, main-i18n.js): synchronous, so the first paint is already in the chosen language
  i18n: {
    boot: () => { try { return ipcRenderer.sendSync('i18n-boot'); } catch (e) { return { error: String(e && e.message || e) }; } },
    catalog: code => { try { return ipcRenderer.sendSync('i18n-catalog', String(code || '')); } catch (e) { return { error: String(e && e.message || e) }; } },
  },
  on: (ch, fn) => { const h = (_e, ...a) => fn(...a); ipcRenderer.on(ch, h); return () => ipcRenderer.removeListener(ch, h); },
});
