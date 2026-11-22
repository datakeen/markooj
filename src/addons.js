// Markooj — add-in manager: loads bundled ./addons and the user's add-ins folder, runs the enabled ones,
// File → Add-ins page, the Add-ins ribbon tab. Owner: developer (folder add-ins and the community switch: store). See ARCHITECTURE.md.
//
// Two kinds of add-ins live in the add-ins folder (<userData>/addons, portable copies: data/addons):
//   - a single .js file with // @name … header lines (as before);
//   - a folder <id>/ with manifest.json + main.js (+ styles.css, + data files), as the add-in store installs them
//     (with an .install.json {source:"store", …}). A store add-in runs only once "Community add-ins" is on
//     (setting addins.community, off until the user turns it on and accepts the notice).
// Code runs as new Function('app', 'markooj', 'addin', code): `addin` = {id, version, dir, file(name, {encoding})} for folder
// add-ins. styles.css goes into <style data-mk-addin="<id>"> while the add-in is on, and is removed when it is turned off.
(function () {
  'use strict';
  const app = window.app;
  if (!app) return;
  const mk = app.mk || window.mk || {};
  const esc = app.esc || (s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const toast = (m, o) => { try { app.ui.toast(m, o); } catch { console.log('[toast]', m); } };
  const svg = (name, extra = '') => `<svg class="i" ${extra}><use href="#${name}"/></svg>`;
  const BUNDLED_FALLBACK = ['readability.js', 'word-frequency.js', 'si-units.js'];
  const PALETTE = [['#34c759', '#248a3d'], ['#af52de', '#7d3cbd'], ['#ff9f0a', '#d97a00'], ['#0a84ff', '#0a52e0'], ['#ff375f', '#c9184a'], ['#5e5ce6', '#3634a3'], ['#30b0c7', '#1d7f91']];

  const CSS = `
.mka-card svg.i,.mka-page svg.i{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex:none}
.mka-row{display:flex;gap:8px;align-items:center;height:100%;overflow-x:auto;overflow-y:hidden;max-width:min(62vw,760px);padding:0 2px;scrollbar-width:thin}
.mka-card{width:210px;height:76px;flex:none;border-radius:10px;border:.5px solid var(--line);background:var(--surface);display:flex;gap:10px;align-items:center;padding:10px;text-align:left;color:var(--text);font:13px var(--font,system-ui);transition:border-color .15s,transform .15s var(--ease,ease),box-shadow .2s}
.mka-card:hover{border-color:var(--accent);transform:translateY(-1px)}
.mka-card:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-ring)}
.mka-ic{width:36px;height:36px;border-radius:9px;display:grid;place-items:center;color:#fff;flex:none}
.mka-ic svg.i{width:18px;height:18px}
.mka-txt{min-width:0;flex:1}
.mka-txt b{display:block;font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mka-txt span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:11px;color:var(--text-2);line-height:1.3}
.mka-toggle{width:30px;height:18px;border-radius:9px;background:var(--line-2);position:relative;margin-left:auto;flex:none;border:0;padding:0;transition:background .2s}
.mka-toggle::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:left .25s var(--ease,ease)}
.mka-toggle.on{background:var(--green,#28a745)}
.mka-toggle.on::after{left:14px}
.mka-toggle:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-ring)}
.mka-empty{font-size:12px;color:var(--text-3);padding:0 10px;max-width:220px;line-height:1.4}
.mka-page{max-width:1000px;font:13px/1.45 var(--font,system-ui);color:var(--text)}
.mka-page h2{font:600 26px var(--font,system-ui);letter-spacing:-.02em;margin:0 0 4px}
.mka-page .sub{color:var(--text-2);margin:0 0 20px;font-size:14px}
.mka-actions{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 22px}
.mka-btn{height:32px;padding:0 14px;border-radius:8px;display:inline-flex;align-items:center;gap:7px;font:500 13px var(--font,system-ui);color:var(--text);background:var(--surface);border:.5px solid var(--line-2);transition:background .15s,border-color .15s,transform .12s var(--ease,ease)}
.mka-btn:hover{border-color:var(--accent)}
.mka-btn:active{transform:scale(.97);background:var(--press)}
.mka-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.mka-btn.primary:hover{background:var(--accent-2)}
.mka-banner{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;background:var(--accent-soft);margin:0 0 18px;animation:mkaUp .28s var(--ease,ease)}
.mka-banner span{flex:1;color:var(--text)}
@keyframes mkaUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.mka-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.mka-big{background:var(--surface);border:.5px solid var(--line);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;transition:transform .2s var(--ease,ease),box-shadow .2s,border-color .2s}
.mka-big:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(0,0,0,.08);border-color:var(--accent)}
.mka-big .top{display:flex;gap:12px;align-items:center}
.mka-big .top b{font-size:14px;font-weight:600;display:block}
.mka-big .top small{color:var(--text-3);font-size:11.5px}
.mka-big p{margin:0;color:var(--text-2);font-size:12.5px}
.mka-chip{font-size:11px;padding:2px 8px;border-radius:20px;background:var(--hover);color:var(--text-2)}
.mka-chip.user{background:var(--accent-soft);color:var(--accent)}
.mka-err-acts{display:flex;gap:6px;margin-top:6px;font-family:var(--font,system-ui)}
.mka-err{font:12px/1.45 var(--mono,monospace);color:#d92d20;background:rgba(255,59,48,.08);border-radius:8px;padding:8px 10px;white-space:pre-wrap;word-break:break-word}
.mka-sec{font:600 13px var(--font,system-ui);color:var(--text-2);margin:30px 0 12px}
.mka-guide{background:var(--surface);border:.5px solid var(--line);border-radius:14px;padding:18px 20px}
.mka-guide ol{margin:0 0 12px;padding-left:20px;color:var(--text)}
.mka-guide li{margin:0 0 4px}
.mka-guide pre{margin:10px 0;font:12px/1.55 var(--mono,monospace);background:var(--bg);border:.5px solid var(--line);border-radius:9px;padding:12px 14px;overflow:auto;white-space:pre}
.mka-guide table{border-collapse:collapse;width:100%;font-size:12.5px;margin-top:6px}
.mka-guide td{padding:6px 8px;border-bottom:.5px solid var(--line-2);vertical-align:top}
.mka-guide td:first-child{font:12px var(--mono,monospace);white-space:nowrap;color:var(--text)}
.mka-guide td:last-child{color:var(--text-2)}
.mka-chip.store{background:rgba(52,199,89,.12);color:var(--green,#28a745)}
.mka-ver{display:inline-grid;place-items:center;width:15px;height:15px;border-radius:50%;background:var(--accent);color:#fff;margin-left:5px;vertical-align:-2px}
.mka-ver svg.i{width:10px;height:10px;stroke-width:2.4}
.mka-note{font-size:12px;color:var(--text-2);background:var(--hover);border-radius:8px;padding:8px 10px;display:flex;gap:8px;align-items:center}
.mka-note span{flex:1}
.mka-foot{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:auto}
.mka-foot .grow{flex:1}
.mka-mini{height:26px;padding:0 10px;border-radius:7px;font:500 12px var(--font,system-ui);color:var(--text);background:var(--surface);border:.5px solid var(--line-2);transition:border-color .15s,background .15s}
.mka-mini:hover{border-color:var(--accent)}
.mka-mini.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.mka-mini.danger{color:var(--danger,#d70015)}
.mka-switch{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;background:var(--surface);border:.5px solid var(--line);margin:0 0 18px}
.mka-switch div{flex:1;min-width:0}
.mka-switch b{display:block;font-size:13.5px;font-weight:600}
.mka-switch small{display:block;color:var(--text-2);font-size:12px;margin-top:2px}
`;
  if (!document.getElementById('mka-style')) { const st = document.createElement('style'); st.id = 'mka-style'; st.textContent = CSS; document.head.append(st); }
  const addIcon = () => {
    if (document.getElementById('mka-icons')) return;
    const w = document.createElement('div');
    w.innerHTML = '<svg id="mka-icons" width="0" height="0" style="position:absolute" aria-hidden="true"><defs><symbol id="addin-install" viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></symbol><symbol id="addin-reload" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></symbol></defs></svg>';
    document.body.prepend(w.firstChild);
  };
  if (document.body) addIcon(); else document.addEventListener('DOMContentLoaded', addIcon, { once: true });

  // ---------- header parsing ----------
  function parseHeader(code) {
    const meta = {};
    const lines = String(code || '').replace(/^﻿/, '').split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const m = /^(?:\/\/|\*|\/\*+)\s*@([A-Za-z][\w-]*)\s*(.*?)\s*(?:\*\/)?$/.exec(line);
      if (m) { meta[m[1].toLowerCase()] = m[2]; continue; }
      if (/^(\/\/|\/\*|\*)/.test(line)) continue;
      break;
    }
    return meta;
  }
  function colorFor(a) {
    const c = a.meta.color;
    if (c && /^#[0-9a-f]{3,8}$/i.test(c)) return `linear-gradient(135deg,${c},${c}cc)`;
    let hsh = 0; for (const ch of a.id) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
    const [x, y] = PALETTE[hsh % PALETTE.length]; return `linear-gradient(135deg,${x},${y})`;
  }

  // ---------- state ----------
  const state = { list: [], dir: '', loaded: false, needsReload: false, error: null };
  let resolveReady; const ready = new Promise(r => { resolveReady = r; });
  // settings load during boot, possibly after this file starts loading add-ins: the first load reads them from main itself
  let bootSettings = null, settingsLoaded = false;
  const setting = (key, fb) => (bootSettings && !settingsLoaded && key in bootSettings ? bootSettings[key] : app.settings.get(key, fb));
  app.events.on('ready', () => { settingsLoaded = true; });
  const setSetting = (key, v) => { if (bootSettings) bootSettings[key] = v; app.settings.set(key, v); };
  const disabled = () => new Set((setting('disabledAddons', []) || []).map(String));
  const COMMUNITY = 'addins.community';
  const communityOn = () => setting(COMMUNITY, false) === true;
  const NOTICE = 'Add-ins from the community run with the same rights as Markooj. Install only add-ins you trust. Add-ins with a check mark are made by the Markooj team.';

  async function fetchList() {
    try {
      const r = await mk.invoke('user-addons');
      if (r && Array.isArray(r.list)) return r;
    } catch (e) { state.error = e.message; }
    // Fallback (no IPC yet): fetch the bundled samples through the app protocol.
    const list = [];
    for (const f of BUNDLED_FALLBACK) {
      try { const res = await fetch(new URL('../addons/' + f, document.baseURI)); if (res.ok) list.push({ name: f, code: await res.text(), user: false }); } catch {}
    }
    return { dir: '', list };
  }

  function makeEntry(x) {
    const file = String(x.name || 'addon.js');
    const id = file.replace(/\.js$/i, '');
    const meta = parseHeader(x.code);
    return { id, file, code: String(x.code || ''), user: !!x.user, meta, name: meta.name || id.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), description: meta.description || '', version: meta.version || '', author: meta.author || '', icon: meta.icon || 'puzzle', running: false, error: null, enabled: true, folder: false, store: false, verified: false, css: '' };
  }
  /** A folder add-in from the addins-folder-list IPC: {id, dir, manifest, install, code, css, error}. */
  function makeFolderEntry(f) {
    const m = (f && f.manifest) || {};
    const id = String(f.id);
    const store = !!(f.install && f.install.source === 'store');
    const meta = { name: m.name, description: m.description, version: m.version, author: m.author, icon: m.icon, color: m.color, category: m.category, authorUrl: m.authorUrl };
    return { id, file: id + '/main.js', code: String(f.code || ''), css: String(f.css || ''), user: true, folder: true, store, verified: store && !!f.install.verified, dir: f.dir || '',
      repo: (f.install && f.install.repo) || '', meta, name: String(m.name || id), description: String(m.description || ''), version: String(m.version || ''), author: String(m.author || ''),
      icon: /^[a-z0-9-]{1,40}$/.test(String(m.icon || '')) ? m.icon : 'puzzle', files: Array.isArray(m.files) ? m.files.map(x => x && x.name).filter(Boolean) : [],
      running: false, error: f.error || null, loadError: f.error || null, enabled: true, blocked: false };
  }
  // A store add-in waits for the community switch; everything else runs as before.
  const isBlocked = a => !!a.store && !communityOn();

  // ---------- styles.css of folder add-ins ----------
  const styleEl = id => document.querySelector(`style[data-mk-addin="${window.CSS.escape(String(id))}"]`);
  function injectStyles(a) {
    if (!a.css) return null;
    let st = styleEl(a.id);
    if (!st) { st = document.createElement('style'); st.dataset.mkAddin = a.id; document.head.append(st); }
    if (st.textContent !== a.css) st.textContent = a.css;
    return st;
  }
  function removeStyles(id) { styleEl(id)?.remove(); }

  function addinContext(a) {
    const ctx = { id: a.id, version: a.version, dir: a.dir || '', name: a.name };
    if (a.folder) ctx.file = (name, opts) => mk.invoke('addins-file', a.id, name, opts || {});
    return Object.freeze(ctx);
  }
  function runEntry(a) {
    if (a.running) return true;
    if (a.loadError) { a.error = a.loadError; return false; }
    if (isBlocked(a)) { a.blocked = true; return false; }
    a.blocked = false;
    try {
      injectStyles(a);
      // eslint-disable-next-line no-new-func
      const fn = new Function('app', 'markooj', 'addin', `${a.code}\n//# sourceURL=markooj-addins/${a.file}`);
      fn(app, app.developer?.api, addinContext(a));
      a.running = true; a.error = null;
      return true;
    } catch (e) {
      removeStyles(a.id);
      a.error = (e && (e.stack || e.message)) ? `${e.name || 'Error'}: ${e.message}` : String(e);
      console.error(`[add-in ${a.file}]`, e);
      return false;
    }
  }

  async function fetchFolders() {
    try { const r = await mk.invoke('addins-folder-list'); return Array.isArray(r) ? r : []; }
    catch { return []; }
  }
  /** Every add-in by id: bundled files, then the user's files, then folders (a folder wins over a file with the same id). */
  function collect(r, folders) {
    const byId = new Map();
    for (const x of r.list || []) { const e = makeEntry(x); const prev = byId.get(e.id); if (!prev || e.user) byId.set(e.id, e); }
    for (const f of folders) { if (f && f.id) byId.set(String(f.id), makeFolderEntry(f)); }
    return byId;
  }
  async function load() {
    const [r, folders] = await Promise.all([fetchList(), fetchFolders(), (async () => { try { bootSettings = await mk.invoke('settings-get'); } catch {} })()]);
    state.dir = r.dir || '';
    const byId = collect(r, folders);
    const off = disabled();
    state.list = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    for (const a of state.list) { a.enabled = !off.has(a.id); if (a.enabled) runEntry(a); }
    state.loaded = true;
    refresh();
    const bad = state.list.filter(a => a.error);
    if (bad.length === 1) problemToast(bad[0]);
    else if (bad.length) toast(`Open File → Add-ins to turn off the ${bad.length} add-ins that didn’t start. Everything else works.`, { kind: 'warn', actions: [{ label: 'Open Add-ins', run: () => app.backstage.open('addins') }] });
    resolveReady(state.list);
    return state.list;
  }

  /** Look at the add-ins folder again after the store installed, updated or removed something.
   *  New add-ins start at once; a changed or removed add-in that is running needs a reload. */
  async function rescan() {
    const [r, folders] = await Promise.all([fetchList(), fetchFolders()]);
    const byId = collect(r, folders);
    const off = disabled();
    const out = { added: [], updated: [], removed: [], needsReload: false };
    const next = [];
    for (const e of byId.values()) {
      const old = state.list.find(a => a.id === e.id);
      if (!old) {
        e.enabled = !off.has(e.id); if (e.enabled) runEntry(e);
        out.added.push(e.id); next.push(e); continue;
      }
      const changed = old.code !== e.code || old.version !== e.version || old.css !== e.css || old.folder !== e.folder;
      if (!changed) { next.push(old); continue; }
      out.updated.push(e.id);
      e.enabled = old.enabled;
      // (a store add-in updated after community add-ins were turned off keeps its styles off too)
      if (old.running) { e.running = true; out.needsReload = true; if (e.css && e.enabled && !isBlocked(e)) injectStyles(e); else removeStyles(e.id); }
      else if (e.enabled) runEntry(e);
      next.push(e);
    }
    for (const old of state.list) {
      if (byId.has(old.id)) continue;
      out.removed.push(old.id); removeStyles(old.id);
      if (old.running) out.needsReload = true;
    }
    state.list = next.sort((a, b) => a.name.localeCompare(b.name));
    if (out.needsReload) state.needsReload = true;
    refresh();
    return out;
  }

  // ---------- an add-in that did not start: Turn it off · Show error · Report to the author ----------
  function authorUrl(a) {
    const repo = String(a.repo || a.meta?.repo || '');
    if (/^[\w.-]+\/[\w.-]+$/.test(repo)) return `https://github.com/${repo}/issues`;
    for (const u of [a.meta?.bugs, a.bugs, a.homepage, a.meta?.homepage]) if (/^https:\/\//.test(String(u || ''))) return String(u);
    return null;
  }
  function problemActions(a) {
    const report = `Add-in: ${a.name}${a.version ? ' ' + a.version : ''}\nMarkooj ${app.version || ''}\n\n${a.error || ''}`;
    return [
      { label: 'Turn it off', run: () => setEnabled(a.id, false) },
      { label: 'Show error', run: () => app.ui.showDetails ? app.ui.showDetails({ title: `Turn off “${a.name}”, or report it to its author`, message: 'The add-in didn’t start. Everything else in Markooj works.', details: report, report: false }) : toast(String(a.error), { kind: 'info' }) },
      { label: 'Report to the author', run: async () => {
        const url = authorUrl(a);
        if (app.ui.copyText) await app.ui.copyText(report, url ? 'Error copied. Paste it into the report.' : 'Error copied. Send it to the add-in’s author.');
        if (url) mk.invoke('open-external', url).catch(() => {});
      } },
    ];
  }
  function problemToast(a, how) {
    toast(`${how === 'installed' ? `Installed “${a.name}”. ` : ''}Turn “${a.name}” off, or report it to its author: it didn’t start. Everything else works.`, { kind: how === 'installed' ? 'error' : 'warn', actions: problemActions(a) });
  }

  function setEnabled(id, on) {
    const a = state.list.find(x => x.id === id); if (!a) return;
    if (on && isBlocked(a)) {
      // the first store add-in turned on asks about community add-ins first
      enableCommunity().then(ok => { if (ok) setEnabled(id, true); });
      return;
    }
    a.enabled = !!on;
    const off = disabled(); if (on) off.delete(id); else off.add(id);
    setSetting('disabledAddons', [...off]);
    if (on && !a.running) { runEntry(a); if (a.error) problemToast(a); else toast(`“${a.name}” is on.`); }
    else if (!on && a.running) { removeStyles(a.id); state.needsReload = true; offerReload(`“${a.name}” turns off fully after a reload.`); }
    else if (on && a.running) { injectStyles(a); toast(`“${a.name}” is on.`); }
    else if (!on) removeStyles(a.id);
    refresh();
  }

  // ---------- community add-ins switch ----------
  /** Show the notice once and turn community add-ins on. Resolves true when they are on. */
  async function enableCommunity({ ask = true } = {}) {
    if (communityOn()) return true;
    if (ask) {
      const v = await app.ui.dialog({ title: 'Turn on community add-ins?', icon: 'puzzle', body: `<p>${esc(NOTICE)}</p>`,
        buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Turn on', value: 'on', primary: true }], cancelValue: 'cancel' });
      if (v !== 'on') return false;
    }
    setSetting(COMMUNITY, true);
    // store add-ins that were waiting start now
    let started = 0;
    for (const a of state.list) if (a.store && a.enabled && !a.running) { runEntry(a); if (a.running) started++; }
    refresh();
    app.events.emit('addins:community', true);
    return true;
  }
  function disableCommunity() {
    if (!communityOn()) return;
    setSetting(COMMUNITY, false);
    const running = state.list.filter(a => a.store && a.running);
    for (const a of state.list) if (a.store) { removeStyles(a.id); a.blocked = true; }
    if (running.length) { state.needsReload = true; offerReload('Community add-ins turn off fully after a reload.'); }
    refresh();
    app.events.emit('addins:community', false);
  }

  let reloadOffered = 0;
  async function offerReload(msg) {
    if (Date.now() - reloadOffered < 1500) return; reloadOffered = Date.now();
    const v = await app.ui.dialog({ title: 'Reload Markooj?', body: esc(msg) + '<br><br>Your open documents come back after the reload, including unsaved changes.', buttons: [{ label: 'Later', value: 'later' }, { label: 'Reload now', value: 'reload', primary: true }] });
    if (v === 'reload') reloadNow();
  }

  // ---------- reload that keeps the session ----------
  const SESSION_KEY = 'markooj-reload-session';
  async function reloadNow() {
    const docs = app.docs.list();
    const active = app.docs.active();
    const session = [];
    for (const d of docs) {
      if (d.kind !== 'markdown' && !d.path) continue;
      if (d.kind === 'markdown' && d.dirty) {
        try { await mk.invoke('recovery-save', { docId: d.recoveryId, path: d.path, title: d.title, text: d.text }); } catch {}
      }
      session.push({ path: d.path || null, title: d.title, dirty: !!d.dirty && d.kind === 'markdown', recoveryId: d.recoveryId, text: d.kind === 'markdown' && d.dirty ? d.text : undefined, active: d === active });
    }
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ at: Date.now(), mode: app.mode, docs: session })); } catch {}
    window.__mkReloading = true;
    location.reload();
  }
  async function restoreSession() {
    let s = null;
    try { s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); sessionStorage.removeItem(SESSION_KEY); } catch {}
    if (!s || !Array.isArray(s.docs) || Date.now() - s.at > 120000) return;
    const blank = app.docs.list().filter(d => !d.path && !d.dirty && !d.text);
    let activeId = null;
    for (const e of s.docs) {
      try {
        let d = null;
        if (e.path) d = await app.docs.open(e.path);
        if (e.dirty) {
          let text = e.text;
          if (text == null) { try { text = (await mk.invoke('recovery-get', e.recoveryId))?.text; } catch {} }
          if (text != null) {
            if (!d) { d = app.docs.create({ title: e.title, recoveryId: e.recoveryId }); }
            d.setText(text, 'recovery');
          }
        }
        if (d && e.active) activeId = d.id;
      } catch (err) { console.warn('Could not restore', e.path || e.title, err); }
    }
    for (const b of blank) if (app.docs.get(b.id) && app.docs.list().length > 1) app.docs.close(b.id, { force: true });
    if (activeId) app.docs.activate(activeId);
    if (s.mode) app.setMode?.(s.mode);
  }
  app.events.on('ready', () => { restoreSession(); });

  async function install() {
    let name = null;
    try { name = await mk.invoke('addon-install'); }
    catch (e) {
      if (/No handler/i.test(e.message)) toast('Use the Add-in store (File → Add-ins → Browse) to add add-ins. Installing from a file needs the desktop app.', { kind: 'warn', actions: [{ label: 'Browse add-ins', run: () => app.backstage.open('addins') }] });
      else app.ui.fail(e, { lead: 'Choose the add-in’s .js file again.', retry: () => install() });
      return;
    }
    if (!name) return;
    const id = String(name).replace(/\.js$/i, '');
    const was = state.list.find(x => x.id === id);
    const r = await fetchList();
    const x = (r.list || []).find(y => String(y.name).replace(/\.js$/i, '') === id && y.user) || (r.list || []).find(y => String(y.name).replace(/\.js$/i, '') === id);
    if (!x) { toast(`Installed ${name}.`); return; }
    const e = makeEntry(x);
    if (was?.running) { state.list = state.list.map(a => a.id === id ? { ...e, running: true } : a); state.needsReload = true; refresh(); offerReload(`“${e.name}” was updated. Reload to use the new version.`); return; }
    state.list = state.list.filter(a => a.id !== id).concat(e).sort((a, b) => a.name.localeCompare(b.name));
    const off = disabled(); off.delete(id); setSetting('disabledAddons', [...off]);
    runEntry(e);
    if (e.error) problemToast(e, 'installed');
    else toast(`Installed “${e.name}”.`);
    refresh();
  }
  async function openFolder() {
    let dir = state.dir;
    if (!dir) { try { dir = (await mk.invoke('user-addons'))?.dir; } catch {} }
    if (!dir) { toast('Use Install from file to add an add-in. The add-ins folder opens only in the desktop app.', { kind: 'warn' }); return; }
    try { await mk.invoke('open-folder', dir); } catch (e) { app.ui.fail(e, { lead: `Open this folder yourself: ${dir}`, actions: [{ label: 'Copy path', run: () => app.ui.copyText(dir, 'Path copied') }] }); }
  }

  // ---------- UI ----------
  function cardEl(a, { onToggle, onOpen } = {}) {
    const card = document.createElement('div');
    card.className = 'mka-card'; card.tabIndex = 0; card.setAttribute('role', 'button');
    card.title = [a.name, a.description, a.error ? 'Problem: ' + a.error : ''].filter(Boolean).join('\n');
    card.innerHTML = `<div class="mka-ic" style="background:${colorFor(a)}">${svg(a.icon)}</div><div class="mka-txt"><b>${esc(a.name)}</b><span>${esc(a.error ? 'Click to see why it didn’t start, or turn it off.' : a.enabled && isBlocked(a) ? 'Waits for community add-ins. Click for details.' : a.description || a.file)}</span></div>`;
    const tg = document.createElement('button');
    tg.className = 'mka-toggle' + (a.enabled ? ' on' : ''); tg.setAttribute('role', 'switch'); tg.setAttribute('aria-checked', String(a.enabled));
    tg.setAttribute('aria-label', (a.enabled ? 'Turn off ' : 'Turn on ') + a.name); tg.title = a.enabled ? 'On' : 'Off';
    tg.addEventListener('click', e => { e.stopPropagation(); onToggle?.(a); });
    card.append(tg);
    card.addEventListener('click', () => onOpen?.(a));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); onOpen?.(a); } else if (e.key === ' ') { e.preventDefault(); onToggle?.(a); } });
    return card;
  }

  const pageEls = new Set();
  /** File → Add-ins without the store (the store's Installed tab draws renderInstalled itself). */
  function renderPage(el) {
    if (app.addinStore?.renderPage) return app.addinStore.renderPage(el);
    el.textContent = '';
    const head = document.createElement('div'); head.className = 'mka-page';
    head.innerHTML = `<h2>Add-ins</h2><p class="sub">Add-ins add buttons, tools and Markdown features. Turn them on or off here.</p>`;
    const body = document.createElement('div');
    el.append(head, body);
    renderInstalled(body);
  }
  function verifiedBadge() { return `<span class="mka-ver" role="img" aria-label="Made by the Markooj team" data-tip="Made by the Markooj team" data-tip-d="The Markooj team made this add-in and keeps it up to date.">${svg('check')}</span>`; }
  function sourceChip(a) {
    if (a.store) return '<span class="mka-chip store">From the add-in store</span>';
    return `<span class="mka-chip${a.user ? ' user' : ''}">${a.user ? 'Installed by you' : 'Comes with Markooj'}</span>`;
  }
  function communitySwitch() {
    const row = document.createElement('div'); row.className = 'mka-switch';
    const on = communityOn();
    row.innerHTML = `<div><b>Community add-ins</b><small>${on ? 'On. Add-ins from the add-in store can run.' : 'Off. Add-ins from the add-in store stay off until you turn this on.'} ${esc(NOTICE.split('. ').slice(0, 1).join(''))}.</small></div>`;
    const tg = document.createElement('button');
    tg.className = 'mka-toggle' + (on ? ' on' : ''); tg.setAttribute('role', 'switch'); tg.setAttribute('aria-checked', String(on)); tg.setAttribute('aria-label', 'Community add-ins');
    tg.dataset.tip = 'Community add-ins'; tg.dataset.tipD = NOTICE;
    tg.dataset.act = 'community';
    tg.addEventListener('click', () => { if (communityOn()) disableCommunity(); else enableCommunity(); });
    row.append(tg);
    return row;
  }
  /** The Installed list: actions, the community switch, the reload banner, one card per add-in, the guide. */
  function renderInstalled(el) {
    pageEls.add(el);
    el.textContent = '';
    const page = document.createElement('div'); page.className = 'mka-page';
    const actions = document.createElement('div'); actions.className = 'mka-actions';
    const btn = (label, icon, fn, cls = '') => { const b = document.createElement('button'); b.className = 'mka-btn ' + cls; b.innerHTML = svg(icon) + esc(label); b.addEventListener('click', fn); return b; };
    actions.append(btn('Install from file…', 'addin-install', install, app.addinStore ? '' : 'primary'), btn('Open add-ins folder', 'open', openFolder));
    try { app.addinStore?.decorateActions?.(actions, btn); } catch (e) { console.error(e); }
    page.append(actions);
    page.append(communitySwitch());
    if (state.needsReload) {
      const ban = document.createElement('div'); ban.className = 'mka-banner';
      ban.innerHTML = `${svg('addin-reload')}<span>Reload Markooj to finish turning add-ins off or to use updated ones. Your documents come back after the reload.</span>`;
      ban.append(btn('Reload now', 'addin-reload', reloadNow, 'primary'));
      page.append(ban);
    }
    const grid = document.createElement('div'); grid.className = 'mka-grid';
    if (!state.loaded) grid.innerHTML = '<p class="sub">Loading add-ins…</p>';
    else if (!state.list.length) grid.innerHTML = '<p class="sub">No add-ins are installed. Install one from a .js file, or write your own (see below).</p>';
    for (const a of state.list) {
      const c = document.createElement('div'); c.className = 'mka-big';
      c.dataset.addin = a.id;
      c.innerHTML = `<div class="top"><div class="mka-ic" style="background:${colorFor(a)}">${svg(a.icon)}</div><div style="flex:1;min-width:0"><b>${esc(a.name)}${a.verified ? verifiedBadge() : ''}</b><small>${esc([a.version && 'Version ' + a.version, a.author].filter(Boolean).join(' · ') || a.file)}</small></div></div>
        <p>${esc(a.description || 'No description.')}</p>
        <div class="mka-foot">${sourceChip(a)}<span class="mka-chip">${esc(a.folder ? a.id + '/' : a.file)}</span><span class="grow"></span></div>`;
      if (a.error) {
        const er = document.createElement('div'); er.className = 'mka-err';
        er.textContent = 'Turn this add-in off, or report it to its author. Everything else works. It didn’t start: ' + a.error;
        const row = document.createElement('div'); row.className = 'mka-err-acts';
        for (const act of problemActions(a).filter(x => x.label !== 'Show error')) { const b = document.createElement('button'); b.type = 'button'; b.className = 'mka-mini'; b.textContent = act.label; b.addEventListener('click', ev => { ev.stopPropagation(); act.run(); }); row.append(b); }
        er.append(row); c.append(er);
      }
      else if (a.enabled && isBlocked(a)) {
        const n = document.createElement('div'); n.className = 'mka-note';
        n.innerHTML = '<span>Community add-ins are off, so this add-in does not run yet.</span>';
        const b = document.createElement('button'); b.className = 'mka-mini primary'; b.textContent = 'Turn on'; b.dataset.tip = 'Turn on community add-ins'; b.dataset.tipD = NOTICE;
        b.addEventListener('click', () => enableCommunity());
        n.append(b); c.append(n);
      }
      try { app.addinStore?.decorateCard?.(a, c); } catch (e) { console.error(e); }
      const tg = document.createElement('button');
      tg.className = 'mka-toggle' + (a.enabled ? ' on' : ''); tg.setAttribute('role', 'switch'); tg.setAttribute('aria-checked', String(a.enabled)); tg.setAttribute('aria-label', 'Turn ' + a.name + (a.enabled ? ' off' : ' on'));
      tg.addEventListener('click', () => setEnabled(a.id, !a.enabled));
      c.querySelector('.top').append(tg);
      grid.append(c);
    }
    page.append(grid);
    const sec = document.createElement('div'); sec.className = 'mka-sec'; sec.textContent = 'Write your own add-in';
    const guide = document.createElement('div'); guide.className = 'mka-guide';
    const example = `// @name Hello
// @description Says hello from the ribbon
// @version 1.0
// @author You
// @icon sparkle

app.commands.register('hello.say', {
  label: 'Say hello',
  run: () => app.ui.toast('Hello, ' + (app.docs.active()?.title || 'world') + '!'),
});
app.ribbon.addGroup('addins', {
  id: 'hello', label: 'Hello',
  items: [{ type: 'big', command: 'hello.say', label: 'Hello', icon: 'sparkle' }],
});`;
    guide.innerHTML = `<ol>
        <li>Create a plain text file ending in <b>.js</b>, for example <b>hello.js</b>.</li>
        <li>Start it with the comment lines below (name, description, icon). Icons: puzzle, sparkle, sigma, spell, count, cite, table, code, doc…</li>
        <li>Put it in the add-ins folder (or use <b>Install from file…</b>) and reload.</li>
      </ol>
      <pre>${esc(example)}</pre>
      <table>
        <tr><td>app.commands.register(id, {label, run})</td><td>A command for buttons, shortcuts, the command palette and macros.</td></tr>
        <tr><td>app.ribbon.addGroup('addins', {id, label, items})</td><td>Buttons on the Add-ins tab (or any other tab id).</td></tr>
        <tr><td>app.hooks.preRender(fn(text, doc))</td><td>Change the Markdown before it is shown. Return the new text.</td></tr>
        <tr><td>app.hooks.postRender(fn(el, doc))</td><td>Change the shown page after rendering (read-only decorations are safest).</td></tr>
        <tr><td>app.exporter.register({id, label, ext, run(doc, ctx)})</td><td>A new format on File → Save As. Return text or bytes; ctx has markdown, meta, html() and plainText().</td></tr>
        <tr><td>app.status.addItem({id, side, render(el)})</td><td>Add something to the status bar. Call app.status.refresh() to update it.</td></tr>
        <tr><td>app.options.addSection({id, label, render(el)})</td><td>Settings for your add-in under File → Options.</td></tr>
        <tr><td>app.events.on('doc:changed', fn)</td><td>React to edits. Also doc:active, doc:saved, ready.</td></tr>
        <tr><td>markooj.doc / markooj.ui</td><td>The same easy document API that macros use (doc.text, doc.insert, ui.toast…).</td></tr>
      </table>`;
    const copy = btn('Copy example', 'copy', async () => { await app.ui.copyText(example, 'Example copied.'); });
    copy.style.marginTop = '12px';
    guide.append(copy);
    page.append(sec, guide);
    el.append(page);
  }

  function refresh() {
    for (const el of [...pageEls]) { if (el.isConnected) renderInstalled(el); else pageEls.delete(el); }
    app.events.emit('ribbon:changed');
    app.events.emit('addons:changed', state.list);
  }

  // ---------- commands, ribbon, backstage ----------
  app.commands.register('dev.addins', { label: 'Manage add-ins', icon: 'puzzle', run: () => app.backstage.open('addins') });
  app.commands.register('dev.installAddin', { label: 'Install add-in from file…', icon: 'addin-install', run: () => install() });
  app.commands.register('dev.openAddinsFolder', { label: 'Open add-ins folder', icon: 'open', run: () => openFolder() });
  app.commands.register('addins.reload', { label: 'Reload add-ins (restarts the window)', icon: 'addin-reload', run: () => reloadNow() });

  app.ribbon.addGroup('addins', {
    id: 'addins-installed', label: 'Installed', order: 10, items: [{
      type: 'custom',
      render(el) {
        el.textContent = '';
        const row = document.createElement('div'); row.className = 'mka-row';
        if (!state.loaded) row.innerHTML = '<span class="mka-empty">Loading add-ins…</span>';
        else if (!state.list.length) row.innerHTML = '<span class="mka-empty">No add-ins yet. Click Install to add one.</span>';
        for (const a of state.list) row.append(cardEl(a, { onToggle: x => setEnabled(x.id, !x.enabled), onOpen: () => app.backstage.open('addins') }));
        el.append(row);
      },
    }],
  });
  app.ribbon.addGroup('addins', {
    id: 'addins-manage', label: 'Add-ins', order: 20, items: [
      { type: 'big', command: 'dev.installAddin', label: 'Install', icon: 'addin-install' },
      { type: 'big', command: 'dev.addins', label: 'Manage', icon: 'puzzle' },
      { type: 'big', command: 'dev.openAddinsFolder', label: 'Folder', icon: 'open' },
    ],
  });
  app.backstage.addPage({ id: 'addins', label: 'Add-ins', icon: 'puzzle', order: 80, render: renderPage });

  app.addons = {
    get list() { return state.list.slice(); },
    get dir() { return state.dir; },
    ready,
    load,
    parseHeader,
    setEnabled,
    isEnabled: id => !disabled().has(id),
    install,
    openFolder,
    reload: reloadNow,
    // folder add-ins and the add-in store
    rescan,
    renderInstalled,
    renderPage,
    get needsReload() { return state.needsReload; },
    community: { isOn: communityOn, enable: enableCommunity, disable: disableCommunity, key: COMMUNITY, notice: NOTICE },
    styles: { inject: injectStyles, remove: removeStyles, element: styleEl },
    colorFor,
    verifiedBadge,
    _test: { makeEntry, makeFolderEntry, runEntry, isBlocked, clearReload: () => { state.needsReload = false; refresh(); } },
  };

  // Start loading right away (core registries already exist); add-ins that need documents should listen for 'ready'.
  load().catch(e => { state.loaded = true; state.error = e.message; resolveReady([]); refresh(); });

  // ---------- smoke tests ----------
  const A = app.assert || ((c, m) => { if (!c) throw new Error('Assertion failed: ' + m); });
  app.tests.register('addons: header metadata parser', () => {
    const m = parseHeader('// @name Word Frequency\n// @description Top words table\n// @version 1.2\n// @author Markooj\n// @icon count\n\napp.commands.register("x", {});\n// @name Not this');
    A(m.name === 'Word Frequency' && m.description === 'Top words table' && m.version === '1.2' && m.author === 'Markooj' && m.icon === 'count', JSON.stringify(m));
    A(!parseHeader('const x = 1;\n// @name Late').name, 'stops at first code line');
    A(parseHeader('/**\n * @name Block\n */\nx()').name === 'Block', 'block comment headers');
  });
  app.tests.register('addons: loader finds the bundled add-ins', async () => {
    const list = await Promise.race([ready, new Promise((_, rej) => setTimeout(() => rej(new Error('add-ins did not load in 10 s')), 10000))]);
    A(list.length >= 3, 'at least 3 add-ins, got ' + list.length);
    const r = list.find(a => a.id === 'readability');
    A(r && r.name === 'Readability' && r.icon, 'readability header read');
    A(list.every(a => !a.error || !a.enabled), 'enabled add-ins started: ' + list.filter(a => a.error).map(a => a.id + ': ' + a.error).join('; '));
  });
  app.tests.register('addons: broken add-in does not crash', () => {
    const e = makeEntry({ name: 'broken.js', code: '// @name Broken\nthrow new Error("boom")' });
    A(runEntry(e) === false && /boom/.test(e.error), 'error captured');
  });
  app.tests.register('addons: folder add-in entry reads its manifest; store add-ins wait for the community switch', () => {
    const was = app.settings.get(COMMUNITY, false);
    try {
      const f = makeFolderEntry({ id: 'zz-test', dir: '/x/zz-test', manifest: { id: 'zz-test', name: 'ZZ Test', version: '1.2.3', author: 'Tester', description: 'd', icon: 'sparkle', color: '#123456' }, install: { source: 'store', verified: true }, code: 'window.__zzRan = (window.__zzRan || 0) + 1; window.__zzCtx = addin;', css: '.zz-test-x{color:red}' });
      A(f.folder && f.store && f.verified && f.version === '1.2.3' && f.author === 'Tester' && f.icon === 'sparkle' && f.file === 'zz-test/main.js', JSON.stringify(f));
      A(/#123456/.test(colorFor(f)), 'manifest color used');
      setSetting(COMMUNITY, false);
      window.__zzRan = 0;
      A(runEntry(f) === false && f.blocked && !f.error && !window.__zzRan && !styleEl('zz-test'), 'blocked while community add-ins are off');
      setSetting(COMMUNITY, true);
      A(runEntry(f) === true && window.__zzRan === 1 && window.__zzCtx.id === 'zz-test' && typeof window.__zzCtx.file === 'function', 'runs with the addin context once on');
      A(styleEl('zz-test')?.textContent === '.zz-test-x{color:red}', 'styles injected');
      removeStyles('zz-test'); A(!styleEl('zz-test'), 'styles removed');
      const plainFolder = makeFolderEntry({ id: 'zz-own', manifest: { name: 'Own' }, install: null, code: '' });
      setSetting(COMMUNITY, false);
      A(!isBlocked(plainFolder), 'a folder the user made is not a store add-in');
    } finally { setSetting(COMMUNITY, was); delete window.__zzRan; delete window.__zzCtx; }
  });
})();
