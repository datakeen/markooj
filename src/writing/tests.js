// Markooj — Writing Assistant smoke tests (run with: npx electron . --smoke <dir> --smoke-only writing)
(function () {
  'use strict';
  const app = window.app, W = app && app.writing, R = window.MkWritingRules;
  if (!app || !W || !R) return;
  const A = app.assert;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function until(fn, ms = 8000, step = 50) { const t = Date.now(); while (Date.now() - t < ms) { try { const v = fn(); if (v) return v; } catch {} await sleep(step); } return null; }
  const shot = async name => { try { await app.mk.invoke('smoke-shot', name); } catch {} };
  const T = (name, fn) => app.tests.register('writing: ' + name, fn);
  async function withDoc(text, mode, fn) {
    const m0 = app.mode;
    if (mode) app.setMode(mode);
    const d = app.docs.create({ text, title: 'writing-test' });
    try {
      await until(() => app.editors.active()?.doc === d || (app.mode === 'simple' && document.querySelector('#editorHost textarea.mk-src-ta')), 5000);
      await sleep(250);
      return await fn(d);
    } finally { await app.docs.close(d.id, { force: true }); if (mode) app.setMode(m0); }
  }

  T('each category fires on a sample and stays quiet on clean text', async () => {
    const samples = { correctness: ['We discussed about the plan.', {}], clarity: ['In order to win, we trained hard.', {}], engagement: ['The results were very good.', {}], delivery: ['We don’t know the cause.', { formality: 'formal' }] };
    for (const [cat, [t, goals]] of Object.entries(samples)) {
      const f = await W.checkText(t, { lang: 'en-US', goals });
      A(f.some(x => x.cat === cat), `${cat} fires on “${t}”: ${JSON.stringify(f.map(x => [x.rule, x.cat, x.text]))}`);
    }
    const clean = await W.checkText('The committee approved the budget on Monday.\n\nWe measured the flow at three sites.', { lang: 'en-US' });
    A(clean.length === 0, 'clean text has no findings: ' + JSON.stringify(clean.map(x => [x.rule, x.text, x.message])));
    const gr = await W.checkText('I has a apple and she go home.', { lang: 'en-US' });
    A(W.engine.harper === 'ready', 'Harper grammar checker is ready (state: ' + W.engine.harper + ')');
    A(gr.some(x => x.source === 'harper'), 'Harper finds grammar: ' + JSON.stringify(gr.map(x => [x.rule, x.text])));
    A(gr.some(x => x.rule === 'article'), 'a/an rule fires');
  });

  T('prepositions, wordy phrases and goals', async () => {
    const t = 'She is married with a doctor. The team comprises of five people. He is superior than me. I have lived here since five years. We will cope up with it.';
    const f = await W.checkText(t, { lang: 'en-US', harper: false });
    const preps = f.filter(x => x.rule === 'preposition').map(x => x.replacements[0]);
    A(preps.includes('married to') && preps.includes('comprises') && preps.includes('superior to') && preps.includes('for five years') && preps.includes('cope with'), 'preposition fixes: ' + JSON.stringify(preps));
    const academic = await W.checkText('The samples were collected by the team.', { lang: 'en-US', goals: { domain: 'academic' }, harper: false });
    const general = await W.checkText('The samples were collected by the team.', { lang: 'en-US', goals: { domain: 'general' }, harper: false });
    A(!academic.some(x => x.rule === 'passive') && general.some(x => x.rule === 'passive'), 'passive voice depends on the domain goal');
    const casual = await W.checkText('We don’t know.', { lang: 'en-US', goals: { formality: 'informal' }, harper: false });
    A(!casual.some(x => x.rule === 'contraction'), 'contractions are fine when informal');
  });

  T('US and UK English spell differently (color/colour)', async () => {
    const us = await W.checkText('The colour of the centre was analysed.', { lang: 'en-US' });
    const fix = w => us.find(x => x.text === w)?.replacements?.[0];
    A(fix('colour') === 'color' && fix('centre') === 'center' && fix('analysed') === 'analyzed', 'US fixes: ' + JSON.stringify(us.map(x => [x.rule, x.text, x.replacements])));
    const ukSame = await W.checkText('The colour of the centre was analysed.', { lang: 'en-GB', harper: false });
    A(!ukSame.some(x => x.rule !== 'passive' && /colour|centre|analysed/.test(x.text)), 'UK accepts colour: ' + JSON.stringify(ukSame.map(x => [x.rule, x.text])));
    const uk = await W.checkText('The color of the center.', { lang: 'en-GB', harper: false });
    A(uk.find(x => x.text === 'color')?.replacements?.[0] === 'colour' && uk.find(x => x.text === 'center')?.replacements?.[0] === 'centre', 'UK fixes: ' + JSON.stringify(uk.map(x => [x.text, x.replacements])));
    const oxford = await W.checkText('We organize the data.', { lang: 'en-GB', harper: false });
    A(!oxford.some(x => x.text === 'organize'), 'Oxford -ize spelling is fine in British English');
    const sp = await W.checkText('We recieved the samples.', { lang: 'en-US', harper: false });
    const s = sp.find(x => x.rule === 'spelling' && x.text === 'recieved');
    A(s && W.suggest('recieved').includes('received'), 'spelling + suggestion: ' + JSON.stringify(sp.map(x => [x.rule, x.text])));
  });

  T('every rule and every grammar kind has an explanation with a wrong and a right example', async () => {
    for (const [id, r] of Object.entries(R.RULES)) A(r.explain && r.wrong && r.right && r.title && R.CATS.includes(r.cat), 'rule ' + id);
    for (const p of R.PREPOSITIONS) A(p.message && p.wrong && p.right, 'preposition ' + p.id);
    for (const [k, v] of Object.entries(R.HARPER_KINDS)) A(v.length === 5 && v.every(Boolean), 'Harper kind ' + k);
    const f = await W.checkText('I has a apple.', { lang: 'en-US' });
    for (const x of f) { const e = W.explain(x); A(e.text && e.wrong && e.right, 'explanation for ' + x.rule); }
  });

  T('code, math, front matter, links and citations are never checked', async () => {
    const t = '---\ntitle: Teh the tset\n---\n# Intro\n\nSee `the the codez` and $a = the the$ and https://example.com/teh-the and [@smith2020; @jones2019] and {#eq:abcx} and %%teh the%%.\n\n```\nteh the\n```\n\n$$\nx = teh\n$$\n\nThe committee approved the budget on Monday.\n';
    const f = await W.checkText(t, { lang: 'en-US' });
    A(f.length === 0, 'nothing flagged: ' + JSON.stringify(f.map(x => [x.rule, x.text])));
  });

  T('accepting a fix goes through the editor and Undo brings the text back', async () => {
    for (const mode of ['word', 'simple', 'inline']) {
      await withDoc('We discussed about the plan.\n', mode, async d => {
        const list = await W.check(d);
        const f = list.find(x => x.rule === 'preposition');
        A(f, mode + ': preposition found: ' + JSON.stringify(list.map(x => x.rule)));
        A(await W.accept(f, f.replacements[0], d), mode + ': accepted');
        A(d.text === 'We discussed the plan.\n', mode + ': fixed text: ' + JSON.stringify(d.text));
        await sleep(200);
        await app.commands.run('edit.undo');
        await until(() => d.text === 'We discussed about the plan.\n', 3000);
        A(d.text === 'We discussed about the plan.\n', mode + ': undo restores: ' + JSON.stringify(d.text));
      });
    }
  });

  T('underlines are painted in Word, Inline and Simple modes', async () => {
    for (const mode of ['word', 'inline', 'simple']) {
      await withDoc('# Notes\n\nWe discussed about the plan. In order to win, we tried.\n', mode, async d => {
        await W.check(d); W.repaint();
        const p = await until(() => W.painted().length >= 2 && W.painted(), 4000);
        A(p, mode + ': underlines painted');
        A(p.some(x => String(x.range) === 'discussed about'), mode + ': range text ' + JSON.stringify(p.map(x => String(x.range))));
        A(CSS.highlights.has('mkw-correctness') && CSS.highlights.has('mkw-clarity'), mode + ': highlights registered');
      });
    }
  });

  T('synonyms for “important” and the thesaurus', async () => {
    const s = await W.synonyms('important');
    A(s && s.groups.length && s.flat.some(w => /^(significant|crucial|central|key|fundamental)$/.test(w)), 'synonyms: ' + JSON.stringify(s && s.flat.slice(0, 10)));
    const ran = await W.synonyms('discussed');
    A(ran && ran.lemma === 'discuss' && ran.flat.length, 'lemma of discussed: ' + ran?.lemma);
    A(W.lemmas('running').includes('run'), 'running → run');
    A(W.lemmas('studies').includes('study') && W.lemmas('happier').includes('happy'), 'lemmas');
  });

  T('word suggestions are off by default and complete common words', async () => {
    // a fresh profile (smoke runs use one) has never turned it on
    A(W.settings.autocomplete() === false, 'Suggest words as I type is off by default');
    A(!W.autocomplete.visible(), 'no ghost text');
    await W.loadThesaurus();
    const c = W.autocomplete.complete('impor', null);
    A(c === 'important', 'impor → ' + c);
    A(W.autocomplete.complete('ab', null) === null, 'needs three letters');
  });

  T('a 20,000-word document is checked off the main thread', async () => {
    const parts = ['The committee discussed about the plan in order to reduce costs at site N.', 'It was approved by the board on Monday after meeting N ran long.', 'We measured the flow at N sites and the results were very good.', 'The colour of the water changed after flood N.', 'Its a clear sign that river N carries more sediment than before.', 'I has studied this effect for N years in several basins.'];
    const paras = []; let words = 0, i = 0;
    while (words < 20000) { const p = []; for (let k = 0; k < 5; k++) { const s = parts[(i + k) % parts.length].replace('N', String(i * 7 + k)); p.push(s); words += s.split(/\s+/).length; } paras.push(p.join(' ')); i++; }
    const text = paras.join('\n\n');
    // the dictionary and the thesaurus load once at start-up (about 0.2 s each); this test measures checking
    W.isWordCorrect('warm', W.languageFor({ meta: { lang: 'en-US' } })); await W.loadThesaurus(); await sleep(50);
    // warm the spelling cache and the rule engine on a slice of the same text, so the timing below measures checking
    await W.checkText(paras.slice(0, 8).join('\n\n'), { lang: 'en-US', harper: false });
    // how busy is this machine? A fixed piece of work, timed: the limits scale with it (other programs or test runs
    // at the same time slow everything down; on a quiet machine the factor is 1)
    const cal = (() => { const t = performance.now(); let x = 0; for (let k = 0; k < 4e6; k++) x += Math.sqrt(k) % 3; return (performance.now() - t) + (x < 0 ? 1 : 0); })();
    const slow = Math.max(1, Math.min(4, cal / 60)); // about 50 ms on a quiet laptop
    await sleep(30);
    let maxGap = 0, last = performance.now();
    const timer = setInterval(() => { const n = performance.now(); maxGap = Math.max(maxGap, n - last); last = n; }, 10);
    try {
      // rules + spelling on every paragraph (the grammar checker then works through the paragraphs in the worker)
      const t0 = performance.now();
      const f = await W.checkText(text, { lang: 'en-US', harper: false });
      const first = performance.now() - t0;
      // one paragraph changed: only that paragraph is checked again, grammar included
      const small = paras.slice(0, 40).join('\n\n');
      await W.checkText(small, { lang: 'en-US' });
      const t1 = performance.now();
      const g = await W.checkText(small.replace('The committee discussed', 'A committee discussed'), { lang: 'en-US' });
      const second = performance.now() - t1;
      const info = ' (' + words + ' words, ' + f.length + ' findings; rules and spelling ' + Math.round(first) + ' ms; one paragraph changed ' + Math.round(second) + ' ms; longest main-thread pause ' + Math.round(maxGap) + ' ms; machine load factor ' + slow.toFixed(2) + ')';
      W.lastPerf = info;
      A(f.length > 1000, 'findings' + info);
      A(g.some(x => x.source === 'harper'), 'grammar findings after an edit' + info);
      A(first < 8000 * slow, 'rules and spelling' + info);
      A(second < 2000 * slow, 'incremental check' + info);
      A(maxGap < 400 * slow, 'main thread stays free' + info);
    } finally { clearInterval(timer); }
  });

  T('right-click menu has fixes, synonyms and Cut/Copy/Paste; F7 steps through issues', async () => {
    await W.loadThesaurus();
    await withDoc('This is an important point and we discussed about it.\n', 'word', async d => {
      await W.check(d); W.repaint();
      await until(() => W.painted().length, 4000);
      const page = W.surface()?.el; A(page, 'Word page');
      const tw = document.createTreeWalker(page, NodeFilter.SHOW_TEXT); let n, r = null;
      while ((n = tw.nextNode())) { const i = n.data.indexOf('important'); if (i >= 0) { r = document.createRange(); r.setStart(n, i + 2); r.setEnd(n, i + 3); break; } }
      A(r, 'word found');
      const rc = r.getBoundingClientRect();
      page.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rc.left + 1, clientY: rc.top + rc.height / 2, button: 2 }));
      const menu = await until(() => document.querySelector('.pop.menu.show, .pop.menu'), 2000);
      A(menu, 'context menu opened');
      const txt = menu.textContent;
      A(/Synonyms for “important”/.test(txt) && /Cut/.test(txt) && /Copy/.test(txt) && /Paste/.test(txt) && /Thesaurus/.test(txt), 'menu items: ' + txt.slice(0, 300));
      app.ui.closePopover?.(); document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await sleep(100);
      // F7: the Spelling and Grammar dialog shows the first issue with Change / Ignore and Why?
      const run = app.commands.run('review.spelling');
      const dlg = await until(() => [...document.querySelectorAll('.dlg')].find(x => /Spelling and Grammar/.test(x.textContent)), 8000);
      A(dlg, 'F7 dialog opened');
      A(dlg.querySelector('.mkw-f7-hit') && dlg.querySelector('details.mkw-f7-why') && [...dlg.querySelectorAll('button')].some(b => b.textContent === 'Change'), 'F7 dialog content');
      [...dlg.querySelectorAll('button')].find(b => b.textContent === 'Change').click();
      await sleep(300);
      const dlg2 = [...document.querySelectorAll('.dlg')].find(x => /Spelling and Grammar/.test(x.textContent) && x !== dlg);
      if (dlg2) [...dlg2.querySelectorAll('button')].find(b => b.textContent === 'Close')?.click();
      await run;
      A(d.text === 'This is an important point and we discussed it.\n', 'F7 Change fixed the text: ' + JSON.stringify(d.text));
    });
  });

  T('word completion shows ghost text and Tab accepts it (when turned on)', async () => {
    const was = app.settings.get('writingAutocomplete', false);
    app.settings.set('writingAutocomplete', true);
    try {
      await W.loadThesaurus();
      await withDoc('Start.\n', 'simple', async d => {
        const ta = document.querySelector('#editorHost textarea.mk-src-ta'); A(ta, 'Simple mode textarea');
        ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
        document.execCommand('insertText', false, 'An impor');
        const g = await until(() => W.autocomplete.visible() && document.querySelector('.mkw-ghost.show'), 2000);
        A(g && g.textContent === 'tant', 'ghost text: ' + (g && g.textContent));
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
        await until(() => /An important/.test(d.text) || /An important/.test(ta.value), 2000);
        A(/An important/.test(ta.value), 'Tab accepted: ' + JSON.stringify(ta.value));
        document.execCommand('insertText', false, ' sedi');
        await sleep(50);
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
        A(!W.autocomplete.visible(), 'Esc hides the ghost text');
      });
    } finally { app.settings.set('writingAutocomplete', was); }
  });

  T('Review tab has Proofing and Writing groups; commands are registered', async () => {
    for (const id of ['review.spelling', 'review.spellingAsYouType', 'review.writingAssistant', 'review.thesaurus', 'writing.goals', 'writing.acceptAll', 'writing.toggle', 'writing.setLanguage', 'writing.autocomplete']) A(app.commands.get(id), 'command ' + id);
    A(app.commands.get('review.spelling').shortcut === 'F7' && app.commands.get('review.thesaurus').shortcut === 'Shift+F7', 'F7 / Shift+F7');
    const rev = app.ribbon.tabs().find(t => t.id === 'review');
    A(rev.groups.some(g => g.id === 'rev-proof') && rev.groups.some(g => g.id === 'rev-writing'), 'groups: ' + rev.groups.map(g => g.id));
    A(W.languages().some(l => l.code === 'en-GB') && W.languageFor({ meta: { lang: 'en-GB' } }).dialect === 'UK', 'languages');
    A(W.registerLanguage({ code: 'xx-TEST', name: 'Test language', dir: 'rtl', aff: 'SET UTF-8\n', dic: '2\nfoo\nbar\n', rules: [{ id: 'baz', pattern: 'baz', message: 'No baz.', replacement: 'bar', wrong: 'baz', right: 'bar' }] }), 'registerLanguage');
    const f = await W.checkText('foo bar baz qux', { lang: 'xx-TEST' });
    A(f.some(x => x.rule === 'lang:baz') && f.some(x => x.rule === 'spelling' && x.text === 'qux'), 'registered language spelling + rules: ' + JSON.stringify(f.map(x => [x.rule, x.text])));
    W.unregisterLanguage('xx-TEST');
  });

  T('screenshots: writing-assistant and synonyms', async () => {
    const text = '# Field report\n\nWe discussed about the results on Monday. In order to reduce costs, the team decided to reply back to the council. The colour of the river was very good after the flood, and its a clear sign of recovery.\n\nThe samples were collected by the team at three sites. Basically the method is really simple. The SDR was higher than expected.\n';
    await withDoc(text, 'word', async d => {
      W.pane.open('assistant');
      await W.check(d);
      await until(() => W.state(d).status === 'ready', 15000);
      W.repaint(); await sleep(300);
      const f = W.state(d).findings.find(x => x.rule === 'preposition') || W.state(d).findings[0];
      if (f) { W.showCard(f); await sleep(150); document.querySelector('.mkw-card .mkw-why')?.click(); }
      await sleep(400);
      document.querySelectorAll('#toastLayer > *').forEach(t => t.remove());
      await shot('writing-assistant');
      W.hideCard();
      W.pane.close();
      await W.loadThesaurus();
      await W.openThesaurus('important');
      await sleep(400);
      const p = W.painted().find(x => /results/.test(String(x.range))) || W.painted()[0];
      const page = W.surface()?.el;
      if (page) {
        const tw = document.createTreeWalker(page, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) { const i = n.data.indexOf('simple'); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 6); await W.synonymsPopup({ kind: 'dom', range: r, word: 'simple' }); break; } }
      }
      void p;
      await sleep(350);
      await shot('synonyms');
      document.querySelector('.mkw-syn')?.remove();
      W.pane.close();
      try { app.shell?.selectTab?.('review'); await sleep(300); await shot('writing-review-tab'); } catch {}
      try {
        app.backstage.open('options'); await sleep(500);
        const sec = await until(() => document.querySelector('.opt-card[data-section="writing"]'), 2000);
        sec?.previousElementSibling?.scrollIntoView({ block: 'start' }); await sleep(250);
        await shot('writing-options');
      } finally { app.backstage.close(); await sleep(200); }
    });
  });

  // ---- near-miss spelling (language packs, format 2) ----
  const NM_WORDS = [['كتان', 2], ['كتاب', 5], ['قلم', 4], ['مدرسة', 3], ['بيت', 2], ['جميل', 1], ['ولد', 3], ['کتاب', 5], ['اچھا', 4]];
  const NM_CLITICS = { prefix: ['و', 'ب', 'ال', 'بال', 'وال', 'لل'], suffix: ['ها', 'ه', 'ي', 'ات', 'یں'] };
  T('near-miss: flags one-edit typos of common words, not known words, clitic forms or words with no near neighbor', () => {
    const idx = R.nmBuild({ words: NM_WORDS, ...NM_CLITICS });
    const bad = w => R.nmCheck(idx, w);
    // typos one edit from a word with freq >= 2: substitute, delete, insert, swap
    for (const w of ['كتاا', 'كتب', 'كتااب', 'كاتب', 'مدرصة']) A(bad(w), 'flagged: ' + w);
    // known words, also with harakat, tatweel or ZWNJ
    for (const w of ['كتاب', 'كِتَابٌ', 'كتـــاب', 'قلم', 'مدرسة', 'اچھا', 'کتاب']) A(!bad(w), 'known: ' + w);
    // one prefix and/or one suffix around a known word
    for (const w of ['وكتاب', 'بالكتاب', 'الكتاب', 'كتابها', 'وكتابها', 'للولد', 'کتابیں']) A(!bad(w), 'clitic form: ' + w);
    // no common neighbor: unknown, but not flagged (few false alarms with a small list)
    for (const w of ['سيارات', 'جميا', 'طاولة']) A(!bad(w), 'no near neighbor: ' + w);
    // fewer than three letters, and words in other scripts
    A(!bad('كت') && !bad('Kitab') && !bad('كتا1'), 'short words and other scripts are left alone');
    // suggestions: up to five, most frequent first (كتاب 5 before كتان 2, though كتان comes first in the list)
    const s = bad('كتاا'); A(s && s.suggestions[0] === 'كتاب' && s.suggestions[1] === 'كتان' && s.suggestions.length <= 5, 'ordered by freq: ' + JSON.stringify(s));
    A(R.nmOneEdit('ab', 'ba') && R.nmOneEdit('abc', 'abd') && R.nmOneEdit('abc', 'ab') && R.nmOneEdit('ab', 'acb') && !R.nmOneEdit('abc', 'cba') && !R.nmOneEdit('abc', 'abc'), 'edit distance');
    // Punjabi: ن and ݨ count as one letter, and a suggestion keeps the list's own spelling (پاݨی, not پانی)
    const pi = R.nmBuild({ words: [['پاݨی', 5], ['جاݨا', 4]] });
    A(!R.nmCheck(pi, 'پانی') && R.nmCheck(pi, 'پانیی')?.suggestions[0] === 'پاݨی' && R.nmCheck(pi, 'جانئا')?.suggestions[0] === 'جاݨا', 'ݨ kept in suggestions: ' + JSON.stringify(R.nmCheck(pi, 'پانیی')));
    // findings carry the place, the word and the suggestions
    const f = R.nmFindings(idx, { text: 'هذا كتاا جميل وكتاب' }, 'Test');
    A(f.length === 1 && f[0].text === 'كتاا' && f[0].start === 4 && f[0].rule === 'spelling' && f[0]._sugg[0] === 'كتاب', 'finding: ' + JSON.stringify(f));
  });
  T('near-miss: a registered language checks in the worker and in the page, with Add to dictionary and Ignore', async () => {
    const lex = { fields: ['word', 'aarab', 'roman', 'freq', 'pos'], rows: NM_WORDS.map(([w, f]) => [w, '', [], f, 'noun-m']) };
    let loads = 0;
    W.registerLanguage({ code: 'xw', name: 'Near test', dir: 'rtl', spellingMode: 'near-miss', lexicon: async () => { loads++; return lex; }, clitics: NM_CLITICS });
    try {
      A(W.languages().some(l => l.code === 'xw' && l.spelling && l.spellingMode === 'near-miss'), 'registered with near-miss spelling');
      A(loads === 0, 'the word list is not loaded before it is needed');
      const text = 'هذا كتاا جميل وكتاب بالكتاب سيارات.\n';
      for (const inPage of [false, true]) {
        const found = (await W.checkText(text, { lang: 'xw', harper: false, inPage })).filter(f => f.rule === 'spelling');
        A(found.length === 1 && found[0].text === 'كتاا' && found[0]._sugg[0] === 'كتاب', (inPage ? 'page' : 'worker') + ': ' + JSON.stringify(found.map(f => [f.text, f._sugg])));
      }
      A(loads === 1, 'loaded once: ' + loads);
      const xw = W.languages().find(l => l.code === 'xw');
      A(!W.isWordCorrect('كتاا', xw) && W.isWordCorrect('وكتاب', xw) && W.isWordCorrect('سيارات', xw), 'right-click check agrees');
      A(W.suggest('كتاا', xw)[0] === 'كتاب', 'suggestions: ' + JSON.stringify(W.suggest('كتاا', xw)));
      // Ignore all, then Add to dictionary
      W.ignoreWord('كتاا');
      A(!(await W.checkText(text, { lang: 'xw', harper: false })).some(f => f.text === 'كتاا'), 'ignored for this session');
      W.ignoredWords.delete('كتاا');
      const d = app.docs.create({ text: '---\nlang: xw\n---\n\n' + text, title: 'near-miss' });
      try {
        await W.check(d);
        const st = W.state(d);
        A(st.findings.some(f => f.rule === 'spelling' && f.text === 'كتاا'), 'the document shows the typo: ' + JSON.stringify(st.findings.map(f => f.text)));
        W.dictionary.add('كتاا');
        A(await until(() => W.dictionary.has('كتاا') && W.state(d).status !== 'checking' && !W.state(d).findings.some(f => f.text === 'كتاا'), 5000), 'added to the dictionary: no longer marked: ' + JSON.stringify(W.state(d).findings.map(f => f.text)));
        A(W.isWordCorrect('كتاا', xw), 'right-click agrees after adding');
      } finally { W.dictionary.remove('كتاا'); await app.docs.close(d.id, { force: true }); }
    } finally { W.unregisterLanguage('xw'); }
    A(!W.nearMiss.has('xw'), 'unregistered');
  });

  // ---- full spelling from a word list (language packs, format 2: Urdu with the CLE list) ----
  // [word, freq, count]
  const FS_WORDS = [['ضرورت', 5, 14000], ['ضروری', 5, 8000], ['کتاب', 5, 4600], ['خطاب', 4, 300], ['کباب', 3, 140], ['محبت', 5, 4700], ['حکومت', 5, 9000],
    ['پاکستان', 5, 20000], ['اور', 5, 90000], ['کے', 5, 99000], ['یہ', 5, 80000], ['ہے', 5, 98000], ['سال', 5, 5000], ['ثال', 1, 2], ['سار', 2, 40], ['نظر', 5, 6000], ['نذر', 3, 200], ['نصر', 3, 150]];
  const FS_SIMILAR = { groups: [{ kind: 'sound', letters: ['ذ', 'ز', 'ض', 'ظ'] }, { kind: 'sound', letters: ['ث', 'س', 'ص'] }, { kind: 'sound', letters: ['ت', 'ط'] }, { kind: 'sound', letters: ['ح', 'ہ'] }, { kind: 'shape', letters: ['ب', 'پ', 'ت', 'ث'] }] };
  const fsIdx = (o = {}) => R.fsBuild({ list: FS_WORDS.map(x => x[0]), rank: FS_WORDS.map(x => R.fsRank(x[1], x[2])), similar: FS_SIMILAR, ...o });
  T('full spelling: every unknown word of two letters or more is flagged; known words, harakat and clitic forms are not', () => {
    const idx = fsIdx({ prefix: ['و'], suffix: ['وں'] });
    const bad = w => R.nmCheck(idx, w);
    for (const w of ['ضرورت', 'ضَرُورَت', 'ضرورـــت', 'کتاب', 'اور', 'کے', 'ہے', 'وکتاب', 'کتابوں']) A(!bad(w), 'known: ' + w);
    // unknown words are flagged even with no near neighbor (near-miss would leave them alone)
    for (const w of ['زرورت', 'کطاب', 'قلمدان', 'ءء', 'یہاںوہاں']) A(bad(w), 'flagged: ' + w);
    A(!bad('ک') && !bad('Kitab') && !bad('۲۰۲۴') && !bad('کتاب۲'), 'one letter, other scripts and numbers are left alone');
    A(R.nmFlag(idx, 'زرورت') && !R.nmFlag(idx, 'کتاب'), 'nmFlag agrees');
    const f = R.nmFindings(idx, { text: 'یہ زرورت ہے' }, 'Urdu');
    A(f.length === 1 && f[0].text === 'زرورت' && f[0].fullSpelling && f[0].nearMiss && f[0]._sugg[0] === 'ضرورت' && /Did you mean “ضرورت”/.test(f[0].message), 'finding: ' + JSON.stringify(f));
    const none = R.nmFindings(idx, { text: 'قلمدان' }, 'Urdu');
    A(none.length === 1 && none[0]._sugg.length === 0 && /not in the Urdu word list\.$/.test(none[0].message), 'no suggestions: ' + JSON.stringify(none));
  });
  T('full spelling: a similar-letter trade ranks above a plain edit; then the count decides', () => {
    // سال (count 5,000) and ثال (count 2) are both one similar-letter trade from the typo صال
    const idx = fsIdx();
    const s = R.fsSuggest(idx, R.nmNormalize('صال'), 6);
    A(s[0] === 'سال', 'the common sound-alike first: ' + JSON.stringify(s));
    A(s.includes('ثال'), 'the rare sound-alike is offered too: ' + JSON.stringify(s));
    // with equal counts, the similar-letter trade wins over a plain edit
    const eq = R.fsBuild({ list: ['نظر', 'نصر', 'نشر'], rank: [100, 100, 100], similar: { groups: [{ kind: 'sound', letters: ['ذ', 'ز', 'ض', 'ظ'] }] } });
    const s2 = R.fsSuggest(eq, R.nmNormalize('نزر'), 6);
    A(s2[0] === 'نظر' && s2.length === 3, 'similar first at equal counts: ' + JSON.stringify(s2));
    // two similar-letter trades still find the word (ذ → ض and ط → ت)
    A(R.fsSuggest(idx, R.nmNormalize('ذرورط'), 6)[0] === 'ضرورت', 'two trades: ' + JSON.stringify(R.fsSuggest(idx, R.nmNormalize('ذرورط'), 6)));
    // count ranking among plain one-edit neighbors: کتاب (4,600) before کباب (140), and both found for کتاا
    const k = R.fsSuggest(idx, R.nmNormalize('کتاا'), 6); A(k[0] === 'کتاب', 'count order: ' + JSON.stringify(k));
    const c = R.fsSuggest(R.fsBuild({ list: ['کتاب', 'کباب'], rank: [10, 9000] }), R.nmNormalize('کناب'), 6);
    A(c[0] === 'کباب' && c[1] === 'کتاب', 'higher count first: ' + JSON.stringify(c));
    A(R.fsSuggest(idx, R.nmNormalize('پاکستن'), 6)[0] === 'پاکستان' && R.fsSuggest(idx, R.nmNormalize('ہکومت'), 6)[0] === 'حکومت', 'insert and trade');
    // at most six suggestions, and the index is built only when a suggestion is first needed
    const lazy = fsIdx(); A(!lazy.del, 'no suggestion index before the first unknown word');
    R.nmCheck(lazy, 'کتاب'); A(!lazy.del, 'a known word needs no index');
    R.nmCheck(lazy, 'کتاا'); A(lazy.del && lazy.del.keys > 0, 'built on the first unknown word');
    A(R.fsRank(5, 0) > R.fsRank(2, 0) && R.fsRank(1, 500) === 500 && R.fsRank(null, null) === 0, 'rank from freq and count');
  });
  T('full spelling: a registered language checks in the worker and in the page; full without a word list keeps Hunspell', async () => {
    const lex = { fields: ['word', 'aarab', 'roman', 'freq', 'pos', 'count', 'extra'], rows: FS_WORDS.map(([w, f, c]) => [w, '', [], f, 'noun-m', c, 'x']) };
    let loads = 0;
    for (const [shape, src] of [['table', lex], ['compact', { list: FS_WORDS.map(x => x[0]).join('\n'), freq: FS_WORDS.map(x => x[1]), count: FS_WORDS.map(x => x[2]) }]]) {
      W.registerLanguage({ code: 'xf', name: 'Full test', dir: 'rtl', spellingMode: 'full', lexicon: async () => { loads++; return src; }, similar: FS_SIMILAR, clitics: { prefix: [], suffix: [] } });
      try {
        A(W.languages().some(l => l.code === 'xf' && l.spelling && l.spellingMode === 'full' && l.wordList), shape + ': registered with full spelling');
        A(W.nearMiss.has('xf') && W.nearMiss.mode('xf') === 'full', shape + ': word-list spelling');
        const text = 'یہ زرورت ہے اور کتاب قلمدان کے.\n';
        for (const inPage of [false, true]) {
          const found = (await W.checkText(text, { lang: 'xf', harper: false, inPage })).filter(f => f.rule === 'spelling');
          A(found.length === 2 && found[0].text === 'زرورت' && found[0]._sugg[0] === 'ضرورت' && found[1].text === 'قلمدان', shape + (inPage ? ' page: ' : ' worker: ') + JSON.stringify(found.map(f => [f.text, f._sugg])));
        }
        const xf = W.languages().find(l => l.code === 'xf');
        A(!W.isWordCorrect('زرورت', xf) && W.isWordCorrect('کتاب', xf) && !W.isWordCorrect('قلمدان', xf), shape + ': right-click check agrees');
        A(W.suggest('زرورت', xf)[0] === 'ضرورت', shape + ': suggestions ' + JSON.stringify(W.suggest('زرورت', xf)));
        W.ignoreWord('قلمدان');
        A(!(await W.checkText(text, { lang: 'xf', harper: false })).some(f => f.text === 'قلمدان'), shape + ': ignored for this session');
        W.ignoredWords.delete('قلمدان');
      } finally { W.unregisterLanguage('xf'); }
    }
    A(loads === 2, 'each word list loaded once: ' + loads);
    A(!W.nearMiss.has('xf'), 'unregistered');
    // "full" without a word list: the Hunspell list (nspell), as for Persian
    W.registerLanguage({ code: 'xg', name: 'Hunspell test', dir: 'rtl', spellingMode: 'full', aff: 'SET UTF-8\nTRY abc\n', dic: '2\nkitab\nqalam\n' });
    try {
      const l = W.languages().find(x => x.code === 'xg');
      A(l && l.spellingMode === 'full' && !l.wordList && !W.nearMiss.has('xg'), 'full without a word list uses Hunspell: ' + JSON.stringify(l));
    } finally { W.unregisterLanguage('xg'); }
  });
  T('full spelling: 95,000 words index quickly and a long document checks fast', () => {
    // a synthetic list the size of the Urdu one (letters of the Urdu alphabet, 3–9 letters long)
    const L = 'ابپتٹثجچحخدڈذرڑزژسشصضطظعغفقکگلمنوہیے';
    let seed = 7; const rnd = n => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % n; };
    const list = [], rank = [];
    for (let i = 0; i < 95000; i++) { let w = ''; const len = 3 + rnd(7); for (let k = 0; k < len; k++) w += L[rnd(L.length)]; list.push(w); rank.push(1 + rnd(1000)); }
    let t = performance.now();
    const idx = R.fsBuild({ list: list.join('\n'), rank, similar: FS_SIMILAR });
    R.fsIndex(idx);
    const build = performance.now() - t;
    const words = []; for (let i = 0; i < 2000; i++) { const w = list[(i * 7919) % list.length]; words.push(i % 20 === 0 ? w.slice(0, 1) + 'ظ' + w.slice(2) : w); }
    t = performance.now();
    const f = R.nmFindings(idx, { text: words.join(' ') }, 'Test');
    const check = performance.now() - t;
    A(f.length >= 80 && f.length <= 110, 'typos flagged: ' + f.length);
    A(build < 2000 && check < 1500, `index ${Math.round(build)} ms (limit 2,000), 2,000 words ${Math.round(check)} ms`);
    console.log(`[writing] full spelling: 95,000 words indexed in ${Math.round(build)} ms (${idx.del.keys} keys); 2,000 words checked in ${Math.round(check)} ms`);
    // a long run of letters without spaces (text pasted from a PDF) is flagged at once: before the length cap a run of
    // 6,400 letters took about 15 s in full mode (O(length³)) and near-miss spent O(length²)
    const run = 'سصثذ'.repeat(1600);
    t = performance.now();
    const lf = R.nmFindings(idx, { text: 'یہ ' + run + ' ہے' }, 'Test');
    const nm = R.nmCheck(R.nmBuild({ words: [['کتاب', 3]] }), 'کطاب'.repeat(1500));
    const runMs = performance.now() - t;
    const lr = lf.find(x => x.text === run);
    A(lr && !lr._sugg.length && nm === null && runMs < 200, `long run: ${Math.round(runMs)} ms, ${JSON.stringify(lf.map(x => [x.text.length, x._sugg.length]))}`);
  });

  // =================================================================== writing quality (1.2.0): suggestions, domain words, false alarms, context, wording
  const Q = (name, fn) => T('quality: ' + name, fn);
  const machineFactor = () => { const t = performance.now(); let x = 0; for (let k = 0; k < 4e6; k++) x += Math.sqrt(k) % 3; return Math.max(1, Math.min(4, (performance.now() - t + (x < 0 ? 1 : 0)) / 60)); };

  Q('spelling suggestions put the intended word first', async () => {
    await W.spellReady('en-US');
    const en = W.languageFor({ meta: { lang: 'en-US' } });
    const cases = [['calander', 'calendar', 1], ['coreection', 'correction', 1], ['seperate', 'separate', 1], ['definately', 'definitely', 1], ['recieve', 'receive', 1], ['occured', 'occurred', 1], ['accomodate', 'accommodate', 1], ['teh', 'the', 1], ['gramamr', 'grammar', 1], ['syncrounus', 'synchronous', 1], ['monotonusity', /^(monotony|monotonousness)$/, 3],
      ['speling', 'spelling', 1], ['beleive', 'believe', 1], ['enviroment', 'environment', 1], ['begining', 'beginning', 1], ['neccessary', 'necessary', 1], ['adress', 'address', 1], ['existance', 'existence', 1], ['hydrolic', 'hydraulic', 2], ['mispeled', 'misspelled', 2], ['Calander', 'Calendar', 1], ['Lahor', 'Lahore', 3]];
    const bad = []; let worst = 0;
    for (const [w, want, n] of cases) {
      const t = performance.now(); const s = W.suggest(w, en); worst = Math.max(worst, performance.now() - t);
      if (!s.slice(0, n).some(x => (want instanceof RegExp ? want.test(x) : x === want))) bad.push(`${w} → ${s.join(', ')}`);
    }
    A(!bad.length, 'suggestions: ' + bad.join(' | '));
    A(W.suggest('calander', en).includes('colander'), 'colander may follow calendar');
    A(worst < 400 * machineFactor(), `slowest suggestion list ${Math.round(worst)} ms`);
    console.log(`[writing] ${cases.length} suggestion lists; slowest ${Math.round(worst)} ms`);
  });

  Q('technical terms and place names are accepted, with their capitals', async () => {
    await W.spellReady('en-US');
    const ok = 'The penstock, feedwater pump, tailrace and headrace were checked. A thermohydraulic and thermodynamic model ran in Simulink, MATLAB, ANSYS, HEC-RAS and OpenFOAM. ' +
      'The hydrograph and hyetograph used Manning and Froude numbers. We visited San Onofre, Lahore, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, Sukkur, Hyderabad, Wah, Taxila, Mangla and Tarbela ' +
      'in Punjab, Sindh, Khyber Pakhtunkhwa, Balochistan, Gilgit-Baltistan and Azad Kashmir, and then Kraków, Düsseldorf, Bengaluru and Ulaanbaatar.\n';
    const f = (await W.checkText(ok, { lang: 'en-US' })).filter(x => x.rule === 'spelling' || x.source === 'harper' && x.cat === 'correctness');
    A(!f.length, 'nothing marked: ' + JSON.stringify(f.map(x => [x.rule, x.harperRule, x.text])));
    const low = (await W.checkText('We drove to lahore and saw the penstock.\n', { lang: 'en-US', harper: false })).filter(x => x.rule === 'spelling');
    A(low.some(x => x.text === 'lahore') && !low.some(x => x.text === 'penstock'), 'a place name keeps its capital: ' + JSON.stringify(low.map(x => x.text)));
    A(W.domainWords.has('Lahore') && !W.domainWords.has('lahore') && W.domainWords.has('Penstock') && W.domainWords.has('PENSTOCK'), 'case rule of W.domainWords.has');
    const was = W.settings.domainWords();
    try {
      app.settings.set('writingDomainWords', false); await sleep(60);
      const off = (await W.checkText('The penstock feeds the tailrace.\n', { lang: 'en-US', harper: false })).filter(x => x.rule === 'spelling').map(x => x.text);
      A(off.includes('penstock') && off.includes('tailrace'), 'turned off, the terms are checked again: ' + off.join(', '));
      A(app.commands.get('writing.domainWords') && !app.commands.get('writing.domainWords').isActive(), 'palette command shows the switch state');
      await app.commands.run('writing.domainWords'); await sleep(60);
      A(W.settings.domainWords() === true, 'the command turns it back on');
      const on = (await W.checkText('The penstock feeds the tailrace.\n', { lang: 'en-US', harper: false })).filter(x => x.rule === 'spelling');
      A(!on.length, 'on again: ' + JSON.stringify(on.map(x => x.text)));
      // dictionary words in the list are never removed when it is turned off
      app.settings.set('writingDomainWords', false); await sleep(60);
      const dict = (await W.checkText('Chicago and London are cities.\n', { lang: 'en-US', harper: false })).filter(x => x.rule === 'spelling');
      A(!dict.length, 'dictionary words stay known: ' + JSON.stringify(dict.map(x => x.text)));
    } finally { app.settings.set('writingDomainWords', was); await sleep(60); }
    const tip = app.tooltips?.info?.('writing.domainWords');
    A(tip && tip.title && tip.description, 'ScreenTip for the switch: ' + JSON.stringify(tip));
    A(JSON.stringify(app.ribbon.tabs()).includes('writing.domainWords') || document.querySelector('[data-tip-cmd="writing.domainWords"]'), 'Review → Proofing has the switch');
  });

  // correct sentences (from the request that asked for these checks, typos fixed, plus confusable words used correctly)
  const CORRECT = ['Writing Arabic, Urdu and Persian should use the keyboard layout that is famous among native speakers, not the same one for everyone.',
    'This writing can be enabled, that is, made possible, even if the keyboard of the operating system (Windows, Linux, Mac) is not installed.',
    'Easy switching between English and right-to-left languages should be given.', 'Normally, a selection of text written in Urdu and English (or math) is very inconvenient.',
    'Please improve the selection of mixed text.', 'Add the ability to paste a table to and from Microsoft Office documents and Markooj.',
    'Equation and figure numbering and caption handling within a table should be easy as well.',
    'Its installed memory footprint is bigger than I expected; I was hoping for something in the 100 to 150 MB range.',
    'Please tell me what causes its size to be that big and how it can be reduced.',
    'Can we give users options during installation about which packages to include, along with the memory each option uses or saves and the features it helps?',
    'It will help users select the features they need, and if they want, they can install the remaining features later.',
    'Please make the website feel lively with some subtle effects, and surprising and inspiring mouse movement effects that are related to the theme of Markooj as well, that is, an easy-to-use Markdown editor.',
    'If possible, add a short section where a visitor can have a short, controlled first taste of the different modes of Markooj, for example Word and Inline, and add an equation, a Mermaid diagram and so on.',
    'Some of Obsidian’s behavior will probably enhance the user experience.',
    'For example, brackets should close automatically: when we type one asterisk, a second one should appear with the cursor in between.',
    'An option to turn this behavior off should also be possible.',
    'There should be keyboard shortcuts as well as a control in the ribbon through which we can insert a date in the style the user prefers, like dd/mm/yy or yyyymmdd.',
    'Today’s date could come from /today, and any date from /date through a calendar dialog, with the day name included or not, and a Hijri calendar date as well.',
    'Multi-cursor writing will also enhance the user experience.',
    'A misspelled “calander” may also mean “calendar” instead of “colander”, so it is better to offer more closely related spelling corrections.',
    'We need a beautiful, engaging, modern, surprising, and mesmerizing yet decent 404 page.',
    'When we are in Read mode or Simple mode, click on a word in the right pane and press Ctrl+A, it selects all the words, even those of the interface, which is an undesired outcome.',
    'The ruler should be turned on and off as it is in Word.', 'If possible, guides can be created from the ruler by dragging with the mouse pressed from the edge of the ruler, just as in Adobe Illustrator.',
    'Please accept words used in hydraulics and river dynamics, such as thermo, penstock, ANSYS, MATLAB and feedwater, names of US states and places such as San Onofre, famous city names, and the cities and provinces of Pakistan.',
    'Ctrl+Alt+V should paste as plain text without formatting.', 'Here “effects” is used correctly, but it is marked as incorrect.',
    'Please improve the grammar rules so that such silly suggestions are rare, not only for affect and effect but for others as well.',
    'Also, based on the context, the word “an” is wrong and the word “and” should be the suggestion.', 'You need to improve the grammar rules based on the context as well.',
    'As a writing aid, an opening quotation mark should also come with a closing one.',
    'Here, even with an opening quotation mark, a closing one does not appear, and if we press this key again, instead of a closing mark it inserts another opening mark at the end of the sentence, which leaves a bad taste for the user.',
    'Every time it gives the same suggestion.', 'The suggestion is fine, but it creates monotony.',
    'It may be better to have five or ten suggestions and to change the suggestion at random, even if the same mistake appears several times in a single document.',
    'A picture pasted or embedded by another Markdown editor does not show here when the file is opened.',
    'Add the ability to read and write another document side by side; another instance of the same document should be possible too, with synchronous scrolling on or off.',
    'It should be possible to split the document window just as in Word, but even better.',
    'Please translate the interface into Chinese (Simplified), Urdu (right to left), Roman Urdu (left to right), Punjabi (Shahmukhi), Japanese, Arabic, Swedish, Spanish, French and Portuguese.',
    'Please note that the translation has to work well.', 'Poor or awkward, machine-like translations can turn users away, while well-written ones will keep them connected.',
    'For Urdu, Arabic and Punjabi, use the language packs for spell checking and suggestions while writing.',
    'Users can choose their language at the start of installation, and they can also switch between languages easily while using the software.',
    'The new policy will affect every student in the program.', 'The effects of the flood were visible for months.', 'These subtle visual effects make the page feel alive.',
    'Small changes can have large effects on the result.', 'The drug had no effect on the patients.', 'The manager wants to effect real change in the team.',
    'Rising costs affect how we plan the project.', 'The sediment load is higher than last year.', 'First we measured the flow, and then we dried the samples.',
    'The river changed its course after the storm.', 'It’s clear that the model works.', 'Your report is due on Friday.', 'You’re right about the delay.',
    'Do not lose the receipt.', 'The bolts on the gate were loose.', 'The principal investigator approved the plan.', 'In principle, the design is sound.',
    'The colors complement each other well.', 'She paid me a compliment on the report.', 'Thank you for your advice.', 'We advise you to back up your files.',
    'The pump is more efficient than the old one.', 'Back then, the road was narrow.', 'Its value depends on the season.', 'The side effects were mild.',
    'Special effects in the film were impressive.', 'Sound effects and lighting effects were added later.', 'These factors affected the outcome.', 'The effect was immediate.',
    'We studied the effects, and the results were clear.', 'Mouse movement effects should stay subtle.', 'Turbulence effects near the wall are strong.',
    'It took an hour to run a European test at a university.', 'Black and white photos look timeless.', 'The spillway, penstock and tailrace were inspected at Tarbela.',
    'Using an engaging layout helps readers.', 'A big old red truck stood near a short, steep slope.', 'Breakfast is complimentary for guests.', 'Rather than wait, we left early.'];
  W.qualityCorpus = CORRECT;

  Q('no correctness alerts on 80 correct sentences, and the real mistakes are still found', async () => {
    A(CORRECT.length >= 60, 'corpus size ' + CORRECT.length);
    await W.spellReady('en-US');
    const text = CORRECT.join('\n\n') + '\n';
    const all = await W.checkText(text, { lang: 'en-US', spelling: false });
    A(W.engine.harper === 'ready', 'Harper is part of this check (state: ' + W.engine.harper + ')');
    const bad = all.filter(x => x.cat === 'correctness');
    A(!bad.length, 'false alarms: ' + JSON.stringify(bad.map(x => [x.rule, x.harperRule || x.sub || '', x.text, text.slice(Math.max(0, x.start - 30), x.end + 10)])));
    console.log(`[writing] false-alarm corpus: ${CORRECT.length} sentences, ${bad.length} correctness alerts, ${all.length} hints in other categories`);
    // the mistakes these rules exist for are still caught (each with the right fix first)
    const WRONG = [['The new rules will effect everyone.', 'effect', 'affect'], ['The drug had no affect on the patients.', 'affect', 'effect'], ['The side affects were mild.', 'affects', 'effects'],
      ['It is bigger then the old one.', 'then', 'than'], ['Since than, the river rose.', 'than', 'then'], ['Your going to like it.', 'Your', 'You’re'], ['Check you’re own work.', 'you’re', 'your'],
      ['Do not loose the receipt.', 'loose', 'lose'], ['The screw is lose.', 'lose', 'loose'], ['In principal, the plan works.', 'principal', 'principle'], ['The principle investigator agreed.', 'principle', 'principal'],
      ['The colors compliment each other.', 'compliment', 'complement'], ['She paid me a nice complement.', 'complement', 'compliment'], ['We advice you to save often.', 'advice', 'advise'], ['Thanks for the advise.', 'advise', 'advice'],
      ['We were badly effected by the flood.', 'effected', 'affected'], ['Its a good day.', 'Its', 'It’s'], ['It took a hour.', 'a', 'an']];
    const miss = [];
    for (const [s, w, fix] of WRONG) { const f = (await W.checkText(s + '\n', { lang: 'en-US', spelling: false })).find(x => x.text === w && x.cat === 'correctness'); if (!f || f.replacements[0] !== fix) miss.push(`${s} → ${f ? f.replacements[0] : 'nothing'}`); }
    A(!miss.length, 'missed: ' + miss.join(' | '));
  });

  Q('“an” between describing words suggests “and”; commas between coordinate describing words', async () => {
    const t = 'We want a beautiful engaging modern and surprising, an mesmerizing yet decent 404 page.\n';
    const f = await W.checkText(t, { lang: 'en-US', harper: false, spelling: false });
    const an = f.find(x => x.rule === 'article' && x.text === 'an');
    A(an && an.replacements[0] === 'and' && an.replacements[1] === 'a' && /Did you mean “and”|“and”/.test(an.message), 'an → and first, a second: ' + JSON.stringify(an));
    const why = W.explain(an); A(/and/.test(why.text) && why.right, 'Why? explains the list: ' + JSON.stringify(why));
    const cm = f.find(x => x.rule === 'adjCommas');
    A(cm && cm.cat === 'clarity' && !cm.safe && cm.replacements[0] === 'beautiful, engaging, modern, surprising, and mesmerizing', 'comma hint: ' + JSON.stringify(cm));
    const bw = (await W.checkText('We printed black an white photos.\n', { lang: 'en-US', harper: false, spelling: false })).find(x => x.rule === 'article');
    A(bw && bw.replacements[0] === 'and', 'black an white: ' + JSON.stringify(bw));
    const plain = (await W.checkText('A beautiful engaging modern design.\n', { lang: 'en-US', harper: false, spelling: false })).find(x => x.rule === 'adjCommas');
    A(plain && plain.replacements[0] === 'beautiful, engaging, modern', 'no "and" added when the list has none: ' + JSON.stringify(plain));
    const uk = (await W.checkText('A calm quiet and friendly place.\n', { lang: 'en-GB', harper: false, spelling: false })).find(x => x.rule === 'adjCommas');
    A(uk && uk.replacements[0] === 'calm, quiet and friendly', 'British style has no serial comma: ' + JSON.stringify(uk));
    for (const s of ['It took an hour.', 'Using an engaging layout helps.', 'A big old red truck.', 'A short, controlled first taste.', 'It was an elegant and modern design.', 'A calm, quiet, friendly place.', 'An honest, open answer.']) {
      const g = (await W.checkText(s + '\n', { lang: 'en-US', harper: false, spelling: false })).filter(x => x.rule === 'article' || x.rule === 'adjCommas');
      A(!g.length, `quiet on “${s}”: ` + JSON.stringify(g.map(x => [x.rule, x.text, x.replacements])));
    }
    // accepting the comma fix gives the sentence the request asked for
    await withDoc(t, 'simple', async d => {
      const list = await W.check(d); const c = list.find(x => x.rule === 'adjCommas');
      A(c && await W.accept(c, c.replacements[0], d), 'comma fix accepted');
      A(/a beautiful, engaging, modern, surprising, and mesmerizing yet decent/.test(d.text), 'text: ' + d.text);
    });
  });

  Q('repeated mistakes are explained in varied words, the same on every check', async () => {
    for (const [k, list] of Object.entries(R.PHRASES)) A(list.length >= 5 && list.length <= 10 && new Set(list).size === list.length, `${k}: ${list.length} distinct phrasings`);
    const t = 'I ate a apple. She ate a orange. He ate a egg. We saw a owl. It took a hour.\n\nWe discussed about the plan. They discussed about the cost. She discussed about it.\n';
    const a1 = await W.checkText(t, { lang: 'en-US', harper: false, spelling: false });
    const a2 = await W.checkText(t, { lang: 'en-US', harper: false, spelling: false });
    const arts = a1.filter(x => x.rule === 'article'), preps = a1.filter(x => x.rule === 'preposition');
    A(arts.length === 5 && new Set(arts.map(x => x.message)).size === 5, 'five article messages, all different: ' + JSON.stringify(arts.map(x => x.message)));
    A(preps.length === 3 && new Set(preps.map(x => x.message)).size === 3 && preps.every(x => x.message.includes('“Discuss” already means')), 'preposition frames keep the reason: ' + JSON.stringify(preps.map(x => x.message)));
    A(JSON.stringify(a1.map(x => x.message)) === JSON.stringify(a2.map(x => x.message)), 'checking again gives the same messages');
    A(new Set(arts.map(x => JSON.stringify(W.explain(x)))).size === 1, 'Why? stays the same');
    A(arts.every(x => !/\{\w+\}/.test(x.message) && /“(apple|orange|egg|owl|hour)”|an (apple|orange|egg|owl|hour)/.test(x.message)), 'every phrasing names the word: ' + JSON.stringify(arts.map(x => x.message)));
    // Harper messages vary only for rules whose meaning is known
    const h = R.vary([{ source: 'harper', harperRule: 'AnA', message: 'Incorrect indefinite article.', text: 'a', replacements: ['an'], start: 0, end: 1 }, { source: 'harper', harperRule: 'AnA', message: 'Incorrect indefinite article.', text: 'a', replacements: ['an'], start: 9, end: 10 }, { source: 'harper', harperRule: 'SomethingElse', message: 'Keep me.', text: 'x', replacements: [], start: 20, end: 21 }]);
    A(h[0].message === 'Incorrect indefinite article.' && h[1].message !== h[0].message && /an/.test(h[1].message) && h[2].message === 'Keep me.', 'Harper wording: ' + JSON.stringify(h.map(x => x.message)));
  });

  Q('passive hints: no reporting verbs with “as”, one per paragraph', async () => {
    const p = s => W.checkText(s, { lang: 'en-US', harper: false, spelling: false }).then(f => f.filter(x => x.rule === 'passive'));
    A(!(await p('Here effects is used correctly, but it is marked as incorrect.\n')).length, 'is marked as');
    A(!(await p('This value is known as the Froude number.\n')).length, 'is known as');
    A(!(await p('Save the file when it is opened.\n')).length, 'a time clause');
    A((await p('The report was written by the committee. It was then reviewed by the board. The plan was approved by the council.\n')).length === 1, 'one per paragraph');
    A((await p('The samples were collected by the team.\n')).length === 1, 'still shown for a plain passive');
  });

  Q('a 10,000-word document is checked without a noticeable slowdown', async () => {
    const parts = ['The committee discussed about the plan in order to reduce costs at site N.', 'The subtle effects, and surprising mouse movement effects, were tested N times.', 'A beautiful engaging modern and surprising, an mesmerizing page N appeared.',
      'It is bigger then the old pump N.', 'We measured the flow at N sites and the results were very good.', 'The penstock and tailrace at Tarbela N were inspected.'];
    const paras = []; let words = 0, i = 0;
    while (words < 10000) { const p = []; for (let k = 0; k < 5; k++) { const s = parts[(i + k) % parts.length].replace('N', String(i * 7 + k)); p.push(s); words += s.split(/\s+/).length; } paras.push(p.join(' ')); i++; }
    const text = paras.join('\n\n') + '\n';
    const slow = machineFactor();
    let t = performance.now(); const own = R.checkAll(text, { dialect: 'US', goals: {} }); const ownMs = performance.now() - t;
    t = performance.now(); R.vary(own.findings); const varyMs = performance.now() - t;
    await W.checkText(paras.slice(0, 6).join('\n\n'), { lang: 'en-US', harper: false });
    t = performance.now(); const f = await W.checkText(text, { lang: 'en-US', harper: false }); const fullMs = performance.now() - t;
    A(f.some(x => x.rule === 'confusable') && f.some(x => x.rule === 'adjCommas'), 'the new rules fire in the big document');
    A(ownMs < 900 * slow && varyMs < 100 * slow && fullMs < 3000 * slow, `rules ${Math.round(ownMs)} ms, wording ${Math.round(varyMs)} ms, full check with spelling ${Math.round(fullMs)} ms (machine factor ${slow.toFixed(2)})`);
    console.log(`[writing] 10,000 words (${words}): rules ${Math.round(ownMs)} ms in the page, wording ${Math.round(varyMs)} ms, worker check + spelling ${Math.round(fullMs)} ms, ${f.length} findings`);
  });
})();
