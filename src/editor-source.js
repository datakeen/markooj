// Markooj — Simple mode: Markdown source (highlighted, line numbers, smart editing) + live preview.
// Also hosts small helpers shared by the editor role (app.editor.*): front matter, shortcuts, images, CSS.
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const mk = app.mk || window.mk || {};
  const E = app.editor = app.editor || {};

  // ------------------------------------------------------------------ shared helpers
  E.injectCSS = (id, css) => {
    let el = document.getElementById(id);
    if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
    el.textContent = css;
  };
  E.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Front matter: same rules as preload's splitFrontMatter so data-line numbers line up.
  // Delegates to preload (YAML must parse to an object, MMD needs "key: value"), so a file that opens with a
  // horizontal rule or a URL is never mistaken for front matter. The regex below is only a fallback.
  E.splitFrontMatter = (text) => {
    text = text || '';
    try { const f = mk.frontMatter?.parse?.(text); if (f && typeof f.body === 'string') return { raw: f.raw || '', body: f.body, style: f.style || null }; } catch {}
    const m = /^---\r?\n([\s\S]*?)\r?\n(---|\.\.\.)\r?\n?/.exec(text);
    if (m) return { raw: m[0], body: text.slice(m[0].length), style: 'yaml' };
    const mm = /^((?:[A-Za-z][\w -]*:[^\n]*\n)+)\n/.exec(text);
    if (mm && !/^#/.test(text)) return { raw: mm[0], body: text.slice(mm[0].length), style: 'mmd' };
    return { raw: '', body: text, style: null };
  };
  E.frontMatterLines = (text) => (E.splitFrontMatter(text).raw.match(/\n/g) || []).length;
  const yamlValue = v => {
    v = String(v);
    return /^[\w .,/@()+-]*$/.test(v) && !/^[\s-]|:\s|\s$/.test(v) && v !== '' ? v : JSON.stringify(v);
  };
  // Set (or delete with null/undefined) top-level keys in YAML front matter, touching only those lines.
  E.setFrontMatter = (text, patch) => {
    const fm = E.splitFrontMatter(text);
    let lines, body = fm.body, eol = /\r\n/.test(text) ? '\r\n' : '\n';
    if (fm.style === 'yaml') {
      const inner = fm.raw.replace(/^﻿?---[ \t]*\r?\n/, '').replace(/(?:^|\r?\n)(?:---|\.\.\.)[ \t]*(?:\r?\n)?$/, '');
      lines = inner === '' ? [] : inner.split(/\r?\n/);
    } else if (fm.style === 'mmd') {
      lines = fm.raw.replace(/\n+$/, '').split(/\r?\n/);
      body = fm.body;
    } else { lines = []; }
    for (const [key, val] of Object.entries(patch)) {
      const re = new RegExp('^' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:', 'i');
      let idx = lines.findIndex(l => re.test(l));
      // remove list continuation lines of an existing key
      if (idx >= 0) { let j = idx + 1; while (j < lines.length && /^\s+-\s|^\s+\S/.test(lines[j])) j++; lines.splice(idx + 1, j - idx - 1); }
      if (val == null || val === '') { if (idx >= 0) lines.splice(idx, 1); continue; }
      const line = `${key}: ${yamlValue(val)}`;
      if (idx >= 0) lines[idx] = line; else lines.push(line);
    }
    if (!lines.length) return fm.style === 'yaml' || fm.style === 'mmd' ? body.replace(/^\r?\n/, '') : text;
    const head = '---' + eol + lines.join(eol) + eol + '---' + eol;
    if (fm.style) return head + (fm.style === 'mmd' ? eol : '') + body;
    return head + eol + body;
  };

  // Images: rendered pages live at markooj://app/src/, so relative image paths must be resolved for display.
  E.assetUrl = (doc, src) => {
    if (app.assetUrl) { try { const u = app.assetUrl(doc, src); if (u) return u; } catch {} }
    if (!doc || !doc.path || !src || /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(src)) return null;
    const dir = doc.path.replace(/[\\/][^\\/]*$/, '').replace(/\\/g, '/');
    return 'file:///' + encodeURI((dir + '/' + src.replace(/^\.\//, '')).replace(/^\/+/, '')).replace(/#/g, '%23');
  };
  E.fixImages = (el, doc) => {
    el.querySelectorAll('img[src]').forEach(img => {
      if (img.hasAttribute('data-mk-src')) return;
      const src = img.getAttribute('src'); const url = E.assetUrl(doc, src);
      if (url) { img.setAttribute('data-mk-src', src); img.setAttribute('src', url); }
    });
  };

  // Obsidian / GitHub callouts whose first paragraph carries data-line (preload's regex misses those).
  E.fixCallouts = (el) => {
    el.querySelectorAll('blockquote:not(.callout)').forEach(bq => {
      const p = bq.firstElementChild; if (!p || p.tagName !== 'P') return;
      const t = p.firstChild; if (!t || t.nodeType !== 3) return;
      const m = /^\[!(\w+)\][+-]?[ \t]*([^\n]*)\n?/.exec(t.data); if (!m) return;
      const kind = m[1].toLowerCase();
      bq.classList.add('callout', 'callout-' + kind);
      t.data = t.data.slice(m[0].length);
      const strong = document.createElement('strong'); strong.className = 'callout-title';
      strong.textContent = m[2].trim() || (kind[0].toUpperCase() + kind.slice(1));
      p.insertBefore(document.createElement('br'), t); p.insertBefore(strong, p.firstChild);
    });
  };
  app.hooks?.postRender?.((el) => E.fixCallouts(el));

  // Keyboard shortcuts: "Ctrl+Shift+E", "Alt+=", "Ctrl+Enter". Physical keys (e.code) so layouts do not matter.
  const CODE_NAMES = { Equal: '=', Minus: '-', Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Backquote: '`', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Space: 'Space', Enter: 'Enter', NumpadEnter: 'Enter', Tab: 'Tab', Escape: 'Esc', Backspace: 'Backspace', Delete: 'Delete', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', NumpadAdd: '+', NumpadSubtract: '-' };
  E.keyName = (e) => {
    let k;
    if (/^Key[A-Z]$/.test(e.code)) k = e.code.slice(3);
    else if (/^Digit\d$/.test(e.code)) k = e.code.slice(5);
    else if (/^Numpad\d$/.test(e.code)) k = e.code.slice(6);
    else if (/^F\d{1,2}$/.test(e.code)) k = e.code;
    else k = CODE_NAMES[e.code] || (e.key && e.key.length === 1 ? e.key.toUpperCase() : e.key);
    return [(e.ctrlKey || e.metaKey) && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', k].filter(Boolean).join('+');
  };
  E.normShortcut = (s) => {
    const parts = String(s).split('+').map(x => x.trim()).filter((x, i, a) => x || i === a.length - 1);
    if (String(s).endsWith('++')) parts.push('+');
    const key = parts.pop() || '+';
    const mods = new Set(parts.map(p => ({ cmd: 'Ctrl', control: 'Ctrl', ctrl: 'Ctrl', meta: 'Ctrl', mod: 'Ctrl', alt: 'Alt', option: 'Alt', shift: 'Shift' }[p.toLowerCase()] || p)));
    let k = key.length === 1 ? key.toUpperCase() : ({ esc: 'Esc', escape: 'Esc', return: 'Enter', space: 'Space', plus: '=' }[key.toLowerCase()] || key[0].toUpperCase() + key.slice(1));
    if (k === '+') { k = '='; mods.add('Shift'); }
    return [mods.has('Ctrl') && 'Ctrl', mods.has('Alt') && 'Alt', mods.has('Shift') && 'Shift', k].filter(Boolean).join('+');
  };
  /** True when the key is AltGr (reported as Ctrl+Alt on Windows) producing a printable character. */
  E.isAltGrChar = (e) => { try { return !!(e && e.getModifierState?.('AltGraph') && typeof e.key === 'string' && [...e.key].length === 1 && e.key.trim() !== ''); } catch { return false; } };
  let scCache = { n: -1, map: new Map() };
  E.commandForKey = (e) => {
    const list = app.commands.list();
    if (list.length !== scCache.n) {
      // regular shortcuts: last registered wins (same rule as the shell); altShortcuts are editor-only and win while typing
      const map = new Map();
      for (const c of list) for (const s of [].concat(c.shortcut || [], c.shortcuts || [])) if (s) map.set(E.normShortcut(s), c.id);
      for (const c of list) for (const s of [].concat(c.altShortcuts || [])) if (s) map.set(E.normShortcut(s), c.id);
      scCache = { n: list.length, map };
    }
    return scCache.map.get(E.keyName(e)) || null;
  };
  const NATIVE = new Set(['Ctrl+C', 'Ctrl+X', 'Ctrl+V', 'Ctrl+A', 'Ctrl+Shift+V']);
  // Runs a registered command for this key when nobody handled it yet. Returns true when it did.
  E.dispatchShortcut = (e) => {
    if (e.defaultPrevented || e.isComposing) return false;
    if (!(e.ctrlKey || e.metaKey || e.altKey || /^F\d/.test(e.code))) return false;
    // AltGr types a character (², ³, µ, @, the backslash …): never take it for a Ctrl+Alt shortcut
    if (E.isAltGrChar(e)) return false;
    const name = E.keyName(e);
    if (NATIVE.has(name) && !(name === 'Ctrl+Shift+V' && app.commands.get('edit.pastePlain'))) return false;
    const id = E.commandForKey(e); if (!id) return false;
    e.preventDefault(); e.stopPropagation();
    app.commands.run(id);
    return true;
  };
  E.target = () => E.testTarget || app.editors.active();

  // Lightweight popover menu used by the editor role (fixed position, mock look).
  E.menu = (anchor, items, opts = {}) => {
    E.closeMenu();
    const pop = document.createElement('div'); pop.className = 'mk-pop'; pop.setAttribute('role', 'menu');
    const btns = [];
    for (const it of items) {
      if (it === '-' || it.sep) { const s = document.createElement('div'); s.className = 'mk-pop-sep'; pop.appendChild(s); continue; }
      if (it.title) { const h = document.createElement('h6'); h.textContent = it.title; pop.appendChild(h); continue; }
      if (it.el) { pop.appendChild(it.el); continue; }
      const b = document.createElement('button'); b.className = 'mk-mi'; b.type = 'button'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `<span class="chk">${it.checked ? '<svg class="i" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>' : ''}</span>${it.html || E.esc(it.label)}${it.hint ? `<small>${E.esc(it.hint)}</small>` : ''}`;
      if (it.disabled) b.disabled = true;
      b.addEventListener('mousedown', ev => ev.preventDefault());
      b.addEventListener('click', () => { E.closeMenu(); it.run?.(); });
      pop.appendChild(b); btns.push(b);
    }
    document.body.appendChild(pop);
    E.placePop(pop, anchor, opts);
    requestAnimationFrame(() => pop.classList.add('show'));
    const onKey = (ev) => {
      const i = btns.indexOf(document.activeElement);
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); E.closeMenu(); opts.onCancel?.(); }
      else if (ev.key === 'ArrowDown') { ev.preventDefault(); btns[(i + 1) % btns.length]?.focus(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); btns[(i - 1 + btns.length) % btns.length]?.focus(); }
    };
    const onDown = (ev) => { if (!pop.contains(ev.target)) E.closeMenu(); };
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => document.addEventListener('mousedown', onDown, true), 0);
    E._menu = { pop, close() { document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDown, true); pop.remove(); } };
    if (opts.focus !== false && btns[0] && !opts.noFocus) setTimeout(() => (pop.querySelector('[autofocus]') || btns[0]).focus({ preventScroll: true }), 30);
    return pop;
  };
  E.closeMenu = () => { if (E._menu) { const m = E._menu; E._menu = null; m.close(); } };
  E.placePop = (pop, anchor, opts = {}) => {
    let x, y, r;
    if (anchor && anchor.getBoundingClientRect) r = anchor.getBoundingClientRect();
    else if (anchor && typeof anchor.x === 'number') r = { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y, width: 0, height: 0 };
    else r = { left: innerWidth / 2 - 120, right: innerWidth / 2, top: innerHeight / 3, bottom: innerHeight / 3, width: 0 };
    x = r.left; y = r.bottom + 6;
    pop.style.left = '0px'; pop.style.top = '0px';
    const w = pop.offsetWidth, h = pop.offsetHeight;
    if (x + w > innerWidth - 8) x = Math.max(8, innerWidth - w - 8);
    if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 6);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  };
  // Where the last pointer press happened (ribbon buttons call commands without passing their element).
  let lastPress = null;
  document.addEventListener('pointerdown', e => { lastPress = { el: e.target.closest?.('button,[role=button],.big,.ib,.select') || null, x: e.clientX, y: e.clientY, t: Date.now() }; }, true);
  E.anchor = () => {
    if (lastPress && Date.now() - lastPress.t < 1500) return lastPress.el && lastPress.el.isConnected ? lastPress.el : { x: lastPress.x, y: lastPress.y };
    const a = document.activeElement; if (a && a !== document.body && a.closest?.('.ribbon,[class*=ribbon]')) return a;
    return null;
  };

  // Read a File into {name, data(base64), type}.
  E.readFile = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res({ name: file.name || 'image.png', type: file.type, data: String(r.result).split(',')[1] || '', dataUrl: String(r.result) });
    r.onerror = () => rej(r.error); r.readAsDataURL(file);
  });
  // Store an image next to the document (assets/) and return the path to use in Markdown.
  E.saveImage = async (file, doc) => {
    const f = await E.readFile(file);
    const name = (f.name || 'image.png').replace(/[^\w.-]+/g, '-');
    try { const p = await mk.invoke('save-asset', { docPath: doc?.path || null, name, data: f.data }); if (p) return { path: p, name: f.name }; } catch (e) { console.warn('save-asset failed', e); }
    return { path: f.dataUrl, name: f.name };
  };
  E.pickImages = () => new Promise(res => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.style.display = 'none';
    inp.addEventListener('change', () => { res([...inp.files]); inp.remove(); });
    document.body.appendChild(inp); inp.click();
    setTimeout(() => { if (inp.isConnected && !inp.files.length) { /* still open or canceled */ } }, 0);
  });
  E.imageMarkdown = (path, name) => `![${String(name || 'image').replace(/\.[^.]+$/, '').replace(/[[\]]/g, '')}](${/\s/.test(path) && !/^data:/.test(path) ? '<' + path + '>' : path})`;

  // ------------------------------------------------------------------ CSS (tokens from design/mock.html)
  E.injectCSS('mk-editor-base-css', `
.mk-pop{position:fixed;background:var(--chrome-solid,#fbfbfd);border-radius:var(--r-lg,12px);box-shadow:var(--pop-shadow,0 12px 40px rgba(0,0,0,.16),0 0 0 .5px rgba(0,0,0,.08));padding:6px;min-width:200px;max-height:70vh;overflow:auto;opacity:0;transform:translateY(6px) scale(.98);transition:opacity .18s,transform .25s var(--ease,cubic-bezier(.2,.8,.2,1));z-index:1000;color:var(--text,#1d1d1f);font:13px/1.4 var(--font,system-ui)}
.mk-pop.show{opacity:1;transform:none}
.mk-pop h6{margin:6px 10px 6px;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3,#a1a1a6)}
.mk-pop-sep{height:.5px;background:var(--line-2,rgba(0,0,0,.12));margin:4px 6px}
.mk-mi{display:flex;align-items:center;gap:10px;width:100%;padding:7px 10px;border-radius:7px;text-align:left;border:0;background:none;font:inherit;color:inherit;transition:background .12s}
.mk-mi:hover,.mk-mi:focus-visible{background:var(--accent,#0a66ff);color:#fff;outline:none}
.mk-mi:disabled{opacity:.45}
.mk-mi small{margin-left:auto;color:var(--text-3,#a1a1a6);padding-left:16px}
.mk-mi:hover small,.mk-mi:focus-visible small,.mk-mi:hover .chk,.mk-mi:focus-visible .chk{color:#fff}
.mk-mi .chk{width:14px;flex:none;color:var(--accent,#0a66ff)}
.mk-mi .chk svg,.mk-pop svg.i{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.mk-page{width:794px;min-height:1123px;background:var(--surface,#fff);box-shadow:var(--page-shadow);border-radius:3px;padding:96px 96px 90px;position:relative;font-family:var(--serif,Georgia,serif);font-size:15.5px;line-height:1.62;color:var(--text,#1d1d1f);transition:background .3s;overflow-wrap:break-word}
:root[data-theme="dark"] .mk-page{background:#1e1e20}
.mk-page:focus{outline:none}
.mk-page h1{font:700 30px/1.15 var(--font);letter-spacing:-.02em;margin:0 0 6px}
.mk-page h1:not(:first-child){margin-top:30px}
.mk-page h2{font:650 19px/1.3 var(--font);letter-spacing:-.01em;margin:30px 0 8px}
.mk-page h3{font:600 15.5px/1.3 var(--font);margin:22px 0 6px;color:var(--text-2)}
.mk-page h4,.mk-page h5,.mk-page h6{font:600 14px/1.3 var(--font);margin:18px 0 6px;color:var(--text-2)}
.mk-page p{margin:0 0 12px}
.mk-page ul,.mk-page ol{margin:0 0 12px;padding-left:28px}
.mk-page li>p{margin:0 0 4px}
.mk-page .contains-task-list{list-style:none;padding-left:6px}
.mk-page .task-list-item input{margin:0 8px 0 0;vertical-align:-1px;accent-color:var(--accent)}
.mk-page a{color:var(--accent);text-decoration:none}
.mk-page a:hover{text-decoration:underline}
.mk-page blockquote{margin:14px 0;padding:2px 0 2px 16px;border-left:3px solid var(--line-2);color:var(--text-2)}
.mk-page blockquote.callout{border-radius:10px;padding:12px 14px;background:rgba(255,159,10,.10);border-left:3px solid var(--orange,#ff9f0a);font-size:14.5px;color:var(--text)}
.mk-page blockquote.callout>p:last-child{margin-bottom:0}
.mk-page .callout-title{font-family:var(--font);font-size:12.5px;color:#c77700;display:inline-block;margin-bottom:2px}
.mk-page blockquote.callout-info,.mk-page blockquote.callout-abstract{background:var(--accent-soft);border-left-color:var(--accent)}
.mk-page .callout-info .callout-title,.mk-page .callout-abstract .callout-title{color:var(--accent)}
.mk-page blockquote.callout-tip{background:rgba(40,167,69,.10);border-left-color:var(--green,#28a745)}
.mk-page .callout-tip .callout-title{color:var(--green,#28a745)}
.mk-page blockquote.callout-important{background:rgba(142,92,247,.10);border-left-color:var(--purple,#8e5cf7)}
.mk-page .callout-important .callout-title{color:var(--purple,#8e5cf7)}
.mk-page blockquote.callout-caution,.mk-page blockquote.callout-danger{background:rgba(255,55,95,.09);border-left-color:#ff375f}
.mk-page .callout-caution .callout-title,.mk-page .callout-danger .callout-title{color:#e0244b}
.mk-page code{font:.86em var(--mono);background:var(--hover);padding:1px 4px;border-radius:4px}
.mk-page pre{font:12.5px/1.55 var(--mono);background:var(--bg);border:.5px solid var(--line);padding:12px 14px;border-radius:9px;overflow:auto;white-space:pre-wrap}
.mk-page pre code{background:none;padding:0;font:inherit}
.mk-page pre.mermaid{background:none;border:.5px solid var(--line);border-radius:12px;padding:18px;display:flex;justify-content:center;white-space:normal;font-family:var(--font)}
.mk-page table{width:100%;border-collapse:collapse;font:13px var(--font);margin:14px 0 12px}
.mk-page th{text-align:left;font-weight:600;padding:8px 10px;border-bottom:1.5px solid var(--text)}
.mk-page td{padding:7px 10px;border-bottom:.5px solid var(--line-2)}
.mk-page hr{border:0;border-top:.5px solid var(--line-2);margin:22px 0}
.mk-page img{max-width:100%;border-radius:4px}
.mk-page mark{background:rgba(255,214,10,.45);color:inherit;padding:0 1px;border-radius:2px}
.mk-page .mk-cite{font:500 12.5px var(--font);color:var(--accent);background:var(--accent-soft);padding:1px 6px;border-radius:5px;cursor:pointer;white-space:nowrap;transition:background .15s}
.mk-page .mk-cite:hover{background:var(--accent-ring)}
.mk-page .footnote-ref a{font:600 10px var(--font);color:var(--accent)}
.mk-page .mk-math{border-radius:4px;transition:background .15s;cursor:pointer}
.mk-page .mk-math:not(.display){padding:0 1px;white-space:nowrap}
.mk-page .mk-math:hover{background:var(--accent-soft)}
.mk-page .mk-math-block{position:relative;margin:16px 0;padding:6px 0;border-radius:8px;transition:background .2s;overflow-x:auto}
.mk-page .mk-math-block:hover{background:var(--accent-soft)}
.mk-page .mk-math.display{display:block}
.mk-page .mk-front .mk-title{margin-bottom:6px}
.mk-page .mk-author,.mk-page .mk-date{font:13px var(--font);color:var(--text-2);margin:0 0 4px}
.mk-page .mk-front{margin-bottom:22px}
.mk-page .mk-abstract{font-size:14px;padding:14px 16px;border-radius:10px;background:var(--accent-soft);border-left:3px solid var(--accent);margin:16px 0 0}
.mk-page .page-break{position:relative;height:22px;margin:18px 0;border-top:1px dashed var(--line-2);break-after:page;page-break-after:always}
.mk-page .page-break::after{content:"Page break";position:absolute;left:50%;top:-9px;transform:translateX(-50%);font:10.5px var(--font);letter-spacing:.04em;color:var(--text-3);background:var(--surface,#fff);padding:0 8px}
:root[data-theme="dark"] .mk-page .page-break::after{background:#1e1e20}
.mk-page .footnotes{font-size:13px;color:var(--text-2)}
.mk-page .footnotes-sep{margin-top:30px}
.mk-page .mk-bibliography{font-size:13.5px}
.mk-page .mk-bibliography h2{margin-top:30px}
.mk-page ::selection{background:var(--accent-ring)}
.mk-page .katex{font-size:1.05em}
`);

  // ------------------------------------------------------------------ Simple mode CSS
  E.injectCSS('mk-simple-css', `
.mk-simple{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto minmax(0,1fr);height:100%;width:100%;min-height:0;background:var(--canvas)}
.mk-simple.no-preview{grid-template-columns:1fr}
.mk-simple.no-preview .mk-preview{display:none}
.mk-slim{grid-column:1/-1;display:flex;align-items:center;gap:2px;padding:6px 12px;background:var(--chrome);border-bottom:.5px solid var(--line)}
.mk-slim .ib{width:28px;height:27px;border-radius:6px;display:grid;place-items:center;color:var(--text);border:0;background:none;font:inherit;transition:background .15s,color .15s,transform .1s var(--ease)}
.mk-slim .ib:hover{background:var(--hover)}.mk-slim .ib:active{background:var(--press);transform:scale(.92)}
.mk-slim .ib.on{background:var(--accent-soft);color:var(--accent)}
.mk-slim .ib b,.mk-slim .ib i,.mk-slim .ib s{font:600 14px var(--serif)}
.mk-slim .sep{width:.5px;height:18px;background:var(--line-2);margin:0 3px}
.mk-slim svg.i{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.mk-slim .note{margin-left:auto;color:var(--text-3);font-size:11.5px;display:flex;align-items:center;gap:8px}
.mk-pv-toggle{height:24px;padding:0 10px;border-radius:7px;border:.5px solid var(--line-2);background:var(--surface);color:var(--text-2);font:500 11.5px var(--font);transition:background .15s,color .15s,transform .1s var(--ease)}
.mk-pv-toggle:hover{color:var(--text);border-color:var(--accent)}.mk-pv-toggle:active{transform:scale(.96)}
.mk-simple{position:relative}
.mk-pv-float{position:absolute;top:10px;right:18px;z-index:5;opacity:.75;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.mk-pv-float:hover{opacity:1}
.mk-src{position:relative;overflow:auto;background:var(--surface);border-right:.5px solid var(--line);min-height:0;min-width:0}
.mk-src-inner{position:relative;min-height:100%;font:13.5px/1.75 var(--mono);--mk-fs:13.5px;font-size:var(--mk-fs);font-variant-ligatures:none;font-feature-settings:"liga" 0,"calt" 0}
.mk-src-mirror{margin:0;padding:28px 0 40vh;counter-reset:ln;color:var(--text);white-space:pre-wrap;overflow-wrap:break-word;word-break:normal;tab-size:4;font:inherit;pointer-events:none;min-height:100%}
.mk-src-mirror .ln{display:block;padding:0 28px 0 64px;position:relative;transition:background .12s}
.mk-src-mirror .ln::before{counter-increment:ln;content:counter(ln);position:absolute;left:0;width:44px;text-align:right;color:var(--text-3);font-size:.85em}
.mk-src-mirror .ln.cur{background:var(--accent-soft)}
.mk-src-mirror .ln.cur::before{color:var(--accent)}
.mk-src-ta{position:absolute;inset:0;width:100%;height:100%;box-sizing:border-box;padding:28px 28px 40vh 64px;margin:0;border:0;outline:0;resize:none;overflow:hidden;background:transparent;color:transparent;caret-color:var(--accent);white-space:pre-wrap;overflow-wrap:break-word;word-break:normal;tab-size:4;font:inherit;line-height:inherit;font-variant-ligatures:none;font-feature-settings:"liga" 0,"calt" 0}
.mk-src-ta::selection{background:var(--accent-ring);color:transparent}
.mk-src-mirror .t-h{color:var(--accent);font-weight:700}.mk-src-mirror .t-mk{color:var(--text-3)}.mk-src-mirror .t-b{font-weight:700}.mk-src-mirror .t-em{font-style:italic}
.mk-src-mirror .t-math{color:var(--purple,#8e5cf7)}.mk-src-mirror .t-link{color:#0a8f6a}.mk-src-mirror .t-code{color:#c2410c}.mk-src-mirror .t-meta{color:var(--text-2)}
.mk-src-mirror .t-del{text-decoration:line-through;color:var(--text-2)}.mk-src-mirror .t-mark{background:rgba(255,214,10,.35);border-radius:2px}
.mk-src-mirror .t-quote{color:var(--text-2)}
.mk-src-mirror .t-note{background:rgba(142,92,247,.10);color:var(--text-2);border-radius:2px}
:root[data-theme="dark"] .mk-src-mirror .t-note{background:rgba(142,92,247,.2)}
:root[data-theme="dark"] .mk-src-mirror .t-link{color:#3ccf9d}:root[data-theme="dark"] .mk-src-mirror .t-code{color:#ff8a5c}
.mk-preview{overflow:auto;background:var(--canvas);padding:28px;min-height:0;min-width:0}
.mk-preview .mk-page{width:100%;max-width:620px;min-height:0;margin:0 auto;padding:44px 48px;font-size:14.5px}
.mk-src-empty{position:absolute;left:64px;top:28px;color:var(--text-3);pointer-events:none;font:inherit}
`);

  // ------------------------------------------------------------------ highlighter
  const esc = E.esc;
  const INLINE = /(`+)([^`\n]|[^`\n][\s\S]*?[^`])\1(?!`)|(\$\$[^$\n]+?\$\$|\$[^\s$\d](?:[^$\n]*?[^\s\\$])?\$(?!\d)|\$\d(?:[^$\n]*?[^\s\\$])?\$(?!\d)|\\\(.+?\\\)|\\\[.+?\\\])|(!?\[[^\]\n]*\]\([^)\n]*\)|\[\[[^\]\n]+\]\]|\[-?@[^\]\n]+\]|\[\^[^\]\n]+\]|<https?:[^>\s]+>|https?:\/\/[^\s<>)\]]+)|(\*\*|__)(?=\S)([^\n]*?\S)\5|(\*|_)(?=[^\s*_])((?:[^\n]*?[^\s\\*_])?)\7(?![*\w])|(~~)(?=\S)([^\n]*?\S)~~|(==)(?=\S)([^\n]*?\S)==|(<!--[^\n]*?-->|<\/?[A-Za-z][^>\n]*>)|(%%[^\n]*?%%)|(\{[#-][^}\n]*\})|((?<![\w@])-?@(?:eq|fig|tbl|sec):[\w:.-]*\w)/g;
  function hlInline(s, depth = 0) {
    if (!s) return '';
    let out = '', last = 0, m;
    const re = new RegExp(INLINE.source, 'g');
    while ((m = re.exec(s))) {
      if (m[7] === '_' && /\w/.test(s[m.index - 1] || '')) { re.lastIndex = m.index + 1; continue; }
      out += esc(s.slice(last, m.index));
      const t = m[0];
      if (m[1]) out += `<span class="t-code">${esc(t)}</span>`;
      else if (m[3]) out += `<span class="t-math">${esc(t)}</span>`;
      else if (m[4]) out += `<span class="t-link">${esc(t)}</span>`;
      else if (m[5]) out += `<span class="t-mk">${m[5]}</span><span class="t-b">${depth < 3 ? hlInline(m[6], depth + 1) : esc(m[6])}</span><span class="t-mk">${m[5]}</span>`;
      else if (m[7]) out += `<span class="t-mk">${m[7]}</span><span class="t-em">${depth < 3 ? hlInline(m[8], depth + 1) : esc(m[8])}</span><span class="t-mk">${m[7]}</span>`;
      else if (m[9]) out += `<span class="t-mk">~~</span><span class="t-del">${depth < 3 ? hlInline(m[10], depth + 1) : esc(m[10])}</span><span class="t-mk">~~</span>`;
      else if (m[11]) out += `<span class="t-mk">==</span><span class="t-mark">${depth < 3 ? hlInline(m[12], depth + 1) : esc(m[12])}</span><span class="t-mk">==</span>`;
      else if (m[14]) out += `<span class="t-note">${esc(t)}</span>`;
      else if (m[16]) out += `<span class="t-link">${esc(t)}</span>`;
      else out += `<span class="t-meta">${esc(t)}</span>`;
      last = m.index + t.length;
    }
    return out + esc(s.slice(last));
  }
  // Returns [html, nextState]. States: 'n' normal, 'fm' front matter, 'f:```' fence, 'm:$$' math block, 'c' html comment.
  function hlLine(line, st, idx) {
    const raw = line.replace(/\r$/, '');
    if (st === 'fm') return [`<span class="t-meta">${esc(line)}</span>`, /^(---|\.\.\.)\s*$/.test(raw) ? 'n' : 'fm'];
    if (st.startsWith('f:')) { const mark = st.slice(2); const close = new RegExp('^\\s*' + mark[0].replace(/[`~]/, c => c) + '{' + mark.length + ',}\\s*$'); return [`<span class="t-code">${esc(line)}</span>`, close.test(raw) ? 'n' : st]; }
    if (st.startsWith('m:')) { const close = st.slice(2); return [`<span class="t-math">${esc(line)}</span>`, (close === '}' ? /\\end\{/.test(raw) : raw.trimEnd().replace(/\s*\{[^}]*\}$/, '').endsWith(close)) ? 'n' : st]; }
    if (st === 'c') return [`<span class="t-meta">${esc(line)}</span>`, raw.includes('-->') ? 'n' : 'c'];
    if (idx === 0 && /^---\s*$/.test(raw)) return [`<span class="t-meta">${esc(line)}</span>`, 'fm'];
    let m;
    if ((m = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(raw))) return [`<span class="t-code">${esc(line)}</span>`, 'f:' + m[2]];
    if ((m = /^\s*(\$\$|\\\[)(.*)$/.exec(raw))) {
      const close = m[1] === '$$' ? '$$' : '\\]';
      const rest = m[2].trimEnd().replace(/\s*\{[^}]*\}$/, '');
      return [`<span class="t-math">${esc(line)}</span>`, rest.length >= close.length && rest.endsWith(close) ? 'n' : 'm:' + close];
    }
    if (/^\s*\\begin\{(equation|align|gather|multline|eqnarray)\*?\}/.test(raw)) {
      return [`<span class="t-math">${esc(line)}</span>`, /\\end\{/.test(raw) ? 'n' : 'm:}'];
    }
    if (/^\s*<!--/.test(raw) && !raw.includes('-->')) return [`<span class="t-meta">${esc(line)}</span>`, 'c'];
    if ((m = /^(#{1,6})(\s.*)?$/.exec(line))) return [`<span class="t-mk">${m[1]}</span><span class="t-h">${hlInline(m[2] || '')}</span>`, 'n'];
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(raw)) return [`<span class="t-mk">${esc(line)}</span>`, 'n'];
    if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(raw) && raw.includes('-') && raw.includes('|')) return [`<span class="t-mk">${esc(line)}</span>`, 'n'];
    let pre = '', rest = line;
    if ((m = /^(\s*(?:>\s?)+)/.exec(rest))) { pre += `<span class="t-mk">${esc(m[1])}</span>`; rest = rest.slice(m[1].length); }
    if ((m = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(\[[ xX]\]\s)?/.exec(rest))) { pre += esc(m[1]) + `<span class="t-mk">${esc(m[2] + m[3] + (m[4] || ''))}</span>`; rest = rest.slice(m[0].length); }
    else if ((m = /^(\[\^[^\]]+\]:|\[[^\]]+\]:\s*\S+)/.exec(rest))) { pre += `<span class="t-link">${esc(m[1])}</span>`; rest = rest.slice(m[1].length); }
    if (/^\s*\|/.test(rest) || (/\|/.test(rest) && /^\s*\|?.+\|.+/.test(rest) && false)) {
      return [pre + rest.split(/(?<!\\)\|/).map(c => hlInline(c)).join('<span class="t-mk">|</span>'), 'n'];
    }
    return [pre + hlInline(rest), 'n'];
  }
  E.highlightLine = hlLine;

  // ------------------------------------------------------------------ Simple editor factory
  const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', '`': '`', '*': '*', '_': '_', '$': '$' };
  const CLOSERS = new Set([')', ']', '}', '"', '`', '*', '_', '$']);
  const LIST_RE = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(\[[ xX]\]\s+)?/;

  function createSimpleEditor() {
    let host = null, root, ta, mirror, srcPane, pvPane, pvPage, slim, doc = null, offs = [], mounted = false;
    let lines = [], states = [], els = [], curLine = -1, pvSeq = 0, pvTimer = null, driver = 'src', pvBlocks = [];
    let fmLines = 0;

    function build() {
      root = document.createElement('div'); root.className = 'mk-simple';
      const hasShellSlim = !!document.querySelector('.slimbar:not(.mk-slim), #slimbar');
      if (!hasShellSlim) { slim = buildSlim(); root.appendChild(slim); } else root.style.gridTemplateRows = 'minmax(0,1fr)';
      srcPane = document.createElement('div'); srcPane.className = 'mk-src';
      const inner = document.createElement('div'); inner.className = 'mk-src-inner';
      mirror = document.createElement('div'); mirror.className = 'mk-src-mirror'; mirror.setAttribute('aria-hidden', 'true');
      ta = document.createElement('textarea'); ta.className = 'mk-src-ta'; ta.spellcheck = false;
      ta.setAttribute('autocapitalize', 'off'); ta.setAttribute('autocomplete', 'off'); ta.setAttribute('aria-label', 'Markdown source');
      ta.setAttribute('wrap', 'soft');
      inner.append(mirror, ta); srcPane.appendChild(inner);
      pvPane = document.createElement('div'); pvPane.className = 'mk-preview';
      pvPage = document.createElement('article'); pvPage.className = 'mk-page mk-preview-page'; pvPane.appendChild(pvPage);
      root.append(srcPane, pvPane);
      root.classList.toggle('no-preview', app.settings.get('simplePreview', true) === false);
      if (hasShellSlim) {
        // the shell's slim bar has no preview switch: keep a small one in the corner
        const tog = document.createElement('button'); tog.type = 'button'; tog.className = 'mk-pv-toggle mk-pv-float';
        tog.title = 'Show or hide the live preview';
        const label = () => { if (root) tog.textContent = root.classList.contains('no-preview') ? 'Show preview' : 'Hide preview'; };
        tog.addEventListener('mousedown', e => e.preventDefault());
        tog.addEventListener('click', () => { adapter.togglePreview(); label(); });
        offs.push(app.events.on('settings:changed', ({ key }) => { if (key === 'simplePreview') label(); }));
        root.appendChild(tog); label();
      }

      ta.addEventListener('input', onInput);
      ta.addEventListener('keydown', onKey);
      ta.addEventListener('paste', onPaste);
      ta.addEventListener('contextmenu', onContext);
      ta.addEventListener('drop', onDrop);
      ta.addEventListener('dragover', e => { if ([...(e.dataTransfer?.items || [])].some(i => i.kind === 'file')) e.preventDefault(); });
      for (const ev of ['keyup', 'mouseup', 'select', 'focus']) ta.addEventListener(ev, onSel);
      const selDoc = () => { if (document.activeElement === ta) onSel(); };
      document.addEventListener('selectionchange', selDoc); offs.push(() => document.removeEventListener('selectionchange', selDoc));
      srcPane.addEventListener('scroll', () => { if (driver === 'src') syncTo('pv'); }, { passive: true });
      pvPane.addEventListener('scroll', () => { if (driver === 'pv') syncTo('src'); }, { passive: true });
      for (const [el, name] of [[srcPane, 'src'], [pvPane, 'pv']]) for (const ev of ['wheel', 'pointerdown', 'keydown', 'touchstart']) el.addEventListener(ev, () => { driver = name; }, { passive: true });
      ta.addEventListener('input', () => { driver = 'src'; });
      pvPane.addEventListener('dblclick', e => {
        const b = e.target.closest('[data-line]'); if (!b) return;
        adapter.scrollToLine(+b.getAttribute('data-line') + fmLines, { caret: true });
      });
      pvPane.addEventListener('click', e => {
        const a = e.target.closest('a[href]'); if (!a) return;
        e.preventDefault();
        const href = a.getAttribute('href');
        if (href.startsWith('#')) { pvPage.querySelector(`[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        if (/^(https?:|mailto:)/i.test(href)) mk.invoke?.('open-external', href).catch?.(() => {});
      });
      // clicking in the empty area under the text focuses the end
      srcPane.addEventListener('mousedown', e => { if (e.target === srcPane) { e.preventDefault(); ta.focus(); } });
    }

    function buildSlim() {
      const bar = document.createElement('div'); bar.className = 'mk-slim';
      const ic = n => `<svg class="i"><use href="#${n}"/></svg>`;
      const items = [
        ['format.bold', '<b>B</b>', 'Bold (Ctrl+B)'], ['format.italic', '<i>I</i>', 'Italic (Ctrl+I)'], ['format.strike', '<s>S</s>', 'Strikethrough'], 'sep',
        ['format.style', '<span style="font:700 12px var(--font)">H1</span>', 'Heading 1', { value: 'h1' }], ['format.style', '<span style="font:700 12px var(--font)">H2</span>', 'Heading 2', { value: 'h2' }], 'sep',
        ['list.bullet', ic('ul'), 'Bullets'], ['list.number', ic('ol'), 'Numbering'], ['list.task', ic('task'), 'Checklist'], ['para.quote', ic('quote'), 'Quote'], 'sep',
        ['insert.link', ic('link'), 'Link (Ctrl+K)'], ['insert.image', ic('image'), 'Picture'], ['insert.table', ic('table'), 'Table'], ['insert.code', ic('code'), 'Code'], ['insert.equation', ic('sigma'), 'Equation (Alt+=)'], ['insert.citation', ic('cite'), 'Citation'],
      ];
      for (const it of items) {
        if (it === 'sep') { const s = document.createElement('span'); s.className = 'sep'; bar.appendChild(s); continue; }
        const [cmd, html, title, args] = it;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'ib'; b.innerHTML = html; b.title = title; b.setAttribute('aria-label', title);
        b.dataset.cmd = cmd; if (args) b.dataset.args = JSON.stringify(args);
        b.addEventListener('mousedown', e => e.preventDefault());
        b.addEventListener('click', () => app.commands.run(cmd, args));
        bar.appendChild(b);
      }
      const note = document.createElement('span'); note.className = 'note';
      note.innerHTML = '<span>Markdown source · live preview</span>';
      const tog = document.createElement('button'); tog.type = 'button'; tog.className = 'mk-pv-toggle'; tog.title = 'Show or hide the live preview';
      const label = () => { if (root) tog.textContent = root.classList.contains('no-preview') ? 'Show preview' : 'Hide preview'; };
      tog.addEventListener('click', () => { adapter.togglePreview(); label(); });
      note.appendChild(tog); bar.appendChild(note);
      setTimeout(label, 0);
      return bar;
    }

    // ---------- highlighting (incremental by line) ----------
    function lineEl(html) { const d = document.createElement('div'); d.className = 'ln'; d.innerHTML = html || '<br>'; return d; }
    function rehighlightAll(text) {
      lines = text.split('\n'); states = []; els = []; mirror.textContent = '';
      let st = 'n'; const frag = document.createDocumentFragment();
      for (let i = 0; i < lines.length; i++) { states.push(st); const [h, n] = hlLine(lines[i], st, i); st = n; const el = lineEl(h); els.push(el); frag.appendChild(el); }
      mirror.appendChild(frag); curLine = -1;
    }
    function rehighlight(text) {
      const nl = text.split('\n');
      if (!els.length || Math.abs(nl.length - lines.length) > 2000) return rehighlightAll(text);
      const max = Math.min(lines.length, nl.length);
      let a = 0; while (a < max && lines[a] === nl[a]) a++;
      let b = 0; while (b < max - a && lines[lines.length - 1 - b] === nl[nl.length - 1 - b]) b++;
      const oldEnd = lines.length - b, newEnd = nl.length - b;
      const suffixStates = states.slice(oldEnd);
      const suffixEls = els.slice(oldEnd);
      for (let i = a; i < oldEnd; i++) els[i].remove();
      const ref = suffixEls[0] || null;
      const newEls = [], newStates = [];
      let st = a === 0 ? 'n' : hlLine(nl[a - 1], states[a - 1], a - 1)[1];
      for (let i = a; i < newEnd; i++) { newStates.push(st); const [h, n] = hlLine(nl[i], st, i); st = n; const el = lineEl(h); newEls.push(el); mirror.insertBefore(el, ref); }
      // continue through the unchanged suffix until the state settles
      for (let j = 0; j < suffixEls.length; j++) {
        const i = newEnd + j;
        const force = j === 0 && (newEnd === 0 || oldEnd === 0); // line 0 rules (front matter) depend on position
        if (st === suffixStates[j] && !force) break;
        suffixStates[j] = st; const [h, n] = hlLine(nl[i], st, i); st = n; suffixEls[j].innerHTML = h || '<br>';
      }
      lines = nl; els = els.slice(0, a).concat(newEls, suffixEls); states = states.slice(0, a).concat(newStates, suffixStates);
      if (curLine >= a) curLine = -1;
    }

    // ---------- events ----------
    function onInput(e) {
      if (!doc) return;
      const v = ta.value;
      rehighlight(v);
      fmLines = E.frontMatterLines(v);
      doc.setText(v, 'simple');
      onSel(); schedulePreview();
      try { app.typing?.runInput?.({ mode: 'simple', adapter, element: ta, inTable: false, inputType: e?.inputType, data: e?.data }); } catch (err) { console.warn(err); }
    }
    // right-click in a pipe table: the table menu (Insert, Delete, Align, Sort)
    function onContext(e) {
      if (!app.tables?.contextMenu || !app.tables.cellAt(ta.value, ta.selectionStart)) return;
      e.preventDefault(); app.tables.contextMenu({ x: e.clientX, y: e.clientY });
    }
    function caretLine() { return ta.value.slice(0, ta.selectionStart).split('\n').length - 1; }
    let selRaf = 0;
    function onSel() {
      if (selRaf) return;
      selRaf = requestAnimationFrame(() => {
        selRaf = 0; if (!mounted) return;
        const n = caretLine();
        if (n !== curLine) { els[curLine]?.classList.remove('cur'); els[n]?.classList.add('cur'); curLine = n; }
        ensureCaretVisible();
        app.events.emit('selection:changed', { mode: 'simple', states: adapter.activeStates() });
      });
    }
    function ensureCaretVisible() {
      const el = els[curLine]; if (!el || document.activeElement !== ta) return;
      const top = el.offsetTop, h = el.offsetHeight, st = srcPane.scrollTop, vh = srcPane.clientHeight;
      if (top < st + 8) srcPane.scrollTop = Math.max(0, top - 24);
      else if (top + Math.min(h, vh - 60) > st + vh - 8) srcPane.scrollTop = top + Math.min(h, vh - 60) - vh + 40;
    }

    // Replace [s,e) with text; keeps native undo by going through execCommand when possible.
    function replace(s, e, text, selS, selE) {
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(s, e);
      let ok = false;
      try { ok = text === '' ? (s === e ? true : document.execCommand('delete')) : document.execCommand('insertText', false, text); } catch { ok = false; }
      if (!ok || ta.value.slice(s, s + text.length) !== text) {
        if (ta.value.slice(s, s + text.length) !== text) ta.setRangeText(text, s, e, 'end');
        onInput();
      }
      if (selS != null) ta.setSelectionRange(selS, selE == null ? selS : selE);
      onSel();
    }
    const lineStartOf = (v, i) => v.lastIndexOf('\n', i - 1) + 1;
    const lineEndOf = (v, i) => { const n = v.indexOf('\n', i); return n < 0 ? v.length : n; };

    function onKey(e) {
      if (e.isComposing || e.keyCode === 229) return;
      // typing hooks first (autocomplete ghost text takes Tab / → when it shows)
      if (app.typing?.runKey?.(e, { mode: 'simple', adapter, element: ta, inTable: false })) return;
      const mod = e.ctrlKey || e.metaKey, k = e.key;
      // source-editor keys first (they only make sense here)
      if (mod && !e.altKey && !e.shiftKey && e.code === 'KeyD') { e.preventDefault(); e.stopPropagation(); return duplicateLines(); }
      if (mod && !e.altKey && !e.shiftKey && e.code === 'Slash') { e.preventDefault(); e.stopPropagation(); return toggleComment(); }
      if (e.altKey && !mod && !e.shiftKey && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); e.stopPropagation(); return moveLines(k === 'ArrowUp' ? -1 : 1); }
      if (E.dispatchShortcut(e)) return;
      if (mod && !e.altKey && (e.code === 'KeyZ' || e.code === 'KeyY')) { /* native undo */ return; }
      if (k === 'Enter' && !mod && !e.altKey && !e.shiftKey) { if (smartEnter()) e.preventDefault(); return; }
      if (k === 'Tab' && !mod && !e.altKey) {
        e.preventDefault();
        // in a pipe table: next / previous cell, and the pipes line up (src/tables.js)
        if (app.tables?.sourceTab?.(adapter, e.shiftKey)) return;
        return e.shiftKey ? outdent() : indent();
      }
      if (k === 'Backspace' && !mod && !e.altKey) { if (pairBackspace()) e.preventDefault(); return; }
      if (!mod && !e.altKey && k.length === 1) { if (typeChar(k)) e.preventDefault(); }
    }

    function typeChar(ch) {
      const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
      const prev = v[s - 1] || '', next = v[en] || '';
      if (s !== en && PAIRS[ch]) {
        const sel = v.slice(s, en);
        replace(s, en, ch + sel + PAIRS[ch], s + 1, en + 1);
        return true;
      }
      if (s !== en) return false;
      if ((ch === '*' || ch === '$') && prev === ch && next === ch && v[s - 2] !== ch && v[s + 1] !== ch) {
        replace(s, s, ch + ch, s + 1); return true;
      }
      if (CLOSERS.has(ch) && next === ch && prev !== '\\') {
        // type over a closing character
        ta.setSelectionRange(s + 1, s + 1); onSel(); return true;
      }
      if (!PAIRS[ch]) return false;
      const lineBefore = v.slice(lineStartOf(v, s), s);
      if (PAIRS[ch] === ch) {
        if (/[\p{L}\p{N}]/u.test(prev) || /[\p{L}\p{N}]/u.test(next) || prev === '\\') return false;
        if (ch === '*' && /^\s*$/.test(lineBefore)) return false; // bullet marker
        if (ch === '`' && /^\s*``$/.test(lineBefore)) return false; // fence
        if (ch === '_' && /\w/.test(prev)) return false;
      } else {
        if (/[\p{L}\p{N}]/u.test(next)) return false;
        if (prev === '\\') return false;
      }
      replace(s, s, ch + PAIRS[ch], s + 1); return true;
    }
    function pairBackspace() {
      const v = ta.value, s = ta.selectionStart;
      if (s !== ta.selectionEnd || s === 0) return false;
      const prev = v[s - 1], next = v[s];
      if (PAIRS[prev] && PAIRS[prev] === next) {
        if ((prev === '*' || prev === '$') && v[s - 2] === prev && v[s + 1] === prev) { replace(s - 2, s + 2, '', s - 2); return true; }
        replace(s - 1, s + 1, '', s - 1); return true;
      }
      return false;
    }
    function smartEnter() {
      const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
      if (s !== en) return false;
      const ls = lineStartOf(v, s), le = lineEndOf(v, s), line = v.slice(ls, le), before = v.slice(ls, s);
      // $$|$$ → block
      if (v.slice(s - 2, s) === '$$' && v.slice(s, s + 2) === '$$') { replace(s, s, '\n\n', s + 1); return true; }
      let m = LIST_RE.exec(line);
      if (m && s >= ls + m[0].length) {
        const content = line.slice(m[0].length);
        if (!content.trim()) { replace(ls, le, '', ls); return true; }
        let marker = m[2];
        if (/^\d/.test(marker)) marker = (parseInt(marker, 10) + 1) + marker.slice(-1);
        const prefix = m[1] + marker + (m[3].length > 4 ? ' ' : m[3]) + (m[4] ? '[ ] ' : '');
        replace(s, s, '\n' + prefix, s + 1 + prefix.length);
        return true;
      }
      if ((m = /^(\s*(?:>\s?)+)/.exec(line)) && s >= ls + m[1].length) {
        if (!line.slice(m[1].length).trim()) { replace(ls, le, '', ls); return true; }
        replace(s, s, '\n' + m[1], s + 1 + m[1].length); return true;
      }
      if ((m = /^(\s+)\S/.exec(before))) { replace(s, s, '\n' + m[1], s + 1 + m[1].length); return true; }
      return false;
    }
    function selLines() {
      const v = ta.value; let s = ta.selectionStart, e = ta.selectionEnd;
      if (e > s && v[e - 1] === '\n') e--;
      const a = lineStartOf(v, s), b = lineEndOf(v, e);
      return { a, b, text: v.slice(a, b) };
    }
    function indentUnitFor(v, ls) {
      // previous list line above with indent <= current gives the content column of the parent
      const cur = v.slice(ls, lineEndOf(v, ls)); const curIndent = /^\s*/.exec(cur)[0].length;
      let p = ls - 1;
      while (p > 0) {
        const ps = lineStartOf(v, p), line = v.slice(ps, p);
        if (!line.trim()) break;
        const m = LIST_RE.exec(line);
        if (m && m[1].length <= curIndent) { const col = m[1].length + m[2].length + m[3].length; return Math.max(2, col - curIndent); }
        p = ps - 1;
      }
      return 2;
    }
    function indent() {
      const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
      const { a, b, text } = selLines();
      const multi = text.includes('\n');
      const isList = LIST_RE.test(text);
      if (!multi && !isList && s === e) { replace(s, s, '  ', s + 2); return; }
      const unit = isList && !multi ? ' '.repeat(indentUnitFor(v, a)) : '  ';
      const out = text.split('\n').map(l => (l.trim() ? unit + l : l)).join('\n');
      const n = text.split('\n').filter(l => l.trim()).length;
      replace(a, b, out, s + unit.length, e + unit.length * n);
    }
    function outdent() {
      const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
      const { a, b, text } = selLines();
      let removedFirst = 0, removed = 0;
      const out = text.split('\n').map((l, i) => {
        const ind = /^\s*/.exec(l)[0];
        let cut = Math.min(ind.length, ind.startsWith('\t') ? 1 : (LIST_RE.test(l) ? Math.max(2, Math.min(4, ind.length)) : 2));
        if (LIST_RE.test(l)) {
          // go back to the parent's indent when known
          let p = a - 1, target = 0;
          while (p > 0) { const ps = lineStartOf(v, p), pl = v.slice(ps, p); if (!pl.trim()) break; const m = LIST_RE.exec(pl); if (m && m[1].length < ind.length) { target = m[1].length; break; } p = ps - 1; }
          cut = ind.length - target;
        }
        if (i === 0) removedFirst = cut; removed += cut;
        return l.slice(cut);
      }).join('\n');
      if (out === text) return;
      replace(a, b, out, Math.max(a, s - removedFirst), Math.max(a, e - removed));
    }
    function duplicateLines() {
      const s = ta.selectionStart, e = ta.selectionEnd; const { b, text } = selLines();
      replace(b, b, '\n' + text, s + text.length + 1, e + text.length + 1);
    }
    function moveLines(dir) {
      const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd; const { a, b, text } = selLines();
      if (dir < 0) {
        if (a === 0) return;
        const pa = lineStartOf(v, a - 1), prev = v.slice(pa, a - 1);
        replace(pa, b, text + '\n' + prev, s - prev.length - 1, e - prev.length - 1);
      } else {
        if (b >= v.length) return;
        const nb = lineEndOf(v, b + 1), next = v.slice(b + 1, nb);
        replace(a, nb, next + '\n' + text, s + next.length + 1, e + next.length + 1);
      }
    }
    function toggleComment() {
      const v = ta.value; let s = ta.selectionStart, e = ta.selectionEnd;
      if (s === e) { s = lineStartOf(v, s); e = lineEndOf(v, e); }
      const t = v.slice(s, e); const m = /^<!--\s?([\s\S]*?)\s?-->$/.exec(t);
      if (m) replace(s, e, m[1], s, s + m[1].length);
      else replace(s, e, '<!-- ' + t + ' -->', s, s + t.length + 9);
    }

    async function onPaste(e) {
      const files = [...(e.clipboardData?.files || [])].filter(f => /^image\//.test(f.type));
      if (!files.length) return;
      e.preventDefault();
      for (const f of files) { const r = await E.saveImage(f, doc); adapter.insert(E.imageMarkdown(r.path, r.name)); }
    }
    async function onDrop(e) {
      const files = [...(e.dataTransfer?.files || [])].filter(f => /^image\//.test(f.type));
      if (!files.length) return;
      e.preventDefault();
      ta.focus();
      for (const f of files) { const r = await E.saveImage(f, doc); adapter.insert(E.imageMarkdown(r.path, r.name) + '\n'); }
    }

    // ---------- preview ----------
    function schedulePreview(now) { clearTimeout(pvTimer); pvTimer = setTimeout(renderPreview, now ? 0 : 150); }
    async function renderPreview() {
      if (!mounted || !doc || root.classList.contains('no-preview')) return;
      const seq = ++pvSeq; const text = doc.text;
      let r;
      try { r = await app.render(text, { doc }); } catch (err) { console.error(err); return; }
      if (seq !== pvSeq || !mounted) return;
      const st = pvPane.scrollTop;
      pvPage.innerHTML = r.html;
      E.fixImages(pvPage, doc);
      try { app.layout?.apply?.(pvPage, doc, { preview: true }); } catch {}
      try { await app.decorate(pvPage, doc); } catch (err) { console.error(err); }
      if (seq !== pvSeq) return;
      pvPane.scrollTop = st;
      collectBlocks();
    }
    function collectBlocks() {
      const seen = new Set(); pvBlocks = [];
      pvPage.querySelectorAll('[data-line]').forEach(el => { const n = +el.getAttribute('data-line'); if (!seen.has(n)) { seen.add(n); pvBlocks.push({ line: n, el }); } });
      pvBlocks.sort((a, b) => a.line - b.line);
    }
    const yIn = (el, pane) => el.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
    let syncRaf = 0;
    function syncTo(target) {
      if (syncRaf || !root || root.classList.contains('no-preview')) return; // root is null once the editor is unmounted
      syncRaf = requestAnimationFrame(() => {
        syncRaf = 0; if (!mounted || !pvBlocks.length || !els.length) return;
        if (target === 'pv') {
          const top = srcPane.scrollTop + 28;
          let lo = 0, hi = els.length - 1;
          while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (els[mid].offsetTop <= top) lo = mid; else hi = mid - 1; }
          const el = els[lo]; const frac = el.offsetHeight ? Math.min(1, Math.max(0, (top - el.offsetTop) / el.offsetHeight)) : 0;
          const line = lo - fmLines + frac;
          if (srcPane.scrollTop <= 2) { pvPane.scrollTop = 0; return; }
          let i = 0; while (i + 1 < pvBlocks.length && pvBlocks[i + 1].line <= line) i++;
          const a = pvBlocks[i], b = pvBlocks[i + 1];
          const ya = yIn(a.el, pvPane), yb = b ? yIn(b.el, pvPane) : pvPane.scrollHeight;
          const span = b ? b.line - a.line : Math.max(1, els.length - fmLines - a.line);
          const t = Math.max(0, Math.min(1, (line - a.line) / span));
          pvPane.scrollTop = ya + (yb - ya) * t - 28;
        } else {
          const top = pvPane.scrollTop + 28;
          if (pvPane.scrollTop <= 2) { srcPane.scrollTop = 0; return; }
          let i = 0; while (i + 1 < pvBlocks.length && yIn(pvBlocks[i + 1].el, pvPane) <= top) i++;
          const a = pvBlocks[i], b = pvBlocks[i + 1];
          const ya = yIn(a.el, pvPane), yb = b ? yIn(b.el, pvPane) : pvPane.scrollHeight;
          const t = yb > ya ? Math.max(0, Math.min(1, (top - ya) / (yb - ya))) : 0;
          const la = a.line + fmLines, lb = b ? b.line + fmLines : els.length;
          const exact = la + (lb - la) * t; const li = Math.min(els.length - 1, Math.floor(exact));
          const el = els[li]; if (!el) return;
          srcPane.scrollTop = el.offsetTop + el.offsetHeight * (exact - li) - 28;
        }
      });
    }

    function applyZoom() {
      const z = (app.zoom || 100) / 100;
      const inner = srcPane?.firstChild; if (inner) inner.style.setProperty('--mk-fs', (13.5 * z).toFixed(2) + 'px');
      if (pvPage) pvPage.style.zoom = z;
    }
    // Changes from outside (layout commands, front matter, add-ins) go in as one edit, so Ctrl+Z keeps working:
    // assigning .value would wipe the textarea's undo history.
    function applyDiff(text) {
      const old = ta.value;
      if (!old || !ta.isConnected || old === text || old.length + text.length > 4e6) return false;
      const max = Math.min(old.length, text.length);
      let a = 0; while (a < max && old.charCodeAt(a) === text.charCodeAt(a)) a++;
      let b = 0; while (b < max - a && old.charCodeAt(old.length - 1 - b) === text.charCodeAt(text.length - 1 - b)) b++;
      const ins = text.slice(a, text.length - b);
      const prev = document.activeElement;
      try {
        if (prev !== ta) ta.focus({ preventScroll: true });
        ta.setSelectionRange(a, old.length - b);
        if (ins) document.execCommand('insertText', false, ins); else document.execCommand('delete');
      } catch {}
      if (prev && prev !== ta && prev.focus) { try { prev.focus({ preventScroll: true }); } catch {} }
      return ta.value === text;
    }
    function setValue(text, keepSel) {
      const s = ta.selectionStart, e = ta.selectionEnd, st = srcPane.scrollTop;
      if (!(keepSel && applyDiff(text))) ta.value = text;
      rehighlight(text); fmLines = E.frontMatterLines(text);
      if (keepSel) { ta.setSelectionRange(Math.min(s, text.length), Math.min(e, text.length)); srcPane.scrollTop = st; }
      curLine = -1; onSel(); schedulePreview(true);
    }

    // ---------- Markdown-aware formatting ----------
    function toggleWrap(b, a) {
      a = a ?? b;
      const v = ta.value; let s = ta.selectionStart, e = ta.selectionEnd;
      if (s === e) {
        // inside an empty or existing wrapper?
        if (v.slice(s - b.length, s) === b && v.slice(s, s + a.length) === a) { replace(s - b.length, s + a.length, '', s - b.length); return; }
        // grab the word under the caret
        const L = v.slice(0, s).match(/[\p{L}\p{N}_'-]+$/u), R = v.slice(s).match(/^[\p{L}\p{N}_'-]+/u);
        if (L || R) { s -= L ? L[0].length : 0; e += R ? R[0].length : 0; }
        else { replace(s, s, b + a, s + b.length); return; }
      }
      const sel = v.slice(s, e);
      const single = b.length === 1 && (b === '*' || b === '_' || b === '~' || b === '^' || b === '=');
      const before = v.slice(Math.max(0, s - b.length), s), after = v.slice(e, e + a.length);
      const doubled = single && v[s - 2] === b && v[e + 1] === a && v[s - 3] !== b; // e.g. **x** when toggling *
      if (before === b && after === a && !doubled) { replace(s - b.length, e + a.length, sel, s - b.length, e - b.length); return; }
      if (sel.startsWith(b) && sel.endsWith(a) && sel.length >= b.length + a.length && !(single && sel.startsWith(b + b) && !sel.startsWith(b + b + b))) {
        const inner = sel.slice(b.length, sel.length - a.length); replace(s, e, inner, s, s + inner.length); return;
      }
      replace(s, e, b + sel + a, s + b.length, e + b.length);
    }
    function mapLines(fn) {
      const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd; const { a, b, text } = selLines();
      const ls = text.split('\n'); const out = fn(ls).join('\n');
      if (out === text) return;
      const delta = out.length - text.length;
      replace(a, b, out, s === e ? Math.max(a, Math.min(a + out.length, s + (ls.length === 1 ? delta : 0))) : a, s === e ? undefined : a + out.length);
      if (s === e && ls.length === 1) { const p = Math.max(a, Math.min(a + out.length, s + delta)); ta.setSelectionRange(p, p); }
    }
    const stripList = l => l.replace(LIST_RE, (m0, ind) => ind);
    function setHeading(n) {
      mapLines(ls => ls.map(l => { const body = l.replace(/^#{1,6}\s+/, ''); return n ? '#'.repeat(n) + ' ' + body : body; }));
    }
    function toggleList(kind) {
      mapLines(ls => {
        const nonEmpty = ls.filter(l => l.trim());
        const is = l => { const m = LIST_RE.exec(l); if (!m) return false; if (kind === 'task') return !!m[4]; if (kind === 'ol') return /\d/.test(m[2]) && !m[4]; return !/\d/.test(m[2]) && !m[4]; };
        if (nonEmpty.length && nonEmpty.every(is)) return ls.map(l => l.replace(LIST_RE, (m0, ind) => ind));
        let n = 1;
        return ls.map(l => { if (!l.trim()) return l; const ind = /^\s*/.exec(l)[0]; const body = stripList(l).slice(ind.length); return ind + (kind === 'ol' ? (n++) + '. ' : kind === 'task' ? '- [ ] ' : '- ') + body; });
      });
    }
    function toggleQuote() {
      mapLines(ls => { const all = ls.filter(l => l.trim()).every(l => /^\s*>/.test(l)); return ls.map(l => all ? l.replace(/^(\s*)>\s?/, '$1') : '> ' + l); });
    }
    function paragraphRange() {
      const v = ta.value; let a = lineStartOf(v, ta.selectionStart), b = lineEndOf(v, ta.selectionEnd);
      while (a > 0) { const pa = lineStartOf(v, a - 1); if (!v.slice(pa, a - 1).trim()) break; a = pa; }
      while (b < v.length) { const nb = lineEndOf(v, b + 1); if (!v.slice(b + 1, nb).trim()) break; b = nb; }
      return { a, b };
    }
    function setAlign(al) {
      const v = ta.value, s = ta.selectionStart;
      // enclosing <div align=…> block?
      const open = /<div align="(left|center|right|justify)">\s*\n/g; let m, enc = null;
      while ((m = open.exec(v)) && m.index <= s) { const close = v.indexOf('</div>', m.index); if (close >= s || close < 0) enc = { a: m.index, inner: m.index + m[0].length, close, al: m[1] }; }
      if (enc && enc.close >= 0) {
        const innerText = v.slice(enc.inner, enc.close).replace(/^\n+|\n+$/g, '');
        const end = enc.close + 6;
        if (al === 'left') { replace(enc.a, end, innerText, enc.a); return; }
        const out = `<div align="${al}">\n\n${innerText}\n\n</div>`; replace(enc.a, end, out, enc.a + out.indexOf(innerText)); return;
      }
      if (al === 'left') return;
      const { a, b } = paragraphRange(); const t = v.slice(a, b);
      const out = `<div align="${al}">\n\n${t}\n\n</div>`; replace(a, b, out, a + out.indexOf(t) + (s - a));
    }

    // ---------- adapter ----------
    const adapter = {
      name: 'simple',
      mount(container, d) {
        if (mounted) adapter.unmount();
        host = container; doc = d; mounted = true;
        if (!root) build();
        host.appendChild(root);
        root.classList.toggle('no-preview', app.settings.get('simplePreview', true) === false);
        setValue(doc ? doc.text : '', false);
        ta.readOnly = !!doc?.readOnly;
        ta.setSelectionRange(0, 0); srcPane.scrollTop = 0;
        applyZoom();
        offs.push(app.events.on('doc:changed', ({ doc: dd, origin }) => { if (dd === doc && origin !== 'simple' && ta.value !== dd.text) setValue(dd.text, true); }));
        offs.push(app.events.on('zoom:changed', applyZoom));
        offs.push(app.events.on('theme:changed', () => schedulePreview(true)));
        offs.push(app.events.on('layout:changed', () => schedulePreview(true)));
        offs.push(app.events.on('settings:changed', ({ key }) => { if (key === 'simplePreview') { root.classList.toggle('no-preview', app.settings.get('simplePreview', true) === false); schedulePreview(true); } if (/^(mathMacros|fontFamily|fontSize)$/.test(key)) schedulePreview(true); }));
        setTimeout(() => mounted && host && ta.focus({ preventScroll: true }), 0);
      },
      unmount() {
        if (!mounted) return;
        mounted = false; clearTimeout(pvTimer);
        offs.splice(0).forEach(f => { try { f(); } catch {} });
        // keep the build but re-add document listener next mount
        root?.remove(); root = null; host = null; doc = null; els = []; lines = []; states = []; curLine = -1;
      },
      get doc() { return doc; },
      get textarea() { return ta; },
      flush() {},
      getSelection() { if (!ta) return { text: '', start: 0, end: 0 }; return { text: ta.value.slice(ta.selectionStart, ta.selectionEnd), start: ta.selectionStart, end: ta.selectionEnd }; },
      setSelection(s, e) { ta.focus(); ta.setSelectionRange(s, e ?? s); onSel(); },
      replaceSelection(md) { const s = ta.selectionStart, e = ta.selectionEnd; replace(s, e, md, s + md.length); },
      insert(md) { const s = ta.selectionStart, e = ta.selectionEnd; replace(s, e, md, s + md.length); },
      insertBlock(md) {
        md = md.replace(/^\n+|\n+$/g, '');
        const s = ta.selectionStart, e = ta.selectionEnd;
        if (s !== e) replace(s, e, '');
        const v = ta.value, pos = ta.selectionStart;
        const ls = lineStartOf(v, pos), le = lineEndOf(v, pos), line = v.slice(ls, le);
        const prevLine = ls > 0 ? v.slice(lineStartOf(v, ls - 1), ls - 1) : '';
        const nextLine = le < v.length ? v.slice(le + 1, lineEndOf(v, le + 1)) : '';
        if (!line.trim()) {
          const pre = prevLine.trim() ? '\n' : '', post = nextLine.trim() ? '\n' : '';
          replace(ls, le, pre + md + post, ls + pre.length + md.length);
        } else {
          const post = le >= v.length || nextLine.trim() ? '\n' : '';
          replace(le, le, '\n\n' + md + post, le + 2 + md.length);
        }
      },
      wrap(before, after) { toggleWrap(before, after ?? before); },
      format(kind) {
        if (!ta) return;
        const W = { bold: ['**'], italic: ['*'], underline: ['<u>', '</u>'], strike: ['~~'], code: ['`'], sub: ['~'], sup: ['^'], highlight: ['=='] };
        if (W[kind]) return toggleWrap(W[kind][0], W[kind][1] ?? W[kind][0]);
        let m;
        if ((m = /^h([1-6])$/.exec(kind))) { const cur = adapter.activeStates().heading; return setHeading(cur === +m[1] ? 0 : +m[1]); }
        if (kind === 'p') { mapLines(ls => ls.map(l => l.replace(/^#{1,6}\s+/, '').replace(/^(\s*)>\s?/, '$1'))); return; }
        if (kind === 'quote') return toggleQuote();
        if (kind === 'ul' || kind === 'ol' || kind === 'task') return toggleList(kind);
        if (kind === 'indent') return indent();
        if (kind === 'outdent') return outdent();
        if ((m = /^align(Left|Center|Right|Justify)$/.exec(kind))) return setAlign(m[1].toLowerCase());
        if (kind === 'codeBlock') { const { a, b, text } = selLines(); const out = '```\n' + text + '\n```'; replace(a, b, out, a + 4); return; }
        if (kind === 'clear') {
          const s = ta.selectionStart, e = ta.selectionEnd; if (s === e) return;
          const t = ta.value.slice(s, e).replace(/\*\*|__|~~|==|<\/?(u|mark|sub|sup|span|font)[^>]*>/g, '').replace(/(^|[^\w*])[*_]([^*_]+)[*_]/g, '$1$2').replace(/`([^`]*)`/g, '$1');
          replace(s, e, t, s, s + t.length); return;
        }
      },
      activeStates() {
        if (!ta) return {};
        const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
        const ls = lineStartOf(v, s), line = v.slice(ls, lineEndOf(v, s));
        const around = (b, a) => { a = a ?? b; const L = v.slice(Math.max(0, ls), s), R = v.slice(e, lineEndOf(v, e)); const i = L.lastIndexOf(b), j = R.indexOf(a); return i >= 0 && j >= 0 && !L.slice(i + b.length).includes(a === b ? b : a); };
        const bold = around('**');
        const lm = LIST_RE.exec(line);
        const hm = /^(#{1,6})\s/.exec(line);
        let align = 'left'; const before = v.slice(0, s); const mm = [...before.matchAll(/<div align="(\w+)">/g)].pop(); if (mm && !before.slice(mm.index).includes('</div>')) align = mm[1];
        return {
          bold, italic: /(^|[^*])\*[^*\s]/.test(v.slice(ls, s).replace(/\*\*/g, '')) && around('*') && !(/\*\*$/.test(v.slice(ls, s)) && !/\*\*\*$/.test(v.slice(ls, s))) || around('_'),
          underline: around('<u>', '</u>'), strike: around('~~'), highlight: around('=='), code: (v.slice(ls, s).split('`').length - 1) % 2 === 1,
          sub: false, sup: false,
          heading: hm ? hm[1].length : 0, quote: /^\s*>/.test(line),
          list: lm ? (lm[4] ? 'task' : /\d/.test(lm[2]) ? 'ol' : 'ul') : null, align,
        };
      },
      focus() { ta?.focus({ preventScroll: true }); },
      scrollToLine(n, opts = {}) {
        if (!ta) return;
        n = Math.max(0, Math.min(els.length - 1, n | 0));
        const el = els[n]; if (!el) return;
        driver = 'src';
        srcPane.scrollTop = Math.max(0, el.offsetTop - srcPane.clientHeight / 4);
        const v = ta.value; let pos = 0; for (let i = 0; i < n; i++) { const k = v.indexOf('\n', pos); if (k < 0) break; pos = k + 1; }
        if (opts.caret !== false) { ta.focus({ preventScroll: true }); ta.setSelectionRange(pos, pos); onSel(); }
        syncTo('pv');
      },
      getText() { return ta ? ta.value : doc?.text || ''; },
      refresh() { if (doc) setValue(doc.text, true); },
      find(query, opts = {}) {
        if (!ta || !query) return { count: 0, index: -1 };
        const re = E.findRegex(query, opts); const v = ta.value; const all = [...v.matchAll(re)];
        if (!all.length) return { count: 0, index: -1 };
        const from = opts.backwards ? ta.selectionStart : ta.selectionEnd;
        let i = opts.backwards ? all.map(m => m.index).filter(x => x < from).length - 1 : all.findIndex(m => m.index >= from);
        if (i < 0) i = opts.backwards ? all.length - 1 : 0;
        const m = all[i]; ta.focus({ preventScroll: true }); ta.setSelectionRange(m.index, m.index + m[0].length); onSel();
        const ln = v.slice(0, m.index).split('\n').length - 1; const el = els[ln];
        if (el && (el.offsetTop < srcPane.scrollTop || el.offsetTop > srcPane.scrollTop + srcPane.clientHeight - 40)) srcPane.scrollTop = el.offsetTop - srcPane.clientHeight / 3;
        return { count: all.length, index: i };
      },
      replace(query, replacement, opts = {}) {
        const re = E.findRegex(query, opts); const s = ta.selectionStart, e = ta.selectionEnd; const sel = ta.value.slice(s, e);
        const one = new RegExp('^(?:' + re.source + ')$', re.flags.replace('g', ''));
        if (sel && one.test(sel)) { const rep = opts.regex ? sel.replace(one, replacement) : replacement; replace(s, e, rep, s + rep.length); }
        return adapter.find(query, opts);
      },
      replaceAll(query, replacement, opts = {}) {
        const re = E.findRegex(query, opts); const v = ta.value; let n = 0;
        const out = v.replace(re, (...a) => { n++; return opts.regex ? a[0].replace(new RegExp(re.source, re.flags.replace('g', '')), replacement) : replacement; });
        if (n) replace(0, v.length, out, 0);
        return n;
      },
      undo() { ta?.focus(); document.execCommand('undo'); },
      redo() { ta?.focus(); document.execCommand('redo'); },
      togglePreview(show) {
        const on = show ?? root.classList.contains('no-preview');
        app.settings.set('simplePreview', !!on);
        root?.classList.toggle('no-preview', !on);
        if (on) schedulePreview(true);
      },
      get previewEl() { return pvPage; },
      _typeChar: (ch) => typeChar(ch),
      _renderPreview: () => renderPreview(),
    };
    return adapter;
  }

  E.findRegex = (query, opts = {}) => {
    let src = opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (opts.wholeWord) src = '\\b' + src + '\\b';
    try { return new RegExp(src, 'g' + (opts.caseSensitive ? '' : 'i') + 'u'); } catch { return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); }
  };

  E.createSimple = createSimpleEditor;
  const simple = createSimpleEditor();
  app.editors.register('simple', simple);

  app.commands.register('view.togglePreview', {
    label: 'Show or hide the live preview (Simple mode)', icon: 'side',
    run: () => { if (app.mode !== 'simple') app.setMode('simple'); (app.editors.get('simple'))?.togglePreview?.(); },
    isActive: () => app.settings.get('simplePreview', true) !== false,
  });

  // ------------------------------------------------------------------ smoke tests
  function offscreen() {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-12000px;top:0;width:1100px;height:700px;overflow:hidden';
    document.body.appendChild(host); return host;
  }
  E.fakeDoc = (text) => {
    const d = { id: 'test-' + Math.random().toString(36).slice(2), title: 'Test', path: null, kind: 'markdown', text, readOnly: false, meta: {},
      setText(t) { d.text = t; } };
    return d;
  };
  E._offscreen = offscreen;
  app.tests.register('editor: Simple autopair [ inserts ]', async () => {
    const host = offscreen(); const ed = createSimpleEditor(); const d = E.fakeDoc('See also ');
    try {
      ed.mount(host, d); const ta = ed.textarea; ta.focus(); ta.setSelectionRange(9, 9);
      const ev = new KeyboardEvent('keydown', { key: '[', code: 'BracketLeft', bubbles: true, cancelable: true });
      ta.dispatchEvent(ev);
      app.assert(ta.value === 'See also []', 'got ' + JSON.stringify(ta.value));
      app.assert(ta.selectionStart === 10, 'caret between brackets, got ' + ta.selectionStart);
      app.assert(d.text === 'See also []', 'doc text updated');
      // type-over the closing bracket
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: ']', code: 'BracketRight', bubbles: true, cancelable: true }));
      app.assert(ta.value === 'See also []' && ta.selectionStart === 11, 'type-over ]');
    } finally { ed.unmount(); host.remove(); }
  });
  app.tests.register('editor: Simple list continuation and highlight', async () => {
    const host = offscreen(); const ed = createSimpleEditor(); const d = E.fakeDoc('- one');
    try {
      ed.mount(host, d); const ta = ed.textarea; ta.focus(); ta.setSelectionRange(5, 5);
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
      app.assert(ta.value === '- one\n- ', 'continues bullet, got ' + JSON.stringify(ta.value));
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
      app.assert(ta.value === '- one\n', 'empty item ends list, got ' + JSON.stringify(ta.value));
      ed.setSelection(0, 0); ed.insert('$x$ ');
      const html = host.querySelector('.mk-src-mirror').innerHTML;
      app.assert(/t-math/.test(html), 'math highlighted purple');
    } finally { ed.unmount(); host.remove(); }
  });
})();
