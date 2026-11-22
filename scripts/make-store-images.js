// Markooj — store and README images, made from the real app.
//
//   npm run images                    (= electron scripts/make-store-images.js)
//   npm run images -- --only hero     only the scenes whose name matches (a regex); composed images that need other scenes are skipped
//   npm run images -- --show          show the window while it works (it is invisible by default)
//   npm run images -- --keep          keep the temporary folder (raw screenshots, profile) and print where it is
//
// How it works: this file starts the real main process (main.js) with a throwaway profile and copies of the documents in
// samples/, so nothing in the app changes and your own settings are never touched. It drives the window through
// webContents.executeJavaScript and the public window.app API, and captures it through the DevTools protocol at
// 1600 × 1000 CSS pixels × 2. A second hidden window then lays out each marketing image (gradient, headline, framed
// screenshot) and captures it at its exact size.
//
// Output:
//   marketing/sourceforge/NN-name.png   1280 × 800, SourceForge screenshots with a headline
//   marketing/github-social-preview.png 1280 × 640
//   marketing/banner-1500x500.png       1500 × 500
//   marketing/icon-512.png              512 × 512 (from build/icon.png)
//   docs/images/*.png                   plain screenshots (no frame), 1600 × 1000
//   marketing/captions.md               file names with one-line captions (full runs only)
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app, BrowserWindow, nativeImage } = require('electron');

const ROOT = path.resolve(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const argv = process.argv.slice(2);
const flag = n => argv.includes(n);
const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const ONLY = opt('--only') ? new RegExp(opt('--only'), 'i') : null;
const SHOW = flag('--show');
const KEEP = flag('--keep');
const VIEW = { width: 1600, height: 1000, scale: 2 };

const OUT_MKT = path.join(ROOT, 'marketing');
const OUT_SF = path.join(OUT_MKT, 'sourceforge');
const OUT_DOCS = path.join(ROOT, 'docs', 'images');
// the folder of an earlier run can stay behind (Chromium still holds its files while the app exits): tidy those up first
try {
  for (const f of fs.readdirSync(os.tmpdir())) {
    const p = path.join(os.tmpdir(), f);
    if (/^markooj-images-/.test(f) && Date.now() - fs.statSync(p).mtimeMs > 10 * 60000) fs.rmSync(p, { recursive: true, force: true });
  }
} catch {}
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'markooj-images-'));
const PROFILE = path.join(WORK, 'profile');
const RAW = path.join(WORK, 'raw');
const PREP = path.join(WORK, 'prep');
const SAMPLES = path.join(WORK, 'Samples');
for (const d of [OUT_SF, OUT_DOCS, PROFILE, RAW, PREP]) fs.mkdirSync(d, { recursive: true });
fs.cpSync(path.join(ROOT, 'samples'), SAMPLES, { recursive: true });

const log = (...a) => console.log('[images]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- a clean, predictable profile ----------
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };
const writingLog = {}, writingMet = {};
[[1, 620], [2, 540], [3, 710], [4, 505], [5, 580], [6, 230]].forEach(([n, w]) => { writingLog[daysAgo(n)] = w; if (w >= 500) writingMet[daysAgo(n)] = 1; });
writingLog[dayKey(new Date())] = 340;
fs.writeFileSync(path.join(PROFILE, 'settings.json'), JSON.stringify({
  theme: 'light', defaultMode: 'word', zoom: 100, outline: true, tabPosition: 'top', layout: 'print', ribbonDisplay: 'pinned',
  proofingLanguage: 'en-US', writingAssistant: true, writingAutocomplete: false, recent: [], remoteImages: false,
  // words of the field that the bundled English dictionary does not know (a researcher would have added them)
  writingDictionary: ['barrage', 'bedload', 'Ctrl', 'deaired', 'hydrograph', 'hydrographs', 'sieved'],
  dailyWordGoal: 500, writingLog, writingMet, goalsCelebrate: false, 'welcome.seenVersion': require('../package.json').version,
  mathMacros: [
    '% Sets and vectors', '\\newcommand{\\R}{\\mathbb{R}}', '\\newcommand{\\N}{\\mathbb{N}}', '\\newcommand{\\vect}[1]{\\mathbf{#1}}',
    '% Calculus', '\\newcommand{\\dd}{\\mathrm{d}}', '\\newcommand{\\pdv}[2]{\\frac{\\partial #1}{\\partial #2}}',
    '% Hydraulics', '\\newcommand{\\Fr}{\\mathrm{Fr}}', '\\newcommand{\\Rey}{\\mathrm{Re}}', '\\DeclareMathOperator{\\sgn}{sgn}',
  ].join('\n'),
  window: { width: VIEW.width, height: VIEW.height },
}, null, 2));

// ---------- start the real app ----------
app.setName(PKG.productName || 'Markooj');
app.getVersion = () => PKG.version; // run as a script, Electron would report its own version
process.env.MARKOOJ_USER_DATA = PROFILE;
let mainWin = null;
app.on('browser-window-created', (_e, w) => {
  if (!mainWin) { mainWin = w; quietWindow(w); }
});
function quietWindow(w) {
  // painted but invisible and click-through, like the smoke test, so the person's screen is left alone
  w.show = () => { if (SHOW) w.showInactive(); else { w.setOpacity(0); w.showInactive(); } };
  if (!SHOW) { w.setIgnoreMouseEvents(true); w.setSkipTaskbar(true); }
}
require(path.join(ROOT, 'main.js'));

// ---------- capture through the DevTools protocol ----------
async function attach(wc, { width, height, scale }) {
  if (!wc.debugger.isAttached()) wc.debugger.attach('1.3');
  await wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false, screenWidth: width, screenHeight: height });
  await wc.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
  wc.setBackgroundThrottling(false);
}
async function grab(wc) {
  const r = await wc.debugger.sendCommand('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  return nativeImage.createFromBuffer(Buffer.from(r.data, 'base64'));
}
async function js(wc, fn, arg) {
  return wc.executeJavaScript(`(${fn.toString()})(${JSON.stringify(arg === undefined ? null : arg)})`, true);
}

// ---------- helpers that live in the page ----------
function pageHelpers() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch {} await sleep(60); } return null; };
  const esc = el => el && el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  const pageSel = { word: '#editorHost .mk-page', inline: '#editorHost .mk-il-page', read: '#editorHost .mk-read-page', simple: '#editorHost .mk-preview-page' };
  const H = window.__img = {
    sleep, until, esc, handles: {},
    async open(p) {
      const have = app.docs.list().find(d => d.path && d.path.toLowerCase() === p.toLowerCase());
      const d = have || await app.docs.open(p);
      app.docs.activate(d.id);
      await sleep(300);
      return d;
    },
    page() { return document.querySelector(pageSel[app.mode] || pageSel.word); },
    async settle(ms = 500) {
      try { await document.fonts.ready; } catch {}
      // the Writing Assistant finishes its first check, so the status bar never shows "Checking…" in a picture
      for (let i = 0; i < 150 && /Checking/.test(document.getElementById('statusbar')?.innerText || ''); i++) await sleep(100);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await sleep(ms);
    },
    async mode(m) {
      if (app.mode !== m) app.setMode(m);
      await until(() => { const p = H.page(); return p && p.childElementCount > 2; }, 8000);
      await sleep(700);
    },
    scroller(el) { for (let n = el; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 4) return n; } return null; },
    // scroll the page so the first element matching `sel` whose text matches `re` sits `offset` px below the top of its scroller
    async scrollTo(sel, re, offset = 24) {
      const root = H.page() || document;
      const el = [...root.querySelectorAll(sel)].find(e => re.test(e.textContent));
      if (!el) return false;
      const sc = H.scroller(el);
      if (!sc) { el.scrollIntoView({ block: 'start' }); return true; }
      sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - offset;
      await sleep(350);
      return true;
    },
    rect(el, pad = 0) {
      if (typeof el === 'string') el = document.querySelector(el);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left - pad, y: r.top - pad, w: r.width + 2 * pad, h: r.height + 2 * pad };
    },
    union(...rs) {
      rs = rs.filter(Boolean); if (!rs.length) return null;
      const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y));
      return { x, y, w: Math.max(...rs.map(r => r.x + r.w)) - x, h: Math.max(...rs.map(r => r.y + r.h)) - y };
    },
    toasts() { document.querySelectorAll('#toastLayer > *').forEach(t => t.remove()); },
    // close everything a scene may have left open and go back to a plain Word view
    async reset() {
      try { app.keytips?.stop?.(); } catch {}
      try { if (app.tours?.active?.()) { await Promise.race([app.tours.stop(), sleep(3000)]); await sleep(300); } } catch {}
      try { app.help?.close?.(); } catch {}
      try { app.setZoom(100); } catch {}
      if (app.settings.get('simplePreview', true) === false) app.settings.set('simplePreview', true);
      try { app.writing?.hideCard?.(); } catch {}
      try { app.writing?.pane?.close?.(); } catch {}
      document.querySelector('.mkw-syn')?.remove();
      try { app.equationEditor?.current?.cancel?.(); } catch {}
      for (const k of Object.keys(H.handles)) { try { await H.handles[k]?.close?.(true); } catch {} delete H.handles[k]; }
      for (let i = 0; i < 6; i++) {
        const top = [...document.querySelectorAll('.dlg.show, .mkd-sheet, .mkeq')].pop();
        if (!top) break;
        const later = [...top.querySelectorAll('button')].find(b => /^(Not now|Later|No thanks|Skip|Close|Cancel)$/i.test(b.textContent.trim()));
        if (later) later.click(); else esc(top);
        await sleep(300);
      }
      try { app.backstage.close(); } catch {}
      document.querySelectorAll('.pop.show, .popover.show').forEach(p => esc(p));
      esc(document.body);
      H.toasts();
      if (app.settings.get('theme') !== 'light') { app.settings.set('theme', 'light'); app.shell?.applyTheme?.(); }
      if (!app.settings.get('outline', true)) app.settings.set('outline', true);
      try { app.goals?.stopSprint?.({ quiet: true }); } catch {}
      if (app.mode !== 'word') app.setMode('word');
      try { app.shell?.selectTab?.('home'); } catch {}
      await sleep(350);
    },
    // move the view (or, in Inline mode, the caret) to the first source line matching `re`
    lineOf(re) { const t = app.docs.active()?.text || ''; return t.split('\n').findIndex(l => re.test(l)); },
    async toLine(re, opts) { const n = H.lineOf(re); if (n < 0) return false; try { await app.editors.active()?.scrollToLine?.(n, opts || {}); } catch {} await sleep(400); return true; },
    top() { const p = H.page(); const sc = p && H.scroller(p); if (sc) sc.scrollTop = 0; },
    // a check before every capture: no folder names from this computer on screen
    leaks(words) { const t = document.body.innerText; return words.filter(w => w && t.includes(w)); },
  };
  return true;
}

// ---------- scenes (each runs in the page; returns {crop?, skip?, note?}) ----------
// crop is in CSS pixels of the 1600 × 1000 view; the composer keeps it inside the view and near the frame's shape
const S = {};
S.hero = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper); await H.mode('word');
  app.shell.selectTab('home');
  await H.scrollTo('h1, h2, .mk-title, header', /Bedload Transport Under/, 28);
  await H.settle(900);
  return {};
};
S.wordMode = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper); await H.mode('word');
  app.shell.selectTab('insert');
  await H.scrollTo('h2', /Dimensionless parameters/, 20);
  await H.settle(700);
  // a page-only view for the GitHub social preview
  const pg = H.rect(H.page()), host = H.rect('#editorHost');
  const w = Math.min(pg.w + 60, 1000), h = w / 1.28;
  return { crops: { social: { x: pg.x + pg.w / 2 - w / 2, y: host.y, w, h } } };
};
S.modeWord = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper); app.settings.set('outline', false); await H.mode('word');
  await H.scrollTo('h2', /Dimensionless parameters/, 16);
  await H.settle(600);
  const host = H.rect('#editorHost');
  return { crop: { x: host.x + host.w / 2 - 500, y: host.y, w: 1000, h: 625 } };
};
S.modeInline = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper); app.settings.set('outline', false); await H.mode('inline');
  // put the caret in the first equation: Inline mode shows its LaTeX right there, under a live preview
  try {
    const ed = app.editors.active(), t = app.docs.active().text;
    const at = t.indexOf('\\theta = \\frac');
    if (at >= 0) { await ed.setSelection(at + 9, at + 9); await ed.whenIdle?.(); }
  } catch {}
  await H.sleep(400);
  await H.scrollTo('h2', /Dimensionless parameters/, 16);
  await H.settle(700);
  const host = H.rect('#editorHost');
  return { crop: { x: host.x + host.w / 2 - 500, y: host.y, w: 1000, h: 625 } };
};
S.modeSimple = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper); app.settings.set('outline', false); await H.mode('simple');
  await H.toLine(/^## Dimensionless parameters/);
  await H.settle(700);
  // the Markdown source half of the split (its lines wrap inside it, so nothing is cut)
  const ta = H.rect('#editorHost .mk-src-ta'), host = H.rect('#editorHost');
  const w = Math.min(ta ? ta.w : 800, 1000);
  return { crop: { x: ta ? ta.x : host.x, y: host.y, w, h: w / 1.6 } };
};
S.modeRead = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper); app.settings.set('outline', false); await H.mode('read');
  await H.sleep(800); // Read mode restores its own position first
  await H.scrollTo('h2', /Dimensionless parameters/, 16);
  await H.sleep(300);
  await H.scrollTo('h2', /Dimensionless parameters/, 16);
  await H.settle(700);
  const host = H.rect('#editorHost');
  return { crop: { x: host.x + host.w / 2 - 500, y: host.y, w: 1000, h: 625 } };
};
S.equations = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper); await H.mode('word');
  app.shell.selectTab('insert');
  await H.scrollTo('h2', /Dimensionless parameters/, 20);
  const ee = app.equationEditor;
  if (!ee?.open) return { skip: 'app.equationEditor.open is missing' };
  ee.open({ tex: 'q^* = 3.97\\,\\left(\\theta - \\theta_c\\right)^{3/2}', display: true, label: 'eq:wongparker', numbered: true });
  await H.until(() => ee.current && ee.current.mf, 8000);
  await H.settle(900);
  return { crop: H.rect('.mkeq'), exact: true };
};
S.crossRefs = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper); await H.mode('word');
  app.shell.selectTab('references');
  await H.scrollTo('h1', /^\s*Results/, 20);
  await H.settle(500);
  const dlg = app.xref?.dialogs?.crossref?.({ kind: 'eq' });
  if (!dlg) return { skip: 'app.xref.dialogs.crossref is missing' };
  await H.until(() => document.querySelector('.dlg.show .mkx-row'), 4000);
  await H.settle(700);
  return {};
};
S.writing = async ({ draft }) => {
  const H = window.__img;
  const d = await H.open(draft); await H.mode('word');
  const W = app.writing;
  if (!W?.pane) return { skip: 'app.writing is missing' };
  app.shell.selectTab('review');
  W.pane.open('assistant');
  await W.check(d);
  await H.until(() => W.state(d).status === 'ready', 20000);
  W.repaint(); H.top(); await H.sleep(400);
  const f = W.state(d).findings.find(x => x.rule === 'preposition') || W.state(d).findings[0];
  if (f) { W.showCard(f); await H.sleep(250); document.querySelector('.mkw-card .mkw-why')?.click(); }
  await H.settle(700); H.toasts();
  return {};
};
S.synonyms = async ({ draft }) => {
  const H = window.__img;
  const d = await H.open(draft); await H.mode('word');
  const W = app.writing;
  if (!W?.synonymsPopup) return { skip: 'synonyms are missing' };
  app.shell.selectTab('review');
  await W.loadThesaurus();
  await W.openThesaurus('important');
  await H.sleep(400);
  const page = H.page();
  const tw = document.createTreeWalker(page, NodeFilter.SHOW_TEXT); let n;
  while ((n = tw.nextNode())) { const i = n.data.indexOf('simple'); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 6); const s = getSelection(); s.removeAllRanges(); s.addRange(r); await W.synonymsPopup({ kind: 'dom', range: r, word: 'simple' }); break; } }
  await H.settle(600); H.toasts();
  return {};
};
S.tables = async ({ notebook }) => {
  const H = window.__img;
  await H.open(notebook); await H.mode('word');
  await H.scrollTo('h2', /Fall velocity/, 16);
  const ed = app.editors.active();
  const cell = H.page().querySelectorAll('table tbody tr')[2]?.cells[3];
  if (!cell) return { skip: 'no table' };
  const page = H.page(); page.focus?.({ preventScroll: true });
  const r = document.createRange(); const t = cell.lastChild || cell; r.selectNodeContents(t); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  document.dispatchEvent(new Event('selectionchange'));
  app.events.emit('selection:changed', { mode: 'word', states: ed.activeStates?.() || {} });
  await H.until(() => document.body.classList.contains('mk-in-table') || app.ribbon.isContextualShown?.('tableDesign'), 3000);
  await H.sleep(250);
  try { app.shell.selectTab('tableDesign'); } catch {}
  await H.settle(600);
  return { note: document.body.classList.contains('mk-in-table') ? '' : 'table tabs did not show' };
};
S.rtl = async ({ canal }) => {
  const H = window.__img;
  await H.open(canal); await H.mode('word');
  app.shell.selectTab('home');
  app.setZoom(90); await H.sleep(500);
  await H.scrollTo('h2', /Urdu notes/, 16);
  await H.settle(900);
  return {};
};
S.read = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper); await H.mode('read');
  await H.sleep(600);
  await H.scrollTo('h1', /^\s*Results/, 24);
  await H.settle(900);
  return {};
};
S.export = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper); await H.mode('word');
  app.backstage.open('saveas');
  // the list fills in once the bundled tools have answered
  await H.until(() => !/Checking available formats/i.test(document.body.innerText) && /PowerPoint/.test(document.body.innerText), 30000);
  await H.settle(1200);
  return {};
};
S.developer = async ({ notebook, macro }) => {
  const H = window.__img;
  await H.open(notebook); await H.mode('word');
  app.shell.selectTab('developer');
  const dev = app.developer;
  if (!dev?.openEditor) return { skip: 'app.developer.openEditor is missing' };
  const sheet = dev.openEditor(null, { lang: 'python', code: macro, name: 'Fall velocity summary' });
  H.handles.editor = sheet;
  await H.sleep(600);
  // run it, so the Output panel shows real results (Python loads offline the first time; this can take a while)
  const run = () => [...document.querySelectorAll('.mkd-sheet .mkd-btn.primary')].find(b => /Run/.test(b.textContent))?.click();
  const ran = () => [...document.querySelectorAll('.mkd-out-body .mkd-line')].some(l => /m\/s/.test(l.textContent));
  run();
  await H.until(ran, 90000);
  // run it again once Python is loaded, so the timing shown is the usual one
  await H.sleep(500);
  [...document.querySelectorAll('.mkd-out-h .mkd-btn')].find(b => /Clear/.test(b.textContent))?.click();
  run();
  await H.until(ran, 30000);
  await H.settle(900); H.toasts();
  return { crop: H.rect('.mkd-sheet'), exact: true };
};
S.dark = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper);
  app.settings.set('theme', 'dark'); app.shell?.applyTheme?.();
  await H.mode('word');
  app.shell.selectTab('home');
  await H.scrollTo('h2', /Dimensionless parameters/, 20);
  await H.settle(1100);
  return {};
};
S.mathMacros = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper); await H.mode('word');
  app.shell.selectTab('developer');
  if (!app.developer?.openMathDialog) return { skip: 'math macros dialog is missing' };
  const dlg = app.developer.openMathDialog({ scope: 'all', panel: 'examples' });
  H.handles.math = dlg;
  await H.settle(900);
  return { crop: H.rect('.mkd-sheet'), exact: true };
};
S.goals = async ({ thesis }) => {
  const H = window.__img;
  await H.open(thesis); await H.mode('word');
  const G = app.goals;
  if (!G?.openPanel) return { skip: 'app.goals is missing' };
  app.shell.selectTab('view');
  try { G.startSprint(25, { quiet: true }); } catch {}
  await H.sleep(300);
  // write a paragraph a sentence at a time, as someone would during the sprint (counted like typing, never saved)
  const d = app.docs.active();
  const sentences = [
    'Upstream loads were computed from the rating curve for each year and checked against the sampled concentrations.',
    'The downstream station gives a smaller load in every year except 2022, when the flood peak passed the barrage with the gates fully open.',
    'Storage change from the cross-sections agrees in sign with the difference of the two loads, but it is about a fifth smaller.',
    'Most of the gap is likely dredged material that was placed back on the banks, which the logs record only by volume.',
    'The closure error is largest in wet years, so the next step is to check the rating curve above bankfull flow.',
  ];
  const anchor = '3. Closure error and what drives it';
  let written = '';
  for (const s of sentences) {
    written += (written ? ' ' : '') + s;
    const i = d.text.indexOf(anchor);
    if (i < 0) break;
    const end = d.text.indexOf('\n\n## ', i);
    d.setText(d.text.slice(0, i + anchor.length) + '\n\n' + written + d.text.slice(end), 'input');
    await H.sleep(900);
  }
  try { G.measureNow?.(d); G.paint?.(); } catch {}
  await H.sleep(600);
  const pop = G.openPanel();
  H.handles.goals = pop;
  await H.settle(700);
  return {};
};
S.keytips = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper); await H.mode('word');
  if (!app.keytips?.start) return { skip: 'KeyTips are missing' };
  app.shell.selectTab('home');
  // a smaller page in the middle, so the close-up below cuts no line of text
  app.settings.set('outline', false); app.setZoom(70); await H.sleep(600);
  await H.scrollTo('h1, h2, .mk-title, header', /Bedload Transport Under/, 28);
  app.keytips.start();
  await H.sleep(200);
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', code: 'KeyH', bubbles: true, cancelable: true }));
  await H.settle(500);
  // close in on the ribbon so the letters can be read: up to the end of the Heading 2 style, before the search box
  const pg = H.rect(H.page());
  const styles = [...document.querySelectorAll('#ribbon .panel.on *')].filter(e => /^Heading 2$/.test(e.textContent.trim()) && e.getClientRects().length).map(e => e.closest('button, [role="option"], .gal-item, div'));
  const sr = styles.length ? H.rect(styles[0]) : null;
  const search = [...document.querySelectorAll('input, button, div')].find(e => /Search or type a command/.test(e.getAttribute?.('placeholder') || '') && e.getClientRects().length);
  const limit = search ? H.rect(search).x - 8 : 1080;
  const w = Math.max(900, Math.min(limit, sr ? sr.x + sr.w + 4 : 1078, pg ? Math.max(pg.x + pg.w + 4, 900) : 1078));
  return { crop: { x: 0, y: 0, w, h: w / 1.95 } };
};
S.tutorials = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper); await H.mode('word');
  // app.tours.start resolves when the tour ends, so it is not awaited here
  const T = app.tours;
  if (!T?.start) return { skip: 'no tutorials in this build' };
  const list = T.list?.() || [];
  const tour = list.find(t => t.id === 'equations') || list.find(t => t.id === 'getting-started') || list[0];
  if (!tour) return { skip: 'no tutorials registered' };
  T.start(tour.id);
  await H.until(() => T.active() && T.active().index >= 0, 6000);
  await H.sleep(900);
  // one step on, so the spotlight points at a real button
  try { if ((T.list?.().find(t => t.id === tour.id)?.steps?.length || 2) > 1) { T.next(); await H.sleep(1100); } } catch {}
  await H.settle(900); H.toasts();
  return {};
};
S.tutorialList = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper); await H.mode('word');
  if (!app.help?.tutorials) return { skip: 'no tutorials list in this build' };
  app.shell.selectTab('help');
  app.help.tutorials(); // resolves when the dialog closes
  await H.until(() => document.querySelector('.dlg.show'), 4000);
  await H.settle(900);
  return { crop: H.rect('.dlg.show'), exact: true };
};
S.helpPage = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper); await H.mode('word');
  if (!app.backstage || !app.help) return { skip: 'no Help page in this build' };
  app.backstage.open('help');
  await H.settle(1200);
  return {};
};
S.about = async ({ paper }) => {
  const H = window.__img;
  await H.open(paper); await H.mode('word');
  if (!app.help?.about) return { skip: 'no About in this build' };
  app.shell.selectTab('help');
  app.help.about(); // resolves when the dialog closes
  await H.until(() => document.querySelector('.dlg.show .mkh-about-dlg'), 6000);
  await H.settle(1200);
  return { crop: H.rect('.dlg.show'), exact: true };
};

// [name, scene, {zoom}]: zoom is the window's zoom factor while the scene is taken (default 1)
const SCENES = [
  ['hero', S.hero], ['wordMode', S.wordMode], ['modeWord', S.modeWord], ['modeInline', S.modeInline], ['modeSimple', S.modeSimple],
  ['modeRead', S.modeRead], ['equations', S.equations], ['crossRefs', S.crossRefs], ['writing', S.writing], ['synonyms', S.synonyms],
  ['tables', S.tables], ['rtl', S.rtl], ['read', S.read], ['export', S.export, { zoom: 0.85 }], ['dark', S.dark],
  ['mathMacros', S.mathMacros], ['keytips', S.keytips], ['tutorials', S.tutorials], ['tutorialList', S.tutorialList], ['helpPage', S.helpPage, { zoom: 0.85 }], ['about', S.about],
  ['goals', S.goals], ['developer', S.developer], // last: these two change the sample documents (never saved)
];

// ---------- the images ----------
// eyebrow: small label above the headline; tint: background palette; scenes: which raw shots; layout: 'frame' | 'grid4'
const IMAGES = [
  { file: '01-word-like-writing.png', scenes: ['hero'], eyebrow: 'Markooj', title: 'Write Markdown the way you write in Word.', sub: 'A calm editor with a ribbon, real pages and equations. Free, offline and open source.', tint: 'sky' },
  { file: '02-four-modes.png', scenes: ['modeWord', 'modeInline', 'modeSimple', 'modeRead'], labels: ['Word', 'Inline', 'Simple', 'Read'], layout: 'grid4', eyebrow: 'Four modes', title: 'One document, four ways to work on it.', tint: 'lilac' },
  { file: '03-equation-editor.png', scenes: ['equations'], eyebrow: 'Equations', title: 'Build equations visually or type LaTeX.', sub: 'Palettes, matrices and favorites, with numbering and labels built in.', tint: 'mint' },
  { file: '04-cross-references.png', scenes: ['crossRefs'], eyebrow: 'Cross-references', title: 'Numbered equations, figures and tables.', sub: 'Chapter numbering like (2.3), and references that update themselves.', tint: 'sky' },
  { file: '05-writing-assistant.png', scenes: ['writing'], eyebrow: 'Writing Assistant', title: 'Better writing, explained.', sub: 'Spelling, grammar and clarity checks that work offline, and every card says why.', tint: 'rose' },
  { file: '06-synonyms.png', scenes: ['synonyms'], eyebrow: 'Thesaurus', title: 'Find the right word.', sub: 'Double-click a word for synonyms, or open the Thesaurus with Shift+F7.', tint: 'peach' },
  { file: '07-tables.png', scenes: ['tables'], eyebrow: 'Tables', title: 'Tables that work like Word.', sub: 'Click a cell and type. Tab moves on, and Table Design and Layout appear when you need them.', tint: 'mint' },
  { file: '08-right-to-left.png', scenes: ['rtl'], eyebrow: 'Languages', title: 'Urdu, Arabic and Persian, right to left.', sub: 'Mixed-direction paragraphs with bundled Nastaliq, Naskh and Vazirmatn fonts.', tint: 'sand' },
  { file: '09-read-mode.png', scenes: ['read'], eyebrow: 'Read mode', title: 'Just the page.', sub: 'A clean view for reading and reviewing, with numbers and references in place.', tint: 'lilac' },
  { file: '10-save-as.png', scenes: ['export'], eyebrow: 'Save As', title: 'Share it in the format they need.', sub: 'PDF, Word, LaTeX, EPUB, OpenDocument, slides and more. Pandoc is bundled.', tint: 'sky' },
  { file: '11-python-macros.png', scenes: ['developer'], eyebrow: 'Developer', title: 'Python and JavaScript macros, built in.', sub: 'Automate your documents. Python runs offline inside Markooj.', tint: 'peach' },
  { file: '12-dark-mode.png', scenes: ['dark'], eyebrow: 'Dark mode', title: 'Easy on the eyes after dark.', sub: 'Every page, menu and equation follows your theme.', tint: 'night' },
  { file: '13-math-macros.png', scenes: ['mathMacros'], eyebrow: 'Math macros', title: 'Your LaTeX shortcuts, with examples.', sub: 'Paste \\newcommand lines as they are. A gallery shows what each macro does.', tint: 'rose' },
  { file: '14-writing-goals.png', scenes: ['goals'], eyebrow: 'Writing goals', title: 'Make writing a habit.', sub: 'A word target for each document, a daily goal and timed sprints to keep you going.', tint: 'mint' },
  { file: '15-tutorials.png', scenes: ['tutorials'], eyebrow: 'Tutorials', title: 'Learn it on the real buttons.', sub: 'Short guided tours with a practice document: equations, tables, macros, languages and more.', tint: 'lilac' },
  { file: '16-keytips.png', scenes: ['keytips'], eyebrow: 'Keyboard', title: 'Your Word shortcuts still work.', sub: 'Press Alt for KeyTips, just like in Word. Ctrl+B, F7 and F12 do what you expect.', tint: 'sand' },
  { file: '17-help-and-about.png', scenes: ['helpPage'], eyebrow: 'Help', title: 'Help is one key away.', sub: 'F1 opens the reference manual, offline. Tutorials, shortcuts and About Markooj are on File → Help.', tint: 'sky' },
];
const DOCS = [
  ['hero.png', 'hero', 'Word mode with the Home tab and a research paper'],
  ['word-mode.png', 'wordMode', 'Word mode: numbered equations on the page, Insert tab'],
  ['equations.png', 'equations', 'The equation editor: visual input and LaTeX side by side'],
  ['cross-references.png', 'crossRefs', 'Chapter numbering and the Cross-reference dialog'],
  ['writing-assistant.png', 'writing', 'The Writing Assistant with a "Why?" card open'],
  ['tables.png', 'tables', 'Editing a table with gridlines and the Table Design tab'],
  ['rtl.png', 'rtl', 'Urdu, Arabic and Persian paragraphs next to English'],
  ['read-mode.png', 'read', 'Read mode'],
  ['export.png', 'export', 'File → Save As with every export format'],
  ['developer.png', 'developer', 'A Python macro in the Macro Editor, with its output'],
  ['dark.png', 'dark', 'Dark mode'],
];

const TINTS = {
  sky: { bg: ['#e4edff', '#eef1ff', '#f6f0ff'], blobs: ['rgba(120,160,255,.55)', 'rgba(190,160,255,.45)'], ink: '#0b1220', sub: '#485264', accent: '#1f6feb' },
  lilac: { bg: ['#ece7ff', '#f3efff', '#e8f1ff'], blobs: ['rgba(167,139,250,.5)', 'rgba(125,180,255,.45)'], ink: '#140f2e', sub: '#4d4866', accent: '#7c3aed' },
  mint: { bg: ['#dcf6ec', '#e8f7f6', '#eef4ff'], blobs: ['rgba(80,200,160,.45)', 'rgba(120,180,255,.4)'], ink: '#0a1f1a', sub: '#43574f', accent: '#0f9d76' },
  rose: { bg: ['#ffe6ec', '#fff0f2', '#f1ecff'], blobs: ['rgba(255,140,170,.45)', 'rgba(180,150,255,.4)'], ink: '#24101a', sub: '#5f4954', accent: '#e0426e' },
  peach: { bg: ['#ffeadb', '#fff4ea', '#fdf0f5'], blobs: ['rgba(255,170,110,.5)', 'rgba(255,150,190,.38)'], ink: '#261406', sub: '#5f4d40', accent: '#e8770e' },
  sand: { bg: ['#fff3d4', '#fff8e8', '#eaf3ff'], blobs: ['rgba(255,200,90,.5)', 'rgba(120,180,255,.35)'], ink: '#221a05', sub: '#5c5440', accent: '#c98a00' },
  night: { bg: ['#0b1020', '#141a3a', '#1f1747'], blobs: ['rgba(80,110,255,.45)', 'rgba(170,90,255,.35)'], ink: '#f5f7ff', sub: '#b8c0d8', accent: '#8ab4ff', dark: true },
};

// ---------- composing ----------
const COMPOSE_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;overflow:hidden}
body{font-family:"Segoe UI Variable Display","Segoe UI Variable Text","Segoe UI",system-ui,-apple-system,"SF Pro Display","Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.stage{position:relative;overflow:hidden}
.bg,.blob{position:absolute;inset:0}
.blob{filter:blur(60px)}
.text{position:absolute;left:0;right:0;text-align:center}
.eyebrow{font-size:14px;font-weight:600;letter-spacing:.14em;text-transform:uppercase}
h1{margin:10px 0 0;font-weight:650;letter-spacing:-.022em;line-height:1.1}
.sub{margin:12px auto 0;line-height:1.35;max-width:980px}
.frame{position:absolute;border-radius:14px;overflow:hidden;background:#fff;
  box-shadow:0 0 0 1px rgba(15,23,42,.09),0 2px 4px rgba(15,23,42,.05),0 24px 48px -12px rgba(15,23,42,.28),0 48px 96px -24px rgba(15,23,42,.22)}
.dark .frame{background:#111;box-shadow:0 0 0 1px rgba(255,255,255,.12),0 24px 48px -12px rgba(0,0,0,.55),0 48px 96px -24px rgba(0,0,0,.5)}
.frame img{display:block;width:100%;height:100%}
.chip{position:absolute;padding:5px 12px;border-radius:999px;font-size:14px;font-weight:600;background:rgba(255,255,255,.9);color:#111827;
  box-shadow:0 0 0 1px rgba(15,23,42,.1),0 4px 12px rgba(15,23,42,.12);backdrop-filter:blur(6px)}
.brand{position:absolute;display:flex;align-items:center;gap:22px}
.brand img{filter:drop-shadow(0 10px 22px rgba(15,23,42,.22))}
.brand .name{font-weight:700;letter-spacing:-.03em;line-height:1}
.tag{line-height:1.3}
</style></head><body><div id="root"></div></body></html>`;

function bgCss(t) {
  return `background:linear-gradient(135deg,${t.bg[0]} 0%,${t.bg[1]} 50%,${t.bg[2]} 100%)`;
}
function blobsHtml(t, w, h) {
  return `<div class="blob" style="background:radial-gradient(${Math.round(w * 0.45)}px ${Math.round(h * 0.5)}px at 12% 8%,${t.blobs[0]},transparent 70%),radial-gradient(${Math.round(w * 0.45)}px ${Math.round(h * 0.55)}px at 92% 96%,${t.blobs[1]},transparent 70%)"></div>`;
}
const escHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fileUrl = p => 'file:///' + p.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace(/^file:\/\/\/([A-Za-z])%3A/, 'file:///$1:');

// keep a crop inside the view and between the shapes a frame can take (wider than 1.2:1, narrower than 2:1)
function fitCrop(c, minA = 1.25, maxA = 1.95) {
  let { x, y, w, h } = c || { x: 0, y: 0, w: VIEW.width, h: VIEW.height };
  const a = w / h;
  if (a < minA) { const nw = h * minA; x -= (nw - w) / 2; w = nw; }
  if (a > maxA) { const nh = w / maxA; y -= (nh - h) / 2; h = nh; }
  if (w > VIEW.width) { h *= VIEW.width / w; w = VIEW.width; }
  if (h > VIEW.height) { w *= VIEW.height / h; h = VIEW.height; }
  x = Math.max(0, Math.min(VIEW.width - w, x)); y = Math.max(0, Math.min(VIEW.height - h, y));
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}
// cut the crop out of the 2× shot and scale it to exactly the size it is shown at (best quality), so the browser never rescales it
function prepImage(raw, crop, dw, dh, name) {
  const img = nativeImage.createFromPath(path.join(RAW, raw + '.png'));
  const s = VIEW.scale;
  const part = img.crop({ x: crop.x * s, y: crop.y * s, width: Math.min(crop.w * s, img.getSize().width - crop.x * s), height: Math.min(crop.h * s, img.getSize().height - crop.y * s) });
  const out = part.resize({ width: Math.round(dw), height: Math.round(dh), quality: 'best' });
  const file = path.join(PREP, name + '.png');
  fs.writeFileSync(file, out.toPNG());
  return fileUrl(file);
}

function layoutFrame(spec, shots, W, H) {
  const t = TINTS[spec.tint] || TINTS.sky;
  const top = 40, hasSub = !!spec.sub;
  const textBottom = top + 20 + 10 + 50 + (hasSub ? 12 + 28 : 0);
  const frameTop = textBottom + 30, bottom = 40, side = 72;
  const maxW = W - 2 * side, maxH = H - frameTop - bottom;
  const crop = fitCrop(shots[0].crop, shots[0].exact ? 0.6 : 1.25, maxW / maxH);
  const a = crop.w / crop.h;
  let dw = Math.min(maxW, maxH * a), dh = dw / a;
  const x = (W - dw) / 2, y = frameTop + (maxH - dh) / 2;
  const src = prepImage(shots[0].name, crop, dw, dh, spec.file.replace(/\.png$/, ''));
  return `<div class="stage ${t.dark ? 'dark' : ''}" style="width:${W}px;height:${H}px">
    <div class="bg" style="${bgCss(t)}"></div>${blobsHtml(t, W, H)}
    <div class="text" style="top:${top}px">
      <div class="eyebrow" style="color:${t.accent}">${escHtml(spec.eyebrow || '')}</div>
      <h1 style="font-size:44px;color:${t.ink}">${escHtml(spec.title)}</h1>
      ${hasSub ? `<div class="sub" style="font-size:20px;color:${t.sub}">${escHtml(spec.sub)}</div>` : ''}
    </div>
    <div class="frame" style="left:${x}px;top:${y}px;width:${dw}px;height:${dh}px"><img src="${src}"></div>
  </div>`;
}
function layoutGrid4(spec, shots, W, H) {
  const t = TINTS[spec.tint] || TINTS.sky;
  const top = 34;
  const frameTop = top + 20 + 10 + 50 + 26, bottom = 34, gap = 22;
  const maxH = H - frameTop - bottom;
  const ch = (maxH - gap) / 2, cw = ch * 1.6;
  const gw = 2 * cw + gap, x0 = (W - gw) / 2;
  let cells = '';
  shots.forEach((s, i) => {
    const crop = fitCrop(s.crop, 1.6, 1.6);
    const x = x0 + (i % 2) * (cw + gap), y = frameTop + Math.floor(i / 2) * (ch + gap);
    const src = prepImage(s.name, crop, cw, ch, spec.file.replace(/\.png$/, '') + '-' + i);
    cells += `<div class="frame" style="left:${x}px;top:${y}px;width:${cw}px;height:${ch}px"><img src="${src}"></div>
      <div class="chip" style="left:${x + 14}px;top:${y + 14}px">${escHtml(spec.labels[i])}</div>`;
  });
  return `<div class="stage" style="width:${W}px;height:${H}px">
    <div class="bg" style="${bgCss(t)}"></div>${blobsHtml(t, W, H)}
    <div class="text" style="top:${top}px">
      <div class="eyebrow" style="color:${t.accent}">${escHtml(spec.eyebrow || '')}</div>
      <h1 style="font-size:44px;color:${t.ink}">${escHtml(spec.title)}</h1>
    </div>${cells}
  </div>`;
}
// GitHub social preview and the banner: logo, name and tagline on the left, the app on the right
function layoutBrand(kind, shot, W, H) {
  const t = TINTS.sky;
  const icon = fileUrl(path.join(ROOT, 'build', 'icon.png'));
  const pad = kind === 'banner' ? 56 : 64;
  const frameH = H - 2 * pad;
  const crop = fitCrop(shot.crop, kind === 'banner' ? 1.6 : 1.28, kind === 'banner' ? 1.6 : 1.28);
  const a = crop.w / crop.h, fw = frameH * a, fx = W - pad - fw;
  const src = prepImage(shot.name, crop, fw, frameH, kind);
  const iconSize = kind === 'banner' ? 92 : 104, nameSize = kind === 'banner' ? 76 : 84, tagSize = kind === 'banner' ? 26 : 28;
  const textW = fx - pad - 48;
  return `<div class="stage" style="width:${W}px;height:${H}px">
    <div class="bg" style="${bgCss(t)}"></div>${blobsHtml(t, W, H)}
    <div style="position:absolute;left:${pad}px;top:0;bottom:0;width:${textW}px;display:flex;flex-direction:column;justify-content:center">
      <div class="brand" style="position:static"><img src="${icon}" width="${iconSize}" height="${iconSize}"><div class="name" style="font-size:${nameSize}px;color:${t.ink}">Markooj</div></div>
      <div class="tag" style="margin-top:26px;font-size:${tagSize}px;color:${t.sub}">A calm, Word-like Markdown editor for researchers.</div>
      <div class="tag" style="margin-top:14px;font-size:${Math.round(tagSize * 0.72)}px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${t.accent}">Free · Offline · Open source</div>
    </div>
    <div class="frame" style="left:${fx}px;top:${pad}px;width:${fw}px;height:${frameH}px"><img src="${src}"></div>
  </div>`;
}

async function compose(cw, html, W, H, out) {
  await attach(cw, { width: W, height: H, scale: 1 });
  await cw.executeJavaScript(`(async () => { const r = document.getElementById('root'); r.innerHTML = ${JSON.stringify(html)};
    await Promise.all([...r.querySelectorAll('img')].map(i => i.decode().catch(() => {}))); await document.fonts.ready;
    await new Promise(z => requestAnimationFrame(() => requestAnimationFrame(z))); return true; })()`, true);
  await sleep(150);
  const img = await grab(cw);
  const sz = img.getSize();
  const fin = sz.width === W && sz.height === H ? img : img.resize({ width: W, height: H, quality: 'best' });
  fs.writeFileSync(out, fin.toPNG());
  log('wrote', path.relative(ROOT, out), `${W}×${H}`);
}

// ---------- main flow ----------
async function waitForApp(wc) {
  for (let i = 0; i < 300; i++) {
    try { if (await wc.executeJavaScript('!!(window.app && app.docs && app.docs.list().length && document.querySelector("#ribbon"))')) return true; } catch {}
    await sleep(200);
  }
  throw new Error('Markooj did not start within 60 s');
}

async function run() {
  await app.whenReady();
  for (let i = 0; i < 100 && !mainWin; i++) await sleep(100);
  if (!mainWin) throw new Error('no window');
  const wc = mainWin.webContents;
  await waitForApp(wc);
  await attach(wc, VIEW);
  await sleep(1500);
  await js(wc, pageHelpers);
  const args = {
    paper: path.join(SAMPLES, 'sediment-transport', 'sediment-transport.md'),
    canal: path.join(SAMPLES, 'canal-survey-notes.md'),
    thesis: path.join(SAMPLES, 'thesis-chapter-3-outline.md'),
    notebook: path.join(SAMPLES, 'lab-notebook.md'),
    draft: path.join(SAMPLES, 'draft-abstract.md'),
    macro: fs.readFileSync(path.join(SAMPLES, 'macros', 'fall-velocity-summary.py'), 'utf8'),
  };
  // folder names that must never show up in a picture
  const privateBits = [WORK, os.homedir(), ROOT, os.userInfo().username].filter(s => s && s.length > 3);

  const shots = {}, notes = [];
  const wanted = name => !ONLY || ONLY.test(name);
  for (const [name, fn, o = {}] of SCENES) {
    if (!wanted(name)) continue;
    log('scene', name);
    try {
      await js(wc, () => window.__img ? window.__img.reset() : false);
      if (o.zoom) { wc.setZoomFactor(o.zoom); await sleep(600); }
      const r = (await Promise.race([js(wc, fn, args), sleep(150000).then(() => ({ skip: 'timed out' }))])) || {};
      if (r.skip) { notes.push(`${name}: skipped (${r.skip})`); log('  skipped:', r.skip); continue; }
      if (r.note) notes.push(`${name}: ${r.note}`);
      const leaks = await js(wc, w => window.__img.leaks(w), privateBits);
      if (leaks.length) { notes.push(`${name}: NOT SAVED, the screen showed a private folder name`); log('  private text on screen, skipped'); continue; }
      const img = await grab(wc);
      fs.writeFileSync(path.join(RAW, name + '.png'), img.toPNG());
      shots[name] = { name, crop: r.crop || null, exact: !!r.exact, crops: r.crops || {} };
    } catch (e) {
      notes.push(`${name}: failed (${e.message})`); log('  failed:', e.message);
    } finally {
      if (o.zoom) wc.setZoomFactor(1);
    }
  }
  try { await js(wc, () => window.__img.reset()); } catch {}

  // plain screenshots for the docs
  const captions = [];
  for (const [file, scene, cap] of DOCS) {
    if (!shots[scene]) continue;
    const img = nativeImage.createFromPath(path.join(RAW, scene + '.png')).resize({ width: VIEW.width, height: VIEW.height, quality: 'best' });
    fs.writeFileSync(path.join(OUT_DOCS, file), img.toPNG());
    captions.push(`- docs/images/${file}: ${cap}`);
    log('wrote', 'docs/images/' + file);
  }

  // composed images
  const cwin = new BrowserWindow({ show: false, width: 1280, height: 800, backgroundColor: '#ffffff', webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false } });
  quietWindow(cwin); cwin.show();
  const page = path.join(WORK, 'compose.html');
  fs.writeFileSync(page, COMPOSE_HTML);
  await cwin.loadFile(page);
  const cc = cwin.webContents;
  // a full run replaces the whole set, so no picture from an older list stays behind
  if (!ONLY) for (const f of fs.readdirSync(OUT_SF)) if (/^\d\d-.*\.png$/.test(f)) fs.rmSync(path.join(OUT_SF, f));
  for (const spec of IMAGES) {
    const have = spec.scenes.map(s => shots[s]).filter(Boolean);
    if (have.length !== spec.scenes.length) { if (!spec.optional) notes.push(`${spec.file}: not made (scene missing)`); continue; }
    const html = spec.layout === 'grid4' ? layoutGrid4(spec, have, 1280, 800) : layoutFrame(spec, have, 1280, 800);
    await compose(cc, html, 1280, 800, path.join(OUT_SF, spec.file));
    captions.push(`- marketing/sourceforge/${spec.file}: ${spec.title}${spec.sub ? ' ' + spec.sub : ''}`);
  }
  const social = shots.wordMode?.crops?.social ? { ...shots.wordMode, crop: shots.wordMode.crops.social } : shots.hero ? { ...shots.hero, crop: null } : null;
  if (social) {
    await compose(cc, layoutBrand('social', social, 1280, 640), 1280, 640, path.join(OUT_MKT, 'github-social-preview.png'));
    captions.push('- marketing/github-social-preview.png: GitHub social preview (1280 × 640)');
  }
  if (shots.hero) {
    await compose(cc, layoutBrand('banner', { ...shots.hero, crop: null }, 1500, 500), 1500, 500, path.join(OUT_MKT, 'banner-1500x500.png'));
    captions.push('- marketing/banner-1500x500.png: SourceForge banner (1500 × 500)');
  }
  const icon = nativeImage.createFromPath(path.join(ROOT, 'build', 'icon.png'));
  fs.writeFileSync(path.join(OUT_MKT, 'icon-512.png'), (icon.getSize().width === 512 ? icon : icon.resize({ width: 512, height: 512, quality: 'best' })).toPNG());
  captions.push('- marketing/icon-512.png: project icon (512 × 512)');

  if (!ONLY) fs.writeFileSync(path.join(OUT_MKT, 'captions.md'), `# Markooj images\n\nMade by \`npm run images\` (scripts/make-store-images.js) from the documents in samples/.\n\n${captions.join('\n')}\n`);
  if (notes.length) log('notes:\n  ' + notes.join('\n  '));
  log('done.', KEEP ? `Raw shots kept in ${WORK}` : '');
  return notes;
}

run().then(() => finish(0), e => { console.error('[images] failed:', e && e.stack || e); finish(1); });
function finish(code) {
  try { for (const w of BrowserWindow.getAllWindows()) w.destroy(); } catch {}
  if (!KEEP) setTimeout(() => { try { fs.rmSync(WORK, { recursive: true, force: true, maxRetries: 3 }); } catch {} app.exit(code); }, 300);
  else app.exit(code);
}
