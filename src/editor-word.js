// Markooj — Word mode: the Markdown document rendered on a white A4 page you can click and type on.
// Edits are turned back into Markdown. Blocks you did not touch keep their original source text exactly.
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const mk = app.mk || window.mk || {};
  const E = app.editor = app.editor || {};
  const esc = E.esc || (s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));

  // ------------------------------------------------------------------ CSS
  E.injectCSS?.('mk-word-css', `
.mk-word{min-height:100%;padding:34px 24px 80px;display:flex;flex-direction:column;align-items:safe center;width:max-content;min-width:100%;box-sizing:border-box}
.mk-sheet{position:relative;flex:none}
.mk-word .mk-page{cursor:text}
.mk-word .mk-page[contenteditable=false]{cursor:default}
.mk-pmarks{position:absolute;inset:0;pointer-events:none}
.mk-pmark{position:absolute;left:0;right:0;height:0;border-top:1px dashed var(--line-2)}
.mk-pmark span{position:absolute;right:-74px;top:-9px;font:10.5px var(--font);letter-spacing:.03em;color:var(--text-3);white-space:nowrap}
.mk-word .mk-page .mk-sel{outline:2px solid var(--accent-ring);outline-offset:1px;background:var(--accent-soft);border-radius:4px}
.mk-word .mk-page pre.mermaid{cursor:pointer;transition:background .2s}
.mk-word .mk-page pre.mermaid:hover{background:var(--accent-soft)}
.mk-word .mk-page .task-list-item input{cursor:pointer}
.mk-word .mk-page td:focus-within,.mk-word .mk-page th:focus-within{background:var(--accent-soft)}
.mk-word .mk-page a[href]{cursor:text}
.mk-word.ctrl .mk-page a[href]{cursor:pointer;text-decoration:underline}
.mk-word .mk-page .mk-placeholder:only-child::before{content:attr(data-ph);color:var(--text-3);pointer-events:none;position:absolute}
.mk-float{position:fixed;display:flex;gap:2px;padding:4px;border-radius:10px;background:var(--chrome-solid);box-shadow:var(--pop-shadow);opacity:0;transform:translateY(6px) scale(.97);pointer-events:none;transition:opacity .18s,transform .22s var(--ease);z-index:900}
.mk-float.show{opacity:1;transform:none;pointer-events:auto}
.mk-float .ib{width:28px;height:27px;border-radius:6px;display:grid;place-items:center;color:var(--text);border:0;background:none;font:inherit;transition:background .15s,color .15s,transform .1s var(--ease)}
.mk-float .ib:hover{background:var(--hover)}.mk-float .ib:active{background:var(--press);transform:scale(.92)}
.mk-float .ib.on{background:var(--accent-soft);color:var(--accent)}
.mk-float .ib b,.mk-float .ib i,.mk-float .ib u{font:600 14px var(--serif)}
.mk-float .sep{width:.5px;height:18px;background:var(--line-2);margin:4px 3px}
.mk-float svg.i{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.mk-float .swatch{position:relative}.mk-float .swatch::after{content:"";position:absolute;left:7px;right:7px;bottom:4px;height:3px;border-radius:2px;background:var(--c)}
`);

  // ------------------------------------------------------------------ HTML → Markdown (normalizes contenteditable output first)
  const BLOCKS = /^(P|DIV|H[1-6]|UL|OL|LI|TABLE|THEAD|TBODY|TR|TD|TH|BLOCKQUOTE|PRE|SECTION|HEADER|ARTICLE|HR|FIGURE|DL|DT|DD|DETAILS)$/;
  const CONTAINERS = /^(note|tip|warning|important|caution|info|abstract|theorem|proof|definition|lemma|example|columns|center)$/;
  function preText(pre) {
    let s = '';
    (function walk(n) {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) s += c.data;
        else if (c.nodeName === 'BR') s += '\n';
        else if (c.nodeType === 1) { const blk = /^(DIV|P)$/.test(c.nodeName); if (blk && s && !s.endsWith('\n')) s += '\n'; walk(c); if (blk && !s.endsWith('\n')) s += '\n'; }
      }
    })(pre);
    return s.replace(/\u00a0/g, ' ');
  }
  function styleColor(st) {
    const out = [];
    const c = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(st || ''); if (c) out.push('color:' + c[1].trim());
    const b = /background(?:-color)?\s*:\s*([^;]+)/i.exec(st || ''); if (b && !/transparent|initial|inherit|none/i.test(b[1])) out.push('background:' + b[1].trim());
    return out.join(';');
  }
  function normalize(box, tok) {
    const T = v => { tok.push(v); return `MKTOK${tok.length - 1}X`; };
    const blockTok = (el, v) => { const p = document.createElement('p'); p.textContent = T(v); el.replaceWith(p); };
    const inlineTok = (el, v) => el.replaceWith(document.createTextNode(T(v)));
    box.querySelectorAll('.mk-ui,[data-mk-ui]').forEach(x => x.remove());
    box.querySelectorAll('img[data-mk-src]').forEach(img => { img.setAttribute('src', img.getAttribute('data-mk-src')); img.removeAttribute('data-mk-src'); });
    box.querySelectorAll('.mk-sel').forEach(x => x.classList.remove('mk-sel'));
    // HTML comments survive as raw comments
    const tw = document.createTreeWalker(box, NodeFilter.SHOW_COMMENT); const cms = [];
    while (tw.nextNode()) cms.push(tw.currentNode);
    for (const c of cms) {
      const v = `<!--${c.data}-->`;
      const parent = c.parentNode;
      if (parent === box || /^(BLOCKQUOTE|LI|SECTION|ARTICLE)$/.test(parent.nodeName) && ![...parent.childNodes].some(n => n !== c && n.nodeType === 3 && n.data.trim() && n.previousSibling === c)) {
        const p = document.createElement('p'); p.textContent = T(v); parent.replaceChild(p, c);
      } else parent.replaceChild(document.createTextNode(T(v)), c);
    }
    box.querySelectorAll('.mk-comment').forEach(el => {
      const raw = el.getAttribute('data-raw');
      const v = raw ? raw : `<!-- comment: ${el.getAttribute('data-text') || el.textContent || ''} -->`;
      inlineTok(el, v);
    });
    box.querySelectorAll('div.page-break').forEach(el => blockTok(el, '<div class="page-break"></div>'));
    // aligned blocks: <div align="center"> … </div> kept as raw HTML around Markdown
    for (const el of [...box.querySelectorAll('div[align], p[align], h1[align], h2[align], h3[align]')]) {
      if (!box.contains(el)) continue;
      const al = (el.getAttribute('align') || '').toLowerCase();
      if (!/^(center|right|justify|left)$/.test(al)) { el.removeAttribute('align'); continue; }
      let inner;
      if (el.tagName === 'DIV') inner = toMd([...el.childNodes], { inner: true }).trim();
      else { const c = el.cloneNode(true); c.removeAttribute('align'); inner = toMd([c]).trim(); }
      if (al === 'left') { blockTok(el, inner); continue; }
      blockTok(el, `<div align="${al}">\n\n${inner}\n\n</div>`);
    }
    // colored text / colored highlight → raw HTML spans
    for (const el of [...box.querySelectorAll('span[style], font[color], mark[style]')]) {
      if (!box.contains(el)) continue;
      let st = el.tagName === 'FONT' ? 'color:' + el.getAttribute('color') : styleColor(el.getAttribute('style'));
      if (el.tagName === 'MARK') {
        const bg = /background:([^;]+)/.exec(st); const inner = toMd([...el.childNodes], { inner: true }).trim();
        inlineTok(el, bg ? `<mark style="background:${bg[1]}">${inner}</mark>` : `==${inner}==`); continue;
      }
      if (!st) { el.replaceWith(...el.childNodes); continue; }
      const inner = toMd([...el.childNodes], { inner: true }).trim();
      inlineTok(el, `<span style="${st.replace(/"/g, "'")}">${inner}</span>`);
    }
    box.querySelectorAll('font').forEach(el => el.replaceWith(...el.childNodes));
    box.querySelectorAll('b, strong').forEach(el => { if (/font-weight\s*:\s*(normal|400)/i.test(el.getAttribute('style') || '')) el.replaceWith(...el.childNodes); });
    // bare spans from contenteditable go; spans with the author's own id / lang / dir stay as raw HTML (preload's rawInline rule)
    box.querySelectorAll('span:not([class]):not([style]):not([id]):not([lang]):not([dir])').forEach(el => { if (![...el.attributes].some(a => /^data-/.test(a.name) && !/^data-(line|done|mk)/.test(a.name))) el.replaceWith(...el.childNodes); });
    // lists nested directly in lists → move into the previous item
    box.querySelectorAll('ul > ul, ul > ol, ol > ul, ol > ol').forEach(l => {
      let prev = l.previousElementSibling;
      if (!prev || prev.tagName !== 'LI') { prev = document.createElement('li'); l.before(prev); }
      prev.appendChild(l);
    });
    // stray text directly inside lists
    box.querySelectorAll('ul, ol').forEach(l => [...l.childNodes].forEach(n => { if (n.nodeType === 3 && n.data.trim()) { const li = document.createElement('li'); n.replaceWith(li); li.appendChild(n); } }));
    // code blocks: keep line breaks typed in Word mode
    box.querySelectorAll('pre').forEach(pre => {
      if (pre.classList.contains('mermaid')) return;
      const lang = pre.getAttribute('data-lang') || (pre.querySelector('code[class*=language-]')?.className.match(/language-(\S+)/) || [])[1] || '';
      const text = preText(pre).replace(/\n$/, '');
      const np = document.createElement('pre'); if (lang) np.setAttribute('data-lang', lang); else np.className = 'hljs';
      const code = document.createElement('code'); code.textContent = text; np.appendChild(code); pre.replaceWith(np);
    });
    // tables: alignment attribute, single-line cells, escaped pipes
    box.querySelectorAll('td, th').forEach(c => {
      const al = (c.style && c.style.textAlign) || (/text-align\s*:\s*(\w+)/i.exec(c.getAttribute('style') || '') || [])[1];
      if (al && !c.getAttribute('align')) c.setAttribute('align', al);
      c.querySelectorAll('p, div').forEach(p => { if (p.nextSibling) p.after(document.createElement('br')); p.replaceWith(...p.childNodes); });
      [...c.querySelectorAll('br')].forEach((br, i, all) => { if (i === all.length - 1 && !br.nextSibling) br.remove(); else br.replaceWith(document.createTextNode(T('<br>'))); });
      const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT); const ts = []; while (w.nextNode()) ts.push(w.currentNode);
      ts.forEach(t => { if (t.data.includes('|') && !t.parentElement.closest('.mk-math,code')) t.data = t.data.replace(/\|/g, T('\\|')); });
    });
    box.querySelectorAll('table').forEach(t => {
      const r0 = t.rows[0]; if (!r0) { t.remove(); return; }
      if (r0.parentNode.nodeName !== 'THEAD' && ![...r0.cells].every(c => c.tagName === 'TH')) {
        [...r0.cells].forEach(c => { const th = document.createElement('th'); [...c.attributes].forEach(a => th.setAttribute(a.name, a.value)); th.append(...c.childNodes); c.replaceWith(th); });
      }
    });
    // plain <div>s from contenteditable → paragraphs
    [...box.querySelectorAll('div')].reverse().forEach(d => {
      if (d.attributes.length && !(d.attributes.length === 1 && d.hasAttribute('style'))) return;
      if (CONTAINERS.test(d.className) || d.hasAttribute('data-fence')) return;
      const hasBlock = [...d.children].some(c => BLOCKS.test(c.tagName));
      if (hasBlock) d.replaceWith(...d.childNodes);
      else { const p = document.createElement('p'); p.append(...d.childNodes); d.replaceWith(p); }
    });
    // trailing <br> placeholders and empty blocks
    box.querySelectorAll('br').forEach(br => {
      let n = br.nextSibling; while (n && n.nodeType === 3 && !n.data.trim()) n = n.nextSibling;
      if (!n && br.parentElement && /^(P|H[1-6]|LI|BLOCKQUOTE|DIV|TD|TH)$/.test(br.parentElement.tagName)) br.remove();
    });
    box.querySelectorAll('p, h1, h2, h3, h4, h5, h6').forEach(p => { if (!p.textContent.replace(/[\u200b\s]/g, '') && !p.querySelector('img,.mk-math,.mk-cite,input,svg')) p.remove(); });
    const zw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); const zt = []; while (zw.nextNode()) zt.push(zw.currentNode);
    zt.forEach(t => { if (t.data.includes('\u200b')) t.data = t.data.replace(/\u200b/g, ''); });
    box.querySelectorAll('[contenteditable]').forEach(x => x.removeAttribute('contenteditable'));
  }
  function postfix(md) {
    let inFence = null;
    const out = md.split('\n').map(line => {
      const f = /^\s*(`{3,}|~{3,})/.exec(line);
      if (inFence) { if (f && f[1][0] === inFence[0] && f[1].length >= inFence.length) inFence = null; return line; }
      if (f) { inFence = f[1]; return line; }
      line = line.replace(/^(\s*)([-*+])[ \t]{2,}(?=\S)/, '$1$2 ').replace(/^(\s*)(\d+[.)])[ \t]{2,}(?=\S)/, '$1$2 ');
      line = line.replace(/^(\s*(?:[-*+]|\d+[.)]) \[[ xX]\]) {2,}/, '$1 ');
      line = line.replace(/\u00a0/g, ' ');
      // typed footnote refs, citations and wikilinks should stay live Markdown
      line = line.replace(/\\\[\\\[([^\]\n]+?)\\\]\\\]/g, (m, x) => '[[' + x.replace(/\\([_*])/g, '$1') + ']]');
      line = line.replace(/\\\[\^([^\]\s\\]+(?:\\_[^\]\s\\]*)*)\\\]/g, (m, x) => '[^' + x.replace(/\\_/g, '_') + ']');
      // Pandoc citations, also with a prefix or per-key locators: [see @a, p. 4; @b, chap. 2]
      line = line.replace(/\\\[((?:[^\]\n]*?[\s;(])?-?@\w[^\]\n]*?)\\\]/g, (m, x) => '[' + x.replace(/\\([_*\-])/g, '$1') + ']');
      return line;
    });
    return out.join('\n');
  }
  // input: HTML string, Element (converted with its tag) or Node[] (converted as siblings)
  function toMd(input, opts = {}) {
    const box = document.createElement('div');
    if (typeof input === 'string') box.innerHTML = input;
    else if (Array.isArray(input) || input instanceof NodeList) [...input].forEach(n => box.appendChild(n.cloneNode(true)));
    else if (input) box.appendChild(input.cloneNode(true));
    const tok = [];
    normalize(box, tok);
    let md = '';
    try { md = mk.toMarkdown ? mk.toMarkdown(box.innerHTML, { inlineMath: opts.inlineMath || app.settings.get('inlineMath', 'd') }) : box.textContent; }
    catch (e) { console.error('toMarkdown failed', e); md = box.textContent; }
    md = postfix(md);
    for (let pass = 0; pass < 4 && /MKTOK\d+X/.test(md); pass++) md = md.replace(/MKTOK(\d+)X/g, (_, i) => tok[+i] ?? '');
    return md;
  }
  E.toMarkdown = toMd;

  // ------------------------------------------------------------------ paste sanitizer (Word / Google Docs / web pages)
  const KEEP = { p: 'p', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6', b: 'strong', strong: 'strong', i: 'em', em: 'em', u: 'u', ins: 'u', s: 's', strike: 's', del: 's', sub: 'sub', sup: 'sup', mark: 'mark', code: 'code', kbd: 'kbd', pre: 'pre', blockquote: 'blockquote', ul: 'ul', ol: 'ol', li: 'li', table: 'table', thead: 'thead', tbody: 'tbody', tr: 'tr', th: 'th', td: 'td', a: 'a', img: 'img', hr: 'hr', br: 'br' };
  const DROP = new Set(['script', 'style', 'meta', 'link', 'title', 'head', 'xml', 'o:p', 'button', 'select', 'textarea', 'iframe', 'object', 'embed', 'noscript', 'template', 'colgroup', 'col', 'svg', 'canvas', 'video', 'audio', 'form']);
  const BLOCKISH = new Set(['div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav', 'figure', 'figcaption', 'address', 'dd', 'dt', 'center']);
  E.sanitizePaste = (html) => {
    html = String(html || '').replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '').replace(/<!--(StartFragment|EndFragment)-->/g, '');
    const src = new DOMParser().parseFromString(html, 'text/html').body;
    const out = document.createElement('div');
    function walk(node, parent, inPre) {
      for (const n of [...node.childNodes]) {
        if (n.nodeType === 3) { parent.appendChild(document.createTextNode(inPre ? n.data : n.data.replace(/[\r\n\t]+/g, ' '))); continue; }
        if (n.nodeType !== 1) continue;
        const tag = n.tagName.toLowerCase();
        if (DROP.has(tag) || /mso-list\s*:\s*ignore/i.test(n.getAttribute('style') || '')) continue;
        if (n.classList.contains('mk-math') || n.classList.contains('mk-cite') || (tag === 'pre' && n.classList.contains('mermaid')) || n.classList.contains('mk-math-block') || n.classList.contains('page-break')) {
          parent.appendChild(n.cloneNode(true)); continue;
        }
        if (n.classList.contains('katex') || n.classList.contains('katex-display')) { const a = n.querySelector('annotation'); if (a) parent.appendChild(document.createTextNode('$' + a.textContent + '$')); continue; }
        const st = n.getAttribute('style') || '';
        let el = null;
        if (tag === 'input') { if (n.type === 'checkbox') { el = document.createElement('input'); el.type = 'checkbox'; if (n.checked || n.hasAttribute('checked')) el.setAttribute('checked', ''); parent.appendChild(el); } continue; }
        if (/^p$/.test(tag) && /MsoListParagraph/i.test(n.className)) {
          let ul = parent.lastElementChild; if (!ul || ul.tagName !== 'UL' || !ul.hasAttribute('data-mso')) { ul = document.createElement('ul'); ul.setAttribute('data-mso', '1'); parent.appendChild(ul); }
          el = document.createElement('li'); ul.appendChild(el); walk(n, el, inPre); continue;
        }
        if (tag === 'b' && /font-weight\s*:\s*(normal|400)/i.test(st)) { walk(n, parent, inPre); continue; }
        if (KEEP[tag]) {
          el = document.createElement(KEEP[tag]);
          if (tag === 'a') { const h = n.getAttribute('href'); if (h && !/^\s*javascript:/i.test(h)) el.setAttribute('href', h); if (n.title) el.title = n.title; }
          if (tag === 'img') { const s = n.getAttribute('src'); if (!s) continue; el.setAttribute('src', s); el.setAttribute('alt', n.getAttribute('alt') || ''); }
          if (tag === 'ol' && n.getAttribute('start')) el.setAttribute('start', n.getAttribute('start'));
          if ((tag === 'td' || tag === 'th')) { const al = n.getAttribute('align') || (/text-align\s*:\s*(left|center|right)/i.exec(st) || [])[1]; if (al) el.setAttribute('align', al.toLowerCase()); }
        } else if (BLOCKISH.has(tag)) {
          const hasBlock = [...n.children].some(c => BLOCKS.test(c.tagName) || BLOCKISH.has(c.tagName.toLowerCase()));
          if (!hasBlock && n.textContent.trim()) el = document.createElement('p');
        } else if (tag === 'span' || tag === 'font') {
          const c = tag === 'font' ? n.getAttribute('color') : (/(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(st) || [])[1];
          if (c && !/^(#000000|#000|black|windowtext|rgb\(0,\s*0,\s*0\)|inherit|initial|auto)$/i.test(c.trim())) { el = document.createElement('span'); el.style.color = c.trim(); }
        }
        // inline styles from Word / Google Docs → semantic tags
        let target = el || null; const wraps = [];
        if (!/^(b|strong|h[1-6]|th)$/.test(tag) && /font-weight\s*:\s*(bold|[6-9]00)/i.test(st)) wraps.push('strong');
        if (!/^(i|em)$/.test(tag) && /font-style\s*:\s*italic/i.test(st)) wraps.push('em');
        if (tag !== 'u' && /text-decoration[^;]*underline/i.test(st) && tag !== 'a') wraps.push('u');
        if (/text-decoration[^;]*line-through/i.test(st)) wraps.push('s');
        if (/vertical-align\s*:\s*super/i.test(st)) wraps.push('sup'); else if (/vertical-align\s*:\s*sub/i.test(st)) wraps.push('sub');
        let host = parent;
        if (el) { parent.appendChild(el); host = el; }
        for (const w of wraps) { const x = document.createElement(w); host.appendChild(x); host = x; }
        if (tag === 'br' || tag === 'hr' || tag === 'img') continue;
        walk(n, host, inPre || tag === 'pre');
        void target;
      }
    }
    walk(src, out, false);
    // tidy: empty inline wrappers, header rows for tables
    out.querySelectorAll('strong,em,u,s,sub,sup,span,a:not([href])').forEach(x => { if (!x.textContent && !x.querySelector('img,.mk-math')) x.remove(); });
    out.querySelectorAll('a:not([href])').forEach(a => a.replaceWith(...a.childNodes));
    out.querySelectorAll('table').forEach(t => {
      const r0 = t.rows[0]; if (!r0) return t.remove();
      if (r0.parentNode.tagName !== 'THEAD') {
        const thead = document.createElement('thead'); t.insertBefore(thead, t.firstChild); thead.appendChild(r0);
        [...r0.cells].forEach(c => { if (c.tagName === 'TD') { const th = document.createElement('th'); if (c.getAttribute('align')) th.setAttribute('align', c.getAttribute('align')); th.append(...c.childNodes); c.replaceWith(th); } });
      }
    });
    out.querySelectorAll('[data-mso]').forEach(x => x.removeAttribute('data-mso'));
    return out.innerHTML;
  };
  E.looksLikeMarkdown = (t) => /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|```|\|.*\|\s*\n\s*\|?\s*:?-{3})|\*\*[^*\n]+\*\*|(^|[^\w])_[^_\n]+_([^\w]|$)|\[[^\]\n]+\]\([^)\n]+\)|\$[^$\s][^$\n]*\$|\\\(|\$\$|\[@[\w:.-]+|\[\^\w+\]/.test(t);

  // ------------------------------------------------------------------ Word editor factory
  function createWordEditor() {
    let host = null, root = null, sheet = null, page = null, marks = null, floatBar = null, doc = null, mounted = false;
    let offs = [], fm = { raw: '', body: '' }, segs = [], fnOrig = null, dirty = new Set(), allDirty = false, observer = null;
    let commitTimer = null, renderSeq = 0, decorating = false, inputDuringDecorate = false, lastText = null, pageCount = 1;
    let undoStack = [], redoStack = [], caretBefore = null, savedRange = null, painter = null, layoutRaf = 0;
    let pendingCaret = null, eol = '\n';
    let renderedText = null, ctxCell = null; // tables: the text the page was drawn from; the cell right-clicked last

    // ---------- DOM ----------
    function build() {
      root = document.createElement('div'); root.className = 'mk-word';
      sheet = document.createElement('div'); sheet.className = 'mk-sheet';
      page = document.createElement('article'); page.className = 'mk-page'; page.contentEditable = 'true'; page.spellcheck = true;
      page.setAttribute('role', 'textbox'); page.setAttribute('aria-multiline', 'true'); page.setAttribute('aria-label', 'Document');
      marks = document.createElement('div'); marks.className = 'mk-pmarks'; marks.setAttribute('aria-hidden', 'true');
      sheet.append(page, marks); root.appendChild(sheet);
      page.addEventListener('keydown', onKeyDown);
      page.addEventListener('beforeinput', onBeforeInput);
      page.addEventListener('input', onInput);
      page.addEventListener('paste', onPaste);
      page.addEventListener('drop', onDrop);
      page.addEventListener('dragover', e => { if ([...(e.dataTransfer?.items || [])].some(i => i.kind === 'file')) e.preventDefault(); });
      page.addEventListener('click', onClick);
      page.addEventListener('dblclick', onDblClick);
      page.addEventListener('contextmenu', onContextMenu);
      page.addEventListener('focus', () => { try { document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand('styleWithCSS', false, false); } catch {} });
      page.addEventListener('blur', () => { flush(); setTimeout(() => { if (!floatBar?.matches(':hover')) hideFloat(); }, 150); });
      page.addEventListener('mouseup', () => { if (painter) applyPainter(); });
      page.addEventListener('mousedown', e => { if (e.button === 0) clearTsel(); });
      const onSelChange = () => onSelectionChange();
      document.addEventListener('selectionchange', onSelChange); offs.push(() => document.removeEventListener('selectionchange', onSelChange));
      const onCtrl = e => root?.classList.toggle('ctrl', !!(e.ctrlKey || e.metaKey));
      window.addEventListener('keydown', onCtrl, true); window.addEventListener('keyup', onCtrl, true);
      offs.push(() => { window.removeEventListener('keydown', onCtrl, true); window.removeEventListener('keyup', onCtrl, true); });
      const onScroll = () => { if (floatBar?.classList.contains('show')) positionFloat(); };
      window.addEventListener('scroll', onScroll, true); offs.push(() => window.removeEventListener('scroll', onScroll, true));
      const onResize = () => scheduleLayout(); window.addEventListener('resize', onResize); offs.push(() => window.removeEventListener('resize', onResize));
      observer = new MutationObserver(onMutations);
    }

    // ---------- rendering ----------
    function prepare(el) {
      el.querySelectorAll('.mk-math, .mk-cite, pre.mermaid, .mk-front, .mk-bibliography, .page-break, sup.footnote-ref, .mk-comment, .footnote-backref').forEach(x => x.setAttribute('contenteditable', 'false'));
      el.querySelectorAll('input[type=checkbox]').forEach(i => { i.removeAttribute('disabled'); if (i.checked) i.setAttribute('checked', ''); });
      E.fixImages?.(el, doc);
    }
    function ensureEditableEdges() {
      const last = page.lastElementChild;
      const needTail = !last || last.getAttribute('contenteditable') === 'false' || /^(TABLE|PRE|HR|DIV|SECTION|HEADER|UL|OL|BLOCKQUOTE)$/.test(last.tagName);
      if (needTail) { const p = document.createElement('p'); p.innerHTML = '<br>'; page.appendChild(p); }
      const first = [...page.children].find(c => !c.classList.contains('mk-front'));
      if (first && (first.getAttribute('contenteditable') === 'false' || /^(TABLE|HR)$/.test(first.tagName)) && first.previousElementSibling?.classList?.contains('mk-front') !== false) {
        if (!first.previousElementSibling || first.previousElementSibling.classList.contains('mk-front')) { /* keep: caret can go after via the tail */ }
      }
    }
    async function renderDoc(opts = {}) {
      if (!doc || !page) return;
      const seq = ++renderSeq;
      const text = doc.text || '';
      // segments work on LF text; serialize() puts the file's own line endings back (CRLF files stay CRLF)
      eol = /\r\n/.test(text) ? '\r\n' : '\n';
      const sp0 = E.splitFrontMatter(text);
      const split = { ...sp0, raw: String(sp0.raw || '').replace(/\r\n/g, '\n'), body: String(sp0.body || '').replace(/\r\n/g, '\n') };
      let r;
      try { r = await app.render(text, { doc }); } catch (e) { console.error(e); r = { html: '<p>' + esc(text) + '</p>' }; }
      if (seq !== renderSeq || !mounted) return;
      const keepScroll = scroller()?.scrollTop;
      observer.disconnect();
      page.innerHTML = r.html;
      prepare(page);
      ensureEditableEdges();
      fm = split; lastText = text; renderedText = text; ctxCell = null;
      // the preRender hooks might have changed lines; then keep nothing verbatim
      let hooksChange = false;
      try { let t = text; for (const fn of (app.hooks?._pre || [])) t = (await fn(t, doc)) ?? t; hooksChange = t !== text; } catch { hooksChange = true; }
      buildSegments(split.body, hooksChange);
      dirty.clear(); allDirty = hooksChange;
      decorating = true; inputDuringDecorate = false;
      observer.observe(page, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['href', 'src', 'align', 'style', 'checked', 'data-tex', 'data-src', 'data-keys', 'data-locator', 'start'] });
      try { await app.decorate(page, doc); } catch (e) { console.error(e); }
      decorating = false;
      if (inputDuringDecorate) allDirty = true;
      if (seq !== renderSeq) return;
      applyLayout();
      if (opts.caret != null) setCaretOffset(opts.caret);
      else if (keepScroll != null && opts.keepScroll !== false) scroller().scrollTop = keepScroll;
      if (opts.table) focusTableTarget(opts.table);
      scheduleLayout();
      app.events.emit('word:rendered', { doc, page });
    }
    function scroller() { let n = host; while (n && n !== document.body) { const s = getComputedStyle(n); if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight) return n; n = n.parentElement; } return host || document.scrollingElement; }

    // ---------- segments: map top-level blocks to their source lines ----------
    const isSpecial = n => n.nodeType === 1 && (n.classList.contains('mk-front') || n.classList.contains('mk-bibliography') || (n.tagName === 'SECTION' && n.classList.contains('footnotes')) || (n.tagName === 'HR' && n.classList.contains('footnotes-sep')));
    const topNodes = () => [...page.childNodes].filter(n => n.nodeType === 1 || n.nodeType === 8 || (n.nodeType === 3 && n.data.trim()));
    function buildSegments(body, disable) {
      segs = []; fnOrig = page.querySelector(':scope > section.footnotes');
      const lines = body.split('\n');
      if (disable) return;
      let cur = { start: 0, els: [] };
      for (const n of topNodes()) {
        if (isSpecial(n)) continue;
        const dl = n.nodeType === 1 ? n.getAttribute('data-line') : null;
        const ln = dl == null ? NaN : +dl;
        if (!isNaN(ln) && ln > cur.start && cur.els.length) { segs.push(cur); cur = { start: ln, els: [] }; }
        cur.els.push(n);
      }
      if (cur.els.length) segs.push(cur);
      segs.forEach((s, i) => {
        s.end = i + 1 < segs.length ? segs[i + 1].start : lines.length;
        if (i === 0) s.start = 0;
        const ls = lines.slice(s.start, s.end);
        s.text = ls.join('\n') + (s.end < lines.length ? '\n' : '');
        // definition lines that render elsewhere (footnotes) or nowhere (link references, abbreviations)
        const fn = [], refs = [], keep = [];
        for (let k = 0; k < ls.length; k++) {
          const l = ls[k];
          if (/^\[\^[^\]]+\]:/.test(l)) {
            const block = [l]; while (k + 1 < ls.length && (/^( {2,}|\t)\S/.test(ls[k + 1]) || (!ls[k + 1].trim() && /^( {4}|\t)\S/.test(ls[k + 2] || '')))) block.push(ls[++k]);
            fn.push(block.join('\n')); keep.push(null); continue;
          }
          if (/^ {0,3}\[[^\]^][^\]]*\]:\s*\S/.test(l) || /^\*\[[^\]]+\]:/.test(l)) refs.push(l);
          keep.push(l);
        }
        s.fnDefs = fn; s.refDefs = refs;
        s.textNoFn = fn.length ? keep.filter(x => x !== null).join('\n').replace(/\n{3,}/g, '\n\n') + (s.end < lines.length ? '\n' : '') : s.text;
        s.els.forEach(n => { n.__mkSeg = s; });
      });
    }
    function topOf(n) { while (n && n.parentNode !== page) n = n.parentNode; return n; }
    // Enter copies the paragraph's attributes into the new one, data-line too: a block typed just now has no source line yet
    function dropCopiedLine(n) {
      if (!n || n.nodeType !== 1 || !n.hasAttribute('data-line')) return;
      const v = n.getAttribute('data-line');
      if (page.querySelectorAll(`[data-line="${CSS.escape(v)}"]`).length > 1) n.removeAttribute('data-line'); // the added node is the copy
    }
    function onMutations(recs) {
      if (decorating) return;
      for (const r of recs) {
        r.addedNodes.forEach(dropCopiedLine);
        if (r.target === page) { r.addedNodes.forEach(n => dirty.add(n)); continue; }
        const t = r.target.nodeType === 1 ? r.target : r.target.parentElement;
        const atom = t && t.closest && t.closest('[contenteditable="false"]');
        if (atom && atom !== page && page.contains(atom) && r.type !== 'attributes') continue; // decorations inside atoms
        const top = topOf(r.target); if (top) dirty.add(top);
      }
    }
    function markDirty(n) { const t = topOf(n); if (t) dirty.add(t); else allDirty = true; }

    function serialize() {
      const nodes = topNodes();
      const fnSec = page.querySelector(':scope > section.footnotes');
      const fnChanged = allDirty || (fnOrig ? (!fnSec || fnSec !== fnOrig || dirty.has(fnSec)) : !!fnSec);
      const body = fm.body;
      const pieces = []; let run = [];
      const flushRun = () => {
        if (!run.length) return;
        const used = []; run.forEach(n => { if (n.__mkSeg && !used.includes(n.__mkSeg)) used.push(n.__mkSeg); });
        const md = toMd(run).trim();
        const defs = [];
        used.forEach(s => { defs.push(...s.refDefs); if (!fnChanged) defs.push(...s.fnDefs); });
        if (md || defs.length) pieces.push({ md, defs });
        run = [];
      };
      for (let i = 0; i < nodes.length;) {
        const n = nodes[i];
        if (isSpecial(n)) { i++; continue; }
        const s = !allDirty && n.__mkSeg;
        if (s && s.els[0] === n && s.els.every((e, k) => nodes[i + k] === e && !dirty.has(e))) { flushRun(); pieces.push({ seg: s }); i += s.els.length; continue; }
        run.push(n); i++;
      }
      flushRun();
      let out = '';
      const brk = () => { if (!out) return; if (!out.endsWith('\n')) out += '\n\n'; else if (!out.endsWith('\n\n')) out += '\n'; };
      let prevMd = false;
      for (const p of pieces) {
        if (p.seg) { if (prevMd) brk(); out += fnChanged ? p.seg.textNoFn : p.seg.text; prevMd = false; }
        else { brk(); out += (p.md ? p.md + '\n' : '') + (p.defs.length ? (p.md ? '\n' : '') + p.defs.join('\n') + '\n' : ''); prevMd = true; }
      }
      if (fnChanged && fnSec) { const f = toMd([fnSec]).trim(); if (f) { brk(); out += f + '\n'; prevMd = true; } }
      // leading blank lines between front matter and the first block
      if (prevMd || pieces.some(p => !p.seg)) {
        const lead = /^\s*/.exec(body)[0];
        if (pieces.length && !pieces[0].seg && lead) out = lead.replace(/[^\n]/g, '') + out;
        if (prevMd && !/\n$/.test(body) && body) out = out.replace(/\n+$/, '');
      }
      const res = fm.raw + out;
      return eol === '\r\n' ? res.replace(/\r?\n/g, '\r\n') : res;
    }

    // ---------- commit / undo ----------
    function scheduleCommit() { clearTimeout(commitTimer); commitTimer = setTimeout(commit, 350); scheduleLayout(); }
    function commit() {
      clearTimeout(commitTimer); commitTimer = null;
      if (!doc || !mounted || !page || doc.readOnly) return;
      const text = serialize();
      if (text === doc.text) { caretBefore = null; return; }
      undoStack.push({ text: doc.text, caret: caretBefore ?? caretOffset() }); if (undoStack.length > 300) undoStack.shift();
      redoStack = []; caretBefore = null;
      lastText = text;
      doc.setText(text, 'word');
    }
    function flush() { if (commitTimer) commit(); }
    function applyText(text, caret) {
      pendingCaret = caret;
      doc.setText(text, 'word-undo');
    }

    // ---------- caret helpers ----------
    function caretOffset() {
      const s = getSelection(); if (!s.rangeCount || !page.contains(s.anchorNode)) return null;
      const r = document.createRange(); r.setStart(page, 0);
      try { r.setEnd(s.focusNode, s.focusOffset); } catch { return null; }
      return r.toString().length;
    }
    function setCaretOffset(n) {
      if (n == null) return;
      const w = document.createTreeWalker(page, NodeFilter.SHOW_TEXT); let left = n, t;
      while ((t = w.nextNode())) {
        if (t.parentElement.closest('[contenteditable="false"]')) { left -= t.data.length; if (left < 0) left = 0; continue; }
        if (left <= t.data.length) { const r = document.createRange(); r.setStart(t, left); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); scrollCaretIntoView(); return; }
        left -= t.data.length;
      }
      placeCaretAtEnd();
    }
    function placeCaretAtEnd() { const r = document.createRange(); const last = page.lastElementChild || page; r.selectNodeContents(last); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    function scrollCaretIntoView() {
      const s = getSelection(); if (!s.rangeCount) return;
      const rect = s.getRangeAt(0).getBoundingClientRect(); const sc = scroller(); if (!sc || !rect.height) return;
      const sr = sc.getBoundingClientRect();
      if (rect.top < sr.top + 20 || rect.bottom > sr.bottom - 20) sc.scrollTop += rect.top - sr.top - sr.height / 3;
    }
    function range() { const s = getSelection(); if (s.rangeCount && page && page.contains(s.anchorNode)) return s.getRangeAt(0); return null; }
    function restoreRange() {
      if (range()) return range();
      page.focus({ preventScroll: true });
      if (savedRange && page.contains(savedRange.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); return savedRange; }
      placeCaretAtEnd(); return range();
    }
    function blockOf(n) { n = n && (n.nodeType === 1 ? n : n.parentElement); return n && n.closest && page.contains(n) ? n.closest('p,h1,h2,h3,h4,h5,h6,li,pre,blockquote,td,th,div,dd,dt') : null; }
    function selectNode(n) { const r = document.createRange(); r.selectNode(n); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    function caretAfter(n) { const r = document.createRange(); r.setStartAfter(n); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }

    // ---------- events ----------
    function onBeforeInput(e) {
      if (e.inputType === 'historyUndo') { e.preventDefault(); adapter.undo(); return; }
      if (e.inputType === 'historyRedo') { e.preventDefault(); adapter.redo(); return; }
      if (caretBefore == null) caretBefore = caretOffset();
      if (doc?.readOnly) e.preventDefault();
    }
    function onInput(e) {
      if (decorating) inputDuringDecorate = true;
      const r = range(); if (r) markDirty(r.startContainer);
      if (e.inputType === 'insertText' && (e.data === ' ' || e.data === '\u00a0')) autoMath();
      if (!page.firstChild) { page.innerHTML = '<p><br></p>'; placeCaretAtEnd(); }
      scheduleCommit();
      try { app.typing?.runInput?.({ mode: 'word', adapter, element: page, inputType: e.inputType, data: e.data }); } catch (err) { console.warn(err); }
    }
    function onKeyDown(e) {
      if (e.isComposing || e.keyCode === 229) return;
      // typing hooks first (autocomplete ghost text takes Tab / \u2192 when it shows)
      if (app.typing?.runKey?.(e, { mode: 'word', adapter, element: page, inTable: !!closestIn('td,th') })) return;
      // a selected row / column / table (Table Layout \u2192 Select): Delete clears the cells, any other key drops the marks
      const tsel = page.querySelectorAll('.mk-tsel');
      if (tsel.length && !/^(Shift|Control|Alt|Meta)$/.test(e.key)) {
        if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.altKey && !e.metaKey && tsel.length > 1) {
          e.preventDefault(); tsel.forEach(c => { c.innerHTML = '<br>'; markDirty(c); }); clearTsel(); placeIn(tsel[0], false); commit(); return;
        }
        if (!(e.ctrlKey && /^[cC]$/.test(e.key))) clearTsel();
      }
      const name = E.keyName(e);
      if (e.ctrlKey || e.metaKey || e.altKey) flush();
      if (name === 'Ctrl+Z') { e.preventDefault(); e.stopPropagation(); adapter.undo(); return; }
      if (name === 'Ctrl+Y' || name === 'Ctrl+Shift+Z') { e.preventDefault(); e.stopPropagation(); adapter.redo(); return; }
      if (name === 'Ctrl+S' || name === 'Ctrl+Shift+S') flush();
      if (E.dispatchShortcut(e)) return;
      const sel = page.querySelector('.mk-sel');
      if (sel && (e.key === 'Backspace' || e.key === 'Delete')) { e.preventDefault(); const p = sel.previousSibling; const par = sel.parentNode; sel.remove(); markDirty(par); if (p) caretAfter(p); scheduleCommit(); return; }
      if (sel && e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); openAtom(sel); return; }
      if (sel && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) { e.preventDefault(); clearAtomSel(); caretAfter(sel); return; }
      if (sel && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) { e.preventDefault(); clearAtomSel(); const r = document.createRange(); r.setStartBefore(sel); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; }
      if (e.key === 'Escape') { hideFloat(); if (painter) { painter = null; root.style.cursor = ''; app.ui.toast?.('Format painter off'); } return; }
      const r = range(); if (!r) return;
      const el = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
      // ---- tables: the caret stays in its cell; Enter (and Shift+Enter) start a new line in the cell, like Word;
      // arrows cross cell edges (Left/Right follow the cell's direction, so they are mirrored in right-to-left tables)
      const tcell = el.closest('td,th');
      if (tcell && page.contains(tcell) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.execCommand('insertLineBreak'); markDirty(tcell); scheduleCommit(); // <br> round-trips inside a cell
          return;
        }
        if (!e.shiftKey && r.collapsed) {
          const oneLine = !tcell.querySelector('br:not(:last-child)');
          const rtl = getComputedStyle(tcell).direction === 'rtl';
          const fwdKey = rtl ? 'ArrowLeft' : 'ArrowRight', backKey = rtl ? 'ArrowRight' : 'ArrowLeft';
          if (e.key === fwdKey && atEnd(tcell, r) && moveCell(tcell, 'next')) { e.preventDefault(); return; }
          if (e.key === backKey && atStart(tcell, r) && moveCell(tcell, 'prev')) { e.preventDefault(); return; }
          if (e.key === 'ArrowDown' && oneLine && moveCell(tcell, 'down', true)) { e.preventDefault(); return; }
          if (e.key === 'ArrowUp' && oneLine && moveCell(tcell, 'up', true)) { e.preventDefault(); return; }
        }
        if (e.key === 'Backspace' && r.collapsed && atStart(tcell, r)) { e.preventDefault(); return; } // never merge cells
        if (e.key === 'Delete' && r.collapsed && atEnd(tcell, r)) { e.preventDefault(); return; }
      }
      if (e.key === 'Backspace' && r.collapsed && !e.ctrlKey && !tcell) {
        // Backspace at the start of the paragraph after a table goes into the last cell instead of pulling text in
        const blk = blockOf(el);
        if (blk && blk.parentNode === page && blk.previousElementSibling?.tagName === 'TABLE' && atStart(blk, r)) {
          e.preventDefault(); const t = blk.previousElementSibling; const cs = t.querySelectorAll('th,td'); placeIn(cs[cs.length - 1], true); return;
        }
      }
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
        const cell = el.closest('td,th');
        if (cell && page.contains(cell)) { e.preventDefault(); return tabCell(cell, e.shiftKey); }
        if (el.closest('li')) { e.preventDefault(); document.execCommand(e.shiftKey ? 'outdent' : 'indent'); markDirty(el); scheduleCommit(); return; }
        if (el.closest('pre')) { e.preventDefault(); document.execCommand('insertText', false, '    '); return; }
        e.preventDefault(); return; // Markdown has no tab stops
      }
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        const pre = el.closest('pre');
        if (pre && !pre.classList.contains('mermaid')) { e.preventDefault(); document.execCommand('insertText', false, '\n'); return; }
        const li = el.closest('li');
        if (li && !e.shiftKey && !li.textContent.replace(/[\u200b\s]/g, '') && !li.querySelector('img,.mk-math,ul,ol')) { e.preventDefault(); exitListItem(li); return; }
        if (li && !e.shiftKey && li.parentElement.classList.contains('contains-task-list')) {
          // new checklist items get their own checkbox
          setTimeout(() => {
            const rr = range(); const nli = rr && (rr.startContainer.nodeType === 1 ? rr.startContainer : rr.startContainer.parentElement).closest('li');
            if (!nli || nli === li || nli.querySelector(':scope > input[type=checkbox], :scope > label > input[type=checkbox]')) return;
            nli.classList.add('task-list-item'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'task-list-item-checkbox';
            const lab = nli.querySelector(':scope > label'); const holder = lab || nli; holder.insertBefore(document.createTextNode(' '), holder.firstChild); holder.insertBefore(cb, holder.firstChild);
            const r2 = document.createRange(); r2.setStart(holder, 2); r2.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r2);
            markDirty(nli); scheduleCommit();
          }, 0);
        }
        const bq = el.closest('blockquote'); const blk = blockOf(el);
        if (bq && blk && blk !== bq && !e.shiftKey && !blk.textContent.trim() && blk === bq.lastElementChild) {
          e.preventDefault(); const p = document.createElement('p'); p.innerHTML = '<br>'; bq.after(p); blk.remove(); const rr = document.createRange(); rr.setStart(p, 0); rr.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(rr); markDirty(bq); markDirty(p); scheduleCommit(); return;
        }
      }
      if (e.key === 'Backspace') {
        // Backspace at the start of a heading/quote turns it into a normal paragraph first (like Word)
        const blk = blockOf(el);
        if (blk && r.collapsed && /^H[1-6]$/.test(blk.tagName) && atStart(blk, r)) {
          e.preventDefault(); const off = caretOffset(); const n = retag(blk, 'p'); markDirty(n); setCaretOffset(off); scheduleCommit(); return;
        }
      }
    }
    function atStart(blk, r) { const t = document.createRange(); t.selectNodeContents(blk); t.setEnd(r.startContainer, r.startOffset); return !t.toString().replace(/\u200b/g, '').length; }
    function atEnd(blk, r) { const t = document.createRange(); t.selectNodeContents(blk); t.setStart(r.endContainer, r.endOffset); return !t.toString().replace(/[\u200b\n]/g, '').length; }

    function onClick(e) {
      const t = e.target;
      const a = t.closest('a[href]');
      if (a && (e.ctrlKey || e.metaKey)) { e.preventDefault(); followLink(a.getAttribute('href')); return; }
      if (t.matches('input[type=checkbox]')) {
        setTimeout(() => { if (t.checked) t.setAttribute('checked', ''); else t.removeAttribute('checked'); markDirty(t); scheduleCommit(); }, 0);
        return;
      }
      const atom = t.closest('.mk-math, .mk-cite, pre.mermaid, sup.footnote-ref');
      clearAtomSel();
      if (atom && page.contains(atom)) {
        if (atom.matches('sup.footnote-ref')) { e.preventDefault(); const id = atom.querySelector('a')?.getAttribute('href'); if (id) page.querySelector(id.replace(/:/g, '\\:'))?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        atom.classList.add('mk-sel'); selectNode(atom);
      }
      if (t.closest('.footnote-backref')) { e.preventDefault(); const id = t.closest('a').getAttribute('href'); page.querySelector(id.replace(/:/g, '\\:'))?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
    function clearAtomSel() { page?.querySelectorAll('.mk-sel').forEach(x => x.classList.remove('mk-sel')); }
    function onDblClick(e) {
      const atom = e.target.closest('.mk-math, .mk-cite, pre.mermaid');
      if (atom && page.contains(atom)) { e.preventDefault(); openAtom(atom); }
    }
    async function openAtom(atom) {
      if (atom.matches('.mk-math')) {
        // the visual equation editor (src/equation-editor.js); labels are `$$ … $$ {#eq:label}`, numbers come from app.xref
        const EQ = app.equationEditor;
        const display = atom.classList.contains('display');
        const oldLabel = EQ?.labelOf?.(atom) || '';
        const oldTex = atom.getAttribute('data-tex') || '';
        const oldUnnum = !!EQ?.unnumberedOf?.(atom);
        clearAtomSel();
        const res = await (EQ?.open?.({ tex: oldTex, display, delim: atom.getAttribute('data-delim'), label: oldLabel, unnumbered: oldUnnum, numberText: EQ.numberTextOf?.(atom), editing: true })
          ?? app.ui.prompt('Edit equation', 'LaTeX', oldTex).then(v => v == null ? null : { tex: v, display, label: oldLabel, unnumbered: oldUnnum }));
        if (!res || !page || !page.contains(atom)) return;
        const newLabel = res.display ? (res.label || '') : '';
        // \label{} or an old numeric \tag{} inside the TeX moves to the {#eq:…} syntax, so that edit also goes through Markdown
        const migrated = /\\label\s*\{|\\tag\s*\{\s*\d/.test(oldTex) && !/\\label\s*\{|\\tag\s*\{\s*\d/.test(res.tex);
        if (!!res.display !== display || newLabel !== oldLabel || !!res.unnumbered !== oldUnnum || migrated) {
          // placement or label changed: replace the whole equation through Markdown so the label syntax is exact
          const holder = atom.closest('.mk-math-block') || atom;
          selectNode(holder); getSelection().getRangeAt(0).deleteContents();
          const md = EQ?.markdown ? EQ.markdown({ ...res, label: newLabel })
            : res.display ? `$$\n${res.tex}\n$$` + (newLabel ? ` {#${newLabel}}` : '') : (app.settings.get('inlineMath', 'd') === 'paren' ? `\\(${res.tex}\\)` : `$${res.tex}$`);
          await adapter.insert(res.display ? `\n\n${md}\n\n` : md);
          try { await app.xref?.refresh?.(); } catch {}
          return;
        }
        if (res.tex === oldTex) return;
        const eqno = atom.querySelector(':scope > .mk-eqno'); // the number app.xref paints into the atom
        atom.setAttribute('data-tex', res.tex);
        atom.innerHTML = renderTex(res.tex, display);
        if (eqno) atom.appendChild(eqno);
        markDirty(atom); commit();
      } else if (atom.matches('pre.mermaid')) {
        const src = atom.getAttribute('data-src') || atom.textContent;
        const v = await (app.editor.sourceDialog?.({ title: 'Edit diagram', label: 'Mermaid source', value: src, lang: 'mermaid' }) ?? app.ui.prompt('Edit diagram', 'Mermaid source', src));
        if (v == null || v === src) return;
        atom.setAttribute('data-src', v); atom.removeAttribute('data-done'); atom.textContent = v;
        markDirty(atom);
        decorating = true; try { await app.decorate(atom.parentElement || page, doc); } finally { decorating = false; }
        commit();
      } else if (atom.matches('.mk-cite')) {
        if (app.commands.get('ref.editCitation')) return app.commands.run('ref.editCitation', { element: atom });
        const keys = (atom.getAttribute('data-keys') || '').split(';').filter(Boolean).map(k => '@' + k).join('; ');
        const v = await app.ui.prompt('Edit citation', 'Citation keys, for example @smith2020; @lee2019', keys + (atom.getAttribute('data-locator') ? ', ' + atom.getAttribute('data-locator') : ''));
        if (v == null) return;
        if (!v.trim()) { atom.remove(); markDirty(page.firstChild); allDirty = true; commit(); return; }
        selectNode(atom); getSelection().getRangeAt(0).deleteContents();
        await adapter.insert('[' + v.trim().replace(/^\[|\]$/g, '') + ']');
      }
    }
    function renderTex(tex, display) {
      const macros = app.developer?.mathMacros?.() || {};
      if (window.katex) { try { return window.katex.renderToString(tex, { displayMode: display, throwOnError: false, macros: { ...macros }, output: 'htmlAndMathml', strict: 'ignore' }); } catch {} }
      return display ? mk.displayMath(tex) : mk.inlineMath(tex);
    }
    function mathAtom(tex, display, delim) {
      const s = document.createElement('span'); s.className = 'mk-math' + (display ? ' display' : ''); s.setAttribute('contenteditable', 'false');
      s.setAttribute('data-tex', tex); s.setAttribute('data-delim', delim || (display ? 'dd' : app.settings.get('inlineMath', 'd')));
      s.innerHTML = renderTex(tex, display); return s;
    }
    function followLink(href) {
      if (!href) return;
      if (href.startsWith('#')) { page.querySelector(`[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (/^(https?:|mailto:)/i.test(href)) { mk.invoke?.('open-external', href)?.catch?.(() => {}); return; }
      if (doc?.path && !/^[a-z][\w+.-]*:/i.test(href)) {
        const dir = doc.path.replace(/[\\/][^\\/]*$/, ''); const p = dir + (doc.path.includes('\\') ? '\\' : '/') + decodeURIComponent(href.split('#')[0]).replace(/\//g, doc.path.includes('\\') ? '\\' : '/');
        app.docs.open(p).catch(err => (app.ui.fail ? app.ui.fail(err, { lead: `Check that the linked file “${href}” is next to this document, or fix the link.`, hideReason: true }) : app.ui.toast(`Check that the linked file “${href}” is next to this document, or fix the link.`, { kind: 'error' })));
      }
    }
    // '$…$ ' and '\(…\) ' turn into rendered math as you type
    function autoMath() {
      const s = getSelection(); if (!s.rangeCount) return;
      const node = s.anchorNode, off = s.anchorOffset;
      if (!node || node.nodeType !== 3 || node.parentElement.closest('code,pre,.mk-math,a')) return;
      const before = node.data.slice(0, off);
      const m = /(^|[^\\$\w])(\$([^\s$](?:[^$]*?[^\s$\\])?)\$|\\\((.+?)\\\))[\s\u00a0]$/.exec(before);
      if (!m) return;
      const tex = m[3] ?? m[4]; const delim = m[3] != null ? 'd' : 'paren';
      if (m[3] != null && /^\d+([.,]\d+)?$/.test(tex)) return; // "$5$" is probably money, keep as typed
      const start = off - m[2].length - 1;
      const after = node.splitText(start);
      after.data = after.data.slice(m[2].length + 1);
      const atom = mathAtom(tex, false, delim);
      node.after(atom);
      const sp = document.createTextNode('\u00a0'); atom.after(sp);
      const r = document.createRange(); r.setStart(sp, 1); r.collapse(true); s.removeAllRanges(); s.addRange(r);
      if (after.data === '') after.remove();
      markDirty(atom);
    }

    // ---------- tables ----------
    function tabCell(cell, back) {
      const table = cell.closest('table'); const cells = [...table.querySelectorAll('th,td')];
      let i = cells.indexOf(cell) + (back ? -1 : 1);
      if (i >= cells.length) { tableOp('rowBelow', cells[cells.length - 1]); const all = [...table.querySelectorAll('th,td')]; i = cells.length; return focusCell(all[i]); }
      if (i < 0) return;
      focusCell(cells[i]);
    }
    function focusCell(c) { if (!c) return; const r = document.createRange(); r.selectNodeContents(c); if (!c.textContent.trim()) r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    function placeIn(el, end) {
      if (!el) return;
      const r = document.createRange(); r.selectNodeContents(el);
      if (end) { const last = el.lastChild; if (last && last.nodeName === 'BR') r.setEndBefore(last); }
      r.collapse(!end); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    // move the caret to the next / previous cell, or the cell below / above; out of the table at its edges
    function moveCell(cell, dir, keepCol) {
      const tb = cell.closest('table'); if (!tb) return false;
      const rows = [...tb.rows], ri = cell.parentElement.rowIndex, ci = cell.cellIndex;
      const all = [...tb.querySelectorAll('th,td')], i = all.indexOf(cell);
      const at = (row) => row && row.cells[Math.min(ci, row.cells.length - 1)];
      let t = null;
      if (dir === 'next') t = all[i + 1]; else if (dir === 'prev') t = all[i - 1];
      else if (dir === 'down') t = at(rows[ri + 1]); else if (dir === 'up') t = at(rows[ri - 1]);
      if (t) { placeIn(t, dir === 'prev' || (keepCol && dir === 'up')); scrollCaretIntoView(); return true; }
      if (dir === 'down' || dir === 'next') {
        let nx = tb.nextElementSibling;
        if (!nx || nx.getAttribute('contenteditable') === 'false' || /^(TABLE|PRE|HR|UL|OL|SECTION)$/.test(nx.tagName)) {
          const p = document.createElement('p'); p.innerHTML = '<br>'; tb.after(p); markDirty(p); nx = p;
        }
        placeIn(nx, false); scrollCaretIntoView(); return true;
      }
      const pv = tb.previousElementSibling;
      if (pv && pv.getAttribute('contenteditable') !== 'false' && !/^(TABLE|HR)$/.test(pv.tagName)) { placeIn(pv, true); return true; }
      return false;
    }
    function clearTsel() { page?.querySelectorAll('.mk-tsel').forEach(x => x.classList.remove('mk-tsel')); }
    function selectCells(tb, c, kind) {
      if (!tb || !c) return false;
      clearTsel();
      let cells;
      if (kind === 'row') cells = [...c.parentElement.cells];
      else if (kind === 'col') cells = [...tb.rows].map(r => r.cells[c.cellIndex]).filter(Boolean);
      else cells = [...tb.querySelectorAll('th,td')];
      cells.forEach(x => x.classList.add('mk-tsel'));
      const r = document.createRange();
      if (kind === 'col') r.selectNodeContents(c);
      else { r.setStart(cells[0], 0); const last = cells[cells.length - 1]; r.setEnd(last, last.childNodes.length); }
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      return true;
    }
    function cellOfSel() {
      const r = range(); if (!r) return null;
      const n = r.startContainer; const el = n.nodeType === 1 ? n : n.parentElement;
      const c = el && el.closest('td,th'); return c && page.contains(c) ? c : null;
    }
    const fmLineCount = () => (fm.raw.match(/\n/g) || []).length;
    function tableByLine(line) {
      const want = line - fmLineCount(); let best = null, bd = Infinity;
      page.querySelectorAll('table').forEach(tb => { const dl = tb.getAttribute('data-line'); if (dl == null) return; const d = Math.abs(+dl - want); if (d < bd) { bd = d; best = tb; } });
      return bd <= 4 ? best : null;
    }
    // after a table edit: the caret goes to the cell the edit names (or where the table was)
    function focusTableTarget(t) {
      if (!t || !page) return;
      page.focus({ preventScroll: true });
      const tb = t.line != null && t.row != null ? tableByLine(t.line) : null;
      if (!tb) {
        const want = (t.line ?? 0) - fmLineCount(); let el = null;
        for (const n of page.children) { const dl = n.getAttribute('data-line'); if (dl != null && +dl >= want) { el = n; break; } }
        el = el || [...page.children].reverse().find(n => n.getAttribute('contenteditable') !== 'false') || page;
        placeIn(el, false); scrollCaretIntoView(); return;
      }
      const row = tb.rows[Math.min(t.row, tb.rows.length - 1)]; const c = row && row.cells[Math.min(t.col ?? 0, row.cells.length - 1)];
      if (t.select && selectCells(tb, c, t.select)) return;
      focusCell(c); scrollCaretIntoView();
    }
    function textOffsetOf(node, off) {
      const r = document.createRange(); r.setStart(page, 0);
      try { r.setEnd(node, off); } catch { return 0; }
      const d = document.createElement('div'); d.appendChild(r.cloneContents());
      d.querySelectorAll('[contenteditable="false"]').forEach(x => x.remove());
      return d.textContent.length;
    }
    // table edits work on the Markdown, so the page must be drawn from the current text first
    async function ensureFresh() {
      flush();
      if (!doc || doc.text === renderedText) return;
      const r = range(); const a = r ? textOffsetOf(r.startContainer, r.startOffset) : null; const b = r ? textOffsetOf(r.endContainer, r.endOffset) : null;
      const cellPos = (() => { const c = cellOfSel(); if (!c) return null; const tb = c.closest('table'); return { idx: [...page.querySelectorAll('table')].indexOf(tb), row: c.parentElement.rowIndex, col: c.cellIndex, off: r ? textOffsetOf(r.startContainer, r.startOffset) - textOffsetOf(c, 0) : 0 }; })();
      await renderDoc({ keepScroll: true });
      page.focus({ preventScroll: true });
      if (cellPos) {
        const tb = page.querySelectorAll('table')[cellPos.idx]; const c = tb?.rows[cellPos.row]?.cells[cellPos.col];
        if (c) { placeIn(c, false); try { const ix = textIndex(); const base = textOffsetOf(c, 0); const rr = rangeFor(ix, base + cellPos.off, base + cellPos.off); if (c.contains(rr.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(rr); } } catch {} return; }
      }
      if (a != null) { try { const rr = rangeFor(textIndex(), a, b); const s = getSelection(); s.removeAllRanges(); s.addRange(rr); } catch {} }
    }
    function newRow(ref) { const tr = document.createElement('tr'); for (let k = 0; k < ref.cells.length; k++) { const td = document.createElement('td'); const al = ref.cells[k].getAttribute('align') || ref.cells[k].style.textAlign; if (al) { td.setAttribute('align', al); td.style.textAlign = al; } td.innerHTML = '<br>'; tr.appendChild(td); } return tr; }
    function tableOp(op, cell) {
      const table = cell.closest('table'); if (!table) return;
      const row = cell.parentElement; const idx = [...row.cells].indexOf(cell);
      const rows = [...table.rows];
      const inHead = row.parentElement.tagName === 'THEAD';
      let tbody = table.tBodies[0]; if (!tbody) { tbody = document.createElement('tbody'); table.appendChild(tbody); }
      if (op === 'rowAbove') { if (inHead) tbody.prepend(newRow(row)); else row.before(newRow(row)); }
      else if (op === 'rowBelow') { if (inHead) tbody.prepend(newRow(row)); else row.after(newRow(row)); }
      else if (op === 'colLeft' || op === 'colRight') {
        rows.forEach(r => { const c = r.cells[idx] || r.cells[r.cells.length - 1]; if (!c) return; const n = document.createElement(c.tagName); n.innerHTML = '<br>'; op === 'colLeft' ? c.before(n) : c.after(n); });
      } else if (op === 'delRow') {
        if (inHead) {
          const first = tbody.rows[0]; if (!first) { table.remove(); }
          else { [...first.cells].forEach(c => { const th = document.createElement('th'); [...c.attributes].forEach(a => th.setAttribute(a.name, a.value)); th.append(...c.childNodes); c.replaceWith(th); }); row.replaceWith(first); }
        } else row.remove();
      } else if (op === 'delCol') {
        rows.forEach(r => r.cells[idx]?.remove()); if (!table.rows[0] || !table.rows[0].cells.length) table.remove();
      } else if (op === 'delTable') { const p = document.createElement('p'); p.innerHTML = '<br>'; table.replaceWith(p); markDirty(p); }
      else if (op.startsWith('align:')) { const al = op.slice(6); rows.forEach(r => { const c = r.cells[idx]; if (c) { c.style.textAlign = al; c.setAttribute('align', al); } }); }
      if (table.isConnected) markDirty(table); else allDirty = allDirty || false;
      dirty.add(topOf(table) || page.firstChild);
      if (!table.isConnected) { /* removed: its segment is no longer intact, nothing else to mark */ }
      scheduleCommit();
    }
    function onContextMenu(e) {
      const cell = e.target.closest('td,th');
      if (!cell || !page.contains(cell)) return;
      e.preventDefault();
      const cur = range(); if (!cur || !cell.contains(cur.startContainer)) { page.focus({ preventScroll: true }); placeIn(cell, true); }
      ctxCell = cell;
      if (app.tables?.contextMenu) { app.tables.contextMenu({ x: e.clientX, y: e.clientY }); return; }
      const run = op => () => tableOp(op, cell);
      E.menu({ x: e.clientX, y: e.clientY }, [
        { title: 'Table' },
        { label: 'Insert row above', run: run('rowAbove') }, { label: 'Insert row below', run: run('rowBelow') },
        { label: 'Insert column left', run: run('colLeft') }, { label: 'Insert column right', run: run('colRight') }, '-',
        { label: 'Align column left', run: run('align:left') }, { label: 'Center column', run: run('align:center') }, { label: 'Align column right', run: run('align:right') }, '-',
        { label: 'Delete row', run: run('delRow') }, { label: 'Delete column', run: run('delCol') }, { label: 'Delete table', run: run('delTable') },
      ], { noFocus: true });
    }

    // ---------- paste / drop ----------
    let plainNext = false;
    async function onPaste(e) {
      const cd = e.clipboardData; if (!cd || doc?.readOnly) return;
      const files = [...cd.files].filter(f => /^image\//.test(f.type));
      if (files.length) { e.preventDefault(); for (const f of files) await insertImageFile(f); return; }
      const html = cd.getData('text/html'), text = cd.getData('text/plain');
      const r = range(); const el = r && (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement);
      e.preventDefault();
      if (plainNext || (el && el.closest('pre,code'))) { plainNext = false; document.execCommand('insertText', false, text); return; }
      if (html && !/^\s*$/.test(html.replace(/<[^>]+>/g, ''))) { insertHTML(E.sanitizePaste(html)); return; }
      if (text) {
        if (E.looksLikeMarkdown(text)) await adapter.insert(text);
        else document.execCommand('insertText', false, text);
      }
    }
    function insertHTML(html) {
      restoreRange();
      document.execCommand('insertHTML', false, html);
      prepare(page);
      const r = range(); if (r) markDirty(r.startContainer);
      allDirty = allDirty || false;
      scheduleCommit();
    }
    async function onDrop(e) {
      const files = [...(e.dataTransfer?.files || [])].filter(f => /^image\//.test(f.type));
      if (!files.length) return;
      e.preventDefault();
      const pos = document.caretRangeFromPoint?.(e.clientX, e.clientY);
      if (pos) { const s = getSelection(); s.removeAllRanges(); s.addRange(pos); }
      for (const f of files) await insertImageFile(f);
    }
    async function insertImageFile(f) {
      const res = await E.saveImage(f, doc);
      await adapter.insert(E.imageMarkdown(res.path, res.name));
    }

    // ---------- floating format bar ----------
    function buildFloat() {
      floatBar = document.createElement('div'); floatBar.className = 'mk-float'; floatBar.setAttribute('role', 'toolbar'); floatBar.setAttribute('aria-label', 'Formatting');
      const ic = n => `<svg class="i"><use href="#${n}"/></svg>`;
      const items = [['format.bold', '<b>B</b>', 'Bold (Ctrl+B)', 'bold'], ['format.italic', '<i>I</i>', 'Italic (Ctrl+I)', 'italic'], ['format.underline', '<u>U</u>', 'Underline (Ctrl+U)', 'underline'], ['format.highlight', ic('hl'), 'Highlight', 'highlight', 'swatch'], 'sep', ['insert.link', ic('link'), 'Link (Ctrl+K)'], ['review.comment', ic('comment'), 'Comment'], ['ref.cite', ic('cite'), 'Cite']];
      for (const it of items) {
        if (it === 'sep') { const s = document.createElement('span'); s.className = 'sep'; floatBar.appendChild(s); continue; }
        const [cmd, html, title, state, cls] = it;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'ib' + (cls ? ' ' + cls : ''); b.innerHTML = html; b.title = title; b.setAttribute('aria-label', title);
        if (cls === 'swatch') b.style.setProperty('--c', '#ffd60a');
        if (state) b.dataset.state = state;
        b.addEventListener('mousedown', e => e.preventDefault());
        b.addEventListener('click', () => {
          if (cmd === 'review.comment') return addComment();
          if (cmd === 'ref.cite' && !app.commands.get('ref.cite')) return app.ui.toast?.('Use References → Cite to add citations. The citation tools are still loading.', { kind: 'info' });
          app.commands.run(cmd);
          setTimeout(updateFloatStates, 0);
        });
        floatBar.appendChild(b);
      }
      document.body.appendChild(floatBar);
    }
    function positionFloat() {
      const s = getSelection(); if (!s.rangeCount) return;
      const rect = s.getRangeAt(0).getBoundingClientRect(); if (!rect.width && !rect.height) return hideFloat();
      const w = floatBar.offsetWidth || 250;
      let x = rect.left + rect.width / 2 - w / 2, y = rect.top - 48;
      if (y < 60) y = rect.bottom + 10;
      x = Math.max(8, Math.min(innerWidth - w - 8, x));
      floatBar.style.left = x + 'px'; floatBar.style.top = y + 'px';
    }
    function hideFloat() { floatBar?.classList.remove('show'); }
    function updateFloatStates() {
      if (!floatBar) return; const st = adapter.activeStates();
      floatBar.querySelectorAll('[data-state]').forEach(b => b.classList.toggle('on', !!st[b.dataset.state]));
    }
    let selRaf = 0;
    function onSelectionChange() {
      if (selRaf || !mounted) return;
      selRaf = requestAnimationFrame(() => {
        selRaf = 0; if (!mounted || !page) return;
        const s = getSelection();
        const inside = s.rangeCount && page.contains(s.anchorNode);
        if (!inside) { if (!floatBar?.matches(':hover') && document.activeElement !== page) hideFloat(); return; }
        savedRange = s.getRangeAt(0).cloneRange();
        const onlyAtom = page.querySelector('.mk-sel');
        if (!s.isCollapsed && !onlyAtom && s.toString().trim()) { if (!floatBar) buildFloat(); floatBar.classList.add('show'); positionFloat(); updateFloatStates(); }
        else hideFloat();
        if (onlyAtom && !(s.rangeCount && s.getRangeAt(0).intersectsNode(onlyAtom))) clearAtomSel();
        app.events.emit('selection:changed', { mode: 'word', states: adapter.activeStates() });
      });
    }
    async function addComment() {
      for (const id of ['review.comment', 'review.addComment', 'comment.add']) if (app.commands.get(id)) return app.commands.run(id);
      const text = await app.ui.prompt('New comment', 'Comment', '');
      if (!text) return;
      restoreRange(); const r = range(); if (!r) return;
      r.collapse(false); const c = document.createComment(` comment: ${text.replace(/--/g, '—')} `); r.insertNode(c);
      markDirty(c); commit(); app.ui.toast?.('Comment added');
    }

    // ---------- inline formatting helpers ----------
    function closestIn(tagSel) { const r = range(); if (!r) return null; const n = r.commonAncestorContainer; const el = (n.nodeType === 1 ? n : n.parentElement).closest(tagSel); return el && page.contains(el) ? el : null; }
    function unwrap(el) { const p = el.parentNode; markDirty(el); while (el.firstChild) p.insertBefore(el.firstChild, el); el.remove(); p.normalize?.(); }
    function wrapSelection(tag, attrs = {}) {
      const r = restoreRange(); if (!r) return null;
      if (r.collapsed) {
        const el = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); el.textContent = '\u200b';
        r.insertNode(el); const rr = document.createRange(); rr.setStart(el.firstChild, 1); rr.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(rr);
        markDirty(el); scheduleCommit(); return el;
      }
      const el = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      el.appendChild(r.extractContents());
      // remove nested same tags
      el.querySelectorAll(tag).forEach(x => x.replaceWith(...x.childNodes));
      r.insertNode(el);
      const rr = document.createRange(); rr.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(rr);
      markDirty(el); scheduleCommit(); return el;
    }
    function toggleTag(tag) { const ex = closestIn(tag); if (ex) { unwrap(ex); scheduleCommit(); return; } wrapSelection(tag); }
    function currentBlocks() {
      const r = restoreRange(); if (!r) return [];
      const tops = []; let n = topOf(r.startContainer); const end = topOf(r.endContainer);
      while (n) { if (n.nodeType === 1) tops.push(n); if (n === end) break; n = n.nextSibling; }
      return tops;
    }
    function setAlign(al) {
      const blocks = currentBlocks(); if (!blocks.length) return;
      const wrapped = blocks[0].matches('div[align]') ? blocks[0] : null;
      if (wrapped && blocks.length === 1) { if (al === 'left') unwrap(wrapped); else { wrapped.setAttribute('align', al); markDirty(wrapped); } scheduleCommit(); return; }
      if (al === 'left') { blocks.forEach(b => { if (b.matches('div[align]')) unwrap(b); }); scheduleCommit(); return; }
      const div = document.createElement('div'); div.setAttribute('align', al);
      blocks[0].before(div); blocks.forEach(b => { if (b.matches('div[align]')) { div.append(...b.childNodes); b.remove(); } else div.appendChild(b); });
      dirty.add(div); scheduleCommit();
    }
    // Blocks touched by the selection (paragraphs, headings, list items). Loose top-level text is wrapped in <p> first.
    function blocksInRange() {
      const r = restoreRange(); if (!r) return [];
      for (const c of [r.startContainer, r.endContainer]) {
        const top = topOf(c);
        if (top && (top.nodeType === 3 || (top.nodeType === 1 && !BLOCKS.test(top.tagName) && top.getAttribute('contenteditable') !== 'false'))) {
          // gather the run of inline siblings around it into one paragraph
          let a = top, b = top;
          const inl = n => n && (n.nodeType === 3 || (n.nodeType === 1 && !BLOCKS.test(n.tagName)));
          while (inl(a.previousSibling)) a = a.previousSibling;
          while (inl(b.nextSibling)) b = b.nextSibling;
          const p = document.createElement('p'); a.before(p);
          let n = a; while (n) { const nx = n === b ? null : n.nextSibling; p.appendChild(n); n = nx; }
          dirty.add(p);
        }
      }
      const sel = 'p,h1,h2,h3,h4,h5,h6,li,div:not([class]):not([align])';
      const s = blockOf(r.startContainer), e = blockOf(r.endContainer);
      if (s && s === e) return [s.closest(sel) || s];
      return [...page.querySelectorAll(sel)].filter(b => { try { return r.intersectsNode(b); } catch { return false; } })
        .filter(b => !b.querySelector('p,h1,h2,h3,h4,h5,h6,li') || b.tagName === 'LI');
    }
    function retag(blk, tag) {
      if (blk.tagName === 'LI') {
        const inner = blk.querySelector(':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
        if (inner) return retag(inner, tag);
        if (tag === 'p') return blk;
        const h = document.createElement(tag); const kids = [];
        for (const c of blk.childNodes) { if (c.nodeType === 1 && /^(UL|OL)$/.test(c.tagName)) break; if (!(c.nodeType === 1 && c.matches('input[type=checkbox]'))) kids.push(c); }
        kids[0] ? kids[0].before(h) : blk.appendChild(h); h.append(...kids); return h;
      }
      if (!/^(P|H[1-6]|DIV)$/.test(blk.tagName) || blk.tagName === tag.toUpperCase()) return blk;
      const n = document.createElement(tag); n.append(...blk.childNodes);
      if (blk.getAttribute('align')) n.setAttribute('align', blk.getAttribute('align'));
      blk.replaceWith(n); return n;
    }
    function setBlock(kind) {
      const r = restoreRange(); if (!r) return;
      const el = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
      const keep = { sc: r.startContainer, so: r.startOffset, ec: r.endContainer, eo: r.endOffset, off: caretOffset() };
      const restore = () => {
        try { if (page.contains(keep.sc) && page.contains(keep.ec) && keep.sc.nodeType === 3 && keep.ec.nodeType === 3) { const rr = document.createRange(); rr.setStart(keep.sc, keep.so); rr.setEnd(keep.ec, keep.eo); const s = getSelection(); s.removeAllRanges(); s.addRange(rr); return; } } catch {}
        setCaretOffset(keep.off);
      };
      if (kind === 'quote') {
        const bq = el.closest('blockquote');
        if (bq && page.contains(bq)) { unwrap(bq); restore(); scheduleCommit(); return; }
        const tops = currentBlocks().filter(n => n.nodeType === 1 && !isSpecial(n));
        if (!tops.length) return;
        const q = document.createElement('blockquote'); tops[0].before(q);
        tops.forEach(t => { if (/^(P|H[1-6]|UL|OL|TABLE|PRE|DIV|BLOCKQUOTE)$/.test(t.tagName)) q.appendChild(t); else { const p = document.createElement('p'); p.appendChild(t); q.appendChild(p); } });
        dirty.add(q); restore(); scheduleCommit(); return;
      } else if (kind === 'codeBlock') {
        const blk = blockOf(el); if (!blk) return;
        const pre = blk.closest('pre');
        if (pre) { const p = document.createElement('p'); p.textContent = preText(pre); pre.replaceWith(p); dirty.add(topOf(p) || p); scheduleCommit(); return; }
        const text = blk.innerText.replace(/\n$/, '');
        const np = document.createElement('pre'); np.className = 'hljs'; const code = document.createElement('code'); code.textContent = text || '\u200b'; np.appendChild(code);
        if (blk === page) return; blk.replaceWith(np); dirty.add(topOf(np) || np);
        const rr = document.createRange(); rr.selectNodeContents(code); rr.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(rr);
      } else {
        const bq = el.closest('blockquote:not(.callout)');
        if (kind === 'p' && bq && page.contains(bq) && !el.closest('h1,h2,h3,h4,h5,h6')) { unwrap(bq); restore(); scheduleCommit(); return; }
        for (const b of blocksInRange()) { const n = retag(b, kind); markDirty(n); }
        restore();
      }
      const rr = range(); if (rr) markDirty(rr.startContainer);
      scheduleCommit();
    }
    // Lists without execCommand (Chrome's list commands break paragraphs that hold math or citations)
    function caretKeeper() {
      const r = range(); const k = r && { sc: r.startContainer, so: r.startOffset, ec: r.endContainer, eo: r.endOffset, off: caretOffset() };
      return () => {
        if (!k) return;
        try { if (page.contains(k.sc) && page.contains(k.ec) && k.sc.nodeType === 3 && k.ec.nodeType === 3) { const rr = document.createRange(); rr.setStart(k.sc, k.so); rr.setEnd(k.ec, k.eo); const s = getSelection(); s.removeAllRanges(); s.addRange(rr); return; } } catch {}
        setCaretOffset(k.off);
      };
    }
    function liToP(li) {
      const p = document.createElement('p'); const rest = [];
      for (const c of [...li.childNodes]) { if (c.nodeType === 1 && /^(UL|OL)$/.test(c.tagName)) rest.push(c); else if (c.nodeType === 1 && c.matches('input[type=checkbox]')) c.remove(); else if (c.nodeType === 1 && /^(P|H[1-6])$/.test(c.tagName)) p.append(...c.childNodes); else p.appendChild(c); }
      if (!p.firstChild) p.innerHTML = '<br>';
      return [p, ...rest];
    }
    function toggleList(type) {
      const restore = caretKeeper();
      const blocks = blocksInRange(); if (!blocks.length) return;
      const tag = type === 'ol' ? 'OL' : 'UL';
      const lis = blocks.map(b => (b.tagName === 'LI' ? b : b.closest('li'))).filter(Boolean);
      const lists = [...new Set(lis.map(li => li.parentElement))];
      const allSame = lis.length === blocks.length && lists.every(l => l.tagName === tag && (type === 'task') === l.classList.contains('contains-task-list'));
      if (allSame) {
        // remove the list formatting from the selected items
        for (const li of lis) {
          const list = li.parentElement; const items = [...list.children]; const i = items.indexOf(li);
          const after = items.slice(i + 1); const parts = liToP(li);
          let anchor = list;
          if (i === 0 && !after.length) { list.replaceWith(...parts); parts.forEach(p => dirty.add(topOf(p) || p)); continue; }
          if (after.length && i > 0) { const nl = list.cloneNode(false); nl.removeAttribute('data-line'); after.forEach(a => nl.appendChild(a)); list.after(nl); }
          if (i === 0) { list.before(...parts); } else { anchor.after(...parts); }
          li.remove(); if (!list.children.length) list.remove();
          parts.forEach(p => dirty.add(topOf(p) || p));
        }
        restore(); scheduleCommit(); return;
      }
      for (const l of lists) {
        // switch list type in place
        let cur = l;
        if (l.tagName !== tag) { const n = document.createElement(tag); [...l.attributes].forEach(a => n.setAttribute(a.name, a.value)); n.append(...l.childNodes); l.replaceWith(n); cur = n; }
        if (cur.classList.contains('contains-task-list')) { cur.classList.remove('contains-task-list'); [...cur.children].forEach(li => { li.classList.remove('task-list-item'); li.querySelectorAll(':scope > input[type=checkbox], :scope > label > input[type=checkbox]').forEach(x => x.remove()); }); }
        markDirty(cur);
      }
      const plain = blocks.filter(b => b.tagName !== 'LI' && !b.closest('li'));
      if (plain.length) {
        const first = plain[0]; let list;
        const prev = first.previousElementSibling;
        if (prev && prev.tagName === tag && !prev.classList.contains('contains-task-list')) list = prev;
        else { list = document.createElement(tag); first.before(list); }
        for (const b of plain) { const li = document.createElement('li'); li.append(...b.childNodes); if (!li.firstChild) li.innerHTML = '<br>'; list.appendChild(li); b.remove(); }
        dirty.add(topOf(list) || list);
      }
      restore(); scheduleCommit();
    }
    function exitListItem(li) {
      const list = li.parentElement; const items = [...list.children]; const i = items.indexOf(li);
      const parentLi = list.parentElement && list.parentElement.closest('li');
      if (parentLi && list.parentElement === parentLi) {
        const after = items.slice(i + 1);
        if (after.length) { const nl = document.createElement(list.tagName); after.forEach(a => nl.appendChild(a)); li.appendChild(nl); }
        parentLi.after(li); if (!list.children.length) list.remove();
        const r = document.createRange(); r.setStart(li, li.querySelector('input[type=checkbox]') ? 1 : 0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r);
        markDirty(li); scheduleCommit(); return;
      }
      const p = document.createElement('p'); p.innerHTML = '<br>';
      const after = items.slice(i + 1);
      list.after(p);
      if (after.length) { const nl = list.cloneNode(false); nl.removeAttribute('data-line'); after.forEach(a => nl.appendChild(a)); p.after(nl); dirty.add(nl); }
      li.remove(); if (!list.children.length) list.remove(); else dirty.add(topOf(list) || list);
      dirty.add(p);
      const r = document.createRange(); r.setStart(p, 0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r);
      scheduleCommit();
    }
    function toggleTask() {
      const r = restoreRange(); if (!r) return;
      let el = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement);
      let list = el.closest('ul,ol');
      if (!list || !page.contains(list) || list.tagName === 'OL') {
        toggleList('ul'); const rr = range(); list = rr && (rr.startContainer.nodeType === 1 ? rr.startContainer : rr.startContainer.parentElement).closest('ul'); if (!list) return;
      }
      const isTask = list.classList.contains('contains-task-list');
      if (isTask) { list.classList.remove('contains-task-list'); [...list.children].forEach(li => { li.classList.remove('task-list-item'); li.querySelectorAll(':scope > input[type=checkbox], :scope > label > input[type=checkbox]').forEach(i => i.remove()); }); }
      else {
        list.classList.add('contains-task-list');
        [...list.children].forEach(li => { if (li.tagName !== 'LI' || li.querySelector(':scope > input[type=checkbox], :scope > label > input')) return; li.classList.add('task-list-item'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'task-list-item-checkbox'; li.insertBefore(cb, li.firstChild); li.insertBefore(document.createTextNode(' '), cb.nextSibling); });
      }
      markDirty(list); scheduleCommit();
    }
    function applyPainter() {
      const s = getSelection(); if (!s.rangeCount || s.isCollapsed || !page.contains(s.anchorNode)) return;
      const f = painter; painter = null; root.style.cursor = '';
      for (const [k, on] of Object.entries(f)) if (on && !adapter.activeStates()[k]) adapter.format(k);
    }

    // ---------- page layout ----------
    function applyLayout() {
      if (!page) return;
      try { app.layout?.apply?.(page, doc); } catch (e) { console.error(e); }
      applyZoom();
    }
    function applyZoom() { if (sheet) sheet.style.zoom = (app.zoom || 100) / 100; }
    function scheduleLayout() { if (layoutRaf) return; layoutRaf = requestAnimationFrame(() => { layoutRaf = 0; layoutPages(); }); }
    function layoutPages() {
      if (!page || !mounted) return;
      const ps = app.layout?.pageSize?.(doc) || { w: 794, h: 1123 };
      const cs = getComputedStyle(page);
      const padB = parseFloat(cs.paddingBottom) || 90;
      const last = page.lastElementChild;
      const contentH = last ? last.offsetTop + last.offsetHeight + padB : ps.h;
      const n = Math.max(1, Math.ceil((contentH - 1) / ps.h));
      page.style.minHeight = n * ps.h + 'px';
      if (marks.childElementCount !== n - 1) {
        marks.textContent = '';
        for (let k = 1; k < n; k++) { const m = document.createElement('div'); m.className = 'mk-pmark'; m.style.top = k * ps.h + 'px'; m.innerHTML = `<span>Page ${k + 1}</span>`; marks.appendChild(m); }
      } else [...marks.children].forEach((m, k) => { m.style.top = (k + 1) * ps.h + 'px'; });
      if (n !== pageCount) { pageCount = n; app.status?.refresh?.(); app.events.emit('word:pages', n); }
    }
    function currentPage() {
      const r = range(); if (!r) return 1;
      const ps = app.layout?.pageSize?.(doc) || { h: 1123 };
      const rect = r.getBoundingClientRect(), pr = page.getBoundingClientRect(); const z = (app.zoom || 100) / 100;
      return Math.max(1, Math.min(pageCount, Math.floor((rect.top - pr.top) / z / ps.h) + 1));
    }

    // ---------- fragment insert (Markdown → rendered nodes at the caret) ----------
    async function insertMarkdown(md, { block = false } = {}) {
      if (!page || doc?.readOnly) return;
      flush();
      let r = restoreRange(); if (!r) return;
      const res = await app.render(md, { doc });
      const tmp = document.createElement('div'); tmp.innerHTML = res.html;
      tmp.querySelectorAll('.mk-front, .mk-bibliography').forEach(x => x.remove());
      prepare(tmp);
      decorating = true; try { await app.decorate(tmp, doc); } catch {} finally { decorating = false; }
      r = restoreRange(); if (!r) return;
      tmp.querySelectorAll('[data-line]').forEach(x => x.removeAttribute('data-line'));
      const kids = [...tmp.childNodes].filter(n => !(n.nodeType === 3 && !n.data.trim()));
      const inline = !block && kids.length === 1 && kids[0].nodeName === 'P' && !/\n\s*\n/.test(md.trim());
      if (!r.collapsed) r.deleteContents();
      if (inline) {
        const nodes = [...kids[0].childNodes]; const frag = document.createDocumentFragment(); nodes.forEach(n => frag.appendChild(n));
        const last = nodes[nodes.length - 1];
        r.insertNode(frag);
        if (last) { if (last.nodeType === 1 && last.getAttribute('contenteditable') === 'false') { const sp = document.createTextNode('\u200b'); last.after(sp); } caretAfter(last.nextSibling && last.nextSibling.nodeType === 3 && last.nextSibling.data === '\u200b' ? last.nextSibling : last); }
        markDirty(last || r.startContainer);
      } else {
        // split the current block at the caret and put the new blocks in between
        const cur = topOf(r.startContainer);
        let after = null;
        if (cur && cur.nodeType === 1 && cur !== page) {
          const isEmpty = !cur.textContent.replace(/[\u200b\s]/g, '') && !cur.querySelector('img,.mk-math,.mk-cite,input,table,pre');
          if (isEmpty) { after = cur.nextSibling; cur.remove(); }
          else {
            const tail = document.createRange(); tail.setStart(r.startContainer, r.startOffset); tail.setEndAfter(cur);
            const frag = tail.extractContents();
            const rest = frag.firstChild;
            after = cur.nextSibling;
            if (rest && rest.textContent.replace(/[\u200b\s]/g, '')) { page.insertBefore(rest, after); after = rest; dirty.add(rest); }
            dirty.add(cur);
          }
        } else after = null;
        let lastIns = null;
        for (const k of kids) { page.insertBefore(k, after); dirty.add(k); lastIns = k; }
        if (lastIns) {
          let next = lastIns.nextSibling;
          if (!next || next.nodeType !== 1 || next.getAttribute('contenteditable') === 'false' || /^(TABLE|PRE|HR)$/.test(next.tagName)) { const p = document.createElement('p'); p.innerHTML = '<br>'; page.insertBefore(p, next); dirty.add(p); next = p; }
          const rr = document.createRange(); rr.selectNodeContents(next); rr.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(rr);
        }
      }
      commit(); scheduleLayout();
    }

    // ---------- find ----------
    function textIndex() {
      const w = document.createTreeWalker(page, NodeFilter.SHOW_TEXT); const nodes = []; let s = '', t;
      while ((t = w.nextNode())) { if (t.parentElement.closest('[contenteditable="false"]')) continue; nodes.push({ node: t, start: s.length }); s += t.data; }
      return { s, nodes };
    }
    function rangeFor(ix, a, b) {
      const pos = off => { let lo = 0; for (let i = 0; i < ix.nodes.length; i++) if (ix.nodes[i].start <= off) lo = i; else break; const n = ix.nodes[lo]; return [n.node, Math.min(n.node.data.length, off - n.start)]; };
      const r = document.createRange(); const [sn, so] = pos(a); const [en, eo] = pos(b); r.setStart(sn, so); r.setEnd(en, eo); return r;
    }

    // ---------- adapter ----------
    const adapter = {
      name: 'word',
      getSurface() { return page && page.isConnected ? page : null; },
      mount(container, d) {
        if (mounted) adapter.unmount();
        host = container; doc = d; mounted = true;
        build(); host.appendChild(root);
        undoStack = []; redoStack = []; pageCount = 1;
        page.contentEditable = doc?.readOnly ? 'false' : 'true';
        offs.push(app.events.on('doc:changed', ({ doc: dd, origin }) => {
          if (dd !== doc || origin === 'word') return;
          clearTimeout(commitTimer); commitTimer = null;
          if (origin === 'word-undo') { const c = pendingCaret; pendingCaret = null; renderDoc({ caret: c }); return; }
          if (dd.text === lastText) return;
          undoStack.push({ text: lastText ?? '', caret: caretOffset() });
          renderDoc({ caret: document.activeElement === page ? caretOffset() : null });
        }));
        offs.push(app.events.on('zoom:changed', () => { applyZoom(); scheduleLayout(); }));
        offs.push(app.events.on('layout:changed', () => { applyLayout(); scheduleLayout(); }));
        offs.push(app.events.on('settings:changed', ({ key }) => { if (/^(fontFamily|fontSize|fontFamilyExplicit)$/.test(key)) { applyLayout(); scheduleLayout(); } if (key === 'mathMacros') renderDoc(); }));
        offs.push(app.events.on('theme:changed', () => { page?.querySelectorAll('pre.mermaid[data-done]').forEach(p => { p.removeAttribute('data-done'); p.textContent = p.getAttribute('data-src') || ''; }); decorating = true; Promise.resolve(app.decorate(page, doc)).finally(() => { decorating = false; }); }));
        renderDoc({ keepScroll: false }).then(() => { if (mounted && doc && !doc.readOnly) { page.focus({ preventScroll: true }); const r = document.createRange(); const first = [...page.children].find(c => c.getAttribute('contenteditable') !== 'false') || page; r.selectNodeContents(first); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); } });
      },
      unmount() {
        if (!mounted) return;
        flush();
        mounted = false; renderSeq++;
        observer?.disconnect();
        offs.splice(0).forEach(f => { try { f(); } catch {} });
        hideFloat(); floatBar?.remove(); floatBar = null;
        root?.remove(); root = sheet = page = marks = null; host = null; doc = null; segs = []; dirty.clear();
      },
      get doc() { return doc; },
      get page() { return page; },
      flush,
      get pageCount() { return pageCount; },
      currentPage,
      getSelection() { const r = range(); return { text: r ? r.toString() : '', start: null, end: null, html: r ? (() => { const d = document.createElement('div'); d.appendChild(r.cloneContents()); return d.innerHTML; })() : '' }; },
      getSelectionMarkdown() { const r = range(); if (!r || r.collapsed) return ''; const d = document.createElement('div'); d.appendChild(r.cloneContents()); return toMd(d.innerHTML).trim(); },
      replaceSelection(md) { return insertMarkdown(md); },
      insert(md) { return insertMarkdown(md, { block: /^\n*(?:```|\$\$|\||#|> |[-*+] |\d+\. |<div|---\n|:::|\\\[)/.test(md.replace(/^\n+/, '')) && /\n/.test(md.trim()) || /^\n\n/.test(md) }); },
      insertBlock(md) { return insertMarkdown(md, { block: true }); },
      wrap(before, after) {
        after = after ?? before;
        const map = { '**': 'bold', '__': 'bold', '*': 'italic', '_': 'italic', '~~': 'strike', '==': 'highlight', '`': 'code', '~': 'sub', '^': 'sup' };
        if (map[before] && before === after) return adapter.format(map[before]);
        if (before === '<u>') return adapter.format('underline');
        const r = restoreRange(); if (!r) return;
        const sel = r.collapsed ? '' : adapter.getSelectionMarkdown();
        if ((before === '$' || before === '\\(') && sel) { const atom = mathAtom(r.toString(), false, before === '$' ? 'd' : 'paren'); r.deleteContents(); r.insertNode(atom); caretAfter(atom); markDirty(atom); commit(); return; }
        return insertMarkdown(before + sel + after);
      },
      format(kind) {
        if (!page || doc?.readOnly) return;
        restoreRange();
        const ex = c => { document.execCommand(c); const r = range(); if (r) markDirty(r.commonAncestorContainer); scheduleCommit(); };
        let m;
        switch (kind) {
          case 'bold': return ex('bold');
          case 'italic': return ex('italic');
          case 'underline': return ex('underline');
          case 'strike': return ex('strikeThrough');
          case 'sub': return ex('subscript');
          case 'sup': return ex('superscript');
          case 'highlight': return toggleTag('mark');
          case 'code': return toggleTag('code');
          case 'ul': return toggleList('ul');
          case 'ol': return toggleList('ol');
          case 'task': return toggleTask();
          case 'indent': return closestIn('li') ? ex('indent') : app.ui.toast?.('Click in a list item to indent it. Markdown has no page indents for plain paragraphs.', { kind: 'info' });
          case 'outdent': return closestIn('li') ? ex('outdent') : (closestIn('blockquote') ? setBlock('quote') : undefined);
          case 'quote': return setBlock('quote');
          case 'p': return setBlock('p');
          case 'codeBlock': return setBlock('codeBlock');
          case 'clear': {
            ex('removeFormat');
            const r = range(); if (!r) return;
            for (const tag of ['mark', 'code', 'u', 'sub', 'sup', 's', 'del', 'span[style]']) { let el; while ((el = closestIn(tag))) unwrap(el); }
            scheduleCommit(); return;
          }
        }
        if ((m = /^h([1-6])$/.exec(kind))) { const cur = adapter.activeStates().heading; return setBlock(cur === +m[1] ? 'p' : 'h' + m[1]); }
        if ((m = /^align(Left|Center|Right|Justify)$/.exec(kind))) return setAlign(m[1].toLowerCase());
      },
      color(c) {
        if (!c) { let el; while ((el = closestIn('span[style]'))) unwrap(el); scheduleCommit(); return; }
        const ex = closestIn('span[style]'); if (ex && range()?.toString() === ex.textContent) { ex.style.color = c; markDirty(ex); scheduleCommit(); return; }
        const el = wrapSelection('span'); if (el) { el.style.color = c; markDirty(el); }
      },
      highlightColor(c) {
        const ex = closestIn('mark');
        if (!c) { if (ex) unwrap(ex); scheduleCommit(); return; }
        if (ex) { if (/ffd60a|yellow/i.test(c)) ex.removeAttribute('style'); else ex.style.background = c; markDirty(ex); scheduleCommit(); return; }
        const el = wrapSelection('mark'); if (el && !/ffd60a|yellow/i.test(c)) el.style.background = c;
      },
      startPainter() { painter = adapter.activeStates(); ['heading', 'list', 'align', 'quote'].forEach(k => delete painter[k]); if (root) root.style.cursor = 'copy'; app.ui.toast?.('Select the text to paint. Press Esc to cancel.'); },
      activeStates() {
        const r = range(); if (!r) return {};
        const el = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
        const q = c => { try { return document.queryCommandState(c); } catch { return false; } };
        const h = el.closest('h1,h2,h3,h4,h5,h6'); const li = el.closest('li'); const list = li && li.parentElement;
        const al = el.closest('div[align]');
        return {
          bold: q('bold'), italic: q('italic'), underline: q('underline'), strike: q('strikeThrough'), sub: q('subscript'), sup: q('superscript'),
          highlight: !!el.closest('mark'), code: !!el.closest('code') && !el.closest('pre'),
          heading: h && page.contains(h) ? +h.tagName[1] : 0, quote: !!el.closest('blockquote:not(.callout)'), codeBlock: !!el.closest('pre'),
          list: list ? (list.classList.contains('contains-task-list') ? 'task' : list.tagName === 'OL' ? 'ol' : 'ul') : null,
          align: al && page.contains(al) ? al.getAttribute('align') : 'left', table: !!el.closest('td,th'),
        };
      },
      focus() { if (!page) return; if (!range()) restoreRange(); else page.focus({ preventScroll: true }); },
      scrollToLine(n) {
        if (!page) return;
        const fmL = (fm.raw.match(/\n/g) || []).length; const target = n - fmL;
        let best = null;
        page.querySelectorAll('[data-line]').forEach(el => { const l = +el.getAttribute('data-line'); if (l <= target && (!best || l >= +best.getAttribute('data-line'))) best = el; });
        (best || page.firstElementChild)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (best) { const r = document.createRange(); r.selectNodeContents(best); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); }
      },
      getText() { flush(); return doc?.text || ''; },
      // keep the caret also when a ribbon button has the focus (the selection is still in the page)
      refresh() { flush(); return renderDoc({ caret: page ? caretOffset() : null }); },
      find(query, opts = {}) {
        if (!page || !query) return { count: 0, index: -1 };
        const ix = textIndex(); const re = E.findRegex(query, opts); const all = [...ix.s.matchAll(re)].filter(m => m[0].length);
        if (!all.length) return { count: 0, index: -1 };
        const r = range(); let from = 0;
        if (r) { const t = document.createRange(); t.setStart(page, 0); t.setEnd(opts.backwards ? r.startContainer : r.endContainer, opts.backwards ? r.startOffset : r.endOffset); from = t.toString().length; }
        let i = opts.backwards ? all.filter(m => m.index + m[0].length < from).length - 1 : all.findIndex(m => m.index >= from);
        if (i < 0) i = opts.backwards ? all.length - 1 : 0;
        const m = all[i]; const rr = rangeFor(ix, m.index, m.index + m[0].length);
        page.focus({ preventScroll: true }); const s = getSelection(); s.removeAllRanges(); s.addRange(rr);
        const rect = rr.getBoundingClientRect(); const sc = scroller(); if (sc) { const sr = sc.getBoundingClientRect(); if (rect.top < sr.top + 40 || rect.bottom > sr.bottom - 40) sc.scrollTop += rect.top - sr.top - sr.height / 3; }
        return { count: all.length, index: i };
      },
      replace(query, replacement, opts = {}) {
        const r = range(); const re = E.findRegex(query, opts);
        if (r && !r.collapsed) { const one = new RegExp('^(?:' + re.source + ')$', re.flags.replace('g', '')); const t = r.toString(); if (one.test(t)) { document.execCommand('insertText', false, opts.regex ? t.replace(one, replacement) : replacement); markDirty(r.startContainer); scheduleCommit(); } }
        return adapter.find(query, opts);
      },
      replaceAll(query, replacement, opts = {}) {
        flush(); if (!doc) return 0;
        const ix = textIndex(); const re = E.findRegex(query, opts); const all = [...ix.s.matchAll(re)].filter(m => m[0].length);
        for (let k = all.length - 1; k >= 0; k--) { const m = all[k]; const rr = rangeFor(ix, m.index, m.index + m[0].length); const rep = opts.regex ? m[0].replace(new RegExp(re.source, re.flags.replace('g', '')), replacement) : replacement; rr.deleteContents(); rr.insertNode(document.createTextNode(rep)); markDirty(rr.startContainer); }
        if (all.length) commit();
        return all.length;
      },
      undo() {
        flush(); if (!undoStack.length) { app.ui.toast?.('Nothing to undo'); return; }
        const e = undoStack.pop(); redoStack.push({ text: doc.text, caret: caretOffset() }); applyText(e.text, e.caret);
      },
      redo() {
        flush(); if (!redoStack.length) return;
        const e = redoStack.pop(); undoStack.push({ text: doc.text, caret: caretOffset() }); applyText(e.text, e.caret);
      },
      canUndo() { return undoStack.length > 0 || !!commitTimer; },
      canRedo() { return redoStack.length > 0; },
      insertTable(rows, cols) {
        const head = '| ' + Array.from({ length: cols }, (_, i) => 'Column ' + (i + 1)).join(' | ') + ' |';
        const sep = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
        const body = Array.from({ length: Math.max(1, rows - 1) }, () => '| ' + Array.from({ length: cols }, () => ' ').join(' | ') + ' |');
        return insertMarkdown([head, sep, ...body].join('\n'), { block: true }).then(() => {
          // put the caret in the first header cell
          const tables = page.querySelectorAll('table'); const r = range(); let t = null;
          tables.forEach(x => { if (r && x.compareDocumentPosition(r.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING) t = x; });
          if (t) focusCell(t.querySelector('th'));
        });
      },
      tableOp(op) { const c = closestIn('td,th'); if (c) tableOp(op, c); },
      // ---- tables (src/tables.js): edits go through the Markdown, the caret comes back to the cell
      inTable() { return !!cellOfSel(); },
      async tableAt() {
        if (!page || !doc) return null;
        let c = cellOfSel() || (ctxCell && page.contains(ctxCell) ? ctxCell : null);
        if (!c) return null;
        await ensureFresh();
        c = cellOfSel() || c; if (!c.isConnected) return null;
        const tb = c.closest('table'); const dl = tb && tb.getAttribute('data-line'); if (dl == null) return null;
        return { line: +dl + fmLineCount(), row: c.parentElement.rowIndex, col: c.cellIndex };
      },
      async applyTableEdit(text, target) {
        if (!doc || !page || doc.readOnly) return;
        flush();
        if (text !== doc.text) {
          undoStack.push({ text: doc.text, caret: caretOffset() }); if (undoStack.length > 300) undoStack.shift();
          redoStack = []; lastText = text; doc.setText(text, 'word');
        }
        await renderDoc({ keepScroll: true, table: target || null });
        app.events.emit('selection:changed', { mode: 'word', states: adapter.activeStates() });
      },
      selectTableCells(kind) { const c = cellOfSel(); if (!c) return false; return selectCells(c.closest('table'), c, kind); },
      async selectionLines() {
        if (!page || !doc || !range()) return null;
        await ensureFresh();
        const r = range(); if (!r) return null;
        const lineOf = n => { const dl = n && n.nodeType === 1 ? n.getAttribute('data-line') : null; return dl == null ? null : +dl; };
        const tA = topOf(r.startContainer), tB = topOf(r.endContainer);
        const a = lineOf(tA); if (a == null) return null;
        let nx = tB && tB.nextElementSibling; while (nx && lineOf(nx) == null) nx = nx.nextElementSibling;
        const lines = fm.body.split('\n');
        let b = nx ? lineOf(nx) : lines.length; while (b > a && !(lines[b - 1] || '').trim()) b--;
        return { from: a + fmLineCount(), to: Math.max(a + 1, b) + fmLineCount() };
      },
      serialize: () => serialize(),
      _commit: () => commit(),
      _markAllDirty() { allDirty = true; },
    };
    return adapter;
  }

  E.createWord = createWordEditor;
  const word = createWordEditor();
  app.editors.register('word', word);
  app.wordPageCount = () => (app.mode === 'word' && word.page ? word.pageCount : null) ?? 1;
  app.wordCurrentPage = () => (app.mode === 'word' && word.page ? word.currentPage() : 1);

  // Make sure pending Word-mode typing reaches doc.text before saving or closing.
  for (const fn of ['save', 'saveAs', 'close']) {
    const orig = app.docs[fn]; if (typeof orig !== 'function' || orig.__mkFlush) continue;
    const wrapped = function (...a) { try { app.editors.active()?.flush?.(); } catch {} return orig.apply(this, a); };
    wrapped.__mkFlush = true; app.docs[fn] = wrapped;
  }
  app.events.on('mode:changed', () => { try { word.flush(); } catch {} });

  // ------------------------------------------------------------------ smoke tests
  const ROUND_TRIP = [
    '$|H - C_{prev}|$',
    '\\(|H - C_{prev}|\\)',
    '$$\n\\theta = \\frac{a}{b}\n$$',
    '| Run | D (mm) | θ |\n| --- | --- | --- |\n| R1 | 2.0 | 0.061 |',
    'Text with a note.[^1]\n\n[^1]: A footnote.',
    'Classic work [@shields1936] frames it.',
    '- [ ] one\n- [x] two',
    '==mark==',
    '```mermaid\ngraph TD\nA-->B\n```',
    '---\ntitle: Sediment Notes\nauthor: A. Bilal\n---\n\n# Intro\n\nBody text.',
    '- a\n- b\n  - c',
    '1. a\n2. b',
    '# Head\n\nPara *em* **b** <u>u</u> ~~s~~',
    '<div align="center">\n\nCentered\n\n</div>',
    '<div class="page-break"></div>',
    'a <span style="color:#ff375f">red</span> b',
    '> [!NOTE]\n> Body text',
    'Text <!-- comment: check this --> more.',
  ];
  async function fullRoundTrip(src) {
    const host = E._offscreen ? E._offscreen() : document.body.appendChild(document.createElement('div'));
    const ed = createWordEditor(); const d = (E.fakeDoc || (t => ({ text: t, setText(x) { this.text = x; } })))(src);
    try {
      ed.mount(host, d);
      for (let i = 0; i < 100 && !ed.page?.childNodes.length; i++) await new Promise(r => setTimeout(r, 20));
      await new Promise(r => setTimeout(r, 60));
      const kept = ed.serialize();
      ed._markAllDirty();
      const converted = ed.serialize();
      return { kept, converted };
    } finally { ed.unmount(); host.remove(); }
  }
  E._fullRoundTrip = fullRoundTrip;
  app.tests.register('editor: Word round-trip keeps sources (render → toMarkdown)', async () => {
    const fails = [];
    for (const src of ROUND_TRIP) {
      const { kept, converted } = await fullRoundTrip(src);
      if (kept !== src) fails.push(`untouched: ${JSON.stringify(src)} → ${JSON.stringify(kept)}`);
      if (converted.replace(/\n$/, '') !== src.replace(/\n$/, '')) fails.push(`converted: ${JSON.stringify(src)} → ${JSON.stringify(converted)}`);
    }
    app.assert(!fails.length, fails.join('\n'));
  });
  app.tests.register('editor: Word edit keeps other blocks verbatim', async () => {
    const host = E._offscreen(); const ed = createWordEditor();
    const src = '---\ntitle: T\n---\n\nIntro “typographic” text -- kept *as typed*.\n\nSecond para.\n\n[ref]: https://example.com\n';
    const d = E.fakeDoc(src);
    try {
      ed.mount(host, d);
      for (let i = 0; i < 100 && !ed.page?.childNodes.length; i++) await new Promise(r => setTimeout(r, 20));
      await new Promise(r => setTimeout(r, 60));
      const ps = ed.page.querySelectorAll('p'); const p2 = [...ps].find(p => /Second/.test(p.textContent));
      p2.firstChild.data = 'Second paragraph, edited.';
      await new Promise(r => setTimeout(r, 0));
      ed._commit();
      app.assert(d.text === '---\ntitle: T\n---\n\nIntro “typographic” text -- kept *as typed*.\n\nSecond paragraph, edited.\n\n[ref]: https://example.com\n', 'got ' + JSON.stringify(d.text));
    } finally { ed.unmount(); host.remove(); }
  });
  app.tests.register('editor: paste sanitizer keeps structure, drops Word styles', () => {
    const html = '<p class=MsoNormal style="margin:0"><span style="font-weight:bold;font-family:Calibri">Bold</span> and <i>it</i><o:p></o:p></p><table><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></table>';
    const out = E.sanitizePaste(html);
    app.assert(/<strong>Bold<\/strong>/.test(out) && !/Calibri|MsoNormal/.test(out) && /<thead><tr><th>A<\/th>/.test(out), out);
    const md = toMd(out);
    app.assert(/\*\*Bold\*\* and \*it\*/.test(md) && /\| A \| B \|/.test(md), md);
  });
})();
