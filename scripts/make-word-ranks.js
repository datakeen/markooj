// Markooj — builds the word-frequency tiers that rank English spelling suggestions (calander → calendar before colander).
//
//   node scripts/make-word-ranks.js            → data/words-rank-en.txt
//
// Source: the WordNet database in node_modules/wordnet-db (Princeton WordNet, WordNet license, see licenses/ and
// THIRD_PARTY_NOTICES.md). For every one-word lemma: how often its senses were seen in the tagged SemCor corpus
// (index.* "tagsense_cnt") and how many senses it has (common words have many meanings). Both go into one score,
// written as a tier from 1 (rare) to 9 (very common). The most common English function words, which WordNet does not
// list, are added at tier 9 from the list below (written for Markooj).
//
// Output: plain text, one tier per line: "<tier> word word word …" (lower case, sorted), after # comment lines.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let DICT;
try { DICT = path.join(path.dirname(require.resolve('wordnet-db/package.json')), 'dict'); }
catch { DICT = path.join(ROOT, 'node_modules', 'wordnet-db', 'dict'); }
const OUT = path.join(ROOT, 'data', 'words-rank-en.txt');

const FUNCTION_WORDS = ('the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there ' +
  'their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other ' +
  'than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are ' +
  'was were been being has had does did done am shall should may might must cannot each every both few more many much such own same very too here where why ' +
  'while during before through between under again further once off above below against among within without upon onto toward towards whether although ' +
  'though unless until since however therefore thus yet nor either neither another anything everything nothing something someone everyone anyone nobody ' +
  'himself herself itself themselves ourselves myself yourself whose whom whatever whenever wherever around across along behind beside besides beyond near ' +
  'inside outside throughout via per etc already always never often sometimes usually still almost quite rather really just perhaps maybe instead else ' +
  'three four five six seven eight nine ten hundred thousand million first second third last next').split(/\s+/).filter(Boolean);

const usable = w => /^[a-z][a-z'-]*$/.test(w) && w.length <= 30;
const tagged = new Map(), senses = new Map();
for (const file of ['noun', 'verb', 'adj', 'adv']) {
  const text = fs.readFileSync(path.join(DICT, 'index.' + file), 'utf8');
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('  ')) continue;
    const f = line.trim().split(' ');
    const lemma = f[0].replace(/\(.*\)$/, '');
    if (!usable(lemma)) continue;
    const synCnt = +f[2], pCnt = +f[3];
    const tag = +f[5 + pCnt] || 0;
    tagged.set(lemma, (tagged.get(lemma) || 0) + tag);
    senses.set(lemma, (senses.get(lemma) || 0) + synCnt);
  }
}
const tiers = new Map();
for (const [w, s] of senses) {
  const t = tagged.get(w) || 0;
  // tagged corpus counts dominate; the number of meanings separates the many words never seen in SemCor
  const score = Math.log10(1 + t) * 2.2 + Math.log2(1 + s) * 0.9;
  if (score < 0.95) continue; // one sense, never seen in the corpus: no information
  tiers.set(w, Math.max(1, Math.min(8, Math.round(score))));
}
for (const w of FUNCTION_WORDS) tiers.set(w, 9);
const by = new Map();
for (const [w, t] of tiers) { if (!by.has(t)) by.set(t, []); by.get(t).push(w); }
let out = '# Markooj word-frequency tiers for ranking English spelling suggestions (scripts/make-word-ranks.js).\n' +
  '# Derived from Princeton WordNet 3.0 (SemCor sense counts and the number of senses); WordNet 3.0 license, see licenses/wordnet-LICENSE.txt.\n' +
  '# Tier 9: common function words (list written for Markooj). Format: <tier> word word …\n';
for (const t of [...by.keys()].sort((a, b) => b - a)) out += t + ' ' + by.get(t).sort().join(' ') + '\n';
fs.writeFileSync(OUT, out);
console.log(`${tiers.size} words → ${path.relative(ROOT, OUT)} (${(out.length / 1024).toFixed(0)} KB)`, [...by].map(([t, l]) => t + ':' + l.length).join(' '));
