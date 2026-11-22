// Markooj â€” draws the app icon (the title-bar logo from design/mock.html, scaled up) and writes
// build/icon.svg, build/icon.png (512x512) and build/icon.ico (16-256 px).
// Run: npx electron build/make-icon.js
// The logo: a rounded square with a 145deg blue gradient (#4f9bff to #0a52e0), a soft top highlight,
// a light blue shadow and a bold white "M" in the system UI font.
'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const OUT = __dirname;
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];

// Drawn in the page with a canvas, so the "M" uses the same font the app shows in its title bar.
const DRAW = `
async function draw(size) {
  await document.fonts.ready;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const small = size < 48;
  const m = small ? Math.max(0, Math.round(size / 32)) : Math.round(size * 0.06);  // margin around the tile
  const t = size - 2 * m;                       // tile edge
  const r = t * 7 / 26;                         // mock: 26px tile, 7px radius
  const u = t / 26;                             // one mock pixel
  const tile = (dx, dy) => { const p = new Path2D(); p.roundRect(m + dx, m + dy, t, t, r); return p; };
  // shadow: 0 1px 2px rgba(10,82,224,.4) (kept a little tighter so it is not cut off at the edge)
  if (!small) { x.save(); x.shadowColor = 'rgba(10,82,224,.35)'; x.shadowBlur = Math.min(2 * u, m * 0.9); x.shadowOffsetY = Math.min(u, m * 0.5); x.fillStyle = '#0a52e0'; x.fill(tile(0, 0)); x.restore(); }
  // linear-gradient(145deg, #4f9bff, #0a52e0), using the CSS gradient-line rules
  const a = 145 * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a);
  const half = (Math.abs(t * dx) + Math.abs(t * dy)) / 2, cx = m + t / 2, cy = m + t / 2;
  const g = x.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  g.addColorStop(0, '#4f9bff'); g.addColorStop(1, '#0a52e0');
  x.fillStyle = g; x.fill(tile(0, 0));
  // inset 0 .5px 0 rgba(255,255,255,.4): a thin crescent along the top edge
  if (size >= 32) {
    x.save(); x.clip(tile(0, 0));
    const p = new Path2D(); p.rect(0, 0, size, size); p.addPath(tile(0, Math.max(1, 0.3 * u)));
    x.fillStyle = 'rgba(255,255,255,.32)'; x.fill(p, 'evenodd'); x.restore();
  }
  // the white M: font-weight 700, font-size 14px on a 26px tile, centered on its ink box
  const fs = 14 * u * (small ? 1.12 : 1);
  x.font = '700 ' + fs + 'px "Segoe UI", -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif';
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  const mt = x.measureText('M');
  const ink = mt.actualBoundingBoxAscent + mt.actualBoundingBoxDescent;
  const by = cy + ink / 2 - mt.actualBoundingBoxDescent;
  const bx = cx + (mt.actualBoundingBoxLeft - mt.actualBoundingBoxRight) / 2;
  x.fillText('M', bx, by);
  let rgba = '';
  if (size < 256) {
    const d = x.getImageData(0, 0, size, size).data; let b = '';
    for (let i = 0; i < d.length; i += 8192) b += String.fromCharCode.apply(null, Array.from(d.subarray(i, i + 8192)));
    rgba = btoa(b);
  }
  return { size, png: c.toDataURL('image/png').split(',')[1], rgba };
}`;

function icoDib(size, rgba) {
  // 32-bit BGRA DIB, bottom-up, followed by an empty AND mask (the alpha channel does the work)
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); header.writeInt32LE(size, 4); header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12); header.writeUInt16LE(32, 14); header.writeUInt32LE(0, 16);
  header.writeUInt32LE(size * size * 4, 20);
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const s = (y * size + x) * 4, d = ((size - 1 - y) * size + x) * 4;
    px[d] = rgba[s + 2]; px[d + 1] = rgba[s + 1]; px[d + 2] = rgba[s]; px[d + 3] = rgba[s + 3];
  }
  const maskRow = Math.ceil(size / 32) * 4;
  return Buffer.concat([header, px, Buffer.alloc(maskRow * size)]);
}

function buildIco(images) {
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  const blobs = images.map((im, i) => {
    const data = im.size >= 256 ? im.png : icoDib(im.size, im.rgba);
    const o = i * 16;
    dir.writeUInt8(im.size >= 256 ? 0 : im.size, o); dir.writeUInt8(im.size >= 256 ? 0 : im.size, o + 1);
    dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3); dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8); dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
    return data;
  });
  return Buffer.concat([head, dir, ...blobs]);
}

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <!-- Markooj logo (design/mock.html .logo, scaled from 26px to a 452px tile). build/icon.png and icon.ico are drawn by make-icon.js. -->
  <defs>
    <linearGradient id="g" x1="0.213" y1="0.0" x2="0.787" y2="1.0"><stop offset="0" stop-color="#4f9bff"/><stop offset="1" stop-color="#0a52e0"/></linearGradient>
    <filter id="s" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="15" stdDeviation="14" flood-color="#0a52e0" flood-opacity=".35"/></filter>
    <clipPath id="c"><rect x="31" y="31" width="450" height="450" rx="121"/></clipPath>
  </defs>
  <rect x="31" y="31" width="450" height="450" rx="121" fill="url(#g)" filter="url(#s)"/>
  <path clip-path="url(#c)" fill="#fff" fill-opacity=".4" fill-rule="evenodd" d="M0 0H512V512H0Z M152 39.7H360A121 121 0 0 1 481 160.7V368.7A121 121 0 0 1 360 489.7H152A121 121 0 0 1 31 368.7V160.7A121 121 0 0 1 152 39.7Z"/>
  <text x="256" y="256" dy=".35em" text-anchor="middle" fill="#fff" font-family="'Segoe UI', -apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, system-ui, sans-serif" font-weight="700" font-size="242">M</text>
</svg>
`;

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { offscreen: false } });
  await w.loadURL('data:text/html,<!doctype html><meta charset="utf-8"><body></body>');
  await w.webContents.executeJavaScript(DRAW + ';0');
  const sizes = [512, ...ICO_SIZES];
  const out = {};
  for (const s of sizes) {
    const r = await w.webContents.executeJavaScript(`draw(${s})`);
    out[s] = { size: s, png: Buffer.from(r.png, 'base64'), rgba: Buffer.from(r.rgba, 'base64') };
  }
  fs.writeFileSync(path.join(OUT, 'icon.png'), out[512].png);
  fs.writeFileSync(path.join(OUT, 'icon.ico'), buildIco(ICO_SIZES.map(s => out[s])));
  fs.writeFileSync(path.join(OUT, 'icon.svg'), SVG);
  console.log('Wrote', ['icon.png', 'icon.ico', 'icon.svg'].map(f => `${f} (${fs.statSync(path.join(OUT, f)).size} bytes)`).join(', '));
  app.exit(0);
}).catch(e => { console.error(e); app.exit(1); });
