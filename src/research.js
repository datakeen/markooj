// Markooj — research: References + Review tabs, citations (BibTeX), table of contents, footnotes,
// cross-references, equation numbers, word count, comments, compare, and the Find & Replace panel.
// Owns app.research. See ARCHITECTURE.md.
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const mk = app.mk || window.mk || {};
  const esc = app.esc;
  const icon = (name, cls = '') => `<svg class="i${cls ? ' ' + cls : ''}"><use href="#${name}"/></svg>`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const WIN = (mk.platform || navigator.platform || '').toLowerCase().startsWith('win');

  // =================================================================== styles
  function injectCss() {
    if (document.getElementById('mkr-css')) return;
    const s = document.createElement('style'); s.id = 'mkr-css';
    s.textContent = `
/* find & replace panel */
.mkr-find{position:fixed;z-index:45;width:392px;padding:8px;border-radius:var(--r-lg,12px);background:var(--chrome-solid,#fbfbfd);box-shadow:var(--pop-shadow,0 12px 40px rgba(0,0,0,.16),0 0 0 .5px rgba(0,0,0,.08));color:var(--text,#1d1d1f);font:13px/1.4 var(--font,system-ui);display:flex;flex-direction:column;gap:6px;opacity:0;transform:translateY(-6px) scale(.98);pointer-events:none;transition:opacity .18s,transform .25s var(--ease,ease)}
.mkr-find.show{opacity:1;transform:none;pointer-events:auto}
.mkr-frow{display:flex;align-items:center;gap:4px}
.mkr-field{flex:1;min-width:0;height:28px;border-radius:8px;background:var(--hover,rgba(0,0,0,.05));display:flex;align-items:center;gap:6px;padding:0 9px;color:var(--text-3,#a1a1a6);transition:background .2s,box-shadow .2s}
.mkr-field:focus-within{background:var(--surface,#fff);box-shadow:0 0 0 3px var(--accent-ring,rgba(10,102,255,.28))}
.mkr-field.bad{box-shadow:0 0 0 2px rgba(220,38,38,.55)}
.mkr-field input{flex:1;min-width:0;border:0;outline:0;background:none;font:inherit;color:var(--text,#1d1d1f)}
.mkr-count{min-width:64px;text-align:right;font-size:11.5px;color:var(--text-3,#a1a1a6);font-variant-numeric:tabular-nums;white-space:nowrap}
.mkr-count.none{color:#d70015}
.mkr-ib{width:28px;height:28px;border-radius:7px;display:grid;place-items:center;color:var(--text-2,#6e6e73);background:none;border:0;flex:none;transition:background .15s,color .15s,transform .12s var(--ease,ease)}
.mkr-ib:hover{background:var(--hover,rgba(0,0,0,.05));color:var(--text,#1d1d1f)}
.mkr-ib:active{background:var(--press,rgba(0,0,0,.09));transform:scale(.92)}
.mkr-ib svg.i,.mkr-field svg.i,.mkr-btn svg.i,.mkr-chip svg.i{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.mkr-ib .up{transform:rotate(180deg)}
.mkr-ib .right{transform:rotate(-90deg);transition:transform .25s var(--ease,ease)}
.mkr-find.rep .mkr-ib .right{transform:none}
.mkr-opts{display:flex;gap:4px;padding-left:32px}
.mkr-opt{height:22px;padding:0 9px;border-radius:11px;border:0;background:var(--hover,rgba(0,0,0,.05));color:var(--text-2,#6e6e73);font:500 11px var(--font,system-ui);transition:background .15s,color .15s,transform .12s var(--ease,ease)}
.mkr-opt:hover{color:var(--text,#1d1d1f);background:var(--press,rgba(0,0,0,.09))}
.mkr-opt:active{transform:scale(.95)}
.mkr-opt.on{background:var(--accent-soft,rgba(10,102,255,.1));color:var(--accent,#0a66ff)}
.mkr-rep{display:none;padding-left:32px}
.mkr-find.rep .mkr-rep{display:flex}
.mkr-find.noreplace .mkr-rep,.mkr-find.noreplace [data-a="toggle"]{display:none}
.mkr-btn{height:28px;padding:0 11px;border-radius:7px;border:.5px solid var(--line-2,rgba(0,0,0,.12));background:var(--surface,#fff);color:var(--text,#1d1d1f);font:500 12px var(--font,system-ui);white-space:nowrap;transition:border-color .15s,background .15s,transform .12s var(--ease,ease)}
.mkr-btn:hover{border-color:var(--accent,#0a66ff)}
.mkr-btn:active{transform:scale(.96);background:var(--hover,rgba(0,0,0,.05))}
.mkr-btn.primary{background:var(--accent,#0a66ff);border-color:transparent;color:#fff}
.mkr-btn.primary:hover{background:var(--accent-2,#3d8bff)}
::highlight(mkr-find){background-color:rgba(255,214,10,.45)}
::highlight(mkr-find-cur){background-color:rgba(255,159,10,.75)}

/* dialogs */
.mkr-dlg{display:flex;flex-direction:column;gap:10px;min-width:min(520px,80vw);font:13px/1.4 var(--font,system-ui);color:var(--text,#1d1d1f)}
.mkr-dlg .mkr-field{flex:none}
.mkr-list{max-height:min(46vh,380px);overflow:auto;border-radius:10px;border:.5px solid var(--line,rgba(0,0,0,.08));background:var(--surface,#fff);padding:4px;outline:none}
.mkr-row{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-radius:7px;cursor:default;transition:background .12s}
.mkr-row:hover{background:var(--hover,rgba(0,0,0,.05))}
.mkr-row.act{background:var(--accent-soft,rgba(10,102,255,.1))}
.mkr-row.sel{background:var(--accent-soft,rgba(10,102,255,.1))}
.mkr-row input{margin:2px 0 0;accent-color:var(--accent,#0a66ff)}
.mkr-row b{display:block;font-weight:600}
.mkr-row span{display:block;color:var(--text-2,#6e6e73);font-size:12.5px}
.mkr-row small{display:block;color:var(--text-3,#a1a1a6);font-size:11px;margin-top:1px}
.mkr-row .kind{flex:none;font:600 9.5px var(--font,system-ui);letter-spacing:.03em;padding:2px 6px;border-radius:4px;background:var(--hover,rgba(0,0,0,.05));color:var(--text-2,#6e6e73);margin-top:1px;min-width:60px;text-align:center}
.mkr-empty{padding:26px 16px;text-align:center;color:var(--text-2,#6e6e73);line-height:1.5}
.mkr-empty b{display:block;color:var(--text,#1d1d1f);font-size:14px;margin-bottom:4px}
.mkr-empty .mkr-btn{margin-top:12px}
.mkr-foot{display:flex;align-items:center;gap:10px;color:var(--text-2,#6e6e73);font-size:12px}
.mkr-foot input{height:26px;width:120px;border-radius:6px;border:.5px solid var(--line-2,rgba(0,0,0,.12));background:var(--surface,#fff);color:var(--text,#1d1d1f);padding:0 8px;font:inherit;outline:none}
.mkr-foot input:focus{border-color:var(--accent,#0a66ff);box-shadow:0 0 0 3px var(--accent-ring,rgba(10,102,255,.28))}
.mkr-foot code{font:12px var(--mono,monospace);color:var(--accent,#0a66ff);background:var(--accent-soft,rgba(10,102,255,.1));padding:1px 6px;border-radius:5px}
.mkr-foot .grow{flex:1}
.mkr-seg{display:inline-flex;background:var(--hover,rgba(0,0,0,.05));border-radius:8px;padding:2px;gap:2px;align-self:flex-start}
.mkr-seg button{height:24px;padding:0 12px;border-radius:6px;border:0;background:none;font:500 12px var(--font,system-ui);color:var(--text-2,#6e6e73);transition:color .2s,background .2s,box-shadow .2s}
.mkr-seg button.on{color:var(--text,#1d1d1f);background:var(--surface,#fff);box-shadow:0 1px 3px rgba(0,0,0,.12),0 0 0 .5px rgba(0,0,0,.04)}
.mkr-seg button:disabled{opacity:.4}
.mkr-stats{display:grid;grid-template-columns:1fr 1fr;gap:0 28px}
.mkr-stat{display:flex;justify-content:space-between;padding:6px 0;border-bottom:.5px solid var(--line,rgba(0,0,0,.08));color:var(--text-2,#6e6e73)}
.mkr-stat b{color:var(--text,#1d1d1f);font-weight:600;font-variant-numeric:tabular-nums}
.mkr-note{font-size:11.5px;color:var(--text-3,#a1a1a6);line-height:1.45}
.mkr-h{font:600 11px var(--font,system-ui);letter-spacing:.06em;text-transform:uppercase;color:var(--text-3,#a1a1a6);margin:6px 0 0}
.mkr-diff{max-height:min(56vh,520px);overflow:auto;border-radius:10px;border:.5px solid var(--line,rgba(0,0,0,.08));background:var(--surface,#fff);font:12.5px/1.55 var(--mono,monospace)}
.mkr-dl{display:grid;grid-template-columns:42px 42px 18px 1fr;white-space:pre-wrap;word-break:break-word}
.mkr-dl .ln{color:var(--text-3,#a1a1a6);text-align:right;padding-right:8px;font-size:11px;user-select:none}
.mkr-dl .sg{color:var(--text-3,#a1a1a6);user-select:none}
.mkr-dl.add{background:rgba(40,167,69,.12)}.mkr-dl.add .sg,.mkr-dl.add .tx{color:#1c7c34}
.mkr-dl.del{background:rgba(220,38,38,.10)}.mkr-dl.del .sg,.mkr-dl.del .tx{color:#b42318;text-decoration:line-through;text-decoration-color:rgba(180,35,24,.35)}
:root[data-theme="dark"] .mkr-dl.add .sg,:root[data-theme="dark"] .mkr-dl.add .tx{color:#5bd27a}
:root[data-theme="dark"] .mkr-dl.del .sg,:root[data-theme="dark"] .mkr-dl.del .tx{color:#ff7b72}
.mkr-dl.gap{background:var(--bg,#f5f5f7);color:var(--text-3,#a1a1a6);font:11.5px var(--font,system-ui);padding:3px 0 3px 102px;display:block}
.mkr-sum{display:flex;gap:12px;font-size:12px;color:var(--text-2,#6e6e73)}
.mkr-sum .a{color:var(--green,#28a745);font-weight:600}.mkr-sum .d{color:#dc2626;font-weight:600}

/* library chip in the References ribbon */
.mkr-chip{height:27px;max-width:132px;border-radius:6px;border:.5px solid var(--line-2,rgba(0,0,0,.12));background:var(--surface,#fff);display:inline-flex;align-items:center;gap:6px;padding:0 8px;font:12px var(--font,system-ui);color:var(--text,#1d1d1f);transition:border-color .15s,box-shadow .15s}
.mkr-chip:hover{border-color:var(--accent,#0a66ff)}
.mkr-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mkr-chip.none span{color:var(--text-3,#a1a1a6)}

/* rendered document decorations */
/* equation, figure and table numbers come from src/xref.js (one numbering system) */
.mk-cite.mkr-missing{color:#c2410c !important;background:rgba(255,159,10,.14) !important}
.mkr-bib{padding-left:0;margin:6px 0 0;list-style:none}
.mkr-bib li{margin:0 0 8px;padding-left:2em;text-indent:-2em;line-height:1.5}
.mkr-bib.ieee li{padding-left:2.6em;text-indent:0;position:relative}
.mkr-bib.ieee li .n{position:absolute;left:0;color:var(--text-2,#6e6e73)}
.mkr-bib a{word-break:break-all}
.mkr-flash{animation:mkrFlash 1.2s var(--ease,ease)}
@keyframes mkrFlash{0%,40%{background:rgba(255,159,10,.45)}100%{background:transparent}}
.mk-comment{display:inline-block;width:18px;height:16px;margin:0 2px;vertical-align:-2px;border-radius:5px;background:rgba(255,159,10,.2);cursor:pointer;user-select:none;transition:background .15s,transform .12s var(--ease,ease)}
.mk-comment::before{content:"";display:block;width:100%;height:100%;background:#c77700;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z'/%3E%3C/svg%3E") center/11px no-repeat}
.mk-comment:hover,.mk-comment.on{background:rgba(255,159,10,.38)}
.mk-comment::after{content:attr(data-text);display:none;position:absolute;z-index:5;width:220px;padding:8px 10px;border-radius:10px;background:var(--chrome-solid,#fbfbfd);box-shadow:var(--pop-shadow,0 12px 40px rgba(0,0,0,.16));border-left:3px solid var(--orange,#ff9f0a);font:12px/1.45 var(--font,system-ui);color:var(--text,#1d1d1f);white-space:pre-wrap;text-align:left;text-indent:0;cursor:default}
html.mkr-margin .mk-comment::after{display:block;right:-252px;margin-top:-4px}
html.mkr-margin .mk-comment.on::after,html.mkr-margin .mk-comment:hover::after{box-shadow:0 0 0 2px var(--orange,#ff9f0a),var(--pop-shadow)}
html:not(.mkr-margin) .mk-comment{position:relative}
html:not(.mkr-margin) .mk-comment:hover::after{display:block;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%)}
html.mkr-hide-comments .mk-comment{display:none}
`;
    document.head.appendChild(s);
  }

  // =================================================================== Markdown analysis
  const FRONT_RE = /^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
  function maskRanges(text, ranges) {
    if (!ranges.length) return text;
    let out = '', last = 0;
    for (const [a, b] of [...ranges].sort((x, y) => x[0] - y[0])) {
      if (b <= last) continue;
      const s = Math.max(a, last);
      out += text.slice(last, s) + text.slice(s, b).replace(/[^\n]/g, ' ');
      last = b;
    }
    return out + text.slice(last);
  }
  function collect(re, masked, map) { const out = []; re.lastIndex = 0; let m; while ((m = re.exec(masked))) { if (!m[0].length) { re.lastIndex++; continue; } out.push(map ? map(m) : [m.index, m.index + m[0].length]); } return out; }
  // Ranges of every construct we must treat specially (offsets into the original text).
  function analyze(text) {
    text = String(text || '');
    const R = { front: [], fenced: [], comments: [], inlineCode: [], displayMath: [], inlineMath: [], images: [], links: [], cites: [], fnRefs: [], fnDefs: [], html: [], urls: [] };
    const fm = FRONT_RE.exec(text); if (fm) R.front.push([0, fm[0].length]);
    const frontEnd = fm ? fm[0].length : 0;
    let pos = 0, open = null;
    for (const ln of text.split('\n')) {
      const start = pos; pos += ln.length + 1;
      if (start < frontEnd) continue;
      const f = /^ {0,3}(`{3,}|~{3,})/.exec(ln);
      if (open) { if (f && f[1][0] === open.ch && f[1].length >= open.len && /^ {0,3}[`~]+\s*$/.test(ln)) { R.fenced.push([open.start, Math.min(pos, text.length)]); open = null; } continue; }
      if (f && !(f[1][0] === '`' && ln.slice(f[0].length).includes('`'))) open = { ch: f[1][0], len: f[1].length, start };
    }
    if (open) R.fenced.push([open.start, text.length]);
    let m = maskRanges(text, [...R.front, ...R.fenced]);
    R.inlineCode = collect(/(`+)(?!`)[^\n]*?[^`\n]?\1(?!`)/g, m); m = maskRanges(m, R.inlineCode);
    R.comments = collect(/<!--[\s\S]*?-->/g, m, x => [x.index, x.index + x[0].length, text.slice(x.index, x.index + x[0].length)]); m = maskRanges(m, R.comments);
    R.displayMath = [
      ...collect(/\$\$[\s\S]+?\$\$/g, m, x => [x.index, x.index + x[0].length, x[0].slice(2, -2)]),
      ...collect(/\\\[[\s\S]+?\\\]/g, m, x => [x.index, x.index + x[0].length, x[0].slice(2, -2)]),
      ...collect(/\\begin\{(equation|align|gather|multline|eqnarray|displaymath|flalign)(\*?)\}[\s\S]*?\\end\{\1\2\}/g, m, x => [x.index, x.index + x[0].length, x[0], !!x[2]]),
    ].sort((a, b) => a[0] - b[0]);
    m = maskRanges(m, R.displayMath);
    R.inlineMath = [...collect(/\\\([\s\S]+?\\\)/g, m), ...collect(/(?<![\\$])\$(?![\s$])(?:\\.|[^$\\\n])+?(?<!\s)\$(?!\d)/g, m)];
    m = maskRanges(m, R.inlineMath);
    R.images = collect(/!\[[^\]\n]*\]\((?:[^()\s]|\([^()]*\))*(?:\s+["'][^"'\n]*["'])?\)|<img\b[^>]*>/gi, m); m = maskRanges(m, R.images);
    R.links = collect(/\]\((?:[^()\s]|\([^()]*\))*(?:\s+["'][^"'\n]*["'])?\)/g, m, x => [x.index + 1, x.index + x[0].length]);
    // [@fig:x] / [-@eq:y] are cross-references (src/xref.js), not citations
    R.cites = collect(/\[(-?@[^\]\n]+?)\]/g, m, x => [x.index, x.index + x[0].length, (x[1].match(/-?@[\w:.#$%&\-+?<>~/]+/g) || []).map(k => k.replace(/^-?@/, ''))])
      .filter(c => !c[2].length || !c[2].every(k => /^(eq|fig|tbl|sec):/i.test(k)));
    R.fnDefs = collect(/^\[\^([^\]\s]+)\]:/gm, m, x => [x.index, x.index + x[0].length, x[1]]);
    R.fnRefs = collect(/\[\^([^\]\s]+)\](?!:)/g, m, x => [x.index, x.index + x[0].length, x[1]]);
    R.html = collect(/<\/?[A-Za-z][\w-]*(?:\s[^<>]*)?\/?>/g, m);
    R.urls = collect(/\b(?:https?:\/\/|www\.)[^\s<>()[\]]+/g, m);
    R.masked = m;
    return R;
  }
  const inRanges = (ranges, a, b = a + 1) => ranges.some(r => a < r[1] && b > r[0]);

  // ---- headings (outline) with slugs that match markdown-it-anchor
  function slugify(s) { return String(s).toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'); }
  function typographer(s) {
    return s.replace(/\+-/g, '±').replace(/\.{2,}/g, '…').replace(/\((c|r|tm)\)/gi, '©')
      .replace(/(^|[^-])---(?=[^-]|$)/gm, '$1\u2014').replace(/(^|\s)--(?=\s|$)/gm, '$1\u2013').replace(/(^|[^-\s])--(?=[^-\s]|$)/gm, '$1\u2013');
  }
  function stripInline(src, forSlug) {
    let s = src;
    s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, forSlug ? '' : '');
    s = s.replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, forSlug ? '' : (_m, a, b) => b || a);
    s = s.replace(/\[-?@[^\]]+\]/g, '').replace(/\[\^[^\]]+\]/g, '');
    s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    if (forSlug) s = s.replace(/\$\$[\s\S]+?\$\$|\\\([\s\S]+?\\\)|(?<![\\$])\$(?![\s$])(?:\\.|[^$\\])+?\$/g, '');
    s = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<\/?[A-Za-z][^>]*>/g, '');
    s = s.replace(/`+([^`]*)`+/g, '$1');
    s = s.replace(/(\*\*|__|~~|==)(.+?)\1/g, '$2').replace(/(^|[^\w*])[*_]([^*_]+)[*_](?![\w*])/g, '$1$2');
    s = s.replace(/\\([\\`*_{}[\]()#+\-.!$|<>~=^])/g, '$1');
    return forSlug ? typographer(s) : s.trim();
  }
  function outline(text) {
    text = String(text || '');
    const A = analyze(text);
    const masked = maskRanges(text, [...A.front, ...A.fenced, ...A.comments, ...A.displayMath]);
    const lines = masked.split('\n'), orig = text.split('\n');
    const out = [], slugs = new Set();
    let offset = 0;
    const offs = lines.map(l => { const o = offset; offset += l.length + 1; return o; });
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      let level = 0, raw = '';
      const atx = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/.exec(ln);
      if (atx && ln.trim()) { level = atx[1].length; raw = (/^ {0,3}#{1,6}(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/.exec(orig[i]) || [])[1] || ''; }
      else if (i + 1 < lines.length && /^ {0,3}(=+|-+)[ \t]*$/.test(lines[i + 1]) && ln.trim() && !/^ {0,3}([-*+>|]|\d+[.)]\s|#)/.test(ln) && (i === 0 || !lines[i - 1].trim() || /^ {0,3}#/.test(lines[i - 1]))) {
        level = /=/.test(lines[i + 1]) ? 1 : 2; raw = orig[i].trim();
      }
      if (!level) continue;
      // Pandoc attributes at the end: "# Intro {#sec:intro}" → the id is the anchor, the braces are not text
      let id = null;
      const at = /[ \t]*\{[ \t]*((?:[#.][^\s{}]+|-)(?:[ \t]+[^\s{}]+)*)[ \t]*\}[ \t]*$/.exec(raw);
      if (at) { raw = raw.slice(0, at.index); const h = /(?:^|\s)#([^\s{}]+)/.exec(at[1]); if (h) id = h[1]; }
      const display = stripInline(raw, false);
      let slug = id || slugify(stripInline(raw, true));
      let u = slug, n = 1; if (!id) while (slugs.has(u)) u = `${slug}-${n++}`; slugs.add(u);
      out.push({ level, text: display, raw, slug: u, id, line: i, offset: offs[i] });
    }
    return out;
  }

  // ---- word count / statistics
  const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g;
  const ABBR = /\b(e\.g|i\.e|et al|etc|cf|vs|fig|figs|eq|eqs|no|vol|pp|p|dr|mr|mrs|ms|prof|approx|ca|resp|sec|ch|ref|refs)\.(?=\s+[a-z0-9(])/gi;
  function syllables(w) {
    w = w.toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; if (w.length <= 3) return 1;
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length);
  }
  function stats(text, opts = {}) {
    text = String(text || '');
    const md = opts.markdown !== false;
    let equations = 0, inlineEquations = 0, citations = 0, footnotes = 0, codeBlocks = 0;
    let t = text;
    if (md) {
      const A = analyze(text);
      equations = A.displayMath.length; inlineEquations = A.inlineMath.length;
      citations = A.cites.reduce((n, c) => n + c[2].length, 0);
      footnotes = new Set([...A.fnRefs, ...A.fnDefs].map(f => f[2])).size + (A.masked.match(/(^|[^\]!])\^\[/g) || []).length;
      codeBlocks = A.fenced.length;
      t = maskRanges(text, [...A.front, ...A.fenced, ...A.inlineCode, ...A.comments, ...A.displayMath, ...A.inlineMath, ...A.images, ...A.links, ...A.cites, ...A.fnRefs, ...A.html, ...A.urls]);
      t = t.replace(/\{[ \t]*(?:[#.][^\s{}]+|-)(?:[ \t]+[^\s{}]+)*[ \t]*\}/g, ' ') // labels {#fig:x} are not words
        .replace(/\[(?:-?@(?:eq|fig|tbl|sec):[\w.:-]*\w[;,\s]*)+\]|(^|[^\w@])@(?:eq|fig|tbl|sec):[\w.:-]*\w/gi, '$1 ref ') // a cross-reference reads as one word
        .replace(/^\[\^[^\]]+\]:/gm, ' ')
        .replace(/^ {0,3}([-*_])([ \t]*\1){2,}[ \t]*$/gm, '')
        .replace(/^ {0,3}\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/gm, '')
        .replace(/^ {0,3}(=+|-+)[ \t]*$/gm, '')
        .replace(/^ {0,3}:::.*$/gm, '')
        .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_m, a, b) => b || a)
        .replace(/!?\[([^\]]*)\]/g, '$1')
        .replace(/&nbsp;|&#160;/g, ' ').replace(/&[a-z]+;/g, 'x');
    }
    // paragraph starts: blank-line blocks, headings and list items each start a paragraph
    const lines = t.split('\n');
    let paragraphs = 0, nonEmpty = 0, sentences = 0, prevBlank = true;
    const units = [];
    for (let raw of lines) {
      const hasWord = /[\p{L}\p{N}]/u.test(raw);
      const starter = md && /^ {0,3}(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|\|)/.test(raw);
      let line = md ? raw.replace(/^ {0,3}(#{1,6}[ \t]+|(>[ \t]?)+|[-*+][ \t]+(\[[ xX]\][ \t]+)?|\d+[.)][ \t]+(\[[ xX]\][ \t]+)?)/, '').replace(/\|/g, ' ').replace(/[*~=]+/g, '').replace(/(^|[^\p{L}\p{N}])_+|_+(?=[^\p{L}\p{N}]|$)/gu, '$1') : raw;
      if (!hasWord) { if (!raw.trim()) prevBlank = true; continue; }
      nonEmpty++;
      if (prevBlank || starter) { paragraphs++; units.push(line); } else units[units.length - 1] += ' ' + line;
      prevBlank = false;
    }
    const clean = units.map(u => u.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const joined = clean.join('\n');
    const cjk = (joined.match(CJK) || []).length;
    const wordList = joined.replace(CJK, ' ').match(/[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu) || [];
    const words = wordList.length + cjk;
    for (const u of clean) {
      const parts = u.replace(ABBR, '$1').split(/[.!?…。！？]+["'”’)\]]*(?=\s|$)/);
      sentences += parts.filter(p => /[\p{L}\p{N}]/u.test(p)).length || 0;
    }
    const syl = wordList.reduce((n, w) => n + syllables(w), 0);
    const wps = sentences ? wordList.length / sentences : 0, spw = wordList.length ? syl / wordList.length : 0;
    const flesch = wordList.length ? Math.round((206.835 - 1.015 * wps - 84.6 * spw) * 10) / 10 : null;
    const grade = wordList.length ? Math.max(0, Math.round((0.39 * wps + 11.8 * spw - 15.59) * 10) / 10) : null;
    const longSentences = clean.reduce((n, u) => n + u.replace(ABBR, '$1').split(/[.!?…]+(?=\s|$)/).filter(p => (p.match(/[\p{L}\p{N}]+/gu) || []).length > 30).length, 0);
    return {
      words, characters: joined.replace(/\n/g, ' ').length, charactersNoSpaces: joined.replace(/\s/g, '').length,
      paragraphs, lines: nonEmpty, sentences, equations: equations + inlineEquations, displayEquations: equations, inlineEquations,
      citations, footnotes, codeBlocks,
      readingMinutes: words / 238, speakingMinutes: words / 130,
      flesch, grade, wordsPerSentence: Math.round(wps * 10) / 10, longSentences,
    };
  }
  const fmtNum = n => Number(n || 0).toLocaleString('en-US');
  function fmtMin(m) { if (!m) return '0 min'; if (m < 1) return '< 1 min'; const r = Math.round(m); return r >= 60 ? `${Math.floor(r / 60)} h ${r % 60} min` : `${r} min`; }

  // ---- table of contents
  const TOC_OPEN = /<!--\s*toc\s*-->/i, TOC_CLOSE = /<!--\s*\/toc\s*-->/i;
  function tocList(text, maxLevel = 3) {
    const hs = outline(text).filter(h => h.level <= maxLevel && h.text);
    if (!hs.length) return '';
    const min = Math.min(...hs.map(h => h.level));
    return hs.map(h => '  '.repeat(h.level - min) + `- [${h.text.replace(/([[\]])/g, '\\$1')}](#${h.slug})`).join('\n');
  }
  function tocBlock(text) { const l = tocList(text); return l ? `<!-- toc -->\n${l}\n<!-- /toc -->` : ''; }
  function findTocRegion(text) {
    const A = analyze(text);
    const o = A.comments.find(c => TOC_OPEN.test(c[2])), c = o && A.comments.find(x => x[0] > o[1] && TOC_CLOSE.test(x[2]));
    if (o && c) return { start: o[0], end: c[1] };
    // markers lost (for example after editing in Word mode): find a list made only of #links
    const lines = text.split('\n'); let pos = 0, run = null, best = null;
    for (const ln of lines) {
      const s = pos; pos += ln.length + 1;
      if (/^\s*[-*]\s+\[[^\]]+\]\(#[\w-]*\)\s*$/.test(ln) && !inRanges(A.fenced, s)) { if (!run) run = { start: s, end: s + ln.length, n: 0 }; run.end = s + ln.length; run.n++; }
      else if (run) { if (run.n >= 2 && !best) best = run; run = null; }
    }
    if (run && run.n >= 2 && !best) best = run;
    return best ? { start: best.start, end: best.end, unmarked: true } : null;
  }
  function updateTocText(text) {
    const r = findTocRegion(text); if (!r) return null;
    const block = tocBlock(text.slice(0, r.start) + text.slice(r.end));
    if (!block) return null;
    return text.slice(0, r.start) + block + text.slice(r.end);
  }

  // ---- footnotes
  function nextFootnoteNumber(text) {
    const A = analyze(text);
    let max = 0;
    for (const f of [...A.fnRefs, ...A.fnDefs]) if (/^\d+$/.test(f[2])) max = Math.max(max, +f[2]);
    return max + 1;
  }

  // ---- citations
  const citeMarkdown = (keys, locator) => {
    let loc = String(locator || '').trim();
    if (/^\d+([–-]\d+)?$/.test(loc)) loc = (/[–-]/.test(loc) ? 'pp. ' : 'p. ') + loc.replace('-', '–');
    return `[${keys.map(k => '@' + k).join('; ')}${loc ? ', ' + loc : ''}]`;
  };

  // =================================================================== document + editor helpers
  const activeDoc = () => { const d = app.docs.active(); return d && d.kind === 'markdown' ? d : null; };
  function needDoc() { const d = activeDoc(); if (!d) app.ui.toast('Open or create a Markdown document first.', { kind: 'warn', actions: [{ label: 'New document', run: () => app.commands.run('file.new') }] }); return d; }
  const editor = () => app.editors.active();
  const isActive = doc => app.docs.active() === doc;
  function caret(doc) {
    if (!isActive(doc)) return null;
    try { const s = editor()?.getSelection?.(); if (s && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end <= doc.text.length) return s; } catch {}
    return null;
  }
  function syncFromEditor(doc) {
    if (!isActive(doc)) return doc.text;
    try { const t = editor()?.getText?.(); if (typeof t === 'string' && t !== doc.text) doc.setText(t, 'editor'); } catch {}
    return doc.text;
  }
  function insertMd(doc, md, opts = {}) {
    const ed = editor();
    if (!opts.direct && isActive(doc) && ed?.insert) { try { ed.insert(md); return true; } catch (e) { console.warn(e); } }
    const at = Number.isFinite(opts.offset) ? opts.offset : (caret(doc)?.end ?? doc.text.length);
    doc.setText(doc.text.slice(0, at) + md + doc.text.slice(at), 'research');
    return false;
  }
  function lineOf(text, offset) { let n = 0; for (let i = 0; i < offset && i < text.length; i++) if (text.charCodeAt(i) === 10) n++; return n; }
  function selectSource(doc, start, end) {
    const ed = editor(); if (!ed || !isActive(doc)) return;
    try {
      if (ed.setSelection) ed.setSelection(start, end);
      else ed.scrollToLine?.(lineOf(doc.text, start));
    } catch (e) { console.warn(e); }
  }
  function refreshEditor() { try { editor()?.refresh?.(); } catch {} app.events.emit('research:refresh'); }
  // The rendered page of Word mode (or the preview of Simple mode).
  function surface() {
    const ed = editor();
    try { const s = ed?.getSurface?.() || ed?.surface || ed?.el; if (s instanceof Element && s.isConnected) return s; } catch {}
    return document.querySelector('[data-mk-surface="word"]') || document.querySelector('.mk-page[contenteditable="true"]') || document.querySelector('.canvas .page[contenteditable="true"]') || document.querySelector('.page[contenteditable="true"]') || document.querySelector('[data-mk-surface]');
  }
  function scrollParent(el) {
    for (let p = el; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight) return p; }
    return null;
  }
  function revealRect(rect, anchorEl, smooth = true) {
    const sp = scrollParent(anchorEl); if (!sp || !rect || !rect.height) return;
    const sr = sp.getBoundingClientRect();
    if (rect.top < sr.top + 50 || rect.bottom > sr.bottom - 50) sp.scrollBy({ top: rect.top - sr.top - sr.height / 3, behavior: smooth ? 'smooth' : 'auto' });
  }
  function flash(el) { if (!el) return; el.classList.remove('mkr-flash'); void el.offsetWidth; el.classList.add('mkr-flash'); setTimeout(() => el.classList.remove('mkr-flash'), 1300); }
  // Press the primary button of the shell dialog that holds `el` (used for Enter / double-click).
  function submitDialog(el) {
    const box = el.closest('dialog,[role="dialog"],.dialog,.modal,.mk-dialog') || el.parentElement?.parentElement;
    const b = box && (box.querySelector('[data-value="ok"]') || box.querySelector('button.primary,.btn-primary,[data-primary]'));
    if (b) { b.click(); return true; }
    return false;
  }

  // ---- paths and front matter
  const isAbs = p => /^([a-zA-Z]:[\\/]|[\\/])/.test(p);
  const dirOf = p => String(p).replace(/[\\/][^\\/]*$/, '');
  const baseName = p => String(p).split(/[\\/]/).pop();
  function joinPath(dir, rel) {
    const sep = dir.includes('\\') ? '\\' : '/';
    const out = [];
    for (const x of (dir + '/' + rel).split(/[\\/]+/)) { if (x === '..' && out.length > 1) out.pop(); else if (x !== '.') out.push(x); }
    return out.join(sep);
  }
  function relPath(fromDir, to) {
    const a = fromDir.split(/[\\/]+/).filter(Boolean), b = to.split(/[\\/]+/).filter(Boolean);
    const eq = (x, y) => (WIN ? x.toLowerCase() === y.toLowerCase() : x === y);
    if (!a.length || !b.length || !eq(a[0], b[0])) return null;
    let c = 0; while (c < a.length && c < b.length - 1 && eq(a[c], b[c])) c++;
    return [...Array(a.length - c).fill('..'), ...b.slice(c)].join('/');
  }
  function frontMeta(text) {
    const m = FRONT_RE.exec(text); if (!m) return {};
    const o = {}; let key = null;
    for (const line of m[0].split(/\r?\n/).slice(1, -1)) {
      const kv = /^([\w -]+):\s*(.*)$/.exec(line);
      if (kv) { key = kv[1].trim().toLowerCase(); o[key] = kv[2].trim().replace(/^["']|["']$/g, ''); }
      else if (key && /^\s*-\s+/.test(line)) o[key] = [].concat(o[key] || [], line.replace(/^\s*-\s+/, '').trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
    return o;
  }
  function setFrontKey(text, key, value) {
    const v = /[:#'"{}[\],&*?|<>=!%@`]|^\s|\s$/.test(value) ? `"${String(value).replace(/\\/g, '/').replace(/"/g, '\\"')}"` : value;
    const line = `${key}: ${v}`;
    const m = /^---\r?\n([\s\S]*?)\r?\n(---|\.\.\.)[ \t]*(\r?\n|$)/.exec(text);
    if (m) {
      const body = m[1].split(/\r?\n/);
      const i = body.findIndex(l => new RegExp('^' + key + '\\s*:', 'i').test(l));
      if (i >= 0) { let j = i + 1; while (j < body.length && /^\s*-\s/.test(body[j])) j++; body.splice(i, j - i, line); }
      else body.push(line);
      return '---\n' + body.join('\n') + '\n' + m[2] + '\n' + text.slice(m[0].length);
    }
    return `---\n${line}\n---\n\n` + text;
  }

  // =================================================================== bibliography state
  const bibState = new Map(); // doc.id → {key, entries, files, errors}
  function bibPaths(doc) {
    let v = (doc.meta && doc.meta.bibliography) || frontMeta(doc.text).bibliography;
    if (!v) return [];
    return [].concat(v).map(String).map(s => s.trim()).filter(Boolean).map(p => {
      if (isAbs(p)) return p;
      if (!doc.path) return null;
      return joinPath(dirOf(doc.path), p);
    }).filter(Boolean);
  }
  async function loadBib(doc, force) {
    if (!doc || doc.kind !== 'markdown') return null;
    const files = bibPaths(doc); const key = files.join('|');
    const st = bibState.get(doc.id);
    if (st && st.key === key && !force) return st.loading || st;
    const next = { key, files, entries: {}, errors: [] };
    next.loading = (async () => {
      for (const f of files) {
        try { const src = await mk.invoke('read-text', f); Object.assign(next.entries, mk.parseBib ? mk.parseBib(String(src)) : {}); }
        catch (e) { next.errors.push({ file: f, message: e.message || String(e) }); }
      }
      delete next.loading;
      return next;
    })();
    bibState.set(doc.id, next);
    const r = await next.loading;
    if (bibState.get(doc.id) === next && (Object.keys(next.entries).length || st)) { if (isActive(doc)) refreshEditor(); }
    app.events.emit('research:bib', { doc, files, count: Object.keys(next.entries).length, errors: next.errors });
    return r;
  }
  const bibLater = app.debounce((doc) => loadBib(doc), 700);
  app.events.on('doc:opened', d => d && d.kind === 'markdown' && loadBib(d));
  app.events.on('doc:active', d => d && d.kind === 'markdown' && loadBib(d));
  app.events.on('doc:changed', e => { const d = e && e.doc; if (d && d.kind === 'markdown' && (/bibliography/i.test(d.text.slice(0, 4000)) || bibState.get(d.id)?.files.length)) bibLater(d); });
  app.events.on('doc:saved', d => d && d.kind === 'markdown' && loadBib(d));
  app.events.on('doc:closed', d => d && bibState.delete(d.id));
  function entriesFor(doc) { return (doc && bibState.get(doc.id)?.entries) || {}; }

  // ---- name + entry formatting for citation styles
  function parseNames(s) {
    return String(s || '').split(/\s+and\s+/i).map(n => n.trim()).filter(Boolean).map(n => {
      if (/^others$/i.test(n)) return { last: 'others', first: '', others: true };
      if (n.includes(',')) { const [last, ...rest] = n.split(','); return { last: last.trim(), first: rest.join(',').trim() }; }
      const parts = n.split(/\s+/); if (parts.length === 1) return { last: parts[0], first: '' };
      let i = parts.length - 1; while (i > 1 && /^(von|van|de|der|den|da|di|du|la|le|del|dos|ten|ter)$/i.test(parts[i - 1])) i--;
      return { last: parts.slice(i).join(' '), first: parts.slice(0, i).join(' ') };
    });
  }
  const initials = f => String(f || '').split(/[\s.]+/).filter(Boolean).map(x => x.split('-').map(y => y[0].toUpperCase() + '.').join('-')).join(' ');
  function inTextNames(e, style) {
    const A = parseNames(e.author).filter(a => !a.others), more = /\band\s+others\b/i.test(e.author || '');
    if (!A.length) return 'Anon.';
    const L = A.map(a => a.last);
    if (style === 'apa') return L.length === 1 && !more ? L[0] : L.length === 2 && !more ? `${L[0]} & ${L[1]}` : `${L[0]} et al.`;
    if (L.length === 1 && !more) return L[0];
    if (L.length === 2 && !more) return `${L[0]} and ${L[1]}`;
    if (L.length === 3 && !more) return `${L[0]}, ${L[1]}, and ${L[2]}`;
    return `${L[0]} et al.`;
  }
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const noDot = s => clean(s).replace(/[.\s]+$/, '');
  function bibAuthors(e, style) {
    const A = parseNames(e.author).filter(a => !a.others);
    if (!A.length) return 'Anon.';
    const join = (arr, amp) => arr.length === 1 ? arr[0] : arr.length === 2 ? `${arr[0]}${style === 'apa' ? ',' : ''} ${amp} ${arr[1]}` : `${arr.slice(0, -1).join(', ')}, ${amp} ${arr[arr.length - 1]}`;
    if (style === 'apa') return join(A.slice(0, 20).map(a => `${a.last}${a.first ? ', ' + initials(a.first) : ''}`), '&');
    if (style === 'chicago') return join(A.map((a, i) => (i === 0 ? `${a.last}${a.first ? ', ' + a.first : ''}` : `${a.first ? a.first + ' ' : ''}${a.last}`)), 'and');
    const ie = A.map(a => `${a.first ? initials(a.first) + ' ' : ''}${a.last}`);
    return ie.length > 6 ? `${ie[0]} et al.` : join(ie, 'and');
  }
  function fmtEntry(e, style, n) {
    const title = noDot(e.title), year = clean(e.year) || 'n.d.', cont = clean(e.journal || e.booktitle), vol = clean(e.volume), num = clean(e.number || e.issue);
    const pages = clean(e.pages).replace(/-+/g, '–'), pub = clean(e.publisher || e.institution || e.school || e.organization), doi = clean(e.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//, ''), url = clean(e.url);
    const book = !cont;
    const link = doi ? ` <a href="https://doi.org/${esc(doi)}">https://doi.org/${esc(doi)}</a>` : url ? ` <a href="${esc(url)}">${esc(url)}</a>` : '';
    const au = esc(noDot(bibAuthors(e, style)));
    if (style === 'apa') {
      return `${au}. (${esc(year)}). ${book ? `<em>${esc(title)}</em>` : esc(title)}.` +
        (cont ? ` <em>${esc(cont)}</em>${vol ? `, <em>${esc(vol)}</em>` : ''}${num ? `(${esc(num)})` : ''}${pages ? `, ${esc(pages)}` : ''}.` : '') +
        (book && pub ? ` ${esc(pub)}.` : '') + link;
    }
    if (style === 'chicago') {
      return `${au}. ${esc(year)}. ${book ? `<em>${esc(title)}</em>.` : `“${esc(title)}.”`}` +
        (cont ? ` <em>${esc(cont)}</em>${vol ? ` ${esc(vol)}` : ''}${num ? ` (${esc(num)})` : ''}${pages ? `: ${esc(pages)}` : ''}.` : '') +
        (book && pub ? ` ${esc(pub)}.` : '') + link;
    }
    return `<span class="n">[${n}]</span>${au}, ${book ? `<em>${esc(title)}</em>,` : `“${esc(title)},”`}` +
      (cont ? ` <em>${esc(cont)}</em>,${vol ? ` vol. ${esc(vol)},` : ''}${num ? ` no. ${esc(num)},` : ''}${pages ? ` pp. ${esc(pages)},` : ''}` : (pub ? ` ${esc(pub)},` : '')) +
      ` ${esc(year)}.${doi ? ` doi: <a href="https://doi.org/${esc(doi)}">${esc(doi)}</a>.` : url ? ` [Online]. Available: <a href="${esc(url)}">${esc(url)}</a>` : ''}`;
  }
  const STYLES = [{ value: 'apa', label: 'APA' }, { value: 'chicago', label: 'Chicago' }, { value: 'ieee', label: 'IEEE' }];
  const citeStyle = () => { const d = activeDoc(); const fm = d && (d.meta?.['citation-style'] || frontMeta(d.text)['citation-style']); const v = String(fm || app.settings.get('citeStyle', 'apa')).toLowerCase(); return STYLES.some(s => s.value === v) ? v : 'apa'; };

  function styleCitations(el, doc) {
    const bib = entriesFor(doc);
    const cites = [...el.querySelectorAll('.mk-cite[data-keys]')];
    if (!cites.length && !el.querySelector('.mk-bibliography')) return;
    const style = citeStyle();
    const haveBib = Object.keys(bib).length > 0;
    const order = [];
    for (const c of cites) for (const k of c.getAttribute('data-keys').split(';').map(s => s.trim()).filter(Boolean)) if (bib[k] && !order.includes(k)) order.push(k);
    const num = k => order.indexOf(k) + 1;
    if (haveBib) for (const c of cites) {
      const keys = c.getAttribute('data-keys').split(';').map(s => s.trim()).filter(Boolean);
      const loc = c.getAttribute('data-locator') || '';
      const missing = keys.filter(k => !bib[k]);
      c.classList.toggle('mkr-missing', missing.length > 0);
      c.title = missing.length ? `Add ${missing.map(k => '@' + k).join(', ')} to your bibliography, or double-click to pick a key from the list. (Not in your library yet.)` : keys.map(k => noDot(bib[k].title)).join(' · ');
      let txt;
      if (style === 'ieee') {
        const ns = keys.map(k => (bib[k] ? num(k) : null));
        const known = ns.filter(Boolean).sort((a, b) => a - b);
        const runs = []; for (const n of known) { const r = runs[runs.length - 1]; if (r && n === r[1] + 1) r[1] = n; else runs.push([n, n]); }
        txt = runs.map(([a, b]) => (b - a >= 2 ? `[${a}]–[${b}]` : a === b ? `[${a}]` : `[${a}], [${b}]`)).join(', ');
        if (loc && known.length === 1) txt = `[${known[0]}, ${loc}]`; else if (loc) txt += ` (${loc})`;
        const miss = missing.map(k => '[?' + k + ']').join(', ');
        txt = [txt, miss].filter(Boolean).join(', ');
      } else {
        const sepYear = style === 'apa' ? ', ' : ' ';
        // Pandoc prefixes and per-key locators ([see @a, p. 4; @b, chap. 2]) and narrative @key come in data-items
        let items = null; try { items = JSON.parse(c.getAttribute('data-items') || 'null'); } catch {}
        const locOf = l => (l ? (style === 'apa' ? `, ${l}` : `, ${l.replace(/^pp?\.\s*/, '')}`) : '');
        const yearOf = k => clean(bib[k].year) || 'n.d.';
        if (Array.isArray(items) && items.length) {
          const narrative = c.getAttribute('data-narrative') === '1';
          const parts = items.map(it => {
            if (!bib[it.key]) return '?' + it.key;
            if (narrative) return `${inTextNames(bib[it.key], style)} (${yearOf(it.key)}${locOf(it.locator)})`;
            return [it.prefix, it.suppress ? yearOf(it.key) : `${inTextNames(bib[it.key], style)}${sepYear}${yearOf(it.key)}`].filter(Boolean).join(' ') + locOf(it.locator);
          });
          txt = narrative ? parts.join('; ') : `(${parts.join('; ')})`;
          // a mixed [@eq:x; @key] keeps its cross-reference chip
          if (c.querySelector('.mk-xref')) continue;
        } else {
          const parts = keys.map(k => (bib[k] ? `${inTextNames(bib[k], style)}${sepYear}${yearOf(k)}` : '?' + k));
          txt = `(${parts.join('; ')}${locOf(loc)})`;
        }
      }
      if (c.textContent !== txt) c.textContent = txt;
    }
    // bibliography list
    const sec = el.querySelector('.mk-bibliography');
    if (sec && haveBib && order.length) {
      const items = style === 'ieee' ? order.map(k => bib[k]) : order.map(k => bib[k]).sort((a, b) => (parseNames(a.author)[0]?.last || '').localeCompare(parseNames(b.author)[0]?.last || '') || String(a.year).localeCompare(String(b.year)));
      const list = sec.querySelector('ol,ul');
      const html = items.map(e => `<li id="ref-${esc(e.key)}">${fmtEntry(e, style, num(e.key))}</li>`).join('');
      const fresh = document.createElement(style === 'ieee' ? 'ol' : 'ul');
      fresh.className = 'mkr-bib ' + style; fresh.innerHTML = html;
      if (list) list.replaceWith(fresh); else sec.appendChild(fresh);
    }
    // place the bibliography under the user's own "References" heading when there is one
    if (sec) {
      const hs = [...el.querySelectorAll('h1,h2,h3')].filter(h => !sec.contains(h) && /^(references|bibliography|works cited|literature( cited)?|sources|reference list)\s*$/i.test(h.textContent.trim()));
      const h = hs[hs.length - 1];
      if (h) {
        sec.querySelector(':scope > h1, :scope > h2')?.remove();
        if (h.nextElementSibling !== sec) h.after(sec);
      }
    }
  }

  // =================================================================== postRender / preRender hooks
  // Comments: preload keeps <!-- comment: … --> as comment nodes; postRender turns them into margin bubbles.
  app.hooks.postRender((el, doc) => {
    if (!el || !el.querySelectorAll) return;
    doc = doc || app.docs.active();
    injectCss();
    // comments that survived as real HTML comment nodes
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_COMMENT);
    const found = []; while (tw.nextNode()) if (/^\s*comment:/i.test(tw.currentNode.data)) found.push(tw.currentNode);
    for (const c of found) { const s = document.createElement('span'); s.className = 'mk-comment'; s.setAttribute('data-text', c.data.replace(/^\s*comment:\s*/i, '').trim()); c.replaceWith(s); }
    el.querySelectorAll('.mk-comment').forEach(c => { c.setAttribute('contenteditable', 'false'); c.setAttribute('role', 'note'); c.setAttribute('aria-label', 'Comment: ' + (c.getAttribute('data-text') || '')); c.title = c.getAttribute('data-text') || ''; });
    // equation / figure / table numbers and their anchors: src/xref.js (app.xref) — one numbering system
    styleCitations(el, doc);
    applySpell();
    if (el.querySelector('.mk-comment')) applyCommentViewSoon();
    if (find.open) find.refreshSoon();
  });

  // =================================================================== spelling
  // Spelling and grammar live in src/writing/ (app.writing). These names stay for older callers.
  const spellOn = () => app.settings.get('spellcheck', true) !== false;
  function applySpell() { try { app.writing?.applySpellcheckAttr?.(); } catch {} }

  // comments in the margin follow Word mode + the Show comments toggle
  function applyCommentView() {
    const root = document.documentElement;
    const show = app.settings.get('showComments', true) !== false;
    root.classList.toggle('mkr-hide-comments', !show);
    let margin = show && (app.mode === 'word' || app.mode === 'inline');
    if (margin) {
      // bubbles sit right of the page; fall back to hover bubbles when there is no room
      const s = surface();
      let box = s && s.parentElement; while (box && box !== document.body && !/(auto|scroll|hidden)/.test(getComputedStyle(box).overflowX)) box = box.parentElement;
      if (s && box) margin = box.getBoundingClientRect().right - s.getBoundingClientRect().right >= 250;
    }
    root.classList.toggle('mkr-margin', margin);
  }
  const applyCommentViewSoon = app.debounce(applyCommentView, 120);
  addEventListener('resize', applyCommentViewSoon);
  ['zoom:changed', 'doc:active', 'settings:changed'].forEach(ev => app.events.on(ev, applyCommentViewSoon));
  app.events.on('mode:changed', applyCommentView);
  app.events.on('settings:changed', e => { if (e && e.key === 'showComments') applyCommentView(); if (e && e.key === 'spellcheck') applySpell(); });
  document.addEventListener('click', e => {
    const c = e.target.closest && e.target.closest('.mk-comment');
    document.querySelectorAll('.mk-comment.on').forEach(x => { if (x !== c) x.classList.remove('on'); });
    if (c) c.classList.toggle('on');
  });

  // =================================================================== commands: References
  const cmd = (id, def) => app.commands.register(id, def);
  const mdOnly = () => !!activeDoc();

  cmd('ref.toc', {
    label: 'Table of contents', icon: 'toc', isEnabled: mdOnly,
    async run() {
      const doc = needDoc(); if (!doc) return;
      syncFromEditor(doc);
      if (findTocRegion(doc.text)) return app.commands.run('ref.tocUpdate');
      const block = tocBlock(doc.text);
      if (!block) { app.ui.toast('Add some headings first (Home → Styles → Heading 1). The table lists them.', { kind: 'warn' }); return; }
      insertMd(doc, `\n\n${block}\n\n`);
      app.ui.toast('Table of contents added. Use Update table after you change headings.');
    },
  });
  cmd('ref.tocUpdate', {
    label: 'Update table of contents', icon: 'toc', isEnabled: mdOnly,
    run() {
      const doc = needDoc(); if (!doc) return;
      const text = syncFromEditor(doc);
      const next = updateTocText(text);
      if (next == null) { app.ui.toast('Click Contents to add a table of contents first.', { kind: 'warn', actions: [{ label: 'Add contents', run: () => app.commands.run('ref.toc') }] }); return; }
      if (next !== text) doc.setText(next, 'research');
      app.ui.toast('Table of contents updated');
    },
  });

  cmd('ref.footnote', {
    label: 'Insert footnote', icon: 'foot', shortcut: 'Ctrl+Alt+F', isEnabled: mdOnly,
    async run() {
      const doc = needDoc(); if (!doc) return;
      const n = nextFootnoteNumber(syncFromEditor(doc));
      if (app.mode === 'word') {
        const note = await app.ui.prompt('Footnote ' + n, 'Footnote text', '');
        if (note == null) return;
        insertMd(doc, `[^${n}]`);
        await sleep(30);
        const t = syncFromEditor(doc);
        doc.setText(appendFootnote(t.includes(`[^${n}]`) ? t : t.replace(/\s*$/, '') + `[^${n}]`, n, note.trim() || 'Note.'), 'research');
        app.ui.toast(`Footnote ${n} added`);
        return;
      }
      insertMd(doc, `[^${n}]`);
      await sleep(30);
      let t = syncFromEditor(doc);
      if (!t.includes(`[^${n}]`)) t = t.replace(/\s*$/, '') + `[^${n}]`;
      const next = appendFootnote(t, n, '');
      doc.setText(next, 'research');
      await sleep(30);
      const end = doc.text.replace(/\n+$/, '').length;
      selectSource(doc, end, end);
      try { editor()?.scrollToLine?.(lineOf(doc.text, end)); editor()?.focus?.(); } catch {}
    },
  });
  function appendFootnote(text, n, note) {
    const base = text.replace(/\s*$/, '');
    const lastLine = base.split('\n').pop();
    const sep = /^\[\^[^\]]+\]:/.test(lastLine) ? '\n' : '\n\n';
    return base + sep + `[^${n}]: ${note}` + (note ? '\n' : '');
  }
  function navigate(kind, dir) {
    const doc = needDoc(); if (!doc) return;
    const surf = app.mode === 'word' ? surface() : null;
    if (surf) {
      const list = [...surf.querySelectorAll(kind === 'fn' ? 'sup.footnote-ref, .footnote-ref' : '.mk-comment')];
      if (!list.length) return app.ui.toast(kind === 'fn' ? 'Add a footnote with References → Footnote. This document has none yet.' : 'Add a comment with Review → New Comment. This document has none yet.', { kind: 'info' });
      const s = getSelection(); const here = s && s.rangeCount && surf.contains(s.anchorNode) ? s.getRangeAt(0) : null;
      const cmp = el => { try { return here ? here.comparePoint(el, 0) : (dir > 0 ? 1 : -1); } catch { return 0; } };
      const target = (dir > 0 ? list.find(el => cmp(el) === 1) : [...list].reverse().find(el => cmp(el) === -1)) || list[dir > 0 ? 0 : list.length - 1];
      navigate.last = target;
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      try { const r = document.createRange(); if (dir > 0) r.setStartAfter(target); else r.setStartBefore(target); r.collapse(true); s.removeAllRanges(); s.addRange(r); } catch {}
      if (kind === 'comment') { document.querySelectorAll('.mk-comment.on').forEach(x => x.classList.remove('on')); target.classList.add('on'); } else flash(target);
      return;
    }
    const text = doc.text, A = analyze(text);
    const spots = kind === 'fn' ? A.fnRefs : A.comments.filter(c => /^<!--\s*comment:/i.test(c[2]));
    if (!spots.length) return app.ui.toast(kind === 'fn' ? 'Add a footnote with References → Footnote. This document has none yet.' : 'Add a comment with Review → New Comment. This document has none yet.', { kind: 'info' });
    const c = caret(doc);
    let k = dir > 0 ? spots.findIndex(x => x[0] >= (c ? c.end : 0)) : spots.map(x => x[1] <= (c ? c.start : text.length)).lastIndexOf(true);
    if (k < 0) k = dir > 0 ? 0 : spots.length - 1;
    const [a, b] = spots[k];
    selectSource(doc, a, b);
    try { editor()?.scrollToLine?.(lineOf(text, a)); } catch {}
  }
  cmd('ref.nextFootnote', { label: 'Next footnote', icon: 'foot', isEnabled: mdOnly, run: () => navigate('fn', 1) });
  cmd('ref.prevFootnote', { label: 'Previous footnote', icon: 'foot', isEnabled: mdOnly, run: () => navigate('fn', -1) });

  // ---- citations dialog
  async function citeDialog(preset = {}) {
    const doc = needDoc(); if (!doc) return;
    await loadBib(doc);
    const st = bibState.get(doc.id) || { entries: {}, files: [], errors: [] };
    const all = Object.values(st.entries).sort((a, b) => (parseNames(a.author)[0]?.last || '').localeCompare(parseNames(b.author)[0]?.last || '') || String(a.year).localeCompare(String(b.year)));
    const picked = [...(preset.keys || [])]; let act = 0, shown = [];
    const body = document.createElement('div'); body.className = 'mkr-dlg';
    body.innerHTML = `
      <label class="mkr-field">${icon('search')}<input class="q" placeholder="Search by author, year, title or key" spellcheck="false" aria-label="Search references"></label>
      <div class="mkr-list" role="listbox" aria-multiselectable="true" tabindex="-1"></div>
      <div class="mkr-foot"><label>Page or section <input class="loc" placeholder="e.g. 4 or ch. 2"></label><span class="grow"></span><span class="pv"></span></div>
      <div class="mkr-note">${st.files.length ? `Library: ${esc(st.files.map(baseName).join(', '))} · ${fmtNum(all.length)} references` : 'Click Library to link a .bib file; no library is linked to this document yet.'} Click to pick several; they are cited together.</div>`;
    const q = body.querySelector('.q'), listEl = body.querySelector('.mkr-list'), loc = body.querySelector('.loc'), pv = body.querySelector('.pv');
    const keysNow = () => (picked.length ? picked : (shown[act] ? [shown[act].key] : (/^[\w:.#$%&\-+?<>~/]+$/.test(q.value.trim()) && q.value.trim() && !all.length ? [q.value.trim()] : [])));
    const preview = () => { const k = keysNow(); pv.innerHTML = k.length ? `Inserts <code>${esc(citeMarkdown(k, loc.value))}</code>` : ''; };
    function draw() {
      const words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
      shown = all.filter(e => { const hay = `${e.key} ${e.author} ${e.year} ${e.title} ${e.journal || ''} ${e.booktitle || ''}`.toLowerCase(); return words.every(w => hay.includes(w)); }).slice(0, 300);
      act = Math.min(act, Math.max(0, shown.length - 1));
      if (!all.length) {
        listEl.innerHTML = `<div class="mkr-empty"><b>No references yet</b>Link a BibTeX (.bib) file from Zotero, Mendeley, JabRef or EndNote, and its references show up here. You can also type a citation key above.<br><button class="mkr-btn primary" data-a="lib">Choose a .bib file…</button></div>`;
        listEl.querySelector('[data-a="lib"]').onclick = async () => { if (await pickLibrary(doc)) { submitDialog(body); setTimeout(() => app.commands.run('ref.cite'), 80); } };
      } else if (!shown.length) listEl.innerHTML = `<div class="mkr-empty"><b>No matches</b>Try fewer words, or search by year.</div>`;
      else listEl.innerHTML = shown.map((e, i) => {
        const sel = picked.includes(e.key);
        return `<div class="mkr-row${sel ? ' sel' : ''}${i === act ? ' act' : ''}" role="option" aria-selected="${sel}" data-k="${esc(e.key)}" data-i="${i}">
          <input type="checkbox" tabindex="-1"${sel ? ' checked' : ''}><div><b>${esc(inTextNames(e, 'apa'))} (${esc(e.year)})</b><span>${esc(noDot(e.title))}</span><small>@${esc(e.key)}${e.journal || e.booktitle ? ' · ' + esc(e.journal || e.booktitle) : ''}</small></div></div>`;
      }).join('');
      preview();
    }
    const toggle = key => { const i = picked.indexOf(key); if (i >= 0) picked.splice(i, 1); else picked.push(key); draw(); };
    listEl.addEventListener('click', e => { const r = e.target.closest('.mkr-row'); if (!r) return; act = +r.dataset.i; toggle(r.dataset.k); q.focus(); });
    listEl.addEventListener('dblclick', e => { const r = e.target.closest('.mkr-row'); if (!r) return; if (!picked.includes(r.dataset.k)) picked.push(r.dataset.k); draw(); submitDialog(body); });
    const keys = e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(0, Math.min(shown.length - 1, act + (e.key === 'ArrowDown' ? 1 : -1))); draw(); listEl.querySelector('.act')?.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === ' ' && e.target === q && e.ctrlKey && shown[act]) { e.preventDefault(); toggle(shown[act].key); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!picked.length && shown[act]) picked.push(shown[act].key); draw(); submitDialog(body); }
    };
    q.addEventListener('keydown', keys); loc.addEventListener('keydown', e => { if (e.key === 'Enter') keys(e); });
    q.addEventListener('input', () => { act = 0; draw(); }); loc.addEventListener('input', preview);
    if (preset.query) q.value = preset.query;
    if (preset.locator) loc.value = preset.locator;
    draw();
    setTimeout(() => q.focus(), 60);
    const editing = typeof preset.onDone === 'function';
    const v = await app.ui.dialog({ title: editing ? 'Edit citation' : 'Insert citation', body, buttons: [{ label: 'Cancel', value: 'cancel' }, { label: editing ? 'Update' : 'Insert', value: 'ok', primary: true }] });
    if (v !== 'ok' && v !== true) return;
    const k = keysNow();
    if (editing) return preset.onDone(k, loc.value);
    if (!k.length) return;
    insertCitation(doc, k, loc.value);
  }
  function insertCitation(doc, keys, locator, opts = {}) {
    let md = citeMarkdown(keys, locator);
    const c = caret(doc);
    const at = Number.isFinite(opts.offset) ? opts.offset : c?.start;
    if (Number.isFinite(at) && at > 0 && /\S/.test(doc.text[at - 1] || '') && !/[([{]/.test(doc.text[at - 1])) md = ' ' + md;
    insertMd(doc, md, opts);
    return md;
  }
  cmd('ref.cite', { label: 'Insert citation', icon: 'cite', shortcut: 'Ctrl+Shift+C', isEnabled: mdOnly, run: args => citeDialog(args || {}) });
  // Word mode double-click on a citation: same dialog with the keys already picked; Update replaces the citation in place
  cmd('ref.editCitation', { label: 'Edit citation', icon: 'cite', palette: false, isEnabled: mdOnly, run: async (args = {}) => {
    const el = args.element; if (!el || !el.isConnected) return citeDialog({});
    const keys = (el.getAttribute('data-keys') || '').split(/[;,]\s*/).map(k => k.replace(/^@/, '').trim()).filter(Boolean);
    return citeDialog({ keys, locator: el.getAttribute('data-locator') || '', onDone: async (k, locator) => {
      const ed = app.editors.active(); if (!el.isConnected) return;
      const r = document.createRange(); r.selectNode(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      r.deleteContents();
      if (k.length) await ed?.insert?.(citeMarkdown(k, locator)); else ed?.flush?.();
    } });
  } });

  async function pickLibrary(doc) {
    let file = null;
    try { file = await mk.invoke('pick-file', [{ name: 'BibTeX library', extensions: ['bib', 'bibtex'] }, { name: 'All files', extensions: ['*'] }]); }
    catch (e) { app.ui.fail(e, { lead: 'Try Library again, or type the file name after bibliography: in the front matter.', hideReason: true, retry: () => pickLibrary(doc) }); return false; }
    if (!file) return false;
    let count = 0;
    try { const src = await mk.invoke('read-text', file); count = Object.keys(mk.parseBib ? mk.parseBib(String(src)) : {}).length; }
    catch (e) { app.ui.fail(e, { lead: `Choose another .bib file. Markooj can’t read ${baseName(file)}.`, actions: [{ label: 'Choose another file', run: () => pickLibrary(doc) }], still: 'Your citations stay as they are.' }); return false; }
    if (!count) {
      const go = await app.ui.dialog({ title: 'Choose a BibTeX file', body: `<p>Choose a .bib file with entries such as @article{…}. ${app.esc(baseName(file))} has no references Markooj can read.</p>`, buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Link anyway', value: 'link' }, { label: 'Choose another…', value: 'again', primary: true }], cancelValue: 'cancel' });
      if (go === 'again') return pickLibrary(doc);
      if (go !== 'link') return false;
    }
    const rel = doc.path ? relPath(dirOf(doc.path), file) : null;
    const value = (rel || file).replace(/\\/g, '/');
    const text = syncFromEditor(doc);
    doc.setText(setFrontKey(text, 'bibliography', value), 'research');
    await loadBib(doc, true);
    app.ui.toast(`Library linked: ${baseName(file)} · ${fmtNum(count)} reference${count === 1 ? '' : 's'}`);
    return true;
  }
  cmd('ref.library', { label: 'Choose citation library (.bib)', icon: 'bib', isEnabled: mdOnly, run: () => { const d = needDoc(); return d && pickLibrary(d); } });
  cmd('ref.reloadLibrary', { label: 'Reload citation library', icon: 'bib', isEnabled: mdOnly, async run() { const d = needDoc(); if (!d) return; const st = await loadBib(d, true); st && st.files.length ? app.ui.toast(`Reloaded ${fmtNum(Object.keys(st.entries).length)} references`) : app.ui.toast('Click Library to link a .bib file first.', { kind: 'info', actions: [{ label: 'Choose library', run: () => app.commands.run('ref.library') }] }); } });
  cmd('ref.style', {
    label: 'Citation style', icon: 'cite', isEnabled: mdOnly,
    async run(args) {
      let v = typeof args === 'string' ? args : args && (args.value || args.style);
      if (!v) {
        v = await app.ui.dialog({ title: 'Citation style', body: 'How citations and the reference list look. Your Markdown keeps the same [@key] citations either way.', buttons: [{ label: 'Cancel', value: null }, ...STYLES.map(s => ({ label: s.label, value: s.value, primary: s.value === citeStyle() }))] });
        if (!v || v === 'cancel' || v === true) return;
      }
      v = String(v).toLowerCase();
      if (!STYLES.some(s => s.value === v)) return;
      app.settings.set('citeStyle', v);
      const d = activeDoc();
      if (d && (d.meta?.['citation-style'] || frontMeta(d.text)['citation-style'])) d.setText(setFrontKey(d.text, 'citation-style', v), 'research');
      refreshEditor();
      app.ui.toast(`Citation style: ${STYLES.find(s => s.value === v).label}`);
    },
  });
  cmd('ref.bibliography', {
    label: 'Insert bibliography', icon: 'ol', isEnabled: mdOnly,
    run() {
      const doc = needDoc(); if (!doc) return;
      const has = outline(doc.text).some(h => /^(references|bibliography|works cited|literature( cited)?)$/i.test(h.text.trim()));
      if (has) { app.ui.toast('This document already has a References heading. The list appears under it.'); return; }
      insertMd(doc, '\n\n## References\n\n');
      app.ui.toast(Object.keys(entriesFor(doc)).length ? 'References heading added. Every cited source is listed under it.' : 'References heading added. Link a .bib library to fill it.');
    },
  });

  // ---- cross-references: handled by src/xref.js (app.xref). These ids stay for old macros and shortcuts.
  function captionTargets(text) {
    if (app.xref?.targets) return app.xref.targets(text).map(t => ({ kind: t.kindLabel, label: t.display, md: t.md, sub: t.text }));
    return legacyTargets(text);
  }
  function legacyTargets(text) {
    const A = analyze(text), out = [];
    for (const h of outline(text)) out.push({ kind: 'Heading', label: h.text, md: `[${h.text.replace(/([[\]])/g, '\\$1')}](#${h.slug})`, sub: 'Level ' + h.level });
    let n = 0;
    for (const d of A.displayMath) {
      if (/\\(tag|notag|nonumber)\b/.test(d[2]) || d[3]) continue; n++;
      out.push({ kind: 'Equation', label: `Equation (${n})`, md: `[Equation (${n})](#eq-${n})`, sub: d[2].replace(/\s+/g, ' ').trim().slice(0, 90) });
    }
    let f = 0;
    for (const [a, b] of A.images) { const s = text.slice(a, b); const alt = (/!\[([^\]]*)\]/.exec(s) || /alt="([^"]*)"/i.exec(s) || [])[1] || ''; f++; out.push({ kind: 'Figure', label: `Figure ${f}`, md: `[Figure ${f}](#fig-${f})`, sub: alt || s.slice(0, 80) }); }
    const lines = A.masked.split('\n'); let tb = 0;
    for (let i = 0; i + 1 < lines.length; i++) {
      if (/\|/.test(lines[i]) && /^ {0,3}\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
        tb++;
        let j = i + 2; while (j < lines.length && lines[j].includes('|')) j++;
        const cap = [lines[j] || '', lines[j + 1] || '', lines[i - 1] || '', lines[i - 2] || ''].map(s => s.trim()).find(s => /^(table|:\s)/i.test(s)) || lines[i].replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
        out.push({ kind: 'Table', label: `Table ${tb}`, md: `[Table ${tb}](#tbl-${tb})`, sub: cap.replace(/^:\s*/, '').slice(0, 90) });
        i = j;
      }
    }
    return out;
  }
  // the old dialog lived here; the Word-like Cross-reference dialog is xref.crossref
  cmd('ref.crossref', { label: 'Insert cross-reference', icon: 'xref', palette: false, isEnabled: mdOnly, run: a => (app.commands.get('xref.crossref') ? app.commands.run('xref.crossref', a) : app.ui.toast('Restart Markooj to use cross-references. The cross-reference tools did not load this time.', { kind: 'warn' })) });
  cmd('ref.numberEquations', { label: 'Number all equations', icon: 'sigma', palette: false, isActive: () => !!app.xref?.config?.().numberAll, run: a => app.commands.run('xref.numberAll', a) });

  // =================================================================== commands: Review
  // F7 (Spelling and Grammar), Check spelling as you type and the Proofing group: src/writing/ui.js

  async function wordCountDialog() {
    const doc = activeDoc();
    const docText = doc ? syncFromEditor(doc) : '';
    let selText = '';
    try { selText = (doc && editor()?.getSelection?.()?.text) || ''; } catch {}
    if (!selText) { const s = getSelection(); if (s && !s.isCollapsed && !s.anchorNode?.parentElement?.closest('.mkr-find')) selText = String(s); }
    let scope = selText.trim() ? 'sel' : 'doc';
    const body = document.createElement('div'); body.className = 'mkr-dlg';
    const draw = () => {
      const st = scope === 'sel' ? stats(selText, { markdown: !!(doc && caret(doc)) }) : stats(docText);
      const row = (k, v) => `<div class="mkr-stat"><span>${k}</span><b>${v}</b></div>`;
      body.innerHTML = `<div class="mkr-seg"><button data-s="doc"${scope === 'doc' ? ' class="on"' : ''}>Document</button><button data-s="sel"${scope === 'sel' ? ' class="on"' : ''}${selText.trim() ? '' : ' disabled title="Select some text first"'}>Selection</button></div>
        <div class="mkr-stats">
          ${row('Words', fmtNum(st.words))}${row('Characters (with spaces)', fmtNum(st.characters))}
          ${row('Characters (no spaces)', fmtNum(st.charactersNoSpaces))}${row('Paragraphs', fmtNum(st.paragraphs))}
          ${row('Lines', fmtNum(st.lines))}${row('Sentences', fmtNum(st.sentences))}
          ${row('Equations', fmtNum(st.equations) + (st.equations ? ` <span style="font-weight:400;color:var(--text-3)">(${st.displayEquations} display)</span>` : ''))}${row('Citations', fmtNum(st.citations))}
          ${row('Footnotes', fmtNum(st.footnotes))}${row('Reading time', fmtMin(st.readingMinutes))}
          ${row('Speaking time', fmtMin(st.speakingMinutes))}${row('Readability (Flesch)', st.flesch == null ? '–' : `${st.flesch} · grade ${st.grade}`)}
        </div>
        <div class="mkr-note">Counts leave out the title block (front matter), code, equations, web addresses and citation keys. Reading time uses 238 words per minute; speaking time 130.</div>`;
    };
    body.addEventListener('click', e => { const b = e.target.closest('.mkr-seg button'); if (b && !b.disabled) { scope = b.dataset.s; draw(); } });
    draw();
    await app.ui.dialog({ title: 'Word count', body, buttons: [{ label: 'Close', value: 'ok', primary: true }] });
  }
  cmd('review.wordCount', { label: 'Word count', icon: 'count', shortcut: 'Ctrl+Shift+G', run: wordCountDialog });
  cmd('review.readability', {
    label: 'Readability', icon: 'sparkle', isEnabled: mdOnly,
    async run() {
      const doc = needDoc(); if (!doc) return;
      const st = stats(syncFromEditor(doc));
      const ease = st.flesch == null ? '–' : st.flesch >= 80 ? 'Easy' : st.flesch >= 60 ? 'Plain English' : st.flesch >= 50 ? 'Fairly difficult' : st.flesch >= 30 ? 'Difficult (typical for research)' : 'Very difficult';
      const body = document.createElement('div'); body.className = 'mkr-dlg';
      const row = (k, v) => `<div class="mkr-stat"><span>${k}</span><b>${v}</b></div>`;
      body.innerHTML = `<div class="mkr-stats">${row('Flesch reading ease', st.flesch ?? '–')}${row('Reads as', ease)}${row('Grade level', st.grade ?? '–')}${row('Words per sentence', st.wordsPerSentence)}${row('Long sentences (30+ words)', fmtNum(st.longSentences))}${row('Sentences', fmtNum(st.sentences))}</div>
        <div class="mkr-note">Higher reading ease means easier text. Splitting long sentences is the quickest way to raise it.</div>`;
      await app.ui.dialog({ title: 'Readability', body, buttons: [{ label: 'Close', value: 'ok', primary: true }] });
    },
  });

  // ---- comments
  const reviewComments = text => analyze(text).comments.filter(c => /^<!--\s*comment:/i.test(c[2]));
  cmd('review.comment', {
    label: 'New comment', icon: 'comment', shortcut: 'Ctrl+Alt+M', isEnabled: mdOnly,
    async run(args) {
      const doc = needDoc(); if (!doc) return;
      const c = caret(doc);
      const t = typeof args === 'string' ? args : await app.ui.prompt('New comment', c && c.text ? `About: “${c.text.slice(0, 60)}${c.text.length > 60 ? '…' : ''}”` : 'Comment', '');
      if (t == null || !t.trim()) return;
      const md = `<!-- comment: ${t.trim().replace(/--+>?/g, '–')} -->`;
      if (c && c.end > c.start && app.mode === 'simple') insertMd(doc, md, { offset: c.end, direct: true });
      else insertMd(doc, md);
      applyCommentView();
    },
  });
  cmd('review.nextComment', { label: 'Next comment', icon: 'comment', isEnabled: mdOnly, run: () => navigate('comment', 1) });
  cmd('review.prevComment', { label: 'Previous comment', icon: 'comment', isEnabled: mdOnly, run: () => navigate('comment', -1) });
  cmd('review.deleteComment', {
    label: 'Delete comment', icon: 'x', isEnabled: mdOnly,
    run() {
      const doc = needDoc(); if (!doc) return;
      const text = syncFromEditor(doc), list = reviewComments(text);
      if (!list.length) return app.ui.toast('Add a comment with Review → New Comment. This document has none yet.', { kind: 'info' });
      let k = -1;
      const surf = app.mode === 'word' ? surface() : null;
      if (surf) {
        const dom = [...surf.querySelectorAll('.mk-comment')];
        const on = surf.querySelector('.mk-comment.on') || navigate.last;
        k = dom.indexOf(on);
        if (k < 0) { const s = getSelection(); const r = s && s.rangeCount ? s.getRangeAt(0) : null; if (r) k = dom.findIndex(d => { const x = document.createRange(); x.selectNode(d); return x.compareBoundaryPoints(Range.START_TO_START, r) >= 0; }); }
      } else {
        const c = caret(doc); const at = c ? c.start : -1;
        k = list.findIndex(x => at >= x[0] && at <= x[1]); if (k < 0) k = list.findIndex(x => x[0] >= at);
      }
      if (k < 0) return app.ui.toast('Click a comment first, or use Next comment.');
      const [a, b] = list[k];
      let s = a, e = b; if (text[e] === '\n' && (s === 0 || text[s - 1] === '\n')) e++; else if (text[s - 1] === ' ') s--;
      doc.setText(text.slice(0, s) + text.slice(e), 'research');
      navigate.last = null;
      app.ui.toast('Comment deleted');
    },
  });
  cmd('review.deleteComments', {
    label: 'Delete all comments', icon: 'x', isEnabled: mdOnly,
    async run() {
      const doc = needDoc(); if (!doc) return;
      const text = syncFromEditor(doc), list = reviewComments(text);
      if (!list.length) return app.ui.toast('Add a comment with Review → New Comment. This document has none yet.', { kind: 'info' });
      if (!(await app.ui.confirm('Delete all comments?', `This removes ${list.length} comment${list.length === 1 ? '' : 's'}. Undo (Ctrl+Z) brings them back.`))) return;
      let out = text;
      for (const [a, b] of [...list].reverse()) { let s = a, e = b; if (out[e] === '\n' && (s === 0 || out[s - 1] === '\n')) e++; else if (out[s - 1] === ' ') s--; out = out.slice(0, s) + out.slice(e); }
      doc.setText(out, 'research');
      app.ui.toast(`${list.length} comment${list.length === 1 ? '' : 's'} deleted`);
    },
  });
  cmd('review.showComments', {
    label: 'Show comments', icon: 'comment', isActive: () => app.settings.get('showComments', true) !== false,
    run() { app.settings.set('showComments', !(app.settings.get('showComments', true) !== false)); applyCommentView(); },
  });

  // ---- compare with saved
  function diffLines(a, b) {
    let pre = 0; while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
    let suf = 0; while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
    const A = a.slice(pre, a.length - suf), B = b.slice(pre, b.length - suf);
    const mid = myers(A, B) || [...A.map(s => ({ t: '-', s })), ...B.map(s => ({ t: '+', s }))];
    return [...a.slice(0, pre).map(s => ({ t: ' ', s })), ...mid, ...a.slice(a.length - suf).map(s => ({ t: ' ', s }))];
  }
  function myers(A, B, maxD = 1500) {
    const N = A.length, M = B.length, MAX = N + M;
    if (!N) return B.map(s => ({ t: '+', s })); if (!M) return A.map(s => ({ t: '-', s }));
    const off = MAX + 1, v = new Int32Array(2 * MAX + 3); const trace = [];
    let D = -1;
    outer: for (let d = 0; d <= Math.min(MAX, maxD); d++) {
      for (let k = -d; k <= d; k += 2) {
        let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1;
        let y = x - k;
        while (x < N && y < M && A[x] === B[y]) { x++; y++; }
        v[off + k] = x;
        if (x >= N && y >= M) { trace.push(v.slice(off - d, off + d + 1)); D = d; break outer; }
      }
      trace.push(v.slice(off - d, off + d + 1));
    }
    if (D < 0) return null;
    const out = []; let x = N, y = M;
    for (let d = D; d > 0; d--) {
      const prev = trace[d - 1], get = k => (k < -(d - 1) || k > d - 1 ? -1 : prev[k + d - 1]);
      const k = x - y;
      const pk = (k === -d || (k !== d && get(k - 1) < get(k + 1))) ? k + 1 : k - 1;
      const px = get(pk), py = px - pk;
      while (x > px && y > py) { out.push({ t: ' ', s: A[x - 1] }); x--; y--; }
      if (x === px) { out.push({ t: '+', s: B[y - 1] }); y--; } else { out.push({ t: '-', s: A[x - 1] }); x--; }
    }
    while (x > 0 && y > 0) { out.push({ t: ' ', s: A[x - 1] }); x--; y--; }
    return out.reverse();
  }
  cmd('review.compare', {
    label: 'Compare with saved version', icon: 'copy', isEnabled: mdOnly,
    async run() {
      const doc = needDoc(); if (!doc) return;
      const now = syncFromEditor(doc);
      let saved = doc.savedText || '', from = 'the last save';
      if (doc.path && !doc.convertedFrom) { try { saved = String(await mk.invoke('read-text', doc.path)); from = 'the file on disk'; } catch {} }
      else if (!doc.path) { app.ui.toast('Save the document first. Compare shows what changed since the last save.', { kind: 'warn', actions: [{ label: 'Save', run: () => app.commands.run('file.save') }] }); return; }
      const d = diffLines(saved.replace(/\r\n/g, '\n').split('\n'), now.replace(/\r\n/g, '\n').split('\n'));
      const adds = d.filter(x => x.t === '+').length, dels = d.filter(x => x.t === '-').length;
      const body = document.createElement('div'); body.className = 'mkr-dlg';
      if (!adds && !dels) {
        body.innerHTML = `<div class="mkr-empty"><b>No changes</b>The document matches ${from}.</div>`;
      } else {
        let o = 0, n = 0, html = '';
        const keep = new Array(d.length).fill(false);
        d.forEach((x, i) => { if (x.t !== ' ') for (let j = Math.max(0, i - 3); j <= Math.min(d.length - 1, i + 3); j++) keep[j] = true; });
        let gap = 0;
        d.forEach((x, i) => {
          if (x.t !== '+') o++; if (x.t !== '-') n++;
          if (!keep[i]) { gap++; return; }
          if (gap) { html += `<div class="mkr-dl gap">⋯ ${gap} unchanged line${gap === 1 ? '' : 's'}</div>`; gap = 0; }
          html += `<div class="mkr-dl${x.t === '+' ? ' add' : x.t === '-' ? ' del' : ''}"><span class="ln">${x.t !== '+' ? o : ''}</span><span class="ln">${x.t !== '-' ? n : ''}</span><span class="sg">${x.t === ' ' ? '' : x.t === '+' ? '+' : '−'}</span><span class="tx">${esc(x.s) || ' '}</span></div>`;
        });
        if (gap) html += `<div class="mkr-dl gap">⋯ ${gap} unchanged line${gap === 1 ? '' : 's'}</div>`;
        body.innerHTML = `<div class="mkr-sum"><span class="a">+${fmtNum(adds)} added</span><span class="d">−${fmtNum(dels)} removed</span><span>Compared with ${from}</span></div><div class="mkr-diff">${html}</div>`;
      }
      const v = await app.ui.dialog({ title: 'Changes since saved', body, buttons: (adds || dels) ? [{ label: 'Go back to saved version', value: 'revert', danger: true }, { label: 'Close', value: 'ok', primary: true }] : [{ label: 'Close', value: 'ok', primary: true }] });
      if (v === 'revert' && await app.ui.confirm('Go back to the saved version?', 'Your unsaved changes are replaced by the saved text. Undo (Ctrl+Z) brings them back, and a recovery copy is kept.')) {
        mk.invoke('recovery-save', { docId: doc.recoveryId, path: doc.path, title: doc.title, text: now }).catch(() => {});
        doc.setText(saved, 'research');
      }
    },
  });

  // =================================================================== Find & Replace panel
  const find = {
    open: false, el: null, opts: { caseSensitive: false, wholeWord: false, regex: false }, cur: -1, count: 0, ranges: [], srcMatches: [], backend: 'text',
    build() {
      if (this.el) return;
      injectCss();
      const el = this.el = document.createElement('div');
      el.className = 'mkr-find'; el.setAttribute('role', 'search'); el.setAttribute('aria-label', 'Find and replace');
      el.innerHTML = `
        <div class="mkr-frow">
          <button class="mkr-ib" data-a="toggle" title="Show Replace (Ctrl+H)">${icon('chev', 'right')}</button>
          <label class="mkr-field">${icon('search')}<input class="q" placeholder="Find" spellcheck="false" aria-label="Find"></label>
          <span class="mkr-count" aria-live="polite"></span>
          <button class="mkr-ib" data-a="prev" title="Previous (Shift+Enter)">${icon('chev', 'up')}</button>
          <button class="mkr-ib" data-a="next" title="Next (Enter)">${icon('chev')}</button>
          <button class="mkr-ib" data-a="close" title="Close (Esc)">${icon('x')}</button>
        </div>
        <div class="mkr-opts">
          <button class="mkr-opt" data-o="caseSensitive" title="Match upper and lower case (Alt+C)" aria-pressed="false">Match case</button>
          <button class="mkr-opt" data-o="wholeWord" title="Whole words only (Alt+W)" aria-pressed="false">Whole words</button>
          <button class="mkr-opt" data-o="regex" title="Use a pattern (regular expression) (Alt+R)" aria-pressed="false">Pattern .*</button>
        </div>
        <div class="mkr-frow mkr-rep">
          <label class="mkr-field">${icon('redo')}<input class="r" placeholder="Replace with" spellcheck="false" aria-label="Replace with"></label>
          <button class="mkr-btn" data-a="one" title="Replace this match (Ctrl+Shift+1)">Replace</button>
          <button class="mkr-btn" data-a="all" title="Replace every match (Ctrl+Alt+Enter)">Replace all</button>
        </div>`;
      document.body.appendChild(el);
      this.q = el.querySelector('.q'); this.r = el.querySelector('.r'); this.countEl = el.querySelector('.mkr-count');
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-a],[data-o]'); if (!b) return;
        if (b.dataset.o) return this.toggleOpt(b.dataset.o);
        const a = b.dataset.a;
        if (a === 'toggle') this.showReplace(!el.classList.contains('rep'));
        else if (a === 'prev') this.step(-1); else if (a === 'next') this.step(1);
        else if (a === 'close') this.close(); else if (a === 'one') this.replaceOne(); else if (a === 'all') this.replaceAll();
      });
      this.q.addEventListener('input', app.debounce(() => this.search(true), 140));
      el.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(true); }
        else if (e.key === 'Enter' && e.target === this.q) { e.preventDefault(); this.step(e.shiftKey ? -1 : 1); }
        else if (e.key === 'Enter' && e.target === this.r) { e.preventDefault(); if (e.ctrlKey && e.altKey) this.replaceAll(); else this.replaceOne(); }
        else if (e.key === 'Enter' && e.ctrlKey && e.altKey) { e.preventDefault(); this.replaceAll(); }
        else if (e.altKey && !e.ctrlKey && /^[cwr]$/i.test(e.key)) { e.preventDefault(); this.toggleOpt({ c: 'caseSensitive', w: 'wholeWord', r: 'regex' }[e.key.toLowerCase()]); }
        else if (e.key === 'F3') { e.preventDefault(); this.step(e.shiftKey ? -1 : 1); }
        else if ((e.ctrlKey || e.metaKey) && /^[fh]$/i.test(e.key)) { e.preventDefault(); this.show(e.key.toLowerCase() === 'h'); }
        else if (e.ctrlKey || e.metaKey || /^F\d+$/.test(e.key)) return; // let app shortcuts (Ctrl+S...) through
        e.stopPropagation();
      });
      addEventListener('resize', () => this.place());
    },
    place() {
      if (!this.el) return;
      const c = document.querySelector('#editorHost, .canvas-host, .canvas, #canvas, [data-mk-canvas]') || document.querySelector('main');
      const r = c ? c.getBoundingClientRect() : { top: 150, right: innerWidth };
      this.el.style.top = Math.max(8, r.top + 12) + 'px';
      this.el.style.right = Math.max(8, innerWidth - r.right + 22) + 'px';
    },
    show(replace) {
      this.build();
      const doc = app.docs.active();
      this.backend = doc && (doc.kind === 'pdf' || doc.kind === 'djvu') ? 'viewer' : 'text';
      this.el.classList.toggle('noreplace', this.backend === 'viewer');
      if (replace != null) this.showReplace(replace && this.backend === 'text');
      // seed from selection
      let sel = '';
      try { sel = this.backend === 'text' ? (editor()?.getSelection?.()?.text || '') : String(getSelection() || ''); } catch {}
      if (sel && sel.length < 200 && !sel.includes('\n')) this.q.value = sel;
      this.place();
      this.open = true; this.el.classList.add('show');
      (replace && this.backend === 'text' && this.q.value ? this.r : this.q).focus();
      this.q.select();
      this.search(true);
    },
    showReplace(on) { this.el.classList.toggle('rep', !!on); if (on) this.r.focus(); },
    close(restore) {
      if (!this.open) return;
      this.open = false; this.el.classList.remove('show');
      if (this.backend === 'viewer') app.viewers?.clearFind?.();
      const cur = this.ranges[this.cur];
      this.clearHighlights();
      if (restore) {
        if (cur && this.backend === 'text' && app.mode === 'word') { try { const s = getSelection(); s.removeAllRanges(); s.addRange(cur); (cur.startContainer.parentElement.closest('[contenteditable="true"]') || surface())?.focus({ preventScroll: true }); } catch {} }
        else editor()?.focus?.();
      }
    },
    toggleOpt(k) {
      this.opts[k] = !this.opts[k];
      const b = this.el.querySelector(`[data-o="${k}"]`); b.classList.toggle('on', this.opts[k]); b.setAttribute('aria-pressed', String(this.opts[k]));
      this.search(true);
    },
    regex() {
      const q = this.q.value; if (!q) return null;
      let src = this.opts.regex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (this.opts.wholeWord) src = `(?<![\\p{L}\\p{N}_])(?:${src})(?![\\p{L}\\p{N}_])`;
      return new RegExp(src, 'gm' + (this.opts.wholeWord ? 'u' : '') + (this.opts.caseSensitive ? '' : 'i'));
    },
    setCount(text, bad) { this.countEl.textContent = text; this.countEl.classList.toggle('none', !!bad); },
    clearHighlights() { if (window.CSS && CSS.highlights) { CSS.highlights.delete('mkr-find'); CSS.highlights.delete('mkr-find-cur'); } },
    refreshSoon: app.debounce(() => { if (find.open) find.search(false); }, 120),
    async search(reset) {
      if (!this.open) return;
      const field = this.q.closest('.mkr-field'); field.classList.remove('bad');
      let re = null;
      try { re = this.regex(); } catch { field.classList.add('bad'); this.setCount('Check pattern', true); this.clearHighlights(); return; }
      if (this.backend === 'viewer') {
        if (!re) { app.viewers?.clearFind?.(); this.setCount(''); return; }
        const r = await (app.viewers?.find?.(this.q.value, { ...this.opts }) || { count: 0 });
        if (r.error) { field.classList.add('bad'); this.setCount('Check pattern', true); return; }
        this.count = r.count; this.cur = r.index;
        this.setCount(r.count ? `${r.index + 1} of ${fmtNum(r.count)}` : 'No results', !r.count);
        return;
      }
      const doc = activeDoc();
      if (!re || !doc) { this.clearHighlights(); this.ranges = []; this.srcMatches = []; this.count = 0; this.setCount(''); return; }
      const prevCur = this.cur;
      this.srcMatches = sourceMatches(doc.text, re, app.mode === 'word');
      const surf = app.mode === 'word' ? surface() : null;
      this.ranges = surf ? domMatches(surf, re) : [];
      this.count = surf ? this.ranges.length : this.srcMatches.length;
      if (!this.count) { this.cur = -1; this.clearHighlights(); this.setCount('No results', true); return; }
      if (reset || prevCur < 0) {
        // start from the caret
        if (surf) {
          const s = getSelection(); const here = s && s.rangeCount && surf.contains(s.anchorNode) ? s.getRangeAt(0) : null;
          this.cur = here ? Math.max(0, this.ranges.findIndex(r => r.compareBoundaryPoints(Range.START_TO_START, here) >= 0)) : 0;
        } else { const c = caret(doc); this.cur = c ? Math.max(0, this.srcMatches.findIndex(m => m.start >= c.start)) : 0; }
      } else this.cur = Math.min(prevCur, this.count - 1);
      this.go(reset);
    },
    go(scroll = true) {
      this.setCount(`${this.cur + 1} of ${fmtNum(this.count)}`);
      if (app.mode === 'word' && this.ranges.length) {
        if (window.CSS && CSS.highlights && typeof Highlight !== 'undefined') {
          CSS.highlights.set('mkr-find', new Highlight(...this.ranges.filter((_, i) => i !== this.cur)));
          CSS.highlights.set('mkr-find-cur', new Highlight(this.ranges[this.cur]));
        }
        if (scroll) { const r = this.ranges[this.cur]; revealRect(r.getBoundingClientRect(), r.startContainer.parentElement); }
      } else {
        const m = this.srcMatches[this.cur]; const doc = activeDoc();
        if (m && doc && scroll) { selectSource(doc, m.start, m.end); try { editor()?.scrollToLine?.(lineOf(doc.text, m.start)); } catch {} if (!editor()?.setSelection) editor()?.find?.(this.q.value, { ...this.opts, from: m.start }); this.q.focus(); }
      }
    },
    async step(dir) {
      if (!this.open) return this.show();
      if (this.backend === 'viewer') {
        const r = await (app.viewers?.findNext?.(dir) || { count: 0 });
        this.setCount(r.count ? `${r.index + 1} of ${fmtNum(r.count)}` : 'No results', !r.count);
        return;
      }
      if (!this.count) return this.search(true);
      this.cur = (this.cur + dir + this.count) % this.count;
      this.go(true);
    },
    sourceIndex() {
      // map the current match (DOM in Word mode) to a match in the Markdown source
      const S = this.srcMatches; if (!S.length) return -1;
      if (app.mode !== 'word' || !this.ranges.length) return Math.min(this.cur, S.length - 1);
      if (S.length === this.ranges.length) return this.cur;
      const txt = String(this.ranges[this.cur]);
      const guess = Math.round(this.cur * (S.length - 1) / Math.max(1, this.ranges.length - 1));
      let best = -1, bd = Infinity;
      S.forEach((m, i) => { const d = Math.abs(i - guess) + (m.text === txt ? 0 : 1000); if (d < bd) { bd = d; best = i; } });
      return best;
    },
    replacement(m, re) {
      const rep = this.r.value;
      if (!this.opts.regex) return rep;
      try { return m.text.replace(new RegExp(re.source, re.flags.replace('g', '')), rep); } catch { return rep; }
    },
    replaceOne() {
      const doc = activeDoc(); if (!doc || !this.count) return;
      const re = this.regex(); const i = this.sourceIndex(); const m = this.srcMatches[i]; if (!m) return;
      const text = doc.text;
      const keep = this.cur;
      doc.setText(text.slice(0, m.start) + this.replacement(m, re) + text.slice(m.end), 'research-find');
      this.cur = keep;
      setTimeout(() => this.search(false), app.mode === 'word' ? 260 : 30);
    },
    replaceAll() {
      const doc = activeDoc(); if (!doc) return;
      let re; try { re = this.regex(); } catch { return; }
      if (!re) return;
      const ms = sourceMatches(doc.text, re, app.mode === 'word');
      if (!ms.length) { this.setCount('No results', true); return; }
      let out = doc.text;
      for (const m of [...ms].reverse()) out = out.slice(0, m.start) + this.replacement(m, re) + out.slice(m.end);
      doc.setText(out, 'research-find');
      app.ui.toast(`Replaced ${fmtNum(ms.length)} match${ms.length === 1 ? '' : 'es'}`);
      setTimeout(() => this.search(true), 260);
    },
  };
  // Matches in Markdown source. In Word mode, skip what the reader does not see as text.
  function sourceMatches(text, re, visibleOnly) {
    let skip = [];
    if (visibleOnly) { const A = analyze(text); skip = [...A.front, ...A.comments, ...A.displayMath, ...A.inlineMath, ...A.images, ...A.links, ...A.cites, ...A.fnRefs, ...A.fnDefs, ...A.html]; }
    const out = []; re.lastIndex = 0; let m;
    while ((m = re.exec(text))) {
      if (!m[0].length) { re.lastIndex++; continue; }
      const a = m.index, b = a + m[0].length;
      if (skip.length && inRanges(skip, a, b)) continue;
      out.push({ start: a, end: b, text: m[0] });
    }
    return out;
  }
  const SKIP_SEL = '.mk-math,.katex,.mk-front,.mk-bibliography,.mk-cite,.mk-comment,.mermaid,svg,script,style,.footnote-ref,.footnote-backref,.mkr-find';
  const BLOCK = /^(P|DIV|LI|H[1-6]|TD|TH|TR|BLOCKQUOTE|PRE|SECTION|DT|DD|FIGCAPTION|HEADER|ARTICLE|TABLE|UL|OL)$/;
  function domMatches(root, re) {
    const nodes = []; let str = '', lastBlock = null;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && n.parentElement.closest(SKIP_SEL) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    while (tw.nextNode()) {
      const n = tw.currentNode;
      let b = n.parentElement; while (b && b !== root && !BLOCK.test(b.nodeName)) b = b.parentElement;
      if (lastBlock && b !== lastBlock) str += '\n';
      lastBlock = b;
      nodes.push({ n, s: str.length }); str += n.data;
    }
    if (!nodes.length) return [];
    const at = off => { let lo = 0, hi = nodes.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (nodes[mid].s <= off) lo = mid; else hi = mid - 1; } return nodes[lo]; };
    const out = []; re.lastIndex = 0; let m;
    while ((m = re.exec(str)) && out.length < 5000) {
      if (!m[0].length) { re.lastIndex++; continue; }
      const a = at(m.index), b = at(m.index + m[0].length - 1);
      try { const r = new Range(); r.setStart(a.n, Math.min(m.index - a.s, a.n.data.length)); r.setEnd(b.n, Math.min(m.index + m[0].length - b.s, b.n.data.length)); out.push(r); } catch {}
    }
    return out;
  }
  cmd('edit.find', { label: 'Find', icon: 'search', shortcut: 'Ctrl+F', run: () => find.show(false) });
  cmd('edit.replace', { label: 'Replace', icon: 'search', shortcut: 'Ctrl+H', isEnabled: () => !!activeDoc(), run: () => find.show(true) });
  cmd('edit.findNext', { label: 'Find next', icon: 'search', shortcut: 'F3', run: () => find.step(1) });
  cmd('edit.findPrev', { label: 'Find previous', icon: 'search', shortcut: 'Shift+F4', run: () => find.step(-1) });
  app.events.on('doc:active', () => { if (find.open) { const d = app.docs.active(); const be = d && (d.kind === 'pdf' || d.kind === 'djvu') ? 'viewer' : 'text'; find.backend = be; find.el.classList.toggle('noreplace', be === 'viewer'); find.cur = -1; setTimeout(() => find.search(true), 200); } });
  app.events.on('doc:changed', e => { if (find.open && e && e.doc === app.docs.active() && e.origin !== 'research-find') find.refreshSoon(); });
  app.events.on('mode:changed', () => { if (find.open) { find.cur = -1; setTimeout(() => find.search(true), 250); } });
  app.events.on('zoom:changed', () => find.open && find.place());

  // =================================================================== ribbon
  const big = (command, label, icon) => ({ type: 'big', command, label, icon });
  const small = (command, label, icon) => ({ type: 'small', command, label, icon });
  app.ribbon.addGroup('references', { id: 'ref-toc', label: 'Table of contents', order: 10, items: [big('ref.toc', 'Contents', 'toc'), big('ref.tocUpdate', 'Update', 'redo')] });
  app.ribbon.addGroup('references', { id: 'ref-foot', label: 'Footnotes', order: 20, items: [big('ref.footnote', 'Footnote', 'foot'), { type: 'col', items: [small('ref.prevFootnote', 'Previous footnote', 'back'), small('ref.nextFootnote', 'Next footnote', 'xref')] }] });
  app.ribbon.addGroup('references', {
    id: 'ref-cite', label: 'Citations & bibliography', order: 30, items: [
      big('ref.cite', 'Cite', 'cite'), big('ref.library', 'Library', 'bib'),
      { type: 'col', items: [
        { type: 'select', command: 'ref.style', label: 'Citation style', options: STYLES, value: () => citeStyle() },
        { type: 'custom', render: renderLibChip },
      ] },
      big('ref.bibliography', 'Bibliography', 'ol'),
    ],
  });
  // the Captions group (Insert Caption, Cross-reference, numbering style) is added by src/xref.js
  // Review → Proofing and Writing groups: src/writing/ui.js
  app.ribbon.addGroup('review', {
    id: 'rev-comments', label: 'Comments', order: 20, items: [
      big('review.comment', 'New comment', 'comment'),
      { type: 'col', items: [small('review.prevComment', 'Previous comment', 'back'), small('review.nextComment', 'Next comment', 'xref')] },
      { type: 'col', items: [small('review.deleteComment', 'Delete comment', 'x'), small('review.deleteComments', 'Delete all comments', 'cut')] },
      big('review.showComments', 'Show', 'side'),
    ],
  });
  app.ribbon.addGroup('review', { id: 'rev-versions', label: 'Versions', order: 30, items: [big('review.compare', 'Compare', 'copy')] });
  function renderLibChip(el) {
    const b = document.createElement('button');
    b.className = 'mkr-chip'; b.type = 'button';
    const paint = () => {
      const d = activeDoc(); const st = d && bibState.get(d.id);
      const name = st && st.files.length ? st.files.map(baseName).join(', ') : '';
      b.classList.toggle('none', !name);
      b.innerHTML = `${icon('bib')}<span>${esc(name || 'No library')}</span>`;
      b.title = name ? `${name} · ${fmtNum(Object.keys(st.entries).length)} references. Click to choose another.` : 'Choose a BibTeX (.bib) library';
    };
    b.onclick = () => app.commands.run('ref.library');
    paint(); el.appendChild(b);
    const offs = [app.events.on('research:bib', () => (b.isConnected ? paint() : offs.forEach(o => o()))), app.events.on('doc:active', () => (b.isConnected ? paint() : null))];
    injectCss();
  }

  // =================================================================== public API
  app.research = {
    bib: () => entriesFor(app.docs.active()),
    entries: doc => entriesFor(doc || app.docs.active()),
    loadBib: (doc, force) => loadBib(doc || app.docs.active(), force),
    // add-ons (for example a Zotero bridge) can supply references for a document directly
    setEntries(doc, entries, label = 'Add-on library') {
      doc = doc || app.docs.active(); if (!doc) return;
      const st = bibState.get(doc.id) || { key: '', files: [], errors: [] };
      st.entries = { ...(st.entries || {}), ...(entries || {}) }; if (!st.files.includes(label)) st.files = [...st.files, label];
      bibState.set(doc.id, st);
      app.events.emit('research:bib', { doc, files: st.files, count: Object.keys(st.entries).length, errors: st.errors });
      if (isActive(doc)) refreshEditor();
    },
    outline, stats, analyze, slugify, tocBlock, tocList, updateTocText, nextFootnoteNumber, citeMarkdown, captionTargets, diffLines,
    citeStyle, formatEntry: fmtEntry, insertCitation,
    spelling: { enabled: spellOn, status: () => { const t = app.writing?.statusText?.(); return t != null ? t : spellOn() ? null : 'Spelling off'; } },
    find: { show: r => find.show(r), close: () => find.close(), get open() { return find.open; } },
  };
  injectCss();
  applyCommentView();

  // =================================================================== smoke tests
  const assert = app.assert;
  app.tests.register('research: BibTeX parse + cite insert gives [@key]', async () => {
    const src = '@article{smith2020,\n  author = {Smith, John and Jones, Kate},\n  title = {Rivers and {Sediment}},\n  journal = {Water Research},\n  year = {2020},\n  volume = {12},\n  pages = {1--10}\n}\n';
    const bib = mk.parseBib(src);
    assert(bib.smith2020 && bib.smith2020.year === '2020', 'parseBib reads the entry');
    assert(inTextNames(bib.smith2020, 'apa') === 'Smith & Jones', 'APA names: ' + inTextNames(bib.smith2020, 'apa'));
    assert(/Smith, J\., &amp; Jones, K\. \(2020\)/.test(fmtEntry(bib.smith2020, 'apa', 1)), 'APA reference: ' + fmtEntry(bib.smith2020, 'apa', 1));
    assert(citeMarkdown(['a', 'b'], '4') === '[@a; @b, p. 4]', 'multi cite with locator');
    const d = app.docs.create({ text: 'As shown', title: 'cite-test' });
    try {
      insertCitation(d, ['smith2020'], '', { direct: true, offset: d.text.length });
      assert(d.text === 'As shown [@smith2020]', 'got: ' + d.text);
    } finally { await app.docs.close(d.id, { force: true }); }
  });
  app.tests.register('research: TOC from 3 headings', () => {
    const text = '---\ntitle: T\n---\n# Intro\n\nText\n\n## Shields’ parameter $\\theta$\n\n```\n# not a heading\n```\n\n## Field data\n';
    const toc = tocBlock(text);
    const lines = toc.split('\n');
    assert(lines[0] === '<!-- toc -->' && lines[lines.length - 1] === '<!-- /toc -->', 'markers');
    assert(lines.length === 5, 'three entries, got ' + toc);
    assert(lines[1] === '- [Intro](#intro)', lines[1]);
    assert(lines[2] === '  - [Shields’ parameter $\\theta$](#shields-parameter)', lines[2]);
    assert(lines[3] === '  - [Field data](#field-data)', lines[3]);
    const withToc = text.replace('# Intro', '<!-- toc -->\n- [Old](#old)\n<!-- /toc -->\n\n# Intro');
    assert(updateTocText(withToc).includes('- [Field data](#field-data)'), 'update refreshes the list');
  });
  app.tests.register('research: footnote numbering picks the next free number', () => {
    assert(nextFootnoteNumber('No notes.') === 1, 'first is 1');
    assert(nextFootnoteNumber('A[^1] b[^3]\n\n[^1]: x\n[^3]: y\n\n```\n[^9]\n```') === 4, 'skips code, uses max + 1');
    assert(appendFootnote('Text[^2]\n\n[^1]: a', 2, '') === 'Text[^2]\n\n[^1]: a\n[^2]: ', 'definition appended');
  });
  app.tests.register('research: word count leaves out math and front matter', () => {
    const st = stats('---\ntitle: Hello World Again\nauthor: Someone\n---\nOne two $x + y$ three, see [@smith2020] and https://example.com.\n\n$$\na = b + c\n$$\n\n```\ncode words here\n```\n');
    assert(st.words === 5, 'words: ' + st.words);
    assert(st.equations === 2 && st.displayEquations === 1, 'equations: ' + st.equations);
    assert(st.citations === 1, 'citations: ' + st.citations);
    assert(st.paragraphs === 1 && st.sentences === 1, `paragraphs ${st.paragraphs}, sentences ${st.sentences}`);
  });
  app.tests.register('research: compare finds added and removed lines', () => {
    const d = diffLines(['a', 'b', 'c', 'd'], ['a', 'c', 'd', 'e']);
    assert(d.map(x => x.t + x.s).join(',') === ' a,-b, c, d,+e', d.map(x => x.t + x.s).join(','));
  });
})();
