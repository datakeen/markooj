// Markooj — Developer tab: macros in Python (Pyodide, offline) and JavaScript, macro recorder,
// Macro Editor, Python console, LaTeX math macros. Owner: developer. See ARCHITECTURE.md.
(function () {
  'use strict';
  const app = window.app;
  if (!app) return;
  const mk = app.mk || window.mk || {};
  const esc = app.esc || (s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const toast = (m, o) => { try { app.ui.toast(m, o); } catch { console.log('[toast]', m); } };

  // =====================================================================================
  // DOM helpers, styles and icons
  // =====================================================================================
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }
  const svg = (name, extra = '') => `<svg class="i" ${extra}><use href="#${name}"/></svg>`;
  const onBody = fn => document.body ? fn() : document.addEventListener('DOMContentLoaded', fn, { once: true });

  const ICONS = {
    'dev-macros': '<path d="M4 6h10M4 11h10M4 16h6"/><path d="m15 14 6 3.5-6 3.5z"/>',
    'dev-record': '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.6" fill="currentColor" stroke="none"/>',
    'dev-editor': '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 8.5h18M8 12.5l-2 2 2 2M12 16.5h4"/>',
    'dev-run': '<path d="M7 4.5v15l12-7.5z"/>',
    'dev-console': '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 10 3 2.5L7 15M12.5 15.5H17"/>',
    'dev-stop': '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    'dev-download': '<path d="M12 3v12M7 10l5 5 5-5M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
    'dev-book': '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    'dev-python': '<path d="M12 3c-4 0-4 1.6-4 3v2h4.5v1H6c-2 0-3 1.5-3 4s1 4 3 4h2v-2.5c0-1.5 1-2.5 2.5-2.5h4c1.5 0 2.5-1 2.5-2.5V6c0-1.5-1-3-5-3z"/><path d="M12 21c4 0 4-1.6 4-3v-2h-4.5v-1H18c2 0 3-1.5 3-4"/><circle cx="10" cy="5.6" r=".6" fill="currentColor"/>',
    'dev-trash': '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    'dev-edit': '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  };
  // Shell icons this file uses; added only when the page does not define them already.
  const SHELL_FALLBACK = {
    x: '<path d="M18 6 6 18M6 6l12 12"/>', plus: '<path d="M12 5v14M5 12h14"/>', chev: '<path d="m6 9 6 6 6-6"/>',
    save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/>',
    sigma: '<path d="M18 5H6l6 7-6 7h12"/>', open: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3z"/><path d="M3 10h18l-2 9H5z"/>',
    puzzle: '<path d="M10 3a2 2 0 0 1 4 0v2h4a1 1 0 0 1 1 1v4h-2a2 2 0 0 0 0 4h2v4a1 1 0 0 1-1 1h-4v-2a2 2 0 0 0-4 0v2H6a1 1 0 0 1-1-1v-4h2a2 2 0 0 0 0-4H5V6a1 1 0 0 1 1-1h4z"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    spell: '<path d="m3 15 4-10 4 10M4.5 11.5h5M14 14l3 3 5-6"/>', count: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
    hl: '<path d="m9 11-6 6v3h3l6-6M22 7l-5-5-8 8 5 5z"/>', sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  };
  function injectIcons() {
    if (document.getElementById('mkd-icons')) return;
    const all = { ...ICONS };
    for (const [id, p] of Object.entries(SHELL_FALLBACK)) if (!document.getElementById(id)) all[id] = p;
    const defs = Object.entries(all).map(([id, p]) => `<symbol id="${id}" viewBox="0 0 24 24">${p}</symbol>`).join('');
    const wrap = document.createElement('div');
    wrap.innerHTML = `<svg id="mkd-icons" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${defs}</defs></svg>`;
    document.body.prepend(wrap.firstChild);
  }

  const CSS = `
.mkd-overlay svg.i,.mkd-console svg.i,.mkd-rec svg.i{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex:none}
.mkd-overlay{position:fixed;inset:0;z-index:55;display:grid;place-items:center;background:rgba(0,0,0,.18);backdrop-filter:blur(2px);opacity:0;transition:opacity .22s var(--ease,ease);font:13px/1.4 var(--font,system-ui);color:var(--text)}
.mkd-overlay.show{opacity:1}
.mkd-sheet{background:var(--bg);border-radius:14px;box-shadow:var(--pop-shadow);display:flex;flex-direction:column;overflow:hidden;transform:translateY(10px) scale(.985);transition:transform .32s var(--ease,ease)}
.mkd-overlay.show .mkd-sheet{transform:none}
.mkd-head{display:flex;align-items:center;gap:8px;padding:10px 12px 10px 16px;background:var(--chrome);backdrop-filter:saturate(180%) blur(20px);border-bottom:.5px solid var(--line);flex-wrap:wrap}
.mkd-title{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;margin-right:6px}
.mkd-title svg.i{color:var(--accent)}
.mkd-grow{flex:1}
.mkd-btn{height:28px;padding:0 10px;border-radius:7px;display:inline-flex;align-items:center;gap:6px;font:500 12.5px var(--font,system-ui);color:var(--text);background:none;border:0;transition:background .15s,color .15s,transform .12s var(--ease,ease);white-space:nowrap}
.mkd-btn:hover{background:var(--hover)}
.mkd-btn:active{background:var(--press);transform:scale(.96)}
.mkd-btn:disabled{opacity:.45;pointer-events:none}
.mkd-btn svg.i{width:14px;height:14px}
.mkd-btn.primary{background:var(--accent);color:#fff}
.mkd-btn.primary:hover{background:var(--accent-2)}
.mkd-btn.danger{color:#d92d20}
.mkd-btn.danger:hover{background:rgba(217,45,32,.1)}
.mkd-btn.icon{width:28px;padding:0;justify-content:center;color:var(--text-2)}
.mkd-btn.icon:hover{color:var(--text)}
.mkd-btn.on{background:var(--accent-soft);color:var(--accent)}
.mkd-btn kbd,.mkd-kbd{font:500 10.5px var(--font,system-ui);padding:0 4px;border-radius:4px;border:.5px solid currentColor;opacity:.7}
.mkd-input{height:28px;border-radius:7px;border:.5px solid var(--line-2);background:var(--surface);color:var(--text);font:13px var(--font,system-ui);padding:0 9px;outline:none;transition:border-color .15s,box-shadow .15s;min-width:0}
.mkd-input:hover{border-color:var(--accent)}
.mkd-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-ring)}
.mkd-input.capture:focus{background:var(--accent-soft)}
.mkd-field{display:inline-flex;align-items:center;gap:6px;color:var(--text-2);font-size:12px}
.mkd-check{display:inline-flex;align-items:center;gap:7px;color:var(--text);font-size:12.5px;user-select:none}
.mkd-check input{appearance:none;width:16px;height:16px;border-radius:5px;border:.5px solid var(--line-2);background:var(--surface);display:grid;place-items:center;margin:0;transition:background .15s,border-color .15s,box-shadow .15s}
.mkd-check input:checked{background:var(--accent);border-color:var(--accent)}
.mkd-check input:checked::after{content:"";width:8px;height:4.5px;border:2px solid #fff;border-top:0;border-right:0;transform:translateY(-1px) rotate(-45deg)}
.mkd-check input:focus-visible{box-shadow:0 0 0 3px var(--accent-ring)}
.mkd-seg{position:relative;display:inline-flex;background:var(--hover);border-radius:8px;padding:2px;flex:none}
.mkd-seg button{position:relative;z-index:1;height:24px;padding:0 12px;border-radius:6px;font:500 12px var(--font,system-ui);color:var(--text-2);background:none;border:0;transition:color .2s}
.mkd-seg button.on{color:var(--text)}
.mkd-seg button:focus-visible{outline:2px solid var(--accent-ring)}
.mkd-seg-thumb{position:absolute;top:2px;bottom:2px;left:2px;border-radius:6px;background:var(--surface);box-shadow:0 1px 3px rgba(0,0,0,.12),0 0 0 .5px rgba(0,0,0,.04);transition:left .32s var(--ease,ease),width .32s var(--ease,ease)}
.mkd-chip{font:600 9px var(--font,system-ui);padding:1px 5px;border-radius:4px;background:var(--accent-soft);color:var(--accent);letter-spacing:.03em;flex:none}
.mkd-chip.js{background:rgba(255,159,10,.14);color:#c77700}
.mkd-empty{padding:26px 18px;color:var(--text-3);text-align:center;font-size:12.5px;line-height:1.5}
/* editor sheet */
.mkd-editor{width:min(1220px,96vw);height:min(780px,92vh)}
.mkd-body{flex:1;display:grid;grid-template-columns:210px 1fr auto;min-height:0}
.mkd-list{background:var(--bg);border-right:.5px solid var(--line);display:flex;flex-direction:column;min-height:0}
.mkd-list-h{display:flex;align-items:center;justify-content:space-between;padding:12px 10px 6px 14px}
.mkd-list-h h5,.mkd-ref h5{margin:0;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3)}
.mkd-items{overflow:auto;padding:2px 8px 10px;flex:1}
.mkd-item{display:flex;align-items:center;gap:7px;width:100%;padding:6px 8px;border-radius:7px;text-align:left;color:var(--text-2);background:none;border:0;font:13px var(--font,system-ui);transition:background .15s,color .15s}
.mkd-item:hover{background:var(--hover);color:var(--text)}
.mkd-item.on{background:var(--accent-soft);color:var(--accent);font-weight:500}
.mkd-item .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mkd-item .sc{font-size:10.5px;color:var(--text-3)}
.mkd-item .dirty{width:7px;height:7px;border-radius:50%;background:var(--text-3)}
.mkd-main{display:grid;grid-template-rows:auto 1fr auto;min-width:0;min-height:0}
.mkd-props{display:flex;align-items:center;gap:12px;padding:8px 12px;border-bottom:.5px solid var(--line);background:var(--surface);flex-wrap:wrap}
.mkd-out{display:flex;flex-direction:column;border-top:.5px solid var(--line);background:var(--bg);height:170px;min-height:0;transition:height .3s var(--ease,ease)}
.mkd-out.big{height:300px}
.mkd-out-h{display:flex;align-items:center;gap:8px;padding:4px 8px 4px 14px;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3)}
.mkd-out-h .st{text-transform:none;letter-spacing:0;font-size:11.5px;color:var(--text-2);display:flex;align-items:center;gap:6px}
.mkd-dot{width:7px;height:7px;border-radius:50%;background:var(--text-3);flex:none}
.mkd-dot.busy{background:var(--orange,#ff9f0a);animation:mkdPulse 1s ease-in-out infinite}
.mkd-dot.ok{background:var(--green,#28a745)}
.mkd-dot.err{background:#ff3b30}
@keyframes mkdPulse{50%{opacity:.35}}
.mkd-out-body,.mkd-con-out{flex:1;overflow:auto;padding:4px 14px 10px;font:12.5px/1.55 var(--mono,monospace);white-space:pre-wrap;word-break:break-word;user-select:text}
.mkd-line.err{color:#d92d20}
.mkd-line.info{color:var(--text-3)}
.mkd-line.in{color:var(--accent)}
.mkd-line.ret{color:var(--text-2)}
:root[data-theme="dark"] .mkd-line.err{color:#ff6961}
.mkd-goto{font:500 11px var(--font,system-ui);color:var(--accent);background:var(--accent-soft);border:0;border-radius:5px;padding:0 6px;margin-left:8px;height:18px;transition:background .15s}
.mkd-goto:hover{background:var(--accent-ring)}
/* code editor */
.mkd-code{position:relative;display:grid;grid-template-columns:auto 1fr;min-height:0;background:var(--surface);font:13px/20px var(--mono,monospace)}
.mkd-gutter{overflow:hidden;background:var(--bg);border-right:.5px solid var(--line);color:var(--text-3);user-select:none;min-width:46px}
.mkd-gutter-in{padding:12px 0;will-change:transform}
.mkd-gutter-in div{height:20px;padding:0 10px 0 12px;text-align:right;font-size:11.5px}
.mkd-gutter-in div.on{color:var(--text)}
.mkd-gutter-in div.err{color:#fff;background:#ff3b30;border-radius:0 4px 4px 0}
.mkd-area{position:relative;overflow:hidden;min-width:0}
.mkd-area pre,.mkd-area textarea{margin:0;padding:12px 16px 40px;font:inherit;line-height:20px;white-space:pre;tab-size:4;-moz-tab-size:4;border:0;letter-spacing:0;word-spacing:0}
.mkd-area pre{position:absolute;top:0;left:0;min-width:100%;pointer-events:none;color:var(--text);will-change:transform}
.mkd-area textarea{position:absolute;inset:0;width:100%;height:100%;color:transparent;background:transparent;caret-color:var(--text);resize:none;outline:none;overflow:auto}
.mkd-area textarea::selection{background:var(--accent-ring);color:transparent}
.mkd-curline,.mkd-errline{position:absolute;left:0;right:0;height:20px;pointer-events:none}
.mkd-curline{background:var(--accent-soft);opacity:.55}
.mkd-errline{background:rgba(255,59,48,.12);border-left:2px solid #ff3b30}
.mkd-t-kw{color:var(--accent);font-weight:600}
.mkd-t-str{color:#0a8f6a}
.mkd-t-num{color:#c2410c}
.mkd-t-com{color:var(--text-3);font-style:italic}
.mkd-t-api{color:var(--purple,#8e5cf7);font-weight:500}
.mkd-t-bi{color:#b4237a}
.mkd-t-fn{color:var(--text);font-weight:500}
.mkd-t-dec{color:#c77700}
.mkd-t-cs{color:var(--accent)}
.mkd-t-arg{color:#c2410c}
:root[data-theme="dark"] .mkd-t-str{color:#4cc38a}
:root[data-theme="dark"] .mkd-t-num,:root[data-theme="dark"] .mkd-t-arg{color:#ff9f5a}
:root[data-theme="dark"] .mkd-t-bi{color:#ff7ab8}
/* reference panel */
.mkd-ref{width:0;overflow:hidden;border-left:.5px solid var(--line);background:var(--bg);transition:width .35s var(--ease,ease)}
.mkd-ref.show{width:330px}
.mkd-ref-in{width:330px;height:100%;overflow:auto;padding:14px 16px 24px}
.mkd-ref h5{margin:14px 0 8px}
.mkd-ref h5:first-child{margin-top:0}
.mkd-api{margin:0 0 9px}
.mkd-api code{display:block;font:12px/1.45 var(--mono,monospace);color:var(--text)}
.mkd-api span{display:block;font-size:12px;color:var(--text-2);line-height:1.4}
.mkd-note{font-size:12px;color:var(--text-2);line-height:1.45;padding:9px 11px;border-radius:9px;background:var(--accent-soft);margin:6px 0 10px}
.mkd-ex{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:8px 10px;border-radius:9px;border:.5px solid var(--line);background:var(--surface);margin:0 0 6px;font:12.5px var(--font,system-ui);color:var(--text);transition:border-color .15s,transform .15s var(--ease,ease),box-shadow .2s}
.mkd-ex:hover{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);transform:translateY(-1px)}
.mkd-ex svg.i{color:var(--accent);width:14px;height:14px}
/* small sheets */
.mkd-small{width:min(640px,94vw);max-height:min(520px,90vh)}
.mkd-small .mkd-content{padding:14px 16px;overflow:auto;flex:1;min-height:0}
.mkd-foot{display:flex;align-items:center;gap:8px;padding:10px 12px;border-top:.5px solid var(--line);background:var(--chrome)}
.mkd-mlist{display:grid;grid-template-columns:1fr 128px;gap:14px;min-height:280px}
.mkd-mrows{border:.5px solid var(--line);border-radius:10px;background:var(--surface);overflow:auto;max-height:340px;padding:4px}
.mkd-mrow{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;width:100%;text-align:left;background:none;border:0;font:13px var(--font,system-ui);color:var(--text);transition:background .12s}
.mkd-mrow:hover{background:var(--hover)}
.mkd-mrow.on{background:var(--accent);color:#fff}
.mkd-mrow.on .mkd-chip{background:rgba(255,255,255,.22);color:#fff}
.mkd-mrow.on small{color:rgba(255,255,255,.8)}
.mkd-mrow .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mkd-mrow small{color:var(--text-3);font-size:11px}
.mkd-mbtns{display:flex;flex-direction:column;gap:6px}
.mkd-mbtns .mkd-btn{justify-content:flex-start;border:.5px solid var(--line-2);background:var(--surface)}
.mkd-mbtns .mkd-btn.primary{border-color:var(--accent);background:var(--accent)}
.mkd-hint{font-size:12px;color:var(--text-2);line-height:1.45}
/* math macros */
.mkd-math{width:min(1080px,96vw);height:min(680px,92vh)}
.mkd-mhelp{display:flex;align-items:flex-start;gap:10px;padding:10px 12px 10px 16px;background:var(--accent-soft);border-bottom:.5px solid var(--line);font-size:12.5px;line-height:1.5;color:var(--text)}
.mkd-mhelp[hidden]{display:none}
.mkd-mhelp > div{flex:1}
.mkd-mhelp p{margin:0 0 4px}
.mkd-mhelp p:last-child{margin:0;color:var(--text-2)}
.mkd-mhelp code,.mkd-mcard code,.mkd-mempty code{font:11.5px var(--mono,monospace);background:var(--hover);padding:0 4px;border-radius:4px}
.mkd-math-body{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 400px;min-height:0}
.mkd-math-left{display:flex;flex-direction:column;min-height:0;border-right:.5px solid var(--line)}
.mkd-math-left .mkd-code{flex:1}
.mkd-math-foot{display:flex;align-items:center;gap:8px;padding:6px 12px;border-top:.5px solid var(--line);background:var(--bg)}
.mkd-mcount{font-size:11.5px;font-weight:600;color:var(--text-2)}
.mkd-mcount.bad{color:#d92d20}
.mkd-math-right{display:flex;flex-direction:column;min-height:0;background:var(--bg)}
.mkd-math-tabs{padding:10px 12px 6px;display:flex}
.mkd-math-tabs .mkd-seg{flex:1}
.mkd-math-tabs .mkd-seg button{flex:1}
.mkd-mprev,.mkd-mgal{flex:1;overflow:auto;padding:4px 12px 14px;min-height:0}
.mkd-mprev[hidden],.mkd-mgal[hidden]{display:none}
.mkd-mempty{padding:18px 8px;text-align:center;color:var(--text-2);font-size:12.5px;line-height:1.5}
.mkd-mempty p{margin:0 0 8px}
.mkd-mcard{padding:9px 11px;border-radius:10px;background:var(--surface);border:.5px solid var(--line);margin-bottom:7px;transition:border-color .15s,box-shadow .2s,transform .15s var(--ease,ease)}
.mkd-mcard[role=button]{cursor:pointer}
.mkd-mcard[role=button]:hover{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.mkd-mcard[role=button]:active{transform:scale(.99)}
.mkd-mcard.bad{border-color:rgba(255,59,48,.55);background:rgba(255,59,48,.05)}
.mkd-mcard.note.tail,.mkd-mcard.note.warn{border-color:rgba(255,159,10,.55);background:rgba(255,159,10,.06)}
.mkd-mcard-h{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.mkd-mbadge{font:600 10px var(--font,system-ui);padding:1px 6px;border-radius:4px;background:var(--hover);color:var(--text-2)}
.mkd-mbadge.bad{background:rgba(255,59,48,.14);color:#d92d20}
.mkd-mbadge.tail,.mkd-mbadge.warn{background:rgba(255,159,10,.16);color:#b26a00}
.mkd-mstate{font-size:11px;color:var(--text-3)}
.mkd-mstate.bad{color:#d92d20}
.mkd-mmsg{font-size:12.5px;line-height:1.45;color:var(--text)}
.mkd-mmsg.bad{color:#d92d20;margin-top:4px;font-size:12px}
.mkd-mline{display:block;margin-top:5px;white-space:pre-wrap;word-break:break-all}
.mkd-mtail{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px}
.mkd-mact{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.mkd-mact .mkd-btn{border:.5px solid var(--line-2);background:var(--surface);height:26px}
.mkd-mres{display:flex;align-items:center;gap:8px;min-height:24px}
.mkd-mres > code{font:600 12.5px var(--mono,monospace);background:none;padding:0;color:var(--accent)}
.mkd-marrow{color:var(--text-3)}
.mkd-mres .r,.mkd-mtail .r{font-size:16px}
.mkd-mtype{margin-top:3px;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mkd-gsearch{position:sticky;top:0;padding:0 0 8px;background:var(--bg);z-index:1}
.mkd-gcard{display:grid;grid-template-columns:96px minmax(0,1fr) auto;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;background:var(--surface);border:.5px solid var(--line);margin-bottom:7px;transition:border-color .15s,box-shadow .2s}
.mkd-gcard:hover{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.mkd-gres{font-size:15px;text-align:center;overflow:hidden;color:var(--text)}
.mkd-gtext{min-width:0;display:flex;flex-direction:column;gap:2px;font-size:12px;line-height:1.4}
.mkd-gname code{font:600 12.5px var(--mono,monospace);color:var(--accent);margin-right:6px}
.mkd-gname span{color:var(--text)}
.mkd-gtype{color:var(--text-2)}
.mkd-gtype code,.mkd-gdef{font:11px var(--mono,monospace);color:var(--text-2)}
.mkd-gdef{color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mkd-gcard .mkd-btn{min-width:62px;justify-content:center}
.mkd-gcard .mkd-btn.on{background:var(--accent-soft);color:var(--accent);opacity:1}
:root[data-theme="dark"] .mkd-mbadge.bad,:root[data-theme="dark"] .mkd-mcount.bad,:root[data-theme="dark"] .mkd-mmsg.bad{color:#ff6961}
:root[data-theme="dark"] .mkd-mbadge.tail,:root[data-theme="dark"] .mkd-mbadge.warn{color:#ffb340}
/* console panel */
.mkd-console{position:fixed;right:16px;bottom:40px;width:580px;height:340px;min-width:340px;min-height:180px;z-index:45;display:grid;grid-template-rows:auto 1fr auto;background:var(--chrome-solid);border-radius:12px;box-shadow:var(--pop-shadow);overflow:hidden;resize:both;font:13px var(--font,system-ui);color:var(--text);opacity:0;transform:translateY(10px) scale(.98);transition:opacity .2s,transform .3s var(--ease,ease)}
.mkd-console.show{opacity:1;transform:none}
.mkd-con-h{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 12px;border-bottom:.5px solid var(--line);cursor:grab;user-select:none}
.mkd-con-h b{font-size:12.5px;font-weight:600}
.mkd-con-h small{color:var(--text-3);font-size:11.5px}
.mkd-con-in{display:flex;align-items:flex-start;gap:6px;padding:6px 12px 8px;border-top:.5px solid var(--line);background:var(--surface)}
.mkd-con-in span{font:12.5px/20px var(--mono,monospace);color:var(--accent);flex:none;white-space:pre}
.mkd-con-in textarea{flex:1;border:0;outline:0;background:none;color:var(--text);font:12.5px/20px var(--mono,monospace);resize:none;height:20px;max-height:160px;padding:0;tab-size:4}
/* status pill */
.mkd-rec{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:5px;border:0;background:rgba(255,59,48,.12);color:#d92d20;font:600 11.5px var(--font,system-ui);transition:background .15s}
.mkd-rec:hover{background:rgba(255,59,48,.2)}
.mkd-rec i{width:8px;height:8px;border-radius:50%;background:#ff3b30;animation:mkdPulse 1.2s ease-in-out infinite}
.mkd-rec .mkd-rec-n{font-weight:500;opacity:.8;font-variant-numeric:tabular-nums}
.mkd-rec b{margin-left:2px;padding:0 6px;border-radius:4px;background:#ff3b30;color:#fff;font-weight:600}
@media (prefers-reduced-motion: reduce){.mkd-rec i{animation:none}}
:root[data-theme="dark"] .mkd-rec{color:#ff6961}
.mkd-form{display:grid;grid-template-columns:auto 1fr;gap:10px 12px;align-items:center;min-width:380px}
.mkd-form label{color:var(--text-2);font-size:12.5px}
.mkd-pre{margin:10px 0 0;max-height:180px;overflow:auto;font:12px/1.5 var(--mono,monospace);background:var(--bg);border:.5px solid var(--line);border-radius:9px;padding:10px 12px;white-space:pre}
.mkd-opt{display:flex;flex-direction:column;gap:12px;max-width:640px}
.mkd-opt-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.mkd-opt-row > span:first-child{min-width:220px;color:var(--text)}
`;
  function injectStyle() {
    if (document.getElementById('mkd-style')) return;
    const st = document.createElement('style'); st.id = 'mkd-style'; st.textContent = CSS;
    document.head.append(st);
  }
  injectStyle();
  onBody(injectIcons);

  // =====================================================================================
  // Small UI building blocks: segmented control, sheets
  // =====================================================================================
  function seg(options, value, onChange) {
    const el = h('div', { class: 'mkd-seg', role: 'radiogroup' });
    const thumb = h('span', { class: 'mkd-seg-thumb' }); el.append(thumb);
    const btns = options.map(o => {
      const b = h('button', { type: 'button', role: 'radio', 'data-v': o.value, title: o.title || null }, o.label);
      b.addEventListener('click', () => set(o.value, true)); el.append(b); return b;
    });
    function place() { const b = btns.find(x => x.classList.contains('on')); if (b && b.offsetWidth) { thumb.style.left = b.offsetLeft + 'px'; thumb.style.width = b.offsetWidth + 'px'; } }
    function set(v, user) {
      btns.forEach(b => { const on = b.dataset.v === v; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
      el.value = v; requestAnimationFrame(place); if (user) onChange?.(v);
    }
    el.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const i = btns.findIndex(b => b.dataset.v === el.value), n = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length];
      e.preventDefault(); set(n.dataset.v, true); n.focus();
    });
    try { new ResizeObserver(place).observe(el); } catch {}
    set(value); el.set = v => set(v); return el;
  }

  const openSheets = [];
  function openSheet({ cls = '', label = '', content, onKey, beforeClose, backdropCloses = false }) {
    const ov = h('div', { class: 'mkd-overlay', 'data-mk-keys': 'own' });
    const sheet = h('div', { class: 'mkd-sheet ' + cls, role: 'dialog', 'aria-modal': 'true', 'aria-label': label });
    sheet.append(content); ov.append(sheet); document.body.append(ov);
    const prev = document.activeElement;
    let closed = false;
    const api = {
      ov, sheet,
      async close(force) {
        if (closed) return true;
        if (!force && beforeClose && (await beforeClose()) === false) return false;
        closed = true; ov.classList.remove('show');
        openSheets.splice(openSheets.indexOf(api), 1);
        setTimeout(() => ov.remove(), 260);
        try { prev?.focus?.(); } catch {}
        return true;
      },
    };
    ov.addEventListener('mousedown', e => { if (backdropCloses && e.target === ov) api.close(); });
    ov.addEventListener('keydown', e => {
      onKey?.(e);
      if (!e.defaultPrevented && e.key === 'Escape') { e.preventDefault(); api.close(); }
      e.stopPropagation();
    });
    requestAnimationFrame(() => ov.classList.add('show'));
    openSheets.push(api);
    return api;
  }

  // =====================================================================================
  // LaTeX math macros
  // =====================================================================================
  // Lenient: several definitions per line, % comments, extra text after a definition becomes a note (not an error).
  // Returns {macros, errors:[{line, text, message}], notes:[{line, text, message, kind:'info'|'warn'|'tail', name?, from?, to?}],
  //          defs:[{name, line, kind, args, opt, body, source}]}
  const DEF_RE = /\\(newcommand|renewcommand|providecommand|DeclareRobustCommand|DeclareMathOperator|def|gdef|edef|xdef|let)(\*?)(?![A-Za-z@])/;
  const CS_NAME_RE = /^\\([A-Za-z@]+|[^A-Za-z@\s])$/;
  class DefError extends Error {}
  function parseMathDetailed(src) {
    const s = String(src || '').replace(/\r\n?/g, '\n');
    const macros = {}, errors = [], notes = [], defs = [], firstLine = {};
    let i = 0;
    const lineAt = p => { let n = 1; for (let k = 0; k < p && k < s.length; k++) if (s.charCodeAt(k) === 10) n++; return n; };
    const lineStart = p => s.lastIndexOf('\n', p - 1) + 1;
    const lineEnd = p => { const e = s.indexOf('\n', p); return e < 0 ? s.length : e; };
    const lineText = p => s.slice(lineStart(p), lineEnd(p)).trim();
    const short = t => { t = String(t).trim(); return t.length > 48 ? t.slice(0, 46) + '…' : t; };
    const skipSp = () => { while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++; };
    // spaces and %comments on this line; a line break only when the next line goes on with { or [
    const skipGap = () => {
      skipSp();
      if (s[i] === '%') while (i < s.length && s[i] !== '\n') i++;
      if (s[i] === '\n') { let j = i; while (j < s.length && /\s/.test(s[j])) j++; if (s[j] === '{' || s[j] === '[') i = j; }
    };
    const readGroup = () => {
      if (s[i] !== '{') return null; let depth = 0; const start = i + 1;
      for (let k = i; k < s.length; k++) {
        const c = s[k];
        if (c === '\\') { k++; continue; }
        if (c === '{') depth++;
        else if (c === '}' && --depth === 0) { i = k + 1; return s.slice(start, k); }
      }
      return undefined; // no closing brace
    };
    const readCs = () => { const m = /^\\([A-Za-z@]+|[^A-Za-z@\s])/.exec(s.slice(i)); if (!m) return null; i += m[0].length; return m[0]; };
    const readBracket = () => {
      if (s[i] !== '[') return null; let depth = 0;
      for (let k = i + 1; k < s.length && s[k] !== '\n'; k++) {
        if (s[k] === '\\') { k++; continue; }
        if (s[k] === '{') depth++; else if (s[k] === '}') depth--;
        else if (s[k] === ']' && depth === 0) { const v = s.slice(i + 1, k); i = k + 1; return v; }
      }
      return undefined;
    };
    const maxArg = body => Math.max(0, ...[...String(body).matchAll(/(?<!#)#([1-9])/g)].map(x => Number(x[1])));
    const fail = msg => { throw new DefError(msg); };
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    function define(name, body, info) {
      if (info.kind === 'providecommand' && name in macros) { notes.push({ line: info.line, text: info.source, kind: 'info', name, message: `${name} was already defined, so \\providecommand keeps the first definition.` }); return; }
      if (name in macros && firstLine[name] != null) notes.push({ line: info.line, text: info.source, kind: 'warn', name, message: `${name} is defined twice (lines ${firstLine[name]} and ${info.line}). The last one wins.` });
      else firstLine[name] = info.line;
      macros[name] = body;
      defs.push({ name, body, ...info });
    }
    while (i < s.length) {
      while (i < s.length && /\s/.test(s[i])) i++;
      if (i >= s.length) break;
      if (s[i] === '%') { i = lineEnd(i); continue; }
      const start = i, line = lineAt(i);
      const rest = s.slice(i, lineEnd(i));
      const m = DEF_RE.exec(rest);
      if (!m || m.index > 0) {
        // "\R: \mathbb{R}" or "\R = \mathbb{R}" (a short form some people use)
        const simple = /^(\\[A-Za-z]+)[ \t]*[:=][ \t]*(.+)$/.exec(rest.replace(/(^|[^\\])%.*$/, '$1').trim());
        if (simple && !m) { define(simple[1], simple[2].trim(), { line, kind: 'short', args: maxArg(simple[2]), opt: null, source: rest.trim() }); i = lineEnd(i); continue; }
        if (m) {
          const before = rest.slice(0, m.index);
          if (/\S/.test(before.replace(/[;,]/g, ''))) notes.push({ line, text: rest.trim(), kind: 'info', from: start, to: start + m.index, message: `The text before ${m[0]}, “${short(before)}”, is not part of a definition, so it was skipped.` });
          i = start + m.index; continue;
        }
        const t = rest.trim();
        const looksLikeUse = /\$|\\\(|^\\[A-Za-z]/.test(t);
        errors.push({ line, text: t, message: looksLikeUse
          ? 'Start a definition with \\newcommand, \\renewcommand, \\def or \\DeclareMathOperator, for example \\newcommand{\\R}{\\mathbb{R}}.'
          : `Write one definition per line, for example \\newcommand{\\R}{\\mathbb{R}}. “${short(t)}” is not a definition.` });
        i = lineEnd(i); continue;
      }
      i += m[0].length;
      const kind = m[1], star = m[2] === '*', cmd = '\\' + kind;
      let name = null;
      try {
        skipGap();
        // the name: {\R}, \R, or {R} (the backslash is added)
        if (s[i] === '{') {
          const g = readGroup();
          if (g === undefined) fail(`Add the closing brace } after the name in ${cmd}{…}.`);
          const raw = g.trim();
          if (!raw) fail(`${cmd} needs a name in braces, like ${cmd}{\\R}{…}.`);
          if (CS_NAME_RE.test(raw)) name = raw;
          else if (/^[A-Za-z]+$/.test(raw)) { name = '\\' + raw; notes.push({ line, text: lineText(start), kind: 'info', name, message: `Added the missing backslash: the macro is called ${name}.` }); }
          else fail(`“${short(raw)}” can’t be a macro name. Use a backslash and letters, like {\\R}.`);
        } else if (s[i] === '\\') name = readCs();
        else if (/[A-Za-z]/.test(s[i] || '')) fail(`Put the name in braces with a backslash, like ${cmd}{\\R}{…}.`);
        else fail(`${cmd} needs a name, like ${cmd}{\\R}{…}.`);
        skipGap();
        const info = { line, kind, opt: null, source: '' };
        if (kind === 'let') {
          if (s[i] === '=') { i++; skipSp(); }
          const target = s[i] === '{' ? readGroup() : readCs();
          if (!target) fail(`\\let${name} needs a command to copy, like \\let${name}\\alpha.`);
          info.source = s.slice(start, i).trim(); define(name, target, { ...info, args: 0 });
        } else if (kind === 'DeclareMathOperator') {
          if (s[i] !== '{') fail(`After ${name}, put the operator’s text in braces, like ${cmd}${star ? '*' : ''}{${name}}{${name.slice(1)}}.`);
          const body = readGroup();
          if (body === undefined) fail(`Add a closing brace } at the end of the text of ${name}.`);
          info.source = s.slice(start, i).trim();
          define(name, `\\operatorname${star ? '*' : ''}{${body.trim()}}`, { ...info, args: 0 });
        } else if (/^[gex]?def$/.test(kind)) {
          const p0 = i; while (i < s.length && s[i] !== '{' && s[i] !== '\n') i++;
          const params = s.slice(p0, i).replace(/\s+/g, '');
          if (s[i] !== '{') fail(`After \\${kind}${name}, put the definition in braces, like \\def${name}{\\mathbb{R}}.`);
          let n = 0;
          if (params) {
            if (!/^(#\d)+$/.test(params)) fail(`Use \\newcommand{${name}}[2]{…} instead: \\def with a pattern like ${short(params)} isn’t supported.`);
            const ds = params.match(/\d/g).map(Number);
            if (ds.some((d, k) => d !== k + 1)) fail(`Number the arguments of ${name} in order: #1#2#3.`);
            n = ds.length;
          }
          const body = readGroup();
          if (body === undefined) fail(`Add a closing brace } to the definition of ${name}: every { needs a matching }.`);
          const used = maxArg(body);
          if (used > n) notes.push({ line, text: lineText(start), kind: 'warn', name, message: `${name} uses #${used} but takes ${n ? plural(n, 'argument') : 'no arguments'}. Write \\def${name}${Array.from({ length: used }, (_, k) => '#' + (k + 1)).join('')}{…}.` });
          info.source = s.slice(start, i).trim();
          define(name, body.trim(), { ...info, args: Math.max(n, used) });
        } else {
          let n = 0, opt = null;
          if (s[i] === '[') {
            const a = readBracket();
            if (a === undefined) fail(`Add the closing ] after the [ that follows ${name}.`);
            if (!/^\s*\d\s*$/.test(a)) fail(`Use a number of arguments from 0 to 9, like [2]. Found [${short(a)}].`);
            n = Number(a.trim()); skipGap();
            if (s[i] === '[') {
              opt = readBracket();
              if (opt === undefined) fail(`Add the closing ] after the default value of ${name}[${n}].`);
              if (n < 1) fail(`${name} has a default value but no arguments. Write [1] before the default, like ${cmd}{${name}}[1][x]{…}.`);
              skipGap();
            }
          }
          if (s[i] !== '{') fail(`After ${name}${n ? `[${n}]` : ''}, put the definition in braces, like ${cmd}{${name}}{\\mathbb{R}}.`);
          const raw = readGroup();
          if (raw === undefined) fail(`Add a closing brace } to the definition of ${name}: every { needs a matching }.`);
          let body = raw.trim();
          const used = maxArg(body);
          if (used > n) notes.push({ line, text: lineText(start), kind: 'warn', name, message: `${name} uses #${used} but says it takes ${n ? plural(n, 'argument') : 'no arguments'}. Write [${used}] after the name.` });
          else if (n > used) notes.push({ line, text: lineText(start), kind: 'warn', name, message: `${name} says it takes ${plural(n, 'argument')} but uses ${used ? 'only #' + used : 'none of them'}.` });
          if (opt != null) {
            body = body.replace(/(?<!#)#1/g, () => opt).replace(/(?<!#)#([2-9])/g, (_, d) => '#' + (Number(d) - 1));
            notes.push({ line, text: lineText(start), kind: 'info', name, message: `${name} has an optional first argument. Markooj always uses its default, “${short(opt)}”.` });
          }
          info.source = s.slice(start, i).trim(); info.opt = opt;
          define(name, body, { ...info, args: Math.max(n, used) - (opt != null ? 1 : 0) });
        }
      } catch (e) {
        if (!(e instanceof DefError)) throw e;
        errors.push({ line, text: lineText(start), message: e.message, name });
        i = lineEnd(start); continue;
      }
      // what follows the definition on the same line: nothing, a comment, another definition, or extra text
      skipSp();
      while (s[i] === ';' || s[i] === ',') { i++; skipSp(); }
      if (i >= s.length || s[i] === '\n') continue;
      if (s[i] === '%') { i = lineEnd(i); continue; }
      const tail = s.slice(i, lineEnd(i));
      const nextDef = DEF_RE.exec(tail);
      if (nextDef && nextDef.index === 0) continue;
      let extra = nextDef ? tail.slice(0, nextDef.index) : tail;
      const pct = /(^|[^\\])%/.exec(extra); if (pct) extra = extra.slice(0, pct.index + pct[1].length);
      const from = i, to = i + extra.replace(/\s+$/, '').length;
      i = nextDef ? i + nextDef.index : lineEnd(i);
      if (!/[^\s;,.]/.test(extra)) continue;
      const last = defs[defs.length - 1]?.name || name;
      notes.push({ line, text: lineText(from), kind: 'tail', name: last, from, to, extra: extra.trim(),
        message: `${last} is defined. The text after it, ${short(extra)}, is not a definition — type it in your document to use the macro.` });
    }
    return { macros, errors, notes, defs };
  }
  const parseMath = src => parseMathDetailed(src).macros;

  function metaMacrosToText(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(String).join('\n');
    if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `\\newcommand{${k.startsWith('\\') ? k : '\\' + k}}{${val}}`).join('\n');
    return String(v);
  }
  let mathCache = { key: null, value: {} };
  function mathMacros() {
    const g = app.settings.get('mathMacros', '') || '';
    const d = app.docs?.active?.();
    const local = metaMacrosToText(d?.meta?.['math-macros'] ?? d?.meta?.mathMacros);
    const key = g + '\u0000' + local;
    if (mathCache.key !== key) mathCache = { key, value: { ...parseMath(g), ...parseMath(local) } };
    return { ...mathCache.value };
  }
  // the macros a given document uses (all-documents macros + its own front matter math-macros), for exports
  function mathMacrosFor(doc) {
    if (!doc || doc === app.docs?.active?.()) return mathMacros();
    let meta = doc.meta || {};
    try { meta = mk.frontMatter?.parse?.(doc.text || '').meta || meta; } catch {}
    return { ...parseMath(app.settings.get('mathMacros', '') || ''), ...parseMath(metaMacrosToText(meta['math-macros'] ?? meta.mathMacros)) };
  }
  // KaTeX macro map → \newcommand lines that Pandoc's latex_macros extension expands in every format
  function macrosToLatex(map) {
    return Object.entries(map || {}).filter(([k, v]) => /^\\[A-Za-z@]+$/.test(k) && typeof v === 'string').map(([k, v]) => {
      const n = Math.max(0, ...[...v.matchAll(/#(\d)/g)].map(x => +x[1]));
      return `\\newcommand{${k}}${n ? `[${n}]` : ''}{${v}}`;
    }).join('\n');
  }
  // Developer → Math macros reach DOCX, ODT, EPUB, LaTeX and every other Pandoc format (HTML/PDF use KaTeX directly)
  app.exporter?.addMarkdownTransform?.((md, ctx) => {
    if (/^(md|markdown|txt|html|pdf)$/.test(ctx?.format || '')) return md;
    const defs = macrosToLatex(mathMacrosFor(ctx?.doc));
    if (!defs) return md;
    let fm = ''; let body = md;
    const m = /^﻿?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(md);
    if (m) { fm = m[0]; body = md.slice(m[0].length); }
    return `${fm}${fm && !/\n$/.test(fm) ? '\n' : ''}\n${defs}\n\n${body.replace(/^\s*\n/, '')}`;
  });

  // =====================================================================================
  // Front matter helpers (prefer mk.frontMatter, fall back to a tiny implementation)
  // =====================================================================================
  const FM_RE = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
  function fmParse(text) {
    try { if (mk.frontMatter?.parse) return mk.frontMatter.parse(text); } catch {}
    const m = FM_RE.exec(text); const meta = {};
    if (m) for (const line of m[1].split(/\r?\n/)) { const kv = /^([\w-]+):\s*(.*)$/.exec(line); if (kv) { let v = kv[2].trim(); try { if (/^[[{"]|^(true|false|null|-?\d+(\.\d+)?)$/.test(v)) v = JSON.parse(v); } catch {} meta[kv[1]] = v; } }
    return { meta, body: m ? text.slice(m[0].length) : text, raw: m ? m[1] : '' };
  }
  function yamlValue(v, indent = '') {
    if (v == null) return 'null';
    if (typeof v === 'string') {
      if (v.includes('\n')) return '|\n' + v.split('\n').map(l => indent + '  ' + l).join('\n');
      return /^[\w .,/()&+-]+$/.test(v) && !/^(true|false|null|yes|no|-?\d)/i.test(v) && v.trim() === v ? v : JSON.stringify(v);
    }
    return JSON.stringify(v);
  }
  function fmWrite(text, meta) {
    try { if (mk.frontMatter?.write) return mk.frontMatter.write(text, meta); } catch {}
    const body = fmParse(text).body;
    const keys = Object.keys(meta).filter(k => meta[k] !== undefined);
    if (!keys.length) return body;
    return '---\n' + keys.map(k => `${k}: ${yamlValue(meta[k])}`).join('\n') + '\n---\n' + body.replace(/^\r?\n/, '');
  }

  // =====================================================================================
  // The macro API (same shape in Python and JavaScript)
  // =====================================================================================
  let currentRun = null;
  function checkStop() { if (currentRun?.stopped) throw new Error('Stopped'); }
  function activeDoc() { checkStop(); const d = app.docs.active(); if (!d) throw new Error('Open or create a document first, then run the macro again.'); return d; }
  function editableDoc() {
    const d = activeDoc();
    if (d.kind !== 'markdown' || d.readOnly) throw new Error(`“${d.title}” is read-only. Use “Edit as text” to get an editable copy first.`);
    return d;
  }
  function selection(d) {
    let s = null;
    try { s = app.editors?.active?.()?.getSelection?.(); } catch {}
    s = s || { text: '', start: null, end: null };
    const len = d.text.length;
    const okRange = Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= 0 && s.end <= len && s.start <= s.end;
    return { text: String(s.text || ''), start: okRange ? s.start : null, end: okRange ? s.end : null };
  }
  function setText(d, t) { d.setText(String(t), 'macro'); }
  function normOpts(o) {
    if (!o) return {};
    try { if (typeof o.toJs === 'function') o = o.toJs({ dict_converter: Object.fromEntries }); } catch {}
    if (o instanceof Map) o = Object.fromEntries(o);
    return typeof o === 'object' ? o : {};
  }
  const reEsc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function buildRe(query, o, global = true) {
    const flags = (global ? 'g' : '') + (o.case === false ? 'i' : '') + (o.regex ? 'm' : '');
    return new RegExp(o.regex ? String(query) : reEsc(query), flags);
  }
  function docInfo(d) { return d ? { id: d.id, title: d.title, path: d.path || '', kind: d.kind, dirty: !!d.dirty, active: app.docs.active() === d } : null; }
  function fmtArg(a) {
    if (typeof a === 'string') return a;
    if (a instanceof Error) return a.message;
    try { return typeof a === 'object' ? JSON.stringify(a, null, 1) : String(a); } catch { return String(a); }
  }
  function emitOut(kind, text, line) { (currentRun?.sink || backgroundSink)(kind, String(text), line); }

  const doc = {
    get text() { return activeDoc().text; },
    set text(v) { setText(editableDoc(), v ?? ''); },
    get title() { return activeDoc().title; },
    get path() { return activeDoc().path || ''; },
    get id() { return activeDoc().id; },
    get kind() { return activeDoc().kind; },
    get dirty() { return !!activeDoc().dirty; },
    get meta() { return JSON.parse(JSON.stringify(fmParse(activeDoc().text).meta || {})); },
    set_meta(key, value) {
      const d = editableDoc(); const meta = { ...(fmParse(d.text).meta || {}) };
      try { if (value && typeof value.toJs === 'function') value = value.toJs({ dict_converter: Object.fromEntries }); } catch {}
      if (value === undefined || value === null) delete meta[key]; else meta[key] = value;
      setText(d, fmWrite(d.text, meta));
    },
    get selection() { const d = activeDoc(); return selection(d).text; },
    insert(text) {
      const d = editableDoc(); text = String(text ?? ''); const t = d.text;
      let pos = t.length;
      const run = currentRun;
      if (run?.cursor && run.cursor.docId === d.id && run.cursor.snapshot === t) pos = run.cursor.pos;
      else { const s = selection(d); if (s.end != null) pos = s.end; }
      const next = t.slice(0, pos) + text + t.slice(pos);
      setText(d, next);
      if (run) run.cursor = { docId: d.id, pos: pos + text.length, snapshot: d.text };
      return pos;
    },
    replace_selection(text) {
      const d = editableDoc(); text = String(text ?? ''); const s = selection(d);
      if (s.start != null && s.end != null) {
        const t = d.text; setText(d, t.slice(0, s.start) + text + t.slice(s.end));
        if (currentRun) currentRun.cursor = { docId: d.id, pos: s.start + text.length, snapshot: d.text };
        return true;
      }
      const ed = app.editors?.active?.();
      if (ed?.replaceSelection) { ed.replaceSelection(text); return true; }
      throw new Error('Click in the document and try again. Markooj couldn’t find the selection.');
    },
    replace(find, repl, opts) {
      const d = editableDoc(); const o = { all: true, case: true, regex: false, ...normOpts(opts) };
      if (find == null || find === '') return 0;
      const t = d.text; const re = buildRe(find, o, true);
      const n = [...t.matchAll(re)].length; if (!n) return 0;
      let out;
      if (o.all) out = o.regex ? t.replace(re, String(repl ?? '')) : t.replace(re, () => String(repl ?? ''));
      else { const one = buildRe(find, o, false); out = o.regex ? t.replace(one, String(repl ?? '')) : t.replace(one, () => String(repl ?? '')); }
      if (out !== t) setText(d, out);
      return o.all ? n : 1;
    },
    find(query, opts) {
      const d = activeDoc(); const o = { case: true, regex: false, ...normOpts(opts) };
      if (query == null || query === '') return [];
      const t = d.text, starts = [0];
      for (let k = 0; k < t.length; k++) if (t.charCodeAt(k) === 10) starts.push(k + 1);
      const out = [];
      for (const m of t.matchAll(buildRe(query, o, true))) {
        let lo = 0, hi = starts.length - 1;
        while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= m.index) lo = mid; else hi = mid - 1; }
        out.push({ line: lo + 1, column: m.index - starts[lo] + 1, text: m[0], index: m.index });
        if (out.length >= 10000) break;
      }
      return out;
    },
    lines() { return activeDoc().text.split(/\r?\n/); },
    save() { return app.docs.save(activeDoc()); },
  };
  doc.setMeta = doc.set_meta; doc.replaceSelection = doc.replace_selection;

  const docs = {
    list() { return app.docs.list().map(docInfo); },
    active() { return docInfo(app.docs.active()); },
    async open(path) { checkStop(); return docInfo(await app.docs.open(String(path))); },
    new(text) { checkStop(); const d = app.docs.create({}); if (text) d.setText(String(text), 'macro'); return docInfo(d); },
    activate(id) { app.docs.activate(id); return docInfo(app.docs.get(id)); },
  };
  const ui = {
    alert(msg) { checkStop(); return app.ui.dialog({ title: 'Macro', body: esc(fmtArg(msg)).replace(/\n/g, '<br>'), buttons: [{ label: 'OK', value: true, primary: true }] }).then(() => undefined); },
    confirm(msg) { checkStop(); return Promise.resolve(app.ui.confirm('Macro', fmtArg(msg))).then(Boolean); },
    prompt(msg, def) { checkStop(); return Promise.resolve(app.ui.prompt('Macro', fmtArg(msg), def == null ? '' : String(def))).then(v => v == null ? undefined : String(v)); },
    toast(msg) { toast(fmtArg(msg)); },
  };
  function run(id, args) { checkStop(); try { if (args && typeof args.toJs === 'function') args = args.toJs({ dict_converter: Object.fromEntries }); } catch {} return app.commands.run(String(id), args); }
  function commands() { return app.commands.list().map(c => ({ id: c.id, label: c.label || c.id, shortcut: c.shortcut || '' })); }
  function print(...a) { emitOut('out', a.map(fmtArg).join(' ')); }
  const api = { doc, docs, ui, run, commands, print, app };

  // =====================================================================================
  // Output sinks
  // =====================================================================================
  let bgBuffer = [];
  function backgroundSink(kind, text, line) {
    bgBuffer.push([kind, text, line]);
    if (kind === 'err' || kind === 'out') {
      pyConsole.open(false);
      for (const [k, t, l] of bgBuffer) pyConsole.append(k, t, l);
      bgBuffer = [];
    }
  }

  // =====================================================================================
  // JavaScript runner
  // =====================================================================================
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const JS_PARAMS = ['doc', 'docs', 'ui', 'run', 'commands', 'print', 'app', 'console', 'markooj'];
  let jsLineOffset = null;
  async function measureJsOffset() {
    if (jsLineOffset != null) return jsLineOffset;
    try { await new AsyncFunction(...JS_PARAMS, 'throw new Error("probe")')(); }
    catch (e) { const m = /<anonymous>:(\d+):\d+/.exec(e.stack || ''); jsLineOffset = m ? Number(m[1]) - 1 : 2; }
    return jsLineOffset;
  }
  async function runJs(code, runCtx) {
    const off = await measureJsOffset();
    let fn;
    try { fn = new AsyncFunction(...JS_PARAMS, String(code)); }
    catch (e) { const err = new Error(`${e.name}: ${e.message}`); err.mkLine = null; throw err; }
    const con = {
      log: (...a) => runCtx.sink('out', a.map(fmtArg).join(' ')), info: (...a) => runCtx.sink('out', a.map(fmtArg).join(' ')),
      warn: (...a) => runCtx.sink('err', a.map(fmtArg).join(' ')), error: (...a) => runCtx.sink('err', a.map(fmtArg).join(' ')),
    };
    try { return await fn(doc, docs, ui, run, commands, print, app, con, api); }
    catch (e) {
      const m = /<anonymous>:(\d+):(\d+)/.exec((e && e.stack) || '');
      const err = new Error(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      err.mkLine = m ? Number(m[1]) - off : null;
      throw err;
    }
  }

  // =====================================================================================
  // Python runtime (Pyodide, lazily loaded, runs on the main thread)
  // =====================================================================================
  const PY_MODULE = String.raw`"""Markooj macro API. In Markooj: Developer > Macro Editor > API reference."""
import sys as _sys
import time as _time
import js as _jsg
import _markooj_js as _js
from pyodide.ffi import to_js as _to_js, JsProxy as _JsProxy
try:
    from pyodide.ffi import run_sync as _run_sync, can_run_sync as _can_run_sync
except ImportError:
    _run_sync = None
    def _can_run_sync():
        return False

__all__ = ["doc", "docs", "ui", "run", "commands", "app"]
app = _js.app


def _none(v):
    if v is None or type(v).__name__ in ("JsNull", "JsUndefined"):
        return None
    return v


def _py(v):
    v = _none(v)
    if isinstance(v, _JsProxy):
        try:
            return v.to_py()
        except Exception:
            return v
    return v


def _tojs(v):
    if v is None:
        return None
    if isinstance(v, (dict, list, tuple)):
        return _to_js(v, dict_converter=_jsg.Object.fromEntries)
    return v


def _wait(p):
    if _run_sync is not None and _can_run_sync():
        return _py(_run_sync(p))
    return p


class _Doc:
    """The active document."""

    @property
    def text(self):
        return str(_js.doc.text)

    @text.setter
    def text(self, value):
        _js.doc.text = str(value)

    @property
    def title(self):
        return str(_js.doc.title)

    @property
    def path(self):
        return str(_js.doc.path or "")

    @property
    def meta(self):
        return _py(_js.doc.meta) or {}

    def set_meta(self, key, value):
        _js.doc.set_meta(str(key), _tojs(value))

    @property
    def selection(self):
        return str(_js.doc.selection)

    def insert(self, text):
        _js.doc.insert(str(text))

    def replace_selection(self, text):
        _js.doc.replace_selection(str(text))

    def replace(self, find, replace, regex=False, all=True, case=True):
        """Replace text; returns how many places changed. regex uses JavaScript syntax."""
        return int(_js.doc.replace(str(find), str(replace), _tojs({"regex": bool(regex), "all": bool(all), "case": bool(case)})))

    def find(self, query, regex=False, case=True):
        return _py(_js.doc.find(str(query), _tojs({"regex": bool(regex), "case": bool(case)}))) or []

    def lines(self):
        return self.text.splitlines()

    def save(self):
        return _wait(_js.doc.save())

    def __repr__(self):
        return "<Markooj document %r>" % self.title


class _Docs:
    def list(self):
        return _py(_js.docs.list()) or []

    def active(self):
        return _py(_js.docs.active())

    def open(self, path):
        return _wait(_js.docs.open(str(path)))

    def new(self, text=""):
        return _py(_js.docs.new(str(text)))

    def activate(self, id):
        return _py(_js.docs.activate(id))


class _UI:
    def toast(self, message):
        _js.ui.toast(str(message))

    def alert(self, message):
        r = _wait(_js.ui.alert(str(message)))
        return None if isinstance(r, _JsProxy) else r

    def confirm(self, message):
        r = _wait(_js.ui.confirm(str(message)))
        if isinstance(r, _JsProxy):
            raise RuntimeError("ui.confirm cannot wait here. Use: ok = await ui.confirm_async('...')")
        return bool(r)

    def prompt(self, message, default=""):
        r = _wait(_js.ui.prompt(str(message), str(default)))
        if isinstance(r, _JsProxy):
            raise RuntimeError("ui.prompt cannot wait here. Use: answer = await ui.prompt_async('...')")
        return None if r is None else str(r)

    async def prompt_async(self, message, default=""):
        r = _none(await _js.ui.prompt(str(message), str(default)))
        return None if r is None else str(r)

    async def confirm_async(self, message):
        return bool(await _js.ui.confirm(str(message)))

    async def alert_async(self, message):
        await _js.ui.alert(str(message))


doc = _Doc()
docs = _Docs()
ui = _UI()


class _Ran:
    """What run() gives back when the command already finished. "await run(...)" works either way."""
    __slots__ = ("value",)

    def __init__(self, value):
        self.value = value

    def __await__(self):
        return self.value
        yield

    def __repr__(self):
        return repr(self.value)

    def __bool__(self):
        return bool(self.value)


def run(command, args=None):
    """Run any Markooj command, e.g. await run("format.bold")."""
    r = _wait(_js.run(str(command), _tojs(args)))
    return r if isinstance(r, _JsProxy) else _Ran(r)


def commands():
    return _py(_js.commands()) or []


class MacroStopped(Exception):
    """Raised when a macro is stopped (Stop button or time limit)."""


def _guard_start(limit):
    start = _time.monotonic()
    count = [0]
    stop = _js.should_stop

    def tracer(frame, event, arg):
        count[0] += 1
        if count[0] >= 4000:
            count[0] = 0
            if stop():
                raise MacroStopped("Stopped.")
            if limit and _time.monotonic() - start > limit:
                raise MacroStopped("Stopped: the macro ran longer than %d seconds." % limit)
        return tracer

    _sys.settrace(tracer)


def _guard_stop():
    _sys.settrace(None)
`;

  const py = { inst: null, loading: null, consoleNs: null, version: '' };
  const pyStatus = new Set();
  function setPyState(s) { py.state = s; pyStatus.forEach(fn => { try { fn(s); } catch {} }); }
  function pyBase() { return new URL('../node_modules/pyodide/', document.baseURI).href; }

  function loadPython() {
    if (py.inst) return Promise.resolve(py.inst);
    if (py.loading) return py.loading;
    setPyState('loading');
    toast('Starting Python…');
    py.loading = (async () => {
      const base = pyBase();
      let mod;
      // Python ships inside Markooj (node_modules/pyodide): a missing file means an incomplete copy, anything else is worth a retry
      try { mod = await import(base + 'pyodide.mjs'); } catch (e) { throw Object.assign(new Error(String(e && e.message || e)), { pyMissing: true }); }
      const loader = mod.loadPyodide || window.loadPyodide;
      if (!loader) throw Object.assign(new Error('pyodide.mjs has no loadPyodide'), { pyMissing: true });
      const p = await loader({ indexURL: base, stdout: s => emitOut('out', s), stderr: s => emitOut('err', s) });
      try { p.setStdout({ batched: s => emitOut('out', s) }); p.setStderr({ batched: s => emitOut('err', s) }); } catch {}
      p.registerJsModule('_markooj_js', { ...api, should_stop: () => !!currentRun?.stopped });
      p.globals.set('_mk_src', PY_MODULE);
      p.runPython("import sys as _s, types as _t\n_m = _t.ModuleType('markooj')\n_m.__file__ = 'markooj.py'\nexec(compile(_mk_src, 'markooj.py', 'exec'), _m.__dict__)\n_s.modules['markooj'] = _m\ndel _s, _t, _m, _mk_src");
      try { py.version = p.runPython('import sys; sys.version.split()[0]'); } catch {}
      // Stop + time limit: a light line tracer (markooj._guard_start) raises MacroStopped. Pyodide's
      // interrupt buffer is not used: it raises KeyboardInterrupt, which escapes the asyncio loop
      // behind runPythonAsync, and on the main thread nothing could set the buffer anyway.
      py.inst = p; setPyState('ready');
      return p;
    })().catch(e => {
      py.loading = null; setPyState('error');
      const err = new Error(e && e.pyMissing
        ? 'Install Markooj again to run Python macros: this copy is missing its Python files. JavaScript macros still work.'
        : 'Try running it again. Python didn’t start this time; if it keeps failing, restart Markooj. JavaScript macros still work.');
      err.details = String(e && (e.stack || e.message) || e); err.pyStart = true; err.mkLine = null;
      throw err;
    });
    return py.loading;
  }

  function cleanPyError(e) {
    const msg = String((e && e.message) || e);
    const lastLine = msg.trim().split('\n').pop() || '';
    const stopped = /^(?:markooj\.)?MacroStopped: (.*)$/.exec(lastLine);
    if (stopped || /^KeyboardInterrupt/.test(lastLine)) { const err = new Error(stopped ? stopped[1] : 'Stopped.'); err.mkLine = null; return err; }
    const lines = msg.split('\n'); const out = []; let skip = false, lineNo = null;
    for (const l of lines) {
      const f = /^\s*File "([^"]+)", line (\d+)/.exec(l);
      if (f) { skip = /_pyodide|\/lib\/python|pyodide\/|markooj\.py/.test(f[1]); if (!skip && /macro\.py|<console>|<exec>/.test(f[1])) lineNo = Number(f[2]); if (skip) continue; }
      else if (/^\S/.test(l)) skip = false;
      if (!skip) out.push(l);
    }
    const text = out.join('\n').replace(/^Traceback \(most recent call last\):\n(?=\S)/, '').trim();
    const err = new Error(text || msg); err.mkLine = lineNo; return err;
  }
  function timeLimit() { const v = Number(app.settings.get('macroTimeLimit', 60)); return Number.isFinite(v) && v >= 0 ? v : 60; }

  async function runPy(code, runCtx, { globals, filename = 'macro.py', echoResult = false } = {}) {
    const p = await loadPython();
    if (runCtx.stopped) throw new Error('Stopped.');
    let ns = globals, own = false;
    if (!ns) { ns = p.toPy({}); own = true; ns.set('__name__', '__main__'); p.runPython('from markooj import *', { globals: ns }); }
    const limit = timeLimit();
    let guard = false;
    try { p.runPython(`import markooj; markooj._guard_start(${limit || 0})`); guard = true; } catch {}
    try {
      const r = await p.runPythonAsync(String(code), { globals: ns, filename });
      if (echoResult && r !== undefined) {
        const reprFn = p.runPython('repr');
        try { runCtx.sink('ret', reprFn(r)); } finally { reprFn.destroy?.(); }
      }
      if (r && typeof r.destroy === 'function') r.destroy();
      return undefined;
    } catch (e) {
      throw cleanPyError(e);
    } finally {
      if (guard) { try { p.runPython('import markooj; markooj._guard_stop()'); } catch {} }
      if (own) { try { ns.destroy(); } catch {} }
    }
  }

  // =====================================================================================
  // Running macros (one at a time, Stop support)
  // =====================================================================================
  let queue = Promise.resolve(), runSeq = 0;
  const runListeners = new Set();
  function notifyRun() { runListeners.forEach(fn => { try { fn(currentRun); } catch {} }); }

  function runMacro(m, opts = {}) {
    const lang = (m.lang || 'python').toLowerCase().startsWith('py') ? 'python' : 'js';
    const sink = opts.sink || backgroundSink;
    const ctx = { id: ++runSeq, lang, name: m.name || '', stopped: false, timedOut: false, sink, cursor: null, done: false };
    let abandon;
    const abandoned = new Promise((_, rej) => { abandon = rej; });
    ctx.abandon = () => abandon(Object.assign(new Error('Stopped.'), { mkLine: null }));
    const job = async () => {
      currentRun = ctx; notifyRun();
      try {
        const exec = lang === 'python' ? runPy(m.code, ctx, opts.py || {}) : runJs(m.code, ctx);
        exec.catch(() => {});
        const value = await Promise.race([exec, abandoned]);
        return { ok: true, value };
      } catch (e) {
        const message = (e && e.message) || String(e);
        sink('err', message, e && e.mkLine);
        return { ok: false, error: message, line: (e && e.mkLine) || null, pyStart: !!(e && e.pyStart), details: e && e.details };
      } finally {
        ctx.done = true; if (currentRun === ctx) currentRun = null; notifyRun();
      }
    };
    const p = queue.then(job, job); queue = p.catch(() => {});
    return p;
  }
  function stopMacro() {
    const ctx = currentRun; if (!ctx) return false;
    ctx.stopped = true;
    setTimeout(() => {
      if (!ctx.done) {
        ctx.abandon();
        if (ctx.lang === 'python') { py.inst = null; py.loading = null; py.consoleNs = null; setPyState('idle'); }
      }
    }, 1500);
    return true;
  }

  // =====================================================================================
  // Saved macros store
  // =====================================================================================
  const LS_KEY = 'markooj-macros';
  const NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9 _-]{0,47}$/;
  const normMacro = m => ({ name: String(m.name || '').trim(), lang: String(m.lang || 'python').toLowerCase().startsWith('py') ? 'python' : 'js', code: String(m.code || ''), shortcut: m.shortcut || '', ribbon: !!m.ribbon });
  const store = {
    list: [],
    loaded: false,
    async load() {
      try { const r = await mk.invoke('macros-list'); store.list = (Array.isArray(r) ? r : []).map(normMacro).filter(m => m.name); store.local = false; }
      catch { store.local = true; try { store.list = JSON.parse(localStorage.getItem(LS_KEY) || '[]').map(normMacro); } catch { store.list = []; } }
      store.list.sort((a, b) => a.name.localeCompare(b.name));
      store.loaded = true; afterChange();
      return store.list;
    },
    get(name) { return store.list.find(m => m.name.toLowerCase() === String(name).toLowerCase()); },
    async save(m) {
      m = normMacro(m);
      if (!NAME_RE.test(m.name)) throw new Error('Use letters, numbers, spaces, - or _ for the macro name (up to 48 characters).');
      if (!store.local) { try { await mk.invoke('macros-save', m); } catch (e) { if (/No handler/i.test(e.message)) store.local = true; else throw e; } }
      store.list = store.list.filter(x => x.name.toLowerCase() !== m.name.toLowerCase()).concat(m).sort((a, b) => a.name.localeCompare(b.name));
      if (store.local) try { localStorage.setItem(LS_KEY, JSON.stringify(store.list)); } catch {}
      afterChange(); return m;
    },
    async remove(name) {
      if (!store.local) { try { await mk.invoke('macros-delete', name); } catch (e) { if (/No handler/i.test(e.message)) store.local = true; else throw e; } }
      store.list = store.list.filter(x => x.name.toLowerCase() !== String(name).toLowerCase());
      if (store.local) try { localStorage.setItem(LS_KEY, JSON.stringify(store.list)); } catch {}
      afterChange();
    },
  };
  const registeredMacroCmds = new Set();
  function afterChange() {
    const now = new Set();
    for (const m of store.list) {
      const id = 'macro.' + m.name; now.add(id);
      app.commands.register(id, { label: 'Macro: ' + m.name, icon: 'dev-run', shortcut: m.shortcut || undefined, macro: true, run: () => runSaved(m.name) });
    }
    for (const id of registeredMacroCmds) if (!now.has(id)) {
      if (typeof app.commands.unregister === 'function') app.commands.unregister(id);
      else app.commands.register(id, { label: id, hidden: true, shortcut: undefined, isEnabled: () => false, run() {} });
    }
    registeredMacroCmds.clear(); now.forEach(id => registeredMacroCmds.add(id));
    const onRibbon = store.list.filter(m => m.ribbon);
    if (onRibbon.length) app.ribbon.addGroup('developer', { id: 'dev-mymacros', label: 'My macros', order: 90, items: onRibbon.map(m => ({ type: 'big', command: 'macro.' + m.name, label: m.name, icon: m.lang === 'python' ? 'dev-python' : 'dev-run' })) });
    else app.ribbon.removeGroup?.('developer', 'dev-mymacros');
    app.events.emit('macros:changed', store.list);
  }
  async function runSaved(name) {
    const m = store.get(name);
    if (!m) { toast(`Pick a macro from Developer → Macros (Alt+F8). “${name}” isn’t saved on this computer.`, { kind: 'warn', actions: [{ label: 'Open Macros', run: () => openMacrosDialog() }] }); return; }
    const r = await runMacro(m);
    if (!r.ok && !/^Stopped\.?$/i.test(String(r.error).trim())) {
      const actions = [{ label: 'Try again', run: () => runSaved(name) }];
      if (r.pyStart) toast(r.error, { kind: 'error', actions, details: r.details });
      else {
        const last = String(r.error).trim().split('\n').pop();
        actions.push({ label: 'Edit macro', run: () => openEditor(m.name) });
        toast(`Open “${m.name}” in the Macro Editor to fix ${r.line ? 'line ' + r.line : 'it'}, then run it again. ${m.lang === 'python' ? 'Python' : 'JavaScript'} says: ${last}`, { kind: 'error', actions, details: r.error });
      }
    }
    return r;
  }

  // =====================================================================================
  // Macro recorder
  // =====================================================================================
  const rec = { on: false, steps: [], snap: new Map(), started: 0 };
  let cmdDepth = 0;
  (function wrapCommands() {
    const orig = app.commands.run;
    if (orig.__mkWrapped) return;
    const wrapped = async function (id, args) { cmdDepth++; try { return await orig.call(app.commands, id, args); } finally { cmdDepth--; } };
    wrapped.__mkWrapped = true; app.commands.run = wrapped;
  })();
  function safeArgs(a) {
    if (a === undefined) return undefined;
    try { const j = JSON.stringify(a); if (j === undefined || j.length > 20000) return undefined; return JSON.parse(j); } catch { return undefined; }
  }
  app.events.on('command:ran', ({ id, args } = {}) => {
    if (!rec.on || !id || cmdDepth > 1) return;
    if (/^(dev\.|macro\.|file\.|view\.|palette|app\.|addins?\.)/.test(id)) return;
    rec.steps.push({ kind: 'cmd', id, args: safeArgs(args) });
    // the Word editor commits what a command did a moment later; take it in now, so it is not recorded as typing
    try { app.editors?.active?.()?.flush?.(); } catch {}
    const d = app.docs.active(); if (d) rec.snap.set(d.id, d.text);
    paintRecStatus();
  });
  app.events.on('doc:active', d => { if (d) rec.snap.set(d.id, d.text); });
  app.events.on('doc:changed', ({ doc: d, origin } = {}) => {
    if (!d) return;
    const prev = rec.snap.get(d.id); rec.snap.set(d.id, d.text);
    if (!rec.on || cmdDepth > 0 || origin === 'macro' || prev == null) return;
    const a = prev, b = d.text; let p = 0; const max = Math.min(a.length, b.length);
    while (p < max && a.charCodeAt(p) === b.charCodeAt(p)) p++;
    let s = 0; while (s < max - p && a.charCodeAt(a.length - 1 - s) === b.charCodeAt(b.length - 1 - s)) s++;
    const removed = a.slice(p, a.length - s), added = b.slice(p, b.length - s);
    const last = rec.steps[rec.steps.length - 1];
    if (!removed && added) {
      if (last?.kind === 'type' && last.end === p) { last.text += added; last.end += added.length; }
      else rec.steps.push({ kind: 'type', text: added, start: p, end: p + added.length });
    } else if (removed && !added) {
      if (last?.kind === 'type' && a.length - s === last.end && p >= last.start) { last.text = last.text.slice(0, p - last.start); last.end = p; if (!last.text) rec.steps.pop(); }
      else if (last?.kind !== 'note') rec.steps.push({ kind: 'note', text: 'Text was deleted here (deleting is not recorded).' });
    } else if (removed && added && last?.kind !== 'note') rec.steps.push({ kind: 'note', text: 'Text was changed here (only typing and commands are recorded).' });
    paintRecStatus();
  });

  function pyLit(v) {
    if (v === null || v === undefined) return 'None';
    if (v === true) return 'True'; if (v === false) return 'False';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'None';
    if (typeof v === 'string') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(pyLit).join(', ') + ']';
    return '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + pyLit(x)).join(', ') + '}';
  }
  function buildRecorded(steps, lang) {
    const when = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const L = [];
    if (lang === 'python') {
      L.push(`# Recorded on ${when}`, 'from markooj import doc, run', '');
      for (const st of steps) {
        if (st.kind === 'cmd') L.push(`await run(${JSON.stringify(st.id)}${st.args !== undefined ? ', ' + pyLit(st.args) : ''})`);
        else if (st.kind === 'type') L.push(`doc.insert(${JSON.stringify(st.text)})`);
        else L.push(`# ${st.text}`);
      }
    } else {
      L.push(`// Recorded on ${when}`, '');
      for (const st of steps) {
        if (st.kind === 'cmd') L.push(`await run(${JSON.stringify(st.id)}${st.args !== undefined ? ', ' + JSON.stringify(st.args) : ''});`);
        else if (st.kind === 'type') L.push(`doc.insert(${JSON.stringify(st.text)});`);
        else L.push(`// ${st.text}`);
      }
    }
    return L.join('\n') + '\n';
  }
  function nextMacroName(base = 'Macro') { let n = 1; while (store.get(base + n)) n++; return base + n; }
  // Recording state shows in three places: the ribbon button (Record ↔ Stop recording), the status bar pill
  // (red dot, steps, time, Stop) and body.mk-recording.
  let recTimer = 0, recStatusEl = null;
  function paintRecStatus() {
    const n = recStatusEl?.querySelector?.('.mkd-rec-n'); if (!n || !rec.on) return;
    const steps = rec.steps.filter(s => s.kind !== 'note').length;
    const sec = Math.floor((Date.now() - rec.started) / 1000);
    n.textContent = `${steps} step${steps === 1 ? '' : 's'} · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }
  function recChanged() {
    document.body?.classList.toggle('mk-recording', rec.on);
    addCodeGroup();
    clearInterval(recTimer); recTimer = rec.on ? setInterval(paintRecStatus, 1000) : 0;
    app.status.refresh?.(); app.events.emit('ribbon:changed'); app.events.emit('status:changed');
    app.events.emit('recorder:changed', { active: rec.on });
  }
  function startRecording() {
    if (rec.on) return;
    rec.on = true; rec.steps = []; rec.started = Date.now();
    try { app.editors?.active?.()?.flush?.(); } catch {}
    const d = app.docs.active(); if (d) rec.snap.set(d.id, d.text);
    recChanged();
    toast('Recording started. Use the ribbon and type as usual. Click Stop in the status bar when you are done.');
  }
  async function stopRecording({ ask = true, save = true, name, lang } = {}) {
    if (!rec.on) return null;
    try { app.editors?.active?.()?.flush?.(); } catch {}
    rec.on = false; const steps = rec.steps.slice(); rec.steps = [];
    recChanged();
    if (!steps.some(s => s.kind !== 'note')) { if (ask) toast('To record a macro, click Record, then use ribbon buttons or type. This recording had no steps, so it was not saved.'); return null; }
    lang = lang || app.settings.get('macroLang', 'python');
    let m = { name: name || nextMacroName(), lang, code: buildRecorded(steps, lang), shortcut: '', ribbon: false };
    if (ask) {
      const nameIn = h('input', { class: 'mkd-input', value: m.name, spellcheck: 'false' });
      const pre = h('pre', { class: 'mkd-pre' }, m.code);
      const langSeg = seg([{ value: 'python', label: 'Python' }, { value: 'js', label: 'JavaScript' }], lang, v => { pre.textContent = buildRecorded(steps, v); });
      const ribbonCb = h('input', { type: 'checkbox' });
      const body = h('div', null,
        h('div', { class: 'mkd-form' }, h('label', null, 'Name'), nameIn, h('label', null, 'Language'), h('div', null, langSeg), h('span'), h('label', { class: 'mkd-check' }, ribbonCb, 'Show a button on the Developer tab')),
        pre);
      setTimeout(() => { nameIn.focus(); nameIn.select(); }, 60);
      const v = await app.ui.dialog({ title: 'Save recorded macro', body, buttons: [{ label: 'Discard', value: 'discard', danger: true }, { label: 'Save', value: 'save', primary: true }] });
      if (v !== 'save') { toast('Recording discarded.'); return null; }
      m = { ...m, name: nameIn.value.trim() || m.name, lang: langSeg.value, code: buildRecorded(steps, langSeg.value), ribbon: ribbonCb.checked };
    }
    if (save) {
      try { m = await store.save(m); toast(`Saved macro “${m.name}”. Run it from Developer → Macros (Alt+F8).`); }
      catch (e) { app.ui.fail(e, { lead: /^Use /.test(String(e && e.message)) ? '' : 'Try saving the macro again.', actions: [{ label: 'Open in Macro Editor', run: () => openEditor(null, { lang: m.lang, code: m.code, name: m.name }) }] }); }
    }
    return m;
  }
  function toggleRecording() { return rec.on ? stopRecording() : startRecording(); }

  // =====================================================================================
  // Syntax highlighting + code editor component
  // =====================================================================================
  const KW = {
    python: new Set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'.split(' ')),
    js: new Set('await break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null of return super switch this throw true try typeof undefined var void while with yield async'.split(' ')),
  };
  const BUILTIN = {
    python: new Set('print len range str int float bool list dict set tuple sorted reversed enumerate zip map filter sum min max abs round isinstance type repr input open any all re math json datetime date statistics collections Counter self'.split(' ')),
    js: new Set('console Math JSON Object Array String Number Boolean Date RegExp Promise Map Set parseInt parseFloat isNaN'.split(' ')),
  };
  const APIW = new Set(['doc', 'docs', 'ui', 'run', 'commands', 'markooj', 'app']);
  const RX = {
    python: /(#[^\n]*)|((?:[rRbBuUfF]{1,2})?(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?))|(\b\d[\d_]*(?:\.\d*)?(?:[eE][-+]?\d+)?j?\b)|([A-Za-z_]\w*)|(@[A-Za-z_][\w.]*)/g,
    js: /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(`(?:\\[\s\S]|[^`\\])*`?|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(\b\d[\d_]*(?:\.\d*)?(?:[eE][-+]?\d+)?n?\b)|([A-Za-z_$][\w$]*)|(@@never@@)/g,
    latex: /(%[^\n]*)|(\\[A-Za-z@]+|\\.)|(#\d)|([{}[\]])/g,
  };
  function highlight(code, lang) {
    const re = RX[lang] || RX.python; re.lastIndex = 0;
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      if (!m[0]) { re.lastIndex++; continue; }
      if (m.index > last) out += esc(code.slice(last, m.index));
      let cls = null; const tok = m[0];
      if (lang === 'latex') cls = m[1] ? 'com' : m[2] ? 'cs' : m[3] ? 'arg' : 'com';
      else if (m[1]) cls = 'com';
      else if (m[2]) cls = 'str';
      else if (m[3]) cls = 'num';
      else if (m[4]) cls = KW[lang].has(tok) ? 'kw' : APIW.has(tok) ? 'api' : BUILTIN[lang].has(tok) ? 'bi' : code[re.lastIndex] === '(' ? 'fn' : null;
      else if (m[5]) cls = 'dec';
      out += cls ? `<span class="mkd-t-${cls}">${esc(tok)}</span>` : esc(tok);
      last = re.lastIndex;
    }
    return out + esc(code.slice(last)) + '\n';
  }

  const LH = 20, PAD = 12;
  function createCodeEditor({ lang = 'python', value = '', onChange, onCursor } = {}) {
    const root = h('div', { class: 'mkd-code' });
    root.innerHTML = '<div class="mkd-gutter"><div class="mkd-gutter-in"></div></div><div class="mkd-area"><div class="mkd-curline"></div><div class="mkd-errline" hidden></div><pre class="mkd-hl" aria-hidden="true"><code></code></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="Code"></textarea></div>';
    const gutter = root.querySelector('.mkd-gutter-in'), pre = root.querySelector('pre'), codeEl = pre.firstChild;
    const ta = root.querySelector('textarea'), cur = root.querySelector('.mkd-curline'), errEl = root.querySelector('.mkd-errline');
    let lines = 0, errLine = null, curLine = 0;
    const indentUnit = '    ';
    function paint() {
      codeEl.innerHTML = highlight(ta.value, lang);
      const n = ta.value.split('\n').length;
      if (n !== lines) { lines = n; let s = ''; for (let k = 1; k <= n; k++) s += `<div>${k}</div>`; gutter.innerHTML = s; curLine = -1; }
      sync();
    }
    function sync() {
      const x = ta.scrollLeft, y = ta.scrollTop;
      pre.style.transform = `translate(${-x}px,${-y}px)`;
      gutter.style.transform = `translateY(${-y}px)`;
      const ln = ta.value.slice(0, ta.selectionStart).split('\n').length - 1;
      cur.style.top = (PAD + ln * LH - y) + 'px';
      if (ln !== curLine) { gutter.children[curLine]?.classList.remove('on'); gutter.children[ln]?.classList.add('on'); curLine = ln; onCursor?.(ln + 1); }
      if (errLine != null) { errEl.hidden = false; errEl.style.top = (PAD + (errLine - 1) * LH - y) + 'px'; } else errEl.hidden = true;
    }
    function clearError() { if (errLine != null) { gutter.children[errLine - 1]?.classList.remove('err'); errLine = null; sync(); } }
    function insert(text) {
      ta.focus();
      if (!document.execCommand('insertText', false, text)) ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
    }
    function lineBounds(pos) { const v = ta.value; const a = v.lastIndexOf('\n', pos - 1) + 1; let b = v.indexOf('\n', pos); if (b < 0) b = v.length; return [a, b]; }
    function shiftLines(out) {
      const v = ta.value, s0 = ta.selectionStart, e0 = ta.selectionEnd;
      const a = lineBounds(s0)[0], b = lineBounds(e0 > s0 && v[e0 - 1] === '\n' ? e0 - 1 : e0)[1];
      const block = v.slice(a, b).split('\n');
      const changed = block.map(l => out ? l.replace(/^( {1,4}|\t)/, '') : indentUnit + l).join('\n');
      ta.setSelectionRange(a, b); insert(changed);
      ta.setSelectionRange(a, a + changed.length);
    }
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (e.shiftKey || ta.value.slice(ta.selectionStart, ta.selectionEnd).includes('\n')) shiftLines(e.shiftKey);
        else insert(indentUnit);
      } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        const v = ta.value, s = ta.selectionStart, [a] = lineBounds(s);
        const line = v.slice(a, s), indent = (/^[ \t]*/.exec(line) || [''])[0], t = line.trimEnd();
        const opens = lang === 'python' ? /:$/.test(t) : /[{([]$/.test(t);
        const next = v[ta.selectionEnd];
        if (lang !== 'python' && opens && next && '})]'.includes(next)) {
          insert('\n' + indent + indentUnit + '\n' + indent);
          const p = ta.selectionStart - indent.length - 1; ta.setSelectionRange(p, p);
        } else if (lang === 'python' && /^\s*(return|pass|break|continue|raise)\b/.test(line) && indent.length >= 4) insert('\n' + indent.slice(4));
        else insert('\n' + indent + (opens ? indentUnit : ''));
      } else if (e.key === 'Backspace' && ta.selectionStart === ta.selectionEnd) {
        const s = ta.selectionStart, [a] = lineBounds(s), before = ta.value.slice(a, s);
        if (before.length && /^ +$/.test(before)) { e.preventDefault(); const n = before.length % 4 || 4; ta.setSelectionRange(s - n, s); document.execCommand('delete'); }
      } else if (lang !== 'python' && e.key === '}' && ta.selectionStart === ta.selectionEnd) {
        const s = ta.selectionStart, [a] = lineBounds(s), before = ta.value.slice(a, s);
        if (/^ {4,}$/.test(before)) { e.preventDefault(); ta.setSelectionRange(s - 4, s); insert('}'); }
      }
    });
    ta.addEventListener('input', () => { clearError(); paint(); onChange?.(ta.value); });
    ta.addEventListener('scroll', sync);
    ['keyup', 'mouseup', 'focus'].forEach(ev => ta.addEventListener(ev, sync));
    ta.value = value; paint();
    return {
      el: root, textarea: ta,
      get value() { return ta.value; },
      set value(v) { ta.value = String(v ?? ''); clearError(); paint(); ta.scrollTop = 0; ta.scrollLeft = 0; ta.setSelectionRange(0, 0); },
      get lang() { return lang; },
      setLang(l) { lang = l; paint(); },
      focus() { ta.focus(); },
      gotoLine(n) {
        const ls = ta.value.split('\n'); n = Math.max(1, Math.min(n, ls.length));
        let pos = 0; for (let k = 0; k < n - 1; k++) pos += ls[k].length + 1;
        ta.focus(); ta.setSelectionRange(pos, pos + ls[n - 1].length);
        const want = PAD + (n - 1) * LH; if (want < ta.scrollTop || want > ta.scrollTop + ta.clientHeight - 3 * LH) ta.scrollTop = Math.max(0, want - ta.clientHeight / 3);
        sync();
      },
      markError(n) { clearError(); if (!n) return; errLine = n; gutter.children[n - 1]?.classList.add('err'); sync(); },
      insert,
    };
  }

  // =====================================================================================
  // Examples and API reference
  // =====================================================================================
  const EXAMPLES = [
    {
      title: 'Replace all “colour” with “color”', name: 'ReplaceColour',
      python: 'from markooj import doc, ui\n\nn = doc.replace("colour", "color")\nn += doc.replace("Colour", "Color")\nui.toast(f"Replaced {n} times")\n',
      js: "let n = doc.replace('colour', 'color');\nn += doc.replace('Colour', 'Color');\nui.toast(`Replaced ${n} times`);\n",
    },
    {
      title: 'Number all figures', name: 'NumberFigures',
      python: 'import re\nfrom markooj import doc, ui\n\ncount = 0\n\ndef number(m):\n    global count\n    count += 1\n    caption = re.sub(r"^Figure \\d+[.:]\\s*", "", m.group(1))\n    return f"![Figure {count}: {caption}]({m.group(2)})"\n\ndoc.text = re.sub(r"!\\[([^\\]]*)\\]\\(([^)]*)\\)", number, doc.text)\nui.toast(f"Numbered {count} figures")\n',
      js: "let count = 0;\ndoc.text = doc.text.replace(/!\\[([^\\]]*)\\]\\(([^)]*)\\)/g, (all, caption, src) => {\n    count++;\n    caption = caption.replace(/^Figure \\d+[.:]\\s*/, '');\n    return `![Figure ${count}: ${caption}](${src})`;\n});\nui.toast(`Numbered ${count} figures`);\n",
    },
    {
      title: 'Insert today’s date', name: 'InsertDate',
      python: 'from datetime import date\nfrom markooj import doc\n\ndoc.insert(date.today().strftime("%B %d, %Y"))\n',
      js: "const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });\ndoc.insert(today);\n",
    },
    {
      title: 'Make a table of word frequencies', name: 'WordTable',
      python: 'import re\nfrom collections import Counter\nfrom markooj import doc\n\nwords = re.findall(r"[A-Za-z\']+", doc.text.lower())\ncommon = Counter(w for w in words if len(w) > 3).most_common(10)\n\nrows = "\\n".join(f"| {w} | {n} |" for w, n in common)\ndoc.insert("\\n\\n| Word | Count |\\n|---|---:|\\n" + rows + "\\n")\n',
      js: "const counts = {};\nfor (const w of doc.text.toLowerCase().match(/[a-z']+/g) || []) {\n    if (w.length > 3) counts[w] = (counts[w] || 0) + 1;\n}\nconst top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);\nconst rows = top.map(([w, n]) => `| ${w} | ${n} |`).join('\\n');\ndoc.insert('\\n\\n| Word | Count |\\n|---|---:|\\n' + rows + '\\n');\n",
    },
    {
      title: 'Convert inches to cm in the selection', name: 'InchesToCm',
      python: 'import re\nfrom markooj import doc, ui\n\ntext = doc.selection\nif not text:\n    ui.alert("Select some text first.")\nelse:\n    def to_cm(m):\n        return f"{float(m.group(1)) * 2.54:.2f} cm"\n    pattern = r"(\\d+(?:\\.\\d+)?)\\s*(?:inches|inch|in\\b|\\")"\n    doc.replace_selection(re.sub(pattern, to_cm, text))\n',
      js: "const text = doc.selection;\nif (!text) {\n    await ui.alert('Select some text first.');\n} else {\n    const pattern = /(\\d+(?:\\.\\d+)?)\\s*(?:inches|inch|in\\b|\")/g;\n    doc.replaceSelection(text.replace(pattern, (m, n) => (n * 2.54).toFixed(2) + ' cm'));\n}\n",
    },
    {
      title: 'Ask a question', name: 'AskName',
      python: 'from markooj import doc, ui\n\nname = await ui.prompt_async("Who is the author?", "")\nif name:\n    doc.set_meta("author", name)\n    ui.toast(f"Author set to {name}")\n',
      js: "const name = await ui.prompt('Who is the author?', '');\nif (name) {\n    doc.setMeta('author', name);\n    ui.toast(`Author set to ${name}`);\n}\n",
    },
  ];
  function referenceHtml(lang) {
    const P = lang === 'python';
    const rows = [
      ['doc.text', 'The whole document as Markdown. Assign to it to replace everything.'],
      ['doc.title · doc.path', 'The document name and file path (empty if not saved yet).'],
      ['doc.selection', 'The selected text.'],
      ['doc.insert(text)', 'Insert text at the cursor.'],
      [P ? 'doc.replace_selection(text)' : 'doc.replaceSelection(text)', 'Replace the selected text.'],
      [P ? 'doc.replace(find, repl, regex=False, all=True, case=True)' : 'doc.replace(find, repl, {regex, all, case})', 'Find and replace. Returns how many places changed.'],
      ['doc.find(query)', 'Every match as {line, column, text}.'],
      ['doc.lines()', 'The document as a list of lines.'],
      [P ? 'doc.meta · doc.set_meta(key, value)' : 'doc.meta · doc.setMeta(key, value)', 'Document properties (title, author, keywords…) stored in the front matter.'],
      ['docs.list() · docs.open(path) · docs.new(text)', 'Work with open documents.'],
      [P ? 'ui.alert(msg) · ui.confirm(msg)' : 'await ui.alert(msg) · await ui.confirm(msg)', 'Show a message, or ask yes or no.'],
      [P ? 'await ui.prompt_async(msg, default)' : 'await ui.prompt(msg, default)', 'Ask for some text. Returns the answer, or nothing if canceled.'],
      ['ui.toast(msg)', 'A short message at the bottom of the window.'],
      [P ? 'await run(command_id, args)' : 'await run(commandId, args)', 'Run any button’s command, e.g. await run("format.bold").'],
      ['commands()', 'All command ids (the same ones the macro recorder writes).'],
      [P ? 'print(...)' : 'print(...) · console.log(...)', 'Write to the Output panel.'],
    ];
    const notes = P
      ? `<div class="mkd-note">Python runs offline, right inside Markooj. The standard library works (re, math, statistics, datetime, json, collections). Extra packages cannot be installed.</div>
         <div class="mkd-note">Start with <code>from markooj import doc, ui</code> (it is also imported for you). <code>ui.prompt(...)</code> waits for the answer where your system supports it; <code>await ui.prompt_async(...)</code> always works.</div>`
      : `<div class="mkd-note">JavaScript macros run as async functions: use <code>await</code> with ui.alert, ui.prompt, ui.confirm, run and docs.open. The full app object is available as <code>app</code>.</div>`;
    return `<h5>API reference</h5>${notes}${rows.map(([c, d]) => `<div class="mkd-api"><code>${esc(c)}</code><span>${esc(d)}</span></div>`).join('')}
      <div class="mkd-api"><button class="mkd-btn" data-act="listcmds">${svg('dev-console')}Print all command ids</button></div>
      <h5>Examples</h5>${EXAMPLES.map((x, k) => `<button class="mkd-ex" data-ex="${k}">${svg('dev-edit')}${esc(x.title)}</button>`).join('')}
      <div class="mkd-note">Stuck in a loop? Press Stop. Macros also stop after ${timeLimit() || 'no'} seconds (change this in File → Options → Developer).</div>`;
  }
  const TEMPLATE = {
    python: '# My macro: it runs on the open document.\n# Press Ctrl+Enter to run and Ctrl+S to save.\nfrom markooj import doc, ui\n\nwords = len(doc.text.split())\nui.toast(f"“{doc.title}” has {words} words")\n',
    js: '// My macro: it runs on the open document.\n// Press Ctrl+Enter to run and Ctrl+S to save.\nconst words = doc.text.split(/\\s+/).filter(Boolean).length;\nui.toast(`“${doc.title}” has ${words} words`);\n',
  };

  // =====================================================================================
  // Shortcut capture
  // =====================================================================================
  function shortcutFromEvent(e) {
    const k = e.key;
    if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(k)) return null;
    let key = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : /^Digit\d$/.test(e.code) ? e.code.slice(5) : /^F\d{1,2}$/.test(k) ? k : k.length === 1 ? k.toUpperCase() : k.replace(/^Arrow/, '');
    if (key === ' ') key = 'Space';
    const parts = []; if (e.ctrlKey || e.metaKey) parts.push('Ctrl'); if (e.altKey) parts.push('Alt'); if (e.shiftKey) parts.push('Shift');
    if (!parts.some(p => p === 'Ctrl' || p === 'Alt') && !/^F\d/.test(key)) return '';
    return [...parts, key].join('+');
  }
  function shortcutField(value, onChange) {
    const inp = h('input', { class: 'mkd-input capture', readonly: true, placeholder: 'Click, then press keys', value: value || '', style: { width: '160px' }, title: 'Click here and press a key combination, like Ctrl+Alt+M. Backspace clears it.' });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Tab') return;
      e.preventDefault(); e.stopPropagation();
      if ((e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.altKey) { inp.value = ''; onChange?.(''); return; }
      if (e.key === 'Escape') { inp.blur(); return; }
      const s = shortcutFromEvent(e);
      if (s === null) return;
      if (s === '') { toast('Use Ctrl or Alt with a key (or a function key like F9).'); return; }
      inp.value = s; onChange?.(s);
    });
    return inp;
  }
  function shortcutOwner(sc, exceptName) {
    if (!sc) return null;
    const low = sc.toLowerCase();
    return app.commands.list().find(c => c.shortcut && String(c.shortcut).toLowerCase() === low && c.id !== 'macro.' + exceptName) || null;
  }

  // =====================================================================================
  // Macro Editor (Alt+F11)
  // =====================================================================================
  let editorSheet = null;
  function openEditor(name, preset) {
    if (editorSheet) { if (name) editorSheet.select(name); else if (preset) editorSheet.loadNew(preset); editorSheet.focus(); return editorSheet; }
    const state = { orig: null, dirty: false, lang: app.settings.get('macroLang', 'python'), running: false };
    const listEl = h('div', { class: 'mkd-items', role: 'listbox', 'aria-label': 'Macros' });
    const nameIn = h('input', { class: 'mkd-input', placeholder: 'Macro name', spellcheck: 'false', style: { width: '190px' } });
    const langSeg = seg([{ value: 'python', label: 'Python' }, { value: 'js', label: 'JavaScript' }], state.lang, v => { state.lang = v; code.setLang(v); refEl.firstChild.innerHTML = referenceHtml(v); markDirty(); });
    let shortcut = '';
    const scIn = shortcutField('', v => { shortcut = v; markDirty(); const o = shortcutOwner(v, nameIn.value.trim()); if (o) out('info', `${v} is also used by “${o.label || o.id}”. The macro will take it over.`); });
    const ribbonCb = h('input', { type: 'checkbox' }); ribbonCb.addEventListener('change', markDirty);
    const dot = h('span', { class: 'mkd-dot' }), stText = h('span', null, 'Ready'), posEl = h('span', { style: { marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 } }, 'Line 1');
    const code = createCodeEditor({ lang: state.lang, onChange: () => markDirty(), onCursor: ln => { posEl.textContent = 'Line ' + ln; } });
    const outBody = h('div', { class: 'mkd-out-body', role: 'log', 'aria-live': 'polite' });
    const outWrap = h('div', { class: 'mkd-out' },
      h('div', { class: 'mkd-out-h' }, 'Output', h('span', { class: 'st' }, dot, stText), posEl,
        h('button', { class: 'mkd-btn icon', title: 'Bigger or smaller', onclick: () => outWrap.classList.toggle('big'), html: svg('chev') }),
        h('button', { class: 'mkd-btn', onclick: () => { outBody.textContent = ''; } }, 'Clear')),
      outBody);
    const refEl = h('aside', { class: 'mkd-ref' + (app.settings.get('macroRefOpen', true) ? ' show' : '') }, h('div', { class: 'mkd-ref-in', html: referenceHtml(state.lang) }));
    const runBtn = h('button', { class: 'mkd-btn primary', title: 'Run (Ctrl+Enter or F5)', html: `${svg('dev-run')}Run <kbd>Ctrl+Enter</kbd>`, onclick: () => doRun() });
    const stopBtn = h('button', { class: 'mkd-btn danger', title: 'Stop the running macro', html: `${svg('dev-stop')}Stop`, disabled: true, onclick: () => stopMacro() });
    const saveBtn = h('button', { class: 'mkd-btn', title: 'Save (Ctrl+S)', html: `${svg('save')}Save`, onclick: () => doSave() });
    const delBtn = h('button', { class: 'mkd-btn icon', title: 'Delete this macro', html: svg('dev-trash'), onclick: () => doDelete() });
    const refBtn = h('button', { class: 'mkd-btn icon' + (refEl.classList.contains('show') ? ' on' : ''), title: 'API reference and examples (F1)', html: svg('dev-book'), onclick: () => toggleRef() });
    const closeBtn = h('button', { class: 'mkd-btn icon', title: 'Close (Esc)', html: svg('x'), onclick: () => sheet.close() });
    const content = h('div', { style: { display: 'contents' } },
      h('header', { class: 'mkd-head' }, h('div', { class: 'mkd-title', html: `${svg('dev-editor')}Macro Editor` }), h('span', { class: 'mkd-grow' }), runBtn, stopBtn, saveBtn, delBtn, refBtn, closeBtn),
      h('div', { class: 'mkd-body' },
        h('aside', { class: 'mkd-list' }, h('div', { class: 'mkd-list-h' }, h('h5', null, 'Macros'), h('button', { class: 'mkd-btn icon', title: 'New macro', html: svg('plus'), onclick: () => confirmLeave().then(ok => ok && loadNew()) })), listEl),
        h('section', { class: 'mkd-main' },
          h('div', { class: 'mkd-props' }, h('label', { class: 'mkd-field' }, 'Name', nameIn), langSeg, h('label', { class: 'mkd-field' }, 'Shortcut', scIn), h('label', { class: 'mkd-check' }, ribbonCb, 'Show on ribbon')),
          code.el, outWrap),
        refEl));
    nameIn.addEventListener('input', markDirty);

    function out(kind, text, line) {
      const row = h('div', { class: 'mkd-line ' + kind }, text);
      if (line) { row.append(h('button', { class: 'mkd-goto', onclick: () => code.gotoLine(line) }, 'Line ' + line)); code.markError(line); }
      outBody.append(row); outBody.scrollTop = outBody.scrollHeight;
    }
    function setStatus(kind, text) { dot.className = 'mkd-dot ' + kind; stText.textContent = text; }
    function markDirty() { if (!state.dirty) { state.dirty = true; renderList(); } }
    function renderList() {
      listEl.textContent = '';
      if (!store.list.length && state.orig == null) listEl.append(h('div', { class: 'mkd-empty' }, 'Your saved macros appear here.'));
      const items = store.list.map(m => ({ ...m }));
      if (state.orig == null) items.unshift({ name: nameIn.value.trim() || 'New macro', lang: state.lang, isNew: true });
      for (const m of items) {
        const on = m.isNew ? state.orig == null : state.orig === m.name;
        const b = h('button', { class: 'mkd-item' + (on ? ' on' : ''), role: 'option', 'aria-selected': String(on), title: m.shortcut ? `${m.name} (${m.shortcut})` : m.name },
          h('span', { class: 'mkd-chip' + (m.lang === 'js' ? ' js' : '') }, m.lang === 'js' ? 'JS' : 'PY'), h('span', { class: 'nm' }, m.name),
          on && state.dirty ? h('span', { class: 'dirty', title: 'Not saved' }) : m.shortcut ? h('span', { class: 'sc' }, m.shortcut) : null);
        if (!m.isNew) b.addEventListener('click', () => { if (!on) confirmLeave().then(ok => ok && select(m.name)); });
        listEl.append(b);
      }
    }
    function fill(m, isNew) {
      state.orig = isNew ? null : m.name;
      nameIn.value = isNew ? (m.name || '') : m.name;
      state.lang = m.lang || state.lang; langSeg.set(state.lang); code.setLang(state.lang); refEl.firstChild.innerHTML = referenceHtml(state.lang);
      code.value = m.code || ''; shortcut = m.shortcut || ''; scIn.value = shortcut; ribbonCb.checked = !!m.ribbon;
      delBtn.disabled = isNew; state.dirty = !!isNew && !!m.code && !m.pristine; renderList();
    }
    function select(name) { const m = store.get(name); if (m) { fill(m, false); setTimeout(() => code.focus(), 30); } }
    function loadNew(preset) {
      const lang = preset?.lang || state.lang;
      fill({ name: preset?.name || nextMacroName(), lang, code: preset?.code ?? TEMPLATE[lang], pristine: !preset }, true);
      if (!preset) state.dirty = false;
      renderList(); setTimeout(() => { if (preset) code.focus(); else { nameIn.focus(); nameIn.select(); } }, 30);
    }
    async function confirmLeave() {
      if (!state.dirty) return true;
      const v = await app.ui.dialog({ title: `Save changes to “${nameIn.value.trim() || 'this macro'}”?`, body: 'Your changes will be lost if you don’t save them.', buttons: [{ label: 'Don’t Save', value: 'discard', danger: true }, { label: 'Cancel', value: 'cancel' }, { label: 'Save', value: 'save', primary: true }] });
      if (v === 'save') return doSave();
      return v === 'discard';
    }
    async function doSave() {
      const name = nameIn.value.trim();
      if (!NAME_RE.test(name)) { out('err', 'Give the macro a name: letters, numbers, spaces, - or _ (up to 48 characters).'); nameIn.focus(); return false; }
      const clash = store.get(name);
      if (clash && clash.name !== state.orig) {
        const ok = await app.ui.confirm('Replace macro?', `A macro called “${clash.name}” already exists. Replace it?`, { ok: 'Replace', danger: true });
        if (!ok) return false;
      }
      try {
        const saved = await store.save({ name, lang: state.lang, code: code.value, shortcut, ribbon: ribbonCb.checked });
        if (state.orig && state.orig.toLowerCase() !== name.toLowerCase()) await store.remove(state.orig);
        state.orig = saved.name; state.dirty = false; delBtn.disabled = false; renderList();
        setStatus('ok', `Saved “${saved.name}”`); app.settings.set('macroLang', state.lang);
        return true;
      } catch (e) { out('err', e.message); return false; }
    }
    async function doDelete() {
      if (!state.orig) return;
      if (!(await app.ui.confirm('Delete macro?', `Delete “${state.orig}”? This cannot be undone.`, { ok: 'Delete', danger: true }))) return;
      await store.remove(state.orig); state.dirty = false;
      if (store.list.length) select(store.list[0].name); else loadNew();
      setStatus('', 'Deleted');
    }
    async function doRun() {
      if (state.running) return;
      const target = app.docs.active();
      state.running = true; runBtn.disabled = true; stopBtn.disabled = false;
      setStatus('busy', state.lang === 'python' && !py.inst ? 'Starting Python… (the first time takes a few seconds)' : 'Running…');
      out('info', `▶ ${nameIn.value.trim() || 'Macro'} on “${target?.title || 'no document'}”  ·  ${new Date().toLocaleTimeString('en-US')}`);
      const t0 = performance.now();
      const r = await runMacro({ name: nameIn.value.trim(), lang: state.lang, code: code.value }, { sink: (k, t, l) => out(k, t, l) });
      state.running = false; runBtn.disabled = false; stopBtn.disabled = true;
      const secs = ((performance.now() - t0) / 1000).toFixed(2);
      if (r.ok) setStatus('ok', `Finished in ${secs} s`); else setStatus('err', r.line ? `Error on line ${r.line}` : 'Stopped with an error');
    }
    function toggleRef() { const on = refEl.classList.toggle('show'); refBtn.classList.toggle('on', on); app.settings.set('macroRefOpen', on); }
    refEl.addEventListener('click', async e => {
      const ex = e.target.closest('[data-ex]');
      if (ex) { const x = EXAMPLES[Number(ex.dataset.ex)]; if (await confirmLeave()) loadNew({ name: store.get(x.name) ? nextMacroName(x.name) : x.name, lang: state.lang, code: x[state.lang] }); return; }
      if (e.target.closest('[data-act="listcmds"]')) { out('info', 'Commands you can run with run(…):'); for (const c of commands().sort((a, b) => a.id.localeCompare(b.id))) out('out', `${c.id.padEnd(28)} ${c.label}${c.shortcut ? '  (' + c.shortcut + ')' : ''}`); }
    });

    const sheet = openSheet({
      cls: 'mkd-editor', label: 'Macro Editor', content,
      beforeClose: () => confirmLeave(),
      onKey(e) {
        const k = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && k === 'enter' || e.key === 'F5') { e.preventDefault(); doRun(); }
        else if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); doSave(); }
        else if ((e.ctrlKey || e.metaKey) && k === 'n') { e.preventDefault(); confirmLeave().then(ok => ok && loadNew()); }
        else if (e.key === 'F1') { e.preventDefault(); toggleRef(); }
        else if (e.key === 'Escape' && state.running) { e.preventDefault(); stopMacro(); }
      },
    });
    const offList = app.events.on('macros:changed', () => renderList());
    const origClose = sheet.close;
    sheet.close = async force => { const ok = await origClose(force); if (ok) { offList?.(); editorSheet = null; } return ok; };
    editorSheet = { sheet, select: n => confirmLeave().then(ok => ok && select(n)), loadNew: p => confirmLeave().then(ok => ok && loadNew(p)), focus: () => code.focus(), close: f => sheet.close(f), get code() { return code; }, run: doRun, save: doSave };
    if (preset) loadNew(preset);
    else if (name && store.get(name)) select(name);
    else if (store.list.length) select(store.list[0].name);
    else loadNew();
    out('info', 'Write a macro, then press Run. Use the book button for the API reference and examples.');
    return editorSheet;
  }

  // =====================================================================================
  // Macros dialog (Alt+F8)
  // =====================================================================================
  function openMacrosDialog() {
    let sel = store.list[0]?.name || null, filter = '';
    const search = h('input', { class: 'mkd-input', placeholder: 'Find a macro', style: { width: '100%' }, spellcheck: 'false' });
    const rows = h('div', { class: 'mkd-mrows', role: 'listbox', tabindex: '0', 'aria-label': 'Macros' });
    const btn = (label, icon, fn, cls = '') => h('button', { class: 'mkd-btn ' + cls, html: `${svg(icon)}${label}`, onclick: fn });
    const runB = btn('Run', 'dev-run', () => doRun(), 'primary');
    const editB = btn('Edit', 'dev-edit', () => { sheet.close(); openEditor(sel); });
    const delB = btn('Delete', 'dev-trash', () => doDelete());
    const content = h('div', { style: { display: 'contents' } },
      h('header', { class: 'mkd-head' }, h('div', { class: 'mkd-title', html: `${svg('dev-macros')}Macros` }), h('span', { class: 'mkd-grow' }), h('button', { class: 'mkd-btn icon', title: 'Close (Esc)', html: svg('x'), onclick: () => sheet.close() })),
      h('div', { class: 'mkd-content' },
        h('div', { class: 'mkd-mlist' },
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 } }, search, rows),
          h('div', { class: 'mkd-mbtns' }, runB, editB, btn('New', 'plus', () => { sheet.close(); openEditor(null, { lang: app.settings.get('macroLang', 'python'), code: TEMPLATE[app.settings.get('macroLang', 'python')], name: nextMacroName() }); }), delB,
            h('div', { style: { height: '8px' } }),
            btn(rec.on ? 'Stop recording' : 'Record', 'dev-record', () => { sheet.close(); toggleRecording(); }),
            btn('Editor', 'dev-editor', () => { sheet.close(); openEditor(sel); }))),
        h('p', { class: 'mkd-hint', style: { margin: '12px 0 0' } }, 'Double-click a macro to run it. Macros work on the document that is open now.')));
    function visible() { const f = filter.toLowerCase(); return store.list.filter(m => !f || m.name.toLowerCase().includes(f)); }
    function render() {
      const list = visible(); if (!list.find(m => m.name === sel)) sel = list[0]?.name || null;
      rows.textContent = '';
      if (!list.length) rows.append(h('div', { class: 'mkd-empty' }, store.list.length ? 'No macro matches.' : 'No macros yet. Click New to write one, or Record to capture what you do.'));
      for (const m of list) {
        const r = h('button', { class: 'mkd-mrow' + (m.name === sel ? ' on' : ''), role: 'option', 'aria-selected': String(m.name === sel), tabindex: '-1' },
          h('span', { class: 'mkd-chip' + (m.lang === 'js' ? ' js' : '') }, m.lang === 'js' ? 'JS' : 'PY'), h('span', { class: 'nm' }, m.name), h('small', null, [m.shortcut, m.ribbon ? 'On ribbon' : ''].filter(Boolean).join(' · ')));
        r.addEventListener('click', () => { sel = m.name; render(); });
        r.addEventListener('dblclick', () => { sel = m.name; doRun(); });
        rows.append(r);
      }
      runB.disabled = editB.disabled = delB.disabled = !sel;
      rows.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
    }
    async function doRun() { if (!sel) return; const name = sel; await sheet.close(true); runSaved(name); }
    async function doDelete() { if (!sel) return; if (!(await app.ui.confirm('Delete macro?', `Delete “${sel}”? This cannot be undone.`, { ok: 'Delete', danger: true }))) return; await store.remove(sel); render(); }
    search.addEventListener('input', () => { filter = search.value; render(); });
    const sheet = openSheet({
      cls: 'mkd-small', label: 'Macros', content, backdropCloses: true,
      onKey(e) {
        const list = visible(), i = list.findIndex(m => m.name === sel);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = list[Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]; if (n) { sel = n.name; render(); } }
        else if (e.key === 'Enter') { e.preventDefault(); doRun(); }
        else if (e.key === 'Delete' && e.target !== search) { e.preventDefault(); doDelete(); }
      },
    });
    const off = app.events.on('macros:changed', render);
    const oc = sheet.close; sheet.close = async f => { const ok = await oc(f); if (ok) off?.(); return ok; };
    render(); setTimeout(() => search.focus(), 40);
    return sheet;
  }

  // =====================================================================================
  // Python console panel
  // =====================================================================================
  const pyConsole = (() => {
    let el = null, outEl, inp, dot, hint, history = [], hIdx = -1, busy = false, draft = '';
    try { history = JSON.parse(localStorage.getItem('markooj-pyhist') || '[]'); } catch {}
    function build() {
      outEl = h('div', { class: 'mkd-con-out', role: 'log', 'aria-live': 'polite' });
      inp = h('textarea', { rows: '1', spellcheck: 'false', 'aria-label': 'Python input', placeholder: 'Type Python and press Enter' });
      dot = h('span', { class: 'mkd-dot' }); hint = h('small', null, 'Python');
      const prompt = h('span', null, '>>>');
      el = h('section', { class: 'mkd-console', 'data-mk-keys': 'own', role: 'dialog', 'aria-label': 'Python console' },
        h('div', { class: 'mkd-con-h' }, dot, h('b', null, 'Python console'), hint, h('span', { class: 'mkd-grow' }),
          h('button', { class: 'mkd-btn', title: 'Clear (Ctrl+L)', onclick: () => { outEl.textContent = ''; } }, 'Clear'),
          h('button', { class: 'mkd-btn icon', title: 'Stop', html: svg('dev-stop'), onclick: () => stopMacro() }),
          h('button', { class: 'mkd-btn icon', title: 'Close', html: svg('x'), onclick: () => close() })),
        outEl, h('div', { class: 'mkd-con-in' }, prompt, inp));
      document.body.append(el);
      const head = el.firstChild;
      head.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        const r = el.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
        head.setPointerCapture(e.pointerId); head.style.cursor = 'grabbing';
        const move = ev => { el.style.left = Math.max(0, Math.min(innerWidth - 120, r.left + ev.clientX - sx)) + 'px'; el.style.top = Math.max(0, Math.min(innerHeight - 40, r.top + ev.clientY - sy)) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; };
        const up = () => { head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); head.style.cursor = ''; };
        head.addEventListener('pointermove', move); head.addEventListener('pointerup', up);
      });
      const grow = () => { inp.style.height = '20px'; inp.style.height = Math.min(160, inp.scrollHeight) + 'px'; prompt.textContent = inp.value.includes('\n') ? '>>>\n' + '...\n'.repeat(inp.value.split('\n').length - 1).trimEnd() : '>>>'; };
      inp.addEventListener('input', grow);
      el.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); if (busy) stopMacro(); else close(); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); outEl.textContent = ''; }
        e.stopPropagation();
      });
      inp.addEventListener('keydown', async e => {
        const atTop = !inp.value.slice(0, inp.selectionStart).includes('\n'), atEnd = !inp.value.slice(inp.selectionEnd).includes('\n');
        if (e.key === 'ArrowUp' && atTop && history.length) { e.preventDefault(); if (hIdx < 0) draft = inp.value; hIdx = Math.min(history.length - 1, hIdx + 1); inp.value = history[history.length - 1 - hIdx]; grow(); }
        else if (e.key === 'ArrowDown' && atEnd && hIdx >= 0) { e.preventDefault(); hIdx--; inp.value = hIdx < 0 ? draft : history[history.length - 1 - hIdx]; grow(); }
        else if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '    '); }
        else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const src = inp.value;
          if (!src.trim()) { if (src.includes('\n')) { inp.value = ''; grow(); } return; }
          if (await isIncomplete(src)) {
            const line = src.slice(src.lastIndexOf('\n') + 1), ind = (/^\s*/.exec(line) || [''])[0];
            document.execCommand('insertText', false, '\n' + ind + (/:\s*$/.test(line) ? '    ' : '')); grow(); return;
          }
          inp.value = ''; grow(); hIdx = -1;
          if (history[history.length - 1] !== src) { history.push(src); history = history.slice(-200); try { localStorage.setItem('markooj-pyhist', JSON.stringify(history)); } catch {} }
          exec(src, true);
        }
      });
      pyStatus.add(s => paintState(s)); paintState(py.state || (py.inst ? 'ready' : 'idle'));
    }
    function paintState(s) {
      if (!dot) return;
      dot.className = 'mkd-dot ' + (s === 'loading' || busy ? 'busy' : s === 'ready' ? 'ok' : s === 'error' ? 'err' : '');
      hint.textContent = s === 'loading' ? 'Starting Python…' : busy ? 'Running…' : s === 'ready' ? `Python ${py.version || ''} · offline`.replace('  ', ' ') : 'Python';
    }
    async function isIncomplete(src) {
      try {
        const p = await loadPython();
        const fn = p.runPython('from codeop import compile_command as _cc\ndef _mk_incomplete(s):\n    try:\n        return _cc(s, "<console>", "single") is None\n    except Exception:\n        return False\n_mk_incomplete');
        const r = fn(src); fn.destroy?.(); return !!r;
      } catch { return /:\s*$/.test(src); }
    }
    function append(kind, text, line) {
      if (!el) build();
      const row = h('div', { class: 'mkd-line ' + kind }, text);
      if (line && kind === 'err') row.append(h('small', { style: { color: 'var(--text-3)', marginLeft: '8px' } }, `line ${line}`));
      outEl.append(row); outEl.scrollTop = outEl.scrollHeight;
    }
    function open(focus = true) {
      if (!el) build();
      requestAnimationFrame(() => el.classList.add('show'));
      el.hidden = false;
      if (!outEl.childNodes.length) append('info', 'Python runs offline inside Markooj. doc, docs, ui and run are ready to use. Try: doc.title');
      if (focus) setTimeout(() => inp.focus(), 50);
      loadPython().catch(e => append('err', e.message));
    }
    function close() { if (!el) return; el.classList.remove('show'); setTimeout(() => { if (!el.classList.contains('show')) el.hidden = true; }, 260); }
    async function exec(src, echo) {
      if (echo) append('in', src.split('\n').map((l, k) => (k ? '... ' : '>>> ') + l).join('\n'));
      busy = true; paintState(py.state);
      try {
        const p = await loadPython();
        if (!py.consoleNs) { py.consoleNs = p.toPy({}); py.consoleNs.set('__name__', '__main__'); p.runPython('from markooj import *', { globals: py.consoleNs }); }
        await runMacro({ name: 'console', lang: 'python', code: src }, { sink: append, py: { globals: py.consoleNs, filename: '<console>', echoResult: echo } });
      } catch (e) { append('err', e.message); }
      busy = false; paintState(py.state);
    }
    return { open, close, append, exec, toggle() { if (el && el.classList.contains('show')) close(); else open(); }, get isOpen() { return !!el && el.classList.contains('show'); } };
  })();

  // Code that came with a document (not text the user selected) runs only after a yes, once per document
  const trustedDocs = new Set();
  async function runSelection() {
    const d = app.docs.active();
    if (!d) return;
    let s = selection(d), codeText = s.text, fromDoc = false;
    if (!codeText.trim() && s.start != null) {
      const fence = /^(```|~~~)\s*\{?\.?(python|py)\b[^\n]*\n([\s\S]*?)^\1\s*$/gim; let m;
      while ((m = fence.exec(d.text))) if (s.start >= m.index && s.start <= m.index + m[0].length) { codeText = m[3]; fromDoc = true; break; }
    }
    if (!codeText.trim()) { toast('Select some Python code first (or click inside a ```python code block).'); return; }
    const key = d.path || d.id;
    const trusted = trustedDocs.has(key) || (d.path && (app.settings.get('pyTrustedFiles', []) || []).includes(d.path));
    if (fromDoc && !trusted) {
      const v = await app.ui.dialog({
        title: 'Run the Python code in this document?',
        body: '<p>Only run code you trust. Python in Markooj can read and change files on your computer.</p>',
        buttons: [{ label: 'Cancel', value: 'cancel' }, ...(d.path ? [{ label: 'Always run for this file', value: 'always' }] : []), { label: 'Run', value: 'run', primary: true }],
        cancelValue: 'cancel',
      });
      if (v !== 'run' && v !== 'always') return;
      trustedDocs.add(key);
      if (v === 'always') app.settings.set('pyTrustedFiles', [...new Set([...(app.settings.get('pyTrustedFiles', []) || []), d.path])].slice(-200));
    }
    pyConsole.open(false);
    pyConsole.exec(codeText.replace(/\r\n/g, '\n'), true);
  }

  // =====================================================================================
  // Math macros dialog: editor, live preview, Examples gallery
  // =====================================================================================
  // what: what it does; type: how to use it inside $…$ (also the rendered sample)
  const MATH_GALLERY = [
    { name: '\\R', def: '\\newcommand{\\R}{\\mathbb{R}}', what: 'The real numbers, in blackboard bold.', type: 'x \\in \\R' },
    { name: '\\N', def: '\\newcommand{\\N}{\\mathbb{N}}', what: 'The natural numbers.', type: 'n \\in \\N' },
    { name: '\\Z', def: '\\newcommand{\\Z}{\\mathbb{Z}}', what: 'The integers.', type: 'k \\in \\Z' },
    { name: '\\Q', def: '\\newcommand{\\Q}{\\mathbb{Q}}', what: 'The rational numbers.', type: '\\tfrac{p}{q} \\in \\Q' },
    { name: '\\C', def: '\\newcommand{\\C}{\\mathbb{C}}', what: 'The complex numbers.', type: 'z \\in \\C' },
    { name: '\\vect', def: '\\newcommand{\\vect}[1]{\\mathbf{#1}}', what: 'A vector in bold. Takes one argument.', type: '\\vect{v} = (v_1, v_2)' },
    { name: '\\abs', def: '\\newcommand{\\abs}[1]{\\left\\lvert #1 \\right\\rvert}', what: 'Absolute value. The bars grow with what is inside.', type: '\\abs{x - y}' },
    { name: '\\norm', def: '\\newcommand{\\norm}[1]{\\left\\lVert #1 \\right\\rVert}', what: 'The norm (length) of a vector.', type: '\\norm{x}_2' },
    { name: '\\set', def: '\\newcommand{\\set}[1]{\\left\\{ #1 \\right\\}}', what: 'A set in braces that grow with the content.', type: '\\set{1, 2, 3}' },
    { name: '\\inner', def: '\\newcommand{\\inner}[2]{\\left\\langle #1, #2 \\right\\rangle}', what: 'Inner product of two vectors. Takes two arguments.', type: '\\inner{u}{v}' },
    { name: '\\dd', def: '\\newcommand{\\dd}{\\mathrm{d}}', what: 'An upright d for integrals and derivatives.', type: '\\int_0^1 f(x)\\,\\dd x' },
    { name: '\\pdv', def: '\\newcommand{\\pdv}[2]{\\frac{\\partial #1}{\\partial #2}}', what: 'Partial derivative: the function, then the variable.', type: '\\pdv{f}{x}' },
    { name: '\\grad', def: '\\newcommand{\\grad}{\\nabla}', what: 'Gradient (nabla).', type: '\\grad f' },
    { name: '\\E', def: '\\newcommand{\\E}{\\mathbb{E}}', what: 'Expected value (expectation).', type: '\\E[X] = \\mu' },
    { name: '\\Var', def: '\\DeclareMathOperator{\\Var}{Var}', what: 'Variance, set upright like sin and log.', type: '\\Var(X) = \\sigma^2' },
    { name: '\\Cov', def: '\\DeclareMathOperator{\\Cov}{Cov}', what: 'Covariance of two variables.', type: '\\Cov(X, Y)' },
    { name: '\\given', def: '\\newcommand{\\given}{\\mid}', what: 'The bar in a conditional probability.', type: 'P(A \\given B)' },
    { name: '\\tr', def: '\\DeclareMathOperator{\\tr}{tr}', what: 'Trace of a matrix.', type: '\\tr(A)' },
    { name: '\\T', def: '\\newcommand{\\T}{^{\\mathsf{T}}}', what: 'Transpose mark. Type it right after a matrix.', type: 'A\\T x' },
    { name: '\\argmin', def: '\\DeclareMathOperator*{\\argmin}{arg\\,min}', what: 'Arg min. In a displayed equation the variable sits underneath.', type: '\\argmin_{x} f(x)' },
    { name: '\\argmax', def: '\\DeclareMathOperator*{\\argmax}{arg\\,max}', what: 'Arg max, the same way.', type: '\\argmax_{\\theta} L(\\theta)' },
    { name: '\\order', def: '\\newcommand{\\order}[1]{\\mathcal{O}\\left(#1\\right)}', what: 'Big O, for how fast something grows.', type: '\\order{n \\log n}' },
    { name: '\\unit', def: '\\newcommand{\\unit}[1]{\\,\\mathrm{#1}}', what: 'A unit after a number: upright, with a thin space.', type: 'g = 9.81\\unit{m/s^2}' },
    { name: '\\degree', def: '\\newcommand{\\degree}{^{\\circ}}', what: 'Degree sign. (LaTeX already uses \\deg for the degree of a polynomial.)', type: '90\\degree' },
    { name: '\\eps', def: '\\newcommand{\\eps}{\\varepsilon}', what: 'A short name for the curly epsilon.', type: '\\eps > 0' },
  ];
  const galleryItem = name => MATH_GALLERY.find(g => g.name === name);
  function katexHtml(tex, macros, display = false) {
    if (!window.katex) return { html: esc(tex), error: '' };
    try { return { html: window.katex.renderToString(tex, { macros: { ...macros }, throwOnError: true, displayMode: display, strict: 'ignore' }), error: '' }; }
    catch (e) { return { html: '', error: String(e.message || e).replace(/^KaTeX parse error:\s*/, '') }; }
  }
  // a sample that uses the macro: the gallery's when the definition is the gallery one, else \name{x}{y}…
  function macroSample(def) {
    const g = galleryItem(def.name);
    if (g) { const gb = parseMath(g.def)[g.name]; if (gb === def.body) return g.type; }
    const n = Math.max(def.args || 0, ...[...String(def.body).matchAll(/#(\d)/g)].map(x => Number(x[1])));
    const sample = def.name + ['{x}', '{y}', '{z}', '{a}', '{b}', '{c}', '{d}', '{e}', '{f}'].slice(0, n).join('');
    return /^\\operatorname\*/.test(def.body) ? sample + '_{x}' : /^\\operatorname/.test(def.body) ? sample + '(x)' : sample;
  }
  function plain(text, cls) { return h('span', { class: cls || null }, text); }

  function openMathDialog(opts = {}) {
    const d = app.docs.active();
    const canDoc = !!(d && d.kind === 'markdown' && !d.readOnly);
    let scope = opts.scope === 'doc' && canDoc ? 'doc' : 'all';
    const texts = { all: app.settings.get('mathMacros', '') || '', doc: canDoc ? metaMacrosToText(d.meta?.['math-macros'] ?? d.meta?.mathMacros) : '' };
    const orig = { ...texts };
    let timer = 0;
    const code = createCodeEditor({ lang: 'latex', value: texts[scope], onChange: v => { texts[scope] = v; clearTimeout(timer); timer = setTimeout(preview, 120); } });
    code.textarea.setAttribute('aria-label', 'Math macro definitions');
    code.textarea.placeholder = '\\newcommand{\\R}{\\mathbb{R}}';

    // --- help text at the top
    const helpOn = () => app.settings.get('mathMacrosHelp', true) !== false;
    const help = h('div', { class: 'mkd-mhelp', hidden: !helpOn() },
      h('div', null,
        h('p', null, h('b', null, 'Math macros are shortcuts for LaTeX you type often. '), 'Define ', h('code', null, '\\R'), ' once as ', h('code', null, '\\mathbb{R}'), ', then type ', h('code', null, '$\\R$'), ' in any equation to get ℝ. Pick one from Examples or write your own, one per line.'),
        h('p', null, h('b', null, 'All documents'), ' keeps the macros in Markooj and uses them in every document. ', h('b', null, 'This document'), ' saves them in this file’s front matter, so they travel with the file. If both define the same name, This document wins.')),
      h('button', { class: 'mkd-btn icon', 'data-tip': 'Hide this help', 'aria-label': 'Hide this help', html: svg('x'), onclick: () => { help.hidden = true; app.settings.set('mathMacrosHelp', false); helpBtn.classList.remove('on'); } }));
    const helpBtn = h('button', { class: 'mkd-btn icon' + (helpOn() ? ' on' : ''), 'data-tip': 'What are math macros?', 'data-tip-d': 'Show or hide the short help at the top.', 'aria-label': 'Help', text: '?', style: { fontWeight: '600' },
      onclick: () => { help.hidden = !help.hidden; helpBtn.classList.toggle('on', !help.hidden); app.settings.set('mathMacrosHelp', !help.hidden); } });

    // --- scope switch
    const scopeSeg = seg([{ value: 'all', label: 'All documents', title: 'Saved in Markooj, used in every document' }, { value: 'doc', label: 'This document', title: canDoc ? 'Saved in this document’s front matter (math-macros)' : 'Open an editable Markdown document to use this' }], scope, v => setScope(v));
    if (!canDoc) scopeSeg.querySelectorAll('button')[1].disabled = true;
    function setScope(v) { if (v === 'doc' && !canDoc) return; scope = v; scopeSeg.set(v); code.value = texts[v]; preview(); renderGallery(); }

    // --- right panel: Preview | Examples
    const prevEl = h('div', { class: 'mkd-mprev', role: 'region', 'aria-label': 'Preview' });
    prevEl.addEventListener('keydown', e => { const c = e.target.closest?.('.mkd-mcard[role="button"]'); if (c && e.target === c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); c.click(); } });
    const search = h('input', { class: 'mkd-input', type: 'search', placeholder: 'Find an example, like vector or derivative', spellcheck: 'false', 'aria-label': 'Find an example', style: { width: '100%' } });
    const galList = h('div', { class: 'mkd-glist' });
    const galEl = h('div', { class: 'mkd-mgal', role: 'region', 'aria-label': 'Examples', hidden: true }, h('div', { class: 'mkd-gsearch' }, search), galList);
    let panel = opts.panel === 'examples' ? 'examples' : 'preview';
    const panelSeg = seg([{ value: 'preview', label: 'Preview' }, { value: 'examples', label: 'Examples' }], panel, v => setPanel(v));
    function setPanel(v) { panel = v; panelSeg.set(v); prevEl.hidden = v !== 'preview'; galEl.hidden = v !== 'examples'; if (v === 'examples') renderGallery(); }
    const countEl = h('span', { class: 'mkd-mcount' });
    search.addEventListener('input', () => renderGallery());

    function allMacros() { return { ...parseMath(texts.all), ...parseMath(texts.doc) }; }
    function preview() {
      const det = parseMathDetailed(code.value);
      const all = { ...allMacros() };
      prevEl.textContent = '';
      const nMac = det.defs.length, nErr = det.errors.length;
      countEl.textContent = nErr ? `${nErr} line${nErr === 1 ? '' : 's'} to fix` : nMac ? `${nMac} macro${nMac === 1 ? '' : 's'}` : '';
      countEl.className = 'mkd-mcount' + (nErr ? ' bad' : '');
      if (!nMac && !nErr && !det.notes.length) {
        prevEl.append(h('div', { class: 'mkd-mempty' },
          h('p', null, 'No macros yet.'),
          h('p', null, 'Type a definition on the left, for example ', h('code', null, '\\newcommand{\\R}{\\mathbb{R}}'), ', or pick some from Examples.'),
          h('button', { class: 'mkd-btn primary', onclick: () => setPanel('examples') }, 'See examples')));
      }
      for (const er of det.errors) {
        prevEl.append(h('div', { class: 'mkd-mcard bad', role: 'button', tabindex: '0', onclick: () => code.gotoLine(er.line) },
          h('div', { class: 'mkd-mcard-h' }, h('span', { class: 'mkd-mbadge bad' }, `Line ${er.line}`), plain('Not added', 'mkd-mstate')),
          h('div', { class: 'mkd-mmsg' }, er.message),
          er.text ? h('code', { class: 'mkd-mline' }, er.text) : null));
      }
      for (const nt of det.notes) {
        const card = h('div', { class: 'mkd-mcard note ' + nt.kind },
          h('div', { class: 'mkd-mcard-h' }, h('span', { class: 'mkd-mbadge ' + nt.kind }, `Line ${nt.line}`), plain(nt.kind === 'warn' ? 'Check this' : 'Note', 'mkd-mstate')),
          h('div', { class: 'mkd-mmsg' }, nt.message));
        if (nt.kind === 'tail' && nt.from != null) {
          const r = katexHtml(nt.extra.replace(/^\$+|\$+$/g, ''), all);
          if (r.html && /\$/.test(nt.extra)) card.append(h('div', { class: 'mkd-mtail' }, plain('In a document it shows as ', 'mkd-hint'), h('span', { class: 'r', html: r.html })));
          card.append(h('div', { class: 'mkd-mact' },
            h('button', { class: 'mkd-btn', 'data-tip': 'Remove the extra text', 'data-tip-d': 'Deletes the text after the definition. Ctrl+Z brings it back.', onclick: () => removeRange(nt.from, nt.to) }, 'Remove the extra text'),
            h('button', { class: 'mkd-btn', onclick: () => code.gotoLine(nt.line) }, 'Show line')));
        }
        prevEl.append(card);
      }
      for (const def of det.defs) {
        if (det.macros[def.name] !== def.body) continue; // redefined later: show only the one that wins
        const sample = macroSample(def);
        const r = katexHtml(sample, all, false);
        const card = h('div', { class: 'mkd-mcard' + (r.error ? ' bad' : ''), role: 'button', tabindex: '0', 'data-tip': 'Show this definition', onclick: () => code.gotoLine(def.line) },
          h('div', { class: 'mkd-mres' }, h('code', null, def.name), plain('→', 'mkd-marrow'), r.error ? plain('Can’t draw it', 'mkd-mstate bad') : h('span', { class: 'r', html: r.html })),
          h('div', { class: 'mkd-mtype' }, plain('Type ', 'mkd-hint'), h('code', null, `$${sample}$`)));
        if (r.error) card.append(h('div', { class: 'mkd-mmsg bad' }, `Fix the definition of ${def.name}: ${r.error}`));
        prevEl.append(card);
      }
    }
    function removeRange(from, to) {
      const ta = code.textarea; ta.focus(); ta.setSelectionRange(from, to);
      if (!document.execCommand('delete')) { ta.setRangeText('', from, to, 'end'); ta.dispatchEvent(new Event('input')); }
    }
    function addDefinition(def) {
      const v = code.value; const ta = code.textarea;
      ta.focus(); ta.setSelectionRange(v.length, v.length);
      code.insert((v && !v.endsWith('\n') ? '\n' : '') + def + '\n');
      texts[scope] = code.value; preview(); renderGallery();
    }
    function renderGallery() {
      if (galEl.hidden) return;
      const here = parseMath(texts[scope]);
      const q = search.value.trim().toLowerCase();
      const merged = { ...allMacros() };
      galList.textContent = '';
      const list = MATH_GALLERY.filter(g => !q || (g.name + ' ' + g.what + ' ' + g.def).toLowerCase().includes(q.replace(/^\\/, '')) || g.name.toLowerCase().includes(q));
      if (!list.length) galList.append(h('div', { class: 'mkd-empty' }, 'No example matches. Try “set”, “vector” or “operator”.'));
      for (const g of list) {
        const body = parseMath(g.def)[g.name];
        const added = here[g.name] === body, taken = !added && g.name in here;
        const r = katexHtml(g.type, { ...merged, [g.name]: body }, false);
        const add = h('button', { class: 'mkd-btn ' + (added ? 'on' : 'primary'), disabled: added, 'data-tip': added ? 'Already added' : taken ? `Replace your ${g.name}` : `Add ${g.name}`, 'data-tip-d': added ? '' : `Adds ${g.def} to ${scope === 'doc' ? 'this document' : 'all documents'}.`, 'aria-label': `${added ? 'Added' : 'Add'} ${g.name}` }, added ? 'Added' : taken ? 'Replace' : 'Add');
        add.addEventListener('click', () => { try { app.ui.ripple?.(add); } catch {} addDefinition(g.def); toast(`${g.name} added. Type $${g.type}$ in your document.`); });
        galList.append(h('div', { class: 'mkd-gcard', 'data-name': g.name },
          h('div', { class: 'mkd-gres', html: r.html || esc(g.type) }),
          h('div', { class: 'mkd-gtext' },
            h('div', { class: 'mkd-gname' }, h('code', null, g.name), h('span', null, g.what)),
            h('div', { class: 'mkd-gtype' }, plain('Type ', 'mkd-hint'), h('code', null, `$${g.type}$`)),
            h('code', { class: 'mkd-gdef', title: 'The definition that Add inserts' }, g.def)),
          add));
      }
    }

    const dirty = () => texts.all !== orig.all || texts.doc !== orig.doc;
    async function save() {
      app.settings.set('mathMacros', texts.all);
      if (canDoc && texts.doc.trim() !== String(orig.doc).trim()) {
        const meta = { ...(fmParse(d.text).meta || {}) };
        delete meta.mathMacros;
        if (texts.doc.trim()) meta['math-macros'] = texts.doc.trim(); else delete meta['math-macros'];
        d.setText(fmWrite(d.text, meta), 'mathMacros');
      }
      mathCache.key = null;
      try { app.editors?.active?.()?.refresh?.(); } catch {}
      app.events.emit('mathMacros:changed', mathMacros());
      orig.all = texts.all; orig.doc = texts.doc;
      toast('Math macros saved.');
      await sheet.close(true);
      return true;
    }
    async function askSave() {
      if (!dirty()) return true;
      const v = await app.ui.dialog({ title: 'Save your math macros?', body: 'Your changes will be lost if you don’t save them.', buttons: [{ label: 'Don’t Save', value: 'discard', danger: true }, { label: 'Cancel', value: 'cancel' }, { label: 'Save', value: 'save', primary: true }] });
      if (v === 'save') { await save(); return false; }
      return v === 'discard';
    }
    const content = h('div', { style: { display: 'contents' } },
      h('header', { class: 'mkd-head' }, h('div', { class: 'mkd-title', html: `${svg('sigma')}Math macros` }), scopeSeg, h('span', { class: 'mkd-grow' }), helpBtn,
        h('button', { class: 'mkd-btn', onclick: () => sheet.close() }, 'Cancel'), h('button', { class: 'mkd-btn primary', 'data-tip': 'Save', 'data-key': 'Ctrl+S', onclick: save }, 'Save'),
        h('button', { class: 'mkd-btn icon', 'data-tip': 'Close', 'data-key': 'Esc', 'aria-label': 'Close', html: svg('x'), onclick: () => sheet.close() })),
      help,
      h('div', { class: 'mkd-math-body' },
        h('div', { class: 'mkd-math-left' }, code.el, h('div', { class: 'mkd-math-foot' }, plain('One definition per line. % starts a comment.', 'mkd-hint'), h('span', { class: 'mkd-grow' }), countEl)),
        h('div', { class: 'mkd-math-right' }, h('div', { class: 'mkd-math-tabs' }, panelSeg), prevEl, galEl)));
    const sheet = openSheet({
      cls: 'mkd-math', label: 'Math macros', content, beforeClose: askSave,
      onKey(e) { if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 's' || e.key === 'Enter')) { e.preventDefault(); save(); } },
    });
    preview(); setPanel(panel); setTimeout(() => code.focus(), 40);
    return Object.assign(sheet, {
      code, preview: prevEl, gallery: galEl,
      get scope() { return scope; }, setScope, setPanel, save,
      addExample(name) { const g = galleryItem(name); if (!g) throw new Error('No example ' + name); addDefinition(g.def); },
      details: () => parseMathDetailed(code.value),
    });
  }

  // =====================================================================================
  // Commands, ribbon, status bar, options
  // =====================================================================================
  const C = (id, def) => app.commands.register(id, def);
  C('dev.macros', { label: 'Macros…', icon: 'dev-macros', shortcut: 'Alt+F8', run: () => { openMacrosDialog(); } });
  C('dev.record', { label: 'Record macro', description: 'Start recording what you do. Click again, or Stop in the status bar, to finish and save the macro.', icon: 'dev-record', run: () => toggleRecording(), isActive: () => rec.on });
  C('dev.stopRecording', { label: 'Stop recording macro', icon: 'dev-stop', run: () => stopRecording(), isEnabled: () => rec.on });
  C('dev.editor', { label: 'Macro editor', icon: 'dev-editor', shortcut: 'Alt+F11', run: args => { openEditor(args?.name); } });
  C('dev.newMacro', { label: 'New macro', icon: 'plus', run: args => { const lang = args?.lang || app.settings.get('macroLang', 'python'); openEditor(null, { lang, code: TEMPLATE[lang], name: nextMacroName() }); } });
  C('dev.runMacro', { label: 'Run macro…', icon: 'dev-run', run: args => args?.name ? runSaved(args.name) : openMacrosDialog() });
  C('dev.stopMacro', { label: 'Stop running macro', icon: 'dev-stop', run: () => { if (!stopMacro()) toast('No macro is running.'); } });
  C('dev.runSelection', { label: 'Run selection as Python', icon: 'dev-run', shortcut: 'Ctrl+Alt+Enter', run: () => runSelection() });
  C('dev.pythonConsole', { label: 'Python console', icon: 'dev-console', shortcut: 'Ctrl+Alt+P', run: () => pyConsole.toggle(), isActive: () => pyConsole.isOpen });
  C('dev.mathMacros', { label: 'Math macros…', icon: 'sigma', run: () => { openMathDialog(); } });
  // Add-in commands are implemented by addons.js; these fallbacks only run if it is missing.
  if (!app.commands.get('dev.addins')) C('dev.addins', { label: 'Manage add-ins', icon: 'puzzle', run: () => app.backstage.open('addins') });

  // Record turns into Stop recording while the recorder runs
  function addCodeGroup() {
    app.ribbon.addGroup('developer', {
      id: 'dev-code', label: 'Code', order: 10, items: [
        { type: 'big', command: 'dev.macros', label: 'Macros', icon: 'dev-macros' },
        rec.on ? { type: 'big', command: 'dev.record', label: 'Stop recording', icon: 'dev-stop', tooltip: 'Stop recording' }
          : { type: 'big', command: 'dev.record', label: 'Record', icon: 'dev-record' },
        { type: 'big', command: 'dev.editor', label: 'Editor', icon: 'dev-editor' },
      ],
    });
  }
  addCodeGroup();
  app.ribbon.addGroup('developer', {
    id: 'dev-run', label: 'Run', order: 20, items: [
      { type: 'big', command: 'dev.runSelection', label: 'Run code', icon: 'dev-run' },
      { type: 'big', command: 'dev.pythonConsole', label: 'Console', icon: 'dev-console' },
    ],
  });
  app.ribbon.addGroup('developer', { id: 'dev-math', label: 'Math', order: 30, items: [{ type: 'big', command: 'dev.mathMacros', label: 'Math macros', icon: 'sigma' }] });
  app.ribbon.addGroup('developer', {
    id: 'dev-addins', label: 'Add-ins', order: 40, items: [
      { type: 'big', command: 'dev.addins', label: 'Add-ins', icon: 'puzzle' },
      { type: 'big', command: 'dev.installAddin', label: 'Install', icon: 'dev-download' },
      { type: 'big', command: 'dev.openAddinsFolder', label: 'Folder', icon: 'open' },
    ],
  });

  app.status.addItem({
    id: 'dev-recording', side: 'left', order: 1,
    render(el) {
      el.textContent = ''; recStatusEl = el;
      el.hidden = !rec.on; el.style.display = rec.on ? '' : 'none';
      if (!rec.on) return;
      el.append(h('button', { class: 'mkd-rec', 'data-tip': 'Recording a macro', 'data-tip-d': 'Everything you do with the ribbon and the keyboard is being recorded. Click to stop and save it as a macro.', 'aria-label': 'Stop recording',
        onclick: () => stopRecording() }, h('i'), h('span', null, 'Recording'), h('span', { class: 'mkd-rec-n' }), h('b', null, 'Stop')));
      paintRecStatus();
    },
  });

  app.options?.addSection?.({
    id: 'developer', label: 'Developer', order: 80,
    render(el) {
      el.textContent = '';
      const langS = seg([{ value: 'python', label: 'Python' }, { value: 'js', label: 'JavaScript' }], app.settings.get('macroLang', 'python'), v => app.settings.set('macroLang', v));
      const lim = h('input', { class: 'mkd-input', type: 'number', min: '0', max: '3600', step: '5', value: String(timeLimit()), style: { width: '90px' } });
      lim.addEventListener('change', () => { const v = Math.max(0, Math.min(3600, Number(lim.value) || 0)); lim.value = v; app.settings.set('macroTimeLimit', v); });
      const pre = h('input', { type: 'checkbox' }); pre.checked = !!app.settings.get('pythonPreload', false);
      pre.addEventListener('change', () => app.settings.set('pythonPreload', pre.checked));
      el.append(h('div', { class: 'mkd-opt' },
        h('div', { class: 'mkd-opt-row' }, h('span', null, 'Language for new macros'), langS),
        h('div', { class: 'mkd-opt-row' }, h('span', null, 'Stop macros that run longer than'), lim, h('span', { class: 'mkd-hint' }, 'seconds (0 means no limit)')),
        h('label', { class: 'mkd-check' }, pre, 'Start Python in the background when Markooj opens (faster first run)')));
    },
  });

  // =====================================================================================
  // Public API: app.developer
  // =====================================================================================
  app.developer = {
    api,
    mathMacros, mathMacrosFor, macrosToLatex,
    parseMathMacros: parseMath,
    parseMathMacrosDetailed: parseMathDetailed,
    macros: { list: () => store.list.slice(), get: n => store.get(n), save: m => store.save(m), remove: n => store.remove(n), load: () => store.load(), run: n => runSaved(n) },
    runMacro,
    stopMacro,
    runPython: (code, opts = {}) => runMacro({ lang: 'python', code }, opts),
    runJavaScript: (code, opts = {}) => runMacro({ lang: 'js', code }, opts),
    loadPython,
    get pythonReady() { return !!py.inst; },
    recorder: { start: startRecording, stop: stopRecording, get active() { return rec.on; }, steps: () => rec.steps.slice(), build: buildRecorded },
    openEditor, openMacrosDialog, openMathDialog,
    console: pyConsole,
    highlight,
    createCodeEditor,
  };

  store.load();
  app.events.on('ready', () => {
    if (app.settings.get('pythonPreload', false)) setTimeout(() => loadPython().catch(() => {}), 3000);
  });
  app.events.on('settings:changed', ({ key } = {}) => { if (key === 'mathMacros') mathCache.key = null; });

  // =====================================================================================
  // Smoke tests
  // =====================================================================================
  const A = app.assert || ((c, m) => { if (!c) throw new Error('Assertion failed: ' + m); });
  const silent = () => {};
  async function withDoc(text, fn) {
    const prev = app.docs.active();
    const d = app.docs.create({}); d.setText(text, 'test');
    try { return await fn(d); }
    finally { await app.docs.close(d.id, { force: true }); if (prev && app.docs.get(prev.id)) app.docs.activate(prev.id); }
  }
  app.tests.register('developer: JS macro doc.replace changes the text', () => withDoc('The colour of the colour wheel.', async d => {
    const r = await runMacro({ lang: 'js', code: "const n = doc.replace('colour','color'); print(n);" }, { sink: silent });
    A(r.ok, 'macro ran: ' + r.error);
    A(d.text === 'The color of the color wheel.', 'text replaced, got ' + JSON.stringify(d.text));
  }));
  app.tests.register('developer: JS macro errors report the line number', async () => {
    const r = await runMacro({ lang: 'js', code: 'const a = 1;\nconst b = 2;\nnotDefinedThing();' }, { sink: silent });
    A(!r.ok && r.line === 3, 'error on line 3, got ' + r.line + ' ' + r.error);
  });
  app.tests.register('developer: doc API find / insert / set_meta', () => withDoc('alpha\nbeta alpha', async d => {
    const r = await runMacro({ lang: 'js', code: "const f = doc.find('alpha'); if (f.length !== 2 || f[1].line !== 2 || f[1].column !== 6) throw new Error(JSON.stringify(f)); doc.insert('!'); doc.setMeta('author', 'Ada');" }, { sink: silent });
    A(r.ok, 'macro ran: ' + r.error);
    A(/author:\s*"?Ada/.test(d.text), 'front matter written: ' + d.text);
    A(d.text.includes('!'), 'inserted');
  }));
  app.tests.register('developer: recorder builds a macro from two commands', async () => {
    startRecording();
    app.events.emit('command:ran', { id: 'format.bold' });
    app.events.emit('command:ran', { id: 'insert.table', args: { rows: 2, cols: 3 } });
    const js = await stopRecording({ ask: false, save: false, lang: 'js', name: 'TestRec' });
    A(js && js.code.includes("await run(\"format.bold\");") && js.code.includes('insert.table') && js.code.includes('"rows":2'), 'JS code: ' + (js && js.code));
    startRecording();
    app.events.emit('command:ran', { id: 'format.bold' });
    app.events.emit('command:ran', { id: 'format.italic', args: { on: true } });
    const pyM = await stopRecording({ ask: false, save: false, lang: 'python', name: 'TestRec' });
    A(pyM && pyM.code.includes('run("format.bold")') && pyM.code.includes('run("format.italic", {"on": True})'), 'Python code: ' + (pyM && pyM.code));
  });
  app.tests.register('developer: syntax highlighter', () => {
    const out = highlight('def f(x):\n    return "hi"  # note', 'python');
    A(out.includes('mkd-t-kw') && out.includes('mkd-t-str') && out.includes('mkd-t-com'), 'tokens');
  });
  app.tests.register('developer: Python macro via Pyodide (allowed 60 s)', () => withDoc('start ', async d => {
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Python did not finish within 60 s')), 60000));
    const r = await Promise.race([runMacro({ lang: 'python', code: 'from markooj import doc\ndoc.insert("py ok")\nprint(len(doc.text))' }, { sink: silent }), timeout]);
    A(r.ok, 'python ran: ' + r.error);
    A(d.text.includes('py ok'), 'text inserted, got ' + JSON.stringify(d.text));
    const r2 = await runMacro({ lang: 'python', code: 'x = 1\ny = 0\nprint(x / y)' }, { sink: silent });
    A(!r2.ok && r2.line === 3 && /ZeroDivisionError/.test(r2.error), 'python error line: ' + r2.line + ' ' + r2.error);
  }));
  // ---- round 3: lenient math macros, Examples gallery, recorder end to end
  const USER_LINE = '\\newcommand{\\R}{\\mathbb{R}}$\\R$';
  app.tests.register('developer: math macros accept the pasted line with a note', () => {
    const r = parseMathDetailed(USER_LINE);
    A(r.macros['\\R'] === '\\mathbb{R}', '\\R defined: ' + JSON.stringify(r.macros));
    A(!r.errors.length, 'no errors: ' + JSON.stringify(r.errors));
    const n = r.notes.find(x => x.kind === 'tail');
    A(n && n.message === '\\R is defined. The text after it, $\\R$, is not a definition — type it in your document to use the macro.', 'friendly note: ' + JSON.stringify(r.notes));
    A(USER_LINE.slice(n.from, n.to) === '$\\R$', 'note points at the extra text');
  });
  app.tests.register('developer: math macros parser (several per line, \\def, operators, errors)', () => {
    const m = parseMath('\\newcommand{\\R}{\\mathbb{R}}\n\\def\\abs#1{\\left|#1\\right|}\n\\DeclareMathOperator{\\tr}{tr}\n\\renewcommand\\vect[1]{\\mathbf{#1}}');
    A(m['\\R'] === '\\mathbb{R}', '\\R parsed: ' + JSON.stringify(m));
    A(m['\\abs'] === '\\left|#1\\right|', '\\def with args');
    A(m['\\tr'] === '\\operatorname{tr}', 'DeclareMathOperator');
    A(m['\\vect'] === '\\mathbf{#1}', 'renewcommand without braces');
    A(JSON.stringify(parseMath('\\newcommand{\\R}{\\mathbb{R}}')) === JSON.stringify({ '\\R': '\\mathbb{R}' }), 'exact object');
    const multi = parseMathDetailed('\\newcommand{\\N}{\\mathbb{N}} \\newcommand{\\Z}{\\mathbb{Z}}; \\providecommand{\\Q}{\\mathbb{Q}} % number sets\n\\DeclareMathOperator*{\\argmin}{arg\\,min}\\def\\eps{\\varepsilon}');
    A(['\\N', '\\Z', '\\Q', '\\argmin', '\\eps'].every(k => k in multi.macros) && !multi.errors.length && !multi.notes.length, 'several per line: ' + JSON.stringify(multi));
    A(multi.macros['\\argmin'] === '\\operatorname*{arg\\,min}', 'starred operator');
    const opt = parseMathDetailed('\\newcommand{\\deriv}[2][x]{\\frac{d #2}{d #1}}');
    A(opt.macros['\\deriv'] === '\\frac{d #1}{d x}' && opt.notes.some(n => /default/.test(n.message)), 'optional default: ' + JSON.stringify(opt));
    const bad = parseMathDetailed('\\newcommand{\\bad}{\\mathbb{R}\n\\newcommand{\\ok}{1}\n$x$\n\\newcommand{\\f}[x]{#1}');
    A(bad.macros['\\ok'] === '1', 'a broken line does not stop the next one');
    A(/closing brace/.test(bad.errors[0]?.message) && bad.errors[0].line === 1, 'says the brace is missing: ' + JSON.stringify(bad.errors[0]));
    A(/definition/.test(bad.errors[1]?.message) && bad.errors[1].line === 3, 'says the line is not a definition');
    A(/0 to 9/.test(bad.errors[2]?.message), 'says what is wrong with [x]');
    A(typeof mathMacros() === 'object', 'mathMacros() returns an object');
  });
  app.tests.register('developer: \\DeclareMathOperator renders with KaTeX', () => {
    const m = parseMath('\\DeclareMathOperator{\\Var}{Var}\n\\DeclareMathOperator*{\\argmin}{arg\\,min}');
    A(window.katex, 'KaTeX loaded');
    const a = window.katex.renderToString('\\Var(X)', { macros: { ...m }, throwOnError: true });
    A(/mop/.test(a) && a.includes('Var'), 'operator drawn upright: ' + a.slice(0, 120));
    const b = window.katex.renderToString('\\argmin_x f(x)', { macros: { ...m }, throwOnError: true, displayMode: true });
    A(/munder|mop op-limits|op-limits/.test(b), 'limits under arg min in display');
    for (const g of MATH_GALLERY) {
      const body = parseMath(g.def)[g.name];
      A(body, 'gallery definition parses: ' + g.def);
      A(g.what && g.type, 'gallery item explains itself: ' + g.name);
      window.katex.renderToString(g.type, { macros: { [g.name]: body }, throwOnError: true });
    }
    A(MATH_GALLERY.length >= 15, 'at least 15 examples');
  });
  app.tests.register('developer: Math macros dialog: note, Examples, Add, screenshot', async () => {
    const before = app.settings.get('mathMacros', '');
    app.settings.set('mathMacros', USER_LINE + '\n\\newcommand{\\vect}[1]{\\mathbf{#1}}');
    let dlg = null;
    try {
      dlg = openMathDialog({ scope: 'all' });
      await new Promise(r => setTimeout(r, 450));
      const txt = dlg.preview.textContent;
      A(/The text after it/.test(txt) && !/Not added/.test(txt), 'preview shows the friendly note and no error: ' + txt.slice(0, 200));
      A(dlg.preview.querySelectorAll('.mkd-mres .katex').length >= 2, 'each macro rendered with KaTeX');
      A(dlg.preview.querySelector('.mkd-mact button'), 'Remove the extra text button');
      if (mk.invoke) try { await mk.invoke('smoke-shot', 'math-macros'); } catch {}
      dlg.setPanel('examples');
      await new Promise(r => setTimeout(r, 300));
      const cards = dlg.gallery.querySelectorAll('.mkd-gcard');
      A(cards.length >= 15, 'gallery cards: ' + cards.length);
      const galBtn = n => [...dlg.gallery.querySelectorAll('.mkd-gcard')].find(c => c.dataset.name === n)?.querySelector('.mkd-btn');
      A(galBtn('\\vect')?.textContent === 'Added', 'already-added macros say Added');
      const addBtn = galBtn('\\pdv');
      A(addBtn && addBtn.textContent === 'Add', 'Add button');
      addBtn.click();
      await new Promise(r => setTimeout(r, 250));
      A(dlg.code.value.includes('\\newcommand{\\pdv}[2]{\\frac{\\partial #1}{\\partial #2}}'), 'Add inserted the definition: ' + dlg.code.value);
      A(galBtn('\\pdv')?.textContent === 'Added', 'button turns into Added');
      if (mk.invoke) try { await mk.invoke('smoke-shot', 'math-macros-examples'); } catch {}
    } finally {
      try { await dlg?.close(true); } catch {}
      app.settings.set('mathMacros', before);
    }
  });
  app.tests.register('developer: math macros reach the renderer, MathLive and exports', async () => {
    const before = app.settings.get('mathMacros', '');
    app.settings.set('mathMacros', USER_LINE + '\n\\DeclareMathOperator{\\Var}{Var}');
    try {
      await withDoc('Let $x \\in \\R$ and $\\Var(X)$.\n', async d => {
        const mm = mathMacros();
        A(mm['\\R'] === '\\mathbb{R}' && mm['\\Var'] === '\\operatorname{Var}', 'mathMacros(): ' + JSON.stringify(mm));
        const r = await app.render(d.text);
        A(/mathbb|ℝ/.test(r.html) && !/katex-error/.test(r.html), 'rendered without errors');
        const md = await app.exporter.exportMarkdown(d, 'docx');
        A(md.includes('\\newcommand{\\R}{\\mathbb{R}}') && md.includes('\\newcommand{\\Var}{\\operatorname{Var}}'), 'export carries the macros: ' + md.slice(0, 200));
        A(!md.includes('$\\R$\n\\newcommand') && !/\\mathbb\{R\}\}\$\\R\$/.test(md), 'the extra text is not exported as a definition');
        const tex = await app.exporter.exportMarkdown(d, 'latex');
        A(tex.includes('\\newcommand{\\R}{\\mathbb{R}}'), 'LaTeX export carries \\R');
      });
      // a document's own macros (front matter math-macros) win over the global ones and reach its export
      await withDoc('---\nmath-macros: \\newcommand{\\R}{\\mathbf{R}}\n---\n$\\R$\n', async d => {
        const md = await app.exporter.exportMarkdown(d, 'docx');
        A(md.includes('\\newcommand{\\R}{\\mathbf{R}}'), 'document macros in export: ' + md.slice(0, 200));
      });
    } finally { app.settings.set('mathMacros', before); }
  });
  app.tests.register('developer: math macros survive a real Pandoc export (DOCX and LaTeX)', async () => {
    let tools = null; try { tools = await mk.invoke('tools'); } catch {}
    if (!tools?.pandoc || !app.exporter?.exportTo) return; // no Pandoc in this copy: nothing to check
    const dir = await mk.invoke('recovery-dir');
    const before = app.settings.get('mathMacros', '');
    app.settings.set('mathMacros', USER_LINE + '\n\\DeclareMathOperator*{\\argmin}{arg\\,min}\n\\newcommand{\\vect}[1]{\\mathbf{#1}}');
    try {
      await withDoc('# Macros\n\nLet $x \\in \\R$ and $\\vect{v}$.\n\n$$\\hat{x} = \\argmin_{x} f(x)$$\n', async d => {
        const tex = dir + '/mk-dev-macros.tex', docx = dir + '/mk-dev-macros.docx';
        await app.exporter.exportTo('latex', d, tex);
        const t = await mk.invoke('read-text', tex);
        A(/\\mathbb\{R\}/.test(t) && /\\mathbf\{v\}|\\vect\{v\}/.test(t) && !/\$\\R\$\s*\\newcommand/.test(t), 'LaTeX has the macros: ' + t.slice(0, 400));
        await app.exporter.exportTo('docx', d, docx);
        const back = await mk.invoke('read-file', docx);
        const txt = String(back?.text || '');
        A(/\\mathbb\{R\}|ℝ/.test(txt), 'DOCX math kept \\R as ℝ: ' + txt.slice(0, 300));
        A(/arg\s*\\?,?\s*min|argmin/.test(txt), 'DOCX has arg min: ' + txt.slice(0, 300));
      });
    } finally { app.settings.set('mathMacros', before); }
  });
  app.tests.register('developer: recorder end to end (ribbon state, status bar, replay in JS and Python)', async () => {
    let js = null, pyM = null;
    await withDoc('Intro\n', async d => {
      app.docs.activate(d.id);
      await new Promise(r => setTimeout(r, 200));
      startRecording();
      try {
        const g = app.ribbon.tabs().find(t => t.id === 'developer')?.groups.find(x => x.id === 'dev-code');
        A(g?.items.some(i => i.command === 'dev.record' && i.label === 'Stop recording'), 'ribbon says Stop recording');
        A(document.body.classList.contains('mk-recording'), 'body class');
        app.status.refresh?.(); await new Promise(r => setTimeout(r, 50));
        A(document.querySelector('.mkd-rec .mkd-rec-n'), 'status bar shows the recorder');
        if (mk.invoke) { try { app.shell?.selectTab?.('developer'); await new Promise(r => setTimeout(r, 1200)); await mk.invoke('smoke-shot', 'macro-recording'); } catch {} }
        d.setText(d.text + 'Hello world', 'test-typing');
        await app.commands.run('insert.hr');
        await new Promise(r => setTimeout(r, 300));
        A(rec.steps.some(s => s.kind === 'type' && s.text === 'Hello world'), 'typing recorded: ' + JSON.stringify(rec.steps));
        A(rec.steps.some(s => s.kind === 'cmd' && s.id === 'insert.hr'), 'command recorded: ' + JSON.stringify(rec.steps));
        const steps = rec.steps.slice();
        js = { code: buildRecorded(steps, 'js') }; pyM = { code: buildRecorded(steps, 'python') };
        A(!steps.some(s => s.kind === 'type' && /---/.test(s.text)), 'the divider is not recorded as typing too: ' + JSON.stringify(steps));
      } finally { await stopRecording({ ask: false, save: false }); }
      const g2 = app.ribbon.tabs().find(t => t.id === 'developer')?.groups.find(x => x.id === 'dev-code');
      A(g2?.items.some(i => i.command === 'dev.record' && i.label === 'Record'), 'ribbon back to Record');
      A(!document.body.classList.contains('mk-recording'), 'body class removed');
    });
    A(/await run\("insert\.hr"\)/.test(js.code) && /doc\.insert\("Hello world"\)/.test(js.code), 'JS code: ' + js.code);
    A(/await run\("insert\.hr"\)/.test(pyM.code), 'Python code awaits commands: ' + pyM.code);
    await withDoc('Start\n', async d => {
      app.docs.activate(d.id); await new Promise(r => setTimeout(r, 150));
      const r = await runMacro({ lang: 'js', code: js.code }, { sink: silent });
      A(r.ok, 'JS replay ran: ' + r.error);
      await new Promise(r2 => setTimeout(r2, 200));
      A(d.text.includes('Hello world') && /^---$/m.test(d.text), 'JS replay did both steps: ' + JSON.stringify(d.text));
    });
    await withDoc('Start\n', async d => {
      app.docs.activate(d.id); await new Promise(r => setTimeout(r, 150));
      const r = await runMacro({ lang: 'python', code: pyM.code }, { sink: silent });
      A(r.ok, 'Python replay ran: ' + r.error);
      await new Promise(r2 => setTimeout(r2, 200));
      A(d.text.includes('Hello world') && /^---$/m.test(d.text), 'Python replay did both steps: ' + JSON.stringify(d.text));
    });
  });
})();
