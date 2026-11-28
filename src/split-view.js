// Markooj — Split and View Side by Side (View → Window), like Word but with more choice:
//  • Split (Ctrl+Alt+S): a second pane shows the SAME document. Each pane has its own editing mode (Word on the left,
//    Simple on the right, for example) and scrolls on its own. There is one document model: the second pane's editor
//    gets a thin stand-in for the document that hands every change to the real one, so both panes always show the
//    same text and there are never two copies to reconcile.
//  • View Side by Side: the second pane shows another open document, with a Swap button.
//  • Synchronous Scrolling: "same place in the text" (the same Markdown line, or the same heading for two documents)
//    or "same distance from the top".
// Side by side or stacked; drag the divider (double-click or Enter: 50/50, arrow keys move it, Esc closes the split).
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const E = app.editor || {};
  const settings = app.settings;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const raf = f => requestAnimationFrame(f);
  const toast = (m, o) => app.ui?.toast?.(m, o);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FACTORY = { word: 'createWord', inline: 'createInline', simple: 'createSimple', read: 'createRead' };
  const MODE_LABEL = { word: 'Word', inline: 'Inline', simple: 'Simple', read: 'Read' }; // English: also part of command ids
  // the mode names people see, in the interface language (the keys are shell's mode names)
  const MODE_NAME = { word: 'Word', inline: app.tm('Inline@@editing mode'), simple: app.tm('Simple@@editing mode'), read: app.tm('Read@@editing mode') };
  const modeName = m => app.t(MODE_NAME[m] || '');
  const MODES = ['word', 'inline', 'simple', 'read'];

  // ---------- icons (one small sprite shared with ruler.js) ----------
  const ICONS = {
    'mkw-newwin': '<rect x="3" y="6" width="13" height="12" rx="1.5"/><path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3H19.5A1.5 1.5 0 0 1 21 4.5V13.5A1.5 1.5 0 0 1 19.5 15H16"/><path d="M3 9.5h13"/>',
    'mkw-arrange': '<rect x="3" y="4" width="8" height="16" rx="1.5"/><rect x="13" y="4" width="8" height="16" rx="1.5"/><path d="M3 7.5h8M13 7.5h8"/>',
    'mkw-split': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 12h18" stroke-dasharray="2 2"/><path d="M7 8h7M7 16h9"/>',
    'mkw-side': '<rect x="2.5" y="5" width="8.5" height="14" rx="1.2"/><rect x="13" y="5" width="8.5" height="14" rx="1.2"/><path d="M5 9h4M5 12h3.5M15.5 9h4M15.5 12h3"/>',
    'mkw-sync': '<rect x="2.5" y="4" width="7" height="16" rx="1.2"/><rect x="14.5" y="4" width="7" height="16" rx="1.2"/><path d="M12 8v8M10.5 9.5 12 8l1.5 1.5M10.5 14.5 12 16l1.5-1.5"/>',
    'mkw-reset': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/><path d="M7 12h3M8.5 10.5 10 12l-1.5 1.5M17 12h-3M15.5 10.5 14 12l1.5 1.5"/>',
    'mkw-switch': '<rect x="7" y="3" width="14" height="11" rx="1.5"/><path d="M4 7v12a1.5 1.5 0 0 0 1.5 1.5H17"/><path d="M10 7h8"/>',
    'mkw-stack': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 12h18"/>',
    'mkw-cols': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
    'mkw-swap': '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
    'mkw-close': '<path d="M6 6l12 12M18 6 6 18"/>',
    'mkw-save': '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    'mkw-ruler': '<rect x="2.5" y="8" width="19" height="8" rx="1.2"/><path d="M6 8v3M9.5 8v2M13 8v3M16.5 8v2M20 8v3"/>',
    'mkw-guides': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18" stroke-dasharray="2.2 1.8"/><path d="M15 3v18" stroke-dasharray="2.2 1.8"/>',
  };
  function addIcons(map) {
    let svg = document.getElementById('mkw-icons');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'mkw-icons'; svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      document.body.prepend(svg);
    }
    for (const [id, body] of Object.entries(map)) {
      if (document.getElementById(id)) continue;
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
      s.id = id; s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = body; svg.append(s);
    }
  }
  addIcons(ICONS);
  app.windowIcons = { add: addIcons };
  const icon = name => `<svg class="i"><use href="#${name}"/></svg>`;

  // ---------- state ----------
  const st = {
    on: false, kind: null, docId: null, mode: null, ad: null, px: null, realDoc: null, focus2: false, inPaneSet: 0,
    sync: false, mute: { 1: 0, 2: 0 }, intent: { 1: null, 2: null }, leader: null, raf: 0, touched2: false, prevActive: null, mounting: 0,
  };
  let built = false, mid, host, pane, bar, host2, divider, segEl;

  function build() {
    if (built) return true;
    host = document.getElementById('editorHost'); mid = host?.parentElement;
    if (!host || !mid) return false;
    divider = document.createElement('div');
    divider.className = 'mk-split-div'; divider.tabIndex = 0;
    divider.setAttribute('role', 'separator');
    divider.innerHTML = '<span class="mk-split-grip"></span>';
    pane = document.createElement('section');
    pane.className = 'mk-split-pane';
    bar = document.createElement('div'); bar.className = 'mk-split-bar'; bar.setAttribute('role', 'toolbar');
    labelChrome();
    host2 = document.createElement('div'); host2.className = 'mk-split-host'; host2.tabIndex = -1;
    pane.append(bar, host2);
    host.after(divider, pane);
    wireDivider(); wirePane();
    built = true;
    return true;
  }

  // ---------- one document model: the stand-in the second pane edits ----------
  function makeProxy(doc) {
    const px = Object.create(doc);
    Object.defineProperty(px, 'setText', {
      configurable: true, enumerable: false,
      value(text, origin) {
        st.inPaneSet++;
        try { doc.setText(text, 'split-' + (origin || 'edit')); } finally { st.inPaneSet--; }
        // the main pane's own typing may have been merged in: show the merged text in this pane too
        if (doc.text !== text && st.px === px) forward('split-merge');
      },
    });
    Object.defineProperty(px, '__splitOf', { value: doc });
    return px;
  }
  function forward(origin) { if (st.px) app.events.emit('doc:changed', { doc: st.px, origin }); }
  app.events.on('doc:changed', ({ doc, origin } = {}) => {
    if (!st.on || !st.px || doc !== st.realDoc) return;
    if (st.inPaneSet && /^split-/.test(String(origin || ''))) return; // this pane's own edit
    forward('split-sync');
  });

  // ---------- which editor the ribbon and shortcuts talk to ----------
  const baseActive = app.editors.active.bind(app.editors);
  app.editors.active = function () { return st.on && st.focus2 && st.ad && !st.inPaneSet ? st.ad : baseActive(); };
  function setFocus2(v) {
    v = !!v && st.on;
    if (v === st.focus2) return;
    // whatever the pane being left still holds goes into the document first
    try { (st.focus2 ? st.ad : baseActive())?.flush?.(); } catch {}
    st.focus2 = v;
    document.body.classList.toggle('mk-split-p2', v);
    app.events.emit('split:focus', { pane: v ? 2 : 1 });
    app.events.emit('selection:changed');
  }
  document.addEventListener('focusin', e => { if (!st.on) return; if (pane?.contains(e.target) && !bar.contains(e.target)) setFocus2(true); else if (host?.contains(e.target)) setFocus2(false); }, true);
  document.addEventListener('pointerdown', e => { if (!st.on) return; if (host2?.contains(e.target)) { st.touched2 = true; setFocus2(true); } else if (host?.contains(e.target)) setFocus2(false); }, true);

  // ---------- layout ----------
  const clampRatio = r => Math.max(0.15, Math.min(0.85, Number(r) || 0.5));
  // Split stacks the panes like Word (one above the other, so a Word-mode page keeps its full width); View Side by Side puts
  // two documents next to each other. Once the user picks an orientation, it is used for both.
  function orientation() { const v = settings.get('splitOrientation', null); if (v === 'stacked' || v === 'side') return v; return st.kind === 'side' ? 'side' : 'stacked'; }
  function applyLayout() {
    const on = st.on, o = orientation(), r = clampRatio(st.ratio ?? settings.get('splitRatio', 0.5));
    st.ratio = r;
    document.body.classList.toggle('mk-split', on);
    document.body.classList.toggle('mk-split-stacked', on && o === 'stacked');
    document.body.classList.toggle('mk-split-p2', on && st.focus2);
    if (mid) { mid.style.setProperty('--mk-sa', `${r}fr`); mid.style.setProperty('--mk-sb', `${1 - r}fr`); }
    if (divider) {
      divider.setAttribute('aria-orientation', o === 'stacked' ? 'horizontal' : 'vertical');
      divider.setAttribute('aria-valuenow', String(Math.round(r * 100)));
      divider.setAttribute('aria-valuemin', '15'); divider.setAttribute('aria-valuemax', '85');
    }
    app.events.emit('split:layout', { on, orientation: o, ratio: r });
  }
  function setRatio(r, save = true) {
    st.ratio = clampRatio(r); applyLayout();
    if (save) saveRatio(st.ratio);
  }
  const saveRatio = app.debounce(r => settings.set('splitRatio', r), 400);
  function wireDivider() {
    let drag = null;
    divider.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      const a = host.getBoundingClientRect(), b = pane.getBoundingClientRect();
      drag = { stacked: orientation() === 'stacked', start: orientation() === 'stacked' ? a.top : a.left, size: orientation() === 'stacked' ? b.bottom - a.top : b.right - a.left };
      divider.setPointerCapture(e.pointerId); divider.classList.add('drag');
      document.body.classList.add('mk-split-dragging');
    });
    divider.addEventListener('pointermove', e => {
      if (!drag) return;
      const p = (drag.stacked ? e.clientY : e.clientX) - drag.start;
      setRatio(p / Math.max(1, drag.size), false);
    });
    const end = () => { if (!drag) return; drag = null; divider.classList.remove('drag'); document.body.classList.remove('mk-split-dragging'); saveRatio(st.ratio); };
    divider.addEventListener('pointerup', end); divider.addEventListener('pointercancel', end);
    divider.addEventListener('dblclick', () => setRatio(0.5));
    divider.addEventListener('keydown', e => {
      const stacked = orientation() === 'stacked';
      const step = e.shiftKey ? 0.01 : 0.05;
      if ((e.key === 'ArrowLeft' && !stacked) || (e.key === 'ArrowUp' && stacked)) { e.preventDefault(); setRatio(st.ratio - step); }
      else if ((e.key === 'ArrowRight' && !stacked) || (e.key === 'ArrowDown' && stacked)) { e.preventDefault(); setRatio(st.ratio + step); }
      else if (e.key === 'Home') { e.preventDefault(); setRatio(0.15); }
      else if (e.key === 'End') { e.preventDefault(); setRatio(0.85); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRatio(0.5); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    });
  }

  // ---------- the second pane ----------
  function defaultPaneMode() {
    const saved = settings.get('splitPaneMode', null);
    if (MODES.includes(saved)) return saved;
    return app.mode === 'simple' ? 'word' : 'simple';
  }
  function wirePane() {
    // keys typed in the second pane that belong to it (capture: before its editor and the window shortcuts)
    pane.addEventListener('keydown', e => {
      if (!st.on || bar.contains(e.target)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && !e.altKey && !e.shiftKey && /^Digit[1-4]$/.test(e.code)) { e.preventDefault(); e.stopPropagation(); setPaneMode(MODES[+e.code.slice(5) - 1]); return; }
      if (ctrl && e.shiftKey && !e.altKey && e.code === 'KeyM') { e.preventDefault(); e.stopPropagation(); setPaneMode(MODES[(MODES.indexOf(st.mode) + 1) % MODES.length]); return; }
      if (ctrl && !e.altKey && !e.shiftKey && e.code === 'KeyS' && st.kind === 'side') { e.preventDefault(); e.stopPropagation(); savePaneDoc(); return; }
    }, true);
    // Synchronous Scrolling follows only scrolling the user did in a pane (wheel, scroll bar, keys, touch)
    for (const which of [1, 2]) {
      const box = which === 1 ? host : host2;
      for (const ev of ['wheel', 'pointerdown', 'keydown', 'touchstart']) box.addEventListener(ev, e => { st.intent[which] = { target: e.target, at: Date.now() }; }, { passive: true, capture: true });
      box.addEventListener('scroll', e => onScroll(which, e), { passive: true, capture: true });
    }
  }
  // names and tips of the divider and the pane, in the interface language (again after every language switch)
  function labelChrome() {
    if (!divider) return;
    divider.setAttribute('aria-label', app.t('Split divider. Arrow keys move it, Enter makes both panes the same size, Esc closes the split.'));
    divider.dataset.tip = app.t('Split divider'); divider.dataset.tipD = app.t('Drag to change the size of the panes. Double-click (or Enter) for two equal panes. Esc closes the split.');
    pane.setAttribute('aria-label', app.t('Second pane')); bar.setAttribute('aria-label', app.t('Second pane'));
  }
  app.events.on('i18n:changed', () => { try { labelChrome(); if (st.on) renderBar(); } catch (e) { console.error('split: i18n', e); } });
  function renderBar() {
    if (!bar) return;
    bar.innerHTML = '';
    const doc = st.realDoc;
    const mkBtn = (cls, html, tip, desc, run, extra = {}) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mk-split-btn ' + cls; b.innerHTML = html;
      b.dataset.tip = tip; if (desc) b.dataset.tipD = desc; b.setAttribute('aria-label', tip);
      if (extra.pressed != null) b.setAttribute('aria-pressed', String(!!extra.pressed));
      if (extra.key) b.dataset.key = extra.key;
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', run); return b;
    };
    // what the pane shows
    if (st.kind === 'side') {
      const pick = mkBtn('mk-split-doc', `<span class="mk-split-dot${doc?.dirty ? ' on' : ''}"></span><span class="t">${esc(doc?.title || app.t('Document'))}</span><svg class="i mk-split-chev"><use href="#chev"/></svg>`, app.t('Choose the document in this pane'), app.t('Pick another open document for the right pane, or open a file.'), e => pickDoc(e.currentTarget));
      bar.append(pick);
    } else {
      const lab = document.createElement('span'); lab.className = 'mk-split-label';
      lab.innerHTML = `<b>${esc(doc?.title || '')}</b><span>${app.th('Second view')}</span>`;
      bar.append(lab);
    }
    const sp = document.createElement('span'); sp.className = 'mk-split-sp'; bar.append(sp);
    // the pane's own editing mode
    const opts = MODES.filter(m => E[FACTORY[m]]).map((m, i) => ({ value: m, label: modeName(m), title: app.t('{mode} mode in this pane (Ctrl+{number} while typing here)', { mode: modeName(m), number: i + 1 }) }));
    if (app.shell?.makeSeg) { segEl = app.shell.makeSeg(opts, st.mode, v => setPaneMode(v), { small: true, label: app.t('Editing mode of this pane') }); segEl.classList.add('mk-split-seg'); bar.append(segEl); }
    // a narrow pane shows the mode as one small menu button instead (split-view.css container query)
    bar.append(mkBtn('mk-split-modebtn', `<span class="t">${esc(modeName(st.mode))}</span><svg class="i mk-split-chev"><use href="#chev"/></svg>`, app.t('Editing mode of this pane'), app.t('Word, Inline, Simple or Read, just for this pane (Ctrl+1 to Ctrl+4 while typing here).'), e => app.ui.menu(e.currentTarget, opts.map(o => ({ label: o.label, checked: o.value === st.mode, run: () => setPaneMode(o.value) })), { checks: true })));
    if (st.kind === 'side') bar.append(mkBtn('mk-split-save', icon('mkw-save'), app.t('Save this document'), app.t('Save the document in this pane (Ctrl+S while typing here).'), () => savePaneDoc()));
    bar.append(mkBtn('mk-split-sync' + (st.sync ? ' on' : ''), icon('mkw-sync'), app.t('Synchronous Scrolling'), app.t('Scroll both panes together. Change how they line up in File → Options → Window and ruler.'), () => app.commands.run('view.syncScroll'), { pressed: st.sync }));
    bar.append(mkBtn('mk-split-swap', icon('mkw-swap'), st.kind === 'side' ? app.t('Swap documents') : app.t('Swap modes'), st.kind === 'side' ? app.t('Put each document in the other pane.') : app.t('Give each pane the other pane’s editing mode.'), () => app.commands.run('view.swapPanes')));
    const stacked = orientation() === 'stacked';
    bar.append(mkBtn('mk-split-orient', icon(stacked ? 'mkw-cols' : 'mkw-stack'), stacked ? app.t('Put the panes side by side') : app.t('Stack the panes'), app.t('Switch between panes side by side and one above the other.'), () => app.commands.run('view.splitOrientation')));
    bar.append(mkBtn('mk-split-close', icon('mkw-close'), st.kind === 'side' ? app.t('Close View Side by Side') : app.t('Remove Split'), app.t('Back to one pane. Esc on the divider does the same.'), () => close()));
  }
  function updateBarState() {
    if (!bar || !st.on) return;
    const d = st.realDoc;
    const dot = bar.querySelector('.mk-split-dot'); if (dot) dot.classList.toggle('on', !!d?.dirty);
    const t = bar.querySelector('.mk-split-doc .t, .mk-split-label b'); if (t && d) t.textContent = d.title;
    const s = bar.querySelector('.mk-split-sync'); if (s) { s.classList.toggle('on', st.sync); s.setAttribute('aria-pressed', String(st.sync)); }
    segEl?.set?.(st.mode);
    const mb = bar.querySelector('.mk-split-modebtn .t'); if (mb) mb.textContent = modeName(st.mode);
  }
  async function mountPane() {
    const seq = ++st.mounting;
    unmountPane();
    const doc = app.docs.get(st.docId);
    if (!doc || !st.on) return;
    let mode = st.mode;
    if (!E[FACTORY[mode]]) mode = MODES.find(m => E[FACTORY[m]]) || null;
    if (!mode) { host2.innerHTML = `<div class="host-empty"><div><b>${app.th('Close the split and open it again')}</b>${app.th('The second pane could not load an editor this time. The first pane works as usual.')}</div></div>`; return; }
    st.mode = mode;
    const ad = E[FACTORY[mode]]();
    const px = makeProxy(doc);
    st.ad = ad; st.px = px; st.realDoc = doc;
    host2.innerHTML = '';
    host2.dataset.mode = mode;
    pane.dataset.mode = mode;
    const keep = document.activeElement;
    st.touched2 = false;
    try { await ad.mount(host2, px); }
    catch (e) { console.error('split: mount', e); host2.innerHTML = ''; st.ad = null; app.ui.fail(e, { lead: 'Choose another mode for the second pane, or close the split. The first pane works as usual.', hideReason: true }); return; }
    if (seq !== st.mounting) return;
    // editors put the cursor on their page when they load: keep it where the user was, unless they clicked here
    const giveBack = () => { if (!st.touched2 && !st.focus2 && host2.contains(document.activeElement) && keep && keep.isConnected && !host2.contains(keep)) try { keep.focus({ preventScroll: true }); } catch {} };
    setTimeout(giveBack, 30); setTimeout(giveBack, 350); setTimeout(giveBack, 900);
    updateBarState();
    if (st.sync) setTimeout(() => alignNow(1), 120);
  }
  function unmountPane() {
    const ad = st.ad;
    st.ad = null; st.px = null; st.realDoc = null;
    if (ad) { try { ad.flush?.(); } catch {} try { ad.unmount(); } catch (e) { console.warn('split: unmount', e); } }
    if (host2) host2.innerHTML = '';
  }

  // ---------- open / close ----------
  async function open(o = {}) {
    if (!build()) return false;
    const primary = app.docs.active();
    const kind = o.kind === 'side' ? 'side' : 'split';
    const doc = kind === 'side' ? app.docs.get(o.docId) : primary;
    if (!doc || doc.kind !== 'markdown' || (primary && primary.kind !== 'markdown')) {
      toast(kind === 'side' ? app.t('Open two Markdown documents to see them side by side. PDF and DjVu pages show one at a time.') : app.t('Switch to a Markdown document to split the window. PDF and DjVu pages show in one pane.'), { kind: 'info' });
      return false;
    }
    if (kind === 'side' && primary && doc.id === primary.id) return false;
    try { baseActive()?.flush?.(); } catch {}
    st.on = true; st.kind = kind; st.docId = doc.id; st.prevActive = primary?.id || null;
    st.mode = MODES.includes(o.mode) ? o.mode : (st.mode && kind === st.lastKind ? st.mode : defaultPaneMode());
    st.lastKind = kind;
    st.sync = kind === 'side' ? settings.get('sideBySideSync', true) !== false : settings.get('splitSync', false) === true;
    st.ratio = clampRatio(settings.get('splitRatio', 0.5));
    applyLayout();
    renderBar();
    await mountPane();
    renderBar();
    app.events.emit('split:changed', { on: true, kind, mode: st.mode });
    app.events.emit('ribbon:changed');
    return true;
  }
  function close() {
    if (!st.on) return false;
    setFocus2(false);
    st.mounting++;
    unmountPane();
    st.on = false; st.kind = null; st.docId = null;
    applyLayout();
    if (bar) bar.innerHTML = '';
    app.events.emit('split:changed', { on: false });
    app.events.emit('ribbon:changed');
    try { baseActive()?.focus?.(); } catch {}
    return true;
  }
  async function setPaneMode(m) {
    if (!MODES.includes(m) || !st.on) return false;
    if (m === st.mode && st.ad) return true;
    st.mode = m; settings.set('splitPaneMode', m);
    const wasIn = st.focus2;
    await mountPane();
    renderBar();
    if (wasIn) { st.touched2 = true; try { st.ad?.focus?.(); } catch {} }
    app.events.emit('split:changed', { on: true, kind: st.kind, mode: m });
    return true;
  }
  async function savePaneDoc() {
    const d = st.realDoc; if (!d) return false;
    try { st.ad?.flush?.(); } catch {}
    const ok = await app.docs.save(d);
    updateBarState();
    return ok;
  }
  // Save (Quick Access Toolbar, File → Save, the palette) saves the document of the pane you are typing in, as Word does
  // with two windows: with View Side by Side on and the cursor on the right, that is the right document
  function wrapSave() {
    const c = app.commands.get?.('file.save');
    if (!c || c.__splitWrapped || typeof c.run !== 'function') return;
    const run0 = c.run;
    c.run = function (...a) { return st.on && st.kind === 'side' && st.focus2 && st.realDoc ? savePaneDoc() : run0.apply(this, a); };
    c.__splitWrapped = true;
  }
  wrapSave(); app.events.on('ready', wrapSave);
  function otherDocs() { const a = app.docs.active(); return app.docs.list().filter(d => d.kind === 'markdown' && d.id !== a?.id); }
  async function openFileForSide() {
    let paths = [];
    try { paths = await app.mk.invoke('open-dialog', { title: app.t('Open a document to view side by side') }); } catch (e) { app.ui.fail(e, { lead: app.t('Open the file with File → Open, then choose View Side by Side again.'), hideReason: true }); return null; }
    if (!paths || !paths[0]) return null;
    const keep = app.docs.active();
    const d = await app.docs.open(paths[0]);
    if (keep && d && keep.id !== d.id && app.docs.get(keep.id)) app.docs.activate(keep.id);
    return d && d.id !== keep?.id ? d : null;
  }
  async function chooseSideDoc() {
    const list = otherDocs();
    const body = document.createElement('div');
    body.className = 'mk-split-pick';
    const p = document.createElement('p');
    p.textContent = list.length ? app.t('Show this document next to the one you are working on:') : app.t('Open another document to show it next to this one.');
    body.append(p);
    let chosen = null;
    return app.ui.dialog({
      title: app.t('View Side by Side'), icon: 'mkw-side', body,
      buttons: [{ label: app.t('Open a file…'), value: 'file', left: true }, { label: app.t('Cancel'), value: null }, ...(list.length ? [{ label: app.t('Show side by side'), value: () => chosen, primary: true }] : [])],
      onOpen(el, closeDlg) {
        if (!list.length) return;
        const ul = document.createElement('div'); ul.className = 'mk-split-list'; ul.setAttribute('role', 'listbox'); ul.setAttribute('aria-label', app.t('Open documents'));
        list.forEach((d, i) => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'mk-split-item'; b.setAttribute('role', 'option');
          b.innerHTML = `<svg class="i"><use href="#doc"/></svg><span><b>${esc(d.title)}</b><small>${esc(d.path || app.t('Not saved yet'))}</small></span>`;
          const pickIt = () => { chosen = d.id; $$('.mk-split-item', ul).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); }); };
          b.addEventListener('click', pickIt);
          b.addEventListener('dblclick', () => { pickIt(); closeDlg(d.id); });
          b.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const all = $$('.mk-split-item', ul); const n = all[(all.indexOf(b) + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]; n.focus(); n.click(); }
          });
          ul.append(b);
          if (i === 0) pickIt();
        });
        el.append(ul);
        setTimeout(() => ul.querySelector('.mk-split-item.on')?.focus(), 40);
      },
    });
  }
  async function sideBySide(args = {}) {
    if (st.on && st.kind === 'side' && !args.docId) { close(); return true; }
    let id = args.docId || null;
    if (!id) {
      const list = otherDocs();
      // two documents open: like Word, show them side by side right away
      if (list.length === 1 && !args.ask) id = list[0].id;
      else {
        const v = await chooseSideDoc();
        if (v === 'file') { const d = await openFileForSide(); id = d?.id || null; }
        else id = v || null;
      }
    }
    if (!id) return false;
    return open({ kind: 'side', docId: id, mode: args.mode });
  }
  function pickDoc(anchor) {
    const items = otherDocs().map(d => ({ label: d.title, checked: d.id === st.docId, run: () => { st.docId = d.id; mountPane().then(renderBar); } }));
    items.push({ sep: true }, { label: app.t('Open a file…'), run: async () => { const d = await openFileForSide(); if (d) { st.docId = d.id; await mountPane(); renderBar(); } } });
    app.ui.menu(anchor, items, { checks: true });
  }
  async function swap() {
    if (!st.on) return false;
    if (st.kind === 'side') {
      const a = app.docs.active(), b = st.realDoc; if (!a || !b) return false;
      try { baseActive()?.flush?.(); st.ad?.flush?.(); } catch {}
      st.docId = a.id;
      app.docs.activate(b.id); // the doc:active handler below puts the first document into this pane
      await sleep(0);
      if (st.realDoc?.id !== st.docId) { await mountPane(); }
      renderBar();
      return true;
    }
    const m1 = app.mode, m2 = st.mode;
    if (m1 === m2) return true;
    app.setMode(m2);
    await setPaneMode(m1);
    return true;
  }
  app.events.on('doc:active', d => {
    if (!st.on || !d) return;
    if (d.kind !== 'markdown') { close(); return; }
    if (st.kind === 'split') { if (st.docId !== d.id) { st.docId = d.id; mountPane().then(renderBar); } return; }
    // side by side: the two panes always show two different documents
    if (d.id === st.docId) st.docId = st.prevActive && st.prevActive !== d.id && app.docs.get(st.prevActive) ? st.prevActive : null;
    st.prevActive = d.id;
    if (!st.docId) { close(); return; }
    if (st.realDoc?.id !== st.docId) mountPane().then(renderBar);
  });
  app.events.on('doc:closed', d => {
    if (!st.on || !d) return;
    if (st.kind === 'side' && d.id === st.docId) close();
  });
  ['doc:saved', 'doc:changed'].forEach(ev => app.events.on(ev, p => { const d = p && p.doc ? p.doc : p; if (st.on && d && st.realDoc && d.id === st.realDoc.id) updateBarStateSoon(); }));
  const updateBarStateSoon = app.debounce(updateBarState, 120);

  // ---------- synchronous scrolling ----------
  const fmLines = text => { try { return E.frontMatterLines ? E.frontMatterLines(text || '') : 0; } catch { return 0; } };
  function paneInfo(which) {
    return which === 1 ? { which, box: host, doc: app.docs.active() } : { which, box: host2, doc: st.realDoc };
  }
  function mainScroller(p) {
    const src = p.box.querySelector('.mk-simple .mk-src');
    if (src && src.offsetParent) return src;
    if (p.box.scrollHeight > p.box.clientHeight + 2) return p.box;
    for (const el of p.box.querySelectorAll('*')) {
      if (el.scrollHeight > el.clientHeight + 2) { const oy = getComputedStyle(el).overflowY; if (oy === 'auto' || oy === 'scroll') return el; }
      if (el.childElementCount > 400) break;
    }
    return p.box;
  }
  function headingsIn(sc) { return $$('h1,h2,h3,h4,h5,h6', sc).filter(x => x.getClientRects().length); }
  const normH = el => String(el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  /** Where the top of a pane is: the Markdown line there (and how far into it), the heading above it, and the scroll fraction. */
  function readPos(p, sc) {
    sc = sc || mainScroller(p);
    const r = sc.getBoundingClientRect();
    const frac = sc.scrollHeight > sc.clientHeight ? sc.scrollTop / (sc.scrollHeight - sc.clientHeight) : 0;
    const out = { frac, line: null, within: 0, heading: null, headingIndex: -1, past: 0 };
    if (sc.classList.contains('mk-src')) {
      const rows = sc.querySelector('.mk-src-mirror')?.children || [];
      for (let i = 0; i < rows.length; i++) { const b = rows[i].getBoundingClientRect(); if (b.bottom > r.top + 1) { out.line = i; out.within = b.height ? Math.max(0, Math.min(1, (r.top - b.top) / b.height)) : 0; break; } }
      return out;
    }
    const fm = fmLines(p.doc?.text);
    let straddle = null, below = null;
    for (const el of sc.querySelectorAll('[data-line]')) {
      const b = el.getBoundingClientRect(); if (!b.height) continue;
      const line = +el.getAttribute('data-line'); if (!Number.isFinite(line)) continue;
      if (b.top <= r.top + 1 && b.bottom > r.top + 1) { if (!straddle || line >= straddle.line) straddle = { el, b, line }; }
      else if (b.top > r.top + 1 && (!below || b.top < below.b.top)) below = { el, b, line };
    }
    const pick = straddle || below;
    if (pick) { out.line = pick.line + fm; out.within = straddle ? Math.max(0, Math.min(1, (r.top - pick.b.top) / pick.b.height)) : 0; }
    const hs = headingsIn(sc);
    for (let i = 0; i < hs.length; i++) { const b = hs[i].getBoundingClientRect(); if (b.top <= r.top + 2) { out.heading = normH(hs[i]); out.headingIndex = i; out.past = r.top - b.top; } else break; }
    return out;
  }
  function reveal(p, pos, how) {
    const sc = mainScroller(p);
    const r = sc.getBoundingClientRect();
    const byPos = () => { sc.scrollTop = pos.frac * Math.max(0, sc.scrollHeight - sc.clientHeight); };
    if (how === 'position') return byPos();
    if (how === 'heading') {
      const hs = headingsIn(sc);
      if (pos.headingIndex < 0) { sc.scrollTop = 0; return; }
      const h = hs.find(x => normH(x) === pos.heading) || hs[Math.min(pos.headingIndex, hs.length - 1)];
      if (!h) return byPos();
      sc.scrollTop += h.getBoundingClientRect().top - r.top + pos.past;
      return;
    }
    if (pos.line == null) return byPos();
    if (sc.classList.contains('mk-src')) {
      const row = sc.querySelector('.mk-src-mirror')?.children[pos.line];
      if (!row) return byPos();
      sc.scrollTop += row.getBoundingClientRect().top - r.top + pos.within * row.getBoundingClientRect().height;
      try { sc.dispatchEvent(new WheelEvent('wheel', { bubbles: false })); } catch {} // Simple's own preview follows its Markdown side
      return;
    }
    const fm = fmLines(p.doc?.text);
    let best = null, bl = -1;
    for (const el of sc.querySelectorAll('[data-line]')) {
      const l = +el.getAttribute('data-line') + fm;
      if (l <= pos.line && l >= bl && el.getClientRects().length) { best = el; bl = l; }
    }
    if (!best) { sc.scrollTop = 0; return; }
    const b = best.getBoundingClientRect();
    sc.scrollTop += b.top - r.top + (bl === pos.line ? pos.within * b.height : 0);
  }
  function syncHow() {
    const by = settings.get('splitSyncBy', 'text') === 'position' ? 'position' : 'text';
    if (by === 'position') return 'position';
    return st.kind === 'side' ? 'heading' : 'line';
  }
  function onScroll(which, e) {
    if (!st.on || !st.sync) return;
    if (Date.now() < st.mute[which]) return;
    const it = st.intent[which];
    const sc = e.target && e.target.nodeType === 1 ? e.target : null;
    if (!sc || !it || Date.now() - it.at > 1500) return; // only scrolling the user did (not the editor's own catch-up)
    if (!(sc.contains(it.target) || it.target === sc)) return;
    st.leader = { which, sc };
    if (!st.raf) st.raf = raf(() => { st.raf = 0; follow(); });
  }
  function follow() {
    const L = st.leader; if (!L || !st.on) return;
    const from = paneInfo(L.which), to = paneInfo(L.which === 1 ? 2 : 1);
    if (!from.doc || !to.doc) return;
    const pos = readPos(from, L.sc);
    st.mute[to.which] = Date.now() + 150;
    reveal(to, pos, syncHow());
  }
  function alignNow(fromWhich = 1) {
    if (!st.on) return;
    const from = paneInfo(fromWhich), to = paneInfo(fromWhich === 1 ? 2 : 1);
    if (!from.doc || !to.doc) return;
    st.mute[to.which] = Date.now() + 150;
    reveal(to, readPos(from), syncHow());
  }
  function setSync(v) {
    st.sync = !!v;
    settings.set(st.kind === 'side' ? 'sideBySideSync' : 'splitSync', st.sync);
    updateBarState();
    if (st.sync) alignNow(1);
    app.events.emit('ribbon:changed');
  }

  // ---------- commands, ribbon, options ----------
  const whyOff = () => (st.on ? '' : app.t('Turn on Split or View Side by Side first.'));
  const C = (id, def) => app.commands.register(id, { category: 'View', ...def });
  C('view.split', { label: app.tm('Split'), icon: 'mkw-split', shortcut: 'Ctrl+Alt+S', description: app.tm('Show this document in two panes, each with its own editing mode and scroll position. Typing in one pane shows up in the other at once. Press again to go back to one pane.'), isActive: () => st.on && st.kind === 'split', run: () => (st.on && st.kind === 'split' ? close() : open({ kind: 'split' })) });
  C('view.sideBySide', { label: app.tm('View Side by Side'), icon: 'mkw-side', description: app.tm('Show two open documents next to each other, both editable, to compare them or copy between them. Synchronous Scrolling keeps them together.'), isActive: () => st.on && st.kind === 'side', run: a => sideBySide(a || {}) });
  C('view.syncScroll', { label: app.tm('Synchronous Scrolling'), icon: 'mkw-sync', description: app.tm('Scroll both panes together. In a split they line up at the same place in the text; side by side at the same heading (or the same distance from the top, see File → Options).'), isActive: () => st.on && st.sync, isEnabled: () => st.on, why: whyOff, run: () => setSync(!st.sync) });
  C('view.syncScrollBy', { label: app.tm('Line up panes by'), icon: 'mkw-sync', palette: false, description: app.tm('How Synchronous Scrolling lines up the panes: the same place in the text, or the same distance from the top.'), run: a => { const v = (a && a.value) || a; settings.set('splitSyncBy', v === 'position' ? 'position' : 'text'); if (st.sync) alignNow(1); } });
  C('view.resetWindowPosition', { label: app.tm('Reset Window Position'), icon: 'mkw-reset', description: app.tm('Give both panes the same size again. With no split, place the Markooj windows side by side.'), run: () => { if (st.on) { setRatio(0.5); return true; } return app.commands.run('view.arrangeAll'); } });
  C('view.splitOrientation', { label: app.tm('Stack or side by side panes'), icon: 'mkw-stack', description: app.tm('Switch the split panes between side by side and one above the other.'), isActive: () => orientation() === 'stacked', run: a => { const v = a && (a.value || (typeof a === 'string' ? a : null)); settings.set('splitOrientation', v ? (v === 'stacked' ? 'stacked' : 'side') : (orientation() === 'stacked' ? 'side' : 'stacked')); applyLayout(); renderBar(); return orientation(); } });
  C('view.swapPanes', { label: app.tm('Swap panes'), icon: 'mkw-swap', description: app.tm('Side by side: put each document in the other pane. Split: give each pane the other pane’s editing mode.'), isEnabled: () => st.on, why: whyOff, run: swap });
  C('view.closeSplit', { label: app.tm('Remove Split'), icon: 'mkw-close', description: app.tm('Go back to one pane. Esc on the divider does the same.'), isEnabled: () => st.on, why: whyOff, run: close });
  C('view.otherPane', { label: app.tm('Go to the other pane'), icon: 'mkw-split', description: app.tm('Move the cursor between the two panes of a split or side-by-side view. F6 also stops at both panes.'), isEnabled: () => st.on, why: whyOff, run: () => focusPane(st.focus2 ? 1 : 2) });
  C('view.splitPaneMode', { label: app.tm('Second pane mode'), icon: 'mkw-split', palette: false, description: app.tm('Set the editing mode of the second pane: Word, Inline, Simple or Read.'), run: a => setPaneMode((a && a.value) || a) });
  // one English label and description per mode, so each is a whole sentence for translators
  const PANE_CMD = {
    word: [app.tm('Second pane: Word mode'), app.tm('Show the second pane of the split in Word mode (Ctrl+1 while typing there).')],
    inline: [app.tm('Second pane: Inline mode'), app.tm('Show the second pane of the split in Inline mode (Ctrl+2 while typing there).')],
    simple: [app.tm('Second pane: Simple mode'), app.tm('Show the second pane of the split in Simple mode (Ctrl+3 while typing there).')],
    read: [app.tm('Second pane: Read mode'), app.tm('Show the second pane of the split in Read mode (Ctrl+4 while typing there).')],
  };
  MODES.forEach((m, i) => C('view.splitPane' + MODE_LABEL[m], { label: PANE_CMD[m][0], icon: 'mkw-split', description: PANE_CMD[m][1], isActive: () => st.on && st.mode === m, isEnabled: () => st.on, why: whyOff, run: () => setPaneMode(m) }));
  function focusPane(n) {
    if (!st.on) return false;
    if (n === 2) { st.touched2 = true; setFocus2(true); try { st.ad?.focus?.(); } catch {} if (!host2.contains(document.activeElement)) host2.focus({ preventScroll: true }); }
    else { setFocus2(false); try { baseActive()?.focus?.(); } catch {} if (!host.contains(document.activeElement)) host.focus({ preventScroll: true }); }
    return true;
  }
  app.ribbon.addGroup('view', { id: 'window', label: app.tm('Window@@ribbon group'), order: 35, items: [
    { type: 'big', command: 'view.newWindow', label: app.tm('New Window'), icon: 'mkw-newwin' },
    { type: 'big', command: 'view.arrangeAll', label: app.tm('Arrange All'), icon: 'mkw-arrange' },
    { type: 'big', command: 'view.split', label: app.tm('Split'), icon: 'mkw-split' },
    { type: 'col', items: [
      { type: 'small', command: 'view.sideBySide', label: app.tm('View Side by Side'), icon: 'mkw-side', showLabel: true },
      { type: 'small', command: 'view.syncScroll', label: app.tm('Synchronous Scrolling'), icon: 'mkw-sync', showLabel: true },
      { type: 'small', command: 'view.resetWindowPosition', label: app.tm('Reset Window Position'), icon: 'mkw-reset', showLabel: true },
    ] },
    { type: 'big', command: 'view.switchWindows', label: app.tm('Switch Windows'), icon: 'mkw-switch' },
  ] });

  app.options.addSection({ id: 'window', label: app.tm('Window and ruler'), order: 18, render(el) {
    el.innerHTML = '';
    const sh = app.shell || {};
    const row = (label, small, control) => {
      const r = document.createElement('div'); r.className = 'opt-row';
      r.innerHTML = `<div class="ol"><b>${esc(label)}</b>${small ? `<small>${esc(small)}</small>` : ''}</div>`;
      const c = document.createElement('div'); c.className = 'oc'; c.append(control); r.append(c); return r;
    };
    const seg = (opts, v, on) => (sh.makeSeg ? sh.makeSeg(opts, v, on, { small: true }) : document.createTextNode(''));
    el.append(row(app.t('Split panes'), app.t('View → Split (Ctrl+Alt+S) shows one document twice; View Side by Side shows two documents.'), seg([{ value: 'side', label: app.t('Side by side') }, { value: 'stacked', label: app.t('Stacked') }], orientation(), v => app.commands.run('view.splitOrientation', { value: v }))));
    el.append(row(app.t('Second pane starts in'), app.t('The editing mode the second pane uses first. Change it any time in the pane’s own bar.'), seg(MODES.map(m => ({ value: m, label: modeName(m) })), defaultPaneMode(), v => settings.set('splitPaneMode', v))));
    el.append(row(app.t('Synchronous Scrolling follows'), app.t('Same place in the text: the same paragraph (split) or the same heading (two documents). Same distance: the same share of the way down.'), seg([{ value: 'text', label: app.t('Same place in the text') }, { value: 'position', label: app.t('Same distance') }], settings.get('splitSyncBy', 'text'), v => app.commands.run('view.syncScrollBy', { value: v }))));
    if (sh.settingSwitch) {
      el.append(sh.settingSwitch('sideBySideSync', true, app.t('Scroll side-by-side documents together'), app.t('Turns Synchronous Scrolling on when you open View Side by Side, like Word.')));
      el.append(sh.settingSwitch('splitSync', false, app.t('Scroll split panes together'), app.t('Off by default, so each pane of a split can show a different part of the document.')));
    }
    try { app.ruler?.renderOptions?.(el); } catch (e) { console.error('ruler options', e); }
  } });

  app.split = { open, close, sideBySide, setPaneMode, swap, setRatio, setSync, alignNow, readPos, reveal, focusPane, state: st, get on() { return st.on; }, get kind() { return st.kind; }, get mode() { return st.mode; }, get adapter() { return st.ad; }, get host() { return host2; }, get ratio() { return st.ratio; }, orientation };

  // ---------- smoke tests ----------
  const A = app.assert;
  const until = async (fn, ms = 5000, what = 'condition') => { const t0 = Date.now(); for (;;) { let v; try { v = await fn(); } catch { v = false; } if (v) return v; if (Date.now() - t0 > ms) throw new Error('Timed out waiting for ' + what); await sleep(40); } };
  const shot = async name => { try { await app.mk.invoke('smoke-shot', name); } catch {} };
  const LONG = ['---', 'title: Split test', '---', '', '# Split test', '', 'First paragraph of the split test.', ''].concat(...Array.from({ length: 24 }, (_, i) => [`## Section ${i + 1}`, '', `Body of section ${i + 1}. `.repeat(18), ''])).join('\n');
  async function withDoc(text, fn, title = 'Split test') {
    const m0 = app.mode;
    const d = app.docs.create({ title, text });
    try { return await fn(d); }
    finally { close(); app.setMode(m0); await sleep(30); await app.docs.close(d.id, { force: true }); }
  }
  app.tests.register('split: two panes of one document stay in step (Word + Simple, one model)', () => withDoc('# Split test\n\nFirst paragraph.\n', async d => {
    app.setMode('word');
    A(await open({ kind: 'split', mode: 'simple' }), 'split opened');
    A(document.body.classList.contains('mk-split') && pane.offsetWidth > 100 && host.offsetWidth > 100, 'two panes on screen');
    const ta = () => host2.querySelector('textarea.mk-src-ta');
    await until(() => ta() && ta().value === d.text, 4000, 'the second pane to show the Markdown');
    // an edit made through the document shows up in the second pane
    d.setText(d.text + '\nAdded from the first pane.\n', 'test');
    await until(() => /Added from the first pane/.test(ta().value), 3000, 'the second pane to follow');
    // typing in the second pane reaches the one document model and the first pane's page
    const t = ta(); t.focus(); t.value = t.value.replace('First paragraph.', 'First paragraph, typed in pane two.'); t.dispatchEvent(new Event('input', { bubbles: true }));
    await until(() => /typed in pane two/.test(d.text), 3000, 'the document to get the second pane’s typing');
    await until(() => /typed in pane two/.test(host.querySelector('.mk-page')?.textContent || ''), 4000, 'the Word page to show it');
    A(app.docs.list().filter(x => x.title === 'Split test').length === 1, 'still one document');
    focusPane(2);
    A(app.editors.active() === st.ad, 'ribbon commands go to the pane with the cursor');
    focusPane(1); A(app.editors.active() !== st.ad, 'and back to the first pane');
    await shot('split-view');
    // both panes in Word mode still stay in step
    await setPaneMode('word');
    await until(() => host2.querySelector('.mk-page [data-line]'), 4000, 'Word mode in pane two');
    st.ad.focus?.(); setFocus2(true);
    { const p = host2.querySelector('.mk-page p'); const r = document.createRange(); r.selectNodeContents(p); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); p.closest('[contenteditable="true"]')?.focus({ preventScroll: true }); s.removeAllRanges(); s.addRange(r); }
    await sleep(30);
    st.ad.insert?.('Inserted in the Word pane. ');
    await until(() => /Inserted in the Word pane/.test(d.text), 3000, 'the Word pane edit in the document');
    await until(() => /Inserted in the Word pane/.test(host.querySelector('.mk-page')?.textContent || ''), 4000, 'the first Word pane to show it');
    await setPaneMode('read');
    await until(() => /typed in pane two/.test(host2.querySelector('.mk-page')?.textContent || ''), 4000, 'Read mode in pane two');
  }));
  app.tests.register('split: divider, orientation and Esc', () => withDoc('# Divider\n\nText.\n', async () => {
    A(await open({ kind: 'split', mode: 'read' }), 'split opened');
    const rawOrient = settings.get('splitOrientation', null);
    await app.commands.run('view.splitOrientation', { value: 'side' });
    setRatio(0.5);
    const w0 = host.getBoundingClientRect().width;
    divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await sleep(30);
    A(Math.abs(st.ratio - 0.55) < 0.001 && host.getBoundingClientRect().width > w0 + 10, 'arrow key widens the first pane');
    divider.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    A(Math.abs(st.ratio - 0.5) < 0.001, 'double-click makes the panes equal');
    const before = orientation();
    await app.commands.run('view.splitOrientation');
    await sleep(30);
    A(orientation() !== before && document.body.classList.contains('mk-split-stacked') === (orientation() === 'stacked'), 'orientation switches');
    if (orientation() === 'stacked') { const a = host.getBoundingClientRect(), b = pane.getBoundingClientRect(); A(b.top >= a.bottom - 1, 'stacked: second pane below the first'); }
    await app.commands.run('view.splitOrientation', { value: before });
    settings.set('splitOrientation', rawOrient);
    divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    A(!st.on && !document.body.classList.contains('mk-split'), 'Esc on the divider closes the split');
    A(app.commands.get('view.split').shortcut === 'Ctrl+Alt+S', 'Split is Ctrl+Alt+S like Word');
    const clash = (app.keys?.conflicts?.() || []).filter(c => /view\.(split|nextWindow|prevWindow)/.test(c.a + c.b));
    A(!clash.length, 'no shortcut clashes: ' + JSON.stringify(clash));
  }));
  app.tests.register('split: View Side by Side shows two documents, edits the right one, swaps', async () => {
    const m0 = app.mode;
    const a = app.docs.create({ title: 'Left doc', text: '# Left\n\nLeft text.\n' });
    const b = app.docs.create({ title: 'Right doc', text: '# Right\n\nRight text.\n' });
    try {
      app.docs.activate(a.id);
      A(await sideBySide({ docId: b.id, mode: 'simple' }), 'side by side opened');
      A(st.kind === 'side' && st.realDoc === b && app.docs.active() === a, 'left shows the first document, right the second');
      const ta = () => host2.querySelector('textarea.mk-src-ta');
      await until(() => ta() && ta().value === b.text, 4000, 'the right pane to show the second document');
      const t = ta(); t.focus(); t.value += 'Typed on the right.\n'; t.dispatchEvent(new Event('input', { bubbles: true }));
      await until(() => /Typed on the right/.test(b.text), 3000, 'the right document to change');
      A(!/Typed on the right/.test(a.text) && b.dirty, 'only the right document changed');
      A(st.sync === (settings.get('sideBySideSync', true) !== false), 'Synchronous Scrolling starts as set in Options');
      // bug hunt (round 5): Save on the Quick Access Toolbar (or File → Save) while typing on the right saved the left document
      {
        const save0 = app.docs.save; let saved = null;
        app.docs.save = async d => { saved = d; return true; };
        try { t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); t.focus(); await app.commands.run('file.save'); } finally { app.docs.save = save0; }
        A(saved === b, 'Save while typing in the right pane saves the right document: ' + (saved && saved.title));
      }
      await shot('side-by-side');
      await swap();
      await until(() => app.docs.active() === b && st.realDoc === a, 3000, 'the documents to swap panes');
      await app.commands.run('view.sideBySide');
      A(!st.on, 'View Side by Side again closes it');
    } finally { close(); app.setMode(m0); await app.docs.close(b.id, { force: true }); await app.docs.close(a.id, { force: true }); }
  });
  app.tests.register('split: Synchronous Scrolling lines up both panes', () => withDoc(LONG, async d => {
    app.setMode('read');
    A(await open({ kind: 'split', mode: 'read' }), 'split opened');
    setSync(true);
    const p1 = paneInfo(1), p2 = paneInfo(2);
    await until(() => host.querySelectorAll('[data-line]').length > 20 && host2.querySelectorAll('[data-line]').length > 20, 6000, 'both panes to render');
    const sc1 = mainScroller(p1), sc2 = mainScroller(p2);
    A(sc1.scrollHeight > sc1.clientHeight + 200, 'the document is longer than the pane');
    const target = [...host.querySelectorAll('h2')][12];
    st.intent[1] = { target: sc1, at: Date.now() };
    sc1.scrollTop += target.getBoundingClientRect().top - sc1.getBoundingClientRect().top;
    sc1.dispatchEvent(new Event('scroll'));
    await sleep(250);
    const a = readPos(p1, sc1), b = readPos(p2, sc2);
    A(a.line != null && b.line === a.line, `same Markdown line at the top of both panes (${a.line} / ${b.line})`);
    // position mode
    settings.set('splitSyncBy', 'position');
    try {
      st.intent[1] = { target: sc1, at: Date.now() };
      sc1.scrollTop = Math.round((sc1.scrollHeight - sc1.clientHeight) * 0.3);
      sc1.dispatchEvent(new Event('scroll'));
      await sleep(250);
      const f2 = sc2.scrollTop / Math.max(1, sc2.scrollHeight - sc2.clientHeight);
      A(Math.abs(f2 - 0.3) < 0.03, 'same share of the way down: ' + f2.toFixed(3));
    } finally { settings.set('splitSyncBy', 'text'); }
    setSync(false);
    const keep = sc2.scrollTop;
    st.intent[1] = { target: sc1, at: Date.now() }; sc1.scrollTop = 0; sc1.dispatchEvent(new Event('scroll')); await sleep(200);
    A(sc2.scrollTop === keep, 'with Synchronous Scrolling off the second pane stays put');
    void d;
  }));
  app.tests.register('split: Window group on the View tab', async () => {
    const g = app.ribbon.tabs().find(t => t.id === 'view')?.groups.find(x => x.id === 'window');
    A(g, 'View → Window group');
    const ids = JSON.stringify(g.items);
    for (const id of ['view.newWindow', 'view.arrangeAll', 'view.split', 'view.sideBySide', 'view.syncScroll', 'view.resetWindowPosition', 'view.switchWindows']) {
      A(ids.includes(`"${id}"`), id + ' on the ribbon');
      A(app.commands.get(id)?.description, id + ' has a description');
    }
    if (app.tests.current && app.shell?.selectTab) {
      const rb = document.getElementById('ribbon');
      const tab0 = rb?.querySelector('.rtab.on[data-tab]')?.dataset.tab || 'home';
      try {
        app.shell.selectTab('view'); await sleep(120);
        rb?.querySelector('.panel.on [data-tip-cmd="view.split"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
        await sleep(120); await shot('view-window-group');
      } finally { app.shell.selectTab(tab0); }
    }
  });
})();
