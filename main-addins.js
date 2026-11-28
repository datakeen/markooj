// Markooj — add-in store (main process). Owner: store. Required from main.js like main-langpacks.js.
//
// The registry (datakeen/markooj-addins) publishes one file, index.json, as an asset of its GitHub release with the tag
// `index`. Each entry points at an add-in author's own GitHub release: manifest.json + main.js (+ styles.css, + extra data
// files the manifest lists). Markooj downloads those assets, checks each SHA-256 and size against the index, checks the
// manifest, and only then moves the finished folder into <userData>/addons/<id>/ (portable copies: data/addons/<id>/,
// because main.js points userData at the data folder before this file is loaded).
//
// IPC (all through the generic mk.invoke):
//   addins-index({refresh})   → {format, updated, addins:[…normalized entries], source:'github'|'cache', fetchedAt, offline?, error?}
//   addins-readme(id | url)   → README text (≤ 512 KB, raw.githubusercontent.com only)
//   addins-install({id})      → {id, name, version, dir, updated:boolean, previous}
//   addins-uninstall(id)      → true (store-installed folders only; moved to the trash)
//   addins-installed()        → [{id, name, version, author, source, verified, installedAt, latest, update, compatible, minMarkooj}]
//   addins-update-all()       → {updated:[{id, version}], failed:[{id, error}]}
//   addins-folder-list()      → [{id, dir, manifest, code, css, install, error?}] folder add-ins for src/addons.js
//   addins-file(id, name, {encoding}) → text (utf8 or base64) of one data file a folder add-in's manifest lists
//   addins-test-mock(o)       → smoke mode only: {index, files:{url: base64}, offline} answers downloads without the network
//   addins-test-template()    → smoke mode, development copies only: the markooj-addin-template sample as {index, files} or null
'use strict';
const { app, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const I18N = require('./main-i18n'); // interface translations: messages and action labels in the interface language

const OWNER = 'datakeen';
const INDEX_URL = `https://github.com/${OWNER}/markooj-addins/releases/download/index/index.json`;
const DOWNLOAD_HOSTS = new Set(['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com', 'github-releases.githubusercontent.com']);
const README_HOSTS = new Set(['raw.githubusercontent.com']);
const TIMEOUT = 15000;
const MAX_INDEX = 4 * 1024 * 1024;
const MAX_README = 512 * 1024;
const MAX_MANIFEST = 64 * 1024;
// the same limits as the registry's checks (markooj-addins tools/lib.js LIMITS)
const MAX_MAIN = 2 * 1024 * 1024;
const MAX_CSS = 2 * 1024 * 1024;
const MAX_TOTAL = 50 * 1024 * 1024;
const MAX_FILES = 50;
const ID_RE = /^[a-z0-9-]{3,40}$/;
// owner/name; never "." or ".." as the name, which a URL would resolve to another path on github.com
const REPO_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/(?!\.\.?$)[A-Za-z0-9._-]{1,100}$/;
const SEMVER_RE = /^(\d{1,6})\.(\d{1,6})\.(\d{1,6})(?:-([0-9A-Za-z.-]{1,40}))?(?:\+[0-9A-Za-z.-]{1,40})?$/;
const SHA_RE = /^[0-9a-f]{64}$/i;
// a plain file name: no folders, no trailing dot, never a Windows device name (con, nul.txt, com1 …)
const FILE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const FILE_RE = { test: n => FILE_NAME_RE.test(String(n)) && !/\.$/.test(String(n)) && !/^(?:con|prn|aux|nul|com\d|lpt\d)(?:\..*)?$/i.test(String(n)) };
const RESERVED = new Set(['manifest.json', 'main.js', 'styles.css', '.install.json']);
const CATEGORIES = ['writing', 'research', 'math', 'languages', 'export', 'productivity', 'developer', 'fun', 'other'];
const SMOKE = process.argv.includes('--smoke');

const addonsDir = () => path.join(app.getPath('userData'), 'addons');
const cacheFile = () => path.join(app.getPath('userData'), 'addins-index.json');
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
// Messages lead with what to do (main.js errorForIpc sends actions and details to the window; see mk.errorInfo).
function plain(msg, actions, details) { const e = new Error(msg); e.plain = true; if (actions && actions.length) e.actions = actions; if (details) e.details = String(details).slice(0, 4000); return e; }
// action labels are made when the message is made (the interface language can change while Markooj runs)
const retryAct = () => ({ id: 'retry', label: I18N.t('Try again') });
const getMarkoojAct = () => ({ id: 'open-url', label: I18N.t('Get the newest Markooj'), url: 'https://datakeen.github.io/markooj/#download' });
// an add-in that fails a check: what to do, that nothing changed, then the reason (kept for the details and the tests)
function badAddin(why) {
  const reason = String(why).replace(/\.$/, '');
  return plain(I18N.t('Try again later, or tell the add-in’s author (its project page has the address). This add-in did not pass Markooj’s checks, so nothing was installed and Markooj is unchanged.'), [{ id: 'copy-details', label: I18N.t('Copy details'), text: reason }], reason);
}
const offlineText = () => I18N.t('Check your internet connection, then try again. You seem to be offline: Markooj can’t reach GitHub.');

// ---------- versions ----------
function parseSemver(v) {
  const m = SEMVER_RE.exec(String(v || '').trim());
  return m ? { n: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] || '' } : null;
}
/** -1, 0 or 1; a version with a pre-release tag comes before the plain one. Unreadable versions sort first. */
function compareVersions(a, b) {
  const x = parseSemver(a), y = parseSemver(b);
  if (!x || !y) return !x && !y ? 0 : !x ? -1 : 1;
  for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] < y.n[i] ? -1 : 1;
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1; if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}
const appVersion = () => app.getVersion();

// ---------- downloads ----------
let mock = null; // smoke mode only: {index, files: Map(url → Buffer), offline}

function offline(e) {
  if (e && e.plain) return e;
  const c = e && e.code;
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|ECONNRESET|ETIMEDOUT/.test(String(c))) return plain(offlineText(), [retryAct()], String(c));
  return plain(I18N.t('Check your internet connection, then try again. The download stopped before it finished.'), [retryAct()], String((e && (e.code || e.message)) || e));
}
/** GET over https with a timeout and a size cap, following redirects only to the allowed hosts. */
function httpsGet(url, { hosts = DOWNLOAD_HOSTS, max = MAX_TOTAL, redirects = 5, notFound = I18N.t('Try again later, or refresh the add-in list. The file is not on GitHub right now.'), tooBig = I18N.t('Try another add-in, or tell its author: the download is larger than an add-in can be, so Markooj stopped it.') } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch { return reject(plain(I18N.t('Choose the add-in again from File → Add-ins → Browse. This download address is not valid.'))); }
    if (u.protocol !== 'https:' || !hosts.has(u.hostname)) return reject(plain(I18N.t('Open the add-in’s project page in your browser instead. Add-ins only download from GitHub (this address is on {host}).', { host: u.hostname || I18N.t('no host') })));
    if (mock) {
      if (mock.offline) return reject(plain(offlineText(), [retryAct()]));
      const buf = mock.files.get(u.href);
      if (!buf) return reject(plain(notFound));
      if (buf.length > max) return reject(plain(tooBig));
      return resolve(buf);
    }
    const req = https.get(u, { headers: { 'User-Agent': 'Markooj add-ins', Accept: 'application/octet-stream, application/json, text/plain' }, timeout: TIMEOUT }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects <= 0) return reject(plain(I18N.t('Try again in a few minutes. GitHub did not send the download this time.'), [retryAct()], 'too many redirects'));
        return resolve(httpsGet(new URL(res.headers.location, u).href, { hosts, max, redirects: redirects - 1, notFound, tooBig }));
      }
      if (res.statusCode === 404) { res.resume(); return reject(plain(notFound)); }
      if (res.statusCode !== 200) { res.resume(); return reject(plain(I18N.t('Try again in a few minutes. GitHub is not answering normally right now.'), [retryAct()], `HTTP ${res.statusCode} for ${u.href}`)); }
      const len = Number(res.headers['content-length'] || 0);
      if (len > max) { res.destroy(); return reject(plain(tooBig)); }
      const chunks = []; let got = 0;
      res.on('data', c => { got += c.length; if (got > max) { res.destroy(); reject(plain(tooBig)); } else chunks.push(c); });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', e => reject(offline(e)));
    });
    req.on('timeout', () => { req.destroy(); reject(plain(I18N.t('Check your internet connection, then try again. GitHub did not answer in time.'), [retryAct()])); });
    req.on('error', e => reject(offline(e)));
  });
}

// ---------- the index ----------
const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max) : '');
const httpsUrl = v => { try { const u = new URL(String(v)); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
/** The release download address an asset must have: https://github.com/<owner>/<repo>/releases/download/<tag>/<name> */
const assetUrl = (repo, tag, name) => `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
function normalizeEntry(e) {
  if (!e || typeof e !== 'object') return null;
  const id = String(e.id || '');
  const repo = String(e.repo || '');
  const tag = String(e.tag || '');
  if (!ID_RE.test(id) || !REPO_RE.test(repo) || !tag || tag.length > 100 || /[\s/\\]/.test(tag)) return null;
  if (!parseSemver(e.version) || (e.minMarkooj != null && !parseSemver(e.minMarkooj))) return null;
  const assets = [];
  for (const a of Array.isArray(e.assets) ? e.assets : []) {
    if (!a || !FILE_RE.test(String(a.name || '')) || !SHA_RE.test(String(a.sha256 || ''))) continue;
    const url = assetUrl(repo, tag, a.name);
    // the address is rebuilt from repo + tag + name, so an index can never send Markooj to another repository
    if (String(a.url || '') && String(a.url).toLowerCase() !== url.toLowerCase()) continue;
    const size = Number(a.size);
    if (!Number.isFinite(size) || size < 0 || size > MAX_TOTAL) continue;
    assets.push({ name: a.name, url, size: Math.floor(size), sha256: String(a.sha256).toLowerCase() });
  }
  if (!assets.some(a => a.name === 'manifest.json') || !assets.some(a => a.name === 'main.js')) return null;
  const readme = `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(tag)}/README.md`;
  const given = String(e.readmeUrl || '');
  // checked after the URL is resolved, so ../ can never point it at another repository's README
  let readmeOk = false;
  try { const u = new URL(given); readmeOk = u.protocol === 'https:' && u.hostname === 'raw.githubusercontent.com' && !u.username && !u.password && u.pathname.toLowerCase().startsWith(`/${repo.toLowerCase()}/`) && !/%2e|%2f|%5c/i.test(u.pathname); } catch {}
  const category = CATEGORIES.includes(String(e.category)) ? String(e.category) : 'other';
  return {
    id, name: str(e.name, 80) || id, author: str(e.author, 100), description: str(e.description, 300), repo, category,
    tags: (Array.isArray(e.tags) ? e.tags : []).map(t => str(t, 30).toLowerCase()).filter(Boolean).slice(0, 12),
    // the check mark means "made by the Markooj team": worked out here from the repository owner, never trusted from the list
    verified: repo.split('/')[0].toLowerCase() === OWNER,
    version: String(e.version), minMarkooj: e.minMarkooj ? String(e.minMarkooj) : '0.0.0', tag, assets,
    size: assets.reduce((n, a) => n + a.size, 0),
    readmeUrl: readmeOk ? new URL(given).href : readme, homepage: httpsUrl(e.homepage) || `https://github.com/${repo}`,
    // the author's note when the add-in does more than edit the open document (such as using the internet), shown on its page
    permissions: str(e.permissions, 300),
    updatedAt: str(e.updatedAt, 40), icon: /^[a-z0-9-]{1,40}$/.test(String(e.icon || '')) ? String(e.icon) : '', color: /^#[0-9a-f]{3,8}$/i.test(String(e.color || '')) ? String(e.color) : '',
  };
}
function normalizeIndex(o) {
  const list = Array.isArray(o && o.addins) ? o.addins : [];
  const seen = new Set(); const addins = [];
  for (const e of list) { const n = normalizeEntry(e); if (n && !seen.has(n.id)) { seen.add(n.id); addins.push(n); } }
  addins.sort((a, b) => a.name.localeCompare(b.name));
  return { format: Number(o && o.format) || 1, updated: (o && typeof o.updated === 'string' && o.updated) || null, addins };
}
let cachedIndex = null; // {…normalized, source, fetchedAt}
function readCache() {
  try { const o = JSON.parse(fs.readFileSync(cacheFile(), 'utf8')); return { ...normalizeIndex(o.index || o), fetchedAt: Number(o.fetchedAt) || 0 }; } catch { return null; }
}
async function fetchIndex() {
  const buf = await httpsGet(INDEX_URL, { max: MAX_INDEX, notFound: I18N.t('Check again later: no add-ins are listed on GitHub yet.'), tooBig: I18N.t('Try again later: the add-in list from GitHub is larger than expected.') });
  let o; try { o = JSON.parse(buf.toString('utf8').replace(/^﻿/, '')); } catch { throw plain(I18N.t('Try again in a few minutes. The add-in list from GitHub could not be read.'), [retryAct()]); }
  if (!o || typeof o !== 'object' || Number(o.format) > 1) throw plain(I18N.t('Update Markooj to browse add-ins: the add-in list on GitHub needs a newer Markooj. Your installed add-ins keep working.'), [getMarkoojAct()]);
  const fetchedAt = Date.now();
  cachedIndex = { ...normalizeIndex(o), source: 'github', fetchedAt };
  // the last good list stays on disk, so the store can still be browsed offline
  try { fs.mkdirSync(path.dirname(cacheFile()), { recursive: true }); const tmp = cacheFile() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ fetchedAt, index: o })); fs.renameSync(tmp, cacheFile()); } catch {}
  return cachedIndex;
}
/** The list: fresh from GitHub when asked (or older than 10 minutes), else the copy in memory; offline, the copy on disk. */
async function getIndex({ refresh = false } = {}) {
  if (!refresh && cachedIndex && Date.now() - cachedIndex.fetchedAt < 10 * 60 * 1000) return cachedIndex;
  try { return await fetchIndex(); }
  catch (e) {
    const disk = cachedIndex || readCache();
    if (disk) return { ...disk, source: 'cache', offline: true, error: e.message };
    throw e;
  }
}
/** The index to install from: memory, then disk, then GitHub. */
async function indexForInstall() {
  if (cachedIndex) return cachedIndex;
  const disk = readCache(); if (disk) { cachedIndex = { ...disk, source: 'cache' }; return cachedIndex; }
  return getIndex({ refresh: true });
}

// ---------- manifests ----------
/** Check an add-in's manifest.json; returns a clean copy or throws a plain error. */
function checkManifest(m, entry) {
  const bad = why => badAddin(`The add-in’s manifest is not valid: ${why}`);
  if (!m || typeof m !== 'object' || Array.isArray(m)) throw bad('not an object');
  if (!ID_RE.test(String(m.id || ''))) throw bad('id must be 3–40 lowercase letters, digits or dashes');
  if (entry && m.id !== entry.id) throw bad(`its id “${String(m.id).slice(0, 40)}” is not “${entry.id}”`);
  if (!str(m.name, 200) || String(m.name).length > 80) throw bad('name');
  if (!parseSemver(m.version)) throw bad('version must look like 1.2.0');
  if (entry && compareVersions(m.version, entry.version) !== 0) throw bad(`version ${String(m.version).slice(0, 20)} is not ${entry.version} as listed`);
  if (!parseSemver(m.minMarkooj)) throw bad('minMarkooj must look like 1.1.0');
  if (!str(m.author, 200) || String(m.author).length > 100) throw bad('author');
  if (typeof m.description !== 'string' || m.description.length > 500) throw bad('description');
  if (m.authorUrl != null && m.authorUrl !== '' && !httpsUrl(m.authorUrl)) throw bad('authorUrl must be an https address');
  if (m.icon != null && m.icon !== '' && !/^[a-z0-9-]{1,40}$/.test(String(m.icon))) throw bad('icon');
  if (m.color != null && m.color !== '' && !/^#[0-9a-f]{3,8}$/i.test(String(m.color))) throw bad('color');
  if (m.category != null && !CATEGORIES.includes(String(m.category))) throw bad('category');
  const files = [];
  if (m.files != null) {
    if (!Array.isArray(m.files) || m.files.length > MAX_FILES) throw bad(`files must be a list of at most ${MAX_FILES}`);
    for (const f of m.files) {
      const name = String(f && f.name || '');
      if (!FILE_RE.test(name) || RESERVED.has(name.toLowerCase())) throw bad(`file name “${name.slice(0, 60)}”`);
      if (files.some(x => x.name.toLowerCase() === name.toLowerCase())) throw bad(`file “${name}” is listed twice`);
      if (f.size != null && !(Number.isFinite(Number(f.size)) && Number(f.size) >= 0 && Number(f.size) <= MAX_TOTAL)) throw bad(`size of ${name}`);
      files.push({ name, ...(f.size != null ? { size: Number(f.size) } : {}) });
    }
  }
  const total = files.reduce((n, f) => n + (f.size || 0), 0);
  if (total > MAX_TOTAL) throw bad('its files add up to more than 50 MB');
  return {
    id: m.id, name: str(m.name, 80), version: String(m.version), minMarkooj: String(m.minMarkooj), author: str(m.author, 100),
    ...(httpsUrl(m.authorUrl) ? { authorUrl: httpsUrl(m.authorUrl) } : {}), description: str(m.description, 500),
    ...(m.icon ? { icon: String(m.icon) } : {}), ...(m.color ? { color: String(m.color) } : {}), ...(m.category ? { category: String(m.category) } : {}),
    files,
  };
}

// ---------- installing ----------
function readInstall(dir) { try { const o = JSON.parse(fs.readFileSync(path.join(dir, '.install.json'), 'utf8')); return o && typeof o === 'object' ? o : null; } catch { return null; } }
function readManifest(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8').replace(/^﻿/, '')); } catch { return null; } }
function folderOf(id) {
  if (!ID_RE.test(String(id || ''))) throw plain(I18N.t('Choose the add-in from File → Add-ins. Markooj does not know this one.'));
  const dir = path.join(addonsDir(), String(id));
  if (path.dirname(dir) !== addonsDir()) throw plain(I18N.t('Choose the add-in from File → Add-ins. Markooj does not know this one.'));
  return dir;
}
const busy = new Set();
async function install(id) {
  const target = folderOf(id);
  if (busy.has(id)) throw plain(I18N.t('Wait a moment: that add-in is already being installed.'));
  busy.add(id);
  try {
    const idx = await indexForInstall();
    const entry = idx.addins.find(a => a.id === id);
    if (!entry) throw plain(I18N.t('Refresh File → Add-ins → Browse and choose the add-in again. It is not in the list on GitHub any more.'), [retryAct()]);
    if (compareVersions(entry.minMarkooj, appVersion()) > 0) throw plain(I18N.t('Update Markooj, then install “{name}” again: it needs Markooj {needed} or newer (this is {version}).', { name: entry.name, needed: entry.minMarkooj, version: appVersion() }), [getMarkoojAct()]);
    // a folder add-in wins over a file with the same id, so a community add-in must never take the place of one that
    // comes with Markooj (readability, word-frequency, si-units …)
    if (!entry.verified && fs.existsSync(path.join(__dirname, 'addons', id + '.js'))) throw plain(I18N.t('Use the “{id}” add-in that comes with Markooj (File → Add-ins → Installed). “{name}” has the same name, so it was not installed.', { id, name: entry.name }));
    const prev = fs.existsSync(target) ? readInstall(target) : null;
    if (fs.existsSync(target) && (!prev || prev.source !== 'store')) throw plain(I18N.t('Rename or remove your own “{id}” folder in the add-ins folder first, then try again. It did not come from the store, so Markooj left it alone.', { id }), [retryAct()]);
    const fetchAsset = async (a, max) => {
      if (a.size > max) throw badAddin(`${a.name} is larger than an add-in file can be`);
      // never more bytes than the list says (a file swapped on GitHub after the list was built stops downloading there)
      const buf = await httpsGet(a.url, { max: Math.min(max, a.size), notFound: I18N.t('Try again later, or tell the add-in’s author. “{name}” {version} is not complete on GitHub right now, so nothing was installed.', { name: entry.name, version: entry.version }) });
      if (buf.length !== a.size) throw plain(I18N.t('Try again: {file} did not arrive complete (it is not the size the list says). Nothing was installed.', { file: a.name }), [retryAct()]);
      if (sha256(buf) !== a.sha256) throw plain(I18N.t('Try again later, or tell the add-in’s author. This copy of “{name}” did not pass Markooj’s safety check, so nothing was installed.', { name: entry.name }), [retryAct()], `${a.name}: SHA-256 does not match the list`);
      return buf;
    };
    // 1. the manifest decides what else is needed
    const ma = entry.assets.find(a => a.name === 'manifest.json');
    const mbuf = await fetchAsset(ma, MAX_MANIFEST);
    let raw; try { raw = JSON.parse(mbuf.toString('utf8').replace(/^﻿/, '')); } catch { throw badAddin('The add-in’s manifest could not be read'); }
    const manifest = checkManifest(raw, entry);
    if (compareVersions(manifest.minMarkooj, appVersion()) > 0) throw plain(I18N.t('Update Markooj, then install “{name}” again: it needs Markooj {needed} or newer (this is {version}).', { name: entry.name, needed: manifest.minMarkooj, version: appVersion() }), [getMarkoojAct()]);
    // 2. main.js, styles.css and the data files the manifest lists, each checked against the list
    const want = [['main.js', MAX_MAIN, true], ['styles.css', MAX_CSS, false], ...manifest.files.map(f => [f.name, MAX_TOTAL, true])];
    const out = [['manifest.json', mbuf]]; let total = mbuf.length;
    for (const [name, max, required] of want) {
      const a = entry.assets.find(x => x.name === name);
      if (!a) { if (required) throw badAddin(`The release of “${entry.name}” has no ${name}`); continue; }
      const f = manifest.files.find(x => x.name === name);
      if (f && f.size != null && a.size && f.size !== a.size) throw badAddin(`${name} is not the size its manifest says`);
      total += a.size; if (total > MAX_TOTAL) throw badAddin('The add-in is larger than 50 MB');
      out.push([name, await fetchAsset(a, max)]);
    }
    // 3. write a temporary folder, then swap it in
    const root = addonsDir(); fs.mkdirSync(root, { recursive: true });
    const tmp = path.join(root, `.tmp-${id}-${crypto.randomBytes(4).toString('hex')}`);
    const old = path.join(root, `.old-${id}-${crypto.randomBytes(4).toString('hex')}`);
    const info = { source: 'store', id, version: manifest.version, repo: entry.repo, tag: entry.tag, verified: entry.verified, sha256s: Object.fromEntries(out.map(([n, b]) => [n, sha256(b)])), installedAt: new Date().toISOString() };
    fs.mkdirSync(tmp, { recursive: true });
    try {
      for (const [name, buf] of out) fs.writeFileSync(path.join(tmp, name), buf);
      fs.writeFileSync(path.join(tmp, '.install.json'), JSON.stringify(info, null, 2));
      const had = fs.existsSync(target);
      // checked again here: a folder the user put there during the download is never moved aside and deleted
      if (had) { const now = readInstall(target); if (!now || now.source !== 'store') throw plain(I18N.t('Rename or remove your own “{id}” folder in the add-ins folder first, then try again. It did not come from the store, so Markooj left it alone.', { id }), [retryAct()]); }
      if (had) fs.renameSync(target, old);
      try { fs.renameSync(tmp, target); }
      catch (e) { if (had) { try { fs.renameSync(old, target); } catch {} } throw e; }
      if (had) fs.rm(old, { recursive: true, force: true }, () => {});
    } catch (e) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} throw e.plain ? e : plain(I18N.t('Free some disk space or close other programs, then try again. The add-in could not be saved; nothing was installed.'), [retryAct()], `${e.code || ''} ${e.message}`.trim()); }
    return { id, name: manifest.name, version: manifest.version, dir: target, updated: !!prev, previous: prev ? prev.version || null : null };
  } finally { busy.delete(id); }
}

async function uninstall(id) {
  const dir = folderOf(id);
  if (!fs.existsSync(dir)) throw plain(I18N.t('Refresh File → Add-ins → Installed: that add-in is not installed any more.'));
  const info = readInstall(dir);
  if (!info || info.source !== 'store') throw plain(I18N.t('Delete this add-in from the add-ins folder yourself (File → Add-ins → Open folder). Only add-ins installed from the store can be removed here.'));
  // a test run never fills the real trash
  if (SMOKE) { fs.rmSync(dir, { recursive: true, force: true }); return true; }
  try { await shell.trashItem(dir); return true; }
  catch {
    // no trash on this system: keep a copy aside rather than deleting it for good
    const aside = path.join(app.getPath('userData'), 'addons-removed', `${id}-${Date.now()}`);
    fs.mkdirSync(path.dirname(aside), { recursive: true });
    fs.renameSync(dir, aside);
    return true;
  }
}

function listFolders() {
  const root = addonsDir(); const out = [];
  let names = []; try { names = fs.readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const d of names) {
    if (!d.isDirectory() || d.name.startsWith('.') || !ID_RE.test(d.name)) continue;
    const dir = path.join(root, d.name);
    const m = readManifest(dir);
    if (!m) continue;
    out.push({ id: d.name, dir, manifest: m, install: readInstall(dir) });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
async function listInstalled() {
  let idx = cachedIndex || readCache();
  const out = [];
  for (const f of listFolders()) {
    const m = f.manifest || {}; const src = f.install && f.install.source === 'store' ? 'store' : 'folder';
    const e = idx ? idx.addins.find(a => a.id === f.id) : null;
    const version = String(m.version || (f.install && f.install.version) || '');
    const update = !!(src === 'store' && e && compareVersions(e.version, version) > 0);
    out.push({ id: f.id, name: String(m.name || f.id), version, author: String(m.author || ''), source: src,
      verified: !!(f.install && f.install.verified), installedAt: (f.install && f.install.installedAt) || null,
      latest: e ? e.version : null, update, compatible: !e || compareVersions(e.minMarkooj, appVersion()) <= 0, minMarkooj: e ? e.minMarkooj : String(m.minMarkooj || '') });
  }
  return out;
}

// ---------- IPC ----------
ipcMain.handle('addins-index', (_e, o = {}) => getIndex({ refresh: !!(o && o.refresh) }));
ipcMain.handle('addins-readme', async (_e, ref) => {
  let url = '';
  if (ref && typeof ref === 'object' && ref.id) { const idx = await indexForInstall(); const e = idx.addins.find(a => a.id === ref.id); if (!e) throw plain(I18N.t('Refresh File → Add-ins → Browse and choose the add-in again. It is not in the list any more.'), [retryAct()]); url = e.readmeUrl; }
  else url = String((ref && ref.url) || ref || '');
  const buf = await httpsGet(url, { hosts: README_HOSTS, max: MAX_README, redirects: 0, notFound: I18N.t('Open the project page for details: this add-in has no README yet.'), tooBig: I18N.t('Open the project page to read about this add-in: its README is too long to show here.') });
  return buf.toString('utf8').replace(/^﻿/, '');
});
ipcMain.handle('addins-install', (_e, o = {}) => install(String((o && o.id) || o || '')));
ipcMain.handle('addins-uninstall', (_e, id) => uninstall(String(id || '')));
ipcMain.handle('addins-installed', () => listInstalled());
ipcMain.handle('addins-update-all', async () => {
  try { await getIndex({ refresh: true }); } catch {}
  const updated = [], failed = [];
  for (const a of await listInstalled()) {
    if (!a.update || !a.compatible) continue;
    try { const r = await install(a.id); updated.push({ id: a.id, version: r.version, previous: r.previous }); }
    catch (e) { failed.push({ id: a.id, error: e.message }); }
  }
  return { updated, failed };
});
ipcMain.handle('addins-folder-list', () => listFolders().map(f => {
  const read = (n, max) => { try { const p = path.join(f.dir, n); const st = fs.statSync(p); if (st.size > max) return null; return fs.readFileSync(p, 'utf8').replace(/^﻿/, ''); } catch { return null; } };
  const code = read('main.js', MAX_MAIN);
  return { id: f.id, dir: f.dir, manifest: f.manifest, install: f.install, code: code || '', css: read('styles.css', MAX_CSS) || '', error: code == null ? 'Add a main.js (at most 2 MB) to this add-in folder, then reload. It is missing or too large.' : null };
}));
ipcMain.handle('addins-file', (_e, id, name, opts = {}) => {
  const dir = folderOf(id);
  const m = readManifest(dir) || {};
  const n = String(name || '');
  const listed = Array.isArray(m.files) && m.files.some(f => f && f.name === n);
  if (!listed || !FILE_RE.test(n)) throw plain(I18N.t('List “{file}” in the add-in’s manifest (files) to read it. The manifest does not list a file with that name.', { file: n.slice(0, 60) }));
  const p = path.join(dir, n);
  if (path.dirname(p) !== dir) throw plain(I18N.t('Use a plain file name with letters, digits, dots and dashes. This file name is not safe.'));
  const buf = fs.readFileSync(p);
  return opts && opts.encoding === 'base64' ? buf.toString('base64') : buf.toString('utf8');
});
/** Smoke mode, development copies only: the sample add-in of a markooj-addin-template checkout next to the app folder
 *  (or $MARKOOJ_ADDIN_TEMPLATE), as a pretend GitHub release listed the way the registry's build-index.js lists it
 *  (name, description, category and tags from a markooj-addins checkout's community-addins.json when there is one).
 *  Returns {index, files:{url: base64}, dir} for addins-test-mock, or null. */
function templateRelease() {
  if (app.isPackaged) return null;
  const parent = path.dirname(__dirname);
  const find = (re, env, need) => {
    const cands = env ? [env] : [];
    try { for (const n of fs.readdirSync(parent)) if (re.test(n)) cands.push(path.join(parent, n)); } catch {}
    return cands.find(d => { try { return fs.statSync(path.join(d, need)).isFile(); } catch { return false; } }) || null;
  };
  const dir = find(/markooj[ ._-]*add-?in[ ._-]*template$/i, process.env.MARKOOJ_ADDIN_TEMPLATE, 'manifest.json');
  if (!dir) return null;
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8').replace(/^﻿/, ''));
  let listed = null;
  const reg = find(/markooj[ ._-]*add-?ins$/i, process.env.MARKOOJ_ADDINS_REGISTRY, 'community-addins.json');
  try { if (reg) listed = JSON.parse(fs.readFileSync(path.join(reg, 'community-addins.json'), 'utf8')).find(e => e && e.id === manifest.id) || null; } catch {}
  const repo = (listed && listed.repo) || `${OWNER}/markooj-addin-template`, tag = 'v' + manifest.version;
  const names = ['manifest.json', 'main.js', ...(fs.existsSync(path.join(dir, 'styles.css')) ? ['styles.css'] : []),
    ...(Array.isArray(manifest.files) ? manifest.files.map(f => String(f && f.name)).filter(n => FILE_RE.test(n)) : [])];
  const files = {}; const assets = [];
  for (const name of names) {
    const buf = fs.readFileSync(path.join(dir, name)); const url = assetUrl(repo, tag, name);
    files[url] = buf.toString('base64'); assets.push({ name, url, size: buf.length, sha256: sha256(buf) });
  }
  const readmeUrl = `https://raw.githubusercontent.com/${repo}/${tag}/README.md`;
  try { files[readmeUrl] = fs.readFileSync(path.join(dir, 'README.md')).toString('base64'); } catch {}
  const src = listed || manifest;
  const entry = {
    id: manifest.id, name: src.name, author: src.author, description: src.description, repo,
    category: src.category || 'other', tags: (listed && listed.tags) || [], verified: true, version: manifest.version,
    minMarkooj: manifest.minMarkooj, tag, assets, readmeUrl, homepage: `https://github.com/${repo}`, updatedAt: '2026-11-22T00:00:00Z',
    ...(manifest.icon ? { icon: manifest.icon } : {}), ...(manifest.color ? { color: manifest.color } : {}), ...(manifest.authorUrl ? { authorUrl: manifest.authorUrl } : {}),
  };
  return { index: { format: 1, updated: '2026-11-22T00:00:00Z', addins: [entry] }, files, dir, registry: reg };
}
if (SMOKE) ipcMain.handle('addins-test-template', () => templateRelease());
if (SMOKE) ipcMain.handle('addins-test-mock', (_e, o) => {
  cachedIndex = null;
  if (!o) { mock = null; return true; }
  const files = new Map();
  for (const [u, b64] of Object.entries(o.files || {})) files.set(new URL(u).href, Buffer.from(String(b64), 'base64'));
  if (o.index) files.set(INDEX_URL, Buffer.from(JSON.stringify(o.index)));
  mock = { files, offline: !!o.offline };
  if (o.clearCache) { try { fs.rmSync(cacheFile(), { force: true }); } catch {} }
  return { indexUrl: INDEX_URL, appVersion: appVersion(), dir: addonsDir() };
});

module.exports = { normalizeIndex, normalizeEntry, checkManifest, compareVersions, parseSemver, assetUrl, INDEX_URL, CATEGORIES };
