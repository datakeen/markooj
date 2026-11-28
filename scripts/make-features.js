#!/usr/bin/env node
/*
 * Markooj: build the optional "Features" as zip files plus their manifest (markooj-features.json).
 *
 * Markooj 1.2 installs small. Three optional parts are downloaded only when someone wants them:
 *
 *   pandoc   Pandoc (more file formats)          from vendor/<dir>/pandoc/            (scripts/fetch-tools.js)
 *   djvu     DjVu tools (DjVuLibre + pdf2djvu)   from vendor/win32/{djvulibre,pdf2djvu} (Windows only)
 *   python   Python macros (Pyodide)              from node_modules/pyodide             (every platform: "any")
 *
 * Each zip holds the program files at the same relative paths as vendor/ (pandoc/pandoc.exe, djvulibre/ddjvu.exe,
 * pyodide/pyodide.mjs …), the license texts under licenses/, SOURCE.txt (where the source code is) and feature.json
 * ({format, id, version, platform, name, license, installedSize, files, executables}). The app (main-features.js)
 * checks the zip's SHA-256 against the manifest, unpacks it safely and keeps it in <userData>/features/<id>/<version>/.
 *
 * The zips are deterministic: sorted entries, one fixed date, fixed permissions and DEFLATE level 9. The same input
 * files always give the same bytes, so the stable `tools` release can keep one copy of each file name.
 *
 * Usage:
 *   node scripts/make-features.js --platform=win32                 pandoc + djvu for Windows x64 (needs vendor/win32)
 *   node scripts/make-features.js --platform=darwin --arch=arm64   pandoc for macOS (needs vendor/darwin-arm64)
 *   node scripts/make-features.js --platform=linux --arch=x64      pandoc for Linux (needs vendor/linux-x64)
 *   node scripts/make-features.js --python                         the Python feature (platform "any")
 *   Options: --out=dist/features (default)   --only=pandoc,djvu   --tag=v1.2.0 (release that carries the files)
 *   node scripts/make-features.js --embed     copy <out>/markooj-features.json to build/features-manifest.json
 *                                              (packaged into the app, so downloads are checked against it)
 *   node scripts/make-features.js --nsh       write build/features-sizes.nsh (sizes for the Windows installer page)
 *   node scripts/make-features.js --sizes     print a size table of <out>/markooj-features.json
 *   node scripts/make-features.js --merge-dir=dist --out=dist --tag=v1.2.0
 *                                              one markooj-features.json from the build jobs' markooj-features-*.json
 * Every run merges its entries into <out>/markooj-features.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const FIXED_DATE = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
const MANIFEST = 'markooj-features.json';

function parseArgs(argv) {
  const out = {};
  for (const a of argv) { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); if (m) out[m[1]] = m[2] === undefined ? true : m[2]; }
  return out;
}
const ARGS = parseArgs(process.argv.slice(2));
const OUT = path.resolve(ROOT, String(ARGS.out || 'dist/features'));
const mb = n => `${(n / 1048576).toFixed(1)} MB`;
const log = (...a) => console.log(...a);

function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, base, out);
    else if (e.isFile()) out.push(path.relative(base, f).split(path.sep).join('/'));
  }
  return out;
}
const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
const sha256File = f => new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(f).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });
const safeVersion = v => String(v || '0').replace(/[^0-9A-Za-z.+_-]/g, '.').slice(0, 40);

/** The license files that travel with each feature (names inside licenses/). */
const LICENSES = {
  pandoc: [/^pandoc-/],
  djvu: [/^djvulibre-/, /^pdf2djvu-/],
  python: [/^pyodide-/, /^cpython-/],
};
const NAMES = { pandoc: 'Pandoc', djvu: 'DjVu tools', python: 'Python macros' };
const LICENSE_IDS = { pandoc: 'GPL-2.0-or-later', djvu: 'GPL-2.0-or-later (DjVuLibre), GPL-2.0-only (pdf2djvu)', python: 'MPL-2.0 (Pyodide), PSF-2.0 (CPython)' };
const PYODIDE_FILES = ['pyodide.mjs', 'pyodide.js', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json', 'package.json', 'README.md'];

/** [{zipName, file (absolute), mode}] plus the version and notes for one feature. */
function collect(id, vendor) {
  const files = [];
  const add = (dir, prefix, filter = () => true) => {
    for (const rel of walk(dir)) if (filter(rel)) files.push({ zipName: `${prefix}${rel}`, file: path.join(dir, ...rel.split('/')), mode: /\.(exe|dll)$|^[^.]+$/i.test(path.posix.basename(rel)) ? 0o755 : 0o644 });
  };
  const licDir = path.join(ROOT, 'licenses');
  const lic = LICENSES[id];
  for (const e of fs.existsSync(licDir) ? fs.readdirSync(licDir, { withFileTypes: true }) : []) {
    if (!lic.some(r => r.test(e.name))) continue;
    if (e.isDirectory()) add(path.join(licDir, e.name), `licenses/${e.name}/`);
    else files.push({ zipName: `licenses/${e.name}`, file: path.join(licDir, e.name), mode: 0o644 });
  }
  const vm = vendor ? readJson(path.join(vendor, 'MANIFEST.json'), { tools: {} }) : { tools: {} };
  let version = null, sources = [], executables = [], extra = {};
  if (id === 'pandoc') {
    const t = vm.tools.pandoc;
    if (!t || !fs.existsSync(path.join(vendor, 'pandoc'))) throw new Error(`Pandoc is not in ${vendor}. Run node scripts/fetch-tools.js for this platform first.`);
    version = t.version;
    add(path.join(vendor, 'pandoc'), 'pandoc/');
    sources = (t.sourceUrls || []).slice(0, 3);
    executables = ['pandoc/pandoc'];
  } else if (id === 'djvu') {
    const d = vm.tools.djvulibre, p = vm.tools.pdf2djvu;
    if (!d || !p) throw new Error(`DjVuLibre and pdf2djvu are not in ${vendor}. Run node scripts/fetch-tools.js --platform=win32 first.`);
    // one token for folder and file names: DjVuLibre's package version, then pdf2djvu's (3.5.30-2_0.9.19)
    version = `${safeVersion(d.version)}_${safeVersion(p.version)}`;
    add(path.join(vendor, 'djvulibre'), 'djvulibre/');
    add(path.join(vendor, 'pdf2djvu'), 'pdf2djvu/');
    // the version facts the app shows in Check Tools (main.js reads MANIFEST.json next to the tools)
    extra['MANIFEST.json'] = Buffer.from(JSON.stringify({ tools: { djvulibre: d, pdf2djvu: p } }, null, 2));
    sources = [...(d.sourceDownloads || []).map(s => s.url), ...(p.sourceUrls || (p.sourceDownloads || []).map(s => s.url) || [])].filter(Boolean).slice(0, 6);
    if (!sources.length) sources = ['https://sourceforge.net/projects/djvu/files/DjVuLibre/', 'https://github.com/jwilk-archive/pdf2djvu/releases'];
  } else if (id === 'python') {
    const dir = path.join(ROOT, 'node_modules', 'pyodide');
    const pj = readJson(path.join(dir, 'package.json'), null);
    if (!pj) throw new Error('node_modules/pyodide is missing. Run npm ci first.');
    version = pj.version;
    for (const f of PYODIDE_FILES) if (fs.existsSync(path.join(dir, f))) files.push({ zipName: `pyodide/${f}`, file: path.join(dir, f), mode: 0o644 });
    sources = ['https://github.com/pyodide/pyodide', 'https://www.python.org/downloads/source/'];
  }
  return { files, version: safeVersion(version), sources, executables, extra };
}

function sourceText(id, version, sources) {
  return [
    `Markooj feature: ${NAMES[id]} ${version}`,
    '',
    `License: ${LICENSE_IDS[id]}. The license texts are in the licenses folder next to this file.`,
    '',
    'These are the unmodified official programs and files. Markooj runs them as separate programs; it does not link',
    'them into its own code.',
    '',
    'Source code:',
    ...sources.map(s => `  ${s}`),
    '',
    'The corresponding source code of every program in this feature is also published with each Markooj release as',
    'Markooj-<version>-third-party-sources.zip at https://github.com/datakeen/markooj/releases',
    '',
  ].join('\r\n');
}

async function buildZip(id, platform, vendor, tag) {
  const JSZip = require('jszip');
  const { files, version, sources, executables, extra } = collect(id, vendor);
  const zip = new JSZip();
  let installed = 0;
  const all = files.slice().sort((a, b) => (a.zipName < b.zipName ? -1 : a.zipName > b.zipName ? 1 : 0));
  for (const f of all) {
    let data = fs.readFileSync(f.file);
    // license texts come from the git checkout, whose line endings differ between Windows and Linux runners; the same
    // bytes everywhere keep the Python zip identical across the build jobs (mergeDir checks that)
    if (/^licenses\//.test(f.zipName) && !data.includes(0)) data = Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n'));
    installed += data.length;
    zip.file(f.zipName, data, { date: FIXED_DATE, unixPermissions: f.mode, createFolders: false });
  }
  for (const [name, data] of Object.entries(extra)) { installed += data.length; zip.file(name, data, { date: FIXED_DATE, unixPermissions: 0o644, createFolders: false }); }
  const src = Buffer.from(sourceText(id, version, sources));
  installed += src.length;
  zip.file('SOURCE.txt', src, { date: FIXED_DATE, unixPermissions: 0o644, createFolders: false });
  const meta = {
    format: 1, id, name: NAMES[id], version, platform, license: LICENSE_IDS[id],
    installedSize: installed, files: all.length + Object.keys(extra).length + 2, executables,
    // nothing about the Markooj version in here: the stable `tools` release keeps one file per name for every Markooj
    // version (uploaded with --clobber), so the same name must always hold the same bytes and SHA-256
  };
  const metaBuf = Buffer.from(JSON.stringify(meta, null, 2));
  meta.installedSize += metaBuf.length;
  zip.file('feature.json', JSON.stringify(meta, null, 2), { date: FIXED_DATE, unixPermissions: 0o644, createFolders: false });
  const name = `markooj-feature-${id}-${version}-${platform}.zip`;
  fs.mkdirSync(OUT, { recursive: true });
  const dest = path.join(OUT, name);
  log(`  packing ${name} (${all.length} files, ${mb(installed)}) …`);
  await new Promise((res, rej) => {
    zip.generateNodeStream({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 }, platform: 'UNIX', streamFiles: false })
      .pipe(fs.createWriteStream(dest)).on('finish', res).on('error', rej);
  });
  const size = fs.statSync(dest).size;
  const sha256 = await sha256File(dest);
  log(`  → ${name}: ${mb(size)} download, ${mb(meta.installedSize)} installed, sha256 ${sha256}`);
  return { id, version, platform, entry: { file: name, size, sha256, installedSize: meta.installedSize } };
}

function mergeManifest(results, tag) {
  const file = path.join(OUT, MANIFEST);
  const m = readJson(file, null) || { format: 1, features: {} };
  m.format = 1;
  m.updated = new Date().toISOString();
  m.markooj = PKG.version;
  if (tag) m.tag = String(tag);
  else if (!m.tag) m.tag = `v${PKG.version}`;
  m.features = m.features || {};
  for (const r of results) {
    const f = m.features[r.id] || (m.features[r.id] = { name: NAMES[r.id], license: LICENSE_IDS[r.id], files: {} });
    f.name = NAMES[r.id]; f.license = LICENSE_IDS[r.id]; f.version = r.version;
    f.files = f.files || {};
    // a newer version replaces the platform entries of the old one
    for (const [k, v] of Object.entries(f.files)) if (v.version && v.version !== r.version) delete f.files[k];
    f.files[r.platform] = { ...r.entry, version: r.version };
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
  log(`  manifest: ${path.relative(ROOT, file)}`);
  return m;
}

function sizesTable(m) {
  const rows = [['Feature', 'Platform', 'Version', 'Download', 'Installed']];
  for (const [id, f] of Object.entries(m.features || {})) for (const [p, e] of Object.entries(f.files || {})) rows.push([id, p, f.version, mb(e.size), mb(e.installedSize)]);
  const w = rows[0].map((_, i) => Math.max(...rows.map(r => String(r[i]).length)));
  return rows.map(r => r.map((c, i) => String(c).padEnd(w[i])).join('  ')).join('\n');
}

/** NSIS defines for the installer's "Choose extra features" page (build/installer.nsh includes this file). */
function writeNsh(m) {
  const win = id => (m.features?.[id]?.files || {})[id === 'python' ? 'any' : 'win32-x64'];
  const roundMb = n => Math.max(1, Math.round(n / 1048576));
  const L = ['; Generated by node scripts/make-features.js --nsh from markooj-features.json. Do not edit.'];
  for (const [id, key] of [['pandoc', 'PANDOC'], ['djvu', 'DJVU'], ['python', 'PYTHON']]) {
    const e = win(id);
    if (!e) continue;
    L.push(`!define MK_SIZE_${key} "${roundMb(e.size)} MB download, ${roundMb(e.installedSize)} MB on disk"`);
  }
  const dest = path.join(ROOT, 'build', 'features-sizes.nsh');
  fs.writeFileSync(dest, '﻿' + L.join('\r\n') + '\r\n');
  log(`  wrote ${path.relative(ROOT, dest)}`);
}

/** The release job: one markooj-features.json from the per-platform lists (markooj-features-<platform>.json) the build
 *  jobs made. The same file name must have the same SHA-256 everywhere (the Python zip is built by every job). */
function mergeDir(dir, tag) {
  const parts = fs.readdirSync(dir).filter(f => /^markooj-features-.+\.json$/.test(f)).sort();
  if (!parts.length) throw new Error(`No markooj-features-*.json in ${dir}.`);
  const m = { format: 1, updated: new Date().toISOString(), markooj: PKG.version, tag: tag ? String(tag) : `v${PKG.version}`, features: {} };
  for (const p of parts) {
    const part = readJson(path.join(dir, p), null);
    if (!part || part.format !== 1) throw new Error(`${p} is not a feature list (format 1).`);
    for (const [id, f] of Object.entries(part.features || {})) {
      const t = m.features[id] || (m.features[id] = { name: f.name || NAMES[id], license: f.license || LICENSE_IDS[id], version: f.version, files: {} });
      for (const [key, e] of Object.entries(f.files || {})) {
        const have = t.files[key];
        if (have && have.sha256 !== e.sha256) throw new Error(`${id} ${key}: ${p} has sha256 ${e.sha256}, another list has ${have.sha256} (the zips must be identical).`);
        t.files[key] = e;
      }
      if (f.version && t.version !== f.version) t.version = f.version;
    }
    log(`  merged ${p}`);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, MANIFEST), JSON.stringify(m, null, 2) + '\n');
  log('\n' + sizesTable(m));
}

async function main() {
  const manifestFile = path.join(OUT, MANIFEST);
  if (ARGS.sizes) { log(sizesTable(readJson(manifestFile, { features: {} }))); return; }
  if (ARGS['merge-dir']) { mergeDir(path.resolve(ROOT, String(ARGS['merge-dir'])), ARGS.tag); return; }
  if (ARGS.embed || ARGS.nsh) {
    const m = readJson(ARGS.manifest ? path.resolve(ROOT, String(ARGS.manifest)) : manifestFile, null);
    if (!m) throw new Error(`No ${MANIFEST} in ${OUT}. Build the features first.`);
    if (ARGS.embed) {
      const dest = path.join(ROOT, 'build', 'features-manifest.json');
      fs.writeFileSync(dest, JSON.stringify(m, null, 2) + '\n');
      log(`  wrote ${path.relative(ROOT, dest)} (packaged into the app)`);
    }
    if (ARGS.nsh) writeNsh(m);
    return;
  }
  const results = [];
  if (ARGS.python) {
    log('Python macros (Pyodide), platform any');
    results.push(await buildZip('python', 'any', null, ARGS.tag));
  } else {
    const platform = String(ARGS.platform || process.platform);
    const arch = String(ARGS.arch || 'x64');
    const key = `${platform}-${arch}`;
    const vendor = path.join(ROOT, 'vendor', platform === 'win32' ? 'win32' : key);
    const only = ARGS.only ? String(ARGS.only).split(',').map(s => s.trim()) : (platform === 'win32' ? ['pandoc', 'djvu'] : ['pandoc']);
    log(`Features for ${key} from ${path.relative(ROOT, vendor)}`);
    for (const id of only) {
      if (id === 'djvu' && platform !== 'win32') { log('  (DjVu tools: Windows only; macOS and Linux use Homebrew or the package manager)'); continue; }
      if (id === 'python') { results.push(await buildZip('python', 'any', null, ARGS.tag)); continue; }
      results.push(await buildZip(id, key, vendor, ARGS.tag));
    }
  }
  const m = mergeManifest(results, ARGS.tag);
  log('\n' + sizesTable(m));
}

if (require.main === module) main().catch(e => { console.error(`\nERROR: ${e.stack || e.message}`); process.exit(1); });
module.exports = { collect, sizesTable, NAMES };
