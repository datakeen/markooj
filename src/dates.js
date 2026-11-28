// Markooj — Insert → Date & time (PLAN-v5 item 68): a dialog with a calendar, many formats, a custom pattern, the day
// name, Gregorian or Hijri (Umm al-Qura) dates, and month names in English, Urdu, Arabic or the interface language.
// Alt+Shift+D inserts the date and Alt+Shift+T the time in the last format used (Word's keys); /today, /date, /time
// and /hijri do the same while typing (src/typing-aids.js).
// app.dates = {format, text, hijriParts, insert, openDialog, renderOptions, patterns, languages}
/* i18n-aliases: txt, att */
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const E = app.editor = app.editor || {};
  const D = app.dates = app.dates || {};
  try {
    if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(l => /dates\.css/.test(l.getAttribute('href') || ''))) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'dates.css'; document.head.appendChild(l);
    }
  } catch {}
  const get = (k, d) => app.settings.get(k, d);
  const set = (k, v) => app.settings.set(k, v);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ------------------------------------------------------------------ names (written here; month and day names are plain facts)
  const NAMES = {
    en: {
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      // (marked for the catalog: the dialog shows the Hijri date in the interface language; inserted text stays as chosen)
      hijri: [app.tm('Muharram'), app.tm('Safar'), app.tm('Rabi al-Awwal'), app.tm('Rabi al-Thani'), app.tm('Jumada al-Ula'), app.tm('Jumada al-Akhirah'), app.tm('Rajab'), app.tm('Shaban'), app.tm('Ramadan'), app.tm('Shawwal'), app.tm('Dhu al-Qadah'), app.tm('Dhu al-Hijjah')],
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      era: 'AH', am: 'AM', pm: 'PM',
    },
    ur: {
      months: ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'],
      hijri: ['محرم', 'صفر', 'ربیع الاول', 'ربیع الثانی', 'جمادی الاول', 'جمادی الثانی', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذوالقعدہ', 'ذوالحجہ'],
      days: ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'],
      era: 'ھ', am: 'صبح', pm: 'شام', comma: '،',
    },
    ar: {
      months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
      hijri: ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'],
      days: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
      era: 'هـ', am: 'ص', pm: 'م', comma: '،',
    },
  };
  const LANG_LABEL = { en: app.tm('English'), ur: app.tm('Urdu (اردو)'), ar: app.tm('Arabic (العربية)') };
  /** The interface language when Markooj knows it (the translation round adds it), else null. */
  function uiLanguage() {
    try { const l = app.i18n?.language?.() || app.i18n?.lang || get('uiLanguage', null) || document.documentElement.lang; if (l) return String(l).split(/[-_]/)[0].toLowerCase(); } catch {}
    return null;
  }
  /** Languages offered for month and day names: English, Urdu and Arabic always, plus the interface language. */
  D.languages = () => {
    const out = ['en', 'ur', 'ar'];
    const ui = uiLanguage();
    if (ui && !out.includes(ui) && intlNames(ui)) out.push(ui);
    return out.map(code => ({ code, label: LANG_LABEL[code] ? app.t(LANG_LABEL[code]) : intlLabel(code) }));
  };
  // "Spanish (español)": the name in the interface language, then in its own
  const uiLocale = () => { try { return app.i18n?.locale?.() || 'en'; } catch { return 'en'; } };
  function intlLabel(code) { try { const n = new Intl.DisplayNames([uiLocale(), 'en'], { type: 'language' }).of(code); const own = new Intl.DisplayNames([code], { type: 'language' }).of(code); return own && own !== n ? `${n} (${own})` : n || code; } catch { return code; } }
  const intlCache = {};
  /** Gregorian month and day names from the browser for other languages (Chinese, Japanese, Spanish …). */
  function intlNames(code) {
    if (intlCache[code] !== undefined) return intlCache[code];
    let r = null;
    try {
      const fm = new Intl.DateTimeFormat(code, { month: 'long', timeZone: 'UTC' }), fd = new Intl.DateTimeFormat(code, { weekday: 'long', timeZone: 'UTC' });
      if (fm.resolvedOptions().locale.split('-')[0] === code) {
        r = { months: [...Array(12)].map((_, i) => fm.format(new Date(Date.UTC(2021, i, 1)))), days: [...Array(7)].map((_, i) => fd.format(new Date(Date.UTC(2021, 0, 3 + i)))), hijri: NAMES.en.hijri, era: 'AH', am: 'AM', pm: 'PM' };
      }
    } catch { r = null; }
    intlCache[code] = r; return r;
  }
  const names = code => NAMES[code] || intlNames(code) || NAMES.en;

  // ------------------------------------------------------------------ Hijri (Umm al-Qura through Intl, tabular as a fallback)
  let umalqura = null;
  try { const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }); if (f.resolvedOptions().calendar === 'islamic-umalqura') umalqura = f; } catch {}
  function tabularHijri(date) {
    const y0 = date.getFullYear(), m0 = date.getMonth() + 1, d0 = date.getDate();
    const a = Math.floor((14 - m0) / 12), y2 = y0 + 4800 - a, m2 = m0 + 12 * a - 3;
    const jd = d0 + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
    let l = jd - 1948440 + 10632; const n = Math.floor((l - 1) / 10631); l = l - 10631 * n + 354;
    const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
    l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
    const m = Math.floor((24 * l) / 709), d = l - Math.floor((709 * m) / 24), y = 30 * n + j - 30;
    return { y, m, d };
  }
  /** {y, m, d} of the Hijri date for a (local) date, moved by `adjust` days (sighting can differ locally by a day). */
  D.hijriParts = (date, adjust = get('hijriAdjust', 0)) => {
    const dd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + (Number(adjust) || 0), 12);
    if (umalqura) {
      try {
        const p = {}; for (const x of umalqura.formatToParts(dd)) p[x.type] = x.value;
        const y = parseInt(String(p.year || p.relatedYear || '').replace(/\D/g, ''), 10), m = parseInt(p.month, 10), d = parseInt(p.day, 10);
        if (y && m && d) return { y, m, d, source: 'umalqura' };
      } catch {}
    }
    return { ...tabularHijri(dd), source: 'tabular' };
  };

  // ------------------------------------------------------------------ patterns
  // yyyy yy | MMMM MMM MM M | dddd ddd dd d | HH H hh h | mm | ss | a (AM/PM) | 'literal text' — like Word and Excel.
  const TOKEN = /'([^']*)'|yyyy|yy|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|H|hh|h|mm|ss|a|tt/g;
  D.patterns = [
    { id: 'MMMM d, yyyy', label: app.tm('Month day, year'), kind: 'date' },
    { id: 'd MMMM yyyy', label: app.tm('Day month year'), kind: 'date' },
    { id: 'dd/MM/yyyy', label: app.tm('dd/mm/yyyy'), kind: 'date' },
    { id: 'dd/MM/yy', label: app.tm('dd/mm/yy'), kind: 'date' },
    { id: 'MM/dd/yyyy', label: app.tm('mm/dd/yyyy (US)'), kind: 'date' },
    { id: 'yyyy-MM-dd', label: app.tm('yyyy-mm-dd (ISO)'), kind: 'date' },
    { id: 'yyyyMMdd', label: app.tm('yyyymmdd'), kind: 'date' },
    { id: "yyyy-MM-dd'T'HH:mm", label: app.tm('ISO with time'), kind: 'datetime' },
    { id: 'h:mm a', label: app.tm('Time (12-hour)'), kind: 'time' },
    { id: 'HH:mm', label: app.tm('Time (24-hour)'), kind: 'time' },
  ];
  const kindOf = p => { const x = D.patterns.find(q => q.id === p); if (x) return x.kind; const s = String(p).replace(/'[^']*'/g, ''); const dt = /[yMd]/.test(s), tm = /[Hhm]/.test(s.replace(/MM?M?M?/g, '')); return dt && tm ? 'datetime' : tm ? 'time' : 'date'; };
  D.kindOf = kindOf;
  /**
   * Format a date. opts: {calendar: 'gregorian'|'hijri', lang: 'en'|'ur'|'ar'|…, dayName: bool, adjust (Hijri days)}.
   * The day name goes in front ("Friday, 27 November 2026"); Hijri long dates get the era (AH, ھ, هـ).
   */
  D.format = (date, pattern, opts = {}) => {
    date = date instanceof Date ? date : new Date(date);
    const lang = opts.lang || 'en', N = names(lang), hijri = opts.calendar === 'hijri';
    let y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
    if (hijri) ({ y, m, d } = D.hijriParts(date, opts.adjust));
    const H = date.getHours(), min = date.getMinutes(), sec = date.getSeconds(), wd = date.getDay();
    const pad = n => String(n).padStart(2, '0');
    const monthName = i => (hijri ? N.hijri || NAMES.en.hijri : N.months)[i - 1];
    let pat = String(pattern || 'MMMM d, yyyy');
    if (opts.dayName && kindOf(pat) !== 'time' && !/dddd|ddd/.test(pat.replace(/'[^']*'/g, ''))) pat = "dddd'" + (N.comma || ',') + " '" + pat;
    let out = pat.replace(TOKEN, (t, lit) => {
      if (lit !== undefined) return lit;
      switch (t) {
        case 'yyyy': return String(y); case 'yy': return pad(y % 100);
        case 'MMMM': return monthName(m); case 'MMM': { const n = monthName(m); return lang === 'en' && !hijri ? n.slice(0, 3) : n; }
        case 'MM': return pad(m); case 'M': return String(m);
        case 'dddd': return N.days[wd]; case 'ddd': return lang === 'en' ? N.days[wd].slice(0, 3) : N.days[wd];
        case 'dd': return pad(d); case 'd': return String(d);
        case 'HH': return pad(H); case 'H': return String(H);
        case 'hh': return pad(H % 12 || 12); case 'h': return String(H % 12 || 12);
        case 'mm': return pad(min); case 'ss': return pad(sec);
        case 'a': case 'tt': return H < 12 ? N.am : N.pm;
        default: return t;
      }
    });
    if (hijri && /MMMM|MMM/.test(pat) && /yyyy|yy/.test(pat) && !opts.noEra) out += ' ' + (N.era || 'AH');
    return out;
  };

  // ------------------------------------------------------------------ settings and quick text
  const DEF = { dateFormat: 'MMMM d, yyyy', timeFormat: 'h:mm a', hijriFormat: 'd MMMM yyyy' };
  const cur = () => ({
    calendar: get('dateCalendar', 'gregorian') === 'hijri' ? 'hijri' : 'gregorian',
    dateFormat: get('dateFormat', DEF.dateFormat) || DEF.dateFormat, dateLang: get('dateLang', 'en') || 'en',
    hijriFormat: get('hijriFormat', DEF.hijriFormat) || DEF.hijriFormat, hijriLang: get('hijriLang', 'en') || 'en',
    timeFormat: get('timeFormat', DEF.timeFormat) || DEF.timeFormat,
    dayName: get('dateDayName', false) === true, adjust: Number(get('hijriAdjust', 0)) || 0,
  });
  D.current = cur;
  /** The text Alt+Shift+D ('date'), Alt+Shift+T ('time') and /hijri ('hijri') insert, in the last format used. */
  D.text = (what = 'date', date = new Date()) => {
    const c = cur();
    if (what === 'time') return D.format(date, c.timeFormat, { lang: c.dateLang });
    if (what === 'hijri') return D.format(date, c.hijriFormat, { calendar: 'hijri', lang: c.hijriLang, dayName: c.dayName, adjust: c.adjust });
    if (c.calendar === 'hijri') return D.text('hijri', date);
    return D.format(date, c.dateFormat, { lang: c.dateLang, dayName: c.dayName && kindOf(c.dateFormat) !== 'time' });
  };

  // ------------------------------------------------------------------ inserting
  const editableDoc = () => { const d = app.docs.active(); return !!(E.testTarget || (d && d.kind === 'markdown' && !d.readOnly && app.editors.active())); };
  const whyNot = () => { const d = app.docs.active(); return !d ? app.t('Open or create a document first.') : d.kind !== 'markdown' ? app.t('Use Edit as text to make an editable copy. PDF and DjVu files can’t be edited here.') : d.readOnly ? app.t('This document is read-only.') : ''; };
  function readHint() {
    app.ui.toast?.(app.t('Press Esc to go back to editing, then insert the date. Read mode does not change the document.'), { kind: 'info', actions: [{ label: app.t('Back to editing'), run: () => app.shell?.backToEditing?.() }] });
    return false;
  }
  D.insert = async (text) => {
    if (!text) return false;
    if (app.mode === 'read' && !E.testTarget) return readHint();
    if (app.typingAids?.insertPlain) return app.typingAids.insertPlain(text, E.testTarget || null);
    const e = E.target ? E.target() : app.editors.active(); if (!e) return false;
    e.focus?.();
    if (app.mode === 'word') { try { if (document.execCommand('insertText', false, text)) return true; } catch {} }
    await e.insert(text); return true;
  };

  // ------------------------------------------------------------------ the dialog
  // two-letter weekday heads of the calendar, Sunday first (translated when the dialog is drawn)
  const WEEK = [app.tm('Su@@sunday short'), app.tm('Mo@@monday short'), app.tm('Tu@@tuesday short'), app.tm('We@@wednesday short'), app.tm('Th@@thursday short'), app.tm('Fr@@friday short'), app.tm('Sa@@saturday short')];
  // dates in the dialog's own interface (not the inserted text) follow the interface language
  const uiDate = (d, o, fallback) => { try { if (app.i18n?.date) return app.i18n.date(d, o); } catch {} return fallback(); };
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  /**
   * Insert → Date & time. opts.settingsOnly: pick the format for Alt+Shift+D without inserting (File → Options).
   * Resolves to the inserted text, true (settings saved) or null (canceled).
   */
  D.openDialog = async (opts = {}) => {
    if (!opts.settingsOnly && app.mode === 'read' && !E.testTarget) return readHint();
    if (!E.modal) { const t = D.text('date'); return opts.settingsOnly ? null : (await D.insert(t), t); }
    const c = cur();
    const st = {
      date: opts.date ? new Date(opts.date) : new Date(), view: null, calendar: c.calendar,
      pattern: c.calendar === 'hijri' ? c.hijriFormat : c.dateFormat, lang: c.calendar === 'hijri' ? c.hijriLang : c.dateLang,
      custom: get('dateCustom', "dddd, d MMMM yyyy 'at' h:mm a"), dayName: c.dayName, adjust: c.adjust,
    };
    if (!D.patterns.some(p => p.id === st.pattern)) { st.custom = st.pattern; st.pattern = 'custom'; }
    st.view = new Date(st.date.getFullYear(), st.date.getMonth(), 1);
    const body = document.createElement('div'); body.className = 'mk-dt';
    const txt = s => app.th(s), att = s => esc(app.t(s));
    body.innerHTML = `
      <div class="mk-dt-cal" aria-label="${att('Calendar')}">
        <div class="mk-dt-head"><button type="button" class="mk-dt-nav" data-nav="-1" aria-label="${att('Previous month')}" title="${att('Previous month (Page Up)')}">‹</button><b class="mk-dt-month" aria-live="polite"></b><button type="button" class="mk-dt-nav" data-nav="1" aria-label="${att('Next month')}" title="${att('Next month (Page Down)')}">›</button></div>
        <div class="mk-dt-week" aria-hidden="true">${WEEK.map(w => `<span>${esc(app.t(w))}</span>`).join('')}</div>
        <div class="mk-dt-grid" role="grid"></div>
        <div class="mk-dt-foot"><button type="button" class="mk-btn mk-dt-today">${txt('Today')}</button><span class="mk-dt-hj" dir="auto"></span></div>
      </div>
      <div class="mk-dt-side">
        <div class="mk-dt-row"><span class="mk-dt-lbl">${txt('Calendar')}</span><div class="mk-seg mk-dt-calsel" role="radiogroup" aria-label="${att('Calendar')}"><button type="button" data-v="gregorian">${txt('Gregorian')}</button><button type="button" data-v="hijri">${txt('Hijri')}</button></div></div>
        <label class="mk-dt-row"><span class="mk-dt-lbl">${txt('Month names')}</span><select class="mk-dt-lang" aria-label="${att('Language of month and day names')}"></select></label>
        <div class="mk-dt-list" role="radiogroup" aria-label="${att('Format')}"></div>
        <div class="mk-dt-custom"><input type="text" class="mk-dt-pat" spellcheck="false" aria-label="${att('Custom pattern')}"><small>${txt('yyyy year · MM month (MMMM name) · dd day (dddd name) · HH or h hour · mm minutes · a AM/PM · \'text\' as typed')}</small></div>
        <label class="mk-check"><input type="checkbox" class="mk-dt-day"> ${txt('Include the day name')}</label>
        <label class="mk-dt-row mk-dt-adj"><span class="mk-dt-lbl">${txt('Hijri date')}</span><select class="mk-dt-adjust" aria-label="${att('Move the Hijri date')}"><option value="-1">${txt('One day earlier')}</option><option value="0">${txt('As calculated (Umm al-Qura)')}</option><option value="1">${txt('One day later')}</option></select></label>
        <p class="mk-dt-note">${txt('Hijri dates follow the Umm al-Qura calendar. Where the new moon is sighted a day later, as in Pakistan, choose One day earlier in Hijri date above.')}</p>
        <div class="mk-dt-preview" dir="auto" aria-live="polite"></div>
      </div>`;
    const $ = s => body.querySelector(s);
    const grid = $('.mk-dt-grid'), list = $('.mk-dt-list'), langSel = $('.mk-dt-lang'), patIn = $('.mk-dt-pat');
    const optsFor = () => ({ calendar: st.calendar, lang: st.lang, dayName: st.dayName, adjust: st.adjust });
    const patternNow = () => (st.pattern === 'custom' ? (patIn.value || "d MMMM yyyy") : st.pattern);
    const value = () => {
      const p = patternNow(); const k = kindOf(p);
      const dt = new Date(st.date); const now = new Date(); dt.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      return D.format(dt, p, { ...optsFor(), calendar: k === 'time' ? 'gregorian' : st.calendar, dayName: st.dayName && k !== 'time' });
    };
    function drawLang() {
      langSel.innerHTML = '';
      for (const l of D.languages()) { const o = document.createElement('option'); o.value = l.code; o.textContent = l.label; o.selected = l.code === st.lang; langSel.appendChild(o); }
      if (![...langSel.options].some(o => o.selected)) { st.lang = 'en'; langSel.value = 'en'; }
    }
    function drawGrid(focus) {
      const y = st.view.getFullYear(), mo = st.view.getMonth();
      $('.mk-dt-month').textContent = uiDate(new Date(y, mo, 1), { month: 'long', year: 'numeric' }, () => `${NAMES.en.months[mo]} ${y}`);
      grid.innerHTML = '';
      const startOff = new Date(y, mo, 1).getDay();
      const today = new Date();
      for (let i = 0; i < 42; i++) {
        const dt = new Date(y, mo, 1 - startOff + i);
        const b = document.createElement('button'); b.type = 'button'; b.className = 'mk-dt-d';
        b.textContent = String(dt.getDate()); b.dataset.t = String(dt.getTime());
        if (dt.getMonth() !== mo) b.classList.add('out');
        if (sameDay(dt, today)) b.classList.add('today');
        const on = sameDay(dt, st.date); if (on) b.classList.add('on');
        b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
        b.setAttribute('aria-label', uiDate(dt, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }, () => D.format(dt, 'dddd, MMMM d, yyyy')));
        grid.appendChild(b);
      }
      if (focus) grid.querySelector('.mk-dt-d.on')?.focus({ preventScroll: true });
      const hj = D.hijriParts(st.date, st.adjust);
      $('.mk-dt-hj').textContent = st.calendar === 'hijri' ? app.t('{day} {month} {year} AH', { day: hj.d, month: app.t(NAMES.en.hijri[hj.m - 1]), year: hj.y }) : '';
    }
    function drawList() {
      list.innerHTML = '';
      const sample = new Date(st.date); const now = new Date(); sample.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      for (const p of [...D.patterns, { id: 'custom', label: app.tm('Custom pattern'), kind: 'custom' }]) {
        const k = p.kind === 'custom' ? kindOf(patIn.value || 'd') : p.kind;
        const lab = document.createElement('label'); lab.className = 'mk-dt-opt' + (st.pattern === p.id ? ' on' : '');
        const r = document.createElement('input'); r.type = 'radio'; r.name = 'mk-dt-fmt'; r.value = p.id; r.checked = st.pattern === p.id;
        let shown = '';
        try { shown = p.id === 'custom' ? (patIn.value ? D.format(sample, patIn.value, { ...optsFor(), calendar: k === 'time' ? 'gregorian' : st.calendar, dayName: st.dayName && k !== 'time' }) : app.t('Type a pattern below')) : D.format(sample, p.id, { ...optsFor(), calendar: k === 'time' ? 'gregorian' : st.calendar, dayName: st.dayName && k !== 'time' }); } catch { shown = ''; }
        lab.append(r);
        const t = document.createElement('span'); t.className = 'mk-dt-ex'; t.dir = 'auto'; t.textContent = shown;
        const n = document.createElement('small'); n.textContent = app.t(p.label);
        lab.append(t, n);
        r.addEventListener('change', () => { st.pattern = p.id; drawAll(); if (p.id === 'custom') patIn.focus(); });
        list.appendChild(lab);
      }
    }
    function drawAll(focusGrid) {
      body.querySelectorAll('.mk-dt-calsel button').forEach(b => { const on = b.dataset.v === st.calendar; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
      $('.mk-dt-custom').hidden = st.pattern !== 'custom';
      $('.mk-dt-day').checked = st.dayName;
      $('.mk-dt-adjust').value = String(st.adjust);
      $('.mk-dt-adj').hidden = st.calendar !== 'hijri'; $('.mk-dt-note').hidden = st.calendar !== 'hijri';
      drawGrid(focusGrid); drawList();
      $('.mk-dt-preview').textContent = value();
    }
    patIn.value = st.custom;
    drawLang(); drawAll();
    body.querySelectorAll('.mk-dt-calsel button').forEach(b => b.addEventListener('click', () => {
      if (st.calendar === b.dataset.v) return;
      // each calendar keeps its own format and language
      if (b.dataset.v === 'hijri') { st.pattern = /MMMM/.test(st.pattern) ? st.pattern : get('hijriFormat', DEF.hijriFormat); st.lang = get('hijriLang', st.lang); }
      else { st.lang = get('dateLang', 'en'); }
      st.calendar = b.dataset.v; drawLang(); drawAll();
    }));
    langSel.addEventListener('change', () => { st.lang = langSel.value; drawAll(); });
    patIn.addEventListener('input', () => { st.custom = patIn.value; drawList(); $('.mk-dt-preview').textContent = value(); });
    $('.mk-dt-day').addEventListener('change', e => { st.dayName = e.target.checked; drawAll(); });
    $('.mk-dt-adjust').addEventListener('change', e => { st.adjust = Number(e.target.value) || 0; drawAll(); });
    $('.mk-dt-today').addEventListener('click', () => { st.date = new Date(); st.view = new Date(st.date.getFullYear(), st.date.getMonth(), 1); drawAll(true); });
    body.querySelectorAll('.mk-dt-nav').forEach(b => b.addEventListener('click', () => { st.view = new Date(st.view.getFullYear(), st.view.getMonth() + Number(b.dataset.nav), 1); drawGrid(false); }));
    let dbl = null;
    grid.addEventListener('click', e => {
      const b = e.target.closest('.mk-dt-d'); if (!b) return;
      st.date = new Date(+b.dataset.t); if (st.date.getMonth() !== st.view.getMonth()) st.view = new Date(st.date.getFullYear(), st.date.getMonth(), 1);
      drawAll(true);
    });
    grid.addEventListener('dblclick', e => { if (e.target.closest('.mk-dt-d')) dbl?.(); });
    grid.addEventListener('keydown', e => {
      const rtl = getComputedStyle(grid).direction === 'rtl'; // the grid is mirrored there: Left goes to the next day
      const mv = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      let nd = null;
      if (mv) nd = new Date(st.date.getFullYear(), st.date.getMonth(), st.date.getDate() + mv);
      else if (e.key === 'PageUp' || e.key === 'PageDown') nd = new Date(st.date.getFullYear(), st.date.getMonth() + (e.key === 'PageUp' ? -1 : 1), Math.min(st.date.getDate(), 28));
      else if (e.key === 'Home') nd = new Date(st.date.getFullYear(), st.date.getMonth(), 1);
      else if (e.key === 'End') nd = new Date(st.date.getFullYear(), st.date.getMonth() + 1, 0);
      if (!nd) return;
      e.preventDefault(); e.stopPropagation();
      st.date = nd; st.view = new Date(nd.getFullYear(), nd.getMonth(), 1); drawAll(true);
    });
    const save = () => {
      const p = patternNow(); const k = kindOf(p);
      if (st.pattern === 'custom') set('dateCustom', patIn.value);
      if (k === 'time') set('timeFormat', p);
      else if (st.calendar === 'hijri') { set('hijriFormat', p); set('hijriLang', st.lang); set('dateCalendar', 'hijri'); }
      else { set('dateFormat', p); set('dateLang', st.lang); set('dateCalendar', 'gregorian'); }
      set('dateDayName', st.dayName); set('hijriAdjust', st.adjust);
    };
    const out = await E.modal({
      title: opts.settingsOnly ? app.t('Date format for Alt+Shift+D') : app.t('Date and time'), width: 680, body,
      hint: opts.settingsOnly ? app.t('Alt+Shift+D and /today use this format') : app.t('Double-click a day or press Ctrl+Enter to insert'),
      buttons: [{ label: app.t('Cancel'), value: null }, { label: opts.settingsOnly ? app.t('Use this format') : app.t('Insert@@verb'), primary: true, value: () => { save(); return value(); } }],
      onOpen: api => { dbl = () => { save(); api.close(value()); }; setTimeout(() => grid.querySelector('.mk-dt-d.on')?.focus({ preventScroll: true }), 30); },
    });
    if (out == null) return null;
    if (opts.settingsOnly) { app.events.emit('dates:format', cur()); return true; }
    await D.insert(out);
    app.events.emit('dates:format', cur());
    return out;
  };

  // ------------------------------------------------------------------ commands, ribbon, Options
  const reg = (id, def) => app.commands.register(id, { category: 'Insert', isEnabled: () => editableDoc() || app.mode === 'read', why: whyNot, ...def });
  reg('insert.dateTime', {
    label: app.tm('Date & time'), icon: 'mk-clock',
    description: app.tm('Pick a date on a calendar and a format: 27/11/2026, November 27, 2026, 20261127, ISO, a Hijri date, the time, or your own pattern. Alt+Shift+D inserts the date in the last format.'),
    run: (a = {}) => {
      if (a && a.value) { const v = a.value === 'iso' ? D.format(new Date(), 'yyyy-MM-dd') : a.value === 'today' ? D.text('date') : String(a.value); return D.insert(v); }
      return D.openDialog({});
    },
  });
  reg('insert.date', {
    label: app.tm('Insert date'), icon: 'mk-clock', shortcut: 'Alt+Shift+D',
    description: app.tm('Insert today’s date in the format you used last (Insert → Date & time sets it). Typing /today does the same.'),
    run: () => D.insert(D.text('date')),
  });
  reg('insert.time', {
    label: app.tm('Insert time'), icon: 'mk-clock', shortcut: 'Alt+Shift+T',
    description: app.tm('Insert the time now, 12-hour or 24-hour as chosen in Insert → Date & time. Typing /time does the same.'),
    run: () => D.insert(D.text('time')),
  });
  reg('insert.hijriDate', {
    label: app.tm('Insert Hijri date'), icon: 'mk-clock',
    description: app.tm('Insert today’s Hijri (Islamic) date, with month names in English, Urdu or Arabic. Typing /hijri does the same.'),
    run: () => D.insert(D.text('hijri')),
  });
  // the ScreenTip (tooltips.js loads later and has an older one-line text for this button)
  app.events.on('ready', () => { try { app.tooltips?.register?.('insert.dateTime', { title: app.tm('Date and time'), description: app.tm('Pick a date on a calendar and a format, Gregorian or Hijri, with month names in English, Urdu or Arabic. Alt+Shift+D inserts the date and Alt+Shift+T the time in the format you used last.') }); } catch {} });
  /** The Typing card of File → Options shows the current date format with a Change button. */
  D.renderOptions = (box) => {
    const row = document.createElement('div'); row.className = 'opt-row mk-dt-optrow';
    const lab = document.createElement('div'); lab.className = 'ol';
    const b = document.createElement('b'); b.textContent = app.t('Date and time format');
    const sm = document.createElement('small');
    const draw = () => { sm.textContent = app.t('Alt+Shift+D and /today insert “{date}”. Alt+Shift+T and /time insert “{time}”.', { date: D.text('date'), time: D.text('time') }); };
    lab.append(b, sm);
    const oc = document.createElement('div'); oc.className = 'oc';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'mk-btn'; btn.textContent = app.t('Change…');
    btn.addEventListener('click', async () => { await D.openDialog({ settingsOnly: true }); draw(); });
    oc.append(btn); row.append(lab, oc); box.append(row); draw();
  };

  // ------------------------------------------------------------------ smoke tests
  const A = (c, m) => app.assert(c, m);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  app.tests.register('typing: date formats, day names and custom patterns', () => {
    const dt = new Date(2026, 10, 27, 14, 5, 9); // Friday 27 November 2026, 2:05:09 PM
    const f = (p, o) => D.format(dt, p, o);
    A(f('dd/MM/yy') === '27/11/26' && f('dd/MM/yyyy') === '27/11/2026' && f('MM/dd/yyyy') === '11/27/2026', 'numeric');
    A(f('yyyy-MM-dd') === '2026-11-27' && f('yyyyMMdd') === '20261127', 'ISO and compact');
    A(f('d MMMM yyyy') === '27 November 2026' && f('MMMM d, yyyy') === 'November 27, 2026', 'long: ' + f('MMMM d, yyyy'));
    A(f("yyyy-MM-dd'T'HH:mm") === '2026-11-27T14:05', 'ISO with time: ' + f("yyyy-MM-dd'T'HH:mm"));
    A(f('h:mm a') === '2:05 PM' && f('HH:mm') === '14:05' && f('HH:mm:ss') === '14:05:09', 'time');
    A(f('d MMMM yyyy', { dayName: true }) === 'Friday, 27 November 2026', 'day name: ' + f('d MMMM yyyy', { dayName: true }));
    A(f("ddd d MMM 'at' h a") === 'Fri 27 Nov at 2 PM', 'custom: ' + f("ddd d MMM 'at' h a"));
    A(f('d MMMM yyyy', { lang: 'ur' }) === '27 نومبر 2026' && f('dddd', { lang: 'ar' }) === 'الجمعة', 'Urdu and Arabic names');
    A(f('h:mm a', { dayName: true }) === '2:05 PM', 'no day name on a time');
    A(kindOf('HH:mm') === 'time' && kindOf("yyyy-MM-dd'T'HH:mm") === 'datetime' && kindOf('d MMMM yyyy') === 'date' && kindOf('dd/MM/yy hh:mm') === 'datetime', 'kinds');
  });
  app.tests.register('typing: Hijri dates (Umm al-Qura) with English, Urdu and Arabic months', () => {
    // 1 Ramadan 1447 AH is 18 February 2026 in Umm al-Qura; 10 Muharram 1447 is 5 July 2025
    const r = D.hijriParts(new Date(2026, 1, 18), 0);
    A(r.y === 1447 && r.m === 9 && r.d === 1, '1 Ramadan 1447: ' + JSON.stringify(r));
    const a = D.hijriParts(new Date(2025, 6, 5), 0);
    A(a.y === 1447 && a.m === 1 && (a.d === 10 || a.d === 9 || a.d === 11), '10 Muharram 1447 (±1 with the tabular fallback): ' + JSON.stringify(a));
    const later = D.hijriParts(new Date(2026, 1, 18), -1);
    A(later.m === 8 && later.d >= 29, 'one day earlier is the end of Shaban: ' + JSON.stringify(later));
    const dt = new Date(2026, 1, 18);
    A(D.format(dt, 'd MMMM yyyy', { calendar: 'hijri', adjust: 0 }) === '1 Ramadan 1447 AH', D.format(dt, 'd MMMM yyyy', { calendar: 'hijri', adjust: 0 }));
    A(D.format(dt, 'd MMMM yyyy', { calendar: 'hijri', lang: 'ur', adjust: 0 }) === '1 رمضان 1447 ھ', D.format(dt, 'd MMMM yyyy', { calendar: 'hijri', lang: 'ur', adjust: 0 }));
    A(D.format(dt, 'd MMMM yyyy', { calendar: 'hijri', lang: 'ar', adjust: 0 }) === '1 رمضان 1447 هـ', 'Arabic');
    A(D.format(dt, 'dd/MM/yyyy', { calendar: 'hijri', adjust: 0 }) === '01/09/1447', 'numeric Hijri: ' + D.format(dt, 'dd/MM/yyyy', { calendar: 'hijri', adjust: 0 }));
    A(D.languages().some(l => l.code === 'ur') && D.languages().some(l => l.code === 'ar'), 'Urdu and Arabic offered');
  });
  app.tests.register('typing: Alt+Shift+D, Alt+Shift+T and the Date & time dialog', async () => {
    const keep = ['dateFormat', 'dateLang', 'dateCalendar', 'dateDayName', 'timeFormat', 'hijriFormat', 'hijriLang', 'hijriAdjust'].map(k => [k, get(k, undefined)]);
    const doc = app.docs.create({ title: 'Date test', text: 'Due: ' });
    const m0 = app.mode;
    try {
      const sk = id => [].concat(app.commands.get(id)?.shortcut || [], app.commands.get(id)?.shortcuts || []).join(' ');
      A(/Alt\+Shift\+D/.test(sk('insert.date')) && /Alt\+Shift\+T/.test(sk('insert.time')), 'Word keys: ' + sk('insert.date') + ' / ' + sk('insert.time'));
      A(!/Alt\+Shift\+D/.test(sk('insert.dateTime')), 'the dialog button has no key of its own');
      set('dateFormat', 'dd/MM/yyyy'); set('dateCalendar', 'gregorian'); set('dateDayName', false); set('timeFormat', 'HH:mm');
      app.setMode('simple'); await sleep(500);
      const ad = app.editors.active(); ad.setSelection(5, 5);
      await app.commands.run('insert.date');
      A(doc.text === 'Due: ' + D.format(new Date(), 'dd/MM/yyyy'), 'Alt+Shift+D: ' + JSON.stringify(doc.text));
      await app.commands.run('insert.time');
      A(/\d\d:\d\d$/.test(doc.text), 'Alt+Shift+T: ' + JSON.stringify(doc.text));
      // the dialog: pick Hijri with Urdu months and the long format, then insert
      const p = app.commands.run('insert.dateTime');
      let dlg = null; for (let i = 0; i < 50 && !(dlg = document.querySelector('.mk-dt')); i++) await sleep(20);
      A(dlg, 'dialog open');
      A(dlg.querySelectorAll('.mk-dt-d').length === 42 && dlg.querySelector('.mk-dt-d.on.today'), 'calendar shows today');
      dlg.querySelector('.mk-dt-calsel button[data-v="hijri"]').click();
      const ls = dlg.querySelector('.mk-dt-lang'); ls.value = 'ur'; ls.dispatchEvent(new Event('change'));
      const radio = [...dlg.querySelectorAll('.mk-dt-opt input')].find(r => r.value === 'd MMMM yyyy'); radio.checked = true; radio.dispatchEvent(new Event('change'));
      A(/ھ$/.test(dlg.querySelector('.mk-dt-preview').textContent), 'Urdu Hijri preview: ' + dlg.querySelector('.mk-dt-preview').textContent);
      try { await app.mk.invoke('smoke-shot', 'date-time-dialog'); } catch {}
      [...document.querySelectorAll('.mk-modal .mk-btn.primary')].pop().click();
      await p; await sleep(50);
      A(/ھ$/.test(doc.text), 'Hijri date inserted: ' + JSON.stringify(doc.text));
      A(get('dateCalendar') === 'hijri' && get('hijriLang') === 'ur' && get('hijriFormat') === 'd MMMM yyyy', 'the choice is remembered');
      A(/ھ$/.test(D.text('date')), 'Alt+Shift+D now uses it too');
      // Read mode: a hint, nothing changes
      app.setMode('read'); await sleep(300);
      const before = doc.text; await app.commands.run('insert.date');
      A(doc.text === before, 'Read mode changes nothing');
    } finally {
      for (const [k, v] of keep) set(k, v === undefined ? null : v);
      app.setMode(m0); await sleep(300); await app.docs.close(doc.id, { force: true });
    }
  });
})();
