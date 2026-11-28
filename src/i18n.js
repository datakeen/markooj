// Markooj — interface translations in the window (PLAN-v5 item 81). Contract: docs/I18N.md and ARCHITECTURE.md
// "Interface translations (1.2.0)".
//
// Loads in <head> right after i18n-core.js and before every other script: the catalogs come from main synchronously
// (mk.i18n.boot()), so <html lang dir> and the first paint are already in the right language. core.js then calls
// window.mkI18n.attach(app), which adds:
//   app.t(text, vars)           translated text ("Save as…", {name}) — plain text, never HTML-escaped
//   app.tn(text, count, vars)   plural text; same as app.t(text, {...vars, count})
//   app.th(text, vars)          like app.t, but the vars are HTML-escaped (for innerHTML templates)
//   app.tm(text)                marks English text for extraction and returns it unchanged (data tables; translate when drawing)
//   app.i18n                    language(), setting(), setLanguage(code), languages(), info(code), nativeName(code), dir(), isRtl(),
//                               onChange(fn), apply(el), number(), date(), time(), dateTime(), list(), compare(), picker(), openMenu(),
//                               renderOptions(el), scanUntranslated(), pseudo(), has(key), missing()
// Static HTML: data-i18n="English text" (textContent), data-i18n-html (trusted catalog HTML), data-i18n-title, -aria-label,
// -placeholder, -alt, -tip, -tip-d, -label; data-i18n-vars='{"n":3}'. app.i18n.apply(el) fills them; it runs on start and on
// every language change.
// Switching is live: documents are never touched. 'i18n:changed' {language, prev, dir} fires, then the ribbon, document tabs,
// status bar, data-i18n nodes and an open File page are drawn again; modules that keep other DOM open redraw on that event.
/* i18n-aliases: t, tn, th, tm */
(function () {
  'use strict';
  const C = window.mkI18nCore;
  const mk = window.mk || {};
  const bootAt = performance.now();
  let boot = null;
  try { boot = mk.i18n && typeof mk.i18n.boot === 'function' ? mk.i18n.boot() : null; } catch (e) { console.warn('[i18n] boot', e); }
  if (boot && boot.error) { console.warn('[i18n] boot:', boot.error); boot = null; }
  const bootSync = !!boot && typeof boot.then !== 'function';
  const EN_INFO = { code: 'en', name: 'English', native: 'English', dir: 'ltr', intl: 'en-US', plural: 'en', font: 'system', completeness: 100 };
  let LANGS = (boot && Array.isArray(boot.languages) && boot.languages.length) ? boot.languages : [EN_INFO];
  const toMap = obj => { const m = new Map(); if (obj) for (const k of Object.keys(obj)) if (k[0] !== '@') m.set(k, obj[k]); return m; };
  let enMap = toMap(boot && boot.en);
  const state = { code: 'en', setting: (boot && boot.setting) || '', source: (boot && boot.source) || 'default', info: EN_INFO, tr: null,
    bootAt, bootSync, booted: !!boot, bootLanguage: (boot && boot.language) || 'en', attachedAt: null, langAtAttach: null, switches: 0, system: (boot && boot.system) || [] };
  const listeners = new Set();
  const fmtCache = new Map(); // Intl formatters for the current language
  let app = null;

  const infoOf = code => LANGS.find(l => l.code === code) || null;
  function install(code, entries) {
    const L = infoOf(code) || EN_INFO;
    state.code = L.code; state.info = L;
    state.tr = C.createTranslator({ code: L.code, entries, en: enMap, plural: L.plural, intl: L.intl });
    fmtCache.clear();
    applyRoot();
  }
  /** <html lang dir> and the hook classes: mk-ui-rtl, mk-ui-lang-<code>, mk-ui-font-<font hint>. */
  function applyRoot() {
    const de = document.documentElement; if (!de) return;
    const L = state.info;
    de.setAttribute('lang', L.code === C.PSEUDO ? 'en' : L.code);
    de.setAttribute('dir', L.dir === 'rtl' ? 'rtl' : 'ltr');
    de.dataset.uiLang = L.code;
    for (const c of [...de.classList]) if (/^mk-ui-(rtl|lang-|font-)/.test(c)) de.classList.remove(c);
    de.classList.toggle('mk-ui-rtl', L.dir === 'rtl');
    de.classList.add('mk-ui-lang-' + L.code.toLowerCase().replace(/[^a-z0-9-]/g, ''), 'mk-ui-font-' + String(L.font || 'system').replace(/[^a-z0-9-]/gi, ''));
  }
  install((boot && boot.language) || 'en', boot && boot.entries);

  // ---------- the API ----------
  const t = (text, vars) => state.tr.t(text, vars);
  const tn = (text, count, vars) => state.tr.tn(text, count, vars);
  const th = (text, vars) => state.tr.th(text, vars);
  const tm = text => text;

  const intlLocale = () => state.info.intl || (state.code === C.PSEUDO ? 'en-US' : state.code);
  function fmt(kind, opts) {
    const k = kind + '|' + JSON.stringify(opts || {});
    if (!fmtCache.has(k)) {
      const loc = intlLocale();
      let f;
      try { f = kind === 'n' ? new Intl.NumberFormat(loc, opts) : kind === 'd' ? new Intl.DateTimeFormat(loc, opts) : kind === 'l' ? new Intl.ListFormat(loc, opts) : kind === 'c' ? new Intl.Collator(loc, opts) : new Intl.RelativeTimeFormat(loc, opts); }
      catch { f = kind === 'n' ? new Intl.NumberFormat('en-US', opts) : kind === 'd' ? new Intl.DateTimeFormat('en-US', opts) : kind === 'l' ? new Intl.ListFormat('en-US', opts) : kind === 'c' ? new Intl.Collator('en-US', opts) : new Intl.RelativeTimeFormat('en-US', opts); }
      fmtCache.set(k, f);
    }
    return fmtCache.get(k);
  }
  const toDate = d => (d instanceof Date ? d : new Date(d == null ? Date.now() : d));

  /** Languages for pickers. The test language (qps) only with {all:true} or the setting i18n.showPseudo. */
  function languages(o = {}) {
    const showPseudo = o.all || (app && app.settings.get('i18n.showPseudo', false) === true) || state.code === C.PSEUDO;
    return LANGS.filter(l => !l.developer || showPseudo).map(l => ({ ...l }));
  }
  const nativeName = code => { const L = infoOf(code); return L ? L.native || L.name : String(code || ''); };
  // the English names in languages.json (and main-i18n's test language), translated where they are shown next to the native name
  const LANGUAGE_NAMES = [tm('English'), tm('Chinese (Simplified)'), tm('Urdu'), tm('Roman Urdu'), tm('Punjabi (Shahmukhi)'), tm('Japanese'), tm('Arabic'),
    tm('Swedish'), tm('Spanish'), tm('French'), tm('Portuguese (Brazil)'), tm('Pseudo (testing)')];
  void LANGUAGE_NAMES;

  /** Fill data-i18n* attributes inside el (and on el itself). */
  const ATTRS = [['data-i18n-title', 'title'], ['data-i18n-aria-label', 'aria-label'], ['data-i18n-placeholder', 'placeholder'], ['data-i18n-alt', 'alt'], ['data-i18n-tip', 'data-tip'], ['data-i18n-tip-d', 'data-tip-d'], ['data-i18n-label', 'label']];
  const ATTR_SEL = '[data-i18n],[data-i18n-html],' + ATTRS.map(a => `[${a[0]}]`).join(',');
  function apply(root) {
    const el0 = root || document.body; if (!el0) return 0;
    const list = [...(el0.matches && el0.matches(ATTR_SEL) ? [el0] : []), ...el0.querySelectorAll(ATTR_SEL)];
    for (const el of list) {
      let vars;
      if (el.hasAttribute('data-i18n-vars')) { try { vars = JSON.parse(el.getAttribute('data-i18n-vars')); } catch {} }
      if (el.hasAttribute('data-i18n')) el.textContent = t(el.getAttribute('data-i18n'), vars);
      else if (el.hasAttribute('data-i18n-html')) el.innerHTML = th(el.getAttribute('data-i18n-html'), vars);
      for (const [from, to] of ATTRS) if (el.hasAttribute(from)) el.setAttribute(to, t(el.getAttribute(from), vars));
    }
    return list.length;
  }

  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  /** Load a language's catalogs (synchronously from main) and draw the interface in it. '' = match the system. */
  async function setLanguage(code, o = {}) {
    const want = code == null ? '' : String(code).trim();
    if (want && !infoOf(want)) {
      app?.ui.toast(t('Choose a language from the list. “{code}” is not one of them, so the interface stays in {language}.', { code: want, language: nativeName(state.code) }), { kind: 'warn', actions: [{ label: t('Show languages'), run: () => openMenu() }] });
      return false;
    }
    const prev = state.code, prevSetting = state.setting;
    let language = o.language || want || 'en';
    if (!o.fromMain) {
      try { const r = await mk.invoke('i18n-set', want); if (r && r.language) language = r.language; } catch (e) { console.warn('[i18n] set', e); }
      if (app && app.settings.get('uiLanguage', '') !== want) app.settings.set('uiLanguage', want);
    }
    state.setting = want;
    let p = null;
    try { p = mk.i18n && mk.i18n.catalog ? mk.i18n.catalog(language) : null; } catch (e) { console.warn('[i18n] catalog', e); }
    if (p && p.error) p = null;
    if (p && p.en) enMap = toMap(p.en);
    install(p ? p.language : language, p && p.entries);
    state.switches++;
    if (state.code === prev && !o.force) return true;
    const payload = { language: state.code, prev, dir: state.info.dir, rtl: state.info.dir === 'rtl' };
    for (const fn of [...listeners]) { try { fn(payload); } catch (e) { console.error('[i18n] onChange', e); } }
    app?.events.emit('i18n:changed', payload);
    refreshInterface();
    if (!o.quiet && app) {
      app.ui.toast(t('Menus, buttons and messages are now in {language}. Your documents keep their own language.', { language: nativeName(state.code) }),
        { kind: 'info', actions: [{ label: t('Undo'), run: () => setLanguage(prevSetting) }] });
    }
    return true;
  }

  /** Draw the shell again in the new language. Documents and their editors are not touched. */
  function refreshInterface() {
    const S = app && app.shell;
    try { apply(document.body); } catch (e) { console.warn('[i18n] apply', e); }
    try { S?.closePalette?.(); } catch {}
    try { S?.renderRibbon?.(); } catch (e) { console.warn('[i18n] ribbon', e); }
    try { S?.renderTabs?.(); } catch {}
    try { app?.events.emit('status:changed'); S?.updateStatus?.(); } catch {}
    try {
      const page = document.querySelector('#backstage.show .bs-page[data-page]');
      if (page && app) {
        const id = page.dataset.page;
        app.backstage.open(id);
        if (id === 'options') setTimeout(() => document.querySelector('.opt-lead[data-lead="ui-language"]')?.scrollIntoView({ block: 'center' }), 60);
      }
    } catch (e) { console.warn('[i18n] backstage', e); }
  }

  // ---------- pickers: status-bar chip, menu, Options row, Welcome step ----------
  const ICON = '<svg class="i" aria-hidden="true"><use href="#mk-ui-lang"/></svg>';
  const esc = s => C.escHtml(s);
  const nativeHtml = L => `<span class="mk-i18n-native" lang="${esc(L.code === C.PSEUDO ? 'en' : L.code)}" dir="${L.dir === 'rtl' ? 'rtl' : 'ltr'}">${esc(L.native || L.name)}</span>`;
  const progressText = L => (L.code === 'en' || L.developer || (L.completeness ?? 0) >= 100 ? '' : t('{percent}% translated', { percent: Math.max(0, Math.round(L.completeness || 0)) }));
  function menuItems() {
    const items = [{ header: t('Interface language') }];
    for (const L of languages()) {
      const sub = [L.native !== L.name ? t(L.name) : '', progressText(L)].filter(Boolean).join(' · ');
      items.push({ label: L.native || L.name, preview: `${nativeHtml(L)}${sub ? ` <small class="mk-i18n-sub">${esc(sub)}</small>` : ''}`, checked: L.code === state.code, run: () => setLanguage(L.code) });
    }
    items.push({ sep: true },
      { label: t('Match the system language'), checked: !state.setting, run: () => setLanguage('') },
      { label: t('Language options…'), checked: false, run: () => openOptions() },
      { note: t('Menus, buttons and messages change right away. Your documents keep their own language.') });
    return items;
  }
  let chipEl = null;
  function openMenu(anchor) {
    const a = anchor || chipEl || document.querySelector('[data-status-id="ui-language"] button') || { x: innerWidth - 200, y: innerHeight - 40 };
    if (app && app.ui.menu) return app.ui.menu(a, menuItems(), { placement: 'top', checks: true, className: 'mk-i18n-menu' });
    return null;
  }
  function paintChip() {
    if (!chipEl) return;
    const L = state.info;
    chipEl.innerHTML = `${ICON}<span class="mk-i18n-chip-t">${nativeHtml(L)}</span>`;
    chipEl.dataset.tip = t('Interface language: {language}', { language: L.native || L.name });
    chipEl.dataset.tipD = t('The language of menus, buttons and messages. Click to choose another one. Your documents keep their own language.');
    chipEl.setAttribute('aria-label', t('Interface language: {language}. Click to change.', { language: L.native || L.name }));
    chipEl.setAttribute('aria-haspopup', 'menu');
  }
  function openOptions() {
    app.backstage.open('options');
    setTimeout(() => { const s = document.querySelector('.opt-lead[data-lead="ui-language"]'); if (s) { s.scrollIntoView({ block: 'center', behavior: 'smooth' }); app.ui.glow?.(s); s.querySelector('select')?.focus({ preventScroll: true }); } }, 260);
  }
  /** A <select> of all interface languages (native names); picking one switches right away. */
  function picker(o = {}) {
    const sel = document.createElement('select');
    sel.className = 'sel mk-i18n-select';
    sel.setAttribute('aria-label', t('Interface language'));
    sel.dataset.tip = t('Interface language');
    sel.dataset.tipD = t('The language of menus, buttons and messages. Your documents keep their own language.');
    if (o.auto !== false) sel.append(new Option(state.setting ? t('Match the system') : t('Match the system ({language})', { language: nativeName(state.code) }), '', false, !state.setting));
    for (const L of languages()) {
      const label = L.native !== L.name ? `${L.native} — ${t(L.name)}` : L.native;
      const pct = progressText(L);
      sel.append(new Option(pct ? `${label} (${pct})` : label, L.code, false, !!state.setting && L.code === state.code));
    }
    sel.addEventListener('change', () => { setLanguage(sel.value); o.onPick?.(sel.value); });
    return sel;
  }
  /** File → Options → Language, first row: "Interface language". */
  function renderOptions(el) {
    el.classList.add('mk-i18n-opts');
    el.dataset.lead = 'ui-language';
    const row = document.createElement('div'); row.className = 'opt-row';
    const ol = document.createElement('div'); ol.className = 'ol';
    const b = document.createElement('b'); b.textContent = t('Interface language');
    const small = document.createElement('small'); small.textContent = t('Menus, buttons and messages. Switch any time from the status bar or the command search (Alt+Q). Your documents keep their own language.');
    ol.append(b, small);
    const oc = document.createElement('div'); oc.className = 'oc'; oc.append(picker());
    row.append(ol, oc); el.append(row);
    const note = document.createElement('p'); note.className = 'mk-i18n-help';
    const a = document.createElement('a'); a.href = '#'; a.textContent = t('Suggest a better translation');
    a.addEventListener('click', e => { e.preventDefault(); mk.invoke?.('open-external', 'https://tally.so/r/db9jlN?from=i18n-options').catch?.(() => {}); });
    note.append(document.createTextNode(t('Translations are written with care. Spotted a clumsy word?') + ' '), a);
    el.append(note);
  }
  /** The Welcome sheet's first step: a language picker above everything else. */
  function welcomeStep(sheet) {
    const body = sheet && (sheet.querySelector('.mkwel-body') || sheet);
    if (!body) return null;
    body.querySelector('.mk-i18n-wel')?.remove();
    const sec = document.createElement('section');
    sec.className = 'mk-i18n-wel';
    sec.setAttribute('aria-label', t('Interface language'));
    const lab = document.createElement('label');
    const b = document.createElement('b'); b.textContent = t('Choose your language');
    const small = document.createElement('small'); small.textContent = t('Menus, buttons and messages. You can change it later from the status bar.');
    const txt = document.createElement('span'); txt.className = 'mk-i18n-wel-t'; txt.append(b, small);
    lab.append(ICON_EL(), txt, picker());
    sec.append(lab);
    body.prepend(sec);
    return sec;
  }
  function ICON_EL() { const s = document.createElement('span'); s.className = 'mk-i18n-ic'; s.setAttribute('aria-hidden', 'true'); s.innerHTML = ICON; return s; }

  // ---------- coverage scan (pseudo-locale) ----------
  const BRANDS = /\b(?:Markooj|R Markdown|Quarto|MDX|Pandoc|Markdown|CommonMark|GFM|MultiMarkdown|Obsidian|Electron|Chrome|Chromium|Node|KaTeX|MathLive|Mermaid|Pyodide|Python|JavaScript|GitHub|BibTeX|LaTeX|TeX|Word|Excel|LibreOffice|DjVu|DjVuLibre|pdf2djvu|PDF|EPUB|DOCX|ODT|RTF|HTML|CSS|YAML|JSON|CSV|Typst|UTF-8|Harper|WordNet|Unicode|AGPL|GPL|OFL|MIT|URL|APA|IEEE|Chicago|CSL|SVG|PNG|JPEG|Ctrl|Shift|Alt|AltGr|Cmd|Option|Esc|Escape|Enter|Tab|Space|Backspace|Delete|Home|End|PgUp|PgDn|Page\s?Up|Page\s?Down|Insert|F\d{1,2}|Charter|Georgia|Cambria|Times New Roman|Palatino|Iowan Old Style|Segoe UI|Calibri|Arial|Vazirmatn|Noto(?: Naskh Arabic| Nastaliq Urdu)?)\b/g;
  const SKIP = 'script,style,svg,template,noscript,textarea,code,pre,kbd,.mk-page,.mk-src,.mk-src-inner,.katex,.mk-math,[contenteditable="true"],[data-i18n-skip],[translate="no"],.mk-i18n-native,#tooltip:not(.show)';
  /** Visible interface text that did not go through app.t (run while the pseudo-locale 'qps' is on). */
  function scanUntranslated(root, o = {}) {
    const top = root || document.body;
    const user = new Set();
    try {
      for (const d of app.docs.list()) { user.add(String(d.title || '')); for (const m of String(d.text || '').matchAll(/^#{1,6}[ \t]+(.+?)[ \t#]*$/gm)) user.add(m[1].trim()); if (d.path) { user.add(d.path); user.add(d.path.split(/[\\/]/).pop()); } }
      for (const p of app.settings.get('recent', []) || []) { user.add(p); user.add(String(p).split(/[\\/]/).pop()); }
      for (const L of LANGS) { user.add(L.native); }
      for (const x of o.userData || []) user.add(String(x));
    } catch {}
    const allowed = s => {
      if (!/[A-Za-z]/.test(s)) return true;
      if (C.looksPseudo(s)) return true;
      if (user.has(s)) return true;
      if (/^[^\s]+\.[A-Za-z0-9]{1,6}$/.test(s)) return true; // a file name
      if (/^[A-Za-z]{1,2}\d?$/.test(s)) return true; // B, I, U, Aa, H1
      if (/^[A-Z][A-Z0-9]{1,4}$/.test(s)) return true; // format badges: TXT, DOCX, IPYNB
      if (/^(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)+(?:\/\S*)?$/.test(s)) return true; // a web address
      if (/^[A-Za-z][²³¹⁰-₟]+$/.test(s)) return true; // x², x₂
      if (/^[a-z]{1,4}:[\w:.-]*$/.test(s)) return true; // cross-reference labels: eq:, sec:intro, tbl:results
      if (/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})+$/.test(s)) return true; // language tags: en-US, ur-Latn
      const rest = s.replace(BRANDS, ' ').replace(/\b[A-Za-z]\b/g, ' ').replace(/[\d\s\p{P}\p{S}]+/gu, '');
      return !/[A-Za-z]/.test(rest);
    };
    const visible = el => { try { return el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : !!el.getClientRects().length; } catch { return false; } };
    const where = el => { const parts = []; for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) parts.unshift(e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.classList[0] ? '.' + e.classList[0] : '')); return parts.join(' > '); };
    const seen = new Map();
    const add = (text, kind, el) => { const k = kind + '\u0001' + text; if (seen.has(k)) { seen.get(k).n++; return; } seen.set(k, { text, kind, where: where(el), n: 1 }); };
    const walker = document.createTreeWalker(top, NodeFilter.SHOW_TEXT);
    const okEl = new Map();
    const usable = el => { if (okEl.has(el)) return okEl.get(el); const v = !!el && !el.closest(SKIP) && visible(el); okEl.set(el, v); return v; };
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const s = n.data.replace(/\s+/g, ' ').trim();
      if (!s || !usable(n.parentElement)) continue;
      if (!allowed(s)) add(s, 'text', n.parentElement);
    }
    if (o.attributes !== false) {
      for (const el of top.querySelectorAll('[title],[aria-label],[placeholder],[data-tip],[data-tip-d]')) {
        if (!usable(el)) continue;
        for (const a of ['title', 'aria-label', 'placeholder', 'data-tip', 'data-tip-d']) {
          const v = (el.getAttribute(a) || '').replace(/\s+/g, ' ').trim();
          if (v && !allowed(v)) add(v, 'attr:' + a, el);
        }
      }
    }
    return [...seen.values()];
  }

  // ---------- wiring into the app (called by core.js) ----------
  function attach(a) {
    app = a;
    state.attachedAt = performance.now();
    state.langAtAttach = document.documentElement.getAttribute('lang');
    Object.assign(app, { t, tn, th, tm });
    app.i18n = api;
    try { apply(document.body); } catch (e) { console.warn('[i18n] apply', e); }

    app.commands.register('i18n.pick', { label: app.tm('Change interface language'), icon: 'mk-ui-lang',
      description: app.tm('Choose the language of menus, buttons and messages. Your documents keep their own language.'),
      run: (args = {}) => (args && args.value != null ? setLanguage(args.value) : openMenu(args && args.anchor)) });
    app.commands.register('i18n.set', { label: app.tm('Set interface language'), description: app.tm('Set the interface language by its code, for example ur or pt-BR. An empty code follows the system.'),
      hidden: true, palette: false, run: (args = {}) => setLanguage(typeof args === 'string' ? args : args.value) });
    app.commands.register('i18n.togglePseudo', { label: app.tm('Show the test language in the language list'), icon: 'mk-ui-lang',
      description: app.tm('For developers and translators: adds the pseudo-language that shows which text is not translated yet.'),
      isActive: () => app.settings.get('i18n.showPseudo', false) === true,
      run: () => { const on = app.settings.get('i18n.showPseudo', false) !== true; app.settings.set('i18n.showPseudo', on); app.ui.toast(on ? t('The test language is in the interface language list.') : t('The test language is hidden again.')); } });

    app.status.addItem({ id: 'ui-language', side: 'right', order: 3, render(el) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sb mk-i18n-chip hide-narrow';
      b.addEventListener('mousedown', e => e.preventDefault()); // keep the cursor in the document
      b.addEventListener('click', e => { e.stopPropagation(); openMenu(b); });
      el.append(b); chipEl = b; paintChip();
    } });
    onChange(() => paintChip());
    app.options.addLead?.('language', { id: 'ui-language', order: 0, render: renderOptions });
    app.events.on('welcome:opened', p => { if (!p || p.mode === 'welcome') { const s = document.querySelector('.mkwel-sheet'); if (s) welcomeStep(s); } });
    // a switch in another Markooj window
    try { mk.on?.('i18n-changed', p => { if (p && p.language && p.language !== state.code) setLanguage(p.setting || '', { fromMain: true, language: p.language, quiet: true }); }); } catch {}
  }

  const api = {
    language: () => state.code,
    setting: () => state.setting,
    source: () => state.source,
    setLanguage, languages, info: code => ({ ...(infoOf(code || state.code) || EN_INFO) }), nativeName,
    dir: () => (state.info.dir === 'rtl' ? 'rtl' : 'ltr'), isRtl: () => state.info.dir === 'rtl',
    locale: intlLocale, onChange, apply,
    number: (n, opts) => fmt('n', opts).format(n),
    percent: (n, opts) => fmt('n', { style: 'percent', ...opts }).format(n),
    date: (d, opts) => fmt('d', opts || { dateStyle: 'medium' }).format(toDate(d)),
    time: (d, opts) => fmt('d', opts || { timeStyle: 'short' }).format(toDate(d)),
    dateTime: (d, opts) => fmt('d', opts || { dateStyle: 'medium', timeStyle: 'short' }).format(toDate(d)),
    list: (items, opts) => fmt('l', opts || { type: 'conjunction' }).format((items || []).map(String)),
    compare: (a, b) => fmt('c', { sensitivity: 'base', numeric: true }).compare(String(a), String(b)),
    relative: (value, unit, opts) => fmt('r', opts || { numeric: 'auto' }).format(value, unit),
    plural: n => C.pluralCategory(state.info.plural || state.code, n),
    has: key => state.tr.has(key), missing: () => state.tr.missing(), pseudo: C.pseudo, core: C,
    picker, menuItems, openMenu, openOptions, renderOptions, welcomeStep, refresh: refreshInterface, scanUntranslated,
    scanThreshold: 0, // the coverage test fails when any visible interface text skips app.t (data is marked translate="no")
    state,
  };
  window.mkI18n = { t, tn, th, tm, attach, api, state, core: C };
})();
