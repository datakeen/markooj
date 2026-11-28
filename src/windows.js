// Markooj — more than one window (View → Window): New Window, Open in New Window, Arrange All, Switch Windows
// (Ctrl+F6 / Ctrl+Shift+F6), and the live link that keeps a document the same in every window that shows it.
//
// How the link works (main-windows.js has the other half): every Markdown document joins a shared entry in main,
// by its file path or, for a document that was never saved, by a key. While a second window shows the same
// document, each change is sent to main with the version it started from; main merges changes that crossed and
// sends the result to the other windows. Saving from either window saves the shared text and tells the other
// window, so neither one later sees a false "changed on disk" warning. Text two windows change at the very same
// spot is never thrown away: the replaced text goes to File → Recover.
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const mk = app.mk;
  const SYNC = 'window-sync';
  let params; try { params = new URLSearchParams(location.search); } catch { params = new URLSearchParams(''); }
  const isExtra = params.get('mkwin') === '1';
  const links = new Map(); // doc.id → {key, version, ack, peers, inflight, stash, timer, joining}
  let pendingKey = null, applying = 0, applyingSaved = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const toast = (m, o) => app.ui?.toast?.(m, o);

  function merge3(base, theirs, mine) {
    if (theirs === base) return mine;
    if (mine === base || mine === theirs) return theirs;
    const span = (a, b) => { let s = 0; const n = Math.min(a.length, b.length); while (s < n && a[s] === b[s]) s++; let e = 0; while (e < n - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++; return { s, e: a.length - e, ins: b.slice(s, b.length - e) }; };
    const t = span(base, theirs), m = span(base, mine);
    if (t.e <= m.s) return base.slice(0, t.s) + t.ins + base.slice(t.e, m.s) + m.ins + base.slice(m.e);
    if (m.e <= t.s) return base.slice(0, m.s) + m.ins + base.slice(m.e, t.s) + t.ins + base.slice(t.e);
    return null;
  }
  const real = d => (d && app.docs.get(d.id)) || d;
  const byKey = key => { for (const [id, L] of links) if (L.key === key) return app.docs.get(id) || null; return null; };
  function applyText(doc, text) {
    applying++;
    try { doc.setText(text, SYNC); } finally { applying--; }
  }
  function keepCopy(doc, text, why) {
    // two windows changed the same words at the same moment: the other window's version goes to File → Recover
    const id = `window-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    mk.invoke('recovery-save', { docId: id, path: doc.path, title: `${doc.title} (${why})`, text }).then(() => mk.invoke('recovery-mark-closed', id)).catch(() => {});
  }

  // ---------- joining ----------
  function join(doc, key) {
    doc = real(doc);
    if (!doc || doc.kind !== 'markdown') return Promise.resolve(null);
    let L = links.get(doc.id); if (L) return L.joining;
    L = { key: null, version: 0, ack: doc.text, peers: 1, inflight: false, stash: null, timer: 0 };
    links.set(doc.id, L);
    const sent = doc.text;
    const usePath = doc.path && !doc.convertedFrom ? doc.path : null;
    L.joining = Promise.resolve()
      .then(() => mk.invoke('win-doc-join', { key: key || null, path: key ? null : usePath, text: sent, title: doc.title, savedText: doc.savedText, mtime: doc.mtime ?? null }))
      .then(r => {
        if (!r || links.get(doc.id) !== L) return null;
        L.key = r.key; L.version = r.version; L.peers = r.peers || 1;
        if (r.joined && typeof r.text === 'string') {
          // another window has this document open: its live text wins (it may hold changes that are not saved yet)
          L.ack = r.text;
          if (r.savedText != null) doc.savedText = r.savedText;
          if (r.mtime != null) doc.mtime = r.mtime;
          if (r.text !== doc.text) applyText(doc, r.text);
          else { doc.dirty = doc.text !== doc.savedText; app.events.emit('doc:changed', { doc, origin: SYNC }); }
        } else L.ack = sent;
        if (doc.text !== L.ack) schedule(doc);
        return L;
      })
      .catch(e => { console.warn('windows: link', e); if (links.get(doc.id) === L) links.delete(doc.id); return null; });
    return L.joining;
  }

  // ---------- sending and receiving ----------
  function schedule(doc) {
    doc = real(doc);
    const L = links.get(doc?.id); if (!L) return;
    clearTimeout(L.timer);
    // alone: nothing to send (New Window sends the latest text itself, and a window that joins later makes this
    // window send at once through win-doc-peers); shared: right away
    if (L.peers <= 1) return;
    L.timer = setTimeout(() => send(doc), 0);
  }
  async function send(doc) {
    const L = links.get(doc.id); if (!L || !L.key) return;
    if (L.inflight) return; // the answer sends again when the text moved on
    const text = doc.text;
    if (text === L.ack) return;
    L.inflight = true;
    let r = null;
    try { r = await mk.invoke('win-doc-edit', { key: L.key, base: L.version, text }); }
    catch (e) { console.warn('windows: send', e); }
    finally { L.inflight = false; }
    if (links.get(doc.id) !== L || !r) return;
    if (r.missing) { links.delete(doc.id); join(doc); return; } // main lost the entry (a reload): join again
    L.version = r.version;
    const merged = r.text != null ? r.text : text;
    L.ack = merged;
    if (r.text != null) {
      const cur = doc.text;
      let next = cur === text ? merged : merge3(text, merged, cur);
      if (next == null) { keepCopy(doc, merged, 'other window'); next = cur; }
      if (next !== cur) applyText(doc, next);
    }
    const st = L.stash; L.stash = null;
    if (st && st.version > L.version) onUpdate(st);
    if (doc.text !== L.ack) schedule(doc);
  }
  function onUpdate(u) {
    const doc = byKey(u.key); if (!doc) return;
    const L = links.get(doc.id);
    if (L.inflight) { if (!L.stash || u.version > L.stash.version) L.stash = u; return; }
    if (u.version <= L.version) return;
    const cur = doc.text;
    let next = cur === L.ack ? u.text : merge3(L.ack, u.text, cur);
    if (next == null) { keepCopy(doc, u.text, 'other window'); next = cur; }
    L.version = u.version; L.ack = u.text;
    if (next !== cur) applyText(doc, next);
    if (doc.text !== L.ack) schedule(doc);
  }
  mk.on?.('win-doc-update', onUpdate);
  mk.on?.('win-doc-peers', ({ key, peers } = {}) => {
    const doc = byKey(key); if (!doc) return;
    const L = links.get(doc.id); L.peers = peers || 1;
    if (L.peers > 1 && doc.text !== L.ack) schedule(doc);
    app.events.emit('windows:peers', { doc, peers: L.peers });
  });
  mk.on?.('win-doc-saved', (o = {}) => {
    const doc = byKey(o.key); if (!doc) return;
    if (o.path && o.path !== doc.path) {
      doc.path = o.path; doc.convertedFrom = null;
      doc.ext = String(o.ext || o.path.split('.').pop() || 'md').toLowerCase();
      doc.title = o.title || o.path.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
    }
    if (o.savedText != null) doc.savedText = o.savedText;
    if (o.mtime != null) doc.mtime = o.mtime;
    doc.dirty = doc.text !== doc.savedText;
    applyingSaved++;
    try { app.events.emit('doc:saved', doc); } finally { applyingSaved--; }
  });

  app.events.on('doc:opened', doc => { if (doc?.kind === 'markdown') join(doc, pendingKey); });
  app.events.on('doc:changed', ({ doc, origin } = {}) => {
    if (!doc || applying || origin === SYNC) return;
    if (links.has(doc.id)) schedule(doc);
  });
  app.events.on('doc:saved', doc => {
    if (!doc || applyingSaved) return;
    const L = links.get(doc.id); if (!L?.key) return;
    mk.invoke('win-doc-saved', { key: L.key, path: doc.path, title: doc.title, ext: doc.ext, savedText: doc.savedText, mtime: doc.mtime ?? null }).catch(() => {});
  });
  app.events.on('doc:closed', doc => {
    const L = links.get(doc?.id); if (!L) return;
    clearTimeout(L.timer); links.delete(doc.id);
    if (L.key) mk.invoke('win-doc-leave', L.key).catch(() => {});
  });

  /** Is this document open in another Markooj window too? Then closing it here loses nothing. */
  function sharedElsewhere(doc) { const L = links.get(doc?.id); return !!(L && L.key && L.peers > 1); }
  /** Waits until main has this window's latest text for the document. */
  async function sendNow(doc) {
    const L = links.get(doc.id); if (!L) return;
    clearTimeout(L.timer);
    for (let i = 0; i < 100 && L.inflight; i++) await sleep(20);
    await send(doc);
  }

  // Closing this window (app.js onRequestClose asks first): a document another window still shows, and that window is
  // not closing too, loses nothing here, so the close prompt leaves it out. The last keystrokes reach main before the
  // answer. Main answers the windows one at a time, so when two windows close at once ("Close all windows" on the
  // taskbar, signing out) exactly one of them keeps the document and asks about it.
  async function prepareClose() {
    try { app.editors.active()?.flush?.(); } catch {}
    const shared = app.docs.list().filter(d => sharedElsewhere(d));
    if (!shared.length) return new Set();
    for (const d of shared) { try { await sendNow(d); } catch {} }
    let r = null;
    try { r = await mk.invoke('win-doc-closing', true); } catch { return new Set(); }
    const keys = new Set((r && r.keys) || []);
    return new Set(shared.filter(d => keys.has(links.get(d.id)?.key)).map(d => d.id));
  }
  /** The close was cancelled (Cancel, or a save failed): this window counts as open again. */
  function closeCancelled() { return mk.invoke('win-doc-closing', false).catch(() => {}); }

  // ---------- a window opened with New Window ----------
  async function bootExtra() {
    const key = params.get('link'), mode = params.get('mode');
    if (mode && app.modes.includes(mode)) app.setMode(mode);
    if (!key) return;
    let r = null;
    try { r = await mk.invoke('win-doc-get', key); } catch {}
    if (!r) { toast(app.t('Open the document again from File → Open. It was closed in the other window before this one was ready.'), { kind: 'warn', actions: [{ label: app.t('Open…'), run: () => app.commands.run('file.open') }] }); return; }
    const blank = app.docs.list().filter(d => !d.path && !d.dirty && !d.text);
    pendingKey = r.key;
    let doc;
    try { doc = app.docs.create({ text: r.text, path: r.path || null, title: r.title, ext: r.path ? r.path.split('.').pop() : 'md' }); }
    finally { pendingKey = null; }
    doc.savedText = r.savedText != null ? r.savedText : (r.path ? r.text : '');
    if (r.mtime != null) doc.mtime = r.mtime;
    doc.dirty = doc.text !== doc.savedText;
    app.events.emit('doc:changed', { doc, origin: SYNC });
    for (const b of blank) if (b.id !== doc.id) app.docs.close(b.id, { force: true });
  }
  if (isExtra) app.events.on('ready', () => { bootExtra().catch(e => console.error('windows: boot', e)); });

  // ---------- commands ----------
  async function openWin(o) {
    let r;
    try { r = await mk.invoke('win-new', o); }
    catch (e) { app.ui.fail(e, { lead: app.t('Restart Markooj and try New Window again. Your documents in this window are safe.'), hideReason: true, retry: () => openWin(o) }); return null; }
    return r;
  }
  async function newWindow() {
    const doc = app.docs.active();
    try { app.editors.active()?.flush?.(); } catch {}
    if (!doc || doc.kind !== 'markdown') return openWin(doc?.path ? { path: doc.path } : {});
    await join(doc);
    const L = links.get(doc.id);
    if (!L?.key) { toast(app.t('Try New Window again in a moment. Markooj is still getting this document ready.'), { kind: 'warn', actions: [{ label: app.t('Try again'), run: () => app.commands.run('view.newWindow') }] }); return null; }
    await sendNow(doc);
    const r = await openWin({ key: L.key, mode: app.mode });
    if (r && !app.tests?.current) toast(app.t('“{title}” is open in a second window too. Typing in either window shows up in both.', { title: doc.title }), { kind: 'info', actions: [{ label: app.t('Arrange side by side'), run: () => app.commands.run('view.arrangeAll') }] });
    return r;
  }
  async function openInNewWindow(path) {
    if (!path) { const list = await mk.invoke('open-dialog', { title: app.t('Open in a new window') }); path = list && list[0]; }
    if (!path) return null;
    return openWin({ path, mode: app.mode });
  }
  async function list() { try { return await mk.invoke('win-list'); } catch { return []; } }
  async function switchWindows(args) {
    const wins = await list();
    if (wins.length < 2) { toast(app.t('Open a second window with View → New Window. This is the only Markooj window right now.'), { kind: 'info', actions: [{ label: app.t('New Window'), run: () => app.commands.run('view.newWindow') }] }); return; }
    const anchor = (args && args.anchor) || [...document.querySelectorAll('[data-tip-cmd="view.switchWindows"]')].find(x => x.offsetParent) || { x: innerWidth / 2 - 120, y: 120 };
    app.ui.menu(anchor, [{ header: app.t('Markooj windows') }, ...wins.map((w, i) => ({ label: w.current ? app.t('{number}. {title} (this window)', { number: i + 1, title: w.title || 'Markooj' }) : `${i + 1}. ${w.title || 'Markooj'}`, checked: w.current, run: () => mk.invoke('win-focus', w.id) }))], { checks: true });
  }
  const C = (id, def) => app.commands.register(id, { category: 'View', ...def });
  C('view.newWindow', { label: app.tm('New Window'), icon: 'mkw-newwin', description: app.tm('Open this document in a second window. Typing in either window shows up in the other at once, and saving from either one saves the same text.'), run: newWindow });
  C('view.openInNewWindow', { label: app.tm('Open in New Window…'), icon: 'mkw-newwin', description: app.tm('Choose a file and open it in a window of its own, for example to see two documents on two screens.'), run: a => openInNewWindow(a && a.path) });
  C('view.arrangeAll', { label: app.tm('Arrange All'), icon: 'mkw-arrange', description: app.tm('Place every Markooj window side by side on this screen, so you can see them all at once.'), run: async () => { const r = await mk.invoke('win-arrange'); if ((r || []).length < 2 && !app.tests?.current) toast(app.t('Open a second window with View → New Window, then Arrange All places them side by side.'), { kind: 'info', actions: [{ label: app.t('New Window'), run: () => app.commands.run('view.newWindow') }] }); return r; } });
  C('view.switchWindows', { label: app.tm('Switch Windows'), icon: 'mkw-switch', description: app.tm('Pick another Markooj window to bring to the front. Ctrl+F6 goes to the next window, Ctrl+Shift+F6 to the previous one.'), run: switchWindows });
  C('view.nextWindow', { label: app.tm('Next window'), icon: 'mkw-switch', shortcut: 'Ctrl+F6', description: app.tm('Bring the next Markooj window to the front, like Ctrl+F6 in Word.'), run: () => mk.invoke('win-cycle', 1) });
  C('view.prevWindow', { label: app.tm('Previous window'), icon: 'mkw-switch', shortcut: 'Ctrl+Shift+F6', description: app.tm('Bring the previous Markooj window to the front.'), run: () => mk.invoke('win-cycle', -1) });

  app.windows = { isExtra, join, links, sharedElsewhere, sendNow, prepareClose, closeCancelled, list, newWindow, openInNewWindow, switchWindows, merge3, linkOf: doc => links.get(doc?.id) || null };

  // ---------- smoke tests ----------
  const A = app.assert;
  const until = async (fn, ms = 8000, what = 'condition') => { const t0 = Date.now(); for (;;) { let v; try { v = await fn(); } catch { v = false; } if (v) return v; if (Date.now() - t0 > ms) throw new Error('Timed out waiting for ' + what); await sleep(60); } };
  app.tests.register('windows: merge keeps both windows’ edits', () => {
    A(merge3('one two three', 'ONE two three', 'one two THREE') === 'ONE two THREE', 'non-overlapping edits both kept');
    A(merge3('abc', 'aXc', 'aYc') === null, 'overlap is reported');
    A(merge3('abc', 'abc', 'abcd') === 'abcd' && merge3('abc', 'abcd', 'abc') === 'abcd', 'one side unchanged');
  });
  app.tests.register('windows: New Window shows the same document and keeps both windows in step', async () => {
    const doc = app.docs.create({ title: 'Window test', text: '# Shared\n\nFirst line.\n' });
    let id = null;
    try {
      await join(doc);
      const r = await newWindow();
      A(r && r.id, 'a second window opened');
      id = r.id;
      const ev = js => mk.invoke('win-smoke-eval', id, js);
      const other = `(window.app && app.docs.list().find(d => d.title === 'Window test'))`;
      await until(() => ev(`!!${other} && !!app.windows.linkOf(${other})?.key && app.windows.linkOf(${other}).peers > 1`), 15000, 'the second window to show the document');
      A(await ev(`${other}.text`) === doc.text, 'same text in the second window');
      await until(() => links.get(doc.id).peers > 1, 4000, 'this window to see the second one');
      // typing here shows up there
      doc.setText(doc.text + '\nAdded here.\n', 'test');
      await until(async () => /Added here\./.test(await ev(`${other}.text`)), 4000, 'the edit to reach the second window');
      // typing there shows up here
      await ev(`${other}.setText(${other}.text.replace('First line.', 'First line, edited there.'), 'test'), true`);
      await until(() => /edited there/.test(doc.text) && /Added here/.test(doc.text), 4000, 'the edit to come back');
      // two edits that cross on the way (both based on the same version) are both kept
      const L = links.get(doc.id); const base = L.version; const t0 = doc.text;
      const a = t0.replace('# Shared', '# Shared title');
      const b = t0 + 'Tail from the other window.\n';
      const r1 = await mk.invoke('win-doc-edit', { key: L.key, base, text: a });
      const r2 = await mk.invoke('win-doc-edit', { key: L.key, base, text: b });
      A(r1.version === base + 1 && r2.version === base + 2, 'versions count up');
      A(r2.text && /# Shared title/.test(r2.text) && /Tail from the other window/.test(r2.text), 'main merged both edits: ' + JSON.stringify(r2.text));
      await until(async () => { const t = await ev(`${other}.text`); return /# Shared title/.test(t) && /Tail from/.test(t); }, 4000, 'the merged text in the second window');
      A(sharedElsewhere(doc), 'the document counts as open elsewhere');
      const wins = await list(); A(wins.length >= 2 && wins.some(w => w.current), 'Switch Windows lists both windows');
      const ar = await mk.invoke('win-arrange'); A(ar.length >= 2 && ar[0].bounds.x !== ar[1].bounds.x, 'Arrange All puts the windows side by side');
    } finally {
      if (id) await mk.invoke('win-smoke-close', id).catch(() => {});
      await sleep(200);
      await app.docs.close(doc.id, { force: true });
    }
  });
  // bug hunt (round 5): "Close all windows" on the taskbar (or shutting Windows down) closes both windows at once.
  // Each one thought the other still had the document, so neither asked and the unsaved text was lost.
  app.tests.register('windows: closing two linked windows at once still asks about unsaved text once', async () => {
    const doc = app.docs.create({ title: 'Close both test', text: '# Close both\n' });
    let id = null;
    try {
      await join(doc);
      const r = await newWindow(); id = r && r.id;
      A(id, 'a second window opened');
      const ev = js => mk.invoke('win-smoke-eval', id, js);
      const other = `(window.app && app.docs.list().find(d => d.title === 'Close both test'))`;
      await until(() => ev(`!!${other} && !!app.windows.linkOf(${other})?.key && app.windows.linkOf(${other}).peers > 1`), 15000, 'the second window to link');
      await until(() => links.get(doc.id)?.peers > 1, 4000, 'this window to see the second one');
      doc.setText(doc.text + 'Unsaved words.\n', 'test');
      await until(async () => /Unsaved words/.test(await ev(`${other}.text`)), 4000, 'the edit in window two');
      A(doc.dirty && await ev(`${other}.dirty`), 'unsaved in both windows');
      A(typeof app.windows.prepareClose === 'function', 'app.windows.prepareClose exists');
      // both windows get the close request at the same moment
      const [here, there] = await Promise.all([
        app.windows.prepareClose(),
        ev(`app.windows.prepareClose().then(s => [...s].map(i => app.docs.get(i)?.title))`),
      ]);
      const skipHere = here.has(doc.id), skipThere = (there || []).includes('Close both test');
      A(!(skipHere && skipThere), 'at least one window keeps the document as unsaved and asks');
      A(skipHere || skipThere, 'only one window asks (the other leaves it to that one)');
      A(doc.dirty === true, 'this window’s document still counts as unsaved');
      // a cancelled close forgets the mark: alone again, this window would ask, the other one would not
      await app.windows.closeCancelled(); await ev('app.windows.closeCancelled()');
      const again = await app.windows.prepareClose();
      A(again.has(doc.id), 'with the other window open (not closing), this one leaves the document to it');
      await app.windows.closeCancelled();
    } finally {
      if (id) await mk.invoke('win-smoke-close', id).catch(() => {});
      await sleep(200);
      await app.docs.close(doc.id, { force: true });
    }
  });
  app.tests.register('windows: saving in one window updates the other (no false “changed on disk”)', async () => {
    const dir = (await mk.invoke('recovery-dir').catch(() => null)) || null;
    A(dir, 'a writable folder for the test file');
    const sep = dir.includes('\\') ? '\\' : '/';
    const file = dir.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]+$/, '') + sep + 'window-save-test.md'; // next to the recovery folder
    await mk.invoke('write-text', file, '# Saved\n\nOn disk.\n');
    const doc = await app.docs.open(file);
    let id = null;
    try {
      await join(doc);
      const r = await mk.invoke('win-new', { path: file });
      id = r.id;
      const ev = js => mk.invoke('win-smoke-eval', id, js);
      const other = `(window.app && app.docs.list().find(d => d.path && /window-save-test\\.md$/i.test(d.path)))`;
      await until(() => ev(`!!${other} && app.windows.sharedElsewhere(${other})`), 15000, 'the file in the second window, linked');
      await until(() => sharedElsewhere(doc), 4000, 'this window to see the link');
      doc.setText(doc.text + 'Typed in window one.\n', 'test');
      await until(async () => /window one/.test(await ev(`${other}.text`)), 4000, 'the edit in window two');
      A(await ev(`${other}.dirty`) === true, 'window two shows the change as unsaved');
      A(await ev(`app.docs.save(${other}).then(ok => ok)`) === true, 'window two saved');
      const disk = await mk.invoke('read-text', file);
      A(/window one/.test(disk), 'the file has the text typed in window one');
      await until(() => !doc.dirty, 4000, 'window one to see the save');
      // window one can save again without a conflict warning
      doc.setText(doc.text + 'More.\n', 'test');
      const ok = await app.docs.save(doc);
      A(ok === true && /More\./.test(await mk.invoke('read-text', file)), 'window one saved without a conflict');
    } finally {
      if (id) await mk.invoke('win-smoke-close', id).catch(() => {});
      await sleep(200);
      await app.docs.close(doc.id, { force: true });
    }
  });
})();
