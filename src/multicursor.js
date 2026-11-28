// Markooj — multiple cursors in Simple mode's Markdown source (PLAN-v5 item 69).
//   Alt+click adds a cursor · Ctrl+Alt+Up / Down add one on the line above / below · Ctrl+D selects the next match
//   Alt+F3 selects every match (Ctrl+Shift+L too, once several cursors are on) · Esc goes back to one cursor.
// The source editor is a plain <textarea> over a highlighted mirror, so the textarea keeps one real selection (the
// "primary" cursor) and the others are drawn on a layer between the mirror and the textarea. Every edit is applied to
// all cursors at once, as one replace of the span between the first and the last cursor, so Ctrl+Z undoes it in one step.
// Word and Inline mode edit a rendered page with one caret; there the commands say how to get multiple cursors.
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const E = app.editor = app.editor || {};
  const MC = app.multicursor = app.multicursor || {};
  const states = new WeakMap(); // textarea → {cursors:[{a, h}], primary, layer, applying, needle, word}

  const isSrc = t => !!t && t.tagName === 'TEXTAREA' && t.classList.contains('mk-src-ta');
  const lo = c => Math.min(c.a, c.h), hi = c => Math.max(c.a, c.h);
  const lineStart = (v, i) => v.lastIndexOf('\n', i - 1) + 1;
  const lineEnd = (v, i) => { const n = v.indexOf('\n', i); return n < 0 ? v.length : n; };
  const WORD = /[\p{L}\p{N}_]/u;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function st(ta) { let s = states.get(ta); if (!s) { s = { cursors: [], primary: 0, layer: null, applying: false, needle: null, word: false }; states.set(ta, s); } return s; }
  MC.isActive = ta => !!(ta && states.get(ta)?.cursors.length > 1);
  MC.cursors = ta => (states.get(ta)?.cursors || []).map(c => ({ start: lo(c), end: hi(c), anchor: c.a, head: c.h }));
  function native(ta) { return { a: ta.selectionDirection === 'backward' ? ta.selectionEnd : ta.selectionStart, h: ta.selectionDirection === 'backward' ? ta.selectionStart : ta.selectionEnd }; }
  /** Sort, merge overlapping cursors, keep track of the primary one. */
  function normalize(s) {
    const prim = s.cursors[s.primary];
    s.cursors.sort((x, y) => lo(x) - lo(y) || hi(x) - hi(y));
    const out = [];
    for (const c of s.cursors) {
      const last = out[out.length - 1];
      if (last && (lo(c) < hi(last) || (lo(c) === lo(last) && hi(c) === hi(last)) || (lo(c) === hi(last) && lo(c) === hi(c) && lo(last) === hi(last)))) {
        const a = Math.min(lo(last), lo(c)), b = Math.max(hi(last), hi(c));
        const fwd = last.h >= last.a; last.a = fwd ? a : b; last.h = fwd ? b : a;
        if (c === prim) last._p = true;
        continue;
      }
      out.push(c);
    }
    s.cursors = out;
    let p = out.findIndex(c => c === prim || c._p); out.forEach(c => delete c._p);
    s.primary = p < 0 ? out.length - 1 : p;
  }
  function begin(ta) {
    const s = st(ta);
    if (s.cursors.length < 2) { s.cursors = [native(ta)]; s.primary = 0; }
    return s;
  }
  /** Back to one cursor (the primary one, or the one given). */
  MC.clear = (ta, keep) => {
    const s = states.get(ta); if (!s) return;
    const p = keep || s.cursors[s.primary];
    s.cursors = []; s.primary = 0; s.needle = null; s.word = false;
    if (s.layer) s.layer.textContent = '';
    if (p && ta.isConnected) { try { ta.setSelectionRange(lo(p), hi(p), p.h < p.a ? 'backward' : 'forward'); } catch {} }
    ta.closest('.mk-src')?.classList.remove('mk-mc-on');
  };
  function sync(ta, s) {
    normalize(s);
    if (s.cursors.length < 2) { MC.clear(ta, s.cursors[0]); return; }
    const p = s.cursors[s.primary];
    s.applying = true;
    try { ta.setSelectionRange(lo(p), hi(p), p.h < p.a ? 'backward' : 'forward'); } finally { s.applying = false; }
    ta.closest('.mk-src')?.classList.add('mk-mc-on');
    draw(ta, s);
    app.events.emit('selection:changed', { mode: 'simple', multi: s.cursors.length });
  }

  // ------------------------------------------------------------------ drawing the extra cursors
  function mirrorOf(ta) { return ta.parentElement?.querySelector('.mk-src-mirror') || null; }
  /** Client rect of the caret at offset `off` of the textarea, measured on the highlighted mirror. */
  function pointRect(ta, off) {
    const mir = mirrorOf(ta); if (!mir) return null;
    const v = ta.value; let li = 0; for (let i = v.indexOf('\n'); i >= 0 && i < off; i = v.indexOf('\n', i + 1)) li++;
    const ln = mir.children[li]; if (!ln) return null;
    let col = off - lineStart(v, off);
    const w = document.createTreeWalker(ln, NodeFilter.SHOW_TEXT); let n, last = null;
    while ((n = w.nextNode())) {
      if (col <= n.data.length) {
        const r = document.createRange(); r.setStart(n, col); r.collapse(true);
        const rc = r.getClientRects(); const rr = rc[rc.length ? (col === 0 ? 0 : rc.length - 1) : 0] || r.getBoundingClientRect();
        if (rr && (rr.height || rr.top)) return { left: rr.left, top: rr.top, bottom: rr.bottom || rr.top + rr.height, height: rr.height };
        break;
      }
      col -= n.data.length; last = n;
    }
    const lr = ln.getBoundingClientRect(); const cs = getComputedStyle(ln);
    if (last) { const r = document.createRange(); r.setStart(last, last.data.length); r.collapse(true); const rr = r.getBoundingClientRect(); if (rr.height) return { left: rr.left, top: rr.top, bottom: rr.bottom, height: rr.height }; }
    const lh = parseFloat(cs.lineHeight) || 22;
    return { left: lr.left + (parseFloat(cs.paddingLeft) || 0), top: lr.top, bottom: lr.top + lh, height: lh };
  }
  MC.caretRect = pointRect;
  function rangeRects(ta, a, b) {
    const mir = mirrorOf(ta); if (!mir || a === b) return [];
    const v = ta.value;
    const at = off => {
      let li = 0; for (let i = v.indexOf('\n'); i >= 0 && i < off; i = v.indexOf('\n', i + 1)) li++;
      const ln = mir.children[li]; if (!ln) return null;
      let col = off - lineStart(v, off);
      const w = document.createTreeWalker(ln, NodeFilter.SHOW_TEXT); let n, last = null;
      while ((n = w.nextNode())) { if (col <= n.data.length) return [n, col]; col -= n.data.length; last = n; }
      return last ? [last, last.data.length] : [ln, 0];
    };
    const p = at(a), q = at(b); if (!p || !q) return [];
    const r = document.createRange(); try { r.setStart(p[0], p[1]); r.setEnd(q[0], q[1]); } catch { return []; }
    return [...r.getClientRects()].filter(x => x.width > 0.5);
  }
  function draw(ta, s) {
    const inner = ta.parentElement; if (!inner) return;
    if (!s.layer || !s.layer.isConnected) {
      s.layer = document.createElement('div'); s.layer.className = 'mk-mc-layer'; s.layer.setAttribute('aria-hidden', 'true');
      inner.insertBefore(s.layer, ta);
    }
    const base = inner.getBoundingClientRect();
    const frag = document.createDocumentFragment();
    s.cursors.forEach((c, i) => {
      if (i !== s.primary) {
        for (const r of rangeRects(ta, lo(c), hi(c))) {
          const d = document.createElement('div'); d.className = 'mk-mc-sel';
          d.style.cssText = `left:${r.left - base.left}px;top:${r.top - base.top}px;width:${r.width}px;height:${r.height}px`;
          frag.appendChild(d);
        }
        const p = pointRect(ta, c.h);
        if (p) { const k = document.createElement('div'); k.className = 'mk-mc-caret'; k.style.cssText = `left:${p.left - base.left}px;top:${p.top - base.top}px;height:${p.height || 20}px`; frag.appendChild(k); }
      }
    });
    s.layer.textContent = ''; s.layer.appendChild(frag);
  }
  MC.redraw = ta => { const s = states.get(ta); if (s && s.cursors.length > 1) draw(ta, s); };

  // ------------------------------------------------------------------ editing every cursor at once
  /** edits: one per cursor, {a, b, text, caret (offset from a after the edit), sel (optional [start, end] from a)}. */
  function apply(ta, s, edits) {
    const v = ta.value;
    const list = edits.map((e, i) => ({ ...e, i })).sort((x, y) => x.a - y.a || x.b - y.b);
    // drop overlaps (two Backspaces over the same character)
    const keep = []; for (const e of list) { const last = keep[keep.length - 1]; if (last && e.a < last.b) { e.a = Math.max(e.a, last.b); e.b = Math.max(e.a, e.b); } keep.push(e); }
    const from = keep[0].a, to = keep[keep.length - 1].b;
    let out = '', pos = from; const next = [];
    for (const e of keep) {
      out += v.slice(pos, e.a);
      const at = from + out.length;
      out += e.text; pos = e.b;
      const sel = e.sel || [e.caret ?? e.text.length, e.caret ?? e.text.length];
      next[e.i] = { a: at + sel[0], h: at + sel[1] };
    }
    out += v.slice(pos, to);
    const prim = s.primary;
    s.applying = true;
    try {
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(from, to);
      let ok = false;
      try { ok = out === '' ? (from === to ? true : document.execCommand('delete')) : document.execCommand('insertText', false, out); } catch { ok = false; }
      const want = v.slice(0, from) + out + v.slice(to);
      if (!ok || ta.value !== want) { ta.value = want; ta.dispatchEvent(new Event('input', { bubbles: true })); }
    } finally { s.applying = false; }
    s.cursors = next.filter(Boolean); s.primary = Math.min(prim, s.cursors.length - 1);
    sync(ta, s);
  }
  MC.type = (ta, text) => {
    const s = st(ta); if (s.cursors.length < 2) return false;
    apply(ta, s, s.cursors.map(c => ({ a: lo(c), b: hi(c), text })));
    return true;
  };
  /** Paste: one line per cursor when the counts match, else the whole text at every cursor. */
  MC.paste = (ta, text) => {
    const s = st(ta); if (s.cursors.length < 2) return false;
    text = String(text ?? '').replace(/\r\n?/g, '\n');
    const lines = text.replace(/\n$/, '').split('\n');
    const per = lines.length === s.cursors.length;
    apply(ta, s, s.cursors.map((c, i) => ({ a: lo(c), b: hi(c), text: per ? lines[i] : text })));
    return true;
  };
  function prevBoundary(v, i, word) {
    if (i <= 0) return 0;
    if (!word) return /[\uDC00-\uDFFF]/.test(v[i - 1]) && i >= 2 ? i - 2 : i - 1;
    let j = i; while (j > 0 && /\s/.test(v[j - 1]) && v[j - 1] !== '\n') j--;
    if (j > 0 && WORD.test(v[j - 1])) { while (j > 0 && WORD.test(v[j - 1])) j--; } else if (j === i) j--;
    return Math.max(0, j);
  }
  function nextBoundary(v, i, word) {
    if (i >= v.length) return v.length;
    if (!word) return /[\uD800-\uDBFF]/.test(v[i]) ? i + 2 : i + 1;
    let j = i; while (j < v.length && /\s/.test(v[j]) && v[j] !== '\n') j++;
    if (j < v.length && WORD.test(v[j])) { while (j < v.length && WORD.test(v[j])) j++; } else if (j === i) j++;
    return Math.min(v.length, j);
  }
  function backspace(ta, s, forward, word) {
    const v = ta.value;
    apply(ta, s, s.cursors.map(c => {
      if (lo(c) !== hi(c)) return { a: lo(c), b: hi(c), text: '' };
      const h = c.h;
      return forward ? { a: h, b: nextBoundary(v, h, word), text: '' } : { a: prevBoundary(v, h, word), b: h, text: '' };
    }));
  }
  function move(ta, s, key, shift, word) {
    const v = ta.value;
    for (const c of s.cursors) {
      let h = c.h;
      const collapsedMove = !shift && lo(c) !== hi(c) && (key === 'ArrowLeft' || key === 'ArrowRight');
      if (collapsedMove) { h = key === 'ArrowLeft' ? lo(c) : hi(c); c.a = c.h = h; continue; }
      if (key === 'ArrowLeft') h = prevBoundary(v, h, word);
      else if (key === 'ArrowRight') h = nextBoundary(v, h, word);
      else if (key === 'Home') { const ls = lineStart(v, h); const ind = ls + (/^[ \t]*/.exec(v.slice(ls, lineEnd(v, h)))[0].length); h = h === ind ? ls : ind; }
      else if (key === 'End') h = lineEnd(v, h);
      else if (key === 'ArrowUp' || key === 'ArrowDown') {
        const ls = lineStart(v, h); const col = c.col ?? (h - ls);
        if (key === 'ArrowUp') { if (ls === 0) h = 0; else { const ps = lineStart(v, ls - 1); h = Math.min(ps + col, ls - 1); } }
        else { const le = lineEnd(v, h); if (le >= v.length) h = v.length; else { const ns = le + 1; h = Math.min(ns + col, lineEnd(v, ns)); } }
        c.col = col;
      }
      if (key !== 'ArrowUp' && key !== 'ArrowDown') delete c.col;
      c.h = h; if (!shift) c.a = h;
    }
    sync(ta, s);
  }

  // ------------------------------------------------------------------ adding cursors
  function wordAt(v, i) {
    let a = i, b = i;
    while (a > 0 && WORD.test(v[a - 1])) a--;
    while (b < v.length && WORD.test(v[b])) b++;
    return a < b ? [a, b] : null;
  }
  function findFrom(v, needle, from, word, taken) {
    if (!needle) return null;
    const ok = i => !word || (!WORD.test(v[i - 1] || '') && !WORD.test(v[i + needle.length] || ''));
    const free = i => !taken.some(c => lo(c) === i && hi(c) === i + needle.length);
    for (let pass = 0; pass < 2; pass++) {
      let i = v.indexOf(needle, pass ? 0 : from);
      while (i >= 0 && (pass === 0 || i < from)) { if (ok(i) && free(i)) return i; i = v.indexOf(needle, i + 1); }
    }
    return null;
  }
  /** Ctrl+D: select the word at the cursor, then each next match (a new cursor each time). */
  MC.selectNext = (ta) => {
    const v = ta.value; const s = begin(ta); const p = s.cursors[s.primary];
    if (s.cursors.length === 1) {
      if (lo(p) === hi(p)) {
        // first press: the word at the cursor (later presses look for it as a whole word)
        const w = wordAt(v, p.h); if (!w) { hint(app.t('Put the cursor in a word or select some text first, then press Ctrl+D to select the next match.')); return false; }
        s.cursors = []; s.needle = v.slice(w[0], w[1]); s.word = true;
        ta.setSelectionRange(w[0], w[1]); return true;
      }
      const t = v.slice(lo(p), hi(p)); if (t !== s.needle) { s.needle = t; s.word = false; }
    }
    if (!s.needle) s.needle = v.slice(lo(p), hi(p));
    const i = findFrom(v, s.needle, hi(p), s.word, s.cursors);
    if (i == null) { hint(s.cursors.length > 1 ? app.t('Type to change every selected match at once, or press Esc for one cursor. All matches are selected.') : app.t('Select other text to look for, or press Esc. There is no other match.')); return false; }
    s.cursors.push({ a: i, h: i + s.needle.length }); s.primary = s.cursors.length - 1;
    sync(ta, s); return true;
  };
  /** Alt+F3 (and Ctrl+Shift+L while several cursors are on): a cursor on every match. */
  MC.selectAll = (ta) => {
    const v = ta.value; const s = begin(ta); const p = s.cursors[s.primary];
    let needle = s.needle, word = s.word;
    if (!needle) { if (lo(p) === hi(p)) { const w = wordAt(v, p.h); if (!w) { hint(app.t('Put the cursor in a word or select some text first, then press Alt+F3 to select every match.')); return false; } needle = v.slice(w[0], w[1]); word = true; } else { needle = v.slice(lo(p), hi(p)); word = false; } }
    const out = []; let i = v.indexOf(needle);
    while (i >= 0) { if (!word || (!WORD.test(v[i - 1] || '') && !WORD.test(v[i + needle.length] || ''))) out.push({ a: i, h: i + needle.length }); i = v.indexOf(needle, i + Math.max(1, needle.length)); }
    if (!out.length) return false;
    const here = out.findIndex(c => lo(c) <= p.h && p.h <= hi(c));
    s.cursors = out; s.primary = here < 0 ? 0 : here; s.needle = needle; s.word = word;
    sync(ta, s);
    if (out.length === 1) hint(app.t('Select other text to look for, or press Esc. This is the only match.'));
    return true;
  };
  /** Ctrl+Alt+Up / Down: a new cursor on the line above the top one (or below the bottom one), same column. */
  MC.addLine = (ta, dir) => {
    const v = ta.value; const s = begin(ta);
    const edge = dir < 0 ? s.cursors.reduce((m, c) => (c.h < m.h ? c : m)) : s.cursors.reduce((m, c) => (c.h > m.h ? c : m));
    const ls = lineStart(v, edge.h), col = edge.col ?? (edge.h - ls);
    let h;
    if (dir < 0) { if (ls === 0) return false; const ps = lineStart(v, ls - 1); h = Math.min(ps + col, ls - 1); }
    else { const le = lineEnd(v, edge.h); if (le >= v.length) return false; const ns = le + 1; h = Math.min(ns + col, lineEnd(v, ns)); }
    s.cursors.push({ a: h, h, col }); s.primary = s.cursors.length - 1;
    sync(ta, s); return true;
  };
  function hint(msg) { app.ui.toast?.(msg, { kind: 'info', timeout: 2600 }); }

  // ------------------------------------------------------------------ keys and mouse (the textarea of Simple mode)
  document.addEventListener('keydown', e => {
    const ta = e.target; if (!isSrc(ta) || e.isComposing || e.keyCode === 229) return;
    const name = E.keyName ? E.keyName(e) : '';
    const act = (fn) => { e.preventDefault(); e.stopPropagation(); fn(); };
    if (name === 'Ctrl+D') return act(() => MC.selectNext(ta));
    if (name === 'Alt+F3') return act(() => MC.selectAll(ta));
    if (name === 'Ctrl+Alt+Up' || name === 'Ctrl+Alt+Down') return act(() => MC.addLine(ta, name.endsWith('Up') ? -1 : 1));
    const s = states.get(ta);
    if (!s || s.cursors.length < 2) return;
    if (name === 'Ctrl+Shift+L') return act(() => MC.selectAll(ta));
    const k = e.key, mod = e.ctrlKey || e.metaKey;
    if (k === 'Escape') return act(() => MC.clear(ta));
    if (/^(Control|Shift|Alt|Meta|AltGraph|CapsLock)$/.test(k)) return;
    if (!mod && !e.altKey && k === 'Enter') return act(() => MC.type(ta, '\n'));
    if (!mod && !e.altKey && k === 'Tab') return act(() => MC.type(ta, '\t'));
    if (!e.altKey && (k === 'Backspace' || k === 'Delete')) return act(() => backspace(ta, s, k === 'Delete', mod));
    if (!e.altKey && /^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Home|End)$/.test(k) && !(mod && /Home|End|Up|Down/.test(k))) return act(() => move(ta, s, k, e.shiftKey, mod));
    const typed = typeof k === 'string' && [...k].length === 1 && (!mod && !e.altKey || (E.isAltGrChar && E.isAltGrChar(e)));
    // the built-in keyboards (Urdu, Arabic …) type their own letters at every cursor ('' = a key that types nothing)
    const mapped = app.keyboards?.mapKey ? app.keyboards.mapKey(e, ta) : null;
    if (mapped === '') return act(() => {});
    if (mapped) return act(() => MC.type(ta, mapped));
    if (typed) return act(() => MC.type(ta, k));
    // copy, cut and paste come as clipboard events; anything else (Ctrl+Z, Ctrl+B …) works on one cursor
    if (mod && /^[cvxCVX]$/.test(k)) return;
    MC.clear(ta);
  }, true);
  document.addEventListener('copy', e => onClip(e, false), true);
  document.addEventListener('cut', e => onClip(e, true), true);
  function onClip(e, cut) {
    const ta = e.target; if (!isSrc(ta) || !MC.isActive(ta)) return;
    const s = states.get(ta); const v = ta.value;
    if (s.cursors.every(c => lo(c) === hi(c))) return;
    e.preventDefault(); e.stopPropagation();
    e.clipboardData?.setData('text/plain', s.cursors.map(c => v.slice(lo(c), hi(c))).join('\n'));
    if (cut) apply(ta, s, s.cursors.map(c => ({ a: lo(c), b: hi(c), text: '' })));
  }
  document.addEventListener('paste', e => {
    const ta = e.target; if (!isSrc(ta) || !MC.isActive(ta)) return;
    if ([...(e.clipboardData?.files || [])].length) return;
    e.preventDefault(); e.stopPropagation();
    MC.paste(ta, e.clipboardData?.getData('text/plain') || '');
  }, true);
  // Alt+click adds a cursor; any other click goes back to one
  let pending = null;
  document.addEventListener('mousedown', e => {
    const ta = e.target; if (!isSrc(ta)) return;
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.button === 0) {
      const s = begin(ta); pending = { ta, keep: s.cursors.map(c => ({ ...c })), primary: s.primary };
      return;
    }
    if (MC.isActive(ta)) MC.clear(ta);
  }, true);
  document.addEventListener('mouseup', () => {
    if (!pending) return; const { ta, keep } = pending; pending = null;
    setTimeout(() => { MC.addAt(ta, native(ta), keep); }, 0);
  }, true);
  /** Adds a cursor (or a selection) to the ones in `keep` (default: the cursors on now). */
  MC.addAt = (ta, c, keep) => {
    const s = st(ta);
    s.cursors = (keep || (s.cursors.length ? s.cursors : [native(ta)])).map(x => ({ ...x }));
    const dup = s.cursors.findIndex(x => lo(x) === lo(c) && hi(x) === hi(c));
    if (dup >= 0 && s.cursors.length > 1) { s.cursors.splice(dup, 1); s.primary = s.cursors.length - 1; sync(ta, s); return true; } // Alt+click on a cursor removes it
    s.cursors.push({ a: c.a, h: c.h }); s.primary = s.cursors.length - 1;
    sync(ta, s); return true;
  };
  document.addEventListener('input', e => { const ta = e.target; if (!isSrc(ta)) return; const s = states.get(ta); if (s && !s.applying && s.cursors.length > 1) MC.clear(ta); }, true);
  document.addEventListener('focusout', e => { const ta = e.target; if (isSrc(ta) && MC.isActive(ta) && !pending) setTimeout(() => { if (document.activeElement !== ta) MC.clear(ta); }, 0); }, true);
  addEventListener('resize', () => { const ad = app.editors.get?.('simple'); if (ad?.textarea) MC.redraw(ad.textarea); });
  app.events.on('zoom:changed', () => setTimeout(() => { const ad = app.editors.get?.('simple'); if (ad?.textarea) MC.redraw(ad.textarea); }, 30));
  app.events.on('mode:changed', () => { const ad = app.editors.get?.('simple'); if (ad?.textarea) MC.clear(ad.textarea); });

  // ------------------------------------------------------------------ commands (palette, and a hint outside Simple mode)
  const srcTa = () => (app.mode === 'simple' ? app.editors.active()?.textarea || null : null);
  function needSimple(what) {
    const d = app.docs.active();
    if (!d || d.kind !== 'markdown') { hint(app.t('Open a Markdown document first. Multiple cursors work in Simple mode.')); return false; }
    app.ui.toast?.(app.t('Switch to Simple mode (Ctrl+3) to use {feature}. Word and Inline mode have one cursor; Simple mode edits the Markdown with as many as you like.', { feature: app.t(what) }), {
      kind: 'info', actions: [{ label: app.t('Switch to Simple mode'), run: () => app.setMode('simple') }],
    });
    return false;
  }
  const C = (id, def) => app.commands.register(id, { category: 'Edit', isEnabled: () => !!app.docs.active(), why: () => (app.docs.active() ? '' : app.t('Open or create a document first.')), ...def });
  C('edit.selectNextOccurrence', { label: app.tm('Select next match'), icon: 'search', altShortcuts: ['Ctrl+D'],
    description: app.tm('Simple mode: select the word at the cursor, then each next match with one more cursor. Type to change them all at once. Esc goes back to one cursor.'),
    run: () => { const ta = srcTa(); return ta ? (ta.focus(), MC.selectNext(ta)) : needSimple(app.tm('Select next match')); } });
  C('edit.selectAllOccurrences', { label: app.tm('Select all matches'), icon: 'search', altShortcuts: ['Alt+F3'],
    description: app.tm('Simple mode: put a cursor on every match of the selected text (or the word at the cursor). With several cursors on, Ctrl+Shift+L does the same.'),
    run: () => { const ta = srcTa(); return ta ? (ta.focus(), MC.selectAll(ta)) : needSimple(app.tm('Select all matches')); } });
  C('edit.addCursorAbove', { label: app.tm('Add cursor above'), icon: 'chevup', altShortcuts: ['Ctrl+Alt+Up'],
    description: app.tm('Simple mode: add a cursor on the line above, at the same column. Alt+click adds one anywhere.'),
    run: () => { const ta = srcTa(); return ta ? (ta.focus(), MC.addLine(ta, -1)) : needSimple(app.tm('multiple cursors')); } });
  C('edit.addCursorBelow', { label: app.tm('Add cursor below'), icon: 'chev', altShortcuts: ['Ctrl+Alt+Down'],
    description: app.tm('Simple mode: add a cursor on the line below, at the same column. Alt+click adds one anywhere.'),
    run: () => { const ta = srcTa(); return ta ? (ta.focus(), MC.addLine(ta, 1)) : needSimple(app.tm('multiple cursors')); } });
  C('edit.singleCursor', { label: app.tm('Back to one cursor'), icon: 'x', hint: 'Esc',
    description: app.tm('Remove the extra cursors and keep the last one.'),
    isEnabled: () => MC.isActive(srcTa()),
    why: () => app.t('There is only one cursor now. Ctrl+D, Ctrl+Alt+Up or Down, or Alt+click add more in Simple mode.'),
    run: () => { const ta = srcTa(); if (ta) { MC.clear(ta); ta.focus(); } } });

  // ------------------------------------------------------------------ smoke tests
  const A = (c, m) => app.assert(c, m);
  async function withSimple(text, fn) {
    if (!E.createSimple) return;
    const host = E._offscreen(); const ed = E.createSimple(); const d = E.fakeDoc(text);
    try { ed.mount(host, d); await sleep(30); await fn(ed, ed.textarea, d); } finally { MC.clear(ed.textarea); ed.unmount(); host.remove(); }
  }
  const key = (ta, k, o = {}) => ta.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: o.code || (k.length === 1 ? 'Key' + k.toUpperCase() : k), bubbles: true, cancelable: true, ...o }));
  app.tests.register('typing: multi-cursor Ctrl+D, typing, Backspace and one undo step', async () => {
    await withSimple('cat dog cat bird cat', async (ed, ta, d) => {
      ta.focus(); ta.setSelectionRange(1, 1);
      key(ta, 'd', { code: 'KeyD', ctrlKey: true });
      A(ta.selectionStart === 0 && ta.selectionEnd === 3 && !MC.isActive(ta), 'Ctrl+D selects the word');
      key(ta, 'd', { code: 'KeyD', ctrlKey: true });
      A(MC.isActive(ta) && MC.cursors(ta).length === 2, 'second Ctrl+D adds the next match');
      key(ta, 'd', { code: 'KeyD', ctrlKey: true });
      A(MC.cursors(ta).length === 3 && MC.cursors(ta).map(c => c.start).join() === '0,8,17', 'three: ' + JSON.stringify(MC.cursors(ta)));
      A(ta.parentElement.querySelectorAll('.mk-mc-caret').length === 2, 'two extra carets drawn');
      key(ta, 'f', { code: 'KeyF' }); key(ta, 'o', { code: 'KeyO' }); key(ta, 'x', { code: 'KeyX' });
      A(ta.value === 'fox dog fox bird fox' && d.text === ta.value, 'typed at every cursor: ' + JSON.stringify(ta.value));
      key(ta, 'Backspace', { code: 'Backspace' });
      A(ta.value === 'fo dog fo bird fo', 'Backspace at every cursor: ' + JSON.stringify(ta.value));
      key(ta, 'ArrowLeft', { code: 'ArrowLeft' }); key(ta, 'ArrowLeft', { code: 'ArrowLeft' }); key(ta, '*', { code: 'Digit8' });
      A(ta.value === '*fo dog *fo bird *fo', 'arrows move every cursor: ' + JSON.stringify(ta.value));
      key(ta, 'Escape', { code: 'Escape' });
      A(!MC.isActive(ta) && !ta.parentElement.querySelector('.mk-mc-caret'), 'Esc: one cursor');
      document.execCommand('undo');
      A(ta.value === 'fo dog fo bird fo' || ta.value === 'fox dog fox bird fox', 'one undo step per edit: ' + JSON.stringify(ta.value));
    });
  });
  app.tests.register('typing: multi-cursor Ctrl+Alt+Down, Alt+F3, paste one line per cursor', async () => {
    await withSimple('- a\n- b\n- c', async (ed, ta) => {
      ta.focus(); ta.setSelectionRange(2, 2);
      key(ta, 'ArrowDown', { code: 'ArrowDown', ctrlKey: true, altKey: true });
      key(ta, 'ArrowDown', { code: 'ArrowDown', ctrlKey: true, altKey: true });
      A(MC.cursors(ta).map(c => c.start).join() === '2,6,10', 'a cursor on each line: ' + JSON.stringify(MC.cursors(ta)));
      key(ta, 'End', { code: 'End' });
      MC.paste(ta, 'one\ntwo\nthree');
      A(ta.value === '- aone\n- btwo\n- cthree', 'paste one line each: ' + JSON.stringify(ta.value));
      MC.clear(ta);
      ta.setSelectionRange(0, 1);
      key(ta, 'F3', { code: 'F3', altKey: true });
      A(MC.cursors(ta).length === 3, 'Alt+F3 selects every "-": ' + JSON.stringify(MC.cursors(ta)));
      key(ta, '*', { code: 'Digit8' });
      A(ta.value === '* aone\n* btwo\n* cthree', 'changed all: ' + JSON.stringify(ta.value));
    });
  });
  // bug hunt (round 5): with the built-in Urdu keyboard on, several cursors typed English letters (this key handler
  // runs before the keyboard's and took the raw key)
  app.tests.register('typing: multi-cursor types the built-in keyboard’s letters (Urdu)', async () => {
    const K = app.keyboards; if (!K) return;
    const k0 = K.current();
    await withSimple('ab\nab', async (ed, ta) => {
      ta.parentElement.closest('div')?.setAttribute('data-mk-kbd', '');
      ta.setAttribute('data-mk-kbd', '');
      try {
        K.set('ur', { quiet: true });
        const want = K.charFor('KeyS', 0, 'ur');
        A(want && want !== 's', 'the Urdu layout maps S: ' + want);
        ta.focus(); ta.setSelectionRange(2, 2);
        MC.addAt(ta, { a: 5, h: 5 });
        A(MC.cursors(ta).length === 2, 'two cursors');
        key(ta, 's', { code: 'KeyS' });
        A(ta.value === `ab${want}\nab${want}`, 'typed the Urdu letter at both cursors: ' + JSON.stringify(ta.value));
        A(MC.isActive(ta), 'still two cursors');
      } finally { K.set(k0, { quiet: true }); }
    });
  });
  app.tests.register('typing: multi-cursor Alt+click adds a cursor; other modes explain', async () => {
    await withSimple('alpha\nbeta', async (ed, ta) => {
      ta.focus(); ta.setSelectionRange(1, 1);
      MC.addAt(ta, { a: 7, h: 7 });
      A(MC.cursors(ta).length === 2, 'added');
      key(ta, 'X', { code: 'KeyX', shiftKey: true });
      A(ta.value === 'aXlpha\nbXeta', 'typed at both: ' + JSON.stringify(ta.value));
      ta.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      A(!MC.isActive(ta), 'a plain click goes back to one cursor');
    });
    const keys = app.keys?.conflicts?.() || [];
    A(!keys.some(k => /Ctrl\+D|Alt\+F3|Ctrl\+Alt\+(Up|Down)/.test(k.key)), 'no key clashes: ' + JSON.stringify(keys));
    const doc = app.docs.create({ title: 'MC hint', text: 'x' }); const m0 = app.mode;
    try {
      app.setMode('word'); await sleep(300);
      const n0 = (app.ui.toastLog || []).length;
      await app.commands.run('edit.selectNextOccurrence');
      const t = (app.ui.toastLog || []).slice(n0).pop();
      A(t && /^Switch to Simple mode/.test(t.msg) && (t.actions || []).length, 'Word mode: solution-first hint with a button: ' + (t && t.msg));
    } finally { app.setMode(m0); await sleep(200); await app.docs.close(doc.id, { force: true }); }
  });
})();
