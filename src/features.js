// Markooj — Features: optional parts (Pandoc, DjVu tools, Python macros) that download when wanted.
//
// File → Options → Features lists every feature with what it powers, its download and installed size, and Install /
// Update / Remove / Cancel; "Install from file…" takes a zip downloaded by hand. A floating progress card (Cancel, Hide)
// shows downloads. The Welcome sheet of a fresh install gets a "Choose extra features" step (src/welcome.js calls
// app.features.welcomeStep). After the Windows installer, <resources>/first-run.json names the language and the features
// chosen on its pages: the first start downloads those in the background and keeps the language as `uiLanguage`.
// When something needs a feature that is not there (a Python macro, a Pandoc format, a DjVu file), app.features.ensure()
// offers to install it; Check Tools and the "how to get it" dialogs (src/health.js) use the action id `install-feature`.
//
// API: app.features = { list({refresh}), get(id), install(id, {quiet, file}), installMany(ids, {background}),
//   installFromFile(id?), remove(id, {confirm}), cancel(id?), ensure(id, {goal}), open(), forTool(toolId, platform),
//   welcomeStep(sheet), firstRun({test}), applyFirstRun(r, {install}), progress: {show, hide}, sizeText(bytes) }
// Events: 'features:changed' (list), 'features:installed' {id, version}, 'features:removed' {id}, 'features:progress' (p).
// Commands: features.open, features.installPandoc, features.installDjvu, features.installPython, features.installFromFile,
//   features.cancel. Settings: uiLanguage (from the installer, only when not set), features.firstRunKey, features.welcomeDone.
(function () {
  'use strict';
  const app = window.app, mk = window.mk;
  if (!app || !mk) return;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = name => `<svg class="i"><use href="#${esc(name)}"/></svg>`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // What each feature is, for messages before the first features-list answer (and for other systems in tests)
  const STATIC = {
    pandoc: { id: 'pandoc', name: 'Pandoc', icon: 'export', platforms: ['win32', 'darwin', 'linux'], download: 41 * 1048576, installed: 230 * 1048576, tools: ['pandoc'],
      ready: app.tm('You can save as LaTeX, OpenDocument, Rich Text, PowerPoint and more.') },
    djvu: { id: 'djvu', name: app.tm('DjVu tools'), icon: 'doc', platforms: ['win32'], download: 15 * 1048576, installed: 37 * 1048576, tools: ['ddjvu', 'djvutxt', 'djvused', 'djvm', 'c44', 'pdf2djvu'],
      ready: app.tm('DjVu files open now, and you can save as DjVu.') },
    python: { id: 'python', name: app.tm('Python macros'), icon: 'python', platforms: ['any'], download: 6 * 1048576, installed: 13 * 1048576, tools: [],
      ready: app.tm('Python macros run now (Developer tab).') },
  };
  const IDS = Object.keys(STATIC);
  const TOOL_FEATURE = {};
  for (const f of Object.values(STATIC)) for (const t of f.tools) TOOL_FEATURE[t] = f.id;

  let last = null;               // the last features-list answer
  const jobs = new Map();        // id → {id, name, phase, received, total, percent, promise}
  const test = { forceWelcome: false, installSpy: null };

  function sizeText(n, o = {}) {
    n = Number(n) || 0;
    const one = x => (app.i18n?.number ? app.i18n.number(x, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : x.toFixed(1));
    if (n >= 1000 * 1048576) return app.t('{size} GB', { size: one(n / 1073741824) });
    if (o.exact && n < 10 * 1048576) return app.t('{size} MB', { size: one(n / 1048576) }); // progress: 0.4 MB of 6.1 MB
    return app.t('{size} MB', { size: app.i18n?.number ? app.i18n.number(Math.max(1, Math.round(n / 1048576))) : Math.max(1, Math.round(n / 1048576)) });
  }
  // main sends the names in the interface language; the built-in names are English keys
  const nameOf = id => (last && last.features.find(f => f.id === id)?.name && app.t(last.features.find(f => f.id === id).name)) || (STATIC[id] ? app.t(STATIC[id].name) : id);
  const listOf = names => (app.i18n && !/^(en|qps)$/.test(app.i18n.language()) ? app.i18n.list(names) : names.join(', '));

  async function list(o = {}) {
    try { last = await mk.invoke('features-list', { refresh: !!o.refresh }); }
    catch (e) { console.warn('features-list', e); if (!last) last = { features: [], platform: '', manifest: null }; }
    app.events.emit('features:changed', last);
    return last;
  }
  const get = id => (last && last.features.find(f => f.id === id)) || null;

  /** The feature that brings a tool, and whether Markooj can download it on `platform`: {id, name, available, downloadText}. */
  function forTool(toolId, platform = mk.platform) {
    const fam = toolId === 'djvulibre' ? 'ddjvu' : toolId;
    const id = TOOL_FEATURE[fam] || (STATIC[fam] ? fam : null);
    if (!id) return null;
    const S = STATIC[id], f = get(id);
    const here = !platform || platform === mk.platform;
    const available = here && f ? !!f.available : S.platforms.includes('any') || S.platforms.includes(platform);
    return { id, name: app.t(S.name), available, download: here && f ? f.download : S.download, downloadText: sizeText(here && f ? f.download : S.download) };
  }

  // ---------- installing ----------
  function isCancel(e) { const i = mk.errorInfo?.(e); return (i && i.code === 'FEATURE_CANCELLED') || /^Cancelled\.?$/.test(String(app.ui.plainError ? app.ui.plainError(e, '') : e && e.message)); }
  /** Install one feature with a progress card. Resolves true when it is installed, false when not (the user saw why). */
  function install(id, o = {}) {
    if (test.installSpy) return Promise.resolve(test.installSpy(id, o));
    if (!id || !STATIC[id]) { open(); return Promise.resolve(false); }
    if (jobs.has(id)) { progressCard.show(); return jobs.get(id).promise; }
    const job = { id, name: nameOf(id), phase: 'start', received: 0, total: 0, percent: null };
    jobs.set(id, job);
    progressCard.show(); renderAll();
    job.promise = (async () => {
      try {
        const r = await mk.invoke(o.file ? 'features-install-file' : 'features-install', o.file ? { file: o.file, id } : id, ...(o.file ? [] : [{ refresh: !!o.refresh }]));
        jobs.delete(id);
        await list();
        try { await app.health?.check?.({ refresh: true }); app.health?.refreshFormats?.(); } catch {}
        if (!o.quiet) app.ui.toast(app.t('{feature} is ready. {ready}', { feature: nameOf(id), ready: app.t(STATIC[id].ready) }), { kind: 'success', timeout: 5000 });
        app.events.emit('features:installed', { id, version: r && r.version });
        return true;
      } catch (e) {
        jobs.delete(id);
        if (isCancel(e)) { if (!o.quiet) app.ui.toast(app.t('{feature} was not installed. You can install it any time from File → Options → Features.', { feature: nameOf(id) }), { kind: 'info', timeout: 5000 }); return false; }
        if (o.throw) throw e;
        app.ui.fail(e, { retry: () => install(id, { ...o, refresh: true }), ctx: { 'feature-from-file': () => installFromFile(id) } });
        return false;
      } finally { progressCard.update(); renderAll(); }
    })();
    return job.promise;
  }
  /** Several features one after another (first start after the installer, the Welcome step). */
  async function installMany(ids, o = {}) {
    const out = {};
    for (const id of ids) out[id] = await install(id, { quiet: !!o.background });
    const ok = ids.filter(id => out[id]);
    if (o.background && ok.length) app.ui.toast(app.tn('{names} are ready.', ok.length, { names: listOf(ok.map(nameOf)) }), { kind: 'success', timeout: 5000 });
    return out;
  }
  async function installFromFile(id) {
    let r;
    try { r = await mk.invoke('features-install-file', id ? { id } : {}); }
    catch (e) { app.ui.fail(e, { ctx: { 'feature-from-file': () => installFromFile(id) } }); return false; }
    if (!r) return false; // the picker was closed
    await list();
    try { await app.health?.check?.({ refresh: true }); app.health?.refreshFormats?.(); } catch {}
    app.ui.toast(STATIC[r.id] ? app.t('{feature} is ready. {ready}', { feature: nameOf(r.id), ready: app.t(STATIC[r.id].ready) }) : app.t('{feature} is ready.', { feature: nameOf(r.id) }), { kind: 'success', timeout: 5000 });
    app.events.emit('features:installed', { id: r.id, version: r.version });
    renderAll();
    return true;
  }
  async function remove(id, o = {}) {
    const f = get(id) || (await list(), get(id));
    if (!f || !f.installed) return false;
    if (o.confirm !== false) {
      const ok = await app.ui.dialog({
        title: app.t('Remove {feature}?', { feature: app.t(f.name) }), icon: 'trash',
        body: `<p>${app.th('This frees about {size}.', { size: sizeText(f.installed.size || f.installedSize) })} ${esc(f.without || '')}</p><p>${app.th('You can install it again any time from File → Options → Features.')}</p>`,
        buttons: [{ label: app.t('Cancel'), value: false }, { label: app.t('Remove'), value: true, primary: true, danger: true }], cancelValue: false,
      });
      if (!ok) return false;
    }
    try { await mk.invoke('features-remove', id); }
    catch (e) { app.ui.fail(e, { retry: () => remove(id, { confirm: false }) }); return false; }
    await list();
    try { await app.health?.check?.({ refresh: true }); app.health?.refreshFormats?.(); } catch {}
    app.ui.toast(app.t('{feature} was removed. Install it again any time from File → Options → Features.', { feature: app.t(f.name) }), { kind: 'success', timeout: 4000 });
    app.events.emit('features:removed', { id });
    renderAll();
    return true;
  }
  async function cancel(id) { try { return await mk.invoke('features-cancel', id || null); } catch { return 0; } }

  /** Something needs a feature: true when it is there (or the user installed it now), false otherwise. */
  async function ensure(id, o = {}) {
    if (!STATIC[id]) return false;
    await list();
    const f = get(id);
    if (f && (f.state === 'installed' || f.state === 'included' || (f.state === 'system' && id !== 'python'))) return true;
    if (jobs.has(id)) return jobs.get(id).promise;
    const name = app.t((f && f.name) || STATIC[id].name);
    const goal = app.t(o.goal || STATIC[id].ready);
    if (f && !f.available) { open(); return false; }
    const box = document.createElement('div');
    box.className = 'mkfeat-ask';
    box.innerHTML = `<p class="mk-sol-lead">${app.th('Install {feature} to {goal}. It is an optional part of Markooj: it downloads once ({size}) and then works offline.', { feature: name, goal, size: sizeText(f ? f.download : STATIC[id].download) })}</p>
      ${f && f.powers ? `<ul class="mkfeat-powers">${f.powers.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      <p class="mk-sol-still">${esc((f && f.without) || app.t('Everything else works without it.'))}</p>`;
    const v = await app.ui.dialog({
      title: app.t('Install {feature}', { feature: name }), icon: STATIC[id].icon, body: box, wide: false, cancelValue: 'close',
      buttons: [{ label: app.t('Install from file…'), value: 'file', left: true }, { label: app.t('Not now'), value: 'close' }, { label: app.t('Install ({size})', { size: sizeText(f ? f.download : STATIC[id].download) }), value: 'install', primary: true }],
    });
    if (v === 'install') return install(id);
    if (v === 'file') return installFromFile(id);
    return false;
  }

  // ---------- the floating progress card ----------
  const progressCard = (() => {
    let el = null, hidden = false;
    function build() {
      el = document.createElement('div');
      el.className = 'mkfeat-prog';
      el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
      el.innerHTML = `<div class="mkfeat-prog-head"><span class="mkfeat-prog-ic">${icon('import')}</span><b class="mkfeat-prog-title"></b>
        <button type="button" class="mkfeat-prog-x">${icon('x')}</button></div>
        <div class="mkfeat-prog-list"></div>`;
      el.querySelector('.mkfeat-prog-x').addEventListener('click', () => { hidden = true; el.classList.remove('show'); });
      document.body.append(el);
    }
    function rowHtml(j) {
      const pct = j.total ? Math.min(100, Math.round(j.received * 100 / j.total)) : null;
      const phase = j.phase === 'download' && j.total ? app.t('Downloading… {received} of {total}', { received: sizeText(j.received, { exact: true }), total: sizeText(j.total, { exact: true }) })
        : j.phase === 'verify' ? app.t('Checking the download…') : j.phase === 'unpack' ? app.t('Unpacking…') : j.phase === 'done' ? app.t('Ready') : app.t('Starting…');
      return `<div class="mkfeat-prog-row" data-id="${esc(j.id)}"><div class="mkfeat-prog-t"><span>${esc(j.name)}</span><small>${esc(phase)}</small></div>
        <div class="mkfeat-bar${pct == null || j.phase !== 'download' ? ' busy' : ''}"><span style="width:${pct == null ? 30 : pct}%"></span></div>
        <button type="button" class="btn mkfeat-prog-cancel" data-id="${esc(j.id)}">${app.th('Cancel')}</button></div>`;
    }
    function update() {
      if (!jobs.size) { if (el) el.classList.remove('show'); hidden = false; return; }
      if (!el) build();
      // the card's own words, in the interface language of the moment
      el.querySelector('.mkfeat-prog-title').textContent = app.t('Installing features');
      const x = el.querySelector('.mkfeat-prog-x');
      x.setAttribute('aria-label', app.t('Hide')); x.dataset.tip = app.t('Hide'); x.dataset.tipD = app.t('The download goes on. File → Options → Features shows it.');
      el.querySelector('.mkfeat-prog-list').innerHTML = [...jobs.values()].map(rowHtml).join('');
      for (const b of $$('.mkfeat-prog-cancel', el)) b.addEventListener('click', () => { b.disabled = true; b.textContent = app.t('Cancelling…'); cancel(b.dataset.id); });
      if (!hidden) el.classList.add('show');
    }
    return { show() { hidden = false; update(); }, hide() { hidden = true; el?.classList.remove('show'); }, update, element: () => el };
  })();
  mk.on('features-progress', p => {
    if (!p || !p.id) return;
    const j = jobs.get(p.id);
    if (j) Object.assign(j, { phase: p.phase, received: p.received, total: p.total, percent: p.percent });
    app.events.emit('features:progress', p);
    progressCard.update();
    paintRowProgress(p);
  });
  mk.on('features-changed', () => { list().then(renderAll).catch(() => {}); });

  // ---------- File → Options → Features ----------
  let optionsEl = null;
  function stateBadge(f) {
    const j = jobs.get(f.id);
    if (j || f.state === 'installing') return `<span class="mkfeat-badge busy">${app.th('Installing…')}</span>`;
    if (f.state === 'installed') return `<span class="mkfeat-badge ok">${f.installed?.version ? app.th('Installed · {version}', { version: f.installed.version }) : app.th('Installed')}</span>`;
    if (f.state === 'included') return `<span class="mkfeat-badge ok">${app.th('Included with this copy')}</span>`;
    if (f.state === 'system') return `<span class="mkfeat-badge ok">${app.th('Found on this computer')}</span>`;
    if (f.state === 'unavailable') return `<span class="mkfeat-badge">${app.th('Not available here')}</span>`;
    return `<span class="mkfeat-badge">${app.th('Not installed')}</span>`;
  }
  function rowActions(f) {
    const j = jobs.get(f.id);
    if (j || f.state === 'installing') return `<button type="button" class="btn" data-act="cancel" data-id="${f.id}">${app.th('Cancel')}</button>`;
    if (f.state === 'installed') return `${f.update ? `<button type="button" class="btn primary" data-act="install" data-id="${f.id}" data-tip="${app.th('Update {feature}', { feature: app.t(f.name) })}" data-tip-d="${app.th('Downloads version {version} and replaces the installed one.', { version: f.version || '' })}">${app.th('Update')}</button>` : ''}<button type="button" class="btn" data-act="remove" data-id="${f.id}" data-tip="${app.th('Remove {feature}', { feature: app.t(f.name) })}" data-tip-d="${app.th('Frees the space it uses. You can install it again any time.')}">${app.th('Remove')}</button>`;
    if (f.state === 'included') return '';
    if (f.state === 'unavailable') return f.elsewhere ? `<button type="button" class="btn" data-act="copy" data-text="${esc(f.elsewhere)}" data-tip="${app.th('Copy the command')}" data-tip-d="${esc(f.elsewhere)}">${app.th('Copy command')}</button>` : `<button type="button" class="btn" data-act="url" data-url="${esc(f.homepage)}">${app.th('Open {feature} page', { feature: app.t(f.name) })}</button>`;
    return `<button type="button" class="btn${f.state === 'available' ? ' primary' : ''}" data-act="install" data-id="${f.id}" data-tip="${app.th('Install {feature}', { feature: app.t(f.name) })}" data-tip-d="${app.th('Downloads {size} from the Markooj release on GitHub, checks it and installs it.', { size: sizeText(f.download) })}">${app.th('Install')}</button>`;
  }
  function rowHtml(f) {
    const S = STATIC[f.id] || {};
    const j = jobs.get(f.id);
    const sizes = f.state === 'unavailable'
      ? (f.elsewhere ? (mk.platform === 'darwin' ? app.th('Install it with Homebrew: <code>{command}</code>', { command: f.elsewhere }) : app.th('Install it with your package manager: <code>{command}</code>', { command: f.elsewhere })) : app.th('Markooj has no download of it for this system.'))
      : `${app.th('{download} download · {size} on disk', { download: sizeText(f.download), size: sizeText(f.installed?.size || f.installedSize) })}${f.installed?.source === 'file' ? ` · ${app.th('installed from a file')}` : ''}`;
    return `<div class="mkfeat-row" data-feature="${esc(f.id)}" data-state="${esc(j ? 'installing' : f.state)}">
      <span class="mkfeat-ic" aria-hidden="true">${icon(S.icon || 'puzzle')}</span>
      <div class="mkfeat-main">
        <div class="mkfeat-title"><b>${esc(app.t(f.name))}</b>${stateBadge(f)}</div>
        <small class="mkfeat-what">${esc(f.what)}</small>
        <details class="mkfeat-more"><summary>${app.th('What it powers')}</summary><ul class="mkfeat-powers">${(f.powers || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul><p>${esc(f.without || '')} ${app.th('License: {license}.', { license: f.license || '' })}</p></details>
        <small class="mkfeat-size">${sizes}</small>
        <div class="mkfeat-bar${j ? '' : ' off'}"><span style="width:${j && j.total ? Math.round(j.received * 100 / j.total) : 0}%"></span></div>
      </div>
      <div class="mkfeat-act">${rowActions(f)}</div>
    </div>`;
  }
  function renderOptions(el) {
    optionsEl = el;
    el.classList.add('mkfeat');
    const L = last;
    if (!L) { el.innerHTML = `<p class="mkfeat-intro">${app.th('Loading the list of features…')}</p>`; list().then(() => { if (optionsEl === el && el.isConnected) renderOptions(el); }); return; }
    const portableFull = L.features.length && L.features.every(f => f.state === 'included' || f.state === 'unavailable');
    el.innerHTML = `
      <p class="mkfeat-intro">${app.th('Markooj works without these. Each one downloads once from the Markooj release on GitHub, is checked before it is installed, and then works offline. Remove one any time to free the space.')}</p>
      <div class="mkfeat-list">${L.features.map(rowHtml).join('')}</div>
      <div class="mkfeat-foot">
        <button type="button" class="btn" data-act="file" data-tip="${app.th('Install from file…')}" data-tip-d="${app.th('Choose a feature zip (markooj-feature-….zip) you downloaded yourself, for example on a computer without internet.')}">${icon('folder')}${app.th('Install from file…')}</button>
        <button type="button" class="btn" data-act="updates" data-tip="${app.th('Check for updates')}" data-tip-d="${app.th('Asks GitHub for newer versions of the installed features.')}">${icon('refresh')}${app.th('Check for updates')}</button>
        <button type="button" class="btn" data-act="folder" data-tip="${app.th('Open the features folder')}" data-tip-d="${app.th('Where Markooj keeps the features it downloaded.')}">${icon('open')}${app.th('Open folder')}</button>
        <span class="mkfeat-grow"></span>
      </div>
      <p class="mkfeat-note">${portableFull ? app.th('This copy already includes everything.') : app.th('No internet on this computer? Download the feature files from the {link} and choose Install from file, or use the Windows portable zip, which includes everything.', { link: '\u0001' }).replace('\u0001', `<a href="#" data-act="page">${app.th('Markooj download page')}</a>`)}</p>`;
    el.onclick = onOptionsClick;
  }
  async function onOptionsClick(ev) {
    const b = ev.target.closest('[data-act]');
    if (!b || !optionsEl || !optionsEl.contains(b)) return;
    ev.preventDefault();
    const act = b.dataset.act, id = b.dataset.id;
    try { app.ui.ripple?.(b); } catch {}
    if (act === 'install') return install(id);
    if (act === 'remove') return remove(id);
    if (act === 'cancel') { b.disabled = true; b.textContent = app.t('Cancelling…'); return cancel(id); }
    if (act === 'file') return installFromFile();
    if (act === 'copy') return app.health?.copy ? app.health.copy(b.dataset.text, app.t('Command copied. Paste it into a terminal.')) : mk.copyText?.(b.dataset.text);
    if (act === 'url') return mk.invoke('open-external', b.dataset.url).catch(() => {});
    if (act === 'page') return mk.invoke('open-external', (last && last.downloadPage) || 'https://github.com/datakeen/markooj/releases').catch(() => {});
    if (act === 'folder') { try { const p = await mk.invoke('features-folder'); await mk.invoke('open-folder', p); } catch (e) { app.ui.fail(e, { lead: app.t('Open the folder from File Explorer instead.') }); } return; }
    if (act === 'updates') {
      b.disabled = true;
      const r = await list({ refresh: true });
      b.disabled = false;
      renderAll();
      const ups = r.features.filter(f => f.update);
      if (ups.length) app.ui.toast(app.t('Updates are ready for {names}. Choose Update to install them.', { names: listOf(ups.map(f => app.t(f.name))) }), { kind: 'info', timeout: 7000 });
      else if (!r.manifest) app.ui.toast(app.t('Check your internet connection, then try again. Markooj could not reach GitHub to look for updates. Your features keep working.'), { kind: 'warn', actions: [{ label: app.t('Try again'), run: () => b.click() }] });
      else app.ui.toast(app.t('Your features are up to date.'), { kind: 'success' });
    }
  }
  function paintRowProgress(p) {
    const row = optionsEl && optionsEl.isConnected && $(`.mkfeat-row[data-feature="${p.id}"]`, optionsEl);
    if (!row) return;
    const bar = $('.mkfeat-bar', row);
    if (bar) { bar.classList.remove('off'); const s = $('span', bar); if (s) s.style.width = (p.total ? Math.round(p.received * 100 / p.total) : 30) + '%'; bar.classList.toggle('busy', p.phase !== 'download'); }
    const sz = $('.mkfeat-size', row);
    if (sz && p.phase === 'download' && p.total) sz.textContent = app.t('Downloading… {received} of {total}', { received: sizeText(p.received, { exact: true }), total: sizeText(p.total, { exact: true }) });
    else if (sz && p.phase === 'verify') sz.textContent = app.t('Checking the download…');
    else if (sz && p.phase === 'unpack') sz.textContent = app.t('Unpacking…');
  }
  function renderAll() {
    if (optionsEl && optionsEl.isConnected && last) renderOptions(optionsEl);
    const w = $('.mkfeat-wel');
    if (w && w.isConnected) paintWelcome(w);
  }
  app.options.addSection({ id: 'features', label: app.tm('Features'), order: 27, render: renderOptions });
  // a new interface language: the progress card and the Features page are drawn again
  // (main writes the feature texts in the interface language, so the list is fetched again first)
  app.events.on('i18n:changed', () => {
    const redraw = () => { try { progressCard.update(); renderAll(); } catch (e) { console.warn('features redraw', e); } };
    redraw();
    if (last) list().then(redraw, () => {});
  });

  function open() {
    app.backstage.open('options');
    setTimeout(() => {
      const s = $('.opt-card[data-section="features"]');
      if (s) { s.scrollIntoView({ block: 'start', behavior: 'smooth' }); try { app.ui.glow?.(s); } catch {} }
    }, 260);
    list().then(renderAll).catch(() => {});
  }

  // ---------- the Welcome sheet's "Choose extra features" step (src/welcome.js calls this) ----------
  let firstRunInfo = null;
  function welcomeWanted() {
    if (test.forceWelcome) return true;
    if (app.settings.get('features.welcomeDone', false)) return false;
    if (firstRunInfo && firstRunInfo.chose) return false; // the Windows installer already asked
    return !!(last && last.features.some(f => f.state === 'available'));
  }
  function paintWelcome(sec) {
    const offer = (last ? last.features : []).filter(f => f.state === 'available' || f.state === 'installing' || jobs.has(f.id) || (test.forceWelcome && f.available));
    if (!offer.length) { sec.remove(); return; }
    const busy = offer.filter(f => jobs.has(f.id));
    sec.innerHTML = `
      <div class="mkfeat-wel-head"><b>${app.th('Choose extra features')}</b><small>${app.th('Markooj works without them. Each one downloads once; add or remove them any time in File → Options → Features.')}</small></div>
      <ul class="mkfeat-wel-list" role="list">${offer.map(f => `
        <li><label class="mkfeat-wel-item"><input type="checkbox" value="${esc(f.id)}"${jobs.has(f.id) ? ' checked disabled' : ''}>
          <span><b>${esc(app.t(f.name))}</b> <span class="mkfeat-wel-size">${esc(sizeText(f.download))}</span><small>${esc(f.what)}</small></span></label></li>`).join('')}
      </ul>
      <div class="mkfeat-wel-acts">${busy.length ? `<small class="mkfeat-wel-busy">${app.th('Downloading {names} in the background…', { names: listOf(busy.map(f => app.t(f.name))) })}</small>` : ''}
        <span class="mkfeat-grow"></span>
        <button type="button" class="btn mkfeat-wel-skip">${app.th('Skip')}</button>
        <button type="button" class="btn primary mkfeat-wel-go" disabled>${app.th('Install selected')}</button></div>`;
    const go = $('.mkfeat-wel-go', sec);
    const boxes = $$('input[type=checkbox]:not([disabled])', sec);
    const sync = () => { const n = boxes.filter(b => b.checked).length; go.disabled = !n; go.textContent = n ? app.t('Install selected ({size})', { size: sizeText(boxes.filter(b => b.checked).reduce((s, b) => s + (get(b.value)?.download || 0), 0)) }) : app.t('Install selected'); };
    boxes.forEach(b => b.addEventListener('change', sync));
    $('.mkfeat-wel-skip', sec).addEventListener('click', () => { app.settings.set('features.welcomeDone', true); sec.classList.add('done'); setTimeout(() => sec.remove(), 200); });
    go.addEventListener('click', () => {
      const ids = boxes.filter(b => b.checked).map(b => b.value);
      if (!ids.length) return;
      app.settings.set('features.welcomeDone', true);
      installMany(ids, { background: true });
      setTimeout(() => { if (sec.isConnected) paintWelcome(sec); }, 50);
    });
    sync();
  }
  /** Adds the step to an open Welcome sheet (mode 'welcome'). Returns the element or null. */
  function welcomeStep(sheet) {
    if (!sheet || !welcomeWanted()) return null;
    const body = $('.mkwel-body', sheet) || sheet;
    $('.mkfeat-wel', body)?.remove();
    const sec = document.createElement('section');
    sec.className = 'mkfeat-wel';
    sec.setAttribute('aria-label', app.t('Choose extra features'));
    sec.hidden = true;
    body.prepend(sec); // first: it is the one choice the Welcome asks for
    // wait for the list and for first-run.json (the Windows installer may have asked already)
    Promise.all([last || list(), Promise.race([firstRunDone, sleep(5000)])]).then(() => {
      if (!sec.isConnected) return;
      if (!welcomeWanted()) { sec.remove(); return; }
      sec.hidden = false;
      paintWelcome(sec);
    }).catch(() => sec.remove());
    return sec;
  }

  // ---------- first start after the Windows installer ----------
  /** What to do with first-run.json's answer: keep the language (unless set), download the chosen features. */
  async function applyFirstRun(r, o = {}) {
    const out = { language: null, queued: [] };
    if (!r || !r.found || !r.valid) return out;
    firstRunInfo = r;
    app.firstRun = { language: r.language || null, features: r.features || [], chose: !!r.chose };
    if (r.language && !app.settings.get('uiLanguage', '')) { app.settings.set('uiLanguage', r.language); out.language = r.language; }
    const L = o.list || await list();
    out.queued = (r.features || []).filter(id => { const f = L.features.find(x => x.id === id); return f && f.state === 'available'; });
    // the downloads start a moment after the window is up, so they never slow the first paint
    if (out.queued.length) (o.install || (ids => setTimeout(() => installMany(ids, { background: true }), 2500)))(out.queued);
    return out;
  }
  let firstRunResolve = null;
  const firstRunDone = new Promise(res => { firstRunResolve = res; });
  async function firstRun(o = {}) {
    try {
      if (!o.test) {
        try { const i = await mk.invoke('app-info'); if (i.userDataFrom === 'smoke' || window.__mkSmokeStarted) return null; } catch { return null; }
      }
      let r = null;
      try { r = await mk.invoke('features-first-run'); } catch { return null; }
      if (!r || !r.found) return null;
      firstRunInfo = r;
      if (r.key && app.settings.get('features.firstRunKey', '') === r.key) { app.firstRun = { language: r.language || null, features: r.features || [], chose: !!r.chose, handled: true }; return null; }
      if (r.key) app.settings.set('features.firstRunKey', r.key);
      return await applyFirstRun(r);
    } finally { firstRunResolve(firstRunInfo); }
  }
  app.events.on('ready', () => { setTimeout(() => { firstRun().catch(e => console.warn('features first run', e)); }, 300); });

  // ---------- commands, ribbon, tooltips ----------
  const CMDS = [
    ['features.open', { label: app.tm('Features'), icon: 'import', category: 'File', keywords: 'features optional parts add remove install pandoc djvu python download size',
      description: app.tm('Add or remove optional parts of Markooj: Pandoc (more file formats), DjVu tools and Python macros. Shows each part’s size.'), run: () => open() }],
    ['features.installPandoc', { label: app.tm('Install Pandoc (more file formats)'), icon: 'export', category: 'File', keywords: 'pandoc latex odt rtf typst feature',
      description: app.tm('Downloads Pandoc once, so you can save as LaTeX, OpenDocument, Rich Text, PowerPoint, Typst and more.'), run: () => install('pandoc') }],
    ['features.installDjvu', { label: app.tm('Install DjVu tools'), icon: 'doc', category: 'File', keywords: 'djvu djvulibre pdf2djvu feature',
      description: app.tm('Downloads the DjVu tools once, so DjVu files open and you can save as DjVu.'), run: () => install('djvu') }],
    ['features.installPython', { label: app.tm('Install Python macros'), icon: 'python', category: 'Developer', keywords: 'python pyodide macros feature',
      description: app.tm('Downloads Python (Pyodide) once, so macros written in Python run on the Developer tab.'), run: () => install('python') }],
    ['features.installFromFile', { label: app.tm('Install a feature from a file…'), icon: 'folder', category: 'File', keywords: 'feature zip offline install file',
      description: app.tm('Installs a feature zip you downloaded yourself (markooj-feature-….zip), for computers without internet.'), run: () => installFromFile() }],
    ['features.cancel', { label: app.tm('Cancel feature downloads'), icon: 'stop', category: 'File', keywords: 'cancel stop download feature',
      description: app.tm('Stops the features that are downloading now. Nothing half-done is kept.'), run: () => cancel(), isEnabled: () => jobs.size > 0, why: () => (jobs.size ? '' : app.t('Nothing is downloading right now.')) }],
  ];
  for (const [id, c] of CMDS) {
    app.commands.register(id, c);
    try { app.tooltips?.register?.(id, { title: c.label, description: c.description }); } catch {}
  }
  try {
    app.ribbon.addGroup('help', { id: 'help-features', label: app.tm('Features'), order: 35, items: [
      { type: 'big', command: 'features.open', label: app.tm('Features'), icon: 'import' },
    ] });
  } catch (e) { console.warn('features ribbon', e); }

  app.features = { list, get, last: () => last, install, installMany, installFromFile, remove, cancel, ensure, open, forTool, welcomeStep, firstRun, applyFirstRun,
    progress: progressCard, sizeText, jobs: () => [...jobs.values()].map(j => ({ id: j.id, phase: j.phase, received: j.received, total: j.total })), _test: test };
  app.firstRun = app.firstRun || null;
  // the list early, so Check Tools and Save As can name the right feature
  app.events.on('ready', () => { setTimeout(() => { list().catch(() => {}); }, 1500); });

  // =====================================================================
  //  Smoke tests (local fixture zips and a fake list; never the network)
  // =====================================================================
  const T = app.tests;
  if (!T) return;
  const A = app.assert || ((c, m) => { if (!c) throw new Error('Assertion failed: ' + m); });
  let FX = null, BASE = null;
  async function fixtures() {
    if (FX) return FX;
    const info = await mk.invoke('app-info');
    BASE = String(info.userData).replace(/[\\/]+$/, '') + '/features-test';
    FX = await mk.invoke('features-test-fixtures', BASE + '/fixtures');
    return FX;
  }
  const sep = () => (mk.platform === 'win32' ? '\\' : '/');
  async function withFixtures(fn, extra = {}) {
    const fx = await fixtures();
    const root = BASE + '/root-' + Math.random().toString(36).slice(2, 8);
    await mk.invoke('features-test-setup', { root, dir: fx.dir, manifest: fx.manifest, delayMs: 0, ...extra });
    try { return await fn(fx, root); }
    finally {
      await mk.invoke('features-test-reset');
      jobs.clear(); progressCard.update();
      await list();
      try { await app.health?.check?.({ refresh: true }); app.health?.refreshFormats?.(); } catch {}
    }
  }
  const codeOf = e => (mk.errorInfo?.(e) || {}).code || e.code || '';
  async function expectFail(p, code, re) {
    let err = null;
    try { await p; } catch (e) { err = e; }
    A(err, `expected the install to fail with ${code}`);
    A(codeOf(err) === code, `code ${code}, got ${codeOf(err)}: ${err.message}`);
    const msg = app.ui.plainError ? app.ui.plainError(err, '') : err.message;
    if (re) A(re.test(msg), `message ${re}: ${msg}`);
    A(/^(Try|Download|Choose|Check|Install|Free)\b/.test(msg), 'leads with what to do: ' + msg);
    return err;
  }

  T.register('features: install, update and remove a feature from a local fixture (no network)', () => withFixtures(async (fx, root) => {
    const phases = [];
    const off = mk.on('features-progress', p => { if (p.id === 'python') phases.push(p.phase); });
    try {
      let L = await list();
      const py = L.features.find(f => f.id === 'python');
      A(py && py.available && py.download === fx.manifest.features.python.files.any.size && py.exact, 'python listed with its exact size: ' + JSON.stringify(py));
      A(await install('python', { quiet: true }), 'install resolves true');
      L = await list();
      const inst = L.features.find(f => f.id === 'python');
      A(inst.state === 'installed' && inst.installed.version === '9.0.1', 'installed 9.0.1: ' + JSON.stringify(inst.installed));
      A(inst.installed.dir.replace(/\\/g, '/').startsWith(root.replace(/\\/g, '/')), 'installed under the features folder: ' + inst.installed.dir);
      for (const ph of ['download', 'verify', 'unpack', 'done']) A(phases.includes(ph), `progress phase ${ph}: ${phases}`);
      // Pyodide is served from the feature folder
      const r = await mk.invoke('features-test-resolve', '/node_modules/pyodide/feature-test.txt');
      A(r && r.file && r.file.replace(/\\/g, '/').startsWith(root.replace(/\\/g, '/')), 'protocol resolves into the feature: ' + JSON.stringify(r));
      const txt = await (await fetch('../node_modules/pyodide/feature-test.txt', { cache: 'no-store' })).text();
      A(txt === 'markooj features fixture 9.0.1', 'markooj:// serves the feature file: ' + txt);
      A(await mk.invoke('features-test-exists', root + sep() + 'installed.json'), 'installed.json written');
      // a newer version on the list: Update replaces it, the old folder goes away
      await mk.invoke('features-test-setup', { manifest: { ...fx.manifest, features: { ...fx.manifest.features, python: { version: '9.0.2', files: { any: fx.entries.good2 } } } } });
      L = await list();
      A(L.features.find(f => f.id === 'python').update, 'update offered');
      A(await install('python', { quiet: true }), 'update installs');
      L = await list();
      A(L.features.find(f => f.id === 'python').installed.version === '9.0.2', 'now 9.0.2');
      const txt2 = await (await fetch('../node_modules/pyodide/feature-test.txt', { cache: 'no-store' })).text();
      A(txt2 === 'markooj features fixture 9.0.2', 'the new version is served: ' + txt2);
      for (let i = 0; i < 30 && await mk.invoke('features-test-exists', [root, 'python', '9.0.1'].join(sep())); i++) await sleep(100);
      A(!(await mk.invoke('features-test-exists', [root, 'python', '9.0.1'].join(sep()))), 'the old version folder is removed');
      // remove
      A(await remove('python', { confirm: false }), 'remove resolves true');
      L = await list();
      const gone = L.features.find(f => f.id === 'python');
      A(gone.state !== 'installed' && !gone.installed, 'not installed any more: ' + gone.state);
      A(!(await mk.invoke('features-test-exists', [root, 'python', '9.0.2'].join(sep()))), 'its folder is gone');
      const r2 = await mk.invoke('features-test-resolve', '/node_modules/pyodide/feature-test.txt');
      A(!r2 || !r2.file || !r2.file.replace(/\\/g, '/').startsWith(root.replace(/\\/g, '/')), 'the protocol no longer serves the removed feature');
    } finally { if (typeof off === 'function') off(); }
  }));

  T.register('features: a damaged download (SHA-256 mismatch) installs nothing', () => withFixtures(async (fx, root) => {
    const bad = { ...fx.manifest, features: { ...fx.manifest.features, python: { version: '9.0.1', files: { any: { ...fx.manifest.features.python.files.any, sha256: 'a'.repeat(64) } } } } };
    await mk.invoke('features-test-setup', { manifest: bad });
    const err = await expectFail(mk.invoke('features-install', 'python'), 'FEATURE_CHECK_FAILED', /damaged on the way/);
    const info = mk.errorInfo(err);
    A(info.actions.some(a => a.id === 'retry') && info.actions.some(a => a.id === 'feature-from-file'), 'Try again and Install from file: ' + JSON.stringify(info.actions));
    A(!(await mk.invoke('features-test-exists', [root, 'python'].join(sep()))) || !(await mk.invoke('features-test-exists', [root, 'python', '9.0.1'].join(sep()))), 'nothing installed');
    A(!(await mk.invoke('features-test-exists', root + sep() + 'installed.json')), 'no registry entry written');
    const L = await list();
    A(L.features.find(f => f.id === 'python').state !== 'installed', 'still not installed');
  }));

  T.register('features: a zip that climbs out of its folder, or lacks files, or is for another system installs nothing', () => withFixtures(async (fx, root) => {
    await mk.invoke('features-test-setup', { manifest: { ...fx.manifest, features: { ...fx.manifest.features, python: { version: '6.6.6', files: { any: fx.entries.evil } } } } });
    await expectFail(mk.invoke('features-install', 'python'), 'FEATURE_UNSAFE', /safety checks/);
    for (const p of [[root, 'evil-outside.txt'], [root, 'python', 'evil-outside.txt'], [fx.dir, '..', 'evil-outside.txt']]) A(!(await mk.invoke('features-test-exists', p.join(sep()))), 'nothing written outside: ' + p.join(sep()));
    A(!(await mk.invoke('features-test-exists', [root, 'python', '6.6.6'].join(sep()))), 'not installed');
    await mk.invoke('features-test-setup', { manifest: { ...fx.manifest, features: { ...fx.manifest.features, python: { version: '7.7.7', files: { any: fx.entries.missing } } } } });
    await expectFail(mk.invoke('features-install', 'python'), 'FEATURE_UNSAFE');
    A(!(await mk.invoke('features-test-exists', [root, 'python', '7.7.7'].join(sep()))), 'a feature without its files is not installed');
    await expectFail(mk.invoke('features-install-file', { file: fx.dir + sep() + fx.files.wrongPlatform.file }), 'FEATURE_UNKNOWN_FILE');
    await mk.invoke('features-test-setup', { allowUnverified: true, dir: fx.dir, manifest: fx.manifest });
    await expectFail(mk.invoke('features-install-file', { file: fx.dir + sep() + fx.files.wrongPlatform.file }), 'FEATURE_WRONG_FILE', /for this computer/);
  }));

  T.register('features: Install from file checks the file against the list of downloads', () => withFixtures(async (fx, root) => {
    const r = await mk.invoke('features-install-file', { file: fx.dir + sep() + fx.files.good.file });
    A(r && r.id === 'python' && r.version === '9.0.1' && r.source === 'file', 'a listed file installs: ' + JSON.stringify(r));
    await mk.invoke('features-remove', 'python');
    await expectFail(mk.invoke('features-install-file', { file: fx.dir + sep() + fx.files.good2.file }), 'FEATURE_UNKNOWN_FILE', /download page/);
    await expectFail(mk.invoke('features-install-file', { file: fx.dir + sep() + fx.files.good.file, id: 'pandoc' }), 'FEATURE_WRONG_FILE');
    let e = null; try { await mk.invoke('features-install-file', {}); } catch (x) { e = x; }
    A(e && codeOf(e) === 'FEATURE_NO_FILE', 'test windows never open a file picker');
  }));

  T.register('features: Cancel stops a download and keeps nothing', () => withFixtures(async (fx, root) => {
    await mk.invoke('features-test-setup', { delayMs: 25, manifest: { ...fx.manifest, features: { ...fx.manifest.features, python: { version: '9.1.0', files: { any: fx.entries.big } } } } });
    let started = false;
    const off = mk.on('features-progress', p => { if (p.id === 'python' && p.phase === 'download' && p.received > 0) started = true; });
    try {
      const p = install('python', { quiet: true });
      for (let i = 0; i < 100 && !started; i++) await sleep(50);
      A(started, 'the download started');
      A(progressCard.element() && progressCard.element().classList.contains('show') && /Downloading/.test(progressCard.element().textContent), 'the progress card shows the download');
      try { await mk.invoke('smoke-shot', 'features-progress'); } catch {}
      const btn = $('.mkfeat-prog-cancel', progressCard.element());
      A(btn, 'the card has Cancel');
      btn.click();
      A((await p) === false, 'install resolves false after Cancel');
      A(!(await mk.invoke('features-test-exists', [root, 'python', '9.1.0'].join(sep()))), 'nothing installed');
      let parts = null;
      for (let i = 0; i < 30; i++) { parts = await mk.invoke('features-test-ls', [root, '.downloads'].join(sep())); if (!parts || !parts.length) break; await sleep(100); }
      A(!parts || !parts.length, 'no partial download is kept: ' + JSON.stringify(parts));
      const py = await mk.invoke('features-test-ls', [root, 'python'].join(sep()));
      A(!py || !py.length, 'no partial feature folder: ' + JSON.stringify(py));
      await sleep(400);
      A(!progressCard.element().classList.contains('show'), 'the card goes away');
    } finally { if (typeof off === 'function') off(); }
  }));

  // bug hunt (round 5): the start-up tidy-up (4 s after launch) ran while the installer's first-run downloads were
  // already going, and deleted the partial download and the staging folder under them
  T.register('features: the start-up tidy-up never touches an install that is running', () => withFixtures(async (fx, root) => {
    await mk.invoke('features-test-setup', { delayMs: 8, manifest: { ...fx.manifest, features: { ...fx.manifest.features, python: { version: '9.1.0', files: { any: fx.entries.big } } } } });
    let started = false;
    const off = mk.on('features-progress', p => { if (p.id === 'python' && p.phase === 'download' && p.received > 0) started = true; });
    try {
      const p = install('python', { quiet: true });
      for (let i = 0; i < 100 && !started; i++) await sleep(50);
      A(started, 'the download started');
      const parts = await mk.invoke('features-test-ls', [root, '.downloads'].join(sep()));
      A(parts && parts.some(f => /\.part$/.test(f)), 'a partial download is being written: ' + JSON.stringify(parts));
      await mk.invoke('features-test-cleanup');
      const still = await mk.invoke('features-test-ls', [root, '.downloads'].join(sep()));
      A(still && still.some(f => /\.part$/.test(f)), 'the tidy-up left the running download alone: ' + JSON.stringify(still));
      A((await p) === true, 'the install still finishes');
      const L = await list();
      A(L.features.find(f => f.id === 'python').installed?.version === '9.1.0', 'installed 9.1.0');
      // with nothing running, the tidy-up still removes leftovers
      await mk.invoke('features-test-cleanup');
    } finally { if (typeof off === 'function') off(); }
  }));

  T.register('features: tools are found in Features first, then in the bundle, then on the system',() => withFixtures(async (fx, root) => {
    const before = await mk.invoke('features-test-lookup', 'pandoc');
    // straight through IPC: the stand-in pandoc of the fixture is never started (no Check Tools run while it is there)
    const r = await mk.invoke('features-install', 'pandoc');
    A(r && r.id === 'pandoc' && r.version === '9.9', 'the test Pandoc feature installs: ' + JSON.stringify(r));
    const inFeature = await mk.invoke('features-test-lookup', 'pandoc');
    A(inFeature && inFeature.feature === 'pandoc' && inFeature.path.replace(/\\/g, '/').startsWith(root.replace(/\\/g, '/')), 'Features come first: ' + JSON.stringify(inFeature));
    A(inFeature.bundled === false, 'a feature is not "bundled"');
    await mk.invoke('features-remove', 'pandoc');
    const after = await mk.invoke('features-test-lookup', 'pandoc');
    A(!after || !after.path.replace(/\\/g, '/').startsWith(root.replace(/\\/g, '/')), 'after removal the feature folder is not used: ' + JSON.stringify(after));
    A(JSON.stringify(after) === JSON.stringify(before), 'back to the same lookup as before: ' + JSON.stringify([before, after]));
    if (after && after.bundled) A(/[\\/]vendor[\\/]/.test(after.path), 'then the bundled vendor folder: ' + after.path);
  }));

  T.register('features: Python loads from the feature, and offers to install itself when missing', () => withFixtures(async (fx, root) => {
    await mk.invoke('features-test-setup', { pretendNoPyodide: true });
    const s = await mk.invoke('features-test-resolve', '/node_modules/pyodide/pyodide.mjs');
    A(s && s.stub, 'without the feature a stand-in pyodide.mjs is served: ' + JSON.stringify(s));
    const stub = await (await fetch('../node_modules/pyodide/pyodide.mjs?probe=' + Date.now(), { cache: 'no-store' })).text();
    A(/features\.ensure\('python'/.test(stub), 'the stand-in asks app.features.ensure');
    // the stand-in, with "Install" answered by the test: installs the fixture, then loads it
    const keepEnsure = app.features.ensure;
    let asked = 0;
    app.features.ensure = async id => { asked++; return install(id, { quiet: true }); };
    try {
      const mod = await import(new URL('../node_modules/pyodide/pyodide.mjs?t=' + Date.now(), document.baseURI).href);
      const py = await mod.loadPyodide({});
      A(asked === 1 && py && py.fake === true && py.version === '9.0.1', 'stand-in installed and loaded the feature: ' + JSON.stringify(py));
    } finally { app.features.ensure = keepEnsure; }
    const real = await mk.invoke('features-test-resolve', '/node_modules/pyodide/pyodide.mjs');
    A(real && real.file && !real.stub, 'with the feature the real file is served');
  }, { pretendNoPyodide: true }));

  T.register('features: first-run.json from the Windows installer (language and features)', async () => {
    const P = t => mk.invoke('features-test-first-run', t);
    let r = await P('{"language":"ur","features":["pandoc","djvu"]}');
    A(r.valid && r.language === 'ur' && r.features.join() === 'pandoc,djvu' && r.chose, 'plain case: ' + JSON.stringify(r));
    r = await P('﻿{"language":"zh-cn","features":"python, pandoc ,pyodide"}');
    A(r.language === 'zh-CN' && r.features.join() === 'python,pandoc', 'BOM, case, comma list, alias, no duplicates: ' + JSON.stringify(r));
    r = await P('{"language":"ur-latn","features":[]}');
    A(r.language === 'ur-Latn' && !r.features.length && r.chose, 'Roman Urdu, nothing chosen');
    r = await P('{"language":"xx","features":["pandoc","bogus"]}');
    A(r.valid && r.language === null && r.features.join() === 'pandoc' && r.errors.length === 2, 'unknown values are dropped: ' + JSON.stringify(r));
    r = await P('{"language":"pt-BR"}');
    A(r.language === 'pt-BR' && !r.chose, 'no features key: the Welcome may still ask');
    r = await P('not json');
    A(!r.valid && !r.features.length, 'bad file is ignored');
    for (const c of ['en', 'zh-CN', 'ur', 'ur-Latn', 'pnb', 'ja', 'ar', 'sv', 'es', 'fr', 'pt-BR']) A((await P(JSON.stringify({ language: c }))).language === c, 'language ' + c);
    // applying it: the language only when none is set, features that are not there yet are queued
    const keepLang = app.settings.get('uiLanguage', ''), keepFirst = app.firstRun;
    try {
      app.settings.set('uiLanguage', '');
      const fakeList = { features: [{ id: 'pandoc', state: 'available' }, { id: 'djvu', state: 'included' }, { id: 'python', state: 'installed' }] };
      let queued = null;
      const out = await applyFirstRun({ found: true, valid: true, language: 'ar', features: ['pandoc', 'djvu', 'python'], chose: true }, { list: fakeList, install: ids => { queued = ids; } });
      A(out.language === 'ar' && app.settings.get('uiLanguage', '') === 'ar' && app.firstRun.language === 'ar', 'language kept as uiLanguage');
      A(queued && queued.join() === 'pandoc', 'only missing features are downloaded: ' + JSON.stringify(queued));
      const out2 = await applyFirstRun({ found: true, valid: true, language: 'fr', features: [] }, { list: fakeList, install: () => { throw new Error('nothing to install'); } });
      A(!out2.language && app.settings.get('uiLanguage', '') === 'ar', 'a language the user already has is never replaced');
    } finally { app.settings.set('uiLanguage', keepLang); app.firstRun = keepFirst; firstRunInfo = null; }
    const live = await mk.invoke('features-first-run');
    A(live && typeof live.found === 'boolean', 'the live channel answers');
  });

  T.register('features: health remedies point to File → Options → Features with an Install button', async () => {
    const plat = mk.platform === 'win32' ? 'win32' : mk.platform;
    const { remedy: m } = await mk.invoke('tools-remedy-probe', 'pandoc', { platform: plat, packaged: true });
    A(m.actions[0] && m.actions[0].id === 'install-feature' && m.actions[0].feature === 'pandoc' && m.actions[0].label === 'Install Pandoc', 'Install button first: ' + JSON.stringify(m.actions));
    A(/^Install Pandoc from File → Options → Features \(\d+ MB to download\)\./.test(m.text), 'says where: ' + m.text);
    const fake = { ok: false, missing: ['pandoc'], platform: mk.platform, packaged: true, tools: { pandoc: { id: 'pandoc', ok: false, state: 'missing', path: null, remedy: m } } };
    const rem = app.health.remedy('pandoc', fake);
    A(rem.title === 'Install Pandoc to save as OpenDocument, Rich Text, LaTeX and more', 'title: ' + rem.title);
    // the button runs app.features.install
    const calls = [];
    test.installSpy = (id) => { calls.push(id); return true; };
    try { await app.health.runAction(rem.actions[0], { tool: 'pandoc' }); } finally { test.installSpy = null; }
    A(calls.join() === 'pandoc', 'Install runs app.features.install: ' + calls);
    A(forTool('ddjvu', 'win32').id === 'djvu' && forTool('pdf2djvu', 'win32').available && !forTool('ddjvu', 'darwin').available, 'forTool knows where DjVu tools download');
    // Save As: a Pandoc format names Features when Pandoc is missing
    const fmts = await mk.invoke('export-formats');
    const latex = fmts.find(f => f.id === 'latex');
    A(latex && (latex.available || /File → Options → Features/.test(latex.reason || '')), 'Save As reason: ' + JSON.stringify(latex));
  });

  T.register('features: Options → Features lists every feature with its sizes and an action', async () => {
    await list();
    app.backstage.open('options');
    await sleep(400);
    const card = $('.opt-card[data-section="features"]');
    A(card, 'the Features section is in Options');
    for (let i = 0; i < 30 && !$('.mkfeat-row', card); i++) await sleep(100);
    const rows = $$('.mkfeat-row', card);
    A(rows.length === 3, 'three features: ' + rows.length);
    for (const r of rows) {
      A(/\d+ MB/.test(r.textContent) || r.dataset.state === 'unavailable', 'sizes for ' + r.dataset.feature);
      A($('.mkfeat-what', r).textContent.length > 10, 'what it powers for ' + r.dataset.feature);
      const st = r.dataset.state;
      if (st === 'available') A($('[data-act="install"]', r), 'Install for ' + r.dataset.feature);
      if (st === 'installed') A($('[data-act="remove"]', r), 'Remove for ' + r.dataset.feature);
    }
    A($('[data-act="file"]', card) && $('[data-act="updates"]', card), 'Install from file… and Check for updates');
    card.scrollIntoView({ block: 'start' }); await sleep(200);
    try { await mk.invoke('smoke-shot', 'options-features'); } catch {}
    app.backstage.close();
    await sleep(200);
  });

  T.register('features: palette commands, the Help tab button and the Welcome step', async () => {
    for (const id of ['features.open', 'features.installPandoc', 'features.installDjvu', 'features.installPython', 'features.installFromFile', 'features.cancel']) {
      const c = app.commands.get(id);
      A(c && c.label && c.description, 'command ' + id);
      const tip = app.tooltips?.info?.(id);
      A(!app.tooltips?.info || (tip && tip.title), 'ScreenTip for ' + id);
    }
    A(!app.commands.get('features.cancel').isEnabled(), 'Cancel is dimmed while nothing downloads');
    app.commands.run('features.open');
    await sleep(500);
    A($('#backstage.show, .backstage.show') || document.querySelector('.opt-card[data-section="features"]'), 'features.open shows Options → Features');
    app.backstage.close(); await sleep(200);
    // Welcome: the "Choose extra features" step with checkboxes, sizes, Install selected and Skip
    if (!app.welcome) return;
    await list();
    test.forceWelcome = true;
    const keepDone = app.settings.get('features.welcomeDone', false);
    try {
      const p = app.welcome.open('welcome', { markSeen: false });
      await sleep(400);
      const sec = $('.mkwel-sheet .mkfeat-wel');
      A(sec, 'the Welcome sheet has the features step');
      const boxes = $$('input[type=checkbox]', sec);
      A(boxes.length >= 1 && boxes.length <= 3, 'one checkbox per feature: ' + boxes.length);
      A(/\d+ MB/.test(sec.textContent) && $('.mkfeat-wel-skip', sec) && $('.mkfeat-wel-go', sec).disabled, 'sizes, Skip, and Install selected waits for a choice');
      boxes[0].click();
      A(!$('.mkfeat-wel-go', sec).disabled && /Install selected \(\d+ MB\)/.test($('.mkfeat-wel-go', sec).textContent), 'Install selected names the total size');
      try { await mk.invoke('smoke-shot', 'welcome-features'); } catch {}
      $('.mkfeat-wel-skip', sec).click();
      await sleep(300);
      A(!$('.mkwel-sheet .mkfeat-wel'), 'Skip hides the step');
      A(app.settings.get('features.welcomeDone', false) === true, 'and remembers it');
      app.welcome.close('test');
      await p;
    } finally { test.forceWelcome = false; app.settings.set('features.welcomeDone', keepDone); }
  });
})();
