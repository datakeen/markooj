// Markooj — the helper programs (Pandoc, pdf2djvu, DjVuLibre): self-check, help when one is needed, Help → Check Tools.
// Main answers IPC 'tools-health' (each program started once with a version call, cached; every tool carries `state`
// ok|missing|failed|blocked and, when missing, `remedy` {text, steps, actions} for this computer) and sends 'tools-health'
// again when a program fails to start while Markooj runs.
//
// Messages follow one rule: lead with what the user can do (a button that does it when possible), then say what still
// works; raw codes stay under "Technical details". Optional tools never raise a message at startup: help appears when the
// user tries the feature (opens a DjVu file, picks DjVu or a Pandoc format in Save As), and Help → Check Tools always has
// the full picture. A startup message is only for Pandoc, and only when the user exports with it often.
//
// API: app.health = { check({refresh}), last(), describe(r), summary(r), showDetails(r?), remedy(id, r?), offer(id, opts?),
//   runAction(action, ctx?), errorActions(e, ctx?), toastError(e, opts?), showError(e, opts?), markTried(id), noteUse(id),
//   notify(r), refreshFormats(), copy(text, okMsg?) }
// Event: app.events 'tools:health' (result). Command: help.checkTools.
(function () {
  'use strict';
  const app = window.app, mk = window.mk;
  if (!app || !mk) return;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = name => `<svg class="i"><use href="#${esc(name)}"/></svg>`;
  const plainError = (e, fb) => (app.ui.plainError ? app.ui.plainError(e, fb) : String((e && e.message) || e || fb || ''));
  let last = null, notifiedKey = '';

  const DOWNLOAD_URL = 'https://datakeen.github.io/markooj/#download';
  const ISSUES_URL = 'https://github.com/datakeen/markooj/issues';
  // What each program is for, in words a Word user knows.
  const TOOLS = {
    pandoc: {
      label: 'Pandoc', kind: 'program', goal: app.tm('save as OpenDocument, Rich Text, LaTeX and more'),
      uses: app.tm('Saves as OpenDocument, Rich Text, LaTeX, PowerPoint and more, and opens Word, OpenDocument and LaTeX files.'),
      works: app.tm('Everything else works, including Word (.docx), PDF and EPUB.'),
      url: 'https://pandoc.org/installing.html',
    },
    pdf2djvu: {
      label: 'pdf2djvu', kind: 'program', goal: app.tm('save as DjVu'), uses: app.tm('Saves documents as DjVu.'),
      works: app.tm('Everything else works.'), url: 'https://jwilk.net/software/pdf2djvu',
    },
    ddjvu: {
      label: 'DjVuLibre', kind: 'tools', goal: app.tm('open DjVu files'), uses: app.tm('Opens DjVu files and reads their text.'),
      works: app.tm('Everything else works.'), url: 'https://djvu.sourceforge.net/',
    },
  };
  const IDS = ['pandoc', 'pdf2djvu', 'ddjvu'];
  // djvutxt, djvused, djvm and c44 come with DjVuLibre
  const family = id => (id === 'pandoc' || id === 'pdf2djvu' ? id : 'ddjvu');
  // English keeps its own list style ("A, B and C"); other languages use their own list words
  const join = names => (app.i18n && !/^(en|qps)$/.test(app.i18n.language()) ? app.i18n.list(names) : names.length <= 1 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]);
  const getLabel = T => app.t('Get {tool}', { tool: T.label });

  async function check(opts = {}) {
    const r = await mk.invoke('tools-health', { refresh: !!opts.refresh });
    last = r;
    app.events.emit('tools:health', r);
    try { app.status.refresh(); } catch {}
    return r;
  }

  // ---------- what fixes it ----------
  const BREW = 'brew install djvulibre pdf2djvu', APT = 'sudo apt install djvulibre-bin pdf2djvu', DNF = 'sudo dnf install djvulibre pdf2djvu';
  const A = {
    // getters: the label is read in the interface language of the moment
    get check() { return { id: 'check-tools', label: app.t('Check again') }; },
    get report() { return { id: 'report', label: app.t('Report this'), url: ISSUES_URL }; },
    details: text => ({ id: 'copy-details', label: app.t('Copy details'), text }),
    url: (label, url) => ({ id: 'open-url', label, url }),
    copy: (label, text) => ({ id: 'copy', label, text }),
  };
  /** The same remedy main gives (main.js toolRemedy), for results that carry none (older results, tests). */
  function fallbackRemedy(id, r = {}) {
    const T = TOOLS[id], platform = r.platform || mk.platform;
    const shipped = platform === 'win32' || id === 'pandoc';
    if (shipped && r.packaged === false) return { text: app.t('Run npm run fetch-tools in the Markooj folder, then check again. Or install {tool} yourself.', { tool: T.label }), steps: [{ text: app.t('In the Markooj folder, run:'), command: 'npm run fetch-tools' }], actions: [A.copy(app.t('Copy command'), 'npm run fetch-tools'), A.url(getLabel(T), T.url), A.check] };
    // since 1.2 the tools are optional Features (src/features.js): Install from File → Options → Features
    const feat = app.features?.forTool?.(id, platform);
    if (feat && feat.available) return {
      text: r.portable ? app.t('Install {feature} from File → Options → Features ({size} to download), or unzip the full portable zip again into a new folder. Or install {tool} yourself.', { feature: feat.name, size: feat.downloadText, tool: T.label }) : app.t('Install {feature} from File → Options → Features ({size} to download). Or install {tool} yourself.', { feature: feat.name, size: feat.downloadText, tool: T.label }),
      steps: [{ text: app.t('Open File → Options → Features and choose Install next to {feature}.', { feature: feat.name }) }], actions: [{ id: 'install-feature', label: app.t('Install {feature}', { feature: feat.name }), feature: feat.id }, A.url(getLabel(T), T.url), A.check],
    };
    if (shipped) return { text: r.portable ? app.t('Unzip the full portable zip again into a new folder: that puts {tool} back, and your data folder can move with it. Or install {tool} yourself.', { tool: T.label }) : app.t('Download Markooj again and install it over this copy: that puts {tool} back, and your documents and settings stay. Or install {tool} yourself.', { tool: T.label }), steps: [], actions: [A.url(app.t('Repair Markooj'), DOWNLOAD_URL), A.url(getLabel(T), T.url), A.check] };
    if (platform === 'darwin') return { text: app.t('Install the free DjVu tools with Homebrew: open Terminal and run {command}, then check again.', { command: BREW }), steps: [{ text: app.t('If you do not have Homebrew yet, get it from brew.sh.') }, { text: app.t('Then open Terminal and run:'), command: BREW }], actions: [A.copy(app.t('Copy command'), BREW), A.url(app.t('Get Homebrew'), 'https://brew.sh'), A.check] };
    return { text: app.t('Install the free DjVu tools from a terminal: {apt} (Debian, Ubuntu) or {dnf} (Fedora), then check again.', { apt: APT, dnf: DNF }), steps: [{ text: app.t('Debian, Ubuntu and Mint:'), command: APT }, { text: app.t('Fedora:'), command: DNF }], actions: [A.copy(app.t('Copy apt command'), APT), A.copy(app.t('Copy dnf command'), DNF), A.check] };
  }
  const stateOf = t => (!t ? 'missing' : t.ok ? 'ok' : t.state || (t.path ? 'failed' : 'missing'));

  /** Technical details for a report: version, platform and every tool's path, version and error. */
  function detailsText(r = last || {}, only) {
    const tools = r.tools || {};
    const lines = [`Markooj ${r.version || app.version || ''} on ${r.platform || mk.platform}${r.packaged === false ? ' (source checkout)' : ''}${r.portable ? ' (portable)' : ''}`.replace(/\s+/g, ' ')];
    for (const id of IDS) {
      if (only && family(only) !== id) continue;
      const t = tools[id] || {};
      lines.push(`${TOOLS[id].label}: ${stateOf(t)}${t.version ? ' ' + t.version : ''}${t.bundled ? ' (included)' : t.feature ? ' (feature)' : ''} |${t.path || 'not found'}${t.error ? ' | ' + t.error : ''}`);
      if (t.output) lines.push('  output: ' + String(t.output).replace(/\s+/g, ' ').slice(0, 300));
    }
    if (r.toolsDir) lines.push('Tools folder: ' + r.toolsDir);
    if (r.reason) lines.push(`Re-checked because: ${r.reason}${r.failedTool ? ' (' + r.failedTool + ')' : ''}`);
    return lines.join('\n');
  }

  /**
   * What the user can do about one tool: {id, label, state, ok, title, text, steps, works, actions, details}.
   * Titles and text lead with the fix; `actions` use the ids runAction() knows.
   */
  function remedy(id, r = last) {
    id = family(id);
    const T = TOOLS[id], t = (r && r.tools && r.tools[id]) || null;
    const state = stateOf(t);
    const details = detailsText(r || {}, id);
    const goal = app.t(T.goal);
    const base = { id, label: T.label, state, ok: state === 'ok', works: app.t(T.works), details, steps: [] };
    if (state === 'ok') return { ...base, title: app.t('{tool} is ready', { tool: T.label }), text: app.t(T.uses), actions: [] };
    if (state === 'missing') {
      const m = (t && t.remedy) || fallbackRemedy(id, r || {});
      const repair = (m.actions || []).some(a => a.url === DOWNLOAD_URL || a.label === 'Repair Markooj' || a.label === app.t('Repair Markooj'));
      const install = (m.actions || []).find(a => a.id === 'install-feature');
      const gone = r && r.reason === 'missing-during-use' && r.failedTool && family(r.failedTool) === id;
      return {
        ...base, steps: m.steps || [], actions: m.actions || [], fix: m.text,
        title: app.t('{action} to {goal}', { action: install ? install.label : repair ? app.t('Repair Markooj') : getLabel(T), goal }),
        text: [T.kind === 'tools' ? app.t('To {goal}, Markooj needs the free {tool} tools.', { goal, tool: T.label }) : app.t('To {goal}, Markooj needs the free {tool} program.', { goal, tool: T.label }), m.text, gone ? app.t('({tool} was moved or deleted while Markooj was running.)', { tool: T.label }) : ''].filter(Boolean).join(' '),
      };
    }
    if (state === 'blocked') return {
      ...base, title: app.t('Let {tool} start to {goal}', { tool: T.label, goal }),
      text: app.t('Allow {tool} in your security software, then check again. Markooj found {tool}, but your computer did not let it start.', { tool: T.label }),
      actions: [A.check, A.details(details), A.report],
    };
    return {
      ...base, title: app.t('Check {tool} again', { tool: T.label }),
      text: app.t('Check again. Markooj found {tool} but could not confirm that it works. If it still fails, copy the details and report it, so it can be fixed.', { tool: T.label }),
      actions: [A.check, A.details(details), A.report],
    };
  }

  /** Plain-English summary: {ok, title, lead, missing:[{id,label,off}], works, fix, lines, remedies, portable} */
  function describe(r) {
    r = r || last || {};
    const tools = r.tools || {};
    const ids = (r.missing || []).map(family).filter((id, i, a) => a.indexOf(id) === i && TOOLS[id]);
    const missing = ids.map(id => ({ id, label: TOOLS[id].label, off: app.t(TOOLS[id].goal) }));
    const remedies = ids.map(id => remedy(id, r));
    const title = !missing.length ? app.t('Your tools are ready') : app.t('Almost everything is ready');
    const lead = !missing.length
      ? app.t('Pandoc, pdf2djvu and DjVuLibre all work, so every format in Save As is ready and DjVu files open.')
      : missing.length > 1 ? app.t('{tools} need attention: follow the steps below. Writing, editing, PDF, printing, Word (.docx) and EPUB all work.', { tools: join(missing.map(m => m.label)) })
        : app.t('{tool} needs attention: follow the steps below. Writing, editing, PDF, printing, Word (.docx) and EPUB all work.', { tool: missing[0].label });
    const lines = IDS.filter(id => tools[id]).map(id => { const t = tools[id]; return { id, label: TOOLS[id].label, ok: !!t.ok, state: stateOf(t), version: t.version || null, bundled: !!t.bundled, path: t.path || null, error: t.error || null }; });
    return { ok: !missing.length, title, lead, missing, remedies, works: lead, fix: remedies[0] ? remedies[0].text : '', lines, portable: !!r.portable };
  }

  /** One sentence for a toast or a status tip: the first fix, then what still works. */
  function summary(r) {
    const d = describe(r);
    if (d.ok) return app.t('{title}.', { title: d.title });
    const first = d.remedies[0];
    return d.remedies.length > 1 ? app.tn('{title} (and {count} more). {works}', d.remedies.length - 1, { title: first.title, works: first.works }) : app.t('{title}. {works}', { title: first.title, works: first.works });
  }

  // ---------- usage: help shows up for features people use ----------
  const getList = k => { try { const v = app.settings.get(k, []); return Array.isArray(v) ? v : []; } catch { return []; } };
  function markTried(id) {
    id = family(id);
    const list = getList('toolsTried');
    if (!list.includes(id)) try { app.settings.set('toolsTried', [...list, id]); } catch {}
  }
  function noteUse(id) {
    id = family(id);
    markTried(id);
    try { const u = { ...(app.settings.get('toolUse', {}) || {}) }; u[id] = (Number(u[id]) || 0) + 1; app.settings.set('toolUse', u); } catch {}
  }
  const tried = id => getList('toolsTried').includes(family(id));
  const usedOften = id => { try { return (Number((app.settings.get('toolUse', {}) || {})[family(id)]) || 0) >= 3; } catch { return false; } };
  /** Missing tools worth a word without being asked: ones the user has tried, or that just failed while in use. */
  function relevant(r) {
    if (!r || r.ok) return [];
    return (r.missing || []).map(family).filter((id, i, a) => a.indexOf(id) === i && (tried(id) || (r.failedTool && family(r.failedTool) === id)));
  }

  // Save As reads export-formats (cached 30 s in the exporter): drop that cache so the grid labels follow the check.
  function refreshFormats() {
    try { if (typeof app.exporter?.refreshFormats === 'function') return app.exporter.refreshFormats(); } catch {}
    try { const off = app.exporter?.register?.({ id: 'mk-health-refresh', label: 'Refresh', ext: 'tmp', /* never shown */ run() { return ''; } }); if (typeof off === 'function') off(); } catch {}
  }

  // ---------- doing what a button says ----------
  async function copy(text, okMsg = app.t('Copied.')) {
    let ok = false;
    try { if (mk.copyText) { await mk.copyText(String(text ?? '')); ok = true; } } catch {}
    if (!ok) { try { await navigator.clipboard.writeText(String(text ?? '')); ok = true; } catch {} }
    app.ui.toast(ok ? okMsg : app.t('Select the text and press Ctrl+C to copy it. The clipboard did not answer this time.'), { kind: ok ? 'success' : 'warn', timeout: ok ? 1800 : 6000 });
    return ok;
  }
  function openUrl(url) {
    return mk.invoke('open-external', url).then(() => true, () => copy(url, app.t('Link copied. Paste it into your browser.')));
  }
  /**
   * Runs an action from main or from remedy(): {id, label, url?, text?, tool?, path?}. `ctx` may give
   * retry(), saveAs(), chooseFormat(), openFile(), onChecked(result), tool, details, and a run for any other id.
   */
  async function runAction(a, ctx = {}) {
    if (!a) return;
    if (typeof a.run === 'function') return a.run();
    if (typeof ctx[a.id] === 'function') return ctx[a.id](a);
    switch (a.id) {
      case 'open-url': return openUrl(a.url);
      case 'copy': return copy(a.text, /^(npm|brew|sudo)\b/.test(String(a.text || '')) ? app.t('Command copied. Paste it into a terminal.') : app.t('Copied.'));
      case 'copy-details': return copy(a.text || ctx.details || detailsText(), app.t('Details copied. Paste them into your report.'));
      case 'report': {
        const det = ctx.details || a.text || detailsText();
        await copy(det, app.t('Details copied. Paste them into the report that opens.'));
        return openUrl(a.url || ISSUES_URL);
      }
      case 'check-tools': {
        const n = await check({ refresh: true });
        refreshFormats();
        const id = ctx.tool ? family(ctx.tool) : null;
        if (typeof ctx.onChecked === 'function') { try { await ctx.onChecked(n); } catch (e) { console.error(e); } }
        if (id ? n.tools?.[id]?.ok : n.ok) { app.ui.toast(id ? app.t('{tool} is ready. You can {goal} now.', { tool: TOOLS[id].label, goal: app.t(TOOLS[id].goal) }) : app.t('Your tools are ready.'), { kind: 'success' }); return n; }
        if (id) return offer(id, { result: n, again: true });
        return showDetails(n);
      }
      case 'tool': return offer(a.tool || ctx.tool);
      case 'retry': return ctx.retry ? ctx.retry() : undefined;
      case 'save-as': {
        if (ctx.saveAs) return ctx.saveAs();
        const d = app.docs?.active?.();
        return d && d.kind === 'markdown' ? app.docs.saveAs(d) : app.backstage?.open?.('saveas');
      }
      case 'choose-format': return ctx.chooseFormat ? ctx.chooseFormat() : app.backstage?.open?.('saveas');
      case 'open-file': return ctx.openFile ? ctx.openFile() : app.commands.run('file.open');
      case 'open-folder': return a.path ? mk.invoke('open-folder', a.path).catch(e => toastError(e)) : undefined;
      // optional Features (src/features.js): Install, Install from file…, File → Options → Features
      case 'install-feature': return app.features ? app.features.install(a.feature || app.features.forTool?.(a.tool || ctx.tool)?.id) : app.backstage?.open?.('options');
      case 'feature-from-file': return app.features ? app.features.installFromFile(a.feature) : app.backstage?.open?.('options');
      case 'open-features': return app.features ? app.features.open() : app.backstage?.open?.('options');
      default: console.warn('[health] no handler for action', a.id);
    }
  }
  /** Toast buttons for an error from main (mk.errorInfo): the actions it carries, run with `ctx`. */
  function errorActions(e, ctx = {}) {
    const info = (mk.errorInfo && mk.errorInfo(e)) || null;
    const acts = (info && info.actions) || [];
    const ctx2 = { ...ctx, details: (info && info.details) || ctx.details, tool: ctx.tool || (info && info.tool) };
    return acts
      .filter(a => a && a.label && (a.id !== 'retry' || ctx.retry) && a.id !== 'copy-details' && a.id !== 'report')
      .map(a => ({ label: a.label, run: () => runAction(a, ctx2) }));
  }
  /**
   * A toast for an error from main: its message (which already leads with the fix), its buttons, and "Details" for the
   * technical part. opts: {retry, saveAs, chooseFormat, openFile, tool, kind, timeout, lead}
   */
  function toastError(e, opts = {}) {
    const info = (mk.errorInfo && mk.errorInfo(e)) || null;
    const tool = opts.tool || (info && info.tool);
    if (tool) markTried(tool);
    const actions = errorActions(e, opts).slice(0, 2);
    const details = (info && info.details) || '';
    const msg = [opts.lead, plainError(e, app.t('Try that again.'))].filter(Boolean).join(' ');
    if (details && actions.length < 3) actions.push({ label: app.t('Details'), run: () => showError(e, opts) });
    return app.ui.toast(msg, { kind: opts.kind || 'error', actions, timeout: opts.timeout ?? (actions.length ? 12000 : 7000) });
  }
  /** The full message in a dialog: the fix, its buttons, and the technical details folded away. */
  async function showError(e, opts = {}) {
    const info = (mk.errorInfo && mk.errorInfo(e)) || { actions: [], details: '' };
    const box = document.createElement('div');
    box.className = 'mk-health';
    box.innerHTML = `<p class="mk-health-lead">${esc(plainError(e, app.t('Try that again.')))}</p>${info.details ? `<details class="mk-health-more"><summary>${app.th('Technical details')}</summary><pre>${esc(info.details)}</pre></details>` : ''}`;
    const acts = (info.actions || []).filter(a => a && a.label && (a.id !== 'retry' || opts.retry));
    if (info.details && !acts.some(a => a.id === 'copy-details')) acts.push(A.details(info.details));
    const v = await app.ui.dialog({
      title: opts.title || app.t('What you can do'), icon: 'info', wide: !!info.details, body: box,
      buttons: [...acts.map((a, i) => ({ label: a.label, value: 'a' + i, left: a.id === 'copy-details' || a.id === 'report' })), { label: app.t('Close'), value: 'close', primary: true }],
      cancelValue: 'close',
    });
    const picked = acts[Number(String(v).slice(1))];
    if (typeof v === 'string' && v[0] === 'a' && picked) await runAction(picked, { ...opts, details: info.details });
    return v;
  }

  // ---------- the moment a feature needs a tool ----------
  /** Shows how to get or fix a tool, when the user tries a feature that needs it. opts: {result, feature, again} */
  async function offer(id, opts = {}) {
    id = family(id);
    markTried(id);
    let r = opts.result || last;
    if (!r) { try { r = await check(); } catch { r = null; } }
    const rem = remedy(id, r);
    if (rem.ok) { app.ui.toast(app.t('{tool} is ready. Try that again.', { tool: rem.label }), { kind: 'success' }); return 'ok'; }
    const T = TOOLS[id];
    const ctx = { tool: id, details: rem.details };
    const lead = rem.text;
    const footer = rem.actions.filter(a => a.id !== 'copy' || !rem.steps.some(s => s.command === a.text));
    if (typeof app.ui.solution === 'function') {
      return app.ui.solution({
        title: rem.title, icon: 'info', lead, steps: rem.steps, still: rem.works, details: rem.details,
        actions: footer.map((a, i) => ({ label: a.label, primary: i === 0, left: a.id === 'copy-details' || a.id === 'report', run: () => runAction(a, ctx) })),
        closeLabel: app.t('Not now'),
      });
    }
    const box = document.createElement('div');
    box.className = 'mk-health';
    box.innerHTML = `<p class="mk-health-lead">${esc(lead)}</p>${stepsHtml(rem.steps)}<p class="mk-health-works">${esc(rem.works)}</p>
      <details class="mk-health-more"><summary>${app.th('Technical details')}</summary><pre>${esc(rem.details)}</pre></details>`;
    wireCopy(box);
    const v = await app.ui.dialog({
      title: rem.title, icon: 'info', wide: true, body: box,
      buttons: [...footer.map((a, i) => ({ label: a.label, value: 'a' + i, primary: i === 0, left: a.id === 'copy-details' || a.id === 'report' })), { label: app.t('Not now'), value: 'close' }],
      cancelValue: 'close',
    });
    const picked = footer[Number(String(v).slice(1))];
    if (typeof v === 'string' && v[0] === 'a' && picked) await runAction(picked, ctx);
    return v;
  }
  function stepsHtml(steps) {
    if (!steps || !steps.length) return '';
    return `<ol class="mk-health-steps">${steps.map(s => `<li>${esc(s.text || '')}${s.command ? `<div class="mk-health-cmd"><code>${esc(s.command)}</code><button type="button" class="btn" data-copy="${esc(s.command)}">${app.th('Copy')}</button></div>` : ''}</li>`).join('')}</ol>`;
  }
  function wireCopy(el) {
    el.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => copy(b.dataset.copy, app.t('Command copied. Paste it into a terminal.'))));
  }

  // ---------- Help → Check Tools ----------
  function detailsBody(r) {
    const d = describe(r);
    const tools = (r && r.tools) || {};
    const box = document.createElement('div');
    box.className = 'mk-health';
    const rows = IDS.filter(id => tools[id]).map(id => {
      const rem = remedy(id, r), t = tools[id];
      const status = rem.ok
        ? `<div class="mk-health-what">${esc(app.t(TOOLS[id].uses))}</div><div class="mk-health-ok">${esc(t.bundled ? app.t('Ready · included with Markooj') : t.feature ? app.t('Ready · installed from Features') : app.t('Ready · found on this computer'))}</div>`
        : `<div class="mk-health-what">${esc(app.t(TOOLS[id].uses))}</div><div class="mk-health-fix"><b>${esc(rem.title)}.</b> ${esc(rem.fix || rem.text)}</div>${stepsHtml(rem.steps)}
           <div class="mk-health-acts">${rem.actions.filter(a => a.id !== 'check-tools' && !(a.id === 'copy' && rem.steps.some(s => s.command === a.text))).map((a, i) => `<button type="button" class="btn${i === 0 ? ' primary' : ''}" data-tool="${id}" data-act="${rem.actions.indexOf(a)}">${esc(a.label)}</button>`).join('')}</div>`;
      return `<tr data-tool="${id}">
        <td class="mk-health-st ${rem.ok ? 'ok' : 'bad'}">${svg(rem.ok ? 'check' : 'info')}</td>
        <td><b>${esc(TOOLS[id].label)}</b>${t.version ? ` <span class="mk-health-v" translate="no">${esc(t.version)}</span>` : ''}${status}</td>
      </tr>`;
    }).join('');
    box.innerHTML = `
      <p class="mk-health-lead">${esc(d.lead)}</p>
      <table class="mk-health-t">${rows}</table>
      <details class="mk-health-more"><summary>${app.th('Technical details')}</summary><pre>${esc(detailsText(r))}</pre>${r && r.portable ? `<p>${app.th('Portable copy: settings are kept in the data folder next to Markooj.')}</p>` : ''}</details>`;
    wireCopy(box);
    box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const rem = remedy(b.dataset.tool, r);
      runAction(rem.actions[Number(b.dataset.act)], { tool: b.dataset.tool, details: rem.details });
    }));
    return box;
  }

  async function showDetails(r) {
    r = r || last || await check();
    const d = describe(r);
    const v = await app.ui.dialog({
      title: d.title, icon: d.ok ? 'check' : 'info', kind: '', wide: true,
      body: detailsBody(r),
      buttons: [{ label: app.t('Copy details'), value: 'copy', left: true }, { label: app.t('Check again'), value: 'again', left: true }, { label: app.t('OK'), value: true, primary: true }],
    });
    if (v === 'copy') await copy(detailsText(r), app.t('Details copied. Paste them into your report.'));
    if (v === 'again') {
      const n = await check({ refresh: true });
      refreshFormats();
      if (n.ok) app.ui.toast(app.t('Your tools are ready.'), { kind: 'success' });
      else showDetails(n);
    }
    return v;
  }

  // ---------- messages without being asked ----------
  // One toast per distinct problem, and only for tools that matter right now (see relevant()); solution first, with the
  // first fix as a button and "How to fix" for the rest. Never blocks writing.
  function notify(r, ids) {
    ids = ids || relevant(r);
    if (!r || r.ok || !ids.length) { if (r && r.ok) notifiedKey = ''; return; }
    const key = ids.join(',') + '|' + (r.reason || '');
    if (key === notifiedKey) return;
    notifiedKey = key;
    const rem = remedy(ids[0], r);
    const first = rem.actions.find(a => a.id !== 'check-tools');
    const actions = [];
    if (first) actions.push({ label: first.label, run: () => runAction(first, { tool: rem.id, details: rem.details }) });
    actions.push({ label: app.t('How to fix'), run: () => offer(rem.id, { result: r }) });
    app.ui.toast(app.t('{title}. {works}', { title: rem.title, works: rem.works }), { kind: 'info', timeout: 15000, actions });
  }

  // Status bar: a small button while a tool the user relies on needs attention (hidden otherwise).
  app.status.addItem({
    id: 'tools-health', side: 'right', order: 5,
    render(el) {
      el.innerHTML = '';
      const ids = relevant(last);
      if (!ids.length) return;
      const rem = remedy(ids[0], last);
      const b = document.createElement('button');
      b.className = 'sb mk-health-sb';
      b.type = 'button';
      b.innerHTML = `${svg('info')}<span class="hide-narrow">${app.th('Tools@@status bar')}</span>`;
      b.dataset.tip = rem.title;
      b.dataset.tipD = app.t('{text} {works} Click to see how.', { text: rem.text, works: rem.works });
      b.setAttribute('aria-label', rem.title);
      b.addEventListener('click', () => { try { app.ui.ripple?.(b); } catch {} offer(rem.id, { result: last }); });
      el.append(b);
    },
  });

  app.commands.register('help.checkTools', {
    label: app.tm('Check Tools'), icon: 'check',
    description: app.tm('Shows whether Pandoc, pdf2djvu and DjVuLibre are ready, and how to get any that are missing.'),
    run: async () => { await check({ refresh: true }); refreshFormats(); return showDetails(last); },
  });
  try { app.tooltips?.register?.('help.checkTools', { title: app.tm('Check Tools'), description: app.tm('Shows whether Pandoc, pdf2djvu and DjVuLibre are ready, and how to get any that are missing.') }); } catch {}

  const style = document.createElement('style');
  style.textContent = `
    .mk-health{min-width:0;overflow-wrap:anywhere}
    .mk-health-lead{margin:0 0 10px}
    .mk-health-t{border-collapse:collapse;width:100%;table-layout:fixed;margin:4px 0 10px}
    .mk-health-t td{padding:8px 6px;vertical-align:top;border-top:1px solid var(--line, rgba(0,0,0,.08))}
    .mk-health-t tr:first-child td{border-top:0}
    .mk-health-st{width:26px}
    .mk-health-st .i{width:16px;height:16px}
    .mk-health-st.ok{color:var(--green, #34c759)}
    .mk-health-st.bad{color:var(--accent, #007aff)}
    .mk-health-v{color:var(--text-2, #6e6e73);font-size:12px}
    .mk-health-what{color:var(--text-2, #6e6e73);font-size:12px;margin-top:2px}
    .mk-health-ok{color:var(--green, #34c759);font-size:12px;margin-top:2px}
    .mk-health-fix{margin:6px 0 0}
    .mk-health-works{margin:8px 0}
    .mk-health-steps{margin:6px 0;padding-left:20px}
    .mk-health-steps li{margin:4px 0}
    .mk-health-cmd{display:flex;gap:8px;align-items:center;margin-top:4px}
    .mk-health-cmd code{flex:1;min-width:0;padding:4px 8px;border-radius:6px;background:var(--fill, rgba(0,0,0,.05));font-size:12px;user-select:all}
    .mk-health-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .mk-health-more{font-size:12px;color:var(--text-2, #6e6e73);margin-top:6px}
    .mk-health-more pre{margin:6px 0 0;white-space:pre-wrap;word-break:break-all;font-size:11px}
    .mk-health-sb{color:var(--accent, #007aff)}
  `;
  document.head.append(style);

  // a tool that vanished or was blocked while it was in use: the user was using that feature, so say how to fix it
  mk.on('tools-health', r => {
    if (!r) return;
    last = r;
    app.events.emit('tools:health', r);
    try { app.status.refresh(); } catch {}
    refreshFormats();
    if (r.failedTool) markTried(r.failedTool);
    notify(r);
  });

  // startup: check quietly shortly after the window is ready (it never slows the first paint). Optional tools stay quiet;
  // only a Pandoc that is gone while the user exports with it often gets a message.
  let startupDone = null, startupAt = 0; // resolves with the startup check's result (smoke test: nothing is shown for tools at start)
  const startupP = new Promise(res => { startupDone = v => { startupAt = Date.now(); res(v); }; });
  app.events.on('ready', () => {
    setTimeout(async () => {
      try {
        const r = last || await check(); // someone may have checked already (Help, a smoke test)
        startupDone(r);
        if (!r.ok) {
          refreshFormats();
          const urgent = (r.missing || []).map(family).filter(id => id === 'pandoc' && usedOften(id));
          if (urgent.length) notify(r, urgent);
        }
      } catch (e) { startupDone(null); console.warn('tools self-check failed', e); }
      try {
        const info = await mk.invoke('app-info');
        const p = info && info.portableInfo;
        if (p && p.error && !p.active) app.ui.toast(p.error, { kind: 'info', timeout: 12000, details: p.details || '', detailsTitle: app.t('Technical details') });
      } catch {}
    }, 1200);
  });

  app.health = { check, last: () => last, describe, summary, showDetails, remedy, offer, runAction, errorActions, toastError, showError, markTried, noteUse, notify, refreshFormats, copy, detailsText, relevant };

  // ---------- smoke tests ----------
  const A2 = app.assert || ((c, m) => { if (!c) throw new Error('Assertion failed: ' + m); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const topDialog = () => [...document.querySelectorAll('.dlg')].pop();
  const closeDialog = async label => { const dlg = topDialog(); const b = dlg && [...dlg.querySelectorAll('.dlg-foot button')].find(x => x.textContent === label); if (b) b.click(); await sleep(320); };
  // words people should never meet first: blame, raw codes, "reinstall" for a tool that is there
  const BAD = { test: s => /colour|centre|licence|dialogue|you (?:did|made)|your fault|invalid input/i.test(s) || /\bE(?:BUSY|PERM|ACCES|NOENT|NOSPC|ROFS|NAMETOOLONG|MFILE|NFILE|NOTFOUND|CONNRESET|TIMEDOUT)\b/.test(s) };
  const BAD_WORDS = BAD;
  const LEADS = /^(Try|Choose|Open|Save|Install|Run|Get|Repair|Check|Copy|Close|Free|Allow|Let|Download|Unzip|Update|Use|Pick|Refresh|Rename|Delete|Wait|Give|List|Put|Move|Ask|Please|Your tools|Almost)/;

  app.tests.register('health: self-check starts every bundled tool and reports its version', async () => {
    const r = await mk.invoke('tools-health', { refresh: true });
    for (const id of IDS) A2(r.tools && r.tools[id] && 'ok' in r.tools[id] && 'path' in r.tools[id] && r.tools[id].state, 'shape for ' + id + ': ' + JSON.stringify(r.tools && r.tools[id]));
    A2(Array.isArray(r.missing) && typeof r.ok === 'boolean' && typeof r.fix === 'string', 'missing[], ok and fix present');
    A2(r.ok === (r.missing.length === 0), 'ok matches missing');
    for (const id of IDS) A2((r.tools[id].state === 'ok') === r.tools[id].ok, 'state matches ok for ' + id);
    for (const id of r.missing) if (r.tools[id].state === 'missing') A2(r.tools[id].remedy && r.tools[id].remedy.actions.length, 'a missing tool carries its remedy: ' + id);
    if (r.bundleExpected) {
      A2(r.ok, 'bundled tools all start: ' + JSON.stringify(r.missing.map(id => [id, r.tools[id].error, r.tools[id].path])));
      A2(/^\d+\.\d+/.test(r.tools.pandoc.version || ''), 'Pandoc version: ' + r.tools.pandoc.version);
      A2(/^\d+\.\d+/.test(r.tools.pdf2djvu.version || ''), 'pdf2djvu version: ' + r.tools.pdf2djvu.version);
      A2(/^\d+\.\d+/.test(r.tools.ddjvu.version || ''), 'DjVuLibre version: ' + r.tools.ddjvu.version);
      A2(r.tools.pandoc.bundled && r.tools.pdf2djvu.bundled && r.tools.ddjvu.bundled, 'tools come from the bundle');
      const t = await mk.invoke('tools');
      A2(t.pandocVersion === r.tools.pandoc.version, `same Pandoc as the tools channel (${t.pandocVersion} / ${r.tools.pandoc.version})`);
    }
    // cached: a second call is quick and returns the same check
    const t0 = performance.now();
    const again = await mk.invoke('tools-health');
    A2(again.checkedAt === r.checkedAt, 'second call uses the cached check');
    A2(performance.now() - t0 < 1500, 'cached call is quick');
  });

  app.tests.register('health: the official Windows DjVuLibre (usage text, exit 1) counts as working', async () => {
    const win = 'DjVu decompression utility\n\nUsage: ddjvu [options] <djvufile> [<outputfile>]\n\nOptions:\n  -verbose  Print various informational messages.\n';
    const v = await mk.invoke('tools-verdict', 'ddjvu', { started: true, code: 1, out: win });
    A2(v.ok && v.state === 'ok' && v.usage && v.version === null, 'usage text with exit 1 works: ' + JSON.stringify(v));
    const deb = await mk.invoke('tools-verdict', 'ddjvu', { started: true, code: 1, out: 'DDJVU --- DjVuLibre-3.5.29\nDjVu decompression utility\n' });
    A2(deb.ok && deb.version === '3.5.29', 'version line read: ' + JSON.stringify(deb));
    const junk = await mk.invoke('tools-verdict', 'ddjvu', { started: true, code: 1, out: 'The system cannot execute the specified program.' });
    A2(!junk.ok && junk.state === 'failed', 'other output with exit 1 fails: ' + JSON.stringify(junk));
    const blocked = await mk.invoke('tools-verdict', 'ddjvu', { started: false, code: 'EPERM', out: '' });
    A2(!blocked.ok && blocked.state === 'blocked', 'a program that may not start is "blocked": ' + JSON.stringify(blocked));
    const pandoc = await mk.invoke('tools-verdict', 'pandoc', { started: true, code: 0, out: 'pandoc.exe 3.6\nFeatures: +server +lua' });
    A2(pandoc.ok && pandoc.version === '3.6', 'Pandoc version: ' + JSON.stringify(pandoc));
    // the same official build: djvutxt (no arguments) and djvused --help print their usage and exit 10
    const txt = await mk.invoke('tools-verdict', 'djvutxt', { started: true, code: 10, out: 'DjVu text extraction utility\n\nUsage: djvutxt [options] <djvufile> [<outputfile>]\n' });
    A2(txt.ok && txt.usage, 'djvutxt usage text with exit 10 works: ' + JSON.stringify(txt));
    const sed = await mk.invoke('tools-verdict', 'djvused', { started: true, code: 10, out: 'DJVUSED --- DjVuLibre-3.5.29\nSimple DjVu file manipulation program\n\nUsage: djvused [options] djvufile\n' });
    A2(sed.ok && sed.version === '3.5.29', 'djvused usage text with exit 10 works: ' + JSON.stringify(sed));
    const usageForOther = await mk.invoke('tools-verdict', 'pandoc', { started: true, code: 1, out: 'Usage: ddjvu' });
    A2(!usageForOther.ok, 'the DjVu usage rule applies to DjVuLibre only');
  });

  app.tests.register('health: messages lead with the fix, per platform, and never say reinstall for a tool that is there', async () => {
    const cases = [
      // since 1.2 the tools are optional Features: the fix is "Install … from File → Options → Features" with an Install button
      ['ddjvu', { platform: 'win32', packaged: true }, /^Install DjVu tools$/, /File → Options → Features/, /djvu\.sourceforge\.net/],
      ['ddjvu', { platform: 'win32', packaged: true, portable: true }, /^Install DjVu tools$/, /portable zip/, /djvu\.sourceforge\.net/],
      ['ddjvu', { platform: 'darwin', packaged: true }, /Copy command/, /brew install djvulibre pdf2djvu/, /brew\.sh/],
      ['pdf2djvu', { platform: 'linux', packaged: true }, /Copy apt command/, /sudo apt install djvulibre-bin pdf2djvu/, /sudo dnf install djvulibre pdf2djvu/],
      ['pandoc', { platform: 'darwin', packaged: true }, /^Install Pandoc$/, /File → Options → Features/, /pandoc\.org\/installing\.html/],
      ['pandoc', { platform: 'win32', packaged: false }, /Copy command/, /npm run fetch-tools/, /pandoc\.org/],
    ];
    for (const [id, ctx, label, a, b] of cases) {
      const { remedy: m } = await mk.invoke('tools-remedy-probe', id, ctx);
      const all = JSON.stringify(m);
      A2(m.actions.some(x => label.test(x.label)), `${id} ${ctx.platform}: button ${label}: ${all}`);
      A2(a.test(all) && b.test(all), `${id} ${ctx.platform}: ${a} and ${b} in ${all}`);
      A2(m.actions.some(x => x.id === 'check-tools'), `${id} ${ctx.platform}: Check again`);
      A2(LEADS.test(m.text) && !BAD_WORDS.test(m.text), `${id} ${ctx.platform}: leads with the fix: ${m.text}`);
      for (const x of m.actions) if (x.url) A2(/^https:\/\/(datakeen\.github\.io\/markooj\/|djvu\.sourceforge\.net\/|brew\.sh|pandoc\.org\/installing\.html|jwilk\.net\/software\/pdf2djvu)/.test(x.url), 'official link only: ' + x.url);
    }
    // the error a feature gets on this computer: what it is for first, then the fix, then what still works
    const { needed } = await mk.invoke('tools-remedy-probe', 'ddjvu', {});
    A2(/^To open DjVu files, Markooj needs the free DjVuLibre tools\./.test(needed.message) && /Everything else works\.$/.test(needed.message) && needed.code === 'TOOL_MISSING' && needed.actions.length, 'feature message: ' + needed.message);
    A2(!/missing from this copy|Off for now/.test(needed.message), 'no old wording');
    // a tool that is there but failed its check: Check again and Report, never reinstall or repair
    const failed = { ok: false, missing: ['ddjvu'], platform: 'win32', packaged: true, tools: { ddjvu: { id: 'ddjvu', ok: false, state: 'failed', path: 'C:\\x\\ddjvu.exe', error: 'did not answer as expected (exit 1)', output: 'odd' } } };
    const f = remedy('ddjvu', failed);
    A2(/could not confirm that it works/.test(f.text) && /^Check again/.test(f.text), 'failed: ' + f.text);
    A2(f.actions.map(a => a.id).join() === 'check-tools,copy-details,report' && !/reinstall|repair/i.test(f.text + f.title), 'failed offers Check again, Copy details, Report this: ' + JSON.stringify(f.actions));
    A2(/C:\\x\\ddjvu\.exe/.test(f.details) && /exit 1/.test(f.details), 'details keep the path and the error');
    const blocked = remedy('ddjvu', { ...failed, tools: { ddjvu: { ...failed.tools.ddjvu, state: 'blocked', error: 'could not start (EPERM)' } } });
    A2(/^Allow DjVuLibre in your security software/.test(blocked.text) && !/reinstall/i.test(blocked.text), 'blocked: ' + blocked.text);
  });

  app.tests.register('health: Check Tools reads well when all is fine and when something needs attention', async () => {
    const ok = { ok: true, missing: [], platform: 'win32', packaged: true, tools: { pandoc: { id: 'pandoc', ok: true, state: 'ok', bundled: true, version: '3.6', path: 'a' }, pdf2djvu: { id: 'pdf2djvu', ok: true, state: 'ok', bundled: true, version: '0.9.19', path: 'b' }, ddjvu: { id: 'ddjvu', ok: true, state: 'ok', bundled: true, version: '3.5.28', path: 'c' } } };
    const dOk = describe(ok);
    A2(dOk.ok && dOk.title === 'Your tools are ready' && /every format in Save As is ready/.test(dOk.lead), 'all fine: ' + dOk.title + ' / ' + dOk.lead);
    const fake = {
      ...ok, ok: false, missing: ['pandoc'], bundleExpected: true,
      tools: { ...ok.tools, pandoc: { id: 'pandoc', label: 'Pandoc', ok: false, state: 'missing', path: null, error: 'not found' } },
    };
    const d = describe(fake);
    A2(!d.ok && d.title === 'Almost everything is ready', 'title: ' + d.title);
    A2(/PDF/.test(d.lead) && /Word/.test(d.lead) && /Pandoc needs attention/.test(d.lead), 'says what still works: ' + d.lead);
    A2(d.remedies[0].title === 'Install Pandoc to save as OpenDocument, Rich Text, LaTeX and more', 'remedy title: ' + d.remedies[0].title);
    A2(/File → Options → Features/.test(d.remedies[0].text) && d.remedies[0].actions[0].id === 'install-feature', 'points to Features with an Install button: ' + d.remedies[0].text);
    const s = summary(fake);
    A2(/^Install Pandoc to save as OpenDocument/.test(s) && /Everything else works/.test(s), 'summary leads with the fix: ' + s);
    A2(!BAD_WORDS.test(s + d.lead + d.title + d.fix) && !/missing from this copy|Off for now/.test(s + d.lead + d.title), 'US English, plain, no old wording');
    const gone = remedy('pandoc', { ...fake, reason: 'missing-during-use', failedTool: 'pandoc' });
    A2(/moved or deleted while Markooj was running/.test(gone.text) && /^To save as/.test(gone.text), 'runtime loss: ' + gone.text);
    // the dialog: three rows, the fix with its buttons, the details folded away
    const p = showDetails(fake);
    await sleep(350);
    const dlg = topDialog();
    A2(dlg && dlg.querySelector('.mk-health') && dlg.querySelectorAll('.mk-health-t tr').length === 3, 'dialog lists 3 tools');
    A2(dlg.querySelector('h3').textContent === 'Almost everything is ready', 'dialog title');
    A2(/Install Pandoc/.test(dlg.textContent) && [...dlg.querySelectorAll('.mk-health-acts button')].some(b => b.textContent === 'Install Pandoc') && [...dlg.querySelectorAll('.mk-health-acts button')].some(b => b.textContent === 'Get Pandoc'), 'row has its buttons');
    A2(dlg.querySelector('details.mk-health-more') && !dlg.querySelector('details.mk-health-more').open, 'technical details folded away');
    A2([...dlg.querySelectorAll('.dlg-foot button')].some(b => b.textContent === 'Check again'), 'Check again in the footer');
    try { await mk.invoke('smoke-shot', 'tools-health'); } catch {}
    [...dlg.querySelectorAll('.dlg-foot button')].find(b => b.textContent === 'OK').click();
    A2((await p) === true, 'OK closes');
    // the same dialog when everything works
    const p2 = showDetails(ok);
    await sleep(350);
    const dlg2 = topDialog();
    A2(dlg2.querySelector('h3').textContent === 'Your tools are ready' && /Ready · included with Markooj/.test(dlg2.textContent) && !dlg2.querySelector('.mk-health-acts'), 'all-ready dialog');
    await closeDialog('OK'); await p2;
  });

  app.tests.register('health: optional tools stay quiet at startup; help comes when the feature is tried', async () => {
    const keep = await check();
    const keepTried = app.settings.get('toolsTried', []), keepUse = app.settings.get('toolUse', {});
    const fake = { ok: false, missing: ['ddjvu'], platform: 'win32', packaged: true, tools: { ...(keep.tools || {}), ddjvu: { id: 'ddjvu', ok: false, state: 'missing', path: null, error: 'not found' } } };
    try {
      app.settings.set('toolsTried', []); app.settings.set('toolUse', {});
      document.querySelectorAll('.toast').forEach(t => t.remove());
      notifiedKey = '';
      // never tried: no toast, no status button
      notify(fake);
      await sleep(80);
      A2(![...document.querySelectorAll('.toast')].some(t => /DjVu/.test(t.textContent)), 'no toast for a DjVu tool nobody used');
      last = fake; app.status.refresh(); await sleep(60);
      A2(!document.querySelector('.mk-health-sb'), 'no status button for an untried tool');
      // the user tries it: a solution-first dialog with the right buttons
      const p = offer('ddjvu', { result: fake });
      await sleep(350);
      const dlg = topDialog();
      A2(dlg && /^Install DjVu tools to open DjVu files$/.test(dlg.querySelector('h3').textContent), 'dialog title leads with the fix: ' + (dlg && dlg.querySelector('h3').textContent));
      const labels = [...dlg.querySelectorAll('.dlg-foot button')].map(b => b.textContent);
      A2(labels.includes('Install DjVu tools') && labels.includes('Get DjVuLibre') && labels.includes('Check again'), 'buttons: ' + labels);
      A2(/File → Options → Features/.test(dlg.textContent), 'says where to install it');
      A2(/To open DjVu files, Markooj needs the free DjVuLibre tools/.test(dlg.textContent) && /Everything else works/.test(dlg.textContent), 'says what to do and what still works');
      try { await mk.invoke('smoke-shot', 'tools-offer'); } catch {}
      await closeDialog(labels.includes('Not now') ? 'Not now' : 'Close');
      await p;
      A2(tried('ddjvu'), 'trying the feature is remembered');
      // now the status bar may point at it
      app.status.refresh(); await sleep(60);
      A2(document.querySelector('.mk-health-sb'), 'status button once the user relies on the tool');
      // Pandoc used often and gone: one solution-first toast at startup
      noteUse('pandoc'); noteUse('pandoc'); noteUse('pandoc');
      notifiedKey = '';
      notify({ ...fake, missing: ['pandoc'], tools: { ...fake.tools, pandoc: { id: 'pandoc', ok: false, state: 'missing', path: null } } }, ['pandoc']);
      await sleep(80);
      const t = [...document.querySelectorAll('.toast')].find(x => /Pandoc|OpenDocument/.test(x.textContent));
      A2(t && /^Install Pandoc to save as OpenDocument/.test(t.querySelector('.tmsg').textContent) && /How to fix/.test(t.textContent), 'Pandoc toast: ' + (t && t.textContent));
    } finally {
      app.settings.set('toolsTried', keepTried); app.settings.set('toolUse', keepUse);
      document.querySelectorAll('.toast').forEach(x => x.remove());
      notifiedKey = '';
      last = keep; app.status.refresh(); await sleep(50);
    }
    if (!keep || keep.ok) A2(!document.querySelector('.mk-health-sb'), 'status bar button hides again');
  });

  app.tests.register('health: nothing about tools is shown at startup', async () => {
    // wait for the quiet startup check (about 1.2 s after ready), then look at every toast shown outside a test
    const r = await Promise.race([startupP, sleep(20000).then(() => 'timeout')]);
    A2(r !== 'timeout', 'the startup check ran');
    await sleep(150);
    const TOOLS_RE = /DjVu|Pandoc|pdf2djvu|bundled tool|Check Tools/i;
    const atStart = (app.ui.toastLog || []).filter(t => !t.test && t.at <= startupAt + 1500 && TOOLS_RE.test(t.msg));
    A2(!atStart.length, 'no tools toast at startup: ' + JSON.stringify(atStart.map(t => t.msg)));
    if (r && r.ok) A2(!document.querySelector('.mk-health-sb'), 'no Tools button in the status bar');
    // the verdict, for the packaged check of the official DjVuLibre build (smoke.json shows this message on failure only)
    if (r && r.bundleExpected) A2(r.ok, 'bundled tools ready at startup: ' + JSON.stringify((r.missing || []).map(id => [id, r.tools[id].state, r.tools[id].error, r.tools[id].path])));
  });

  app.tests.register('health: errors from main carry their buttons and technical details', async () => {
    let err = null;
    try { await mk.invoke('errors-probe-throw'); } catch (e) { err = e; }
    A2(err && plainError(err) === 'Try again. This is a test message.', 'plain message without the marker: ' + (err && err.message));
    const info = mk.errorInfo(err);
    A2(info && info.code === 'TEST' && info.details === 'raw test details' && info.actions.some(a => a.id === 'retry'), 'errorInfo: ' + JSON.stringify(info));
    let retried = 0;
    const acts = errorActions(err, { retry: () => { retried++; } });
    A2(acts.length === 1 && acts[0].label === 'Try again', 'toast buttons: ' + acts.map(a => a.label));
    await acts[0].run();
    A2(retried === 1, 'Try again runs the caller’s retry');
    A2(!errorActions(err).length, 'no Try again without a retry');
    // file-system errors: the fix first, the right one for the cause
    const rows = await mk.invoke('errors-probe', ['EBUSY', 'EPERM', 'ENOENT', 'ENOSPC']);
    const by = Object.fromEntries(rows.map(r => [r.code, r]));
    A2(/^Close the file in the other program/.test(by.EBUSY['save the file'].message) && by.EBUSY['save the file'].actions.some(a => a.id === 'save-as'), 'busy: ' + by.EBUSY['save the file'].message);
    A2(/^Save to another folder/.test(by.EPERM['save the file'].message), 'no permission: ' + by.EPERM['save the file'].message);
    A2(/^Choose the file again/.test(by.ENOENT['open the file'].message) && by.ENOENT['open the file'].actions.some(a => a.id === 'open-file'), 'gone on open');
    A2(/^Free some space/.test(by.ENOSPC['save the file'].message) && /Your text is still open/.test(by.ENOSPC['save the file'].message), 'disk full');
    for (const r of rows) for (const k of ['save the file', 'open the file']) {
      A2(!/^E[A-Z]+/.test(r[k].message) && !BAD_WORDS.test(r[k].message) && LEADS.test(r[k].message), `${r.code} ${k}: ${r[k].message}`);
      A2(r[k].details.includes(r.code), `${r.code}: raw code kept for the details`);
    }
  });

  app.tests.register('health: a tool that vanishes while running is reported plainly and checked again', async () => {
    let event = null;
    const off = mk.on('tools-health', r => { event = r; });
    try {
      const r = await mk.invoke('tools-simulate-gone');
      A2(r.threw && r.code === 'TOOL_GONE' && r.tool === 'pandoc', 'fails with TOOL_GONE: ' + JSON.stringify(r));
      A2(/^To save as OpenDocument, Rich Text, LaTeX and more again, put Pandoc back\./.test(r.message) && /moved or deleted while Markooj was running/.test(r.message), 'plain message: ' + r.message);
      A2(r.actions.some(a => a.id === 'check-tools') && r.details, 'buttons and details: ' + JSON.stringify(r.actions));
      for (let i = 0; i < 100 && !event; i++) await sleep(100);
      A2(event && event.reason === 'missing-during-use' && event.failedTool === 'pandoc', 'main re-checked and told the window: ' + JSON.stringify(event && { reason: event.reason, failedTool: event.failedTool }));
      A2(Array.isArray(event.missing), 'the re-check carries the fresh result');
      A2(last === event || last.checkedAt === event.checkedAt, 'app.health took the fresh result');
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
    A2(!c.none.active && !c.none.dataExists, 'no marker, no data folder: normal profile');
    A2(c.marker.active && c.marker.reason === 'portable.txt' && c.marker.dataExists && c.marker.dir === c.marker.expectDir, 'portable.txt: data folder created and used ' + JSON.stringify(c.marker));
    A2(c.dataFolder.active && c.dataFolder.reason === 'data folder' && c.dataFolder.dir === c.dataFolder.expectDir, 'existing data folder is used');
    A2(!c.dataIsFile.active, 'a file named data alone is not portable mode');
    A2(!c.markerButDataIsFile.active && /^To keep settings next to Markooj, move/.test(c.markerButDataIsFile.error || '') && !/Cannot write/.test(c.markerButDataIsFile.error) && /Cannot write/.test(c.markerButDataIsFile.details || ''), 'portable.txt but data cannot be a folder: falls back with a message that says what to do: ' + c.markerButDataIsFile.error);
    const info = await mk.invoke('app-info');
    A2(info.userDataFrom === 'smoke' && info.portable === false, 'smoke runs keep their own profile: ' + info.userDataFrom);
    A2(info.portableInfo && 'active' in info.portableInfo, 'app-info reports portable state');
    if (r.live.packaged && r.live.portable.active) A2(r.live.portable.dir.toLowerCase().startsWith(String(r.live.programDir).toLowerCase()), 'live portable folder sits next to the program');
  });

  app.tests.register('health: About facts come from package.json', async () => {
    const info = await mk.invoke('app-info');
    A2(/^\d+\.\d+\.\d+/.test(info.version), 'version ' + info.version);
    A2(/Ahmed Bilal/.test(info.author || '') && /Copyright © 2026 Ahmed Bilal and contributors/.test(info.copyright || ''), 'author and copyright: ' + info.author + ' / ' + info.copyright);
    // the homepage is the project on GitHub or its website (datakeen.github.io/markooj)
    A2(/^https:\/\/(?:github\.com\/datakeen\/markooj|datakeen\.github\.io\/markooj\/?)$/i.test(info.homepage || '') && /github\.com\/datakeen\/markooj\/issues/i.test(info.bugs || ''), 'project links');
    A2(info.license === 'AGPL-3.0-or-later', 'license: ' + info.license);
    const lic = await mk.invoke('read-text', info.licenseFile);
    A2(/GNU AFFERO GENERAL PUBLIC LICENSE/.test(lic) && /Version 3, 19 November 2007/.test(lic), 'LICENSE (AGPL v3) readable at ' + info.licenseFile);
    const notes = await mk.invoke('read-text', info.noticesFile);
    A2(/Third-party notices/.test(notes) && /AGPL-3.0-or-later/.test(notes) && /Pandoc/.test(notes) && /Harper/.test(notes) && /datakeen\/markooj/i.test(notes), 'notices readable and complete');
    // the license texts are read from where the app keeps them (resources/licenses in a packaged copy, licenses/ here)
    A2(info.licensesDir, 'app-info names the licenses folder');
    const harper = await mk.invoke('read-text', info.licensesDir + (mk.platform === 'win32' ? '\\' : '/') + 'harper-LICENSE.txt');
    A2(/Apache License/.test(harper || ''), 'licenses folder readable: ' + info.licensesDir);
  });
})();
