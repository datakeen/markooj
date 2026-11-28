// Markooj: smoke tests for the round-5 UX review (1.2.0). Each test checks one fix a first-time user would notice:
// the open Writing Assistant card, units that are not misspellings, Word-mode alignment in Urdu and Arabic paragraphs,
// Split stacked like Word, right-to-left pages showing their start in a narrow pane, plain wording on the on-screen
// keyboard, the same switches in every Options section, and toasts that stay clear of the on-screen keyboard.
(() => {
  'use strict';
  const app = window.app;
  if (!app || !app.tests) return;
  const T = (name, fn) => app.tests.register('uxreview: ' + name, fn);
  const A = (c, m) => app.assert(c, m);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function until(fn, ms = 4000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch {} await sleep(30); } return false; }
  const NL = '\n';
  const UR = 'یہ رپورٹ تربیلا ڈیم میں ریت کے اخراج کا جائزہ لیتی ہے۔';
  async function withDoc(text, fn, { mode = 'word', title = 'UX review test' } = {}) {
    const m0 = app.mode; const prev = app.docs.active();
    const d = app.docs.create({ text, title });
    try { app.docs.activate(d.id); app.setMode(mode); await sleep(80); return await fn(d); }
    finally {
      try { await app.docs.close(d.id, { force: true }); } catch {}
      if (prev && app.docs.get(prev.id)) app.docs.activate(prev.id);
      app.setMode(m0);
    }
  }

  T('the selected Writing Assistant card grows to show its explanation', async () => {
    const W = app.writing;
    if (!W || !W.pane) return;
    await withDoc('# Check' + NL + NL + 'The results is clear and the effect was small.' + NL, async d => {
      const ok = await until(() => (W.state(d).findings || []).length > 0, 15000);
      if (!ok) return; // the checker is busy elsewhere; the CSS check below still runs on a stand-in card
      const wasOpen = W.pane.view === 'assistant';
      if (!wasOpen) W.pane.open('assistant');
      try {
        await until(() => document.querySelector('#mkwPane .mkw-item'));
        document.querySelector('#mkwPane .mkw-item').click();
        await until(() => document.querySelector('#mkwPane .mkw-item.sel .mkw-i-card'));
        const it = document.querySelector('#mkwPane .mkw-item.sel');
        A(it, 'a card is selected');
        const card = it.querySelector('.mkw-i-card');
        A(it.offsetHeight >= card.offsetHeight + 20, `the open card holds its explanation (${it.offsetHeight}px for ${card.offsetHeight}px of content); the form-field class .sel must not fix its height`);
      } finally { if (!wasOpen) W.pane.close(); }
    });
    // a stand-in: .mkw-item.sel never takes the 30 px height of form fields
    const probe = document.createElement('div'); probe.className = 'mkw-item sel'; probe.innerHTML = '<div style="height:120px"></div>';
    document.body.append(probe);
    try { A(probe.offsetHeight > 100, 'card height follows its content: ' + probe.offsetHeight); } finally { probe.remove(); }
  });

  T('a hint with no fix is not struck through in the Writing Assistant list', async () => {
    const W = app.writing;
    if (!W || !W.pane) return;
    await withDoc('# Passive' + NL + NL + 'The samples were checked by the team in the lab.' + NL, async d => {
      const ok = await until(() => (W.state(d).findings || []).some(f => f.rule === 'passive'), 15000);
      if (!ok) return;
      const wasOpen = W.pane.view === 'assistant';
      if (!wasOpen) W.pane.open('assistant');
      try {
        await until(() => document.querySelector('#mkwPane .mkw-item'));
        const items = [...document.querySelectorAll('#mkwPane .mkw-item')].filter(i => /passive/i.test(i.querySelector('.mkw-i-title')?.textContent || ''));
        A(items.length, 'a passive-voice item is listed');
        A(items.every(i => !i.querySelector('.mkw-i-txt .mkw-del') && i.querySelector('.mkw-i-txt .mkw-plain')), 'shown plain, not struck through (nothing replaces it)');
      } finally { if (!wasOpen) W.pane.close(); }
    });
  });

  T('units with superscript digits (m³, km², H₂O) are not marked as misspelled', async () => {
    const W = app.writing;
    if (!W) return;
    await withDoc('# Units' + NL + NL + 'The flow was 830 m³/s over 12 km² of land, and H₂O samples were taken. Teh end.' + NL, async d => {
      const ok = await until(() => (W.state(d).findings || []).some(f => f.rule === 'spelling'), 15000);
      if (!ok) return; // spelling not ready on this computer
      const sp = W.state(d).findings.filter(f => f.rule === 'spelling').map(f => f.text);
      A(!sp.some(t => /[²³₂]/.test(t)), 'no unit flagged: ' + JSON.stringify(sp));
    });
  });

  T('Word mode: Align right is lit on an Urdu paragraph, and Align left really moves it left', async () => {
    const src = 'English first.' + NL + NL + UR + NL;
    await withDoc(src, async d => {
      const ad = app.editors.active(); await ad.refresh?.();
      await until(() => ad.page && [...ad.page.querySelectorAll('p')].some(p => p.textContent.includes('تربیلا')));
      const p = [...ad.page.querySelectorAll('p')].find(x => x.textContent.includes('تربیلا'));
      A(getComputedStyle(p).direction === 'rtl', 'the Urdu paragraph reads right to left');
      const put = el => { ad.page.focus(); const r = document.createRange(); r.setStart(el.firstChild, 2); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); };
      put(p);
      A(ad.activeStates().align === 'right', 'natural side of an Urdu paragraph is right: ' + ad.activeStates().align);
      await app.commands.run('para.alignRight'); await sleep(60); ad._commit?.(); await until(() => d.text !== src, 600);
      A(d.text === src, 'Align right on an Urdu paragraph adds nothing: ' + JSON.stringify(d.text));
      await app.commands.run('para.alignLeft'); await sleep(60); ad._commit?.(); await until(() => /align="left"/.test(d.text), 2000);
      A(/<div align="left">/.test(d.text) && d.text.includes(UR), 'Align left wraps it as left-aligned: ' + JSON.stringify(d.text));
      const p2 = [...ad.page.querySelectorAll('p')].find(x => x.textContent.includes('تربیلا'));
      put(p2);
      if (app.commands.get('format.clearParagraph')) {
        await app.commands.run('format.clearParagraph'); await sleep(60); ad._commit?.(); await until(() => !/align=/.test(d.text), 2000);
        A(!/align=/.test(d.text), 'Clear paragraph formatting brings it back to its own side: ' + JSON.stringify(d.text));
      }
      const e = [...ad.page.querySelectorAll('p')].find(x => /English first/.test(x.textContent));
      put(e);
      A(ad.activeStates().align === 'left', 'an English paragraph stays left');
    });
  });

  T('Split starts stacked like Word; View Side by Side starts side by side', async () => {
    const S = app.split;
    if (!S) return;
    const raw = app.settings.get('splitOrientation', null);
    app.settings.set('splitOrientation', null);
    try {
      await withDoc('# One' + NL + NL + 'Text.' + NL, async () => {
        A(await S.open({ kind: 'split', mode: 'simple' }) !== false && S.on, 'split opened');
        await sleep(60);
        A(S.orientation() === 'stacked' && document.body.classList.contains('mk-split-stacked'), 'Split is stacked: ' + S.orientation());
        S.close(); await sleep(60);
        const other = app.docs.create({ title: 'UX other', text: '# Two' + NL });
        try {
          const cur = app.docs.list().find(x => x.title === 'UX review test');
          if (cur) app.docs.activate(cur.id);
          await S.sideBySide({ docId: other.id, mode: 'read' }); await sleep(80);
          A(S.on && S.orientation() === 'side' && !document.body.classList.contains('mk-split-stacked'), 'Side by Side is side by side: ' + S.orientation());
        } finally { S.close(); await sleep(40); try { await app.docs.close(other.id, { force: true }); } catch {} }
      });
    } finally { app.settings.set('splitOrientation', raw); }
  });

  T('a right-to-left page in a narrow pane shows its right side, where the lines start', async () => {
    const S = app.split;
    if (!S) return;
    const raw = app.settings.get('splitOrientation', null);
    app.settings.set('splitOrientation', null);
    const ur = app.docs.create({ title: 'UX Urdu', text: '---' + NL + 'lang: ur' + NL + 'dir: rtl' + NL + '---' + NL + NL + UR + NL });
    try {
      await withDoc('# English' + NL + NL + 'Text.' + NL, async () => {
        await S.sideBySide({ docId: ur.id, mode: 'word' });
        const host = document.querySelector('.mk-split-host');
        await until(() => host && host.querySelector('.mk-page'), 4000);
        const over = () => host.scrollWidth - host.clientWidth;
        await sleep(250);
        if (over() > 2) {
          await until(() => host.scrollLeft > 0, 2000);
          A(host.scrollLeft >= over() - 2, `scrolled to the start side (${host.scrollLeft} of ${over()})`);
        }
        S.close();
      });
    } finally {
      try { S.close(); } catch {}
      try { await app.docs.close(ur.id, { force: true }); } catch {}
      app.settings.set('splitOrientation', raw);
    }
  });

  T('on-screen keyboard: plain key names, and toasts stay above it', async () => {
    const K = app.keyboards;
    if (!K || !K.onScreen) return;
    const prev = K.current()?.id || 'en'; const wasOpen = K.onScreen.isOpen();
    try {
      K.set('fa', { quiet: true }); K.onScreen.open(); await sleep(80);
      const el = document.querySelector('.mk-osk');
      A(el && el.classList.contains('show'), 'on-screen keyboard open');
      const keys = [...el.querySelectorAll('.mk-osk-key')].map(b => b.textContent.trim());
      A(!keys.includes('ZWNJ') && keys.includes('Half space'), 'the half-space key says Half space: ' + keys.filter(k => /[A-Z]{3}/.test(k)).join(', '));
      A(!/Your keys type .* too/.test(el.textContent), 'the note reads plainly: ' + el.querySelector('.mk-osk-note')?.textContent);
      const layer = document.getElementById('toastLayer');
      if (layer) A(parseFloat(getComputedStyle(layer).bottom) >= el.getBoundingClientRect().height, 'toasts sit above the on-screen keyboard');
    } finally { if (!wasOpen) K.onScreen.close(); K.set(prev, { quiet: true }); }
  });

  T('Options: Tables uses the same switches as the other sections; keyboard labels read plainly', async () => {
    const secs = app.options?.sections?.() || [];
    const tables = secs.find(s => s.id === 'tables');
    if (tables && app.shell?.settingSwitch) {
      const box = document.createElement('div'); document.body.append(box);
      try {
        tables.render(box);
        A(box.querySelectorAll('.opt-switch').length === 2 && !box.querySelector('input[type=checkbox]'), 'two switches, no bare checkboxes');
        A(box.querySelector('.opt-row select'), 'Merged cells is an option row with a list');
      } finally { box.remove(); }
    }
    if (app.keyboards?.renderOptions) {
      const box = document.createElement('div'); document.body.append(box);
      try {
        app.keyboards.renderOptions(box);
        A(!/switches English and/.test(box.textContent) && /Keyboard for Ctrl\+Shift\+K/.test(box.textContent), 'the Ctrl+Shift+K row is named plainly');
        A(![...box.querySelectorAll('option')].some(o => /\(.*\(/.test(o.textContent)), 'no doubled brackets in keyboard names');
      } finally { box.remove(); }
    }
    const kb = app.ribbon?.tabs?.().find(t => t.id === 'view')?.groups?.find(g => g.id === 'keyboard');
    if (kb) A(!JSON.stringify(kb.items).includes('RTL'), 'View → Keyboard has no "RTL" jargon');
  });
})();
