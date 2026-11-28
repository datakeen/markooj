// Markooj — core: the shared `window.app` every module builds on. See ARCHITECTURE.md.
/* i18n-aliases: tm */
(function () {
  'use strict';
  // marks English for the translation check before app.tm exists (the ribbon draws tab labels through app.t)
  const tm = s => s;
  const mk = window.mk || { invoke: async () => { throw new Error('No bridge'); }, on() {}, render: t => ({ html: t, meta: {} }), detectFlavor: () => ({ name: 'CommonMark', features: [] }) };

  // ---------- events ----------
  const listeners = new Map();
  const events = {
    on(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); return () => events.off(name, fn); },
    off(name, fn) { listeners.get(name)?.delete(fn); },
    emit(name, payload) {
      for (const fn of [...(listeners.get(name) || [])]) { try { fn(payload); } catch (e) { console.error(`[event ${name}]`, e); } }
    },
  };

  // ---------- settings ----------
  const DEFAULTS = { theme: 'system', tabPosition: 'top', defaultMode: 'word', zoom: 100, outline: true, recoveryDays: 7, inlineMath: 'd', mathMacros: '', fontFamily: 'Charter', fontSize: 12, recent: [],
    // round 2: typing helpers (app.typing), comment visibility and export
    smartQuotes: true, autocorrect: true, showComments: true, exportComments: false };
  let store = { ...DEFAULTS };
  const settings = {
    async load() { try { store = { ...DEFAULTS, ...(await mk.invoke('settings-get')) }; } catch { try { store = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('markooj-settings') || '{}') }; } catch {} } return store; },
    get(key, fallback) { return key in store ? store[key] : fallback; },
    all() { return { ...store }; },
    set(key, value) {
      store[key] = value;
      mk.invoke('settings-set', { [key]: value }).catch(() => { try { localStorage.setItem('markooj-settings', JSON.stringify(store)); } catch {} });
      events.emit('settings:changed', { key, value });
    },
  };

  // ---------- commands ----------
  const cmdMap = new Map();
  let recording = 0;
  const commands = {
    register(id, def) { cmdMap.set(id, { id, label: id, ...def }); return id; },
    get(id) { return cmdMap.get(id); },
    unregister(id) { const had = cmdMap.delete(id); if (had) events.emit('ribbon:changed'); return had; },
    list() { return [...cmdMap.values()]; },
    async run(id, args) {
      const c = cmdMap.get(id);
      if (!c) {
        console.warn('Unknown command', id);
        // usually a macro or a shortcut that points at an add-in which is off or removed
        ui.toast(app.t('Turn on the add-in that adds “{id}”, or check the macro or shortcut that runs it. Everything else works.', { id }), { kind: 'warn', actions: [{ label: app.t('Open Add-ins'), run: () => backstage.open('addins') }] });
        return;
      }
      if (c.isEnabled && !c.isEnabled()) return;
      // typing the Word editor has not committed yet must be in doc.text before a command reads or rewrites it
      try { editors.active()?.flush?.(); } catch {}
      try {
        const r = await c.run(args);
        events.emit('command:ran', { id, args });
        events.emit('ribbon:changed');
        return r;
      } catch (e) {
        console.error(e);
        // the command's own message when it is plain English; code-like text only under Details
        ui.fail(e, { retry: () => commands.run(id, args) });
      }
    },
  };
  // Error text for people: no "Error invoking remote method 'x':" or "Error:" prefixes from Electron
  function plainError(e, fallback) {
    const s = String((e && e.message) || e || '').replace(/^Error invoking remote method '[^']+':\s*/, '').replace(/^(?:\w*Error:\s*)+/, '').trim();
    return s || fallback || app.t('Try that again.');
  }

  // ---------- ribbon / backstage / options / status registries ----------
  const ribbonTabs = new Map(), ribbonGroups = new Map();
  const ribbon = {
    addTab(t) { ribbonTabs.set(t.id, { order: 50, ...t }); if (!ribbonGroups.has(t.id)) ribbonGroups.set(t.id, []); events.emit('ribbon:changed'); },
    addGroup(tabId, g) {
      if (!ribbonGroups.has(tabId)) ribbonGroups.set(tabId, []);
      const list = ribbonGroups.get(tabId).filter(x => x.id !== g.id);
      list.push({ order: 50, ...g }); list.sort((a, b) => a.order - b.order);
      ribbonGroups.set(tabId, list); events.emit('ribbon:changed');
    },
    removeGroup(tabId, id) { ribbonGroups.set(tabId, (ribbonGroups.get(tabId) || []).filter(g => g.id !== id)); events.emit('ribbon:changed'); },
    tabs() { return [...ribbonTabs.values()].sort((a, b) => a.order - b.order).map(t => ({ ...t, groups: ribbonGroups.get(t.id) || [] })); },
  };
  [['home', tm('Home'), 10], ['insert', tm('Insert'), 20], ['layout', tm('Layout'), 30], ['references', tm('References'), 40], ['review', tm('Review'), 50], ['view', tm('View'), 60], ['developer', tm('Developer'), 70], ['addins', tm('Add-ins'), 80]]
    .forEach(([id, label, order]) => ribbon.addTab({ id, label, order }));

  const pages = new Map();
  const backstage = {
    addPage(p) { pages.set(p.id, { order: 50, ...p }); events.emit('backstage:changed'); },
    pages() { return [...pages.values()].sort((a, b) => a.order - b.order); },
    open(id) { events.emit('backstage:open', id); },
    close() { events.emit('backstage:close'); },
  };
  const optionSections = new Map();
  const options = { addSection(s) { optionSections.set(s.id, { order: 50, ...s }); }, removeSection(id) { return optionSections.delete(id); }, sections() { return [...optionSections.values()].sort((a, b) => a.order - b.order); },
    // 1.2.0: a "lead" card drawn above a section's own card (Options → Language → Interface language comes from src/i18n.js)
    addLead(sectionId, l) { const list = (optionLeads.get(sectionId) || []).filter(x => x.id !== l.id); list.push({ order: 50, ...l }); list.sort((a, b) => a.order - b.order); optionLeads.set(sectionId, list); },
    leads(sectionId) { return [...(optionLeads.get(sectionId) || [])]; } };
  const optionLeads = new Map();
  const statusItems = new Map();
  const status = { addItem(i) { statusItems.set(i.id, { order: 50, side: 'left', ...i }); events.emit('status:changed'); }, removeItem(id) { const had = statusItems.delete(id); if (had) events.emit('status:changed'); return had; }, items() { return [...statusItems.values()].sort((a, b) => a.order - b.order); }, refresh() { events.emit('status:refresh'); } };

  // ---------- hooks ----------
  const pre = [], post = [];
  const hooks = { preRender(fn) { pre.push(fn); }, postRender(fn) { post.push(fn); }, _pre: pre, _post: post };

  // ---------- editors ----------
  const editorMap = new Map();
  const editors = {
    register(name, adapter) { editorMap.set(name, adapter); },
    get(name) { return editorMap.get(name); },
    active() { return editorMap.get(app.mode) || null; },
  };

  // ---------- documents ----------
  let seq = 0, activeId = null;
  const docMap = new Map();
  const recoveryTimers = new Map();
  function scheduleRecovery(doc) {
    clearTimeout(recoveryTimers.get(doc.id));
    recoveryTimers.set(doc.id, setTimeout(() => {
      if (doc.kind !== 'markdown') return;
      if (doc.dirty) mk.invoke('recovery-save', { docId: doc.recoveryId, path: doc.path, title: doc.title, text: doc.text }).catch(() => {});
      // undone back to the saved text: the recovery copy would show up as a false "crash" next time
      else mk.invoke('recovery-delete', doc.recoveryId).catch(() => {});
    }, 1500));
  }
  const EDITOR_ORIGIN = /^(word|word-undo|inline|inline-replace|inline-undo|simple|simple-undo|source|read)$/;
  // base → theirs and base → mine as one edit each; both apply when they do not overlap, else null
  function merge3(base, theirs, mine) {
    const span = (a, b) => { let s = 0; const n = Math.min(a.length, b.length); while (s < n && a[s] === b[s]) s++; let e = 0; while (e < n - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++; return { s, e: a.length - e, ins: b.slice(s, b.length - e) }; };
    const t = span(base, theirs), m = span(base, mine);
    if (t.e <= m.s) return base.slice(0, t.s) + t.ins + base.slice(t.e, m.s) + m.ins + base.slice(m.e);
    if (m.e <= t.s) return base.slice(0, m.s) + m.ins + base.slice(m.e, t.s) + t.ins + base.slice(t.e);
    return null;
  }
  function makeDoc(o) {
    const doc = {
      id: 'd' + (++seq), recoveryId: o.recoveryId || `${Date.now().toString(36)}-${seq}`,
      path: o.path || null, title: o.title || (o.path ? o.path.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') : app.t('Untitled {n}', { n: seq })),
      ext: (o.ext || (o.path ? o.path.split('.').pop() : 'md')).toLowerCase(), kind: o.kind || 'markdown',
      text: o.text || '', savedText: o.path && !o.convertedFrom ? (o.text || '') : '', convertedFrom: o.convertedFrom || null,
      dirty: false, flavor: { name: 'CommonMark', features: [] }, meta: {}, readOnly: !!o.readOnly,
      data: o.data, pages: o.pages, mtime: o.mtime, view: { zoom: null, scroll: 0 },
      setText(text, origin) {
        if (text === doc.text) return;
        // A change from outside the editor (front matter, add-ins, Info) while the editor still holds uncommitted
        // typing: commit the typing first and keep both changes when they touch different parts of the text.
        if (!EDITOR_ORIGIN.test(String(origin || '')) && activeId === doc.id) {
          const base = doc.text;
          try { editors.active()?.flush?.(); } catch {}
          if (doc.text !== base) { const merged = merge3(base, text, doc.text); if (merged != null) text = merged; }
          if (text === doc.text) return;
        }
        doc.text = text; doc.dirty = doc.text !== doc.savedText; doc.refreshInfo();
        events.emit('doc:changed', { doc, origin }); scheduleRecovery(doc);
      },
      refreshInfo() {
        try { doc.flavor = mk.detectFlavor(doc.text); } catch {}
        try { doc.meta = mk.frontMatter ? mk.frontMatter.parse(doc.text).meta : {}; } catch { doc.meta = {}; }
      },
    };
    if (o.convertedFrom || (!o.path && o.text)) doc.dirty = !!o.convertedFrom;
    doc.refreshInfo();
    if (doc.kind !== 'markdown') { doc.meta = o.meta || {}; if (o.missing) doc.missing = o.missing; } // PDF / DjVu properties come from the file
    return doc;
  }
  const docs = {
    list() { return [...docMap.values()]; },
    get(id) { return docMap.get(id); },
    active() { return docMap.get(activeId) || null; },
    create(o = {}) {
      const doc = makeDoc(o); docMap.set(doc.id, doc);
      events.emit('doc:opened', doc); docs.activate(doc.id); return doc;
    },
    activate(id) {
      if (!docMap.has(id)) return;
      activeId = id; events.emit('doc:active', docMap.get(id));
    },
    async open(path) {
      const existing = docs.list().find(d => d.path && d.path.toLowerCase() === path.toLowerCase());
      if (existing) { docs.activate(existing.id); return existing; }
      const r = await mk.invoke('read-file', path);
      let o = { path: r.path, ext: r.ext, mtime: r.mtime, kind: r.kind };
      if (r.kind === 'markdown') { o.text = r.text; if (r.convertedFrom) o.convertedFrom = r.convertedFrom; }
      else if (r.kind === 'html') { o.kind = 'markdown'; o.text = (r.meta && Object.keys(r.meta).length && mk.frontMatter ? mk.frontMatter.write('', r.meta) : '') + mk.toMarkdown(r.html, { inlineMath: settings.get('inlineMath') }); o.convertedFrom = r.ext; }
      else { o.data = r.data; o.pages = r.pages; o.readOnly = true; o.meta = r.meta || {}; if (r.missing) o.missing = r.missing; }
      const blank = docs.list().find(d => !d.path && !d.dirty && !d.text);
      const doc = docs.create(o);
      if (blank && blank.id !== doc.id) docs.close(blank.id, { force: true });
      const recent = [path, ...settings.get('recent', []).filter(p => p !== path)].slice(0, 15);
      settings.set('recent', recent);
      return doc;
    },
    async save(doc = docs.active(), opts = {}) {
      if (!doc || doc.kind !== 'markdown') return false;
      if (!doc.path || doc.convertedFrom) return docs.saveAs(doc);
      try { if (doc === docs.active()) editors.active()?.flush?.(); } catch {}
      // what is written is what gets marked saved: typing that lands during a slow write stays unsaved
      const text = doc.text;
      let r = await mk.invoke('write-text', doc.path, text, opts.force || doc.mtime == null ? undefined : { expectMtime: doc.mtime });
      if (r && typeof r === 'object' && r.conflict) {
        const v = await ui.dialog({ title: app.t('Choose how to save “{name}”', { name: doc.title }), body: `<p>${app.th('Save as Copy keeps both versions. Overwrite replaces the copy on disk.')}</p><p>${app.th('Another program, a co-author or a sync service changed this file after you opened it.')}</p>`, buttons: [{ label: app.t('Cancel'), value: 'cancel' }, { label: app.t('Overwrite'), value: 'overwrite', danger: true }, { label: app.t('Save as Copy…'), value: 'copy', primary: true }], cancelValue: 'cancel' });
        if (v === 'copy') return docs.saveAs(doc, { copy: true });
        if (v !== 'overwrite') return false;
        r = await mk.invoke('write-text', doc.path, text);
      }
      doc.mtime = typeof r === 'number' ? r : doc.mtime;
      doc.savedText = text; doc.dirty = doc.text !== text;
      if (!doc.dirty) mk.invoke('recovery-delete', doc.recoveryId).catch(() => {});
      else scheduleRecovery(doc);
      events.emit('doc:saved', doc); if (doc.dirty) events.emit('doc:changed', { doc, origin: 'save' });
      ui.toast(app.t('Saved {name}', { name: doc.title }));
      return true;
    },
    async saveAs(doc = docs.active(), opts = {}) {
      if (!doc || doc.kind !== 'markdown') return false;
      const base = (doc.path || doc.title).replace(/\.[^.\\/]+$/, '');
      const out = await mk.invoke('save-dialog', { defaultPath: (opts.copy ? app.t('{name} (copy)', { name: base }) : base) + '.md', filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }, { name: app.t('Text@@file type'), extensions: ['txt'] }] });
      if (!out) return false;
      const prev = { path: doc.path, convertedFrom: doc.convertedFrom, ext: doc.ext, title: doc.title, mtime: doc.mtime };
      doc.path = out; doc.convertedFrom = null; doc.ext = out.split('.').pop().toLowerCase();
      doc.title = out.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
      doc.mtime = null; // the OS dialog already asked before replacing an existing file
      try {
        const ok = await docs.save(doc, { force: true });
        if (!ok) Object.assign(doc, prev);
        return ok;
      } catch (e) { Object.assign(doc, prev); throw e; } // a failed save must not leave the doc pointing at a file it never wrote
    },
    async close(id, opts = {}) {
      const doc = docMap.get(id); if (!doc) return true;
      // round 5: a document another Markooj window still shows loses nothing when its tab closes here (src/windows.js)
      if (doc.dirty && !opts.force && !app.windows?.sharedElsewhere?.(doc)) {
        const v = await ui.dialog({ title: app.t('Save changes to “{name}”?', { name: doc.title }), body: app.tn('If you don’t save, Markooj keeps a recovery copy for {count} days (File → Recover).', settings.get('recoveryDays', 7)), buttons: [{ label: app.t('Don’t Save'), value: 'discard', danger: true }, { label: app.t('Cancel'), value: 'cancel' }, { label: app.t('Save'), value: 'save', primary: true }] });
        if (v === 'cancel' || v == null) return false;
        if (v === 'save' && !(await docs.save(doc))) return false;
        if (v === 'discard') {
          await mk.invoke('recovery-save', { docId: doc.recoveryId, path: doc.path, title: doc.title, text: doc.text }).catch(() => {});
          await mk.invoke('recovery-mark-closed', doc.recoveryId).catch(() => {});
        }
      }
      clearTimeout(recoveryTimers.get(doc.id));
      // a clean document leaves no recovery copy behind (it would look like a crash on the next start)
      if (!doc.dirty && doc.kind === 'markdown') mk.invoke('recovery-delete', doc.recoveryId).catch(() => {});
      const ids = [...docMap.keys()]; const idx = ids.indexOf(id);
      docMap.delete(id); events.emit('doc:closed', doc);
      if (activeId === id) { const next = ids[idx + 1] || ids[idx - 1]; activeId = null; if (next && docMap.has(next)) docs.activate(next); else docs.create({}); }
      return true;
    },
  };

  // ---------- rendering ----------
  let mermaidReady = false, mermaidSeq = 0;
  async function render(text, opts = {}) {
    const doc = opts.doc || docs.active();
    let src = text;
    for (const fn of pre) { try { src = (await fn(src, doc)) ?? src; } catch (e) { console.error(e); } }
    const r = mk.render(src, { bib: app.research?.bib?.() || {}, macros: app.developer?.mathMacros?.() || {}, ...opts.renderOpts });
    return r;
  }
  async function decorate(el, doc) {
    // Mermaid diagrams
    const blocks = el.querySelectorAll('pre.mermaid:not([data-done])');
    if (blocks.length && window.mermaid) {
      // exports and prints are always light; on screen the diagrams follow the app theme
      const theme = !el.classList?.contains('mk-export-stage') && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'neutral';
      if (mermaidReady !== theme) { window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme, fontFamily: 'inherit' }); mermaidReady = theme; }
      for (const pre of blocks) {
        const src = pre.getAttribute('data-src') || pre.textContent;
        try { const { svg } = await window.mermaid.render('mk-mmd-' + (++mermaidSeq), src); pre.innerHTML = svg; pre.setAttribute('data-done', '1'); }
        catch (e) { pre.setAttribute('data-done', 'err'); pre.title = app.t('Diagram error: {message}', { message: e.message }); }
      }
    }
    for (const fn of post) { try { await fn(el, doc); } catch (e) { console.error(e); } }
  }

  // ---------- UI fallbacks (shell replaces these) ----------
  const ui = {
    toast(msg) { console.log('[toast]', msg); },
    async dialog({ title, body, buttons }) { const ok = window.confirm(`${title}\n\n${typeof body === 'string' ? body : ''}`); return ok ? (buttons?.find(b => b.primary)?.value ?? true) : (buttons?.find(b => b.value === 'cancel') ? 'cancel' : null); },
    async prompt(title, label, value) { return window.prompt(`${title}\n${label || ''}`, value || ''); },
    async confirm(title, text) { return window.confirm(`${title}\n\n${text || ''}`); },
    popover() {},
    plainError,
    // shell replaces these with the real toast, dialog and details helpers
    fail(e, o = {}) { const m = [o.lead, plainError(e, app.t('Try that again.'))].filter(Boolean).join(' '); ui.toast(m, { kind: o.kind || 'error', actions: o.retry ? [{ label: app.t('Try again'), run: o.retry }] : o.actions }); },
    async solution(o = {}) { ui.toast([o.lead, o.still].filter(Boolean).join(' '), { kind: o.kind || 'info' }); return 'close'; },
    friendlyError: () => null,
  };

  // ---------- tests ----------
  const testList = [];
  const tests = {
    register(name, fn) { testList.push({ name, fn }); },
    async run(filter) {
      const out = [];
      for (const t of testList) {
        if (typeof filter === 'function' && !filter(t)) continue;
        // one stuck test (an unanswered dialog, a lost promise) must not hang the whole run
        const limit = /python|pyodide/i.test(t.name) ? 120000 : 30000;
        tests.current = t.name; const t0 = Date.now();
        let timer;
        try {
          await Promise.race([Promise.resolve().then(() => t.fn()), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`Timed out after ${limit / 1000} s`)), limit); })]);
          out.push({ name: t.name, ok: true, ms: Date.now() - t0 });
        } catch (e) { out.push({ name: t.name, ok: false, ms: Date.now() - t0, error: String(e && e.stack || e) }); }
        finally { clearTimeout(timer); }
        tests.done = out.length;
      }
      tests.current = null;
      return out;
    },
  };
  const assert = (cond, msg) => { if (!cond) throw new Error('Assertion failed: ' + msg); };

  const app = window.app = {
    version: '1.0.0', mk, events, settings, commands, ribbon, backstage, options, status, hooks, editors, docs, ui, tests, assert,
    mode: 'word',
    zoom: 100,
    render, decorate,
    // Word (click and type) | Inline (live Markdown) | Simple (source + preview) | Read (finished look)
    modes: ['word', 'inline', 'simple', 'read'],
    setMode(m) {
      if (!app.modes.includes(m)) return false;
      if (app.mode === m) return true;
      app.prevMode = app.mode;
      app.mode = m; events.emit('mode:changed', m);
      return true;
    },
    // Pictures next to a saved document: relative (or absolute) file paths → markooj://local/<absolute path>
    assetUrl(doc, src) {
      // file:///C:/x.png and file:///home/x.png (never file://host/…), and ~/Pictures/x.png (pictures from other editors)
      if (src && /^file:\/\//i.test(src)) src = String(src).replace(/^file:\/\/(?:localhost)?\/?(?=[A-Za-z]:[\\/])/i, '').replace(/^file:\/\/(?:localhost)?(?=\/[^/\\])/i, '');
      if (src && /^~[\\/]/.test(src) && mk && mk.homeDir) src = mk.homeDir.replace(/\\/g, '/').replace(/\/+$/, '') + String(src).slice(1);
      if (!src || /^(?:[a-z][\w+.-]*:(?!\\)|\/\/|#)/i.test(src) && !/^[A-Za-z]:[\\/]/.test(src)) return null;
      let p; try { p = decodeURI(String(src)); } catch { p = String(src); }
      p = p.replace(/\\/g, '/');
      if (!/^([A-Za-z]:\/|\/)/.test(p)) {
        if (!doc || !doc.path) return null;
        const parts = doc.path.replace(/\\/g, '/').split('/'); parts.pop();
        for (const seg of p.replace(/^\.\//, '').split('/')) { if (seg === '..') parts.pop(); else if (seg && seg !== '.') parts.push(seg); }
        p = parts.join('/');
      }
      return 'markooj://local/' + encodeURI(p.replace(/^\/+/, '')).replace(/#/g, '%23').replace(/\?/g, '%3F');
    },
    esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; },
  };
  // interface translations (src/i18n.js, loaded in <head>): app.t, app.tn, app.th, app.tm, app.i18n. English stand-ins when it is missing.
  try { if (window.mkI18n) window.mkI18n.attach(app); } catch (e) { console.error('[i18n] attach', e); }
  if (!app.t) {
    const fill = (s, v) => String(s ?? '').replace(/@@[a-z][a-z0-9 _-]{0,47}$/, '').replace(/\{([A-Za-z_]\w*)\}/g, (m, n) => (v && n in v ? String(v[n]) : m));
    Object.assign(app, { t: fill, tn: (s, count, v) => fill(s, { ...v, count }), th: (s, v) => fill(s, v && Object.fromEntries(Object.entries(v).map(([k, x]) => [k, app.esc(x)]))), tm: s => s });
  }

  // core tests
  tests.register('core: setMode accepts word, inline, simple and read', () => {
    const m0 = app.mode; const seen = [];
    const off = events.on('mode:changed', m => seen.push(m));
    try {
      assert(app.setMode('nonsense') === false && app.mode === m0, 'unknown modes are ignored');
      for (const m of ['inline', 'read', 'simple', 'word']) { assert(app.setMode(m) === true && app.mode === m, 'mode ' + m); }
      assert(seen.includes('inline') && seen.includes('read'), 'mode:changed emitted: ' + seen.join());
    } finally { off(); app.setMode(m0); }
  });
  tests.register('core: an outside change keeps uncommitted typing elsewhere in the text', () => {
    assert(merge3('---\na: 1\n---\nHello\n', '---\na: 2\n---\nHello\n', '---\na: 1\n---\nHello world\n') === '---\na: 2\n---\nHello world\n', 'both kept');
    assert(merge3('abc', 'aXc', 'aYc') === null, 'overlap: outside change wins as before');
  });
  tests.register('core: docs create/setText/dirty', () => {
    const d = docs.create({ text: '# Hi', title: 'T' });
    d.setText('# Hi $x^2$', 'test'); assert(d.dirty, 'dirty after edit'); assert(/LaTeX/.test(d.flavor.name), 'flavor detects LaTeX, got ' + d.flavor.name);
    return docs.close(d.id, { force: true });
  });
})();
// integration: pictures next to a document resolve through markooj://local
window.app && window.app.tests.register('core: assetUrl resolves pictures next to the document', () => {
  const a = window.app, d = { path: 'C:\\Papers\\My draft\\paper.md' };
  a.assert(a.assetUrl(d, 'fig 1.png') === 'markooj://local/C:/Papers/My%20draft/fig%201.png', a.assetUrl(d, 'fig 1.png'));
  a.assert(a.assetUrl(d, '../shared/x.png') === 'markooj://local/C:/Papers/shared/x.png', a.assetUrl(d, '../shared/x.png'));
  a.assert(a.assetUrl(d, 'https://example.com/a.png') === null && a.assetUrl({}, 'a.png') === null, 'web and unsaved stay as they are');
  a.assert(a.assetUrl(d, 'C:\\Images\\b.png') === 'markooj://local/C:/Images/b.png', 'absolute Windows path');
});
