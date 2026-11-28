// electron-builder hook (artifactBuildCompleted): make the Windows portable zip the FULL, offline copy.
//
// Since 1.2 the installer is slim: Pandoc, the DjVu tools and Python macros are optional Features that download when
// wanted (main-features.js). The portable zip keeps everything, for computers without internet:
//   portable.txt                       settings, recovered text, macros and add-ins live in the "data" folder next to
//                                      Markooj.exe (main.js → portable mode); the installer never gets this file
//   resources/vendor/…                 Pandoc, DjVuLibre and pdf2djvu (from vendor/win32, scripts/fetch-tools.js)
//   resources/pyodide/…                Python (Pyodide) for Python macros (from node_modules/pyodide)
// main.js finds the tools in resources/vendor (bundled), and main-features.js serves Pyodide from resources/pyodide.
// Their license texts are in resources/licenses already (package.json extraResources).
// Uses electron-builder's own 7-Zip (adds entries without recompressing the rest); falls back to JSZip.
// A release build (CI=true) fails when vendor/win32 is missing; a local build makes a slim portable zip and says so.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PYODIDE_FILES = ['pyodide.mjs', 'pyodide.js', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json', 'package.json'];

const NOTE = [
  'Markooj portable copy',
  '',
  'Because this file sits next to Markooj.exe, Markooj keeps its settings, recovered text, macros and add-ins',
  'in the "data" folder next to it (created on first run), not in your user profile. Move or copy the whole',
  'folder to take Markooj and its settings with you, for example on a USB drive.',
  '',
  'This copy includes every optional feature (Pandoc, the DjVu tools and Python macros), so it works without',
  'internet. File > Options > Features shows them as "Included with this copy".',
  '',
  'To use the normal per-user settings instead, delete this file and the "data" folder.',
  '',
].join('\r\n');

const mb = n => `${(n / 1048576).toFixed(1)} MB`;

/** The folder 7-Zip adds from: portable.txt, and resources/{vendor,pyodide} when they are available. */
function stage(dir) {
  fs.writeFileSync(path.join(dir, 'portable.txt'), NOTE);
  const add = ['portable.txt'];
  const vendor = path.join(ROOT, 'vendor', 'win32');
  const py = path.join(ROOT, 'node_modules', 'pyodide');
  const full = fs.existsSync(path.join(vendor, 'MANIFEST.json'));
  if (full) {
    fs.cpSync(vendor, path.join(dir, 'resources', 'vendor'), { recursive: true });
  } else {
    const msg = `vendor/win32 is missing: run node scripts/fetch-tools.js --platform=win32 first. This portable zip has no Pandoc and no DjVu tools.`;
    if (process.env.CI) throw new Error(msg);
    console.log(`  • portable zip: ${msg}`);
  }
  if (fs.existsSync(path.join(py, 'pyodide.mjs'))) {
    fs.mkdirSync(path.join(dir, 'resources', 'pyodide'), { recursive: true });
    for (const f of PYODIDE_FILES) if (fs.existsSync(path.join(py, f))) fs.copyFileSync(path.join(py, f), path.join(dir, 'resources', 'pyodide', f));
  } else if (process.env.CI) throw new Error('node_modules/pyodide is missing: run npm ci first.');
  if (fs.existsSync(path.join(dir, 'resources'))) add.push('resources');
  return { add, full };
}

async function with7za(zip, dir, entries) {
  // electron-builder 26 keeps its 7-Zip download in its cache; ELECTRON_BUILDER_7ZIP_PATH overrides it
  const { getPath7za } = require('app-builder-lib/out/toolsets/7zip');
  const exe = await getPath7za();
  execFileSync(exe, ['a', '-tzip', '-mx=7', '-bd', '-y', zip, ...entries], { cwd: dir, stdio: 'pipe', maxBuffer: 64 << 20 });
  const list = execFileSync(exe, ['l', '-ba', '-slt', zip], { stdio: 'pipe', maxBuffer: 256 << 20 }).toString('utf8');
  return new Set([...list.matchAll(/^Path = (.+)$/gm)].map(m => m[1].trim().replace(/\\/g, '/')));
}

async function withJsZip(zip, dir, entries) {
  const JSZip = require('jszip');
  const z = await JSZip.loadAsync(fs.readFileSync(zip));
  const walk = (rel) => {
    const full = path.join(dir, rel);
    if (fs.statSync(full).isDirectory()) { for (const n of fs.readdirSync(full)) walk(path.posix.join(rel, n)); }
    else z.file(rel, fs.readFileSync(full), { date: new Date() });
  };
  entries.forEach(walk);
  // DEFLATE entries are copied as they are (JSZip reuses compressed data when the method matches)
  const buf = await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 }, streamFiles: true });
  fs.writeFileSync(zip, buf);
  return new Set(Object.keys(z.files));
}

module.exports = async function portableZip(ctx) {
  const file = ctx && ctx.file;
  if (!file || !/-portable\.zip$/i.test(file)) return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markooj-portable-'));
  try {
    const { add, full } = stage(dir);
    const before = fs.statSync(file).size;
    let names;
    try { names = await with7za(file, dir, add); }
    catch (e) { console.log(`  • portable zip: 7-Zip not available (${e.message.split('\n')[0]}), using JSZip`); names = await withJsZip(file, dir, add); }
    if (!names.has('portable.txt')) throw new Error(`portable.txt is missing from ${file}`);
    if (full && !names.has('resources/vendor/pandoc/pandoc.exe')) throw new Error(`Pandoc is missing from ${file}`);
    // a blockmap made before the change would no longer match the zip
    try { fs.unlinkSync(`${file}.blockmap`); } catch {}
    console.log(`  • portable zip: added portable.txt${full ? ', resources/vendor (Pandoc, DjVu tools)' : ''}${add.includes('resources') ? ' and resources/pyodide (Python macros)' : ''}: ${mb(before)} → ${mb(fs.statSync(file).size)}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
module.exports.default = module.exports;
module.exports.NOTE = NOTE;
