// Markooj — interface translations, main-process side (PLAN-v5 item 81). See docs/I18N.md and ARCHITECTURE.md
// "Interface translations (1.2.0)".
//
// main.js: const I18N = require('./main-i18n'); I18N.init({ getSettings, saveSetting, smokeDir, appRoot });
// then I18N.t('Copy'), I18N.tn('{count} files', n), I18N.language(), I18N.dir(), I18N.onChange(fn).
//
// The interface language is the setting `uiLanguage`; when it is empty: MARKOOJ_UI_LANGUAGE (developers), English in
// smoke runs, the installer's first-run.json, the first supported language in the system's preferred list, else English.
// The window gets its catalogs synchronously before any page script runs (sendSync 'i18n-boot'), so there is no English
// flash, and a switch in one window reaches every window ('i18n-changed').
/* i18n-aliases: t */
'use strict';
const { app, ipcMain, webContents } = require('electron');
const path = require('path');
const fs = require('fs');
const core = require('./src/i18n-core.js');

const PSEUDO = core.PSEUDO;
let ctx = { getSettings: () => ({}), saveSetting: null, smokeDir: null, appRoot: __dirname };
const LOCALES = () => path.join(ctx.appRoot || __dirname, 'locales');

// ---------- catalogs ----------
let langCache = null;
/** languages.json, plus the pseudo-locale 'qps' (shown only in Developer mode). */
function languages() {
  if (langCache) return langCache;
  let list = [];
  try { list = JSON.parse(fs.readFileSync(path.join(LOCALES(), 'languages.json'), 'utf8')).languages || []; }
  catch (e) { console.warn('[i18n] languages.json', e.message); }
  if (!list.find(l => l.code === 'en')) list.unshift({ code: 'en', name: 'English', native: 'English', dir: 'ltr', intl: 'en-US', plural: 'en', font: 'system', completeness: 100 });
  list = list.filter(l => l && typeof l.code === 'string').map(l => ({ dir: 'ltr', font: 'system', completeness: 0, ...l }));
  if (!list.find(l => l.code === PSEUDO)) list.push({ code: PSEUDO, name: 'Pseudo (testing)', native: 'Pšéûðö', dir: 'ltr', intl: 'en-US', plural: 'en', font: 'system', completeness: 100, developer: true });
  langCache = list;
  return list;
}
const info = code => languages().find(l => l.code === code) || null;
const supported = code => !!info(code);
const catCache = new Map();
/** {key: value} for one language: every locales/<code>/*.json merged (keys starting with @ are notes, not strings). */
function catalog(code) {
  if (!code || code === PSEUDO) return {};
  if (catCache.has(code)) return catCache.get(code);
  const dir = path.join(LOCALES(), code);
  const out = {};
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => /\.json$/i.test(f)).sort(); } catch {}
  for (const f of files) {
    try {
      const o = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, ''));
      if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (k[0] !== '@' && !(k in out)) out[k] = v;
    } catch (e) { console.warn(`[i18n] ${code}/${f}: ${e.message}`); }
  }
  catCache.set(code, out);
  return out;
}
function reload() { langCache = null; catCache.clear(); translator = null; }

// ---------- which language ----------
/** 'zh-Hans-CN' / 'pt-PT' / 'ur-IN' / 'pa-Arab-PK' → a supported code, or null. Pure apart from languages(). */
function matchLanguage(tag) {
  const t = String(tag || '').trim().replace(/_/g, '-');
  if (!t) return null;
  const lower = t.toLowerCase();
  const codes = languages().filter(l => !l.developer).map(l => l.code);
  const exact = codes.find(c => c.toLowerCase() === lower);
  if (exact) return exact;
  const parts = lower.split('-');
  const base = parts[0];
  if (base === 'zh') return parts.includes('hant') || parts.includes('tw') || parts.includes('hk') || parts.includes('mo') ? null : (codes.includes('zh-CN') ? 'zh-CN' : null);
  if (base === 'pt') return codes.includes('pt-BR') ? 'pt-BR' : null;
  if (base === 'pnb' || (base === 'pa' && (parts.includes('arab') || parts.includes('pk')))) return codes.includes('pnb') ? 'pnb' : null;
  if (base === 'ur') return parts.includes('latn') && codes.includes('ur-Latn') ? 'ur-Latn' : codes.includes('ur') ? 'ur' : null;
  if (base === 'pa') return null; // Gurmukhi Punjabi is not translated
  return codes.find(c => c.toLowerCase() === base) || codes.find(c => c.toLowerCase().split('-')[0] === base) || null;
}
function systemLanguages() {
  try { const l = app.getPreferredSystemLanguages(); if (Array.isArray(l) && l.length) return l; } catch {}
  try { return [app.getSystemLocale()]; } catch {}
  return [];
}
function firstRunLanguage() {
  const f = process.env.MARKOOJ_FIRST_RUN ? path.resolve(process.env.MARKOOJ_FIRST_RUN) : app.isPackaged ? path.join(process.resourcesPath, 'first-run.json') : null;
  if (!f) return null;
  try { const o = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); return matchLanguage(o && o.language); } catch { return null; }
}
const settingValue = () => { try { const v = (ctx.getSettings() || {}).uiLanguage; return typeof v === 'string' ? v.trim() : ''; } catch { return ''; } };
/** {code, source: 'setting'|'env'|'smoke'|'installer'|'system'|'default'} */
function resolve() {
  const s = settingValue();
  if (s && supported(s)) return { code: s, source: 'setting' };
  const env = process.env.MARKOOJ_UI_LANGUAGE;
  if (env && supported(env)) return { code: env, source: 'env' };
  if (ctx.smokeDir) return { code: 'en', source: 'smoke' }; // tests read English unless they switch on purpose
  const fr = firstRunLanguage();
  if (fr) return { code: fr, source: 'installer' };
  for (const tag of systemLanguages()) { const m = matchLanguage(tag); if (m) return { code: m, source: 'system' }; }
  return { code: 'en', source: 'default' };
}

// ---------- the main process's own translator ----------
let current = null, translator = null;
const listeners = new Set();
function ensure() {
  if (!current) current = resolve();
  if (!translator || translator.code !== current.code) {
    const L = info(current.code) || {};
    translator = core.createTranslator({ code: current.code, entries: catalog(current.code), en: catalog('en'), plural: L.plural, intl: L.intl });
  }
  return translator;
}
const t = (text, vars) => ensure().t(text, vars);
const tn = (text, count, vars) => ensure().tn(text, count, vars);
const language = () => { ensure(); return current.code; };
const dir = () => ((info(language()) || {}).dir === 'rtl' ? 'rtl' : 'ltr');
function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
/** Switch main's language ('' = automatic) and tell every other window. Returns the new code. */
function setLanguage(code, { from } = {}) {
  const want = code == null ? '' : String(code).trim();
  if (want && !supported(want)) throw new Error(t('Choose one of the listed interface languages. “{code}” is not one of them.', { code: want.slice(0, 20) }));
  if (ctx.saveSetting) { try { ctx.saveSetting('uiLanguage', want); } catch (e) { console.warn('[i18n] save', e.message); } }
  if (!app.isPackaged) catCache.clear(); // development: pick up edited catalogs on every switch
  const prev = current && current.code;
  current = want ? { code: want, source: 'setting' } : null;
  ensure();
  for (const wc of webContents.getAllWebContents()) {
    if (wc === from || wc.isDestroyed() || wc.getType() !== 'window') continue;
    try { wc.send('i18n-changed', { language: current.code, setting: want }); } catch {}
  }
  if (prev !== current.code) for (const fn of [...listeners]) { try { fn(current.code, prev); } catch (e) { console.error('[i18n] onChange', e); } }
  return current.code;
}
/** What the window needs to draw in a language, synchronously. */
function payload(code) {
  const c = supported(code) ? code : 'en';
  return { language: c, info: info(c), entries: c === 'en' ? {} : catalog(c), en: catalog('en') };
}

function init(o = {}) {
  ctx = { ...ctx, ...o };
  // synchronous, before any page script: the window never draws English first
  ipcMain.on('i18n-boot', e => {
    try {
      const r = ensure() && current;
      e.returnValue = { ...payload(r.code), setting: settingValue(), source: r.source, languages: languages(), system: systemLanguages(), smoke: !!ctx.smokeDir };
    } catch (err) { e.returnValue = { error: String(err && err.message || err) }; }
  });
  ipcMain.on('i18n-catalog', (e, code) => { try { e.returnValue = payload(String(code || '')); } catch (err) { e.returnValue = { error: String(err && err.message || err) }; } });
  ipcMain.handle('i18n-set', (e, code) => ({ language: setLanguage(code, { from: e.sender }), setting: settingValue() }));
  ipcMain.handle('i18n-info', () => ({ language: language(), setting: settingValue(), source: current && current.source, dir: dir(), system: systemLanguages(), languages: languages() }));
  // main's own t(): native menus, dialogs, notifications (and the smoke test that checks them)
  ipcMain.handle('i18n-t', (_e, text, vars) => t(String(text == null ? '' : text), vars && typeof vars === 'object' ? vars : undefined));
  ipcMain.handle('i18n-match', (_e, tags) => (Array.isArray(tags) ? tags : [tags]).map(matchLanguage));
  ipcMain.handle('i18n-smoke-write', (_e, name, data) => {
    if (!ctx.smokeDir) throw new Error('Only available in a test run.');
    const file = path.join(ctx.smokeDir, String(name || 'i18n').replace(/[^\w.-]/g, '_') + '.json');
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return file;
  });
  return module.exports;
}

module.exports = { init, t, tn, language, dir, onChange, setLanguage, languages, catalog, matchLanguage, resolve, reload, info };
