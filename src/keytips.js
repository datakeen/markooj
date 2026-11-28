// Markooj — KeyTips like Word: press and release Alt (or F10) and letters appear on File, the ribbon tabs and the
// title bar buttons. Type a tab's letter to open it and see letters on its controls (two letters when needed),
// type a control's letters to use it. Esc goes back one level. Works with Show tabs only and Full-screen mode.
// Letters are read from the key's position (e.code), so Urdu, Arabic and Persian keyboards work too; Alt+key
// shortcuts and AltGr typing are left alone (the shell starts KeyTips only for Alt pressed and released alone).
(function () {
  'use strict';
  const app = window.app;
  if (!app) return;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ribbon = () => document.getElementById('ribbon');
  const titlebar = () => document.getElementById('titlebar');
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Word's letters where Markooj has the same tab or control
  const TAB_KEYS = { home: 'H', insert: 'N', layout: 'P', references: 'S', review: 'R', view: 'W', developer: 'L', addins: 'X', help: 'Y', writing: 'G', tableDesign: 'JT', tableLayout: 'JL' };
  const CMD_KEYS = {
    'format.bold': '1', 'format.italic': '2', 'format.underline': '3', 'format.strike': '4', 'format.sub': '5', 'format.sup': '6', 'edit.changeCaseMenu': '7',
    'format.fontFamily': 'FF', 'format.fontSize': 'FS', 'format.growFont': 'FG', 'format.shrinkFont': 'FK', 'format.clear': 'E', 'format.highlight': 'I', 'format.color': 'FC',
    'list.bullet': 'U', 'list.number': 'N', 'list.task': 'TK', 'para.outdent': 'AO', 'para.indent': 'AI', 'para.alignLeft': 'AL', 'para.alignCenter': 'AC', 'para.alignRight': 'AR', 'para.alignJustify': 'AJ',
    'edit.paste': 'V', 'edit.cut': 'X', 'edit.copy': 'C', 'format.painter': 'FP', 'edit.find': 'FD', 'edit.replace': 'R', 'edit.selectAll': 'SL', 'para.quote': 'Q',
    'insert.table': 'T', 'insert.image': 'P', 'insert.link': 'I', 'insert.equation': 'E', 'insert.symbol': 'U', 'insert.pageBreak': 'B', 'insert.footnote': 'F', 'insert.citation': 'CI',
    'layout.margins': 'M', 'layout.size': 'SZ', 'layout.columns': 'O', 'layout.theme': 'TH',
    'review.spelling': 'S', 'review.wordCount': 'W', 'review.comment': 'C',
    'view.printLayout': 'P', 'view.webLayout': 'L', 'view.focus': 'F', 'view.outline': 'V', 'view.ribbonOptions': 'RB', 'view.zoomIn': 'ZI', 'view.zoomOut': 'ZO', 'view.zoom100': 'J', 'view.pageWidth': 'I',
    // View → Show and View → Window, Word's letters (round 5)
    'view.ruler': 'RU', 'view.guides': 'GU', 'view.newWindow': 'N', 'view.arrangeAll': 'A', 'view.split': 'S', 'view.sideBySide': 'B', 'view.syncScroll': 'YS', 'view.resetWindowPosition': 'T', 'view.switchWindows': 'W',
    'ref.toc': 'T', 'ref.footnote': 'F', 'ref.cite': 'C',
    // Home → Aarab (aarab.js) and View → Keyboard (keyboards.js)
    'aarab.zabar': 'DA', 'aarab.zer': 'DI', 'aarab.pesh': 'DU', 'aarab.shadd': 'DS', 'aarab.jazm': 'DJ', 'aarab.tanweenZabar': 'DN', 'aarab.tanweenZer': 'DE',
    'aarab.tanweenPesh': 'DP', 'aarab.khariZabar': 'DK', 'aarab.remove': 'DR', 'aarab.toggleView': 'DH', 'aarab.fromWordList': 'DW',
    'keyboard.menu': 'KB', 'keyboard.toggle': 'KT', 'keyboard.onScreen': 'KS',
  };
  const CONTROL_SEL = 'button[data-tip-cmd], button[data-cmd], button.select, button.big, button.ib, .gallery button.sty, .gallery button.more, .seg button, .mk-seg button';

  const layer = document.createElement('div');
  layer.className = 'keytip-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  let state = null; // {level: 0 | 1, items: [{el, key, kind, id}], buf, tab}

  const visible = el => { if (!el || !el.isConnected || el.hidden) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.offsetParent !== null; };
  const labelOf = el => (el.dataset.tip || el.getAttribute('aria-label') || el.textContent || '').trim();
  const lettersOf = s => String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ');

  /** Gives each item a key: preferred ones first, then first letters, two letters when several share a letter. */
  function assign(items) {
    const taken = [];
    const free = k => k && !taken.some(t => t === k || t.startsWith(k) || k.startsWith(t));
    for (const it of items) if (it.want && free(it.want)) { it.key = it.want; taken.push(it.key); }
    const rest = items.filter(i => !i.key);
    const byFirst = new Map();
    for (const it of rest) { const w = lettersOf(it.label).trim(); const f = (w.match(/[A-Z]/) || [''])[0]; it._w = w; it._f = f; byFirst.set(f, (byFirst.get(f) || 0) + 1); }
    for (const it of rest) {
      const f = it._f;
      if (f && byFirst.get(f) === 1 && free(f)) { it.key = f; taken.push(f); continue; }
      // two letters: the first letter, then a later initial or letter of the label
      const words = it._w.split(/\s+/).filter(Boolean);
      const cands = [];
      const firsts = [f || 'Z'];
      for (const a of firsts) {
        for (const w of words.slice(1)) cands.push(a + w[0]);
        for (const ch of it._w.replace(/\s+/g, '').slice(1)) cands.push(a + ch);
        for (let c = 65; c <= 90; c++) cands.push(a + String.fromCharCode(c));
      }
      for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) cands.push(String.fromCharCode(a) + String.fromCharCode(b));
      it.key = cands.find(free) || '';
      if (it.key) taken.push(it.key);
    }
    return items.filter(i => i.key);
  }

  function levelZero() {
    const items = [];
    const rb = ribbon();
    const file = rb?.querySelector('.rtab.file');
    if (visible(file)) items.push({ el: file, want: 'F', label: app.t('File'), kind: 'file' });
    for (const b of $$('.rtab[data-tab]', rb || document)) if (visible(b)) items.push({ el: b, want: TAB_KEYS[b.dataset.tab] || '', label: b.textContent, kind: 'tab', id: b.dataset.tab });
    // title bar buttons (Word's Quick Access Toolbar) get numbers
    let n = 1;
    for (const b of $$('[data-cmd]', titlebar() || document)) { if (n > 9 || !visible(b)) continue; items.push({ el: b, want: String(n++), label: labelOf(b), kind: 'qat' }); }
    return assign(items);
  }
  function levelOne() {
    const rb = ribbon();
    const panel = rb?.querySelector('.panel.on');
    if (!panel) return [];
    const seen = new Set(), items = [];
    const view = rb.querySelector('.rbody')?.getBoundingClientRect();
    for (const el of $$(CONTROL_SEL, panel)) {
      if (seen.has(el) || !visible(el)) continue;
      // inside the visible part of the ribbon (groups scrolled out of view are left out)
      const r = el.getBoundingClientRect();
      if (view && (r.right < view.left + 4 || r.left > view.right - 4)) continue;
      seen.add(el);
      const id = el.dataset.tipCmd || el.dataset.cmd || '';
      items.push({ el, want: CMD_KEYS[id] || '', label: labelOf(el) || id.split('.').pop(), kind: 'control', id });
    }
    const disp = rb.querySelector('.ribbon:not(.peek) > .rdisp, .rdisp');
    if (visible(disp)) items.push({ el: disp, want: 'ZR', label: app.t('Ribbon display options'), kind: 'control', id: 'view.ribbonOptions' });
    return assign(items);
  }

  function draw() {
    layer.innerHTML = '';
    if (!state) return;
    for (const it of state.items) {
      const r = it.el.getBoundingClientRect();
      const b = document.createElement('span');
      b.className = 'keytip' + (it.el.disabled ? ' dim' : '');
      b.textContent = it.key;
      const big = it.el.classList.contains('big') || it.el.classList.contains('sty');
      let x, y;
      if (it.kind === 'tab' || it.kind === 'file' || it.kind === 'qat') { x = r.left + r.width / 2; y = r.bottom - 8; }
      else if (big) { x = r.left + r.width / 2; y = r.bottom - 10; }
      else { x = r.left + Math.min(14, r.width / 2); y = r.bottom - 7; }
      b.style.left = Math.round(Math.max(10, Math.min(innerWidth - 10, x))) + 'px';
      b.style.top = Math.round(Math.max(2, Math.min(innerHeight - 20, y))) + 'px';
      it.badge = b;
      layer.appendChild(b);
    }
    layer.classList.add('show');
    filter();
  }
  function filter() {
    if (!state) return;
    for (const it of state.items) {
      if (!it.badge) continue;
      const match = !state.buf || it.key.startsWith(state.buf);
      it.badge.classList.toggle('off', !match);
      it.badge.innerHTML = '';
      if (state.buf && match) { const t = document.createElement('b'); t.textContent = state.buf; it.badge.append(t, it.key.slice(state.buf.length)); }
      else it.badge.textContent = it.key;
    }
  }

  async function show(level, tab) {
    if (!state) return;
    state.level = level; state.buf = ''; state.tab = tab || null;
    layer.innerHTML = '';
    if (level === 1) await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (!state) return;
    state.items = level === 0 ? levelZero() : levelOne();
    draw();
    app.events.emit('keytips:level', level);
  }
  /** Shows KeyTips. Returns false when there is no ribbon to show them on (Simple mode's slim bar). */
  async function start() {
    if (state) return true;
    if (document.querySelector('.backstage.show, .palette.show') || document.querySelector('.dlg.show, .mk-modal-wrap.show')) return false;
    const rb = ribbon();
    if (!rb || getComputedStyle(rb).display === 'none') return false;
    try { app.tooltips?.hide?.(); } catch {}
    state = { level: 0, items: [], buf: '' };
    document.body.classList.add('keytips-on');
    // Full-screen mode: bring the title bar and ribbon in first
    if (app.shell?.revealChrome?.()) await sleep(340);
    if (!state) return false;
    await show(0);
    return true;
  }
  function stop() {
    if (!state) return;
    state = null;
    layer.innerHTML = '';
    layer.classList.remove('show');
    document.body.classList.remove('keytips-on');
    app.events.emit('keytips:level', -1);
  }
  function focusPage() {
    const a = document.activeElement;
    if (a && (ribbon()?.contains(a) || titlebar()?.contains(a))) { try { app.editors.active()?.focus?.(); } catch {} }
  }
  function activate(it) {
    if (!it) return;
    if (it.el.disabled) { shake(); return; }
    if (it.kind === 'tab') {
      app.shell?.selectTab?.(it.id, true);
      // tabs only: selecting the tab drops the ribbon down; it may toggle closed when it was already open
      if (document.body.classList.contains('ribbon-collapsed') && !ribbon().classList.contains('peek')) ribbon().classList.add('peek');
      show(1, it.id);
      return;
    }
    stop();
    if (it.kind === 'file') { app.backstage.open(); return; }
    focusPage();
    it.el.click();
  }
  function shake() { layer.classList.remove('shake'); void layer.offsetWidth; layer.classList.add('shake'); }
  /** Types one KeyTip character (also used by tests). */
  function press(ch) {
    if (!state) return false;
    ch = String(ch || '').toUpperCase();
    if (!/^[A-Z0-9]$/.test(ch)) return false;
    const buf = state.buf + ch;
    const exact = state.items.find(i => i.key === buf);
    if (exact) { state.buf = ''; activate(exact); return true; }
    if (state.items.some(i => i.key.startsWith(buf))) { state.buf = buf; filter(); return true; }
    shake(); state.buf = ''; filter();
    return false;
  }
  function back() {
    if (!state) return;
    if (state.buf) { state.buf = ''; filter(); return; }
    if (state.level === 1) {
      if (document.body.classList.contains('ribbon-collapsed')) app.shell?.endPeek?.();
      show(0);
      return;
    }
    stop();
  }
  const charOf = e => {
    const c = e.code || '';
    if (/^Key[A-Z]$/.test(c)) return c.slice(3);
    if (/^(Digit|Numpad)\d$/.test(c)) return c.slice(-1);
    return '';
  };
  addEventListener('keydown', e => {
    if (!state || e.isComposing) return;
    if (e.key === 'Alt' || e.key === 'Shift' || e.key === 'AltGraph') return; // Alt again: the shell turns KeyTips off
    if (e.ctrlKey || e.metaKey || e.altKey || e.getModifierState?.('AltGraph')) { stop(); return; } // a shortcut: let it run
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); back(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); if (state.buf) { state.buf = state.buf.slice(0, -1); filter(); } else back(); return; }
    if (/^(Arrow|Tab$|Enter$|Home$|End$|F\d)/.test(e.key)) { stop(); return; } // the keyboard moves around the ribbon instead
    const ch = charOf(e);
    e.preventDefault(); e.stopPropagation(); // nothing types into the page while KeyTips show
    if (ch) press(ch); else shake();
  }, true);
  addEventListener('mousedown', () => stop(), true);
  addEventListener('blur', () => stop());
  addEventListener('resize', () => { if (state) draw(); });
  app.events.on('backstage:open', stop);
  app.events.on('mode:changed', stop);

  app.keytips = { start, stop, press, back, active: () => !!state, level: () => (state ? state.level : -1), keys: () => (state ? state.items.map(i => ({ key: i.key, label: i.label, id: i.id || null, kind: i.kind })) : []), assign };

  // ---------- smoke tests ----------
  const A = app.assert;
  app.tests.register('keytips: Alt shows letters on tabs, a letter opens the tab, Esc goes back', async () => {
    app.backstage?.close?.(); await sleep(60);
    const m0 = app.shell?.ribbonDisplay?.() || 'pinned';
    const mode0 = app.mode;
    try {
      if (app.mode === 'simple' || app.mode === 'read') { app.setMode('word'); await sleep(600); }
      app.shell?.setRibbonDisplay?.('pinned'); await sleep(350);
      // Alt pressed and released alone
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', code: 'AltLeft', altKey: true, bubbles: true }));
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', code: 'AltLeft', bubbles: true }));
      await sleep(120);
      A(app.keytips.active() && app.keytips.level() === 0, 'Alt shows KeyTips');
      const keys = app.keytips.keys();
      A(keys.some(k => k.key === 'F' && k.kind === 'file') && keys.some(k => k.key === 'H' && k.id === 'home') && keys.some(k => k.key === 'N' && k.id === 'insert'), 'File F, Home H, Insert N: ' + keys.map(k => k.key + '=' + (k.id || k.kind)).join(' '));
      A(new Set(keys.map(k => k.key)).size === keys.length, 'every KeyTip is unique');
      A(layer.querySelectorAll('.keytip').length === keys.length, 'badges drawn');
      // typing H opens Home and shows its controls
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', code: 'KeyH', bubbles: true, cancelable: true }));
      await sleep(120);
      A(app.keytips.level() === 1 && document.querySelector('#ribbon .panel.on')?.dataset.tab === 'home', 'H opens Home');
      const ctl = app.keytips.keys();
      A(ctl.length > 8, 'controls have KeyTips: ' + ctl.length);
      A(ctl.some(k => k.id === 'format.bold' && k.key === '1'), 'Bold is 1 like Word');
      const all = ctl.map(k => k.key);
      A(all.every(k => !all.some(o => o !== k && o.startsWith(k))), 'no KeyTip is the start of another: ' + all.join(' '));
      try { await app.mk.invoke('smoke-shot', 'keytips'); } catch {}
      // Urdu keyboard: the letter comes from the key position
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ف', code: 'KeyF', bubbles: true, cancelable: true }));
      await sleep(30);
      A(app.keytips.active() && layer.querySelectorAll('.keytip:not(.off)').length >= 2 && layer.querySelectorAll('.keytip.off').length >= 4, 'F narrows to the F… KeyTips');
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
      await sleep(30);
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
      await sleep(120);
      A(app.keytips.level() === 0, 'Esc goes back to the tabs');
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
      await sleep(30);
      A(!app.keytips.active() && !layer.querySelector('.keytip'), 'Esc again hides them');
      // Alt+key shortcuts and AltGr typing do not start KeyTips
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', code: 'AltLeft', altKey: true, bubbles: true }));
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', code: 'KeyQ', altKey: true, bubbles: true }));
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', code: 'AltLeft', bubbles: true }));
      await sleep(60);
      A(!app.keytips.active(), 'Alt+Q is a shortcut, not KeyTips');
      document.querySelector('.palette.show') && app.shell?.closePalette?.();
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', code: 'ControlLeft', ctrlKey: true, bubbles: true }));
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'AltGraph', code: 'AltRight', ctrlKey: true, altKey: true, bubbles: true }));
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'AltGraph', code: 'AltRight', bubbles: true }));
      await sleep(60);
      A(!app.keytips.active(), 'AltGr does not start KeyTips');
      // with Show tabs only, the tab drops down and its controls get KeyTips; a control runs and everything closes
      app.shell?.setRibbonDisplay?.('tabs'); await sleep(350);
      await start(); await sleep(60);
      press('W'); await sleep(140);
      A(document.getElementById('ribbon').classList.contains('peek') && app.keytips.level() === 1, 'tabs only: W drops the View tab down');
      const z = app.keytips.keys().find(k => k.id === 'view.zoom100');
      if (z) {
        for (const ch of z.key) press(ch);
        await sleep(150);
        A(!app.keytips.active() && !document.getElementById('ribbon').classList.contains('peek'), 'running a control closes KeyTips and the dropped ribbon');
      }
    } finally { stop(); app.shell?.setRibbonDisplay?.(m0); app.shell?.closePalette?.(); if (app.mode !== mode0) app.setMode(mode0); await sleep(350); }
  });
})();
