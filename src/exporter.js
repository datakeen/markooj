// Markooj — exporter: standalone HTML (KaTeX fonts embedded), export to every format, print.
(function () {
  'use strict';
  const app = window.app;
  if (!app) return;
  const mk = app.mk;
  const esc = app.esc;

  const BUILTIN = [
    { id: 'pdf', label: 'PDF', ext: 'pdf', available: true, via: 'built-in' },
    { id: 'docx', label: app.tm('Word document'), ext: 'docx', available: true, via: 'built-in' },
    { id: 'epub', label: app.tm('EPUB e-book'), ext: 'epub', available: true, via: 'built-in' },
    { id: 'html', label: app.tm('Web page'), ext: 'html', available: true, via: 'built-in' },
    { id: 'txt', label: app.tm('Plain text'), ext: 'txt', available: true, via: 'built-in' },
  ];

  // Print-friendly, light-only page styles for exported documents (no app tokens, no contenteditable).
  const EXPORT_CSS = `
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:#fff;color:#1d1d1f;font:16px/1.62 Charter,"Iowan Old Style",Cambria,Georgia,serif;-webkit-font-smoothing:antialiased}
body.screen{background:#f5f5f7}
body.screen .mk-page{max-width:794px;margin:32px auto;padding:72px 84px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.06),0 8px 28px rgba(0,0,0,.08);border-radius:3px}
@media (max-width:820px){body.screen .mk-page{margin:0;padding:28px 20px;box-shadow:none}}
body.print .mk-page{padding:0;margin:0}
.mk-page{word-wrap:break-word;overflow-wrap:anywhere}
.mk-page>:first-child{margin-top:0}
h1,h2,h3,h4,h5,h6{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif;color:#1d1d1f;break-after:avoid;page-break-after:avoid}
h1{font-size:28px;line-height:1.15;letter-spacing:-.02em;margin:28px 0 10px}
.mk-front ~ h1{font-size:23px;line-height:1.2;margin:32px 0 10px}
h2{font-size:19px;line-height:1.3;margin:28px 0 8px}
h3{font-size:15.5px;margin:20px 0 6px;color:#3a3a3c}
h4{font-size:14px;margin:16px 0 4px}h5,h6{font-size:13px;margin:14px 0 4px;color:#6e6e73}
p{margin:0 0 12px;orphans:3;widows:3}
a{color:#0a66ff;text-decoration:none}
a.header-anchor{display:none}
ul,ol{margin:0 0 12px;padding-left:1.6em}li{margin:2px 0}li>p{margin:0 0 4px}
ul.contains-task-list{padding-left:.4em}.task-list-item{list-style:none;position:relative;padding-left:1.6em}
.task-list-item input{position:absolute;left:0;top:.38em;margin:0}
blockquote{margin:14px 0;padding:2px 0 2px 16px;border-left:3px solid #d1d1d6;color:#48484a}
hr{border:0;border-top:.5px solid #c7c7cc;margin:24px 0}
img,svg{max-width:100%;height:auto}
figure{margin:16px 0;text-align:center}figcaption,.caption{font:12px system-ui,sans-serif;color:#6e6e73;text-align:center}
mark{background:#fff3a3;color:inherit}
kbd{font:600 12px Consolas,monospace;border:1px solid #c7c7cc;border-bottom-width:2px;border-radius:4px;padding:0 4px}
code{font:.86em "SF Mono","Cascadia Code",Consolas,monospace;background:#f5f5f7;border:.5px solid #e5e5ea;padding:1px 4px;border-radius:4px}
pre{font:12.5px/1.5 "SF Mono","Cascadia Code",Consolas,monospace;background:#f5f5f7;border:.5px solid #e5e5ea;padding:12px 14px;border-radius:8px;overflow:auto;white-space:pre-wrap;break-inside:avoid;page-break-inside:avoid}
pre code{background:none;border:0;padding:0;font-size:inherit}
pre.hljs{background:#f5f5f7;color:#24292e}
table{width:100%;border-collapse:collapse;font:13px -apple-system,"Segoe UI",system-ui,sans-serif;margin:14px 0 8px;break-inside:avoid;page-break-inside:avoid}
th{text-align:left;font-weight:600;padding:7px 10px;border-bottom:1.5px solid #1d1d1f}
td{padding:6px 10px;border-bottom:.5px solid #d1d1d6;font-variant-numeric:tabular-nums}
tr:last-child td{border-bottom:1.5px solid #6e6e73}
table+p>em:only-child{display:block;font:12px system-ui,sans-serif;color:#6e6e73;text-align:center}
dl dt{font-weight:600}dl dd{margin:0 0 8px 1.4em}
details{margin:12px 0;padding:8px 12px;border:.5px solid #d1d1d6;border-radius:8px}
.mk-front{margin:0 0 24px}
.mk-title{font:700 30px/1.15 -apple-system,"Segoe UI",system-ui,sans-serif;letter-spacing:-.02em;margin:0 0 6px}
.mk-author,.mk-date{font:13px -apple-system,"Segoe UI",system-ui,sans-serif;color:#6e6e73;margin:0 0 2px}
.mk-abstract{font-size:.92em;padding:14px 16px;border-radius:10px;background:#eef4ff;border-left:3px solid #0a66ff;margin:16px 0 24px}
.mk-math{white-space:nowrap}
.mk-math.display{display:block;text-align:center;white-space:normal}
.mk-math-block{position:relative;margin:16px 0;text-align:center;overflow-x:auto;break-inside:avoid}
.mk-math-block .katex-display{margin:0}
.mk-math-block .eq-num,.mk-math-block .mk-eqno{position:absolute;right:0;top:50%;transform:translateY(-50%);font:13px system-ui,sans-serif;color:#6e6e73;width:4em;text-align:right;white-space:nowrap}
.mk-comment{display:inline;font:11.5px/1.4 system-ui,sans-serif;color:#7a5200;background:#fff4d6;border-left:2px solid #ff9f0a;border-radius:3px;padding:1px 5px;margin:0 2px}
.mk-note{background:#f1ecff;color:#5b5b66;border-radius:3px;padding:0 2px}
.math-error{color:#d70015}
.mk-cite{color:#0a66ff;white-space:nowrap}
.mk-bibliography{margin-top:32px;border-top:.5px solid #c7c7cc}
.mk-bibliography ol{list-style:none;padding:0;font-size:.92em}
.mk-bibliography li{padding-left:1.8em;text-indent:-1.8em;margin:0 0 8px}
sup.footnote-ref a{font:600 10px system-ui,sans-serif}
hr.footnotes-sep{width:30%;margin:32px 0 10px}
section.footnotes{font:12.5px/1.5 system-ui,sans-serif;color:#48484a}
.callout,div.note,div.tip,div.warning,div.important,div.caution,div.info,div.abstract{border-radius:10px;padding:12px 14px;margin:14px 0;font-size:.94em;background:#eef4ff;border-left:3px solid #0a66ff;break-inside:avoid}
.callout>:last-child,div.note>:last-child,div.tip>:last-child,div.warning>:last-child{margin-bottom:0}
.callout-title{font:600 12.5px system-ui,sans-serif;color:#0a66ff}
.callout-tip,.callout-success,div.tip{background:#eaf7ee;border-left-color:#28a745}
.callout-tip .callout-title,.callout-success .callout-title{color:#1f8f3a}
.callout-warning,.callout-caution,div.warning,div.caution{background:#fff5e5;border-left-color:#ff9f0a}
.callout-warning .callout-title,.callout-caution .callout-title{color:#c77700}
.callout-important,.callout-abstract,div.important,div.abstract{background:#f3eeff;border-left-color:#8e5cf7}
.callout-danger,.callout-error,.callout-bug{background:#ffeeed;border-left-color:#ff3b30}
div.note::before{content:"Note"}div.tip::before{content:"Tip"}div.warning::before{content:"Warning"}div.caution::before{content:"Caution"}div.important::before{content:"Important"}div.info::before{content:"Info"}div.abstract::before{content:"Abstract"}
div.note::before,div.tip::before,div.warning::before,div.caution::before,div.important::before,div.info::before,div.abstract::before{display:block;font:600 12.5px system-ui,sans-serif;margin-bottom:2px}
div.theorem,div.lemma{font-style:italic;margin:14px 0}
div.theorem>p:first-child::before{content:"Theorem. ";font-style:normal;font-weight:700}
div.lemma>p:first-child::before{content:"Lemma. ";font-style:normal;font-weight:700}
div.definition>p:first-child::before{content:"Definition. ";font-weight:700}
div.example>p:first-child::before{content:"Example. ";font-weight:700}
div.proof>p:first-child::before{content:"Proof. ";font-style:italic}
div.proof>:last-child::after{content:"\\220E";float:right}
div.columns{column-count:2;column-gap:28px}
div.center,div[align="center"]{text-align:center}div[align="right"]{text-align:right}div[align="justify"]{text-align:justify}
.page-break{height:0;border:0;margin:0;break-after:page;page-break-after:always}
body.screen .page-break{border-top:1px dashed #c7c7cc;margin:28px 0}
pre.mermaid{background:none;border:0;display:flex;justify-content:center;font-family:system-ui,sans-serif}
pre.mermaid svg{max-width:100%;height:auto}
@media print{body.screen{background:#fff}body.screen .mk-page{box-shadow:none;margin:0;padding:0;max-width:none}a{color:inherit}}
`;

  // a numbered equation keeps a fixed gutter on both sides, so a long equation never runs under its number
  const EQ_GUTTER_CSS = '.mk-math-block:has(.eq-num,.mk-eqno){padding-left:4.5em;padding-right:4.5em}';

  // ---------- comments and hidden notes ----------
  // Review comments are <!-- comment: … -->, hidden notes are %%…%%. Neither leaves Markooj unless
  // "Include comments" is on (File → Save As, File → Print or Options). Code is never touched.
  function mapOutsideCode(text, fn) {
    const lines = String(text || '').split('\n');
    const out = []; let buf = []; let fence = null;
    const flush = () => {
      if (!buf.length) return;
      const chunk = buf.join('\n'); buf = [];
      let res = '', last = 0;
      for (const m of chunk.matchAll(/(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g)) { res += fn(chunk.slice(last, m.index)) + m[0]; last = m.index + m[0].length; }
      out.push(res + fn(chunk.slice(last)));
    };
    for (const l of lines) {
      const f = /^\s{0,3}(`{3,}|~{3,})/.exec(l);
      if (fence) { out.push(l); if (f && f[1][0] === fence[0] && f[1].length >= fence.length && /^\s{0,3}[`~]+\s*$/.test(l)) fence = null; continue; }
      if (f) { flush(); fence = f[1]; out.push(l); continue; }
      buf.push(l);
    }
    flush();
    return out.join('\n');
  }
  const COMMENT_RE = /<!--\s*comment:\s*([\s\S]*?)\s*-->/gi;
  const NOTE_RE = /%%(?!%)([\s\S]+?)%%/g;
  /** Markdown without review comments and hidden notes (a comment alone on its line leaves no blank line behind). */
  function stripHidden(md) {
    return mapOutsideCode(md, t => t
      .replace(/^[ \t]*<!--\s*comment:(?:(?!-->)[\s\S])*-->[ \t]*\n/gim, '')
      .replace(COMMENT_RE, '')
      .replace(NOTE_RE, ''));
  }
  const mdEsc = s => String(s).replace(/[\\[\]*_`]/g, c => '\\' + c);
  /** Markdown with comments and notes made visible for Pandoc: real Word/ODT comments, or bracketed text. */
  function visibleHidden(md, format) {
    let n = 0;
    const real = /^(docx|odt)$/.test(format || '');
    const date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    return mapOutsideCode(md, t => t
      .replace(COMMENT_RE, (_m, text) => {
        const body = mdEsc(String(text).replace(/\s+/g, ' ').trim());
        if (!real) return `[Comment: ${body}]{.mk-comment}`;
        n++; return `[${body}]{.comment-start id="${n}" author="Markooj" date="${date}"}[]{.comment-end id="${n}"}`;
      })
      .replace(NOTE_RE, (_m, text) => `[${mdEsc(text)}]{.mk-note}`));
  }
  /** opts.keepComments / opts.includeComments win; otherwise the "Include comments" setting (off by default). */
  function includeComments(opts) {
    const v = opts ? (opts.keepComments ?? opts.includeComments) : undefined;
    return v != null ? !!v : app.settings.get('exportComments', false) === true;
  }

  // Other modules can adjust what leaves the app: CSS for HTML/PDF/print, and the Markdown handed to Pandoc
  // (e.g. cross-references). app.exporter.addCss(css | fn(doc)), app.exporter.addMarkdownTransform(fn(md, ctx) → md)
  const extraCss = [], mdTransforms = [];
  function addCss(css) { extraCss.push(css); return () => { const i = extraCss.indexOf(css); if (i >= 0) extraCss.splice(i, 1); }; }
  function addMarkdownTransform(fn) { mdTransforms.push(fn); return () => { const i = mdTransforms.indexOf(fn); if (i >= 0) mdTransforms.splice(i, 1); }; }
  function moduleCss(doc) {
    const parts = [];
    for (const c of extraCss) { try { const v = typeof c === 'function' ? c(doc) : c; if (v) parts.push(String(v)); } catch (e) { console.warn('exporter css', e); } }
    // equation numbers: the cross-reference module's layout when it has one, else a fixed gutter
    let x = null; try { x = app.xref?.exportCss?.(doc); } catch {}
    parts.push(x ? String(x) : EQ_GUTTER_CSS);
    return parts.join('\n');
  }
  /** The Markdown Pandoc receives: hidden content handled, then module transforms (cross-references and so on). */
  async function exportMarkdown(doc, format, opts = {}) {
    const keep = includeComments(opts);
    let md = keep ? visibleHidden(doc.text || '', format) : stripHidden(doc.text || '');
    const ctx = { doc, format, includeComments: keep };
    // cross-references: app.xref.exportMarkdown(text, doc, {format}) turns labels and [@eq:x] into plain numbers
    try { if (app.xref?.exportMarkdown) md = (await app.xref.exportMarkdown(md, doc, ctx)) ?? md; } catch (e) { console.warn('xref export', e); }
    // what only Markooj draws (callout boxes, Mermaid diagrams) becomes something every Pandoc format can hold
    if (!/^(md|markdown|txt)$/.test(format || '')) {
      try { md = calloutsForPandoc(md); } catch (e) { console.warn('callout export', e); }
      try { md = await mermaidForPandoc(md); } catch (e) { console.warn('mermaid export', e); }
      // one body text size per document (Home → Font size): Pandoc's "fontsize" (LaTeX class option, and main reads it for DOCX/ODT)
      try { md = withFontSize(md, docFontSize(doc)); } catch (e) { console.warn('fontsize export', e); }
    }
    for (const fn of mdTransforms) { try { md = (await fn(md, ctx)) ?? md; } catch (e) { console.warn('exporter transform', e); } }
    return md;
  }
  /** The document's body text size in points (front matter "fontsize", else the default size), or null. */
  function docFontSize(doc) {
    try { const v = app.layout?.fontSize?.(doc); if (v > 0) return +v; } catch {}
    return null;
  }
  /** Adds "fontsize: 12pt" to the front matter when the document has none (keeps everything else as written). */
  function withFontSize(md, pt) {
    if (!pt) return md;
    const line = `fontsize: ${+(+pt).toFixed(1)}pt`;
    const m = /^(﻿?---[ \t]*\r?\n)([\s\S]*?)(\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$))/.exec(md);
    if (m) {
      if (/^fontsize[ \t]*:/im.test(m[2])) return md;
      return m[1] + m[2] + (m[2] ? '\n' : '') + line + m[3] + md.slice(m[0].length);
    }
    return `---\n${line}\n---\n\n` + md;
  }

  // Obsidian / GitHub callouts "> [!NOTE] Title" → a quote that starts with a bold title (Pandoc has no callouts)
  function calloutsForPandoc(md) {
    return mapOutsideCode(md, t => t.replace(/^([ \t]{0,3}>[ \t]?)\[!(\w+)\][+-]?[ \t]*(.*)$/gm, (_m, pre, kind, title) => {
      const name = title.trim() || kind[0].toUpperCase() + kind.slice(1).toLowerCase();
      return `${pre}**${name}**\n${pre.replace(/[ \t]+$/, '')}`;
    }));
  }

  // ```mermaid fences → a picture (PNG, light theme). Code fences of other kinds are left alone.
  let mmdSeq = 0;
  async function mermaidPicture(src) {
    const m = window.mermaid; if (!m?.render) return null;
    // a per-diagram directive keeps the on-screen settings untouched; plain SVG labels draw on a canvas
    const head = '%%{init: {"theme": "neutral", "htmlLabels": false, "flowchart": {"htmlLabels": false}}}%%\n';
    const { svg } = await m.render('mk-exp-mmd-' + (++mmdSeq), head + src);
    const box = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
    const vb = (box.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    const w = Math.ceil(vb[2] || parseFloat(box.getAttribute('width')) || 600), hgt = Math.ceil(vb[3] || parseFloat(box.getAttribute('height')) || 400);
    box.setAttribute('width', w); box.setAttribute('height', hgt); box.removeAttribute('style');
    const xml = new XMLSerializer().serializeToString(box);
    const svgUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
    try {
      const img = new Image(); img.decoding = 'sync';
      await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('diagram picture')); img.src = svgUri; });
      const scale = 2, c = document.createElement('canvas'); c.width = w * scale; c.height = hgt * scale;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.scale(scale, scale); g.drawImage(img, 0, 0, w, hgt);
      return { uri: c.toDataURL('image/png'), w };
    } catch { return { uri: svgUri, w }; } // a canvas Chromium refuses to read: Pandoc embeds the SVG instead
  }
  async function mermaidForPandoc(md) {
    if (!/^\s{0,3}(`{3,}|~{3,})\s*\{?\.?mermaid\b/m.test(md)) return md;
    const lines = md.split('\n'), out = [];
    for (let i = 0; i < lines.length; i++) {
      const f = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(lines[i]);
      if (!f) { out.push(lines[i]); continue; }
      const fence = f[1]; let j = i + 1;
      while (j < lines.length && !(new RegExp('^\\s{0,3}' + fence[0] + '{' + fence.length + ',}\\s*$').test(lines[j]))) j++;
      const block = lines.slice(i, j + 1);
      if (/^\s*\{?\.?mermaid\b/.test(f[2]) && j < lines.length) {
        let pic = null; try { pic = await mermaidPicture(lines.slice(i + 1, j).join('\n')); } catch (e) { console.warn('mermaid export', e); }
        if (pic) { out.push(`![](${pic.uri}){width=${Math.min(100, Math.round(pic.w / 6.2))}%}`); i = j; continue; }
      }
      out.push(...block); i = j;
    }
    return out.join('\n');
  }

  // ---------- asset helpers ----------
  async function fetchText(url) { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`); return r.text(); }
  function toBase64(buf) {
    const bytes = new Uint8Array(buf); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  let katexCssCache = null, hljsCssCache = null;
  /** KaTeX CSS with every woff2 font embedded as a data URI (so exports work offline anywhere). */
  async function katexCss() {
    if (katexCssCache) return katexCssCache;
    const base = '../node_modules/katex/dist/';
    let css;
    try { css = await fetchText(base + 'katex.min.css'); }
    catch (e) { console.warn('exporter: KaTeX CSS not readable', e); return ''; }
    const fonts = [...new Set([...css.matchAll(/url\((fonts\/[^)]+?\.woff2)\)/g)].map(m => m[1]))];
    const map = {};
    await Promise.all(fonts.map(async f => {
      try { const r = await fetch(base + f); if (r.ok) map[f] = 'data:font/woff2;base64,' + toBase64(await r.arrayBuffer()); } catch {}
    }));
    css = css.replace(/src:url\((fonts\/[^)]+?\.woff2)\)\s*format\("woff2"\)(?:\s*,\s*url\([^)]*\)\s*format\("[^"]*"\))*/g,
      (m, f) => map[f] ? `src:url(${map[f]}) format("woff2")` : m.replace(/url\((fonts\/[^)]+)\)/g, (_x, p) => `url(${new URL(base + p, location.href).href})`));
    if (Object.keys(map).length) katexCssCache = css;
    return css;
  }
  async function hljsCss() {
    if (hljsCssCache != null) return hljsCssCache;
    try { hljsCssCache = (await fetchText('../node_modules/highlight.js/styles/github.css')).replace(/\/\*[\s\S]*?\*\//g, ''); }
    catch { hljsCssCache = ''; }
    return hljsCssCache;
  }

  // Page size follows Layout → Size when the editor role exposes it (app.layout.pageSize → {w, h} in CSS px).
  function pageCss(doc) {
    // Layout tab (editor role): page size, margins, fonts, spacing, columns and theme as standalone CSS
    try { const css = app.layout?.cssFor?.(doc, { selector: '.mk-page' }); if (css) return [css, app.layout?.exportCss?.(doc) || ''].join(String.fromCharCode(10)); } catch {}
    let size = '';
    try { const ps = app.layout?.pageSize?.(doc); if (ps && ps.w && ps.h) size = `size:${(ps.w / 96).toFixed(2)}in ${(ps.h / 96).toFixed(2)}in;`; } catch {}
    let extra = '';
    try { extra = app.layout?.exportCss?.(doc) || ''; } catch {}
    return `@page{${size}margin:22mm 20mm 22mm 20mm}\n${extra}`;
  }

  // ---------- metadata ----------
  function metaOf(doc) {
    let meta = {};
    try { meta = mk.frontMatter ? (mk.frontMatter.parse(doc.text || '').meta || {}) : (doc.meta || {}); } catch { meta = doc.meta || {}; }
    if (!Object.keys(meta).length && doc.meta) meta = doc.meta;
    return meta;
  }
  const flat = v => Array.isArray(v) ? v.join(', ') : (v == null ? '' : String(v));

  function fileUrl(p) {
    const s = String(p).replace(/\\/g, '/');
    return 'file:///' + s.replace(/^\/+/, '').split('/').map((seg, i) => (i === 0 && /^[A-Za-z]:$/.test(seg)) ? seg : encodeURIComponent(seg)).join('/');
  }
  function docDir(doc) { return doc.path ? doc.path.replace(/[\\/][^\\/]*$/, '') : null; }

  // ---------- render a doc into an offscreen stage ----------
  async function renderStage(doc, opts = {}) {
    // typing the Word editor has not committed yet must be in doc.text before we read it
    try { if (doc === app.docs.active()) app.editors.active?.()?.flush?.(); } catch {}
    const keep = includeComments(opts);
    const src = keep ? mapOutsideCode(doc.text || '', t => t.replace(NOTE_RE, (_m, x) => `<span class="mk-note">${esc(x)}</span>`)) : stripHidden(doc.text || '');
    const r = await app.render(src, { doc });
    const stage = document.createElement('div');
    stage.className = 'mk-page mk-export-stage';
    stage.setAttribute('aria-hidden', 'true');
    // opacity (not visibility) keeps innerText working; off-screen keeps it out of sight
    stage.style.cssText = 'position:fixed;left:-30000px;top:0;width:602px;opacity:0;pointer-events:none;z-index:-1';
    // parsed in an inert document first: a picture written as C:/… or file:/// (other editors) would otherwise make the window try
    // to load it as file:/// before decorate runs; it shows through markooj://local like in the editors (original kept in data-mk-src)
    const box = document.implementation.createHTMLDocument('').createElement('div');
    box.innerHTML = r.html || '';
    for (const img of box.querySelectorAll('img[src]')) {
      const s = img.getAttribute('src');
      if (/^(?:[a-z]:[\\/]|file:)/i.test(s)) { let u = null; try { u = app.assetUrl?.(doc, s); } catch {} if (u) { img.setAttribute('data-mk-src', s); img.setAttribute('src', u); } }
    }
    stage.append(...[...box.childNodes].map(n => document.adoptNode(n)));
    document.body.appendChild(stage);
    try { await app.decorate(stage, doc); } catch (e) { console.warn('exporter: decorate failed', e); }
    return { stage, r };
  }
  function cleanStage(stage, doc, opts) {
    stage.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable'));
    stage.querySelectorAll('[spellcheck]').forEach(e => e.removeAttribute('spellcheck'));
    stage.querySelectorAll('a.header-anchor').forEach(e => e.remove());
    if (opts.forPrint) stage.querySelectorAll('a.footnote-backref').forEach(e => e.remove()); // "↩" links mean nothing on paper
    if (!opts.keepComments) stage.querySelectorAll('.mk-comment, .mk-note, .mk-hidden-note').forEach(e => e.remove());
    else stage.querySelectorAll('.mk-comment').forEach(e => { e.removeAttribute('title'); if (!e.textContent.trim()) e.textContent = 'Comment: ' + (e.getAttribute('data-text') || ''); });
    stage.querySelectorAll('input[type=checkbox]').forEach(e => e.setAttribute('disabled', ''));
    stage.querySelectorAll('[data-line]').forEach(e => e.removeAttribute('data-line'));
    const dir = docDir(doc);
    if (dir && opts.absoluteAssets) {
      stage.querySelectorAll('img[src]').forEach(img => {
        const src = img.getAttribute('src');
        if (!/^(data:|blob:|https?:|file:|markooj:|\/\/)/i.test(src)) img.setAttribute('src', app.assetUrl?.(doc, src) || fileUrl(dir + '/' + decodeURI(src)));
      });
    }
  }

  /** Full standalone HTML document for a Markdown doc. opts: {forPrint, absoluteAssets, keepComments} */
  async function buildHtml(doc = app.docs.active(), opts = {}) {
    if (!doc) throw new Error('No document to export.');
    const keepComments = includeComments(opts);
    const { stage } = await renderStage(doc, { keepComments });
    let body;
    try {
      cleanStage(stage, doc, { absoluteAssets: opts.forPrint, ...opts, keepComments });
      // pictures from other editors (src/pictures.js): file:/// addresses go in only after the stage leaves the live window, so the
      // window never tries (and fails) to load them; print keeps the markooj://local address it already has
      if (stage.querySelector('img[data-mk-file-src], img[data-mk-src]')) {
        const inert = document.implementation.createHTMLDocument('');
        inert.body.append(inert.adoptNode(stage));
        const abs = opts.forPrint || opts.absoluteAssets;
        for (const img of stage.querySelectorAll('img[data-mk-src]')) { if (!abs) img.setAttribute('src', img.getAttribute('data-mk-src')); img.removeAttribute('data-mk-src'); }
        for (const img of stage.querySelectorAll('img[data-mk-file-src]')) {
          if (!(abs && /^markooj:/i.test(img.getAttribute('src') || ''))) img.setAttribute('src', img.getAttribute('data-mk-file-src'));
          img.removeAttribute('data-mk-file-src');
        }
      }
      body = stage.innerHTML;
    }
    finally { stage.remove(); }
    const meta = metaOf(doc);
    const title = flat(meta.title) || doc.title || 'Document';
    const [kcss, hcss] = await Promise.all([katexCss(), hljsCss()]);
    const metas = [
      ['author', flat(meta.author)], ['keywords', flat(meta.keywords || meta.tags)],
      ['description', flat(meta.description || meta.abstract || meta.subject)], ['subject', flat(meta.subject)],
      ['date', flat(meta.date)], ['generator', 'Markooj'],
    ].filter(([, v]) => v).map(([n, v]) => `<meta name="${n}" content="${esc(v)}">`).join('\n');
    const lang = flat(meta.lang || meta.language) || 'en';
    return `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${metas}
<style>
${kcss}
${hcss}
${EXPORT_CSS}
${pageCss(doc)}
${moduleCss(doc)}
</style>
</head>
<body class="${opts.forPrint ? 'print' : 'screen'}">
<article class="mk-page">
${body}
</article>
</body>
</html>
`;
  }

  /** Plain text from the rendered document (math kept as TeX, diagrams as source). */
  async function plainText(doc = app.docs.active(), opts = {}) {
    const keepComments = includeComments(opts);
    const { stage } = await renderStage(doc, { keepComments });
    try {
      cleanStage(stage, doc, { keepComments });
      stage.querySelectorAll('.mk-comment').forEach(c => c.replaceWith(document.createTextNode(` [${c.textContent.trim()}] `)));
      stage.querySelectorAll('.mk-math').forEach(m => {
        const tex = m.getAttribute('data-tex') || '';
        const disp = m.classList.contains('display');
        // the equation number the text refers to ("Eq. (1.1)") stays next to its equation
        const no = (m.querySelector('.mk-eqno, .eq-num')?.textContent || m.closest('.mk-math-block')?.querySelector(':scope > .mk-eqno, :scope > .eq-num')?.textContent || '').trim();
        m.replaceWith(document.createTextNode(disp ? `\n${tex}${no ? '    ' + no : ''}\n` : tex));
      });
      stage.querySelectorAll('pre.mermaid').forEach(p => { p.textContent = p.getAttribute('data-src') || ''; });
      stage.querySelectorAll('.katex-mathml').forEach(e => e.remove());
      stage.querySelectorAll('.mk-cite').forEach(c => { c.textContent = c.textContent; });
      let txt = stage.innerText || stage.textContent || '';
      txt = txt.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
      return txt;
    } finally { stage.remove(); }
  }

  // ---------- formats ----------
  // Exporters added by add-ins: app.exporter.register({id, label, ext, description, run(doc, ctx)})
  // run returns a string, Uint8Array, ArrayBuffer or Blob; ctx = {markdown, meta, html(), plainText()}
  const custom = new Map();
  function register(def = {}) {
    const id = String(def.id || '').trim();
    if (!/^[\w.-]+$/.test(id) || typeof def.run !== 'function') throw new Error('An exporter needs an id (letters, digits, - . _) and a run(doc, ctx) function.');
    custom.set(id, { id, label: def.label || id, ext: String(def.ext || id).replace(/^\./, ''), description: def.description || '', run: def.run });
    fmtCache = null;
    return () => { custom.delete(id); fmtCache = null; };
  }
  let fmtCache = null, fmtAt = 0;
  async function formats() {
    if (fmtCache && Date.now() - fmtAt < 30000) return fmtCache;
    let list = [];
    try { list = (await mk.invoke('export-formats')) || []; } catch (e) { console.warn('export-formats unavailable', e); }
    const byId = new Map();
    for (const f of BUILTIN) byId.set(f.id, { ...f });
    for (const f of list) if (f && f.id) byId.set(f.id, { ...(byId.get(f.id) || {}), ...f, via: f.via || byId.get(f.id)?.via || 'built-in' });
    byId.delete('md'); byId.delete('markdown');
    for (const c of custom.values()) if (!byId.has(c.id)) byId.set(c.id, { id: c.id, label: c.label, ext: c.ext, description: c.description, available: true, via: 'add-in' });
    fmtCache = [...byId.values()]; fmtAt = Date.now();
    return fmtCache;
  }
  const cleanErr = e => String(e && e.message || e).replace(/^Error invoking remote method '[^']+':\s*/, '').replace(/^(Error:\s*)+/, '');
  const baseName = p => String(p).split(/[\\/]/).pop();

  /** Writes doc to `out` in `format` with no dialog (used by export() and the smoke test). */
  async function exportTo(format, doc, out, opts = {}) {
    // a Markdown copy is the document itself: it keeps comments and notes
    if (format === 'md' || format === 'markdown') { await mk.invoke('write-text', out, doc.text || ''); return out; }
    if (format === 'txt') { await mk.invoke('write-text', out, await plainText(doc, opts)); return out; }
    const cx = custom.get(format);
    if (cx) {
      const keep = includeComments(opts);
      let res = await cx.run(doc, { markdown: keep ? doc.text || '' : stripHidden(doc.text || ''), meta: metaOf(doc), html: o => buildHtml(doc, { ...opts, ...(o || {}) }), plainText: () => plainText(doc, opts), includeComments: keep });
      if (res instanceof Blob) res = new Uint8Array(await res.arrayBuffer());
      else if (res instanceof ArrayBuffer) res = new Uint8Array(res);
      const payload = res instanceof Uint8Array ? { data: toBase64(res) } : { text: String(res ?? '') };
      return (await mk.invoke('export', { format: 'raw', out, ...payload })) || out;
    }
    const html = await buildHtml(doc, { ...opts, forPrint: format !== 'html', absoluteAssets: format !== 'html' });
    const meta = metaOf(doc);
    const plainMeta = {};
    for (const [k, v] of Object.entries(meta)) plainMeta[k] = Array.isArray(v) ? v.map(String) : (v == null ? '' : String(v));
    const md = await exportMarkdown(doc, format, opts);
    // Layout tab, References → Citation style and File → Render as go to Pandoc too (DOCX, ODT, LaTeX …)
    let layout = null; try { layout = app.layout?.get?.(doc) || null; } catch {}
    // body text size in points for DOCX/ODT styles (Home → Font size; one size per document)
    const fontSize = docFontSize(doc);
    if (fontSize) layout = { ...(layout || {}), fontSize };
    let citeStyle = null; try { citeStyle = app.research?.citeStyle?.() || null; } catch {}
    const renderAs = doc.renderAs || flat(meta['markooj-flavor']) || null;
    const r = await mk.invoke('export', { format, out, html, md, title: flat(meta.title) || doc.title, meta: plainMeta, docPath: doc.path || undefined, flavor: renderAs || doc.flavor?.name, renderAs, layout, citeStyle });
    return r || out;
  }

  /** Asks where to save, exports, and offers "Show in folder". Returns the out path or false. */
  async function exportDoc(format, doc = app.docs.active()) {
    if (!doc || doc.kind !== 'markdown') { app.ui.toast(doc ? app.t('Use “Edit as text” to make an editable copy, then save that copy in another format.') : app.t('Open or create a document first, then save it in another format.'), { kind: 'info' }); return false; }
    const list = await formats();
    const fmt = list.find(f => f.id === format) || (format === 'md' ? { id: 'md', label: 'Markdown', ext: 'md' } : { id: format, label: format.toUpperCase(), ext: format });
    if (fmt.available === false) {
      // the moment the user picks a format whose tool is not there: say how to get it (solution first)
      const needs = fmt.needs || (fmt.via === 'djvulibre' ? 'pdf2djvu' : fmt.via === 'pandoc' ? 'pandoc' : null);
      if (needs && app.health?.offer) { app.health.offer(needs, { feature: app.t(fmt.label) }); return false; }
      app.ui.toast(fmt.reason || app.t('Choose another format: {format} is not available in this copy of Markooj.', { format: app.t(fmt.label) }), { kind: 'info' }); return false;
    }
    const ext = fmt.ext || format;
    let base = doc.path ? doc.path.replace(/\.[^.\\/]+$/, '') : (doc.title || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-');
    // never suggest the original Word/ODT file of a converted document as the export target
    if (doc.path && (doc.convertedFrom || doc.ext || '').toLowerCase() === String(ext).toLowerCase()) base += ' (edited)';
    let out;
    try { out = await mk.invoke('save-dialog', { defaultPath: `${base}.${ext}`, filters: [{ name: fmt.label ? app.t(fmt.label) : ext.toUpperCase(), extensions: [ext] }] }); }
    catch (e) { app.ui.toast(app.t('Try again: the Save window did not open.'), { kind: 'error', actions: [{ label: app.t('Try again'), run: () => exportDoc(format, doc) }] }); console.error(e); return false; }
    if (!out) return false;
    const busy = app.ui.toast(app.t('Exporting {file}…', { file: baseName(out) }), { kind: 'info', timeout: 0 });
    try {
      const done = await exportTo(fmt.id, doc, out);
      busy?.close?.();
      // Word and ODT show Urdu, Arabic and Persian in the script font only when it is installed on that computer
      let note = '';
      try {
        const dir = app.lang?.docDir?.(doc), lang = app.lang?.docLang?.(doc) || '';
        if (/^(docx|odt)$/.test(fmt.id) && dir === 'rtl') {
          const font = { ur: 'Noto Nastaliq Urdu', ar: 'Noto Naskh Arabic', fa: 'Vazirmatn' }[String(lang).split('-')[0].toLowerCase()];
          if (font) note = font;
        }
      } catch {}
      app.ui.toast(note ? app.t('Exported {file}. Word uses {font} when it is installed on the computer that opens the file.', { file: baseName(done), font: note }) : app.t('Exported {file}.', { file: baseName(done) }), { action: { label: app.t('Show in folder'), run: () => mk.invoke('reveal', done) } });
      app.events.emit('doc:exported', { doc, format: fmt.id, out: done });
      // formats that need Pandoc: counted, so a broken Pandoc is worth a startup message only for people who use it
      if (fmt.via === 'pandoc') { try { app.health?.noteUse?.('pandoc'); } catch {} }
      return done;
    } catch (e) {
      busy?.close?.();
      console.error(e);
      // main's message already leads with the fix and carries its buttons (Try again, Save to another folder, Choose another format …)
      const again = () => exportDoc(format, doc);
      if (app.health?.toastError) app.health.toastError(e, { retry: again, saveAs: again, chooseFormat: () => app.backstage?.open?.('saveas') });
      else app.ui.toast(app.t('{message} ({file})', { message: cleanErr(e), file: baseName(out) }), { kind: 'error', actions: [{ label: app.t('Try again'), run: again }] });
      return false;
    }
  }

  async function print(doc = app.docs.active(), opts = {}) {
    if (!doc || doc.kind !== 'markdown') { app.ui.toast(doc ? app.t('Use “Edit as text” to make an editable copy, then print that copy. Markooj prints the documents you write.') : app.t('Open a document first, then print it.'), { kind: 'info' }); return false; }
    try {
      const html = await buildHtml(doc, { ...opts, forPrint: true, absoluteAssets: true });
      await mk.invoke('print', { html, title: flat(metaOf(doc).title) || doc.title });
      return true;
    } catch (e) {
      console.error(e);
      app.ui.toast(app.t('Try printing again, or save as PDF and print that file.'), { kind: 'error', actions: [{ label: app.t('Try again'), run: () => print(doc, opts) }, { label: app.t('Save as PDF'), run: () => exportDoc('pdf', doc) }] });
      return false;
    }
  }

  app.exporter = { buildHtml, export: exportDoc, exportTo, print, formats, refreshFormats: () => { fmtCache = null; }, plainText, metaOf, katexCss, EXPORT_CSS, register, unregister: id => { const had = custom.delete(String(id)); if (had) fmtCache = null; return had; }, custom: () => [...custom.values()],
    stripHidden, visibleHidden, exportMarkdown, addCss, addMarkdownTransform, includeComments: () => includeComments(null) };

  app.tests.register('exporter: comments and hidden notes stay out of exports unless asked', async () => {
    const A = app.assert;
    const src = '# T\n\nVisible %%secret note%% text.<!-- comment: check this -->\n\n<!-- comment: alone -->\n\nCode `%%kept%%` here.\n\n```\n%%in fence%%\n```\n';
    const s = stripHidden(src);
    A(!/secret note|check this|alone/.test(s), 'stripped: ' + s);
    A(/`%%kept%%`/.test(s) && /%%in fence%%/.test(s), 'code untouched');
    A(!/\n\n\n\n/.test(s), 'no empty gap left by a lone comment');
    const v = visibleHidden(src, 'docx');
    A(/\{\.comment-start id="1" author="Markooj"/.test(v) && /\[secret note\]\{\.mk-note\}/.test(v), 'docx gets real comments: ' + v);
    A(/\[Comment: check this\]\{\.mk-comment\}/.test(visibleHidden(src, 'epub')), 'other formats get bracketed text');
    const doc = app.docs.create({ title: 'Hidden export test', text: src });
    const prev = app.settings.get('exportComments', false);
    try {
      app.settings.set('exportComments', false);
      const html = await buildHtml(doc);
      A(!/secret note/.test(html) && !/check this/.test(html), 'HTML has no notes or comments by default');
      A(/Visible/.test(html), 'normal text kept');
      const md = await exportMarkdown(doc, 'docx');
      A(!/secret note|check this/.test(md), 'Pandoc Markdown is clean');
      const kept = await buildHtml(doc, { keepComments: true });
      A(/secret note/.test(kept) && /check this/.test(kept), 'kept when asked');
      const txt = await plainText(doc);
      A(!/secret note|check this/.test(txt), 'plain text is clean: ' + txt);
    } finally { app.settings.set('exportComments', prev); await app.docs.close(doc.id, { force: true }); }
  });
  app.tests.register('exporter: numbered equations keep a gutter in exports', () => {
    const css = moduleCss({ text: '' });
    app.assert(app.xref?.exportCss ? css.length > 0 : css.includes(EQ_GUTTER_CSS), 'equation layout CSS goes into exports');
  });

  app.tests.register('exporter: add-in formats are listed and written', async () => {
    const off = register({ id: 'smoke-upper', label: 'Upper case', ext: 'up', run: d => String(d.text).toUpperCase() });
    try {
      const list = await formats();
      app.assert(list.some(f => f.id === 'smoke-upper' && f.via === 'add-in'), 'listed as add-in format');
      const info = await mk.invoke('app-info');
      const out = info.userData.replace(/[\/]+$/, '') + '/smoke-addin-export.up';
      const d = { text: 'abc $x$', title: 'T', kind: 'markdown' };
      await exportTo('smoke-upper', d, out);
      const back = await mk.invoke('read-text', out);
      app.assert(back === 'ABC $X$', 'written text: ' + back);
    } finally { off(); }
  });
  app.tests.register('exporter: buildHtml contains katex markup and embedded fonts', async () => {
    const doc = app.docs.create({ title: 'Export test', text: '---\ntitle: Export Test\nauthor: Tester\nkeywords: a, b\n---\n\n# Heading\n\nDollar $x^2$ and paren \\(y_1\\).\n\n$$\n\\int_0^1 x\\,dx\n$$\n' });
    try {
      const html = await app.exporter.buildHtml(doc);
      app.assert(/^<!doctype html>/i.test(html), 'doctype');
      app.assert(/class="katex/.test(html), 'katex markup present');
      app.assert(/<title>Export Test<\/title>/.test(html), 'title from front matter');
      app.assert(/<meta name="author" content="Tester">/.test(html), 'author meta');
      app.assert(/@font-face/.test(html) && /data:font\/woff2;base64,/.test(html), 'KaTeX fonts embedded');
      app.assert(!/contenteditable/.test(html), 'no contenteditable in export');
      const txt = await app.exporter.plainText(doc);
      app.assert(/Heading/.test(txt) && /x\^2/.test(txt), 'plain text keeps TeX: ' + txt.slice(0, 80));
    } finally { await app.docs.close(doc.id, { force: true }); }
  });
})();
