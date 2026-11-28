// Markooj — pictures from other editors, and a helpful card for pictures that are not found.
//
// Other Markdown editors write picture paths in many ways. All of these show in every mode, in print/PDF and in exports:
//   ![](C:/Users/me/AppData/Roaming/marktext/images/2026-11-24-image.png)   MarkText / Typora (absolute, forward slashes)
//   ![](C:\Users\me\Pictures\chart.png)   ![](<C:/My Docs/a b.png>)   ![](C:/My%20Docs/a%20b.png)   ![](C:/My Docs/a b.png)
//   ![](file:///C:/x/y.png)   ![](~/Pictures/x.png)   ![](/home/me/x.png)   ![](./assets/x.png)   ![](../x.png)
//   <img src="C:\pics\x.png">   ![[photo.png]] and ![[photo.png|300]] (Obsidian; found in the vault's usual folders)
// preload.js keeps such paths through the sanitizer and parses paths with spaces; src/core.js assetUrl turns them into
// markooj://local URLs (main.js serves only picture and media files, never network paths).
//
// app.pictures = {
//   absPath(doc, src) → '/'-separated absolute path | null     classify(src) → 'remote'|'data'|'local'|'empty'
//   fileUrl(abs) → 'file:///…'                                  relPath(docPath, abs) → path to write into the Markdown
//   sameSrc(a, b) → boolean                                     occurrences(text) → [{start, end, dest, form, …}]
//   replaceSrc(text, src, nth, newDest) → text | null           removeAt(text, src, nth) → text | null
//   exists(paths[]) → Promise<Map(path → boolean)>              nearby(doc, src) → Promise<abs path | null>
//   missing(el?) → [{img, src, abs, reason}]                    locate(img|item), remove(img|item), findMissing()
//   exportMarkdown(md, doc) → Promise<md>   (Pandoc exports)
// }
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const mk = window.mk || app.mk || {};
  const P = app.pictures = app.pictures || {};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, o) => app.ui?.toast?.(m, o);
  const PIC_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg'];
  const IS_WIN = (mk.platform || '') === 'win32';

  try {
    if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(l => /pictures\.css/.test(l.getAttribute('href') || ''))) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'pictures.css'; document.head.appendChild(l);
    }
  } catch {}

  // =================================================================== paths
  const decode = s => { try { return decodeURI(String(s)); } catch { return String(s); } };
  const home = () => String(mk.homeDir || '').replace(/\\/g, '/').replace(/\/+$/, '');
  // \\host\share, //host/x, \/ and /\ forms: never touched (opening them would contact another computer)
  const NETWORK = /^(?:[\\/]{2}|file:\/\/(?!\/|localhost\/))/i;
  P.classify = (src) => {
    const s = String(src || '').trim();
    if (!s) return 'empty';
    if (/^data:/i.test(s)) return 'data';
    if (/^(?:https?:)?\/\//i.test(s) && !/^\/\/\//.test(s)) return 'remote';
    if (/^(?:blob|markooj):/i.test(s)) return 'app';
    if (/^file:/i.test(s)) return NETWORK.test(s) ? 'remote' : 'local';
    if (/^[a-z][\w+.-]*:(?![\\/])/i.test(s) && !/^[A-Za-z]:/.test(s)) return 'remote'; // mailto:, ftp: …
    return 'local';
  };
  function normSegs(p) {
    const lead = /^[A-Za-z]:\//.exec(p) ? p.slice(0, 3) : p.startsWith('/') ? '/' : '';
    const out = [];
    for (const seg of p.slice(lead.length).split('/')) { if (seg === '..') out.pop(); else if (seg && seg !== '.') out.push(seg); }
    return lead + out.join('/');
  }
  /** The picture's absolute path ('/'-separated, decoded), or null for web pictures, data URIs, network paths and
   * relative paths of a document that was never saved. */
  P.absPath = (doc, src) => {
    let s = String(src ?? '').trim().replace(/^<|>$/g, '');
    if (P.classify(s) !== 'local' && !/^markooj:\/\/local\//i.test(s)) return null;
    if (/^markooj:\/\/local\//i.test(s)) s = s.replace(/^markooj:\/\/local\//i, IS_WIN ? '' : '/');
    s = s.replace(/^file:\/\/(?:localhost)?\/?(?=[A-Za-z]:[\\/])/i, '').replace(/^file:\/\/(?:localhost)?(?=\/)/i, '');
    s = decode(s).replace(/\\/g, '/');
    if (/^\/[A-Za-z]:\//.test(s)) s = s.slice(1);
    if (/^\/\//.test(s)) return null;
    if (/^~\//.test(s)) { const h = home(); if (!h) return null; s = h + s.slice(1); }
    if (/^[A-Za-z]:\//.test(s) || s.startsWith('/')) return normSegs(s);
    if (/^[A-Za-z]:/.test(s)) return null; // C:x.png (drive-relative): not a usable path
    if (!doc || !doc.path) return null;
    const dir = String(doc.path).replace(/\\/g, '/').replace(/\/[^/]*$/, '');
    return normSegs(dir + '/' + s);
  };
  const isAbsolute = s => { const t = decode(String(s || '').trim().replace(/^<|>$/g, '')).replace(/\\/g, '/'); return /^(?:[A-Za-z]:\/|\/|~\/|file:)/i.test(t); };
  P.fileUrl = (abs) => (/^[A-Za-z]:\//.test(abs) ? 'file:///' : 'file://') + encodeURI(abs).replace(/#/g, '%23').replace(/\?/g, '%3F');
  P.localUrl = (abs) => 'markooj://local/' + encodeURI(String(abs).replace(/^\/+/, '')).replace(/#/g, '%23').replace(/\?/g, '%3F');
  const dirOf = p => String(p || '').replace(/\\/g, '/').replace(/\/[^/]*$/, '');
  const baseOf = p => String(p || '').replace(/\\/g, '/').replace(/^.*\//, '');
  const sameFold = (a, b) => (IS_WIN ? a.toLowerCase() === b.toLowerCase() : a === b);
  /** What to write into the Markdown for a picture at `abs`: a relative path when it sits in the document's folder (or below). */
  P.relPath = (docPath, abs) => {
    const a = String(abs).replace(/\\/g, '/');
    if (!docPath) return a;
    const d = dirOf(docPath) + '/';
    if (a.length > d.length && sameFold(a.slice(0, d.length), d)) return a.slice(d.length);
    return a;
  };
  const mdDest = d => (/[\s()<>]/.test(d) ? `<${d}>` : d);
  /** Two ways of writing the same picture (encoded or not, backslashes, <…>, file:///). */
  const keyOf = s => {
    let t = String(s ?? '').trim().replace(/^<|>$/g, '');
    t = t.replace(/^file:\/\/(?:localhost)?\/?(?=[A-Za-z]:[\\/])/i, '').replace(/^file:\/\/(?:localhost)?(?=\/)/i, '');
    t = decode(t).replace(/\\/g, '/').replace(/^\.\//, '');
    if (/^~\//.test(t) && home()) t = home() + t.slice(1);
    return IS_WIN ? t.toLowerCase() : t;
  };
  P.sameSrc = (a, b) => keyOf(a) === keyOf(b);

  // =================================================================== finding pictures in the Markdown
  function codeRanges(text) {
    const out = [];
    const fence = /^[ \t]{0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n[ \t]{0,3}\1[ \t]*(?=\n|$)|$)/gm; let m;
    while ((m = fence.exec(text))) out.push([m.index, m.index + m[0].length]);
    const tick = /(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g;
    while ((m = tick.exec(text))) if (!out.some(r => m.index >= r[0] && m.index < r[1])) out.push([m.index, m.index + m[0].length]);
    return out;
  }
  /** Every picture in the text, in order: Markdown ![…](…), <img src>, Obsidian ![[…]]. */
  P.occurrences = (text) => {
    text = String(text || '');
    const code = codeRanges(text); const inCode = i => code.some(r => i >= r[0] && i < r[1]);
    const out = []; let m;
    const md = /!\[((?:[^[\]\n]|\[[^\]\n]*\])*)\]\([ \t]*(<[^>\n]*>|[^)\n]*?)([ \t]+"[^"\n]*")?[ \t]*\)(\{[^{}\n]*\})?/g;
    while ((m = md.exec(text))) {
      if (inCode(m.index)) continue;
      const destStart = m.index + m[0].indexOf('](') + 2 + (/^[ \t]*/.exec(m[0].slice(m[0].indexOf('](') + 2))[0].length);
      out.push({ form: 'md', start: m.index, end: m.index + m[0].length, dest: m[2], destStart, destEnd: destStart + m[2].length, alt: m[1] });
    }
    const html = /<img\b[^>]*?\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi;
    while ((m = html.exec(text))) {
      if (inCode(m.index)) continue;
      const v = m[2] ?? m[3] ?? m[4] ?? ''; const q = m[2] != null || m[3] != null ? 1 : 0;
      const destStart = m.index + m[0].indexOf(m[1]) + q;
      out.push({ form: 'html', start: m.index, end: m.index + m[0].length, dest: v, destStart, destEnd: destStart + v.length });
    }
    const wiki = /!\[\[([^\]|\n]+)(\|[^\]\n]*)?\]\]/g;
    while ((m = wiki.exec(text))) {
      if (inCode(m.index)) continue;
      out.push({ form: 'wiki', start: m.index, end: m.index + m[0].length, dest: m[1].trim(), destStart: m.index + 3, destEnd: m.index + 3 + m[1].length, opt: m[2] || '' });
    }
    return out.sort((a, b) => a.start - b.start);
  };
  function findOcc(text, src, nth = 0) {
    const all = P.occurrences(text).filter(o => P.sameSrc(o.dest, src));
    return all[Math.min(nth, all.length - 1)] || null;
  }
  /** Points the n-th picture written as `src` at `newDest` (kept in the same form: Markdown, HTML or Obsidian). */
  P.replaceSrc = (text, src, nth, newDest) => {
    const o = findOcc(text, src, nth); if (!o) return null;
    const d = String(newDest).replace(/\\/g, '/');
    const put = o.form === 'md' ? mdDest(d) : o.form === 'html' ? d.replace(/"/g, '%22') : d;
    return text.slice(0, o.destStart) + put + text.slice(o.destEnd);
  };
  /** Removes the n-th picture written as `src` (with its {#fig:…} label). */
  P.removeAt = (text, src, nth) => {
    const o = findOcc(text, src, nth); if (!o) return null;
    let a = o.start, b = o.end;
    const ls = text.lastIndexOf('\n', a - 1) + 1; let le = text.indexOf('\n', b); if (le < 0) le = text.length;
    if (!text.slice(ls, a).trim() && !text.slice(b, le).trim()) {
      // the picture had the line to itself: take the line, and one blank line, away
      a = ls; b = le < text.length ? le + 1 : le;
      if (b < text.length && text[b] === '\n' && (a === 0 || text[a - 1] === '\n')) b++;
      else if (b >= text.length && a > 0) a--;
    } else if (text[b] === ' ' && (a === ls || text[a - 1] === ' ')) b++;
    return text.slice(0, a) + text.slice(b);
  };

  // =================================================================== does the file exist? (file-info: null when missing)
  const known = new Map(); // path → {ok, at}
  const TTL = 4000;
  P.exists = async (paths) => {
    const res = new Map(); const now = Date.now(); const ask = [];
    for (const p of new Set(paths.filter(Boolean))) {
      const k = known.get(p); if (k && now - k.at < TTL) res.set(p, k.ok); else ask.push(p);
    }
    await Promise.all(ask.map(async p => {
      let ok = false;
      if (!/^[\\/]{2}/.test(p)) { try { const st = await mk.invoke('file-info', p); ok = !!(st && st.exists !== false && st.size > 0); } catch { ok = false; } }
      known.set(p, { ok, at: Date.now() }); res.set(p, ok);
    }));
    return res;
  };
  P.forget = () => known.clear();
  addEventListener('focus', () => known.clear());
  // Obsidian and moved documents: look for the file name in the usual picture folders next to the document
  const NEAR = ['', 'assets/', 'attachments/', 'Attachments/', 'images/', 'img/', 'media/', '_resources/', 'pictures/', 'figures/'];
  P.nearby = async (doc, src) => {
    if (!doc || !doc.path) return null;
    const name = decode(baseOf(String(src).replace(/^<|>$/g, '').split(/[?#]/)[0])); if (!name) return null;
    const dirs = []; let d = dirOf(doc.path);
    for (let up = 0; up < 3 && d; up++) { dirs.push(d); const nd = dirOf(d); if (nd === d) break; d = nd; }
    const cands = []; for (const dir of dirs) for (const sub of NEAR) cands.push(normSegs(dir + '/' + sub + name));
    const ex = await P.exists(cands);
    return cands.find(c => ex.get(c)) || null;
  };

  // =================================================================== painting: missing-picture cards
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 3 3 3-3 5 5"/><path d="M15 4 9 20" stroke-dasharray="2 2"/></svg>';
  const srcOf = img => img.getAttribute('data-mk-pic') || img.getAttribute('data-mk-src') || img.getAttribute('src') || '';
  const docOf = (el, doc) => doc || app.docs?.active?.() || null;
  function nthOf(img, root) {
    const s = srcOf(img); let n = 0;
    for (const x of root.querySelectorAll('img')) { if (x === img) return n; if (!x.closest('.mk-front') && P.sameSrc(srcOf(x), s)) n++; }
    return n;
  }
  function cardFor(img, info, doc) {
    const card = document.createElement('span');
    card.className = 'mk-pic-missing'; card.setAttribute('data-mk-ui', ''); card.setAttribute('contenteditable', 'false');
    card.setAttribute('role', 'group');
    const shown = decode(String(info.src).replace(/^<|>$/g, ''));
    const ro = !!(doc && doc.readOnly);
    let text, acts;
    if (info.reason === 'unsaved') {
      card.setAttribute('aria-label', app.t('Picture not shown yet'));
      text = `<b>${app.th('Save this document to show this picture.')}</b> ${app.t('Its path, {path}, starts at the document’s folder.', { path: '\u0001' }).split('\u0001').map(esc).join(`<code>${esc(shown)}</code>`)}`;
      acts = (ro ? [] : [['save', app.t('Save…'), true], ['locate', app.t('Locate…')]]);
    } else {
      card.setAttribute('aria-label', app.t('Picture not found'));
      text = `<b>${app.th('Find this picture:')}</b> ${app.t('it was at {path}', { path: '\u0001' }).split('\u0001').map(esc).join(`<code>${esc(info.abs || shown)}</code>`)}`;
      acts = ro ? [] : [['locate', app.t('Locate…'), true], ['remove', app.t('Remove')]];
    }
    const alt = (img.getAttribute('alt') || '').trim();
    card.innerHTML = `<span class="mk-pic-ic">${ICON}</span><span class="mk-pic-t">${text}${alt ? `<span class="mk-pic-alt">${esc(alt)}</span>` : ''}${ro ? `<span class="mk-pic-alt">${app.th('This document is read-only. Open an editable copy to fix the path.')}</span>` : ''}</span>` +
      (acts.length ? `<span class="mk-pic-acts">${acts.map(([a, l, p]) => `<button type="button" class="mk-pic-btn${p ? ' primary' : ''}" data-pic-act="${a}" tabindex="0">${esc(l)}</button>`).join('')}</span>` : '');
    card.title = info.reason === 'unsaved' ? app.t('Pictures with a relative path need a saved document.') : app.t('Markooj could not find this picture file. Locate it, or remove the picture from the document.');
    return card;
  }
  function clearCard(img) {
    const n = img.nextElementSibling; if (n && n.classList.contains('mk-pic-missing')) n.remove();
    img.classList.remove('mk-pic-gone');
  }
  async function paint(el, doc) {
    const exportStage = !!el.classList?.contains('mk-export-stage');
    const imgs = [...el.querySelectorAll('img')].filter(i => !i.closest('.mk-front,[data-mk-ui],.mkx-card,.mk-pic-missing'));
    if (!imgs.length) return;
    const items = [];
    for (const img of imgs) {
      let src = img.getAttribute('data-mk-src') ?? img.getAttribute('src') ?? '';
      if (img.classList.contains('mk-wiki-embed')) { const raw = /^!\[\[([^\]|]+)/.exec(img.getAttribute('data-raw') || ''); if (raw) src = raw[1].trim(); }
      if (!exportStage && !img.hasAttribute('data-mk-pic')) img.setAttribute('data-mk-pic', src);
      const cls = P.classify(src);
      if (cls !== 'local') { clearCard(img); continue; }
      const abs = P.absPath(doc, src);
      items.push({ img, src, abs, wiki: img.classList.contains('mk-wiki-embed'), reason: abs ? 'missing' : (doc && doc.path ? 'missing' : 'unsaved') });
    }
    if (!items.length) return;
    const ex = await P.exists(items.map(i => i.abs));
    for (const it of items) {
      let ok = it.abs && ex.get(it.abs);
      if (!ok && doc && doc.path) { const f = await P.nearby(doc, it.src); if (f) { it.abs = f; ok = true; it.found = true; } }
      if (ok) {
        clearCard(it.img);
        // HTML export: relative pictures stay relative (the page works next to the document); the rest get file:/// URLs
        // (kept in data-mk-file-src: the exporter sets it as src outside the live window, which may not load file:/// itself)
        if (exportStage) { if (it.found || it.wiki || isAbsolute(it.src)) it.img.setAttribute('data-mk-file-src', P.fileUrl(it.abs)); }
        else {
          const want = P.localUrl(it.abs);
          if (it.img.getAttribute('src') !== want) { if (!it.img.hasAttribute('data-mk-src')) it.img.setAttribute('data-mk-src', it.src); it.img.setAttribute('src', want); }
        }
        if (it.found && !exportStage) it.img.title = app.t('Found in {folder}', { folder: dirOf(it.abs) });
        continue;
      }
      if (exportStage) continue; // exports and print never show the card
      it.img.classList.add('mk-pic-gone');
      const n = it.img.nextElementSibling;
      if (n && n.classList.contains('mk-pic-missing')) n.remove();
      it.img.after(cardFor(it.img, it, doc));
    }
    // status bar: only the page the user is looking at counts (not test pages or previews in dialogs)
    if (!exportStage) { const s = surface(); if (s && (s === el || s.contains(el) || el.contains(s))) { lastMissing = s.querySelectorAll('.mk-pic-missing').length; app.status?.refresh?.(); } }
  }
  let lastMissing = 0;
  P.paint = paint;
  app.hooks.postRender(async (el, doc) => { if (el && el.querySelectorAll) { try { await paint(el, docOf(el, doc)); } catch (e) { console.warn('pictures', e); } } });

  // =================================================================== actions: Locate…, Remove, Save
  const surface = () => { const e = app.editors.active(); try { const s = e?.getSurface?.() || e?.page; if (s && s.isConnected) return s; } catch {} return document.querySelector('.mk-page:not(.mk-export-stage)'); };
  P.missing = (root = surface()) => (root ? [...root.querySelectorAll('img.mk-pic-gone')].map(img => {
    const card = img.nextElementSibling;
    return { img, src: srcOf(img), nth: nthOf(img, root), unsaved: !!card?.querySelector('[data-pic-act="save"]'), abs: P.absPath(app.docs.active(), srcOf(img)) };
  }) : []);
  function commit(doc, next, msg, undoText) {
    if (next == null || next === doc.text) return false;
    const before = doc.text;
    try { app.editors.active()?.flush?.(); } catch {}
    doc.setText(next, 'pictures');
    P.forget();
    try { app.editors.active()?.refresh?.(); } catch {}
    toast(msg, { kind: 'info', actions: [{ label: app.t('Undo'), run: () => { if (doc.text === next) { doc.setText(before, 'pictures'); try { app.editors.active()?.refresh?.(); } catch {} } } }] });
    void undoText;
    return true;
  }
  P.locate = async (target) => {
    const doc = app.docs.active(); if (!doc || doc.kind !== 'markdown') return null;
    if (doc.readOnly) { toast(app.t('Open an editable copy to fix this picture. This document is read-only.'), { kind: 'info' }); return null; }
    const item = target && target.img ? target : P.missing().find(m => m.img === target) || (target && { img: target, src: srcOf(target), nth: nthOf(target, surface() || document) });
    if (!item) return null;
    let file = null;
    try { file = await mk.invoke('pick-file', [{ name: app.t('Pictures'), extensions: PIC_EXT }], { title: app.t('Find the picture'), defaultPath: doc.path ? dirOf(doc.path).replace(/\//g, IS_WIN ? '\\' : '/') : undefined }); }
    catch (e) { app.ui?.fail ? app.ui.fail(e, { lead: app.t('Try Locate again, or drag the picture onto the page.') }) : toast(app.t('Try Locate again, or drag the picture onto the page. The file picker did not open.'), { kind: 'warn' }); return null; }
    if (!file) return null;
    return P.relink(doc, item, file);
  };
  /** Points a missing picture at `file`; other missing pictures with a file of the same name in that folder are fixed too. */
  P.relink = async (doc, item, file) => {
    const abs = String(file).replace(/\\/g, '/');
    let next = P.replaceSrc(doc.text, item.src, item.nth || 0, P.relPath(doc.path, abs));
    if (next == null) { toast(app.t('Use Simple mode (Ctrl+3) to change this picture’s path yourself. Markooj could not find it in the text.'), { kind: 'warn' }); return null; }
    // the same folder may hold the other missing pictures (a document moved without its pictures folder)
    let more = 0;
    const others = P.missing().filter(m => m.img !== item.img && !P.sameSrc(m.src, item.src));
    if (others.length) {
      const folder = dirOf(abs);
      const cands = others.map(m => ({ m, f: folder + '/' + decode(baseOf(m.src.split(/[?#]/)[0])) }));
      const ex = await P.exists(cands.map(c => c.f));
      for (const c of cands) { if (!ex.get(c.f)) continue; const t = P.replaceSrc(next, c.m.src, 0, P.relPath(doc.path, c.f)); if (t != null) { next = t; more++; } }
    }
    commit(doc, next, more ? app.tn('Picture found. {count} more pictures were in the same folder, so they are fixed too.', more) : app.t('Picture found. The document now points to it.'));
    return next;
  };
  P.remove = async (target) => {
    const doc = app.docs.active(); if (!doc || doc.readOnly) return null;
    const item = target && target.img ? target : { img: target, src: srcOf(target), nth: nthOf(target, surface() || document) };
    const next = P.removeAt(doc.text, item.src, item.nth || 0);
    if (next == null) { toast(app.t('Use Simple mode (Ctrl+3) to delete this picture yourself. Markooj could not find it in the text.'), { kind: 'warn' }); return null; }
    commit(doc, next, app.t('Picture removed from the document.'));
    return next;
  };
  document.addEventListener('mousedown', e => { if (e.target.closest?.('.mk-pic-missing button')) e.preventDefault(); }, true);
  document.addEventListener('click', e => {
    const b = e.target.closest?.('.mk-pic-missing [data-pic-act]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const img = b.closest('.mk-pic-missing').previousElementSibling; if (!img || img.tagName !== 'IMG') return;
    const act = b.getAttribute('data-pic-act');
    if (act === 'locate') P.locate(img);
    else if (act === 'remove') P.remove(img);
    else if (act === 'save') app.commands.run('file.save');
  }, true);
  document.addEventListener('keydown', e => {
    const b = e.target.closest?.('.mk-pic-missing [data-pic-act]'); if (!b || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault(); e.stopPropagation(); b.click();
  }, true);

  /** A list of every missing picture in the document, with Locate… / Remove / Go to (keyboard path; Alt+Q → "missing pictures"). */
  P.findMissing = async () => {
    const doc = app.docs.active();
    if (!doc || doc.kind !== 'markdown') { toast(app.t('Open a Markdown document first, then look for missing pictures.'), { kind: 'info' }); return; }
    const list = P.missing();
    if (!list.length) { toast(app.t('Every picture in this document was found.'), { kind: 'info' }); return; }
    const body = document.createElement('div'); body.className = 'mk-pic-list';
    body.innerHTML = `<p class="mk-pic-lead">${app.th('Locate each picture, or remove it. When several pictures sit in one folder, finding one fixes the others.')}</p>` +
      list.map((m, i) => `<div class="mk-pic-row"><code title="${esc(m.abs || m.src)}">${esc(decode(m.abs || m.src))}</code><span class="mk-pic-acts">
        <button type="button" class="btn sm" data-i="${i}" data-a="go">${app.th('Go to')}</button>${m.unsaved ? `<button type="button" class="btn sm primary" data-i="${i}" data-a="save">${app.th('Save…')}</button>` : ''}
        <button type="button" class="btn sm${m.unsaved ? '' : ' primary'}" data-i="${i}" data-a="locate">${app.th('Locate…')}</button>${m.unsaved ? '' : `<button type="button" class="btn sm" data-i="${i}" data-a="remove">${app.th('Remove')}</button>`}</span></div>`).join('');
    let close = null;
    body.addEventListener('click', async e => {
      const b = e.target.closest('button[data-a]'); if (!b) return;
      const m = list[+b.dataset.i]; const a = b.dataset.a;
      if (a === 'go') { m.img.nextElementSibling?.scrollIntoView({ behavior: 'smooth', block: 'center' }); m.img.nextElementSibling?.querySelector('button')?.focus({ preventScroll: true }); close?.(); return; }
      close?.();
      if (a === 'locate') await P.locate(m); else if (a === 'remove') await P.remove(m); else if (a === 'save') app.commands.run('file.save');
    });
    const p = app.ui.dialog({ title: app.tn('{count} pictures are missing', list.length), body, icon: 'image', buttons: [{ label: app.t('Close'), value: null, primary: true }] });
    close = () => { try { body.closest('.dlg')?.querySelector('.btn.primary:not([data-a])')?.click(); } catch {} };
    setTimeout(() => body.querySelector('button[data-a="locate"],button[data-a="save"]')?.focus(), 60);
    return p;
  };

  app.commands.register('pictures.findMissing', {
    label: app.tm('Find Missing Pictures'), icon: 'image', category: 'Insert',
    description: app.tm('List the pictures this document points to that are not on this computer, and locate or remove them.'),
    isEnabled: () => !!app.docs.active() && app.docs.active().kind === 'markdown',
    run: () => P.findMissing(),
  });
  try { app.tooltips?.register?.('pictures.findMissing', { title: app.tm('Find Missing Pictures'), description: app.tm('List pictures that are not on this computer. Locate one and the others in the same folder are fixed too.'), markdown: '![](C:/Users/…/image.png)' }); } catch {}
  try { app.ribbon.addGroup('insert', { id: 'pictures-find', label: app.tm('Pictures'), order: 11, items: [{ type: 'small', command: 'pictures.findMissing', label: app.tm('Find Missing Pictures'), icon: 'image', showLabel: true }] }); } catch {}
  // status bar: shown only while pictures are missing
  try {
    app.status.addItem({
      id: 'pictures-missing', side: 'left', order: 46,
      render(el) {
        el.innerHTML = '';
        el.hidden = !lastMissing;
        if (!lastMissing) return;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'sb-item mk-pic-sb';
        b.textContent = app.tn('Find {count} missing pictures', lastMissing);
        b.setAttribute('data-tip', app.t('Locate or remove pictures that are not on this computer'));
        b.addEventListener('click', () => P.findMissing());
        el.appendChild(b);
      },
    });
  } catch {}
  // the cards for missing pictures carry interface text: paint them again in the new language
  app.events.on('i18n:changed', () => { const s = surface(); if (s && s.querySelector('.mk-pic-missing')) Promise.resolve(paint(s, app.docs.active())).catch(() => {}); });
  app.events.on('doc:active', () => { lastMissing = 0; setTimeout(() => { const s = surface(); lastMissing = s ? s.querySelectorAll('.mk-pic-missing').length : 0; app.status?.refresh?.(); }, 400); });

  // =================================================================== exports
  // HTML/PDF/print: the export stage gets file:/// URLs (decorate runs the postRender hook above with .mk-export-stage).
  // Pandoc (Word, ODT, EPUB, LaTeX …): every local picture path becomes one Pandoc reads: absolute with "/", no file://, no ~,
  // <…> around spaces; Obsidian embeds become ordinary pictures; pictures found in a nearby folder use that path.
  P.exportMarkdown = async (md, doc) => {
    const occ = P.occurrences(md); if (!occ.length) return md;
    let out = md;
    for (const o of occ.slice().reverse()) {
      const src = o.dest.replace(/^<|>$/g, '');
      if (P.classify(src) !== 'local') continue;
      let abs = P.absPath(doc, src);
      let ok = abs ? (await P.exists([abs])).get(abs) : false;
      if (!ok) { const f = await P.nearby(doc, src); if (f) { abs = f; ok = true; } }
      const needs = o.form === 'wiki' || ok && (isAbsolute(src) || /\\|%20|\s/.test(src)) || (!ok && /^file:|^~/.test(src));
      if (!needs || !abs) continue;
      const dest = ok && !isAbsolute(src) && o.form !== 'wiki' ? P.relPath(doc && doc.path, abs) : abs;
      if (o.form === 'wiki') {
        const w = /^\|(\d+)(?:x(\d+))?$/.exec(o.opt || ''); const alt = !w && o.opt ? o.opt.slice(1) : '';
        out = out.slice(0, o.start) + `![${alt}](${mdDest(dest)})${w ? `{width=${w[1]}px}` : ''}` + out.slice(o.end);
      } else if (o.form === 'md') out = out.slice(0, o.destStart) + mdDest(dest) + out.slice(o.destEnd);
      else out = out.slice(0, o.destStart) + dest.replace(/"/g, '%22') + out.slice(o.destEnd);
    }
    return out;
  };
  try { app.exporter?.addMarkdownTransform?.((md, ctx = {}) => P.exportMarkdown(md, ctx.doc)); } catch {}

  // =================================================================== smoke tests
  const A = (c, m) => app.assert(c, m);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function until(fn, ms = 5000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch {} await sleep(40); } return false; }
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP4z8DwHwyBNEgUAgYAXu8F+2zO3tMAAAAASUVORK5CYII=';
  // a real picture at an absolute path with spaces: <userData>/pictures smoke/My Docs/assets/pic.png
  async function tempPicture() {
    const rec = String(await mk.invoke('recovery-dir')).replace(/\\/g, '/');
    const docPath = rec.replace(/\/[^/]*$/, '') + '/pictures smoke/My Docs/paper.md';
    const rel = await mk.invoke('save-asset', { docPath, name: 'pic.png', data: PNG });
    return { docPath, rel, abs: dirOf(docPath) + '/' + rel };
  }

  app.tests.register('pictures: paths from other editors resolve (MarkText, backslashes, spaces, %20, file:///, ~, relative)', () => {
    const d = { path: 'C:\\Papers\\My draft\\paper.md' };
    const eq = (a, b, w) => A(a === b, `${w}: got ${a}, want ${b}`);
    eq(P.absPath(d, 'C:/Users/Dell/AppData/Roaming/marktext/images/2026-11-24-21-49-30-image.png'), 'C:/Users/Dell/AppData/Roaming/marktext/images/2026-11-24-21-49-30-image.png', 'MarkText');
    eq(P.absPath(d, 'C:\\pics\\with space\\x.png'), 'C:/pics/with space/x.png', 'backslashes');
    eq(P.absPath(d, 'C:/My%20Docs/a%20b.png'), 'C:/My Docs/a b.png', '%20');
    eq(P.absPath(d, '<C:/My Docs/a b.png>'), 'C:/My Docs/a b.png', '<…>');
    eq(P.absPath(d, 'file:///C:/x/y.png'), 'C:/x/y.png', 'file:///');
    eq(P.absPath(d, 'file:///home/me/y.png'), '/home/me/y.png', 'file:/// POSIX');
    eq(P.absPath(d, '/home/me/y.png'), '/home/me/y.png', 'POSIX absolute');
    eq(P.absPath(d, './assets/x.png'), 'C:/Papers/My draft/assets/x.png', './');
    eq(P.absPath(d, 'assets/x.png'), 'C:/Papers/My draft/assets/x.png', 'relative');
    eq(P.absPath(d, '../x.png'), 'C:/Papers/x.png', '../');
    A(P.absPath(d, '\\\\server\\share\\x.png') === null && P.absPath(d, '//server/x.png') === null && P.absPath(d, 'file://server/x.png') === null, 'network paths are never used');
    A(P.absPath(d, 'https://example.com/x.png') === null && P.absPath({}, 'a.png') === null, 'web pictures and unsaved relative paths');
    if (home()) eq(P.absPath(d, '~/Pictures/x.png'), home() + '/Pictures/x.png', '~/');
    // core: every form becomes a markooj://local URL
    eq(app.assetUrl(d, 'file:///C:/x/y.png'), 'markooj://local/C:/x/y.png', 'assetUrl file:///');
    eq(app.assetUrl(d, 'C:/Users/Dell/AppData/Roaming/marktext/images/a.png'), 'markooj://local/C:/Users/Dell/AppData/Roaming/marktext/images/a.png', 'assetUrl MarkText');
    A(app.assetUrl(d, 'file://server/x.png') === null, 'assetUrl never takes file://host');
    if (home()) A(app.assetUrl(d, '~/Pictures/x.png') === 'markooj://local/' + encodeURI(home().replace(/^\/+/, '') + '/Pictures/x.png'), 'assetUrl ~: ' + app.assetUrl(d, '~/Pictures/x.png'));
    // the renderer keeps each form (DOMPurify used to drop C:/… and file:/// was not a picture)
    // an inert document: nothing loads (a live <div> would try C:/… as a URL and log an error)
    const box = new DOMParser().parseFromString('<div></div>', 'text/html').body.firstChild;
    box.innerHTML = mk.render('![a](C:/Users/Dell/AppData/Roaming/marktext/images/x.png)\n\n![b](C:\\pics\\x.png)\n\n![c](C:/My Docs/a b.png)\n\n![d](file:///C:/x/y.png)\n\n<img src="C:\\pics\\h.png">\n\n![[photo.png|300]]\n\n`![code](C:/x y.png)`').html;
    const srcs = [...box.querySelectorAll('img')].map(i => i.getAttribute('src'));
    A(srcs.length === 6, 'six pictures drawn: ' + JSON.stringify(srcs));
    A(srcs.every(Boolean), 'every picture keeps its src: ' + JSON.stringify(srcs));
    A(P.sameSrc(srcs[2], 'C:/My Docs/a b.png') && P.sameSrc(srcs[3], 'C:/x/y.png') && P.sameSrc(srcs[1], 'C:\\pics\\x.png'), 'paths: ' + JSON.stringify(srcs));
    const wiki = box.querySelector('img.mk-wiki-embed'); A(wiki && wiki.getAttribute('width') === '300' && wiki.getAttribute('data-raw') === '![[photo.png|300]]', 'Obsidian embed');
    A(box.querySelector('code').textContent === '![code](C:/x y.png)', 'code is left alone');
    if (mk.toMarkdown) A(/!\[\[photo\.png\|300\]\]/.test(mk.toMarkdown(wiki.outerHTML)), 'Obsidian embed round-trips: ' + mk.toMarkdown(wiki.outerHTML));
    // finding and rewriting a picture in the Markdown
    const t = 'A ![x](C:\\pics\\a.png) b\n\n![y](<C:/My Docs/a b.png>){#fig:y}\n\n<img src="C:/pics/a.png" width=20>\n\n![[photo.png]]\n\n```\n![z](C:/pics/a.png)\n```\n';
    eq(P.occurrences(t).length, 4, 'occurrences (code skipped)');
    eq(P.replaceSrc(t, 'C:/pics/a.png', 1, 'assets/a.png').split('\n')[4], '<img src="assets/a.png" width=20>', 'second a.png is the HTML one');
    eq(P.replaceSrc(t, 'C:/My%20Docs/a%20b.png', 0, 'C:/New Folder/b.png').split('\n')[2], '![y](<C:/New Folder/b.png>){#fig:y}', 'keeps the label, adds <…>');
    eq(P.removeAt(t, 'C:/My Docs/a b.png', 0), 'A ![x](C:\\pics\\a.png) b\n\n<img src="C:/pics/a.png" width=20>\n\n![[photo.png]]\n\n```\n![z](C:/pics/a.png)\n```\n', 'remove a picture line');
    eq(P.removeAt(t, 'C:\\pics\\a.png', 0).split('\n')[0], 'A b', 'remove a picture inside a sentence');
    eq(P.relPath('C:/Papers/My draft/paper.md', 'C:/Papers/My draft/assets/x.png'), 'assets/x.png', 'relative when inside');
    eq(P.relPath('C:/Papers/paper.md', 'D:/x.png'), 'D:/x.png', 'absolute when elsewhere');
  });

  async function inMode(make, text, docPath, fn) {
    const E = app.editor; if (!E?.[make] || !E.fakeDoc) return;
    const host = E._offscreen(); const ed = E[make](); const d = E.fakeDoc(text); d.path = docPath;
    try {
      ed.mount(host, d);
      await until(() => host.querySelectorAll('.mk-page img').length > 0, 6000);
      await sleep(250);
      return await fn(host, d, ed);
    } finally { try { ed.unmount(); } catch {} host.remove(); }
  }
  const loaded = img => new Promise(r => { if (img.complete) return r(img.naturalWidth > 0); img.onload = () => r(true); img.onerror = () => r(false); setTimeout(() => r(img.naturalWidth > 0), 3000); });

  app.tests.register('pictures: a real picture at an absolute path shows in Word, Inline, Simple and Read modes', async () => {
    if (!mk.invoke) return;
    const t = await tempPicture();
    const w = t.abs.replace(/\//g, '\\');
    const text = [`![MarkText](${t.abs})`, '', `![Back](${w})`, '', `![Spaces](${t.abs.replace(/ /g, '%20')})`, '', `![File](file:///${t.abs.replace(/^\//, '')})`, '', `<img src="${w}" alt="HTML">`, '', `![Rel](./${t.rel})`, '', `![Plain spaces](${t.abs})`, ''].join('\n');
    for (const make of ['createWord', 'createInline', 'createSimple', 'createRead']) {
      await inMode(make, text, t.docPath, async (host) => {
        const imgs = [...host.querySelectorAll('.mk-page img')];
        A(imgs.length === 7, `${make}: seven pictures drawn, got ${imgs.length}`);
        const ok = await Promise.all(imgs.map(loaded));
        const bad = imgs.filter((_, i) => !ok[i]).map(i => i.getAttribute('alt') + ' → ' + i.getAttribute('src'));
        A(!bad.length, `${make}: pictures that did not load: ${bad.join(', ')}`);
        A(!host.querySelector('.mk-pic-missing'), `${make}: no missing-picture card`);
      });
    }
  });

  app.tests.register('pictures: print/PDF, HTML and Word (DOCX) exports carry the pictures', async () => {
    if (!mk.invoke || !app.exporter?.buildHtml) return;
    const t = await tempPicture();
    const doc = app.editor.fakeDoc(`# Pictures\n\n![One](${t.abs})\n\n![Two](${t.abs.replace(/\//g, '\\')})\n\n![Three](${t.rel})\n`); doc.path = t.docPath; doc.title = 'Pictures';
    const print = await app.exporter.buildHtml(doc, { forPrint: true });
    const ps = [...print.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => m[1]);
    A(ps.length === 3 && ps.every(s => /^(markooj:\/\/local\/|file:\/\/)/.test(s)), 'print: local pictures load from disk: ' + JSON.stringify(ps));
    const html = await app.exporter.buildHtml(doc, {});
    const hs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => m[1]);
    A(hs[0].startsWith('file:///') && hs[1].startsWith('file:///') && hs[2] === t.rel, 'HTML: absolute → file:///, relative stays: ' + JSON.stringify(hs));
    const md = await P.exportMarkdown(doc.text.replace(t.abs.replace(/\//g, '\\'), t.abs.replace(/\//g, '\\')), doc);
    A(!/\\/.test(md.split('\n').filter(l => l.startsWith('![')).join('')), 'Pandoc gets forward slashes: ' + md);
    // a real Word file, when Pandoc is here
    let fmts = []; try { fmts = await mk.invoke('export-formats'); } catch {}
    // the Pandoc path only (a slim copy without the Pandoc feature writes DOCX with its built-in engine from the HTML)
    if (!fmts.some(f => f.id === 'docx' && f.available && f.engine === 'pandoc')) return;
    const out = dirOf(t.docPath) + '/pictures.docx';
    const pmd = await app.exporter.exportMarkdown(doc, 'docx');
    await mk.invoke('export', { format: 'docx', out, md: pmd, html: '', title: 'Pictures', meta: {}, docPath: t.docPath, path: t.docPath });
    const names = await mk.invoke('smoke-zip-text', out, null);
    A(names.filter(n => /^word\/media\//.test(n)).length >= 1, 'DOCX holds the pictures: ' + names.filter(n => /media/.test(n)).join(', '));
  });

  app.tests.register('pictures: a missing picture shows "Find this picture" with Locate… and Remove, and Remove edits the Markdown', async () => {
    const t = mk.invoke ? await tempPicture() : { docPath: 'C:/x/paper.md', abs: 'C:/x/pic.png', rel: 'pic.png' };
    const gone = dirOf(t.docPath) + '/no such folder/lost picture.png';
    const text = `Intro.\n\n![Lost](${gone})\n\nText ![ok](${t.abs}) after.\n`;
    await inMode('createWord', text, t.docPath, async (host, d, ed) => {
      await until(() => host.querySelector('.mk-pic-missing'), 4000);
      const card = host.querySelector('.mk-pic-missing');
      A(card, 'card shown');
      A(/^Find this picture: it was at /.test(card.querySelector('.mk-pic-t').textContent), 'solution first: ' + card.textContent);
      A(card.textContent.includes(gone), 'names the old path');
      A([...card.querySelectorAll('button')].map(b => b.textContent).join('|') === 'Locate…|Remove', 'buttons: ' + [...card.querySelectorAll('button')].map(b => b.textContent).join('|'));
      A(card.hasAttribute('data-mk-ui') && card.getAttribute('contenteditable') === 'false', 'never part of the Markdown');
      try { await app.mk.invoke('smoke-shot', 'picture-missing'); } catch {}
      // the card must not change the Markdown when Word mode writes the page back
      ed.flush?.(); await sleep(50);
      A(d.text === text, 'Word mode leaves the text alone: ' + JSON.stringify(d.text));
      // Remove / Locate work on the text
      const img = card.previousElementSibling;
      const item = { img, src: srcOf(img), nth: 0 };
      A(P.removeAt(d.text, item.src, 0) === `Intro.\n\nText ![ok](${t.abs}) after.\n`, 'Remove takes the picture line away');
      const moved = P.replaceSrc(d.text, item.src, 0, P.relPath(t.docPath, t.abs));
      A(moved.includes(`![Lost](${t.rel})`), 'Locate writes a path relative to the document: ' + moved);
    });
    // unsaved document with a relative path: Save first
    await inMode('createRead', '![Rel](assets/x.png)\n', null, async (host) => {
      await until(() => host.querySelector('.mk-pic-missing'), 3000);
      const card = host.querySelector('.mk-pic-missing');
      A(card && /^Save this document to show this picture\./.test(card.textContent), 'unsaved: ' + (card && card.textContent));
    });
  });
})();
