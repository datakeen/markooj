// Markooj — smoke tests for the round 3 review fixes (see ARCHITECTURE.md "Round 3 review fixes").
// Each test names the finding it guards. Tests only; no features live here.
(function () {
  'use strict';
  const app = window.app, mk = window.mk;
  if (!app || !app.tests) return;
  const T = (name, fn) => app.tests.register('review3: ' + name, fn);
  const A = app.assert;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = fn(); if (v) return v; } catch {} await sleep(40); } return null; };
  const E = () => app.editor || {};
  const W = () => app.writing || {};
  const R = () => window.MkWritingRules;
  const key = (el, k, o = {}) => { const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }); el.dispatchEvent(ev); return ev; };
  const caretIn = (el, end) => { const r = document.createRange(); r.selectNodeContents(el); r.collapse(!end); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  async function withEditor(make, src, ready, fn) {
    const e = E(); if (!e[make] || !e.fakeDoc || !e._offscreen) return;
    const host = e._offscreen(); const ed = e[make](); const d = e.fakeDoc(src);
    try {
      ed.mount(host, d);
      await until(() => ed.page && ready(ed.page), 6000); await sleep(80);
      e.testTarget = ed;
      return await fn(ed, d, host);
    } finally { e.testTarget = null; try { ed.unmount(); } catch {} host.remove(); }
  }

  // ---------------------------------------------------------------- shell, help, keys
  T('a profile with no saved ribbon tab opens on Home', () => {
    const b = app.shell?.bootTab?.();
    A(b, 'boot tab recorded');
    if (b && !b.saved) A(b.tab === 'home', 'fresh profile starts on ' + b.tab);
  });

  T('About: license links open the viewer on top, the warranty line, and F1 after a license goes to Help home', async () => {
    const H = app.help; if (!H?.about) return;
    const p = H.about();
    const dlg = await until(() => document.querySelector('.dlg.mkh-about-wrap.show'));
    A(dlg, 'About open');
    A(/ABSOLUTELY NO WARRANTY/.test(dlg.textContent) && /share and change it under the terms of this license/.test(dlg.textContent), 'no-warranty notice in About');
    A(getComputedStyle(dlg.querySelector('.mkh-credits-list')).overflowY !== 'auto', 'credits list does not scroll inside the dialog');
    [...dlg.querySelectorAll('button')].find(b => b.textContent === 'View license').click();
    await p;
    const v = await until(() => H.viewer.open && H.viewer.el?.classList.contains('show') && /AFFERO/i.test(H.viewer.article.textContent) && H.viewer.el);
    A(v, 'license viewer shown');
    await until(() => !document.querySelector('.dlg.mkh-about-wrap'), 2000);
    A(!document.querySelector('.dlg.mkh-about-wrap'), 'About closed before the license opens');
    const r = v.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    A(hit && v.contains(hit), 'the viewer is on top: ' + (hit && hit.className));
    H.close(); await sleep(300);
    await app.commands.run('help.manual');
    await until(() => H.viewer.open && H.latestKey());
    A(H.latestKey() === 'docs/help/index.md', 'F1 after the license opens Help home, got ' + H.latestKey());
    H.close(); await sleep(300);
  });

  T('Help Tutorials page has a Start button for every tutorial', async () => {
    const H = app.help; if (!H?.open || !app.tours?.list) return;
    await H.open('tutorials');
    const n = await until(() => H.viewer.article.querySelectorAll('.mkh-starttour').length >= app.tours.list().length - 1 && H.viewer.article.querySelectorAll('.mkh-starttour').length);
    A(n >= app.tours.list().length - 1, `Start buttons: ${n} for ${app.tours.list().length} tours`);
    A(H.viewer.el.querySelector('.mkh-tours-btn'), 'Tutorials button in the Help viewer');
    H.close(); await sleep(300);
  });

  T('Word keys that work differently list the keys Markooj takes over', () => {
    if (typeof app.keys?.notes !== 'function') return;
    const keys = app.keys.notes().map(n => n.key);
    for (const k of ['Ctrl+Shift+C', 'Ctrl+Shift+E', 'Ctrl+Alt+C', 'Ctrl+Alt+R', 'Ctrl+Alt+P', 'Ctrl+Shift+P']) A(keys.includes(k), k + ' explained');
    A(!keys.includes('Ctrl+K'), 'Ctrl+K works like Word, so it is not in the list');
  });

  T('AltGr characters are typed, not taken as Ctrl+Alt shortcuts', async () => {
    await withEditor('createWord', 'Hello world here.', p => p.querySelector('p'), async (ed, d) => {
      const p = ed.page.querySelector('p'); ed.page.focus(); caretIn(p, true);
      for (const [code, k] of [['Digit2', '²'], ['Digit3', '³'], ['KeyM', 'µ'], ['Minus', '\\']]) {
        const ev = key(p, k, { code, ctrlKey: true, altKey: true, modifierAltGraph: true });
        A(!ev.defaultPrevented, `AltGr+${code} (${k}) is not swallowed`);
      }
      ed._commit?.();
      A(!/^#/.test(d.text), 'no heading made: ' + JSON.stringify(d.text));
      A(E().isAltGrChar({ getModifierState: m => m === 'AltGraph', key: '@' }) && !E().isAltGrChar({ getModifierState: () => false, key: '2' }), 'isAltGrChar');
    });
    const zoom = app.zoom;
    const ev = key(document.body, '\\', { code: 'Minus', ctrlKey: true, altKey: true, modifierAltGraph: true });
    A(!ev.defaultPrevented && app.zoom === zoom, 'the global shortcut layer lets AltGr+- type a backslash (zoom stays ' + app.zoom + ')');
  });

  T('Word mode: arrows in a right-to-left table move to the cell on that side', async () => {
    await withEditor('createWord', '---\nlang: ur\n---\n\n| نام | شہر |\n| --- | --- |\n| علی | لاہور |\n', p => p.querySelector('tbody td'), async (ed) => {
      const tds = ed.page.querySelectorAll('tbody td');
      await until(() => getComputedStyle(tds[1]).direction === 'rtl', 2000);
      A(getComputedStyle(tds[1]).direction === 'rtl', 'the table reads right to left');
      ed.page.focus(); caretIn(tds[1], false);
      const left = key(tds[1], 'ArrowLeft');
      A(!left.defaultPrevented, 'ArrowLeft at the start of an RTL cell moves inside the cell (forward), not to another cell');
      caretIn(tds[1], false);
      const right = key(tds[1], 'ArrowRight');
      const c = getSelection().anchorNode; const cell = (c && (c.nodeType === 1 ? c : c.parentElement))?.closest('td,th');
      A(right.defaultPrevented && cell === tds[0], 'ArrowRight at the start goes to the cell on the right (the previous one)');
    });
  });

  T('Inline mode: Left/Right at the edge of an Urdu block follow the text direction; the block keeps its script font', async () => {
    const src = '---\nlang: ur\n---\n\nپہلا پیراگراف ہے۔\n\nدوسرا پیراگراف یہاں ہے۔\n\nتیسرا پیراگراف۔';
    await withEditor('createInline', src, p => p.querySelectorAll('p').length >= 3, async (ed, d) => {
      const second = d.text.indexOf('دوسرا');
      await ed.setSelection(second, second); await ed.whenIdle();
      A(ed.openBlock && /دوسرا/.test(ed.openBlock.text), 'second block open');
      const el = ed.page.querySelector('.mk-il-edit');
      A(el && el.getAttribute('data-mk-script') === 'ur', 'the open block keeps the Urdu script font: ' + (el && el.getAttribute('data-mk-script')));
      const l = key(el, 'ArrowLeft'); await ed.whenIdle();
      A(!l.defaultPrevented && /دوسرا/.test(ed.openBlock?.text || ''), 'ArrowLeft at the start of an RTL block stays in the block');
      const r = key(el, 'ArrowRight'); await ed.whenIdle();
      A(r.defaultPrevented && /پہلا/.test(ed.openBlock?.text || ''), 'ArrowRight at the start goes to the previous block: ' + JSON.stringify(ed.openBlock?.text));
    });
  });

  // ---------------------------------------------------------------- right to left on the page and in exports
  async function renderInto(text) {
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-14000px;top:0;width:800px';
    const page = document.createElement('article'); page.className = 'mk-page'; host.append(page); document.body.append(host);
    const d = { id: 'review3-' + Math.random().toString(36).slice(2), text, kind: 'markdown', meta: {} };
    const r = await app.render(text, { doc: d }); page.innerHTML = r.html; await app.decorate(page, d);
    return { host, page };
  }
  T('a lang: ur document: every block is Urdu (Nastaliq), numbers and pictures follow the page, the title block keeps H1 in Nastaliq', async () => {
    if (!app.lang?.applyBlocks) return;
    const img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const { host, page } = await renderInto(`---\ntitle: اردو دستاویز\nlang: ur\n---\n\n# پہلا باب\n\n- ایک\n- دو\n\n| نام | شہر |\n| --- | --- |\n| علی | لاہور |\n\n2024\n\n![](${img})\n\nPython ایک زبان ہے۔\n`);
    try {
      const li = [...page.querySelectorAll('li')];
      A(li.length === 2 && li.every(x => x.getAttribute('data-mk-script') === 'ur'), 'list items are Urdu: ' + li.map(x => x.getAttribute('data-mk-script')).join(','));
      A([...page.querySelectorAll('td,th')].every(x => x.getAttribute('data-mk-script') === 'ur'), 'table cells are Urdu');
      const h1 = page.querySelector('h1');
      A(h1 && /Nastaliq/.test(getComputedStyle(h1).fontFamily), 'H1 after the title block uses Nastaliq: ' + (h1 && getComputedStyle(h1).fontFamily));
      const num = [...page.querySelectorAll('p')].find(p => p.textContent.trim() === '2024');
      A(num && getComputedStyle(num).direction === 'rtl', 'a paragraph of digits keeps the page direction');
      const pic = page.querySelector('img')?.closest('p,figure,div');
      A(pic && getComputedStyle(pic).direction === 'rtl', 'a picture paragraph keeps the page direction');
      A(app.lang.firstStrongDir('![Logo](x.png)') === null, 'a picture’s alt text sets no direction');
    } finally { host.remove(); }
  });

  T('direction buttons round-trip on a callout', () => {
    if (!app.lang?.setBlockDir) return;
    const src = '::: note\nAn English note.\n:::\n';
    const a = app.lang.setBlockDir(src, 1, 1, 'rtl');
    A(/^::: \{\.note dir="rtl"\}/.test(a.text), 'rtl: ' + JSON.stringify(a.text));
    const b = app.lang.setBlockDir(a.text, 1, 1, 'ltr');
    A(b.text === src, 'back to the original: ' + JSON.stringify(b.text));
  });

  T('DOCX and EPUB of an Urdu document read right to left', async () => {
    let tools = null; try { tools = await mk.invoke('tools'); } catch {}
    if (!tools?.pandoc || !app.exporter?.exportTo) return;
    const dir = await mk.invoke('recovery-dir');
    const d = app.docs.create({ title: 'RTL export', text: '---\ntitle: اردو دستاویز\nauthor: علی\nlang: ur\n---\n\nیہ ایک پیراگراف ہے۔\n\n| نام | عمر |\n| --- | --- |\n| علی | ۲۰ |\n' });
    try {
      const docx = dir + '/review3-rtl.docx', epub = dir + '/review3-rtl.epub';
      await app.exporter.exportTo('docx', d, docx);
      const x = await mk.invoke('smoke-zip-text', docx, 'word/document.xml');
      const st = await mk.invoke('smoke-zip-text', docx, 'word/styles.xml');
      A(/<w:bidiVisual\/>/.test(x), 'the table is mirrored (bidiVisual)');
      A(/w:bidi="ur-PK"/.test(st) && /w:cs="Noto Nastaliq Urdu"/.test(st), 'Urdu proofing language and complex-script font');
      A(/w:styleId="Title"[\s\S]*?<w:bidi\/>[\s\S]*?<\/w:style>/.test(st.match(/<w:style\b[^>]*w:styleId="Title"[\s\S]*?<\/w:style>/)?.[0] || ''), 'the Title style is right to left');
      await app.exporter.exportTo('epub', d, epub);
      const names = await mk.invoke('smoke-zip-text', epub, null);
      const opf = await mk.invoke('smoke-zip-text', epub, 'content\\.opf$');
      const ch = await mk.invoke('smoke-zip-text', epub, 'ch001\\.xhtml$');
      const css = await mk.invoke('smoke-zip-text', epub, '\\.css$');
      A(/page-progression-direction="rtl"/.test(opf || ''), 'EPUB pages turn right to left');
      A(/dir="rtl"/.test(ch || ''), 'the chapter is right to left');
      A(/direction:\s*rtl/.test(css || '') && /Noto Nastaliq Urdu/.test(css || ''), 'stylesheet with direction and the Urdu font');
      A(names.some(n => /noto-nastaliq-urdu/.test(n)), 'the Urdu font is embedded: ' + names.join(','));
    } finally { d.dirty = false; try { await app.docs.close(d.id, { force: true }); } catch {} }
  });

  // ---------------------------------------------------------------- writing
  const findings = async (text, o = {}) => (await W().checkText(text, { lang: 'en-US', ...o })) || [];
  T('Writing Assistant: correct sentences are not flagged', async () => {
    if (!W().checkText) return;
    const clean = ['The test passed.', 'All tests passed and the build is green.', 'I went there yesterday.', 'I could have gone there yesterday.', 'The flow was 25 m3/s at 10 am.',
      'The flood threatened its very existence.', 'The dam and its so-called spillway failed.', 'The company announced its not-for-profit arm.', 'We took an X-ray of the sample.',
      'Click a URL to open it.', 'Run an F-test and make a U-turn.', 'The trend is clear, as noted by Smith et al. (2007).',
      'See \\ref{fig:recieve} for the plot.', 'Great work :tada: team.', 'See [[Teh Page]] for more.'];
    for (const t of clean) {
      const f = (await findings(t)).filter(x => !x.wide && x.rule !== 'passive');
      A(!f.length, `no finding in “${t}”: ` + f.map(x => x.rule + ' ' + x.text).join('; '));
    }
    // spelling only (Harper may suggest "preprocessing", which is a fair style note)
    for (const t of ['The pre-processing step is fast.', 'An intra-day test, as in Farr et al. (2007).']) {
      const sp = (await findings(t)).filter(x => x.rule === 'spelling' && /^(pre|intra|et|al)$/i.test(x.text));
      A(!sp.length, `no spelling mark on prefixes or “et al.” in “${t}”: ` + sp.map(x => x.text).join(','));
    }
  });
  T('Writing Assistant: fixes that keep the sentence correct', async () => {
    if (!W().checkText) return;
    const fixOf = async (t, rule) => { const f = (await findings(t, { harper: false })).find(x => x.rule === rule || x.sub === rule); return f ? { f, out: t.slice(0, f.start) + (f.replacements[0] ?? '') + t.slice(f.end) } : null; };
    let r = await fixOf('The majority of the samples were dry.', 'wordy'); A(r && r.out === 'Most of the samples were dry.', 'majority: ' + r?.out);
    r = await fixOf('The pump is capable to lift water.', 'capableTo'); A(r && r.out === 'The pump is capable of lifting water.', 'capable: ' + r?.out);
    r = await fixOf('Please explain me the steps.', 'explainMe'); A(r && !r.f.replacements.length, 'explain me: message only');
    r = await fixOf('She is good at maths.', 'dialect'); A(r && r.out === 'She is good at math.', 'maths: ' + r?.out);
    r = await fixOf('We made a decision on the budget.', 'nominalization'); A(r && r.out === 'We decided on the budget.', 'decided on: ' + r?.out);
    r = await fixOf('The results shows a trend.', 'agreement'); A(r && r.out === 'The results show a trend.', 'agreement: ' + r?.out);
    r = await fixOf('We reached to the office.', 'reachTo'); A(r && r.out === 'We reached the office.', 'reach to: ' + r?.out);
    r = await fixOf('Irregardless of the cost, we went.', 'irregardless'); A(r && r.out === 'Regardless of the cost, we went.', 'irregardless: ' + r?.out);
    const its = (await findings('The model lost it’s accuracy, and its clear that it matters.', { harper: false })).filter(x => x.rule === 'its');
    A(its.length === 2 && its.every(x => !x.safe), 'its/it’s: both caught, never an automatic fix: ' + its.map(x => x.text).join(','));
    const art = (await findings('Click an URL.', { harper: false })).find(x => x.rule === 'article');
    A(!art || !art.safe, 'article fixes on abbreviations are never automatic');
    // every rule's own wrong example is caught (the Why? card shows it)
    for (const id of ['its', 'overused', 'agreement', 'usage']) {
      const ex = R().RULES[id];
      const f = (await findings(ex.wrong, { harper: false })).filter(x => x.rule === id);
      A(f.length, `“${id}” catches its own example: ${ex.wrong}`);
    }
  });
  T('Harper: no rules come back after a UK check, messages without backticks, examples only for their own rule', async () => {
    if (!W().checkText) return;
    const t = 'The SDR was measured at three sites. We dont know why it isnt working.';
    await findings(t, { lang: 'en-GB' });
    const f = await findings(t, { lang: 'en-US' });
    const bad = f.filter(x => x.source === 'harper' && /^(SpellCheck|LongSentences|AvoidContractions)$/.test(x.harperRule));
    A(!bad.length, 'rules Markooj turns off stay off after a dialect switch: ' + bad.map(x => x.harperRule).join(','));
    const m = (await findings('I could of gone.')).find(x => x.source === 'harper');
    A(m && !m.message.includes('`'), 'Harper message without backticks: ' + (m && m.message));
    const ex1 = W().explain({ source: 'harper', harperRule: 'ModalOf', kind: 'WordChoice' });
    A(ex1.wrong === 'I could of gone.', 'ModalOf has its example');
    const ex2 = W().explain({ source: 'harper', harperRule: 'SomeOtherRule', kind: 'WordChoice' });
    A(!ex2.wrong && !ex2.right, 'another WordChoice rule shows no unrelated example');
  });
  T('spelling suggestions put the obvious word first', () => {
    if (!W().suggest) return;
    const lang = W().languageFor({ meta: { lang: 'en-US' } });
    for (const [w, want] of [['teh', 'the'], ['thier', 'their'], ['Wensday', 'Wednesday'], ['recieve', 'receive']]) {
      const s = W().suggest(w, lang);
      A(s[0] === want, `${w} → ${s.slice(0, 3).join(', ')}`);
    }
  });
  T('personal dictionary words are known after start (and the list and lookups agree)', () => {
    const D = W().dictionary; if (!D) return;
    A(D.list().every(w => D.has(w)), 'every saved word is known');
    const before = D.list();
    try { D.add('Markoojtestword'); A(D.has('markoojtestword'), 'a new word is known at once'); }
    finally { D.set(before); }
  });
  T('word completion: common words, no misspellings or code from the document', async () => {
    const AC = W().autocomplete; if (!AC?.complete) return;
    await W().loadThesaurus?.();
    for (const [p, want] of [['becau', 'because'], ['wou', 'would'], ['whi', 'which'], ['alth', 'although'], ['impor', 'important']]) A(AC.complete(p, null) === want, `${p} → ${AC.complete(p, null)}`);
    const d = { id: 'review3-ac', kind: 'markdown', meta: {}, text: 'We recieved the samples from Pakistan.\n\n```\ndefinitelyy = 1\n```\n' };
    A(AC.complete('rec', d) !== 'recieved', 'a misspelling in the document is not offered: ' + AC.complete('rec', d));
    A(AC.complete('defi', d) !== 'definitelyy', 'code in the document is not offered');
    A(AC.complete('pak', d) !== 'pakistan', 'a name is not offered in lower case');
    A(AC.inNonProse('```\ncod', 8) && AC.inNonProse('Use `co', 7) && !AC.inNonProse('Plain te', 8), 'no completion in code (Simple mode)');
  });
  T('synonyms take the form of the word they replace', async () => {
    if (!W().synonyms) return;
    const s = await W().synonyms('shows', { before: 'The data ' });
    A(s.flat.length && /s$/.test(s.flat[0]) && s.groups[0].pos === 'verb', 'data shows → ' + s.flat.slice(0, 4).join(', '));
    const went = await W().synonyms('went');
    A(went.flat.some(x => /^(moved|traveled|proceeded|departed)$/.test(x)), 'went → ' + went.flat.slice(0, 4).join(', '));
    const kids = await W().synonyms('children');
    A(kids.flat.some(x => /^(kids|youngsters|minors)$/.test(x)), 'children → ' + kids.flat.slice(0, 4).join(', '));
    const u = await W().synonyms('utilize');
    A(!u.flat.includes('utilise'), 'no British spelling of the same word');
    const big = await W().synonyms('big');
    A(!big.flat.includes('bigger') && !big.flat.includes('larger'), 'no comparatives for a plain adjective: ' + big.flat.slice(0, 6).join(', '));
    const hap = await W().synonyms('happier');
    A(hap.flat.slice(0, 3).every(x => /er$|^more /.test(x)), 'happier → ' + hap.flat.slice(0, 3).join(', '));
  });
  // (every pack rule fixing its own wrong example is tested with the real packs in src/lang.js, when they are built)
  T('language packs: ZWNJ stays in Persian words', async () => {
    const fa = R().spellTokens('کتاب‌ها دانشگاه‌ها');
    A(fa.length === 2 && fa[0].w === 'کتاب‌ها', 'Persian plurals with a half space are one word: ' + fa.map(x => x.w).join('|'));
  });
  T('a language pack cannot change built-in English', () => {
    if (!W().registerLanguage) return;
    const before = W().languages().find(l => l.code === 'en-US');
    A(W().registerLanguage({ code: 'en-US', name: 'Test', dir: 'rtl' }) === false, 'refused');
    const after = W().languages().find(l => l.code === 'en-US');
    A(after.name === before.name && after.dir === 'ltr', 'en-US unchanged: ' + JSON.stringify(after));
  });

  // ---------------------------------------------------------------- release material
  T('notices: elkjs under GPL-3.0-or-later, no note to maintainers; Check Tools names the DjVuLibre package', async () => {
    let info = null; try { info = await mk.invoke('app-info'); } catch {}
    if (!info?.noticesFile) return;
    const n = await mk.invoke('read-text', info.noticesFile);
    A(/elkjs[^\n]*used under GPL-3\.0-or-later/.test(n), 'elkjs license choice');
    A(!/\(Maintainers:/.test(n), 'no maintainer note in the public notices');
    let h = null; try { h = await mk.invoke('tools-health', {}); } catch {}
    const dj = h?.tools?.ddjvu;
    const pv = (/^### DjVuLibre ([\d.]+)/m.exec(n) || [])[1];
    if (dj?.bundled && dj.version && pv && !dj.version.startsWith(pv)) A(dj.version.includes('package ' + pv), 'Check Tools shows the package version too: ' + dj.version);
  });
})();
