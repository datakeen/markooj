// Markooj — smoke tests for interface translations (prefix 'i18n:'). Run alone with:
//   npx electron . --smoke <outDir> --smoke-only "^i18n:"
// Writes <outDir>/i18n-untranslated.json (visible interface text that did not go through app.t while the pseudo-locale
// was on) and the screenshots i18n-en, i18n-qps, i18n-qps-options, i18n-rtl-ur, i18n-ur-fonts.
(function () {
  'use strict';
  const app = window.app;
  if (!app || !app.i18n || !app.tests) return;
  const A = app.assert, C = app.i18n.core, mk = window.mk || {};
  const I = app.i18n;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const shot = async name => { try { await mk.invoke('smoke-shot', name); } catch {} };
  /** Run fn with the interface in `code`, then go back to the setting there was before. */
  async function withLanguage(code, fn) {
    const keep = I.setting();
    try { A(await I.setLanguage(code, { quiet: true }) === true, 'switched to ' + code); return await fn(); }
    finally { await I.setLanguage(keep, { quiet: true }); }
  }
  const esc = el => el && el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  const EN = { '{count} files': { one: '{count} file', other: '{count} files' }, Save: 'Save', 'Saved {name}': 'Saved {name}' };

  app.tests.register('i18n: t() looks up, falls back to English and strips context markers', () => {
    const tr = C.createTranslator({ code: 'fr', plural: 'fr', en: EN, entries: { Save: 'Enregistrer', 'Open@@verb': 'Ouvrir', Empty: '', '@notes': { Save: 'x' } } });
    A(tr.t('Save') === 'Enregistrer', 'translated: ' + tr.t('Save'));
    A(tr.t('Not in any catalog') === 'Not in any catalog', 'missing → English');
    A(tr.t('Open@@verb') === 'Ouvrir' && tr.t('Open@@adjective') === 'Open', 'context marker: ' + tr.t('Open@@adjective'));
    A(tr.t('Empty') === 'Empty' && tr.missing().includes('Empty'), 'empty → English, reported as missing');
    A(!tr.has('@notes') && tr.t('@notes') === '@notes', '@ keys are notes, not strings');
    A(app.t('Edit@@menu') === 'Edit' && app.t(null) === '' && app.tm('Bold') === 'Bold', 'app.t / app.tm in English');
    // every language's catalogs load through main, synchronously
    for (const L of I.languages({ all: true })) {
      const p = mk.i18n.catalog(L.code);
      A(p && !p.error && p.language === L.code && typeof p.entries === 'object', 'catalog for ' + L.code + ': ' + JSON.stringify(p && p.error));
    }
    A(I.languages().length === 11 && !I.languages().some(l => l.code === C.PSEUDO), 'eleven languages; the test language is hidden: ' + I.languages().map(l => l.code));
    A(I.languages({ all: true }).some(l => l.code === C.PSEUDO), 'qps exists for developers');
    const t0 = performance.now(); for (let i = 0; i < 100000; i++) app.t('Interface language'); const ms = performance.now() - t0;
    A(ms < 400, `100,000 lookups took ${Math.round(ms)} ms`);
  });

  app.tests.register('i18n: placeholders fill by name and never by position', () => {
    A(app.t('Saved {name}', { name: 'a.md' }) === 'Saved a.md', app.t('Saved {name}', { name: 'a.md' }));
    A(app.t('Keep {unknown} and {#eq:x}', { name: 1 }) === 'Keep {unknown} and {#eq:x}', 'unknown names and Markdown braces stay');
    A(app.th('Open {name}', { name: '<b>&' }) === 'Open &lt;b&gt;&amp;', 'th escapes the values: ' + app.th('Open {name}', { name: '<b>&' }));
    const tr = C.createTranslator({ code: 'ur', plural: 'ur', intl: 'ur-PK', en: EN, entries: { 'Saved {name}': '{name} محفوظ ہو گئی' } });
    A(tr.t('Saved {name}', { name: 'a.md' }) === 'a.md محفوظ ہو گئی', 'a translation may move the placeholder');
    A(app.tn('{count} files', 12345) === '12,345 files', 'count gets digit grouping: ' + app.tn('{count} files', 12345));
    const fr = C.createTranslator({ code: 'fr', plural: 'fr', intl: 'fr-FR', en: EN, entries: {} });
    A(/^12\s345 files$/u.test(fr.tn('{count} files', 12345)), 'French grouping, English text: ' + fr.tn('{count} files', 12345));
    A(String(C.placeholders('{a} and {b} and {a} {#x}')) === 'a,b', 'placeholders()');
  });

  app.tests.register('i18n: plural forms follow each language (Arabic six, Japanese and Chinese one, French 0 is one)', () => {
    const ar = C.createTranslator({ code: 'ar', plural: 'ar', en: EN, entries: { '{count} files': { zero: 'Z{count}', one: 'O', two: 'T', few: 'F{count}', many: 'M{count}', other: 'X{count}' } } });
    for (const [n, want] of [[0, 'Z0'], [1, 'O'], [2, 'T'], [3, 'F3'], [10, 'F10'], [11, 'M11'], [99, 'M99'], [100, 'X100'], [102, 'X102'], [103, 'F103']]) A(ar.tn('{count} files', n) === want, `ar ${n}: ${ar.tn('{count} files', n)} (want ${want})`);
    A(String(C.pluralCategories('ar')) === 'zero,one,two,few,many,other', 'ar categories: ' + C.pluralCategories('ar'));
    for (const code of ['ja', 'zh-CN']) {
      A(String(C.pluralCategories(code === 'zh-CN' ? 'zh' : code)) === 'other', code + ' has one form');
      const tr = C.createTranslator({ code, plural: code === 'zh-CN' ? 'zh' : code, en: EN, entries: { '{count} files': { other: '{count} 件' } } });
      A(tr.tn('{count} files', 1) === '1 件' && tr.tn('{count} files', 5) === '5 件', code + ': ' + tr.tn('{count} files', 1));
    }
    const fr = C.createTranslator({ code: 'fr', plural: 'fr', en: EN, entries: { '{count} files': { one: '{count} fichier', other: '{count} fichiers' } } });
    A(fr.tn('{count} files', 0) === '0 fichier' && fr.tn('{count} files', 1) === '1 fichier' && fr.tn('{count} files', 2) === '2 fichiers', 'fr: 0 → one: ' + fr.tn('{count} files', 0));
    const en = C.createTranslator({ code: 'en', en: EN });
    A(en.tn('{count} files', 0) === '0 files' && en.tn('{count} files', 1) === '1 file', 'en: 0 → other: ' + en.tn('{count} files', 0));
    const gap = C.createTranslator({ code: 'ar', plural: 'ar', en: EN, entries: { '{count} files': { one: 'O', other: 'X{count}' } } });
    A(gap.tn('{count} files', 2) === 'X2', 'a missing category falls back to other');
    const none = C.createTranslator({ code: 'sv', plural: 'sv', en: EN, entries: {} });
    A(none.tn('{count} files', 1) === '1 file', 'untranslated plural → English with English rules');
    A(app.t('{count} files', { count: 1 }) === app.tn('{count} files', 1), 'tn(text, n) = t(text, {count: n})');
  });

  app.tests.register('i18n: context markers', async () => {
    A(JSON.stringify(C.parseKey('Open@@verb')) === '{"text":"Open","context":"verb"}', 'parse');
    A(C.stripContext('Insert@@ribbon tab') === 'Insert', 'words with spaces');
    A(C.parseKey('Mail @@Team').context === '' && C.parseKey('a@@B').text === 'a@@B', 'only lower-case words at the end are a context');
    A(await mk.invoke('i18n-t', 'Edit@@menu') === 'Edit', 'main strips the marker too');
  });

  app.tests.register('i18n: setLanguage persists, switches dir and lang, and draws the language chip', async () => {
    const de = document.documentElement;
    let seen = null; const off = I.onChange(p => { seen = p; });
    try {
      await withLanguage('ur', async () => {
        A(de.getAttribute('dir') === 'rtl' && de.getAttribute('lang') === 'ur', `html dir/lang: ${de.dir} ${de.lang}`);
        A(de.classList.contains('mk-ui-rtl') && de.classList.contains('mk-ui-lang-ur') && de.classList.contains('mk-ui-font-naskh-nastaliq'), 'hook classes: ' + de.className);
        A(I.isRtl() && I.dir() === 'rtl' && I.language() === 'ur', 'api');
        A(seen && seen.language === 'ur' && seen.rtl === true, 'onChange: ' + JSON.stringify(seen));
        A(app.settings.get('uiLanguage', '') === 'ur', 'setting in the window');
        const s = await mk.invoke('settings-get'); A(s.uiLanguage === 'ur', 'setting saved by main: ' + s.uiLanguage);
        const info = await mk.invoke('i18n-info'); A(info.language === 'ur' && info.dir === 'rtl', 'main knows: ' + JSON.stringify(info.language));
        const chip = document.querySelector('[data-status-id="ui-language"] .mk-i18n-chip');
        A(chip && chip.textContent.includes('اردو'), 'chip shows the native name: ' + (chip && chip.textContent));
        A(getComputedStyle(document.getElementById('editorHost')).direction === 'ltr', 'the document area keeps its own direction');
        app.shell?.selectTab?.('home');
        await sleep(500); await shot('i18n-rtl-ur');
      });
      A(de.getAttribute('dir') === 'ltr' && de.getAttribute('lang') === 'en' && !de.classList.contains('mk-ui-rtl'), 'back to English: ' + de.dir);
      A((await mk.invoke('settings-get')).uiLanguage == null || (await mk.invoke('settings-get')).uiLanguage === '', 'setting cleared again');
      const before = app.ui.toastLog?.length || 0;
      A(await I.setLanguage('xx-YY', { quiet: true }) === false && I.language() === 'en', 'an unknown code is refused');
      const last = (app.ui.toastLog || [])[before];
      if (last) A(/^Choose a language/.test(last.msg) && (last.actions || []).length, 'refusal leads with the remedy and offers a button');
      await sleep(100); document.querySelectorAll('#toastLayer .tx').forEach(b => b.click()); // keep later screenshots clear
    } finally { off(); }
  });

  app.tests.register('i18n: catalogs are ready before the first paint (no English flash)', () => {
    const st = I.state;
    A(st.booted && st.bootSync, 'catalogs arrived synchronously from main');
    A(st.attachedAt != null && st.bootAt <= st.attachedAt, 'before core.js');
    A(st.langAtAttach === (st.bootLanguage === C.PSEUDO ? 'en' : st.bootLanguage), `<html lang> was set before any module ran: ${st.langAtAttach} / ${st.bootLanguage}`);
    const fp = performance.getEntriesByName('first-paint')[0] || performance.getEntriesByName('first-contentful-paint')[0];
    if (fp) A(st.bootAt <= fp.startTime, `boot ${Math.round(st.bootAt)} ms, first paint ${Math.round(fp.startTime)} ms`);
    const src = [...document.scripts].map(s => s.getAttribute('src'));
    A(src[0] === 'i18n-core.js' && src[1] === 'i18n.js', 'the translation scripts load first: ' + src.slice(0, 3));
    A(typeof window.mkI18n.t === 'function' && window.mkI18n.t('Undo') === app.t('Undo'), 'window.mkI18n.t works before core.js');
  });

  app.tests.register('i18n: data-i18n attributes follow the language', async () => {
    const box = document.createElement('div');
    box.innerHTML = '<b data-i18n="Interface language">Interface language</b><button data-i18n-title="Undo" data-i18n-aria-label="Undo" data-i18n-tip="Undo"></button><i data-i18n-vars=\'{"language":"X"}\' data-i18n="Interface language: {language}"></i>';
    document.body.append(box);
    try {
      await withLanguage('qps', () => {
        A(C.looksPseudo(box.querySelector('b').textContent), 'text: ' + box.querySelector('b').textContent);
        const b = box.querySelector('button');
        A(C.looksPseudo(b.title) && C.looksPseudo(b.getAttribute('aria-label')) && C.looksPseudo(b.dataset.tip), 'attributes');
        A(/X/.test(box.querySelector('i').textContent) && C.looksPseudo(box.querySelector('i').textContent), 'vars: ' + box.querySelector('i').textContent);
        A(C.looksPseudo(document.querySelector('#focusExit [data-i18n]').textContent), 'index.html static text');
      });
      A(box.querySelector('b').textContent === 'Interface language' && box.querySelector('button').title === 'Undo', 'English again');
      A(box.querySelector('i').textContent === 'Interface language: X', box.querySelector('i').textContent);
    } finally { box.remove(); }
  });

  app.tests.register('i18n: the pickers (status bar, menu, Options row, palette command, Welcome step)', async () => {
    A(document.querySelector('[data-status-id="ui-language"] .mk-i18n-chip svg use[href="#mk-ui-lang"]'), 'chip with its own icon (not the document-language globe)');
    const items = I.menuItems();
    const langs = items.filter(i => i.run && i.preview);
    A(langs.length === 11 && langs.some(i => i.checked), 'menu lists eleven languages and marks the current one');
    A(langs.some(i => /简体中文/.test(i.label)) && langs.some(i => /العربية/.test(i.label)) && langs.some(i => /Português/.test(i.label)), 'native names');
    const c = app.commands.get('i18n.pick');
    A(c && c.description && c.label === 'Change interface language', 'palette command');
    const m = I.openMenu(document.querySelector('.mk-i18n-chip'));
    await sleep(150);
    A(document.querySelector('.mk-i18n-menu, .menu.mk-i18n-menu'), 'menu opens');
    await shot('i18n-menu');
    esc(document.activeElement); try { m?.close?.(); } catch {}
    app.backstage.open('options');
    await sleep(350);
    const lead = document.querySelector('.opt-lead[data-lead="ui-language"]');
    A(lead && lead.nextElementSibling && lead.nextElementSibling.matches('.opt-card[data-section="language"]'), 'Interface language is the first row of Options → Language');
    const sel = lead.querySelector('select');
    A(sel && sel.options.length === 12 && sel.value === '', 'match-system plus eleven languages: ' + (sel && sel.options.length));
    lead.scrollIntoView({ block: 'center' }); await sleep(250); await shot('i18n-options');
    app.backstage.close(); await sleep(300);
    const fake = document.createElement('div'); fake.innerHTML = '<div class="mkwel-body"><p>x</p></div>';
    const sec = I.welcomeStep(fake);
    A(sec && fake.querySelector('.mkwel-body').firstElementChild === sec && sec.querySelector('select'), 'Welcome: the language comes first');
    if (app.welcome?.open) {
      const done = app.welcome.open('welcome', { markSeen: false });
      try {
        await sleep(700);
        const real = document.querySelector('.mkwel-sheet .mk-i18n-wel');
        A(real && real.parentElement.firstElementChild === real, 'the real Welcome sheet starts with the language picker');
        await shot('i18n-welcome');
      } finally { app.welcome.close('x'); await Promise.race([done, sleep(800)]); }
    }
  });

  app.tests.register('i18n: main-process t() and the system language match', async () => {
    A(await mk.invoke('i18n-t', 'Copy') === 'Copy', 'English');
    A(await mk.invoke('i18n-t', 'Saved {name}', { name: 'x.md' }) === 'Saved x.md', 'placeholders');
    await withLanguage('qps', async () => {
      const s = await mk.invoke('i18n-t', 'Copy');
      A(C.looksPseudo(s) && s.includes('Çöþý'), 'main follows the window: ' + s);
    });
    A(await mk.invoke('i18n-t', 'Copy') === 'Copy', 'English again');
    const tags = ['zh-Hans-CN', 'zh-TW', 'pt-PT', 'ur-PK', 'ur-Latn', 'pa-Arab-PK', 'pa-IN', 'ar-SA', 'de-DE', 'en-GB', 'sv-SE', 'fr-CA', 'es-MX', 'ja-JP', 'pnb'];
    const want = ['zh-CN', null, 'pt-BR', 'ur', 'ur-Latn', 'pnb', null, 'ar', null, 'en', 'sv', 'fr', 'es', 'ja', 'pnb'];
    const got = await mk.invoke('i18n-match', tags);
    A(JSON.stringify(got) === JSON.stringify(want), 'match: ' + JSON.stringify(got));
  });

  app.tests.register('i18n: Urdu interface fonts (screenshot)', async () => {
    await withLanguage('ur', async () => {
      const box = document.createElement('div');
      box.className = 'mk-i18n-fonttest';
      box.setAttribute('dir', 'rtl'); box.setAttribute('lang', 'ur');
      box.style.cssText = 'position:fixed;inset:120px 80px auto auto;z-index:99;background:var(--surface);color:var(--text);padding:16px 20px;border-radius:12px;box-shadow:var(--pop-shadow);width:520px;font-family:var(--font)';
      const row = (font, size, text) => `<div style="display:flex;gap:12px;align-items:center;border-bottom:.5px solid var(--line);padding:4px 0"><span style="font:${size}px/${font.includes('Nastaliq') ? 2 : 1.5} ${font}">${text}</span><small dir="ltr" style="margin-inline-start:auto;color:var(--text-3)">${font.split(',')[0].replace(/'/g, '')} ${size}px</small></div>`;
      const sample = 'فائل محفوظ کریں · ترتیبات · ہجے کی جانچ · نیا دستاویز';
      box.innerHTML = row("'Noto Naskh Arabic'", 12, sample) + row("'Noto Naskh Arabic'", 13, sample) + row("'Noto Nastaliq Urdu'", 12, sample) + row("'Noto Nastaliq Urdu'", 13, sample) + row("'Noto Nastaliq Urdu'", 20, 'اختیارات') + row('var(--font)', 12, 'Interface font: ' + sample)
        // a ribbon-sized button (22 px high, as in the status bar and ribbon rows): Nastaliq is cut off, Naskh fits
        + ['Noto Naskh Arabic', 'Noto Nastaliq Urdu'].map(f => `<div style="display:flex;gap:12px;align-items:center;padding:6px 0"><span style="display:inline-flex;align-items:center;height:22px;overflow:hidden;padding:0 8px;border:.5px solid var(--line-2);border-radius:5px;font:12px/1.2 '${f}'">${sample}</span><small dir="ltr" style="margin-inline-start:auto;color:var(--text-3)">${f} in a 22 px button</small></div>`).join('');
      document.body.append(box);
      try {
        // bundled fonts load on first use: ask for both before the screenshot
        await Promise.all(['400 13px "Noto Nastaliq Urdu"', '400 13px "Noto Naskh Arabic"'].map(f => document.fonts.load(f, 'اردو').catch(() => null)));
        await document.fonts.ready; await sleep(400);
        A(document.fonts.check('13px "Noto Nastaliq Urdu"', 'اردو') && document.fonts.check('13px "Noto Naskh Arabic"', 'اردو'), 'both bundled fonts load');
        // ink height of the same words (the line box itself comes from the Latin font: the bundled faces leave out the space)
        const ctx = document.createElement('canvas').getContext('2d');
        const ink = f => { ctx.font = f; const m = ctx.measureText('فائل محفوظ کریں ہجے کی جانچ'); return m.actualBoundingBoxAscent + m.actualBoundingBoxDescent; };
        const naskh = ink('13px "Noto Naskh Arabic"'), nast = ink('13px "Noto Nastaliq Urdu"');
        console.log(`[i18n] ink height at 13 px: Naskh ${naskh.toFixed(1)} px, Nastaliq ${nast.toFixed(1)} px`);
        A(nast > naskh * 1.25, `Nastaliq needs much more line height (${nast.toFixed(1)} vs ${naskh.toFixed(1)} px), so the interface uses Naskh`);
        A(getComputedStyle(document.documentElement).getPropertyValue('--font').includes('Noto Naskh Arabic'), 'Urdu interface font is Naskh');
        await shot('i18n-ur-fonts');
      } finally { box.remove(); }
    });
  });

  app.tests.register('i18n: pseudo-locale coverage scan (lists text that skips app.t)', async () => {
    const found = new Map();
    const collect = list => { for (const x of list) { const k = x.kind + '\u0001' + x.text; if (!found.has(k)) found.set(k, x); else found.get(k).n += x.n; } };
    app.shell?.selectTab?.('home'); await sleep(300); await shot('i18n-en');
    await withLanguage('qps', async () => {
      const tabs = app.ribbon.tabs().filter(t => t.groups.length && !t.contextual).map(t => t.id);
      for (const id of tabs) { try { app.shell.selectTab(id); } catch {} await sleep(80); collect(I.scanUntranslated(document.body)); }
      app.shell?.selectTab?.('home'); await sleep(300);
      await shot('i18n-qps');
      app.backstage.open('options'); await sleep(500);
      collect(I.scanUntranslated(document.getElementById('backstage')));
      document.querySelector('.opt-lead[data-lead="ui-language"]')?.scrollIntoView({ block: 'center' }); await sleep(200);
      await shot('i18n-qps-options');
      app.backstage.close(); await sleep(400);
      try { app.shell.openPalette(''); await sleep(300); const p = document.querySelector('.palette'); if (p) collect(I.scanUntranslated(p)); } finally { app.shell.closePalette?.(); }
      await sleep(200);
      const m = I.openMenu(); await sleep(200); collect(I.scanUntranslated(document.body)); esc(document.activeElement); try { m?.close?.(); } catch {}
      const run = app.commands.get('review.wordCount') ? app.commands.run('review.wordCount') : app.ui.dialog({ title: app.t('Interface language'), body: app.th('Interface language: {language}', { language: 'x' }) });
      await sleep(500);
      const dlg = [...document.querySelectorAll('.dlg')].pop();
      if (dlg) { collect(I.scanUntranslated(dlg)); esc(dlg); }
      await Promise.race([run, sleep(1500)]);
    });
    const items = [...found.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.text.localeCompare(b.text));
    const threshold = I.scanThreshold;
    const out = { at: new Date().toISOString(), count: items.length, threshold, byKind: items.reduce((o, x) => { o[x.kind] = (o[x.kind] || 0) + 1; return o; }, {}), items };
    try { await mk.invoke('i18n-smoke-write', 'i18n-untranslated', out); } catch {}
    console.log(`[i18n] ${items.length} visible interface strings are not translated yet (threshold ${threshold}); list in i18n-untranslated.json`);
    A(items.length <= threshold, `${items.length} untranslated strings (threshold ${threshold}); first: ${items.slice(0, 5).map(x => x.text).join(' | ')}`);
    A(I.language() === 'en', 'back to English');
  });
})();
