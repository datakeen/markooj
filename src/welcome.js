// Markooj — Welcome screen and What's new: a calm sheet shown on the first start of a fresh install ("Welcome to Markooj")
// and once after each version upgrade ("What's new in <version>"). Eight feature cards, each with a "Show me" button that
// starts a guided tour (src/tours.js) or runs a command; footer: the 2-minute tour, a sample document, Start writing.
// It never shows in smoke mode (unless a test opens it), never stacks on another dialog, and when Markooj was started by
// opening a file it does not cover the document: a small "Welcome" / "What's new" chip in the status bar opens it instead.
// API: app.welcome = { open(mode 'welcome'|'whatsnew') → Promise<how it closed>, close(how), isOpen(), mode(), startup(opts),
//   decide({fresh, seen, version, showOnStart}), cards, highlights, highlightsFor(version), chip: {show(mode), hide(), shown()},
//   sample: {available(), open()}, compareVersions }
// Command: help.welcome ("Welcome", Help tab, command search, the manual's getting-started page).
// Settings: welcome.seenVersion (the version whose Welcome / What's new was shown), welcome.showOnStart (default false).
(function () {
  'use strict';
  const app = window.app, mk = window.mk;
  if (!app || !mk) return;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = 'i') => `<svg class="${cls}" aria-hidden="true"><use href="#${esc(name)}"/></svg>`;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // "no settings yet" is read before boot writes anything: IPC answers in order, and this runs before app.js loads the settings
  const firstRunP = mk.invoke('settings-get').then(s => !s || !Object.keys(s).some(k => k !== 'window'), () => false);
  let infoP = null;
  const info = () => (infoP || (infoP = mk.invoke('app-info').catch(() => ({}))));

  // ---------- what the sheet shows ----------
  // Feature cards: tour = a tour id from app.tours.list(); command = run this instead. Title and text are English keys
  // (app.tm); the sheet translates them each time it draws.
  const CARDS = [
    { id: 'word', icon: 'ribbonicon', title: app.tm('Writes like Word'), text: app.tm('The ribbon, Word’s shortcuts and Alt KeyTips. No code to learn: Markooj writes the Markdown for you.'), tour: 'keys' },
    { id: 'writing', icon: 'spell', title: app.tm('Writing Assistant'), text: app.tm('Spelling, grammar and style, with a Why? that explains every suggestion.'), tour: 'writing' },
    { id: 'equations', icon: 'sigma', title: app.tm('Equations and cross-references'), text: app.tm('Numbered equations, figures and tables, and references that update themselves.'), tour: 'equations' },
    { id: 'citations', icon: 'cite', title: app.tm('Citations and bibliography'), text: app.tm('Cite from your Zotero, Mendeley or JabRef library (a .bib file). The bibliography builds itself.'), tour: 'citations' },
    { id: 'export', icon: 'export', title: app.tm('Save as PDF, Word, LaTeX, EPUB'), text: app.tm('Share in the format people ask for. Your own file stays as it is.'), tour: 'export' },
    { id: 'modes', icon: 'eye', title: app.tm('Four modes'), text: app.tm('Word, Inline, Simple and Read: one file, four ways to work on it.'), tour: 'modes' },
    { id: 'rtl', icon: 'lang', title: app.tm('Urdu, Arabic and Punjabi'), text: app.tm('Right-to-left writing with matching fonts, plus spelling language packs.'), tour: 'rtl' },
    { id: 'addins', icon: 'store', title: app.tm('Add-in store'), text: app.tm('Add buttons, tools and formats with one click. Turn them off any time.'), command: 'addins.browse' },
  ];
  // What's new: 3 to 5 highlights per version (the full list is in Help → What's New, from CHANGELOG.md)
  const HIGHLIGHTS = {
    '1.1.1': [
      { icon: 'sparkle', title: app.tm('A Welcome screen'), text: app.tm('The main features, each with a short guided tour. Open it any time from Help → Welcome.') },
      { icon: 'info', title: app.tm('Messages that help'), text: app.tm('When something needs your attention, Markooj first says what you can do, often with a button that does it.') },
      { icon: 'check', title: app.tm('DjVu files open on Windows'), text: app.tm('Markooj now recognizes the official DjVuLibre tools, so DjVu files open as they should.') },
      { icon: 'clock', title: app.tm('A quieter start'), text: app.tm('Optional tools are mentioned when you use them, not each time Markooj starts.') },
      { icon: 'cite', title: app.tm('New tutorial: citations'), text: app.tm('Cite from your Zotero, Mendeley or .bib library in a guided tour, from the Welcome screen or Help → Tutorials.') },
    ],
    '1.2.0': [
      { icon: 'export', title: app.tm('A smaller Markooj'), text: app.tm('Pandoc, the DjVu tools and Python macros are now optional. Add them any time from File → Options → Features.') },
      { icon: 'side', title: app.tm('Split, Side by Side and New Window'), text: app.tm('See two parts of a document, or two documents, at once from View → Window. View → Ruler adds rulers and guides.') },
      { icon: 'keyboard', title: app.tm('Type Urdu, Arabic, Persian and Punjabi'), text: app.tm('Built-in keyboards (Ctrl+Shift+K), an on-screen keyboard and a Home → Aarab group.') },
      { icon: 'table', title: app.tm('Tables with Word and Excel'), text: app.tm('Paste tables from Word, Excel and Google Sheets as real tables, and copy them back with Ctrl+C.') },
      { icon: 'spell', title: app.tm('Smarter typing and spelling'), text: app.tm('Better spelling suggestions, technical terms and place names, brackets and quotes that close themselves, and a Date & time dialog.') },
    ],
  };
  const highlightsFor = v => HIGHLIGHTS[String(v || '').replace(/^v/, '').split('-')[0]] || null;

  // ---------- versions and the decision ----------
  function compareVersions(a, b) {
    const pa = String(a || '0').replace(/^v/, '').split(/[.-]/).map(x => parseInt(x, 10) || 0);
    const pb = String(b || '0').replace(/^v/, '').split(/[.-]/).map(x => parseInt(x, 10) || 0);
    for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; }
    return 0;
  }
  /** What to show at start: 'welcome' (fresh install, or the user asked for it), 'whatsnew' (after an upgrade) or null. */
  function decide({ fresh, seen, version, showOnStart }) {
    if (!version) return null;
    if (!seen) return fresh ? 'welcome' : 'whatsnew'; // no record but settings exist: an update from 1.1.0 or older
    if (compareVersions(version, seen) > 0) return 'whatsnew';
    return showOnStart ? 'welcome' : null;
  }
  const markSeen = () => { if (app.version) app.settings.set('welcome.seenVersion', app.version); };
  const showOnStart = () => app.settings.get('welcome.showOnStart', false) === true;

  // ---------- the sample document ----------
  // Shown only when this copy has the samples (a source checkout serves them at the app root; packaged copies need
  // samples/ in build.files). main's 'sample-open' copies the sample folder somewhere writable and returns the .md path.
  const SAMPLE = { name: 'sediment-transport', file: 'samples/sediment-transport/sediment-transport.md', title: 'Bedload Transport' };
  let sampleP = null;
  const sample = {
    available() {
      if (!sampleP) sampleP = fetch(new URL('../' + SAMPLE.file, location.href).href, { cache: 'no-store' }).then(r => r.ok, () => false);
      return sampleP;
    },
    async open() {
      let p = null;
      try { p = await mk.invoke('sample-open', SAMPLE.name); } catch {}
      if (!p) {
        // a source checkout without that channel: open the sample where it is
        const i = await info();
        if (!i.packaged && i.resourcesDir) { const sep = i.resourcesDir.includes('\\') ? '\\' : '/'; p = i.resourcesDir.replace(/[\\/]+$/, '') + sep + SAMPLE.file.split('/').join(sep); }
      }
      const noSample = () => app.ui.toast(app.t('To try Markooj on a sample, click File → New and pick Research paper.'), { kind: 'info', timeout: 9000, actions: [{ label: app.t('Open File → New'), run: () => app.backstage.open('new') }] });
      if (!p) { noSample(); return null; }
      try { return await app.docs.open(p); }
      catch (e) { noSample(); console.warn('sample', e); return null; }
    },
  };

  // =====================================================================
  //  The sheet
  // =====================================================================
  let W = null; // {layer, sheet, mode, resolve, prevFocus}
  const tourMinutes = id => { try { return app.tours?.list?.().find(t => t.id === id)?.minutes || 2; } catch { return 2; } };
  const hasTour = id => { try { return !!app.tours?.get?.(id); } catch { return false; } };

  function welcomeHtml() {
    const cards = CARDS.map((c, k) => `
      <li class="mkwel-card" data-card="${c.id}">
        <span class="mkwel-ic" aria-hidden="true">${icon(c.icon)}</span>
        <span class="mkwel-ct"><b id="mkwel-c-${k}">${app.th(c.title)}</b><small>${app.th(c.text)}</small></span>
        <button type="button" class="mkwel-show" data-card="${c.id}" aria-describedby="mkwel-c-${k}"
          data-tip="${c.tour ? app.th('Start the guided tour') : app.th('Open it')}" data-tip-d="${c.tour ? app.th('A short tour on the real buttons, in a practice document. Esc ends it.') : app.th('Opens it now. You can come back here from Help → Welcome.')}">${app.th('Show me')}</button>
      </li>`).join('');
    const mins = tourMinutes('getting-started');
    return `
      <header class="mkwel-head">
        <img class="mkwel-logo" src="../build/icon.png" alt="" width="52" height="52" draggable="false">
        <div><h2 id="mkwel-title">${app.th('Welcome to Markooj')}</h2>
          <p class="mkwel-sub">${app.th('Write the way you do in Word. Markooj keeps your work in plain text files (Markdown) that any program can open. It works offline, and your files stay yours.')}</p></div>
        <button type="button" class="mkwel-x" aria-label="${app.th('Close')}" data-tip="${app.th('Close')}" data-tip-d="${app.th('Back to your document. Open this again from Help → Welcome.')}" data-key="Escape">${icon('x')}</button>
      </header>
      <div class="mkwel-body">
        <ul class="mkwel-grid" role="list" aria-label="${app.th('What Markooj can do')}">${cards}</ul>
      </div>
      <footer class="mkwel-foot">
        <label class="mkwel-check"><input type="checkbox" class="mkwel-onstart"${showOnStart() ? ' checked' : ''}> ${app.th('Show this when Markooj starts')}</label>
        <span class="mkwel-grow"></span>
        ${hasTour('getting-started') ? `<button type="button" class="btn mkwel-tour" data-tip="${app.th('Take the tour')}" data-tip-d="${app.th('The ribbon, the four modes and saving, on the real buttons. Esc ends it.')}">${icon('play')}${app.th('Take the {count}-minute tour', { count: mins })}</button>` : ''}
        <button type="button" class="btn mkwel-sample" hidden data-tip="${app.th('Open a sample document')}" data-tip-d="${app.th('A short research paper with equations, a figure, a table, citations and a diagram. Try anything; your own files are not touched.')}">${icon('doc')}${app.th('Open a sample document')}</button>
        <button type="button" class="btn primary mkwel-start">${app.th('Start writing')}</button>
      </footer>`;
  }
  function whatsNewHtml() {
    const v = app.version || '';
    const list = highlightsFor(v);
    const items = list ? list.map(x => `
      <li class="mkwel-hl"><span class="mkwel-ic sm" aria-hidden="true">${icon(x.icon)}</span><span><b>${app.th(x.title)}</b> ${app.th(x.text)}</span></li>`).join('')
      : '<li class="mkwel-hl"><span class="mkwel-ic sm" aria-hidden="true">' + icon('sparkle') + '</span><span>' + app.th('Markooj is up to date. See all changes for the details.') + '</span></li>';
    return `
      <header class="mkwel-head">
        <img class="mkwel-logo" src="../build/icon.png" alt="" width="52" height="52" draggable="false">
        <div><h2 id="mkwel-title">${app.th('What’s new in {version}', { version: v })}</h2>
          <p class="mkwel-sub">${app.th('Markooj was updated. Your documents and settings are just as you left them.')}</p></div>
        <button type="button" class="mkwel-x" aria-label="${app.th('Close')}" data-tip="${app.th('Close')}" data-tip-d="${app.th('Back to your document. Help → What’s New has the full list.')}" data-key="Escape">${icon('x')}</button>
      </header>
      <div class="mkwel-body"><ul class="mkwel-hls" role="list">${items}</ul></div>
      <footer class="mkwel-foot">
        <button type="button" class="btn mkwel-all" data-tip="${app.th('See all changes')}" data-tip-d="${app.th('Every change in this version, from Help → What’s New.')}">${app.th('See all changes')}</button>
        <span class="mkwel-grow"></span>
        <button type="button" class="btn mkwel-full" data-tip="${app.th('Show the full Welcome')}" data-tip-d="${app.th('The main features of Markooj, each with a short guided tour.')}">${icon('sparkle')}${app.th('Show the full Welcome')}</button>
        <button type="button" class="btn primary mkwel-start">${app.th('Continue')}</button>
      </footer>`;
  }

  function render(mode) {
    const s = W.sheet;
    W.mode = mode;
    s.dataset.mode = mode;
    s.innerHTML = mode === 'whatsnew' ? whatsNewHtml() : welcomeHtml();
    $('.mkwel-x', s).addEventListener('click', () => close('x'));
    $('.mkwel-start', s).addEventListener('click', () => close('start'));
    $('.mkwel-all', s)?.addEventListener('click', () => { close('all'); setTimeout(() => app.commands.run('help.whatsNew'), 200); });
    $('.mkwel-full', s)?.addEventListener('click', () => { render('welcome'); focusFirst(); });
    $('.mkwel-tour', s)?.addEventListener('click', () => { close('tour'); setTimeout(() => app.tours?.start?.('getting-started'), reduceMotion() ? 0 : 220); });
    const sb = $('.mkwel-sample', s);
    if (sb) {
      sb.addEventListener('click', () => { close('sample'); sample.open(); });
      sample.available().then(ok => { if (ok && sb.isConnected) sb.hidden = false; });
    }
    $('.mkwel-onstart', s)?.addEventListener('change', e => app.settings.set('welcome.showOnStart', !!e.target.checked));
    for (const b of $$('.mkwel-show', s)) b.addEventListener('click', () => showMe(b.dataset.card));
    // first run: the "Choose extra features" step (src/features.js; Pandoc, DjVu tools, Python macros with their sizes)
    if (mode === 'welcome') { try { app.features?.welcomeStep?.(s); } catch (e) { console.warn('welcome features step', e); } }
    // the interface language picker comes first (src/i18n.js); added here too, so a redraw keeps it
    if (mode === 'welcome') { try { app.i18n?.welcomeStep?.(s); } catch (e) { console.warn('welcome language step', e); } }
  }
  // the interface language changed while the sheet is open: draw it again in the new language
  app.events.on('i18n:changed', () => {
    if (!W) return;
    const inPicker = !!W.sheet.querySelector('.mk-i18n-wel')?.contains(document.activeElement);
    render(W.mode);
    const back = inPicker && W.sheet.querySelector('.mk-i18n-wel select, .mk-i18n-wel button, .mk-i18n-wel input');
    if (back) { try { back.focus({ preventScroll: true }); } catch {} } else focusFirst();
  });

  function showMe(id) {
    const c = CARDS.find(x => x.id === id);
    if (!c) return;
    close('show:' + id);
    const go = () => {
      if (c.tour && hasTour(c.tour)) return app.tours.start(c.tour);
      if (c.command) return app.commands.run(c.command);
      return app.commands.run('help.tutorials');
    };
    setTimeout(() => { try { Promise.resolve(go()).catch(e => console.warn('welcome show me', e)); } catch (e) { console.warn(e); } }, reduceMotion() ? 0 : 220);
  }

  const focusables = () => (W ? $$('button:not([disabled]):not([hidden]), input:not([disabled]), a[href]', W.sheet).filter(e => e.offsetParent !== null || e === document.activeElement) : []);
  function focusFirst() {
    if (!W) return;
    const f = $('.mkwel-start', W.sheet) || focusables()[0];
    try { f?.focus({ preventScroll: true }); } catch {}
  }

  function onKey(e) {
    if (!W) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close('esc'); return; }
    if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      e.preventDefault(); e.stopPropagation();
      const k = f.indexOf(document.activeElement);
      const n = k < 0 ? (e.shiftKey ? f.length - 1 : 0) : (k + (e.shiftKey ? -1 : 1) + f.length) % f.length;
      f[n].focus();
      return;
    }
    const a = document.activeElement;
    if (e.key === 'Enter' && a && a.tagName === 'BUTTON' && W.sheet.contains(a)) { e.preventDefault(); e.stopPropagation(); a.click(); return; }
    // arrow keys move between the "Show me" buttons, row by row like the grid
    if (/^Arrow(Left|Right|Up|Down)$/.test(e.key) && a?.classList.contains('mkwel-show')) {
      const all = $$('.mkwel-show', W.sheet);
      const i = all.indexOf(a);
      const cols = Math.max(1, Math.round(($('.mkwel-grid', W.sheet)?.clientWidth || 1) / Math.max(1, a.closest('.mkwel-card').offsetWidth)));
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
      const t = all[i + d];
      e.preventDefault(); e.stopPropagation();
      t?.focus();
    }
  }

  /** Open the sheet. Resolves when it closes, with how: 'start', 'esc', 'x', 'scrim', 'tour', 'sample', 'all', 'show:<card>'. */
  function open(mode = 'welcome', o = {}) {
    mode = mode === 'whatsnew' ? 'whatsnew' : 'welcome';
    if (W) { render(mode); focusFirst(); return W.done; }
    hideChip();
    try { app.tooltips?.hide?.(); } catch {}
    const layer = document.createElement('div');
    layer.className = 'mkwel-layer';
    layer.setAttribute('data-mk-keys', 'own');
    const scrim = document.createElement('div'); scrim.className = 'mkwel-scrim';
    const sheet = document.createElement('section');
    sheet.className = 'mkwel-sheet';
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'mkwel-title');
    layer.append(scrim, sheet);
    let resolve;
    const done = new Promise(r => { resolve = r; });
    W = { layer, sheet, mode, resolve, done, prevFocus: document.activeElement };
    render(mode);
    scrim.addEventListener('click', () => close('scrim'));
    layer.addEventListener('keydown', onKey, true);
    document.body.append(layer);
    if (window.__mkSmokeStarted || reduceMotion()) layer.classList.add('instant');
    void layer.offsetWidth;
    layer.classList.add('show');
    if (o.markSeen !== false) markSeen();
    focusFirst();
    // focus that wanders out of the sheet (a click on the window edge) comes back in
    W.onFocusIn = e => { if (W && !W.sheet.contains(e.target)) focusFirst(); };
    document.addEventListener('focusin', W.onFocusIn, true);
    app.events.emit('welcome:opened', { mode });
    return done;
  }

  function close(how = 'close') {
    if (!W) return;
    const w = W; W = null;
    document.removeEventListener('focusin', w.onFocusIn, true);
    w.layer.classList.remove('show');
    setTimeout(() => w.layer.remove(), w.layer.classList.contains('instant') ? 0 : 240);
    // back to where the user was: the editor, unless a tour or another window takes over
    if (!/^(show:|tour|sample|all)/.test(how)) {
      const p = w.prevFocus;
      try { if (p && p.isConnected && p !== document.body) p.focus({ preventScroll: true }); else app.editors.active()?.focus?.(); } catch {}
    }
    app.events.emit('welcome:closed', { mode: w.mode, how });
    w.resolve(how);
  }

  // =====================================================================
  //  The status bar chip (when the sheet would cover a document the user just opened)
  // =====================================================================
  let chipMode = null;
  app.status.addItem({
    id: 'welcome', side: 'right', order: 1,
    render(el) {
      el.innerHTML = '';
      if (!chipMode) return;
      const label = chipMode === 'whatsnew' ? app.t('What’s new in {version}', { version: app.version || '' }).trim() : app.t('Welcome');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sb mkwel-chip';
      b.innerHTML = `${icon('sparkle')}<span>${esc(label)}</span>`;
      b.dataset.tip = label;
      b.dataset.tipD = chipMode === 'whatsnew' ? app.t('See what changed in this version of Markooj.') : app.t('A quick look at what Markooj can do, with a short tour for each feature.');
      b.addEventListener('click', () => { const m = chipMode; open(m); });
      const x = document.createElement('button');
      x.type = 'button'; x.className = 'sb mkwel-chip-x';
      x.innerHTML = icon('x');
      x.setAttribute('aria-label', app.t('Hide {name}', { name: label }));
      x.dataset.tip = app.t('Hide'); x.dataset.tipD = app.t('You can open it any time from Help → Welcome.');
      x.addEventListener('click', () => { markSeen(); hideChip(); });
      el.append(b, x);
    },
  });
  function showChip(mode) { chipMode = mode === 'whatsnew' ? 'whatsnew' : 'welcome'; try { app.status.refresh(); } catch {} }
  function hideChip() { if (!chipMode) return; chipMode = null; try { app.status.refresh(); } catch {} }

  // =====================================================================
  //  Start-up: show once, when the window is idle
  // =====================================================================
  let userActed = false;
  const acted = e => { if (!W && !(e.target && e.target.closest?.('.mkwel-layer'))) userActed = true; };
  function busy() {
    if (W) return true;
    if ($('.dlg.show') || $('.mkh-viewer.show') || $('.mkt-layer') || $('#backstage.show') || $('.palette.show')) return true;
    try { if (app.tours?.active?.()) return true; } catch {}
    try { if (app.keytips?.active?.()) return true; } catch {}
    if ($('#popLayer')?.children.length) return true;
    return false;
  }
  async function waitIdle(ms) {
    const end = Date.now() + ms;
    for (;;) {
      if (!busy() && document.visibilityState !== 'hidden') return true;
      if (Date.now() > end) return false;
      await sleep(400);
    }
  }
  /** Decide and show. opts (for tests): {test, fresh, fileOpened, delay, idleMs}. Returns 'welcome' | 'whatsnew' | 'chip' | null. */
  async function startup(o = {}) {
    if (!o.test) {
      const i = await info();
      if (i.userDataFrom === 'smoke' || window.__mkSmokeStarted) return null;
      if (app.windows?.isExtra) return null; // a second window (View → New Window) never shows Welcome again
    }
    const fresh = o.fresh ?? await firstRunP;
    const mode = decide({ fresh, seen: app.settings.get('welcome.seenVersion', null), version: app.version, showOnStart: showOnStart() });
    if (!mode) return null;
    // a file opened by double-click (or from the command line) has the user's attention: offer, do not cover it
    const fileOpened = o.fileOpened ?? app.docs.list().some(d => d.path);
    if (fileOpened) { showChip(mode); return 'chip'; }
    await sleep(o.delay ?? 1800);
    if (!o.test && window.__mkSmokeStarted) return null;
    const idle = await waitIdle(o.idleMs ?? 12000);
    if (!idle || (!o.test && userActed)) { showChip(mode); return 'chip'; }
    open(mode);
    return mode;
  }
  app.events.on('ready', () => {
    addEventListener('keydown', acted, true);
    document.getElementById('editorHost')?.addEventListener('pointerdown', acted, true);
    startup().catch(e => console.warn('welcome', e)).finally(() => {
      removeEventListener('keydown', acted, true);
      document.getElementById('editorHost')?.removeEventListener('pointerdown', acted, true);
    });
  });

  // ---------- command ----------
  const DESC = app.tm('What Markooj can do, with a short guided tour for each feature, and what is new in this version.');
  app.commands.register('help.welcome', { label: app.tm('Welcome'), icon: 'sparkle', category: 'Help', description: DESC, keywords: 'welcome start onboarding what’s new features tour', run: args => open(args?.mode || 'welcome', { markSeen: false }) });
  try { app.tooltips?.register?.('help.welcome', { title: app.tm('Welcome'), description: DESC }); } catch {}

  app.welcome = {
    open, close, isOpen: () => !!W, mode: () => W?.mode || null, startup, decide, compareVersions,
    cards: CARDS, highlights: HIGHLIGHTS, highlightsFor, sample,
    chip: { show: showChip, hide: hideChip, shown: () => chipMode },
  };

  // =====================================================================
  //  Smoke tests
  // =====================================================================
  const T = app.tests, A = app.assert;
  const shot = async name => { try { await mk.invoke('smoke-shot', name); } catch {} };
  const until = async (fn, ms = 3000) => { const end = Date.now() + ms; for (;;) { let v = null; try { v = fn(); } catch {} if (v) return v; if (Date.now() > end) return null; await sleep(50); } };
  const key = (k, o = {}) => (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }));
  // run a test with the welcome settings put back afterwards
  async function withSettings(fn) {
    const keep = { seen: app.settings.get('welcome.seenVersion', undefined), on: app.settings.get('welcome.showOnStart', undefined) };
    try { return await fn(); }
    finally {
      if (W) close('test');
      hideChip();
      app.settings.set('welcome.seenVersion', keep.seen); app.settings.set('welcome.showOnStart', keep.on);
      await sleep(260);
    }
  }

  T.register('welcome: decides Welcome on a fresh install, nothing after it was seen, What’s new after an update', async () => {
    A(decide({ fresh: true, seen: null, version: '1.1.1' }) === 'welcome', 'fresh install → Welcome');
    A(decide({ fresh: false, seen: null, version: '1.1.1' }) === 'whatsnew', 'update from a version without a record → What’s new');
    A(decide({ fresh: false, seen: '1.1.1', version: '1.1.1' }) === null, 'seen this version → nothing');
    A(decide({ fresh: false, seen: '1.1.1', version: '1.1.1', showOnStart: true }) === 'welcome', 'Show this when Markooj starts → Welcome');
    A(decide({ fresh: false, seen: '1.1.0', version: '1.1.1' }) === 'whatsnew', 'newer version → What’s new');
    A(decide({ fresh: false, seen: '1.10.0', version: '1.9.3' }) === null, 'an older version never shows What’s new');
    A(compareVersions('1.10.0', '1.9.9') === 1 && compareVersions('v1.1.1', '1.1.1') === 0, 'version compare');
    for (const [v, list] of Object.entries(HIGHLIGHTS)) A(list.length >= 3 && list.length <= 5, `3 to 5 highlights for ${v}: ${list.length}`);
    // a release newer than the last list needs its own highlights (the version comes from package.json)
    const newest = Object.keys(HIGHLIGHTS).sort(compareVersions).pop();
    A(compareVersions(app.version, newest) <= 0, `add What’s new highlights for ${app.version} to src/welcome.js`);
    if (compareVersions(app.version, newest) === 0) A(highlightsFor(app.version), 'highlights for this version');
    A(CARDS.length >= 6 && CARDS.length <= 8, 'six to eight cards');
  });

  T.register('welcome: shows on a fresh profile, not again after closing, and What’s new after a version change', async () => {
    await withSettings(async () => {
      app.settings.set('welcome.seenVersion', undefined); app.settings.set('welcome.showOnStart', false);
      const r = await startup({ test: true, fresh: true, fileOpened: false, delay: 0, idleMs: 3000 });
      A(r === 'welcome', 'fresh profile shows the Welcome: ' + r);
      const s = await until(() => $('.mkwel-layer.show .mkwel-sheet[data-mode="welcome"]'));
      A(s && /Welcome to Markooj/.test(s.textContent), 'the Welcome sheet is open');
      A($$('.mkwel-card', s).length === CARDS.length, 'every card is drawn');
      A($('.mkwel-onstart', s) && !$('.mkwel-onstart', s).checked, '“Show this when Markooj starts” is off');
      A(app.settings.get('welcome.seenVersion') === app.version, 'seen version recorded: ' + app.settings.get('welcome.seenVersion'));
      await sleep(250); await shot('welcome');
      $('.mkwel-start', s).click();
      A(await until(() => !$('.mkwel-layer')), 'Start writing closes it');
      A(await startup({ test: true, fresh: false, fileOpened: false, delay: 0, idleMs: 500 }) === null, 'not shown again after closing');
      // an update
      app.settings.set('welcome.seenVersion', '0.9.0');
      const r2 = await startup({ test: true, fresh: false, fileOpened: false, delay: 0, idleMs: 3000 });
      A(r2 === 'whatsnew', 'a version change shows What’s new: ' + r2);
      const s2 = await until(() => $('.mkwel-sheet[data-mode="whatsnew"]'));
      A(s2 && s2.textContent.includes(`What’s new in ${app.version}`), 'title names the version');
      const n = $$('.mkwel-hl', s2).length, want = highlightsFor(app.version)?.length || 1;
      A(n === want, `the highlights of ${app.version}: ${n} of ${want}`);
      await sleep(250); await shot('welcome-whats-new');
      $('.mkwel-full', s2).click();
      A(await until(() => $('.mkwel-sheet[data-mode="welcome"]')), '“Show the full Welcome” switches to the Welcome');
      close('test'); await sleep(260);
      A(app.settings.get('welcome.seenVersion') === app.version, 'What’s new marks this version as seen');
      // the checkbox brings it back at the next start
      app.settings.set('welcome.showOnStart', true);
      A(await startup({ test: true, fresh: false, fileOpened: false, delay: 0, idleMs: 3000 }) === 'welcome', 'Show this when Markooj starts');
      close('test'); await sleep(260);
    });
  });

  T.register('welcome: a document opened at start gets a status bar chip, not a sheet over it', async () => {
    await withSettings(async () => {
      app.settings.set('welcome.seenVersion', '0.9.0');
      const r = await startup({ test: true, fresh: false, fileOpened: true, delay: 0 });
      A(r === 'chip' && !$('.mkwel-layer'), 'no sheet over the opened file: ' + r);
      const chip = await until(() => $('#statusbar .mkwel-chip'));
      A(chip && /What’s new/.test(chip.textContent), 'the chip is in the status bar');
      chip.click();
      A(await until(() => $('.mkwel-sheet[data-mode="whatsnew"]')), 'the chip opens What’s new');
      A(!$('#statusbar .mkwel-chip'), 'the chip goes away');
      close('test'); await sleep(260);
      // a dialog that is already open is never covered
      app.settings.set('welcome.seenVersion', undefined);
      const p = app.ui.dialog({ title: 'Something else', body: 'x', buttons: [{ label: 'OK', value: true, primary: true }] });
      await until(() => $('.dlg.show'));
      const r2 = await startup({ test: true, fresh: true, fileOpened: false, delay: 0, idleMs: 600 });
      A(r2 === 'chip' && !$('.mkwel-layer'), 'waits behind another dialog, then offers the chip: ' + r2);
      $('.dlg.show .dlg-foot .btn.primary')?.click(); await p;
      $('#statusbar .mkwel-chip-x')?.click();
      A(await until(() => !$('#statusbar .mkwel-chip')), 'the chip can be hidden');
    });
  });

  T.register('welcome: Show me buttons start the right tours and commands', async () => {
    const ids = new Set((app.tours?.list?.() || []).map(t => t.id));
    for (const c of CARDS) {
      if (c.tour) A(ids.has(c.tour), `card “${c.title}” names a tour that exists: ${c.tour}`);
      if (c.command) A(app.commands.get(c.command), `card “${c.title}” runs a command that exists: ${c.command}`);
    }
    A(ids.has('getting-started'), 'the 2-minute tour exists');
    const started = [], ran = [];
    const t0 = app.tours.start, r0 = app.commands.run;
    app.tours.start = id => { started.push(id); return Promise.resolve(null); };
    app.commands.run = (id, args) => { if (id === 'help.welcome') return r0.call(app.commands, id, args); ran.push(id); return Promise.resolve(); };
    try {
      for (const c of CARDS) {
        open('welcome', { markSeen: false });
        const b = await until(() => $(`.mkwel-show[data-card="${c.id}"]`));
        A(b, 'Show me for ' + c.id);
        b.click();
        await until(() => !W);
        await sleep(reduceMotion() ? 30 : 280);
        if (c.tour) A(started[started.length - 1] === c.tour, `${c.id} started ${started[started.length - 1]}, wanted ${c.tour}`);
        else A(ran[ran.length - 1] === c.command, `${c.id} ran ${ran[ran.length - 1]}, wanted ${c.command}`);
      }
      open('welcome', { markSeen: false });
      (await until(() => $('.mkwel-tour'))).click();
      await sleep(reduceMotion() ? 30 : 280);
      A(started[started.length - 1] === 'getting-started', 'Take the tour starts Getting started');
      // the command, the Help tab and the manual reach it
      const p = app.commands.run('help.welcome');
      A(await until(() => $('.mkwel-sheet[data-mode="welcome"]')), 'help.welcome opens the Welcome');
      close('test'); await p; await sleep(260);
    } finally { app.tours.start = t0; app.commands.run = r0; if (W) close('test'); }
    const helpTab = app.ribbon.tabs().find(t => t.id === 'help');
    A(helpTab && JSON.stringify(helpTab.groups.map(g => g.items)).includes('"help.welcome"'), 'Welcome button on the Help tab');
    const info2 = app.tooltips?.info?.('help.welcome');
    if (app.tooltips?.info) A(info2 && info2.title && info2.description, 'help.welcome has a ScreenTip');
  });

  T.register('welcome: the manual (F1) opens it from Help home and from Getting started', async () => {
    if (!app.help?.open) return;
    try {
      for (const page of ['index.md', 'getting-started.md']) {
        await app.help.open(page);
        const b = await until(() => $('.mkh-viewer.show .mkh-doc .mkh-welcome-btn'), 5000);
        A(b, 'an “Open the Welcome screen” button on ' + page);
        b.click();
        A(await until(() => $('.mkwel-sheet[data-mode="welcome"]'), 3000), 'the button opens the Welcome (' + page + ')');
        A(await until(() => !$('.mkh-viewer.show'), 2000), 'Help steps aside');
        close('test'); await sleep(260);
      }
    } finally { if (W) close('test'); try { app.help.close(); } catch {} await sleep(200); }
  });

  T.register('welcome: keyboard — focus starts inside, Tab stays in the sheet, Enter runs a button, Esc closes', async () => {
    const before = document.activeElement;
    const p = open('welcome', { markSeen: false });
    try {
      const s = await until(() => $('.mkwel-sheet'));
      await sleep(30);
      A(s.contains(document.activeElement) && document.activeElement.classList.contains('mkwel-start'), 'focus starts on Start writing: ' + document.activeElement?.className);
      const f = focusables();
      A(f.length >= CARDS.length + 3, 'cards, checkbox and footer buttons are reachable: ' + f.length);
      // Tab from the last control wraps to the first, Shift+Tab goes back
      f[f.length - 1].focus(); key('Tab');
      A(document.activeElement === f[0], 'Tab wraps to the first control');
      key('Tab', { shiftKey: true });
      A(document.activeElement === f[f.length - 1], 'Shift+Tab wraps to the last control');
      for (let i = 0; i < f.length + 2; i++) { key('Tab'); A(s.contains(document.activeElement), 'Tab stays in the sheet'); }
      // arrows move between the Show me buttons
      const shows = $$('.mkwel-show', s); shows[0].focus(); key('ArrowRight');
      A(document.activeElement === shows[1], 'Right arrow moves to the next card');
      // Enter on the "Show this when Markooj starts" checkbox is left alone; Enter on a button runs it
      $('.mkwel-x', s).focus(); key('Enter');
      A(await until(() => !$('.mkwel-layer')), 'Enter on Close closes the sheet');
      await p;
      const p2 = open('whatsnew', { markSeen: false });
      await until(() => $('.mkwel-sheet[data-mode="whatsnew"]'));
      key('Escape');
      A(await until(() => !$('.mkwel-layer')), 'Esc closes What’s new');
      A((await p2) === 'esc', 'closed with Esc');
      A(!s.isConnected, 'nothing left on screen');
    } finally { if (W) close('test'); try { before?.focus?.(); } catch {} }
  });

  T.register('welcome: dark mode draws the sheet in dark colors', async () => {
    const theme = app.settings.get('theme', 'system');
    try {
      app.settings.set('theme', 'dark'); app.shell?.applyTheme?.(); await sleep(400);
      open('welcome', { markSeen: false });
      const s = await until(() => $('.mkwel-sheet'));
      await sleep(250);
      const lum = c => { const m = String(c).match(/[\d.]+/g) || [255, 255, 255]; return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
      const bg = getComputedStyle(s).backgroundColor, fg = getComputedStyle($('h2', s)).color;
      A(document.documentElement.dataset.theme === 'dark', 'dark theme on');
      A(lum(bg) < 0.3, 'dark background: ' + bg);
      A(lum(fg) > 0.7, 'light text: ' + fg);
      const card = $('.mkwel-card', s);
      A(lum(getComputedStyle(card).backgroundColor) < 0.35, 'dark cards: ' + getComputedStyle(card).backgroundColor);
      await shot('welcome-dark');
      open('whatsnew', { markSeen: false });
      A(await until(() => $('.mkwel-sheet[data-mode="whatsnew"]')), 'What’s new in dark mode');
      await sleep(250); await shot('welcome-whats-new-dark');
    } finally {
      if (W) close('test');
      app.settings.set('theme', theme); app.shell?.applyTheme?.(); await sleep(300);
    }
  });

  T.register('welcome: Open a sample document appears only when this copy has the sample, and opens it', async () => {
    const ok = await sample.available();
    open('welcome', { markSeen: false });
    try {
      const s = await until(() => $('.mkwel-sheet'));
      await sleep(80);
      const b = $('.mkwel-sample', s);
      A(b && b.hidden === !ok, `button ${ok ? 'shown' : 'hidden'} (sample ${ok ? 'present' : 'not in this copy'})`);
      if (!ok) return;
      const already = app.docs.list().some(x => /sediment-transport\.md$/i.test(x.path || ''));
      A(!already, 'the sample is not open yet');
      b.click();
      // (an empty Untitled page is replaced by the opened file, so the number of tabs may stay the same)
      const d = await until(() => app.docs.list().find(x => /sediment-transport\.md$/i.test(x.path || '')), 8000);
      A(d && /Bedload/.test(d.text), 'the sample paper opened: ' + JSON.stringify(app.docs.list().map(x => x.path || x.title)));
      A(!d.dirty, 'it opens unchanged');
      // main's 'sample-open' hands back a writable copy, never the shipped file (a save must not change the repository)
      const i = await info();
      const shipped = String(i.resourcesDir || '').replace(/[\\/]+$/, '') + '/' + SAMPLE.file;
      A(d.path.replace(/\\/g, '/').toLowerCase() !== shipped.replace(/\\/g, '/').toLowerCase(), 'opened a copy, not the shipped sample: ' + d.path);
      try { await app.docs.close(d.id, { force: true }); } catch {}
      if (!app.docs.list().length) app.docs.create({ title: app.t('Untitled') });
    } finally { if (W) close('test'); await sleep(260); }
  });
})();
