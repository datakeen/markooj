// Markooj — research: PDF and DjVu page viewers (app.viewers). See ARCHITECTURE.md.
// PDF pages render with pdf.js (canvas + selectable text layer), DjVu pages through the bundled DjVuLibre
// tools (main's `djvu-page` / `djvu-text`). Both share one calm viewer frame and an "Edit as text" action.
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const mk = app.mk || window.mk || {};
  const esc = app.esc || (s => String(s ?? ''));
  const abs = p => new URL(p, document.baseURI).href;
  const PDFJS = '../node_modules/pdfjs-dist/';
  const PT2PX = 96 / 72; // CSS px per PDF point at 100%
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const icon = (name, cls = '') => `<svg class="i${cls ? ' ' + cls : ''}"><use href="#${name}"/></svg>`;

  // ---------------------------------------------------------------- styles (scoped to .mkv)
  function injectCss() {
    if (document.getElementById('mkv-css')) return;
    const s = document.createElement('style'); s.id = 'mkv-css';
    s.textContent = `
.mkv{position:absolute;inset:0;display:flex;flex-direction:column;background:var(--canvas,#e9e9ee);color:var(--text,#1d1d1f);font:13px/1.4 var(--font,system-ui);z-index:1}
.mkv-bar{flex:none;height:42px;display:flex;align-items:center;gap:6px;padding:0 10px;background:var(--chrome,rgba(251,251,253,.86));backdrop-filter:saturate(180%) blur(20px);border-bottom:.5px solid var(--line,rgba(0,0,0,.08));animation:mkvFade .28s var(--ease,ease)}
@keyframes mkvFade{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
.mkv-btn{height:28px;min-width:28px;padding:0 7px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;gap:6px;color:var(--text-2,#6e6e73);background:none;border:0;font:inherit;transition:background .15s,color .15s,transform .12s var(--ease,ease)}
.mkv-btn:hover{background:var(--hover,rgba(0,0,0,.05));color:var(--text,#1d1d1f)}
.mkv-btn:active{background:var(--press,rgba(0,0,0,.09));transform:scale(.94)}
.mkv-btn.on{background:var(--accent-soft,rgba(10,102,255,.1));color:var(--accent,#0a66ff)}
.mkv-btn:disabled{opacity:.4;pointer-events:none}
.mkv-btn svg.i{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.mkv-btn .up{transform:rotate(180deg)}
.mkv-badge{font:600 9px var(--font,system-ui);padding:2px 5px;border-radius:4px;letter-spacing:.03em;background:rgba(220,38,38,.12);color:#dc2626}
.mkv-badge.djvu{background:rgba(94,92,230,.14);color:#5e5ce6}
.mkv-label{color:var(--text-2,#6e6e73);white-space:nowrap}
.mkv-label b{color:var(--text,#1d1d1f);font-weight:600}
.mkv-sep{width:.5px;height:18px;background:var(--line-2,rgba(0,0,0,.12));margin:0 4px}
.mkv-spacer{flex:1}
.mkv-pagebox{display:inline-flex;align-items:center;gap:5px;color:var(--text-2,#6e6e73);font-variant-numeric:tabular-nums}
.mkv-pagebox input{width:44px;height:26px;border-radius:6px;border:.5px solid var(--line-2,rgba(0,0,0,.12));background:var(--surface,#fff);color:var(--text,#1d1d1f);font:inherit;text-align:center;outline:none;transition:border-color .15s,box-shadow .15s}
.mkv-pagebox input:focus{border-color:var(--accent,#0a66ff);box-shadow:0 0 0 3px var(--accent-ring,rgba(10,102,255,.28))}
.mkv-primary{height:28px;padding:0 12px;border-radius:7px;border:0;background:var(--accent,#0a66ff);color:#fff;font:500 12.5px var(--font,system-ui);display:inline-flex;align-items:center;gap:6px;box-shadow:0 1px 2px rgba(10,82,224,.3);transition:background .15s,transform .12s var(--ease,ease)}
.mkv-primary:hover{background:var(--accent-2,#3d8bff)}
.mkv-primary:active{transform:scale(.96)}
.mkv-primary:disabled{opacity:.5;pointer-events:none}
.mkv-primary svg.i{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.mkv-body{flex:1;min-height:0;display:grid;grid-template-columns:auto 1fr}
.mkv-thumbs{width:0;overflow:hidden auto;background:var(--bg,#f5f5f7);border-right:.5px solid transparent;transition:width .35s var(--ease,ease),border-color .35s}
.mkv.thumbs-on .mkv-thumbs{width:156px;border-right-color:var(--line,rgba(0,0,0,.08))}
.mkv-thumbs-in{width:156px;padding:14px 0 40px;display:flex;flex-direction:column;align-items:center;gap:14px}
.mkv-thumb{display:flex;flex-direction:column;align-items:center;gap:5px;background:none;border:0;padding:0;font:11px var(--font,system-ui);color:var(--text-3,#a1a1a6)}
.mkv-thumb .pg{position:relative;background:#fff;border-radius:3px;box-shadow:0 1px 2px rgba(0,0,0,.08),0 3px 10px rgba(0,0,0,.08);overflow:hidden;transition:box-shadow .2s,transform .15s var(--ease,ease)}
.mkv-thumb:hover .pg{transform:translateY(-1px);box-shadow:0 0 0 3px var(--accent-soft,rgba(10,102,255,.1)),0 3px 10px rgba(0,0,0,.1)}
.mkv-thumb.on .pg{box-shadow:0 0 0 2px var(--accent,#0a66ff)}
.mkv-thumb.on{color:var(--accent,#0a66ff);font-weight:600}
.mkv-thumb canvas,.mkv-thumb img{position:absolute;inset:0;width:100%;height:100%}
.mkv-scroll{position:relative;overflow:auto;outline:none;min-width:0}
.mkv-pages{display:flex;flex-direction:column;align-items:center;gap:24px;padding:34px 24px 80px;min-width:max-content}
.mkv-page{position:relative;flex:none;background:#fff;box-shadow:var(--page-shadow,0 1px 2px rgba(0,0,0,.06),0 8px 28px rgba(0,0,0,.08));border-radius:3px;overflow:hidden;--scale-round-x:1px;--scale-round-y:1px;--user-unit:1}
.mkv-page>canvas,.mkv-page>img{position:absolute;inset:0;width:100%;height:100%;display:block;user-select:none;-webkit-user-drag:none}
.mkv-page .mkv-ph{position:absolute;inset:0;display:grid;place-items:center;color:#c7c7cc;font:600 22px var(--font,system-ui)}
.mkv-page.ready .mkv-ph{display:none}
.mkv-msg{margin:12vh auto;max-width:460px;padding:26px 28px;border-radius:var(--r-lg,12px);background:var(--surface,#fff);box-shadow:var(--page-shadow);text-align:center;animation:mkvFade .3s var(--ease,ease)}
.mkv-msg h3{margin:0 0 8px;font:600 16px var(--font,system-ui)}
.mkv-msg p{margin:0 0 14px;color:var(--text-2,#6e6e73);line-height:1.5}
.mkv-msg small{display:block;margin-top:12px;color:var(--text-3,#a1a1a6);word-break:break-word}
.mkv-msg .mkv-works{font-size:12px;margin:12px 0 0}
.mkv-msg .mkv-acts{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.mkv-msg .mkv-acts .mkv-secondary{background:none;color:var(--accent,#0a66ff);border:1px solid var(--line,rgba(0,0,0,.12))}
.mkv-msg ol{margin:0 0 14px;padding-left:20px;text-align:left;color:var(--text-2,#6e6e73);line-height:1.5}
.mkv-msg .mkv-cmd{display:flex;gap:6px;align-items:center;margin-top:4px}
.mkv-msg .mkv-cmd code{flex:1;min-width:0;padding:3px 8px;border-radius:6px;background:var(--fill,rgba(0,0,0,.05));font-size:12px;user-select:all;word-break:break-all}
.mkv-msg details{margin-top:14px;text-align:left;font-size:12px;color:var(--text-3,#a1a1a6)}
.mkv-msg details pre{white-space:pre-wrap;word-break:break-all;margin:6px 0 0;font-size:11px}
.mkv-spin{width:22px;height:22px;margin:0 auto 12px;border-radius:50%;border:2.5px solid var(--accent-soft,rgba(10,102,255,.1));border-top-color:var(--accent,#0a66ff);animation:mkvSpin .8s linear infinite}
@keyframes mkvSpin{to{transform:rotate(360deg)}}
.mkv .textLayer{position:absolute;text-align:initial;inset:0;overflow:clip;opacity:1;line-height:1;letter-spacing:normal;word-spacing:normal;-webkit-text-size-adjust:none;forced-color-adjust:none;transform-origin:0 0;caret-color:CanvasText;z-index:0;
  --min-font-size:1;--text-scale-factor:calc(var(--total-scale-factor) * var(--min-font-size));--min-font-size-inv:calc(1 / var(--min-font-size))}
.mkv .textLayer :is(span,br){color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0% 0%;user-select:text}
.mkv .textLayer > :not(.markedContent),.mkv .textLayer .markedContent span:not(.markedContent){z-index:1;--font-height:0;font-size:calc(var(--text-scale-factor) * var(--font-height));--scale-x:1;--rotate:0deg;transform:rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv))}
.mkv .textLayer .markedContent{display:contents}
.mkv .textLayer br::selection{background:transparent}
.mkv .textLayer ::selection{background:var(--accent-ring,rgba(10,102,255,.28));color:transparent}
::highlight(mkv-find){background-color:rgba(255,214,10,.42)}
::highlight(mkv-find-cur){background-color:rgba(255,159,10,.72)}
.mkv-page.hit{box-shadow:0 0 0 2px var(--orange,#ff9f0a),var(--page-shadow)}
`;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------- pdf.js loading + caches
  let libP = null;
  function pdfLib() {
    if (!libP) {
      libP = import(abs(PDFJS + 'build/pdf.mjs')).then(m => {
        m.GlobalWorkerOptions.workerSrc = abs(PDFJS + 'build/pdf.worker.mjs');
        return m;
      }).catch(e => { libP = null; throw e; });
    }
    return libP;
  }
  function b64ToBytes(b64) {
    if (b64 instanceof Uint8Array) return b64;
    if (b64 instanceof ArrayBuffer) return new Uint8Array(b64);
    const bin = atob(String(b64 || '')); const n = bin.length; const u = new Uint8Array(n);
    for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  async function loadPdf(data) {
    const lib = await pdfLib();
    const task = lib.getDocument({
      data: b64ToBytes(data),
      cMapUrl: abs(PDFJS + 'cmaps/'), cMapPacked: true,
      standardFontDataUrl: abs(PDFJS + 'standard_fonts/'),
      wasmUrl: abs(PDFJS + 'wasm/'), iccUrl: abs(PDFJS + 'iccs/'),
      isEvalSupported: false,
    });
    task.onPassword = (update, reason) => {
      const again = reason === (lib.PasswordResponses?.INCORRECT_PASSWORD ?? 2);
      Promise.resolve(app.ui.prompt(again ? 'Try the password again' : 'Enter the password for this PDF', again ? 'Type the password again (check Caps Lock). That one did not open the file.' : 'Type the password to open it', ''))
        .then(p => (p == null ? task.destroy() : update(p)));
    };
    return task.promise;
  }
  const docCache = new Map(); // doc.id → {pdf: Promise, sizes: [], texts: [], djvuText: Promise}
  function cacheFor(doc) {
    if (!docCache.has(doc.id)) docCache.set(doc.id, { sizes: [], texts: [] });
    return docCache.get(doc.id);
  }
  app.events.on('doc:closed', doc => {
    const c = doc && docCache.get(doc.id); if (!c) return;
    docCache.delete(doc.id);
    c.pdf?.then(p => p.destroy()).catch(() => {});
  });

  // Text of one pdf.js page exactly as the text layer lays it out (spans + <br> for line ends).
  function itemsToLayerText(items) {
    let s = '';
    for (const it of items) { if (it.str === undefined) continue; s += it.str; if (it.hasEOL) s += '\n'; }
    return s;
  }

  // ---------------------------------------------------------------- PDF text → Markdown
  function mdEscape(t) {
    let s = t.replace(/\\/g, '\\\\').replace(/([*`$<_])/g, '\\$1');
    s = s.replace(/^(\s*)([#>+=|])/, '$1\\$2').replace(/^(\s*)(-{3,}|={3,})\s*$/, '$1\\$2');
    return s;
  }
  const BULLET = /^\s*([•◦▪▫●○■□‣⁃–—-]|\*)\s+/;
  function joinLines(a, b) {
    if (!a) return b;
    if (/[A-Za-zÀ-ɏ]-$/.test(a) && /^[a-zß-ÿ]/.test(b)) return a.slice(0, -1) + b;
    return a.replace(/\s+$/, '') + ' ' + b.replace(/^\s+/, '');
  }
  // pages: [[{str, x, y, size, w, hasEOL}]] (PDF user space, y grows upward)
  function pdfPagesToMarkdown(pages) {
    const sizeChars = new Map();
    const rs = v => Math.round(v * 2) / 2;
    for (const items of pages) for (const it of items) { const k = rs(it.size); sizeChars.set(k, (sizeChars.get(k) || 0) + it.str.trim().length); }
    let body = 10, best = -1;
    for (const [k, n] of sizeChars) if (n > best) { best = n; body = k; }
    const headSizes = [...sizeChars.keys()].filter(k => k >= body * 1.12 && sizeChars.get(k) > 0).sort((a, b) => b - a).slice(0, 4);
    const levelOf = size => { const i = headSizes.findIndex(k => Math.abs(k - rs(size)) < 0.01 || rs(size) >= k); return i < 0 ? 0 : Math.min(i + 1, 4); };

    const out = [];
    pages.forEach((items, pi) => {
      // 1. lines
      const lines = []; let line = null;
      const flush = () => { if (line && line.text.trim()) lines.push(line); line = null; };
      for (const it of items) {
        if (!it.str && !it.hasEOL) continue;
        if (line && it.str.trim() && Math.abs(it.y - line.y) > Math.max(line.size, it.size, 1) * 0.55) flush();
        if (!line && it.str.trim()) line = { text: '', y: it.y, x: it.x, size: 0, chars: 0, xEnd: it.x };
        if (line && it.str) {
          if (line.text && !/\s$/.test(line.text) && !/^\s/.test(it.str) && it.x > line.xEnd + it.size * 0.18) line.text += ' ';
          line.text += it.str; line.xEnd = it.x + (it.w || 0);
          const n = it.str.trim().length;
          if (n) { line.size = (line.size * line.chars + it.size * n) / (line.chars + n); line.chars += n; }
        }
        if (it.hasEOL) flush();
      }
      flush();
      // drop bare page numbers at the top/bottom of the page
      while (lines.length && /^\s*(page\s+)?\d{1,4}\s*$/i.test(lines[lines.length - 1].text)) lines.pop();
      while (lines.length && /^\s*(page\s+)?\d{1,4}\s*$/i.test(lines[0].text)) lines.shift();
      // 2. typical leading for body lines
      const gaps = [];
      for (let i = 1; i < lines.length; i++) { const g = lines[i - 1].y - lines[i].y; if (g > 0 && Math.abs(lines[i].size - body) < 1) gaps.push(g); }
      gaps.sort((a, b) => a - b);
      const lead = gaps.length ? gaps[Math.floor((gaps.length - 1) / 2)] : body * 1.25;
      // 3. blocks
      const blocks = []; let cur = null;
      lines.forEach((ln, i) => {
        const lvl = ln.text.trim().length < 160 ? levelOf(ln.size) : 0;
        const prev = lines[i - 1];
        const gap = prev ? prev.y - ln.y : 0;
        const bullet = BULLET.test(ln.text);
        const newBlock = !cur || lvl !== cur.level || bullet || (prev && (gap > lead * 1.45 || gap < -lead * 0.5)) ||
          (cur.level === 0 && prev && /[.!?:]["”’)]?\s*$/.test(prev.text) && ln.x > prev.x + body * 1.2);
        if (newBlock) { cur = { level: lvl, bullet, text: '' }; blocks.push(cur); }
        const t = ln.text.trim();
        cur.text = joinLines(cur.text, bullet && cur.text === '' ? t.replace(BULLET, '') : t);
      });
      if (pi > 0 && blocks.length) out.push('<div class="page-break"></div>');
      for (const b of blocks) {
        const t = b.text.replace(/\s+/g, ' ').trim(); if (!t) continue;
        if (b.level) out.push('#'.repeat(b.level) + ' ' + mdEscape(t));
        else if (b.bullet) out.push('- ' + mdEscape(t));
        else out.push(mdEscape(t));
      }
    });
    // keep consecutive list items together
    return out.join('\n\n').replace(/(^- .*)\n\n(?=- )/gm, '$1\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
  function djvuTextToMarkdown(text) {
    const pages = String(text || '').split('\f');
    const out = [];
    pages.forEach((pg, pi) => {
      const paras = pg.replace(/\r/g, '').split(/\n\s*\n/).map(p => p.split('\n').map(s => s.trim()).filter(Boolean)).filter(p => p.length);
      if (pi > 0 && paras.length) out.push('<div class="page-break"></div>');
      for (const p of paras) {
        const first = p[0];
        if (p.length === 1 && first.length < 70 && !/[.,;:!?]$/.test(first) && (first === first.toUpperCase() && /[A-Z]/.test(first))) { out.push('## ' + mdEscape(first)); continue; }
        if (BULLET.test(first)) { out.push(p.map(l => (BULLET.test(l) ? '- ' + mdEscape(l.replace(BULLET, '')) : '  ' + mdEscape(l))).join('\n')); continue; }
        out.push(mdEscape(p.reduce((a, b) => joinLines(a, b), '')));
      }
    });
    return out.join('\n\n').trim() + '\n';
  }
  async function pdfItems(pdf, cache, i) {
    if (cache && cache.items && cache.items[i]) return cache.items[i];
    const page = await pdf.getPage(i + 1);
    const tc = await page.getTextContent();
    const items = tc.items.filter(it => it.str !== undefined).map(it => ({
      str: it.str, x: it.transform[4], y: it.transform[5], size: Math.hypot(it.transform[2], it.transform[3]) || it.height || 10, w: it.width, hasEOL: it.hasEOL,
    }));
    if (cache) { (cache.items ||= [])[i] = items; cache.texts[i] = itemsToLayerText(tc.items); }
    return items;
  }
  async function extractPdfMarkdown(pdf, cache, onProgress) {
    const pages = [];
    for (let i = 0; i < pdf.numPages; i++) { pages.push(await pdfItems(pdf, cache, i)); onProgress?.(i + 1, pdf.numPages); }
    return pdfPagesToMarkdown(pages);
  }

  // ---------------------------------------------------------------- the viewer
  class Viewer {
    constructor(host, doc) {
      injectCss();
      this.host = host; this.doc = doc; this.kind = doc.kind === 'djvu' ? 'djvu' : 'pdf';
      this.cache = cacheFor(doc);
      this.pages = []; this.zoom = app.zoom || 100; this.current = 0; this.numPages = 0;
      this.queue = new Set(); this.busy = false; this.dead = false; this.rendered = new Set();
      this.find = { query: '', matches: [], cur: -1 };
      this.offs = [];
      this.build();
      this.offs.push(app.events.on('zoom:changed', pct => this.setZoom(+pct || app.zoom || 100)));
      this.ready = this.init();
    }
    build() {
      if (!/^(relative|absolute|fixed|sticky)$/.test(getComputedStyle(this.host).position)) this.host.style.position = 'relative';
      const label = this.kind === 'pdf' ? 'PDF' : 'DjVu';
      const root = this.root = document.createElement('div');
      root.className = 'mkv' + (app.settings.get('viewerThumbs', false) ? ' thumbs-on' : '');
      root.innerHTML = `
        <div class="mkv-bar" role="toolbar" aria-label="${label} viewer">
          <button class="mkv-btn" data-a="thumbs" title="Page thumbnails">${icon('side')}</button>
          <span class="mkv-sep"></span>
          <span class="mkv-badge ${this.kind}">${label.toUpperCase()}</span>
          <span class="mkv-label">${label} · view only</span>
          <span class="mkv-spacer"></span>
          <button class="mkv-btn" data-a="prev" title="Previous page (Page Up)">${icon('chev', 'up')}</button>
          <span class="mkv-pagebox"><input type="text" inputmode="numeric" aria-label="Page number" value="1"><span class="mkv-of">of –</span></span>
          <button class="mkv-btn" data-a="next" title="Next page (Page Down)">${icon('chev')}</button>
          <span class="mkv-sep"></span>
          <button class="mkv-btn" data-a="find" title="Find in ${label} (Ctrl+F)">${icon('search')}</button>
          <span class="mkv-sep"></span>
          <button class="mkv-primary" data-a="edit" title="Turn this ${label} into a Markdown document you can edit" disabled>${icon('doc')}Edit as text</button>
        </div>
        <div class="mkv-body">
          <aside class="mkv-thumbs" aria-label="Pages"><div class="mkv-thumbs-in"></div></aside>
          <div class="mkv-scroll" tabindex="0"><div class="mkv-pages"><div class="mkv-msg"><div class="mkv-spin"></div><p>Opening ${esc(this.doc.title)}…</p></div></div></div>
        </div>`;
      this.host.appendChild(root);
      this.scroller = root.querySelector('.mkv-scroll');
      this.pagesEl = root.querySelector('.mkv-pages');
      this.thumbsEl = root.querySelector('.mkv-thumbs-in');
      this.pageInput = root.querySelector('.mkv-pagebox input');
      this.ofEl = root.querySelector('.mkv-of');
      root.querySelector('[data-a="thumbs"]').classList.toggle('on', root.classList.contains('thumbs-on'));
      root.querySelector('.mkv-bar').addEventListener('click', e => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a;
        if (a === 'thumbs') this.toggleThumbs();
        else if (a === 'prev') this.goTo(this.current - 1);
        else if (a === 'next') this.goTo(this.current + 1);
        else if (a === 'edit') this.editAsText();
        else if (a === 'find') { if (app.commands.get('edit.find')) app.commands.run('edit.find'); else this.promptFind(); }
      });
      this.pageInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); const n = parseInt(this.pageInput.value, 10); if (n) this.goTo(n - 1); this.scroller.focus({ preventScroll: true }); }
        else if (e.key === 'Escape') { this.pageInput.value = String(this.current + 1); this.scroller.focus({ preventScroll: true }); }
      });
      this.pageInput.addEventListener('focus', () => this.pageInput.select());
      this.pageInput.addEventListener('blur', () => { this.pageInput.value = String(this.current + 1); });
      let raf = 0;
      this.scroller.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; this.trackPage(); }); }, { passive: true });
      this.scroller.addEventListener('keydown', e => {
        if (e.target !== this.scroller) return;
        if ((e.key === 'PageDown' || e.key === 'ArrowRight') && !e.ctrlKey && this.fitsOnScreen()) { e.preventDefault(); this.goTo(this.current + 1); }
        else if ((e.key === 'PageUp' || e.key === 'ArrowLeft') && !e.ctrlKey && this.fitsOnScreen()) { e.preventDefault(); this.goTo(this.current - 1); }
        else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); this.goTo(0); }
        else if (e.key === 'End' && e.ctrlKey) { e.preventDefault(); this.goTo(this.numPages - 1); }
      });
    }
    fitsOnScreen() { const p = this.pages[this.current]; return p && p.el.offsetHeight <= this.scroller.clientHeight; }
    cssScale() { return (this.zoom / 100) * PT2PX; }
    /** A calm card in place of the pages: what to do first (title, text, steps, buttons), what still works, details folded away. */
    message(title, text, detail, actions = [], extra = {}) {
      const steps = (extra.steps || []).filter(Boolean);
      this.pagesEl.innerHTML = `<div class="mkv-msg"><h3>${esc(title)}</h3><p>${esc(text)}</p>${steps.length ? `<ol>${steps.map(st => `<li>${esc(st.text || '')}${st.command ? `<div class="mkv-cmd"><code>${esc(st.command)}</code><button type="button" class="mkv-btn" data-copy="${esc(st.command)}" title="Copy">Copy</button></div>` : ''}</li>`).join('')}</ol>` : ''}<div class="mkv-acts"></div>${extra.works ? `<p class="mkv-works">${esc(extra.works)}</p>` : ''}${detail ? `<details><summary>Technical details</summary><pre>${esc(detail)}</pre></details>` : ''}</div>`;
      const box = this.pagesEl.querySelector('.mkv-acts');
      actions.forEach((a, i) => { const b = document.createElement('button'); b.className = i === 0 ? 'mkv-primary' : 'mkv-primary mkv-secondary'; b.textContent = a.label; b.onclick = a.run; box.appendChild(b); });
      this.pagesEl.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
        if (app.health?.copy) app.health.copy(b.dataset.copy, 'Command copied. Paste it into a terminal.');
        else navigator.clipboard?.writeText(b.dataset.copy).then(() => app.ui.toast('Command copied.'), () => {});
      }));
    }
    /** DjVuLibre is not there (or will not start): how to get it, with buttons that do it. */
    showToolRemedy(rem) {
      const H = app.health;
      const ctx = { tool: rem.id, details: rem.details, onChecked: n => { if (n && n.tools && n.tools[rem.id] && n.tools[rem.id].ok) this.retry(); } };
      const acts = rem.actions.filter(a => !(a.id === 'copy' && (rem.steps || []).some(st => st.command === a.text)));
      this.message(rem.title, rem.text, rem.details, acts.map(a => ({ label: a.label, run: () => H.runAction(a, ctx) })), { steps: rem.steps, works: rem.works });
    }

    async init() {
      try {
        if (this.kind === 'pdf') await this.openPdf(); else await this.openDjvu();
        if (this.dead) return;
        this.layoutPages();
        this.observe();
        this.root.querySelector('[data-a="edit"]').disabled = false;
        const start = clamp(this.doc.view?.pdfPage || 0, 0, this.numPages - 1);
        if (start) this.goTo(start, { instant: true }); else this.trackPage();
        if (this.root.classList.contains('thumbs-on')) this.buildThumbs();
        if (this.kind === 'pdf') this.measureAll();
        if (document.activeElement === document.body || !document.activeElement) this.scroller.focus({ preventScroll: true });
      } catch (e) {
        if (this.dead) return;
        console.error('[viewer]', e);
        this.failed = e;
        this.root.querySelectorAll('[data-a="prev"],[data-a="next"],[data-a="find"],[data-a="thumbs"]').forEach(b => { b.disabled = true; }); this.pageInput.disabled = true;
        const info = (mk.errorInfo && mk.errorInfo(e)) || null;
        const plain = app.ui.plainError ? app.ui.plainError(e, '') : String((e && e.message) || e || '');
        const details = (info && info.details) || plain;
        const again = { label: 'Try again', run: () => this.retry() };
        const another = { label: 'Choose another file', run: () => app.commands.run('file.open') };
        if (this.kind === 'djvu') {
          // the DjVu tools are not there: the user just tried the feature, so this is the moment to say how to get them
          const toolProblem = !!(info && /^TOOL_(MISSING|GONE)$/.test(String(info.code))) || !!this.doc.missing;
          if (toolProblem && app.health?.remedy) {
            let r = null; try { r = await app.health.check(); } catch {}
            if (this.dead) return;
            const rem = app.health.remedy('ddjvu', r);
            try { app.health.markTried?.('ddjvu'); app.status?.refresh?.(); } catch {}
            if (!rem.ok) { this.showToolRemedy(rem); return; }
          }
          if (toolProblem && !app.health?.remedy) { this.message('Open DjVu files with DjVuLibre', plain, '', [again]); return; }
          this.message('Try opening this DjVu file again', 'If it still does not open, the file may be damaged: try another copy of it.', details, [again, another], { works: 'Everything else works.' });
        } else if (/password/i.test(e && (e.name + e.message))) {
          this.message('Enter the password to open this PDF', 'This PDF is protected with a password.', '', [{ label: 'Enter password', run: () => this.retry() }, another]);
        } else {
          this.message('Try opening this PDF again', 'If it still does not open, open it in your usual PDF reader or try another copy: this file may be damaged, or it may not be a PDF.', details, [again, another], { works: 'Everything else works.' });
        }
      }
    }
    retry() { this.cache.pdf = null; this.failed = null; this.root.querySelectorAll('.mkv-bar button').forEach(b => { if (b.dataset.a !== 'edit') b.disabled = false; }); this.pageInput.disabled = false; this.pagesEl.innerHTML = '<div class="mkv-msg"><div class="mkv-spin"></div><p>Opening…</p></div>'; this.ready = this.init(); }

    async openPdf() {
      if (!this.doc.data) throw new Error('No PDF data was loaded for this file.');
      this._lib = await pdfLib();
      if (!this.cache.pdf) { this.cache.pdf = loadPdf(this.doc.data); this.cache.pdf.catch(() => { this.cache.pdf = null; }); }
      this.pdf = await this.cache.pdf;
      this.numPages = this.pdf.numPages;
      const first = await this.pdf.getPage(1);
      const vp = first.getViewport({ scale: 1 });
      this.cache.sizes[0] = { w: vp.width, h: vp.height };
      this.defaultSize = { w: vp.width, h: vp.height };
    }
    async measureAll() {
      // background: learn every page's real size so the scroll bar is exact
      for (let i = 1; i < this.numPages && !this.dead; i++) {
        if (this.cache.sizes[i]) continue;
        try { const p = await this.pdf.getPage(i + 1); const vp = p.getViewport({ scale: 1 }); this.cache.sizes[i] = { w: vp.width, h: vp.height }; } catch { break; }
        if (i % 25 === 0 || i === this.numPages - 1) this.applySizes();
      }
      this.applySizes();
    }
    async openDjvu() {
      if (!this.doc.path) throw new Error('This DjVu file has no location on disk.');
      const r = await mk.invoke('djvu-page', this.doc.path, 0, 40);
      if (!r || !r.png) throw new Error('No page image came back.');
      this.numPages = r.pages || this.doc.pages || 1;
      this.defaultSize = { w: r.width * 72 / 40, h: r.height * 72 / 40 };
      this.cache.sizes[0] = this.defaultSize;
    }

    sizeOf(i) { return this.cache.sizes[i] || this.defaultSize; }
    layoutPages() {
      this.pagesEl.innerHTML = '';
      const frag = document.createDocumentFragment();
      this.pages = [];
      for (let i = 0; i < this.numPages; i++) {
        const el = document.createElement('div'); el.className = 'mkv-page'; el.dataset.i = i;
        el.innerHTML = `<div class="mkv-ph">${i + 1}</div>`;
        frag.appendChild(el);
        this.pages.push({ i, el, scale: 0 });
      }
      this.pagesEl.appendChild(frag);
      this.ofEl.textContent = `of ${this.numPages}`;
      this.applySizes(false);
    }
    applySizes(keepAnchor = true) {
      const anchor = keepAnchor ? this.anchor() : null;
      const s = this.cssScale();
      for (const p of this.pages) {
        const z = this.sizeOf(p.i);
        p.el.style.width = Math.floor(z.w * s) + 'px'; p.el.style.height = Math.floor(z.h * s) + 'px';
        p.el.style.setProperty('--scale-factor', s); p.el.style.setProperty('--total-scale-factor', s);
      }
      if (anchor) this.restoreAnchor(anchor);
    }
    anchor() {
      const p = this.pages[this.current]; if (!p) return null;
      return { i: this.current, f: (this.scroller.scrollTop - p.el.offsetTop) / Math.max(1, p.el.offsetHeight), x: this.scroller.scrollLeft / Math.max(1, this.scroller.scrollWidth) };
    }
    restoreAnchor(a) {
      const p = this.pages[a.i]; if (!p) return;
      this.scroller.scrollTop = p.el.offsetTop + a.f * p.el.offsetHeight;
      this.scroller.scrollLeft = a.x * this.scroller.scrollWidth;
    }
    setZoom(pct) {
      pct = clamp(Math.round(pct), 25, 500);
      if (pct === this.zoom || !this.pages.length) { this.zoom = pct; return; }
      this.zoom = pct;
      this.applySizes(true);
      clearTimeout(this.zoomT);
      this.zoomT = setTimeout(() => { for (const p of this.pages) if (p.scale) this.queue.add(p); this.visible().forEach(p => this.queue.add(p)); this.pump(); }, 140);
      this.refreshThumbsSoon?.();
    }
    observe() {
      this.io = new IntersectionObserver(entries => {
        for (const e of entries) if (e.isIntersecting) { const p = this.pages[+e.target.dataset.i]; if (p) this.queue.add(p); }
        this.pump();
      }, { root: this.scroller, rootMargin: '900px 0px' });
      for (const p of this.pages) this.io.observe(p.el);
    }
    visible() {
      const top = this.scroller.scrollTop, bot = top + this.scroller.clientHeight;
      return this.pages.filter(p => p.el.offsetTop < bot + 900 && p.el.offsetTop + p.el.offsetHeight > top - 900);
    }
    async pump() {
      if (this.busy || this.dead) return;
      this.busy = true;
      try {
        while (this.queue.size && !this.dead) {
          // nearest page to the one being read first
          let best = null;
          for (const p of this.queue) if (!best || Math.abs(p.i - this.current) < Math.abs(best.i - this.current)) best = p;
          this.queue.delete(best);
          const s = this.cssScale(), dpr = window.devicePixelRatio || 1;
          if (best.scale === s && best.dpr === dpr) continue;
          if (!this.isNear(best)) continue;
          try { await (this.kind === 'pdf' ? this.renderPdfPage(best, s, dpr) : this.renderDjvuPage(best, s, dpr)); }
          catch (e) { if (e && e.name !== 'RenderingCancelledException') console.warn('[viewer] page', best.i + 1, e); }
          this.evict();
        }
      } finally { this.busy = false; }
    }
    isNear(p) {
      const top = this.scroller.scrollTop, h = this.scroller.clientHeight || 800;
      return p.el.offsetTop < top + h + 1600 && p.el.offsetTop + p.el.offsetHeight > top - 1600;
    }
    evict() {
      if (this.rendered.size <= 24) return;
      const far = [...this.rendered].sort((a, b) => Math.abs(b.i - this.current) - Math.abs(a.i - this.current));
      for (const p of far.slice(0, this.rendered.size - 24)) {
        p.el.querySelectorAll('canvas,img,.textLayer').forEach(n => { if (n.tagName === 'CANVAS') { n.width = n.height = 0; } n.remove(); });
        p.el.classList.remove('ready'); p.scale = 0; p.textReady = false; this.rendered.delete(p);
        try { p.page?.cleanup(); } catch {}
      }
    }
    async renderPdfPage(p, s, dpr) {
      const page = p.page || (p.page = await this.pdf.getPage(p.i + 1));
      const base = page.getViewport({ scale: 1 });
      if (!this.cache.sizes[p.i] || this.cache.sizes[p.i].w !== base.width) { this.cache.sizes[p.i] = { w: base.width, h: base.height }; this.applySizes(true); }
      const vp = page.getViewport({ scale: s });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(vp.width * dpr)); canvas.height = Math.max(1, Math.floor(vp.height * dpr));
      const ctx = canvas.getContext('2d', { alpha: false });
      const task = page.render({ canvas, canvasContext: ctx, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
      p.task = task;
      await task.promise;
      if (this.dead) return;
      p.el.querySelector(':scope > canvas')?.remove();
      p.el.prepend(canvas);
      p.el.classList.add('ready');
      p.scale = s; p.dpr = dpr; this.rendered.add(p);
      // selectable text layer
      p.el.querySelector('.textLayer')?.remove();
      const tl = document.createElement('div'); tl.className = 'textLayer';
      p.el.appendChild(tl);
      p.textReady = false;
      try {
        const layer = new this.lib.TextLayer({ textContentSource: page.streamTextContent(), container: tl, viewport: vp });
        await layer.render();
        p.textReady = true;
      } catch (e) { if (e?.name !== 'AbortException') console.warn('[viewer] text layer', e); }
      this.paintFind();
    }
    get lib() { return this._lib; }
    async renderDjvuPage(p, s, dpr) {
      const dpi = clamp(Math.round(72 * s * dpr), 30, 600);
      const r = await mk.invoke('djvu-page', this.doc.path, p.i, dpi);
      if (this.dead || !r || !r.png) return;
      const z = { w: r.width * 72 / dpi, h: r.height * 72 / dpi };
      const old = this.cache.sizes[p.i];
      if (!old || Math.abs(old.w - z.w) > 1 || Math.abs(old.h - z.h) > 1) { this.cache.sizes[p.i] = z; this.applySizes(true); }
      const img = new Image(); img.alt = `Page ${p.i + 1}`; img.decoding = 'async'; img.draggable = false;
      img.src = 'data:image/png;base64,' + r.png;
      try { await img.decode(); } catch {}
      if (this.dead) return;
      p.el.querySelector(':scope > img')?.remove();
      p.el.prepend(img); p.el.classList.add('ready');
      p.scale = s; p.dpr = dpr; this.rendered.add(p);
    }

    trackPage() {
      if (!this.pages.length) return;
      const y = this.scroller.scrollTop + Math.min(this.scroller.clientHeight * 0.35, 260);
      let lo = 0, hi = this.pages.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this.pages[mid].el.offsetTop <= y) lo = mid; else hi = mid - 1; }
      this.root.querySelector('[data-a="prev"]').disabled = lo <= 0;
      this.root.querySelector('[data-a="next"]').disabled = lo >= this.numPages - 1;
      if (lo !== this.current || this.pageInput.value === '' || !this._tracked) {
        this._tracked = true; this.current = lo;
        if (document.activeElement !== this.pageInput) this.pageInput.value = String(lo + 1);
        if (this.doc.view) this.doc.view.pdfPage = lo;
        this.thumbsEl.querySelectorAll('.mkv-thumb.on').forEach(t => t.classList.remove('on'));
        const t = this.thumbsEl.children[lo]; if (t) { t.classList.add('on'); if (this.root.classList.contains('thumbs-on')) t.scrollIntoView({ block: 'nearest' }); }
        app.events.emit('viewer:page', { doc: this.doc, page: lo + 1, pages: this.numPages });
        app.status?.refresh?.();
      }
    }
    goTo(i, opts = {}) {
      if (!this.pages.length) return;
      i = clamp(i | 0, 0, this.numPages - 1);
      const p = this.pages[i];
      this.scroller.scrollTo({ top: p.el.offsetTop - 16, behavior: opts.instant ? 'auto' : 'smooth' });
      this.current = i; this.pageInput.value = String(i + 1);
      this.queue.add(p); this.pump();
      setTimeout(() => this.trackPage(), opts.instant ? 0 : 420);
    }

    // ---- thumbnails
    toggleThumbs(force) {
      const on = force ?? !this.root.classList.contains('thumbs-on');
      this.root.classList.toggle('thumbs-on', on);
      this.root.querySelector('[data-a="thumbs"]').classList.toggle('on', on);
      app.settings.set('viewerThumbs', on);
      if (on) this.buildThumbs();
      app.events.emit('ribbon:changed');
    }
    buildThumbs() {
      if (this.thumbsBuilt || !this.pages.length) return;
      this.thumbsBuilt = true;
      const W = 112;
      const frag = document.createDocumentFragment();
      for (const p of this.pages) {
        const z = this.sizeOf(p.i);
        const b = document.createElement('button'); b.className = 'mkv-thumb' + (p.i === this.current ? ' on' : ''); b.dataset.i = p.i; b.title = `Page ${p.i + 1}`;
        b.innerHTML = `<span class="pg" style="width:${W}px;height:${Math.round(W * z.h / z.w)}px"></span><span>${p.i + 1}</span>`;
        b.onclick = () => this.goTo(p.i);
        frag.appendChild(b);
      }
      this.thumbsEl.appendChild(frag);
      const todo = new Set(); let running = false;
      const run = async () => {
        if (running) return; running = true;
        while (todo.size && !this.dead) {
          const b = todo.values().next().value; todo.delete(b);
          if (b.dataset.done) continue; b.dataset.done = '1';
          const i = +b.dataset.i, box = b.querySelector('.pg');
          try {
            if (this.kind === 'pdf') {
              const page = await this.pdf.getPage(i + 1);
              const vp1 = page.getViewport({ scale: 1 });
              const dpr = window.devicePixelRatio || 1;
              const vp = page.getViewport({ scale: (W / vp1.width) * dpr });
              box.style.height = Math.round(W * vp1.height / vp1.width) + 'px';
              const c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
              await page.render({ canvas: c, canvasContext: c.getContext('2d', { alpha: false }), viewport: vp }).promise;
              box.appendChild(c);
            } else {
              const z = this.sizeOf(i);
              const dpi = clamp(Math.round(W * (window.devicePixelRatio || 1) * 72 / z.w), 8, 150);
              const r = await mk.invoke('djvu-page', this.doc.path, i, dpi);
              if (r && r.png) { const img = new Image(); img.src = 'data:image/png;base64,' + r.png; box.appendChild(img); }
            }
          } catch (e) { console.warn('[viewer] thumbnail', i + 1, e); }
        }
        running = false;
      };
      this.thumbIo = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) todo.add(e.target); run(); }, { root: this.thumbsEl.parentElement, rootMargin: '400px 0px' });
      this.thumbsEl.querySelectorAll('.mkv-thumb').forEach(b => this.thumbIo.observe(b));
    }

    // ---- text: find + edit as text
    async pageTexts() {
      if (this.kind === 'pdf') {
        for (let i = 0; i < this.numPages; i++) if (this.cache.texts[i] == null) {
          const page = await this.pdf.getPage(i + 1);
          const tc = await page.getTextContent();
          this.cache.texts[i] = itemsToLayerText(tc.items);
        }
        return this.cache.texts;
      }
      if (!this.cache.djvuText) { this.cache.djvuText = mk.invoke('djvu-text', this.doc.path); this.cache.djvuText.catch(() => { this.cache.djvuText = null; }); }
      const t = await this.cache.djvuText;
      return String(t || '').split('\f');
    }
    static regex(query, opts = {}) {
      if (!query) return null;
      let src = opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      if (opts.wholeWord) src = `(?<![\\p{L}\\p{N}_])(?:${src})(?![\\p{L}\\p{N}_])`;
      return new RegExp(src, 'g' + (opts.wholeWord ? 'u' : '') + (opts.caseSensitive ? '' : 'i'));
    }
    async search(query, opts = {}) {
      this.find = { query, opts, matches: [], cur: -1 };
      if (!query) { this.paintFind(); return { count: 0, index: -1 }; }
      let re; try { re = Viewer.regex(query, opts); } catch (e) { this.paintFind(); return { count: 0, index: -1, error: 'Invalid pattern' }; }
      const texts = await this.pageTexts();
      if (this.find.query !== query) return { count: this.find.matches.length, index: this.find.cur };
      texts.forEach((t, page) => { re.lastIndex = 0; let m; while ((m = re.exec(t || ''))) { if (!m[0].length) { re.lastIndex++; continue; } this.find.matches.push({ page, start: m.index, end: m.index + m[0].length }); } });
      if (this.find.matches.length) {
        const k = this.find.matches.findIndex(m => m.page >= this.current);
        await this.findGo(k < 0 ? 0 : k);
      } else this.paintFind();
      return { count: this.find.matches.length, index: this.find.cur };
    }
    async findNext(dir = 1) {
      const n = this.find.matches.length; if (!n) return { count: 0, index: -1 };
      await this.findGo((this.find.cur + dir + n) % n);
      return { count: n, index: this.find.cur };
    }
    async findGo(k) {
      this.find.cur = k;
      const m = this.find.matches[k]; if (!m) return;
      const p = this.pages[m.page];
      if (m.page !== this.current || !this.isOnScreen(p)) this.goTo(m.page, { instant: true });
      this.queue.add(p); await this.pump();
      this.paintFind(true);
    }
    isOnScreen(p) { const t = this.scroller.scrollTop; return p.el.offsetTop >= t && p.el.offsetTop + p.el.offsetHeight <= t + this.scroller.clientHeight; }
    clearFind() { this.find = { query: '', matches: [], cur: -1 }; this.paintFind(); }
    paintFind(scroll) {
      this.pages.forEach(p => p.el.classList.remove('hit'));
      const H = window.CSS && CSS.highlights;
      if (!H || typeof Highlight === 'undefined') return;
      const all = [], cur = [];
      if (this.kind === 'pdf') {
        const byPage = new Map();
        this.find.matches.forEach((m, k) => { if (!byPage.has(m.page)) byPage.set(m.page, []); byPage.get(m.page).push([m, k]); });
        for (const [pi, list] of byPage) {
          const p = this.pages[pi]; const tl = p && p.textReady && p.el.querySelector('.textLayer'); if (!tl) continue;
          const nodes = []; let pos = 0;
          const walk = n => { for (const c of n.childNodes) { if (c.nodeType === 3) { nodes.push({ n: c, s: pos }); pos += c.data.length; } else if (c.nodeName === 'BR') pos += 1; else walk(c); } };
          walk(tl);
          const at = off => { let lo = 0, hi = nodes.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (nodes[mid].s <= off) lo = mid; else hi = mid - 1; } return nodes[lo]; };
          for (const [m, k] of list) {
            if (!nodes.length) break;
            try {
              const a = at(m.start), b = at(m.end - 1);
              const r = new Range();
              r.setStart(a.n, clamp(m.start - a.s, 0, a.n.data.length)); r.setEnd(b.n, clamp(m.end - b.s, 0, b.n.data.length));
              (k === this.find.cur ? cur : all).push(r);
              if (k === this.find.cur && scroll) {
                const rr = r.getBoundingClientRect(), sr = this.scroller.getBoundingClientRect();
                if (rr.height && (rr.top < sr.top + 40 || rr.bottom > sr.bottom - 40)) this.scroller.scrollTop += rr.top - sr.top - sr.height / 3;
              }
            } catch {}
          }
        }
      } else {
        const m = this.find.matches[this.find.cur];
        if (m && this.pages[m.page]) this.pages[m.page].el.classList.add('hit');
      }
      if (all.length) H.set('mkv-find', new Highlight(...all)); else H.delete('mkv-find');
      if (cur.length) H.set('mkv-find-cur', new Highlight(...cur)); else H.delete('mkv-find-cur');
    }
    async promptFind() {
      const q = await app.ui.prompt('Find', `Find text in this ${this.kind === 'pdf' ? 'PDF' : 'DjVu file'}`, this.find.query || '');
      if (!q) return;
      const r = await this.search(q, {});
      app.ui.toast(r.count ? `${r.count} match${r.count === 1 ? '' : 'es'} found` : `Try other words or a shorter search: “${q}” is not in this ${this.kind === 'pdf' ? 'PDF' : 'DjVu file'}.`, r.count ? {} : { kind: 'info' });
    }
    async editAsText() {
      const btn = this.root.querySelector('[data-a="edit"]');
      btn.disabled = true;
      const old = btn.innerHTML; btn.innerHTML = `${icon('doc')}Reading text…`;
      try {
        let md;
        if (this.kind === 'pdf') md = await extractPdfMarkdown(this.pdf, this.cache, (i, n) => { if (n > 3) btn.innerHTML = `${icon('doc')}Reading page ${i} of ${n}…`; });
        else md = djvuTextToMarkdown((await this.pageTexts()).join('\f'));
        if (!md.replace(/<div class="page-break"><\/div>/g, '').trim()) {
          await app.ui.dialog({ title: 'To edit a scan, turn its pictures into text first', body: `This ${this.kind === 'pdf' ? 'PDF' : 'DjVu file'} holds only pictures of pages (a scan), so there are no words to copy out. Run it through a text recognition (OCR) program, such as the one that came with your scanner, then open the new copy here. You can still read this one in Markooj.`, buttons: [{ label: 'OK', value: 'ok', primary: true }] });
          return null;
        }
        const nd = app.docs.create({ text: md, title: this.doc.title + ' (edited)', convertedFrom: this.doc.ext || this.kind });
        app.ui.toast('Opened an editable copy. Save it to keep it.');
        return nd;
      } catch (e) {
        console.error(e);
        const info = (mk.errorInfo && mk.errorInfo(e)) || null;
        if (this.kind === 'djvu' && info && /^TOOL_(MISSING|GONE)$/.test(String(info.code)) && app.health?.offer) app.health.offer('ddjvu');
        else if (app.health?.toastError && info) app.health.toastError(e, { retry: () => this.editAsText() });
        else app.ui.toast(this.kind === 'djvu' ? 'Try “Edit as text” again. If the text still cannot be read, the file may hold only pictures of pages.' : 'Try “Edit as text” again. If it still does not work, this PDF may hold only pictures of pages.', { kind: 'error', actions: [{ label: 'Try again', run: () => this.editAsText() }] });
        return null;
      } finally { btn.innerHTML = old; btn.disabled = false; }
    }

    destroy() {
      this.dead = true;
      this.offs.forEach(off => { try { off(); } catch {} });
      this.io?.disconnect(); this.thumbIo?.disconnect();
      for (const p of this.pages) { try { p.task?.cancel(); } catch {} }
      clearTimeout(this.zoomT);
      if (window.CSS && CSS.highlights) { CSS.highlights.delete('mkv-find'); CSS.highlights.delete('mkv-find-cur'); }
      this.root.remove();
    }
  }

  // ---------------------------------------------------------------- public API
  let current = null;
  const isViewerDoc = d => !!d && (d.kind === 'pdf' || d.kind === 'djvu');
  const viewers = app.viewers = {
    mount(host, doc) {
      viewers.unmount();
      if (!host || !doc) return null;
      current = new Viewer(host, doc);
      return current;
    },
    unmount() { if (current) { current.destroy(); current = null; } },
    create(host, doc) { return new Viewer(host, doc); },
    current() { return current && !current.dead ? current : null; },
    isViewerDoc,
    // find (used by research's Find panel when a PDF/DjVu tab is active)
    async find(query, opts) { return viewers.current() ? viewers.current().search(query, opts) : { count: 0, index: -1 }; },
    async findNext(dir = 1) { return viewers.current() ? viewers.current().findNext(dir) : { count: 0, index: -1 }; },
    clearFind() { viewers.current()?.clearFind(); },
    async editAsText() { return viewers.current()?.editAsText(); },
    goTo(n) { viewers.current()?.goTo(n - 1); },
    state() { const v = viewers.current(); return v ? { page: v.current + 1, pages: v.numPages, doc: v.doc } : null; },
    loadPdf,
    pdfPagesToMarkdown, djvuTextToMarkdown,
    async pdfToMarkdown(data) { const pdf = await loadPdf(data); try { return await extractPdfMarkdown(pdf, null); } finally { pdf.destroy(); } },
  };

  // ---------------------------------------------------------------- commands (palette + keyboard reach)
  const whenViewer = () => isViewerDoc(app.docs.active()) && !!viewers.current();
  app.commands.register('viewer.editAsText', { label: 'Edit PDF or DjVu as text', icon: 'doc', run: () => viewers.editAsText(), isEnabled: whenViewer });
  app.commands.register('viewer.thumbnails', { label: 'Show page thumbnails', icon: 'side', run: () => viewers.current()?.toggleThumbs(), isEnabled: whenViewer, isActive: () => !!viewers.current()?.root.classList.contains('thumbs-on') });
  app.commands.register('viewer.nextPage', { label: 'Next page', icon: 'chev', run: () => { const v = viewers.current(); v?.goTo(v.current + 1); }, isEnabled: whenViewer });
  app.commands.register('viewer.prevPage', { label: 'Previous page', icon: 'chev', run: () => { const v = viewers.current(); v?.goTo(v.current - 1); }, isEnabled: whenViewer });
  app.commands.register('viewer.goToPage', {
    label: 'Go to page…', icon: 'page', shortcut: 'Ctrl+Alt+G', isEnabled: whenViewer,
    async run(args) {
      const v = viewers.current(); if (!v) return;
      const n = args?.page || parseInt(await app.ui.prompt('Go to page', `Page number (1–${v.numPages})`, String(v.current + 1)), 10);
      if (n) v.goTo(n - 1);
    },
  });

  // ---------------------------------------------------------------- smoke test
  function tinyPdf(text) {
    const objs = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      null,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    const stream = `BT /F1 18 Tf 30 120 Td (${text}) Tj ET`;
    objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    let out = '%PDF-1.4\n'; const offs = [];
    objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const x = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
    return btoa(out);
  }
  viewers._tinyPdf = tinyPdf;
  app.tests.register('viewers: PDF viewer opens a generated one-page PDF', async () => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-5000px;top:0;width:900px;height:700px';
    document.body.appendChild(host);
    const fake = { id: 'test-pdf-' + Date.now(), kind: 'pdf', ext: 'pdf', title: 'Tiny', data: tinyPdf('Hello Markooj'), view: {} };
    const v = viewers.create(host, fake);
    try {
      await v.ready;
      if (v.failed) throw v.failed;
      app.assert(v.numPages === 1, 'expected 1 page, got ' + v.numPages);
      app.assert(host.querySelectorAll('.mkv-page').length === 1, 'one page card');
      const md = await extractPdfMarkdown(v.pdf, null);
      app.assert(/Hello Markooj/.test(md), 'Edit as text extracts the words, got: ' + md);
      const r = await v.search('markooj', {});
      app.assert(r.count === 1, 'find in PDF finds 1 match, got ' + r.count);
    } finally { v.destroy(); host.remove(); const c = docCache.get(fake.id); docCache.delete(fake.id); c?.pdf?.then(p => p.destroy()).catch(() => {}); }
  });
  app.tests.register('viewers: a DjVu file that cannot be shown gets a solution-first card', async () => {
    const info = await mk.invoke('app-info');
    const sep = mk.platform === 'win32' ? '\\' : '/';
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-5000px;top:0;width:900px;height:700px';
    document.body.appendChild(host);
    const card = async doc => {
      const v = viewers.create(host, doc);
      await v.ready;
      for (let i = 0; i < 50 && !host.querySelector('.mkv-msg h3'); i++) await new Promise(r => setTimeout(r, 50));
      const msg = host.querySelector('.mkv-msg');
      const out = { title: msg?.querySelector('h3')?.textContent || '', text: msg?.textContent || '', buttons: [...(msg?.querySelectorAll('.mkv-acts button') || [])].map(b => b.textContent), details: !!msg?.querySelector('details:not([open])') };
      v.destroy();
      return out;
    };
    const keepCheck = app.health && app.health.check;
    try {
      // a damaged or missing file: try again or another copy, never "reinstall"
      const a = await card({ id: 'test-djvu-' + Date.now(), kind: 'djvu', ext: 'djvu', title: 'Gone', path: info.userData + sep + 'no-such-file.djvu', view: {} });
      app.assert(/^(Try opening this DjVu file again|Repair Markooj to open DjVu files|Get DjVuLibre to open DjVu files)$/.test(a.title), 'card title: ' + a.title);
      app.assert(a.buttons.length >= 2 && !/missing from this copy|Off for now|helper not found/i.test(a.text), 'buttons and plain words: ' + JSON.stringify(a));
      if (/^Try opening/.test(a.title)) app.assert(a.buttons.includes('Try again') && a.buttons.includes('Choose another file') && a.details, 'file card: ' + JSON.stringify(a));
      // DjVuLibre is not there: the card says how to get it, with buttons that do it
      if (app.health) {
        app.health.check = async () => ({ ok: false, missing: ['ddjvu'], platform: 'win32', packaged: true, tools: { ddjvu: { id: 'ddjvu', ok: false, state: 'missing', path: null, error: 'not found' } } });
        const b = await card({ id: 'test-djvu2-' + Date.now(), kind: 'djvu', ext: 'djvu', title: 'No tools', path: info.userData + sep + 'no-such-file.djvu', missing: 'DjVuLibre', view: {} });
        app.assert(b.title === 'Repair Markooj to open DjVu files', 'remedy title: ' + b.title);
        app.assert(b.buttons.join() === 'Repair Markooj,Get DjVuLibre,Check again', 'remedy buttons: ' + b.buttons);
        app.assert(/To open DjVu files, Markooj needs the free DjVuLibre tools/.test(b.text) && /Everything else works/.test(b.text), 'remedy text: ' + b.text);
      }
    } finally {
      if (app.health) app.health.check = keepCheck;
      host.remove();
    }
  });
  app.tests.register('viewers: PDF text grouping guesses headings and paragraphs', () => {
    const it = (str, y, size, x = 50) => ({ str, x, y, size, w: str.length * size * 0.5, hasEOL: true });
    const md = pdfPagesToMarkdown([[it('Big Title', 700, 24), it('First line of a para-', 660, 10), it('graph that wraps.', 648, 10), it('Second paragraph.', 620, 10), it('3', 40, 10)], [it('Next page text.', 700, 10)]]);
    app.assert(/^# Big Title/m.test(md), 'heading: ' + md);
    app.assert(/First line of a paragraph that wraps\./.test(md), 'joined hyphenated lines: ' + md);
    app.assert(/<div class="page-break"><\/div>/.test(md), 'page break kept');
    app.assert(!/^3$/m.test(md), 'page number dropped');
  });
})();
