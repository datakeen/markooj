// @name Readability
// @description Flesch reading ease, grade level and long sentences
// @version 1.0
// @author Markooj
// @icon spell
// @color #ff9f0a
//
// Shows a reading-ease score in the status bar, a report (Add-ins → Readability) and can
// highlight sentences longer than 30 words without changing your text (CSS highlights).

const LONG_WORDS = 30;
const settingKey = 'readability.highlight';
let highlightOn = !!app.settings.get(settingKey, false);
let lastStats = null;
const roots = new Set();

if (!document.getElementById('mk-readability-style')) {
  const st = document.createElement('style');
  st.id = 'mk-readability-style';
  st.textContent = '::highlight(mk-long-sentence){background-color:rgba(255,159,10,.28)}' +
    '.mk-ra-list{margin:8px 0 0;padding-left:18px;max-height:220px;overflow:auto;font-size:12.5px;line-height:1.45}' +
    '.mk-ra-list li{margin-bottom:6px;color:var(--text-2)}' +
    '.mk-ra-grid{display:grid;grid-template-columns:auto auto;gap:4px 18px;font-size:13px;margin:4px 0 10px}' +
    '.mk-ra-grid b{font-variant-numeric:tabular-nums}';
  document.head.append(st);
}

// ---- text helpers ----
function plainText(md) {
  return String(md || '')
    .replace(/^﻿?---[\s\S]*?\n(---|\.\.\.)\s*\n/, '')
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/\$[^$\n]+\$|\\\([\s\S]*?\\\)/g, ' x ')
    .replace(/`[^`\n]*`/g, ' x ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[@[^\]]*\]|\[\^[^\]]*\]/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/^\s*\|?[-:| ]+\|?\s*$/gm, ' ')
    .replace(/[*_~=|#>]/g, ' ');
}
function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}
function splitSentences(text) {
  return text.split(/(?<=[.!?])\s+(?=["'(\[]?[A-Z0-9])|\n{2,}/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => /[A-Za-z]/.test(s));
}
function stats(md) {
  const sentences = splitSentences(plainText(md));
  let words = 0, syl = 0, complex = 0;
  const long = [];
  for (const s of sentences) {
    const ws = s.match(/[A-Za-z][A-Za-z'-]*/g) || [];
    words += ws.length;
    for (const w of ws) { const n = syllables(w); syl += n; if (n >= 3) complex++; }
    if (ws.length > LONG_WORDS) long.push({ text: s, words: ws.length });
  }
  const sc = Math.max(1, sentences.length), wc = Math.max(1, words);
  const ease = words ? 206.835 - 1.015 * (wc / sc) - 84.6 * (syl / wc) : 0;
  const grade = words ? 0.39 * (wc / sc) + 11.8 * (syl / wc) - 15.59 : 0;
  return { sentences: sentences.length, words, syllables: syl, complex, ease: Math.round(ease), grade: Math.max(0, Math.round(grade * 10) / 10), avg: Math.round((wc / sc) * 10) / 10, long };
}
function label(ease) {
  if (ease >= 90) return 'Very easy';
  if (ease >= 80) return 'Easy';
  if (ease >= 70) return 'Fairly easy';
  if (ease >= 60) return 'Plain English';
  if (ease >= 50) return 'Fairly difficult';
  if (ease >= 30) return 'Difficult';
  return 'Very difficult';
}

// ---- long-sentence highlighting (no DOM changes, so Word mode is safe) ----
function applyHighlights() {
  if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
  if (!highlightOn) { CSS.highlights.delete('mk-long-sentence'); return; }
  const ranges = [];
  for (const root of [...roots]) {
    if (!root.isConnected) { roots.delete(root); continue; }
    for (const block of root.querySelectorAll('p, li, td, dd, blockquote')) {
      if (block.querySelector('p, li')) continue;
      const nodes = [], starts = [];
      let full = '';
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
        acceptNode: n => n.parentElement && n.parentElement.closest('.katex, code, pre, .mk-comment') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
      });
      for (let n = walker.nextNode(); n; n = walker.nextNode()) { nodes.push(n); starts.push(full.length); full += n.nodeValue; }
      if (!nodes.length) continue;
      const locate = off => { let i = starts.length - 1; while (i > 0 && starts[i] > off) i--; return [nodes[i], Math.min(off - starts[i], nodes[i].nodeValue.length)]; };
      const re = /[^.!?]+(?:[.!?]+|$)/g;
      let m;
      while ((m = re.exec(full))) {
        if (!m[0]) { re.lastIndex++; continue; }
        const count = (m[0].match(/[A-Za-z][A-Za-z'-]*/g) || []).length;
        if (count <= LONG_WORDS) continue;
        const lead = m[0].length - m[0].trimStart().length;
        try {
          const r = new Range();
          const [sn, so] = locate(m.index + lead), [en, eo] = locate(m.index + m[0].length);
          r.setStart(sn, so); r.setEnd(en, eo); ranges.push(r);
        } catch {}
      }
    }
  }
  CSS.highlights.set('mk-long-sentence', new Highlight(...ranges));
}
app.hooks.postRender((el) => { roots.add(el); if (highlightOn) setTimeout(applyHighlights, 0); });

// ---- status bar ----
function recompute() {
  const d = app.docs.active();
  lastStats = d && d.kind === 'markdown' ? stats(d.text) : null;
  app.status.refresh();
}
const recomputeSoon = (app.debounce || ((f) => f))(recompute, 600);
app.events.on('doc:changed', recomputeSoon);
app.events.on('doc:active', recompute);
app.events.on('ready', recompute);
app.status.addItem({
  id: 'readability', side: 'left', order: 60,
  render(el) {
    el.textContent = '';
    if (!lastStats || lastStats.words < 20) { el.style.display = 'none'; return; }
    el.style.display = '';
    const b = document.createElement('button');
    b.className = 'sb';
    b.style.cssText = 'border:0;background:none;font:inherit;color:inherit';
    b.title = `Flesch reading ease ${lastStats.ease} (${label(lastStats.ease)}), grade ${lastStats.grade}. Click for the report.`;
    b.textContent = `Reading ease ${lastStats.ease}`;
    b.addEventListener('click', () => app.commands.run('readability.report'));
    el.append(b);
  },
});

// ---- commands + ribbon ----
app.commands.register('readability.report', {
  label: 'Readability report',
  icon: 'spell',
  run: async () => {
    const d = app.docs.active();
    if (!d || d.kind !== 'markdown') { app.ui.toast('Open a Markdown document first.'); return; }
    const s = stats(d.text);
    const esc = app.esc;
    const longList = s.long.slice(0, 12).map(x => `<li>${esc(x.text.length > 180 ? x.text.slice(0, 180) + '…' : x.text)} <b>(${x.words} words)</b></li>`).join('');
    const body = `<div class="mk-ra-grid">
        <span>Reading ease (Flesch)</span><b>${s.ease} · ${label(s.ease)}</b>
        <span>Grade level (Flesch–Kincaid)</span><b>${s.grade}</b>
        <span>Words · sentences</span><b>${s.words.toLocaleString('en-US')} · ${s.sentences.toLocaleString('en-US')}</b>
        <span>Average sentence</span><b>${s.avg} words</b>
        <span>Words with 3+ syllables</span><b>${s.words ? Math.round((s.complex / s.words) * 100) : 0}%</b>
      </div>
      <div style="font-size:12.5px;color:var(--text-2)">Research writing usually scores 10–40. Shorter sentences and plainer words raise the score.</div>
      ${s.long.length ? `<div style="margin-top:12px;font-weight:600">${s.long.length} sentence${s.long.length === 1 ? '' : 's'} longer than ${LONG_WORDS} words</div><ol class="mk-ra-list">${longList}</ol>` : '<div style="margin-top:12px">No sentences longer than 30 words.</div>'}`;
    const v = await app.ui.dialog({ title: 'Readability', body, buttons: [{ label: highlightOn ? 'Hide long sentences' : 'Highlight long sentences', value: 'hl' }, { label: 'Done', value: 'ok', primary: true }] });
    if (v === 'hl') app.commands.run('readability.highlight');
  },
});
app.commands.register('readability.highlight', {
  label: 'Highlight long sentences',
  icon: 'hl',
  isActive: () => highlightOn,
  run: () => {
    highlightOn = !highlightOn;
    app.settings.set(settingKey, highlightOn);
    applyHighlights();
    app.ui.toast(highlightOn ? `Long sentences (over ${LONG_WORDS} words) are highlighted.` : 'Long-sentence highlighting is off.');
  },
});
app.ribbon.addGroup('addins', {
  id: 'readability', label: 'Readability', order: 60,
  items: [
    { type: 'big', command: 'readability.report', label: 'Readability', icon: 'spell' },
    { type: 'big', command: 'readability.highlight', label: 'Long sentences', icon: 'hl' },
  ],
});
if (app.docs.active()) recompute();

// Self-test (runs in smoke mode with the other tests).
app.tests.register('add-in readability: scores text', () => {
  const s = stats('The cat sat on the mat. It was a sunny day and everyone was happy.');
  app.assert(s.sentences === 2 && s.words === 15 && s.ease > 80, JSON.stringify(s));
});
