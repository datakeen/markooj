// Markooj — the ruler (View → Ruler, like Word) and guide lines (like Adobe Illustrator).
//  • A horizontal ruler above the page and a vertical ruler on its left, in Word, Inline and Read modes (Simple mode has
//    no page). Gray parts are the margins; numbers count from the margin, right to left in a right-to-left document.
//    Markers show the indents of the paragraph with the cursor. Centimeters or inches (automatic: inches in the US).
//  • Guides: drag from the top ruler onto the page for a horizontal guide, from the left ruler for a vertical one.
//    Drag a guide back onto a ruler to remove it, double-click it (or press Enter on it) to type an exact position,
//    arrow keys nudge it. View → Guides lists them; Clear Guides removes them all. Guides are a visual aid only: they
//    never reach the Markdown, prints or exports. They stay with each document for the session, and per file across
//    sessions when "Remember guides" is on.
// The rulers are drawn on canvases at the screen's pixel density, so they stay sharp at every zoom level.
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const settings = app.settings;
  const SIZE = 20; // ruler thickness in px
  const PX = { cm: 96 / 2.54, in: 96 };
  const SUB = { cm: 4, in: 8 }; // ticks per unit: quarter centimeters, eighth inches
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, o) => app.ui?.toast?.(m, o);
  app.windowIcons?.add?.({
    'mkw-ruler': '<rect x="2.5" y="8" width="19" height="8" rx="1.2"/><path d="M6 8v3M9.5 8v2M13 8v3M16.5 8v2M20 8v3"/>',
    'mkw-guides': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18" stroke-dasharray="2.2 1.8"/><path d="M15 3v18" stroke-dasharray="2.2 1.8"/>',
  });

  const R = { on: false, shown: false, guides: new Map(), seq: 0, drag: null, lastGeom: null };
  let host, mid, rulerH, rulerV, corner, cvH, cvV, layer, probe, readout, raf = 0;

  // ---------- units ----------
  function localeUnit() {
    const loc = String(navigator.language || 'en-US');
    return /-(US|LR|MM)\b/i.test(loc) || /^en$/i.test(loc) ? 'in' : 'cm';
  }
  function unit() { const u = settings.get('rulerUnit', 'auto'); return u === 'cm' || u === 'in' ? u : localeUnit(); }
  const unitName = u => (u === 'in' ? 'in' : 'cm');
  const fmt = (cssPx, u = unit()) => { const v = cssPx / PX[u]; return `${(Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '') || '0'} ${unitName(u)}`; };
  /** "2.5", "2,5 cm", "1 in", "30 mm" → CSS px at 100% (null when it is not a number). */
  function parsePos(s, u = unit()) {
    const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*(cm|mm|in|inch|inches|"|px)?\s*$/i.exec(String(s ?? ''));
    if (!m) return null;
    const v = parseFloat(m[1].replace(',', '.'));
    const uu = (m[2] || u).toLowerCase();
    if (uu === 'mm') return v * PX.cm / 10;
    if (uu === 'px') return v;
    if (uu === 'in' || uu === 'inch' || uu === 'inches' || uu === '"') return v * PX.in;
    return v * PX.cm;
  }

  // ---------- DOM ----------
  function build() {
    if (rulerH) return true;
    host = document.getElementById('editorHost'); mid = host?.parentElement;
    if (!host || !mid) return false;
    const mk = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };
    rulerH = mk('mk-ruler mk-ruler-h'); rulerV = mk('mk-ruler mk-ruler-v');
    cvH = document.createElement('canvas'); cvV = document.createElement('canvas');
    rulerH.append(cvH); rulerV.append(cvV);
    rulerH.setAttribute('aria-hidden', 'true'); rulerV.setAttribute('aria-hidden', 'true');
    corner = mk('mk-ruler-corner', 'button'); corner.type = 'button';
    corner.addEventListener('mousedown', e => e.preventDefault());
    corner.addEventListener('click', () => app.commands.run('view.rulerUnitToggle'));
    layer = mk('mk-guides');
    labelChrome();
    probe = mk('mk-ruler-probe');
    readout = mk('mk-guide-readout');
    mid.append(rulerH, rulerV, corner, layer, probe, readout);
    rulerH.addEventListener('pointerdown', e => startNew(e, 'h'));
    rulerV.addEventListener('pointerdown', e => startNew(e, 'v'));
    host.addEventListener('scroll', schedule, { passive: true, capture: true });
    try { new ResizeObserver(schedule).observe(host); } catch {}
    addEventListener('resize', schedule);
    try { matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change', schedule); } catch {}
    return true;
  }

  // ---------- geometry of the page in the first pane ----------
  function primaryPage() {
    if (!host) return null;
    const doc = app.docs.active();
    if (!doc || doc.kind !== 'markdown' || app.mode === 'simple') return null;
    const page = host.querySelector('.mk-word .mk-page, .mk-page');
    return page && page.getClientRects().length ? page : null;
  }
  function geom() {
    const page = primaryPage(); if (!page) return null;
    const doc = app.docs.active();
    const pr = page.getBoundingClientRect(), hr = host.getBoundingClientRect();
    const cs = getComputedStyle(page);
    const n = v => parseFloat(v) || 0;
    let cssW = n(cs.width);
    if (cs.boxSizing !== 'border-box') cssW += n(cs.paddingLeft) + n(cs.paddingRight) + n(cs.borderLeftWidth) + n(cs.borderRightWidth);
    const k = cssW > 0 ? pr.width / cssW : (app.zoom || 100) / 100; // screen px per CSS px of the page (zoom)
    const rtl = cs.direction === 'rtl';
    const paged = !!page.closest('.mk-word') && !document.body.classList.contains('layout-web');
    const ps = paged ? (app.layout?.pageSize?.(doc) || { w: 794, h: 1123 }) : null;
    let mt = n(cs.paddingTop) * k, mb = n(cs.paddingBottom) * k;
    if (paged) { try { const L = app.layout.get(doc); const m = (app.layout.margins || {})[L.margins]; if (m) { mt = m[0] * k; mb = m[0] * k; } } catch {} }
    const pageH = paged ? ps.h * k : pr.height;
    const contentL = pr.left + n(cs.paddingLeft) * k, contentR = pr.right - n(cs.paddingRight) * k;
    return {
      page, doc, pr, hr, k, rtl, paged, pageH, mt, mb, contentL, contentR,
      originX: rtl ? contentR : contentL, dirX: rtl ? -1 : 1,
      viewW: host.clientWidth, viewH: host.clientHeight,
      pageTop: i => pr.top + i * (paged ? pageH : 0),
      pageAt: y => (paged ? Math.max(0, Math.floor((y - pr.top) / pageH)) : 0),
    };
  }

  // ---------- colors (theme variables resolved to real colors for the canvas) ----------
  let colorCache = null;
  function colors() {
    if (colorCache) return colorCache;
    const read = v => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
    colorCache = { bg: read('--mk-r-bg'), paper: read('--mk-r-paper'), margin: read('--mk-r-margin'), tick: read('--mk-r-tick'), text: read('--mk-r-text'), accent: read('--mk-r-accent'), edge: read('--mk-r-edge') };
    return colorCache;
  }
  app.events.on('theme:changed', () => { colorCache = null; });
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { colorCache = null; schedule(); }); } catch {}

  // ---------- drawing ----------
  function schedule() { if (!raf) raf = requestAnimationFrame(draw); }
  function setShown(v) {
    if (R.shown === v) return;
    R.shown = v;
    document.body.classList.toggle('mk-ruler-show', v);
    app.events.emit('ruler:shown', v);
  }
  function sizeCanvas(cv, w, h) {
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    return { g, dpr };
  }
  const crisp = (v, dpr) => (Math.round(v * dpr) + 0.5) / dpr;
  function draw() {
    raf = 0;
    if (!R.on || !build()) { setShown(false); return; }
    const G = geom();
    if (!G) { setShown(false); layer.textContent = ''; return; }
    setShown(true);
    // the margins were just added to the first pane: measure again next frame
    const mr = mid.getBoundingClientRect();
    const x0 = G.hr.left - mr.left, y0 = G.hr.top - mr.top;
    Object.assign(rulerH.style, { left: x0 + 'px', top: (y0 - SIZE) + 'px', width: G.viewW + 'px', height: SIZE + 'px' });
    Object.assign(rulerV.style, { left: (x0 - SIZE) + 'px', top: y0 + 'px', width: SIZE + 'px', height: G.viewH + 'px' });
    Object.assign(corner.style, { left: (x0 - SIZE) + 'px', top: (y0 - SIZE) + 'px', width: SIZE + 'px', height: SIZE + 'px' });
    Object.assign(layer.style, { left: x0 + 'px', top: y0 + 'px', width: G.viewW + 'px', height: G.viewH + 'px' });
    corner.textContent = unitName(unit());
    R.lastGeom = G;
    const c = colors(), u = unit(), unitPx = PX[u] * G.k, sub = SUB[u];
    drawH(G, c, u, unitPx, sub);
    drawV(G, c, u, unitPx, sub);
    drawGuides(G);
  }
  function label(g, text, x, y, color) { g.fillStyle = color; g.fillText(text, x, y); }
  function drawH(G, c, u, unitPx, sub) {
    const w = G.viewW, { g, dpr } = sizeCanvas(cvH, w, SIZE);
    const X = v => v - G.hr.left; // screen x → ruler x
    g.fillStyle = c.bg; g.fillRect(0, 0, w, SIZE);
    const pl = X(G.pr.left), pr = X(G.pr.right), cl = X(G.contentL), cr = X(G.contentR);
    g.fillStyle = c.margin; g.fillRect(pl, 3, pr - pl, SIZE - 6);
    g.fillStyle = c.paper; g.fillRect(cl, 3, cr - cl, SIZE - 6);
    g.strokeStyle = c.edge; g.lineWidth = 1 / dpr; g.strokeRect(crisp(pl, dpr), crisp(3, dpr), Math.round((pr - pl) * dpr) / dpr, SIZE - 7);
    // ticks counted from the margin, outward both ways
    g.strokeStyle = c.tick; g.lineWidth = 1 / dpr;
    g.font = '9px system-ui, "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const o = X(G.originX), step = unitPx / sub;
    const showEvery = unitPx < 22 ? 2 : 1; // very small zoom: fewer numbers
    g.beginPath();
    const nMin = Math.floor((Math.min(pl, pr) - o) / step) - 1, nMax = Math.ceil((Math.max(pl, pr) - o) / step) + 1;
    for (let i = nMin; i <= nMax; i++) {
      const x = o + i * step; // ticks run both ways from the margin; numbers count outward (right to left in RTL)
      if (x < pl - 0.5 || x > pr + 0.5 || x < 0 || x > w) continue;
      const pos = Math.abs(i);
      if (i % sub === 0) {
        if (i === 0) continue;
        const n = pos / sub;
        if (n % showEvery === 0) label(g, String(n), x, SIZE / 2, c.text);
        else { g.moveTo(crisp(x, dpr), 8); g.lineTo(crisp(x, dpr), 12); }
      } else if (i % (sub / 2) === 0) { g.moveTo(crisp(x, dpr), 7); g.lineTo(crisp(x, dpr), 13); }
      else if (unitPx / sub >= 4) { g.moveTo(crisp(x, dpr), 9); g.lineTo(crisp(x, dpr), 11); }
    }
    g.stroke();
    // indent markers of the paragraph with the cursor
    const ind = indents(G);
    if (ind) {
      g.fillStyle = c.paper; g.strokeStyle = c.text; g.lineWidth = 1 / dpr;
      const tri = (x, down) => { g.beginPath(); if (down) { g.moveTo(x - 4.5, 2.5); g.lineTo(x + 4.5, 2.5); g.lineTo(x, 8); } else { g.moveTo(x - 4.5, SIZE - 2.5); g.lineTo(x + 4.5, SIZE - 2.5); g.lineTo(x, SIZE - 8); } g.closePath(); g.fill(); g.stroke(); };
      tri(X(ind.first), true); tri(X(ind.left), false); tri(X(ind.right), false);
    }
  }
  function drawV(G, c, u, unitPx, sub) {
    const h = G.viewH, { g, dpr } = sizeCanvas(cvV, SIZE, h);
    const Y = v => v - G.hr.top;
    g.fillStyle = c.bg; g.fillRect(0, 0, SIZE, h);
    g.font = '9px system-ui, "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const first = G.pageAt(G.hr.top), last = G.paged ? G.pageAt(G.hr.top + h) : 0;
    const step = unitPx / sub;
    for (let p = first; p <= last; p++) {
      const top = Y(G.pageTop(p)), bottom = G.paged ? top + G.pageH : Y(G.pr.bottom);
      g.fillStyle = c.margin; g.fillRect(3, top, SIZE - 6, bottom - top);
      g.fillStyle = c.paper; g.fillRect(3, top + G.mt, SIZE - 6, Math.max(0, bottom - top - G.mt - (G.paged ? G.mb : G.mb)));
      g.strokeStyle = c.edge; g.lineWidth = 1 / dpr; g.strokeRect(crisp(3, dpr), crisp(top, dpr), SIZE - 7, Math.round((bottom - top) * dpr) / dpr);
      const o = top + G.mt;
      g.strokeStyle = c.tick; g.beginPath();
      const nMin = Math.floor((top - o) / step) - 1, nMax = Math.ceil((bottom - o) / step) + 1;
      for (let i = nMin; i <= nMax; i++) {
        const y = o + i * step;
        if (y < top - 0.5 || y > bottom + 0.5 || y < -10 || y > h + 10) continue;
        if (i % sub === 0) { if (i !== 0) label(g, String(Math.abs(i) / sub), SIZE / 2, y, c.text); }
        else if (i % (sub / 2) === 0) { g.moveTo(7, crisp(y, dpr)); g.lineTo(13, crisp(y, dpr)); }
        else if (step >= 4) { g.moveTo(9, crisp(y, dpr)); g.lineTo(11, crisp(y, dpr)); }
      }
      g.stroke();
    }
  }
  /** Left, first-line and right indent (screen x) of the paragraph with the cursor in the first pane. */
  function indents(G) {
    const s = getSelection(); if (!s || !s.rangeCount) return null;
    const n = s.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement);
    if (!el || !G.page.contains(el)) return null;
    const b = el.closest('p,li,h1,h2,h3,h4,h5,h6,blockquote,pre,dd,dt,td,th'); if (!b || !G.page.contains(b)) return null;
    const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
    const pad = (parseFloat(G.rtl ? cs.paddingRight : cs.paddingLeft) || 0) * G.k;
    const left = G.rtl ? r.right - pad : r.left + pad;
    const ti = (parseFloat(cs.textIndent) || 0) * G.k;
    return { left, first: left + G.dirX * ti, right: G.rtl ? r.left : r.right };
  }

  // ---------- guides ----------
  // tips and names of the rulers, in the interface language (again after every language switch)
  function labelChrome() {
    if (!rulerH) return;
    rulerH.dataset.tip = app.t('Ruler'); rulerH.dataset.tipD = app.t('Drag from here onto the page to add a horizontal guide. Gray parts are the margins.');
    rulerV.dataset.tip = app.t('Ruler'); rulerV.dataset.tipD = app.t('Drag from here onto the page to add a vertical guide.');
    corner.dataset.tip = app.t('Ruler units'); corner.dataset.tipD = app.t('Switch the rulers between centimeters and inches. View → Guides lists your guide lines.');
    corner.setAttribute('aria-label', app.t('Ruler units'));
    layer.setAttribute('aria-label', app.t('Guides'));
  }
  app.events.on('i18n:changed', () => { try { labelChrome(); schedule(); } catch (e) { console.error('ruler: i18n', e); } });
  function list(doc = app.docs.active()) {
    if (!doc) return [];
    if (!R.guides.has(doc.id)) R.guides.set(doc.id, loadSaved(doc));
    return R.guides.get(doc.id);
  }
  function screenOf(G, gd) {
    if (gd.axis === 'v') return G.originX + G.dirX * gd.pos * G.k;
    return G.pageTop(gd.page || 0) + G.mt + gd.pos * G.k;
  }
  /** Screen point → guide data (page and position from the margin, in CSS px at 100%). */
  function fromScreen(G, axis, v) {
    if (axis === 'v') return { pos: (v - G.originX) * G.dirX / G.k, page: 0 };
    const page = G.pageAt(v);
    return { page, pos: (v - G.pageTop(page) - G.mt) / G.k };
  }
  function describe(gd, u = unit()) {
    const v = { distance: fmt(gd.pos, u), page: (gd.page || 0) + 1 };
    if (gd.axis === 'v') return R.lastGeom?.rtl ? app.t('Vertical guide, {distance} from the right margin', v) : app.t('Vertical guide, {distance} from the left margin', v);
    return R.lastGeom?.paged ? app.t('Horizontal guide, {distance} from the top margin of page {page}', v) : app.t('Horizontal guide, {distance} from the top margin', v);
  }
  function drawGuides(G) {
    const gs = list(G.doc);
    const have = new Map([...layer.children].map(e => [e.dataset.id, e]));
    for (const gd of gs) {
      let el = have.get(String(gd.id)); have.delete(String(gd.id));
      if (!el) el = makeGuideEl(gd);
      const s = screenOf(G, gd);
      if (gd.axis === 'v') { el.style.left = (s - G.hr.left) + 'px'; el.style.top = '0'; }
      else { el.style.top = (s - G.hr.top) + 'px'; el.style.left = '0'; }
      const out = gd.axis === 'v' ? s < G.hr.left - 4 || s > G.hr.left + G.viewW + 4 : s < G.hr.top - 4 || s > G.hr.top + G.viewH + 4;
      el.hidden = out;
      el.setAttribute('aria-valuetext', describe(gd));
      el.setAttribute('aria-label', describe(gd));
      el.dataset.tip = gd.axis === 'v' ? app.t('Vertical guide') : app.t('Horizontal guide');
      el.dataset.tipD = app.t('{distance} from the margin. Drag it back onto a ruler to remove it, double-click it to type a position.', { distance: fmt(gd.pos) });
    }
    for (const el of have.values()) if (!el.classList.contains('temp')) el.remove();
  }
  function makeGuideEl(gd) {
    const el = document.createElement('div');
    el.className = 'mk-guide ' + gd.axis;
    el.dataset.id = String(gd.id);
    el.tabIndex = 0; el.setAttribute('role', 'slider');
    el.innerHTML = '<span class="mk-guide-line"></span>';
    el.addEventListener('pointerdown', e => startMove(e, gd));
    el.addEventListener('dblclick', e => { e.preventDefault(); editGuide(gd); });
    el.addEventListener('keydown', e => onGuideKey(e, gd));
    layer.append(el);
    return el;
  }
  function onGuideKey(e, gd) {
    const step = PX[unit()] / (e.shiftKey ? 1 : SUB[unit()]);
    const along = gd.axis === 'v' ? { ArrowLeft: -1, ArrowRight: 1 } : { ArrowUp: -1, ArrowDown: 1 };
    if (e.key in along) { e.preventDefault(); const d = along[e.key] * (gd.axis === 'v' && R.lastGeom?.rtl ? -1 : 1); setGuide(gd, { pos: gd.pos + d * step }); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeGuide(gd); return; }
    if (e.key === 'Enter') { e.preventDefault(); editGuide(gd); return; }
    if (e.key === 'Escape') { e.preventDefault(); app.editors.active()?.focus?.(); }
  }
  function addGuide(axis, pos, page = 0, doc = app.docs.active()) {
    if (!doc || doc.kind !== 'markdown' || !Number.isFinite(pos)) return null;
    const gd = { id: ++R.seq, axis: axis === 'v' ? 'v' : 'h', pos: Math.round(pos * 100) / 100, page: axis === 'v' ? 0 : Math.max(0, page | 0) };
    list(doc).push(gd); changed(doc);
    return gd;
  }
  function setGuide(gd, patch) {
    Object.assign(gd, patch); gd.pos = Math.round(gd.pos * 100) / 100;
    changed(app.docs.active());
  }
  function removeGuide(gd, doc = app.docs.active()) {
    const gs = list(doc); const i = gs.indexOf(gd); if (i < 0) return false;
    gs.splice(i, 1);
    layer?.querySelector(`.mk-guide[data-id="${gd.id}"]`)?.remove();
    changed(doc);
    return true;
  }
  function clearGuides(doc = app.docs.active()) {
    const gs = list(doc); const n = gs.length;
    gs.splice(0); if (layer) layer.textContent = '';
    changed(doc);
    return n;
  }
  function changed(doc) {
    schedule();
    app.events.emit('ruler:guides', { doc, guides: list(doc) });
    if (doc?.path && settings.get('rulerGuidesPerFile', false) === true) saveSoon(doc);
  }
  // remembered per file (setting rulerGuides: {path: [{axis, pos, page}]}, the 100 newest files)
  const keyOf = doc => String(doc.path || '').replace(/\\/g, '/').toLowerCase();
  function loadSaved(doc) {
    if (!doc?.path || settings.get('rulerGuidesPerFile', false) !== true) return [];
    const all = settings.get('rulerGuides', {}) || {};
    return (all[keyOf(doc)] || []).filter(g => g && (g.axis === 'v' || g.axis === 'h') && Number.isFinite(g.pos)).map(g => ({ id: ++R.seq, axis: g.axis, pos: g.pos, page: g.page | 0 }));
  }
  const saveSoon = app.debounce(doc => {
    const all = { ...(settings.get('rulerGuides', {}) || {}) };
    const k = keyOf(doc); delete all[k];
    const gs = list(doc).map(g => ({ axis: g.axis, pos: g.pos, page: g.page | 0 }));
    if (gs.length) all[k] = gs;
    const keys = Object.keys(all); for (const x of keys.slice(0, Math.max(0, keys.length - 100))) delete all[x];
    settings.set('rulerGuides', all);
  }, 600);

  // ---------- dragging ----------
  function snap(G, axis, v, e) {
    if (!e.shiftKey) return v;
    const step = PX[unit()] * G.k / SUB[unit()];
    if (axis === 'v') return G.originX + Math.round((v - G.originX) / step) * step;
    const p = G.pageAt(v), o = G.pageTop(p) + G.mt;
    return o + Math.round((v - o) / step) * step;
  }
  function showReadout(G, axis, v, x, y) {
    const d = fromScreen(G, axis, v);
    const mr = mid.getBoundingClientRect();
    readout.textContent = fmt(d.pos);
    readout.style.left = (x - mr.left + 12) + 'px'; readout.style.top = (y - mr.top + 14) + 'px';
    readout.classList.add('show');
  }
  const hideReadout = () => readout?.classList.remove('show');
  function inView(G, x, y) { return x >= G.hr.left && x <= G.hr.left + G.viewW && y >= G.hr.top && y <= G.hr.top + G.viewH; }
  function track(e, onMove, onUp) {
    const mv = ev => onMove(ev), up = ev => { removeEventListener('pointermove', mv, true); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true); document.body.classList.remove('mk-guide-dragging'); onUp(ev); };
    addEventListener('pointermove', mv, true); addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
    document.body.classList.add('mk-guide-dragging');
  }
  function startNew(e, axis) {
    if (e.button !== 0) return;
    const G = geom(); if (!G) return;
    e.preventDefault();
    // the horizontal ruler makes horizontal guides, the vertical ruler vertical ones (like Illustrator)
    const temp = document.createElement('div'); temp.className = 'mk-guide temp ' + axis; temp.innerHTML = '<span class="mk-guide-line"></span>'; temp.hidden = true;
    layer.append(temp);
    track(e, ev => {
      const v = snap(G, axis, axis === 'v' ? ev.clientX : ev.clientY, ev);
      temp.hidden = !inView(G, ev.clientX, ev.clientY);
      if (axis === 'v') temp.style.left = (v - G.hr.left) + 'px'; else temp.style.top = (v - G.hr.top) + 'px';
      showReadout(G, axis, v, ev.clientX, ev.clientY);
    }, ev => {
      temp.remove(); hideReadout();
      if (!inView(G, ev.clientX, ev.clientY)) return; // let go on a ruler: no guide
      const v = snap(G, axis, axis === 'v' ? ev.clientX : ev.clientY, ev);
      const d = fromScreen(G, axis, v);
      addGuide(axis, d.pos, d.page);
    });
  }
  function startMove(e, gd) {
    if (e.button !== 0) return;
    const G = geom(); if (!G) return;
    e.preventDefault(); e.stopPropagation();
    const el = layer.querySelector(`.mk-guide[data-id="${gd.id}"]`);
    el?.classList.add('drag'); el?.focus({ preventScroll: true });
    track(e, ev => {
      const v = snap(G, gd.axis, gd.axis === 'v' ? ev.clientX : ev.clientY, ev);
      if (el) { if (gd.axis === 'v') el.style.left = (v - G.hr.left) + 'px'; else el.style.top = (v - G.hr.top) + 'px'; el.classList.toggle('del', !inView(G, ev.clientX, ev.clientY)); }
      showReadout(G, gd.axis, v, ev.clientX, ev.clientY);
    }, ev => {
      hideReadout(); el?.classList.remove('drag', 'del');
      // dragged back onto a ruler (or out of the page area): the guide goes away
      if (!inView(G, ev.clientX, ev.clientY)) { removeGuide(gd); return; }
      const v = snap(G, gd.axis, gd.axis === 'v' ? ev.clientX : ev.clientY, ev);
      setGuide(gd, fromScreen(G, gd.axis, v));
    });
  }

  // ---------- dialogs (the keyboard path) ----------
  async function editGuide(gd) {
    const u = unit();
    const body = document.createElement('div');
    const pv = { unit: unitName(u), page: (gd.page || 0) + 1 };
    const where = gd.axis === 'v' ? (R.lastGeom?.rtl ? app.th('Position ({unit}) from the right margin', pv) : app.th('Position ({unit}) from the left margin', pv))
      : R.lastGeom?.paged ? app.th('Position ({unit}) from the top margin of page {page}', pv) : app.th('Position ({unit}) from the top margin', pv);
    body.innerHTML = `<label class="field"><span>${where}</span><input class="txt" type="text" inputmode="decimal" spellcheck="false"></label><p class="mk-guide-err" hidden>${app.th('Type a number, for example 2.5 or 1 in.')}</p>`;
    const inp = body.querySelector('input'); inp.value = (gd.pos / PX[u]).toFixed(2).replace(/\.?0+$/, '') || '0';
    const v = await app.ui.dialog({ title: gd.axis === 'v' ? app.t('Vertical guide') : app.t('Horizontal guide'), icon: 'mkw-guides', body,
      buttons: [{ label: app.t('Remove guide'), value: 'remove', danger: true, left: true }, { label: app.t('Cancel'), value: null }, { label: app.t('OK'), primary: true, value: () => inp.value, validate: () => { const ok = parsePos(inp.value, u) != null; body.querySelector('.mk-guide-err').hidden = ok; return ok; } }] });
    if (v === 'remove') return removeGuide(gd);
    if (v == null) return false;
    setGuide(gd, { pos: parsePos(v, u) });
    return true;
  }
  async function addGuideDialog(args = {}) {
    if (!R.on) setOn(true);
    await new Promise(r => requestAnimationFrame(r));
    if (!geom()) { toast(app.t('Switch to Word, Inline or Read mode to use guides. Simple mode has no page to measure.'), { kind: 'info', actions: [{ label: app.t('Word mode'), run: () => app.setMode('word') }] }); return null; }
    if (args.axis && args.pos != null) { const p = typeof args.pos === 'number' ? args.pos : parsePos(args.pos); return p == null ? null : addGuide(args.axis, p, args.page | 0); }
    const u = unit();
    const body = document.createElement('div');
    body.innerHTML = `<div class="mk-guide-axis" role="radiogroup" aria-label="${app.th('Direction')}"><label><input type="radio" name="mkga" value="v" checked> ${R.lastGeom?.rtl ? app.th('Vertical (from the right margin)') : app.th('Vertical (from the left margin)')}</label><label><input type="radio" name="mkga" value="h"> ${app.th('Horizontal (from the top margin)')}</label></div>
      <label class="field"><span>${app.th('Position ({unit})', { unit: unitName(u) })}</span><input class="txt mk-gpos" type="text" inputmode="decimal" spellcheck="false" value="2"></label><p class="mk-guide-err" hidden>${app.th('Type a number, for example 2.5 or 1 in.')}</p>`;
    const v = await app.ui.dialog({ title: app.t('Add a guide'), icon: 'mkw-guides', body,
      buttons: [{ label: app.t('Cancel'), value: null }, { label: app.t('Add guide'), primary: true, value: el => ({ axis: el.querySelector('input[name=mkga]:checked').value, pos: el.querySelector('.mk-gpos').value }), validate: el => { const ok = parsePos(el.querySelector('.mk-gpos').value, u) != null; el.querySelector('.mk-guide-err').hidden = ok; return ok; } }] });
    if (!v) return null;
    let page = 0;
    if (v.axis === 'h' && R.lastGeom?.paged) page = R.lastGeom.pageAt(R.lastGeom.hr.top + 1);
    return addGuide(v.axis, parsePos(v.pos, u), page);
  }
  async function guidesDialog() {
    if (!R.on) setOn(true);
    const body = document.createElement('div'); body.className = 'mk-guide-list';
    const paint = () => {
      body.innerHTML = '';
      const gs = list();
      if (!gs.length) { const p = document.createElement('p'); p.textContent = app.t('No guides yet. Drag from a ruler onto the page, or click Add guide.'); body.append(p); return; }
      for (const gd of gs) {
        const row = document.createElement('div'); row.className = 'mk-guide-row';
        row.innerHTML = `<span>${esc(describe(gd))}</span>`;
        const ed = document.createElement('button'); ed.type = 'button'; ed.className = 'btn'; ed.textContent = app.t('Change…');
        ed.addEventListener('click', async () => { await editGuide(gd); paint(); });
        const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'btn'; rm.textContent = app.t('Remove');
        rm.addEventListener('click', () => { removeGuide(gd); paint(); });
        row.append(ed, rm); body.append(row);
      }
    };
    paint();
    const v = await app.ui.dialog({ title: app.t('Guides'), icon: 'mkw-guides', body, buttons: [{ label: app.t('Clear guides'), value: 'clear', danger: true, left: true }, { label: app.t('Add guide…'), value: 'add' }, { label: app.t('Done'), value: null, primary: true }] });
    if (v === 'clear') clearGuides();
    else if (v === 'add') { await addGuideDialog(); return guidesDialog(); }
    return list().length;
  }

  // ---------- on / off ----------
  function setOn(v) {
    R.on = !!v;
    if (R.on) build();
    if (settings.get('ruler', false) !== R.on) settings.set('ruler', R.on);
    document.body.classList.toggle('mk-ruler-on', R.on);
    if (!R.on) { setShown(false); if (layer) layer.textContent = ''; }
    schedule();
    app.events.emit('ruler:changed', R.on);
    return R.on;
  }
  ['zoom:changed', 'mode:shown', 'mode:changed', 'editor:mounted', 'editor:rendered', 'layout:changed', 'theme:changed', 'doc:active', 'split:layout', 'focus:changed', 'ribbon:display'].forEach(ev => app.events.on(ev, schedule));
  app.events.on('selection:changed', () => { if (R.on) schedule(); });
  document.addEventListener('selectionchange', () => { if (R.on && R.shown) schedule(); });
  app.events.on('doc:closed', d => { if (d) R.guides.delete(d.id); });
  app.events.on('doc:saved', d => { if (d && R.guides.get(d.id)?.length && settings.get('rulerGuidesPerFile', false) === true) saveSoon(d); });
  app.events.on('settings:changed', ({ key } = {}) => {
    if (key === 'ruler' && !!settings.get('ruler', false) !== R.on) setOn(!!settings.get('ruler', false));
    if (key === 'rulerUnit') schedule();
  });
  app.events.on('ready', () => { if (settings.get('ruler', false) === true) setOn(true); });

  const C = (id, def) => app.commands.register(id, { category: 'View', ...def });
  const noPage = () => (R.on && !R.shown ? app.t('Switch to Word, Inline or Read mode: Simple mode has no page for the ruler.') : '');
  C('view.ruler', { label: app.tm('Ruler'), icon: 'mkw-ruler', description: app.tm('Show rulers above and beside the page, like Word, in centimeters or inches. Drag from a ruler onto the page to add a guide line.'), isActive: () => R.on, run: () => setOn(!R.on) });
  C('view.guides', { label: app.tm('Guides…'), icon: 'mkw-guides', description: app.tm('See, change and remove the guide lines on the page. Guides help you line things up; they never print or export.'), run: guidesDialog });
  C('view.addGuide', { label: app.tm('Add a guide…'), icon: 'mkw-guides', description: app.tm('Add a vertical or horizontal guide line at an exact distance from the margin.'), run: a => addGuideDialog(a || {}) });
  C('view.clearGuides', { label: app.tm('Clear guides'), icon: 'mkw-guides', description: app.tm('Remove every guide line from this document.'), why: () => (list().length ? '' : app.t('This document has no guides yet.')), isEnabled: () => list().length > 0, run: () => { const n = clearGuides(); if (n && !app.tests?.current) toast(app.tn('Removed {count} guides.', n), { kind: 'info' }); return n; } });
  C('view.rulerUnits', { label: app.tm('Ruler units'), icon: 'mkw-ruler', palette: false, description: app.tm('Measure the rulers in centimeters or inches, or choose automatically from your region.'), run: a => { const v = (a && a.value) || a; settings.set('rulerUnit', v === 'cm' || v === 'in' ? v : 'auto'); schedule(); } });
  C('view.rulerUnitToggle', { label: app.tm('Ruler units: centimeters or inches'), icon: 'mkw-ruler', description: app.tm('Switch the rulers between centimeters and inches.'), run: () => { settings.set('rulerUnit', unit() === 'cm' ? 'in' : 'cm'); schedule(); return unit(); } });
  void noPage;

  function renderOptions(el) {
    const sh = app.shell || {};
    const r = document.createElement('div'); r.className = 'opt-row';
    r.innerHTML = `<div class="ol"><b>${app.th('Ruler units')}</b><small>${app.th('Automatic uses inches in the United States and centimeters everywhere else. The small button where the rulers meet switches too.')}</small></div>`;
    const c = document.createElement('div'); c.className = 'oc';
    if (sh.makeSeg) c.append(sh.makeSeg([{ value: 'auto', label: app.t('Automatic ({unit})', { unit: unitName(localeUnit()) }) }, { value: 'cm', label: app.t('Centimeters') }, { value: 'in', label: app.t('Inches') }], settings.get('rulerUnit', 'auto'), v => app.commands.run('view.rulerUnits', { value: v }), { small: true }));
    r.append(c); el.append(r);
    if (sh.settingSwitch) {
      el.append(sh.settingSwitch('ruler', false, app.t('Show the ruler'), app.t('Rulers above and beside the page in Word, Inline and Read modes. View → Ruler does the same.')));
      el.append(sh.settingSwitch('rulerGuidesPerFile', false, app.t('Remember guides for each file'), app.t('Off: guides last until you close the document. On: Markooj keeps them with the file name in its settings, never in the file.')));
    }
  }

  app.ruler = { setOn, get on() { return R.on; }, get shown() { return R.shown; }, geom, unit, localeUnit, parsePos, fmt, list, addGuide, setGuide, removeGuide, clearGuides, editGuide, guidesDialog, addGuideDialog, renderOptions, redraw: () => { if (raf) cancelAnimationFrame(raf); raf = 0; draw(); }, screenOf, fromScreen, indents, PX, state: R };

  // ---------- smoke tests ----------
  const A = app.assert;
  const shot = async name => { try { await app.mk.invoke('smoke-shot', name); } catch {} };
  const until = async (fn, ms = 4000, what = 'condition') => { const t0 = Date.now(); for (;;) { let v; try { v = await fn(); } catch { v = false; } if (v) return v; if (Date.now() - t0 > ms) throw new Error('Timed out waiting for ' + what); await sleep(40); } };
  const frames = (n = 2) => new Promise(res => { const f = () => (--n <= 0 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const SAMPLE = '# Ruler test\n\nA paragraph to measure. '.repeat(1) + 'Words '.repeat(120) + '\n\n## Second\n\n' + 'More words. '.repeat(200) + '\n';
  async function withDoc(text, fn, mode = 'word') {
    const m0 = app.mode, on0 = R.on, z0 = app.zoom, u0 = settings.get('rulerUnit', 'auto');
    const d = app.docs.create({ title: 'Ruler test', text });
    try {
      app.setMode(mode);
      await until(() => host?.querySelector?.('.mk-page [data-line]') || document.querySelector('#editorHost .mk-page [data-line]'), 5000, 'the page to render');
      return await fn(d);
    } finally { setOn(on0); settings.set('rulerUnit', u0); app.setZoom?.(z0, { silent: true }); app.setMode(m0); await app.docs.close(d.id, { force: true }); }
  }
  const inked = cv => { const g = cv.getContext('2d'); const { data } = g.getImageData(0, 0, cv.width, cv.height); let set = new Set(); for (let i = 0; i < data.length; i += 16) set.add(data[i] + ',' + data[i + 1] + ',' + data[i + 2]); return set.size; };
  app.tests.register('ruler: View → Ruler shows sharp rulers in Word mode, hides in Simple, and is remembered', () => withDoc(SAMPLE, async () => {
    setOn(false); await frames();
    A(!R.shown && !document.body.classList.contains('mk-ruler-show'), 'off');
    await app.commands.run('view.ruler');
    await frames(3);
    A(R.on && R.shown && settings.get('ruler') === true, 'on, shown and saved in settings');
    const G = geom(); A(G && G.k > 0, 'page measured');
    A(rulerH.getBoundingClientRect().bottom <= host.getBoundingClientRect().top + 1, 'the ruler sits above the page area, not over it');
    A(cvH.width === Math.round(G.viewW * (devicePixelRatio || 1)), 'canvas drawn at the screen’s pixel density');
    A(inked(cvH) > 3 && inked(cvV) > 3, 'both rulers have marks');
    // margins: the zero of the ruler is the left margin
    A(Math.abs(G.originX - G.contentL) < 1, 'zero at the left margin');
    // zoom keeps the scale: one centimeter on the ruler is one centimeter of the page
    app.setZoom(150); await frames(3);
    const G2 = geom(); A(Math.abs(G2.k - 1.5) < 0.02, 'page scale follows zoom: ' + G2.k);
    app.setZoom(100); await frames(2);
    settings.set('rulerUnit', 'in'); await frames(2); A(unit() === 'in' && corner.textContent === 'in', 'inches');
    settings.set('rulerUnit', 'cm'); await frames(2); A(unit() === 'cm' && corner.textContent === 'cm', 'centimeters');
    A(['cm', 'in'].includes(localeUnit()), 'automatic unit from the locale');
    A(Math.abs(parsePos('2,54 cm') - 96) < 0.01 && parsePos('1 in') === 96 && parsePos('25.4 mm') - 96 < 0.01 && parsePos('abc') === null, 'positions typed in any unit');
    app.setMode('simple'); await until(() => !R.shown, 3000, 'the ruler to hide in Simple mode');
    app.setMode('read'); await until(() => R.shown, 3000, 'the ruler in Read mode');
    await app.commands.run('view.ruler'); await frames(2);
    A(!R.on && !R.shown && settings.get('ruler') === false, 'off again');
  }));
  app.tests.register('ruler: drag from a ruler makes a guide, dragging it back removes it', () => withDoc(SAMPLE, async () => {
    setOn(true); clearGuides(); await frames(3);
    const G = geom(); A(G, 'page measured');
    const pe = (type, x, y, target = window) => target.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, pointerId: 1, isPrimary: true }));
    // horizontal guide from the top ruler
    const hr = rulerH.getBoundingClientRect();
    const gy = G.hr.top + 160, gx = G.hr.left + 300;
    pe('pointerdown', hr.left + 300, hr.top + 10, rulerH); pe('pointermove', gx, G.hr.top + 60); pe('pointermove', gx, gy); pe('pointerup', gx, gy);
    let gs = list(); A(gs.length === 1 && gs[0].axis === 'h', 'one horizontal guide');
    // the guide's page position is the drop point (measured at once: in a long run the page may still scroll a little afterwards)
    const atDrop = screenOf(geom(), gs[0]); A(Math.abs(atDrop - gy) < 2, `guide stored where it was dropped (${atDrop.toFixed(1)} / ${gy.toFixed(1)})`);
    await frames(2);
    const el = layer.querySelector('.mk-guide.h'); A(el && !el.hidden, 'guide on the page');
    const mid1 = r => r.top + r.height / 2, midX = r => r.left + r.width / 2;
    // …and the line is drawn on that spot of the page, wherever the page is now
    const want = screenOf(geom(), gs[0]), got = mid1(el.getBoundingClientRect());
    A(Math.abs(got - want) < 2, `guide drawn where it was dropped (${got.toFixed(1)} / ${want.toFixed(1)}, drop ${gy.toFixed(1)}, moved ${(want - atDrop).toFixed(1)})`);
    // vertical guide from the left ruler
    const vr = rulerV.getBoundingClientRect();
    pe('pointerdown', vr.left + 10, vr.top + 200, rulerV); pe('pointermove', G.hr.left + 250, vr.top + 200); pe('pointerup', G.hr.left + 250, vr.top + 200);
    gs = list(); A(gs.length === 2 && gs.some(g => g.axis === 'v'), 'and a vertical one');
    await frames(2);
    // the guide stays on the same spot of the page at another zoom
    const v = gs.find(g => g.axis === 'v'); const pos0 = v.pos;
    app.setZoom(150); await frames(3);
    const vel = layer.querySelector('.mk-guide.v');
    const at = () => layer.getBoundingClientRect().left + parseFloat(vel.style.left); // also when zoomed out of view
    await until(() => { const G2 = geom(); return G2 && Math.abs(G2.k - 1.5) < 0.02 && Math.abs(at() - screenOf(G2, v)) < 2; }, 2000, 'the guide to follow the zoom');
    const G2 = geom();
    A(v.pos === pos0 && Math.abs(screenOf(G2, v) - G2.originX - pos0 * G2.k) < 0.5, `guide keeps its place on the page when zooming (${at().toFixed(1)} / ${screenOf(G2, v).toFixed(1)})`);
    app.setZoom(100); await frames(3);
    await shot('ruler');
    // let go on the ruler: no guide
    pe('pointerdown', hr.left + 200, hr.top + 10, rulerH); pe('pointermove', hr.left + 200, hr.top + 12); pe('pointerup', hr.left + 200, hr.top + 12);
    A(list().length === 2, 'releasing on the ruler adds nothing');
    // drag the horizontal guide back onto its ruler
    const he = layer.querySelector('.mk-guide.h'); const hb = he.getBoundingClientRect();
    pe('pointerdown', hb.left + 100, hb.top + hb.height / 2, he); pe('pointermove', hb.left + 100, G.hr.top + 20); pe('pointermove', hb.left + 100, hr.top + 8); pe('pointerup', hb.left + 100, hr.top + 8);
    gs = list(); A(gs.length === 1 && gs[0].axis === 'v', 'dragged back onto the ruler: removed');
    // keyboard: nudge, remove
    const ve = layer.querySelector('.mk-guide.v'); const p1 = gs[0].pos;
    ve.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    A(gs[0].pos > p1, 'arrow key nudges the guide');
    ve.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    A(list().length === 0, 'Delete removes it');
    addGuide('v', 96); addGuide('h', 40);
    A(await app.commands.run('view.clearGuides') === 2 && !list().length, 'Clear guides removes them all');
    addGuide('v', 120);
    A(document.querySelector('#editorHost .mk-page')?.textContent.indexOf('guide') === -1, 'guides never enter the page');
    clearGuides();
  }));
  app.tests.register('ruler: dark theme and a right-to-left document', () => withDoc('---\nlang: ur\ndir: rtl\n---\n\n# عنوان\n\nیہ ایک پیراگراف ہے۔ '.repeat(1) + 'لفظ '.repeat(150) + '\n', async () => {
    setOn(true); clearGuides(); await frames(3);
    await until(() => geom()?.rtl, 4000, 'the page to be right to left');
    const G = geom();
    A(Math.abs(G.originX - G.contentR) < 1 && G.dirX === -1, 'zero at the right margin, counting to the left');
    const gd = addGuide('v', PX.cm * 2); await frames(2);
    const el = layer.querySelector('.mk-guide.v'); const G3 = geom();
    const at = layer.getBoundingClientRect().left + parseFloat(el.style.left);
    A(Math.abs(at - (G3.contentR - PX.cm * 2 * G3.k)) < 2, `a 2 cm guide sits 2 cm left of the right margin (${at.toFixed(1)} / ${(G3.contentR - PX.cm * 2 * G3.k).toFixed(1)}, before ${(G.contentR - PX.cm * 2 * G.k).toFixed(1)}, hidden ${el.hidden})`);
    const t0 = settings.get('theme', 'system');
    try {
      await app.commands.run('view.setTheme', 'dark'); await frames(3);
      const c = colors(); A(c.bg !== c.paper, 'dark ruler colors');
      await shot('ruler-dark-rtl');
    } finally { await app.commands.run('view.setTheme', t0); }
    removeGuide(gd);
  }));
})();
