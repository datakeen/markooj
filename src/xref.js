// Markooj — xref: ONE numbering system for equations, figures and tables, plus Word-like cross-references.
// Owns app.xref. Markdown syntax is Pandoc-crossref:  $$ … $$ {#eq:x}   ![Caption](a.png){#fig:x}   : Caption {#tbl:x}
// # Heading {#sec:x}   references @eq:x  [@fig:x]  [-@tbl:x] (number only)  [@eq:a; @eq:b].
// preload.js parses the labels (mk.xref.scan) and renders references as <span class="mk-xref" data-ref="…"> placeholders;
// this file numbers the items, fills the placeholders and adds the dialogs, hover cards and ribbon controls.
// KaTeX never draws numbers (\tag and its own equation counters are hidden), so each equation shows exactly one number.
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const mk = app.mk || window.mk || {};
  const X = mk.xref || null;
  const esc = app.esc || (s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const icon = (n, cls = '') => `<svg class="i${cls ? ' ' + cls : ''}"><use href="#${n}"/></svg>`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ATTR_SRC = X?.attrPattern || '\\{[ \\t]*(?:[#.][^\\s{}]+|-)(?:[ \\t]+(?:[#.][^\\s{}]+|-|[\\w-]+=(?:"[^"\\n]*"|[^\\s{}"]*)))*[ \\t]*\\}';
  const KINDS = ['eq', 'fig', 'tbl', 'sec'];
  const KIND_NAME = { eq: 'Equation', fig: 'Figure', tbl: 'Table', sec: 'Heading', fn: 'Footnote' };

  // ------------------------------------------------------------------ stylesheet + icons
  (function ensureAssets() {
    if (!document.querySelector('link[href$="xref.css"]')) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'xref.css'; l.dataset.mkXref = '1'; document.head.appendChild(l);
    }
    if (document.getElementById('mkx-icons')) return;
    const ICONS = {
      'mkx-caption': '<rect x="4" y="4" width="16" height="11" rx="2"/><path d="M7 19h10M8 12l3-3 2 2 3-3"/>',
      'mkx-label': '<path d="M3 12V4h8l9 9-8 8-9-9z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
      'mkx-hash': '<path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16"/>',
    };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'mkx-icons'; svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
    svg.innerHTML = '<defs>' + Object.entries(ICONS).map(([id, p]) => `<symbol id="${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</symbol>`).join('') + '</defs>';
    (document.body || document.documentElement).appendChild(svg);
  })();

  // ------------------------------------------------------------------ settings (app) + front matter "xref:" (document)
  const DEFAULTS = { style: 'plain', sep: '.', numberAll: false, eq: 'Eq.', fig: 'Fig.', tbl: 'Table', sec: 'Section' };
  const PREFIX_CHOICES = { eq: ['Eq.', 'Equation', 'Eqn.'], fig: ['Fig.', 'Figure'], tbl: ['Table', 'Tab.'], sec: ['Section', 'Sec.', '§'] };
  const activeDoc = () => { const d = app.docs.active(); return d && d.kind === 'markdown' ? d : null; };
  const first = v => (Array.isArray(v) ? v[0] : v);
  const bool = v => (typeof v === 'string' ? /^(true|yes|on|1)$/i.test(v.trim()) : !!v);
  function frontMeta(doc) {
    if (!doc) return {};
    if (doc.meta && typeof doc.meta === 'object' && doc.kind === 'markdown') return doc.meta; // core keeps doc.meta in step with the text
    try { return (mk.frontMatter ? mk.frontMatter.parse(doc.text || '').meta : {}) || {}; } catch { return {}; }
  }
  // what the document itself says (front matter "xref:" block, or pandoc-crossref's own keys)
  function docConfig(doc) {
    const m = frontMeta(doc), x = m.xref && typeof m.xref === 'object' ? m.xref : {};
    const o = {};
    const style = x.numbering ?? x.style ?? (x.chapters != null ? (bool(x.chapters) ? 'chapter' : 'plain') : m.chapters != null ? (bool(m.chapters) ? 'chapter' : 'plain') : undefined);
    if (style != null) o.style = /chap/i.test(String(style)) || style === true ? 'chapter' : 'plain';
    const sep = x.separator ?? x.sep ?? m.chapDelim;
    if (sep != null && /^[.\-–:]$/.test(String(sep).trim())) o.sep = String(sep).trim();
    const all = x.numberAll ?? x['number-all'] ?? x.numberall;
    if (all != null) o.numberAll = bool(all);
    for (const k of KINDS) {
      const v = x[k] ?? x[k + 'Prefix'] ?? m[{ eq: 'eqnPrefix', fig: 'figPrefix', tbl: 'tblPrefix', sec: 'secPrefix' }[k]];
      if (v != null && String(first(v)).trim()) o[k] = String(first(v)).trim();
    }
    return o;
  }
  function appConfig() {
    const p = app.settings.get('xrefPrefixes', {}) || {};
    const o = { style: app.settings.get('xrefStyle', DEFAULTS.style), sep: app.settings.get('xrefSeparator', DEFAULTS.sep), numberAll: !!app.settings.get('xrefNumberAll', DEFAULTS.numberAll) };
    for (const k of KINDS) if (p[k]) o[k] = p[k];
    return o;
  }
  function config(doc = activeDoc()) { return { ...DEFAULTS, ...appConfig(), ...docConfig(doc) }; }
  const hasDocConfig = doc => { const m = frontMeta(doc); return !!(m && m.xref && typeof m.xref === 'object'); };
  // patch: {style, sep, numberAll, eq, fig, tbl, sec}; where: 'app' | 'doc' | 'auto' (document when it already has an xref: block)
  function setConfig(patch, where = 'auto', doc = activeDoc()) {
    const toDoc = where === 'doc' || where === 'both' || (where === 'auto' && doc && hasDocConfig(doc));
    if (where !== 'doc') {
      if ('style' in patch) app.settings.set('xrefStyle', patch.style);
      if ('sep' in patch) app.settings.set('xrefSeparator', patch.sep);
      if ('numberAll' in patch) app.settings.set('xrefNumberAll', !!patch.numberAll);
      const pre = { ...(app.settings.get('xrefPrefixes', {}) || {}) }; let any = false;
      for (const k of KINDS) if (k in patch) { pre[k] = patch[k]; any = true; }
      if (any) app.settings.set('xrefPrefixes', pre);
    }
    if (toDoc && doc && mk.frontMatter) {
      const text = currentText(doc);
      const meta = { ...(mk.frontMatter.parse(text).meta || {}) };
      const x = { ...(meta.xref && typeof meta.xref === 'object' ? meta.xref : {}) };
      if ('style' in patch) { x.numbering = patch.style; delete x.style; delete x.chapters; }
      if ('sep' in patch) { x.separator = patch.sep; delete x.sep; }
      if ('numberAll' in patch) x.numberAll = !!patch.numberAll;
      for (const k of KINDS) if (k in patch) x[k] = patch[k];
      meta.xref = x;
      const next = mk.frontMatter.write(text, meta);
      if (next !== text) doc.setText(next, 'xref');
    }
    invalidate(); refreshActive(true);
    app.events.emit('xref:config', config(doc));
    app.events.emit('ribbon:changed');
  }

  // ------------------------------------------------------------------ model: numbers for every item, from the Markdown source
  const cache = new WeakMap();
  let cacheEpoch = 0;
  const invalidate = () => { cacheEpoch++; };
  function scanText(text) { try { return X ? X.scan(text) : { items: [], frontLines: 0 }; } catch (e) { console.error(e); return { items: [], frontLines: 0 }; } }
  const pluralize = p => (/\.$/.test(p) ? p.slice(0, -1) + 's.' : /s$/i.test(p) || p === '§' ? p : p + 's');
  const capFirst = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
  function build(text, cfg) {
    const sc = scanText(text);
    const items = sc.items.map((x, i) => ({ ...x, order: i }));
    const secs = items.filter(i => i.kind === 'sec');
    const h1 = secs.filter(s => s.level === 1);
    // a lone level-1 heading at the top is the document title; chapters are then the next level down
    // (not when the front matter already gives a title: then that H1 is the first chapter)
    let fmTitle = false; try { fmTitle = !!(mk.frontMatter && String(mk.frontMatter.parse(text).meta?.title || '').trim()); } catch {}
    const titleH = !fmTitle && h1.length === 1 && secs[0] === h1[0] && secs.length > 1 ? h1[0] : null;
    const body = secs.filter(s => s !== titleH);
    const chapterLevel = body.length ? Math.min(...body.map(s => s.level)) : 1;
    const chapters = cfg.style === 'chapter';
    const cnt = { eq: 0, fig: 0, tbl: 0 }; const sc2 = []; let fn = 0;
    const num = (kind) => { const n = ++cnt[kind]; return chapters ? `${sc2[0] || 0}${cfg.sep}${n}` : String(n); };
    for (const it of items) {
      if (it.kind === 'sec') {
        if (it === titleH || it.level < chapterLevel || it.unnumbered) { it.num = null; continue; }
        const d = it.level - chapterLevel;
        sc2.length = d + 1; for (let k = 0; k < d; k++) if (!sc2[k]) sc2[k] = 0;
        sc2[d] = (sc2[d] || 0) + 1;
        it.num = sc2.slice(0, d + 1).join('.');
        if (d === 0 && chapters) cnt.eq = cnt.fig = cnt.tbl = 0;
      } else if (it.kind === 'eq') {
        if (it.tag != null && it.tag !== '') { it.numbered = true; it.fixed = true; it.num = it.tag; }
        else { it.numbered = !it.unnumbered && !!(it.label || it.env || cfg.numberAll); it.num = it.numbered ? num('eq') : null; }
      } else if (it.kind === 'fig' || it.kind === 'tbl') {
        it.numbered = !!it.label; it.num = it.numbered ? num(it.kind) : null;
      } else if (it.kind === 'fn') { it.num = String(++fn); }
    }
    const byLabel = new Map(), dups = new Set();
    for (const it of items) {
      const l = it.kind === 'fn' ? 'fn:' + it.label : it.label;
      if (!l) continue;
      if (byLabel.has(l)) dups.add(l); else byLabel.set(l, it);
    }
    const of = k => items.filter(i => i.kind === k);
    return { items, byLabel, dups, eqs: of('eq'), figs: of('fig'), tbls: of('tbl'), secs, fns: of('fn'), chapterLevel, cfg, frontLines: sc.frontLines || 0, text };
  }
  function modelFor(doc, text) {
    const cfg = config(doc);
    const t = text ?? (doc ? doc.text || '' : '');
    const key = t + '\u0000' + JSON.stringify(cfg) + cacheEpoch;
    const hit = doc && cache.get(doc);
    if (hit && hit.key === key) return hit.model;
    const model = build(t, cfg);
    if (doc) cache.set(doc, { key, model });
    return model;
  }
  // "(1.2)" for equations, "1.2" for the rest
  function numText(it) {
    if (!it || it.num == null) return '';
    if (it.kind === 'eq') return it.tagStar ? it.num : `(${it.num})`;
    return it.num;
  }
  function fullLabel(it, cfg, cap) {
    if (!it) return '';
    if (it.kind === 'fn') return it.num;
    const p = cfg[it.kind] || '';
    const s = `${p}${p ? ' ' : ''}${numText(it)}`;
    return cap ? capFirst(s) : s;
  }
  const andList = a => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  // text for a reference with one or more keys; {broken:[keys]} when a key has no target (or no number)
  function refText(keys, opts = {}, model) {
    const cfg = model.cfg;
    const its = keys.map(k => model.byLabel.get(k));
    const broken = keys.filter((k, i) => !its[i] || its[i].num == null);
    if (broken.length) return { text: keys.map((k, i) => (its[i] && its[i].num != null ? (opts.suppress ? numText(its[i]) : fullLabel(its[i], cfg)) : k + '?')).join('; '), broken };
    if (opts.suppress) return { text: andList(its.map(numText)), broken };
    const kinds = new Set(its.map(i => i.kind));
    if (its.length > 1 && kinds.size === 1) {
      const p = cfg[its[0].kind] || '';
      const s = `${pluralize(p)} ${andList(its.map(numText))}`;
      return { text: opts.cap ? capFirst(s) : s, broken };
    }
    return { text: its.map(i => fullLabel(i, cfg, opts.cap)).join('; '), broken };
  }

  // ------------------------------------------------------------------ painting numbers into a rendered page
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  function uiSpan(cls, text) {
    const s = document.createElement('span');
    s.className = cls; s.setAttribute('data-mk-ui', ''); s.setAttribute('contenteditable', 'false');
    s.textContent = text; return s;
  }
  function setEqNumber(m, text, it) {
    let no = m.querySelector(':scope > .mk-eqno');
    if (!text) { if (no) no.remove(); m.classList.remove('mk-eqn'); return; }
    if (!no) { no = uiSpan('mk-eqno', text); m.appendChild(no); }
    else if (no.textContent !== text) no.textContent = text;
    no.setAttribute('aria-label', 'Equation ' + text.replace(/[()]/g, ''));
    no.title = (it && it.label ? `Equation ${text} · label ${it.label}` : `Equation ${text}`) + '. Double-click to change the label or numbering.';
    m.classList.add('mk-eqn');
  }
  function setPrefix(host, text, hasCaption) {
    if (!host) return;
    let p = host.querySelector(':scope > .mk-xnum');
    if (!text) { if (p) p.remove(); return; }
    const t = text + (hasCaption ? '. ' : '');
    if (!p) { p = uiSpan('mk-xnum', t); host.insertBefore(p, host.firstChild); }
    else if (p.textContent !== t) p.textContent = t;
  }
  const captionText = host => { const c = host.cloneNode(true); c.querySelectorAll('[data-mk-ui]').forEach(x => x.remove()); return c.textContent.trim(); };
  function apply(el, doc) {
    if (!el || !el.querySelectorAll) return;
    doc = doc || activeDoc();
    const model = modelFor(doc);
    const cfg = model.cfg;
    // ---- equations: labeled ones by label, the rest by their TeX in order
    const queue = new Map();
    for (const it of model.eqs) if (!it.label) { const k = norm(it.tex); if (!queue.has(k)) queue.set(k, []); queue.get(k).push(it); }
    let legacy = 0;
    for (const m of el.querySelectorAll('.mk-math.display')) {
      const holder = m.closest('.mk-math-block') || m;
      const label = holder.getAttribute('data-label') || m.getAttribute('data-label');
      let it = label ? model.byLabel.get(label) : null;
      if (it && it.kind !== 'eq') it = null;
      if (!it && !label) { const q = queue.get(norm(m.getAttribute('data-tex'))); it = q && q.length ? q.shift() : null; }
      const text = it && it.numbered ? numText(it) : '';
      setEqNumber(m, text, it);
      if (text) { holder.setAttribute('data-num', it.num); if (!holder.id) holder.id = 'eq-' + (++legacy); } else holder.removeAttribute('data-num');
    }
    // ---- figures (labeled pictures) and tables (labeled captions)
    for (const f of el.querySelectorAll('figure.mk-figure')) {
      const it = model.byLabel.get(f.getAttribute('data-label'));
      let fc = f.querySelector(':scope > figcaption');
      if (!fc) { fc = document.createElement('figcaption'); f.appendChild(fc); }
      const ok = it && it.kind === 'fig' && it.num != null;
      setPrefix(fc, ok ? `${cfg.fig} ${it.num}` : null, !!captionText(fc));
      if (ok) f.setAttribute('data-num', it.num); else f.removeAttribute('data-num');
    }
    for (const img of el.querySelectorAll('img[data-label]')) {
      const it = model.byLabel.get(img.getAttribute('data-label'));
      if (it && it.num != null) img.setAttribute('data-num', it.num); else img.removeAttribute('data-num');
    }
    for (const p of el.querySelectorAll('p.mk-tcaption')) {
      const id = p.getAttribute('data-for');
      const it = id ? model.byLabel.get(id) : null;
      const ok = it && it.kind === 'tbl' && it.num != null;
      setPrefix(p, ok ? `${cfg.tbl} ${it.num}` : null, !!captionText(p));
      const t = ok ? el.querySelector(`table[id="${CSS.escape(id)}"]`) : null;
      if (t) t.setAttribute('data-num', it.num);
    }
    // old documents linked to #fig-1 / #tbl-1: keep those anchors for unlabeled pictures and tables
    let f = 0; el.querySelectorAll('img').forEach(i => { if (!i.closest('.mk-front') && !i.id && !i.closest('figure[id]')) i.id = 'fig-' + (++f); });
    let t = 0; el.querySelectorAll('table').forEach(x => { if (!x.id) x.id = 'tbl-' + (++t); });
    for (const h of el.querySelectorAll('h1[data-label],h2[data-label],h3[data-label],h4[data-label],h5[data-label],h6[data-label]')) {
      const it = model.byLabel.get(h.getAttribute('data-label'));
      if (it && it.num) h.setAttribute('data-num', it.num); else h.removeAttribute('data-num');
    }
    // ---- references
    for (const x of el.querySelectorAll('.mk-xref')) {
      const keys = (x.getAttribute('data-ref') || '').split(';').filter(Boolean);
      const r = refText(keys, { suppress: x.getAttribute('data-suppress') === '1', cap: x.getAttribute('data-cap') === '1' }, model);
      if (x.textContent !== r.text) x.textContent = r.text;
      x.classList.toggle('mk-xref-broken', !!r.broken.length);
      x.setAttribute('role', 'link');
      x.setAttribute('aria-label', r.broken.length ? `Broken cross-reference to ${r.broken.join(', ')}` : `${r.text}, cross-reference`);
    }
    // ---- "above" / "below" links follow the target
    for (const a of el.querySelectorAll('a[href^="#"]')) {
      const w = a.textContent.trim();
      if (!/^(above|below)$/i.test(w)) continue;
      let target = null; try { target = el.querySelector(`[id="${CSS.escape(decodeURIComponent(a.getAttribute('href').slice(1)))}"]`); } catch {}
      if (!target) continue;
      const want = (a.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_PRECEDING) ? 'above' : 'below';
      if (w.toLowerCase() !== want) a.textContent = w[0] === w[0].toUpperCase() ? capFirst(want) : want;
    }
    // ---- exports: references become real links, numbers keep their layout without the app stylesheet
    if (el.classList && el.classList.contains('mk-export-stage')) {
      for (const x of el.querySelectorAll('.mk-xref')) {
        const keys = (x.getAttribute('data-ref') || '').split(';');
        if (x.classList.contains('mk-xref-broken') || !keys[0]) continue;
        const a = document.createElement('a'); a.href = '#' + keys[0]; a.className = 'mk-xref'; a.textContent = x.textContent; x.replaceWith(a);
      }
      if (!el.querySelector('style[data-mk-xref]')) { const s = document.createElement('style'); s.setAttribute('data-mk-xref', ''); s.textContent = EXPORT_CSS; el.prepend(s); }
    }
  }
  app.hooks.postRender((el, doc) => apply(el, doc));

  // the live page follows edits made in place (Word mode does not re-render on every keystroke)
  function surface() {
    const ed = app.editors.active();
    try { const s = ed?.getSurface?.() || ed?.surface || ed?.el; if (s instanceof Element && s.isConnected) return s; } catch {}
    return document.querySelector('.mk-word .mk-page') || document.querySelector('[data-mk-surface]') || document.querySelector('.mk-page:not(.mk-export-stage)');
  }
  function refreshActive(now) {
    const run = () => { const d = activeDoc(); const s = surface(); if (d && s) apply(s, d); };
    if (now) run(); else refreshLater();
  }
  const refreshLater = app.debounce(() => refreshActive(true), 220);
  app.events.on('doc:changed', e => { if (e && e.doc === app.docs.active()) refreshLater(); });
  app.events.on('settings:changed', e => { if (e && /^xref/.test(e.key || '')) { invalidate(); refreshActive(true); } });

  // ------------------------------------------------------------------ source editing (labels, captions, references)
  // the editor may hold typing it has not committed yet; only ask the editor that shows this very document
  const editorShows = (e, doc) => !!e && doc === app.docs.active() && (e.doc === undefined || e.doc === doc);
  function currentText(doc) {
    const e = app.editors.active();
    if (doc && editorShows(e, doc)) { try { e.flush?.(); const t = e.getText?.(); if (typeof t === 'string' && t !== doc.text) doc.setText(t, 'editor'); } catch {} }
    return doc ? doc.text || '' : '';
  }
  const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ATTR_AT_END = new RegExp('[ \\t]*(' + ATTR_SRC + ')[ \\t]*$');
  const ATTR_AT_START = new RegExp('^[ \\t]*(' + ATTR_SRC + ')');
  const parseAttrs = raw => (X?.parseAttrs ? X.parseAttrs(raw) : { id: (/#([^\s{}]+)/.exec(raw || '') || [])[1] || null, classes: [], kv: [], unnumbered: /(^|\s)-(\s|\})/.test(raw || ''), raw });
  const buildAttrs = (id, prev, unnum) => (X?.buildAttrs ? X.buildAttrs(id, prev, unnum) : (id || unnum ? `{${[id ? '#' + id : '', unnum ? '-' : ''].filter(Boolean).join(' ')}}` : ''));
  // fenced code and inline code ranges (labels and references inside code are left alone)
  function codeRanges(text) {
    const out = []; let pos = 0, open = null;
    for (const ln of text.split('\n')) {
      const s = pos; pos += ln.length + 1;
      const f = /^ {0,3}(`{3,}|~{3,})/.exec(ln);
      if (open) { if (f && f[1][0] === open.ch && f[1].length >= open.len) { out.push([open.start, pos]); open = null; } continue; }
      if (f) open = { ch: f[1][0], len: f[1].length, start: s };
    }
    if (open) out.push([open.start, text.length]);
    const re = /(`+)(?!`)[^\n]*?[^`\n]?\1(?!`)/g; let m;
    while ((m = re.exec(text))) if (!out.some(r => m.index >= r[0] && m.index < r[1])) out.push([m.index, m.index + m[0].length]);
    return out;
  }
  const inCode = (ranges, i) => ranges.some(r => i >= r[0] && i < r[1]);
  const STOP = new Set('a an the of and or for to in on at by with from into over under is are be as vs per its their this that these those using via'.split(' '));
  function slugWords(s, n = 3) {
    return String(s || '').toLowerCase().replace(/\$[^$]*\$/g, ' ').replace(/\[[^\]]*\]\([^)]*\)/g, ' ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/).filter(w => w && !STOP.has(w)).slice(0, n).join('-');
  }
  const TEX_SKIP = new Set('frac dfrac tfrac left right mathrm mathbf mathit mathcal mathsf text operatorname begin end label tag quad qquad cdot times sum int prod lim limits displaystyle big Big bigg Bigg hat bar vec dot ddot tilde overline underline sqrt partial nabla mathbb boldsymbol bm'.split(' '));
  function eqWords(tex) {
    const lhs = String(tex || '').replace(/\\begin\{[^}]*\}|\\end\{[^}]*\}|\\label\{[^}]*\}|\\tag\*?\{[^}]*\}/g, ' ').split(/=|\\approx|\\equiv|\\leq?|\\geq?|<|>|\\propto|\\sim/)[0];
    const toks = (lhs.match(/\\[A-Za-z]+|[A-Za-z]+|\d+/g) || []).map(t => t.replace(/^\\/, '')).filter(t => !TEX_SKIP.has(t));
    return toks.slice(0, 3).join('-').toLowerCase().slice(0, 28).replace(/-+$/, '');
  }
  function suggestLabel(kind, it, taken) {
    let base = kind === 'eq' ? eqWords(it && it.tex) : slugWords(it && (it.caption || it.text));
    if (!base) base = kind === 'eq' ? 'eq' : kind === 'fig' ? 'figure' : kind === 'tbl' ? 'table' : 'section';
    base = base.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || kind;
    let label = `${kind}:${base}`, n = 2;
    while (taken && taken.has(label)) label = `${kind}:${base}-${n++}`;
    return label;
  }
  const validLabel = (kind, l) => new RegExp('^' + kind + ':[\\w.:-]*\\w$').test(l);

  function lineStarts(text) { const a = [0]; for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) a.push(i + 1); return a; }
  // Rewrites the label (and caption / numbered state) of one item in the Markdown. Returns the new text or null.
  function rewriteItem(text, it, { label, caption, numbered, position, cfg } = {}) {
    const lines = text.split('\n');
    const keepId = label === undefined ? it.label : label;
    if (it.kind === 'eq') {
      cfg = cfg || DEFAULTS;
      // numbered:false → no label, and "{-}" when it would be numbered anyway (Number all, or an equation environment)
      let id = keepId || null, unnum;
      if (numbered === false) { id = null; unnum = !!(it.env || cfg.numberAll); }
      else if (numbered === true) unnum = false;
      else unnum = !!(it.attrs && parseAttrs(it.attrs).unnumbered);
      if (it.labelFrom === 'tex' && it.block) {
        // \label{…} inside the TeX: edit it there
        for (let i = it.line; i <= it.endLine; i++) {
          if (/\\label\s*\{[^{}]*\}/.test(lines[i])) { lines[i] = id ? lines[i].replace(/\\label\s*\{[^{}]*\}/, `\\label{${id}}`) : lines[i].replace(/[ \t]*\\label\s*\{[^{}]*\}/, ''); break; }
        }
        const i = it.endLine; const m = ATTR_AT_END.exec(lines[i]); const base = (m ? lines[i].slice(0, m.index) : lines[i]).replace(/[ \t]+$/, '');
        const a = buildAttrs(null, m ? m[1] : null, unnum);
        lines[i] = base + (a ? ' ' + a : '');
        return lines.join('\n');
      }
      const attrs = buildAttrs(id, it.attrs, unnum);
      if (it.block) {
        const i = it.endLine;
        const m = ATTR_AT_END.exec(lines[i]);
        const base = (m ? lines[i].slice(0, m.index) : lines[i]).replace(/[ \t]+$/, '');
        lines[i] = base + (attrs ? ' ' + attrs : '');
        return lines.join('\n');
      }
      // display math inside a paragraph: find the n-th one on these lines
      const st = lineStarts(text), a = st[it.line], b = it.endLine + 1 < st.length ? st[it.endLine + 1] : text.length;
      const seg = text.slice(a, b);
      const re = new RegExp('(\\$\\$[\\s\\S]+?\\$\\$|\\\\\\[[\\s\\S]+?\\\\\\])((?:[ \\t]*' + ATTR_SRC + ')?)', 'g');
      const same = it.sameLineIndex || 0; let k = 0, m, out = null;
      while ((m = re.exec(seg))) {
        if (k++ !== same) continue;
        out = seg.slice(0, m.index) + m[1] + (attrs ? ' ' + attrs : '') + seg.slice(m.index + m[0].length);
        break;
      }
      return out == null ? null : text.slice(0, a) + out + text.slice(b);
    }
    if (it.kind === 'fig') {
      const st = lineStarts(text), a = st[it.line], b = it.endLine + 1 < st.length ? st[it.endLine + 1] : text.length;
      const seg = text.slice(a, b);
      const re = new RegExp('!\\[((?:[^\\[\\]\\n]|\\[[^\\]\\n]*\\])*)\\]\\(((?:[^()\\s]|\\([^()]*\\)|<[^>\\n]*>)*(?:\\s+"[^"\\n]*")?)\\)((?:' + ATTR_SRC + ')?)', 'g');
      let k = 0, m;
      while ((m = re.exec(seg))) {
        if (k++ !== (it.index || 0)) continue;
        const cap = caption != null ? caption.replace(/\n+/g, ' ').replace(/([[\]])/g, '\\$1') : m[1];
        const attrs = buildAttrs(keepId, m[3] || null, false);
        const img = `![${cap}](${m[2]})${attrs}`;
        const before = seg.slice(0, m.index), after = seg.slice(m.index + m[0].length);
        // a captioned figure needs the picture on its own line
        if (keepId && (before.trim() || after.trim())) {
          const rest = (before.replace(/[ \t]+$/, '') + (before.trim() && after.trim() ? ' ' : '') + after.replace(/^[ \t]+/, '')).replace(/\n$/, '');
          const tail = /\n$/.test(seg) ? '\n' : '';
          return text.slice(0, a) + (rest.trim() ? rest + '\n\n' : '') + img + tail + text.slice(b);
        }
        return text.slice(0, a) + before + img + after + text.slice(b);
      }
      return null;
    }
    if (it.kind === 'tbl') {
      const cap = caption != null ? caption.replace(/\n+/g, ' ').trim() : (it.caption || '');
      const attrs = keepId ? buildAttrs(keepId, it.attrs, false) : (it.attrs ? buildAttrs(null, it.attrs, false) : '');
      if (it.captionLine != null) {
        const i = it.captionLine;
        const pre = (/^\s*(Table:|table:|:)/.exec(lines[i]) || [, ':'])[1];
        if (!cap && !keepId) { lines.splice(i, 1); if (lines[i] === '' && (lines[i - 1] === '' || i === 0)) lines.splice(i, 1); return lines.join('\n'); }
        lines[i] = `${pre} ${cap || 'Caption'}${attrs ? ' ' + attrs : ''}`;
        return lines.join('\n');
      }
      const capLine = (position === 'above' ? 'Table: ' : ': ') + (cap || 'Caption') + (attrs ? ' ' + attrs : '');
      if (position === 'above') {
        lines.splice(it.line, 0, capLine, '');
        if (it.line > 0 && lines[it.line - 1].trim()) lines.splice(it.line, 0, '');
      } else {
        const at = it.endLine + 1;
        const add = ['', capLine]; if (lines[at] !== undefined && lines[at].trim()) add.push('');
        lines.splice(at, 0, ...add);
      }
      return lines.join('\n');
    }
    if (it.kind === 'sec') {
      const i = it.line;
      const m = ATTR_AT_END.exec(lines[i]);
      const base = (m ? lines[i].slice(0, m.index) : lines[i]).replace(/[ \t]+#+[ \t]*$/, '').replace(/[ \t]+$/, '');
      const attrs = buildAttrs(keepId, m ? m[1] : it.attrs, !!it.unnumbered);
      lines[i] = base + (attrs ? ' ' + attrs : '');
      return lines.join('\n');
    }
    return null;
  }
  // Renames every reference to `from` (in @refs and #links). Code is left alone.
  function renameRefs(text, from, to) {
    if (!from || from === to) return text;
    const code = codeRanges(text);
    const kind = from.split(':')[0];
    let out = text.replace(new RegExp('(-?@)(' + escRe(kind) + '|' + escRe(capFirst(kind)) + '):([\\w.:-]*\\w)', 'g'), (m, at, k, rest, off) => {
      if (inCode(code, off) || `${kind}:${rest}` !== from) return m;
      const nk = to.split(':')[0]; return at + (k === capFirst(kind) ? capFirst(nk) : nk) + to.slice(nk.length);
    });
    out = out.replace(new RegExp('\\]\\(#' + escRe(from) + '\\)', 'g'), (m, off) => (inCode(code, off) ? m : `](#${to})`));
    return out;
  }
  function findItem(model, ref) {
    if (!ref) return null;
    if (typeof ref === 'string') return model.byLabel.get(ref) || null;
    return model.items.find(i => i.kind === ref.kind && i.line === ref.line && (ref.index == null || (i.index || 0) === ref.index) && (ref.sameLineIndex == null || (i.sameLineIndex || 0) === ref.sameLineIndex)) || null;
  }
  function decorateModel(model) {
    // nth display equation on its line (for equations inside paragraphs)
    const seen = new Map();
    for (const it of model.eqs) if (!it.block) { const k = it.line; it.sameLineIndex = seen.get(k) || 0; seen.set(k, it.sameLineIndex + 1); }
    return model;
  }

  /** Change the label, caption or numbered state of an item; updates the Markdown, every reference, and the numbers.
   * opts: {element | label | item, kind?, label (new, '' removes), caption, numbered, position:'above'|'below', doc} → {label} or null */
  async function setLabel(opts = {}) {
    const doc = opts.doc || activeDoc(); if (!doc) return null;
    let text = currentText(doc);
    let model = decorateModel(build(text, config(doc)));
    let it = opts.item ? findItem(model, opts.item) || findItem(model, opts.item.label) : null;
    if (!it && opts.element) it = itemForElement(opts.element, model);
    if (!it && opts.from) it = model.byLabel.get(opts.from);
    if (!it) { app.ui.toast('Markooj could not find that item in the document.', { kind: 'warn' }); return null; }
    const kind = it.kind;
    const taken = new Set(model.byLabel.keys());
    let label = opts.label === undefined ? it.label : (opts.label || '').trim();
    if (label && !label.includes(':')) label = `${kind}:${label}`;
    if (label && label !== it.label && taken.has(label)) { app.ui.toast(`The label ${label} is already used. Pick another one.`, { kind: 'warn' }); return null; }
    if (label && !validLabel(kind, label)) { app.ui.toast(`Labels start with ${kind}: and use letters, digits, - . or _ (for example ${kind}:flume).`, { kind: 'warn' }); return null; }
    if (opts.numbered === true && !label && !(kind === 'eq' && (it.env || model.cfg.numberAll))) label = suggestLabel(kind, it, taken);
    if (opts.numbered === false && kind !== 'eq') label = '';
    if ((kind === 'fig' || kind === 'tbl') && opts.caption != null && !label && opts.numbered !== false) label = suggestLabel(kind, { ...it, caption: opts.caption }, taken);
    let next = rewriteItem(text, it, { label, caption: opts.caption, numbered: opts.numbered, position: opts.position, cfg: model.cfg });
    if (next == null) { app.ui.toast('That item could not be changed in the Markdown.', { kind: 'warn' }); return null; }
    if (it.label && label && it.label !== label) next = renameRefs(next, it.label, label);
    if (next !== text) doc.setText(next, 'xref');
    invalidate();
    app.events.emit('xref:changed', { doc, kind, from: it.label, label });
    return { label: label || null, kind };
  }

  // DOM element on a page → its item in the model
  function itemForElement(el, model) {
    if (!el || !model) return null;
    const e = el.nodeType === 1 ? el : el.parentElement;
    const root = e.closest('.mk-page, [data-mk-surface], .mk-export-stage') || document;
    const lineOf = n => { const b = n.closest('[data-line]'); return b ? +b.getAttribute('data-line') + model.frontLines : null; };
    const math = e.closest('.mk-math.display') || e.querySelector?.('.mk-math.display') || (e.closest('.mk-math-block') && e.closest('.mk-math-block').querySelector('.mk-math.display'));
    if (math) {
      const holder = math.closest('.mk-math-block') || math;
      const label = holder.getAttribute('data-label') || math.getAttribute('data-label');
      if (label && model.byLabel.get(label)?.kind === 'eq') return model.byLabel.get(label);
      const ln = lineOf(holder), tex = norm(math.getAttribute('data-tex'));
      const all = [...root.querySelectorAll('.mk-math.display')];
      const byLine = model.eqs.filter(i => ln != null && i.line <= ln + 0 && i.endLine >= ln && norm(i.tex) === tex);
      if (byLine.length === 1) return byLine[0];
      const same = all.filter(x => norm(x.getAttribute('data-tex')) === tex); const k = same.indexOf(math);
      return model.eqs.filter(i => norm(i.tex) === tex)[k] || model.eqs[all.indexOf(math)] || null;
    }
    const cap = e.closest('p.mk-tcaption');
    let table = e.closest('table');
    if (!table && cap) { const id = cap.getAttribute('data-for'); table = (id && root.querySelector(`table[id="${CSS.escape(id)}"]`)) || (cap.getAttribute('data-pos') === 'before' ? cap.nextElementSibling : cap.previousElementSibling); if (table && table.tagName !== 'TABLE') table = null; }
    if (table) {
      const label = table.getAttribute('data-label'); if (label && model.byLabel.get(label)) return model.byLabel.get(label);
      const ln = lineOf(table); const hit = model.tbls.find(i => i.line === ln); if (hit) return hit;
      return model.tbls[[...root.querySelectorAll('table')].indexOf(table)] || null;
    }
    const fig = e.closest('figure.mk-figure');
    const img = fig ? fig.querySelector('img') : (e.tagName === 'IMG' ? e : e.querySelector?.(':scope > img'));
    if (img) {
      const label = (fig || img).getAttribute('data-label'); if (label && model.byLabel.get(label)) return model.byLabel.get(label);
      const ln = lineOf(img); const p = img.closest('[data-line]');
      const idx = p ? [...p.querySelectorAll('img')].indexOf(img) : 0;
      const hit = model.figs.find(i => i.line === ln && (i.index || 0) === idx); if (hit) return hit;
      return model.figs[[...root.querySelectorAll('img')].filter(x => !x.closest('.mk-front')).indexOf(img)] || null;
    }
    const h = e.closest('h1,h2,h3,h4,h5,h6');
    if (h && !h.classList.contains('mk-title') && !h.closest('.mk-front,.mk-bibliography,section.footnotes')) {
      const label = h.getAttribute('data-label'); if (label && model.byLabel.get(label)) return model.byLabel.get(label);
      const ln = lineOf(h); const hit = model.secs.find(i => i.line === ln); if (hit) return hit;
      const hs = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(x => !x.classList.contains('mk-title') && !x.closest('.mk-front,.mk-bibliography,section.footnotes'));
      return model.secs[hs.indexOf(h)] || null;
    }
    return null;
  }

  // ------------------------------------------------------------------ Markdown snippets
  /** Markdown for an equation with its label: equationMarkdown('E=mc^2', {display:true, label:'eq:energy', numbered:true}) */
  function equationMarkdown(tex, o = {}) {
    tex = String(tex || '').trim();
    if (!o.display) { const d = app.settings.get('inlineMath', 'd') === 'paren' ? ['\\(', '\\)'] : ['$', '$']; return d[0] + tex + d[1]; }
    let label = (o.label || '').trim(); if (label && !label.includes(':')) label = 'eq:' + label;
    const cfg = config(o.doc);
    let attrs = '';
    if (label && o.numbered !== false) attrs = ` {#${label}}`;
    else if (o.numbered === false && cfg.numberAll) attrs = ' {-}';
    else if (o.numbered && !label) {
      const taken = new Set(modelFor(o.doc || activeDoc()).byLabel.keys());
      attrs = ` {#${suggestLabel('eq', { tex }, taken)}}`;
    }
    return `\n\n$$\n${tex}\n$$${attrs}\n\n`;
  }
  // a reference in Markdown. mode: 'full' | 'number' | 'text' | 'aboveBelow' | 'fn'
  function referenceMarkdown(it, mode, o = {}) {
    if (!it) return '';
    if (it.kind === 'fn') return mode === 'aboveBelow' ? (o.hyperlink !== false ? `[${o.where || 'above'}](#fn${it.num})` : (o.where || 'above')) : `[^${it.label}]`;
    const label = it.label;
    if (mode === 'number') return `[-@${label}]`;
    if (mode === 'text') { const t = (it.kind === 'sec' ? it.text : it.caption) || label; return o.hyperlink !== false ? `[${t.replace(/([[\]])/g, '\\$1')}](#${label || it.id})` : t; }
    if (mode === 'aboveBelow') return o.hyperlink !== false ? `[${o.where || 'above'}](#${label || it.id})` : (o.where || 'above');
    return '@' + label;
  }

  // ------------------------------------------------------------------ targets for the dialogs
  function targets(text, doc) {
    const model = decorateModel(build(text ?? currentText(doc || activeDoc()), config(doc || activeDoc())));
    return model.items.map(i => {
      const display = i.kind === 'fn' ? `Footnote ${i.num}` : i.num != null ? fullLabel(i, model.cfg) : (i.kind === 'sec' ? i.text : `${KIND_NAME[i.kind]} (no number yet)`);
      return { ...i, kindLabel: KIND_NAME[i.kind], display, text: i.kind === 'eq' ? (i.tex || '').replace(/\s+/g, ' ').trim() : (i.caption ?? i.text ?? ''), md: i.label ? referenceMarkdown(i, i.kind === 'sec' ? 'text' : 'full') : '' };
    });
  }

  // ------------------------------------------------------------------ Markdown for Pandoc exports (no pandoc-crossref needed)
  /** Resolves numbers into plain Markdown: references become "[Fig. 1](#fig:x)", captions get their number,
   * equations get "\qquad (1)" (or \tag{1} with {format:'latex'}). Labels stay as ids so links still work. */
  function exportMarkdown(text, doc, o = {}) {
    text = String(text ?? (doc ? doc.text : ''));
    const model = decorateModel(build(text, config(doc)));
    const cfg = model.cfg;
    const lines = text.split('\n');
    const latex = /latex|tex/i.test(o.format || '');
    // table captions first (line numbers are still those of the scan)
    for (const it of model.tbls) if (it.num != null && it.captionLine != null && lines[it.captionLine] != null) lines[it.captionLine] = lines[it.captionLine].replace(/^(\s*(?:Table:|table:|:)\s+)/, `$1${cfg.tbl} ${it.num}. `);
    // equations (block): put the number inside the math, drop the attribute block
    for (const it of [...model.eqs].reverse()) {
      if (!it.block) continue;
      const end = it.endLine; const m = ATTR_AT_END.exec(lines[end]); if (m) lines[end] = lines[end].slice(0, m.index);
      for (let i = it.line; i <= end; i++) lines[i] = lines[i].replace(/\\label\s*\{[^{}]*\}/g, '');
      if (!it.numbered || it.num == null) continue;
      const tag = latex ? `\\tag{${it.num}}` : `\\qquad (${it.num})`;
      if (it.fixed) continue; // \tag{…} already in the TeX
      if (it.env) { const k = lines.slice(it.line, end + 1).findIndex(l => /\\end\{/.test(l)); if (k >= 0) { const i = it.line + k; lines[i] = lines[i].replace(/\\end\{/, ` ${tag}\n\\end{`); } continue; }
      const i = end; const c = /(\$\$|\\\])\s*$/.exec(lines[i]); if (c) lines[i] = lines[i].slice(0, c.index) + ` ${tag}` + (i === it.line ? ' ' : '\n') + c[1];
    }
    let out = lines.join('\n');
    // inline display equations with attributes
    out = out.replace(new RegExp('(\\$\\$[^\\n$]+?\\$\\$)[ \\t]*(' + ATTR_SRC + ')', 'g'), (m, math, attrs) => {
      const id = parseAttrs(attrs).id; const it = id && model.byLabel.get(id);
      return it && it.num != null ? math.replace(/\$\$$/, ` \\qquad (${it.num})$$`) : math;
    });
    // figure captions
    out = out.replace(new RegExp('!\\[((?:[^\\[\\]\\n]|\\[[^\\]\\n]*\\])*)\\]\\(([^)\\n]*)\\)(' + ATTR_SRC + ')', 'g'), (m, cap, src, attrs) => {
      const id = parseAttrs(attrs).id; const it = id && model.byLabel.get(id);
      return it && it.num != null ? `![${cfg.fig} ${it.num}. ${cap}](${src})${attrs}` : m;
    });
    // references
    const code = codeRanges(out);
    const refRe = /\[((?:-?@(?:eq|fig|tbl|sec|Eq|Fig|Tbl|Sec):[\w.:-]*\w\s*[;,]?\s*)+)\]|(^|[^\w@.\-\]])@((?:eq|fig|tbl|sec|Eq|Fig|Tbl|Sec):[\w.:-]*\w)/g;
    out = out.replace(refRe, (m, group, pre, bare, off) => {
      if (inCode(code, off)) return m;
      const raw = group != null ? group : '@' + bare;
      const keys = (raw.match(/-?@[\w.:-]*\w/g) || []).map(k => k.replace(/^-?@/, ''));
      const lower = keys.map(k => k.replace(/^[A-Z][a-z]+(?=:)/, x => x.toLowerCase()));
      const r = refText(lower, { suppress: /-@/.test(raw), cap: keys.some(k => /^[A-Z]/.test(k)) }, model);
      const txt = r.broken.length ? '??' : r.text;
      const link = r.broken.length ? txt : `[${txt}](#${lower[0]})`;
      return (group != null ? '' : pre) + link;
    });
    return out;
  }

  // ------------------------------------------------------------------ jumping and hover cards
  const rootOf = el => (el && el.closest && el.closest('.mk-page, [data-mk-surface], .mk-export-stage')) || document;
  function targetEl(label, root = surface() || document) {
    if (!label) return null;
    try { return root.querySelector(`[id="${CSS.escape(label)}"]`) || document.querySelector(`.mk-page [id="${CSS.escape(label)}"]`); } catch { return null; }
  }
  function flash(el) { if (!el) return; el.classList.remove('mkx-flash'); void el.offsetWidth; el.classList.add('mkx-flash'); setTimeout(() => el.classList.remove('mkx-flash'), 1400); }
  /** Scrolls to the item with this label (and its source line in Simple mode). */
  function jump(label, root) {
    const t = targetEl(label, root);
    const doc = activeDoc();
    const it = doc && modelFor(doc).byLabel.get(label);
    if (!t && !it) { app.ui.toast(`Nothing in this document is labeled ${label}.`, { kind: 'warn' }); return false; }
    if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); flash(t.closest('.mk-math-block') || t); }
    if (it && it.line != null && app.mode === 'simple') { try { app.editors.active()?.scrollToLine?.(it.line); } catch {} }
    return true;
  }
  let card = null, cardFor = null, showTimer = 0, hideTimer = 0;
  function hideCard(now) {
    clearTimeout(showTimer); clearTimeout(hideTimer);
    const go = () => { if (card) { card.classList.remove('show'); card.setAttribute('aria-hidden', 'true'); } cardFor = null; };
    if (now) go(); else hideTimer = setTimeout(go, 180);
  }
  function previewOf(t, it) {
    const box = document.createElement('div'); box.className = 'mkx-card-pv';
    if (!t) return null;
    if (it && it.kind === 'eq') {
      const k = t.querySelector('.katex-display') || t.querySelector('.katex'); if (k) box.appendChild(k.cloneNode(true));
    } else if (it && it.kind === 'fig') {
      const img = (t.tagName === 'IMG' ? t : t.querySelector('img'))?.cloneNode(true); if (img) { img.removeAttribute('id'); box.appendChild(img); }
    } else if (it && it.kind === 'tbl') {
      const tb = t.cloneNode(true); tb.removeAttribute('id'); [...tb.querySelectorAll('tbody tr')].slice(3).forEach(r => r.remove()); box.appendChild(tb); box.classList.add('tbl');
    } else if (it && it.kind === 'sec') {
      let n = t.nextElementSibling; while (n && !/^(P|UL|OL|BLOCKQUOTE)$/.test(n.tagName) && !/^H\d$/.test(n.tagName)) n = n.nextElementSibling;
      if (n && !/^H\d$/.test(n.tagName)) { const p = document.createElement('p'); p.textContent = n.textContent.trim().slice(0, 220) + (n.textContent.trim().length > 220 ? '…' : ''); box.appendChild(p); }
    }
    box.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
    box.querySelectorAll('[contenteditable]').forEach(x => x.removeAttribute('contenteditable'));
    return box.childNodes.length ? box : null;
  }
  function editDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function suggestions(label, model) {
    const kind = label.split(':')[0];
    return [...model.byLabel.values()].filter(i => i.kind === kind && i.label && i.num != null)
      .map(i => ({ it: i, d: editDistance(label.toLowerCase(), i.label.toLowerCase()) }))
      .sort((a, b) => a.d - b.d).slice(0, 3).map(x => x.it);
  }
  function showCard(ref) {
    const doc = activeDoc(); if (!doc) return;
    const model = modelFor(doc);
    const keys = ref.classList.contains('mk-xref') ? (ref.getAttribute('data-ref') || '').split(';').filter(Boolean) : [decodeURIComponent((ref.getAttribute('href') || '').slice(1))];
    if (!keys.length) return;
    if (!card) {
      card = document.createElement('div'); card.className = 'mkx-card'; card.setAttribute('role', 'tooltip'); card.id = 'mkx-card';
      card.addEventListener('mouseenter', () => clearTimeout(hideTimer));
      card.addEventListener('mouseleave', () => hideCard());
      card.addEventListener('click', e => {
        const b = e.target.closest('[data-fix]'); if (b) { e.preventDefault(); fixReference(b.getAttribute('data-from'), b.getAttribute('data-fix')); hideCard(true); return; }
        const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); jump(g.getAttribute('data-go'), rootOf(cardFor)); hideCard(true); }
      });
      document.body.appendChild(card);
    }
    const root = rootOf(ref);
    let html = '';
    for (const k of keys.slice(0, 3)) {
      const it = model.byLabel.get(k);
      if (!it || it.num == null) {
        const kind = KIND_NAME[k.split(':')[0]] || 'item';
        const sug = suggestions(k, model);
        html += `<div class="mkx-card-sec broken"><div class="mkx-card-h"><span class="mkx-badge bad">${icon('warn')}Not found</span><code>${esc(k)}</code></div>
          <p>${it ? `This ${kind.toLowerCase()} has no number yet. Give it a label in References → Insert Caption.` : `No ${kind.toLowerCase()} in this document is labeled <b>${esc(k)}</b>.`}</p>
          ${sug.length ? `<div class="mkx-card-fix">${sug.map(s => `<button type="button" class="mkx-chip" data-from="${esc(k)}" data-fix="${esc(s.label)}">Use ${esc(fullLabel(s, model.cfg))} <code>${esc(s.label)}</code></button>`).join('')}</div>` : ''}</div>`;
        continue;
      }
      const t = targetEl(k, root);
      const sub = it.kind === 'eq' ? '' : esc((it.kind === 'sec' ? it.text : it.caption) || '');
      html += `<div class="mkx-card-sec"><div class="mkx-card-h"><span class="mkx-badge">${esc(KIND_NAME[it.kind])}</span><b>${esc(fullLabel(it, model.cfg))}</b><code>${esc(k)}</code></div>${sub ? `<p class="mkx-card-cap">${sub}</p>` : ''}<div class="mkx-slot"></div></div>`;
      void t;
    }
    const goable = keys.find(k => model.byLabel.get(k)?.num != null);
    html += `<div class="mkx-card-foot">${goable ? `<button type="button" class="mkx-link" data-go="${esc(goable)}">Go there</button><span>${navigator.platform && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl'}+click the reference to jump</span>` : '<span>Fix the label, or pick one above.</span>'}</div>`;
    card.innerHTML = html;
    // previews (cloned from the page)
    const slots = card.querySelectorAll('.mkx-slot'); let si = 0;
    for (const k of keys.slice(0, 3)) { const it = model.byLabel.get(k); if (!it || it.num == null) continue; const pv = previewOf(targetEl(k, root), it); const slot = slots[si++]; if (slot && pv) slot.replaceWith(pv); else slot?.remove(); }
    cardFor = ref;
    placeCard(ref);
    card.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => card.classList.add('show'));
  }
  function placeCard(ref) {
    const r = ref.getBoundingClientRect();
    card.style.left = '0px'; card.style.top = '0px'; card.classList.remove('up');
    const w = card.offsetWidth, h = card.offsetHeight;
    let left = Math.max(10, Math.min(innerWidth - w - 10, r.left + r.width / 2 - w / 2));
    let top = r.bottom + 10;
    if (top + h > innerHeight - 10 && r.top - h - 10 > 10) { top = r.top - h - 10; card.classList.add('up'); }
    card.style.left = left + 'px'; card.style.top = top + 'px';
    card.style.setProperty('--ax', Math.max(14, Math.min(w - 14, r.left + r.width / 2 - left)) + 'px');
  }
  const isRefLink = a => { const h = a.getAttribute('href') || ''; return /^#(eq|fig|tbl|sec):/.test(h) && !!a.closest('.mk-page, [data-mk-surface]'); };
  document.addEventListener('mouseover', e => {
    const t = e.target.closest && e.target.closest('.mk-xref, a[href^="#"]');
    if (!t || (t.tagName === 'A' && !isRefLink(t)) || (card && card.contains(t))) return;
    if (t === cardFor) { clearTimeout(hideTimer); return; }
    clearTimeout(showTimer); clearTimeout(hideTimer);
    showTimer = setTimeout(() => { if (t.isConnected) showCard(t); }, card && card.classList.contains('show') ? 60 : 380);
  });
  document.addEventListener('mouseout', e => {
    const t = e.target.closest && e.target.closest('.mk-xref, a[href^="#"]');
    if (!t) return;
    if (e.relatedTarget && (t.contains(e.relatedTarget) || (card && card.contains(e.relatedTarget)))) return;
    clearTimeout(showTimer); hideCard();
  });
  document.addEventListener('scroll', () => { if (cardFor) hideCard(true); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && card?.classList.contains('show')) hideCard(true); }, true);
  // Ctrl+click jumps; in read-only pages a plain click jumps
  document.addEventListener('click', e => {
    const x = e.target.closest && e.target.closest('.mk-xref');
    if (!x) return;
    const editable = !!x.closest('[contenteditable="true"]');
    if (!(e.ctrlKey || e.metaKey) && editable) return;
    e.preventDefault(); e.stopPropagation();
    hideCard(true);
    const key = (x.getAttribute('data-ref') || (x.getAttribute('href') || '').slice(1)).split(';')[0];
    jump(key, rootOf(x));
  }, true);
  // double-click an equation number (or a caption number) → Caption dialog for that item: label, numbered on/off
  document.addEventListener('dblclick', e => {
    const n = e.target.closest && e.target.closest('.mk-eqno, .mk-xnum');
    if (!n || !activeDoc() || !n.closest('.mk-page, [data-mk-surface]') || n.closest('.mk-export-stage')) return;
    e.preventDefault(); e.stopPropagation();
    captionDialog({ element: n.closest('.mk-math, figure, p.mk-tcaption') || n });
  }, true);
  /** Replaces every reference to `from` with `to` (the fix button on a broken reference). */
  function fixReference(from, to) {
    const doc = activeDoc(); if (!doc || !from || !to) return;
    const text = currentText(doc);
    const next = renameRefs(text, from, to);
    if (next !== text) { doc.setText(next, 'xref'); app.ui.toast(`References to ${from} now point to ${to}`); }
  }

  // ------------------------------------------------------------------ caret and selection helpers
  const ed = () => app.editors.active();
  function caretInfo(doc) {
    // Word mode: DOM selection on the page; Simple mode: source offsets
    const s = getSelection(); const surf = surface();
    const info = { range: null, offset: null, element: null };
    if (s && s.rangeCount && surf && surf.contains(s.anchorNode)) {
      info.range = s.getRangeAt(0).cloneRange();
      const a = s.anchorNode, o = s.anchorOffset;
      info.element = (a.nodeType === 1 ? (a.childNodes[o] && a.childNodes[o].nodeType === 1 ? a.childNodes[o] : a) : a.parentElement);
      const sel = surf.querySelector('.mk-sel'); if (sel) info.element = sel;
    }
    try { const g = ed()?.getSelection?.(); if (g && Number.isFinite(g.start)) info.offset = g.start; } catch {}
    return info;
  }
  function itemAtCaret(doc, model, kinds = ['fig', 'tbl', 'eq']) {
    const c = caretInfo(doc);
    if (c.element) { const it = itemForElement(c.element, model); if (it && kinds.includes(it.kind)) return it; }
    if (c.offset != null) {
      const line = (doc.text.slice(0, c.offset).match(/\n/g) || []).length;
      const hit = model.items.find(i => kinds.includes(i.kind) && i.line != null && line >= i.line && line <= (i.kind === 'tbl' && i.captionLine != null ? Math.max(i.endLine, i.captionLine) : i.endLine));
      if (hit) return hit;
    }
    return null;
  }
  function whereFrom(doc, it, caret) {
    // is the target above or below the insertion point?
    if (caret.range) { const t = targetEl(it.label || it.id); try { if (t) return (caret.range.comparePoint(t, 0) < 0) ? 'above' : 'below'; } catch {} }
    if (caret.offset != null && it.line != null) { const line = (doc.text.slice(0, caret.offset).match(/\n/g) || []).length; return it.line < line ? 'above' : 'below'; }
    return 'above';
  }
  function restoreCaret(caret) {
    if (!caret.range) return;
    try { const surf = surface(); if (surf && surf.contains(caret.range.startContainer)) { surf.focus({ preventScroll: true }); const s = getSelection(); s.removeAllRanges(); s.addRange(caret.range); } } catch {}
  }
  async function insertAtCaret(doc, md, caret, direct) {
    const e = ed();
    // a reference typed right after a word gets a space first ("see@fig:x" would not be a reference)
    let before = '';
    if (caret.offset != null) before = doc.text[caret.offset - 1] || '';
    else if (caret.range && caret.range.startContainer.nodeType === 3) before = caret.range.startContainer.data[caret.range.startOffset - 1] || '';
    const text = before && /[^\s([{ ]/.test(before) && /^[@[]/.test(md) ? ' ' + md : md;
    if (!direct && e && e.insert && editorShows(e, doc)) {
      restoreCaret(caret);
      await e.insert(text);
      await sleep(30);
      try { e.flush?.(); } catch {}
    } else {
      const at = Math.min(caret.offset ?? doc.text.length, doc.text.length);
      doc.setText(doc.text.slice(0, at) + text + doc.text.slice(at), 'xref');
    }
  }

  // ------------------------------------------------------------------ dialogs
  const MODES = {
    fig: [['full', 'Full label', i => fullLabel(i.it, i.cfg) || 'Fig. 1'], ['number', 'Number only', i => numText(i.it) || '1'], ['text', 'Caption text', i => i.it?.caption || 'Caption'], ['aboveBelow', 'Above/below', () => 'above / below']],
    tbl: [['full', 'Full label', i => fullLabel(i.it, i.cfg) || 'Table 1'], ['number', 'Number only', i => numText(i.it) || '1'], ['text', 'Caption text', i => i.it?.caption || 'Caption'], ['aboveBelow', 'Above/below', () => 'above / below']],
    eq: [['full', 'Full label', i => fullLabel(i.it, i.cfg) || 'Eq. (1)'], ['number', 'Number only', i => numText(i.it) || '(1)'], ['aboveBelow', 'Above/below', () => 'above / below']],
    sec: [['text', 'Heading text', i => i.it?.text || 'Heading'], ['full', 'Heading number', i => fullLabel(i.it, i.cfg) || 'Section 1'], ['number', 'Number only', i => i.it?.num || '1'], ['aboveBelow', 'Above/below', () => 'above / below']],
    fn: [['fn', 'Footnote number', i => i.it?.num || '1'], ['aboveBelow', 'Above/below', () => 'above / below']],
  };
  const TYPE_ORDER = [['sec', 'Heading'], ['fig', 'Figure'], ['tbl', 'Table'], ['eq', 'Equation'], ['fn', 'Footnote']];
  function sel(options, value, attrs = '') { return `<select class="sel"${attrs}>${options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`; }
  function lastPrefs() { try { return JSON.parse(localStorage.getItem('mkx-dialog') || '{}'); } catch { return {}; } }
  function savePrefs(p) { try { localStorage.setItem('mkx-dialog', JSON.stringify({ ...lastPrefs(), ...p })); } catch {} }

  /** Word-like Cross-reference dialog. args: {kind, label, mode} */
  async function crossrefDialog(args = {}) {
    const doc = activeDoc(); if (!doc) { app.ui.toast('Open or create a Markdown document first.', { kind: 'warn' }); return; }
    const caret = caretInfo(doc);
    let model = decorateModel(build(currentText(doc), config(doc)));
    const prefs = lastPrefs();
    const have = k => model.items.some(i => i.kind === k);
    let kind = args.kind || (args.label && args.label.split(':')[0]) || (prefs.kind && have(prefs.kind) ? prefs.kind : (TYPE_ORDER.find(([k]) => have(k)) || ['fig'])[0]);
    let mode = args.mode || prefs['mode_' + kind] || MODES[kind][0][0];
    let act = 0, shown = [], hyperlink = prefs.hyperlink !== false, aboveBelow = !!prefs.aboveBelow;
    const body = document.createElement('div'); body.className = 'mkx-dlg mkx-xref';
    body.innerHTML = `
      <div class="mkx-grid2">
        <label class="field"><span>Reference type</span>${sel(TYPE_ORDER, kind, ' data-k="type" aria-label="Reference type"')}</label>
        <label class="field"><span>Insert reference to</span><select class="sel" data-k="mode" aria-label="Insert reference to"></select></label>
      </div>
      <div class="mkx-checks">
        <label class="mkx-check"><input type="checkbox" data-k="link"${hyperlink ? ' checked' : ''}> Insert as hyperlink</label>
        <label class="mkx-check"><input type="checkbox" data-k="ab"${aboveBelow ? ' checked' : ''}> Include above/below</label>
      </div>
      <div class="field"><span data-k="forwhich">For which item</span>
        <label class="mkx-search">${icon('search')}<input class="q" placeholder="Search by number, caption or label" spellcheck="false" aria-label="Search items"></label>
        <div class="mkx-list" role="listbox" tabindex="-1" aria-label="Items"></div>
      </div>
      <div class="mkx-labelrow" data-k="labelrow">
        <label class="mkx-lab">${icon('mkx-label')}<span>Label</span><input class="txt mono" data-k="label" spellcheck="false" aria-label="Label of the selected item"></label>
        <label class="mkx-check" data-k="numwrap"><input type="checkbox" data-k="numbered"> Numbered</label>
        <button type="button" class="btn sm" data-k="rename">Save label</button>
      </div>
      <div class="mkx-preview" aria-live="polite"></div>`;
    const $ = s => body.querySelector(s);
    const typeSel = $('[data-k="type"]'), modeSel = $('[data-k="mode"]'), q = $('.q'), listEl = $('.mkx-list'), linkCb = $('[data-k="link"]'), abCb = $('[data-k="ab"]');
    const labelIn = $('[data-k="label"]'), numCb = $('[data-k="numbered"]'), numWrap = $('[data-k="numwrap"]'), renameBtn = $('[data-k="rename"]'), pv = $('.mkx-preview');
    const current = () => shown[act] || null;
    const fillModes = () => { modeSel.innerHTML = MODES[kind].map(([v, l]) => `<option value="${v}"${v === mode ? ' selected' : ''}>${esc(l)}</option>`).join(''); if (!MODES[kind].some(m => m[0] === mode)) { mode = MODES[kind][0][0]; modeSel.value = mode; } };
    const rowHtml = (it, i) => {
      const num = it.kind === 'fn' ? `Footnote ${it.num}` : it.num != null ? fullLabel(it, model.cfg) : (it.kind === 'sec' ? '' : 'No number');
      const text = it.kind === 'eq' ? `<span class="tex">${esc((it.tex || '').replace(/\s+/g, ' ').trim().slice(0, 120))}</span>` : esc((((it.kind === 'sec' ? it.text : it.caption ?? it.text) || '')).slice(0, 140) || (it.kind === 'fig' ? it.src || 'Picture' : ''));
      const lab = it.kind === 'fn' ? `[^${it.label}]` : it.label;
      return `<div class="mkx-row${i === act ? ' act' : ''}" role="option" aria-selected="${i === act}" data-i="${i}">
        <span class="mkx-num${it.num == null && it.kind !== 'sec' ? ' none' : ''}">${esc(num || (it.kind === 'sec' ? 'Heading ' + (it.num || '') : ''))}</span>
        <span class="mkx-txt"${it.kind === 'sec' ? ` style="padding-left:${Math.max(0, it.level - model.chapterLevel) * 12}px"` : ''}>${text || '<i>No caption</i>'}</span>
        ${lab ? `<code class="mkx-key">${esc(lab)}</code>` : `<span class="mkx-key new">label added on insert</span>`}</div>`;
    };
    function draw(keepScroll) {
      const w = q.value.toLowerCase().trim();
      shown = model.items.filter(i => i.kind === kind).filter(i => !w || `${i.num ?? ''} ${fullLabel(i, model.cfg)} ${i.caption ?? ''} ${i.text ?? ''} ${i.tex ?? ''} ${i.label ?? ''}`.toLowerCase().includes(w));
      act = Math.max(0, Math.min(act, shown.length - 1));
      const st = listEl.scrollTop;
      listEl.innerHTML = shown.length ? shown.map(rowHtml).join('') : `<div class="mkx-empty"><b>No ${KIND_NAME[kind].toLowerCase()}s yet</b>${kind === 'fig' ? 'Insert a picture first (Insert → Picture).' : kind === 'tbl' ? 'Insert a table first (Insert → Table).' : kind === 'eq' ? 'Insert an equation first (Insert → Equation).' : kind === 'sec' ? 'Add a heading first (Home → Styles).' : 'Add a footnote first (References → Footnote).'}</div>`;
      if (keepScroll) listEl.scrollTop = st;
      $('[data-k="forwhich"]').textContent = `For which ${KIND_NAME[kind].toLowerCase()}`;
      const it = current();
      const canLabel = it && kind !== 'fn';
      $('[data-k="labelrow"]').classList.toggle('off', !canLabel);
      labelIn.disabled = renameBtn.disabled = !canLabel;
      labelIn.value = it && kind !== 'fn' ? (it.label || '') : '';
      labelIn.placeholder = it && kind !== 'fn' ? suggestLabel(kind, it, new Set(model.byLabel.keys())) : '';
      numWrap.style.display = kind === 'eq' ? '' : 'none';
      numCb.checked = !!(it && it.numbered);
      abCb.disabled = mode === 'aboveBelow';
      linkCb.disabled = mode === 'full' || mode === 'number' || mode === 'fn';
      linkCb.parentElement.title = linkCb.disabled ? 'Numbers are always live links that update when items move.' : '';
      preview();
    }
    function preview() {
      const it = current();
      if (!it) { pv.innerHTML = ''; return; }
      const fake = { ...it, label: it.label || labelIn.placeholder };
      const where = whereFrom(doc, it, caret);
      let txt = MODES[kind].find(m => m[0] === mode)[2]({ it: it.num != null || kind === 'sec' || kind === 'fn' ? it : { ...it, num: '#' }, cfg: model.cfg });
      if (mode === 'aboveBelow') txt = where;
      let mdText = referenceMarkdown(fake, mode, { hyperlink: linkCb.checked, where });
      if (abCb.checked && mode !== 'aboveBelow') { txt += ' ' + where; mdText += ' ' + referenceMarkdown(fake, 'aboveBelow', { hyperlink: linkCb.checked, where }); }
      pv.innerHTML = `<span>Inserts</span><b>${esc(txt)}</b><code>${esc(mdText.trim())}</code>${!it.label && kind !== 'fn' ? `<em>Adds the label ${esc(fake.label)}</em>` : ''}`;
    }
    typeSel.addEventListener('change', () => { kind = typeSel.value; mode = lastPrefs()['mode_' + kind] || MODES[kind][0][0]; act = 0; fillModes(); draw(); });
    modeSel.addEventListener('change', () => { mode = modeSel.value; draw(true); });
    linkCb.addEventListener('change', preview); abCb.addEventListener('change', preview);
    labelIn.addEventListener('input', preview);
    listEl.addEventListener('click', e => { const r = e.target.closest('.mkx-row'); if (!r) return; act = +r.dataset.i; draw(true); });
    listEl.addEventListener('dblclick', e => { if (e.target.closest('.mkx-row')) body.closest('.dlg')?.querySelector('.btn.primary')?.click(); });
    const keys = e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(0, Math.min(shown.length - 1, act + (e.key === 'ArrowDown' ? 1 : -1))); draw(true); listEl.querySelector('.act')?.scrollIntoView({ block: 'nearest' }); }
    };
    q.addEventListener('keydown', keys); listEl.addEventListener('keydown', keys);
    q.addEventListener('input', () => { act = 0; draw(); });
    async function applyLabel(extra = {}) {
      const it = current(); if (!it) return false;
      const want = labelIn.value.trim();
      const r = await setLabel({ doc, item: it, label: want === '' && extra.numbered == null ? (it.label ? '' : undefined) : (want || undefined), ...extra });
      if (!r) return false;
      model = decorateModel(build(doc.text, config(doc)));
      const again = r.label ? model.byLabel.get(r.label) : model.items.find(i => i.kind === it.kind && i.line === it.line);
      draw(true);
      if (again) { act = Math.max(0, shown.indexOf(again)); draw(true); }
      return true;
    }
    renameBtn.addEventListener('click', async () => { const it = current(); if (!it) return; const was = it.label; if (await applyLabel()) app.ui.toast(was && labelIn.value.trim() ? `Label changed. Every reference now uses ${labelIn.value.trim()}.` : labelIn.value.trim() ? 'Label saved' : 'Label removed'); });
    numCb.addEventListener('change', async () => { await applyLabel({ numbered: numCb.checked }); });
    fillModes();
    if (args.label) { const it = model.byLabel.get(args.label); if (it) { kind = it.kind; typeSel.value = kind; fillModes(); } }
    draw();
    if (args.label) { const i = shown.findIndex(s => s.label === args.label); if (i >= 0) { act = i; draw(); } }
    const v = await app.ui.dialog({ title: 'Cross-reference', body, wide: true, icon: 'xref', buttons: [{ label: 'Cancel', value: null }, { label: 'Insert', value: 'ok', primary: true }] });
    savePrefs({ kind, ['mode_' + kind]: mode, hyperlink: linkCb.checked, aboveBelow: abCb.checked });
    if (v !== 'ok') return;
    const it = current(); if (!it) return;
    return insertReference({ doc, item: it, mode, hyperlink: linkCb.checked, aboveBelow: abCb.checked, label: labelIn.value.trim() || null, caret });
  }
  /** Inserts a reference at the caret. opts: {item | label, mode, hyperlink, aboveBelow, label (for an unlabeled item), caret, doc} */
  async function insertReference(opts = {}) {
    const doc = opts.doc || activeDoc(); if (!doc) return null;
    const caret = opts.caret || caretInfo(doc);
    let model = decorateModel(build(currentText(doc), config(doc)));
    let it = opts.item ? (findItem(model, opts.item) || (opts.item.label && model.byLabel.get(opts.item.label))) : model.byLabel.get(opts.target || opts.label);
    if (!it) { app.ui.toast('That item is no longer in the document.', { kind: 'warn' }); return null; }
    const mode = opts.mode || (it.kind === 'sec' ? 'text' : it.kind === 'fn' ? 'fn' : 'full');
    let label = it.label;
    const needsLabel = it.kind !== 'fn' && !label;
    if (needsLabel) label = (opts.item && opts.label && opts.label.includes(':') ? opts.label : null) || suggestLabel(it.kind, it, new Set(model.byLabel.keys()));
    const fake = { ...it, label };
    const where = whereFrom(doc, it, caret);
    let md = referenceMarkdown(fake, mode, { hyperlink: opts.hyperlink, where });
    if (opts.aboveBelow && mode !== 'aboveBelow') md += ' ' + referenceMarkdown(fake, 'aboveBelow', { hyperlink: opts.hyperlink, where });
    const ref = { kind: it.kind, line: it.line, index: it.index, sameLineIndex: it.sameLineIndex, label: it.label };
    await insertAtCaret(doc, md, caret, opts.direct);
    // an item without a label gets one now, written into the Markdown
    if (needsLabel) {
      await sleep(20);
      const lineShift = (md.match(/\n/g) || []).length;
      const near = { ...ref, line: ref.line + (caret.offset != null && (doc.text.slice(0, caret.offset).match(/\n/g) || []).length < ref.line ? lineShift : 0) };
      const r = await setLabel({ doc, item: near, label, numbered: it.kind === 'eq' ? true : undefined });
      if (r) app.ui.toast(`Added the label ${label} so the reference stays correct when things move`);
    }
    refreshActive();
    return md;
  }

  /** Insert Caption (like Word): picks the selected figure, table or equation; adds or edits its caption and label. */
  async function captionDialog(args = {}) {
    const doc = activeDoc(); if (!doc) { app.ui.toast('Open or create a Markdown document first.', { kind: 'warn' }); return; }
    let model = decorateModel(build(currentText(doc), config(doc)));
    let it = args.label ? model.byLabel.get(args.label) : args.element ? itemForElement(args.element, model) : itemAtCaret(doc, model);
    const cands = model.items.filter(i => i.kind === 'fig' || i.kind === 'tbl' || i.kind === 'eq');
    if (!cands.length) { app.ui.toast('Add a picture, table or equation first. Then Insert Caption numbers it.', { kind: 'warn' }); return; }
    if (!it || !cands.includes(it)) it = cands.find(i => !i.label && i.kind !== 'eq') || cands[0];
    const cfg = model.cfg;
    const name = i => {
      const n = i.num != null ? fullLabel(i, cfg) : `${KIND_NAME[i.kind]} (no number)`;
      const t = i.kind === 'eq' ? (i.tex || '').replace(/\s+/g, ' ').slice(0, 50) : (i.caption || (i.kind === 'fig' ? i.src : '') || '').slice(0, 50);
      return `${n} · ${t}`;
    };
    const body = document.createElement('div'); body.className = 'mkx-dlg mkx-cap';
    body.innerHTML = `
      <label class="field"><span>Item</span>${sel(cands.map((c, i) => [i, name(c)]), cands.indexOf(it), ' data-k="item" aria-label="Item to caption"')}</label>
      <div class="field" data-k="capfield"><span>Caption</span>
        <div class="mkx-capline"><span class="mkx-capnum" data-k="num"></span><input class="txt" data-k="cap" placeholder="Describe what it shows" aria-label="Caption text"></div></div>
      <div class="mkx-grid2">
        <label class="field"><span>Label (for cross-references)</span><input class="txt mono" data-k="label" spellcheck="false" aria-label="Label"></label>
        <div class="field" data-k="posfield"><span>Position</span><div class="seg sm mkx-seg" role="radiogroup" aria-label="Caption position"><button type="button" data-pos="below" class="on" role="radio">Below table</button><button type="button" data-pos="above" role="radio">Above table</button></div></div>
        <div class="field" data-k="eqfield"><span>Equation number</span><label class="mkx-check"><input type="checkbox" data-k="numbered" checked> Numbered</label></div>
      </div>
      <div class="mkx-preview" data-k="pv"></div>
      <div class="mkx-note">Numbers update by themselves when items move. <button type="button" class="mkx-link" data-k="numbering">Numbering options…</button></div>`;
    const $ = s => body.querySelector(s);
    const itemSel = $('[data-k="item"]'), cap = $('[data-k="cap"]'), lab = $('[data-k="label"]'), num = $('[data-k="num"]'), numbered = $('[data-k="numbered"]'), pv = $('[data-k="pv"]');
    let pos = 'below', labelTouched = false, nextNum = '#';
    const cur = () => cands[+itemSel.value];
    // the number this item will get once it has a label (try it on a copy of the text)
    function futureNumber(i) {
      if (i.num != null) return i.num;
      try {
        const tmp = `${i.kind}:mkx-preview-${Date.now()}`;
        const t2 = rewriteItem(model.text, i, { label: tmp, caption: i.caption || 'x', numbered: true, cfg });
        const it2 = t2 && build(t2, cfg).byLabel.get(tmp);
        return it2 && it2.num != null ? it2.num : '#';
      } catch { return '#'; }
    }
    function fill() {
      const i = cur(); labelTouched = false; nextNum = futureNumber(i);
      $('[data-k="capfield"]').style.display = i.kind === 'eq' ? 'none' : '';
      $('[data-k="posfield"]').style.display = i.kind === 'tbl' && i.captionLine == null ? '' : 'none';
      $('[data-k="eqfield"]').style.display = i.kind === 'eq' ? '' : 'none';
      cap.value = i.caption || '';
      lab.value = i.label || '';
      numbered.checked = i.kind !== 'eq' || !!i.numbered || !i.unnumbered;
      update();
    }
    function update() {
      const i = cur();
      const taken = new Set(model.byLabel.keys()); if (i.label) taken.delete(i.label);
      if (!labelTouched && !i.label) lab.placeholder = suggestLabel(i.kind, { ...i, caption: cap.value }, taken);
      const n = nextNum;
      const pre = i.kind === 'eq' ? '' : `${cfg[i.kind]} ${n}`;
      num.textContent = pre ? pre + '.' : '';
      const l = lab.value.trim() || lab.placeholder;
      pv.innerHTML = i.kind === 'eq'
        ? (numbered.checked ? `<span>Shows</span><b>(${esc(n)})</b><span>at the right margin · refer to it with</span><code>@${esc(l)}</code>` : '<span>No number. The equation is not counted.</span>')
        : `<span>Shows</span><b>${esc(pre)}. ${esc(cap.value || '…')}</b><span>· Markdown</span><code>${esc(i.kind === 'fig' ? `![${cap.value}](…){#${l}}` : `: ${cap.value} {#${l}}`)}</code>`;
    }
    itemSel.addEventListener('change', fill);
    cap.addEventListener('input', update); numbered.addEventListener('change', update);
    lab.addEventListener('input', () => { labelTouched = true; update(); });
    body.querySelector('.mkx-seg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pos = b.dataset.pos; body.querySelectorAll('.mkx-seg button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); });
    $('[data-k="numbering"]').addEventListener('click', () => { numberingDialog(); });
    fill();
    const v = await app.ui.dialog({ title: 'Caption', body, icon: 'mkx-caption', buttons: [{ label: 'Cancel', value: null }, { label: 'OK', value: 'ok', primary: true }] });
    if (v !== 'ok') return;
    const i = cur();
    const label = lab.value.trim() || lab.placeholder;
    const r = await setLabel({ doc, item: i, label: i.kind === 'eq' && !numbered.checked ? '' : label, caption: i.kind === 'eq' ? undefined : cap.value, numbered: i.kind === 'eq' ? numbered.checked : undefined, position: pos });
    if (r) {
      await sleep(30);
      const m2 = modelFor(doc); const again = r.label && m2.byLabel.get(r.label);
      app.ui.toast(again && again.num != null ? `${fullLabel(again, m2.cfg)} · label ${r.label}` : 'Caption updated');
    }
    return r;
  }

  /** Numbering options: style, separator, label names, number all equations; for this document or all documents. */
  async function numberingDialog() {
    const doc = activeDoc();
    const c = config(doc);
    const inDoc = !!(doc && hasDocConfig(doc));
    const body = document.createElement('div'); body.className = 'mkx-dlg mkx-num';
    const pref = k => `<label class="field"><span>${{ eq: 'Equations', fig: 'Figures', tbl: 'Tables', sec: 'Headings' }[k]}</span><input class="txt" data-k="${k}" list="mkx-dl-${k}" value="${esc(c[k])}" aria-label="${KIND_NAME[k]} label"><datalist id="mkx-dl-${k}">${PREFIX_CHOICES[k].map(o => `<option value="${esc(o)}">`).join('')}</datalist></label>`;
    body.innerHTML = `
      <div class="field"><span>Numbering</span><div class="seg sm mkx-seg" data-k="style" role="radiogroup" aria-label="Numbering"><button type="button" data-v="plain" role="radio">1, 2, 3</button><button type="button" data-v="chapter" role="radio">1.1, 1.2 by chapter</button></div></div>
      <div class="field" data-k="sepfield"><span>Chapter separator</span><div class="seg sm mkx-seg" data-k="sep" role="radiogroup" aria-label="Separator"><button type="button" data-v="." role="radio">1.1 period</button><button type="button" data-v="-" role="radio">1-1 hyphen</button></div></div>
      <div class="mkx-grid4">${KINDS.map(pref).join('')}</div>
      <label class="mkx-check"><input type="checkbox" data-k="all"${c.numberAll ? ' checked' : ''}> Number all display equations (not only labeled ones)</label>
      <label class="mkx-check"><input type="checkbox" data-k="doc"${inDoc || !doc ? ' checked' : ''}${doc ? '' : ' disabled'}> Save in this document, so the numbering travels with the file</label>
      <div class="mkx-preview" data-k="pv"></div>
      <div class="mkx-note">Chapters are the top heading level${modelFor(doc).chapterLevel === 2 ? ' (Heading 2 here, because Heading 1 is the title)' : ''}.</div>`;
    const $ = s => body.querySelector(s);
    let style = c.style, sep = c.sep;
    const segs = () => {
      body.querySelectorAll('[data-k="style"] button').forEach(b => { b.classList.toggle('on', b.dataset.v === style); b.setAttribute('aria-checked', b.dataset.v === style); });
      body.querySelectorAll('[data-k="sep"] button').forEach(b => { b.classList.toggle('on', b.dataset.v === sep); b.setAttribute('aria-checked', b.dataset.v === sep); });
      $('[data-k="sepfield"]').style.opacity = style === 'chapter' ? '1' : '.45';
      const n = style === 'chapter' ? `2${sep}1` : '3';
      $('[data-k="pv"]').innerHTML = `<span>Looks like</span><b>${esc($('[data-k="eq"]').value)} (${n})</b><b>${esc($('[data-k="fig"]').value)} ${n}</b><b>${esc($('[data-k="tbl"]').value)} ${n}</b>`;
    };
    body.addEventListener('click', e => { const b = e.target.closest('.mkx-seg button'); if (!b) return; if (b.closest('[data-k="style"]')) style = b.dataset.v; else sep = b.dataset.v; segs(); });
    body.addEventListener('input', segs);
    segs();
    const v = await app.ui.dialog({ title: 'Numbering options', body, icon: 'mkx-hash', buttons: [{ label: 'Cancel', value: null }, { label: 'Apply', value: 'ok', primary: true }] });
    if (v !== 'ok') return;
    const patch = { style, sep, numberAll: $('[data-k="all"]').checked };
    for (const k of KINDS) patch[k] = $(`[data-k="${k}"]`).value.trim() || DEFAULTS[k];
    setConfig(patch, $('[data-k="doc"]').checked && doc ? 'both' : 'app', doc);
    app.ui.toast('Numbering updated');
  }

  /** Old documents: equations with a fixed \tag{3} become labeled, auto-numbered equations. */
  function convertTags(doc = activeDoc()) {
    if (!doc) return 0;
    let text = currentText(doc);
    let model = decorateModel(build(text, config(doc)));
    const fixed = model.eqs.filter(i => i.block && i.fixed && /^\d+(?:[.\-]\d+)?$/.test(String(i.tag)) && !i.label);
    if (!fixed.length) { app.ui.toast('No fixed equation numbers to convert.'); return 0; }
    const taken = new Set(model.byLabel.keys());
    const lines = text.split('\n'); const renames = [];
    for (const it of [...fixed].reverse()) {
      const label = suggestLabel('eq', it, taken); taken.add(label);
      for (let i = it.line; i <= it.endLine; i++) lines[i] = lines[i].replace(/\s*\\tag\*?\s*\{[^{}]*\}/, '');
      const end = it.endLine; const m = ATTR_AT_END.exec(lines[end]); const base = (m ? lines[end].slice(0, m.index) : lines[end]).replace(/[ \t]+$/, '');
      lines[end] = base + ` {#${label}}`;
      renames.push([String(it.tag), label]);
    }
    let next = lines.join('\n');
    // links that pointed at the old numbers: [Equation (3)](#eq-3)
    for (const [n, label] of renames) next = next.replace(new RegExp('\\[(?:Equation|Eq\\.?)\\s*\\(?' + escRe(n) + '\\)?\\]\\(#eq-' + escRe(n) + '\\)', 'g'), '@' + label);
    doc.setText(next, 'xref');
    app.ui.toast(`${fixed.length} equation${fixed.length === 1 ? '' : 's'} now numbered automatically`);
    return fixed.length;
  }

  // ------------------------------------------------------------------ commands
  const cmd = (id, def) => app.commands.register(id, def);
  const mdOnly = () => !!activeDoc();
  cmd('xref.crossref', { label: 'Cross-reference', icon: 'xref', shortcut: 'Ctrl+Alt+R', description: 'Refer to a heading, figure, table, equation or footnote. The number updates by itself when things move.', isEnabled: mdOnly, run: a => crossrefDialog(a || {}) });
  cmd('xref.caption', { label: 'Insert caption', icon: 'mkx-caption', shortcut: 'Ctrl+Alt+Shift+C', description: 'Give the selected picture, table or equation a number and a caption (like Word).', isEnabled: mdOnly, run: a => captionDialog(a || {}) });
  cmd('xref.numberAll', {
    label: 'Number all equations', icon: 'sigma', description: 'On: every display equation gets a number. Off: only equations with a label (or a Numbered switch) are numbered.',
    isActive: () => !!config().numberAll,
    run(a) { const v = typeof a === 'boolean' ? a : a && typeof a.value === 'boolean' ? a.value : !config().numberAll; setConfig({ numberAll: v }); app.ui.toast(v ? 'All display equations are numbered' : 'Only labeled equations are numbered'); },
  });
  cmd('xref.style', {
    label: 'Numbering style', icon: 'mkx-hash', description: '1, 2, 3 or by chapter: 1.1, 1.2 (chapter = top heading level).',
    run(a) { const v = typeof a === 'string' ? a : a && a.value; if (!v) return numberingDialog(); if (!/^(plain|chapter)$/.test(v)) return; setConfig({ style: v }); app.ui.toast(v === 'chapter' ? 'Numbers follow the chapter: 1.1, 1.2, 2.1' : 'Numbers run 1, 2, 3 through the document'); },
  });
  cmd('xref.separator', {
    label: 'Chapter number separator', icon: 'mkx-hash', description: 'Between chapter and number: 1.1 or 1-1.',
    run(a) { const v = typeof a === 'string' ? a : a && a.value; if (!/^[.\-]$/.test(v || '')) return numberingDialog(); setConfig({ sep: v }); },
  });
  cmd('xref.numbering', { label: 'Numbering options…', icon: 'mkx-hash', description: 'Numbering style, separator and label names (Eq., Fig., Table).', run: () => numberingDialog() });
  cmd('xref.update', {
    label: 'Update numbers', icon: 'refresh', shortcut: 'F9', description: 'Renumbers equations, figures and tables and refreshes every cross-reference (like Update Field in Word).', isEnabled: mdOnly,
    async run() { invalidate(); try { await ed()?.refresh?.(); } catch {} refreshActive(true); const m = modelFor(activeDoc()); const broken = document.querySelectorAll('.mk-page .mk-xref-broken').length; app.ui.toast(`Numbers updated: ${m.eqs.filter(i => i.numbered).length} equations, ${m.figs.filter(i => i.num).length} figures, ${m.tbls.filter(i => i.num).length} tables${broken ? ` · ${broken} broken reference${broken === 1 ? '' : 's'} in red` : ''}`, { kind: broken ? 'warn' : 'success' }); },
  });
  cmd('xref.goto', {
    label: 'Go to referenced item', icon: 'xref', description: 'Jumps to the figure, table, equation or heading the selected cross-reference points to.', isEnabled: mdOnly,
    run(a) {
      if (a && a.label) return jump(a.label);
      const s = getSelection(); let n = s && s.anchorNode; n = n && (n.nodeType === 1 ? (n.childNodes[s.anchorOffset - 1] || n.childNodes[s.anchorOffset] || n) : n.parentElement);
      const x = n && (n.closest?.('.mk-xref') || (n.previousElementSibling?.classList?.contains('mk-xref') ? n.previousElementSibling : null) || (n.classList?.contains('mk-xref') ? n : null));
      if (x) return jump((x.getAttribute('data-ref') || '').split(';')[0], rootOf(x));
      app.ui.toast('Put the cursor right after a cross-reference first, or Ctrl+click the reference.', { kind: 'warn' });
    },
  });
  cmd('xref.convertTags', { label: 'Convert fixed equation numbers', icon: 'sigma', description: 'Equations with a typed \\tag{3} become labeled equations that renumber themselves.', isEnabled: mdOnly, run: () => convertTags() });
  cmd('xref.fixReference', { label: 'Fix broken cross-reference', icon: 'xref', palette: false, run: a => a && fixReference(a.from, a.to) });
  cmd('xref.setLabel', { label: 'Change label', icon: 'mkx-label', palette: false, run: a => setLabel(a || {}) });

  // ------------------------------------------------------------------ ribbon
  const big = (command, label, ic) => ({ type: 'big', command, label, icon: ic });
  const small = (command, label, ic, extra = {}) => ({ type: 'small', command, label, icon: ic, showLabel: true, ...extra });
  app.ribbon.addGroup('references', {
    id: 'xref-captions', label: 'Captions & numbering', order: 40, items: [
      big('xref.caption', 'Insert Caption', 'mkx-caption'),
      big('xref.crossref', 'Cross-ref', 'xref'),
      { type: 'col', items: [
        { type: 'row', items: [
          { type: 'select', command: 'xref.style', label: 'Numbering style', options: [{ value: 'plain', label: 'Numbers 1, 2, 3' }, { value: 'chapter', label: 'By chapter 1.1, 1.2' }], value: () => config().style, width: 150 },
          { type: 'small', command: 'xref.numbering', label: 'Numbering options: label names (Eq., Fig., Table) and separator', icon: 'mkx-hash' },
        ] },
        small('xref.numberAll', 'Number all equations', 'sigma'),
      ] },
      big('xref.update', 'Update', 'refresh'),
    ],
  });
  app.ribbon.addGroup('insert', { id: 'xref-insert', label: 'Captions', order: 45, items: [big('xref.caption', 'Caption', 'mkx-caption'), big('xref.crossref', 'Cross-ref', 'xref')] });

  // ------------------------------------------------------------------ export stylesheet (numbers in a gutter; KaTeX's own counters hidden)
  const EXPORT_CSS = `
.mk-math .eqn-num,.mk-math .katex-html>.tag{display:none!important}
.mk-math.display.mk-eqn{display:grid!important;grid-template-columns:minmax(4.2em,1fr) minmax(0,auto) minmax(4.2em,1fr);align-items:center;column-gap:8px}
.mk-math.display.mk-eqn>.katex-display{grid-column:2;margin:0;min-width:0;overflow-x:auto;overflow-y:hidden}
.mk-math.display.mk-eqn>.mk-eqno{grid-column:3;justify-self:end;position:static!important;transform:none!important;font:13px -apple-system,"Segoe UI",system-ui,sans-serif;color:#6e6e73;white-space:nowrap;font-variant-numeric:tabular-nums}
.mk-xnum{font-weight:600;color:#1d1d1f}
a.mk-xref{color:#0a66ff;text-decoration:none}
.mk-tcaption{font:12px -apple-system,"Segoe UI",system-ui,sans-serif;color:#6e6e73;text-align:center;margin:6px 0 16px}
.mk-tcaption[data-pos="before"]{margin:16px 0 6px}
`;

  // ------------------------------------------------------------------ public API
  app.xref = {
    config, setConfig, docConfig,
    scan: text => scanText(text),
    model: (doc = activeDoc(), text) => decorateModel(modelFor(doc, text)),
    targets, apply, refresh: () => refreshActive(true),
    refText: (keys, opts = {}, doc = activeDoc()) => refText([].concat(keys), opts, modelFor(doc)).text,
    numberOf: (label, doc = activeDoc()) => { const it = modelFor(doc).byLabel.get(label); return it ? numText(it) : null; },
    fullLabel: (label, doc = activeDoc()) => { const m = modelFor(doc); return fullLabel(m.byLabel.get(label), m.cfg); },
    suggestLabel: (kind, it, doc = activeDoc()) => suggestLabel(kind, it || {}, new Set(modelFor(doc).byLabel.keys())),
    equationMarkdown, referenceMarkdown,
    setLabel, insertReference, renameRefs, rewriteItem: (text, ref, o) => { const m = decorateModel(build(text, config())); const it = findItem(m, ref); return it ? rewriteItem(text, it, { cfg: m.cfg, ...o }) : null; },
    itemForElement: (el, doc = activeDoc()) => itemForElement(el, decorateModel(modelFor(doc))),
    /** For the equation editor: {label, numbered, number, labelFrom} of the equation shown by `el` (a .mk-math or its block). */
    equationInfo(el, doc = activeDoc()) {
      const m = decorateModel(modelFor(doc)); const it = itemForElement(el, m);
      if (!it || it.kind !== 'eq') return { label: null, numbered: !!m.cfg.numberAll, number: null, labelFrom: null };
      return { label: it.label || null, numbered: !!it.numbered, number: it.num != null ? numText(it) : null, labelFrom: it.labelFrom || null, fixed: !!it.fixed };
    },
    /** How a number looks: format('eq', '1.2') → "(1.2)"; format('fig', 3, {full:true}) → "Fig. 3". */
    format(kind, num, o = {}) { const it = { kind, num: String(num) }; return o.full ? fullLabel(it, config(o.doc)) : numText(it); },
    exportMarkdown, exportCss: () => EXPORT_CSS, jump, convertTags,
    dialogs: { crossref: crossrefDialog, caption: captionDialog, numbering: numberingDialog },
    EXPORT_CSS,
  };

  // ------------------------------------------------------------------ smoke tests
  const A = app.assert;
  const SAMPLE = String.raw`---
title: Flume study
---
# Introduction

See @eq:shields, [-@eq:mpm], @fig:flume, [@tbl:runs] and @eq:missing.

$$
\theta = \frac{\tau_b}{(\rho_s - \rho) g D}
$$ {#eq:shields}

$$ q^* = 8 (\theta - \theta_c)^{3/2} $$ {#eq:mpm}

$$ x = 1 $$

![Sediment flume](flume.png){#fig:flume}

# Results

| Run | D |
|---|---|
| R1 | 2.0 |

: Flume runs {#tbl:runs}

$$ a = b \tag{7} $$

\begin{equation}
y = 2 \label{eq:env}
\end{equation}
`;
  const withDoc = async (text, fn) => { const d = app.docs.create({ text, title: 'xref-test' }); try { return await fn(d); } finally { await app.docs.close(d.id, { force: true }); } };
  app.tests.register('xref: labels round-trip exactly through Markdown', () => {
    A(X && mk.toMarkdown, 'preload exposes mk.xref');
    const r = mk.render(SAMPLE, {});
    A(/class="mk-math-block"[^>]*data-label="eq:shields"/.test(r.html), 'labeled block');
    A(/<figure class="mk-figure"[^>]*data-label="fig:flume"/.test(r.html), 'figure with label');
    A(/<table[^>]*data-label="tbl:runs"/.test(r.html) && /class="mk-tcaption"/.test(r.html), 'table caption');
    A((r.html.match(/class="mk-xref"/g) || []).length === 5, 'five reference placeholders');
    const back = mk.toMarkdown(r.html.replace(/<header[\s\S]*?<\/header>/, ''));
    for (const s of ['$$ {#eq:shields}', '$$ {#eq:mpm}', '![Sediment flume](flume.png){#fig:flume}', ': Flume runs {#tbl:runs}', '@eq:shields', '[-@eq:mpm]', '[@tbl:runs]', '\\label{eq:env}', '\\tag{7}'])
      A(back.includes(s), `toMarkdown keeps ${s}\n${back}`);
  });
  app.tests.register('xref: one number per equation, chapter numbering, prefixes', async () => {
    await withDoc(SAMPLE, async d => {
      let m = build(d.text, { ...DEFAULTS });
      const n = l => numText(m.byLabel.get(l));
      A(n('eq:shields') === '(1)' && n('eq:mpm') === '(2)' && n('eq:env') === '(3)', 'plain numbers: ' + [n('eq:shields'), n('eq:mpm'), n('eq:env')]);
      A(m.eqs.find(i => /x = 1/.test(i.tex)).num == null, 'unlabeled equation has no number');
      A(m.eqs.find(i => i.fixed).num === '7', 'typed \\tag stays');
      m = build(d.text, { ...DEFAULTS, style: 'chapter', sep: '-', numberAll: true, fig: 'Figure' });
      A(numText(m.byLabel.get('eq:shields')) === '(1-1)' && numText(m.byLabel.get('eq:env')) === '(2-1)', 'chapter style');
      A(m.eqs.find(i => /x = 1/.test(i.tex)).num === '1-3', 'number all equations');
      A(refText(['fig:flume'], {}, m).text === 'Figure 1-1', refText(['fig:flume'], {}, m).text);
      A(refText(['eq:shields', 'eq:mpm'], {}, m).text === 'Eqs. (1-1) and (1-2)', refText(['eq:shields', 'eq:mpm'], {}, m).text);
      A(refText(['eq:mpm'], { suppress: true }, m).text === '(1-2)', 'number only');
      A(refText(['eq:nope'], {}, m).broken.length === 1, 'broken reference found');
    });
  });
  app.tests.register('xref: page shows one number per equation in a gutter that never overlaps', async () => {
    const long = SAMPLE + '\n$$ ' + Array.from({ length: 40 }, (_, i) => `a_{${i}} x^{${i}}`).join(' + ') + ' $$ {#eq:long}\n';
    await withDoc(long, async d => {
      const r = await app.render(d.text, { doc: d });
      const el = document.createElement('div'); el.className = 'mk-page'; el.style.cssText = 'position:fixed;left:-20000px;top:0;width:600px';
      el.innerHTML = r.html; document.body.appendChild(el);
      try {
        await app.decorate(el, d);
        const nums = [...el.querySelectorAll('.mk-math.display')].map(m => m.querySelectorAll('.mk-eqno').length);
        A(nums.every(c => c <= 1), 'at most one number per equation');
        A(el.querySelectorAll('.mk-eqno').length === 5, 'five numbered equations, got ' + el.querySelectorAll('.mk-eqno').length);
        for (const e of el.querySelectorAll('.eqn-num')) A(getComputedStyle(e).display === 'none', 'KaTeX equation counter hidden');
        const blk = el.querySelector('[data-label="eq:long"] .mk-math');
        const no = blk.querySelector('.mk-eqno').getBoundingClientRect(), kd = blk.querySelector('.katex-display').getBoundingClientRect();
        const cs = getComputedStyle(blk);
        A(no.left >= kd.right - 0.5, `number (left ${no.left}) does not overlap the equation (right ${kd.right}); display ${cs.display}, columns ${cs.gridTemplateColumns}, page ${JSON.stringify(el.getBoundingClientRect())}, eqno pos ${getComputedStyle(blk.querySelector('.mk-eqno')).position}`);
        A(el.querySelector('figure .mk-xnum')?.textContent === 'Fig. 1. ', 'figure caption number: ' + el.querySelector('figure .mk-xnum')?.textContent);
        A(el.querySelector('.mk-tcaption .mk-xnum')?.textContent === 'Table 1. ', 'table caption number');
        const refs = [...el.querySelectorAll('.mk-xref')].map(x => x.textContent);
        A(refs[0] === 'Eq. (1)' && refs[1] === '(2)' && refs[2] === 'Fig. 1' && refs[3] === 'Table 1', 'reference text: ' + refs.join(' | '));
        A(el.querySelectorAll('.mk-xref-broken').length === 1, 'broken reference marked');
        // Word mode serializes edited blocks with app.editor.toMarkdown: numbers must not leak into the Markdown
        const md = app.editor?.toMarkdown ? app.editor.toMarkdown([...el.childNodes]) : mk.toMarkdown(el.innerHTML);
        A(md.includes('{#eq:shields}') && md.includes('@eq:shields') && md.includes('[-@eq:mpm]') && !md.includes('Eq. (1)') && !md.includes('Fig. 1') && !md.includes('Table 1') && !/\$\$\s*\(\d\)/.test(md), 'numbers stay out of the Markdown:\n' + md.slice(0, 600));
      } finally { el.remove(); }
    });
  });
  app.tests.register('xref: captions and labels are written into the Markdown', async () => {
    const text = '# A\n\nText ![Flow over a dune](dune.png) here.\n\n| x |\n|---|\n| 1 |\n\n$$\nE = m c^2\n$$\n\n## Sub\n';
    await withDoc(text, async d => {
      let m = decorateModel(build(d.text, config(d)));
      await setLabel({ doc: d, item: m.figs[0], caption: 'Flow over a dune' });
      A(/\n\n!\[Flow over a dune\]\(dune\.png\)\{#fig:flow-dune\}/.test(d.text) && /Text here\./.test(d.text), 'figure moved to its own line with a label:\n' + d.text);
      m = decorateModel(build(d.text, config(d)));
      await setLabel({ doc: d, item: m.tbls[0], caption: 'Runs' });
      A(/\| 1 \|\n\n: Runs \{#tbl:runs\}/.test(d.text), 'table caption added:\n' + d.text);
      m = decorateModel(build(d.text, config(d)));
      await setLabel({ doc: d, item: m.eqs[0], numbered: true });
      A(/\$\$ \{#eq:e\}/.test(d.text), 'equation label:\n' + d.text);
      d.setText(d.text + '\nSee @eq:e and [-@eq:e].\n', 'test');
      m = decorateModel(build(d.text, config(d)));
      await setLabel({ doc: d, item: m.byLabel.get('eq:e'), label: 'eq:energy' });
      A(d.text.includes('{#eq:energy}') && d.text.includes('See @eq:energy and [-@eq:energy].'), 'rename updates references:\n' + d.text);
      m = decorateModel(build(d.text, config(d)));
      await setLabel({ doc: d, item: m.byLabel.get('eq:energy'), numbered: false, label: '' });
      A(!/\{#eq:energy\}/.test(d.text), 'numbered off removes the label');
      m = decorateModel(build(d.text, config(d)));
      await setLabel({ doc: d, item: m.secs[1], label: 'sec:sub' });
      A(/## Sub \{#sec:sub\}/.test(d.text), 'heading label');
      A(app.research?.outline?.(d.text).find(h => h.level === 2)?.text === 'Sub', 'outline hides the heading label');
      A(equationMarkdown('a=b', { display: true, label: 'eq:ab' }).includes('$$\na=b\n$$ {#eq:ab}'), 'equationMarkdown');
    });
  });
  app.tests.register('xref: insert a cross-reference to an unlabeled table adds the label', async () => {
    const text = 'Intro.\n\n| x |\n|---|\n| 1 |\n\n: Grain sizes\n';
    await withDoc(text, async d => {
      const m = decorateModel(build(d.text, config(d)));
      const r = await insertReference({ doc: d, item: m.tbls[0], mode: 'full', caret: { offset: 6, range: null }, direct: true });
      A(r === '@tbl:grain-sizes', 'inserted ' + r);
      A(d.text.startsWith('Intro. @tbl:grain-sizes\n'), 'reference in text with a space before it:\n' + d.text);
      A(d.text.includes(': Grain sizes {#tbl:grain-sizes}'), 'label added to the caption:\n' + d.text);
      A(app.xref.refText('tbl:grain-sizes', {}, d) === 'Table 1', 'resolves to Table 1');
    });
  });
  app.tests.register('xref: page, hover card and dialogs (screenshots xref, xref-dialog, xref-caption)', async () => {
    const shot = name => mk.invoke?.('smoke-shot', name)?.catch?.(() => {});
    const text = SAMPLE.replace('# Results', 'A long one:\n\n$$ ' + Array.from({ length: 18 }, (_, i) => `a_{${i}} x^{${i}}`).join(' + ') + ' $$ {#eq:long}\n\nAs @eq:long shows, and see @fig:flume.\n\n# Results');
    const d = app.docs.create({ text, title: 'Cross-references' });
    try {
      if (app.mode !== 'word') app.setMode('word');
      let s = null; for (let i = 0; i < 40 && !(s = surface())?.querySelector('.mk-xref'); i++) await sleep(100);
      A(s && s.querySelector('.mk-eqno'), 'numbers on the Word page');
      const ref = s.querySelector('.mk-xref');
      ref.scrollIntoView({ block: 'center' }); await sleep(150);
      showCard(ref); await sleep(400);
      A(card && card.classList.contains('show') && /Eq\. \(1\)/.test(card.textContent), 'hover card shows the target');
      await shot('xref');
      hideCard(true);
      const close = async p => { await sleep(450); document.querySelector('.dlg.show .dlg-foot .btn:not(.primary)')?.click(); await p; };
      let p = crossrefDialog({ kind: 'fig' }); await sleep(450);
      A(document.querySelector('.dlg.show .mkx-row'), 'cross-reference dialog lists items');
      await shot('xref-dialog'); await close(p);
      p = captionDialog({}); await sleep(450); await shot('xref-caption'); await close(p);
      if (app.shell?.selectTab) { app.shell.selectTab('references'); await sleep(350); await shot('xref-ribbon'); app.shell.selectTab('home'); }
    } finally { hideCard(true); await app.docs.close(d.id, { force: true }); }
  });
  app.tests.register('xref: Pandoc export Markdown has plain numbers', async () => {
    await withDoc(SAMPLE, async d => {
      const out = exportMarkdown(d.text, d);
      A(out.includes('[Eq. (1)](#eq:shields)') && out.includes('[(2)](#eq:mpm)') && out.includes('[Fig. 1](#fig:flume)') && out.includes('[Table 1](#tbl:runs)'), 'references resolved:\n' + out);
      A(/\\qquad \(1\)\n\$\$/.test(out) && !/\{#eq:shields\}/.test(out), 'equation number inside the math');
      A(out.includes('![Fig. 1. Sediment flume](flume.png){#fig:flume}') && out.includes(': Table 1. Flume runs {#tbl:runs}'), 'captions numbered');
      A(out.includes('??'), 'broken reference shows ??');
    });
  });
})();
