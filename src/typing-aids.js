// Markooj — typing aids (PLAN-v5 items 67, 71, 74 and the slash commands of 68):
//   • auto-pairing of brackets, quotes and Markdown marks in Word, Inline and Simple mode (Obsidian style),
//     with smart quotes “ ” ‘ ’ and « » when Smart quotes is on;
//   • slash commands /today, /date, /time and /hijri with a small hint list;
//   • Ctrl+A selects only the document (or the pane you clicked), never the ribbon and the outline;
//   • Paste as plain text (Ctrl+Shift+V and Ctrl+Alt+V) in every mode, reading the clipboard through main.
// The pairing rules live in one pure function, app.typingAids.decide(), so they are the same in every mode and
// easy to test. Each mode only differs in how a change is applied (textarea, Inline block, or the Word page).
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const E = app.editor = app.editor || {};
  const T = app.typing = app.typing || {};
  const mk = app.mk || window.mk || {};
  const TA = app.typingAids = app.typingAids || {};

  // the stylesheet normally comes from index.html; load it here if it is missing
  try {
    if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(l => /typing-aids\.css/.test(l.getAttribute('href') || ''))) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'typing-aids.css'; document.head.appendChild(l);
    }
  } catch {}

  // icons for Home → Editing (Replace, Select all)
  (function injectIcons() {
    if (document.getElementById('mk-typing-icons')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'mk-typing-icons'; svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true'); svg.style.position = 'absolute';
    svg.innerHTML = '<defs><symbol id="mk-selall" viewBox="0 0 24 24"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M11 4h2M11 20h2M4 11v2M20 11v2"/><path d="M8 9h8M8 12h8M8 15h5"/></symbol>'
      + '<symbol id="mk-replace" viewBox="0 0 24 24"><path d="M4 7h11l-3-3M20 17H9l3 3"/><path d="M4 7v3M20 17v-3"/></symbol></defs>';
    const add = () => document.body.appendChild(svg);
    if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
  })();
  const setting = (k, d) => app.settings.get(k, d);
  const isOn = k => setting(k, true) !== false;
  TA.options = () => ({
    pairs: isOn('autoPair'), markup: isOn('autoPairMarkup'), math: isOn('autoPairMath'),
    smartQuotes: isOn('smartQuotes'), slash: isOn('slashCommands'),
  });

  // =================================================================== the rules (pure)
  const BRACKETS = { '(': ')', '[': ']', '{': '}' };
  const CURLY = { '“': '”', '‘': '’', '«': '»' };
  const CURLY_CLOSE = new Set(['”', '’', '»']);
  const SYMMETRIC = new Set(['*', '_', '$', '~']);
  const isWord = c => !!c && /[\p{L}\p{N}]/u.test(c);
  const isDigit = c => /^[0-9]$/.test(c || '');
  const runLeft = (v, i, ch) => { let k = 0; while (i - 1 - k >= 0 && v[i - 1 - k] === ch) k++; return k; };
  const runRight = (v, i, ch) => { let k = 0; while (v[i + k] === ch) k++; return k; };
  const OPENING_BEFORE = /[\s([{<—–\-/“‘«]/;

  /**
   * What to do with one key at the caret. Pure: no DOM, no settings.
   * x = {text, s, e, key ('(' … or 'Backspace'), markup (Markdown marks: Simple and Inline blocks), smart (curly quotes),
   *      context ('text'|'code'|'math'|'html'|'url'|'attr'|'yaml'), pairs, markupOn, math, lastDollar (caret offset of an
   *      auto-paired $|$ that was just made, or -1)}
   * Returns null (let the key do its normal thing) or {a, b, insert, s, e, kind} — replace text [a, b) with insert and put
   * the selection at [s, e]. kind: 'pair' | 'wrap' | 'over' | 'delete' | 'dollar'.
   */
  TA.decide = (x) => {
    const v = String(x.text ?? ''), s = x.s | 0, e = x.e == null ? s : x.e | 0, key = x.key;
    if (x.pairs === false || !key) return null;
    const ctx = x.context || 'text', inText = ctx === 'text';
    const prev = v[s - 1] || '', next = v[e] || '', prev2 = v[s - 2] || '';
    const lineStart = v.lastIndexOf('\n', s - 1) + 1, lineBefore = v.slice(lineStart, s);
    const markupOk = !!x.markup && x.markupOn !== false && inText;
    const mathOk = x.math !== false;
    const smart = !!x.smart && inText;
    const R = (a, b, insert, ns, ne, kind) => ({ a, b, insert, s: ns, e: ne == null ? ns : ne, kind });

    // ---- Backspace right after an opener deletes an empty pair
    if (key === 'Backspace') {
      if (s !== e || s === 0) return null;
      for (const ch of SYMMETRIC) {
        if (prev !== ch || next !== ch) continue;
        if (ch !== '$' && !markupOk) continue;
        if (ch === '$' && (!mathOk || (ctx !== 'text' && ctx !== 'math'))) continue;
        const k = runLeft(v, s, ch), m = runRight(v, e, ch);
        if (k === m && k <= 3 && !isWord(v[s - k - 1])) return R(s - k, s + k, '', s - k, null, 'delete');
      }
      const close = BRACKETS[prev] || CURLY[prev] || (prev === '"' || prev === "'" || prev === '`' ? prev : null);
      if (close && next === close && !(prev === '`' && !x.markup)) return R(s - 1, s + 1, '', s - 1, null, 'delete');
      return null;
    }
    if ([...key].length !== 1) return null;

    // ---- a digit right after an auto-paired $|$ means money ($5), not math: drop the closing $
    if (isDigit(key) && x.lastDollar === s && s === e && prev === '$' && next === '$' && prev2 !== '$') return R(s, s + 1, key, s + 1, null, 'dollar');

    // ---- a selection gets wrapped, and stays selected
    if (s !== e) {
      const sel = v.slice(s, e);
      let open = null, close = null;
      if (BRACKETS[key]) { open = key; close = BRACKETS[key]; }
      else if (key === '"') { [open, close] = smart ? ['“', '”'] : ['"', '"']; }
      else if (key === "'") { [open, close] = smart ? ['‘', '’'] : ["'", "'"]; }
      else if (CURLY[key] && x.smart) { open = key; close = CURLY[key]; }
      else if (!sel.includes('\n') && markupOk && (key === '*' || key === '_' || key === '`')) { open = close = key; }
      else if (!sel.includes('\n') && markupOk && key === '~') { open = close = '~~'; }
      else if (!sel.includes('\n') && key === '$' && mathOk && (inText || ctx === 'math') && (x.markup || inText)) { open = close = '$'; }
      if (!open) return null;
      return R(s, e, open + sel + close, s + open.length, e + open.length, 'wrap');
    }

    // ---- an empty pair of marks grows: *|* + * → **|**, $|$ + $ → $$|$$, _|_ + _ → __|__
    if (SYMMETRIC.has(key) && prev === key && next === key && key !== '~') {
      const k = runLeft(v, s, key), m = runRight(v, e, key);
      const allowed = key === '$' ? mathOk && (inText || ctx === 'math') : markupOk || (ctx === 'math' && key === '$');
      if (allowed && k === m && k < 3 && !isWord(v[s - k - 1])) return R(s, s, key + key, s + 1, null, 'pair');
    }

    // ---- step over a closer that is already there
    const stepTarget = (() => {
      if (prev === '\\') return false;
      if (next === key) {
        if (')]}'.includes(key)) return true;
        if (key === '"' || key === '`') return true;
        if (key === "'") return !(isWord(prev) && isWord(v[e + 1]));
        if (CURLY_CLOSE.has(key)) return true;
        if (key === '*' || key === '_' || key === '~') return !!x.markup;
        if (key === '$') return mathOk;
        return false;
      }
      if (key === '"' && x.smart && next === '”') return true;
      if (key === "'" && x.smart && next === '’') return !(isWord(prev) && isWord(v[e + 1]));
      return false;
    })();
    if (stepTarget) return R(s, s, '', s + 1, null, 'over');

    // ---- openers
    if (BRACKETS[key]) {
      if (isWord(next) || prev === '\\') return null;
      return R(s, s, key + BRACKETS[key], s + 1, null, 'pair');
    }
    if (CURLY[key]) {
      if (!x.smart || isWord(next)) return null;
      return R(s, s, key + CURLY[key], s + 1, null, 'pair');
    }
    if (key === '"') {
      if (prev === '\\') return null;
      if (smart) {
        const opening = !prev || OPENING_BEFORE.test(prev);
        if (!opening || isWord(next)) return null; // AutoCorrect makes the closing ” (or a lone “) as before
        return R(s, s, '“”', s + 1, null, 'pair');
      }
      if (isWord(prev) || isWord(next) || prev === '"') return null;
      return R(s, s, '""', s + 1, null, 'pair');
    }
    if (key === "'") {
      if (prev === '\\' || isWord(prev)) return null; // an apostrophe: don’t, it’s, students’
      if (smart) {
        const opening = !prev || OPENING_BEFORE.test(prev);
        if (!opening || isWord(next)) return null;
        return R(s, s, '‘’', s + 1, null, 'pair');
      }
      if (isWord(next) || prev === "'") return null;
      return R(s, s, "''", s + 1, null, 'pair');
    }
    if (key === '$') {
      if (!mathOk || prev === '\\' || !inText) return null;
      if (isWord(prev) || isWord(next) || prev === '$') return null;
      return R(s, s, '$$', s + 1, null, 'pair');
    }
    if (!markupOk) return null;
    if (key === '*') {
      // two stars at the start of a line are bold: ** → **|**
      if (prev === '*' && /^\s*(?:[-+]\s+|\d{1,9}[.)]\s+)*\*$/.test(lineBefore) && (!next || /\s/.test(next))) return R(s, s, '***', s + 1, null, 'pair');
      // "* " starts a bullet: no pair at the start of a line (or after other list markers)
      if (/^\s*(?:[-+*]\s+|\d{1,9}[.)]\s+)*$/.test(lineBefore)) return null;
      if (isWord(prev) || isWord(next) || prev === '\\' || prev === '*') return null;
      return R(s, s, '**', s + 1, null, 'pair');
    }
    if (key === '_') {
      if (isWord(prev) || isWord(next) || prev === '\\' || prev === '_') return null; // snake_case stays as typed
      return R(s, s, '__', s + 1, null, 'pair');
    }
    if (key === '`') {
      if (/^\s*``$/.test(lineBefore)) return null; // ``` opens a code block
      if (isWord(prev) || isWord(next) || prev === '\\' || prev === '`') return null;
      return R(s, s, '``', s + 1, null, 'pair');
    }
    if (key === '~') {
      // one ~ is subscript in Pandoc; the second one makes a ~~strikethrough~~ pair
      if (prev === '~' && prev2 !== '~' && next !== '~' && !isWord(next)) return R(s, s, '~~~', s + 1, null, 'pair');
      return null;
    }
    return null;
  };

  // =================================================================== context of the caret
  let stCache = { text: null, states: null };
  /** Highlighter state at the start of line `li` of `text` ('n' normal, fences, math blocks, front matter …). */
  function stateAt(text, li, base = 0) {
    const hl = E.highlightLine; if (!hl || li <= 0) return 'n';
    let states = stCache.text === text && stCache.base === base ? stCache.states : null;
    if (!states) {
      states = ['n']; let st = 'n', pos = 0, i = 0;
      while (pos <= text.length) {
        const nl = text.indexOf('\n', pos); const line = text.slice(pos, nl < 0 ? text.length : nl);
        try { st = hl(line, st, i + base)[1]; } catch { st = 'n'; }
        states.push(st); i++;
        if (nl < 0) break; pos = nl + 1;
      }
      stCache = { text, base, states };
    }
    return states[Math.min(li, states.length - 1)] || 'n';
  }
  /** 'text' | 'code' | 'math' | 'yaml' | 'html' | 'url' | 'attr' for the caret at `s` in Markdown `text`. */
  TA.contextAt = (text, s, { base = 0 } = {}) => {
    const v = String(text || ''); const ls = v.lastIndexOf('\n', s - 1) + 1;
    let li = 0; for (let i = v.indexOf('\n'); i >= 0 && i < s; i = v.indexOf('\n', i + 1)) li++;
    const st = stateAt(v, li, base);
    if (st === 'fm') return 'yaml';
    if (st && st.startsWith('m:')) return 'math';
    if (st && st !== 'n') return 'code';
    return T.mdContext ? T.mdContext(v.slice(ls, s), 'n') : 'text';
  };

  // =================================================================== where the caret is (three kinds of editor)
  const RICH_BLOCK = 'p,li,h1,h2,h3,h4,h5,h6,td,th,dt,dd,blockquote,figcaption,pre,div';
  const elOf = n => (n && n.nodeType === 1 ? n : n?.parentElement || null);
  /** A model of the caret: {kind, text, s, e, context, markup, smart, apply(result)} or null. */
  function modelFor(ctx) {
    const el = ctx.element, ad = ctx.adapter;
    if (!el) return null;
    if (ad?.doc?.readOnly) return null;
    if (el.tagName === 'TEXTAREA') {
      const text = el.value;
      return lazyContext({ kind: 'textarea', el, text, s: el.selectionStart, e: el.selectionEnd, markup: true, smart: false,
        apply: r => applyTextarea(el, ad, r) }, m => TA.contextAt(text, m.s));
    }
    const ob = ctx.mode === 'inline' ? (() => { try { return ad?.openBlock; } catch { return null; } })() : null;
    if (ob && ob.element === el && !ob.cell && ob.sel) {
      const text = ob.text;
      return lazyContext({ kind: 'inline', el, text, s: ob.sel.s, e: ob.sel.e, markup: true, smart: true,
        apply: r => applyInline(ad, ob, r) }, m => TA.contextAt(text, m.s, { base: 1 }));
    }
    if (el.isContentEditable || el.getAttribute?.('contenteditable') === 'true') return richModel(el);
    return null;
  }
  /** The Markdown context costs a scan of the text up to the caret: work it out only when a rule asks for it. */
  function lazyContext(m, fn) { let c; Object.defineProperty(m, 'context', { get: () => (c === undefined ? (c = fn(m)) : c), enumerable: true }); return m; }
  function richModel(root) {
    const sel = getSelection(); if (!sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
    const start = elOf(r.startContainer); if (!start) return null;
    if (start.closest('[contenteditable="false"],.mk-math,.katex')) return null;
    let blk = start.closest(RICH_BLOCK); if (!blk || !root.contains(blk)) blk = root;
    const cross = !blk.contains(r.endContainer);
    const pre = document.createRange(); pre.selectNodeContents(blk); pre.setEnd(r.startContainer, r.startOffset);
    const before = pre.toString();
    let mid = '', after = '';
    if (!cross) {
      mid = r.toString();
      const post = document.createRange(); post.selectNodeContents(blk); post.setStart(r.endContainer, r.endOffset); after = post.toString();
    }
    const text = before + mid + after, s = before.length, e = s + mid.length;
    const code = !!start.closest('code,pre,kbd');
    return { kind: 'rich', el: root, blk, cross, text, s, e, markup: false, smart: true, context: code ? 'code' : 'text', apply: res => applyRich(blk, res) };
  }

  // ---- applying a result
  function applyTextarea(ta, ad, r) {
    if (r.kind === 'over' || (r.a === r.b && !r.insert)) { setTa(ta, ad, r.s, r.e); return true; }
    if (ad && typeof ad.setSelection === 'function' && typeof ad.replaceSelection === 'function' && ad.textarea === ta) {
      ad.setSelection(r.a, r.b); ad.replaceSelection(r.insert); ad.setSelection(r.s, r.e);
      return true;
    }
    ta.focus({ preventScroll: true }); ta.setSelectionRange(r.a, r.b);
    let ok = false;
    try { ok = r.insert === '' ? document.execCommand('delete') : document.execCommand('insertText', false, r.insert); } catch {}
    if (!ok || ta.value.slice(r.a, r.a + r.insert.length) !== r.insert) { ta.setRangeText(r.insert, r.a, r.b, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
    ta.setSelectionRange(r.s, r.e);
    return true;
  }
  function setTa(ta, ad, s, e) { if (ad && ad.textarea === ta && ad.setSelection) ad.setSelection(s, e); else ta.setSelectionRange(s, e); }
  function applyInline(ad, ob, r) {
    if (r.kind === 'over' || (r.a === r.b && !r.insert)) { ad.setSelection(ob.start + r.s, ob.start + r.e); return true; }
    if (typeof ad.editOpenBlock === 'function') return ad.editOpenBlock(r.a, r.b, r.insert, r.s, r.e) !== false;
    // older Inline editor: select the range in the block and type over it
    ad.setSelection(ob.start + r.a, ob.start + r.b);
    try { if (r.insert) document.execCommand('insertText', false, r.insert); else document.execCommand('delete'); } catch {}
    ad.setSelection(ob.start + r.s, ob.start + r.e);
    return true;
  }
  /** DOM point for a character offset in an element's text (the same count as Range.toString()). */
  function pointIn(blk, off) {
    const w = document.createTreeWalker(blk, NodeFilter.SHOW_TEXT); let n, last = null, left = off;
    while ((n = w.nextNode())) { if (left <= n.data.length) return [n, left]; left -= n.data.length; last = n; }
    return last ? [last, last.data.length] : [blk, blk.childNodes.length];
  }
  function selectIn(blk, a, b) {
    const r = document.createRange(); const [x, xo] = pointIn(blk, a); const [y, yo] = pointIn(blk, b);
    r.setStart(x, xo); r.setEnd(y, yo); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return r;
  }
  function exec(text) { try { return text === '' ? document.execCommand('delete') : document.execCommand('insertText', false, text); } catch { return false; } }
  function applyRich(blk, r) {
    if (r.kind === 'over' || (r.a === r.b && !r.insert)) { selectIn(blk, r.s, r.e); return true; }
    if (r.kind === 'wrap') {
      // insert the closer, then the opener, so the formatting inside the selection stays as it is
      const open = r.insert.slice(0, r.s - r.a), closer = r.insert.slice(open.length + (r.e - r.s));
      selectIn(blk, r.b, r.b); exec(closer);
      selectIn(blk, r.a, r.a); exec(open);
      selectIn(blk, r.s, r.e);
      return true;
    }
    selectIn(blk, r.a, r.b); exec(r.insert);
    selectIn(blk, r.s, r.e);
    return true;
  }
  TA._apply = { textarea: applyTextarea, inline: applyInline, rich: applyRich, pointIn, selectIn };

  // =================================================================== the key hook (every mode)
  let lastDollar = null; // {el, pos, len}
  const PAIR_KEYS = new Set([...'()[]{}"\'`*_~$“”‘’«»']);
  function keyOf(e) {
    if (e.isComposing || e.keyCode === 229) return null;
    if (e.key === 'Backspace') return e.ctrlKey || e.metaKey || e.altKey || e.shiftKey ? null : 'Backspace';
    if (typeof e.key !== 'string' || [...e.key].length !== 1) return null;
    if (e.ctrlKey || e.metaKey || e.altKey) { if (!(E.isAltGrChar && E.isAltGrChar(e))) return null; }
    return e.key;
  }
  TA.handleKey = (e, ctx = {}) => {
    const key = keyOf(e); if (!key) return false;
    // only these keys can pair, step over or remove a pair (a digit only right after an auto-paired $|$)
    if (key !== 'Backspace' && !PAIR_KEYS.has(key) && !(lastDollar && /^[0-9]$/.test(key))) return false;
    const o = TA.options(); if (!o.pairs) return false;
    if (app.multicursor?.isActive?.(ctx.element)) return false;
    const m = modelFor(ctx); if (!m) return false;
    if (m.kind === 'rich' && m.cross && m.s !== m.e) return false;
    if (key === 'Backspace' && (m.s !== m.e || !PAIR_KEYS.has(m.text[m.s - 1] || '') || !PAIR_KEYS.has(m.text[m.e] || ''))) return false; // not between a pair
    const smart = m.smart && o.smartQuotes;
    const ld = lastDollar && lastDollar.el === m.el && lastDollar.len === m.text.length ? lastDollar.pos : -1;
    const r = TA.decide({ text: m.text, s: m.s, e: m.e, key, markup: m.markup, markupOn: o.markup, smart, context: m.context, pairs: true, math: o.math, lastDollar: ld });
    if (!r) { lastDollar = null; return false; }
    m.apply(r);
    lastDollar = r.kind === 'pair' && r.insert === '$$' ? { el: m.el, pos: r.s, len: m.text.length + 2 } : null;
    return true;
  };
  T.onKey?.((e, ctx) => TA.handleKey(e, ctx) || false);

  // =================================================================== slash commands
  const SLASH = [
    { name: 'today', label: app.tm('Today’s date'), run: () => app.dates?.text?.('date') },
    { name: 'date', label: app.tm('Pick a date…'), dialog: true },
    { name: 'time', label: app.tm('The time now'), run: () => app.dates?.text?.('time') },
    { name: 'hijri', label: app.tm('Today’s Hijri date'), run: () => app.dates?.text?.('hijri') },
  ];
  TA.slashCommands = () => SLASH.map(c => ({ name: c.name, label: c.label }));
  const SLASH_RE = /(?:^|[\s([{“"'‘«])\/([a-z]{0,8})$/i;
  let hint = null; // {el, items, idx, token, model ctx, at}
  let dismissedAt = null;
  /** The slash token right before the caret, or null: {token, start (offset of "/"), model}. */
  function slashAt(ctx) {
    const m = modelFor(ctx); if (!m || m.s !== m.e) return null;
    const ls = m.text.lastIndexOf('\n', m.s - 1) + 1;
    const mm = SLASH_RE.exec(m.text.slice(ls, m.s)); if (!mm) return null;
    if (m.context !== 'text') return null;
    return { token: mm[1].toLowerCase(), start: m.s - mm[1].length - 1, model: m };
  }
  function matches(token) { return SLASH.filter(c => c.name.startsWith(token)); }
  function caretRect(m) {
    if (m.kind === 'textarea') return app.multicursor?.caretRect?.(m.el, m.s) || m.el.getBoundingClientRect();
    try { const s = getSelection(); if (s.rangeCount) { const r = s.getRangeAt(0).cloneRange(); r.collapse(true); const rc = r.getClientRects()[0] || r.getBoundingClientRect(); if (rc && (rc.width || rc.height || rc.top)) return rc; } } catch {}
    return m.el.getBoundingClientRect();
  }
  function hideHint() { if (hint) { hint.el.remove(); hint = null; } }
  TA.hideSlashHint = hideHint;
  function showHint(ctx, at) {
    const items = matches(at.token);
    if (!items.length) return hideHint();
    if (!hint) {
      const el = document.createElement('div'); el.className = 'mk-slash'; el.setAttribute('role', 'listbox'); el.setAttribute('aria-label', app.t('Slash commands'));
      document.body.appendChild(el);
      hint = { el, idx: 0 };
    }
    const keep = hint.items && hint.items[hint.idx] ? hint.items[hint.idx].name : null;
    hint.items = items; hint.ctx = ctx; hint.at = at;
    hint.idx = Math.max(0, items.findIndex(i => i.name === keep));
    const preview = c => { try { return c.run ? String(c.run() || '') : ''; } catch { return ''; } };
    hint.el.innerHTML = '';
    items.forEach((c, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mk-slash-it' + (i === hint.idx ? ' on' : ''); b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(i === hint.idx));
      const p = preview(c);
      b.innerHTML = `<b>/${c.name}</b><span>${esc(app.t(c.label))}</span>${p ? `<small dir="auto">${esc(p)}</small>` : ''}`;
      b.addEventListener('mousedown', ev => ev.preventDefault());
      b.addEventListener('click', () => { const h = hint; if (!h) return; h.idx = i; acceptHint(); });
      hint.el.appendChild(b);
    });
    const foot = document.createElement('div'); foot.className = 'mk-slash-foot';
    foot.textContent = app.t('Enter to insert · Esc to close');
    hint.el.appendChild(foot);
    const rc = caretRect(at.model);
    const w = hint.el.offsetWidth || 260, h = hint.el.offsetHeight || 120;
    let x = Math.min(Math.max(8, rc.left), innerWidth - w - 8), y = rc.bottom + 6;
    if (y + h > innerHeight - 8) y = Math.max(8, rc.top - h - 6);
    hint.el.style.left = x + 'px'; hint.el.style.top = y + 'px';
  }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  /** Replace the "/token" before the caret with the command's text (or open the date dialog). `tail` is added after it. */
  TA.runSlash = async (name, ctx, tail = '') => {
    const at = slashAt(ctx); if (!at) return false;
    const c = SLASH.find(x => x.name === name); if (!c) return false;
    const m = at.model, a = at.start, b = m.s;
    hideHint();
    if (c.dialog) {
      m.apply({ a, b, insert: '', s: a, e: a, kind: 'delete' });
      if (app.dates?.openDialog) await app.dates.openDialog({});
      return true;
    }
    const text = c.run ? String(c.run() || '') : '';
    if (!text) { app.ui.toast?.(app.t('Use Insert → Date & time instead. The date tools are not loaded in this window.'), { kind: 'info' }); return false; }
    const ins = text + tail;
    m.apply({ a, b, insert: ins, s: a + ins.length, e: a + ins.length, kind: 'slash' });
    return true;
  };
  function acceptHint(tail = '') {
    if (!hint) return false;
    const it = hint.items[hint.idx]; const ctx = hint.ctx;
    if (!it) return false;
    TA.runSlash(it.name, ctx, tail);
    return true;
  }
  T.onKey?.((e, ctx) => {
    if (!TA.options().slash) { if (hint) hideHint(); return false; }
    if (e.ctrlKey || e.metaKey || e.altKey) { if (hint) hideHint(); return false; }
    const k = e.key;
    if (hint && hint.ctx?.element === ctx.element) {
      if (k === 'ArrowDown' || k === 'ArrowUp') { hint.idx = (hint.idx + (k === 'ArrowDown' ? 1 : -1) + hint.items.length) % hint.items.length; showHint(ctx, slashAt(ctx) || hint.at); return true; }
      if (k === 'Escape') { dismissedAt = hint.at ? { el: ctx.element, start: hint.at.start } : null; hideHint(); return true; }
      if (k === 'Enter' || k === 'Tab') return acceptHint('');
    }
    if (k === ' ' || k === 'Enter') {
      const at = slashAt(ctx);
      if (at && SLASH.some(c => c.name === at.token)) { TA.runSlash(at.token, ctx, k === ' ' ? ' ' : ''); return true; }
    }
    return false;
  });
  T.onInput?.((ctx) => {
    if (!TA.options().slash || app.multicursor?.isActive?.(ctx.element)) { if (hint) hideHint(); return; }
    const at = slashAt(ctx);
    if (!at || !matches(at.token).length) { hideHint(); return; }
    if (dismissedAt && dismissedAt.el === ctx.element && dismissedAt.start === at.start) return;
    dismissedAt = null;
    showHint(ctx, at);
  });
  document.addEventListener('mousedown', e => { if (hint && !hint.el.contains(e.target)) hideHint(); }, true);
  app.events.on('mode:changed', hideHint); app.events.on('doc:active', hideHint); app.events.on('i18n:changed', hideHint);
  window.addEventListener('blur', hideHint);

  // =================================================================== Ctrl+A: only the document (or the pane you are in)
  const isField = t => !!t && (t.isContentEditable || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !/^(button|checkbox|radio|range|submit|reset|color|file|image)$/i.test(t.type || '')) || t.tagName === 'SELECT');
  let lastPress = null;
  document.addEventListener('pointerdown', e => { lastPress = { el: e.target, t: Date.now() }; }, true);
  function selectContents(el) {
    if (!el) return false;
    const r = document.createRange(); r.selectNodeContents(el);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true;
  }
  /** What Ctrl+A selects for a target element: 'dialog' | 'backstage' | 'preview' | 'document' (plus the element). */
  TA.selectAllTarget = (t) => {
    t = t && t.nodeType === 1 ? t : document.activeElement;
    const dlg = t?.closest?.('.mk-modal, .dlg, [role="dialog"], .mk-pop, .pop.show, .palette');
    if (dlg) return { where: 'dialog', el: dlg.querySelector('.mk-mbody, .dlg-body, .body, .bd') || dlg };
    const bs = t?.closest?.('.backstage');
    if (bs) return { where: 'backstage', el: bs.querySelector('.bs-page') || bs.querySelector('.bs-main') || bs };
    let pv = t?.closest?.('.mk-preview');
    // clicking the preview does not move the focus there: use where the last click was
    if (!pv && lastPress && Date.now() - lastPress.t < 10 * 60 * 1000 && lastPress.el?.closest?.('.mk-preview') && (t === document.body || t?.id === 'editorHost' || t?.closest?.('#editorHost'))) {
      if (!t?.closest?.('.mk-src')) pv = lastPress.el.closest('.mk-preview');
    }
    if (pv && pv.isConnected) return { where: 'preview', el: pv.querySelector('.mk-page') || pv };
    return { where: 'document', el: null };
  };
  TA.selectAll = (opts = {}) => {
    const t = opts.target || document.activeElement;
    const target = TA.selectAllTarget(t);
    if (target.where !== 'document') return selectContents(target.el) && target.where;
    const d = app.docs.active(); const ad = app.editors.active();
    if (!d) return false;
    if (d.kind !== 'markdown') {
      // PDF and DjVu: the pages' text in the viewer only
      const host = document.getElementById('editorHost');
      return selectContents(host?.querySelector('.textLayer')?.closest('.mk-viewer, .viewer, .pdf-viewer') || host) && 'viewer';
    }
    if (app.mode === 'simple' && ad?.textarea) { ad.textarea.focus({ preventScroll: true }); ad.textarea.select(); return 'source'; }
    const page = ad?.getSurface?.() || ad?.page;
    if (!page) return false;
    if (app.mode === 'word' && page.isContentEditable) page.focus({ preventScroll: true });
    return selectContents(page) && 'page';
  };
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.isComposing) return;
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.code !== 'KeyA') return;
    if (isField(e.target)) return; // text boxes and the editors select their own text
    if (e.target?.closest?.('[data-mk-keys="own"]')) return;
    e.preventDefault(); e.stopPropagation();
    TA.selectAll({ target: e.target });
  }, true);
  // "Select all" from the right-click menu (Electron's selectAll role) selects the whole window: narrow it to the document
  let narrowing = false;
  document.addEventListener('selectionchange', () => {
    if (narrowing) return;
    const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return;
    const r = s.getRangeAt(0);
    const top = n => n === document.body || n === document.documentElement;
    if (!(top(r.startContainer) && r.startOffset === 0)) return;
    const ribbon = document.getElementById('ribbon');
    if (ribbon && !r.intersectsNode(ribbon)) return;
    narrowing = true;
    try { TA.selectAll({ target: lastPress?.el || document.activeElement }); } finally { setTimeout(() => { narrowing = false; }, 0); }
  });

  app.commands.register('edit.selectAll', {
    label: app.tm('Select all'), icon: 'mk-selall', hint: 'Ctrl+A', category: 'Edit',
    description: app.tm('Select the whole document: the Markdown in Simple mode, the page in Word, Inline and Read mode. Ribbon and outline are left out.'),
    isEnabled: () => !!app.docs.active(),
    why: () => (app.docs.active() ? '' : app.t('Open or create a document first.')),
    run: () => { const ok = TA.selectAll({ target: document.activeElement === document.body ? null : document.activeElement }); if (!ok) app.ui.toast?.(app.t('Open or create a document first, then select its text.'), { kind: 'info' }); return ok; },
  });

  // =================================================================== Paste as plain text (every mode)
  async function clipboardText() {
    try { const t = await mk.invoke?.('clipboard-read-text'); if (typeof t === 'string') return t; } catch {}
    try { return await navigator.clipboard.readText(); } catch { return ''; }
  }
  TA.clipboardText = clipboardText;
  const editableDoc = () => { const d = app.docs.active(); return !!(E.testTarget || (d && d.kind === 'markdown' && !d.readOnly && app.editors.active())); };
  const whyNot = () => { const d = app.docs.active(); return !d ? app.t('Open or create a document first.') : d.kind !== 'markdown' ? app.t('Use Edit as text to make an editable copy. PDF and DjVu files can’t be edited here.') : d.readOnly ? app.t('This document is read-only.') : ''; };
  /** Insert plain text at the caret of the active editor (the multi-cursor way when several cursors are on). */
  TA.insertPlain = async (text, ed) => {
    const e = ed || (E.target ? E.target() : app.editors.active());
    if (!e) return false;
    text = String(text ?? '').replace(/\r\n?/g, '\n');
    if (app.mode === 'read' && !ed) {
      app.ui.toast?.(app.t('Press Esc to go back to editing, then paste. Read mode does not change the document.'), { kind: 'info', actions: [{ label: app.t('Back to editing'), run: () => app.shell?.backToEditing?.() }] });
      return false;
    }
    if (e.textarea && app.multicursor?.isActive?.(e.textarea)) return app.multicursor.paste(e.textarea, text);
    e.focus?.();
    const word = E.testTarget ? E.testTarget.name === 'word' : app.mode === 'word';
    if (word) { try { if (document.execCommand('insertText', false, text)) return true; } catch {} }
    await e.insert(text);
    return true;
  };
  app.commands.register('edit.pastePlain', {
    label: app.tm('Paste as plain text'), icon: 'doc', shortcut: 'Ctrl+Shift+V', category: 'Edit',
    description: app.tm('Paste the words on the clipboard without their fonts, colors, links or tables. Also Ctrl+Alt+V.'),
    isEnabled: () => editableDoc() || app.mode === 'read', why: whyNot,
    run: async () => {
      if (app.mode === 'read' && !E.testTarget) return TA.insertPlain('', null);
      const text = await clipboardText();
      if (!text) { app.ui.toast?.(app.t('Copy some text first, then paste it as plain text. The clipboard has no text right now.'), { kind: 'info' }); return false; }
      return TA.insertPlain(text);
    },
  });

  // =================================================================== File → Options (Typing and review)
  /** Called by the shell's Options page with its helpers; adds the switches to the Typing card. */
  TA.renderOptions = (card, { settingSwitch } = {}) => {
    if (!card || typeof settingSwitch !== 'function') return;
    const sub = document.createElement('div'); sub.className = 'mk-ta-opts';
    sub.append(settingSwitch('autoPair', true, app.t('Close brackets and quotes automatically'), app.t('Typing ( [ { or a quote adds the closing one and puts the cursor between. Typing the closing one steps over it, a selection gets wrapped, and Backspace removes an empty pair.')));
    sub.append(settingSwitch('autoPairMarkup', true, app.t('Close Markdown marks too'), app.t('In Simple and Inline mode, * _ ` and ~~ close themselves as well: type ** for **bold**. A * at the start of a line stays a bullet.')));
    sub.append(settingSwitch('autoPairMath', true, app.t('Close $ for math'), app.t('Typing $ adds the closing $ for an equation. A number right after it ($5) keeps the dollar sign as typed.')));
    sub.append(settingSwitch('slashCommands', true, app.t('Slash commands'), app.t('Type /today, /time, /hijri or /date and press Space or Enter. A small list shows the choices; Esc closes it.')));
    if (app.dates?.renderOptions) { try { app.dates.renderOptions(sub); } catch (e) { console.warn(e); } }
    card.append(sub);
  };

  // =================================================================== smoke tests
  const A = (c, m) => app.assert(c, m);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const D = (text, caret, key, o = {}) => {
    // text with "|" for the caret or "[…]" for a selection
    let s, e, t = text;
    if (t.includes('[')) { s = t.indexOf('['); t = t.replace('[', ''); e = t.indexOf(']'); t = t.replace(']', ''); }
    else { s = e = t.indexOf('|'); t = t.replace('|', ''); }
    const r = TA.decide({ text: t, s, e, key, markup: true, markupOn: true, smart: false, context: 'text', pairs: true, math: true, lastDollar: -1, ...o });
    if (!r) return null;
    const out = t.slice(0, r.a) + r.insert + t.slice(r.b);
    return r.s === r.e ? out.slice(0, r.s) + '|' + out.slice(r.s) : out.slice(0, r.s) + '[' + out.slice(r.s, r.e) + ']' + out.slice(r.e);
  };
  app.tests.register('typing: pairing rules (brackets, quotes, marks, math)', () => {
    A(D('a |', 0, '(') === 'a (|)', 'bracket pair: ' + D('a |', 0, '('));
    A(D('a (|)', 0, ')') === 'a ()|', 'step over: ' + D('a (|)', 0, ')'));
    A(D('a |word', 0, '(') === null, 'no pair before a word');
    A(D('a [word] b', 0, '(') === 'a ([word]) b', 'wrap keeps the selection: ' + D('a [word] b', 0, '('));
    A(D('a (|) b', 0, 'Backspace') === 'a | b', 'Backspace removes an empty pair');
    A(D('say |', 0, '"') === 'say "|"', 'straight quotes pair in Simple mode');
    A(D("don|", 0, "'") === null && D("it|", 0, "'") === null, 'no pair for an apostrophe in a word');
    A(D('x |', 0, '*') === 'x *|*', 'star pair');
    A(D('x *|*', 0, '*') === 'x **|**', 'two stars make bold: ' + D('x *|*', 0, '*'));
    A(D('x **bold|**', 0, '*') === 'x **bold*|*', 'step over the first closing star: ' + D('x **bold|**', 0, '*'));
    A(D('x **bold*|*', 0, '*') === 'x **bold**|', 'and the second: ' + D('x **bold*|*', 0, '*'));
    A(D('x **|**', 0, 'Backspace') === 'x |', 'Backspace removes an empty bold pair');
    A(D('|', 0, '*') === null && D('  |', 0, '*') === null, 'a star at the start of a line stays a bullet');
    A(D('*|', 0, '*') === '**|**', 'two stars at the start of a line are bold: ' + D('*|', 0, '*'));
    A(D('- |', 0, '*') === null, 'after a list marker a star is a bullet too');
    A(D('snake|', 0, '_') === null, 'snake_case');
    A(D('x |', 0, '`') === 'x `|`' && D('``|', 0, '`') === null, 'backticks pair, ``` opens a block');
    A(D('x ~|', 0, '~') === 'x ~~|~~', 'second tilde makes a strikethrough pair: ' + D('x ~|', 0, '~'));
    A(D('x [word]', 0, '*') === 'x *[word]*', 'wrap with *');
    A(D('x |', 0, '$') === 'x $|$', 'math pair');
    A(D('x |', 0, '$', { math: false }) === null, '$ off');
    A(D('x $|$', 0, '5', { lastDollar: 3 }) === 'x $5|', 'a number after $ is money: ' + D('x $|$', 0, '5', { lastDollar: 3 }));
    A(D('x $|$', 0, '$') === 'x $$|$$', 'display math');
    A(D('x |', 0, '*', { markupOn: false }) === null && D('x |', 0, '(', { markupOn: false }) === 'x (|)', 'marks can be turned off alone');
    A(D('x |', 0, '*', { context: 'code' }) === null && D('x |', 0, '(', { context: 'code' }) === 'x (|)', 'in code: brackets yes, marks no');
    A(D('a \\|', 0, '(') === null, 'escaped bracket');
    A(D('x |', 0, '(', { pairs: false }) === null, 'all off');
  });
  app.tests.register('typing: smart quotes pair “|” and step over (the reported bug)', () => {
    const o = { smart: true, markup: false };
    A(D('He said |', 0, '"', o) === 'He said “|”', 'opening quote pairs: ' + D('He said |', 0, '"', o));
    A(D('He said “hi|”', 0, '"', o) === 'He said “hi”|', 'pressing " again steps over ”: ' + D('He said “hi|”', 0, '"', o));
    A(D('“|”', 0, '"', o) === '“”|', 'even right away');
    A(D('the end.|', 0, '"', o) === null, 'no pair after text: AutoCorrect makes the closing ”');
    A(D('(|', 0, '"', o) === '(“|”', 'after an opening bracket it opens');
    A(D('a |', 0, "'", o) === 'a ‘|’', 'single quotes pair');
    A(D('don|', 0, "'", o) === null, 'apostrophe in a word stays one character');
    A(D('a ‘it|’', 0, "'", o) === 'a ‘it’|', 'step over ’');
    A(D('John|’s', 0, "'", o) === null, 'an apostrophe inside a word is not stepped over');
    A(D('a |', 0, '“', o) === 'a “|”' && D('a |', 0, '«', o) === 'a «|»', 'typed “ and « pair');
    A(D('a «x|»', 0, '»', o) === 'a «x»|', 'step over »');
    A(D('a [word]', 0, '"', o) === 'a “[word]”', 'wrap in curly quotes');
    A(D('a “|”', 0, 'Backspace', o) === 'a |', 'Backspace removes “”');
    A(D('a |', 0, '"', { ...o, context: 'code' }) === 'a "|"', 'straight quotes in code');
  });
  app.tests.register('typing: Simple mode pairs, wraps, steps over and Backspace', async () => {
    if (!E.createSimple) return;
    const host = E._offscreen(); const ed = E.createSimple(); const d = E.fakeDoc('Say ');
    const key = (k, code) => ed.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: code || '', bubbles: true, cancelable: true }));
    const was = setting('autoPair', true);
    try {
      app.settings.set('autoPair', true);
      ed.mount(host, d); const ta = ed.textarea; ta.focus(); ta.setSelectionRange(4, 4);
      key('(', 'Digit9'); A(ta.value === 'Say ()' && ta.selectionStart === 5, 'pair: ' + JSON.stringify(ta.value));
      key(')', 'Digit0'); A(ta.value === 'Say ()' && ta.selectionStart === 6, 'step over');
      ed.setSelection(5, 5); key('Backspace', 'Backspace'); A(ta.value === 'Say ' && ta.selectionStart === 4, 'Backspace removes the empty pair: ' + JSON.stringify(ta.value));
      key('*', 'Digit8'); key('*', 'Digit8'); A(ta.value === 'Say ****' && ta.selectionStart === 6, 'two stars → **|**: ' + JSON.stringify(ta.value));
      key('Backspace', 'Backspace'); A(ta.value === 'Say ' && ta.selectionStart === 4, 'Backspace removes **|**: ' + JSON.stringify(ta.value));
      ed.setSelection(0, 3); key('"', 'Quote');
      A(ta.value === '"Say" ' && ta.selectionStart === 1 && ta.selectionEnd === 4, 'wrap keeps the selection: ' + JSON.stringify(ta.value));
      A(d.text === ta.value, 'the document follows');
      app.settings.set('autoPair', false);
      ed.setSelection(6, 6); key('(', 'Digit9');
      A(!/\(\)/.test(ta.value), 'off: no pair (and the old built-in pairing is off too): ' + JSON.stringify(ta.value));
    } finally { app.settings.set('autoPair', was); ed.unmount(); host.remove(); }
  });
  // bug hunt (round 5): typing latency in a long document (10,000 words) with pairing and slash commands on
  app.tests.register('typing: pairing stays fast in a 10,000-word document', async () => {
    if (!E.createSimple) return;
    const para = 'The quick brown fox jumps over the lazy dog while $x^2$ and `code` sit nearby in this sentence. ';
    const parts = [];
    for (let i = 0; parts.join('').split(/\s+/).length < 10000 && i < 2000; i++) {
      parts.push(i % 25 === 0 ? `\n## Section ${i}\n\n` : i % 40 === 7 ? '\n```js\nconst a = (1 + 2) * 3;\n```\n\n' : i % 9 === 0 ? `- item ${i} ${para}\n` : para + '\n\n');
    }
    const big = parts.join('');
    const host = E._offscreen(); const ed = E.createSimple(); const d = E.fakeDoc(big);
    const was = { p: setting('autoPair', true), s: setting('slashCommands', true) };
    try {
      app.settings.set('autoPair', true); app.settings.set('slashCommands', true);
      ed.mount(host, d); const ta = ed.textarea; ta.focus();
      await sleep(50);
      const key = k => ta.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: '', bubbles: true, cancelable: true }));
      const mid = Math.floor(big.length / 2); const at = big.indexOf('\n\n', mid) + 2;
      ed.setSelection(at, at);
      const times = [];
      for (let i = 0; i < 12; i++) {
        const t0 = performance.now();
        key('('); key(')'); key('$'); key('Backspace');
        times.push((performance.now() - t0) / 4);
        document.execCommand('insertText', false, 'w'); // the text changes between keys, as when typing
      }
      times.sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)];
      A(median < 16, `a pairing key takes under one frame (16 ms) in ${big.split(/\s+/).length} words: median ${median.toFixed(1)} ms`);
    } finally { app.settings.set('autoPair', was.p); app.settings.set('slashCommands', was.s); ed.unmount(); host.remove(); }
  });
  app.tests.register('typing: Inline mode pairs in the open block (smart quotes)', async () => {
    if (!E.createInline) return;
    const host = E._offscreen(); const ed = E.createInline(); const d = E.fakeDoc('He said\n\nNext.');
    const sq = setting('smartQuotes', true);
    try {
      app.settings.set('smartQuotes', true);
      ed.mount(host, d);
      for (let i = 0; i < 100 && !ed.page?.querySelector('p'); i++) await sleep(20);
      await ed.setSelection(7, 7); await ed.whenIdle();
      const ob = ed.openBlock; A(ob && ob.text === 'He said', 'block open: ' + JSON.stringify(ob && ob.text));
      const key = k => ob.element.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      ed._typeText(' ');
      key('"'); A(/^He said “”/.test(d.text) && ed.openBlock.sel.s === 9, 'smart pair: ' + JSON.stringify(d.text) + ' ' + JSON.stringify(ed.openBlock.sel));
      ed._typeText('hi');
      key('"'); A(/^He said “hi”\n/.test(d.text) && ed.openBlock.sel.s === 12, 'step over ”: ' + JSON.stringify(d.text) + ' ' + JSON.stringify(ed.openBlock.sel));
      A(!/“hi”“/.test(d.text) && !/”“/.test(d.text), 'no second “ (the reported bug): ' + JSON.stringify(d.text));
      key(' '); ed._typeText(' ');
      key('*'); key('*'); A(/ \*\*\*\*$/.test(ed.openBlock.text), 'bold pair in Inline: ' + JSON.stringify(ed.openBlock.text));
      key('Backspace'); A(!/\*/.test(ed.openBlock.text), 'Backspace removes it: ' + JSON.stringify(ed.openBlock.text));
      await ed.undo(); A(/\*\*\*\*/.test(d.text), 'undo brings the pair back as one step: ' + JSON.stringify(d.text));
    } finally { app.settings.set('smartQuotes', sq); ed.unmount(); host.remove(); }
  });
  app.tests.register('typing: Word mode pairs “|”, steps over and wraps', async () => {
    if (!E.createWord) return;
    const host = E._offscreen(); const ed = E.createWord(); const d = E.fakeDoc('Say hi');
    const sq = setting('smartQuotes', true);
    try {
      app.settings.set('smartQuotes', true);
      ed.mount(host, d);
      for (let i = 0; i < 100 && !ed.page?.querySelector('p'); i++) await sleep(20);
      await sleep(60);
      T.attachWordPage?.(ed.page, ed);
      const p = ed.page.querySelector('p'); const t = p.firstChild;
      ed.page.focus(); const r = document.createRange(); r.setStart(t, t.data.length); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r);
      const key = k => ed.page.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      document.execCommand('insertText', false, ' ');
      key('"');
      A(/Say hi[  ]“”$/.test(p.textContent), 'pair: ' + JSON.stringify(p.textContent));
      document.execCommand('insertText', false, 'x');
      key('"');
      A(/“x”$/.test(p.textContent) && !/“x”“/.test(p.textContent), 'step over: ' + JSON.stringify(p.textContent));
      const caret = getSelection().getRangeAt(0); const pre = document.createRange(); pre.selectNodeContents(p); pre.setEnd(caret.startContainer, caret.startOffset);
      A(pre.toString().endsWith('”'), 'caret after ”');
      key('('); A(/”\(\)$/.test(p.textContent), 'bracket pair in Word: ' + JSON.stringify(p.textContent));
      key('Backspace'); A(/”$/.test(p.textContent), 'Backspace removes (): ' + JSON.stringify(p.textContent));
      // wrap "Say" in brackets, keeping it selected
      selectIn(p, 0, 3); key('[');
      A(/^\[Say\]/.test(p.textContent) && String(getSelection()) === 'Say', 'wrap: ' + JSON.stringify(p.textContent) + ' sel ' + String(getSelection()));
      await sleep(30); ed.flush?.(); ed._commit?.();
      A(/^\\?\[Say\\?\] hi/.test(d.text) || /^\[Say\]/.test(d.text), 'reaches the Markdown: ' + JSON.stringify(d.text));
    } finally { app.settings.set('smartQuotes', sq); ed.unmount(); host.remove(); }
  });
  app.tests.register('typing: slash commands /today and /time in Simple mode', async () => {
    if (!E.createSimple || !app.dates) return;
    const host = E._offscreen(); const ed = E.createSimple(); const d = E.fakeDoc('Due ');
    const was = setting('slashCommands', true);
    try {
      app.settings.set('slashCommands', true);
      ed.mount(host, d); const ta = ed.textarea; ta.focus(); ta.setSelectionRange(4, 4);
      ed.insert('/to'); ta.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(20);
      const h = document.querySelector('.mk-slash');
      A(h && /\/today/.test(h.textContent) && !/\/time/.test(h.textContent), 'hint lists /today: ' + (h && h.textContent));
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      A(!document.querySelector('.mk-slash'), 'Esc closes the hint');
      ed.insert('day');
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));
      const today = app.dates.text('date');
      A(ta.value === 'Due ' + today + ' ', '/today + Space: ' + JSON.stringify(ta.value) + ' want ' + today);
      ed.insert('at /time');
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
      A(ta.value.endsWith('at ' + app.dates.text('time')), '/time + Enter: ' + JSON.stringify(ta.value));
      ed.insert(' see /usr/bin');
      A(/\/usr\/bin$/.test(ta.value), 'other slashes stay as typed');
      app.settings.set('slashCommands', false);
      ed.insert(' /today');
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));
      A(/\/today$/.test(ta.value), 'off: /today stays: ' + JSON.stringify(ta.value));
    } finally { app.settings.set('slashCommands', was); hideHint(); ed.unmount(); host.remove(); }
  });
  app.tests.register('typing: Ctrl+A selects only the document in every mode', async () => {
    const doc = app.docs.create({ title: 'Select all test', text: '# Heading\n\nSome text here.\n\nMore text.' });
    const m0 = app.mode;
    const ctrlA = t => (t || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', ctrlKey: true, bubbles: true, cancelable: true }));
    const ribbon = document.getElementById('ribbon');
    try {
      for (const mode of ['read', 'word', 'inline', 'simple']) {
        app.setMode(mode); await sleep(500);
        getSelection().removeAllRanges();
        document.getElementById('editorHost')?.focus();
        ctrlA(document.getElementById('editorHost'));
        await sleep(20);
        if (mode === 'simple') {
          const ta = app.editors.active().textarea;
          A(document.activeElement === ta && ta.selectionStart === 0 && ta.selectionEnd === ta.value.length, 'Simple: the Markdown is selected');
        } else {
          const s = getSelection(); const r = s.rangeCount ? s.getRangeAt(0) : null;
          A(r && !r.collapsed && /Some text here/.test(String(s)), mode + ': the document text is selected: ' + JSON.stringify(String(s).slice(0, 60)));
          A(!(ribbon && r.intersectsNode(ribbon)) && !/Home|Insert|Layout/.test(String(s).slice(0, 30)), mode + ': not the ribbon');
        }
      }
      // the Simple preview pane: a click there, then Ctrl+A, selects the rendered page only
      app.setMode('simple'); await sleep(600);
      const pv = document.querySelector('#editorHost .mk-preview');
      if (pv && getComputedStyle(pv).display !== 'none') {
        pv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        document.getElementById('editorHost')?.focus();
        ctrlA(document.getElementById('editorHost')); await sleep(20);
        const s = getSelection();
        A(/Some text here/.test(String(s)) && !/# Heading/.test(String(s)) && pv.contains(s.getRangeAt(0).commonAncestorContainer), 'preview: rendered text only: ' + JSON.stringify(String(s).slice(0, 60)));
      }
      // Electron's own Select All (right-click menu) is narrowed to the document
      app.setMode('read'); await sleep(400);
      const r = document.createRange(); r.setStart(document.body, 0); r.setEnd(document.body, document.body.childNodes.length);
      lastPress = { el: document.querySelector('#editorHost .mk-page') || document.getElementById('editorHost'), t: Date.now() };
      getSelection().removeAllRanges(); getSelection().addRange(r);
      await sleep(60);
      const s2 = getSelection(); A(s2.rangeCount && !(ribbon && s2.getRangeAt(0).intersectsNode(ribbon)), 'window-wide select all narrowed to the page');
      A(getComputedStyle(ribbon).userSelect === 'none' || getComputedStyle(ribbon).webkitUserSelect === 'none', 'ribbon text is not selectable');
    } finally { getSelection().removeAllRanges(); app.setMode(m0); await sleep(300); await app.docs.close(doc.id, { force: true }); }
  });
  app.tests.register('typing: paste as plain text in Simple, Word and Inline, and a hint in Read', async () => {
    const doc = app.docs.create({ title: 'Paste test', text: 'Start.' });
    const m0 = app.mode;
    let seen = '';
    const saved = await clipboardText(); // the user's clipboard comes back afterwards
    const canClip = !!(await (async () => { try { await mk.copyText('Plain *words*\r\nline two'); seen = await clipboardText(); return seen.replace(/\r\n/g, '\n') === 'Plain *words*\nline two'; } catch (e) { seen = String(e); return false; } })());
    try {
      A(app.commands.get('edit.pastePlain') && [].concat(app.commands.get('edit.pastePlain').shortcut || [], app.commands.get('edit.pastePlain').shortcuts || []).some(k => /Ctrl\+Alt\+V/i.test(k)), 'Ctrl+Alt+V is Paste as plain text');
      A(canClip || mk.platform !== 'win32', 'the clipboard can be read through main (clipboard-read-text): ' + JSON.stringify(seen).slice(0, 120));
      if (!canClip) return; // no clipboard on this test machine (a Linux runner without a display)
      for (const mode of ['simple', 'inline', 'word']) {
        app.setMode(mode); await sleep(500);
        const ad = app.editors.active();
        const end = doc.text.length;
        if (mode === 'word') { ad.focus(); const pg = ad.page; const last = pg.querySelector('p:last-of-type') || pg; const rr = document.createRange(); rr.selectNodeContents(last); rr.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(rr); }
        else { await ad.setSelection(end, end); await ad.whenIdle?.(); }
        await app.commands.run('edit.pastePlain'); await sleep(80); ad.flush?.(); ad._commit?.(); await ad.whenIdle?.();
        A(/Plain \\?\*words\\?\*/.test(doc.text) && /line two/.test(doc.text), mode + ': pasted as typed text: ' + JSON.stringify(doc.text));
        doc.setText('Start.', 'test'); ad.refresh?.(); await sleep(150);
      }
      app.setMode('read'); await sleep(300);
      const n0 = (app.ui.toastLog || []).length;
      await app.commands.run('edit.pastePlain');
      A(doc.text === 'Start.', 'Read mode changes nothing');
      const last = (app.ui.toastLog || []).slice(n0).pop();
      A(!last || /^Press Esc/.test(last.msg), 'Read mode says how: ' + (last && last.msg));
    } finally { try { await mk.copyText(saved || ''); } catch {} app.setMode(m0); await sleep(300); await app.docs.close(doc.id, { force: true }); }
  });
  app.tests.register('typing: screenshots of multiple cursors and the slash list', async () => {
    const doc = app.docs.create({ title: 'Typing aids', text: '# Shopping list\n\n- apples from the market\n- pears from the market\n- plums from the market\n\nDue ' });
    const m0 = app.mode;
    try {
      app.setMode('simple'); await sleep(700);
      const ad = app.editors.active(); const ta = ad.textarea;
      ad.setSelection(doc.text.length, doc.text.length); ad.insert('/'); ta.dispatchEvent(new Event('input', { bubbles: true })); await sleep(120);
      A(document.querySelector('.mk-slash') && document.querySelectorAll('.mk-slash-it').length === 4, 'all four slash commands listed');
      try { await mk.invoke('smoke-shot', 'slash-commands'); } catch {}
      hideHint();
      const at = doc.text.indexOf('market'); ad.setSelection(at + 2, at + 2);
      if (app.multicursor) {
        for (let i = 0; i < 3; i++) ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', ctrlKey: true, bubbles: true, cancelable: true }));
        A(app.multicursor.cursors(ta).length === 3, 'three cursors on "market"');
        await sleep(120);
        try { await mk.invoke('smoke-shot', 'multi-cursor'); } catch {}
        app.multicursor.clear(ta);
      }
    } finally { hideHint(); app.setMode(m0); await sleep(300); await app.docs.close(doc.id, { force: true }); }
  });
  app.tests.register('typing: options switches in File → Options', async () => {
    app.backstage.open('options'); await sleep(150);
    try {
      for (const k of ['autoPair', 'autoPairMarkup', 'autoPairMath', 'slashCommands']) A(document.querySelector(`.opt-card[data-section="typing"] .mk-switch[data-setting="${k}"]`), 'switch for ' + k);
      const card = document.querySelector('.opt-card[data-section="typing"]');
      card?.scrollIntoView({ block: 'start' }); await sleep(250);
      try { await mk.invoke('smoke-shot', 'options-typing-aids'); } catch {}
    } finally { app.backstage.close(); }
  });
})();
