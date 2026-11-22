// Markooj — Help: the Help ribbon tab, File → Help, the offline reference manual viewer (docs/help/*.md drawn with the
// app's own Markdown renderer), Keyboard shortcuts, What's new (CHANGELOG.md), Report a problem, Project page and About Markooj.
// API: app.help = { open(page, {hash, query}), close(), viewer, pages(), load(key), checkLinks(), about(), shortcuts(), whatsNew(),
//   latestChanges(text), reportProblem(), projectPage(), info(), credits, aboutFacts(), shortcutsHtml(rows), tutorials() }
// Commands: help.manual (F1 through the Word key map), help.tutorials, help.shortcuts, help.whatsNew, help.reportProblem,
//   help.projectPage, help.about. Ribbon tab 'help' (after Add-ins), backstage page 'help'.
(function () {
  'use strict';
  const app = window.app, mk = window.mk;
  if (!app || !mk) return;

  const PROJECT = 'https://github.com/datakeen/markooj';
  const NEW_ISSUE = PROJECT + '/issues/new';
  const LINKEDIN = 'https://www.linkedin.com/in/abilal';
  const AUTHOR = 'Ahmed Bilal';
  const COPYRIGHT = 'Copyright © 2026 Ahmed Bilal and contributors';
  const TAGLINE = 'A calm, Word-like Markdown editor and viewer for researchers.';
  const HELP_DIR = 'docs/help/';
  // root files the viewer can open by name (packaged copies carry CHANGELOG.md in the app; the notices and licenses are
  // read from resources/ through app-info, see viewNotices / viewCreditLicense)
  const ROOT_PAGES = ['CHANGELOG.md', 'THIRD_PARTY_NOTICES.md'];
  const APP_ROOT = new URL('../', location.href); // markooj://app/

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = 'i') => `<svg class="${cls}" aria-hidden="true"><use href="#${esc(name)}"/></svg>`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'class') e.className = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  }
  const toast = (m, o) => { try { app.ui.toast(m, o); } catch {} };

  // ---------- icons (symbol ids start with mkh-i-; no element uses these ids) ----------
  const ICONS = {
    'mkh-i-help': '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8M12 17.2v.3"/>',
    'mkh-i-book': '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M8 7.5h8M8 11h6"/>',
    'mkh-i-tour': '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    'mkh-i-new': '<path d="M12 3.5l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z"/>',
    'mkh-i-bug': '<rect x="7" y="7" width="10" height="13" rx="5"/><path d="M12 11v9M7 12H3M21 12h-4M7.5 17.5 4 20M16.5 17.5 20 20M7.5 8.5 5 6M16.5 8.5 19 6M9.5 7a2.5 2.5 0 0 1 5 0"/>',
    'mkh-i-home': '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.5V20h13V9.5M10 20v-5.5h4V20"/>',
    'mkh-i-about': '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.4"/>',
    'mkh-i-back': '<path d="m15 18-6-6 6-6"/>',
    'mkh-i-fwd': '<path d="m9 6 6 6-6 6"/>',
    'mkh-i-print': '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>',
    'mkh-i-x': '<path d="M18 6 6 18M6 6l12 12"/>',
    'mkh-i-search': '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    'mkh-i-ext': '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    'mkh-i-check': '<path d="M20 6 9 17l-5-5"/>',
    'mkh-i-keys': '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    'mkh-i-copy': '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    'mkh-i-tools': '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.3-.3-2.4z"/>',
  };
  (function injectIcons() {
    if (document.getElementById('mkh-icons')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'mkh-icons'); svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    svg.innerHTML = Object.entries(ICONS).map(([id, d]) => `<symbol id="${id}" viewBox="0 0 24 24">${d}</symbol>`).join('');
    document.body.append(svg);
  })();

  // ---------- facts from main (app-info) ----------
  let infoP = null;
  function info() {
    if (!infoP) infoP = mk.invoke('app-info').catch(() => ({}));
    return infoP;
  }
  async function aboutFacts() {
    const i = await info();
    const arch = i.arch === 'x64' || i.arch === 'arm64' ? '64-bit' : i.arch === 'ia32' ? '32-bit' : (i.arch || '');
    return {
      name: i.name || 'Markooj',
      version: i.version || '',
      arch, archRaw: i.arch || '',
      copyright: (i.copyright || COPYRIGHT).replace(/\.\s*$/, '') + '.',
      author: (i.author && typeof i.author === 'object' ? i.author.name : i.author) || AUTHOR,
      license: i.license || 'AGPL-3.0-or-later',
      homepage: i.homepage || PROJECT,
      bugs: i.bugs || PROJECT + '/issues',
      versions: i.versions || {},
      platform: i.platform || mk.platform || '',
      packaged: !!i.packaged,
      portable: !!i.portable,
      licenseFile: i.licenseFile || null,
      noticesFile: i.noticesFile || null,
      licensesDir: i.licensesDir || null,
      smoke: i.userDataFrom === 'smoke',
    };
  }
  const isSmoke = async () => (await info()).userDataFrom === 'smoke';
  const platformName = p => ({ win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[p] || p || '');
  async function versionText() {
    const f = await aboutFacts();
    const v = f.versions || {};
    return [`${f.name} ${f.version}${f.arch ? ` (${f.arch})` : ''}`, `${platformName(f.platform)}${f.portable ? ', portable' : ''}`,
      v.electron ? `Electron ${v.electron}, Chromium ${v.chrome}, Node.js ${v.node}` : ''].filter(Boolean).join('\n');
  }

  function openExternal(url) {
    return mk.invoke('open-external', url).then(() => true, e => { toast(`Couldn’t open the browser. ${app.ui.plainError ? app.ui.plainError(e) : e.message}`, { kind: 'error' }); return false; });
  }
  async function copyText(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg || 'Copied'); return true; }
    catch { toast('Couldn’t copy to the clipboard.', { kind: 'warn' }); return false; }
  }

  // =====================================================================
  //  Documents: docs/help/*.md, CHANGELOG.md, notices, license texts
  // =====================================================================
  const virtual = new Map(); // key → {title, text, kind:'md'|'text'}
  const textCache = new Map();
  const urlOfKey = key => new URL(key, APP_ROOT).href;
  const keyOfUrl = u => { const x = new URL(u, APP_ROOT); if (x.origin !== APP_ROOT.origin && x.protocol !== APP_ROOT.protocol) return null; if (x.host !== APP_ROOT.host) return null; return decodeURIComponent(x.pathname.replace(/^\/+/, '')); };
  async function fetchText(key) {
    if (virtual.has(key)) return virtual.get(key).text;
    if (textCache.has(key)) return textCache.get(key);
    const r = await fetch(urlOfKey(key), { cache: 'no-store' });
    if (!r.ok) throw Object.assign(new Error('not found: ' + key), { status: r.status });
    const t = await r.text();
    textCache.set(key, t);
    return t;
  }
  async function exists(key) { try { await fetchText(key); return true; } catch { return false; } }
  const titleOf = (text, fallback) => {
    const body = String(text || '').replace(/^---\n[\s\S]*?\n---\n/, '');
    const m = /^#\s+(.+?)\s*(\{[^}]*\})?\s*$/m.exec(body);
    return m ? m[1].replace(/[*_`]/g, '').trim() : fallback;
  };
  const prettyName = key => key.split('/').pop().replace(/\.md$/i, '').replace(/[-_]+/g, ' ').replace(/^\w/, c => c.toUpperCase());

  // Markdown links in a page: [text](target) and <target>, ignoring code.
  function linksIn(text) {
    const src = String(text || '').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    const out = [];
    const re = /(!?)\[((?:[^\[\]]|\[[^\]]*\])*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
    let m;
    while ((m = re.exec(src))) if (!m[1]) out.push({ text: m[2].replace(/[*_`]/g, ''), href: m[3] });
    return out;
  }
  const isExternal = href => /^(https?:|mailto:)/i.test(href);
  function resolveKey(href, fromKey) {
    if (!href || isExternal(href) || /^[a-z][\w+.-]*:/i.test(href) && !/^markooj:/i.test(href)) return null;
    const [path, hash = ''] = href.split('#');
    if (!path) return { key: fromKey, hash: decodeURIComponent(hash) };
    const key = keyOfUrl(new URL(path, urlOfKey(fromKey)).href);
    return key ? { key, hash: decodeURIComponent(hash) } : null;
  }

  // The manual: sections and pages from docs/help/index.md, then every page reached by a link (crawl).
  let manualP = null;
  function manual(refresh) {
    if (refresh) { manualP = null; textCache.clear(); }
    if (!manualP) manualP = buildManual().catch(e => { manualP = null; throw e; });
    return manualP;
  }
  async function buildManual() {
    const index = HELP_DIR + 'index.md';
    let text;
    try { text = await fetchText(index); } catch { return { ok: false, index, sections: [], pages: [], byKey: new Map() }; }
    const byKey = new Map();
    const add = (key, title) => { if (!byKey.has(key)) byKey.set(key, { key, title: title || prettyName(key), text: null }); return byKey.get(key); };
    add(index, 'Home').text = text;
    // sections: "## Heading" followed by list items with links (the index's own layout)
    const sections = [{ title: '', keys: [index] }];
    let cur = null;
    for (const line of text.split(/\r?\n/)) {
      const hm = /^#{2,3}\s+(.+?)\s*$/.exec(line);
      if (hm) { cur = { title: hm[1].replace(/[*_`]/g, ''), keys: [] }; sections.push(cur); continue; }
      for (const l of linksIn(line)) {
        const r = resolveKey(l.href, index);
        if (!r || !/\.md$/i.test(r.key) || !r.key.startsWith(HELP_DIR) || r.key === index) continue;
        add(r.key, l.text);
        const sec = cur || sections[0];
        if (!sections.some(s => s.keys.includes(r.key))) sec.keys.push(r.key);
      }
    }
    // crawl: pages reached only from other pages
    const queue = [...byKey.keys()];
    const seen = new Set(queue);
    while (queue.length) {
      const key = queue.shift();
      const p = byKey.get(key);
      if (p.text == null) { try { p.text = await fetchText(key); } catch { p.missing = true; continue; } }
      const t = titleOf(p.text, null); if (t && key !== index) p.title = t;
      for (const l of linksIn(p.text)) {
        const r = resolveKey(l.href, key);
        if (!r || !/\.md$/i.test(r.key) || !r.key.startsWith(HELP_DIR) || seen.has(r.key)) continue;
        seen.add(r.key); add(r.key, l.text); queue.push(r.key);
      }
    }
    const listed = new Set(sections.flatMap(s => s.keys));
    const extra = [...byKey.keys()].filter(k => !listed.has(k) && !byKey.get(k).missing);
    if (extra.length) sections.push({ title: 'More', keys: extra });
    for (const s of sections) s.keys = s.keys.filter(k => !byKey.get(k)?.missing);
    return { ok: true, index, sections: sections.filter(s => s.keys.length), pages: [...byKey.values()].filter(p => !p.missing), byKey };
  }
  async function pages() { const m = await manual(); return m.pages.map(p => ({ key: p.key, title: p.title })); }

  // Render Markdown with the app's renderer (no document hooks: help pages never touch the open documents).
  // rendered pages, by text (a page drawn once is not drawn again while its text stays the same)
  const htmlCache = new Map();
  async function renderCached(text) {
    if (htmlCache.has(text)) return htmlCache.get(text);
    const html = await renderMarkdown(text);
    if (htmlCache.size > 60) htmlCache.clear();
    htmlCache.set(text, html);
    return html;
  }
  async function renderMarkdown(text) {
    const r = await mk.render(String(text || ''), { macros: (() => { try { return app.developer?.mathMacros?.() || {}; } catch { return {}; } })() });
    return r?.html || '';
  }
  let mermaidSeq = 0;
  async function decorate(el, key) {
    // pictures relative to the page
    for (const img of el.querySelectorAll('img[src]')) {
      const src = img.getAttribute('src');
      if (/^(data:|blob:|https?:)/i.test(src)) continue;
      try { img.src = new URL(src, urlOfKey(key)).href; } catch {}
      img.loading = 'lazy';
    }
    for (const a of el.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      if (isExternal(href)) { a.classList.add('mkh-ext'); a.title = href.replace(/^mailto:/, '') + ' (opens in your browser)'; a.setAttribute('rel', 'noreferrer'); }
    }
    // Mermaid diagrams, drawn in the app theme
    const blocks = el.querySelectorAll('pre.mermaid:not([data-done])');
    if (blocks.length && window.mermaid) {
      try { window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'neutral', fontFamily: 'inherit' }); } catch {}
      for (const pre of blocks) {
        try { const { svg } = await window.mermaid.render('mkh-mmd-' + (++mermaidSeq), pre.getAttribute('data-src') || pre.textContent); pre.innerHTML = svg; pre.dataset.done = '1'; }
        catch { pre.dataset.done = 'err'; }
      }
    }
    // Urdu, Arabic and Persian examples read right to left
    for (const b of el.querySelectorAll('p, li, blockquote, td, th, h1, h2, h3, h4')) if (!b.hasAttribute('dir')) b.setAttribute('dir', 'auto');
    // the Tutorials page: each section whose title is a guided tour gets a button that runs it
    if (key === HELP_DIR + 'tutorials.md' && typeof app.tours?.list === 'function') {
      const byTitle = new Map(app.tours.list().map(t => [t.title.toLowerCase(), t]));
      for (const h2 of el.querySelectorAll('h2')) {
        const t = byTitle.get(h2.textContent.trim().toLowerCase());
        if (!t || h2.nextElementSibling?.classList.contains('mkh-starttour')) continue;
        const b = h('button', { type: 'button', class: 'btn sm mkh-starttour', 'data-tour': t.id, 'data-tip': 'Start this tutorial', 'data-tip-d': `Run “${t.title}” as a guided tour in a practice document. Help closes while it runs.` },
          h('span', { html: icon('mkh-i-tour') }), 'Start this tutorial');
        b.addEventListener('click', () => { close(); setTimeout(() => app.tours.start(t.id), 280); });
        h2.after(b);
      }
    }
  }
  const slug = s => String(s || '').toLowerCase().trim().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
  function findAnchor(el, hash) {
    if (!hash) return null;
    const want = [hash, hash.toLowerCase(), slug(hash)];
    for (const w of want) { const t = el.querySelector(`[id="${CSS.escape(w)}"], a[name="${CSS.escape(w)}"]`); if (t) return t; }
    // a heading whose text slugs to the hash (GitHub style)
    return [...el.querySelectorAll('h1,h2,h3,h4,h5,h6')].find(x => slug(x.textContent) === slug(hash) || slug(x.textContent).replace(/-+/g, '-') === slug(hash).replace(/-+/g, '-')) || null;
  }

  // =====================================================================
  //  The reference manual viewer
  // =====================================================================
  const V = { el: null, key: null, hash: '', back: [], fwd: [], query: '', open: false, seq: 0 };
  function buildViewer() {
    const scrim = h('div', { class: 'mkh-scrim' });
    const el = h('div', { class: 'mkh-viewer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Markooj Help', 'data-mk-keys': 'own' });
    const btn = (cls, ic, tip, desc, fn, key) => h('button', { class: 'mkh-tb ' + cls, type: 'button', html: icon(ic), 'aria-label': tip, 'data-tip': tip, 'data-tip-d': desc, 'data-key': key || null, onclick: fn });
    const backB = btn('mkh-back', 'mkh-i-back', 'Back', 'Go to the page you were on before.', () => go(-1), 'Alt+Left');
    const fwdB = btn('mkh-fwd', 'mkh-i-fwd', 'Forward', 'Go forward again.', () => go(1), 'Alt+Right');
    const homeB = btn('mkh-home', 'mkh-i-home', 'Help home', 'The list of everything in the manual.', () => show(HELP_DIR + 'index.md'));
    const title = h('div', { class: 'mkh-title' }, h('span', { class: 'mkh-badge', html: icon('mkh-i-help') }), h('b', { text: 'Markooj Help' }), h('span', { class: 'mkh-crumb' }));
    const search = h('label', { class: 'mkh-search' }, h('span', { html: icon('mkh-i-search') }), h('input', { type: 'search', placeholder: 'Search help', 'aria-label': 'Search help', spellcheck: 'false' }));
    const printB = btn('mkh-print', 'mkh-i-print', 'Print this page', 'Print the page you are reading, or save it as PDF.', () => printPage(), 'Ctrl+P');
    const toursB = btn('mkh-tours-btn', 'mkh-i-tour', 'Tutorials', 'Guided tours on the real buttons. Help closes while a tour runs.', () => { close(); app.commands.run('help.tutorials'); });
    const closeB = btn('mkh-close', 'mkh-i-x', 'Close Help', 'Back to your document.', () => close(), 'Escape');
    const bar = h('header', { class: 'mkh-bar' }, backB, fwdB, homeB, title, h('span', { class: 'mkh-grow' }), search, toursB, printB, closeB);
    const side = h('nav', { class: 'mkh-side', 'aria-label': 'Help pages' });
    const article = h('article', { class: 'mk-page mkh-doc', tabindex: '-1' });
    const pager = h('div', { class: 'mkh-pager' });
    const main = h('main', { class: 'mkh-main' }, article, pager);
    el.append(bar, h('div', { class: 'mkh-body' }, side, main));
    const input = search.querySelector('input');
    let t = 0;
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => runSearch(input.value), 120); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); const first = side.querySelector('.mkh-res'); if (first) first.click(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); side.querySelector('button')?.focus(); }
      if (e.key === 'Escape' && input.value) { e.preventDefault(); e.stopPropagation(); input.value = ''; runSearch(''); }
    });
    article.addEventListener('click', onArticleClick);
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); go(-1); return; }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); go(1); return; }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); input.focus(); input.select(); return; }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); printPage(); return; }
      if (e.key === 'F1') { e.preventDefault(); show(HELP_DIR + 'index.md'); return; }
      if (e.key === 'Tab') {
        const f = [...el.querySelectorAll('button:not([disabled]), input, a[href], [tabindex="0"]')].filter(x => x.offsetParent);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
      e.stopPropagation();
    });
    // the mouse's back / forward buttons
    el.addEventListener('mouseup', e => { if (e.button === 3) { e.preventDefault(); go(-1); } if (e.button === 4) { e.preventDefault(); go(1); } });
    scrim.addEventListener('mousedown', () => close());
    Object.assign(V, { el, scrim, side, article, pager, input, backB, fwdB, crumb: title.querySelector('.mkh-crumb') });
    return el;
  }
  async function open(page, opts = {}) {
    if (!V.el) buildViewer();
    if (!V.open) {
      V.returnFocus = document.activeElement;
      try { app.backstage.close(); } catch {}
      document.body.append(V.scrim, V.el);
      V.open = true;
      requestAnimationFrame(() => requestAnimationFrame(() => { V.scrim.classList.add('show'); V.el.classList.add('show'); }));
      document.body.classList.add('mkh-open');
    }
    // with no page asked for, go back to the last manual page, but never to a license or notices page (open Help home instead)
    const key = page ? normalizeKey(page) : (V.key && !V.key.startsWith('about:') ? V.key : HELP_DIR + 'index.md');
    await renderSide();
    await show(key, { hash: opts.hash, push: !!V.key && key !== V.key, query: opts.query });
    if (opts.query != null) { V.input.value = opts.query; runSearch(opts.query); }
    setTimeout(() => { if (V.open && !V.el.contains(document.activeElement)) (opts.focusSearch ? V.input : V.article).focus({ preventScroll: true }); }, 60);
    app.events.emit('help:opened', { key: V.key });
    return true;
  }
  function normalizeKey(page) {
    page = String(page);
    if (virtual.has(page)) return page;
    if (/^[\w./-]+\.(md|txt)$/i.test(page) && page.includes('/')) return page.replace(/^\/+/, '');
    if (ROOT_PAGES.includes(page)) return page;
    if (/\.md$/i.test(page)) return HELP_DIR + page;
    return HELP_DIR + page + '.md';
  }
  function close() {
    if (!V.open) return;
    V.open = false;
    V.el.classList.remove('show'); V.scrim.classList.remove('show');
    document.body.classList.remove('mkh-open');
    try { CSS.highlights?.delete('mkh-find'); } catch {}
    setTimeout(() => { if (!V.open) { V.el.remove(); V.scrim.remove(); } }, 260);
    try { (V.returnFocus && V.returnFocus.isConnected ? V.returnFocus : app.editors.active())?.focus?.({ preventScroll: true }); } catch {}
    app.events.emit('help:closed');
  }
  function go(dir) {
    const from = dir < 0 ? V.back : V.fwd, to = dir < 0 ? V.fwd : V.back;
    if (!from.length) return;
    to.push({ key: V.key, hash: V.hash, scroll: V.el.querySelector('.mkh-main').scrollTop });
    const s = from.pop();
    show(s.key, { hash: s.hash, push: false, scroll: s.scroll });
  }
  async function renderSide(activeKey) {
    const m = await manual().catch(() => null);
    const side = V.side;
    if (V.query) return; // the search results stay until the box is cleared
    side.innerHTML = '';
    if (!m || !m.ok) {
      side.append(h('div', { class: 'mkh-side-note', text: 'The manual pages are not included in this copy.' }));
      return;
    }
    for (const s of m.sections) {
      if (s.title) side.append(h('div', { class: 'mkh-sec', text: s.title }));
      for (const k of s.keys) {
        const p = m.byKey.get(k);
        const b = h('button', { type: 'button', class: 'mkh-link' + ((activeKey || V.key) === k ? ' on' : ''), 'data-key': k, text: k === m.index ? 'Help home' : p.title });
        b.addEventListener('click', () => show(k));
        side.append(b);
      }
    }
    side.addEventListener('keydown', sideKeys);
  }
  function sideKeys(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const list = [...V.side.querySelectorAll('button')]; const i = list.indexOf(document.activeElement); if (i < 0) return;
    e.preventDefault();
    if (e.key === 'ArrowUp' && i === 0) { V.input.focus(); return; }
    list[Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))].focus();
  }
  function markActive() { for (const b of V.side.querySelectorAll('.mkh-link')) b.classList.toggle('on', b.dataset.key === V.key); }

  async function show(key, opts = {}) {
    if (!V.el) buildViewer();
    const seq = ++V.seq;
    const push = opts.push !== false && V.key && (key !== V.key || (opts.hash || '') !== V.hash);
    if (push) { V.back.push({ key: V.key, hash: V.hash, scroll: V.el.querySelector('.mkh-main').scrollTop }); V.fwd = []; }
    const m = await manual().catch(() => null);
    let text, kind = 'md', title;
    try {
      if (virtual.has(key)) { const v = virtual.get(key); text = v.text; kind = v.kind || 'md'; title = v.title; }
      else text = await fetchText(key);
    } catch {
      if (key === HELP_DIR + 'index.md') { text = fallbackHome(); }
      else text = `# Page not found\n\nThis help page is not included in this copy of Markooj: \`${key.split('/').pop()}\`.\n\n[Back to Help home](${relFrom(key, HELP_DIR + 'index.md')})`;
    }
    if (seq !== V.seq) return;
    V.key = key; V.hash = opts.hash || '';
    const art = V.article;
    art.classList.toggle('mkh-text', kind === 'text');
    if (kind === 'text') { art.innerHTML = ''; if (title) art.append(h('h1', { text: title })); art.append(h('pre', { class: 'mkh-pre', text })); }
    else { art.innerHTML = await renderCached(text); await decorate(art, key); }
    if (seq !== V.seq) return;
    title = title || (m?.byKey.get(key)?.title) || titleOf(text, prettyName(key));
    V.crumb.textContent = key === HELP_DIR + 'index.md' ? '' : title;
    V.el.setAttribute('aria-label', 'Markooj Help: ' + title);
    renderPager(m);
    markActive();
    V.backB.disabled = !V.back.length; V.fwdB.disabled = !V.fwd.length;
    const main = V.el.querySelector('.mkh-main');
    const target = opts.hash ? findAnchor(art, opts.hash) : null;
    if (target) target.scrollIntoView({ block: 'start' });
    else main.scrollTop = opts.scroll || 0;
    if (opts.query || V.query) highlightTerms(opts.query || V.query);
    else try { CSS.highlights?.delete('mkh-find'); } catch {}
    app.events.emit('help:page', { key, title });
    return true;
  }
  const relFrom = (fromKey, toKey) => { const a = fromKey.split('/'); a.pop(); const b = toKey.split('/'); while (a.length && b.length > 1 && a[0] === b[0]) { a.shift(); b.shift(); } return '../'.repeat(a.length) + b.join('/'); };
  function fallbackHome() {
    return `# Markooj Help\n\nThe reference manual is not included in this copy of Markooj. You can read it online at [github.com/datakeen/markooj](${PROJECT}/tree/main/docs/help).\n\n` +
      'Other help that works offline:\n\n- **Tutorials**: Help → Tutorials shows step-by-step tours in the app.\n- **Keyboard shortcuts**: Help → Keyboard Shortcuts.\n- **Search**: press Alt+Q and type what you want to do.\n';
  }
  function renderPager(m) {
    V.pager.innerHTML = '';
    if (!m || !m.ok || virtual.has(V.key)) return;
    const order = m.sections.flatMap(s => s.keys);
    const i = order.indexOf(V.key);
    if (i < 0) return;
    const mk1 = (k, dir) => { const b = h('button', { type: 'button', class: 'mkh-pg ' + dir }, h('small', { text: dir === 'prev' ? 'Previous' : 'Next' }), h('b', { text: k === m.index ? 'Help home' : m.byKey.get(k).title })); b.addEventListener('click', () => show(k)); return b; };
    if (i > 0) V.pager.append(mk1(order[i - 1], 'prev'));
    V.pager.append(h('span', { class: 'mkh-grow' }));
    if (i < order.length - 1) V.pager.append(mk1(order[i + 1], 'next'));
  }
  function onArticleClick(e) {
    const a = e.target.closest('a[href]');
    if (!a || !V.article.contains(a)) return;
    const href = a.getAttribute('href');
    e.preventDefault();
    if (isExternal(href)) { openExternal(href); return; }
    if (href.startsWith('#')) {
      const t = findAnchor(V.article, decodeURIComponent(href.slice(1)));
      if (t) { V.back.push({ key: V.key, hash: V.hash, scroll: V.el.querySelector('.mkh-main').scrollTop }); V.fwd = []; V.hash = href.slice(1); V.backB.disabled = false; t.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
      return;
    }
    const r = resolveKey(href, V.key);
    if (r && /\.(md|markdown)$/i.test(r.key)) { show(r.key, { hash: r.hash }); return; }
    if (r && /^licenses\//.test(r.key)) { viewFile(r.key, r.key.split('/').pop()); return; }
    toast('This link points to a file that is not part of the help.', { kind: 'info' });
  }

  // ---------- search ----------
  let searchIndexP = null;
  async function searchIndex() {
    if (!searchIndexP) searchIndexP = (async () => {
      const m = await manual();
      if (!m.ok) return [];
      return m.pages.map(p => ({ key: p.key, title: p.key === m.index ? 'Help home' : p.title, text: plain(p.text || ''), lower: plain(p.text || '').toLowerCase() }));
    })().catch(() => { searchIndexP = null; return []; });
    return searchIndexP;
  }
  const plain = md => String(md).replace(/^---\n[\s\S]*?\n---\n/, '').replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '').replace(/\\([\\`*_{}[\]()#+.!|-])/g, '$1').replace(/[#>*_`|]+/g, ' ').replace(/\{#[^}]*\}/g, '').replace(/[ \t]+/g, ' ');
  /** [{key, title, score, snippet}] best first. */
  async function search(q) {
    const words = String(q || '').toLowerCase().split(/\s+/).filter(w => w.length > 1 || /\p{L}/u.test(w)).slice(0, 8);
    if (!words.length) return [];
    const idx = await searchIndex();
    const out = [];
    for (const p of idx) {
      let score = 0, first = -1, all = true;
      const tl = p.title.toLowerCase();
      for (const w of words) {
        let n = 0, i = p.lower.indexOf(w);
        if (i >= 0 && (first < 0 || i < first)) first = i;
        while (i >= 0 && n < 50) { n++; i = p.lower.indexOf(w, i + w.length); }
        if (!n && !tl.includes(w)) all = false;
        score += n + (tl.includes(w) ? 25 : 0);
      }
      if (!all || !score) continue;
      const phrase = words.join(' ');
      if (words.length > 1 && p.lower.includes(phrase)) { score += 15; first = p.lower.indexOf(phrase); }
      let s = Math.max(0, first - 60);
      if (s) { const sp = p.text.indexOf(' ', s); if (sp > 0 && sp < first) s = sp + 1; }
      const snippet = (s ? '…' : '') + p.text.slice(s, s + 170).replace(/\s+/g, ' ').trim() + '…';
      out.push({ key: p.key, title: p.title, score, snippet });
    }
    return out.sort((a, b) => b.score - a.score);
  }
  async function runSearch(q) {
    V.query = String(q || '').trim();
    if (!V.query) { try { CSS.highlights?.delete('mkh-find'); } catch {} V.side.classList.remove('searching'); await renderSide(); return; }
    const res = await search(V.query);
    if (String(V.input.value).trim() !== V.query) return;
    V.side.classList.add('searching');
    V.side.innerHTML = '';
    V.side.append(h('div', { class: 'mkh-sec', text: res.length ? `${res.length} ${res.length === 1 ? 'page' : 'pages'} found` : 'No pages found' }));
    if (!res.length) V.side.append(h('div', { class: 'mkh-side-note', text: 'Try fewer or different words. Commands are also in Alt+Q search.' }));
    const words = V.query.toLowerCase().split(/\s+/).filter(Boolean);
    for (const r of res.slice(0, 40)) {
      const b = h('button', { type: 'button', class: 'mkh-res' + (r.key === V.key ? ' on' : ''), 'data-key': r.key });
      b.append(h('b', { text: r.title }), h('small', { html: markWords(esc(r.snippet), words) }));
      b.addEventListener('click', () => show(r.key, { query: V.query }));
      V.side.append(b);
    }
    highlightTerms(V.query);
  }
  function markWords(html, words) {
    let out = html;
    for (const w of words) { if (w.length < 2) continue; out = out.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>'); }
    return out;
  }
  function highlightTerms(q) {
    try {
      if (!window.Highlight || !CSS.highlights) return;
      const words = String(q || '').toLowerCase().split(/\s+/).filter(w => w.length > 1);
      if (!words.length) { CSS.highlights.delete('mkh-find'); return; }
      const ranges = [];
      const tw = document.createTreeWalker(V.article, NodeFilter.SHOW_TEXT);
      let firstRange = null;
      while (tw.nextNode()) {
        const n = tw.currentNode, lower = n.data.toLowerCase();
        for (const w of words) { let i = lower.indexOf(w); while (i >= 0) { const r = new Range(); r.setStart(n, i); r.setEnd(n, i + w.length); ranges.push(r); if (!firstRange) firstRange = r; i = lower.indexOf(w, i + w.length); } }
      }
      CSS.highlights.set('mkh-find', new Highlight(...ranges));
      if (firstRange && !V.hash) { const rect = firstRange.getBoundingClientRect(); const main = V.el.querySelector('.mkh-main'); const mr = main.getBoundingClientRect(); if (rect.top > mr.bottom - 40 || rect.top < mr.top) main.scrollTop += rect.top - mr.top - 80; }
    } catch {}
  }
  async function printPage() {
    const title = V.crumb.textContent || 'Markooj Help';
    const css = `body{font:12pt/1.55 Charter,Cambria,Georgia,serif;color:#111;margin:18mm}h1,h2,h3{font-family:-apple-system,"Segoe UI",sans-serif;line-height:1.25}
      code,pre{font-family:Consolas,monospace;font-size:10pt}pre{background:#f5f5f7;padding:8px;border-radius:4px;white-space:pre-wrap}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}img{max-width:100%}a{color:#0a52e0}kbd{border:1px solid #bbb;border-radius:3px;padding:0 4px;font:10pt sans-serif}`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${V.article.innerHTML}</body></html>`;
    try { await mk.invoke('print', { html, title }); } catch (e) { toast('Couldn’t print. ' + (e.message || ''), { kind: 'error' }); }
  }

  /** Show a license or notices file in the viewer: Markdown files are drawn, others shown as plain text. */
  async function viewFile(pathOrKey, title, absPath) {
    let text = null;
    if (absPath) { try { text = await mk.invoke('read-text', absPath); } catch {} }
    if (text == null) { try { text = await fetchText(pathOrKey); } catch {} }
    if (text == null) { toast(`${title || 'This file'} is not included in this copy of Markooj.`, { kind: 'warn' }); return false; }
    const key = 'about:' + pathOrKey;
    virtual.set(key, { title: title || prettyName(pathOrKey), text: /\.md$/i.test(pathOrKey) ? text : text.replace(/\r\n/g, '\n'), kind: /\.md$/i.test(pathOrKey) ? 'md' : 'text' });
    return open(key);
  }

  /** Every internal link in the manual: {pages, links, broken:[{from, href, why}]}. */
  async function checkLinks() {
    const m = await manual(true);
    searchIndexP = null;
    const broken = [];
    let links = 0;
    if (!m.ok) return { ok: false, pages: 0, links: 0, broken: [{ from: '-', href: m.index, why: 'missing index' }] };
    const holder = h('div');
    const anchorsOf = new Map();
    const anchors = async key => {
      if (anchorsOf.has(key)) return anchorsOf.get(key);
      holder.innerHTML = await renderCached(await fetchText(key));
      const ids = new Set([...holder.querySelectorAll('[id]')].map(e => e.id));
      for (const x of holder.querySelectorAll('h1,h2,h3,h4,h5,h6')) ids.add(slug(x.textContent));
      anchorsOf.set(key, ids);
      return ids;
    };
    for (const p of m.pages) {
      for (const l of linksIn(p.text)) {
        if (isExternal(l.href) || /^[a-z][\w+.-]*:/i.test(l.href)) continue;
        links++;
        const r = resolveKey(l.href, p.key);
        if (!r) { broken.push({ from: p.key, href: l.href, why: 'outside the app' }); continue; }
        if (!(await exists(r.key))) { broken.push({ from: p.key, href: l.href, why: 'file not found' }); continue; }
        if (r.hash && /\.md$/i.test(r.key)) {
          const ids = await anchors(r.key);
          if (!ids.has(r.hash) && !ids.has(slug(r.hash))) broken.push({ from: p.key, href: l.href, why: 'heading not found' });
        }
      }
    }
    return { ok: !broken.length, pages: m.pages.length, links, broken };
  }

  // =====================================================================
  //  Keyboard shortcuts (from app.keys.list())
  // =====================================================================
  function shortcutRows() {
    try { if (typeof app.keys?.list === 'function') return app.keys.list(); } catch {}
    return app.commands.list().filter(c => c.shortcut && !c.hidden && c.palette !== false)
      .map(c => ({ id: c.id, keys: [].concat(c.shortcut), typing: [].concat(c.altShortcuts || []), title: c.label || c.id, group: (c.category || c.id.split('.')[0]).replace(/^\w/, x => x.toUpperCase()), word: false, description: c.description || '' }));
  }
  const fmtKey = k => { try { return typeof app.keys?.format === 'function' ? app.keys.format(k) : k; } catch { return k; } };
  const keyHtml = k => String(fmtKey(k)).split(/(?<=.)\+(?=.)/).map(p => `<kbd>${esc(p)}</kbd>`).join('<span class="mkh-plus">+</span>');
  function shortcutsHtml(rows = shortcutRows()) {
    let cur = null, body = '';
    for (const r of rows) {
      if (r.group !== cur) { cur = r.group; body += `<tr class="g"><th colspan="2">${esc(cur)}</th></tr>`; }
      body += `<tr><td>${esc(r.title)}</td><td>${r.keys.map(k => esc(fmtKey(k))).join(', ')}${r.typing?.length ? ` <i>(while typing: ${r.typing.map(k => esc(fmtKey(k))).join(', ')})</i>` : ''}</td></tr>`;
    }
    const css = 'body{font:10.5pt/1.4 -apple-system,"Segoe UI",sans-serif;margin:14mm;color:#111}h1{font-size:16pt;margin:0 0 2mm}p{color:#555;margin:0 0 5mm}table{border-collapse:collapse;width:100%}td{padding:2px 6px;border-bottom:.5pt solid #ddd;vertical-align:top}td:last-child{white-space:nowrap;font-family:Consolas,monospace;font-size:9.5pt}tr.g th{text-align:left;padding:8px 6px 3px;font-size:11pt;break-after:avoid}i{color:#666;font-family:-apple-system,sans-serif}tr{break-inside:avoid}';
    return `<!doctype html><html><head><meta charset="utf-8"><title>Markooj keyboard shortcuts</title><style>${css}</style></head><body><h1>Markooj keyboard shortcuts</h1><p>Most are the same as in Microsoft Word.</p><table>${body}</table></body></html>`;
  }
  function shortcuts(opts = {}) {
    const rows = shortcutRows();
    const wrap = h('div', { class: 'mkh-keys' });
    const search = h('input', { class: 'txt', type: 'search', placeholder: 'Search by name or key, for example Bold or Ctrl+K', 'aria-label': 'Search shortcuts', spellcheck: 'false' });
    const list = h('div', { class: 'mkh-keys-cols', role: 'table', 'aria-label': 'Keyboard shortcuts' });
    const scroller = h('div', { class: 'mkh-keys-list' }, list);
    const count = h('div', { class: 'mkh-keys-count' });
    const notes = (() => { try { return app.keys?.notes?.() || []; } catch { return []; } })();
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const qk = q.replace(/\s+/g, '');
      const hit = r => !q || r.title.toLowerCase().includes(q) || r.group.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q) ||
        [...r.keys, ...(r.typing || [])].some(k => k.toLowerCase().replace(/\s+/g, '').includes(qk) || String(fmtKey(k)).toLowerCase().replace(/\s+/g, '').includes(qk));
      list.innerHTML = '';
      let cur = null, n = 0;
      for (const r of rows.filter(hit)) {
        if (r.group !== cur) { cur = r.group; list.append(h('div', { class: 'mkh-kg', role: 'rowheader', text: cur })); }
        const row = h('div', { class: 'mkh-kr', role: 'row', title: r.description || '' },
          h('span', { class: 'mkh-kt', role: 'cell' }, r.title, r.word ? h('span', { class: 'mkh-word', text: 'Word', title: 'The same key as in Microsoft Word', 'aria-label': 'same as Word' }) : null),
          h('span', { class: 'mkh-kk', role: 'cell', html: r.keys.map(keyHtml).join('<span class="mkh-or">or</span>') + (r.typing?.length ? `<span class="mkh-typing">while typing ${r.typing.map(keyHtml).join(' ')}</span>` : '') }));
        list.append(row); n++;
      }
      if (!n) list.append(h('div', { class: 'mkh-side-note', text: 'No shortcut matches. Try another word, or press Alt+Q to search every command.' }));
      count.textContent = `${n} ${n === 1 ? 'shortcut' : 'shortcuts'}`;
    };
    search.addEventListener('input', draw);
    wrap.append(h('div', { class: 'mkh-keys-top' }, search, count), scroller);
    if (notes.length) {
      const d = h('details', { class: 'mkh-keys-notes' }, h('summary', { text: 'Word keys that work differently here' }));
      const ul = h('ul');
      for (const nt of notes) ul.append(h('li', { html: `${keyHtml(nt.key)} ${esc(nt.note || '')}` }));
      d.append(ul); wrap.append(d);
    }
    draw();
    if (opts.query) { search.value = opts.query; draw(); }
    return app.ui.dialog({
      title: 'Keyboard shortcuts', icon: 'keyboard', wide: 'x', body: wrap,
      buttons: [
        { label: 'Print…', value: 'print', left: true },
        { label: 'Reference Manual', value: 'manual' },
        { label: 'Done', value: true, primary: true },
      ],
      onOpen: () => setTimeout(() => search.focus(), 40),
    }).then(async v => {
      if (v === 'print') { try { await mk.invoke('print', { html: shortcutsHtml(rows), title: 'Markooj keyboard shortcuts' }); } catch (e) { toast('Couldn’t print. ' + (e.message || ''), { kind: 'error' }); } }
      if (v === 'manual') { const m = await manual().catch(() => null); const k = m?.pages.find(p => /keyboard/i.test(p.key))?.key; open(k || undefined); }
      return v;
    });
  }

  // =====================================================================
  //  What's new (the latest section of CHANGELOG.md)
  // =====================================================================
  /** {version, date, title, body} of the first release section with content (an empty "Unreleased" is skipped). */
  function latestChanges(text) {
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    const heads = [];
    lines.forEach((l, i) => { if (/^##\s+/.test(l)) heads.push(i); });
    for (let n = 0; n < heads.length; n++) {
      const start = heads[n], end = n + 1 < heads.length ? heads[n + 1] : lines.length;
      const body = lines.slice(start + 1, end).join('\n').replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, '').trim();
      const title = lines[start].replace(/^##\s+/, '').trim();
      if (!body) continue;
      const vm = /\[?v?(\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)\]?/.exec(title);
      const dm = /(\d{4}-\d{2}-\d{2})/.exec(title);
      return { title: title.replace(/^\[([^\]]+)\]/, '$1'), version: vm ? vm[1] : null, date: dm ? dm[1] : null, body };
    }
    return null;
  }
  async function whatsNew() {
    let text = null;
    try { text = await fetchText('CHANGELOG.md'); } catch {}
    const latest = latestChanges(text);
    const f = await aboutFacts();
    const box = h('div', { class: 'mkh-new' });
    if (!latest) {
      box.append(h('p', { text: 'The list of changes is not included in this copy. You can read it on the project page.' }));
      const v = await app.ui.dialog({ title: 'What’s new', icon: 'mkh-i-new', body: box, buttons: [{ label: 'Project Page', value: 'web', left: true }, { label: 'OK', value: true, primary: true }] });
      if (v === 'web') openExternal(PROJECT + '/releases');
      return v;
    }
    const head = h('div', { class: 'mkh-new-head' },
      h('b', { text: latest.version ? `Markooj ${latest.version}` : latest.title }),
      latest.date ? h('span', { text: new Date(latest.date + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }) : null,
      latest.version && f.version && latest.version === f.version ? h('span', { class: 'mkh-pill', text: 'This version' }) : null);
    const art = h('div', { class: 'mk-page mkh-doc mkh-new-body' });
    art.innerHTML = await renderMarkdown(latest.body);
    await decorate(art, 'CHANGELOG.md');
    art.addEventListener('click', e => { const a = e.target.closest('a[href]'); if (!a) return; e.preventDefault(); const href = a.getAttribute('href'); if (isExternal(href)) openExternal(href); });
    box.append(head, art);
    const v = await app.ui.dialog({ title: 'What’s new', icon: 'mkh-i-new', wide: true, body: box, buttons: [{ label: 'All Changes', value: 'all', left: true }, { label: 'OK', value: true, primary: true }] });
    if (v === 'all') open('CHANGELOG.md');
    return v;
  }

  // =====================================================================
  //  About Markooj
  // =====================================================================
  // Every bundled component, with its license (see THIRD_PARTY_NOTICES.md and licenses/). ver: how to find the version in the notices.
  const CREDITS = [
    { group: 'Programs Markooj starts' },
    { name: 'Pandoc', what: 'Word, OpenDocument, EPUB, LaTeX and other formats', license: 'GPL-2.0-or-later', url: 'https://pandoc.org', file: 'pandoc-COPYING', ver: /^###\s+Pandoc\s+([\d.]+)/m },
    { name: 'DjVuLibre', what: 'Viewing DjVu files', license: 'GPL-2.0-or-later', url: 'https://djvu.sourceforge.net', file: 'djvulibre-COPYING', ver: /^###\s+DjVuLibre\s+([\d.]+)/m },
    { name: 'pdf2djvu', what: 'Save As DjVu', license: 'GPL-2.0-only', url: 'https://jwilk.net/software/pdf2djvu', file: 'pdf2djvu-COPYING', ver: /^###\s+pdf2djvu\s+([\d.]+)/m },
    { group: 'App platform' },
    { name: 'Electron', what: 'The app runtime', license: 'MIT', url: 'https://www.electronjs.org', file: 'electron-LICENSE.txt', v: 'electron' },
    { name: 'Chromium', what: 'The web engine inside Electron', license: 'BSD-3-Clause and others', url: 'https://www.chromium.org', v: 'chrome' },
    { name: 'Node.js', what: 'Inside Electron', license: 'MIT', url: 'https://nodejs.org', v: 'node' },
    { group: 'Markdown, math and diagrams' },
    { name: 'markdown-it and plugins', what: 'Reading Markdown', license: 'MIT (markdown-it-anchor: Unlicense)', url: 'https://github.com/markdown-it/markdown-it', npm: 'markdown-it' },
    { name: 'KaTeX', what: 'Drawing math', license: 'MIT (fonts: OFL-1.1)', url: 'https://katex.org', npm: 'katex' },
    { name: 'MathLive', what: 'The equation editor', license: 'MIT', url: 'https://cortexjs.io/mathlive/', npm: 'mathlive' },
    { name: 'Mermaid', what: 'Diagrams', license: 'MIT', url: 'https://mermaid.js.org', npm: 'mermaid' },
    { name: 'highlight.js', what: 'Code colors', license: 'BSD-3-Clause', url: 'https://highlightjs.org', npm: 'highlight.js' },
    { name: 'turndown', what: 'Page to Markdown', license: 'MIT', url: 'https://github.com/mixmark-io/turndown', npm: 'turndown' },
    { name: 'DOMPurify', what: 'Safe HTML', license: 'Apache-2.0 (dual MPL-2.0)', url: 'https://github.com/cure53/DOMPurify', npm: 'dompurify' },
    { name: 'yaml', what: 'Front matter', license: 'ISC', url: 'https://eemeli.org/yaml/', npm: 'yaml' },
    { group: 'Files' },
    { name: 'pdf.js', what: 'Viewing PDF files', license: 'Apache-2.0', url: 'https://mozilla.github.io/pdf.js/', npm: 'pdfjs-dist' },
    { name: 'pdf-lib', what: 'PDF properties', license: 'MIT', url: 'https://pdf-lib.js.org', npm: 'pdf-lib' },
    { name: 'mammoth', what: 'Opening Word files', license: 'BSD-2-Clause', url: 'https://github.com/mwilliamson/mammoth.js', npm: 'mammoth' },
    { name: 'html-to-docx', what: 'Built-in Word writer', license: 'MIT', url: 'https://github.com/privateOmega/html-to-docx', npm: 'html-to-docx' },
    { name: 'JSZip', what: 'EPUB and Word packages', license: 'MIT (dual GPL-3.0)', url: 'https://stuk.github.io/jszip/', npm: 'jszip' },
    { name: 'Citation Style Language styles', what: 'APA, IEEE and Chicago', license: 'CC BY-SA 3.0', url: 'https://citationstyles.org', file: 'csl-styles.txt' },
    { group: 'Python' },
    { name: 'Pyodide', what: 'Python macros, offline', license: 'MPL-2.0', url: 'https://pyodide.org', file: 'pyodide-LICENSE.txt', npm: 'pyodide' },
    { name: 'CPython', what: 'Python itself, inside Pyodide', license: 'PSF-2.0', url: 'https://www.python.org', file: 'cpython-LICENSE.txt' },
    { group: 'Writing Assistant and languages' },
    { name: 'Harper', what: 'Grammar checking', license: 'Apache-2.0', url: 'https://github.com/automattic/harper', file: 'harper-LICENSE.txt', ver: /^###\s+Harper.*?([\d.]+)\s*$/m },
    { name: 'nspell', what: 'Spelling', license: 'MIT', url: 'https://github.com/wooorm/nspell', file: 'nspell-LICENSE.txt', npm: 'nspell' },
    { name: 'SCOWL dictionaries', what: 'US and UK English spelling', license: 'MIT and BSD', url: 'http://wordlist.aspell.net', file: 'dictionary-en-LICENSE.txt' },
    { name: 'Lilak', what: 'Persian spelling', license: 'Apache-2.0', url: 'https://github.com/wooorm/dictionaries', file: 'dictionary-fa-LICENSE.txt' },
    { name: 'WordNet', what: 'Synonyms and the Thesaurus', license: 'WordNet 3.0 License (Princeton University)', url: 'https://wordnet.princeton.edu', file: 'wordnet-LICENSE.txt' },
    { name: 'write-good', what: 'Style checks', license: 'MIT', url: 'https://github.com/btford/write-good', file: 'write-good-LICENSE.txt', npm: 'write-good' },
    { name: 'Noto Nastaliq Urdu', what: 'Urdu font', license: 'OFL-1.1', url: 'https://github.com/notofonts/nastaliq', file: 'font-noto-nastaliq-urdu-OFL.txt' },
    { name: 'Noto Naskh Arabic', what: 'Arabic font', license: 'OFL-1.1', url: 'https://github.com/notofonts/arabic', file: 'font-noto-naskh-arabic-OFL.txt' },
    { name: 'Vazirmatn', what: 'Persian font', license: 'OFL-1.1', url: 'https://github.com/rastikerdar/vazirmatn', file: 'font-vazirmatn-OFL.txt' },
    { group: 'Language data (in language packs, downloaded separately)' },
    { name: 'CLE Urdu word list', what: 'Urdu word list from the Urdu Spell Checker v1.0 by the Center for Language Engineering (CLE), KICS, UET Lahore (originally CRULP), used under the GNU GPL v3.', license: 'GPL-3.0', url: 'https://www.cle.org.pk/software/langproc/spellcheck.htm' },
    { name: 'Markooj language packs', what: 'Word lists and rules for Urdu, Arabic and Punjabi', license: 'CC BY-SA 4.0', url: 'https://github.com/datakeen/markooj-language-packs' },
  ];
  function creditVersion(c, notices, facts) {
    if (c.v && facts?.versions?.[c.v]) return facts.versions[c.v];
    if (!notices) return '';
    if (c.ver) { const m = c.ver.exec(notices); if (m) return m[1]; }
    if (c.npm) { const m = new RegExp(`^\\|\\s*\\*\\*${c.npm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*\\s*\\|\\s*([^|\\s]+)`, 'm').exec(notices); if (m) return m[1]; }
    return '';
  }
  let noticesP = null;
  async function noticesText() {
    if (!noticesP) noticesP = (async () => {
      const f = await aboutFacts();
      if (f.noticesFile) { try { return await mk.invoke('read-text', f.noticesFile); } catch {} }
      try { return await fetchText('THIRD_PARTY_NOTICES.md'); } catch { return ''; }
    })();
    return noticesP;
  }
  const sep = () => (mk.platform === 'win32' ? '\\' : '/');
  // A license link inside the About dialog closes the dialog first (the help viewer sits below dialogs).
  let aboutClose = null;
  const closeAbout = () => { const c = aboutClose; aboutClose = null; try { c?.(null); } catch {} };
  async function viewLicense() {
    closeAbout();
    const f = await aboutFacts();
    return viewFile('LICENSE', 'Markooj license (GNU AGPL v3)', f.licenseFile);
  }
  async function viewNotices() {
    closeAbout();
    const f = await aboutFacts();
    return viewFile('THIRD_PARTY_NOTICES.md', 'Third-party notices', f.noticesFile);
  }
  async function viewCreditLicense(c) {
    closeAbout();
    const f = await aboutFacts();
    return viewFile('licenses/' + c.file, `${c.name}: ${c.license}`, f.licensesDir ? f.licensesDir + sep() + c.file : null);
  }

  const licenseName = id => (/^AGPL-3.0/.test(id || '') ? 'GNU Affero General Public License, version 3 or any later version' : id === 'MIT' ? 'MIT License' : (id || '') + ' license');
  /** The About card (used by the dialog and by File → Help). */
  async function aboutCard(opts = {}) {
    const f = await aboutFacts();
    const card = h('div', { class: 'mkh-about' + (opts.compact ? ' compact' : '') });
    const logo = h('div', { class: 'mkh-logo' });
    const img = h('img', { src: '../build/icon.png', alt: '', width: '64', height: '64', draggable: 'false' });
    img.addEventListener('error', () => { logo.innerHTML = '<span class="mkh-logo-m">M</span>'; });
    logo.append(img);
    const ver = f.version ? `Version ${f.version}${f.arch ? ` (${f.arch})` : ''}` : '';
    const head = h('div', { class: 'mkh-about-head' }, logo,
      h('div', { class: 'mkh-about-id' },
        h('div', { class: 'mkh-about-name', text: f.name }),
        h('div', { class: 'mkh-about-ver', text: ver }),
        h('div', { class: 'mkh-about-tag', text: TAGLINE })));
    const facts = h('div', { class: 'mkh-about-facts' },
      h('p', { class: 'mkh-madeby' }, 'Made by ', h('b', { text: f.author })),
      h('p', { class: 'mkh-copy', text: f.copyright }),
      h('p', { class: 'mkh-lic' }, `Markooj is free and open-source software under the ${licenseName(f.license)}. `,
        h('button', { type: 'button', class: 'mkh-linkbtn', text: 'View license', 'data-tip': 'View license', 'data-tip-d': 'The full license text that comes with Markooj.', onclick: () => viewLicense() })),
      h('p', { class: 'mkh-warranty', text: 'Markooj comes with ABSOLUTELY NO WARRANTY. You may share and change it under the terms of this license.' }),
      h('p', { class: 'mkh-proj' }, 'Project page: ',
        h('a', { href: f.homepage, class: 'mkh-ext', title: f.homepage + ' (opens in your browser)', onclick: e => { e.preventDefault(); openExternal(f.homepage); }, text: f.homepage.replace(/^https?:\/\//, '') })));
    card.append(head, facts);
    return card;
  }
  async function creditsBox() {
    const [notices, facts] = await Promise.all([noticesText(), aboutFacts()]);
    const box = h('div', { class: 'mkh-credits' });
    box.append(h('div', { class: 'mkh-credits-head' },
      h('b', { text: 'Credits' }),
      h('span', { class: 'mkh-grow' }),
      h('button', { type: 'button', class: 'btn sm', 'data-tip': 'View notices', 'data-tip-d': 'Every component, its version, copyright, license and where its source code is.', onclick: () => viewNotices() }, 'View Notices')));
    box.append(h('p', { class: 'mkh-credits-lead', text: 'Markooj is built on the work of these projects. Each keeps its own license.' }));
    const list = h('div', { class: 'mkh-credits-list', role: 'list' });
    for (const c of CREDITS) {
      if (c.group) { list.append(h('div', { class: 'mkh-cg', text: c.group })); continue; }
      const v = creditVersion(c, notices, facts);
      const row = h('div', { class: 'mkh-cr', role: 'listitem' },
        h('div', { class: 'mkh-cn' }, h('a', { href: c.url, class: 'mkh-ext', title: c.url + ' (opens in your browser)', onclick: e => { e.preventDefault(); openExternal(c.url); }, text: c.name }), v ? h('span', { class: 'mkh-cv', text: v }) : null, h('div', { class: 'mkh-cw', text: c.what })),
        c.file ? h('button', { type: 'button', class: 'mkh-cl mkh-linkbtn', text: c.license, 'data-tip': `${c.name} license`, 'data-tip-d': 'Show the license text that comes with Markooj.', onclick: () => viewCreditLicense(c) }) : h('span', { class: 'mkh-cl', text: c.license }));
      list.append(row);
    }
    box.append(list);
    box.append(h('p', { class: 'mkh-gpl', text: 'Pandoc, DjVuLibre and pdf2djvu are separate programs under the GNU GPL. Markooj runs them as tools; they are not built into Markooj. Their complete source code is on the Markooj releases page, and the Markooj maintainers will send it to anyone who asks at github.com/datakeen/markooj/issues for at least three years after each release.' }));
    return box;
  }
  async function about() {
    const body = h('div', { class: 'mkh-about-dlg' });
    body.append(await aboutCard());
    body.append(await creditsBox());
    body.append(h('p', { class: 'mkh-quiet' }, h('a', { href: LINKEDIN, class: 'mkh-li', title: LINKEDIN + ' (opens in your browser)', onclick: e => { e.preventDefault(); openExternal(LINKEDIN); }, text: 'linkedin.com/in/abilal' })));
    const v = await app.ui.dialog({
      title: 'About Markooj', wide: true, body,
      buttons: [{ label: 'Copy Version Info', value: 'copy', left: true }, { label: 'OK', value: true, primary: true }],
      onOpen: (_b, c, dlg) => { aboutClose = c; dlg?.classList.add('mkh-about-wrap'); },
    });
    aboutClose = null;
    if (v === 'copy') copyText(await versionText(), 'Version info copied');
    return v;
  }

  // =====================================================================
  //  Tutorials list (tours.js provides app.tours)
  // =====================================================================
  function tutorialsList(onStart) {
    const T = app.tours;
    const box = h('div', { class: 'mkh-tours', role: 'list' });
    if (!T || typeof T.list !== 'function') { box.append(h('p', { class: 'mkh-side-note', text: 'Tutorials are not included in this copy.' })); return box; }
    for (const t of T.list()) {
      const done = !!T.isDone?.(t.id);
      const b = h('button', { type: 'button', class: 'mkh-tour' + (done ? ' done' : ''), role: 'listitem', 'data-tour': t.id, 'aria-label': `${t.title}, ${t.minutes} min${done ? ', done' : ''}` },
        h('span', { class: 'mkh-tour-ic', html: icon(done ? 'mkh-i-check' : (t.icon || 'mkh-i-tour')) }),
        h('span', { class: 'mkh-tour-t' }, h('b', { text: t.title }), h('small', { text: t.description || '' })),
        h('span', { class: 'mkh-tour-m', text: `${t.minutes} min` }));
      b.dataset.tip = t.title; b.dataset.tipD = (t.description || '') + (done ? ' You finished this one.' : '');
      b.addEventListener('click', () => { onStart?.(); T.start(t.id); });
      box.append(b);
    }
    return box;
  }
  async function tutorials() {
    let closeFn = null;
    const T = app.tours;
    const n = T?.list ? T.list().length : 0, done = T?.list ? T.list().filter(t => T.isDone?.(t.id)).length : 0;
    const body = h('div', { class: 'mkh-tut-dlg' },
      h('p', { class: 'mkh-tut-lead', text: `Short guided tours that point at the real buttons. They use a practice document, so your files are never touched.${n ? ` You finished ${done} of ${n}.` : ''}` }),
      tutorialsList(() => closeFn?.(null)));
    return app.ui.dialog({ title: 'Tutorials', icon: 'mkh-i-tour', wide: true, body, buttons: [{ label: 'Close', value: null, primary: true }], onOpen: (_b, close) => { closeFn = close; } });
  }

  // =====================================================================
  //  Commands, ribbon tab, File → Help
  // =====================================================================
  const reportProblem = async () => {
    const ok = await openExternal(NEW_ISSUE);
    if (ok) toast('GitHub opens in your browser. Please include your Markooj version.', { kind: 'info', timeout: 9000, actions: [{ label: 'Copy Version Info', run: async () => copyText(await versionText(), 'Version info copied') }] });
    return ok;
  };
  const projectPage = () => openExternal(PROJECT);
  const CMDS = {
    'help.manual': { label: 'Reference Manual', icon: 'mkh-i-book', description: 'The Markooj manual: every feature explained, with search. Works offline.', run: args => open(args?.page, { hash: args?.hash, query: args?.query }) },
    'help.tutorials': { label: 'Tutorials', icon: 'mkh-i-tour', description: 'Short guided tours that point at the real buttons, using a practice document.', run: () => tutorials() },
    'help.shortcuts': { label: 'Keyboard Shortcuts', icon: 'mkh-i-keys', description: 'Every keyboard shortcut, searchable and printable. Most are the same as in Word.', run: args => shortcuts(args || {}) },
    'help.whatsNew': { label: 'What’s New', icon: 'mkh-i-new', description: 'What changed in this version of Markooj.', run: () => whatsNew() },
    'help.reportProblem': { label: 'Report a Problem', icon: 'mkh-i-bug', description: 'Opens a new issue on GitHub in your browser, where you can describe what went wrong.', run: () => reportProblem() },
    'help.projectPage': { label: 'Project Page', icon: 'mkh-i-home', description: 'The Markooj page on GitHub: downloads, source code and news. Opens in your browser.', run: () => projectPage() },
    'help.about': { label: 'About Markooj', icon: 'mkh-i-about', description: 'Version, copyright, license and the projects Markooj is built on.', run: () => about() },
  };
  for (const [id, c] of Object.entries(CMDS)) {
    app.commands.register(id, { ...c, category: 'Help' });
    try { app.tooltips?.register?.(id, { title: c.label, description: c.description }); } catch {}
  }

  app.ribbon.addTab('help', { title: 'Help', label: 'Help', order: 85 });
  app.ribbon.addGroup('help', { id: 'help-learn', label: 'Help', order: 10, items: [
    { type: 'big', command: 'help.manual', label: 'Help', icon: 'mkh-i-book', shortcut: 'F1', tooltip: 'Reference Manual' },
    { type: 'big', command: 'help.tutorials', label: 'Tutorials', icon: 'mkh-i-tour' },
    { type: 'big', command: 'help.shortcuts', label: 'Shortcuts', icon: 'mkh-i-keys' },
  ] });
  app.ribbon.addGroup('help', { id: 'help-news', label: 'Updates', order: 20, items: [
    { type: 'big', command: 'help.whatsNew', label: 'What’s New', icon: 'mkh-i-new' },
  ] });
  app.ribbon.addGroup('help', { id: 'help-feedback', label: 'Feedback', order: 30, items: [
    { type: 'big', command: 'help.reportProblem', label: 'Report a Problem', icon: 'mkh-i-bug' },
    { type: 'col', items: [
      { type: 'small', command: 'help.projectPage', label: 'Project Page', icon: 'mkh-i-home', showLabel: true },
      { type: 'small', command: 'help.checkTools', label: 'Check Tools', icon: 'mkh-i-tools', showLabel: true },
    ] },
  ] });
  app.ribbon.addGroup('help', { id: 'help-about', label: 'About', order: 40, items: [
    { type: 'big', command: 'help.about', label: 'About', icon: 'mkh-i-about' },
  ] });

  function bigCard(cmd, title, desc, ic, extra) {
    const b = h('button', { type: 'button', class: 'mkh-card', 'data-tip-cmd': cmd },
      h('span', { class: 'mkh-card-ic', html: icon(ic) }),
      h('span', { class: 'mkh-card-t' }, h('b', { text: title }, extra ? h('span', { class: 'mkh-card-x', html: extra }) : null), h('small', { text: desc })));
    b.addEventListener('click', () => app.commands.run(cmd));
    return b;
  }
  async function renderBackstage(el) {
    el.classList.add('mkh-bs');
    el.innerHTML = '<h2>Help</h2><p class="sub">The manual, tutorials and shortcuts work offline. Press F1 at any time.</p>';
    const grid = h('div', { class: 'mkh-cards' },
      bigCard('help.manual', 'Reference manual', 'Every feature explained, with search.', 'mkh-i-book', '<kbd>F1</kbd>'),
      bigCard('help.tutorials', 'Tutorials', 'Guided tours on the real buttons.', 'mkh-i-tour'),
      bigCard('help.shortcuts', 'Keyboard shortcuts', 'Search or print the full list.', 'mkh-i-keys'),
      bigCard('help.whatsNew', 'What’s new', 'Changes in this version.', 'mkh-i-new'),
      bigCard('help.reportProblem', 'Report a problem', 'Tell us on GitHub.', 'mkh-i-bug', icon('mkh-i-ext', 'i x')),
      bigCard('help.projectPage', 'Project page', 'Downloads, source code and news.', 'mkh-i-home', icon('mkh-i-ext', 'i x')));
    el.append(grid);
    el.append(h('div', { class: 'sec-title', text: 'About Markooj' }));
    const card = await aboutCard({ compact: true });
    const acts = h('div', { class: 'mkh-about-acts' },
      h('button', { type: 'button', class: 'btn', 'data-tip-cmd': 'help.about', onclick: () => app.commands.run('help.about') }, 'Credits and Licenses'),
      h('button', { type: 'button', class: 'btn', 'data-tip': 'View notices', 'data-tip-d': 'Every bundled component, its version, license and source.', onclick: () => viewNotices() }, 'Third-Party Notices'),
      h('button', { type: 'button', class: 'btn', 'data-tip': 'Copy version info', 'data-tip-d': 'Copies the version, system and Electron versions, for a problem report.', onclick: async () => copyText(await versionText(), 'Version info copied') }, h('span', { html: icon('mkh-i-copy') }), 'Copy Version Info'));
    card.append(acts);
    card.append(h('p', { class: 'mkh-quiet' }, h('a', { href: LINKEDIN, class: 'mkh-li', title: LINKEDIN + ' (opens in your browser)', onclick: e => { e.preventDefault(); openExternal(LINKEDIN); }, text: 'linkedin.com/in/abilal' })));
    el.append(card);
    if (app.tours?.list) {
      el.append(h('div', { class: 'sec-title', text: 'Tutorials' }));
      el.append(tutorialsList(() => app.backstage.close()));
    }
  }
  app.backstage.addPage({ id: 'help', label: 'Help', icon: 'mkh-i-help', order: 95, description: 'The manual, tutorials, keyboard shortcuts, what’s new and About Markooj.', render: renderBackstage });

  app.help = {
    open, close, show: (k, o) => show(normalizeKey(k), o), pages, load: fetchText, manual, search, checkLinks, viewFile, viewLicense, viewNotices,
    about, aboutCard, aboutFacts, creditsBox, credits: CREDITS, creditVersion, shortcuts, shortcutsHtml, shortcutRows, whatsNew, latestChanges,
    reportProblem, projectPage, tutorials, tutorialsList, info, versionText, latestKey: () => V.key, viewer: V,
    links: { project: PROJECT, issues: NEW_ISSUE, linkedin: LINKEDIN },
  };

  // =====================================================================
  //  Smoke tests
  // =====================================================================
  const T = app.tests, A = app.assert;
  const shot = async name => { try { await mk.invoke('smoke-shot', name); } catch {} };
  const waitDlg = async (re, ms = 6000) => { const end = Date.now() + ms; for (;;) { const d = [...document.querySelectorAll('.dlg.show')].pop(); if (d && re.test(d.textContent)) return d; if (Date.now() > end) return null; await sleep(60); } };
  const closeTopDialog = async () => {
    const dlg = [...document.querySelectorAll('.dlg.show')].pop();
    const ok = dlg && [...dlg.querySelectorAll('.dlg-foot .btn')].find(b => /^(OK|Done|Close)$/.test(b.textContent.trim()));
    if (ok) ok.click(); else document.querySelector('.dlg.show')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(320);
  };
  T.register('help: Help tab sits after Add-ins and every Help command has a ScreenTip', async () => {
    const tabs = app.ribbon.tabs().filter(t => !t.contextual).map(t => t.id);
    A(tabs.includes('help'), 'Help tab registered');
    A(tabs.indexOf('help') === tabs.indexOf('addins') + 1, 'Help comes right after Add-ins: ' + tabs.join(','));
    for (const id of Object.keys(CMDS)) {
      A(app.commands.get(id), id + ' registered');
      const i = app.tooltips?.info?.(id);
      if (app.tooltips?.info) A(i && i.title && i.description, id + ' has a ScreenTip');
    }
    const f1 = typeof app.keys?.list === 'function' ? app.keys.list().find(r => r.keys.includes('F1')) : null;
    if (app.keys?.list) A(f1 && f1.id === 'help.manual', 'F1 opens the reference manual (got ' + (f1 && f1.id) + ')');
    A(app.backstage.pages().some(p => p.id === 'help'), 'File → Help page');
  });
  T.register('help: About shows version, copyright, made-by, license and credits', async () => {
    const f = await aboutFacts();
    A(f.version, 'version from app-info');
    const p = about();
    const dlg = await waitDlg(/About Markooj[\s\S]*Credits/);
    try {
    A(dlg, 'About dialog open');
    const text = dlg.textContent;
    A(text.includes(`Version ${f.version}`), 'shows the version');
    A(text.includes('Copyright © 2026 Ahmed Bilal and contributors.'), 'copyright notice');
    A(/Made by\s*Ahmed Bilal/.test(text), 'made by');
    A(/free and open-source software under the GNU Affero General Public License, version 3/.test(text), "license line (AGPL v3)");
    for (const n of ['Pandoc', 'DjVuLibre', 'pdf2djvu', 'Electron', 'KaTeX', 'MathLive', 'markdown-it', 'Mermaid', 'Pyodide', 'Harper', 'nspell', 'WordNet', 'highlight.js', 'turndown', 'DOMPurify', 'mammoth', 'pdf.js', 'JSZip', 'Citation Style', 'CLE Urdu word list', 'Center for Language Engineering (CLE), KICS, UET Lahore']) A(text.includes(n), 'credits list ' + n);
    A(/GPL-2\.0-or-later/.test(text) && /GNU GPL/.test(text), 'GPL licenses and source offer');
    A(dlg.querySelector('.mkh-li[href="https://www.linkedin.com/in/abilal"]'), 'LinkedIn link at the end');
    A(!/TODO|FIXME|placeholder/i.test(text), 'no notes to the developer');
    A(dlg.querySelector('.mkh-logo img')?.complete !== false, 'icon element');
    const pv = creditVersion(CREDITS.find(c => c.name === 'KaTeX'), await noticesText(), f);
    A(/^\d/.test(pv), 'KaTeX version from the notices: ' + pv);
    await sleep(300);
    await shot('about');
    } finally { await closeTopDialog(); }
    await p;
  });
  T.register('help: reference manual opens every page in docs/help with no broken internal links', async () => {
    const r = await checkLinks();
    A(r.pages > 0 || r.ok === false, 'manual pages found');
    A(r.ok, `${r.broken.length} broken link(s): ` + r.broken.slice(0, 12).map(b => `${b.from} → ${b.href} (${b.why})`).join('; '));
    await open();
    await sleep(300);
    A(V.open && document.querySelector('.mkh-viewer.show'), 'viewer open');
    const m = await manual();
    for (const p of m.pages) {
      await show(p.key, { push: true });
      A(V.key === p.key, 'shows ' + p.key);
      A(V.article.textContent.trim().length > 20, 'page has text: ' + p.key);
      A(!/Page not found/.test(V.article.querySelector('h1')?.textContent || ''), 'page found: ' + p.key);
    }
    // back and forward
    if (m.pages.length > 1) {
      const last = V.key; go(-1); await sleep(120);
      A(V.key !== last, 'Back goes to the previous page'); go(1); await sleep(120); A(V.key === last, 'Forward');
    }
    // a link between pages works from the rendered page
    await show(m.index, { push: true });
    const a = [...V.article.querySelectorAll('a[href]')].find(x => /\.md(#|$)/.test(x.getAttribute('href')));
    if (a) { a.click(); await sleep(250); A(V.key !== m.index, 'clicking a link opens the page'); }
    // search
    const res = await search('equation');
    if (m.pages.length > 3) A(res.length > 0, 'search finds pages about equations');
    await show(m.index, { push: true });
    V.input.value = 'table'; await runSearch('table'); await sleep(120);
    await shot('help');
    V.input.value = ''; await runSearch('');
    close(); await sleep(300);
    A(!document.querySelector('.mkh-viewer'), 'viewer closed');
  });
  T.register('help: external links open in the browser, not in the app', async () => {
    const holder = h('div');
    holder.innerHTML = await renderMarkdown('[GitHub](https://github.com/datakeen/markooj) and [page](getting-started.md)');
    await decorate(holder, HELP_DIR + 'index.md');
    A(holder.querySelector('a.mkh-ext'), 'external link marked');
    A(!holder.querySelector('a[href="getting-started.md"].mkh-ext'), 'internal link not marked');
    A(resolveKey('../help/x.md#a', HELP_DIR + 'index.md').key === 'docs/help/x.md', 'relative links resolve');
    A(resolveKey('https://x.org', HELP_DIR + 'index.md') === null, 'web links are not pages');
  });
  T.register('help: keyboard shortcuts list is searchable and printable', async () => {
    const rows = shortcutRows();
    A(rows.length > 40, 'shortcut rows: ' + rows.length);
    A(rows.some(r => r.keys.includes('Ctrl+B')), 'Ctrl+B in the list');
    const html = shortcutsHtml(rows);
    A(/<table>/.test(html) && /Ctrl\+B/.test(html), 'printable HTML');
    const p = shortcuts({ query: 'bold' });
    const dlg = await waitDlg(/Keyboard shortcuts/);
    try {
      A(dlg, 'shortcuts dialog open');
      const shown = dlg.querySelectorAll('.mkh-kr').length;
      A(shown > 0 && shown < rows.length, 'search narrows the list: ' + shown);
    } finally { await closeTopDialog(); }
    await p;
  });
  T.register('help: What’s new reads the latest CHANGELOG section', async () => {
    const sample = '# Changelog\n\n## [Unreleased]\n\n## [1.2.0] - 2026-11-22\n\n### Added\n- Help tab\n\n## [1.1.0] - 2026-10-01\n\n- Older\n';
    const l = latestChanges(sample);
    A(l && l.version === '1.2.0' && l.date === '2026-11-22' && /Help tab/.test(l.body) && !/Older/.test(l.body), 'latest section: ' + JSON.stringify(l));
    const p = whatsNew();
    const dlg = await waitDlg(/What’s new/);
    try {
    A(dlg, 'What’s new opens');
    let real = null; try { real = latestChanges(await fetchText('CHANGELOG.md')); } catch {}
    if (real) { A(dlg.querySelector('.mkh-new-body')?.textContent.trim().length > 20, 'shows the latest changes'); await sleep(250); await shot('whats-new'); }
    } finally { await closeTopDialog(); }
    await p;
  });
  T.register('help: File → Help page has the links, tutorials and the About section', async () => {
    app.backstage.open('help');
    await sleep(700);
    const page = document.querySelector('.bs-page[data-page="help"]');
    A(page, 'File → Help page shown');
    for (const c of ['help.manual', 'help.tutorials', 'help.shortcuts', 'help.whatsNew', 'help.reportProblem', 'help.projectPage']) A(page.querySelector(`.mkh-card[data-tip-cmd="${c}"]`), 'card ' + c);
    A(/Copyright © 2026 Ahmed Bilal and contributors\./.test(page.textContent) && /Made by\s*Ahmed Bilal/.test(page.textContent), 'About section with copyright and made-by');
    if (app.tours?.list) A(page.querySelectorAll('.mkh-tour').length === app.tours.list().length, 'every tutorial listed');
    await shot('help-backstage');
    page.querySelector('.mkh-about')?.scrollIntoView({ block: 'center' }); await sleep(150);
    await shot('help-about');
    app.backstage.close(); await sleep(300);
  });
})();
