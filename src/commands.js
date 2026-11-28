// Markooj — Home, Insert and Layout commands, their ribbon groups, the equation editor and page layout.
(function () {
  'use strict';
  const app = window.app; if (!app) return;
  const mk = app.mk || window.mk || {};
  const E = app.editor = app.editor || {};
  const esc = E.esc || (s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const ed = () => (E.target ? E.target() : app.editors.active());
  const editable = () => { if (E.testTarget) return true; const d = app.docs.active(); return !!(d && d.kind === 'markdown' && !d.readOnly && app.editors.active()); };
  const isWord = () => (E.testTarget ? E.testTarget.name === 'word' : app.mode === 'word');
  let states = {};
  app.events.on('selection:changed', p => { states = (p && p.states) || {}; refreshCustom(); });
  app.events.on('mode:changed', () => { states = {}; refreshCustom(); });
  app.events.on('doc:active', () => { states = {}; refreshCustom(); });

  // ------------------------------------------------------------------ extra icons (mock style, 24px grid, stroke)
  const ICONS = {
    'mk-omega': '<path d="M5 20h4v-2.5A7 7 0 1 1 15 17.5V20h4"/>',
    'mk-clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'mk-clear': '<path d="M5 18 11 4h2l2.2 5.2M7.5 13h5M15 15l6 6M21 15l-6 6"/>',
    'mk-break': '<path d="M6 3v5h12V3M6 21v-5h12v5"/><path d="M3 12h3M9 12h2M14 12h2M19 12h2"/>',
    'mk-lines': '<path d="M10 6h11M10 12h11M10 18h11M4 8l2-3 2 3M4 16l2 3 2-3M6 5v14"/>',
    'mk-space': '<path d="M3 5h18M3 19h18M8 10h8M8 14h8"/>',
    'mk-font': '<path d="M4 20 10 4h2l6 16M6.5 14h9"/>',
  };
  (function injectIcons() {
    if (document.getElementById('mk-editor-icons')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'mk-editor-icons'; svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
    svg.innerHTML = '<defs>' + Object.entries(ICONS).map(([id, p]) => `<symbol id="${id}" viewBox="0 0 24 24">${p}</symbol>`).join('') + '</defs>';
    const add = () => document.body.appendChild(svg);
    if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
  })();
  const icon = n => `<svg class="i"><use href="#${n}"/></svg>`;

  // ------------------------------------------------------------------ CSS
  E.injectCSS?.('mk-commands-css', `
.mk-modal-wrap{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;background:rgba(0,0,0,.18);backdrop-filter:blur(2px);opacity:0;transition:opacity .2s}
.mk-modal-wrap.show{opacity:1}
.mk-modal{width:min(var(--w,460px),calc(100vw - 32px));max-height:calc(100vh - 48px);display:flex;flex-direction:column;background:var(--chrome-solid,#fbfbfd);color:var(--text);border-radius:14px;box-shadow:var(--pop-shadow);font:13px/1.4 var(--font);transform:translateY(8px) scale(.985);transition:transform .3s var(--ease)}
.mk-modal-wrap.show .mk-modal{transform:none}
.mk-modal header{padding:16px 20px 4px;font:600 15px var(--font);letter-spacing:-.01em}
.mk-modal .mk-mbody{padding:10px 20px;overflow:auto;display:flex;flex-direction:column;gap:12px}
.mk-modal footer{display:flex;align-items:center;gap:8px;padding:12px 20px 16px}
.mk-modal footer .hint{color:var(--text-3);font-size:11.5px;margin-right:auto}
.mk-btn{height:30px;padding:0 14px;border-radius:8px;border:.5px solid var(--line-2);background:var(--surface);color:var(--text);font:500 13px var(--font);transition:background .15s,border-color .15s,transform .1s var(--ease)}
.mk-btn:hover{border-color:var(--accent)}.mk-btn:active{transform:scale(.97)}
.mk-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.mk-btn.primary:hover{background:var(--accent-2)}
.mk-btn.danger{color:#e0244b}
.mk-btn:focus-visible,.mk-field input:focus,.mk-field textarea:focus,.mk-field select:focus{outline:none;box-shadow:0 0 0 3px var(--accent-ring)}
.mk-field{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--text-2)}
.mk-field input,.mk-field textarea,.mk-field select{height:32px;border-radius:8px;border:.5px solid var(--line-2);background:var(--surface);color:var(--text);padding:0 10px;font:13px var(--font);transition:box-shadow .15s,border-color .15s}
.mk-field textarea{height:auto;min-height:90px;padding:8px 10px;font:13px/1.55 var(--mono);resize:vertical}
.mk-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.mk-seg{position:relative;display:inline-flex;background:var(--hover);border-radius:8px;padding:2px;gap:0}
.mk-seg button{position:relative;z-index:1;height:24px;padding:0 12px;border-radius:6px;font:500 12px var(--font);color:var(--text-2);border:0;background:none;transition:color .2s,background .2s,box-shadow .2s}
.mk-seg button.on{color:var(--text);background:var(--surface);box-shadow:0 1px 3px rgba(0,0,0,.12),0 0 0 .5px rgba(0,0,0,.04)}
.mk-check{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-2)}
.mk-check input{accent-color:var(--accent)}
.mk-grid{display:grid;grid-template-columns:repeat(8,18px);gap:3px;padding:6px 8px 4px}
.mk-grid button{width:18px;height:18px;border-radius:3px;border:.5px solid var(--line-2);background:var(--surface);padding:0;transition:background .08s,border-color .08s}
.mk-grid button.on{background:var(--accent-soft);border-color:var(--accent)}
.mk-grid button:focus-visible{outline:none;box-shadow:0 0 0 2px var(--accent-ring)}
.mk-grid-label{font:12px var(--font);color:var(--text-2);padding:2px 10px 6px;text-align:center}
.mk-symgrid{display:grid;grid-template-columns:repeat(10,30px);gap:2px;padding:4px 6px}
.mk-symgrid button{width:30px;height:30px;border-radius:6px;border:0;background:none;color:var(--text);font:16px var(--serif);transition:background .12s}
.mk-symgrid button:hover,.mk-symgrid button:focus-visible{background:var(--accent);color:#fff;outline:none}
.mk-swatches{display:grid;grid-template-columns:repeat(6,24px);gap:6px;padding:6px 10px 8px}
.mk-swatches button{width:24px;height:24px;border-radius:6px;border:.5px solid var(--line-2);transition:transform .12s var(--ease),box-shadow .15s}
.mk-swatches button:hover,.mk-swatches button:focus-visible{transform:scale(1.12);box-shadow:0 0 0 2px var(--accent-ring);outline:none}
.mk-rb{display:flex;gap:2px;align-items:center}
.mk-rb .ib{width:28px;height:27px;border-radius:6px;display:grid;place-items:center;color:var(--text);border:0;background:none;font:inherit;transition:background .15s,color .15s,transform .1s var(--ease)}
.mk-rb .ib:hover{background:var(--hover)}.mk-rb .ib:active{background:var(--press);transform:scale(.92)}
.mk-rb .ib.on{background:var(--accent-soft);color:var(--accent)}
.mk-rb .ib b,.mk-rb .ib i,.mk-rb .ib u,.mk-rb .ib s{font:600 14px var(--serif)}
.mk-rb .ib svg.i{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.mk-rb .sep{width:.5px;height:18px;background:var(--line-2);margin:0 3px}
.mk-rb .swatch{position:relative}.mk-rb .swatch::after{content:"";position:absolute;left:7px;right:7px;bottom:4px;height:3px;border-radius:2px;background:var(--c)}
.mk-rb .split{display:inline-flex;align-items:center;border-radius:6px;transition:background .15s}
.mk-rb .split:hover{background:var(--hover)}
.mk-rb .split .ib:hover{background:var(--press)}
.mk-rb .split .dd{width:13px;height:27px;border-radius:0 6px 6px 0;display:grid;place-items:center;color:var(--text-3);border:0;background:none}
.mk-rb .split .dd svg{width:9px;height:9px;fill:none;stroke:currentColor;stroke-width:2.2}
.mk-gallery{display:flex;gap:4px;padding:2px;border-radius:9px;border:.5px solid var(--line);align-items:stretch}
.mk-gallery .sty{width:76px;height:58px;border-radius:7px;background:var(--surface);border:.5px solid var(--line);padding:6px 8px;display:flex;flex-direction:column;justify-content:space-between;text-align:left;color:var(--text);transition:border-color .15s,box-shadow .2s,transform .15s var(--ease)}
.mk-gallery .sty:hover,.mk-gallery .sty:focus-visible{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);transform:translateY(-1px);outline:none}
.mk-gallery .sty.on{border-color:var(--accent);box-shadow:0 0 0 1.5px var(--accent)}
.mk-gallery .sty .p{font-family:var(--serif);color:var(--text);white-space:nowrap;overflow:hidden}
.mk-gallery .sty .n{font-size:10px;color:var(--text-3)}
.mk-gallery .more{width:18px;border-radius:6px;border:0;background:none;color:var(--text-3);display:grid;place-items:center;transition:background .15s,color .15s}
.mk-gallery .more:hover{background:var(--hover);color:var(--text)}
.mk-gallery .more svg{width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:2}
.mk-page[data-mk-theme=modern]{font-family:var(--font)}
.mk-page[data-mk-theme=modern] h2{color:var(--accent)}
.mk-page[data-mk-theme=academic]{font-family:"Times New Roman","Cambria","Georgia",serif;text-align:justify;hyphens:auto}
.mk-page[data-mk-theme=academic] h1,.mk-page[data-mk-theme=academic] h2,.mk-page[data-mk-theme=academic] h3,.mk-page[data-mk-theme=academic] h4{font-family:"Times New Roman","Cambria","Georgia",serif;color:var(--text);letter-spacing:0}
.mk-page[data-mk-theme=academic] .mk-front{text-align:center}
.mk-page[data-mk-theme=academic] h1{font-size:24px}.mk-page[data-mk-theme=academic] h2{font-size:18px}.mk-page[data-mk-theme=academic] h3{font-size:16px;font-style:italic}
.mk-page[data-mk-theme=compact]{font-family:var(--font)}
.mk-page[data-mk-theme=compact] h1{font-size:24px}.mk-page[data-mk-theme=compact] h2{font-size:16.5px;margin:18px 0 6px}.mk-page[data-mk-theme=compact] h3{font-size:14px;margin:14px 0 4px}
.mk-page[data-mk-cols="2"]{column-count:2;column-gap:40px}
.mk-page[data-mk-cols="2"] .mk-front,.mk-page[data-mk-cols="2"] h1,.mk-page[data-mk-cols="2"] .mk-math-block,.mk-page[data-mk-cols="2"] table{column-span:all}
.mk-page p{margin-bottom:var(--mk-para,12px)}
`);

  // ------------------------------------------------------------------ modal dialog (own, so the equation editor can be rich)
  E.modal = ({ title, body, buttons = [{ label: app.t('Cancel'), value: null }, { label: app.t('OK'), value: true, primary: true }], width, hint, onOpen }) => new Promise(resolve => {
    const prevFocus = document.activeElement;
    const s0 = getSelection(); const prevRange = s0.rangeCount ? s0.getRangeAt(0).cloneRange() : null;
    const wrap = document.createElement('div'); wrap.className = 'mk-modal-wrap';
    const box = document.createElement('div'); box.className = 'mk-modal'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title);
    if (width) box.style.setProperty('--w', width + 'px');
    const h = document.createElement('header'); h.textContent = title;
    const b = document.createElement('div'); b.className = 'mk-mbody';
    let done = false;
    const close = (v) => { if (done) return; done = true; wrap.classList.remove('show'); document.removeEventListener('keydown', onKey, true); setTimeout(() => wrap.remove(), 200);
      try {
        prevFocus?.focus?.({ preventScroll: true });
        // put the caret back where it was (focusing a contenteditable page would move it to the top)
        if (prevRange && prevFocus && prevFocus.isContentEditable && prevFocus.contains(prevRange.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(prevRange); }
      } catch {}
      resolve(v); };
    const api = { close, el: box };
    const content = typeof body === 'function' ? body(api) : body;
    if (typeof content === 'string') b.innerHTML = content; else if (content) b.appendChild(content);
    const f = document.createElement('footer');
    if (hint) { const s = document.createElement('span'); s.className = 'hint'; s.textContent = hint; f.appendChild(s); } else { const s = document.createElement('span'); s.className = 'hint'; f.appendChild(s); }
    let primary = null;
    for (const bt of buttons) {
      const x = document.createElement('button'); x.type = 'button'; x.className = 'mk-btn' + (bt.primary ? ' primary' : '') + (bt.danger ? ' danger' : ''); x.textContent = bt.label;
      x.addEventListener('click', () => close(typeof bt.value === 'function' ? bt.value(api) : bt.value));
      if (bt.primary) primary = x; f.appendChild(x);
    }
    box.append(h, b, f); wrap.appendChild(box); document.body.appendChild(wrap);
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(null); });
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || (e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON'))) { e.preventDefault(); e.stopPropagation(); primary?.click(); }
      else if (e.key === 'Tab') { const f2 = [...box.querySelectorAll('button,input,textarea,select,[tabindex]')].filter(x => !x.disabled && x.offsetParent); if (!f2.length) return; const i = f2.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f2[f2.length - 1].focus(); } else if (!e.shiftKey && i === f2.length - 1) { e.preventDefault(); f2[0].focus(); } }
    }
    document.addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => { wrap.classList.add('show'); (box.querySelector('[autofocus]') || box.querySelector('input,textarea,select') || primary)?.focus(); onOpen?.(api); });
  });
  const field = (label, input) => { const l = document.createElement('label'); l.className = 'mk-field'; l.innerHTML = `<span>${esc(label)}</span>`; l.appendChild(input); return l; };
  const inputEl = (value = '', attrs = {}) => { const i = document.createElement(attrs.tag || 'input'); if (attrs.tag !== 'textarea') i.type = attrs.type || 'text'; Object.entries(attrs).forEach(([k, v]) => { if (k !== 'tag' && k !== 'type') i.setAttribute(k, v); }); i.value = value; return i; };
  E.sourceDialog = async ({ title, label, value, hint }) => {
    const ta = inputEl(value, { tag: 'textarea', rows: 12, spellcheck: 'false', autofocus: '' }); ta.style.minHeight = '220px';
    const v = await E.modal({ title, width: 560, hint: hint || app.t('Ctrl+Enter to apply'), body: field(label, ta), buttons: [{ label: app.t('Cancel'), value: null }, { label: app.t('Apply'), value: () => ta.value, primary: true }] });
    return v;
  };

  // ------------------------------------------------------------------ equations → app.equationEditor (src/equation-editor.js)
  // The visual editor lives in equation-editor.js. Labels use `$$ … $$ {#eq:label}`; numbers come from app.xref (no \tag).
  const inlineDelims = () => (app.settings.get('inlineMath', 'd') === 'paren' ? ['\\(', '\\)'] : ['$', '$']);
  function eqMarkdown(r) {
    if (app.equationEditor?.markdown) return app.equationEditor.markdown(r);
    if (!r.display) { const [o, c] = inlineDelims(); return o + r.tex + c; }
    const l = String(r.label || '').replace(/^#/, ''); return `$$\n${r.tex}\n$$` + (l ? ` {#${/^eq:/.test(l) ? l : 'eq:' + l}}` : '');
  }
  async function insertEquation(args = {}) {
    const e = ed(); if (!e) return;
    const EQ = app.equationEditor;
    // Simple (source) mode: the caret inside $…$ or $$…$$ edits that equation in place
    let found = null;
    if (!args.direct && e.setSelection && EQ?.findInSource) {
      try { const s = e.getSelection?.(); if (s && Number.isFinite(s.start)) found = EQ.findInSource(e.getText?.() ?? '', s.start, Number.isFinite(s.end) ? s.end : s.start); } catch {}
    }
    const sel = found ? '' : (e.getSelection?.().text || '');
    let res;
    if (args.tex != null && args.direct) res = { tex: String(args.tex), display: !!args.display, label: args.display ? (args.label || '') : '', unnumbered: !!(args.display && args.unnumbered) };
    else if (EQ?.open) {
      res = await EQ.open(found ? { tex: found.tex, display: found.display, label: found.label, unnumbered: found.unnumbered, delim: found.delim, editing: true }
        : { tex: args.tex ?? (sel && sel.length < 300 && /[\\^_=]/.test(sel) ? sel : ''), display: args.display, label: args.label, numbered: args.numbered });
    } else {
      const v = await app.ui.prompt(found ? app.t('Edit equation') : app.t('Insert equation'), 'LaTeX', found ? found.tex : (args.tex || ''));
      res = v == null || !v.trim() ? null : { tex: v.trim(), display: found ? found.display : args.display ?? true, label: found?.label || '' };
    }
    if (!res || !String(res.tex || '').trim()) return;
    const md = eqMarkdown(res);
    e.focus?.();
    // caret in a table cell: one line that fits the cell ($$ … $$ {#eq:x}); src/xref.js numbers it like any other
    if (res.display && app.tables?.inTable?.() && app.xref?.cellEquationMarkdown) {
      const one = app.xref.cellEquationMarkdown(res);
      if (found) { e.setSelection(found.start, found.end); await e.replaceSelection(one); } else await e.insert(one);
      app.xref.tellCell?.();
      if (res.label) { try { await app.xref.refresh?.(); } catch {} }
      return res;
    }
    if (found) {
      e.setSelection(found.start, found.end);
      if (!!res.display === !!found.display) await e.replaceSelection(md);
      else { await e.replaceSelection(''); if (res.display) await (e.insertBlock ? e.insertBlock(md) : e.insert(`\n\n${md}\n\n`)); else await e.insert(md); }
    } else if (res.display) await (e.insertBlock ? e.insertBlock(md) : e.insert(`\n\n${md}\n\n`));
    else await e.insert(md);
    if (res.label || found?.label) { try { await app.xref?.refresh?.(); } catch {} }
    return res;
  }

  // ------------------------------------------------------------------ helpers for commands
  const run = (fn) => async (args) => { const e = ed(); if (!e) return; return fn(e, args || {}); };
  const fmt = (kind) => run(e => e.format(kind));
  const active = (key, val = true) => () => (val === true ? !!states[key] : states[key] === val);
  const block = (e, md) => (e.insertBlock ? e.insertBlock(md) : e.insert('\n\n' + md + '\n\n'));
  const setDocText = (text, origin = 'layout') => { const d = app.docs.active(); if (d && text !== d.text) d.setText(text, origin); };
  function reg(id, def) { app.commands.register(id, { isEnabled: editable, ...def }); }

  // ------------------------------------------------------------------ Clipboard
  async function readClipboard() {
    const out = { html: '', text: '', files: [] };
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        for (const t of it.types) {
          if (t === 'text/html') out.html = await (await it.getType(t)).text();
          else if (t === 'text/plain') out.text = await (await it.getType(t)).text();
          else if (/^image\//.test(t)) { const blob = await it.getType(t); out.files.push(new File([blob], 'pasted.' + t.split('/')[1], { type: t })); }
        }
      }
    } catch { try { out.text = await navigator.clipboard.readText(); } catch {} }
    return out;
  }
  reg('edit.cut', { label: app.tm('Cut'), icon: 'cut', hint: 'Ctrl+X', run: run(e => { e.focus?.(); document.execCommand('cut'); }) });
  reg('edit.copy', { label: app.tm('Copy'), icon: 'copy', hint: 'Ctrl+C', isEnabled: () => !!app.editors.active(), run: run(e => { e.focus?.(); document.execCommand('copy'); }) });
  reg('edit.paste', {
    label: app.tm('Paste'), icon: 'paste', hint: 'Ctrl+V', run: run(async e => {
      e.focus?.();
      try { if (document.execCommand('paste')) return; } catch {}
      const c = await readClipboard();
      if (c.files.length) { for (const f of c.files) { const r = await E.saveImage(f, app.docs.active()); await e.insert(E.imageMarkdown(r.path, r.name)); } return; }
      if (isWord() && c.html) { const dt = new DataTransfer(); dt.setData('text/html', c.html); dt.setData('text/plain', c.text); const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); (e.page || document.activeElement).dispatchEvent(ev); return; }
      if (c.text) { if (isWord() && E.looksLikeMarkdown?.(c.text)) await e.insert(c.text); else insertPlain(e, c.text); return; }
      app.ui.toast(app.t('Copy something first, or press Ctrl+V to paste. The clipboard looks empty.'), { kind: 'info' });
    }),
  });
  function insertPlain(e, text) {
    e.focus?.();
    if (isWord()) { document.execCommand('insertText', false, text); return; }
    e.insert(text);
  }
  reg('edit.pastePlain', { label: app.tm('Paste as plain text'), icon: 'doc', shortcut: 'Ctrl+Shift+V', run: run(async e => { const c = await readClipboard(); if (c.text) insertPlain(e, c.text); else app.ui.toast(app.t('Copy some text first, then paste it as plain text. The clipboard has no text right now.'), { kind: 'info' }); }) });
  reg('format.painter', {
    label: app.tm('Format painter'), icon: 'brush', description: app.tm('Copy the formatting of the selection, then select text to apply it. Esc cancels.'),
    run: run(e => { if (e.startPainter) e.startPainter(); else app.ui.toast(app.t('Switch to Word mode (Ctrl+1) to use Format Painter. In Simple mode, copy the ** or * marks.'), { kind: 'info' }); }),
  });
  if (!app.commands.get('edit.undo')) reg('edit.undo', { label: app.tm('Undo'), icon: 'undo', hint: 'Ctrl+Z', run: run(e => e.undo?.()) });
  if (!app.commands.get('edit.redo')) reg('edit.redo', { label: app.tm('Redo'), icon: 'redo', hint: 'Ctrl+Y', run: run(e => e.redo?.()) });

  // ------------------------------------------------------------------ Font
  reg('format.bold', { label: app.tm('Bold'), text: '<b>B</b>', shortcut: 'Ctrl+B', run: fmt('bold'), isActive: active('bold') });
  reg('format.italic', { label: app.tm('Italic'), text: '<i>I</i>', shortcut: 'Ctrl+I', run: fmt('italic'), isActive: active('italic') });
  reg('format.underline', { label: app.tm('Underline'), text: '<u>U</u>', shortcut: 'Ctrl+U', run: fmt('underline'), isActive: active('underline') });
  reg('format.strike', { label: app.tm('Strikethrough'), text: '<s>S</s>', shortcut: 'Ctrl+Shift+X', run: fmt('strike'), isActive: active('strike') });
  reg('format.sub', { label: app.tm('Subscript'), text: 'x<sub>2</sub>', altShortcuts: ['Ctrl+,'], description: app.tm('Shortcut while typing: Ctrl+,'), run: fmt('sub'), isActive: active('sub') });
  reg('format.sup', { label: app.tm('Superscript'), text: 'x<sup>2</sup>', shortcut: 'Ctrl+.', run: fmt('sup'), isActive: active('sup') });
  reg('format.code', { label: app.tm('Inline code'), icon: 'code', shortcut: 'Ctrl+`', run: fmt('code'), isActive: active('code') });
  reg('format.clear', { label: app.tm('Clear formatting'), icon: 'mk-clear', shortcut: 'Ctrl+Space', run: fmt('clear') });
  const HL = [[app.tm('Yellow'), '#ffd60a'], [app.tm('Green'), '#a8e6a3'], [app.tm('Blue'), '#a9d1ff'], [app.tm('Pink'), '#ffb3c7'], [app.tm('Orange'), '#ffc982'], [app.tm('Purple'), '#d6c2ff']];
  const TC = [[app.tm('Red'), '#e5383b'], [app.tm('Orange'), '#e07a00'], [app.tm('Green'), '#1f8a3b'], [app.tm('Blue'), '#0a66ff'], [app.tm('Purple'), '#7a4fe0'], [app.tm('Gray'), '#6e6e73']];
  reg('format.highlight', {
    label: app.tm('Highlight'), icon: 'hl', shortcut: 'Ctrl+Shift+H', isActive: active('highlight'),
    run: run((e, a) => {
      const c = a.value || app.settings.get('highlightColor', '#ffd60a');
      if (a.value) app.settings.set('highlightColor', a.value);
      if (a.value === 'none') return isWord() ? e.highlightColor?.(null) : e.format('highlight');
      if (isWord() && e.highlightColor && !/ffd60a/i.test(c)) return e.highlightColor(c);
      if (!isWord() && !/ffd60a/i.test(c)) return e.wrap(`<mark style="background:${c}">`, '</mark>');
      return e.format('highlight');
    }),
  });
  reg('format.color', {
    label: app.tm('Text color'), icon: 'tc',
    run: run((e, a) => {
      const c = a.value || app.settings.get('textColor', '#e5383b');
      if (a.value && a.value !== 'auto') app.settings.set('textColor', a.value);
      if (isWord() && e.color) return e.color(c === 'auto' ? null : c);
      if (c === 'auto') { const s = e.getSelection().text; const t = s.replace(/<span style="color:[^"]*">([\s\S]*?)<\/span>/g, '$1'); if (t !== s) e.replaceSelection(t); return; }
      return e.wrap(`<span style="color:${c}">`, '</span>');
    }),
  });
  const FONTS = ['Charter', 'Georgia', 'Cambria', 'Times New Roman', 'Palatino Linotype', 'Garamond', 'Segoe UI', 'Calibri', 'Arial', 'Helvetica Neue', 'Verdana', 'Consolas'];
  const SIZES = [9, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 24];
  app.commands.register('format.fontFamily', {
    label: app.tm('Reading font'), run: (a = {}) => { if (!a.value) return; app.settings.set('fontFamily', a.value); app.settings.set('fontFamilyExplicit', true); app.events.emit('layout:changed'); },
    tooltip: app.tm('Reading font for the page. Markdown keeps your text, not fonts, so this only changes how it looks here and in exports.'),
  });
  app.commands.register('format.fontSize', {
    label: app.tm('Reading size'), run: (a = {}) => { const v = parseFloat(a.value); if (!v) return; app.settings.set('fontSize', v); app.events.emit('layout:changed'); },
    tooltip: app.tm('Text size on the page (points). Markdown keeps text, not sizes.'),
  });

  // ------------------------------------------------------------------ Paragraph
  reg('list.bullet', { label: app.tm('Bullets'), icon: 'ul', shortcut: 'Ctrl+Shift+8', run: fmt('ul'), isActive: active('list', 'ul') });
  reg('list.number', { label: app.tm('Numbering'), icon: 'ol', shortcut: 'Ctrl+Shift+7', run: fmt('ol'), isActive: active('list', 'ol') });
  reg('list.task', { label: app.tm('Checklist'), icon: 'task', shortcut: 'Ctrl+Shift+9', run: fmt('task'), isActive: active('list', 'task') });
  reg('para.indent', { label: app.tm('Increase indent'), icon: 'indent', shortcut: 'Ctrl+]', run: fmt('indent') });
  reg('para.outdent', { label: app.tm('Decrease indent'), icon: 'outdent', shortcut: 'Ctrl+[', run: fmt('outdent') });
  const AL = { left: [app.tm('Align left'), 'al', 'Ctrl+L'], center: [app.tm('Center'), 'ac', 'Ctrl+E'], right: [app.tm('Align right'), 'ar', 'Ctrl+R'], justify: [app.tm('Justify'), 'aj', 'Ctrl+J'] };
  reg('para.align', { label: app.tm('Align'), icon: 'al', run: run((e, a) => e.format('align' + (a.value || 'left')[0].toUpperCase() + (a.value || 'left').slice(1))) });
  for (const [k, [label, ic, sc]] of Object.entries(AL)) reg('para.align' + k[0].toUpperCase() + k.slice(1), { label, icon: ic, shortcut: sc, run: () => app.commands.run('para.align', { value: k }), isActive: () => (states.align || 'left') === k });
  reg('para.quote', { label: app.tm('Quote'), icon: 'quote', shortcut: 'Ctrl+Alt+Q', run: fmt('quote'), isActive: active('quote') });
  reg('insert.codeBlock', { label: app.tm('Code block'), icon: 'code', shortcut: 'Ctrl+Alt+C', run: fmt('codeBlock'), isActive: active('codeBlock') });

  // ------------------------------------------------------------------ Styles
  const STYLES = [
    { value: 'p', label: app.tm('Normal'), preview: 'font-size:13px', text: app.tm('Aa Body') },
    { value: 'title', label: app.tm('Title'), preview: 'font:700 16px var(--font)', text: 'Aa' },
    { value: 'h1', label: app.tm('Heading 1'), preview: 'font:650 14px var(--font)', text: 'Aa' },
    { value: 'h2', label: app.tm('Heading 2'), preview: 'font:600 12.5px var(--font)', text: 'Aa' },
    { value: 'quote', label: app.tm('Quote'), preview: 'font:italic 13px var(--serif);color:var(--text-2)', text: app.tm('“Aa”') },
  ];
  const MORE_STYLES = [['p', app.tm('Normal')], ['title', app.tm('Title')], ['h1', app.tm('Heading 1')], ['h2', app.tm('Heading 2')], ['h3', app.tm('Heading 3')], ['h4', app.tm('Heading 4')], ['h5', app.tm('Heading 5')], ['h6', app.tm('Heading 6')], ['quote', app.tm('Quote')], ['code', app.tm('Code block')]];
  const currentStyle = () => (states.heading ? 'h' + states.heading : states.quote ? 'quote' : states.codeBlock ? 'code' : 'p');
  reg('format.style', {
    label: app.tm('Style'), icon: 'doc',
    run: run(async (e, a) => {
      const v = a.value || 'p';
      if (v === 'title') return makeTitle(e);
      if (v === 'code') return e.format('codeBlock');
      if (v === 'p') { if (states.heading) return e.format('h' + states.heading); if (states.quote) return e.format('quote'); return e.format('p'); }
      if (v === 'quote') return e.format('quote');
      if (/^h[1-6]$/.test(v)) { if (states.heading === +v[1]) return; return e.format(v); }
    }),
    isActive: () => true, value: currentStyle,
  });
  for (let n = 1; n <= 6; n++) reg('format.h' + n, { label: MORE_STYLES[n + 1][1], shortcut: 'Ctrl+Alt+' + n, run: () => app.commands.run('format.style', { value: 'h' + n }), isActive: () => states.heading === n });
  reg('format.normal', { label: app.tm('Normal text'), shortcut: 'Ctrl+Alt+0', run: () => app.commands.run('format.style', { value: 'p' }), isActive: () => !states.heading && !states.quote });
  async function makeTitle(e) {
    const d = app.docs.active(); if (!d) return;
    let text = '';
    if (isWord() && e.page) {
      const s = getSelection(); const n = s.anchorNode; const blk = n && (n.nodeType === 1 ? n : n.parentElement).closest('p,h1,h2,h3,h4,h5,h6,li');
      if (!blk || !e.page.contains(blk)) return;
      text = blk.textContent.trim();
      const r = document.createRange(); r.selectNodeContents(blk); s.removeAllRanges(); s.addRange(r);
      await e.replaceSelection('');
      e.flush?.();
    } else {
      const ta = e.textarea; if (!ta) return;
      const v = ta.value, p = ta.selectionStart; const a = v.lastIndexOf('\n', p - 1) + 1; let b = v.indexOf('\n', p); if (b < 0) b = v.length;
      text = v.slice(a, b).replace(/^#{1,6}\s+/, '').trim();
      e.setSelection(a, b < v.length ? b + 1 : b); e.replaceSelection('');
    }
    if (!text) return;
    setDocText(E.setFrontMatter(d.text, { title: text }), 'style');
    app.ui.toast(app.t('Set as the document title (File → Info)'));
  }

  // ------------------------------------------------------------------ Insert
  function tableMd(rows, cols) {
    const head = '| ' + Array.from({ length: cols }, (_, i) => app.t('Column {n}', { n: i + 1 }).replace(/\|/g, '/')).join(' | ') + ' |';
    const sep = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
    const body = Array.from({ length: Math.max(1, rows - 1) }, () => '| ' + Array.from({ length: cols }, () => '   ').join(' | ') + ' |');
    return [head, sep, ...body].join('\n');
  }
  async function insertTable(rows, cols) {
    const e = ed(); if (!e) return;
    rows = Math.max(2, Math.min(100, rows | 0)); cols = Math.max(1, Math.min(20, cols | 0));
    if (e.insertTable && isWord()) return e.insertTable(rows, cols);
    await block(e, tableMd(rows, cols));
    if (e.textarea) { const ta = e.textarea; const c1 = app.t('Column {n}', { n: 1 }).replace(/\|/g, '/'); const i = ta.value.lastIndexOf('| ' + c1 + ' |', ta.selectionStart); if (i >= 0) e.setSelection(i + 2, i + 2 + c1.length); }
  }
  async function tableDialog() {
    const r = inputEl('3', { type: 'number', min: '2', max: '100' }), c = inputEl('3', { type: 'number', min: '1', max: '20', autofocus: '' });
    const g = document.createElement('div'); g.className = 'mk-row2'; g.append(field(app.t('Columns'), c), field(app.t('Rows (including the header)'), r));
    const v = await E.modal({ title: app.t('Insert table'), body: g, buttons: [{ label: app.t('Cancel'), value: null }, { label: app.t('Insert@@verb'), primary: true, value: () => ({ rows: +r.value, cols: +c.value }) }] });
    if (v) insertTable(v.rows, v.cols);
  }
  function tablePicker(anchor) {
    const wrap = document.createElement('div');
    const grid = document.createElement('div'); grid.className = 'mk-grid'; grid.setAttribute('role', 'grid');
    const label = document.createElement('div'); label.className = 'mk-grid-label'; label.textContent = app.t('Pick a size');
    let R = 2, C = 2;
    const cells = [];
    const paint = () => { cells.forEach(b => b.classList.toggle('on', +b.dataset.r <= R && +b.dataset.c <= C)); label.textContent = app.t('{cols} × {rows} table', { cols: C, rows: R }); };
    for (let r = 1; r <= 8; r++) for (let c = 1; c <= 8; c++) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.r = r; b.dataset.c = c; b.setAttribute('aria-label', app.t('{cols} columns by {rows} rows', { cols: c, rows: r }));
      b.addEventListener('mouseenter', () => { R = r; C = c; paint(); });
      b.addEventListener('focus', () => { R = r; C = c; paint(); });
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', () => { E.closeMenu(); insertTable(Math.max(2, r), c); });
      b.addEventListener('keydown', ev => {
        const mv = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[ev.key]; if (!mv) return;
        ev.preventDefault(); ev.stopPropagation(); const nr = Math.min(8, Math.max(1, R + mv[0])), nc = Math.min(8, Math.max(1, C + mv[1]));
        cells[(nr - 1) * 8 + nc - 1].focus();
      });
      cells.push(b); grid.appendChild(b);
    }
    wrap.append(grid, label); paint();
    E.menu(anchor, [{ title: app.t('Insert table') }, { el: wrap }, '-', { label: app.t('Insert table…'), run: tableDialog }], { noFocus: true });
    setTimeout(() => cells[9]?.focus({ preventScroll: true }), 40);
  }
  // src/tables.js (loaded later) replaces this with the Word-style picker, dialogs and the Table Design / Layout tabs
  reg('insert.table', { label: app.tm('Table'), icon: 'table', run: (a = {}) => (app.tables?.insertPicker ? (a.rows && a.cols ? app.tables.insert(a.rows, a.cols) : app.tables.insertPicker(E.anchor())) : (a.rows && a.cols ? insertTable(a.rows, a.cols) : tablePicker(E.anchor()))) });
  reg('insert.image', {
    label: app.tm('Picture'), icon: 'image',
    run: run(async (e, a) => {
      const files = a.files || await E.pickImages();
      for (const f of files) { const r = await E.saveImage(f, app.docs.active()); await e.insert(E.imageMarkdown(r.path, r.name)); }
    }),
  });
  const MERMAID = {
    Flowchart: 'flowchart LR\n  A[Collect data] --> B{Valid?}\n  B -- Yes --> C[Analyze]\n  B -- No --> A\n  C --> D[Report]',
    Sequence: 'sequenceDiagram\n  participant R as Researcher\n  participant L as Lab\n  R->>L: Send samples\n  L-->>R: Results',
    Gantt: 'gantt\n  title Project plan\n  dateFormat YYYY-MM-DD\n  section Fieldwork\n  Survey      :a1, 2026-01-05, 20d\n  Sampling    :after a1, 15d\n  section Writing\n  Draft paper :2026-02-20, 30d',
    Pie: 'pie title Time spent\n  "Reading" : 35\n  "Experiments" : 40\n  "Writing" : 25',
    Class: 'classDiagram\n  class Sample {\n    +id: string\n    +size: float\n    +measure()\n  }',
    Mindmap: 'mindmap\n  root((Topic))\n    Idea A\n    Idea B\n      Detail',
  };
  // the diagram kinds as the menu names them (the Mermaid source itself is code and stays as it is)
  const MERMAID_NAMES = { Flowchart: app.tm('Flowchart'), Sequence: app.tm('Sequence'), Gantt: app.tm('Gantt'), Pie: app.tm('Pie'), Class: app.tm('Class'), Mindmap: app.tm('Mindmap') };
  reg('insert.diagram', {
    label: app.tm('Diagram'), icon: 'flow',
    run: (a = {}) => {
      const go = (k) => { const e = ed(); if (e) block(e, '```mermaid\n' + (MERMAID[k] || a.source || MERMAID.Flowchart) + '\n```'); };
      if (a.value) return go(a.value);
      E.menu(E.anchor(), [{ title: app.t('Mermaid diagram') }, ...Object.keys(MERMAID).map(k => ({ label: app.t(MERMAID_NAMES[k] || k), run: () => go(k) })), '-', { label: app.t('Write my own…'), run: async () => { const v = await E.sourceDialog({ title: app.t('New diagram'), label: app.t('Mermaid source'), value: 'flowchart TD\n  A --> B' }); if (v) { const e = ed(); if (e) block(e, '```mermaid\n' + v.trim() + '\n```'); } } }]);
    },
  });
  reg('insert.equation', { label: app.tm('Equation'), icon: 'sigma', altShortcuts: ['Alt+='], description: app.tm('Build an equation visually or in LaTeX, then insert it inline or on its own line, with an optional number. With the caret in an equation, edits it. Shortcut while typing: Alt+='), run: (a) => insertEquation(a || {}) });
  const LANGS = [['', app.tm('Plain text')], ['python', 'Python'], ['r', 'R'], ['julia', 'Julia'], ['matlab', 'MATLAB'], ['javascript', 'JavaScript'], ['bash', app.tm('Shell@@command line')], ['latex', 'LaTeX'], ['json', 'JSON'], ['yaml', 'YAML'], ['sql', 'SQL'], ['cpp', 'C++']];
  reg('insert.code', {
    label: app.tm('Code'), icon: 'code',
    run: (a = {}) => {
      const e = ed(); if (!e) return;
      const sel = e.getSelection?.().text || '';
      if (sel && !sel.includes('\n') && a.value == null) return e.format('code');
      const go = (lang) => {
        const x = ed(); if (!x) return;
        if (x.textarea) { const p0 = x.getSelection().start; void p0; Promise.resolve(block(x, '```' + lang + '\n' + (sel || '') + '\n```')).then(() => { const p = x.getSelection().start; x.setSelection(p - 4); }); }
        else block(x, '```' + lang + '\n' + (sel || ' ') + '\n```');
      };
      if (a.value != null) return go(a.value);
      E.menu(E.anchor(), [{ title: app.t('Code block') }, ...LANGS.map(([v, l]) => ({ label: app.t(l), run: () => go(v) })), '-', { label: app.t('Inline code'), hint: 'Ctrl+`', run: () => ed()?.format('code') }]);
    },
  });
  const CALLOUTS = [['NOTE', app.tm('Note')], ['TIP', app.tm('Tip')], ['WARNING', app.tm('Warning')], ['IMPORTANT', app.tm('Important')], ['CAUTION', app.tm('Caution')]];
  reg('insert.callout', {
    label: app.tm('Callout'), icon: 'info',
    run: (a = {}) => {
      const go = (k) => { const e = ed(); if (!e) return; const sel = (e.getSelection?.().text || '').trim(); block(e, `> [!${k}]\n` + (sel || app.t('Write your note here.')).split('\n').map(l => '> ' + l).join('\n')); };
      if (a.value) return go(String(a.value).toUpperCase());
      E.menu(E.anchor(), [{ title: app.t('Callout box') }, ...CALLOUTS.map(([k, l]) => ({ label: app.t(l), run: () => go(k) }))]);
    },
  });
  reg('insert.link', {
    label: app.tm('Link'), icon: 'link', altShortcuts: ['Ctrl+K'], description: app.tm('Add or edit a link. Shortcut while typing: Ctrl+K'),
    run: run(async (e, a) => {
      let text = e.getSelection?.().text || '', href = a.href || '';
      let existing = null;
      if (isWord() && e.page) { const n = getSelection().anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement).closest('a[href]'); if (el && e.page.contains(el)) { existing = el; text = el.textContent; href = el.getAttribute('href'); } }
      else if (!isWord()) { const m = /^\[([^\]]*)\]\(([^)]*)\)$/.exec(text); if (m) { text = m[1]; href = m[2]; existing = true; } }
      if (!href && /^(https?:\/\/|www\.|mailto:)\S+$/.test(text.trim())) href = text.trim();
      const t = inputEl(text), h = inputEl(href, { placeholder: app.t('https://… or a file name'), autofocus: '' });
      const body = document.createElement('div'); body.style.cssText = 'display:flex;flex-direction:column;gap:12px'; body.append(field(app.t('Text to show'), t), field(app.t('Address'), h));
      const buttons = [{ label: app.t('Cancel'), value: null }];
      if (existing) buttons.unshift({ label: app.t('Remove link'), danger: true, value: () => ({ remove: true }) });
      buttons.push({ label: existing ? app.t('Update') : app.t('Insert@@verb'), primary: true, value: () => ({ text: t.value, href: h.value.trim() }) });
      const v = await E.modal({ title: existing ? app.t('Edit link') : app.t('Insert link'), body, buttons, onOpen: () => (href ? t : h).focus() });
      if (!v) return e.focus?.();
      if (existing && existing.nodeType === 1) { const r = document.createRange(); r.selectNode(existing); getSelection().removeAllRanges(); getSelection().addRange(r); }
      if (v.remove) { const label = text; return isWord() ? e.replaceSelection(label.replace(/([*_`[\]\\])/g, '\\$1')) : e.replaceSelection(label); }
      if (!v.href) return;
      let url = v.href; if (/^www\./i.test(url)) url = 'https://' + url;
      const label = (v.text || url).replace(/[[\]]/g, m => '\\' + m);
      await e.replaceSelection(`[${label}](${/\s/.test(url) ? '<' + url + '>' : url})`);
    }),
  });
  reg('insert.hr', { label: app.tm('Divider'), icon: 'hr', run: run(e => block(e, '---')) });
  reg('insert.pageBreak', { label: app.tm('Page break'), icon: 'page', shortcut: 'Ctrl+Enter', run: run(e => block(e, '<div class="page-break"></div>')) });
  reg('insert.footnote', {
    label: app.tm('Footnote'), icon: 'foot',
    run: run(async e => {
      if (app.commands.get('ref.footnote')) return app.commands.run('ref.footnote');
      const d = app.docs.active(); if (!d) return; e.flush?.();
      const used = [...d.text.matchAll(/\[\^(\d+)\]/g)].map(m => +m[1]); const n = (used.length ? Math.max(...used) : 0) + 1;
      const note = await app.ui.prompt(app.t('Insert footnote'), app.t('Footnote text'), ''); if (note == null) return;
      await e.insert(`[^${n}]`); e.flush?.();
      setDocText(d.text.replace(/\s*$/, '') + `\n\n[^${n}]: ${note}\n`, 'footnote');
    }),
  });
  reg('insert.citation', {
    label: app.tm('Citation'), icon: 'cite',
    run: run(async e => {
      if (app.commands.get('ref.cite')) return app.commands.run('ref.cite');
      const k = await app.ui.prompt(app.t('Insert citation'), app.t('Citation key from your .bib library, for example shields1936'), ''); if (!k) return;
      await e.insert('[' + k.split(/[;,\s]+/).filter(Boolean).map(x => '@' + x.replace(/^@/, '')).join('; ') + ']');
    }),
  });
  const SYMBOLS = '© ® ™ ° ± × ÷ · • … – — ‰ § ¶ † ‡ ≈ ≠ ≤ ≥ ∞ √ ∑ ∏ ∫ ∂ ∆ ∇ µ Ω α β γ δ ε θ λ π σ τ φ ω → ← ↑ ↓ ↔ ⇒ ⇔ € £ ¥ ¢ ½ ¼ ¾ ² ³ ¹ ‘ ’ “ ” « » ✓ ✗ ★ ☐ ☑'.split(' ');
  reg('insert.symbol', {
    label: app.tm('Symbol'), icon: 'mk-omega',
    run: (a = {}) => {
      if (a.value) { const e = ed(); if (e) insertPlain(e, a.value); return; }
      const g = document.createElement('div'); g.className = 'mk-symgrid';
      const btns = SYMBOLS.map(s => { const b = document.createElement('button'); b.type = 'button'; b.textContent = s; b.title = app.t('Insert {symbol}', { symbol: s }); b.addEventListener('mousedown', ev => ev.preventDefault()); b.addEventListener('click', () => { E.closeMenu(); const e = ed(); if (e) { e.focus?.(); insertPlain(e, s); } }); g.appendChild(b); return b; });
      g.addEventListener('keydown', ev => { const i = btns.indexOf(document.activeElement); const mv = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 10, ArrowUp: -10 }[ev.key]; if (mv && i >= 0) { ev.preventDefault(); ev.stopPropagation(); btns[Math.max(0, Math.min(btns.length - 1, i + mv))].focus(); } });
      E.menu(E.anchor(), [{ title: app.t('Symbol') }, { el: g }, '-', { label: app.t('Equation…'), hint: 'Alt+=', run: () => app.commands.run('insert.equation') }], { noFocus: true });
      setTimeout(() => btns[0]?.focus({ preventScroll: true }), 40);
    },
  });
  reg('insert.dateTime', {
    label: app.tm('Date & time'), icon: 'mk-clock', shortcut: 'Alt+Shift+D',
    run: (a = {}) => {
      const d = new Date(); const pad = n => String(n).padStart(2, '0');
      const fmts = [
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`,
        d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
      ];
      const go = s => { const e = ed(); if (e) { e.focus?.(); insertPlain(e, s); } };
      if (a.value) return go(a.value === 'iso' ? fmts[0] : a.value);
      E.menu(E.anchor(), [{ title: app.t('Date & time') }, ...fmts.map(f => ({ label: f, run: () => go(f) }))]);
    },
  });

  // ------------------------------------------------------------------ Layout (stored in front matter, applied to page and export)
  const SIZES_PX = { A4: { w: 794, h: 1123, css: 'A4' }, Letter: { w: 816, h: 1056, css: 'letter' }, A5: { w: 559, h: 794, css: 'A5' } };
  const MARGINS = { normal: [96, 96], narrow: [48, 48], wide: [96, 192] };
  const THEMES = {
    classic: { label: app.tm('Classic serif'), family: '"Charter","Iowan Old Style","Cambria","Georgia",serif', size: 15.5, line: 1.62, head: '-apple-system,BlinkMacSystemFont,"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif' },
    modern: { label: app.tm('Modern sans'), family: '-apple-system,BlinkMacSystemFont,"Segoe UI Variable Text","Segoe UI",Inter,system-ui,sans-serif', size: 15, line: 1.6, head: '-apple-system,BlinkMacSystemFont,"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif' },
    academic: { label: app.tm('Academic'), family: '"Times New Roman","Cambria","Georgia",serif', size: 16, line: 1.75, head: '"Times New Roman","Cambria","Georgia",serif' },
    compact: { label: app.tm('Compact'), family: '-apple-system,BlinkMacSystemFont,"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif', size: 13.5, line: 1.45, para: 6, head: '-apple-system,BlinkMacSystemFont,"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif' },
  };
  const LINE = ['1.0', '1.15', '1.5', '2.0'];
  const PARA = ['0', '6', '8', '12', '18'];
  const KEYS = { size: 'markooj-page', margins: 'markooj-margins', columns: 'markooj-columns', lineSpacing: 'markooj-line-spacing', paraSpacing: 'markooj-paragraph-spacing', theme: 'markooj-theme' };
  function readMeta(doc) {
    const out = {}; if (!doc) return out;
    const raw = E.splitFrontMatter(doc.text || '').raw;
    for (const line of raw.split(/\r?\n/)) { const m = /^([\w -]+):\s*(.*)$/.exec(line); if (m) out[m[1].trim().toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, ''); }
    return out;
  }
  const layout = app.layout = {
    keys: KEYS, themes: THEMES, sizes: SIZES_PX, margins: MARGINS,
    get(doc = app.docs.active()) {
      const m = readMeta(doc);
      const size = Object.keys(SIZES_PX).find(k => k.toLowerCase() === String(m[KEYS.size] || '').toLowerCase()) || 'A4';
      const margins = MARGINS[String(m[KEYS.margins] || '').toLowerCase()] ? String(m[KEYS.margins]).toLowerCase() : 'normal';
      const theme = THEMES[String(m[KEYS.theme] || '').toLowerCase()] ? String(m[KEYS.theme]).toLowerCase() : 'classic';
      return { size, margins, columns: String(m[KEYS.columns]) === '2' ? 2 : 1, lineSpacing: m[KEYS.lineSpacing] || '', paraSpacing: m[KEYS.paraSpacing] || '', theme };
    },
    set(key, value, doc = app.docs.active()) {
      if (!doc || doc.kind !== 'markdown') return;
      app.editors.active()?.flush?.();
      const defaults = { size: 'A4', margins: 'normal', columns: 1, lineSpacing: '', paraSpacing: '', theme: 'classic' };
      const v = value == null || String(value) === String(defaults[key]) ? null : String(value);
      const text = E.setFrontMatter(doc.text, { [KEYS[key]]: v });
      if (text !== doc.text) doc.setText(text, 'layout');
      app.events.emit('layout:changed', { doc, key, value });
    },
    pageSize(doc = app.docs.active()) { const L = layout.get(doc); return { ...SIZES_PX[L.size], name: L.size }; },
    font(doc) {
      const L = layout.get(doc); const th = THEMES[L.theme];
      const explicit = app.settings.get('fontFamilyExplicit', false);
      const fam = app.settings.get('fontFamily', 'Charter');
      const family = (L.theme === 'classic' || explicit) && fam ? `"${fam.replace(/"/g, '')}",${th.family}` : th.family;
      const pt = parseFloat(app.settings.get('fontSize', 12)) || 12;
      return { family, px: +(th.size * pt / 12).toFixed(2), line: L.lineSpacing ? +(parseFloat(L.lineSpacing) * 1.2).toFixed(3) : th.line, para: L.paraSpacing !== '' ? Math.round(parseFloat(L.paraSpacing) * 1.333) : (th.para ?? 12) };
    },
    apply(el, doc = app.docs.active(), opts = {}) {
      if (!el) return;
      const L = layout.get(doc); const f = layout.font(doc);
      el.dataset.mkTheme = L.theme; el.style.fontFamily = f.family; el.style.lineHeight = String(f.line); el.style.setProperty('--mk-para', f.para + 'px');
      if (opts.preview) { el.style.fontSize = (f.px * 14.5 / 15.5).toFixed(2) + 'px'; el.removeAttribute('data-mk-cols'); return; }
      el.style.fontSize = f.px + 'px';
      const s = SIZES_PX[L.size], m = MARGINS[L.margins];
      el.style.width = s.w + 'px'; el.style.padding = `${m[0]}px ${m[1]}px ${Math.max(48, m[0] - 6)}px`;
      if (L.columns === 2) el.dataset.mkCols = '2'; else el.removeAttribute('data-mk-cols');
    },
    // CSS for exporters / print: standalone (no app CSS variables needed)
    cssFor(doc = app.docs.active(), opts = {}) {
      const sel = opts.selector || '.mk-page, .markooj-doc, body';
      const L = layout.get(doc); const f = layout.font(doc); const th = THEMES[L.theme]; const s = SIZES_PX[L.size]; const m = MARGINS[L.margins];
      const mm = px => (px * 25.4 / 96).toFixed(1) + 'mm';
      const each = x => sel.split(',').map(t => t.trim() + ' ' + x).join(', ');
      return [
        `@page { size: ${s.css}; margin: ${mm(m[0])} ${mm(m[1])}; }`,
        `${sel} { font-family: ${f.family}; font-size: ${f.px}px; line-height: ${f.line};${L.theme === 'academic' ? ' text-align: justify; hyphens: auto;' : ''}${L.columns === 2 ? ' column-count: 2; column-gap: 40px;' : ''} }`,
        `${each('p')} { margin: 0 0 ${f.para}px; }`,
        `${each('h1')}, ${each('h2')}, ${each('h3')}, ${each('h4')} { font-family: ${th.head}; }`,
        L.theme === 'academic' ? `${each('.mk-front')} { text-align: center; } ${each('h3')} { font-style: italic; }` : '',
        L.theme === 'modern' ? `${each('h2')} { color: #0a66ff; }` : '',
        L.columns === 2 ? `${each('.mk-front')}, ${each('h1')}, ${each('table')}, ${each('.mk-math-block')} { column-span: all; }` : '',
        `${each('.page-break')} { break-after: page; page-break-after: always; border: 0; height: 0; margin: 0; } ${each('.page-break::after')} { content: none; }`,
      ].filter(Boolean).join('\n');
    },
  };
  function layoutMenu(key, items) {
    return (a = {}) => {
      if (a.value != null) return layout.set(key, a.value);
      const cur = String(layout.get()[key]);
      E.menu(E.anchor(), [{ title: app.t(items.title) }, ...items.list.map(([v, l, h]) => ({ label: app.t(l), hint: h ? app.t(h) : h, checked: String(v) === cur, run: () => layout.set(key, v) }))]);
    };
  }
  reg('layout.margins', { label: app.tm('Margins'), icon: 'page', run: layoutMenu('margins', { title: app.tm('Margins'), list: [['normal', app.tm('Normal@@margins'), app.tm('1 in all around')], ['narrow', app.tm('Narrow'), app.tm('0.5 in')], ['wide', app.tm('Wide'), app.tm('2 in left and right')]] }) });
  reg('layout.size', { label: app.tm('Size'), icon: 'doc', run: layoutMenu('size', { title: app.tm('Page size'), list: [['A4', 'A4', '210 × 297 mm'], ['Letter', app.tm('Letter@@paper size'), app.tm('8.5 × 11 in')], ['A5', 'A5', '148 × 210 mm']] }) });
  reg('layout.columns', { label: app.tm('Columns'), icon: 'side', run: layoutMenu('columns', { title: app.tm('Columns'), list: [[1, app.tm('One@@columns')], [2, app.tm('Two@@columns')]] }), isActive: () => layout.get().columns === 2 });
  reg('layout.lineSpacing', { label: app.tm('Line spacing'), icon: 'mk-lines', run: (a = {}) => layout.set('lineSpacing', a.value === 'default' ? null : a.value), value: () => layout.get().lineSpacing || 'default' });
  reg('layout.paraSpacing', { label: app.tm('Paragraph spacing'), icon: 'mk-space', run: (a = {}) => layout.set('paraSpacing', a.value === 'default' ? null : a.value), value: () => layout.get().paraSpacing || 'default' });
  reg('layout.theme', { label: app.tm('Theme'), icon: 'sparkle', run: layoutMenu('theme', { title: app.tm('Document theme'), list: Object.entries(THEMES).map(([k, t]) => [k, t.label]) }) });

  // ------------------------------------------------------------------ ribbon: custom pieces (mock markup: .ib, .swatch, .gallery/.sty)
  const customEls = new Set();
  function refreshCustom() {
    for (const el of [...customEls]) {
      if (!el.isConnected) { if (Date.now() - (el.__mkBorn || 0) > 4000) customEls.delete(el); continue; }
      el.querySelectorAll('[data-cmd]').forEach(b => { const c = app.commands.get(b.dataset.cmd); const on = !!(c && c.isActive && c.isActive()); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      el.querySelectorAll('.sty[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === currentStyle()));
    }
  }
  app.events.on('ribbon:changed', () => setTimeout(refreshCustom, 0));
  const tip = (c, fallback) => { const cmd = app.commands.get(c); const k = cmd?.shortcut || (cmd?.altShortcuts || [])[0]; const l = app.t(cmd?.label || fallback || c); return k ? app.t('{label} ({key})', { label: l, key: k }) : l; };
  function ibtn(cmd, html, args, cls = '') {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ib ' + cls; b.innerHTML = html; b.dataset.cmd = cmd;
    // a ScreenTip (title, description and shortcut) like every other ribbon control, not a plain system tooltip
    b.dataset.tipCmd = cmd; b.setAttribute('aria-label', app.t(app.commands.get(cmd)?.label || cmd));
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => app.commands.run(cmd, args));
    return b;
  }
  function splitSwatch(cmd, ic, colors, settingKey, def, extra) {
    const wrap = document.createElement('span'); wrap.className = 'split';
    const main = ibtn(cmd, icon(ic), undefined, 'swatch');
    const setC = () => main.style.setProperty('--c', app.settings.get(settingKey, def));
    setC(); app.events.on('settings:changed', ({ key }) => { if (key === settingKey) setC(); });
    const dd = document.createElement('button'); dd.type = 'button'; dd.className = 'dd'; dd.innerHTML = '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
    const ddLabel = app.t('{name} colors', { name: app.t(app.commands.get(cmd)?.label || cmd) });
    dd.dataset.tip = ddLabel; dd.dataset.tipD = app.t('Pick a color'); dd.setAttribute('aria-label', ddLabel); dd.setAttribute('aria-haspopup', 'menu');
    dd.addEventListener('mousedown', e => e.preventDefault());
    dd.addEventListener('click', () => {
      const g = document.createElement('div'); g.className = 'mk-swatches';
      colors.forEach(([n, c]) => { const s = document.createElement('button'); s.type = 'button'; s.style.background = c; s.title = app.t(n); s.setAttribute('aria-label', app.t(n)); s.addEventListener('mousedown', e => e.preventDefault()); s.addEventListener('click', () => { E.closeMenu(); app.commands.run(cmd, { value: c }); }); g.appendChild(s); });
      E.menu(wrap, [{ title: app.t(app.commands.get(cmd)?.label || '') }, { el: g }, '-', { ...extra, label: app.t(extra.label) }]);
      setTimeout(() => g.firstChild?.focus({ preventScroll: true }), 40);
    });
    wrap.append(main, dd); return wrap;
  }
  const fontRow = {
    type: 'custom', render(el) {
      const row = document.createElement('div'); row.className = 'row mk-rb';
      row.append(
        ibtn('format.bold', '<b>B</b>'), ibtn('format.italic', '<i>I</i>'), ibtn('format.underline', '<u>U</u>'), ibtn('format.strike', '<s>S</s>'),
        Object.assign(document.createElement('span'), { className: 'sep' }),
        ibtn('format.sub', '<span style="font:600 12px var(--serif)">x<sub>2</sub></span>'), ibtn('format.sup', '<span style="font:600 12px var(--serif)">x<sup>2</sup></span>'),
        splitSwatch('format.highlight', 'hl', HL, 'highlightColor', '#ffd60a', { label: app.tm('No highlight'), run: () => app.commands.run('format.highlight', { value: 'none' }) }),
        splitSwatch('format.color', 'tc', TC, 'textColor', '#e5383b', { label: app.tm('Automatic'), run: () => app.commands.run('format.color', { value: 'auto' }) }),
        ibtn('format.clear', icon('mk-clear')),
      );
      el.appendChild(row); row.__mkBorn = Date.now(); customEls.add(row); setTimeout(refreshCustom, 0);
    },
  };
  const gallery = {
    type: 'custom', render(el) {
      const g = document.createElement('div'); g.className = 'gallery mk-gallery'; g.setAttribute('role', 'listbox'); g.setAttribute('aria-label', app.t('Styles'));
      for (const s of STYLES) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'sty'; b.dataset.v = s.value; b.setAttribute('role', 'option');
        const key = { h1: 'Ctrl+Alt+1', h2: 'Ctrl+Alt+2', p: 'Ctrl+Alt+0' }[s.value] || '';
        const name = app.t(s.label);
        b.dataset.tip = name; b.dataset.tipD = app.t('Apply the {style} style to the paragraph.', { style: name }); if (key) b.dataset.key = key; b.setAttribute('aria-label', name);
        b.innerHTML = `<span class="p" style="${s.preview}">${esc(app.t(s.text))}</span><span class="n">${esc(name)}</span>`;
        b.addEventListener('mousedown', e => e.preventDefault());
        b.addEventListener('click', () => app.commands.run('format.style', { value: s.value }));
        g.appendChild(b);
      }
      const more = document.createElement('button'); more.type = 'button'; more.className = 'more'; more.dataset.tip = app.t('More styles'); more.dataset.tipD = app.t('Headings 3 to 6, code and other paragraph styles.'); more.setAttribute('aria-label', app.t('More styles'));
      more.innerHTML = '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
      more.addEventListener('mousedown', e => e.preventDefault());
      more.addEventListener('click', () => E.menu(more, [{ title: app.t('Styles') }, ...MORE_STYLES.map(([v, l]) => ({ label: app.t(l), checked: currentStyle() === v, hint: /^h[1-6]$/.test(v) ? 'Ctrl+Alt+' + v[1] : v === 'p' ? 'Ctrl+Alt+0' : '', run: () => app.commands.run('format.style', { value: v }) }))]));
      g.appendChild(more);
      el.appendChild(g); g.__mkBorn = Date.now(); customEls.add(g); setTimeout(refreshCustom, 0);
    },
  };

  // ------------------------------------------------------------------ ribbon groups
  const big = (command, label, icon) => ({ type: 'big', command, label, icon });
  const small = (command, label, icon) => ({ type: 'small', command, label, icon });
  const R = app.ribbon;
  R.addGroup('home', { id: 'clipboard', label: app.tm('Clipboard'), order: 10, items: [
    big('edit.paste', app.tm('Paste'), 'paste'),
    { type: 'col', items: [small('edit.cut', app.tm('Cut'), 'cut'), small('edit.copy', app.tm('Copy'), 'copy')] },
    { type: 'col', items: [small('format.painter', app.tm('Format painter'), 'brush'), small('edit.pastePlain', app.tm('Paste as plain text'), 'doc')] },
  ] });
  R.addGroup('home', { id: 'font', label: app.tm('Font'), order: 20, items: [{ type: 'col', items: [
    { type: 'row', items: [
      { type: 'select', command: 'format.fontFamily', label: app.tm('Reading font (Markdown keeps text, not fonts)'), width: 132, options: FONTS.map(f => ({ value: f, label: f })), value: () => app.settings.get('fontFamily', 'Charter') },
      { type: 'select', command: 'format.fontSize', label: app.tm('Reading size in points (Markdown keeps text, not sizes)'), width: 52, options: SIZES.map(s => ({ value: String(s), label: String(s) })), value: () => String(app.settings.get('fontSize', 12)) },
    ] },
    fontRow,
  ] }] });
  R.addGroup('home', { id: 'paragraph', label: app.tm('Paragraph'), order: 30, items: [{ type: 'col', items: [
    { type: 'row', items: [small('list.bullet', app.tm('Bullets'), 'ul'), small('list.number', app.tm('Numbering'), 'ol'), small('list.task', app.tm('Checklist'), 'task'), { type: 'sep' }, small('para.outdent', app.tm('Decrease indent'), 'outdent'), small('para.indent', app.tm('Increase indent'), 'indent')] },
    { type: 'row', items: [small('para.alignLeft', app.tm('Align left'), 'al'), small('para.alignCenter', app.tm('Center'), 'ac'), small('para.alignRight', app.tm('Align right'), 'ar'), small('para.alignJustify', app.tm('Justify'), 'aj'), { type: 'sep' }, small('para.quote', app.tm('Quote'), 'quote'), small('insert.codeBlock', app.tm('Code block'), 'code')] },
  ] }] });
  R.addGroup('home', { id: 'styles', label: app.tm('Styles'), order: 40, items: [gallery] });
  R.addGroup('home', { id: 'editing', label: app.tm('Editing'), order: 50, items: [big('edit.find', app.tm('Find'), 'search'), { type: 'col', items: [small('edit.replace', app.tm('Replace'), 'mk-replace'), small('edit.selectAll', app.tm('Select all'), 'mk-selall')] }, big('insert.equation', app.tm('Equation'), 'sigma')] });

  R.addGroup('insert', { id: 'illustrations', label: app.tm('Illustrations'), order: 10, items: [big('insert.table', app.tm('Table'), 'table'), big('insert.image', app.tm('Picture'), 'image'), big('insert.diagram', app.tm('Diagram'), 'flow')] });
  R.addGroup('insert', { id: 'blocks', label: app.tm('Blocks'), order: 20, items: [big('insert.equation', app.tm('Equation'), 'sigma'), big('insert.code', app.tm('Code'), 'code'), big('insert.callout', app.tm('Callout'), 'info')] });
  R.addGroup('insert', { id: 'links', label: app.tm('Links & pages'), order: 30, items: [big('insert.link', app.tm('Link'), 'link'), big('insert.hr', app.tm('Divider'), 'hr'), big('insert.pageBreak', app.tm('Page break'), 'page')] });
  R.addGroup('insert', { id: 'notes', label: app.tm('Notes & sources'), order: 40, items: [big('insert.footnote', app.tm('Footnote'), 'foot'), big('insert.citation', app.tm('Citation'), 'cite')] });
  R.addGroup('insert', { id: 'text', label: app.tm('Text'), order: 50, items: [big('insert.symbol', app.tm('Symbol'), 'mk-omega'), big('insert.dateTime', app.tm('Date & time'), 'mk-clock')] });

  R.addGroup('layout', { id: 'pagesetup', label: app.tm('Page setup'), order: 10, items: [big('layout.margins', app.tm('Margins'), 'page'), big('layout.size', app.tm('Size'), 'doc'), big('layout.columns', app.tm('Columns'), 'side')] });
  R.addGroup('layout', { id: 'spacing', label: app.tm('Spacing'), order: 20, items: [{ type: 'col', items: [
    { type: 'row', items: [{ type: 'select', command: 'layout.lineSpacing', label: app.tm('Line spacing'), width: 172, options: [{ value: 'default', label: app.tm('Line spacing: auto') }, ...LINE.map(v => ({ value: v, get label() { return app.t('Line spacing {value}', { value: v }); } }))], value: () => layout.get().lineSpacing || 'default' }] },
    { type: 'row', items: [{ type: 'select', command: 'layout.paraSpacing', label: app.tm('Space after paragraphs'), width: 172, options: [{ value: 'default', label: app.tm('Paragraph space: auto') }, ...PARA.map(v => ({ value: v, get label() { return app.t('Paragraph space {value} pt', { value: v }); } }))], value: () => layout.get().paraSpacing || 'default' }] },
  ] }] });
  R.addGroup('layout', { id: 'theme', label: app.tm('Document theme'), order: 30, items: [big('layout.theme', app.tm('Theme'), 'sparkle')] });

  app.events.on('doc:active', () => app.events.emit('layout:changed', { doc: app.docs.active() }));

  // ------------------------------------------------------------------ smoke tests
  app.tests.register('editor: format.bold wraps selection with ** in Simple mode', async () => {
    const host = E._offscreen(); const s = E.createSimple(); const d = E.fakeDoc('make this bold');
    try {
      s.mount(host, d); s.setSelection(10, 14);
      E.testTarget = s;
      await app.commands.run('format.bold');
      app.assert(d.text === 'make this **bold**', 'got ' + JSON.stringify(d.text));
      await app.commands.run('format.bold');
      app.assert(d.text === 'make this bold', 'toggle off, got ' + JSON.stringify(d.text));
      s.setSelection(0, 0); await app.commands.run('format.style', { value: 'h2' });
      app.assert(d.text === '## make this bold', 'heading, got ' + JSON.stringify(d.text));
      await app.commands.run('list.task');
      app.assert(d.text === '- [ ] ## make this bold' || /^- \[ \] /.test(d.text), 'task list, got ' + JSON.stringify(d.text));
    } finally { E.testTarget = null; s.unmount(); host.remove(); }
  });
  app.tests.register('editor: layout front matter + css', () => {
    const t1 = E.setFrontMatter('# Hi\n', { 'markooj-theme': 'academic' });
    app.assert(t1 === '---\nmarkooj-theme: academic\n---\n\n# Hi\n', 'adds front matter: ' + JSON.stringify(t1));
    const t2 = E.setFrontMatter('---\ntitle: X\n---\n\n# Hi\n', { 'markooj-page': 'Letter' });
    app.assert(t2 === '---\ntitle: X\nmarkooj-page: Letter\n---\n\n# Hi\n', 'keeps keys: ' + JSON.stringify(t2));
    const t3 = E.setFrontMatter(t1, { 'markooj-theme': null });
    app.assert(t3 === '# Hi\n', 'removes empty front matter: ' + JSON.stringify(t3));
    const css = layout.cssFor({ text: t2 });
    app.assert(/@page \{ size: letter/.test(css), css);
  });
  app.tests.register('editor: commands registered with ribbon groups', () => {
    for (const id of ['format.bold', 'format.style', 'insert.table', 'insert.equation', 'insert.link', 'layout.theme', 'insert.pageBreak', 'edit.pastePlain'])
      app.assert(app.commands.get(id), 'missing ' + id);
    const home = app.ribbon.tabs().find(t => t.id === 'home');
    app.assert(home && home.groups.some(g => g.id === 'styles'), 'Home has Styles');
  });
})();
