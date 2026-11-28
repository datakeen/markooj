#!/usr/bin/env node
/* Markooj — checks the Windows installer's languages (build/installer-lang.nsh, build/installer-strings.nsh).
 *
 *   node build/installer-lang-test.js            static checks, then (on Windows, when makensis is found) a runtime test
 *   node build/installer-lang-test.js --static   static checks only
 *   MAKENSIS=<path to makensis.exe>               use this makensis (default: electron-builder's cached NSIS)
 *
 * Static: every code of locales/languages.json has a text block with the same keys as English, no empty text, no
 * straight double quote or stray $; the language screen lists exactly those codes with their native names.
 * Runtime: compiles a tiny silent test program from the same .nsh files (no window, nothing installed), runs it, and
 * checks: every spelling of a code → the right code; Windows display languages → the right code; each code → the
 * NSIS language it should use; each code's texts (sizes filled in); and the first-run.json line the installer writes
 * for each code is accepted by Markooj's own reader (main-features.js parseFirstRun) with that same language.
 * Exit code 1 on any failure.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUILD = __dirname;
const ARGS = process.argv.slice(2);
let failures = 0;
let passes = 0;
function ok(cond, msg) {
  if (cond) passes++;
  else { failures++; console.log('  FAIL ' + msg); }
}

const langs = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', 'languages.json'), 'utf8')).languages;
const CODES = langs.map(l => l.code);
const macroOf = code => 'mkStrings_' + code.replace(/-/g, '_');

// ---------------------------------------------------------------- static checks
function parseBlocks(text) {
  const blocks = {};
  const re = /^!macro (mkStrings_\w+)\s*$([\s\S]*?)^!macroend/gm;
  let m;
  while ((m = re.exec(text))) {
    const keys = {};
    for (const line of m[2].split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith(';')) continue;
      const k = /^StrCpy \$mkS_(\w+) "(.*)"$/.exec(t);
      if (!k) { keys['!bad'] = (keys['!bad'] || []).concat(t); continue; }
      keys[k[1]] = k[2];
    }
    blocks[m[1]] = keys;
  }
  return blocks;
}

console.log('installer languages: static checks');
const stringsText = fs.readFileSync(path.join(BUILD, 'installer-strings.nsh'), 'utf8');
const langText = fs.readFileSync(path.join(BUILD, 'installer-lang.nsh'), 'utf8');
const installerText = fs.readFileSync(path.join(BUILD, 'installer.nsh'), 'utf8');
for (const [name, t] of [['installer-strings.nsh', stringsText], ['installer-lang.nsh', langText], ['installer.nsh', installerText]]) {
  ok(t.charCodeAt(0) === 0xFEFF, `${name} starts with a UTF-8 byte order mark`);
}
const blocks = parseBlocks(stringsText);
const enKeys = Object.keys(blocks.mkStrings_en || {}).sort();
ok(enKeys.length >= 13, `English block has the texts (found ${enKeys.length})`);
ok(Object.keys(blocks).length === CODES.length, `one text block per language (${Object.keys(blocks).length} blocks, ${CODES.length} languages)`);
for (const code of CODES) {
  const b = blocks[macroOf(code)];
  ok(!!b, `${code}: has a block ${macroOf(code)}`);
  if (!b) continue;
  ok(!b['!bad'], `${code}: every line is StrCpy $mkS_<key> "<text>"${b['!bad'] ? ' (' + b['!bad'][0] + ')' : ''}`);
  const keys = Object.keys(b).filter(k => k !== '!bad').sort();
  ok(JSON.stringify(keys) === JSON.stringify(enKeys), `${code}: same keys as English (missing: ${enKeys.filter(k => !keys.includes(k)).join(', ') || 'none'}; extra: ${keys.filter(k => !enKeys.includes(k)).join(', ') || 'none'})`);
  for (const k of keys) {
    const v = b[k];
    ok(v.trim().length > 0, `${code}.${k} is not empty`);
    ok(!v.includes('"'), `${code}.${k} has no straight double quote`);
    ok(!/\$(?!\{MK_(DL|DISK)_[A-Z]+\})/.test(v), `${code}.${k} has no $ other than a size`);
    if (/^(pandoc|djvu|python)$/.test(k)) {
      const F = k.toUpperCase();
      ok(v.includes('${MK_DL_' + F + '}') && v.includes('${MK_DISK_' + F + '}'), `${code}.${k} shows both sizes`);
    }
    if (code !== 'en' && !/^(pandoc|djvu|python|dlgTitle)$/.test(k) && code !== 'ur-Latn') {
      ok(v !== blocks.mkStrings_en[k], `${code}.${k} is translated`);
    }
  }
  // the menu path must use the language's arrow direction
  const rtl = (langs.find(l => l.code === code) || {}).dir === 'rtl';
  const foot = b.footer || '';
  ok(rtl ? foot.includes('←') && !foot.includes('→') : foot.includes('→'), `${code}.footer menu path arrows follow the reading direction`);
}
// the language screen: the 11 codes with their native names, in languages.json order
const dlg = /LangDLL::LangDialog[^\n]*\n([\s\S]*?)\n\s*""\s*\n/.exec(langText);
ok(!!dlg, 'installer-lang.nsh has the LangDLL language list');
if (dlg) {
  const pairs = [...dlg[1].matchAll(/"([^"]+)" "([^"]+)"/g)].map(m => ({ native: m[1], code: m[2] }));
  ok(JSON.stringify(pairs.map(p => p.code)) === JSON.stringify(CODES), `language screen lists ${CODES.join(' ')} (has ${pairs.map(p => p.code).join(' ')})`);
  for (const p of pairs) {
    const l = langs.find(x => x.code === p.code);
    ok(l && l.native === p.native, `language screen shows ${p.code} as its native name ${l ? l.native : '?'} (has ${p.native})`);
  }
}
// every code is handled by the normalizer, the text loader and (where NSIS has it) the NSIS language
for (const code of CODES) {
  ok(new RegExp(`StrCpy \\$0 "${code}"`).test(langText), `mkNormCode returns ${code}`);
  if (code !== 'en') ok(new RegExp(`\\$\\{Case\\} "${code}"\\s*\\n\\s*!insertmacro ${macroOf(code)}\\b`).test(langText), `mkLoadStrings loads ${macroOf(code)} for ${code}`);
}
// package.json: the NSIS languages
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const nsis = (pkg.build && pkg.build.nsis) || {};
const WANT = ['en_US', 'zh_CN', 'ja_JP', 'ar_SA', 'sv_SE', 'es_ES', 'fr_FR', 'pt_BR'];
ok(nsis.multiLanguageInstaller === true, 'build.nsis.multiLanguageInstaller is true');
ok(JSON.stringify(nsis.installerLanguages) === JSON.stringify(WANT), `build.nsis.installerLanguages is ${WANT.join(' ')}`);
ok(nsis.displayLanguageSelector !== true, 'build.nsis.displayLanguageSelector is off (Markooj shows its own language screen)');

// ---------------------------------------------------------------- runtime test
function findMakensis() {
  if (process.env.MAKENSIS && fs.existsSync(process.env.MAKENSIS)) return process.env.MAKENSIS;
  const base = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'nsis');
  if (!fs.existsSync(base)) return null;
  const found = [];
  for (const d of fs.readdirSync(base)) {
    if (!/^nsis-\d/.test(d)) continue;
    for (const sub of ['', 'Bin']) {
      const f = path.join(base, d, sub, 'makensis.exe');
      if (fs.existsSync(f)) found.push(f);
    }
  }
  return found.sort().pop() || null;
}

function runtime() {
  if (process.platform !== 'win32') { console.log('runtime test skipped: needs Windows'); return; }
  const makensis = findMakensis();
  if (!makensis) { console.log('runtime test skipped: makensis not found (run electron-builder once, or set MAKENSIS)'); return; }
  console.log('installer languages: runtime test (' + makensis + ')');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-installer-lang-'));
  try {
    const NORM = [
      ...CODES.map(c => [c, c]),
      ...CODES.map(c => [c.toUpperCase(), c]),
      ...CODES.map(c => [c.replace('-', '_'), c]),
      ['zh', 'zh-CN'], ['zh-Hans', 'zh-CN'], ['pt', 'pt-BR'], ['pa-Arab', 'pnb'], ['ur-PK', 'ur'], ['en-GB', 'en'], ['ur-Roman', 'ur-Latn'],
      ['de', ''], ['', ''], ['zh-TW', ''], ['xx-YY', ''],
    ];
    const GUESS = [
      [0x0409, 'en'], [0x0809, 'en'], [0x0804, 'zh-CN'], [0x1004, 'zh-CN'], [0x0404, 'en'], [0x0C04, 'en'], [0x1404, 'en'],
      [0x0420, 'ur'], [0x0820, 'ur'], [0x0846, 'pnb'], [0x0446, 'en'], [0x0411, 'ja'], [0x0401, 'ar'], [0x0C01, 'ar'],
      [0x041D, 'sv'], [0x081D, 'sv'], [0x0C0A, 'es'], [0x080A, 'es'], [0x040C, 'fr'], [0x0C0C, 'fr'], [0x0416, 'pt-BR'],
      [0x0816, 'pt-BR'], [0x0407, 'de-falls-back'],
    ];
    const NSIS_LANG = { en: 1033, 'zh-CN': 2052, ur: 1033, 'ur-Latn': 1033, pnb: 1033, ja: 1041, ar: 1025, sv: 1053, es: 3082, fr: 1036, 'pt-BR': 1046 };
    const RTL = { ur: 1, pnb: 1, ar: 1 };
    const q = s => s.replace(/\$/g, '$$$$');
    const L = [];
    L.push('Unicode true', 'Name "mk-installer-lang-test"', `OutFile "${path.join(dir, 'test.exe')}"`, 'SilentInstall silent',
      'RequestExecutionLevel user', `!addincludedir "${BUILD}"`, '!include LogicLib.nsh',
      '!define VERSION "9.8.7"', '!define MK_SIZE_PANDOC "52 MB download, 240 MB on disk"', '!define MK_SIZE_DJVU "16 MB download, 38 MB on disk"',
      '!define MK_SIZE_PYTHON "7 MB download, 14 MB on disk"');
    for (const n of ['English', 'SimpChinese', 'Japanese', 'Arabic', 'Swedish', 'SpanishInternational', 'French', 'PortugueseBR']) {
      L.push(`LoadLanguageFile "\${NSISDIR}\\Contrib\\Language files\\${n}.nlf"`);
    }
    L.push('!include "installer-lang.nsh"', '!insertmacro mkLangVars', 'Var mkOut', '!insertmacro mkLangFunctions',
      '!macro W TEXT', '  FileWriteUTF16LE $mkOut "${TEXT}$\\n"', '!macroend',
      'Section', 'SectionEnd',
      'Function .onInit',
      '  FileOpen $mkOut "$EXEDIR\\result.txt" w');
    for (const [input] of NORM) {
      L.push(`  Push "${q(input)}"`, '  Call mkNormCode', '  Pop $1', `  !insertmacro W "norm|${q(input)}|$1"`);
    }
    for (const [id] of GUESS) {
      L.push(`  Push ${id}`, '  Call mkGuessCode', '  Pop $1', `  !insertmacro W "guess|${id}|$1"`);
    }
    for (const code of CODES) {
      L.push(`  StrCpy $mkLangCode "${code}"`, '  !insertmacro mkSetNsisLanguage', '  Call mkLoadStrings', '  Call mkIsRtlCode',
        `  !insertmacro W "lang|${code}|$LANGUAGE|$0|$mkLangCode"`);
      for (const k of enKeys) L.push(`  !insertmacro W "str|${code}|${k}|$mkS_${k}"`);
      L.push(`  !insertmacro mkFirstRunJson $2 '"pandoc","python"'`, `  !insertmacro W "json|${code}|$2"`);
    }
    L.push('  FileClose $mkOut', 'FunctionEnd', '');
    const nsi = path.join(dir, 'test.nsi');
    fs.writeFileSync(nsi, '﻿' + L.join('\r\n'), 'utf8');
    const c = spawnSync(makensis, ['-WX', '-V2', '-INPUTCHARSET', 'UTF8', nsi], { encoding: 'utf8' });
    ok(c.status === 0, 'test program compiles with warnings as errors' + (c.status === 0 ? '' : ':\n' + (c.stdout || '') + (c.stderr || '')));
    if (c.status !== 0) return;
    const r = spawnSync(path.join(dir, 'test.exe'), ['/S'], { cwd: dir, timeout: 30000, windowsHide: true });
    ok(r.status === 0, 'test program runs (exit ' + r.status + ')');
    const out = fs.readFileSync(path.join(dir, 'result.txt')).toString('utf16le').replace(/^﻿/, '');
    const rows = out.split('\n').filter(Boolean).map(s => s.split('|'));
    const get = (kind, a) => rows.filter(x => x[0] === kind && x[1] === a);
    for (const [input, want] of NORM) {
      const row = get('norm', input)[0];
      ok(row && row[2] === want, `/LANGUAGE=${input} → ${want || '(unknown)'} (got ${row ? row[2] || '(unknown)' : 'nothing'})`);
    }
    for (const [id, want] of GUESS) {
      const row = get('guess', String(id))[0];
      const w = want === 'de-falls-back' ? 'en' : want;
      ok(row && row[2] === w, `Windows display language 0x${id.toString(16).padStart(4, '0')} → ${w} (got ${row ? row[2] : 'nothing'})`);
    }
    let parseFirstRun = () => ({ valid: false, language: null, features: [], errors: ['main-features.js did not load'] });
    try { ({ parseFirstRun } = require(path.join(ROOT, 'main-features.js'))); } catch (e) {
      ok(false, 'main-features.js loads in plain Node for its parseFirstRun (' + e.message.split('\n')[0] + ')');
    }
    for (const code of CODES) {
      const lr = get('lang', code)[0];
      ok(lr && Number(lr[2]) === NSIS_LANG[code], `${code}: NSIS language ${NSIS_LANG[code]} (got ${lr ? lr[2] : 'nothing'})`);
      ok(lr && Number(lr[3]) === (RTL[code] || 0), `${code}: features page ${RTL[code] ? 'right to left' : 'left to right'}`);
      ok(lr && lr[4] === code, `${code}: texts loaded for ${code}`);
      const strs = Object.fromEntries(get('str', code).map(x => [x[2], x.slice(3).join('|')]));
      for (const k of enKeys) ok(strs[k] && strs[k].trim() && !strs[k].includes('${'), `${code}.${k} filled at run time`);
      ok(strs.pandoc && strs.pandoc.includes('52') && strs.pandoc.includes('240'), `${code}: Pandoc sizes come from features-sizes.nsh (${strs.pandoc})`);
      ok(strs.python && strs.python.includes('7') && strs.python.includes('14'), `${code}: Python sizes come from features-sizes.nsh`);
      const jr = get('json', code)[0];
      const line = jr ? jr.slice(2).join('|') : '';
      const parsed = parseFirstRun(line);
      ok(parsed.valid && parsed.language === code && parsed.errors.length === 0 && parsed.features.join() === 'pandoc,python',
        `${code}: first-run.json ${line} → Markooj reads language ${parsed.language}`);
      let j = null;
      try { j = JSON.parse(line); } catch (_) { /* reported above */ }
      ok(j && j.from === 'installer' && j.version === '9.8.7', `${code}: first-run.json has from and version`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (!ARGS.includes('--static')) runtime();
console.log(`${failures ? 'FAILED' : 'passed'}: ${passes} checks passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
