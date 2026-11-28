// Markooj — optional Features: Pandoc, DjVu tools and Python macros, downloaded when someone wants them.
//
// Markooj 1.2 installs small (about 360 MB instead of 734 MB). These parts are optional:
//   pandoc  Pandoc: save as LaTeX, OpenDocument, Rich Text, PowerPoint, Typst …; open those files   (about 230 MB)
//   djvu    DjVuLibre + pdf2djvu: view DjVu files, save as DjVu (Windows; Homebrew/apt elsewhere)    (about 37 MB)
//   python  Pyodide: Python macros on the Developer tab                                                (about 13 MB)
//
// Where things live
//   <userData>/features/<id>/<version>/   unpacked feature (portable copies: the data folder next to Markooj.exe)
//   <userData>/features/installed.json    {format:1, features:{<id>: {version, installedAt, source, sha256, size, file}}}
//   <userData>/features/.downloads/       partial downloads (removed after use)
// Lookup order for the tools (main.js findTool): this folder first, then the bundled vendor folder (full/portable
// copies and source checkouts), then the system (PATH, Program Files, Homebrew …). Pyodide: this folder, then the app
// (node_modules/pyodide inside a full copy or a checkout), then <resources>/pyodide (full portable zip); with none of
// them the markooj:// protocol serves a small pyodide.mjs that offers to install the feature and then loads it.
//
// Downloads come from the Markooj GitHub release only. The list (markooj-features.json, format 1) is packaged into the
// app as build/features-manifest.json by the release workflow, so every download and every "Install from file" is
// checked against SHA-256 values that shipped with this copy; a copy without it reads the list from the release of
// its version, then the stable `tools` release, then the latest release. A file is downloaded from the release named in
// the list (`tag`), else from the stable `tools` release (same file name; the zips are deterministic).
// Nothing is written into the features folder unless the SHA-256 matches and every zip entry passes the checks
// (no absolute paths, drive letters, "..", backslashes, links, encryption, zip64; sizes as declared); the feature is
// unpacked into a staging folder and moved into place in one rename.
//
// IPC: features-list({refresh}) → {platform, portable, root, manifest, features:[…]}; features-install(id) → entry
//      (progress events 'features-progress' {id, phase, received, total, percent}); features-install-file({file?, id?});
//      features-remove(id); features-cancel(id?); features-first-run() → {found, language, features, key, errors};
//      features-folder() → root. Events: 'features-progress', 'features-changed'.
//      Smoke only: features-test-setup, features-test-reset, features-test-fixtures, features-test-first-run,
//      features-test-lookup, features-test-resolve.
'use strict';
const { app, ipcMain, dialog, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const https = require('https');
const zlib = require('zlib');
const { Transform, PassThrough } = require('stream');
const { pipeline } = require('stream/promises');
const I18N = require('./main-i18n'); // interface translations: names, descriptions and messages in the interface language

const APP_ROOT = __dirname;
const RELEASES = 'https://github.com/datakeen/markooj/releases';
const DL = RELEASES + '/download/';
const STABLE_TAG = 'tools';
const MANIFEST_NAME = 'markooj-features.json';
const EMBEDDED_MANIFEST = path.join(APP_ROOT, 'build', 'features-manifest.json');
const ALLOWED_HOSTS = new Set(['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com', 'github-releases.githubusercontent.com']);
const MAX_ZIP = 400 * 1048576;
const MAX_UNPACKED = 900 * 1048576;
const MAX_ENTRIES = 20000;
const UI_LANGUAGES = ['en', 'zh-CN', 'ur', 'ur-Latn', 'pnb', 'ja', 'ar', 'sv', 'es', 'fr', 'pt-BR'];
const VERSION_RE = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,39}$/;
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,150}\.zip$/;

// ---------- the catalog (sizes are the Windows sizes until the list gives exact ones) ----------
const CATALOG = {
  pandoc: {
    id: 'pandoc', name: 'Pandoc', order: 1,
    get what() { return I18N.t('Save as LaTeX, OpenDocument, Rich Text, PowerPoint, Typst and more, and open those files.'); },
    get powers() {
      return [
        I18N.t('Save as LaTeX, OpenDocument (.odt), Rich Text (.rtf), PowerPoint, Typst, JATS, reStructuredText, Org, AsciiDoc, MediaWiki and Jupyter'),
        I18N.t('Open OpenDocument, Rich Text, LaTeX, Typst, reStructuredText, Org, Jupyter, DocBook and other files'),
        I18N.t('Word (.docx) and EPUB files with citations, cross-references and your page layout'),
      ];
    },
    get without() { return I18N.t('Without it: Word (.docx), PDF, EPUB, web page and Markdown still work.'); },
    tools: ['pandoc'], license: 'GPL-2.0-or-later', homepage: 'https://pandoc.org',
    platforms: ['win32-x64', 'darwin-arm64', 'darwin-x64', 'linux-x64'],
    required: [['pandoc/pandoc.exe', 'pandoc/pandoc', 'pandoc/bin/pandoc']],
    approx: { download: 41 * 1048576, installed: 230 * 1048576 },
  },
  djvu: {
    id: 'djvu', get name() { return I18N.t('DjVu tools'); }, order: 2,
    get what() { return I18N.t('Open DjVu files and save documents as DjVu.'); },
    get powers() { return [I18N.t('Open and read DjVu files (scanned books and papers)'), I18N.t('Save documents as DjVu')]; },
    get without() { return I18N.t('Without them: PDF files still open, and everything else works.'); },
    tools: ['ddjvu', 'djvutxt', 'djvused', 'djvm', 'c44', 'pdf2djvu'], license: 'GPL-2.0-or-later (DjVuLibre), GPL-2.0-only (pdf2djvu)',
    homepage: 'https://djvu.sourceforge.net/',
    platforms: ['win32-x64'],
    required: [['djvulibre/ddjvu.exe'], ['djvulibre/djvutxt.exe'], ['djvulibre/djvused.exe'], ['pdf2djvu/pdf2djvu.exe']],
    approx: { download: 15 * 1048576, installed: 37 * 1048576 },
    elsewhere: { darwin: 'brew install djvulibre pdf2djvu', linux: 'sudo apt install djvulibre-bin pdf2djvu' },
  },
  python: {
    id: 'python', get name() { return I18N.t('Python macros'); }, order: 3,
    get what() { return I18N.t('Run macros written in Python on the Developer tab.'); },
    get powers() { return [I18N.t('Python macros and the Python console on the Developer tab'), I18N.t('Recording macros as Python')]; },
    get without() { return I18N.t('Without it: JavaScript macros and everything else work.'); },
    tools: [], license: 'MPL-2.0 (Pyodide), PSF-2.0 (CPython)', homepage: 'https://pyodide.org',
    platforms: ['any'],
    required: [['pyodide/pyodide.mjs'], ['pyodide/pyodide.asm.mjs', 'pyodide/pyodide.asm.js'], ['pyodide/pyodide.asm.wasm'], ['pyodide/python_stdlib.zip'], ['pyodide/pyodide-lock.json']],
    approx: { download: 6 * 1048576, installed: 13 * 1048576 },
  },
};
const IDS = Object.keys(CATALOG);
const TOOL_FEATURE = {};
for (const C of Object.values(CATALOG)) for (const t of C.tools) TOOL_FEATURE[t] = C.id;

// ---------- state ----------
let hooks = { onToolsChanged: () => {}, tool: null, smoke: false };
let rootOverride = null;          // smoke tests only
let testSource = null;            // smoke tests only: {dir, manifest, delayMs, allowUnverified}
let pretendNoPyodide = false;     // smoke tests only: act as a slim copy without node_modules/pyodide
let registryCache = null;
let onlineManifest = null;        // {manifest, fetchedAt, source}
let onlineFailed = null;          // {at, error}: the last failed fetch, so an offline computer does not wait again on every list
let embeddedManifest;             // undefined = not read yet, null = none
const jobs = new Map();           // id → {cancel(), promise, phase, received, total}

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const featuresRoot = () => rootOverride || (process.env.MARKOOJ_FEATURES_DIR ? path.resolve(process.env.MARKOOJ_FEATURES_DIR) : path.join(app.getPath('userData'), 'features'));
const registryFile = () => path.join(featuresRoot(), 'installed.json');
const platformKey = (platform = process.platform, arch = process.arch) => `${platform}-${arch === 'ia32' ? 'x64' : arch}`;
const keyFor = (C, platform, arch) => (C.platforms.includes('any') ? 'any' : platformKey(platform, arch));
const availableOn = (C, platform, arch) => C.platforms.includes('any') || C.platforms.includes(platformKey(platform, arch));
const MBs = n => `${Math.max(1, Math.round((Number(n) || 0) / 1048576))} MB`;

// ---------- messages: what to do first, then what still works (main.js sends actions and details to the window) ----------
function plain(msg, { actions = [], details = '', code } = {}) {
  const e = new Error(msg); e.plain = true;
  if (actions.length) e.actions = actions;
  if (details) e.details = String(details).slice(0, 4000);
  if (code) { e.code = code; if (!e.details) e.details = code; } // details make main.js send the code along (mk.errorInfo)
  return e;
}
// action labels are made when the message is made (the interface language can change while Markooj runs)
const retryAct = () => ({ id: 'retry', label: I18N.t('Try again') });
const fromFile = id => ({ id: 'feature-from-file', label: I18N.t('Install from file…'), feature: id });
const page = tag => ({ id: 'open-url', label: I18N.t('Open the download page'), url: `${RELEASES}/tag/${tag || STABLE_TAG}` });
function offline(C, e) {
  if (e && e.plain) return e;
  const c = String((e && (e.code || e.message)) || e);
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|ECONNRESET|ETIMEDOUT|ECONNABORTED|socket hang up/i.test(c))
    return plain(I18N.t('Check your internet connection and try again, or download {name} yourself and choose Install from file. Markooj could not reach GitHub. {without}', { name: C.name, without: C.without }), { actions: [retryAct(), page(), fromFile(C.id)], details: c, code: 'FEATURE_OFFLINE' });
  return plain(I18N.t('Try again. The download of {name} stopped before it finished. If it keeps stopping, download it yourself and choose Install from file. {without}', { name: C.name, without: C.without }), { actions: [retryAct(), page(), fromFile(C.id)], details: c, code: 'FEATURE_DOWNLOAD' });
}
function unsafe(C, why) {
  return plain(I18N.t('Download {name} again from the Markooj download page, then try again. This file did not pass Markooj’s safety checks, so nothing was installed and Markooj is unchanged.', { name: C ? C.name : I18N.t('the feature') }), { actions: [retryAct(), page(), { id: 'copy-details', label: I18N.t('Copy details'), text: String(why) }], details: String(why), code: 'FEATURE_UNSAFE' });
}
const zipProblem = why => Object.assign(new Error(why), { zipProblem: true });
function cancelled() {
  const e = plain(I18N.t('Install it again any time from File → Options → Features. The download was stopped, and nothing was kept.'), { code: 'FEATURE_CANCELLED', details: 'cancelled' });
  e.cancelled = true;
  return e;
}

// ---------- registry ----------
function registry() {
  if (registryCache) return registryCache;
  let r = null;
  try { r = JSON.parse(fs.readFileSync(registryFile(), 'utf8')); } catch {}
  if (!r || typeof r !== 'object' || typeof r.features !== 'object' || !r.features) r = { format: 1, features: {} };
  for (const [id, e] of Object.entries(r.features)) if (!CATALOG[id] || !e || !VERSION_RE.test(String(e.version || ''))) delete r.features[id];
  registryCache = r;
  return r;
}
function writeRegistry(r) {
  fs.mkdirSync(featuresRoot(), { recursive: true });
  const tmp = `${registryFile()}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(r, null, 2));
  fs.renameSync(tmp, registryFile());
  registryCache = r;
}
const installDir = (id, version) => path.join(featuresRoot(), id, version);
function installedEntry(id) {
  const e = registry().features[id];
  if (!e) return null;
  const dir = installDir(id, e.version);
  return fs.existsSync(dir) ? { ...e, id, dir } : null;
}

/** Installed feature folders that hold `toolName` (or every tool feature): [{id, dir, version}] — main.js looks here first. */
function toolBases(toolName) {
  const out = [];
  for (const id of IDS) {
    const C = CATALOG[id];
    if (!C.tools.length || (toolName && !C.tools.includes(toolName))) continue;
    const e = installedEntry(id);
    if (e) out.push({ id, dir: e.dir, version: e.version });
  }
  return out;
}

// ---------- Pyodide over markooj://app/node_modules/pyodide/… ----------
const PY_STUB = `// Markooj: the "Python macros" feature is not installed yet. This stand-in offers to install it, then loads it.
export async function loadPyodide(options) {
  const features = globalThis.app && globalThis.app.features;
  if (features && typeof features.ensure === 'function' && await features.ensure('python', { goal: 'run Python macros' })) {
    const real = await import(new URL('pyodide.mjs?feature=' + Date.now(), import.meta.url).href);
    return real.loadPyodide(options);
  }
  const e = new Error('Install Python macros from File → Options → Features, then run the macro again. JavaScript macros work without it.');
  e.featureMissing = 'python';
  throw e;
}
export const version = '0.0.0-markooj-stub';
`;
function under(base, rel) {
  const full = path.resolve(base, ...String(rel).split('/'));
  return full === base || full.startsWith(base + path.sep) ? full : null;
}
/** For the markooj:// protocol: {file} to serve instead, {body, type} (the stand-in), or null (serve from the app). */
function resolveAppFile(rel) {
  const m = /^\/node_modules\/pyodide\/(.+)$/.exec(String(rel || ''));
  if (!m) return null;
  const rest = m[1];
  if (/(^|\/)\.\.?(\/|$)|\\|\0/.test(rest)) return null;
  const e = installedEntry('python');
  if (e) { const f = under(path.join(e.dir, 'pyodide'), rest); if (f && fs.existsSync(f)) return { file: f }; }
  if (!pretendNoPyodide && fs.existsSync(path.join(APP_ROOT, 'node_modules', 'pyodide', 'pyodide.mjs'))) return null; // a full copy or a checkout
  if (app.isPackaged) { const f = under(path.join(process.resourcesPath, 'pyodide'), rest); if (f && fs.existsSync(f)) return { file: f }; }
  if (rest === 'pyodide.mjs') return { body: PY_STUB, type: 'text/javascript; charset=utf-8' };
  return null;
}
function pythonIncluded() {
  if (fs.existsSync(path.join(APP_ROOT, 'node_modules', 'pyodide', 'pyodide.mjs'))) return true;
  return app.isPackaged && fs.existsSync(path.join(process.resourcesPath, 'pyodide', 'pyodide.mjs'));
}

// ---------- the list of downloads (markooj-features.json) ----------
function normalizeManifest(o, source) {
  if (!o || typeof o !== 'object') return null;
  const format = Number(o.format) || 0;
  if (format !== 1) return { format, tooNew: format > 1, features: {}, source };
  const tag = typeof o.tag === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(o.tag) ? o.tag : null;
  const features = {};
  const src = o.features && typeof o.features === 'object' ? o.features : {};
  for (const id of IDS) {
    const f = src[id];
    if (!f || typeof f !== 'object' || !VERSION_RE.test(String(f.version || ''))) continue;
    const files = {};
    for (const [key, e] of Object.entries(f.files || {})) {
      if (!/^(any|(win32|darwin|linux)-(x64|arm64))$/.test(key) || !e || typeof e !== 'object') continue;
      const file = path.basename(String(e.file || ''));
      const size = Number(e.size), installedSize = Number(e.installedSize) || 0;
      if (!FILE_RE.test(file) || !Number.isInteger(size) || size <= 0 || size > MAX_ZIP || !/^[0-9a-f]{64}$/i.test(String(e.sha256 || ''))) continue;
      const version = VERSION_RE.test(String(e.version || '')) ? String(e.version) : String(f.version);
      files[key] = { file, size, sha256: String(e.sha256).toLowerCase(), installedSize: Math.max(0, Math.min(installedSize, MAX_UNPACKED)), version };
    }
    features[id] = { version: String(f.version), files };
  }
  return { format, tag, updated: typeof o.updated === 'string' ? o.updated.slice(0, 40) : null, features, source };
}
function readEmbedded() {
  if (embeddedManifest !== undefined) return embeddedManifest;
  try { embeddedManifest = normalizeManifest(JSON.parse(fs.readFileSync(EMBEDDED_MANIFEST, 'utf8')), 'built-in'); } catch { embeddedManifest = null; }
  return embeddedManifest;
}

/** GET over https, following redirects to GitHub hosts only. Node's https on purpose: the window's session blocks web
 *  requests unless "Load pictures from the web" is on, and a feature download is a separate, explicit action. */
function httpsStream(url, { timeout = 20000, redirects = 6, job } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch { return reject(Object.assign(new Error('bad address'), { status: 0 })); }
    if (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.hostname)) return reject(Object.assign(new Error(`refused host ${u.hostname}`), { status: 0 }));
    const req = https.get(u, { headers: { 'User-Agent': 'Markooj features', Accept: 'application/octet-stream, application/json' }, timeout }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects <= 0) return reject(Object.assign(new Error('too many redirects'), { status: res.statusCode }));
        return resolve(httpsStream(new URL(res.headers.location, u).href, { timeout, redirects: redirects - 1, job }));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(Object.assign(new Error(`HTTP ${res.statusCode} for ${u.href}`), { status: res.statusCode })); }
      resolve({ stream: res, total: Number(res.headers['content-length'] || 0) });
    });
    if (job) job.abort = () => req.destroy(cancelled());
    req.on('timeout', () => req.destroy(Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
  });
}
async function getJson(url, max = 1048576) {
  const { stream } = await httpsStream(url, { timeout: 12000 });
  const chunks = []; let got = 0;
  for await (const c of stream) { got += c.length; if (got > max) { stream.destroy(); throw new Error('list too large'); } chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function fetchOnline(refresh) {
  if (testSource) return testSource.manifest;
  if (!refresh && onlineManifest && Date.now() - onlineManifest.fetchedAt < 3600000) return onlineManifest.manifest;
  // smoke tests never use the network (a local build has no built-in list; the tests bring their own with features-test-setup)
  if (hooks.smoke) throw Object.assign(new Error('no network in smoke tests'), { status: 0 });
  if (!refresh && onlineFailed && Date.now() - onlineFailed.at < 60000) throw onlineFailed.error;
  const tries = [`${DL}v${app.getVersion()}/${MANIFEST_NAME}`, `${DL}${STABLE_TAG}/${MANIFEST_NAME}`, `${RELEASES}/latest/download/${MANIFEST_NAME}`];
  let last = null;
  for (const url of tries) {
    try {
      const m = normalizeManifest(await getJson(url), 'online');
      if (m && !m.tooNew) { if (!m.tag) m.tag = /\/download\/([^/]+)\//.exec(url)?.[1] || STABLE_TAG; onlineManifest = { manifest: m, fetchedAt: Date.now() }; return m; }
    } catch (e) { last = e; if (e.status !== 404 && e.status !== 0 && !(e instanceof SyntaxError)) break; }
  }
  const error = last || new Error('no feature list found');
  onlineFailed = { at: Date.now(), error };
  throw error;
}
/** The download for one feature on this computer: {entry, tag, manifest} (the built-in list first). */
async function entryFor(C, key, { refresh } = {}) {
  const lists = [];
  const emb = testSource ? null : readEmbedded();
  if (emb && emb.features[C.id]?.files[key]) lists.push(emb);
  if (!lists.length) {
    let m;
    try { m = await fetchOnline(refresh); } catch (e) {
      if (e && e.status === 404) throw plain(I18N.t('Download {name} yourself from the Markooj download page and choose Install from file. The download list for this version is not on GitHub yet. {without}', { name: C.name, without: C.without }), { actions: [page(), fromFile(C.id)], details: String(e.message), code: 'FEATURE_NOT_PUBLISHED' });
      throw offline(C, e);
    }
    if (m && m.features[C.id]?.files[key]) lists.push(m);
  }
  const m = lists[0];
  if (!m) throw plain(I18N.t('Download {name} from the Markooj download page when it is published for this system, then choose Install from file. It is not on the download list for {system} yet. {without}', { name: C.name, system: key, without: C.without }), { actions: [page(), fromFile(C.id)], code: 'FEATURE_NOT_PUBLISHED' });
  return { entry: m.features[C.id].files[key], tag: m.tag, manifest: m };
}

// ---------- download with progress, SHA-256 and cancel ----------
function send(channel, payload) {
  for (const w of BrowserWindow.getAllWindows()) { try { if (!w.isDestroyed()) w.webContents.send(channel, payload); } catch {} }
}
function progress(job, phase, extra = {}) {
  Object.assign(job, { phase }, extra);
  const now = Date.now();
  if (phase === 'download' && job.lastSent && now - job.lastSent < 120 && job.received < job.total) return;
  job.lastSent = now;
  const percent = job.total ? Math.min(100, Math.round((job.received || 0) * 100 / job.total)) : null;
  send('features-progress', { id: job.id, phase, received: job.received || 0, total: job.total || 0, percent, name: CATALOG[job.id]?.name });
}
async function openSource(url, job) {
  if (testSource && url.startsWith('test:')) {
    const f = path.join(testSource.dir, path.basename(url.slice(5)));
    if (!fs.existsSync(f)) throw Object.assign(new Error('HTTP 404 (test)'), { status: 404 });
    const stream = fs.createReadStream(f, { highWaterMark: 16384 });
    const delay = Number(testSource.delayMs) || 0;
    const slow = delay ? stream.pipe(new Transform({ transform(c, _e, cb) { setTimeout(() => cb(null, c), delay); } })) : stream;
    job.abort = () => { stream.destroy(); slow.destroy(cancelled()); };
    return { stream: slow, total: fs.statSync(f).size };
  }
  return httpsStream(url, { job });
}
async function download(url, dest, job, expectSize) {
  const { stream, total } = await openSource(url, job);
  if (job.cancelled) { stream.destroy(); throw cancelled(); }
  job.total = expectSize || total || 0; job.received = 0;
  const hash = crypto.createHash('sha256');
  const max = Math.min(MAX_ZIP, expectSize ? expectSize + 1024 : MAX_ZIP);
  const meter = new Transform({
    transform(chunk, _e, cb) {
      if (job.cancelled) return cb(cancelled());
      job.received += chunk.length;
      if (job.received > max) return cb(new Error('the download is larger than the list says'));
      hash.update(chunk); progress(job, 'download'); cb(null, chunk);
    },
  });
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  try { await pipeline(stream, meter, fs.createWriteStream(dest)); }
  catch (e) { try { await fsp.rm(dest, { force: true }); } catch {} throw job.cancelled ? cancelled() : e; }
  progress(job, 'download', { received: job.received });
  return { sha256: hash.digest('hex'), size: job.received };
}
function hashFile(file) {
  return new Promise((res, rej) => { const h = crypto.createHash('sha256'); let n = 0; fs.createReadStream(file).on('data', d => { n += d.length; h.update(d); }).on('end', () => res({ sha256: h.digest('hex'), size: n })).on('error', rej); });
}

// ---------- zip: read the directory, check every entry, unpack by streaming ----------
/** A zip entry name that stays inside the target: no absolute paths, drive letters, backslashes, "." or "..". */
function safeName(name) {
  const n = String(name);
  if (!n || n.length > 300 || /[\\\0:*?"<>|\u0000-\u001f]/.test(n) || n.startsWith('/')) return null;
  const parts = n.replace(/\/$/, '').split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(p))) return null;
  return parts;
}
async function readZipDirectory(file) {
  const fh = await fsp.open(file, 'r');
  try {
    const { size } = await fh.stat();
    if (size < 22) throw zipProblem('not a zip file (too small)');
    const tailLen = Math.min(size, 65557);
    const tail = Buffer.alloc(tailLen);
    await fh.read(tail, 0, tailLen, size - tailLen);
    let at = -1;
    for (let i = tailLen - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { at = i; break; }
    if (at < 0) throw zipProblem('not a zip file (no end record)');
    if (tail.readUInt16LE(at + 4) || tail.readUInt16LE(at + 6)) throw zipProblem('split zip files are not supported');
    const count = tail.readUInt16LE(at + 10), cdSize = tail.readUInt32LE(at + 12), cdOff = tail.readUInt32LE(at + 16);
    if (count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) throw zipProblem('zip64 files are not supported');
    if (count > MAX_ENTRIES) throw zipProblem(`too many files (${count})`);
    if (cdOff + cdSize > size) throw zipProblem('the zip directory points outside the file');
    const cd = Buffer.alloc(cdSize);
    await fh.read(cd, 0, cdSize, cdOff);
    const entries = [];
    let p = 0;
    for (let i = 0; i < count; i++) {
      if (p + 46 > cd.length || cd.readUInt32LE(p) !== 0x02014b50) throw zipProblem('damaged zip directory');
      const madeBy = cd.readUInt16LE(p + 4), flags = cd.readUInt16LE(p + 8), method = cd.readUInt16LE(p + 10);
      const crc = cd.readUInt32LE(p + 16), csize = cd.readUInt32LE(p + 20), usize = cd.readUInt32LE(p + 24);
      const nlen = cd.readUInt16LE(p + 28), xlen = cd.readUInt16LE(p + 30), clen = cd.readUInt16LE(p + 32);
      const ext = cd.readUInt32LE(p + 38), loff = cd.readUInt32LE(p + 42);
      const raw = cd.subarray(p + 46, p + 46 + nlen);
      const name = flags & 0x800 ? raw.toString('utf8') : raw.toString('latin1');
      entries.push({ name, madeBy, flags, method, crc, csize, usize, ext, loff, dir: name.endsWith('/') });
      p += 46 + nlen + xlen + clen;
    }
    return { entries, size };
  } finally { await fh.close(); }
}
/** Every check before anything is written: names, links, encryption, methods, duplicates, total size. */
function checkEntries(entries) {
  const seen = new Set();
  let total = 0;
  for (const e of entries) {
    const parts = safeName(e.name);
    if (!parts) throw zipProblem(`unsafe file name in the zip: ${JSON.stringify(e.name).slice(0, 120)}`);
    if (e.flags & 1) throw zipProblem(`encrypted file in the zip: ${e.name}`);
    if (!e.dir && e.method !== 0 && e.method !== 8) throw zipProblem(`unsupported compression (${e.method}) for ${e.name}`);
    const unixType = (e.ext >>> 16) & 0o170000;
    if ((e.madeBy >> 8) === 3 && unixType === 0o120000) throw zipProblem(`link in the zip: ${e.name}`);
    const key = parts.join('/').toLowerCase();
    if (seen.has(key) && !e.dir) throw zipProblem(`the zip names a file twice: ${e.name}`);
    seen.add(key);
    total += e.usize;
    if (total > MAX_UNPACKED) throw zipProblem('the zip unpacks to more than 900 MB');
    e.parts = parts;
  }
  return total;
}
async function dataOffset(fh, e, size) {
  const h = Buffer.alloc(30);
  await fh.read(h, 0, 30, e.loff);
  if (h.readUInt32LE(0) !== 0x04034b50) throw zipProblem(`damaged entry header: ${e.name}`);
  const start = e.loff + 30 + h.readUInt16LE(26) + h.readUInt16LE(28);
  if (start + e.csize > size) throw zipProblem(`entry outside the file: ${e.name}`);
  return start;
}
async function unpack(file, target, job, onEntry) {
  const { entries, size } = await readZipDirectory(file);
  const total = checkEntries(entries);
  const fh = await fsp.open(file, 'r');
  let done = 0;
  try {
    for (const e of entries) {
      if (job && job.cancelled) throw cancelled();
      const dest = path.join(target, ...e.parts);
      if (!dest.startsWith(target + path.sep)) throw zipProblem(`unsafe path: ${e.name}`);
      if (e.dir) { await fsp.mkdir(dest, { recursive: true }); continue; }
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      const start = await dataOffset(fh, e, size);
      let got = 0, crc = 0;
      const check = new Transform({
        transform(chunk, _e, cb) {
          got += chunk.length;
          if (got > e.usize) return cb(zipProblem(`${e.name} is larger than the zip says`));
          if (zlib.crc32) crc = zlib.crc32(chunk, crc);
          cb(null, chunk);
        },
      });
      const src = e.csize ? fs.createReadStream(file, { start, end: start + e.csize - 1 }) : (() => { const s = new PassThrough(); s.end(); return s; })();
      const mode = (e.madeBy >> 8) === 3 && ((e.ext >>> 16) & 0o111) ? 0o755 : 0o644;
      try { await pipeline(src, e.method === 8 ? zlib.createInflateRaw() : new PassThrough(), check, fs.createWriteStream(dest, { mode })); }
      catch (err) { throw err && err.zipProblem ? err : zipProblem(`${e.name} could not be unpacked (${err.code || err.message})`); }
      if (got !== e.usize) throw zipProblem(`${e.name} has ${got} bytes, the zip says ${e.usize}`);
      if (zlib.crc32 && (crc >>> 0) !== (e.crc >>> 0)) throw zipProblem(`${e.name} is damaged (checksum)`);
      if (process.platform !== 'win32' && mode === 0o755) { try { await fsp.chmod(dest, 0o755); } catch {} }
      done += e.usize;
      if (onEntry) onEntry(done, total);
    }
  } finally { await fh.close(); }
  return { files: entries.filter(e => !e.dir).length, size: total };
}
/** One small entry of a zip (feature.json) without unpacking the rest. */
async function readEntry(file, name, max = 65536) {
  const { entries, size } = await readZipDirectory(file);
  checkEntries(entries);
  const e = entries.find(x => x.name === name);
  if (!e || e.usize > max) return null;
  const fh = await fsp.open(file, 'r');
  try {
    const start = await dataOffset(fh, e, size);
    const buf = Buffer.alloc(e.csize);
    await fh.read(buf, 0, e.csize, start);
    return e.method === 8 ? zlib.inflateRawSync(buf, { maxOutputLength: max }) : buf;
  } finally { await fh.close(); }
}

// ---------- install, remove ----------
async function rmQuiet(p) { try { await fsp.rm(p, { recursive: true, force: true, maxRetries: 3 }); return true; } catch { return false; } }
function freeBytes(dir) {
  try { const s = fs.statfsSync(dir); return Number(s.bavail) * Number(s.bsize); } catch { return Infinity; }
}
function diskFull(C, need, dir) {
  return plain(I18N.t('Free about {size} on the drive that holds {folder}, then try again. There is not enough space to install {name}. {without}', { size: MBs(need), folder: dir, name: C.name, without: C.without }), { actions: [retryAct()], code: 'ENOSPC', details: `${dir}: needs ${need} bytes` });
}
function validateFeature(C, meta, key) {
  if (!meta || typeof meta !== 'object') return 'feature.json is missing';
  if (meta.id !== C.id) return `this file is for "${String(meta.id).slice(0, 40)}", not ${C.id}`;
  if (!VERSION_RE.test(String(meta.version || ''))) return 'feature.json has no valid version';
  if (meta.platform !== key) return `this file is for ${String(meta.platform).slice(0, 30)}, this computer needs ${key}`;
  return null;
}

/** Install one feature: download (or take `file`), check, unpack into staging, move into place. Returns the entry. */
function install(id, opts = {}) {
  const C = CATALOG[id];
  if (!C) return Promise.reject(plain(I18N.t('Choose a feature from File → Options → Features.'), { code: 'FEATURE_UNKNOWN' }));
  if (jobs.has(id)) return jobs.get(id).promise;
  const job = { id, phase: 'start', received: 0, total: 0, cancelled: false, abort: null };
  job.cancel = () => { job.cancelled = true; try { job.abort && job.abort(); } catch {} };
  job.promise = (async () => {
    const key = keyFor(C);
    const root = featuresRoot();
    await fsp.mkdir(root, { recursive: true });
    let zipFile = null, tempZip = null, expect = null, source = 'download', tag = null;
    try {
      if (opts.file) {
        zipFile = path.resolve(String(opts.file));
        source = 'file';
        progress(job, 'verify');
        const got = await hashFile(zipFile);
        expect = await knownEntry(C, key, got.sha256);
        if (!expect && !(testSource && testSource.allowUnverified) && process.env.MARKOOJ_FEATURES_UNVERIFIED !== '1')
          throw plain(I18N.t('Download {name} for Markooj {version} from the Markooj download page, then choose that file. Markooj could not match this file with its list of downloads, so nothing was installed. {without}', { name: C.name, version: app.getVersion(), without: C.without }), { actions: [page(), { id: 'copy-details', label: I18N.t('Copy details'), text: `sha256 ${got.sha256}` }], details: `${path.basename(zipFile)}: sha256 ${got.sha256} is not in the feature list for ${key}`, code: 'FEATURE_UNKNOWN_FILE' });
      } else {
        if (!availableOn(C)) throw unavailableError(C);
        progress(job, 'manifest');
        const r = await entryFor(C, key, { refresh: !!opts.refresh });
        expect = r.entry; tag = r.tag;
        const need = expect.size + (expect.installedSize || C.approx.installed) + 32 * 1048576;
        if (freeBytes(root) < need) throw diskFull(C, need, root);
        tempZip = path.join(root, '.downloads', `${expect.file}.${crypto.randomBytes(3).toString('hex')}.part`);
        const urls = testSource ? [`test:${expect.file}`] : [...new Set([tag && `${DL}${tag}/${expect.file}`, `${DL}${STABLE_TAG}/${expect.file}`].filter(Boolean))];
        let got = null, last = null;
        for (const url of urls) {
          try { got = await download(url, tempZip, job, expect.size); break; }
          catch (e) { if (e.cancelled || job.cancelled) throw cancelled(); last = e; if (e.status !== 404) break; }
        }
        if (!got) {
          if (last && last.status === 404) throw plain(I18N.t('Download {name} yourself from the Markooj download page and choose Install from file. GitHub does not have this file right now. {without}', { name: C.name, without: C.without }), { actions: [retryAct(), page(tag), fromFile(id)], details: String(last.message), code: 'FEATURE_NOT_PUBLISHED' });
          throw offline(C, last);
        }
        progress(job, 'verify');
        if (got.sha256 !== expect.sha256 || got.size !== expect.size)
          throw plain(I18N.t('Try again. The download of {name} was damaged on the way, so Markooj did not install it and nothing changed. If it happens again, download the file yourself and choose Install from file.', { name: C.name }), { actions: [retryAct(), page(tag), fromFile(id)], details: `expected sha256 ${expect.sha256} (${expect.size} bytes), got ${got.sha256} (${got.size} bytes)`, code: 'FEATURE_CHECK_FAILED' });
        zipFile = tempZip;
      }
      if (job.cancelled) throw cancelled();
      // read and check feature.json and every entry before anything is written
      let meta = null;
      try { const buf = await readEntry(zipFile, 'feature.json'); meta = buf ? JSON.parse(buf.toString('utf8')) : null; }
      catch (e) { throw e.zipProblem ? unsafe(C, e.message) : unsafe(C, `feature.json: ${e.message}`); }
      const bad = validateFeature(C, meta, key);
      if (bad) {
        if (/^this file is for/.test(bad)) throw plain(I18N.t('Choose the {name} file for this computer ({system}) from the Markooj download page. {reason}, so nothing was installed.', { name: C.name, system: key, reason: bad[0].toUpperCase() + bad.slice(1) }), { actions: [page(tag)], details: bad, code: 'FEATURE_WRONG_FILE' });
        throw unsafe(C, bad);
      }
      const version = String(meta.version);
      const staging = path.join(root, id, `.staging-${crypto.randomBytes(4).toString('hex')}`);
      progress(job, 'unpack', { received: 0, total: 0 });
      try {
        await fsp.mkdir(staging, { recursive: true });
        try { await unpack(zipFile, staging, job, (d, t) => progress(job, 'unpack', { received: d, total: t })); }
        catch (e) { if (e.cancelled) throw e; if (e.zipProblem) throw unsafe(C, e.message); if (e.code === 'ENOSPC') throw diskFull(C, (expect && expect.installedSize) || C.approx.installed, root); throw e; }
        for (const alts of C.required) if (!alts.some(f => fs.existsSync(path.join(staging, ...f.split('/'))))) throw unsafe(C, `required file missing: ${alts[0]}`);
        // one rename puts the new version in place; an old copy of the same version is moved aside first
        const dest = installDir(id, version);
        let aside = null;
        if (fs.existsSync(dest)) { aside = path.join(root, `.trash-${crypto.randomBytes(4).toString('hex')}`); await fsp.rename(dest, aside); }
        await fsp.rename(staging, dest);
        if (aside) rmQuiet(aside);
        const reg = registry();
        const prev = reg.features[id];
        reg.features[id] = { version, installedAt: new Date().toISOString(), source, sha256: expect ? expect.sha256 : null, size: meta.installedSize || null, file: path.basename(zipFile).replace(/\.[0-9a-f]{6}\.part$/, '') };
        writeRegistry({ ...reg, format: 1 });
        // older versions of this feature are no longer used
        if (prev && prev.version !== version) moveAside(installDir(id, prev.version));
      } finally { rmQuiet(staging); }
      hooks.onToolsChanged(id);
      progress(job, 'done', { received: job.total, total: job.total });
      send('features-changed', { id, installed: true });
      return { id, version, dir: installDir(id, version), source };
    } catch (e) {
      progress(job, e && e.cancelled ? 'cancelled' : 'error');
      throw e;
    } finally {
      if (tempZip) rmQuiet(tempZip);
    }
  })().finally(() => jobs.delete(id));
  jobs.set(id, job);
  return job.promise;
}
async function moveAside(dir) {
  if (!fs.existsSync(dir)) return true;
  const trash = path.join(featuresRoot(), `.trash-${crypto.randomBytes(4).toString('hex')}`);
  try { await fsp.rename(dir, trash); } catch { return rmQuiet(dir); }
  return rmQuiet(trash);
}
/** A manifest entry whose SHA-256 is `sha` (the built-in list, the last online list, or a fresh one). */
async function knownEntry(C, key, sha) {
  const lists = [];
  if (testSource) lists.push(testSource.manifest);
  else {
    const emb = readEmbedded(); if (emb) lists.push(emb);
    if (onlineManifest) lists.push(onlineManifest.manifest);
  }
  const find = () => { for (const m of lists) { const e = m && m.features[C.id]?.files[key]; if (e && e.sha256 === sha) return e; } return null; };
  let e = find();
  if (!e && !testSource) { try { lists.push(await fetchOnline(true)); e = find(); } catch {} }
  return e;
}
function unavailableError(C) {
  const how = C.elsewhere && C.elsewhere[process.platform];
  if (how) return plain(process.platform === 'darwin'
    ? I18N.t('Install the free {name} with Homebrew: run {command} in a terminal, then check again. {without}', { name: C.name, command: how, without: C.without })
    : I18N.t('Install the free {name} with your package manager: run {command} in a terminal, then check again. {without}', { name: C.name, command: how, without: C.without }), { actions: [{ id: 'copy', label: I18N.t('Copy command'), text: how }, { id: 'check-tools', label: I18N.t('Check again') }], code: 'FEATURE_UNAVAILABLE' });
  return plain(I18N.t('Install {name} yourself from {url}. Markooj has no download of it for this system. {without}', { name: C.name, url: C.homepage, without: C.without }), { actions: [{ id: 'open-url', label: I18N.t('Open {name} page', { name: C.name }), url: C.homepage }], code: 'FEATURE_UNAVAILABLE' });
}
async function remove(id) {
  const C = CATALOG[id];
  if (!C) throw plain(I18N.t('Choose a feature from File → Options → Features.'), { code: 'FEATURE_UNKNOWN' });
  if (jobs.has(id)) { jobs.get(id).cancel(); try { await jobs.get(id)?.promise; } catch {} }
  const reg = registry();
  const e = reg.features[id];
  if (!e) return { id, removed: false };
  delete reg.features[id];
  writeRegistry(reg);          // from here on Markooj no longer uses it
  hooks.onToolsChanged(id);
  const ok = await moveAside(installDir(id, e.version));
  try { const left = fs.readdirSync(path.join(featuresRoot(), id)); if (!left.length) fs.rmdirSync(path.join(featuresRoot(), id)); } catch {}
  send('features-changed', { id, installed: false });
  return { id, removed: true, cleaned: ok };
}
/** Leftovers of an interrupted install or a removal that was blocked (a program still running). It runs a few seconds
 *  after the start, when the installer's first-run downloads may already be going: a running install's partial
 *  download and staging folder are never touched. */
async function cleanup() {
  const root = featuresRoot();
  try {
    for (const n of fs.readdirSync(root)) {
      if (/^\.trash-/.test(n)) await rmQuiet(path.join(root, n));
      else if (n === '.downloads') { if (!jobs.size) for (const f of fs.readdirSync(path.join(root, n))) if (/\.part$/.test(f) && !jobs.size) await rmQuiet(path.join(root, n, f)); }
      else if (CATALOG[n]) {
        if (jobs.has(n)) continue;
        const cur = registry().features[n];
        for (const v of fs.readdirSync(path.join(root, n))) if (!jobs.has(n) && (/^\.staging-/.test(v) || (cur && v !== cur.version) || !cur)) await rmQuiet(path.join(root, n, v));
      }
    }
  } catch {}
}

// ---------- the list for the window ----------
async function stateOf(C) {
  const e = installedEntry(C.id);
  const job = jobs.get(C.id);
  let found = null;
  if (C.tools.length && hooks.tool) {
    try { found = await hooks.tool(C.tools[0]); } catch {}
    if (found && C.id === 'djvu') { try { const p = await hooks.tool('pdf2djvu'); if (!p) found = null; else if (!p.bundled) found = { ...found, bundled: found.bundled && p.bundled }; } catch {} }
  }
  if (job) return { state: 'installing', installed: e, found };
  if (e) return { state: 'installed', installed: e, found };
  if (C.id === 'python' ? pythonIncluded() : found && found.bundled) return { state: 'included', installed: null, found };
  if (found) return { state: 'system', installed: null, found };
  return { state: availableOn(C) ? 'available' : 'unavailable', installed: null, found };
}
async function list({ refresh } = {}) {
  const emb = testSource ? null : readEmbedded();
  let m = testSource ? testSource.manifest : emb;
  let online = null;
  if (refresh || !m) { try { online = await fetchOnline(!!refresh); } catch {} }
  const out = [];
  for (const C of Object.values(CATALOG).sort((a, b) => a.order - b.order)) {
    const key = keyFor(C);
    const s = await stateOf(C);
    const entry = (m && m.features[C.id]?.files[key]) || (online && online.features[C.id]?.files[key]) || null;
    const job = jobs.get(C.id);
    out.push({
      id: C.id, name: C.name, what: C.what, powers: C.powers, without: C.without, license: C.license, homepage: C.homepage,
      tools: C.tools, platform: key, available: availableOn(C), elsewhere: (C.elsewhere && C.elsewhere[process.platform]) || null,
      download: entry ? entry.size : C.approx.download, installedSize: entry ? entry.installedSize || C.approx.installed : C.approx.installed, exact: !!entry,
      version: entry ? entry.version : null,
      state: s.state, installed: s.installed ? { version: s.installed.version, installedAt: s.installed.installedAt, source: s.installed.source, size: s.installed.size, dir: s.installed.dir } : null,
      foundAt: s.found ? s.found.path : null,
      update: !!(s.installed && entry && entry.version && entry.version !== s.installed.version),
      job: job ? { phase: job.phase, received: job.received, total: job.total } : null,
    });
  }
  const pick = testSource ? m : emb || (online || null);
  return {
    platform: platformKey(), root: featuresRoot(), portable: /[\\/]data[\\/]features$/.test(featuresRoot()),
    manifest: pick ? { source: testSource ? 'test' : pick.source, tag: pick.tag, updated: pick.updated } : null,
    downloadPage: `${RELEASES}/tag/${(pick && pick.tag) || STABLE_TAG}`,
    features: out,
  };
}

// ---------- first start after the Windows installer: <resources>/first-run.json ----------
/** {language, features, errors} from the installer's first-run.json text. Pure. */
function parseFirstRun(text) {
  const errors = [];
  let o = null;
  try { o = JSON.parse(String(text || '').replace(/^﻿/, '')); } catch (e) { return { valid: false, language: null, features: [], errors: ['not JSON: ' + e.message] }; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { valid: false, language: null, features: [], errors: ['not an object'] };
  let language = null;
  if (o.language != null && o.language !== '') {
    const want = String(o.language).trim().replace('_', '-');
    language = UI_LANGUAGES.find(c => c.toLowerCase() === want.toLowerCase()) || null;
    if (!language) errors.push(`unknown language ${want.slice(0, 20)}`);
  }
  let raw = o.features;
  if (typeof raw === 'string') raw = raw.split(/[\s,;]+/);
  const features = [];
  const hasFeatures = Array.isArray(raw);
  if (raw != null && !hasFeatures) errors.push('features is not a list');
  for (const f of hasFeatures ? raw : []) {
    const id = String(f || '').trim().toLowerCase();
    if (!id) continue;
    const norm = id === 'pyodide' ? 'python' : id === 'djvulibre' ? 'djvu' : id;
    if (!CATALOG[norm]) { errors.push(`unknown feature ${id.slice(0, 20)}`); continue; }
    if (!features.includes(norm)) features.push(norm);
  }
  return { valid: true, language, features, chose: hasFeatures, errors };
}
function firstRunFile() {
  if (process.env.MARKOOJ_FIRST_RUN) return path.resolve(process.env.MARKOOJ_FIRST_RUN);
  return app.isPackaged ? path.join(process.resourcesPath, 'first-run.json') : null;
}
function firstRun() {
  const f = firstRunFile();
  if (!f || !fs.existsSync(f)) return { found: false };
  let text = '';
  try { text = fs.readFileSync(f, 'utf8'); } catch (e) { return { found: true, valid: false, errors: [e.code || e.message], key: null, features: [], language: null }; }
  const r = parseFirstRun(text);
  let mtime = 0; try { mtime = fs.statSync(f).mtimeMs; } catch {}
  return { found: true, path: f, key: sha256(text + '|' + Math.round(mtime)).slice(0, 16), ...r };
}

// ---------- smoke-test fixtures (built with JSZip; never on the network) ----------
async function makeFixtures(dir) {
  const JSZip = require('jszip');
  await fsp.mkdir(dir, { recursive: true });
  const key = platformKey();
  const exe = process.platform === 'win32' ? '.exe' : '';
  const D = new Date(Date.UTC(2026, 0, 1));
  const build = async (name, files, mutate) => {
    const z = new JSZip();
    for (const [n, data] of Object.entries(files)) z.file(n, data, { date: D, unixPermissions: /pandoc$|\.exe$/.test(n) ? 0o755 : 0o644 });
    if (mutate) mutate(z);
    const buf = await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', platform: 'UNIX' });
    await fsp.writeFile(path.join(dir, name), buf);
    return { file: name, size: buf.length, sha256: sha256(buf) };
  };
  const meta = (id, version, platform) => JSON.stringify({ format: 1, id, version, platform, name: CATALOG[id].name, installedSize: 2048 });
  const pyFiles = v => ({
    'feature.json': meta('python', v, 'any'),
    'pyodide/pyodide.mjs': `export const loadPyodide = async () => ({ fake: true, version: '${v}' }); export const version = '${v}';\n`,
    'pyodide/pyodide.asm.mjs': '// test\n', 'pyodide/pyodide.asm.wasm': Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]),
    'pyodide/python_stdlib.zip': 'PK-test', 'pyodide/pyodide-lock.json': '{"info":{"version":"' + v + '"}}',
    'pyodide/feature-test.txt': `markooj features fixture ${v}`, 'licenses/pyodide-LICENSE.txt': 'MPL-2.0 (test copy)',
  });
  const good = await build('markooj-feature-python-9.0.1-any.zip', pyFiles('9.0.1'));
  const good2 = await build('markooj-feature-python-9.0.2-any.zip', pyFiles('9.0.2'));
  const pandoc = await build(`markooj-feature-pandoc-9.9-${key}.zip`, { 'feature.json': meta('pandoc', '9.9', key), [`pandoc/pandoc${exe}`]: 'not a real program (test fixture)', 'licenses/pandoc-COPYING': 'GPL (test copy)' });
  // a zip whose entry climbs out of the target folder (zip-slip); JSZip keeps the name as given
  const evil = await build('markooj-feature-python-6.6.6-any.zip', { 'feature.json': meta('python', '6.6.6', 'any'), 'pyodide/pyodide.mjs': 'x' }, z => { z.file('../evil-outside.txt', 'should never be written', { date: D }); });
  const missing = await build('markooj-feature-python-7.7.7-any.zip', { 'feature.json': meta('python', '7.7.7', 'any'), 'pyodide/pyodide.mjs': 'x' });
  const wrongPlatform = await build('markooj-feature-pandoc-9.8-plan9-x64.zip', { 'feature.json': meta('pandoc', '9.8', 'plan9-x64'), [`pandoc/pandoc${exe}`]: 'x' });
  // 2 MB that does not compress, so a slowed-down download can be cancelled halfway
  const big = await build('markooj-feature-python-9.1.0-any.zip', { ...pyFiles('9.1.0'), 'feature.json': meta('python', '9.1.0', 'any'), 'pyodide/blob.bin': crypto.randomBytes(2 * 1048576) });
  const entry = (r, version) => ({ ...r, installedSize: 2048, version });
  const manifest = normalizeManifest({
    format: 1, tag: 'v0.0.0-test', updated: new Date().toISOString(),
    features: {
      python: { version: '9.0.1', files: { any: entry(good, '9.0.1') } },
      pandoc: { version: '9.9', files: { [key]: entry(pandoc, '9.9') } },
    },
  }, 'test');
  return { dir, key, manifest, files: { good, good2, pandoc, evil, missing, wrongPlatform, big }, entries: { good2: entry(good2, '9.0.2'), evil: entry(evil, '6.6.6'), missing: entry(missing, '7.7.7'), big: entry(big, '9.1.0') } };
}

// ---------- IPC ----------
function init(h = {}) {
  hooks = { ...hooks, ...h };
  setTimeout(() => { cleanup().catch(() => {}); }, 4000);
  ipcMain.handle('features-list', (_e, o = {}) => list(o || {}));
  ipcMain.handle('features-install', (_e, id, o = {}) => install(String(id || ''), { refresh: !!(o && o.refresh) }));
  ipcMain.handle('features-install-file', async (_e, o = {}) => {
    let file = o && o.file ? String(o.file) : null;
    if (!file) {
      if (hooks.smoke) throw plain(I18N.t('Choose a file, then try again.'), { code: 'FEATURE_NO_FILE' });
      const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      const r = await dialog.showOpenDialog(w, { title: I18N.t('Install a feature from a file'), properties: ['openFile'], filters: [{ name: I18N.t('Markooj feature (zip)'), extensions: ['zip'] }] });
      if (r.canceled || !r.filePaths.length) return null;
      file = r.filePaths[0];
    }
    if (!fs.existsSync(file)) throw plain(I18N.t('Choose the file again: it may have been moved or deleted.'), { actions: [{ id: 'open-file', label: I18N.t('Choose another file') }], code: 'ENOENT' });
    // which feature is it? feature.json says; the caller may insist on one
    let meta = null;
    try { const b = await readEntry(file, 'feature.json'); meta = b ? JSON.parse(b.toString('utf8')) : null; } catch (e) { throw unsafe(null, e.message); }
    const id = meta && CATALOG[meta.id] ? meta.id : null;
    if (!id) throw plain(I18N.t('Choose a Markooj feature file (markooj-feature-….zip) from the Markooj download page. This zip is not one, so nothing was installed.'), { actions: [page()], code: 'FEATURE_WRONG_FILE', details: 'no valid feature.json' });
    if (o && o.id && o.id !== id) throw plain(I18N.t('Choose the {wanted} file. This one holds {found}, so nothing was installed.', { wanted: CATALOG[o.id] ? CATALOG[o.id].name : o.id, found: CATALOG[id].name }), { actions: [page()], code: 'FEATURE_WRONG_FILE' });
    return install(id, { file });
  });
  ipcMain.handle('features-remove', (_e, id) => remove(String(id || '')));
  ipcMain.handle('features-cancel', (_e, id) => { let n = 0; for (const [k, j] of jobs) if (!id || k === id) { j.cancel(); n++; } return n; });
  ipcMain.handle('features-first-run', () => firstRun());
  ipcMain.handle('features-folder', () => { fs.mkdirSync(featuresRoot(), { recursive: true }); return featuresRoot(); });
  if (hooks.smoke) {
    ipcMain.handle('features-test-setup', (_e, o = {}) => {
      if (o.root) rootOverride = path.resolve(String(o.root));
      if (o.dir) testSource = { dir: path.resolve(String(o.dir)), manifest: null, delayMs: 0, allowUnverified: false };
      if (testSource) {
        if (o.manifest) testSource.manifest = normalizeManifest(o.manifest, 'test');
        if (o.delayMs != null) testSource.delayMs = Number(o.delayMs) || 0;
        if (o.allowUnverified != null) testSource.allowUnverified = !!o.allowUnverified;
      }
      if (o.pretendNoPyodide != null) pretendNoPyodide = !!o.pretendNoPyodide;
      registryCache = null;
      hooks.onToolsChanged('test');
      return { root: featuresRoot() };
    });
    ipcMain.handle('features-test-reset', () => { for (const j of jobs.values()) j.cancel(); rootOverride = null; testSource = null; pretendNoPyodide = false; registryCache = null; hooks.onToolsChanged('test'); return true; });
    ipcMain.handle('features-test-ls', (_e, dir) => { try { return fs.readdirSync(String(dir)); } catch { return null; } });
    ipcMain.handle('features-test-fixtures', (_e, dir) => makeFixtures(path.resolve(String(dir))));
    ipcMain.handle('features-test-first-run', (_e, text) => parseFirstRun(text));
    ipcMain.handle('features-test-lookup', async (_e, name) => (hooks.findTool ? hooks.findTool(String(name)) : null));
    ipcMain.handle('features-test-resolve', (_e, rel) => { const r = resolveAppFile(String(rel)); return r ? { file: r.file || null, stub: r.body != null } : null; });
    ipcMain.handle('features-test-exists', (_e, p) => fs.existsSync(String(p)));
    ipcMain.handle('features-test-cleanup', () => cleanup().then(() => true));
  }
}

/** For main.js toolRemedy: the feature that brings this tool, and whether Markooj can download it here. */
function remedyFor(toolId, { platform = process.platform, arch = process.arch } = {}) {
  const id = TOOL_FEATURE[toolId] || (toolId === 'djvulibre' ? 'djvu' : null);
  const C = id && CATALOG[id];
  if (!C) return null;
  const emb = readEmbedded();
  const key = keyFor(C, platform, arch);
  const e = emb && emb.features[id]?.files[key];
  return { id, name: C.name, available: availableOn(C, platform, arch), download: e ? e.size : C.approx.download, downloadText: MBs(e ? e.size : C.approx.download) };
}

module.exports = {
  init, toolBases, resolveAppFile, remedyFor, parseFirstRun, featureForTool: t => TOOL_FEATURE[t] || null,
  catalog: () => CATALOG, root: featuresRoot, platformKey, UI_LANGUAGES,
  // for tests in Node (no Electron window needed)
  _internal: { safeName, checkEntries, readZipDirectory, unpack, normalizeManifest },
};
