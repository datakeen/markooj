// Markooj — startup self-check of the bundled programs (Pandoc, pdf2djvu, DjVuLibre).
// Main answers IPC 'tools-health' (each program started once with a version call, cached) and sends
// 'tools-health' again when a program fails to start while Markooj runs. This file shows one calm,
// non-blocking message when something is missing: what still works, what is off, and how to fix it.
// API: app.health = { check({refresh}), last(), describe(result), showDetails(result?), summary(result) }
// Event: app.events 'tools:health' (result). Command: help.checkTools.
(function () {
  'use strict';
  const app = window.app, mk = window.mk;
  if (!app || !mk) return;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = name => `<svg class="i"><use href="#${esc(name)}"/></svg>`;
  let last = null, notifiedKey = '';

  // What each program is for, in words a Word user knows.
  const USES = {
    pandoc: {
      label: 'Pandoc',
      off: 'Save As OpenDocument, Rich Text, LaTeX, PowerPoint and the other Pandoc formats, opening Word, OpenDocument and LaTeX files, and Pandoc-quality Word and EPUB files',
      short: 'Save As OpenDocument, Rich Text, LaTeX and more',
    },
    pdf2djvu: { label: 'pdf2djvu', off: 'Save As DjVu', short: 'Save As DjVu' },
    ddjvu: { label: 'DjVuLibre', off: 'Viewing DjVu files', short: 'Viewing DjVu files' },
  };
  const STILL_WORKS = 'Writing and editing, Markdown, HTML, PDF, printing, viewing PDF files, and Word (.docx) and EPUB files from the built-in writers still work.';

  async function check(opts = {}) {
    const r = await mk.invoke('tools-health', { refresh: !!opts.refresh });
    last = r;
    app.events.emit('tools:health', r);
    try { app.status.refresh(); } catch {}
    return r;
  }

  /** Plain-English summary: {ok, title, missing:[{id,label,off}], works, fix, lines:[{id,label,ok,version,bundled,path,error}]} */
  function describe(r) {
    r = r || last || {};
    const tools = r.tools || {};
    const missing = (r.missing || []).map(id => ({ id, label: USES[id]?.label || tools[id]?.label || id, off: USES[id]?.off || id }));
    const names = missing.map(m => m.label);
    const list = names.length <= 1 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
    const gone = r.reason === 'missing-during-use' || r.reason === 'blocked-during-use';
    const title = !missing.length ? 'All bundled tools work'
      : gone ? `${list} stopped working while Markooj was running`
      : r.bundleExpected ? `${list} ${missing.length > 1 ? 'are' : 'is'} missing from this copy of Markooj`
      : `${list} ${missing.length > 1 ? 'are' : 'is'} not installed`;
    const lines = Object.values(tools).map(t => ({ id: t.id, label: USES[t.id]?.label || t.label, ok: !!t.ok, version: t.version || null, bundled: !!t.bundled, path: t.path || null, error: t.error || null }));
    return { ok: !missing.length, title, missing, works: STILL_WORKS, fix: r.fix || 'Reinstall Markooj, then restart it.', lines, portable: !!r.portable };
  }

  /** One sentence for a toast or a status tip. */
  function summary(r) {
    const d = describe(r);
    if (d.ok) return d.title + '.';
    return `${d.title}. Off for now: ${d.missing.map(m => USES[m.id]?.short || m.off).join('; ')}. Everything else works.`;
  }

  // Save As reads export-formats (cached 30 s in the exporter): drop that cache so the grid labels follow the check.
  function refreshFormats() {
    try { if (typeof app.exporter?.refreshFormats === 'function') return app.exporter.refreshFormats(); } catch {}
    try { const off = app.exporter?.register?.({ id: 'mk-health-refresh', label: 'Refresh', ext: 'tmp', run() { return ''; } }); if (typeof off === 'function') off(); } catch {}
  }

  function detailsBody(r) {
    const d = describe(r);
    const box = document.createElement('div');
    box.className = 'mk-health';
    const rows = d.lines.map(l => `<tr>
      <td class="mk-health-st ${l.ok ? 'ok' : 'bad'}">${svg(l.ok ? 'check' : 'warn')}</td>
      <td><b>${esc(l.label)}</b>${l.version ? ` <span class="mk-health-v">${esc(l.version)}</span>` : ''}<div class="mk-health-what">${esc(l.ok ? (l.bundled ? 'Included with Markooj' : 'Found on this computer') : 'Off: ' + (USES[l.id]?.off || ''))}</div></td>
    </tr>`).join('');
    box.innerHTML = `
      <p class="mk-health-lead">${esc(d.ok ? 'Pandoc, pdf2djvu and DjVuLibre start and answer. Every format in Save As is ready.' : d.works)}</p>
      <table class="mk-health-t">${rows}</table>
      ${d.ok ? '' : `<p class="mk-health-fix"><b>How to fix:</b> ${esc(d.fix)}</p>`}
      <details class="mk-health-more"><summary>Technical details</summary><ul>${d.lines.map(l => `<li><b>${esc(l.label)}:</b> ${esc(l.path || 'not found')}${l.error ? ` (${esc(l.error)})` : ''}</li>`).join('')}${r && r.toolsDir ? `<li><b>Tools folder:</b> ${esc(r.toolsDir)}</li>` : ''}${r && r.portable ? '<li>Portable copy: settings are kept in the data folder next to Markooj.exe.</li>' : ''}</ul></details>`;
    return box;
  }

  async function showDetails(r) {
    r = r || last || await check();
    const d = describe(r);
    const v = await app.ui.dialog({
      title: d.ok ? 'Bundled tools' : d.title, icon: d.ok ? 'check' : 'warn', kind: d.ok ? '' : 'warn', wide: true,
      body: detailsBody(r),
      buttons: [{ label: 'Check Again', value: 'again', left: true }, { label: 'OK', value: true, primary: true }],
    });
    if (v === 'again') {
      const n = await check({ refresh: true });
      refreshFormats();
      if (n.ok) app.ui.toast('All bundled tools work.', { kind: 'success' });
      else showDetails(n);
    }
    return v;
  }

  // One non-blocking message per distinct problem (a toast with Details; it never stops the user from writing).
  function notify(r) {
    const d = describe(r);
    if (d.ok) { notifiedKey = ''; return; }
    const key = (r.missing || []).join(',') + '|' + (r.reason || '');
    if (key === notifiedKey) return;
    notifiedKey = key;
    app.ui.toast(summary(r), { kind: 'warn', timeout: 15000, actions: [{ label: 'Details', run: () => showDetails(r) }] });
  }

  // Status bar: a small warning button while something is missing (hidden when all is well).
  app.status.addItem({
    id: 'tools-health', side: 'right', order: 5,
    render(el) {
      el.innerHTML = '';
      if (!last || last.ok) return;
      const b = document.createElement('button');
      b.className = 'sb mk-health-sb';
      b.type = 'button';
      b.innerHTML = `${svg('warn')}<span class="hide-narrow">Tools</span>`;
      b.dataset.tip = describe(last).title;
      b.dataset.tipD = summary(last) + ' Click for details.';
      b.setAttribute('aria-label', describe(last).title);
      b.addEventListener('click', () => { try { app.ui.ripple?.(b); } catch {} showDetails(last); });
      el.append(b);
    },
  });

  app.commands.register('help.checkTools', {
    label: 'Check Bundled Tools', icon: 'check',
    description: 'Checks that Pandoc, pdf2djvu and DjVuLibre in this copy of Markooj start, and shows what works if one is missing.',
    run: async () => { await check({ refresh: true }); refreshFormats(); return showDetails(last); },
  });
  try { app.tooltips?.register?.('help.checkTools', { title: 'Check Bundled Tools', description: 'Checks that Pandoc, pdf2djvu and DjVuLibre start, and shows what still works if one is missing.' }); } catch {}

  const style = document.createElement('style');
  style.textContent = `
    .mk-health{min-width:0;overflow-wrap:anywhere}
    .mk-health-lead{margin:0 0 10px}
    .mk-health-t{border-collapse:collapse;width:100%;table-layout:fixed;margin:4px 0 10px}
    .mk-health-t td{padding:6px 6px;vertical-align:top;border-top:1px solid var(--line, rgba(0,0,0,.08))}
    .mk-health-t tr:first-child td{border-top:0}
    .mk-health-st{width:26px}
    .mk-health-st .i{width:16px;height:16px}
    .mk-health-st.ok{color:var(--green, #34c759)}
    .mk-health-st.bad{color:var(--orange, #ff9500)}
    .mk-health-v{color:var(--text-2, #6e6e73);font-size:12px}
    .mk-health-what{color:var(--text-2, #6e6e73);font-size:12px;margin-top:2px}
    .mk-health-fix{margin:0 0 8px}
    .mk-health-more{font-size:12px;color:var(--text-2, #6e6e73)}
    .mk-health-more ul{margin:6px 0 0;padding-left:18px;word-break:break-all}
    .mk-health-sb{color:var(--orange, #ff9500)}
  `;
  document.head.append(style);

  // tools that vanish or are blocked while Markooj runs (main re-checks after a failed start)
  mk.on('tools-health', r => {
    if (!r) return;
    last = r;
    app.events.emit('tools:health', r);
    try { app.status.refresh(); } catch {}
    refreshFormats();
    notify(r);
  });

  // startup: check shortly after the window is ready, so it never slows the first paint
  app.events.on('ready', () => {
    setTimeout(async () => {
      try {
        const r = last || await check(); // someone may have checked already (Help, a smoke test)
        if (!r.ok) { refreshFormats(); notify(r); }
      } catch (e) { console.warn('tools self-check failed', e); }
      try {
        const info = await mk.invoke('app-info');
        const p = info && info.portableInfo;
        if (p && p.error && !p.active) app.ui.toast(p.error, { kind: 'warn', timeout: 12000 });
      } catch {}
    }, 1200);
  });

  app.health = { check, last: () => last, describe, summary, showDetails, notify, refreshFormats };

  // ---------- smoke tests ----------
  const A = app.assert || ((c, m) => { if (!c) throw new Error('Assertion failed: ' + m); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  app.tests.register('health: self-check starts every bundled tool and reports its version', async () => {
    const r = await mk.invoke('tools-health', { refresh: true });
    for (const id of ['pandoc', 'pdf2djvu', 'ddjvu']) A(r.tools && r.tools[id] && 'ok' in r.tools[id] && 'path' in r.tools[id], 'shape for ' + id + ': ' + JSON.stringify(r.tools && r.tools[id]));
    A(Array.isArray(r.missing) && typeof r.ok === 'boolean' && r.fix, 'missing[], ok and fix present');
    A(r.ok === (r.missing.length === 0), 'ok matches missing');
    if (r.bundleExpected) {
      A(r.ok, 'bundled tools all start: ' + JSON.stringify(r.missing.map(id => [id, r.tools[id].error, r.tools[id].path])));
      A(/^\d+\.\d+/.test(r.tools.pandoc.version || ''), 'Pandoc version: ' + r.tools.pandoc.version);
      A(/^\d+\.\d+/.test(r.tools.pdf2djvu.version || ''), 'pdf2djvu version: ' + r.tools.pdf2djvu.version);
      A(/^\d+\.\d+/.test(r.tools.ddjvu.version || ''), 'DjVuLibre version: ' + r.tools.ddjvu.version);
      A(r.tools.pandoc.bundled && r.tools.pdf2djvu.bundled && r.tools.ddjvu.bundled, 'tools come from the bundle');
      const t = await mk.invoke('tools');
      A(t.pandocVersion === r.tools.pandoc.version, `same Pandoc as the tools channel (${t.pandocVersion} / ${r.tools.pandoc.version})`);
    }
    // cached: a second call is quick and returns the same check
    const t0 = performance.now();
    const again = await mk.invoke('tools-health');
    A(again.checkedAt === r.checkedAt, 'second call uses the cached check');
    A(performance.now() - t0 < 1500, 'cached call is quick');
  });

  app.tests.register('health: missing-tool message is plain, says what still works and how to fix it', async () => {
    const fake = {
      ok: false, missing: ['pandoc'], bundleExpected: true, platform: 'win32', packaged: true, fix: 'Reinstall Markooj, or unzip the full portable zip again into a new folder, then restart Markooj.',
      tools: { pandoc: { id: 'pandoc', label: 'Pandoc', ok: false, path: null, error: 'not found' }, pdf2djvu: { id: 'pdf2djvu', label: 'pdf2djvu', ok: true, bundled: true, version: '0.9.19', path: 'x' }, ddjvu: { id: 'ddjvu', label: 'DjVuLibre', ok: true, bundled: true, version: '3.5.30', path: 'y' } },
    };
    const d = describe(fake);
    A(!d.ok && /Pandoc is missing from this copy of Markooj/.test(d.title), 'title: ' + d.title);
    A(/PDF/.test(d.works) && /Word/.test(d.works), 'says what still works');
    const s = summary(fake);
    A(/OpenDocument/.test(s) && /Everything else works/.test(s), 'summary: ' + s);
    const gone = describe({ ...fake, reason: 'missing-during-use' });
    A(/stopped working while Markooj was running/.test(gone.title), 'runtime loss title: ' + gone.title);
    A(!/colour|centre|licence|dialogue/i.test(s + d.works + d.title + d.fix), 'US English');
    // the details dialog opens, lists every tool and closes
    const p = showDetails(fake);
    await sleep(350);
    const dlg = [...document.querySelectorAll('.dlg')].pop();
    A(dlg && dlg.querySelector('.mk-health') && dlg.querySelectorAll('.mk-health-t tr').length === 3, 'dialog lists 3 tools');
    A(/How to fix/.test(dlg.textContent) && /portable zip/.test(dlg.textContent), 'dialog says how to fix');
    try { await mk.invoke('smoke-shot', 'tools-health'); } catch {}
    [...dlg.querySelectorAll('.dlg-foot button')].find(b => b.textContent === 'OK').click();
    A((await p) === true, 'OK closes');
    // the status bar button appears only while something is missing
    const keep = await check(); // the startup check must not land in the middle of this test
    last = fake; app.status.refresh();
    for (let i = 0; i < 20 && !document.querySelector('.mk-health-sb'); i++) await sleep(50);
    A(document.querySelector('.mk-health-sb'), 'status bar warning shows');
    last = keep; app.status.refresh(); await sleep(50);
    if (!keep || keep.ok) A(!document.querySelector('.mk-health-sb'), 'status bar warning hides again');
  });

  app.tests.register('health: a tool that vanishes while running is reported plainly and checked again', async () => {
    let event = null;
    const off = mk.on('tools-health', r => { event = r; });
    try {
      const r = await mk.invoke('tools-simulate-gone');
      A(r.threw && r.code === 'TOOL_GONE' && r.tool === 'pandoc', 'fails with TOOL_GONE: ' + JSON.stringify(r));
      A(/Pandoc is no longer in this copy of Markooj/.test(r.message) && /restart Markooj/.test(r.message), 'plain message: ' + r.message);
      for (let i = 0; i < 100 && !event; i++) await sleep(100);
      A(event && event.reason === 'missing-during-use' && event.failedTool === 'pandoc', 'main re-checked and told the window: ' + JSON.stringify(event && { reason: event.reason, failedTool: event.failedTool }));
      A(Array.isArray(event.missing), 'the re-check carries the fresh result');
      A(last === event || last.checkedAt === event.checkedAt, 'app.health took the fresh result');
    } finally {
      if (typeof off === 'function') off();
      document.querySelectorAll('.toast').forEach(t => t.remove());
      notifiedKey = '';
    }
  });

  app.tests.register('health: portable mode picks the data folder next to the program', async () => {
    let r;
    try { r = await mk.invoke('portable-probe'); } catch (e) { throw new Error('portable-probe unavailable: ' + e.message); }
    const c = Object.fromEntries(r.cases.map(x => [x.name, x]));
    A(!c.none.active && !c.none.dataExists, 'no marker, no data folder: normal profile');
    A(c.marker.active && c.marker.reason === 'portable.txt' && c.marker.dataExists && c.marker.dir === c.marker.expectDir, 'portable.txt: data folder created and used ' + JSON.stringify(c.marker));
    A(c.dataFolder.active && c.dataFolder.reason === 'data folder' && c.dataFolder.dir === c.dataFolder.expectDir, 'existing data folder is used');
    A(!c.dataIsFile.active, 'a file named data alone is not portable mode');
    A(!c.markerButDataIsFile.active && c.markerButDataIsFile.error, 'portable.txt but data cannot be a folder: falls back with a message');
    const info = await mk.invoke('app-info');
    A(info.userDataFrom === 'smoke' && info.portable === false, 'smoke runs keep their own profile: ' + info.userDataFrom);
    A(info.portableInfo && 'active' in info.portableInfo, 'app-info reports portable state');
    if (r.live.packaged && r.live.portable.active) A(r.live.portable.dir.toLowerCase().startsWith(String(r.live.programDir).toLowerCase()), 'live portable folder sits next to the program');
  });

  app.tests.register('health: About facts come from package.json', async () => {
    const info = await mk.invoke('app-info');
    A(/^\d+\.\d+\.\d+/.test(info.version), 'version ' + info.version);
    A(/Ahmed Bilal/.test(info.author || '') && /Copyright © 2026 Ahmed Bilal and contributors/.test(info.copyright || ''), 'author and copyright: ' + info.author + ' / ' + info.copyright);
    // the homepage is the project on GitHub or its website (datakeen.github.io/markooj)
    A(/^https:\/\/(?:github\.com\/datakeen\/markooj|datakeen\.github\.io\/markooj\/?)$/i.test(info.homepage || '') &&/github\.com\/datakeen\/markooj\/issues/i.test(info.bugs || ''), 'project links');
    A(info.license === 'AGPL-3.0-or-later', 'license: ' + info.license);
    const lic = await mk.invoke('read-text', info.licenseFile);
    A(/GNU AFFERO GENERAL PUBLIC LICENSE/.test(lic) && /Version 3, 19 November 2007/.test(lic), 'LICENSE (AGPL v3) readable at ' + info.licenseFile);
    const notes = await mk.invoke('read-text', info.noticesFile);
    A(/Third-party notices/.test(notes) && /AGPL-3.0-or-later/.test(notes) && /Pandoc/.test(notes) && /Harper/.test(notes) && /datakeen\/markooj/i.test(notes), 'notices readable and complete');
    // the license texts are read from where the app keeps them (resources/licenses in a packaged copy, licenses/ here)
    A(info.licensesDir, 'app-info names the licenses folder');
    const harper = await mk.invoke('read-text', info.licensesDir + (mk.platform === 'win32' ? '\\' : '/') + 'harper-LICENSE.txt');
    A(/Apache License/.test(harper || ''), 'licenses folder readable: ' + info.licensesDir);
  });
})();
