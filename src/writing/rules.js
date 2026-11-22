// Markooj — Writing Assistant rule engine (no DOM, no Node): runs in the page and in src/writing/worker.js.
// Everything works on the Markdown source. `prose()` blanks what is not prose (front matter, code, math,
// links, citations, labels, comments, HTML) to spaces, so every offset still points into the source.
// A finding: {rule, cat, start, end, text, title, message, replacements[], safe, wide?, explain?, wrong?, right?}
(function (G) {
  'use strict';
  const R = {};
  const CATS = ['correctness', 'clarity', 'engagement', 'delivery'];
  const CAT_ALIAS = { punctuation: 'correctness', spelling: 'correctness', grammar: 'correctness', style: 'clarity', typography: 'correctness' };
  R.CATS = CATS;
  R.CAT_LABEL = { correctness: 'Correctness', clarity: 'Clarity', engagement: 'Engagement', delivery: 'Delivery' };

  // =================================================================== masking
  const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
  const DAYS = 'Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday';
  /** flags: 1 = not prose (code, math, URL …), 2 = Markdown marks (#, *, >, list bullets …) */
  R.prose = function prose(src) {
    const text = String(src || '');
    const n = text.length;
    const flags = new Uint8Array(n);
    const hard = (s, e) => { for (let i = Math.max(0, s); i < e && i < n; i++) flags[i] = 1; };
    const soft = (s, e) => { for (let i = Math.max(0, s); i < e && i < n; i++) if (!flags[i]) flags[i] = 2; };
    const each = (re, fn) => { re.lastIndex = 0; let m; while ((m = re.exec(text))) { if (!m[0].length) { re.lastIndex++; continue; } fn(m); } };
    let fmEnd = 0;
    const fm = /^\uFEFF?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
    if (fm) { hard(0, fm[0].length); fmEnd = fm[0].length; }
    // fenced code and display math (line based, so an unclosed fence runs to the end like Markdown does)
    {
      const lines = text.split('\n'); let off = 0, open = null, openAt = 0;
      for (const line of lines) {
        const s = off, e = off + line.length; off = e + 1;
        if (s < fmEnd) continue;
        const t = line.replace(/\r$/, '');
        if (open) {
          if (open.re.test(t)) { hard(openAt, e); open = null; }
          continue;
        }
        let m;
        if ((m = /^\s{0,3}(`{3,}|~{3,})/.exec(t))) { open = { re: new RegExp('^\\s{0,3}' + m[1][0].replace(/[`~]/, c => '\\' + c) + '{' + m[1].length + ',}\\s*$') }; openAt = s; continue; }
        if (/^\s*\$\$/.test(t) && !/^\s*\$\$[\s\S]*\S[\s\S]*\$\$/.test(t.replace(/^\s*\$\$\s*$/, ''))) {
          if (/^\s*\$\$.*\$\$\s*(\{[^}]*\})?\s*$/.test(t) && t.trim().length > 4) { hard(s, e); continue; }
          open = { re: /\$\$\s*(\{[^}]*\})?\s*$/ }; openAt = s; continue;
        }
        if (/^\s*\\\[/.test(t) && !/\\\]/.test(t)) { open = { re: /\\\]/ }; openAt = s; continue; }
        if ((m = /^\s*\\begin\{(\w+\*?)\}/.exec(t)) && !new RegExp('\\\\end\\{' + m[1].replace('*', '\\*') + '\\}').test(t)) { open = { re: new RegExp('\\\\end\\{' + m[1].replace('*', '\\*') + '\\}') }; openAt = s; continue; }
        if (/^\s*:::/.test(t) || /^(?:import\s.+\sfrom\s|import\s+['"]|export\s+(?:const|default|function|let|var|class|async)\b)/.test(t)) { hard(s, e); continue; }
        if (/^\s{0,3}(?:[-*_]\s*){3,}$/.test(t) && !/[^-*_\s]/.test(t)) { hard(s, e); continue; }
        if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(t) && t.includes('-')) { hard(s, e); continue; }
        if (/^\s*\[[^\]\n]+\]:\s*\S/.test(t)) { const c = t.indexOf(']:'); if (!/^\s*\[\^/.test(t)) { hard(s, e); continue; } hard(s, s + c + 2); }
        // block marks at the start of a line: headings, quotes, bullets, numbers, task boxes, callout titles
        if ((m = /^(\s*(?:>\s*)*)(#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d{1,9}[.)]\s+(?:\[[ xX]\]\s+)?)?/.exec(t))) soft(s, s + m[0].length);
        if ((m = /^\s*(?:>\s*)*\[!\w+\][+-]?/.exec(t))) hard(s, s + m[0].length);
        // closing heading hashes and table pipes
        if ((m = /\s+#+\s*$/.exec(t)) && /^\s*#/.test(t)) soft(s + m.index, e);
      }
      if (open) hard(openAt, n);
    }
    // indented code after a blank line (not inside lists)
    each(/(^|\n)[ \t]*\r?\n((?: {4,}|\t)[^\n]*(?:\n(?: {4,}|\t)[^\n]*)*)/g, m => {
      const s = m.index + m[0].length - m[2].length;
      const before = text.slice(Math.max(0, m.index - 300), m.index);
      if (!/(^|\n)\s*(?:[-*+]|\d+[.)])\s/.test(before.split(/\n\s*\n/).pop() || '')) hard(s, s + m[2].length);
    });
    each(/<!--[\s\S]*?-->/g, m => hard(m.index, m.index + m[0].length));
    each(/%%[\s\S]*?%%/g, m => hard(m.index, m.index + m[0].length));
    each(/(`+)(?!`)[\s\S]*?[^`]\1(?!`)|``/g, m => hard(m.index, m.index + m[0].length));
    each(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, m => hard(m.index, m.index + m[0].length));
    each(/\$\$[\s\S]+?\$\$/g, m => hard(m.index, m.index + m[0].length));
    each(/(?<![\\$\w])\$(?=[^\s$])((?:\\.|[^$\n\\])*?[^\s\\$])\$(?![\d$])/g, m => hard(m.index, m.index + m[0].length));
    each(/!\[[^\]\n]*\]\([^)\n]*\)(\{[^}\n]*\})?/g, m => hard(m.index, m.index + m[0].length));
    each(/\]\((?:[^()\n]|\([^()\n]*\))*\)/g, m => hard(m.index, m.index + m[0].length));
    each(/\]\[[^\]\n]*\]/g, m => hard(m.index, m.index + m[0].length));
    each(/\[\^[^\]\n]+\]/g, m => hard(m.index, m.index + m[0].length));
    each(/\[[^\]\n]*@[^\]\n]*\]/g, m => hard(m.index, m.index + m[0].length));
    each(/(^|[\s(\[;,])-?@[\w:.#$%&+?<>~/-]*\w/g, m => hard(m.index + m[1].length, m.index + m[0].length));
    each(/\{[#.:-][^}\n]*\}|\{-\}/g, m => hard(m.index, m.index + m[0].length));
    each(/<\/?[A-Za-z][^<>\n]*>/g, m => hard(m.index, m.index + m[0].length));
    // raw LaTeX outside math (\ref{fig:x}, \cite[p.~2]{key}, \LaTeX), emoji shortcodes (:tada:) and wikilink targets ([[Page|label]])
    each(/\\[A-Za-z]+\*?(?:\[[^\]\n]*\])*(?:\{[^{}\n]*\})*/g, m => hard(m.index, m.index + m[0].length));
    each(/(?<![\p{L}\p{N}:]):[a-z0-9_+-]*[a-z][a-z0-9_+-]*:(?![\p{L}\p{N}:])/gu, m => hard(m.index, m.index + m[0].length));
    each(/\[\[([^\]|\n]+)(\|[^\]\n]*)?\]\]/g, m => { const lab = m[2] ? m[2].length - 1 : 0; hard(m.index, m.index + m[0].length - 2 - lab); hard(m.index + m[0].length - 2, m.index + m[0].length); });
    each(/<(?:https?|mailto|ftp):[^>\s]+>/g, m => hard(m.index, m.index + m[0].length));
    each(/\b(?:https?|ftp):\/\/[^\s<>()\]]+|\bwww\.[^\s<>()\]]+|\b[\w.+-]+@[\w-]+\.[\w.-]+\b|\b(?:[A-Za-z]:\\|\.{1,2}\/)[^\s]*|\b[\w-]+\.(?:md|png|jpe?g|gif|svg|pdf|docx?|html?|js|css|json|bib|csl|tex|py|txt|zip)\b/g, m => hard(m.index, m.index + m[0].length));
    each(/\\[\\`*_{}\[\]()#+\-.!|$~^=<>]/g, m => soft(m.index, m.index + 1));
    // emphasis and other inline marks
    each(/\*{1,3}|~~|==|\+\+|(?<![\p{L}\p{N}])_{1,3}|_{1,3}(?![\p{L}\p{N}])|\^(?=\S)|(?<=\S)\^|(?<![~\s])~(?![~\s])/gu, m => soft(m.index, m.index + m[0].length));
    each(/!?\[(?=[^\]\n]*\]\()/g, m => soft(m.index, m.index + m[0].length));
    each(/\|/g, m => soft(m.index, m.index + 1));
    let out = '';
    for (let i = 0; i < n; i++) { const c = text[i]; out += flags[i] && c !== '\n' ? ' ' : c; }
    return { text: out, src: text, flags, fmEnd };
  };

  // =================================================================== blocks, sentences, words
  /** Paragraph-sized pieces of the prose: {start, end, text (prose), raw (source)}; never inside code or math. */
  R.blocks = function blocks(p) {
    const out = []; const t = p.text; const n = t.length;
    let i = 0;
    while (i < n) {
      // skip blank (prose) lines
      while (i < n) { const e = t.indexOf('\n', i); const le = e < 0 ? n : e; if (t.slice(i, le).trim()) break; i = le + 1; }
      if (i >= n) break;
      let j = i;
      while (j < n) {
        const e = t.indexOf('\n', j); const le = e < 0 ? n : e;
        if (!t.slice(j, le).trim()) break;
        j = le + 1;
        // a heading, bullet or table row starts a block of its own (no blank line needed in Markdown)
        if (j < n) { const nl = p.src.slice(j, Math.min(n, j + 12)); if (/^\s{0,3}(#{1,6}\s|[-*+]\s|\d{1,9}[.)]\s|\||>)/.test(nl) || /^\s{0,3}(#{1,6}\s)/.test(p.src.slice(i, i + 8))) break; }
      }
      const end = Math.min(n, j > i && t[j - 1] === '\n' ? j - 1 : j);
      out.push({ start: i, end, text: t.slice(i, end), raw: p.src.slice(i, end) });
      i = Math.max(j, i + 1);
    }
    return out;
  };
  const ABBR = /(?:\b(?:e\.g|i\.e|et al|etc|vs|cf|Fig|Figs|Eq|Eqs|Ref|Refs|Sec|Ch|No|Nos|Vol|pp|p|ca|approx|Dr|Mr|Mrs|Ms|Prof|St|Jr|Sr|Inc|Ltd|Co|Corp|Dept|Univ|al|viz|resp|ed|eds|U\.S|U\.K|a\.m|p\.m|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)|\b[A-Z])\.$/;
  /** Sentences of a block: [{start, end}] relative to the block text. */
  R.sentences = function sentences(text) {
    const out = []; let s = 0;
    const push = e => { let a = s, b = e; while (a < b && /\s/.test(text[a])) a++; while (b > a && /\s/.test(text[b - 1])) b--; if (b > a && /[\p{L}\p{N}]/u.test(text.slice(a, b))) out.push({ start: a, end: b }); s = e; };
    const re = /([.!?…]+)(["'’”)\]]*)(?=\s+["'‘“(\[]?[\p{Lu}\p{N}]|\s*$)|\n/gu;
    let m;
    while ((m = re.exec(text))) {
      if (m[0] === '\n') { push(m.index); continue; }
      const end = m.index + m[0].length;
      if (m[1] === '.' && ABBR.test(text.slice(Math.max(0, m.index - 8), m.index + 1))) continue;
      push(end);
    }
    push(text.length);
    return out;
  };
  // U+200C (zero-width non-joiner, the Persian half space in کتاب‌ها) and U+200D are part of a word, never its end
  const WORD_RE = /[\p{L}\p{M}](?:[\p{L}\p{M}\p{N}]|[‌‍](?=[\p{L}\p{M}]))*(?:['’][\p{L}\p{M}]+)*(?:-[\p{L}\p{M}\p{N}]+)*/gu;
  R.words = function words(text) { const out = []; WORD_RE.lastIndex = 0; let m; while ((m = WORD_RE.exec(text))) out.push({ w: m[0], start: m.index, end: m.index + m[0].length }); return out; };
  /** Words worth a dictionary lookup: no numbers, abbreviations, CamelCase names or one-letter words; hyphenated words are checked part by part. */
  // Latin abbreviations of academic writing, and prefixes that only appear in front of a hyphen (pre-processing, intra-day)
  const LATIN_TOKENS = new Set(['ibid', 'viz', 'cf', 'etc', 'vs', 'loc', 'cit', 'passim', 'sic']);
  const HYPHEN_PREFIX = new Set(['pre', 'post', 'non', 'co', 're', 'multi', 'sub', 'inter', 'intra', 'anti', 'semi', 'mid', 'pseudo', 'quasi', 'meta', 'micro', 'macro', 'nano', 'mono', 'poly', 'bi', 'tri', 'uni', 'ex', 'neo', 'proto', 'trans', 'ultra', 'infra', 'supra', 'extra', 'self']);
  R.spellTokens = function spellTokens(text) {
    const out = [];
    for (const t of R.words(text)) {
      const parts = t.w.includes('-') ? t.w.split('-') : [t.w];
      let off = t.start;
      for (let pi = 0; pi < parts.length; pi++) {
        const part = parts[pi];
        const w = part.replace(/['’]+$/, '');
        const s = off; off += part.length + 1;
        const lw = w.toLowerCase();
        if (LATIN_TOKENS.has(lw) || (pi < parts.length - 1 && HYPHEN_PREFIX.has(lw))) continue;
        // "et al." (also "et al" without the full stop)
        if (lw === 'et' && /^\s+al\b/.test(text.slice(s + 2, s + 6))) continue;
        if (lw === 'al' && /\bet\s+$/i.test(text.slice(Math.max(0, s - 4), s))) continue;
        if (w.length < 2 || /\d/.test(w) || /^\p{Lu}+(?:['’]?s)?$/u.test(w) && w.replace(/['’]s$/, '').length >= 2 || /\p{Ll}\p{Lu}/u.test(w) || /^\p{Lu}{2,}\p{Ll}/u.test(w)) continue;
        out.push({ w, start: s, end: s + w.length });
      }
    }
    return out;
  };
  R.countWords = t => { let c = 0; WORD_RE.lastIndex = 0; while (WORD_RE.exec(t)) c++; return c; };

  // =================================================================== helpers
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
  /** Keep the case of the original: "Discussed about" → "Discussed", "THE THE" → "THE" */
  R.matchCase = function matchCase(orig, rep) {
    if (!rep) return rep;
    if (orig.length > 1 && orig === orig.toUpperCase() && /\p{Lu}/u.test(orig)) return rep.toUpperCase();
    if (/^\p{Lu}/u.test(orig) && /^\p{Ll}/u.test(rep)) return cap(rep);
    return rep;
  };
  // regular verb forms: [base, s, past, ing, participle]
  const IRREG = { choose: ['choose', 'chooses', 'chose', 'choosing', 'chosen'], make: ['make', 'makes', 'made', 'making', 'made'], give: ['give', 'gives', 'gave', 'giving', 'given'], take: ['take', 'takes', 'took', 'taking', 'taken'], have: ['have', 'has', 'had', 'having', 'had'], come: ['come', 'comes', 'came', 'coming', 'come'], hold: ['hold', 'holds', 'held', 'holding', 'held'], set: ['set', 'sets', 'set', 'setting', 'set'] };
  // more irregular verbs, for re-inflecting synonyms (went → go → moved) and the -ing form in fixes
  const IRREG2 = 'be is was being been|go goes went going gone|see sees saw seeing seen|get gets got getting gotten|find finds found finding found|keep keeps kept keeping kept|think thinks thought thinking thought|bring brings brought bringing brought|begin begins began beginning begun|know knows knew knowing known|write writes wrote writing written|speak speaks spoke speaking spoken|break breaks broke breaking broken|grow grows grew growing grown|draw draws drew drawing drawn|throw throws threw throwing thrown|fall falls fell falling fallen|drive drives drove driving driven|rise rises rose rising risen|wear wears wore wearing worn|win wins won winning won|sell sells sold selling sold|teach teaches taught teaching taught|catch catches caught catching caught|fight fights fought fighting fought|seek seeks sought seeking sought|buy buys bought buying bought|stand stands stood standing stood|understand understands understood understanding understood|lead leads led leading led|meet meets met meeting met|pay pays paid paying paid|send sends sent sending sent|build builds built building built|spend spends spent spending spent|lose loses lost losing lost|feel feels felt feeling felt|tell tells told telling told|say says said saying said|do does did doing done|become becomes became becoming become|put puts put putting put|cut cuts cut cutting cut|show shows showed showing shown|sit sits sat sitting sat|sleep sleeps slept sleeping slept|fly flies flew flying flown|hide hides hid hiding hidden|forget forgets forgot forgetting forgotten|eat eats ate eating eaten|leave leaves left leaving left|run runs ran running run|mean means meant meaning meant|hear hears heard hearing heard|let lets let letting let|read reads read reading read|lie lies lay lying lain|ride rides rode riding ridden|shake shakes shook shaking shaken|swim swims swam swimming swum|sing sings sang singing sung|steal steals stole stealing stolen|strike strikes struck striking struck|wake wakes woke waking woken|deal deals dealt dealing dealt|lend lends lent lending lent|bend bends bent bending bent|feed feeds fed feeding fed|hang hangs hung hanging hung|shoot shoots shot shooting shot|spread spreads spread spreading spread|split splits split splitting split|quit quits quit quitting quit|hit hits hit hitting hit|shut shuts shut shutting shut|bear bears bore bearing borne|tear tears tore tearing torn|freeze freezes froze freezing frozen|undertake undertakes undertook undertaking undertaken|overcome overcomes overcame overcoming overcome|withdraw withdraws withdrew withdrawing withdrawn|arise arises arose arising arisen|forbid forbids forbade forbidding forbidden|forgive forgives forgave forgiving forgiven';
  for (const row of IRREG2.split('|')) { const f = row.split(' '); if (!IRREG[f[0]]) IRREG[f[0]] = f; }
  R.IRREG = IRREG;
  R.conj = function conj(base) {
    if (IRREG[base]) return IRREG[base];
    const parts = base.split(' '); const v = parts[0]; const rest = parts.slice(1).join(' ');
    const add = f => (rest ? f + ' ' + rest : f);
    if (IRREG[v]) return IRREG[v].map(add);
    const s = /(s|x|z|ch|sh)$/.test(v) ? v + 'es' : /[^aeiou]y$/.test(v) ? v.slice(0, -1) + 'ies' : v + 's';
    // one-syllable verbs ending in one vowel + one consonant double it (stop → stopped, plan → planning)
    const dbl = /^(admit|commit|submit|refer|prefer|occur|plan|stop|control|permit|omit|regret|equip|transfer|propel|compel|expel|rebel)$/.test(v) || /^[^aeiouy]*[aeiou][bdgklmnprt]$/.test(v);
    const ed = /e$/.test(v) ? v + 'd' : /[^aeiou]y$/.test(v) ? v.slice(0, -1) + 'ied' : dbl ? v + v.slice(-1) + 'ed' : v + 'ed';
    const ing = /ie$/.test(v) ? v.slice(0, -2) + 'ying' : /[^e]e$/.test(v) ? v.slice(0, -1) + 'ing' : dbl ? v + v.slice(-1) + 'ing' : v + 'ing';
    return [v, s, ed, ing, ed].map(add);
  };
  const forms = base => R.conj(base);
  const alt = list => list.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).join('|');

  // =================================================================== the rules
  // Every rule: {id, cat, title, explain, wrong, right}. Entry tables below add their own wrong/right examples.
  const RULES = {};
  const rule = (id, o) => { RULES[id] = { id, ...o }; return RULES[id]; };

  rule('spelling', { cat: 'correctness', title: 'Spelling', explain: 'The dictionary for this document’s language does not know this word. Check the spelling, pick a suggestion, or add the word to your dictionary if it is a name or a term you use.', wrong: 'We recieved the samples.', right: 'We received the samples.' });
  rule('dialect', { cat: 'correctness', title: 'US/UK spelling', explain: 'American and British English spell some words differently (color/colour, center/centre, analyze/analyse). Use one style throughout. The style comes from the document’s language (front matter lang: en-US or en-GB) or from File → Options → Writing.', wrong: 'The colour of the center line (American document)', right: 'The color of the center line' });
  rule('preposition', { cat: 'correctness', title: 'Wrong preposition', explain: 'Some verbs and adjectives take a fixed preposition, and some take none at all. These pairs are easy to get wrong when the same idea uses a different word in another language.', wrong: 'We discussed about the results.', right: 'We discussed the results.' });
  rule('article', { cat: 'correctness', title: 'A or an', explain: 'Use “an” before a vowel sound and “a” before a consonant sound. The sound counts, not the letter: an hour, a university, an MRI scan, a one-off.', wrong: 'It took a hour to run a experiment.', right: 'It took an hour to run an experiment.' });
  rule('its', { cat: 'correctness', title: 'Its or it’s', explain: '“It’s” is short for “it is” or “it has”. “Its” (no apostrophe) shows that something belongs to it, like “his” or “her”.', wrong: 'Its clear that the model lost it’s accuracy.', right: 'It’s clear that the model lost its accuracy.' });
  rule('repeated', { cat: 'correctness', title: 'Repeated word', explain: 'The same word appears twice in a row, which usually happens when a sentence is edited.', wrong: 'The the results were clear.', right: 'The results were clear.' });
  rule('absolute', { cat: 'clarity', title: 'Absolute adjective', explain: 'Some adjectives describe something that is either true or not, so they cannot be graded. Something is unique or it is not; “very unique” weakens the word.', wrong: 'This is a very unique approach.', right: 'This is a unique approach.' });
  rule('longSentence', { cat: 'clarity', title: 'Long sentence', explain: 'Long sentences make readers hold many ideas at once. Split the sentence where a new idea starts, or turn a list into bullets. You can change the length in File → Options → Writing.', wrong: 'The samples, which were collected in the summer after the flood when the river was still high and the banks had not yet settled, were dried, sieved and weighed before we analyzed them in the laboratory over the following three weeks.', right: 'We collected the samples in the summer after the flood. We then dried, sieved and weighed them, and analyzed them over three weeks.' });
  rule('wordy', { cat: 'clarity', title: 'Wordy phrase', explain: 'A shorter phrase says the same thing. Short phrases are easier to read and leave room for what matters.', wrong: 'In order to reduce costs, we met due to the fact that prices rose.', right: 'To reduce costs, we met because prices rose.' });
  rule('passive', { cat: 'clarity', title: 'Passive voice', explain: 'In the passive voice the doer of the action comes late or not at all. The active voice is usually shorter and clearer. Academic writing uses the passive more often, so Markooj shows fewer of these when the goal is Academic.', wrong: 'The report was written by the committee.', right: 'The committee wrote the report.' });
  rule('intensifier', { cat: 'clarity', title: 'Unneeded word', explain: 'Words like “really”, “basically” and “actually” rarely add meaning. Without them the sentence sounds more confident.', wrong: 'The results are basically really good.', right: 'The results are good.' });
  rule('nominalization', { cat: 'clarity', title: 'Hidden verb', explain: 'A verb turned into a noun (“make a decision”, “perform an analysis”) needs extra words. Use the verb itself.', wrong: 'We performed an analysis of the data and made a decision.', right: 'We analyzed the data and decided.' });
  rule('acronym', { cat: 'clarity', title: 'Undefined abbreviation', explain: 'Readers may not know an abbreviation. Spell it out the first time you use it and put the short form in parentheses after it; then use the short form.', wrong: 'The SDR was measured at three sites.', right: 'The sediment delivery ratio (SDR) was measured at three sites.' });
  rule('hyphenation', { cat: 'clarity', title: 'Inconsistent spelling', explain: 'The same word is written in two ways in this document, with and without a hyphen. Pick one and use it everywhere.', wrong: 'Send an e-mail … check your email.', right: 'Send an email … check your email.' });
  rule('stronger', { cat: 'engagement', title: 'Weak phrase', explain: '“Very” plus a plain adjective can usually be replaced by one stronger, more precise word.', wrong: 'The results were very good and the effect was very big.', right: 'The results were excellent and the effect was huge.' });
  rule('overused', { cat: 'engagement', title: 'Overused word', explain: 'This word appears many times. Repeating a plain word makes text feel flat; a synonym or a more specific word keeps readers interested. Technical terms should stay the same.', wrong: 'This is an important point. Another important finding is an important trend with important risks.', right: 'This is an important point. Another key finding is a significant trend with serious risks.' });
  rule('starts', { cat: 'engagement', title: 'Repeated sentence start', explain: 'Several sentences in a row start with the same word. Varying how sentences begin makes the text flow better.', wrong: 'We measured the flow. We dried the samples. We weighed them.', right: 'We measured the flow. After drying the samples, we weighed them.' });
  rule('contraction', { cat: 'delivery', title: 'Contraction', explain: 'Formal and academic writing spells out contractions. Markooj shows these only when your goals say Formal or Academic.', wrong: 'The model doesn’t converge and it can’t be used.', right: 'The model does not converge and it cannot be used.' });
  rule('informal', { cat: 'delivery', title: 'Informal word', explain: 'This word or phrase sounds casual. In formal, academic or business writing a more precise word fits better.', wrong: 'We got a lot of data and figured out the trend.', right: 'We collected substantial data and determined the trend.' });
  rule('hedging', { cat: 'delivery', title: 'Too many hedges', explain: 'One hedge (may, might, possibly) shows care; several in one sentence make the claim sound unsure. Keep the one that matters.', wrong: 'This may possibly suggest that the effect might be somewhat larger.', right: 'This suggests that the effect may be larger.' });
  rule('opinion', { cat: 'delivery', title: 'Sounds unsure', explain: '“I think” and “I believe” make a claim sound like a personal feeling. In academic and formal writing, state the claim and support it with evidence.', wrong: 'I think the results show a clear trend.', right: 'The results show a clear trend.' });
  rule('exclamation', { cat: 'delivery', title: 'Too many exclamation marks', explain: 'Several exclamation marks in a row sound shouty. One is enough, and formal writing rarely needs any.', wrong: 'The test passed!!!', right: 'The test passed.' });
  rule('harper', { cat: 'correctness', title: 'Grammar', explain: 'Found by the built-in grammar checker (Harper). See the message for what to change.', wrong: 'He go to work every day.', right: 'He goes to work every day.' });
  rule('usage', { cat: 'correctness', title: 'Word usage', explain: 'This phrase is common in speech or in some varieties of English, but it is not standard in writing. A plainer phrase says it clearly to every reader.', wrong: 'We reached to the office at nine.', right: 'We reached the office at nine.' });
  rule('agreement', { cat: 'correctness', title: 'Subject and verb', explain: 'A plural subject takes a plural verb: “the results show”, “these findings suggest”. A verb ending in -s goes with one thing.', wrong: 'The results shows a clear trend.', right: 'The results show a clear trend.' });
  R.RULES = RULES;

  // ---- Harper lint kinds → category and explanation (every kind Harper reports)
  R.HARPER_KINDS = {
    Agreement: ['correctness', 'Agreement', 'The verb must match its subject in number (one or more), and words like “this/these” must match their noun.', 'She have finished.', 'She has finished.'],
    BoundaryError: ['correctness', 'Word boundary', 'Two words were joined, or one word was split, where English writes them differently.', 'We will work out side the lab.', 'We will work outside the lab.'],
    Capitalization: ['correctness', 'Capitalization', 'A sentence, the word “I” and proper names start with a capital letter.', 'the river rose. i measured it.', 'The river rose. I measured it.'],
    Eggcorn: ['correctness', 'Misheard phrase', 'A word in a common phrase was replaced by one that sounds alike but means something else.', 'For all intensive purposes', 'For all intents and purposes'],
    Enhancement: ['engagement', 'Better word', 'A shorter or more precise word or phrase would read better here.', 'We will try and finish today.', 'We will try to finish today.'],
    Formatting: ['correctness', 'Formatting', 'Spacing, dashes or symbols do not follow the usual style.', 'Pages 10 - 20', 'Pages 10–20'],
    Grammar: ['correctness', 'Grammar', 'The sentence breaks a grammar rule, such as a wrong verb form or a missing word.', 'Their is a problem.', 'There is a problem.'],
    Malapropism: ['correctness', 'Wrong word', 'A word that sounds similar but means something else was used.', 'The new rules will effect everyone.', 'The new rules will affect everyone.'],
    Miscellaneous: ['correctness', 'Grammar', 'A small grammar or usage problem.', 'It took a hour.', 'It took an hour.'],
    Nonstandard: ['correctness', 'Nonstandard word', 'This form is used in speech but is not standard in writing.', 'Irregardless of the cost', 'Regardless of the cost'],
    Punctuation: ['correctness', 'Punctuation', 'A comma, apostrophe or other mark is missing, extra or wrong.', 'Its a good day.', 'It’s a good day.'],
    Readability: ['clarity', 'Hard to read', 'This part is long or complex. Shorter sentences and plain words are easier to read.', 'Due to the fact that …', 'Because …'],
    Redundancy: ['clarity', 'Redundant words', 'Some words repeat what other words already say.', 'Return back to the start.', 'Return to the start.'],
    Regionalism: ['correctness', 'Regional word', 'This word belongs to another variety of English than the one set for this document.', 'We parked the lorry (American document).', 'We parked the truck.'],
    Repetition: ['correctness', 'Repeated word', 'A word or phrase appears twice in a row.', 'the the results', 'the results'],
    Spelling: ['correctness', 'Spelling', 'The word may be misspelled or spelled for another variety of English.', 'recieve', 'receive'],
    Style: ['clarity', 'Style', 'This is correct but could be clearer or more consistent.', 'In my opinion I think …', 'I think …'],
    Typo: ['correctness', 'Typo', 'Looks like a slip of the keyboard.', 'teh data', 'the data'],
    Usage: ['correctness', 'Usage', 'This word or phrase is not used this way in standard English.', 'We discussed about the plan.', 'We discussed the plan.'],
    WordChoice: ['correctness', 'Word choice', 'Another word fits better here or is the standard choice in this phrase.', 'I could of gone.', 'I could have gone.'],
    WordOrder: ['correctness', 'Word order', 'The words are in an unusual order.', 'We only have three samples left only.', 'We have only three samples left.'],
  };
  // Harper rules that Markooj's own rules or settings replace, and rules that move to another category
  // PassedPast, ThereToTheir and MergeWords flag correct everyday sentences ("The test passed.", "I went there.", "25 m3/s at");
  // VeryUnique is Markooj's own "absolute adjective" rule, which suggests the better fix.
  R.HARPER_OFF = ['SpellCheck', 'Spaces', 'NoFrenchSpaces', 'LongSentences', 'AvoidContractions', 'SentenceCapitalization', 'Dashes', 'EllipsisLength', 'UseEllipsisCharacter', 'QuoteSpacing', 'UnclosedQuotes', 'TransposedSpace', 'PassedPast', 'ThereToTheir', 'MergeWords', 'VeryUnique'];
  // Examples for single Harper rules (a kind's example is only shown for the rule it was written for, see HARPER_KIND_RULE)
  R.HARPER_EXAMPLES = {
    ModalOf: ['I could of gone.', 'I could have gone.'], Discuss: ['We discussed about the plan.', 'We discussed the plan.'],
    RepeatedWords: ['the the results', 'the results'], AnA: ['It took a hour.', 'It took an hour.'],
    ItsContraction: ['Its a good day.', 'It’s a good day.'], TheirToThere: ['Their is a problem.', 'There is a problem.'],
    TheyreConfusions: ['They’re house is old.', 'Their house is old.'], PossessiveYour: ['You car is here.', 'Your car is here.'],
    ThenThan: ['It is bigger then the old one.', 'It is bigger than the old one.'], LessWorse: ['It is less worse than before.', 'It is less bad than before.'],
    ComprisesOf: ['The team comprises of five people.', 'The team comprises five people.'], ToLoseTooLoose: ['The belt is to loose.', 'The belt is too loose.'],
    AllIntentsAndPurposes: ['For all intensive purposes', 'For all intents and purposes'], PronounVerbAgreement: ['She have finished.', 'She has finished.'],
    NounVerbConfusion: ['The new rules will effect everyone.', 'The new rules will affect everyone.'], DisjointPrefixes: ['We will work out side the lab.', 'We will work outside the lab.'],
    CapitalizePersonalPronouns: ['Yesterday i measured it.', 'Yesterday I measured it.'], Regionalisms: ['We parked the lorry (American document).', 'We parked the truck.'], The: ['teh data', 'the data'],
  };
  // The kind examples above are shown only for the Harper rule that catches them (checked against harper.js 3.2.0);
  // other rules of the same kind show their own example (HARPER_EXAMPLES) or none, never an unrelated one.
  R.HARPER_KIND_RULE = { Agreement: 'PronounVerbAgreement', BoundaryError: 'DisjointPrefixes', Capitalization: 'CapitalizePersonalPronouns', Grammar: 'TheirToThere', Malapropism: 'NounVerbConfusion', Miscellaneous: 'AnA', Punctuation: 'ItsContraction', Regionalism: 'Regionalisms', Repetition: 'RepeatedWords', Typo: 'The', Usage: 'Discuss', WordChoice: 'ModalOf' };
  R.HARPER_CAT = { BoringWords: 'engagement', FillerWords: 'clarity', Hedging: 'delivery', RepeatedWords: 'correctness', Regionalisms: 'correctness', OxfordComma: 'clarity', NoOxfordComma: 'clarity' };
  R.HARPER_FORMAL = ['Hedging', 'AvoidCurses'];

  // ---- wrong prepositions (common learner and South Asian English mistakes)
  // [id, regex, replacement(match) → string, message, wrong, right, opts]
  const PRON = '(?:him|her|them|me|us|you|it)';
  const PREP = [
    ['discussAbout', /\b(discuss(?:es|ed|ing)?)\s+(?:about|on|regarding|over)\b/gi, m => m[1], '“Discuss” already means “talk about”, so it takes no preposition.', 'We discussed about the plan.', 'We discussed the plan.'],
    ['marriedWith', /\b(married|engaged)\s+with\b/gi, m => m[1] + ' to', 'You are married or engaged “to” someone.', 'She is married with a doctor.', 'She is married to a doctor.'],
    ['comprisesOf', /\b(comprises?|comprising)\s+of\b/gi, m => m[1], '“Comprise” means “consist of”, so it takes no “of”. Use “comprises” or “consists of”.', 'The team comprises of five people.', 'The team comprises five people.'],
    ['differentThan', /\bdifferent\s+than\b(?!\s+(?:I|we|you|they|he|she|it)\s+(?:had|have|was|were|did|thought|expected))/gi, () => 'different from', '“Different from” is the standard form in formal writing.', 'The result is different than ours.', 'The result is different from ours.', { formal: true }],
    ['differentTo', /\bdifferent\s+to\b/gi, () => 'different from', 'In American English, write “different from”. (“Different to” is British.)', 'This method is different to the old one.', 'This method is different from the old one.', { dialect: 'US' }],
    ['onYear', /\bon\s+((?:1[5-9]|20)\d\d)\b(?![-–\d])(?=\s*(?:[.,;:!?)]|$|\s+(?:and|when|after|before|but|because|we|the)\b))/gi, m => 'in ' + m[1], 'Use “in” with years and months, “on” with days and dates.', 'The dam was built on 1998.', 'The dam was built in 1998.'],
    ['inWeekday', new RegExp('\\b(?:in|at)\\s+(' + DAYS + ')\\b', 'g'), m => 'on ' + m[1], 'Use “on” with days of the week.', 'We met in Monday.', 'We met on Monday.'],
    ['onMonth', new RegExp('\\bon\\s+(' + MONTHS + ')\\b(?!\\s+\\d)', 'g'), m => 'in ' + m[1], 'Use “in” with a month and “on” with a date.', 'The survey started on March.', 'The survey started in March.'],
    ['inDate', new RegExp('\\bin\\s+(' + MONTHS + ')\\s+(\\d{1,2})(st|nd|rd|th)?\\b(?!\\s*[-–])', 'g'), m => 'on ' + m[1] + ' ' + m[2] + (m[3] || ''), 'Use “on” with a date.', 'The flood began in July 3.', 'The flood began on July 3.'],
    ['atMorning', /\bat\s+(?:the\s+)?(morning|afternoon|evening)\b/gi, m => 'in the ' + m[1], 'Use “in the morning/afternoon/evening” and “at night”.', 'We left at the morning.', 'We left in the morning.'],
    ['inNight', /\b(?:in|on)\s+night\b/gi, () => 'at night', 'Say “at night”.', 'The pumps run in night.', 'The pumps run at night.'],
    ['angryOn', /\b(angry|annoyed|upset|mad|furious|cross)\s+(?:on|at)\s+(?=(?:him|her|them|me|us|you|my|his|her|their|our|the)\b)/gi, m => m[1] + ' with ', 'You are angry “with” a person and “about” a thing.', 'She was angry on him.', 'She was angry with him.'],
    ['replyBack', /\b(repl(?:y|ies|ied|ying))\s+back\b/gi, m => m[1], '“Reply” already means “answer back”.', 'Please reply back soon.', 'Please reply soon.'],
    ['returnBack', /\b(return(?:s|ed|ing)?)\s+back\b/gi, m => m[1], '“Return” already means “go or come back”.', 'They returned back home.', 'They returned home.'],
    ['revertBack', /\b(revert(?:s|ed|ing)?)\s+back\b/gi, m => m[1], '“Revert” already means “go back”.', 'The setting reverted back to default.', 'The setting reverted to default.'],
    ['copeUp', /\b(cop(?:e|es|ed|ing))\s+up\s+with\b/gi, m => m[1] + ' with', 'The phrase is “cope with”, without “up”.', 'They could not cope up with the load.', 'They could not cope with the load.'],
    ['emphasizeOn', /\b(emphasi[sz](?:e|es|ed|ing))\s+(?:on|upon)\b/gi, m => m[1], 'The verb “emphasize” takes no preposition. (The noun does: an emphasis on.)', 'The report emphasizes on safety.', 'The report emphasizes safety.'],
    ['requestFor', /\b((?:I|we|you|they|to|please|kindly|will|would|shall|should|must|can|could|may|might|humbly)\s+request|(?:I|we|he|she|they|have|has|had)\s+requested|requesting)\s+for\b/gi, m => m[1], 'The verb “request” takes no “for”. (The noun does: a request for.)', 'We request for more time.', 'We request more time.'],
    ['superiorThan', /\b(superior|inferior|senior|junior|prior|preferable)\s+than\b/gi, m => m[1] + ' to', 'These words compare with “to”, not “than”.', 'This method is superior than the old one.', 'This method is superior to the old one.'],
    ['elderThan', /\belder\s+than\b/gi, () => 'older than', '“Elder” is not used with “than”. Say “older than”.', 'He is elder than me.', 'He is older than me.'],
    ['consistIn', /\b(consist(?:s|ed|ing)?)\s+(?:in|on|from)\b(?!\s+(?:part|large))/gi, m => m[1] + ' of', 'To list parts, use “consist of”. (“Consist in” means “lies in” and is rare.)', 'The kit consists in three parts.', 'The kit consists of three parts.', { unsafe: true }],
    ['accordingToMe', /\baccording\s+to\s+me\b/gi, () => 'in my view', '“According to” introduces someone else’s view. For your own, say “in my view” or “I think”.', 'According to me, the plan works.', 'In my view, the plan works.'],
    ['enterInto', /\b(enter(?:s|ed|ing)?)\s+into\s+(?=(?:the|a|an|my|our|his|her|their)\s+(?:room|class|classroom|hall|house|building|office|car|bus|lab|laboratory|campus|country|city|premises|site)\b)/gi, m => m[1] + ' ', 'You enter a place directly. (“Enter into” is for agreements and talks.)', 'He entered into the room.', 'He entered the room.'],
    ['orderFor', /\b((?:I|we|you|they|he|she)\s+order(?:ed)?)\s+for\b/gi, m => m[1], 'You order something, without “for”.', 'We ordered for new parts.', 'We ordered new parts.'],
    ['investigateInto', /\b(investigat(?:e|es|ed|ing))\s+into\b/gi, m => m[1], 'The verb “investigate” takes no preposition. (The noun does: an investigation into.)', 'We investigated into the cause.', 'We investigated the cause.'],
    ['mentionAbout', /\b(mention(?:s|ed|ing)?|describ(?:e|es|ed|ing)|explain(?:s|ed|ing)?|stat(?:e|es|ed|ing)|answer(?:s|ed|ing)?)\s+about\b/gi, m => m[1], 'These verbs take an object directly, without “about”.', 'The paper describes about the method.', 'The paper describes the method.'],
    // no automatic fix: the person moves to the end of the clause ("explain the steps to me"), which a pattern cannot do well
    ['explainMe', /\b(explain(?:s|ed|ing)?|describ(?:e|es|ed|ing))\s+(me|him|her|us|them)\b(?!\s+(?:as|to)\b)/gi, () => null, 'You explain something “to” someone: put “to me” (or “to him”, “to them”) after the thing you explain.', 'Please explain me the steps.', 'Please explain the steps to me.', { unsafe: true }],
    ['attendTo', /\b(attend(?:s|ed|ing)?)\s+to\s+(?=(?:the|a|an|this|that|our|my|his|her|their)\s+(?:meeting|class|classes|lecture|conference|seminar|workshop|school|wedding|party|event|session|course|ceremony)\b)/gi, m => m[1] + ' ', 'You attend an event directly. (“Attend to” means “deal with”.)', 'We attended to the meeting.', 'We attended the meeting.'],
    ['lackOf', /\b(lacks|lacked)\s+of\b/gi, m => m[1], 'The verb “lack” takes no “of”. (The noun does: a lack of.)', 'The model lacks of data.', 'The model lacks data.'],
    ['approachTo', new RegExp('\\b(approach(?:es|ed|ing)?)\\s+to\\s+(?=' + PRON + '\\b)', 'gi'), m => m[1] + ' ', 'You approach someone directly, without “to”.', 'He approached to her for help.', 'He approached her for help.'],
    ['resembleWith', /\b(resembl(?:e|es|ed|ing))\s+(?:with|to)\b/gi, m => m[1], '“Resemble” takes no preposition.', 'The curve resembles with a bell.', 'The curve resembles a bell.'],
    ['capableTo', /\bcapable\s+to(?:\s+(\p{L}+))?\b/giu, m => 'capable of' + (m[1] ? ' ' + (/ing$/i.test(m[1]) ? m[1] : R.conj(m[1].toLowerCase())[3]) : ''), 'The phrase is “capable of” followed by an -ing word.', 'The pump is capable to lift water.', 'The pump is capable of lifting water.', { unsafe: true }],
    ['afraidFrom', /\b(afraid|scared|frightened|jealous|envious|ashamed)\s+(?:from|on|with)\b/gi, m => m[1] + ' of', 'These words take “of”.', 'She is afraid from dogs.', 'She is afraid of dogs.'],
    ['awareAbout', /\b(aware|conscious|proud|fond|capable|full|tired|sure)\s+(?:about|on|for)\b(?=\s+(?:the|a|an|this|that|these|those|it|them|his|her|our|their|my)\b)/gi, m => m[1] + ' of', 'These words take “of”.', 'We are aware about the risk.', 'We are aware of the risk.', { unsafe: true }],
    ['familiarAbout', /\bfamiliar\s+(?:about|of)\b/gi, () => 'familiar with', 'You are familiar “with” something.', 'Are you familiar about this tool?', 'Are you familiar with this tool?'],
    ['dependOf', /\b(depend(?:s|ed|ing)?|rel(?:y|ies|ied|ying)|insist(?:s|ed|ing)?|concentrat(?:e|es|ed|ing))\s+(?:of|at|in)\b(?!\s+(?:part|large|turn|some|many|no|any|which|order)\b)/gi, m => m[1] + ' on', 'These verbs take “on”.', 'It depends of the weather.', 'It depends on the weather.'],
    ['basedOff', /\bbased\s+off(?:\s+of)?\b/gi, () => 'based on', '“Based on” is the standard phrase.', 'The model is based off of real data.', 'The model is based on real data.'],
    ['congratulateFor', /\b(congratulat(?:e|es|ed|ing|ions))\s+for\b/gi, m => m[1] + ' on', 'You congratulate someone “on” something.', 'Congratulations for your award.', 'Congratulations on your award.'],
    ['despiteOf', /\bdespite\s+of\b/gi, () => 'despite', 'Use “despite” or “in spite of”, not “despite of”.', 'Despite of the rain, we left.', 'Despite the rain, we left.'],
    ['sinceDuration', /\bsince\s+((?:\d+|two|three|four|five|six|seven|eight|nine|ten|many|several|a\s+few|few|the\s+last\s+\w+)\s+(?:years?|months?|weeks?|days?|hours?|minutes?|decades?|centuries))\b/gi, m => 'for ' + m[1], 'Use “for” with a length of time and “since” with a starting point.', 'I have lived here since five years.', 'I have lived here for five years.'],
    ['onInternet', /\b(?:in|at)\s+the\s+internet\b/gi, () => 'on the internet', 'Things are “on” the internet.', 'I found it in the internet.', 'I found it on the internet.'],
    ['arriveTo', /\b(arriv(?:e|es|ed|ing))\s+to\b(?=\s+(?:the|a|an|my|our|his|her|their|this|that|\p{Lu}))/giu, m => m[1] + ' at', 'You arrive “at” a place or “in” a city or country.', 'We arrived to the station.', 'We arrived at the station.', { unsafe: true }],
    ['interestedAbout', /\binterested\s+(?:about|on|for)\b/gi, () => 'interested in', 'You are interested “in” something.', 'She is interested about physics.', 'She is interested in physics.'],
    ['divideIn', /\b(divid(?:e|es|ed|ing)|split(?:s|ting)?|translat(?:e|es|ed|ing)|convert(?:s|ed|ing)?|categori[sz](?:e|es|ed|ing)|classif(?:y|ies|ied|ying))\s+in\s+(?=(?:two|three|four|five|six|several|many|\d+)\s+\w)/gi, m => m[1] + ' into ', 'Use “into” for parts or groups that something is divided or turned into.', 'The class was divided in three groups.', 'The class was divided into three groups.', { unsafe: true }],
    ['agreeTo', new RegExp('\\b(agree(?:s|d|ing)?)\\s+to\\s+(?=' + PRON + '\\b)', 'gi'), m => m[1] + ' with ', 'You agree “with” a person and “to” a proposal.', 'I agree to you.', 'I agree with you.'],
    // ---- usage: common learner and South Asian English phrases (rule 'usage'; most need a person's judgment, so no safe fix)
    ['reachTo', /\b(reach(?:es|ed|ing)?)\s+to\s+(?=(?:the|a|an|my|our|his|her|their|this|that|home|office|school|college|university|\p{Lu})\b)/giu, m => m[1] + ' ', 'You reach a place directly, without “to”.', 'We reached to the office.', 'We reached the office.', { unsafe: true, rule: 'usage' }],
    ['doNeedful', /\b(?:please\s+|kindly\s+)?do\s+the\s+needful\b/gi, () => null, '“Do the needful” is not used outside South Asia. Say what you need: “please send the form”, “please fix it”.', 'Kindly do the needful.', 'Please send the signed form.', { unsafe: true, rule: 'usage' }],
    ['revertReply', /\b(revert(?:s|ed|ing)?)(?=\s+(?:back\s+)?(?:to\s+(?:me|us|him|her|them)\b|at\s+the\s+earliest\b|soon\b|asap\b|ASAP\b))/gi, m => ({ revert: 'reply', reverts: 'replies', reverted: 'replied', reverting: 'replying' })[m[1].toLowerCase()], '“Revert” means “go back to an earlier state”. To ask for an answer, say “reply”.', 'Please revert at the earliest.', 'Please reply soon.', { unsafe: true, rule: 'usage' }],
    ['atTheEarliest', /\bat\s+the\s+earliest\b(?=\s*[.!,]|\s*$)/gi, () => 'soon', 'In most English, “at the earliest” means “not before”. To ask for a quick answer, say “soon” or give a date.', 'Please reply at the earliest.', 'Please reply soon.', { unsafe: true, rule: 'usage' }],
    ['haveDoubt', /\b(?:(am|is|are)\s+having|(have|has|had))\s+(?:a\s+)?doubts?(?=\s+(?:regarding|about|on|in|with)\b)/gi, m => (m[1] ? ({ am: 'have', is: 'has', are: 'have' })[m[1].toLowerCase()] : m[2]) + ' a question', 'In most English, a “doubt” means you think something may be wrong. To ask about something, say “a question”.', 'I am having a doubt regarding the method.', 'I have a question about the method.', { unsafe: true, rule: 'usage' }],
    ['myselfName', /(?:^|(?<=[.!?]\s+))Myself\s+(?=\p{Lu}\p{L}+\b)/gu, () => null, 'To introduce yourself, write “I am …” or “My name is …”.', 'Myself Ahmed, I am a student.', 'I am Ahmed, a student.', { unsafe: true, rule: 'usage' }],
    ['requestPlease', /\brequest\s+you\s+to\s+(?:kindly|please)\b/gi, () => 'ask you to', '“Request you to please” says “please” twice. Write “Please …” or “I ask you to …”.', 'I request you to please send the file.', 'Please send the file.', { unsafe: true, rule: 'usage' }],
    ['yourWelcome', /\b(your)\s+(?=welcome\b\s*(?:[.!,]|$))/gi, m => R.matchCase(m[1], 'you’re') + ' ', '“You’re welcome” is short for “you are welcome”.', 'Your welcome.', 'You’re welcome.', { unsafe: true, rule: 'usage' }],
    ['betweenYouAndI', /\b(between)\s+you\s+and\s+I\b/gi, m => m[1] + ' you and me', 'After a preposition such as “between”, use “me”.', 'Between you and I, the plan is late.', 'Between you and me, the plan is late.', { unsafe: true, rule: 'usage' }],
    ['whosBook', /\b(who['’]s)\s+(?=(?:book|car|bag|pen|house|phone|turn|idea|job|fault|name|work|paper|money|coat|seat|laptop|file|desk|room|key|keys|bike)\b)/gi, m => R.matchCase(m[1], 'whose') + ' ', '“Who’s” means “who is”. To ask about the owner, write “whose”.', 'Who’s book is this?', 'Whose book is this?', { unsafe: true, rule: 'usage' }],
    ['lessCount', /\b(less)\s+(?=(?:people|students|cars|items|books|words|errors|mistakes|samples|members|users|calories|days|hours|years|points|files|questions|participants|employees|patients|cases|trees|houses|children)\b)/gi, m => R.matchCase(m[1], 'fewer') + ' ', 'Use “fewer” with things you can count and “less” with amounts.', 'Less people attended this year.', 'Fewer people attended this year.', { unsafe: true, rule: 'usage' }],
    ['meAndHim', /(?:^|(?<=[.!?]\s+))(Me)\s+and\s+(him|her|them|my\s+\p{L}+)\s+(?=(?:went|go|are|were|have|had|will|did|played|met|saw|made|live|lived|work|worked)\b)/gu, m => { const o = { him: 'He', her: 'She', them: 'They' }[m[2].toLowerCase()] || (m[2][0].toUpperCase() + m[2].slice(1)); return o + ' and I '; }, 'As the subject, use “I”, and name the other person first: “He and I went …”.', 'Me and him went to the lab.', 'He and I went to the lab.', { unsafe: true, rule: 'usage' }],
    ['iSeen', /\b(I|we|you|they|he|she)\s+seen\b/g, m => m[1] + ' saw', '“Seen” needs “have” or “has” before it: “I have seen”. On its own, write “saw”.', 'I seen him yesterday.', 'I saw him yesterday.', { unsafe: true, rule: 'usage' }],
    ['thereGoing', /(?<!\b(?:is|was|are|were|be|been|not|isn['’]t|wasn['’]t|aren['’]t|weren['’]t)\s+)\b(there)\s+(?=going\s+to\s+(?!be\b))/gi, m => R.matchCase(m[1], 'they’re') + ' ', '“They’re” means “they are”. “There” is a place.', 'There going to finish today.', 'They’re going to finish today.', { unsafe: true, rule: 'usage' }],
    ['irregardless', /\b(irregardless)\b/gi, m => R.matchCase(m[1], 'regardless'), '“Irregardless” is not standard English. Write “regardless”.', 'Irregardless of the cost, we will go.', 'Regardless of the cost, we will go.', { rule: 'usage' }],
    ['goodIn', /\b(good|bad|better|best|expert|skilled|excellent|poor)\s+in\s+(?=(?:math|maths|english|science|physics|chemistry|sports?|cricket|football|writing|coding|programming|drawing|cooking)\b)/gi, m => m[1] + ' at ', 'You are good or bad “at” a skill.', 'He is good in math.', 'He is good at math.', { unsafe: true }],
  ];
  R.PREPOSITIONS = PREP.map(([id, , , message, wrong, right, o]) => ({ id, message, wrong, right, ...(o || {}) }));
  // a plural subject with a singular verb: "the results shows", "these findings suggests" ("data shows" is accepted)
  const AGREE_VERB = { shows: 'show', suggests: 'suggest', indicates: 'indicate', demonstrates: 'demonstrate', reveals: 'reveal', confirms: 'confirm', seems: 'seem', appears: 'appear', has: 'have', is: 'are', was: 'were', does: 'do', remains: 'remain', provides: 'provide', supports: 'support', needs: 'need', makes: 'make', contains: 'contain', includes: 'include', requires: 'require', depends: 'depend', agrees: 'agree', differs: 'differ', describes: 'describe', presents: 'present' };
  const AGREE_RE = new RegExp('\\b(?:the|these|those|our|their|its|his|her|my|your|all|many|both|several|some|most|such|two|three|four|five)\\s+(?:\\p{L}+\\s+)?(results|findings|studies|values|samples|methods|models|authors|researchers|students|people|children|tests|experiments|measurements|figures|tables|data\\s+sets|datasets|equations|users|members|participants|observations|simulations|analyses)\\s+(' + Object.keys(AGREE_VERB).join('|') + ')\\b', 'giu');

  // ---- wordy phrases → shorter ones
  const WORDY = [
    ['in order to', 'to'], ['in order for', 'for'], ['due to the fact that', 'because'], ['owing to the fact that', 'because'], ['in light of the fact that', 'because'], ['on account of the fact that', 'because'],
    ['in spite of the fact that', 'although'], ['despite the fact that', 'although'], ['regardless of the fact that', 'although'], ['at this point in time', 'now'], ['at the present time', 'now'], ['at this moment in time', 'now'],
    ['in the event that', 'if'], ['in the near future', 'soon'], ['for the purpose of', 'for'], ['with the purpose of', 'to'], ['a large number of', 'many'], ['a great number of', 'many'], ['a significant number of', 'many'],
    ['a small number of', 'a few'], ['the majority of', 'most'], ['the vast majority of', 'most'], ['a sufficient number of', 'enough'], ['a sufficient amount of', 'enough'],
    ['has the ability to', 'can'], ['have the ability to', 'can'], ['is able to', 'can'], ['are able to', 'can'], ['has the capacity to', 'can'], ['in close proximity to', 'near'], ['in the vicinity of', 'near'],
    ['prior to', 'before'], ['subsequent to', 'after'], ['until such time as', 'until'], ['on a daily basis', 'daily'], ['on a weekly basis', 'weekly'], ['on a monthly basis', 'monthly'], ['on a regular basis', 'regularly'],
    ['in a timely manner', 'promptly'], ['in a similar fashion', 'similarly'], ['in a similar manner', 'similarly'], ['each and every', 'each'], ['first and foremost', 'first'], ['basic fundamentals', 'fundamentals'], ['end result', 'result'],
    ['final outcome', 'outcome'], ['future plans', 'plans'], ['past history', 'history'], ['completely eliminate', 'eliminate'], ['absolutely essential', 'essential'], ['advance planning', 'planning'], ['joint collaboration', 'collaboration'],
    ['new innovation', 'innovation'], ['whether or not', 'whether'], ['the reason why is because', 'because'], ['the reason is because', 'the reason is that'], ['so as to', 'to'], ['as a matter of fact', 'in fact'], ['at all times', 'always'],
    ['by means of', 'by'], ['with regard to', 'about'], ['with reference to', 'about'], ['in regard to', 'about'], ['in relation to', 'about'], ['concerning the matter of', 'about'], ['for the reason that', 'because'],
    ['it is important to note that', ''], ['it should be noted that', ''], ['it is worth noting that', ''], ['it is interesting to note that', ''], ['needless to say', ''], ['in the process of', ''],
    ['a total of', ''], ['in actual fact', 'in fact'], ['in the course of', 'during'], ['during the course of', 'during'], ['in the absence of', 'without'], ['is indicative of', 'indicates'], ['are indicative of', 'indicate'],
    ['is in need of', 'needs'], ['are in need of', 'need'], ['make use of', 'use'], ['makes use of', 'uses'], ['made use of', 'used'], ['take into consideration', 'consider'], ['takes into consideration', 'considers'], ['took into consideration', 'considered'],
    ['along the lines of', 'like'], ['on the basis of', 'based on'], ['with the exception of', 'except'], ['in excess of', 'more than'], ['in the amount of', 'for'], ['give rise to', 'cause'], ['gives rise to', 'causes'],
  ];
  R.WORDY = WORDY;
  // ---- hidden verbs (nominalizations): [light verb, noun phrase, verb, swallow following preposition]
  const NOMS = [
    ['make', 'a decision', 'decide', ''], ['take', 'a decision', 'decide', ''], ['make', 'a choice', 'choose', ''], ['make', 'an assumption', 'assume', ''], ['make', 'a recommendation', 'recommend', ''],
    ['make', 'a suggestion', 'suggest', ''], ['make', 'an improvement', 'improve', '(?:in|to|on)'], ['make', 'a comparison', 'compare', '(?:of|between)'], ['make', 'an adjustment', 'adjust', '(?:to|in)'], ['make', 'an attempt', 'attempt', ''],
    ['make', 'a contribution', 'contribute', ''], ['make', 'an observation', 'observe', '(?:of|about)'], ['make', 'reference', 'refer', ''], ['make', 'an analysis', 'analyze', '(?:of)'], ['make', 'a measurement', 'measure', '(?:of)'],
    ['give', 'an explanation', 'explain', '(?:of|for)'], ['give', 'a description', 'describe', '(?:of)'], ['give', 'consideration', 'consider', '(?:to)'], ['give', 'an indication', 'indicate', '(?:of)'], ['give', 'a presentation', 'present', '(?:of|on|about)'],
    ['take', 'action', 'act', ''], ['reach', 'a conclusion', 'conclude', ''], ['come to', 'a conclusion', 'conclude', ''], ['reach', 'an agreement', 'agree', ''],
    ['carry out', 'an investigation', 'investigate', '(?:of|into)'], ['carry out', 'an analysis', 'analyze', '(?:of)'], ['carry out', 'an evaluation', 'evaluate', '(?:of)'], ['carry out', 'an assessment', 'assess', '(?:of)'], ['carry out', 'a review', 'review', '(?:of)'],
    ['conduct', 'an investigation', 'investigate', '(?:of|into)'], ['conduct', 'an analysis', 'analyze', '(?:of)'], ['conduct', 'an evaluation', 'evaluate', '(?:of)'], ['conduct', 'a review', 'review', '(?:of)'], ['conduct', 'an assessment', 'assess', '(?:of)'], ['conduct', 'an examination', 'examine', '(?:of)'],
    ['perform', 'an analysis', 'analyze', '(?:of)'], ['perform', 'a calculation', 'calculate', '(?:of)'], ['perform', 'an evaluation', 'evaluate', '(?:of)'], ['perform', 'a comparison', 'compare', '(?:of|between)'], ['perform', 'a simulation', 'simulate', '(?:of)'],
    ['provide', 'an explanation', 'explain', '(?:of|for)'], ['provide', 'a description', 'describe', '(?:of)'], ['provide', 'assistance', 'help', '(?:to)'], ['provide', 'a summary', 'summarize', '(?:of)'], ['provide', 'an estimate', 'estimate', '(?:of)'],
    ['have', 'a discussion', 'discuss', '(?:about|on|of)'], ['hold', 'a discussion', 'discuss', '(?:about|on|of)'],
  ];
  const nomRules = [];
  for (const [lv, np, verb, swallow] of NOMS) {
    const lf = forms(lv), vf = forms(verb);
    lf.forEach((f, i) => { if (i === 4 && lf[4] === lf[2]) return; nomRules.push({ re: new RegExp('\\b' + f.replace(/ /g, '\\s+') + '\\s+' + np.replace(/ /g, '\\s+') + (swallow ? '(?:\\s+' + swallow + ')?' : '') + '\\b', 'gi'), rep: vf[i === 4 ? 4 : i], verb, phrase: lv + ' ' + np }); });
  }
  R.NOMINALIZATIONS = NOMS;
  const NOM_HINT = new RegExp('\\b(?:' + [...new Set(NOMS.map(x => x[1].split(' ').pop()))].join('|') + ')\\b', 'i');

  // ---- "very" + plain word → one stronger word; absolute adjectives
  const VERY = { good: 'excellent', bad: 'terrible', big: 'huge', large: 'enormous', small: 'tiny', important: 'crucial', tired: 'exhausted', happy: 'delighted', sad: 'miserable', difficult: 'challenging', hard: 'difficult', easy: 'effortless', fast: 'rapid', quick: 'rapid', slow: 'sluggish', old: 'ancient', cold: 'freezing', hot: 'scorching', clear: 'obvious', interesting: 'fascinating', hungry: 'starving', scared: 'terrified', afraid: 'terrified', angry: 'furious', beautiful: 'gorgeous', smart: 'brilliant', often: 'frequently', many: 'numerous', different: 'distinct', similar: 'alike', high: 'soaring', low: 'minimal', bright: 'brilliant', dirty: 'filthy', clean: 'spotless', strong: 'powerful', weak: 'feeble', short: 'brief', long: 'lengthy', simple: 'basic', serious: 'grave', careful: 'meticulous', rich: 'wealthy', poor: 'destitute', loud: 'deafening', quiet: 'silent', wet: 'soaked', dry: 'parched', useful: 'invaluable', necessary: 'essential', sure: 'certain', worried: 'anxious', surprised: 'astonished', pleased: 'thrilled', funny: 'hilarious', boring: 'tedious', accurate: 'precise', large: 'enormous' };
  const ABSOLUTE = ['unique', 'perfect', 'complete', 'essential', 'impossible', 'dead', 'final', 'infinite', 'absolute', 'ideal', 'universal', 'entire', 'fatal', 'unanimous', 'supreme', 'total', 'optimal', 'identical', 'unbeatable', 'irrevocable'];
  const INTENS = ['really', 'basically', 'actually', 'literally', 'totally', 'truly', 'definitely'];
  // ---- contractions (formal goal)
  const CONTR = { "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "can't": 'cannot', "won't": 'will not', "isn't": 'is not', "aren't": 'are not', "wasn't": 'was not', "weren't": 'were not', "haven't": 'have not', "hasn't": 'has not', "hadn't": 'had not', "couldn't": 'could not', "shouldn't": 'should not', "wouldn't": 'would not', "mustn't": 'must not', "needn't": 'need not', "it's": 'it is', "that's": 'that is', "there's": 'there is', "what's": 'what is', "let's": 'let us', "i'm": 'I am', "you're": 'you are', "we're": 'we are', "they're": 'they are', "i've": 'I have', "we've": 'we have', "you've": 'you have', "they've": 'they have', "i'll": 'I will', "we'll": 'we will', "you'll": 'you will', "they'll": 'they will', "it'll": 'it will', "i'd": 'I would', "we'd": 'we would', "they'd": 'they would', "he's": 'he is', "she's": 'she is', "who's": 'who is', "here's": 'here is', "where's": 'where is' };
  // ---- informal words (formal goal)
  const INFORMAL = [['a lot of', 'many'], ['lots of', 'many'], ['a bunch of', 'several'], ['kids', 'children'], ['gonna', 'going to'], ['wanna', 'want to'], ['gotta', 'have to'], ['stuff', 'material'], ['awesome', 'excellent'], ['okay', 'acceptable'], ['a bit', 'slightly'], ['big deal', 'significant matter'], ['get rid of', 'remove'], ['figure out', 'determine'], ['figured out', 'determined'], ['find out', 'discover'], ['found out', 'discovered'], ['come up with', 'develop'], ['came up with', 'developed'], ['look into', 'investigate'], ['looked into', 'investigated'], ['talk about', 'discuss'], ['talked about', 'discussed'], ['pretty much', 'largely'], ['kind of', 'somewhat'], ['sort of', 'somewhat'], ['huge', 'substantial'], ['tons of', 'large amounts of'], ['loads of', 'many'], ['nowadays', 'today'], ['anyways', 'anyway'], ['cool', 'excellent']];
  const byLen = list => list.map(x => x[0]).sort((a, b) => b.length - a.length);
  const WORDY_MAP = new Map(WORDY.map(([a, b]) => [a, b]));
  const WORDY_RE = new RegExp('\\b(?:' + alt(byLen(WORDY)) + ')\\b', 'gi');
  const INFORMAL_MAP = new Map(INFORMAL.map(([a, b]) => [a, b]));
  const INFORMAL_RE = new RegExp('\\b(?:' + alt(byLen(INFORMAL)) + ')\\b', 'gi');
  const INTENS_RE = new RegExp('\\b(' + INTENS.join('|') + ')\\b', 'gi');
  const HEDGES = /\b(?:may|might|could|possibly|perhaps|seems?|seemingly|appears?|apparently|suggests?|somewhat|relatively|likely|probably|potentially|arguably|presumably|tends?\s+to|to\s+some\s+extent|to\s+a\s+certain\s+degree|it\s+is\s+possible\s+that|more\s+or\s+less|in\s+a\s+way)\b/gi;
  const OVERUSED = ['good', 'great', 'nice', 'important', 'interesting', 'really', 'very', 'thing', 'things', 'stuff', 'big', 'bad', 'amazing', 'awesome', 'huge', 'various', 'different', 'significant', 'significantly', 'clearly', 'obviously', 'basically', 'actually', 'especially', 'extremely', 'totally', 'absolutely', 'definitely', 'crucial', 'key', 'main', 'major', 'show', 'shows', 'showed', 'shown', 'get', 'gets', 'got', 'make', 'makes', 'made', 'also', 'however', 'moreover', 'furthermore', 'additionally', 'overall', 'novel', 'robust', 'utilize', 'utilized', 'leverage'];
  const STOP = new Set('a an the and or but if then than that this these those of to in on at by for with from as is are was were be been being it its it’s we our you your they their he she his her i me my not no so do does did have has had can could will would should may might must which who whom whose what when where why how all any each both few more most other some such only own same too very also just into over under again further once here there about between through during before after above below up down out off'.split(' '));

  // ---- US/UK spellings: generated families plus a list
  const US_UK = [];
  const pair = (us, uk) => US_UK.push([us, uk]);
  // -or/-our
  for (const b of ['color', 'behavior', 'favor', 'honor', 'humor', 'labor', 'neighbor', 'flavor', 'harbor', 'odor', 'rumor', 'vapor', 'vigor', 'armor', 'endeavor', 'savior', 'tumor', 'valor', 'parlor', 'splendor', 'rigor', 'clamor', 'demeanor', 'candor', 'ardor', 'fervor']) {
    const uk = b.replace(/or$/, 'our');
    for (const suf of ['', 's', 'ed', 'ing', 'ful', 'ite', 'ites', 'able', 'al', 'ist', 'ists', 'less', 'ism']) pair(b + suf, uk + suf);
  }
  // -ize/-ise (British dictionaries accept -ize, so only -ise is flagged in American documents)
  const IZE = ['organ', 'real', 'recogn', 'apolog', 'author', 'categor', 'character', 'civil', 'critic', 'emphas', 'final', 'general', 'harmon', 'hypothes', 'ideal', 'maxim', 'minim', 'mobil', 'modern', 'normal', 'optim', 'priorit', 'random', 'special', 'standard', 'summar', 'symbol', 'sympath', 'synthes', 'util', 'visual', 'custom', 'digit', 'global', 'local', 'memor', 'neutral', 'penal', 'popular', 'public', 'stabil', 'steril', 'polar', 'parameter', 'initial', 'serial', 'token', 'vector', 'colon', 'legal', 'mechan', 'personal', 'capital', 'central', 'crystall', 'energ', 'familiar', 'formal', 'fertil', 'hospital', 'immun', 'industrial', 'internal', 'jeopard', 'legitim', 'material', 'metabol', 'monopol', 'ostrac', 'patron', 'privat', 'rational', 'revolution', 'scrutin', 'social', 'subsid', 'theor', 'trivial', 'vapor', 'discretiz', 'regular', 'equal', 'quant', 'computer', 'commercial', 'decentral', 'desensit', 'sensit', 'factor', 'ion', 'oxid', 'polymer', 'homogen', 'catalogu'];
  for (const st of IZE) { if (st === 'discretiz' || st === 'catalogu') continue; for (const [a, b] of [['ize', 'ise'], ['izes', 'ises'], ['ized', 'ised'], ['izing', 'ising'], ['ization', 'isation'], ['izations', 'isations'], ['izer', 'iser'], ['izers', 'isers']]) pair(st + a, st + b); }
  for (const st of ['analy', 'paraly', 'cataly', 'hydroly', 'dialy', 'electroly']) for (const [a, b] of [['ze', 'se'], ['zes', 'ses'], ['zed', 'sed'], ['zing', 'sing'], ['zer', 'ser']]) pair(st + a, st + b);
  // -er/-re
  for (const b of ['center', 'theater', 'fiber', 'liter', 'caliber', 'somber', 'meager', 'saber', 'specter', 'luster', 'sepulcher', 'scepter', 'goiter', 'reconnoiter']) { const uk = b.replace(/er$/, 're'); pair(b, uk); pair(b + 's', uk + 's'); }
  pair('centered', 'centred'); pair('centering', 'centring'); pair('millimeter', 'millimetre'); pair('millimeters', 'millimetres'); pair('centimeter', 'centimetre'); pair('centimeters', 'centimetres'); pair('kilometer', 'kilometre'); pair('kilometers', 'kilometres'); pair('maneuver', 'manoeuvre'); pair('maneuvers', 'manoeuvres');
  // -ense/-ence, -og/-ogue, doubled l and others
  for (const [a, b] of [['defense', 'defence'], ['offense', 'offence'], ['pretense', 'pretence'], ['catalog', 'catalogue'], ['catalogs', 'catalogues'], ['analog', 'analogue'], ['traveled', 'travelled'], ['traveling', 'travelling'], ['traveler', 'traveller'], ['travelers', 'travellers'], ['modeled', 'modelled'], ['modeling', 'modelling'], ['modeler', 'modeller'], ['labeled', 'labelled'], ['labeling', 'labelling'], ['canceled', 'cancelled'], ['canceling', 'cancelling'], ['signaled', 'signalled'], ['signaling', 'signalling'], ['leveled', 'levelled'], ['leveling', 'levelling'], ['fueled', 'fuelled'], ['fueling', 'fuelling'], ['counselor', 'counsellor'], ['counseling', 'counselling'], ['jewelry', 'jewellery'], ['enrollment', 'enrolment'], ['fulfill', 'fulfil'], ['fulfillment', 'fulfilment'], ['skillful', 'skilful'], ['willful', 'wilful'], ['installment', 'instalment'], ['gray', 'grey'], ['aluminum', 'aluminium'], ['artifact', 'artefact'], ['artifacts', 'artefacts'], ['aging', 'ageing'], ['mold', 'mould'], ['molds', 'moulds'], ['plow', 'plough'], ['pajamas', 'pyjamas'], ['cozy', 'cosy'], ['mustache', 'moustache'], ['skeptic', 'sceptic'], ['skeptical', 'sceptical'], ['skepticism', 'scepticism'], ['anemia', 'anaemia'], ['anesthesia', 'anaesthesia'], ['hemoglobin', 'haemoglobin'], ['pediatric', 'paediatric'], ['estrogen', 'oestrogen'], ['fetus', 'foetus'], ['esophagus', 'oesophagus'], ['diarrhea', 'diarrhoea'], ['leukemia', 'leukaemia'], ['orthopedic', 'orthopaedic'], ['encyclopedia', 'encyclopaedia'], ['tire', 'tyre'], ['tires', 'tyres'], ['curb', 'kerb'], ['draft', 'draught'], ['program', 'programme'], ['programs', 'programmes'], ['check', 'cheque'], ['acknowledgment', 'acknowledgement'], ['judgment', 'judgement'], ['math', 'maths'], ['license', 'licence'], ['licenses', 'licences'], ['practice', 'practise'], ['practiced', 'practised'], ['practicing', 'practising'], ['practices', 'practises']]) {
    pair(a, b);
  }
  // pairs that are both valid words in one variety (tire, draft, check, program …) only count the British form in American documents
  // (British English writes "license" and "practise" for the verb and "licence" and "practice" for the noun, so those are not flagged there)
  const US_AMBIG = new Set(['tire', 'tires', 'curb', 'draft', 'check', 'program', 'programs', 'acknowledgment', 'judgment', 'math', 'license', 'licenses', 'practice', 'practices', 'practiced', 'practicing']);
  const UK_AMBIG = new Set(['acknowledgement', 'judgement']);
  R.US_UK = US_UK;
  const usOf = new Map(), ukOf = new Map();
  for (const [us, uk] of US_UK) { if (!usOf.has(uk)) usOf.set(uk, us); if (!ukOf.has(us)) ukOf.set(us, uk); }
  R.dialectOf = w => { const l = w.toLowerCase(); return ukOf.has(l) ? 'US' : usOf.has(l) ? 'UK' : null; };

  // ---- acronyms everyone knows
  const KNOWN_ACR = new Set('US USA UK EU UN PDF HTML CSS URL URLS PHD MSC BSC MA BA MD AI OK TV DNA RNA CEO CFO CTO GPS ID IT FAQ PS AM PM BC AD BCE CE CPU GPU RAM ROM USB API APIS JSON XML HTTP HTTPS SQL PNG JPEG JPG GIF SVG MP3 MP4 NATO UNESCO WHO UNICEF ISBN ISSN DOI ISO IEEE APA MLA GDP COVID HIV AIDS MRI CT BMI IQ GMT UTC NGO NGOS NASA FBI CIA UAE UNO PC PCS IOS OS RSS VPN WIFI LED LCD DVD CD UFO AKA ASAP DIY FYI RSVP TBD TBA ETA NB IE EG ETC VS CV CVS HR PR QA KPI ROI SME SMES CSV PDFS UI UX IDE CLI SDK LATEX GNU MIT BSD GPL AGPL MPL RGB CMYK HD UHD AC DC UV IR CO2 H2O NO2 SO2 PH DC LAN WAN IP TCP UDP DNS SSH SSL TLS SMS MMS'.split(' '));
  const ROMAN = /^(?=[MDCLXVI]+$)M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

  // =================================================================== goals
  R.DEFAULT_GOALS = { audience: 'general', formality: 'neutral', domain: 'general' };
  R.goalsWant = function goalsWant(g = {}) {
    const goals = { ...R.DEFAULT_GOALS, ...g };
    const formal = goals.formality === 'formal' || goals.domain === 'academic' || (goals.domain === 'business' && goals.formality !== 'informal');
    return {
      goals, formal,
      passive: goals.domain !== 'academic' && goals.formality !== 'informal',
      contraction: formal,
      informal: formal,
      opinion: goals.domain === 'academic' || goals.formality === 'formal',
      hedging: goals.domain !== 'general' || goals.formality === 'formal',
      acronym: goals.domain !== 'general' || goals.audience !== 'expert',
      intensifier: goals.formality !== 'informal',
      longBoost: goals.audience === 'expert' ? 10 : goals.audience === 'knowledgeable' ? 5 : 0,
    };
  };

  // =================================================================== checking
  const mk = (rule, cat, start, end, text, o = {}) => ({ rule, cat, start, end, text, ...o });
  function testRe(re) { re.lastIndex = 0; return re; }
  /**
   * Findings for one block (offsets relative to the block). ctx: {dialect: 'US'|'UK', want (goalsWant), longSentence}
   */
  R.checkBlock = function checkBlock(block, ctx) {
    const t = block.text, src = block.raw, out = [];
    const want = ctx.want || R.goalsWant(ctx.goals);
    const dialect = ctx.dialect || 'US';
    const marks = i => src[i] !== t[i]; // a Markdown mark inside the span: fixes would break the formatting
    const spanHasMarks = (s, e) => { for (let i = s; i < e; i++) if (marks(i)) return true; return false; };
    const add = (rule, s, e, o) => {
      const text = src.slice(s, e);
      const reps = o.replacements || [];
      const f = mk(rule, o.cat || RULES[rule]?.cat || 'correctness', s, e, text, { title: o.title || RULES[rule]?.title, message: o.message, replacements: spanHasMarks(s, e) ? [] : reps, safe: !!o.safe && !spanHasMarks(s, e) && reps.length === 1 });
      if (o.wrong) { f.wrong = o.wrong; f.right = o.right; }
      if (o.sub) f.sub = o.sub;
      if (o.wide) f.wide = true;
      if (o.synonyms) f.synonyms = o.synonyms;
      out.push(f);
    };
    // A fix that deletes words: take the space after them too, and capitalize the next word at a sentence start.
    const removal = (s, e) => {
      while (e < t.length && t[e] === ' ') e++;
      const atStart = !t.slice(0, s).trim() || /[.!?:]["'’”)]*\s*$/.test(t.slice(0, s));
      // at the start of a sentence the next word gets the capital; the fix covers that whole word ("Basically the" → "The")
      if (atStart && /\p{Ll}/u.test(t[e] || '')) { let w = e + 1; while (w < t.length && /[\p{L}\p{N}'’-]/u.test(t[w])) w++; return { start: s, end: w, rep: t[e].toUpperCase() + t.slice(e + 1, w) }; }
      if (!atStart) while (s > 0 && t[s - 1] === ' ' && (e >= t.length || /[\s,.;:!?]/.test(t[e]))) s--;
      return { start: s, end: e, rep: '' };
    };
    let m;
    // prepositions
    for (const [id, re, fn, message, wrong, right, o = {}] of PREP) {
      if (o.dialect && o.dialect !== dialect) continue;
      if (o.formal && !want.formal && !(id === 'differentThan' && dialect === 'UK')) continue;
      testRe(re);
      while ((m = re.exec(t))) {
        if (!m[0].length) { re.lastIndex++; continue; }
        const r0 = fn(m);
        const rep = r0 == null ? null : R.matchCase(m[0], r0);
        add(o.rule || 'preposition', m.index, m.index + m[0].length, { message, replacements: rep == null || rep === m[0] ? [] : [rep], safe: !o.unsafe && rep != null, wrong, right, sub: id });
      }
    }
    // subject and verb agreement (plural subject, singular verb)
    AGREE_RE.lastIndex = 0;
    while ((m = AGREE_RE.exec(t))) {
      const v = m[2], s0 = m.index + m[0].length - v.length;
      add('agreement', s0, s0 + v.length, { message: `“${m[1]}” is plural, so the verb is “${AGREE_VERB[v.toLowerCase()]}”.`, replacements: [R.matchCase(v, AGREE_VERB[v.toLowerCase()])], safe: false });
    }
    // a / an
    const aRe = /\b(a|an|A|An|AN)\s+([\p{L}\p{N}][\p{L}\p{N}'’-]*)/gu;
    while ((m = aRe.exec(t))) {
      const art = m[1], word = m[2];
      const need = articleFor(word);
      if (!need || (need === 'an') === (art.toLowerCase() === 'an')) continue;
      // "A. Introduction" or "A) first item" is a label, not an article
      if (/^[A-Z]$/.test(art) && /^[.)]/.test(t.slice(m.index + 1, m.index + 2))) continue;
      // abbreviations and letter names (URL, X-ray) depend on how people say them: never an automatic fix
      const sayAs = /^\p{Lu}{2,}/u.test(word) || /^\p{Lu}-/u.test(word);
      add('article', m.index, m.index + art.length, { message: need === 'an' ? `Use “an” before “${word}”, which starts with a vowel sound.` : `Use “a” before “${word}”, which starts with a consonant sound.`, replacements: [R.matchCase(art, need)], safe: !sayAs });
    }
    // its / it's
    // only words that cannot follow a possessive: "its very existence", "its so-called", "its not-for-profit arm" are correct.
    // The fix is never automatic: one wrong guess changes a correct possessive.
    const itsRe = /\b(its)\s+(?:(a|an|the|been|going|getting|becoming)\b(?!-)|((?:clear|likely|unlikely|possible|impossible|important|true|hard|easy|difficult|necessary|obvious|time|worth|essential|crucial|vital|interesting|surprising|known|believed|thought|said)\s+(?:that|to|whether|if|how|for)\b))/gi;
    while ((m = itsRe.exec(t))) add('its', m.index, m.index + 3, { message: '“It’s” means “it is” or “it has”. “Its” shows possession.', replacements: [R.matchCase(m[1], 'it’s')], safe: false });
    const itsRe2 = /\b(it['’]s)\s+(own|self)\b/gi;
    while ((m = itsRe2.exec(t))) add('its', m.index, m.index + m[1].length, { message: 'To show possession, write “its” without an apostrophe.', replacements: [R.matchCase(m[1], 'its')], safe: true });
    const itsRe3 = /\b(?:of|with|by|from|and|on|in|for|to|about)\s+(it['’]s)\s+(?!(?:a|an|the|not|been|going|being|very|so|too|just|still|now|also|important|clear|possible|necessary|likely|unlikely|true|hard|easy|difficult|obvious|raining|time|my|your|our|their|his|her|this|that|what|how|why|when|where|who|only|all|in|on|at|to|for|of|as|like|more|less|about|over|up|out|no|never|always|often|usually|probably|because|getting|becoming|worth|best|better|worse|okay|ok|fine|done|over|here|there)\b)([\p{Ll}]{3,}s)\b/gu;
    while ((m = itsRe3.exec(t))) { const s = m.index + m[0].indexOf(m[1]); add('its', s, s + m[1].length, { message: 'To show possession, write “its” without an apostrophe.', replacements: [R.matchCase(m[1], 'its')], safe: false }); }
    // "lost it’s accuracy": after verbs that take an object, "it’s" + a noun is the possessive
    const itsRe4 = /\b(?:lost|lose|loses|losing|keep|keeps|kept|keeping|gain|gains|gained|change|changes|changed|improve|improves|improved|increase|increased|reach|reached|reduce|reduced|retain|retained|maintain|maintained|lost|regain|regained|show|showed|shows)\s+(it['’]s)\s+(?!(?:a|an|the|not|been|going|being|very|so|too|just|still|now|also|getting|becoming|only|all|in|on|at|to|for|of|as|like|more|less|about|over|up|out|no|never|always|my|your|our|their|his|her|this|that)\b)\p{Ll}{3,}\b/gu;
    while ((m = itsRe4.exec(t))) { const s = m.index + m[0].indexOf(m[1]); add('its', s, s + m[1].length, { message: 'To show possession, write “its” without an apostrophe.', replacements: [R.matchCase(m[1], 'its')], safe: false }); }
    // repeated words
    const repRe = /\b([\p{L}][\p{L}'’]*)(\s+)\1\b/giu;
    while ((m = repRe.exec(t))) {
      if (/^(had|that|is|do|can|bye|no|so|very|ha|la|ta|cha|aye|knock|tut|yo|pom|bora|beri|chop|tom|dum|mau|pooh|wagga|bon|ooh|aah)$/i.test(m[1]) && !/^very$/i.test(m[1])) continue;
      if (m[1].toLowerCase() !== m[0].slice(m[1].length + m[2].length).toLowerCase()) continue;
      add('repeated', m.index, m.index + m[0].length, { message: `“${m[1]}” appears twice in a row.`, replacements: [m[1]], safe: true });
    }
    // US/UK spelling
    for (const w of R.words(t)) {
      const l = w.w.toLowerCase();
      if (dialect === 'US' && usOf.has(l) && !UK_AMBIG.has(l)) add('dialect', w.start, w.end, { message: `This is the British spelling. In American English, write “${usOf.get(l)}”.`, replacements: [R.matchCase(w.w, usOf.get(l))], safe: true });
      else if (dialect === 'UK' && ukOf.has(l) && !US_AMBIG.has(l) && !/iz/.test(l)) add('dialect', w.start, w.end, { message: `This is the American spelling. In British English, write “${ukOf.get(l)}”.`, replacements: [R.matchCase(w.w, ukOf.get(l))], safe: true });
    }
    // wordy phrases (one compiled pattern for all of them)
    WORDY_RE.lastIndex = 0;
    while ((m = WORDY_RE.exec(t))) {
      let rep = WORDY_MAP.get(m[0].toLowerCase().replace(/\s+/g, ' '));
      if (rep == null) continue;
      // "the majority of the samples" → "most of the samples" (not "most the samples")
      if (rep === 'most' && /^\s+(?:the|our|these|those|its|their|his|her|my|your|this|that|them|us|you|it|which|whom)\b/i.test(t.slice(m.index + m[0].length, m.index + m[0].length + 8))) rep = 'most of';
      if (rep) { add('wordy', m.index, m.index + m[0].length, { message: `“${R.matchCase(m[0], rep)}” says the same in fewer words.`, replacements: [R.matchCase(m[0], rep)], safe: true }); continue; }
      const r = removal(m.index, m.index + m[0].length);
      add('wordy', r.start, r.end, { message: `Leave out “${m[0]}”. The sentence says the same without it.`, replacements: [r.rep], safe: false });
    }
    // hidden verbs
    if (NOM_HINT.test(t)) for (const n of nomRules) {
      testRe(n.re);
      while ((m = n.re.exec(t))) add('nominalization', m.index, m.index + m[0].length, { message: `Use the verb “${n.verb}” instead of “${n.phrase}”.`, replacements: [R.matchCase(m[0], dialectize(n.rep, dialect))], safe: false });
    }
    // very + word, absolute adjectives, intensifiers
    const veryRe = /\b(very|really|extremely|so)\s+([\p{L}]+)\b/giu;
    while ((m = veryRe.exec(t))) {
      const adj = m[2].toLowerCase();
      if (ABSOLUTE.includes(adj) && /^(very|really|extremely)$/i.test(m[1])) add('absolute', m.index, m.index + m[0].length, { message: `“${m[2]}” cannot be graded, so “${m[1]}” weakens it.`, replacements: [R.matchCase(m[0], m[2])], safe: true });
      else if (/^very$/i.test(m[1]) && VERY[adj]) add('stronger', m.index, m.index + m[0].length, { message: `Try one stronger word instead of “${m[0]}”.`, replacements: [R.matchCase(m[0], VERY[adj])], safe: false });
    }
    if (want.intensifier) {
      INTENS_RE.lastIndex = 0;
      while ((m = INTENS_RE.exec(t))) {
        if (!/^\s+\p{L}/u.test(t.slice(m.index + m[0].length, m.index + m[0].length + 3))) continue;
        const r = removal(m.index, m.index + m[0].length);
        add('intensifier', r.start, r.end, { message: `“${m[1]}” adds little here. Try the sentence without it.`, replacements: [r.rep], safe: false });
      }
    }
    // contractions and informal words (formal goals)
    if (want.contraction) {
      const cRe = /\b([\p{L}]+)['’]([\p{L}]{1,2})\b/gu;
      while ((m = cRe.exec(t))) {
        const key = m[0].toLowerCase().replace('’', "'");
        const rep = CONTR[key]; if (!rep) continue;
        add('contraction', m.index, m.index + m[0].length, { message: `Formal writing spells this out: “${R.matchCase(m[0], rep)}”.`, replacements: [R.matchCase(m[0], rep)], safe: true });
      }
    }
    if (want.informal) {
      INFORMAL_RE.lastIndex = 0;
      while ((m = INFORMAL_RE.exec(t))) {
        const w = m[0].toLowerCase().replace(/\s+/g, ' '), rep = INFORMAL_MAP.get(w);
        if (!rep) continue;
        if (w === 'cool' && !/\b(?:is|was|so|very|really|looks?|sounds?)\s+$/i.test(t.slice(Math.max(0, m.index - 12), m.index))) continue;
        if ((w === 'kind of' || w === 'sort of') && /\b(?:a|the|this|that|what|which|one|any|every|some|same|another|each|no)\s+$/i.test(t.slice(Math.max(0, m.index - 10), m.index))) continue;
        if (w === 'a bit' && /^\s+of\b/.test(t.slice(m.index + m[0].length))) continue;
        add('informal', m.index, m.index + m[0].length, { message: `“${m[0]}” sounds casual. Try “${rep}”.`, replacements: [R.matchCase(m[0], rep)], safe: false });
      }
    }
    // exclamation marks
    const exRe = /!{2,}|\?!+|!\?+/g;
    while ((m = exRe.exec(t))) add('exclamation', m.index, m.index + m[0].length, { message: 'One mark is enough.', replacements: [m[0][0] === '?' ? '?' : '!'], safe: true });

    // sentence-level rules
    const sents = R.sentences(t);
    const limit = (ctx.longSentence || 30) + want.longBoost;
    for (const s of sents) {
      const st = t.slice(s.start, s.end);
      const isHeading = /^\s{0,3}#/.test(src.slice(s.start - (s.start ? 0 : 0), s.start + 6)) || /^\s*#/.test(src.slice(Math.max(0, src.lastIndexOf('\n', s.start)), s.start + 4));
      const n = R.countWords(st);
      if (n > limit && !isHeading) add('longSentence', s.start, s.end, { message: `This sentence has ${n} words. Sentences over ${limit} words are hard to follow; try splitting it.`, wide: true });
      if (want.passive) {
        const pRe = /\b(am|is|are|was|were|be|been|being)\s+(?:(?:not|also|often|usually|then|now|later|first|still|always|never|already|widely|commonly|generally|typically|largely|mostly|fully|partly|\p{L}+ly)\s+){0,2}(\p{L}+ed|written|done|made|given|taken|seen|known|shown|found|held|built|sent|told|chosen|drawn|driven|eaten|forgotten|hidden|kept|led|left|lost|meant|paid|put|said|sold|spent|stolen|struck|taught|thought|understood|won|worn|broken|brought|bought|caught|begun|cut|set|spread|felt|heard|laid|sung|spoken|grown|thrown|shaken|shut|fed|fought|frozen|sought|withdrawn|undertaken|overcome|upheld|run|become|beaten|bitten|blown|chosen|forbidden|forgiven|ridden|risen|sworn|torn|woken|woven)\b/giu;
        let pm;
        while ((pm = pRe.exec(st))) {
          const part = pm[2].toLowerCase();
          if (/^(interested|excited|tired|worried|pleased|surprised|bored|married|scared|satisfied|disappointed|confused|embarrassed|frightened|ashamed|amazed|annoyed|exhausted|relaxed|delighted|determined|experienced|qualified|supposed|used|advanced|detailed|complicated|sophisticated|talented|skilled|crowded|beloved|aged|naked|wicked|sacred|concerned|prepared|related|limited|based|located|involved|needed|indeed|united|red|bed|wed|shed|fled|bled|sped|tied|died|lied|dyed)$/.test(part) || /eed$/.test(part) || part.length < 4 && !/^(led|cut|set|run|put|won)$/.test(part)) continue;
          if (/^(am|is|are|was|were)$/i.test(pm[1]) && /^(used)$/.test(part)) continue;
          const s0 = s.start + pm.index;
          add('passive', s0, s0 + pm[0].length, { message: 'Passive voice. If the doer matters, put it first: “The team wrote the report.”', replacements: [] });
          break; // one per sentence
        }
      }
      if (want.hedging) {
        const hs = st.match(HEDGES) || [];
        if (hs.length >= 3) add('hedging', s.start, s.end, { message: `This sentence has ${hs.length} hedges (${[...new Set(hs.map(x => x.toLowerCase()))].slice(0, 4).join(', ')}). Keep the one that matters.`, wide: true });
      }
      if (want.opinion) {
        const oRe = /\b(?:I|we)\s+(?:think|believe|feel|guess|suppose)(?:\s+that)?\s+|\bin\s+my\s+(?:humble\s+)?opinion,?\s+/gi;
        let om;
        while ((om = oRe.exec(st))) { const s0 = s.start + om.index; const r = removal(s0, s0 + om[0].trimEnd().length); add('opinion', r.start, r.end, { message: `“${om[0].trim()}” makes the claim sound like a feeling. State it and back it with evidence.`, replacements: [r.rep], safe: false }); }
      }
    }
    return out;
  };
  function dialectize(w, dialect) { if (dialect !== 'UK') return w; const l = w.toLowerCase(); return ukOf.has(l) && !/iz/.test(l) ? ukOf.get(l) : w.replace(/yz(e|es|ed|ing)$/, 'ys$1'); }
  R.dialectize = dialectize;

  function articleFor(word) {
    const w = word.replace(/^['’]/, '');
    if (!w) return null;
    if (/^\d/.test(w)) {
      if (/^(8|18|11)(\D|$)/.test(w) || /^8\d*$/.test(w) || /^(11|18)\d{0,1}$/.test(w)) return /^(8|11|18)/.test(w) ? 'an' : 'a';
      return null;
    }
    // abbreviations said letter by letter: an MRI, a UN report, an FAQ
    if (/^[A-Z]{2,5}s?$/.test(w)) {
      // URL is said "you-are-ell" (a URL, as Microsoft and Chicago style write it); SQL can be "sequel" or letters: no check
      if (/^(NASA|NATO|UNESCO|UNICEF|AIDS|LASER|RADAR|SCUBA|GIF|JPEG|PIN|RAM|ROM|OPEC|FIFA|UEFA|ASCII|SARS|COVID|LIDAR|SONAR|NAFTA|IKEA|OK|ISIS|ICU|URL|SQL|UNO|USB|UFO|EU|UK|US|USA|UN)s?$/.test(w)) return /^(OK|EU|UK|US|USA|UN|UFO|USB|URL|UNO)/.test(w) ? (/^OK/.test(w) ? 'an' : 'a') : null;
      return /^[AEFHILMNORSX]/.test(w) ? 'an' : 'a';
    }
    if (/^[A-Z]$/.test(w)) return /^[AEFHILMNORSX]$/.test(w) ? 'an' : 'a';
    // a capital letter before a hyphen is said as its name: an X-ray, an F-test, a T-shirt, a U-turn
    if (/^[A-Z]-/.test(w)) return /^[AEFHILMNORSX]-/.test(w) ? 'an' : 'a';
    const l = w.toLowerCase();
    if (/^(hour|honest|honor|honour|heir|herb(?!al)|homage)/.test(l)) return 'an';
    if (/^(uni(?!n|m|d[^ai]|nt|ns)|use|usu|usa|uti|ura|uri|ure(?!a)|uro|eu|ewe|one(?![rd])|once|ubiq|uku|unan|uvu|ufo|uv\b)/.test(l)) return 'a';
    if (/^(unin|unim|unid)/.test(l)) return 'an';
    if (/^[aeiou]/.test(l)) return 'an';
    if (/^[bcdfgjklmnpqrstvwxyz]/.test(l) || /^h/.test(l)) return 'a';
    return null;
  }
  R.articleFor = articleFor;

  /** Rules that look at the whole document (consistency, overuse, abbreviations, sentence starts). Offsets are absolute. */
  R.checkDoc = function checkDoc(p, blocks, ctx) {
    const out = []; const t = p.text, src = p.src;
    const want = ctx.want || R.goalsWant(ctx.goals);
    let m;
    // hyphenation: e-mail vs email
    const hy = new Map();
    const hyRe = /\b([A-Za-z]{1,12})-([A-Za-z]{2,14})\b/g;
    while ((m = hyRe.exec(t))) {
      const closed = (m[1] + m[2]).toLowerCase();
      if (/^(re-sign|re-cover|re-creation|re-form|re-press|re-sent|co-op|re-mark|re-collect|re-count|re-lease|re-serve|re-solve|re-store|un-ionized)$/i.test(m[0])) continue;
      if (!hy.has(closed)) hy.set(closed, { hyph: [], closed: [] });
      hy.get(closed).hyph.push({ s: m.index, e: m.index + m[0].length, w: m[0] });
    }
    if (hy.size) {
      const wRe = /\b[A-Za-z]{3,26}\b/g;
      while ((m = wRe.exec(t))) { const g = hy.get(m[0].toLowerCase()); if (g) g.closed.push({ s: m.index, e: m.index + m[0].length, w: m[0] }); }
      for (const [, g] of hy) {
        if (!g.hyph.length || !g.closed.length) continue;
        const keepClosed = g.closed.length > g.hyph.length || (g.closed.length === g.hyph.length && g.closed[0].s < g.hyph[0].s);
        const flag = keepClosed ? g.hyph : g.closed, other = keepClosed ? g.closed[0].w : g.hyph[0].w;
        for (const x of flag.slice(0, 30)) out.push(mk('hyphenation', 'clarity', x.s, x.e, src.slice(x.s, x.e), { title: RULES.hyphenation.title, message: `This document also writes “${other}”. Pick one spelling and use it everywhere.`, replacements: [R.matchCase(x.w, other.toLowerCase())], safe: false }));
      }
    }
    // undefined abbreviations: flag the first use when it is not spelled out there
    if (want.acronym) {
      const seen = new Map();
      const aRe = /(?<![\p{L}\p{N}-])([A-Z][A-Z0-9&]{1,6})(s?)(?![\p{L}\p{N}-])/gu;
      while ((m = aRe.exec(t))) {
        const a = m[1];
        if (!/[A-Z].*[A-Z]/.test(a) || KNOWN_ACR.has(a) || ROMAN.test(a) || /^[A-Z]\d+$/.test(a) || /&/.test(a) && a.length < 3) continue;
        if (!seen.has(a)) seen.set(a, { first: m.index, len: a.length + m[2].length, n: 0 });
        seen.get(a).n++;
      }
      for (const [a, x] of seen) {
        // in an all-caps heading or line, the capitals are not abbreviations
        const ls = t.lastIndexOf('\n', x.first) + 1, le = (i => (i < 0 ? t.length : i))(t.indexOf('\n', x.first));
        const line = t.slice(ls, le);
        if (line.replace(/[^A-Za-z]/g, '').length > 6 && line === line.toUpperCase()) continue;
        if (/^\s*#/.test(src.slice(ls, ls + 8)) && x.n === 1) continue;
        const before = t.slice(Math.max(0, x.first - 2), x.first), after = t.slice(x.first + x.len, x.first + x.len + 3);
        if (/\(\s*$/.test(before) || /^\s*\(/.test(after) || /^\s*[(\u2013\u2014-]\s*$/.test(before)) continue;
        if (/^\s*[=:]/.test(after) || /^\s*\(?\s*\p{L}/u.test(after) && /^\s*\(/.test(after)) continue;
        const defRe = new RegExp('\\(\\s*' + a + 's?\\s*[),;]');
        const defAt = t.search(defRe);
        if (defAt >= 0 && defAt < x.first) continue;
        out.push(mk('acronym', 'clarity', x.first, x.first + x.len, src.slice(x.first, x.first + x.len), { title: RULES.acronym.title, message: defAt > x.first ? `“${a}” is spelled out later. Spell it out here, at its first use.` : `Spell out “${a}” the first time you use it, with the short form in parentheses after it.`, replacements: [] }));
      }
    }
    // overused plain words
    const counts = new Map(); const occ = new Map();
    let total = 0;
    for (const b of blocks) for (const w of R.words(b.text)) {
      total++;
      const l = w.w.toLowerCase();
      if (!OVERUSED.includes(l)) continue;
      counts.set(l, (counts.get(l) || 0) + 1);
      if (!occ.has(l)) occ.set(l, []);
      occ.get(l).push({ s: b.start + w.start, e: b.start + w.end, w: w.w });
    }
    const thr = Math.max(4, Math.ceil(total / 350));
    for (const [l, c] of counts) {
      if (c < thr) continue;
      for (const x of occ.get(l).slice(2, 30)) out.push(mk('overused', 'engagement', x.s, x.e, src.slice(x.s, x.e), { title: RULES.overused.title, message: `“${l}” appears ${c} times in this document. Try a synonym or a more specific word.`, replacements: [], synonyms: l }));
    }
    // repeated sentence starts (three or more in a row, paragraphs only)
    for (const b of blocks) {
      if (/^\s{0,3}(?:[-*+]\s|\d{1,9}[.)]\s|#|\|)/.test(b.raw)) continue;
      const sents = R.sentences(b.text);
      let run = [];
      const flush = () => { if (run.length >= 3) for (const x of run.slice(2)) out.push(mk('starts', 'engagement', x.s, x.e, src.slice(x.s, x.e), { title: RULES.starts.title, message: `${run.length} sentences in a row start with “${run[0].w}”. Vary the start of this one.`, replacements: [] })); run = []; };
      for (const s of sents) {
        const fw = /^\s*["'“‘(]?([\p{L}]+)/u.exec(b.text.slice(s.start, s.end));
        if (!fw) { flush(); continue; }
        const w = fw[1];
        if (run.length && run[0].w.toLowerCase() !== w.toLowerCase()) flush();
        const at = b.start + s.start + fw.index + fw[0].length - w.length;
        run.push({ w, s: at, e: at + w.length });
      }
      flush();
    }
    return out;
  };

  /** A language pack's own rules: [{id, pattern, flags, message, replacement, category, title, explain, wrong, right}] */
  R.checkCustom = function checkCustom(block, rules) {
    const out = [];
    for (const r of rules || []) {
      let re; try { re = new RegExp(r.pattern, (r.flags || 'g').includes('g') ? r.flags || 'g' : (r.flags || '') + 'g'); } catch { continue; }
      let m;
      while ((m = re.exec(block.text))) {
        if (!m[0].length) { re.lastIndex++; continue; }
        // language packs (markooj-language-packs) write `replace` and `why`; the writing contract says `replacement` and `explain`
        const repl = r.replacement != null ? r.replacement : r.replace;
        const reps = [];
        for (const one of repl == null ? [] : [].concat(repl)) {
          // replace only this match, at its place in the whole block, so lookbehind and lookahead see the letters around it
          let rep = null;
          try {
            const sre = new RegExp(r.pattern, (r.flags || '').replace(/[gy]/g, '') + 'y'); sre.lastIndex = m.index;
            const whole = block.text.replace(sre, String(one));
            rep = whole.slice(m.index, whole.length - (block.text.length - m.index - m[0].length));
          } catch { rep = null; }
          if (rep != null && rep !== m[0] && !reps.includes(rep)) reps.push(rep); // a fix that changes nothing is no fix
        }
        const cat = CATS.includes(r.category) ? r.category : (CAT_ALIAS[r.category] || 'correctness');
        out.push(mk('lang:' + (r.id || 'rule'), cat, m.index, m.index + m[0].length, block.raw.slice(m.index, m.index + m[0].length), { title: r.title || r.message || 'Language rule', message: r.message || '', replacements: reps, safe: reps.length === 1 && (r.safe != null ? !!r.safe : true), wrong: r.wrong, right: r.right, explain: r.explain || r.why }));
      }
    }
    return out;
  };

  /** Drop overlapping findings, keeping the most specific one. Sentence-wide findings never compete with word-level ones. */
  const PRI = { dialect: 0, preposition: 1, usage: 1, agreement: 1.5, article: 1, its: 1, repeated: 1, spelling: 2, absolute: 3, wordy: 4, nominalization: 4, contraction: 4, stronger: 5, informal: 5, intensifier: 6, passive: 7, overused: 8, starts: 9, acronym: 3, hyphenation: 3, exclamation: 4, opinion: 6 };
  R.priority = f => (f.source === 'harper' ? (f.cat === 'correctness' ? 2.5 : 6.5) : String(f.rule).startsWith('lang:') ? 1 : PRI[f.rule] ?? 5);
  R.dedupe = function dedupe(list) {
    const wide = list.filter(f => f.wide), word = list.filter(f => !f.wide);
    word.sort((a, b) => a.start - b.start || R.priority(a) - R.priority(b));
    const kept = [];
    for (const f of word) {
      let clash = -1;
      // kept is in start order: only the last few can reach this one
      for (let j = kept.length - 1; j >= 0 && kept[j].start > f.start - 400; j--) {
        const k = kept[j];
        if (f.start < k.end && k.start < f.end && !(f.end - f.start > 40 && k.end - k.start < 15) && !(k.end - k.start > 40 && f.end - f.start < 15)) { clash = j; break; }
      }
      if (clash < 0) { kept.push(f); continue; }
      if (R.priority(f) < R.priority(kept[clash])) kept[clash] = f;
    }
    const seen = new Set();
    const wides = wide.filter(f => { const k = f.rule + ':' + f.start; if (seen.has(k)) return false; seen.add(k); return true; });
    return kept.concat(wides).sort((a, b) => a.start - b.start || a.end - b.end);
  };

  /** Score 0–100 from issues per 100 words, weighted by category. */
  R.score = function score(findings, words) {
    if (!words) return 100;
    const W = { correctness: 3, clarity: 1.4, engagement: 0.8, delivery: 1 };
    let p = 0; for (const f of findings) p += W[f.cat] || 1;
    // short texts count as 150 words, so one slip in a short note does not sink the score
    const per100 = (p / Math.max(words, 150)) * 100;
    return Math.max(0, Math.min(100, Math.round(100 * Math.exp(-per100 / 30))));
  };

  /** One full check without Harper or spelling (used by the worker and as the in-page fallback). */
  R.checkAll = function checkAll(text, ctx = {}) {
    const p = R.prose(text);
    const blocks = R.blocks(p);
    const want = R.goalsWant(ctx.goals);
    const c = { ...ctx, want };
    const out = [];
    const english = ctx.english !== false;
    for (const b of blocks) {
      const list = (english ? R.checkBlock(b, c) : []).concat(ctx.customRules && ctx.customRules.length ? R.checkCustom(b, ctx.customRules) : []);
      for (const f of list) { f.start += b.start; f.end += b.start; out.push(f); }
    }
    if (english) out.push(...R.checkDoc(p, blocks, c));
    return { findings: R.dropMasked(out, p.flags), blocks, prose: p };
  };
  /** Findings that touch code, math, links or other non-prose text are dropped (sentence-wide ones stay). */
  R.dropMasked = function dropMasked(list, flags) {
    return list.filter(f => { if (f.wide) return true; for (let i = f.start; i < f.end; i++) if (flags[i] === 1) return false; return true; });
  };

  // =================================================================== near-miss spelling (language packs, format 2)
  // For small word lists (Urdu, Arabic, Punjabi starters): a word is flagged only when it has 3+ letters, is not in the
  // list (harakat, tatweel and ZWNJ ignored), no prefix/suffix clitic split gives a known word, and a known word with
  // freq >= 2 is exactly one edit away (insert, delete, substitute, swap). The neighbors come from a symmetric-delete
  // index built once per language: every common word and each of its one-letter deletions point back to the word.
  // harakat (064B–065F, 0670), tatweel, ZWNJ, and honorific / Quranic marks (0610–061A, 06D6–06ED) that sit on a word
  const NM_STRIP = /[ً-ٰٟـ‌ؐ-ؚۖ-ۜ۟-۪ۤۧۨ-ۭ]/g;
  const NM_MARKS = /[ً-ٰٟـؐ-ؚۖ-ۜ۟-۪ۤۧۨ-ۭ]/g; // the same without ZWNJ, for the spelling a suggestion shows
  const NM_ARABIC_LETTERS = /^[؀-ۿݐ-ݿࡰ-ࣿﭐ-﷿ﹰ-﻿]+$/;
  // Punjabi (Shahmukhi) writers use ݨ/ن and ݪ/ل for the same word: both count as the same letter
  R.nmNormalize = w => String(w || '').normalize('NFC').replace(NM_STRIP, '').replace(/ݨ/g, 'ن').replace(/ݪ/g, 'ل');
  /** o = {words: [[word, freq], …], prefix: [], suffix: []} → index */
  R.nmBuild = function nmBuild(o = {}) {
    const known = new Map();
    // the spelling a suggestion shows: the list's own (پاݨی stays پاݨی, ZWNJ stays), only marks and tatweel removed
    const show = new Map();
    for (const e of o.words || []) {
      const raw = Array.isArray(e) ? e[0] : e;
      const n = R.nmNormalize(raw); if (!n) continue;
      const f = Math.max(0, Math.min(5, Math.round(+(Array.isArray(e) ? e[1] : 0) || 0)));
      if (!known.has(n) || known.get(n) < f) { known.set(n, f); show.set(n, String(raw).normalize('NFC').replace(NM_MARKS, '')); }
    }
    const del = new Map();
    const add = (k, w) => { const a = del.get(k); if (!a) del.set(k, [w]); else if (a[a.length - 1] !== w) a.push(w); };
    let maxLen = 0;
    for (const [w, f] of known) if (f >= 2) { if (w.length > maxLen) maxLen = w.length; add(w, w); for (let i = 0; i < w.length; i++) add(w.slice(0, i) + w.slice(i + 1), w); }
    const clean = list => [...new Set((list || []).map(R.nmNormalize).filter(Boolean))].sort((a, b) => b.length - a.length);
    // maxLen: no neighbor can be found for a word longer than the longest indexed word + 1 (see nmNeighbors)
    return { known, show, del, maxLen, prefix: clean(o.prefix), suffix: clean(o.suffix), cache: new Map(), size: known.size };
  };
  /** true when a and b are exactly one edit apart (insert, delete, substitute, or swap two neighbors). */
  function oneEdit(a, b) {
    if (a === b) return false;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    if (la === lb) {
      let i = 0; while (i < la && a[i] === b[i]) i++;
      if (a.slice(i + 1) === b.slice(i + 1)) return true;
      return i + 1 < la && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
    }
    const s = la < lb ? a : b, l = la < lb ? b : a;
    let i = 0; while (i < s.length && s[i] === l[i]) i++;
    return s.slice(i) === l.slice(i + 1);
  }
  R.nmOneEdit = oneEdit;
  /** The word list's own spelling of a normalized word. */
  R.nmShow = (idx, n) => (idx && idx.show && idx.show.get(n)) || n;
  /** Known words with freq >= 2 one edit from n (normalized), most frequent first; normalized too (R.nmShow gives
   *  the list's own spelling). */
  R.nmNeighbors = function nmNeighbors(idx, n, max = 5) {
    // a run of letters with no spaces (text pasted from a PDF) would otherwise cost O(length²) here
    if (idx.maxLen != null && n.length > idx.maxLen + 1) return [];
    const keys = new Set([n]); for (let i = 0; i < n.length; i++) keys.add(n.slice(0, i) + n.slice(i + 1));
    const found = new Set();
    for (const k of keys) for (const w of idx.del.get(k) || []) if (!found.has(w) && oneEdit(n, w)) found.add(w);
    return [...found].sort((a, b) => (idx.known.get(b) - idx.known.get(a)) || (Math.abs(a.length - n.length) - Math.abs(b.length - n.length)) || (a < b ? -1 : a > b ? 1 : 0)).slice(0, max);
  };
  /** Known as it stands, or as one prefix and/or one suffix around a known word (وكتاب، بالكتاب، کتابیں …). */
  R.nmKnown = function nmKnown(idx, n) {
    if (idx.known.has(n)) return true;
    for (const p of [''].concat(idx.prefix)) {
      if (p && !n.startsWith(p)) continue;
      for (const s of [''].concat(idx.suffix)) {
        if (!p && !s) continue;
        if (s && !n.endsWith(s)) continue;
        if (n.length - p.length - s.length < 2) continue;
        if (idx.known.has(n.slice(p.length, n.length - s.length))) return true;
      }
    }
    return false;
  };
  /** null when the word is fine (or not this check's business), else {suggestions}. Near-miss: up to 5, most frequent
   *  first. A full-spelling index (R.fsBuild) flags every unknown word, with up to 6 suggestions (R.fsSuggest). */
  R.nmCheck = function nmCheck(idx, word) {
    if (!idx) return null;
    const n = R.nmNormalize(word);
    if (idx.cache.has(n)) return idx.cache.get(n);
    let res = null;
    if (idx.full) { if (fsUnknown(idx, n)) res = { suggestions: R.fsSuggest(idx, n, 6).map(w => R.nmShow(idx, w)) }; }
    else if (NM_ARABIC_LETTERS.test(n) && (n.match(/\p{L}/gu) || []).length >= 3 && !R.nmKnown(idx, n)) {
      const near = R.nmNeighbors(idx, n, 5);
      if (near.length) res = { suggestions: near.map(w => R.nmShow(idx, w)) };
    }
    if (idx.cache.size > 20000) idx.cache.clear();
    idx.cache.set(n, res);
    return res;
  };
  /** true when the word would be flagged, without working out suggestions (the right-click check). */
  R.nmFlag = function nmFlag(idx, word) {
    if (!idx) return false;
    if (idx.full) { const n = R.nmNormalize(word); const c = idx.cache.get(n); return c !== undefined ? !!c : fsUnknown(idx, n); }
    return !!R.nmCheck(idx, word);
  };
  /** Near-miss (or full) spelling findings for one block ({text}); offsets are relative to the block. */
  R.nmFindings = function nmFindings(idx, block, langName) {
    const out = [];
    if (!idx) return out;
    const list = langName || 'language pack’s';
    for (const t of R.spellTokens(block.text)) {
      const r = R.nmCheck(idx, t.w); if (!r) continue;
      const first = r.suggestions[0];
      const message = !idx.full ? `“${t.w}” is not in the ${list} word list and looks like “${first}”.`
        : first ? `“${t.w}” is not in the ${list} word list. Did you mean “${first}”?` : `“${t.w}” is not in the ${list} word list.`;
      out.push({ rule: 'spelling', source: 'spelling', cat: 'correctness', start: t.start, end: t.end, text: t.w, title: 'Spelling', nearMiss: true, ...(idx.full ? { fullSpelling: true } : {}),
        message, replacements: [], _sugg: r.suggestions.slice(), suggest: true, safe: false });
    }
    return out;
  };

  // =================================================================== full spelling (language packs with a large word list)
  // Every Arabic-script word of 2+ letters that is not in the list (after the same normalization and clitic split as
  // near-miss) is flagged. Suggestions come from the list: words one edit away (insert, delete, substitute, swap), found
  // through a symmetric-delete index kept in two typed arrays (hashed deletion keys → word ids; built on the first
  // suggestion), and words two edits away when both edits trade letters of one sound-alike or look-alike group
  // (similar.json: ذ ز ض ظ, ت ط, س ص ث …). Ranked by count (or freq), with a head start for similar-letter trades.
  // Measured: the Urdu list (95,000 words) and its suggestion index (614,000 keys, about 8 MB in all) build in 0.2–0.6 s;
  // 1,500 words then check in about 30 ms.
  const FREQ_RANK = [0, 1, 3, 10, 100, 1000];
  const FS_TIER_BONUS = [3, 2, 0, -1.5]; // similar trade, two similar trades, one edit, similar trade + one edit
  /** One number to rank a word by: its count in the source corpus, or a stand-in from freq (1–5) when larger. */
  R.fsRank = (freq, count) => Math.max(Number.isFinite(+count) && +count > 0 ? Math.min(+count, 4e9) : 0, FREQ_RANK[Math.max(0, Math.min(5, Math.round(+freq || 0)))]);
  const FS_SHOWN = /[‌ݨݪ]/; // a word whose list spelling differs from its normalized key (ZWNJ, ݨ, ݪ)
  /** o = {list: [word, …] or 'word\nword…', rank: [number, …] (R.fsRank), prefix: [], suffix: [], similar: {groups: [{kind, letters}]}} */
  R.fsBuild = function fsBuild(o = {}) {
    const list = typeof o.list === 'string' ? (o.list ? o.list.split('\n') : []) : Array.isArray(o.list) ? o.list : [];
    const known = new Map(), words = [], ranks = [], show = new Map();
    let maxLen = 0;
    for (let i = 0; i < list.length; i++) {
      const raw = list[i]; if (!raw) continue;
      const n = R.nmNormalize(raw); if (!n) continue;
      const r = +(o.rank && o.rank[i]) || 0;
      let id = known.get(n);
      if (id === undefined) { id = words.length; known.set(n, id); words.push(n); ranks.push(r); if (n.length > maxLen) maxLen = n.length; }
      else if (r > ranks[id]) ranks[id] = r; else continue;
      if (FS_SHOWN.test(raw)) show.set(n, String(raw).normalize('NFC').replace(NM_MARKS, '')); else show.delete(n);
    }
    const sim = new Map(); // letter → the other letters of its groups
    for (const g of (o.similar && Array.isArray(o.similar.groups) ? o.similar.groups : [])) {
      const ls = [...new Set((Array.isArray(g && g.letters) ? g.letters : []).map(R.nmNormalize).filter(l => l.length === 1))];
      for (const a of ls) for (const b of ls) if (a !== b) { let arr = sim.get(a); if (!arr) sim.set(a, arr = []); if (!arr.includes(b)) arr.push(b); }
    }
    const clean = l => [...new Set((l || []).map(R.nmNormalize).filter(Boolean))].sort((a, b) => b.length - a.length);
    return { full: true, known, words, maxLen, rank: Float64Array.from(ranks), show, sim, del: null, prefix: clean(o.prefix), suffix: clean(o.suffix), cache: new Map(), size: words.length };
  };
  function fsUnknown(idx, n) {
    if (!n || !NM_ARABIC_LETTERS.test(n) || /\p{N}/u.test(n)) return false;
    if ((n.match(/\p{L}/gu) || []).length < 2) return false;
    return !R.nmKnown(idx, n);
  }
  R.fsUnknown = fsUnknown;
  /** FNV-1a of w without the letter at `skip` (-1: the whole word). */
  function fsHash(w, skip) {
    let h = 0x811c9dc5;
    for (let i = 0; i < w.length; i++) if (i !== skip) { h ^= w.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  /** The symmetric-delete index: every word and each of its one-letter deletions, hashed into buckets of word ids. */
  R.fsIndex = function fsIndex(idx) {
    if (idx.del) return idx.del;
    const W = idx.words;
    let total = 0; for (const w of W) total += w.length + 1;
    let size = 1024; while (size < total) size *= 2;
    const mask = size - 1;
    const start = new Uint32Array(size + 1);
    const each = fn => {
      for (let id = 0; id < W.length; id++) {
        const w = W[id]; fn(fsHash(w, -1) & mask, id);
        // deleting either of two equal neighbors gives the same key: once is enough
        if (w.length > 1) for (let i = 0; i < w.length; i++) if (i === 0 || w[i] !== w[i - 1]) fn(fsHash(w, i) & mask, id);
      }
    };
    each(b => { start[b + 1]++; });
    for (let b = 0; b < size; b++) start[b + 1] += start[b];
    const ids = new Int32Array(start[size]); const fill = start.slice(0, size);
    each((b, id) => { ids[fill[b]++] = id; });
    idx.del = { mask, start, ids, keys: ids.length };
    return idx.del;
  };
  /** Ids of known words exactly one edit from n (normalized). */
  function fsEdit1(idx, n, out) {
    const del = R.fsIndex(idx), W = idx.words, seen = new Set();
    const probe = h => {
      const b = h & del.mask;
      for (let k = del.start[b], e = del.start[b + 1]; k < e; k++) { const id = del.ids[k]; if (!seen.has(id)) { seen.add(id); if (oneEdit(n, W[id])) out.push(id); } }
    };
    probe(fsHash(n, -1));
    for (let i = 0; i < n.length; i++) if (i === 0 || n[i] !== n[i - 1]) probe(fsHash(n, i));
    return out;
  }
  /** Suggestions for an unknown word n (normalized), as normalized words (R.nmShow gives the list's spelling): one trade
   *  of similar letters, two such trades, any one edit, and (to fill up) a similar trade plus one edit; ranked by count
   *  with a head start for the similar-letter trades. */
  R.fsSuggest = function fsSuggest(idx, n, max = 6) {
    if (!idx || !idx.full || !n) return [];
    // every suggestion is at most one letter shorter than n (trades keep the length, one edit changes it by one), so a
    // longer run of letters (text pasted without spaces) has none: return at once instead of spending O(length³)
    if (idx.maxLen != null && n.length > idx.maxLen + 1) return [];
    const tier = new Map();
    const put = (id, t) => { if (id === undefined) return; const p = tier.get(id); if (p === undefined || t < p) tier.set(id, t); };
    const subs = [];
    for (let i = 0; i < n.length; i++) { const alts = idx.sim.get(n[i]); if (alts) for (const a of alts) subs.push([i, n.slice(0, i) + a + n.slice(i + 1)]); }
    for (const [, v] of subs) put(idx.known.get(v), 0);
    if (subs.length <= 400) {
      for (const [i, v] of subs) for (let j = i + 1; j < n.length; j++) { const alts = idx.sim.get(n[j]); if (alts) for (const a of alts) put(idx.known.get(v.slice(0, j) + a + v.slice(j + 1)), 1); }
    }
    for (const id of fsEdit1(idx, n, [])) put(id, 2);
    if (tier.size < max) for (const [, v] of subs.slice(0, 60)) if (!idx.known.has(v)) for (const id of fsEdit1(idx, v, [])) put(id, 3);
    // a similar-letter trade counts as much as a word about 20 times as common (e^3): a sound-alike of a rare word does
    // not push a very common one-edit word off the top (a corpus list holds many rare words, some of them misspellings)
    const W = idx.words, rank = idx.rank, score = new Map();
    for (const [id, t] of tier) score.set(id, Math.log1p(rank[id]) + FS_TIER_BONUS[t]);
    return [...tier.keys()].sort((a, b) => (score.get(b) - score.get(a)) || (tier.get(a) - tier.get(b)) || (Math.abs(W[a].length - n.length) - Math.abs(W[b].length - n.length)) || (W[a] < W[b] ? -1 : W[a] > W[b] ? 1 : 0))
      .slice(0, max).map(id => W[id]);
  };

  G.MkWritingRules = R;
})(typeof globalThis !== 'undefined' ? globalThis : self);
