// Markooj — language packs (main process). Owner: languages.
// A language pack is a zip built in the datakeen/markooj-language-packs repository and published as an asset of its
// GitHub release with the tag `packs`, together with index.json (sha256 of every zip). Installed packs live in
// <userData>/langpacks/<code>/.
//
// Pack zip format 1 (Markooj 1.0): manifest.json {format:1, code, name, nativeName, dir, version, license, sources, font,
//   spelling: {aff, dic} | null, rules: 'rules.json', files: {name: sha256}} + hunspell .aff/.dic + rules.json + licenses.
// Pack zip format 2 (Markooj 1.1): the same, plus
//   spelling: {mode: 'near-miss' | 'full', aff?, dic?}   near-miss: flag only unknown words one edit from a common word;
//                                                         full: flag every unknown word (from lexicon.json when the pack
//                                                         has one, else from the Hunspell .aff/.dic)
//   clitics:  {prefix: [..], suffix: [..]}                letters that attach to a word (و، ال، بال …)
//   lexicon:  'lexicon.json'  {fields: ['word','aarab','roman','freq','pos','count', …], rows: [[…], …]}
//                             (count: how often the word occurs in the source corpus; unknown extra fields are kept)
//   similar:  'similar.json'  {groups: [{kind: 'sound' | 'shape', letters: [..]}]}  letters that sound or look alike
//                             (full spelling ranks suggestions that trade them first)
//   phrases:  'phrases.json'  {fields: ['phrase','count', …], rows}  multi-word phrases (checked at install; not
//                             loaded yet: later for completion and Roman typing)
//   sources:  [{what, license, url}]   credits shown in Options → Language; counts.sourceWords: words from outside lists
//   roman:    'roman.json'    {format, language, maxKey, map: {roman: [letters]}} (as the packs repo builds it), or
//                             {fields: ['roman','letters','note'], rows}; handed out as {fields, rows} either way
//   counts:   {words, checked, rules}  (or stats: {words, checked})  how many words, and how many a native speaker checked
// Every file a manifest names must be listed in manifest.files (so its SHA-256 was checked), and the JSON files must
// have the right shape, or nothing is installed. Format-1 zips keep installing.
//
// IPC (all through the generic mk.invoke):
//   langpack-index            → {updated, format, packs:[{code, name, nativeName, region, dir, version, format, file, url, size, sha256,
//                                 spelling, spellingMode, license, font, words, checked, sourceWords, sources}], source}
//   langpack-install(o)       → o = {url} | {file} | {data(base64), name}; optional o.sha256 (expected SHA-256 of the zip)
//                               → {code, name, nativeName, dir, version, …summary, path}
//   langpack-list             → [{code, name, nativeName, region, dir, version, format, license, font, spelling, spellingMode,
//                                 words, checked, size, path}]
//   langpack-remove(code)     → true
//   langpack-files(code)      → {manifest, aff, dic, rules, spellingMode, clitics, lexicon, similar, phrases, sources} for
//                               app.writing.registerLanguage (aff/dic only in "full" mode without a lexicon; the lexicon
//                               is loaded on demand; similar is the parsed similar.json; phrases is its file name or null)
//   langpack-lexicon(code)    → {fields, rows} | null   (lexicon.json of an installed format-2 pack)
//   langpack-wordlist(code)   → {list: 'word\nword…', freq: [..] | null, count: [..] | null, words} | null  the lexicon's
//                               words in a compact form for spelling (one string and two number lists: cheap to pass on)
//   langpack-roman(code)      → {fields, rows} | null   (roman.json of an installed format-2 pack)
//   langpack-local-dir        → the dist/ folder of a markooj-language-packs checkout next to the app folder (development
//                               copies only, for the smoke tests; or $MARKOOJ_PACKS_DIST), else null
'use strict';
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const RELEASE_BASE = 'https://github.com/datakeen/markooj-language-packs/releases/download/packs/';
const PACK_FORMAT = 2; // the newest pack zip format this Markooj reads (1 and 2)
const INDEX_URL = RELEASE_BASE + 'index.json';
// GitHub answers release downloads with a redirect to its asset hosts
const ALLOWED_HOSTS = new Set(['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com', 'github-releases.githubusercontent.com']);
const MAX_ZIP = 80 * 1024 * 1024;         // a pack is a few MB; refuse anything absurd
const MAX_UNPACKED = 200 * 1024 * 1024;
const CODE_RE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;

const packsDir = () => path.join(app.getPath('userData'), 'langpacks');
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
let cachedIndex = null;

function plain(msg) { const e = new Error(msg); e.plain = true; return e; }
// English and every English variety map onto the built-in en-US / en-GB languages
const isBuiltinCode = code => /^en(?:[-_]|$)/i.test(String(code || ''));

/** GET over https with a timeout, following GitHub's redirects only to GitHub hosts. Node's https is used on purpose:
 *  the window's session blocks web requests unless "Load pictures from the web" is on, and this is a separate, explicit action. */
function httpsGet(url, { timeout = 15000, max = MAX_ZIP, redirects = 5, notFound = 'GitHub has no such language pack yet (404).' } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch { return reject(plain('That download address is not valid.')); }
    if (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.hostname)) return reject(plain(`Language packs only download from GitHub (got ${u.hostname}).`));
    const req = https.get(u, { headers: { 'User-Agent': 'Markooj language packs', Accept: 'application/octet-stream, application/json' }, timeout }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects <= 0) return reject(plain('GitHub sent too many redirects.'));
        return resolve(httpsGet(new URL(res.headers.location, u).href, { timeout, max, redirects: redirects - 1, notFound }));
      }
      if (res.statusCode === 404) { res.resume(); return reject(plain(notFound)); }
      if (res.statusCode !== 200) { res.resume(); return reject(plain(`GitHub answered ${res.statusCode}. Try again later.`)); }
      const len = Number(res.headers['content-length'] || 0);
      if (len > max) { res.destroy(); return reject(plain('The download is larger than a language pack can be.')); }
      const chunks = []; let got = 0;
      res.on('data', c => { got += c.length; if (got > max) { res.destroy(); reject(plain('The download is larger than a language pack can be.')); } else chunks.push(c); });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', e => reject(offline(e)));
    });
    req.on('timeout', () => { req.destroy(); reject(plain('GitHub did not answer in time. Check your internet connection and try again.')); });
    req.on('error', e => reject(offline(e)));
  });
}
function offline(e) {
  if (e && e.plain) return e;
  const c = e && e.code;
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|ECONNRESET|ETIMEDOUT/.test(String(c))) return plain('You seem to be offline: Markooj can’t reach GitHub. Check your internet connection, or install a language pack from a file.');
  return plain('The download failed: ' + ((e && e.message) || e));
}

const count = v => (v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : null);
/** Credits of a pack (manifest.sources, or an index entry's sources/credits): [{what, license, url?, credit?}], plain text
 *  only, links only to http(s) addresses. credit: the exact attribution a source asks for (shown instead of "what").
 *  A plain string counts as {what}. */
function cleanSources(list) {
  if (!Array.isArray(list)) return [];
  const txt = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max) : '');
  const out = [];
  for (const s of list.slice(0, 20)) {
    const o = typeof s === 'string' ? { what: s } : s && typeof s === 'object' ? s : null; if (!o) continue;
    const what = txt(o.what || o.credit || o.name, 400); if (!what) continue;
    let url = txt(o.url, 400); try { if (!/^https?:$/.test(new URL(url).protocol)) url = ''; } catch { url = ''; }
    const credit = typeof s !== 'string' ? txt(o.credit, 600) : '';
    out.push({ what, license: txt(o.license, 80), ...(url ? { url } : {}), ...(credit && credit !== what ? { credit } : {}) });
  }
  return out;
}
/** 'near-miss' | 'full' | null (no spelling, also for mode "off") from a manifest's or an index entry's `spelling`
 *  (format 1: {aff, dic} or true/false). */
function spellingModeOf(s) {
  if (!s) return null;
  // "off" (the pack builds may still ship a small .aff/.dic next to it): no spelling, never "full" because of those files
  if (typeof s === 'object') { if (s.mode === 'near-miss' || s.mode === 'full') return s.mode; if (s.mode === 'off') return null; return s.aff && s.dic ? 'full' : null; }
  if (s === 'near-miss' || s === 'full') return s;
  return s === true ? 'full' : null;
}
/** index.json, format 1 or 2. Entries of a newer pack format than this Markooj reads are left out. */
function normalizeIndex(o) {
  const packs = Array.isArray(o && o.packs) ? o.packs : [];
  return {
    updated: (o && o.updated) || null,
    format: Number(o && o.format) || 1,
    packs: packs.filter(p => p && CODE_RE.test(String(p.code || '')) && !isBuiltinCode(p.code) && /^[0-9a-f]{64}$/i.test(String(p.sha256 || '')) && typeof p.file === 'string' && /\.zip$/i.test(p.file)
        && (Number(p.format) || 1) <= PACK_FORMAT)
      .map(p => {
        const file = path.basename(p.file); const mode = spellingModeOf(p.spellingMode || p.spelling);
        const font = p.font && typeof p.font === 'object' ? { family: String(p.font.family || '') } : p.font ? { family: String(p.font) } : null;
        // the download address is always built from the release this Markooj trusts, never taken from the list
        return { code: p.code, name: String(p.name || p.code), nativeName: String(p.nativeName || ''), region: String(p.region || ''), dir: p.dir === 'rtl' ? 'rtl' : 'ltr',
          version: String(p.version || ''), format: Number(p.format) || 1, file, url: RELEASE_BASE + file, size: Number(p.size) || 0, sha256: String(p.sha256).toLowerCase(),
          spelling: !!mode, spellingMode: mode, license: String(p.license || ''), font, words: count(p.words ?? p.stats?.words ?? p.counts?.words), checked: count(p.checked ?? p.stats?.checked ?? p.counts?.checked),
          sourceWords: count(p.sourceWords ?? p.counts?.sourceWords), sources: cleanSources(p.sources ?? p.credits) };
      }),
  };
}
async function fetchIndex() {
  // a 404 here means the list itself is not published yet, not that one pack is missing
  const buf = await httpsGet(INDEX_URL, { timeout: 12000, max: 2 * 1024 * 1024, notFound: 'No language packs are published on GitHub yet. You can install one from a file.' });
  let o; try { o = JSON.parse(buf.toString('utf8')); } catch { throw plain('The language pack list from GitHub could not be read.'); }
  cachedIndex = { ...normalizeIndex(o), source: 'github', fetchedAt: Date.now() };
  return cachedIndex;
}


// ---------- zip checks ----------
/** A zip entry name that stays inside the pack folder: no absolute paths, drive letters, backslashes or "..". */
function safeEntry(name, target) {
  const n = String(name);
  if (!n || n.length > 200 || /[\\\0:*?"<>|]/.test(n) || n.startsWith('/') || /^[A-Za-z]:/.test(n)) return null;
  const parts = n.split('/');
  if (parts.some(p => p === '..' || p === '.')) return null;
  const full = path.resolve(target, ...parts.filter(Boolean));
  const rel = path.relative(target, full);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return full;
}

// ---------- shapes of the JSON files a pack carries ----------
const FIELD_RE = /^[a-z][a-z0-9_]{0,31}$/;
const CTRL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
const shortText = (v, max) => typeof v === 'string' && v.length <= max && !CTRL_RE.test(v);
const strList = (v, maxItems, maxLen) => Array.isArray(v) && v.length <= maxItems && v.every(s => shortText(s, maxLen) && s.length > 0);
/** A table file ({fields, rows}): fields are short lowercase names, every row has one cell per field. */
function checkTable(o, what, need, maxRows, cell) {
  const bad = why => plain(`The language pack’s ${what} is not in the expected shape (${why}), so nothing was installed.`);
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw bad('not an object');
  const { fields, rows } = o;
  if (!Array.isArray(fields) || !fields.length || fields.length > 32 || !fields.every(f => typeof f === 'string' && FIELD_RE.test(f)) || new Set(fields).size !== fields.length) throw bad('fields');
  for (const n of need) if (!fields.includes(n)) throw bad(`no “${n}” field`);
  if (!Array.isArray(rows) || rows.length > maxRows) throw bad('rows');
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r) || r.length !== fields.length) throw bad(`row ${i + 1} has ${Array.isArray(r) ? r.length : 'no'} cells, not ${fields.length}`);
    for (let k = 0; k < fields.length; k++) { const why = cell(fields[k], r[k]); if (why) throw bad(`row ${i + 1}, ${fields[k]}: ${why}`); }
  }
  return o;
}
/** Any other field of a table: text, a number, true/false, or a short list of those (fields Markooj does not use yet). */
const otherCell = v => (v == null || typeof v === 'number' || typeof v === 'boolean' || shortText(v, 2000)
  || (Array.isArray(v) && v.length <= 64 && v.every(x => x == null || typeof x === 'number' || typeof x === 'boolean' || shortText(x, 400))) ? '' : 'not text');
/** lexicon.json: {fields: [word, aarab, roman, freq, pos, count, …], rows}. word: 1–64 letters; roman: list of spellings;
 *  freq: 0–5; count: a whole number from 0 (how often the word occurs in the source corpus); other fields: any short value. */
function checkLexicon(o) {
  return checkTable(o, 'word list (lexicon.json)', ['word'], 500000, (f, v) => {
    if (f === 'word') return shortText(v, 64) && v.trim() && !/\s/.test(v) ? '' : 'not a single word';
    if (f === 'roman') return v == null || shortText(v, 200) || strList(v, 16, 64) ? '' : 'not a list of Roman spellings';
    if (f === 'freq') return v == null || v === '' || (Number.isInteger(v) && v >= 0 && v <= 5) ? '' : 'not a number from 0 to 5';
    if (f === 'count') return v == null || v === '' || (Number.isInteger(v) && v >= 0) ? '' : 'not a whole number from 0';
    return otherCell(v);
  });
}
/** phrases.json: {fields: [phrase, count, …], rows}. phrase: 1–200 characters of text; count: a whole number from 0. */
function checkPhrases(o) {
  return checkTable(o, 'phrase list (phrases.json)', ['phrase'], 1000000, (f, v) => {
    if (f === 'phrase') return shortText(v, 200) && v.trim() ? '' : 'not a phrase';
    if (f === 'count') return v == null || v === '' || (Number.isInteger(v) && v >= 0) ? '' : 'not a whole number from 0';
    return otherCell(v);
  });
}
/** similar.json: {groups: [{kind: 'sound' | 'shape', letters: [2–64 letters of 1–4 characters each]}]} */
function checkSimilar(o) {
  const bad = why => plain(`The language pack’s similar letters (similar.json) are not in the expected shape (${why}), so nothing was installed.`);
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw bad('not an object');
  if (!Array.isArray(o.groups) || o.groups.length > 500) throw bad('no list of groups');
  o.groups.forEach((g, i) => {
    if (!g || typeof g !== 'object' || Array.isArray(g)) throw bad(`group ${i + 1} is not an object`);
    if (g.kind !== 'sound' && g.kind !== 'shape') throw bad(`group ${i + 1}: kind is not “sound” or “shape”`);
    if (!strList(g.letters, 64, 4) || g.letters.length < 2 || g.letters.some(l => /\s/.test(l))) throw bad(`group ${i + 1}: letters`);
  });
  return o;
}
/** roman.json: {fields: [roman, letters, note], rows}, or the packs repo's {map: {roman: [letters]}} (turned into rows).
 *  roman: 1–16 Latin characters; letters: the letters it can stand for. */
function checkRoman(o) {
  if (o && typeof o === 'object' && !Array.isArray(o) && !o.fields && o.map && typeof o.map === 'object' && !Array.isArray(o.map)) {
    const keys = Object.keys(o.map);
    if (keys.length > 20000) throw plain('The language pack’s Roman letter map (roman.json) is not in the expected shape (rows), so nothing was installed.');
    o = { fields: ['roman', 'letters', 'note'], rows: keys.map(k => [k, o.map[k], null]) };
  }
  return checkTable(o, 'Roman letter map (roman.json)', ['roman', 'letters'], 20000, (f, v) => {
    if (f === 'roman') return shortText(v, 16) && v.length > 0 ? '' : 'empty or too long';
    if (f === 'letters') return strList(v, 32, 16) || (shortText(v, 200) && v.length > 0) ? '' : 'not a list of letters';
    return v == null || typeof v === 'number' || shortText(v, 400) ? '' : 'not text';
  });
}
/** rules.json: {rules: [{id, category, pattern, flags, replace, message, why, …}]} */
function checkRules(o) {
  const bad = why => plain(`The language pack’s rules (rules.json) are not in the expected shape (${why}), so nothing was installed.`);
  if (!o || typeof o !== 'object' || !Array.isArray(o.rules) || o.rules.length > 20000) throw bad('no list of rules');
  for (const r of o.rules) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw bad('a rule is not an object');
    if (r.pattern != null && !shortText(String(r.pattern), 4000)) throw bad('a pattern is too long');
  }
  return o;
}
function checkClitics(c) {
  if (c == null) return { prefix: [], suffix: [] };
  if (typeof c !== 'object' || (c.prefix != null && !strList(c.prefix, 400, 12)) || (c.suffix != null && !strList(c.suffix, 400, 12))) {
    throw plain('The language pack’s clitics (prefix and suffix lists) are not in the expected shape, so nothing was installed.');
  }
  return { prefix: c.prefix || [], suffix: c.suffix || [] };
}
/** The files a manifest points at, each of which must be in manifest.files (so its SHA-256 was checked). */
function namedFiles(m) {
  const s = m.spelling && typeof m.spelling === 'object' ? m.spelling : {};
  return { rules: m.rules, lexicon: m.lexicon, roman: m.roman, similar: m.similar, phrases: m.phrases, aff: s.aff, dic: s.dic };
}

/** Check and unpack a pack zip. Nothing is written unless every check passes. */
async function installZip(buf, { expectSha, origin } = {}) {
  if (!Buffer.isBuffer(buf) || !buf.length) throw plain('The language pack file is empty.');
  if (buf.length > MAX_ZIP) throw plain('That file is too large to be a language pack.');
  const sum = sha256(buf);
  if (expectSha && sum !== String(expectSha).toLowerCase()) {
    throw plain(`The language pack failed its safety check (SHA-256 does not match${origin ? ' ' + origin : ''}). It may be damaged or changed, so nothing was installed.`);
  }
  const JSZip = require('jszip');
  let zip; try { zip = await JSZip.loadAsync(buf); } catch { throw plain('That file is not a Markooj language pack (not a zip file).'); }
  const root = packsDir();
  const probe = path.join(root, '__probe__');
  // 1. every name must stay inside the target folder (zip-slip)
  const entries = [];
  for (const [name, f] of Object.entries(zip.files)) {
    if (f.dir) { if (!safeEntry(name.replace(/\/+$/, ''), probe)) throw plain(`The language pack has an unsafe file path (${name}), so nothing was installed.`); continue; }
    if (!safeEntry(name, probe)) throw plain(`The language pack has an unsafe file path (${name}), so nothing was installed.`);
    entries.push([name, f]);
  }
  // 2. the manifest
  const mf = zip.file('manifest.json');
  if (!mf) throw plain('That zip has no manifest.json, so it is not a Markooj language pack.');
  let manifest; try { manifest = JSON.parse(await mf.async('string')); } catch { throw plain('The language pack manifest could not be read.'); }
  if (!manifest || !CODE_RE.test(String(manifest.code || ''))) throw plain('The language pack does not say which language it is for.');
  // English (US and UK) is built into Markooj: a pack can never replace it
  if (isBuiltinCode(manifest.code)) throw plain(`English is built into Markooj, so a language pack cannot replace it (this pack says “${manifest.code}”). Nothing was installed.`);
  const format = manifest.format == null ? 1 : Number(manifest.format);
  if (!Number.isInteger(format) || format < 1) throw plain('The language pack manifest has an unknown format.');
  if (format > PACK_FORMAT) throw plain(`This language pack needs a newer Markooj (pack format ${format}). Update Markooj, then install it again.`);
  if (!manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) throw plain('The language pack manifest lists no files.');
  const mode = spellingModeOf(manifest.spelling);
  if (manifest.spelling && typeof manifest.spelling === 'object' && manifest.spelling.mode != null && manifest.spelling.mode !== 'off' && !mode) throw plain(`The language pack asks for a spelling mode Markooj does not know (${String(manifest.spelling.mode).slice(0, 20)}).`);
  const named = namedFiles(manifest);
  for (const [k, v] of Object.entries(named)) {
    if (v == null) continue;
    if (typeof v !== 'string' || !safeEntry(v, probe) || !Object.prototype.hasOwnProperty.call(manifest.files, v)) throw plain(`The language pack names a ${k} file its manifest does not list (${String(v).slice(0, 60)}), so nothing was installed.`);
  }
  // full spelling reads lexicon.json when the pack has one (format 2), else the Hunspell .aff/.dic
  if (mode === 'full' && !(named.aff && named.dic) && !(format >= 2 && named.lexicon)) throw plain('The language pack asks for full spelling but has no word list (lexicon.json, or .aff and .dic), so nothing was installed.');
  if (mode === 'near-miss' && !named.lexicon) throw plain('The language pack asks for near-miss spelling but has no word list (lexicon.json), so nothing was installed.');
  const clitics = checkClitics(manifest.clitics);
  // 3. every file is listed with its SHA-256, and nothing unlisted comes along
  let total = 0; const out = [];
  for (const [name, f] of entries) {
    if (name === 'manifest.json') continue;
    const want = manifest.files[name];
    if (!want) throw plain(`The language pack has a file its manifest does not list (${name}), so nothing was installed.`);
    const data = await f.async('nodebuffer');
    total += data.length; if (total > MAX_UNPACKED) throw plain('The language pack unpacks to more than a language pack can be.');
    const w = typeof want === 'string' ? want : want.sha256;
    if (sha256(data) !== String(w).toLowerCase()) throw plain(`A file in the language pack is damaged or was changed (${name}: SHA-256 does not match), so nothing was installed.`);
    out.push([name, data]);
  }
  for (const name of Object.keys(manifest.files)) if (!out.find(([n]) => n === name)) throw plain(`The language pack is missing ${name}.`);
  // 3b. the JSON files have the shapes Markooj reads (checked before anything is written)
  const json = (name, what) => { try { return JSON.parse(out.find(([n]) => n === name)[1].toString('utf8').replace(/^﻿/, '')); } catch { throw plain(`The language pack’s ${what} (${name}) could not be read, so nothing was installed.`); } };
  if (named.rules) checkRules(json(named.rules, 'rules'));
  const given = [manifest.stats, manifest.counts].find(x => x && typeof x === 'object' && !Array.isArray(x));
  let stats = given ? { words: count(given.words), checked: count(given.checked) } : null;
  if (named.lexicon) {
    const lex = checkLexicon(json(named.lexicon, 'word list'));
    // the counts shown in Options: taken from the list itself when the manifest does not give them
    if (!stats || stats.words == null) {
      const st = lex.fields.indexOf('status');
      stats = { words: lex.rows.length, checked: st >= 0 ? lex.rows.filter(r => String(r[st]).toLowerCase() === 'checked').length : (stats && stats.checked) || 0 };
    }
  }
  if (named.roman) checkRoman(json(named.roman, 'Roman letter map'));
  if (named.similar) checkSimilar(json(named.similar, 'similar letters'));
  if (named.phrases) checkPhrases(json(named.phrases, 'phrase list'));
  // 4. write into a temporary folder, then swap it in
  const code = manifest.code;
  const target = path.join(root, code);
  const tmp = path.join(root, `.tmp-${code}-${crypto.randomBytes(4).toString('hex')}`);
  const saved = { ...manifest, format, clitics, ...(stats ? { stats } : {}), installedAt: new Date().toISOString(), zipSha256: sum };
  fs.mkdirSync(tmp, { recursive: true });
  try {
    for (const [name, data] of out) {
      const dest = safeEntry(name, tmp); if (!dest) throw plain('Unsafe file path in the language pack.');
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, data);
    }
    fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(saved, null, 2));
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(tmp, target);
  } catch (e) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} throw e; }
  return { ...summary(saved, target), path: target };
}

function summary(m, dir) {
  let size = 0;
  try { for (const f of fs.readdirSync(dir)) { try { size += fs.statSync(path.join(dir, f)).size; } catch {} } } catch {}
  const mode = spellingModeOf(m.spelling);
  const st = m.stats && typeof m.stats === 'object' ? m.stats : {};
  return { code: m.code, name: m.name || m.code, nativeName: m.nativeName || '', region: m.region || '', dir: m.dir === 'rtl' ? 'rtl' : 'ltr', version: String(m.version || ''),
    format: Number(m.format) || 1, license: m.license || '', font: m.font || null, spelling: !!mode, spellingMode: mode,
    words: count(st.words), checked: count(st.checked), lexicon: !!m.lexicon, roman: !!m.roman, similar: !!m.similar, phrases: !!m.phrases,
    sourceWords: count(m.counts && typeof m.counts === 'object' ? m.counts.sourceWords : null), sources: cleanSources(m.sources), size, installedAt: m.installedAt || null };
}
function listInstalled() {
  const root = packsDir(); const out = [];
  let names = []; try { names = fs.readdirSync(root); } catch { return out; }
  for (const n of names) {
    if (n.startsWith('.') || !CODE_RE.test(n) || isBuiltinCode(n)) continue;
    try { const m = JSON.parse(fs.readFileSync(path.join(root, n, 'manifest.json'), 'utf8')); if (m.code === n) out.push({ ...summary(m, path.join(root, n)), path: path.join(root, n) }); } catch {}
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
function localDir() {
  if (app.isPackaged) return null;
  const parent = path.dirname(__dirname); const cands = [];
  if (process.env.MARKOOJ_PACKS_DIST) cands.push(process.env.MARKOOJ_PACKS_DIST);
  try { for (const n of fs.readdirSync(parent)) if (/markooj[ ._-]*language[ ._-]*packs$/i.test(n)) cands.push(path.join(parent, n, 'dist')); } catch {}
  for (const d of cands) { try { if (fs.statSync(path.join(d, 'index.json')).isFile()) return d; } catch {} }
  return null;
}
/** An index.json next to a local zip (as the build script writes it) is checked too. */
function siblingIndexSha(file) {
  try {
    const idx = normalizeIndex(JSON.parse(fs.readFileSync(path.join(path.dirname(file), 'index.json'), 'utf8')));
    const e = idx.packs.find(p => p.file.toLowerCase() === path.basename(file).toLowerCase());
    return e ? e.sha256 : null;
  } catch { return null; }
}

ipcMain.handle('langpack-index', async () => fetchIndex());
ipcMain.handle('langpack-install', async (_e, o = {}) => {
  if (o.url) {
    const url = String(o.url);
    if (!url.startsWith(RELEASE_BASE)) throw plain('Language packs only install from the Markooj releases on GitHub.');
    const idx = cachedIndex || await fetchIndex();
    const entry = idx.packs.find(p => p.url === url || RELEASE_BASE + p.file === url);
    if (!entry) throw plain('That language pack is not in the list on GitHub.');
    const buf = await httpsGet(url);
    return installZip(buf, { expectSha: entry.sha256, origin: 'the list on GitHub' });
  }
  if (o.file) {
    const file = path.resolve(String(o.file));
    if (!/\.zip$/i.test(file)) throw plain('Pick a language pack .zip file.');
    let st; try { st = fs.statSync(file); } catch { throw plain('That file could not be found.'); }
    if (st.size > MAX_ZIP) throw plain('That file is too large to be a language pack.');
    const expect = o.sha256 || siblingIndexSha(file);
    return installZip(fs.readFileSync(file), { expectSha: expect, origin: o.sha256 ? 'the expected value' : 'index.json' });
  }
  if (o.data) return installZip(Buffer.from(String(o.data), 'base64'), { expectSha: o.sha256 || null, origin: 'the expected value' });
  throw plain('Nothing to install.');
});
ipcMain.handle('langpack-list', () => listInstalled());
ipcMain.handle('langpack-remove', (_e, code) => {
  const c = String(code || '');
  if (!CODE_RE.test(c)) throw plain('Unknown language pack.');
  const dir = path.join(packsDir(), c);
  if (path.dirname(dir) !== packsDir()) throw plain('Unknown language pack.');
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
});
function installedPack(code) {
  const c = String(code || '');
  if (!CODE_RE.test(c) || isBuiltinCode(c)) throw plain('Unknown language pack.');
  const dir = path.join(packsDir(), c);
  if (path.dirname(dir) !== packsDir()) throw plain('Unknown language pack.');
  let m; try { m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch { throw plain('That language pack is not installed.'); }
  const read = rel => { if (!rel || typeof rel !== 'string') return null; const p = safeEntry(rel, dir); return p && fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; };
  return { dir, m, read };
}
ipcMain.handle('langpack-files', (_e, code) => {
  const { m, read } = installedPack(code);
  let rules = null; try { rules = JSON.parse(read(m.rules) || 'null'); } catch {}
  const mode = spellingModeOf(m.spelling);
  const lexicon = !!m.lexicon && (Number(m.format) || 1) >= 2;
  // full spelling with a word list (format 2) reads lexicon.json; the Hunspell files are only handed over without one
  const full = mode === 'full' && !lexicon && m.spelling && typeof m.spelling === 'object';
  let clitics = { prefix: [], suffix: [] }; try { clitics = checkClitics(m.clitics); } catch {}
  let similar = null; try { similar = m.similar ? checkSimilar(JSON.parse((read(m.similar) || 'null').replace(/^\uFEFF/, ''))) : null; } catch { similar = null; }
  return { manifest: m, aff: full ? read(m.spelling.aff) : null, dic: full ? read(m.spelling.dic) : null, rules, spellingMode: mode, clitics,
    lexicon, similar, phrases: typeof m.phrases === 'string' ? m.phrases : null, sources: cleanSources(m.sources) };
});
// The word list and the Roman letter map are read only when something needs them (they were checked at install).
function tableOf(code, key, check) {
  const { m, read } = installedPack(code);
  if (!m[key]) return null;
  const text = read(m[key]); if (text == null) return null;
  try { return check(JSON.parse(text.replace(/^﻿/, ''))); } catch { return null; }
}
ipcMain.handle('langpack-lexicon', (_e, code) => tableOf(code, 'lexicon', checkLexicon));
/** The lexicon's words for spelling, compact: one newline-joined string (words with harakat (aarab) added after their
 *  word when they differ) and the freq and count of each line. */
function wordList(lex) {
  if (!lex) return null;
  const F = lex.fields, wi = F.indexOf('word'), ai = F.indexOf('aarab'), fi = F.indexOf('freq'), ci = F.indexOf('count');
  const list = [], freq = fi >= 0 ? [] : null, cnt = ci >= 0 ? [] : null;
  const add = (w, r) => { list.push(w); if (freq) freq.push(Number(r[fi]) || 0); if (cnt) cnt.push(Number(r[ci]) || 0); };
  for (const r of lex.rows) {
    const w = r[wi]; if (typeof w !== 'string' || !w || w.includes('\n')) continue;
    add(w, r);
    const a = ai >= 0 ? r[ai] : null; if (typeof a === 'string' && a && a !== w && !/[\s]/.test(a) && a.length <= 64) add(a, r);
  }
  return { list: list.join('\n'), freq, count: cnt, words: lex.rows.length };
}
ipcMain.handle('langpack-wordlist', (_e, code) => wordList(tableOf(code, 'lexicon', checkLexicon)));
ipcMain.handle('langpack-phrases', (_e, code) => tableOf(code, 'phrases', checkPhrases));
ipcMain.handle('langpack-roman', (_e, code) => tableOf(code, 'roman', checkRoman));
ipcMain.handle('langpack-local-dir', () => localDir());

module.exports = { installZip, safeEntry, listInstalled, normalizeIndex, checkLexicon, checkRoman, checkRules, checkSimilar, checkPhrases, cleanSources, wordList, RELEASE_BASE, INDEX_URL, PACK_FORMAT };
