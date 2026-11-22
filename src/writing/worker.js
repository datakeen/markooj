// Markooj — Writing Assistant worker: Harper (grammar, WASM) + Markooj's own rules, off the main thread.
// Loaded as a module worker over markooj://app/src/writing/worker.js. Results are cached per paragraph, so
// typing in one paragraph only checks that paragraph again. Spelling (nspell) runs in the page through preload;
// near-miss and full spelling for language packs (format 2) run here, on a word list the page sends once per language.
import './rules.js';

const R = globalThis.MkWritingRules;
let harper = null, harperState = 'idle', harperError = '', dialectNow = null, descriptions = {}, harperCfg = null;
const ownCache = new Map(), harperCache = new Map(), sentTokens = new Set();
// near-miss and full spelling (language packs, format 2): one index per language, built when the page sends its word
// list (a full list's suggestion index is built on its first unknown word)
const nmIndex = new Map(), nmCache = new Map();
const trim = m => { if (m.size > 6000) { let n = m.size - 4000; for (const k of m.keys()) { m.delete(k); if (--n <= 0) break; } } };

let harperInit = null;
function initHarper(dialect) {
  if (!harperInit) harperInit = (async () => {
    harperState = 'loading';
    const [{ LocalLinter, Dialect }, { binary }] = await Promise.all([import('../../node_modules/harper.js/dist/index.js'), import('../../node_modules/harper.js/dist/binary.js')]);
    harper = { linter: new LocalLinter({ binary, dialect: dialect === 'UK' ? Dialect.British : Dialect.American }), Dialect };
    const cfg = await harper.linter.getDefaultLintConfig();
    for (const k of R.HARPER_OFF) if (k in cfg) cfg[k] = false;
    harperCfg = cfg; // kept: setDialect builds a new inner linter with the default rules, so it is set again after each switch
    await harper.linter.setLintConfig(cfg);
    dialectNow = dialect;
    try { descriptions = await harper.linter.getLintDescriptions(); } catch { descriptions = {}; }
    await harper.linter.lint('Ready.', { language: 'plaintext' });
    harperState = 'ready';
    postMessage({ type: 'harper', state: 'ready', descriptions });
    return harper.linter;
  })().catch(e => {
    harperState = 'failed'; harperError = String(e && e.message || e);
    postMessage({ type: 'harper', state: 'failed', error: harperError });
    return null;
  });
  return harperInit;
}
async function loadHarper(dialect) {
  const linter = await initHarper(dialect);
  if (!linter) return null;
  if (dialect !== dialectNow) {
    try {
      await linter.setDialect(dialect === 'UK' ? harper.Dialect.British : harper.Dialect.American);
      if (harperCfg) await linter.setLintConfig(harperCfg); // the rules Markooj turns off stay off in every dialect
      dialectNow = dialect; harperCache.clear();
    } catch {}
  }
  return linter;
}

// Harper counts characters (code points); JavaScript strings count UTF-16 units.
function cpToUnits(text) {
  if (!/[\uD800-\uDFFF]/.test(text)) return null;
  const map = []; let u = 0;
  for (const ch of text) { map.push(u); u += ch.length; }
  map.push(u);
  return map;
}

// Harper is called once for many paragraphs (each call has a fixed cost); lints are split back per paragraph.
async function harperBatch(linter, blocks, flags) {
  // non-prose text becomes spaces so Harper never sees code or math, but keeps the Markdown marks it understands
  let src = ''; const at = [];
  for (const b of blocks) {
    if (src) src += '\n\n';
    at.push(src.length);
    for (let i = 0; i < b.raw.length; i++) { const c = b.raw[i]; src += flags[b.start + i] === 1 && c !== '\n' ? ' ' : c; }
  }
  const out = blocks.map(() => []);
  const groups = await linter.organizedLints(src, { language: 'markdown' });
  const map = cpToUnits(src);
  for (const [ruleName, lints] of Object.entries(groups)) {
    for (const l of lints) {
      try {
        const sp = l.span(); let s = sp.start, e = sp.end; sp.free?.();
        if (map) { s = map[s] ?? s; e = map[e] ?? e; }
        let lo = 0, hi = at.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (at[mid] <= s) lo = mid; else hi = mid - 1; }
        const bi = lo, b = blocks[bi], rs = s - at[bi], re = e - at[bi];
        if (rs < 0 || re > b.raw.length) continue; // crosses a paragraph boundary
        const text = b.raw.slice(rs, re);
        if (!text.trim() || /^\s*#/.test(text)) continue; // headings: Markdown marks, not grammar
        // units and symbols (m3/s, CO2, H2O) are not words with a "canonical" capitalization
        if (ruleName === 'OrthographicConsistency' && (/\d/.test(text) || b.raw[rs - 1] === '/' || b.raw[re] === '/')) continue;
        const kind = l.lint_kind();
        const k = R.HARPER_KINDS[kind] || ['correctness', kind];
        const reps = [];
        for (const sg of l.suggestions()) {
          const kd = sg.kind(), r = sg.get_replacement_text();
          reps.push(kd === 1 ? '' : kd === 2 ? text + r : r);
          sg.free?.();
        }
        out[bi].push({ rule: 'harper:' + ruleName, source: 'harper', harperRule: ruleName, kind, cat: R.HARPER_CAT[ruleName] || k[0], title: k[1], start: rs, end: re, text, message: String(l.message() || '').replace(/`([^`]*)`/g, '“$1”'), replacements: [...new Set(reps)].slice(0, 5), formalOnly: R.HARPER_FORMAL.includes(ruleName) });
      } catch {} finally { try { l.free?.(); } catch {} }
    }
  }
  return out;
}

function mapHarper(list, block, p, want) {
  const out = [];
  for (const f of list) {
    if (f.formalOnly && !want.formal) continue;
    const g = { ...f, start: f.start + block.start, end: f.end + block.start };
    let marks = false;
    for (let i = g.start; i < g.end; i++) if (p.flags[i] === 2) { marks = true; break; }
    if (marks) g.replacements = [];
    g.safe = !marks && g.replacements.length === 1 && /^(Repetition|Miscellaneous|Capitalization)$/.test(f.kind);
    out.push(g);
  }
  return out;
}

const tick = () => new Promise(r => setTimeout(r, 0));

async function check(msg) {
  const { id, text, ctx = {} } = msg;
  const key = msg.key || 'k' + id;
  const stale = () => newest.get(key) !== id;
  const t0 = performance.now();
  const p = R.prose(text);
  const blocks = R.blocks(p);
  const want = R.goalsWant(ctx.goals);
  const c = { dialect: ctx.dialect, longSentence: ctx.longSentence, want };
  const english = ctx.english !== false;
  const sig = JSON.stringify([ctx.dialect, ctx.goals, ctx.longSentence, english, (ctx.customRules || []).length]);
  const own = [];
  for (const b of blocks) {
    const key = sig + '\u0000' + b.raw;
    let rel = ownCache.get(key);
    if (!rel) {
      rel = english ? R.checkBlock(b, c) : [];
      if (ctx.customRules && ctx.customRules.length) rel = rel.concat(R.checkCustom(b, ctx.customRules));
      ownCache.set(key, rel);
    }
    for (const f of rel) own.push({ ...f, start: f.start + b.start, end: f.end + b.start });
  }
  trim(ownCache);
  const nm = ctx.nearMiss ? nmIndex.get(ctx.nearMiss) : null;
  if (nm) {
    for (const b of blocks) {
      const k = ctx.nearMiss + '\u0000' + b.raw;
      let rel = nmCache.get(k);
      if (!rel) { rel = R.nmFindings(nm, b, ctx.nearMissName); nmCache.set(k, rel); }
      for (const f of rel) own.push({ ...f, _sugg: f._sugg.slice(), start: f.start + b.start, end: f.end + b.start });
    }
    trim(nmCache);
  }
  if (english) own.push(...R.checkDoc(p, blocks, c));
  const ownF = R.dropMasked(own, p.flags);
  const blockInfo = blocks.map(b => [b.start, b.end]);
  const words = blocks.reduce((n, b) => n + R.countWords(b.text), 0);
  // words to spell-check, sent once per paragraph text (the page keeps them)
  if (ctx.tokens === 'all') sentTokens.clear();
  const tokens = [];
  for (const b of blocks) if (!sentTokens.has(b.raw)) { sentTokens.add(b.raw); tokens.push([b.raw, R.spellTokens(b.text).map(t => [t.w, t.start, t.end])]); }
  if (sentTokens.size > 8000) sentTokens.clear();
  if (tokens.length) postMessage({ type: 'tokens', tokens });
  const base = { type: 'result', id, words, blocks: blockInfo, ownMs: Math.round(performance.now() - t0) };

  if (!english || ctx.harper === false) { postMessage({ ...base, findings: ownF, final: true, harper: 'off' }); return; }
  if (harperState !== 'ready') postMessage({ ...base, findings: ownF, final: false, harper: harperState });
  const l0 = performance.now();
  const linter = await loadHarper(ctx.dialect === 'UK' ? 'UK' : 'US');
  base.loadMs = Math.round(performance.now() - l0);
  if (!linter) { postMessage({ ...base, findings: ownF, final: true, harper: harperState, harperError }); return; }
  const hsig = (ctx.dialect === 'UK' ? 'UK' : 'US') + '\u0000';
  const focus = +ctx.focus || 0;
  const missing = blocks.filter(b => !harperCache.has(hsig + b.raw)).sort((x, y) => Math.abs(x.start - focus) - Math.abs(y.start - focus));
  const collect = () => {
    const hs = [];
    for (const b of blocks) { const rel = harperCache.get(hsig + b.raw); if (rel) hs.push(...mapHarper(rel, b, p, want)); }
    return R.dropMasked(hs, p.flags);
  };
  if (missing.length > 8) { postMessage({ ...base, findings: ownF.concat(collect()), final: false, harper: 'checking', pending: missing.length }); }
  let since = performance.now(), lastPost = performance.now(); const h0 = performance.now(); let batches = 0;
  for (let i = 0; i < missing.length;) {
    batches++;
    // about 3,000 characters per call keeps each pause short and the fixed cost low
    const batch = []; let len = 0;
    while (i < missing.length && (len < 3000 || !batch.length)) { batch.push(missing[i]); len += missing[i].raw.length; i++; }
    try { const res = await harperBatch(linter, batch, p.flags); batch.forEach((b, k) => harperCache.set(hsig + b.raw, res[k])); } catch (e) { batch.forEach(b => harperCache.set(hsig + b.raw, [])); }
    if (performance.now() - lastPost > 1500 && i < missing.length) { lastPost = performance.now(); postMessage({ ...base, findings: ownF.concat(collect()), final: false, harper: 'checking', pending: missing.length - i }); }
    if (performance.now() - since > 40) { await tick(); since = performance.now(); if (stale()) { postMessage({ type: 'result', id, final: true, superseded: true, findings: [] }); return; } }
  }
  trim(harperCache);
  postMessage({ ...base, findings: ownF.concat(collect()), final: true, harper: 'ready', ms: Math.round(performance.now() - t0), harperMs: Math.round(performance.now() - h0), batches, loadMs: base.loadMs });
}

// A newer check of the same document replaces a waiting one; the replaced one is answered at once.
let chain = Promise.resolve();
const newest = new Map();
self.onmessage = e => {
  const msg = e.data || {};
  if (msg.type === 'check') {
    const key = msg.key || 'k' + msg.id;
    newest.set(key, msg.id);
    chain = chain.then(() => {
      if (newest.get(key) !== msg.id) { postMessage({ type: 'result', id: msg.id, final: true, superseded: true, findings: [] }); return null; }
      return check(msg);
    }).catch(err => postMessage({ type: 'error', id: msg.id, error: String(err && err.stack || err) }));
  }
  else if (msg.type === 'nearmiss') {
    // a new or updated word list (or none: the language was removed)
    const t0 = performance.now();
    if (msg.mode === 'full' && msg.list) nmIndex.set(msg.code, R.fsBuild({ list: msg.list, rank: msg.rank, prefix: msg.prefix, suffix: msg.suffix, similar: msg.similar }));
    else if (msg.words && msg.words.length) nmIndex.set(msg.code, R.nmBuild({ words: msg.words, prefix: msg.prefix, suffix: msg.suffix }));
    else nmIndex.delete(msg.code);
    nmCache.clear();
    postMessage({ type: 'nearmiss', code: msg.code, size: nmIndex.get(msg.code)?.size || 0, ms: Math.round(performance.now() - t0) });
  }
  else if (msg.type === 'warm') initHarper(msg.dialect === 'UK' ? 'UK' : 'US');
  else if (msg.type === 'ping') postMessage({ type: 'pong', harper: harperState, harperError });
};
postMessage({ type: 'hello' });
