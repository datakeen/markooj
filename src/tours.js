// Markooj — walkthrough tutorials: a small tour engine (spotlight cut-out, a card with Back / Next / Done, Esc closes, keyboard
// accessible, follows its target when the layout moves, waits for the user on "Click X" steps, skips a step whose target is
// missing) and the built-in tours. Tours run in a scratch "Tutorial document", so they never touch the user's files.
// API: app.tours = { register(tour), list(), get(id), start(id, {auto, delay}) → Promise<report>, stop(), next(), back(),
//   active(), isDone(id), markDone(id), resetDone(), tutorialText }
// Tour: {id, title, minutes, description, icon, doc (default true), mode ('word'), steps:[Step], cleanup(ctx)}
// Step: {target (selector list or fn → Element), title, text (short, may hold <kbd>/<b>), place ('bottom'|'top'|'right'|'left'|'center'),
//   before(ctx), click (clicking the target counts as doing it), until(ctx) → bool (wait for the user; Next hides), perform(ctx, el)
//   (what "Do it for me" and auto mode do; default: click the target), pad}
// Settings: toursDone {id: date}. Events: tour:started, tour:step, tour:ended. The first-start offer is the Welcome screen
// (src/welcome.js), whose "Show me" buttons and "Take the 2-minute tour" start these tours.
(function () {
  'use strict';
  const app = window.app, mk = window.mk;
  if (!app || !mk) return;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- the practice document ----------
  const TUTORIAL_TEXT = [
    '# Tutorial document',
    '',
    'This is a practice page. Try anything here: it is never saved, and it closes when the tutorial ends.',
    '',
    '## Writing',
    '',
    'Markooj keeps your words as plain Markdown, so any program can open them. Select a word and press Ctrl+B to make it **bold**.',
    '',
    '## An equation',
    '',
    'The energy of a body at rest is given in @eq:energy.',
    '',
    '$$ E = mc^2 $$ {#eq:energy}',
    '',
    '## A table',
    '',
    '| Sample | Mass (g) | Time (s) |',
    '|---|---:|---:|',
    '| A | 12.5 | 3.1 |',
    '| B | 9.8 | 2.7 |',
    '',
    ': Results of the first run {#tbl:results}',
    '',
    '## Python',
    '',
    '```python',
    'masses = [12.5, 9.8]',
    'print(sum(masses))',
    '```',
    '',
    '## Urdu',
    '',
    '::: {dir="rtl"}',
    'اردو میں لکھنا بھی آسان ہے۔',
    ':::',
    '',
  ].join('\n');
  /** The practice document in the interface language (headings and sentences; the Markdown, the equation, the code and the Urdu line stay). */
  function tutorialText() {
    const cell = s => s.replace(/\|/g, '/');
    return [
      '# ' + cell(app.t('Tutorial document')),
      '',
      cell(app.t('This is a practice page. Try anything here: it is never saved, and it closes when the tutorial ends.')),
      '',
      '## ' + cell(app.t('Writing@@heading')),
      '',
      cell(app.t('Markooj keeps your words as plain Markdown, so any program can open them. Select a word and press Ctrl+B to make it **bold**.')),
      '',
      '## ' + cell(app.t('An equation')),
      '',
      cell(app.t('The energy of a body at rest is given in @eq:energy.')),
      '',
      '$$ E = mc^2 $$ {#eq:energy}',
      '',
      '## ' + cell(app.t('A table')),
      '',
      `| ${cell(app.t('Sample'))} | ${cell(app.t('Mass (g)'))} | ${cell(app.t('Time (s)'))} |`,
      '|---|---:|---:|',
      '| A | 12.5 | 3.1 |',
      '| B | 9.8 | 2.7 |',
      '',
      `: ${cell(app.t('Results of the first run'))} {#tbl:results}`,
      '',
      '## Python',
      '',
      '```python',
      'masses = [12.5, 9.8]',
      'print(sum(masses))',
      '```',
      '',
      '## ' + cell(app.t('Urdu')),
      '',
      '::: {dir="rtl"}',
      'اردو میں لکھنا بھی آسان ہے۔',
      ':::',
      '',
    ].join('\n');
  }

  // ---------- registry and progress ----------
  const tours = new Map();
  function register(t) {
    if (!t || !t.id || !Array.isArray(t.steps)) return null;
    tours.set(t.id, { minutes: 1, doc: true, mode: 'word', ...t });
    app.events.emit('tours:changed');
    return t.id;
  }
  const list = () => [...tours.values()].map(t => ({ id: t.id, title: t.title, minutes: t.minutes, description: t.description || '', icon: t.icon || null, steps: t.steps.length }));
  const doneMap = () => { const d = app.settings.get('toursDone', {}); return d && typeof d === 'object' ? d : {}; };
  const isDone = id => !!doneMap()[id];
  function markDone(id) { app.settings.set('toursDone', { ...doneMap(), [id]: new Date().toISOString().slice(0, 10) }); }
  function resetDone() { app.settings.set('toursDone', {}); }

  // ---------- helpers the steps use ----------
  const visible = el => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  function resolve(spec, ctx) {
    if (!spec) return null;
    if (typeof spec === 'function') { try { const e = spec(ctx); return visible(e) ? e : null; } catch { return null; } }
    for (const sel of String(spec).split(/\s*\|\|\s*/)) {
      let found = null;
      try { found = $$(sel).find(visible); } catch {}
      if (found) return found;
    }
    return null;
  }
  async function waitFor(fn, ms = 2500, every = 60) {
    const end = Date.now() + ms;
    for (;;) {
      let v = null; try { v = await fn(); } catch {}
      if (v) return v;
      if (Date.now() > end) return null;
      await sleep(every);
    }
  }
  const activeTab = () => $('#ribbon .rtab.on')?.dataset.tab || null;
  const bsOpen = () => !!$('#backstage.show');
  const ribbonDisplay = () => { try { return app.shell?.ribbonDisplay?.() || 'pinned'; } catch { return 'pinned'; } };
  const setRibbon = k => { try { app.shell?.setRibbonDisplay?.(k); } catch {} };
  const tabSel = id => `#ribbon .rtab[data-tab="${id}"]`;
  const cmdSel = id => `#ribbon .panel.on [data-tip-cmd="${id}"]`;

  function makeCtx(tour) {
    const saved = {
      mode: app.mode, tab: activeTab(), ribbon: ribbonDisplay(), docId: app.docs.active()?.id || null,
      pane: !!(app.writing?.pane?.view), tabSetting: app.settings.get('ribbonTab', null),
    };
    const ctx = {
      tour, saved, doc: null,
      async useDoc() {
        if (ctx.doc && app.docs.get?.(ctx.doc.id)) { if (app.docs.active()?.id !== ctx.doc.id) { app.docs.activate(ctx.doc.id); await sleep(400); } return ctx.doc; }
        ctx.doc = app.docs.create({ title: app.t('Tutorial document'), text: tutorialText() });
        ctx.doc.tutorial = true;
        await waitFor(() => $('#editorHost .mk-page, #editorHost textarea'), 3000);
        await sleep(S?.auto ? 250 : 450);
        return ctx.doc;
      },
      tab(id) { if (activeTab() !== id) { try { app.shell?.selectTab?.(id); } catch {} } },
      async mode(m) {
        if (app.mode !== m) app.setMode(m);
        await waitFor(() => document.body.classList.contains('mode-' + m), 2000);
        await sleep(S?.auto || reduceMotion() ? 180 : 420);
      },
      openBackstage(page) { if (!bsOpen()) app.backstage.open(page); else if (page) app.backstage.open(page); },
      closeBackstage() { if (bsOpen()) app.backstage.close(); },
      ribbon: setRibbon,
      ribbonDisplay,
    };
    return ctx;
  }
  async function restore(ctx) {
    const s = ctx.saved;
    try { if (app.keytips?.active?.()) app.keytips.stop(); } catch {}
    try { ctx.closeBackstage(); } catch {}
    try { if (!s.pane && app.writing?.pane?.view) app.writing.pane.close(); } catch {}
    try { if (ribbonDisplay() !== s.ribbon) setRibbon(s.ribbon); } catch {}
    try { await ctx.tour.cleanup?.(ctx); } catch (e) { console.warn('tour cleanup', e); }
    if (ctx.doc && !ctx.lent) {
      const d = ctx.doc;
      try { await app.docs.close(d.id, { force: true }); } catch {}
      // the practice document leaves nothing in File → Recover
      setTimeout(() => mk.invoke('recovery-delete', d.recoveryId).catch(() => {}), 300);
      if (s.docId && app.docs.get?.(s.docId)) { try { app.docs.activate(s.docId); } catch {} }
    }
    try { if (s.mode && app.mode !== s.mode) app.setMode(s.mode); } catch {}
    try { if (s.tab) app.shell?.selectTab?.(s.tab); } catch {}
    // the tab the user last picked is remembered; clicks during the tour do not change it
    try { if (app.settings.get('ribbonTab', null) !== s.tabSetting && s.tabSetting != null) app.settings.set('ribbonTab', s.tabSetting); } catch {}
  }

  // =====================================================================
  //  Engine
  // =====================================================================
  let S = null; // the running tour
  let layer = null, spot = null, card = null, blocks = null;

  function buildLayer() {
    layer = document.createElement('div');
    layer.className = 'mkt-layer';
    layer.setAttribute('data-mk-keys', 'own');
    blocks = ['t', 'r', 'b', 'l'].map(side => { const b = document.createElement('div'); b.className = 'mkt-block ' + side; b.addEventListener('mousedown', blocked); return b; });
    spot = document.createElement('div'); spot.className = 'mkt-spot';
    card = document.createElement('div'); card.className = 'mkt-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'polite');
    layer.append(...blocks, spot, card);
    document.body.append(layer);
    // a hidden smoke-test window does not run transitions: show the layer at once there
    if (window.__mkSmokeStarted) layer.classList.add('instant', 'show');
    const l = layer; void l.offsetWidth; setTimeout(() => l.classList.add('show'), 16);
  }
  function blocked(e) {
    e.preventDefault(); e.stopPropagation();
    if (!card) return;
    card.classList.remove('nudge'); void card.offsetWidth; card.classList.add('nudge');
  }
  function removeLayer() {
    const l = layer; layer = null; spot = null; card = null; blocks = null;
    if (!l) return;
    l.classList.remove('show');
    setTimeout(() => l.remove(), 220);
  }

  async function start(id, opts = {}) {
    const tour = tours.get(id);
    if (!tour) { app.ui.toast?.(app.t('Pick a tutorial from Help → Tutorials. This one is not in this copy of Markooj.'), { kind: 'warn', actions: [{ label: app.t('Open Tutorials'), run: () => app.commands.run('help.tutorials') }] }); return null; }
    if (S) await stop();
    try { app.help?.close?.(); } catch {}
    try { if (bsOpen()) app.backstage.close(); } catch {}
    const report = { id, title: tour.title, steps: tour.steps.length, shown: 0, missing: [], waited: [], finished: false };
    let resolveDone;
    const done = new Promise(r => { resolveDone = r; });
    S = { tour, i: -1, auto: !!opts.auto, delay: opts.delay ?? 90, report, ctx: makeCtx(tour), seq: 0, dir: 1, off: [], resolveDone, stopped: false };
    const run = S;
    buildLayer();
    document.addEventListener('keydown', onKey, true);
    track();
    app.events.emit('tour:started', { id });
    try {
      if (ribbonDisplay() !== 'pinned') setRibbon('pinned');
      // a caller may lend its own practice document (the smoke test runs every tour in one)
      if (opts.doc && tour.doc !== false) { run.ctx.doc = opts.doc; run.ctx.lent = true; await run.ctx.useDoc(); }
      else if (tour.doc !== false) await run.ctx.useDoc();
      if (tour.mode) await run.ctx.mode(tour.mode);
    } catch (e) { console.warn('tour setup', e); }
    if (run.stopped) return done;
    if (run.auto) runAuto(run);
    else await show(0);
    return done;
  }

  async function runAuto(run) {
    const steps = run.tour.steps;
    for (let i = 0; i < steps.length; i++) {
      if (run.stopped) return;
      const target = await show(i, { auto: true });
      if (run.stopped) return;
      await sleep(run.delay);
      const st = steps[i];
      if (st.click || st.until || st.perform) {
        await doIt(st, target);
        if (st.until && !(await waitFor(() => st.until(run.ctx), 4000, 40))) run.report.waited.push(`${i + 1}. ${stepText(st, 'title')}`);
        await sleep(60);
      }
    }
    finish(true);
  }

  async function doIt(st, target) {
    if (!S) return;
    try {
      if (st.perform) await st.perform(S.ctx, target);
      else if (target) target.click();
    } catch (e) { console.warn('tour action', e); }
  }

  /** Show step i. Returns its target (or null). */
  async function show(i, o = {}) {
    if (!S) return null;
    const run = S;
    const seq = ++run.seq;
    const steps = run.tour.steps;
    if (i < 0) i = 0;
    if (i >= steps.length) { finish(true); return null; }
    disarm();
    run.i = i;
    const st = steps[i];
    try { await st.before?.(run.ctx); } catch (e) { console.warn('tour step', e); }
    if (seq !== run.seq || run.stopped) return null;
    let target = null;
    if (st.target) {
      target = await waitFor(() => resolve(st.target, run.ctx), st.wait ?? 2500);
      if (seq !== run.seq || run.stopped) return null;
      if (!target) {
        run.report.missing.push(`${i + 1}. ${stepText(st, 'title')} (${typeof st.target === 'string' ? st.target : 'target'})`);
        if (!o.auto) {
          // skip gracefully: on to the next step in the direction the user was going
          const n = i + run.dir;
          if (n >= 0 && n < steps.length) return show(n);
          finish(n >= steps.length); return null;
        }
      }
    }
    if (target) { try { target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch {} }
    run.report.shown++;
    run.target = target; run.targetSpec = st.target;
    renderCard(st, i, steps.length, !!target);
    place(true);
    if (!o.auto) arm(st, target);
    app.events.emit('tour:step', { id: run.tour.id, index: i, title: stepText(st, 'title'), target: !!target });
    return target;
  }

  // A step's title, text or hint in the interface language. Steps hold English keys (app.tm); `vars` fill {name} with a
  // tab, mode or page name, which is translated too. `html` gives text that may hold <kbd>/<b>/<code> (from the catalog).
  function stepVars(st) { return st.vars ? Object.fromEntries(Object.entries(st.vars).map(([k, v]) => [k, app.t(v)])) : undefined; }
  function stepText(st, key, html) { const v = st[key]; if (!v) return ''; return html ? app.th(v, stepVars(st)) : app.t(v, stepVars(st)); }

  function renderCard(st, i, n, hasTarget) {
    const run = S;
    const waits = !!(st.click || st.until);
    const last = i === n - 1;
    card.className = 'mkt-card' + (hasTarget ? '' : ' center') + (waits ? ' waits' : '');
    const tid = 'mkt-t-' + run.seq;
    card.setAttribute('aria-labelledby', tid);
    card.innerHTML = `
      <div class="mkt-head"><span class="mkt-count">${app.th('{tour} · {step} of {count}', { tour: app.t(run.tour.title), step: i + 1, count: n })}</span>
        <button type="button" class="mkt-x" aria-label="${app.th('Close tutorial')}" data-tip="${app.th('Close tutorial')}" data-tip-d="${app.th('You can start it again from Help → Tutorials.')}" data-key="Escape"><svg class="i" aria-hidden="true"><use href="#mkh-i-x"/></svg></button></div>
      <h4 id="${tid}">${esc(stepText(st, 'title'))}</h4>
      <p>${stepText(st, 'text', true)}</p>
      ${waits ? `<div class="mkt-wait"><span class="mkt-pulse" aria-hidden="true"></span><span>${esc(st.hint ? stepText(st, 'hint') : app.t('Waiting for you to do it.'))}</span><button type="button" class="mkt-doit">${app.th('Do it for me')}</button></div>` : ''}
      <div class="mkt-foot"><div class="mkt-dots" aria-hidden="true">${Array.from({ length: n }, (_, k) => `<i class="${k < i ? 'past' : k === i ? 'on' : ''}"></i>`).join('')}</div>
        ${i > 0 ? `<button type="button" class="btn sm mkt-back">${app.th('Back')}</button>` : ''}
        ${waits ? '' : `<button type="button" class="btn sm primary mkt-next">${last ? app.th('Done') : app.th('Next')}</button>`}</div>`;
    card.querySelector('.mkt-x').addEventListener('click', () => stop());
    card.querySelector('.mkt-back')?.addEventListener('click', () => back());
    card.querySelector('.mkt-next')?.addEventListener('click', () => next());
    card.querySelector('.mkt-doit')?.addEventListener('click', async () => {
      await doIt(st, run.target);
      const ok = await waitFor(() => !st.until || st.until(run.ctx), 3000);
      if (ok && S === run && run.i === i) setTimeout(() => { if (S === run && run.i === i) next(); }, 250);
    });
    card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
    if (!run.auto) setTimeout(() => { if (S !== run) return; const f = card.querySelector('.mkt-next') || card.querySelector('.mkt-doit'); try { f?.focus({ preventScroll: true }); } catch {} }, 60);
  }

  // wait for the user: a click on the target, or the step's condition coming true
  function arm(st, target) {
    const run = S;
    const i = run.i;
    const go = () => { if (S === run && run.i === i) { disarm(); setTimeout(() => { if (S === run && run.i === i) next(); }, 280); } };
    // a tab or mode that is already on still waits for the click (the step would flash past otherwise)
    let already = false;
    if (st.click && st.until) { try { already = !!st.until(run.ctx); } catch {} }
    if (st.click && target && (!st.until || already)) {
      const onClick = e => { const t = run.target; if (t && (t === e.target || t.contains(e.target))) go(); };
      document.addEventListener('click', onClick, true);
      run.off.push(() => document.removeEventListener('click', onClick, true));
    }
    if (st.until && !already) {
      const iv = setInterval(() => { let ok = false; try { ok = st.until(run.ctx); } catch {} if (ok) go(); }, 150);
      run.off.push(() => clearInterval(iv));
    }
  }
  function disarm() { if (!S) return; for (const f of S.off.splice(0)) { try { f(); } catch {} } }

  function next() { if (!S) return; S.dir = 1; if (S.i >= S.tour.steps.length - 1) finish(true); else show(S.i + 1); }
  function back() { if (!S || S.i <= 0) return; S.dir = -1; show(S.i - 1); }
  async function stop() { if (S) await finish(false); }

  async function finish(completed) {
    const run = S;
    if (!run || run.stopped) return;
    run.stopped = true;
    disarm();
    S = null;
    document.removeEventListener('keydown', onKey, true);
    cancelAnimationFrame(trackId);
    removeLayer();
    run.report.finished = !!completed;
    await restore(run.ctx);
    if (completed && !run.auto) {
      markDone(run.tour.id);
      const nextTour = list().find(t => !isDone(t.id));
      app.ui.toast?.(app.t('Tutorial done: {title}.', { title: app.t(run.tour.title) }), nextTour ? { kind: 'success', timeout: 8000, actions: [{ label: app.t('More Tutorials'), run: () => app.commands.run('help.tutorials') }] } : { kind: 'success' });
    }
    app.events.emit('tour:ended', { id: run.tour.id, completed: !!completed });
    run.resolveDone(run.report);
  }

  function onKey(e) {
    if (!S) return;
    if (e.key === 'Escape') {
      if (app.keytips?.active?.()) return; // Esc belongs to KeyTips while their letters show
      e.preventDefault(); e.stopPropagation();
      stop(); return;
    }
    if (!card || !card.contains(document.activeElement)) return;
    if (e.key === 'ArrowRight' && card.querySelector('.mkt-next')) { e.preventDefault(); e.stopPropagation(); next(); }
    else if (e.key === 'ArrowLeft' && card.querySelector('.mkt-back')) { e.preventDefault(); e.stopPropagation(); back(); }
    else if (e.key === 'Tab') {
      const f = $$('button', card).filter(b => b.offsetParent);
      if (!f.length) return;
      // Tab stays in the card; the highlighted control is reached with "Do it for me" or the mouse
      e.preventDefault(); e.stopPropagation();
      const k = f.indexOf(document.activeElement);
      f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  }

  // ---------- placement: spotlight, blockers and card follow the target every frame ----------
  let trackId = 0, lastSig = '';
  function track() {
    cancelAnimationFrame(trackId);
    const tick = () => { if (!S) return; place(false); trackId = requestAnimationFrame(tick); };
    trackId = requestAnimationFrame(tick);
  }
  function place(force) {
    if (!S || !spot || !card) return;
    let t = S.target;
    if (t && !visible(t) && S.targetSpec) { const again = resolve(S.targetSpec, S.ctx); if (again) S.target = t = again; }
    const vw = innerWidth, vh = innerHeight;
    const st = S.tour.steps[S.i] || {};
    const pad = st.pad ?? 6;
    let r = null;
    if (t && visible(t)) { const b = t.getBoundingClientRect(); r = { x: Math.max(4, b.left - pad), y: Math.max(4, b.top - pad), r: Math.min(vw - 4, b.right + pad), b: Math.min(vh - 4, b.bottom + pad) }; }
    const sig = r ? `${r.x|0},${r.y|0},${r.r|0},${r.b|0},${vw},${vh},${card.offsetHeight}` : `c,${vw},${vh},${card.offsetHeight}`;
    if (!force && sig === lastSig) return;
    lastSig = sig;
    if (r) {
      spot.classList.remove('none');
      Object.assign(spot.style, { left: r.x + 'px', top: r.y + 'px', width: (r.r - r.x) + 'px', height: (r.b - r.y) + 'px' });
      const [bt, br, bb, bl] = blocks;
      Object.assign(bt.style, { left: '0', top: '0', width: vw + 'px', height: r.y + 'px' });
      Object.assign(bb.style, { left: '0', top: r.b + 'px', width: vw + 'px', height: Math.max(0, vh - r.b) + 'px' });
      Object.assign(bl.style, { left: '0', top: r.y + 'px', width: r.x + 'px', height: (r.b - r.y) + 'px' });
      Object.assign(br.style, { left: r.r + 'px', top: r.y + 'px', width: Math.max(0, vw - r.r) + 'px', height: (r.b - r.y) + 'px' });
    } else {
      spot.classList.add('none');
      Object.assign(spot.style, { left: vw / 2 + 'px', top: vh / 2 + 'px', width: '0px', height: '0px' });
      const [bt, br, bb, bl] = blocks;
      Object.assign(bt.style, { left: '0', top: '0', width: vw + 'px', height: vh + 'px' });
      for (const b of [br, bb, bl]) Object.assign(b.style, { width: '0px', height: '0px' });
    }
    placeCard(r, st.place);
  }
  function placeCard(r, pref) {
    const vw = innerWidth, vh = innerHeight, m = 12, gap = 12;
    const w = card.offsetWidth, ht = card.offsetHeight;
    let x, y, side = 'center';
    if (r && pref !== 'center') {
      const order = [pref, 'bottom', 'top', 'right', 'left'].filter((v, k, a) => v && a.indexOf(v) === k);
      const cx = (r.x + r.r) / 2, cy = (r.y + r.b) / 2;
      const fits = s => s === 'bottom' ? r.b + gap + ht <= vh - m : s === 'top' ? r.y - gap - ht >= m : s === 'right' ? r.r + gap + w <= vw - m : r.x - gap - w >= m;
      side = order.find(fits) || 'inside';
      if (side === 'bottom') { x = cx - w / 2; y = r.b + gap; }
      else if (side === 'top') { x = cx - w / 2; y = r.y - gap - ht; }
      else if (side === 'right') { x = r.r + gap; y = cy - ht / 2; }
      else if (side === 'left') { x = r.x - gap - w; y = cy - ht / 2; }
      else { x = Math.min(r.r, vw) - w - 24; y = Math.min(r.b, vh) - ht - 24; } // a big target: the card sits inside its lower-right corner
    } else { x = (vw - w) / 2; y = Math.max(m, (vh - ht) / 2 - 40); }
    x = Math.max(m, Math.min(x, vw - w - m)); y = Math.max(m, Math.min(y, vh - ht - m));
    card.style.left = Math.round(x) + 'px'; card.style.top = Math.round(y) + 'px';
    card.dataset.side = side;
  }
  addEventListener('resize', () => { lastSig = ''; });
  // the interface language changed during a tour: draw the card again in the new language
  app.events.on('i18n:changed', () => {
    if (!S || !card || S.i < 0) return;
    const st = S.tour.steps[S.i];
    if (!st) return;
    renderCard(st, S.i, S.tour.steps.length, !!S.target);
    lastSig = ''; place(true);
  });

  // =====================================================================
  //  The tours
  // =====================================================================
  const tabStep = (id, name, text) => ({ target: tabSel(id), title: app.tm('Click {name}'), vars: { name }, text, click: true, until: () => activeTab() === id, hint: app.tm('Click the {name} tab.'), perform: () => app.shell?.selectTab?.(id) });
  const modeStep = (m, name, text) => ({ target: `#modeSeg [data-tip-cmd="view.mode${m[0].toUpperCase() + m.slice(1)}"]`, title: app.tm('Try {name} mode'), vars: { name }, text, click: true, until: () => app.mode === m && document.body.classList.contains('mode-' + m), hint: app.tm('Click {name} at the top right.'), perform: () => app.setMode(m) });
  const inTab = (id, step) => ({ ...step, before: async ctx => { ctx.closeBackstage(); ctx.tab(id); await sleep(80); await step.before?.(ctx); } });
  const onPage = step => ({ ...step, before: async ctx => { ctx.closeBackstage(); await step.before?.(ctx); } });
  const fileStep = { target: '#ribbon .rtab.file', title: app.tm('Open the File menu'), text: app.tm('File holds everything about the whole document.'), click: true, until: () => bsOpen(), hint: app.tm('Click File.'), before: ctx => ctx.closeBackstage(), perform: () => app.backstage.open() };
  const bsNavStep = (page, label, text) => ({ target: `#backstage .bs-nav button.n[data-page="${page}"]`, title: app.tm('Click {name}'), vars: { name: label }, text, click: true, until: () => !!$(`#backstage .bs-page[data-page="${page}"]`), hint: app.tm('Click {name} on the left.'), before: ctx => { if (!bsOpen()) ctx.openBackstage(); }, perform: () => app.backstage.open(page) });

  register({
    id: 'getting-started', title: app.tm('Getting started'), minutes: 2, icon: 'mkh-i-tour',
    description: app.tm('The ribbon, the four editing modes and saving.'),
    steps: [
      { title: app.tm('Welcome to Markooj'), text: app.tm('Markooj feels like Word but saves plain Markdown files. This is a practice document, so try anything.') },
      onPage({ target: '#ribbon .rtabs', title: app.tm('The ribbon'), text: app.tm('Commands are grouped in tabs, as in Word: Home for text, Insert for tables and pictures, References for citations.'), pad: 4 }),
      tabStep('insert', app.tm('Insert'), app.tm('See what you can add to the page.')),
      inTab('insert', { target: '#ribbon .rbody', title: app.tm('Everything you can add'), text: app.tm('Tables, pictures, diagrams, equations, footnotes and citations. Point at any button to see what it does.'), pad: 2 }),
      onPage({ target: '#modeSeg', title: app.tm('Four ways to edit'), text: app.tm('Word mode is click and type. Inline shows Markdown marks only where you type. Simple shows the Markdown next to a preview. Read is for reading.') }),
      modeStep('simple', app.tm('Simple@@editing mode'), app.tm('Click Simple to see the Markdown behind the page.')),
      { target: '#editorHost', title: app.tm('Plain text underneath'), text: app.tm('This is the file exactly as it is saved. Change it here and the preview follows.'), place: 'center', before: ctx => ctx.mode('simple') },
      modeStep('word', app.tm('Word'), app.tm('Click Word to go back to the page.')),
      { target: '#titlebar [data-cmd="file.save"] || #titlebar button[data-tip="Save"]', title: app.tm('Save'), text: app.tm('<kbd>Ctrl+S</kbd> saves the document as a .md file. Unsaved text is also kept for you in File → Recover.'), before: ctx => ctx.mode('word') },
      { target: '#titlebar .search', title: app.tm('Search for any command'), text: app.tm('Press <kbd>Alt+Q</kbd> and type what you want to do, such as “table” or “PDF”.') },
      { title: app.tm('You’re all set'), text: app.tm('Find more tutorials in Help → Tutorials. Press <kbd>F1</kbd> at any time for the reference manual.') },
    ],
  });

  register({
    id: 'modes', title: app.tm('Modes: Word, Inline, Simple, Read'), minutes: 2, icon: 'mkh-i-tour',
    description: app.tm('Four views of the same Markdown file, and when to use each.'),
    steps: [
      { target: '#modeSeg', title: app.tm('Four editing modes'), text: app.tm('The same file, four ways. Switch with these buttons or <kbd>Ctrl+1</kbd> to <kbd>Ctrl+4</kbd>.'), before: ctx => ctx.mode('word') },
      modeStep('inline', app.tm('Inline@@editing mode'), app.tm('Markdown marks such as ** appear only in the line you are typing.')),
      { target: '#editorHost', title: app.tm('Inline mode'), text: app.tm('Click a bold word and its ** marks show. Move away and they hide again.'), place: 'center', before: ctx => ctx.mode('inline') },
      modeStep('simple', app.tm('Simple@@editing mode'), app.tm('The Markdown file on the left, the finished look on the right.')),
      { target: '#editorHost', title: app.tm('Simple mode'), text: app.tm('Best for tables, code and anything you want to type exactly.'), place: 'center', before: ctx => ctx.mode('simple') },
      modeStep('read', app.tm('Read@@editing mode'), app.tm('A clean page for reading and checking.')),
      { target: '#editorHost', title: app.tm('Read mode'), text: app.tm('Nothing can change by accident here. Press <kbd>Esc</kbd> to go back to editing.'), place: 'center', before: ctx => ctx.mode('read') },
      modeStep('word', app.tm('Word'), app.tm('Word mode: click and type on the page, like Word.')),
      { title: app.tm('Same file in every mode'), text: app.tm('Switching modes never changes your text. Pick the one that suits the task.') },
    ],
  });

  register({
    id: 'macro', title: app.tm('Record a macro'), minutes: 2, icon: 'mkh-i-tour',
    description: app.tm('Record steps once, then repeat them with one click.'),
    steps: [
      tabStep('developer', app.tm('Developer'), app.tm('Macros live on the Developer tab.')),
      inTab('developer', { target: cmdSel('dev.record'), title: app.tm('Record'), text: app.tm('Click Record, then do the steps you want to repeat: type, format, insert. Markooj writes them down as a Python macro.') }),
      inTab('developer', { target: cmdSel('dev.record'), title: app.tm('Stop and name it'), text: app.tm('Click Record again, or Stop in the status bar, when you are done. Then give the macro a name.') }),
      inTab('developer', { target: cmdSel('dev.macros'), title: app.tm('Run it later'), text: app.tm('<kbd>Alt+F8</kbd> lists your macros. Double-click one to run it on the open document.') }),
      inTab('developer', { target: cmdSel('dev.editor'), title: app.tm('See the steps'), text: app.tm('The Macro editor (<kbd>Alt+F11</kbd>) shows what was recorded. You can change it or give it a shortcut.') }),
    ],
  });

  register({
    id: 'python', title: app.tm('Run Python code'), minutes: 2, icon: 'mkh-i-tour',
    description: app.tm('Run code blocks and use the Python console, offline.'),
    steps: [
      onPage({ target: '#editorHost pre', title: app.tm('Python in your document'), text: app.tm('A code block marked python can run right here. Python runs inside Markooj; nothing leaves your computer.') }),
      tabStep('developer', app.tm('Developer'), app.tm('The Python commands are on the Developer tab.')),
      inTab('developer', { target: cmdSel('dev.runSelection'), title: app.tm('Run the code'), text: app.tm('Click inside a code block and press <kbd>Ctrl+Alt+Enter</kbd>. The output appears below it.') }),
      inTab('developer', { target: cmdSel('dev.pythonConsole'), title: app.tm('Python console'), text: app.tm('<kbd>Ctrl+Alt+P</kbd> opens a console for trying code. The first start takes a few seconds while Python loads.') }),
    ],
  });

  register({
    id: 'js-macro', title: app.tm('Write a JavaScript macro'), minutes: 2, icon: 'mkh-i-tour',
    description: app.tm('Automate Markooj with a few lines of JavaScript.'),
    steps: [
      tabStep('developer', app.tm('Developer'), app.tm('The Macro editor is on the Developer tab.')),
      inTab('developer', { target: cmdSel('dev.editor'), title: app.tm('Open the Macro editor'), text: app.tm('Click Editor or press <kbd>Alt+F11</kbd>. Choose JavaScript as the language of a new macro.') }),
      inTab('developer', { target: cmdSel('dev.editor'), title: app.tm('Use the app object'), text: app.tm('For example, <code>app.commands.run("format.bold")</code> makes the selection bold, and <code>app.docs.active().text</code> is the whole document.') }),
      inTab('developer', { target: cmdSel('dev.macros'), title: app.tm('Run and share'), text: app.tm('Run it from Macros, give it a shortcut, or add it to the ribbon. The manual lists every command you can use.') }),
    ],
  });

  register({
    id: 'equations', title: app.tm('Equations and numbering'), minutes: 2, icon: 'mkh-i-tour',
    description: app.tm('Insert equations and let Markooj number them.'),
    steps: [
      tabStep('insert', app.tm('Insert'), app.tm('Equations are on the Insert tab.')),
      inTab('insert', { target: cmdSel('insert.equation'), title: app.tm('Insert an equation'), text: app.tm('Click Equation or press <kbd>Alt+=</kbd>. Type LaTeX or use the palettes, and choose Numbered for a number.') }),
      onPage({ target: '#editorHost .mk-math-block', title: app.tm('Numbers on the right'), text: app.tm('Numbered equations count up by themselves. Double-click an equation to change it.'), before: ctx => ctx.mode('word') }),
      tabStep('references', app.tm('References'), app.tm('Numbering options are on the References tab.')),
      inTab('references', { target: cmdSel('xref.numbering'), title: app.tm('Numbering style'), text: app.tm('Plain numbers (1, 2, 3) or by chapter (2.1, 2.2), for equations, figures and tables.') }),
      inTab('references', { target: cmdSel('xref.update'), title: app.tm('Update numbers'), text: app.tm('<kbd>F9</kbd> updates every number and reference, as in Word.') }),
    ],
  });

  register({
    id: 'crossref', title: app.tm('Cross-references'), minutes: 2, icon: 'mkh-i-tour',
    description: app.tm('Refer to equations, figures and tables that renumber themselves.'),
    steps: [
      onPage({ target: '#editorHost .mk-xref', title: app.tm('A cross-reference'), text: app.tm('This shows the equation’s number. In the file it is written as @eq:energy, so it stays right when numbers change.'), before: ctx => ctx.mode('word') }),
      tabStep('references', app.tm('References'), app.tm('Captions and cross-references are on the References tab.')),
      inTab('references', { target: cmdSel('xref.caption'), title: app.tm('Insert a caption'), text: app.tm('Select a picture, table or equation and click Insert Caption (<kbd>Ctrl+Alt+Shift+C</kbd>). It gets a label like fig:map.') }),
      inTab('references', { target: cmdSel('xref.crossref'), title: app.tm('Insert a cross-reference'), text: app.tm('Click Cross-reference or press <kbd>Ctrl+Alt+R</kbd>, then pick the item. The page shows “Figure 1”.') }),
      { title: app.tm('Numbers stay right'), text: app.tm('Move or delete an item and every reference to it updates. Hover a reference to preview what it points to.') },
    ],
  });

  register({
    id: 'citations', title: app.tm('Citations from a BibTeX library'), minutes: 2, icon: 'mkh-i-tour',
    description: app.tm('Cite from Zotero, Mendeley or JabRef, and let the bibliography build itself.'),
    steps: [
      tabStep('references', app.tm('References'), app.tm('Citations are on the References tab.')),
      inTab('references', { target: cmdSel('ref.library'), title: app.tm('Choose your library'), text: app.tm('Click Library and pick a BibTeX (.bib) file. Zotero, Mendeley, JabRef and EndNote can all export one.') }),
      inTab('references', { target: cmdSel('ref.cite'), title: app.tm('Cite a source'), text: app.tm('Click Cite or press <kbd>Ctrl+Shift+C</kbd>, type part of an author or a title, and press Enter. The page shows the citation in your style.') }),
      inTab('references', { target: cmdSel('ref.bibliography'), title: app.tm('The bibliography'), text: app.tm('Click Bibliography to list every source you cited at the end. The list updates as you cite.') }),
      { title: app.tm('Right in every format'), text: app.tm('Pick APA, Chicago or IEEE under Citation style. Word, PDF and LaTeX exports format the citations for you.') },
    ],
  });

  register({
    id: 'tables', title: app.tm('Tables like Word'), minutes: 2, icon: 'mkh-i-tour',
    description: app.tm('Insert a table, type in its cells and use the Table tabs.'),
    steps: [
      tabStep('insert', app.tm('Insert'), app.tm('Tables are on the Insert tab.')),
      inTab('insert', { target: cmdSel('insert.table'), title: app.tm('Insert a table'), text: app.tm('Click Table and move over the grid to pick rows and columns, as in Word.') }),
      onPage({
        target: '#editorHost .mk-page table td', title: app.tm('Click in a cell'), text: app.tm('Click any cell of the table on the page.'), hint: app.tm('Click in a table cell.'), click: true, place: 'bottom',
        before: ctx => ctx.mode('word'), until: () => !!app.ribbon.isContextualShown?.('tableLayout'),
        perform: async (_ctx, td) => {
          const page = td.closest('[contenteditable="true"]') || td.closest('.mk-page');
          try { page?.focus({ preventScroll: true }); } catch {}
          const r = document.createRange(); r.selectNodeContents(td); r.collapse(true);
          const s = getSelection(); s.removeAllRanges(); s.addRange(r);
          td.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          document.dispatchEvent(new Event('selectionchange'));
        },
      }),
      { target: tabSel('tableLayout'), title: app.tm('Click Table Layout'), text: app.tm('This tab shows up while you are in a table, as in Word.'), wait: 1500, click: true, hint: app.tm('Click Table Layout.'), until: () => activeTab() === 'tableLayout', perform: () => app.shell?.selectTab?.('tableLayout') },
      { target: '#ribbon .rbody', title: app.tm('Table tools'), text: app.tm('Insert rows and columns, delete, align and sort. Table Design next to it has styles and the header row.'), pad: 2, before: ctx => { if (app.ribbon.isContextualShown?.('tableLayout')) ctx.tab('tableLayout'); } },
      { target: '#editorHost .mk-page table', title: app.tm('Move with Tab'), text: app.tm('<kbd>Tab</kbd> goes to the next cell; in the last cell it adds a row. The table is saved as a plain Markdown table.') },
    ],
  });

  register({
    id: 'writing', title: app.tm('Writing Assistant'), minutes: 2, icon: 'mkh-i-tour',
    description: app.tm('Spelling, grammar and style suggestions with an explanation for each.'),
    steps: [
      tabStep('review', app.tm('Review'), app.tm('The Writing Assistant is on the Review tab.')),
      inTab('review', { target: cmdSel('review.writingAssistant'), title: app.tm('Open the Writing Assistant'), text: app.tm('Click Writing Assistant to see suggestions for this document.'), click: true, hint: app.tm('Click Writing Assistant.'), until: () => !!app.writing?.pane?.view || visible($('#mkwPane')) }),
      { target: '#mkwPane', title: app.tm('Suggestions'), text: app.tm('Each card says what to change and why. Accept a fix, dismiss it, or open Why? to learn the rule.'), place: 'left', before: async () => { if (!app.writing?.pane?.view) await app.commands.run('review.writingAssistant'); } },
      { target: '#statusbar .mkw-sb || #sbSpell', title: app.tm('Your writing score'), text: app.tm('Click it any time to open the Writing Assistant. <kbd>F7</kbd> steps through issues one by one.'), place: 'top' },
      inTab('review', { target: cmdSel('review.thesaurus'), title: app.tm('Synonyms'), text: app.tm('Double-click a word for synonyms, or press <kbd>Shift+F7</kbd> for the Thesaurus. It works offline.') }),
    ],
  });

  register({
    id: 'rtl', title: app.tm('Right-to-left languages and language packs'), minutes: 2, icon: 'mkh-i-tour',
    description: app.tm('Write Urdu, Arabic and Persian, and add spelling packs.'),
    steps: [
      tabStep('home', app.tm('Home'), app.tm('Text direction is on the Home tab, as in Word.')),
      inTab('home', { target: cmdSel('para.rtl'), title: app.tm('Right-to-left paragraphs'), text: app.tm('Click in a paragraph and use these buttons, or <kbd>Ctrl+Right Shift</kbd> and <kbd>Ctrl+Left Shift</kbd>.') }),
      onPage({ target: '#editorHost [data-mk-script] || #editorHost [dir="rtl"]', title: app.tm('Urdu, Arabic and Persian'), text: app.tm('Text in these scripts flows right to left and gets a matching font.'), before: ctx => ctx.mode('word') }),
      onPage({ target: '#sbLang || #statusbar', title: app.tm('Document language'), text: app.tm('Click to choose the language for spelling. It is saved in the file as lang.'), place: 'top' }),
      { target: '#backstage .opt-card[data-section="language"] || #backstage .bs-page', title: app.tm('Language packs'), text: app.tm('File → Options → Language downloads spelling packs for Urdu, Arabic and Persian, or installs one from a file.'), before: async () => { await app.commands.run('lang.options'); await sleep(350); } },
      { title: app.tm('Ready to write'), text: app.tm('Exports to PDF, Word and the other formats keep the right-to-left direction and fonts.'), before: ctx => ctx.closeBackstage() },
    ],
  });

  register({
    id: 'export', title: app.tm('Export and convert'), minutes: 2, icon: 'mkh-i-tour',
    description: app.tm('Save as PDF, Word, EPUB, LaTeX and more, and open Word files.'),
    steps: [
      fileStep,
      bsNavStep('saveas', app.tm('Save As / Export'), app.tm('Every format Markooj can write is here.')),
      { target: '#backstage .bs-page[data-page="saveas"]', title: app.tm('Pick a format'), text: app.tm('PDF, Word, OpenDocument, EPUB, LaTeX, HTML, DjVu and more. Your Markdown file stays as it is.'), before: () => { if (!$('#backstage .bs-page[data-page="saveas"]')) app.backstage.open('saveas'); } },
      { target: '#backstage .bs-nav button.n[data-page="open"]', title: app.tm('Convert by opening'), text: app.tm('Open a Word, OpenDocument or LaTeX file and Markooj turns it into Markdown. The original stays untouched.'), place: 'right', before: ctx => { if (!bsOpen()) ctx.openBackstage('saveas'); } },
      { title: app.tm('Print too'), text: app.tm('<kbd>Ctrl+P</kbd> prints with the same page layout as the PDF.'), before: ctx => ctx.closeBackstage() },
    ],
  });

  register({
    id: 'recover', title: app.tm('Recover unsaved text'), minutes: 1, icon: 'mkh-i-tour',
    description: app.tm('Get back text from a closed tab or a crash.'),
    steps: [
      fileStep,
      bsNavStep('recover', app.tm('Recover'), app.tm('Markooj keeps copies of text you did not save.')),
      { target: '#backstage .bs-page[data-page="recover"]', title: app.tm('Pick one to open'), text: app.tm('Copies from closed tabs and crashes are listed here, newest first. They are kept for 7 days; change that in Options.'), before: () => { if (!$('#backstage .bs-page[data-page="recover"]')) app.backstage.open('recover'); } },
      { title: app.tm('Nothing is lost'), text: app.tm('Even “Don’t Save” keeps a copy here, so you can change your mind.'), before: ctx => ctx.closeBackstage() },
    ],
  });

  register({
    id: 'ribbon', title: app.tm('Pin or unpin the ribbon'), minutes: 1, icon: 'mkh-i-tour', doc: false, mode: null,
    description: app.tm('Show the full ribbon, tabs only, or hide it for more room.'),
    steps: [
      { target: '#ribbon .rt-collapse || #ribbon .rdisp', title: app.tm('Ribbon display options'), text: app.tm('Show tabs and commands, Show tabs only, or Full-screen mode, as in Word.'), before: ctx => { if (ctx.ribbonDisplay() !== 'pinned') ctx.ribbon('pinned'); } },
      { target: '#ribbon .rtabs', title: app.tm('Hide the commands'), text: app.tm('Press <kbd>Ctrl+F1</kbd>, or double-click any tab.'), hint: app.tm('Press Ctrl+F1 or double-click a tab.'), until: ctx => ctx.ribbonDisplay() === 'tabs', perform: ctx => ctx.ribbon('tabs'), before: ctx => { if (ctx.ribbonDisplay() === 'full') ctx.ribbon('pinned'); } },
      { target: tabSel('home'), title: app.tm('Tabs only'), text: app.tm('Click a tab to drop its commands over the page. They hide again after you use one.'), before: ctx => { if (ctx.ribbonDisplay() !== 'tabs') ctx.ribbon('tabs'); } },
      { target: '#ribbon .rtabs', title: app.tm('Pin it back'), text: app.tm('Press <kbd>Ctrl+F1</kbd> again, or click the pin on the dropped-down ribbon.'), hint: app.tm('Press Ctrl+F1 or double-click a tab.'), until: ctx => ctx.ribbonDisplay() === 'pinned', perform: ctx => ctx.ribbon('pinned') },
    ],
  });

  register({
    id: 'keys', title: app.tm('Keyboard and KeyTips'), minutes: 1, icon: 'mkh-i-tour', doc: false, mode: null,
    description: app.tm('Run any ribbon command from the keyboard, as in Word.'),
    steps: [
      { target: '#ribbon .rtabs', title: app.tm('Press Alt'), text: app.tm('Press and release Alt. Letters appear on the tabs and buttons.'), hint: app.tm('Press Alt.'), until: () => !!app.keytips?.active?.(), perform: () => app.keytips?.start?.(), before: () => { try { if (app.keytips?.active?.()) app.keytips.stop(); } catch {} } },
      { target: '#ribbon .rtabs', title: app.tm('Type a letter'), text: app.tm('H is Home, N is Insert, R is Review. A second letter runs a button. <kbd>Esc</kbd> steps back.'), before: async () => { try { if (!app.keytips?.active?.()) await app.keytips?.start?.(); } catch {} } },
      { target: '#titlebar .search', title: app.tm('Search for a command'), text: app.tm('<kbd>Alt+Q</kbd> jumps here. Type what you want to do and press Enter.'), before: () => { try { if (app.keytips?.active?.()) app.keytips.stop(); } catch {} } },
      { title: app.tm('Word’s shortcuts work'), text: app.tm('<kbd>Ctrl+B</kbd>, <kbd>Ctrl+K</kbd>, <kbd>F7</kbd> for spelling, <kbd>F12</kbd> for Save As and <kbd>F1</kbd> for Help. Help → Keyboard Shortcuts lists them all.') },
    ],
  });

  // one command per tutorial, so they can be found with Alt+Q. Their label and ScreenTip are whole sentences built from
  // the tour's title, so they are written again in the new language when the interface language changes.
  const tourCmdId = t => 'tour.' + t.id.replace(/-(\w)/g, (_, c) => c.toUpperCase());
  function tourCmdText(t) {
    return { label: app.t('Tutorial: {title}', { title: app.t(t.title) }), description: app.tn('{description} A guided tour of about {count} min.', t.minutes, { description: app.t(t.description) }) };
  }
  function localizeTourCommands() {
    for (const t of tours.values()) {
      const id = tourCmdId(t), c = app.commands.get(id);
      if (!c) continue;
      const x = tourCmdText(t);
      c.label = x.label; c.description = x.description;
      try { app.tooltips?.register?.(id, { title: x.label, description: x.description }); } catch {}
    }
  }
  for (const t of tours.values()) {
    const x = tourCmdText(t);
    app.commands.register(tourCmdId(t), { label: x.label, icon: 'mkh-i-tour', category: 'Help', description: x.description, run: () => start(t.id) });
    try { app.tooltips?.register?.(tourCmdId(t), { title: x.label, description: x.description }); } catch {}
  }
  app.events.on('i18n:changed', localizeTourCommands);
  app.commands.register('help.stopTour', { label: app.tm('Close tutorial'), hidden: true, palette: false, description: app.tm('Closes the tutorial that is running.'), run: () => stop() });

  app.tours = { register, list, get: id => tours.get(id) || null, start, stop, next, back, active: () => (S ? { id: S.tour.id, index: S.i, auto: S.auto } : null), isDone, markDone, resetDone, tutorialText: TUTORIAL_TEXT };

  // =====================================================================
  //  Smoke tests: every tour runs from start to end with all its targets found
  // =====================================================================
  const T = app.tests, A = app.assert;
  T.register('tours: the engine shows a step, waits on a click step, and Esc closes', async () => {
    const p = start('getting-started');
    await waitFor(() => $('.mkt-card h4'), 4000);
    A($('.mkt-layer') && /Welcome/.test($('.mkt-card h4').textContent), 'first card');
    next();
    await waitFor(() => /The ribbon/.test($('.mkt-card h4')?.textContent || ''), 3000);
    A(!$('.mkt-spot').classList.contains('none'), 'spotlight on the ribbon tabs');
    await sleep(1000); // the fade-in finishes (a hidden smoke window runs animations slowly)
    try { await mk.invoke('smoke-shot', 'tour'); } catch {}
    next();
    await waitFor(() => /Click Insert/.test($('.mkt-card h4')?.textContent || ''), 3000);
    A(!$('.mkt-card .mkt-next') && $('.mkt-card .mkt-doit'), 'a "Click X" step waits for the user');
    $(tabSel('insert')).click();
    await waitFor(() => /Everything you can add/.test($('.mkt-card h4')?.textContent || ''), 3000);
    A(/Everything you can add/.test($('.mkt-card h4').textContent), 'clicking the target moves on');
    document.activeElement?.blur?.();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const r = await p;
    A(!r.finished && !$('.mkt-layer.show'), 'Esc closes the tutorial');
    A(!app.docs.list().some(d => d.title === 'Tutorial document'), 'the practice document is closed');
  });
  T.register('tours: a missing target is skipped', async () => {
    register({ id: 'test-missing', title: 'Test', doc: false, mode: null, steps: [{ title: 'One', text: 'a' }, { target: '#nope-not-here', wait: 200, title: 'Two', text: 'b' }, { title: 'Three', text: 'c' }] });
    const p = start('test-missing');
    await waitFor(() => $('.mkt-card h4'), 2000);
    next();
    await waitFor(() => /Three/.test($('.mkt-card h4')?.textContent || ''), 2000);
    A(/Three/.test($('.mkt-card h4').textContent), 'jumped over the missing step');
    next();
    const r = await p;
    A(r.finished && r.missing.length === 1, 'report names the missing step');
    tours.delete('test-missing');
    const d = doneMap(); delete d['test-missing']; app.settings.set('toursDone', d);
  });
  // in parts of five, so each part stays well inside the 30 s a smoke test may take
  const builtIn = [...tours.keys()], PART = 5, parts = Math.ceil(builtIn.length / PART);
  for (let k = 0; k < parts; k++) T.register(`tours: every tutorial runs from start to end with all its targets found (part ${k + 1} of ${parts})`, async () => {
    const before = app.docs.list().length;
    // one practice document for all of them (each tour on its own makes and closes one)
    const doc = app.docs.create({ title: 'Tutorial document', text: TUTORIAL_TEXT });
    const bad = [], ribbon0 = ribbonDisplay();
    try {
      for (const t of builtIn.slice(k * PART, (k + 1) * PART).map(id => tours.get(id)).filter(Boolean)) {
        const r = await start(t.id, { auto: true, delay: 10, doc });
        if (!r || !r.finished) { bad.push(`${t.title}: did not finish`); continue; }
        if (r.missing.length) bad.push(`${t.title}: targets not found: ${r.missing.join('; ')}`);
        if (r.waited.length) bad.push(`${t.title}: actions that did not happen: ${r.waited.join('; ')}`);
        if (r.shown !== r.steps) bad.push(`${t.title}: ${r.shown} of ${r.steps} steps shown`);
        if ($('.mkt-layer.show')) bad.push(`${t.title}: overlay left on screen`);
        if (bsOpen()) bad.push(`${t.title}: File menu left open`);
        if (ribbonDisplay() !== ribbon0) bad.push(`${t.title}: ribbon display not restored`);
      }
    } finally { try { await app.docs.close(doc.id, { force: true }); } catch {} setTimeout(() => mk.invoke('recovery-delete', doc.recoveryId).catch(() => {}), 300); }
    A(!bad.length, bad.join(' | '));
    A(app.docs.list().length === before, 'no practice document left open');
  });
  T.register('tours: Help → Tutorials lists every tour with its time', async () => {
    A(list().length >= 14, 'tours: ' + list().length);
    for (const t of list()) A(t.minutes > 0 && t.description, 'time and description for ' + t.id);
    if (app.help?.tutorialsList) {
      const box = app.help.tutorialsList();
      A(box.querySelectorAll('.mkh-tour').length === list().length, 'every tour listed');
    }
  });
})();
