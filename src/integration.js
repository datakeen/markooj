// Markooj — integration glue and cross-module checks (integrator). Loaded after every feature module, before app.js.
// - bridges the per-editor "rendered" events to the shared 'editor:rendered' event the shell waits for
// - smoke tests that only make sense with every module present: round-trips, ribbon hygiene, ScreenTips, numbering
(function () {
  'use strict';
  const app = window.app;
  if (!app) return;
  const E = app.editor || {};
  const A = app.assert;
  const mk = app.mk;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function until(fn, ms = 4000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch {} await sleep(25); } return false; }

  // ---------- one shared "the editor finished drawing" event ----------
  [['word:rendered', 'word'], ['inline:rendered', 'inline'], ['read:rendered', 'read']].forEach(([ev, mode]) => {
    app.events.on(ev, (p = {}) => app.events.emit('editor:rendered', { mode, doc: p.doc, page: p.page }));
  });

  // ---------- the round-trip document ----------
  const PAPER = `---
title: Flume Study
xref:
  numbering: chapter
---

# Introduction {#sec:intro}

Bed shear is set by @eq:shields and the flume in [@fig:flume]. Runs are in [-@tbl:runs].

$$
\\theta = \\frac{\\tau_b}{(\\rho_s - \\rho) g D}
$$ {#eq:shields}

A remark <!-- comment: check the units --> and %%a hidden note%% in the text.

![Laboratory flume](flume.png){#fig:flume}

# Results {#sec:results}

| Run | D (mm) |
| --- | --- |
| R1 | 2.0 |
| R2 | 4.5 |

: Flume runs {#tbl:runs}

$$
q^* = 8 (\\theta - \\theta_c)^{3/2}
$$ {#eq:transport}

See [@eq:shields; @eq:transport] and @sec:results, citing [@shields1936].
`;
  E._integrationPaper = PAPER;

  function lineDiff(a, b) {
    const x = a.split('\n'), y = b.split('\n');
    for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return `line ${i + 1}: ${JSON.stringify(x[i])} → ${JSON.stringify(y[i])}`;
    return 'same';
  }

  app.tests.register('integration: Word → Markdown keeps labels, refs, comments and notes unchanged', async () => {
    A(E._fullRoundTrip, 'Word round-trip helper');
    const { kept, converted } = await E._fullRoundTrip(PAPER);
    A(kept === PAPER, 'untouched page: ' + lineDiff(PAPER, kept));
    A(converted.replace(/\n+$/, '') === PAPER.replace(/\n+$/, ''), 'every block rewritten from the page: ' + lineDiff(PAPER, converted));
  });

  app.tests.register('integration: Word edit in one paragraph leaves labels, refs and notes alone', async () => {
    A(E.createWord && E._offscreen && E.fakeDoc, 'Word editor helpers');
    const host = E._offscreen(); const ed = E.createWord(); const d = E.fakeDoc(PAPER);
    try {
      ed.mount(host, d);
      await until(() => ed.page && ed.page.querySelector('.mk-math'));
      await sleep(120);
      const p = [...ed.page.querySelectorAll('p')].find(x => /A remark/.test(x.textContent));
      A(p, 'remark paragraph');
      const t = [...p.childNodes].find(n => n.nodeType === 3 && /A remark/.test(n.data));
      t.data = t.data.replace('A remark', 'A short remark');
      await sleep(30);
      ed._commit();
      const want = PAPER.replace('A remark', 'A short remark');
      A(d.text === want, lineDiff(want, d.text));
    } finally { ed.unmount(); host.remove(); }
  });

  app.tests.register('integration: Inline → Markdown keeps the paper unchanged, block by block', async () => {
    const make = E.createInline; A(make && E._offscreen && E.fakeDoc, 'Inline editor helpers');
    const host = E._offscreen(); host.style.overflow = 'auto';
    const ed = make(); const d = E.fakeDoc(PAPER);
    try {
      ed.mount(host, d); await ed.whenIdle();
      await until(() => ed.page && ed.page.querySelector('.mk-math'));
      // open every block (each paragraph start) and leave it again without typing
      const starts = []; const re = /(^|\n\n)(?=\S)/g; let m;
      while ((m = re.exec(PAPER))) { starts.push(m.index + m[1].length); if (re.lastIndex === m.index) re.lastIndex++; }
      for (const s of starts) {
        await ed.setSelection(s + 1, s + 1); await ed.whenIdle();
        A(ed.openBlock, 'a block opens at offset ' + s + ' (' + JSON.stringify(PAPER.slice(s, s + 20)) + ')');
        await ed.close(); await ed.whenIdle();
        A(d.text === PAPER, `after opening ${JSON.stringify(PAPER.slice(s, s + 20))}: ` + lineDiff(PAPER, d.text));
      }
      // the labeled equation opens as one block that includes its label line
      const eqAt = PAPER.indexOf('$$\n\\theta');
      await ed.setSelection(eqAt + 4, eqAt + 4); await ed.whenIdle();
      A(ed.openBlock && /\{#eq:shields\}$/.test(ed.openBlock.text), 'equation block includes {#eq:shields}: ' + JSON.stringify(ed.openBlock && ed.openBlock.text));
      await ed.close(); await ed.whenIdle();
      // one edit changes only that spot
      const at = PAPER.indexOf('A remark') + 2;
      await ed.setSelection(at, at); await ed.whenIdle();
      ed.insert('short '); await ed.whenIdle(); await ed.close(); await ed.whenIdle();
      const want = PAPER.replace('A remark', 'A short remark');
      A(d.text === want, 'typing in one block: ' + lineDiff(want, d.text));
    } finally { ed.unmount(); host.remove(); }
  });

  // ---------- numbering on the real page: chapter style, one number per equation, no overlap ----------
  app.tests.register('integration: chapter numbering shows 1.1, one number per equation, never overlapping', async () => {
    const doc = app.docs.create({ title: 'Numbering check', text: PAPER });
    const prevMode = app.mode;
    try {
      app.setMode('word');
      await until(() => document.querySelector('#editorHost .mk-math .mk-eqno'), 6000);
      await sleep(300);
      const atoms = [...document.querySelectorAll('#editorHost .mk-math-block, #editorHost .mk-math[data-display="true"], #editorHost .mk-math.display')];
      const eqs = [...new Set(atoms)].filter(a => a.querySelector('.katex-display, .katex') && !atoms.some(b => b !== a && b.contains(a)));
      A(eqs.length >= 2, 'two display equations on the page, found ' + eqs.length);
      const nums = eqs.map(a => [...a.querySelectorAll('.mk-eqno')].filter(n => n.offsetParent).map(n => n.textContent.trim()));
      A(nums.every(n => n.length === 1), 'exactly one visible number per equation: ' + JSON.stringify(nums));
      A(nums[0][0] === '(1.1)' && nums[1][0] === '(2.1)', 'chapter-style numbers (1.1) and (2.1): ' + JSON.stringify(nums));
      const katexNums = [...document.querySelectorAll('#editorHost .eqn-num, #editorHost .tag')].filter(n => n.offsetParent && n.getBoundingClientRect().width > 0);
      A(!katexNums.length, 'no KaTeX-drawn number: ' + katexNums.length);
      for (const a of eqs) {
        const n = a.querySelector('.mk-eqno').getBoundingClientRect();
        const k = (a.querySelector('.katex-display .katex, .katex') || a).getBoundingClientRect();
        A(n.left >= k.right - 1 || n.top >= k.bottom - 1, 'number sits beside the math, not on it');
      }
      const refs = [...document.querySelectorAll('#editorHost .mk-xref')].map(r => r.textContent.trim());
      A(refs.some(r => /Eq\.\s*\(1\.1\)/.test(r)), 'reference reads Eq. (1.1): ' + JSON.stringify(refs));
      A(refs.some(r => /^2\.1$/.test(r) || /Table\s*2\.1/.test(r)) || refs.some(r => /2\.1/.test(r)), 'table number in chapter style: ' + JSON.stringify(refs));
      const cap = [...document.querySelectorAll('#editorHost figcaption, #editorHost caption')].map(c => c.textContent.trim());
      A(cap.some(c => /^Fig\.\s*1\.1/.test(c)), 'figure caption starts Fig. 1.1: ' + JSON.stringify(cap));
      try { await app.mk.invoke('smoke-shot', 'numbering'); } catch {}
    } finally {
      try { await app.docs.close(doc.id, { force: true }); } catch {}
      if (prevMode && prevMode !== app.mode) app.setMode(prevMode);
    }
  });

  // ---------- labels and notes in the other views ----------
  app.tests.register('integration: outline, word count and Simple colors understand labels and notes', () => {
    const sh = app.shell || {};
    if (sh.parseHeadings) {
      const hs = sh.parseHeadings(PAPER).map(h => h.text);
      A(hs.includes('Results'), 'a heading after a labeled equation stays in the outline: ' + JSON.stringify(hs));
    }
    if (sh.docStats) {
      const st = sh.docStats(PAPER);
      A(st.citations === 1 && st.sources === 1, 'cross-references are not citations: ' + JSON.stringify(st));
    }
    if (E.highlightLine) {
      let st = 'n'; const out = PAPER.split('\n').map((l, i) => { const [html, next] = E.highlightLine(l, st, i); st = next; return { l, html, st }; });
      const after = out.find(x => x.l.startsWith('A remark'));
      A(after && !/^<span class="t-math">/.test(after.html), 'Simple colors leave math after $$ {#eq:shields}');
      A(/class="t-note">%%a hidden note%%/.test(after.html), 'hidden note is tinted in Simple mode');
      const refLine = out.find(x => x.l.startsWith('Bed shear'));
      A(/class="t-link">@eq:shields/.test(refLine.html), 'bare @eq: reference is colored like a link');
    }
  });

  app.tests.register('integration: Read mode keeps equation numbers and captions, hides notes and comments', async () => {
    const doc = app.docs.create({ title: 'Read check', text: PAPER });
    const prevMode = app.mode;
    try {
      if (!app.editors.get?.('read') && !app.modes?.includes?.('read')) return;
      app.setMode('read');
      await until(() => document.querySelector('#editorHost .mk-eqno'), 6000); await sleep(300);
      const vis = sel => [...document.querySelectorAll('#editorHost ' + sel)].filter(n => n.getClientRects().length && getComputedStyle(n).display !== 'none');
      A(vis('.mk-eqno').length === 2, 'two visible equation numbers: ' + vis('.mk-eqno').length);
      A(vis('.mk-xnum').length >= 1, 'caption numbers visible');
      A(!vis('.mk-note').length && !vis('.mk-comment').length, 'notes and comments hidden');
    } finally {
      try { await app.docs.close(doc.id, { force: true }); } catch {}
      if (prevMode && prevMode !== app.mode) app.setMode(prevMode);
    }
  });

  // ---------- ribbon hygiene ----------
  function ribbonCommands() {
    const out = [];
    const walk = (items, tab, group) => (items || []).forEach(it => { if (!it) return; if (it.command) out.push({ tab, group, command: it.command, label: it.label }); if (it.items) walk(it.items, tab, group); });
    for (const t of app.ribbon.tabs()) for (const g of t.groups) walk(g.items, t.id, g.id);
    return out;
  }
  E._ribbonCommands = ribbonCommands;
  const SAME = [['xref.crossref', 'ref.crossref'], ['xref.numberAll', 'ref.numberEquations'], ['insert.equation'], ['xref.caption']];
  app.tests.register('integration: one Cross-reference per tab, one equation numbering control', () => {
    const items = ribbonCommands();
    const problems = [];
    for (const t of app.ribbon.tabs()) {
      const mine = items.filter(i => i.tab === t.id);
      const seen = new Map();
      for (const i of mine) { const k = i.command; seen.set(k, (seen.get(k) || 0) + 1); }
      for (const [k, n] of seen) if (n > 1) problems.push(`${t.id}: ${k} appears ${n} times`);
      for (const group of SAME) { const n = mine.filter(i => group.includes(i.command)).length; if (n > 1) problems.push(`${t.id}: ${group.join('/')} appears ${n} times`); }
    }
    const numbering = items.filter(i => /numberAll|numberEquations/.test(i.command));
    if (numbering.length > 1) problems.push('equation numbering on the ribbon ' + numbering.length + ' times: ' + numbering.map(i => i.tab + '/' + i.group).join(', '));
    A(!problems.length, problems.join('\n'));
  });

  app.tests.register('integration: every ribbon and palette command is registered and has a ScreenTip', () => {
    const missing = ribbonCommands().filter(i => !app.commands.get(i.command)).map(i => `${i.command} (${i.tab}/${i.group})`);
    A(!missing.length, 'ribbon items without a command: ' + missing.join(', '));
    A(app.tooltips?.info, 'app.tooltips');
    const onRibbon = new Set(ribbonCommands().map(i => i.command));
    const thin = [];
    for (const c of app.commands.list()) {
      if ((c.palette === false || c.hidden) && !onRibbon.has(c.id)) continue;
      const i = app.tooltips.info(c.id);
      if (!i.title || !i.description || i.description === i.title) thin.push(c.id);
    }
    A(!thin.length, `${thin.length} command(s) without a ScreenTip description: ` + thin.join(', '));
  });

  // ---------- review fixes: round trips, exports, safety ----------
  async function wordEdit(src, edit) {
    const host = E._offscreen(); const ed = E.createWord(); const d = E.fakeDoc(src);
    try {
      ed.mount(host, d);
      await until(() => ed.page && ed.page.children.length > 0); await sleep(150);
      edit(ed.page); await sleep(30); ed._commit();
      return d.text;
    } finally { ed.unmount(); host.remove(); }
  }
  const editText = (page, from, to) => {
    const w = document.createTreeWalker(page, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) if (n.data.includes(from)) { n.data = n.data.replace(from, to); return true; }
    throw new Error('text not found: ' + from);
  };
  const BLOCKS = 'Para one.\n\n```{r echo=FALSE}\nx <- 1\n```\n\n~~~python\nprint(1)\n~~~\n\n    indented code\n\n<div class="box">\n\nInside box.\n\n</div>\n\n::: {.callout-note}\nQuarto note\n:::\n\n::: {#thm1 .theorem}\nA theorem.\n:::\n\nTerm\n:   Definition\n\n<Chart data={1} />\n\nA [see @smith2020, p. 12] cite, a note^[an inline note], \\$5 or \\$x\\$, <https://example.com> and <span class="smallcaps">Small</span>.\n';
  app.tests.register('fixes: a Word edit keeps code fences, raw HTML, fenced divs, definition lists and MDX verbatim', async () => {
    A(E.createWord && E._offscreen && E.fakeDoc, 'Word editor helpers');
    const out = await wordEdit(BLOCKS, p => editText(p, 'Para one.', 'Para one!'));
    const want = BLOCKS.replace('Para one.', 'Para one!');
    A(out === want, lineDiff(want, out));
  });
  app.tests.register('fixes: a Word edit keeps citations with prefixes, inline notes, \\$, autolinks and raw spans', async () => {
    const out = await wordEdit(BLOCKS, p => editText(p, ' cite, a note', ' cite, one note'));
    const want = BLOCKS.replace(' cite, a note', ' cite, one note');
    A(out === want, lineDiff(want, out));
  });
  app.tests.register('fixes: Word keeps CRLF files CRLF and loose lists clean', async () => {
    const crlf = 'Alpha\r\n\r\nBeta\r\n\r\nGamma';
    const out = await wordEdit(crlf, p => editText(p, 'Beta', 'Beta two'));
    A(out === 'Alpha\r\n\r\nBeta two\r\n\r\nGamma', JSON.stringify(out));
    const list = '- item one\n\n- item two\n\n  continued para\n';
    const o2 = await wordEdit(list, p => editText(p, 'item two', 'item 2'));
    A(/- item 2/.test(o2) && !/^[ \t]+$/m.test(o2), 'no whitespace-only lines: ' + JSON.stringify(o2));
  });
  app.tests.register('fixes: a document that opens with a rule is not front matter in Word mode', async () => {
    const src = '---\n\n# Heading\n\nPara one\n\n---\n';
    A(E.splitFrontMatter(src).raw === '', 'no front matter: ' + JSON.stringify(E.splitFrontMatter(src)));
    const out = await wordEdit(src, p => editText(p, 'Para one', 'Para two'));
    A(out === src.replace('Para one', 'Para two'), JSON.stringify(out));
  });
  app.tests.register('fixes: citations, fenced divs and MDX render', () => {
    const r = app.mk.render('[see @a1, p. 3; @b2] ::: x\n\n::: {.callout-note}\nQ\n:::\n\n::: aside\nZ\n:::\n\n<Chart data={1} />\n', { bib: { a1: { author: 'Smith, J.', year: '2020', key: 'a1' } } });
    A(/data-keys="a1;b2"/.test(r.html) && /data-items=/.test(r.html), 'bracket citation with prefix: ' + r.html.slice(0, 300));
    A(/<div class="callout callout-note"[^>]*data-fence="\{\.callout-note\}"/.test(r.html) && /<div class="aside"/.test(r.html), 'fenced divs');
    A(/class="mk-mdx"/.test(r.html) && !/Chart data=\{1\} \/>\s*<\/p>/.test(r.html), 'MDX chip');
    const n = app.mk.render('@a1 says.', { bib: { a1: { author: 'Smith, J.', year: '2020', key: 'a1' } } });
    A(/data-narrative="1"/.test(n.html) && /Smith \(2020\)/.test(n.html), 'narrative citation: ' + n.html);
  });
  app.tests.register('fixes: raw HTML cannot replace document.createElement', () => {
    const r = app.mk.render('<img name="createElement" src="x.png"> <form name="querySelector"></form>\n');
    const box = document.createElement('div'); box.innerHTML = r.html; document.body.appendChild(box);
    try { A(typeof document.createElement === 'function' && typeof document.querySelector === 'function', 'document methods intact'); }
    finally { box.remove(); }
  });
  app.tests.register('fixes: flavor detection is not fooled by money, code or prose tags', () => {
    const f = s => app.mk.detectFlavor(s).name;
    A(!/LaTeX/.test(f('It costs $5 and then $10.')), 'money: ' + f('It costs $5 and then $10.'));
    A(!/LaTeX/.test(f('Run `echo $HOME and $PATH` now.')), 'code: ' + f('Run `echo $HOME and $PATH` now.'));
    A(/Pandoc/.test(f('Text^[note]')) && /Pandoc/.test(f('# A {#sec:intro}\n')), 'Pandoc notes and labels');
    A(f('Click <Button> now.') !== 'MDX', 'a tag in prose is not MDX');
  });
  app.tests.register('fixes: Pandoc exports get callouts as quotes, diagrams as pictures and the math macros', async () => {
    const d = app.docs.create({ title: 'Export fixes', text: "---\nmath-macros: '\\newcommand{\\vect}[1]{\\mathbf{#1}}'\n---\n\n> [!NOTE]\n> Careful.\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\nVector $\\vect{v}$.\n" });
    try {
      const md = await app.exporter.exportMarkdown(d, 'docx');
      A(!/\[!NOTE\]/.test(md) && /> \*\*Note\*\*/.test(md), 'callout title: ' + md);
      A(!/```mermaid/.test(md) && /!\[\]\(data:image\/(png|svg\+xml);base64,/.test(md), 'diagram picture');
      A(/\\newcommand\{\\vect\}\[1\]\{\\mathbf\{#1\}\}/.test(md), 'macro definitions: ' + md.slice(0, 200));
    } finally { await app.docs.close(d.id, { force: true }); }
  });
  app.tests.register('fixes: error text has no Electron prefixes', () => {
    A(app.ui.plainError(new Error("Error invoking remote method 'write-text': Error: The disk is full.")) === 'The disk is full.', app.ui.plainError(new Error("Error invoking remote method 'write-text': Error: The disk is full.")));
  });
  app.tests.register('fixes: Save does not overwrite a file that changed on disk without asking', async () => {
    const info = await app.mk.invoke('app-info');
    const p = info.userData.replace(/[\\/]+$/, '') + (info.userData.includes('\\') ? '\\' : '/') + 'conflict-test.md';
    const m1 = await app.mk.invoke('write-text', p, 'one\n');
    const d = app.docs.create({ path: p, text: 'one\n', title: 'conflict-test' }); d.mtime = m1;
    try {
      await sleep(30); await app.mk.invoke('write-text', p, 'changed elsewhere\n');
      d.setText('mine\n', 'test');
      const saving = app.docs.save(d);
      let btn = null; for (let i = 0; i < 40 && !btn; i++) { await sleep(50); btn = [...document.querySelectorAll('.dlg.show .btn, #dialogLayer .dlg .btn')].find(b => /^Cancel$/.test(b.textContent.trim())); }
      A(btn, 'the "changed on disk" question is asked');
      btn.click();
      A((await saving) === false, 'not saved');
      A((await app.mk.invoke('read-text', p)) === 'changed elsewhere\n', 'the other change is kept on disk');
    } finally { await app.docs.close(d.id, { force: true }); }
  });

  // ---------- round 3 seams (writing ↔ languages, keys, ribbon, exporter, status bar) ----------
  app.tests.register('round3: language pack rules (replace/why) reach the Writing Assistant with a fix and a Why', async () => {
    if (typeof app.writing?.registerLanguage !== 'function') throw new Error('app.writing is missing');
    // the shape language packs (markooj-language-packs, tools/pack.js) write into rules.json
    const rules = [{ id: 'farsi-yeh', category: 'correctness', pattern: 'ي', flags: 'g', replace: 'ی', message: 'Use the Persian/Urdu letter ی', why: 'Urdu and Persian write yeh as ی.', wrong: 'علي', right: 'علی' },
      { id: 'arabic-comma', category: 'punctuation', pattern: '([\\u0600-\\u06FF])[ \\t]*,(?=[ \\t]|$)', flags: 'g', replace: '$1،', message: 'Use the Arabic-script comma ،', why: 'After Arabic script the comma is ،.', wrong: 'کتاب, قلم', right: 'کتاب، قلم' }];
    app.writing.registerLanguage({ code: 'xq', name: 'Test RTL', nativeName: 'Test', dir: 'rtl', aff: undefined, dic: undefined, rules, font: 'Vazirmatn' });
    try {
      A(app.writing.languages().some(l => l.code === 'xq' && l.dir === 'rtl' && l.rules === 2), 'registered: ' + JSON.stringify(app.writing.languages().find(l => l.code === 'xq')));
      const found = await app.writing.checkText('علي و کتاب, قلم\n', { lang: 'xq', harper: false });
      const yeh = found.find(f => f.rule === 'lang:farsi-yeh'), comma = found.find(f => f.rule === 'lang:arabic-comma');
      A(yeh && yeh.replacements[0] === 'ی', 'yeh fix: ' + JSON.stringify(yeh));
      A(comma && comma.replacements[0] === 'ب،' && comma.cat === 'correctness', 'comma fix and category: ' + JSON.stringify(comma));
      const why = app.writing.explain(yeh);
      A(/yeh/.test(why.text) && why.wrong === 'علي' && why.right === 'علی', 'Why? text: ' + JSON.stringify(why));
    } finally { app.writing.unregisterLanguage('xq'); }
    A(!app.writing.languages().some(l => l.code === 'xq'), 'unregistered');
  });
  app.tests.register('round3: Urdu, Arabic and Persian words in an English document are not marked as misspelled', async () => {
    const text = 'An English paragraph with a mispeled word.\n\nیہ اردو کا ایک پیراگراف ہے۔\n\nهذه فقرة باللغة العربية.\n\nاین یک پاراگراف فارسی است.\n';
    const found = (await app.writing.checkText(text, { lang: 'en-US', harper: false })).filter(f => f.rule === 'spelling');
    A(found.some(f => f.text === 'mispeled'), 'the English typo is still found');
    A(!found.some(f => /[؀-ۿ]/.test(f.text)), 'no Arabic-script word is flagged: ' + found.map(f => f.text).join(', '));
    A(app.writing.isWordCorrect('اردو', app.writing.languageFor({ meta: { lang: 'en-US' } })), 'right-click check agrees');
  });
  app.tests.register('round3: Change Case in Word mode reaches the Markdown and keeps the selection', async () => {
    const m0 = app.mode;
    const d = app.docs.create({ text: 'make this loud\n', title: 'case-word' });
    try {
      app.docs.activate(d.id); app.setMode('word');
      await until(() => [...document.querySelectorAll('#editorHost .mk-page p')].some(p => /make this loud/.test(p.textContent)), 4000);
      const p = [...document.querySelectorAll('#editorHost .mk-page p')].find(x => /make this loud/.test(x.textContent));
      A(p, 'paragraph on the page');
      const t = p.firstChild, i = t.data.indexOf('this');
      document.querySelector('#editorHost .mk-page').focus();
      const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 4); getSelection().removeAllRanges(); getSelection().addRange(r);
      await app.commands.run('edit.case.upper');
      A(getSelection().toString() === 'THIS', 'the changed text stays selected: ' + JSON.stringify(getSelection().toString()));
      A(await until(() => d.text === 'make THIS loud\n', 2000), 'Markdown updated: ' + JSON.stringify(d.text));
    } finally { await app.docs.close(d.id, { force: true }); app.setMode(m0); }
  });
  app.tests.register('round3: Right-to-left works on a paragraph just typed in Word mode, with the ribbon focused', async () => {
    const m0 = app.mode;
    const d = app.docs.create({ text: 'First line.\n', title: 'rtl-typed' });
    try {
      app.docs.activate(d.id); app.setMode('word');
      await until(() => [...document.querySelectorAll('#editorHost .mk-page p')].some(p => /First line/.test(p.textContent)), 4000);
      const page = document.querySelector('#editorHost .mk-page'); page.focus();
      const p = [...page.querySelectorAll('p')].find(x => /First line/.test(x.textContent));
      const r = document.createRange(); r.selectNodeContents(p); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r);
      document.execCommand('insertParagraph'); document.execCommand('insertText', false, 'Typed just now.');
      await sleep(50);
      document.querySelector('[data-tip-cmd="para.rtl"], .rtab[data-tab="home"]')?.focus(); // a ribbon control has the focus, as after a click
      await app.commands.run('para.rtl');
      A(await until(() => /::: \{dir="rtl"\}\nTyped just now\.\n:::/.test(d.text), 2000), 'wrapped in an rtl div: ' + JSON.stringify(d.text));
      A(/^First line\.\n/.test(d.text), 'the first paragraph is untouched: ' + JSON.stringify(d.text));
    } finally { await app.docs.close(d.id, { force: true }); app.setMode(m0); }
  });
  app.tests.register('round3: a new document starts at the top; going back keeps the old position', async () => {
    const host = document.getElementById('editorHost');
    const a = app.docs.create({ text: Array.from({ length: 60 }, (_, i) => `Paragraph ${i + 1} with some words to fill the line.`).join('\n\n') + '\n', title: 'scroll-a' });
    let b = null;
    try {
      app.docs.activate(a.id); await sleep(900);
      host.scrollTop = 600; await sleep(100); const was = host.scrollTop;
      A(was > 300, 'the long document scrolls: ' + was);
      b = app.docs.create({ text: 'Short.\n', title: 'scroll-b' }); app.docs.activate(b.id); await sleep(900);
      A(host.scrollTop === 0, 'the new document is at the top: ' + host.scrollTop);
      app.docs.activate(a.id); await sleep(900);
      A(Math.abs(host.scrollTop - was) < 40, `back where it was: ${was} → ${host.scrollTop}`);
    } finally { if (b) await app.docs.close(b.id, { force: true }); await app.docs.close(a.id, { force: true }); }
  });
  app.tests.register('round3: Word keys reach the new modules and every key does one thing', () => {
    A(app.keys && typeof app.keys.list === 'function', 'app.keys');
    const map = Object.fromEntries(app.keys.wordMap().map(r => [r.key, r.id]));
    A(map.F7 === 'review.spelling', 'F7 → ' + map.F7);
    A(/thesaurus/.test(map['Shift+F7'] || ''), 'Shift+F7 → ' + map['Shift+F7']);
    A(map['Ctrl+]'] === 'format.growFont' && map['Ctrl+M'] === 'para.indent', 'grow font and indent keys');
    const c = app.keys.conflicts(); A(!c.length, 'conflicts: ' + JSON.stringify(c));
    const rows = app.keys.list();
    const rtl = rows.find(r => r.id === 'para.rtl'), ltr = rows.find(r => r.id === 'para.ltr');
    A(rtl && rtl.keys.includes('Ctrl+Right Shift') && ltr && ltr.keys.includes('Ctrl+Left Shift'), 'direction keys listed');
    for (const id of ['writing.nextIssue', 'writing.prevIssue', 'review.thesaurus']) A(rows.some(r => r.id === id), id + ' is in the keyboard list');
  });
  app.tests.register('round3: contextual table tabs, status bar language and exporter refresh are wired', async () => {
    A(typeof app.ribbon.showContextual === 'function' && typeof app.ribbon.isContextualShown === 'function', 'contextual tab API');
    const tabs = app.ribbon.tabs();
    for (const id of ['tableDesign', 'tableLayout']) A(tabs.some(t => t.id === id && t.contextual), id + ' is a contextual tab');
    A(typeof app.exporter.refreshFormats === 'function', 'exporter.refreshFormats');
    const d = app.docs.create({ text: '---\nlang: fa\n---\n\nسلام دنیا\n', title: 'lang-status' });
    try {
      app.docs.activate(d.id); app.status.refresh();
      await until(() => /فارسی|Persian/.test(document.querySelector('#sbLang span')?.textContent || ''), 2000);
      const label = document.querySelector('#sbLang span').textContent;
      A(label === app.lang.nameOf('fa'), 'status bar names the language: ' + label);
    } finally { await app.docs.close(d.id, { force: true }); }
  });

  // ---------------------------------------------------------------- Help, tutorials and the manual agree (PLAN-v3 38, 42)
  app.tests.register('round3: Help tab, F1, Ctrl+/ and the manual’s tutorials page agree with the app', async () => {
    A(app.ribbon.tabs().some(t => t.id === 'help'), 'Help ribbon tab');
    for (const id of ['help.manual', 'help.tutorials', 'help.shortcuts', 'help.whatsNew', 'help.reportProblem', 'help.about']) A(app.commands.get(id), id + ' registered');
    const f1 = (app.keys?.list?.() || []).find(k => [].concat(k.keys || []).some(x => /^F1$/i.test(String(x))));
    A(f1 && f1.id === 'help.manual', 'F1 opens the manual: ' + (f1 && f1.id));
    // the old short shortcuts list now hands over to Help → Keyboard Shortcuts
    try {
      Promise.resolve(app.commands.run('app.shortcuts')).catch(() => {}); // resolves when the dialog closes
      A(await until(() => document.querySelector('.dlg.show .mkh-keys'), 4000), 'Ctrl+/ opens Help → Keyboard Shortcuts');
    } finally {
      await sleep(200);
      const dlg = [...document.querySelectorAll('.dlg.show')].pop();
      const ok = dlg && [...dlg.querySelectorAll('.dlg-foot .btn')].find(b => /^(OK|Done|Close)$/.test(b.textContent.trim()));
      if (ok) ok.click(); else dlg?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(320);
    }
    // every tutorial in the app has a section in docs/help/tutorials.md, and every section names a tutorial
    const md = await (await fetch('../docs/help/tutorials.md')).text();
    const heads = [...md.matchAll(/^## (.+?)\s*$/gm)].map(m => m[1].trim());
    const titles = (app.tours?.list?.() || []).filter(t => !/^test/.test(t.id)).map(t => t.title);
    A(titles.length >= 14, 'tutorials registered: ' + titles.length);
    for (const t of titles) A(heads.includes(t), 'docs/help/tutorials.md has a section for “' + t + '”');
    for (const hd of heads) A(titles.includes(hd), 'tutorial named in the manual exists: “' + hd + '”');
  });

  // ---------------------------------------------------------------- fixes routed from the docs and images reports
  app.tests.register('round3: routed fixes (version, outline {-}, citations count, BibTeX accents, goals history, Basically card)', async () => {
    const info = await mk.invoke('app-info');
    A(app.version === info.version, 'app.version comes from package.json: ' + app.version + ' / ' + info.version);
    // outline: {-} and {.unnumbered} are attributes, not text
    const hs = app.shell.parseHeadings('# References {-}\n\n## Appendix {.unnumbered}\n\n## Methods {#sec:m}\n');
    A(hs.map(x => x.text).join('|') === 'References|Appendix|Methods', 'outline text: ' + hs.map(x => x.text).join('|'));
    // narrative citations count when the document names a library
    const st = app.shell.docStats('---\nbibliography: refs.bib\n---\n\nAs @smith2020 showed, and [@jones2019; @lee2021]. See @eq:x and mail a@b.org.\n');
    A(st.citations === 3 && st.sources === 3, 'citations ' + st.citations + ', sources ' + st.sources);
    // BibTeX accents
    const bib = mk.parseBib('@article{m1948,\n  author = {Meyer-Peter, E. and M{\\"u}ller, R. and Sch\\"{o}n, A.},\n  title = {Formulas for {Bed-Load} Transport},\n  pages = {39--64},\n  year = {1948}\n}\n');
    A(bib.m1948 && bib.m1948.author === 'Meyer-Peter, E. and Müller, R. and Schön, A.' && bib.m1948.pages === '39–64', 'BibTeX accents: ' + JSON.stringify(bib.m1948));
    // goals: history saved earlier is read back after settings load, and is not erased by the next save
    if (app.goals) {
      const saved = { log: app.settings.get('writingLog', {}), met: app.settings.get('writingMet', {}) };
      try {
        const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
        app.settings.set('writingLog', { [day(1)]: 600, [day(2)]: 700 });
        app.settings.set('writingMet', { [day(1)]: 1, [day(2)]: 1 });
        A(app.goals.streak() >= 2, 'streak reads the saved history: ' + app.goals.streak());
      } finally { app.settings.set('writingLog', saved.log); app.settings.set('writingMet', saved.met); }
    }
    // the intensifier card at a sentence start shows the whole next word
    if (app.writing?.checkText) {
      const fs = await app.writing.checkText('Basically the flow rises fast.', { harper: false, spelling: false });
      const f = fs.find(x => x.rule === 'intensifier');
      A(f && f.text === 'Basically the' && f.replacements[0] === 'The', 'intensifier fix: ' + JSON.stringify(f && { text: f.text, rep: f.replacements }));
    }
  });
})();
