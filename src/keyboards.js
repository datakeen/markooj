// Markooj — keyboards for Urdu, Arabic, Persian and Punjabi (Shahmukhi) inside the app (owner: rtl; PLAN-v5 item 60).
//
// Type right-to-left languages even when the computer has no such keyboard installed. A key is read by its position
// (KeyboardEvent.code, the place of the key on a US keyboard), so the layouts work whatever keyboard the system uses.
// When the system keyboard already types Arabic-script letters, or an input method is composing, Markooj leaves the
// key alone (IME-safe).
//
// Layouts (data below, one row per physical key: [normal, Shift, AltGr]):
//   ur   Urdu Phonetic, CRULP v1.1 — the layout most people use in Pakistan. Source: "CRULP Urdu Phonetic Keyboard
//        Layout v1.1 for Windows" (Center for Research in Urdu Language Processing, now the Center for Language
//        Engineering, KICS, UET Lahore; release notes dated 22 Oct 2007), checked key by key against Keyman's
//        urdu_phonetic_crulp 1.2.2, which was imported from the official CRULPKB.dll (MIT License, © SIL Global;
//        licenses/keyman-keyboards-LICENSE.txt). Keys that the CRULP v1.1 release notes leave empty (Shift+B, Shift+F,
//        Shift+L, AltGr+G) stay empty here, although Keyman later added letters there.
//   ar   Arabic (101), the Windows standard in Saudi Arabia (KBDA1). Western digits on the number row, like Windows.
//   fa   Persian (Standard), ISIRI 9147 as shipped with Windows (KBDFAR). Shift+Space and Shift+B type the half space
//        (ZWNJ). Both Windows layouts were read from the Microsoft keyboard layout data published on kbdlayout.info.
//   pnb  Punjabi (Shahmukhi): the Urdu Phonetic layout plus the letters Punjabi needs: Shift+B ݨ (U+0768, where
//        Keyman's CRULP layout has it), Shift+L ڵ (U+06B5), AltGr+L ݪ (U+076A) and AltGr+Y ۓ (U+06D3).
//
// Switching: the status-bar chip (EN / اردو / عربي / فارسی / پنجابی), Ctrl+Shift+K (English ⇄ the last right-to-left
// keyboard), View → Keyboard, the commands keyboard.* in Alt+Q, and File → Options → Language → Keyboard.
// View → On-screen keyboard shows the layout with clickable keys (Shift and AltGr layers).
(function () {
  'use strict';
  const app = window.app;
  if (!app) return;
  const A = app.assert || ((c, m) => { if (!c) throw new Error(m); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = app.esc || (s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));

  // ------------------------------------------------------------------ layouts (data)
  const URDU = {
    Backquote: ['ٍ', 'ً'], Digit1: ['۱', '1', '!'], Digit2: ['۲', '2', '@'], Digit3: ['۳', '3', '#'], Digit4: ['۴', '4'],
    Digit5: ['۵', '5', '٪'], Digit6: ['۶', '6'], Digit7: ['۷', '7', '&'], Digit8: ['۸', '8', '*'], Digit9: ['۹', '9', ')'],
    Digit0: ['۰', '0', '('], Minus: ['-', '_'], Equal: ['=', '+'],
    KeyQ: ['ق', 'ْ', 'ٓ'], KeyW: ['و', 'ّ', '؂'], KeyE: ['ع', 'ٰ', 'ٖ'], KeyR: ['ر', 'ڑ', 'ؓ'],
    KeyT: ['ت', 'ٹ', 'ؔ'], KeyY: ['ے', 'َ', '؁'], KeyU: ['ء', 'ئ', 'ٔ'], KeyI: ['ی', 'ِ', 'ؑ'],
    KeyO: ['ہ', 'ۃ', 'ٕ'], KeyP: ['پ', 'ُ', 'ٗ'], BracketLeft: [']', '}'], BracketRight: ['[', '{'], Backslash: ['\\', '|'],
    KeyA: ['ا', 'آ', 'ﷲ'], KeyS: ['س', 'ص', 'ؐ'], KeyD: ['د', 'ڈ', 'ﷺ'], KeyF: ['ف', ''],
    KeyG: ['گ', 'غ'], KeyH: ['ح', 'ھ', 'ؒ'], KeyJ: ['ج', 'ض', 'ﷻ'], KeyK: ['ک', 'خ'],
    KeyL: ['ل', ''], Semicolon: ['؛', ':'], Quote: ["'", '"'],
    KeyZ: ['ز', 'ذ', '؏'], KeyX: ['ش', 'ژ', '؎'], KeyC: ['چ', 'ث', '؃'], KeyV: ['ط', 'ظ', 'ؕ'],
    KeyB: ['ب', '', '﷽'], KeyN: ['ن', 'ں', '؀'], KeyM: ['م', '٘'], Comma: ['،', 'ٌ', '>'],
    Period: ['۔', '٫', '<'], Slash: ['/', '؟'],
  };
  const PUNJABI = { ...URDU, KeyB: ['ب', 'ݨ', '﷽'], KeyL: ['ل', 'ڵ', 'ݪ'], KeyY: ['ے', 'َ', 'ۓ'] };
  const ARABIC = {
    Backquote: ['ذ', 'ّ'], Digit1: ['1', '!'], Digit2: ['2', '@'], Digit3: ['3', '#'], Digit4: ['4', '$'], Digit5: ['5', '%'], Digit6: ['6', '^'],
    Digit7: ['7', '&'], Digit8: ['8', '*'], Digit9: ['9', ')'], Digit0: ['0', '('], Minus: ['-', '_'], Equal: ['=', '+'],
    KeyQ: ['ض', 'َ'], KeyW: ['ص', 'ً'], KeyE: ['ث', 'ُ'], KeyR: ['ق', 'ٌ'], KeyT: ['ف', 'لإ'],
    KeyY: ['غ', 'إ'], KeyU: ['ع', '‘'], KeyI: ['ه', '÷'], KeyO: ['خ', '×'], KeyP: ['ح', '؛'],
    BracketLeft: ['ج', '<'], BracketRight: ['د', '>'], Backslash: ['\\', '|'],
    KeyA: ['ش', 'ِ'], KeyS: ['س', 'ٍ'], KeyD: ['ي', ']'], KeyF: ['ب', '['], KeyG: ['ل', 'لأ'],
    KeyH: ['ا', 'أ'], KeyJ: ['ت', 'ـ'], KeyK: ['ن', '،'], KeyL: ['م', '/'], Semicolon: ['ك', ':'], Quote: ['ط', '"'],
    KeyZ: ['ئ', '~'], KeyX: ['ء', 'ْ'], KeyC: ['ؤ', '}'], KeyV: ['ر', '{'], KeyB: ['لا', 'لآ'],
    KeyN: ['ى', 'آ'], KeyM: ['ة', '’'], Comma: ['و', ','], Period: ['ز', '.'], Slash: ['ظ', '؟'],
  };
  const PERSIAN = {
    Backquote: ['‍', '‍'], Digit1: ['۱', '!'], Digit2: ['۲', '٬'], Digit3: ['۳', '٫'], Digit4: ['۴', 'ریال'],
    Digit5: ['۵', '٪'], Digit6: ['۶', '×'], Digit7: ['۷', '،'], Digit8: ['۸', '*'], Digit9: ['۹', ')'], Digit0: ['۰', '('],
    Minus: ['-', 'ـ'], Equal: ['=', '+'],
    KeyQ: ['ض', 'ْ'], KeyW: ['ص', 'ٌ'], KeyE: ['ث', 'ٍ'], KeyR: ['ق', 'ً'], KeyT: ['ف', 'ُ'],
    KeyY: ['غ', 'ِ'], KeyU: ['ع', 'َ'], KeyI: ['ه', 'ّ'], KeyO: ['خ', ']'], KeyP: ['ح', '['],
    BracketLeft: ['ج', '}'], BracketRight: ['چ', '{'], Backslash: ['\\', '|'],
    KeyA: ['ش', 'ؤ'], KeyS: ['س', 'ئ'], KeyD: ['ی', 'ي'], KeyF: ['ب', 'إ'], KeyG: ['ل', 'أ'],
    KeyH: ['ا', 'آ'], KeyJ: ['ت', 'ة'], KeyK: ['ن', '»'], KeyL: ['م', '«'], Semicolon: ['ک', ':'], Quote: ['گ', '؛'],
    KeyZ: ['ظ', 'ك'], KeyX: ['ط', 'ط'], KeyC: ['ز', 'ژ'], KeyV: ['ر', 'ٰ'], KeyB: ['ذ', '‌'],
    KeyN: ['د', 'ٔ'], KeyM: ['پ', 'ء'], Comma: ['و', '>'], Period: ['.', '<'], Slash: ['/', '؟'], Space: [' ', '‌'],
  };
  const LAYOUTS = {
    en: { id: 'en', chip: 'EN', name: app.tm('English'), native: 'English', title: app.tm('English (your computer’s keyboard)'), dir: 'ltr', keys: null,
      about: app.tm('Markooj leaves the keys alone and types what your computer’s keyboard types.') },
    ur: { id: 'ur', chip: 'اردو', name: app.tm('Urdu'), native: 'اردو', title: app.tm('Urdu Phonetic (CRULP)'), hint: app.tm('Phonetic (CRULP)'), lang: 'ur', script: 'ur', dir: 'rtl', keys: URDU,
      about: app.tm('The phonetic layout most people use in Pakistan: a types ا, b ب, p پ, t ت, Shift+T ٹ. Aarab are on Shift: Y zabar, I zer, P pesh, W shadd, Q jazm.') },
    ar: { id: 'ar', chip: 'عربي', name: app.tm('Arabic'), native: 'العربية', title: app.tm('Arabic (101)'), hint: app.tm('Arabic 101'), lang: 'ar', script: 'ar', dir: 'rtl', keys: ARABIC,
      about: app.tm('The standard Windows Arabic layout used in Saudi Arabia: h types ا, f ب, j ت, b لا. Harakat are on Shift: Q fatha, A kasra, E damma, X sukun, ` shadda.') },
    fa: { id: 'fa', chip: 'فارسی', name: app.tm('Persian'), native: 'فارسی', title: app.tm('Persian (Standard, ISIRI 9147)'), hint: app.tm('Standard'), lang: 'fa', script: 'fa', dir: 'rtl', keys: PERSIAN,
      about: app.tm('The Persian standard layout (ISIRI 9147) as in Windows: d types ی, ; ک, \' گ. Shift+Space types the half space (ZWNJ).') },
    pnb: { id: 'pnb', chip: 'پنجابی', name: app.tm('Punjabi (Shahmukhi)'), native: 'پنجابی', title: app.tm('Punjabi Shahmukhi (Phonetic)'), hint: app.tm('Phonetic'), lang: 'pnb', script: 'ur', dir: 'rtl', keys: PUNJABI,
      about: app.tm('The Urdu Phonetic layout with the Punjabi letters: Shift+B ݨ, Shift+L ڵ, AltGr+L ݪ, AltGr+Y ۓ.') },
  };
  const ORDER = ['en', 'ur', 'ar', 'fa', 'pnb'];
  const RTL_IDS = ORDER.filter(id => LAYOUTS[id].dir === 'rtl');
  const AR_SCRIPT = /[؀-ۿݐ-ݿࡰ-ࣿﭐ-﷿ﹰ-﻿]/;
  const MARK = /^[ؐ-ًؚ-ٰٟۖ-ۭ]$/;

  // ------------------------------------------------------------------ state
  const valid = id => (LAYOUTS[id] ? id : 'en');
  let current = 'en';
  let lastRtl = 'ur';
  function loadSettings() {
    current = valid(app.settings.get('keyboard.layout', 'en'));
    const l = app.settings.get('keyboard.lastRtl', 'ur'); lastRtl = RTL_IDS.includes(l) ? l : 'ur';
  }
  loadSettings();
  const layout = () => LAYOUTS[current];
  const isRtl = () => layout().dir === 'rtl';
  /** The character(s) a key gives in a layout: layer 0 normal, 1 Shift, 2 AltGr. '' when the layer is empty, null when the layout does not use the key. */
  function charFor(code, layer = 0, id = current) {
    const L = LAYOUTS[id]; if (!L || !L.keys) return null;
    const row = L.keys[code]; if (!row) return null;
    return row[layer] == null ? '' : row[layer];
  }

  function setLayout(id, opts = {}) {
    id = valid(id);
    const prev = current;
    current = id;
    if (LAYOUTS[id].dir === 'rtl') { lastRtl = id; if (app.settings.get('keyboard.lastRtl') !== id) app.settings.set('keyboard.lastRtl', id); }
    if (app.settings.get('keyboard.layout', 'en') !== id) app.settings.set('keyboard.layout', id);
    if (prev !== id) {
      app.events.emit('keyboard:changed', { id, prev, layout: { ...LAYOUTS[id], keys: undefined } });
      if (!opts.quiet) app.ui.toast?.(id === 'en' ? app.t('Keyboard: English. Press Ctrl+Shift+K to switch back.') : app.t('Keyboard: {layout}. Ctrl+Shift+K switches back to English.', { layout: app.t(LAYOUTS[id].title) }), { kind: 'info', timeout: 1800 });
      if (LAYOUTS[id].dir === 'rtl') startRtlHere();
    }
    paintChip(); osk.paint();
    try { app.shell?.refreshRibbon?.(); } catch {}
    return id;
  }
  const toggle = () => setLayout(current === 'en' ? lastRtl : 'en');

  // Switching to a right-to-left keyboard in an empty paragraph puts the cursor on the right at once, as typing the
  // first letter would (lang.js measures the paragraph again on input and keeps it when letters arrive).
  function startRtlHere() {
    try {
      const s = getSelection(); if (!s || !s.rangeCount) return;
      const n = s.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement);
      if (!el || !el.closest) return;
      const page = el.closest('.mk-page[contenteditable="true"]');
      const ed = el.closest('.mk-il-edit');
      const block = ed || (page && el.closest('p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote'));
      if (!block || (page && !page.contains(block))) return;
      if (String(block.textContent || '').replace(/[\s​-‏]/g, '')) return; // only an empty paragraph
      if (block.hasAttribute('dir') && !block.hasAttribute('data-mk-autodir') && !ed) return; // the author's own direction
      block.setAttribute('dir', 'rtl');
      if (!ed) block.setAttribute('data-mk-autodir', '');
    } catch {}
  }

  // ------------------------------------------------------------------ typing
  const SYNTH = new WeakSet();
  let lastTarget = null;   // the editable that had the focus last (the on-screen keyboard types there)
  let rightAlt = false;
  const editorHost = () => document.getElementById('editorHost');
  const isField = t => !!t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && /^(text|search|email|url|tel|)$/i.test(t.type || '')));
  const isEditable = t => !!t && (t.isContentEditable || isField(t));
  /** 'direct' (type into it), 'inline' (Inline mode's page: the editor opens a block for the key) or null. */
  function targetKind(t) {
    if (!t || !t.closest) return null;
    if (t.closest('[data-mk-keys="own"], .palette, .mk-osk')) return null;
    const host = editorHost();
    if (host && host.contains(t)) {
      if (isEditable(t)) return t.readOnly || t.disabled ? null : 'direct';
      if (app.mode === 'inline' && !t.closest('input,textarea,select,button')) return 'inline';
      return null;
    }
    if (app.settings.get('keyboard.everywhere', false) === true && isEditable(t) && !t.readOnly && !t.disabled) return 'direct';
    if (t.closest('[data-mk-kbd]') && isEditable(t)) return 'direct';
    return null;
  }
  /** Types text where the cursor is, as typing would: one undo step, input events for AutoCorrect, spelling and the editors. */
  function insertText(text, target) {
    const t = target || document.activeElement;
    if (!text || !t) return false;
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch {}
    if (!ok && isField(t)) {
      const s = t.selectionStart ?? t.value.length, e = t.selectionEnd ?? s;
      t.setRangeText(text, s, e, 'end');
      t.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      ok = true;
    }
    return ok;
  }
  function typeInto(kind, target, text, code) {
    if (kind === 'inline') {
      // Inline mode opens the block under the cursor for a typed key: give it the layout's character instead
      const ev = new KeyboardEvent('keydown', { key: [...text][0], code: code || '', bubbles: true, cancelable: true });
      SYNTH.add(ev); target.dispatchEvent(ev);
      const rest = [...text].slice(1).join('');
      if (rest) setTimeout(() => insertText(rest), 60);
      return true;
    }
    return insertText(text, target);
  }
  /** What this layout types for a key event: the character(s), '' for an empty key (types nothing), or null when the
   *  key is left alone (English, shortcuts, an input method, the system keyboard already typing this script). */
  function mapKey(e, target = e && e.target) {
    if (!e || current === 'en' || SYNTH.has(e) || e.isComposing) return null;
    if (e.key === 'Process' || e.key === 'Dead' || e.key === 'Unidentified' || e.metaKey) return null;
    const altGr = !!(e.getModifierState?.('AltGraph') || (rightAlt && e.altKey));
    if ((e.ctrlKey || e.altKey) && !altGr) return null; // shortcuts stay shortcuts
    const layer = altGr ? 2 : e.shiftKey ? 1 : 0;
    const ch = charFor(e.code, layer);
    if (ch == null) return null;
    // the system keyboard already types this script (or an input method is at work): leave the key alone
    if (typeof e.key === 'string' && e.key.length >= 1 && AR_SCRIPT.test(e.key)) return null;
    if (!targetKind(target)) return null;
    if (!ch) return altGr ? null : ''; // an empty key types nothing, as on the real layout
    return ch === e.key ? null : ch; // the same character: let the browser type it
  }
  function onKeyDown(e) {
    if (e.code === 'AltRight') rightAlt = true;
    if (e.defaultPrevented) return;
    const ch = mapKey(e);
    if (ch == null) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (ch) typeInto(targetKind(e.target), e.target, ch, e.code);
    osk.flash(e.code);
  }
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', e => { if (e.code === 'AltRight') rightAlt = false; }, true);
  addEventListener('blur', () => { rightAlt = false; });
  document.addEventListener('focusin', e => { const t = e.target; if (targetKind(t) === 'direct' && !t.closest('[data-mk-kbd-skip]')) lastTarget = t; }, true);

  // ------------------------------------------------------------------ status-bar chip
  let chipEl = null;
  function paintChip() {
    if (!chipEl) return; // (drawn before the status bar puts it on the page)
    const L = layout();
    chipEl.innerHTML = `<span class="mk-kbd-chip-t" ${L.dir === 'rtl' ? 'dir="rtl" lang="' + esc(L.lang) + '"' : ''}>${esc(L.chip)}</span>`;
    chipEl.classList.toggle('rtl', L.dir === 'rtl');
    chipEl.dataset.layout = L.id;
    chipEl.dataset.tip = app.t('Keyboard: {layout}', { layout: app.t(L.title) });
    chipEl.dataset.tipD = L.id === 'en' ? app.t('Click to type Urdu, Arabic, Persian or Punjabi without installing a keyboard. Ctrl+Shift+K switches to {language}.', { language: app.t(LAYOUTS[lastRtl].name) })
      : app.t('Keys type {language} wherever you write in the document. Click to choose another keyboard; Ctrl+Shift+K switches back to English.', { language: app.t(L.name) });
    chipEl.dataset.key = 'Ctrl+Shift+K';
    chipEl.setAttribute('aria-label', app.t('Keyboard: {layout}. Click to change.', { layout: app.t(L.title) }));
  }
  function menuItems() {
    const items = [{ header: app.t('Keyboard') }];
    for (const id of ORDER) {
      const L = LAYOUTS[id];
      items.push({ label: id === 'en' ? app.t('English (your keyboard)') : app.t('{language} — {native}', { language: app.t(L.name), native: L.native }), hint: L.hint ? app.t(L.hint) : '', checked: id === current, run: () => setLayout(id) });
    }
    items.push({ sep: true },
      { label: current === 'en' ? app.t('Switch to {language}', { language: app.t(LAYOUTS[lastRtl].name) }) : app.t('Switch to English'), shortcut: 'Ctrl+Shift+K', checked: false, run: () => toggle() },
      { label: osk.isOpen() ? app.t('Hide the on-screen keyboard') : app.t('Show the on-screen keyboard'), checked: osk.isOpen(), run: () => osk.toggle() },
      { label: app.t('Keyboard options…'), checked: false, run: () => openOptions() },
      { note: app.t('Works without installing anything on your computer. Keys are read by their place on the keyboard.') });
    return items;
  }
  function openMenu(anchor) {
    const a = anchor || chipEl || document.querySelector('[data-status-id="keyboard"] button') || { x: innerWidth - 160, y: innerHeight - 40 };
    if (app.ui.menu) app.ui.menu(a, menuItems(), { placement: 'top', checks: true });
  }
  app.status.addItem({ id: 'keyboard', side: 'right', order: 4, render(el) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sb mk-kbd-chip';
    b.addEventListener('mousedown', e => e.preventDefault()); // keep the cursor in the document
    b.addEventListener('click', e => { e.stopPropagation(); openMenu(b); });
    el.append(b); chipEl = b; paintChip();
  } });

  function openOptions() {
    app.backstage.open('options');
    setTimeout(() => { const s = document.querySelector('.opt-card[data-section="language"] .mk-kbd-opts') || document.querySelector('.opt-card[data-section="language"]'); if (s) { s.scrollIntoView({ block: 'start', behavior: 'smooth' }); app.ui.glow?.(s); } }, 260);
  }

  // ------------------------------------------------------------------ on-screen keyboard
  const ROWS = [
    ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', '#Backspace'],
    ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
    ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'],
    ['#Shift', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', '#AltGr'],
    ['#Space'],
  ];
  const LATIN = { Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/' };
  const latinOf = code => (/^Key[A-Z]$/.test(code) ? code.slice(3) : /^Digit\d$/.test(code) ? code.slice(5) : LATIN[code] || code);
  const INVISIBLE = { '‌': app.tm('Half space'), '‍': app.tm('Joiner'), ' ': app.tm('Space') };
  const show = ch => (!ch ? '' : INVISIBLE[ch] ? app.t(INVISIBLE[ch]) : [...ch].length === 1 && MARK.test(ch) ? '◌' + ch : ch);
  // names of the marks, for the keys' ScreenTips and screen readers (translated when the keyboard is drawn)
  const NAMES = { 'َ': app.tm('zabar (fatha)'), 'ِ': app.tm('zer (kasra)'), 'ُ': app.tm('pesh (damma)'), 'ّ': app.tm('shadd (shadda)'), 'ْ': app.tm('jazm (sukun)'), 'ً': app.tm('tanween zabar'), 'ٍ': app.tm('tanween zer'), 'ٌ': app.tm('tanween pesh'), 'ٰ': app.tm('khari zabar'), 'ٖ': app.tm('khari zer'), 'ٗ': app.tm('ulta pesh'), 'ٔ': app.tm('hamza above'), '٘': app.tm('noon ghunna mark'), '‌': app.tm('half space (ZWNJ)'), '‍': app.tm('joiner (ZWJ)') };
  const osk = (() => {
    let el = null, shift = false, altgr = false, held = false;
    const isOpen = () => !!(el && el.classList.contains('show'));
    function build() {
      el = document.createElement('div');
      el.className = 'mk-osk'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', app.t('On-screen keyboard')); el.setAttribute('data-mk-keys', 'own');
      el.addEventListener('mousedown', e => { if (!e.target.closest('select')) e.preventDefault(); }); // the cursor stays in the document
      el.addEventListener('click', onClick);
      document.body.append(el);
    }
    function paint() {
      if (!el) return;
      const id = current === 'en' ? lastRtl : current; const L = LAYOUTS[id];
      const layer = altgr ? 2 : (shift || held) ? 1 : 0;
      const hasAlt = Object.values(L.keys).some(r => r[2]);
      el.setAttribute('aria-label', app.t('On-screen keyboard'));
      const closeTip = esc(app.t('Close the on-screen keyboard'));
      let html = `<div class="mk-osk-bar"><b>${app.th('On-screen keyboard')}</b><span class="mk-osk-tabs" role="tablist">${RTL_IDS.map(k => `<button type="button" role="tab" class="mk-osk-tab${k === id ? ' on' : ''}" aria-selected="${k === id}" data-layout="${k}" data-tip="${esc(app.t(LAYOUTS[k].title))}" data-tip-d="${esc(app.t('Type with this keyboard.'))}"><span dir="rtl" lang="${esc(LAYOUTS[k].lang)}">${esc(LAYOUTS[k].chip)}</span></button>`).join('')}</span>`
        + `<span class="mk-osk-note">${current === 'en' ? app.th('Click a key to type it. Your keys still type English (Ctrl+Shift+K to switch).') : app.th('Your keyboard types {language} now. Ctrl+Shift+K switches to English.', { language: app.t(L.name) })}</span>`
        + `<button type="button" class="mk-osk-close" data-act="close" data-tip="${closeTip}" aria-label="${closeTip}">×</button></div>`;
      html += `<div class="mk-osk-keys" dir="ltr" data-layer="${layer}">`;
      for (const row of ROWS) {
        html += '<div class="mk-osk-row">';
        for (const code of row) {
          if (code === '#Backspace') { html += '<button type="button" class="mk-osk-key wide" data-act="back" data-tip="Backspace" aria-label="Backspace">⌫</button>'; continue; }
          if (code === '#Shift') { html += `<button type="button" class="mk-osk-key wide${shift ? ' on' : ''}" data-act="shift" aria-pressed="${shift}" data-tip="Shift" data-tip-d="${esc(app.t('Shows the second character of every key: aarab and more letters.'))}">⇧ Shift</button>`; continue; }
          if (code === '#AltGr') { html += hasAlt ? `<button type="button" class="mk-osk-key wide${altgr ? ' on' : ''}" data-act="altgr" aria-pressed="${altgr}" data-tip="AltGr" data-tip-d="${esc(app.t('Right Alt on a real keyboard: signs, honorifics and less common marks.'))}">AltGr</button>` : ''; continue; }
          if (code === '#Space') {
            html += `<button type="button" class="mk-osk-key space" data-code="Space" data-ch=" " aria-label="${esc(app.t('Space'))}">${app.th('Space')}</button>`;
            if (id === 'fa' || id === 'ur' || id === 'pnb') html += `<button type="button" class="mk-osk-key wide" data-ch="‌" data-tip="${esc(app.t('Half space (ZWNJ)'))}" data-tip-d="${esc(app.t('Keeps two letters apart without a full space, as in کتاب‌ها.'))}">${app.th('Half space')}</button>`;
            continue;
          }
          const ch = charFor(code, layer, id) || '';
          const markName = NAMES[ch] ? app.t(NAMES[ch]) : '';
          const name = markName ? ` — ${markName}` : '';
          html += `<button type="button" class="mk-osk-key${ch ? '' : ' empty'}${[...ch].length === 1 && MARK.test(ch) ? ' mark' : ''}" data-code="${code}" data-ch="${esc(ch)}" ${ch ? '' : 'disabled'} aria-label="${esc(latinOf(code) + (ch ? ': ' + (markName || ch) : ''))}" title="${esc(latinOf(code) + (ch ? ' → ' + ch + name : ''))}"><i>${esc(latinOf(code))}</i><span lang="${esc(L.lang)}"${INVISIBLE[ch] ? ' class="inv"' : ''}>${esc(show(ch))}</span></button>`;
        }
        html += '</div>';
      }
      html += '</div>';
      el.innerHTML = html;
    }
    function target() {
      const a = document.activeElement;
      if (a && targetKind(a) === 'direct') return a;
      if (lastTarget && lastTarget.isConnected) { try { lastTarget.focus({ preventScroll: true }); } catch {} return lastTarget; }
      try { app.editors.active()?.focus?.(); } catch {}
      const b = document.activeElement;
      return b && targetKind(b) === 'direct' ? b : null;
    }
    function onClick(e) {
      const b = e.target.closest('button'); if (!b) return;
      app.ui.ripple?.(b);
      const act = b.dataset.act;
      if (act === 'close') { close(); return; }
      if (act === 'shift') { shift = !shift; paint(); return; }
      if (act === 'altgr') { altgr = !altgr; paint(); return; }
      if (b.dataset.layout) { setLayout(b.dataset.layout); return; }
      const t = target();
      if (!t) { app.ui.toast?.(app.t('Click in the document first, then click a key.'), { kind: 'info', timeout: 2000 }); return; }
      if (act === 'back') { try { document.execCommand('delete'); } catch {} return; }
      const ch = b.dataset.ch;
      if (ch != null && ch !== '') { insertText(ch, t); if (shift && !held) { shift = false; paint(); } }
    }
    function open() { if (!el) build(); paint(); el.classList.add('show'); document.body.classList.add('mk-osk-open'); if (app.settings.get('keyboard.onScreen') !== true) app.settings.set('keyboard.onScreen', true); app.events.emit('keyboard:onscreen', true); try { app.shell?.refreshRibbon?.(); } catch {} }
    function close() { if (el) el.classList.remove('show'); document.body.classList.remove('mk-osk-open'); if (app.settings.get('keyboard.onScreen') === true) app.settings.set('keyboard.onScreen', false); app.events.emit('keyboard:onscreen', false); try { app.shell?.refreshRibbon?.(); } catch {} }
    function flash(code) {
      if (!isOpen() || !code) return;
      const k = el.querySelector(`.mk-osk-key[data-code="${code}"]`); if (!k) return;
      k.classList.add('down'); setTimeout(() => k.classList.remove('down'), 140);
    }
    // holding the real Shift or AltGr shows that layer
    document.addEventListener('keydown', e => { if (!isOpen()) return; if (e.key === 'Shift' && !held) { held = true; paint(); } }, true);
    document.addEventListener('keyup', e => { if (!isOpen()) return; if (e.key === 'Shift' && held) { held = false; paint(); } }, true);
    return { open, close, toggle: () => (isOpen() ? close() : open()), isOpen, paint, flash, element: () => el };
  })();

  // ------------------------------------------------------------------ icons, commands, ribbon
  function addIcons() {
    const defs = document.querySelector('svg defs'); if (!defs || document.getElementById('mk-kbd')) return;
    const ns = 'http://www.w3.org/2000/svg';
    const sym = (id, d) => { const s = document.createElementNS(ns, 'symbol'); s.setAttribute('id', id); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = d; defs.appendChild(s); };
    const board = '<rect x="2.5" y="6" width="19" height="12" rx="2.2"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6 13h.01M18 13h.01M8.5 15h7"/>';
    sym('mk-kbd', board);
    sym('mk-kbd-osk', board + '<path d="M12 2.5v2"/>');
    sym('mk-kbd-switch', '<path d="M4 8h13M14 5l3 3-3 3M20 16H7M10 13l-3 3 3 3"/>');
  }
  const C = (id, def) => app.commands.register(id, { category: 'Keyboard', group: 'Keyboard', ...def });
  C('keyboard.toggle', {
    label: app.tm('Switch keyboard (English ⇄ Urdu, Arabic…)'), icon: 'mk-kbd-switch', shortcut: 'Ctrl+Shift+K', global: true,
    description: app.tm('Switch between English and the last right-to-left keyboard you used (Urdu, Arabic, Persian or Punjabi). Works without installing a keyboard on your computer.'),
    isActive: () => current !== 'en', run: () => toggle(),
  });
  C('keyboard.menu', { label: app.tm('Keyboard'), icon: 'mk-kbd', description: app.tm('Choose the keyboard for typing: English, Urdu Phonetic, Arabic (101), Persian (Standard) or Punjabi (Shahmukhi).'), isActive: () => current !== 'en', run: (a = {}) => (a.value ? setLayout(a.value) : openMenu(document.querySelector('#ribbon [data-tip-cmd="keyboard.menu"]') || chipEl)) });
  C('keyboard.set', { label: app.tm('Set keyboard'), description: app.tm('Set the typing keyboard by its code: en, ur, ar, fa or pnb.'), hidden: true, palette: false, run: (a = {}) => setLayout(a.value || a.id || a) });
  // one command per keyboard; each label and description is whole text, so the palette can translate it
  const LAYOUT_CMDS = {
    en: { label: app.tm('Keyboard: English'), description: app.tm('Type with your computer’s own keyboard again.') },
    ur: { label: app.tm('Keyboard: Urdu Phonetic (CRULP)'), description: app.tm('Type Urdu with the Urdu Phonetic (CRULP) layout, without installing it on your computer. The phonetic layout most people use in Pakistan: a types ا, b ب, p پ, t ت, Shift+T ٹ. Aarab are on Shift: Y zabar, I zer, P pesh, W shadd, Q jazm.') },
    ar: { label: app.tm('Keyboard: Arabic (101)'), description: app.tm('Type Arabic with the Arabic (101) layout, without installing it on your computer. The standard Windows Arabic layout used in Saudi Arabia: h types ا, f ب, j ت, b لا. Harakat are on Shift: Q fatha, A kasra, E damma, X sukun, ` shadda.') },
    fa: { label: app.tm('Keyboard: Persian (Standard, ISIRI 9147)'), description: app.tm('Type Persian with the Persian (Standard, ISIRI 9147) layout, without installing it on your computer. The Persian standard layout (ISIRI 9147) as in Windows: d types ی, ; ک, \' گ. Shift+Space types the half space (ZWNJ).') },
    pnb: { label: app.tm('Keyboard: Punjabi Shahmukhi (Phonetic)'), description: app.tm('Type Punjabi (Shahmukhi) with the Punjabi Shahmukhi (Phonetic) layout, without installing it on your computer. The Urdu Phonetic layout with the Punjabi letters: Shift+B ݨ, Shift+L ڵ, AltGr+L ݪ, AltGr+Y ۓ.') },
  };
  for (const id of ORDER) {
    C('keyboard.' + ({ en: 'english', ur: 'urdu', ar: 'arabic', fa: 'persian', pnb: 'punjabi' })[id], {
      label: LAYOUT_CMDS[id].label, icon: 'mk-kbd', description: LAYOUT_CMDS[id].description,
      isActive: () => current === id, run: () => setLayout(id),
    });
  }
  C('keyboard.onScreen', { label: app.tm('On-screen keyboard'), icon: 'mk-kbd-osk', description: app.tm('Show the keys of the Urdu, Arabic, Persian or Punjabi keyboard on screen. Click a key to type it; Shift shows aarab and more letters.'), isActive: () => osk.isOpen(), run: () => osk.toggle() });
  C('keyboard.options', { label: app.tm('Keyboard options'), icon: 'mk-kbd', description: app.tm('Choose the typing keyboard and where it types, in File → Options → Language.'), run: () => openOptions() });
  if (app.tooltips?.register) {
    app.tooltips.register('keyboard.toggle', { title: app.tm('Switch keyboard'), description: app.tm('English ⇄ the last right-to-left keyboard (Urdu, Arabic, Persian or Punjabi). Nothing to install.') });
    app.tooltips.register('keyboard.menu', { title: app.tm('Keyboard'), description: app.tm('Type Urdu, Arabic, Persian or Punjabi (Shahmukhi) with the layout people use most, without installing it.') });
    app.tooltips.register('keyboard.onScreen', { title: app.tm('On-screen keyboard'), description: app.tm('See every key of the layout. Click a key to type it; Shift shows aarab.') });
    app.tooltips.register('keyboard.options', { title: app.tm('Keyboard options'), description: app.tm('Typing keyboard and where it types.') });
  }
  function addRibbon() {
    app.ribbon.addGroup('view', { id: 'keyboard', label: app.tm('Keyboard'), order: 22, items: [
      { type: 'big', command: 'keyboard.menu', label: app.tm('Keyboard'), icon: 'mk-kbd' },
      { type: 'col', items: [
        { type: 'small', command: 'keyboard.toggle', label: app.tm('Switch keyboard'), icon: 'mk-kbd-switch', showLabel: true },
        { type: 'small', command: 'keyboard.onScreen', label: app.tm('On-screen'), icon: 'mk-kbd-osk', showLabel: true },
      ] },
    ] });
  }

  // ------------------------------------------------------------------ File → Options → Language → Keyboard (drawn by lang.js)
  function renderOptions(el) {
    const box = document.createElement('div'); box.className = 'mk-kbd-opts';
    box.innerHTML = `<div class="lang-head"><h4>${app.th('Keyboard')}</h4></div>`;
    const row = (label, small, control) => { const r = document.createElement('div'); r.className = 'opt-row'; r.innerHTML = `<div class="ol"><b>${esc(label)}</b><small>${esc(small)}</small></div><div class="oc"></div>`; r.querySelector('.oc').append(control); return r; };
    const sel = document.createElement('select'); sel.className = 'sel'; sel.setAttribute('aria-label', app.t('Typing keyboard'));
    sel.dataset.tip = app.t('Typing keyboard'); sel.dataset.tipD = app.t('The layout your keys type in documents. Nothing is installed on your computer.');
    for (const id of ORDER) sel.append(new Option(app.t(LAYOUTS[id].title), id, false, id === current));
    sel.addEventListener('change', () => { setLayout(sel.value); app.ui.check?.(sel); });
    box.append(row(app.t('Typing keyboard'), app.t('Type Urdu, Arabic, Persian or Punjabi without installing a keyboard. Switch any time on the status bar or with Ctrl+Shift+K.'), sel));
    const sel2 = document.createElement('select'); sel2.className = 'sel'; sel2.setAttribute('aria-label', app.t('Ctrl+Shift+K switches to'));
    sel2.dataset.tip = app.t('Ctrl+Shift+K switches to'); sel2.dataset.tipD = app.t('The right-to-left keyboard that Ctrl+Shift+K and the status bar switch to.');
    for (const id of RTL_IDS) sel2.append(new Option(app.t(LAYOUTS[id].title), id, false, id === lastRtl));
    sel2.addEventListener('change', () => { lastRtl = sel2.value; app.settings.set('keyboard.lastRtl', lastRtl); paintChip(); app.ui.check?.(sel2); });
    box.append(row(app.t('Keyboard for Ctrl+Shift+K'), app.t('Ctrl+Shift+K and the status bar switch between English and this keyboard.'), sel2));
    const sw = app.shell?.settingSwitch;
    if (sw) {
      box.append(sw('keyboard.everywhere', false, app.t('Also type in search boxes and dialogs'), app.t('Off: only the document uses the keyboard, so the command search (Alt+Q) and Find stay in English letters.')));
      box.append(sw('keyboard.onScreen', false, app.t('Show the on-screen keyboard'), app.t('Keys with their letters at the bottom of the window. Click a key to type it.'), v => (v ? osk.open() : osk.close())));
    }
    const note = document.createElement('small'); note.className = 'mk-kbd-about';
    note.textContent = app.t('Already have an Urdu, Arabic or Persian keyboard on your computer? Keep English here and use yours: Markooj never changes keys that already type these letters.');
    box.append(note);
    el.append(box);
    return box;
  }

  // ------------------------------------------------------------------ boot
  app.events.on('settings:changed', ({ key } = {}) => {
    if (key === 'keyboard.layout') { const v = valid(app.settings.get('keyboard.layout', 'en')); if (v !== current) setLayout(v, { quiet: true }); }
    if (key === 'keyboard.onScreen') { const v = app.settings.get('keyboard.onScreen') === true; if (v !== osk.isOpen()) (v ? osk.open() : osk.close()); }
  });
  // a new interface language: the chip and an open on-screen keyboard are drawn again
  app.events.on('i18n:changed', () => { try { paintChip(); if (osk.isOpen()) osk.paint(); } catch (e) { console.warn('keyboard i18n', e); } });
  app.events.on('ready', () => {
    addIcons(); addRibbon(); loadSettings(); paintChip();
    if (app.settings.get('keyboard.onScreen') === true) osk.open();
  });
  addIcons();

  app.keyboards = {
    layouts: () => ORDER.map(id => ({ ...LAYOUTS[id], keys: LAYOUTS[id].keys ? { ...LAYOUTS[id].keys } : null })),
    get: id => (LAYOUTS[id] ? { ...LAYOUTS[id] } : null),
    current: () => current, lastRtl: () => lastRtl, isRtl, set: setLayout, toggle, charFor, mapKey, insertText, openMenu, menuItems, openOptions, renderOptions,
    onScreen: osk,
  };

  // ------------------------------------------------------------------ smoke tests
  const key = (target, code, k, o = {}) => { const ev = new KeyboardEvent('keydown', { code, key: k, bubbles: true, cancelable: true, ...o }); target.dispatchEvent(ev); return ev; };
  const typeCodes = (target, seq) => { for (const [code, k, shift] of seq) key(target, code, k, { shiftKey: !!shift }); };
  async function until(fn, ms = 4000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch {} await sleep(30); } return false; }
  async function withDoc(text, mode, fn) {
    const m0 = app.mode, prev = app.docs.active(), k0 = current;
    const d = app.docs.create({ text, title: 'Keyboard test' });
    try { app.setMode(mode); await sleep(mode === 'simple' ? 700 : 300); await app.editors.active()?.refresh?.(); await sleep(80); return await fn(d, app.editors.active()); }
    finally { setLayout(k0, { quiet: true }); await app.docs.close(d.id, { force: true }); if (prev && app.docs.get(prev.id)) app.docs.activate(prev.id); app.setMode(m0); await sleep(150); }
  }
  app.tests.register('kbd: layouts are complete and match their published sources', () => {
    const LETTERS = 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('').map(c => 'Key' + c);
    for (const id of RTL_IDS) { const miss = LETTERS.filter(c => !charFor(c, 0, id)); A(!miss.length, id + ': keys without a letter: ' + miss.join(' ')); }
    // Urdu Phonetic (CRULP v1.1)
    const ur = (c, l = 0) => charFor(c, l, 'ur');
    A(ur('KeyA') === 'ا' && ur('KeyB') === 'ب' && ur('KeyP') === 'پ' && ur('KeyT') === 'ت' && ur('KeyT', 1) === 'ٹ' && ur('KeyD', 1) === 'ڈ' && ur('KeyR', 1) === 'ڑ', 'CRULP letters: a ا, b ب, p پ, t ت, T ٹ, D ڈ, R ڑ');
    A(ur('KeyK') === 'ک' && ur('KeyG') === 'گ' && ur('KeyO') === 'ہ' && ur('KeyY') === 'ے' && ur('KeyI') === 'ی' && ur('KeyN', 1) === 'ں' && ur('KeyH', 1) === 'ھ' && ur('KeyA', 1) === 'آ' && ur('KeyX', 1) === 'ژ', 'CRULP letters: k ک, g گ, o ہ, y ے, i ی, N ں, H ھ, A آ, X ژ');
    A(ur('KeyY', 1) === 'َ' && ur('KeyI', 1) === 'ِ' && ur('KeyP', 1) === 'ُ' && ur('KeyW', 1) === 'ّ' && ur('KeyQ', 1) === 'ْ' && ur('KeyE', 1) === 'ٰ', 'CRULP aarab on Shift: zabar Y, zer I, pesh P, shadd W, jazm Q, khari zabar E');
    A(ur('Backquote') === 'ٍ' && ur('Backquote', 1) === 'ً' && ur('Comma', 1) === 'ٌ', 'CRULP tanween: ` zer, Shift+` zabar, Shift+, pesh');
    A(ur('Period') === '۔' && ur('Comma') === '،' && ur('Semicolon') === '؛' && ur('Slash', 1) === '؟' && ur('Digit1') === '۱' && ur('Digit1', 1) === '1', 'CRULP punctuation and digits');
    A(ur('KeyB', 1) === '' && ur('KeyF', 1) === '' && ur('KeyL', 1) === '', 'keys CRULP v1.1 leaves empty stay empty');
    // Punjabi (Shahmukhi)
    A(charFor('KeyB', 1, 'pnb') === 'ݨ' && charFor('KeyL', 1, 'pnb') === 'ڵ' && charFor('KeyY', 2, 'pnb') === 'ۓ' && charFor('KeyT', 1, 'pnb') === 'ٹ', 'Shahmukhi: Shift+B ݨ, Shift+L ڵ, AltGr+Y ۓ, Urdu letters kept');
    // Arabic (101)
    const ar = (c, l = 0) => charFor(c, l, 'ar');
    A(ar('KeyH') === 'ا' && ar('KeyF') === 'ب' && ar('KeyJ') === 'ت' && ar('KeyB') === 'لا' && ar('Backquote') === 'ذ' && ar('KeyM') === 'ة' && ar('KeyQ', 1) === 'َ' && ar('KeyX', 1) === 'ْ' && ar('Slash', 1) === '؟', 'Arabic 101');
    // Persian (Standard)
    const fa = (c, l = 0) => charFor(c, l, 'fa');
    A(fa('KeyD') === 'ی' && fa('Semicolon') === 'ک' && fa('Quote') === 'گ' && fa('KeyM') === 'پ' && fa('BracketRight') === 'چ' && fa('KeyC', 1) === 'ژ' && fa('Space', 1) === '‌' && fa('Digit4') === '۴', 'Persian standard (ISIRI 9147)');
  });
  app.tests.register('kbd: typing Urdu in Simple mode, IME-safe, and Ctrl+Shift+K switches', async () => {
    await withDoc('Start\n\n', 'simple', async (d, ad) => {
      const ta = document.querySelector('.mk-src-ta'); A(ta, 'Simple mode text box');
      ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      setLayout('ur', { quiet: true });
      // (a test key event never types by itself: only the keys Markooj changes appear, so there is no space here)
      typeCodes(ta, [['KeyK', 'k'], ['KeyT', 't'], ['KeyA', 'a'], ['KeyB', 'b'], ['KeyT', 'T', true], ['KeyO', 'o'], ['KeyP', 'p'], ['KeyI', 'i'], ['Period', '.']]);
      await sleep(80);
      A(ta.value.endsWith('کتابٹہپی۔'), 'typed: ' + JSON.stringify(ta.value));
      await until(() => d.text === ta.value, 2000);
      A(d.text.includes('کتاب'), 'the document has the Urdu text: ' + JSON.stringify(d.text));
      // the system keyboard already types Urdu: Markooj does not touch the key
      const before = ta.value;
      const ev = key(ta, 'KeyF', 'ب');
      A(!ev.defaultPrevented && ta.value === before, 'a key that already types Arabic script is left alone');
      // an input method at work is left alone too
      const ev2 = key(ta, 'KeyA', 'Process');
      A(!ev2.defaultPrevented, 'IME composing key left alone');
      // Shift+F has no letter in CRULP v1.1: nothing is typed, and no Latin F either
      const ev3 = key(ta, 'KeyF', 'F', { shiftKey: true });
      A(ev3.defaultPrevented && ta.value === before, 'an empty key types nothing');
      // Ctrl+Shift+K goes to English and back
      A(app.shell?.findCommandFor?.('Ctrl+Shift+K')?.id === 'keyboard.toggle', 'Ctrl+Shift+K runs keyboard.toggle');
      await app.commands.run('keyboard.toggle'); A(current === 'en', 'English after the switch');
      const ev4 = key(ta, 'KeyA', 'a'); A(!ev4.defaultPrevented, 'English: keys are not changed');
      await app.commands.run('keyboard.toggle'); A(current === 'ur', 'back to the last right-to-left keyboard');
      A(!(app.keys?.conflicts?.() || []).length, 'no shortcut conflicts: ' + JSON.stringify(app.keys?.conflicts?.()));
    });
  });
  app.tests.register('kbd: typing Arabic in Word mode starts a right-to-left paragraph', async () => {
    await withDoc('English paragraph.\n\n', 'word', async (d, ad) => {
      const page = ad.page || document.querySelector('.mk-page[contenteditable="true"]'); A(page, 'Word page');
      await until(() => page.querySelector('p'));
      // an empty paragraph after the English one
      const p0 = page.querySelector('p'); page.focus();
      const r = document.createRange(); r.selectNodeContents(p0); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r);
      document.execCommand('insertParagraph');
      await sleep(60);
      setLayout('ar');
      const p1 = (() => { const s = getSelection(); const n = s.anchorNode; return (n.nodeType === 1 ? n : n.parentElement).closest('p'); })();
      A(p1 && p1 !== p0 && getComputedStyle(p1).direction === 'rtl', 'the empty paragraph turns right to left when the Arabic keyboard is chosen');
      typeCodes(page, [['KeyR', 'r'], ['KeyG', 'g'], ['KeyE', 'e'], ['KeyE', 'q', true]]);
      await sleep(80);
      A(/قلث/.test(p1.textContent) && p1.textContent.includes('ُ'), 'typed Arabic: ' + JSON.stringify(p1.textContent));
      A(getComputedStyle(p1).direction === 'rtl', 'still right to left');
      ad._commit?.(); ad.flush?.(); await until(() => /قلث/.test(d.text), 2000);
      A(/English paragraph\.\n\nقلثُ/.test(d.text), 'saved as Markdown: ' + JSON.stringify(d.text));
    });
  });
  app.tests.register('kbd: typing Persian in Inline mode and the on-screen keyboard', async () => {
    await withDoc('Hello\n', 'inline', async (d, ad) => {
      await ad.setSelection?.(5, 5); await ad.whenIdle?.(); await sleep(80);
      const ed = document.querySelector('.mk-il-edit'); A(ed, 'Inline block editor open');
      setLayout('fa', { quiet: true });
      typeCodes(ed, [['KeyD', 'd'], ['Space', ' ', true], ['Semicolon', ';']]);
      await sleep(80);
      A(ed.textContent.includes('Helloی‌ک'), 'Persian with a half space (Shift+Space): ' + JSON.stringify(ed.textContent));
      // the on-screen keyboard types where the cursor is
      osk.open(); await sleep(60);
      const kEl = osk.element().querySelector('.mk-osk-key[data-code="KeyH"]'); A(kEl && kEl.dataset.ch === 'ا', 'on-screen key H is ا');
      kEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); kEl.click();
      await sleep(60);
      A(ed.textContent.endsWith('کا'), 'clicked key typed: ' + JSON.stringify(ed.textContent));
      const sh = osk.element().querySelector('[data-act="shift"]'); sh.click(); await sleep(30);
      A(osk.element().querySelector('.mk-osk-key[data-code="KeyU"]').dataset.ch === 'َ', 'Shift layer shows zabar on U');
      try { await app.mk.invoke('smoke-shot', 'keyboard-onscreen'); } catch {}
      osk.close(); A(!osk.isOpen(), 'closed');
      await ad.whenIdle?.();
    });
  });
  app.tests.register('kbd: status bar chip, ribbon, palette and Options', async () => {
    const k0 = current;
    try {
      setLayout('ur', { quiet: true }); app.status.refresh?.(); await sleep(60);
      const chip = document.querySelector('.mk-kbd-chip'); A(chip && chip.textContent.trim() === 'اردو' && chip.dataset.layout === 'ur', 'chip shows اردو: ' + (chip && chip.textContent));
      setLayout('en', { quiet: true }); A(document.querySelector('.mk-kbd-chip').textContent.trim() === 'EN', 'chip shows EN');
      const view = app.ribbon.tabs().find(t => t.id === 'view'); A(view.groups.some(g => g.id === 'keyboard'), 'View → Keyboard group');
      for (const id of ['keyboard.toggle', 'keyboard.menu', 'keyboard.onScreen', 'keyboard.urdu', 'keyboard.arabic', 'keyboard.persian', 'keyboard.punjabi', 'keyboard.english']) {
        const c = app.commands.get(id); A(c && !c.hidden && c.description, id + ' is in the palette with a description');
        if (app.tooltips?.info) A(app.tooltips.info(id)?.title, id + ' ScreenTip');
      }
      const el = document.createElement('div'); renderOptions(el);
      A(el.querySelectorAll('select').length === 2 && /Typing keyboard/.test(el.textContent) && /Ctrl\+Shift\+K/.test(el.textContent), 'Options: keyboard rows');
      const items = menuItems(); A(items.filter(i => i.label).length >= 7 && items.some(i => i.shortcut === 'Ctrl+Shift+K'), 'chip menu');
    } finally { setLayout(k0, { quiet: true }); }
  });
})();
