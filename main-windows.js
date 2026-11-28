// Markooj — more than one window (View → Window: New Window, Arrange All, Switch Windows) and the live link that
// keeps one document the same in every window that shows it.
//
// Design (cannot lose text): main holds the shared text of every linked document with a version number.
// A window sends its whole text with the version it started from. When nobody changed the text in between, the
// edit is taken as it is; otherwise main merges both edits (they rarely touch the same spot). If they overlap,
// the incoming edit wins and the text it replaced is kept in File → Recover, so nothing is ever thrown away.
// Every other window gets the new text at once. Saving from any window saves the shared text, and the other
// windows are told the new file time, so neither one later sees a false "changed on disk" warning.
// Required from main.js with a small context object; see ARCHITECTURE.md (round 5).
'use strict';
const { BrowserWindow, ipcMain, screen, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const I18N = require('./main-i18n'); // interface translations

module.exports = function init(ctx) {
  const extras = new Set(); // windows made here (the first window belongs to main.js)
  const entries = new Map(); // key → {key, path, title, text, savedText, mtime, version, hist: Map(version → text), members: Set(wc id)}
  const HIST = 24;
  const norm = p => { try { const r = path.resolve(String(p)); return process.platform === 'linux' ? r : r.toLowerCase(); } catch { return String(p); } };
  const newKey = () => 'w' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
  const alive = w => w && !w.isDestroyed();

  function all() {
    const out = [];
    const main = ctx.getMain();
    if (alive(main)) out.push(main);
    for (const w of extras) if (alive(w) && !out.includes(w)) out.push(w);
    return out;
  }
  const wcOf = id => { for (const w of all()) if (w.webContents.id === id) return w.webContents; return null; };
  function send(id, ch, payload) { const wc = wcOf(id); if (wc && !wc.isDestroyed()) wc.send(ch, payload); }

  // ---------- three-way merge (same rule as core.js: two edits that do not overlap both apply) ----------
  function merge3(base, theirs, mine) {
    const span = (a, b) => { let s = 0; const n = Math.min(a.length, b.length); while (s < n && a[s] === b[s]) s++; let e = 0; while (e < n - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++; return { s, e: a.length - e, ins: b.slice(s, b.length - e) }; };
    if (theirs === base) return mine;
    if (mine === base || mine === theirs) return theirs;
    const t = span(base, theirs), m = span(base, mine);
    if (t.e <= m.s) return base.slice(0, t.s) + t.ins + base.slice(t.e, m.s) + m.ins + base.slice(m.e);
    if (m.e <= t.s) return base.slice(0, m.s) + m.ins + base.slice(m.e, t.s) + t.ins + base.slice(t.e);
    return null;
  }

  function remember(e) {
    e.hist.set(e.version, e.text);
    if (e.hist.size > HIST) e.hist.delete(e.hist.keys().next().value);
  }
  function peers(e) {
    for (const id of e.members) send(id, 'win-doc-peers', { key: e.key, peers: e.members.size });
  }
  function leave(e, id) {
    if (!e.members.delete(id)) return;
    if (!e.members.size) entries.delete(e.key); else peers(e);
  }
  const watched = new Set();
  function watch(wc) {
    if (watched.has(wc.id)) return;
    watched.add(wc.id);
    const id = wc.id;
    wc.once('destroyed', () => { watched.delete(id); closingWins.delete(id); for (const e of [...entries.values()]) leave(e, id); });
    // a reload (crash recovery) starts a fresh page: it joins again with its own documents
    wc.on('did-start-navigation', (_e, _url, inPage, isMain) => { if (isMain && !inPage) { closingWins.delete(id); for (const e of [...entries.values()]) leave(e, id); } });
  }

  // ---------- linked documents ----------
  ipcMain.handle('win-doc-join', (ev, o = {}) => {
    const id = ev.sender.id; watch(ev.sender);
    let e = o.key ? entries.get(String(o.key)) : null;
    if (!e && o.path) { const n = norm(o.path); e = [...entries.values()].find(x => x.path && norm(x.path) === n) || null; }
    if (e) {
      const joined = !e.members.has(id) && e.members.size > 0;
      e.members.add(id);
      peers(e);
      return { key: e.key, version: e.version, text: e.text, savedText: e.savedText, mtime: e.mtime, path: e.path, title: e.title, joined, peers: e.members.size };
    }
    e = { key: newKey(), path: o.path || null, title: o.title || 'Untitled', text: String(o.text ?? ''), savedText: o.savedText != null ? String(o.savedText) : null, mtime: o.mtime ?? null, version: 1, hist: new Map(), members: new Set([id]) };
    remember(e); entries.set(e.key, e);
    return { key: e.key, version: e.version, joined: false, peers: 1 };
  });
  ipcMain.handle('win-doc-get', (_ev, key) => {
    const e = entries.get(String(key));
    return e ? { key: e.key, version: e.version, text: e.text, savedText: e.savedText, mtime: e.mtime, path: e.path, title: e.title } : null;
  });
  ipcMain.handle('win-doc-edit', (ev, o = {}) => {
    const e = entries.get(String(o.key));
    if (!e) return { missing: true };
    const id = ev.sender.id;
    const text = String(o.text ?? '');
    if (o.base === e.version) e.text = text;
    else {
      const base = e.hist.get(o.base);
      const merged = base != null ? merge3(base, e.text, text) : null;
      if (merged == null) {
        // both windows changed the same words at the same moment: the newer edit wins, the replaced text goes to File → Recover
        try { ctx.saveRecovery({ docId: 'window-' + e.key + '-' + e.version, path: e.path, title: I18N.t('{title} (other window)', { title: e.title }), text: e.text }); } catch (err) { console.warn('windows: recovery copy', err.message); }
        e.text = text;
      } else e.text = merged;
    }
    e.version++; remember(e);
    for (const m of e.members) if (m !== id) send(m, 'win-doc-update', { key: e.key, version: e.version, text: e.text });
    return { version: e.version, text: e.text === text ? null : e.text };
  });
  ipcMain.handle('win-doc-saved', (ev, o = {}) => {
    const e = entries.get(String(o.key));
    if (!e) return false;
    if (o.path) e.path = String(o.path);
    if (o.title) e.title = String(o.title);
    if (o.savedText != null) e.savedText = String(o.savedText);
    if (o.mtime != null) e.mtime = o.mtime;
    for (const m of e.members) if (m !== ev.sender.id) send(m, 'win-doc-saved', { key: e.key, path: e.path, title: e.title, savedText: e.savedText, mtime: e.mtime, ext: o.ext || null });
    return true;
  });
  ipcMain.handle('win-doc-leave', (ev, key) => { const e = entries.get(String(key)); if (e) leave(e, ev.sender.id); return true; });
  // Closing: a window may leave a shared document to another window only when that window is not closing too
  // ("Close all windows" on the taskbar, signing out, Cmd+Q close every window at once). Main answers one window at a
  // time, so of two windows closing together exactly one keeps the document and asks about it.
  const closingWins = new Set();
  ipcMain.handle('win-doc-closing', (ev, on) => {
    const id = ev.sender.id; watch(ev.sender);
    if (!on) { closingWins.delete(id); return { keys: [] }; }
    closingWins.add(id);
    const keys = [];
    for (const e of entries.values()) if (e.members.has(id) && [...e.members].some(m => m !== id && !closingWins.has(m) && wcOf(m))) keys.push(e.key);
    return { keys };
  });

  // ---------- windows ----------
  function windowInfo(w, sender) {
    const b = w.getBounds();
    return { id: w.webContents.id, title: String(w.getTitle() || 'Markooj').replace(/\s+—\s+Markooj$/, ''), focused: w.isFocused(), current: !!sender && w.webContents.id === sender.id, minimized: w.isMinimized(), bounds: b, main: w === ctx.getMain() };
  }
  function createExtra(o = {}) {
    const ref = BrowserWindow.getFocusedWindow() || ctx.getMain();
    const rb = alive(ref) ? (ref.isMaximized() ? ref.getNormalBounds() : ref.getBounds()) : { x: undefined, y: undefined, width: 1200, height: 820 };
    const q = new URLSearchParams({ mkwin: '1' });
    if (o.key) q.set('link', String(o.key));
    if (o.mode && /^(word|inline|simple|read)$/.test(o.mode)) q.set('mode', o.mode);
    const url = `${ctx.START_URL}?${q}`;
    const icon = path.join(ctx.APP_ROOT, 'build', 'icon.png');
    const w = new BrowserWindow({
      x: rb.x != null ? rb.x + 32 : undefined, y: rb.y != null ? rb.y + 32 : undefined, width: rb.width, height: rb.height, minWidth: 760, minHeight: 520,
      show: false, title: 'Markooj', backgroundColor: ctx.bgColor(),
      ...(fs.existsSync(icon) ? { icon } : {}),
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      webPreferences: { preload: path.join(ctx.APP_ROOT, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: true, webviewTag: false, backgroundThrottling: !ctx.SMOKE },
    });
    extras.add(w);
    const wc = w.webContents;
    if (ctx.SMOKE) { w.setOpacity(0); w.showInactive(); } // test windows never appear on the screen
    else w.once('ready-to-show', () => w.show());
    w.loadURL(url);
    wc.on('did-finish-load', () => { if (o.path) wc.send('open-path', String(o.path)); });
    wc.setWindowOpenHandler(({ url: u }) => { if (/^(https?|mailto):/i.test(u)) shell.openExternal(u); return { action: 'deny' }; });
    wc.on('will-navigate', (e, u) => { if (u.split('#')[0] === url || u.split('#')[0] === ctx.START_URL) return; e.preventDefault(); if (/^(https?|mailto):/i.test(u)) shell.openExternal(u); });
    wc.on('will-attach-webview', e => e.preventDefault());
    wc.setVisualZoomLevelLimits(1, 1).catch(() => {});
    wc.on('before-input-event', (_e, input) => { if (input.type === 'keyDown' && input.control && input.shift && !input.alt && input.key.toLowerCase() === 'i') wc.toggleDevTools(); });
    wc.on('context-menu', (_e, p) => { try { ctx.showContextMenu(wc, p); } catch {} });
    wc.on('render-process-gone', (_e, d) => { if (d.reason !== 'clean-exit' && alive(w)) setTimeout(() => { if (alive(w)) w.loadURL(url); }, 400); });
    // closing asks the page first (unsaved documents), like the first window
    let askedAt = 0;
    w.on('close', async e => {
      if (w.__forceClose || ctx.SMOKE) return;
      e.preventDefault();
      let ok = false;
      try { ok = await Promise.race([wc.executeJavaScript('!!(window.app && window.mk)', true), new Promise(r => setTimeout(() => r(false), 1500))]); } catch {}
      if (!ok) { w.__forceClose = true; w.close(); return; }
      const now = Date.now();
      if (askedAt && now - askedAt > 10000) { w.__forceClose = true; w.close(); return; }
      askedAt = now;
      wc.send('request-close');
    });
    w.on('closed', () => { extras.delete(w); });
    return w;
  }
  ipcMain.handle('win-new', (_ev, o = {}) => {
    const w = createExtra(o || {});
    return { id: w.webContents.id };
  });
  ipcMain.handle('win-list', ev => all().map(w => windowInfo(w, ev.sender)));
  ipcMain.handle('win-focus', (_ev, id) => {
    const w = all().find(x => x.webContents.id === id);
    if (!w) return false;
    if (w.isMinimized()) w.restore();
    if (ctx.SMOKE) return true; // never bring a hidden test window forward
    w.show(); w.focus(); return true;
  });
  ipcMain.handle('win-cycle', (ev, dir) => {
    const list = all(); if (list.length < 2) return null;
    const i = list.findIndex(w => w.webContents.id === ev.sender.id);
    const n = list[((i < 0 ? 0 : i) + (dir < 0 ? -1 : 1) + list.length) % list.length];
    if (n.isMinimized()) n.restore();
    if (!ctx.SMOKE) { n.show(); n.focus(); }
    return n.webContents.id;
  });
  /** Tiles every Markooj window on the screen of the window that asked: side by side, in a grid from four windows on. */
  function arrange(sender) {
    const list = all(); if (!list.length) return [];
    const from = list.find(w => w.webContents.id === sender?.id) || list[0];
    const area = screen.getDisplayMatching(from.getBounds()).workArea;
    const n = list.length, cols = n <= 3 ? n : Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
    const cw = Math.floor(area.width / cols), ch = Math.floor(area.height / rows);
    list.forEach((w, i) => {
      if (w.isFullScreen()) w.setFullScreen(false);
      if (w.isMaximized()) w.unmaximize();
      if (w.isMinimized()) w.restore();
      const c = i % cols, r = Math.floor(i / cols);
      w.setBounds({ x: area.x + c * cw, y: area.y + r * ch, width: Math.max(cw, 400), height: Math.max(ch, 300) });
    });
    return list.map(w => windowInfo(w, sender));
  }
  ipcMain.handle('win-arrange', ev => arrange(ev.sender));

  // ---------- smoke only ----------
  ipcMain.handle('win-smoke-eval', async (_ev, id, js) => {
    if (!ctx.SMOKE) throw new Error('Only available in a test run.');
    const wc = wcOf(id); if (!wc) throw new Error('No window ' + id);
    return wc.executeJavaScript(String(js), true);
  });
  ipcMain.handle('win-smoke-close', (_ev, id) => {
    if (!ctx.SMOKE) throw new Error('Only available in a test run.');
    for (const w of [...extras]) if (alive(w) && (id == null || w.webContents.id === id)) { w.__forceClose = true; w.destroy(); }
    return true;
  });

  const api = {
    windows: all,
    /** The first window closed: another open window takes its place (dialogs, tools messages, second launches). */
    promote(closed) {
      const w = [...extras].find(x => alive(x) && x !== closed);
      if (!w) return null;
      extras.delete(w);
      w.once('closed', () => { if (ctx.getMain() === w && ctx.setMain) ctx.setMain(api.promote(w)); });
      return w;
    },
    count: () => all().length,
    createExtra,
  };
  return api;
};
