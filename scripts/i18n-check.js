#!/usr/bin/env node
// Markooj — check the interface translation catalogs in locales/ (contract: docs/I18N.md).
//
//   node scripts/i18n-check.js                 every language: missing, extra, placeholders, tags, plurals, empty, same as English, length
//   node scripts/i18n-check.js --lang ur,ar    only these languages (English is always checked)
//   node scripts/i18n-check.js --scan          also scan the code: app.t('…') / app.tn / app.th / app.tm / I18N.t and data-i18n* usages
//                                              against locales/en (used but missing, in English but unused, dynamic keys)
//   --verbose (every item), --max N (items per list, default 12), --json (machine-readable report), --strict (missing keys in
//   locales/en, plural gaps and unused English strings count as errors), --write (store each language's completeness in
//   locales/languages.json)
//
// Exit code 1 when there is an error (a broken or invented placeholder, mismatched HTML tags, a missing 'other' plural form,
// invalid JSON, a bad context marker, an English value that differs from its key). Warnings never fail the run.
'use strict';
const fs = require('fs');
const path = require('path');
const core = require('../src/i18n-core.js');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const opt = n => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
const LOC = opt('locales') ? path.resolve(opt('locales')) : path.join(ROOT, 'locales'); // --locales <dir>: check a copy (tests)
const MAX = flag('verbose') ? Infinity : Math.max(1, Number(opt('max')) || 12);
const STRICT = flag('strict');
const ONLY = (opt('lang') || '').split(',').map(s => s.trim()).filter(Boolean);

// Words that may stay as in English in every language (names, formats, symbols). A language adds its own with an
// "@same": ["Version", …] entry in any of its catalog files.
const SAME_OK = new Set(['Markooj', 'Markdown', 'Pandoc', 'PDF', 'DOCX', 'ODT', 'RTF', 'EPUB', 'HTML', 'LaTeX', 'BibTeX', 'KaTeX', 'Mermaid', 'MathLive', 'Pyodide', 'Python', 'JavaScript', 'GitHub', 'DjVu', 'UTF-8', 'CommonMark', 'GFM', 'OK', 'Typst', 'YAML', 'JSON', 'CSV', 'APA', 'IEEE', 'Chicago', 'CSL', 'Unicode', 'Harper', 'WordNet', 'Word', 'Excel', 'Obsidian']);
const BRAND_RE = new RegExp('\\b(?:' + [...SAME_OK].map(s => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')).join('|') + '|Ctrl|Shift|Alt|Cmd|Esc|Enter|Tab|F\\d{1,2})\\b', 'g');
// es, fr, pt use 'many' only for millions ("1 000 000 de …"); 'other' reads right there, so a missing 'many' is only noted
const OPTIONAL_CATS = { es: ['many'], fr: ['many'], 'pt-BR': ['many'], pt: ['many'], it: ['many'] };

const report = { errors: 0, warnings: 0, en: { strings: 0, groups: [], errors: [], warnings: [] }, languages: {}, scan: null };
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
function readJson(file, bag) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); }
  catch (e) { bag.errors.push(`${rel(file)}: not valid JSON (${e.message})`); return null; }
}
const entriesOf = o => Object.entries(o || {}).filter(([k]) => k[0] !== '@');
const formsOf = v => (core.isPlural(v) ? Object.values(v).filter(x => typeof x === 'string') : typeof v === 'string' ? [v] : []);
const usable = v => (typeof v === 'string' ? v !== '' : core.isPlural(v) && Object.values(v).some(x => typeof x === 'string' && x !== ''));
const short = s => { s = String(s); return s.length > 90 ? s.slice(0, 87) + '…' : s; };
const sameSet = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---------- languages.json ----------
const langFile = path.join(LOC, 'languages.json');
const langDoc = readJson(langFile, report.en) || { languages: [] };
const LANGS = (langDoc.languages || []).filter(l => l && l.code);
for (const l of LANGS) {
  if (!['ltr', 'rtl'].includes(l.dir)) report.en.errors.push(`languages.json: ${l.code} needs "dir": "ltr" or "rtl"`);
  if (!l.native || !l.name) report.en.errors.push(`languages.json: ${l.code} needs "name" and "native"`);
  try { new Intl.PluralRules(l.plural || l.code); } catch { report.en.errors.push(`languages.json: ${l.code} has an unknown "plural" locale ${l.plural}`); }
}

// ---------- English (the source) ----------
const groupFiles = dir => { try { return fs.readdirSync(dir).filter(f => /\.json$/i.test(f)).sort(); } catch { return []; } };
const EN = {}; // group → {key: value}
const enAll = new Map(); // key → {value, group}
for (const f of groupFiles(path.join(LOC, 'en'))) {
  const g = f.replace(/\.json$/i, '');
  const o = readJson(path.join(LOC, 'en', f), report.en) || {};
  EN[g] = o; report.en.groups.push(g);
  for (const [k, v] of entriesOf(o)) {
    if (enAll.has(k)) {
      const first = enAll.get(k);
      if (JSON.stringify(first.value) !== JSON.stringify(v)) report.en.errors.push(`"${short(k)}" is in en/${first.group}.json and en/${g}.json with different text`);
      else report.en.warnings.push(`"${short(k)}" is in both en/${first.group}.json and en/${g}.json (keep it in one group)`);
      continue;
    }
    enAll.set(k, { value: v, group: g });
    if (k.includes('@@') && !core.parseKey(k).context) report.en.errors.push(`"${short(k)}": the context marker must be @@ and lower-case words at the very end (for example "Open@@verb")`);
    if (typeof v === 'string') {
      if (v === '') report.en.errors.push(`"${short(k)}": empty English text`);
      else if (v !== core.stripContext(k)) report.en.errors.push(`"${short(k)}": the English text must equal its key without the context marker (found "${short(v)}")`);
    } else if (core.isPlural(v)) {
      if (!v.one || !v.other) report.en.errors.push(`"${short(k)}": an English plural needs "one" and "other"`);
      if (v.other && v.other !== core.stripContext(k)) report.en.errors.push(`"${short(k)}": the key of a plural is its "other" form (found "${short(v.other)}")`);
    } else report.en.errors.push(`"${short(k)}": a value is a string or an object of plural forms`);
  }
}
report.en.strings = enAll.size;

// ---------- each language ----------
function allowedSame(text, extra) {
  if (!/[A-Za-z]/.test(text)) return true;
  if (extra.has(text) || SAME_OK.has(text)) return true;
  return !/[A-Za-z]/.test(text.replace(BRAND_RE, '').replace(/\{[A-Za-z_]\w*\}/g, '').replace(/<[^>]+>/g, ''));
}
function checkLanguage(L) {
  const code = L.code;
  const r = { code, name: L.name, dir: L.dir, total: enAll.size, translated: 0, completeness: 0, missing: [], empty: [], extra: [], wrongGroup: [], errors: [], warnings: [], same: [], long: [], pluralGaps: [] };
  const dir = path.join(LOC, code);
  if (!fs.existsSync(dir)) { r.errors.push(`locales/${code}/ is missing (create it with an empty {} file per group)`); r.missing = [...enAll.keys()]; return r; }
  const T = {}; const tAll = new Map(); const sameOk = new Set();
  for (const f of groupFiles(dir)) {
    const g = f.replace(/\.json$/i, '');
    const o = readJson(path.join(dir, f), r) || {};
    T[g] = o;
    if (Array.isArray(o['@same'])) o['@same'].forEach(x => sameOk.add(String(x)));
    if (!EN[g]) r.warnings.push(`${code}/${f}: there is no en/${f}; its strings are never used`);
    for (const [k, v] of entriesOf(o)) if (!tAll.has(k)) tAll.set(k, { value: v, group: g });
  }
  for (const g of Object.keys(EN)) if (!T[g]) r.warnings.push(`${code}/${g}.json is missing (its strings show in English)`);
  if (!fs.existsSync(path.join(dir, 'GLOSSARY.md'))) r.warnings.push(`${code}/GLOSSARY.md is missing`);
  const pluralLoc = L.plural || code;
  let cats; try { cats = core.pluralCategories(pluralLoc); } catch { cats = ['one', 'other']; }
  const optional = new Set(OPTIONAL_CATS[code] || OPTIONAL_CATS[code.split('-')[0]] || []);

  for (const [k, { value: ev, group: eg }] of enAll) {
    const hit = tAll.get(k);
    if (!hit) { r.missing.push(k); continue; }
    if (hit.group !== eg) r.wrongGroup.push(`"${short(k)}" is in ${code}/${hit.group}.json; English has it in ${eg}.json`);
    const v = hit.value;
    if (!usable(v)) { r.empty.push(k); continue; }
    const enText = core.stripContext(k);
    // shape
    if (core.isPlural(ev) && typeof v === 'string') {
      if (cats.length === 1) r.warnings.push(`"${short(k)}": write plural text as {"other": "…"} (a plain string works for ${code})`);
      else { r.errors.push(`"${short(k)}": this text has a count; write it as {${cats.map(c => `"${c}": "…"`).join(', ')}}`); continue; }
    }
    if (!core.isPlural(ev) && core.isPlural(v)) { r.errors.push(`"${short(k)}": this text has no count; write one string, not plural forms`); continue; }
    // plural categories
    if (core.isPlural(v)) {
      const have = Object.keys(v).filter(c => typeof v[c] === 'string' && v[c] !== '');
      for (const c of Object.keys(v)) if (!core.CATS.includes(c)) r.errors.push(`"${short(k)}": "${c}" is not a plural category (zero, one, two, few, many, other)`);
      if (!have.includes('other')) r.errors.push(`"${short(k)}": the "other" plural form is missing`);
      const gaps = cats.filter(c => c !== 'other' && !have.includes(c) && !optional.has(c));
      if (gaps.length) r.pluralGaps.push(`"${short(k)}": add ${gaps.map(c => `"${c}"`).join(', ')} (${pluralLoc} uses ${cats.join(', ')})`);
      const extraCats = have.filter(c => !cats.includes(c));
      if (extraCats.length) r.warnings.push(`"${short(k)}": ${extraCats.join(', ')} ${extraCats.length > 1 ? 'are' : 'is'} never used in ${pluralLoc}`);
    }
    // placeholders: every form keeps every {name} of the English (a plural form may leave out {count}); none may be invented
    const enPh = [...new Set(formsOf(ev).flatMap(core.placeholders).concat(core.placeholders(enText)))].sort();
    for (const form of formsOf(v)) {
      const ph = core.placeholders(form);
      const invented = ph.filter(p => !enPh.includes(p));
      const lost = enPh.filter(p => !ph.includes(p) && !(p === 'count' && core.isPlural(v)));
      if (invented.length) r.errors.push(`"${short(k)}": {${invented.join('}, {')}} is not in the English text`);
      if (lost.length) r.errors.push(`"${short(k)}": keep {${lost.join('}, {')}} (found "${short(form)}")`);
      const et = core.tags(formsOf(ev)[0] || enText).slice().sort(), tt = core.tags(form).slice().sort();
      if (!sameSet(et, tt)) r.errors.push(`"${short(k)}": keep the same HTML tags as the English (${et.join(' ') || 'none'}; found ${tt.join(' ') || 'none'})`);
    }
    // same as English, suspicious length
    const firstForm = typeof v === 'string' ? v : v.other || formsOf(v)[0];
    const enForm = typeof ev === 'string' ? ev : ev.other;
    if (firstForm === enForm && !allowedSame(enForm, sameOk)) r.same.push(k);
    if (enForm.length <= 25 && firstForm.length > 2 * enForm.length + 6) r.long.push(`"${short(k)}" → "${short(firstForm)}" (${firstForm.length} characters for ${enForm.length})`);
    r.translated++;
  }
  for (const k of tAll.keys()) if (!enAll.has(k)) r.extra.push(k);
  r.completeness = r.total ? Math.floor((r.translated / r.total) * 1000) / 10 : 100;
  return r;
}

// ---------- --scan: the code against locales/en ----------
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/^(node_modules|vendor|\.git)$/.test(e.name)) walk(p, out); }
    else if (/\.(js|html)$/i.test(e.name)) out.push(p);
  }
  return out;
}
const unescapeJs = s => s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (m, c) => (c[0] === 'u' && c.length > 1 ? String.fromCodePoint(parseInt(c.replace(/[u{}]/g, ''), 16)) : c[0] === 'x' && c.length === 3 ? String.fromCharCode(parseInt(c.slice(1), 16)) : c === 'n' ? '\n' : c === 't' ? '\t' : c));
const unescapeHtml = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function scanCode() {
  const files = [
    ...walk(path.join(ROOT, 'src')),
    ...walk(path.join(ROOT, 'addons')), // the add-ins that come with Markooj (their keys are in the 'system' group)
    ...fs.readdirSync(ROOT).filter(f => /^(main.*|preload)\.js$/.test(f)).map(f => path.join(ROOT, f)),
  ].filter(f => !/(^|[\\/-])tests?\.js$|[\\/]i18n-core\.js$/.test(f));
  const used = new Map(); // key → [file:line]
  const dynamic = [];
  const ATTR = /\bdata-i18n(?:-(?:html|title|aria-label|placeholder|alt|tip|tip-d|label))?=(["'])(.*?)\1/g;
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const lineAt = i => src.slice(0, i).split('\n').length;
    // usage examples in comments are not usages
    const inComment = i => /^\s*(\/\/|\/\*|\*)/.test(src.slice(src.lastIndexOf('\n', i - 1) + 1, i));
    const add = (k, i) => { const w = `${rel(file)}:${lineAt(i)}`; if (!used.has(k)) used.set(k, []); used.get(k).push(w); };
    // a file may name short aliases it calls with literal text: /* i18n-aliases: t, tn */ (for example const t = app.t)
    const al = /i18n-aliases:\s*([\w$ ,]+)/.exec(src);
    const names = al ? al[1].split(/[\s,]+/).filter(n => /^[A-Za-z_$][\w$]*$/.test(n)) : [];
    const CALL = new RegExp('(?:\\b(?:window\\.app|app|I18N|mkI18n|i18n)\\.(?:t|tn|th|tm)' + (names.length ? '|(?<![\\w$.])(?:' + names.map(reEsc).join('|') + ')' : '') + ')\\(\\s*', 'g');
    let m;
    while ((m = CALL.exec(src))) {
      if (inComment(m.index)) continue;
      const at = CALL.lastIndex, q = src[at];
      const alias = !m[0].includes('.');
      if (q !== "'" && q !== '"' && q !== '`') { if (!alias) dynamic.push(`${rel(file)}:${lineAt(m.index)} ${src.slice(m.index, m.index + 60).split('\n')[0]}`); continue; }
      let j = at + 1, s = '';
      while (j < src.length && src[j] !== q) { if (src[j] === '\\') { s += src[j] + src[j + 1]; j += 2; } else s += src[j++]; }
      if (q === '`' && s.includes('${')) { dynamic.push(`${rel(file)}:${lineAt(m.index)} ${short(src.slice(m.index, j + 1))}`); continue; }
      add(unescapeJs(s), m.index);
    }
    ATTR.lastIndex = 0;
    while ((m = ATTR.exec(src))) { if (inComment(m.index)) continue; if (m[2].includes('${')) { dynamic.push(`${rel(file)}:${lineAt(m.index)} ${short(m[0])}`); continue; } add(unescapeHtml(m[2]), m.index); }
  }
  const usedMissing = [...used.keys()].filter(k => !enAll.has(k)).map(k => `"${short(k)}" (${used.get(k)[0]}${used.get(k).length > 1 ? ` +${used.get(k).length - 1}` : ''})`);
  const unused = [...enAll.keys()].filter(k => !used.has(k));
  return { files: files.length, keys: used.size, usedMissing, unused, dynamic };
}

// ---------- run ----------
const targets = LANGS.filter(l => l.code !== 'en' && (!ONLY.length || ONLY.includes(l.code)));
for (const L of targets) report.languages[L.code] = checkLanguage(L);
if (flag('scan')) report.scan = scanCode();

const softErr = list => (STRICT ? list.length : 0);
report.errors = report.en.errors.length + Object.values(report.languages).reduce((n, r) => n + r.errors.length + softErr(r.pluralGaps), 0) + (report.scan ? softErr(report.scan.usedMissing) + softErr(report.scan.unused) : 0);
report.warnings = report.en.warnings.length + Object.values(report.languages).reduce((n, r) => n + r.warnings.length + r.missing.length + r.empty.length + r.extra.length + r.wrongGroup.length + r.same.length + r.long.length + (STRICT ? 0 : r.pluralGaps.length), 0) + (report.scan ? report.scan.dynamic.length + (STRICT ? 0 : report.scan.usedMissing.length + report.scan.unused.length) : 0);

if (flag('write')) {
  for (const L of LANGS) { if (L.code === 'en') L.completeness = 100; else if (report.languages[L.code]) L.completeness = report.languages[L.code].completeness; }
  const lines = LANGS.map(l => '    ' + JSON.stringify(l).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, '{ ').replace(/\}$/, ' }'));
  const head = { ...langDoc }; delete head.languages;
  const text = JSON.stringify(head, null, 2).replace(/\n\}$/, ',\n  "languages": [\n' + lines.join(',\n') + '\n  ]\n}\n');
  fs.writeFileSync(langFile, text);
}

if (flag('json')) { process.stdout.write(JSON.stringify(report, null, 2) + '\n'); process.exit(report.errors ? 1 : 0); }

const out = [];
const list = (title, items, mark = '-') => { if (!items.length) return; out.push(`    ${title} (${items.length}):`); for (const x of items.slice(0, MAX)) out.push(`      ${mark} ${typeof x === 'string' && !x.startsWith('"') && !/^\S+:\d+/.test(x) ? `"${short(x)}"` : x}`); if (items.length > MAX) out.push(`      … ${items.length - MAX} more (--verbose shows all)`); };
out.push(`Markooj interface translations: ${enAll.size} English strings in ${report.en.groups.length} groups (${report.en.groups.join(', ')})`);
out.push(`  en: ${report.en.errors.length ? `${report.en.errors.length} error(s)` : 'OK'}${report.en.warnings.length ? `, ${report.en.warnings.length} warning(s)` : ''}`);
list('errors', report.en.errors, '✗'); list('warnings', report.en.warnings);
for (const r of Object.values(report.languages)) {
  const pad = (r.code + '      ').slice(0, 7);
  out.push(`  ${pad} ${String(r.completeness.toFixed(1)).padStart(5)}%  ${r.translated}/${r.total} translated · missing ${r.missing.length} · empty ${r.empty.length} · extra ${r.extra.length} · errors ${r.errors.length} · plural gaps ${r.pluralGaps.length} · same as English ${r.same.length} · long ${r.long.length}`);
  list('errors', r.errors, '✗'); list('plural gaps', r.pluralGaps, STRICT ? '✗' : '-');
  if (flag('verbose') || targets.length === 1) { list('missing', r.missing); list('empty', r.empty); }
  list('extra (not in English any more)', r.extra); list('in another group', r.wrongGroup); list('same as English (add to "@same" when that is right)', r.same); list('much longer than the English', r.long); list('warnings', r.warnings);
}
if (report.scan) {
  const s = report.scan;
  out.push(`  scan: ${s.files} files, ${s.keys} keys used in code`);
  list('used in code but missing from locales/en', s.usedMissing, STRICT ? '✗' : '-');
  list('in locales/en but not used in code', s.unused, STRICT ? '✗' : '-');
  list('dynamic keys (check by hand: the text must be in locales/en)', s.dynamic);
}
out.push(`${report.errors} error(s), ${report.warnings} warning(s).${report.errors ? ' Fix the errors marked ✗.' : ''}`);
console.log(out.join('\n'));
process.exit(report.errors ? 1 : 0);
