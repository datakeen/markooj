// Markooj — tables like Word: pipe-table engine, Insert → Table picker, Table Design / Table Layout tabs,
// right-click menu, gridlines, Simple-mode Tab and Format Table, table styles.
//
// app.tables (engine; every edit is a source edit, so the rest of the document stays byte-identical):
//   find(text, line) → {start, end, prefix} | null      lines of the GFM table that holds `line` (end exclusive)
//   parse(text, line) → model | null                     {prefix, header[], align[], rows[][], pretty, equal, start, end}
//   serialize(model, {pretty}) → string[]                lines (with the blockquote/indent prefix)
//   cellAt(text, offset) → {line, row, col, start, end}  the cell under a source offset (row 0 = header row)
//   cellRange(text, line, row, col) → {start, end}       source offsets of a cell's content
//   apply(text, line, op, args) → {text, line, row, col, deleted, start, end}
//        ops: rowAbove rowBelow colLeft colRight deleteRow deleteCol deleteTable align{value} header sort{dir}
//             setCell{text} clear{cells} format distribute toText{sep}
//   fromText(lines, {sep, header}) → string[]            "Convert Text to Table"
//   make(rows, cols) → string                            a new table
//   escapeCell(s), unescapeCell(s)
//   sourceTab(simpleAdapter, back) → boolean             Simple mode Tab / Shift+Tab in a pipe table
//   contextMenu(anchor), insertPicker(anchor), styles, style(doc)
//
// Editors implement (feature-detected here): tableAt() → {line, row, col}, applyTableEdit(text, target),
// selectTableCells(kind), selectionLines() → {from, to}.
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const E = app.editor = app.editor || {};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TB = app.tables = app.tables || {};

  // the stylesheet normally comes from index.html; load it here if it is missing
  try {
    if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(l => /tables\.css/.test(l.getAttribute('href') || ''))) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'tables.css'; document.head.appendChild(l);
    }
  } catch {}

  // =================================================================== engine (pure functions)
  // display width: wide East Asian characters and emoji count 2, combining marks 0
  function width(s) {
    let n = 0;
    for (const ch of String(s)) {
      const c = ch.codePointAt(0);
      if ((c >= 0x300 && c <= 0x36f) || c === 0x200b || c === 0x200d || (c >= 0xfe00 && c <= 0xfe0f)) continue;
      n += (c >= 0x1100 && (c <= 0x115f || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) ||
        (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6) || (c >= 0x1f300 && c <= 0x1faff) || (c >= 0x20000 && c <= 0x3fffd))) ? 2 : 1;
    }
    return n;
  }
  const PREFIX = /^(?:[ \t]{0,3}>[ \t]?)*[ \t]*/;
  const strip = line => line.replace(PREFIX, '');
  const quotes = l => (((PREFIX.exec(l) || [''])[0]).match(/>/g) || []).length;
  const hasPipe = s => /(^|[^\\])\|/.test(s);
  /** Cells of one row, as typed (escapes kept, outer spaces trimmed). */
  function splitRow(s) {
    let t = String(s).trim();
    if (t.startsWith('|')) t = t.slice(1);
    if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
    const out = []; let cur = '';
    for (let i = 0; i < t.length; i++) { const ch = t[i]; if (ch === '|' && t[i - 1] !== '\\') { out.push(cur.trim()); cur = ''; } else cur += ch; }
    out.push(cur.trim());
    return out;
  }
  const isDelim = s => hasPipe(s) && splitRow(s).every(c => /^:?-+:?$/.test(c));
  const alignOf = c => (/^:.*:$/.test(c) ? 'center' : /^:/.test(c) ? 'left' : /:$/.test(c) ? 'right' : null);
  const CAPTION = /^(Table:|table:|:)[ \t]+\S/;

  function linesOf(text) { return String(text).split('\n'); }
  const raw = l => (l == null ? '' : l.replace(/\r$/, ''));

  /** Is line `at` inside a ``` / ~~~ code fence or a $$ math block? */
  function inFence(lines, at) {
    let fence = null, math = false;
    for (let i = 0; i < at; i++) {
      const l = strip(raw(lines[i]));
      if (fence) { const f = /^\s{0,3}(`{3,}|~{3,})\s*$/.exec(l); if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null; continue; }
      if (math) { if (/\$\$\s*(\{[^}]*\})?\s*$/.test(l)) math = false; continue; }
      const f = /^\s{0,3}(`{3,}|~{3,})/.exec(l); if (f) { fence = f[1]; continue; }
      if (/^\s{0,3}\$\$/.test(l) && !/^\s{0,3}\$\$.*\S.*\$\$/.test(l)) math = true;
    }
    return !!(fence || math);
  }
  /** Lines [start, end) of the pipe table that holds line `at`, or null. */
  function findInLines(lines, at) {
    if (at < 0 || at >= lines.length) return null;
    const q = quotes(raw(lines[at]));
    const body = i => strip(raw(lines[i]));
    const rowish = i => i >= 0 && i < lines.length && quotes(raw(lines[i])) === q && body(i).trim() && hasPipe(body(i)) && !/^\s{0,3}(`{3,}|~{3,})/.test(body(i));
    if (!rowish(at)) return null;
    if (inFence(lines, at)) return null;
    let top = at; while (rowish(top - 1)) top--;
    let header = -1;
    for (let d = top + 1; d < lines.length && rowish(d); d++) {
      if (isDelim(body(d)) && splitRow(body(d - 1)).length === splitRow(body(d)).length) { header = d - 1; break; }
    }
    if (header < 0 || at < header) return null;
    let end = header + 2;
    while (end < lines.length && rowish(end) && !CAPTION.test(body(end).trim())) end++;
    if (at >= end) return null;
    return { start: header, end, prefix: (PREFIX.exec(raw(lines[header])) || [''])[0] };
  }
  TB.find = (text, line) => findInLines(linesOf(text), line);
  /** Find the table whose header is at `line`, or the nearest one starting at most a few lines below (captions). */
  function findNear(lines, line) {
    for (let k = line; k < Math.min(lines.length, line + 4); k++) { const f = findInLines(lines, k); if (f) return f; }
    return null;
  }

  function parseLines(lines, f) {
    const body = i => strip(raw(lines[i]));
    const header = splitRow(body(f.start));
    const delim = splitRow(body(f.start + 1));
    const rows = []; for (let i = f.start + 2; i < f.end; i++) rows.push(splitRow(body(i)));
    const all = []; for (let i = f.start; i < f.end; i++) all.push(body(i).replace(/\s+$/, ''));
    const pretty = all.length >= 2 && all.every(l => l.startsWith('|') && l.endsWith('|') && width(l) === width(all[0]));
    const dl = delim.map(c => c.length);
    return {
      prefix: f.prefix, header, align: delim.map(alignOf), rows, pretty,
      equal: pretty && dl.length > 1 && dl.every(x => x === dl[0]), start: f.start, end: f.end,
    };
  }
  TB.parse = (text, line) => { const lines = linesOf(text); const f = findNear(lines, line); return f ? parseLines(lines, f) : null; };

  const ncols = m => Math.max(1, m.header.length);
  function serialize(m, opts = {}) {
    const pretty = opts.pretty ?? m.pretty;
    const n = ncols(m);
    const rows = [m.header, ...m.rows].map(r => { const x = r.slice(); while (x.length < n) x.push(''); return x; });
    const al = Array.from({ length: n }, (_, i) => m.align[i] || null);
    let w = Array.from({ length: n }, (_, i) => Math.max(3, ...rows.map(r => width(r[i] || ''))));
    if (m.equal && pretty) { const mx = Math.max(...w); w = w.map(() => mx); }
    const pad = (s, i) => {
      if (!pretty) return s;
      const p = w[i] - width(s); if (p <= 0) return s;
      if (al[i] === 'right') return ' '.repeat(p) + s;
      if (al[i] === 'center') { const l = p >> 1; return ' '.repeat(l) + s + ' '.repeat(p - l); }
      return s + ' '.repeat(p);
    };
    const line = r => '| ' + r.map((s, i) => (i < n ? pad(s, i) : s)).join(' | ') + ' |';
    const dash = i => {
      const a = al[i];
      if (!pretty) return a === 'left' ? ':---' : a === 'right' ? '---:' : a === 'center' ? ':---:' : '---';
      const len = w[i];
      if (a === 'left') return ':' + '-'.repeat(len - 1);
      if (a === 'right') return '-'.repeat(len - 1) + ':';
      if (a === 'center') return ':' + '-'.repeat(len - 2) + ':';
      return '-'.repeat(len);
    };
    const out = [line(rows[0]), '| ' + al.map((_, i) => dash(i)).join(' | ') + ' |', ...rows.slice(1).map(line)];
    return out.map(l => m.prefix + l);
  }
  TB.serialize = serialize;

  TB.escapeCell = s => String(s ?? '').replace(/\r?\n/g, '<br>').replace(/\\?\|/g, m => (m === '|' ? '\\|' : m)).trim();
  TB.unescapeCell = s => String(s ?? '').replace(/\\\|/g, '|');
  TB.make = (rows, cols) => {
    rows = Math.max(1, rows | 0); cols = Math.max(1, cols | 0);
    const m = { prefix: '', header: Array.from({ length: cols }, (_, i) => 'Column ' + (i + 1)), align: [], rows: Array.from({ length: Math.max(1, rows - 1) }, () => Array(cols).fill('')), pretty: false };
    return serialize(m).join('\n');
  };

  /** Offsets (in the whole text) where each line starts. */
  function lineStarts(lines) { const s = [0]; for (let i = 0; i < lines.length - 1; i++) s.push(s[i] + lines[i].length + 1); return s; }
  /** Cell content spans [{start, end}] inside one row line (offsets in that line). */
  function cellSpans(lineText) {
    const off = (PREFIX.exec(lineText) || [''])[0].length;
    const t = lineText.replace(/\r$/, '');
    const bars = []; for (let i = off; i < t.length; i++) if (t[i] === '|' && t[i - 1] !== '\\') bars.push(i);
    const firstChar = t.slice(off).search(/\S/) + off;
    const lead = t[firstChar] === '|';
    const trail = bars.length && bars[bars.length - 1] === t.replace(/\s+$/, '').length - 1 && !(lead && bars.length === 1);
    const edges = [lead ? bars[0] : firstChar - 1, ...bars.slice(lead ? 1 : 0, trail ? -1 : undefined), trail ? bars[bars.length - 1] : t.length];
    const spans = [];
    for (let k = 0; k + 1 < edges.length; k++) {
      let a = edges[k] + 1, b = edges[k + 1];
      while (a < b && /\s/.test(t[a])) a++;
      while (b > a && /\s/.test(t[b - 1])) b--;
      if (a === b) a = b = Math.min(edges[k] + 2, edges[k + 1]); // empty cell: right after "| "
      spans.push({ start: a, end: b, gapStart: edges[k] + 1, gapEnd: edges[k + 1] });
    }
    return spans;
  }
  TB.cellAt = (text, offset) => {
    const lines = linesOf(text); const st = lineStarts(lines);
    let ln = 0; while (ln + 1 < st.length && st[ln + 1] <= offset) ln++;
    const f = findInLines(lines, ln); if (!f) return null;
    const lineRow = ln === f.start + 1 ? f.start : ln; // the delimiter row counts as the header row
    const row = lineRow === f.start ? 0 : lineRow - f.start - 1;
    const spans = cellSpans(lines[lineRow]); const n = splitRow(strip(raw(lines[f.start]))).length;
    let col = 0;
    if (ln === lineRow) { const p = offset - st[ln]; for (let k = 1; k < spans.length; k++) if (p >= spans[k].gapStart) col = k; }
    col = Math.max(0, Math.min(n - 1, col));
    const sp = spans[col] || { start: 0, end: 0 };
    return { line: f.start, row, col, start: st[lineRow] + sp.start, end: st[lineRow] + sp.end, tableStart: st[f.start], tableEnd: st[f.end - 1] + lines[f.end - 1].replace(/\r$/, '').length, cols: n, rows: f.end - f.start - 1 };
  };
  TB.cellRange = (text, line, row, col) => {
    const lines = linesOf(text); const f = findNear(lines, line); if (!f) return null;
    const st = lineStarts(lines);
    const nRows = f.end - f.start - 1;
    row = Math.max(0, Math.min(nRows - 1, row));
    const ln = row === 0 ? f.start : f.start + 1 + row;
    const spans = cellSpans(lines[ln]);
    const sp = spans[Math.max(0, Math.min(spans.length - 1, col))] || { start: 0, end: 0 };
    return { start: st[ln] + sp.start, end: st[ln] + sp.end, line: f.start };
  };

  // ---------- operations on a model: each returns the cell to land in ({row, col}) or null (table removed)
  const blankRow = n => Array(n).fill('');
  function insertCol(m, at) { [m.header, ...m.rows].forEach(r => { while (r.length < at) r.push(''); r.splice(at, 0, ''); }); m.align.splice(at, 0, null); }
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const plainCell = s => TB.unescapeCell(s).replace(/<br>/g, ' ').replace(/\*\*|__|~~|==|`/g, '').replace(/(^|\W)[*_](\S)/g, '$1$2').replace(/(\S)[*_](\W|$)/g, '$1$2').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
  function numberOf(s) {
    const t = plainCell(s).replace(/[\s,]/g, '').replace(/^[$€£¥₹]|%$/g, '').replace(/^−/, '-');
    return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t) ? parseFloat(t) : NaN;
  }
  const OPS = {
    rowAbove(m, a) { const n = ncols(m); if (a.row === 0) { m.rows.unshift(m.header); m.header = blankRow(n); return { row: 0, col: a.col }; } m.rows.splice(a.row - 1, 0, blankRow(n)); return { row: a.row, col: a.col }; },
    rowBelow(m, a) { m.rows.splice(a.row, 0, blankRow(ncols(m))); return { row: a.row + 1, col: a.col }; },
    colLeft(m, a) { insertCol(m, a.col); return { row: a.row, col: a.col }; },
    colRight(m, a) { insertCol(m, a.col + 1); return { row: a.row, col: a.col + 1 }; },
    deleteRow(m, a) {
      if (a.row === 0) { if (!m.rows.length) return null; m.header = m.rows.shift(); return { row: 0, col: a.col }; }
      m.rows.splice(a.row - 1, 1); return { row: Math.min(a.row, m.rows.length), col: a.col };
    },
    deleteCol(m, a) { if (ncols(m) <= 1) return null; [m.header, ...m.rows].forEach(r => r.splice(a.col, 1)); m.align.splice(a.col, 1); return { row: a.row, col: Math.min(a.col, ncols(m) - 1) }; },
    deleteTable() { return null; },
    align(m, a) { const v = a.value === 'none' ? null : a.value; while (m.align.length < ncols(m)) m.align.push(null); m.align[a.col] = v || null; return { row: a.row, col: a.col }; },
    header(m, a) {
      const has = m.header.some(c => c.trim());
      if (has) { m.rows.unshift(m.header); m.header = blankRow(ncols(m)); return { row: a.row + 1, col: a.col }; }
      if (!m.rows.length) return { row: 0, col: a.col };
      m.header = m.rows.shift(); while (m.header.length < ncols(m)) m.header.push('');
      return { row: Math.max(0, a.row - 1), col: a.col };
    },
    sort(m, a) {
      const dir = a.dir === 'desc' ? -1 : 1, c = a.col;
      const key = r => r[c] ?? '';
      const idx = m.rows.map((r, i) => ({ r, i }));
      idx.sort((x, y) => {
        const p = key(x.r), q = key(y.r);
        if (!p.trim() || !q.trim()) return (!p.trim() - !q.trim()) || x.i - y.i; // empty cells go last
        const u = numberOf(p), v = numberOf(q);
        let d;
        if (!isNaN(u) && !isNaN(v)) d = u - v;
        else if (!isNaN(u)) d = -1; else if (!isNaN(v)) d = 1;
        else d = collator.compare(plainCell(p), plainCell(q));
        return d * dir || x.i - y.i;
      });
      m.rows = idx.map(x => x.r);
      return { row: a.row, col: a.col };
    },
    setCell(m, a) {
      const r = a.row === 0 ? m.header : m.rows[a.row - 1]; if (!r) return { row: a.row, col: a.col };
      while (r.length <= a.col) r.push('');
      r[a.col] = TB.escapeCell(a.text); return { row: a.row, col: a.col };
    },
    clear(m, a) { for (const [r, c] of a.cells || []) { const row = r === 0 ? m.header : m.rows[r - 1]; if (row && c < row.length) row[c] = ''; } return { row: a.row, col: a.col }; },
    // cells from Word / Excel written over the table from the caret cell on, like Excel (rows and columns are added as needed)
    paste(m, a) {
      const cells = (a.cells || []).filter(r => r && r.length); if (!cells.length) return { row: a.row, col: a.col };
      const want = a.col + Math.max(...cells.map(r => r.length));
      while (ncols(m) < want) insertCol(m, ncols(m));
      for (let r = 0; r < cells.length; r++) {
        const ri = a.row + r;
        while (ri > m.rows.length) m.rows.push(blankRow(ncols(m)));
        const row = ri === 0 ? m.header : m.rows[ri - 1];
        while (row.length < ncols(m)) row.push('');
        cells[r].forEach((c, k) => { row[a.col + k] = String(c ?? ''); });
      }
      return { row: a.row + cells.length - 1, col: a.col + cells[cells.length - 1].length - 1 };
    },
    format(m, a) { m.pretty = true; return { row: a.row, col: a.col }; },
    distribute(m, a) { m.pretty = true; m.equal = true; return { row: a.row, col: a.col }; },
  };
  TB.ops = Object.keys(OPS).concat(['toText']);

  function replaceLines(text, from, to, newLines) {
    const lines = linesOf(text);
    const cr = from < lines.length && /\r$/.test(lines[from]) ? '\r' : (/\r\n/.test(text) ? '\r' : '');
    lines.splice(from, to - from, ...newLines.map(l => l + cr));
    return lines.join('\n');
  }
  TB.replaceLines = replaceLines;

  /** Apply one operation to the table at `line`. Returns the new text and where the caret should go. */
  TB.apply = (text, line, op, args = {}) => {
    const lines = linesOf(text);
    const f = findNear(lines, line); if (!f) return null;
    const m = parseLines(lines, f);
    const a = { row: 0, col: 0, ...args };
    a.row = Math.max(0, Math.min(m.rows.length, a.row)); a.col = Math.max(0, Math.min(ncols(m) - 1, a.col));
    if (op === 'toText') {
      const out = toText(m, a.sep || 'tab');
      const nt = replaceLines(text, f.start, f.end, out);
      return { text: nt, line: f.start, row: null, col: null, deleted: true, start: f.start, end: f.start + out.length };
    }
    const fn = OPS[op]; if (!fn) throw new Error('Unknown table operation: ' + op);
    const target = fn(m, a);
    if (!target) {
      const ls = linesOf(text); ls.splice(f.start, f.end - f.start);
      // no double blank line where the table was
      if (f.start > 0 && f.start < ls.length && !raw(ls[f.start - 1]).trim() && !raw(ls[f.start]).trim()) ls.splice(f.start, 1);
      return { text: ls.join('\n'), line: Math.min(f.start, ls.length - 1), row: null, col: null, deleted: true, start: f.start, end: f.start };
    }
    const out = serialize(m);
    return { text: replaceLines(text, f.start, f.end, out), line: f.start, row: target.row, col: target.col, deleted: false, start: f.start, end: f.start + out.length };
  };

  function toText(m, sep) {
    const P = m.prefix, blank = P.replace(/[ \t]+$/, '');
    const rows = [m.header, ...m.rows].filter((r, i) => i > 0 || r.some(c => c.trim())).map(r => r.map(c => TB.unescapeCell(c)));
    if (sep === 'para') return rows.flatMap(r => r.filter(c => c.trim())).flatMap((c, i) => (i ? [blank, P + c] : [P + c]));
    const s = sep === 'comma' ? ', ' : sep === 'semicolon' ? '; ' : '\t';
    return rows.flatMap((r, i) => (i ? [blank, P + r.join(s).replace(/\s+$/, '')] : [P + r.join(s).replace(/\s+$/, '')]));
  }
  TB.toText = (m, sep) => toText(m, sep);

  function splitCsv(line, sep) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; continue; }
      if (ch === '"' && !cur.trim()) { q = true; cur = ''; continue; }
      if (line.startsWith(sep, i)) { out.push(cur); cur = ''; i += sep.length - 1; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim());
  }
  TB.guessSeparator = (lines) => {
    const ls = lines.filter(l => l.trim());
    if (ls.some(l => l.includes('\t'))) return 'tab';
    const count = (ch) => ls.every(l => splitCsv(l, ch).length > 1);
    if (count(',')) return 'comma';
    if (count(';')) return 'semicolon';
    if (ls.every(l => hasPipe(l))) return 'pipe';
    if (ls.every(l => / {2,}\S/.test(l.trim()))) return 'spaces';
    return 'comma';
  };
  /** Text lines → pipe-table lines. sep: tab | comma | semicolon | pipe | spaces | any other string. */
  TB.fromText = (lines, { sep = 'auto', header = true, prefix } = {}) => {
    let ls = lines.map(raw);
    const P = prefix ?? (ls.find(l => l.trim()) ? (PREFIX.exec(ls.find(l => l.trim())) || [''])[0] : '');
    ls = ls.map(l => strip(l)).filter(l => l.trim());
    if (!ls.length) return null;
    if (sep === 'auto') sep = TB.guessSeparator(ls);
    const S = { tab: '\t', comma: ',', semicolon: ';' }[sep] ?? sep;
    const cells = ls.map(l => {
      if (sep === 'pipe') return splitRow(l);
      if (sep === 'spaces') return l.trim().split(/ {2,}|\t/).map(s => s.trim());
      return splitCsv(l, S);
    }).map(r => r.map(c => TB.escapeCell(c)));
    const n = Math.max(...cells.map(r => r.length));
    const pad = r => { const x = r.slice(); while (x.length < n) x.push(''); return x; };
    const m = { prefix: P, header: header ? pad(cells[0]) : blankRow(n), align: [], rows: (header ? cells.slice(1) : cells).map(pad), pretty: false };
    return serialize(m);
  };

  // =================================================================== editor glue
  const edNow = () => (E.target ? E.target() : app.editors.active());
  const modeOf = e => e?.name || app.mode;
  const editable = () => { if (E.testTarget) return true; const d = app.docs.active(); return !!(d && d.kind === 'markdown' && !d.readOnly && app.editors.active() && app.mode !== 'read'); };
  const toast = (m, o) => app.ui?.toast?.(m, o);

  /** Cheap check for the ribbon: is the caret in a table right now? */
  function inTableNow(e = edNow()) {
    if (!e) return false;
    const mode = modeOf(e);
    if (mode === 'simple') {
      const ta = e.textarea; if (!ta) return false;
      const v = ta.value, s = ta.selectionStart; const ls = v.lastIndexOf('\n', s - 1) + 1; let le = v.indexOf('\n', s); if (le < 0) le = v.length;
      if (!hasPipe(v.slice(ls, le))) return false;
      return !!TB.cellAt(v, s);
    }
    if (typeof e.inTable === 'function') return !!e.inTable();
    const s = getSelection(); if (!s.rangeCount) return false;
    const n = s.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement);
    const page = e.getSurface?.() || e.page;
    return !!(el && page && page.contains(el) && el.closest('td,th'));
  }
  TB.inTable = () => inTableNow();

  /** Where the caret is: {e, mode, text, line, row, col} or null. */
  async function locate(e = edNow()) {
    if (!e) return null;
    const mode = modeOf(e);
    if (mode === 'simple') {
      const ta = e.textarea; if (!ta) return null;
      const c = TB.cellAt(ta.value, ta.selectionStart); if (!c) return null;
      return { e, mode, text: ta.value, line: c.line, row: c.row, col: c.col };
    }
    if (typeof e.tableAt === 'function') {
      const t = await e.tableAt(); if (!t) return null;
      return { e, mode, text: e.doc?.text ?? app.docs.active()?.text ?? '', line: t.line, row: t.row, col: t.col };
    }
    return null;
  }
  TB.locate = locate;

  /** Put a new document text in place and land in `target` ({line, row, col, select}). */
  async function commit(c, newText, target) {
    const e = c.e;
    if (c.mode === 'simple') {
      const ta = e.textarea; const old = ta.value;
      if (newText !== old) {
        // replace only the part that changed (native undo keeps one step)
        let a = 0; while (a < old.length && a < newText.length && old[a] === newText[a]) a++;
        let b = 0; while (b < old.length - a && b < newText.length - a && old[old.length - 1 - b] === newText[newText.length - 1 - b]) b++;
        e.setSelection(a, old.length - b); e.replaceSelection(newText.slice(a, newText.length - b));
      }
      if (target && target.row != null) {
        if (target.select === 'table') { const f = TB.find(ta.value, target.line); if (f) { const ls = lineStarts(linesOf(ta.value)); const end = ls[f.end - 1] + linesOf(ta.value)[f.end - 1].length; e.setSelection(ls[f.start], end); return; } }
        if (target.select === 'row') { const r = TB.cellRange(ta.value, target.line, target.row, 0); if (r) { const ls = ta.value.lastIndexOf('\n', r.start - 1) + 1; let le = ta.value.indexOf('\n', r.start); if (le < 0) le = ta.value.length; e.setSelection(ls, le); return; } }
        const r = TB.cellRange(ta.value, target.line, target.row, target.col);
        if (r) e.setSelection(target.caret === 'end' ? r.end : r.start, r.end);
      } else if (target && target.line != null) {
        const ls = lineStarts(linesOf(ta.value)); e.setSelection(ls[Math.min(target.line, ls.length - 1)] ?? 0);
      }
      return;
    }
    if (typeof e.applyTableEdit === 'function') return e.applyTableEdit(newText, target);
    const d = e.doc || app.docs.active(); if (d && newText !== d.text) d.setText(newText, 'table');
  }
  TB.commit = commit;

  /** Run one table operation where the caret is. */
  async function run(op, args = {}) {
    const c = await locate();
    if (!c) { toast(app.t('Click in a table first.'), { kind: 'info' }); return null; }
    const r = TB.apply(c.text, c.line, op, { row: c.row, col: c.col, ...args });
    if (!r) { toast(app.t('Click in a table first.'), { kind: 'info' }); return null; }
    await commit(c, r.text, r.deleted ? { line: r.line } : { line: r.line, row: r.row, col: r.col, select: args.select });
    try { app.events.emit('table:changed', { op, args, line: r.line }); } catch {}
    return r;
  }
  TB.run = run;

  // ---------- Simple mode: Tab / Shift+Tab move between cells and re-align the pipes
  TB.sourceTab = (e, back) => {
    const ta = e?.textarea; if (!ta) return false;
    const v = ta.value, pos = ta.selectionStart;
    const c = TB.cellAt(v, pos); if (!c) return false;
    const m = TB.parse(v, c.line); if (!m) return false;
    let row = c.row, col = c.col;
    const lastRow = m.rows.length, n = ncols(m);
    let text = v, line = c.line;
    if (!back) {
      if (col + 1 < n) col++;
      else if (row < lastRow) { row++; col = 0; }
      else { const r = TB.apply(v, line, 'rowBelow', { row, col }); text = r.text; row++; col = 0; }
    } else {
      if (col > 0) col--;
      else if (row > 0) { row--; col = n - 1; }
      else return true; // first cell: stay
    }
    // Simple mode always lines the pipes up while you Tab (Format Table)
    const fmt = TB.apply(text, line, 'format', { row, col });
    commit({ e, mode: 'simple', text: v, line }, fmt.text, { line, row, col });
    return true;
  };

  // =================================================================== table styles (front matter `table-style:`)
  const STYLES = [
    { value: 'default', label: app.tm('Plain'), desc: app.tm('Lines under the header and between rows.') },
    { value: 'grid', label: app.tm('Grid'), desc: app.tm('A line around every cell.') },
    { value: 'striped', label: app.tm('Banded rows'), desc: app.tm('Light shading on every other row.') },
    { value: 'academic', label: app.tm('Academic'), desc: app.tm('Three rules (top, under the header, bottom), as in research papers.') },
    { value: 'accent', label: app.tm('Accent'), desc: app.tm('A colored header row.') },
  ];
  TB.styles = STYLES;
  function styleCss(name, sel) {
    const T = `${sel} table`, C = `${T} th, ${T} td`;
    switch (name) {
      case 'grid': return `${T}{border-collapse:collapse}${C}{border:1px solid rgba(128,128,128,.45)}${T} th{border-bottom:1.5px solid currentColor}`;
      case 'striped': return `${T} tbody tr:nth-child(even) td{background-color:rgba(120,120,128,.09)}${C}{border-bottom:0}${T} th{border-bottom:1.5px solid currentColor}`;
      case 'academic': return `${T}{border-top:1.5px solid currentColor;border-bottom:1.5px solid currentColor}${C}{border:0}${T} th{border-bottom:.75px solid currentColor}`;
      case 'accent': return `${T} th{background-color:rgba(10,102,255,.13);border-bottom:1.5px solid #0a66ff}${T} td{border-bottom:.5px solid rgba(128,128,128,.4)}`;
      default: return '';
    }
  }
  TB.styleCss = styleCss;
  TB.style = (doc = app.docs.active()) => {
    if (!doc) return 'default';
    let meta = null;
    try { meta = app.mk?.frontMatter?.parse ? app.mk.frontMatter.parse(doc.text || '').meta : (window.mk?.frontMatter?.parse?.(doc.text || '')?.meta); } catch {}
    const v = String((meta && (meta['table-style'] ?? meta.tableStyle)) || 'default').toLowerCase();
    return STYLES.some(s => s.value === v) ? v : 'default';
  };
  // screen: one stylesheet for every style, picked by an attribute on the page
  (function injectStyleSheet() {
    if (document.getElementById('mk-table-styles')) return;
    const st = document.createElement('style'); st.id = 'mk-table-styles';
    st.textContent = STYLES.filter(s => s.value !== 'default').map(s => styleCss(s.value, `.mk-page[data-mk-tstyle="${s.value}"]`)).join('\n');
    document.head.appendChild(st);
  })();
  function paintStyle() {
    const d = app.docs.active(); const v = TB.style(d);
    document.querySelectorAll('.mk-page:not(.mk-export-stage)').forEach(p => { if (v === 'default') p.removeAttribute('data-mk-tstyle'); else p.setAttribute('data-mk-tstyle', v); });
  }
  let styleTimer = 0; const paintSoon = () => { clearTimeout(styleTimer); styleTimer = setTimeout(paintStyle, 60); };
  ['editor:rendered', 'word:rendered', 'inline:rendered', 'read:rendered', 'doc:active', 'mode:changed', 'mode:shown', 'doc:changed'].forEach(ev => app.events.on(ev, paintSoon));
  // exports (HTML, PDF, print): the same look, without the screen-only attribute
  try { app.exporter?.addCss?.(doc => styleCss(TB.style(doc), '.mk-page')); } catch {}
  // a header row left empty ("Header Row" off) does not show in Read mode, print and exports
  try { app.exporter?.addCss?.('.mk-page table thead:not(:has(th:not(:empty))){display:none}'); } catch {}

  async function setStyle(v) {
    const d = app.docs.active(); if (!d || d.readOnly) return;
    try { edNow()?.flush?.(); } catch {}
    const set = E.setFrontMatter; if (!set) { toast(app.t('Restart Markooj to use table styles. The front matter tools did not load this time.'), { kind: 'warn' }); return; }
    const nt = set(d.text, { 'table-style': !v || v === 'default' ? null : v });
    if (nt !== d.text) d.setText(nt, 'table-style');
    paintSoon();
    toast(app.t('Table style: {style}. It applies to every table in this document and is saved in the front matter.', { style: app.t(STYLES.find(s => s.value === (v || 'default'))?.label || 'Plain') }));
  }
  TB.setStyle = setStyle;

  // =================================================================== gridlines (View → Gridlines; never printed or exported)
  const gridOn = () => app.settings.get('tableGridlines', true) !== false;
  function paintGrid() { document.body.classList.toggle('mk-table-gridlines', gridOn()); }
  paintGrid();
  app.events.on('settings:changed', ({ key } = {}) => { if (key === 'tableGridlines') paintGrid(); });
  app.events.on('ready', paintGrid);

  // =================================================================== icons (24px grid, stroke, mock style)
  const ICONS = {
    'mkt-row-above': '<rect x="3" y="12" width="18" height="8" rx="1.5"/><path d="M12 3v6M9 6h6"/><path d="M12 12v8"/>',
    'mkt-row-below': '<rect x="3" y="4" width="18" height="8" rx="1.5"/><path d="M12 15v6M9 18h6"/><path d="M12 4v8"/>',
    'mkt-col-left': '<rect x="12" y="3" width="8" height="18" rx="1.5"/><path d="M3 12h6M6 9v6"/><path d="M12 12h8"/>',
    'mkt-col-right': '<rect x="4" y="3" width="8" height="18" rx="1.5"/><path d="M15 12h6M18 9v6"/><path d="M4 12h8"/>',
    'mkt-delete': '<rect x="3" y="4" width="13" height="13" rx="1.5"/><path d="M3 10.5h13M9.5 4v13"/><path d="m16 15 5 5M21 15l-5 5"/>',
    'mkt-select': '<path d="M5 3 5 17l4-3.5 3 6.5 2.2-1-3-6.4H17z"/>',
    'mkt-grid': '<rect x="3" y="4" width="18" height="16" rx="1.5" stroke-dasharray="2.2 2.2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16" stroke-dasharray="2 2.2"/>',
    'mkt-sort': '<path d="M7 4v16M4 17l3 3 3-3"/><path d="M13 6h7M13 11h5M13 16h3"/>',
    'mkt-distribute': '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M9 5v14M15 5v14"/><path d="M4.5 12h3M16.5 12h3M10.5 12h3"/>',
    'mkt-header': '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9.5h18"/><path d="M3 4h18v5.5H3z" fill="currentColor" fill-opacity=".25"/>',
    'mkt-totext': '<rect x="3" y="4" width="9" height="9" rx="1"/><path d="M3 8.5h9M7.5 4v9"/><path d="M14 9h3l-1.5-1.5M17 9l-1.5 1.5"/><path d="M14 17h7M3 20h18"/>',
    'mkt-fromtext': '<path d="M3 5h7M3 9h5M3 13h7"/><path d="M11 9h2l-1.2-1.2M13 9l-1.2 1.2"/><rect x="14" y="4" width="7" height="10" rx="1"/><path d="M14 9h7M17.5 4v10"/><path d="M3 18h18"/>',
    'mkt-format': '<path d="M4 5h16M4 10h16M4 15h16M4 20h16"/><path d="M9 3v19M15 3v19" stroke-dasharray="1.5 2"/>',
    'mkt-style': '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M3 14h18" /><path d="M3 9h18v5H3z" fill="currentColor" fill-opacity=".18"/>',
    'mkt-table-props': '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h18M9 4v16"/>',
  };
  (function injectIcons() {
    if (document.getElementById('mk-table-icons')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'mk-table-icons'; svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true'); svg.style.position = 'absolute';
    svg.innerHTML = Object.entries(ICONS).map(([id, p]) => `<symbol id="${id}" viewBox="0 0 24 24">${p}</symbol>`).join('');
    document.body.appendChild(svg);
  })();
  const icon = n => `<svg class="i" viewBox="0 0 24 24"><use href="#${n}"/></svg>`;

  // =================================================================== dialogs and the Insert → Table picker
  const modal = (o) => (E.modal ? E.modal(o) : app.ui.dialog(o));
  function fieldEl(label, input) { const l = document.createElement('label'); l.className = 'mk-field'; l.innerHTML = `<span>${esc(label)}</span>`; l.appendChild(input); return l; }
  function inputEl(value, attrs = {}) { const i = document.createElement('input'); i.type = attrs.type || 'text'; Object.entries(attrs).forEach(([k, v]) => { if (k !== 'type') i.setAttribute(k, v); }); i.value = value; return i; }
  function radios(name, opts, value) {
    const box = document.createElement('div'); box.className = 'mkt-radios'; box.setAttribute('role', 'radiogroup');
    for (const [v, label] of opts) {
      const l = document.createElement('label'); const r = document.createElement('input'); r.type = 'radio'; r.name = name; r.value = v; if (v === value) r.checked = true;
      l.append(r, document.createTextNode(' ' + label)); box.appendChild(l);
    }
    return box;
  }
  const radioValue = (box) => box.querySelector('input:checked')?.value;

  async function insertTable(rows, cols) {
    const e = edNow(); if (!e) return;
    rows = Math.max(2, Math.min(200, rows | 0)); cols = Math.max(1, Math.min(30, cols | 0));
    if (typeof e.insertTable === 'function' && modeOf(e) !== 'simple') return e.insertTable(rows, cols);
    const md = TB.make(rows, cols);
    await (e.insertBlock ? e.insertBlock(md) : e.insert('\n\n' + md + '\n\n'));
    if (e.textarea) { const ta = e.textarea; const i = ta.value.lastIndexOf('| Column 1 |', ta.selectionStart); if (i >= 0) e.setSelection(i + 2, i + 10); }
  }
  TB.insert = insertTable;
  async function insertDialog() {
    const c = inputEl(String(app.settings.get('tableLastCols', 3)), { type: 'number', min: '1', max: '30', autofocus: '' });
    const r = inputEl(String(app.settings.get('tableLastRows', 3)), { type: 'number', min: '2', max: '200' });
    const g = document.createElement('div'); g.className = 'mk-row2'; g.append(fieldEl(app.t('Number of columns'), c), fieldEl(app.t('Number of rows (with the header)'), r));
    const v = await modal({ title: app.t('Insert Table'), body: g, hint: app.t('The first row is the header row.'), buttons: [{ label: app.t('Cancel'), value: null }, { label: app.t('OK'), primary: true, value: () => ({ rows: +r.value, cols: +c.value }) }] });
    if (!v) return;
    app.settings.set('tableLastCols', v.cols); app.settings.set('tableLastRows', v.rows);
    return insertTable(v.rows, v.cols);
  }
  const PICK_COLS = 10, PICK_ROWS = 8;
  function insertPicker(anchor) {
    if (!E.menu) return insertDialog();
    const wrap = document.createElement('div'); wrap.className = 'mkt-picker';
    const label = document.createElement('div'); label.className = 'mkt-pick-label'; label.textContent = app.t('Insert Table');
    const grid = document.createElement('div'); grid.className = 'mkt-grid'; grid.setAttribute('role', 'grid'); grid.setAttribute('aria-label', app.t('Table size'));
    grid.style.setProperty('--cols', PICK_COLS);
    let R = 0, C = 0; const cells = [];
    const paint = () => { cells.forEach(b => b.classList.toggle('on', +b.dataset.r <= R && +b.dataset.c <= C)); label.textContent = R && C ? app.t('{columns}×{rows} Table', { columns: C, rows: R }) : app.t('Insert Table'); };
    for (let r = 1; r <= PICK_ROWS; r++) for (let c = 1; c <= PICK_COLS; c++) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mkt-cell'; b.dataset.r = r; b.dataset.c = c;
      b.setAttribute('aria-label', app.t('{columns} by {rows} table', { columns: c, rows: r })); b.tabIndex = -1;
      b.addEventListener('mouseenter', () => { R = r; C = c; paint(); });
      b.addEventListener('focus', () => { R = r; C = c; paint(); });
      b.addEventListener('mousedown', ev => ev.preventDefault());
      b.addEventListener('click', () => { E.closeMenu?.(); insertTable(Math.max(2, r), c); });
      b.addEventListener('keydown', ev => {
        const mv = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[ev.key];
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); b.click(); return; }
        if (!mv) return;
        ev.preventDefault(); ev.stopPropagation();
        const nr = Math.min(PICK_ROWS, Math.max(1, R + mv[0])), nc = Math.min(PICK_COLS, Math.max(1, C + mv[1]));
        cells[(nr - 1) * PICK_COLS + nc - 1].focus();
      });
      cells.push(b); grid.appendChild(b);
    }
    grid.addEventListener('mouseleave', () => { R = 0; C = 0; paint(); });
    wrap.append(label, grid);
    const inT = inTableNow();
    E.menu(anchor, [
      { el: wrap }, '-',
      { html: `${icon('mkt-table-props')}<span>${app.th('Insert Table…')}</span>`, label: app.t('Insert Table…'), run: insertDialog },
      { html: `${icon('mkt-fromtext')}<span>${app.th('Convert Text to Table…')}</span>`, label: app.t('Convert Text to Table…'), run: () => app.commands.run('table.fromText') },
      { html: `${icon('mkt-totext')}<span>${app.th('Convert Table to Text…')}</span>`, label: app.t('Convert Table to Text…'), disabled: !inT, run: () => app.commands.run('table.toText') },
      { html: `${icon('mkt-format')}<span>${app.th('Format Table')}</span>`, label: app.t('Format Table'), disabled: !inT, run: () => app.commands.run('table.format') },
    ], { noFocus: true });
    setTimeout(() => cells[PICK_COLS + 1]?.focus({ preventScroll: true }), 40);
    return wrap;
  }
  TB.insertPicker = insertPicker;

  async function toTextDialog() {
    const c = await locate(); if (!c) { toast(app.t('Click in a table first.'), { kind: 'info' }); return; }
    const box = radios('mkt-sep', [['tab', app.t('Tabs')], ['comma', app.t('Commas')], ['semicolon', app.t('Semicolons')], ['para', app.t('Paragraph marks (one cell per paragraph)')]], app.settings.get('tableTextSep', 'tab'));
    const v = await modal({ title: app.t('Convert Table to Text'), body: fieldEl(app.t('Separate text with'), box), buttons: [{ label: app.t('Cancel'), value: null }, { label: app.t('OK'), primary: true, value: () => radioValue(box) }] });
    if (!v) return;
    app.settings.set('tableTextSep', v);
    const c2 = await locate(); if (!c2) return;
    const r = TB.apply(c2.text, c2.line, 'toText', { sep: v });
    await commit(c2, r.text, { line: r.line });
  }
  async function selectedLines() {
    const e = edNow(); if (!e) return null;
    const mode = modeOf(e);
    if (mode === 'simple') {
      const ta = e.textarea; const v = ta.value; let s = ta.selectionStart, en = ta.selectionEnd;
      if (en > s && v[en - 1] === '\n') en--;
      const ls = lineStarts(linesOf(v)); let a = 0; while (a + 1 < ls.length && ls[a + 1] <= s) a++; let b = a; while (b + 1 < ls.length && ls[b + 1] <= en) b++;
      return { e, mode, text: v, from: a, to: b + 1 };
    }
    if (typeof e.selectionLines === 'function') { const r = await e.selectionLines(); if (!r) return null; return { e, mode, text: e.doc?.text ?? app.docs.active()?.text ?? '', from: r.from, to: r.to }; }
    return null;
  }
  async function fromTextDialog() {
    const sel = await selectedLines();
    if (!sel) { toast(app.t('Select the lines to turn into a table first.'), { kind: 'info' }); return; }
    const lines = linesOf(sel.text).slice(sel.from, sel.to);
    if (!lines.some(l => l.trim())) { toast(app.t('Select the lines to turn into a table first. Put tabs or commas between the columns.'), { kind: 'info' }); return; }
    if (lines.some(l => /^\s*(```|~~~|\$\$)/.test(l))) { toast(app.t('Select plain lines of text. The selection has code or math blocks.'), { kind: 'info' }); return; }
    const guess = TB.guessSeparator(lines);
    const box = radios('mkt-sep2', [['auto', app.t('Automatic')], ['tab', app.t('Tabs')], ['comma', app.t('Commas')], ['semicolon', app.t('Semicolons')], ['spaces', app.t('Two or more spaces')], ['pipe', app.t('Pipes ( | )')]], 'auto');
    const head = document.createElement('label'); head.className = 'mkt-check'; const hc = document.createElement('input'); hc.type = 'checkbox'; hc.checked = app.settings.get('tableTextHeader', true) !== false; head.append(hc, document.createTextNode(' ' + app.t('The first line is the header row')));
    const pv = document.createElement('pre'); pv.className = 'mkt-preview';
    const preview = () => { const out = TB.fromText(lines, { sep: radioValue(box), header: hc.checked }) || []; pv.textContent = out.slice(0, 6).join('\n') + (out.length > 6 ? '\n…' : ''); };
    box.addEventListener('change', preview); hc.addEventListener('change', preview);
    const body = document.createElement('div'); body.append(fieldEl(({ tab: app.t('Separate text at (looks like tabs)'), comma: app.t('Separate text at (looks like commas)'), semicolon: app.t('Separate text at (looks like semicolons)'), pipe: app.t('Separate text at (looks like pipes)'), spaces: app.t('Separate text at (looks like spaces)') })[guess] || app.t('Separate text at'), box), head, pv);
    preview();
    const v = await modal({ title: app.t('Convert Text to Table'), width: 520, body, buttons: [{ label: app.t('Cancel'), value: null }, { label: app.t('OK'), primary: true, value: () => ({ sep: radioValue(box), header: hc.checked }) }] });
    if (!v) return;
    app.settings.set('tableTextHeader', v.header);
    const out = TB.fromText(lines, v); if (!out) return;
    // the table needs blank lines around it to be a table
    const all = linesOf(sel.text);
    const before = sel.from > 0 && raw(all[sel.from - 1]).trim() ? [''] : [];
    const after = sel.to < all.length && raw(all[sel.to]).trim() ? [''] : [];
    const nt = replaceLines(sel.text, sel.from, sel.to, [...before, ...out, ...after]);
    await commit({ e: sel.e, mode: sel.mode, text: sel.text }, nt, { line: sel.from + before.length, row: 0, col: 0 });
  }
  async function sortDialog() {
    const c = await locate(); if (!c) { toast(app.t('Click in a table first.'), { kind: 'info' }); return; }
    const m = TB.parse(c.text, c.line); if (!m) return;
    const sel = document.createElement('select'); sel.className = 'mk-input';
    m.header.forEach((h, i) => { const o = document.createElement('option'); o.value = i; o.textContent = plainCell(h) || app.t('Column {n}', { n: i + 1 }); if (i === c.col) o.selected = true; sel.appendChild(o); });
    const box = radios('mkt-dir', [['asc', app.t('Ascending (A to Z, 1 to 9)')], ['desc', app.t('Descending (Z to A, 9 to 1)')]], 'asc');
    const body = document.createElement('div'); body.append(fieldEl(app.t('Sort by'), sel), fieldEl(app.t('Order'), box));
    const hint = app.t('The header row stays on top. Numbers sort as numbers.');
    const v = await modal({ title: app.t('Sort'), body, hint, buttons: [{ label: app.t('Cancel'), value: null }, { label: app.t('OK'), primary: true, value: () => ({ col: +sel.value, dir: radioValue(box) }) }] });
    if (!v) return;
    const c2 = await locate(); if (!c2) return;
    const r = TB.apply(c2.text, c2.line, 'sort', { row: c2.row, col: v.col, dir: v.dir });
    await commit(c2, r.text, { line: r.line, row: c2.row, col: v.col });
  }

  async function select(kind) {
    const e = edNow(); if (!e) return;
    const mode = modeOf(e);
    if (typeof e.selectTableCells === 'function' && mode !== 'simple') { const ok = await e.selectTableCells(kind); if (ok === false) toast(app.t('Click in a table first.'), { kind: 'info' }); return; }
    const c = await locate(e); if (!c) { toast(app.t('Click in a table first.'), { kind: 'info' }); return; }
    if (kind === 'col') { toast(app.t('Switch to Word mode (Ctrl+1) to select a column. Here you can select a row or the whole table.'), { kind: 'info' }); return; }
    await commit(c, c.text, { line: c.line, row: c.row, col: c.col, select: kind === 'row' ? 'row' : 'table' });
  }

  // =================================================================== commands
  const inT = () => !!E.testTarget || (editable() && inTableNow());
  const reg = (id, def) => app.commands.register(id, { category: app.tm('Table'), ...def });
  const C = (id, label, description, runFn, extra = {}) => reg(id, { label, description, isEnabled: inT, run: runFn, ...extra });
  reg('insert.table', {
    label: app.tm('Table'), icon: 'table', description: app.tm('Insert a table. Point to choose the number of columns and rows, or pick Insert Table for more.'),
    isEnabled: editable, run: (a = {}) => (a && a.rows && a.cols ? insertTable(a.rows, a.cols) : insertPicker(E.anchor?.())),
  });
  reg('table.insertDialog', { label: app.tm('Insert Table…'), icon: 'mkt-table-props', description: app.tm('Choose the number of columns and rows for a new table.'), isEnabled: editable, run: insertDialog });
  reg('table.fromText', { label: app.tm('Convert Text to Table…'), icon: 'mkt-fromtext', description: app.tm('Turn the selected lines into a table. Tabs, commas or semicolons mark the columns.'), isEnabled: editable, run: fromTextDialog });
  C('table.toText', app.tm('Convert to Text…'), app.tm('Turn this table back into plain lines of text, with tabs, commas or paragraphs between the cells.'), toTextDialog, { icon: 'mkt-totext' });
  C('table.rowAbove', app.tm('Insert Above'), app.tm('Add a row above the row with the cursor.'), () => run('rowAbove'), { icon: 'mkt-row-above' });
  C('table.rowBelow', app.tm('Insert Below'), app.tm('Add a row below the row with the cursor. Tab in the last cell does this too.'), () => run('rowBelow'), { icon: 'mkt-row-below' });
  C('table.colLeft', app.tm('Insert Left'), app.tm('Add a column to the left of the cursor.'), () => run('colLeft'), { icon: 'mkt-col-left' });
  C('table.colRight', app.tm('Insert Right'), app.tm('Add a column to the right of the cursor.'), () => run('colRight'), { icon: 'mkt-col-right' });
  C('table.deleteRow', app.tm('Delete Row'), app.tm('Delete the row with the cursor. Deleting the header row makes the next row the header.'), () => run('deleteRow'), { icon: 'mkt-delete' });
  C('table.deleteCol', app.tm('Delete Column'), app.tm('Delete the column with the cursor.'), () => run('deleteCol'), { icon: 'mkt-delete' });
  C('table.deleteTable', app.tm('Delete Table'), app.tm('Delete the whole table.'), () => run('deleteTable'), { icon: 'mkt-delete' });
  C('table.deleteMenu', app.tm('Delete'), app.tm('Delete cells, rows, columns or the table.'), () => E.menu?.(E.anchor?.(), [
    { label: app.t('Delete Row'), run: () => app.commands.run('table.deleteRow') }, { label: app.t('Delete Column'), run: () => app.commands.run('table.deleteCol') },
    { label: app.t('Delete Table'), run: () => app.commands.run('table.deleteTable') }]), { icon: 'mkt-delete' });
  C('table.selectRow', app.tm('Select Row'), app.tm('Select the row with the cursor.'), () => select('row'), { icon: 'mkt-select' });
  C('table.selectCol', app.tm('Select Column'), app.tm('Select the column with the cursor (Word mode). Press Delete to clear it.'), () => select('col'), { icon: 'mkt-select' });
  C('table.selectTable', app.tm('Select Table'), app.tm('Select the whole table.'), () => select('table'), { icon: 'mkt-select' });
  C('table.selectMenu', app.tm('Select'), app.tm('Select the current row, column or table.'), () => E.menu?.(E.anchor?.(), [
    { label: app.t('Select Row'), run: () => app.commands.run('table.selectRow') }, { label: app.t('Select Column'), run: () => app.commands.run('table.selectCol') },
    { label: app.t('Select Table'), run: () => app.commands.run('table.selectTable') }]), { icon: 'mkt-select' });
  let colAlign = null;
  const alignActive = v => () => colAlign === v;
  C('table.alignLeft', app.tm('Align Column Left'), app.tm('Line up the text of this column on the left. Saved in the table as :---'), () => run('align', { value: 'left' }), { icon: 'al', isActive: alignActive('left') });
  C('table.alignCenter', app.tm('Center Column'), app.tm('Center the text of this column. Saved in the table as :---:'), () => run('align', { value: 'center' }), { icon: 'ac', isActive: alignActive('center') });
  C('table.alignRight', app.tm('Align Column Right'), app.tm('Line up the text of this column on the right (good for numbers). Saved in the table as ---:'), () => run('align', { value: 'right' }), { icon: 'ar', isActive: alignActive('right') });
  C('table.align', app.tm('Column Alignment'), app.tm('Align the text of the column with the cursor: left, center, right or none.'), (a = {}) => run('align', { value: a.value ?? a }), { icon: 'al' });
  let headerOn = true;
  C('table.headerRow', app.tm('Header Row'), app.tm('Show the first row as a header row. Turned off, the header row is left empty and is hidden in Read mode, print and exports (Markdown tables always have one).'), () => run('header'), { icon: 'mkt-header', isActive: () => headerOn });
  C('table.sortAsc', app.tm('Sort Ascending'), app.tm('Sort the rows by the column with the cursor, A to Z or smallest first. The header row stays on top.'), () => run('sort', { dir: 'asc' }), { icon: 'mkt-sort' });
  C('table.sortDesc', app.tm('Sort Descending'), app.tm('Sort the rows by the column with the cursor, Z to A or largest first.'), () => run('sort', { dir: 'desc' }), { icon: 'mkt-sort' });
  C('table.sort', app.tm('Sort…'), app.tm('Sort the rows of the table by a column you choose.'), sortDialog, { icon: 'mkt-sort' });
  C('table.distribute', app.tm('Distribute Columns'), app.tm('Give all columns the same width in the Markdown. Pandoc uses these widths for wide tables in Word and PDF exports.'), () => run('distribute'), { icon: 'mkt-distribute' });
  C('table.format', app.tm('Format Table'), app.tm('Line up the pipes ( | ) of the table so the Markdown is easy to read. In Simple mode Tab does this too.'), () => run('format'), { icon: 'mkt-format' });
  reg('table.style', {
    label: app.tm('Table Style'), icon: 'mkt-style', description: app.tm('Choose how every table in this document looks. Saved in the front matter as table-style; Markdown tables cannot carry their own style.'),
    isEnabled: () => !!E.testTarget || editable(), isActive: v => TB.style() === (v && v.value || v || 'default'), value: () => TB.style(),
    run: (a) => setStyle(a && typeof a === 'object' ? a.value : a),
  });
  reg('table.gridlines', {
    label: app.tm('View Gridlines'), icon: 'mkt-grid', description: app.tm('Show dashed lines around every table cell while you edit. They are never printed or exported.'),
    isActive: gridOn, run: () => { app.settings.set('tableGridlines', !gridOn()); paintGrid(); },
  });

  // ScreenTips (tooltips.js reads the command descriptions too; these add the Markdown each one writes)
  try {
    const tips = {
      'insert.table': [app.tm('Table'), app.tm('Insert a table. Point to choose the number of columns and rows, or pick Insert Table for more.'), '| A | B |\n| --- | --- |'],
      'table.alignLeft': [app.tm('Align Column Left'), app.tm('Line up the text of this column on the left.'), '| :--- |'],
      'table.alignCenter': [app.tm('Center Column'), app.tm('Center the text of this column.'), '| :---: |'],
      'table.alignRight': [app.tm('Align Column Right'), app.tm('Line up the text of this column on the right (good for numbers).'), '| ---: |'],
      'table.style': [app.tm('Table Style'), app.tm('Choose how every table in this document looks. Saved in the front matter.'), 'table-style: striped'],
    };
    for (const [id, [title, description, markdown]] of Object.entries(tips)) app.tooltips?.register?.(id, { title, description, markdown });
  } catch {}

  // =================================================================== right-click menu (Word, Inline and Simple modes)
  TB.contextMenu = (anchor) => {
    if (!E.menu) return;
    const it = (label, cmd, ic) => ({ html: `${ic ? icon(ic) : ''}<span>${esc(label)}</span>`, label, run: () => app.commands.run(cmd) });
    E.menu(anchor, [
      { title: app.t('Table') },
      it(app.t('Insert Row Above'), 'table.rowAbove', 'mkt-row-above'), it(app.t('Insert Row Below'), 'table.rowBelow', 'mkt-row-below'),
      it(app.t('Insert Column Left'), 'table.colLeft', 'mkt-col-left'), it(app.t('Insert Column Right'), 'table.colRight', 'mkt-col-right'), '-',
      it(app.t('Align Column Left'), 'table.alignLeft', 'al'), it(app.t('Center Column'), 'table.alignCenter', 'ac'), it(app.t('Align Column Right'), 'table.alignRight', 'ar'), '-',
      it(app.t('Sort Ascending'), 'table.sortAsc', 'mkt-sort'), it(app.t('Sort Descending'), 'table.sortDesc', 'mkt-sort'), '-',
      it(app.t('Delete Row'), 'table.deleteRow', 'mkt-delete'), it(app.t('Delete Column'), 'table.deleteCol', 'mkt-delete'), it(app.t('Delete Table'), 'table.deleteTable', 'mkt-delete'), '-',
      it(app.t('Select Table'), 'table.selectTable', 'mkt-select'), it(app.t('Format Table'), 'table.format', 'mkt-format'), it(app.t('Copy for Word/Excel'), 'table.copyOffice', 'copy'),
    ], { noFocus: true });
  };

  // =================================================================== ribbon: Insert → Table, Table Design / Table Layout, View → Gridlines
  const R = app.ribbon;
  const big = (command, label, ic) => ({ type: 'big', command, label, icon: ic });
  const small = (command, label, ic) => ({ type: 'small', command, label, icon: ic, showLabel: true });
  const stylePreview = v => {
    const css = { default: 'border-bottom:1px solid currentColor', grid: 'outline:1px solid currentColor', striped: '', academic: 'border-top:1.5px solid currentColor;border-bottom:1.5px solid currentColor', accent: '' }[v];
    const rows = [0, 1, 2].map(i => `<i style="display:block;height:4px;margin:2px 0;${v === 'striped' && i % 2 ? 'background:rgba(120,120,128,.25)' : ''}${v === 'accent' && i === 0 ? 'background:#0a66ff;opacity:.55' : ''}${v === 'grid' ? ';outline:.5px solid currentColor' : ''}"></i>`).join('');
    return `<span class="mkt-sty" style="display:inline-block;width:30px;${css}">${rows}</span>`;
  };
  const GROUPS = {
    tableDesign: [
      { id: 'tdesign-options', label: app.tm('Table Style Options'), order: 10, items: [small('table.headerRow', app.tm('Header Row'), 'mkt-header')] },
      { id: 'tdesign-styles', label: app.tm('Table Styles'), order: 20, items: [{ type: 'gallery', command: 'table.style', label: app.tm('Table styles'), options: STYLES.map(s => ({ value: s.value, label: s.label, preview: stylePreview(s.value) })) }] },
      { id: 'tdesign-convert', label: app.tm('Convert'), order: 30, items: [big('table.toText', app.tm('Convert to Text'), 'mkt-totext'), big('table.copyOffice', app.tm('Copy for Word/Excel'), 'copy')] },
    ],
    tableLayout: [
      { id: 'tlayout-table', label: app.tm('Table'), order: 10, items: [{ type: 'col', items: [small('table.selectMenu', app.tm('Select'), 'mkt-select'), small('table.gridlines', app.tm('View Gridlines'), 'mkt-grid')] }] },
      { id: 'tlayout-rows', label: app.tm('Rows & Columns'), order: 20, items: [big('table.deleteMenu', app.tm('Delete'), 'mkt-delete'), big('table.rowAbove', app.tm('Insert Above'), 'mkt-row-above'), big('table.rowBelow', app.tm('Insert Below'), 'mkt-row-below'), { type: 'col', items: [small('table.colLeft', app.tm('Insert Left'), 'mkt-col-left'), small('table.colRight', app.tm('Insert Right'), 'mkt-col-right')] }] },
      { id: 'tlayout-size', label: app.tm('Cell Size'), order: 30, items: [small('table.distribute', app.tm('Distribute Columns'), 'mkt-distribute')] },
      { id: 'tlayout-align', label: app.tm('Alignment'), order: 40, items: [{ type: 'row', items: [{ type: 'small', command: 'table.alignLeft', label: app.tm('Align Column Left'), icon: 'al' }, { type: 'small', command: 'table.alignCenter', label: app.tm('Center Column'), icon: 'ac' }, { type: 'small', command: 'table.alignRight', label: app.tm('Align Column Right'), icon: 'ar' }] }] },
      { id: 'tlayout-data', label: app.tm('Data'), order: 50, items: [big('table.sort', app.tm('Sort'), 'mkt-sort'), { type: 'col', items: [small('table.sortAsc', app.tm('Ascending'), 'mkt-sort'), small('table.sortDesc', app.tm('Descending'), 'mkt-sort'), small('table.format', app.tm('Format Table'), 'mkt-format')] }, small('table.copyOffice', app.tm('Copy for Word/Excel'), 'copy')] },
    ],
  };
  const TABS = { tableDesign: { title: app.tm('Table Design'), label: app.tm('Table Design'), order: 92 }, tableLayout: { title: app.tm('Table Layout'), label: app.tm('Table Layout'), order: 93 } };
  let contextual = false, shown = false;
  function setupRibbon() {
    if (!R) return;
    if (!contextual && typeof R.showContextual === 'function') {
      contextual = true;
      for (const [id, t] of Object.entries(TABS)) {
        try { R.addTab(id, { title: t.title, label: t.label, contextual: true, accent: 'table', group: app.tm('Table Tools') }); } catch (err) { console.warn('tables: contextual tab', err); }
        for (const g of GROUPS[id]) R.addGroup(id, g);
      }
      try { R.showContextual('tableDesign', shown); R.showContextual('tableLayout', shown); } catch {}
    }
  }
  // the View tab gets Gridlines too (Word has it on View and on Table Layout)
  try { R.addGroup('view', { id: 'tables-show', label: app.tm('Tables'), order: 21, items: [small('table.gridlines', app.tm('Gridlines'), 'mkt-grid')] }); } catch {}
  setupRibbon();
  app.events.on('ready', setupRibbon);
  app.events.on('ribbon:changed', () => { if (!contextual) setupRibbon(); });

  function showTableTabs(on) {
    if (on === shown) return;
    shown = on;
    if (contextual) { try { R.showContextual('tableDesign', on); R.showContextual('tableLayout', on); } catch (err) { console.warn(err); } return; }
    // fallback for a ribbon without contextual tabs: the tabs exist only while the caret is in a table
    if (!R) return;
    if (on) {
      for (const [id, t] of Object.entries(TABS)) { if (!R.tabs().some(x => x.id === id)) R.addTab({ id, label: t.label, order: t.order, contextual: true }); for (const g of GROUPS[id]) R.addGroup(id, g); }
    } else {
      for (const id of Object.keys(TABS)) for (const g of GROUPS[id]) R.removeGroup?.(id, g.id);
    }
  }
  TB.showTabs = showTableTabs;
  // follow the caret
  let selTimer = 0;
  async function refreshState() {
    const e = edNow();
    const on = editable() && inTableNow(e);
    if (on) {
      try {
        if (modeOf(e) === 'simple') {
          const c = await locate(e);
          if (c) { const m = TB.parse(c.text, c.line); if (m) { colAlign = m.align[c.col] || null; headerOn = m.header.some(x => x.trim()); } }
        } else {
          // Word / Inline: read it from the page (no re-render while typing)
          const s = getSelection(); const n = s.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement);
          const cell = el?.closest?.('td,th'); const table = cell?.closest('table');
          if (cell && table) {
            colAlign = (cell.getAttribute('align') || cell.style.textAlign || '').toLowerCase() || null;
            if (colAlign === 'start') colAlign = null;
            const h = table.tHead?.rows[0] || table.rows[0]; headerOn = !!h && [...h.cells].some(c => c.textContent.trim());
          }
        }
      } catch {}
    }
    showTableTabs(on);
    try { app.shell?.refreshRibbon?.(); } catch {}
    document.body.classList.toggle('mk-in-table', on);
  }
  TB.refresh = refreshState;
  app.events.on('selection:changed', () => { clearTimeout(selTimer); selTimer = setTimeout(refreshState, 80); });
  app.events.on('mode:changed', () => { clearTimeout(selTimer); selTimer = setTimeout(refreshState, 80); });
  app.events.on('doc:active', () => { clearTimeout(selTimer); selTimer = setTimeout(refreshState, 80); });

  // =================================================================== Microsoft Office and spreadsheets
  // Paste: an HTML table on the clipboard (Word, Excel, Google Sheets, LibreOffice, web pages) or Excel's tab-separated
  // text becomes a Markdown table in every editing mode; inside a table the cells are written over from the caret cell on.
  // Copy: a selection with a table puts a clean bordered HTML table (Word and Excel paste it as a real table) and
  // tab-separated text (Excel) on the clipboard; Table Design → Copy for Word/Excel does the same for the whole table.
  //   TB.office = {fromHtml(html, {merged}), fromTsv(text), looksLikeTsv(text), parseTsv(text), sourceOf(html),
  //                cellMarkdown(el, styles), toOffice(tables|grid), copyTable({write}), insert(conv, editor), paste(e), enabled()}
  const O = TB.office = {};
  const OFFICE_DROP = new Set(['script', 'style', 'meta', 'link', 'title', 'head', 'xml', 'o:p', 'template', 'noscript', 'colgroup', 'col', 'button', 'select', 'textarea', 'svg', 'object', 'embed', 'iframe', 'canvas', 'video', 'audio', 'input']);
  O.enabled = () => app.settings.get('tablePasteOffice', true) !== false;
  O.sourceOf = (html) => {
    const h = String(html || '');
    if (/urn:schemas-microsoft-com:office:excel|ProgId\s*content=["']?Excel|Excel\.Sheet/i.test(h)) return 'excel';
    if (/google-sheets-html-origin/i.test(h)) return 'sheets';
    if (/urn:schemas-microsoft-com:office:word|ProgId\s*content=["']?Word|class=["']?Mso(Normal|Table)/i.test(h)) return 'word';
    if (/content=["']?LibreOffice|content=["']?OpenOffice/i.test(h)) return 'libreoffice';
    if (/docs-internal-guid/i.test(h)) return 'docs';
    if (/data-markooj-copy/i.test(h)) return 'markooj';
    return 'web';
  };
  // Excel and LibreOffice keep bold, italic and alignment in <style> classes (.xl65 {font-weight:700; text-align:center})
  function classStyles(d) {
    const map = new Map();
    for (const st of d.querySelectorAll('style')) {
      const css = st.textContent.replace(/<!--|-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        for (const sel of m[1].split(',')) {
          const c = /^\s*(?:[a-z0-9]+)?\.([\w-]+)\s*$/i.exec(sel);
          if (c) map.set(c[1], (map.get(c[1]) || '') + ';' + m[2]);
        }
      }
    }
    return map;
  }
  function propsOf(el, cmap) {
    let s = '';
    if (cmap && cmap.size && el.classList) for (const c of el.classList) if (cmap.has(c)) s += ';' + cmap.get(c);
    s += ';' + (el.getAttribute('style') || '');
    const o = {};
    for (const part of s.split(';')) { const i = part.indexOf(':'); if (i < 0) continue; const k = part.slice(0, i).trim().toLowerCase(), v = part.slice(i + 1).trim().replace(/\s*!important$/i, ''); if (k) o[k] = v; }
    return o;
  }
  const alignWord = v => { v = String(v || '').toLowerCase().trim(); return v === 'center' || v === 'middle' ? 'center' : v === 'right' || v === 'end' ? 'right' : v === 'left' || v === 'start' ? 'left' : null; };
  // Markdown characters that would change the meaning of pasted text
  function escText(t) {
    return t.replace(/\\(?=[!-/:-@[-`{-~])/g, '\\\\').replace(/([*`$~^|])/g, '\\$1').replace(/==/g, '=\\=')
      .replace(/(^|[\s(])_|_(?=[\s).,;:!?]|$)/g, (m) => m.replace('_', '\\_')).replace(/<(?=[A-Za-z/!])/g, '&lt;').replace(/\[(?=[^\]]*\]\()/g, '\\[')
      .replace(/(^|\s)@(?=[\w])/g, '$1\\@');
  }
  /** A table cell (or any element) as one line of Markdown: bold, italic, strike, underline, sub/superscript, code and links
   * kept, line breaks as <br>, Office styling dropped. → {md, text, pictures} */
  O.cellMarkdown = (cell, cmap = null) => {
    const runs = []; let pictures = 0;
    const walk = (n, f) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { if (c.data) runs.push({ ...f, t: c.data }); continue; }
        if (c.nodeType !== 1) continue;
        const tag = c.tagName.toLowerCase();
        if (OFFICE_DROP.has(tag) || /^(v|w|o|x|m):/.test(tag)) continue;
        const p = propsOf(c, cmap);
        if (p.display === 'none' || /^all$/i.test(p['mso-hide'] || '') || /ignore/i.test(p['mso-list'] || '')) continue;
        if (tag === 'br') { runs.push({ br: true }); continue; }
        if (tag === 'img') { pictures++; const alt = (c.getAttribute('alt') || '').trim(); if (alt) runs.push({ ...f, t: alt }); continue; }
        if (c.classList.contains('mk-math')) { const tex = c.getAttribute('data-tex'); if (tex != null) { runs.push({ ...f, raw: (c.classList.contains('display') ? '$$' : '$') + tex.replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|') + (c.classList.contains('display') ? '$$' : '$') }); continue; } }
        const g = { ...f };
        if (tag === 'b' || tag === 'strong') g.b = true;
        if (/^(i|em|cite|var|dfn)$/.test(tag)) g.i = true;
        if (/^(s|strike|del)$/.test(tag)) g.s = true;
        if (tag === 'u' || tag === 'ins') g.u = true;
        if (tag === 'sup') g.sup = true; else if (tag === 'sub') g.sub = true;
        if (/^(code|kbd|tt|samp)$/.test(tag)) g.code = true;
        if (p['font-weight']) g.b = /bold|[6-9]00/i.test(p['font-weight']);
        if (p['font-style']) g.i = /italic|oblique/i.test(p['font-style']);
        const deco = (p['text-decoration'] || '') + ' ' + (p['text-decoration-line'] || '');
        if (/line-through/i.test(deco)) g.s = true; if (/underline/i.test(deco) && tag !== 'a') g.u = true;
        if (/^super/i.test(p['vertical-align'] || '')) g.sup = true; else if (/^sub/i.test(p['vertical-align'] || '')) g.sub = true;
        if (tag === 'a') { const h = (c.getAttribute('href') || '').trim(); if (h && !/^(javascript|vbscript|data):/i.test(h) && !/^#_/.test(h)) { g.href = h; g.u = false; } }
        const block = /^(p|div|h[1-6]|li|blockquote|pre|tr|ul|ol|dt|dd|table|figure|figcaption|section|article)$/.test(tag);
        if (block) runs.push({ br: 'soft' });
        if (tag === 'li') runs.push({ ...g, t: '• ' });
        if (tag === 'td' || tag === 'th') runs.push({ ...g, t: ' ' });
        walk(c, g);
        if (block) runs.push({ br: 'soft' });
      }
    };
    // the cell's own look (Excel classes, Google Sheets inline styles on <td>)
    const own = propsOf(cell, cmap), ownDeco = (own['text-decoration'] || '') + ' ' + (own['text-decoration-line'] || '');
    walk(cell, { b: /bold|[6-9]00/i.test(own['font-weight'] || '') || cell.tagName === 'TH' && !own['font-weight'], i: /italic|oblique/i.test(own['font-style'] || ''), s: /line-through/i.test(ownDeco), u: /underline/i.test(ownDeco), sup: false, sub: false, code: false, href: null });
    // line breaks: <br> always counts; block edges count once, never at the start or the end
    const parts = []; let pendingBr = false, real = false;
    for (const r of runs) {
      if (r.br) { if (r.br === true) { if (real) parts.push({ br: true }); pendingBr = false; } else if (real && !parts[parts.length - 1].br) pendingBr = true; continue; }
      const t = r.raw != null ? r.raw : r.t.replace(/[\s\u00a0]+/g, ' ');
      if (!t || (!real && !t.trim())) continue; // markup whitespace before the first word
      if (pendingBr) { if (t.trim()) { parts.push({ br: true }); pendingBr = false; } else continue; }
      parts.push({ ...r, t }); if (t.trim()) real = true;
    }
    while (parts.length && parts[parts.length - 1].br) parts.pop();
    // runs with the same look are joined, then wrapped in Markdown marks (spaces stay outside the marks)
    const key = r => [r.b, r.i, r.s, r.u, r.sup, r.sub, r.code, r.href, r.raw != null].join('|');
    const groups = [];
    for (const r of parts) { const last = groups[groups.length - 1]; if (last && !last.br && !r.br && r.raw == null && last.raw == null && key(last) === key(r)) last.t += r.t; else groups.push({ ...r }); }
    let md = '', text = '';
    for (const g of groups) {
      if (g.br) { md = md.replace(/ +$/, '') + '<br>'; text = text.replace(/ +$/, '') + '\n'; continue; }
      if (g.raw != null) { md += g.raw; text += g.raw; continue; }
      let t = g.t; if (/(<br>|^)$/.test(md)) t = t.replace(/^ +/, '');
      text += t;
      const lead = /^\s*/.exec(t)[0], tail = t.length > lead.length ? /\s*$/.exec(t)[0] : '';
      const core = t.slice(lead.length, t.length - tail.length);
      if (!core) { md += t; continue; }
      let x = g.code ? '`' + core.replace(/`/g, "'").replace(/\|/g, '\\|') + '`' : escText(core);
      if (g.sup) x = `^${x.replace(/ /g, '\\ ')}^`; else if (g.sub) x = `~${x.replace(/ /g, '\\ ')}~`;
      if (g.s) x = `~~${x}~~`;
      if (g.u) x = `<u>${x}</u>`;
      if (g.b && g.i) x = `***${x}***`; else if (g.b) x = `**${x}**`; else if (g.i) x = `*${x}*`;
      if (g.href) x = `[${x}](${/[\s()<>]/.test(g.href) ? '<' + g.href.replace(/[<>]/g, encodeURIComponent) + '>' : g.href})`;
      md += lead + x + tail;
    }
    md = md.replace(/ {2,}/g, ' ').replace(/ ?<br> ?/g, '<br>').trim();
    // **a****b** → **ab** (two bold runs that touch)
    md = md.replace(/\*\*\*\*/g, '').replace(/(<br>)+$/, '');
    return { md, text: text.replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ').trim(), pictures };
  };

  const numericCell = s => /^[-+−]?[$€£¥₹]?\s?[\d.,]+\s?%?$/.test(String(s).replace(/\\/g, '').trim()) && /\d/.test(s);
  function gridOf(table, cmap, opts) {
    const own = [...table.rows].filter(r => r.closest('table') === table && propsOf(r, cmap).display !== 'none');
    const grid = []; let merged = 0, pictures = 0;
    const headRows = own.filter(r => r.parentElement && r.parentElement.tagName === 'THEAD').length;
    own.forEach((tr, ri) => {
      const row = grid[ri] = grid[ri] || [];
      let col = 0;
      for (const td of tr.cells) {
        if (propsOf(td, cmap).display === 'none') continue;
        while (row[col] !== undefined) col++;
        const cs = Math.max(1, Math.min(60, +td.colSpan || 1)), rs = Math.max(1, Math.min(own.length - ri, +td.rowSpan || 1));
        const c = O.cellMarkdown(td, cmap); pictures += c.pictures;
        const p = propsOf(td, cmap);
        let al = alignWord(td.getAttribute('align') || p['text-align']);
        if (!al) { const inner = td.querySelector('p,div,[align]'); if (inner) al = alignWord(inner.getAttribute('align') || propsOf(inner, cmap)['text-align']); }
        row[col] = { md: c.md, text: c.text, align: al, th: td.tagName === 'TH' };
        if (cs > 1 || rs > 1) merged++;
        for (let dr = 0; dr < rs; dr++) for (let dc = 0; dc < cs; dc++) {
          if (!dr && !dc) continue;
          const rr = grid[ri + dr] = grid[ri + dr] || [];
          rr[col + dc] = { md: opts.merged === 'repeat' ? c.md : '', text: opts.merged === 'repeat' ? c.text : '', align: al, covered: true };
        }
        col += cs;
      }
    });
    let n = Math.max(0, ...grid.map(r => r.length));
    const blank = { md: '', text: '', align: null };
    let rows = grid.map(r => Array.from({ length: n }, (_, i) => r[i] || blank));
    // trailing empty rows and columns (Google Sheets and Excel selections often carry some)
    while (rows.length > 1 && rows[rows.length - 1].every(c => !c.md)) rows.pop();
    while (n > 1 && rows.every(r => !r[n - 1].md)) { n--; rows = rows.map(r => r.slice(0, n)); }
    return { rows, n, merged, pictures, headRows };
  }
  function modelOf(g, source) {
    const { rows, n } = g;
    const align = Array.from({ length: n }, (_, i) => {
      const body = rows.slice(1).map(r => r[i]).filter(c => c && c.md);
      const votes = {}; for (const c of body) if (c.align) votes[c.align] = (votes[c.align] || 0) + 1;
      const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] * 2 >= body.length) return best[0] === 'left' ? null : best[0];
      if (source === 'excel' && body.length && body.every(c => numericCell(c.text))) return 'right'; // Excel shows numbers on the right
      const h = rows[0] && rows[0][i]; return h && h.align && h.align !== 'left' ? h.align : null;
    });
    const cells = rows.map(r => r.map(c => c.md));
    // a header row is bold already: **Name** → Name
    if (cells[0]) cells[0] = cells[0].map(c => (/^\*\*(?:[^*]|\\\*)+\*\*$/.test(c) ? c.slice(2, -2) : c));
    const widest = Math.max(0, ...cells.flat().map(c => width(c)));
    const m = { prefix: '', header: cells[0] || [], align, rows: cells.slice(1), pretty: cells.length * n <= 600 && widest <= 40 };
    return m;
  }
  /** HTML from the clipboard → {tables: [{md, grid, plain, rows, cols, merged, pictures}], md (everything, in order),
   * onlyTables, source}. opts.merged: 'blank' (default) | 'repeat'. */
  O.fromHtml = (html, opts = {}) => {
    const merged = opts.merged || app.settings.get('tablePasteMerged', 'blank');
    const raw0 = String(html || '').replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '').replace(/<!--(?:StartFragment|EndFragment)-->/g, '');
    const source = O.sourceOf(html);
    const d = new DOMParser().parseFromString(raw0, 'text/html');
    const cmap = classStyles(d);
    const tables = [...d.body.querySelectorAll('table')].filter(t => !t.parentElement.closest('table'));
    const out = [];
    for (const t of tables) {
      const g = gridOf(t, cmap, { merged });
      if (!g.rows.length || !g.n) continue;
      const m = modelOf(g, source);
      const lines = serialize(m);
      out.push({ md: lines.join('\n'), lines, grid: g.rows.map(r => r.map(c => c.md)), plain: g.rows.map(r => r.map(c => c.text)), rows: g.rows.length, cols: g.n, merged: g.merged, pictures: g.pictures, el: t });
    }
    // anything besides the tables? (Word: a caption or paragraphs copied with the table)
    const rest = d.body.cloneNode(true);
    rest.querySelectorAll('table').forEach(x => x.remove());
    rest.querySelectorAll('style,script,meta,link,title,xml,o\\:p').forEach(x => x.remove());
    const restText = rest.textContent.replace(/[\s\u00a0]+/g, '');
    const onlyTables = !restText;
    let md = out.map(t => t.md).join('\n\n');
    if (!onlyTables && E.sanitizePaste && E.toMarkdown) {
      try {
        out.forEach((t, i) => { const p = d.createElement('p'); p.textContent = `MKOFFICETBL${i}X`; t.el.replaceWith(p); });
        let all = E.toMarkdown(E.sanitizePaste(d.body.innerHTML)).replace(/\r\n?/g, '\n');
        all = all.replace(/(^|\n)[ \t]*MKOFFICETBL(\d+)X[ \t]*(?=\n|$)/g, (m0, pre, i) => `${pre}\n${out[+i] ? out[+i].md : ''}\n`);
        all = all.replace(/MKOFFICETBL(\d+)X/g, (m0, i) => (out[+i] ? `\n\n${out[+i].md}\n\n` : ''));
        md = all.replace(/\n{3,}/g, '\n\n').trim();
      } catch (e) { console.warn('office paste: other content', e); }
    }
    out.forEach(t => delete t.el);
    return { tables: out, md, onlyTables, source };
  };

  /** Excel's tab-separated text: quoted cells may hold tabs, quotes and line breaks. */
  O.parseTsv = (text) => {
    const s = String(text || '').replace(/\r\n?/g, '\n').replace(/\n$/, '');
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
      if (ch === '"' && cur === '') { q = true; continue; }
      if (ch === '\t') { row.push(cur); cur = ''; continue; }
      if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; continue; }
      cur += ch;
    }
    row.push(cur); rows.push(row);
    return rows;
  };
  O.looksLikeTsv = (text) => {
    const t = String(text || ''); if (!t.includes('\t') || t.length > 2e6) return false;
    const rows = O.parseTsv(t).filter(r => r.some(c => c.trim()));
    if (rows.length < 2) return false;
    const n = rows[0].length; return n >= 2 && rows.every(r => r.length === n);
  };
  O.fromTsv = (text) => {
    const rows = O.parseTsv(text).filter(r => r.some(c => c.trim()));
    const n = Math.max(0, ...rows.map(r => r.length));
    const cells = rows.map(r => Array.from({ length: n }, (_, i) => escText(String(r[i] ?? '').trim()).replace(/\n/g, '<br>')));
    const align = Array.from({ length: n }, (_, i) => (rows.length > 1 && rows.slice(1).every(r => !String(r[i] ?? '').trim() || numericCell(r[i])) && rows.slice(1).some(r => String(r[i] ?? '').trim()) ? 'right' : null));
    const m = { prefix: '', header: cells[0] || [], align, rows: cells.slice(1), pretty: cells.length * n <= 600 && Math.max(0, ...cells.flat().map(width)) <= 40 };
    const lines = serialize(m);
    return { tables: [{ md: lines.join('\n'), lines, grid: cells, plain: rows.map(r => Array.from({ length: n }, (_, i) => String(r[i] ?? ''))), rows: cells.length, cols: n, merged: 0, pictures: 0 }], md: lines.join('\n'), onlyTables: true, source: 'tsv' };
  };

  // ---------- paste: one listener in the capture phase, before the editors' own paste handlers
  function inCodeNow(e) {
    const mode = modeOf(e);
    if (mode === 'simple' && e.textarea) { const v = e.textarea.value; const line = (v.slice(0, e.textarea.selectionStart).match(/\n/g) || []).length; return inFence(linesOf(v), line); }
    const s = getSelection(); const n = s && s.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement);
    return !!(el && el.closest && el.closest('pre, code'));
  }
  async function insertConverted(conv, e) {
    const mode = modeOf(e);
    const c = await locate(e).catch(() => null);
    const one = conv.tables.length === 1 && conv.onlyTables ? conv.tables[0] : null;
    if (c && one) {
      if (one.rows * one.cols === 1) {
        // one cell: its text goes in at the caret, like typing
        const v = mode === 'word' ? one.plain[0][0].replace(/\n/g, ' ') : one.grid[0][0];
        if (mode === 'word' || (mode === 'inline' && typeof e.tableCell === 'function' && e.tableCell())) document.execCommand('insertText', false, v);
        else await e.insert(v);
        return { cells: 1 };
      }
      const r = TB.apply(c.text, c.line, 'paste', { row: c.row, col: c.col, cells: one.grid });
      if (!r) return null;
      await commit(c, r.text, { line: r.line, row: r.row, col: r.col });
      try { app.events.emit('table:changed', { op: 'paste', line: r.line }); } catch {}
      toast(app.t('Pasted {columns} × {rows} cells into the table from the cell with the cursor. Press Ctrl+Z to undo.', { columns: one.cols, rows: one.rows }), { kind: 'info' });
      return { cells: one.cols * one.rows, into: true };
    }
    if (c && !one) {
      // a cell holds one line: the pasted tables and text go right below this table
      const lines = linesOf(c.text); const f = findInLines(lines, c.line) || findNear(lines, c.line);
      if (f) {
        const nt = replaceLines(c.text, f.end, f.end, ['', ...conv.md.split('\n'), ...(f.end < lines.length && raw(lines[f.end]).trim() ? [''] : [])]);
        await commit(c, nt, { line: f.end + 1 });
        toast(app.t('Pasted below the table: a table cell holds one line, so the copied tables and text went under it.'), { kind: 'info' });
        return { below: true };
      }
    }
    await (e.insertBlock ? e.insertBlock(conv.md) : e.insert('\n\n' + conv.md + '\n\n'));
    return { block: true };
  }
  O.insert = insertConverted;
  function noteAfterPaste(conv) {
    const merged = conv.tables.reduce((n, t) => n + t.merged, 0), pics = conv.tables.reduce((n, t) => n + t.pictures, 0);
    const notes = [];
    if (merged) notes.push(app.settings.get('tablePasteMerged', 'blank') === 'repeat' ? app.t('Merged cells were split and their text repeated in each part, because Markdown tables cannot merge cells.') : app.t('Merged cells were split and the extra parts left empty, because Markdown tables cannot merge cells.'));
    if (pics) notes.push(app.t('Insert pictures from the table with Insert → Picture: pictures inside copied cells cannot come along.'));
    if (notes.length) toast(notes.join(' '), { kind: 'info', actions: [{ label: app.t('Table options'), run: () => openOptions() }], timeout: 9000 });
  }
  function openOptions() { try { app.backstage.open('options'); setTimeout(() => document.querySelector('.opt-card[data-section="tables"]')?.scrollIntoView({ block: 'start' }), 200); } catch {} }
  async function onPasteCapture(ev) {
    if (ev.defaultPrevented || !O.enabled() || O.busy) return;
    const cd = ev.clipboardData; if (!cd) return;
    const host = document.getElementById('editorHost');
    const e = E.testTarget || app.editors.active();
    if (!e) return;
    const surfaceEl = e.textarea || e.getSurface?.() || e.page;
    const inside = (host && host.contains(ev.target)) || (surfaceEl && (surfaceEl === ev.target || surfaceEl.contains?.(ev.target)));
    if (!inside) return;
    const doc = e.doc || app.docs.active();
    if (!doc || doc.readOnly || modeOf(e) === 'read' || (doc.kind && doc.kind !== 'markdown')) return;
    const html = cd.getData('text/html') || '', text = cd.getData('text/plain') || '';
    let conv = null;
    try {
      if (html && /<table[\s>]/i.test(html)) {
        // a copy from Markooj's own Simple mode: the Markdown source wins (exactly as written)
        if (/data-markooj-copy=["']?simple/i.test(html) && text) { ev.preventDefault(); ev.stopImmediatePropagation(); await (/\n/.test(text.trim()) && e.insertBlock ? e.insertBlock(text.replace(/\r\n?/g, '\n')) : e.insert(text)); return; }
        conv = O.fromHtml(html);
      } else if (!html && O.looksLikeTsv(text)) conv = O.fromTsv(text);
    } catch (err) { console.warn('office paste', err); return; }
    if (!conv || !conv.tables.length) return;
    if (inCodeNow(e)) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    O.busy = true;
    try { await insertConverted(conv, e); noteAfterPaste(conv); O.last = conv; }
    catch (err) { app.ui?.fail ? app.ui.fail(err, { lead: app.t('Paste again, or use Paste as plain text (Ctrl+Shift+V) and Insert → Table → Convert Text to Table.') }) : toast(app.t('Paste again, or use Paste as plain text (Ctrl+Shift+V). The table could not be converted this time.'), { kind: 'warn' }); }
    finally { O.busy = false; }
  }
  O.paste = onPasteCapture;
  document.addEventListener('paste', onPasteCapture, true);

  // ---------- copy: clean tables for Word and Excel
  const CELL = 'border:1px solid #8c8c8c;padding:4px 8px;vertical-align:top';
  const KEEP_ATTR = { a: ['href'], img: ['src', 'alt', 'width', 'height'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] };
  const INLINE_OK = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'del', 'sub', 'sup', 'code', 'a', 'br', 'img', 'math', 'mark', 'span', 'kbd']);
  function cleanInline(src) {
    const c = src.cloneNode(true);
    c.querySelectorAll('.mk-comment,.mk-note,.mk-note-mark,.mk-hidden-note,.mk-pic-missing,script,style,button,.katex-html,.mkt-handle,[data-mk-hidden]').forEach(x => x.remove());
    // math: the MathML that KaTeX wrote (Word turns it into an equation; Excel shows its text)
    c.querySelectorAll('.mk-math').forEach(m => { const ml = m.querySelector('math'); const no = m.querySelector('.mk-eqno'); const frag = document.createDocumentFragment(); if (ml) frag.appendChild(ml.cloneNode(true)); else frag.appendChild(document.createTextNode(m.getAttribute('data-tex') || m.textContent)); if (no) frag.appendChild(document.createTextNode(' ' + no.textContent)); m.replaceWith(frag); });
    const walk = el => {
      for (const n of [...el.children]) {
        const tag = n.tagName.toLowerCase();
        if (tag === 'math') { for (const at of [...n.attributes]) if (!/^(xmlns|display)$/.test(at.name)) n.removeAttribute(at.name); continue; }
        walk(n);
        if (!INLINE_OK.has(tag) || tag === 'span') {
          const kids = [...n.childNodes];
          if (/^(p|div|li|h[1-6]|blockquote)$/.test(tag) && n.nextSibling) kids.push(document.createElement('br'));
          n.replaceWith(...kids); continue;
        }
        for (const at of [...n.attributes]) if (!(KEEP_ATTR[tag] || []).includes(at.name)) n.removeAttribute(at.name);
        if (tag === 'img') {
          const s = n.getAttribute('src') || ''; const abs = app.pictures?.absPath?.(app.docs.active(), s);
          if (abs) n.setAttribute('src', app.pictures.fileUrl(abs));
        }
      }
    };
    walk(c);
    return c.innerHTML.trim();
  }
  const tsvCell = s => (/[\t\n"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
  function cellText(td) {
    const c = td.cloneNode(true);
    c.querySelectorAll('.mk-comment,.mk-note,.mk-note-mark,.mk-hidden-note,.mk-pic-missing,button').forEach(x => x.remove());
    c.querySelectorAll('.mk-math').forEach(m => m.replaceWith(document.createTextNode('$' + (m.getAttribute('data-tex') || '') + '$')));
    c.querySelectorAll('br').forEach(b => b.replaceWith(document.createTextNode('\n')));
    return c.textContent.replace(/[ \t\u00a0]+/g, ' ').replace(/ *\n */g, '\n').trim();
  }
  /** Rows of cells (elements) → {html, tsv}. The first row is the header when `header` is true. */
  O.toOffice = (rows, { header = true } = {}) => {
    const n = Math.max(0, ...rows.map(r => r.length));
    let html = '<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;border:1px solid #8c8c8c">';
    rows.forEach((r, i) => {
      const head = header && i === 0;
      if (head) html += '<thead>'; else if (i === (header ? 1 : 0)) html += '<tbody>';
      html += '<tr>';
      for (let k = 0; k < n; k++) {
        const td = r[k]; const tag = head ? 'th' : 'td';
        const al = td ? alignWord(td.getAttribute('align') || td.style?.textAlign) : null;
        const st = CELL + (head ? ';background:#f2f2f2;font-weight:bold' : '') + (al ? `;text-align:${al}` : head ? ';text-align:left' : '');
        html += `<${tag} style="${st}">${td ? cleanInline(td) : ''}</${tag}>`;
      }
      html += '</tr>';
      if (head) html += '</thead>';
    });
    html += (rows.length > (header ? 1 : 0) ? '</tbody>' : '') + '</table>';
    const tsv = rows.map(r => Array.from({ length: n }, (_, k) => tsvCell(r[k] ? cellText(r[k]) : '')).join('\t')).join('\r\n');
    return { html, tsv };
  };
  const wrapHtml = (inner, from) => `<meta charset="utf-8"><div data-markooj-copy="${from}">${inner}</div>`;
  /** Cells of `table` (rows of elements) inside a rectangle, or every cell. */
  function tableRows(table, rect) {
    const rows = [...table.rows].filter(r => r.closest('table') === table);
    const pick = rect ? rows.slice(rect.r0, rect.r1 + 1) : rows;
    const hidden = r => r.parentElement?.tagName === 'THEAD' && ![...r.cells].some(c => c.textContent.trim()); // "Header Row" off
    return pick.filter(r => !hidden(r)).map(r => { const cells = [...r.cells]; return rect ? cells.slice(rect.c0, rect.c1 + 1) : cells; });
  }
  /** The copy event: Word, Inline and Read modes, and Simple mode's source (Markdown text stays the plain text there). */
  function onCopyCapture(ev) {
    if (app.settings.get('tableCopyOffice', true) === false || !ev.clipboardData) return;
    if (O.pending) { const p = O.pending; O.pending = null; ev.clipboardData.setData('text/html', p.html); ev.clipboardData.setData('text/plain', p.text); ev.preventDefault(); ev.stopImmediatePropagation(); return; }
    const t = ev.target && (ev.target.nodeType === 1 ? ev.target : ev.target.parentElement);
    // Simple mode: the selected Markdown, plus a real table for Word and Excel
    if (t && t.tagName === 'TEXTAREA' && t.closest('#editorHost, .mk-src, .mk-simple, [data-mk-editor]')) {
      const v = t.value.slice(t.selectionStart, t.selectionEnd);
      if (!/\|/.test(v) || !/\n\s*\|?\s*:?-{3}/.test(v)) return;
      let html = ''; try { html = (window.mk || app.mk).render(v, {}).html; } catch { return; }
      const box = document.createElement('div'); box.innerHTML = html;
      if (!box.querySelector('table')) return;
      box.querySelectorAll('table').forEach(tb => { const x = document.createElement('div'); x.innerHTML = O.toOffice(tableRows(tb)).html; tb.replaceWith(x.firstChild); });
      ev.clipboardData.setData('text/plain', v); ev.clipboardData.setData('text/html', wrapHtml(box.innerHTML, 'simple'));
      ev.preventDefault(); return;
    }
    const sel = getSelection(); if (!sel || !sel.rangeCount) return;
    const page = t && t.closest ? t.closest('.mk-page:not(.mk-export-stage)') : null;
    const r = sel.getRangeAt(0);
    const pageOf = n => (n && (n.nodeType === 1 ? n : n.parentElement))?.closest?.('.mk-page:not(.mk-export-stage)');
    const pg = page || pageOf(r.commonAncestorContainer); if (!pg) return;
    // Word mode cell selection (Select Row / Column / Table, Shift+arrows)
    const marked = [...pg.querySelectorAll('.mk-tsel')];
    const cellOf = n => (n && (n.nodeType === 1 ? n : n.parentElement))?.closest?.('td,th');
    let out = null;
    if (marked.length > 1 && marked.every(c => c.closest('table') === marked[0].closest('table'))) {
      const tb = marked[0].closest('table'); const rows = [...tb.rows];
      const ri = marked.map(c => rows.indexOf(c.parentElement)), ci = marked.map(c => c.cellIndex);
      out = O.toOffice(tableRows(tb, { r0: Math.min(...ri), r1: Math.max(...ri), c0: Math.min(...ci), c1: Math.max(...ci) }), { header: Math.min(...ri) === 0 });
    } else {
      if (r.collapsed) return;
      const a = cellOf(r.startContainer), b = cellOf(r.endContainer);
      if (a && b && a === b) return; // text inside one cell: an ordinary copy
      if (a && b && a.closest('table') === b.closest('table') && !r.cloneContents().querySelector?.('table table')) {
        const tb = a.closest('table'); const rows = [...tb.rows];
        const ra = rows.indexOf(a.parentElement), rb = rows.indexOf(b.parentElement);
        const rect = { r0: Math.min(ra, rb), r1: Math.max(ra, rb), c0: Math.min(a.cellIndex, b.cellIndex), c1: Math.max(a.cellIndex, b.cellIndex) };
        if (ra === rb && a.cellIndex === b.cellIndex) return;
        out = O.toOffice(tableRows(tb, rect), { header: rect.r0 === 0 });
      } else {
        const tables = [...pg.querySelectorAll('table')].filter(x => r.intersectsNode(x));
        if (!tables.length) return;
        const frag = r.cloneContents(); const box = document.createElement('div'); box.appendChild(frag);
        box.querySelectorAll('[data-mk-ui]:not(.mk-eqno):not(.mk-xnum), .mk-pic-missing, .mk-comment, .mk-note-mark, button').forEach(x => x.remove());
        const cloned = [...box.querySelectorAll('table')];
        cloned.forEach(tb => { if (tb.parentElement && tb.parentElement.closest('table')) return; const x = document.createElement('div'); x.innerHTML = O.toOffice(tableRows(tb)).html; tb.replaceWith(x.firstChild); });
        const only = tables.length === 1 && !box.textContent.replace(/\s+/g, '').replace(tables[0].textContent.replace(/\s+/g, ''), '');
        out = { html: box.innerHTML, tsv: only ? O.toOffice(tableRows(tables[0])).tsv : sel.toString() };
      }
    }
    if (!out) return;
    ev.clipboardData.setData('text/html', wrapHtml(out.html, 'page'));
    ev.clipboardData.setData('text/plain', out.tsv);
    ev.preventDefault();
  }
  O.copyEvent = onCopyCapture;
  document.addEventListener('copy', onCopyCapture, true);

  /** Table Design → Copy for Word/Excel: the table with the caret, as a bordered table and tab-separated text. */
  O.copyTable = async (opts = {}) => {
    const c = await locate(opts.editor || edNow());
    if (!c) { toast(app.t('Click in a table first, then copy it for Word or Excel.'), { kind: 'info' }); return null; }
    const lines = linesOf(c.text); const f = findNear(lines, c.line); if (!f) return null;
    const md = lines.slice(f.start, f.end).map(l => strip(raw(l))).join('\n');
    let html = '';
    try { html = (await app.render(md, { doc: c.e.doc || app.docs.active() })).html; } catch { html = (window.mk || app.mk).render(md, {}).html; }
    const box = document.createElement('div'); box.innerHTML = html;
    try { E.fixImages?.(box, c.e.doc || app.docs.active()); } catch {}
    const tb = box.querySelector('table'); if (!tb) return null;
    const out = O.toOffice(tableRows(tb));
    const data = { html: wrapHtml(out.html, 'table'), text: out.tsv };
    if (opts.write) { await opts.write(data); return data; }
    let ok = false;
    try { O.pending = data; ok = document.execCommand('copy'); } catch {} finally { if (O.pending === data) O.pending = null; }
    if (!ok) {
      try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([data.html], { type: 'text/html' }), 'text/plain': new Blob([data.text], { type: 'text/plain' }) })]); ok = true; } catch {}
    }
    if (!ok) { try { await (window.mk || app.mk).copyText(data.text); ok = true; toast(app.t('Paste into Excel now: the table is on the clipboard as text with tabs. For Word, paste and choose Insert → Table → Convert Text to Table.'), { kind: 'info' }); return data; } catch {} }
    if (ok) toast(app.t('Table copied. Paste it into Word or Excel (Ctrl+V) and it arrives as a real table with borders.'), { kind: 'info' });
    else toast(app.t('Select the table (Table Layout → Select → Select Table) and press Ctrl+C to copy it. The clipboard was busy this time.'), { kind: 'warn' });
    return ok ? data : null;
  };
  C('table.copyOffice', app.tm('Copy for Word/Excel'), app.tm('Copy this table so Word and Excel paste it as a real table: borders, header row and every cell in place. Selecting cells and pressing Ctrl+C does the same.'), () => O.copyTable(), { icon: 'copy' });
  try { app.tooltips?.register?.('table.copyOffice', { title: app.tm('Copy for Word/Excel'), description: app.tm('Copy this table so Word and Excel paste it as a real table. Ctrl+C on selected cells does the same.') }); } catch {}

  // ---------- Pandoc exports: line breaks in cells (Word, LibreOffice) and captions of pictures inside cells
  function tableBlocks(lines) {
    const out = []; let fence = null;
    for (let i = 0; i < lines.length; i++) {
      const l = strip(raw(lines[i]));
      if (fence) { const f = /^\s{0,3}(`{3,}|~{3,})\s*$/.exec(l); if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null; continue; }
      const f = /^\s{0,3}(`{3,}|~{3,})/.exec(l); if (f) { fence = f[1]; continue; }
      if (!hasPipe(l) || i + 1 >= lines.length) continue;
      const d = strip(raw(lines[i + 1]));
      if (!isDelim(d) || splitRow(l).length !== splitRow(d).length) continue;
      let end = i + 2; while (end < lines.length && strip(raw(lines[end])).trim() && hasPipe(strip(raw(lines[end]))) && !CAPTION.test(strip(raw(lines[end])).trim())) end++;
      out.push({ start: i, end }); i = end - 1;
    }
    return out;
  }
  TB.tableBlocks = (text) => tableBlocks(linesOf(text));
  TB.exportMarkdown = (md, format) => {
    const br = format === 'docx' ? '`<w:br/>`{=openxml}' : format === 'odt' ? '`<text:line-break/>`{=opendocument}' : null;
    const lines = linesOf(md); const blocks = tableBlocks(lines); if (!blocks.length) return md;
    const ATTR_FIG = /!\[((?:[^[\]\n]|\[[^\]\n]*\])*)\]\(([^)\n]*)\)(\{[^{}\n]*#fig:[^{}\n]*\})/g;
    for (const b of blocks) for (let i = b.start; i < b.end; i++) {
      if (i === b.start + 1) continue;
      let l = lines[i];
      // a labeled picture in a cell: its caption under it (Pandoc shows no caption for a picture inside a table)
      l = l.replace(ATTR_FIG, (m0, alt) => (alt.trim() ? `${m0}${br || ' '}*${alt.trim()}*` : m0));
      if (br) l = l.replace(/<br\s*\/?>/gi, br);
      lines[i] = l;
    }
    return lines.join('\n');
  };
  try { app.exporter?.addMarkdownTransform?.((md, ctx = {}) => TB.exportMarkdown(md, ctx.format)); } catch {}

  // ---------- File → Options → Tables
  try {
    app.options.addSection({
      id: 'tables', label: app.tm('Tables'), order: 28,
      render(el) {
        el.innerHTML = '';
        const wrap = document.createElement('div'); wrap.className = 'mkt-opts';
        // the same switches as the other Options sections (plain checkboxes only if the shell helper is missing)
        const check = (key, def, label, hint) => {
          if (app.shell?.settingSwitch) { wrap.appendChild(app.shell.settingSwitch(key, def, label, hint)); return; }
          const row = document.createElement('label'); row.className = 'mkt-opt';
          const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = app.settings.get(key, def) !== false;
          cb.addEventListener('change', () => app.settings.set(key, cb.checked));
          const txt = document.createElement('span'); txt.innerHTML = `<b>${esc(label)}</b><small>${esc(hint)}</small>`;
          row.append(cb, txt); wrap.appendChild(row);
        };
        check('tablePasteOffice', true, app.t('Turn tables pasted from Word, Excel and Google Sheets into Markdown tables'), app.t('Bold, italic, links and line breaks in cells are kept. Paste as plain text (Ctrl+Shift+V) skips this.'));
        const mrow = document.createElement('label'); mrow.className = 'mkt-opt mkt-opt-sel';
        const sel = document.createElement('select'); sel.className = 'sel';
        [['blank', app.t('Leave the extra cells empty')], ['repeat', app.t('Repeat the text in each cell')]].forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; if (app.settings.get('tablePasteMerged', 'blank') === v) o.selected = true; sel.appendChild(o); });
        sel.addEventListener('change', () => app.settings.set('tablePasteMerged', sel.value));
        const mt = document.createElement('span'); mt.innerHTML = `<b>${app.th('Merged cells')}</b><small>${app.th('Markdown tables cannot merge cells, so a merged cell is split when you paste it.')}</small>`;
        mrow.append(mt, sel);
        if (app.shell?.settingSwitch) { const r = document.createElement('div'); r.className = 'opt-row'; r.innerHTML = `<div class="ol"><b>${app.th('Merged cells')}</b><small>${app.th('Markdown tables cannot merge cells, so a merged cell is split when you paste it.')}</small></div><div class="oc"></div>`; sel.setAttribute('aria-label', app.t('Merged cells')); r.querySelector('.oc').append(sel); wrap.appendChild(r); }
        else wrap.appendChild(mrow);
        check('tableCopyOffice', true, app.t('Copy tables so Word and Excel paste them as real tables'), app.t('Copying cells or a whole table adds a bordered table and tab-separated text to the clipboard.'));
        el.appendChild(wrap);
      },
    });
  } catch {}

  // =================================================================== smoke tests
  const A = (c, m) => app.assert(c, m);
  const eq = (got, want, what) => A(got === want, `${what}\n--- got ---\n${got}\n--- want ---\n${want}`);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function until(fn, ms = 4000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch {} await sleep(20); } return false; }
  const DOC = 'Intro text.\n\n| Name | Size |\n| --- | ---: |\n| B | 10 |\n| A | 2 |\n\nAfter.\n';

  app.tests.register('tables: engine operations give exact pipe tables', () => {
    const at = (op, args) => TB.apply(DOC, 2, op, args).text;
    eq(at('rowAbove', { row: 1, col: 0 }), 'Intro text.\n\n| Name | Size |\n| --- | ---: |\n|  |  |\n| B | 10 |\n| A | 2 |\n\nAfter.\n', 'row above');
    eq(at('rowBelow', { row: 2, col: 0 }), 'Intro text.\n\n| Name | Size |\n| --- | ---: |\n| B | 10 |\n| A | 2 |\n|  |  |\n\nAfter.\n', 'row below');
    eq(at('colLeft', { row: 1, col: 1 }), 'Intro text.\n\n| Name |  | Size |\n| --- | --- | ---: |\n| B |  | 10 |\n| A |  | 2 |\n\nAfter.\n', 'column left');
    eq(at('colRight', { row: 1, col: 1 }), 'Intro text.\n\n| Name | Size |  |\n| --- | ---: | --- |\n| B | 10 |  |\n| A | 2 |  |\n\nAfter.\n', 'column right');
    eq(at('deleteRow', { row: 1, col: 0 }), 'Intro text.\n\n| Name | Size |\n| --- | ---: |\n| A | 2 |\n\nAfter.\n', 'delete row');
    eq(at('deleteRow', { row: 0, col: 0 }), 'Intro text.\n\n| B | 10 |\n| --- | ---: |\n| A | 2 |\n\nAfter.\n', 'delete header row');
    eq(at('deleteCol', { row: 1, col: 0 }), 'Intro text.\n\n| Size |\n| ---: |\n| 10 |\n| 2 |\n\nAfter.\n', 'delete column');
    eq(at('deleteTable', { row: 1, col: 0 }), 'Intro text.\n\nAfter.\n', 'delete table');
    eq(at('align', { row: 1, col: 0, value: 'center' }), 'Intro text.\n\n| Name | Size |\n| :---: | ---: |\n| B | 10 |\n| A | 2 |\n\nAfter.\n', 'center');
    eq(at('align', { row: 1, col: 1, value: 'left' }), 'Intro text.\n\n| Name | Size |\n| --- | :--- |\n| B | 10 |\n| A | 2 |\n\nAfter.\n', 'align left');
    eq(at('align', { row: 1, col: 1, value: 'none' }), 'Intro text.\n\n| Name | Size |\n| --- | --- |\n| B | 10 |\n| A | 2 |\n\nAfter.\n', 'no alignment');
    eq(at('sort', { row: 1, col: 0, dir: 'asc' }), 'Intro text.\n\n| Name | Size |\n| --- | ---: |\n| A | 2 |\n| B | 10 |\n\nAfter.\n', 'sort by name');
    eq(at('sort', { row: 1, col: 1, dir: 'desc' }), DOC, 'sort numbers descending (10 before 2)');
    eq(at('sort', { row: 1, col: 1, dir: 'asc' }), 'Intro text.\n\n| Name | Size |\n| --- | ---: |\n| A | 2 |\n| B | 10 |\n\nAfter.\n', 'numeric sort');
    eq(at('header', { row: 1, col: 0 }), 'Intro text.\n\n|  |  |\n| --- | ---: |\n| Name | Size |\n| B | 10 |\n| A | 2 |\n\nAfter.\n', 'header row off');
    eq(TB.apply(at('header', { row: 1, col: 0 }), 2, 'header', { row: 1, col: 0 }).text, DOC, 'header row on again');
    eq(at('format', { row: 1, col: 0 }), 'Intro text.\n\n| Name | Size |\n| ---- | ---: |\n| B    |   10 |\n| A    |    2 |\n\nAfter.\n', 'format table');
    eq(at('distribute', { row: 1, col: 0 }), 'Intro text.\n\n| Name | Size |\n| ---- | ---: |\n| B    |   10 |\n| A    |    2 |\n\nAfter.\n', 'distribute (same widths here)');
    eq(TB.apply('| a | long header |\n| - | - |\n| x | y |', 0, 'distribute').text, '| a           | long header |\n| ----------- | ----------- |\n| x           | y           |', 'distribute widens columns');
    eq(at('setCell', { row: 2, col: 0, text: 'x | y' }), 'Intro text.\n\n| Name | Size |\n| --- | ---: |\n| B | 10 |\n| x \\| y | 2 |\n\nAfter.\n', 'a typed pipe is escaped');
    eq(at('toText', { sep: 'comma' }), 'Intro text.\n\nName, Size\n\nB, 10\n\nA, 2\n\nAfter.\n', 'table to text');
  });

  app.tests.register('tables: math, code, links and escaped pipes survive; the rest stays byte-identical', () => {
    const src = 'Para *one*  \nkeeps  spaces.\r\n\r\n| Eq | Code | Link |\r\n|:--|:-:|--:|\r\n| $\\|x\\|$ | `a \\| b` | [site](https://x.org) |\r\n\r\n```\n| not | a | table |\n| --- | --- | --- |\n```\n';
    const r = TB.apply(src, 2, 'rowBelow', { row: 1, col: 0 });
    A(r.text.startsWith('Para *one*  \nkeeps  spaces.\r\n\r\n'), 'text before the table untouched');
    A(r.text.endsWith('\r\n\r\n```\n| not | a | table |\n| --- | --- | --- |\n```\n'), 'text after the table untouched: ' + JSON.stringify(r.text));
    eq(r.text.split('\n').slice(3, 7).join('\n'), '| Eq | Code | Link |\r\n| :--- | :---: | ---: |\r\n| $\\|x\\|$ | `a \\| b` | [site](https://x.org) |\r\n|  |  |  |\r', 'cells kept, CRLF kept');
    A(TB.find(src, 9) === null, 'a table inside a code fence is not found when the fence line is the start');
    const q = '> | a | b |\n> | --- | --- |\n> | 1 | 2 |\n';
    eq(TB.apply(q, 0, 'colRight', { row: 1, col: 1 }).text, '> | a | b |  |\n> | --- | --- | --- |\n> | 1 | 2 |  |\n', 'table in a quote keeps its > prefix');
    const m = TB.parse('| a \\| b | c |\n|---|---|\n| 1 | 2 |', 0);
    A(m && m.header[0] === 'a \\| b' && m.header.length === 2, 'escaped pipe stays in one cell: ' + JSON.stringify(m && m.header));
    // every result renders as a table with the same number of cells
    if (window.mk?.render || app.mk?.render) {
      const render = (app.mk || window.mk).render;
      for (const op of ['rowAbove', 'rowBelow', 'colLeft', 'colRight', 'deleteRow', 'deleteCol', 'header', 'sort', 'format']) {
        const t = TB.apply(DOC, 2, op, { row: 1, col: 1, dir: 'asc' }).text;
        const html = render(t, {}).html; const box = document.createElement('div'); box.innerHTML = html;
        A(box.querySelectorAll('table').length === 1, op + ': renders one table');
      }
    }
  });

  app.tests.register('tables: cell lookup, convert text to table', () => {
    const t = 'x\n\n| a | b |\n| --- | --- |\n| 1 | 22 |\n';
    const off = t.indexOf('22');
    const c = TB.cellAt(t, off); A(c && c.row === 1 && c.col === 1 && t.slice(c.start, c.end) === '22', 'cell at offset: ' + JSON.stringify(c));
    const c0 = TB.cellAt(t, t.indexOf('| a') + 1); A(c0 && c0.row === 0 && c0.col === 0, 'first cell: ' + JSON.stringify(c0));
    const r = TB.cellRange(t, 2, 1, 0); A(r && t.slice(r.start, r.end) === '1', 'cell range');
    eq(TB.fromText(['Name\tAge', 'Ann\t30', 'Bo | x\t4'], { sep: 'auto', header: true }).join('\n'), '| Name | Age |\n| --- | --- |\n| Ann | 30 |\n| Bo \\| x | 4 |', 'tabs → table');
    eq(TB.fromText(['a, "b, c"', '1, 2'], { sep: 'comma', header: false }).join('\n'), '|  |  |\n| --- | --- |\n| a | b, c |\n| 1 | 2 |', 'CSV → table without a header');
    eq(TB.make(3, 2), '| Column 1 | Column 2 |\n| --- | --- |\n|  |  |\n|  |  |', 'new table');
  });

  app.tests.register('tables: Simple mode Tab moves between cells, lines up the pipes and adds a row', async () => {
    if (!E.createSimple || !E.fakeDoc) return;
    const host = E._offscreen(); const s = E.createSimple(); const d = E.fakeDoc('Intro\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nEnd');
    try {
      s.mount(host, d); await sleep(30);
      const ta = s.textarea; ta.focus();
      const pos = ta.value.indexOf('| 1') + 2; ta.setSelectionRange(pos, pos);
      A(TB.sourceTab(s, false), 'Tab handled');
      eq(ta.value, 'Intro\n\n| a   | b   |\n| --- | --- |\n| 1   | 2   |\n\nEnd', 'pipes lined up');
      A(ta.value.slice(ta.selectionStart, ta.selectionEnd) === '2', 'caret on the next cell: ' + JSON.stringify(ta.value.slice(ta.selectionStart, ta.selectionEnd)));
      TB.sourceTab(s, false); // last cell → a new row
      eq(ta.value, 'Intro\n\n| a   | b   |\n| --- | --- |\n| 1   | 2   |\n|     |     |\n\nEnd', 'Tab in the last cell adds a row');
      const c = TB.cellAt(ta.value, ta.selectionStart); A(c && c.row === 2 && c.col === 0, 'caret in the new row: ' + JSON.stringify(c));
      TB.sourceTab(s, true); const c2 = TB.cellAt(ta.value, ta.selectionStart); A(c2 && c2.row === 1 && c2.col === 1, 'Shift+Tab goes back: ' + JSON.stringify(c2));
      // the real key goes through editor-source.js
      ta.setSelectionRange(ta.value.indexOf('| a') + 2, ta.value.indexOf('| a') + 2);
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      const c3 = TB.cellAt(ta.value, ta.selectionStart); A(c3 && c3.row === 0 && c3.col === 1, 'Tab key in Simple mode moves to the next cell: ' + JSON.stringify(c3));
      // Format Table command
      E.testTarget = s; ta.value; s.setSelection(ta.value.indexOf('| 1'));
      d.setText('| x | yy |\n|---|---|\n| 1 | 2 |', 'test'); s.refresh?.(); await sleep(10);
      s.setSelection(3);
      await app.commands.run('table.format');
      eq(ta.value, '| x   | yy  |\n| --- | --- |\n| 1   | 2   |', 'Format Table');
    } finally { E.testTarget = null; s.unmount(); host.remove(); }
  });

  async function withWord(src, fn) {
    if (!E.createWord || !E.fakeDoc) return;
    const host = E._offscreen(); const ed = E.createWord(); const d = E.fakeDoc(src);
    try {
      ed.mount(host, d);
      await until(() => ed.page?.querySelector('table'));
      await sleep(60);
      E.testTarget = ed;
      return await fn(ed, d, host);
    } finally { E.testTarget = null; ed.unmount(); host.remove(); }
  }
  const caretIn = (el, end) => { const r = document.createRange(); r.selectNodeContents(el); r.collapse(!end); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  const caretCell = (ed) => { const s = getSelection(); const n = s.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement); const c = el?.closest?.('td,th'); return c ? { row: c.parentElement.rowIndex, col: c.cellIndex } : null; };

  app.tests.register('tables: Word mode Tab, Shift+Tab, last-cell Tab adds a row, Enter is a new line in the cell', async () => {
    await withWord('Text\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nEnd', async (ed, d) => {
      const page = ed.page; page.focus();
      const key = (k, o = {}) => page.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }));
      caretIn(page.querySelector('th'));
      key('Tab'); A(JSON.stringify(caretCell(ed)) === '{"row":0,"col":1}', 'Tab → next cell: ' + JSON.stringify(caretCell(ed)));
      key('Tab'); A(JSON.stringify(caretCell(ed)) === '{"row":1,"col":0}', 'Tab → next row');
      key('Tab', { shiftKey: true }); A(JSON.stringify(caretCell(ed)) === '{"row":0,"col":1}', 'Shift+Tab → back');
      caretIn(page.querySelector('tbody td:last-child'), true);
      key('Tab');
      A(page.querySelector('table').rows.length === 3, 'Tab in the last cell adds a row');
      A(JSON.stringify(caretCell(ed)) === '{"row":2,"col":0}', 'caret in the new row: ' + JSON.stringify(caretCell(ed)));
      document.execCommand('insertText', false, 'new');
      key('Enter'); // Enter starts a new line in the cell, like Word (it does not leave the table)
      A(page.querySelectorAll('table').length === 1 && !page.querySelector('table p, table div'), 'Enter keeps one table');
      A(JSON.stringify(caretCell(ed)) === '{"row":2,"col":0}', 'Enter in the last row stays in the cell: ' + JSON.stringify(caretCell(ed)));
      document.execCommand('insertText', false, 'more');
      ed._commit?.();
      const m = TB.parse(d.text, 2); A(m && m.rows.length === 2 && /^new<br>more$/.test(m.rows[1][0]), 'typed text in the new row, on two lines: ' + d.text);
      A(d.text.startsWith('Text\n\n') && d.text.endsWith('\n\nEnd'), 'rest of the document kept: ' + JSON.stringify(d.text));
    });
  });

  app.tests.register('tables: Word mode ribbon commands edit the table where the caret is', async () => {
    await withWord('Top\n\n| Name | Size |\n| --- | ---: |\n| B | 10 |\n| A | 2 |\n\nAfter', async (ed, d) => {
      const page = ed.page; page.focus();
      caretIn(page.querySelectorAll('tbody tr')[0].cells[0]);
      A(TB.inTable(), 'caret is in a table');
      await app.commands.run('table.rowBelow');
      eq(d.text, 'Top\n\n| Name | Size |\n| --- | ---: |\n| B | 10 |\n|  |  |\n| A | 2 |\n\nAfter', 'insert row below');
      A(JSON.stringify(caretCell(ed)) === '{"row":2,"col":0}', 'caret moves to the new row: ' + JSON.stringify(caretCell(ed)));
      await app.commands.run('table.deleteRow');
      eq(d.text, 'Top\n\n| Name | Size |\n| --- | ---: |\n| B | 10 |\n| A | 2 |\n\nAfter', 'delete row');
      caretIn(page.querySelectorAll('tbody tr')[0].cells[1]);
      await app.commands.run('table.sortAsc');
      eq(d.text, 'Top\n\n| Name | Size |\n| --- | ---: |\n| A | 2 |\n| B | 10 |\n\nAfter', 'sort by Size');
      await app.commands.run('table.alignCenter');
      eq(d.text, 'Top\n\n| Name | Size |\n| --- | :---: |\n| A | 2 |\n| B | 10 |\n\nAfter', 'center column');
      await app.commands.run('table.colLeft');
      eq(d.text, 'Top\n\n| Name |  | Size |\n| --- | --- | :---: |\n| A |  | 2 |\n| B |  | 10 |\n\nAfter', 'insert column left');
      A(JSON.stringify(caretCell(ed)) === '{"row":1,"col":1}', 'caret in the new column: ' + JSON.stringify(caretCell(ed)));
      await app.commands.run('table.deleteCol');
      await app.commands.run('table.selectRow');
      A(page.querySelectorAll('.mk-tsel').length === 2, 'select row marks two cells');
      await app.commands.run('table.deleteTable');
      eq(d.text, 'Top\n\nAfter', 'delete table');
      await ed.undo?.(); await until(() => ed.page.querySelector('table'));
      A(/\| Name \| Size \|/.test(d.text), 'Undo brings the table back');
    });
  });

  app.tests.register('tables: gridlines on screen, never in print or export HTML', async () => {
    const before = app.settings.get('tableGridlines', true);
    try {
      app.settings.set('tableGridlines', true); paintGrid();
      A(document.body.classList.contains('mk-table-gridlines'), 'gridlines class on');
      await withWord('| a | b |\n| --- | --- |\n| 1 | 2 |', async (ed) => {
        const td = ed.page.querySelector('td'); const cs = getComputedStyle(td);
        A(/dashed|gradient/.test(cs.backgroundImage + cs.outlineStyle + cs.borderStyle), 'a dashed gridline is drawn: ' + cs.backgroundImage.slice(0, 80));
      });
      if (app.exporter?.buildHtml) {
        const d = app.docs.create ? null : null; void d;
        const doc = E.fakeDoc('| a | b |\n| --- | --- |\n| 1 | 2 |');
        const html = await app.exporter.buildHtml(doc, { forPrint: true });
        A(/<table/.test(html), 'export has the table');
        A(!/mk-table-gridlines|--mk-grid/.test(html), 'no gridlines in print/export HTML');
      }
      app.settings.set('tableGridlines', false); paintGrid();
      A(!document.body.classList.contains('mk-table-gridlines'), 'View Gridlines turns them off');
    } finally { app.settings.set('tableGridlines', before); paintGrid(); }
  });

  app.tests.register('tables: Insert → Table picker, contextual tabs, styles', async () => {
    const pop = insertPicker({ x: 200, y: 140 });
    await sleep(60);
    A(pop && pop.querySelectorAll('.mkt-cell').length === PICK_COLS * PICK_ROWS, 'grid is 10 × 8');
    const cell = pop.querySelector('.mkt-cell[data-r="2"][data-c="3"]'); cell.dispatchEvent(new MouseEvent('mouseenter'));
    A(/3×2 Table/.test(pop.querySelector('.mkt-pick-label').textContent), 'label follows the pointer: ' + pop.querySelector('.mkt-pick-label').textContent);
    A(pop.querySelectorAll('.mkt-cell.on').length === 6, 'six cells lit');
    try { await app.mk.invoke('smoke-shot', 'table-picker'); } catch {}
    E.closeMenu?.();
    // every new command has a ScreenTip
    const ids = app.commands.list().map(c => c.id).filter(id => /^table\./.test(id));
    const missing = ids.filter(id => { const i = app.tooltips?.info?.(id); return !i || !i.title || !i.description; });
    A(!missing.length, 'commands without a ScreenTip: ' + missing.join(', '));
    // styles
    A(styleCss('striped', '.x').includes('nth-child(even)') && styleCss('default', '.x') === '', 'style CSS');
    const fd = E.fakeDoc('---\ntable-style: academic\n---\n\n| a |\n| - |\n| 1 |'); A(TB.style(fd) === 'academic', 'style from front matter: ' + TB.style(fd));
  });

  app.tests.register('tables: Inline mode cells edit like Word (Tab, typing, new row)', async () => {
    if (!E.createInline || !E.fakeDoc) return;
    const host = E._offscreen(); const ed = E.createInline(); const d = E.fakeDoc('Intro\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nEnd');
    try {
      ed.mount(host, d); await ed.whenIdle(); await until(() => ed.page?.querySelector('table'));
      E.testTarget = ed;
      if (typeof ed.openTableCell !== 'function') { A(false, 'inline editor has openTableCell'); return; }
      await ed.openTableCell(2, 1, 0);
      const cur = () => ed.tableCell?.();
      A(cur() && cur().row === 1 && cur().col === 0, 'cell editor open: ' + JSON.stringify(cur()));
      const td = cur().element; td.focus();
      const key = (k, o = {}) => (cur()?.element || td).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }));
      // type into the cell
      const r = document.createRange(); r.selectNodeContents(td); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r);
      document.execCommand('insertText', false, '0');
      await sleep(10);
      eq(d.text, 'Intro\n\n| a | b |\n| --- | --- |\n| 10 | 2 |\n\nEnd', 'typing in a cell');
      await ed.undo(); await ed.whenIdle(); await sleep(20);
      eq(d.text, 'Intro\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nEnd', 'Undo in a cell');
      A(cur() && cur().row === 1 && cur().col === 0, 'Undo goes back to the cell: ' + JSON.stringify(cur() && { row: cur().row, col: cur().col }));
      await ed.redo(); await ed.whenIdle(); await sleep(20);
      eq(d.text, 'Intro\n\n| a | b |\n| --- | --- |\n| 10 | 2 |\n\nEnd', 'Redo in a cell');
      key('Tab'); await ed.whenIdle(); await sleep(30);
      A(cur() && cur().row === 1 && cur().col === 1, 'Tab → next cell: ' + JSON.stringify(cur() && { row: cur().row, col: cur().col }));
      key('Tab'); await ed.whenIdle(); await until(() => cur() && cur().row === 2);
      eq(d.text, 'Intro\n\n| a | b |\n| --- | --- |\n| 10 | 2 |\n|  |  |\n\nEnd', 'Tab in the last cell adds a row');
      A(cur() && cur().row === 2 && cur().col === 0, 'caret in the new row');
      await app.commands.run('table.colRight'); await ed.whenIdle(); await sleep(30);
      eq(d.text, 'Intro\n\n| a |  | b |\n| --- | --- | --- |\n| 10 |  | 2 |\n|  |  |  |\n\nEnd', 'Table Layout → Insert Right in Inline mode');
      key('Escape'); await ed.whenIdle();
      A(!cur(), 'Esc leaves the cell');
    } finally { E.testTarget = null; ed.unmount(); host.remove(); }
  });

  app.tests.register('tables: screenshot with the caret in a table (table-word)', async () => {
    const d0 = app.docs.active(), m0 = app.mode;
    if (!app.docs.create || !app.mk?.invoke) return;
    const doc = app.docs.create({ text: '# Results\n\nThe runs are in the table below.\n\n| Run | Discharge (L/s) | Depth (mm) | Notes |\n| :-- | --: | --: | :-: |\n| R1 | 12.5 | 41 | steady |\n| R2 | 18.0 | 55 | ripples |\n| R3 | 24.2 | 63 | dunes |\n\nTable: Flume runs {#tbl:runs}\n\nMore text after the table.\n', title: 'Tables demo', ext: '.md', kind: 'markdown' });
    try {
      app.docs.activate?.(doc.id);
      app.setMode?.('word'); await sleep(400);
      const ed = app.editors.active(); await until(() => ed?.page?.querySelector?.('table'));
      ed.page.focus(); caretIn(ed.page.querySelectorAll('tbody tr')[1].cells[1], true);
      app.events.emit('selection:changed', { mode: 'word', states: ed.activeStates?.() || {} });
      await sleep(250); await refreshState();
      try { app.shell?.selectTab?.(contextual || R.tabs().some(t => t.id === 'tableLayout' && t.groups.length) ? 'tableLayout' : 'insert'); } catch {}
      await sleep(250);
      A(document.body.classList.contains('mk-in-table'), 'caret in a table shows the table tabs');
      try { await app.mk.invoke('smoke-shot', 'table-word'); } catch {}
      try { app.shell?.selectTab?.('tableDesign'); await sleep(200); await app.mk.invoke('smoke-shot', 'table-design'); } catch {}
      try {
        app.setMode?.('inline'); await sleep(500);
        const ie = app.editors.active(); await until(() => ie?.page?.querySelector?.('table'));
        const headerLine = linesOf(doc.text).findIndex(l => l.startsWith('| Run'));
        await ie.openTableCell?.(headerLine, 2, 1); await sleep(250);
        await app.mk.invoke('smoke-shot', 'table-inline');
      } catch (err) { console.warn(err); }
    } finally {
      try { app.docs.close(doc.id, { force: true }); } catch {}
      if (d0) try { app.docs.activate(d0.id); } catch {}
      if (m0 && m0 !== app.mode) try { app.setMode(m0); } catch {}
    }
  });

  // ---------- Office tables (fixtures in test/fixtures/clipboard: what Word, Excel, Google Sheets and LibreOffice put on the clipboard)
  const fixture = async name => { try { const r = await fetch('../test/fixtures/clipboard/' + name); return r.ok ? r.text() : null; } catch { return null; } };
  const tableOf = md => { const m = TB.parse(md, linesOf(md).findIndex(l => /^\|/.test(l))); A(m, 'a pipe table: ' + md); return m; };
  const EXCEL_TSV = 'Run\tQ (L/s)\tDepth\tBed\r\nR1\t12.50\t41\tsand\r\nR2\t18.00\t55\t\r\nR3\t24.20\t63\t"dunes\nlate"\r\n';
  function pasteEvent(target, data) {
    const dt = new DataTransfer(); for (const [k, v] of Object.entries(data)) dt.setData(k, v);
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    target.dispatchEvent(ev); return ev;
  }

  app.tests.register('tables: Office paste turns Word, Excel, Google Sheets and LibreOffice tables into Markdown tables', async () => {
    const word = await fixture('word-table.html'); if (!word) return; // fixtures are not packaged
    let r = O.fromHtml(word, { merged: 'blank' });
    A(r.source === 'word' && r.onlyTables && r.tables.length === 1, 'Word: one table, ' + JSON.stringify({ s: r.source, n: r.tables.length, only: r.onlyTables }));
    let m = tableOf(r.md);
    eq(JSON.stringify(m.header), JSON.stringify(['Station', 'Discharge (m^3^/s)', 'Notes']), 'Word header (bold dropped, superscript kept)');
    eq(JSON.stringify(m.align), JSON.stringify([null, 'right', null]), 'Word alignment');
    eq(m.rows[0][2], '*Peak* in July<br>see [gauge data](https://example.org/tarbela)', 'Word: italic, two paragraphs → <br>, link');
    eq(m.rows[1][1], 'Data pending \\| check later', 'Word: | escaped, spelling marks dropped');
    A(m.rows[1][2] === '' && r.tables[0].merged === 1, 'Word: merged cell split, extra cell empty');
    A(!/o:p|mso|MsoNormal|windowtext/.test(r.md), 'no Office styling left: ' + r.md);

    const excel = await fixture('excel-table.html');
    r = O.fromHtml(excel, { merged: 'blank' }); m = tableOf(r.md);
    A(r.source === 'excel', 'Excel detected');
    eq(JSON.stringify(m.header), JSON.stringify(['Run', 'Q (L/s)', 'Depth', 'Bed']), 'Excel header from class styles');
    eq(JSON.stringify(m.align), JSON.stringify([null, 'right', 'right', 'center']), 'Excel alignment (numbers right, class text-align)');
    eq(JSON.stringify(m.rows.map(x => x.join(' ; '))), JSON.stringify(['R1 ; 12.50 ; 41 ; sand', 'R2 ; 18.00 ; 55 ; ', 'R3 ; 24.20 ; 63 ; *dunes*<br>*late*']), 'Excel cells (rowspan left empty, <br> in a cell, italic from a class)');
    m = tableOf(O.fromHtml(excel, { merged: 'repeat' }).md);
    eq(m.rows[1][3], 'sand', 'merged cells can repeat the text');

    const tsv = O.fromTsv(EXCEL_TSV); m = tableOf(tsv.md);
    A(O.looksLikeTsv(EXCEL_TSV) && !O.looksLikeTsv('a\tb') && !O.looksLikeTsv('one line\nno tabs'), 'TSV detection');
    eq(JSON.stringify([m.header, m.align, m.rows[2]]), JSON.stringify([['Run', 'Q (L/s)', 'Depth', 'Bed'], [null, 'right', 'right', null], ['R3', '24.20', '63', 'dunes<br>late']]), 'Excel TSV with a quoted line break');

    const sheets = await fixture('gsheets-table.html');
    r = O.fromHtml(sheets); m = tableOf(r.md);
    A(r.source === 'sheets' && m.rows.length === 2, 'Google Sheets: trailing empty row dropped, got ' + m.rows.length);
    eq(JSON.stringify([m.header, m.align, m.rows[0], m.rows[1]]), JSON.stringify([['City', 'Population', 'Province'], [null, 'right', null], ['Lahore', '13,004,135', '~~Punjab~~'], ['[Karachi](https://en.wikipedia.org/wiki/Karachi)', '14,916,456', '*Sindh*']]), 'Google Sheets cells');

    const lo = await fixture('libreoffice-table.html');
    r = O.fromHtml(lo); m = tableOf(r.md);
    eq(JSON.stringify([m.header, m.align, m.rows]), JSON.stringify([['Item', 'Cost \\$'], [null, 'right'], [['Pipe \\*PVC\\*', '120'], ['Valve_2', '45.5']]]), 'LibreOffice: Markdown characters escaped');

    const mixed = await fixture('word-mixed.html');
    r = O.fromHtml(mixed);
    A(!r.onlyTables && /Table 1: Flume runs[\s\S]*\| A +\| B +\|[\s\S]*The runs are \*\*steady\*\*\./.test(r.md), 'Word text around a table keeps its order: ' + r.md);
    // every result renders as exactly one table with the same cells
    for (const md of [O.fromHtml(word).md, O.fromHtml(excel).md, tsv.md, O.fromHtml(sheets).md, O.fromHtml(lo).md]) {
      const box = document.createElement('div'); box.innerHTML = (app.mk || window.mk).render(md, {}).html;
      A(box.querySelectorAll('table').length === 1 && box.querySelectorAll('table tr').length === linesOf(md).length - 1, 'renders as one table: ' + md);
    }
  });

  app.tests.register('tables: Office paste in Simple, Word and Inline modes, into a table cell, and big tables stay fast', async () => {
    // the fixtures are not packaged: there, a small Excel-like table with the same cells as EXCEL_TSV stands in
    const excel = await fixture('excel-table.html') || '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table><tr><td>Run</td><td>Q (L/s)</td><td>Depth</td><td>Bed</td></tr><tr><td>R1</td><td align=right>12.50</td><td align=right>41</td><td>sand</td></tr><tr><td>R2</td><td align=right>18.00</td><td align=right>55</td><td></td></tr><tr><td>R3</td><td align=right>24.20</td><td align=right>63</td><td>dunes<br>late</td></tr></table></body></html>';
    if (!E.createSimple || !E.fakeDoc) return;
    // Simple mode: a new table at the caret
    let host = E._offscreen(), ed = E.createSimple(), d = E.fakeDoc('Intro\n\nEnd');
    try {
      ed.mount(host, d); await sleep(30); E.testTarget = ed;
      ed.setSelection(5);
      const ev = pasteEvent(ed.textarea, { 'text/html': excel, 'text/plain': EXCEL_TSV });
      A(ev.defaultPrevented, 'Simple: paste taken over');
      await until(() => /\| R3/.test(d.text));
      A(/^Intro\n\n\| Run +\| Q \(L\/s\) \|/.test(d.text) && /\n\nEnd$/.test(d.text), 'Simple: table between the paragraphs: ' + JSON.stringify(d.text));
      // into a table: cells written over from the caret cell, rows added
      d.setText('| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |', 'test'); ed.refresh?.(); await sleep(20);
      ed.setSelection(d.text.indexOf('2'));
      pasteEvent(ed.textarea, { 'text/plain': 'x\ty\nz\tw\n' });
      await until(() => /\| z/.test(d.text));
      eq(d.text, '| a | b | c |\n| --- | --- | --- |\n| 1 | x | y |\n|  | z | w |', 'Simple: 2 × 2 cells pasted into the table');
      // in a code block: left alone
      d.setText('```\ncode\n```', 'test'); ed.refresh?.(); await sleep(20); ed.setSelection(4);
      A(!pasteEvent(ed.textarea, { 'text/plain': 'x\ty\nz\tw\n' }).defaultPrevented, 'code blocks get the plain text');
    } finally { E.testTarget = null; ed.unmount(); host.remove(); }
    // Word mode
    if (E.createWord) {
      host = E._offscreen(); ed = E.createWord(); d = E.fakeDoc('Intro\n\nEnd');
      try {
        ed.mount(host, d); await until(() => ed.page?.querySelector('p')); await sleep(60); E.testTarget = ed;
        const page = ed.page; page.focus(); caretIn(page.querySelector('p'), true);
        pasteEvent(page, { 'text/html': excel, 'text/plain': EXCEL_TSV });
        await until(() => /\| R3/.test(d.text) || page.querySelector('table'));
        ed._commit?.(); ed.flush?.(); await sleep(60);
        A(/\| *Run *\| *Q \(L\/s\) *\|/.test(d.text) && /Intro/.test(d.text) && /End/.test(d.text), 'Word: a pipe table in the Markdown: ' + JSON.stringify(d.text));
        A(page.querySelectorAll('table').length === 1, 'Word: one table on the page');
      } finally { E.testTarget = null; ed.unmount(); host.remove(); }
    }
    // Inline mode
    if (E.createInline) {
      host = E._offscreen(); ed = E.createInline(); d = E.fakeDoc('Intro\n\nEnd');
      try {
        ed.mount(host, d); await ed.whenIdle?.(); await sleep(60); E.testTarget = ed;
        await ed.setSelection(5, 5); await ed.whenIdle?.(); await sleep(40);
        const target = ed.getSurface?.() || ed.page;
        const el = target.querySelector('[contenteditable="true"]') || target;
        pasteEvent(el, { 'text/html': excel, 'text/plain': EXCEL_TSV });
        await until(() => /\| R3/.test(d.text));
        A(/\| *Run *\|/.test(d.text) && /Intro/.test(d.text) && /End/.test(d.text), 'Inline: a pipe table in the Markdown: ' + JSON.stringify(d.text));
      } finally { E.testTarget = null; ed.unmount(); host.remove(); }
    }
    // a big Excel range converts quickly
    const rows = Array.from({ length: 3000 }, (_, i) => `<tr><td class=xl65>R${i}</td>${Array.from({ length: 8 }, (_, k) => `<td align=right>${(i * k / 7).toFixed(2)}</td>`).join('')}</tr>`).join('');
    const big = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><style>.xl65{font-weight:700}</style></head><body><table>${rows}</table></body></html>`;
    const t0 = performance.now(); const r = O.fromHtml(big); const ms = performance.now() - t0;
    A(r.tables[0].rows === 3000 && r.tables[0].cols === 9, 'big table size');
    A(ms < 4000, `3000 × 9 cells convert in ${Math.round(ms)} ms (limit 4000)`);
  });

  app.tests.register('tables: copy for Word/Excel puts a bordered HTML table and tab-separated text on the clipboard', async () => {
    const src = 'Top\n\n| Name | Value |\n| --- | ---: |\n| **Flow** | 12.5 |\n| Note | two<br>lines |\n\nAfter';
    // the command (Simple mode, caret in the table); a test writer keeps the real clipboard untouched
    let host = E._offscreen(), ed = E.createSimple(), d = E.fakeDoc(src), got = null;
    try {
      ed.mount(host, d); await sleep(30); E.testTarget = ed; ed.setSelection(src.indexOf('Flow'));
      await O.copyTable({ editor: ed, write: x => { got = x; } });
      A(got && /<table[^>]*border="1"[^>]*border-collapse:collapse/.test(got.html), 'HTML table with borders: ' + (got && got.html.slice(0, 200)));
      A(/<th[^>]*>Name<\/th>/.test(got.html) && /<strong>Flow<\/strong>|<b>Flow<\/b>/.test(got.html) && /text-align:right/.test(got.html), 'header, bold and alignment kept: ' + got.html);
      eq(got.text, 'Name\tValue\r\nFlow\t12.5\r\nNote\t"two\nlines"', 'tab-separated text for Excel');
      // Ctrl+C in Simple mode: the Markdown stays the plain text, Word/Excel get the table
      ed.setSelection(src.indexOf('| Name'), src.indexOf('lines |') + 7);
      const dt = new DataTransfer(); const ev = new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true }); ed.textarea.dispatchEvent(ev);
      A(ev.defaultPrevented && dt.getData('text/plain').startsWith('| Name | Value |') && /data-markooj-copy="simple"[\s\S]*<table/.test(dt.getData('text/html')), 'Simple mode copy: Markdown + table');
    } finally { E.testTarget = null; ed.unmount(); host.remove(); }
    // Word mode: select from the first header cell to the last cell and copy
    await withWord(src, async (edw) => {
      const page = edw.page; page.focus();
      const ths = page.querySelectorAll('th'), tds = page.querySelectorAll('td');
      const r = document.createRange(); r.setStart(ths[0].firstChild || ths[0], 0); r.setEnd(tds[tds.length - 1].lastChild || tds[tds.length - 1], 1);
      getSelection().removeAllRanges(); getSelection().addRange(r);
      const dt = new DataTransfer(); const ev = new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true }); page.dispatchEvent(ev);
      A(ev.defaultPrevented, 'Word mode copy handled');
      A(/<table[^>]*border="1"/.test(dt.getData('text/html')) && !/contenteditable|data-line|mk-/.test(dt.getData('text/html')), 'clean HTML: ' + dt.getData('text/html').slice(0, 300));
      eq(dt.getData('text/plain'), 'Name\tValue\r\nFlow\t12.5\r\nNote\t"two\nlines"', 'Word mode: tab-separated text');
      // and it comes back as a table when pasted into Markooj
      const back = O.fromHtml(dt.getData('text/html')); const m = tableOf(back.md);
      eq(JSON.stringify([m.header, m.rows]), JSON.stringify([['Name', 'Value'], [['**Flow**', '12.5'], ['Note', 'two<br>lines']]]), 'round trip through the clipboard');
    });
    A(app.commands.get('table.copyOffice') && app.tooltips?.info?.('table.copyOffice')?.title, 'command with a ScreenTip');
    const groups = GROUPS.tableDesign.concat(GROUPS.tableLayout).flatMap(g => JSON.stringify(g.items));
    A(groups.filter(s => s.includes('table.copyOffice')).length === 2, 'on Table Design and Table Layout');
  });

  app.tests.register('tables: Word and LibreOffice exports keep line breaks in cells and captions of pictures in cells', () => {
    const md = 'Text<br>here\n\n| A | B |\n| --- | --- |\n| x<br>y | ![Fig. 1. Flume](f.png){#fig:flume} |\n';
    const dx = TB.exportMarkdown(md, 'docx');
    A(dx.startsWith('Text<br>here\n'), 'outside tables untouched');
    A(dx.includes('| x`<w:br/>`{=openxml}y |'), 'DOCX line break: ' + dx);
    A(dx.includes('![Fig. 1. Flume](f.png){#fig:flume}`<w:br/>`{=openxml}*Fig. 1. Flume*'), 'caption under a picture in a cell: ' + dx);
    A(TB.exportMarkdown(md, 'odt').includes('`<text:line-break/>`{=opendocument}'), 'ODT line break');
    A(TB.exportMarkdown(md, 'html').includes('| x<br>y |'), 'HTML keeps <br>');
  });
})();
