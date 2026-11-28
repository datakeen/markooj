// Markooj — Word keyboard shortcuts on Markooj commands (as far as Markdown allows), the keyboard map
// for help and docs (app.keys), File → Options → Keyboard, and the few Word commands Markooj did not have yet
// (Repeat, Go To, Clear paragraph formatting, Promote/Demote, Move paragraph up/down, line spacing 1.5).
//
// How it works: every command keeps the keys it declares. The Word map below then gives each Word key to its
// command and takes it away from any other command that had it, so every key does exactly one thing.
// Keys a user gave to a macro always win. The map is applied again whenever a command is registered.
(function () {
  'use strict';
  const app = window.app;
  if (!app) return;
  const sh = () => app.shell || {};
  const norm = s => (sh().normShortcut ? sh().normShortcut(s) : String(s || '').trim());
  const fmtKey = s => (sh().fmtShortcut ? sh().fmtShortcut(s) : String(s));
  const toast = (m, o) => app.ui?.toast?.(m, o);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // [Word key, command id (or a list: the first that exists wins; a RegExp matches a command id), group]
  const MAP = [
    // ---- File ----
    ['Ctrl+N', 'file.new', 'File'], ['Ctrl+O', 'file.open', 'File'], ['Ctrl+F12', 'file.open', 'File'],
    ['Ctrl+S', 'file.save', 'File'], ['Shift+F12', 'file.save', 'File'], ['F12', 'file.saveAs', 'File'],
    ['Ctrl+W', 'file.close', 'File'], ['Ctrl+P', 'file.print', 'File'], ['Ctrl+F2', 'file.print', 'File'], ['Ctrl+Shift+F12', 'file.print', 'File'],
    // ---- Edit and find ----
    ['Ctrl+Z', 'edit.undo', 'Edit'], ['Ctrl+Y', 'edit.redo', 'Edit'], ['F4', 'edit.repeat', 'Edit'],
    ['Ctrl+F', 'edit.find', 'Edit'], ['Ctrl+H', 'edit.replace', 'Edit'], ['Ctrl+G', 'edit.goTo', 'Edit'],
    ['F3', 'edit.findNext', 'Edit'], ['Shift+F4', 'edit.findPrev', 'Edit'], ['Ctrl+Alt+V', 'edit.pastePlain', 'Edit'],
    // ---- Font (character formatting) ----
    ['Ctrl+B', 'format.bold', 'Font'], ['Ctrl+I', 'format.italic', 'Font'], ['Ctrl+U', 'format.underline', 'Font'],
    ['Ctrl+=', 'format.sub', 'Font'], ['Ctrl+Shift+=', 'format.sup', 'Font'], ['Ctrl+Space', 'format.clear', 'Font'],
    ['Ctrl+Shift+>', 'format.growFont', 'Font'], ['Ctrl+]', 'format.growFont', 'Font'],
    ['Ctrl+Shift+<', 'format.shrinkFont', 'Font'], ['Ctrl+[', 'format.shrinkFont', 'Font'],
    ['Shift+F3', 'edit.changeCase', 'Font'], ['Ctrl+Alt+H', 'format.highlight', 'Font'],
    // ---- Paragraph ----
    ['Ctrl+L', 'para.alignLeft', 'Paragraph'], ['Ctrl+E', 'para.alignCenter', 'Paragraph'], ['Ctrl+R', 'para.alignRight', 'Paragraph'], ['Ctrl+J', 'para.alignJustify', 'Paragraph'],
    ['Ctrl+M', 'para.indent', 'Paragraph'], ['Ctrl+Q', 'format.clearParagraph', 'Paragraph'], ['Ctrl+5', 'layout.lineSpacing15', 'Paragraph'],
    ['Ctrl+Shift+L', 'list.bullet', 'Paragraph'], ['Ctrl+Shift+N', 'format.normal', 'Paragraph'],
    ['Ctrl+Alt+1', 'format.h1', 'Paragraph'], ['Ctrl+Alt+2', 'format.h2', 'Paragraph'], ['Ctrl+Alt+3', 'format.h3', 'Paragraph'],
    ['Alt+Shift+Left', 'para.promote', 'Paragraph'], ['Alt+Shift+Right', 'para.demote', 'Paragraph'],
    ['Alt+Shift+Up', 'para.moveUp', 'Paragraph'], ['Alt+Shift+Down', 'para.moveDown', 'Paragraph'],
    ['Ctrl+Shift+8', 'view.formattingMarks', 'Paragraph'],
    // ---- Insert ----
    ['Alt+=', 'insert.equation', 'Insert'], ['Ctrl+Enter', 'insert.pageBreak', 'Insert'],
    ['Ctrl+Alt+F', ['ref.footnote', 'insert.footnote'], 'Insert'], ['Ctrl+Alt+D', ['ref.footnote', 'insert.footnote'], 'Insert'],
    ['Ctrl+Alt+M', ['review.comment', /^review\.(new)?comment$/i], 'Review'],
    ['Alt+Shift+D', ['insert.date', 'insert.dateTime'], 'Insert'], ['Alt+Shift+T', 'insert.time', 'Insert'],
    // ---- Review and help (commands from other modules: used when they exist) ----
    ['F7', ['review.spelling', /^writing\.(spelling|check|assistant)$/], 'Review'],
    ['Shift+F7', ['writing.thesaurus', 'review.thesaurus', /thesaurus/i], 'Review'],
    ['F1', ['help.manual', 'help.reference', 'help.open', 'help.show', 'app.help', /^help\.(manual|reference|open|show|home|index)$/, 'app.shortcuts'], 'Help'],
    // ---- View and the ribbon ----
    ['Ctrl+F1', 'view.toggleRibbon', 'View'], ['F10', 'view.focusRibbon', 'View'], ['F6', 'view.nextPane', 'View'], ['Shift+F6', 'view.prevPane', 'View'],
    // Word's window keys (round 5: split-view.js, windows.js)
    ['Ctrl+Alt+S', 'view.split', 'Window'], ['Ctrl+F6', 'view.nextWindow', 'Window'], ['Ctrl+Shift+F6', 'view.prevWindow', 'Window'],
    // Ctrl+= is Subscript in Word, so zooming moves to Ctrl+Alt+= (Ctrl+mouse wheel and the status bar zoom too)
    ['Ctrl+Alt+=', 'view.zoomIn', 'View'], ['Ctrl+-', 'view.zoomOut', 'View'], ['Ctrl+Alt+-', 'view.zoomOut', 'View'],
  ];
  // Word keys that a module handles with its own listener (a single Shift key cannot be a shortcut): listed, never bound
  const SPECIAL = [['Ctrl+Right Shift', 'para.rtl', 'Paragraph'], ['Ctrl+Left Shift', 'para.ltr', 'Paragraph']];
  // Word keys Markooj handles differently, for the help and the Options list (English, translated where they are shown)
  const NOTES = [
    ['Ctrl+1', app.tm('Single line spacing'), app.tm('In Markooj Ctrl+1 to Ctrl+4 switch the editing mode (Word, Inline, Simple, Read). Use Layout → Line spacing.')],
    ['Ctrl+2', app.tm('Double line spacing'), app.tm('Ctrl+2 is Inline mode in Markooj. Use Layout → Line spacing.')],
    ['Ctrl+Shift+M', app.tm('Decrease indent'), app.tm('Ctrl+Shift+M switches the editing mode in Markooj. Use Alt+Shift+Left, or Shift+Tab in a list.')],
    ['Ctrl+D', app.tm('Font dialog'), app.tm('Markdown has one font per document: use Home → Font. In Simple mode Ctrl+D selects the next match for multiple cursors.')],
    ['Ctrl+Shift+A', app.tm('All caps'), app.tm('Use Change Case (Shift+F3) to make the text UPPERCASE.')],
    ['Ctrl+Shift+C', app.tm('Copy formatting'), app.tm('Ctrl+Shift+C inserts a citation in Markooj. To copy formatting, use Home → Format Painter.')],
    ['Ctrl+Shift+E', app.tm('Track changes'), app.tm('Ctrl+Shift+E opens Export in Markooj. Markdown has no tracked changes; use comments (Ctrl+Alt+M).')],
    ['Ctrl+Alt+C', app.tm('Copyright sign ©'), app.tm('Ctrl+Alt+C inserts a code block in Markooj. Use Insert → Symbol for ©.')],
    ['Ctrl+Alt+R', app.tm('Registered sign ®'), app.tm('Ctrl+Alt+R inserts a cross-reference in Markooj. Use Insert → Symbol for ®.')],
    ['Ctrl+Alt+P', app.tm('Print Layout view'), app.tm('Ctrl+Alt+P opens the Python console in Markooj. Word mode always shows the page.')],
    ['Ctrl+Shift+P', app.tm('Font size box'), app.tm('Ctrl+Shift+P opens the command search in Markooj (like Alt+Q). Use the size box on Home → Font.')],
    ['Ctrl+Shift+K', app.tm('Small caps'), app.tm('Ctrl+Shift+K switches the keyboard between English and Urdu, Arabic, Persian or Punjabi in Markooj. Markdown has no small caps.')],
  ];
  // group names stay English in app.keys.list() (they sort the list); the Options card translates them when it draws
  const GROUP_OF = { file: 'File', edit: 'Edit', format: 'Font', para: 'Paragraph', list: 'Paragraph', layout: 'Layout', insert: 'Insert', ref: 'References', xref: 'References', review: 'Review', writing: 'Review', view: 'View', tab: 'Window', app: 'Help', help: 'Help', dev: 'Developer', macro: 'Macros', viewer: 'Viewer', table: 'Table', eq: 'Insert' };
  const GROUP_NAMES = [app.tm('File'), app.tm('Edit'), app.tm('Font'), app.tm('Paragraph'), app.tm('Layout'), app.tm('Insert'), app.tm('References'), app.tm('Review'), app.tm('View'), app.tm('Window'), app.tm('Navigate'), app.tm('Help'), app.tm('Developer'), app.tm('Macros'), app.tm('Viewer'), app.tm('Table'), app.tm('Other')];
  void GROUP_NAMES;

  // ---------- the apply step ----------
  const ORIG = new WeakMap(), WRITTEN = new WeakMap();
  const split = c => [].concat(c.shortcut || [], c.shortcuts || []).flatMap(s => String(s).split(/\s*,\s+|\s+\/\s+/)).map(s => s.trim()).filter(Boolean);
  function resolve(target) {
    for (const t of [].concat(target)) {
      if (typeof t === 'string') { if (app.commands.get(t)) return t; }
      else if (t instanceof RegExp) { const c = app.commands.list().find(x => t.test(x.id) && !x.hidden); if (c) return c.id; }
    }
    return null;
  }
  let lastChanges = [], applying = false, version = 0;
  /** Gives every Word key to its command and makes every key unique. Returns the list of keys that moved. */
  function apply() {
    if (applying || !sh().normShortcut) return [];
    applying = true;
    try {
      const cmds = app.commands.list();
      for (const c of cmds) {
        const cur = split(c);
        // first sight, or the command's owner changed its keys since we wrote them: those are its own keys now
        if (!ORIG.has(c) || (WRITTEN.has(c) && WRITTEN.get(c) !== cur.join('\u0001'))) ORIG.set(c, cur);
      }
      const owner = new Map(); // normalized key → {id, key}
      const word = new Map();
      for (const [key, target] of MAP) {
        const id = resolve(target); if (!id) continue;
        const n = norm(key);
        if (!word.has(n)) word.set(n, { id, key, word: true });
      }
      for (const [n, o] of word) owner.set(n, o);
      // keys the commands declare: the Word map wins, otherwise the last registered (the same rule the dispatcher uses)
      for (const c of cmds) for (const k of ORIG.get(c)) { const n = norm(k); if (!owner.get(n)?.word) owner.set(n, { id: c.id, key: k }); }
      // a key the user gave to a macro always wins
      for (const c of cmds) if (c.macro) for (const k of ORIG.get(c)) owner.set(norm(k), { id: c.id, key: k, macro: true });
      const changes = [];
      for (const c of cmds) {
        const orig = ORIG.get(c);
        const keep = orig.filter(k => owner.get(norm(k))?.id === c.id);
        for (const k of orig) { const o = owner.get(norm(k)); if (o && o.id !== c.id) changes.push({ key: k, from: c.id, to: o.id }); }
        const extra = [];
        for (const [n, o] of owner) if (o.id === c.id && o.word && !keep.some(k => norm(k) === n) && !extra.some(k => norm(k) === n)) extra.push(o.key);
        const next = [...keep, ...extra];
        // remove duplicates that only differ in spelling (Ctrl+Plus / Ctrl+=)
        const uniq = next.filter((k, i) => next.findIndex(x => norm(x) === norm(k)) === i);
        const cur = split(c);
        if (uniq.join('\u0001') !== cur.join('\u0001')) {
          if (uniq.length) c.shortcut = uniq[0]; else delete c.shortcut;
          if (uniq.length > 1) c.shortcuts = uniq.slice(1); else delete c.shortcuts;
          version++;
        }
        WRITTEN.set(c, split(c).join('\u0001'));
      }
      lastChanges = changes;
      return changes;
    } finally { applying = false; }
  }
  // the editors cache their key table by the number of commands: a hidden command that comes and goes refreshes it
  let bumped = false;
  function bumpEditorCache() {
    if (bumped) { app.commands.unregister?.('keys.refresh'); bumped = false; }
    else { app.commands.register('keys.refresh', { label: 'Keyboard map', description: 'Internal: refreshes the keyboard map.', hidden: true, palette: false, run() {} }); bumped = true; } // hidden, never shown: not translated
  }
  let queued = false, ready = false;
  function scheduleApply() {
    if (queued) return; queued = true;
    Promise.resolve().then(() => { queued = false; const v = version; apply(); if (ready && v !== version) bumpEditorCache(); });
  }
  const coreRegister = app.commands.register.bind(app.commands);
  app.commands.register = function register(id, def) {
    const r = coreRegister(id, def);
    if (id !== 'keys.refresh') scheduleApply();
    return r;
  };
  app.events.on('ready', () => { apply(); ready = true; setTimeout(() => { const v = version; apply(); if (v !== version) bumpEditorCache(); }, 1500); });

  // ---------- Word commands Markooj did not have ----------
  const C = (id, def) => app.commands.register(id, { category: def.category || 'Edit', ...def });
  const activeMd = () => { const d = app.docs.active(); return d && d.kind === 'markdown' && !d.readOnly ? d : null; };
  const editing = () => !!activeMd() && app.mode !== 'read';
  const why = () => { const d = app.docs.active(); return !d ? app.t('Open or create a document first.') : d.kind !== 'markdown' ? app.t('Use Edit as text to make an editable copy. PDF and DjVu files can’t be edited here.') : d.readOnly ? app.t('Use Edit as text to make an editable copy. This document is read-only.') : app.mode === 'read' ? app.t('Read mode is for reading. Press Esc to go back to editing.') : ''; };

  // F4: repeat the last formatting or insert command
  const REPEATABLE = /^(format\.|para\.|list\.|insert\.|edit\.case\.|edit\.changeCase$|layout\.|review\.comment$|ref\.footnote$|xref\.(crossref|caption)$|table\.)/;
  const NOT_REPEATABLE = /^(format\.painter|format\.fontFamily|insert\.equation$|edit\.repeat$)/;
  let lastRepeatable = null;
  app.events.on('command:ran', ({ id, args } = {}) => { if (id && REPEATABLE.test(id) && !NOT_REPEATABLE.test(id)) lastRepeatable = { id, args }; });
  C('edit.repeat', { label: app.tm('Repeat'), description: app.tm('Do the last formatting or insert command again, like F4 in Word.'), icon: 'redo', isEnabled: editing, why, run: () => {
    if (!lastRepeatable) { toast(app.t('Type or format something first, then press F4 to repeat it.'), { kind: 'info', timeout: 2200 }); return false; }
    return app.commands.run(lastRepeatable.id, lastRepeatable.args);
  } });
  // Ctrl+G: Go To (a page in PDF and DjVu files, a heading in documents)
  C('edit.goTo', { label: app.tm('Go To'), description: app.tm('Jump to a heading in the document, or to a page in a PDF or DjVu file.'), icon: 'toc', category: 'Navigate', run: () => {
    const d = app.docs.active();
    if (d && d.kind !== 'markdown' && app.commands.get('viewer.goToPage')) return app.commands.run('viewer.goToPage');
    return app.commands.run('app.goToHeading');
  } });
  // Ctrl+Q: paragraph formatting off (alignment); the text and its style stay
  C('format.clearParagraph', { label: app.tm('Clear paragraph formatting'), description: app.tm('Remove paragraph formatting such as center or right alignment. The words and the paragraph style stay.'), icon: 'al', category: 'Paragraph', isEnabled: editing, why, run: () => {
    // back to the paragraph's own side: left for English, right for Urdu or Arabic (Word mode treats that side as "no alignment")
    let side = 'left';
    try { const n = document.getSelection()?.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement); if (app.mode === 'word' && el && getComputedStyle(el).direction === 'rtl') side = 'right'; } catch {}
    const id = 'para.align' + side[0].toUpperCase() + side.slice(1);
    return app.commands.run(app.commands.get(id) ? id : 'para.align', app.commands.get(id) ? undefined : { value: side });
  } });
  // Ctrl+5: 1.5 line spacing for the whole document (Markdown has one spacing per document)
  C('layout.lineSpacing15', { label: app.tm('Line spacing 1.5'), description: app.tm('Set 1.5 line spacing for the whole document. Press again for the default spacing.'), icon: 'mk-lines', category: 'Paragraph', isEnabled: () => !!activeMd(), why,
    isActive: () => String(app.layout?.get?.()?.lineSpacing || '') === '1.5',
    run: () => app.commands.run('layout.lineSpacing', { value: String(app.layout?.get?.()?.lineSpacing || '') === '1.5' ? 'default' : '1.5' }) });

  // Alt+Shift+Left / Right: promote or demote a heading (Heading 2 → Heading 1), or a list item
  function headingLevel() { for (let n = 1; n <= 6; n++) { try { if (app.commands.get('format.h' + n)?.isActive?.()) return n; } catch {} } return 0; }
  function inList() { return ['list.bullet', 'list.number', 'list.task'].some(id => { try { return !!app.commands.get(id)?.isActive?.(); } catch { return false; } }); }
  function lineAtCaret() {
    const ad = app.editors.active(), d = activeMd();
    if (!ad || !d) return null;
    const s = (() => { try { return ad.getSelection?.(); } catch { return null; } })();
    if (s && typeof s.start === 'number') return { line: d.text.slice(0, s.start).split('\n').length - 1, col: s.start - d.text.lastIndexOf('\n', s.start - 1) - 1, offset: true };
    try { const l = ad.getCaretLine?.(); if (typeof l === 'number') return { line: l, col: 0 }; } catch {}
    return null;
  }
  function sourceLine() { const d = activeMd(), at = lineAtCaret(); return d && at ? d.text.split('\n')[at.line] ?? '' : ''; }
  function promote(dir) {
    // the Markdown line when the editor knows where the cursor is (Simple, Inline), else the Word mode state
    const line = sourceLine();
    const m = /^\s{0,3}(#{1,6})\s/.exec(line);
    const h = m ? m[1].length : line ? 0 : headingLevel();
    if (h) {
      const n = Math.max(1, Math.min(6, h + dir));
      if (n === h) { toast(dir < 0 ? app.t('This is already Heading 1.') : app.t('Heading 6 is the smallest heading.'), { kind: 'info', timeout: 1400 }); return false; }
      // the editor knows the Markdown offsets (Simple, Inline): rewrite the # marks in place (undo works, the cursor stays)
      const ad = app.editors.active(), at = lineAtCaret();
      if (m && at?.offset && ad?.setSelection && ad?.replaceSelection) {
        const s = ad.getSelection(), lineStart = s.start - at.col, marks = m[0].replace(/^\s+/, ''), lead = m[0].length - marks.length;
        ad.setSelection(lineStart + lead, lineStart + m[0].length);
        ad.replaceSelection('#'.repeat(n) + ' ');
        const caret = Math.max(lineStart, s.start + (n + 1 - marks.length));
        try { ad.setSelection(caret, caret); } catch {}
        return true;
      }
      return app.commands.run('format.style', { value: 'h' + n });
    }
    if (/^\s*([-*+]|\d+[.)])\s/.test(line) || (!line && inList())) return app.commands.run(dir < 0 ? 'para.outdent' : 'para.indent');
    toast(app.t('Put the cursor in a heading or a list item first.'), { kind: 'info', timeout: 1600 });
    return false;
  }
  C('para.promote', { label: app.tm('Promote'), description: app.tm('Make a heading one level bigger (Heading 2 → Heading 1), or move a list item out one level.'), icon: 'outdent', category: 'Paragraph', isEnabled: editing, why, run: () => promote(-1) });
  C('para.demote', { label: app.tm('Demote'), description: app.tm('Make a heading one level smaller (Heading 1 → Heading 2), or move a list item in one level.'), icon: 'indent', category: 'Paragraph', isEnabled: editing, why, run: () => promote(1) });

  // Alt+Shift+Up / Down: move the paragraph (or list item) above or below its neighbor
  /** Splits Markdown into movable units: blocks separated by blank lines, list items, whole code fences. */
  function units(lines, from) {
    const out = []; let i = from;
    const blank = l => !/\S/.test(l);
    const item = l => /^(\s*)([-*+]|\d+[.)])\s/.exec(l);
    while (i < lines.length) {
      if (blank(lines[i])) { i++; continue; }
      const start = i;
      const fence = /^\s{0,3}(`{3,}|~{3,})/.exec(lines[i]);
      if (fence) {
        i++;
        while (i < lines.length && !(new RegExp('^\\s{0,3}' + fence[1][0] + '{' + fence[1].length + ',}\\s*$').test(lines[i]))) i++;
        i = Math.min(lines.length, i + 1);
        out.push({ start, end: i, list: false }); continue;
      }
      const it = item(lines[i]);
      if (it) {
        const ind = it[1].length; i++;
        while (i < lines.length && !blank(lines[i]) && !(item(lines[i]) && item(lines[i])[1].length <= ind)) i++;
        out.push({ start, end: i, list: true, ind }); continue;
      }
      i++;
      while (i < lines.length && !blank(lines[i]) && !item(lines[i]) && !/^\s{0,3}(`{3,}|~{3,})/.test(lines[i])) i++;
      out.push({ start, end: i, list: false });
    }
    return out;
  }
  function frontMatterEnd(lines) {
    if (!/^﻿?---\s*$/.test(lines[0] || '')) return 0;
    for (let i = 1; i < lines.length; i++) if (/^(---|\.\.\.)\s*$/.test(lines[i])) return i + 1;
    return 0;
  }
  function moveText(text, line, dir) {
    const eol = /\r\n/.test(text) ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    const us = units(lines, frontMatterEnd(lines));
    const k = us.findIndex(u => line >= u.start && line < u.end);
    if (k < 0) return null;
    const u = us[k];
    let v = us[k + dir];
    if (!v) return null;
    // a list item swaps with the next item of the same depth; a paragraph jumps over a whole list
    if (u.list) { if (!v.list || v.ind !== u.ind) return null; }
    else if (v.list) {
      let j = k + dir; const run = [];
      while (us[j] && us[j].list) { run.push(us[j]); j += dir; }
      v = { start: Math.min(...run.map(x => x.start)), end: Math.max(...run.map(x => x.end)), list: false };
    }
    const [a, b] = dir < 0 ? [v, u] : [u, v];
    const A = lines.slice(a.start, a.end), B = lines.slice(b.start, b.end), gap = lines.slice(a.end, b.start);
    const out = [...lines.slice(0, a.start), ...B, ...gap, ...A, ...lines.slice(b.end)];
    const newStart = dir < 0 ? a.start : a.start + B.length + gap.length;
    return { text: out.join(eol), line: newStart + (line - u.start) };
  }
  function moveParagraph(dir) {
    const d = activeMd(), ad = app.editors.active(), at = lineAtCaret();
    if (!d || !ad || !at) return false;
    try { ad.flush?.(); } catch {}
    const r = moveText(d.text, at.line, dir);
    if (!r) return false;
    d.setText(r.text, 'move');
    try { ad.refresh?.(); } catch {}
    const lines = r.text.split(/\r?\n/);
    let off = 0; for (let i = 0; i < r.line; i++) off += lines[i].length + 1;
    off += Math.min(at.col || 0, (lines[r.line] || '').length);
    // Simple and Inline take the new text at once: put the cursor back now; Word mode draws again first
    if (at.offset && ad.setSelection) { try { ad.setSelection(off, off); } catch {} }
    else setTimeout(() => { try { ad.setCaretLine?.(r.line); } catch {} }, 60);
    return true;
  }
  C('para.moveUp', { label: app.tm('Move paragraph up'), description: app.tm('Move the paragraph (or list item) with the cursor above the one before it.'), icon: 'chevup', category: 'Paragraph', isEnabled: editing, why, run: () => moveParagraph(-1) });
  C('para.moveDown', { label: app.tm('Move paragraph down'), description: app.tm('Move the paragraph (or list item) with the cursor below the one after it.'), icon: 'chev', category: 'Paragraph', isEnabled: editing, why, run: () => moveParagraph(1) });

  // ---------- app.keys: every shortcut, for the help, the docs and Options ----------
  function groupOf(c) {
    const w = MAP.find(([, t]) => resolve(t) === c.id);
    if (w && w[2]) return w[2];
    const p = String(c.id).split('.')[0];
    return GROUP_OF[p] || c.category || 'Other';
  }
  function titleOf(c) {
    try { const i = app.tooltips?.info?.(c.id); if (i?.title) return i.title; } catch {}
    return c.label && c.label !== c.id ? c.label.replace(/…$/, '') : c.id;
  }
  /** [{id, keys, typing, title, group, word}] for every command with a shortcut. keys are display strings (Ctrl+B …). */
  function list() {
    const rows = [];
    const wordKeys = new Set(MAP.map(([k]) => norm(k)));
    for (const c of app.commands.list()) {
      if (c.hidden || c.id === 'keys.refresh') continue;
      const keys = split(c), typing = [].concat(c.altShortcuts || []).filter(k => !keys.some(x => norm(x) === norm(k)));
      if (!keys.length && !typing.length) continue;
      rows.push({ id: c.id, keys, typing, title: titleOf(c), group: groupOf(c), word: keys.some(k => wordKeys.has(norm(k))), description: (() => { try { return app.tooltips?.info?.(c.id)?.description || c.description || ''; } catch { return c.description || ''; } })() });
    }
    // Word keys a module handles itself because the browser cannot bind them (Ctrl + one Shift key, lang.js)
    for (const [key, id, group] of SPECIAL) {
      const c = app.commands.get(id); if (!c || c.hidden) continue;
      const row = rows.find(r => r.id === id);
      if (row) { if (!row.keys.includes(key)) row.keys.push(key); row.word = true; continue; }
      rows.push({ id, keys: [key], typing: [], title: titleOf(c), group, word: true, description: (() => { try { return app.tooltips?.info?.(id)?.description || c.description || ''; } catch { return c.description || ''; } })() });
    }
    const order = ['File', 'Edit', 'Font', 'Paragraph', 'Insert', 'Layout', 'References', 'Review', 'View', 'Window', 'Navigate', 'Developer', 'Macros', 'Help'];
    const rank = g => { const i = order.indexOf(g); return i < 0 ? 99 : i; };
    return rows.sort((a, b) => rank(a.group) - rank(b.group) || a.group.localeCompare(b.group) || a.title.localeCompare(b.title));
  }
  /** The Word key map with what each key runs here (null when that command is not available). */
  function wordMap() { return MAP.map(([key, target, group]) => ({ key, id: resolve(target), group })); }
  /** Every key bound to more than one command (should be empty). */
  function conflicts() {
    const seen = new Map(), out = [];
    for (const c of app.commands.list()) for (const k of split(c)) { const n = norm(k); if (seen.has(n) && seen.get(n) !== c.id) out.push({ key: n, a: seen.get(n), b: c.id }); else seen.set(n, c.id); }
    for (const c of app.commands.list()) for (const k of [].concat(c.altShortcuts || [])) { const n = norm(k); if (seen.has(n) && seen.get(n) !== c.id) out.push({ key: n, a: seen.get(n), b: c.id + ' (while typing)' }); }
    return out;
  }
  app.keys = { list, wordMap, notes: () => NOTES.map(([key, word, note]) => ({ key, word, note })), conflicts, apply, moved: () => lastChanges.slice(), moveText, units, format: fmtKey };

  // ---------- File → Options → Keyboard ----------
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === 'text') e.textContent = v; else if (k === 'class') e.className = v; else e.setAttribute(k, v); }
    for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  }
  function renderKeyboard(card) {
    card.classList.add('kb-card');
    const intro = el('p', { class: 'kb-intro', text: app.t('Markooj uses Word’s shortcuts wherever Markdown has the same thing. Search by name or by key.') });
    const search = el('input', { class: 'txt kb-search', type: 'search', placeholder: app.t('Search shortcuts, like “bold” or “Ctrl+B”'), 'aria-label': app.t('Search keyboard shortcuts') });
    const box = el('div', { class: 'kb-list', role: 'list' });
    const count = el('small', { class: 'kb-count' });
    card.append(intro, el('div', { class: 'kb-top' }, search, count), box);
    const rows = list();
    // NOTES in the interface language; the search finds the translated and the English words
    const notesShown = NOTES.map(([k, w, t]) => [k, app.t(w), app.t(t), w + ' ' + t]);
    const draw = () => {
      const q = search.value.trim().toLowerCase().replace(/\s+/g, '');
      box.innerHTML = '';
      let group = null, n = 0;
      for (const r of rows) {
        const groupName = app.t(r.group);
        const hay = (r.title + ' ' + r.group + ' ' + groupName + ' ' + r.id + ' ' + r.keys.concat(r.typing).map(k => k + ' ' + fmtKey(k)).join(' ')).toLowerCase().replace(/\s+/g, '');
        if (q && !hay.includes(q)) continue;
        if (r.group !== group) { group = r.group; box.append(el('div', { class: 'kb-group', text: groupName })); }
        const keys = el('span', { class: 'kb-keys' }, ...r.keys.map(k => el('kbd', { text: fmtKey(k) })), ...r.typing.map(k => el('kbd', { class: 'typing', text: fmtKey(k), title: app.t('While you type in the page') })));
        box.append(el('div', { class: 'kb-row', role: 'listitem', 'data-id': r.id, title: r.description || '' }, el('span', { class: 'kb-t' }, r.title, r.word ? el('span', { class: 'kb-tag', text: 'Word' }) : null), keys));
        n++;
      }
      if (!q || 'word'.includes(q) || notesShown.some(([k, w, t, en]) => (k + w + t + en).toLowerCase().replace(/\s+/g, '').includes(q))) {
        const notes = notesShown.filter(([k, w, t, en]) => !q || (k + ' ' + w + ' ' + t + ' ' + en).toLowerCase().replace(/\s+/g, '').includes(q));
        if (notes.length) {
          box.append(el('div', { class: 'kb-group', text: app.t('Word keys that work differently here') }));
          for (const [k, w, t] of notes) box.append(el('div', { class: 'kb-row note', role: 'listitem' }, el('span', { class: 'kb-t' }, el('b', { text: w }), el('small', { text: t })), el('span', { class: 'kb-keys' }, el('kbd', { text: fmtKey(k) }))));
        }
      }
      if (!n && q) box.append(el('p', { class: 'kb-empty', text: app.t('No shortcut matches “{query}”.', { query: search.value.trim() }) }));
      count.textContent = app.tn('{count} shortcuts', n);
    };
    search.addEventListener('input', draw);
    draw();
  }
  app.options?.addSection?.({ id: 'keyboard', label: app.tm('Keyboard shortcuts'), order: 60, render: renderKeyboard });

  // ---------- smoke tests ----------
  const A = app.assert;
  app.tests.register('keys: Word shortcuts are mapped and every key does one thing', async () => {
    apply();
    const bad = conflicts();
    A(!bad.length, 'keys bound twice: ' + bad.map(c => `${c.key}: ${c.a} / ${c.b}`).join('; '));
    const find = k => sh().findCommandFor?.(norm(k))?.id;
    const expect = {
      'Ctrl+N': 'file.new', 'Ctrl+O': 'file.open', 'Ctrl+S': 'file.save', 'Ctrl+W': 'file.close', 'Ctrl+P': 'file.print', 'Ctrl+F': 'edit.find', 'Ctrl+H': 'edit.replace', 'Ctrl+G': 'edit.goTo',
      'Ctrl+Z': 'edit.undo', 'Ctrl+Y': 'edit.redo', 'Ctrl+B': 'format.bold', 'Ctrl+I': 'format.italic', 'Ctrl+U': 'format.underline',
      'Ctrl+E': 'para.alignCenter', 'Ctrl+L': 'para.alignLeft', 'Ctrl+R': 'para.alignRight', 'Ctrl+J': 'para.alignJustify',
      'Ctrl+5': 'layout.lineSpacing15', 'Ctrl+Alt+1': 'format.h1', 'Ctrl+Alt+2': 'format.h2', 'Ctrl+Alt+3': 'format.h3',
      'Ctrl+Shift+N': 'format.normal', 'Ctrl+Shift+L': 'list.bullet', 'Ctrl+=': 'format.sub', 'Ctrl+Shift+=': 'format.sup', 'Alt+=': 'insert.equation',
      'Alt+Shift+Left': 'para.promote', 'Alt+Shift+Right': 'para.demote', 'Alt+Shift+Up': 'para.moveUp', 'Alt+Shift+Down': 'para.moveDown',
      'Ctrl+Shift+8': 'view.formattingMarks', 'Ctrl+Space': 'format.clear', 'Ctrl+Q': 'format.clearParagraph', 'F4': 'edit.repeat',
      'F12': 'file.saveAs', 'Shift+F12': 'file.save', 'Ctrl+F2': 'file.print', 'Ctrl+Enter': 'insert.pageBreak', 'Shift+F3': 'edit.changeCase',
      'Ctrl+F1': 'view.toggleRibbon', 'F6': 'view.nextPane', 'F10': 'view.focusRibbon', 'Ctrl+]': 'format.growFont', 'Ctrl+[': 'format.shrinkFont', 'Ctrl+M': 'para.indent',
    };
    const wrong = [];
    for (const [k, id] of Object.entries(expect)) if (app.commands.get(id) && find(k.trim()) !== id) wrong.push(`${k.trim()} → ${find(k.trim())} (want ${id})`);
    for (const [k, t] of [['Ctrl+Alt+M', ['review.comment']], ['Ctrl+Alt+F', ['ref.footnote', 'insert.footnote']], ['Ctrl+Alt+D', ['ref.footnote', 'insert.footnote']], ['F7', ['review.spelling']]]) {
      const id = resolve(t); if (id && find(k) !== id) wrong.push(`${k} → ${find(k)} (want ${id})`);
    }
    for (const [k, t] of MAP.filter(([k]) => k === 'Shift+F7' || k === 'F1')) { const id = resolve(t); if (id && find(k) !== id) wrong.push(`${k} → ${find(k)} (want ${id})`); }
    A(!wrong.length, 'Word keys: ' + wrong.join('; '));
    // Ctrl+K stays Link (while typing) and nothing else claims it
    const link = app.commands.get('insert.link');
    if (link) A([].concat(link.altShortcuts || [], split(link)).some(k => norm(k) === 'Ctrl+K') && !app.commands.list().some(c => c.id !== 'insert.link' && split(c).some(k => norm(k) === 'Ctrl+K')), 'Ctrl+K stays Link');
    A(find('Ctrl+Alt+=') === 'view.zoomIn' && find('Ctrl+-') === 'view.zoomOut', 'zoom keys moved to Ctrl+Alt+=');
    // a macro that takes a Word key keeps it, and the key comes back when the macro goes
    app.commands.register('macro.smokeKeys', { label: 'Macro: smoke', description: 'Smoke test macro.', shortcut: 'Ctrl+Q', macro: true, run() {} });
    await sleep(10); apply();
    A(find('Ctrl+Q') === 'macro.smokeKeys' && !split(app.commands.get('format.clearParagraph')).length, 'a macro takes Ctrl+Q over');
    app.commands.unregister('macro.smokeKeys'); apply();
    A(find('Ctrl+Q') === 'format.clearParagraph', 'Ctrl+Q back to Clear paragraph formatting');
    A(!conflicts().length, 'still no conflicts');
  });
  app.tests.register('keys: app.keys.list() and File → Options → Keyboard', async () => {
    const rows = list();
    A(rows.length > 60, 'many shortcuts listed: ' + rows.length);
    A(rows.every(r => r.id && r.title && r.group && (r.keys.length || r.typing.length)), 'every row has id, title, group and keys');
    const bold = rows.find(r => r.id === 'format.bold');
    A(bold && bold.group === 'Font' && bold.word && bold.keys.some(k => norm(k) === 'Ctrl+B'), 'bold row: ' + JSON.stringify(bold));
    A(rows.some(r => r.id === 'insert.link' && r.typing.some(k => norm(k) === 'Ctrl+K')), 'Ctrl+K listed as a typing key');
    A(wordMap().length === MAP.length && app.keys.notes().length >= 3, 'word map and notes');
    app.backstage.open('options'); await sleep(120);
    const card = document.querySelector('.opt-card[data-section="keyboard"]');
    A(card && card.querySelectorAll('.kb-row').length > 60, 'Options lists the shortcuts');
    const s = card.querySelector('.kb-search');
    s.value = 'bold'; s.dispatchEvent(new Event('input'));
    const hits = [...card.querySelectorAll('.kb-row:not(.note)')].map(r => r.dataset.id);
    A(hits.includes('format.bold') && hits.length < 6, 'search finds Bold: ' + hits.join(', '));
    s.value = 'ctrl+shift+l'; s.dispatchEvent(new Event('input'));
    A([...card.querySelectorAll('.kb-row:not(.note)')].some(r => r.dataset.id === 'list.bullet'), 'search by key');
    s.value = ''; s.dispatchEvent(new Event('input'));
    card.scrollIntoView({ block: 'start' }); await sleep(300);
    try { await app.mk.invoke('smoke-shot', 'options-keyboard'); } catch {}
    app.backstage.close();
  });
  app.tests.register('keys: move paragraph, promote and demote, repeat', async () => {
    let r = moveText('---\nt: x\n---\n\nA one\n\nB two\nB more\n\nC', 6, -1);
    A(r && r.text === '---\nt: x\n---\n\nB two\nB more\n\nA one\n\nC' && r.line === 4, 'block moves up: ' + JSON.stringify(r));
    r = moveText('- a\n- b\n  - b1\n- c\n', 1, 1);
    A(r && r.text === '- a\n- c\n- b\n  - b1\n' && r.line === 2, 'list item moves down with its children: ' + JSON.stringify(r));
    A(moveText('A\n\nB', 0, -1) === null, 'the first block stays');
    A(moveText('```\ncode\n\nmore\n```\n\nP', 6, -1)?.text === 'P\n\n```\ncode\n\nmore\n```', 'a code fence moves as one block');
    const doc = app.docs.create({ title: 'Keys test', text: '## Heading\n\nFirst para.\n\nSecond para.\n' });
    const m0 = app.mode;
    try {
      app.setMode('simple'); await sleep(700);
      const ad = app.editors.active();
      ad.setSelection(25, 25); // in "Second para."
      await app.commands.run('para.moveUp');
      A(doc.text === '## Heading\n\nSecond para.\n\nFirst para.\n', 'moved up in the document: ' + JSON.stringify(doc.text));
      ad.setSelection(3, 3);
      await app.commands.run('para.promote');
      A(/^# Heading/.test(doc.text), 'Heading 2 → Heading 1: ' + JSON.stringify(doc.text));
      await app.commands.run('para.demote'); await sleep(30);
      A(/^## Heading/.test(doc.text), 'and back to Heading 2: ' + JSON.stringify(doc.text));
      await app.commands.run('para.demote'); await sleep(30);
      A(/^### Heading/.test(doc.text), 'Heading 3: ' + JSON.stringify(doc.text));
      await app.commands.run('edit.repeat'); await sleep(30);
      A(/^#### Heading/.test(doc.text), 'F4 repeats the last command: ' + JSON.stringify(doc.text));
    } finally { app.setMode(m0); await sleep(300); await app.docs.close(doc.id, { force: true }); }
  });
})();
