// Markooj — builds the compact offline thesaurus used by Review → Thesaurus (Shift+F7) and the Synonyms menu.
//
//   node scripts/make-thesaurus.js            → data/thesaurus-en.json
//
// Source: the WordNet database in node_modules/wordnet-db (Princeton WordNet, WordNet license, see
// licenses/ and THIRD_PARTY_NOTICES.md). Only what the thesaurus needs is kept: common lemmas (seen in the
// tagged SemCor corpus, or members of a kept meaning), their first few meanings per part of speech, the
// words of each meaning, words of "similar" adjective meanings, antonyms and a short gloss.
//
// Output shape (version 1):
//   { v: 1, source, license, pos: ['noun','verb','adjective','adverb'],
//     s: [[posIndex, gloss, 'word|word|word', 'antonym|antonym'], ...],   // meanings
//     w: { lemma: [meaningIndex, ...] },                                 // in WordNet sense order
//     rank: ['word', ...] }                                              // common words first (for word completion)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let DICT;
try { DICT = path.join(path.dirname(require.resolve('wordnet-db/package.json')), 'dict'); }
catch { DICT = path.join(ROOT, 'node_modules', 'wordnet-db', 'dict'); }
const OUT = path.join(ROOT, 'data', 'thesaurus-en.json');

const POS = [['noun', 'n'], ['verb', 'v'], ['adj', 'a'], ['adv', 'r']];
const POS_INDEX = { n: 0, v: 1, a: 2, s: 2, r: 3 };
const MAX_SENSES = 5;      // meanings per lemma and part of speech
const MAX_WORDS = 12;      // words per meaning (own words first, then similar ones)
const MAX_GLOSS = 56;

const usable = w => /^[a-z][a-z'-]*( [a-z][a-z'-]*)?$/.test(w) && w.length <= 24; // one word or a two-word phrase, lowercase
const clean = w => w.replace(/\(.*\)$/, '').replace(/_/g, ' ');

// ---- read every synset: offset → {pos, words, ptrs, gloss}
const synsets = new Map(); // key `${pos}:${offset}`
for (const [file, p] of POS) {
  const text = fs.readFileSync(path.join(DICT, 'data.' + file), 'utf8');
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('  ')) continue;
    const bar = line.indexOf(' | ');
    const head = (bar >= 0 ? line.slice(0, bar) : line).trim().split(' ');
    const gloss = bar >= 0 ? line.slice(bar + 3).trim() : '';
    const offset = head[0], ssType = head[2];
    const wCnt = parseInt(head[3], 16);
    const words = [];
    let i = 4;
    for (let k = 0; k < wCnt; k++, i += 2) words.push(clean(head[i]));
    const pCnt = parseInt(head[i], 10); i++;
    const ptrs = [];
    for (let k = 0; k < pCnt; k++, i += 4) ptrs.push({ sym: head[i], off: head[i + 1], pos: head[i + 2], st: head[i + 3] });
    synsets.set(p + ':' + offset, { pos: POS_INDEX[ssType] ?? POS_INDEX[p], type: ssType, words, ptrs, gloss });
  }
}
const lookup = (pos, off) => synsets.get((pos === 's' ? 'a' : pos) + ':' + off);

// ---- lemmas from the index files, in sense order
const lemmas = new Map(); // lemma → [synsetKey...]
const tagCount = new Map(); // lemma → how often it was seen in the tagged corpus (a rough word frequency)
for (const [file, p] of POS) {
  const text = fs.readFileSync(path.join(DICT, 'index.' + file), 'utf8');
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('  ')) continue;
    const f = line.trim().split(' ');
    const lemma = clean(f[0]);
    if (!usable(lemma)) continue;
    const synCnt = +f[2], pCnt = +f[3];
    const tagged = +f[5 + pCnt];
    const offs = f.slice(6 + pCnt, 6 + pCnt + synCnt);
    if (!tagged) continue; // rare words (never seen in the tagged corpus) are left out to keep the file small
    const keep = Math.min(MAX_SENSES, offs.length, Math.max(2, tagged + 1));
    if (!lemma.includes(' ')) tagCount.set(lemma, (tagCount.get(lemma) || 0) + tagged);
    const list = lemmas.get(lemma) || [];
    for (const off of offs.slice(0, keep)) list.push(p + ':' + off);
    lemmas.set(lemma, list);
  }
}

// real corpus counts: index.sense gives how often each sense was seen in the tagged texts
const freq = new Map();
for (const line of fs.readFileSync(path.join(DICT, 'index.sense'), 'utf8').split('\n')) {
  const f = line.split(' '); if (f.length < 4) continue;
  const lemma = clean(f[0].split('%')[0]);
  if (tagCount.has(lemma)) freq.set(lemma, (freq.get(lemma) || 0) + (+f[3] || 0));
}

// ---- build meanings
const sIndex = new Map(); const S = [];
function shortGloss(g) {
  let s = g.split(';')[0].replace(/^\(?[a-z]+\)\s*/i, '').replace(/"[^"]*"/g, '').trim();
  if (s.length > MAX_GLOSS) s = s.slice(0, MAX_GLOSS - 1).replace(/\s+\S*$/, '') + '…';
  return s;
}
function meaning(key) {
  if (sIndex.has(key)) return sIndex.get(key);
  const ss = synsets.get(key); if (!ss) return -1;
  const words = [];
  const add = w => { if (usable(w) && !words.includes(w) && words.length < MAX_WORDS) words.push(w); };
  ss.words.forEach(add);
  if (ss.pos === 2) for (const p of ss.ptrs) if (p.sym === '&') { const o = lookup(p.pos, p.off); if (o) o.words.slice(0, 3).forEach(add); }
  // a meaning with no other word borrows its broader term (hypernym) so the list is never empty
  if (words.length < 2) for (const p of ss.ptrs) if (p.sym === '@') { const o = lookup(p.pos, p.off); if (o) o.words.slice(0, 2).forEach(add); }
  const anto = [];
  for (const p of ss.ptrs) if (p.sym === '!') {
    const o = lookup(p.pos, p.off); if (!o) continue;
    const t = parseInt(p.st.slice(2, 4), 16);
    const w = t ? o.words[t - 1] : o.words[0];
    if (w && usable(w) && !anto.includes(w)) anto.push(w);
  }
  if (words.length < 2 && !anto.length) { sIndex.set(key, -1); return -1; }
  const id = S.length;
  S.push([ss.pos, shortGloss(ss.gloss), words.join('|'), anto.slice(0, 4).join('|')]);
  sIndex.set(key, id);
  return id;
}
const W = {};
for (const [lemma, keys] of [...lemmas.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
  const ids = [];
  for (const k of keys) { const id = meaning(k); if (id >= 0 && !ids.includes(id)) ids.push(id); }
  if (ids.length) W[lemma] = ids;
}
// trim meaning lists so phrases do not crowd out words: keep S compact by dropping trailing empty fields
for (const s of S) { if (!s[3]) s.length = 3; }

const out = {
  v: 1,
  source: 'WordNet 3.1 (Princeton University), via the wordnet-db package',
  license: 'WordNet License: Permission to use, copy, modify and distribute this software and database and its documentation for any purpose and without fee or royalty is hereby granted, provided that the copyright notice and statements are kept. WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved. See licenses/wordnet-LICENSE.txt.',
  pos: ['noun', 'verb', 'adjective', 'adverb'],
  s: S,
  w: W,
  // single words by how often WordNet's tagged corpus uses them, most common first (word completion ranks with it)
  rank: [...tagCount.keys()].map(w => [w, freq.get(w) || 0]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(x => x[0]),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
const size = fs.statSync(OUT).size;
console.log(`Thesaurus: ${Object.keys(W).length} words, ${S.length} meanings, ${(size / 1048576).toFixed(2)} MB → ${path.relative(ROOT, OUT)}`);
