// @name SI Units
// @description Typeset numbers with units: 5 m/s^2 becomes proper math
// @version 1.0
// @author Markooj
// @icon sigma
// @color #34c759
//
// Select text and click Add-ins → Format units. Quantities such as "5 m/s^2", "9.81 m s^-2",
// "25 °C", "3.2e-4 kg" or "10 µm" become LaTeX math like $5\,\mathrm{m/s^{2}}$, with a thin
// space between number and unit and upright unit letters, as journals expect.
// Text already inside math or code is left alone.

const PREFIX = '(?:da|[YZEPTGMkhdcmµμunpfaz])';
const BASE = '(?:mol|cd|Hz|Pa|Wb|lm|lx|Bq|Gy|Sv|kat|eV|bar|rad|sr|ohm|Ω|m|g|s|A|K|N|J|W|C|V|F|S|T|H|L|l)';
const SOLO = '(?:min|ha|°C|°F|°|%|ppm|ppb|h|d|t)';
const UNIT = `(?:${SOLO}|${PREFIX}?${BASE})`;
const EXP = '(?:\\^\\{?[-+−]?\\d+\\}?|[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+|[23](?![\\d.,]))';
const TERM = `${UNIT}${EXP}?`;
const SEP = '(?:\\s*/\\s*|\\s*[·⋅*]\\s*| )';
const NUM = '(-?\\d+(?:[.,]\\d+)?)(?:\\s*(?:[eE]([-+−]?\\d+)|[x×]\\s*10\\^\\{?([-+−]?\\d+)\\}?))?';
const QTY = new RegExp(`(^|[^\\w.$\\\\])${NUM}(\\s?)(${TERM}(?:${SEP}${TERM})*)(?![\\w°/^])`, 'g');
const PROTECT = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`|\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|<!--[\s\S]*?-->|\]\([^)]*\))/;
const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };

function unitTex(expr) {
  const termRe = new RegExp(`(${UNIT})(${EXP})?|(${SEP})`, 'g');
  let out = '', m;
  while ((m = termRe.exec(expr))) {
    if (m[3] !== undefined && m[1] === undefined) { out += m[3].trim() === '/' ? '/' : '\\,'; continue; }
    let u = m[1];
    let e = m[2] || '';
    if (e) e = e.replace(/[\^{}]/g, '').replace(/[⁰-⁹⁻⁺¹²³]/g, c => SUP[c] || c).replace('−', '-');
    if (u === '°C' || u === '°F') u = `{}^{\\circ}\\mathrm{${u[1]}}`;
    else if (u === '°') u = '{}^{\\circ}';
    else if (u === '%') u = '\\%';
    else if (u === 'Ω' || u === 'ohm') u = '\\Omega';
    else {
      const pre = /^(µ|μ)(.+)$/.exec(u);
      if (pre) u = `\\mu\\mathrm{${pre[2] === 'ohm' || pre[2] === 'Ω' ? '' : pre[2]}}` + (pre[2] === 'ohm' || pre[2] === 'Ω' ? '\\Omega' : '');
      else if (/Ω$|ohm$/.test(u)) u = `\\mathrm{${u.replace(/Ω$|ohm$/, '')}}\\Omega`;
      else u = `\\mathrm{${u}}`;
    }
    out += u + (e ? `^{${e}}` : '');
  }
  return out.replace(/\\mathrm\{([^{}]*)\}\/\\mathrm\{([^{}]*)\}/g, '\\mathrm{$1/$2}');
}
function numTex(n, e1, e2) {
  const exp = (e1 || e2 || '').replace('−', '-');
  const base = n.replace(',', '.');
  return exp ? `${base}\\times 10^{${exp.replace(/^\+/, '')}}` : base;
}
function formatUnits(text) {
  let count = 0;
  const parts = String(text).split(PROTECT);
  const out = parts.map((part, i) => {
    if (i % 2 === 1) return part;
    return part.replace(QTY, (all, lead, n, e1, e2, space, unit) => {
      if (/^[a-z]$/.test(unit) && !space) return all; // "5m" alone is ambiguous: needs "5 m"
      if (!space && /^(s|d|h|t|l|g)$/.test(unit)) return all; // 1990s, 3d, 2h...
      count++;
      const isPct = unit === '%';
      return `${lead}$${numTex(n, e1, e2)}${isPct ? '\\,' : '\\,'}${unitTex(unit)}$`;
    });
  });
  return { text: out.join(''), count };
}

app.commands.register('siunits.format', {
  label: 'Format numbers with units',
  icon: 'sigma',
  run: async () => {
    const d = app.docs.active();
    if (!d || d.kind !== 'markdown' || d.readOnly) { app.ui.toast('Open an editable Markdown document first.'); return; }
    const sel = markooj?.doc ? markooj.doc.selection : (app.editors.active()?.getSelection()?.text || '');
    if (sel && sel.trim()) {
      const r = formatUnits(sel);
      if (!r.count) { app.ui.toast('Select text with numbers and units, like 9.81 m/s2, then try again. The selection has none.'); return; }
      if (markooj?.doc) markooj.doc.replace_selection(r.text);
      else app.editors.active()?.replaceSelection(r.text);
      app.ui.toast(`Formatted ${r.count} ${r.count === 1 ? 'quantity' : 'quantities'}.`);
      return;
    }
    const r = formatUnits(d.text);
    if (!r.count) { app.ui.toast('Type numbers with units, like 9.81 m/s2, then try again. This document has none yet.'); return; }
    const ok = await app.ui.confirm('Format the whole document?', `Nothing is selected. Format all ${r.count} numbers with units in “${d.title}”? You can undo this.`);
    if (!ok) return;
    d.setText(r.text, 'addin');
    app.ui.toast(`Formatted ${r.count} ${r.count === 1 ? 'quantity' : 'quantities'}.`);
  },
});
app.ribbon.addGroup('addins', {
  id: 'siunits', label: 'Units', order: 62,
  items: [{ type: 'big', command: 'siunits.format', label: 'Format units', icon: 'sigma' }],
});

app.tests.register('add-in SI units: formats quantities', () => {
  const cases = [
    ['a = 5 m/s^2 here', 'a = $5\\,\\mathrm{m/s}^{2}$ here'],
    ['g is 9.81 m s^-2.', 'g is $9.81\\,\\mathrm{m}\\,\\mathrm{s}^{-2}$.'],
    ['at 25 °C', 'at $25\\,{}^{\\circ}\\mathrm{C}$'],
    ['size 10 µm', 'size $10\\,\\mu\\mathrm{m}$'],
    ['mass 3.2e-4 kg', 'mass $3.2\\times 10^{-4}\\,\\mathrm{kg}$'],
    ['keep $5 m$ and `5 m` alone, and the 1990s', 'keep $5 m$ and `5 m` alone, and the 1990s'],
  ];
  for (const [inp, want] of cases) {
    const got = formatUnits(inp).text;
    app.assert(got === want, `${inp} → ${got} (wanted ${want})`);
  }
});
