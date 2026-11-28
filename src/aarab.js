// Markooj — aarab (harakat) for Urdu, Arabic, Persian and Punjabi (owner: rtl; PLAN-v5 item 82, language roadmap Part 3 "Aarab I").
//
// - Remove aarab with one click: from the selection, or from the whole document when nothing is selected (code is left alone).
// - Add one mark to the letter before the cursor: zabar, zer, pesh, shadd, jazm, tanween (zabar, zer, pesh) and khari zabar.
//   Clicking the same mark again takes it off; another vowel mark replaces the one there; shadd goes together with a vowel.
// - Show / Hide aarab: a view setting. Read mode and the Simple mode preview draw the text without the marks; the file keeps
//   them. (Word and Inline modes always show the marks, because there you edit them.)
// - Add aarab from the language pack's word list, only where the list knows exactly one reading of a word. Words with
//   several readings (علم: عِلْم / عَلَم) are left as they are and counted. The chooser for those is roadmap Part 4: it plugs in
//   through the hook app.aarab.chooseReading = async ({word, readings, lang}) => reading | null.
// Home → Aarab (shown while a right-to-left keyboard is on, or the document is in Urdu, Arabic, Persian or Punjabi, or has
// Arabic-script text; File → Options → Language can show it always or never), the commands aarab.* in Alt+Q, Ctrl+Alt+Shift keys
// and KeyTips (Alt, H, D…).
(function () {
  'use strict';
  const app = window.app;
  if (!app) return;
  const A = app.assert || ((c, m) => { if (!c) throw new Error(m); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = app.esc || (s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));

  // ------------------------------------------------------------------ marks
  const SHADD = 'ّ';
  // label, ScreenTip title and descriptions are whole texts, so the palette and ScreenTips can translate them
  const MARKS = [
    { id: 'zabar', ch: 'َ', label: app.tm('Zabar'), also: 'fatha', key: 'Ctrl+Alt+Shift+A', tip: 'DA', tipTitle: app.tm('Zabar ◌َ'),
      description: app.tm('Add zabar (fatha, ◌َ) to the letter before the cursor. Click again to take it off.'),
      tipDesc: app.tm('Adds zabar (fatha) to the letter before the cursor. Click again to take it off.') },
    { id: 'zer', ch: 'ِ', label: app.tm('Zer'), also: 'kasra', key: 'Ctrl+Alt+Shift+I', tip: 'DI', tipTitle: app.tm('Zer ◌ِ'),
      description: app.tm('Add zer (kasra, ◌ِ) to the letter before the cursor. Click again to take it off.'),
      tipDesc: app.tm('Adds zer (kasra) to the letter before the cursor. Click again to take it off.') },
    { id: 'pesh', ch: 'ُ', label: app.tm('Pesh'), also: 'damma', key: 'Ctrl+Alt+Shift+U', tip: 'DU', tipTitle: app.tm('Pesh ◌ُ'),
      description: app.tm('Add pesh (damma, ◌ُ) to the letter before the cursor. Click again to take it off.'),
      tipDesc: app.tm('Adds pesh (damma) to the letter before the cursor. Click again to take it off.') },
    { id: 'shadd', ch: SHADD, label: app.tm('Shadd'), also: 'shadda, tashdid', key: 'Ctrl+Alt+Shift+S', tip: 'DS', tipTitle: app.tm('Shadd ◌ّ'),
      description: app.tm('Add shadd (shadda, tashdid, ◌ّ) to the letter before the cursor. Click again to take it off.'),
      tipDesc: app.tm('Adds shadd (shadda, tashdid) to the letter before the cursor. Click again to take it off.') },
    { id: 'jazm', ch: 'ْ', label: app.tm('Jazm'), also: 'sukun', key: 'Ctrl+Alt+Shift+J', tip: 'DJ', tipTitle: app.tm('Jazm ◌ْ'),
      description: app.tm('Add jazm (sukun, ◌ْ) to the letter before the cursor. Click again to take it off.'),
      tipDesc: app.tm('Adds jazm (sukun) to the letter before the cursor. Click again to take it off.') },
    { id: 'tanweenZabar', ch: 'ً', label: app.tm('Tanween zabar'), also: 'fathatan, do zabar', key: 'Ctrl+Alt+Shift+N', tip: 'DN', tipTitle: app.tm('Tanween zabar ◌ً'),
      description: app.tm('Add tanween zabar (fathatan, do zabar, ◌ً) to the letter before the cursor. Click again to take it off.'),
      tipDesc: app.tm('Adds tanween zabar (fathatan, do zabar) to the letter before the cursor. Click again to take it off.') },
    { id: 'tanweenZer', ch: 'ٍ', label: app.tm('Tanween zer'), also: 'kasratan, do zer', key: '', tip: 'DE', tipTitle: app.tm('Tanween zer ◌ٍ'),
      description: app.tm('Add tanween zer (kasratan, do zer, ◌ٍ) to the letter before the cursor. Click again to take it off. Also in the on-screen keyboard (View → On-screen).'),
      tipDesc: app.tm('Adds tanween zer (kasratan, do zer) to the letter before the cursor. Click again to take it off.') },
    { id: 'tanweenPesh', ch: 'ٌ', label: app.tm('Tanween pesh'), also: 'dammatan, do pesh', key: '', tip: 'DP', tipTitle: app.tm('Tanween pesh ◌ٌ'),
      description: app.tm('Add tanween pesh (dammatan, do pesh, ◌ٌ) to the letter before the cursor. Click again to take it off. Also in the on-screen keyboard (View → On-screen).'),
      tipDesc: app.tm('Adds tanween pesh (dammatan, do pesh) to the letter before the cursor. Click again to take it off.') },
    { id: 'khariZabar', ch: 'ٰ', label: app.tm('Khari zabar'), also: 'superscript alef', key: 'Ctrl+Alt+Shift+K', tip: 'DK', tipTitle: app.tm('Khari zabar ◌ٰ'),
      description: app.tm('Add khari zabar (superscript alef, ◌ٰ) to the letter before the cursor. Click again to take it off.'),
      tipDesc: app.tm('Adds khari zabar (superscript alef) to the letter before the cursor. Click again to take it off.') },
  ];
  // the aarab that Remove takes away: harakat, tanween, shadd, jazm, khari zabar, khari zer, ulta pesh. Never the madda or
  // hamza marks (U+0653-0655), which belong to letters such as آ and ۂ.
  const AARAB = 'ً-ْٰٖٗ';
  const AARAB_RE = new RegExp(`[${AARAB}]`, 'g');
  const isAarab = c => new RegExp(`^[${AARAB}]$`).test(c);
  const VOWELS = new Set(['َ', 'ِ', 'ُ', 'ً', 'ٍ', 'ٌ', 'ْ', 'ٰ', 'ٖ', 'ٗ']);
  const COMB = /^[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]$/;
  const LETTER = /^[ؠ-يٮ-ٯٱ-ۓەۮ-ۯۺ-ۼۿݐ-ݿࢠ-ࣉ]$/;
  const AR_LETTERS = /[ؠ-يٱ-ۓݐ-ݿ]/;
  const WORD_RE = /[ؠ-ٰٟ-ۓەۮۯۺ-ۼۿݐ-ݿࢠ-ࣉ]+/g;

  /** Removes aarab from plain text → {text, n} (n = marks removed). */
  function strip(text) { let n = 0; const t = String(text || '').replace(AARAB_RE, () => { n++; return ''; }); return { text: t, n }; }
  /** Runs fn on the parts of Markdown that are not code (fenced blocks and `inline code`), adding up its counts. */
  function mapProse(md, fn) {
    const parts = String(md).split(/((?:^|\n)[ \t]{0,3}(?:```|~~~)[^\n]*\n[\s\S]*?\n[ \t]{0,3}(?:```|~~~)[ \t]*(?=\n|$)|`[^`\n]+`)/);
    const total = {}; let out = '';
    parts.forEach((p, i) => {
      if (i % 2) { out += p; return; }
      const r = fn(p); out += r.text;
      for (const [k, v] of Object.entries(r)) if (k !== 'text') total[k] = Array.isArray(v) ? (total[k] || []).concat(v) : (total[k] || 0) + v;
    });
    return { ...total, text: out };
  }
  /** The marks of a letter after one mark button: shadd toggles; a vowel mark toggles or replaces the one there. */
  function applyMark(marks, mark) {
    const list = [...String(marks || '')];
    const keep = list.filter(c => !isAarab(c));
    let sh = list.includes(SHADD);
    let vowel = list.find(c => VOWELS.has(c)) || '';
    if (mark === SHADD) sh = !sh; else vowel = vowel === mark ? '' : mark;
    return keep.join('') + (sh ? SHADD : '') + vowel;
  }
  /** Adds the one known reading of each plain word: map word → Set(readings). → {text, added, ambiguous[], unknown} */
  function addFromMap(text, map) {
    let added = 0, unknown = 0; const ambiguous = [];
    const t = String(text || '').replace(WORD_RE, w => {
      if (new RegExp(`[${AARAB}]`).test(w)) return w; // already has aarab
      const rs = map.get(w.normalize('NFC'));
      if (!rs || !rs.size) { unknown++; return w; }
      if (rs.size === 1) { added++; return [...rs][0]; }
      ambiguous.push(w); return w;
    });
    return { text: t, added, ambiguous, unknown };
  }
  /** word → Set of aarab readings from a pack's word list ({fields, rows}); a reading must be the same word once the marks go. */
  function readingsOf(lex) {
    const map = new Map();
    if (!lex || !Array.isArray(lex.fields) || !Array.isArray(lex.rows)) return map;
    const wi = lex.fields.indexOf('word'), ai = lex.fields.indexOf('aarab');
    if (wi < 0 || ai < 0) return map;
    for (const r of lex.rows) {
      const w = String(r[wi] || '').normalize('NFC'), a = String(r[ai] || '').normalize('NFC');
      if (!w || !a || a === w || strip(a).text !== w) continue;
      if (!map.has(w)) map.set(w, new Set());
      map.get(w).add(canon(a));
    }
    return map;
  }
  // one spelling per reading, whatever order the marks were typed in: shadd first, then the vowel
  function canon(word) { return String(word).replace(new RegExp(`([${AARAB}]{2,})`, 'g'), m => { const s = [...m]; return (s.includes(SHADD) ? SHADD : '') + s.filter(c => c !== SHADD).join(''); }); }

  // ------------------------------------------------------------------ editing in every mode
  const editorHost = () => document.getElementById('editorHost');
  const SKIP = 'pre,code,kbd,.katex,.mk-math,[contenteditable="false"],[data-mk-ui]';
  function editableDoc() { const d = app.docs.active(); return d && d.kind === 'markdown' && !d.readOnly ? d : null; }
  function why() { const d = app.docs.active(); return !d ? app.t('Open or create a document first.') : d.kind !== 'markdown' ? app.t('Use Edit as text to make an editable copy first.') : d.readOnly ? app.t('This document is read-only.') : app.mode === 'read' ? app.t('Read mode is for reading. Press Esc to go back to editing.') : ''; }
  const canEdit = () => !!editableDoc() && app.mode !== 'read';
  /** The editable element with the cursor: {kind: 'ta', el} (Simple mode), {kind: 'ce', el} (Word page, Inline block or cell) or null. */
  function context() {
    const host = editorHost();
    const pick = () => {
      const a = document.activeElement;
      if (!a || !host || !host.contains(a)) return null;
      if (a.tagName === 'TEXTAREA') return { kind: 'ta', el: a };
      if (a.isContentEditable) return { kind: 'ce', el: a };
      return null;
    };
    let c = pick();
    if (!c) { try { app.editors.active()?.focus?.(); } catch {} c = pick(); }
    return c;
  }
  const exec = (cmd, val) => { try { return document.execCommand(cmd, false, val); } catch { return false; } };
  const say = (msg, kind = 'info', o = {}) => app.ui.toast?.(msg, { kind, timeout: 2400, ...o });

  /** Adds (or toggles) one mark on the letter before the cursor. → true when the text changed. */
  function addMark(mark) {
    if (!canEdit()) { say(why() || app.t('Open a document to add aarab.')); return false; }
    const c = context();
    const NEED = app.t('Put the cursor right after a letter, then add the mark.');
    if (!c) { say(NEED); return false; }
    if (c.kind === 'ta') {
      const ta = c.el, v = ta.value; const pos = ta.selectionEnd;
      let i = pos; while (i > 0 && COMB.test(v[i - 1])) i--;
      let j = pos; while (j < v.length && COMB.test(v[j])) j++;
      if (i === 0 || !LETTER.test(v[i - 1])) { say(NEED); return false; }
      // the whole letter is replaced (letter + its new marks): the browser does not edit half of a letter cluster
      const next = applyMark(v.slice(i, j), mark);
      ta.setSelectionRange(i - 1, j); exec('insertText', v[i - 1] + next);
      ta.setSelectionRange(i + next.length, i + next.length);
      return true;
    }
    const sel = getSelection(); if (!sel.rangeCount) { say(NEED); return false; }
    const r = sel.getRangeAt(0);
    let node = r.endContainer, off = r.endOffset;
    if (node.nodeType !== 3) {
      let prev = node.childNodes[off - 1];
      while (prev && prev.nodeType === 1) prev = prev.lastChild;
      if (!prev || prev.nodeType !== 3) { say(NEED); return false; }
      node = prev; off = prev.data.length;
    }
    const d = node.data;
    let i = off; while (i > 0 && COMB.test(d[i - 1])) i--;
    let j = off; while (j < d.length && COMB.test(d[j])) j++;
    if (i === 0 || !LETTER.test(d[i - 1])) { say(NEED); return false; }
    const next = applyMark(d.slice(i, j), mark);
    const rr = document.createRange(); rr.setStart(node, i - 1); rr.setEnd(node, j);
    sel.removeAllRanges(); sel.addRange(rr);
    exec('insertText', d[i - 1] + next);
    return true;
  }

  /** Runs fn (plain text → {text, …counts}) on the selected text. → the counts, or null when nothing is selected. */
  function transformSelection(fn) {
    const c = context(); if (!c) return null;
    if (c.kind === 'ta') {
      const ta = c.el; let s = ta.selectionStart, e = ta.selectionEnd; if (s === e) return null;
      // whole letters only: a selection edge between a letter and its marks moves out to the letter's edge
      while (s > 0 && COMB.test(ta.value[s])) s--;
      while (e < ta.value.length && COMB.test(ta.value[e])) e++;
      const r = mapProse(ta.value.slice(s, e), fn);
      if (r.text !== ta.value.slice(s, e)) { ta.setSelectionRange(s, e); exec('insertText', r.text); ta.setSelectionRange(s, s + r.text.length); }
      return r;
    }
    const sel = getSelection(); if (!sel.rangeCount || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const root = range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentElement : range.commonAncestorContainer;
    const nodes = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (range.intersectsNode(n) && !(n.parentElement && n.parentElement.closest(SKIP)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    for (let n = w.nextNode(); n; n = w.nextNode()) nodes.push(n);
    if (range.commonAncestorContainer.nodeType === 3 && !nodes.length && !(range.commonAncestorContainer.parentElement?.closest(SKIP))) nodes.push(range.commonAncestorContainer);
    const total = {}; const add = r => { for (const [k, v] of Object.entries(r)) if (k !== 'text') total[k] = Array.isArray(v) ? (total[k] || []).concat(v) : (total[k] || 0) + v; };
    const edge = (n, o, back) => { if (back) { while (o > 0 && COMB.test(n.data[o])) o--; } else { while (o < n.data.length && COMB.test(n.data[o])) o++; } return o; };
    const parts = nodes.map(n => ({ n, a: n === range.startContainer ? edge(n, range.startOffset, true) : 0, b: n === range.endContainer ? edge(n, range.endOffset, false) : n.data.length })).filter(p => p.b > p.a);
    if (parts.length === 1) {
      const { n, a, b } = parts[0]; const r = fn(n.data.slice(a, b)); add(r);
      if (r.text !== n.data.slice(a, b)) {
        const rr = document.createRange(); rr.setStart(n, a); rr.setEnd(n, b); sel.removeAllRanges(); sel.addRange(rr);
        exec('insertText', r.text);
      }
      return total;
    }
    let changed = false;
    for (const p of parts.slice().reverse()) {
      const r = fn(p.n.data.slice(p.a, p.b)); add(r);
      if (r.text !== p.n.data.slice(p.a, p.b)) { p.n.data = p.n.data.slice(0, p.a) + r.text + p.n.data.slice(p.b); changed = true; }
    }
    if (changed) {
      const ad = app.editors.active();
      if (app.mode === 'word' && ad?._commit) ad._commit(); else c.el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
    }
    return total;
  }
  /** Runs fn on the whole document (outside code). → the counts. */
  async function transformDoc(fn, origin = 'aarab') {
    const d = editableDoc(); if (!d) return null;
    try { app.editors.active()?.flush?.(); } catch {}
    const r = mapProse(d.text, fn);
    if (r.text !== d.text) { d.setText(r.text, origin); try { await app.editors.active()?.refresh?.(); } catch {} }
    return r;
  }

  async function removeAarab(opts = {}) {
    if (!canEdit()) { say(why() || app.t('Open a document first.')); return null; }
    const sel = opts.whole ? null : transformSelection(strip);
    if (sel) { say(sel.n ? app.tn('Removed {count} aarab marks from the selection.', sel.n) : app.t('The selection has no aarab. Select text with aarab, or click with nothing selected to clean the whole document.'), sel.n ? 'success' : 'info'); return sel; }
    const r = await transformDoc(strip);
    if (!r) return null;
    if (r.n) say(app.tn('Removed {count} aarab marks from the document.', r.n), 'success', { action: { label: app.t('Undo'), run: () => app.commands.run('edit.undo') }, timeout: 6000 });
    else say(app.t('This document has no aarab to remove. Code blocks are always left as they are.'));
    return r;
  }

  // ---- from the word list (one known reading only; several readings wait for the chooser of roadmap Part 4)
  const base = c => String(c || '').toLowerCase().split(/[-_]/)[0];
  function packLanguage(doc) {
    const installed = (app.lang?.packs?.installed?.() || []).filter(p => p && p.lexicon !== false);
    const has = code => installed.find(p => base(p.code) === base(code));
    const tries = [app.lang?.docLang?.(doc), app.keyboards?.get?.(app.keyboards?.current?.())?.lang, app.lang?.scriptOf?.(doc?.text || '', '')];
    for (const t of tries) { const p = t && has(t); if (p) return p.code; }
    return null;
  }
  async function fromWordList(opts = {}) {
    if (!canEdit()) { say(why() || app.t('Open a document first.')); return null; }
    const doc = editableDoc();
    let lex = opts.lexicon || null, lang = opts.lang || null;
    if (!lex) {
      lang = lang || packLanguage(doc);
      if (!lang) {
        app.ui.toast?.(app.t('Install the Urdu, Arabic or Punjabi language pack to add aarab from its word list.'), { kind: 'warning', action: { label: app.t('Get language packs'), run: () => app.lang?.openOptions?.() } });
        return null;
      }
      lex = await app.lang.lexicon(lang);
      if (!lex) { app.ui.toast?.(app.t('Update the language pack to a version with a word list, then try again.'), { kind: 'warning', action: { label: app.t('Language packs'), run: () => app.lang?.openOptions?.() } }); return null; }
    }
    const map = readingsOf(lex);
    const fn = t => addFromMap(t, map);
    let r = opts.whole ? null : transformSelection(fn);
    const inSel = !!r;
    if (!r) r = await transformDoc(fn);
    if (!r) return null;
    // several readings: the chooser of roadmap Part 4 plugs in here
    const amb = [...new Set(r.ambiguous || [])];
    let chosen = 0;
    if (amb.length && typeof api.chooseReading === 'function') {
      const picks = new Map();
      for (const word of amb) { try { const p = await api.chooseReading({ word, readings: [...map.get(word)], lang }); if (p && strip(p).text === word) picks.set(word, p); } catch {} }
      if (picks.size) { const r2 = await transformDoc(t => { let n = 0; const out = t.replace(WORD_RE, w => (picks.has(w) ? (n++, picks.get(w)) : w)); return { text: out, chosen: n }; }); chosen = r2?.chosen || 0; }
    }
    if (!opts.quiet) {
      const parts = [];
      if (r.added) parts.push(inSel ? app.tn('Added aarab to {count} words in the selection.', r.added) : app.tn('Added aarab to {count} words in the document.', r.added));
      else parts.push(inSel ? app.t('No word in the selection has a single known reading yet.') : app.t('No word in the document has a single known reading yet.'));
      if (chosen) parts.push(app.tn('{count} more from your choices.', chosen));
      else if (amb.length) parts.push(app.tn('{count} words have more than one reading and stayed as typed: add those marks with the buttons.', amb.length));
      say(parts.join(' '), r.added ? 'success' : 'info', { timeout: 4200 });
    }
    return { ...r, chosen, ambiguous: amb, lang };
  }

  // ---- Show / Hide aarab (a view: the file keeps its marks)
  const ORIG = new WeakMap();
  const VIEW_PAGES = '.mk-read-page, .mk-preview-page';
  const hidden = () => app.settings.get('aarab.hidden', false) === true;
  function hideIn(page) {
    if (!page) return 0; let n = 0;
    const w = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, { acceptNode: x => (x.parentElement && x.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    for (let t = w.nextNode(); t; t = w.nextNode()) { AARAB_RE.lastIndex = 0; if (!AARAB_RE.test(t.data)) continue; if (!ORIG.has(t)) ORIG.set(t, t.data); t.data = strip(t.data).text; n++; }
    page.setAttribute('data-mk-aarab-hidden', '');
    return n;
  }
  function showIn(page) {
    if (!page) return;
    const w = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) if (ORIG.has(t)) { t.data = ORIG.get(t); ORIG.delete(t); }
    page.removeAttribute('data-mk-aarab-hidden');
  }
  function applyView() { for (const p of document.querySelectorAll(VIEW_PAGES)) (hidden() ? hideIn(p) : showIn(p)); document.body.classList.toggle('mk-aarab-hidden', hidden()); }
  app.hooks.postRender((el) => { try { if (hidden() && el && el.matches && el.matches(VIEW_PAGES)) hideIn(el); } catch {} });
  app.events.on('editor:rendered', ({ page } = {}) => { if (hidden() && page && page.matches && page.matches(VIEW_PAGES)) hideIn(page); });
  app.events.on('mode:changed', () => setTimeout(applyView, 120));
  function toggleView(on) {
    const v = typeof on === 'boolean' ? on : !hidden();
    app.settings.set('aarab.hidden', v);
    applyView();
    if (v && (app.mode === 'word' || app.mode === 'inline')) {
      app.ui.toast?.(app.t('Switch to Read mode to see the text without aarab. Word and Inline modes keep the marks visible so you can edit them.'), { kind: 'info', action: { label: app.t('Open Read mode'), run: () => app.setMode('read') } });
    } else say(v ? app.t('Aarab hidden on screen. Your file keeps them.') : app.t('Aarab shown again.'));
    try { app.shell?.refreshRibbon?.(); } catch {}
    return v;
  }

  // ------------------------------------------------------------------ ribbon group (Home → Aarab), shown when it helps
  function addIcons() {
    const defs = document.querySelector('svg defs'); if (!defs || document.getElementById('mk-aarab-x')) return;
    const ns = 'http://www.w3.org/2000/svg';
    const sym = (id, d) => { const s = document.createElementNS(ns, 'symbol'); s.setAttribute('id', id); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = d; defs.appendChild(s); };
    sym('mk-aarab-x', '<path d="M5 16c2 2.6 7.4 2.6 10.6-.4M15.6 15.6c.5-2 .2-4-1-5.6"/><path d="M8 6.5l6-2"/><path d="M16 3.5l4.5 4.5M20.5 3.5L16 8"/>');
    sym('mk-aarab-eye', '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><path d="M9 9.5l6-2"/><path d="M4 20L20 4"/>');
    sym('mk-aarab-list', '<path d="M4 6h10M4 11h10M4 16h6"/><path d="M16 15l2 2 3.5-4"/><path d="M15 6.5l4-1.4"/>');
  }
  const glyph = ch => `<span class="mk-aarab-glyph" lang="ur" aria-hidden="true">◌${ch}</span>`;
  const small = m => ({ type: 'small', command: 'aarab.' + m.id, label: m.label, text: glyph(m.ch) });
  const GROUP = () => ({ id: 'aarab', label: app.tm('Aarab'), order: 35, items: [
    { type: 'big', command: 'aarab.remove', label: app.tm('Remove Aarab'), icon: 'mk-aarab-x' },
    { type: 'col', items: [{ type: 'row', items: MARKS.slice(0, 5).map(small) }, { type: 'row', items: MARKS.slice(5).map(small) }] },
    { type: 'col', items: [
      { type: 'small', command: 'aarab.toggleView', label: app.tm('Hide Aarab'), icon: 'mk-aarab-eye', showLabel: true },
      { type: 'small', command: 'aarab.fromWordList', label: app.tm('From Word List'), icon: 'mk-aarab-list', showLabel: true },
    ] },
  ] });
  const RTL_ARABIC_SCRIPT = new Set(['ur', 'ar', 'fa', 'pnb', 'skr', 'ps', 'sd', 'ckb', 'ug', 'ks']);
  function wantGroup() {
    const pref = app.settings.get('aarab.group', 'auto');
    if (pref === 'always') return true;
    if (pref === 'never') return false;
    if (app.keyboards?.isRtl?.()) return true;
    const d = app.docs.active();
    if (!d || d.kind !== 'markdown') return false;
    if (RTL_ARABIC_SCRIPT.has(base(app.lang?.docLang?.(d)))) return true;
    return AR_LETTERS.test(String(d.text || '').slice(0, 200000));
  }
  const groupShown = () => !!app.ribbon.tabs().find(t => t.id === 'home')?.groups.some(g => g.id === 'aarab');
  function updateGroup() {
    const want = wantGroup(), has = groupShown();
    if (want && !has) app.ribbon.addGroup('home', GROUP());
    else if (!want && has) app.ribbon.removeGroup('home', 'aarab');
  }
  const later = app.debounce ? app.debounce(updateGroup, 700) : updateGroup;

  // ------------------------------------------------------------------ commands
  const C = (id, def) => app.commands.register(id, { category: 'Aarab', group: 'Aarab', isEnabled: canEdit, why, ...def });
  for (const m of MARKS) {
    C('aarab.' + m.id, {
      label: m.label, icon: 'mk-aarab-list', ...(m.key ? { shortcut: m.key } : {}),
      description: m.description,
      run: () => addMark(m.ch),
    });
    app.tooltips?.register?.('aarab.' + m.id, { title: m.tipTitle, description: m.tipDesc });
  }
  C('aarab.remove', {
    label: app.tm('Remove aarab'), icon: 'mk-aarab-x', shortcut: 'Ctrl+Alt+Shift+R',
    description: app.tm('Remove zabar, zer, pesh, shadd, jazm, tanween and khari zabar from the selection, or from the whole document when nothing is selected. Code stays as it is; Undo brings the marks back.'),
    run: () => removeAarab(),
  });
  C('aarab.removeAll', { label: app.tm('Remove aarab from the whole document'), icon: 'mk-aarab-x', description: app.tm('Remove every zabar, zer, pesh, shadd, jazm, tanween and khari zabar from the document. Code stays as it is; Undo brings them back.'), run: () => removeAarab({ whole: true }) });
  C('aarab.toggleView', {
    label: app.tm('Hide aarab'), icon: 'mk-aarab-eye', shortcut: 'Ctrl+Alt+Shift+H', isEnabled: () => !!app.docs.active(), why: () => (app.docs.active() ? '' : app.t('Open a document first.')),
    description: app.tm('Show the text without aarab in Read mode and the Simple mode preview, for easy reading. The file keeps its marks. Click again to show them.'),
    isActive: () => hidden(), run: () => toggleView(),
  });
  C('aarab.fromWordList', {
    label: app.tm('Add aarab from the word list'), icon: 'mk-aarab-list', shortcut: 'Ctrl+Alt+Shift+W',
    description: app.tm('Add aarab to the words of the selection (or the whole document) that the Urdu, Arabic or Punjabi word list knows with exactly one reading. Words with several readings stay as typed.'),
    run: () => fromWordList(),
  });
  app.tooltips?.register?.('aarab.remove', { title: app.tm('Remove Aarab'), description: app.tm('From the selection, or the whole document when nothing is selected. Undo brings them back.') });
  app.tooltips?.register?.('aarab.removeAll', { title: app.tm('Remove aarab from the whole document'), description: app.tm('Every mark in the document; code stays as it is.') });
  app.tooltips?.register?.('aarab.toggleView', { title: app.tm('Hide Aarab'), description: app.tm('Read mode shows the text without aarab. The file keeps them.') });
  app.tooltips?.register?.('aarab.fromWordList', { title: app.tm('Add aarab from the word list'), description: app.tm('Only for words with one known reading in the language pack.') });

  // ------------------------------------------------------------------ File → Options → Language → Aarab (drawn by lang.js)
  function renderOptions(el) {
    const box = document.createElement('div'); box.className = 'mk-aarab-opts';
    box.innerHTML = `<div class="lang-head"><h4>${app.th('Aarab')}</h4></div>`;
    const r = document.createElement('div'); r.className = 'opt-row';
    r.innerHTML = `<div class="ol"><b>${app.th('Aarab group on Home')}</b><small>${app.th('Buttons for zabar, zer, pesh, shadd, jazm, tanween and khari zabar, Remove Aarab and Hide Aarab. Automatic shows them while you write Urdu, Arabic, Persian or Punjabi.')}</small></div><div class="oc"></div>`;
    const sel = document.createElement('select'); sel.className = 'sel'; sel.setAttribute('aria-label', app.t('Aarab group on Home'));
    sel.dataset.tip = app.t('Aarab group on Home'); sel.dataset.tipD = app.t('When the Aarab buttons show on the Home tab. The commands are always in Alt+Q.');
    const cur = app.settings.get('aarab.group', 'auto');
    for (const [v, l] of [['auto', app.t('Automatic')], ['always', app.t('Always')], ['never', app.t('Never')]]) sel.append(new Option(l, v, false, v === cur));
    sel.addEventListener('change', () => { app.settings.set('aarab.group', sel.value); updateGroup(); app.ui.check?.(sel); });
    r.querySelector('.oc').append(sel); box.append(r);
    if (app.shell?.settingSwitch) box.append(app.shell.settingSwitch('aarab.hidden', false, app.t('Hide aarab in Read mode'), app.t('Read mode and the Simple mode preview show the text without the marks. Your file keeps them.'), () => applyView()));
    el.append(box);
    return box;
  }

  app.events.on('keyboard:changed', () => updateGroup());
  app.events.on('doc:active', () => updateGroup());
  app.events.on('doc:changed', () => later());
  app.events.on('settings:changed', ({ key } = {}) => { if (key === 'aarab.group' || key === 'keyboard.layout') updateGroup(); if (key === 'aarab.hidden') applyView(); });
  app.events.on('ready', () => { addIcons(); updateGroup(); applyView(); });
  addIcons();

  const api = app.aarab = {
    marks: () => MARKS.map(m => ({ ...m })), strip, mapProse, applyMark, addFromMap, readingsOf, canon,
    addMark, remove: removeAarab, fromWordList, toggleView, hidden, applyView, hideIn, showIn, updateGroup, wantGroup, renderOptions,
    /** Roadmap Part 4: set to async ({word, readings, lang}) → the chosen reading or null, to let people pick between readings. */
    chooseReading: null,
  };

  // ------------------------------------------------------------------ smoke tests
  async function until(fn, ms = 4000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch {} await sleep(30); } return false; }
  async function withDoc(text, mode, fn) {
    const m0 = app.mode, prev = app.docs.active();
    const d = app.docs.create({ text, title: 'Aarab test' });
    try { app.setMode(mode); await sleep(mode === 'simple' ? 700 : 300); await app.editors.active()?.refresh?.(); await sleep(80); return await fn(d, app.editors.active()); }
    finally { await app.docs.close(d.id, { force: true }); if (prev && app.docs.get(prev.id)) app.docs.activate(prev.id); app.setMode(m0); await sleep(150); }
  }
  const Z = 'َ', I = 'ِ', P = 'ُ', S = SHADD, J = 'ْ';
  app.tests.register('aarab: remove, add and toggle marks (pure rules)', () => {
    A(strip('کِتَابٌ').text === 'کتاب' && strip('کِتَابٌ').n === 3, 'strip: ' + JSON.stringify(strip('کِتَابٌ')));
    A(strip('آپ ۂ اعلیٰ').text === 'آپ ۂ اعلی', 'madda and hamza stay, khari zabar goes');
    A(strip('آ').text === 'آ' && strip('ۂ').text === 'ۂ', 'decomposed آ and ۂ stay whole');
    const md = 'عِلْم `عِلْم` text\n\n```\nعِلْم\n```\n\nعَلَم\n';
    const m = mapProse(md, strip);
    A(m.text === 'علم `عِلْم` text\n\n```\nعِلْم\n```\n\nعلم\n' && m.n === 4, 'code is left alone: ' + JSON.stringify(m));
    A(applyMark('', Z) === Z && applyMark(Z, Z) === '' && applyMark(Z, I) === I, 'vowel marks toggle and replace');
    A(applyMark(Z, S) === S + Z && applyMark(S + Z, S) === Z && applyMark(S, P) === S + P, 'shadd goes with a vowel');
    A(applyMark('ٔ', Z) === 'ٔ' + Z, 'a hamza mark is kept');
    A(applyMark(J, 'ً') === 'ً', 'tanween replaces jazm');
    A(canon('ب' + Z + S) === 'ب' + S + Z, 'one order for shadd and a vowel');
  });
  app.tests.register('aarab: add from the word list only where there is one reading (Part 4 hook)', async () => {
    const lex = { fields: ['word', 'aarab', 'roman'], rows: [['کتاب', 'کِتاب', ['kitab']], ['علم', 'عِلْم', ['ilm']], ['علم', 'عَلَم', ['alam']], ['ہم', 'ہَم', ['hum']], ['اور', '', ['aur']], ['غلط', 'غَلَطی', []]] };
    const map = readingsOf(lex);
    A(map.get('کتاب').size === 1 && map.get('علم').size === 2 && !map.has('اور') && !map.has('غلط'), 'readings: empty and mismatched aarab are ignored');
    const r = addFromMap('ہم کتاب اور علم پڑھتے ہیں۔ کِتاب', map);
    A(r.text === 'ہَم کِتاب اور علم پڑھتے ہیں۔ کِتاب' && r.added === 2 && r.ambiguous.length === 1 && r.ambiguous[0] === 'علم', 'one reading added, two readings left: ' + JSON.stringify(r));
    await withDoc('ہم کتاب اور علم\n\n`کتاب`\n', 'simple', async (d) => {
      const ta = document.querySelector('.mk-src-ta'); ta.focus(); ta.setSelectionRange(0, 0);
      const out = await fromWordList({ lexicon: lex, lang: 'ur', quiet: true });
      A(d.text === 'ہَم کِتاب اور علم\n\n`کتاب`\n' && out.added === 2 && out.ambiguous[0] === 'علم', 'whole document, code untouched: ' + JSON.stringify(d.text));
      // the Part 4 chooser plugs in through app.aarab.chooseReading
      api.chooseReading = async ({ word, readings }) => (word === 'علم' ? readings.find(x => x.includes('ِ')) : null);
      try { const o2 = await fromWordList({ lexicon: lex, lang: 'ur', quiet: true }); A(o2.chosen === 1 && d.text.startsWith('ہَم کِتاب اور عِلْم'), 'chosen reading applied: ' + JSON.stringify(d.text)); }
      finally { api.chooseReading = null; }
    });
  });
  app.tests.register('aarab: buttons add marks and Remove cleans the selection or document (Simple mode)', async () => {
    await withDoc('کتاب اور قلم\n\n`کِتاب`\n', 'simple', async (d, ad) => {
      const ta = document.querySelector('.mk-src-ta'); A(ta, 'text box');
      ta.focus(); ta.setSelectionRange(1, 1); // after ک
      await app.commands.run('aarab.zer'); await sleep(30);
      A(ta.value.startsWith('کِتاب'), 'zer added: ' + JSON.stringify(ta.value));
      await app.commands.run('aarab.zer'); await sleep(30);
      A(ta.value.startsWith('کتاب'), 'zer taken off again: ' + JSON.stringify(ta.value));
      ta.setSelectionRange(3, 3); // after کتا
      await app.commands.run('aarab.shadd'); await app.commands.run('aarab.zabar'); await sleep(30);
      A(ta.value.startsWith('کتا' + S + Z + 'ب'), 'shadd then zabar: ' + JSON.stringify(ta.value));
      ta.setSelectionRange(7, 7); // a space before the cursor (کتاَّب |اور)
      const before = ta.value; await app.commands.run('aarab.pesh');
      A(ta.value === before, 'no letter before the cursor: nothing changes');
      await until(() => d.text === ta.value, 1500);
      // Remove with a selection: only the selection
      ta.setSelectionRange(0, 6);
      await app.commands.run('aarab.remove'); await sleep(30);
      A(ta.value.startsWith('کتاب اور'), 'selection cleaned: ' + JSON.stringify(ta.value));
      // marks again, then the whole document (nothing selected); code keeps its marks
      ta.setSelectionRange(1, 1); await app.commands.run('aarab.zer');
      ta.setSelectionRange(0, 0); await app.commands.run('aarab.remove'); await sleep(60);
      A(d.text === 'کتاب اور قلم\n\n`کِتاب`\n', 'whole document cleaned, code kept: ' + JSON.stringify(d.text));
      A(ad.getText ? ad.getText() === d.text : true, 'editor shows the same text');
    });
  });
  app.tests.register('aarab: marks in Word mode, Read mode hides them without changing the file', async () => {
    const UR = 'یہ کتاب ہے۔';
    await withDoc(UR + '\n', 'word', async (d, ad) => {
      const page = ad.page || document.querySelector('.mk-page[contenteditable="true"]');
      await until(() => page && page.querySelector('p'));
      const p = page.querySelector('p'); const t = [...p.childNodes].find(n => n.nodeType === 3);
      page.focus(); const r = document.createRange(); r.setStart(t, 4); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); // after یہ ک
      await app.commands.run('aarab.zer'); await sleep(40);
      ad._commit?.(); await until(() => d.text.includes('کِتاب'), 2000);
      A(d.text === 'یہ کِتاب ہے۔\n' || d.text === 'یہ کِتاب ہے۔', 'Word mode adds zer: ' + JSON.stringify(d.text));
      // Remove with a selection over two text pieces (bold in the middle)
      d.setText('**کِتاب** اور قَلَم\n', 'test'); await ad.refresh?.(); await until(() => page.querySelector('strong'));
      const p2 = page.querySelector('p'); const sr = document.createRange(); sr.selectNodeContents(p2); getSelection().removeAllRanges(); getSelection().addRange(sr);
      await app.commands.run('aarab.remove'); await sleep(60); ad._commit?.();
      await until(() => !/[ً-ْ]/.test(d.text), 2000);
      A(d.text.replace(/\n+$/, '') === '**کتاب** اور قلم', 'Word mode selection cleaned, bold kept: ' + JSON.stringify(d.text));
      // Hide aarab is a view: Read mode draws the text without the marks, the file keeps them
      d.setText('عِلْم اور عَلَم\n', 'test');
      const h0 = hidden();
      try {
        app.settings.set('aarab.hidden', true);
        app.setMode('read'); await sleep(200);
        const rp = await (async () => { await until(() => document.querySelector('.mk-read-page p')); return document.querySelector('.mk-read-page'); })();
        await until(() => rp.querySelector('p') && rp.querySelector('p').textContent === 'علم اور علم', 3000);
        A(rp.querySelector('p').textContent === 'علم اور علم', 'Read mode without marks: ' + rp.querySelector('p').textContent);
        A(d.text === 'عِلْم اور عَلَم\n', 'the file keeps its marks');
        try { await app.mk.invoke('smoke-shot', 'aarab-hidden'); } catch {}
        toggleView(false); await sleep(40);
        A(rp.querySelector('p').textContent === 'عِلْم اور عَلَم', 'shown again');
      } finally { app.settings.set('aarab.hidden', h0); applyView(); }
    });
  });
  app.tests.register('aarab: Home → Aarab group, commands, shortcuts and KeyTips', async () => {
    const pref = app.settings.get('aarab.group', 'auto'); const k0 = app.keyboards?.current?.() || 'en';
    try {
      app.settings.set('aarab.group', 'auto');
      await withDoc('Plain English.\n', 'word', async () => {
        app.keyboards?.set?.('en', { quiet: true }); updateGroup();
        A(!groupShown(), 'no Aarab group for an English document');
        app.keyboards?.set?.('ur', { quiet: true }); updateGroup();
        A(groupShown(), 'the Aarab group appears with the Urdu keyboard');
        app.keyboards?.set?.('en', { quiet: true }); updateGroup();
      });
      await withDoc('---\nlang: ur\n---\n\nاردو\n', 'word', async () => {
        updateGroup(); A(groupShown(), 'the Aarab group appears in an Urdu document');
        app.shell?.selectTab?.('home'); await sleep(200);
        const btn = document.querySelector('#ribbon [data-tip-cmd="aarab.zabar"]'); A(btn && btn.querySelector('.mk-aarab-glyph'), 'Zabar button drawn with its mark');
        try { await app.mk.invoke('smoke-shot', 'aarab-ribbon'); } catch {}
        // KeyTips: Alt, H, then D… letters
        if (app.keytips) {
          try {
            await app.keytips.start(); app.keytips.press('H');
            // the Home letters come after two animation frames (slower in a busy or background window)
            for (let i = 0; i < 40 && app.keytips.level() !== 1; i++) await sleep(50);
            await sleep(100);
            const keys = app.keytips.keys();
            const z = keys.find(k => k.id === 'aarab.zabar');
            // KeyTips leave out groups scrolled out of the visible ribbon (like Word); check the letter whenever the button shows
            const rb = document.querySelector('#ribbon .rbody')?.getBoundingClientRect(), br = document.querySelector('#ribbon [data-tip-cmd="aarab.zabar"]')?.getBoundingClientRect();
            const inView = !rb || !br || (br.right >= rb.left + 4 && br.left <= rb.right - 4);
            A(app.keytips.level() === 1, 'Alt, H shows the Home letters');
            if (inView || z) A(z && /^D/.test(z.key), 'Zabar KeyTip starts with D: ' + (z && z.key));
          } finally { app.keytips.stop(); }
        }
      });
      for (const m of MARKS) { const c = app.commands.get('aarab.' + m.id); A(c && c.description && !c.hidden, m.id + ' in the palette'); if (m.key) A(app.shell?.findCommandFor?.(m.key)?.id === 'aarab.' + m.id, m.key + ' runs ' + m.id); }
      for (const id of ['aarab.remove', 'aarab.toggleView', 'aarab.fromWordList']) A(app.commands.get(id)?.description, id);
      A(!(app.keys?.conflicts?.() || []).length, 'no key conflicts');
      app.settings.set('aarab.group', 'never'); updateGroup(); A(!groupShown(), 'Never hides the group');
      const el = document.createElement('div'); renderOptions(el); A(el.querySelector('select') && /Hide aarab in Read mode/.test(el.textContent), 'Options rows');
    } finally { app.settings.set('aarab.group', pref); app.keyboards?.set?.(k0, { quiet: true }); updateGroup(); }
  });
})();
