// Markooj — visual equation editor (PLAN-v2 item 21).
// A big MathLive math field and a LaTeX box kept in sync both ways, palettes with templates, a matrix size picker,
// recent and favorite equations, Inline/Display, and a label + Numbered switch that write the Pandoc-crossref
// syntax `$$ … $$ {#eq:label}`. KaTeX \tag{} is never written: numbers come from app.xref (one numbering system).
// MathLive (MIT) is loaded locally from ../node_modules/mathlive/ — no network.
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const esc = app.esc || (s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const ML_BASE = '../node_modules/mathlive/';
  const abs = p => new URL(p, location.href).href;

  // our stylesheet, in case index.html does not link it
  (function ensureCss() {
    const add = () => {
      if ([...document.querySelectorAll('link[rel=stylesheet]')].some(l => /equation-editor\.css(\?|$)/.test(l.getAttribute('href') || ''))) return;
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'equation-editor.css'; document.head.appendChild(l);
    };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  })();

  // ------------------------------------------------------------------ MathLive (lazy ES module, local fonts, no sounds)
  let mlP = null;
  function load() {
    if (!mlP) {
      mlP = import(abs(ML_BASE + 'mathlive.min.mjs')).then(m => {
        const MFE = m.MathfieldElement || window.MathfieldElement;
        if (!MFE) throw new Error('MathLive did not load');
        try { MFE.fontsDirectory = abs(ML_BASE + 'fonts/'); } catch {}
        try { MFE.soundsDirectory = null; } catch {}
        try { MFE.keypressSound = null; MFE.plonkSound = null; } catch {}
        try { MFE.locale = 'en'; } catch {}
        try { MFE.decimalSeparator = '.'; } catch {}
        return m;
      }).catch(e => { mlP = null; throw e; });
    }
    return mlP;
  }
  app.events.on('ready', () => setTimeout(() => load().catch(() => {}), 2500)); // warm up so the first open is instant

  // ------------------------------------------------------------------ LaTeX helpers
  const settings = app.settings;
  const LABEL_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
  // 'eq:Shields Curve' → 'Shields-Curve' (the part after eq:)
  function normLabel(s) {
    return String(s || '').trim().replace(/^\{?#/, '').replace(/\}$/, '').replace(/^eq:/i, '').replace(/\s+/g, '-').replace(/[^A-Za-z0-9_.-]/g, '').replace(/^[.-]+/, '');
  }
  const fullLabel = s => { const n = normLabel(s); return n ? 'eq:' + n : ''; };
  // MathLive-only commands → plain LaTeX that KaTeX, Pandoc and LaTeX understand
  function cleanLatex(s) {
    let t = String(s ?? '');
    for (let i = 0; i < 4 && /\\placeholder/.test(t); i++) t = t.replace(/\\placeholder(?:\[[^\]]*\])?\{([^{}]*)\}/g, '{$1}');
    return t.replace(/\\mleft\b/g, '\\left').replace(/\\mright\b/g, '\\right')
      .replace(/\\differentialD\b/g, '\\mathrm{d}').replace(/\\capitalDifferentialD\b/g, '\\mathrm{D}')
      .replace(/\\exponentialE\b/g, '\\mathrm{e}').replace(/\\imaginaryI\b/g, '\\mathrm{i}').replace(/\\imaginaryJ\b/g, '\\mathrm{j}')
      .trim();
  }
  // Round-1 documents carry \tag{n} written by the old dialog: that was the second numbering system.
  // Numeric \tag{n} is stripped (the equation stays numbered, now by app.xref). A custom \tag{A} is the author's own and stays.
  // A \label{eq:x} inside the TeX moves to the label field (it is written back as {#eq:x}).
  function migrateTags(tex) {
    let t = String(tex || ''), numbered = false, tag = null, label = '';
    t = t.replace(/\s*\\tag\{\s*(\d+(?:\.\d+)*)\s*\}/g, (_m, x) => { numbered = true; tag = x; return ''; });
    t = t.replace(/\s*\\label\{\s*(eq:[^{}\s]+)\s*\}/, (_m, x) => { label = x; numbered = true; return ''; });
    return { tex: t.trim(), numbered, tag, label };
  }
  function usedLabels(text) {
    const s = String(text || '');
    return new Set([...s.matchAll(/\{#eq:([^}\s]+)[^}]*\}/g), ...s.matchAll(/\\label\{\s*eq:([^}\s]+)\s*\}/g)].map(m => m[1]));
  }
  function suggestLabel(tex, docText, except) {
    try {
      const s = app.xref?.suggestLabel?.('eq', { tex });
      const n = s && normLabel(s);
      if (n && n !== 'eq' && (n === except || !usedLabels(docText).has(n))) return n;
    } catch {}
    const t = String(tex || '');
    let base = '';
    const words = /\\(?:text|mathrm|operatorname)\{([A-Za-z][A-Za-z ]{2,})\}/.exec(t);
    if (words) base = words[1];
    else {
      const lhs = t.split(/=|\\approx|\\equiv|\\le(?:q)?\b|\\ge(?:q)?\b|<|>/)[0];
      base = lhs.replace(/\\(?:left|right|big|Big|bigg|Bigg|mathrm|mathbf|mathit|mathsf|boldsymbol|operatorname|d?frac|sqrt|hat|bar|vec|dot|ddot|tilde|overline|underline|mathcal|mathbb|text|quad|qquad|cdot|times|begin|end)\b/g, ' ')
        .replace(/\\([A-Za-z]+)/g, ' $1 ');
    }
    base = base.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().split('-').filter(Boolean).slice(0, 3).join('-').slice(0, 24);
    if (!base || /^\d/.test(base)) base = 'equation' + (base ? '-' + base : '');
    const used = usedLabels(docText); if (except) used.delete(except);
    let name = base, i = 2; while (used.has(name)) name = base + '-' + i++;
    return name;
  }
  const inlineDelims = (delim) => ((delim || settings.get('inlineMath', 'd')) === 'paren' ? ['\\(', '\\)'] : ['$', '$']);
  // The Markdown for an equation. Display equations with a label use the Pandoc-crossref form `$$\n…\n$$ {#eq:x}`;
  // `{-}` marks a display equation that stays unnumbered while "Number all equations" is on.
  function markdown(r) {
    const tex = String(r.tex || '').trim(); const label = fullLabel(r.label);
    if (!r.display) { const d = r.delim === 'paren' || r.delim === 'd' ? r.delim : null; const [o, c] = inlineDelims(d); return o + tex + c; }
    if (r.delim === 'bracket' && !label && !r.unnumbered) return `\\[\n${tex}\n\\]`;
    return `$$\n${tex}\n$$` + (label ? ` {#${label}}` : r.unnumbered ? ' {-}' : '');
  }
  const attrInfo = raw => ({ label: (/#(eq:[^\s}]+)/.exec(raw || '') || [])[1] || '', unnumbered: /(^|\s)(-|\.unnumbered)(\s|$)/.test(String(raw || '').trim()) });
  // Finds the math around [start, end] in Markdown source (for Simple mode: "edit the equation under the caret").
  function findInSource(text, start, end = start) {
    text = String(text || '');
    const fences = []; const fre = /^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n {0,3}\2[`~]*[ \t]*(?=\n|$)|$)/gm; let fm;
    while ((fm = fre.exec(text))) fences.push([fm.index, fm.index + fm[0].length]);
    const inFence = i => fences.some(([a, b]) => i >= a && i < b);
    const re = /\$\$([\s\S]+?)\$\$(?:[ \t]*\{([^}\n]*)\})?|\\\[([\s\S]+?)\\\](?:[ \t]*\{([^}\n]*)\})?|\\\(([\s\S]+?)\\\)|(?<![\\$\w])\$(?![\s$])((?:[^$\n\\]|\\.)+?)(?<![\s\\])\$(?![\d$])/g;
    let m;
    while ((m = re.exec(text))) {
      const a = m.index, b = a + m[0].length;
      if (a > end) break;
      if (b < start || inFence(a)) continue;
      if (start >= a && end <= b) {
        if (m[1] != null) return { start: a, end: b, tex: m[1].trim(), display: true, ...attrInfo(m[2]), delim: 'dd' };
        if (m[3] != null) return { start: a, end: b, tex: m[3].trim(), display: true, ...attrInfo(m[4]), delim: 'bracket' };
        if (m[5] != null) return { start: a, end: b, tex: m[5].trim(), display: false, label: '', unnumbered: false, delim: 'paren' };
        return { start: a, end: b, tex: m[6].trim(), display: false, label: '', unnumbered: false, delim: 'd' };
      }
    }
    return null;
  }
  // Label of a rendered equation (Word / Inline mode): preload puts data-label (and data-unnumbered) on the .mk-math span.
  function labelOf(el) {
    if (!el) return '';
    const holder = el.closest?.('.mk-math-block') || el;
    const dl = el.getAttribute?.('data-label') || holder.getAttribute?.('data-label');
    if (dl) return /^eq:/.test(dl) ? dl : (normLabel(dl) ? 'eq:' + normLabel(dl) : '');
    const id = el.id || holder.id || '';
    return /^eq:/.test(id) ? id : '';
  }
  const unnumberedOf = el => !!el && (el.getAttribute?.('data-unnumbered') === '1' || el.closest?.('.mk-math-block')?.getAttribute?.('data-unnumbered') === '1');
  function numberTextOf(el) {
    if (!el) return '';
    const no = el.querySelector?.(':scope > .mk-eqno') || el.closest?.('.mk-math-block')?.querySelector?.('.mk-eqno');
    return (no?.textContent || '').trim();
  }
  function numberAll() {
    try { const c = app.xref?.config?.(); if (c && 'numberAll' in c) return !!c.numberAll; } catch {}
    return !!settings.get('xrefNumberAll', false);
  }
  // \begin{equation} / align (unstarred) are numbered by app.xref even without a label
  const envNumbered = tex => /\\begin\{(equation|align|gather|multline|eqnarray|flalign|alignat)\}/.test(String(tex || ''));
  function previewNumber(label, opts) {
    const full = fullLabel(label);
    try { const v = full && app.xref?.numberOf?.(full); if (v) return /^\(/.test(String(v)) ? String(v) : `(${v})`; } catch {}
    if (opts.numberText && full === opts.origFull) return /^\(/.test(opts.numberText) ? opts.numberText : `(${opts.numberText})`;
    const text = app.docs.active()?.text || '';
    const chap = chapterGuess(text); if (chap) return chap;
    const all = [...text.matchAll(/\{#eq:([^}\s]+)\}/g)].map(m => m[1]);
    const i = all.indexOf(normLabel(label));
    const n = i >= 0 ? i + 1 : all.length + 1;
    try { const f = app.xref?.format?.('eq', n); if (f) return String(f); } catch {}
    return `(${n})`;
  }
  // chapter-style estimate for a new equation: the chapter and count at the caret ("(2.3)")
  function chapterGuess(text) {
    try {
      const x = app.xref, doc = app.docs.active();
      const m = x?.model?.(doc); if (!m || m.cfg?.style !== 'chapter') return '';
      let start = null; try { start = app.editors.active()?.getSelection?.()?.start; } catch {}
      const line = typeof start === 'number' && start >= 0 ? text.slice(0, start).split('\n').length - 1 : Infinity;
      const before = (m.items || []).filter(i => typeof i.line === 'number' && i.line < line);
      const lastEq = [...before].reverse().find(i => i.kind === 'eq' && i.num && !i.fixed);
      const lastChap = [...before].reverse().find(i => i.kind === 'sec' && i.level === m.chapterLevel && i.num);
      const sep = m.cfg.sep || '.';
      let num;
      if (lastEq && (!lastChap || lastChap.line < lastEq.line)) { const k = String(lastEq.num).split(sep); k[k.length - 1] = String(+k[k.length - 1] + 1); num = k.join(sep); }
      else num = `${lastChap ? lastChap.num : 0}${sep}1`;
      const f = x.format?.('eq', num);
      return f ? String(f) : `(${num})`;
    } catch { return ''; }
  }
  // KaTeX check: what the page will show (MathLive accepts a few things KaTeX does not)
  function katexProblem(tex) {
    if (!window.katex || !tex.trim()) return '';
    try { window.katex.renderToString(tex, { displayMode: true, throwOnError: true, macros: { ...(app.developer?.mathMacros?.() || {}) }, strict: 'ignore' }); return ''; }
    catch (e) { return String(e.message || e).replace(/^KaTeX parse error:\s*/, ''); }
  }
  function katexHTML(tex, display) {
    if (window.katex) { try { return window.katex.renderToString(tex, { displayMode: !!display, throwOnError: false, macros: { ...(app.developer?.mathMacros?.() || {}) }, strict: 'ignore' }); } catch {} }
    try { return display ? app.mk.displayMath(tex) : app.mk.inlineMath(tex); } catch { return esc(tex); }
  }
  // Developer → Math macros ({'\\R': '\\mathbb{R}'}) → MathLive macro dictionary
  function mlMacros() {
    const out = {};
    try {
      for (const [k, v] of Object.entries(app.developer?.mathMacros?.() || {})) {
        const name = String(k).replace(/^\\/, ''); if (!/^[A-Za-z]+$/.test(name)) continue;
        const def = String(v); const args = Math.max(0, ...[...def.matchAll(/#(\d)/g)].map(m => +m[1]));
        out[name] = { args, def, captureSelection: true, expand: false };
      }
    } catch {}
    return out;
  }

  // ------------------------------------------------------------------ palettes (MathLive templates: #0 selection, #? placeholder, #@ previous)
  const T = (tpl, show, name, keys) => ({ tpl, show: show || tpl, name: name || show || tpl, keys });
  const S = (list, names = {}) => list.split(' ').map(x => ({ tpl: x, show: x, name: names[x] || x }));
  const fn = (n) => T(`\\${n}\\left(#0\\right)`, `\\${n}`, n[0].toUpperCase() + n.slice(1), n);
  const UNIT = (u, show, name) => T(/^\\%|^\^/.test(u) ? u : '\\,' + u, show || u, name);
  const PALETTES = [
    { id: 'basic', label: app.tm('Basic'), items: [
      T('\\frac{#0}{#?}', '\\frac{a}{b}', app.tm('Fraction'), '/'), T('#@^{#?}', 'x^{2}', app.tm('Superscript'), '^'), T('#@_{#?}', 'x_{i}', app.tm('Subscript'), '_'),
      T('#@_{#?}^{#?}', 'x_{i}^{2}', app.tm('Subscript and superscript')), T('\\sqrt{#0}', '\\sqrt{x}', app.tm('Square root'), 'sqrt'), T('\\sqrt[#?]{#0}', '\\sqrt[n]{x}', app.tm('Root')),
      T('\\frac{\\mathrm{d}#?}{\\mathrm{d}#?}', '\\frac{dy}{dx}', app.tm('Derivative')), T('\\frac{\\partial #?}{\\partial #?}', '\\frac{\\partial f}{\\partial x}', app.tm('Partial derivative')),
      T('\\binom{#?}{#?}', '\\binom{n}{k}', app.tm('Binomial')), T('\\left|#0\\right|', '|x|', app.tm('Absolute value')), T('\\overline{#0}', '\\overline{x}', app.tm('Mean (bar)')),
      T('e^{#?}', 'e^{x}', app.tm('Exponential')), T('\\log_{#?}\\left(#0\\right)', '\\log_{b}x', app.tm('Logarithm')), fn('ln'), fn('log'), fn('exp'),
      fn('sin'), fn('cos'), fn('tan'), T('#@\\times10^{#?}', 'a{\\times}10^{n}', app.tm('Scientific notation')), T('\\text{#0}', '\\text{abc}', app.tm('Text')),
      T('#@^{\\prime}', "f'", app.tm('Prime')), T('\\boxed{#0}', '\\boxed{x}', app.tm('Box')), T('#@^{\\circ}', 'x^{\\circ}', app.tm('Degrees')),
    ] },
    { id: 'big', label: app.tm('Big operators'), items: [
      T('\\sum_{#?}^{#?}#0', '\\sum_{i=1}^{n}', app.tm('Sum with limits'), 'sum'), T('\\sum_{#?}#0', '\\sum_{i}', app.tm('Sum')), T('\\prod_{#?}^{#?}#0', '\\prod_{i=1}^{n}', app.tm('Product'), 'prod'),
      T('\\int_{#?}^{#?}#0\\,\\mathrm{d}#?', '\\int_{a}^{b} f\\,dx', app.tm('Definite integral'), 'int'), T('\\int #0\\,\\mathrm{d}#?', '\\int f\\,dx', app.tm('Integral')),
      T('\\iint_{#?}#0\\,\\mathrm{d}A', '\\iint_{D}', app.tm('Double integral')), T('\\iiint_{#?}#0\\,\\mathrm{d}V', '\\iiint_{V}', app.tm('Triple integral')), T('\\oint_{#?}#0', '\\oint_{C}', app.tm('Contour integral')),
      T('\\lim_{#?\\to #?}#0', '\\lim_{x\\to 0}', app.tm('Limit'), 'lim'), T('\\lim_{#?\\to\\infty}#0', '\\lim_{n\\to\\infty}', app.tm('Limit to infinity')),
      T('\\bigcup_{#?}^{#?}#0', '\\bigcup_{i=1}^{n}', app.tm('Union')), T('\\bigcap_{#?}^{#?}#0', '\\bigcap_{i=1}^{n}', app.tm('Intersection')),
      T('\\max_{#?}#0', '\\max_{x}', app.tm('Maximum')), T('\\min_{#?}#0', '\\min_{x}', app.tm('Minimum')), T('\\sup_{#?}#0', '\\sup_{x}', app.tm('Supremum')), T('\\inf_{#?}#0', '\\inf_{x}', app.tm('Infimum')),
      T('\\operatorname*{arg\\,min}_{#?}#0', '\\operatorname*{arg\\,min}_{x}', app.tm('Arg min')), T('\\coprod_{#?}^{#?}#0', '\\coprod_{i}', app.tm('Coproduct')),
    ] },
    { id: 'brackets', label: app.tm('Brackets'), items: [
      T('\\left(#0\\right)', '\\left(x\\right)', app.tm('Parentheses that grow')), T('\\left[#0\\right]', '\\left[x\\right]', app.tm('Square brackets that grow')),
      T('\\left\\{#0\\right\\}', '\\left\\{x\\right\\}', app.tm('Braces that grow')), T('\\left|#0\\right|', '\\left|x\\right|', app.tm('Bars that grow')),
      T('\\left\\|#0\\right\\|', '\\left\\|x\\right\\|', app.tm('Norm')), T('\\left\\langle #0\\right\\rangle', '\\left\\langle x\\right\\rangle', app.tm('Angle brackets')),
      T('\\left\\lfloor #0\\right\\rfloor', '\\lfloor x\\rfloor', app.tm('Floor')), T('\\left\\lceil #0\\right\\rceil', '\\lceil x\\rceil', app.tm('Ceiling')),
      T('\\left.#0\\right|_{#?}', '\\left.f\\right|_{a}', app.tm('Evaluated at')), T('\\left[#0\\right)', '\\left[a,b\\right)', app.tm('Half-open interval')),
      T('\\left(#0\\right]', '\\left(a,b\\right]', app.tm('Half-open interval')), T('\\underbrace{#0}_{#?}', '\\underbrace{a+b}_{n}', app.tm('Brace below')),
      T('\\overbrace{#0}^{#?}', '\\overbrace{a+b}^{n}', app.tm('Brace above')),
    ] },
    { id: 'matrix', label: app.tm('Matrix'), custom: 'matrix' },
    { id: 'accents', label: app.tm('Accents'), items: [
      T('\\hat{#0}', '\\hat{x}', app.tm('Hat')), T('\\bar{#0}', '\\bar{x}', app.tm('Bar')), T('\\overline{#0}', '\\overline{AB}', app.tm('Line over')), T('\\underline{#0}', '\\underline{x}', app.tm('Line under')),
      T('\\vec{#0}', '\\vec{v}', app.tm('Vector arrow')), T('\\overrightarrow{#0}', '\\overrightarrow{AB}', app.tm('Long arrow over')), T('\\dot{#0}', '\\dot{x}', app.tm('Dot (time derivative)')),
      T('\\ddot{#0}', '\\ddot{x}', app.tm('Double dot')), T('\\tilde{#0}', '\\tilde{x}', app.tm('Tilde')), T('\\widehat{#0}', '\\widehat{xy}', app.tm('Wide hat')), T('\\widetilde{#0}', '\\widetilde{xy}', app.tm('Wide tilde')),
      T('\\mathbf{#0}', '\\mathbf{x}', app.tm('Bold')), T('\\boldsymbol{#0}', '\\boldsymbol{\\sigma}', app.tm('Bold symbol')), T('\\mathrm{#0}', '\\mathrm{x}', app.tm('Upright')),
      T('\\mathbb{#0}', '\\mathbb{R}', app.tm('Blackboard bold')), T('\\mathcal{#0}', '\\mathcal{L}', app.tm('Calligraphic')), T('\\mathit{#0}', '\\mathit{x}', app.tm('Italic')),
    ] },
    { id: 'greek', label: app.tm('Greek'), items: S('\\alpha \\beta \\gamma \\delta \\epsilon \\varepsilon \\zeta \\eta \\theta \\vartheta \\iota \\kappa \\lambda \\mu \\nu \\xi \\pi \\rho \\varrho \\sigma \\tau \\upsilon \\phi \\varphi \\chi \\psi \\omega \\Gamma \\Delta \\Theta \\Lambda \\Xi \\Pi \\Sigma \\Upsilon \\Phi \\Psi \\Omega') },
    { id: 'symbols', label: app.tm('Symbols'), items: [
      ...S('+ - \\pm \\mp \\times \\div \\cdot \\ast \\star \\circ \\bullet \\nabla \\partial \\infty \\cap \\cup \\setminus \\oplus \\otimes \\forall \\exists \\neg \\land \\lor \\emptyset \\hbar \\ell \\Re \\Im \\aleph \\dots \\cdots \\vdots \\ddots \\%'),
      ...S('= \\neq \\approx \\sim \\simeq \\cong \\equiv \\propto < > \\le \\ge \\ll \\gg \\in \\notin \\ni \\subset \\supset \\subseteq \\supseteq \\perp \\parallel \\mid \\doteq \\prec \\succ'),
    ] },
    { id: 'arrows', label: app.tm('Arrows'), items: S('\\to \\leftarrow \\rightarrow \\Rightarrow \\Leftarrow \\leftrightarrow \\Leftrightarrow \\mapsto \\uparrow \\downarrow \\updownarrow \\nearrow \\searrow \\nwarrow \\swarrow \\longrightarrow \\longleftarrow \\Longrightarrow \\implies \\iff \\rightleftharpoons \\hookrightarrow \\leadsto') },
    { id: 'units', label: app.tm('Units'), items: [
      T('\\,\\mathrm{#?}', '\\square\\,\\mathrm{unit}', app.tm('Any unit')), UNIT('\\mathrm{m}', 0, app.tm('meter')), UNIT('\\mathrm{cm}', 0, app.tm('centimeter')), UNIT('\\mathrm{mm}', 0, app.tm('millimeter')),
      UNIT('\\mu\\mathrm{m}', 0, app.tm('micrometer')), UNIT('\\mathrm{km}', 0, app.tm('kilometer')), UNIT('\\mathrm{s}', 0, app.tm('second')), UNIT('\\mathrm{min}', 0, app.tm('minute')), UNIT('\\mathrm{h}', 0, app.tm('hour')),
      UNIT('\\mathrm{kg}', 0, app.tm('kilogram')), UNIT('\\mathrm{g}', 0, app.tm('gram')), UNIT('\\mathrm{N}', 0, app.tm('newton')), UNIT('\\mathrm{Pa}', 0, app.tm('pascal')), UNIT('\\mathrm{kPa}', 0, app.tm('kilopascal')),
      UNIT('\\mathrm{J}', 0, app.tm('joule')), UNIT('\\mathrm{W}', 0, app.tm('watt')), UNIT('\\mathrm{K}', 0, app.tm('kelvin')), UNIT('^{\\circ}\\mathrm{C}', '^{\\circ}\\mathrm{C}', app.tm('degree Celsius')),
      UNIT('\\mathrm{mol}', 0, app.tm('mole')), UNIT('\\mathrm{Hz}', 0, app.tm('hertz')), UNIT('\\mathrm{V}', 0, app.tm('volt')), UNIT('\\mathrm{A}', 0, app.tm('ampere')), UNIT('\\Omega', 0, app.tm('ohm')), UNIT('\\mathrm{L}', 0, app.tm('liter')),
      UNIT('\\mathrm{m/s}', 0, app.tm('meter per second')), UNIT('\\mathrm{m/s^{2}}', 0, app.tm('meter per second squared')), UNIT('\\mathrm{m^{2}}', 0, app.tm('square meter')), UNIT('\\mathrm{m^{3}}', 0, app.tm('cubic meter')),
      UNIT('\\mathrm{m^{3}/s}', 0, app.tm('cubic meter per second')), UNIT('\\mathrm{kg/m^{3}}', 0, app.tm('kilogram per cubic meter')), UNIT('\\%', '\\%', app.tm('percent')),
    ] },
    { id: 'recent', label: app.tm('Recent'), custom: 'recent' },
  ];
  const MATRIX_KINDS = [['pmatrix', '\\left(\\,\\right)', app.tm('Parentheses')], ['bmatrix', '\\left[\\,\\right]', app.tm('Square brackets')], ['vmatrix', '\\left|\\,\\right|', app.tm('Determinant')],
    ['Vmatrix', '\\left\\|\\,\\right\\|', app.tm('Norm')], ['Bmatrix', '\\left\\{\\,\\right\\}', app.tm('Braces')], ['matrix', '\\square', app.tm('No brackets')]];
  function matrixTpl(r, c, kind) {
    const row = Array(c).fill('#?').join(' & ');
    return `\\begin{${kind}}${Array(r).fill(row).join('\\\\')}\\end{${kind}}`;
  }
  const HELP = [['/', app.tm('fraction')], ['^', app.tm('power')], ['_', app.tm('index')], ['sqrt', '√'], ['alpha', 'α'], ['sum', '∑'], ['int', '∫'], ['->', '→'], ['<=', '≤'], ['!=', '≠'], ['Tab', app.tm('next box')]];

  // icons (mock style: 24px grid, stroke)
  const IC = {
    kb: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9"/>',
    star: '<path d="m12 3.6 2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.6l-5.1 2.7.98-5.68L3.75 9.6l5.7-.83z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.85.8c0 1.7-2.45 2.2-2.45 3.6M12 17h.01"/>',
  };
  const svg = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
  function el(tag, attrs = {}, html) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v === true ? '' : v); }
    if (html != null) e.innerHTML = html;
    return e;
  }

  // recent + favorites (settings: eqRecent, eqFavorites)
  const recent = () => (settings.get('eqRecent', []) || []).filter(x => typeof x === 'string');
  const favorites = () => (settings.get('eqFavorites', []) || []).filter(x => typeof x === 'string');
  function remember(tex) { if (!tex) return; settings.set('eqRecent', [tex, ...recent().filter(x => x !== tex)].slice(0, 18)); }
  function toggleFavorite(tex) {
    const f = favorites(); const on = !f.includes(tex);
    settings.set('eqFavorites', on ? [tex, ...f].slice(0, 30) : f.filter(x => x !== tex)); return on;
  }

  // arrow-key movement in a grid of buttons (columns found from layout)
  function gridNav(container, sel, e) {
    const btns = [...container.querySelectorAll(sel)].filter(b => b.offsetParent);
    const i = btns.indexOf(document.activeElement); if (i < 0) return false;
    let j = -1; const cur = btns[i].getBoundingClientRect();
    if (e.key === 'ArrowRight') j = Math.min(btns.length - 1, i + 1);
    else if (e.key === 'ArrowLeft') j = Math.max(0, i - 1);
    else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = btns.length - 1;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const down = e.key === 'ArrowDown'; let best = null, bd = Infinity;
      btns.forEach((b, k) => { const r = b.getBoundingClientRect(); if (down ? r.top <= cur.top + 2 : r.top >= cur.top - 2) return; const dy = Math.abs(r.top - cur.top), dx = Math.abs(r.left - cur.left); const d = dy * 1000 + dx; if (d < bd) { bd = d; best = k; } });
      if (best == null) return true; j = best;
    } else return false;
    btns[j].focus(); btns[j].scrollIntoView({ block: 'nearest' }); return true;
  }

  // ------------------------------------------------------------------ the dialog
  let current = null;
  function open(opts = {}) {
    if (current) { current.focusField(); return current.promise; }
    const docText = app.docs.active()?.text || '';
    const mig = migrateTags(opts.tex || '');
    const editing = !!opts.editing || !!String(opts.tex || '').trim();
    let display = opts.display ?? settings.get('eqDisplay', true);
    const origFull = fullLabel(opts.label || mig.label);
    let label = normLabel(opts.label || mig.label);
    // numbered automatically (no label needed) when "Number all equations" is on or the TeX is \begin{equation}/align
    let taRef = null;
    const autoNum = () => numberAll() || envNumbered(taRef ? taRef.value : mig.tex);
    let numbered = !!label || mig.numbered || (opts.unnumbered ? false : opts.numbered ?? (editing ? autoNum() : display && numberAll()));
    if (numbered && !label && !autoNum()) label = suggestLabel(mig.tex, docText);
    let lastLabel = label;
    const ctx = { origFull, numberText: opts.numberText || '' };
    let tabId = settings.get('eqTab', 'basic'); if (!PALETTES.some(p => p.id === tabId)) tabId = 'basic';
    let mf = null, target = 'visual', fromLatex = false, closed = false, resolveP;
    const promise = new Promise(r => { resolveP = r; });

    // --- skeleton
    const scrim = el('div', { class: 'mkeq-scrim' });
    const box = el('div', { class: 'mkeq', role: 'dialog', 'aria-modal': 'true', 'aria-label': editing ? app.t('Edit equation') : app.t('Insert equation'), 'data-mk-keys': 'own' });
    const head = el('div', { class: 'mkeq-head' });
    const h3 = el('h3', { text: editing ? app.t('Edit equation') : app.t('Insert equation') });
    const seg = el('div', { class: 'mkeq-seg', role: 'radiogroup', 'aria-label': app.t('Placement') });
    const thumb = el('span', { class: 'thumb' });
    const bInline = el('button', { type: 'button', role: 'radio', title: app.t('Inline: inside the line of text (Alt+D switches)'), text: app.t('Inline') });
    const bDisplay = el('button', { type: 'button', role: 'radio', title: app.t('Display: on its own line, centered, can be numbered (Alt+D switches)'), text: app.t('Display') });
    seg.append(thumb, bInline, bDisplay);
    const bFav = el('button', { type: 'button', class: 'mkeq-ghost', title: app.t('Add to favorites (Alt+F)'), 'aria-label': app.t('Add to favorites'), 'aria-pressed': 'false' }, svg('star'));
    const bKb = el('button', { type: 'button', class: 'mkeq-ghost', title: app.t('Math keyboard on screen (Alt+K)'), 'aria-label': app.t('Math keyboard'), 'aria-pressed': 'false' }, svg('kb') + `<span class="lbl">${app.th('Keyboard')}</span>`);
    const bHelp = el('button', { type: 'button', class: 'mkeq-ghost', title: app.t('Typing shortcuts (Alt+H)'), 'aria-label': app.t('Typing shortcuts'), 'aria-pressed': 'false' }, svg('help'));
    head.append(h3, bFav, bHelp, bKb, seg);

    const tabs = el('div', { class: 'mkeq-tabs', role: 'tablist', 'aria-label': app.t('Equation palettes') });
    const ink = el('span', { class: 'ink' });
    const tabBtns = PALETTES.map((p, i) => el('button', { type: 'button', class: 'mkeq-tab', role: 'tab', 'data-id': p.id, title: app.t('{palette} (Alt+{key})', { palette: app.t(p.label), key: i === 9 ? 0 : i + 1 }), text: app.t(p.label), tabindex: '-1' }));
    tabs.append(...tabBtns, ink);
    const pal = el('div', { class: 'mkeq-pal', role: 'tabpanel' });

    const body = el('div', { class: 'mkeq-body' });
    const stage = el('div', { class: 'mkeq-stage' });
    const fieldHost = el('div', { class: 'mkeq-field' }, `<div class="loading" aria-label="${app.th('Loading the visual editor')}"></div>`);
    const num = el('div', { class: 'mkeq-num', 'aria-live': 'polite', title: app.t('The number updates by itself when equations move') });
    stage.append(fieldHost, num);
    const help = el('div', { class: 'mkeq-help', 'aria-label': app.t('Typing shortcuts') }, HELP.map(([k, v]) => `<span><kbd>${esc(k)}</kbd>${esc(app.t(v))}</span>`).join(''));
    const texWrap = el('div', { class: 'mkeq-tex' });
    const texCap = el('label', { class: 'cap', for: 'mkeq-latex' }, `LaTeX <span class="sync">${app.th('Synced with the equation above')}</span>`);
    const ta = el('textarea', { id: 'mkeq-latex', spellcheck: 'false', rows: '2', 'aria-label': app.t('LaTeX source (Alt+T)'), placeholder: app.t('Or type LaTeX here, for example \\frac{a}{b}') });
    ta.value = mig.tex; taRef = ta;
    texWrap.append(texCap, ta);
    const msg = el('div', { class: 'mkeq-msg', role: 'status' });
    const optsRow = el('div', { class: 'mkeq-opts' });
    const swL = el('label', { class: 'mkeq-switchl' });
    const sw = el('button', { type: 'button', class: 'mkeq-switch', role: 'switch', 'aria-checked': 'false', title: app.t('Give this equation a number (Alt+N)'), 'aria-label': app.t('Numbered') });
    swL.append(sw, document.createTextNode(app.t('Numbered')));
    const labWrap = el('span', { class: 'lab', text: app.t('Label') });
    const labBox = el('span', { class: 'mkeq-label', title: app.t('Name used to refer to this equation, for example “See Eq. (1)” (Alt+L)') }, '<span class="pre">eq:</span>');
    const labIn = el('input', { type: 'text', spellcheck: 'false', 'aria-label': app.t('Label (Alt+L)'), placeholder: app.t('shields@@example label') });
    labIn.value = label; labBox.appendChild(labIn);
    const note = el('span', { class: 'note' });
    optsRow.append(swL, labWrap, labBox, note);
    body.append(stage, help, texWrap, msg, optsRow);

    const foot = el('div', { class: 'mkeq-foot' });
    const hint = el('span', { class: 'hint' }, editing ? app.th('<kbd>Enter</kbd> to update · <kbd>Esc</kbd> to cancel · <kbd>Tab</kbd> next box · <kbd>Shift</kbd>+<kbd>Enter</kbd> new LaTeX line') : app.th('<kbd>Enter</kbd> to insert · <kbd>Esc</kbd> to cancel · <kbd>Tab</kbd> next box · <kbd>Shift</kbd>+<kbd>Enter</kbd> new LaTeX line'));
    const bCancel = el('button', { type: 'button', class: 'mkeq-btn', text: app.t('Cancel') });
    const bOk = el('button', { type: 'button', class: 'mkeq-btn primary', text: editing ? app.t('Update') : app.t('Insert@@verb') });
    foot.append(hint, bCancel, bOk);
    box.append(head, tabs, pal, body, foot);

    // --- state → UI
    const texNow = () => ta.value.trim();
    function placeThumb() {
      const on = display ? bDisplay : bInline;
      thumb.style.left = on.offsetLeft + 'px'; thumb.style.width = on.offsetWidth + 'px';
    }
    function placeInk() {
      const b = tabBtns.find(x => x.dataset.id === tabId); if (!b) return;
      ink.style.left = b.offsetLeft + 'px'; ink.style.width = b.offsetWidth + 'px';
    }
    let msgTimer = 0;
    function setMsg(text, kind = '') { msg.textContent = text || ''; msg.className = 'mkeq-msg' + (kind ? ' ' + kind : ''); }
    function labelProblem() {
      if (!display || !numbered) return '';
      if (!label) return autoNum() ? '' : app.t('Type a label, or turn Numbered off.');
      if (!LABEL_RE.test(label)) return app.t('Use only letters, digits, “-”, “_” and “.” in the label.');
      if (('eq:' + label) !== origFull && usedLabels(app.docs.active()?.text || '').has(label)) return app.t('Pick a different label: another equation already uses eq:{label}.', { label });
      return '';
    }
    function sync() {
      bInline.classList.toggle('on', !display); bDisplay.classList.toggle('on', display);
      bInline.setAttribute('aria-checked', String(!display)); bDisplay.setAttribute('aria-checked', String(display));
      placeThumb();
      stage.classList.toggle('inline', !display);
      const auto = autoNum();
      const shownNumber = display && numbered;
      sw.setAttribute('aria-checked', String(display && numbered)); sw.disabled = !display; labIn.disabled = !display;
      optsRow.classList.toggle('dim', !display);
      num.classList.toggle('on', shownNumber);
      num.textContent = shownNumber ? previewNumber(label, ctx) : '';
      note.textContent = !display ? app.t('Only equations on their own line (Display) can be numbered.')
        : numbered ? (label ? app.t('Refer to it with @eq:{label}', { label }) : app.t('Numbered automatically. Add a label to refer to it.'))
        : (auto ? app.t('This equation will have no number.') : '');
      const fav = favorites().includes(texNow());
      bFav.classList.toggle('on', fav); bFav.setAttribute('aria-pressed', String(fav)); bFav.title = fav ? app.t('Remove from favorites (Alt+F)') : app.t('Add to favorites (Alt+F)');
      clearTimeout(msgTimer);
      msgTimer = setTimeout(() => {
        const lp = labelProblem(); if (lp) return setMsg(lp, 'warn');
        const kp = katexProblem(texNow()); if (kp) return setMsg(app.t('Check the LaTeX: the page may not show this exactly. {problem}', { problem: kp }), 'warn');
        setMsg(mig.tag != null && numbered ? app.t('The old fixed number was replaced by automatic numbering.') : '');
      }, 160);
    }
    const flash = (elx) => { elx.classList.remove('live'); void elx.offsetWidth; elx.classList.add('live'); clearTimeout(elx._t); elx._t = setTimeout(() => elx.classList.remove('live'), 700); };
    const syncBadge = texCap.querySelector('.sync');

    // visual → LaTeX
    function onVisualInput() {
      if (fromLatex || !mf) return;
      ta.value = cleanLatex(mf.getValue('latex'));
      flash(syncBadge); sync();
    }
    // LaTeX → visual
    function onLatexInput() {
      if (mf) { fromLatex = true; try { mf.setValue(ta.value, { silenceNotifications: true }); } catch {} fromLatex = false; }
      else renderFallback();
      flash(syncBadge); sync();
    }
    function renderFallback() {
      const f = fieldHost.querySelector('.fallback'); if (!f) return;
      f.innerHTML = texNow() ? katexHTML(texNow(), display) : '<span style="color:var(--text-3);font:13px var(--font)">Type LaTeX below</span>';
    }
    ta.addEventListener('input', onLatexInput);
    ta.addEventListener('focus', () => { target = 'latex'; });
    // Tab in the LaTeX box jumps to the next empty {} (Shift+Tab: previous)
    ta.addEventListener('keydown', ev => {
      if (ev.key !== 'Tab' || ev.ctrlKey || ev.altKey) return;
      const v = ta.value, p = ta.selectionEnd;
      const i = ev.shiftKey ? v.lastIndexOf('{}', Math.max(0, ta.selectionStart - 2)) : v.indexOf('{}', p);
      if (i < 0 || (ev.shiftKey && i + 1 >= ta.selectionStart)) return;
      ev.preventDefault(); ev.stopPropagation(); ta.setSelectionRange(i + 1, i + 1);
    });

    // insert a template into whichever box was used last
    function insertTpl(tpl, o = {}) {
      if (target === 'visual' && mf) {
        mf.focus();
        mf.insert(tpl, { insertionMode: 'replaceSelection', selectionMode: o.selectionMode || 'placeholder', format: 'latex', focus: true, scrollIntoView: true });
        onVisualInput();
        return;
      }
      const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e);
      let text = tpl.replace(/#0/, sel ? sel : '#?').replace(/#@/g, '');
      const hole = text.indexOf('#?'); text = text.replace(/#\?/g, '');
      let caret = hole >= 0 ? hole : text.length;
      if (/^\\[A-Za-z]/.test(text) && /[A-Za-z]$/.test(ta.value.slice(0, s))) { text = ' ' + text; caret++; }
      ta.focus(); ta.setSelectionRange(s, e);
      if (!document.execCommand('insertText', false, text)) ta.setRangeText(text, s, e, 'end');
      ta.setSelectionRange(s + caret, s + caret); onLatexInput();
    }

    // --- palettes
    function fillPal() {
      const p = PALETTES.find(x => x.id === tabId) || PALETTES[0];
      tabBtns.forEach(b => { const on = b.dataset.id === p.id; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
      pal.className = 'mkeq-pal'; pal.textContent = ''; pal.setAttribute('aria-label', app.t(p.label));
      void pal.offsetWidth; // restart the fade
      if (p.custom === 'matrix') renderMatrix();
      else if (p.custom === 'recent') renderRecent();
      else {
        pal.classList.add(p.id === 'basic' || p.id === 'big' || p.id === 'brackets' || p.id === 'units' || p.id === 'accents' ? 'wide' : 'grid');
        for (const it of p.items) {
          const nm = app.t(it.name);
          const b = el('button', { type: 'button', class: 'it', title: (it.keys ? app.t('{name} (type {keys})', { name: nm, keys: it.keys }) : nm) + (it.name !== it.show ? '\n' + it.show : ''), 'aria-label': nm, tabindex: '-1' });
          b.innerHTML = katexHTML((pal.classList.contains('wide') && p.id !== 'units' ? '\\displaystyle ' : '') + it.show, false);
          b.addEventListener('mousedown', ev => ev.preventDefault()); // keep the caret in the field
          b.addEventListener('click', () => insertTpl(it.tpl));
          pal.appendChild(b);
        }
        const first = pal.querySelector('button.it'); if (first) first.tabIndex = 0;
      }
      requestAnimationFrame(placeInk);
    }
    function renderMatrix() {
      let rows = settings.get('eqMxRows', 2), cols = settings.get('eqMxCols', 2), kind = settings.get('eqMxKind', 'pmatrix');
      const wrap = el('div', { class: 'mkeq-mx' });
      const c1 = el('div', { class: 'mkeq-mxcol' }, `<span class="cap">${app.th('Size')}</span>`);
      const grid = el('div', { class: 'mkeq-mxgrid', tabindex: '0', role: 'grid', 'aria-label': app.t('Matrix size. Arrow keys pick the size, Enter inserts') });
      const size = el('div', { class: 'mkeq-mxsize' });
      const cells = [];
      for (let r = 1; r <= 6; r++) for (let c = 1; c <= 6; c++) { const b = el('button', { type: 'button', tabindex: '-1', 'aria-label': app.t('{rows} by {columns}', { rows: r, columns: c }) }); b.dataset.r = r; b.dataset.c = c; cells.push(b); grid.appendChild(b); }
      const paint = (r, c) => { cells.forEach(b => b.classList.toggle('on', +b.dataset.r <= r && +b.dataset.c <= c)); size.textContent = `${r} × ${c}`; };
      const ins = (r, c) => { rows = r; cols = c; settings.set('eqMxRows', r); settings.set('eqMxCols', c); insertTpl(matrixTpl(r, c, kind)); };
      grid.addEventListener('mouseover', e => { const b = e.target.closest('button'); if (b) paint(+b.dataset.r, +b.dataset.c); });
      grid.addEventListener('mouseleave', () => paint(rows, cols));
      grid.addEventListener('mousedown', e => e.preventDefault());
      grid.addEventListener('click', e => { const b = e.target.closest('button'); if (b) ins(+b.dataset.r, +b.dataset.c); });
      grid.addEventListener('keydown', e => {
        const mv = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key];
        if (mv) { e.preventDefault(); rows = Math.max(1, Math.min(6, rows + mv[0])); cols = Math.max(1, Math.min(6, cols + mv[1])); paint(rows, cols); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); ins(rows, cols); }
      });
      paint(rows, cols);
      c1.append(grid, size);
      const c2 = el('div', { class: 'mkeq-mxcol' }, `<span class="cap">${app.th('Brackets')}</span>`);
      const br = el('div', { class: 'mkeq-mxbr', role: 'radiogroup', 'aria-label': app.t('Matrix brackets') });
      for (const [k, show, name] of MATRIX_KINDS) {
        const b = el('button', { type: 'button', role: 'radio', title: app.t(name), 'aria-label': app.t(name), 'aria-checked': String(k === kind) }, katexHTML(show, false));
        b.classList.toggle('on', k === kind);
        b.addEventListener('mousedown', e => e.preventDefault());
        b.addEventListener('click', () => { kind = k; settings.set('eqMxKind', k); br.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); }); });
        br.appendChild(b);
      }
      c2.appendChild(br);
      const c3 = el('div', { class: 'mkeq-mxcol' }, `<span class="cap">${app.th('Structures and rows')}</span>`);
      const ops = el('div', { class: 'mkeq-mxops' });
      const chip = (text, title, run) => { const b = el('button', { type: 'button', class: 'mkeq-chip', title, text }); b.addEventListener('mousedown', e => e.preventDefault()); b.addEventListener('click', run); ops.appendChild(b); return b; };
      chip(app.t('Cases'), 'f(x) = { a if …, b otherwise', () => insertTpl('\\begin{cases}#? & \\text{if } #?\\\\ #? & \\text{otherwise}\\end{cases}'));
      chip(app.t('Aligned lines'), app.t('Several lines lined up at ='), () => insertTpl('\\begin{aligned}#? &= #?\\\\ &= #?\\end{aligned}'));
      const cmd = (c) => () => { if (!mf) return setMsg(app.t('Type & for a new column and \\ for a new row in the LaTeX box. The visual editor did not start this time.'), 'warn'); mf.focus(); mf.executeCommand(c); onVisualInput(); };
      chip(app.t('Add row'), app.t('Add a row below the caret (Alt+Enter)'), cmd('addRowAfter'));
      chip(app.t('Add column'), app.t('Add a column right of the caret'), cmd('addColumnAfter'));
      chip(app.t('Delete row'), app.t('Delete the row with the caret'), cmd('removeRow'));
      chip(app.t('Delete column'), app.t('Delete the column with the caret'), cmd('removeColumn'));
      c3.appendChild(ops);
      wrap.append(c1, c2, c3); pal.appendChild(wrap);
    }
    function renderRecent() {
      const fav = favorites(), rec = recent().filter(x => !fav.includes(x));
      if (!fav.length && !rec.length) { pal.appendChild(el('div', { class: 'mkeq-empty', text: app.t('Equations you insert show up here. Star one (Alt+F) to keep it at the top.') })); return; }
      const list = el('div', { class: 'mkeq-recent' });
      for (const tex of [...fav, ...rec]) {
        const b = el('div', { class: 'rc', role: 'button', tabindex: '-1', title: tex, 'aria-label': app.t('Insert {equation}', { equation: tex }) });
        b.innerHTML = katexHTML(tex, false);
        const st = el('span', { class: 'star' + (fav.includes(tex) ? ' on' : ''), role: 'button', title: fav.includes(tex) ? app.t('Remove from favorites') : app.t('Add to favorites') }, svg('star'));
        st.addEventListener('mousedown', e => e.preventDefault());
        st.addEventListener('click', e => { e.stopPropagation(); toggleFavorite(tex); fillPal(); sync(); });
        b.appendChild(st);
        b.addEventListener('mousedown', e => e.preventDefault());
        b.addEventListener('click', () => insertTpl(tex, { selectionMode: 'after' }));
        b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); b.click(); } else if (e.key === 'Delete') { if (fav.includes(tex)) { toggleFavorite(tex); fillPal(); } } });
        list.appendChild(b);
      }
      pal.appendChild(list);
      const first = list.querySelector('.rc'); if (first) first.tabIndex = 0;
    }
    function selectTab(id, focusTab) {
      tabId = id; settings.set('eqTab', id); fillPal();
      if (focusTab) tabBtns.find(b => b.dataset.id === id)?.focus();
    }
    tabBtns.forEach(b => {
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', () => selectTab(b.dataset.id));
    });
    tabs.addEventListener('keydown', e => {
      const i = tabBtns.indexOf(document.activeElement); if (i < 0) return;
      const j = e.key === 'ArrowRight' ? (i + 1) % tabBtns.length : e.key === 'ArrowLeft' ? (i - 1 + tabBtns.length) % tabBtns.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabBtns.length - 1 : -1;
      if (j >= 0) { e.preventDefault(); selectTab(tabBtns[j].dataset.id, true); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); focusPalette(); }
    });
    pal.addEventListener('keydown', e => {
      if (gridNav(pal, 'button.it, .rc', e)) { e.preventDefault(); return; }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('button.it')) { e.preventDefault(); e.stopPropagation(); e.target.click(); focusField(); }
    });
    pal.addEventListener('focusin', e => { const t = e.target.closest('button.it, .rc'); if (t) { pal.querySelectorAll('button.it, .rc').forEach(x => { x.tabIndex = x === t ? 0 : -1; }); } });
    function focusPalette() { (pal.querySelector('button.it[tabindex="0"], .rc[tabindex="0"], .mkeq-mxgrid') || pal.querySelector('button, [tabindex]'))?.focus(); }

    // --- options
    function setDisplay(v) { display = !!v; settings.set('eqDisplay', display); try { if (mf) mf.defaultMode = display ? 'math' : 'inline-math'; } catch {} sync(); }
    bInline.addEventListener('click', () => { setDisplay(false); focusField(); });
    bDisplay.addEventListener('click', () => { setDisplay(true); focusField(); });
    seg.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setDisplay(e.key === 'ArrowRight'); (display ? bDisplay : bInline).focus(); } });
    function setNumbered(v) {
      if (!display) return;
      numbered = !!v;
      if (numbered) { if (!label && (lastLabel || !autoNum())) label = lastLabel || suggestLabel(texNow(), app.docs.active()?.text || '', normLabel(origFull)); labIn.value = label; }
      else { if (label) lastLabel = label; label = ''; labIn.value = ''; }
      sync();
    }
    sw.addEventListener('click', () => setNumbered(!numbered));
    labIn.addEventListener('input', () => {
      const pos = labIn.selectionStart; const n = normLabel(labIn.value);
      if (n !== labIn.value) { labIn.value = n; try { labIn.setSelectionRange(Math.min(pos, n.length), Math.min(pos, n.length)); } catch {} }
      label = n; if (n) { numbered = true; lastLabel = n; } else if (!autoNum()) numbered = false; sync();
    });
    labIn.addEventListener('focus', () => { if (numbered && !labIn.value) setNumbered(true); });
    bFav.addEventListener('click', () => {
      const t = texNow(); if (!t) { setMsg(app.t('Type an equation first, then star it.'), 'warn'); return; }
      const on = toggleFavorite(t); sync(); app.ui.toast?.(on ? app.t('Added to favorite equations') : app.t('Removed from favorite equations'));
      if (tabId === 'recent') fillPal();
    });
    function toggleHelp(v) {
      const on = v ?? help.classList.contains('off');
      help.classList.toggle('off', !on); bHelp.classList.toggle('on', on); bHelp.setAttribute('aria-pressed', String(on)); settings.set('eqHelp', on);
    }
    toggleHelp(settings.get('eqHelp', true));
    bHelp.addEventListener('click', () => toggleHelp());
    const vk = () => window.mathVirtualKeyboard;
    function onKbGeometry() { const k = vk(); const h = k && k.visible ? Math.round(k.boundingRect?.height || 0) : 0; box.style.setProperty('--mkeq-kb', h + 'px'); box.classList.toggle('kb', h > 0); bKb.classList.toggle('on', h > 0); bKb.setAttribute('aria-pressed', String(h > 0)); }
    function toggleKeyboard() {
      const k = vk(); if (!k || !mf) { setMsg(app.t('Type in the LaTeX box instead. The math keyboard needs the visual editor, which did not start this time.'), 'warn'); return; }
      mf.focus();
      // MathLive's keyboard reads body[theme]; follow the app theme while it is open
      document.body.setAttribute('theme', document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
      if (k.visible) k.hide({ animate: true }); else k.show({ animate: true });
      setTimeout(onKbGeometry, 60);
    }
    bKb.addEventListener('mousedown', e => e.preventDefault());
    bKb.addEventListener('click', toggleKeyboard);
    function focusField() { if (mf) { target = 'visual'; mf.focus(); } else ta.focus(); }

    // --- finish
    function result() {
      const tex = texNow();
      const auto = autoNum();
      return { tex, display, label: display && numbered && label ? 'eq:' + label : '', numbered: !!(display && numbered && (label || auto)),
        unnumbered: !!(display && !numbered && auto), delim: opts.delim || null };
    }
    function shake() { box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); }
    function done() {
      const r = result();
      if (!r.tex) { setMsg(app.t('Type an equation first, or press Esc to cancel.'), 'err'); shake(); focusField(); return; }
      const lp = labelProblem(); if (lp) { setMsg(lp, 'err'); shake(); labIn.focus(); labIn.select(); return; }
      r.markdown = markdown(r);
      remember(r.tex); settings.set('eqDisplay', display);
      finish(r);
    }
    function finish(v) {
      if (closed) return; closed = true;
      document.removeEventListener('keydown', onDocKey, true);
      try { vk()?.removeEventListener?.('geometrychange', onKbGeometry); if (vk()?.visible) vk().hide(); } catch {}
      setTimeout(() => { if (!current) document.body.removeAttribute('theme'); }, 400);
      scrim.classList.remove('show'); box.classList.remove('show');
      setTimeout(() => { scrim.remove(); box.remove(); }, 220);
      current = null;
      try { prevFocus?.focus?.({ preventScroll: true }); if (prevRange && prevFocus?.isContentEditable && prevFocus.contains(prevRange.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(prevRange); } } catch {}
      if (v && typeof opts.onDone === 'function') { try { opts.onDone(v); } catch (e) { console.error(e); } }
      resolveP(v);
    }
    bCancel.addEventListener('click', () => finish(null));
    bOk.addEventListener('click', done);
    scrim.addEventListener('mousedown', () => finish(null));

    // --- keyboard: the dialog owns the keys while open
    const inField = (t) => !!(mf && (t === mf || mf.contains?.(t)));
    function onDocKey(e) {
      if (closed || e.isComposing) return;
      const t = e.target;
      if (!box.contains(t) && t !== document.body && t !== document.documentElement) {
        // keys from MathLive's virtual keyboard or elsewhere: leave them alone
        return;
      }
      const k = e.key, alt = e.altKey && !e.ctrlKey && !e.metaKey, ctrl = (e.ctrlKey || e.metaKey) && !e.altKey;
      const stop = () => { e.preventDefault(); e.stopPropagation(); };
      if (k === 'Escape') {
        if (inField(t) && mf.mode === 'latex') return; // MathLive is completing a \command
        stop(); finish(null); return;
      }
      if (k === 'Enter' && ctrl) { stop(); done(); return; }
      if (k === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
        if (inField(t)) { if (mf.mode === 'latex') return; stop(); done(); return; }
        if (t === labIn || t === ta) { stop(); done(); return; }
      }
      if (ctrl && (k === 'PageDown' || k === 'PageUp')) { stop(); const i = PALETTES.findIndex(p => p.id === tabId); selectTab(PALETTES[(i + (k === 'PageDown' ? 1 : -1) + PALETTES.length) % PALETTES.length].id); return; }
      if (alt) {
        const c = (e.code || '').replace(/^Key|^Digit/, '').toLowerCase();
        const map = { k: toggleKeyboard, d: () => { setDisplay(!display); focusField(); }, n: () => { setNumbered(!numbered); }, l: () => { if (display) { labIn.focus(); labIn.select(); } },
          t: () => { ta.focus(); }, e: focusField, p: focusPalette, f: () => bFav.click(), h: () => toggleHelp() };
        if (map[c]) { stop(); map[c](); return; }
        if (/^\d$/.test(c)) { const i = c === '0' ? 9 : +c - 1; if (PALETTES[i]) { stop(); selectTab(PALETTES[i].id); } return; }
      }
      if (k === 'Tab' && !e.ctrlKey && !e.altKey) {
        // focus stays inside the dialog (MathLive handles Tab between its own boxes first)
        const f = [...box.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea, math-field, [tabindex="0"]')].filter(x => x.offsetParent !== null && x.tabIndex >= 0);
        if (!f.length) return;
        const a = document.activeElement; const i = f.indexOf(a);
        if (e.shiftKey && (i === 0)) { stop(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { stop(); f[0].focus(); }
      }
    }
    document.addEventListener('keydown', onDocKey, true);
    // let nothing reach the app's global shortcuts
    box.addEventListener('keydown', e => e.stopPropagation());

    // --- mount
    const prevFocus = document.activeElement;
    const s0 = getSelection(); const prevRange = s0 && s0.rangeCount ? s0.getRangeAt(0).cloneRange() : null;
    document.body.append(scrim, box);
    fillPal(); sync();
    requestAnimationFrame(() => { scrim.classList.add('show'); box.classList.add('show'); placeThumb(); placeInk(); });
    load().then(m => {
      if (closed) return;
      const MFE = m.MathfieldElement || window.MathfieldElement;
      mf = new MFE();
      mf.setAttribute('aria-label', app.t('Equation (Alt+E)'));
      try { mf.mathVirtualKeyboardPolicy = 'manual'; } catch {}
      try { mf.smartFence = true; mf.smartSuperscript = true; } catch {}
      try { mf.popoverPolicy = 'auto'; mf.environmentPopoverPolicy = 'auto'; } catch {}
      try { mf.menuItems = []; } catch {}
      try { mf.defaultMode = display ? 'math' : 'inline-math'; } catch {}
      fieldHost.textContent = ''; fieldHost.appendChild(mf);
      try { const mm = mlMacros(); if (Object.keys(mm).length) mf.macros = { ...mf.macros, ...mm }; } catch {}
      try { mf.inlineShortcuts = { ...mf.inlineShortcuts, deg: '^{\\circ}', '+-': '\\pm', 'xx': '\\times', '...': '\\ldots' }; } catch {}
      fromLatex = true; try { mf.setValue(ta.value, { silenceNotifications: true }); } catch {} fromLatex = false;
      mf.addEventListener('input', onVisualInput);
      mf.addEventListener('focus', () => { target = 'visual'; });
      try { vk()?.addEventListener?.('geometrychange', onKbGeometry); } catch {}
      requestAnimationFrame(() => { if (closed) return; mf.focus(); try { mf.executeCommand('moveToMathfieldEnd'); } catch {} });
    }).catch(err => {
      console.warn('MathLive unavailable', err);
      if (closed) return;
      fieldHost.innerHTML = '<div class="fallback"></div>'; renderFallback();
      setMsg(app.t('Type LaTeX below. The preview above updates as you type. (The visual editor didn’t start this time; reopen the dialog to try it again.)'), 'warn');
      target = 'latex'; ta.focus();
    });

    current = {
      promise, get mf() { return mf; }, ta, box, labelInput: labIn, numberEl: num, stage,
      focusField, done, cancel: () => finish(null), result,
      setTex(t) { ta.value = t; onLatexInput(); },
      setLabel(l) { labIn.value = l; labIn.dispatchEvent(new Event('input')); },
      setNumbered, setDisplay, selectTab, insertTemplate: insertTpl, toggleKeyboard,
      get state() { return { display, numbered, label, tex: texNow(), tab: tabId }; },
    };
    return promise;
  }

  app.equationEditor = {
    open, load, markdown, findInSource, labelOf, unnumberedOf, numberTextOf, suggestLabel, normLabel, cleanLatex, migrateTags,
    palettes: PALETTES,
    get current() { return current; },
  };

  // ------------------------------------------------------------------ smoke tests
  const A = (c, m) => app.assert(c, m);
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  async function until(fn, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await wait(40); } return null; }

  app.tests.register('equations: helpers write the Pandoc-crossref label syntax', () => {
    A(markdown({ tex: 'E=mc^2', display: true, label: 'eq:energy' }) === '$$\nE=mc^2\n$$ {#eq:energy}', 'labeled display: ' + JSON.stringify(markdown({ tex: 'E=mc^2', display: true, label: 'eq:energy' })));
    A(markdown({ tex: 'x', display: true, label: '' }) === '$$\nx\n$$', 'unlabeled display');
    A(/^(\$x\$|\\\(x\\\))$/.test(markdown({ tex: 'x', display: false, label: 'eq:ignored' })), 'inline has no label');
    const m = migrateTags('a=b \\tag{3}'); A(m.tex === 'a=b' && m.numbered, 'old \\tag becomes numbered: ' + JSON.stringify(m));
    A(normLabel('eq:Shields Curve!') === 'Shields-Curve', 'normLabel: ' + normLabel('eq:Shields Curve!'));
    A(suggestLabel('\\tau_c = \\theta g d', '') === 'tau-c', 'suggest: ' + suggestLabel('\\tau_c = \\theta g d', ''));
    A(suggestLabel('\\tau_c = 1', 'x $$\na\n$$ {#eq:tau-c}') === 'tau-c-2', 'unique suggestion');
    A(cleanLatex('\\frac{\\placeholder{}}{\\mleft(x\\mright)}\\differentialD x') === '\\frac{{}}{\\left(x\\right)}\\mathrm{d} x', 'cleanLatex: ' + cleanLatex('\\frac{\\placeholder{}}{\\mleft(x\\mright)}\\differentialD x'));
    const src = 'Text $a+b$ and\n\n$$\n\\int f\n$$ {#eq:int}\n\n```\n$$x$$\n```\n';
    const f1 = findInSource(src, 7); A(f1 && f1.tex === 'a+b' && !f1.display, 'inline found: ' + JSON.stringify(f1));
    const f2 = findInSource(src, src.indexOf('\\int') + 1); A(f2 && f2.display && f2.label === 'eq:int' && src.slice(f2.start, f2.end) === '$$\n\\int f\n$$ {#eq:int}', 'display with label found: ' + JSON.stringify(f2));
    A(!findInSource(src, src.indexOf('$$x') + 2), 'math inside code is ignored');
    const u = findInSource('$$\ny\n$$ {-}\n', 3); A(u && u.unnumbered && !u.label && u.end === 11, 'unnumbered marker found: ' + JSON.stringify(u));
    A(markdown({ tex: 'y', display: true, unnumbered: true }) === '$$\ny\n$$ {-}', 'unnumbered writes {-}');
    const l = migrateTags('a=b \\label{eq:foo}'); A(l.tex === 'a=b' && l.label === 'eq:foo', '\\label moves to the label: ' + JSON.stringify(l));
    A(migrateTags('a \\tag{A}').tex === 'a \\tag{A}', 'a custom \\tag stays');
  });

  app.tests.register('equations: MathLive loads locally and the visual field and LaTeX box sync both ways', async () => {
    const p = open({ tex: '\\frac{a}{b}', display: true });
    try {
      const cur = current; A(cur, 'dialog open');
      const mf = await until(() => cur.mf, 15000); A(mf, 'MathLive math-field mounted (local module)');
      A(customElements.get('math-field'), 'math-field defined');
      A(/\\frac\{a\}\{b\}/.test(mf.value), 'visual field shows the LaTeX: ' + mf.value);
      cur.setTex('x^2+\\alpha'); A(/x\^\{?2\}?\+\\alpha/.test(mf.value), 'LaTeX → visual: ' + mf.value);
      mf.executeCommand('moveToMathfieldEnd'); cur.insertTemplate('\\beta'); await wait(30);
      A(/\\beta/.test(cur.ta.value) && /\\alpha/.test(cur.ta.value), 'visual → LaTeX: ' + cur.ta.value);
      cur.insertTemplate('\\sqrt{#0}'); await wait(30);
      A(/\\sqrt/.test(cur.ta.value), 'palette template goes in: ' + cur.ta.value);
      A(!/placeholder|mleft/.test(cur.ta.value), 'no MathLive-only commands leak out: ' + cur.ta.value);
      const fontsOk = [...document.fonts].some(f => /KaTeX/.test(f.family)); A(fontsOk || window.katex, 'fonts available');
    } finally { current?.cancel(); await p; }
  });

  app.tests.register('equations: label + Numbered write {#eq:label}; old \\tag numbers migrate', async () => {
    const keep = { eqDisplay: settings.get('eqDisplay'), eqRecent: settings.get('eqRecent') };
    try {
    let p = open({ tex: 'E=mc^2', display: true });
    let cur = current; cur.setLabel('energy'); A(cur.state.numbered, 'typing a label turns Numbered on');
    cur.done(); let r = await p;
    A(r && r.markdown === '$$\nE=mc^2\n$$ {#eq:energy}', 'markdown: ' + JSON.stringify(r));
    A(r.label === 'eq:energy' && r.numbered && r.display, 'result fields');
    p = open({ tex: 'a = b \\tag{2}', display: true }); cur = current;
    A(cur.state.numbered && cur.state.label && cur.ta.value === 'a = b', 'tag migrated: ' + JSON.stringify(cur.state));
    cur.setNumbered(false); cur.done(); r = await p;
    A(r && r.markdown === '$$\na = b\n$$' && !/\\tag/.test(r.markdown), 'Numbered off → no label, no \\tag: ' + JSON.stringify(r));
    p = open({ tex: 'x', display: false }); cur = current; cur.done(); r = await p;
    A(r && !r.display && !r.label, 'inline equations carry no label');
    A(recent().includes('E=mc^2'), 'recent equations remembered');
    } finally { current?.cancel(); for (const [k, v] of Object.entries(keep)) settings.set(k, v === undefined ? (k === 'eqRecent' ? [] : true) : v); }
  });

  app.tests.register('equations: the number sits in its own gutter and never overlaps', async () => {
    const long = Array.from({ length: 40 }, (_, i) => `a_{${i}}x^{${i}}`).join('+');
    const p = open({ tex: long, display: true, label: 'eq:long' });
    const cur = current;
    try {
      await until(() => cur.mf, 15000); await wait(400);
      const n = cur.numberEl.getBoundingClientRect(), f = cur.stage.querySelector('.mkeq-field').getBoundingClientRect();
      A(cur.numberEl.classList.contains('on') && /^\(.+\)$/.test(cur.numberEl.textContent), 'number shown: ' + cur.numberEl.textContent);
      A(n.width > 0 && n.left >= f.right - 0.5, `number (${n.left}) right of the equation box (${f.right})`);
      A(!/\\tag/.test(cur.ta.value), 'no \\tag in the LaTeX');
    } finally { cur.cancel(); await p; }
  });

  app.tests.register('equations: dialog screenshot (smoke-out/equation.png)', async () => {
    const p = open({ tex: '\\tau_c=\\theta_c\\left(\\rho_s-\\rho\\right)g\\,d_{50}', display: true, label: 'eq:shields' });
    const cur = current;
    try {
      await until(() => cur.mf, 15000); await wait(700);
      try { await app.mk.invoke('smoke-shot', 'equation'); } catch {} // only in smoke mode
      A(cur.box.getBoundingClientRect().width > 300, 'dialog laid out');
      cur.toggleKeyboard(); await wait(400);
      A(window.mathVirtualKeyboard?.visible, 'math keyboard opens');
      cur.toggleKeyboard(); await wait(300);
      A(!window.mathVirtualKeyboard?.visible, 'math keyboard closes');
    } finally { cur.cancel(); await p; }
  });

  app.tests.register('equations: double-click an equation in Word mode edits it (and its label)', async () => {
    const E = app.editor || {};
    if (!E.createWord || !E._offscreen || !E.fakeDoc) return; // editor test helpers not present
    const host = E._offscreen(); const w = E.createWord(); const d = E.fakeDoc('Before.\n\n$$\na=b\n$$\n\nAfter $x$.\n');
    const dbl = (n) => n.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    try {
      w.mount(host, d);
      const page = await until(() => w.page?.querySelector('.mk-math.display') && w.page, 5000); A(page, 'Word page rendered');
      dbl(page.querySelector('.mk-math.display'));
      let cur = await until(() => current, 3000); A(cur && cur.ta.value === 'a=b' && cur.state.display, 'editor opened with the equation: ' + JSON.stringify(cur && cur.state));
      cur.setTex('a=c'); cur.done(); await wait(80);
      const t1 = w.getText(); A(/\$\$\na=c\n\$\$/.test(t1) && /After \$x\$\./.test(t1), 'updated in place: ' + JSON.stringify(t1));
      if (app.xref) { // label syntax needs the xref engineer's preload rules
        dbl(page.querySelector('.mk-math.display'));
        cur = await until(() => current, 3000); A(cur, 'editor reopened');
        cur.setLabel('ac'); cur.done(); await wait(200);
        const t2 = w.getText(); A(/\$\$\na=c\n\$\$ \{#eq:ac\}/.test(t2), 'label written: ' + JSON.stringify(t2));
      }
    } finally { current?.cancel(); w.unmount(); host.remove(); }
  });

  app.tests.register('equations: insert.equation writes a labeled block in Simple mode and edits in place', async () => {
    const E = app.editor || {};
    if (!E._offscreen || !E.createSimple || !E.fakeDoc) return; // editor test helpers not present
    const host = E._offscreen(); const s = E.createSimple(); const d = E.fakeDoc('Intro\n');
    try {
      s.mount(host, d); s.setSelection(6, 6); E.testTarget = s;
      await app.commands.run('insert.equation', { tex: 'q = u h', display: true, label: 'eq:flow', direct: true });
      A(/\$\$\nq = u h\n\$\$ \{#eq:flow\}/.test(d.text), 'labeled block: ' + JSON.stringify(d.text));
      // caret inside the block → the editor opens with it and replaces it in place
      const at = d.text.indexOf('u h'); s.setSelection(at, at);
      const p = app.commands.run('insert.equation');
      const cur = await until(() => current, 3000); A(cur, 'editor opened');
      A(cur.ta.value === 'q = u h' && cur.state.label === 'flow', 'opened with the block: ' + JSON.stringify(cur.state));
      cur.setTex('q = U h'); cur.done(); await p;
      A(/\$\$\nq = U h\n\$\$ \{#eq:flow\}/.test(d.text) && (d.text.match(/\$\$/g) || []).length === 2, 'replaced in place: ' + JSON.stringify(d.text));
    } finally { E.testTarget = null; current?.cancel(); s.unmount(); host.remove(); }
  });
})();
