// electron-builder hook (artifactBuildCompleted): put portable.txt into the Windows portable zip.
//
// A copy unzipped anywhere then keeps its settings, recovered text, macros and add-ins in a `data` folder next to
// Markooj.exe (main.js → portable mode). The NSIS installer is built from the same folder and never gets the file.
// Uses electron-builder's own 7-Zip (adds one entry without recompressing the rest); falls back to JSZip.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const NOTE = [
  'Markooj portable copy',
  '',
  'Because this file sits next to Markooj.exe, Markooj keeps its settings, recovered text, macros and add-ins',
  'in the "data" folder next to it (created on first run), not in your user profile. Move or copy the whole',
  'folder to take Markooj and its settings with you, for example on a USB drive.',
  '',
  'To use the normal per-user settings instead, delete this file and the "data" folder.',
  '',
].join('\r\n');

async function with7za(zip, dir) {
  // electron-builder 26 keeps its 7-Zip download in its cache; ELECTRON_BUILDER_7ZIP_PATH overrides it
  const { getPath7za } = require('app-builder-lib/out/toolsets/7zip');
  const exe = await getPath7za();
  execFileSync(exe, ['a', '-tzip', '-bd', '-y', zip, 'portable.txt'], { cwd: dir, stdio: 'pipe' });
}

async function withJsZip(zip) {
  const JSZip = require('jszip');
  const z = await JSZip.loadAsync(fs.readFileSync(zip));
  z.file('portable.txt', NOTE, { date: new Date() });
  // DEFLATE entries are copied as they are (JSZip reuses compressed data when the method matches)
  const buf = await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 }, streamFiles: true });
  fs.writeFileSync(zip, buf);
}

async function hasEntry(zip, name) {
  const JSZip = require('jszip');
  const z = await JSZip.loadAsync(fs.readFileSync(zip));
  return !!z.file(name);
}

module.exports = async function portableZip(ctx) {
  const file = ctx && ctx.file;
  if (!file || !/-portable\.zip$/i.test(file)) return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markooj-portable-'));
  try {
    fs.writeFileSync(path.join(dir, 'portable.txt'), NOTE);
    try { await with7za(file, dir); }
    catch (e) { console.log(`  • portable.txt: 7-Zip not available (${e.message.split('\n')[0]}), using JSZip`); await withJsZip(file); }
    if (!(await hasEntry(file, 'portable.txt'))) throw new Error(`portable.txt is missing from ${file}`);
    // a blockmap made before the change would no longer match the zip
    try { fs.unlinkSync(`${file}.blockmap`); } catch {}
    console.log(`  • added portable.txt to ${path.basename(file)}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
module.exports.default = module.exports;
module.exports.NOTE = NOTE;
