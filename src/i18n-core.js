// Markooj — interface translations: the pure engine shared by the window (src/i18n.js), the main process
// (main-i18n.js) and scripts/i18n-check.js. No DOM, no Node APIs. See docs/I18N.md for the contract.
//
// Keys are the exact US English source text ("Save as…"). An ambiguous word carries a context marker at the end:
// "Open@@verb", "Insert@@ribbon tab" (two @ signs, then lower-case words). English shows the text without the marker.
// Values: a string, or for text with a count an object of plural categories {zero, one, two, few, many, other}
// (Intl.PluralRules of the language). Placeholders are {name}; {count} is the plural number.
(function (root) {
  'use strict';

  const CTX_RE = /@@([a-z][a-z0-9 _-]{0,47})$/;
  const PH_RE = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
  const TAG_RE = /<\/?([A-Za-z][A-Za-z0-9-]*)\b[^>]*>/g;
  const CATS = ['zero', 'one', 'two', 'few', 'many', 'other'];
  const PSEUDO = 'qps';

  /** "Open@@verb" → {text: 'Open', context: 'verb'}; keys without a marker have context ''. */
  function parseKey(key) {
    const s = String(key == null ? '' : key);
    const m = CTX_RE.exec(s);
    return m ? { text: s.slice(0, m.index), context: m[1] } : { text: s, context: '' };
  }
  const stripContext = key => parseKey(key).text;
  const isPlural = v => !!v && typeof v === 'object' && !Array.isArray(v);

  /** Sorted, unique placeholder names in a string ({name} only; "{#eq:x}" and "{ }" are not placeholders). */
  function placeholders(str) {
    const out = new Set(); let m; PH_RE.lastIndex = 0;
    while ((m = PH_RE.exec(String(str || '')))) out.add(m[1]);
    return [...out].sort();
  }
  /** Tag names in a string, in order ("<b>x</b>" → ['b', '/b']). */
  function tags(str) {
    const out = []; let m; TAG_RE.lastIndex = 0;
    const s = String(str || '');
    while ((m = TAG_RE.exec(s))) out.push((m[0][1] === '/' ? '/' : '') + m[1].toLowerCase());
    return out;
  }

  // ---------- plural rules ----------
  const ruleCache = new Map();
  function pluralRules(locale) {
    const k = String(locale || 'en');
    if (!ruleCache.has(k)) { let r; try { r = new Intl.PluralRules(k); } catch { r = new Intl.PluralRules('en'); } ruleCache.set(k, r); }
    return ruleCache.get(k);
  }
  const pluralCategory = (locale, n) => pluralRules(locale).select(Number(n));
  const pluralCategories = locale => pluralRules(locale).resolvedOptions().pluralCategories.slice().sort((a, b) => CATS.indexOf(a) - CATS.indexOf(b));
  /** The form for n from a plural object: its category, else 'other', else any form. */
  function pickPlural(obj, locale, n) {
    if (!isPlural(obj)) return obj;
    const has = c => typeof obj[c] === 'string' && obj[c] !== '';
    if (n != null && !Number.isNaN(Number(n))) {
      // CLDR "explicit 0 / 1" is not used; 'zero' is a real category only in languages that have it (ar)
      const c = pluralCategory(locale, n);
      if (has(c)) return obj[c];
    }
    if (has('other')) return obj.other;
    for (const c of CATS) if (has(c)) return obj[c];
    return '';
  }

  // ---------- pseudo-locale (qps) ----------
  const ACC = { a: 'å', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'î', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ', n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'û', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
    A: 'Å', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Î', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ', N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Û', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž' };
  // placeholders, HTML tags and entities stay as they are
  const KEEP_RE = /(\{[A-Za-z_][A-Za-z0-9_]*\}|<[^>]+>|&[#\w]+;)/;
  const pseudoCache = new Map();
  /** "Save as…" → "[Šåṽé åš… ~~~]": accented, about 35% longer, in brackets (layout and coverage testing). */
  function pseudo(str) {
    const s = String(str == null ? '' : str);
    if (!s) return s;
    if (pseudoCache.has(s)) return pseudoCache.get(s);
    let letters = 0;
    const body = s.split(KEEP_RE).map((part, i) => (i % 2 ? part : part.replace(/[A-Za-z]/g, ch => { letters++; return ACC[ch] || ch; }))).join('');
    const out = `[${body} ${'~'.repeat(Math.max(1, Math.round((letters || s.length) * 0.35)))}]`;
    if (pseudoCache.size > 5000) pseudoCache.clear();
    pseudoCache.set(s, out);
    return out;
  }
  /** Does visible text look pseudo-translated? (accented letters from the map, or the bracket frame) */
  const PSEUDO_CHARS = new RegExp('[' + Object.values(ACC).join('') + ']');
  const looksPseudo = text => { const s = String(text || '').trim(); return PSEUDO_CHARS.test(s) || s.includes('~~') || s[0] === '[' || /~\]$/.test(s); };

  // ---------- interpolation ----------
  const escHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /** Fill {name} from vars. Unknown names stay as written. {count} (a number) gets the language's digit grouping. */
  function interpolate(str, vars, o = {}) {
    const s = String(str == null ? '' : str);
    if (!vars || s.indexOf('{') < 0) return s;
    return s.replace(PH_RE, (m, name) => {
      if (!Object.prototype.hasOwnProperty.call(vars, name)) return m;
      let v = vars[name];
      if (name === 'count' && typeof v === 'number' && o.formatNumber) v = o.formatNumber(v);
      v = v == null ? '' : String(v);
      return o.escape ? escHtml(v) : v;
    });
  }

  // ---------- a translator for one language ----------
  /**
   * createTranslator({code, entries, en, plural, intl}) → {t, tn, th, has, raw, code}
   * entries: {key: string | {category: string}} for the language (merged groups); en: the same for English.
   * Missing or empty → English (the en entry, else the key without its context marker). code 'qps' pseudo-translates
   * every string that goes through t(), found in a catalog or not.
   */
  function createTranslator(o = {}) {
    const code = o.code || 'en';
    const toMap = obj => { const m = new Map(); if (obj) for (const k of Object.keys(obj)) if (k[0] !== '@') m.set(k, obj[k]); return m; };
    const map = o.entries instanceof Map ? o.entries : toMap(code === 'en' || code === PSEUDO ? null : o.entries);
    const en = o.en instanceof Map ? o.en : toMap(o.en);
    const pluralLocale = o.plural || (code === PSEUDO ? 'en' : code);
    const intl = o.intl || (code === PSEUDO ? 'en-US' : code);
    let nf = null;
    const formatNumber = n => { try { nf = nf || new Intl.NumberFormat(intl); return nf.format(n); } catch { return String(n); } };
    const missing = new Set();
    const usable = v => (typeof v === 'string' ? v !== '' : isPlural(v) && Object.values(v).some(x => typeof x === 'string' && x));
    function resolve(key, vars) {
      const count = vars && vars.count != null ? vars.count : null;
      let v = map.get(key), loc = pluralLocale;
      if (!usable(v)) {
        if (code !== 'en' && code !== PSEUDO && missing.size < 5000) missing.add(key);
        v = en.get(key); loc = 'en';
        if (!usable(v)) v = stripContext(key);
      }
      if (isPlural(v)) v = pickPlural(v, loc, count);
      return String(v);
    }
    function t(text, vars) {
      if (text == null) return '';
      const key = String(text);
      let s = resolve(key, vars);
      if (code === PSEUDO) s = pseudo(s);
      return interpolate(s, vars, { formatNumber });
    }
    return {
      code,
      t,
      tn: (text, count, vars) => t(text, Object.assign({}, vars, { count })),
      th: (text, vars) => { const key = String(text == null ? '' : text); let s = resolve(key, vars); if (code === PSEUDO) s = pseudo(s); return interpolate(s, vars, { formatNumber, escape: true }); },
      has: key => usable(map.get(String(key))),
      raw: key => map.get(String(key)),
      missing: () => [...missing],
      formatNumber,
      size: map.size,
    };
  }

  const api = { parseKey, stripContext, isPlural, placeholders, tags, pluralCategory, pluralCategories, pickPlural, pseudo, looksPseudo, interpolate, escHtml, createTranslator, CATS, PSEUDO, CTX_RE };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.mkI18nCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
