// Markooj — languages (owner: languages; PLAN-v3 item 33).
// - Right-to-left writing (Urdu, Arabic, Persian) in Word, Inline, Simple and Read modes: every rendered block gets
//   dir="auto" (a postRender hook), so a paragraph takes the direction of its first letter; Simple mode and Inline's raw
//   text use unicode-bidi: plaintext per line (lang.css).
// - Paragraph direction like Word (Home → Paragraph → Left-to-right / Right-to-left). Stored in Markdown as a Pandoc
//   fenced div, which Pandoc, the preview and Word mode all round-trip:   ::: {dir="rtl"}  …  :::
// - Document language and direction in the front matter (`lang:`, `dir:`); they go to Pandoc exports as metadata and
//   to HTML/PDF/print as CSS; paragraphs whose direction differs from the page are wrapped in dir divs for Pandoc.
// - Bundled OFL fonts chosen by language: Noto Nastaliq Urdu (ur), Noto Naskh Arabic (ar), Vazirmatn (fa); Options can
//   change them.
// - Language packs (main-langpacks.js): File → Options → Language lists, downloads (SHA-256 checked), installs from a
//   file and removes them; installed packs register with app.writing.registerLanguage. Format-2 packs (Markooj 1.1)
//   bring a word list (lexicon.json, loaded on demand: app.lang.lexicon(code)), a Roman letter map (app.lang.roman(code))
//   and near-miss spelling, or full spelling from the word list (Urdu with the CLE list: similar.json letter groups help
//   the suggestions; the list comes over compactly through langpack-wordlist). Options shows each pack's credits
//   (manifest.sources) and word counts. Punjabi (Shahmukhi, pnb) is written right to left in the Urdu (Nastaliq) font.
(function () {
  'use strict';
  const app = window.app;
  if (!app) return;
  const mk = app.mk || window.mk;
  const esc = app.esc;
  const A = app.assert;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const invoke = (ch, ...a) => mk.invoke(ch, ...a);

  // ------------------------------------------------------------------ languages
  const LANGS = [
    { code: 'en-US', name: 'English (US)', nativeName: 'English', dir: 'ltr', builtIn: true },
    { code: 'en-GB', name: 'English (UK)', nativeName: 'English', dir: 'ltr', builtIn: true },
    { code: 'ur', name: 'Urdu', nativeName: 'اردو', dir: 'rtl', script: 'ur', font: 'Noto Nastaliq Urdu' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', script: 'ar', font: 'Noto Naskh Arabic' },
    { code: 'fa', name: 'Persian', nativeName: 'فارسی', dir: 'rtl', script: 'fa', font: 'Vazirmatn' },
    { code: 'pnb', name: 'Punjabi (Shahmukhi)', nativeName: 'پنجابی', dir: 'rtl', script: 'ur', font: 'Noto Nastaliq Urdu' },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית', dir: 'rtl' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr' },
    { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', dir: 'ltr' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', dir: 'ltr' },
    { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', dir: 'ltr' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', dir: 'ltr' },
    { code: 'zh', name: 'Chinese', nativeName: '中文', dir: 'ltr' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', dir: 'ltr' },
  ];
  const FONT_CHOICES = ['Noto Nastaliq Urdu', 'Noto Naskh Arabic', 'Vazirmatn', 'Segoe UI', 'Tahoma', 'Arial'];
  const DEFAULT_FONTS = { ur: 'Noto Nastaliq Urdu', ar: 'Noto Naskh Arabic', fa: 'Vazirmatn' };
  const RTL_CODES = new Set(['ar', 'fa', 'ur', 'pnb', 'skr', 'he', 'yi', 'ps', 'sd', 'ug', 'ckb', 'dv', 'ks']);
  const base = code => String(code || '').toLowerCase().split(/[-_]/)[0];
  const isRtlLang = code => RTL_CODES.has(base(code));
  const info = code => {
    const c = String(code || ''); const lc = c.toLowerCase();
    return LANGS.find(l => l.code.toLowerCase() === lc) || LANGS.find(l => l.code === base(c)) || installed.find(p => p.code === c) || null;
  };
  const nameOf = code => info(code)?.name || String(code || '');

  // ------------------------------------------------------------------ text helpers
  const RTL_CHAR = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
  const AR_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u0870-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  /** Direction of the first strong letter ('rtl' | 'ltr' | null), after dropping Markdown syntax, math, code and links. */
  function firstStrongDir(text) {
    const s = String(text || '')
      .replace(/^\s{0,3}(?:#{1,6}\s|>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|\|)+/gm, '')
      .replace(/```[\s\S]*?```|`[^`\n]*`/g, ' ')
      .replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, ' ') // a picture's alt text does not set the direction
      .replace(/\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)/g, ' ')
      .replace(/\]\([^)]*\)|<[^>\n]+>|\{[#.][^}\n]*\}|\{-\}|\[@[^\]]*\]|@\w[\w:-]*/g, ' ');
    const m = /\p{L}/u.exec(s);
    return m ? (RTL_CHAR.test(m[0]) ? 'rtl' : 'ltr') : null;
  }
  /** Which Arabic-script language a text is in: the language given (block or document), else a guess by letters. */
  function scriptOf(text, lang) {
    const t = String(text || '');
    if (!AR_SCRIPT.test(t)) return null;
    const b = base(lang);
    if (b === 'ur' || b === 'ar' || b === 'fa') return b;
    if (b === 'pnb' || b === 'skr') return 'ur'; // Shahmukhi Punjabi and Saraiki: Nastaliq, like Urdu
    if (/[\u0679\u0688\u0691\u06BA\u06BE\u06C1-\u06C3\u06D2-\u06D4]/.test(t)) return 'ur'; // ٹ ڈ ڑ ں ھ ہ ۂ ۃ ے ۓ ۔
    const ar = (t.match(/[\u0629\u064A\u0643\u0649]/g) || []).length;            // ة ي ك ى
    const fa = (t.match(/[\u067E\u0686\u0698\u06AF\u06A9\u06CC]/g) || []).length; // پ چ ژ گ ک ی
    return fa > ar ? 'fa' : 'ar';
  }
  function metaOf(doc) {
    if (!doc) return {};
    try { return (mk.frontMatter ? mk.frontMatter.parse(doc.text || '').meta : doc.meta) || {}; } catch { return doc.meta || {}; }
  }
  const docLang = doc => { const m = metaOf(doc); return String(m.lang || m.language || app.settings.get('proofingLanguage', 'en-US') || 'en-US'); };
  /** The page direction: front matter `dir:`, else right-to-left for an Urdu/Arabic/Persian/Hebrew document. */
  function docDir(doc) {
    const m = metaOf(doc); const d = String(m.dir || '').toLowerCase();
    if (d === 'rtl' || d === 'ltr') return d;
    return isRtlLang(m.lang || m.language) ? 'rtl' : 'ltr';
  }
  const fenceDir = info => { const m = /(?:^|[\s{])dir\s*=\s*["']?(rtl|ltr|auto)\b/i.exec(String(info || '')); return m ? m[1].toLowerCase() : null; };
  const fenceLang = info => { const m = /(?:^|[\s{])lang\s*=\s*["']?([A-Za-z]{2,3}(?:-[A-Za-z0-9]+)?)/.exec(String(info || '')); return m ? m[1] : null; };
  const fmLines = text => { try { const raw = mk.frontMatter.parse(text).raw || ''; return (raw.match(/\n/g) || []).length; } catch { return 0; } };

  // ------------------------------------------------------------------ rendered blocks (all modes, exports)
  const DIR_BLOCKS = 'p,h1,h2,h3,h4,h5,h6,ul,ol,blockquote,table,dl,figcaption,caption,details,summary';
  const TEXT_BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li,td,th,dt,dd,figcaption,caption,summary,blockquote';
  const SKIP = 'pre,.katex,.mk-math,.mk-math-block,[data-mk-ui],.mermaid,code';
  // The language of a block: a ::: {lang=…} div inside the page, else the document language. The lookup stops at the
  // page, so the app's own <html lang="en"> never overrides the document's `lang:`.
  function blockLang(b, lang) {
    for (let c = b; c && c !== document.documentElement && c !== document.body; c = c.parentElement) {
      if (c.classList && c.classList.contains('mk-page')) break;
      const l = c.getAttribute && c.getAttribute('lang');
      if (l) return l;
    }
    return lang;
  }
  function markScript(b, lang) {
    const s = scriptOf(b.textContent, blockLang(b, lang));
    if (s) { if (b.getAttribute('data-mk-script') !== s) b.setAttribute('data-mk-script', s); }
    else if (b.hasAttribute('data-mk-script')) b.removeAttribute('data-mk-script');
  }
  // Leaf blocks take dir="auto". Containers (lists, quotes, tables) are measured here, because the browser's own
  // dir="auto" skips children that carry a dir of their own, and their paragraphs do.
  const CONTAINERS = /^(UL|OL|BLOCKQUOTE|TABLE|DL|DETAILS)$/;
  function domFirstStrong(el) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    for (let n = w.nextNode(); n; n = w.nextNode()) { const m = /\p{L}/u.exec(n.data); if (m) return RTL_CHAR.test(m[0]) ? 'rtl' : 'ltr'; }
    return null;
  }
  function markDir(b) {
    if (b.closest('[data-mk-dir]')) return;
    if (b.hasAttribute('dir') && !b.hasAttribute('data-mk-autodir')) return; // the author's own <p dir="…">
    // A block with no letters (a number, a picture, math) takes the page direction: Chromium resolves dir="auto" with
    // no strong letter to ltr, which would push "2024" or a picture to the left of an Urdu page.
    const d = domFirstStrong(b);
    if (CONTAINERS.test(b.nodeName)) {
      if (d) { if (b.getAttribute('dir') !== d) b.setAttribute('dir', d); } else if (b.hasAttribute('dir')) b.removeAttribute('dir');
      b.setAttribute('data-mk-autodir', ''); return;
    }
    if (d) { if (b.getAttribute('dir') !== 'auto') b.setAttribute('dir', 'auto'); }
    else if (b.hasAttribute('dir')) b.removeAttribute('dir');
    b.setAttribute('data-mk-autodir', '');
  }
  function applyBlocks(el, doc) {
    if (!el || !el.querySelectorAll) return;
    const lang = docLang(doc);
    if (el.classList && el.classList.contains('mk-page')) {
      el.setAttribute('dir', docDir(doc));
      el.setAttribute('lang', lang);
      el.setAttribute('data-mk-lang', base(lang));
      // Latin letters inside an Urdu paragraph keep the document font
      try { const f = getComputedStyle(el).fontFamily; if (f && !/^var\(/.test(f)) el.style.setProperty('--mk-base-font', f); } catch {}
    }
    // ::: {dir="rtl"} / ::: {lang=fa} fenced divs
    el.querySelectorAll('div[data-fence]').forEach(d => {
      const info = d.getAttribute('data-fence');
      const dir = fenceDir(info), l = fenceLang(info);
      if (dir) { d.setAttribute('dir', dir); d.setAttribute('data-mk-dir', dir); }
      if (l) d.setAttribute('lang', l);
    });
    el.querySelectorAll(DIR_BLOCKS).forEach(b => { if (!b.closest(SKIP)) markDir(b); });
    el.querySelectorAll(TEXT_BLOCKS).forEach(b => { if (!b.closest(SKIP)) markScript(b, lang); });
  }
  app.hooks.postRender((el, doc) => applyBlocks(el, doc));

  // typing: new paragraphs (Enter in Word mode) and changed text get the same treatment without a re-render
  document.addEventListener('input', e => {
    const t = e.target; if (!t || !t.closest) return;
    const page = t.closest('.mk-page'); if (!page) return;
    const s = getSelection(); const n = s && s.rangeCount ? s.anchorNode : null;
    const el = n ? (n.nodeType === 1 ? n : n.parentElement) : null;
    if (!el || !page.contains(el)) return;
    // the Inline-mode block editor takes the script font of what is typed in it, too
    const b = el.closest(TEXT_BLOCKS) || el.closest('.mk-il-edit'); if (!b || !page.contains(b) || b.closest(SKIP)) return;
    const lang = page.getAttribute('lang') || docLang(app.docs.active());
    if (b.matches(DIR_BLOCKS)) markDir(b);
    for (let c = b.parentElement; c && c !== page; c = c.parentElement) if (CONTAINERS.test(c.nodeName)) markDir(c);
    markScript(b, lang);
  }, true);

  // ------------------------------------------------------------------ fonts
  function applyFonts() {
    const f = { ...DEFAULT_FONTS, ...(app.settings.get('rtlFonts', {}) || {}) };
    const root = document.documentElement.style;
    for (const k of Object.keys(DEFAULT_FONTS)) root.setProperty('--mk-font-' + k, `'${String(f[k] || DEFAULT_FONTS[k]).replace(/'/g, '')}'`);
  }
  const fontFor = s => ({ ...DEFAULT_FONTS, ...(app.settings.get('rtlFonts', {}) || {}) })[s] || DEFAULT_FONTS[s];
  app.events.on('settings:changed', ({ key } = {}) => { if (key === 'rtlFonts') applyFonts(); });
  applyFonts();

  // ------------------------------------------------------------------ paragraph direction in the Markdown source
  // Lines of fenced code, math and fenced divs, so direction changes never land inside them.
  function scanLines(lines, from) {
    const kind = new Array(lines.length).fill('text'); const pairs = []; const stack = [];
    let code = null, math = false;
    for (let i = from; i < lines.length; i++) {
      const l = lines[i].replace(/\r$/, '');
      if (code) { kind[i] = 'code'; if (new RegExp('^\\s{0,3}' + code[0] + '{' + code.length + ',}\\s*$').test(l)) code = null; continue; }
      if (math) { kind[i] = 'math'; if (/\$\$/.test(l)) math = false; continue; }
      let m;
      if ((m = /^\s{0,3}(`{3,}|~{3,})/.exec(l))) { code = m[1]; kind[i] = 'code'; continue; }
      if (/^\s{0,3}\$\$/.test(l)) { kind[i] = 'math'; if (!/\$\$/.test(l.replace(/^\s{0,3}\$\$/, ''))) math = true; continue; }
      if ((m = /^\s{0,3}(:{3,})\s*(.*?)\s*:*\s*$/.exec(l))) {
        kind[i] = 'fence';
        if (m[2]) stack.push({ open: i, colons: m[1].length, info: m[2] });
        else { let k = stack.length - 1; while (k >= 0 && stack[k].colons > m[1].length) k--; if (k >= 0) { const o = stack.splice(k, 1)[0]; pairs.push({ ...o, close: i }); } }
      }
    }
    return { kind, pairs };
  }
  const blank = l => !String(l || '').trim();
  /** Change the direction of the paragraphs on lines a…b (absolute, 0-based).
   *  want: 'rtl' | 'ltr'. Returns {text, changed, reason}. Pure: used by the commands and by the tests. */
  function setBlockDir(text, a, b, want, opts = {}) {
    const eol = /\r\n/.test(text) ? '\r\n' : '\n';
    const lines = String(text).split(/\r?\n/);
    const from = opts.fmLines != null ? opts.fmLines : fmLines(text);
    const pageDir = opts.pageDir || 'ltr';
    a = Math.max(from, Math.min(a, lines.length - 1)); b = Math.max(a, Math.min(b, lines.length - 1));
    const { kind, pairs } = scanLines(lines, from);
    // caret on a blank line: the paragraph after it (or before it at the end)
    while (a <= b && blank(lines[a])) a++;
    if (a > b) { let k = b; while (k >= from && blank(lines[k])) k--; if (k < from) return { text, changed: false, reason: 'empty' }; a = b = k; }
    while (b > a && blank(lines[b])) b--;
    // caret on a ::: fence line → that div
    const onFence = pairs.find(p => p.open === a || p.close === a);
    let start = a, end = b;
    if (onFence && fenceDir(onFence.info)) { start = onFence.open + 1; end = onFence.close - 1; }
    else {
      const inCode = k => kind[k] === 'code' || kind[k] === 'math';
      while (start > from && !blank(lines[start - 1]) && (kind[start - 1] !== 'fence' || inCode(start))) start--;
      while (end + 1 < lines.length && !blank(lines[end + 1]) && (kind[end + 1] !== 'fence' || inCode(end))) end++;
      // a code or math block is moved as a whole
      while (start > from && inCode(start) && inCode(start - 1)) start--;
      while (end + 1 < lines.length && inCode(end) && inCode(end + 1)) end++;
    }
    const container = pairs.filter(p => p.open < start && p.close > end).sort((x, y) => y.open - x.open)[0] || null;
    const cDir = container ? fenceDir(container.info) : null;
    const blockText = lines.slice(start, end + 1).join('\n');
    const natural = firstStrongDir(blockText) || pageDir;
    const openLine = `::: {dir="${want}"}`, closeLine = ':::';
    const onlyDirAttrs = info => /^\{\s*(?:(?:dir|lang)\s*=\s*["']?[\w-]+["']?\s*)+\}$/i.test(String(info).trim());
    let out;
    if (container && cDir && onlyDirAttrs(container.info)) {
      if (cDir === want) return { text, changed: false, reason: 'already' };
      const before = lines.slice(container.open + 1, start), after = lines.slice(end + 1, container.close);
      const keepBefore = before.some(l => !blank(l)), keepAfter = after.some(l => !blank(l));
      const trimEnd = arr => { const r = arr.slice(); while (r.length && blank(r[r.length - 1])) r.pop(); return r; };
      const trimStart = arr => { const r = arr.slice(); while (r.length && blank(r[0])) r.shift(); return r; };
      const block = lines.slice(start, end + 1);
      const mid = want === natural && !fenceLang(container.info) ? block : [openLine, ...block, closeLine];
      out = [...lines.slice(0, container.open)];
      if (keepBefore) out.push(lines[container.open], ...trimEnd(before), lines[container.close], '');
      out.push(...mid);
      if (keepAfter) out.push('', lines[container.open], ...trimStart(after), lines[container.close]);
      out.push(...lines.slice(container.close + 1));
    } else if (container && !cDir && !onlyDirAttrs(container.info)) {
      // inside a callout or other div: the direction goes onto that div (fenced divs only nest with more colons)
      const info = container.info.trim();
      const next = info[0] === '{' ? info.replace(/\}\s*$/, ` dir="${want}"}`) : `{.${info} dir="${want}"}`;
      const line = lines[container.open].replace(container.info, next);
      out = lines.slice(); out[container.open] = line;
    } else if (container && cDir) {
      if (cDir === want) return { text, changed: false, reason: 'already' };
      out = lines.slice();
      const nat = firstStrongDir(lines.slice(container.open + 1, container.close).join('\n')) || pageDir;
      if (want === nat) {
        // back to the natural direction: take the dir attribute off again ({.note} → note), so the buttons round-trip
        let info = container.info.trim().replace(/\s*\bdir\s*=\s*["']?(rtl|ltr|auto)["']?/i, '').replace(/\{\s+/, '{');
        const cls = /^\{\s*\.([\w-]+)\s*\}$/.exec(info); if (cls) info = cls[1];
        out[container.open] = lines[container.open].replace(container.info, info);
      } else out[container.open] = lines[container.open].replace(/dir\s*=\s*["']?(rtl|ltr|auto)["']?/i, `dir="${want}"`);
    } else {
      if (want === natural && !opts.force) return { text, changed: false, reason: 'already' };
      out = [...lines.slice(0, start)];
      if (out.length > from && !blank(out[out.length - 1])) out.push('');
      out.push(openLine, ...lines.slice(start, end + 1), closeLine);
      const rest = lines.slice(end + 1);
      if (rest.length && !blank(rest[0])) out.push('');
      out.push(...rest);
    }
    return { text: out.join(eol), changed: true, start, end };
  }

  /** Source lines the current selection covers (absolute, 0-based), for any mode. */
  function selectionLines(doc) {
    const ad = app.editors.active(); if (!ad || !doc) return null;
    const lineOf = off => doc.text.slice(0, off).split('\n').length - 1;
    try {
      const s = ad.getSelection?.();
      if (s && typeof s.start === 'number' && typeof s.end === 'number') return [lineOf(s.start), lineOf(Math.max(s.start, s.end - (s.end > s.start ? 1 : 0)))];
    } catch {}
    const page = ad.page || ad.getSurface?.() || document.querySelector('.mk-page[contenteditable]');
    const sel = getSelection();
    if (page && sel.rangeCount && page.contains(sel.anchorNode)) {
      const fm = fmLines(doc.text);
      const lineAt = node => { let el = node.nodeType === 1 ? node : node.parentElement; while (el && el !== page) { if (el.hasAttribute('data-line')) return +el.getAttribute('data-line'); el = el.parentElement; } return null; };
      const r = sel.getRangeAt(0); const s = lineAt(r.startContainer), e = lineAt(r.endContainer);
      if (s != null) return [s + fm, (e != null ? e : s) + fm];
    }
    try { const c = ad.getCaretLine?.(); if (c != null) return [c, c]; } catch {}
    return null;
  }
  function editableDoc() { const d = app.docs.active(); return d && d.kind === 'markdown' && !d.readOnly ? d : null; }
  /** Direction of the paragraph at the caret, as the page shows it. */
  function currentDir() {
    const doc = editableDoc(); if (!doc) return null;
    if (app.mode === 'simple') {
      const ls = selectionLines(doc); if (!ls) return null;
      const lines = doc.text.split(/\r?\n/); const { pairs } = scanLines(lines, fmLines(doc.text));
      const c = pairs.filter(p => p.open < ls[0] && p.close > ls[0] && fenceDir(p.info)).sort((x, y) => y.open - x.open)[0];
      if (c) return fenceDir(c.info);
      let s = ls[0], e = ls[0]; while (s > 0 && !blank(lines[s - 1])) s--; while (e + 1 < lines.length && !blank(lines[e + 1])) e++;
      return firstStrongDir(lines.slice(s, e + 1).join('\n')) || docDir(doc);
    }
    const sel = getSelection(); if (!sel.rangeCount) return null;
    const n = sel.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement);
    const page = el && el.closest && el.closest('.mk-page'); if (!page) return null;
    const b = el.closest(TEXT_BLOCKS) || el;
    try { return getComputedStyle(b).direction; } catch { return null; }
  }
  async function setParagraphDir(want) {
    const doc = editableDoc(); if (!doc) return;
    if (app.mode === 'read') { app.ui.toast?.('Read mode is for reading. Press Esc to go back to editing.', { kind: 'info' }); return; }
    let ls = selectionLines(doc);
    // a paragraph typed in Word mode has no source line until the page is drawn again
    if (!ls && app.mode === 'word') { try { await app.editors.active()?.refresh?.(); } catch {} ls = selectionLines(doc); }
    if (!ls) { app.ui.toast?.('Click in a paragraph first.', { kind: 'info' }); return; }
    const r = setBlockDir(doc.text, ls[0], ls[1], want, { pageDir: docDir(doc) });
    if (!r.changed) { if (r.reason === 'already') app.ui.toast?.(want === 'rtl' ? 'This paragraph already reads right to left.' : 'This paragraph already reads left to right.', { kind: 'info' }); return; }
    doc.setText(r.text, 'lang-dir');
    try { await app.editors.active()?.refresh?.(); } catch {}
    app.events.emit('ribbon:changed');
  }

  // ------------------------------------------------------------------ document language
  function setDocLanguage(doc, code) {
    if (!doc || doc.kind !== 'markdown' || doc.readOnly) return false;
    const m = metaOf(doc); const patch = { lang: code || null };
    if (isRtlLang(code) && !m.dir) patch.dir = 'rtl';
    else if (!isRtlLang(code) && String(m.dir || '').toLowerCase() === 'rtl') patch.dir = null;
    if (app.shell?.setFrontMatter) return app.shell.setFrontMatter(doc, patch);
    const meta = { ...m }; for (const [k, v] of Object.entries(patch)) { if (v == null) delete meta[k]; else meta[k] = v; }
    doc.setText(mk.frontMatter.write(doc.text, meta), 'meta'); app.editors.active()?.refresh?.();
    return true;
  }
  function setDocDirection(doc, dir) {
    if (!doc || doc.kind !== 'markdown' || doc.readOnly) return false;
    const v = dir === 'rtl' || dir === 'ltr' ? dir : null;
    if (app.shell?.setFrontMatter) return app.shell.setFrontMatter(doc, { dir: v });
    const meta = { ...metaOf(doc) }; if (v) meta.dir = v; else delete meta.dir;
    doc.setText(mk.frontMatter.write(doc.text, meta), 'meta'); app.editors.active()?.refresh?.();
    return true;
  }
  function pickLanguage(anchor) {
    const doc = app.docs.active(); if (!doc || doc.kind !== 'markdown') return;
    const cur = String(metaOf(doc).lang || metaOf(doc).language || 'en-US').toLowerCase();
    const extra = installed.filter(p => !LANGS.find(l => l.code === p.code));
    const item = l => ({ label: l.nativeName && l.nativeName !== l.name && l.nativeName !== 'English' ? `${l.name} — ${l.nativeName}` : l.name, checked: l.code.toLowerCase() === cur, run: () => setDocLanguage(doc, l.code) });
    const items = [{ header: 'Document language' }, ...LANGS.slice(0, 6).map(item), ...extra.map(item), { sep: true }, ...LANGS.slice(6).map(item), { sep: true },
      { label: 'Language options…', run: () => openOptions() },
      { note: 'Saved as “lang” in the front matter. Used for spelling, fonts and exports. Urdu, Arabic, Persian, Punjabi (Shahmukhi) and Hebrew also set the page to right to left.' }];
    if (app.ui.menu) app.ui.menu(anchor, items, { placement: 'top', checks: true });
  }
  function openOptions() {
    app.backstage.open('options');
    setTimeout(() => { const s = document.querySelector('.opt-card[data-section="language"]'); if (s) { s.scrollIntoView({ block: 'start', behavior: 'smooth' }); app.ui.glow?.(s); } }, 260);
  }
  // the status-bar language item (drawn by the shell) opens this picker and names every language
  document.addEventListener('click', e => {
    const b = e.target && e.target.closest && e.target.closest('#sbLang'); if (!b) return;
    e.stopImmediatePropagation(); e.preventDefault(); pickLanguage(b);
  }, true);
  function fixStatusLabel() {
    const s = document.querySelector('#sbLang span'); if (!s) return;
    const doc = app.docs.active(); if (!doc || doc.kind !== 'markdown') return;
    const want = nameOf(metaOf(doc).lang || metaOf(doc).language || 'en-US');
    if (want && s.textContent !== want) s.textContent = want;
  }
  let sbObs = null;
  function watchStatus() {
    const el = document.querySelector('#sbLang'); if (!el || sbObs) return;
    sbObs = new MutationObserver(() => fixStatusLabel()); sbObs.observe(el, { subtree: true, childList: true, characterData: true });
    fixStatusLabel();
  }

  // ------------------------------------------------------------------ ribbon: Home → Paragraph direction buttons
  function addIcons() {
    const defs = document.querySelector('svg defs'); if (!defs || document.getElementById('mk-ltr')) return;
    const ns = 'http://www.w3.org/2000/svg';
    const mkSym = (id, d) => { const s = document.createElementNS(ns, 'symbol'); s.setAttribute('id', id); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = d; defs.appendChild(s); };
    const pil = '<path d="M11 3.5v10M15 3.5v10M9.5 3.5H17"/><path d="M11 3.5a3.2 3.2 0 0 0 0 6.4"/>';
    mkSym('mk-ltr', pil + '<path d="M4 19h15M16 16l3 3-3 3"/>');
    mkSym('mk-rtl', pil + '<path d="M20 19H5M8 16l-3 3 3 3"/>');
  }
  const DIR_ITEMS = [{ type: 'sep' }, { type: 'small', command: 'para.ltr', label: 'Left-to-right text direction', icon: 'mk-ltr' }, { type: 'small', command: 'para.rtl', label: 'Right-to-left text direction', icon: 'mk-rtl' }];
  const hasDirButtons = g => JSON.stringify(g.items || []).includes('"para.rtl"');
  function placeButtons() {
    const home = app.ribbon.tabs().find(t => t.id === 'home'); if (!home) return;
    if (home.groups.some(hasDirButtons)) return;
    const para = home.groups.find(g => g.id === 'paragraph');
    if (para) {
      const g = JSON.parse(JSON.stringify(para, (k, v) => (typeof v === 'function' ? undefined : v)));
      // keep functions (value(), render()) by copying the original items where JSON lost them
      const copy = (src, dst) => { for (const k of Object.keys(src)) { if (typeof src[k] === 'function') dst[k] = src[k]; else if (src[k] && typeof src[k] === 'object' && dst[k]) copy(src[k], dst[k]); } };
      copy(para, g);
      // the row with the alignment buttons, like Word
      const rows = []; const walk = items => (items || []).forEach(it => { if (it && it.type === 'row') rows.push(it); if (it && it.items) walk(it.items); });
      walk(g.items);
      const row = rows.find(r => JSON.stringify(r.items).includes('para.align')) || rows[rows.length - 1];
      if (row) { row.items.push(...DIR_ITEMS); app.ribbon.addGroup('home', g); return; }
    }
    app.ribbon.addGroup('home', { id: 'direction', label: 'Direction', order: 31, items: [{ type: 'col', items: DIR_ITEMS.slice(1) }] });
  }
  app.events.on('ribbon:changed', () => { try { placeButtons(); } catch (e) { console.warn('lang ribbon', e); } });

  // ------------------------------------------------------------------ commands
  const dirEnabled = () => !!editableDoc() && app.mode !== 'read';
  app.commands.register('para.ltr', {
    label: 'Left-to-right text direction', icon: 'mk-ltr', group: 'Paragraph',
    description: 'Make the paragraph read from left to right, like English. Saved in the Markdown as ::: {dir="ltr"} only when the paragraph would otherwise read the other way. Ctrl+Left Shift.',
    isEnabled: dirEnabled, isActive: () => currentDir() === 'ltr', run: () => setParagraphDir('ltr'),
  });
  app.commands.register('para.rtl', {
    label: 'Right-to-left text direction', icon: 'mk-rtl', group: 'Paragraph',
    description: 'Make the paragraph read from right to left, for Urdu, Arabic, Persian or Hebrew. Saved in the Markdown as ::: {dir="rtl"}. Ctrl+Right Shift.',
    isEnabled: dirEnabled, isActive: () => currentDir() === 'rtl', run: () => setParagraphDir('rtl'),
  });
  app.commands.register('lang.pick', { label: 'Document language…', icon: 'lang', description: 'Pick the language of this document: spelling, fonts, direction and exports follow it.', run: () => pickLanguage(document.querySelector('#sbLang') || { x: innerWidth / 2, y: innerHeight - 40 }) });
  app.commands.register('lang.setDocLanguage', { label: 'Set document language', description: 'Set the document language (saved as lang in the front matter).', hidden: true, run: (a = {}) => setDocLanguage(app.docs.active(), a.value || a.code) });
  app.commands.register('lang.docDirection', {
    label: 'Page direction', description: 'Set the direction of the whole page: right to left for Urdu, Arabic and Persian documents. Saved as dir in the front matter.',
    run: (a = {}) => {
      if (a.value) return setDocDirection(app.docs.active(), a.value === 'auto' ? null : a.value);
      const doc = app.docs.active(); if (!doc) return;
      const cur = String(metaOf(doc).dir || '').toLowerCase();
      app.ui.menu?.(document.querySelector('#sbLang') || { x: innerWidth / 2, y: innerHeight / 2 }, [{ header: 'Page direction' },
        { label: 'Left to right', checked: cur === 'ltr', run: () => setDocDirection(doc, 'ltr') },
        { label: 'Right to left', checked: cur === 'rtl', run: () => setDocDirection(doc, 'rtl') },
        { label: 'From the language', checked: !cur, run: () => setDocDirection(doc, null) }], { placement: 'top', checks: true });
    },
  });
  app.commands.register('lang.options', { label: 'Language options', icon: 'lang', description: 'Proofing languages, language packs for Urdu, Arabic and Persian, and right-to-left fonts.', run: () => openOptions() });
  app.commands.register('lang.installFromFile', { label: 'Install language pack from file…', icon: 'lang', description: 'Add a Markooj language pack (.zip) you downloaded. Markooj checks every file before installing.', run: () => installFromFile() });
  if (app.tooltips?.register) {
    app.tooltips.register('para.ltr', { title: 'Left-to-right text direction', description: 'Make the paragraph read from left to right, like English. Ctrl+Left Shift.', markdown: '::: {dir="ltr"}' });
    app.tooltips.register('para.rtl', { title: 'Right-to-left text direction', description: 'Make the paragraph read from right to left, for Urdu, Arabic, Persian or Hebrew. Ctrl+Right Shift.', markdown: '::: {dir="rtl"}' });
    app.tooltips.register('lang.pick', { title: 'Document language', description: 'Pick the language of this document: spelling, fonts, direction and exports follow it.' });
    app.tooltips.register('lang.docDirection', { title: 'Page direction', description: 'Right to left or left to right for the whole page. Saved as dir in the front matter.' });
    app.tooltips.register('lang.options', { title: 'Language options', description: 'Proofing languages, language packs and right-to-left fonts.' });
    app.tooltips.register('lang.installFromFile', { title: 'Install language pack from file', description: 'Add a Markooj language pack (.zip). Every file is checked before it is installed.' });
    app.tooltips.register('lang.setDocLanguage', { title: 'Set document language', description: 'Saved as lang in the front matter.' });
  }
  // Word's keys: Ctrl+Right Shift = right to left, Ctrl+Left Shift = left to right (press and release, nothing else)
  let shiftSide = null;
  document.addEventListener('keydown', e => {
    if ((e.code === 'ShiftRight' || e.code === 'ShiftLeft') && e.ctrlKey && !e.altKey && !e.metaKey) shiftSide = e.code;
    else shiftSide = null;
  }, true);
  document.addEventListener('keyup', e => {
    if (!shiftSide || e.code !== shiftSide) { if (e.key !== 'Control') shiftSide = null; return; }
    const side = shiftSide; shiftSide = null;
    const t = document.activeElement;
    if (!t || !(t.closest?.('.mk-page') || t.classList?.contains('mk-src-ta'))) return;
    e.preventDefault(); app.commands.run(side === 'ShiftRight' ? 'para.rtl' : 'para.ltr');
  }, true);

  // ------------------------------------------------------------------ language packs
  let installed = [];
  const registered = new Set();
  async function refreshInstalled() {
    try { installed = (await invoke('langpack-list')) || []; } catch { installed = []; }
    return installed;
  }
  // Word lists (lexicon.json) and Roman letter maps (roman.json) of format-2 packs: read once, when first asked for.
  const tables = { lexicon: new Map(), roman: new Map() };
  const BIG_TABLE = 20000;
  function table(kind, code) {
    const c = String(code || ''); const cache = tables[kind];
    if (!cache.has(c)) {
      const pr = invoke('langpack-' + kind, c).then(t => t || null, () => null);
      // nothing there: ask again next time; a large word list (a full-spelling pack) is not kept in memory either
      cache.set(c, pr); pr.then(t => { if ((!t || (t.rows && t.rows.length > BIG_TABLE)) && cache.get(c) === pr) cache.delete(c); });
    }
    return cache.get(c);
  }
  const forgetTables = code => { tables.lexicon.delete(code); tables.roman.delete(code); };
  /** app.lang.lexicon(code) → Promise<{fields, rows} | null> (fields: word, aarab, roman, freq, pos, …) */
  const lexicon = code => table('lexicon', code);
  /** app.lang.roman(code) → Promise<{fields, rows} | null> (fields: roman, letters, note) */
  const roman = code => table('roman', code);
  async function registerPack(code) {
    const w = app.writing;
    if (typeof w?.registerLanguage !== 'function') return false;
    try {
      const f = await invoke('langpack-files', code);
      const m = f.manifest || {};
      // a word list drives near-miss and full spelling (format 2); full without one uses the Hunspell .aff/.dic
      const words = !!m.lexicon && (f.lexicon !== false) && (f.spellingMode === 'near-miss' || f.spellingMode === 'full');
      const full = words && f.spellingMode === 'full';
      w.registerLanguage({ code, name: m.name || code, nativeName: m.nativeName, dir: m.dir === 'rtl' ? 'rtl' : 'ltr', aff: f.aff || undefined, dic: f.dic || undefined, rules: (f.rules && f.rules.rules) || undefined, font: m.font && m.font.family,
        spellingMode: f.spellingMode || undefined, clitics: words ? f.clitics : undefined, similar: full ? f.similar || null : undefined,
        // full lists are large: they come over in a compact form (one string, two number lists), read on the first check
        lexicon: !words ? undefined : full ? () => invoke('langpack-wordlist', code).then(t => t || null, () => null) : () => lexicon(code) });
      registered.add(code); return true;
    } catch (e) { console.warn('language pack', code, e); return false; }
  }
  async function registerAll() {
    await refreshInstalled();
    // the Writing Assistant may load after this file: wait a little for it
    for (let i = 0; i < 40 && typeof app.writing?.registerLanguage !== 'function'; i++) await sleep(100);
    for (const p of installed) await registerPack(p.code);
    app.events.emit('lang:packs', installed);
  }
  async function installPack(o) {
    const r = await invoke('langpack-install', o);
    forgetTables(r.code);
    await refreshInstalled(); await registerPack(r.code);
    app.events.emit('lang:packs', installed);
    return r;
  }
  async function removePack(code) {
    await invoke('langpack-remove', code);
    forgetTables(code);
    try { app.writing?.unregisterLanguage?.(code); } catch {}
    registered.delete(code);
    await refreshInstalled(); app.events.emit('lang:packs', installed);
    if (app.settings.get('proofingLanguage') === code) app.settings.set('proofingLanguage', 'en-US');
  }
  async function installFromFile() {
    let file = null;
    try { file = await invoke('pick-file', [{ name: 'Markooj language pack', extensions: ['zip'] }], { title: 'Install language pack' }); } catch (e) { app.ui.toast(app.ui.plainError(e), { kind: 'error' }); return; }
    if (Array.isArray(file)) file = file[0];
    if (!file) return;
    try { const r = await installPack({ file }); app.ui.toast(`${r.name} language pack installed.`); renderOptionsAgain(); }
    catch (e) { app.ui.toast(app.ui.plainError(e), { kind: 'error' }); }
  }

  // ------------------------------------------------------------------ File → Options → Language
  let optEl = null, available = null, availErr = '', busy = false;
  function renderOptionsAgain() { if (optEl && optEl.isConnected) renderOptions(optEl); }
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  function proofingChoices() {
    const list = [{ code: 'en-US', name: 'English (US)' }, { code: 'en-GB', name: 'English (UK)' }];
    try { for (const l of app.writing?.languages?.() || []) if (l && l.code && !list.find(x => x.code === l.code)) list.push({ code: l.code, name: l.name || nameOf(l.code) }); } catch {}
    for (const p of installed) if (p.spelling && !list.find(x => x.code === p.code)) list.push({ code: p.code, name: p.name });
    return list;
  }
  const sizeText = n => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  const sample = { ur: 'اردو زبان', ar: 'اللغة العربية', fa: 'زبان فارسی' };
  const HELP_PACKS = 'https://github.com/datakeen/markooj-language-packs/blob/main/CONTRIBUTING.md';
  const num = n => Number(n).toLocaleString('en-US');
  /** "1,940 words · 0 checked so far · Help improve" for packs that say how many words they have
   *  ("95,210 words (94,654 from outside word lists) · …" when part of the list comes from a credited source). */
  function wordsLine(p) {
    if (p.words == null) return '';
    const outside = p.sourceWords > 0 ? ` (${num(p.sourceWords)} from outside word lists)` : '';
    return `<span class="lang-words">${num(p.words)} words${outside} · ${num(p.checked || 0)} checked so far · <a href="#" class="lang-help" data-act="help" data-tip="Help improve ${esc(p.name)}" data-tip-d="Native speakers check and add words in a spreadsheet, no coding needed. Opens the guide on GitHub in your browser.">Help improve</a></span>`;
  }
  /** "GPL-3.0" → "GPL v3", "CC-BY-SA-4.0" → "CC BY-SA 4.0" (as people say them). */
  const licenseName = l => String(l || '').replace(/^GPL-(\d)\.0(-only)?$/i, 'GPL v$1').replace(/^GPL-(\d)\.0-or-later$/i, 'GPL v$1 or later').replace(/^AGPL-(\d)\.0(-or-later)?$/i, 'AGPL v$1')
    .replace(/^CC-BY(-SA)?-(\d\.\d)$/i, (_m, sa, v) => `CC BY${sa ? '-SA' : ''} ${v}`).replace(/^Apache-2\.0$/i, 'Apache 2.0');
  /** Credits under a pack: one line per source of its word list and rules, linked to where it comes from. */
  function creditsLine(p) {
    const list = Array.isArray(p.sources) ? p.sources.filter(x => x && x.what) : [];
    if (!list.length) return '';
    const one = x => {
      const lic = licenseName(x.license); const text = x.credit || x.what;
      // the license is named once: in the credit text itself, or after it
      const said = !lic || /\b(GPL|GNU|CC BY|Creative Commons|Apache|MIT|BSD|public domain)\b/i.test(text);
      const what = x.url ? `<a href="#" class="lang-src" data-url="${esc(x.url)}" data-tip="Open the source" data-tip-d="${esc(x.url)}">${esc(text)}</a>` : esc(text);
      return `<span class="lang-credit">${what}${said ? '' : ` (${esc(lic)})`}</span>`;
    };
    return `<small class="lang-credits"><span class="lang-credits-h">Credits:</span> ${list.map(one).join('<span class="lang-sep"> · </span>')}</small>`;
  }
  function wireHelp(it) {
    it.querySelector('[data-act=help]')?.addEventListener('click', ev => { ev.preventDefault(); invoke('open-external', HELP_PACKS).catch?.(() => {}); });
    for (const a of it.querySelectorAll('.lang-src[data-url]')) a.addEventListener('click', ev => { ev.preventDefault(); if (/^https?:\/\//i.test(a.dataset.url)) invoke('open-external', a.dataset.url).catch?.(() => {}); });
  }
  const spellingText = (p, avail) => (p.spellingMode === 'near-miss' ? 'Spelling: likely typos' : p.spellingMode === 'full' ? 'Spelling: every word' : p.spelling ? 'Spelling list' : avail ? 'Rules and fonts, no spelling list yet' : 'No spelling list yet');
  function renderOptions(el) {
    optEl = el; el.innerHTML = ''; el.classList.add('mk-lang');
    const cur = app.settings.get('proofingLanguage', 'en-US');
    const row = h(`<div class="opt-row"><div class="ol"><b>Default proofing language</b><small>Used for spelling and grammar when a document does not name its language (lang in the front matter, or the language on the status bar).</small></div><div class="oc"><select class="sel" aria-label="Default proofing language" data-tip="Default proofing language" data-tip-d="Spelling and grammar use this language unless a document names its own."></select></div></div>`);
    const sel = row.querySelector('select');
    for (const l of proofingChoices()) sel.append(new Option(l.name, l.code, false, l.code === cur));
    sel.addEventListener('change', () => { app.settings.set('proofingLanguage', sel.value); app.ui.toast(`Proofing language: ${nameOf(sel.value)}`); });
    // Options → Writing has the same setting: follow it when it changes there
    const follow = p => {
      if (!sel.isConnected && sel.dataset.mounted) { app.events.off('settings:changed', follow); return; }
      sel.dataset.mounted = '1';
      if (p && p.key === 'proofingLanguage') { const v = app.settings.get('proofingLanguage', 'en-US'); if (sel.value !== v) sel.value = v; }
    };
    app.events.on('settings:changed', follow); requestAnimationFrame(() => { if (sel.isConnected) sel.dataset.mounted = '1'; });
    el.append(row);

    el.append(h('<div class="lang-head"><h4>Languages in Markooj</h4></div>'));
    const list = h('<div class="lang-list"></div>');
    for (const l of LANGS.slice(0, 2)) {
      list.append(h(`<div class="lang-item"><span class="lang-badge">${l.code === 'en-US' ? 'US' : 'UK'}</span><div class="lang-main"><b>${esc(l.name)}</b><small>Spelling and grammar, built in.</small></div><div class="lang-acts"><span class="lang-tag">Built in</span></div></div>`));
    }
    for (const p of installed) {
      const it = h(`<div class="lang-item" data-code="${esc(p.code)}"><span class="lang-badge ${p.dir === 'rtl' ? 'rtl' : ''}">${esc((p.nativeName || p.code).slice(0, 2))}</span><div class="lang-main"><b>${esc(p.name)}<span class="nat">${esc(p.nativeName || '')}</span></b><small>Version ${esc(p.version)} · ${p.dir === 'rtl' ? 'Right to left' : 'Left to right'} · ${spellingText(p)} · Font: ${esc((p.font && p.font.family) || 'system')} · ${sizeText(p.size || 0)}</small>${wordsLine(p) ? `<small>${wordsLine(p)}</small>` : ''}${creditsLine(p)}</div><div class="lang-acts"><button type="button" class="btn sm" data-act="remove" data-tip="Remove ${esc(p.name)}" data-tip-d="Delete this language pack from this computer. You can install it again later.">Remove</button></div></div>`);
      wireHelp(it);
      it.querySelector('[data-act=remove]').addEventListener('click', async ev => {
        app.ui.ripple?.(ev.currentTarget);
        const ok = await app.ui.confirm(`Remove ${p.name}?`, 'The language pack is deleted from this computer. Documents in this language keep their text, direction and fonts.');
        if (!ok) return;
        try { await removePack(p.code); app.ui.toast(`${p.name} language pack removed.`); } catch (e) { app.ui.toast(app.ui.plainError(e), { kind: 'error' }); }
        renderOptionsAgain();
      });
      list.append(it);
    }
    if (!installed.length) list.append(h('<div class="lang-empty">No language packs yet. Urdu, Arabic, Persian and Punjabi (Shahmukhi) already read right to left with their own fonts; a pack adds spelling and checks.</div>'));
    el.append(list);

    const head = h(`<div class="lang-head"><h4>Get more languages</h4><div class="lang-acts">
      <button type="button" class="btn sm" data-act="check" data-tip="Check for language packs" data-tip-d="Ask GitHub which language packs are available. Nothing is sent but the request.">${available ? 'Check again' : 'Check for language packs'}</button>
      <button type="button" class="btn sm" data-act="file" data-tip="Install from file" data-tip-d="Install a language pack (.zip) you downloaded. Every file is checked first.">Install from file…</button></div></div>`);
    head.querySelector('[data-act=check]').addEventListener('click', async ev => { app.ui.ripple?.(ev.currentTarget); await checkAvailable(); });
    head.querySelector('[data-act=file]').addEventListener('click', ev => { app.ui.ripple?.(ev.currentTarget); installFromFile(); });
    el.append(head);
    const avail = h('<div class="lang-list" data-part="available"></div>');
    if (busy) avail.append(h('<div class="lang-empty">Checking GitHub…</div>'));
    else if (availErr) avail.append(h(`<div class="lang-err">${esc(availErr)}</div>`));
    else if (!available) avail.append(h('<div class="lang-empty">Language packs for Urdu, Arabic, Punjabi (Shahmukhi) and Persian come from the Markooj language packs on GitHub. Click Check for language packs, or install one from a file.</div>'));
    else {
      if (!available.packs.length) avail.append(h('<div class="lang-empty">No language packs are published yet.</div>'));
      for (const p of available.packs) {
        const have = installed.find(x => x.code === p.code);
        const newer = have && String(have.version) !== String(p.version);
        const act = !have ? 'Download' : newer ? 'Update' : '';
        const it = h(`<div class="lang-item" data-code="${esc(p.code)}"><span class="lang-badge ${p.dir === 'rtl' ? 'rtl' : ''}">${esc((p.nativeName || p.code).slice(0, 2))}</span><div class="lang-main"><b>${esc(p.name)}<span class="nat">${esc(p.nativeName || '')}</span></b><small>Version ${esc(p.version)} · ${sizeText(p.size || 0)} · ${spellingText(p, true)} · ${esc(p.license || '')}</small>${wordsLine(p) ? `<small>${wordsLine(p)}</small>` : ''}${creditsLine(p)}</div><div class="lang-acts">${act ? `<button type="button" class="btn sm primary" data-act="get" data-tip="${act} ${esc(p.name)}" data-tip-d="Download from GitHub and install. Markooj checks the SHA-256 before installing.">${act}</button>` : '<span class="lang-tag">Installed</span>'}</div></div>`);
        wireHelp(it);
        it.querySelector('[data-act=get]')?.addEventListener('click', async ev => {
          const b = ev.currentTarget; app.ui.ripple?.(b); it.classList.add('lang-busy'); b.textContent = 'Downloading…';
          try { const r = await installPack({ url: p.url }); app.ui.toast(`${r.name} language pack installed.`); }
          catch (e) { app.ui.toast(app.ui.plainError(e), { kind: 'error' }); }
          renderOptionsAgain();
        });
        avail.append(it);
      }
    }
    el.append(avail);

    el.append(h('<div class="lang-head"><h4>Fonts for right-to-left languages</h4></div>'));
    const fonts = app.settings.get('rtlFonts', {}) || {};
    for (const [code, label] of [['ur', 'Urdu'], ['ar', 'Arabic'], ['fa', 'Persian']]) {
      const r = h(`<div class="opt-row"><div class="ol"><b>${label}</b><small>Used for ${code === 'ur' ? 'Urdu and Punjabi (Shahmukhi)' : label} text on the page, in Read mode and in PDF and web page exports.</small></div><div class="oc"><span class="lang-sample" data-mk-script="${code}" dir="rtl">${sample[code]}</span><select class="sel" aria-label="${label} font" data-tip="${label} font" data-tip-d="The font for ${label} text. ${DEFAULT_FONTS[code]} comes with Markooj."></select></div></div>`);
      const s = r.querySelector('select'); const curF = fonts[code] || DEFAULT_FONTS[code];
      for (const f of FONT_CHOICES) s.append(new Option(f + (f === DEFAULT_FONTS[code] ? ' (default)' : ''), f, false, f === curF));
      s.addEventListener('change', () => { app.settings.set('rtlFonts', { ...(app.settings.get('rtlFonts', {}) || {}), [code]: s.value }); app.ui.check?.(s); });
      el.append(r);
    }
  }
  async function checkAvailable() {
    busy = true; availErr = ''; renderOptionsAgain();
    try { available = await invoke('langpack-index'); }
    catch (e) { availErr = app.ui.plainError(e, 'Markooj could not reach GitHub.'); }
    busy = false; renderOptionsAgain();
  }
  app.options.addSection({ id: 'language', label: 'Language', order: 25, render: renderOptions });
  app.events.on('lang:packs', () => renderOptionsAgain());

  // ------------------------------------------------------------------ exports
  // Pandoc: document direction from the language, and paragraphs that read the other way wrapped in dir divs.
  function wrapAutoDirection(md, pageDir) {
    const lines = String(md).split(/\r?\n/); const eol = /\r\n/.test(md) ? '\r\n' : '\n';
    const from = fmLines(md); const { kind, pairs } = scanLines(lines, from);
    const inDir = i => pairs.some(p => p.open < i && p.close > i && fenceDir(p.info));
    const out = lines.slice(0, from); let i = from;
    while (i < lines.length) {
      if (blank(lines[i]) || kind[i] !== 'text' || inDir(i) || /^\s/.test(lines[i]) || /^\s{0,3}(?:\[[^\]]+\]:|<!--|<\/?[a-z])/i.test(lines[i])) { out.push(lines[i]); i++; continue; }
      let j = i; while (j + 1 < lines.length && !blank(lines[j + 1]) && kind[j + 1] === 'text') j++;
      const chunk = lines.slice(i, j + 1);
      const d = firstStrongDir(chunk.join('\n'));
      if (d && d !== pageDir) out.push(`::: {dir="${d}"}`, ...chunk, ':::'); else out.push(...chunk);
      i = j + 1;
    }
    return out.join(eol);
  }
  function addPandocMeta(md, doc) {
    const m = metaOf({ text: md }); const lang = m.lang || m.language;
    if (!m.dir && isRtlLang(lang) && mk.frontMatter) { try { return mk.frontMatter.write(md, { ...m, dir: 'rtl' }); } catch {} }
    return md;
  }
  if (app.exporter?.addMarkdownTransform) {
    app.exporter.addMarkdownTransform((md, ctx = {}) => {
      if (/^(md|markdown|txt|raw|gfm|commonmark)$/i.test(String(ctx.format || ''))) return md;
      if (!RTL_CHAR.test(md) && !isRtlLang(metaOf({ text: md }).lang)) return md;
      const out = addPandocMeta(md, ctx.doc);
      return wrapAutoDirection(out, docDir({ text: out }));
    });
  }
  // HTML, PDF and print: the bundled fonts travel inside the file; the page direction and the RTL layout rules
  const fontData = {};
  const FONT_FILES = { ur: 'noto-nastaliq-urdu-arabic', ar: 'noto-naskh-arabic-arabic', fa: 'vazirmatn-arabic' };
  const FAMILY_FILE = { 'Noto Nastaliq Urdu': 'ur', 'Noto Naskh Arabic': 'ar', Vazirmatn: 'fa' };
  async function loadFontData(key) {
    if (fontData[key]) return fontData[key];
    const out = {};
    for (const w of [400, 700]) {
      try {
        const buf = await (await fetch(`../fonts/${FONT_FILES[key]}-${w}-normal.woff2`)).arrayBuffer();
        let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
        out[w] = 'data:font/woff2;base64,' + btoa(s);
      } catch (e) { console.warn('font', key, e); }
    }
    fontData[key] = out; return out;
  }
  function scriptsIn(text, lang) {
    const set = new Set();
    for (const para of String(text || '').split(/\n\s*\n/)) { const s = scriptOf(para, lang); if (s) set.add(s); }
    return set;
  }
  const preload = () => { const d = app.docs.active(); if (!d || d.kind !== 'markdown') return; for (const s of scriptsIn(d.text, docLang(d))) { const fam = fontFor(s); if (FAMILY_FILE[fam]) loadFontData(FAMILY_FILE[fam]); } };
  app.events.on('doc:active', preload);
  app.events.on('doc:changed', app.debounce ? app.debounce(preload, 1500) : preload);
  const EXPORT_RTL_CSS = `
.mk-page :is(ul,ol):dir(rtl){padding-left:0;padding-right:1.6em}
.mk-page blockquote:dir(rtl){padding:2px 16px 2px 0;border-left:0;border-right:3px solid #ccc}
.mk-page :is(th,td):dir(rtl){text-align:start}
.mk-page .task-list-item:dir(rtl){padding-left:0;padding-right:1.6em}
.mk-page .task-list-item:dir(rtl) input[type=checkbox]{left:auto;right:0}
.mk-page :is(.callout,.mk-abstract):dir(rtl){border-right:3px solid currentColor;border-left:0}
.mk-page :is(.katex,.mk-math,code,kbd,pre){direction:ltr;unicode-bidi:isolate}
.mk-page div[data-mk-dir]{margin:0;padding:0;border:0;background:none}`;
  function exportCss(doc) {
    if (!doc) return '';
    const lang = docLang(doc); const used = scriptsIn(doc.text, lang);
    const dir = docDir(doc);
    if (!used.size && dir !== 'rtl') return '';
    let baseFont = '';
    try { const live = document.querySelector('.mk-page:not(.mk-export-stage)'); baseFont = live ? getComputedStyle(live).fontFamily : ''; } catch {}
    const parts = [EXPORT_RTL_CSS];
    if (dir === 'rtl') parts.push('.mk-page{direction:rtl}');
    if (baseFont) parts.push(`.mk-page{--mk-base-font:${baseFont}}`);
    const lh = { ur: 2.15, ar: 1.85, fa: 1.8 };
    for (const s of used) {
      const fam = fontFor(s); const key = FAMILY_FILE[fam]; const data = key && fontData[key];
      if (data) for (const w of [400, 700]) if (data[w]) parts.push(`@font-face{font-family:'${fam}';font-weight:${w};font-style:normal;src:url(${data[w]}) format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+0870-08FF,U+200C-200D,U+FB50-FDFF,U+FE70-FEFC}`);
      parts.push(`.mk-page [data-mk-script="${s}"]{font-family:'${fam}',var(--mk-base-font,serif);line-height:${lh[s]}}`);
    }
    return parts.join('\n');
  }
  if (app.exporter?.addCss) app.exporter.addCss(doc => exportCss(doc));

  // ------------------------------------------------------------------ boot
  app.events.on('ready', () => { addIcons(); placeButtons(); watchStatus(); registerAll(); preload(); });
  addIcons();
  try { placeButtons(); } catch {}

  app.lang = {
    languages: () => LANGS.map(l => ({ ...l })).concat(installed.filter(p => !LANGS.find(l => l.code === p.code))),
    info, nameOf, isRtlLang, firstStrongDir, scriptOf, markScript: (el, doc) => el && markScript(el, docLang(doc || app.docs.active())), docLang, docDir, setBlockDir, wrapAutoDirection, applyBlocks, exportCss,
    setDocLanguage, setDocDirection, pickLanguage, currentDir, setParagraphDir, openOptions,
    packs: { list: refreshInstalled, installed: () => installed.slice(), install: installPack, remove: removePack, index: () => invoke('langpack-index'), registerAll, helpUrl: HELP_PACKS },
    lexicon, roman,
    fonts: { defaults: { ...DEFAULT_FONTS }, fontFor, load: loadFontData },
  };

  // ------------------------------------------------------------------ smoke tests
  const UR = 'یہ اردو کا ایک پیراگراف ہے جس میں English الفاظ بھی ہیں۔';
  const AR_T = 'هذه فقرة باللغة العربية مكتوبة من اليمين إلى اليسار.';
  const FA_T = 'این یک پاراگراف فارسی است که از راست به چپ نوشته می‌شود.';
  const EN = 'An English paragraph with one Urdu word: اردو, in the middle.';
  const SAMPLE = `# Languages in one document\n\n${EN}\n\n${UR}\n\n${AR_T}\n\n${FA_T}\n\n- پہلا نکتہ\n- دوسرا نکتہ with English\n\n> ${UR}\n`;
  async function until(fn, ms = 5000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch {} await sleep(30); } return false; }
  async function renderInto(text) {
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-14000px;top:0;width:800px';
    const page = document.createElement('article'); page.className = 'mk-page'; host.append(page); document.body.append(host);
    const d = { id: 'lang-test', text, kind: 'markdown', meta: {} };
    const r = await app.render(text, { doc: d }); page.innerHTML = r.html; await app.decorate(page, d);
    return { host, page };
  }
  app.tests.register('lang: Urdu, Arabic and Persian paragraphs read right to left in their own fonts', async () => {
    const { host, page } = await renderInto(SAMPLE);
    try {
      const ps = [...page.querySelectorAll('p')];
      const find = t => ps.find(p => p.textContent.trim() === t.trim());
      const ur = find(UR), ar = find(AR_T), fa = find(FA_T), en = find(EN);
      A(ur && ar && fa && en, 'four paragraphs');
      A(getComputedStyle(ur).direction === 'rtl' && getComputedStyle(ar).direction === 'rtl' && getComputedStyle(fa).direction === 'rtl', 'RTL paragraphs read right to left');
      A(getComputedStyle(en).direction === 'ltr', 'the English paragraph (with an Urdu word) stays left to right');
      A(ur.dataset.mkScript === 'ur' && ar.dataset.mkScript === 'ar' && fa.dataset.mkScript === 'fa', `scripts: ${ur.dataset.mkScript} ${ar.dataset.mkScript} ${fa.dataset.mkScript}`);
      A(/Noto Nastaliq Urdu/.test(getComputedStyle(ur).fontFamily), 'Urdu font: ' + getComputedStyle(ur).fontFamily);
      A(/Noto Naskh Arabic/.test(getComputedStyle(ar).fontFamily), 'Arabic font: ' + getComputedStyle(ar).fontFamily);
      A(/Vazirmatn/.test(getComputedStyle(fa).fontFamily), 'Persian font: ' + getComputedStyle(fa).fontFamily);
      const ul = page.querySelector('ul'); A(ul && getComputedStyle(ul).direction === 'rtl' && parseFloat(getComputedStyle(ul).paddingRight) > 0, 'Urdu list indents on the right');
      const bq = page.querySelector('blockquote'); A(bq && getComputedStyle(bq).direction === 'rtl' && parseFloat(getComputedStyle(bq).borderRightWidth) > 0, 'Urdu quote has its bar on the right');
      for (const [fam, t] of [['Noto Nastaliq Urdu', 'اردو'], ['Noto Naskh Arabic', 'عربي'], ['Vazirmatn', 'فارسی']]) {
        const faces = await document.fonts.load(`16px '${fam}'`, t);
        A(faces.length > 0, `bundled font loads: ${fam}`);
      }
      const html = page.innerHTML; A(!/\sdir="auto"[^>]*\sdir=/.test(html), 'one dir per element'); // (data-mk-autodir="" is not a second dir)
    } finally { host.remove(); }
  });
  app.tests.register('lang: direction helpers and the document language', () => {
    A(firstStrongDir('# ' + UR) === 'rtl' && firstStrongDir('- **Bold** ' + UR) === 'ltr' && firstStrongDir('$x$ ' + AR_T) === 'rtl', 'first strong letter skips Markdown and math');
    A(scriptOf('ہے', 'en') === 'ur' && scriptOf('العربية', 'en') === 'ar' && scriptOf('گفتگو', '') === 'fa' && scriptOf('Hello', 'ur') === null, 'script guesses');
    A(scriptOf('العربية', 'fa') === 'fa', 'the document language wins');
    A(docDir({ text: '---\nlang: ur\n---\n\nx' }) === 'rtl' && docDir({ text: '---\nlang: ur\ndir: ltr\n---\n\nx' }) === 'ltr' && docDir({ text: 'x' }) === 'ltr', 'page direction from front matter');
  });
  app.tests.register('lang: paragraph direction is stored as a Pandoc div and undone exactly', () => {
    const src = `---\ntitle: T\n---\n\nFirst English line.\n\n${UR}\n\nLast line.\n`;
    // English paragraph → right to left: wrapped
    const r1 = setBlockDir(src, 4, 4, 'rtl'); A(r1.changed, 'changed');
    A(r1.text === `---\ntitle: T\n---\n\n::: {dir="rtl"}\nFirst English line.\n:::\n\n${UR}\n\nLast line.\n`, 'wrapped: ' + JSON.stringify(r1.text));
    // and back: the div goes away again
    const r2 = setBlockDir(r1.text, 5, 5, 'ltr'); A(r2.text === src, 'unwrapped: ' + JSON.stringify(r2.text));
    // an Urdu paragraph already reads right to left
    A(setBlockDir(src, 6, 6, 'rtl').reason === 'already', 'already rtl');
    // an Urdu paragraph forced left to right
    const r3 = setBlockDir(src, 6, 6, 'ltr'); A(r3.text.includes(`::: {dir="ltr"}\n${UR}\n:::`), 'ltr div');
    A(setBlockDir(r3.text, 7, 7, 'rtl').text === src, 'back to auto');
    // one paragraph taken out of a longer rtl div
    const multi = `::: {dir="rtl"}\nOne.\n\nTwo.\n\nThree.\n:::\n`;
    const r4 = setBlockDir(multi, 3, 3, 'ltr');
    A(r4.text === `::: {dir="rtl"}\nOne.\n:::\n\nTwo.\n\n::: {dir="rtl"}\nThree.\n:::\n`, 'split: ' + JSON.stringify(r4.text));
    // never inside code
    const code = 'Text\n\n```\nكود\n```\n';
    A(!setBlockDir(code, 3, 3, 'rtl').text.includes('```\n::: '), 'code fence kept whole');
    // CRLF files stay CRLF
    A(setBlockDir('Hello\r\n', 0, 0, 'rtl').text === '::: {dir="rtl"}\r\nHello\r\n:::\r\n', 'CRLF');
  });
  app.tests.register('lang: mixed English and Urdu round-trips unchanged through Word mode', async () => {
    const E = app.editor || {};
    A(E._fullRoundTrip, 'Word round-trip helper');
    const src = `---\nlang: ur\n---\n\n# عنوان Title\n\n${UR}\n\n${EN}\n\n::: {dir="rtl"}\nForced right to left with اردو inside.\n:::\n\n- پہلا نکتہ\n- second point دوسرا\n\n| نام | Name |\n| --- | --- |\n| علی | Ali |\n\n> ${AR_T}\n`;
    const { kept, converted } = await E._fullRoundTrip(src);
    A(kept === src, 'untouched: ' + JSON.stringify(kept));
    A(converted.replace(/\n+$/, '') === src.replace(/\n+$/, ''), 'rewritten from the page: ' + JSON.stringify(converted));
    // typing into the Urdu paragraph changes only that paragraph
    A(E.createWord && E._offscreen && E.fakeDoc, 'Word helpers');
    const host = E._offscreen(); const ed = E.createWord(); const d = E.fakeDoc(src);
    try {
      ed.mount(host, d); await until(() => ed.page && ed.page.querySelector('p[dir]'));
      await sleep(100);
      const p = [...ed.page.querySelectorAll('p')].find(x => x.textContent.startsWith('یہ اردو'));
      A(p && p.getAttribute('dir') === 'auto' && getComputedStyle(p).direction === 'rtl', 'Urdu paragraph is rtl in Word mode');
      const t = [...p.childNodes].find(n => n.nodeType === 3); t.data = t.data.replace('ایک', 'ایک اور');
      await sleep(30); ed._commit();
      A(d.text === src.replace('ایک', 'ایک اور'), 'only the Urdu paragraph changed: ' + JSON.stringify(d.text));
    } finally { ed.unmount(); host.remove(); }
  });
  app.tests.register('lang: Right-to-left and Left-to-right buttons work in Word mode and round-trip', async () => {
    const m0 = app.mode; const prev = app.docs.active();
    const src = `First English line.\n\n${UR}\n`;
    const d = app.docs.create({ text: src, title: 'Direction test' });
    try {
      app.setMode('word'); await sleep(50);
      const ad = app.editors.active(); await ad.refresh?.();
      await until(() => ad.page && [...ad.page.querySelectorAll('p')].some(p => /First English/.test(p.textContent)));
      const p = [...ad.page.querySelectorAll('p')].find(x => /First English/.test(x.textContent));
      ad.page.focus(); const r = document.createRange(); r.setStart(p.firstChild, 3); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r);
      A(app.commands.get('para.ltr').isActive() && !app.commands.get('para.rtl').isActive(), 'LTR shows as on');
      await app.commands.run('para.rtl');
      A(d.text === `::: {dir="rtl"}\nFirst English line.\n:::\n\n${UR}\n`, 'stored as a div: ' + JSON.stringify(d.text));
      await until(() => ad.page.querySelector('div[data-mk-dir="rtl"]'));
      const p2 = [...ad.page.querySelectorAll('p')].find(x => /First English/.test(x.textContent));
      A(p2 && getComputedStyle(p2).direction === 'rtl', 'paragraph now reads right to left');
      const r2 = document.createRange(); r2.setStart(p2.firstChild, 2); r2.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r2);
      A(app.commands.get('para.rtl').isActive(), 'RTL shows as on');
      await app.commands.run('para.ltr');
      A(d.text === src, 'back to the original text: ' + JSON.stringify(d.text));
      const home = app.ribbon.tabs().find(t => t.id === 'home');
      A(home.groups.some(g => JSON.stringify(g.items).includes('"para.rtl"')), 'buttons on Home');
      A(app.tooltips ? !!app.tooltips.info('para.rtl').description : true, 'ScreenTip');
    } finally { await app.docs.close(d.id, { force: true }); if (prev && app.docs.get(prev.id)) app.docs.activate(prev.id); app.setMode(m0); }
  });
  app.tests.register('lang: exports carry direction (Pandoc divs, HTML CSS and fonts)', async () => {
    const md = `---\nlang: ur\n---\n\n${UR}\n\n${EN}\n`;
    const t = await (async () => { let x = md; x = addPandocMeta(x); return wrapAutoDirection(x, docDir({ text: x })); })();
    A(/^dir: rtl$/m.test(t), 'dir: rtl added for Pandoc');
    A(t.includes(`::: {dir="ltr"}\n${EN}\n:::`) && !t.includes(`::: {dir="rtl"}\n${UR}`), 'English paragraph marked ltr in an rtl document: ' + JSON.stringify(t));
    await loadFontData('ur');
    const css = exportCss({ text: md });
    A(/direction:rtl/.test(css) && /data:font\/woff2;base64,/.test(css) && /Noto Nastaliq Urdu/.test(css), 'export CSS has direction and the Urdu font');
    A(exportCss({ text: 'Plain English.' }) === '', 'nothing for plain English');
  });
  // ---- language packs ----
  async function jszip() {
    if (window.JSZip) return window.JSZip;
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '../node_modules/jszip/dist/jszip.min.js'; s.onload = res; s.onerror = () => rej(new Error('JSZip did not load')); document.head.append(s); });
    return window.JSZip;
  }
  const hex = async buf => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(b => b.toString(16).padStart(2, '0')).join('');
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  async function makeZip(files, manifestPatch = {}) {
    const Z = await jszip(); const z = new Z(); const enc = new TextEncoder(); const sums = {};
    for (const [n, t] of Object.entries(files)) { const u = enc.encode(t); sums[n] = await hex(u); z.file(n, u); }
    z.file('manifest.json', JSON.stringify({ format: 1, code: 'xx', name: 'Test language', nativeName: 'Test', dir: 'ltr', version: '0.0.1', files: sums, rules: 'rules.json', spelling: null, ...manifestPatch }));
    return z.generateAsync({ type: 'uint8array' });
  }
  // The real packs are built in the markooj-language-packs repository (its dist/ folder, found next to the app folder in a
  // development copy). Without it (a packaged copy, or no checkout) the tests use a pack built in memory.
  const MEM_RULES = JSON.stringify({ rules: [{ id: 'test-yeh', category: 'correctness', pattern: 'ي', flags: 'g', replace: 'ی', message: 'Use ی', why: 'Test rule.', wrong: 'علي', right: 'علی' }] });
  app.tests.register('lang: a locally built language pack installs from file, registers and removes', async () => {
    const dir = await invoke('langpack-local-dir');
    if (!dir) {
      const r = await installPack({ data: b64(await makeZip({ 'rules.json': MEM_RULES }, { dir: 'rtl' })) });
      A(r.code === 'xx' && r.dir === 'rtl', 'installed ' + JSON.stringify(r));
      A((await invoke('langpack-list')).some(p => p.code === 'xx'), 'listed');
      if (typeof app.writing?.languages === 'function') A((app.writing.languages() || []).some(l => l.code === 'xx'), 'registered with the Writing Assistant');
      await removePack('xx');
      A(!(await invoke('langpack-list')).some(p => p.code === 'xx'), 'removed');
      return;
    }
    const idx = JSON.parse(await invoke('read-text', dir + '/index.json'));
    const pack = idx.packs.find(p => p.code === 'fa') || idx.packs[0]; A(pack, 'a pack in index.json');
    const r = await installPack({ file: dir + '/' + pack.file });
    A(r.code === pack.code && r.dir === 'rtl', 'installed ' + JSON.stringify(r));
    const list = await invoke('langpack-list'); A(list.some(p => p.code === pack.code), 'listed');
    const f = await invoke('langpack-files', pack.code);
    A(f.rules && Array.isArray(f.rules.rules) && f.rules.rules.length, 'rules');
    if (pack.spelling) A(f.aff && f.dic && f.dic.length > 1000, 'spelling list');
    if (typeof app.writing?.languages === 'function') A((app.writing.languages() || []).some(l => l.code === pack.code), 'registered with the Writing Assistant');
    await removePack(pack.code);
    A(!(await invoke('langpack-list')).some(p => p.code === pack.code), 'removed');
  });
  app.tests.register('lang: a pack with a wrong SHA-256 is refused', async () => {
    const dir = await invoke('langpack-local-dir');
    let err = null;
    if (!dir) {
      try { await invoke('langpack-install', { data: b64(await makeZip({ 'rules.json': MEM_RULES })), sha256: '0'.repeat(64) }); } catch (e) { err = e; }
    } else {
      const idx = JSON.parse(await invoke('read-text', dir + '/index.json'));
      const pack = idx.packs[0];
      try { await invoke('langpack-install', { file: dir + '/' + pack.file, sha256: '0'.repeat(64) }); } catch (e) { err = e; }
    }
    A(err && /SHA-256/.test(String(err.message)), 'expected sha mismatch: ' + err);
    // a file changed inside the zip after the manifest was written
    const good = await makeZip({ 'rules.json': '{"rules":[]}' });
    const Z = await jszip(); const z = await Z.loadAsync(good); z.file('rules.json', '{"rules":[{"evil":1}]}');
    const bad = await z.generateAsync({ type: 'uint8array' });
    err = null; try { await invoke('langpack-install', { data: b64(bad) }); } catch (e) { err = e; }
    A(err && /SHA-256|damaged/i.test(String(err.message)), 'tampered file refused: ' + err);
    A(!(await invoke('langpack-list')).some(p => p.code === 'xx'), 'nothing installed');
    // the untampered test pack installs and removes
    const ok = await invoke('langpack-install', { data: b64(good) }); A(ok.code === 'xx', 'good test pack');
    await invoke('langpack-remove', 'xx');
  });
  app.tests.register('lang: a pack whose paths leave its folder (zip-slip) is refused', async () => {
    for (const name of ['../evil.txt', '..\\evil.txt', 'a/../../evil.txt', '/abs.txt', 'C:/evil.txt']) {
      const Z = await jszip(); const z = new Z();
      z.file('manifest.json', JSON.stringify({ format: 1, code: 'xy', name: 'Slip', files: { [name]: '0'.repeat(64) } }));
      z.file(name, 'x', { createFolders: false });
      const u = await z.generateAsync({ type: 'uint8array' });
      let err = null; try { await invoke('langpack-install', { data: b64(u) }); } catch (e) { err = e; }
      A(err && /unsafe|manifest|not a Markooj/i.test(String(err.message)), `refused ${name}: ${err}`);
    }
    A(!(await invoke('langpack-list')).some(p => p.code === 'xy'), 'nothing installed');
  });
  // ---- pack format 2 (word list, Roman letter map, near-miss spelling) ----
  const LEX2 = { fields: ['word', 'aarab', 'roman', 'freq', 'pos', 'status'], rows: [
    ['كتان', '', ['kattan'], 2, 'noun-m', 'seed'], ['كتاب', 'كِتَاب', ['kitab', 'kitaab'], 5, 'noun-m', 'checked'],
    ['قلم', 'قَلَم', ['qalam'], 4, 'noun-m', 'seed'], ['ولد', 'وَلَد', ['walad'], 3, 'noun-m', 'seed']] };
  const ROMAN2 = { fields: ['roman', 'letters', 'note'], rows: [['k', ['ك', 'ک'], ''], ['aa', ['ا', 'آ'], 'long a']] };
  const MAN2 = { format: 2, code: 'xz', name: 'Test (Shahmukhi)', nativeName: 'ٹیسٹ', region: 'PK', dir: 'rtl', version: '2.0.0', font: { family: 'Noto Nastaliq Urdu', bundled: true },
    spelling: { mode: 'near-miss' }, clitics: { prefix: ['و', 'ال', 'بال'], suffix: ['ها'] }, lexicon: 'lexicon.json', roman: 'roman.json', rules: 'rules.json', stats: { words: 4, checked: 1 } };
  const files2 = (o = {}) => ({ 'lexicon.json': JSON.stringify(LEX2), 'roman.json': JSON.stringify(ROMAN2), 'rules.json': MEM_RULES, ...o });
  const listed = async code => (await invoke('langpack-list')).some(p => p.code === code);
  app.tests.register('lang: a format-2 pack (word list, Roman map, near-miss spelling) installs, checks and removes', async () => {
    const r = await installPack({ data: b64(await makeZip(files2(), MAN2)) });
    try {
      A(r.code === 'xz' && r.format === 2 && r.spellingMode === 'near-miss' && r.spelling && r.words === 4 && r.checked === 1 && r.dir === 'rtl', 'installed ' + JSON.stringify(r));
      A(await listed('xz'), 'listed');
      const lex = await app.lang.lexicon('xz');
      A(lex && lex.rows.length === 4 && lex.fields.includes('roman') && Array.isArray(lex.rows[1][2]), 'lexicon(code): ' + JSON.stringify(lex && lex.fields));
      const rom = await app.lang.roman('xz');
      A(rom && rom.rows[0][0] === 'k' && rom.rows[0][1][0] === 'ك', 'roman(code)');
      A(app.writing?.languages?.().some(l => l.code === 'xz' && l.spellingMode === 'near-miss'), 'registered with near-miss spelling');
      const found = (await app.writing.checkText('كتاا وكتاب بالكتاب قلم سيارات\n', { lang: 'xz', harper: false })).filter(f => f.rule === 'spelling');
      A(found.length === 1 && found[0].text === 'كتاا' && found[0]._sugg[0] === 'كتاب' && found[0]._sugg[1] === 'كتان', 'near-miss through the pack: ' + JSON.stringify(found.map(f => [f.text, f._sugg])));
      // Options: word count, checked count and the way to help
      const el = document.createElement('div'); renderOptions(el);
      const item = el.querySelector('.lang-item[data-code="xz"]');
      A(item && /4 words · 1 checked so far · Help improve/.test(item.textContent) && item.querySelector('[data-act=help]'), 'Options line: ' + (item && item.textContent));
      A(/Spelling: likely typos/.test(item.textContent), 'spelling mode named');
      openOptions(); await sleep(900);
      try {
        const sel = '.opt-card[data-section="language"] .lang-item[data-code="xz"] .lang-help';
        await until(() => document.querySelector(sel), 3000);
        const live = document.querySelector(sel);
        A(live && live.getClientRects().length, 'Help improve is drawn in Options');
        live.closest('.lang-item').scrollIntoView({ block: 'center' }); await sleep(250);
        try { await invoke('smoke-shot', 'options-language-pack'); } catch {}
      } finally { app.backstage.close(); await sleep(200); }
      // the counts come from the word list itself when the manifest leaves them out
      const r2 = await installPack({ data: b64(await makeZip(files2(), { ...MAN2, stats: undefined })) });
      A(r2.words === 4 && r2.checked === 1, 'counted from the status column: ' + JSON.stringify([r2.words, r2.checked]));
    } finally { await removePack('xz'); }
    A(!(await listed('xz')), 'removed');
    A((await app.lang.lexicon('xz')) === null, 'no word list after removal');
    A(!app.writing?.languages?.().some(l => l.code === 'xz'), 'unregistered');
  });
  app.tests.register('lang: format-2 packs with a bad word list, Roman map, rules or manifest are refused', async () => {
    const cases = [
      ['lexicon row with too few cells', files2({ 'lexicon.json': JSON.stringify({ fields: ['word', 'freq'], rows: [['كتاب']] }) }), MAN2, /shape|cells/],
      ['lexicon without a word field', files2({ 'lexicon.json': JSON.stringify({ fields: ['text'], rows: [] }) }), MAN2, /word/],
      ['lexicon word with a space', files2({ 'lexicon.json': JSON.stringify({ fields: ['word'], rows: [['كتاب قلم']] }) }), MAN2, /single word/],
      ['lexicon freq out of range', files2({ 'lexicon.json': JSON.stringify({ fields: ['word', 'freq'], rows: [['كتاب', 9]] }) }), MAN2, /0 to 5/],
      ['lexicon is not JSON', files2({ 'lexicon.json': 'not json' }), MAN2, /could not be read/],
      ['lexicon is a list', files2({ 'lexicon.json': '[]' }), MAN2, /shape/],
      ['roman map without letters', files2({ 'roman.json': JSON.stringify({ fields: ['roman'], rows: [] }) }), MAN2, /letters/],
      ['rules not a list', files2({ 'rules.json': '{"rules":5}' }), MAN2, /rules/],
      ['a named file the manifest does not list', files2(), { ...MAN2, lexicon: 'other.json' }, /does not list/],
      ['near-miss without a word list', files2(), { ...MAN2, lexicon: undefined }, /near-miss/],
      ['unknown spelling mode', files2(), { ...MAN2, spelling: { mode: 'magic' } }, /spelling mode/],
      ['bad clitics', files2(), { ...MAN2, clitics: { prefix: 'و' } }, /clitics/],
      ['a newer pack format', files2(), { ...MAN2, format: 3 }, /newer Markooj/],
    ];
    for (const [what, files, man, re] of cases) {
      let err = null; try { await invoke('langpack-install', { data: b64(await makeZip(files, man)) }); } catch (e) { err = e; }
      A(err && re.test(String(err.message)), `${what}: ${err}`);
    }
    A(!(await listed('xz')), 'nothing installed');
  });
  app.tests.register('lang: format-1 packs still install (rules only, and with a Hunspell list)', async () => {
    const r = await installPack({ data: b64(await makeZip({ 'rules.json': MEM_RULES })) });
    try {
      A(r.code === 'xx' && r.format === 1 && !r.spelling && r.spellingMode === null && r.words === null, 'rules-only format 1: ' + JSON.stringify(r));
      A(app.writing?.languages?.().some(l => l.code === 'xx' && l.rules === 1), 'rules reach the Writing Assistant');
      A((await app.lang.lexicon('xx')) === null, 'no word list in a format-1 pack');
      const el = document.createElement('div'); renderOptions(el);
      const item = el.querySelector('.lang-item[data-code="xx"]'); A(item && !/checked so far/.test(item.textContent), 'no word count line for format 1');
    } finally { await removePack('xx'); }
    const aff = 'SET UTF-8\nTRY abcdefghijklmnopqrstuvwxyz\n', dic = '2\nkitab\nqalam\n';
    const r2 = await installPack({ data: b64(await makeZip({ 'rules.json': MEM_RULES, 'xx.aff': aff, 'xx.dic': dic }, { spelling: { aff: 'xx.aff', dic: 'xx.dic', encoding: 'UTF-8' } })) });
    try {
      A(r2.format === 1 && r2.spelling && r2.spellingMode === 'full', 'format 1 with Hunspell: ' + JSON.stringify(r2));
      const f = await invoke('langpack-files', 'xx');
      A(f.aff === aff && f.dic === dic && f.spellingMode === 'full', 'aff/dic handed to the Writing Assistant');
    } finally { await removePack('xx'); }
    A(!(await listed('xx')), 'removed');
    // spelling.mode "off" (format 2): installs with no spelling, even with an .aff/.dic in the zip, and without one
    for (const extra of [{ 'xx.aff': aff, 'xx.dic': dic }, {}]) {
      const sp = extra['xx.aff'] ? { mode: 'off', aff: 'xx.aff', dic: 'xx.dic', encoding: 'UTF-8' } : { mode: 'off' };
      const r3 = await installPack({ data: b64(await makeZip({ 'rules.json': MEM_RULES, ...extra }, { format: 2, spelling: sp })) });
      try {
        A(r3.format === 2 && !r3.spelling && r3.spellingMode === null, 'spelling off: ' + JSON.stringify(r3));
        const f = await invoke('langpack-files', 'xx'); A(!f.aff && !f.dic && f.spellingMode === null, 'no word list handed over when spelling is off');
      } finally { await removePack('xx'); }
    }
  });
  // ---- full spelling from a word list (format 2: lexicon with counts, similar letters, phrases, credits) ----
  const LEX3 = { fields: ['word', 'aarab', 'roman', 'freq', 'pos', 'count', 'note', 'tags'], rows: [
    ['ضرورت', 'ضَرُورَت', ['zarurat'], 5, 'noun-f', 14000, 'need', ['common']], ['کتاب', '', ['kitab'], 5, 'noun-f', 4600, '', []],
    ['یہ', '', ['yeh'], 5, 'pron', 80000, null, null], ['ہے', '', ['hai'], 5, 'verb', 98000, '', []], ['اور', '', ['aur'], 5, 'conj', 90000, '', []]] };
  const SIM3 = { groups: [{ kind: 'sound', letters: ['ذ', 'ز', 'ض', 'ظ'] }, { kind: 'shape', letters: ['ب', 'پ', 'ت', 'ث'] }] };
  const PHR3 = { fields: ['phrase', 'count'], rows: [['ضرورت ہے', 120], ['کتاب ہے', 3]] };
  const CLE_CREDIT = 'Urdu word list from the Urdu Spell Checker v1.0 by the Center for Language Engineering (CLE), KICS, UET Lahore (originally CRULP), used under the GNU GPL v3.';
  const MAN3 = { ...MAN2, code: 'xq', name: 'Full test', spelling: { mode: 'full' }, clitics: { prefix: [], suffix: [] }, similar: 'similar.json', phrases: 'phrases.json', stats: undefined,
    counts: { words: 5, checked: 0, rules: 1, sourceWords: 4 }, license: 'CC BY-SA 4.0 (Markooj words and rules); GPL-3.0 (CLE word list)',
    sources: [{ what: 'Word list and rules written by Markooj contributors', license: 'CC-BY-SA-4.0', url: 'https://github.com/datakeen/markooj-language-packs' },
      { what: 'Urdu Spell Checker v1.0 word list, CLE, KICS, UET Lahore', license: 'GPL-3.0', url: 'https://www.cle.org.pk/software/langproc/spellcheck.htm', credit: CLE_CREDIT }, { what: 'Bad link', license: 'MIT', url: 'javascript:alert(1)' }] };
  const files3 = (o = {}) => ({ 'lexicon.json': JSON.stringify(LEX3), 'roman.json': JSON.stringify(ROMAN2), 'rules.json': MEM_RULES, 'similar.json': JSON.stringify(SIM3), 'phrases.json': JSON.stringify(PHR3), ...o });
  app.tests.register('lang: a full-spelling pack (word list with counts, similar letters, phrases, credits) installs, checks and removes', async () => {
    const r = await installPack({ data: b64(await makeZip(files3(), MAN3)) });
    try {
      A(r.code === 'xq' && r.spellingMode === 'full' && r.spelling && r.lexicon && r.similar && r.phrases && r.words === 5 && r.sourceWords === 4, 'installed ' + JSON.stringify(r));
      A(r.sources.length === 3 && r.sources[1].credit === CLE_CREDIT && /CLE/.test(r.sources[1].what) && r.sources[1].url === 'https://www.cle.org.pk/software/langproc/spellcheck.htm' && !r.sources[2].url, 'credits kept, unsafe link dropped: ' + JSON.stringify(r.sources));
      const f = await invoke('langpack-files', 'xq');
      A(f.spellingMode === 'full' && f.lexicon === true && !f.aff && !f.dic && f.similar && f.similar.groups.length === 2 && f.phrases === 'phrases.json', 'files: ' + JSON.stringify({ ...f, manifest: undefined, rules: undefined }));
      const wl = await invoke('langpack-wordlist', 'xq');
      A(wl && wl.list.split('\n')[0] === 'ضرورت' && wl.list.split('\n')[1] === 'ضَرُورَت' && wl.count[0] === 14000 && wl.freq[0] === 5 && wl.words === 5, 'compact word list: ' + JSON.stringify(wl));
      const lex = await app.lang.lexicon('xq'); A(lex && lex.fields.includes('count') && lex.fields.includes('tags'), 'unknown fields are kept');
      A(app.writing.languages().some(l => l.code === 'xq' && l.spellingMode === 'full' && l.wordList), 'registered with full spelling from the word list');
      const found = (await app.writing.checkText('یہ زرورت ہے اور کتاب قلمدان\n', { lang: 'xq', harper: false })).filter(x => x.rule === 'spelling');
      A(found.length === 2 && found[0].text === 'زرورت' && found[0]._sugg[0] === 'ضرورت' && found[1].text === 'قلمدان', 'full spelling through the pack: ' + JSON.stringify(found.map(x => [x.text, x._sugg])));
      // Options: spelling mode, word counts and credits with a link to the source
      const el = document.createElement('div'); renderOptions(el);
      const item = el.querySelector('.lang-item[data-code="xq"]');
      A(item && /Spelling: every word/.test(item.textContent) && /5 words \(4 from outside word lists\)/.test(item.textContent), 'Options line: ' + (item && item.textContent));
      const cred = item.querySelector('.lang-credits');
      A(cred && cred.textContent.includes(CLE_CREDIT) && /Markooj contributors \(CC BY-SA 4\.0\)/.test(cred.textContent) && !/GPL v3\)/.test(cred.textContent), 'credits: ' + (cred && cred.textContent));
      A(item.querySelector('.lang-src[data-url="https://www.cle.org.pk/software/langproc/spellcheck.htm"]') && item.querySelectorAll('.lang-src').length === 2, 'credit links');
    } finally { await removePack('xq'); }
    A(!(await listed('xq')), 'removed');
    A((await invoke('langpack-wordlist', 'xq').catch(() => null)) === null, 'no word list after removal');
  });
  app.tests.register('lang: full-spelling packs with bad similar letters, phrases or counts are refused', async () => {
    const cases = [
      ['similar kind unknown', files3({ 'similar.json': JSON.stringify({ groups: [{ kind: 'taste', letters: ['ذ', 'ز'] }] }) }), MAN3, /similar.*kind/],
      ['similar letters not a list', files3({ 'similar.json': JSON.stringify({ groups: [{ kind: 'sound', letters: 'ذز' }] }) }), MAN3, /similar.*letters/],
      ['similar group of one letter', files3({ 'similar.json': JSON.stringify({ groups: [{ kind: 'sound', letters: ['ذ'] }] }) }), MAN3, /similar.*letters/],
      ['similar without groups', files3({ 'similar.json': '{}' }), MAN3, /similar.*groups/],
      ['phrases without a phrase field', files3({ 'phrases.json': JSON.stringify({ fields: ['text', 'count'], rows: [] }) }), MAN3, /phrase/],
      ['phrase count negative', files3({ 'phrases.json': JSON.stringify({ fields: ['phrase', 'count'], rows: [['ضرورت ہے', -1]] }) }), MAN3, /whole number/],
      ['lexicon count not a whole number', files3({ 'lexicon.json': JSON.stringify({ fields: ['word', 'count'], rows: [['کتاب', 1.5]] }) }), MAN3, /whole number/],
      ['lexicon extra field is an object', files3({ 'lexicon.json': JSON.stringify({ fields: ['word', 'meta'], rows: [['کتاب', { a: 1 }]] }) }), MAN3, /not text/],
      ['similar named but not listed', files3(), { ...MAN3, similar: 'other.json' }, /does not list/],
      ['full with no word list at all', files3(), { ...MAN3, lexicon: undefined }, /full spelling/],
    ];
    for (const [what, files, man, re] of cases) {
      let err = null; try { await invoke('langpack-install', { data: b64(await makeZip(files, man)) }); } catch (e) { err = e; }
      A(err && re.test(String(err.message)), `${what}: ${err}`);
    }
    A(!(await listed('xq')), 'nothing installed');
    // the index's credits and outside word counts reach Options too
    const el = document.createElement('div'); const keep = available;
    available = { packs: [{ code: 'xq', name: 'Full test', nativeName: '', dir: 'rtl', version: '2.1.0', size: 3e6, spelling: true, spellingMode: 'full', license: 'CC BY-SA 4.0', words: 95210, checked: 0, sourceWords: 94654, sources: [{ what: CLE_CREDIT, license: 'GPL-3.0', url: 'https://www.cle.org.pk/software/langproc/spellcheck.htm' }] }] };
    try { renderOptions(el); } finally { available = keep; }
    const item = el.querySelector('[data-part="available"] .lang-item[data-code="xq"]');
    A(item && /95,210 words \(94,654 from outside word lists\)/.test(item.textContent) && item.querySelector('.lang-credits')?.textContent.includes('CLE'), 'available pack line: ' + (item && item.textContent));
  });
  // ---- the real packs (ur, ar, pnb, fa) from the markooj-language-packs build, when its dist/ folder is next to the app ----
  const LETTERS = /^[؀-ۿݐ-ݿ]+$/;
  /** A built full-spelling pack (Urdu with the CLE word list): common words pass, made-up typos are flagged with the right
   *  word among the suggestions, the credits show, and indexing plus checking stays quick. */
  async function fullPackChecks(code, r, f, rules) {
    const R = window.MkWritingRules;
    A(!f.aff && !f.dic && f.lexicon, code + ': full spelling reads the word list, not Hunspell');
    A(code !== 'ur' || r.sources.some(s => (s.credit || s.what) === CLE_CREDIT && /cle\.org\.pk/.test(s.url || '')), code + ': the CLE credit is in the manifest: ' + JSON.stringify(r.sources));
    const el = document.createElement('div'); renderOptions(el);
    const item = el.querySelector(`.lang-item[data-code="${code}"]`);
    A(item && /Spelling: every word/.test(item.textContent) && item.querySelector('.lang-credits') && (code !== 'ur' || (/CLE/.test(item.querySelector('.lang-credits').textContent) && item.querySelector('.lang-credits a.lang-src[data-url*="cle.org.pk"]') && item.textContent.includes(`${num(r.words)} words (${num(r.sourceWords)} from outside word lists)`))), code + ': Options shows the mode, the counts and the linked credits: ' + (item && item.textContent));
    const lex = await app.lang.lexicon(code); A(lex && lex.rows.length === r.words, code + ' word list loaded');
    const wi = lex.fields.indexOf('word'), ci = lex.fields.indexOf('count');
    A(ci >= 0, code + ': the word list has counts');
    // 40 of the most common words of the list (by count) are not flagged
    const common = lex.rows.filter(x => LETTERS.test(x[wi]) && R.nmNormalize(x[wi]).length >= 2 && +x[ci] > 0).sort((a, b) => b[ci] - a[ci]).slice(0, 400);
    const forty = common.filter((_, i) => i % 10 === 0).map(x => x[wi]).slice(0, 40);
    A(forty.length === 40, code + ': 40 common words');
    A(await app.writing.nearMiss.ensure(code), code + ': word list ready');
    const flagged = forty.filter(w => app.writing.nearMiss.check(w, code));
    A(!flagged.length, code + ': common words flagged: ' + flagged.join(' '));
    // five made-up typos (a sound-alike letter, a missing letter) are flagged, with the right word among the suggestions
    const typos = code === 'ur' ? [['زرورت', 'ضرورت'], ['ہکومت', 'حکومت'], ['پاکستن', 'پاکستان'], ['کطاب', 'کتاب'], ['معلومت', 'معلومات']] : [];
    for (const [typo, right] of typos) {
      const hit = app.writing.nearMiss.check(typo, code);
      A(hit && hit.suggestions.map(R.nmNormalize).includes(right), `${code}: ${typo} flagged with ${right}: ${JSON.stringify(hit)}`);
    }
    // through the Writing Assistant (in the worker): only the typos are flagged in a document of common words
    const doc = forty.join(' ') + ' ' + typos.map(t => t[0]).join(' ') + '\n';
    const all = await app.writing.checkText(doc, { lang: code, harper: false });
    const sp = all.filter(x => x.rule === 'spelling').map(x => R.nmNormalize(x.text));
    const ruled = new Set(all.filter(x => x.rule !== 'spelling').map(x => R.nmNormalize(x.text)));
    A(sp.every(w => typos.some(t => t[0] === w)) && typos.every(t => sp.includes(t[0]) || ruled.has(t[0])), code + ': in a document only the typos are flagged: ' + JSON.stringify(all.map(x => [x.rule, x.text])));
    // speed: build the index from the word list and check about 1,500 words (a generous limit: slow test machines)
    let t0 = performance.now(); const wl = await invoke('langpack-wordlist', code); const ipcMs = performance.now() - t0;
    const words = wl.list.split('\n');
    const rank = words.map((_, i) => R.fsRank(wl.freq ? wl.freq[i] : 3, wl.count ? wl.count[i] : 0));
    let t = performance.now();
    const idx = R.fsBuild({ list: words, rank, similar: f.similar, prefix: f.clitics.prefix, suffix: f.clitics.suffix });
    R.fsIndex(idx);
    const build = performance.now() - t;
    const pool = common.map(x => x[wi]); const text = [];
    for (let i = 0; i < 1500; i++) text.push(i % 50 === 7 && typos.length ? typos[(i / 50 | 0) % typos.length][0] : pool[(i * 37) % pool.length]);
    t = performance.now();
    const found = R.nmFindings(idx, { text: text.join(' ') }, 'Urdu');
    const check = performance.now() - t;
    t = performance.now();
    await app.writing.checkText(text.join(' ') + '\n', { lang: code, harper: false });
    const viaWorker = performance.now() - t;
    console.log(`[lang] ${code}: ${words.length} words (${idx.size} distinct) indexed in ${Math.round(build)} ms (${idx.del.keys} keys); 1,500 words checked in ${Math.round(check)} ms (${found.length} flagged); through the worker ${Math.round(viaWorker)} ms; word list over IPC ${Math.round(ipcMs)} ms`);
    A(build < 4000 && check < 3000 && viaWorker < 8000, `${code}: index ${Math.round(build)} ms (limit 4,000), check ${Math.round(check)} ms (limit 3,000), worker ${Math.round(viaWorker)} ms (limit 8,000)`);
  }
  for (const [code, langName] of [['ur', 'Urdu'], ['ar', 'Arabic'], ['pnb', 'Punjabi'], ['fa', 'Persian']]) app.tests.register(`lang: the built ${langName} pack installs; its rules fix their own examples${code === 'fa' ? '' : '; its word-list spelling works'}`, async () => {
    const dir = await invoke('langpack-local-dir');
    if (!dir) return; // no packs checkout (packaged copy, or packs not built): nothing to test here
    const R = window.MkWritingRules; A(R && R.nmNormalize, 'writing rules loaded');
    const idx = JSON.parse(await invoke('read-text', dir + '/index.json'));
    A(await until(() => typeof app.writing?.registerLanguage === 'function', 15000), 'the Writing Assistant is ready');
    {
      const entry = idx.packs.find(p => p.code === code); A(entry, code + ' is in dist/index.json');
      const r = await installPack({ file: dir + '/' + entry.file });
      try {
        const wordList = code !== 'fa'; // Persian has a full Hunspell list instead
        // Urdu moves to full spelling with the CLE word list (pack 2.1.0); Arabic and Punjabi stay near-miss
        const nearMiss = wordList && entry.spellingMode !== 'full';
        A(r.code === code && r.format === 2 && r.spellingMode === (nearMiss ? 'near-miss' : 'full') && r.spellingMode === entry.spellingMode && r.dir === 'rtl' && r.words === entry.words && r.words > 1000 && r.lexicon === wordList && r.roman === wordList, code + ' installed: ' + JSON.stringify(r));
        const f = await invoke('langpack-files', code);
        const rules = (f.rules && f.rules.rules) || []; A(rules.length === entry.rules, code + ': all rules handed over');
        A(app.writing.languages().some(l => l.code === code && l.rules === rules.length), code + ' is registered with the Writing Assistant');
        // every rule turns its own wrong example into its right example, and leaves the right example alone
        const bad = [];
        for (const rule of rules) {
          if (rule.wrong == null || rule.right == null) continue;
          const b = R.blocks(R.prose(rule.wrong))[0];
          const hits = b ? R.checkCustom(b, [rule]) : [];
          if (!hits.length) { bad.push(rule.id + ': does not fire on ' + JSON.stringify(rule.wrong)); continue; }
          if (rule.replace != null) {
            // one of the offered fixes (the first, or another when the rule offers a choice) gives the right example
            const outs = [];
            for (let k = 0; k < [].concat(rule.replace).length; k++) {
              let out = b.text;
              for (const x of hits.slice().sort((p, q) => q.start - p.start)) { const reps = x.replacements || []; if (reps.length) out = out.slice(0, x.start) + reps[Math.min(k, reps.length - 1)] + out.slice(x.end); }
              outs.push(out);
            }
            if (!outs.includes(rule.right)) bad.push(rule.id + ': ' + JSON.stringify(rule.wrong) + ' → ' + JSON.stringify(outs) + ' (want ' + JSON.stringify(rule.right) + ')');
          }
          const br = R.blocks(R.prose(rule.right))[0];
          if (br && R.checkCustom(br, [rule]).length) bad.push(rule.id + ': still fires on its right example ' + JSON.stringify(rule.right));
        }
        A(!bad.length, code + ' rules:\n' + bad.slice(0, 12).join('\n'));
        // and through the Writing Assistant (the registered language): a sample of rules fire in a document
        const plainEx = rules.filter(x => x.wrong && x.right && !/[\n#*_`[\]<>|]/.test(x.wrong));
        const sample = plainEx.filter((_, i) => i % Math.max(1, Math.floor(plainEx.length / 8)) === 0).slice(0, 8);
        for (const rule of sample) {
          const found = await app.writing.checkText(rule.wrong + '\n', { lang: code, harper: false });
          A(found.some(x => x.rule === 'lang:' + rule.id), code + ':' + rule.id + ' fires in a document: ' + JSON.stringify(found.map(x => x.rule)));
        }
        if (!wordList) { A(f.aff && f.dic && f.dic.length > 100000, 'fa: Hunspell list handed over'); return; }
        if (!nearMiss) { await fullPackChecks(code, r, f, rules); return; }
        // near-miss spelling: a made-up one-letter typo of a common word is flagged; 30 listed words are not
        const lex = await app.lang.lexicon(code); A(lex && lex.rows.length === r.words, code + ' word list loaded');
        A(await app.writing.nearMiss.ensure(code), code + ': near-miss word list ready');
        const nm = app.writing.nearMiss.index(code); A(nm, code + ': near-miss index');
        const wi = lex.fields.indexOf('word'), fi = lex.fields.indexOf('freq'), pi = lex.fields.indexOf('pos');
        const rows = lex.rows.filter(x => LETTERS.test(x[wi]));
        // the typo must be a plain spelling slip, not something one of the pack's own rules already reports
        const ruleFree = t => !R.checkCustom(R.blocks(R.prose(t))[0], rules).length;
        let typo = null, base = null;
        const swaps = ['ق', 'ف', 'ط', 'ظ', 'ض', 'ث', 'ص', 'غ'];
        for (const row of rows.filter(x => x[fi] === 5 && x[wi].length >= 4)) {
          const w = R.nmNormalize(row[wi]);
          for (let i = 1; i < w.length - 1 && !typo; i++) for (const c of swaps) {
            if (c === w[i]) continue;
            const t = w.slice(0, i) + c + w.slice(i + 1);
            if (!R.nmKnown(nm, t) && R.nmNeighbors(nm, t, 5).includes(w) && ruleFree(t)) { typo = t; base = w; break; }
          }
          if (typo) break;
        }
        A(typo, code + ': a typo of a common word was made');
        const hit = app.writing.nearMiss.check(typo, code);
        A(hit && hit.suggestions.map(R.nmNormalize).includes(base), code + ': ' + typo + ' flagged with ' + base + ': ' + JSON.stringify(hit));
        const long = rows.filter(x => R.nmNormalize(x[wi]).length >= 3); const step = Math.max(1, Math.floor(long.length / 30));
        const known = []; for (let i = 0; i < long.length && known.length < 30; i += step) known.push(long[i][wi]);
        if (code === 'ar') {
          // words with clitics: و or بال in front, ها or هم after (nouns and adjectives that do not end in a vowel letter)
          const nouns = rows.filter(x => /^(noun|adj)/.test(String(x[pi])) && !/^ال/.test(x[wi]) && !/[ةاىءي]$/.test(x[wi]) && x[wi].length >= 3);
          const st = Math.max(1, Math.floor(nouns.length / 10));
          for (let i = 0, k = 0; i < nouns.length && k < 10; i += st, k++) known.splice(k * 3, 1, ['و', 'بال', ''][k % 3] + nouns[i][wi] + (k % 3 === 2 ? ['ها', 'هم'][k % 2] : ''));
        }
        A(known.length === 30, code + ': 30 sample words');
        const flagged = known.filter(w => app.writing.nearMiss.check(w, code));
        A(!flagged.length, code + ': listed words flagged: ' + flagged.join(' '));
        const doc = known.join(' ') + ' ' + typo + '\n';
        const all = await app.writing.checkText(doc, { lang: code, harper: false }); const sp = all.filter(x => x.rule === 'spelling');
        A(sp.length === 1 && R.nmNormalize(sp[0].text) === typo, code + ': in a document only the typo ' + typo + ' is flagged: ' + JSON.stringify(all.map(x => [x.rule, x.text])));
      } finally { await removePack(code); }
      A(!(await listed(code)), code + ' removed');
    }
  });
  app.tests.register('lang: Punjabi (Shahmukhi) reads right to left in the Nastaliq font', async () => {
    A(isRtlLang('pnb') && nameOf('pnb') === 'Punjabi (Shahmukhi)' && info('pnb').font === 'Noto Nastaliq Urdu', 'pnb is known');
    A(scriptOf('پنجابی وچ لکھو', 'pnb') === 'ur', 'Shahmukhi uses the Urdu (Nastaliq) script font');
    A(docDir({ text: '---\nlang: pnb\n---\n\nx' }) === 'rtl', 'a Punjabi document reads right to left');
    const { host, page } = await renderInto('---\nlang: pnb\n---\n\nمیں پنجابی وچ لکھدا ہاں۔\n');
    try {
      const p = page.querySelector('p'); A(p && p.dataset.mkScript === 'ur' && getComputedStyle(p).direction === 'rtl', 'paragraph rtl and marked ur');
      A(/Noto Nastaliq Urdu/.test(getComputedStyle(p).fontFamily), 'Nastaliq: ' + getComputedStyle(p).fontFamily);
    } finally { host.remove(); }
  });
  app.tests.register('lang: Options shows the Language section and the status bar picker names RTL languages', async () => {
    A(app.options.sections().some(s => s.id === 'language'), 'section');
    const el = document.createElement('div'); renderOptions(el);
    A(/English \(US\)/.test(el.textContent) && /Install from file/.test(el.textContent) && el.querySelectorAll('select').length >= 4, 'controls');
    A(el.querySelectorAll('[data-tip]').length >= 5, 'ScreenTips on controls');
    A(nameOf('fa') === 'Persian' && nameOf('ur') === 'Urdu', 'names');
  });
  app.tests.register('lang: screenshot of Urdu, Arabic, Persian and English (rtl.png)', async () => {
    const m0 = app.mode; const prev = app.docs.active();
    const d = app.docs.create({ text: `---\ntitle: زبانیں — Languages\n---\n\n${SAMPLE}\n1. ایک\n2. دو\n\n| نام | Name | عمر |\n| --- | --- | --- |\n| علی | Ali | 30 |\n`, title: 'Languages' });
    try {
      app.setMode('word'); await sleep(60); await app.editors.active()?.refresh?.();
      await until(() => document.querySelector('.mk-page p[data-mk-script="ur"]'));
      try { app.shell?.selectTab?.('home'); } catch {}
      await document.fonts.ready; await sleep(500);
      try { await invoke('smoke-shot', 'rtl'); } catch {}
      app.setMode('simple'); await sleep(700);
      try { await invoke('smoke-shot', 'rtl-simple'); } catch {}
      const pv = document.querySelector('.mk-preview-page p[data-mk-script="ur"]');
      A(pv && getComputedStyle(pv).direction === 'rtl', 'Simple mode preview: Urdu reads right to left');
      const ta = document.querySelector('.mk-src-ta'); A(ta && getComputedStyle(ta).unicodeBidi === 'plaintext', 'Simple mode source: each line takes its own direction');
      for (const m of ['inline', 'read']) {
        app.setMode(m); await sleep(80);
        A(await until(() => { const p = [...document.querySelectorAll(m === 'inline' ? '.mk-il-page p[data-mk-script="ur"]' : '.mk-read-page p[data-mk-script="ur"]')].find(x => x.getClientRects().length); return p && getComputedStyle(p).direction === 'rtl'; }), m + ' mode: Urdu reads right to left');
      }
      try { await invoke('smoke-shot', 'rtl-read'); } catch {}
      openOptions(); await sleep(900);
      A(document.querySelector('.opt-card[data-section="language"] select'), 'Options → Language is drawn');
      try { await invoke('smoke-shot', 'options-language'); } catch {}
      app.backstage.close(); await sleep(200);
    } finally { await app.docs.close(d.id, { force: true }); if (prev && app.docs.get(prev.id)) app.docs.activate(prev.id); app.setMode(m0); }
  });
})();
