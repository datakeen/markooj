// Markooj — main process: protocol, window, files, conversions, bundled tools, recovery store, settings, smoke test.
'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, Menu, protocol, session, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');

// ---------- startup failures (PLAN-v3 item 46) ----------
// Electron's default handler shows "A JavaScript error occurred in the main process" with a stack trace. In smoke
// mode a failure goes to stderr and the process exits non-zero with no window; otherwise one plain message is shown
// while Markooj is starting, and later errors are only logged.
const IS_SMOKE_RUN = process.argv.includes('--smoke');
let STARTUP_DONE = false, startupErrorShown = false;
function onMainError(e) {
  const msg = String((e && e.message) || e || 'Unknown error');
  try { process.stderr.write(`[markooj] main process error: ${(e && e.stack) || msg}\n`); } catch {}
  if (IS_SMOKE_RUN) { try { app.exit(3); } catch { process.exit(3); } return; }
  if (STARTUP_DONE || startupErrorShown) return;
  startupErrorShown = true;
  try { dialog.showErrorBox('Start Markooj again', `Please start Markooj again. If this keeps happening, download Markooj again from https://datakeen.github.io/markooj/#download and install it over this copy (your documents and settings stay), or report it at https://github.com/datakeen/markooj/issues.\n\nTechnical details: ${msg.split('\n')[0]}`); } catch {}
  try { app.exit(1); } catch { process.exit(1); }
}
process.on('uncaughtException', onMainError);
// a rejected promise nobody awaited is logged only (as Electron does by default); it never stops Markooj
process.on('unhandledRejection', e => { try { process.stderr.write(`[markooj] unhandled rejection: ${(e && e.stack) || e}\n`); } catch {} });

// ---------- messages the window can act on ----------
// Every message for people leads with what they can do (Try again, Save to another folder, Get Pandoc …), says what
// still works, and keeps raw codes for "Technical details". An Error may carry `actions` ([{id, label, url?, text?,
// tool?, path?}]) and `details` (technical text). Electron sends only the message over IPC, so both ride after a marker
// that preload takes off again: the window sees the plain message, and mk.errorInfo(e) returns {message, actions, details}.
// Action ids: retry, save-as, choose-format, open-file, check-tools, open-url (url), copy (text), copy-details (text),
// report (url), tool (tool: pandoc|pdf2djvu|ddjvu), open-folder (path).
const ERR_MARK = String.fromCharCode(10, 0x2063) + 'mk-info:'; // newline, invisible separator, tag
const ISSUES_URL = 'https://github.com/datakeen/markooj/issues';
const DOWNLOAD_URL = 'https://datakeen.github.io/markooj/#download';
const ACT = {
  retry: { id: 'retry', label: 'Try again' },
  saveAs: { id: 'save-as', label: 'Save to another folder' },
  chooseFormat: { id: 'choose-format', label: 'Choose another format' },
  openFile: { id: 'open-file', label: 'Choose another file' },
  checkTools: { id: 'check-tools', label: 'Check again' },
  report: { id: 'report', label: 'Report this', url: ISSUES_URL },
  details: text => ({ id: 'copy-details', label: 'Copy details', text: String(text || '').slice(0, 4000) }),
  url: (label, url) => ({ id: 'open-url', label, url }),
  copy: (label, text) => ({ id: 'copy', label, text }),
};
function userError(message, { actions = [], details = '', code, tool } = {}) {
  const e = new Error(message);
  e.plain = true;
  if (actions.length) e.actions = actions;
  if (details) e.details = String(details).slice(0, 4000);
  if (code) e.code = code;
  if (tool) e.tool = tool;
  return e;
}
function errorForIpc(e) {
  if (!e || typeof e !== 'object' || !((Array.isArray(e.actions) && e.actions.length) || e.details)) return e;
  const info = { actions: e.actions || [], details: e.details || '', code: typeof e.code === 'string' ? e.code : undefined, tool: e.tool || undefined };
  return new Error(String(e.message || '') + ERR_MARK + JSON.stringify(info));
}
// every handler (main-langpacks.js and main-addins.js too) sends its actions and details along
{
  const handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, fn) => handle(channel, async (...args) => { try { return await fn(...args); } catch (e) { throw errorForIpc(e); } });
}

const APP_ROOT = __dirname;
const SCHEME = 'markooj';
const START_URL = `${SCHEME}://app/src/index.html`;

// The custom protocol must be registered before the app is ready.
protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true },
}]);

// ---------- smoke mode ----------
const smokeIdx = process.argv.indexOf('--smoke');
const SMOKE = smokeIdx >= 0 ? path.resolve(process.argv[smokeIdx + 1] && !process.argv[smokeIdx + 1].startsWith('-') ? process.argv[smokeIdx + 1] : 'smoke-out') : null;
const smokeLog = [];
// --smoke-only <regex>: run only the in-app tests whose name matches, and skip exports/e2e (fast checks while developing)
const SMOKE_ONLY = (i => (i >= 0 ? process.argv[i + 1] || null : null))(process.argv.indexOf('--smoke-only'));
if (SMOKE) {
  try { fs.mkdirSync(SMOKE, { recursive: true }); }
  catch (e) {
    // e.g. Git Bash turned "--smoke /out" into C:\Program Files\Git\out: say so on stderr, never show a dialog
    process.stderr.write(`[smoke] cannot create the output folder ${SMOKE}: ${e.code || e.message}\n`);
    process.exit(2);
  }
  // a fresh profile every run, so leftovers from the last run never show up as "recovered after a crash"
  try { fs.rmSync(path.join(SMOKE, 'userData', 'recovery'), { recursive: true, force: true }); } catch {}
  app.setPath('userData', path.join(SMOKE, 'userData')); // never touch the real settings or recovery store
  const t = setTimeout(async () => {
    // say where it stopped: the running test and how many finished
    let where = null;
    try { where = await Promise.race([win.webContents.executeJavaScript('({ current: window.app?.tests?.current || null, done: window.app?.tests?.done || 0, started: !!window.__mkSmokeStarted })'), new Promise(r => setTimeout(() => r('renderer did not answer'), 3000))]); } catch (e) { where = String(e); }
    finishSmoke({ error: 'Smoke test timed out after 420 s', where }, 2);
  }, 420000);
  if (t.unref) t.unref();
}

// US English UI everywhere Chromium draws its own text (date fields, built-in messages)
app.commandLine.appendSwitch('lang', 'en-US');
// A test run's window is invisible (opacity 0) and usually sits behind other windows. Windows reports such a window as
// "occluded", and Chromium then stops drawing it: screenshots fail ("Current display surface not available for capture")
// and animations never finish. Test runs keep drawing it.
if (SMOKE) {
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
}

// ---------- portable mode ----------
// A copy unzipped from the portable zip keeps everything next to the program: when a file `portable.txt` or a
// folder `data` sits beside Markooj.exe, userData (settings, recovered text, macros, add-ins, Chromium's profile)
// is that `data` folder, created on first run. The installer never ships portable.txt.
function portableDataDir(exeDir, fsx = fs) {
  if (!exeDir) return { active: false, dir: null, reason: null };
  const dir = path.join(exeDir, 'data');
  let reason = null;
  try { if (fsx.statSync(dir).isDirectory()) reason = 'data folder'; } catch {}
  if (!reason) { try { if (fsx.statSync(path.join(exeDir, 'portable.txt')).isFile()) reason = 'portable.txt'; } catch {} }
  if (!reason) return { active: false, dir: null, reason: null };
  try { fsx.mkdirSync(dir, { recursive: true }); fsx.accessSync(dir, fs.constants.W_OK); }
  catch (e) { return { active: false, dir, reason, error: `To keep settings next to Markooj, move the Markooj folder somewhere you can write to, such as Documents or a USB drive. For now your settings are kept in your user profile, and everything works.`, details: `Cannot write to ${dir}: ${e.code || e.message}` }; }
  return { active: true, dir, reason };
}
// the folder that holds the program: next to Markooj.exe (Windows, unpacked Linux), next to the AppImage file; never inside a macOS .app
function programDir() {
  if (!app.isPackaged || process.platform === 'darwin') return null;
  if (process.platform === 'linux' && process.env.APPIMAGE) return path.dirname(process.env.APPIMAGE);
  return path.dirname(process.execPath);
}
const PORTABLE = portableDataDir(programDir());
let USER_DATA_FROM = SMOKE ? 'smoke' : 'default';
// Developers can run a throwaway profile: MARKOOJ_USER_DATA=<folder> npx electron .
if (!SMOKE && process.env.MARKOOJ_USER_DATA) { app.setPath('userData', path.resolve(process.env.MARKOOJ_USER_DATA)); USER_DATA_FROM = 'env'; }
else if (!SMOKE && PORTABLE.active) { app.setPath('userData', PORTABLE.dir); USER_DATA_FROM = 'portable'; }

let win = null;
const pending = []; // files asked to open before the window is ready
let SESSION = newId(); // recovery entries from another session (or before a renderer crash) count as "crashed"

const MARKDOWN_EXT = ['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdwn', 'mdx', 'rmd', 'qmd', 'txt', 'text'];
const PANDOC_IN = { docx: 'docx', odt: 'odt', rtf: 'rtf', tex: 'latex', latex: 'latex', ltx: 'latex', rst: 'rst', org: 'org', textile: 'textile', ipynb: 'ipynb', wiki: 'mediawiki', mediawiki: 'mediawiki', dbk: 'docbook', docbook: 'docbook', csv: 'csv', tsv: 'tsv', typ: 'typst', fb2: 'fb2', opml: 'opml', muse: 'muse', t2t: 't2t' };
const OPENABLE_EXT = new Set([...MARKDOWN_EXT, 'html', 'htm', 'xhtml', 'pdf', 'epub', 'djvu', 'djv', ...Object.keys(PANDOC_IN)]);
const extOf = p => path.extname(String(p || '')).slice(1).toLowerCase();

function newId() { return Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex'); }

// cwd: the folder the launching process ran in (a second launch passes its own, not ours)
function filesFromArgv(argv, cwd) {
  const out = [];
  const args = argv.slice(app.isPackaged ? 1 : 2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--smoke' || a === '--smoke-only') { i++; continue; }
    if (!a || a.startsWith('-')) continue;
    try { const p = path.resolve(cwd || process.cwd(), a); if (OPENABLE_EXT.has(extOf(p)) && fs.statSync(p).isFile()) out.push(p); } catch {}
  }
  return out;
}
function sendOpen(files) {
  if (!files.length) return;
  if (win && !win.isDestroyed() && !win.webContents.isLoading()) files.forEach(f => win.webContents.send('open-path', f));
  else pending.push(...files);
}

// A second launch hands its files to the running copy and stops before any other startup work.
const SECOND_INSTANCE = !SMOKE && !app.requestSingleInstanceLock();
if (SECOND_INSTANCE) app.exit(0);
else if (!SMOKE) {
  app.on('second-instance', (_e, argv, cwd) => {
    sendOpen(filesFromArgv(argv, cwd));
    if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
  });
}
app.on('open-file', (e, p) => { e.preventDefault(); sendOpen([p]); }); // macOS

// ---------- small helpers ----------
const userData = (...p) => path.join(app.getPath('userData'), ...p);
const delay = ms => new Promise(r => setTimeout(r, ms));
function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tmp, data);
    try { fs.renameSync(tmp, file); }
    catch { fs.writeFileSync(file, data); try { fs.unlinkSync(tmp); } catch {} }
  } catch (e) { try { fs.unlinkSync(tmp); } catch {} throw e; }
}
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
// File-system failures in words people can act on. `what`: 'save the file', 'open the file', 'export the document' …
function friendlyError(e, what = 'do that') {
  if (e && e.plain) return e;
  const code = e && e.code;
  const write = !/^(open|read)/.test(what);
  const details = `${code || 'error'}: ${(e && e.message) || e}`;
  const o = actions => ({ actions: [...actions, ACT.details(details)], details, code });
  if (code === 'EBUSY') return userError(`Close the file in the other program (for example Word), then try again${write ? ', or save to another folder' : ''}. Another program is using it, so Markooj could not ${what}.`, o(write ? [ACT.retry, ACT.saveAs] : [ACT.retry]));
  if (code === 'EPERM' || code === 'EACCES' || code === 'EROFS') return write
    ? userError(`Save to another folder, such as Documents, or close the file in the program that has it open and try again. The file is read-only, in use, or in a protected folder, so Markooj could not ${what}.`, o([ACT.saveAs, ACT.retry]))
    : userError('Copy the file to a folder such as Documents and open it from there, or close it in the program that has it open and try again. Markooj is not allowed to read it where it is.', o([ACT.retry, ACT.openFile]));
  if (code === 'ENOENT') return write
    ? userError('Save to another folder: this one is no longer there. It may have been moved or renamed, or its drive was removed. Your text is still open in Markooj.', o([ACT.saveAs]))
    : userError('Choose the file again: it may have been moved, renamed or deleted, or its drive was removed.', o([ACT.openFile]));
  if (code === 'ENOSPC') return userError(`Free some space on the disk, or save to another drive, then try again. The disk is full, so Markooj could not ${what}. Your text is still open in Markooj.`, o([ACT.saveAs, ACT.retry]));
  if (code === 'ENAMETOOLONG') return userError(`Choose a shorter file name or a folder nearer the top of the drive, then try again. The name or folder path is too long, so Markooj could not ${what}.`, o(write ? [ACT.saveAs] : [ACT.openFile]));
  if (code === 'EMFILE' || code === 'ENFILE') return userError(`Close a few programs or tabs, then try again. Your computer has too many files open right now, so Markooj could not ${what}.`, o([ACT.retry]));
  return e instanceof Error ? e : new Error(String(e));
}
async function mkWork() { return fsp.mkdtemp(path.join(os.tmpdir(), 'markooj-')); }
function rmWork(dir) { if (dir) fsp.rm(dir, { recursive: true, force: true }).catch(() => {}); }

// ---------- settings (userData/settings.json) ----------
let settings = null;
function loadSettings() { if (!settings) settings = readJson(userData('settings.json'), {}) || {}; return settings; }
function saveSettings() { try { writeAtomic(userData('settings.json'), JSON.stringify(settings, null, 2)); } catch (e) { console.error('settings write failed', e); } }
const retentionDays = () => Math.max(7, Number(loadSettings().recoveryDays) || 7);
function applyTheme() {
  const t = loadSettings().theme;
  nativeTheme.themeSource = t === 'dark' || t === 'light' ? t : 'system';
}
const bgColor = () => (nativeTheme.shouldUseDarkColors ? '#1c1c1e' : '#f5f5f7');

// ---------- bundled tools ----------
const TOOL_DIRS = { pandoc: 'pandoc', ddjvu: 'djvulibre', djvutxt: 'djvulibre', djvused: 'djvulibre', djvm: 'djvulibre', c44: 'djvulibre', pdf2djvu: 'pdf2djvu' };
const toolCache = new Map();
function which(cmd) {
  return new Promise(res => execFile(process.platform === 'win32' ? 'where' : 'which', [cmd], { windowsHide: true }, (err, out) => res(err ? null : (String(out).split(/\r?\n/)[0] || '').trim() || null)));
}
// Bundled tools: resources/vendor in a packaged copy (electron-builder copies vendor/win32, vendor/darwin-<arch> or
// vendor/linux-<arch> there); in a checkout, the folder scripts/fetch-tools.js fills for this platform and architecture.
function vendorBases() {
  const b = [];
  if (app.isPackaged) b.push(path.join(process.resourcesPath, 'vendor'));
  if (process.platform !== 'win32') b.push(path.join(APP_ROOT, 'vendor', `${process.platform}-${process.arch}`));
  b.push(path.join(APP_ROOT, 'vendor', process.platform));
  return b;
}
// Programs a Mac app started from Finder or the Dock cannot see on PATH (Homebrew, MacPorts); on Linux the usual
// places, for desktop launchers that start Markooj with a short PATH.
const SYSTEM_TOOL_DIRS = process.platform === 'darwin' ? ['/opt/homebrew/bin', '/usr/local/bin', '/opt/local/bin']
  : process.platform === 'linux' ? ['/usr/bin', '/usr/local/bin', '/snap/bin', '/home/linuxbrew/.linuxbrew/bin'] : [];
// On macOS and Linux only Pandoc ships inside Markooj; DjVuLibre and pdf2djvu come from Homebrew or the package manager.
const toolShipped = id => process.platform === 'win32' || id === 'pandoc';
async function findTool(name) {
  const exe = process.platform === 'win32' ? name + '.exe' : name;
  const sub = TOOL_DIRS[name] || name;
  for (const base of vendorBases()) {
    for (const c of [path.join(base, sub, exe), path.join(base, sub, 'bin', exe), path.join(base, exe), path.join(base, 'djvulibre', exe)]) {
      if (fs.existsSync(c)) return { path: c, bundled: true };
    }
  }
  if (process.platform === 'win32') {
    const pf = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs'), process.env.LOCALAPPDATA].filter(Boolean);
    const guesses = name === 'pandoc' ? pf.map(d => path.join(d, 'Pandoc', exe)) : pf.map(d => path.join(d, 'DjVuLibre', exe));
    for (const g of guesses) if (fs.existsSync(g)) return { path: g, bundled: false };
  }
  const w = await which(name);
  if (w) return { path: w, bundled: false };
  for (const d of SYSTEM_TOOL_DIRS) { const g = path.join(d, exe); if (fs.existsSync(g)) return { path: g, bundled: false }; }
  return null;
}
const toolNames = new Map(); // resolved program path (lower case) → tool name, to name a tool that stops working
const normTool = p => path.resolve(String(p || '')).toLowerCase();
function tool(name) {
  if (!toolCache.has(name)) toolCache.set(name, findTool(name).then(r => { if (r) toolNames.set(normTool(r.path), name); return r; }));
  return toolCache.get(name);
}
async function toolPath(name) { const t = await tool(name); return t ? t.path : null; }

// ---------- tools self-check (IPC 'tools-health'; src/health.js shows the result) ----------
// Each program is started once with a version call (cached). The cache is dropped when a program it found
// is gone from disk, when the renderer asks for a refresh, and when a tool fails to start during an export.
const HEALTH_TOOLS = [
  { id: 'pandoc', label: 'Pandoc', args: ['--version'], ver: /pandoc(?:\.exe)?\s+v?(\d+(?:\.\d+)+)/i },
  { id: 'pdf2djvu', label: 'pdf2djvu', args: ['--version'], ver: /pdf2djvu\s+(\d+(?:\.\d+)+)/i },
  { id: 'ddjvu', label: 'DjVuLibre', args: ['--help'], ver: /DjVuLibre-(\d+(?:\.\d+)+)/i },
];
const TOOL_LABEL = { pandoc: 'Pandoc', pdf2djvu: 'pdf2djvu', ddjvu: 'DjVuLibre (ddjvu)', djvutxt: 'DjVuLibre (djvutxt)', djvused: 'DjVuLibre (djvused)', djvm: 'DjVuLibre (djvm)', c44: 'DjVuLibre (c44)' };
// a packaged Windows copy always carries the tools; a dev checkout has them after `npm run fetch-tools`
const bundleExpected = () => process.platform === 'win32' && (app.isPackaged || fs.existsSync(path.join(APP_ROOT, 'vendor', 'win32', 'MANIFEST.json')));
// What each tool is for, and where its official download page is. djvutxt, djvused, djvm and c44 belong to DjVuLibre.
const TOOL_INFO = {
  pandoc: { label: 'Pandoc', goal: 'save as OpenDocument, Rich Text, LaTeX and more', url: 'https://pandoc.org/installing.html', getLabel: 'Get Pandoc' },
  pdf2djvu: { label: 'pdf2djvu', goal: 'save as DjVu', url: 'https://jwilk.net/software/pdf2djvu', getLabel: 'Get pdf2djvu' },
  ddjvu: { label: 'DjVuLibre', goal: 'open DjVu files', url: 'https://djvu.sourceforge.net/', getLabel: 'Get DjVuLibre' },
};
const toolFamily = id => (id === 'pandoc' || id === 'pdf2djvu' ? id : 'ddjvu');
const BREW_DJVU = 'brew install djvulibre pdf2djvu';
const APT_DJVU = 'sudo apt install djvulibre-bin pdf2djvu';
const DNF_DJVU = 'sudo dnf install djvulibre pdf2djvu';
/** How to get a tool that is not there, on this computer: {text, steps, actions}. Pure: everything comes from `ctx`. */
function toolRemedy(id, ctx = {}) {
  const platform = ctx.platform || process.platform;
  const packaged = 'packaged' in ctx ? !!ctx.packaged : app.isPackaged;
  const portable = 'portable' in ctx ? !!ctx.portable : USER_DATA_FROM === 'portable';
  const fam = toolFamily(id), T = TOOL_INFO[fam];
  const shipped = platform === 'win32' || fam === 'pandoc';
  if (shipped && !packaged) return {
    text: `Run npm run fetch-tools in the Markooj folder, then check again. Or install ${T.label} yourself.`,
    steps: [{ text: 'In the Markooj folder, run:', command: 'npm run fetch-tools' }],
    actions: [ACT.copy('Copy command', 'npm run fetch-tools'), ACT.url(T.getLabel, T.url), ACT.checkTools],
  };
  if (shipped) return {
    text: portable
      ? `Unzip the full portable zip again into a new folder: that puts ${T.label} back, and your data folder can move with it. Or install ${T.label} yourself.`
      : `Download Markooj again and install it over this copy: that puts ${T.label} back, and your documents and settings stay. Or install ${T.label} yourself.`,
    steps: [{ text: portable ? 'Download the portable zip again and unzip all of it into a new folder.' : 'Download Markooj again and install it over this copy.' }, { text: `Or install ${T.label} from its official page.` }],
    actions: [ACT.url('Repair Markooj', DOWNLOAD_URL), ACT.url(T.getLabel, T.url), ACT.checkTools],
  };
  if (platform === 'darwin') return {
    text: `Install the free DjVu tools with Homebrew: open Terminal and run ${BREW_DJVU}, then check again.`,
    steps: [{ text: 'If you do not have Homebrew yet, get it from brew.sh.' }, { text: 'Then open Terminal and run:', command: BREW_DJVU }],
    actions: [ACT.copy('Copy command', BREW_DJVU), ACT.url('Get Homebrew', 'https://brew.sh'), ACT.checkTools],
  };
  return {
    text: `Install the free DjVu tools from a terminal: ${APT_DJVU} (Debian, Ubuntu) or ${DNF_DJVU} (Fedora), then check again.`,
    steps: [{ text: 'Debian, Ubuntu and Mint:', command: APT_DJVU }, { text: 'Fedora:', command: DNF_DJVU }],
    actions: [ACT.copy('Copy apt command', APT_DJVU), ACT.copy('Copy dnf command', DNF_DJVU), ACT.checkTools],
  };
}
/** The error for a feature whose tool is not there: what to do first, then what still works. */
function toolNeeded(id, goal) {
  const fam = toolFamily(id), T = TOOL_INFO[fam], r = toolRemedy(id);
  return userError(`To ${goal || T.goal}, Markooj needs the free ${T.label} ${fam === 'ddjvu' ? 'tools' : 'program'}. ${r.text} Everything else works.`,
    { actions: r.actions, code: 'TOOL_MISSING', tool: fam, details: `${TOOL_LABEL[id] || id} was not found (${process.platform}, ${app.isPackaged ? 'installed copy' : 'source checkout'}).` });
}
// the short fix line kept in the health result (`fix`) for the first tool that needs attention
function toolFixHint(ids) {
  const id = (ids && ids[0]) || 'pandoc';
  return toolRemedy(id).text;
}
function probeTool(cmd, args) {
  return new Promise(res => {
    try {
      execFile(cmd, args, { windowsHide: true, timeout: 60000, maxBuffer: 1 << 20 }, (err, out, errOut) => {
        const text = `${out || ''}\n${errOut || ''}`;
        if (err && typeof err.code === 'string') return res({ started: false, code: err.code, out: text });
        res({ started: true, code: err ? (err.code ?? (err.killed ? 'timeout' : 1)) : 0, out: text });
      });
    } catch (e) { res({ started: false, code: e.code || e.message, out: '' }); }
  });
}
/** Does a probe ({started, code, out}) show that a tool works? Pure, so the smoke test can feed it real outputs.
 *  → {ok, version, usage, state: 'ok'|'blocked'|'failed'} */
function toolAnswered(id, probe) {
  const t = HEALTH_TOOLS.find(x => x.id === id);
  const out = String((probe && probe.out) || '');
  if (!probe || !probe.started) return { ok: false, version: null, usage: false, state: /^(EPERM|EACCES|UNKNOWN|EBUSY)$/.test(String(probe && probe.code)) ? 'blocked' : 'failed' };
  // DjVuLibre's programs (ddjvu, djvutxt, djvused, djvm, c44) share one version line: "DJVUSED --- DjVuLibre-3.5.29"
  const djvu = /^(ddjvu|djvutxt|djvused|djvm|c44)$/.test(id);
  const ver = t ? t.ver : djvu ? /DjVuLibre-(\d+(?:\.\d+)+)/i : null;
  const m = ver ? ver.exec(out) : null;
  // The official SourceForge DjVuLibre for Windows prints no version with --help and exits 1 (djvutxt and djvused
  // exit 10); its usage text ("DjVu decompression utility", "Usage: djvutxt …") is still proof that it runs.
  const usage = djvu && (/DjVu [a-z ]*utility/i.test(out) || new RegExp(`Usage:\\s*${id}\\b`, 'i').test(out));
  const ok = !!m || probe.code === 0 || usage;
  return { ok, version: m ? m[1] : null, usage, state: ok ? 'ok' : 'failed' };
}
async function checkTools() {
  const tools = {};
  await Promise.all(HEALTH_TOOLS.map(async t => {
    const found = await tool(t.id);
    const r = { id: t.id, label: t.label, ok: false, state: 'missing', path: found ? found.path : null, bundled: !!(found && found.bundled), version: null, error: null };
    if (!found) r.error = 'not found';
    else {
      const p = await probeTool(found.path, t.args);
      const v = toolAnswered(t.id, p);
      r.version = v.version;
      // the bundled DjVuLibre package (3.5.30-2) prints an older version of its own (3.5.29): show both, as the notices do
      if (t.id === 'ddjvu' && found.bundled && r.version) {
        for (const dir of vendorBases()) {
          try { const mf = JSON.parse(fs.readFileSync(path.join(dir, 'MANIFEST.json'), 'utf8')); const pv = mf?.tools?.djvulibre?.version; if (pv && pv !== r.version) r.version += ` (package ${pv})`; break; } catch {}
        }
      }
      // a DjVuLibre that only printed its usage text: the version comes from the bundled MANIFEST.json
      if (v.usage && !r.version && found.bundled) {
        for (const dir of vendorBases()) {
          try { const mf = JSON.parse(fs.readFileSync(path.join(dir, 'MANIFEST.json'), 'utf8')); if (mf?.tools?.djvulibre?.version) { r.version = mf.tools.djvulibre.version; break; } } catch {}
        }
      }
      r.ok = v.ok;
      r.state = v.state;
      if (!p.started) r.error = `could not start (${p.code})`;
      else if (!r.ok) r.error = `did not answer as expected (exit ${p.code})`;
      if (!r.ok) r.output = String(p.out || '').trim().slice(0, 600);
    }
    // how to get it, for a tool that is not there (a tool that is there but failed gets "Check again" and "Copy details")
    if (r.state === 'missing') r.remedy = toolRemedy(t.id);
    tools[t.id] = r;
  }));
  const ids = HEALTH_TOOLS.map(t => t.id);
  const expected = bundleExpected();
  const missingIds = ids.filter(id => !tools[id].ok);
  return {
    ok: ids.every(id => tools[id].ok), missing: missingIds,
    notBundled: expected ? ids.filter(id => tools[id].ok && !tools[id].bundled) : [],
    tools, bundleExpected: expected, packaged: app.isPackaged, platform: process.platform, version: app.getVersion(),
    toolsDir: vendorBases().find(d => fs.existsSync(d)) || vendorBases()[0],
    portable: USER_DATA_FROM === 'portable', fix: toolFixHint(missingIds), checkedAt: Date.now(),
    downloadUrl: DOWNLOAD_URL, issuesUrl: ISSUES_URL,
  };
}
let healthP = null, healthLast = null;
function toolsHealth(refresh) {
  // a cached answer is trusted only while the programs it found are still on disk
  if (!refresh && healthLast && Object.values(healthLast.tools).some(t => t.ok && t.path && !fs.existsSync(t.path))) refresh = true;
  if (refresh) { toolCache.clear(); toolNames.clear(); pandocInfoP = null; healthP = null; }
  if (!healthP) healthP = checkTools().then(r => (healthLast = r)).catch(e => { healthP = null; throw e; });
  return healthP;
}
// a tool failed to start while Markooj was running: check everything again and tell the window
function recheckTools(reason, toolId) {
  return toolsHealth(true).then(r => {
    const o = { ...r, reason, failedTool: toolId || null };
    if (win && !win.isDestroyed()) win.webContents.send('tools-health', o);
    return o;
  }).catch(e => { console.error('tools re-check failed', e); return null; });
}
// called by run() when a program could not start; returns a plain-English error, or null for programs that are not tools
function toolGone(cmd, err) {
  const name = toolNames.get(normTool(cmd));
  if (!name) return null;
  const fam = toolFamily(name), T = TOOL_INFO[fam];
  const missing = !fs.existsSync(cmd);
  const details = `${TOOL_LABEL[name] || name}: ${cmd} (${err.code})`;
  let e;
  if (missing) {
    const r = toolRemedy(name);
    e = userError(`To ${T.goal} again, put ${T.label} back. ${r.text} (${T.label} was moved or deleted while Markooj was running.) Everything else works.`,
      { actions: r.actions, details, code: 'TOOL_GONE', tool: fam });
  } else {
    e = userError(`Allow ${T.label} in your security software, then try again. Your computer did not let it start, so Markooj could not ${T.goal}. Everything else works.`,
      { actions: [ACT.retry, ACT.checkTools, ACT.details(details), ACT.report], details, code: 'TOOL_GONE', tool: fam });
  }
  e.tool = name;
  recheckTools(missing ? 'missing-during-use' : 'blocked-during-use', name);
  return e;
}

function run(cmd, args, opts = {}) {
  return new Promise((res, rej) => execFile(cmd, args, { maxBuffer: 1 << 29, windowsHide: true, timeout: 180000, encoding: opts.encoding || 'utf8', ...opts }, (err, out, errOut) => {
    if (err) {
      // the program itself could not start (a string code such as ENOENT, not an exit number): a bundled tool that was
      // there at startup may have been deleted or quarantined while Markooj runs. Say so plainly and check all tools again.
      if (typeof err.code === 'string' && /^(ENOENT|EACCES|EPERM|UNKNOWN|EBUSY)$/.test(err.code)) {
        const gone = toolGone(cmd, err);
        if (gone) return rej(gone);
      }
      const msg = String(errOut || '').trim() || err.message;
      const e = new Error(msg.length > 600 ? msg.slice(0, 600) + '…' : msg); e.code = err.code; e.toolOutput = msg.slice(0, 4000); return rej(e);
    }
    res(out);
  }));
}

// Pandoc capabilities (version, formats, extensions), probed once.
let pandocInfoP = null;
function pandocInfo() {
  if (!pandocInfoP) pandocInfoP = (async () => {
    const p = await toolPath('pandoc');
    if (!p) return null;
    try {
      const [ver, outs, ins, exts] = await Promise.all([
        run(p, ['--version']), run(p, ['--list-output-formats']), run(p, ['--list-input-formats']), run(p, ['--list-extensions=markdown']),
      ]);
      const m = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(ver) || [];
      return {
        path: p, version: m[0] || '?', major: +m[1] || 0, minor: +m[2] || 0,
        outputs: new Set(outs.split(/\r?\n/).map(s => s.trim()).filter(Boolean)),
        inputs: new Set(ins.split(/\r?\n/).map(s => s.trim()).filter(Boolean)),
        exts: new Set(exts.split(/\r?\n/).map(s => s.trim().replace(/^[+-]/, '')).filter(Boolean)),
      };
    } catch (e) { console.error('pandoc probe failed', e); return null; }
  })();
  return pandocInfoP;
}
const withExts = (info, base, list) => base + list.filter(x => info.exts.has(x.slice(1))).join('');
// Markdown that markdown-it (our renderer) reads well.
const mdWriter = info => withExts(info, 'markdown', ['-grid_tables', '-multiline_tables', '-simple_tables', '+pipe_tables', '-bracketed_spans', '-native_spans', '-native_divs', '-link_attributes', '-header_attributes', '-raw_attribute', '-smart', '-fenced_code_attributes', '+tex_math_dollars', '+yaml_metadata_block', '+footnotes', '+task_lists']);
// What our documents contain: LaTeX math in every delimiter, ==mark==, tasks, wikilinks.
// YAML blocks are read by Markooj (cleaned of file paths) and handed over as a metadata file, never by Pandoc itself.
const mdReader = info => withExts(info, 'markdown', ['+tex_math_dollars', '+tex_math_single_backslash', '+mark', '+task_lists', '+wikilinks_title_after_pipe', '-yaml_metadata_block', '+footnotes', '+pipe_tables', '+raw_html', '+latex_macros']);
// File → Render as (front matter markooj-flavor) picks the Pandoc reader for exports
function readerFor(info, flavor) {
  const f = String(flavor || '').toLowerCase();
  const has = n => info.inputs.has(n);
  if (/^github|gfm/.test(f) && has('gfm')) return 'gfm-yaml_metadata_block+tex_math_dollars';
  if (/^commonmark/.test(f) && has('commonmark_x')) return 'commonmark_x-yaml_metadata_block';
  if (/^multimarkdown/.test(f) && has('markdown_mmd')) return 'markdown_mmd-yaml_metadata_block-mmd_title_block+tex_math_dollars';
  return mdReader(info);
}

// ---------- text decoding ----------
function decodeText(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.slice(3).toString('utf8');
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.slice(2).toString('utf16le');
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) { const b = Buffer.from(buf.slice(2)); b.swap16(); return b.toString('utf16le'); }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { try { return new TextDecoder('windows-1252').decode(buf); } catch { return buf.toString('latin1'); } }
}
const readText = p => decodeText(fs.readFileSync(p));

// ---------- MIME ----------
const MIME = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', xhtml: 'application/xhtml+xml', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', cjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', map: 'application/json', wasm: 'application/wasm', txt: 'text/plain; charset=utf-8', md: 'text/markdown; charset=utf-8',
  xml: 'application/xml', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon', tif: 'image/tiff', tiff: 'image/tiff',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', eot: 'application/vnd.ms-fontobject', pfb: 'application/octet-stream', bcmap: 'application/octet-stream',
  pdf: 'application/pdf', zip: 'application/zip', whl: 'application/zip', tar: 'application/x-tar', gz: 'application/gzip', data: 'application/octet-stream', py: 'text/x-python; charset=utf-8',
  mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
};
const mimeOf = p => MIME[extOf(p)] || 'application/octet-stream';
const LOCAL_MEDIA = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg', 'mp4', 'webm', 'ogv', 'mp3', 'wav', 'ogg', 'm4a', 'flac']);

// In-memory pages for print / PDF export, served next to index.html so relative URLs behave the same.
const virtualPages = new Map();

async function handleProtocol(req) {
  let u;
  try { u = new URL(req.url); } catch { return new Response('Bad request', { status: 400 }); }
  const headers = { 'cache-control': 'no-cache', 'access-control-allow-origin': '*', 'x-content-type-options': 'nosniff' };
  let full;
  try {
    const rel = decodeURIComponent(u.pathname);
    if (u.host === 'app') {
      const v = virtualPages.get(rel);
      if (v) return new Response(v, { status: 200, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
      full = path.resolve(APP_ROOT, '.' + rel);
      if (full !== APP_ROOT && !full.startsWith(APP_ROOT + path.sep)) return new Response('Forbidden', { status: 403 });
    } else if (u.host === 'local') {
      // pictures and media that sit next to a user's document (markooj://local/C:/path/fig.png)
      // Never a network path: opening \\host\share\x.png over SMB would hand the user's Windows (NTLM) hash to that host.
      const stripped = process.platform === 'win32' ? rel.replace(/^\/(?=[A-Za-z]:)/, '') : rel;
      if (/^[\\/]{2}|^\/\\|^\\\//.test(stripped) || /^[A-Za-z]:[\\/]{2}/.test(stripped)) return new Response('Forbidden', { status: 403 });
      full = path.resolve(stripped);
      if (/^[\\/]{2}/.test(full)) return new Response('Forbidden', { status: 403 }); // also \\?\ and \\.\ forms
      if (!LOCAL_MEDIA.has(extOf(full))) return new Response('Forbidden', { status: 403 });
    } else return new Response('Not found', { status: 404 });
  } catch { return new Response('Bad request', { status: 400 }); }
  try {
    const st = await fsp.stat(full);
    if (st.isDirectory()) return new Response('Not found', { status: 404 });
    const data = await fsp.readFile(full);
    return new Response(data, { status: 200, headers: { ...headers, 'content-type': mimeOf(full), 'content-length': String(data.length) } });
  } catch { return new Response('Not found', { status: 404 }); }
}

// ---------- window ----------
let crashTimes = [];
let closeRequestedAt = 0;
function windowBounds() {
  const s = loadSettings().window || {};
  const b = { width: Math.max(760, s.width || 1320), height: Math.max(520, s.height || 880) };
  if (Number.isFinite(s.x) && Number.isFinite(s.y)) {
    const area = screen.getDisplayMatching({ x: s.x, y: s.y, width: b.width, height: b.height }).workArea;
    const visible = s.x + 80 < area.x + area.width && s.x + b.width - 80 > area.x && s.y >= area.y - 10 && s.y + 40 < area.y + area.height;
    if (visible) { b.x = s.x; b.y = s.y; }
  }
  return { ...b, maximized: !!s.maximized };
}
function rememberBounds() {
  if (!win || win.isDestroyed() || SMOKE) return;
  const s = loadSettings();
  const prev = s.window || {};
  const maximized = win.isMaximized();
  const b = maximized || win.isMinimized() || win.isFullScreen() ? (prev.width ? prev : win.getNormalBounds()) : win.getBounds();
  s.window = { x: b.x, y: b.y, width: b.width, height: b.height, maximized };
  saveSettings();
}
let boundsTimer = null;
const rememberBoundsSoon = () => { clearTimeout(boundsTimer); boundsTimer = setTimeout(rememberBounds, 600); };

function createWindow() {
  const b = windowBounds();
  win = new BrowserWindow({
    x: b.x, y: b.y, width: SMOKE ? 1320 : b.width, height: SMOKE ? 880 : b.height, minWidth: 760, minHeight: 520,
    show: false, title: 'Markooj', backgroundColor: bgColor(),
    ...(fs.existsSync(path.join(APP_ROOT, 'build', 'icon.png')) ? { icon: path.join(APP_ROOT, 'build', 'icon.png') } : {}), // dev runs and Linux; packaged Windows/macOS use the exe icon
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(APP_ROOT, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false,
      spellcheck: true, webviewTag: false, backgroundThrottling: !SMOKE,
    },
  });
  // No default menu: it would claim Ctrl+R (reload), which the editor uses for Align right.
  // macOS needs an Edit menu for Cmd+C/V/X/A/Z to reach text fields, so it gets a minimal one.
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: 'appMenu' },
      { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'pasteAndMatchStyle' }, { role: 'selectAll' }] },
      { role: 'windowMenu' },
    ]));
  } else Menu.setApplicationMenu(null);
  const wc = win.webContents;
  if (SMOKE) {
    // painted but invisible, so capturePage works
    win.setOpacity(0); win.showInactive();
  } else {
    win.once('ready-to-show', () => { if (b.maximized) win.maximize(); win.show(); });
  }
  win.loadURL(START_URL);

  wc.on('did-finish-load', () => {
    STARTUP_DONE = true; // from here on a main-process error is logged, not shown as a startup failure
    pending.splice(0).forEach(f => wc.send('open-path', f));
    if (SMOKE) {
      // resend until the renderer has picked it up (runSmoke ignores repeats)
      wc.send('smoke', SMOKE, SMOKE_ONLY);
      const again = setInterval(async () => {
        if (smokeDone || wc.isDestroyed()) return clearInterval(again);
        let started = false; try { started = await wc.executeJavaScript('!!window.__mkSmokeStarted'); } catch {}
        if (started) clearInterval(again); else wc.send('smoke', SMOKE, SMOKE_ONLY);
      }, 4000);
    }
  });
  wc.on('did-fail-load', (_e, code, desc, url, isMain) => {
    if (isMain && SMOKE) finishSmoke({ error: `Page failed to load: ${desc} (${code}) ${url}` }, 1);
  });
  wc.on('console-message', (...a) => {
    const ev = a[0] || {};
    const level = ev.level != null ? ev.level : a[1];
    const message = ev.message != null ? ev.message : a[2];
    const src = ev.sourceId != null ? ev.sourceId : a[4];
    const line = ev.lineNumber != null ? ev.lineNumber : a[3];
    if (SMOKE && (level === 'error' || level === 'warning' || level === 3 || level === 2)) smokeLog.push({ level: String(level), message: String(message), source: `${src || ''}:${line || ''}` });
  });
  wc.setWindowOpenHandler(({ url }) => { if (/^(https?|mailto):/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  wc.on('will-navigate', (e, url) => {
    if (url.split('#')[0] === START_URL) return;
    e.preventDefault();
    if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
  });
  wc.on('will-attach-webview', e => e.preventDefault());
  wc.setVisualZoomLevelLimits(1, 1).catch(() => {});
  wc.on('before-input-event', (_e, input) => {
    if (input.type !== 'keyDown') return;
    // F12 is Word's Save As (word-keys.js), so DevTools is Ctrl+Shift+I only
    if (input.control && input.shift && !input.alt && input.key.toLowerCase() === 'i') wc.toggleDevTools();
  });
  wc.on('context-menu', (_e, p) => showContextMenu(wc, p));
  wc.on('render-process-gone', (_e, d) => {
    if (d.reason === 'clean-exit') return;
    SESSION = newId(); // open documents of the crashed page become "crashed" recovery entries
    if (SMOKE) return finishSmoke({ error: `Renderer gone: ${d.reason}` }, 1);
    const now = Date.now();
    crashTimes = crashTimes.filter(t => now - t < 60000).concat(now);
    if (crashTimes.length <= 3) setTimeout(() => { if (win && !win.isDestroyed()) win.loadURL(START_URL); }, 400);
    else dialog.showMessageBox(win, { type: 'error', message: 'Reload Markooj, or close it and start it again.', detail: 'The window stopped a few times in a row. Your unsaved text is kept in File → Recover.', buttons: ['Reload', 'Close'] })
      .then(r => { if (r.response === 0) win.loadURL(START_URL); else { win.__forceClose = true; win.close(); } });
  });
  wc.on('unresponsive', async () => {
    if (SMOKE || !win || win.isDestroyed()) return;
    const r = await dialog.showMessageBox(win, { type: 'warning', message: 'Wait a moment, or reload the window.', detail: 'Markooj is not responding right now. Unsaved text is kept in File → Recover.', buttons: ['Wait', 'Reload'], defaultId: 0, cancelId: 0 });
    if (r.response === 1) { SESSION = newId(); wc.forcefullyCrashRenderer(); win.loadURL(START_URL); }
  });

  win.on('resize', rememberBoundsSoon);
  win.on('move', rememberBoundsSoon);
  win.on('maximize', rememberBounds);
  win.on('unmaximize', rememberBounds);
  win.on('close', async e => {
    if (win.__forceClose || SMOKE) { rememberBounds(); return; }
    e.preventDefault();
    let ok = false;
    try { ok = await Promise.race([wc.executeJavaScript('!!(window.app && window.mk)', true), delay(1500).then(() => false)]); } catch {}
    if (!ok) { win.__forceClose = true; win.close(); return; } // page never loaded or is broken: nothing to ask about
    const now = Date.now();
    if (closeRequestedAt && now - closeRequestedAt > 10000) {
      const r = await dialog.showMessageBox(win, { type: 'question', message: 'Close Markooj anyway?', detail: 'Markooj did not finish closing. Unsaved text is kept in File → Recover.', buttons: ['Close anyway', 'Cancel'], defaultId: 1, cancelId: 1 });
      if (r.response === 0) { win.__forceClose = true; win.close(); return; }
    }
    closeRequestedAt = now;
    wc.send('request-close');
  });
  win.on('closed', () => { win = null; });
}

function showContextMenu(wc, p) {
  const t = [];
  if (p.misspelledWord) {
    for (const s of (p.dictionarySuggestions || []).slice(0, 6)) t.push({ label: s, click: () => wc.replaceMisspelling(s) });
    if (!(p.dictionarySuggestions || []).length) t.push({ label: 'No spelling suggestions', enabled: false });
    t.push({ label: 'Add to dictionary', click: () => wc.session.addWordToSpellCheckerDictionary(p.misspelledWord) });
    t.push({ type: 'separator' });
  }
  const ef = p.editFlags || {};
  if (p.isEditable) t.push({ label: 'Cut', role: 'cut', accelerator: 'CmdOrCtrl+X', enabled: !!ef.canCut });
  t.push({ label: 'Copy', role: 'copy', accelerator: 'CmdOrCtrl+C', enabled: !!ef.canCopy || !!p.selectionText });
  if (p.isEditable) {
    t.push({ label: 'Paste', role: 'paste', accelerator: 'CmdOrCtrl+V', enabled: !!ef.canPaste });
    t.push({ label: 'Paste as plain text', role: 'pasteAndMatchStyle', accelerator: 'CmdOrCtrl+Shift+V', enabled: !!ef.canPaste });
  }
  t.push({ type: 'separator' }, { label: 'Select all', role: 'selectAll', accelerator: 'CmdOrCtrl+A' });
  const sel = (p.selectionText || '').trim();
  if (sel && sel.length <= 40 && !/\s/.test(sel)) {
    const short = sel.length > 24 ? sel.slice(0, 24) + '…' : sel;
    t.push({ type: 'separator' });
    if (process.platform === 'darwin') t.push({ label: `Look up “${short}”`, click: () => wc.showDefinitionForSelection() });
    else t.push({ label: `Look up “${short}” online`, click: () => shell.openExternal('https://www.merriam-webster.com/dictionary/' + encodeURIComponent(sel.toLowerCase())) });
  }
  if (p.linkURL && /^(https?|mailto):/i.test(p.linkURL)) {
    t.push({ type: 'separator' }, { label: 'Open link in browser', click: () => shell.openExternal(p.linkURL) }, { label: 'Copy link', click: () => require('electron').clipboard.writeText(p.linkURL) });
  }
  if (p.mediaType === 'image' && p.hasImageContents) t.push({ type: 'separator' }, { label: 'Copy image', click: () => wc.copyImageAt(p.x, p.y) });
  Menu.buildFromTemplate(t).popup({ window: BrowserWindow.fromWebContents(wc) || undefined });
}

if (!SECOND_INSTANCE) app.whenReady().then(() => {
  loadSettings(); applyTheme();
  protocol.handle(SCHEME, handleProtocol);
  const ses = session.defaultSession;
  try {
    if (process.platform === 'linux') ses.setSpellCheckerDictionaryDownloadURL(require('url').pathToFileURL(path.join(app.isPackaged ? process.resourcesPath : APP_ROOT, 'dictionaries')).href + '/'); // never download
    const want = ['en-US'];
    const avail = ses.availableSpellCheckerLanguages || [];
    ses.setSpellCheckerLanguages(avail.length ? want.filter(l => avail.includes(l)).concat(avail.includes('en-US') ? [] : avail.filter(l => /^en/.test(l)).slice(0, 1)) : want);
    ses.setSpellCheckerEnabled(true);
  } catch (e) { console.warn('spellchecker', e.message); }
  const denied = new Set(['media', 'geolocation', 'midi', 'midiSysex', 'pointerLock', 'hid', 'serial', 'usb', 'idle-detection', 'display-capture', 'mediaKeySystem', 'speaker-selection', 'keyboardLock', 'window-management']);
  ses.setPermissionRequestHandler((_wc, perm, cb) => cb(!denied.has(perm)));
  ses.setPermissionCheckHandler((_wc, perm) => !denied.has(perm));
  // Opening a document never contacts other servers (a remote picture works as a read receipt) unless
  // Options → Privacy → "Load pictures from the web" is on. Links still open in the browser when clicked.
  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (d, cb) => cb({ cancel: loadSettings().remoteImages !== true }));
  pending.push(...filesFromArgv(process.argv));
  purgeRecovery();
  createWindow();
  nativeTheme.on('updated', () => { if (win && !win.isDestroyed()) win.setBackgroundColor(bgColor()); });
});
app.on('window-all-closed', () => app.quit());
app.on('web-contents-created', (_e, wc) => {
  wc.setWindowOpenHandler(({ url }) => { if (/^(https?|mailto):/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
});

// ---------- smoke helpers ----------
let smokeDone = false;
function finishSmoke(results, code) {
  if (smokeDone || !SMOKE) return; smokeDone = true;
  let exit = code;
  if (exit == null) {
    const all = [];
    const walk = v => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if ('ok' in v && ('name' in v || 'format' in v || 'id' in v)) all.push(v); else Object.values(v).forEach(walk); } };
    walk(results);
    const failed = all.filter(r => r.ok === false).length;
    exit = results && results.ok === false ? 1 : failed ? 1 : 0;
  }
  const report = { at: new Date().toISOString(), exitCode: exit, electron: process.versions.electron, results, console: smokeLog.slice(0, 300) };
  try { fs.writeFileSync(path.join(SMOKE, 'smoke.json'), JSON.stringify(report, null, 2)); } catch (e) { console.error(e); }
  console.log(`[smoke] exit ${exit} → ${path.join(SMOKE, 'smoke.json')}`);
  app.exit(exit);
}
// smoke mode only: the text of one entry in a zip-based file (DOCX, EPUB), for tests that check exported XML
ipcMain.handle('smoke-zip-text', async (_e, file, entry) => {
  if (!SMOKE) throw new Error('Only available in a test run.');
  const zip = await require('jszip').loadAsync(fs.readFileSync(String(file)));
  const names = Object.keys(zip.files);
  if (entry == null) return names;
  const f = zip.file(String(entry)) || zip.file(new RegExp(String(entry)))[0];
  return f ? f.async('string') : null;
});
ipcMain.handle('smoke-shot', async (_e, name) => {
  if (!SMOKE || !win) return null;
  await delay(250);
  const img = await win.webContents.capturePage();
  const file = path.join(SMOKE, String(name || 'shot').replace(/[^\w.-]/g, '_') + '.png');
  fs.writeFileSync(file, img.toPNG());
  return file;
});
ipcMain.handle('smoke-done', async (_e, results) => {
  // Packaging check: a Markdown file passed on the command line (as Explorer does on double-click) must be open as a tab.
  const cli = filesFromArgv(process.argv);
  if (cli.length && win && !win.isDestroyed()) {
    let open = [];
    try { open = await win.webContents.executeJavaScript('(window.app && window.app.docs ? window.app.docs.list() : []).map(d => d.path).filter(Boolean)'); } catch {}
    const norm = p => path.resolve(String(p)).toLowerCase();
    const have = new Set(open.map(norm));
    const checks = cli.map(f => ({ name: `packaging: file from the command line opens as a tab (${path.basename(f)})`, ok: have.has(norm(f)), ...(have.has(norm(f)) ? {} : { error: `Not open. Open tabs: ${open.join(', ') || 'none with a path'}` }) }));
    if (Array.isArray(results)) results.push(...checks);
    else if (results && typeof results === 'object') results.packaging = checks;
    console.log('[smoke] command-line files:', checks.map(c => `${c.ok ? 'PASS' : 'FAIL'} ${c.name}`).join('; '));
  }
  finishSmoke(results);
});

// ---------- basic IPC ----------
ipcMain.handle('confirm-close', () => { closeRequestedAt = 0; if (win) { win.__forceClose = true; win.close(); } });
// Review → Spelling → Add to Dictionary
ipcMain.handle('spell-add', (_e, word) => { const w = String(word || '').trim(); if (w && w.length < 80 && win) win.webContents.session.addWordToSpellCheckerDictionary(w); return true; });
// the renderer answered the close request and the user chose to stay (Cancel, or a save failed)
ipcMain.handle('close-cancelled', () => { closeRequestedAt = 0; });
try { require('./main-langpacks'); } catch (e) { console.warn('language packs', e.message); } // langpack-* IPC (languages role)
try { require('./main-addins'); } catch (e) { console.warn('add-in store', e.message); } // addins-* IPC (store role)
ipcMain.handle('tools', async (_e, opts = {}) => {
  if (opts && opts.refresh) { toolCache.clear(); toolNames.clear(); pandocInfoP = null; healthP = null; }
  const names = ['pandoc', 'pdf2djvu', 'ddjvu', 'djvutxt', 'djvused'];
  const found = await Promise.all(names.map(n => tool(n)));
  const o = {}; names.forEach((n, i) => { o[n] = found[i] ? found[i].path : null; });
  o.bundled = !!(found[0] && found[0].bundled);
  o.bundledAll = Object.fromEntries(names.map((n, i) => [n, !!(found[i] && found[i].bundled)]));
  const info = await pandocInfo();
  o.pandocVersion = info ? info.version : null;
  return o;
});
// startup self-check of the bundled programs: {ok, missing[], notBundled[], tools:{pandoc,pdf2djvu,ddjvu:{ok,path,bundled,version,error}}, fix, ...}
ipcMain.handle('tools-health', (_e, opts = {}) => toolsHealth(!!(opts && opts.refresh)));
const PKG = (() => { try { return require('./package.json'); } catch { return {}; } })();
// electron-builder drops the build field from the packaged package.json, so the copyright line has a fixed fallback
// (LICENSE is the plain AGPL v3 text and carries no copyright line of its own)
const COPYRIGHT = () => (PKG.build && PKG.build.copyright) || 'Copyright © 2026 Ahmed Bilal and contributors';
const urlOf = v => (v && typeof v === 'object' ? v.url : v) || null;
ipcMain.handle('app-info', () => ({
  version: app.getVersion(), userData: app.getPath('userData'), recoveryDir: userData('recovery'), macrosDir: userData('macros'), addonsDir: userData('addons'), platform: process.platform, packaged: app.isPackaged, session: SESSION,
  // portable mode and where the profile lives ('default' | 'portable' | 'env' | 'smoke')
  portable: USER_DATA_FROM === 'portable', userDataFrom: USER_DATA_FROM, portableInfo: { ...PORTABLE, programDir: programDir() },
  // for Help → About
  name: PKG.productName || 'Markooj', author: PKG.author || null, license: PKG.license || null, copyright: COPYRIGHT(),
  homepage: PKG.homepage || null, bugs: urlOf(PKG.bugs), repository: urlOf(PKG.repository) && String(urlOf(PKG.repository)).replace(/^git\+/, '').replace(/\.git$/, ''),
  arch: process.arch, versions: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node },
  resourcesDir: app.isPackaged ? process.resourcesPath : APP_ROOT,
  // license texts for Help → About (read them with mk.invoke('read-text', path)). In a packaged copy LICENSE, licenses/ and the
  // notices are in resources/ only (extraResources, left out of app.asar); a source checkout also serves them at markooj://app/.
  licenseFile: app.isPackaged ? path.join(process.resourcesPath, 'LICENSE.txt') : path.join(APP_ROOT, 'LICENSE'),
  noticesFile: path.join(app.isPackaged ? process.resourcesPath : APP_ROOT, 'THIRD_PARTY_NOTICES.md'),
  licensesDir: path.join(app.isPackaged ? process.resourcesPath : APP_ROOT, 'licenses'),
}));
// smoke only: portable-mode folder selection on throwaway folders (portable.txt, data folder, neither, data as a file)
// smoke only: a known tool whose program vanished (a path that does not exist) must fail with a plain message
// and make main check every tool again and tell the window ('tools-health' event with reason missing-during-use)
// copy text for the window's "Copy command" / "Copy details" buttons (works even while the window is not focused)
ipcMain.handle('clipboard-write', (_e, text) => { require('electron').clipboard.writeText(String(text ?? '').slice(0, 100000)); return true; });
// smoke only: the tool check's decision on a given program output, the remedy for a platform, and the messages for
// file-system errors, so the wording and the decision are tested on every platform
if (SMOKE) ipcMain.handle('tools-verdict', (_e, id, probe) => toolAnswered(String(id), probe || {}));
if (SMOKE) ipcMain.handle('tools-remedy-probe', (_e, id, ctx = {}) => ({ remedy: toolRemedy(String(id), ctx || {}), needed: (() => { const e = toolNeeded(String(id)); return { message: e.message, actions: e.actions, code: e.code, tool: e.tool }; })() }));
if (SMOKE) ipcMain.handle('errors-probe', (_e, codes = []) => (codes || []).map(c => {
  const out = {};
  for (const what of ['save the file', 'open the file']) { const e = friendlyError(Object.assign(new Error(`${c}: test`), { code: c }), what); out[what] = { message: e.message, actions: e.actions || [], details: e.details || '' }; }
  return { code: c, ...out };
}));
// smoke only: throws a message with actions and details, to test that they reach the window (preload mk.errorInfo)
if (SMOKE) ipcMain.handle('errors-probe-throw', () => { throw userError('Try again. This is a test message.', { actions: [ACT.retry, ACT.details('raw test details')], details: 'raw test details', code: 'TEST' }); });
if (SMOKE) ipcMain.handle('tools-simulate-gone', async () => {
  const fake = path.join(os.tmpdir(), `markooj-gone-${crypto.randomBytes(4).toString('hex')}`, process.platform === 'win32' ? 'pandoc.exe' : 'pandoc');
  toolNames.set(normTool(fake), 'pandoc');
  try { await run(fake, ['--version']); return { threw: false }; }
  catch (e) { return { threw: true, code: e.code, tool: e.tool || null, message: e.message, actions: e.actions || [], details: e.details || '' }; }
  finally { toolNames.delete(normTool(fake)); }
});
if (SMOKE) ipcMain.handle('portable-probe', async () => {
  const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'markooj-portable-'));
  const mkCase = async (name, setup) => { const d = path.join(base, name); await fsp.mkdir(d, { recursive: true }); await setup(d); const r = portableDataDir(d); return { name, ...r, dataExists: fs.existsSync(path.join(d, 'data')) && fs.statSync(path.join(d, 'data')).isDirectory(), expectDir: path.join(d, 'data') }; };
  try {
    return {
      cases: [
        await mkCase('none', async () => {}),
        await mkCase('marker', d => fsp.writeFile(path.join(d, 'portable.txt'), 'portable')),
        await mkCase('dataFolder', d => fsp.mkdir(path.join(d, 'data'))),
        await mkCase('dataIsFile', d => fsp.writeFile(path.join(d, 'data'), 'not a folder')),
        await mkCase('markerButDataIsFile', async d => { await fsp.writeFile(path.join(d, 'portable.txt'), ''); await fsp.writeFile(path.join(d, 'data'), 'x'); }),
      ],
      live: { packaged: app.isPackaged, programDir: programDir(), portable: PORTABLE, userDataFrom: USER_DATA_FROM, userData: app.getPath('userData') },
    };
  } finally { fsp.rm(base, { recursive: true, force: true }).catch(() => {}); }
});
ipcMain.handle('user-addons', () => {
  const dir = userData('addons');
  fs.mkdirSync(dir, { recursive: true });
  const bundled = path.join(APP_ROOT, 'addons');
  const list = [];
  for (const d of [bundled, dir]) if (fs.existsSync(d)) for (const f of fs.readdirSync(d).sort()) if (f.endsWith('.js')) {
    try { list.push({ name: f, code: fs.readFileSync(path.join(d, f), 'utf8'), user: d === dir }); } catch {}
  }
  return { dir, list };
});
ipcMain.handle('addon-install', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Install an add-in', properties: ['openFile'], filters: [{ name: 'Markooj add-in (JavaScript)', extensions: ['js'] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  const src = r.filePaths[0];
  const name = path.basename(src).replace(/[^\w.-]/g, '_');
  const dir = userData('addons'); fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, path.join(dir, name));
  return name;
});
ipcMain.handle('reveal', (_e, p) => { if (p) shell.showItemInFolder(path.resolve(p)); });
ipcMain.handle('open-folder', async (_e, p) => { if (!p) return; fs.mkdirSync(p, { recursive: true }); const err = await shell.openPath(path.resolve(p)); if (err) throw userError(`Open the folder yourself in your file manager: ${path.resolve(p)}`, { actions: [ACT.copy('Copy folder path', path.resolve(p))], details: err }); });
ipcMain.handle('open-external', (_e, url) => {
  const u = String(url || '');
  if (!/^(https?:\/\/|mailto:)/i.test(u)) throw userError('Copy the link and open it in your browser if you trust it. Markooj opens only web (http, https) and email links itself.', { actions: [ACT.copy('Copy link', u.slice(0, 2000))] });
  return shell.openExternal(u);
});

const OPEN_FILTERS = [
  { name: 'All supported', extensions: [...OPENABLE_EXT] },
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdwn', 'mdx', 'rmd', 'qmd'] },
  { name: 'Word and OpenDocument', extensions: ['docx', 'odt', 'rtf'] },
  { name: 'PDF', extensions: ['pdf'] }, { name: 'DjVu', extensions: ['djvu', 'djv'] }, { name: 'EPUB', extensions: ['epub'] },
  { name: 'Web page', extensions: ['html', 'htm'] }, { name: 'LaTeX', extensions: ['tex', 'latex'] }, { name: 'Text', extensions: ['txt'] },
  { name: 'All files', extensions: ['*'] },
];
ipcMain.handle('open-dialog', async (_e, opts = {}) => {
  const r = await dialog.showOpenDialog(win, { title: (opts && opts.title) || 'Open', defaultPath: opts && opts.defaultPath, properties: ['openFile', 'multiSelections'], filters: OPEN_FILTERS });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('pick-file', async (_e, filters, opts = {}) => {
  const f = Array.isArray(filters) ? filters : filters && Array.isArray(filters.filters) ? filters.filters : undefined;
  const r = await dialog.showOpenDialog(win, { title: (opts && opts.title) || (filters && filters.title) || 'Choose a file', properties: ['openFile'], filters: f, defaultPath: (opts && opts.defaultPath) || (filters && filters.defaultPath) });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('save-dialog', async (_e, { defaultPath, filters, title } = {}) => {
  const r = await dialog.showSaveDialog(win, { defaultPath, filters, title });
  return r.canceled ? null : r.filePath;
});
ipcMain.handle('read-text', (_e, p) => { try { return readText(p); } catch (e) { throw friendlyError(e, 'open the file'); } });
// Welcome → "Open a sample document": copies <appRoot>/samples/<name>/ (inside app.asar when packaged) to
// <userData>/samples/<name>/ when that copy is not there yet (a sample the user changed is kept), and returns the
// path of <name>.md, so a save never touches the shipped file. Plain fs calls only: they also read inside the asar.
ipcMain.handle('sample-open', (_e, name) => {
  name = String(name || '');
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(name)) throw userError('Choose a sample from the Welcome screen.', { code: 'NO_SAMPLE' });
  const src = path.join(APP_ROOT, 'samples', name), dst = userData('samples', name), md = path.join(dst, name + '.md');
  if (!fs.existsSync(path.join(src, name + '.md'))) throw userError('Click File → New and pick Research paper to try Markooj on a sample. This copy of Markooj does not include the sample files.', { code: 'NO_SAMPLE' });
  if (!fs.existsSync(md)) {
    const copy = (from, to) => {
      fs.mkdirSync(to, { recursive: true });
      for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
        const a = path.join(from, ent.name), b = path.join(to, ent.name);
        if (ent.isDirectory()) copy(a, b); else if (ent.isFile()) fs.writeFileSync(b, fs.readFileSync(a));
      }
    };
    try { copy(src, dst); } catch (e) { throw friendlyError(e, 'copy the sample'); }
  }
  return md;
});
ipcMain.handle('file-info', (_e, p) => {
  try {
    const st = fs.statSync(p);
    return { path: path.resolve(p), size: st.size, created: st.birthtimeMs || st.ctimeMs, modified: st.mtimeMs, readOnly: !(st.mode & 0o200), exists: true };
  } catch { return null; }
});

// Never write Markdown over a Word / PDF / LaTeX file: those were converted on open.
// Derived from what Markooj opens, so the two lists cannot drift apart.
const FOREIGN = new Set([...[...OPENABLE_EXT].filter(x => !MARKDOWN_EXT.includes(x)), 'doc', 'pptx', 'xlsx']);
ipcMain.handle('write-text', (_e, p, text, opts = {}) => {
  if (FOREIGN.has(extOf(p))) throw userError(`Use Save As to keep your work: pick Markdown for a copy you can keep editing, or ${extOf(p).toUpperCase()} to write that kind of file. Markooj never writes Markdown over “${path.basename(p)}”, so the original stays safe.`, { actions: [{ id: 'choose-format', label: 'Save As…' }], code: 'NOT_MARKDOWN' });
  // a file that changed on disk since it was opened (co-author, Dropbox/OneDrive) is not overwritten silently
  if (opts && opts.expectMtime != null) {
    let cur = null; try { cur = fs.statSync(p).mtimeMs; } catch {}
    if (cur != null && Math.abs(cur - Number(opts.expectMtime)) > 1) return { conflict: true, mtime: cur };
  }
  try { writeAtomic(p, String(text ?? '')); return fs.statSync(p).mtimeMs; }
  catch (e) { throw friendlyError(e, 'save the file'); }
});
ipcMain.handle('save-asset', (_e, { docPath, name, data } = {}) => {
  const clean = (path.basename(String(name || 'image.png')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, '-') || 'image.png');
  const buf = Buffer.from(String(data || '').replace(/^data:[^,]*,/, ''), 'base64');
  if (!docPath) return `data:${mimeOf(clean).split(';')[0]};base64,${buf.toString('base64')}`;
  const dir = path.join(path.dirname(docPath), 'assets');
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(clean), stem = clean.slice(0, clean.length - ext.length) || 'image';
  let final = clean, i = 1;
  while (fs.existsSync(path.join(dir, final))) final = `${stem}-${i++}${ext}`;
  fs.writeFileSync(path.join(dir, final), buf);
  return 'assets/' + final;
});

// ---------- reading documents ----------
const xmlText = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').trim();
function xmlAll(xml, tag) { const out = []; const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'); let m; while ((m = re.exec(xml))) { const t = xmlText(m[1]); if (t) out.push(t); } return out; }
function cleanMeta(m) { const o = {}; for (const [k, v] of Object.entries(m)) if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) o[k] = v; return o; }
const one = a => (a.length === 1 ? a[0] : a.length ? a : undefined);
const splitList = s => String(s || '').split(/[;,]/).map(x => x.trim()).filter(Boolean);

async function docxCoreMeta(file) {
  try {
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(fs.readFileSync(file));
    const f = zip.file('docProps/core.xml'); if (!f) return {};
    const x = await f.async('string');
    return cleanMeta({ title: xmlAll(x, 'dc:title')[0], author: one(xmlAll(x, 'dc:creator').flatMap(s => s.split(';').map(t => t.trim()).filter(Boolean))), subject: xmlAll(x, 'dc:subject')[0], keywords: splitList(xmlAll(x, 'cp:keywords')[0]), description: xmlAll(x, 'dc:description')[0], lang: xmlAll(x, 'dc:language')[0], date: (xmlAll(x, 'dcterms:created')[0] || '').slice(0, 10) });
  } catch { return {}; }
}
function htmlMeta(html) {
  const get = n => { const m = new RegExp(`<meta\\s+[^>]*name=["']${n}["'][^>]*content=["']([^"']*)["']`, 'i').exec(html) || new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*name=["']${n}["']`, 'i').exec(html); return m ? xmlText(m[1]) : undefined; };
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const lang = /<html[^>]*\slang=["']([^"']+)["']/i.exec(html);
  return cleanMeta({ title: t ? xmlText(t[1]) : get('dc.title'), author: get('author') || get('dc.creator'), subject: get('subject') || get('dc.subject'), keywords: splitList(get('keywords')), description: get('description'), lang: lang && lang[1], date: get('date') || get('dc.date') });
}
const bodyOf = html => (/<body[^>]*>([\s\S]*)<\/body>/i.exec(html) || [, html])[1];

async function pandocToMarkdown(file, from) {
  const info = await pandocInfo();
  if (!info) return null;
  if (!info.inputs.has(from)) return null;
  const work = await mkWork();
  try {
    // --sandbox: opening a stranger's .org/.rst/.ipynb must never fetch web addresses or \\host shares (pictures
    // embedded in DOCX/ODT/EPUB are still extracted; only linked ones are skipped)
    let md = (await run(info.path, [file, '-f', from, '-t', mdWriter(info), '--wrap=none', '-s', '--sandbox', '--extract-media=.'], { cwd: work })).replace(/\r\n/g, '\n');
    // embed extracted pictures, so the document stands alone until it is saved
    md = md.replace(/(\]\(|src=["'])((?:\.\/)?media\/[^)"'\s]+)/g, (m, pre, rel) => {
      const f = path.join(work, rel);
      try { const b = fs.readFileSync(f); return `${pre}data:${mimeOf(f).split(';')[0]};base64,${b.toString('base64')}`; } catch { return m; }
    });
    return md;
  } finally { rmWork(work); }
}
function yamlMeta(md) {
  const m = /^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\r?\n/.exec(md);
  if (!m) return {};
  try { const o = require('yaml').parse(m[1]); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}

async function readEpub(p) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(fs.readFileSync(p));
  const container = zip.file('META-INF/container.xml');
  if (!container) throw userError('Try another copy of this EPUB, or open it in an e-book app and save it again. This one looks damaged, so Markooj could not read it.', { actions: [ACT.openFile], details: 'EPUB: no META-INF/container.xml' });
  const opfPath = ((await container.async('string')).match(/full-path="([^"]+)"/) || [])[1];
  const opfFile = opfPath && zip.file(opfPath);
  if (!opfFile) throw userError('Try another copy of this EPUB, or open it in an e-book app and save it again. This one looks damaged, so Markooj could not read it.', { actions: [ACT.openFile], details: 'EPUB: no package (.opf) file' });
  const opf = await opfFile.async('string');
  const dir = path.posix.dirname(opfPath);
  const items = {};
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) { const id = /\bid="([^"]+)"/.exec(m[0]); const href = /\bhref="([^"]+)"/.exec(m[0]); if (id && href) items[id[1]] = href[1]; }
  let html = '';
  for (const m of opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)) {
    const rel = items[m[1]]; if (!rel) continue;
    // Pandoc/Calibre title pages repeat the title and author that already go into the front matter
    if (/(^|\/)(title_?page|titlepage|cover)\.x?html?$/i.test(rel) && /<dc:title\b/.test(opf)) continue;
    const chapterPath = path.posix.normalize((dir === '.' ? '' : dir + '/') + decodeURIComponent(rel));
    const f = zip.file(chapterPath); if (!f) continue;
    let body = bodyOf(await f.async('string'));
    // inline the pictures
    const imgs = [...body.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi), ...body.matchAll(/<image\b[^>]*\bxlink:href="([^"]+)"/gi)];
    for (const im of imgs) {
      const src = im[1]; if (/^(data:|https?:)/.test(src)) continue;
      const ip = path.posix.normalize(path.posix.join(path.posix.dirname(chapterPath), decodeURIComponent(src)));
      const zf = zip.file(ip); if (!zf) continue;
      const b64 = await zf.async('base64');
      body = body.split(`"${src}"`).join(`"data:${mimeOf(ip).split(';')[0]};base64,${b64}"`);
    }
    html += body;
  }
  const meta = cleanMeta({ title: xmlAll(opf, 'dc:title')[0], author: one(xmlAll(opf, 'dc:creator')), lang: xmlAll(opf, 'dc:language')[0], date: (xmlAll(opf, 'dc:date')[0] || '').slice(0, 10), keywords: xmlAll(opf, 'dc:subject'), description: xmlAll(opf, 'dc:description')[0], publisher: xmlAll(opf, 'dc:publisher')[0] });
  return { html, meta };
}

const djvuPagesCache = new Map();
async function djvuPages(p) {
  const key = p + '|' + fs.statSync(p).mtimeMs;
  if (djvuPagesCache.has(key)) return djvuPagesCache.get(key);
  const t = await toolPath('djvused');
  if (!t) return null;
  const n = parseInt(await run(t, ['-e', 'n', p]), 10) || 1;
  djvuPagesCache.set(key, n);
  return n;
}

// Document properties of a PDF / DjVu, shown read-only in File → Info
async function pdfMeta(buf) {
  try {
    const { PDFDocument } = require('pdf-lib');
    const pdf = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
    const iso = d => (d instanceof Date && !isNaN(d) ? d.toISOString().slice(0, 10) : undefined);
    const m = { title: pdf.getTitle(), author: pdf.getAuthor(), subject: pdf.getSubject(), keywords: pdf.getKeywords(), creator: pdf.getCreator(), producer: pdf.getProducer(), date: iso(pdf.getCreationDate()), modified: iso(pdf.getModificationDate()), pages: pdf.getPageCount() };
    for (const k of Object.keys(m)) if (m[k] == null || m[k] === '') delete m[k];
    return m;
  } catch { return {}; }
}
async function djvuMeta(p) {
  try {
    const tool = await toolPath('djvused'); if (!tool) return {};
    const out = await run(tool, [p, '-e', 'print-meta'], { timeout: 20000 });
    const m = {};
    for (const line of String(out).split(/\r?\n/)) { const x = /^(\w+)\s+"((?:[^"\\]|\\.)*)"/.exec(line.trim()); if (x) m[x[1].toLowerCase()] = x[2].replace(/\\(.)/g, '$1'); }
    return m;
  } catch { return {}; }
}
ipcMain.handle('read-file', async (_e, p) => {
  try { return await readFileFor(p); }
  catch (e) { throw openError(e, p); }
});
// A file that could not be opened: file-system trouble in plain words, otherwise what to try, with the raw reason kept for the details
function openError(e, p) {
  if (!e || e.plain) return e;
  const fe = friendlyError(e, 'open the file');
  if (fe !== e) return fe;
  const raw = String(e.toolOutput || e.message || e);
  const ext = extOf(String(p || '')) || 'this';
  return userError(`Try opening it again. If it still does not open, the file may be damaged: try another copy, or save it again from the program that made it. Markooj could not read this .${ext} file.`, { actions: [ACT.retry, ACT.openFile, ACT.details(raw)], details: raw, code: 'OPEN_FAILED' });
}
async function readFileFor(p) {
  p = path.resolve(String(p || ''));
  let st;
  try { st = fs.statSync(p); } catch (e) { throw friendlyError(e, 'open the file'); }
  if (st.isDirectory()) throw userError('Choose a file inside that folder. Markooj opens files, and this is a folder.', { actions: [ACT.openFile] });
  const ext = extOf(p);
  const base = { path: p, ext, mtime: st.mtimeMs };
  if (ext === 'pdf') { const buf = fs.readFileSync(p); return { ...base, kind: 'pdf', data: buf.toString('base64'), meta: await pdfMeta(buf) }; }
  if (ext === 'djvu' || ext === 'djv') {
    let pages = null, missing = null;
    try { pages = await djvuPages(p); } catch (e) { console.error(e); }
    if (pages == null) missing = 'DjVuLibre';
    return { ...base, kind: 'djvu', pages, missing, missingTool: pages == null ? 'ddjvu' : undefined, meta: pages == null ? {} : await djvuMeta(p) };
  }
  if (ext === 'epub') { const r = await readEpub(p); return { ...base, kind: 'html', html: r.html, meta: r.meta }; }
  if (ext === 'docx') {
    let md = null;
    try { md = await pandocToMarkdown(p, 'docx'); } catch (e) { console.error('pandoc docx failed, using mammoth', e.message); }
    if (md != null) return { ...base, kind: 'markdown', text: md, meta: yamlMeta(md), convertedFrom: ext, via: 'pandoc' };
    const mammoth = require('mammoth');
    const r = await mammoth.convertToHtml({ path: p }, { convertImage: mammoth.images.imgElement(img => img.read('base64').then(b => ({ src: `data:${img.contentType};base64,${b}` }))) });
    return { ...base, kind: 'html', html: r.value, meta: await docxCoreMeta(p), convertedFrom: ext, via: 'mammoth' };
  }
  if (PANDOC_IN[ext]) {
    const from = PANDOC_IN[ext];
    let md = null;
    try { md = await pandocToMarkdown(p, from); } catch (e) {
      if (e && e.plain) throw e;
      const raw = (e && (e.toolOutput || e.message)) || String(e);
      throw userError(`Try opening it again. If it still does not open, save it from its own program as Word (.docx) or Markdown and open that copy. Markooj could not turn this .${ext} file into Markdown.`, { actions: [ACT.retry, ACT.openFile, ACT.details(raw)], details: raw });
    }
    if (md == null) {
      if (['tex', 'latex', 'ltx', 'rst', 'org', 'textile', 'wiki', 'mediawiki', 'csv', 'tsv', 'typ', 'muse', 't2t'].includes(ext)) {
        // plain-text formats still open as text, so nothing is lost
        return { ...base, kind: 'markdown', text: ext === 'tex' || ext === 'latex' || ext === 'ltx' ? '```latex\n' + readText(p) + '\n```\n' : readText(p), convertedFrom: ext, via: 'text' };
      }
      throw toolNeeded('pandoc', `open .${ext} files`);
    }
    return { ...base, kind: 'markdown', text: md, meta: yamlMeta(md), convertedFrom: ext, via: 'pandoc' };
  }
  const text = readText(p);
  if (ext === 'html' || ext === 'htm' || ext === 'xhtml') return { ...base, kind: 'html', html: bodyOf(text), meta: htmlMeta(text), convertedFrom: ext };
  return { ...base, kind: 'markdown', text };
}

// ---------- DjVu pages and text ----------
function pnmToPng(buf) {
  let pos = 0;
  const token = () => {
    for (;;) {
      while (pos < buf.length && /\s/.test(String.fromCharCode(buf[pos]))) pos++;
      if (buf[pos] === 0x23) { while (pos < buf.length && buf[pos] !== 0x0a) pos++; continue; }
      break;
    }
    const s = pos; while (pos < buf.length && !/\s/.test(String.fromCharCode(buf[pos]))) pos++;
    return buf.toString('latin1', s, pos);
  };
  const magic = token(), width = +token(), height = +token();
  const maxval = magic === 'P4' ? 1 : +token();
  pos++; // single whitespace before the raster
  const bgra = Buffer.alloc(width * height * 4);
  const scale = v => (maxval === 255 ? v : Math.round(v * 255 / maxval));
  if (magic === 'P6') {
    for (let i = 0, j = pos; i < width * height; i++, j += 3) { bgra[i * 4] = scale(buf[j + 2]); bgra[i * 4 + 1] = scale(buf[j + 1]); bgra[i * 4 + 2] = scale(buf[j]); bgra[i * 4 + 3] = 255; }
  } else if (magic === 'P5') {
    for (let i = 0, j = pos; i < width * height; i++, j++) { const v = scale(buf[j]); bgra[i * 4] = bgra[i * 4 + 1] = bgra[i * 4 + 2] = v; bgra[i * 4 + 3] = 255; }
  } else if (magic === 'P4') {
    const rowBytes = Math.ceil(width / 8);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const bit = (buf[pos + y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
      const v = bit ? 0 : 255, i = (y * width + x) * 4;
      bgra[i] = bgra[i + 1] = bgra[i + 2] = v; bgra[i + 3] = 255;
    }
  } else throw new Error('Unexpected page image format ' + magic);
  return { png: nativeImage.createFromBitmap(bgra, { width, height }).toPNG(), width, height };
}
ipcMain.handle('djvu-page', async (_e, p, pageIndex = 0, dpi = 100) => {
  const ddjvu = await toolPath('ddjvu');
  if (!ddjvu) throw toolNeeded('ddjvu');
  const work = await mkWork();
  try {
    const out = path.join(work, 'page.ppm');
    const res = Math.max(25, Math.min(600, Math.round(Number(dpi) || 100)));
    try { await run(ddjvu, ['-format=ppm', `-page=${(Number(pageIndex) || 0) + 1}`, `-scale=${res}`, p, out], { timeout: 120000 }); }
    catch (e) { throw djvuFileError(e, 'show this page'); }
    let r;
    try { r = pnmToPng(fs.readFileSync(out)); } catch (e) { throw djvuFileError(e, 'show this page'); }
    return { png: r.png.toString('base64'), width: r.width, height: r.height, pages: await djvuPages(p).catch(() => null) };
  } finally { rmWork(work); }
});
ipcMain.handle('djvu-text', async (_e, p) => {
  const t = await toolPath('djvutxt');
  if (!t) throw toolNeeded('djvutxt', 'get the text of DjVu files');
  try { return (await run(t, [p], { timeout: 120000 })).replace(/\r\n/g, '\n'); }
  catch (e) { throw djvuFileError(e, 'read the text of this file'); }
});
// DjVuLibre ran but stopped: the file is the likely cause, so offer another try and another copy, never a reinstall
function djvuFileError(e, what) {
  if (!e || e.plain) return e;
  const fe = friendlyError(e, 'open the file');
  if (fe !== e) return fe;
  const raw = String(e.toolOutput || e.message || e);
  return userError(`Try again. If it still does not work, the file may be damaged: try another copy of it. DjVuLibre could not ${what}.`, { actions: [ACT.retry, ACT.openFile, ACT.details(raw)], details: raw, code: 'DJVU_FAILED' });
}

// ---------- export ----------
function normMeta(meta = {}, title = '') {
  const lower = {}; for (const [k, v] of Object.entries(meta || {})) lower[k.toLowerCase()] = v;
  const txt = v => (v == null ? '' : Array.isArray(v) ? v.map(txt).filter(Boolean).join(', ') : typeof v === 'object' ? String(v.name || v.literal || Object.values(v)[0] || '') : String(v)).trim();
  const list = v => (v == null ? [] : Array.isArray(v) ? v.map(txt).filter(Boolean) : String(v).split(/;|,(?![^(]*\))/).map(s => s.trim()).filter(Boolean));
  return {
    title: txt(lower.title) || String(title || '').trim(), hasTitle: !!txt(lower.title),
    subtitle: txt(lower.subtitle),
    author: list(lower.author || lower.authors || lower.creator),
    subject: txt(lower.subject),
    keywords: list(lower.keywords || lower.tags),
    description: txt(lower.description || lower.abstract),
    lang: txt(lower.lang || lower.language) || 'en-US',
    date: txt(lower.date),
    bibliography: lower.bibliography,
  };
}
const esc = s => String(s ?? '').replace(/[<&>"']/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

function rewriteLocal(html) {
  return String(html || '').replace(/(\ssrc=["'])file:\/\/\/?([^"']+)(["'])/gi, (m, a, p, b) => (LOCAL_MEDIA.has(extOf(p.split(/[?#]/)[0])) ? `${a}${SCHEME}://local/${p}${b}` : m));
}
// Load a standalone HTML document in a hidden window at markooj://app/src/__print/… (relative URLs resolve like index.html).
async function withPrintWindow(html, fn) {
  const id = `/src/__print/${newId()}.html`;
  virtualPages.set(id, rewriteLocal(html));
  const w = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true, spellcheck: false } });
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', e => e.preventDefault());
  try {
    await w.loadURL(`${SCHEME}://app${id}`);
    await Promise.race([w.webContents.executeJavaScript('(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })))).then(() => true)', true), delay(8000)]);
    await delay(250);
    return await fn(w);
  } finally {
    virtualPages.delete(id);
    if (!w.isDestroyed()) w.destroy();
  }
}
const LETTER_COUNTRIES = new Set(['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE', 'GT', 'CR', 'PA', 'DO', 'PR', 'SV', 'NI', 'HN', 'BO']);
function defaultPageSize() { try { return LETTER_COUNTRIES.has(app.getLocaleCountryCode()) ? 'Letter' : 'A4'; } catch { return 'A4'; } }

async function htmlToPdf(html, out, M) {
  const pageMargin = /@page[^{]*\{[^}]*margin/i.test(html);
  const buf = await withPrintWindow(html, w => w.webContents.printToPDF({
    printBackground: true, preferCSSPageSize: true, pageSize: defaultPageSize(),
    margins: pageMargin ? { top: 0, bottom: 0, left: 0, right: 0 } : { top: 0.79, bottom: 0.79, left: 0.79, right: 0.79 },
    displayHeaderFooter: false, generateDocumentOutline: true, generateTaggedPDF: true,
  }));
  let bytes = buf;
  try {
    const { PDFDocument } = require('pdf-lib');
    const pdf = await PDFDocument.load(buf, { updateMetadata: false });
    if (M.title) pdf.setTitle(M.title, { showInWindowTitleBar: true });
    if (M.author.length) pdf.setAuthor(M.author.join('; '));
    if (M.subject || M.description) pdf.setSubject(M.subject || M.description);
    if (M.keywords.length) pdf.setKeywords(M.keywords);
    if (M.lang) pdf.setLanguage(M.lang);
    pdf.setCreator('Markooj'); pdf.setProducer('Markooj ' + app.getVersion());
    const now = new Date(); pdf.setCreationDate(now); pdf.setModificationDate(now);
    bytes = Buffer.from(await pdf.save());
  } catch (e) { console.warn('PDF metadata not written:', e.message); }
  fs.writeFileSync(out, bytes);
  return out;
}

// Make sure a .docx carries the document properties, whichever engine wrote it.
async function patchDocxCore(file, M) {
  try {
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(fs.readFileSync(file));
    const f = zip.file('docProps/core.xml'); if (!f) return;
    let x = await f.async('string');
    const set = (tag, val) => {
      if (!val) return;
      const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>|<${tag}\\s*/>`);
      const node = `<${tag}>${esc(val)}</${tag}>`;
      if (re.test(x)) { const cur = xmlText((x.match(re) || [''])[0]); if (!cur) x = x.replace(re, node); }
      else x = x.replace('</cp:coreProperties>', node + '</cp:coreProperties>');
    };
    if (!/xmlns:dc=/.test(x)) x = x.replace('<cp:coreProperties', '<cp:coreProperties xmlns:dc="http://purl.org/dc/elements/1.1/"');
    set('dc:title', M.title); set('dc:creator', M.author.join('; ')); set('dc:subject', M.subject);
    set('cp:keywords', M.keywords.join(', ')); set('dc:description', M.description); set('dc:language', M.lang);
    zip.file('docProps/core.xml', x);
    fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  } catch (e) { console.warn('docx properties not written:', e.message); }
}

// ---------- what a document may make Pandoc read ----------
// Front matter keys Pandoc treats as file paths or URLs. A shared .md file must not be able to embed local files
// (SSH keys, browser data) in the EPUB/DOCX the researcher sends out, so these never reach Pandoc from the document.
const PATH_KEYS = new Set(['css', 'stylesheet', 'epub-cover-image', 'cover-image', 'epub-fonts', 'epub-metadata', 'epub-embed-font', 'csl', 'bibliography', 'citation-abbreviations', 'reference-doc', 'include-before-body', 'include-after-body', 'include-in-header', 'header-includes', 'abbreviations', 'template', 'filters', 'lua-filter', 'resource-path', 'data-dir', 'extract-media', 'logo', 'titlegraphic', 'background-image']);
const BIB_EXT = new Set(['bib', 'bibtex', 'biblatex', 'json', 'yaml', 'yml', 'ris']);
const NET_RE = /^(?:\\\\|\/\/|\\\/|\/\\|file:\/\/(?!\/))/i;
function localFile(v, baseDir, exts) {
  let s = String(v == null ? '' : v).trim();
  if (!s || NET_RE.test(s)) return null;
  if (/^file:\/\//i.test(s)) { try { s = require('url').fileURLToPath(s); } catch { return null; } }
  else if (/^[a-z][\w+.-]*:\/\//i.test(s)) return null; // web addresses
  const p = path.resolve(baseDir || process.cwd(), s);
  if (/^[\\/]{2}/.test(p) || (exts && !exts.has(extOf(p)))) return null;
  try { return fs.statSync(p).isFile() ? p : null; } catch { return null; }
}
const CSL_FILES = { apa: 'apa.csl', ieee: 'ieee.csl', chicago: 'chicago-author-date.csl' };
function bundledCsl(style) {
  const f = CSL_FILES[String(style || '').toLowerCase()]; if (!f) return null;
  for (const base of [app.isPackaged ? path.join(process.resourcesPath, 'csl') : null, path.join(APP_ROOT, 'csl')].filter(Boolean)) { const p = path.join(base, f); if (fs.existsSync(p)) return p; }
  return null;
}
// Splits the document's front matter off (Pandoc gets it as a cleaned metadata file) and drops network targets.
function prepareForPandoc(md, baseDir, to) {
  const YAML = require('yaml');
  let body = String(md || ''), meta = {};
  const m = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(body);
  if (m) { try { const o = YAML.parse(m[1]); if (o && typeof o === 'object' && !Array.isArray(o)) { meta = o; body = body.slice(m[0].length); } } catch {} }
  const bib = []; let csl = null;
  for (const k of Object.keys(meta)) {
    const lk = k.toLowerCase();
    if (lk === 'bibliography') { for (const v of [].concat(meta[k])) { const p = localFile(v, baseDir, BIB_EXT); if (p) bib.push(p); } delete meta[k]; }
    else if (lk === 'csl') { csl = localFile(meta[k], baseDir, new Set(['csl'])); delete meta[k]; }
    else if (lk.startsWith('markooj-') || lk === 'math-macros') delete meta[k]; // Markooj's own settings
    else if (PATH_KEYS.has(lk) && !(lk === 'header-includes' && to === 'latex')) delete meta[k];
  }
  // \\host\share\x.png, //host/x.png or file://host/… would make Pandoc open an SMB connection (and leak the NTLM hash)
  const NET = '(?:\\\\\\\\|//|\\\\/|/\\\\|file://(?!/))';
  body = body.replace(new RegExp('(\\]\\(\\s*<?)' + NET + '[^)\\s>]*', 'gi'), '$1#')
    .replace(new RegExp('(\\b(?:src|href|data|poster|srcset)\\s*=\\s*["\'])' + NET + '[^"\']*', 'gi'), '$1#')
    .replace(new RegExp('^(\\s{0,3}\\[[^\\]]+\\]:\\s*<?)' + NET + '\\S*', 'gim'), '$1#');
  return { body, meta, bib, csl };
}
// Layout tab (page size, margins, columns, spacing) for LaTeX
const PAPER = { a4: { w: 11906, h: 16838, latex: 'a4', odt: ['21cm', '29.7cm'] }, letter: { w: 12240, h: 15840, latex: 'letter', odt: ['8.5in', '11in'] }, a5: { w: 8391, h: 11906, latex: 'a5', odt: ['14.8cm', '21cm'] } };
const MARGIN_IN = { normal: [1, 1], narrow: [0.5, 0.5], wide: [1, 2] }; // [top/bottom, left/right] in inches
function layoutOf(L) {
  if (!L || typeof L !== 'object') return null;
  const paper = PAPER[String(L.size || 'A4').toLowerCase()] || PAPER.a4;
  const mg = MARGIN_IN[String(L.margins || 'normal').toLowerCase()] || MARGIN_IN.normal;
  const line = parseFloat(L.lineSpacing), para = parseFloat(L.paraSpacing);
  const pt = parseFloat(L.fontSize); // the document's body text size in points (front matter fontsize:, Home → Font size)
  return { paper, mg, columns: Number(L.columns) === 2 ? 2 : 1, line: line > 0 ? line : null, para: Number.isFinite(para) && L.paraSpacing !== '' ? para : null, fontPt: pt >= 5 && pt <= 96 ? pt : null };
}
function latexLayoutMeta(Lx) {
  if (!Lx) return {};
  const o = { papersize: Lx.paper.latex, geometry: [`top=${Lx.mg[0]}in`, `bottom=${Lx.mg[0]}in`, `left=${Lx.mg[1]}in`, `right=${Lx.mg[1]}in`] };
  if (Lx.line) o.linestretch = Lx.line;
  if (Lx.columns === 2) o.classoption = ['twocolumn'];
  if (Lx.para != null) o.indent = false;
  return o;
}
// DOCX: page size, margins and columns in the section properties; line and paragraph spacing in the Body Text style
async function patchDocxLayout(file, Lx) {
  if (!Lx) return;
  try {
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(fs.readFileSync(file));
    const df = zip.file('word/document.xml');
    if (df) {
      let x = await df.async('string');
      const tw = v => Math.round(v * 1440);
      const pg = `<w:pgSz w:w="${Lx.paper.w}" w:h="${Lx.paper.h}"/><w:pgMar w:top="${tw(Lx.mg[0])}" w:right="${tw(Lx.mg[1])}" w:bottom="${tw(Lx.mg[0])}" w:left="${tw(Lx.mg[1])}" w:header="720" w:footer="720" w:gutter="0"/>`;
      const cols = `<w:cols w:num="${Lx.columns}" w:space="720"/>`;
      const fix = s => {
        s = s.replace(/<w:pgSz\b[^>]*\/>|<w:pgMar\b[^>]*\/>|<w:cols\b[^>]*(?:\/>|>[\s\S]*?<\/w:cols>)/g, '');
        const before = (list, piece) => { const re = new RegExp('<w:(?:' + list + ')\\b'); const i = s.search(re); s = i >= 0 ? s.slice(0, i) + piece + s.slice(i) : s.replace(/<\/w:sectPr>$/, piece + '</w:sectPr>'); };
        before('paperSrc|pgBorders|lnNumType|pgNumType|cols|formProt|vAlign|noEndnote|titlePg|textDirection|bidi|rtlGutter|docGrid|printerSettings|sectPrChange', pg);
        before('formProt|vAlign|noEndnote|titlePg|textDirection|bidi|rtlGutter|docGrid|printerSettings|sectPrChange', cols);
        return s;
      };
      if (/<w:sectPr\b/.test(x)) x = x.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>|<w:sectPr\b[^>]*\/>/g, s => fix(s.replace(/^<w:sectPr\b([^>]*)\/>$/, '<w:sectPr$1></w:sectPr>')));
      else x = x.replace(/<\/w:body>/, `<w:sectPr>${pg}${cols}</w:sectPr></w:body>`);
      zip.file('word/document.xml', x);
    }
    const sf = zip.file('word/styles.xml');
    if (sf && (Lx.line || Lx.para != null || Lx.fontPt)) {
      let s = await sf.async('string');
      let lineOnly = false; // Normal (headings build on it) gets the line spacing only
      const spacingAttrs = cur => {
        let a = cur || '';
        const set = (k, v) => { a = new RegExp(`\\s${k}="[^"]*"`).test(a) ? a.replace(new RegExp(`\\s${k}="[^"]*"`), ` ${k}="${v}"`) : a + ` ${k}="${v}"`; };
        if (Lx.para != null && !lineOnly) { set('w:before', 0); set('w:after', Math.round(Lx.para * 20)); }
        if (Lx.line) { set('w:line', Math.round(240 * Lx.line)); set('w:lineRule', 'auto'); }
        return `<w:spacing${a}/>`;
      };
      for (const id of (Lx.line || Lx.para != null ? ['BodyText', 'FirstParagraph', 'Normal'] : [])) {
        s = s.replace(new RegExp(`<w:style\\b[^>]*w:styleId="${id}"[^>]*>[\\s\\S]*?<\\/w:style>`), st => {
          if (id === 'Normal' && !Lx.line) return st;
          lineOnly = id === 'Normal';
          if (/<w:spacing\b/.test(st)) return st.replace(/<w:spacing\b([^>]*?)\/>/, (_m, a) => spacingAttrs(a));
          if (/<w:pPr>/.test(st)) return st.replace(/<w:pPr>/, '<w:pPr>' + spacingAttrs(''));
          if (id === 'FirstParagraph') return st; // inherits from Body Text
          return /<w:rPr>/.test(st) ? st.replace(/<w:rPr>/, `<w:pPr>${spacingAttrs('')}</w:pPr><w:rPr>`) : st.replace(/<\/w:style>$/, `<w:pPr>${spacingAttrs('')}</w:pPr></w:style>`);
        });
      }
      if (Lx.fontPt) s = docxFontSize(s, Lx.fontPt);
      zip.file('word/styles.xml', s);
    }
    fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  } catch (e) { console.warn('docx layout not written:', e.message); }
}
// DOCX body text size: the document defaults, plus any size the body styles set themselves (half-points; headings keep theirs)
function docxFontSize(s, pt) {
  const hv = Math.round(pt * 2);
  const sizes = `<w:sz w:val="${hv}"/><w:szCs w:val="${hv}"/>`;
  const setSz = rpr => {
    let r = rpr;
    for (const tag of ['w:sz', 'w:szCs']) {
      const re = new RegExp(`<${tag}\\b[^>]*/>`);
      r = re.test(r) ? r.replace(re, `<${tag} w:val="${hv}"/>`) : r.replace(/<\/w:rPr>$/, `<${tag} w:val="${hv}"/></w:rPr>`);
    }
    return r;
  };
  if (/<w:rPrDefault>/.test(s)) {
    s = s.replace(/<w:rPrDefault>([\s\S]*?)<\/w:rPrDefault>/, (_m, inner) =>
      `<w:rPrDefault>${/<w:rPr>[\s\S]*?<\/w:rPr>/.test(inner) ? inner.replace(/<w:rPr>[\s\S]*?<\/w:rPr>/, setSz) : `<w:rPr>${sizes}</w:rPr>`}</w:rPrDefault>`);
  } else if (/<w:rPrDefault\s*\/>/.test(s)) s = s.replace(/<w:rPrDefault\s*\/>/, `<w:rPrDefault><w:rPr>${sizes}</w:rPr></w:rPrDefault>`);
  else if (/<w:docDefaults>/.test(s)) s = s.replace(/<w:docDefaults>/, `<w:docDefaults><w:rPrDefault><w:rPr>${sizes}</w:rPr></w:rPrDefault>`);
  else s = s.replace(/(<w:styles\b[^>]*>)/, `$1<w:docDefaults><w:rPrDefault><w:rPr>${sizes}</w:rPr></w:rPrDefault></w:docDefaults>`);
  for (const id of ['Normal', 'BodyText', 'FirstParagraph', 'Compact']) {
    s = s.replace(new RegExp(`<w:style\\b[^>]*w:styleId="${id}"[^>]*>[\\s\\S]*?<\\/w:style>`), st => st.replace(/<w:rPr>[\s\S]*?<\/w:rPr>/, r => (/<w:sz\b/.test(r) ? setSz(r) : r)));
  }
  return s;
}
// ODT: page layout (size, margins, columns) and the Text body paragraph style (spacing)
async function patchOdtLayout(file, Lx) {
  if (!Lx) return;
  try {
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(fs.readFileSync(file));
    const sf = zip.file('styles.xml'); if (!sf) return;
    let s = await sf.async('string');
    const setAttr = (tag, k, v) => (new RegExp(`\\s${k}="[^"]*"`).test(tag) ? tag.replace(new RegExp(`\\s${k}="[^"]*"`), ` ${k}="${v}"`) : tag.replace(/\s*\/?>$/, m => ` ${k}="${v}"${m}`));
    s = s.replace(/<style:page-layout-properties\b[^>]*?\/?>/g, tag => {
      let t = tag;
      t = setAttr(t, 'fo:page-width', Lx.paper.odt[0]); t = setAttr(t, 'fo:page-height', Lx.paper.odt[1]);
      t = setAttr(t, 'fo:margin-top', Lx.mg[0] + 'in'); t = setAttr(t, 'fo:margin-bottom', Lx.mg[0] + 'in');
      t = setAttr(t, 'fo:margin-left', Lx.mg[1] + 'in'); t = setAttr(t, 'fo:margin-right', Lx.mg[1] + 'in');
      return t;
    });
    if (Lx.columns === 2) {
      s = s.replace(/<style:columns\b[^>]*(?:\/>|>[\s\S]*?<\/style:columns>)/g, '');
      s = s.replace(/(<style:page-layout-properties\b[^>]*?)\/>/g, '$1><style:columns fo:column-count="2" fo:column-gap="0.5in"/></style:page-layout-properties>')
        .replace(/(<style:page-layout-properties\b[^>]*[^/]>)(?!<style:columns)/g, '$1<style:columns fo:column-count="2" fo:column-gap="0.5in"/>');
    }
    if (Lx.line || Lx.para != null) {
      s = s.replace(/(<style:style\b[^>]*style:name="Text_20_body"[^>]*>)([\s\S]*?)(<\/style:style>)/, (_m, a, inner, c) => {
        let pp = (/<style:paragraph-properties\b[^>]*?\/>/.exec(inner) || [null])[0];
        let t = pp || '<style:paragraph-properties/>';
        if (Lx.para != null) { t = setAttr(t, 'fo:margin-top', '0in'); t = setAttr(t, 'fo:margin-bottom', (Lx.para / 72).toFixed(4) + 'in'); }
        if (Lx.line) t = setAttr(t, 'fo:line-height', Math.round(Lx.line * 100) + '%');
        return a + (pp ? inner.replace(pp, t) : t + inner) + c;
      });
    }
    if (Lx.fontPt) {
      // the default paragraph style carries the body size; Standard and Text body follow it unless they set their own
      const size = `${Lx.fontPt}pt`;
      const setFont = tag => {
        let t = setAttr(tag, 'fo:font-size', size);
        if (/style:font-size-asian=/.test(t)) t = setAttr(t, 'style:font-size-asian', size);
        if (/style:font-size-complex=/.test(t)) t = setAttr(t, 'style:font-size-complex', size);
        return t;
      };
      s = s.replace(/(<style:default-style\b[^>]*style:family="paragraph"[^>]*>)([\s\S]*?)(<\/style:default-style>)/, (_m, a, inner, c) => {
        const tp = (/<style:text-properties\b[^>]*?\/>/.exec(inner) || [null])[0];
        return a + (tp ? inner.replace(tp, setFont(tp)) : inner + setFont('<style:text-properties/>')) + c;
      });
      s = s.replace(/(<style:style\b[^>]*style:name="(?:Standard|Text_20_body)"[^>]*>)([\s\S]*?)(<\/style:style>)/g,
        (_m, a, inner, c) => a + inner.replace(/<style:text-properties\b[^>]*?fo:font-size="[^"]*"[^>]*?\/>/, setFont) + c);
    }
    zip.file('styles.xml', s);
    // the mimetype entry must stay first and uncompressed
    const mt = zip.file('mimetype'); if (mt) zip.file('mimetype', await mt.async('string'), { compression: 'STORE' });
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(file, buf);
  } catch (e) { console.warn('odt layout not written:', e.message); }
}

// ---- right-to-left documents in Pandoc exports (Urdu, Arabic, Persian, Hebrew …) ----
const RTL_LANG_RE = /^(ar|arc|ckb|dv|fa|he|iw|ks|ps|sd|ug|ur|yi)$/i;
const baseLang = l => String(l || '').split(/[-_]/)[0].toLowerCase();
/** {rtl, lang, script, font, fontFile, locale} for a document, from its (cleaned) front matter and the export metadata. */
function rtlInfo(meta, M) {
  const lang = String((meta && (meta.lang || meta.language)) || (M && M.lang) || '');
  const d = String((meta && meta.dir) || '').toLowerCase();
  const b = baseLang(lang);
  const rtl = d === 'rtl' || (d !== 'ltr' && RTL_LANG_RE.test(b));
  const script = b === 'ur' || b === 'fa' || b === 'ar' ? b : rtl ? 'ar' : null;
  const FONTS = { ur: ['Noto Nastaliq Urdu', 'noto-nastaliq-urdu-arabic'], ar: ['Noto Naskh Arabic', 'noto-naskh-arabic-arabic'], fa: ['Vazirmatn', 'vazirmatn-arabic'] };
  const LOCALE = { ur: 'ur-PK', fa: 'fa-IR', ar: 'ar-SA', he: 'he-IL', iw: 'he-IL', ps: 'ps-AF', sd: 'sd-PK', ckb: 'ckb-IQ', yi: 'yi', ug: 'ug-CN', dv: 'dv-MV', ks: 'ks-IN' };
  const locale = /-/.test(lang) && RTL_LANG_RE.test(b) ? lang : LOCALE[b] || null;
  return { rtl, lang, script, font: script ? FONTS[script][0] : null, fontFile: script ? FONTS[script][1] : null, locale };
}
// EPUB: Pandoc puts dir only on the title page, so the chapters need the direction, the page order and the script font from us
async function epubRtlArgs(info, R, work, prep) {
  const args = ['--metadata', 'page-progression-direction=rtl'];
  // wrap the body in one right-to-left div (more colons than any div inside, so the nesting stays right)
  prep.body = `::::::::::::::::::: {dir="rtl"}\n${String(prep.body).replace(/\s+$/, '')}\n:::::::::::::::::::\n`;
  let css = '';
  try { css = await run(info.path, ['--print-default-data-file', 'epub.css']); } catch {}
  css += '\nbody{direction:rtl}\n';
  if (R.fontFile) {
    let any = false;
    for (const w of [400, 700]) {
      const name = `${R.fontFile}-${w}-normal.woff2`;
      try {
        const dest = path.join(work, name);
        fs.writeFileSync(dest, fs.readFileSync(path.join(APP_ROOT, 'fonts', name))); // copied out of the asar: Pandoc cannot read inside it
        args.push(`--epub-embed-font=${dest}`);
        css += `@font-face{font-family:'${R.font}';font-weight:${w};src:url('../fonts/${name}') format('woff2')}\n`;
        any = true;
      } catch {}
    }
    if (any) css += `body{font-family:'${R.font}',serif}\n`;
  }
  const cssFile = path.join(work, 'markooj-epub.css');
  fs.writeFileSync(cssFile, css, 'utf8');
  args.push('--css', cssFile);
  return args;
}
// DOCX: Pandoc marks body paragraphs right to left, but not the title block or tables, and proofs complex script as ar-SA
async function patchDocxRtl(file, R) {
  if (!R || !R.rtl) return;
  try {
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(fs.readFileSync(file));
    const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
    const firstStrongRtl = xml => { const t = (xml.match(/<w:t\b[^>]*>([^<]*)<\/w:t>/g) || []).map(x => x.replace(/<[^>]+>/g, '')).join(''); const m = /\p{L}/u.exec(t); return !!m && RTL.test(m[0]); };
    const insertBefore = (block, list, piece) => {
      const re = new RegExp('<w:(?:' + list + ')\\b'); const i = block.search(re);
      return i >= 0 ? block.slice(0, i) + piece + block.slice(i) : block.replace(/<\/w:(tblPr|pPr)>$/, piece + '</w:$1>');
    };
    const df = zip.file('word/document.xml');
    if (df) {
      let x = await df.async('string');
      // a table whose text starts right to left is mirrored (first column on the right), as on the page
      x = x.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, tbl => {
        if (/<w:bidiVisual\b/.test(tbl) || !firstStrongRtl(tbl)) return tbl;
        if (!/<w:tblPr>/.test(tbl)) return tbl.replace(/<w:tbl>/, '<w:tbl><w:tblPr><w:bidiVisual/></w:tblPr>');
        return tbl.replace(/<w:tblPr>[\s\S]*?<\/w:tblPr>/, tp => insertBefore(tp, 'tblStyleRowBandSize|tblStyleColBandSize|tblW|jc|tblCellSpacing|tblInd|tblBorders|shd|tblLayout|tblCellMar|tblLook|tblCaption|tblDescription', '<w:bidiVisual/>'));
      });
      zip.file('word/document.xml', x);
    }
    const sf = zip.file('word/styles.xml');
    if (sf) {
      let s = await sf.async('string');
      const P_AFTER = 'adjustRightInd|snapToGrid|spacing|ind|contextualSpacing|mirrorIndents|suppressOverlap|jc|textDirection|textAlignment|textboxTightWrap|outlineLvl|divId|cnfStyle|rPr|sectPr|pPrChange';
      for (const id of ['Title', 'Subtitle', 'Author', 'Date', 'Abstract', 'AbstractTitle']) {
        s = s.replace(new RegExp(`<w:style\\b[^>]*w:styleId="${id}"[^>]*>[\\s\\S]*?<\\/w:style>`), st => {
          if (/<w:bidi\b/.test(st)) return st;
          if (/<w:pPr>[\s\S]*?<\/w:pPr>/.test(st)) return st.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, pp => insertBefore(pp, P_AFTER, '<w:bidi/>'));
          return /<w:rPr>/.test(st) ? st.replace(/<w:rPr>/, '<w:pPr><w:bidi/></w:pPr><w:rPr>') : st.replace(/<\/w:style>$/, '<w:pPr><w:bidi/></w:pPr></w:style>');
        });
      }
      // the proofing language and the complex-script font in the document defaults
      s = s.replace(/<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/, d => {
        if (R.locale) d = /<w:lang\b[^>]*\/>/.test(d)
          ? d.replace(/<w:lang\b([^>]*)\/>/, (_m, a) => `<w:lang${/\sw:bidi="/.test(a) ? a.replace(/\sw:bidi="[^"]*"/, ` w:bidi="${R.locale}"`) : a + ` w:bidi="${R.locale}"`}/>`)
          : d.replace(/<\/w:rPr>/, `<w:lang w:bidi="${R.locale}"/></w:rPr>`);
        if (R.font) d = /<w:rFonts\b[^>]*\/>/.test(d)
          ? d.replace(/<w:rFonts\b([^>]*)\/>/, (_m, a) => `<w:rFonts${a.replace(/\sw:cstheme="[^"]*"/, '').replace(/\sw:cs="[^"]*"/, '')} w:cs="${R.font}"/>`)
          : d.replace(/<w:rPr>/, `<w:rPr><w:rFonts w:cs="${R.font}"/>`);
        return d;
      });
      zip.file('word/styles.xml', s);
    }
    fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  } catch (e) { console.warn('docx right-to-left settings not written:', e.message); }
}

async function pandocExportRaw({ info, md, html, out, to, M, baseDir, extra = [], withTitle = true, layout = null, citeStyle = null, flavor = null }) {
  const work = await mkWork();
  try {
    const useMd = !!(md && md.trim());
    const src = path.join(work, useMd ? 'source.md' : 'source.html');
    const prep = useMd ? prepareForPandoc(md, baseDir || work, to) : { body: html, meta: {}, bib: [], csl: null };
    const R = rtlInfo(prep.meta, M);
    const rtlArgs = useMd && R.rtl && /^epub/.test(to) ? await epubRtlArgs(info, R, work, prep) : [];
    fs.writeFileSync(src, prep.body, 'utf8');
    const YAML = require('yaml');
    const metaObj = /^latex|^beamer|^context/.test(to) ? latexLayoutMeta(layoutOf(layout)) : {};
    if (M.title && (withTitle || M.hasTitle)) metaObj.title = M.title;
    if (!metaObj.title && M.title) metaObj.pagetitle = M.title;
    if (M.subtitle) metaObj.subtitle = M.subtitle;
    if (M.author.length) metaObj.author = M.author;
    if (M.subject) metaObj.subject = M.subject;
    if (M.keywords.length) metaObj.keywords = M.keywords;
    if (M.description) metaObj.description = M.description;
    if (M.lang) metaObj.lang = M.lang;
    if (M.date) metaObj.date = M.date;
    const metaFile = path.join(work, 'meta.yaml');
    fs.writeFileSync(metaFile, YAML.stringify(metaObj), 'utf8');
    const cwd = baseDir && fs.existsSync(baseDir) ? baseDir : work;
    const args = [src, '-f', useMd ? readerFor(info, flavor) : 'html', '-t', to, '-s', '-o', out, '--metadata-file', metaFile, '--resource-path', [cwd, work].join(path.delimiter), ...rtlArgs, ...extra];
    // the document's own (cleaned) front matter comes second, so it still wins over Markooj's defaults
    if (Object.keys(prep.meta).length) { const docMeta = path.join(work, 'doc-meta.yaml'); fs.writeFileSync(docMeta, YAML.stringify(prep.meta), 'utf8'); args.push('--metadata-file', docMeta); }
    // text formats (LaTeX, reStructuredText …) cannot hold embedded pictures such as rendered diagrams:
    // Pandoc writes them into "<name>-media" next to the exported file
    let runCwd = cwd;
    if (/^(latex|beamer|context|rst|org|asciidoc|mediawiki|typst|jats)$/.test(to) && /\]\(data:image\//.test(prep.body)) {
      runCwd = path.dirname(out);
      args.push(`--extract-media=${path.basename(out).replace(/\.[^.]+$/, '')}-media`);
    }
    const citeproc = prep.bib.length || prep.meta.references || prep.meta.nocite;
    if (citeproc && (info.major > 2 || (info.major === 2 && info.minor >= 11))) {
      args.push('--citeproc');
      for (const b of prep.bib) args.push('--bibliography', b);
      // the citation style chosen on the References tab (or a local csl: file named in the front matter)
      const csl = prep.csl || bundledCsl(citeStyle);
      if (csl) args.push('--csl', csl);
    }
    await run(info.path, args, { cwd: runCwd });
    return out;
  } finally { rmWork(work); }
}

function mdToPlain(md) {
  return String(md || '')
    .replace(/^---\r?\n[\s\S]*?\r?\n(---|\.\.\.)\r?\n/, '')
    .replace(/^```.*$/gm, '').replace(/^#{1,6}\s+/gm, '').replace(/^>\s?/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/(^|[^*\w])[*_]([^*_\n]+)[*_]/g, '$1$2').replace(/~~(.+?)~~/g, '$1').replace(/==(.+?)==/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

const BUILTIN = [
  { id: 'md', label: 'Markdown', ext: 'md' }, { id: 'pdf', label: 'PDF', ext: 'pdf' }, { id: 'docx', label: 'Word document', ext: 'docx' },
  { id: 'epub', label: 'EPUB e-book', ext: 'epub' }, { id: 'html', label: 'Web page', ext: 'html' }, { id: 'txt', label: 'Plain text', ext: 'txt' },
];
const PANDOC_OUT = [
  { id: 'latex', label: 'LaTeX', ext: 'tex', to: 'latex' }, { id: 'odt', label: 'OpenDocument text', ext: 'odt', to: 'odt' },
  { id: 'rtf', label: 'Rich Text', ext: 'rtf', to: 'rtf' }, { id: 'pptx', label: 'PowerPoint slides', ext: 'pptx', to: 'pptx' },
  { id: 'jats', label: 'JATS XML', ext: 'xml', to: 'jats' }, { id: 'rst', label: 'reStructuredText', ext: 'rst', to: 'rst' },
  { id: 'org', label: 'Org mode', ext: 'org', to: 'org' }, { id: 'asciidoc', label: 'AsciiDoc', ext: 'adoc', to: 'asciidoc' },
  { id: 'mediawiki', label: 'MediaWiki', ext: 'wiki', to: 'mediawiki' }, { id: 'ipynb', label: 'Jupyter notebook', ext: 'ipynb', to: 'ipynb' },
  { id: 'typst', label: 'Typst', ext: 'typ', to: 'typst' },
];
ipcMain.handle('export-formats', async () => {
  const info = await pandocInfo();
  const pdf2djvu = await toolPath('pdf2djvu');
  return [
    ...BUILTIN.map(f => ({ ...f, available: true, via: 'built-in', engine: (f.id === 'docx' || f.id === 'epub') && info ? 'pandoc' : f.id === 'txt' && info ? 'pandoc' : 'built-in' })),
    // `needs` names the tool; `reason` is the short line Save As shows under a format that cannot be used yet
    ...PANDOC_OUT.map(f => {
      const available = !!(info && info.outputs.has(f.to));
      return { id: f.id, label: f.label, ext: f.ext, available, via: 'pandoc', needs: 'pandoc', ...(available ? {} : { reason: info ? `Get a newer Pandoc to use this (Help → Check Tools)` : 'Get Pandoc to use this (Help → Check Tools)' }) };
    }),
    { id: 'djvu', label: 'DjVu', ext: 'djvu', available: !!pdf2djvu, via: 'djvulibre', needs: 'pdf2djvu', ...(pdf2djvu ? {} : { reason: 'Get pdf2djvu to use this (Help → Check Tools)' }) },
  ];
});

ipcMain.handle('export', async (_e, o = {}) => {
  const { format, out, html = '', md = '', title = '', meta = {}, docPath, baseDir: base } = o;
  if (!out) throw userError('Choose where to save the file, then try again.', { actions: [ACT.retry] });
  const M = normMeta(meta, title);
  const baseDir = base || (docPath ? path.dirname(docPath) : path.dirname(out));
  // Layout tab, References → Citation style and File → Render as travel with every Pandoc export
  const pandocExport = args => pandocExportRaw({ layout: o.layout, citeStyle: o.citeStyle, flavor: o.renderAs, ...args });
  const Lx = layoutOf(o.layout);
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (format === 'md' || format === 'markdown') { writeAtomic(out, md); return out; }
    // add-in exporters hand over finished bytes (base64) or text
    if (format === 'raw') { writeAtomic(out, o.data != null ? Buffer.from(String(o.data), 'base64') : String(o.text ?? '')); return out; }
    if (format === 'html') { writeAtomic(out, html); return out; }
    if (format === 'txt') {
      const info = await pandocInfo();
      if (info && md) { try { return await pandocExport({ info, md, out, to: 'plain', M, baseDir, extra: ['--wrap=none'], withTitle: false }); } catch (e) { console.warn('pandoc plain failed', e.message); } }
      writeAtomic(out, mdToPlain(md || html)); return out;
    }
    if (format === 'pdf') return await htmlToPdf(html, out, M);
    if (format === 'djvu') {
      const tool2 = await toolPath('pdf2djvu');
      if (!tool2) throw toolNeeded('pdf2djvu');
      const work = await mkWork();
      try { const pdf = path.join(work, 'doc.pdf'); await htmlToPdf(html, pdf, M); await run(tool2, ['-o', out, pdf], { timeout: 600000 }); }
      finally { rmWork(work); }
      return out;
    }
    if (format === 'docx') {
      const info = await pandocInfo();
      if (info && (md || html)) {
        try { await pandocExport({ info, md, html, out, to: 'docx', M, baseDir, withTitle: M.hasTitle }); await patchDocxCore(out, M); await patchDocxLayout(out, Lx); await patchDocxRtl(out, rtlInfo(prepareForPandoc(md || '', baseDir, 'docx').meta, M)); return out; }
        catch (e) { console.warn('pandoc docx failed, using html-to-docx', e.message); }
      }
      const HTMLtoDOCX = require('html-to-docx');
      const buf = await HTMLtoDOCX(`<!doctype html><html><body>${bodyOf(html)}</body></html>`, null, {
        title: M.title, subject: M.subject, creator: M.author.join('; ') || 'Markooj', keywords: M.keywords, description: M.description,
        lastModifiedBy: 'Markooj', lang: M.lang, font: 'Calibri', fontSize: Lx && Lx.fontPt ? Math.round(Lx.fontPt * 2) : 22, footer: true, pageNumber: true,
      });
      fs.writeFileSync(out, buf);
      await patchDocxCore(out, M);
      await patchDocxLayout(out, Lx);
      await patchDocxRtl(out, rtlInfo(prepareForPandoc(md || '', baseDir, 'docx').meta, M));
      return out;
    }
    if (format === 'epub') {
      const info = await pandocInfo();
      if (info && (md || html)) {
        try { return await pandocExport({ info, md, html, out, to: info.outputs.has('epub3') ? 'epub3' : 'epub', M, baseDir, extra: ['--mathml'] }); }
        catch (e) { console.warn('pandoc epub failed, using built-in writer', e.message); }
      }
      return await epubBuiltIn(html, out, M);
    }
    const f = PANDOC_OUT.find(x => x.id === format || x.to === format || x.ext === format);
    if (!f) throw userError(`Choose another format: Markooj does not know how to save as “${format}”. Your document is unchanged.`, { actions: [ACT.chooseFormat] });
    const info = await pandocInfo();
    if (!info) throw toolNeeded('pandoc', `save as ${f.label}`);
    if (!info.outputs.has(f.to)) throw userError(`Choose another format, or install a newer Pandoc and check again. The Pandoc Markooj found (${info.version}) cannot write ${f.label}. Everything else works.`, { actions: [ACT.chooseFormat, ACT.url('Get Pandoc', TOOL_INFO.pandoc.url), ACT.checkTools], tool: 'pandoc' });
    await pandocExport({ info, md, html, out, to: f.to, M, baseDir, withTitle: true });
    if (f.to === 'odt') await patchOdtLayout(out, Lx);
    return out;
  } catch (e) { throw exportError(e, format); }
});
// An export that stopped: file-system trouble in plain words, otherwise what to try next, with the tool's own words kept
// for "Technical details".
function exportError(e, format) {
  if (!e || e.plain) return e;
  const fe = friendlyError(e, 'save the exported file');
  if (fe !== e) return fe;
  const raw = String(e.toolOutput || e.message || e);
  const label = (PANDOC_OUT.find(x => x.id === format) || {}).label || String(format || '').toUpperCase();
  const picture = /fetch resource|could not find (image|media)|openBinaryFile|withBinaryFile|does not exist \(No such file/i.test(raw);
  // a missing picture is fixed in the document, not by trying again: say that first
  const lead = picture
    ? 'Check that every picture and linked file in the document is still in the same place (or remove the missing one), then save again.'
    : 'Try again, or choose another format.';
  return userError(`${lead} Markooj could not finish the ${label} file; your document is unchanged.`,{ actions: [ACT.retry, ACT.chooseFormat, ACT.details(raw), ACT.report], details: raw, code: 'EXPORT_FAILED' });
}

async function epubBuiltIn(html, out, M) {
  const JSZip = require('jszip');
  const zip = new JSZip();
  const body = bodyOf(html);
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [, ''])[1];
  const id = 'urn:uuid:' + crypto.randomUUID();
  const title = M.title || 'Untitled';
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('OEBPS/style.css', css);
  const xhtml = body.replace(/<(br|hr|img|input|col|meta|link|source|wbr)([^>]*?)\/?>/gi, '<$1$2/>').replace(/&nbsp;/g, '&#160;');
  zip.file('OEBPS/doc.xhtml', `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${esc(M.lang)}" lang="${esc(M.lang)}"><head><title>${esc(title)}</title><link rel="stylesheet" href="style.css"/></head><body>${xhtml}</body></html>`);
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="doc.xhtml">${esc(title)}</a></li></ol></nav></body></html>`);
  const dc = [
    `<dc:identifier id="bid">${id}</dc:identifier>`, `<dc:title>${esc(title)}</dc:title>`, `<dc:language>${esc(M.lang)}</dc:language>`,
    ...M.author.map(a => `<dc:creator>${esc(a)}</dc:creator>`), ...M.keywords.map(k => `<dc:subject>${esc(k)}</dc:subject>`),
    M.subject ? `<dc:subject>${esc(M.subject)}</dc:subject>` : '', M.description ? `<dc:description>${esc(M.description)}</dc:description>` : '',
    M.date ? `<dc:date>${esc(M.date)}</dc:date>` : '', `<meta property="dcterms:modified">${new Date().toISOString().slice(0, 19)}Z</meta>`,
  ].join('');
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">${dc}</metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="doc" href="doc.xhtml" media-type="application/xhtml+xml"/><item id="css" href="style.css" media-type="text/css"/></manifest><spine><itemref idref="doc"/></spine></package>`);
  fs.writeFileSync(out, await zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' }));
  return out;
}

ipcMain.handle('print', async (_e, { html, title } = {}) => {
  let doc = String(html || '');
  if (title && !/<title>/i.test(doc)) doc = doc.replace(/<head[^>]*>/i, m => `${m}<title>${esc(title)}</title>`);
  return withPrintWindow(doc, w => new Promise(res => {
    w.webContents.print({ silent: false, printBackground: true }, (ok, reason) => res({ ok, reason: ok ? null : reason }));
  }));
});

// ---------- settings ----------
ipcMain.handle('settings-get', () => ({ ...loadSettings() }));
ipcMain.handle('settings-set', (_e, patch = {}) => {
  const s = loadSettings();
  if (patch && typeof patch === 'object') for (const [k, v] of Object.entries(patch)) {
    if (k === 'window') continue; // owned by main
    if (v === undefined) delete s[k]; else s[k] = v;
  }
  if ('recoveryDays' in s) s.recoveryDays = Math.max(7, Number(s.recoveryDays) || 7);
  saveSettings();
  if (patch && 'theme' in patch) { applyTheme(); if (win && !win.isDestroyed()) win.setBackgroundColor(bgColor()); }
  return { ...s };
});

// ---------- recovery store (userData/recovery/<docId>.json) ----------
const recDir = () => userData('recovery');
const safeName = s => String(s || '').replace(/[^\w.-]/g, '_').slice(0, 120) || 'x';
const recFile = id => path.join(recDir(), safeName(id) + '.json');
function recEntries() {
  let files = [];
  try { files = fs.readdirSync(recDir()).filter(f => f.endsWith('.json')); } catch { return []; }
  return files.map(f => { const e = readJson(path.join(recDir(), f), null); if (e) e.__file = path.join(recDir(), f); return e; }).filter(e => e && e.docId != null);
}
function purgeRecovery() {
  const cutoff = Date.now() - retentionDays() * 864e5;
  for (const e of recEntries()) if ((e.closedAt || e.savedAt || 0) < cutoff) { try { fs.unlinkSync(e.__file); } catch {} }
}
ipcMain.handle('recovery-save', (_e, { docId, path: p, title, text } = {}) => {
  if (docId == null) return;
  const file = recFile(docId);
  const prev = readJson(file, null) || {};
  writeAtomic(file, JSON.stringify({ docId: String(docId), path: p || null, title: title || 'Untitled', text: String(text ?? ''), createdAt: prev.createdAt || Date.now(), savedAt: Date.now(), closedAt: null, crashed: false, session: SESSION }));
});
ipcMain.handle('recovery-list', () => {
  purgeRecovery();
  return recEntries().map(e => {
    const text = String(e.text || '');
    const body = text.replace(/^---\r?\n[\s\S]*?\r?\n(---|\.\.\.)\r?\n/, '').replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '').replace(/<!--[\s\S]*?-->|[*_`~]{1,3}|!?\[([^\]]*)\]\([^)]*\)/g, (m, t) => t || '');
    return {
      docId: e.docId, path: e.path || null, title: e.title || 'Untitled', savedAt: e.savedAt || 0, closedAt: e.closedAt || null, createdAt: e.createdAt || e.savedAt || 0,
      preview: body.replace(/\s+/g, ' ').trim().slice(0, 200), size: Buffer.byteLength(text, 'utf8'), chars: text.length,
      crashed: !!e.crashed || (!e.closedAt && e.session !== SESSION), current: !e.closedAt && e.session === SESSION,
      exists: !!(e.path && fs.existsSync(e.path)),
    };
  }).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
});
ipcMain.handle('recovery-get', (_e, docId) => {
  const e = readJson(recFile(docId), null);
  if (!e) return null;
  return { docId: e.docId, path: e.path || null, title: e.title, text: e.text || '', savedAt: e.savedAt, closedAt: e.closedAt || null };
});
ipcMain.handle('recovery-delete', (_e, docId) => { try { fs.unlinkSync(recFile(docId)); } catch {} });
ipcMain.handle('recovery-delete-all', () => { for (const e of recEntries()) { try { fs.unlinkSync(e.__file); } catch {} } });
ipcMain.handle('recovery-mark-closed', (_e, docId, opts = {}) => {
  const file = recFile(docId);
  const e = readJson(file, null); if (!e) return;
  e.closedAt = Date.now(); if (opts && opts.crashed) e.crashed = true;
  writeAtomic(file, JSON.stringify(e));
});
ipcMain.handle('recovery-dir', () => { fs.mkdirSync(recDir(), { recursive: true }); return recDir(); });

// ---------- macros (userData/macros/<name>.json) ----------
const macroDir = () => userData('macros');
const macroFile = name => path.join(macroDir(), (String(name || '').replace(/[^\w\- .]/g, '_').trim().slice(0, 80) || 'macro') + '.json');
ipcMain.handle('macros-list', () => {
  let files = []; try { files = fs.readdirSync(macroDir()).filter(f => f.endsWith('.json')); } catch { return []; }
  return files.map(f => readJson(path.join(macroDir(), f), null)).filter(Boolean).sort((a, b) => String(a.name).localeCompare(String(b.name)));
});
ipcMain.handle('macros-save', (_e, m = {}) => {
  if (!m.name) throw userError('Give the macro a name, then save it again.');
  const prev = readJson(macroFile(m.name), null) || {};
  const o = { name: String(m.name), lang: m.lang || 'js', code: String(m.code ?? ''), shortcut: m.shortcut || '', ribbon: !!m.ribbon, description: m.description || '', createdAt: prev.createdAt || Date.now(), updatedAt: Date.now() };
  for (const [k, v] of Object.entries(m)) if (!(k in o)) o[k] = v;
  writeAtomic(macroFile(m.name), JSON.stringify(o, null, 2));
  return o;
});
ipcMain.handle('macros-delete', (_e, name) => { try { fs.unlinkSync(macroFile(name)); } catch {} });
