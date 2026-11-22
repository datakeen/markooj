// Markooj — add-in store: File → Add-ins with the tabs Installed | Browse | Language packs, one-click install, updates,
// the "Get add-ins" ribbon button and palette commands. Owner: store. Downloads, checks and files are in main-addins.js;
// the Installed list and the community switch are in addons.js; language packs reuse app.lang.packs.
(function () {
  'use strict';
  const app = window.app;
  if (!app || !app.addons) return;
  const mk = app.mk || window.mk || {};
  const invoke = (ch, ...a) => mk.invoke(ch, ...a);
  const esc = app.esc || (s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const toast = (m, o) => { try { return app.ui.toast(m, o); } catch { console.log('[toast]', m); } };
  const plainError = (e, fb) => (app.ui.plainError ? app.ui.plainError(e, fb) : String((e && e.message) || e || fb || 'Try that again.'));
  const svg = (name) => `<svg class="i" aria-hidden="true"><use href="#${name}"/></svg>`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const A = app.assert || ((c, m) => { if (!c) throw new Error('Assertion failed: ' + m); });

  const CATEGORIES = [['all', 'All'], ['writing', 'Writing'], ['research', 'Research'], ['math', 'Math'], ['languages', 'Languages'], ['export', 'Export'], ['productivity', 'Productivity'], ['developer', 'Developer'], ['fun', 'Fun'], ['other', 'Other']];
  const REGISTRY_URL = 'https://github.com/datakeen/markooj-addins';
  const TEMPLATE_URL = 'https://github.com/datakeen/markooj-addin-template';
  const LAST_CHECK = 'addins.lastCheck';
  const DAY = 24 * 60 * 60 * 1000;
  const NOTICE = app.addons.community?.notice || '';

  // ---------- state ----------
  const S = { tab: 'installed', index: null, loading: false, error: '', installed: [], query: '', category: 'all', details: null, readme: new Map(), busy: new Set(),
    packs: { index: null, loading: false, error: '', busy: new Set() } };
  const pages = new Set(); // rendered page roots

  // ---------- pure helpers (tested) ----------
  function parseVersion(v) { const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(String(v || '').trim()); return m ? { n: [+m[1], +m[2], +m[3]], pre: m[4] || '' } : null; }
  function compareVersions(a, b) {
    const x = parseVersion(a), y = parseVersion(b);
    if (!x || !y) return !x && !y ? 0 : !x ? -1 : 1;
    for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] < y.n[i] ? -1 : 1;
    if (x.pre === y.pre) return 0; if (!x.pre) return 1; if (!y.pre) return -1; return x.pre < y.pre ? -1 : 1;
  }
  /** Search by name, description, tags and author (every word must match somewhere), then filter by category.
   *  Names that start with the query come first, then names that contain it, then the rest; verified add-ins first on ties. */
  function filterAddins(list, query = '', category = 'all') {
    const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    const q = words.join(' ');
    const out = [];
    for (const a of list || []) {
      if (category && category !== 'all' && a.category !== category) continue;
      const hay = [a.name, a.description, a.author, a.id, ...(a.tags || [])].join(' ').toLowerCase();
      if (words.some(w => !hay.includes(w))) continue;
      const name = String(a.name || '').toLowerCase();
      const rank = !q ? 0 : name.startsWith(q) ? 0 : name.includes(q) ? 1 : (a.tags || []).some(t => t === q) ? 2 : 3;
      out.push([rank, a]);
    }
    out.sort((x, y) => x[0] - y[0] || (y[1].verified ? 1 : 0) - (x[1].verified ? 1 : 0) || String(x[1].name).localeCompare(String(y[1].name)));
    return out.map(x => x[1]);
  }
  /** The quiet daily check runs only with community add-ins on, at most once a day. */
  const shouldCheck = (now, last, on) => !!on && (!Number(last) || now - Number(last) >= DAY);
  const sizeText = n => (!n ? '' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  const dateText = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); };
  const catLabel = c => (CATEGORIES.find(x => x[0] === c) || [c, 'Other'])[1];
  function iconBg(a) {
    try { return app.addons.colorFor({ id: a.id, meta: { color: a.color } }); } catch { return 'linear-gradient(135deg,#0a84ff,#0a52e0)'; }
  }
  const iconHtml = (a, big) => `<div class="mks-ic${big ? ' big' : ''}" style="background:${iconBg(a)}" aria-hidden="true">${a.icon && document.getElementById(a.icon) ? svg(a.icon) : esc(String(a.name || a.id).trim().charAt(0).toUpperCase())}</div>`;
  const checkMark = () => `<span class="mks-check" role="img" aria-label="Made by the Markooj team" data-tip="Made by the Markooj team" data-tip-d="The Markooj team made this add-in and keeps it up to date.">${svg('check')}</span>`;

  // ---------- data ----------
  const installedOf = id => S.installed.find(x => x.id === id && x.source === 'store');
  const updates = () => S.installed.filter(a => a.update && a.compatible);
  function statusOf(e) {
    const have = installedOf(e.id);
    const folder = S.installed.find(x => x.id === e.id && x.source !== 'store');
    if (S.busy.has(e.id)) return { key: 'busy', label: have ? 'Updating…' : 'Installing…' };
    if (folder) return { key: 'taken', label: 'Folder in use', why: `An add-in folder named “${e.id}” is already in your add-ins folder.` };
    const tooNew = compareVersions(e.minMarkooj, app.version) > 0;
    if (have && compareVersions(e.version, have.version) > 0) return tooNew ? { key: 'old', label: 'Needs update', why: `Version ${e.version} needs Markooj ${e.minMarkooj} or newer.` } : { key: 'update', label: 'Update' };
    if (have) return { key: 'installed', label: 'Installed' };
    if (tooNew) return { key: 'old', label: `Needs ${e.minMarkooj}`, why: `Needs Markooj ${e.minMarkooj} or newer. This is Markooj ${app.version}.` };
    return { key: 'install', label: 'Install' };
  }
  async function refreshInstalled() {
    try { S.installed = (await invoke('addins-installed')) || []; } catch { S.installed = []; }
    app.events.emit('addins:updates', updates().length);
    return S.installed;
  }
  // A list that did not load: what to do first (network → check the connection), then what still works
  function listError(e, what) {
    const why = plainError(e, '');
    const known = app.ui.friendlyError?.(e);
    const plain = why && !known && !/\b(?:E[A-Z]{3,}|HTTP \d{3}|status \d{3}|undefined|null|TypeError)\b/.test(why);
    return (plain ? why : (known || 'Check your internet connection, then click Try again.')) + ` ${what}`;
  }
  async function loadIndex({ refresh = false } = {}) {
    S.loading = true; S.error = ''; rerender();
    try { S.index = await invoke('addins-index', { refresh }); }
    catch (e) { S.error = listError(e, 'Your installed add-ins keep working.'); S.errorDetails = app.ui.technicalText?.(e) || ''; }
    S.loading = false;
    await refreshInstalled();
    rerender();
    return S.index;
  }
  const entryOf = id => (S.index?.addins || []).find(a => a.id === id) || null;

  // ---------- actions ----------
  async function install(id) {
    const e = entryOf(id);
    const name = e ? e.name : id;
    // the notice comes first: nothing is downloaded until the user turned community add-ins on
    if (!(await app.addons.community.enable())) return null;
    S.busy.add(id); rerender();
    const wasInstalled = !!installedOf(id);
    let r = null;
    try {
      r = await invoke('addins-install', { id });
      const res = await app.addons.rescan();
      await refreshInstalled();
      const reload = { label: 'Reload add-ins now', run: () => app.addons.reload() };
      const started = app.addons.list.find(a => a.id === id);
      if (started?.error) toast(`Turn “${r.name}” off, or report it to its author: it installed but didn’t start. Everything else works.`, { kind: 'error', actions: [{ label: 'Turn it off', run: () => app.addons.setEnabled?.(id, false) }, { label: 'Show', run: () => open('installed') }, reload] });
      else if (wasInstalled || res.needsReload) toast(`Updated “${r.name}” to ${r.version}. Reload add-ins to use the new version.`, { kind: 'success', action: reload });
      else toast(`Installed “${r.name}”. It is on now.`, { kind: 'success', action: reload });
    } catch (err) {
      app.ui.fail(err, { lead: `Try installing “${name}” again.`, retry: () => install(id), still: 'Nothing was changed.' });
    } finally { S.busy.delete(id); rerender(); }
    return r;
  }
  async function uninstall(id) {
    const a = app.addons.list.find(x => x.id === id) || installedOf(id) || entryOf(id) || { name: id };
    const ok = await app.ui.confirm(`Uninstall “${a.name}”?`, 'The add-in moves to the trash. Your documents are not changed.', { ok: 'Uninstall', danger: true });
    if (!ok) return false;
    return uninstallNow(id, a.name);
  }
  async function uninstallNow(id, name = id) {
    try {
      await invoke('addins-uninstall', id);
      const res = await app.addons.rescan();
      await refreshInstalled();
      toast(`Uninstalled “${name}”.${res.needsReload ? ' It stops fully after a reload.' : ''}`, res.needsReload ? { action: { label: 'Reload add-ins now', run: () => app.addons.reload() } } : {});
      rerender();
      return true;
    } catch (err) { app.ui.fail(err, { lead: 'Close any document the add-in is using, then try Uninstall again.', retry: () => uninstallNow(id, name) }); return false; }
  }
  async function updateAll() {
    const n = updates().length;
    if (!n) { toast('All add-ins are up to date.'); return { updated: [], failed: [] }; }
    const t = toast(`Updating ${n === 1 ? 'one add-in' : n + ' add-ins'}…`, { kind: 'info', timeout: 0 });
    let r = { updated: [], failed: [] };
    try { r = await invoke('addins-update-all'); } catch (e) { r.failed.push({ id: '', error: plainError(e) }); }
    t?.close?.();
    const res = await app.addons.rescan();
    await refreshInstalled();
    const reload = { label: 'Reload add-ins now', run: () => app.addons.reload() };
    if (r.failed.length) toast(`Try Update all again${r.updated.length ? ` (${r.updated.length} updated)` : ''}. ${r.failed.length === 1 ? 'One add-in' : r.failed.length + ' add-ins'} didn’t update and still work${r.failed.length === 1 ? 's' : ''} in the old version: ${r.failed[0].error}`, { kind: 'error', actions: [{ label: 'Try again', run: () => updateAll() }, ...(r.updated.length ? [reload] : [])], details: r.failed.map(f => `${f.id || 'add-in'}: ${f.error}`).join('\n') });
    else toast(`Updated ${r.updated.length === 1 ? 'one add-in' : r.updated.length + ' add-ins'}.${res.needsReload ? ' Reload add-ins to use the new versions.' : ''}`, { kind: 'success', action: reload });
    rerender();
    return r;
  }
  /** Ask GitHub for the list and count updates. quiet: say nothing unless there are updates. */
  async function checkUpdates({ quiet = false } = {}) {
    try { app.settings.set(LAST_CHECK, Date.now()); } catch {}
    await loadIndex({ refresh: true });
    if (S.error) { if (!quiet) toast(S.error, { kind: 'warn', actions: [{ label: 'Try again', run: () => checkUpdates() }], details: S.errorDetails }); return -1; }
    const n = updates().length;
    if (n) toast(`${n === 1 ? 'An add-in update is' : n + ' add-in updates are'} ready.`, { kind: 'info', actions: [{ label: 'Update all', run: () => updateAll() }, { label: 'Show', run: () => open('installed') }] });
    else if (!quiet) toast(S.index?.offline ? 'Check your internet connection to look for updates. Until then Markooj shows the add-ins it saw last time.' : 'All add-ins are up to date.', S.index?.offline ? { kind: 'info', actions: [{ label: 'Try again', run: () => checkUpdates() }] } : {});
    return n;
  }
  function open(tab) { if (tab) S.tab = tab; S.details = null; app.backstage.open('addins'); }
  function openExternal(url) { invoke('open-external', url).catch(e => app.ui.fail(e, { lead: 'Open this address in your browser yourself.', hideReason: true, actions: [{ label: 'Copy link', run: () => app.ui.copyText?.(url, 'Link copied. Paste it into your browser.') }] })); }

  // ---------- page ----------
  function rerender() { for (const el of [...pages]) { if (el.isConnected) drawPage(el); else pages.delete(el); } }
  function renderPage(el) {
    pages.add(el);
    drawPage(el);
    // the first visit to Browse fetches the list (an explicit action, never at start-up)
  }
  const TABS = [['installed', 'Installed'], ['browse', 'Browse'], ['packs', 'Language packs']];
  function drawPage(el) {
    const keepFocus = document.activeElement && el.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
    el.textContent = '';
    const root = document.createElement('div'); root.className = 'mks';
    root.innerHTML = `<h2>Add-ins</h2><p class="sub">Add buttons, tools and languages to Markooj. Add-ins from the community install with one click.</p>`;
    const tabs = document.createElement('div'); tabs.className = 'mks-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Add-ins');
    const n = updates().length;
    for (const [id, label] of TABS) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mks-tab'; b.setAttribute('role', 'tab'); b.id = 'mks-tab-' + id;
      b.setAttribute('aria-selected', String(S.tab === id)); b.tabIndex = S.tab === id ? 0 : -1; b.dataset.tab = id; b.dataset.focusKey = 'tab-' + id;
      b.setAttribute('aria-controls', 'mks-panel');
      b.innerHTML = esc(label) + (id === 'installed' && n ? `<span class="mks-badge" aria-label="${n} update${n === 1 ? '' : 's'}">${n}</span>` : '');
      b.dataset.tip = label; b.dataset.tipD = id === 'installed' ? 'Add-ins on this computer: turn them on or off, update or uninstall them.' : id === 'browse' ? 'Find add-ins made by the community and install them with one click.' : 'Spelling and checks for more languages.';
      b.addEventListener('click', () => selectTab(id));
      tabs.append(b);
    }
    tabs.addEventListener('keydown', e => {
      const i = TABS.findIndex(t => t[0] === S.tab);
      const k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); selectTab(TABS[e.key === 'Home' ? 0 : TABS.length - 1][0], true); return; }
      if (!k) return;
      e.preventDefault(); selectTab(TABS[(i + k + TABS.length) % TABS.length][0], true);
    });
    const panel = document.createElement('div'); panel.className = 'mks-panel'; panel.id = 'mks-panel'; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', 'mks-tab-' + S.tab);
    root.append(tabs, panel);
    el.append(root);
    if (S.tab === 'browse') { if (S.details) drawDetails(panel); else drawBrowse(panel); }
    else if (S.tab === 'packs') drawPacks(panel);
    else app.addons.renderInstalled(panel);
    if (keepFocus) el.querySelector(`[data-focus-key="${keepFocus}"]`)?.focus({ preventScroll: true });
  }
  function selectTab(id, focus) {
    S.tab = id; if (id !== 'browse') S.details = null;
    rerender();
    if (focus) for (const el of pages) el.querySelector(`.mks-tab[data-tab="${id}"]`)?.focus({ preventScroll: true });
    if (id === 'browse' && !S.index && !S.loading) loadIndex();
    if (id === 'packs' && !S.packs.index && !S.packs.loading) loadPacks();
  }

  // ---------- Installed tab (addons.js draws it; these add store buttons) ----------
  function decorateActions(actions, btn) {
    const browse = btn('Browse add-ins', 'store', () => selectTab('browse'), 'primary');
    browse.dataset.tip = 'Browse add-ins'; browse.dataset.tipD = 'Find add-ins made by the community and install them with one click.';
    actions.prepend(browse);
    const n = updates().length;
    if (n) { const u = btn(`Update all (${n})`, 'refresh', () => updateAll(), 'primary'); u.dataset.act = 'update-all'; actions.insertBefore(u, browse.nextSibling); }
    const c = btn('Check for updates', 'refresh', () => checkUpdates());
    c.dataset.tip = 'Check add-in updates'; c.dataset.tipD = 'Ask GitHub for newer versions of the add-ins you installed from the store.';
    actions.append(c);
  }
  function decorateCard(a, card) {
    if (!a.store) return;
    const foot = card.querySelector('.mka-foot'); if (!foot) return;
    const info = installedOf(a.id);
    const mini = (label, cls, fn, tip, tipD) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mka-mini ' + cls; b.textContent = label; if (tip) { b.dataset.tip = tip; b.dataset.tipD = tipD; } b.addEventListener('click', fn); return b; };
    if (info?.update && info.compatible) foot.append(mini(`Update to ${info.latest}`, 'primary', () => install(a.id), 'Update', `Download version ${info.latest} from GitHub and install it.`));
    if (entryOf(a.id)) foot.append(mini('Details', '', () => { S.tab = 'browse'; S.details = a.id; rerender(); }, 'Details', 'Read about this add-in.'));
    const u = mini('Uninstall', 'danger', () => uninstall(a.id), 'Uninstall', 'Move this add-in to the trash.'); u.dataset.act = 'uninstall';
    foot.append(u);
  }

  // ---------- Browse tab ----------
  function statusLine() {
    const st = document.createElement('div');
    if (S.loading && !S.index) { st.className = 'mks-status'; st.textContent = 'Getting the add-in list from GitHub…'; return st; }
    const retry = () => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mks-btn'; b.textContent = 'Try again'; b.style.marginLeft = '8px'; b.addEventListener('click', () => loadIndex({ refresh: true })); return b; };
    if (S.error && !S.index) { st.className = 'mks-status err'; st.textContent = S.error; st.append(retry()); return st; }
    if (S.index?.offline) { st.className = 'mks-status warn'; st.textContent = `Check your internet connection to see new add-ins. Showing the list Markooj saw ${S.index.fetchedAt ? 'on ' + dateText(S.index.fetchedAt) : 'last time'}.`; st.append(retry()); return st; }
    return null;
  }
  function actionButton(e) {
    const s = statusOf(e);
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'mks-act' + (s.key === 'installed' ? ' installed' : s.key === 'busy' ? ' busy' : '');
    b.textContent = s.label; b.dataset.act = s.key; b.dataset.focusKey = 'act-' + e.id;
    b.setAttribute('aria-label', `${s.label} ${e.name}`);
    if (s.key === 'install' || s.key === 'update') {
      b.dataset.tip = `${s.label} ${e.name}`; b.dataset.tipD = 'Downloads from GitHub. Markooj checks every file (SHA-256) before installing.';
      b.addEventListener('click', ev => { ev.stopPropagation(); app.ui.ripple?.(b); install(e.id); });
    } else {
      b.disabled = s.key !== 'installed'; if (s.why) { b.dataset.tip = s.label; b.dataset.tipD = s.why; }
      b.addEventListener('click', ev => { ev.stopPropagation(); showDetails(e.id); });
    }
    return b;
  }
  function cardEl(e) {
    const c = document.createElement('div'); c.className = 'mks-card'; c.tabIndex = 0; c.setAttribute('role', 'button');
    c.dataset.id = e.id; c.dataset.focusKey = 'card-' + e.id;
    c.setAttribute('aria-label', `${e.name}${e.verified ? ', made by the Markooj team' : ''}, by ${e.author}. ${e.description}`);
    c.innerHTML = `${iconHtml(e)}<div class="mks-main"><div class="mks-name"><span>${esc(e.name)}</span>${e.verified ? checkMark() : ''}</div><div class="mks-by">${esc(e.author)}</div><div class="mks-desc" title="${esc(e.description)}">${esc(e.description)}</div><div class="mks-foot"><span class="mks-ver">Version ${esc(e.version)}</span><span class="grow"></span></div></div>`;
    c.querySelector('.mks-foot').append(actionButton(e));
    c.addEventListener('click', () => showDetails(e.id));
    c.addEventListener('keydown', ev => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === c) { ev.preventDefault(); showDetails(e.id); } });
    return c;
  }
  function drawGrid(grid) {
    grid.textContent = '';
    const list = filterAddins(S.index?.addins || [], S.query, S.category);
    if (!S.index) return;
    if (!S.index.addins.length) { grid.innerHTML = `<div class="mks-empty">No add-ins are listed yet. Write the first one: start from the add-in template on GitHub.</div>`; return; }
    if (!list.length) { grid.innerHTML = `<div class="mks-empty">No add-ins match${S.query ? ` “${esc(S.query)}”` : ''}${S.category !== 'all' ? ` in ${esc(catLabel(S.category))}` : ''}.</div>`; return; }
    for (const e of list) grid.append(cardEl(e));
  }
  function drawBrowse(panel) {
    const bar = document.createElement('div'); bar.className = 'mks-bar';
    const search = document.createElement('label'); search.className = 'mks-search';
    search.innerHTML = svg('search');
    const input = document.createElement('input'); input.type = 'search'; input.placeholder = 'Search add-ins'; input.value = S.query; input.spellcheck = false;
    input.setAttribute('aria-label', 'Search add-ins by name, description, tags or author'); input.dataset.focusKey = 'search';
    search.append(input);
    const mkBtn = (label, icon, fn, cls, tip, tipD) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mks-btn ' + (cls || ''); b.innerHTML = (icon ? svg(icon) : '') + esc(label); if (tip) { b.dataset.tip = tip; b.dataset.tipD = tipD; } b.addEventListener('click', fn); return b; };
    const refreshBtn = mkBtn(S.loading ? 'Checking…' : 'Check again', 'refresh', () => loadIndex({ refresh: true }), '', 'Check again', 'Get the newest add-in list from GitHub.');
    refreshBtn.disabled = S.loading; refreshBtn.dataset.focusKey = 'refresh';
    bar.append(search, refreshBtn);
    const n = updates().length;
    if (n) { const u = mkBtn(`Update all (${n})`, 'refresh', () => updateAll(), 'primary', 'Update all add-ins', 'Install the newest version of every add-in that has an update.'); u.dataset.act = 'update-all'; bar.append(u); }
    const submit = mkBtn('Submit an add-in', 'external', () => openExternal(TEMPLATE_URL), '', 'Submit an add-in', 'Opens the add-in template on GitHub in your browser: write an add-in and list it in the store.');
    bar.append(submit);
    panel.append(bar);
    const chips = document.createElement('div'); chips.className = 'mks-chips'; chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Categories');
    for (const [id, label] of CATEGORIES) {
      const c = document.createElement('button'); c.type = 'button'; c.className = 'mks-chip'; c.textContent = label; c.dataset.cat = id; c.dataset.focusKey = 'cat-' + id;
      c.setAttribute('aria-pressed', String(S.category === id));
      c.addEventListener('click', () => { S.category = id; for (const x of chips.children) x.setAttribute('aria-pressed', String(x.dataset.cat === id)); drawGrid(grid); });
      chips.append(c);
    }
    panel.append(chips);
    const st = statusLine(); if (st) panel.append(st);
    const grid = document.createElement('div'); grid.className = 'mks-grid'; grid.setAttribute('aria-live', 'polite');
    panel.append(grid);
    drawGrid(grid);
    let t = 0;
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { S.query = input.value; drawGrid(grid); }, 80); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape' && input.value) { e.preventDefault(); e.stopPropagation(); input.value = ''; S.query = ''; drawGrid(grid); }
      else if (e.key === 'Enter') { e.preventDefault(); S.query = input.value; drawGrid(grid); grid.querySelector('.mks-card')?.focus(); }
    });
  }

  // ---------- details ----------
  function showDetails(id) { S.tab = 'browse'; S.details = id; rerender(); for (const el of pages) el.querySelector('.mks-back')?.focus({ preventScroll: true }); }
  function backToList() { const id = S.details; S.details = null; rerender(); if (id) for (const el of pages) el.querySelector(`.mks-card[data-id="${id}"]`)?.focus({ preventScroll: true }); }
  function drawDetails(panel) {
    const e = entryOf(S.details);
    const back = document.createElement('button'); back.type = 'button'; back.className = 'mks-back'; back.innerHTML = svg('back') + 'All add-ins'; back.dataset.focusKey = 'back';
    back.dataset.tip = 'All add-ins'; back.dataset.tipD = 'Back to the list.'; back.dataset.key = 'Escape';
    back.addEventListener('click', backToList);
    panel.append(back);
    panel.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !ev.defaultPrevented) { ev.preventDefault(); backToList(); } });
    if (!e) { const p = document.createElement('div'); p.className = 'mks-empty'; p.textContent = 'This add-in is no longer in the list.'; panel.append(p); return; }
    const hero = document.createElement('div'); hero.className = 'mks-hero';
    hero.innerHTML = `${iconHtml(e, true)}<div class="mks-main"><h3>${esc(e.name)}${e.verified ? checkMark() : ''}</h3><p>${esc(e.author)}</p><p>${esc(e.description)}</p><div class="acts"></div></div>`;
    const acts = hero.querySelector('.acts');
    const s = statusOf(e);
    const btn = (label, cls, fn, tip, tipD) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mks-btn ' + cls; b.textContent = label; if (tip) { b.dataset.tip = tip; b.dataset.tipD = tipD; } b.addEventListener('click', fn); return b; };
    if (s.key === 'install' || s.key === 'update') { const b = btn(s.label, 'primary', () => install(e.id), `${s.label} ${e.name}`, 'Downloads from GitHub. Markooj checks every file (SHA-256) before installing.'); b.dataset.act = s.key; acts.append(b); }
    else { const b = btn(s.label, '', () => {}, s.label, s.why || 'This add-in is installed.'); b.disabled = true; b.dataset.act = s.key; acts.append(b); }
    if (installedOf(e.id)) { const u = btn('Uninstall', 'danger', () => uninstall(e.id), 'Uninstall', 'Move this add-in to the trash.'); u.dataset.act = 'uninstall'; acts.append(u); }
    acts.append(btn('Project page', '', () => openExternal(e.homepage || `https://github.com/${e.repo}`), 'Project page', 'Opens the add-in’s page on GitHub in your browser.'));
    panel.append(hero);
    const cols = document.createElement('div'); cols.className = 'mks-cols';
    const readme = document.createElement('article'); readme.className = 'mks-readme'; readme.setAttribute('aria-label', 'About ' + e.name);
    const facts = document.createElement('dl'); facts.className = 'mks-facts';
    const have = installedOf(e.id);
    const rows = [['Version', e.version + (have && have.version !== e.version ? ` (you have ${have.version})` : '')], ['Size', sizeText(e.size)], ['Category', catLabel(e.category)], ['Needs', 'Markooj ' + e.minMarkooj + ' or newer'],
      ['Updated', dateText(e.updatedAt)], ['Author', e.author], ['Made by', e.verified ? 'The Markooj team' : 'The community'], ['Also does', e.permissions]].filter(r => r[1]);
    facts.innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd title="${esc(v)}">${esc(v)}</dd></div>`).join('')
      + `<div><dt>Repository</dt><dd><a class="mks-link" href="#" data-href="https://github.com/${esc(e.repo)}" data-tip="${esc(e.repo)}" data-tip-d="Opens the source code on GitHub in your browser.">${esc(e.repo)}</a></dd></div>`
      + (e.tags?.length ? `<div><dt>Tags</dt><dd title="${esc(e.tags.join(', '))}">${esc(e.tags.join(', '))}</dd></div>` : '');
    facts.addEventListener('click', ev => { const a = ev.target.closest('a[data-href]'); if (a) { ev.preventDefault(); openExternal(a.dataset.href); } });
    cols.append(readme, facts);
    panel.append(cols);
    fillReadme(readme, e);
  }
  async function readmeOf(e) {
    if (!S.readme.has(e.id)) {
      const p = invoke('addins-readme', { id: e.id }).catch(err => { S.readme.delete(e.id); throw err; });
      S.readme.set(e.id, p);
    }
    return S.readme.get(e.id);
  }
  /** README links: relative ones point into the repository; every click opens the browser. */
  function fixLinks(root, e) {
    const base = `https://github.com/${e.repo}/blob/${encodeURIComponent(e.tag)}/`;
    for (const a of root.querySelectorAll('a[href]')) {
      const h = a.getAttribute('href') || '';
      if (h.startsWith('#')) continue;
      let abs = ''; try { abs = new URL(h, base).href; } catch {}
      a.dataset.href = /^https?:/i.test(abs) ? abs : ''; a.setAttribute('href', '#'); a.removeAttribute('target');
      if (a.dataset.href) a.title = a.dataset.href;
    }
    root.addEventListener('click', ev => {
      const a = ev.target.closest('a'); if (!a) return;
      ev.preventDefault();
      if (a.dataset.href) openExternal(a.dataset.href);
    });
  }
  async function fillReadme(el, e) {
    el.innerHTML = '<p class="mks-empty" style="padding:0">Loading the description…</p>';
    try {
      const text = await readmeOf(e);
      if (!el.isConnected) return;
      const r = mk.render ? mk.render(String(text || '')) : { html: esc(text) };
      // a README is a stranger's page: cleaned in an inert template first, so nothing in it loads before it is cleaned.
      // No forms (a fake sign-in would post to the browser), frames or other controls (task-list check boxes stay);
      // addin-store.css keeps the rest inside its box
      const tpl = document.createElement('template'); tpl.innerHTML = r.html || '';
      const frag = tpl.content;
      frag.querySelectorAll('[contenteditable]').forEach(x => x.removeAttribute('contenteditable'));
      frag.querySelectorAll('form, iframe, frame, object, embed, button, select, textarea, input:not([type="checkbox"])').forEach(x => x.remove());
      frag.querySelectorAll('input').forEach(x => { x.disabled = true; x.removeAttribute('name'); });
      el.textContent = ''; el.append(frag);
      // pictures from the web follow the app's privacy setting, like documents
      if (app.settings.get('remoteImages', false) !== true) el.querySelectorAll('img[src^="http" i], img[src^="//"]').forEach(img => img.classList.add('mk-remote-off'));
      fixLinks(el, e);
      el.dataset.loaded = '1';
    } catch (err) {
      if (!el.isConnected) return;
      el.innerHTML = `<p class="mks-empty" style="padding:0">${esc(e.description)}</p><p class="mks-status">${esc(listError(err, 'The short description above is all Markooj has for now.'))}</p>`;
    }
  }

  // ---------- Language packs tab (app.lang does the work) ----------
  async function loadPacks() {
    if (!app.lang?.packs) return;
    S.packs.loading = true; S.packs.error = ''; rerender();
    try { S.packs.index = await app.lang.packs.index(); } catch (e) { S.packs.error = listError(e, 'You can also install a pack from a file. Installed languages keep working.'); }
    try { await app.lang.packs.list(); } catch {}
    S.packs.loading = false; rerender();
  }
  function drawPacks(panel) {
    const P = app.lang?.packs;
    if (!P) { panel.innerHTML = '<div class="mks-empty">Restart Markooj to use language packs. The language tools did not load this time.</div>'; return; }
    const head = document.createElement('div'); head.className = 'mks-bar';
    const mkBtn = (label, icon, fn, cls, tip, tipD) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mks-btn ' + (cls || ''); b.innerHTML = (icon ? svg(icon) : '') + esc(label); if (tip) { b.dataset.tip = tip; b.dataset.tipD = tipD; } b.addEventListener('click', fn); return b; };
    const chk = mkBtn(S.packs.loading ? 'Checking…' : S.packs.index ? 'Check again' : 'Check for language packs', 'refresh', () => loadPacks(), 'primary', 'Check for language packs', 'Ask GitHub which language packs are available.');
    chk.disabled = S.packs.loading; chk.dataset.focusKey = 'packs-check';
    head.append(chk,
      mkBtn('Install from file…', 'open', () => app.commands.run('lang.installFromFile'), '', 'Install from file', 'Install a language pack (.zip) you downloaded. Every file is checked first.'),
      mkBtn('Language options', 'lang', () => app.lang.openOptions?.(), '', 'Language options', 'Proofing language and fonts for right-to-left languages.'));
    panel.append(head);
    const installed = P.installed();
    const sec = (t) => { const s = document.createElement('div'); s.className = 'mks-sec'; s.textContent = t; return s; };
    panel.append(sec('On this computer'));
    const mine = document.createElement('div'); mine.className = 'mks-packs';
    mine.append(packRow({ code: 'en', name: 'English (US and UK)', nativeName: '', version: '' }, { builtIn: true }));
    for (const p of installed) mine.append(packRow(p, { installed: true }));
    panel.append(mine);
    panel.append(sec('Available on GitHub'));
    const avail = document.createElement('div'); avail.className = 'mks-packs';
    if (S.packs.loading && !S.packs.index) avail.innerHTML = '<div class="mks-status">Getting the language pack list from GitHub…</div>';
    else if (S.packs.error) { avail.innerHTML = `<div class="mks-status err">${esc(S.packs.error)} <button type="button" class="mks-btn" data-act="retry">Try again</button></div>`; avail.querySelector('[data-act=retry]').addEventListener('click', () => loadPacks()); }
    else if (!S.packs.index) avail.innerHTML = '<div class="mks-empty">Urdu, Arabic, Punjabi (Shahmukhi) and Persian packs come from the Markooj language packs on GitHub. Click Check for language packs.</div>';
    else if (!S.packs.index.packs.length) avail.innerHTML = '<div class="mks-empty">Check again later, or install a pack from a file. None are published yet.</div>';
    else for (const p of S.packs.index.packs) avail.append(packRow(p, { available: true, have: installed.find(x => x.code === p.code) }));
    panel.append(avail);
  }
  function packRow(p, o = {}) {
    const row = document.createElement('div'); row.className = 'mks-pack'; row.dataset.code = p.code;
    const facts = o.builtIn ? 'Spelling and grammar, built in.' : [p.version && 'Version ' + p.version, p.size && sizeText(p.size), p.words != null && `${Number(p.words).toLocaleString('en-US')} words`, p.license].filter(Boolean).join(' · ');
    row.innerHTML = `<div class="mks-ic" aria-hidden="true">${esc((p.nativeName || p.code).slice(0, 2))}</div><div class="mks-main"><b>${esc(p.name)}${p.nativeName ? `<span class="nat" dir="auto">${esc(p.nativeName)}</span>` : ''}</b><small>${esc(facts)}</small></div>`;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mks-act';
    if (o.builtIn) { b.textContent = 'Built in'; b.className += ' installed'; b.disabled = true; }
    else if (o.installed) {
      b.textContent = 'Remove'; b.dataset.tip = `Remove ${p.name}`; b.dataset.tipD = 'Delete this language pack from this computer. You can install it again later.';
      b.addEventListener('click', async () => {
        if (!(await app.ui.confirm(`Remove ${p.name}?`, 'The language pack is deleted from this computer. Documents in this language keep their text, direction and fonts.', { ok: 'Remove', danger: true }))) return;
        try { await app.lang.packs.remove(p.code); toast(`${p.name} language pack removed.`); } catch (e) { app.ui.fail(e, { lead: `Close any document that uses ${p.name}, then try Remove again.`, retry: () => app.lang.packs.remove(p.code).then(rerender) }); }
        rerender();
      });
    } else {
      const newer = o.have && String(o.have.version) !== String(p.version);
      const busy = S.packs.busy.has(p.code);
      b.textContent = busy ? 'Installing…' : !o.have ? 'Install' : newer ? 'Update' : 'Installed';
      if (o.have && !newer) { b.className += ' installed'; b.disabled = true; }
      else if (busy) { b.className += ' busy'; b.disabled = true; }
      else {
        b.dataset.tip = `${b.textContent} ${p.name}`; b.dataset.tipD = 'Download from GitHub and install. Markooj checks the SHA-256 before installing.';
        b.addEventListener('click', async () => {
          S.packs.busy.add(p.code); rerender();
          try { const r = await app.lang.packs.install({ url: p.url }); toast(`${r.name || p.name} language pack installed.`); }
          catch (e) { app.ui.fail(e, { lead: `Try installing ${p.name} again, or install it from a file.`, retry: () => app.lang.packs.install({ url: p.url }).then(r => { toast(`${r.name || p.name} language pack installed.`); rerender(); }), actions: [{ label: 'Install from file', run: () => app.commands.run('lang.installFromFile') }], still: 'Installed languages keep working.' }); }
          S.packs.busy.delete(p.code); rerender();
        });
      }
    }
    row.append(b);
    return row;
  }

  // ---------- commands, ribbon, page ----------
  const TIPS = {
    'addins.browse': ['Get add-ins', 'Browse add-ins made by the community and install them with one click.'],
    'addins.checkUpdates': ['Check add-in updates', 'Ask GitHub for newer versions of the add-ins you installed from the store.'],
    'addins.updateAll': ['Update all add-ins', 'Install the newest version of every add-in that has an update.'],
    'addins.languagePacks': ['Get language packs', 'Spelling and checks for Urdu, Arabic, Punjabi (Shahmukhi), Persian and more.'],
  };
  app.commands.register('addins.browse', { label: 'Browse add-ins', icon: 'store', description: TIPS['addins.browse'][1], run: () => { open('browse'); if (!S.index && !S.loading) loadIndex(); } });
  app.commands.register('addins.checkUpdates', { label: 'Check add-in updates', icon: 'refresh', description: TIPS['addins.checkUpdates'][1], run: () => checkUpdates() });
  app.commands.register('addins.updateAll', { label: 'Update all add-ins', icon: 'refresh', description: TIPS['addins.updateAll'][1], run: async () => { if (!S.index) await loadIndex({ refresh: true }); else await refreshInstalled(); return updateAll(); } });
  app.commands.register('addins.languagePacks', { label: 'Get language packs', icon: 'lang', description: TIPS['addins.languagePacks'][1], run: () => { open('packs'); if (!S.packs.index && !S.packs.loading) loadPacks(); } });
  for (const [id, [title, description]] of Object.entries(TIPS)) { try { app.tooltips?.register?.(id, { title, description }); } catch {} }
  app.ribbon.addGroup('addins', {
    id: 'addins-store', label: 'Store', order: 5, items: [
      { type: 'big', command: 'addins.browse', label: 'Get add-ins', icon: 'store' },
      { type: 'big', command: 'addins.checkUpdates', label: 'Updates', icon: 'refresh' },
    ],
  });
  // File → Add-ins with tabs (addons.js keeps the Installed list and falls back to it without this file)
  app.backstage.addPage({ id: 'addins', label: 'Add-ins', icon: 'puzzle', order: 80, render: renderPage });
  app.events.on('addons:changed', () => { for (const el of pages) if (el.isConnected && S.tab !== 'installed') drawPage(el); });
  app.events.on('lang:packs', () => { if (S.tab === 'packs') rerender(); });
  app.events.on('backstage:hidden', () => { S.details = null; });

  // ---------- the quiet daily update check (community add-ins on only; no network otherwise) ----------
  let quietTimer = 0;
  async function maybeQuietCheck() {
    let smoke = !!window.__mkSmokeStarted;
    try { smoke = smoke || (await invoke('app-info'))?.userDataFrom === 'smoke'; } catch {}
    if (smoke) return false;
    if (!shouldCheck(Date.now(), app.settings.get(LAST_CHECK, 0), app.addons.community.isOn())) return false;
    if (!app.addons.list.some(a => a.store)) { try { app.settings.set(LAST_CHECK, Date.now()); } catch {} return false; }
    await checkUpdates({ quiet: true });
    return true;
  }
  app.events.on('ready', () => {
    refreshInstalled();
    clearTimeout(quietTimer);
    quietTimer = setTimeout(maybeQuietCheck, 45000);
    setInterval(maybeQuietCheck, 6 * 60 * 60 * 1000);
  });

  app.addinStore = {
    renderPage, open, selectTab, install, uninstall, updateAll, checkUpdates, loadIndex, refreshInstalled, showDetails,
    decorateCard, decorateActions, filterAddins, compareVersions, shouldCheck, categories: CATEGORIES.slice(1).map(c => c[0]),
    get state() { return S; }, get updates() { return updates(); },
  };

  // ======================================================================== smoke tests (no network)
  const enc = new TextEncoder();
  const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
  async function asset(repo, tag, name, text) {
    const bytes = enc.encode(text);
    return { name, url: `https://github.com/${repo}/releases/download/${tag}/${name}`, size: bytes.length, sha256: hex(await crypto.subtle.digest('SHA-256', bytes)), b64: b64(bytes) };
  }
  const T = { id: 'zz-store-test', repo: 'datakeen/markooj-addin-zz-store-test', cmd: 'zzstore.hello' };
  const mainJs = v => `app.commands.register('${T.cmd}', { label: 'ZZ store hello', description: 'A command from the store smoke test add-in.', palette: false, run: () => { window.__zzStoreHello = '${v}'; } });\nwindow.__zzStoreLoaded = (window.__zzStoreLoaded || 0) + 1;\nwindow.__zzStoreCtx = addin;`;
  const CSS_TEXT = '.zz-store-probe{outline:3px solid rgb(1, 2, 3)}';
  /** A mocked registry: index.json, the release assets and a README, served by main's smoke-only download stub. */
  async function buildMock({ version = '1.0.0', extra = [] } = {}) {
    const files = {}; const addins = [];
    const add = async (o) => {
      const tag = 'v' + o.version;
      const manifest = { id: o.manifestId || o.id, name: o.name, version: o.manifestVersion || o.version, minMarkooj: o.minMarkooj || '1.0.0', author: o.author || 'Markooj smoke test', description: o.description || 'Test add-in.', icon: 'sparkle', color: '#5e5ce6', category: o.category || 'productivity', files: o.files ? o.files.map(f => ({ name: f.name, size: enc.encode(f.text).length })) : undefined, ...(o.manifestExtra || {}) };
      const list = [await asset(o.repo, tag, 'manifest.json', JSON.stringify(manifest)), await asset(o.repo, tag, 'main.js', o.main || mainJs(o.version))];
      if (o.css) list.push(await asset(o.repo, tag, 'styles.css', o.css));
      for (const f of o.files || []) list.push(await asset(o.repo, tag, f.name, f.text));
      for (const a of list) files[a.url] = a.b64;
      if (o.readme) files[`https://raw.githubusercontent.com/${o.repo}/${tag}/README.md`] = b64(enc.encode(o.readme));
      const assets = list.map(({ name, url, size, sha256 }) => ({ name, url, size, sha256 }));
      if (o.breakSha) assets.find(a => a.name === 'main.js').sha256 = '0'.repeat(64);
      addins.push({ id: o.id, name: o.name, author: manifest.author, description: manifest.description, repo: o.repo, category: o.category || 'productivity', tags: o.tags || [], verified: true, version: o.version, minMarkooj: o.minMarkooj || '1.0.0', tag, assets, readmeUrl: `https://raw.githubusercontent.com/${o.repo}/${tag}/README.md`, homepage: `https://github.com/${o.repo}`, updatedAt: '2026-11-22T00:00:00Z' });
    };
    await add({ id: T.id, name: 'ZZ Store Test', repo: T.repo, version, css: CSS_TEXT, tags: ['smoke', 'probe'], files: [{ name: 'words.txt', text: 'alpha\nbeta\n' }], readme: '# ZZ Store Test\n\nA [link](https://example.com/) and a [relative one](docs/x.md).\n\n- one\n- two' });
    for (const o of extra) await add(o);
    return { files, index: { format: 1, updated: '2026-11-22T00:00:00Z', addins } };
  }
  const mock = async (o) => invoke('addins-test-mock', o);
  async function clickDialog(re, ms = 3000) {
    for (let t = 0; t < ms; t += 50) {
      // the newest dialog that this helper has not answered yet (a closing one stays in the page for a moment)
      const dlg = [...document.querySelectorAll('.dlg:not([data-zz-answered])')].pop();
      const b = dlg && [...dlg.querySelectorAll('button')].find(x => re.test(x.textContent.trim()));
      if (b) { dlg.dataset.zzAnswered = '1'; b.click(); await sleep(60); return true; }
      await sleep(50);
    }
    return false;
  }
  async function cleanup() {
    try { for (const id of [T.id, 'zz-bad-sha', 'zz-bad-manifest', 'zz-too-new', 'zz-community']) { try { await invoke('addins-uninstall', id); } catch {} } } catch {}
    try { await app.addons.rescan(); } catch {}
    try { app.commands.unregister?.(T.cmd); } catch {}
    try { await mock(null); } catch {}
    await refreshInstalled();
    app.addons._test.clearReload?.();
    delete window.__zzStoreHello; delete window.__zzStoreLoaded; delete window.__zzStoreCtx;
  }
  const hasMock = async () => { try { await mock(null); return true; } catch { return false; } };

  app.tests.register('store: search, category filter and version order', () => {
    const list = [
      { id: 'cite-helper', name: 'Cite Helper', description: 'Insert citations quickly', author: 'Ana', category: 'research', tags: ['bibtex', 'apa'] },
      { id: 'word-sprint', name: 'Word Sprint', description: 'Timed writing', author: 'Bo', category: 'writing', tags: ['goals'], verified: true },
      { id: 'matrix-kit', name: 'Matrix Kit', description: 'Matrices and word problems', author: 'Cy', category: 'math', tags: ['latex'] },
    ];
    A(filterAddins(list).length === 3, 'no filter keeps all');
    A(filterAddins(list, 'bibtex').map(a => a.id).join() === 'cite-helper', 'tags searched');
    A(filterAddins(list, 'bo').map(a => a.id).join() === 'word-sprint', 'author searched');
    A(filterAddins(list, 'word').map(a => a.id).join() === 'word-sprint,matrix-kit', 'name match ranks before description match: ' + filterAddins(list, 'word').map(a => a.id));
    A(filterAddins(list, 'timed WRITING').length === 1, 'every word must match, any case');
    A(filterAddins(list, '', 'math').map(a => a.id).join() === 'matrix-kit', 'category');
    A(filterAddins(list, 'word', 'math').map(a => a.id).join() === 'matrix-kit', 'search inside a category');
    A(!filterAddins(list, 'nothing-like-this').length, 'no match');
    A(compareVersions('1.10.0', '1.9.9') > 0 && compareVersions('1.1.0', '1.1.0') === 0 && compareVersions('1.1.0-beta', '1.1.0') < 0 && compareVersions('2.0.0', '10.0.0') < 0, 'semver order');
    A(shouldCheck(Date.now(), 0, true) && !shouldCheck(Date.now(), Date.now() - 1000, true) && shouldCheck(Date.now(), Date.now() - DAY - 1, true) && !shouldCheck(Date.now(), 0, false), 'once a day, only with community add-ins on');
  });

  app.tests.register('store: install from a mocked registry (notice, checks, command, styles, update, uninstall)', async () => {
    if (!(await hasMock())) throw new Error('addins-test-mock is not available (smoke mode only)');
    const wasCommunity = app.addons.community.isOn();
    const wasOff = app.settings.get('disabledAddons', []);
    try {
      await cleanup();
      const bad = [
        { id: 'zz-bad-sha', name: 'ZZ Bad Sha', repo: 'someone/zz-bad-sha', version: '1.0.0', breakSha: true },
        { id: 'zz-bad-manifest', name: 'ZZ Bad Manifest', repo: 'someone/zz-bad-manifest', version: '1.0.0', manifestId: 'something-else' },
        { id: 'zz-too-new', name: 'ZZ Too New', repo: 'someone/zz-too-new', version: '1.0.0', minMarkooj: '99.0.0' },
        // a community add-in may not take the place of one that comes with Markooj (a folder wins over a file)
        { id: 'readability', name: 'Readability', repo: 'someone/readability', version: '1.0.0' },
      ];
      const m1 = await buildMock({ extra: bad });
      const info = await mock({ ...m1, clearCache: true });
      A(info && /markooj-addins\/releases\/download\/index\/index\.json$/.test(info.indexUrl), 'index URL: ' + JSON.stringify(info));
      const idx = await invoke('addins-index', { refresh: true });
      A(idx.source === 'github' && idx.addins.length === 5, 'mocked index read: ' + JSON.stringify(idx).slice(0, 200));
      const e = idx.addins.find(a => a.id === T.id);
      A(e.verified && e.size > 0 && e.assets.length === 4 && /raw\.githubusercontent\.com\/datakeen\//.test(e.readmeUrl), 'entry normalized: ' + JSON.stringify(e).slice(0, 300));
      A(idx.addins.find(a => a.id === 'zz-bad-sha').verified === false, 'only datakeen repositories get the check mark');

      // refused installs leave nothing behind
      const refuse = async (id, re) => { let err = null; try { await invoke('addins-install', { id }); } catch (x) { err = x; } A(err && re.test(plainError(err) + ' ' + ((mk.errorInfo && mk.errorInfo(err)?.details) || '')), `${id} refused: ${err && err.message}`); };
      await refuse('zz-bad-sha', /SHA-256/);
      await refuse('zz-bad-manifest', /manifest.*something-else/i);
      await refuse('zz-too-new', /needs Markooj 99\.0\.0/);
      await refuse('readability', /comes with Markooj/);
      const folders = await invoke('addins-folder-list');
      A(!folders.some(f => /^zz-(bad|too)|^readability$/.test(f.id)) && app.addons.list.find(a => a.id === 'readability' && !a.folder), 'nothing written for refused add-ins: ' + folders.map(f => f.id));
      let hostErr = null; try { await invoke('addins-readme', 'https://evil.example.com/README.md'); } catch (x) { hostErr = x; }
      A(hostErr && /GitHub/.test(plainError(hostErr)), 'README only from raw.githubusercontent.com');

      // the first install asks about community add-ins; Cancel installs nothing
      app.settings.set('addins.community', false);
      await loadIndex();
      let p = install(T.id);
      A(await clickDialog(/^Cancel$/), 'the community notice was shown');
      A((await p) === null, 'cancelled');
      A(!(await invoke('addins-installed')).some(a => a.id === T.id), 'not installed after Cancel');
      p = install(T.id);
      const dlgText = await (async () => { for (let i = 0; i < 60; i++) { const d = [...document.querySelectorAll('.dlg:not([data-zz-answered]) .dlg-body')].pop(); if (d) return d.textContent; await sleep(50); } return ''; })();
      A(/same rights as Markooj/.test(dlgText) && /check mark/.test(dlgText), 'notice text: ' + dlgText);
      A(await clickDialog(/^Turn on$/), 'Turn on');
      const r = await p;
      A(r && r.id === T.id && r.version === '1.0.0', 'installed: ' + JSON.stringify(r));
      A(app.addons.community.isOn(), 'community add-ins are on');

      // the folder add-in runs: command, addin context, data file, styles
      const a = app.addons.list.find(x => x.id === T.id);
      A(a && a.folder && a.store && a.verified && a.running && !a.error, 'loaded from its folder: ' + JSON.stringify(a && { ...a, code: undefined, css: undefined }));
      await app.commands.run(T.cmd);
      A(window.__zzStoreHello === '1.0.0', 'its command runs');
      A(window.__zzStoreCtx?.id === T.id && (await window.__zzStoreCtx.file('words.txt')) === 'alpha\nbeta\n', 'addin.file reads a listed data file');
      const st = app.addons.styles.element(T.id);
      A(st && st.textContent === CSS_TEXT, 'styles.css injected');
      const probe = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'zz-store-probe' }));
      A(/rgb\(1, 2, 3\)/.test(getComputedStyle(probe).outlineColor), 'styles apply');
      const inst = (await invoke('addins-installed')).find(x => x.id === T.id);
      A(inst && inst.source === 'store' && inst.version === '1.0.0' && !inst.update, 'listed as installed: ' + JSON.stringify(inst));

      // turning it off removes its styles at once; on again brings them back
      app.addons.setEnabled(T.id, false);
      await clickDialog(/^Later$/, 1500);
      A(!app.addons.styles.element(T.id) && !/rgb\(1, 2, 3\)/.test(getComputedStyle(probe).outlineColor), 'styles removed when turned off');
      app.addons.setEnabled(T.id, true);
      A(app.addons.styles.element(T.id), 'styles back when turned on');
      probe.remove();

      // the Installed tab shows it with its version, the check mark and Uninstall
      app.backstage.open('addins'); await sleep(250);
      selectTab('installed'); await sleep(200);
      const ip = [...pages].find(x => x.isConnected);
      const ic = ip && ip.querySelector(`.mka-big[data-addin="${T.id}"]`);
      A(ic && /Version 1\.0\.0/.test(ic.textContent) && ic.querySelector('.mka-ver') && ic.querySelector('[data-act="uninstall"]') && /add-in store/.test(ic.textContent), 'Installed card: ' + (ic && ic.textContent));
      try { await invoke('smoke-shot', 'addin-installed'); } catch {}
      // the Browse tab: cards, search, a category, details with the README
      selectTab('browse'); await sleep(250);
      const page = [...pages].find(x => x.isConnected);
      A(page && page.querySelectorAll('.mks-card').length === 5, 'five cards: ' + (page && page.querySelectorAll('.mks-card').length));
      const card = page.querySelector(`.mks-card[data-id="${T.id}"]`);
      A(card.querySelector('.mks-check') && card.querySelector('[data-act="installed"]'), 'verified badge and Installed button');
      A(page.querySelector('.mks-card[data-id="zz-too-new"] [data-act="old"]')?.disabled, 'too-new add-in cannot be installed');
      const input = page.querySelector('.mks-search input');
      input.value = 'probe'; input.dispatchEvent(new Event('input')); await sleep(200);
      A(page.querySelectorAll('.mks-card').length === 1, 'search by tag');
      input.value = ''; input.dispatchEvent(new Event('input')); await sleep(200);
      page.querySelector('.mks-chip[data-cat="math"]').click();
      A(!page.querySelectorAll('.mks-card').length && /No add-ins match/.test(page.querySelector('.mks-grid').textContent), 'empty category');
      page.querySelector('.mks-chip[data-cat="all"]').click();
      try { await invoke('smoke-shot', 'addin-store'); } catch {}
      page.querySelector(`.mks-card[data-id="${T.id}"]`).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      let rd = null; for (let i = 0; i < 60 && !(rd = page.querySelector('.mks-readme[data-loaded]')); i++) await sleep(50);
      A(rd && rd.querySelector('h1')?.textContent === 'ZZ Store Test' && rd.querySelectorAll('li').length === 2, 'README rendered: ' + (rd && rd.innerHTML.slice(0, 200)));
      A(rd.querySelector('a[data-href="https://github.com/datakeen/markooj-addin-zz-store-test/blob/v1.0.0/docs/x.md"]'), 'relative README links point into the repository');
      A(page.querySelector('.mks-back') && page.querySelector('[data-act="uninstall"]'), 'details has Back and Uninstall');
      try { await invoke('smoke-shot', 'addin-details'); } catch {}
      page.querySelector('.mks-panel').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(80);
      A(!S.details && page.isConnected && page.querySelector('.mks-grid'), 'Esc goes back to the list and File stays open');

      // an update: the badge, Update all, then a reload is needed for the running add-in
      const m2 = await buildMock({ version: '1.1.0' });
      await mock(m2);
      A((await checkUpdates({ quiet: true })) === 1, 'one update found');
      A(updates().length === 1 && page.querySelector('.mks-tab[data-tab="installed"] .mks-badge')?.textContent === '1', 'badge shows the count');
      const ua = await updateAll();
      A(ua.updated.length === 1 && ua.updated[0].version === '1.1.0' && !ua.failed.length, 'updated: ' + JSON.stringify(ua));
      A(!updates().length && app.addons.needsReload, 'no updates left; reload offered for the running add-in');
      const inst2 = (await invoke('addins-installed')).find(x => x.id === T.id);
      A(inst2.version === '1.1.0', 'new version on disk');

      // offline: the last good list is still there
      await mock({ offline: true });
      const off = await invoke('addins-index', { refresh: true });
      A(off.offline && off.source === 'cache' && off.addins.some(x => x.id === T.id) && /offline/i.test(off.error), 'offline browsing from the cache: ' + JSON.stringify(off).slice(0, 160));

      // uninstall: only store folders; the folder goes, its styles go
      let uerr = null; try { await invoke('addins-uninstall', 'readability'); } catch (x) { uerr = x; }
      A(uerr, 'a bundled add-in cannot be uninstalled through the store');
      A(await uninstallNow(T.id, 'ZZ Store Test'), 'uninstalled');
      A(!(await invoke('addins-folder-list')).some(f => f.id === T.id) && !app.addons.list.some(x => x.id === T.id) && !app.addons.styles.element(T.id), 'folder, entry and styles gone');
    } finally {
      await cleanup();
      app.settings.set('addins.community', wasCommunity);
      app.settings.set('disabledAddons', wasOff);
      S.index = null; S.details = null; S.query = ''; S.category = 'all'; S.tab = 'installed'; S.readme.clear();
      app.backstage.close();
    }
  });

  app.tests.register('store: community switch gates store add-ins; ribbon, palette and Language packs tab', async () => {
    const was = app.addons.community.isOn();
    try {
      // the switch on the Installed tab asks first, and Cancel keeps it off
      app.settings.set('addins.community', false);
      app.backstage.open('addins'); await sleep(250);
      selectTab('installed'); await sleep(150);
      const page = [...pages].find(x => x.isConnected);
      const sw = page.querySelector('[data-act="community"]');
      A(sw && sw.getAttribute('aria-checked') === 'false', 'switch shown, off');
      sw.click();
      A(await clickDialog(/^Cancel$/), 'notice shown');
      A(!app.addons.community.isOn(), 'still off after Cancel');
      page.querySelector('[data-act="community"]').click();
      A(await clickDialog(/^Turn on$/), 'notice shown again');
      A(app.addons.community.isOn() && page.querySelector('[data-act="community"]').getAttribute('aria-checked') === 'true', 'on');
      // ribbon button and palette commands
      const groups = app.ribbon.tabs().find(t => t.id === 'addins').groups;
      A(groups.some(g => g.items.some(i => i.command === 'addins.browse' && i.label === 'Get add-ins')), 'Get add-ins on the Add-ins tab');
      for (const id of ['addins.browse', 'addins.checkUpdates']) { const i = app.tooltips?.info?.(id); A(app.commands.get(id) && i && i.title && i.description, id + ' has a ScreenTip'); }
      A(app.commands.get('addins.browse').label === 'Browse add-ins' && app.commands.get('addins.checkUpdates').label === 'Check add-in updates', 'palette names');
      // Language packs tab reuses app.lang (a list is set first, so the test never asks GitHub)
      S.packs.index = { packs: [] };
      selectTab('packs'); await sleep(200);
      const pp = [...pages].find(x => x.isConnected);
      A(pp.querySelector('.mks-pack[data-code="en"]') && pp.querySelector('[data-focus-key="packs-check"]'), 'packs tab drawn');
      // keyboard: arrows move between tabs
      pp.querySelector('.mks-tab[data-tab="packs"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      A(S.tab === 'browse', 'ArrowLeft selects Browse');
    } finally {
      app.settings.set('addins.community', was);
      S.tab = 'installed'; S.packs.index = null;
      app.backstage.close();
    }
  });

  // An add-in's README is a stranger's page shown before anything is installed: it must stay inside its box (a fixed
  // overlay could cover the window and pose as a Markooj dialog) and carry no forms or frames.
  app.tests.register('store: a README stays inside its box and keeps no forms or frames', async () => {
    const host = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'mks' }));
    host.style.cssText = 'position:absolute;left:40px;top:40px;width:320px;height:200px;';
    const el = host.appendChild(Object.assign(document.createElement('article'), { className: 'mks-readme' }));
    const e = { id: 'zz-readme-check', repo: 'someone/zz-readme-check', tag: 'v1.0.0', description: 'x' };
    S.readme.set(e.id, Promise.resolve('# T\n\n<div class="zz-cover" style="position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483647;background:red">Turn on</div>\n\n<form action="https://evil.example/"><input name="token"><button>Send</button></form>\n\n<iframe src="https://evil.example/"></iframe>\n\n<select><option>a</option></select><textarea>t</textarea>\n'));
    try {
      await fillReadme(el, e);
      const cover = el.querySelector('.zz-cover');
      if (cover) {
        const r = cover.getBoundingClientRect(), b = el.getBoundingClientRect();
        const hit = document.elementFromPoint(Math.min(innerWidth - 5, b.right + 60), Math.min(innerHeight - 5, b.bottom + 60));
        A(r.left >= b.left - 1 && r.top >= b.top - 1 && !(hit && cover.contains(hit)), `overlay stays in the README box: ${JSON.stringify([r.left, r.top, r.width, r.height])} in ${JSON.stringify([b.left, b.top, b.width, b.height])}`);
      }
      A(!el.querySelector('form, iframe, frame, button, select, textarea, input:not([type="checkbox"])'), 'no forms or frames: ' + el.innerHTML.slice(0, 300));
    } finally { host.remove(); S.readme.delete(e.id); }
  });

  // The real sample add-in from a markooj-addin-template checkout next to the app folder (development copies only),
  // listed the way the registry lists it: install it, run its command and its exporter, then uninstall it.
  app.tests.register('store: the template\'s Abbreviations add-in installs from a registry-style list, runs and uninstalls', async () => {
    let rel = null; try { rel = await invoke('addins-test-template'); } catch {}
    if (!rel) return; // no template checkout (packaged copy): nothing to test here
    const id = rel.index.addins[0].id;
    const wasCommunity = app.addons.community.isOn();
    let doc = null;
    try {
      await cleanup();
      try { await invoke('addins-uninstall', id); } catch {}
      await mock({ ...rel, clearCache: true });
      app.settings.set('addins.community', true);
      const idx = await loadIndex();
      const e = idx && idx.addins.find(a => a.id === id);
      A(e && e.verified && e.assets.map(a => a.name).slice(0, 2).join() === 'manifest.json,main.js' && e.icon === 'table' && e.color, 'listed: ' + JSON.stringify(e).slice(0, 300));
      const r = await install(id);
      A(r && r.id === id && r.version === e.version, 'installed: ' + JSON.stringify(r));
      const a = app.addons.list.find(x => x.id === id);
      A(a && a.folder && a.store && a.running && !a.error, 'running from its folder: ' + JSON.stringify(a && { ...a, code: undefined, css: undefined }));
      A(app.addons.styles.element(id), 'its styles.css is loaded');
      A(app.commands.get('abbreviations.insert')?.description, 'its command is registered with a ScreenTip');
      doc = app.docs.create({ title: 'Abbreviations test', text: 'The sediment delivery ratio (SDR) and the Water Resources Board (WRB) agree.\n' });
      await sleep(300);
      await app.commands.run('abbreviations.insert');
      let ok = false; for (let i = 0; i < 40 && !ok; i++) { ok = /\| SDR \| sediment delivery ratio \|/.test(doc.text) && /\| WRB \| Water Resources Board \|/.test(doc.text); if (!ok) await sleep(50); }
      A(ok, 'the command inserted the table: ' + JSON.stringify(doc.text));
      const csv = app.exporter.custom().find(x => x.id === 'abbreviations-csv');
      A(csv && /"SDR","sediment delivery ratio"/.test(String(await csv.run(doc, { markdown: doc.text }))), 'its CSV exporter works');
      const inst = (await invoke('addins-installed')).find(x => x.id === id);
      A(inst && inst.source === 'store' && inst.version === e.version && !inst.update, 'listed as installed: ' + JSON.stringify(inst));
      A(await uninstallNow(id, e.name), 'uninstalled');
      A(!(await invoke('addins-folder-list')).some(f => f.id === id) && !app.addons.list.some(x => x.id === id) && !app.addons.styles.element(id), 'folder, entry and styles gone');
    } finally {
      if (doc) { try { await app.docs.close(doc.id, { force: true }); } catch {} }
      try { await invoke('addins-uninstall', id); } catch {}
      // its code stays loaded until a reload: take away what it added so later tests and screenshots do not see it
      try { app.ribbon.removeGroup('addins', 'abbreviations'); app.commands.unregister('abbreviations.insert'); app.status.removeItem('abbreviations'); app.options.removeSection('abbreviations'); app.exporter.unregister('abbreviations-csv'); } catch {}
      await cleanup();
      app.settings.set('addins.community', wasCommunity);
      S.index = null; S.details = null;
    }
  });
})();
