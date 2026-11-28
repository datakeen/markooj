// Markooj — Inline (live) mode: the page looks finished; the block under the caret shows its Markdown
// so it can be edited in place, and renders again when you leave it (Typora / Obsidian style).
// Also home of two shared helpers:
//   app.typing — AutoCorrect (-- → –, (c) → ©, ... → …), smart quotes, per-keystroke undo history.
//                Wired into Word mode from here through the 'word:rendered' event.
//   app.notes  — hidden notes %%like this%%: faint while editing, gone in Read mode, print and export.
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const E = app.editor = app.editor || {};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // the stylesheet normally comes from index.html; load it here if it is missing
  try {
    if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(l => /editor-inline\.css/.test(l.getAttribute('href') || ''))) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'editor-inline.css'; document.head.appendChild(l);
    }
  } catch {}

  // ------------------------------------------------------------------ text helpers
  const offsetOfLine = (t, n) => { if (n <= 0) return 0; let i = -1; for (let k = 0; k < n; k++) { i = t.indexOf('\n', i + 1); if (i < 0) return t.length; } return i + 1; };
  const lineOfOffset = (t, off) => { let n = 0, i = -1; while ((i = t.indexOf('\n', i + 1)) >= 0 && i < off) n++; return n; };
  const lineEndOffset = (t, n) => { const s = offsetOfLine(t, n); const e = t.indexOf('\n', s); return e < 0 ? t.length : e; };
  const lineStartOf = (v, i) => v.lastIndexOf('\n', i - 1) + 1;
  const lineEndOf = (v, i) => { const n = v.indexOf('\n', i); return n < 0 ? v.length : n; };
  const LIST_RE = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(\[[ xX]\]\s+)?/;

  // =================================================================== app.typing
  const T = app.typing = app.typing || {};
  T.options = () => ({ smartQuotes: app.settings.get('smartQuotes', true) !== false, autocorrect: app.settings.get('autocorrect', true) !== false });

  /** Where the caret is in a line of Markdown source: 'text' (prose), or 'code' | 'math' | 'html' | 'url' | 'attr' (leave alone).
   *  `state` is the highlighter state at the start of the line ('n' normal; fences, math blocks, comments, front matter otherwise). */
  T.mdContext = (lineBefore, state) => {
    if (state && state !== 'n') return 'code';
    const s = String(lineBefore || '');
    if (/^\s*(```|~~~)/.test(s)) return 'code';
    if (/^ {4,}\S/.test(s) && !LIST_RE.test(s)) return 'code';
    if (((s.match(/`+/g) || []).length) % 2 === 1) return 'code';
    const noEsc = s.replace(/\\\$/g, '').replace(/`[^`]*`/g, '');
    if (((noEsc.match(/\$/g) || []).length) % 2 === 1) return 'math';
    if (noEsc.lastIndexOf('\\(') > noEsc.lastIndexOf('\\)')) return 'math';
    const lt = s.lastIndexOf('<'), gt = s.lastIndexOf('>');
    if (lt > gt && /^<[A-Za-z/!]/.test(s.slice(lt, lt + 2))) return 'html';
    if (/\]\([^)\s]*(\s+"[^"]*)?$/.test(s) || /\]\([^)]*$/.test(s)) return 'url';
    if (/\{[#.:][^}]*$/.test(s)) return 'attr';
    if (/^\s*\[[^\]]+\]:\s*\S*$/.test(s)) return 'url'; // link reference definition
    return 'text';
  };

  /** AutoCorrect / smart quotes for the character just typed (the last char of `before`).
   *  Returns {remove, insert}: replace the last `remove` characters of `before` with `insert`; or null. */
  T.correct = (before, opts = {}) => {
    before = String(before || '');
    if (!before) return null;
    const o = { ...T.options(), ...opts };
    const ctx = opts.context || 'text';
    if (ctx !== 'text') return null;
    const ch = before.slice(-1), pre = before.slice(0, -1), p = pre.slice(-1);
    if (o.smartQuotes && (ch === '"' || ch === "'")) {
      if (p === '\\') return null;
      const opening = !p || /[\s([{<—–\-/“‘]/.test(p);
      const q = ch === '"' ? (opening ? '“' : '”') : (opening ? '‘' : '’');
      return { remove: 1, insert: q };
    }
    if (!o.autocorrect) return null;
    let m;
    if (ch === ')' && (m = /(^|[^\]])\((c|r|tm)\)$/i.exec(before))) {
      const sym = { c: '©', r: '®', tm: '™' }[m[2].toLowerCase()];
      return { remove: m[2].length + 2, insert: sym };
    }
    if (ch === '.' && /(^|[^.])\.\.\.$/.test(before) && !/\]\([^)]*$/.test(before)) return { remove: 3, insert: '…' };
    if (ch !== '-' && ch !== '>' && (m = /(-{2,3})$/.exec(pre))) {
      const run = m[1], at = pre.length - run.length;
      const prev = pre[at - 1] || '';
      if (prev === '-' || prev === '!' || prev === '<' || prev === '|' || prev === ':') return null;
      const lineStart = pre.lastIndexOf('\n') + 1;
      const head = pre.slice(lineStart, at);
      if (!head.trim() && !opts.midLine) return null;            // "---" on its own line is a rule / front matter
      if (/^\s*\|/.test(pre.slice(lineStart))) return null;       // table separator rows
      return { remove: run.length + 1, insert: (run.length === 2 ? '–' : '—') + ch };
    }
    return null;
  };

  /** Smallest change between two strings: {at, del, ins}. */
  T.diff = (a, b) => {
    let p = 0; const max = Math.min(a.length, b.length);
    while (p < max && a.charCodeAt(p) === b.charCodeAt(p)) p++;
    let s = 0; while (s < a.length - p && s < b.length - p && a.charCodeAt(a.length - 1 - s) === b.charCodeAt(b.length - 1 - s)) s++;
    return { at: p, del: a.slice(p, a.length - s), ins: b.slice(p, b.length - s) };
  };
  /** Where `off` (an offset in `a`) lands after `a` became `b`. */
  T.mapOffset = (a, b, off) => {
    if (a === b) return off;
    const d = T.diff(a, b);
    if (off <= d.at) return off;
    if (off >= d.at + d.del.length) return off + d.ins.length - d.del.length;
    return d.at + d.ins.length;
  };
  /** Undo history that stores small diffs (one entry per keystroke), not whole copies of the document. */
  T.createHistory = ({ limit = 2000 } = {}) => {
    let undo = [], redo = [];
    return {
      record(before, after, selBefore, selAfter) {
        if (before === after) return false;
        undo.push({ ...T.diff(before, after), selBefore: selBefore || null, selAfter: selAfter || null });
        if (undo.length > limit) undo.shift();
        redo = []; return true;
      },
      undo(current) {
        const x = undo.pop(); if (!x) return null;
        if (current.slice(x.at, x.at + x.ins.length) !== x.ins) { undo = []; redo = []; return null; }
        redo.push(x);
        return { text: current.slice(0, x.at) + x.del + current.slice(x.at + x.ins.length), sel: x.selBefore || { start: x.at + x.del.length, end: x.at + x.del.length } };
      },
      redo(current) {
        const x = redo.pop(); if (!x) return null;
        if (current.slice(x.at, x.at + x.del.length) !== x.del) { redo = []; return null; }
        undo.push(x);
        return { text: current.slice(0, x.at) + x.ins + current.slice(x.at + x.del.length), sel: x.selAfter || { start: x.at + x.ins.length, end: x.at + x.ins.length } };
      },
      canUndo: () => undo.length > 0, canRedo: () => redo.length > 0,
      clear() { undo = []; redo = []; },
      get size() { return undo.length; },
    };
  };

  // ---- Word mode: AutoCorrect + per-keystroke undo on the rendered page (no edits to editor-word.js needed)
  const CE_SKIP = '.mk-math,code,pre,kbd,.mk-cite,.mk-comment,.mk-xref,.mk-front,[contenteditable="false"]';
  const CE_BLOCK = 'p,li,h1,h2,h3,h4,h5,h6,td,th,dt,dd,blockquote,figcaption,div';
  /** Apply AutoCorrect at the caret of a contenteditable element. Returns the correction or null. */
  T.correctContentEditable = (root, { beforeChange } = {}) => {
    const s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return null;
    const n = s.anchorNode, off = s.anchorOffset;
    if (!n || n.nodeType !== 3 || !root.contains(n) || n.parentElement.closest(CE_SKIP)) return null;
    const blk = n.parentElement.closest(CE_BLOCK);
    let before = n.data.slice(0, off);
    if (blk && root.contains(blk)) { try { const r = document.createRange(); r.setStart(blk, 0); r.setEnd(n, off); before = r.toString(); } catch {} }
    const c = T.correct(before, { context: 'text', midLine: !!blk && before.length > n.data.slice(0, off).length });
    if (!c || c.remove > off) return null;
    beforeChange?.();
    n.data = n.data.slice(0, off - c.remove) + c.insert + n.data.slice(off);
    const r = document.createRange(); r.setStart(n, off - c.remove + c.insert.length); r.collapse(true);
    s.removeAllRanges(); s.addRange(r);
    return c;
  };
  T.attachWordPage = (page, adapter) => {
    if (!page || page.__mkTyping) return false;
    page.__mkTyping = true;
    let composing = false, timer = 0;
    const ad = () => adapter || (app.editors.get('word')?.page === page ? app.editors.get('word') : null);
    const commit = () => { try { ad()?._commit?.(); } catch (e) { console.warn(e); } };
    page.addEventListener('compositionstart', () => { composing = true; });
    page.addEventListener('compositionend', () => { composing = false; });
    page.addEventListener('input', e => {
      if (composing || e.isComposing) return;
      if (e.inputType === 'insertText' && e.data && e.data.length === 1) {
        // the typed character is one undo step, the correction another (Ctrl+Z brings the typed text back, like Word)
        T.correctContentEditable(page, { beforeChange: commit });
      }
      if (app.settings.get('undoPerKeystroke', true) !== false) { clearTimeout(timer); timer = setTimeout(commit, 0); }
    });
    return true;
  };
  // ---- typing hooks for every editor (Word, Inline, Simple). Used by add-ons and the Writing Assistant (autocomplete).
  //   app.typing.onKey(fn(event, ctx) → true when handled)   runs before the editor's own keys; returning true
  //                                                         stops the editor (preventDefault + stopPropagation done here).
  //   app.typing.onInput(fn(ctx))                           runs after text input was applied.
  //   ctx = {mode: 'word'|'inline'|'simple', adapter, element (the editable element: page, block editor, table cell or textarea),
  //          inTable, inputType?, data?}
  // Both return an "off" function.
  const keyHooks = [], inputHooks = [];
  const addHook = (list, fn) => { if (typeof fn !== 'function') return () => {}; list.push(fn); return () => { const i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); }; };
  T.onKey = fn => addHook(keyHooks, fn);
  T.onInput = fn => addHook(inputHooks, fn);
  T.runKey = (e, ctx = {}) => {
    for (const fn of keyHooks.slice()) {
      try { if (fn(e, ctx) === true) { e.preventDefault(); e.stopPropagation(); return true; } } catch (err) { console.warn('typing hook', err); }
    }
    return false;
  };
  T.runInput = (ctx = {}) => { for (const fn of inputHooks.slice()) { try { fn(ctx); } catch (err) { console.warn('typing hook', err); } } };
  T.wireWord = () => {
    if (T.wordWired) return;
    T.wordWired = true;
    app.events.on('word:rendered', ({ page } = {}) => { const w = app.editors.get('word'); if (page && w && w.page === page) T.attachWordPage(page, w); });
    const w = app.editors.get('word'); if (w?.page) T.attachWordPage(w.page, w);
  };
  T.wireWord();

  // =================================================================== app.notes: hidden notes %%…%%
  const NOTE_SKIP = 'code,pre,kbd,script,style,textarea,svg,.mk-math,.katex,.mk-cite,.mk-note,.mk-il-edit,.mk-front';
  const NOTE_BLOCK = 'p,li,h1,h2,h3,h4,h5,h6,td,th,dt,dd,figcaption,blockquote,section,article,div';
  function markNoteEdge(span, first) {
    const w = document.createTreeWalker(span, NodeFilter.SHOW_TEXT); const list = []; let t;
    while ((t = w.nextNode())) if (!t.parentElement.closest('.mk-note-mark')) list.push(t);
    const node = first ? list[0] : list[list.length - 1]; if (!node) return;
    let mark;
    if (first && node.data.startsWith('%%')) { node.splitText(2); mark = node; }
    else if (!first && node.data.endsWith('%%')) mark = node.splitText(node.data.length - 2);
    if (!mark) return;
    const m = document.createElement('span'); m.className = 'mk-note-mark'; m.setAttribute('contenteditable', 'false'); m.setAttribute('aria-hidden', 'true');
    mark.replaceWith(m); m.appendChild(mark);
  }
  function wrapNoteRange(range, first, last) {
    const span = document.createElement('span'); span.className = 'mk-note'; span.title = app.t('Hidden note: shows while you edit, never in Read mode, print or export');
    span.appendChild(range.extractContents()); range.insertNode(span);
    if (first) markNoteEdge(span, true);
    if (last) markNoteEdge(span, false);
    return span;
  }
  /** Wrap %%hidden notes%% in rendered HTML. The %% marks stay in the DOM (hidden), so Word mode writes them back. */
  function wrapNotes(root) {
    if (!root || !root.querySelectorAll || !(root.textContent || '').includes('%%')) return 0;
    const delims = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && n.parentElement.closest(NOTE_SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let t;
    while ((t = w.nextNode())) {
      let i = t.data.indexOf('%%');
      while (i >= 0) { delims.push({ node: t, off: i, cont: t.parentElement.closest(NOTE_BLOCK) || root }); i = t.data.indexOf('%%', i + 2); }
    }
    if (delims.length < 2) return 0;
    const pairs = [], leftovers = []; let open = null;
    for (const d of delims) {
      if (open && open.cont === d.cont) { pairs.push([open, d]); open = null; continue; }
      if (open) leftovers.push(open);
      open = d;
    }
    if (open) leftovers.push(open);
    // notes across paragraphs: an unmatched %% in one paragraph and the next unmatched one in a later sibling paragraph
    const blockPairs = [];
    for (let i = 0; i + 1 < leftovers.length; i++) {
      const a = leftovers[i], b = leftovers[i + 1];
      if (a.cont !== b.cont && a.cont.parentNode && a.cont.parentNode === b.cont.parentNode && (a.cont.compareDocumentPosition(b.cont) & Node.DOCUMENT_POSITION_FOLLOWING)) { blockPairs.push([a, b]); i++; }
    }
    let count = 0;
    // right to left, so earlier offsets stay valid
    const all = [...pairs.map(p => ({ p, block: false })), ...blockPairs.map(p => ({ p, block: true }))]
      .sort((x, y) => (x.p[0].node === y.p[0].node ? y.p[0].off - x.p[0].off : (x.p[0].node.compareDocumentPosition(y.p[0].node) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1)));
    for (const { p: [a, b], block } of all) {
      try {
        if (!block) {
          const r = document.createRange(); r.setStart(a.node, a.off); r.setEnd(b.node, b.off + 2);
          wrapNoteRange(r, true, true); count++; continue;
        }
        const r2 = document.createRange(); r2.setStart(b.cont, 0); r2.setEnd(b.node, b.off + 2); wrapNoteRange(r2, false, true);
        for (let n = a.cont.nextSibling; n && n !== b.cont; n = n.nextSibling) if (n.nodeType === 1) n.classList.add('mk-note', 'mk-note-block');
        const r1 = document.createRange(); r1.setStart(a.node, a.off); r1.setEnd(a.cont, a.cont.childNodes.length); wrapNoteRange(r1, true, false);
        count++;
      } catch (e) { console.warn('hidden note', e); }
    }
    return count;
  }
  /** Markdown without %%hidden notes%% (and, with {comments:true}, without <!-- comment: … -->). Code is left alone. */
  function stripNotes(text, { comments = false } = {}) {
    const lines = String(text ?? '').split('\n');
    const out = []; let chunk = [], fence = null;
    const flush = () => {
      if (!chunk.length) return;
      const keep = [];
      let t = chunk.join('\n').replace(/(`+)[\s\S]*?\1/g, m => { keep.push(m); return '\u0000' + (keep.length - 1) + '\u0000'; });
      t = t.replace(/%%[\s\S]*?%%/g, '');
      if (comments) t = t.replace(/<!--\s*comment:[\s\S]*?-->/gi, '');
      t = t.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[+i]);
      out.push(...t.split('\n')); chunk = [];
    };
    for (const l of lines) {
      const f = /^\s*(`{3,}|~{3,})/.exec(l);
      if (fence) { out.push(l); if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null; continue; }
      if (f) { flush(); fence = f[1]; out.push(l); continue; }
      chunk.push(l);
    }
    flush();
    return out.join('\n').replace(/\n{3,}/g, '\n\n');
  }
  app.notes = {
    wrap: wrapNotes,
    strip: stripNotes,
    has: text => /%%[\s\S]*?%%/.test(String(text ?? '').replace(/(`+)[\s\S]*?\1/g, '')),
  };
  app.hooks.postRender((el) => { wrapNotes(el); });

  // =================================================================== Markdown text operations (pure: v, s, e → {v, s, e} or null)
  const Ops = {
    R(v, s, e, text, ns, ne) { const a = ns ?? s + text.length; return { v: v.slice(0, s) + text + v.slice(e), s: a, e: ne ?? a }; },
    selLines(v, s, e) { if (e > s && v[e - 1] === '\n') e--; const a = lineStartOf(v, s), b = lineEndOf(v, e); return { a, b, text: v.slice(a, b) }; },
    wrap(v, s, e, b, a = b) {
      if (s === e) {
        if (v.slice(s - b.length, s) === b && v.slice(s, s + a.length) === a) return Ops.R(v, s - b.length, s + a.length, '', s - b.length);
        const L = v.slice(0, s).match(/[\p{L}\p{N}_'’-]+$/u), Rr = v.slice(s).match(/^[\p{L}\p{N}_'’-]+/u);
        if (L || Rr) { s -= L ? L[0].length : 0; e += Rr ? Rr[0].length : 0; }
        else return Ops.R(v, s, s, b + a, s + b.length);
      }
      const sel = v.slice(s, e);
      const single = b.length === 1 && '*_~^='.includes(b);
      const before = v.slice(Math.max(0, s - b.length), s), after = v.slice(e, e + a.length);
      const doubled = single && v[s - 2] === b && v[e + 1] === a && v[s - 3] !== b;
      if (before === b && after === a && !doubled) return Ops.R(v, s - b.length, e + a.length, sel, s - b.length, e - b.length);
      if (sel.startsWith(b) && sel.endsWith(a) && sel.length >= b.length + a.length && !(single && sel.startsWith(b + b) && !sel.startsWith(b + b + b))) {
        const inner = sel.slice(b.length, sel.length - a.length); return Ops.R(v, s, e, inner, s, s + inner.length);
      }
      return Ops.R(v, s, e, b + sel + a, s + b.length, e + b.length);
    },
    mapLines(v, s, e, fn) {
      const { a, b, text } = Ops.selLines(v, s, e);
      const ls = text.split('\n'); const out = fn(ls).join('\n');
      if (out === text) return null;
      const nv = v.slice(0, a) + out + v.slice(b);
      if (s === e) { const p = clamp(s + (ls.length === 1 ? out.length - text.length : 0), a, a + out.length); return { v: nv, s: p, e: p }; }
      return { v: nv, s: a, e: a + out.length };
    },
    heading(v, s, e, n) { return Ops.mapLines(v, s, e, ls => ls.map(l => { const body = l.replace(/^#{1,6}\s+/, ''); return n ? '#'.repeat(n) + ' ' + body : body; })); },
    para(v, s, e) { return Ops.mapLines(v, s, e, ls => ls.map(l => l.replace(/^#{1,6}\s+/, '').replace(/^(\s*)>\s?/, '$1'))); },
    list(v, s, e, kind) {
      return Ops.mapLines(v, s, e, ls => {
        const nonEmpty = ls.filter(l => l.trim());
        const is = l => { const m = LIST_RE.exec(l); if (!m) return false; if (kind === 'task') return !!m[4]; if (kind === 'ol') return /\d/.test(m[2]) && !m[4]; return !/\d/.test(m[2]) && !m[4]; };
        if (nonEmpty.length && nonEmpty.every(is)) return ls.map(l => l.replace(LIST_RE, (m0, ind) => ind));
        let n = 1;
        return ls.map(l => { if (!l.trim()) return l; const ind = /^\s*/.exec(l)[0]; const body = l.replace(LIST_RE, (m0, i2) => i2).slice(ind.length).replace(/^#{1,6}\s+/, ''); return ind + (kind === 'ol' ? (n++) + '. ' : kind === 'task' ? '- [ ] ' : '- ') + body; });
      });
    },
    quote(v, s, e) { return Ops.mapLines(v, s, e, ls => { const all = ls.filter(l => l.trim()).every(l => /^\s*>/.test(l)); return ls.map(l => (all ? l.replace(/^(\s*)>\s?/, '$1') : '> ' + l)); }); },
    codeBlock(v, s, e) {
      const { a, b, text } = Ops.selLines(v, s, e);
      const m = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(text);
      if (m) return Ops.R(v, a, b, m[1], a, a + m[1].length);
      return Ops.R(v, a, b, '```\n' + text + '\n```', a + 4, a + 4 + text.length);
    },
    align(v, s, e, al) {
      const open = /<div align="(left|center|right|justify)">\s*\n/g; let m, enc = null;
      while ((m = open.exec(v)) && m.index <= s) { const close = v.indexOf('</div>', m.index); if (close >= s || close < 0) enc = { a: m.index, inner: m.index + m[0].length, close }; }
      if (enc && enc.close >= 0) {
        const inner = v.slice(enc.inner, enc.close).replace(/^\n+|\n+$/g, ''); const end = enc.close + 6;
        if (al === 'left') return Ops.R(v, enc.a, end, inner, enc.a);
        const out = `<div align="${al}">\n\n${inner}\n\n</div>`; return Ops.R(v, enc.a, end, out, enc.a + out.indexOf(inner) + (s - enc.inner));
      }
      if (al === 'left') return null;
      let a = lineStartOf(v, s), b = lineEndOf(v, e);
      while (a > 0) { const pa = lineStartOf(v, a - 1); if (!v.slice(pa, a - 1).trim()) break; a = pa; }
      while (b < v.length) { const nb = lineEndOf(v, b + 1); if (!v.slice(b + 1, nb).trim()) break; b = nb; }
      const t = v.slice(a, b); const out = `<div align="${al}">\n\n${t}\n\n</div>`;
      return Ops.R(v, a, b, out, a + out.indexOf(t) + (s - a));
    },
    clear(v, s, e) {
      if (s === e) return null;
      const t = v.slice(s, e).replace(/\*\*|__|~~|==|<\/?(u|mark|sub|sup|span|font)[^>]*>/g, '').replace(/(^|[^\w*])[*_]([^*_]+)[*_]/g, '$1$2').replace(/`([^`]*)`/g, '$1');
      return t === v.slice(s, e) ? null : Ops.R(v, s, e, t, s, s + t.length);
    },
    indent(v, s, e) {
      const { a, b, text } = Ops.selLines(v, s, e);
      if (!text.includes('\n') && !LIST_RE.test(text) && s === e) return Ops.R(v, s, s, '  ', s + 2);
      const out = text.split('\n').map(l => (l.trim() ? '  ' + l : l)).join('\n');
      const n = text.split('\n').filter(l => l.trim()).length;
      return Ops.R(v, a, b, out, s + 2, e + 2 * n);
    },
    outdent(v, s, e) {
      const { a, b, text } = Ops.selLines(v, s, e);
      let first = 0, total = 0;
      const out = text.split('\n').map((l, i) => { const ind = /^\s*/.exec(l)[0]; const cut = Math.min(ind.length, ind.startsWith('\t') ? 1 : 2); if (i === 0) first = cut; total += cut; return l.slice(cut); }).join('\n');
      if (out === text) return null;
      return Ops.R(v, a, b, out, Math.max(a, s - first), Math.max(a, e - total));
    },
    states(v, s, e) {
      const ls = lineStartOf(v, s), line = v.slice(ls, lineEndOf(v, s));
      const around = (b, a = b) => { const L = v.slice(ls, s), R = v.slice(e, lineEndOf(v, e)); const i = L.lastIndexOf(b), j = R.indexOf(a); return i >= 0 && j >= 0 && !L.slice(i + b.length).includes(a); };
      const lm = LIST_RE.exec(line), hm = /^(#{1,6})\s/.exec(line);
      let align = 'left'; const before = v.slice(0, s); const mm = [...before.matchAll(/<div align="(\w+)">/g)].pop(); if (mm && !before.slice(mm.index).includes('</div>')) align = mm[1];
      const pre = v.slice(ls, s);
      return {
        bold: around('**'), italic: (/(^|[^*])\*[^*\s]/.test(pre.replace(/\*\*/g, '')) && around('*') && !(/\*\*$/.test(pre) && !/\*\*\*$/.test(pre))) || around('_'),
        underline: around('<u>', '</u>'), strike: around('~~'), highlight: around('=='), code: (pre.split('`').length - 1) % 2 === 1,
        sub: false, sup: false, heading: hm ? hm[1].length : 0, quote: /^\s*>/.test(line),
        list: lm ? (lm[4] ? 'task' : /\d/.test(lm[2]) ? 'ol' : 'ul') : null, align, table: /^\s*\|/.test(line), codeBlock: false,
      };
    },
  };
  E.inlineOps = Ops;

  // =================================================================== the Inline editor
  const SPECIAL = n => n.nodeType === 1 && (n.classList.contains('mk-front') || n.classList.contains('mk-bibliography') || (n.tagName === 'SECTION' && n.classList.contains('footnotes')) || (n.tagName === 'HR' && n.classList.contains('footnotes-sep')));
  const OPENER = /^\s{0,3}(:::|<[A-Za-z!])/;
  function kindOf(n) {
    if (!n || n.nodeType !== 1) return 'other';
    if (n.classList.contains('mk-front')) return 'front';
    const t = n.tagName;
    if (t === 'P') return 'p';
    if (/^H[1-6]$/.test(t)) return 'h';
    if (t === 'UL' || t === 'OL') return 'list';
    if (t === 'BLOCKQUOTE') return 'quote';
    if (t === 'TABLE') return 'table';
    if (t === 'PRE') return 'code';
    if (n.classList.contains('mk-math-block')) return 'math';
    return 'other';
  }
  // what a rendered element stands for in the source (for mapping a click to a source position)
  function atomText(el) {
    if (el.matches('.mk-math')) return el.getAttribute('data-tex') || '';
    if (el.matches('.mk-cite')) return el.getAttribute('data-raw') || '';
    if (el.matches('sup.footnote-ref')) return '[^' + (el.getAttribute('data-label') || '') + ']';
    if (el.matches('.mk-xref')) return el.getAttribute('data-ref') || '';
    if (el.matches('img')) return el.getAttribute('alt') || '';
    if (el.matches('.mk-note-mark')) return '%%';
    if (el.matches('.mk-comment, input, .mk-ui, [data-mk-ui], .katex-mathml, svg, button')) return '';
    return null;
  }
  function textOf(node) {
    let s = '';
    (function walk(n) {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) s += c.data;
        else if (c.nodeType === 1) { const a = atomText(c); if (a != null) s += a; else { if (/^(P|LI|TR|H[1-6]|DIV|BLOCKQUOTE|PRE)$/.test(c.tagName) && s && !/\s$/.test(s)) s += '\n'; walk(c); } }
      }
    })(node);
    return s;
  }
  // characters of the source the reader never sees (link targets, tags, attributes) cannot match a click
  function hiddenMask(src) {
    const mask = new Uint8Array(src.length);
    const hide = (re, from = 0) => { for (const m of src.matchAll(re)) for (let i = m.index + from; i < m.index + m[0].length; i++) mask[i] = 1; };
    hide(/\]\((?:[^()\s]|\([^)]*\))*(?:\s+"[^"]*")?\)/g, 1);
    hide(/<!--[\s\S]*?-->/g); hide(/<\/?[A-Za-z][^>\n]*>/g); hide(/\{[#.:][^}\n]*\}/g);
    return mask;
  }
  function alignOffset(src, prefix) {
    const mask = hiddenMask(src); const ws = c => /\s/.test(c);
    let i = 0;
    for (let j = 0; j < prefix.length; j++) {
      const c = prefix[j];
      if (ws(c)) { let k = i; while (k < src.length && k - i < 6 && /[*_~=`\]>)#|^$]/.test(src[k])) k++; if (k < src.length && ws(src[k])) i = k + 1; continue; }
      let k = i; const lim = Math.min(src.length, i + 600);
      while (k < lim && (mask[k] || src[k] !== c)) k++;
      if (k < lim) i = k + 1;
    }
    // step over closing markers right after the match only when the prefix ended inside a word
    return i;
  }

  function createInlineEditor() {
    let host = null, root = null, sheet = null, page = null, doc = null, mounted = false, offs = [];
    let segs = [], lastRendered = null, renderSeq = 0, fmLines = 0;
    let open = null;           // the block being edited: { seg, el, start, len, base, text, sel, states, virtual }
    let lastSel = null;        // caret in document offsets (kept when no block is open)
    let kbd = -1;              // block marked for the keyboard while nothing is open
    let lastText = '';
    let selBefore = null, composing = false, painter = null, chain = Promise.resolve(), busy = 0;
    let cell = null;           // the table cell being edited: { seg, line, row, col, td, saved, text }
    let ctxTd = null;          // the cell right-clicked last (tables in quotes and lists)
    const hist = T.createHistory();
    const queue = fn => { busy++; const p = chain.then(() => (mounted ? fn() : null)).catch(e => console.error('inline', e && e.stack || e)).finally(() => { busy--; }); chain = p; return p; };

    // ---------- DOM ----------
    function build() {
      root = document.createElement('div'); root.className = 'mk-inline'; root.tabIndex = -1;
      sheet = document.createElement('div'); sheet.className = 'mk-sheet';
      page = document.createElement('article'); page.className = 'mk-page mk-il-page';
      page.setAttribute('data-mk-surface', 'inline'); page.setAttribute('aria-label', app.t('Document. Click a paragraph to edit it.'));
      sheet.appendChild(page); root.appendChild(sheet);
      page.addEventListener('click', onPageClick);
      page.addEventListener('contextmenu', onPageContext);
      root.addEventListener('keydown', onRootKey);
      // a click on the gray canvas beside the page finishes the paragraph being edited
      root.addEventListener('mousedown', e => { if ((e.target === root || e.target === sheet) && open) { e.preventDefault(); queue(() => closeBlock()).then(() => root?.focus({ preventScroll: true })); } });
      const onSel = () => onSelectionChange(); document.addEventListener('selectionchange', onSel); offs.push(() => document.removeEventListener('selectionchange', onSel));
      const onResize = () => applyLayout(); addEventListener('resize', onResize); offs.push(() => removeEventListener('resize', onResize));
    }
    function scroller() { let n = host; while (n && n !== document.body) { const s = getComputedStyle(n); if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight) return n; n = n.parentElement; } return host || document.scrollingElement; }
    function applyLayout() {
      if (!page) return;
      try { app.layout?.apply?.(page, doc); } catch (e) { console.warn(e); }
      if (sheet) sheet.style.zoom = (app.zoom || 100) / 100;
      const ps = app.layout?.pageSize?.(doc); page.style.minHeight = (ps?.h || 1123) + 'px';
    }

    // ---------- rendering ----------
    function anchorSnapshot() {
      const sc = scroller(); if (!sc || !page) return null;
      const top = sc.getBoundingClientRect().top;
      for (const s of segs) {
        const el = s.els.find(n => n.nodeType === 1 && n.isConnected); if (!el) continue;
        const r = el.getBoundingClientRect(); if (r.bottom > top + 1) return { line: s.start, dy: r.top - top, sc };
      }
      return null;
    }
    function anchorRestore(a) {
      if (!a) return;
      const s = segForLine(a.line); const el = s && s.els.find(n => n.nodeType === 1 && n.isConnected); if (!el) return;
      const top = a.sc.getBoundingClientRect().top; a.sc.scrollTop += (el.getBoundingClientRect().top - top) - a.dy;
    }
    async function renderDoc() {
      if (!doc || !page) return;
      const seq = ++renderSeq; const text = doc.text || '';
      let r;
      try { r = await app.render(text, { doc }); } catch (e) { console.error(e); r = { html: '<p>' + esc(text) + '</p>' }; }
      if (seq !== renderSeq || !mounted) return;
      const anchor = lastRendered != null ? anchorSnapshot() : null;
      page.innerHTML = r.html;
      E.fixImages?.(page, doc);
      page.querySelectorAll('input[type=checkbox]').forEach(i => { i.removeAttribute('disabled'); if (i.checked) i.setAttribute('checked', ''); });
      lastRendered = text; lastText = text;
      buildSegments(text);
      try { await app.decorate(page, doc); } catch (e) { console.error(e); }
      if (seq !== renderSeq || !mounted) return;
      applyLayout();
      anchorRestore(anchor);
      markKbd();
      app.events.emit('inline:rendered', { doc, page });
    }
    function frontMatterRaw(text) {
      try { if (app.mk?.frontMatter?.parse) return app.mk.frontMatter.parse(text).raw || ''; } catch {}
      return E.splitFrontMatter ? E.splitFrontMatter(text).raw : '';
    }
    function lineOfNode(n, lines, curStart) {
      const own = n.nodeType === 1 && n.getAttribute('data-line');
      if (own != null && own !== false && own !== '') return +own + fmLines;
      if (n.nodeType !== 1) return null;
      let min = Infinity; n.querySelectorAll('[data-line]').forEach(x => { const v = +x.getAttribute('data-line'); if (v < min) min = v; });
      if (!Number.isFinite(min)) return null;
      let st = min + fmLines;
      for (let k = st - 1; k > curStart; k--) { const l = lines[k] ?? ''; if (!l.trim()) continue; if (OPENER.test(l)) { st = k; continue; } break; }
      return st;
    }
    function buildSegments(text) {
      segs = [];
      const lines = text.split('\n');
      const raw = frontMatterRaw(text); fmLines = (raw.match(/\n/g) || []).length;
      if (raw && !raw.endsWith('\n')) fmLines++;
      const front = page.querySelector(':scope > .mk-front');
      if (raw) segs.push({ kind: 'front', start: 0, els: front ? [front] : [] });
      let cur = null;
      const tops = [...page.childNodes].filter(n => n.nodeType === 1 || n.nodeType === 8 || (n.nodeType === 3 && n.data.trim()));
      for (const n of tops) {
        if (SPECIAL(n)) continue;
        const ln = lineOfNode(n, lines, cur ? cur.start : fmLines - 1);
        if (ln != null && (!cur || ln > cur.start)) { cur = { kind: kindOf(n), start: ln, els: [n] }; segs.push(cur); }
        else if (cur) cur.els.push(n);
        else { cur = { kind: kindOf(n), start: fmLines, els: [n] }; segs.push(cur); }
      }
      segs.sort((a, b) => a.start - b.start);
      segs.forEach((s, i) => {
        s.index = i; s.end = i + 1 < segs.length ? segs[i + 1].start : lines.length;
        let a = s.start, b = s.end; while (a < b && !(lines[a] || '').trim()) a++; while (b > a && !(lines[b - 1] || '').trim()) b--;
        s.cStart = a; s.cEnd = b;
        s.els.forEach(n => { n.__mkSeg = s; });
      });
    }
    function segForLine(line) { let best = null; for (const s of segs) { if (s.start <= line) best = s; else break; } return best || segs[0] || null; }
    function segRange(text, s) { const st = offsetOfLine(text, s.cStart); const en = s.cEnd > s.cStart ? lineEndOffset(text, s.cEnd - 1) : st; return { st, en }; }
    function topOf(n) { while (n && n.parentNode !== page) n = n.parentNode; return n; }
    function segOfNode(n) { const t = topOf(n); return t && t.__mkSeg && segs.includes(t.__mkSeg) ? t.__mkSeg : null; }

    // the direction a line of text is drawn in: its first strong letter, else the element's own direction
    function textDir(text, el) {
      const d = app.lang?.firstStrongDir?.(text);
      if (d) return d;
      try { return el ? getComputedStyle(el).direction : 'ltr'; } catch { return 'ltr'; }
    }
    // ---------- the block editor ----------
    function makeEditor() {
      const el = document.createElement('div'); el.className = 'mk-il-edit';
      try { el.contentEditable = 'plaintext-only'; } catch {}
      if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
      el.spellcheck = app.settings.get('spellcheck', true) !== false;
      el.setAttribute('role', 'textbox'); el.setAttribute('aria-multiline', 'true');
      el.setAttribute('aria-label', app.t('Markdown of this paragraph. Press Esc to finish.'));
      el.addEventListener('keydown', onEdKey);
      el.addEventListener('beforeinput', onBeforeInput);
      el.addEventListener('input', onInput);
      el.addEventListener('compositionstart', () => { composing = true; });
      el.addEventListener('compositionend', () => { composing = false; syncFromDom(null); });
      el.addEventListener('paste', onPaste);
      el.addEventListener('drop', onDrop);
      el.addEventListener('dragover', e => { e.preventDefault(); });
      el.addEventListener('dblclick', onEdDblClick);
      el.addEventListener('mouseup', () => { if (painter) setTimeout(applyPainter, 0); });
      el.addEventListener('focus', () => { try { CSS.highlights?.delete('mk-il-sel'); } catch {} });
      el.addEventListener('blur', paintInactiveSelection);
      return el;
    }
    function lineClass(line, st) {
      let c = 'ln';
      const h = /^(#{1,6})\s/.exec(line);
      if (st === 'fm' || (st === 'n' && open?.seg?.kind === 'front')) c += ' front';
      else if (st !== 'n' || /^\s*(```|~~~)/.test(line)) c += ' code';
      else if (/^\s*(\$\$|\\\[)/.test(line)) c += ' math';
      else if (h) c += ' h' + h[1].length;
      else if (/^\s*\|/.test(line)) c += ' tbl';
      if (!line) c += ' blank';
      return c;
    }
    function hlLine(line, st, idx) {
      if (E.highlightLine) { try { return E.highlightLine(line, st, idx); } catch {} }
      return [esc(line), 'n'];
    }
    function paint(v) {
      const el = open.el; const lines = v.split('\n'); const states = [];
      [...el.childNodes].forEach(c => { if (!(c.nodeType === 1 && c.tagName === 'DIV' && c.classList.contains('ln'))) c.remove(); });
      let st = 'n'; const base = open.seg?.kind === 'front' ? 0 : Math.max(1, open.seg?.cStart || 1);
      for (let i = 0; i < lines.length; i++) {
        states.push(st);
        let [h, nx] = hlLine(lines[i], st, base + i);
        h = h.replace(/%%([^%<]*)%%/g, '<span class="t-note">%%$1%%</span>');
        const cls = lineClass(lines[i], st); st = nx;
        let d = el.children[i];
        if (!d) { d = document.createElement('div'); el.appendChild(d); }
        const html = h || '<br>';
        if (d.__h !== html || d.textContent !== lines[i] || d.querySelector('div')) { d.innerHTML = html; d.__h = html; }
        if (d.className !== cls) d.className = cls;
      }
      while (el.children.length > lines.length) el.lastElementChild.remove();
      open.text = v; open.states = states;
    }
    function readLine(div) {
      let s = '';
      (function w(n) { for (const c of n.childNodes) { if (c.nodeType === 3) s += c.data; else if (c.nodeName === 'DIV') { if (s) s += '\n'; w(c); } else if (c.nodeName !== 'BR') w(c); } })(div);
      return s;
    }
    function readFrom(container) {
      const out = []; let cur = -1;
      for (const c of container.childNodes) {
        if (c.nodeType === 1 && c.tagName === 'DIV') { out.push(readLine(c)); cur = -1; }
        else if (c.nodeType === 1 && c.tagName === 'BR') { if (cur < 0) out.push(''); cur = -1; }
        else { const t = c.nodeType === 3 ? c.data : (c.nodeType === 1 ? readLine(c) : ''); if (cur < 0) { out.push(t); cur = out.length - 1; } else out[cur] += t; }
      }
      return out.join('\n').replace(/​/g, '');
    }
    const readEd = () => readFrom(open.el);
    function domOffset(node, offset) {
      const el = open.el;
      if (node === el) { let n = 0; for (let i = 0; i < offset && i < el.childNodes.length; i++) { const c = el.childNodes[i]; n += (c.nodeType === 1 && c.tagName === 'DIV' ? readLine(c).length : (c.textContent || '').length) + 1; } return Math.max(0, Math.min(n, readEd().length)); }
      const r = document.createRange(); r.setStart(el, 0); r.setEnd(node, offset);
      const box = document.createElement('div'); box.appendChild(r.cloneContents());
      return readFrom(box).length;
    }
    function getEdSel() {
      if (!open) return { s: 0, e: 0 };
      const s = getSelection();
      if (s.rangeCount && open.el.contains(s.anchorNode) && open.el.contains(s.focusNode)) {
        const r = s.getRangeAt(0);
        try { const a = domOffset(r.startContainer, r.startOffset), b = domOffset(r.endContainer, r.endOffset); return { s: Math.min(a, b), e: Math.max(a, b) }; } catch {}
      }
      return open.sel || { s: 0, e: 0 };
    }
    function pointAt(off) {
      const el = open.el; let left = off;
      for (const d of el.children) {
        const t = readLine(d);
        if (left <= t.length) {
          const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT); let n, last = null;
          while ((n = w.nextNode())) { if (left <= n.data.length) return [n, left]; left -= n.data.length; last = n; }
          return last ? [last, last.data.length] : [d, 0];
        }
        left -= t.length + 1;
      }
      const lastD = el.lastElementChild; return lastD ? [lastD, lastD.childNodes.length] : [el, 0];
    }
    function rangeFor(s, e) { const r = document.createRange(); const [a, ao] = pointAt(s); const [b, bo] = pointAt(e); r.setStart(a, ao); r.setEnd(b, bo); return r; }
    function setEdSel(s, e = s, { focus = true } = {}) {
      if (!open) return;
      const len = open.text.length; s = clamp(s, 0, len); e = clamp(e, 0, len);
      open.sel = { s, e };
      lastSel = { start: open.start + s, end: open.start + e };
      if (focus) { open.el.focus({ preventScroll: true }); }
      if (document.activeElement === open.el || focus) { try { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rangeFor(s, e)); } catch {} }
      if (document.activeElement !== open.el) paintInactiveSelection();
    }
    function paintInactiveSelection() {
      if (!open || !window.CSS?.highlights || typeof Highlight === 'undefined') return;
      const { s, e } = open.sel || {}; if (s == null || s === e) { CSS.highlights.delete('mk-il-sel'); return; }
      try { CSS.highlights.set('mk-il-sel', new Highlight(rangeFor(s, e))); } catch {}
    }
    function revealCaret() {
      const s = getSelection(); if (!s.rangeCount || !open) return;
      let rect = s.getRangeAt(0).getBoundingClientRect(); if (!rect.height) rect = open.el.getBoundingClientRect();
      const sc = scroller(); if (!sc) return; const sr = sc.getBoundingClientRect();
      if (rect.top < sr.top + 20) sc.scrollTop -= sr.top + 40 - rect.top;
      else if (rect.bottom > sr.bottom - 20) sc.scrollTop += rect.bottom - sr.bottom + 40;
    }
    const docSel = () => (open ? { start: open.start + (open.sel?.s ?? 0), end: open.start + (open.sel?.e ?? 0) } : lastSel);

    // write the block text into the document (one undo step per call)
    function commitBlock(nv, s, e, { record = true } = {}) {
      const baseText = open.base ?? doc.text;
      const before = doc.text;
      // the block editor works with LF; a CRLF file gets CRLF back, never a mix
      const crlf = /\r\n/.test(baseText), conv = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
      const nvD = conv(nv), sD = conv(nv.slice(0, s)).length, eD = conv(nv.slice(0, e)).length;
      const after = baseText.slice(0, open.start) + nvD + baseText.slice(open.start + open.len);
      open.base = null; open.len = nvD.length; open.sel = { s, e };
      lastSel = { start: open.start + sD, end: open.start + eD };
      if (after !== before) {
        if (record) hist.record(before, after, selBefore || docSel(), { start: open.start + sD, end: open.start + eD });
        lastText = after; doc.setText(after, 'inline');
      }
      selBefore = null;
    }
    function applyBlock(nv, s, e = s) {
      if (!open) return;
      if (selBefore == null) selBefore = docSel();
      paint(nv); setEdSel(s, e, { focus: document.activeElement === open.el || !document.activeElement || document.activeElement === document.body || root.contains(document.activeElement) });
      commitBlock(nv, s, e);
      emitSel(); revealCaret();
    }

    // ---------- open / close ----------
    function detachEls(seg) { const els = seg.els.filter(n => n.parentNode === page); return els; }
    function openSeg(seg, a = 0, b = a, opts = {}) {
      if (!seg || !doc) return;
      if (doc.readOnly) { app.ui.toast?.(app.t('Use Edit as text to make an editable copy. This document is read-only.'), { kind: 'info' }); return; }
      // a table edits cell by cell, like Word (opts.source opens its Markdown instead)
      if (seg.kind === 'table' && !opts.source && app.tables && tryOpenCell(seg, a, b, opts)) return;
      const text = doc.text; const { st, en } = segRange(text, seg);
      const v = text.slice(st, en).replace(/\r\n/g, '\n'); // commitBlock writes CRLF back for CRLF files
      const el = makeEditor();
      const els = detachEls(seg);
      if (els.length) { els[0].before(el); els.forEach(n => n.remove()); }
      else page.appendChild(el);
      open = { seg, el, saved: els, start: st, len: en - st, base: null, text: v, sel: { s: 0, e: 0 }, virtual: false };
      root.classList.add('mk-il-editing'); kbd = seg.index; markKbd();
      paint(v);
      // an Urdu, Arabic or Persian block keeps its script font and line height while it is edited
      try { app.lang?.markScript?.(el, doc); } catch {}
      const A = a === 'end' ? v.length : a === 'start' ? 0 : clamp(a ?? 0, 0, v.length);
      const B = b === 'end' ? v.length : b === 'start' ? 0 : clamp(b ?? A, 0, v.length);
      setEdSel(A, B, { focus: opts.focus !== false });
      if (opts.x != null) placeAtX(opts.x, a === 'end');
      emitSel();
    }
    // An empty paragraph that is not in the document yet (Enter at the end of a block, a click below the text).
    function makeGap(text, afterLine) {
      const lines = text.split('\n');
      const i = afterLine + 1; let j = i; while (j < lines.length && !lines[j].trim()) j++;
      const blanks = j - i, atEnd = j >= lines.length, atStart = afterLine < 0;
      const need = (atStart ? 0 : 1) + 1 + (atEnd ? 0 : 1);
      if (blanks < need) lines.splice(i, 0, ...Array(need - blanks).fill(''));
      for (let k = i; k < i + need; k++) lines[k] = '';
      const line = i + (atStart ? 0 : 1);
      return { text: lines.join('\n'), line };
    }
    function openGap(afterSeg, place = 'after', opts = {}) {
      if (!doc || doc.readOnly) return;
      const text = doc.text;
      const afterLine = afterSeg ? afterSeg.cEnd - 1 : -1;
      const g = makeGap(text, afterLine);
      const el = makeEditor();
      const ref = place === 'before' ? opts.beforeSeg : afterSeg;
      const els = ref ? ref.els.filter(n => n.parentNode === page) : [];
      if (place === 'before' && els.length) els[0].before(el);
      else if (els.length) els[els.length - 1].after(el);
      else if (!afterSeg && segs.length && segs[0].els[0]?.parentNode === page) segs[0].els[0].before(el);
      else { const special = [...page.children].find(n => SPECIAL(n) && !n.classList.contains('mk-front')); if (special) special.before(el); else page.appendChild(el); }
      open = { seg: { kind: 'p', virtual: true, index: afterSeg ? afterSeg.index + 0.5 : -0.5, cStart: g.line, cEnd: g.line + 1, els: [] }, el, saved: [], start: offsetOfLine(g.text, g.line), len: 0, base: g.text, text: '', sel: { s: 0, e: 0 }, virtual: true };
      root.classList.add('mk-il-editing');
      paint('');
      setEdSel(0, 0, { focus: opts.focus !== false });
      revealCaret(); emitSel();
    }
    function openGapAtEnd() { return queue(async () => { await closeBlock(); const last = segs.filter(s => s.kind !== 'front').pop() || segs[segs.length - 1] || null; openGap(last); }); }
    // leave the open block: re-render when the document changed, otherwise put the rendered block back
    async function closeBlock({ render = true, cleanup = true } = {}) {
      if (cell) return closeCell({ render });
      if (!open) return { changed: false };
      const o = open; open = null;
      try { CSS.highlights?.delete('mk-il-sel'); } catch {}
      root?.classList.remove('mk-il-editing');
      if (cleanup && o.base == null && o.text === '' && doc) {
        // an emptied (or new, never typed) paragraph leaves no blank-line litter behind
        const text = doc.text; const lines = text.split('\n'); const ln = lineOfOffset(text, o.start);
        if (lines[ln] === '') {
          lines.splice(ln, 1);
          if (lines[ln] === '' && (ln === 0 || lines[ln - 1] === '')) lines.splice(ln, 1);
          else if (ln > 0 && lines[ln - 1] === '' && ln >= lines.length) lines.splice(ln - 1, 1);
          const nt = lines.join('\n');
          if (nt !== text) { hist.record(text, nt, docSel(), null); lastText = nt; doc.setText(nt, 'inline'); }
        }
      }
      const changed = !!doc && doc.text !== lastRendered;
      if (!changed) { if (o.saved.length) o.el.replaceWith(...o.saved); else o.el.remove(); return { changed: false }; }
      if (!render) { o.el.remove(); return { changed: true }; }
      o.el.remove();
      await renderDoc();
      return { changed: true };
    }
    // open the block that holds a document offset
    function openAtDoc(start, end = start, opts = {}) {
      if (!doc) return; // the editor was unmounted while this was queued
      const text = doc.text; start = clamp(start, 0, text.length); end = clamp(end, start, text.length);
      if (!segs.length) { openGap(null, 'after', opts); return; }
      const line = lineOfOffset(text, start);
      let seg = segForLine(line);
      if (seg.cEnd <= seg.cStart && seg.kind !== 'front') { openGap(seg, 'after', opts); return; }
      const { st, en } = segRange(text, seg);
      openSeg(seg, clamp(start - st, 0, en - st), clamp(end - st, 0, en - st), opts);
    }
    function switchTo(seg, a, b, opts = {}) {
      return queue(async () => {
        if (seg && !segs.includes(seg)) seg = segs.find(s => s.start === seg.start && s.kind === seg.kind) || null; // re-rendered meanwhile
        if (!seg) return;
        const text0 = lastRendered ?? doc.text;
        const { st, en } = segRange(text0, seg); const len = en - st;
        const A = a === 'end' ? len : a === 'start' ? 0 : clamp(a ?? 0, 0, len);
        const B = b == null ? A : b === 'end' ? len : b === 'start' ? 0 : clamp(b, 0, len);
        if (open && !open.virtual && open.seg === seg) { setEdSel(A, B); return; }
        const res = await closeBlock();
        if (!res.changed) { openSeg(seg, A, B, opts); return; }
        openAtDoc(T.mapOffset(text0, doc.text, st + A), T.mapOffset(text0, doc.text, st + B), opts);
      });
    }
    function neighbor(dir) {
      if (!open) return null;
      const idx = open.seg.index;
      if (open.virtual) return dir < 0 ? segs[Math.floor(idx)] || null : segs[Math.ceil(idx)] || null;
      return segs[idx + dir] || null;
    }
    function caretX() { const s = getSelection(); if (!s.rangeCount) return null; const r = s.getRangeAt(0).cloneRange(); r.collapse(true); const rc = r.getClientRects()[0]; return rc ? rc.left : null; }
    function placeAtX(x, last) {
      if (!open || x == null) return;
      const d = last ? open.el.lastElementChild : open.el.firstElementChild; if (!d) return;
      const rr = d.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(d).lineHeight) || 24;
      const y = last ? rr.bottom - lh / 2 : rr.top + lh / 2;
      const pos = document.caretRangeFromPoint?.(x, y);
      if (pos && open.el.contains(pos.startContainer)) { const off = domOffset(pos.startContainer, pos.startOffset); setEdSel(off, off); }
    }
    function go(dir, where, x) {
      const n = neighbor(dir); if (!n) return false;
      switchTo(n, where, where, { x });
      return true;
    }

    // ---------- page clicks ----------
    function caretPoint(x, y) { const r = document.caretRangeFromPoint?.(x, y); return r ? { node: r.startContainer, offset: r.startOffset } : null; }
    function srcOffsetIn(seg, node, offset) {
      const text = lastRendered ?? doc.text; const { st, en } = segRange(text, seg); const src = text.slice(st, en);
      const first = seg.els.find(n => n.parentNode === page); if (!first) return 0;
      let prefix = '';
      try { const r = document.createRange(); r.setStartBefore(first); r.setEnd(node, offset); const box = document.createElement('div'); box.appendChild(r.cloneContents()); prefix = textOf(box); } catch { return 0; }
      return clamp(alignOffset(src, prefix), 0, src.length);
    }
    function mathRange(seg, atom) {
      const text = lastRendered ?? doc.text; const { st, en } = segRange(text, seg); const src = text.slice(st, en);
      const tex = atom.getAttribute('data-tex') || ''; if (!tex) return null;
      const i = src.indexOf(tex); if (i < 0) return null;
      let a = i, b = i + tex.length;
      while (a > 0 && /[$\\(\[]/.test(src[a - 1]) && i - a < 2) a--;
      while (b < src.length && /[$\\)\]]/.test(src[b]) && b - (i + tex.length) < 2) b++;
      return [a, b];
    }
    function onPageClick(e) {
      if (!mounted || !doc) return;
      if (open && open.el.contains(e.target)) return;
      if (cell && cell.td.contains(e.target)) return;
      const t = e.target;
      const a = t.closest('a[href]');
      if (a && (e.ctrlKey || e.metaKey)) { e.preventDefault(); followLink(a.getAttribute('href')); return; }
      if (t.matches('input[type=checkbox]')) { e.preventDefault(); toggleTaskBox(t); return; }
      const fref = t.closest('sup.footnote-ref');
      if (fref && !e.altKey) { e.preventDefault(); const id = fref.querySelector('a')?.getAttribute('href'); if (id) page.querySelector(id.replace(/:/g, '\\:'))?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      if (t.closest('.footnote-backref')) { e.preventDefault(); const id = t.closest('a').getAttribute('href'); page.querySelector(id.replace(/:/g, '\\:'))?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      if ((e.ctrlKey || e.metaKey) && t.closest('.mk-xref')) return; // the cross-reference module jumps there
      if (a) e.preventDefault();
      if (doc.readOnly) return;
      const fn = t.closest('section.footnotes li');
      if (fn) { openFootnoteDef(fn); return; }
      if (t.closest('.mk-bibliography')) { app.ui.toast?.(app.t('To change this list, edit the citations in your text. Markooj builds it from them.')); return; }
      const s = getSelection();
      if (s.rangeCount && !s.isCollapsed && page.contains(s.anchorNode) && String(s).trim()) {
        const r = s.getRangeAt(0); const sa = segOfNode(r.startContainer), sb = segOfNode(r.endContainer);
        if (sa && sa === sb) { switchTo(sa, srcOffsetIn(sa, r.startContainer, r.startOffset), srcOffsetIn(sa, r.endContainer, r.endOffset)); }
        return;
      }
      let seg = segOfNode(t);
      const td = t.closest('td,th');
      if (seg && seg.kind === 'table' && td && page.contains(td) && app.tables) {
        // click into a cell and type, like Word: the caret lands where you clicked, in the cell's Markdown
        let caret = 'end';
        const pos = s.rangeCount && s.isCollapsed && td.contains(s.anchorNode) ? { node: s.anchorNode, offset: s.anchorOffset } : caretPoint(e.clientX, e.clientY);
        if (pos && td.contains(pos.node)) { try { const r = document.createRange(); r.setStart(td, 0); r.setEnd(pos.node, pos.offset); const box = document.createElement('div'); box.appendChild(r.cloneContents()); caret = { prefix: textOf(box) }; } catch {} }
        switchTo(seg, 0, 0, { cell: { row: td.parentElement.rowIndex, col: td.cellIndex, caret } });
        return;
      }
      if (seg) {
        const atom = t.closest('.mk-math');
        if (atom) { const mr = mathRange(seg, atom); if (mr) { switchTo(seg, mr[0], mr[1]); return; } }
        // the click already put a (hidden) caret into the rendered text; fall back to the point under the mouse
        const inSeg = n => !!n && seg.els.some(x => x === n || x.contains?.(n));
        let pos = s.rangeCount && s.isCollapsed && inSeg(s.anchorNode) ? { node: s.anchorNode, offset: s.anchorOffset } : null;
        if (!pos) { pos = caretPoint(e.clientX, e.clientY); if (pos && !inSeg(pos.node)) pos = null; }
        const off = pos ? srcOffsetIn(seg, pos.node, pos.offset) : 'end';
        switchTo(seg, off, off);
        return;
      }
      // empty space: below the text → a new paragraph at the end; beside it → the nearest block
      const blocks = segs.filter(x => x.els.some(n => n.nodeType === 1 && n.parentNode === page));
      const last = blocks[blocks.length - 1];
      const lastEl = last && [...last.els].reverse().find(n => n.nodeType === 1 && n.parentNode === page);
      if (!last || (lastEl && e.clientY > lastEl.getBoundingClientRect().bottom)) { openGapAtEnd(); return; }
      let best = null, bd = Infinity;
      for (const x of blocks) for (const n of x.els) { if (n.nodeType !== 1 || n.parentNode !== page) continue; const r = n.getBoundingClientRect(); const d = e.clientY < r.top ? r.top - e.clientY : e.clientY > r.bottom ? e.clientY - r.bottom : 0; if (d < bd) { bd = d; best = x; } }
      if (best) switchTo(best, 'end');
    }
    function openFootnoteDef(li) {
      const label = li.getAttribute('data-label') || (li.id || '').replace(/^fn/, '');
      const text = doc.text; const re = new RegExp('^\\[\\^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\]:\\s?', 'm');
      const m = re.exec(text); if (!m) return;
      const off = m.index + m[0].length;
      queue(async () => { await closeBlock(); openAtDoc(off, off); });
    }
    function toggleTaskBox(box) {
      const seg = segOfNode(box); if (!seg) return;
      const boxes = [...page.querySelectorAll('input[type=checkbox]')].filter(x => segOfNode(x) === seg);
      const k = boxes.indexOf(box);
      queue(async () => {
        const text = doc.text; const { st, en } = segRange(text, seg);
        let n = -1; const v = text.slice(st, en).replace(/^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/gm, (m0, a, c, b) => (++n === k ? a + (c === ' ' ? 'x' : ' ') + b : m0));
        if (n < k) return;
        const nt = text.slice(0, st) + v + text.slice(en);
        hist.record(text, nt, lastSel, lastSel); lastText = nt; doc.setText(nt, 'inline');
        if (open || cell) await closeBlock({ render: false, cleanup: false });
        await renderDoc();
      });
    }
    function followLink(href) {
      if (!href) return;
      if (href.startsWith('#')) { page.querySelector(`[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (/^(https?:|mailto:)/i.test(href)) { app.mk?.invoke?.('open-external', href)?.catch?.(() => {}); return; }
      if (doc?.path && !/^[a-z][\w+.-]*:/i.test(href)) {
        const sep = doc.path.includes('\\') ? '\\' : '/'; const dir = doc.path.replace(/[\\/][^\\/]*$/, '');
        app.docs.open(dir + sep + decodeURIComponent(href.split('#')[0]).replace(/\//g, sep)).catch(err => (app.ui.fail ? app.ui.fail(err, { lead: app.t('Check that the linked file “{href}” is next to this document, or fix the link.', { href }), hideReason: true }) : app.ui.toast(app.t('Check that the linked file “{href}” is next to this document, or fix the link.', { href }), { kind: 'error' })));
      }
    }

    // ---------- tables: each cell edits in place and shows its Markdown while you type (src/tables.js does the table)
    function tableElOf(seg) { return (seg && seg.els.find(n => n.nodeType === 1 && n.tagName === 'TABLE' && n.parentNode === page)) || null; }
    function tableLineOf(seg, text) {
      if (!app.tables || !seg) return null;
      for (let k = seg.cStart; k < Math.max(seg.cEnd, seg.cStart + 1); k++) { const f = app.tables.find(text, k); if (f) return f.start; }
      return null;
    }
    const tableSegAt = line => segs.find(x => x.kind === 'table' && x.cStart <= line && line < Math.max(x.cEnd, x.cStart + 1)) || null;
    function cellSel() {
      if (!cell) return { s: 0, e: 0 };
      const sel = getSelection(); const td = cell.td; const len = td.textContent.length;
      if (!sel.rangeCount || !td.contains(sel.anchorNode)) return cell.sel || { s: len, e: len };
      const r = sel.getRangeAt(0); const off = (node, o) => { const p = document.createRange(); p.selectNodeContents(td); try { p.setEnd(node, o); } catch { return len; } return p.toString().length; };
      const a = off(r.startContainer, r.startOffset), b = off(r.endContainer, r.endOffset);
      return { s: Math.min(a, b), e: Math.max(a, b) };
    }
    function setCellCaret(s, e = s) {
      if (!cell) return;
      const td = cell.td; td.normalize();
      let t = td.firstChild; if (!t || t.nodeType !== 3) { t = document.createTextNode(td.textContent); td.textContent = ''; td.appendChild(t); }
      const n = t.data.length; const r = document.createRange(); r.setStart(t, clamp(s, 0, n)); r.setEnd(t, clamp(e, 0, n));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      cell.sel = { s: clamp(s, 0, n), e: clamp(e, 0, n) };
    }
    function tryOpenCell(seg, a, b, opts) {
      const tb = tableElOf(seg); if (!tb) return false;
      if (opts.cell) return openCellAt(seg, opts.cell.row, opts.cell.col, opts.cell.caret ?? 'end');
      const text = doc.text; const { st, en } = segRange(text, seg);
      const off = a === 'end' ? Math.max(st, en - 1) : a === 'start' ? st : st + clamp(a ?? 0, 0, en - st);
      const c = app.tables.cellAt(text, off);
      if (!c) {
        // past the table (a caption line in the same block): the last cell
        if (a === 'end' || (typeof a === 'number' && off >= en - 1)) { const lr = tb.rows.length - 1; return openCellAt(seg, lr, tb.rows[lr].cells.length - 1, 'end'); }
        return openCellAt(seg, 0, 0, 'start');
      }
      const caret = a === 'end' ? 'end' : a === 'start' ? 'start' : clamp(off - c.start, 0, Math.max(0, c.end - c.start));
      return openCellAt(seg, c.row, c.col, caret);
    }
    function openCellAt(seg, row, col, caret = 'end') {
      if (!app.tables || !doc || doc.readOnly) return false;
      const tb = tableElOf(seg); if (!tb || !tb.rows.length) return false;
      const text = doc.text; const line = tableLineOf(seg, text); if (line == null) return false;
      const m = app.tables.parse(text, line); if (!m) return false;
      row = clamp(row | 0, 0, tb.rows.length - 1); const tr = tb.rows[row];
      col = clamp(col | 0, 0, tr.cells.length - 1); const td = tr.cells[col]; if (!td) return false;
      const src = (row === 0 ? m.header : m.rows[row - 1] || [])[col] ?? '';
      const shown = app.tables.unescapeCell(src);
      cell = { seg, line, row, col, td, saved: td.innerHTML, text: shown, sel: null };
      const cr0 = app.tables.cellRange(text, line, row, col); if (cr0) lastSel = { start: cr0.start, end: cr0.start };
      td.textContent = shown;
      try { td.contentEditable = 'plaintext-only'; } catch {}
      if (td.contentEditable !== 'plaintext-only') td.contentEditable = 'true';
      td.spellcheck = app.settings.get('spellcheck', true) !== false;
      td.classList.add('mk-il-cell'); td.setAttribute('role', 'textbox'); td.setAttribute('aria-label', app.t('Table cell, row {row}, column {column}. Tab goes to the next cell, Esc finishes.', { row: row + 1, column: col + 1 }));
      td.addEventListener('keydown', onCellKey); td.addEventListener('input', onCellInput); td.addEventListener('beforeinput', onCellBeforeInput);
      td.addEventListener('paste', onCellPaste); td.addEventListener('compositionstart', onCellCompStart); td.addEventListener('compositionend', onCellCompEnd);
      root.classList.add('mk-il-editing'); kbd = seg.index; markKbd();
      td.focus({ preventScroll: true });
      if (caret === 'all') setCellCaret(0, shown.length);
      else if (caret && typeof caret === 'object' && caret.prefix != null) { const p = alignOffset(shown, caret.prefix); setCellCaret(p); }
      else setCellCaret(caret === 'start' ? 0 : caret === 'end' ? shown.length : clamp(+caret || 0, 0, shown.length));
      td.scrollIntoView?.({ block: 'nearest' });
      emitSel();
      return true;
    }
    async function closeCell({ render = true } = {}) {
      if (!cell) return { changed: false };
      const c = cell; cell = null;
      root?.classList.remove('mk-il-editing');
      const td = c.td;
      td.removeEventListener('keydown', onCellKey); td.removeEventListener('input', onCellInput); td.removeEventListener('beforeinput', onCellBeforeInput);
      td.removeEventListener('paste', onCellPaste); td.removeEventListener('compositionstart', onCellCompStart); td.removeEventListener('compositionend', onCellCompEnd);
      td.removeAttribute('contenteditable'); td.removeAttribute('role'); td.removeAttribute('aria-label'); td.classList.remove('mk-il-cell');
      const changed = !!doc && doc.text !== lastRendered;
      if (!changed) { td.innerHTML = c.saved; return { changed: false }; }
      if (!render) return { changed: true };
      await renderDoc();
      return { changed: true };
    }
    function commitCell(shown) {
      if (!cell || !doc) return;
      const before = doc.text;
      const r = app.tables.apply(before, cell.line, 'setCell', { row: cell.row, col: cell.col, text: shown });
      if (!r) return;
      cell.text = shown;
      // undo comes back to this cell
      const at = t => { const cr = app.tables.cellRange(t, cell.line, cell.row, cell.col); return cr ? { start: cr.start, end: cr.start } : lastSel; };
      if (r.text !== before) { const sb = at(before); hist.record(before, r.text, sb, at(r.text)); lastText = r.text; doc.setText(r.text, 'inline'); }
      lastSel = at(doc.text);
      selBefore = null;
    }
    let cellComposing = false;
    function onCellCompStart() { cellComposing = true; }
    function onCellCompEnd() { cellComposing = false; if (cell) commitCell(cell.td.textContent.replace(/\n/g, ' ')); }
    function onCellBeforeInput(e) {
      if (!cell) return;
      const t = e.inputType || '';
      if (t === 'historyUndo') { e.preventDefault(); adapter.undo(); return; }
      if (t === 'historyRedo') { e.preventDefault(); adapter.redo(); return; }
      if (t === 'insertParagraph' || t === 'insertLineBreak') { e.preventDefault(); return; }
      if (doc?.readOnly) { e.preventDefault(); return; }
    }
    function onCellInput(e) {
      if (!cell || cellComposing || e.isComposing) return;
      const td = cell.td;
      if (/\n/.test(td.textContent)) { const { s } = cellSel(); td.textContent = td.textContent.replace(/\n/g, ' '); setCellCaret(s); }
      commitCell(td.textContent);
      // AutoCorrect: the typed character is one undo step, the correction another
      if (e.inputType === 'insertText' && e.data && e.data.length === 1) {
        const { s, e: en } = cellSel(); const v = td.textContent;
        if (s === en) {
          const before = v.slice(0, s); const c = T.correct(before, { context: T.mdContext(before.slice(0, -1), 'n') });
          if (c) { td.textContent = v.slice(0, s - c.remove) + c.insert + v.slice(s); setCellCaret(s - c.remove + c.insert.length); commitCell(td.textContent); }
        }
      }
      cell.sel = cellSel();
      emitSel();
      T.runInput?.({ mode: 'inline', adapter, element: td, inTable: true, inputType: e.inputType, data: e.data });
    }
    function onCellPaste(e) {
      e.preventDefault(); if (!cell) return;
      const t = (e.clipboardData?.getData('text/plain') || '').replace(/\r?\n|\t/g, ' ');
      if (t) document.execCommand('insertText', false, t);
    }
    function insertInCell(txt) { if (!cell) return; const { s, e } = cellSel(); const v = cell.td.textContent; cell.td.textContent = v.slice(0, s) + txt + v.slice(e); setCellCaret(s + txt.length); commitCell(cell.td.textContent); emitSel(); }
    function gotoCell(seg, row, col, caret) {
      const line = cell ? cell.line : null;
      return queue(async () => {
        await closeCell();
        let s = segs.includes(seg) ? seg : (line != null ? tableSegAt(line) : null) || segs.find(x => x.start === seg.start);
        if (s) openCellAt(s, row, col, caret);
      });
    }
    function leaveTable(dir) {
      const seg = cell.seg, line = cell.line;
      return queue(async () => {
        await closeCell();
        const s = segs.includes(seg) ? seg : tableSegAt(line) || seg;
        const n = segs[s.index + dir];
        if (n) openSeg(n, dir > 0 ? 'start' : 'end', dir > 0 ? 'start' : 'end');
        else if (dir > 0) openGap(s);
      });
    }
    function cellMove(dir) {
      const c = cell; if (!c) return;
      const tb = c.td.closest('table'); const nRows = tb.rows.length; const nCols = tb.rows[c.row].cells.length;
      let r = c.row, k = c.col, caret = 'end';
      if (dir === 'next') { if (k + 1 < nCols) k++; else if (r + 1 < nRows) { r++; k = 0; } else return leaveTable(1); caret = 'start'; }
      else if (dir === 'prev') { if (k > 0) k--; else if (r > 0) { r--; k = tb.rows[r].cells.length - 1; } else return leaveTable(-1); }
      else if (dir === 'down') { if (r + 1 < nRows) r++; else return leaveTable(1); }
      else if (dir === 'up') { if (r > 0) r--; else return leaveTable(-1); }
      return gotoCell(c.seg, r, k, caret);
    }
    function cellTab(back) {
      const c = cell; if (!c) return;
      const tb = c.td.closest('table'); const nRows = tb.rows.length; const nCols = tb.rows[c.row].cells.length;
      if (back) {
        if (c.col > 0) return gotoCell(c.seg, c.row, c.col - 1, 'all');
        if (c.row > 0) return gotoCell(c.seg, c.row - 1, tb.rows[c.row - 1].cells.length - 1, 'all');
        return;
      }
      if (c.col + 1 < nCols) return gotoCell(c.seg, c.row, c.col + 1, 'all');
      if (c.row + 1 < nRows) return gotoCell(c.seg, c.row + 1, 0, 'all');
      // Tab in the last cell adds a row, like Word
      return queue(async () => {
        await closeCell({ render: false });
        const before = doc.text; const r = app.tables.apply(before, c.line, 'rowBelow', { row: c.row, col: c.col });
        if (r && r.text !== before) { hist.record(before, r.text, lastSel, null); lastText = r.text; doc.setText(r.text, 'inline'); }
        await renderDoc();
        const s = tableSegAt(c.line); if (s) openCellAt(s, c.row + 1, 0, 'start');
      });
    }
    function onCellKey(e) {
      if (!cell || e.isComposing || e.keyCode === 229) return;
      if (T.runKey?.(e, { mode: 'inline', adapter, element: cell.td, inTable: true })) return;
      const name = E.keyName ? E.keyName(e) : '';
      if (name === 'Ctrl+Z') { e.preventDefault(); e.stopPropagation(); adapter.undo(); return; }
      if (name === 'Ctrl+Y' || name === 'Ctrl+Shift+Z') { e.preventDefault(); e.stopPropagation(); adapter.redo(); return; }
      if (E.dispatchShortcut?.(e)) return;
      const mod = e.ctrlKey || e.metaKey || e.altKey;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); const k = cell.seg.index; queue(async () => { await closeCell(); kbd = Math.min(k, segs.length - 1); markKbd(); root.focus({ preventScroll: true }); }); return; }
      if (e.key === 'Tab' && !mod) { e.preventDefault(); e.stopPropagation(); cellTab(e.shiftKey); return; }
      if (e.key === 'Enter' && !mod) { e.preventDefault(); e.stopPropagation(); insertInCell('<br>'); return; } // a new line in the cell, like Word (Down leaves the row)
      const { s, e: en } = cellSel(); const len = cell.td.textContent.length;
      if (!mod && !e.shiftKey && s === en) {
        // Left / Right follow the cell's own direction (mirrored in a right-to-left cell)
        const rtl = textDir(cell.td.textContent, cell.td) === 'rtl';
        if (e.key === (rtl ? 'ArrowRight' : 'ArrowLeft') && s === 0) { e.preventDefault(); cellMove('prev'); return; }
        if (e.key === (rtl ? 'ArrowLeft' : 'ArrowRight') && s === len) { e.preventDefault(); cellMove('next'); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); cellMove('up'); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); cellMove('down'); return; }
      }
      if (selBefore == null) selBefore = lastSel;
    }
    function onPageContext(e) {
      const td = e.target.closest('td,th');
      if (!td || !page.contains(td) || !app.tables?.contextMenu || !doc || doc.readOnly) return;
      e.preventDefault();
      const x = e.clientX, y = e.clientY;
      const seg = segOfNode(td);
      if (!(cell && cell.td === td)) {
        if (seg && seg.kind === 'table') switchTo(seg, 0, 0, { cell: { row: td.parentElement.rowIndex, col: td.cellIndex, caret: 'end' } });
        else ctxTd = td;
      }
      chain.then(() => app.tables.contextMenu({ x, y }));
    }

    // ---------- keyboard ----------
    function markKbd() {
      page?.querySelectorAll('.mk-il-cur').forEach(n => n.classList.remove('mk-il-cur'));
      if (open || kbd < 0 || !segs[kbd]) return;
      segs[kbd].els.forEach(n => n.nodeType === 1 && n.classList.add('mk-il-cur'));
    }
    function onRootKey(e) {
      if (open && open.el.contains(e.target)) return;
      if (e.target !== root && !page.contains(e.target)) return;
      if (e.isComposing) return;
      const name = E.keyName ? E.keyName(e) : '';
      if (name === 'Ctrl+Z') { e.preventDefault(); e.stopPropagation(); adapter.undo(); return; }
      if (name === 'Ctrl+Y' || name === 'Ctrl+Shift+Z') { e.preventDefault(); e.stopPropagation(); adapter.redo(); return; }
      if (E.dispatchShortcut?.(e)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!segs.length) { if (e.key.length === 1 || e.key === 'Enter') { e.preventDefault(); openGapAtEnd().then(() => { if (e.key.length === 1) adapter.insert(e.key); }); } return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // move the block marker; Enter (or typing) opens the marked block
        e.preventDefault();
        if (kbd < 0 && lastSel) kbd = segForLine(lineOfOffset(doc.text, lastSel.start))?.index ?? -1;
        kbd = clamp((kbd < 0 ? (e.key === 'ArrowDown' ? -1 : segs.length) : kbd) + (e.key === 'ArrowDown' ? 1 : -1), 0, segs.length - 1);
        lastSel = null;
        markKbd(); segs[kbd].els.find(n => n.nodeType === 1)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      const reopen = () => (lastSel && lastSel.end <= doc.text.length ? queue(async () => { if (lastRendered !== doc.text) await renderDoc(); openAtDoc(lastSel.start, lastSel.end); }) : switchTo(segs[Math.max(0, kbd)], 'end'));
      if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); reopen(); return; }
      if (e.key.length === 1 && !busy) { e.preventDefault(); const ch = e.key; reopen().then(() => { if (open) typeText(ch); }); }
    }
    function onFirstVisualLine() {
      const d = open.el.firstElementChild; if (!d) return true;
      const s = getSelection(); if (!s.rangeCount) return false;
      const r = s.getRangeAt(0).cloneRange(); r.collapse(true); const rc = r.getClientRects()[0] || r.startContainer.parentElement?.getBoundingClientRect?.() || d.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(d).lineHeight) || 24;
      return rc.top < d.getBoundingClientRect().top + lh * 0.75;
    }
    function onLastVisualLine() {
      const d = open.el.lastElementChild; if (!d) return true;
      const s = getSelection(); if (!s.rangeCount) return false;
      const r = s.getRangeAt(0).cloneRange(); r.collapse(false); const rects = r.getClientRects(); const rc = rects[rects.length - 1] || r.endContainer.parentElement?.getBoundingClientRect?.() || d.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(d).lineHeight) || 24;
      return rc.bottom > d.getBoundingClientRect().bottom - lh * 0.75;
    }
    function onEdKey(e) {
      if (!open || e.isComposing || e.keyCode === 229) return;
      if (T.runKey?.(e, { mode: 'inline', adapter, element: open.el, inTable: open.seg.kind === 'table' })) return;
      const name = E.keyName ? E.keyName(e) : '';
      if (name === 'Ctrl+Z') { e.preventDefault(); e.stopPropagation(); adapter.undo(); return; }
      if (name === 'Ctrl+Y' || name === 'Ctrl+Shift+Z') { e.preventDefault(); e.stopPropagation(); adapter.redo(); return; }
      if (name === 'Ctrl+Home') { e.preventDefault(); e.stopPropagation(); if (segs[0]) switchTo(segs[0], 'start'); return; }
      if (name === 'Ctrl+End') { e.preventDefault(); e.stopPropagation(); if (segs.length) switchTo(segs[segs.length - 1], 'end'); return; }
      if (E.dispatchShortcut?.(e)) return;
      const mod = e.ctrlKey || e.metaKey || e.altKey;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); const k = open.seg.virtual ? Math.max(0, Math.floor(open.seg.index)) : open.seg.index; queue(async () => { await closeBlock(); kbd = Math.min(k, segs.length - 1); markKbd(); root.focus({ preventScroll: true }); }); return; }
      const { s, e: en } = getEdSel(); const v = open.text; const collapsed = s === en;
      if (!mod && !e.shiftKey) {
        if (e.key === 'ArrowUp' && onFirstVisualLine()) { if (go(-1, 'end', caretX())) e.preventDefault(); return; }
        if (e.key === 'ArrowDown' && onLastVisualLine()) { if (go(1, 'start', caretX())) e.preventDefault(); return; }
        // Left / Right at the edges follow the line's direction (each line is its own bidi paragraph: unicode-bidi:plaintext)
        if (collapsed && s === 0 && e.key === (textDir(v.split('\n')[0], open.el) === 'rtl' ? 'ArrowRight' : 'ArrowLeft')) { if (go(-1, 'end')) e.preventDefault(); return; }
        if (collapsed && s === v.length && e.key === (textDir(v.split('\n').pop(), open.el) === 'rtl' ? 'ArrowLeft' : 'ArrowRight')) { if (go(1, 'start')) e.preventDefault(); return; }
      }
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); e.stopPropagation(); onEnter(e.shiftKey); return; }
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); onTab(e.shiftKey); return; }
      if (e.key === 'Backspace' && !mod && collapsed && s === 0) { e.preventDefault(); mergeWith(-1); return; }
      if (e.key === 'Delete' && !mod && collapsed && s === v.length) { e.preventDefault(); mergeWith(1); return; }
    }

    // ---------- input ----------
    function onBeforeInput(e) {
      if (!open) return;
      const t = e.inputType || '';
      if (t === 'historyUndo') { e.preventDefault(); adapter.undo(); return; }
      if (t === 'historyRedo') { e.preventDefault(); adapter.redo(); return; }
      if (doc?.readOnly) { e.preventDefault(); return; }
      const sel = getEdSel(); const v = open.text;
      selBefore = { start: open.start + sel.s, end: open.start + sel.e };
      const collapsed = sel.s === sel.e;
      const multi = v.slice(sel.s, sel.e).includes('\n');
      if (t === 'insertParagraph' || t === 'insertLineBreak') { e.preventDefault(); onEnter(t === 'insertLineBreak'); return; }
      if (/^insertFrom(Paste|Drop|PasteAsQuotation)$/.test(t) || t === 'deleteByDrag') { e.preventDefault(); return; }
      if (t.startsWith('delete')) {
        const back = /Backward/.test(t);
        if (collapsed && back && sel.s === 0) { e.preventDefault(); mergeWith(-1); return; }
        if (collapsed && !back && sel.s === v.length) { e.preventDefault(); mergeWith(1); return; }
        const atLS = sel.s === lineStartOf(v, sel.s), atLE = sel.e === lineEndOf(v, sel.e);
        if (multi || (collapsed && back && atLS) || (collapsed && !back && atLE)) {
          e.preventDefault();
          let a = sel.s, b = sel.e; if (collapsed) { if (back) a--; else b++; }
          applyBlock(v.slice(0, a) + v.slice(b), a);
        }
        return;
      }
      if ((t === 'insertText' || t === 'insertReplacementText') && multi) {
        e.preventDefault();
        const data = e.data ?? e.dataTransfer?.getData?.('text/plain') ?? '';
        applyBlock(v.slice(0, sel.s) + data + v.slice(sel.e), sel.s + data.length);
      }
    }
    function onInput(e) {
      if (!open || composing || e.isComposing) return;
      syncFromDom(e);
    }
    function syncFromDom(e) {
      if (!open) return;
      const v = readEd(); const sel = getEdSel();
      paint(v); setEdSel(sel.s, sel.e);
      commitBlock(v, sel.s, sel.e);
      if (e && e.inputType === 'insertText' && e.data && e.data.length === 1 && sel.s === sel.e) autocorrect(sel.s);
      emitSel(); revealCaret();
      if (open) T.runInput?.({ mode: 'inline', adapter, element: open.el, inTable: false, inputType: e?.inputType, data: e?.data });
    }
    function autocorrect(at) {
      const v = open.text; const ls = lineStartOf(v, at); const li = lineOfOffset(v, at);
      const st = open.states?.[li] ?? 'n';
      const lineBefore = v.slice(ls, at);
      if (open.seg.kind === 'front' || open.seg.kind === 'code' || open.seg.kind === 'math') return;
      const c = T.correct(lineBefore, { context: T.mdContext(lineBefore.slice(0, -1), st) });
      if (!c) return;
      const nv = v.slice(0, at - c.remove) + c.insert + v.slice(at);
      applyBlock(nv, at - c.remove + c.insert.length);
    }
    function typeText(text) {
      const { s, e } = getEdSel(); const v = open.text;
      applyBlock(v.slice(0, s) + text + v.slice(e), s + text.length);
      if (text.length === 1) autocorrect(s + 1);
    }
    async function onPaste(e) {
      e.preventDefault();
      const cd = e.clipboardData; if (!cd || !open) return;
      const files = [...cd.files].filter(f => /^image\//.test(f.type));
      if (files.length) { for (const f of files) { const r = await E.saveImage(f, doc); adapter.replaceSelection(E.imageMarkdown(r.path, r.name)); } return; }
      const html = cd.getData('text/html'), text = cd.getData('text/plain');
      let md = text;
      if (html && !(E.looksLikeMarkdown?.(text)) && E.sanitizePaste && E.toMarkdown && !/^\s*$/.test(html.replace(/<[^>]+>/g, ''))) {
        try { md = E.toMarkdown(E.sanitizePaste(html)).replace(/\n+$/, ''); } catch { md = text; }
      }
      if (md) adapter.replaceSelection(md.replace(/\r\n?/g, '\n'));
    }
    async function onDrop(e) {
      e.preventDefault(); if (!open) return;
      const pos = document.caretRangeFromPoint?.(e.clientX, e.clientY);
      if (pos && open.el.contains(pos.startContainer)) { const o = domOffset(pos.startContainer, pos.startOffset); setEdSel(o, o); }
      const files = [...(e.dataTransfer?.files || [])].filter(f => /^image\//.test(f.type));
      if (files.length) { for (const f of files) { const r = await E.saveImage(f, doc); adapter.replaceSelection(E.imageMarkdown(r.path, r.name)); } return; }
      const t = e.dataTransfer?.getData('text/plain'); if (t) adapter.replaceSelection(t);
    }
    // double-click on math in the source opens the equation editor
    function mathAt(v, at) {
      const re = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$(?!\s)[^$\n]+?\$/g; let m;
      while ((m = re.exec(v))) { if (at >= m.index && at <= m.index + m[0].length) return m; }
      return null;
    }
    function onEdDblClick() {
      if (!open || !app.equationEditor?.open) return;
      const { s } = getEdSel(); const v = open.text; const m = mathAt(v, s); if (!m) return;
      const raw = m[0]; const display = /^(\$\$|\\\[)/.test(raw);
      const tex = raw.replace(/^(\$\$|\\\[|\\\(|\$)/, '').replace(/(\$\$|\\\]|\\\)|\$)$/, '').trim();
      const after = v.slice(m.index + raw.length); const lab = /^\s*\{#([^}\s]+)\}/.exec(after);
      const a = m.index, b = m.index + raw.length + (lab ? lab[0].length : 0);
      let done = false;
      const apply = res => {
        if (done || !res || res.tex == null || !open) return; done = true;
        let label = res.label ? String(res.label).replace(/^#/, '') : ''; if (label && !/:/.test(label)) label = 'eq:' + label;
        const md = res.display ? `$$\n${res.tex}\n$$` + (label ? ` {#${label}}` : '') : `$${res.tex}$`;
        applyBlock(open.text.slice(0, a) + md + open.text.slice(b), a + md.length);
      };
      try {
        const p = app.equationEditor.open({ tex, display, label: lab ? lab[1] : '', numbered: !!lab, onDone: apply });
        if (p && typeof p.then === 'function') p.then(apply, () => {});
      } catch (err) { console.warn(err); }
    }

    // ---------- Enter / Tab / merging ----------
    function onEnter(soft) {
      if (!open) return;
      let { s, e } = getEdSel(); let v = open.text;
      if (s !== e) { v = v.slice(0, s) + v.slice(e); e = s; }
      const ls = lineStartOf(v, s), le = lineEndOf(v, s), line = v.slice(ls, le);
      const li = lineOfOffset(v, s); const st = open.states?.[li] ?? 'n';
      const kind = open.seg.kind;
      const codeish = st !== 'n' || kind === 'front' || kind === 'code' || kind === 'math' || /^\s*(```|~~~|\$\$|\\\[|\\begin\{|<)/.test(line) || /^\s*\|/.test(line);
      const nl = (txt, caret) => applyBlock(v.slice(0, s) + txt + v.slice(s), caret ?? s + txt.length);
      if (codeish) { const ind = /^[ \t]*/.exec(line)[0]; return nl('\n' + (st !== 'n' || kind === 'code' ? ind : '')); }
      if (soft) return nl('\\\n');
      let m = LIST_RE.exec(line);
      if (m && s >= ls + m[0].length) {
        if (!line.slice(m[0].length).trim()) {
          // an empty item ends the list (a new paragraph after it)
          const nv = (v.slice(0, ls) + v.slice(le + (le < v.length ? 1 : 0))).replace(/\n+$/, '');
          if (le >= v.length || !v.slice(le + 1).trim()) { applyBlock(nv, nv.length); return gapAfterOpen(); }
          return applyBlock(v.slice(0, ls) + v.slice(le), ls);
        }
        let marker = m[2]; if (/^\d/.test(marker)) marker = (parseInt(marker, 10) + 1) + marker.slice(-1);
        return nl('\n' + m[1] + marker + (m[3].length > 4 ? ' ' : m[3]) + (m[4] ? '[ ] ' : ''));
      }
      if ((m = /^(\s*(?:>\s?)+)/.exec(line)) && s >= ls + m[1].length) {
        if (!line.slice(m[1].length).trim()) {
          const nv = (v.slice(0, ls) + v.slice(le + (le < v.length ? 1 : 0))).replace(/\n+$/, '');
          if (le >= v.length) { applyBlock(nv, nv.length); return gapAfterOpen(); }
          return applyBlock(v.slice(0, ls) + v.slice(le), ls);
        }
        return nl('\n' + m[1]);
      }
      if (kind !== 'p' && kind !== 'h' && kind !== 'other' && !open.virtual) return nl('\n' + (/^(\s+)\S/.exec(line)?.[1] || ''));
      // a paragraph or heading: Enter starts a new paragraph, like Word
      const before = v.slice(0, s).replace(/[ \t]+$/, '');
      let after = v.slice(s).replace(/^[ \t]+/, '');
      if (!before.trim() && !after.trim()) return;
      if (!after.trim()) { if (before !== open.text) applyBlock(before, before.length); return gapAfterOpen(); }
      if (!before.trim()) return gapBeforeOpen();
      const hm = /^(#{1,6})\s/.exec(line);
      if (hm && s > ls + hm[0].length) after = hm[1] + ' ' + after;
      const nv = before + '\n\n' + after;
      applyBlock(nv, before.length + 2);
      const target = open.start + before.length + 2;
      queue(async () => { const keep = doc.text; await closeBlock({ cleanup: false }); openAtDoc(T.mapOffset(keep, doc.text, target)); });
    }
    function gapAfterOpen() {
      const start = open.start;
      queue(async () => {
        const keep = doc.text; await closeBlock({ cleanup: false });
        const line = lineOfOffset(doc.text, T.mapOffset(keep, doc.text, start));
        openGap(segForLine(line));
      });
    }
    function gapBeforeOpen() {
      const start = open.start;
      queue(async () => {
        const keep = doc.text; await closeBlock({ cleanup: false });
        const line = lineOfOffset(doc.text, T.mapOffset(keep, doc.text, start));
        const cur = segForLine(line); const prev = cur ? segs[cur.index - 1] || null : null;
        openGap(prev, 'before', { beforeSeg: cur });
      });
    }
    function textual(kind) { return kind === 'p' || kind === 'h'; }
    function mergeWith(dir) {
      if (!open) return;
      const v = open.text;
      const nb = neighbor(dir);
      if (!v && (open.virtual || open.base == null)) { // an empty paragraph: remove it and go next door
        if (nb) switchTo(nb, dir < 0 ? 'end' : 'start'); else queue(() => closeBlock());
        return;
      }
      if (!nb) return;
      const curText = !LIST_RE.test(v) && !/^\s*(>|\||```|\$\$)/.test(v);
      if (!textual(nb.kind) || !(textual(open.seg.kind) || open.virtual) || !curText) { if (dir < 0 && textual(nb.kind)) switchTo(nb, 'end'); else if (dir > 0 && textual(nb.kind)) switchTo(nb, 'start'); return; }
      // join two paragraphs (Backspace at the start / Delete at the end), like Word
      const startCur = open.start, lenCur = open.len, base = open.base ?? doc.text;
      queue(async () => {
        const text0 = lastRendered ?? doc.text;
        const { st: nst, en: nen } = segRange(text0, nb);
        let nt, caret;
        if (dir < 0) {
          const body = v.replace(/^#{1,6}\s+/, '');
          nt = base.slice(0, nen) + body + base.slice(startCur + lenCur); caret = nen;
        } else {
          const nbStart = T.mapOffset(text0, base, nst), nbEnd = T.mapOffset(text0, base, nen);
          const nextBody = base.slice(nbStart, nbEnd).replace(/^#{1,6}\s+/, '');
          nt = base.slice(0, startCur + lenCur) + nextBody + base.slice(nbEnd); caret = startCur + lenCur;
        }
        const before = doc.text;
        hist.record(before, nt, docSel(), { start: caret, end: caret }); lastText = nt; doc.setText(nt, 'inline');
        await closeBlock({ cleanup: false });
        if (doc.text !== lastRendered) await renderDoc();
        openAtDoc(caret);
      });
    }
    function onTab(back) {
      const { s, e } = getEdSel(); const v = open.text; const ls = lineStartOf(v, s); const line = v.slice(ls, lineEndOf(v, s));
      const li = lineOfOffset(v, s); const st = open.states?.[li] ?? 'n';
      if (/^\s*\|/.test(line)) {
        // table: jump between cells, a new row after the last one
        const cells = []; for (let i = ls; i < ls + line.length; i++) if (v[i] === '|' && v[i - 1] !== '\\') cells.push(i);
        if (!back) {
          const nextBar = cells.find(i => i >= s + 1 && i < ls + line.length - 1);
          if (nextBar != null) { const end = cells.find(i => i > nextBar) ?? ls + line.length; return setEdSel(nextBar + 2, Math.max(nextBar + 2, end - 1)); }
          const le = lineEndOf(v, s);
          if (le >= v.length || !/^\s*\|/.test(v.slice(le + 1, lineEndOf(v, le + 1)))) { const row = '\n|' + '  |'.repeat(Math.max(1, cells.length - 1)); return applyBlock(v.slice(0, le) + row + v.slice(le), le + 3); }
          const nl = le + 1; const bar = v.indexOf('|', nl); return setEdSel(bar + 2, Math.max(bar + 2, v.indexOf('|', bar + 1) - 1));
        }
        const prevBars = cells.filter(i => i < s - 1); if (prevBars.length >= 2) { const a = prevBars[prevBars.length - 2]; return setEdSel(a + 2, prevBars[prevBars.length - 1] - 1); }
        return;
      }
      if (st !== 'n' || open.seg.kind === 'code') { if (back) { const r = Ops.outdent(v, s, e); if (r) applyBlock(r.v, r.s, r.e); } else applyBlock(v.slice(0, s) + '    ' + v.slice(e), s + 4); return; }
      if (LIST_RE.test(line) || /\n/.test(v.slice(s, e))) { const r = back ? Ops.outdent(v, s, e) : Ops.indent(v, s, e); if (r) applyBlock(r.v, r.s, r.e); }
      // elsewhere Markdown has no tab stops
    }

    // ---------- selection / painter ----------
    let selRaf = 0;
    function onSelectionChange() {
      if (cell && !selRaf && mounted) { selRaf = requestAnimationFrame(() => { selRaf = 0; if (cell) { const s = getSelection(); if (s.rangeCount && cell.td.contains(s.anchorNode)) { cell.sel = cellSel(); emitSel(); } } }); return; }
      if (selRaf || !mounted || !open) return;
      selRaf = requestAnimationFrame(() => {
        selRaf = 0; if (!open) return;
        const s = getSelection(); if (!s.rangeCount || !open.el.contains(s.anchorNode)) return;
        const sel = getEdSel(); open.sel = sel; lastSel = { start: open.start + sel.s, end: open.start + sel.e };
        emitSel();
      });
    }
    function emitSel() { app.events.emit('selection:changed', { mode: 'inline', states: adapter.activeStates() }); }
    function applyPainter() {
      if (!painter || !open) return;
      const { s, e } = getEdSel(); if (s === e) return;
      const f = painter; painter = null; root.style.cursor = '';
      for (const k of ['bold', 'italic', 'underline', 'strike', 'highlight', 'code']) if (f[k] && !Ops.states(open.text, getEdSel().s, getEdSel().e)[k]) adapter.format(k);
    }

    // ---------- operations used by the adapter ----------
    async function ensureOpen() {
      if (open) return true;
      if (!doc || doc.readOnly) return false;
      await queue(async () => {
        if (open) return;
        if (lastRendered !== doc.text) await renderDoc();
        if (lastSel && lastSel.start <= doc.text.length) openAtDoc(lastSel.start, Math.min(lastSel.end, doc.text.length));
        else if (kbd >= 0 && segs[kbd]) openSeg(segs[kbd], 'end');
        else { const last = segs.filter(s => s.kind !== 'front').pop() || null; openGap(last); }
      });
      return !!open;
    }
    async function op(fn) {
      if (cell) {
        // formatting inside a table cell works on the cell's Markdown
        const { s, e } = cellSel(); const r = fn(cell.td.textContent, s, e);
        if (r) { if (selBefore == null) selBefore = lastSel; cell.td.textContent = String(r.v).replace(/\n+/g, ' '); setCellCaret(r.s, r.e ?? r.s); commitCell(cell.td.textContent); emitSel(); }
        return;
      }
      if (!(await ensureOpen())) return;
      const { s, e } = getEdSel();
      const r = fn(open.text, s, e);
      if (r) applyBlock(r.v, r.s, r.e);
    }
    function insertBlockText(v, s, e, md) {
      md = md.replace(/^\n+|\n+$/g, '');
      if (s !== e) { v = v.slice(0, s) + v.slice(e); e = s; }
      const ls = lineStartOf(v, s), le = lineEndOf(v, s), line = v.slice(ls, le);
      if (!line.trim()) {
        const prevBlank = ls === 0 || !v.slice(lineStartOf(v, ls - 1), ls - 1).trim();
        const nextBlank = le >= v.length || !v.slice(le + 1, lineEndOf(v, le + 1)).trim();
        const pre = prevBlank ? '' : '\n', post = nextBlank ? '' : '\n';
        return Ops.R(v, ls, le, pre + md + post, ls + pre.length + md.length);
      }
      return Ops.R(v, le, le, '\n\n' + md, le + 2 + md.length);
    }

    // ---------- adapter ----------
    const adapter = {
      name: 'inline',
      mount(container, d) {
        if (mounted) adapter.unmount();
        host = container; doc = d; mounted = true; segs = []; lastRendered = null; open = null; lastSel = null; kbd = -1; painter = null;
        hist.clear(); lastText = doc?.text || '';
        build(); host.appendChild(root);
        root.classList.toggle('readonly', !!doc?.readOnly);
        offs.push(app.events.on('doc:changed', ({ doc: dd, origin }) => {
          if (dd !== doc) return;
          if (origin === 'inline') { lastText = dd.text; return; }
          if (dd.text === lastText) return;
          const prev = lastText; lastText = dd.text;
          hist.record(prev, dd.text, lastSel, null);
          const keep = open ? { start: T.mapOffset(prev, dd.text, open.start + (open.sel?.s ?? 0)), end: T.mapOffset(prev, dd.text, open.start + (open.sel?.e ?? 0)), focus: document.activeElement === open.el } : null;
          if (lastSel && !keep) lastSel = { start: T.mapOffset(prev, dd.text, lastSel.start), end: T.mapOffset(prev, dd.text, lastSel.end) };
          const keepCell = cell ? { line: lineOfOffset(dd.text, T.mapOffset(prev, dd.text, offsetOfLine(prev, cell.line))), row: cell.row, col: cell.col, caret: cellSel().s } : null;
          queue(async () => {
            if (open || cell) await closeBlock({ render: false, cleanup: false });
            await renderDoc();
            if (keep) openAtDoc(keep.start, keep.end, { focus: keep.focus });
            else if (keepCell) { const s = tableSegAt(keepCell.line); if (s) openCellAt(s, keepCell.row, keepCell.col, keepCell.caret); }
          });
        }));
        offs.push(app.events.on('zoom:changed', applyLayout));
        offs.push(app.events.on('i18n:changed', () => { page?.setAttribute('aria-label', app.t('Document. Click a paragraph to edit it.')); }));
        offs.push(app.events.on('layout:changed', applyLayout));
        offs.push(app.events.on('settings:changed', ({ key }) => { if (/^(fontFamily|fontSize)$/.test(key)) applyLayout(); if (key === 'mathMacros') adapter.refresh(); if (key === 'spellcheck' && open) open.el.spellcheck = app.settings.get('spellcheck', true) !== false; }));
        offs.push(app.events.on('theme:changed', () => { if (!open) { page?.querySelectorAll('pre.mermaid[data-done]').forEach(p => { p.removeAttribute('data-done'); p.textContent = p.getAttribute('data-src') || ''; }); Promise.resolve(app.decorate(page, doc)).catch(() => {}); } }));
        queue(() => renderDoc()).then(() => { if (mounted && root && !root.contains(document.activeElement)) root.focus({ preventScroll: true }); });
      },
      unmount() {
        if (!mounted) return;
        if (open) { const o = open; open = null; try { CSS.highlights?.delete('mk-il-sel'); } catch {} o.el.remove(); }
        cell = null; ctxTd = null;
        mounted = false; renderSeq++;
        offs.splice(0).forEach(f => { try { f(); } catch {} });
        root?.remove(); root = sheet = page = null; host = null; doc = null; segs = [];
      },
      get doc() { return doc; },
      get page() { return page; },
      getSurface() { return page && page.isConnected ? page : null; },
      get openBlock() {
        if (cell && doc) { const cr = app.tables.cellRange(doc.text, cell.line, cell.row, cell.col) || { start: 0, end: 0 }; return { text: cell.td.textContent, start: cr.start, end: cr.end, sel: { ...cellSel() }, element: cell.td, virtual: false, cell: { row: cell.row, col: cell.col, line: cell.line } }; }
        return open ? { text: open.text, start: open.start, end: open.start + open.len, sel: { ...getEdSel() }, element: open.el, virtual: !!open.virtual } : null; },
      whenIdle: () => chain.then(() => {}),
      flush() {},
      getSelection() {
        if (open) { const { s, e } = getEdSel(); return { text: open.text.slice(s, e), start: open.start + s, end: open.start + e }; }
        if (cell) { const { s, e } = cellSel(); return { text: cell.td.textContent.slice(s, e), start: null, end: null }; }
        const ds = getSelection(); const t = ds.rangeCount && page?.contains(ds.anchorNode) ? String(ds) : '';
        if (lastSel && doc && lastSel.end <= doc.text.length) return { text: t || doc.text.slice(lastSel.start, lastSel.end), start: lastSel.start, end: lastSel.end };
        return { text: t, start: null, end: null };
      },
      getSelectionMarkdown() { const s = adapter.getSelection(); return s.start != null ? doc.text.slice(s.start, s.end) : s.text; },
      setSelection(start, end = start) {
        if (!doc) return;
        start = clamp(start ?? 0, 0, doc.text.length); end = clamp(end ?? start, start, doc.text.length);
        lastSel = { start, end };
        if (open && start >= open.start && end <= open.start + open.len && !open.base) { setEdSel(start - open.start, end - open.start); revealCaret(); emitSel(); return; }
        return queue(async () => { await closeBlock(); if (lastRendered !== doc.text) await renderDoc(); openAtDoc(start, end); revealCaret(); });
      },
      getCaretLine() { const s = docSel(); return s && doc ? lineOfOffset(doc.text, s.start) : null; },
      async replaceSelection(md) { await op((v, s, e) => Ops.R(v, s, e, md)); },
      async insert(md) {
        const block = /^\n\n/.test(md) || (/\n/.test(md.trim()) && /^\n*(?:```|\$\$|\||#|> |[-*+] |\d+\. |<div|---\n|:::|\\\[)/.test(md.replace(/^\n+/, '')));
        if (block) return adapter.insertBlock(md);
        await op((v, s, e) => Ops.R(v, s, e, md));
      },
      async insertBlock(md) { if (cell) { app.ui.toast?.(app.t('A table cell holds one line of text. Click below the table to add this.')); return; } await op((v, s, e) => insertBlockText(v, s, e, md)); },
      async wrap(before, after) { await op((v, s, e) => Ops.wrap(v, s, e, before, after ?? before)); },
      async format(kind) {
        if (!doc || doc.readOnly) return;
        const W = { bold: ['**'], italic: ['*'], underline: ['<u>', '</u>'], strike: ['~~'], code: ['`'], sub: ['~'], sup: ['^'], highlight: ['=='] };
        let m;
        if (W[kind]) return op((v, s, e) => Ops.wrap(v, s, e, W[kind][0], W[kind][1] ?? W[kind][0]));
        if ((m = /^h([1-6])$/.exec(kind))) return op((v, s, e) => Ops.heading(v, s, e, Ops.states(v, s, e).heading === +m[1] ? 0 : +m[1]));
        if (kind === 'p') return op(Ops.para);
        if (kind === 'quote') return op(Ops.quote);
        if (kind === 'ul' || kind === 'ol' || kind === 'task') return op((v, s, e) => Ops.list(v, s, e, kind));
        if (kind === 'indent') return op(Ops.indent);
        if (kind === 'outdent') return op(Ops.outdent);
        if (kind === 'codeBlock') return op(Ops.codeBlock);
        if (kind === 'clear') return op(Ops.clear);
        if ((m = /^align(Left|Center|Right|Justify)$/.exec(kind))) return op((v, s, e) => Ops.align(v, s, e, m[1].toLowerCase()));
      },
      async color(c) { if (!c) return op(Ops.clear); await op((v, s, e) => { if (s === e) return null; const t = `<span style="color:${c}">${v.slice(s, e)}</span>`; return Ops.R(v, s, e, t, s, s + t.length); }); },
      async highlightColor(c) { if (!c || /ffd60a|yellow/i.test(c)) return adapter.format('highlight'); await op((v, s, e) => (s === e ? null : Ops.R(v, s, e, `<mark style="background:${c}">${v.slice(s, e)}</mark>`))); },
      startPainter() { if (!open) { app.ui.toast?.(app.t('Click into the text you want to copy the look from first.')); return; } const { s, e } = getEdSel(); painter = Ops.states(open.text, s, e); root.style.cursor = 'copy'; app.ui.toast?.(app.t('Select the text to paint. Press Esc to cancel.')); },
      insertTable(rows, cols) {
        const head = '| ' + Array.from({ length: cols }, (_, i) => 'Column ' + (i + 1)).join(' | ') + ' |';
        const sep = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
        const body = Array.from({ length: Math.max(1, rows - 1) }, () => '| ' + Array.from({ length: cols }, () => ' ').join(' | ') + ' |');
        return adapter.insertBlock([head, sep, ...body].join('\n'));
      },
      activeStates() { if (cell) { const { s, e } = cellSel(); return { ...Ops.states(cell.td.textContent, s, e), table: true }; } if (!open) return {}; const { s, e } = open.sel || getEdSel(); return Ops.states(open.text, s, e); },
      focus() { if (cell) { cell.td.focus({ preventScroll: true }); const c = cell.sel; if (c) setCellCaret(c.s, c.e); return; } if (open) { open.el.focus({ preventScroll: true }); try { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rangeFor(open.sel.s, open.sel.e)); } catch {} } else root?.focus({ preventScroll: true }); },
      scrollToLine(n, opts = {}) {
        if (!page || !doc) return;
        if (opts.caret) { const off = offsetOfLine(doc.text, n); return adapter.setSelection(off, off); }
        if (open && !open.virtual && n >= open.seg.cStart && n < open.seg.cStart + open.text.split('\n').length) { open.el.scrollIntoView({ behavior: opts.behavior || 'smooth', block: 'start' }); return; }
        const s = segForLine(n); const el = s && s.els.find(x => x.nodeType === 1 && x.parentNode === page);
        (el || page.firstElementChild)?.scrollIntoView({ behavior: opts.behavior || 'smooth', block: 'start' });
        if (s) { kbd = s.index; markKbd(); }
      },
      getText() { return doc?.text || ''; },
      refresh() {
        if (!doc) return;
        const keep = open ? { start: open.start + open.sel.s, end: open.start + open.sel.e, focus: document.activeElement === open.el } : null;
        return queue(async () => { if (open || cell) await closeBlock({ render: false, cleanup: false }); await renderDoc(); if (keep) openAtDoc(keep.start, keep.end, { focus: keep.focus }); });
      },
      find(query, opts = {}) {
        if (!doc || !query) return { count: 0, index: -1 };
        const re = E.findRegex ? E.findRegex(query, opts) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const all = [...doc.text.matchAll(re)].filter(m => m[0].length);
        if (!all.length) return { count: 0, index: -1 };
        const cur = docSel(); const from = opts.from ?? (cur ? (opts.backwards ? cur.start : cur.end) : 0);
        let i = opts.backwards ? all.filter(m => m.index < from).length - 1 : all.findIndex(m => m.index >= from);
        if (i < 0) i = opts.backwards ? all.length - 1 : 0;
        const m = all[i]; adapter.setSelection(m.index, m.index + m[0].length);
        return { count: all.length, index: i };
      },
      replace(query, replacement, opts = {}) {
        const s = adapter.getSelection(); const re = E.findRegex ? E.findRegex(query, opts) : null;
        if (re && s.start != null && s.end > s.start) {
          const one = new RegExp('^(?:' + re.source + ')$', re.flags.replace('g', '')); const t = doc.text.slice(s.start, s.end);
          if (one.test(t)) { const rep = opts.regex ? t.replace(one, replacement) : replacement; if (open && s.start >= open.start && s.end <= open.start + open.len) { const a = s.start - open.start; applyBlock(open.text.slice(0, a) + rep + open.text.slice(s.end - open.start), a + rep.length); } else doc.setText(doc.text.slice(0, s.start) + rep + doc.text.slice(s.end), 'inline-replace'); }
        }
        return adapter.find(query, opts);
      },
      replaceAll(query, replacement, opts = {}) {
        if (!doc) return 0;
        const re = E.findRegex ? E.findRegex(query, opts) : new RegExp(query, 'g'); let n = 0;
        const out = doc.text.replace(re, (...a) => { n++; return opts.regex ? a[0].replace(new RegExp(re.source, re.flags.replace('g', '')), replacement) : replacement; });
        if (n) doc.setText(out, 'inline-replace');
        return n;
      },
      undo() { return applyHistory(hist.undo(doc?.text ?? ''), app.t('Nothing to undo')); },
      redo() { return applyHistory(hist.redo(doc?.text ?? ''), null); },
      canUndo: () => hist.canUndo(), canRedo: () => hist.canRedo(),
      close() { return queue(() => closeBlock()); },
      openAt(start, end) { return adapter.setSelection(start, end); },
      // typing aids (src/typing-aids.js): replace [a, b) of the open block's text, select [s, e]; one undo step
      editOpenBlock(a, b, text, s, e = s) { if (!open || doc?.readOnly) return false; const v = open.text; applyBlock(v.slice(0, a) + text + v.slice(b), s, e); return true; },
      _typeText: (t) => { if (open) typeText(t); },
      _enter: (soft) => onEnter(!!soft),
      _segments: () => segs.map(s => ({ kind: s.kind, start: s.cStart, end: s.cEnd })),
      // ---- tables (src/tables.js)
      inTable() {
        if (cell) return true;
        if (!open || !app.tables || !doc) return false;
        const s = docSel(); const v = open.text; const at = open.sel?.s ?? 0;
        const ls = lineStartOf(v, at), le = lineEndOf(v, at);
        if (!/\|/.test(v.slice(ls, le))) return false;
        return !!(s && app.tables.cellAt(doc.text, s.start));
      },
      tableCell() { return cell ? { line: cell.line, row: cell.row, col: cell.col, element: cell.td } : null; },
      async tableAt() {
        if (!doc || !app.tables) return null;
        await chain;
        if (cell) return { line: cell.line, row: cell.row, col: cell.col };
        if (ctxTd && page?.contains(ctxTd)) {
          const seg = segOfNode(ctxTd); const td = ctxTd; ctxTd = null;
          const line = seg && tableLineOf(seg, doc.text);
          if (line != null) return { line, row: td.parentElement.rowIndex, col: td.cellIndex };
        }
        const s = docSel(); if (!s) return null;
        const c = app.tables.cellAt(doc.text, s.start); return c ? { line: c.line, row: c.row, col: c.col } : null;
      },
      openTableCell(line, row, col, caret = 'end') {
        return queue(async () => {
          await closeBlock();
          if (lastRendered !== doc.text) await renderDoc();
          const s = tableSegAt(line); if (s) openCellAt(s, row, col, caret);
        });
      },
      applyTableEdit(text, target) {
        return queue(async () => {
          if (!doc || doc.readOnly) return;
          const before = doc.text;
          if (open || cell) await closeBlock({ render: false, cleanup: false });
          if (text !== before) { hist.record(before, text, lastSel, null); lastText = text; doc.setText(text, 'inline'); }
          await renderDoc();
          if (target && target.row != null) {
            const s = tableSegAt(target.line);
            if (s && target.select) {
              // Inline mode selects rows and tables in their Markdown
              const { st, en } = segRange(doc.text, s); let a = 0, b = en - st;
              if (target.select === 'row') { const r = app.tables.cellRange(doc.text, target.line, target.row, 0); if (r) { a = lineStartOf(doc.text, r.start) - st; b = lineEndOf(doc.text, r.start) - st; } }
              openSeg(s, a, b, { source: true });
            } else if (s) openCellAt(s, target.row, target.col ?? 0, 'start');
          } else if (target && target.line != null) {
            const off = offsetOfLine(doc.text, target.line); lastSel = { start: off, end: off };
            const s = segForLine(target.line); kbd = s ? s.index : -1; markKbd(); root?.focus({ preventScroll: true });
          }
          emitSel();
        });
      },
      async selectionLines() {
        if (cell || !doc) return null;
        await chain;
        const s = docSel(); if (!s) return null;
        let e = s.end; if (e > s.start && doc.text[e - 1] === String.fromCharCode(10)) e--;
        return { from: lineOfOffset(doc.text, s.start), to: lineOfOffset(doc.text, e) + 1 };
      },
    };
    function applyHistory(r, emptyMsg) {
      if (!doc) return;
      if (!r) { if (emptyMsg) app.ui.toast?.(emptyMsg); return; }
      if (open && open.base == null) {
        const pre = open.start, sufLen = doc.text.length - (open.start + open.len);
        if (r.text.length >= pre + sufLen && r.text.slice(0, pre) === doc.text.slice(0, pre) && r.text.slice(r.text.length - sufLen) === doc.text.slice(doc.text.length - sufLen)) {
          const nvRaw = r.text.slice(pre, r.text.length - sufLen), nv = nvRaw.replace(/\r\n/g, '\n');
          paint(nv); open.len = nvRaw.length;
          setEdSel(clamp(r.sel.start - pre, 0, nv.length), clamp(r.sel.end - pre, 0, nv.length));
          lastText = r.text; doc.setText(r.text, 'inline'); emitSel(); revealCaret();
          return;
        }
      }
      lastText = r.text; doc.setText(r.text, 'inline');
      return queue(async () => { if (open || cell) await closeBlock({ render: false, cleanup: false }); await renderDoc(); openAtDoc(r.sel.start, r.sel.end); });
    }
    return adapter;
  }

  E.createInline = createInlineEditor;
  app.editors.register('inline', createInlineEditor());

  // =================================================================== smoke tests
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function until(fn, ms = 3000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch {} await sleep(20); } return false; }
  function offscreen() {
    if (E._offscreen) return E._offscreen();
    const h = document.createElement('div'); h.style.cssText = 'position:fixed;left:-12000px;top:0;width:1100px;height:700px;overflow:auto'; document.body.appendChild(h); return h;
  }
  const fake = t => (E.fakeDoc ? E.fakeDoc(t) : { id: 'x', text: t, kind: 'markdown', meta: {}, setText(x) { this.text = x; } });
  async function withInline(src, fn) {
    const host = offscreen(); host.style.overflow = 'auto'; const ed = createInlineEditor(); const d = fake(src);
    try { ed.mount(host, d); await ed.whenIdle(); await until(() => ed.page && ed.page.querySelector('[data-line], .mk-front')); return await fn(ed, d, host); }
    finally { ed.unmount(); host.remove(); }
  }

  app.tests.register('modes: typing AutoCorrect and smart quotes', () => {
    const c = (b, o) => { const r = T.correct(b, { smartQuotes: true, autocorrect: true, ...o }); return r ? b.slice(0, b.length - r.remove) + r.insert : b; };
    const A = app.assert;
    A(c('a "') === 'a “', 'opening double quote');
    A(c('a “b"') === 'a “b”', 'closing double quote');
    A(c("don'") === 'don’', 'apostrophe');
    A(c('word --b') === 'word –b', 'en dash: ' + c('word --b'));
    A(c('word ---b') === 'word —b', 'em dash');
    A(c('--x') === '--x' && c('<!--x') === '<!--x' && c('a -->') === 'a -->', 'rules, comments untouched');
    A(c('| --- |x') === '| --- |x', 'table separator untouched');
    A(c('Copyright (c)') === 'Copyright ©' && c('(tm)') === '™' && c('(R)') === '®', '(c) (tm) (r)');
    A(c('[x](c)') === '[x](c)', 'link target untouched');
    A(c('Wait...') === 'Wait…', 'ellipsis');
    A(c('a "', { smartQuotes: false }) === 'a "', 'smart quotes can be turned off');
    A(c('a --b', { autocorrect: false }) === 'a --b', 'AutoCorrect can be turned off');
    A(T.mdContext('use `a "') === 'code' && T.mdContext('$x "') === 'math' && T.mdContext('<div align="') === 'html' && T.mdContext('[a](b "') === 'url' && T.mdContext('Hello "') === 'text', 'Markdown contexts');
    A(T.correct('`x "', { context: T.mdContext('`x ') }) === null, 'no smart quotes in code');
  });

  app.tests.register('modes: undo history stores diffs', () => {
    const h = T.createHistory();
    h.record('abc', 'abXc', { start: 2, end: 2 }, { start: 3, end: 3 });
    h.record('abXc', 'abXYc', { start: 3, end: 3 }, { start: 4, end: 4 });
    let r = h.undo('abXYc'); app.assert(r && r.text === 'abXc' && r.sel.start === 3, 'undo 1: ' + JSON.stringify(r));
    r = h.undo(r.text); app.assert(r && r.text === 'abc', 'undo 2');
    r = h.redo('abc'); app.assert(r && r.text === 'abXc' && r.sel.start === 3, 'redo');
    app.assert(T.mapOffset('foo\n\nbar', 'foo!\n\nbar', 5) === 6 && T.mapOffset('foo\n\nbar', 'foo!\n\nbar', 1) === 1, 'mapOffset');
  });

  app.tests.register('modes: hidden notes render faint, round-trip in Word mode, stripped for export', async () => {
    const r = await app.render('Visible %%secret *note*%% text.\n\n`%%code%%`', {});
    const box = document.createElement('div'); box.innerHTML = r.html; document.body.appendChild(box);
    try {
      await app.decorate(box, null);
      const n = box.querySelector('.mk-note');
      app.assert(n && /secret/.test(n.textContent) && n.querySelectorAll('.mk-note-mark').length === 2, 'note wrapped: ' + box.innerHTML);
      app.assert(!box.querySelector('code .mk-note') && /%%code%%/.test(box.querySelector('code').textContent), 'code untouched');
    } finally { box.remove(); }
    app.assert(app.notes.strip('A %%x%% B\n\n```\n%%keep%%\n```') === 'A  B\n\n```\n%%keep%%\n```', 'strip: ' + JSON.stringify(app.notes.strip('A %%x%% B\n\n```\n%%keep%%\n```')));
    app.assert(app.notes.strip('A <!-- comment: c --> B', { comments: true }) === 'A  B', 'strip comments');
    if (E._fullRoundTrip) {
      for (const src of ['Text %%hidden note%% more.', 'A %%note with **bold**%% here.\n\nAnd %%another%%.']) {
        const { kept, converted } = await E._fullRoundTrip(src);
        app.assert(kept === src, 'Word keeps the source: ' + JSON.stringify(kept));
        app.assert(converted.replace(/\n$/, '') === src, 'Word writes the note back: ' + JSON.stringify(converted));
      }
      const block = '%%\nWhole hidden paragraph\n%%\n\nAfter.';
      app.assert((await E._fullRoundTrip(block)).kept === block, 'Word keeps a hidden paragraph');
    }
  });

  app.tests.register('modes: Word mode AutoCorrect and per-keystroke undo', async () => {
    if (!E.createWord || !E.fakeDoc) return;
    const host = offscreen(); const ed = E.createWord(); const d = E.fakeDoc('Say hi');
    try {
      ed.mount(host, d);
      await until(() => ed.page && ed.page.querySelector('p'));
      await sleep(60);
      T.attachWordPage(ed.page, ed);
      const t = ed.page.querySelector('p').firstChild;
      ed.page.focus(); const r = document.createRange(); r.setStart(t, t.data.length); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r);
      document.execCommand('insertText', false, ' ');
      document.execCommand('insertText', false, '"');
      await sleep(30); ed.flush?.(); ed._commit?.();
      app.assert(/^Say hi[  ]“$/.test(d.text), 'smart quote in Word mode: ' + JSON.stringify(d.text));
      ed.undo();
      app.assert(/^Say hi[  ]"$/.test(d.text), 'Ctrl+Z undoes only the AutoCorrect: ' + JSON.stringify(d.text));
      ed.undo();
      app.assert(/^Say hi[  ]?$/.test(d.text), 'one more Ctrl+Z undoes one keystroke: ' + JSON.stringify(d.text));
    } finally { ed.unmount(); host.remove(); }
  });

  app.tests.register('modes: Inline shows the Markdown of the clicked block and renders it again on leave', async () => {
    await withInline('# Title\n\nSome **bold** text.\n\nSecond para.', async (ed, d) => {
      app.assert(ed.page.querySelector('h1') && ed.page.querySelector('strong'), 'renders like the finished page');
      const p = [...ed.page.querySelectorAll('p')].find(x => /Some/.test(x.textContent));
      const strong = p.querySelector('strong').firstChild;
      const r = document.createRange(); r.setStart(strong, 2); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r);
      p.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: -1, clientY: -1 }));
      await ed.whenIdle();
      const ob = ed.openBlock; app.assert(ob && ob.text === 'Some **bold** text.', 'block source shown: ' + JSON.stringify(ob && ob.text));
      app.assert(ed.page.querySelector('.mk-il-edit .t-mk'), 'markers highlighted');
      ed._typeText('!');
      app.assert(d.text === '# Title\n\nSome **bold** text.!\n\nSecond para.' || /Some \*\*bo.*!/.test(d.text), 'typing reaches the source: ' + JSON.stringify(d.text));
      await ed.close(); await ed.whenIdle();
      app.assert(!ed.page.querySelector('.mk-il-edit') && /!/.test(ed.page.textContent) && ed.page.querySelector('strong'), 'rendered again after leaving');
    });
  });

  app.tests.register('modes: Inline Enter splits a paragraph, formatting and per-keystroke undo work', async () => {
    await withInline('Hello world\n\nNext.', async (ed, d) => {
      await ed.setSelection(5, 5); await ed.whenIdle();
      app.assert(ed.openBlock && ed.openBlock.text === 'Hello world', 'opened by setSelection');
      ed._enter(false); await ed.whenIdle();
      app.assert(d.text === 'Hello\n\nworld\n\nNext.', 'split: ' + JSON.stringify(d.text));
      app.assert(ed.openBlock && ed.openBlock.text === 'world' && ed.openBlock.sel.s === 0, 'caret in the new paragraph: ' + JSON.stringify(ed.openBlock));
      await ed.setSelection(7, 12); await ed.whenIdle();
      await ed.format('bold');
      app.assert(d.text === 'Hello\n\n**world**\n\nNext.', 'bold: ' + JSON.stringify(d.text));
      await ed.format('h2');
      app.assert(d.text === 'Hello\n\n## **world**\n\nNext.', 'heading: ' + JSON.stringify(d.text));
      await ed.undo(); app.assert(d.text === 'Hello\n\n**world**\n\nNext.', 'undo heading');
      await ed.undo(); app.assert(d.text === 'Hello\n\nworld\n\nNext.', 'undo bold');
      await ed.redo(); app.assert(d.text === 'Hello\n\n**world**\n\nNext.', 'redo bold');
      // per keystroke: two characters are two undo steps; AutoCorrect is its own step
      const p0 = d.text.length - 'Next.'.length; await ed.setSelection(p0 + 5, p0 + 5); await ed.whenIdle();
      ed._typeText(' '); ed._typeText('-'); ed._typeText('-'); ed._typeText('x');
      app.assert(/Next\. –x$/.test(d.text), 'dash corrected: ' + JSON.stringify(d.text));
      await ed.undo(); app.assert(/Next\. --x$/.test(d.text), 'undo AutoCorrect: ' + JSON.stringify(d.text));
      await ed.undo(); app.assert(/Next\. --$/.test(d.text), 'undo one keystroke: ' + JSON.stringify(d.text));
    });
  });

  app.tests.register('modes: Inline new paragraph after the last block, front matter and lists', async () => {
    await withInline('---\ntitle: T\n---\n\n- one', async (ed, d) => {
      const segs = ed._segments();
      app.assert(segs[0].kind === 'front' && segs[0].start === 0 && segs[0].end === 3 && segs[1].kind === 'list' && segs[1].start === 4, 'segments: ' + JSON.stringify(segs));
      await ed.setSelection(d.text.length, d.text.length); await ed.whenIdle();
      ed._enter(false);
      app.assert(d.text === '---\ntitle: T\n---\n\n- one\n- ', 'list continues: ' + JSON.stringify(d.text));
      ed._enter(false); await ed.whenIdle();
      app.assert(d.text === '---\ntitle: T\n---\n\n- one', 'empty item ends the list: ' + JSON.stringify(d.text));
      app.assert(ed.openBlock && ed.openBlock.virtual, 'a new paragraph waits below the list');
      ed._typeText('After');
      app.assert(d.text === '---\ntitle: T\n---\n\n- one\n\nAfter', 'typed after the list: ' + JSON.stringify(d.text));
      await ed.close(); await ed.whenIdle();
      app.assert([...ed.page.querySelectorAll('p')].some(p => p.textContent === 'After'), 'rendered');
    });
  });

  app.tests.register('modes: Inline adapter is registered and the mode switch works', async () => {
    app.assert(app.editors.get('inline') && typeof app.editors.get('inline').format === 'function', 'inline adapter registered');
    const prev = app.mode;
    const ok = app.setMode('inline');
    try {
      app.assert(ok !== false && app.mode === 'inline' && app.editors.active() === app.editors.get('inline'), 'app.setMode("inline") selects the Inline editor (core must accept it)');
    } finally { app.setMode(prev); }
  });
})();
