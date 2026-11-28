/* i18n-aliases: cardAttr, cardText */
// Markooj — Writing Assistant core (app.writing): checking, spelling, underlines, cards, fixes, thesaurus data.
// Rules: src/writing/rules.js (shared with the worker). Grammar: Harper in src/writing/worker.js. Spelling: nspell
// through preload (mk.spell). The UI around it (pane, F7, menus, options, ribbon) is in src/writing/ui.js.
// Markooj never changes text by itself: every fix is a click, and goes through doc.setText so Undo works.
(function () {
  'use strict';
  const app = window.app;
  const R = window.MkWritingRules;
  if (!app || !R) return;
  const mk = window.mk || {};
  const esc = app.esc;
  const W = app.writing = app.writing || {};
  W.rulesEngine = R;

  // =================================================================== settings
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const S = W.settings = {
    on: () => app.settings.get('writingAssistant', true) !== false,
    spell: () => app.settings.get('spellcheck', true) !== false,
    lang: () => app.settings.get('proofingLanguage', 'en-US') || 'en-US',
    long: () => clamp(Math.round(+app.settings.get('writingLongSentence', 30) || 30), 10, 80),
    goals: () => ({ ...R.DEFAULT_GOALS, ...(app.settings.get('writingGoals', null) || {}) }),
    cats: () => ({ correctness: true, clarity: true, engagement: true, delivery: true, ...(app.settings.get('writingCategories', null) || {}) }),
    ignoredRules: () => new Set(app.settings.get('writingIgnoredRules', []) || []),
    dict: () => (app.settings.get('writingDictionary', []) || []).filter(w => typeof w === 'string'),
    autocomplete: () => app.settings.get('writingAutocomplete', false) === true,
    domainWords: () => app.settings.get('writingDomainWords', true) !== false,
    synonymsOnDoubleClick: () => app.settings.get('writingSynonymsOnDoubleClick', true) !== false,
  };

  // =================================================================== languages
  const norm = c => { try { return mk.spell?.normalize ? mk.spell.normalize(c) : String(c || 'en-US'); } catch { return 'en-US'; } };
  const LANGS = new Map([
    ['en-US', { code: 'en-US', name: 'English (US)', dir: 'ltr', english: true, dialect: 'US', builtin: true }],
    ['en-GB', { code: 'en-GB', name: 'English (UK)', dir: 'ltr', english: true, dialect: 'UK', builtin: true }],
  ]);
  /** Language packs call this: {code, name, dir, aff?, dic?, rules?, font?, spellingMode?, lexicon?, clitics?, similar?}.
   *  aff/dic are Hunspell text ("full" spelling with nspell). spellingMode 'near-miss' (pack format 2) checks against
   *  `lexicon` instead: {fields, rows} or {list: [words] | 'word\nword…', freq?: [], count?: []}, or a function that
   *  returns a Promise of either (loaded on the first check), with `clitics` {prefix: [], suffix: []}. spellingMode
   *  'full' WITH a lexicon flags every unknown word of the list's script (R.fsBuild), with suggestions helped by
   *  `similar` {groups: [{kind: 'sound'|'shape', letters: []}]} (or a function returning a Promise of it); 'full'
   *  without a lexicon uses aff/dic (nspell). */
  W.registerLanguage = function registerLanguage(o = {}) {
    const code = norm(o.code);
    if (!code || !o.name) throw new Error('A language needs a code and a name.');
    const prev = LANGS.get(code) || {};
    // the built-in languages (English US and UK) are never changed by a language pack
    if (prev.builtin) return false;
    // a word list (lexicon) drives near-miss and full spelling; full without one falls back to Hunspell (aff/dic)
    const nearMiss = (o.spellingMode === 'near-miss' || o.spellingMode === 'full') && !!o.lexicon;
    const lexMode = nearMiss ? o.spellingMode : null;
    let spelling = false;
    if (nearMiss) spelling = true;
    else if (o.aff && o.dic) { try { spelling = !!mk.spell?.register?.(code, String(o.aff), String(o.dic)); } catch { spelling = false; } }
    dropNearMiss(code);
    if (nearMiss) nmData.set(code, { mode: lexMode, src: o.lexicon, prefix: (o.clitics && o.clitics.prefix) || [], suffix: (o.clitics && o.clitics.suffix) || [], similar: o.similar || null, ready: null, words: null, idx: null });
    LANGS.set(code, { ...prev, code, name: String(o.name), dir: o.dir === 'rtl' ? 'rtl' : 'ltr', english: /^en\b/.test(code), dialect: /^en-GB/.test(code) ? 'UK' : /^en/.test(code) ? 'US' : null, rules: Array.isArray(o.rules) ? o.rules : prev.rules || [], font: o.font || prev.font || null, spelling: spelling || (!nearMiss && !o.spellingMode && prev.spelling) || false, spellingMode: nearMiss ? lexMode : spelling ? 'full' : null, wordList: nearMiss, builtin: !!prev.builtin });
    wordCache.delete(code);
    app.events.emit('writing:languages', W.languages());
    for (const d of app.docs.list()) if (W.languageFor(d).code === code) W.check(d);
    return true;
  };
  W.unregisterLanguage = code => { code = norm(code); const l = LANGS.get(code); if (!l || l.builtin) return false; LANGS.delete(code); dropNearMiss(code); app.events.emit('writing:languages', W.languages()); return true; };
  W.languages = () => [...LANGS.values()].map(({ rules, ...x }) => ({ ...x, rules: (rules || []).length }));
  /** The proofing language of a document: front matter lang:, else File → Options → Writing. */
  W.languageFor = function languageFor(doc) {
    let want = '';
    try { want = doc && doc.meta && (doc.meta.lang || doc.meta.language) ? String(doc.meta.lang || doc.meta.language) : ''; } catch {}
    const code = norm(want || S.lang());
    if (LANGS.has(code)) return LANGS.get(code);
    if (/^en\b/i.test(code)) return LANGS.get(/^en-(GB|UK|AU|NZ|IE|ZA|IN|PK)/i.test(want) ? 'en-GB' : 'en-US');
    const base = code.split('-')[0];
    for (const l of LANGS.values()) if (l.code.split('-')[0] === base) return l;
    // a readable name ("Urdu", not "ur") for the pane and messages
    let name = code; try { name = new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code; } catch {}
    return { code, name, dir: 'ltr', english: false, dialect: null, unsupported: true, rules: [] };
  };

  // =================================================================== personal dictionary
  let dictSet = new Set();
  const ignoredWords = new Set(); // "Ignore All" for this session
  function applyDictionary() {
    const words = S.dict();
    // the app's own name and the key names its manual and tutorials use are always known words
    dictSet = new Set([...words.map(w => w.toLowerCase()), 'markooj', 'ctrl']);
    // technical terms and place names (data/words-technical-en.txt, data/places-en.txt) go in beside the personal words;
    // only the ones the dictionary does not know already, so turning the list off never removes a dictionary word
    const extra = S.domainWords() ? domainNew() : [];
    try { mk.spell?.setPersonal?.(extra.length ? [...new Set([...words, ...extra])] : words); } catch {}
    wordCache.clear();
    spIndex.clear(); spBuild.clear();
  }

  // =================================================================== technical terms and place names (always on; Options → Writing)
  // Two word lists shipped in data/: hydraulics, hydropower, river engineering, fluid mechanics, engineering software and
  // units; US states and places, countries and major cities of the world, and Pakistan's provinces, regions, cities,
  // rivers, dams and barrages. Case matters like in the dictionary: "Lahore" is fine, "lahore" is marked.
  const domain = { words: null, set: null, lower: null, fresh: null, loading: null };
  function parseWordList(text) {
    const out = [];
    for (const line of String(text || '').split(/\r?\n/)) {
      const l = line.trim(); if (!l || l[0] === '#') continue;
      for (const tok of l.split(/\s+/)) {
        const m = /^(.+?)(?:\/(s|es))?$/.exec(tok); if (!m || m[1].length < 2) continue;
        out.push(m[1]); if (m[2]) out.push(m[1] + m[2]);
      }
    }
    return out;
  }
  W.parseWordList = parseWordList;
  function loadDomain() {
    if (domain.loading) return domain.loading;
    domain.loading = Promise.all(['../data/words-technical-en.txt', '../data/places-en.txt'].map(p => fetch(new URL(p, location.href)).then(r => (r.ok ? r.text() : '')).catch(() => '')))
      .then(texts => {
        const words = [...new Set(texts.flatMap(parseWordList))];
        domain.words = words; domain.set = new Set(words); domain.lower = new Set(words.map(w => w.toLowerCase())); domain.fresh = null;
        applyDictionary();
        for (const d of app.docs.list()) if (d.kind === 'markdown') schedule(d, 200);
        return words.length;
      });
    return domain.loading;
  }
  /** The listed words the bundled dictionaries do not know yet (worked out once; the personal words are set aside first). */
  function domainNew() {
    if (!domain.words) return [];
    if (domain.fresh) return domain.fresh;
    let bad = [];
    try { mk.spell?.setPersonal?.(S.dict()); bad = mk.spell?.check?.('en-US', domain.words) || []; } catch { bad = []; }
    domain.fresh = bad.map(i => domain.words[i]);
    return domain.fresh;
  }
  W.domainWords = {
    load: loadDomain, list: () => (domain.words || []).slice(), added: () => (S.domainWords() ? domainNew().slice() : []),
    /** true when `word` is one of the listed terms or places, with the case rule of the dictionary */
    has(word) {
      if (!S.domainWords() || !domain.set) return false;
      const w = String(word || '').replace(/['’]s$/, ''); if (domain.set.has(w)) return true;
      const l = w.toLowerCase();
      if (w.length > 1 && w === w.toUpperCase() && domain.lower.has(l)) return true; // PENSTOCK, LAHORE
      return w === l.charAt(0).toUpperCase() + l.slice(1) && domain.set.has(l); // a listed lower-case word at a sentence start
    },
  };

  // =================================================================== how common an English word is (ranks spelling suggestions)
  const freq = { map: null, loading: null };
  function loadFreq() {
    if (freq.loading) return freq.loading;
    freq.loading = fetch(new URL('../data/words-rank-en.txt', location.href)).then(r => (r.ok ? r.text() : '')).catch(() => '').then(text => {
      const m = new Map();
      for (const l of text.split(/\r?\n/)) { if (!l || l[0] === '#') continue; const parts = l.split(' '); const k = +parts[0]; for (let i = 1; i < parts.length; i++) m.set(parts[i], k); }
      freq.map = m; return m.size;
    });
    return freq.loading;
  }
  /** 0–9: how common a lower-case word (or the word it is built from) is. */
  function freqTier(w) {
    const m = freq.map; if (!m) return 0;
    if (m.has(w)) return m.get(w);
    for (const [re, r] of [[/ies$/, 'y'], [/ied$/, 'y'], [/([b-df-hj-np-tv-z])\1(?:ed|ing)$/, '$1'], [/(?:ed|ing)$/, 'e'], [/(?:ed|ing|es|s|ly|er|est|ness|ity|ment)$/, '']]) {
      const b = w.replace(re, r); if (b !== w && m.has(b)) return m.get(b) - 0.5;
    }
    const lm = W.lemmas ? W.lemmas(w) : [];
    for (const b of lm || []) if (b !== w && m.has(b)) return m.get(b) - 0.5;
    return 0;
  }
  W.wordFreq = freqTier;

  // =================================================================== spelling suggestion index (dictionary stems + listed terms)
  const spIndex = new Map(); // language code → R.spellIndex
  const spBuild = new Map(); // language code → a build in idle time {b, words, at}
  function spellWords(lang) {
    let words = [];
    try { words = mk.spell?.words?.(lang.code) || []; } catch { words = []; }
    if (!words.length) return [];
    if (S.domainWords() && domain.words) words = words.concat(domain.words);
    return words.concat(S.dict());
  }
  function spellIndexFor(lang) {
    let idx = spIndex.get(lang.code);
    if (idx) return idx;
    const job = spBuild.get(lang.code);
    if (job) { R.spellIndexAdd(job.b, job.words, job.at, job.words.length); spBuild.delete(lang.code); idx = R.spellIndexEnd(job.b); spIndex.set(lang.code, idx); return idx; }
    const words = spellWords(lang); if (!words.length) return null;
    idx = R.spellIndex(words);
    spIndex.set(lang.code, idx);
    return idx;
  }
  /** Build the suggestion index in small slices while the window is idle (about 0.3 s of work in all). */
  function warmSpellIndex(lang) {
    if (!lang || !lang.english || spIndex.has(lang.code) || spBuild.has(lang.code)) return;
    const words = spellWords(lang); if (!words.length) return;
    const job = { b: R.spellIndexStart(), words, at: 0 }; spBuild.set(lang.code, job);
    const idle = fn => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 30));
    const step = () => {
      if (spBuild.get(lang.code) !== job) return; // replaced, finished early or the lists changed
      const t = performance.now();
      while (job.at < words.length && performance.now() - t < 8) { R.spellIndexAdd(job.b, words, job.at, job.at + 1000); job.at += 1000; }
      if (job.at < words.length) idle(step);
      else { spBuild.delete(lang.code); spIndex.set(lang.code, R.spellIndexEnd(job.b)); }
    };
    idle(step);
  }
  W.warmSpelling = (code = 'en-US') => warmSpellIndex(LANGS.get(norm(code)));
  /** Get the spelling helpers ready (word lists, frequency tiers, suggestion index); resolves when they are. */
  W.spellReady = async (code = 'en-US') => { await Promise.all([loadDomain(), loadFreq()]); const lang = LANGS.get(norm(code)) || LANGS.get('en-US'); spellIndexFor(lang); return true; };
  W.dictionary = {
    list: () => S.dict(),
    add(word) { const w = String(word || '').trim(); if (!w || w.length > 80) return false; const list = S.dict(); if (!list.includes(w)) app.settings.set('writingDictionary', [...list, w].sort((a, b) => a.localeCompare(b))); mk.invoke?.('spell-add', w).catch?.(() => {}); return true; },
    remove(word) { app.settings.set('writingDictionary', S.dict().filter(w => w !== word)); return true; },
    set(list) { app.settings.set('writingDictionary', [...new Set((list || []).map(s => String(s).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))); },
    has: w => dictSet.has(String(w).toLowerCase()),
  };

  // =================================================================== the checking engine (worker, with an in-page fallback)
  let worker = null, workerOk = null, reqSeq = 0, harperState = 'idle';
  const pending = new Map();
  W.harperDescriptions = {};
  const tokenCache = new Map(); // paragraph source → [[word, start, end], …]
  function startWorker() {
    if (worker || workerOk === false) return worker;
    try {
      worker = new Worker(new URL('writing/worker.js', location.href), { type: 'module', name: 'markooj-writing' });
      worker.onmessage = e => {
        const m = e.data || {};
        if (m.type === 'hello') workerOk = true;
        else if (m.type === 'tokens') { for (const [raw, list] of m.tokens) tokenCache.set(raw, list); if (tokenCache.size > 12000) { tokenCache.clear(); needAllTokens = true; } }
        else if (m.type === 'harper') { harperState = m.state; if (m.descriptions) W.harperDescriptions = m.descriptions; if (m.error) console.warn('Writing Assistant: grammar checker could not start:', m.error); app.events.emit('writing:engine', { harper: harperState }); }
        else if (m.type === 'result' || m.type === 'error') { if (m.final) W.engine.last = { ms: m.ms, ownMs: m.ownMs, harperMs: m.harperMs, batches: m.batches, words: m.words }; const p = pending.get(m.id); if (!p) return; if (m.type === 'error') { pending.delete(m.id); p.reject(new Error(m.error)); return; } if (m.final) pending.delete(m.id); p.onResult(m); }
      };
      worker.onerror = e => { console.warn('Writing Assistant worker failed; checking in the page instead.', e.message || e); workerOk = false; try { worker.terminate(); } catch {} worker = null; for (const [, p] of pending) p.fallback(); pending.clear(); };
    } catch (e) { console.warn('Writing Assistant worker', e); workerOk = false; worker = null; }
    return worker;
  }
  let needAllTokens = false;
  /** Run rules (+ Harper in the worker). onResult gets partial and final results; resolves with the final one. */
  function engineCheck(text, ctx, onResult) {
    return new Promise((resolve, reject) => {
      const fallback = () => {
        try {
          const r = R.checkAll(text, ctx);
          const nm = ctx.nearMiss ? pageNearMiss(ctx.nearMiss) : null;
          if (nm) for (const b of r.blocks) for (const f of R.nmFindings(nm, b, ctx.nearMissName)) r.findings.push({ ...f, start: f.start + b.start, end: f.end + b.start });
          const tokens = []; for (const b of r.blocks) tokens.push([b.raw, R.spellTokens(b.text).map(t => [t.w, t.start, t.end])]);
          for (const [raw, list] of tokens) tokenCache.set(raw, list);
          const res = { findings: r.findings, words: r.blocks.reduce((n, b) => n + R.countWords(b.text), 0), blocks: r.blocks.map(b => [b.start, b.end]), final: true, harper: 'off' };
          onResult?.(res); resolve(res);
        } catch (e) { reject(e); }
      };
      const w = ctx.inPage ? null : startWorker();
      if (!w) { fallback(); return; }
      const id = ++reqSeq;
      pending.set(id, { onResult: m => { if (m.superseded) { resolve(null); return; } onResult?.(m); if (m.final) resolve(m); }, reject, resolve, fallback });
      w.postMessage({ type: 'check', id, key: ctx.key, text, ctx: { ...ctx, tokens: needAllTokens ? 'all' : 'new' } });
      needAllTokens = false;
    });
  }
  W.engine = { get harper() { return harperState; }, get worker() { return workerOk; }, warm: dialect => { const w = startWorker(); w?.postMessage({ type: 'warm', dialect }); } };

  // =================================================================== near-miss and full spelling (language packs, format 2)
  // The word list is loaded the first time a document in that language is checked, sent to the worker (which builds
  // its index there), and kept here for the right-click check, suggestions and the in-page fallback (index built lazily).
  // Near-miss: words = [[word, freq], …]. Full: words = {list: [word, …], rank: Float64Array} (R.fsBuild; the
  // suggestion index is built on the first unknown word).
  const nmData = new Map(); // code → {mode, src, prefix, suffix, similar, ready: Promise, words, idx}
  function dropNearMiss(code) {
    if (!nmData.has(code)) return;
    nmData.delete(code);
    try { worker?.postMessage({ type: 'nearmiss', code, words: null }); } catch {}
  }
  /** [[word, freq], …] from a lexicon {fields, rows} (or {list, freq?}); a word written with harakat (aarab) counts as the same word. */
  function lexiconWords(lex) {
    if (lex && lex.list != null && !lex.fields) {
      const words = typeof lex.list === 'string' ? (lex.list ? lex.list.split('\n') : []) : Array.isArray(lex.list) ? lex.list : [];
      return words.filter(w => typeof w === 'string' && w).map((w, i) => [w, lex.freq ? +lex.freq[i] || 0 : 3]);
    }
    if (!lex || !Array.isArray(lex.fields) || !Array.isArray(lex.rows)) return [];
    const wi = lex.fields.indexOf('word'), fi = lex.fields.indexOf('freq'), ai = lex.fields.indexOf('aarab');
    if (wi < 0) return [];
    const out = [];
    for (const r of lex.rows) {
      if (!Array.isArray(r) || typeof r[wi] !== 'string' || !r[wi]) continue;
      const f = fi >= 0 ? +r[fi] || 0 : 3;
      out.push([r[wi], f]);
      if (ai >= 0 && typeof r[ai] === 'string' && r[ai] && R.nmNormalize(r[ai]) !== R.nmNormalize(r[wi])) out.push([r[ai], f]);
    }
    return out;
  }
  /** {list: [word, …], rank: Float64Array} for full spelling, from {fields, rows} or the compact {list, freq?, count?}
   *  (list may be one 'word\nword…' string). rank = R.fsRank(freq, count): the corpus count, or a stand-in from freq. */
  function compactWords(lex) {
    const list = [], rank = [];
    if (lex && lex.list != null && !lex.fields) {
      const words = typeof lex.list === 'string' ? (lex.list ? lex.list.split('\n') : []) : Array.isArray(lex.list) ? lex.list : [];
      const fr = lex.freq || [], ct = lex.count || [];
      for (let i = 0; i < words.length; i++) if (typeof words[i] === 'string' && words[i]) { list.push(words[i]); rank.push(R.fsRank(lex.freq ? fr[i] : 3, ct[i])); }
    } else if (lex && Array.isArray(lex.fields) && Array.isArray(lex.rows)) {
      const F = lex.fields, wi = F.indexOf('word'), fi = F.indexOf('freq'), ci = F.indexOf('count'), ai = F.indexOf('aarab');
      if (wi >= 0) for (const r of lex.rows) {
        if (!Array.isArray(r) || typeof r[wi] !== 'string' || !r[wi]) continue;
        const k = R.fsRank(fi >= 0 ? r[fi] : 3, ci >= 0 ? r[ci] : 0);
        list.push(r[wi]); rank.push(k);
        if (ai >= 0 && typeof r[ai] === 'string' && r[ai] && r[ai] !== r[wi]) { list.push(r[ai]); rank.push(k); }
      }
    }
    return { list, rank: Float64Array.from(rank) };
  }
  const nmSize = d => (d && d.words ? (d.mode === 'full' ? d.words.list.length : d.words.length) : 0);
  /** Load a near-miss (or full) language's word list once; resolves true when it is ready (in the worker too). */
  function ensureNearMiss(code) {
    const d = nmData.get(code); if (!d) return Promise.resolve(false);
    if (!d.ready) d.ready = (async () => {
      let lex = null, similar = null;
      try { lex = typeof d.src === 'function' ? await d.src() : d.src; } catch (e) { console.warn('Writing Assistant: word list for', code, e); }
      if (d.mode === 'full') { try { similar = typeof d.similar === 'function' ? await d.similar() : d.similar; } catch { similar = null; } }
      if (nmData.get(code) !== d) return false; // replaced or removed meanwhile
      d.words = d.mode === 'full' ? compactWords(lex) : lexiconWords(lex);
      d.similar = similar;
      if (!nmSize(d)) return false;
      const w = startWorker();
      // a full list goes over as one string and one number array (cheap to copy); the worker builds the index
      try {
        w?.postMessage(d.mode === 'full' ? { type: 'nearmiss', code, mode: 'full', list: d.words.list.join('\n'), rank: d.words.rank.slice(), prefix: d.prefix, suffix: d.suffix, similar }
          : { type: 'nearmiss', code, words: d.words, prefix: d.prefix, suffix: d.suffix });
      } catch {}
      return true;
    })();
    return d.ready;
  }
  /** The index in the page (built on first use: right-click check, suggestions, and checking without the worker). */
  function pageNearMiss(code) {
    const d = nmData.get(code); if (!nmSize(d)) return null;
    if (!d.idx) d.idx = d.mode === 'full' ? R.fsBuild({ list: d.words.list, rank: d.words.rank, prefix: d.prefix, suffix: d.suffix, similar: d.similar })
      : R.nmBuild({ words: d.words, prefix: d.prefix, suffix: d.suffix });
    return d.idx;
  }
  W.nearMiss = { ensure: code => ensureNearMiss(norm(code)), index: code => pageNearMiss(norm(code)), has: code => nmData.has(norm(code)), mode: code => nmData.get(norm(code))?.mode || null,
    check: (word, code) => R.nmCheck(pageNearMiss(norm(code)), word) };

  // =================================================================== spelling
  const wordCache = new Map(); // lang → Map(word → ok)
  function spellAvailable(lang) { try { return !!mk.spell?.check && (lang.builtin || lang.spelling) && mk.spell.load(lang.code); } catch { return false; } }
  /** Spelling findings for the given paragraphs (blocks: [[start, end]] in `text`). */
  const SCRIPTS = [['arab', /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/], ['hebr', /[֐-׿יִ-ﭏ]/],
    ['latn', /[A-Za-zÀ-ɏḀ-ỿ]/], ['cyrl', /[Ѐ-ӿ]/], ['grek', /[Ͱ-Ͽἀ-῿]/]];
  function scriptOfWord(w) { for (const [k, re] of SCRIPTS) if (re.test(w)) return k; return 'other'; }
  /** The script a proofing language writes in (null when unknown: then every word is looked up). */
  function scriptOfLang(lang) {
    const base = String(lang?.code || '').toLowerCase().split('-')[0];
    if (lang?.english || ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'sv', 'da', 'nb', 'nn', 'no', 'fi', 'pl', 'cs', 'sk', 'tr', 'id', 'ms', 'ro', 'hu'].includes(base)) return 'latn';
    if (['ar', 'fa', 'ur', 'pnb', 'skr', 'ps', 'sd', 'ug', 'ckb', 'ks'].includes(base)) return 'arab';
    if (['he', 'yi'].includes(base)) return 'hebr';
    if (['ru', 'uk', 'bg', 'sr', 'mk', 'be', 'kk'].includes(base)) return 'cyrl';
    if (base === 'el') return 'grek';
    return null;
  }
  W.scriptOfWord = scriptOfWord; W.scriptOfLang = scriptOfLang;
  function spellFindings(text, blocks, lang) {
    if (nmData.has(lang.code) || !spellAvailable(lang)) return { findings: [], missing: false }; // near-miss findings come from the engine
    let cache = wordCache.get(lang.code); if (!cache) wordCache.set(lang.code, cache = new Map());
    const unknown = new Set(); const use = [];
    let missing = false;
    for (const [s, e] of blocks) {
      const raw = text.slice(s, e); const toks = tokenCache.get(raw);
      if (!toks) { missing = true; continue; }
      use.push([s, toks]);
      for (const t of toks) if (!cache.has(t[0])) unknown.add(t[0]);
    }
    if (unknown.size) {
      const list = [...unknown];
      // possessives and curly apostrophes are checked without the ending
      let bad = [];
      try { bad = mk.spell.check(lang.code, list); } catch { bad = []; }
      const badSet = new Set(bad.map(i => list[i]));
      const retry = [...badSet].map(w => w.replace(/['’]s$/i, '')).filter((w, i, a) => w && a.indexOf(w) === i);
      let okRetry = new Set();
      if (retry.length) { try { const b2 = new Set(mk.spell.check(lang.code, retry).map(i => retry[i])); okRetry = new Set(retry.filter(w => !b2.has(w))); } catch {} }
      for (const w of list) cache.set(w, !badSet.has(w) || okRetry.has(w.replace(/['’]s$/i, '')));
      if (cache.size > 60000) cache.clear();
    }
    const out = [];
    const want = scriptOfLang(lang);
    for (const [s, toks] of use) for (const [w, a, b] of toks) {
      if (cache.get(w) !== false) continue;
      // a word in another script (Urdu in an English document, English in an Urdu one) is not this dictionary's business
      if (want && scriptOfWord(w) !== want) continue;
      // units and formulas with superscript or subscript digits (m³, km², s⁻¹, H₂O) are not misspellings
      if (/[²³¹⁰-₟]/.test(w)) continue;
      const l = w.toLowerCase();
      if (dictSet.has(l) || ignoredWords.has(l)) continue;
      out.push({ rule: 'spelling', source: 'spelling', cat: 'correctness', start: s + a, end: s + b, text: w, title: 'Spelling', message: `“${w}” is not in the ${lang.name} dictionary.`, replacements: [], suggest: true, safe: false, vk: 'spelling', vv: { w, lang: lang.name } });
    }
    return { findings: out, missing };
  }
  /** Spelling suggestions (slow-ish, so only when a card or F7 asks). */
  // Common English slips whose dictionary suggestions miss the obvious word (nspell offers "ten" for "teh")
  const COMMON_TYPOS = { teh: 'the', hte: 'the', thier: 'their', wich: 'which', whcih: 'which', adn: 'and', taht: 'that', waht: 'what', jsut: 'just', alot: 'a lot', becuase: 'because', becasue: 'because', beacuse: 'because', wensday: 'Wednesday', wendsday: 'Wednesday', wedensday: 'Wednesday', febuary: 'February', recieve: 'receive', recieved: 'received', beleive: 'believe', acheive: 'achieve', freind: 'friend', wierd: 'weird', untill: 'until', occured: 'occurred', seperate: 'separate', definately: 'definitely', goverment: 'government', enviroment: 'environment', accomodate: 'accommodate', tommorow: 'tomorrow', tomorow: 'tomorrow', truely: 'truly', irregardless: 'regardless', publically: 'publicly', arguement: 'argument', existance: 'existence', occurence: 'occurrence', refered: 'referred', begining: 'beginning', calender: 'calendar', concensus: 'consensus', independant: 'independent', neccessary: 'necessary', noticable: 'noticeable', posession: 'possession', reccomend: 'recommend', relevent: 'relevant', succesful: 'successful', thru: 'through', youre: 'you’re', dont: 'don’t', doesnt: 'doesn’t', didnt: 'didn’t', isnt: 'isn’t', wasnt: 'wasn’t', cant: 'can’t', wont: 'won’t', im: 'I’m', ive: 'I’ve' };
  W.COMMON_TYPOS = COMMON_TYPOS;
  W.suggest = function suggest(word, lang) {
    lang = lang || W.languageFor(app.docs.active());
    if (nmData.has(lang.code)) {
      const idx = pageNearMiss(lang.code); if (!idx) return [];
      return (idx.full ? R.fsSuggest(idx, R.nmNormalize(word), 6) : R.nmNeighbors(idx, R.nmNormalize(word), 5)).map(w => R.nmShow(idx, w));
    }
    const out = [];
    const push = s => { if (!s) return; const v = R.matchCase(word, s); if (v.toLowerCase() !== String(word).toLowerCase() && !out.some(x => x.toLowerCase() === v.toLowerCase())) out.push(v); };
    const lw = String(word || '').toLowerCase();
    const english = /^en\b|^en-/i.test(lang.code || '');
    const check = list => { if (!list.length) return new Set(); try { const bad = new Set(mk.spell?.check?.(lang.code, list) || list.map((_c, i) => i)); return new Set(list.filter((_c, i) => !bad.has(i))); } catch { return new Set(); } };
    if (!english) {
      // other Hunspell languages (packs with aff/dic): swapped neighbors first, then the dictionary's own list
      if (lw.length >= 3 && lw.length <= 24) { const sw = []; for (let i = 0; i < lw.length - 1; i++) { const c = lw.slice(0, i) + lw[i + 1] + lw[i] + lw.slice(i + 2); if (c !== lw && !sw.includes(c)) sw.push(c); } for (const c of check(sw)) push(c); }
      try { for (const s of mk.spell?.suggest?.(lang.code, word, 6) || []) push(s); } catch {}
      return out.slice(0, 6);
    }
    // English: candidates from several places, then one ranking (R.spellRank): a weighted edit distance (swapped letters,
    // a missed double letter and one vowel for another cost little), the sound key and how common the word is
    loadFreq(); loadDomain();
    const cands = [];
    if (COMMON_TYPOS[lw]) cands.push({ w: COMMON_TYPOS[lw], d: -5 });
    if (lw.length >= 3 && lw.length <= 24) {
      const sw = []; for (let i = 0; i < lw.length - 1; i++) { const c = lw.slice(0, i) + lw[i + 1] + lw[i] + lw.slice(i + 2); if (c !== lw && !sw.includes(c)) sw.push(c); }
      for (const c of check(sw)) cands.push({ w: c });
    }
    const idx = lw.length >= 2 && lw.length <= 30 ? spellIndexFor(lang) : null;
    if (idx) {
      for (const x of R.spellNear(idx, lw)) cands.push({ w: x.w, d: x.d });
      const morph = R.spellMorph(idx, lw); const ok = check(morph.map(x => x.form));
      for (const x of morph) if (ok.has(x.form)) cands.push({ w: x.form, d: x.d });
    }
    let ranked = R.spellRank(word, cands, { freq: freqTier, max: 6, withScore: true });
    // Hunspell's own list (slow on long words) only when Markooj's candidates are not convincing
    if (!(ranked.length >= 3 && ranked[0].d <= 0.6)) {
      try { for (const s of mk.spell?.suggest?.(lang.code, word, 10) || []) cands.push({ w: s }); } catch {}
      ranked = R.spellRank(word, cands, { freq: freqTier, max: 6, withScore: true });
    }
    for (const x of ranked) push(x.w);
    return out.slice(0, 6);
  };
  W.isWordCorrect = (word, lang) => {
    lang = lang || W.languageFor(app.docs.active()); const sc = scriptOfLang(lang);
    if (nmData.has(lang.code)) { const lw = String(word || '').toLowerCase(); return dictSet.has(lw) || ignoredWords.has(lw) || !R.nmFlag(pageNearMiss(lang.code), word); } if (sc && scriptOfWord(String(word || '')) !== sc) return true; try { return !!mk.spell?.correct?.(lang.code, word); } catch { return true; } };

  // =================================================================== per-document state
  const states = new Map();
  const state = doc => { let s = states.get(doc.id); if (!s) states.set(doc.id, s = { all: [], findings: [], dismissed: new Set(), words: 0, score: 100, status: 'idle', text: null, seq: 0, harper: 'idle' }); return s; };
  W.state = doc => state(doc || app.docs.active());
  // words in the personal dictionary (or ignored for this session) are never flagged, by Harper either; nor are the listed
  // technical terms and places (Harper's "penstock should be pen stock")
  const knownWord = f => (f.source === 'harper' || f.source === 'spelling') && /^[\p{L}\p{M}\p{N}'’‌-]+$/u.test(f.text || '') && (dictSet.has(f.text.toLowerCase()) || ignoredWords.has(f.text.toLowerCase()) || (f.source === 'harper' && W.domainWords.has(f.text)));
  const ctxKey = (f, text) => f.rule + '|' + f.text + '|' + text.slice(Math.max(0, f.start - 24), f.start).replace(/\s+/g, ' ').slice(-16);
  function visible(list, doc, text) {
    const cats = S.cats(), ign = S.ignoredRules(), st = state(doc);
    return list.filter(f => !knownWord(f) && cats[f.cat] !== false && !ign.has(f.rule) && !ign.has(f.rule + ':' + (f.sub || '')) && !(f.source === 'harper' && ign.has('harper:' + f.harperRule)) && !st.dismissed.has(ctxKey(f, text)) && (f.rule !== 'spelling' || S.spell()) && (f.rule === 'spelling' || S.on()));
  }
  function counts(list) { const c = { correctness: 0, clarity: 0, engagement: 0, delivery: 0, total: list.length }; for (const f of list) c[f.cat] = (c[f.cat] || 0) + 1; return c; }
  let fid = 0;
  function finish(doc, st, text, res, lang) {
    if (doc.text !== text) return false;
    const sp = S.spell() ? spellFindings(text, res.blocks || [], lang) : { findings: [], missing: false };
    if (sp.missing) needAllTokens = true;
    const all = R.vary(R.dedupe((res.findings || []).concat(sp.findings)));
    for (const f of all) { f.id = 'w' + (++fid); if (!f.title) f.title = R.RULES[f.rule]?.title || 'Suggestion'; }
    st.all = all; st.text = text; st.words = res.words || 0;
    st.findings = visible(all, doc, text);
    st.score = R.score(st.findings, st.words);
    st.counts = counts(st.findings);
    st.harper = res.harper || st.harper;
    st.status = res.final ? 'ready' : 'checking';
    st.lang = lang;
    emitChanged(doc);
    return true;
  }
  function emitChanged(doc) {
    const st = state(doc);
    app.events.emit('writing:changed', { doc, findings: st.findings, score: st.score, counts: st.counts, status: st.status });
    if (doc === app.docs.active()) { app.events.emit('spelling:changed', { count: st.findings.length }); schedulePaint(); }
  }
  function refilter(doc) {
    const st = state(doc); if (st.text == null) return;
    st.findings = visible(st.all, doc, st.text); st.score = R.score(st.findings, st.words); st.counts = counts(st.findings);
    emitChanged(doc);
  }
  W.refilter = doc => { if (doc) refilter(doc); else app.docs.list().forEach(refilter); };

  /** Check a document now. Resolves with the findings shown for it. */
  W.check = async function check(doc = app.docs.active(), opts = {}) {
    if (typeof doc === 'string') return W.checkText(doc, opts);
    if (!doc || doc.kind !== 'markdown') return [];
    const st = state(doc); const seq = ++st.seq; const text = doc.text;
    const lang = W.languageFor(doc);
    st.status = 'checking'; app.events.emit('writing:status', { doc, status: 'checking' });
    const ctx = { dialect: lang.dialect || 'US', goals: S.goals(), longSentence: S.long(), english: !!lang.english && !lang.unsupported, customRules: lang.rules || [], key: 'doc:' + doc.id, harper: opts.harper !== false && S.on(), focus: caretOffset(doc) };
    // near-miss spelling: the word list is loaded the first time a document in this language is checked
    if (nmData.has(lang.code) && S.spell() && await ensureNearMiss(lang.code)) { ctx.nearMiss = lang.code; ctx.nearMissName = lang.name; }
    if (seq !== st.seq) return st.findings;
    try {
      const res = await engineCheck(text, ctx, r => { if (seq === st.seq) finish(doc, st, text, r, lang); });
      if (!res || seq !== st.seq) return st.findings;
      if (needAllTokens && doc.text === text && !opts._retry) return W.check(doc, { ...opts, _retry: true });
    } catch (e) { console.error('Writing Assistant', e); st.status = 'error'; }
    return st.findings;
  };
  function caretOffset(doc) { try { if (doc !== app.docs.active()) return 0; const s = app.editors.active()?.getSelection?.(); return s && s.start != null ? s.start : 0; } catch { return 0; } }
  /** Check any text (tests, add-ins): {lang:'en-US'|'en-GB'|…, goals, longSentence, harper:false, spelling:true} → findings */
  W.checkText = async function checkText(text, opts = {}) {
    const lang = opts.lang ? (LANGS.get(norm(opts.lang)) || W.languageFor({ meta: { lang: opts.lang } })) : W.languageFor(null);
    const ctx = { dialect: lang.dialect || 'US', goals: { ...R.DEFAULT_GOALS, ...(opts.goals || {}) }, longSentence: opts.longSentence || S.long(), english: !!lang.english, customRules: lang.rules || [], harper: opts.harper !== false, inPage: !!opts.inPage };
    if (nmData.has(lang.code) && opts.spelling !== false && await ensureNearMiss(lang.code)) { ctx.nearMiss = lang.code; ctx.nearMissName = lang.name; }
    let res = await engineCheck(String(text || ''), ctx);
    if (!res) res = { findings: [], blocks: [] };
    let sp = opts.spelling === false ? { findings: [] } : spellFindings(String(text || ''), res.blocks || [], lang);
    if (sp.missing) { needAllTokens = true; res = (await engineCheck(String(text || ''), ctx)) || res; sp = opts.spelling === false ? { findings: [] } : spellFindings(String(text || ''), res.blocks || [], lang); }
    // near-miss words in the personal dictionary or ignored for this session are dropped, like nspell's
    const nmKnown = f => f.nearMiss && (dictSet.has(String(f.text).toLowerCase()) || ignoredWords.has(String(f.text).toLowerCase()));
    const all = R.vary(R.dedupe((res.findings || []).filter(f => !nmKnown(f) && !(f.source === 'harper' && W.domainWords.has(f.text))).concat(sp.findings)));
    for (const f of all) { f.id = 'w' + (++fid); if (!f.title) f.title = R.RULES[f.rule]?.title || 'Suggestion'; }
    return all;
  };

  // ---- scheduling: debounced, and findings move with the text until the next check
  const timers = new Map();
  function schedule(doc, ms) {
    if (!doc || doc.kind !== 'markdown' || (!S.on() && !S.spell())) return;
    clearTimeout(timers.get(doc.id));
    const delay = ms ?? Math.min(1500, 450 + Math.round(doc.text.length / 400));
    timers.set(doc.id, setTimeout(() => { timers.delete(doc.id); if (app.docs.get(doc.id)) W.check(doc); }, delay));
  }
  W.schedule = schedule;
  function diffSpan(a, b) {
    let s = 0; const n = Math.min(a.length, b.length);
    while (s < n && a.charCodeAt(s) === b.charCodeAt(s)) s++;
    let e = 0; while (e < n - s && a.charCodeAt(a.length - 1 - e) === b.charCodeAt(b.length - 1 - e)) e++;
    return { at: s, del: a.length - s - e, ins: b.length - s - e };
  }
  function shift(doc, oldText, newText) {
    const st = state(doc); if (st.text !== oldText) return;
    const d = diffSpan(oldText, newText); const delta = d.ins - d.del; const end = d.at + d.del;
    const move = list => list.filter(f => !(f.start < end + 1 && f.end > d.at - 1) || f.wide && !(f.start <= d.at && f.end >= end)).map(f => { if (f.start >= end) { f.start += delta; f.end += delta; } else if (f.wide && f.end >= end) f.end += delta; return f; });
    st.all = move(st.all); st.findings = move(st.findings); st.text = newText;
  }
  const lastText = new Map();
  app.events.on('doc:changed', ({ doc, origin } = {}) => {
    if (!doc || doc.kind !== 'markdown') return;
    const prev = lastText.get(doc.id);
    if (prev != null && prev !== doc.text) { shift(doc, prev, doc.text); if (doc === app.docs.active()) schedulePaint(); }
    lastText.set(doc.id, doc.text);
    if (origin === 'save') return;
    schedule(doc);
  });
  app.events.on('doc:opened', doc => { if (doc?.kind === 'markdown') lastText.set(doc.id, doc.text); });
  app.events.on('doc:active', doc => { if (doc?.kind !== 'markdown') { clearPaint(); return; } lastText.set(doc.id, doc.text); const st = state(doc); if (st.text !== doc.text) schedule(doc, 120); else { emitChanged(doc); } });
  app.events.on('doc:closed', doc => { states.delete(doc.id); lastText.delete(doc.id); clearTimeout(timers.get(doc.id)); });
  app.events.on('settings:changed', ({ key } = {}) => {
    if (key === 'writingDictionary' || key === 'writingDomainWords') { applyDictionary(); app.docs.list().forEach(d => schedule(d, 60)); }
    else if (/^(proofingLanguage|writingGoals|writingLongSentence)$/.test(key)) app.docs.list().forEach(d => schedule(d, 60));
    else if (/^(writingCategories|writingIgnoredRules)$/.test(key)) W.refilter();
    else if (key === 'writingAssistant' || key === 'spellcheck') { W.applySpellcheckAttr(); app.docs.list().forEach(d => { refilter(d); schedule(d, 60); }); schedulePaint(); }
  });

  // =================================================================== underlines (CSS Custom Highlight API: the Markdown never changes)
  const HL = { correctness: 'mkw-correctness', clarity: 'mkw-clarity', engagement: 'mkw-engagement', delivery: 'mkw-delivery' };
  let painted = []; // [{f, range, wide}]
  let activeId = null;
  const hasHL = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function';
  function clearPaint() { if (!hasHL) return; for (const n of Object.values(HL)) CSS.highlights.delete(n); CSS.highlights.delete('mkw-wide'); CSS.highlights.delete('mkw-active'); painted = []; }
  let paintRaf = 0, paintTimer = 0;
  function schedulePaint(ms = 30) { clearTimeout(paintTimer); paintTimer = setTimeout(() => { cancelAnimationFrame(paintRaf); paintRaf = requestAnimationFrame(paint); }, ms); }
  W.repaint = () => paint();
  const SKIP = 'code,pre,kbd,script,style,svg,textarea,.mk-math,.mk-math-block,.katex,.mk-cite,.mk-xref,.mk-comment,.mk-note,.mk-note-mark,[data-mk-ui],.mk-front,.mk-mdx,.footnote-ref,.footnote-backref,.mk-il-edit,.mk-bibliography,.mkw-ghost';
  function textIndex(el) {
    const nodes = []; let text = '';
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && n.parentElement.closest(SKIP) && el.contains(n.parentElement.closest(SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let n; while ((n = tw.nextNode())) { nodes.push({ node: n, start: text.length }); text += n.data; }
    return { text, nodes };
  }
  function rangeIn(ix, a, b) {
    const at = off => { let lo = 0, hi = ix.nodes.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ix.nodes[mid].start <= off) lo = mid; else hi = mid - 1; } return ix.nodes[lo]; };
    if (!ix.nodes.length) return null;
    const s = at(a), e = at(Math.max(a, b - 1));
    const r = document.createRange();
    try { r.setStart(s.node, Math.min(s.node.data.length, a - s.start)); r.setEnd(e.node, Math.min(e.node.data.length, b - e.start)); } catch { return null; }
    return r;
  }
  /** What the reader sees of a stretch of Markdown (marks, links targets, code and math removed). */
  function visibleText(src) {
    return src.replace(/`+[^`]*`+/g, ' ').replace(/\$\$[\s\S]*?\$\$|\$[^$\n]*\$/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\]\((?:[^()\n]|\([^()\n]*\))*\)/g, '').replace(/\[\^[^\]]*\]/g, '').replace(/\[[^\]\n]*@[^\]\n]*\]/g, ' ')
      .replace(/<!--[\s\S]*?-->|%%[\s\S]*?%%/g, ' ').replace(/<[^>\n]+>/g, '').replace(/\{[#.:-][^}\n]*\}/g, '')
      .replace(/\\([\\`*_{}[\]()#+\-.!|$~^=<>])/g, '$1').replace(/\*+|~~|==|(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, '').replace(/[[\]]/g, '')
      .replace(/^[ \t]{0,3}(?:#{1,6}[ \t]+|(?:>[ \t]*)+|[-*+][ \t]+(?:\[[ xX]\][ \t]+)?|\d+[.)][ \t]+(?:\[[ xX]\][ \t]+)?)/gm, '');
  }
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function needleRe(vis) {
    const v = vis.trim(); if (!v) return null;
    let src = '';
    for (const part of v.split(/\s+/)) src += (src ? '\\s+' : '') + [...part].map(c => (/['’‘]/.test(c) ? "['’‘]" : /["“”]/.test(c) ? '["“”]' : /[-–—]/.test(c) ? '[-–—]' : reEsc(c))).join('');
    const pre = /^[\p{L}\p{N}]/u.test(v) ? '(?<![\\p{L}\\p{N}])' : '', post = /[\p{L}\p{N}]$/u.test(v) ? '(?![\\p{L}\\p{N}])' : '';
    try { return new RegExp(pre + src + post, 'gu'); } catch { return null; }
  }
  function lineStarts(text) { const a = [0]; for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) a.push(i + 1); return a; }
  function lineOf(starts, off) { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= off) lo = mid; else hi = mid - 1; } return lo; }
  function fmLineCount(text) { try { const raw = mk.frontMatter?.parse?.(text)?.raw || ''; if (!raw) return 0; return (raw.match(/\n/g) || []).length + (raw.endsWith('\n') ? 0 : 1); } catch { return 0; } }
  function editorSurface() {
    const ed = app.editors.active();
    if (app.mode === 'simple') { const host = document.getElementById('editorHost'); return { kind: 'simple', mirror: host?.querySelector('.mk-src-mirror'), ta: host?.querySelector('textarea.mk-src-ta') }; }
    if (app.mode === 'word' || app.mode === 'inline') { let s = null; try { s = ed?.getSurface?.(); } catch {} return s ? { kind: app.mode, el: s } : null; }
    return null;
  }
  W.surface = editorSurface;
  function paint() {
    if (!hasHL) return;
    clearPaint();
    const doc = app.docs.active(); if (!doc || doc.kind !== 'markdown') return;
    const st = state(doc); if (st.text !== doc.text || !st.findings.length) return;
    const sf = editorSurface(); if (!sf) return;
    const list = st.findings.slice(0, 4000);
    const sets = { correctness: [], clarity: [], engagement: [], delivery: [], wide: [] };
    const out = [];
    const text = doc.text, starts = lineStarts(text);
    if (sf.kind === 'simple') {
      if (!sf.mirror) return;
      const lines = sf.mirror.children; const ixCache = new Map();
      const posAt = off => { const li = lineOf(starts, off); const el = lines[li]; if (!el) return null; let ix = ixCache.get(li); if (!ix) ixCache.set(li, ix = textIndex(el)); return { ix, col: off - starts[li], li }; };
      for (const f of list) {
        const a = posAt(f.start), b = posAt(Math.max(f.start, f.end - 1)); if (!a || !b) continue;
        const ra = rangeIn(a.ix, a.col, a.col + 1), rb = rangeIn(b.ix, b.col, b.col + 1); if (!ra || !rb) continue;
        const r = document.createRange(); try { r.setStart(ra.startContainer, ra.startOffset); r.setEnd(rb.endContainer, rb.endOffset); } catch { continue; }
        (f.wide ? sets.wide : sets[f.cat])?.push(r); out.push({ f, range: r, line: a.li });
      }
    } else {
      const fm = fmLineCount(text);
      const blocks = [...sf.el.querySelectorAll('[data-line]')].filter(e => !e.closest('pre,.mk-math-block,.mk-front,.mk-il-edit')).map((el, i) => ({ el, line: +el.getAttribute('data-line'), i })).filter(b => Number.isFinite(b.line));
      blocks.sort((a, b) => a.line - b.line || a.i - b.i);
      const ixCache = new Map(), visCache = new Map();
      for (const f of list) {
        const L = lineOf(starts, f.start) - fm; if (L < 0) continue;
        let lo = 0, hi = blocks.length - 1, k = -1;
        while (lo <= hi) { const mid = (lo + hi) >> 1; if (blocks[mid].line <= L) { k = mid; lo = mid + 1; } else hi = mid - 1; }
        if (k < 0) continue;
        const blk = blocks[k];
        const segStart = starts[fm + blk.line] ?? 0;
        const re = needleRe(visibleText(text.slice(f.start, f.end))); if (!re) continue;
        let n = 0; const before = visibleText(text.slice(segStart, f.start)) + ' ';
        // count earlier matches in this block (the match must end before the finding starts)
        re.lastIndex = 0; let m; while ((m = re.exec(before))) { if (m.index + m[0].length <= before.length - 1) n++; if (!m[0].length) re.lastIndex++; }
        let ix = ixCache.get(blk.el); if (!ix) ixCache.set(blk.el, ix = textIndex(blk.el));
        re.lastIndex = 0; let hit = null, c = 0;
        while ((m = re.exec(ix.text))) { if (c === n) { hit = m; break; } c++; if (!m[0].length) re.lastIndex++; }
        if (!hit) continue;
        const r = rangeIn(ix, hit.index, hit.index + hit[0].length); if (!r) continue;
        (f.wide ? sets.wide : sets[f.cat])?.push(r); out.push({ f, range: r, el: blk.el });
        void visCache;
      }
    }
    for (const [cat, name] of Object.entries(HL)) if (sets[cat].length) CSS.highlights.set(name, new Highlight(...sets[cat]));
    if (sets.wide.length) CSS.highlights.set('mkw-wide', new Highlight(...sets.wide));
    painted = out;
    if (activeId) setActive(activeId);
  }
  function setActive(id) {
    activeId = id;
    if (!hasHL) return;
    CSS.highlights.delete('mkw-active');
    const p = id && painted.find(x => x.f.id === id);
    if (p) CSS.highlights.set('mkw-active', new Highlight(p.range));
  }
  W.setActive = setActive;
  W.painted = () => painted.slice();
  app.events.on('editor:rendered', () => schedulePaint(20));
  app.events.on('mode:shown', () => schedulePaint(20));
  app.events.on('mode:changed', () => { hideCard(); schedulePaint(200); });
  app.events.on('zoom:changed', () => hideCard());
  // Simple mode redraws changed lines while typing: repaint soon after
  document.addEventListener('input', e => { if (e.target?.classList?.contains('mk-src-ta') || e.target?.closest?.('.mk-il-edit')) schedulePaint(120); }, true);

  // ---- which finding is under the mouse (the textarea in Simple mode lets the mirror below answer)
  function caretAt(x, y) {
    const sf = editorSurface(); let ta = null, mirror = null;
    if (sf?.kind === 'simple') { ta = sf.ta; mirror = sf.mirror; if (ta) ta.style.pointerEvents = 'none'; if (mirror) mirror.style.pointerEvents = 'auto'; }
    let pos = null;
    try {
      if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (p) pos = { node: p.offsetNode, offset: p.offset }; }
      else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (r) pos = { node: r.startContainer, offset: r.startOffset }; }
    } finally { if (ta) ta.style.pointerEvents = ''; if (mirror) mirror.style.pointerEvents = ''; }
    return pos;
  }
  W.caretAt = caretAt;
  function findingAt(x, y) {
    if (!painted.length) return null;
    const pos = caretAt(x, y); if (!pos || !pos.node) return null;
    let best = null;
    for (const p of painted) {
      let inside = false;
      try { inside = p.range.isPointInRange(pos.node, pos.offset); } catch { inside = false; }
      if (!inside) continue;
      const rects = p.range.getClientRects(); let hit = false;
      for (const r of rects) if (x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 3 && y <= r.bottom + 4) { hit = true; break; }
      if (!hit) continue;
      if (!best || (best.f.wide && !p.f.wide) || (!!best.f.wide === !!p.f.wide && p.f.end - p.f.start < best.f.end - best.f.start)) best = p;
    }
    return best;
  }
  W.findingAt = findingAt;

  // =================================================================== the card
  let card = null, cardFor = null, hoverTimer = 0, leaveTimer = 0;
  const CAT_COLOR = { correctness: 'var(--mkw-red)', clarity: 'var(--mkw-blue)', engagement: 'var(--mkw-green)', delivery: 'var(--mkw-purple)' };
  W.CAT_COLOR = CAT_COLOR;
  /** Explanation for a finding: {text, wrong, right}. Every rule and every Harper kind has one. */
  W.explain = function explain(f) {
    if (f.source === 'harper') {
      const k = R.HARPER_KINDS[f.kind] || R.HARPER_KINDS.Miscellaneous;
      let d = String(W.harperDescriptions[f.harperRule] || '').replace(/`([^`]*)`/g, '“$1”').replace(/\*\*?([^*]+)\*\*?/g, '$1').trim();
      // some Harper rules carry a placeholder text instead of a description: leave it out
      if (/collection of linters|^A rule that\b/i.test(d) && !/for example/i.test(d)) d = '';
      // an example only when it belongs to this rule (a kind's example was written for one rule of that kind)
      const ex = (R.HARPER_EXAMPLES || {})[f.harperRule] || (R.HARPER_KIND_RULE?.[f.kind] === f.harperRule ? [k[3], k[4]] : null);
      return { text: (d ? d + ' ' : '') + k[2], wrong: ex ? ex[0] : '', right: ex ? ex[1] : '', source: app.tm('Harper grammar checker') };
    }
    const r = R.RULES[f.rule] || (f.rule.startsWith('lang:') ? { explain: f.explain || f.message, wrong: f.wrong, right: f.right } : R.RULES.harper);
    return { text: f.explain || r.explain || '', wrong: f.wrong || r.wrong, right: f.right || r.right };
  };
  function fixesFor(f) {
    if (f.rule === 'spelling') { if (!f._sugg) f._sugg = W.suggest(f.text, state(app.docs.active()).lang); return f._sugg; }
    if (f.synonyms && !f.replacements.length) { const d0 = app.docs.active(); const syn = W.synonymsSync(f.text || f.synonyms, { before: d0 ? d0.text.slice(Math.max(0, f.start - 40), f.start) : '' }); if (syn) return syn.flat.filter(w => w.toLowerCase() !== f.text.toLowerCase() && !w.includes(' ')).slice(0, 4).map(w => R.matchCase(f.text, w)); W.loadThesaurus().then(() => { if (cardFor === f) showCard(f, card?._anchor); }); return []; }
    return f.replacements || [];
  }
  W.fixesFor = fixesFor;
  function fixLabel(f, rep) {
    if (rep === '') return '<span class="mkw-del">' + esc(f.text.trim()) + '</span> <span class="mkw-rm">' + app.th('Remove') + '</span>';
    const t = f.text.length > 40 ? '' : '<span class="mkw-del">' + esc(f.text) + '</span> ';
    return t + '<b>' + esc(rep) + '</b>';
  }
  /** Card content for a finding (also used by the pane). handlers: {onDone} */
  W.renderCard = function renderCard(f, box, opts = {}) {
    const doc = opts.doc || app.docs.active();
    const ex = W.explain(f);
    const fixes = fixesFor(f);
    // the card's own words follow the interface language; the rule's title, message and explanation stay English this round
    const cardAttr = x => esc(app.t(x)), cardText = x => app.th(x);
    box.innerHTML = `<div class="mkw-c-head"><span class="mkw-dot" style="background:${CAT_COLOR[f.cat]}"></span><span class="mkw-c-cat">${esc(R.CAT_LABEL[f.cat] ? app.t(R.CAT_LABEL[f.cat]) : '')}</span><span class="mkw-c-title">${esc(f.title || '')}</span></div>
      <div class="mkw-c-msg">${esc(f.message || '')}</div>
      ${fixes.length ? `<div class="mkw-c-fixes" role="group" aria-label="${cardAttr('Suggestions')}">${fixes.map((r, i) => `<button type="button" class="mkw-fix${i === 0 ? ' first' : ''}" data-i="${i}" data-tip="${cardAttr('Accept')}" data-tip-d="${cardAttr('Replace the underlined text. Ctrl+Z undoes it.')}">${fixLabel(f, r)}</button>`).join('')}</div>` : f.rule === 'spelling' ? `<div class="mkw-c-none">${cardText('No suggestions.')}</div>` : ''}
      <div class="mkw-c-acts">
        <button type="button" class="mkw-act" data-a="dismiss" data-tip="${cardAttr('Dismiss')}" data-tip-d="${cardAttr('Hide this suggestion here. The text stays as it is.')}">${cardText('Dismiss')}</button>
        ${f.rule === 'spelling' ? `<button type="button" class="mkw-act" data-a="add" data-tip="${cardAttr('Add to dictionary')}" data-tip-d="${cardAttr('Teach Markooj this word. It is never marked again, in any document.')}">${cardText('Add to dictionary')}</button><button type="button" class="mkw-act" data-a="ignoreAll" data-tip="${cardAttr('Ignore all')}" data-tip-d="${cardAttr('Skip this word everywhere until you close Markooj.')}">${cardText('Ignore all')}</button>` : `<button type="button" class="mkw-act" data-a="ignoreRule" data-tip="${cardAttr('Turn off this rule')}" data-tip-d="${esc(app.t('Stop showing “{rule}” suggestions. Turn it back on in File → Options → Writing.', { rule: f.title || '' }))}">${cardText('Ignore rule')}</button>`}
        <button type="button" class="mkw-act mkw-why" data-a="why" aria-expanded="false" data-tip="${cardAttr('Why?')}" data-tip-d="${cardAttr('See what the rule is about, with a wrong and a right example.')}">${cardText('Why?')}</button>
      </div>
      <div class="mkw-c-explain" hidden>
        <p>${esc(ex.text)}</p>
        ${ex.wrong ? `<div class="mkw-ex wrong"><span aria-label="${cardAttr('Wrong')}">✕</span>${esc(ex.wrong)}</div>` : ''}
        ${ex.right ? `<div class="mkw-ex right"><span aria-label="${cardAttr('Right@@correct')}">✓</span>${esc(ex.right)}</div>` : ''}
        ${ex.source ? `<div class="mkw-ex-src">${esc(app.t(ex.source))}</div>` : ''}
      </div>`;
    box.querySelectorAll('.mkw-fix').forEach(b => b.addEventListener('click', async e => { e.stopPropagation(); app.ui.ripple?.(b); const ok = await W.accept(f, fixes[+b.dataset.i], doc); if (ok) opts.onDone?.('accept'); }));
    box.querySelectorAll('.mkw-act').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const a = b.dataset.a;
      if (a === 'why') { const x = box.querySelector('.mkw-c-explain'); x.hidden = !x.hidden; b.setAttribute('aria-expanded', String(!x.hidden)); b.classList.toggle('on', !x.hidden); opts.onResize?.(); return; }
      app.ui.ripple?.(b);
      if (a === 'dismiss') W.dismiss(f, doc);
      else if (a === 'add') W.addToDictionary(f.text);
      else if (a === 'ignoreAll') W.ignoreWord(f.text);
      else if (a === 'ignoreRule') W.ignoreRule(f);
      opts.onDone?.(a);
    }));
    return box;
  };
  function ensureCard() {
    if (card) return card;
    card = document.createElement('div'); card.className = 'mkw-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', app.t('Writing suggestion'));
    card.addEventListener('mouseenter', () => clearTimeout(leaveTimer));
    card.addEventListener('mouseleave', () => { leaveTimer = setTimeout(hideCard, 350); });
    card.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hideCard(true); } });
    document.body.appendChild(card);
    app.events.on('i18n:changed', () => { card.setAttribute('aria-label', app.t('Writing suggestion')); if (W.cardOpen()) hideCard(); });
    return card;
  }
  function placeCard(rect) {
    const c = card; c.style.left = '0px'; c.style.top = '0px';
    const w = c.offsetWidth, h = c.offsetHeight;
    let x = rect.left, y = rect.bottom + 8;
    if (y + h > innerHeight - 8) y = Math.max(8, rect.top - h - 8);
    x = Math.max(8, Math.min(x, innerWidth - w - 8));
    c.style.left = x + 'px'; c.style.top = y + 'px';
  }
  function showCard(f, anchorRect, opts = {}) {
    ensureCard();
    clearTimeout(leaveTimer);
    cardFor = f; card._anchor = anchorRect;
    W.renderCard(f, card, { onDone: () => hideCard(true), onResize: () => placeCard(anchorRect) });
    card.classList.add('show');
    placeCard(anchorRect);
    setActive(f.id);
    app.events.emit('writing:card', { finding: f, open: true });
    if (opts.focus) card.querySelector('.mkw-fix, .mkw-act')?.focus();
  }
  function hideCard(refocus) {
    clearTimeout(hoverTimer);
    if (!card || !card.classList.contains('show')) return;
    card.classList.remove('show'); cardFor = null; setActive(null);
    app.events.emit('writing:card', { open: false });
    if (refocus) { try { app.editors.active()?.focus?.(); } catch {} }
  }
  W.showCard = (f, opts = {}) => {
    const p = painted.find(x => x.f.id === f.id);
    const rect = opts.rect || (p ? p.range.getBoundingClientRect() : { left: innerWidth / 2 - 160, right: innerWidth / 2, top: innerHeight / 3, bottom: innerHeight / 3 });
    showCard(f, rect, opts);
  };
  W.hideCard = hideCard;
  W.cardOpen = () => !!(card && card.classList.contains('show'));
  // hover (after a short pause) and click open the card
  const host = () => document.getElementById('editorHost');
  let lastMove = null, moveRaf = 0;
  document.addEventListener('mousemove', e => {
    const h = host(); if (!h || !h.contains(e.target) || e.buttons) return;
    lastMove = e; if (moveRaf) return;
    moveRaf = requestAnimationFrame(() => {
      moveRaf = 0; const ev = lastMove; if (!ev) return;
      const p = findingAt(ev.clientX, ev.clientY);
      document.body.classList.toggle('mkw-pointer', !!p);
      if (p && cardFor && cardFor.id === p.f.id) { clearTimeout(leaveTimer); return; }
      clearTimeout(hoverTimer);
      if (p && !p.f.wide) { const rect = rectNear(p.range, ev.clientX, ev.clientY); hoverTimer = setTimeout(() => showCard(p.f, rect), 420); }
      else if (cardFor) { clearTimeout(leaveTimer); leaveTimer = setTimeout(hideCard, 350); }
    });
  }, { passive: true });
  function rectNear(range, x, y) { for (const r of range.getClientRects()) if (y >= r.top - 3 && y <= r.bottom + 4) return r; return range.getBoundingClientRect(); }
  document.addEventListener('mouseup', e => {
    const h = host(); if (!h || !h.contains(e.target) || e.button !== 0) return;
    const sel = getSelection(); if (sel && !sel.isCollapsed && String(sel).length > 1) return;
    const p = findingAt(e.clientX, e.clientY);
    if (p) { clearTimeout(hoverTimer); showCard(p.f, rectNear(p.range, e.clientX, e.clientY)); }
    else if (card && !card.contains(e.target)) hideCard();
  });
  document.addEventListener('mousedown', e => { if (card && card.classList.contains('show') && !card.contains(e.target) && !host()?.contains(e.target)) hideCard(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && W.cardOpen() && !e.defaultPrevented) { hideCard(); } }, true);
  window.addEventListener('scroll', e => { if (W.cardOpen() && !card.contains(e.target)) hideCard(); }, true);
  app.events.on('doc:changed', () => { if (W.cardOpen()) hideCard(); });

  // =================================================================== actions (all through the normal edit path)
  function locate(text, f) {
    if (text.slice(f.start, f.end) === f.text) return [f.start, f.end];
    const near = text.indexOf(f.text, Math.max(0, f.start - 400));
    if (near >= 0 && near < f.start + 400) return [near, near + f.text.length];
    return null;
  }
  /** Replace the finding's text with `rep`. Returns true when it changed the document. */
  W.accept = async function accept(f, rep, doc = app.docs.active()) {
    if (!doc || doc.readOnly || rep == null) return false;
    try { if (doc === app.docs.active()) app.editors.active()?.flush?.(); } catch {}
    const at = locate(doc.text, f);
    if (!at) { app.ui.toast(app.t('Try the fix again in a moment. The text changed, so Markooj is checking it again.'), { kind: 'info' }); schedule(doc, 0); return false; }
    const next = doc.text.slice(0, at[0]) + rep + doc.text.slice(at[1]);
    doc.setText(next, 'writing');
    const st = state(doc); st.all = st.all.filter(x => x.id !== f.id); st.findings = st.findings.filter(x => x.id !== f.id); st.counts = counts(st.findings); st.score = R.score(st.findings, st.words);
    emitChanged(doc);
    app.events.emit('writing:accepted', { doc, finding: f, replacement: rep });
    return true;
  };
  /** Apply every safe fix in one step (one Undo takes them all back). */
  W.acceptAllSafe = function acceptAllSafe(doc = app.docs.active(), filter) {
    if (!doc || doc.readOnly) return 0;
    try { if (doc === app.docs.active()) app.editors.active()?.flush?.(); } catch {}
    const st = state(doc);
    const list = st.findings.filter(f => f.safe && f.replacements.length === 1 && (!filter || filter(f))).sort((a, b) => b.start - a.start);
    let text = doc.text, n = 0, lastStart = Infinity;
    for (const f of list) {
      if (f.end > lastStart) continue;
      if (text.slice(f.start, f.end) !== f.text) continue;
      text = text.slice(0, f.start) + f.replacements[0] + text.slice(f.end); lastStart = f.start; n++;
    }
    if (n) { const ids = new Set(list.map(f => f.id)); doc.setText(text, 'writing'); st.all = st.all.filter(x => !ids.has(x.id)); st.findings = st.findings.filter(x => !ids.has(x.id)); st.counts = counts(st.findings); emitChanged(doc); }
    return n;
  };
  W.safeCount = (doc = app.docs.active()) => (doc ? state(doc).findings.filter(f => f.safe && f.replacements.length === 1).length : 0);
  W.dismiss = function dismiss(f, doc = app.docs.active()) { const st = state(doc); st.dismissed.add(ctxKey(f, doc.text)); refilter(doc); };
  W.ignoreRule = function ignoreRule(f) {
    const id = typeof f === 'string' ? f : f.source === 'harper' ? 'harper:' + f.harperRule : f.rule;
    const list = app.settings.get('writingIgnoredRules', []) || [];
    if (!list.includes(id)) app.settings.set('writingIgnoredRules', [...list, id]);
    app.ui.toast(app.t('“{rule}” is off. Turn it back on in File → Options → Writing.', { rule: (typeof f === 'string' ? f : f.title) || id }), { kind: 'info' });
  };
  W.resetIgnoredRules = () => app.settings.set('writingIgnoredRules', []);
  W.addToDictionary = function addToDictionary(word) { W.dictionary.add(word); app.ui.toast(app.t('Added “{word}” to your dictionary.', { word })); };
  W.ignoreWord = function ignoreWord(word) { ignoredWords.add(String(word).toLowerCase()); W.refilter(); };
  W.ignoredWords = ignoredWords;

  // =================================================================== thesaurus (WordNet, offline)
  let thes = null, thesLoading = null;
  W.loadThesaurus = function loadThesaurus() {
    if (thes) return Promise.resolve(thes);
    if (!thesLoading) thesLoading = fetch(new URL('../data/thesaurus-en.json', location.href)).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(j => { thes = j; thes.rankIndex = new Map(j.rank.map((w, i) => [w, i])); return thes; }).catch(e => { thesLoading = null; console.warn('thesaurus', e); return null; });
    return thesLoading;
  };
  // irregular forms → base form (went → go, children → child, better → good), from the verb table and a few nouns and adjectives
  const IRREG_LEMMA = new Map();
  const IRREG_NOUN = { child: 'children', man: 'men', woman: 'women', person: 'people', foot: 'feet', tooth: 'teeth', mouse: 'mice', goose: 'geese', datum: 'data', analysis: 'analyses', criterion: 'criteria', phenomenon: 'phenomena', thesis: 'theses', hypothesis: 'hypotheses', crisis: 'crises', basis: 'bases', medium: 'media', life: 'lives', knife: 'knives', wife: 'wives', leaf: 'leaves', half: 'halves', shelf: 'shelves' };
  const IRREG_ADJ = { good: ['better', 'best'], well: ['better', 'best'], bad: ['worse', 'worst'], little: ['less', 'least'], many: ['more', 'most'], much: ['more', 'most'], far: ['farther', 'farthest'] };
  for (const [b, f] of Object.entries(R.IRREG || {})) for (const x of f.slice(1)) if (x !== b && !IRREG_LEMMA.has(x)) IRREG_LEMMA.set(x, b);
  for (const [b, pl] of Object.entries(IRREG_NOUN)) IRREG_LEMMA.set(pl, b);
  for (const [b, [er, est]] of Object.entries(IRREG_ADJ)) { if (!IRREG_LEMMA.has(er)) IRREG_LEMMA.set(er, b); if (!IRREG_LEMMA.has(est)) IRREG_LEMMA.set(est, b); }
  /** Base forms to look up: running → run, studies → study, happier → happy, went → go, children → child. */
  W.lemmas = function lemmas(word) {
    const w = String(word || '').toLowerCase().replace(/[’']s$/, '').replace(/[^\p{L}' -]/gu, '');
    const out = [w];
    const add = x => { if (x && x.length > 1 && !out.includes(x)) out.push(x); };
    if (IRREG_LEMMA.has(w)) add(IRREG_LEMMA.get(w));
    const rules = [['ies', 'y'], ['es', ''], ['s', ''], ['ied', 'y'], ['ed', ''], ['ed', 'e'], ['ing', ''], ['ing', 'e'], ['ier', 'y'], ['iest', 'y'], ['er', ''], ['est', ''], ['er', 'e'], ['est', 'e'], ['ly', ''], ['ily', 'y']];
    for (const [suf, rep] of rules) if (w.endsWith(suf) && w.length > suf.length + 2) { const b = w.slice(0, -suf.length) + rep; add(b); if (/([bcdfgklmnprstvz])\1$/.test(b)) add(b.slice(0, -1)); }
    return out;
  };
  /** How a word is formed from its base: '' | 's' | 'ed' | 'past' | 'pp' | 'ing' | 'er' | 'est'. */
  function formOf(w, l) {
    if (!w || w === l) return '';
    const ir = R.IRREG?.[l];
    if (ir) { if (w === ir[1]) return 's'; if (w === ir[2] && w === ir[4]) return 'ed'; if (w === ir[2]) return 'past'; if (w === ir[4]) return 'pp'; if (w === ir[3]) return 'ing'; }
    if (IRREG_NOUN[l] === w) return 's';
    if (IRREG_ADJ[l]) { if (IRREG_ADJ[l][0] === w) return 'er'; if (IRREG_ADJ[l][1] === w) return 'est'; }
    if (/ing$/.test(w) && !/ing$/.test(l)) return 'ing';
    if (/ed$/.test(w) && !/ed$/.test(l)) return 'ed';
    if (/est$/.test(w) && !/est$/.test(l)) return 'est';
    if (/er$/.test(w) && !/er$/.test(l)) return 'er';
    if (/s$/.test(w) && !/s$/.test(l)) return 's';
    return '';
  }
  function compare(c, form) {
    const more = form === 'er' ? 'more ' : 'most ';
    if (c.includes(' ') || c.includes('-')) return more + c;
    if (IRREG_ADJ[c]) return IRREG_ADJ[c][form === 'er' ? 0 : 1];
    const suf = form === 'er' ? 'er' : 'est';
    const syl = (c.match(/[aeiouy]+/g) || []).length;
    if (syl === 1 || (syl === 2 && /[^aeiou]y$/.test(c))) {
      if (/e$/.test(c)) return c + suf.slice(1);
      if (/[^aeiou]y$/.test(c)) return c.slice(0, -1) + 'i' + suf;
      if (/^[^aeiou]*[aeiou][bdgmnpt]$/.test(c)) return c + c.slice(-1) + suf;
      return c + suf;
    }
    return more + c;
  }
  /** Put a base-form synonym into the form of the word it replaces (shows → displays, went → moved, happier → brighter). */
  function inflect(c, form, pos) {
    if (!form) return c;
    if (form === 'er' || form === 'est') return compare(c, form);
    const parts = c.split(' ');
    // a noun phrase takes the plural on its last word (social events), a verb phrase changes its first word (carried out)
    if (form === 's' && pos === 'noun') { const last = parts[parts.length - 1]; parts[parts.length - 1] = IRREG_NOUN[last] || R.conj(last)[1]; return parts.join(' '); }
    const head = parts[0];
    const cj = R.conj(head);
    const f = form === 's' ? (IRREG_NOUN[head] || cj[1]) : form === 'ing' ? cj[3] : form === 'pp' ? cj[4] : cj[2];
    return [f, ...parts.slice(1)].join(' ');
  }
  W.inflectLike = (choice, word, lemma) => inflect(choice, formOf(String(word).toLowerCase(), lemma || W.lemmas(word).slice(-1)[0]));
  // words that are usually adjectives: their adjective meanings come first
  const ADJ_HINT = /(?:ful|ous|ive|able|ible|al|ic|less|ant|ent|ish|ary|ory)$/;
  const ADJ_WORDS = new Set(['good', 'bad', 'big', 'small', 'large', 'important', 'great', 'nice', 'new', 'old', 'high', 'low', 'long', 'short', 'clear', 'hard', 'easy', 'fast', 'quick', 'slow', 'happy', 'sad', 'strong', 'weak', 'rich', 'poor', 'hot', 'cold', 'simple', 'main', 'key', 'major', 'huge', 'tiny', 'young', 'bright', 'dark', 'quiet', 'loud', 'true', 'false', 'sure', 'free', 'full', 'empty', 'right', 'wrong', 'early', 'late', 'busy', 'safe', 'real', 'whole']);
  const isAdj = b => !!thes?.w[b]?.some(id => thes.pos[thes.s[id][0]] === 'adjective');
  // the word before tells nouns from verbs: "the shows" (noun) / "the data shows" (verb)
  const DET_BEFORE = /\b(?:the|a|an|these|those|this|that|my|your|our|their|his|her|its|some|many|few|several|two|three|of|any|each|every|no)\s+$/i;
  const VERB_BEFORE = /\b(?:to|will|would|can|could|should|must|may|might|do|does|did|not|it|he|she|they|we|you|i|which|who)\s+$/i;
  W.synonymsSync = function synonymsSync(word, opts = {}) {
    if (!thes) return null;
    const wl = String(word || '').toLowerCase();
    const before = String(opts.before || '').slice(-40);
    let dialect = null; try { dialect = W.languageFor(app.docs.active())?.dialect || null; } catch {}
    for (const l of W.lemmas(word)) {
      const ids = thes.w[l]; if (!ids) continue;
      const form = formOf(wl, l);
      const hasPos = p => ids.some(id => thes.pos[thes.s[id][0]] === p);
      const prefer = form === 'ed' || form === 'past' || form === 'pp' || form === 'ing' ? 'verb' : form === 'er' || form === 'est' ? 'adjective'
        : !form && (ADJ_WORDS.has(l) || ADJ_HINT.test(l)) && hasPos('adjective') ? 'adjective'
        : before && DET_BEFORE.test(before) && hasPos('noun') ? 'noun'
        : before && form === 's' && /\p{L}\s+$/u.test(before) && hasPos('verb') ? 'verb'
        : before && VERB_BEFORE.test(before) && hasPos('verb') ? 'verb' : null;
      // a choice is dropped when it is the same word in the other spelling (utilize / utilise), spelled for the other
      // variety of English, or a comparative of the word itself (big → bigger)
      const keep = x => {
        const xl = x.toLowerCase();
        if (xl === l || xl === wl) return false;
        const d = R.dialectOf?.(x);
        if (d && dialect && d !== dialect) return false;
        if (!form && /(?:er|est)$/.test(xl) && !xl.includes(' ') && W.lemmas(xl).slice(1).some(b => b === l || isAdj(b))) return false;
        return true;
      };
      const groups = [];
      for (const id of ids) {
        const [pi, gloss, words, anto] = thes.s[id];
        const pos = thes.pos[pi];
        // comparatives and -ing/-ed forms only make sense for some parts of speech
        if ((form === 'er' || form === 'est') && pos !== 'adjective' && pos !== 'adverb') continue;
        if ((form === 'ed' || form === 'past' || form === 'pp' || form === 'ing') && pos !== 'verb' && !(form === 'ing' && pos === 'noun') && !(form === 'ed' && pos === 'adjective')) continue;
        let g = groups.find(x => x.pos === pos); if (!g) groups.push(g = { pos, meanings: [] });
        const base = byRank(words.split('|').filter(keep));
        const ws = [...new Set(base.map(x => (pos === 'adjective' && (form === 'ed' || form === 'ing') ? x : pos === 'noun' && form !== 's' ? x : inflect(x, form, pos))))].filter(x => x.toLowerCase() !== wl);
        g.meanings.push({ gloss, words: ws, antonyms: anto ? anto.split('|').map(x => (pos === 'noun' && form !== 's' ? x : inflect(x, form, pos))) : [] });
      }
      if (prefer) groups.sort((a, b) => (a.pos === prefer ? 0 : 1) - (b.pos === prefer ? 0 : 1));
      const flat = [], gi = new Map();
      groups.forEach((g, i) => { for (const m of g.meanings) for (const x of m.words) if (!flat.includes(x)) { flat.push(x); gi.set(x, i); } });
      // most useful first: the likely part of speech, then common words of the first meanings
      const pos = new Map(flat.map((x, i) => [x, i]));
      const lead = x => (prefer && groups[gi.get(x)]?.pos === prefer ? 0 : prefer ? 1e6 : 0);
      flat.sort((a, b) => lead(a) + score(a, pos) - (lead(b) + score(b, pos)));
      return { word, lemma: l, form, groups: groups.filter(g => g.meanings.some(m => m.words.length)), flat };
    }
    return { word, lemma: W.lemmas(word)[0], form: '', groups: [], flat: [] };
  };
  function rankOf(w) { const r = thes?.rankIndex?.get(w); return r == null ? 30000 : r; }
  function byRank(list) { return list.map((w, i) => [w, i]).sort((a, b) => (rankOf(a[0]) + a[1] * 300) - (rankOf(b[0]) + b[1] * 300)).map(x => x[0]); }
  function score(w, pos) { return Math.min(rankOf(w), 30000) / 6 + pos.get(w) * 120 + (w.includes(' ') ? 4000 : 0); }
  /** Synonyms grouped by part of speech: {word, lemma, groups:[{pos, meanings:[{gloss, words[], antonyms[]}]}], flat[]} */
  W.synonyms = async function synonyms(word, opts) { await W.loadThesaurus(); return W.synonymsSync(word, opts); };
  W.thesaurusRank = () => (thes ? thes.rank : null);
  W.thesaurusLicense = () => (thes ? { source: thes.source, license: thes.license } : { source: 'WordNet 3.1 (Princeton University)', license: 'WordNet License' });

  // =================================================================== Chromium's own red lines stay off while Markooj checks spelling
  W.applySpellcheckAttr = function applySpellcheckAttr() {
    const ours = !!mk.spell?.check;
    const on = ours ? 'false' : (S.spell() ? 'true' : 'false');
    document.querySelectorAll('#editorHost [contenteditable="true"], #editorHost [contenteditable="plaintext-only"], #editorHost textarea').forEach(n => n.setAttribute('spellcheck', on));
  };
  const spellAttrSoon = () => setTimeout(W.applySpellcheckAttr, 0);
  ['doc:active', 'mode:changed', 'mode:shown', 'editor:rendered', 'ready'].forEach(ev => app.events.on(ev, spellAttrSoon));
  document.addEventListener('focusin', e => { if (e.target?.closest?.('#editorHost') && (e.target.isContentEditable || e.target.tagName === 'TEXTAREA')) { const want = mk.spell?.check ? 'false' : (S.spell() ? 'true' : 'false'); if (e.target.getAttribute('spellcheck') !== want) e.target.setAttribute('spellcheck', want); } }, true);

  // =================================================================== status text (shell's Spelling button)
  W.statusText = function statusText(doc = app.docs.active()) {
    if (!doc || doc.kind !== 'markdown') return null;
    if (!S.on() && !S.spell()) return app.t('Checking off');
    const st = state(doc); if (st.text == null) return null;
    return st.findings.length;
  };

  // =================================================================== start
  applyDictionary();
  app.events.on('ready', () => {
    // the saved personal dictionary: this file runs before app.settings.load(), so read it again now (and check again
    // any document that was checked before the words were known)
    applyDictionary();
    app.docs.list().forEach(d => { if (d !== app.docs.active()) schedule(d, 120); });
    W.applySpellcheckAttr();
    // warm up the grammar checker and the dictionary while the user reads
    setTimeout(() => { try { const l = W.languageFor(app.docs.active()); if (S.on()) W.engine.warm(l.dialect); spellAvailable(l); } catch {} const d = app.docs.active(); if (d) schedule(d, 50); }, 800);
    // the technical and place-name lists and the word-frequency tiers (small text files, read once)
    setTimeout(() => { Promise.all([loadDomain(), loadFreq()]).then(() => { if (S.spell()) warmSpellIndex(W.languageFor(app.docs.active())); }); }, 1200);
  });
})();
