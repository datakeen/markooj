// Markooj — make writing fun (PLAN-v3 item 41): writing goals with a progress ring, sprint timer, daily streak,
// a soft celebration when a goal is reached, and Typewriter scrolling. Focus mode already lives in shell.js (view.focus).
// Owner: developer. Public API: app.goals (see the bottom of this file).
(function () {
  'use strict';
  const app = window.app;
  if (!app) return;
  const mk = app.mk || window.mk || {};
  const settings = app.settings;
  const toast = (m, o) => { try { app.ui.toast(m, o); } catch { console.log('[toast]', m); } };
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const raf = fn => requestAnimationFrame(fn);
  const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }

  // ---------------------------------------------------------------- icons
  const ICONS = {
    'mkg-target': '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    'mkg-timer': '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M10 2.5h4M18.5 6.5l1.5-1.5"/>',
    'mkg-typewriter': '<rect x="3" y="10" width="18" height="10" rx="2"/><path d="M7 10V5h10v5M7 14h.01M10.5 14h.01M14 14h.01M17 14h.01M8 17h8"/>',
    'mkg-flame': '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.1 0-3.4 2.6-5.3 3.6-8.4.4 1.9 1.6 3 2.6 3.5 0-2.6 1.1-5 3.3-6.5-.2 2.9 3.5 5.4 3.5 10 0 4.1-2.7 7.5-6.5 7.5z"/>',
  };
  function injectIcons() {
    if (document.getElementById('mkg-icons')) return;
    const defs = Object.entries(ICONS).map(([id, p]) => `<symbol id="${id}" viewBox="0 0 24 24">${p}</symbol>`).join('');
    const wrap = document.createElement('div');
    wrap.innerHTML = `<svg id="mkg-icons" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${defs}</defs></svg>`;
    document.body.prepend(wrap.firstChild);
  }
  const icon = (name, cls = 'i') => `<svg class="${cls}" aria-hidden="true"><use href="#${name}"/></svg>`;
  const flame = (size = 12) => `<svg class="mkg-flame" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${ICONS['mkg-flame'].match(/d="([^"]+)"/)[1]}"/></svg>`;
  if (document.body) injectIcons(); else document.addEventListener('DOMContentLoaded', injectIcons, { once: true });

  // ---------------------------------------------------------------- dates, counting, targets
  const pad = n => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function wordsOf(text) {
    try { const s = app.shell?.docStats?.(String(text || '')); if (s && Number.isFinite(s.words)) return s.words; } catch {}
    const body = String(text || '').replace(/^﻿?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/, '');
    return (body.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) || []).length;
  }
  function metaOf(doc) {
    try { if (app.shell?.docMeta) return app.shell.docMeta(doc) || {}; } catch {}
    try { return mk.frontMatter?.parse?.(doc.text || '').meta || doc.meta || {}; } catch { return doc.meta || {}; }
  }
  function docTarget(doc) {
    if (!doc || doc.kind !== 'markdown') return 0;
    const m = metaOf(doc);
    const n = parseInt(String(m['word-target'] ?? m.wordtarget ?? m.word_target ?? '').replace(/[,\s]/g, ''), 10);
    return n > 0 ? n : 0;
  }
  const sprintLen = () => { const m = Number(settings.get('sprintMinutes', 25)); return [15, 25, 45].includes(m) ? m : 25; };
  const dailyGoal = () => { const n = Number(settings.get('dailyWordGoal', 0)); return Number.isFinite(n) && n > 0 ? Math.round(n) : 0; };

  // ---------------------------------------------------------------- the writing log (words written per day, net)
  let log = { ...(settings.get('writingLog', {}) || {}) };
  let met = { ...(settings.get('writingMet', {}) || {}) };
  let saveTimer = 0;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const keep = Object.keys(log).sort().slice(-400);
      log = Object.fromEntries(keep.map(k => [k, log[k]]));
      const keepMet = Object.keys(met).sort().slice(-400);
      met = Object.fromEntries(keepMet.map(k => [k, 1]));
      settings.set('writingLog', log); settings.set('writingMet', met);
    }, 1500);
  }
  // This script runs before app.settings.load() finishes, so the saved log is merged in again once settings are
  // loaded (and whenever something else replaces it); otherwise the streak looks empty and persist() would erase history.
  function mergeSaved() {
    const savedLog = settings.get('writingLog', {}) || {}, savedMet = settings.get('writingMet', {}) || {};
    if (savedLog !== log) for (const [k, v] of Object.entries(savedLog)) if (!(k in log)) log[k] = v;
    if (savedMet !== met) for (const k of Object.keys(savedMet)) met[k] = 1;
  }
  app.events.on('settings:changed', ({ key, value } = {}) => {
    if (key === 'writingLog' && value && value !== log) { log = { ...value }; }
    else if (key === 'writingMet' && value && value !== met) { met = { ...value }; }
  });
  const today = () => log[dayKey()] || 0;
  function streak() {
    const d = new Date(); let n = 0;
    if (!met[dayKey(d)]) d.setDate(d.getDate() - 1); // today not done yet: the streak is still alive
    while (met[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // ---------------------------------------------------------------- tracking changes
  // Writing = the net change in words from edits. Opening, loading, recovery, front-matter edits and huge jumps
  // (pasting or replacing a whole document) are not counted.
  const IGNORE = new Set(['open', 'load', 'recovery', 'revert', 'reload', 'meta', 'mathMacros', 'save', 'external', 'disk', 'convert']);
  const BIG_JUMP = 1500;
  const counts = new Map(); // doc id → last word count
  const pending = new Map(); // doc id → {timer, skip}
  function baseline(doc) { if (doc && doc.kind === 'markdown' && !counts.has(doc.id)) counts.set(doc.id, wordsOf(doc.text)); }
  function measure(doc, skip) {
    const p = pending.get(doc.id); if (p) { clearTimeout(p.timer); pending.delete(doc.id); skip = skip || p.skip; }
    const n = wordsOf(doc.text), prev = counts.get(doc.id);
    counts.set(doc.id, n);
    const before = { doc: prev, docTarget: docTarget(doc) };
    if (prev == null || skip) { checkDocGoal(doc, prev ?? n, n); paint(); return 0; }
    const delta = n - prev;
    if (delta && Math.abs(delta) <= BIG_JUMP) addWritten(delta);
    checkDocGoal(doc, before.doc, n);
    paint();
    return delta;
  }
  function addWritten(delta) {
    const k = dayKey(), was = log[k] || 0;
    log[k] = Math.max(0, was + delta);
    if (sprint) sprint.words += delta;
    const goal = dailyGoal();
    if (log[k] >= Math.max(1, goal) && !met[k]) {
      met[k] = 1;
      if (goal && was < goal) celebrate({ kind: 'daily', title: 'Daily goal reached', text: `${fmt(log[k])} words today${streak() > 1 ? ` · ${streak()}-day streak` : ''}. Well done.` });
    }
    persist();
  }
  function celebratedKey(doc, target) { return `${doc.path || doc.id}|${target}`; }
  function checkDocGoal(doc, prev, now) {
    const t = docTarget(doc); if (!t || prev == null) return;
    if (prev < t && now >= t) {
      const done = { ...(settings.get('goalsCelebrated', {}) || {}) }, key = celebratedKey(doc, t);
      if (done[key] === dayKey()) return;
      done[key] = dayKey();
      const keys = Object.keys(done); if (keys.length > 200) delete done[keys[0]];
      settings.set('goalsCelebrated', done);
      celebrate({ kind: 'doc', title: 'Word target reached', text: `“${doc.title}” has ${fmt(now)} words. You hit your ${fmt(t)}-word target.` });
    }
  }
  app.events.on('doc:opened', d => baseline(d));
  app.events.on('doc:active', d => { baseline(d); paint(); });
  app.events.on('doc:closed', d => { if (d) { counts.delete(d.id); const p = pending.get(d.id); if (p) clearTimeout(p.timer); pending.delete(d.id); } paint(); });
  app.events.on('doc:changed', ({ doc, origin } = {}) => {
    if (!doc || doc.kind !== 'markdown') return;
    if (!counts.has(doc.id)) { counts.set(doc.id, wordsOf(doc.savedText ?? '')); }
    const p = pending.get(doc.id) || { timer: 0, skip: false };
    clearTimeout(p.timer);
    p.skip = p.skip || IGNORE.has(origin) || /^test/.test(origin || '');
    p.timer = setTimeout(() => measure(doc), 700);
    pending.set(doc.id, p);
  });
  app.events.on('settings:changed', ({ key } = {}) => { if (/^(dailyWordGoal|goalsStatus|goalsCelebrate)$/.test(key || '')) paint(); });

  // ---------------------------------------------------------------- progress ring
  function ring(pct, { size = 16, stroke = 2.4, label = '' } = {}) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct || 0));
    return `<svg class="mkg-ring${p >= 1 ? ' done' : ''}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="trk" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
      <circle class="val" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p)).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      ${label ? `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle">${label}</text>` : ''}</svg>`;
  }
  /** what the ring shows: the document target if there is one, otherwise today's goal */
  function progress(doc = app.docs.active()) {
    const t = docTarget(doc);
    if (t) { const w = counts.get(doc.id) ?? wordsOf(doc.text); return { kind: 'doc', words: w, target: t, pct: w / t }; }
    const g = dailyGoal();
    if (g) return { kind: 'daily', words: today(), target: g, pct: today() / g };
    return { kind: 'none', words: today(), target: 0, pct: 0 };
  }

  // ---------------------------------------------------------------- status bar
  let statusEl = null;
  let sprint = null, sprintTick = 0; // declared before the status item renders (it reads `sprint`)
  app.status.addItem({ id: 'goals', side: 'left', order: 20, render(el) { statusEl = el; paintStatus(); } });
  function paintStatus() {
    const el = statusEl; if (!el) return;
    const show = settings.get('goalsStatus', true) !== false || !!sprint;
    el.textContent = ''; el.style.display = show ? '' : 'none';
    if (!show) return;
    const pr = progress();
    const tip = pr.kind === 'doc' ? `${fmt(pr.words)} of ${fmt(pr.target)} words (${Math.round(pr.pct * 100)}%)`
      : pr.kind === 'daily' ? `${fmt(pr.words)} of ${fmt(pr.target)} words today` : `${fmt(pr.words)} words written today`;
    const st = streak();
    const b = h('button', { class: 'sb mkg-sb', type: 'button', 'data-tip': 'Writing goals', 'data-tip-d': `${tip}${st ? ` · ${st}-day streak` : ''}. Click to set goals or start a sprint.`, 'aria-label': 'Writing goals: ' + tip,
      'data-pct': String(Math.round(pr.pct * 100)), 'data-kind': pr.kind, html: ring(pr.pct) });
    if (pr.kind !== 'none') b.append(h('span', { class: 'mkg-sb-t' }, pr.kind === 'doc' ? `${Math.min(999, Math.round(pr.pct * 100))}%` : `${fmt(pr.words)}/${fmt(pr.target)}`));
    if (st > 1 && !sprint) b.append(h('span', { class: 'mkg-streak', html: `${flame(12)}<span>${st}</span>` }));
    b.addEventListener('click', () => openPanel(b));
    el.append(b);
    if (sprint) {
      const left = Math.max(0, sprint.end - Date.now()), m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
      const sp = h('button', { class: 'sb mkg-sprint', type: 'button', 'data-tip': 'Sprint', 'data-tip-d': 'Time left and words written in this sprint. Click to stop it early.', 'aria-label': 'Stop the sprint',
        html: icon('mkg-timer') }, h('span', { class: 'mkg-sp-time' }, `${m}:${pad(s)}`), h('span', { class: 'mkg-sp-words' }, `${fmt(Math.max(0, sprint.words))} words`));
      sp.addEventListener('click', () => stopSprint({ early: true }));
      el.append(sp);
    }
  }

  // ---------------------------------------------------------------- outline card (adds to shell's Document card)
  function paintOutline() {
    const outline = document.getElementById('outline'); if (!outline) return;
    const card = outline.querySelector('.sidecard'); if (!card) return;
    card.querySelector('.mkg-card')?.remove();
    const doc = app.docs.active(); if (!doc || doc.kind !== 'markdown') return;
    // the card's bar above already shows the document target; the ring shows today's goal
    const st = streak(), g = dailyGoal(), pct = g ? today() / g : 0;
    const box = h('div', { class: 'mkg-card' });
    if (g) box.append(h('div', { class: 'mkg-card-ring', 'data-pct': String(Math.round(pct * 100)), html: ring(pct, { size: 38, stroke: 3.5, label: `${Math.min(999, Math.round(pct * 100))}%` }) }));
    const lines = h('div', { class: 'mkg-card-t' },
      h('div', null, h('b', null, fmt(today())), g ? ` of ${fmt(g)} words today` : ' words today'),
      st ? h('div', { class: 'mkg-card-s', html: `${flame(12)}<span>${st}-day streak</span>` } ) : null);
    const more = h('button', { class: 'oitem mkg-link', type: 'button', text: sprint ? 'Sprint running…' : 'Goals and sprints…' });
    more.addEventListener('click', () => openPanel(more));
    lines.append(more);
    box.append(lines);
    card.append(box);
  }
  let outlineObs = null;
  function watchOutline() {
    const outline = document.getElementById('outline'); if (!outline || outlineObs) return;
    outlineObs = new MutationObserver(() => { if (!outline.querySelector('.sidecard .mkg-card')) paintOutline(); });
    outlineObs.observe(outline, { childList: true });
    paintOutline();
  }
  function paint() { paintStatus(); paintOutline(); }

  // ---------------------------------------------------------------- sprint timer
  function startSprint(minutes, { quiet = false } = {}) {
    minutes = [15, 25, 45].includes(Number(minutes)) ? Number(minutes) : Math.max(1, Math.min(180, Math.round(Number(minutes) || sprintLen())));
    if (sprint) stopSprint({ quiet: true });
    const doc = app.docs.active(); if (doc) { measure(doc); }
    sprint = { minutes, start: Date.now(), end: Date.now() + minutes * 60000, words: 0 };
    settings.set('sprintMinutes', minutes);
    clearInterval(sprintTick);
    sprintTick = setInterval(() => { if (sprint && Date.now() >= sprint.end) stopSprint(); else paintStatus(); }, 1000);
    document.body.classList.add('mk-sprinting');
    if (!quiet) toast(`${minutes}-minute sprint started. Just write. Your words are counted in the status bar.`);
    app.events.emit('goals:sprint', { state: 'start', minutes });
    paint();
    return sprint;
  }
  function stopSprint({ early = false, quiet = false } = {}) {
    if (!sprint) return null;
    const doc = app.docs.active(); if (doc && pending.has(doc.id)) measure(doc);
    const s = sprint; sprint = null; clearInterval(sprintTick);
    document.body.classList.remove('mk-sprinting');
    const mins = Math.max(1, Math.round((Math.min(Date.now(), s.end) - s.start) / 60000));
    const words = Math.max(0, s.words);
    const hist = (settings.get('sprintLog', []) || []).concat({ date: new Date().toISOString(), minutes: s.minutes, ran: mins, words }).slice(-50);
    settings.set('sprintLog', hist);
    const best = Math.max(0, ...hist.slice(0, -1).map(x => x.words || 0));
    const summary = { minutes: s.minutes, ran: mins, words, early, best: words > best && hist.length > 1 };
    if (!quiet) {
      if (early) toast(`Sprint stopped: ${fmt(words)} words in ${mins} minute${mins === 1 ? '' : 's'}.`);
      else celebrate({ kind: 'sprint', title: 'Sprint done', text: `${fmt(words)} words in ${s.minutes} minutes${summary.best ? ' — your best sprint yet' : ''}.`, quietIfZero: !words });
    }
    app.events.emit('goals:sprint', { state: 'stop', ...summary });
    paint();
    return summary;
  }

  // ---------------------------------------------------------------- celebration
  let lastCelebration = null;
  function celebrate({ kind, title, text, quietIfZero } = {}) {
    lastCelebration = { kind, title, text, at: Date.now() };
    app.events.emit('goals:reached', lastCelebration);
    if (settings.get('goalsCelebrate', true) === false || quietIfZero) { toast(`${title}. ${text}`); return; }
    document.querySelector('.mkg-cele')?.remove();
    const motion = !reducedMotion();
    const el = h('div', { class: 'mkg-cele' + (motion ? ' anim' : ''), role: 'status', 'aria-live': 'polite' },
      h('div', { class: 'mkg-cele-ring', html: ring(1, { size: 44, stroke: 3.5 }) + '<svg class="mkg-cele-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12.5l3.2 3.2L17 9"/></svg>' }),
      h('div', { class: 'mkg-cele-t' }, h('b', null, title), h('span', null, text)),
      h('button', { class: 'mkg-cele-x', type: 'button', 'aria-label': 'Close', html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>', onclick: () => close() }));
    if (motion) for (let k = 0; k < 14; k++) {
      const dot = h('i', { class: 'mkg-spark' });
      dot.style.setProperty('--x', `${Math.round((Math.random() - 0.5) * 260)}px`);
      dot.style.setProperty('--y', `${Math.round(-40 - Math.random() * 90)}px`);
      dot.style.setProperty('--d', `${(Math.random() * 0.25).toFixed(2)}s`);
      dot.style.setProperty('--c', ['var(--accent)', 'var(--purple,#8e5cf7)', '#34c759', '#ff9f0a'][k % 4]);
      el.append(dot);
    }
    document.body.append(el);
    raf(() => raf(() => el.classList.add('show')));
    let t = setTimeout(close, 4200);
    el.addEventListener('mouseenter', () => clearTimeout(t));
    el.addEventListener('mouseleave', () => { t = setTimeout(close, 1800); });
    function close() { clearTimeout(t); el.classList.remove('show'); setTimeout(() => el.remove(), 400); }
    return el;
  }

  // ---------------------------------------------------------------- goals panel (popover from the status bar / ribbon)
  async function setDailyGoal() {
    const v = await app.ui.prompt('Daily writing goal', 'How many words do you want to write each day? Leave empty for none.', String(dailyGoal() || ''));
    if (v == null) return;
    const n = parseInt(String(v).replace(/[,\s]/g, ''), 10);
    settings.set('dailyWordGoal', n > 0 ? n : 0);
    paint();
  }
  function panelContent(close) {
    const doc = app.docs.active(), t = docTarget(doc), g = dailyGoal(), st = streak();
    const pr = progress(doc);
    const docWords = doc && doc.kind === 'markdown' ? (counts.get(doc.id) ?? wordsOf(doc.text)) : 0;
    const row = (label, value, btnLabel, fn, tip) => h('div', { class: 'mkg-row' }, h('span', { class: 'mkg-row-l' }, label), h('span', { class: 'mkg-row-v' }, value),
      btnLabel ? h('button', { class: 'mkg-btn', type: 'button', 'data-tip': tip || btnLabel, onclick: () => { close(); fn(); } }, btnLabel) : null);
    const wrap = h('div', { class: 'mkg-panel' },
      h('div', { class: 'mkg-head' }, h('div', { html: ring(pr.pct, { size: 46, stroke: 4, label: pr.kind === 'none' ? '' : `${Math.min(999, Math.round(pr.pct * 100))}%` }) }),
        h('div', null, h('b', null, 'Writing goals'), h('span', null, pr.kind === 'doc' ? `${fmt(pr.words)} of ${fmt(pr.target)} words in this document` : pr.kind === 'daily' ? `${fmt(pr.words)} of ${fmt(pr.target)} words today` : 'Set a goal to see your progress here.'))),
      row('This document', t ? `${fmt(docWords)} / ${fmt(t)}` : (doc?.kind === 'markdown' ? `${fmt(docWords)} words` : '—'), doc?.kind === 'markdown' && !doc.readOnly ? (t ? 'Change' : 'Set target') : null, () => app.commands.run('view.wordTarget'), 'Saved in the document as word-target'),
      row('Today', g ? `${fmt(today())} / ${fmt(g)}` : `${fmt(today())} words`, g ? 'Change' : 'Set goal', setDailyGoal, 'A goal for every day'),
      row('Streak', st ? h('span', { class: 'mkg-streak big', html: `${flame(14)}<span>${st} day${st === 1 ? '' : 's'}</span>` }) : 'Write today to start one', null),
      h('div', { class: 'mkg-sep' }),
      h('div', { class: 'mkg-sub' }, sprint ? 'Sprint running' : 'Writing sprint'),
      sprint
        ? h('div', { class: 'mkg-sprint-row' }, h('span', null, `${fmt(Math.max(0, sprint.words))} words so far`), h('button', { class: 'mkg-btn danger', type: 'button', onclick: () => { close(); stopSprint({ early: true }); } }, 'Stop sprint'))
        : h('div', { class: 'mkg-sprint-row' }, [15, 25, 45].map(m => h('button', { class: 'mkg-btn' + (m === sprintLen() ? ' primary' : ''), type: 'button', 'data-tip': `Write for ${m} minutes`, 'data-tip-d': 'A timer runs in the status bar and counts the words you write.', onclick: () => { close(); startSprint(m); } }, `${m} min`))),
      h('label', { class: 'mkg-check' }, (() => { const c = h('input', { type: 'checkbox' }); c.checked = settings.get('goalsCelebrate', true) !== false; c.addEventListener('change', () => settings.set('goalsCelebrate', c.checked)); return c; })(), 'Celebrate when I reach a goal'),
      h('label', { class: 'mkg-check' }, (() => { const c = h('input', { type: 'checkbox' }); c.checked = !!settings.get('typewriter', false); c.addEventListener('change', () => setTypewriter(c.checked)); return c; })(), 'Typewriter scrolling (keep the line I type in the middle)'));
    return wrap;
  }
  let panel = null;
  function openPanel(anchor) {
    anchor = anchor || statusEl?.querySelector('.mkg-sb') || document.querySelector('[data-tip-cmd="goals.open"]');
    const close = () => { try { panel?.close?.(); } catch {} panel = null; };
    if (typeof app.ui.popover === 'function' && anchor && anchor.offsetParent) {
      panel = app.ui.popover(anchor, panelContent(close), { placement: anchor.closest('.status, #status, footer') ? 'top' : 'bottom' });
      return panel;
    }
    const body = panelContent(() => {});
    app.ui.dialog({ title: 'Writing goals', body, buttons: [{ label: 'Done', value: true, primary: true }] });
    return null;
  }

  // ---------------------------------------------------------------- Typewriter scrolling
  let twKey = false, twFrame = 0;
  const padded = new Set();
  function scrollParent(el) {
    for (let n = el && (el.nodeType === 1 ? el : el.parentElement); n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 2) return n;
    }
    return null;
  }
  // caret position in a textarea: a hidden copy with the same metrics, text up to the caret and a marker
  let mirrorEl = null;
  function textareaCaretY(ta) {
    const cs = getComputedStyle(ta);
    if (!mirrorEl) { mirrorEl = document.createElement('div'); mirrorEl.setAttribute('aria-hidden', 'true'); document.body.append(mirrorEl); }
    const props = ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'tabSize', 'whiteSpace', 'wordBreak', 'overflowWrap', 'fontVariantLigatures', 'fontFeatureSettings', 'textIndent', 'wordSpacing'];
    const st = mirrorEl.style;
    st.position = 'absolute'; st.visibility = 'hidden'; st.top = '0'; st.left = '-9999px'; st.overflow = 'hidden'; st.height = 'auto';
    for (const p of props) st[p] = cs[p];
    st.width = ta.clientWidth + 'px'; st.boxSizing = 'border-box';
    mirrorEl.textContent = ta.value.slice(0, ta.selectionEnd);
    const mark = document.createElement('span'); mark.textContent = '​'; mirrorEl.append(mark);
    const y = mark.offsetTop + mark.offsetHeight / 2;
    return ta.getBoundingClientRect().top - ta.scrollTop + y;
  }
  function caretY() {
    const ae = document.activeElement;
    if (ae && ae.tagName === 'TEXTAREA') {
      if (!ae.closest('.canvas-host, .canvas, #canvas, .mk-simple')) return null;
      return { y: textareaCaretY(ae), node: ae };
    }
    const sel = getSelection(); if (!sel || !sel.rangeCount) return null;
    const node = sel.focusNode; const el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!el || !el.closest('[contenteditable]:not([contenteditable="false"])') || !el.closest('.canvas-host, .canvas, #canvas')) return null;
    const r = sel.getRangeAt(0).cloneRange(); r.collapse(false);
    let rect = r.getClientRects()[0] || r.getBoundingClientRect();
    if (!rect || (!rect.height && !rect.top)) rect = el.getBoundingClientRect();
    return { y: rect.top + (rect.height || 0) / 2, node: el };
  }
  function centerCaret() {
    twFrame = 0;
    if (!settings.get('typewriter', false)) return;
    const c = caretY(); if (!c) return;
    const sc = scrollParent(c.node) || document.querySelector('.canvas-host'); if (!sc) return;
    if (!padded.has(sc)) { sc.classList.add('mkg-tw-pad'); padded.add(sc); }
    const box = sc.getBoundingClientRect();
    const want = box.top + sc.clientHeight * 0.45;
    const dy = c.y - want;
    if (Math.abs(dy) > 2) sc.scrollTop += dy;
  }
  function queueCenter() { if (!twFrame) twFrame = raf(centerCaret); }
  document.addEventListener('keydown', e => { if (settings.get('typewriter', false) && !e.ctrlKey && !e.metaKey && !e.altKey) twKey = true; }, true);
  document.addEventListener('input', () => { if (settings.get('typewriter', false)) queueCenter(); }, true);
  document.addEventListener('selectionchange', () => { if (twKey) { twKey = false; queueCenter(); } });
  function setTypewriter(on, { quiet = false } = {}) {
    on = on ?? !settings.get('typewriter', false);
    settings.set('typewriter', !!on);
    document.body.classList.toggle('mk-typewriter', !!on);
    if (!on) { padded.forEach(el => el.classList.remove('mkg-tw-pad')); padded.clear(); }
    else queueCenter();
    app.events.emit('ribbon:changed');
    if (!quiet) toast(on ? 'Typewriter scrolling on: the line you type stays in the middle.' : 'Typewriter scrolling off.');
    return !!on;
  }

  // ---------------------------------------------------------------- commands, ribbon, options
  const C = (id, def) => app.commands.register(id, { category: 'View', ...def });
  C('goals.open', { label: 'Writing goals…', description: 'Set a word target for this document or a daily goal, see your streak and start a sprint.', icon: 'mkg-target', run: () => openPanel() });
  C('goals.dailyGoal', { label: 'Set daily writing goal…', description: 'How many words you want to write each day. Reaching it keeps your streak going.', icon: 'mkg-target', run: () => setDailyGoal() });
  C('goals.sprint', { label: 'Writing sprint…', description: 'Write for 15, 25 or 45 minutes. A timer in the status bar counts the words you write.', icon: 'mkg-timer',
    isActive: () => !!sprint, run: args => { const m = args?.minutes ?? args?.value; if (m) return startSprint(m); if (sprint) return stopSprint({ early: true }); sprintMenu(); } });
  for (const m of [15, 25, 45]) C('goals.sprint' + m, { label: `Start a ${m}-minute sprint`, description: `Write for ${m} minutes. The status bar shows the time left and the words you write.`, icon: 'mkg-timer', run: () => startSprint(m) });
  C('goals.stopSprint', { label: 'Stop sprint', description: 'Stop the writing sprint now and see how many words you wrote.', icon: 'mkg-timer', isEnabled: () => !!sprint, run: () => stopSprint({ early: true }) });
  C('view.typewriter', { label: 'Typewriter scrolling', description: 'Keep the line you are typing in the middle of the screen, like a typewriter. Works in every mode.', icon: 'mkg-typewriter', isActive: () => !!settings.get('typewriter', false), run: () => setTypewriter() });
  function sprintMenu() {
    const anchor = document.querySelector('[data-tip-cmd="goals.sprint"]') || statusEl?.querySelector('.mkg-sb');
    if (anchor && anchor.offsetParent && typeof app.ui.popover === 'function') {
      let p = null; const close = () => p?.close?.();
      const box = h('div', { class: 'mkg-panel mkg-menu' }, h('div', { class: 'mkg-sub' }, 'Start a writing sprint'),
        h('div', { class: 'mkg-sprint-row' }, [15, 25, 45].map(m => h('button', { class: 'mkg-btn' + (m === sprintLen() ? ' primary' : ''), type: 'button', onclick: () => { close(); startSprint(m); } }, `${m} min`))),
        h('p', { class: 'mkg-hint' }, 'A timer runs in the status bar and counts the words you write.'));
      p = app.ui.popover(anchor, box, { placement: 'bottom' });
      return;
    }
    startSprint(sprintLen());
  }
  app.ribbon.addGroup('view', { id: 'goals-writing', label: 'Writing', order: 15, items: [
    { type: 'big', command: 'view.typewriter', label: 'Typewriter', icon: 'mkg-typewriter' },
    { type: 'big', command: 'goals.open', label: 'Goals', icon: 'mkg-target' },
    { type: 'big', command: 'goals.sprint', label: 'Sprint', icon: 'mkg-timer' },
  ] });
  try {
    app.tooltips?.register?.('view.typewriter', { title: 'Typewriter scrolling', description: 'Keep the line you are typing in the middle of the screen, so your eyes stay in one place.' });
    app.tooltips?.register?.('goals.open', { title: 'Writing goals', description: 'A word target for this document, a daily goal and your streak. The ring in the status bar shows your progress.' });
    app.tooltips?.register?.('goals.sprint', { title: 'Writing sprint', description: 'Write for 15, 25 or 45 minutes without stopping. The status bar counts the time and your words.' });
  } catch {}

  app.options?.addSection?.({
    id: 'goals', label: 'Writing goals', order: 75,
    render(el) {
      el.textContent = '';
      const goal = h('input', { class: 'mkg-input', type: 'number', min: '0', max: '100000', step: '50', value: String(dailyGoal() || ''), placeholder: 'None', 'aria-label': 'Daily goal in words' });
      goal.addEventListener('change', () => { const n = Math.max(0, Math.round(Number(goal.value) || 0)); goal.value = n || ''; settings.set('dailyWordGoal', n); });
      const cb = (key, def, label, fn) => { const c = h('input', { type: 'checkbox' }); c.checked = settings.get(key, def) !== false && !!settings.get(key, def); c.addEventListener('change', () => (fn ? fn(c.checked) : settings.set(key, c.checked))); return h('label', { class: 'mkg-check' }, c, label); };
      el.append(h('div', { class: 'mkg-opts' },
        h('div', { class: 'mkg-opt-row' }, h('span', null, 'Daily goal'), goal, h('span', { class: 'mkg-hint' }, 'words a day (empty for none)')),
        h('p', { class: 'mkg-hint' }, 'A word target for one document is set from the outline’s Document card or View → Goals, and is saved in the document as word-target.'),
        cb('goalsStatus', true, 'Show the goal ring in the status bar'),
        cb('goalsCelebrate', true, 'Celebrate when I reach a goal (stays still when the system asks for reduced motion)'),
        cb('typewriter', false, 'Typewriter scrolling: keep the line I type in the middle of the screen', v => setTypewriter(v))));
    },
  });

  // ---------------------------------------------------------------- boot
  function boot() {
    mergeSaved();
    document.body.classList.toggle('mk-typewriter', !!settings.get('typewriter', false));
    for (const d of app.docs.list?.() || []) baseline(d);
    watchOutline(); paint();
  }
  app.events.on('ready', boot);
  if (document.readyState !== 'loading') setTimeout(boot, 0); else document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0), { once: true });

  // ---------------------------------------------------------------- public API
  app.goals = {
    progress, streak, today, dailyGoal, docTarget, wordsOf, ring,
    setDailyGoal: n => { settings.set('dailyWordGoal', Math.max(0, Math.round(Number(n) || 0))); paint(); },
    measureNow: doc => measure(doc || app.docs.active()),
    startSprint, stopSprint, get sprint() { return sprint ? { ...sprint } : null; },
    celebrate, get lastCelebration() { return lastCelebration; },
    setTypewriter, get typewriter() { return !!settings.get('typewriter', false); },
    openPanel, paint, centerCaret,
  };

  // ---------------------------------------------------------------- smoke tests
  const A = app.assert || ((c, m) => { if (!c) throw new Error('Assertion failed: ' + m); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function withDoc(text, fn) {
    const prev = app.docs.active();
    const d = app.docs.create({ text }); app.docs.activate?.(d.id);
    baseline(d);
    try { return await fn(d); }
    finally { await app.docs.close(d.id, { force: true }); if (prev && app.docs.get(prev.id)) app.docs.activate(prev.id); }
  }
  const SAVED = { dailyWordGoal: 0, writingLog: {}, writingMet: {}, goalsCelebrate: true, goalsCelebrated: {}, sprintLog: [], sprintMinutes: 25, typewriter: false };
  async function keepSettings(fn) {
    const before = Object.fromEntries(Object.keys(SAVED).map(k => [k, settings.get(k, undefined)]));
    const l0 = { ...log }, m0 = { ...met };
    try { return await fn(); }
    finally { clearTimeout(saveTimer); log = l0; met = m0; for (const k of Object.keys(SAVED)) settings.set(k, before[k] === undefined || before[k] === null ? SAVED[k] : before[k]); document.body.classList.toggle('mk-typewriter', !!settings.get('typewriter', false)); document.querySelector('.mkg-cele')?.remove(); paint(); }
  }
  app.tests.register('goals: ring follows the document word target', () => keepSettings(() => withDoc('---\nword-target: 10\n---\none two three four five\n', async d => {
    measure(d, true); paint();
    let pr = progress(d);
    A(pr.kind === 'doc' && pr.target === 10 && pr.words === 5, 'progress 5/10, got ' + JSON.stringify(pr));
    A(statusEl?.querySelector('.mkg-sb')?.dataset.pct === '50', 'status ring at 50%, got ' + statusEl?.querySelector('.mkg-sb')?.dataset.pct);
    settings.set('goalsCelebrate', true);
    d.setText('---\nword-target: 10\n---\none two three four five six seven eight nine ten eleven twelve\n', 'typing');
    measure(d);
    pr = progress(d);
    A(pr.pct >= 1, 'goal reached: ' + JSON.stringify(pr));
    A(statusEl?.querySelector('.mkg-sb')?.dataset.pct === '120', 'status ring at 120%, got ' + statusEl?.querySelector('.mkg-sb')?.dataset.pct);
    A(lastCelebration?.kind === 'doc', 'celebrated the target: ' + JSON.stringify(lastCelebration));
    A(document.querySelector('.mkg-cele'), 'celebration card shown');
    const card = document.querySelector('#outline .sidecard .mkg-card-ring');
    if (document.querySelector('#outline .sidecard') && settings.get('outline', true)) { await sleep(50); paintOutline(); A(document.querySelector('#outline .sidecard .mkg-card'), 'outline card shows today'); }
    void card;
  })));
  app.tests.register('goals: sprint counts the words written', () => keepSettings(() => withDoc('Start here.\n', async d => {
    measure(d, true);
    const t0 = today();
    startSprint(15, { quiet: true });
    A(sprint && sprint.minutes === 15, 'sprint running');
    d.setText('Start here. And now seven more words get written today.\n', 'typing');
    measure(d);
    A(sprint.words === 8, 'sprint counted 8 words, got ' + sprint.words);
    A(today() - t0 === 8, 'today counted 8 words, got ' + (today() - t0));
    d.setText('Start here.\n' + 'pasted '.repeat(2000), 'paste');
    measure(d);
    A(sprint.words === 8, 'a huge paste is not counted, got ' + sprint.words);
    const sp = statusEl?.querySelector('.mkg-sprint');
    A(sp && /\d+:\d\d/.test(sp.textContent), 'status shows the timer: ' + sp?.textContent);
    const r = stopSprint({ early: true, quiet: true });
    A(r && r.words === 8 && !sprint, 'stopped with 8 words: ' + JSON.stringify(r));
  })));
  app.tests.register('goals: daily goal, streak and typewriter switch', () => keepSettings(async () => {
    const k = dayKey(), y = new Date(); y.setDate(y.getDate() - 1);
    met = { [dayKey(y)]: 1 }; log = { [dayKey(y)]: 600, [k]: 0 };
    A(streak() === 1, 'yesterday keeps the streak alive: ' + streak());
    settings.set('dailyWordGoal', 20); settings.set('goalsCelebrate', true);
    addWritten(25);
    A(met[k] && streak() === 2, 'today met the goal: ' + streak());
    A(lastCelebration?.kind === 'daily', 'daily goal reached');
    const was = !!settings.get('typewriter', false);
    setTypewriter(!was, { quiet: true }); A(document.body.classList.contains('mk-typewriter') === !was, 'typewriter class');
    setTypewriter(was, { quiet: true });
  }));
  app.tests.register('goals: typewriter keeps the caret line in the middle (Word and Simple)', () => keepSettings(() => withDoc('# Long\n\n' + Array.from({ length: 90 }, (_, k) => `Paragraph ${k + 1} has a few words in it.`).join('\n\n') + '\n', async d => {
    const mode = app.mode;
    try {
      setTypewriter(true, { quiet: true });
      if (app.mode !== 'word') app.setMode('word');
      await sleep(900);
      const page = app.editors.active()?.getSurface?.() || document.querySelector('#editorHost .mk-page');
      A(page, 'Word page');
      const p = [...page.querySelectorAll('p')].find(x => /Paragraph 45\b/.test(x.textContent));
      A(p, 'paragraph 45 on the page');
      page.focus();
      const r = document.createRange(); const tn = p.firstChild.nodeType === 3 ? p.firstChild : p; r.setStart(tn, tn.nodeType === 3 ? 4 : 0); r.collapse(true);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      centerCaret();
      const sc = scrollParent(p); A(sc, 'scroll container');
      const frac = (r.getBoundingClientRect().top - sc.getBoundingClientRect().top) / sc.clientHeight;
      A(frac > 0.3 && frac < 0.6, 'Word caret near the middle: ' + frac.toFixed(2));
      app.setMode('simple'); await sleep(900);
      const ta = document.querySelector('#editorHost .mk-src-ta');
      A(ta, 'Simple mode source');
      ta.focus(); const pos = ta.value.indexOf('Paragraph 70'); ta.setSelectionRange(pos, pos);
      centerCaret();
      const sc2 = scrollParent(ta); A(sc2, 'Simple scroll container');
      const frac2 = (textareaCaretY(ta) - sc2.getBoundingClientRect().top) / sc2.clientHeight;
      A(frac2 > 0.3 && frac2 < 0.6, 'Simple caret near the middle: ' + frac2.toFixed(2));
    } finally { setTypewriter(false, { quiet: true }); app.setMode(mode); await sleep(300); }
  })));
  app.tests.register('goals: screenshot', async () => {
    if (!mk.invoke) return;
    await keepSettings(() => withDoc('---\ntitle: Field notes\nword-target: 400\n---\n# Field notes\n\nThe river was higher than last year. ' + 'We measured the flow at three points along the bank and wrote down what we saw. '.repeat(12), async d => {
      measure(d, true);
      settings.set('dailyWordGoal', 500);
      const y = new Date(); y.setDate(y.getDate() - 1); const y2 = new Date(); y2.setDate(y2.getDate() - 2);
      met = { [dayKey(y)]: 1, [dayKey(y2)]: 1 }; log = { [dayKey(y)]: 520, [dayKey(y2)]: 610, [dayKey()]: 240 };
      startSprint(25, { quiet: true }); sprint.words = 132;
      try { app.shell?.selectTab?.('view'); } catch {}
      paint();
      await sleep(600);
      const pop = openPanel();
      await sleep(450);
      try { await mk.invoke('smoke-shot', 'goals'); } catch {}
      try { pop?.close?.(); } catch {}
      stopSprint({ quiet: true });
      settings.set('goalsCelebrate', true);
      celebrate({ kind: 'doc', title: 'Word target reached', text: '“Field notes” has 400 words. You hit your 400-word target.' });
      await sleep(1100);
      try { await mk.invoke('smoke-shot', 'goals-celebration'); } catch {}
    }));
  });
})();
