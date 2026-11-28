// Markooj — File → Info (document properties), File → Recover (unsaved text), Options → Recovery.
(function () {
  'use strict';
  const app = window.app;
  if (!app) return;
  const mk = window.mk || app.mk || {};
  const esc = app.esc || (s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const invoke = (ch, ...a) => (mk.invoke ? mk.invoke(ch, ...a) : Promise.reject(new Error('No bridge')));
  const icon = (id, extra = '') => `<svg class="i"${extra}><use href="#${id}"/></svg>`;
  const toast = (msg, opts) => { try { app.ui.toast(msg, opts); } catch { console.log(msg); } };
  const days = () => Math.max(7, Number(app.settings.get('recoveryDays', 7)) || 7);

  // ---------- styles (scoped to .rui) ----------
  const css = `
.rui{max-width:1060px;color:var(--text)}
.rui h2{font:600 26px var(--font);letter-spacing:-.02em;margin:0 0 4px}
.rui .rui-sub{color:var(--text-2);margin:0 0 26px;font-size:14px}
.rui-sec{font:600 13px var(--font);color:var(--text-2);margin:26px 0 12px;letter-spacing:.01em;display:flex;align-items:center;gap:8px}
.rui-sec:first-child{margin-top:0}
.rui-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:28px;align-items:start}
@media (max-width:1100px){.rui-grid{grid-template-columns:minmax(0,1fr)}}
.rui-card{background:var(--surface);border:.5px solid var(--line);border-radius:14px;padding:20px;animation:rui-in .3s var(--ease) both}
.rui-form{display:grid;grid-template-columns:1fr 1fr;gap:14px 16px}
.rui-f{display:flex;flex-direction:column;gap:6px;min-width:0}
.rui-f.full{grid-column:1/-1}
.rui-lbl{font-size:12px;font-weight:500;color:var(--text-2)}
.rui-hint{font-size:11.5px;color:var(--text-3)}
.rui-in{height:32px;width:100%;box-sizing:border-box;border-radius:8px;border:.5px solid var(--line-2);background:var(--bg);color:var(--text);font:inherit;font-size:13px;padding:0 10px;outline:0;transition:box-shadow .2s,border-color .2s,background .2s}
.rui-in:hover{border-color:var(--text-3)}
.rui-in:focus,.rui-chips:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-ring);background:var(--surface)}
textarea.rui-in{height:auto;min-height:96px;padding:8px 10px;resize:vertical;line-height:1.5}
select.rui-in{padding-right:6px}
.rui-in[readonly]{color:var(--text-2);background:var(--hover)}
.rui-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-height:32px;box-sizing:border-box;padding:4px 6px;border-radius:8px;border:.5px solid var(--line-2);background:var(--bg);cursor:text;transition:box-shadow .2s,border-color .2s,background .2s}
.rui-chips:hover{border-color:var(--text-3)}
.rui-chip{display:inline-flex;align-items:center;gap:2px;height:22px;padding:0 3px 0 9px;border-radius:11px;background:var(--accent-soft);color:var(--accent);font-size:12px;font-weight:500;animation:rui-pop .2s var(--ease)}
.rui-chip button{width:16px;height:16px;border-radius:50%;display:grid;place-items:center;color:inherit;opacity:.65;transition:background .15s,opacity .15s}
.rui-chip button:hover{background:var(--accent-soft);opacity:1}
.rui-chip button svg.i{width:10px;height:10px;stroke-width:2.2}
.rui-chips input{flex:1;min-width:110px;border:0;outline:0;background:none;font:inherit;font-size:13px;color:var(--text);height:22px;padding:0 4px}
.rui-row{display:flex;gap:8px;align-items:center}
.rui-row>.rui-in{flex:1}
.rui-kv{display:grid;grid-template-columns:minmax(90px,180px) 1fr 30px;gap:8px;align-items:center;margin-bottom:8px;animation:rui-in .25s var(--ease) both}
.rui-btn{height:30px;padding:0 14px;border-radius:8px;font:500 13px var(--font);display:inline-flex;align-items:center;justify-content:center;gap:6px;background:var(--hover);color:var(--text);border:0;cursor:default;white-space:nowrap;transition:background .15s,color .15s,transform .12s var(--ease),box-shadow .15s}
.rui-btn:hover{background:var(--press)}
.rui-btn:active{transform:scale(.96)}
.rui-btn:focus-visible{outline:0;box-shadow:0 0 0 3px var(--accent-ring)}
.rui-btn.primary{background:var(--accent);color:#fff;box-shadow:0 1px 2px rgba(10,82,224,.3)}
.rui-btn.primary:hover{background:var(--accent-2)}
.rui-btn.ghost{background:none;color:var(--text-2)}
.rui-btn.ghost:hover{background:var(--hover);color:var(--text)}
.rui-btn.danger{color:#ff3b30}
.rui-btn.icon{width:30px;padding:0}
.rui-btn[disabled]{opacity:.45;pointer-events:none}
.rui-btn svg.i{width:15px;height:15px}
.rui-bar{display:flex;gap:8px;align-items:center;margin-top:20px}
.rui-bar .rui-state{font-size:12px;color:var(--text-3);margin-left:6px;transition:color .2s}
.rui-bar .rui-state.dirty{color:var(--orange)}
.rui-dl{display:grid;grid-template-columns:86px minmax(0,1fr);gap:9px 12px;font-size:12.5px;margin:0}
.rui-dl dt{color:var(--text-2)}
.rui-dl dd{margin:0;overflow-wrap:anywhere}
.rui-path{font-size:12px;color:var(--text-2);overflow-wrap:anywhere;margin:4px 0 10px;line-height:1.45}
.rui-tags{display:flex;flex-wrap:wrap;gap:5px}
.rui-tag{display:inline-flex;align-items:center;height:20px;font-size:11px;font-weight:500;padding:0 8px;border-radius:10px;background:var(--hover);color:var(--text-2)}
.rui-tag.blue{background:var(--accent-soft);color:var(--accent)}
.rui-tag.crash{background:rgba(255,159,10,.15);color:var(--orange)}
.rui-note{font-size:12.5px;color:var(--text-2);line-height:1.5;background:var(--accent-soft);border-radius:10px;padding:10px 12px;margin:0 0 16px}
.rui-list{display:flex;flex-direction:column;gap:10px;max-width:880px}
.rui-item{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:14px;align-items:start;background:var(--surface);border:.5px solid var(--line);border-radius:14px;padding:14px 16px;transition:border-color .2s,transform .2s var(--ease),box-shadow .2s;animation:rui-in .3s var(--ease) both}
.rui-item:hover,.rui-item:focus-within{border-color:var(--accent);box-shadow:0 10px 26px rgba(0,0,0,.08);transform:translateY(-1px)}
.rui-badge{width:40px;height:48px;border-radius:6px;position:relative;display:grid;place-items:end center;padding-bottom:6px;box-sizing:border-box;font:700 9.5px var(--font);color:#fff;letter-spacing:.03em;background:#0a66ff}
.rui-badge::before{content:"";position:absolute;top:0;right:0;width:12px;height:12px;background:linear-gradient(225deg,var(--bg) 50%,rgba(0,0,0,.18) 50%);border-radius:0 6px 0 3px}
.rui-item h4{margin:0;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.rui-meta{font-size:12px;color:var(--text-2);margin-top:3px;overflow-wrap:anywhere}
.rui-prev{font:13px/1.5 var(--serif);color:var(--text-2);margin-top:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rui-actions{display:flex;gap:6px;align-items:center}
.rui-empty{max-width:880px;text-align:center;padding:56px 20px;border:.5px dashed var(--line-2);border-radius:14px;color:var(--text-2);font-size:13px;animation:rui-in .3s var(--ease) both}
.rui-empty svg.i{width:30px;height:30px;color:var(--text-3);margin-bottom:10px;stroke-width:1.3}
.rui-empty b{display:block;color:var(--text);font-size:15px;margin-bottom:4px}
.rui-diff{font:12px/1.55 var(--mono);max-height:56vh;min-width:min(720px,80vw);overflow:auto;border-radius:10px;border:.5px solid var(--line);background:var(--bg);padding:6px 0;white-space:pre-wrap;word-break:break-word}
.rui-diff div{padding:0 12px 0 26px;position:relative}
.rui-diff div::before{position:absolute;left:10px;color:var(--text-3)}
.rui-diff .add{background:rgba(40,167,69,.13)}.rui-diff .add::before{content:"+";color:var(--green)}
.rui-diff .del{background:rgba(255,59,48,.11)}.rui-diff .del::before{content:"−";color:#ff3b30}
.rui-diff .gap{color:var(--text-3);font-style:italic}
.rui-legend{display:flex;gap:14px;font-size:12px;color:var(--text-2);margin:0 0 10px}
.rui-legend span::before{content:"";display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.rui-legend .l-add::before{background:rgba(40,167,69,.35)}.rui-legend .l-del::before{background:rgba(255,59,48,.3)}
.rui-opt{display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:13px}
.rui-opt select{width:auto;min-width:120px}
.rui-pill{height:20px;padding:0 9px;border-radius:10px;background:rgba(255,159,10,.16);color:var(--orange);font:600 11px var(--font);display:inline-flex;gap:5px;align-items:center;border:0;cursor:default;transition:background .15s,transform .12s var(--ease)}
.rui-pill:hover{background:rgba(255,159,10,.26)}
.rui-pill:active{transform:scale(.95)}
.rui-pill svg.i{width:12px;height:12px}
@keyframes rui-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes rui-pop{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.rui *,.rui{animation:none!important;transition:none!important}}
`;
  function injectStyle() {
    if (document.getElementById('rui-style')) return;
    const s = document.createElement('style'); s.id = 'rui-style'; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyle); else injectStyle();

  // ---------- small helpers ----------
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  function fmtSize(n) {
    if (n == null) return '—';
    if (n < 1024) return app.tn('{count} bytes', n);
    if (n < 1048576) return app.t('{size} KB', { size: num(+(n / 1024).toFixed(n < 10240 ? 1 : 0)) });
    return app.t('{size} MB', { size: num(+(n / 1048576).toFixed(1)) });
  }
  // dates and numbers in the interface language (en-US for English, as before)
  const num = (n, o) => (app.i18n?.number ? app.i18n.number(n, o) : Number(n).toLocaleString('en-US', o));
  const fmtDate = (d, o) => (app.i18n?.date ? app.i18n.date(d, o) : new Intl.DateTimeFormat('en-US', o).format(d));
  const timeOf = d => fmtDate(d, { hour: 'numeric', minute: '2-digit' });
  function relTime(ms) {
    if (!ms) return '—';
    const d = Date.now() - ms, m = Math.round(d / 60000);
    if (d < 45000) return app.t('just now');
    if (m < 60) return app.tn('{count} minutes ago', m);
    const hrs = Math.round(m / 60);
    const then = new Date(ms), now = new Date();
    if (then.toDateString() === now.toDateString()) return hrs < 6 ? app.tn('{count} hours ago', hrs) : app.t('today at {time}', { time: timeOf(then) });
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (then.toDateString() === y.toDateString()) return app.t('yesterday at {time}', { time: timeOf(then) });
    const dd = Math.floor(d / 864e5);
    if (dd < 7) return app.tn('{count} days ago', dd);
    return app.t('{date} at {time}', { date: fmtDate(then, { month: 'short', day: 'numeric' }), time: timeOf(then) });
  }
  const fullDate = ms => (ms ? fmtDate(new Date(ms), { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const baseName = p => String(p || '').split(/[\\/]/).pop();
  const fm = () => mk.frontMatter || null;
  function bodyOf(text) { try { return fm() ? fm().parse(text).body : text; } catch { return text; } }
  function countWords(text) {
    // same count as the status bar and the outline card
    try { const s = app.shell?.docStats?.(text || ''); if (s && Number.isFinite(s.words)) return { words: s.words, chars: (text || '').length, minutes: Math.max(1, Math.round(s.words / 230)) }; } catch {}
    const t = bodyOf(text || '')
      .replace(/```[\s\S]*?```/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')
      .replace(/\$\$[\s\S]*?\$\$/g, ' x ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\]\([^)]*\)/g, ']')
      .replace(/[#>*_~`=|[\]^-]+/g, ' ');
    const words = (t.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) || []).length;
    return { words, chars: (text || '').length, minutes: Math.max(1, Math.round(words / 230)) };
  }
  const isMarkdownPath = p => /\.(md|markdown|mdown|mkd|mkdn|mdwn|mdx|rmd|qmd|txt|text)$/i.test(p || '');

  // ---------- chips input ----------
  function chipInput(values, placeholder, label) {
    const wrap = h(`<div class="rui-chips" role="group" aria-label="${esc(label)}"></div>`);
    const input = h(`<input type="text" placeholder="${esc(placeholder)}" aria-label="${esc(label)}">`);
    let list = (values || []).map(String).filter(Boolean);
    const emit = () => wrap.dispatchEvent(new Event('input', { bubbles: true }));
    function draw() {
      wrap.querySelectorAll('.rui-chip').forEach(c => c.remove());
      list.forEach((v, i) => {
        const c = h(`<span class="rui-chip">${esc(v)}<button type="button" title="${app.th('Remove {name}', { name: v })}" aria-label="${app.th('Remove {name}', { name: v })}">${icon('x')}</button></span>`);
        c.querySelector('button').addEventListener('click', e => { e.stopPropagation(); list.splice(i, 1); draw(); emit(); input.focus(); });
        wrap.insertBefore(c, input);
      });
      input.placeholder = list.length ? '' : placeholder;
    }
    function commit() {
      const parts = input.value.split(/[;,\n]/).map(s => s.trim()).filter(Boolean);
      if (!parts.length) return false;
      for (const p of parts) if (!list.includes(p)) list.push(p);
      input.value = ''; draw(); emit(); return true;
    }
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',' || e.key === ';' || (e.key === 'Tab' && input.value.trim())) { if (commit()) e.preventDefault(); else if (e.key !== 'Tab' && e.key !== 'Enter') e.preventDefault(); }
      else if (e.key === 'Backspace' && !input.value && list.length) { list.pop(); draw(); emit(); }
    });
    input.addEventListener('blur', commit);
    input.addEventListener('paste', () => setTimeout(() => { if (/[;,\n]/.test(input.value)) commit(); }));
    wrap.addEventListener('click', e => { if (e.target === wrap) input.focus(); });
    wrap.appendChild(input); draw();
    wrap.values = () => { commit(); return list.slice(); };
    return wrap;
  }

  // ---------- File → Info ----------
  const KNOWN = ['title', 'subtitle', 'author', 'date', 'subject', 'keywords', 'abstract', 'lang', 'bibliography'];
  const ALIASES = { authors: 'author', tags: 'keywords', language: 'lang', description: null };
  const LANGS = [['en-US', app.tm('English (United States)')], ['en-GB', app.tm('English (United Kingdom)')], ['de-DE', app.tm('German')], ['fr-FR', app.tm('French')], ['es-ES', app.tm('Spanish')], ['it-IT', app.tm('Italian')], ['pt-BR', app.tm('Portuguese (Brazil)')], ['nl-NL', app.tm('Dutch')], ['ru-RU', app.tm('Russian')], ['tr-TR', app.tm('Turkish')], ['ar', app.tm('Arabic')], ['ur-PK', app.tm('Urdu')], ['hi-IN', app.tm('Hindi')], ['zh-CN', app.tm('Chinese (Simplified)')], ['ja-JP', app.tm('Japanese')], ['ko-KR', app.tm('Korean')]];
  const scalar = v => v == null || ['string', 'number', 'boolean'].includes(typeof v);
  const asText = v => (v == null ? '' : Array.isArray(v) ? v.map(asText).join(', ') : typeof v === 'object' ? String(v.name || v.literal || '') : String(v));
  const asList = v => (v == null || v === '' ? [] : Array.isArray(v) ? v.map(asText).filter(Boolean) : String(v).split(/;|,(?![^(]*\))/).map(s => s.trim()).filter(Boolean));
  // which key in the document's front matter holds a known field (keeps "authors", "language", "tags" spellings)
  function keyFor(meta, field) {
    for (const k of Object.keys(meta)) { const l = k.toLowerCase(); if (l === field || ALIASES[l] === field) return k; }
    return field;
  }

  async function renderInfo(el, docArg) {
    const doc = docArg || app.docs.active();
    el.innerHTML = '';
    const root = h(`<div class="rui rui-info"><h2>${app.th('Info')}</h2><p class="rui-sub">${app.th('Document properties are saved inside the file, at the top, where Pandoc, Quarto and journals can read them.')}</p></div>`);
    el.appendChild(root);
    if (!doc) { root.appendChild(h(`<div class="rui-empty">${icon('info')}<b>${app.th('No document is open')}</b>${app.th('Open or create a document to see its properties.')}</div>`)); return; }

    const grid = h(`<div class="rui-grid"><div class="rui-left"></div><div class="rui-right"></div></div>`);
    root.appendChild(grid);
    const left = grid.querySelector('.rui-left'), right = grid.querySelector('.rui-right');
    const editable = doc.kind === 'markdown' && !doc.readOnly;
    let meta = {};
    if (doc.kind !== 'markdown') meta = { ...(doc.meta || {}) };
    else try { meta = fm() ? fm().parse(doc.text || '').meta || {} : doc.meta || {}; } catch { meta = doc.meta || {}; }
    const K = f => keyFor(meta, f);
    const val = f => meta[K(f)];

    // --- properties form ---
    const card = h(`<section class="rui-card" aria-label="${app.th('Document properties')}"><div class="rui-sec">${icon('info')} ${app.th('Properties')}</div></section>`);
    left.appendChild(card);
    if (!editable) {
      card.appendChild(h(`<p class="rui-note">${doc.kind === 'pdf' || doc.kind === 'djvu' ? app.th('This {type} file is shown read-only. To edit its text, use “Edit as text”, then set properties on the new document.', { type: doc.kind.toUpperCase() }) : app.th('To change these properties, use “Edit as text” to make an editable copy. This document is read-only.')}</p>`));
    }
    const ro = editable ? '' : ' readonly';
    const dateVal = asText(val('date'));
    const isoDate = !dateVal || /^\d{4}-\d{2}-\d{2}$/.test(dateVal);
    const form = h(`<form class="rui-form" autocomplete="off">
      <div class="rui-f full"><label class="rui-lbl" for="rui-title">${app.th('Title')}</label><input class="rui-in" id="rui-title" name="title" value="${esc(asText(val('title')))}" placeholder="${app.th('Add a title')}"${ro}></div>
      <div class="rui-f full"><label class="rui-lbl" for="rui-subtitle">${app.th('Subtitle')}</label><input class="rui-in" id="rui-subtitle" name="subtitle" value="${esc(asText(val('subtitle')))}" placeholder="${app.th('Optional')}"${ro}></div>
      <div class="rui-f full" data-chips="author"><span class="rui-lbl">${app.th('Author(s)')}</span></div>
      <div class="rui-f"><label class="rui-lbl" for="rui-date">${app.th('Date')}</label><div class="rui-row"><input class="rui-in" id="rui-date" name="date" type="${isoDate ? 'date' : 'text'}" value="${esc(dateVal)}"${ro}>${editable ? `<button type="button" class="rui-btn ghost" data-act="today" title="${app.th('Use today’s date')}">${app.th('Today')}</button>` : ''}</div></div>
      <div class="rui-f"><label class="rui-lbl" for="rui-lang">${app.th('Language')}</label><input class="rui-in" id="rui-lang" name="lang" list="rui-langs" value="${esc(asText(val('lang')))}" placeholder="en-US"${ro}><datalist id="rui-langs">${LANGS.map(([v, l]) => `<option value="${v}">${app.th(l)}</option>`).join('')}</datalist></div>
      <div class="rui-f full"><label class="rui-lbl" for="rui-subject">${app.th('Subject')}</label><input class="rui-in" id="rui-subject" name="subject" value="${esc(asText(val('subject')))}" placeholder="${app.th('What the document is about')}"${ro}></div>
      <div class="rui-f full" data-chips="keywords"><span class="rui-lbl">${app.th('Keywords')}</span></div>
      <div class="rui-f full"><label class="rui-lbl" for="rui-abstract">${app.th('Abstract')}</label><textarea class="rui-in" id="rui-abstract" name="abstract" rows="4" placeholder="${app.th('A short summary of the document')}"${ro}>${esc(asText(val('abstract')))}</textarea></div>
      <div class="rui-f full"><label class="rui-lbl" for="rui-bib">${app.th('Bibliography file')}</label><div class="rui-row"><input class="rui-in" id="rui-bib" name="bibliography" value="${esc(asText(val('bibliography')))}" placeholder="references.bib"${ro}>${editable ? `<button type="button" class="rui-btn" data-act="bib">${app.th('Browse…')}</button>` : ''}</div><span class="rui-hint">${app.th('BibTeX (.bib), CSL JSON or YAML. Used by References → Cite and by exports.')}</span></div>
    </form>`);
    card.appendChild(form);
    const F = n => form.querySelector('[name="' + n + '"]');
    const chips = {};
    for (const slot of form.querySelectorAll('[data-chips]')) {
      const f = slot.getAttribute('data-chips');
      const c = chipInput(asList(val(f)), f === 'author' ? app.t('Type a name, then press Enter') : app.t('Type a keyword, then press Enter'), f === 'author' ? app.t('Authors') : app.t('Keywords'));
      if (!editable) c.querySelectorAll('input,button').forEach(x => { x.disabled = true; });
      chips[f] = c; slot.appendChild(c);
    }
    // custom fields
    const knownKeys = new Set(KNOWN.map(K));
    const customs = Object.keys(meta).filter(k => !knownKeys.has(k));
    const customSec = h(`<div><div class="rui-sec">${app.th('More properties')}</div><div class="rui-kvs"></div>${editable ? `<button type="button" class="rui-btn ghost" data-act="add">${icon('plus')} ${app.th('Add a property')}</button>` : ''}</div>`);
    card.appendChild(customSec);
    const kvs = customSec.querySelector('.rui-kvs');
    function addRow(key = '', value = '', complex = false) {
      const row = h(`<div class="rui-kv"><input class="rui-in" data-k placeholder="${app.th('Name@@property')}" aria-label="${app.th('Property name')}" value="${esc(key)}"${ro || (complex ? ' readonly' : '')}><input class="rui-in" data-v placeholder="${app.th('Value')}" aria-label="${app.th('Property value')}" value="${esc(value)}"${ro || (complex ? ` readonly title="${app.th('This value has several parts. Edit it in Simple mode.')}"` : '')}>${editable ? `<button type="button" class="rui-btn ghost icon" title="${app.th('Remove property')}" aria-label="${app.th('Remove property')}">${icon('x')}</button>` : '<span></span>'}</div>`);
      row.dataset.orig = key; if (complex) row.dataset.complex = '1';
      const rm = row.querySelector('button');
      if (rm) rm.addEventListener('click', () => { row.remove(); markDirty(); });
      kvs.appendChild(row);
      return row;
    }
    for (const k of customs) {
      const v = meta[k];
      if (scalar(v)) addRow(k, v == null ? '' : String(v));
      else addRow(k, JSON.stringify(v), true);
    }
    if (!customs.length && !editable) kvs.appendChild(h(`<p class="rui-hint">${app.th('None.')}</p>`));

    let bar = null;
    if (editable) {
      bar = h(`<div class="rui-bar"><button type="button" class="rui-btn primary" data-act="save" title="${app.th('Save properties (Ctrl+Enter)')}">${icon('check')} ${app.th('Save properties')}</button><button type="button" class="rui-btn" data-act="revert">${app.th('Undo changes')}</button><span class="rui-state" aria-live="polite"></span></div>`);
      card.appendChild(bar);
    }
    const state = bar && bar.querySelector('.rui-state');
    function markDirty() { if (state) { state.textContent = app.t('Changes not saved yet'); state.classList.add('dirty'); } }
    form.addEventListener('input', markDirty);
    customSec.addEventListener('input', markDirty);

    function collect() {
      const vals = {
        title: F('title').value.trim(), subtitle: F('subtitle').value.trim(), author: chips.author.values(), date: F('date').value.trim(),
        subject: F('subject').value.trim(), keywords: chips.keywords.values(), abstract: F('abstract').value.replace(/\s+$/, ''),
        lang: F('lang').value.trim(), bibliography: F('bibliography').value.trim(),
      };
      const shape = (f, v) => {
        if (f === 'author') { const orig = val('author'); return v.length === 1 && !Array.isArray(orig) ? v[0] : v; }
        if (f === 'keywords') return v;
        return v;
      };
      const rows = [...kvs.querySelectorAll('.rui-kv')].map(r => ({ orig: r.dataset.orig, complex: !!r.dataset.complex, k: r.querySelector('[data-k]').value.trim(), v: r.querySelector('[data-v]').value }));
      const out = {};
      const done = new Set();
      // existing keys first, in the document's order
      for (const k of Object.keys(meta)) {
        const field = KNOWN.find(f => K(f) === k);
        if (field) { out[k] = shape(field, vals[field]); done.add(field); continue; }
        const r = rows.find(x => x.orig === k);
        if (!r || !r.k) continue; // removed
        r.used = true;
        if (r.complex) { out[r.k] = meta[k]; continue; }
        const orig = meta[k];
        out[r.k] = orig != null && typeof orig !== 'string' && String(orig) === r.v ? orig : r.v;
      }
      for (const f of KNOWN) if (!done.has(f)) out[f] = shape(f, vals[f]);
      for (const r of rows) if (!r.used && !r.orig && r.k && !(r.k in out)) out[r.k] = r.v;
      return out;
    }
    async function save() {
      const d = app.docs.get ? app.docs.get(doc.id) || doc : doc;
      if (!fm()) { toast(app.t('Restart Markooj, then save the properties again. The front matter tools did not load this time.'), { kind: 'error' }); return false; }
      const text = fm().write(d.text || '', collect());
      d.setText(text, 'info');
      if (state) { state.textContent = app.t('Saved in the document'); state.classList.remove('dirty'); }
      toast(app.t('Document properties saved. Save the document to keep them.'));
      await renderInfo(el, d);
      return true;
    }
    if (editable) {
      bar.querySelector('[data-act=save]').addEventListener('click', save);
      bar.querySelector('[data-act=revert]').addEventListener('click', () => renderInfo(el, doc));
      customSec.querySelector('[data-act=add]').addEventListener('click', () => { const r = addRow(); r.querySelector('[data-k]').focus(); markDirty(); });
      form.querySelector('[data-act=today]').addEventListener('click', () => { const d = new Date(); F('date').type = 'date'; F('date').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; markDirty(); });
      form.querySelector('[data-act=bib]').addEventListener('click', async () => {
        try {
          const p = await invoke('pick-file', [{ name: app.t('Bibliography'), extensions: ['bib', 'json', 'yaml', 'yml'] }, { name: app.t('All files'), extensions: ['*'] }]);
          if (!p) return;
          let rel = p;
          if (doc.path) {
            const dir = doc.path.replace(/[\\/][^\\/]*$/, '');
            if (p.toLowerCase().startsWith(dir.toLowerCase() + '\\') || p.toLowerCase().startsWith(dir.toLowerCase() + '/')) rel = p.slice(dir.length + 1).replace(/\\/g, '/');
          }
          F('bibliography').value = rel; markDirty();
        } catch (e) { app.ui.fail(e, { lead: app.t('Type the bibliography file name into the box instead, or try Browse again.') }); }
      });
      root.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(); } });
      form.addEventListener('submit', e => { e.preventDefault(); save(); });
    }
    root._collect = collect; root._save = save;

    // --- file card ---
    const fileCard = h(`<section class="rui-card" aria-label="${app.th('File@@info card')}"><div class="rui-sec">${icon('doc')} ${app.th('File@@info card')}</div></section>`);
    right.appendChild(fileCard);
    if (doc.path) {
      const p = h(`<div><div class="rui-path">${esc(doc.path)}</div><div class="rui-row" style="margin-bottom:14px"><button type="button" class="rui-btn" data-act="reveal">${icon('open')} ${app.th('Show in folder')}</button></div></div>`);
      p.querySelector('[data-act=reveal]').addEventListener('click', () => invoke('reveal', doc.path).catch(e => app.ui.fail(e, { lead: app.t('Check that the file is still there. Copy its path to find it.'), hideReason: true, actions: [{ label: app.t('Copy path'), run: () => app.ui.copyText?.(doc.path, app.t('Path copied')) }] })));
      fileCard.appendChild(p);
    } else {
      const p = h(`<div><div class="rui-path">${app.th('Not saved yet.')}</div><div class="rui-row" style="margin-bottom:14px"><button type="button" class="rui-btn primary" data-act="saveas">${icon('save')} ${app.th('Save…')}</button></div></div>`);
      p.querySelector('[data-act=saveas]').addEventListener('click', async () => { try { app.backstage.close(); await app.docs.save(doc); } catch (e) { app.ui.fail(e, { lead: app.t('Try saving again, or choose another folder.'), retry: () => app.docs.save(doc) }); } });
      fileCard.appendChild(p);
    }
    const c = countWords(doc.text || '');
    const flavor = doc.flavor || (mk.detectFlavor ? mk.detectFlavor(doc.text || '') : { name: 'Markdown', features: [] });
    app.tm('LaTeX math'); // preload's detectFlavor feature names are translated when drawn (wikilinks, footnotes, callouts: shell.json)
    const dl = h(`<dl class="rui-dl">
      <dt>${app.th('Size')}</dt><dd data-f="size">—</dd><dt>${app.th('Created')}</dt><dd data-f="created">—</dd><dt>${app.th('Modified')}</dt><dd data-f="modified">—</dd>
      <dt>${app.th('Type')}</dt><dd>${esc((doc.ext || 'md').toUpperCase())}${doc.convertedFrom ? ` <span class="rui-hint">${app.th('(converted, save as Markdown to keep edits)')}</span>` : ''}</dd>
      ${doc.kind === 'markdown' ? `<dt>${app.th('Flavor')}</dt><dd><span class="rui-tag blue">${esc(flavor.name)}</span></dd>
      <dt>${app.th('Features@@markdown')}</dt><dd><div class="rui-tags">${(flavor.features || []).length ? flavor.features.map(f => `<span class="rui-tag">${esc(app.t(f))}</span>`).join('') : `<span class="rui-hint">${app.th('Plain Markdown')}</span>`}</div></dd>
      <dt>${app.th('Words')}</dt><dd>${esc(num(c.words))}</dd><dt>${app.th('Characters')}</dt><dd>${esc(num(c.chars))}</dd><dt>${app.th('Reading')}</dt><dd>${app.th('about {count} min', { count: c.minutes })}</dd>` : ''}
      ${doc.pages ? `<dt>${app.th('Pages')}</dt><dd>${esc(doc.pages)}</dd>` : ''}
      ${doc.dirty ? `<dt>${app.th('Status')}</dt><dd><span class="rui-tag crash">${app.th('Unsaved changes')}</span></dd>` : ''}
    </dl>`);
    fileCard.appendChild(dl);
    if (doc.path) {
      try {
        const info = await invoke('file-info', doc.path);
        if (info) {
          dl.querySelector('[data-f=size]').textContent = fmtSize(info.size);
          dl.querySelector('[data-f=created]').textContent = fullDate(info.created);
          dl.querySelector('[data-f=modified]').textContent = fullDate(info.modified);
        } else dl.querySelector('[data-f=size]').textContent = app.t('Save to write it again (the file is no longer on disk)');
      } catch {}
    } else {
      dl.querySelector('[data-f=size]').textContent = fmtSize(new Blob([doc.text || '']).size);
    }
    return root;
  }

  // ---------- line diff (for "Compare with file on disk") ----------
  function diffLines(a, b) {
    const A = a.split(/\r?\n/), B = b.split(/\r?\n/);
    let s = 0; while (s < A.length && s < B.length && A[s] === B[s]) s++;
    let e = 0; while (e < A.length - s && e < B.length - s && A[A.length - 1 - e] === B[B.length - 1 - e]) e++;
    const a2 = A.slice(s, A.length - e), b2 = B.slice(s, B.length - e);
    const out = [];
    const ctx = n => A.slice(Math.max(0, s - n), s);
    if (s > 3) out.push({ t: 'gap', s: app.tn('{count} unchanged lines', s - 3) });
    ctx(3).forEach(l => out.push({ t: 'same', s: l }));
    const n = a2.length, m = b2.length;
    if (n * m > 4e6) { a2.forEach(l => out.push({ t: 'del', s: l })); b2.forEach(l => out.push({ t: 'add', s: l })); }
    else {
      const w = m + 1, L = new Uint32Array((n + 1) * w);
      for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i * w + j] = a2[i] === b2[j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (a2[i] === b2[j]) { out.push({ t: 'same', s: a2[i] }); i++; j++; }
        else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) out.push({ t: 'del', s: a2[i++] });
        else out.push({ t: 'add', s: b2[j++] });
      }
      while (i < n) out.push({ t: 'del', s: a2[i++] });
      while (j < m) out.push({ t: 'add', s: b2[j++] });
    }
    A.slice(A.length - e, A.length - e + 3).forEach(l => out.push({ t: 'same', s: l }));
    if (e > 3) out.push({ t: 'gap', s: app.tn('{count} unchanged lines', e - 3) });
    return out;
  }

  // ---------- File → Recover ----------
  let crashedCount = 0;
  async function listEntries() {
    let list = [];
    try { list = await invoke('recovery-list'); } catch (e) { console.warn('recovery-list', e); return []; }
    const openIds = new Set(app.docs.list().map(d => d.recoveryId));
    return (list || []).filter(e => !(e.current && openIds.has(e.docId)));
  }

  async function openEntry(e) {
    const full = await invoke('recovery-get', e.docId);
    if (!full) { toast(app.t('Pick another item in File → Recover. This one was already removed (recovered text is kept for a limited time).'), { kind: 'warn' }); return null; }
    const existing = full.path && app.docs.list().find(d => d.path && d.path.toLowerCase() === full.path.toLowerCase());
    if (existing) {
      const v = await app.ui.dialog({ title: app.t('“{name}” is already open', { name: existing.title }), body: app.t('Replace its text with the recovered text, or open the recovered text as a separate copy?'), buttons: [{ label: app.t('Cancel'), value: 'cancel' }, { label: app.t('Open as copy'), value: 'copy' }, { label: app.t('Replace text'), value: 'replace', primary: true }] });
      if (v === 'replace') { existing.setText(full.text, 'recover'); app.docs.activate(existing.id); app.backstage.close(); toast(app.t('Recovered text placed in “{name}”. Save to keep it.', { name: existing.title })); return existing; }
      if (v !== 'copy') return null;
      const d = app.docs.create({ text: full.text, title: app.t('{name} (recovered)', { name: full.title }), recoveryId: full.docId });
      d.dirty = true; app.events.emit('doc:changed', { doc: d, origin: 'recover' });
      app.backstage.close(); return d;
    }
    let disk = null;
    if (full.path && isMarkdownPath(full.path) && e.exists !== false) { try { disk = await invoke('read-text', full.path); } catch { disk = null; } }
    let doc;
    if (disk != null) {
      // reopen the original file and put the recovered text on top of it, as unsaved changes
      doc = app.docs.create({ path: full.path, text: disk, title: full.title, recoveryId: full.docId });
      doc.setText(full.text, 'recover');
    } else {
      doc = app.docs.create({ text: full.text, title: full.title || app.t('Recovered'), recoveryId: full.docId });
      doc.dirty = true; app.events.emit('doc:changed', { doc, origin: 'recover' });
    }
    app.backstage.close();
    toast(app.t('Recovered “{name}”. Save it to keep it.', { name: doc.title }));
    return doc;
  }

  async function compareEntry(e) {
    const full = await invoke('recovery-get', e.docId);
    let disk = '';
    try { disk = await invoke('read-text', full.path); } catch (err) { app.ui.fail(err, { lead: app.t('Click Open to get the recovered text back. Compare needs the original file, which Markooj can’t read right now.'), hideReason: true, actions: [{ label: app.t('Open@@verb'), run: () => openEntry(e) }] }); return; }
    const rows = diffLines(disk, full.text || '');
    const changed = rows.filter(r => r.t === 'add' || r.t === 'del').length;
    const body = h(`<div><div class="rui-legend"><span class="l-del">${app.th('Only in the file on disk')}</span><span class="l-add">${app.th('Only in the recovered text')}</span></div><div class="rui-diff" role="region" aria-label="${app.th('Differences')}" tabindex="0"></div></div>`);
    const box = body.querySelector('.rui-diff');
    if (!changed) box.appendChild(h(`<div class="gap">${app.th('The recovered text is the same as the file on disk.')}</div>`));
    else for (const r of rows.slice(0, 4000)) { const d = document.createElement('div'); d.className = r.t; d.textContent = r.s || ' '; box.appendChild(d); }
    const v = await app.ui.dialog({ title: app.t('Compare “{name}”', { name: full.title }), body, buttons: [{ label: app.t('Close'), value: 'close' }, { label: app.t('Open recovered text'), value: 'open', primary: true }] });
    if (v === 'open') openEntry(e);
  }

  async function renderRecover(el) {
    el.innerHTML = '';
    const root = h(`<div class="rui rui-recover"><h2>${app.th('Recover')}</h2><p class="rui-sub">${app.th('Text you closed without saving, or that was open when Markooj stopped, is kept here for {count} days.', { count: days() })}</p>
      <div class="rui-row" style="margin-bottom:18px;flex-wrap:wrap">
        <button type="button" class="rui-btn" data-act="folder">${icon('open')} ${app.th('Open recovery folder')}</button>
        <button type="button" class="rui-btn ghost" data-act="options">${icon('gear')} ${app.th('Kept for {count} days — change in Options', { count: days() })}</button>
        <span style="flex:1"></span>
        <button type="button" class="rui-btn ghost danger" data-act="clear" disabled>${icon('x')} ${app.th('Delete all')}</button>
      </div><div class="rui-list" role="list"></div></div>`);
    el.appendChild(root);
    root.querySelector('[data-act=folder]').addEventListener('click', openFolder);
    root.querySelector('[data-act=options]').addEventListener('click', () => app.backstage.open('options'));
    const listEl = root.querySelector('.rui-list');
    const entries = await listEntries();
    const clear = root.querySelector('[data-act=clear]');
    clear.disabled = !entries.length;
    clear.addEventListener('click', async () => {
      if (!(await app.ui.confirm(app.t('Delete all recovered text?'), app.tn('{count} items will be deleted. This cannot be undone.', entries.length), { ok: app.t('Delete All'), danger: true }))) return;
      for (const e of entries) await invoke('recovery-delete', e.docId).catch(() => {});
      crashedCount = 0; app.status.refresh?.();
      toast(app.t('Recovered text deleted.'));
      renderRecover(el);
    });
    if (!entries.length) {
      listEl.replaceWith(h(`<div class="rui-empty">${icon('check')}<b>${app.th('Nothing to recover')}</b>${app.th('When you close a document without saving, its text shows up here.')}</div>`));
      return root;
    }
    entries.forEach((e, i) => {
      const ext = (e.path ? (e.path.split('.').pop() || 'md') : 'md').slice(0, 4).toUpperCase();
      const status = e.crashed ? `<span class="rui-tag crash">${app.th('Markooj stopped unexpectedly')}</span>` : e.closedAt ? `<span class="rui-tag">${app.th('Closed without saving')}</span>` : `<span class="rui-tag">${app.th('Not saved')}</span>`;
      const item = h(`<article class="rui-item" role="listitem" tabindex="0" style="animation-delay:${Math.min(i, 8) * 30}ms" aria-label="${esc(e.title)}">
        <span class="rui-badge">${esc(ext)}</span>
        <div><h4>${esc(e.title || app.t('Untitled'))} ${status}</h4>
          <div class="rui-meta">${e.path ? esc(e.path) : app.th('Never saved')}${e.path && !e.exists ? ` ${app.th('(file no longer there)')}` : ''}</div>
          <div class="rui-meta" title="${esc(fullDate(e.savedAt))}">${app.th('Last change {when}', { when: relTime(e.savedAt) })}${e.closedAt ? ` · ${app.th('closed {when}', { when: relTime(e.closedAt) })}` : ''} · ${esc(fmtSize(e.size))}</div>
          ${e.preview ? `<div class="rui-prev">${esc(e.preview)}</div>` : ''}
        </div>
        <div class="rui-actions">
          ${e.path && e.exists && isMarkdownPath(e.path) ? `<button type="button" class="rui-btn ghost" data-act="compare" title="${app.th('Compare with the file on disk')}">${app.th('Compare')}</button>` : ''}
          <button type="button" class="rui-btn ghost icon" data-act="delete" title="${app.th('Delete this recovered text')}" aria-label="${app.th('Delete')}">${icon('x')}</button>
          <button type="button" class="rui-btn primary" data-act="open">${app.th('Open@@verb')}</button>
        </div></article>`);
      item.querySelector('[data-act=open]').addEventListener('click', () => openEntry(e).catch(err => app.ui.fail(err, { lead: app.t('Try Open again. The recovered text is still kept.'), retry: () => openEntry(e) })));
      item.querySelector('[data-act=compare]')?.addEventListener('click', () => compareEntry(e).catch(err => app.ui.fail(err, { lead: app.t('Click Open to get the recovered text back.'), actions: [{ label: app.t('Open@@verb'), run: () => openEntry(e) }] })));
      item.querySelector('[data-act=delete]').addEventListener('click', async () => {
        if (!(await app.ui.confirm(app.t('Delete this recovered text?'), app.t('“{name}” will be deleted from the recovery store. This cannot be undone.', { name: e.title }), { ok: app.t('Delete'), danger: true }))) return;
        await invoke('recovery-delete', e.docId).catch(() => {});
        item.style.transition = 'opacity .2s, transform .2s'; item.style.opacity = '0'; item.style.transform = 'scale(.98)';
        setTimeout(() => renderRecover(el), 200);
      });
      item.addEventListener('keydown', ev => {
        if (ev.target !== item) return;
        if (ev.key === 'Enter') { ev.preventDefault(); openEntry(e); }
        else if (ev.key === 'Delete') { ev.preventDefault(); item.querySelector('[data-act=delete]').click(); }
        else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); const sib = ev.key === 'ArrowDown' ? item.nextElementSibling : item.previousElementSibling; sib?.focus(); }
      });
      listEl.appendChild(item);
    });
    return root;
  }

  async function openFolder() {
    try { const dir = await invoke('recovery-dir'); await invoke('open-folder', dir); }
    catch (e) { app.ui.fail(e, { lead: app.t('Use File → Recover to open recovered text. The folder didn’t open this time.'), hideReason: true, retry: () => openFolder() }); }
  }

  // ---------- Options → Recovery ----------
  function renderOptions(el) {
    const cur = days();
    const opts = [...new Set([7, 14, 30, 90, cur])].sort((a, b) => a - b);
    el.innerHTML = '';
    const root = h(`<div class="rui"><div class="rui-opt">
      <label class="rui-lbl" for="rui-days" style="font-size:13px;color:var(--text)">${app.th('Keep unsaved text for')}</label>
      <select class="rui-in" id="rui-days">${opts.map(d => `<option value="${d}"${d === cur ? ' selected' : ''}>${app.th('{count} days', { count: d })}</option>`).join('')}</select>
      <button type="button" class="rui-btn" data-act="folder">${icon('open')} ${app.th('Open recovery folder')}</button>
      <button type="button" class="rui-btn ghost" data-act="recover">${app.th('See recovered documents')}</button>
    </div><p class="rui-hint" style="margin:8px 0 0">${app.th('Markooj keeps a copy of every unsaved document, also after a crash. Copies are kept at least {count} days.', { count: 7 })}</p></div>`);
    root.querySelector('#rui-days').addEventListener('change', ev => {
      const n = Math.max(7, Number(ev.target.value) || 7);
      app.settings.set('recoveryDays', n);
      toast(app.tn('Unsaved text is now kept for {count} days.', n));
    });
    root.querySelector('[data-act=folder]').addEventListener('click', openFolder);
    root.querySelector('[data-act=recover]').addEventListener('click', () => app.backstage.open('recover'));
    el.appendChild(root);
    return root;
  }

  // ---------- registration ----------
  app.backstage.addPage({ id: 'info', label: app.tm('Info'), icon: 'info', order: 70, render: el => renderInfo(el) });
  app.backstage.addPage({ id: 'recover', label: app.tm('Recover'), icon: 'undo', order: 75, render: el => renderRecover(el) });
  app.options.addSection({ id: 'recovery', label: app.tm('Recovery'), order: 60, render: renderOptions });

  app.commands.register('file.info', { label: app.tm('Document properties (Info)'), icon: 'info', run: () => app.backstage.open('info') });
  app.commands.register('file.recover', { label: app.tm('Recover unsaved documents'), icon: 'undo', run: () => app.backstage.open('recover') });
  app.commands.register('file.openRecoveryFolder', { label: app.tm('Open recovery folder'), icon: 'open', run: openFolder });
  app.commands.register('file.revealInFolder', {
    label: app.tm('Show file in folder'), icon: 'open',
    isEnabled: () => !!app.docs.active()?.path,
    run: () => { const d = app.docs.active(); if (d?.path) return invoke('reveal', d.path); },
  });

  // status bar: a calm pill only when something was recovered after a crash
  app.status.addItem({
    id: 'recovery', side: 'right', order: 5,
    render(el) {
      el.innerHTML = '';
      el.hidden = !crashedCount;
      if (!crashedCount) return;
      const b = h(`<button type="button" class="rui-pill" title="${app.th('Open File → Recover')}">${icon('undo')} ${app.th('{count} recovered', { count: crashedCount })}</button>`);
      b.addEventListener('click', () => app.backstage.open('recover'));
      el.appendChild(b);
    },
  });

  // after a crash: tell the user once, then remember that they were told
  let checked = false;
  async function checkCrashed() {
    if (checked) return; checked = true;
    let list = [];
    try { list = await invoke('recovery-list'); } catch { return; }
    const crashed = (list || []).filter(e => e.crashed && !e.closedAt);
    if (!crashed.length) return;
    crashedCount = crashed.length;
    app.status.refresh?.();
    toast(crashed.length === 1 ? app.t('Open File → Recover to get back your unsaved text from “{name}”.', { name: crashed[0].title }) : app.tn('Open File → Recover to get back unsaved text from {count} documents.', crashed.length),
      { kind: 'info', timeout: 12000, actions: [{ label: app.t('Open Recover'), run: () => app.backstage.open('recover') }] });
    for (const e of crashed) invoke('recovery-mark-closed', e.docId, { crashed: true }).catch(() => {});
  }
  app.events.on('ready', () => setTimeout(checkCrashed, 600));
  setTimeout(() => { if (!checked && document.readyState === 'complete') checkCrashed(); }, 6000);

  app.recovery = { list: listEntries, open: openEntry, compare: compareEntry, check: checkCrashed, diffLines, renderInfo, renderRecover, renderOptions, countWords };
  app.info = { render: renderInfo };

  // ---------- smoke tests (main process, preload, and this module) ----------
  const T = app.tests, A = app.assert;
  T.register('main: settings round trip and recovery floor of 7 days', async () => {
    const before = await invoke('settings-get');
    const r = await invoke('settings-set', { recoveryDays: 3, smokeKey: 'x' });
    A(r.recoveryDays === 7, 'recoveryDays clamps to 7, got ' + r.recoveryDays);
    A((await invoke('settings-get')).smokeKey === 'x', 'settings persisted');
    await invoke('settings-set', { recoveryDays: before.recoveryDays ?? 7, smokeKey: undefined });
  });
  T.register('main: recovery store save/list/get/mark/delete', async () => {
    const id = 'smoke-' + Date.now();
    await invoke('recovery-save', { docId: id, path: null, title: 'Smoke doc', text: '# Smoke\n\nHello recovery.' });
    let list = await invoke('recovery-list');
    const e = list.find(x => x.docId === id);
    A(e && /Hello recovery/.test(e.preview) && e.size > 0, 'entry listed with preview');
    A(list.every((x, i) => !i || list[i - 1].savedAt >= x.savedAt), 'newest first');
    await invoke('recovery-mark-closed', id);
    A((await invoke('recovery-get', id)).closedAt, 'closedAt stamped');
    await invoke('recovery-delete', id);
    list = await invoke('recovery-list');
    A(!list.find(x => x.docId === id), 'entry deleted');
  });
  T.register('main: export formats and tools', async () => {
    const f = await invoke('export-formats');
    for (const id of ['md', 'txt', 'html', 'pdf', 'docx', 'epub']) A(f.find(x => x.id === id && x.available), 'built-in ' + id);
    A(f.every(x => 'available' in x && x.via), 'every format has available and via');
    const t = await invoke('tools');
    A('pandoc' in t && 'ddjvu' in t && 'bundled' in t, 'tools shape');
    // the bundled tools (vendor/<platform>) must be found when they were fetched
    const info = await invoke('app-info');
    // since 1.2 the installer is slim: only the full copy (portable zip, or a dev checkout after fetch-tools) carries the bundle;
    // a slim copy gets the tools from File → Options → Features
    const health = await invoke('tools-health').catch(() => null);
    if (info.platform === 'win32' && health && health.bundleExpected) {
      A(t.pandoc && t.pdf2djvu && t.ddjvu && t.djvutxt, 'bundled Pandoc, pdf2djvu, ddjvu and djvutxt resolve: ' + JSON.stringify(t));
      A(t.bundled === true, 'tools come from the bundle, not PATH');
    }
  });
  T.register('main: write/read/file-info and the Markdown-only save guard', async () => {
    const info = await invoke('app-info');
    const p = info.userData.replace(/[\\/]$/, '') + (info.platform === 'win32' ? '\\' : '/') + 'smoke-test.md';
    await invoke('write-text', p, '---\ntitle: T\n---\n\n# Hi $x$\n');
    const r = await invoke('read-file', p);
    A(r.kind === 'markdown' && /# Hi/.test(r.text), 'read back');
    const fi = await invoke('file-info', p);
    A(fi && fi.size > 0 && fi.modified, 'file-info');
    let threw = false;
    try { await invoke('write-text', p.replace(/\.md$/, '.docx'), 'x'); } catch { threw = true; }
    A(threw, 'refuses to write Markdown into a .docx');
  });
  T.register('preload: sanitizer removes scripts and handlers, keeps math and comments', () => {
    const r = mk.render('Hi <img src=x onerror="alert(1)"> <script>alert(2)</script> $x^2$\n\n<!-- comment: keep me -->\n\n```mermaid\ngraph TD\n  A --> B\n```\n');
    A(!/onerror|<script/i.test(r.html), 'unsafe markup removed');
    A(/class="mk-math/.test(r.html) && /<math/.test(r.html) && /<annotation/.test(r.html), 'KaTeX HTML + MathML kept');
    A(/<!-- comment: keep me -->/.test(r.html), 'comment kept');
    A(/data-src="graph TD\n?\s*A --&gt; B/.test(r.html) || /data-src="[^"]*--&gt;/.test(r.html), 'mermaid source kept');
  });
  T.register('preload: math macros', () => {
    const r = mk.render('$\\R$', { macros: '\\newcommand{\\R}{\\mathbb{R}}' });
    A(!/katex-error/.test(r.html), 'macro expanded');
  });
  T.register('preload: front matter parse/write keeps order and comments', () => {
    const src = '---\ntitle: Old\n# note\nauthor: [A, B]\nx-custom: 1\n---\n\nBody\n';
    const p = mk.frontMatter.parse(src);
    A(p.meta.title === 'Old' && p.body.trim() === 'Body', 'parse');
    const out = mk.frontMatter.write(src, { title: 'New', author: ['A', 'B'], 'x-custom': 1, keywords: ['k1'] });
    A(/^---\ntitle: New\n# note\nauthor: \[A, B\]\nx-custom: 1\nkeywords:/.test(out), 'order and comment kept: ' + out);
    A(/\n---\n\nBody\n$/.test(out), 'body intact');
    A(mk.frontMatter.write('# Hi\n', {}) === '# Hi\n', 'no metadata, no block');
  });
  T.register('preload: Markdown round-trips through HTML', () => {
    const src = [
      '# Intro', '', 'Inline $x^2$ and \\(y\\), cite [@smith2020, p. 4] and [@a; @b]. A note[^n1] and ^[inline note].', '',
      '| Run | D (mm) | θ |', '| --- | --: | :-: |', '| R1 | 2.0 | 0.061 |', '',
      '- [ ] todo', '- [x] done', '', '$$', 'E = mc^2', '$$', '', '```mermaid', 'graph TD', '  A --> B', '```', '',
      '<div align="center">', '', 'Centered **text**', '', '</div>', '', '<div class="page-break"></div>', '',
      'Some <u>under</u>, ==marked==, <kbd>Ctrl</kbd> and a<br>break.', '', '<!-- comment: check this -->', '', '[^n1]: The note.', '',
    ].join('\n');
    const md1 = mk.toMarkdown(mk.render(src).html);
    for (const s of ['$x^2$', '\\(y\\)', '[@smith2020, p. 4]', '[@a; @b]', '[^n1]', '^[inline note]', '| --: | :-: |', '- [ ] todo', '- [x] done', '$$\nE = mc^2\n$$', '```mermaid\ngraph TD\n  A --> B\n```', '<div align="center">', '<div class="page-break"></div>', '<u>under</u>', '==marked==', '<kbd>Ctrl</kbd>', 'a<br>break', '<!-- comment: check this -->', '[^n1]: The note.'])
      A(md1.includes(s), `kept ${JSON.stringify(s)} in:\n${md1}`);
    const md2 = mk.toMarkdown(mk.render(md1).html);
    A(md1 === md2, 'stable on a second pass');
  });
  T.register('info: properties page renders and writes YAML front matter', async () => {
    const d = app.docs.create({ text: '---\ntitle: First\nproject: Rivers\n---\n\n# Body\n', title: 'Info test' });
    const host = document.createElement('div');
    const root = await renderInfo(host, d);
    A(host.querySelector('#rui-title').value === 'First', 'title loaded');
    A([...host.querySelectorAll('.rui-kv [data-k]')].some(i => i.value === 'project'), 'custom field shown');
    host.querySelector('#rui-title').value = 'Second';
    host.querySelector('#rui-subject').value = 'Sediment';
    await root._save();
    const p = mk.frontMatter.parse(d.text);
    A(p.meta.title === 'Second' && p.meta.subject === 'Sediment' && p.meta.project === 'Rivers', 'saved: ' + d.text);
    A(Object.keys(p.meta)[0] === 'title' && Object.keys(p.meta)[1] === 'project', 'order kept');
    await app.docs.close(d.id, { force: true });
  });
  T.register('recover: page lists an entry and opens it as unsaved', async () => {
    const id = 'smoke-ui-' + Date.now();
    await invoke('recovery-save', { docId: id, path: null, title: 'Recover me', text: '# Recover me\n' });
    await invoke('recovery-mark-closed', id);
    const host = document.createElement('div');
    await renderRecover(host);
    A([...host.querySelectorAll('.rui-item h4')].some(x => /Recover me/.test(x.textContent)), 'listed');
    const doc = await openEntry({ docId: id, exists: false });
    A(doc && doc.dirty && /Recover me/.test(doc.text), 'opened as unsaved');
    await app.docs.close(doc.id, { force: true });
    await invoke('recovery-delete', id);
    A(diffLines('a\nb\nc', 'a\nx\nc').filter(r => r.t !== 'same').length === 2, 'diff finds the change');
  });
})();
