// electron-builder hook (afterPack): trim parts of Chromium that Markooj never uses, before any installer is made.
//
// dxcompiler.dll and dxil.dll (about 25 MB) are Microsoft's DirectX shader compiler. Chromium needs them only for
// WebGPU, and Markooj never asks for WebGPU (pdf.js keeps its `enableWebGPU` option off; nothing else uses
// navigator.gpu). WebGL and the normal drawing path use d3dcompiler_47.dll, which stays. The packaged smoke subset
// (PDF, DjVu, equations, Mermaid, exports) runs without them. Set MARKOOJ_KEEP_DXC=1 to keep them.
// The Chromium locales are trimmed by package.json build.electronLanguages (the 11 interface languages and Persian).
'use strict';
const fs = require('fs');
const path = require('path');

const mb = n => `${(n / 1048576).toFixed(1)} MB`;

module.exports = async function afterPack(ctx) {
  const dir = ctx && ctx.appOutDir;
  if (!dir || ctx.electronPlatformName !== 'win32') return;
  if (process.env.MARKOOJ_KEEP_DXC === '1') { console.log('  • after-pack: MARKOOJ_KEEP_DXC=1, keeping dxcompiler.dll and dxil.dll'); return; }
  let saved = 0;
  for (const name of ['dxcompiler.dll', 'dxil.dll']) {
    const f = path.join(dir, name);
    try { const { size } = fs.statSync(f); fs.unlinkSync(f); saved += size; console.log(`  • after-pack: removed ${name} (${mb(size)}, WebGPU only)`); } catch {}
  }
  const locales = path.join(dir, 'locales');
  try { console.log(`  • after-pack: Chromium locales kept: ${fs.readdirSync(locales).map(f => f.replace(/\.pak$/, '')).join(', ')}`); } catch {}
  if (saved) console.log(`  • after-pack: saved ${mb(saved)}`);
};
module.exports.default = module.exports;
