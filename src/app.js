// Markooj — boot (loaded last): settings, first document, file drops, safe closing, smoke run.
(function () {
  'use strict';
  const app = window.app;
  if (!app) { document.body.textContent = window.mkI18n ? window.mkI18n.t('Markooj could not start (core.js missing).') : 'Markooj could not start (core.js missing).'; return; }
  const mk = app.mk;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Register main-process listeners right away: files can arrive before boot finishes.
  const pendingPaths = [];
  let booted = false;
  let resolveBoot;
  const bootPromise = new Promise(r => { resolveBoot = r; });
  async function openPath(p) {
    if (app.shell?.openPath) return app.shell.openPath(p);
    try { await app.docs.open(p); return true; } catch (e) { app.ui.fail(e, { lead: app.t('Check that “{name}” is still there, then try again.', { name: String(p).split(/[\\/]/).pop() }), retry: () => openPath(p) }); return false; }
  }
  mk.on('open-path', p => { if (booted) openPath(p); else pendingPaths.push(p); });
  mk.on('request-close', () => { bootPromise.then(onRequestClose); });
  mk.on('smoke', (outDir, only) => { bootPromise.then(() => runSmoke(outDir, only)); });

  async function boot() {
    try { await app.settings.load(); } catch (e) { console.warn('settings', e); }
    // the version shown in Options and Help comes from package.json (through main), not from a constant
    try { const info = await mk.invoke('app-info'); if (info?.version) app.version = info.version; } catch {}
    try { app.shell?.applySettings?.(); } catch (e) { console.error('applySettings', e); }
    if (!app.shell) {
      app.setMode(app.settings.get('defaultMode', 'word'));
      app.setZoom?.(app.settings.get('zoom', 100));
    }
    booted = true;
    for (const p of pendingPaths.splice(0)) await openPath(p);
    // Give a double-clicked file a moment to arrive before showing a blank page.
    if (!app.docs.list().length) await sleep(350);
    if (!app.docs.list().length) app.docs.create({ title: app.t('Untitled') });
    wireDrops();
    app.events.emit('ready');
    resolveBoot();
  }

  // ---------- drag and drop files onto the window ----------
  function wireDrops() {
    const hint = document.getElementById('dropHint');
    let depth = 0;
    const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
    addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); depth++; hint?.classList.add('show'); });
    addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    addEventListener('dragleave', e => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) hint?.classList.remove('show'); });
    addEventListener('drop', async e => {
      if (!hasFiles(e)) return;
      // let editors handle images dropped onto the page themselves
      if (e.defaultPrevented) { depth = 0; hint?.classList.remove('show'); return; }
      e.preventDefault(); depth = 0; hint?.classList.remove('show');
      for (const f of [...e.dataTransfer.files]) {
        let p = null;
        try { p = mk.pathForFile ? mk.pathForFile(f) : null; } catch {}
        if (!p && f.path) p = f.path;
        if (p) { await openPath(p); continue; }
        // No path available (bridge lacks webUtils): read text files directly.
        if (/\.(md|markdown|mdown|mkd|mdx|rmd|qmd|txt)$/i.test(f.name)) {
          const text = await f.text();
          app.docs.create({ title: f.name.replace(/\.[^.]+$/, ''), text, ext: f.name.split('.').pop() });
        } else app.ui.toast(app.t('Use File → Open to open “{name}”. Markooj can’t read it from a drop.', { name: f.name }), { kind: 'warn', actions: [{ label: app.t('Open…'), run: () => app.commands.run('file.open') }] });
      }
    });
  }

  // ---------- pictures from the web (main blocks http(s) loads unless this is on) ----------
  const remoteOn = () => app.settings.get('remoteImages', false) === true;
  const remoteToldFor = new Set();
  app.hooks.postRender((el, doc) => {
    if (remoteOn() || !el?.querySelectorAll || el.classList?.contains('mk-export-stage')) return;
    const imgs = [...el.querySelectorAll('img[src^="http:" i], img[src^="https:" i], img[src^="//"]')];
    if (!imgs.length) return;
    for (const img of imgs) {
      img.classList.add('mk-remote-off');
      img.title = app.t('A picture from the web. Markooj does not load it, so opening a document never contacts other servers. Turn it on in File → Options → Privacy.');
    }
    const key = doc?.id || 'x';
    if (remoteToldFor.has(key)) return;
    remoteToldFor.add(key);
    app.ui.toast(app.tn('This document has {count} pictures from the web. Markooj didn’t load them.', imgs.length), { kind: 'info', action: { label: app.t('Load pictures'), run: () => { app.settings.set('remoteImages', true); app.editors.active()?.refresh?.(); } } });
  });
  app.options.addSection({
    id: 'privacy', label: app.tm('Privacy'), order: 65,
    render(el) {
      el.innerHTML = '';
      const row = document.createElement('label');
      row.style.cssText = 'display:flex;gap:8px;align-items:center;font-size:13px;color:var(--text)';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = remoteOn();
      cb.addEventListener('change', () => { app.settings.set('remoteImages', cb.checked); app.editors.active()?.refresh?.(); app.ui.toast(cb.checked ? app.t('Pictures from the web will load.') : app.t('Pictures from the web stay hidden.')); });
      row.append(cb, document.createTextNode(app.t('Load pictures from the web in documents')));
      const hint = document.createElement('p'); hint.style.cssText = 'margin:8px 0 0;font-size:12px;color:var(--text-3)';
      hint.textContent = app.t('Off by default: a picture on someone’s server tells them when you opened their document. Links still open in your browser when you click them.');
      el.append(row, hint);
    },
  });

  // ---------- closing the window ----------
  let closing = false;
  async function onRequestClose() {
    if (closing) return;
    closing = true;
    let closed = false;
    try {
      // the native X / Alt+F4 does not blur the page, so typing the Word editor still holds must be committed now
      try { app.editors.active()?.flush?.(); } catch {}
      // a document another Markooj window still shows (View → New Window) stays open there, so closing this window never
      // asks about it; when both windows close at once, exactly one of them asks (src/windows.js prepareClose)
      let elsewhere = null;
      try { elsewhere = (await app.windows?.prepareClose?.()) || null; } catch {}
      const shared = d => (elsewhere ? elsewhere.has(d.id) : false);
      const dirty = app.docs.list().filter(d => d.dirty && d.kind === 'markdown' && !shared(d));
      // clean documents leave no recovery copies (they would show up as a "crash" next time); nor do documents another window keeps
      for (const d of app.docs.list()) if ((!d.dirty || shared(d)) && d.kind === 'markdown') await mk.invoke('recovery-delete', d.recoveryId).catch(() => {});
      if (!dirty.length) { closed = true; await mk.invoke('confirm-close'); return; }
      // Always keep a recovery copy first, so nothing is lost even if something fails below.
      for (const d of dirty) await mk.invoke('recovery-save', { docId: d.recoveryId, path: d.path, title: d.title, text: d.text }).catch(() => {});
      const days = app.settings.get('recoveryDays', 7);
      const list = dirty.map(d => `<li>${app.esc(d.title)}${d.path ? '' : ` <span style="color:var(--text-3)">${app.th('(never saved)')}</span>`}</li>`).join('');
      const v = await app.ui.dialog({
        title: app.t('You have unsaved documents'),
        icon: 'save', kind: 'warn',
        body: `<p>${app.th('Save your changes before closing?')}</p><ul style="margin:6px 0 10px;padding-left:18px">${list}</ul><p style="font-size:12px;color:var(--text-3)">${app.th('If you don’t save, Markooj keeps a copy in File → Recover for {count} days.', { count: days })}</p>`,
        buttons: [
          { label: app.tn('Don’t Save (keep in Recover {count} days)', days), value: 'discard', danger: true, left: true },
          { label: app.t('Cancel'), value: 'cancel' },
          { label: app.t('Save All'), value: 'save', primary: true },
        ],
        cancelValue: 'cancel',
      });
      if (v === 'save') {
        for (const d of dirty) {
          app.docs.activate(d.id);
          const ok = await app.docs.save(d);
          if (!ok) { app.ui.toast(app.t('Save “{name}”, or close again and choose Don’t Save. Markooj stays open until then.', { name: d.title }), { kind: 'warn', actions: [{ label: app.t('Close again'), run: () => onRequestClose() }] }); return; }
        }
        closed = true; await mk.invoke('confirm-close');
      } else if (v === 'discard') {
        for (const d of dirty) await mk.invoke('recovery-mark-closed', d.recoveryId).catch(() => {});
        closed = true; await mk.invoke('confirm-close');
      }
    } catch (e) {
      console.error(e);
      app.ui.fail(e, { lead: app.t('Try closing again. Your unsaved text is kept in File → Recover.'), hideReason: true, retry: () => onRequestClose() });
    } finally {
      closing = false;
      // tell main the request was answered, so the next X shows the save prompt again (not "Close anyway?")
      if (!closed) { mk.invoke('close-cancelled').catch(() => {}); try { app.windows?.closeCancelled?.(); } catch {} }
    }
  }

  // ---------- smoke test ----------
  const SAMPLE = `---
title: Smoke Test Paper
author: Markooj Smoke
date: 2026-11-21
keywords: smoke, markdown, math
abstract: A short paper that exercises math, tables, footnotes, citations and diagrams.
xref:
  numbering: chapter
math-macros: '\\newcommand{\\vect}[1]{\\mathbf{#1}}'
---

# Introduction

Inline math with dollars $E = mc^2$ and with parentheses \\(a^2 + b^2 = c^2\\), the deviation $|H - C_{prev}|$. A vector $\\vect{v}$ from the math macros.

$$
\\theta = \\frac{\\tau_b}{(\\rho_s - \\rho)\\, g\\, D}
$$ {#eq:shields}

\\[
q^* = 8\\,(\\theta - \\theta_c)^{3/2}
\\]

## Data

| Run | D (mm) | θ |
|-----|-------:|------:|
| R1  | 2.0    | 0.061 |
| R2  | 4.5    | 0.078 |

: Flume runs {#tbl:runs}

The runs in @tbl:runs follow @eq:shields. <!-- comment: add R3 --> %%Check the R2 grain size.%%

A claim with a footnote.[^1] Classic work frames this as a ratio of forces [@shields1936].

- [x] Calibrated
- [ ] Repeated

> [!NOTE]
> @eq:shields holds for uniform gravel.

\`\`\`mermaid
flowchart LR
  A[Flume runs] --> B[Compute theta] --> C[Predict q] --> D[Compare]
\`\`\`

\`\`\`python
print("hello")
\`\`\`

[^1]: Grain sizes are median diameters.
`;
  function joinPath(dir, name) { const sep = dir.includes('\\') ? '\\' : '/'; return dir.replace(/[\\/]+$/, '') + sep + name; }
  async function shot(name, results) {
    try { await mk.invoke('smoke-shot', name); results.push({ name: 'screenshot: ' + name, ok: true }); }
    catch (e) { results.push({ name: 'screenshot: ' + name, ok: false, error: String(e && e.message || e) }); }
  }
  // End-to-end checks that need the files the export step just wrote.
  async function integration(outDir, results) {
    // since 1.2 Pandoc and the DjVu tools are optional Features: a slim copy without them skips the checks that need them
    let tools = {}; try { tools = await mk.invoke('tools') || {}; } catch {}
    const have = { pandoc: !!tools.pandoc, djvu: !!(tools.ddjvu && tools.pdf2djvu) };
    const check = async (name, fn, needs) => {
      if (needs && !have[needs]) { results.push({ name: 'e2e: ' + name, ok: true, skipped: `${needs} is not installed (optional feature)` }); return; }
      try { await fn(); results.push({ name: 'e2e: ' + name, ok: true }); }
      catch (e) { results.push({ name: 'e2e: ' + name, ok: false, error: String(e && e.stack || e) }); }
    };
    const A = app.assert;
    const hostState = () => { const h = document.getElementById('editorHost'); return `mode ${app.mode}, active ${app.docs.active()?.kind}, host: ${(h?.innerHTML || '').replace(/\s+/g, ' ').slice(0, 160)}`; };
    const opened = [];
    const open = async f => { const d = await app.docs.open(joinPath(outDir, f)); opened.push(d); await sleep(700); return d; };
    await check('DOCX opens as Markdown and Save goes to Save As', async () => {
      const d = await open('smoke.docx');
      A(d.kind === 'markdown' && d.convertedFrom === 'docx', 'converted docx: ' + d.kind + ' ' + d.convertedFrom);
      A(/\$/.test(d.text) && /title:\s*Smoke Test Paper/.test(d.text), 'math and front matter came back');
    }, 'pandoc');
    await check('Pandoc exports expand math macros and turn callouts and diagrams into plain content', async () => {
      const tex = await mk.invoke('read-text', joinPath(outDir, 'smoke.tex'));
      A(!/\[!NOTE\]|\{\[\}!NOTE/.test(tex), 'no literal [!NOTE] in LaTeX');
      A(!/flowchart/.test(tex), 'the diagram is a picture in LaTeX, not code');
      const d = await open('smoke.docx');
      A(!/\\vect/.test(d.text) && /mathbf/.test(d.text), 'DOCX math uses the expanded macro: ' + (d.text.match(/.{0,40}mathbf.{0,20}/) || [''])[0]);
      A(!/\[!NOTE\]/.test(d.text) && !/flowchart LR/.test(d.text), 'DOCX has no callout marker or diagram code');
      const txt = await mk.invoke('read-text', joinPath(outDir, 'smoke.txt'));
      A(/\(1\.1\)/.test(txt.split('Data')[0]), 'plain text keeps the equation number next to the equation');
    }, 'pandoc');
    await check('EPUB opens once (no repeated title page)', async () => {
      const d = await open('smoke.epub');
      A(d.kind === 'markdown', 'markdown');
      A((d.text.match(/Smoke Test Paper/g) || []).length <= 2, 'title appears at most twice:\n' + d.text.slice(0, 300));
    });
    await check('ODT, RTF and LaTeX open through Pandoc', async () => {
      for (const f of ['smoke.odt', 'smoke.rtf', 'smoke.tex']) { const d = await open(f); A(d.kind === 'markdown' && d.convertedFrom && /Introduction/.test(d.text), f); }
    }, 'pandoc');
    await check('PDF opens in the viewer with its properties', async () => {
      const d = await open('smoke.pdf');
      A(d.kind === 'pdf' && d.readOnly, 'pdf viewer doc');
      A(d.meta && d.meta.title === 'Smoke Test Paper' && d.meta.author === 'Markooj Smoke', 'pdf meta: ' + JSON.stringify(d.meta));
      // pdf.js draws the first page after it loads its worker: give a busy machine up to 15 s, like the DjVu check
      for (let t = 0; t < 60 && !document.querySelector('#editorHost canvas, #editorHost .textLayer, #editorHost img'); t++) await sleep(250);
      A(document.querySelector('#editorHost canvas, #editorHost .textLayer, #editorHost img'), 'a page is drawn; ' + hostState());
    });
    await check('DjVu opens in the viewer with the bundled DjVuLibre', async () => {
      const d = await open('smoke.djvu'); await sleep(1200);
      A(d.kind === 'djvu' && d.pages >= 1 && !d.missing, 'djvu pages: ' + d.pages + ' missing: ' + d.missing);
      // ddjvu runs twice (a small first page, then the page at screen resolution); give a busy machine time
      for (let t = 0; t < 60 && !document.querySelector('#editorHost img'); t++) await sleep(250);
      A(document.querySelector('#editorHost img'), 'a DjVu page image is shown; ' + hostState());
    }, 'djvu');
    await check('closing without saving keeps a recovery copy', async () => {
      const d = app.docs.create({ title: 'Recovery e2e', text: '# Keep me\n\nUnsaved words.' });
      d.setText(d.text + '\nMore.', 'test');
      const closing = app.docs.close(d.id);
      let btn = null;
      for (let i = 0; i < 40 && !btn; i++) { await sleep(50); btn = [...document.querySelectorAll('#dialogLayer button, .dlg button')].find(b => /Don.t Save/i.test(b.textContent)); }
      A(btn, 'the Save changes? dialog offers Don’t Save');
      btn.click();
      A(await closing, 'tab closed');
      const list = await mk.invoke('recovery-list');
      const e = list.find(x => x.title === 'Recovery e2e');
      A(e && e.closedAt && /Unsaved words/.test(e.preview), 'entry kept with closedAt: ' + JSON.stringify(e));
      const days = await app.settings.get('recoveryDays', 7);
      A(days >= 7, 'kept at least 7 days, setting is ' + days);
    });
    await check('tab strip on the left keeps the page full width', async () => {
      const prev = app.settings.get('tabPosition', 'top');
      await app.commands.run('view.tabPosition', 'left'); await sleep(400);
      const host = document.getElementById('editorHost').getBoundingClientRect(), vt = document.getElementById('vtabs').getBoundingClientRect();
      const ok = vt.width > 100 && host.left >= vt.right - 1 && host.right >= innerWidth - 2;
      await app.commands.run('view.tabPosition', prev); await sleep(200);
      A(ok, `vtabs ${Math.round(vt.left)}–${Math.round(vt.right)}, host ${Math.round(host.left)}–${Math.round(host.right)}, window ${innerWidth}`);
    });
    for (const d of opened) { try { await app.docs.close(d.id, { force: true }); } catch {} }
  }
  // ---------- the message rule: every error or warning toast says what to do ----------
  // A toast of kind error or warning needs an action button (not just Details) or a remedy verb in its text
  // (Try, Choose, Open, Save, Install, Turn, Check, Copy, Click, Press, Use, Add, Remove, Close, Restart, Download, Get, Pick, Select).
  function toastAudit(since = 0) {
    const log = (app.ui.toastLog || []).slice(since);
    const judged = log.filter(t => !t.dialog && (t.kind === 'error' || t.kind === 'warn'));
    const ok = t => (app.ui.isActionable ? app.ui.isActionable(t.msg, { actions: (t.actions || []).map(label => ({ label })) }) : true);
    return { checked: judged.length, bad: judged.filter(t => !ok(t)) };
  }
  const auditText = bad => bad.map(t => `[${t.kind}] “${t.msg}”${t.actions?.length ? ' buttons: ' + t.actions.join(', ') : ''} (during ${t.test || 'start-up or e2e'})`).join('\n');
  app.messages = { audit: toastAudit };
  app.tests.register('messages: the checker tells a remedy from a problem-first message', () => {
    const A = app.assert, ok = app.ui.isActionable;
    A(typeof ok === 'function' && Array.isArray(app.ui.toastLog), 'app.ui.isActionable and app.ui.toastLog exist');
    A(!ok('DjVuLibre is missing from this copy of Markooj.', {}), 'problem-first text without a button fails');
    A(!ok('Export failed.', { actions: [{ label: 'Details' }] }), 'a Details button alone is not a remedy');
    A(ok('Export failed.', { actions: [{ label: 'Try again' }] }), 'an action button passes');
    A(ok('To open DjVu files, Markooj needs the free DjVuLibre tools. Get DjVuLibre from its website.', {}), 'a remedy verb passes');
    A(!ok('could not open the file', {}), 'lower-case "open" in a problem sentence is not a remedy');
    // fail(): code-like errors go under Details, a plain message comes after the lead, an unknown error offers Report this
    const n0 = app.ui.toastLog.length;
    const t1 = app.ui.fail(new TypeError("Cannot read properties of undefined (reading 'x')"));
    const e1 = app.ui.toastLog[app.ui.toastLog.length - 1];
    A(app.ui.toastLog.length > n0 && !/TypeError|undefined/.test(e1.msg) && e1.actions.includes('Report this') && e1.details, 'raw error hidden, Report this offered: ' + JSON.stringify(e1));
    const t2 = app.ui.fail(Object.assign(new Error("ENOENT: no such file or directory, open 'C:\\x.md'"), { code: 'ENOENT' }), { retry: () => {} });
    const e2 = app.ui.toastLog[app.ui.toastLog.length - 1];
    A(/^Check that the file is still there/.test(e2.msg) && e2.actions[0] === 'Try again' && !/ENOENT/.test(e2.msg), 'system code turned into a remedy: ' + e2.msg);
    const t3 = app.ui.fail(new Error('The disk is full.'), { lead: 'Choose another folder.' });
    const e3 = app.ui.toastLog[app.ui.toastLog.length - 1];
    A(e3.msg === 'Choose another folder. The disk is full.', 'lead first, plain reason after: ' + e3.msg);
    [t1, t2, t3].forEach(t => t?.close?.());
  });
  app.tests.register('messages: error and warning toasts so far say what to do', () => {
    const { checked, bad } = toastAudit();
    app.assert(!bad.length, `${bad.length} of ${checked} error/warning toasts lead with the problem and offer no remedy:\n` + auditText(bad));
  });

  let smokeRan = false;
  async function runSmoke(outDir, only) {
    if (smokeRan) return; smokeRan = true;
    window.__mkSmokeStarted = true;
    const results = [];
    try {
      if (only) {
        // fast developer run: only the matching tests, no exports or end-to-end checks
        let re; try { re = new RegExp(only, 'i'); } catch { re = { test: n => n.toLowerCase().includes(String(only).toLowerCase()) }; }
        results.push(...(await app.tests.run(t => re.test(t.name))));
        return;
      }
      try { results.push(...(await app.tests.run())); }
      catch (e) { results.push({ name: 'tests.run', ok: false, error: String(e && e.stack || e) }); }
      const missing = app.shell?.missingRibbonCommands || [];
      results.push({ name: `info: ribbon items without a command (${missing.length})`, ok: true, info: missing });

      const doc = app.docs.create({ title: 'Smoke Test Paper', text: SAMPLE });
      await sleep(400);
      let formats = [];
      try { formats = (await app.exporter.formats()).filter(f => f.available !== false); } catch (e) { results.push({ name: 'export-formats', ok: false, error: String(e) }); }
      const ids = ['md', 'txt', ...formats.map(f => f.id).filter(id => id !== 'md' && id !== 'txt')];
      for (const id of ids) {
        const f = formats.find(x => x.id === id) || { ext: id };
        const out = joinPath(outDir, `smoke.${f.ext || id}`);
        try {
          if (app.exporter?.exportTo) await app.exporter.exportTo(id, doc, out);
          else {
            const html = await app.exporter.buildHtml(doc, { forPrint: id !== 'html' });
            await mk.invoke('export', { format: id, out, html, md: doc.text, title: 'Smoke Test Paper', meta: {} });
          }
          results.push({ name: `export: ${id}`, ok: true, out });
        } catch (e) { results.push({ name: `export: ${id}`, ok: false, error: String(e && e.message || e) }); }
      }

      await integration(outDir, results);

      app.docs.activate(doc.id);
      app.backstage.close();
      app.setMode('word'); await sleep(900); await shot('word', results);
      app.setMode('simple'); await sleep(900); await shot('simple', results);
      app.setMode('inline'); await sleep(1100); await shot('inline', results);
      app.setMode('read'); await sleep(1100); await shot('read', results);
      app.setMode('word'); await sleep(900);
      // the equation editor and the Cross-reference dialog, on top of the sample paper
      try {
        const p = app.equationEditor?.open?.({ tex: '\\tau_c = \\theta_c\\left(\\rho_s - \\rho\\right) g\\, d_{50}', display: true, label: 'eq:critical', numbered: true });
        if (p) {
          const cur = app.equationEditor.current;
          for (let i = 0; i < 60 && !(cur && cur.mf); i++) await sleep(100);
          await sleep(700); await shot('equation-editor', results);
          try { cur?.cancel?.(); } catch {}
          await p;
        } else results.push({ name: 'screenshot: equation-editor', ok: false, error: 'app.equationEditor.open is missing' });
      } catch (e) { results.push({ name: 'screenshot: equation-editor', ok: false, error: String(e && e.message || e) }); }
      try {
        const p = app.xref?.dialogs?.crossref?.({ kind: 'eq' });
        if (p) {
          await sleep(600); await shot('crossref-dialog', results);
          document.querySelector('.dlg.show .dlg-foot .btn:not(.primary)')?.click();
          await Promise.race([p, sleep(2000)]);
        } else results.push({ name: 'screenshot: crossref-dialog', ok: false, error: 'app.xref.dialogs.crossref is missing' });
      } catch (e) { results.push({ name: 'screenshot: crossref-dialog', ok: false, error: String(e && e.message || e) }); }
      app.setMode('word'); app.backstage.open('saveas'); await sleep(900); await shot('backstage', results);
      app.backstage.close();
      app.shell?.selectTab?.('developer'); await sleep(600); await shot('developer', results);
      app.backstage.open('info'); await sleep(900); await shot('info', results);
      app.backstage.open('recover'); await sleep(900); await shot('recover', results);
      app.backstage.close(); app.shell?.selectTab?.('home'); await sleep(400); await shot('home', results);
      const theme = app.settings.get('theme', 'system');
      app.settings.set('theme', 'dark'); app.shell?.applyTheme?.(); await sleep(900); await shot('dark', results);
      app.settings.set('theme', theme); app.shell?.applyTheme?.();
    } catch (e) {
      results.push({ name: 'smoke runner', ok: false, error: String(e && e.stack || e) });
    } finally {
      // the whole run, exports and end-to-end checks included
      try {
        const { checked, bad } = toastAudit();
        results.push({ name: `messages: every error or warning toast in this run says what to do (${checked} checked)`, ok: !bad.length, error: bad.length ? auditText(bad) : undefined });
      } catch (e) { results.push({ name: 'messages: toast audit', ok: false, error: String(e && e.stack || e) }); }
      try { await mk.invoke('smoke-done', results); } catch (e) { console.error('smoke-done failed', e); }
    }
  }

  app.tests.register('app: boot created a document and listens for files', () => {
    app.assert(app.docs.list().length >= 1, 'at least one document is open');
    app.assert(typeof app.setZoom === 'function', 'app.setZoom defined');
    app.assert(document.getElementById('editorHost'), 'editor host exists');
  });

  boot().catch(e => {
    console.error('boot failed', e);
    booted = true;
    if (!app.docs.list().length) try { app.docs.create({ title: app.t('Untitled') }); } catch {}
    app.events.emit('ready'); resolveBoot();
  });
})();
