#!/usr/bin/env node
/*
 * Markooj: fetch the bundled command-line tools (Pandoc, DjVuLibre, pdf2djvu).
 *
 * Downloads OFFICIAL release artifacts only, verifies their SHA-256, and extracts them into
 *
 *   vendor/<dir>/pandoc/pandoc(.exe)
 *   vendor/<dir>/djvulibre/ddjvu, djvutxt, djvused, c44, djvm (+ DLLs on Windows)
 *   vendor/<dir>/pdf2djvu/pdf2djvu(.exe) (+ DLLs, fonts, poppler data on Windows)
 *   vendor/<dir>/MANIFEST.json   (versions, URLs, hashes, where the source code lives)
 *
 * <dir> is `win32` on Windows (x64 only) and `<platform>-<arch>` elsewhere: darwin-arm64, darwin-x64, linux-x64.
 * electron-builder ships that folder as resources/vendor (package.json: extraResources with ${arch}).
 * On macOS and Linux only Pandoc is bundled; DjVuLibre and pdf2djvu come from Homebrew or the system
 * package manager (brew install djvulibre pdf2djvu / sudo apt install djvulibre-bin pdf2djvu).
 *
 * It also writes the license texts into licenses/ and regenerates THIRD_PARTY_NOTICES.md.
 *
 * Usage:
 *   node scripts/fetch-tools.js                    fetch for this computer's platform
 *   node scripts/fetch-tools.js --platform=win32   (darwin / linux: Pandoc only, DjVu tools via instructions)
 *   node scripts/fetch-tools.js --platform=darwin --arch=arm64   → vendor/darwin-arm64 (also --arch=x64)
 *   node scripts/fetch-tools.js --platform=linux --arch=x64      → vendor/linux-x64
 *   node scripts/fetch-tools.js --with-source      also download the matching source tarballs into vendor-src/
 *   node scripts/fetch-tools.js --with-source --source-max-mb=50   (skip source archives larger than 50 MB)
 *   node scripts/fetch-tools.js --force            download again even when the same version is present
 *   node scripts/fetch-tools.js --only=pandoc,pdf2djvu,djvulibre
 *   node scripts/fetch-tools.js --notices          only regenerate THIRD_PARTY_NOTICES.md + licenses/npm-licenses.txt
 *   Options: --pandoc-version=3.14 (or --latest for the newest 3.x release; the default is the pinned version)
 *            --arch=x64|arm64  --djvu-source=auto|sourceforge|msys2
 *            --djvulibre-installer=<path to DjVuLibre-x.y.z_DjView-a.b_Setup.exe already downloaded>
 *            --7z=<path to 7z.exe>  (needed only for the SourceForge installer route)
 *
 * Licenses (checked against each project's own COPYING files; see THIRD_PARTY_NOTICES.md):
 *   Pandoc     GPL-2.0-or-later   DjVuLibre  GPL-2.0-or-later   pdf2djvu  GPL-2.0-only
 * The binaries are shipped unmodified as separate programs next to the app, together with their
 * license texts and the exact source URLs (GPL-2.0 section 3). `--with-source` keeps a copy of the
 * corresponding source so it can be handed out on request.
 *
 * No dependencies beyond Node >= 22.15 (fetch, zstd) and jszip (already a runtime dependency).
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { once } = require('events');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const UA = 'markooj-fetch-tools (+https://github.com/jgm/pandoc releases consumer)';

// ---------------------------------------------------------------------------------------------
// Pinned facts. Hashes marked "pinned" were computed from the official download on first fetch
// (upstream publishes only PGP signatures for these files) and are checked on every later run.
// ---------------------------------------------------------------------------------------------
// Pandoc is pinned: a release build must ship the same binary that was smoke-tested and whose source is in
// vendor-src/. Move to a newer Pandoc on purpose with --pandoc-version=X or --latest (then fetch its source too).
const PANDOC_VERSION = '3.14';
const PANDOC_FALLBACK_VERSION = PANDOC_VERSION;
const KNOWN_SHA256 = {
  'pandoc-3.14-windows-x86_64.zip': '0144b96e8c7b023fd382ec5ef5bdc475e873f1019d6fa72502492df2c9a94a3b',
  // macOS and Linux (checked against the GitHub release asset digests on 22 Nov 2026)
  'pandoc-3.14-arm64-macOS.zip': '58d6593884fec9d4424b641b92503c316d9c36decb2891ff8d73ae74dd3b6304',
  'pandoc-3.14-x86_64-macOS.zip': '891708579061e7b1c1a6ce0df30ebb3cb2b6d0ca045ed3c8554ab830c1e0c270',
  'pandoc-3.14-linux-amd64.tar.gz': 'c5f4720cdefb3f7bdc5d07202ef579feef0d1370773c873804dd8fdaa8c4f1b8',
  'pdf2djvu-win32-0.9.19.zip': '1050bbbe1427e7005106e7e744bf1a2ae38de18ef49726a951ba164a426f4568',
};
const PDF2DJVU = {
  version: '0.9.19',
  repo: 'https://github.com/jwilk-archive/pdf2djvu', // formerly github.com/jwilk/pdf2djvu (archived, moved)
  homepage: 'https://jwilk.net/software/pdf2djvu',
};
const DJVULIBRE_SF = {
  version: '3.5.29',
  djview: '4.12',
  file: 'DjVuLibre-3.5.29_DjView-4.12_Setup.exe',
  dir: 'DjVuLibre_Windows/3.5.29%2B4.12',
  sourceTarball: 'https://downloads.sourceforge.net/project/djvu/DjVuLibre/3.5.29/djvulibre-3.5.29.tar.gz',
};
const MSYS2 = {
  repo: 'https://repo.msys2.org/mingw/mingw64/',
  db: 'https://repo.msys2.org/mingw/mingw64/mingw64.db',
  sources: 'https://repo.msys2.org/mingw/sources/',
  prefix: 'mingw-w64-x86_64-',
  root: 'mingw64/',
};
const DJVU_REQUIRED = ['ddjvu', 'djvutxt', 'djvused', 'c44', 'djvm'];
// Extra DjVuLibre command-line tools worth having (all small).
const DJVU_EXTRA = ['djvudump', 'djvuextract', 'djvumake', 'djvups', 'cjb2', 'cpaldjvu', 'csepdjvu', 'bzz', 'djvmcvt', 'djvutoxml', 'djvuxmlparser'];

// Windows system DLLs that are never bundled.
const SYSTEM_DLL = /^(api-ms-win-.*|ext-ms-.*|kernel32|kernelbase|user32|gdi32|gdiplus|advapi32|shell32|shlwapi|ole32|oleaut32|msvcrt|ucrtbase|vcruntime\d*|msvcp\d*|ws2_32|wsock32|comdlg32|comctl32|winmm|bcrypt|bcryptprimitives|crypt32|secur32|ntdll|version|rpcrt4|dbghelp|iphlpapi|userenv|imm32|usp10|mpr|netapi32|setupapi|cfgmgr32|psapi|winspool\.drv|dwrite|d2d1|d3d\d+|dxgi|uxtheme|dwmapi|opengl32|glu32|mscms|normaliz|wldap32|dnsapi|ncrypt|powrprof|shcore|wtsapi32|winhttp|wininet|urlmon|propsys|oleacc|msimg32|hid|mswsock|authz|sspicli)\.dll$/i;

// ---------------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}
const ARGS = parseArgs(process.argv.slice(2));
const PLATFORM = String(ARGS.platform || process.platform);
const ARCH = String(ARGS.arch || (PLATFORM !== 'win32' && process.arch === 'arm64' ? 'arm64' : 'x64'));
const FORCE = !!ARGS.force;
const WITH_SOURCE = !!ARGS['with-source'];
const ONLY = ARGS.only ? String(ARGS.only).split(',').map((s) => s.trim()) : ['pandoc', 'pdf2djvu', 'djvulibre'];
const EXE = PLATFORM === 'win32' ? '.exe' : '';

const VENDOR_ROOT = path.join(ROOT, 'vendor');
// Windows keeps its historical folder name (x64 only); macOS and Linux get one folder per architecture so both
// Mac builds (Apple chip and Intel) can be made on one machine.
const VENDOR_NAME = PLATFORM === 'win32' ? 'win32' : `${PLATFORM}-${ARCH}`;
const VENDOR = path.join(VENDOR_ROOT, VENDOR_NAME);
const VENDOR_SRC = path.join(ROOT, 'vendor-src');
const LICENSES = path.join(ROOT, 'licenses');
const MANIFEST_PATH = path.join(VENDOR, 'MANIFEST.json');

// ---------------------------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------------------------
const isTTY = process.stdout.isTTY;
const log = (...a) => console.log(...a);
const step = (s) => log(`\n== ${s}`);
const info = (s) => log(`   ${s}`);
const warn = (s) => log(`   ! ${s}`);
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

// ---------------------------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------------------------
const STALL_MS = 60000;

function headersFor(url) {
  const h = { 'User-Agent': UA };
  if (/^https:\/\/api\.github\.com\//.test(url)) {
    h.Accept = 'application/vnd.github+json';
    if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

async function fetchWithStall(url) {
  const ctl = new AbortController();
  let timer = setTimeout(() => ctl.abort(new Error('connection stalled')), STALL_MS);
  const res = await fetch(url, { headers: headersFor(url), redirect: 'follow', signal: ctl.signal });
  return { res, ctl, bump() { clearTimeout(timer); timer = setTimeout(() => ctl.abort(new Error('connection stalled')), STALL_MS); }, done() { clearTimeout(timer); } };
}

async function getJson(url) {
  const { res, done } = await fetchWithStall(url);
  try {
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    return await res.json();
  } finally { done(); }
}

async function getText(url) {
  const { res, done } = await fetchWithStall(url);
  try {
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    return await res.text();
  } finally { done(); }
}

/** Streams url → dest with progress; returns {sha256, md5, size}. Retries a few times. */
async function download(url, dest, label) {
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await downloadOnce(url, dest, label || path.basename(dest));
    } catch (e) {
      lastErr = e;
      const why = (e.cause && (e.cause.code || e.cause.message)) || e.message;
      warn(`download failed (${why})${attempt < 5 ? ', retrying' : ''}`);
      if (attempt < 5) await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  throw lastErr;
}

// Big files are streamed with Node's https module, not fetch: undici (Node 22's fetch) can crash the whole process with
// "assert(!this.paused)" when a server closes the connection while the stream waits for disk (seen on SourceForge mirrors
// on GitHub's Windows runners). An https error is an ordinary error, so download() can retry it.
function httpsGetFollow(url, redirects = 8) {
  return new Promise((resolve, reject) => {
    const req = require('https').get(url, { headers: headersFor(url) }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects <= 0) return reject(new Error(`too many redirects for ${url}`));
        return resolve(httpsGetFollow(new URL(res.headers.location, url).toString(), redirects - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} ${res.statusMessage || ''} for ${url}`)); }
      resolve(res);
    });
    req.on('error', reject);
    req.setTimeout(STALL_MS, () => req.destroy(new Error('connection stalled')));
  });
}

async function downloadOnce(url, dest, label) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const raw = await httpsGetFollow(url);
  raw.setTimeout?.(STALL_MS, () => raw.destroy(new Error('connection stalled')));
  const h = { bump() {}, done() {} };
  const res = { body: raw, headers: { get: (k) => raw.headers[String(k).toLowerCase()] } };
  const total = Number(res.headers.get('content-length')) || 0;
  const sha = crypto.createHash('sha256');
  const md5 = crypto.createHash('md5');
  const out = fs.createWriteStream(dest);
  let got = 0; let lastShown = 0; let lastStep = -1;
  const show = (final) => {
    const pct = total ? Math.floor((got / total) * 100) : 0;
    const text = `   ${label}: ${total ? `${pct}% of ${mb(total)}` : mb(got)}`;
    if (isTTY) process.stdout.write(`\r${text}${final ? '\n' : ''}`);
    else if (final || (total > 4194304 && Math.floor(pct / 25) !== lastStep)) { lastStep = Math.floor(pct / 25); log(text); }
  };
  try {
    for await (const chunk of res.body) {
      h.bump();
      sha.update(chunk); md5.update(chunk); got += chunk.length;
      if (!out.write(chunk)) await once(out, 'drain');
      const now = Date.now();
      if (now - lastShown > 250) { lastShown = now; show(false); }
    }
  } catch (e) {
    out.destroy();
    throw e;
  } finally { h.done(); }
  await new Promise((resolve, reject) => out.end((e) => (e ? reject(e) : resolve())));
  show(true);
  if (total && got !== total) throw new Error(`incomplete download (${got} of ${total} bytes)`);
  return { sha256: sha.digest('hex'), md5: md5.digest('hex'), size: got };
}

function checkHash(name, actual, expected, how) {
  if (!expected) return 'computed';
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`SHA-256 mismatch for ${name}\n     expected ${expected} (${how})\n     got      ${actual}\n   The download may be corrupted or tampered with. Nothing was installed.`);
  }
  info(`SHA-256 verified (${how})`);
  return how;
}

// ---------------------------------------------------------------------------------------------
// Archives (zip via jszip, tar via a tiny reader, zstd/gzip/xz via node:zlib where possible)
// ---------------------------------------------------------------------------------------------
function loadJSZip() {
  try { return require(path.join(ROOT, 'node_modules', 'jszip')); } catch (_) { /* fall through */ }
  try { return require('jszip'); } catch (_) { /* fall through */ }
  throw new Error('jszip is missing. Run "npm install" in the project folder first.');
}

/** Returns [{name, data:Buffer, mode}] for every file in a zip buffer. */
async function readZip(buf) {
  const JSZip = loadJSZip();
  const zip = await JSZip.loadAsync(buf);
  const out = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    out.push({ name: name.replace(/\\/g, '/'), data: await entry.async('nodebuffer'), mode: entry.unixPermissions || 0 });
  }
  return out;
}

/** Minimal tar reader: ustar, GNU long names, pax path headers. Returns [{name, data, mode, type}]. */
function readTar(buf) {
  const out = [];
  let off = 0; let longName = null; let paxPath = null;
  const str = (o, n) => { const s = buf.toString('utf8', o, o + n); const z = s.indexOf('\0'); return z >= 0 ? s.slice(0, z) : s; };
  const oct = (o, n) => parseInt(str(o, n).trim() || '0', 8);
  while (off + 512 <= buf.length) {
    if (buf[off] === 0 && buf.subarray(off, off + 512).every((b) => b === 0)) break;
    let name = str(off, 100);
    const mode = oct(off + 100, 8);
    let size = oct(off + 124, 12);
    if (buf[off + 124] & 0x80) { size = 0; for (let i = 1; i < 12; i++) size = size * 256 + buf[off + 124 + i]; } // base-256 (rare)
    const type = String.fromCharCode(buf[off + 156] || 48);
    const prefix = buf.toString('utf8', off + 257, off + 263).startsWith('ustar') ? str(off + 345, 155) : '';
    if (prefix) name = `${prefix}/${name}`;
    const dataStart = off + 512;
    const data = buf.subarray(dataStart, dataStart + size);
    off = dataStart + Math.ceil(size / 512) * 512;
    if (type === 'L') { longName = str(dataStart, size); continue; }
    if (type === 'x') {
      const txt = data.toString('utf8');
      const m = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(txt);
      if (m) paxPath = m[1];
      continue;
    }
    if (type === 'g') continue;
    if (longName) { name = longName; longName = null; }
    if (paxPath) { name = paxPath; paxPath = null; }
    out.push({ name: name.replace(/^\.\//, ''), data, mode, type });
  }
  return out;
}

function decompress(buf, name) {
  if (buf[0] === 0x28 && buf[1] === 0xb5 && buf[2] === 0x2f && buf[3] === 0xfd) {
    if (typeof zlib.zstdDecompressSync !== 'function') throw new Error(`${name} is zstd-compressed; this needs Node 22.15 or newer.`);
    return zlib.zstdDecompressSync(buf);
  }
  if (buf[0] === 0x1f && buf[1] === 0x8b) return zlib.gunzipSync(buf);
  return buf;
}

function safeJoin(base, rel) {
  const p = path.resolve(base, rel);
  if (p !== base && !p.startsWith(base + path.sep)) throw new Error(`unsafe path in archive: ${rel}`);
  return p;
}

function writeFile(base, rel, data, mode) {
  const p = safeJoin(base, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  if (mode && process.platform !== 'win32') fs.chmodSync(p, mode & 0o777 || 0o644);
  return p;
}

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }

function dirSize(p) {
  if (!fs.existsSync(p)) return 0;
  const st = fs.statSync(p);
  if (!st.isDirectory()) return st.size;
  return fs.readdirSync(p).reduce((n, f) => n + dirSize(path.join(p, f)), 0);
}

function walk(dir, base = dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p).replace(/\\/g, '/'));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// PE import reader (to copy only the DLLs the Windows tools really need)
// ---------------------------------------------------------------------------------------------
function peImports(buf) {
  try {
    if (buf.readUInt16LE(0) !== 0x5a4d) return [];
    const pe = buf.readUInt32LE(0x3c);
    if (buf.readUInt32LE(pe) !== 0x00004550) return [];
    const nSec = buf.readUInt16LE(pe + 6);
    const optSize = buf.readUInt16LE(pe + 20);
    const opt = pe + 24;
    const magic = buf.readUInt16LE(opt);
    const dd = opt + (magic === 0x20b ? 112 : 96);
    const nDirs = buf.readUInt32LE(dd - 4);
    const secs = [];
    for (let i = 0; i < nSec; i++) {
      const s = opt + optSize + i * 40;
      secs.push({ vsize: buf.readUInt32LE(s + 8), va: buf.readUInt32LE(s + 12), rawSize: buf.readUInt32LE(s + 16), raw: buf.readUInt32LE(s + 20) });
    }
    const r2o = (rva) => {
      for (const s of secs) if (rva >= s.va && rva < s.va + Math.max(s.vsize, s.rawSize)) return rva - s.va + s.raw;
      return -1;
    };
    const cstr = (o) => buf.toString('latin1', o, buf.indexOf(0, o));
    const names = new Set();
    const scan = (dirIndex, descSize, nameField) => {
      if (nDirs <= dirIndex) return;
      const rva = buf.readUInt32LE(dd + dirIndex * 8);
      if (!rva) return;
      let o = r2o(rva);
      for (let guard = 0; o > 0 && guard < 512; guard++, o += descSize) {
        const nameRva = buf.readUInt32LE(o + nameField);
        if (!nameRva) break;
        const no = r2o(nameRva);
        if (no > 0) names.add(cstr(no).toLowerCase());
      }
    };
    scan(1, 20, 12); // import directory
    scan(13, 32, 4); // delay-load imports
    return [...names];
  } catch (_) { return []; }
}

/**
 * Given a pool {lowercaseName: {name, data}} and the chosen executables, returns the DLL names
 * (original case) needed transitively, plus names that are neither in the pool nor system DLLs.
 */
function resolveDlls(pool, exeBuffers) {
  const need = new Map(); const missing = new Set();
  const queue = [...exeBuffers];
  while (queue.length) {
    const buf = queue.pop();
    for (const dll of peImports(buf)) {
      if (need.has(dll)) continue;
      const hit = pool[dll];
      if (hit) { need.set(dll, hit); queue.push(hit.data); }
      else if (!SYSTEM_DLL.test(dll)) missing.add(dll);
    }
  }
  return { dlls: [...need.values()], missing: [...missing] };
}

// ---------------------------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------------------------
function readManifest(p = MANIFEST_PATH) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return { tools: {} }; }
}
function writeManifest(m) {
  m.generated = new Date().toISOString();
  m.platform = VENDOR_NAME;
  m.note = 'Written by scripts/fetch-tools.js. Unmodified upstream binaries; see THIRD_PARTY_NOTICES.md and licenses/.';
  fs.mkdirSync(VENDOR, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(m, null, 2)}\n`);
}
function present(m, tool, version, files) {
  const t = m.tools && m.tools[tool];
  if (!t || (version && t.version !== version)) return false;
  return files.every((f) => fs.existsSync(path.join(VENDOR, f)));
}

// ---------------------------------------------------------------------------------------------
// Pandoc
// ---------------------------------------------------------------------------------------------
function pandocAssetName(v) {
  if (PLATFORM === 'win32') return `pandoc-${v}-windows-x86_64.zip`;
  if (PLATFORM === 'darwin') return `pandoc-${v}-${ARCH === 'arm64' ? 'arm64' : 'x86_64'}-macOS.zip`;
  return `pandoc-${v}-linux-${ARCH === 'arm64' ? 'arm64' : 'amd64'}.tar.gz`;
}

async function pandocRelease() {
  if (ARGS['pandoc-version']) {
    const v = String(ARGS['pandoc-version']);
    try { return { version: v, release: await getJson(`https://api.github.com/repos/jgm/pandoc/releases/tags/${v}`) }; } catch (_) { return { version: v, release: null }; }
  }
  if (!ARGS.latest) {
    try { return { version: PANDOC_VERSION, release: await getJson(`https://api.github.com/repos/jgm/pandoc/releases/tags/${PANDOC_VERSION}`) }; } catch (_) { return { version: PANDOC_VERSION, release: null }; }
  }
  try {
    const list = await getJson('https://api.github.com/repos/jgm/pandoc/releases?per_page=30');
    const rel = list.find((r) => !r.draft && !r.prerelease && /^3\.\d+(\.\d+)*$/.test(r.tag_name));
    if (rel) return { version: rel.tag_name, release: rel };
  } catch (e) {
    warn(`could not ask GitHub for the latest Pandoc release (${e.message}); using ${PANDOC_FALLBACK_VERSION}`);
  }
  return { version: PANDOC_FALLBACK_VERSION, release: null };
}

async function fetchPandoc(manifest, tmp) {
  step('Pandoc');
  const target = `pandoc/pandoc${EXE}`;
  let rel;
  try { rel = await pandocRelease(); } catch (e) { rel = { version: PANDOC_FALLBACK_VERSION, release: null }; }
  const { version } = rel;
  if (!FORCE && present(manifest, 'pandoc', version, [target])) { info(`Pandoc ${version} already present, skipping.`); return; }
  const asset = pandocAssetName(version);
  const url = `https://github.com/jgm/pandoc/releases/download/${version}/${asset}`;
  const ghAsset = rel.release && (rel.release.assets || []).find((a) => a.name === asset);
  const expected = (ghAsset && ghAsset.digest && ghAsset.digest.replace(/^sha256:/, '')) || KNOWN_SHA256[asset];
  const how = ghAsset && ghAsset.digest ? 'GitHub release asset digest' : 'pinned in fetch-tools.js';
  info(`Pandoc ${version} from ${url}`);
  const file = path.join(tmp, asset);
  const dl = await download(url, file, asset);
  const verified = checkHash(asset, dl.sha256, expected, how);

  const raw = fs.readFileSync(file);
  const entries = asset.endsWith('.zip') ? await readZip(raw) : readTar(decompress(raw, asset));
  const exeEntry = entries.find((e) => (PLATFORM === 'win32' ? /(^|\/)pandoc\.exe$/i : /(^|\/)bin\/pandoc$/).test(e.name));
  if (!exeEntry) throw new Error(`pandoc executable not found inside ${asset}`);
  const dir = path.join(VENDOR, 'pandoc');
  rmrf(dir);
  writeFile(dir, `pandoc${EXE}`, exeEntry.data, 0o755);
  const docs = {};
  for (const e of entries) {
    const base = path.posix.basename(e.name);
    if (/^(COPYING|COPYRIGHT)(\.\w+)?$/i.test(base)) { writeFile(dir, base, e.data); docs[base] = e.data; }
  }

  // License texts.
  fs.mkdirSync(LICENSES, { recursive: true });
  const copyrightTxt = docs['COPYRIGHT.txt'] || docs.COPYRIGHT || docs['COPYRIGHT.md'];
  if (copyrightTxt) fs.writeFileSync(path.join(LICENSES, 'pandoc-COPYRIGHT'), copyrightTxt);
  let copying = null;
  try { copying = await getText(`https://raw.githubusercontent.com/jgm/pandoc/${version}/COPYING.md`); } catch (e) { warn(`could not fetch COPYING.md (${e.message})`); }
  if (copying) fs.writeFileSync(path.join(LICENSES, 'pandoc-COPYING'), copying);
  else if (docs['COPYING.rtf']) fs.writeFileSync(path.join(LICENSES, 'pandoc-COPYING.rtf'), docs['COPYING.rtf']);

  const sourceUrls = [
    `https://github.com/jgm/pandoc/archive/refs/tags/${version}.tar.gz`,
    `https://hackage.haskell.org/package/pandoc-${version}/pandoc-${version}.tar.gz`,
  ];
  manifest.tools.pandoc = {
    version,
    license: 'GPL-2.0-or-later',
    homepage: 'https://pandoc.org',
    url,
    sha256: dl.sha256,
    sha256Check: verified,
    size: dl.size,
    files: [target, ...Object.keys(docs).map((d) => `pandoc/${d}`)],
    sourceUrls,
    sourceDownloads: [{ url: sourceUrls[0], name: `pandoc-${version}.tar.gz` }],
    notes: 'Statically linked Haskell program; its library dependencies (all on Hackage) are listed in the release and in COPYRIGHT.',
  };
  info(`installed ${target} (${mb(exeEntry.data.length)})`);
}

// ---------------------------------------------------------------------------------------------
// pdf2djvu (Windows: the official win32 zip, which also carries some DjVuLibre tools + poppler)
// ---------------------------------------------------------------------------------------------
async function fetchPdf2djvu(manifest, tmp) {
  step('pdf2djvu');
  if (PLATFORM !== 'win32') {
    info('pdf2djvu has no official macOS/Linux binaries. Install it from your package manager:');
    info('  macOS:  brew install pdf2djvu');
    info('  Debian/Ubuntu:  sudo apt install pdf2djvu    Fedora:  sudo dnf install pdf2djvu');
    info(`Markooj finds it on PATH (and in /opt/homebrew/bin, /usr/local/bin). It is not bundled in vendor/${VENDOR_NAME}.`);
    return;
  }
  const { version } = PDF2DJVU;
  const target = 'pdf2djvu/pdf2djvu.exe';
  if (!FORCE && present(manifest, 'pdf2djvu', version, [target])) { info(`pdf2djvu ${version} already present, skipping.`); return; }
  const asset = `pdf2djvu-win32-${version}.zip`;
  const url = `${PDF2DJVU.repo}/releases/download/${version}/${asset}`;
  info(`pdf2djvu ${version} from ${url}`);
  const file = path.join(tmp, asset);
  const dl = await download(url, file, asset);
  const verified = checkHash(asset, dl.sha256, KNOWN_SHA256[asset], 'pinned in fetch-tools.js');

  const entries = await readZip(fs.readFileSync(file));
  const dir = path.join(VENDOR, 'pdf2djvu');
  rmrf(dir);
  const strip = (n) => n.replace(/^pdf2djvu-[^/]+\//, '');
  for (const e of entries) writeFile(dir, strip(e.name), e.data, e.mode);
  if (!fs.existsSync(path.join(dir, 'pdf2djvu.exe'))) throw new Error('pdf2djvu.exe not found in the zip');

  fs.mkdirSync(LICENSES, { recursive: true });
  const lic = {
    'doc/COPYING.txt': 'pdf2djvu-COPYING',
    'doc/COPYING.libs.html': 'pdf2djvu-COPYING.libs.html',
    'doc/COPYING.poppler-data.html': 'pdf2djvu-COPYING.poppler-data.html',
    'doc/COPYING.fonts.html': 'pdf2djvu-COPYING.fonts.html',
    'doc/credits.html': 'pdf2djvu-credits.html',
  };
  for (const [from, to] of Object.entries(lic)) {
    const p = path.join(dir, from);
    if (fs.existsSync(p)) fs.copyFileSync(p, path.join(LICENSES, to));
  }

  const sourceUrls = [
    `${PDF2DJVU.repo}/releases/download/${version}/pdf2djvu-${version}.tar.xz`,
    `${PDF2DJVU.repo}/releases/download/${version}/pdf2djvu-win32-source-${version}.tar.xz`,
  ];
  manifest.tools.pdf2djvu = {
    version,
    license: 'GPL-2.0-only',
    homepage: PDF2DJVU.homepage,
    url,
    sha256: dl.sha256,
    sha256Check: verified,
    size: dl.size,
    files: walk(dir).map((f) => `pdf2djvu/${f}`).filter((f) => /\.(exe|dll)$/i.test(f)),
    sourceUrls,
    bundledLibraries: 'DjVuLibre (libdjvulibre-21.dll + c44/cjb2/csepdjvu/djvused/djvumake/djvuextract/djvmcvt/bzz), Poppler, poppler-data, GraphicsMagick, Exiv2, FreeType, Fontconfig, Expat, libjpeg, OpenJPEG, libiconv, gettext (libintl), GCC runtime, URW fonts. Licenses: licenses/pdf2djvu-COPYING.libs.html. Their source: pdf2djvu-win32-source tarball.',
  };
  manifest.tools.pdf2djvu.sourceDownloads = sourceUrls.map((url) => ({ url }));
  info(`installed ${target} and ${manifest.tools.pdf2djvu.files.length - 1} helper programs/DLLs`);
}

// ---------------------------------------------------------------------------------------------
// DjVuLibre (Windows)
//   Route 1 "sourceforge": the official DjVuLibre + DjView installer, unpacked with 7-Zip (never run).
//   Route 2 "msys2": the MSYS2 mingw64 build (an official MinGW-w64 distribution), SHA-256 from the
//                    signed repository database. Used when SourceForge cannot be reached.
// ---------------------------------------------------------------------------------------------
function find7z() {
  const cands = [];
  if (ARGS['7z']) cands.push(String(ARGS['7z']));
  if (process.platform === 'win32') {
    for (const env of ['ProgramFiles', 'ProgramW6432', 'ProgramFiles(x86)']) if (process.env[env]) cands.push(path.join(process.env[env], '7-Zip', '7z.exe'));
  }
  for (const c of cands) if (fs.existsSync(c)) return c;
  for (const name of ['7z', '7zz']) {
    try { execFileSync(name, ['i'], { stdio: 'ignore' }); return name; } catch (_) { /* not on PATH */ }
  }
  return null; // note: 7zip-bin's 7za cannot open NSIS installers, so it is not used here
}

function installDjvu(pool, exeNames, sourceLabel) {
  // pool: {lowercase basename: {name, data}}
  const dir = path.join(VENDOR, 'djvulibre');
  const exes = [];
  for (const n of [...DJVU_REQUIRED, ...DJVU_EXTRA]) {
    const hit = pool[`${n}.exe`];
    if (hit) exes.push(hit);
    else if (DJVU_REQUIRED.includes(n)) throw new Error(`${n}.exe is missing from the ${sourceLabel} build`);
  }
  const { dlls, missing } = resolveDlls(pool, exes.map((e) => e.data));
  if (missing.length) warn(`not bundled (assumed to come with Windows): ${missing.join(', ')}`);
  rmrf(dir);
  for (const f of [...exes, ...dlls]) writeFile(dir, f.name, f.data, 0o755);
  return { dir, files: [...exes, ...dlls].map((f) => `djvulibre/${f.name}`) };
}

async function djvuFromSourceForge(manifest, tmp) {
  const sevenZip = find7z();
  if (!sevenZip) throw new Error('7-Zip (7z.exe) was not found; it is needed to unpack the DjVuLibre installer without running it. Install 7-Zip or pass --7z=<path>.');
  const v = DJVULIBRE_SF;
  const url = `https://downloads.sourceforge.net/project/djvu/${v.dir}/${v.file}`;
  let expectedMd5 = null;
  try {
    const rss = await getText(`https://sourceforge.net/projects/djvu/rss?path=/DjVuLibre_Windows`);
    const item = rss.split('<item>').find((s) => s.includes(v.file));
    const m = item && /algo="md5">([0-9a-f]{32})</.exec(item);
    if (m) expectedMd5 = m[1];
  } catch (_) { /* checked below */ }
  let file = ARGS['djvulibre-installer'] ? path.resolve(String(ARGS['djvulibre-installer'])) : path.join(tmp, v.file);
  let dl;
  if (ARGS['djvulibre-installer']) {
    const buf = fs.readFileSync(file);
    dl = { sha256: crypto.createHash('sha256').update(buf).digest('hex'), md5: crypto.createHash('md5').update(buf).digest('hex'), size: buf.length };
    info(`using local installer ${file}`);
  } else {
    info(`DjVuLibre ${v.version} from ${url}`);
    dl = await download(url, file, v.file);
  }
  if (expectedMd5) {
    if (dl.md5 !== expectedMd5) throw new Error(`MD5 mismatch for ${v.file} (SourceForge lists ${expectedMd5}, got ${dl.md5}). Nothing was installed.`);
    info('MD5 verified against the SourceForge file listing (SHA-256 recorded in MANIFEST.json)');
  } else warn('SourceForge checksum not available; recording the computed SHA-256 only');

  const out = path.join(tmp, 'djvu-installer');
  fs.mkdirSync(out, { recursive: true });
  execFileSync(sevenZip, ['x', '-y', `-o${out}`, file], { stdio: 'ignore' });
  const pool = {};
  const all = walk(out);
  for (const rel of all) {
    const base = path.posix.basename(rel);
    if (!/\.(exe|dll)$/i.test(base) || /uninst/i.test(base)) continue;
    const key = base.toLowerCase();
    if (!pool[key]) pool[key] = { name: base, data: fs.readFileSync(path.join(out, rel)) };
  }
  const res = installDjvu(pool, DJVU_REQUIRED, 'SourceForge');
  fs.mkdirSync(LICENSES, { recursive: true });
  const copying = all.find((r) => /(^|\/)COPYING(\.txt)?$/i.test(r));
  if (copying) fs.copyFileSync(path.join(out, copying), path.join(LICENSES, 'djvulibre-COPYING'));
  manifest.tools.djvulibre = {
    version: v.version,
    license: 'GPL-2.0-or-later',
    homepage: 'https://djvu.sourceforge.net',
    route: 'sourceforge',
    url,
    sha256: dl.sha256,
    md5: dl.md5,
    sha256Check: expectedMd5 ? 'md5 from SourceForge listing; sha256 computed' : 'computed',
    size: dl.size,
    files: res.files,
    sourceUrls: [v.sourceTarball, 'https://sourceforge.net/p/djvu/djvulibre-git/ci/master/tree/'],
  };
  manifest.tools.djvulibre.sourceDownloads = [{ url: v.sourceTarball }];
}

function parseMsysDb(buf) {
  const pkgs = {}; const provides = {};
  for (const e of readTar(decompress(buf, 'mingw64.db'))) {
    if (!e.name.endsWith('/desc')) continue;
    const d = {}; let key = null;
    for (const line of e.data.toString('utf8').split('\n')) {
      const m = /^%([A-Z0-9]+)%$/.exec(line);
      if (m) { key = m[1]; d[key] = []; } else if (line && key) d[key].push(line);
    }
    const p = {
      name: d.NAME[0], version: d.VERSION[0], base: (d.BASE || d.NAME)[0], filename: d.FILENAME[0], sha256: (d.SHA256SUM || [])[0],
      license: (d.LICENSE || []).join(' AND '), url: (d.URL || [])[0], depends: (d.DEPENDS || []).map((x) => x.split(/[<>=]/)[0]),
    };
    pkgs[p.name] = p;
    for (const pr of d.PROVIDES || []) provides[pr.split(/[<>=]/)[0]] = p.name;
  }
  return { pkgs, provides };
}

async function djvuFromMsys2(manifest, tmp) {
  info(`MSYS2 package database ${MSYS2.db}`);
  const dbFile = path.join(tmp, 'mingw64.db');
  await download(MSYS2.db, dbFile, 'mingw64.db');
  const { pkgs, provides } = parseMsysDb(fs.readFileSync(dbFile));
  const rootName = `${MSYS2.prefix}djvulibre`;
  if (!pkgs[rootName]) throw new Error('djvulibre is not in the MSYS2 mingw64 repository');
  // Dependency closure.
  const order = []; const seen = new Set(); const stack = [rootName];
  while (stack.length) {
    let n = stack.pop();
    if (!pkgs[n] && provides[n]) n = provides[n];
    if (!pkgs[n] || seen.has(n)) continue;
    seen.add(n); order.push(pkgs[n]);
    for (const d of pkgs[n].depends) stack.push(d);
  }
  info(`${order.length} packages: ${order.map((p) => p.name.replace(MSYS2.prefix, '')).join(', ')}`);

  const pool = {}; const licenseFiles = {}; const owner = {};
  const usedPkgs = [];
  for (const p of order) {
    const file = path.join(tmp, p.filename);
    const dl = await download(MSYS2.repo + p.filename, file, p.filename);
    checkHash(p.filename, dl.sha256, p.sha256, 'MSYS2 repository database');
    for (const e of readTar(decompress(fs.readFileSync(file), p.filename))) {
      if (e.type !== '0' && e.type !== '\0') continue;
      if (!e.name.startsWith(MSYS2.root)) continue;
      const rel = e.name.slice(MSYS2.root.length);
      const base = path.posix.basename(rel);
      if (/^bin\/[^/]+\.(dll|exe)$/i.test(rel)) {
        const key = base.toLowerCase();
        if (!pool[key]) { pool[key] = { name: base, data: Buffer.from(e.data) }; owner[key] = p.name; }
      } else if (/^share\/licenses\//.test(rel)) {
        (licenseFiles[p.name] = licenseFiles[p.name] || []).push({ rel: rel.replace(/^share\/licenses\//, ''), data: Buffer.from(e.data) });
      } else if (p.name === rootName && /^share\/djvu\/osi\//.test(rel)) {
        (licenseFiles.__osi = licenseFiles.__osi || []).push({ rel, data: Buffer.from(e.data) });
      }
    }
    usedPkgs.push({ ...p, size: dl.size });
  }
  // Only take executables from the djvulibre package itself.
  for (const k of Object.keys(pool)) if (k.endsWith('.exe') && owner[k] !== rootName) delete pool[k];
  const res = installDjvu(pool, DJVU_REQUIRED, 'MSYS2');
  // Message catalogs (so error messages are readable): djvulibre looks in <exe dir>/share/djvu/osi.
  for (const f of licenseFiles.__osi || []) writeFile(res.dir, f.rel, f.data);

  // Which packages ended up contributing files?
  const contributing = new Set(res.files.map((f) => owner[path.posix.basename(f).toLowerCase()]).filter(Boolean));
  const packages = usedPkgs.filter((p) => contributing.has(p.name)).map((p) => ({
    name: p.name, version: p.version, license: p.license, homepage: p.url,
    binary: MSYS2.repo + p.filename, sha256: p.sha256,
    source: `${MSYS2.sources}${p.base}-${p.version}.src.tar.zst`,
    files: res.files.filter((f) => owner[path.posix.basename(f).toLowerCase()] === p.name).map((f) => path.posix.basename(f)),
  }));

  // Licenses: DjVuLibre's own COPYING/COPYRIGHT come from its source package (upstream tarball inside).
  fs.mkdirSync(LICENSES, { recursive: true });
  const depLic = path.join(LICENSES, 'djvulibre-libraries');
  rmrf(depLic);
  for (const p of packages) {
    for (const f of licenseFiles[p.name] || []) writeFile(depLic, f.rel, f.data);
  }
  const djvu = pkgs[rootName];
  const srcName = `${djvu.base}-${djvu.version}.src.tar.zst`;
  const kept = path.join(VENDOR_SRC, 'djvulibre', srcName);
  const srcFile = fs.existsSync(kept) && !FORCE ? kept : path.join(tmp, srcName);
  if (srcFile !== kept) await download(MSYS2.sources + srcName, srcFile, srcName);
  const upstreamVersion = djvu.version.replace(/-\d+$/, '');
  let gotCopying = false;
  for (const e of readTar(decompress(fs.readFileSync(srcFile), srcName))) {
    if (!/djvulibre-[\d.]+\.tar\.gz$/.test(e.name)) continue;
    for (const f of readTar(zlib.gunzipSync(e.data))) {
      if (/^djvulibre-[\d.]+\/COPYING$/.test(f.name)) { fs.writeFileSync(path.join(LICENSES, 'djvulibre-COPYING'), f.data); gotCopying = true; }
      if (/^djvulibre-[\d.]+\/COPYRIGHT$/.test(f.name)) fs.writeFileSync(path.join(LICENSES, 'djvulibre-COPYRIGHT'), f.data);
    }
  }
  if (!gotCopying) warn('DjVuLibre COPYING not found in its source package');

  manifest.tools.djvulibre = {
    version: upstreamVersion,
    license: 'GPL-2.0-or-later',
    homepage: 'https://djvu.sourceforge.net',
    route: 'msys2',
    routeNote: 'Built by the MSYS2 project (MinGW-w64 x86_64) from the unmodified DjVuLibre release plus the patches in its source package.',
    files: res.files,
    packages,
    sourceUrls: [...new Set(packages.map((p) => p.source)), `https://downloads.sourceforge.net/project/djvu/DjVuLibre/${upstreamVersion}/djvulibre-${upstreamVersion}.tar.gz`],
    // The MSYS2 source packages hold the upstream tarballs plus the build recipe and patches.
    sourceDownloads: [...new Set(packages.map((p) => p.source))].map((url) => ({ url })),
  };
}

// ---------------------------------------------------------------------------------------------
// Corresponding source (--with-source): vendor-src/<tool>/<file> for every tool in the manifest
// ---------------------------------------------------------------------------------------------
async function contentLength(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: headersFor(url) });
    return Number(r.headers.get('content-length')) || 0;
  } catch (_) { return 0; }
}

async function fetchSources(manifest) {
  const maxMb = ARGS['source-max-mb'] ? Number(ARGS['source-max-mb']) : Infinity;
  for (const [tool, t] of Object.entries(manifest.tools)) {
    if (!t.sourceDownloads || !t.sourceDownloads.length) continue;
    step(`${tool} source`);
    const kept = [], skipped = [];
    for (const { url, name } of t.sourceDownloads) {
      const file = name || decodeURIComponent(path.posix.basename(new URL(url).pathname));
      const dest = path.join(VENDOR_SRC, tool, file);
      const rel = path.relative(ROOT, dest).replace(/\\/g, '/');
      if (fs.existsSync(dest) && !FORCE) { info(`${file} already present`); kept.push({ file: rel, url }); continue; }
      if (maxMb !== Infinity) {
        const len = await contentLength(url);
        if (len > maxMb * 1048576) { warn(`skipped ${file} (${mb(len)}, over --source-max-mb=${maxMb}); get it from ${url}`); skipped.push(file); continue; }
      }
      const s = await download(url, dest, file);
      kept.push({ file: rel, url, sha256: s.sha256, size: s.size });
    }
    t.source = kept;
    // every bundled tool is GPL: a release without its complete corresponding source must not be built
    if (skipped.length) throw new Error(`${tool}: the GPL source ${skipped.join(', ')} was not kept. Run again without --source-max-mb (or a larger value).`);
  }
  if (manifest.tools.pandoc) warn('Pandoc links Haskell libraries statically. Keep their Hackage sources with the release too, e.g. `cabal get` for every package in the pandoc ' + manifest.tools.pandoc.version + ' build plan (cabal.project.freeze), into vendor-src/pandoc/hackage/.');
}

async function fetchDjvulibre(manifest, tmp) {
  step('DjVuLibre');
  if (PLATFORM !== 'win32') {
    info('DjVuLibre has no official portable macOS/Linux binaries. Install it from your package manager:');
    info('  macOS:  brew install djvulibre');
    info('  Debian/Ubuntu:  sudo apt install djvulibre-bin    Fedora:  sudo dnf install djvulibre');
    info(`Markooj finds them on PATH (and in /opt/homebrew/bin, /usr/local/bin). They are not bundled in vendor/${VENDOR_NAME}.`);
    return;
  }
  const required = DJVU_REQUIRED.map((n) => `djvulibre/${n}.exe`);
  const m = manifest.tools.djvulibre;
  if (!FORCE && m && required.every((f) => fs.existsSync(path.join(VENDOR, f)))) {
    info(`DjVuLibre ${m.version} (${m.route}) already present, skipping. Use --force to fetch again.`);
    return;
  }
  const route = String(ARGS['djvu-source'] || (ARGS['djvulibre-installer'] ? 'sourceforge' : 'auto'));
  if (route === 'sourceforge' || route === 'auto') {
    try { await djvuFromSourceForge(manifest, tmp); info('installed from the official SourceForge build'); return; } catch (e) {
      if (route === 'sourceforge') throw e;
      warn(`SourceForge route did not work: ${(e.cause && e.cause.code) || e.message}`);
      info('falling back to the MSYS2 mingw64 build of DjVuLibre');
    }
  }
  await djvuFromMsys2(manifest, tmp);
  info(`installed ${manifest.tools.djvulibre.files.length} files from MSYS2 (DjVuLibre ${manifest.tools.djvulibre.version})`);
}

// ---------------------------------------------------------------------------------------------
// THIRD_PARTY_NOTICES.md + licenses/npm-licenses.txt
// ---------------------------------------------------------------------------------------------
function readPkg(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch (_) { return null; } }
function licenseOf(pj, lockEntry) {
  let l = (lockEntry && lockEntry.license) || (pj && pj.license);
  if (!l && pj && Array.isArray(pj.licenses)) l = pj.licenses.map((x) => x.type || x).join(' OR ');
  if (l && typeof l === 'object') l = l.type;
  return l || 'see package';
}
function repoOf(pj) {
  if (!pj) return '';
  let r = pj.repository; if (r && typeof r === 'object') r = r.url;
  if (!r) return pj.homepage || '';
  r = String(r).replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://').replace(/^ssh:\/\/git@/, 'https://');
  r = r.replace(/^git@([^:]+):/, 'https://$1/');
  if (/^github:/.test(r)) r = `https://github.com/${r.slice(7)}`;
  if (/^[\w.-]+\/[\w.-]+$/.test(r)) r = `https://github.com/${r}`;
  return r;
}
function licenseText(dir) {
  try {
    const f = fs.readdirSync(dir).find((n) => /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i.test(n) || /^licen[cs]e[-.]/i.test(n));
    return f ? fs.readFileSync(path.join(dir, f), 'utf8') : null;
  } catch (_) { return null; }
}

// Writing tools, dictionaries, thesaurus data and fonts that ship inside the app (their license files are copied
// into licenses/ so the About box and the installed copy carry them). `copyright` is read from the license file.
const EXTRA_COMPONENTS = [
  { pkg: 'harper.js', title: 'Harper (harper.js)', license: 'Apache-2.0', files: ['LICENSE'], dest: 'harper-LICENSE.txt',
    what: 'offline grammar checker (WebAssembly) used by the Writing Assistant', copyright: 'Copyright © the Harper contributors (Automattic); package author Elijah Potter', url: 'https://github.com/automattic/harper' },
  { pkg: 'nspell', title: 'nspell', license: 'MIT', files: ['license'], dest: 'nspell-LICENSE.txt', what: 'Hunspell-compatible spelling checker', url: 'https://github.com/wooorm/nspell' },
  { pkg: 'dictionary-en', title: 'dictionary-en (US English, SCOWL)', license: 'MIT AND BSD (SCOWL)', files: ['license'], dest: 'dictionary-en-LICENSE.txt',
    what: 'US English spelling dictionary, made from SCOWL (Spell Checker Oriented Word Lists) by Kevin Atkinson and others', copyright: 'Copyright 2000-2018 by Kevin Atkinson and the other SCOWL authors named in the license file', url: 'https://github.com/wooorm/dictionaries (SCOWL: http://wordlist.aspell.net)' },
  { pkg: 'dictionary-en-gb', title: 'dictionary-en-gb (UK English, SCOWL)', license: 'MIT AND BSD (SCOWL)', files: ['license'], dest: 'dictionary-en-gb-LICENSE.txt',
    what: 'UK English spelling dictionary, made from SCOWL', copyright: 'Copyright 2000-2018 by Kevin Atkinson and the other SCOWL authors named in the license file', url: 'https://github.com/wooorm/dictionaries (SCOWL: http://wordlist.aspell.net)' },
  { pkg: 'dictionary-fa', title: 'dictionary-fa (Persian, Lilak)', license: 'Apache-2.0', files: ['license'], dest: 'dictionary-fa-LICENSE.txt', what: 'Persian spelling dictionary (Lilak)', copyright: 'Lilak, Persian Spell Checking Dictionary, Copyright 2015 (see the license file)', url: 'https://github.com/wooorm/dictionaries' },
  { pkg: 'wordnet-db', title: 'WordNet 3.x (wordnet-db)', license: 'WordNet 3.0 License (Princeton University); npm package MIT', files: ['LICENSE'], dest: 'wordnet-LICENSE.txt',
    what: 'English lexical database behind Synonyms and the Thesaurus pane (Markooj ships data derived from it)', copyright: 'WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved.', url: 'https://wordnet.princeton.edu (package: https://github.com/moos/wordnet-db)' },
  { pkg: 'write-good', title: 'write-good', license: 'MIT', files: ['LICENSE'], dest: 'write-good-LICENSE.txt', what: 'style checks (passive voice, weasel words, wordy phrases)', url: 'https://github.com/btford/write-good' },
  { pkg: '@fontsource/noto-nastaliq-urdu', title: 'Noto Nastaliq Urdu (font)', license: 'OFL-1.1', files: ['LICENSE'], dest: 'font-noto-nastaliq-urdu-OFL.txt', what: 'Urdu font (via Fontsource)', url: 'https://github.com/notofonts/nastaliq' },
  { pkg: '@fontsource/noto-naskh-arabic', title: 'Noto Naskh Arabic (font)', license: 'OFL-1.1', files: ['LICENSE'], dest: 'font-noto-naskh-arabic-OFL.txt', what: 'Arabic font (via Fontsource)', url: 'https://github.com/notofonts/arabic' },
  { pkg: '@fontsource/vazirmatn', title: 'Vazirmatn (font)', license: 'OFL-1.1', files: ['LICENSE'], dest: 'font-vazirmatn-OFL.txt', what: 'Persian font (via Fontsource)', url: 'https://github.com/rastikerdar/vazirmatn' },
];
function firstCopyright(txt) {
  const m = /^\s*(copyright\b(?! notice)(?! owner)[^\n]*\d{4}[^\n]*)$/im.exec(txt || '');
  return m ? m[1].trim().replace(/\s+/g, ' ') : null;
}

function writeNotices() {
  step('THIRD_PARTY_NOTICES.md');
  const pkg = readPkg(ROOT) || {};
  const direct = Object.keys(pkg.dependencies || {});
  let lock = {};
  try { lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')); } catch (_) { /* optional */ }
  const prod = [];
  for (const [k, v] of Object.entries(lock.packages || {})) {
    if (!k || v.dev || v.devOptional || v.link) continue;
    const dir = path.join(ROOT, k);
    if (!fs.existsSync(dir)) continue; // optional platform packages not installed here
    const pj = readPkg(dir);
    const name = k.replace(/^.*node_modules\//, '');
    let license = licenseOf(pj, v);
    if (license === 'see package') {
      const txt = licenseText(dir) || '';
      if (/Permission is hereby granted, free of charge/i.test(txt)) license = 'MIT (from license file)';
      else if (/Permission to use, copy, modify, and\/or distribute/i.test(txt)) license = 'ISC (from license file)';
    }
    prod.push({ name, version: v.version || (pj && pj.version), license, repo: repoOf(pj), dir, direct: direct.includes(name) && k === `node_modules/${name}` });
  }
  prod.sort((a, b) => (a.direct === b.direct ? a.name.localeCompare(b.name) : a.direct ? -1 : 1));

  // Bundled tools from every platform manifest present.
  const manifests = fs.existsSync(VENDOR_ROOT)
    ? fs.readdirSync(VENDOR_ROOT).filter((d) => fs.existsSync(path.join(VENDOR_ROOT, d, 'MANIFEST.json'))).map((d) => readManifest(path.join(VENDOR_ROOT, d, 'MANIFEST.json')))
    : [];

  // where people can ask for the GPL source: package.json "bugs" (email or URL), "homepage" or "repository"
  const bugs = pkg.bugs && (typeof pkg.bugs === 'string' ? pkg.bugs : pkg.bugs.email ? `mailto:${pkg.bugs.email}` : pkg.bugs.url);
  const where = bugs || pkg.homepage || repoOf(pkg) || '';
  const contact = where ? `at ${where.replace(/^mailto:/, '')}` : 'the Markooj maintainers (see the "homepage" field of package.json)';
  if (!where) warn('package.json has no "homepage", "bugs" or "repository": the GPL written offer has no address people can use. Add one before releasing.');
  const home = pkg.homepage || repoOf(pkg) || '';
  // the GitHub repository (the homepage may be the project website instead)
  const repoHome = [repoOf(pkg), home].find((u) => /github\.com\/[^/]+\/[^/]+/.test(u || '')) || '';
  const releases = repoHome ? `${repoHome.replace(/\.git$/, '').replace(/\/$/, '')}/releases` : '';
  const L = [];
  L.push('# Third-party notices', '');
  L.push(`Markooj ${pkg.version || ''} — ${pkg.build && pkg.build.copyright ? pkg.build.copyright : 'Markooj contributors'}.${home ? ` Project: ${home}` : ''}`, '');
  L.push('Markooj is free software under the GNU Affero General Public License, version 3 or any later version (AGPL-3.0-or-later; see `LICENSE.txt` next to the app, or `LICENSE` in the source). It ships with the third-party software listed below.');
  L.push('Each item keeps its own license. License texts are in the `licenses/` folder next to the app');
  L.push('(installed as `resources/licenses`), and the npm packages also keep their own `LICENSE` files inside `node_modules`.');
  L.push('This file is generated by `node scripts/fetch-tools.js --notices`; edit that script, not this file.', '');

  L.push('## Bundled command-line programs', '');
  L.push('**License compatibility.** The libraries, data and fonts listed in this file are under licenses that allow use in an AGPL v3 program');
  L.push('(MIT, BSD, ISC, Apache-2.0, MPL-2.0, PSF-2.0, OFL-1.1, the WordNet license and CC BY-SA 3.0 for the citation styles), or, where a');
  L.push('library offers a choice, under its GPL-3.0-or-later option, which AGPL v3 section 13 lets Markooj combine with (elkjs inside Mermaid).');
  L.push('Pandoc and DjVuLibre (GPL-2.0-or-later) and pdf2djvu (GPL-2.0-only) are not part of Markooj: they are shipped next to it as');
  L.push('separate programs and run as tools, so each keeps its own license and Markooj’s AGPL does not apply to them.', '');
  L.push('These are separate programs. Markooj starts them as child processes; it does not link to them.');
  L.push('They are redistributed **unmodified**, exactly as published by their upstream projects, under the');
  L.push('GNU General Public License (GPL). Under GPL-2.0 section 3 you are entitled to the complete corresponding');
  L.push('source code. It is available from the URLs listed for each program below.');
  L.push('');
  L.push('**Written offer:** for at least three years after each Markooj release, the Markooj maintainers will');
  L.push('give anyone who asks a copy of the complete corresponding source code of these programs, for no more');
  L.push(`than the cost of providing it. Ask ${contact}.`);
  if (releases) L.push(`The same source archives are also attached to each Markooj release at ${releases} (file \`Markooj-<version>-third-party-sources.zip\`).`);
  L.push('');
  const toolRows = [];
  for (const m of manifests) {
    const t = m.tools || {};
    if (t.pandoc) {
      toolRows.push(`### Pandoc ${t.pandoc.version} (${m.platform})`, '',
        '- What: universal document converter, used for DOCX/ODT/RTF/EPUB/LaTeX and other import/export.',
        `- License: **GPL-2.0-or-later** (Copyright © 2006 onward John MacFarlane and contributors; some modules BSD-3-Clause, all GPL-compatible). Texts: \`licenses/pandoc-COPYING\`, \`licenses/pandoc-COPYRIGHT\` (the COPYRIGHT file also lists the licenses of the libraries pandoc includes, such as Lua (MIT) and the Haskell libraries).`,
        `- Binary: ${t.pandoc.url}`,
        `- SHA-256: \`${t.pandoc.sha256}\` (${t.pandoc.sha256Check})`,
        `- Source: ${t.pandoc.sourceUrls.join(' , ')} ; Haskell dependencies: https://hackage.haskell.org`,
        `- Homepage: ${t.pandoc.homepage}`, '',
        `#### Pandoc's Haskell libraries (written offer)`, '',
        `The Pandoc program above is statically linked with Haskell libraries published on Hackage (for example pandoc-types, texmath, skylighting, citeproc, commonmark, doclayout, aeson, text and the GHC base libraries). Their licenses are listed in \`licenses/pandoc-COPYRIGHT\`; the exact package set of the build is named in the Pandoc ${t.pandoc.version} source (\`cabal.project\`, \`pandoc.cabal\`). Each library's source is at \`https://hackage.haskell.org/package/<name>-<version>\` (index: https://hackage.haskell.org/packages/), and Pandoc itself at https://hackage.haskell.org/package/pandoc-${t.pandoc.version}.`, '',
        `**Written offer (GPL-2.0 section 3(b)):** for at least three years after each Markooj release, the Markooj maintainers will give any third party, on request, a complete machine-readable copy of the corresponding source code of the Pandoc ${t.pandoc.version} program shipped with that release, including the source of every Haskell library linked into it, on a medium customarily used for software interchange, for a charge no more than the cost of physically performing the distribution. Ask ${contact}.`, '');
    }
    if (t.djvulibre) {
      const d = t.djvulibre;
      toolRows.push(`### DjVuLibre ${d.version} (${m.platform})`, '',
        ...(d.route === 'msys2' ? [`- Version: the MSYS2 package ${(d.packages || []).find(p => /djvulibre/.test(p.name))?.version || d.version}. Its programs still print “DjVuLibre-3.5.29” as their own version (\`ddjvu --help\`), so Help → Check Tools shows that number next to the package version.`] : []),
        '- What: DjVu tools (`ddjvu` renders pages, `djvutxt` extracts text, `djvused` edits metadata/annotations, `c44` encodes images, `djvm` bundles pages).',
        '- License: **GPL-2.0-or-later** (Copyright © 1999-2001 LizardTech, © 2001 AT&T, © 2002-2008 Léon Bottou, Yann Le Cun and contributors). Texts: `licenses/djvulibre-COPYING`, `licenses/djvulibre-COPYRIGHT`.',
        `- Homepage: ${d.homepage}`);
      if (d.route === 'msys2') {
        toolRows.push(`- Build: ${d.routeNote}`, '- Bundled files and the packages they come from (licenses of the libraries: `licenses/djvulibre-libraries/`):', '');
        toolRows.push('| Package | Version | License | Files | Source |', '|---|---|---|---|---|');
        for (const p of d.packages) toolRows.push(`| ${p.name.replace(MSYS2.prefix, '')} | ${p.version} | ${p.license} | ${p.files.join(', ')} | ${p.source} |`);
        toolRows.push('');
        toolRows.push(`- Binary packages (SHA-256 checked against the MSYS2 repository database): ${MSYS2.repo}`);
      } else {
        toolRows.push(`- Binary: ${d.url} (SHA-256 \`${d.sha256}\`)`);
      }
      toolRows.push(`- Source: ${d.sourceUrls.join(' , ')}`, '');
    }
    if (t.pdf2djvu) {
      const p = t.pdf2djvu;
      toolRows.push(`### pdf2djvu ${p.version} (${m.platform})`, '',
        '- What: converts PDF to DjVu (used by Save As → DjVu).',
        '- License: **GPL-2.0-only** (Copyright © 2007-2022 Jakub Wilk and contributors). Text: `licenses/pdf2djvu-COPYING`.',
        `- Includes: ${p.bundledLibraries}`,
        '  Library and font licenses: `licenses/pdf2djvu-COPYING.libs.html`, `licenses/pdf2djvu-COPYING.poppler-data.html`, `licenses/pdf2djvu-COPYING.fonts.html`.',
        `- Binary: ${p.url}`,
        `- SHA-256: \`${p.sha256}\` (${p.sha256Check})`,
        `- Source: ${p.sourceUrls.join(' , ')} (the win32-source tarball holds the source of every bundled library)`,
        `- Homepage: ${p.homepage}`, '');
    }
  }
  if (!toolRows.length) toolRows.push('_No bundled programs have been fetched yet. Run `node scripts/fetch-tools.js`._', '');
  L.push(...toolRows);

  // Writing Assistant, dictionaries, thesaurus data and fonts
  fs.mkdirSync(LICENSES, { recursive: true });
  const extraRows = [];
  for (const c of EXTRA_COMPONENTS) {
    const dir = path.join(ROOT, 'node_modules', c.pkg);
    const pj = readPkg(dir);
    if (!pj) { warn(`${c.pkg} is not installed; left out of the notices`); continue; }
    let txt = null;
    for (const f of c.files) { try { txt = fs.readFileSync(path.join(dir, f), 'utf8'); break; } catch (_) { /* next */ } }
    if (!txt) txt = licenseText(dir);
    if (txt) fs.writeFileSync(path.join(LICENSES, c.dest), txt);
    else warn(`${c.pkg}: no license file found`);
    const copyright = c.copyright || firstCopyright(txt) || `see licenses/${c.dest}`;
    extraRows.push(`### ${c.title} ${pj.version}`, '',
      `- What: ${c.what}.`,
      `- License: **${c.license}**. ${copyright.replace(/\.$/, '')}. Text: \`licenses/${c.dest}\`.`,
      `- Source: ${c.url}`, '');
  }
  if (extraRows.length) {
    L.push('## Writing Assistant, dictionaries, thesaurus and fonts', '');
    L.push('Used unmodified from npm (data derived from them, such as the thesaurus index, keeps the same license).', '');
    L.push(...extraRows);
  }

  // GPL-3.0 text, for elkjs (inside Mermaid), which Markooj uses under its GPL-3.0-or-later option. npm ships elkjs with
  // the EPL text only; JSZip's license file carries the full GNU GPL v3 text.
  try {
    const jz = fs.readFileSync(path.join(ROOT, 'node_modules', 'jszip', 'LICENSE.markdown'), 'utf8');
    const at = jz.search(/^\s*GNU GENERAL PUBLIC LICENSE\s*$/m);
    if (at >= 0) fs.writeFileSync(path.join(LICENSES, 'GPL-3.0.txt'), jz.slice(at).replace(/^\s+/, ''));
    else warn('GPL-3.0 text not found in jszip/LICENSE.markdown');
  } catch (e) { warn('GPL-3.0 text: ' + e.message); }

  // the runtime
  const epj = readPkg(path.join(ROOT, 'node_modules', 'electron'));
  const eDist = path.join(ROOT, 'node_modules', 'electron', 'dist');
  if (fs.existsSync(path.join(eDist, 'LICENSE'))) fs.copyFileSync(path.join(eDist, 'LICENSE'), path.join(LICENSES, 'electron-LICENSE.txt'));
  L.push('## Electron and Chromium', '');
  L.push(`- **Electron** ${epj ? epj.version : ''} (MIT, Copyright (c) Electron contributors, Copyright (c) 2013-2020 GitHub Inc.): the application runtime, https://github.com/electron/electron. Text: \`licenses/electron-LICENSE.txt\`.`);
  L.push('- **Chromium**, **Node.js**, **V8**, **FFmpeg** and the other components inside Electron keep their own licenses (BSD-3-Clause, MIT, LGPL-2.1 for FFmpeg and others). Their full texts are in `LICENSES.chromium.html` next to `Markooj.exe` (installed by Electron with every copy). Chromium source: https://source.chromium.org/chromium.', '');

  L.push('## JavaScript libraries (npm runtime dependencies)', '');
  L.push('Direct dependencies first, then every package they pull in. All are used unmodified from npm.', '');
  L.push('| Package | Version | License | Source |', '|---|---|---|---|');
  for (const p of prod) L.push(`| ${p.direct ? `**${p.name}**` : p.name} | ${p.version} | ${p.license} | ${p.repo} |`);
  L.push('');
  const want = ['markdown-it', 'katex', 'highlight.js', 'mermaid', 'turndown', 'mammoth', 'html-to-docx', 'jszip', 'pdfjs-dist', 'dompurify', 'pyodide', 'yaml', 'harper.js', 'nspell', 'dictionary-en', 'dictionary-en-gb', 'dictionary-fa', 'wordnet-db', 'write-good'];
  const absent = want.filter((w) => !prod.some((p) => p.name === w));
  L.push('Notes:', '');
  L.push('- **Pyodide** (MPL-2.0) bundles CPython (PSF-2.0) and its standard library compiled to WebAssembly; see `node_modules/pyodide/` and https://github.com/pyodide/pyodide. License texts: `licenses/pyodide-LICENSE.txt` (MPL-2.0) and `licenses/cpython-LICENSE.txt` (PSF License Agreement and the CPython history and terms).');
  L.push('- **Citation styles** `csl/apa.csl`, `csl/ieee.csl`, `csl/chicago-author-date.csl` (used for DOCX, ODT, EPUB and LaTeX exports) come from the Citation Style Language styles project (https://github.com/citation-style-language/styles), as included with the Pandoc source, under the Creative Commons Attribution-ShareAlike 3.0 license (https://creativecommons.org/licenses/by-sa/3.0/). Each file names its authors in its <info> section. See `licenses/csl-styles.txt`.');
  L.push('- **JSZip** is dual licensed (MIT or GPL-3.0-or-later); Markooj uses it under MIT. **DOMPurify** is dual licensed (MPL-2.0 or Apache-2.0); Markooj uses it under Apache-2.0. **elkjs** (EPL-2.0 or GPL-3.0-or-later; its layout code is compiled into Mermaid\'s `mermaid.min.js`) is used under GPL-3.0-or-later, which is compatible with Markooj\'s AGPL-3.0-or-later (AGPL v3 section 13). Texts: `licenses/GPL-3.0.txt` and, for its other option, the EPL-2.0 text in `licenses/npm-licenses.txt`.');
  L.push('- **KaTeX** fonts are under the SIL Open Font License / MIT as stated in the KaTeX package.');
  L.push('- Full license texts of all npm packages above: `licenses/npm-licenses.txt`.');
  L.push('- **Language packs** (Urdu, Arabic, Punjabi, Persian and others) are not part of the app. They are downloaded on request from the releases of https://github.com/datakeen/markooj-language-packs, and each pack carries the licenses of its word lists, dictionaries and rules inside the pack. See "Language data (downloaded separately)" below.');
  if (absent.length) L.push(`- Not installed at the time this file was generated: ${absent.join(', ')}.`);
  L.push('');
  L.push('## Language data (downloaded separately)', '');
  L.push('These are not inside Markooj. They come in language packs that Markooj downloads only when you ask for them (File → Options → Language), and each pack carries its own license texts.', '');
  L.push('- **CLE Urdu word list** (in the Urdu language pack, `ur`, version 2.1.0 and later). Urdu word list from the Urdu Spell Checker v1.0 by the Center for Language Engineering (CLE), KICS, UET Lahore (originally CRULP), used under the GNU GPL v3. License: **GPL-3.0**; text: `licenses/GPL-3.0.txt` inside the pack. Source: https://www.cle.org.pk/software/langproc/spellcheck.htm');
  L.push('- **Markooj word lists and rules** for Urdu, Arabic and Punjabi (Shahmukhi), written for Markooj. License: **CC BY-SA 4.0**. Source: https://github.com/datakeen/markooj-language-packs');

  fs.writeFileSync(path.join(ROOT, 'THIRD_PARTY_NOTICES.md'), `${L.join('\n')}\n`);
  info(`listed ${manifests.length} platform manifest(s) and ${prod.length} npm packages`);

  // Concatenated npm license texts.
  const T = ['Licenses of the npm packages shipped with Markooj', '='.repeat(52), ''];
  for (const p of prod) {
    const txt = licenseText(p.dir);
    T.push('-'.repeat(78), `${p.name}@${p.version}  (${p.license})  ${p.repo}`, '-'.repeat(78));
    T.push(txt ? txt.trim() : `No license file in the package; license field: ${p.license}.`, '');
  }
  fs.mkdirSync(LICENSES, { recursive: true });
  fs.writeFileSync(path.join(LICENSES, 'npm-licenses.txt'), `${T.join('\n')}\n`);
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------
async function main() {
  if (ARGS.notices) { writeNotices(); return; }
  if (typeof fetch !== 'function') throw new Error('Node 18 or newer is required (global fetch).');
  if (!['win32', 'darwin', 'linux'].includes(PLATFORM)) throw new Error(`unknown --platform=${PLATFORM} (use win32, darwin or linux)`);
  if (!['x64', 'arm64'].includes(ARCH)) throw new Error(`unknown --arch=${ARCH} (use x64 or arm64)`);
  if (PLATFORM === 'win32' && ARCH !== 'x64') throw new Error('Windows builds are x64 only (the bundled DjVu tools are x64)');
  log(`Markooj tools → vendor/${VENDOR_NAME}${WITH_SOURCE ? ' + sources → vendor-src/' : ''}`);
  if (PLATFORM !== process.platform) log(`(cross-fetching for ${PLATFORM} from ${process.platform})`);
  const manifest = readManifest();
  manifest.tools = manifest.tools || {};
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'markooj-tools-'));
  const failures = [];
  try {
    const jobs = { pandoc: fetchPandoc, pdf2djvu: fetchPdf2djvu, djvulibre: fetchDjvulibre };
    for (const name of ONLY) {
      if (!jobs[name]) { warn(`unknown tool "${name}"`); continue; }
      try { await jobs[name](manifest, tmp); writeManifest(manifest); } catch (e) {
        failures.push(name);
        log(`\n   ERROR (${name}): ${e.message}`);
      }
    }
    if (WITH_SOURCE) {
      try { await fetchSources(manifest); writeManifest(manifest); } catch (e) { failures.push('source'); log(`\n   ERROR (source): ${e.message}`); }
    }
  } finally {
    rmrf(tmp);
  }
  writeNotices();
  step('Summary');
  for (const [k, v] of Object.entries(manifest.tools)) info(`${k.padEnd(10)} ${v.version}${v.route ? ` (${v.route})` : ''}`);
  info(`vendor/${VENDOR_NAME} size: ${mb(dirSize(VENDOR))}`);
  if (WITH_SOURCE) info(`vendor-src size: ${mb(dirSize(VENDOR_SRC))}`);
  if (failures.length) { log(`\nFinished with problems: ${failures.join(', ')}`); process.exitCode = 1; } else log('\nDone.');
}

main().catch((e) => { console.error(`\nERROR: ${e.stack || e.message}`); process.exit(1); });
