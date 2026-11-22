// Markooj — Read mode: the finished document, clean. No editing, no comments, no hidden notes, no edit chrome.
// Links and footnotes work with a plain click. Esc (handled by the shell) or the Edit button goes back to editing.
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const E = app.editor = app.editor || {};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CSS_TEXT = `
.mk-read{min-height:100%;padding:34px 24px 80px;display:flex;flex-direction:column;align-items:safe center;width:max-content;min-width:100%;box-sizing:border-box;outline:none}
.mk-read .mk-sheet{position:relative;flex:none}
.mk-read .mk-page{cursor:default;user-select:text}
.mk-read .mk-page a[href]{cursor:pointer}
.mk-read .mk-page a[href]:hover{text-decoration:underline}
.mk-read .mk-page .mk-math,.mk-read .mk-page .mk-math-block,.mk-read .mk-page pre.mermaid{cursor:default}
.mk-read .mk-page .mk-math:hover,.mk-read .mk-page .mk-math-block:hover,.mk-read .mk-page pre.mermaid:hover{background:none}
.mk-read .mk-page .mk-cite{cursor:default}
.mk-read .mk-page .mk-comment,.mk-read .mk-page .mk-note,.mk-read .mk-page .mk-note-block,.mk-read .mk-page .mk-ui,.mk-read .mk-page [data-mk-ui]:not(.mk-eqno):not(.mk-xnum){display:none!important}
.mk-read .mk-page .page-break{border-top-color:transparent;height:0;margin:0}
.mk-read .mk-page .page-break::after{content:none}
.mk-read .mk-page .task-list-item input{pointer-events:none}
.mk-read .mk-page ::selection{background:var(--accent-ring)}
.mk-read-edit{position:sticky;bottom:18px;align-self:flex-end;margin-top:-34px;margin-right:6px;z-index:5;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 13px;border-radius:15px;border:0;
  background:var(--chrome-solid,#fbfbfd);color:var(--text);font:500 12.5px var(--font);box-shadow:var(--pop-shadow);opacity:.0;transform:translateY(6px);
  transition:opacity .25s var(--ease),transform .25s var(--ease),background .15s;animation:mkReadIn .4s .35s var(--ease) forwards}
.mk-read-edit:hover{background:var(--surface,#fff);color:var(--accent)}
.mk-read-edit:active{transform:scale(.96)}
.mk-read-edit:focus-visible{outline:none;box-shadow:var(--pop-shadow),0 0 0 3px var(--accent-ring)}
.mk-read-edit svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.mk-read-edit kbd{font:11px var(--font);color:var(--text-3);border:.5px solid var(--line-2);border-radius:4px;padding:0 4px}
@keyframes mkReadIn{to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.mk-read-edit{animation:none;opacity:1;transform:none}}
@media print{.mk-read-edit{display:none}}
`;
  function injectCss() {
    if (document.getElementById('mk-read-css')) return;
    const st = document.createElement('style'); st.id = 'mk-read-css'; st.textContent = CSS_TEXT; document.head.appendChild(st);
  }

  function createReadView() {
    let host = null, root = null, sheet = null, page = null, doc = null, mounted = false, offs = [], renderSeq = 0, fmLines = 0, lastToast = 0;
    const editModes = () => (app.modes || ['word', 'inline', 'simple']).filter(m => m !== 'read');
    function backToEditing() {
      if (app.shell?.backToEditing) return app.shell.backToEditing();
      const prev = app.prevMode && app.prevMode !== 'read' ? app.prevMode : app.settings.get('defaultMode', 'word');
      app.setMode(editModes().includes(prev) ? prev : 'word');
    }
    function readOnlyHint() {
      if (Date.now() - lastToast < 1500 || app.tests?.current) return;
      lastToast = Date.now();
      app.ui.toast?.('Read mode is for reading. Press Esc or click Edit to make changes.', { kind: 'info' });
    }
    function build() {
      injectCss();
      root = document.createElement('div'); root.className = 'mk-read'; root.tabIndex = -1;
      root.setAttribute('aria-label', 'Document, read mode');
      sheet = document.createElement('div'); sheet.className = 'mk-sheet';
      page = document.createElement('article'); page.className = 'mk-page mk-read-page';
      page.setAttribute('data-mk-surface', 'read'); page.setAttribute('role', 'document');
      sheet.appendChild(page); root.appendChild(sheet);
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'mk-read-edit';
      btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>Edit <kbd>Esc</kbd>';
      btn.title = 'Back to editing (Esc)'; btn.setAttribute('aria-label', 'Back to editing');
      btn.setAttribute('data-tip-title', 'Back to editing'); btn.setAttribute('data-tip-desc', 'Leave Read mode and continue in the editing mode you used before.'); btn.setAttribute('data-tip-key', 'Esc');
      btn.addEventListener('click', backToEditing);
      root.appendChild(btn);
      page.addEventListener('click', onClick);
      page.addEventListener('dblclick', () => readOnlyHint());
      root.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !e.defaultPrevented && app.mode === 'read' && !app.shell?.backToEditing) { e.preventDefault(); backToEditing(); }
      });
      // typing in Read mode: say how to edit instead of doing nothing
      root.addEventListener('keypress', e => { if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && e.key !== ' ') readOnlyHint(); });
    }
    function onClick(e) {
      const a = e.target.closest('a[href]');
      if (a) {
        e.preventDefault();
        const href = a.getAttribute('href') || '';
        if (href.startsWith('#')) { let t = null; try { t = page.querySelector(`[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`); } catch {} t?.scrollIntoView({ behavior: 'smooth', block: a.closest('sup.footnote-ref,.footnote-backref') ? 'center' : 'start' }); return; }
        if (/^(https?:|mailto:)/i.test(href)) { app.mk?.invoke?.('open-external', href)?.catch?.(() => {}); return; }
        if (doc?.path && !/^[a-z][\w+.-]*:/i.test(href)) {
          const sep = doc.path.includes('\\') ? '\\' : '/'; const dir = doc.path.replace(/[\\/][^\\/]*$/, '');
          app.docs.open(dir + sep + decodeURIComponent(href.split('#')[0]).replace(/\//g, sep)).catch(err => app.ui.toast(`Could not open ${href}. ${app.ui.plainError ? app.ui.plainError(err) : (err.message || err)}`, { kind: 'error' }));
        }
      }
    }
    function scroller() { let n = host; while (n && n !== document.body) { const s = getComputedStyle(n); if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight) return n; n = n.parentElement; } return host || document.scrollingElement; }
    function applyLayout() {
      if (!page) return;
      try { app.layout?.apply?.(page, doc); } catch (e) { console.warn(e); }
      if (sheet) sheet.style.zoom = (app.zoom || 100) / 100;
      const ps = app.layout?.pageSize?.(doc); page.style.minHeight = (ps?.h || 1123) + 'px';
    }
    async function render() {
      if (!doc || !page) return;
      const seq = ++renderSeq; const text = doc.text || '';
      let r;
      try { r = await app.render(text, { doc }); } catch (e) { console.error(e); r = { html: '<p>' + esc(text) + '</p>' }; }
      if (seq !== renderSeq || !mounted) return;
      const sc = scroller(); const keep = sc ? sc.scrollTop : 0;
      page.innerHTML = r.html;
      E.fixImages?.(page, doc);
      try { fmLines = E.frontMatterLines ? E.frontMatterLines(text) : 0; } catch { fmLines = 0; }
      try { await app.decorate(page, doc); } catch (e) { console.error(e); }
      if (seq !== renderSeq || !mounted) return;
      // nothing on this page can be edited
      page.querySelectorAll('[contenteditable]').forEach(n => n.setAttribute('contenteditable', 'false'));
      page.querySelectorAll('input').forEach(i => { i.disabled = true; i.tabIndex = -1; });
      page.querySelectorAll('.mk-comment, .mk-note, .mk-note-block').forEach(n => n.setAttribute('aria-hidden', 'true'));
      applyLayout();
      if (sc) sc.scrollTop = keep;
      app.events.emit('read:rendered', { doc, page });
    }
    const rerenderSoon = app.debounce ? app.debounce(() => render(), 200) : () => render();

    const adapter = {
      name: 'read',
      readOnly: true,
      mount(container, d) {
        if (mounted) adapter.unmount();
        host = container; doc = d; mounted = true;
        build(); host.appendChild(root);
        offs.push(app.events.on('doc:changed', ({ doc: dd }) => { if (dd === doc) rerenderSoon(); }));
        offs.push(app.events.on('zoom:changed', applyLayout));
        offs.push(app.events.on('layout:changed', applyLayout));
        offs.push(app.events.on('settings:changed', ({ key }) => { if (/^(fontFamily|fontSize)$/.test(key)) applyLayout(); if (key === 'mathMacros') render(); }));
        offs.push(app.events.on('theme:changed', () => { page?.querySelectorAll('pre.mermaid[data-done]').forEach(p => { p.removeAttribute('data-done'); p.textContent = p.getAttribute('data-src') || ''; }); Promise.resolve(app.decorate(page, doc)).catch(() => {}); }));
        const p = render();
        p.then(() => { if (mounted && root && !root.contains(document.activeElement)) root.focus({ preventScroll: true }); });
        return p;
      },
      unmount() {
        if (!mounted) return;
        mounted = false; renderSeq++;
        offs.splice(0).forEach(f => { try { f(); } catch {} });
        root?.remove(); root = sheet = page = null; host = null; doc = null;
      },
      get doc() { return doc; },
      get page() { return page; },
      getSurface() { return page && page.isConnected ? page : null; },
      flush() {},
      getText() { return doc?.text || ''; },
      refresh() { return render(); },
      focus() { root?.focus({ preventScroll: true }); },
      getSelection() { const s = getSelection(); return { text: s.rangeCount && page?.contains(s.anchorNode) ? String(s) : '', start: null, end: null }; },
      getCaretLine() { return null; },
      getTopLine() {
        const sc = scroller(); if (!sc || !page) return null;
        const top = sc.getBoundingClientRect().top;
        for (const el of page.querySelectorAll('[data-line]')) { if (el.getBoundingClientRect().bottom > top + 1) return +el.getAttribute('data-line') + fmLines; }
        return null;
      },
      scrollToLine(n, opts = {}) {
        if (!page) return;
        const target = n - fmLines; let best = null;
        page.querySelectorAll('[data-line]').forEach(el => { const l = +el.getAttribute('data-line'); if (l <= target && (!best || l >= +best.getAttribute('data-line'))) best = el; });
        (best || page.firstElementChild)?.scrollIntoView({ behavior: opts.behavior || 'smooth', block: 'start' });
      },
      find(query, opts = {}) {
        if (!page || !query) return { count: 0, index: -1 };
        const re = E.findRegex ? E.findRegex(query, opts) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const nodes = []; let s = '';
        const w = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement.closest('.mk-comment,.mk-note,.katex,script,style,svg') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
        let t; while ((t = w.nextNode())) { nodes.push({ node: t, start: s.length }); s += t.data; }
        const all = [...s.matchAll(re)].filter(m => m[0].length);
        if (!all.length) return { count: 0, index: -1 };
        const pos = off => { let k = 0; for (let i = 0; i < nodes.length; i++) if (nodes[i].start <= off) k = i; else break; const x = nodes[k]; return [x.node, Math.min(x.node.data.length, off - x.start)]; };
        adapter._findIndex = opts.backwards ? ((adapter._findIndex ?? 0) - 1 + all.length) % all.length : ((adapter._findIndex ?? -1) + 1) % all.length;
        const m = all[adapter._findIndex]; const r = document.createRange(); const [a, ao] = pos(m.index); const [b, bo] = pos(m.index + m[0].length); r.setStart(a, ao); r.setEnd(b, bo);
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
        a.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { count: all.length, index: adapter._findIndex };
      },
      // editing calls from the ribbon or shortcuts: Read mode changes nothing
      insert() { readOnlyHint(); }, insertBlock() { readOnlyHint(); }, replaceSelection() { readOnlyHint(); },
      wrap() { readOnlyHint(); }, format() { readOnlyHint(); }, color() { readOnlyHint(); }, highlightColor() { readOnlyHint(); },
      insertTable() { readOnlyHint(); }, startPainter() { readOnlyHint(); }, setSelection() {},
      replace() { readOnlyHint(); return { count: 0, index: -1 }; }, replaceAll() { readOnlyHint(); return 0; },
      undo() { readOnlyHint(); }, redo() { readOnlyHint(); }, canUndo: () => false, canRedo: () => false,
      activeStates() { return {}; },
    };
    return adapter;
  }

  E.createRead = createReadView;
  app.editors.register('read', createReadView());

  // ------------------------------------------------------------------ smoke tests
  app.tests.register('modes: Read mode shows the finished page without comments, notes or editing', async () => {
    const host = E._offscreen ? E._offscreen() : document.body.appendChild(document.createElement('div'));
    const v = createReadView();
    const d = E.fakeDoc ? E.fakeDoc('# Title\n\nText <!-- comment: check this --> and %%a hidden note%% end.\n\n- [ ] task\n\n<div class="page-break"></div>\n\nAfter [link](#title).') : { text: '# T', kind: 'markdown', meta: {} };
    try {
      await v.mount(host, d);
      const pg = v.page;
      app.assert(pg && pg.querySelector('h1'), 'rendered');
      app.assert(!pg.querySelector('[contenteditable="true"]') && !pg.isContentEditable, 'nothing is editable');
      const note = pg.querySelector('.mk-note'); app.assert(note && getComputedStyle(note).display === 'none', 'hidden note hidden');
      const c = pg.querySelector('.mk-comment'); app.assert(!c || getComputedStyle(c).display === 'none', 'comment hidden');
      app.assert(!/hidden note/.test(pg.innerText) && !/check this/.test(pg.innerText), 'no note or comment text visible: ' + pg.innerText);
      app.assert(pg.querySelector('input[type=checkbox]')?.disabled, 'checkboxes are read-only');
      const before = d.text; v.format('bold'); v.insert('x'); app.assert(d.text === before, 'editing calls change nothing');
      app.assert(host.querySelector('.mk-read-edit'), 'Edit button to go back');
    } finally { v.unmount(); host.remove(); }
  });
  app.tests.register('modes: Read adapter is registered and reachable with app.setMode', () => {
    app.assert(app.editors.get('read')?.name === 'read', 'read adapter registered');
    const prev = app.mode; const ok = app.setMode('read');
    try { app.assert(ok !== false && app.mode === 'read' && app.editors.active() === app.editors.get('read'), 'app.setMode("read") selects Read mode (core must accept it)'); }
    finally { app.setMode(prev); }
  });
})();
