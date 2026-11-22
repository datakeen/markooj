// Markooj — Writing Assistant UI: the side pane (Writing Assistant and Thesaurus), F7 Editor, goals,
// Review tab groups, status-bar score, File → Options → Writing, the document context menu with
// synonyms, double-click synonyms and word completion ("Suggest words as I type", off by default).
(function () {
  'use strict';
  const app = window.app, W = app && app.writing, R = window.MkWritingRules;
  if (!app || !W || !W.check || !R) return;
  const esc = app.esc, mk = window.mk || {};
  const S = W.settings;
  const cmd = (id, def) => app.commands.register(id, def);
  const tip = (id, title, description) => { try { app.tooltips?.register?.(id, { title, description }); } catch {} };
  const toast = (m, o) => app.ui.toast(m, o);
  const icon = n => `<svg class="i"><use href="#${n}"/></svg>`;

  // ---- icons of our own (ids start with mkw- so they never collide with the shell's)
  const ICONS = {
    'mkw-assist': '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/><path d="M19 15v4M17 17h4M21 3l.01.01"/>',
    'mkw-book': '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h13M9 7h6M9 11h4"/>',
    'mkw-goal': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>',
    'mkw-accept': '<path d="m3 12 4 4L17 6"/><path d="m11 16 2 2L21 8"/>',
    'mkw-abc': '<path d="m3 16 3-8 3 8M4 13.5h4M12 8v8h2.5a2 2 0 0 0 0-4H12M12 12h2a2 2 0 0 0 0-4h-2M21 9a3 3 0 1 0 0 6"/>',
    'mkw-complete': '<path d="M3 12h7M12 6v12"/><path d="M15 12h1.5M19 12h1.5"/>',
    'mkw-globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  };
  (function injectIcons() {
    const defs = document.querySelector('body > svg defs') || document.querySelector('svg defs');
    if (!defs) return;
    for (const [id, d] of Object.entries(ICONS)) {
      if (document.getElementById(id)) continue;
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
      s.setAttribute('id', id); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = d; defs.appendChild(s);
    }
  })();

  // =================================================================== side pane
  let pane = null, view = null, filter = 'all', selId = null, thesTarget = null, thesWord = '';
  function ensurePane() {
    if (pane && pane.isConnected) return pane;
    const mid = document.querySelector('.mid-inner') || document.getElementById('editorHost')?.parentElement;
    if (!mid) return null;
    pane = document.createElement('aside');
    pane.className = 'mkw-pane'; pane.id = 'mkwPane'; pane.setAttribute('aria-label', 'Writing Assistant'); pane.hidden = true;
    pane.innerHTML = `<div class="mkw-p-head"><b class="mkw-p-title"></b><button type="button" class="mkw-p-x" data-tip="Close" data-tip-d="Close this pane. Esc goes back to the document." aria-label="Close">${icon('x')}</button></div><div class="mkw-p-body"></div>`;
    pane.querySelector('.mkw-p-x').addEventListener('click', () => closePane());
    pane.addEventListener('keydown', e => { if (e.key === 'Escape' && !W.cardOpen()) { e.preventDefault(); e.stopPropagation(); try { app.editors.active()?.focus?.(); } catch {} } });
    mid.appendChild(pane);
    return pane;
  }
  function openPane(v) {
    if (!ensurePane()) return;
    view = v; pane.hidden = false; pane.dataset.view = v;
    document.body.classList.add('mkw-pane-open');
    pane.querySelector('.mkw-p-title').textContent = v === 'thesaurus' ? 'Thesaurus' : 'Writing Assistant';
    pane.setAttribute('aria-label', v === 'thesaurus' ? 'Thesaurus' : 'Writing Assistant');
    if (v === 'assistant') renderAssistant(true); else renderThesaurus();
    app.events.emit('writing:pane', { view: v, open: true });
    app.events.emit('ribbon:changed');
  }
  function closePane() {
    if (!pane) return;
    pane.hidden = true; view = null; document.body.classList.remove('mkw-pane-open'); W.setActive(null);
    app.events.emit('writing:pane', { open: false }); app.events.emit('ribbon:changed');
    try { app.editors.active()?.focus?.(); } catch {}
  }
  W.pane = { open: openPane, close: closePane, get view() { return pane && !pane.hidden ? view : null; }, get el() { return pane; } };

  // ---- score ring
  function ring(score, size = 64, stroke = 6) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - score / 100);
    const col = score >= 85 ? 'var(--mkw-green)' : score >= 65 ? 'var(--mkw-blue)' : score >= 45 ? 'var(--mkw-orange)' : 'var(--mkw-red)';
    return `<svg class="mkw-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})" style="transition:stroke-dashoffset .6s var(--ease,ease)"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" class="mkw-ring-n">${score}</text></svg>`;
  }
  const verdict = s => (s >= 90 ? 'Excellent' : s >= 75 ? 'Good' : s >= 55 ? 'Getting there' : 'Needs work');
  const GOAL_LABEL = { audience: { general: 'General', knowledgeable: 'Knowledgeable', expert: 'Expert' }, formality: { informal: 'Informal', neutral: 'Neutral', formal: 'Formal' }, domain: { general: 'General', academic: 'Academic', business: 'Business' } };

  function renderAssistant(focusList) {
    if (!pane || pane.hidden || view !== 'assistant') return;
    const body = pane.querySelector('.mkw-p-body');
    const doc = app.docs.active();
    if (!doc || doc.kind !== 'markdown') { body.innerHTML = '<p class="mkw-empty">Open a Markdown document to see writing suggestions.</p>'; return; }
    const st = W.state(doc); const g = S.goals();
    const list = st.findings || [];
    const c = st.counts || { correctness: 0, clarity: 0, engagement: 0, delivery: 0 };
    const shown = filter === 'all' ? list : list.filter(f => f.cat === filter);
    const lang = W.languageFor(doc);
    const status = !S.on() && !S.spell() ? 'Checking is off.' : st.status === 'checking' ? 'Checking…' : W.engine.harper === 'loading' ? 'Starting the grammar checker…' : lang.unsupported ? `Spelling and grammar are not available for “${lang.code}”. Add a language pack in File → Options → Language.` : '';
    const safe = W.safeCount(doc);
    const scrollTop = body.querySelector('.mkw-list')?.scrollTop || 0;
    body.innerHTML = `
      <div class="mkw-score">${ring(st.text == null ? 100 : st.score)}<div><div class="mkw-s-v">${st.text == null ? 'Checking…' : verdict(st.score)}</div><div class="mkw-s-n">${list.length ? `${list.length} suggestion${list.length === 1 ? '' : 's'}` : st.text == null ? '' : 'No suggestions'} · ${esc(lang.name)}</div><div class="mkw-s-st" aria-live="polite">${esc(status)}</div></div></div>
      <button type="button" class="mkw-goals" data-tip="Goals" data-tip-d="Tell Markooj who you write for. Goals change which suggestions you see.">${icon('mkw-goal')}<span>Goals: ${esc(GOAL_LABEL.audience[g.audience])} · ${esc(GOAL_LABEL.formality[g.formality])} · ${esc(GOAL_LABEL.domain[g.domain])}</span></button>
      <div class="mkw-tabs" role="tablist" aria-label="Categories">${['all', ...R.CATS].map(k => `<button type="button" role="tab" class="mkw-tab${filter === k ? ' on' : ''}" data-k="${k}" aria-selected="${filter === k}"${k !== 'all' ? ` data-tip="${R.CAT_LABEL[k]}" data-tip-d="${esc(catDesc[k])}"` : ''}>${k === 'all' ? '' : `<span class="mkw-dot" style="background:${W.CAT_COLOR[k]}"></span>`}<span>${k === 'all' ? 'All' : R.CAT_LABEL[k]}</span><em>${k === 'all' ? list.length : c[k] || 0}</em></button>`).join('')}</div>
      ${safe ? `<button type="button" class="mkw-acceptall" data-tip="Accept all safe fixes" data-tip-d="Apply the ${safe} fixes that cannot change your meaning (repeated words, a/an, spelling style, wordy phrases). One Ctrl+Z takes them all back.">${icon('mkw-accept')}<span>Accept ${safe} safe fix${safe === 1 ? '' : 'es'}</span></button>` : ''}
      <div class="mkw-list" role="listbox" tabindex="0" aria-label="Suggestions">${shown.length ? '' : `<div class="mkw-empty">${st.text == null ? 'Checking your document…' : filter === 'all' ? 'Nothing to fix. Nice writing!' : 'Nothing in this category.'}</div>`}</div>
      <div class="mkw-p-foot">Underlines: <span style="color:var(--mkw-red)">■</span> correctness <span style="color:var(--mkw-blue)">■</span> clarity <span style="color:var(--mkw-green)">■</span> engagement <span style="color:var(--mkw-purple)">■</span> delivery. ↑↓ move, Enter accepts, Delete dismisses.</div>`;
    const lb = body.querySelector('.mkw-list');
    const max = 300;
    for (const f of shown.slice(0, max)) {
      const it = document.createElement('div');
      it.className = 'mkw-item' + (f.id === selId ? ' sel' : ''); it.setAttribute('role', 'option'); it.dataset.id = f.id; it.setAttribute('aria-selected', String(f.id === selId));
      const fixes = f.rule === 'spelling' ? [] : f.replacements || [];
      const snippet = f.wide ? `<span class="mkw-i-txt">${esc(f.text.slice(0, 70))}${f.text.length > 70 ? '…' : ''}</span>` : `<span class="mkw-i-txt"><span class="mkw-del">${esc(f.text.slice(0, 40))}</span>${fixes.length ? ` → <b>${esc(fixes[0] === '' ? 'remove' : fixes[0])}</b>` : ''}</span>`;
      it.innerHTML = `<div class="mkw-i-row"><span class="mkw-dot" style="background:${W.CAT_COLOR[f.cat]}"></span><span class="mkw-i-title">${esc(f.title || '')}</span></div>${snippet}`;
      if (f.id === selId) { const box = document.createElement('div'); box.className = 'mkw-i-card'; W.renderCard(f, box, { doc, onDone: () => { selId = nextId(f.id); } }); it.appendChild(box); }
      lb.appendChild(it);
    }
    if (shown.length > max) lb.insertAdjacentHTML('beforeend', `<div class="mkw-empty">${shown.length - max} more. Fix some of these to see the rest.</div>`);
    lb.scrollTop = scrollTop;
    body.querySelector('.mkw-goals').addEventListener('click', () => goalsDialog());
    body.querySelectorAll('.mkw-tab').forEach(b => b.addEventListener('click', () => { filter = b.dataset.k; renderAssistant(); }));
    body.querySelector('.mkw-acceptall')?.addEventListener('click', e => { app.ui.ripple?.(e.currentTarget); const n = W.acceptAllSafe(doc); toast(n ? `Accepted ${n} fix${n === 1 ? '' : 'es'}. Press Ctrl+Z to undo.` : 'No safe fixes left.'); });
    lb.addEventListener('click', e => { const it = e.target.closest('.mkw-item'); if (!it || e.target.closest('.mkw-i-card')) return; select(it.dataset.id, true); });
    lb.addEventListener('keydown', onListKey);
    if (focusList) setTimeout(() => lb.focus({ preventScroll: true }), 30);
  }
  const catDesc = { correctness: 'Spelling, grammar, punctuation and wrong prepositions.', clarity: 'Long sentences, wordy phrases, passive voice, undefined abbreviations and consistency.', engagement: 'Plain or overused words and repeated sentence starts.', delivery: 'Tone for your goals: contractions, informal words, hedging.' };
  function shownList() { const doc = app.docs.active(); const list = doc ? W.state(doc).findings : []; return filter === 'all' ? list : list.filter(f => f.cat === filter); }
  function nextId(id) { const l = shownList(); const i = l.findIndex(f => f.id === id); return (l[i + 1] || l[i - 1] || {}).id || null; }
  function select(id, toggle) {
    selId = toggle && selId === id ? null : id;
    renderAssistant();
    const it = pane?.querySelector(`.mkw-item[data-id="${id}"]`); it?.scrollIntoView({ block: 'nearest' });
    const doc = app.docs.active(); const f = doc && W.state(doc).findings.find(x => x.id === id);
    if (f && selId) reveal(f);
    else W.setActive(null);
  }
  /** Scroll the document to a finding and mark it. */
  function reveal(f) {
    const p = W.painted().find(x => x.f.id === f.id);
    if (p) {
      const el = p.range.startContainer.parentElement;
      const r = p.range.getBoundingClientRect();
      let sc = el; while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      if (sc && sc !== document.body) { const sr = sc.getBoundingClientRect(); if (r.top < sr.top + 40 || r.bottom > sr.bottom - 40) sc.scrollBy({ top: r.top - sr.top - sr.height / 3, behavior: 'smooth' }); }
      W.setActive(f.id);
    } else if (app.mode === 'simple') { try { app.editors.active()?.setSelection?.(f.start, f.end); } catch {} }
    else { try { const ed = app.editors.active(); const line = app.docs.active().text.slice(0, f.start).split('\n').length - 1; ed?.scrollToLine?.(line); } catch {} }
  }
  W.reveal = reveal;
  function onListKey(e) {
    const l = shownList(); if (!l.length) return;
    let i = l.findIndex(f => f.id === selId);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); i = e.key === 'ArrowDown' ? Math.min(l.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1); select(l[i].id); pane.querySelector('.mkw-list')?.focus({ preventScroll: true }); }
    else if (e.key === 'Enter' && i >= 0) { e.preventDefault(); const f = l[i]; const fx = W.fixesFor(f); if (fx.length) { selId = nextId(f.id); W.accept(f, fx[0]); } }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && i >= 0) { e.preventDefault(); const f = l[i]; selId = nextId(f.id); W.dismiss(f); }
    else if (e.key === 'Home') { e.preventDefault(); select(l[0].id); }
    else if (e.key === 'End') { e.preventDefault(); select(l[l.length - 1].id); }
  }
  const rerender = app.debounce(() => { if (view === 'assistant') renderAssistant(); }, 120);
  ['writing:changed', 'writing:status', 'writing:engine', 'doc:active', 'settings:changed'].forEach(ev => app.events.on(ev, rerender));

  // ---- goals
  async function goalsDialog() {
    const g = S.goals();
    const body = document.createElement('div'); body.className = 'mkw-goalsdlg';
    const row = (key, title, desc, opts) => `<div class="mkw-g-row"><div><b>${title}</b><small>${desc}</small></div><div class="mkw-seg" role="radiogroup" aria-label="${title}">${opts.map(([v, l, d]) => `<button type="button" role="radio" data-k="${key}" data-v="${v}" aria-checked="${g[key] === v}" class="${g[key] === v ? 'on' : ''}" data-tip="${l}" data-tip-d="${esc(d)}">${l}</button>`).join('')}</div></div>`;
    body.innerHTML = row('audience', 'Audience', 'Who will read this?', [['general', 'General', 'Anyone. Markooj flags long sentences and abbreviations sooner.'], ['knowledgeable', 'Knowledgeable', 'Readers who know the topic.'], ['expert', 'Expert', 'Specialists. Longer sentences are fine.']])
      + row('formality', 'Formality', 'How formal should it sound?', [['informal', 'Informal', 'Contractions and casual words are fine.'], ['neutral', 'Neutral', 'Everyday writing.'], ['formal', 'Formal', 'No contractions or casual words; fewer hedges.']])
      + row('domain', 'Domain', 'What kind of writing is it?', [['general', 'General', 'Most writing.'], ['academic', 'Academic', 'Papers and theses: passive voice is fine; contractions, “I think” and undefined abbreviations are flagged.'], ['business', 'Business', 'Reports and email: clear, direct and formal.']])
      + '<p class="mkw-g-note">Goals apply to every document. They change which suggestions you see, never your text.</p>';
    body.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; g[b.dataset.k] = b.dataset.v; body.querySelectorAll(`[data-k="${b.dataset.k}"]`).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); }); app.ui.ripple?.(b); });
    const v = await app.ui.dialog({ title: 'Writing goals', body, buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Reset', value: 'reset' }, { label: 'OK', value: 'ok', primary: true }] });
    if (v === 'ok') app.settings.set('writingGoals', g);
    else if (v === 'reset') app.settings.set('writingGoals', { ...R.DEFAULT_GOALS });
  }
  W.goalsDialog = goalsDialog;

  // =================================================================== thesaurus pane
  function selectedWordTarget() {
    const doc = app.docs.active(); if (!doc) return null;
    const ae = document.activeElement;
    if (app.mode === 'simple' || (ae && ae.tagName === 'TEXTAREA' && ae.classList.contains('mk-src-ta'))) {
      const ta = document.querySelector('#editorHost textarea.mk-src-ta'); if (!ta) return null;
      let s = ta.selectionStart, e = ta.selectionEnd; const v = ta.value;
      if (s === e) { while (s > 0 && /[\p{L}'’-]/u.test(v[s - 1])) s--; while (e < v.length && /[\p{L}'’-]/u.test(v[e])) e++; }
      const word = v.slice(s, e).replace(/^['’-]+|['’-]+$/g, '');
      return word ? { kind: 'simple', start: s + v.slice(s, e).indexOf(word), end: s + v.slice(s, e).indexOf(word) + word.length, word } : null;
    }
    const sel = getSelection(); if (!sel || !sel.rangeCount) return null;
    const host = document.getElementById('editorHost'); if (!host?.contains(sel.anchorNode)) return null;
    const r = sel.getRangeAt(0).cloneRange();
    if (r.collapsed) return wordRangeAt(r.startContainer, r.startOffset);
    const word = String(r).trim(); if (!word || /\s/.test(word) || word.length > 40) return word ? { kind: 'dom', range: r, word } : null;
    return { kind: 'dom', range: r, word };
  }
  function wordRangeAt(node, off) {
    if (!node || node.nodeType !== 3) return null;
    const t = node.data; let s = off, e = off;
    while (s > 0 && /[\p{L}\p{M}'’-]/u.test(t[s - 1])) s--; while (e < t.length && /[\p{L}\p{M}'’-]/u.test(t[e])) e++;
    while (s < e && /['’-]/.test(t[s])) s++; while (e > s && /['’-]/.test(t[e - 1])) e--;
    if (e <= s) return null;
    const r = document.createRange(); r.setStart(node, s); r.setEnd(node, e);
    return { kind: 'dom', range: r, word: t.slice(s, e) };
  }
  /** The word under the mouse (for the context menu): DOM range in Word/Inline, textarea offsets in Simple mode. */
  function wordTargetAt(x, y) {
    const pos = W.caretAt(x, y); if (!pos || !pos.node) return null;
    const host = document.getElementById('editorHost'); if (!host?.contains(pos.node)) return null;
    if (app.mode === 'simple') {
      const mirror = host.querySelector('.mk-src-mirror'); const ln = pos.node.parentElement?.closest('.ln'); if (!mirror || !ln) return null;
      const li = [...mirror.children].indexOf(ln); if (li < 0) return null;
      const w = wordRangeAt(pos.node, pos.offset); if (!w) return null;
      const pre = document.createRange(); pre.setStart(ln, 0); pre.setEnd(w.range.startContainer, w.range.startOffset);
      const text = app.docs.active().text; let off = 0; for (let i = 0, k = 0; i < li; i++) { k = text.indexOf('\n', off); if (k < 0) return null; off = k + 1; }
      const s = off + pre.toString().length;
      return { kind: 'simple', start: s, end: s + w.word.length, word: w.word, range: w.range };
    }
    return wordRangeAt(pos.node, pos.offset);
  }
  W.wordTargetAt = wordTargetAt;
  /** Replace a target word, keeping its capitalization, through the editor's own typing path (Undo works). */
  W.replaceTarget = async function replaceTarget(target, word) {
    const doc = app.docs.active(); if (!target || !doc || doc.readOnly) return false;
    const rep = R.matchCase(target.word, word);
    if (target.kind === 'simple') {
      const ta = document.querySelector('#editorHost textarea.mk-src-ta');
      if (ta && ta.value.slice(target.start, target.end) === target.word) { ta.focus(); ta.setSelectionRange(target.start, target.end); document.execCommand('insertText', false, rep); return true; }
      const at = doc.text.indexOf(target.word, Math.max(0, target.start - 200));
      if (at < 0) return false;
      doc.setText(doc.text.slice(0, at) + rep + doc.text.slice(at + target.word.length), 'writing'); return true;
    }
    const r = target.range; if (!r || String(r) !== target.word) return false;
    const node = r.startContainer.parentElement;
    const editable = node && (node.isContentEditable);
    if (editable) {
      const ce = node.closest('[contenteditable="true"],[contenteditable="plaintext-only"]'); ce?.focus({ preventScroll: true });
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      if (document.execCommand('insertText', false, rep)) return true;
    }
    // Inline mode (rendered paragraph): find the same word in the Markdown of that paragraph
    const at = W.sourceOffset(r, target.word);
    if (at == null) return false;
    doc.setText(doc.text.slice(0, at) + rep + doc.text.slice(at + target.word.length), 'writing');
    return true;
  };
  /** Source offset of a word shown at a DOM range on the rendered page (nth occurrence inside its block). */
  W.sourceOffset = function sourceOffset(range, word) {
    const doc = app.docs.active(); const el = range.startContainer.parentElement?.closest('[data-line]'); if (!doc || !el) return null;
    const text = doc.text; let fm = 0; try { const raw = mk.frontMatter?.parse?.(text)?.raw || ''; fm = raw ? (raw.match(/\n/g) || []).length + (raw.endsWith('\n') ? 0 : 1) : 0; } catch {}
    const line = +el.getAttribute('data-line') + fm;
    let seg = 0; for (let i = 0; i < line; i++) { const k = text.indexOf('\n', seg); if (k < 0) return null; seg = k + 1; }
    const pre = document.createRange(); pre.setStart(el, 0); pre.setEnd(range.startContainer, range.startOffset);
    const re = new RegExp('(?<![\\p{L}\\p{N}])' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}])', 'gu');
    const n = (pre.toString().match(re) || []).length;
    const p = R.prose(text); re.lastIndex = seg; let m, c = 0;
    while ((m = re.exec(p.text))) { if (c === n) return m.index; c++; }
    return null;
  };
  async function openThesaurus(word, target) {
    const t = target || selectedWordTarget();
    thesTarget = t; thesWord = word || t?.word || thesWord || '';
    openPane('thesaurus');
  }
  W.openThesaurus = openThesaurus;
  async function renderThesaurus() {
    if (!pane || pane.hidden || view !== 'thesaurus') return;
    const body = pane.querySelector('.mkw-p-body');
    body.innerHTML = `<label class="mkw-th-search">${icon('search')}<input type="search" placeholder="Look up a word" aria-label="Look up a word" spellcheck="false" value="${esc(thesWord)}"></label><div class="mkw-th-res" aria-live="polite"><div class="mkw-empty">Loading…</div></div><div class="mkw-p-foot">Click a word to put it in place of “<span class="mkw-th-target">${esc(thesTarget?.word || '—')}</span>”. Double-click to look it up. Word meanings from WordNet (Princeton University).</div>`;
    const inp = body.querySelector('input'); const res = body.querySelector('.mkw-th-res');
    const draw = async () => {
      const w = inp.value.trim(); thesWord = w;
      if (!w) { res.innerHTML = '<div class="mkw-empty">Type a word, or select one in your document and press Shift+F7.</div>'; return; }
      const r = await W.synonyms(w);
      if (!r) { res.innerHTML = '<div class="mkw-empty">The thesaurus could not load.</div>'; return; }
      if (!r.groups.length) { res.innerHTML = `<div class="mkw-empty">No synonyms for “${esc(w)}”. Check the spelling, or try the base form of the word.</div>`; return; }
      res.innerHTML = (r.lemma !== w.toLowerCase() ? `<div class="mkw-th-lemma">Showing “${esc(r.lemma)}”</div>` : '') + r.groups.map(g => `<section><h4>${esc(g.pos)}</h4>${g.meanings.map(m => `<div class="mkw-th-m">${m.gloss ? `<div class="mkw-th-g">${esc(m.gloss)}</div>` : ''}<div class="mkw-chips">${m.words.map(x => `<button type="button" class="mkw-chip" data-w="${esc(x)}">${esc(x)}</button>`).join('')}</div>${m.antonyms.length ? `<div class="mkw-th-a">Antonyms: ${m.antonyms.map(x => `<button type="button" class="mkw-chip anto" data-w="${esc(x)}">${esc(x)}</button>`).join(' ')}</div>` : ''}</div>`).join('')}</section>`).join('');
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); draw(); } });
    inp.addEventListener('input', app.debounce(draw, 250));
    res.addEventListener('click', async e => {
      const b = e.target.closest('.mkw-chip'); if (!b) return;
      if (e.detail > 1) return;
      app.ui.ripple?.(b);
      if (thesTarget && await W.replaceTarget(thesTarget, b.dataset.w)) { toast(`Replaced with “${R.matchCase(thesTarget.word, b.dataset.w)}”.`); thesTarget = null; body.querySelector('.mkw-th-target').textContent = '—'; }
      else { inp.value = b.dataset.w; draw(); }
    });
    res.addEventListener('dblclick', e => { const b = e.target.closest('.mkw-chip'); if (!b) return; inp.value = b.dataset.w; draw(); });
    await draw();
    if (!thesWord) inp.focus();
  }

  // =================================================================== F7: step through spelling and grammar like Word's Editor
  async function editorReview() {
    const doc = app.docs.active();
    if (!doc || doc.kind !== 'markdown') { toast('Open a Markdown document to check it.', { kind: 'info' }); return; }
    try { app.editors.active()?.flush?.(); } catch {}
    toast('Checking spelling and grammar…');
    await W.check(doc);
    const st = W.state(doc);
    const ids = st.findings.filter(f => !f.wide || f.cat !== 'engagement').map(f => f.id);
    if (!ids.length) { toast('Spelling and grammar check complete. Markooj found nothing to fix.', { kind: 'info' }); return; }
    let changed = 0, k = 0;
    for (const id of ids) {
      k++;
      const f = st.all.find(x => x.id === id);
      if (!f || doc.text.slice(f.start, f.end) !== f.text || !st.findings.some(x => x.id === id)) continue;
      reveal(f);
      const fixes = W.fixesFor(f);
      const ex = W.explain(f);
      const ls = doc.text.lastIndexOf('\n', f.start - 1) + 1, le = (x => (x < 0 ? doc.text.length : x))(doc.text.indexOf('\n', f.end));
      const cs = Math.max(ls, f.start - 80), ce = Math.min(le, f.end + 80);
      const body = document.createElement('div'); body.className = 'mkw-f7';
      body.innerHTML = `<div class="mkw-f7-top"><span class="mkw-dot" style="background:${W.CAT_COLOR[f.cat]}"></span><b>${esc(f.title || '')}</b><span class="mkw-f7-n">${k} of ${ids.length}</span></div>
        <p class="mkw-f7-ctx">${cs > ls ? '…' : ''}${esc(doc.text.slice(cs, f.start))}<mark class="mkw-f7-hit c-${f.cat}">${esc(f.text)}</mark>${esc(doc.text.slice(f.end, ce))}${ce < le ? '…' : ''}</p>
        <p class="mkw-f7-msg">${esc(f.message || '')}</p>
        ${f.wide ? '' : `<label class="mkw-f7-lab" for="mkw-f7-to">Change to</label><input id="mkw-f7-to" class="txt" value="${esc(fixes[0] ?? f.text)}" spellcheck="false">
        ${fixes.length > 1 ? `<div class="mkw-chips" role="listbox" aria-label="Suggestions">${fixes.map(x => `<button type="button" class="mkw-chip" data-s="${esc(x)}">${esc(x === '' ? '(remove)' : x)}</button>`).join('')}</div>` : fixes.length ? '' : '<p class="mkw-c-none">No suggestions.</p>'}`}
        <details class="mkw-f7-why"><summary>Why?</summary><p>${esc(ex.text)}</p>${ex.wrong ? `<div class="mkw-ex wrong"><span>✕</span>${esc(ex.wrong)}</div>` : ''}${ex.right ? `<div class="mkw-ex right"><span>✓</span>${esc(ex.right)}</div>` : ''}</details>`;
      const input = body.querySelector('input');
      body.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => { input.value = b.dataset.s; input.focus(); }));
      const spelling = f.rule === 'spelling';
      const buttons = [{ label: 'Close', value: 'close' }];
      if (spelling) buttons.push({ label: 'Add to Dictionary', value: 'add' });
      buttons.push({ label: spelling ? 'Ignore All' : 'Ignore Rule', value: 'ignoreAll' }, { label: 'Ignore', value: 'ignore' });
      if (!f.wide) buttons.push({ label: 'Change', value: 'change', primary: true });
      else buttons[buttons.length - 1].primary = true;
      const v = await app.ui.dialog({ title: 'Spelling and Grammar', body, cancelValue: 'close', buttons });
      if (v === 'change') { const rep = input ? input.value : null; if (rep != null && rep !== f.text && await W.accept(f, rep, doc)) changed++; }
      else if (v === 'ignoreAll') { if (spelling) W.ignoreWord(f.text); else W.ignoreRule(f); }
      else if (v === 'add') W.addToDictionary(f.text);
      else if (v === 'ignore') W.dismiss(f, doc);
      else { W.setActive(null); return; }
    }
    W.setActive(null);
    toast(`Spelling and grammar check complete${changed ? ` (${changed} change${changed === 1 ? '' : 's'})` : ''}.`, { kind: 'info' });
  }
  W.editorReview = editorReview;
  /** Alt+F7: go to the next issue after the caret and open its card. */
  function nextIssue(dir = 1) {
    const doc = app.docs.active(); if (!doc) return;
    const list = W.state(doc).findings.filter(f => !f.wide); if (!list.length) { toast('No issues found.'); return; }
    let at = 0; try { const s = app.editors.active()?.getSelection?.(); if (s && s.start != null) at = dir > 0 ? s.end : s.start; } catch {}
    const cur = W.state(doc).cursor;
    let f;
    if (cur != null && list.find(x => x.id === cur)) { const i = list.findIndex(x => x.id === cur); f = list[(i + dir + list.length) % list.length]; }
    else f = dir > 0 ? list.find(x => x.start >= at) || list[0] : [...list].reverse().find(x => x.end <= at) || list[list.length - 1];
    W.state(doc).cursor = f.id;
    reveal(f);
    setTimeout(() => W.showCard(f, { focus: true }), 250);
  }

  // =================================================================== commands
  const mdOnly = () => app.docs.active()?.kind === 'markdown';
  cmd('review.spelling', { label: 'Spelling and Grammar', icon: 'spell', shortcut: 'F7', description: 'Go through spelling and grammar suggestions one by one: change, ignore, add to the dictionary, or see why.', category: 'Review', run: () => editorReview() });
  cmd('review.spellingAsYouType', { label: 'Check spelling as you type', icon: 'spell', category: 'Review', description: 'Show or hide red lines under words the dictionary does not know.', isActive: () => S.spell(), run() { const on = !S.spell(); app.settings.set('spellcheck', on); toast(on ? 'Spelling is checked as you type.' : 'Spelling is no longer checked as you type. Press F7 to check the whole document.'); } });
  cmd('review.writingAssistant', { label: 'Writing Assistant', icon: 'mkw-assist', category: 'Review', description: 'Open the pane with every suggestion by category, your writing score and goals.', isActive: () => W.pane.view === 'assistant', run: () => (W.pane.view === 'assistant' ? closePane() : openPane('assistant')) });
  cmd('review.thesaurus', { label: 'Thesaurus', icon: 'mkw-book', shortcut: 'Shift+F7', category: 'Review', description: 'See synonyms and antonyms of the selected word, grouped by meaning. Click one to use it.', isActive: () => W.pane.view === 'thesaurus', run: () => (W.pane.view === 'thesaurus' && !selectedWordTarget() ? closePane() : openThesaurus()) });
  cmd('writing.toggle', { label: 'Check writing as you type', icon: 'mkw-assist', category: 'Review', description: 'Show or hide the colored lines for grammar, clarity, engagement and delivery.', isActive: () => S.on(), run() { const on = !S.on(); app.settings.set('writingAssistant', on); toast(on ? 'Writing is checked as you type.' : 'Writing suggestions are hidden. Spelling still follows its own switch.'); } });
  cmd('writing.goals', { label: 'Goals', icon: 'mkw-goal', category: 'Review', description: 'Set audience, formality and domain (general, academic or business). Goals change which suggestions you see.', run: () => goalsDialog() });
  cmd('writing.acceptAll', { label: 'Accept all safe fixes', icon: 'mkw-accept', category: 'Review', description: 'Apply every fix that cannot change your meaning, in one step. Ctrl+Z takes them all back.', isEnabled: () => mdOnly() && W.safeCount() > 0, run() { const n = W.acceptAllSafe(); toast(n ? `Accepted ${n} fix${n === 1 ? '' : 'es'}. Press Ctrl+Z to undo.` : 'No safe fixes left.'); } });
  cmd('writing.nextIssue', { label: 'Next writing issue', icon: 'mkw-assist', shortcut: 'Alt+F7', category: 'Review', description: 'Go to the next underlined word and open its suggestion card.', isEnabled: mdOnly, run: () => nextIssue(1) });
  cmd('writing.prevIssue', { label: 'Previous writing issue', icon: 'mkw-assist', shortcut: 'Alt+Shift+F7', category: 'Review', description: 'Go to the previous underlined word and open its suggestion card.', isEnabled: mdOnly, run: () => nextIssue(-1) });
  cmd('writing.setLanguage', {
    label: 'Proofing language', icon: 'mkw-globe', category: 'Review', description: 'The language Markooj checks this document in. Saved as lang in the front matter.',
    isEnabled: mdOnly,
    run(a) {
      const code = a && typeof a === 'object' ? a.value : a; const doc = app.docs.active(); if (!code || !doc) return;
      if (app.shell?.setFrontMatter) app.shell.setFrontMatter(doc, { lang: code });
      else if (mk.frontMatter) { const fm = mk.frontMatter.parse(doc.text); doc.setText(mk.frontMatter.write(doc.text, { ...(fm.meta || {}), lang: code }), 'meta'); }
      toast(`Proofing language: ${W.languageFor({ meta: { lang: code } }).name}.`);
    },
  });
  cmd('writing.dictionary', { label: 'Edit my dictionary', icon: 'mkw-abc', category: 'Review', description: 'See and change the words you added to your dictionary.', run: () => dictionaryDialog() });
  cmd('writing.synonyms', { label: 'Synonyms', icon: 'mkw-book', category: 'Review', description: 'Show synonyms for the word at the cursor.', isEnabled: mdOnly, run: () => { const t = selectedWordTarget(); if (t) synonymsPopup(t); else openThesaurus(); } });
  cmd('writing.autocomplete', { label: 'Suggest words as I type', icon: 'mkw-complete', category: 'Review', description: 'Show the rest of a word in gray as you type. Tab or Right arrow accepts it; Esc hides it.', isActive: () => S.autocomplete(), run() { app.settings.set('writingAutocomplete', !S.autocomplete()); } });
  const TIPS = {
    'review.spelling': ['Spelling and Grammar', 'Go through spelling and grammar suggestions one by one, like Word’s Editor: Change, Ignore, Ignore All, Add to Dictionary, and Why?'],
    'review.spellingAsYouType': ['Check spelling as you type', 'Show or hide red lines under words the dictionary does not know. Right-click a red word for suggestions.'],
    'review.writingAssistant': ['Writing Assistant', 'Open the pane with your writing score, goals and every suggestion by category. Underlines: red correctness, blue clarity, green engagement, purple delivery.'],
    'review.thesaurus': ['Thesaurus', 'See synonyms and antonyms of the selected word, grouped by meaning. Click one to put it in place.'],
    'writing.toggle': ['Check writing as you type', 'Show or hide the colored lines for grammar, clarity, engagement and delivery. Markooj never changes your text by itself.'],
    'writing.goals': ['Goals', 'Audience, formality and domain (general, academic or business). Goals change which suggestions you see.'],
    'writing.acceptAll': ['Accept all safe fixes', 'Apply every fix that cannot change your meaning in one step. One Ctrl+Z takes them all back.'],
    'writing.nextIssue': ['Next writing issue', 'Go to the next underlined word and open its card.'],
    'writing.prevIssue': ['Previous writing issue', 'Go to the previous underlined word and open its card.'],
    'writing.setLanguage': ['Proofing language', 'The language Markooj checks this document in: English (US), English (UK) or an installed language pack. Saved as lang in the front matter.'],
    'writing.dictionary': ['Edit my dictionary', 'See, add or remove the words you taught Markooj.'],
    'writing.synonyms': ['Synonyms', 'Show synonyms for the word at the cursor. Right-click or double-click a word does the same.'],
    'writing.autocomplete': ['Suggest words as I type', 'Show the rest of a word in gray while you type. Tab or Right arrow accepts it; Esc hides it. Off by default.'],
  };
  for (const [id, [t, d]] of Object.entries(TIPS)) tip(id, t, d);

  // =================================================================== Review tab groups
  const big = (command, label, ic) => ({ type: 'big', command, label, icon: ic });
  const small = (command, label, ic) => ({ type: 'small', command, label, icon: ic });
  try { app.ribbon.removeGroup?.('review', 'rev-proof'); } catch {}
  app.ribbon.addGroup('review', { id: 'rev-proof', label: 'Proofing', order: 10, items: [
    big('review.spelling', 'Spelling & Grammar', 'spell'), big('review.thesaurus', 'Thesaurus', 'mkw-book'),
    { type: 'col', items: [small('review.wordCount', 'Word count', 'count'), small('review.readability', 'Readability', 'sparkle')] },
    { type: 'col', items: [small('review.spellingAsYouType', 'Check spelling as you type', 'spell'), small('writing.dictionary', 'My dictionary', 'mkw-abc')] },
  ] });
  app.ribbon.addGroup('review', { id: 'rev-writing', label: 'Writing', order: 12, items: [
    big('review.writingAssistant', 'Writing Assistant', 'mkw-assist'),
    { type: 'col', items: [small('writing.goals', 'Goals', 'mkw-goal'), small('writing.acceptAll', 'Accept safe fixes', 'mkw-accept')] },
    { type: 'col', items: [small('writing.toggle', 'Check writing as you type', 'mkw-assist'), small('writing.autocomplete', 'Suggest words', 'mkw-complete')] },
    { type: 'col', items: [{ type: 'select', command: 'writing.setLanguage', label: 'Language', width: 128, options: () => W.languages().map(l => ({ value: l.code, label: l.name })), value: () => W.languageFor(app.docs.active()).code }] },
  ] });

  // =================================================================== status bar: writing score
  let sbEl = null;
  app.status.addItem({ id: 'writing', side: 'left', order: 25, render(el) {
    sbEl = document.createElement('button'); sbEl.type = 'button'; sbEl.className = 'sb mkw-sb hide-narrow';
    sbEl.dataset.tip = 'Writing score'; sbEl.dataset.tipD = 'Your score from 0 to 100 and the number of suggestions. Click to open the Writing Assistant.';
    sbEl.addEventListener('click', () => app.commands.run('review.writingAssistant'));
    el.appendChild(sbEl); paintStatus(); requestAnimationFrame(paintStatus);
  } });
  function paintStatus() {
    if (!sbEl) return;
    const doc = app.docs.active();
    if (!doc || doc.kind !== 'markdown' || (!S.on() && !S.spell())) { sbEl.style.display = 'none'; return; }
    sbEl.style.display = '';
    const st = W.state(doc);
    if (st.text == null) { sbEl.innerHTML = `${ring(100, 16, 3).replace(/<text[\s\S]*?<\/text>/, '')}<span>Checking…</span>`; return; }
    const c = st.counts || {};
    sbEl.innerHTML = `${ring(st.score, 16, 3).replace(/<text[\s\S]*?<\/text>/, '')}<span>${st.score}</span>${R.CATS.filter(k => c[k]).map(k => `<i class="mkw-sb-c" style="background:${W.CAT_COLOR[k]}" title="${R.CAT_LABEL[k]}: ${c[k]}">${c[k]}</i>`).join('')}`;
    sbEl.setAttribute('aria-label', `Writing score ${st.score}. ${st.findings.length} suggestions.`);
  }
  ['writing:changed', 'doc:active', 'settings:changed'].forEach(ev => app.events.on(ev, () => requestAnimationFrame(paintStatus)));

  // =================================================================== File → Options → Writing
  function optRow(label, small, control) { const r = document.createElement('div'); r.className = 'opt-row'; r.innerHTML = `<div class="ol"><b>${esc(label)}</b>${small ? `<small>${esc(small)}</small>` : ''}</div><div class="oc"></div>`; r.querySelector('.oc').append(control); return r; }
  function switchRow(key, def, label, small) {
    if (app.shell?.settingSwitch) return app.shell.settingSwitch(key, def, label, small);
    const r = document.createElement('label'); r.className = 'opt-row'; const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = def ? app.settings.get(key, true) !== false : app.settings.get(key, false) === true; cb.addEventListener('change', () => app.settings.set(key, cb.checked));
    r.innerHTML = `<div class="ol"><b>${esc(label)}</b>${small ? `<small>${esc(small)}</small>` : ''}</div>`; r.append(cb); return r;
  }
  /** Keep a select in step with a setting another control may change (removes itself once the select leaves the page). */
  function syncSelect(sel, key, current) {
    const fn = p => { if (!sel.isConnected && sel.dataset.mounted) { app.events.off('settings:changed', fn); return; } sel.dataset.mounted = '1'; if (p && p.key === key && sel.value !== String(current())) sel.value = String(current()); };
    app.events.on('settings:changed', fn); requestAnimationFrame(() => { if (sel.isConnected) sel.dataset.mounted = '1'; });
  }
  function selectEl(options, value, onChange, label) { const s = document.createElement('select'); s.className = 'txt mkw-sel'; s.setAttribute('aria-label', label); for (const [v, l] of options) { const o = document.createElement('option'); o.value = v; o.textContent = l; if (String(v) === String(value)) o.selected = true; s.append(o); } s.addEventListener('change', () => onChange(s.value)); return s; }
  app.options.addSection({ id: 'writing', label: 'Writing', order: 22, render(el) {
    const pl = selectEl(W.languages().map(l => [l.code, l.name]), S.lang(), v => app.settings.set('proofingLanguage', v), 'Proofing language');
    syncSelect(pl, 'proofingLanguage', () => S.lang()); // the same setting is also in File → Options → Language
    el.append(optRow('Proofing language', 'Used for documents without lang: in their front matter. Also in Options → Language.', pl));
    el.append(switchRow('writingAssistant', true, 'Check writing as you type', 'Colored lines for grammar, clarity, engagement and delivery. Markooj never changes text by itself.'));
    el.append(switchRow('spellcheck', true, 'Check spelling as you type', 'Red lines under words the dictionary does not know.'));
    const n = document.createElement('input'); n.type = 'number'; n.min = '10'; n.max = '80'; n.step = '1'; n.className = 'txt mkw-num'; n.value = String(S.long()); n.setAttribute('aria-label', 'Long sentence length');
    n.addEventListener('change', () => { const v = Math.max(10, Math.min(80, Math.round(+n.value || 30))); n.value = String(v); app.settings.set('writingLongSentence', v); });
    el.append(optRow('Long sentences', 'Mark sentences longer than this many words.', n));
    const g = S.goals();
    const setG = (k, v) => app.settings.set('writingGoals', { ...S.goals(), [k]: v });
    el.append(optRow('Audience', 'Who will read your writing.', selectEl([['general', 'General'], ['knowledgeable', 'Knowledgeable'], ['expert', 'Expert']], g.audience, v => setG('audience', v), 'Audience')));
    el.append(optRow('Formality', 'Formal hides contractions and casual words.', selectEl([['informal', 'Informal'], ['neutral', 'Neutral'], ['formal', 'Formal']], g.formality, v => setG('formality', v), 'Formality')));
    el.append(optRow('Domain', 'Academic allows the passive voice and asks to spell out abbreviations.', selectEl([['general', 'General'], ['academic', 'Academic'], ['business', 'Business']], g.domain, v => setG('domain', v), 'Domain')));
    const cats = document.createElement('div'); cats.className = 'mkw-cats';
    for (const k of R.CATS) {
      const b = document.createElement('label'); b.className = 'mkw-catchk';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = S.cats()[k] !== false;
      cb.addEventListener('change', () => app.settings.set('writingCategories', { ...S.cats(), [k]: cb.checked }));
      b.append(cb); b.insertAdjacentHTML('beforeend', `<span class="mkw-dot" style="background:${W.CAT_COLOR[k]}"></span>${R.CAT_LABEL[k]}`);
      b.dataset.tip = R.CAT_LABEL[k]; b.dataset.tipD = catDesc[k];
      cats.append(b);
    }
    el.append(optRow('Show suggestions for', '', cats));
    el.append(switchRow('writingAutocomplete', false, 'Suggest words as I type', 'Shows the rest of a word in gray after three letters. Tab or Right arrow accepts; Esc hides it.'));
    el.append(switchRow('writingSynonymsOnDoubleClick', true, 'Show synonyms when I double-click a word', 'A small list of other words appears under the word.'));
    const acts = document.createElement('div'); acts.className = 'mkw-opt-acts';
    const b1 = document.createElement('button'); b1.type = 'button'; b1.className = 'btn'; b1.textContent = `My dictionary (${S.dict().length})…`; b1.addEventListener('click', () => dictionaryDialog().then(() => { b1.textContent = `My dictionary (${S.dict().length})…`; }));
    const ign = (app.settings.get('writingIgnoredRules', []) || []).length;
    const b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'btn'; b2.textContent = `Turn ignored rules back on (${ign})`; b2.disabled = !ign; b2.addEventListener('click', () => { W.resetIgnoredRules(); b2.textContent = 'Turn ignored rules back on (0)'; b2.disabled = true; toast('All writing rules are on again.'); });
    acts.append(b1, b2);
    el.append(optRow('Dictionary and rules', 'Words you added and rules you turned off.', acts));
    const lic = W.thesaurusLicense();
    el.insertAdjacentHTML('beforeend', `<p class="mkw-opt-note">Checking runs on this computer; your text never leaves it. Grammar: Harper (Apache-2.0). Spelling: Hunspell dictionaries from SCOWL (en-US, en-GB). Thesaurus: ${esc(lic.source)}.</p>`);
  } });
  async function dictionaryDialog() {
    const body = document.createElement('div'); body.className = 'mkw-dict';
    body.innerHTML = '<p class="mkw-g-note">One word per line. These words are never marked as misspelled, in any document.</p><textarea class="txt" rows="12" spellcheck="false" aria-label="My dictionary"></textarea>';
    const ta = body.querySelector('textarea'); ta.value = S.dict().join('\n');
    const v = await app.ui.dialog({ title: 'My dictionary', body, buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Save', value: 'ok', primary: true }] });
    if (v === 'ok') W.dictionary.set(ta.value.split(/\r?\n/));
  }
  W.dictionaryDialog = dictionaryDialog;

  // =================================================================== context menu for the document (keeps Cut/Copy/Paste and spelling)
  document.addEventListener('contextmenu', e => {
    const host = document.getElementById('editorHost');
    if (!host || !host.contains(e.target) || e.defaultPrevented) return;
    if (e.target.closest('a[href], img, .mk-math, .katex, pre.mermaid, video, audio, iframe, input')) return; // links and pictures keep the system menu
    const doc = app.docs.active(); if (!doc || doc.kind !== 'markdown' || app.mode === 'read') return;
    const items = [];
    const p = W.findingAt(e.clientX, e.clientY);
    if (p && !p.f.wide) {
      const f = p.f; const fixes = W.fixesFor(f).slice(0, 5);
      items.push({ header: f.title || 'Suggestion' });
      for (const r of fixes) items.push({ label: r === '' ? `Remove “${f.text.trim().slice(0, 30)}”` : r, icon: 'check', run: () => W.accept(f, r) });
      if (!fixes.length) items.push({ note: f.rule === 'spelling' ? 'No spelling suggestions.' : f.message });
      if (f.rule === 'spelling') { items.push({ label: 'Add to dictionary', icon: 'mkw-abc', run: () => W.addToDictionary(f.text) }, { label: 'Ignore all', icon: 'x', run: () => W.ignoreWord(f.text) }); }
      else items.push({ label: 'Dismiss', icon: 'x', run: () => W.dismiss(f) });
      items.push({ label: 'Why?…', icon: 'mkw-assist', run: () => { W.showCard(f); setTimeout(() => document.querySelector('.mkw-card .mkw-why')?.click(), 30); } });
      items.push({ sep: 1 });
    }
    const t = wordTargetAt(e.clientX, e.clientY);
    const lang = W.languageFor(doc);
    if (t && lang.english && /^[\p{L}][\p{L}'’-]*$/u.test(t.word) && t.word.length > 1) {
      const syn = W.synonymsSync(t.word, { before: textBefore(t) });
      if (syn && syn.flat.length) {
        items.push({ header: `Synonyms for “${t.word}”` });
        for (const w of syn.flat.filter(x => !x.includes(' ') || syn.flat.length < 5).slice(0, 6)) items.push({ label: R.matchCase(t.word, w), run: () => W.replaceTarget(t, w) });
      }
      items.push({ label: 'Thesaurus…', icon: 'mkw-book', shortcut: 'Shift+F7', run: () => openThesaurus(t.word, t) });
      items.push({ sep: 1 });
    }
    items.push({ label: 'Cut', icon: 'cut', shortcut: 'Ctrl+X', run: () => app.commands.run('edit.cut') });
    items.push({ label: 'Copy', icon: 'copy', shortcut: 'Ctrl+C', run: () => app.commands.run('edit.copy') });
    items.push({ label: 'Paste', icon: 'paste', shortcut: 'Ctrl+V', run: () => app.commands.run('edit.paste') });
    if (app.commands.get('edit.pastePlain')) items.push({ label: 'Paste as plain text', icon: 'doc', shortcut: 'Ctrl+Shift+V', run: () => app.commands.run('edit.pastePlain') });
    items.push({ sep: 1 }, { label: 'Select all', shortcut: 'Ctrl+A', run: () => { const ed = app.editors.active(); ed?.focus?.(); const ta = host.querySelector('textarea.mk-src-ta'); if (app.mode === 'simple' && ta) ta.select(); else document.execCommand('selectAll'); } });
    W.hideCard();
    app.ui.contextMenu(e, items);
  });

  // =================================================================== double-click → synonyms
  let synPop = null;
  function hideSyn() { if (synPop) { synPop.remove(); synPop = null; } }
  function targetRect(t) {
    if (t.range) return t.range.getBoundingClientRect();
    if (t.kind === 'simple') { const host = document.getElementById('editorHost'); const mirror = host?.querySelector('.mk-src-mirror'); const text = app.docs.active().text; const li = text.slice(0, t.start).split('\n').length - 1; const ln = mirror?.children[li]; if (ln) { const col = t.start - (text.lastIndexOf('\n', t.start - 1) + 1); const tw = document.createTreeWalker(ln, NodeFilter.SHOW_TEXT); let n, left = col; while ((n = tw.nextNode())) { if (left <= n.data.length) { const r = document.createRange(); r.setStart(n, left); r.setEnd(n, Math.min(n.data.length, left + t.word.length)); return r.getBoundingClientRect(); } left -= n.data.length; } } }
    return { left: innerWidth / 2, right: innerWidth / 2, top: innerHeight / 2, bottom: innerHeight / 2 };
  }
  // a few words of text before a target word (tells "the shows" from "the data shows")
  function textBefore(t) {
    try {
      if (t.kind === 'simple' && t.start != null) { const d = app.docs.active(); return d ? d.text.slice(Math.max(0, t.start - 40), t.start) : ''; }
      if (t.range) { const r = document.createRange(); const blk = t.range.startContainer.parentElement?.closest('p,li,td,th,h1,h2,h3,h4,h5,h6,blockquote,div') || t.range.startContainer.parentElement; if (!blk) return ''; r.setStart(blk, 0); r.setEnd(t.range.startContainer, t.range.startOffset); return r.toString().slice(-40); }
    } catch {}
    return '';
  }
  W.textBefore = textBefore;
  async function synonymsPopup(t) {
    hideSyn();
    const syn = await W.synonyms(t.word, { before: textBefore(t) }); if (!syn || !syn.flat.length) return;
    synPop = document.createElement('div'); synPop.className = 'mkw-syn'; synPop.setAttribute('role', 'dialog'); synPop.setAttribute('aria-label', `Synonyms for ${t.word}`);
    const words = syn.flat.filter(x => !x.includes(' ')).slice(0, 8);
    synPop.innerHTML = `<div class="mkw-syn-h">Synonyms for “${esc(t.word)}”</div><div class="mkw-chips">${words.map(w => `<button type="button" class="mkw-chip" data-w="${esc(w)}">${esc(R.matchCase(t.word, w))}</button>`).join('')}</div><button type="button" class="mkw-syn-more" data-tip="Thesaurus" data-tip-d="All meanings, synonyms and antonyms." data-key="Shift+F7">Thesaurus…</button>`;
    synPop.addEventListener('mousedown', e => e.preventDefault());
    synPop.addEventListener('click', async e => { const b = e.target.closest('.mkw-chip'); if (b) { app.ui.ripple?.(b); hideSyn(); await W.replaceTarget(t, b.dataset.w); } else if (e.target.closest('.mkw-syn-more')) { hideSyn(); openThesaurus(t.word, t); } });
    document.body.appendChild(synPop);
    const r = targetRect(t); const w = synPop.offsetWidth, h = synPop.offsetHeight;
    let x = Math.max(8, Math.min(r.left, innerWidth - w - 8)), y = r.bottom + 8; if (y + h > innerHeight - 8) y = r.top - h - 8;
    synPop.style.left = x + 'px'; synPop.style.top = y + 'px';
    requestAnimationFrame(() => synPop?.classList.add('show'));
  }
  W.synonymsPopup = synonymsPopup;
  document.addEventListener('dblclick', e => {
    const host = document.getElementById('editorHost');
    if (!S.synonymsOnDoubleClick() || !host?.contains(e.target) || e.target.closest(SKIP_DBL)) return;
    const doc = app.docs.active(); if (!doc || !W.languageFor(doc).english || app.mode === 'read') return;
    setTimeout(() => {
      const t = selectedWordTarget();
      if (!t || !/^[\p{L}][\p{L}'’-]{2,}$/u.test(t.word)) return;
      if (W.findingAt(e.clientX, e.clientY)) return; // the suggestion card wins
      synonymsPopup(t);
    }, 0);
  });
  const SKIP_DBL = '.mk-math,.katex,code,pre,.mk-cite,.mk-xref,.mk-front,a[href],img,.mk-comment';
  document.addEventListener('mousedown', e => { if (synPop && !synPop.contains(e.target)) hideSyn(); }, true);
  document.addEventListener('keydown', e => { if (synPop && !e.defaultPrevented) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); } hideSyn(); } }, true);
  window.addEventListener('scroll', () => hideSyn(), true);

  // =================================================================== word completion (ghost text)
  const AC = W.autocomplete = { enabled: () => S.autocomplete() };
  let ghost = null, ghostFor = null, dictWords = null, dictLang = null, docWords = null, docWordsFor = null;
  // The most common English words (function words are not in the WordNet ranking, so without this list "wou" became "wound")
  const COMMON = ('would which their there about because could should other these those after before where while through between '
    + 'although always another around against already during either enough every example first following further however include '
    + 'including information instead itself might never number often order people perhaps place point possible present probably '
    + 'problem public question rather really research result results right since small something sometimes still student students '
    + 'study system thing things think thought three together toward towards under until usually using water whether within without '
    + 'world years young yesterday tomorrow today morning evening believe different important available especially everything '
    + 'anything nothing someone everyone understand government company country children family business several second little large '
    + 'great better best general group house local national school social political based became become being below below beyond '
    + 'certain change changes common continue course data development during early effect either environment experience field figure '
    + 'following form further given going having health history human idea increase interest issue known language later level likely '
    + 'making means method methods model needs office often other paper particular period position power process program provide '
    + 'quite reason report required same section shown simple single source special state states support table their them themselves '
    + 'then therefore though times total toward type types used value values various version whole whose within working '
    + 'Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April June July August September October November December').split(' ');
  const COMMON_RANK = new Map(); COMMON.forEach((w, i) => { if (!COMMON_RANK.has(w.toLowerCase())) COMMON_RANK.set(w.toLowerCase(), i); });
  function lexicon(lang) {
    if (dictWords && dictLang === lang.code) return dictWords;
    const rank = W.thesaurusRank();
    let words = [];
    try { words = mk.spell?.words?.(lang.code) || []; } catch {}
    const rankIx = new Map((rank || []).map((w, i) => [w, i]));
    const english = /^en/i.test(lang.code || '');
    // WordNet writes names in lower case ("pakistan"): take the dictionary's spelling when it has only a capitalized one
    const lowerOk = new Set(), capOf = new Map();
    for (const w of words) { const l = w.toLowerCase(); if (w === l) lowerOk.add(l); else if (!capOf.has(l)) capOf.set(l, w); }
    const fromRank = (english ? rank || [] : []).map(w => (!lowerOk.has(w) && capOf.has(w) ? capOf.get(w) : w));
    const list = [...new Set([...(english ? COMMON : []), ...fromRank, ...words])].filter(w => w.length >= 4 && !/[A-Z]{2}/.test(w));
    // sorted by the lower-case form, the same key the search uses (a case-sensitive sort put every capital first)
    const keyed = list.map(w => [w.toLowerCase(), w]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    dictWords = { list: keyed.map(x => x[1]), keys: keyed.map(x => x[0]), rankIx }; dictLang = lang.code;
    return dictWords;
  }
  // Words of the document's prose (no code, math, links or front matter), without misspellings
  function documentWords(doc) {
    if (docWords && docWordsFor === doc.text) return docWords;
    const m = new Map();
    let prose = doc.text;
    try { prose = R.prose(doc.text).text; } catch {}
    for (const w of prose.match(/[\p{L}][\p{L}'’-]{3,}/gu) || []) m.set(w, (m.get(w) || 0) + 1);
    try {
      const lang = W.languageFor(doc); const list = [...m.keys()];
      const bad = mk.spell?.check?.(lang.code, list);
      if (Array.isArray(bad)) for (const i of bad) { const w = list[i]; if (!W.dictionary?.has?.(w)) m.delete(w); }
    } catch {}
    docWords = m; docWordsFor = doc.text;
    return m;
  }
  // a capitalized word (a name, a weekday) is offered for a lower-case start only when it is a common word too
  const caseFits = (prefix, w) => !(/^\p{Ll}/u.test(prefix) && /^\p{Lu}/u.test(w));
  /** Best completion for a prefix (3+ letters): words already in the document first, then common dictionary words. */
  AC.complete = function complete(prefix, doc = app.docs.active()) {
    if (!prefix || prefix.length < 3 || !/^[\p{L}][\p{L}'’-]*$/u.test(prefix)) return null;
    const lang = W.languageFor(doc); const low = prefix.toLowerCase();
    let best = null, bestScore = -Infinity;
    if (doc) for (const [w, c] of documentWords(doc)) {
      if (w.length < prefix.length + 2 || w.toLowerCase().slice(0, prefix.length) !== low || w.toLowerCase() === low || !caseFits(prefix, w)) continue;
      const s = 1000 + c * 10 - w.length;
      if (s > bestScore) { best = w; bestScore = s; }
    }
    if (!best) {
      const lex = lexicon(lang); const L = lex.list, K = lex.keys;
      let lo = 0, hi = K.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (K[mid] < low) lo = mid + 1; else hi = mid; }
      for (let i = lo; i < K.length && i < lo + 5000 && K[i].startsWith(low); i++) {
        const w = L[i]; if (w.length < prefix.length + 2 || !caseFits(prefix, w)) continue;
        const k = K[i];
        const cr = COMMON_RANK.get(k), r = lex.rankIx.get(k);
        const s = (cr != null ? 900 - cr : r != null ? 500 - Math.min(400, r / 40) : 0) - w.length * 2;
        if (s > bestScore) { best = w; bestScore = s; }
      }
    }
    if (!best) return null;
    return prefix + best.slice(prefix.length);
  };
  // Simple mode: no completion inside front matter, code or math (a light line scan up to the caret)
  function inNonProse(v, at) {
    const before = v.slice(0, at);
    const lines = before.split('\n');
    let fence = null, math = false, fm = false;
    lines.forEach((l, i) => {
      if (i === 0 && /^---\s*$/.test(l)) { fm = true; return; }
      if (fm) { if (i < lines.length - 1 && /^(---|\.\.\.)\s*$/.test(l)) fm = false; return; }
      if (fence) { if (i < lines.length - 1 && new RegExp('^\\s{0,3}' + fence + '\\s*$').test(l)) fence = null; return; }
      const m = /^\s{0,3}(`{3,}|~{3,})/.exec(l); if (m && i < lines.length - 1) { fence = m[1].replace(/[`~]/g, c => '\\' + c); return; }
      if (/^\s*\$\$/.test(l) && i < lines.length - 1 && !/\$\$.*\$\$/.test(l)) math = !math;
    });
    if (fm || fence || math) return true;
    const cur = lines[lines.length - 1];
    if (((cur.match(/`/g) || []).length % 2) === 1) return true;
    if (((cur.replace(/\\\$/g, '').match(/\$/g) || []).length % 2) === 1) return true;
    return /https?:\/\/\S*$|\\[A-Za-z]*$/.test(cur);
  }
  AC.inNonProse = inNonProse;
  const RTL_LETTER = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
  function hideGhost() { if (ghost) ghost.classList.remove('show'); ghostFor = null; }
  function ghostEl() { if (!ghost) { ghost = document.createElement('span'); ghost.className = 'mkw-ghost'; ghost.setAttribute('aria-hidden', 'true'); document.body.appendChild(ghost); } return ghost; }
  function caretInfo() {
    const ae = document.activeElement; const host = document.getElementById('editorHost');
    if (!ae || !host?.contains(ae)) return null;
    if (ae.tagName === 'TEXTAREA' && ae.classList.contains('mk-src-ta')) {
      if (ae.selectionStart !== ae.selectionEnd) return null;
      const v = ae.value, at = ae.selectionStart;
      if (/[\p{L}\p{N}]/u.test(v[at] || '')) return null;
      const m = /[\p{L}][\p{L}'’-]*$/u.exec(v.slice(Math.max(0, at - 40), at)); if (!m) return null;
      if (inNonProse(v, at)) return null;
      const t = { kind: 'simple', start: at, end: at, word: '' }; const rect = targetRect({ kind: 'simple', start: at - 1, word: ' ' });
      const ln = host.querySelector('.mk-src-mirror .ln');
      const rtl = RTL_LETTER.test(m[0]);
      return { prefix: m[0], rtl, rect: { left: rtl ? rect.left : rect.right, top: rect.top, bottom: rect.bottom }, font: ln ? getComputedStyle(ln) : getComputedStyle(ae), el: ae, t };
    }
    if (!ae.isContentEditable) return null;
    const sel = getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return null;
    const n = sel.anchorNode, off = sel.anchorOffset; if (!n || n.nodeType !== 3) return null;
    if (n.parentElement.closest('code,pre,.mk-math,.katex,.mk-front')) return null;
    if (/[\p{L}\p{N}]/u.test(n.data[off] || '')) return null;
    const m = /[\p{L}][\p{L}'’-]*$/u.exec(n.data.slice(Math.max(0, off - 40), off)); if (!m) return null;
    const r = document.createRange(); r.setStart(n, off - 1); r.setEnd(n, off);
    const rc = r.getBoundingClientRect();
    // an Urdu, Arabic or Persian word is drawn right to left: its end (where the ghost goes) is on the left
    const rtl = RTL_LETTER.test(m[0]);
    // Inline mode edits the Markdown itself: no completion inside its code or math either
    if (ae.classList.contains('mk-il-edit')) { const pr = document.createRange(); pr.setStart(ae, 0); pr.setEnd(n, off); const tb = pr.toString(); if (inNonProse(tb, tb.length)) return null; }
    return { prefix: m[0], rtl, rect: { left: rtl ? rc.left : rc.right, top: rc.top, bottom: rc.bottom }, font: getComputedStyle(n.parentElement), el: ae };
  }
  function updateGhost(e) {
    if (!S.autocomplete()) { hideGhost(); return; }
    if (e && e.inputType && !/^insert(Text|CompositionText)$/.test(e.inputType)) { hideGhost(); return; }
    const doc = app.docs.active(); if (!doc || doc.kind !== 'markdown' || doc.readOnly) { hideGhost(); return; }
    const ci = caretInfo(); if (!ci || ci.prefix.length < 3) { hideGhost(); return; }
    const full = AC.complete(ci.prefix, doc); if (!full) { hideGhost(); return; }
    const rest = full.slice(ci.prefix.length); if (!rest) { hideGhost(); return; }
    const g = ghostEl();
    g.textContent = rest;
    for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing']) g.style[k] = ci.font[k];
    const zoom = parseFloat(getComputedStyle(ci.el.closest('.mk-sheet') || ci.el).zoom) || 1;
    if (zoom !== 1) g.style.fontSize = (parseFloat(ci.font.fontSize) * zoom) + 'px';
    g.style.direction = ci.rtl ? 'rtl' : 'ltr';
    g.style.left = ci.rect.left + 'px'; g.style.top = ci.rect.top + 'px'; g.style.height = (ci.rect.bottom - ci.rect.top) + 'px'; g.style.lineHeight = (ci.rect.bottom - ci.rect.top) + 'px';
    if (ci.rtl) g.style.left = (ci.rect.left - g.offsetWidth) + 'px';
    g.classList.add('show'); ghostFor = { rest, el: ci.el, rtl: !!ci.rtl };
  }
  let justAccepted = false; // the text a completion just inserted does not start the next suggestion ("important" → "importantly")
  document.addEventListener('input', e => {
    if (!S.autocomplete()) { if (ghostFor) hideGhost(); return; }
    if (justAccepted) { justAccepted = false; hideGhost(); return; }
    const host = document.getElementById('editorHost'); if (host?.contains(e.target)) setTimeout(() => updateGhost(e), 0);
  }, true);
  app.events.on('settings:changed', p => { if (p && p.key === 'writingAutocomplete' && !p.value) hideGhost(); });
  window.addEventListener('keydown', e => {
    if (!ghostFor) return;
    // Tab, or the arrow that points forward in the writing direction (Right, or Left in right-to-left text)
    if ((e.key === 'Tab' || e.key === (ghostFor.rtl ? 'ArrowLeft' : 'ArrowRight')) && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && document.activeElement === ghostFor.el) {
      e.preventDefault(); e.stopImmediatePropagation();
      const rest = ghostFor.rest; hideGhost();
      justAccepted = true;
      document.execCommand('insertText', false, rest);
      setTimeout(() => { justAccepted = false; }, 0);
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); hideGhost(); return; }
    if (!/^(Shift|Control|Alt|Meta)$/.test(e.key)) hideGhost();
  }, true);
  document.addEventListener('mousedown', hideGhost, true);
  window.addEventListener('scroll', hideGhost, true);
  window.addEventListener('blur', hideGhost);
  AC.hide = hideGhost; AC.visible = () => !!ghostFor;

  // the thesaurus loads quietly after start, so menus have synonyms at once
  app.events.on('ready', () => setTimeout(() => W.loadThesaurus(), 2500));
})();
