// @name Word Frequency
// @description Insert a table of the most used words
// @version 1.0
// @author Markooj
// @icon count
// @color #5e5ce6
//
// Add-ins → Word list asks how many words to show, then inserts a Markdown table at the cursor.

const STOP = new Set(('a about above after again against all also am an and any are as at be because been before being below between both but by ' +
  'can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is ' +
  'it its itself just let me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some ' +
  'such than that the their theirs them themselves then there these they this those through to too under until up us very was we were what when where ' +
  'which while who whom why will with would you your yours yourself yourselves et al eg ie fig figure table see use used using one two may also however thus').split(/\s+/));

function plainText(md) {
  return String(md || '')
    .replace(/^﻿?---[\s\S]*?\n(---|\.\.\.)\s*\n/, '')
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$\n]+\$|\\\([\s\S]*?\\\)/g, ' ')
    .replace(/`[^`\n]*`|<!--[\s\S]*?-->|<[^>]+>|!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[@[^\]]*\]|\[\^[^\]]*\]|https?:\/\/\S+/g, ' ');
}
function topWords(md, { limit = 15, skipCommon = true, minLength = 3 } = {}) {
  const counts = new Map();
  let total = 0;
  for (const raw of plainText(md).toLowerCase().match(/[\p{L}][\p{L}'’-]*/gu) || []) {
    const w = raw.replace(/['’-]+$/, '').replace(/['’]s$/, '');
    if (w.length < minLength) continue;
    total++;
    if (skipCommon && STOP.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
  return { rows, total };
}
function toTable({ rows, total }) {
  const lines = ['| Rank | Word | Count | Share |', '|---:|---|---:|---:|'];
  rows.forEach(([w, n], i) => lines.push(`| ${i + 1} | ${w} | ${n} | ${total ? ((n / total) * 100).toFixed(1) : '0.0'}% |`));
  return lines.join('\n');
}

app.commands.register('wordfreq.insert', {
  label: app.tm('Insert word frequency table'),
  icon: 'count',
  run: async () => {
    const d = app.docs.active();
    if (!d || d.kind !== 'markdown' || d.readOnly) { app.ui.toast(app.t('Open an editable Markdown document first.')); return; }
    const body = document.createElement('div');
    body.innerHTML = `<div style="display:grid;grid-template-columns:auto 1fr;gap:10px 12px;align-items:center;min-width:320px">
        <label for="wf-n">${app.th('Number of words')}</label>
        <input id="wf-n" type="number" min="3" max="200" value="${Number(app.settings.get('wordfreq.n', 15))}" style="width:90px;height:28px;border-radius:7px;border:.5px solid var(--line-2);background:var(--surface);color:var(--text);padding:0 8px;font:inherit">
        <span></span><label><input id="wf-c" type="checkbox" ${app.settings.get('wordfreq.skip', true) ? 'checked' : ''}> ${app.th('Skip common words (the, and, of…)')}</label>
        <span></span><label><input id="wf-l" type="checkbox" checked> ${app.th('Ignore words shorter than 3 letters')}</label>
      </div>
      <p style="margin:12px 0 0;color:var(--text-2);font-size:12.5px">${app.th('The table goes where your cursor is. Math, code and links are not counted.')}</p>`;
    setTimeout(() => body.querySelector('#wf-n')?.select(), 60);
    const v = await app.ui.dialog({ title: app.t('Word frequency'), body, buttons: [{ label: app.t('Cancel'), value: 'cancel' }, { label: app.t('Insert table'), value: 'ok', primary: true }] });
    if (v !== 'ok') return;
    const limit = Math.max(3, Math.min(200, Number(body.querySelector('#wf-n').value) || 15));
    const skipCommon = body.querySelector('#wf-c').checked;
    const minLength = body.querySelector('#wf-l').checked ? 3 : 1;
    app.settings.set('wordfreq.n', limit); app.settings.set('wordfreq.skip', skipCommon);
    const res = topWords(d.text, { limit, skipCommon, minLength });
    if (!res.rows.length) { app.ui.toast(app.t('Write some text first, then count the words again.')); return; }
    const table = '\n\n' + toTable(res) + '\n\n: Most frequent words\n';
    if (markooj?.doc) markooj.doc.insert(table);
    else app.editors.active()?.insert(table);
    app.ui.toast(app.tn('Inserted the top {count} words.', res.rows.length));
  },
});
// A Save As format from an add-in: File → Save As → From add-ins → Word list (CSV)
app.exporter?.register?.({
  id: 'wordfreq-csv', label: app.tm('Word list (CSV)'), ext: 'csv',
  description: app.tm('Every word with its count, for Excel.'),
  run: doc => {
    const res = topWords(doc.text, { limit: 100000 });
    const NL = String.fromCharCode(13, 10);
    return 'word,count' + NL + res.rows.map(([w, n]) => `${w},${n}`).join(NL) + NL;
  },
});
app.ribbon.addGroup('addins', {
  id: 'wordfreq', label: app.tm('Word frequency'), order: 61,
  items: [{ type: 'big', command: 'wordfreq.insert', label: app.tm('Word list'), icon: 'count' }],
});

app.tests.register('add-in word frequency: counts words', () => {
  const r = topWords('Sediment moves. Sediment settles. The river carries sediment and $x$ math.', { limit: 3 });
  app.assert(r.rows[0][0] === 'sediment' && r.rows[0][1] === 3, JSON.stringify(r));
  app.assert(toTable(r).startsWith('| Rank | Word |'), 'table');
});
