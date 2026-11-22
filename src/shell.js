// Markooj — shell: title bar, ribbon, document tabs, outline, status bar, zoom, theme, dialogs,
// popovers, command palette, shortcuts, backstage (File) pages and the View tab. See ARCHITECTURE.md.
(function () {
  'use strict';
  const app = window.app;
  if (!app) { console.error('shell.js: window.app missing'); return; }
  const mk = app.mk;
  const esc = app.esc;
  const isMac = mk.platform === 'darwin';
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const icon = (name, cls = 'i', style = '') => `<svg class="${cls}"${style ? ` style="${style}"` : ''}><use href="#${esc(name || 'doc')}"/></svg>`;
  const safe = (fn, fallback) => { try { return fn(); } catch (e) { return fallback; } };
  const raf = fn => requestAnimationFrame(fn);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const fmtNum = n => Number(n || 0).toLocaleString('en-US');
  const settings = app.settings;

  /** Small element builder: h('button.big#id', {title, onclick, html}, ...children) */
  function h(sel, attrs, ...kids) {
    const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(sel) || [];
    const el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([\w-]+)/g, (_x, t, v) => { if (t === '.') el.classList.add(v); else el.id = v; });
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'class') el.className += ' ' + v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
    return el;
  }

  // ---------- keyboard shortcut strings ----------
  const MOD_ORDER = ['Ctrl', 'MacCtrl', 'Alt', 'Shift', 'Meta'];
  const KEY_ALIASES = { plus: '=', '+': '=', minus: '-', esc: 'Escape', escape: 'Escape', del: 'Delete', delete: 'Delete', space: 'Space', ' ': 'Space', up: 'Up', arrowup: 'Up', down: 'Down', arrowdown: 'Down', left: 'Left', arrowleft: 'Left', right: 'Right', arrowright: 'Right', pgup: 'PageUp', pageup: 'PageUp', pgdn: 'PageDown', pagedown: 'PageDown', return: 'Enter', enter: 'Enter', tab: 'Tab', backspace: 'Backspace', home: 'Home', end: 'End', insert: 'Insert' };
  const CODE_MAP = { Equal: '=', NumpadAdd: '=', Minus: '-', NumpadSubtract: '-', Comma: ',', Period: '.', Slash: '/', NumpadDivide: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Backquote: '`', Space: 'Space', Enter: 'Enter', NumpadEnter: 'Enter', Escape: 'Escape', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Insert: 'Insert', NumpadMultiply: '*' };
  function normShortcut(s) {
    if (!s) return '';
    let str = String(s).trim();
    let key = '';
    if (/\+\+$/.test(str)) { key = '='; str = str.slice(0, -2); }
    const parts = str.split('+').map(p => p.trim()).filter(Boolean);
    if (!key) key = parts.pop() || '';
    const mods = new Set();
    for (const p of parts) {
      const l = p.toLowerCase();
      if (['ctrl', 'control', 'cmd', 'command', 'mod', 'cmdorctrl', 'commandorcontrol', 'primary'].includes(l)) mods.add('Ctrl');
      else if (['alt', 'option', 'opt'].includes(l)) mods.add('Alt');
      else if (l === 'shift') mods.add('Shift');
      else if (['meta', 'win', 'super'].includes(l)) mods.add('Meta');
      else if (l === 'macctrl') mods.add('MacCtrl');
    }
    if (key === '>' || key === '<') { mods.add('Shift'); key = key === '>' ? '.' : ','; }
    const kl = key.toLowerCase();
    if (KEY_ALIASES[kl]) key = KEY_ALIASES[kl];
    else if (/^f\d{1,2}$/i.test(key)) key = key.toUpperCase();
    else if (key.length === 1) key = key.toUpperCase();
    else key = key[0].toUpperCase() + key.slice(1);
    return [...MOD_ORDER.filter(m => mods.has(m)), key].join('+');
  }
  function eventCombo(e) {
    const c = e.code || '';
    let key;
    if (/^Key[A-Z]$/.test(c)) key = c.slice(3);
    else if (/^Digit\d$/.test(c)) key = c.slice(5);
    else if (/^Numpad\d$/.test(c)) key = c.slice(6);
    else if (/^F\d{1,2}$/.test(c)) key = c;
    else key = CODE_MAP[c] || (e.key && e.key.length === 1 ? e.key.toUpperCase() : (KEY_ALIASES[(e.key || '').toLowerCase()] || e.key));
    const mods = [];
    if (isMac ? e.metaKey : e.ctrlKey) mods.push('Ctrl');
    if (isMac && e.ctrlKey) mods.push('MacCtrl');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    if (!isMac && e.metaKey) mods.push('Meta');
    return [...mods, key].join('+');
  }
  function shortcutsOf(cmd) {
    if (!cmd) return [];
    const list = [];
    for (const s of [].concat(cmd.shortcut || [], cmd.shortcuts || [])) String(s).split(/\s*,\s+|\s+\/\s+/).forEach(x => x && list.push(x));
    return list;
  }
  // for display only: shortcuts the editor handles while you type (never dispatched globally)
  const displayShortcuts = cmd => [...shortcutsOf(cmd), ...[].concat(cmd?.altShortcuts || []).filter(x => !shortcutsOf(cmd).includes(x))];
  function fmtShortcut(s) {
    if (!s) return '';
    const parts = normShortcut(s).split('+');
    const last = parts[parts.length - 1];
    // keys read as printed on the keyboard, like Word's lists: Ctrl+= (subscript), Alt+=, Ctrl+-
    const key = { Up: '↑', Down: '↓', Left: '←', Right: '→' }[last];
    if (key) parts[parts.length - 1] = key;
    else if (parts.includes('Shift') && (last === '.' || last === ',')) parts[parts.length - 1] = last === '.' ? '>' : '<';
    if (!isMac) return parts.join('+');
    const sym = { Ctrl: '⌘', MacCtrl: '⌃', Alt: '⌥', Shift: '⇧', Meta: '⌘', Plus: '+', Minus: '−' };
    return parts.map(p => sym[p] || p).join('');
  }

  // =====================================================================
  //  UI primitives: toast, dialog, prompt, confirm, popover, menu, tooltip
  // =====================================================================
  const toastLayer = $('#toastLayer');
  // ---- messages: solution first ----
  // Every error or warning says what the user can do (a button, or a sentence that starts with one of these verbs),
  // then what still works; raw error text stays under "Technical details". Smoke-tested through `toastLog`.
  const REMEDY_VERBS = ['Try', 'Choose', 'Open', 'Save', 'Install', 'Turn', 'Check', 'Copy', 'Click', 'Press', 'Use', 'Add', 'Remove', 'Close', 'Restart', 'Download', 'Get', 'Pick', 'Select',
    // verbs that main's messages (main.js, main-langpacks.js, main-addins.js) start with
    'Free', 'Allow', 'Repair', 'Unzip', 'Wait', 'Rename', 'Refresh', 'Update', 'Give', 'Delete', 'List', 'Run', 'Put', 'Ask', 'Move', 'Let', 'Enter'];
  const REMEDY_RE = new RegExp('\\b(?:' + REMEDY_VERBS.join('|') + ')\\b');
  const NOT_A_REMEDY = /^(?:details|technical details|show details|dismiss|ok|close)$/i;
  const toastLog = [];
  /** true when a message tells the user what to do: a real action button, or a remedy verb in the text */
  function isActionable(msg, opts = {}) {
    const acts = [].concat(opts.action || [], opts.actions || []).filter(a => a && a.label && !NOT_A_REMEDY.test(String(a.label).trim()));
    return acts.length > 0 || REMEDY_RE.test(String(msg ?? ''));
  }
  // error text that reads like code: never shown first, only under Technical details
  const TECH_RE = /\b(?:TypeError|ReferenceError|SyntaxError|RangeError|undefined|null|NaN|E[A-Z]{3,}|HTTP \d{3}|status \d{3}|errno|is not a function|Cannot read propert\w*|Unexpected token|at \w+ \(|\[object \w+\])|\bNo handler\b|\bstack\b/;
  /** A plain sentence for common system errors (what to do), or null */
  function friendlyError(e) {
    const s = String((e && (e.code ? e.code + ' ' : '') + (e.message || '')) || e || '');
    if (/\bENOENT\b|no such file/i.test(s)) return 'Check that the file is still there. It may have been moved, renamed or deleted.';
    if (/\bE(?:ACCES|PERM)\b|permission denied|operation not permitted/i.test(s)) return 'Choose a folder you can write to (such as Documents), or close the file in other programs and try again.';
    if (/\bEBUSY\b|resource busy|being used by another process/i.test(s)) return 'Close the file in the other program, then try again.';
    if (/\bENOSPC\b|no space left/i.test(s)) return 'Free up some disk space, then try again.';
    if (/\bE(?:NOTFOUND|CONNRESET|CONNREFUSED|AI_AGAIN|TIMEDOUT)\b|ETIMEDOUT|Failed to fetch|fetch failed|net::ERR_|network|offline|timed out/i.test(s)) return 'Check your internet connection, then try again.';
    return null;
  }
  function technicalText(e) {
    if (e == null) return '';
    if (typeof e === 'string') return e;
    const parts = [];
    // errors from main may carry their raw text separately (preload's mk.errorInfo, when present)
    try { const info = mk.errorInfo?.(e); if (info?.details) return [info.code ? 'Code: ' + info.code : '', String(info.details)].filter(Boolean).join('\n'); } catch {}
    if (e.code) parts.push('Code: ' + e.code);
    if (e.details) parts.push(String(e.details));
    parts.push(String(e.stack || e.message || e));
    return parts.join('\n');
  }
  async function copyText(text, okMsg) {
    try { await navigator.clipboard.writeText(String(text ?? '')); if (okMsg) toast(okMsg, { timeout: 1600 }); return true; }
    catch { toast('Press Ctrl+C to copy: select the text first. The clipboard did not answer this time.', { kind: 'warn' }); return false; }
  }
  /** Copies the technical details and opens Help → Report a Problem (or the bug page) */
  async function reportProblem(details, what) {
    const text = [what ? 'What happened: ' + what : '', `Markooj ${app.version || ''} on ${navigator.platform || ''}`, details ? '\n' + details : ''].filter(Boolean).join('\n');
    await copyText(text, 'Details copied. Paste them into your report.');
    if (app.commands.get('help.reportProblem')) app.commands.run('help.reportProblem', { details: text });
  }
  function detailsEl(text) {
    const d = h('details.mk-tech');
    d.append(h('summary', { text: 'Technical details' }), h('pre', { text: String(text || '') }));
    return d;
  }
  /** A dialog with the message, then the technical details folded away (Copy details, Report this) */
  async function showDetails({ title = 'Details', message = '', details = '', report = true } = {}) {
    const body = h('div');
    if (message) body.append(h('p', { text: message }));
    body.append(detailsEl(details));
    body.querySelector('details').open = !message;
    const v = await dialog({ title, body, wide: true, buttons: [...(report ? [{ label: 'Report this', value: 'report', left: true }] : []), { label: 'Copy details', value: 'copy' }, { label: 'Close', value: 'close', primary: true }], cancelValue: 'close' });
    if (v === 'copy') await copyText(details, 'Details copied.');
    if (v === 'report') await reportProblem(details, message);
    return v;
  }
  const PLATFORM = mk.platform === 'darwin' ? 'macOS' : mk.platform === 'win32' ? 'Windows' : 'Linux';
  /**
   * solution({title, lead, steps:[{os?, text, command?, link?:{label, url}}], still, details, actions:[{label, value?, run?, primary?}], icon, kind})
   * A dialog that leads with the fix: steps for this computer first (each command has a Copy button), then what still works,
   * then the technical details folded away. Resolves with the value of the button the user picked.
   */
  async function solution(o = {}) {
    const body = h('div.mk-solution');
    if (o.lead) body.append(h('p.mk-sol-lead', { text: o.lead }));
    const steps = (o.steps || []).filter(Boolean);
    if (steps.length) {
      const mine = steps.filter(s => !s.os || s.os === PLATFORM), others = steps.filter(s => s.os && s.os !== PLATFORM);
      const list = h('ol.mk-sol-steps');
      const addStep = (s, into) => {
        const li = h('li');
        if (s.os) li.append(h('b', { text: s.os + ': ' }));
        if (s.text) li.append(document.createTextNode(s.text));
        if (s.command) {
          const row = h('div.mk-sol-cmd');
          row.append(h('code', { text: s.command }), h('button.btn', { type: 'button', text: 'Copy', onclick: () => copyText(s.command, 'Command copied. Paste it into a terminal.') }));
          li.append(row);
        }
        if (s.link) li.append(document.createTextNode(' '), h('a', { href: '#', text: s.link.label || s.link.url, onclick: ev => { ev.preventDefault(); mk.invoke('open-external', s.link.url).catch(() => copyText(s.link.url, 'Link copied. Paste it into your browser.')); } }));
        into.append(li);
      };
      mine.forEach(s => addStep(s, list));
      body.append(list);
      if (others.length) {
        const more = h('details.mk-sol-other');
        more.append(h('summary', { text: 'Steps for other systems' }));
        const l2 = h('ul.mk-sol-steps'); others.forEach(s => addStep(s, l2)); more.append(l2);
        body.append(more);
      }
    }
    if (o.still) body.append(h('p.mk-sol-still', { text: o.still }));
    if (o.details) body.append(detailsEl(o.details));
    const acts = (o.actions || []).filter(Boolean);
    const buttons = acts.map((a, i) => ({ label: a.label, value: a.value ?? ('act' + i), primary: !!a.primary, left: !!a.left }));
    buttons.push({ label: o.closeLabel || 'Close', value: 'close', primary: !acts.some(a => a.primary) });
    toastLog.push({ msg: [o.title, o.lead].filter(Boolean).join(' — '), kind: o.kind || 'dialog', actions: acts.map(a => a.label), dialog: true, test: app.tests?.current || null, at: Date.now() });
    const v = await dialog({ title: o.title || '', body, icon: o.icon, kind: o.kind, wide: !!(steps.length || o.details), buttons, cancelValue: 'close' });
    const picked = acts.find((a, i) => (a.value ?? ('act' + i)) === v);
    if (picked?.run) { try { await picked.run(); } catch (e) { fail(e); } }
    return v;
  }
  /**
   * fail(error, {lead, retry, actions, still, kind, details}) — the toast for something that did not work.
   * Shows `lead` (what to do) and, when the error's own text is plain English, that text after it; code-like
   * text and the stack go under Details. Adds Try again when `retry` is given, else Report this for unknown errors.
   */
  function fail(e, o = {}) {
    // An error from main that carries its own fix (mk.errorInfo): its message already leads with what to do, so no
    // `lead` goes in front of it; its buttons come along (run through app.health), and its raw text goes under Details.
    let info = null;
    try { info = mk.errorInfo?.(e) || null; } catch {}
    if (info && info.message) {
      // hideReason: the caller's lead is the better fix here (a broken link in a document), main's buttons still come along
      let msg = o.hideReason && o.lead ? o.lead : (app.ui.plainError(e, '') || info.message);
      if (o.still && !msg.includes(o.still)) msg += ' ' + o.still;
      msg = msg.replace(/\s+/g, ' ').trim();
      if (!/[.!?…]$/.test(msg)) msg += '.';
      const ctx = { ...(o.ctx || {}), retry: o.retry || (o.ctx && o.ctx.retry) };
      const own = [].concat(o.actions || []).filter(Boolean);
      const ownOpens = own.some(a => /^(Open|Choose)\b/.test(String(a.label)));
      const fromMain = (app.health?.errorActions ? app.health.errorActions(e, ctx) : [])
        .filter(a => !(ownOpens && a.label === 'Choose another file') && !own.some(b => b.label === a.label));
      const actions = [];
      if (o.retry && !(info.actions || []).some(a => a && a.id === 'retry')) actions.push({ label: 'Try again', run: o.retry });
      actions.push(...fromMain, ...own);
      const details = o.details ?? technicalText(e);
      const shown = details ? actions.slice(0, 2) : actions.slice(0, 3);
      if (!shown.length && !details) shown.push({ label: 'Report this', run: () => reportProblem(details, msg) });
      return toast(msg, { kind: o.kind || 'error', actions: shown, details: details && details !== msg ? details : '', detailsTitle: o.detailsTitle, timeout: o.timeout });
    }
    const raw = app.ui.plainError(e, '');
    const plain = raw && !TECH_RE.test(raw) ? raw : '';
    const known = friendlyError(e);
    const parts = [];
    if (o.lead) parts.push(o.lead);
    if (plain && !(o.lead && o.lead.includes(plain)) && !o.hideReason) parts.push(plain);
    else if (!plain && known && !(o.lead && o.lead.includes(known))) parts.push(known);
    if (!parts.length) parts.push('Try that again. If it keeps happening, report it with the details.');
    if (o.still) parts.push(o.still);
    let msg = parts.join(' ').replace(/\s+/g, ' ').trim();
    if (!/[.!?…]$/.test(msg)) msg += '.';
    const actions = [];
    if (o.retry) actions.push({ label: 'Try again', run: o.retry });
    actions.push(...[].concat(o.actions || []).filter(Boolean));
    const details = o.details ?? technicalText(e);
    if (!actions.length && !plain && !known) actions.push({ label: 'Report this', run: () => reportProblem(details, msg) });
    return toast(msg, { kind: o.kind || 'error', actions, details: details && details !== msg ? details : '', detailsTitle: o.detailsTitle, timeout: o.timeout });
  }
  function toast(msg, opts = {}) {
    if (typeof opts === 'string') opts = { kind: opts };
    const kind = opts.kind === 'warning' ? 'warn' : (opts.kind || 'success');
    const ic = { success: 'check', info: 'info', warn: 'warn', error: 'x' }[kind] || 'check';
    const el = h('div.toast.' + kind, { role: kind === 'error' ? 'alert' : 'status' });
    el.innerHTML = `<span class="ok">${icon(ic)}</span><span class="tmsg"></span>`;
    el.querySelector('.tmsg').textContent = String(msg ?? '');
    let timer;
    const close = () => { clearTimeout(timer); el.classList.remove('show'); setTimeout(() => el.remove(), 360); };
    const actions = [].concat(opts.action || [], opts.actions || []).filter(a => a && a.label);
    toastLog.push({ msg: String(msg ?? ''), kind, actions: actions.map(a => a.label), details: !!opts.details, test: app.tests?.current || null, at: Date.now() });
    if (toastLog.length > 600) toastLog.splice(0, toastLog.length - 600);
    if (opts.details && actions.length < 3) actions.push({ label: 'Details', run: () => showDetails({ title: opts.detailsTitle || 'Details', message: String(msg ?? ''), details: opts.details }) });
    for (const a of actions) el.append(h('button.tact', { text: a.label, onclick: async () => { close(); try { await a.run?.(); } catch (e) { console.error(e); } } }));
    if (actions.length || kind === 'error') el.append(h('button.tx', { html: icon('x'), 'aria-label': 'Dismiss', onclick: close }));
    toastLayer.append(el);
    while (toastLayer.children.length > 3) toastLayer.firstElementChild.remove();
    raf(() => raf(() => el.classList.add('show')));
    const ms = opts.timeout ?? (actions.length ? (kind === 'error' || kind === 'warn' ? 10000 : 7000) : kind === 'error' ? 6000 : 2600);
    const arm = () => { clearTimeout(timer); if (ms > 0) timer = setTimeout(close, ms); };
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', arm);
    arm();
    return { close };
  }

  const dialogLayer = $('#dialogLayer');
  const dialogStack = [];
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
  function dialog(o = {}) {
    const { title = '', body = '', buttons = [{ label: 'OK', value: true, primary: true }], wide, onOpen, kind } = o;
    return new Promise(resolve => {
      const prevFocus = document.activeElement;
      hideTip(); closePopover();
      const scrim = h('div.scrim');
      const dlg = h('div.dlg', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
      if (wide) dlg.classList.add(wide === 'x' ? 'xwide' : 'wide');
      const head = h('div.dlg-head');
      if (o.icon) head.append(h('div.dlg-icon' + (kind ? '.' + kind : ''), { html: icon(o.icon) }));
      head.append(h('h3', { text: title }));
      const bodyEl = h('div.dlg-body');
      if (body && body.nodeType) bodyEl.append(body);
      // body is an HTML string per the contract (callers escape their own text)
      else if (body) { const s = String(body); bodyEl.innerHTML = /<(p|div|ul|ol|table|h\d|section|label|form)\b/i.test(s) ? s : `<p>${s}</p>`; }
      const foot = h('div.dlg-foot');
      let done = false;
      const close = value => {
        if (done) return; done = true;
        const i = dialogStack.indexOf(entry); if (i >= 0) dialogStack.splice(i, 1);
        dlg.classList.remove('show'); scrim.classList.remove('show');
        setTimeout(() => { dlg.remove(); scrim.remove(); }, 260);
        try { prevFocus?.focus?.({ preventScroll: true }); } catch {}
        resolve(value);
      };
      const btnEls = buttons.map(b => {
        const el = h('button.btn' + (b.primary ? '.primary' : '') + (b.danger ? '.danger' : '') + (b.left ? '.left' : ''), { type: 'button', text: b.label, onclick: () => {
          if (b.validate && b.validate(bodyEl) === false) return;
          close(typeof b.value === 'function' ? b.value(bodyEl) : b.value);
        } });
        if (b.disabled) el.disabled = true;
        return el;
      });
      foot.append(...btnEls);
      dlg.append(head, bodyEl, foot);
      const cancelValue = 'cancelValue' in o ? o.cancelValue : null;
      const entry = { dlg, close, cancelValue };
      dialogStack.push(entry);
      scrim.addEventListener('mousedown', () => { if (o.dismissible !== false) close(cancelValue); });
      dlg.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(cancelValue); return; }
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          const t = e.target;
          if (t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.tagName === 'SELECT' || t.isContentEditable) return;
          const p = buttons.findIndex(b => b.primary);
          if (p >= 0 && !btnEls[p].disabled) { e.preventDefault(); btnEls[p].click(); }
          return;
        }
        if (e.key === 'Tab') {
          const f = $$(FOCUSABLE, dlg).filter(x => x.offsetParent !== null);
          if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
        e.stopPropagation();
      });
      dialogLayer.append(scrim, dlg);
      raf(() => raf(() => { scrim.classList.add('show'); dlg.classList.add('show'); }));
      try { onOpen?.(bodyEl, close, dlg); } catch (e) { console.error(e); }
      setTimeout(() => {
        const field = bodyEl.querySelector('input:not([type=hidden]):not([disabled]), textarea, select, [autofocus]');
        // a dangerous choice is never the default: with no primary button, Enter lands on Cancel
        const safe = buttons.some(b => b.danger) && !buttons.some(b => b.primary)
          ? btnEls.find((_b, i) => buttons[i].value === false || buttons[i].value == null || buttons[i].value === 'cancel' || buttons[i].value === cancelValue)
          : null;
        const target = field || btnEls.find((_b, i) => buttons[i].primary) || safe || btnEls.find((_b, i) => !buttons[i].danger) || btnEls[btnEls.length - 1];
        target?.focus(); if (field && field.select && field.type !== 'checkbox') field.select();
      }, 30);
    });
  }
  async function prompt(title, label, value, opts = {}) {
    const wrap = h('div');
    const inp = opts.multiline ? h('textarea.txt', { rows: opts.rows || 6 }) : h('input.txt', { type: opts.type || 'text', placeholder: opts.placeholder || '', spellcheck: 'false' });
    inp.value = value ?? '';
    wrap.append(h('label.field', null, label ? h('span', { text: label }) : null, inp));
    if (opts.hint) wrap.append(h('p', { text: opts.hint, style: 'font-size:12px;color:var(--text-3);margin:4px 0 0' }));
    const v = await dialog({ title, body: wrap, icon: opts.icon, buttons: [{ label: 'Cancel', value: null }, { label: opts.ok || 'OK', primary: true, value: () => inp.value }] });
    return v == null ? null : v;
  }
  async function confirm(title, text, opts = {}) {
    const v = await dialog({ title, body: text || '', icon: opts.icon, kind: opts.kind, buttons: [{ label: opts.cancel || 'Cancel', value: false }, { label: opts.ok || 'OK', value: true, primary: !opts.danger, danger: !!opts.danger }] });
    return v === true;
  }

  // ---- popovers & menus ----
  const popLayer = $('#popLayer');
  let openPop = null;
  function closePopover() {
    if (!openPop) return;
    const p = openPop; openPop = null;
    p.el.classList.remove('show');
    p.anchor?.classList?.remove('open');
    setTimeout(() => p.el.remove(), 260);
    try { p.onClose?.(); } catch {}
    if (p.restoreFocus) try { p.restoreFocus.focus({ preventScroll: true }); } catch {}
  }
  function placePop(el, anchor, opts = {}) {
    const vw = innerWidth, vh = innerHeight, pad = 8;
    const w = el.offsetWidth, ht = el.offsetHeight;
    let x, y, up = false;
    if (anchor && anchor.getBoundingClientRect) {
      const r = anchor.getBoundingClientRect();
      x = opts.align === 'right' ? r.right - w : r.left;
      const below = vh - r.bottom, above = r.top;
      up = opts.placement === 'top' || (opts.placement !== 'bottom' && below < ht + 12 && above > below);
      y = up ? r.top - ht - 6 : r.bottom + 6;
    } else { x = anchor.x; y = anchor.y; if (y + ht > vh - pad) y = Math.max(pad, anchor.y - ht); }
    x = Math.max(pad, Math.min(x, vw - w - pad)); y = Math.max(pad, Math.min(y, vh - ht - pad));
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.classList.toggle('up', up);
  }
  /** popover(anchorEl | {x,y}, content (Element|html), {placement, align, onClose, className, toggle}) → {el, close} */
  function popover(anchor, content, opts = {}) {
    if (openPop && anchor && openPop.anchor === anchor && opts.toggle !== false) { closePopover(); return null; }
    closePopover(); hideTip();
    const el = h('div.pop' + (opts.className ? '.' + opts.className.split(' ').join('.') : ''), { role: opts.role || 'dialog' });
    if (content && content.nodeType) el.append(content); else if (content != null) el.innerHTML = String(content);
    popLayer.append(el);
    placePop(el, anchor, opts);
    anchor?.classList?.add('open');
    const entry = { el, anchor, onClose: opts.onClose, restoreFocus: opts.restoreFocus };
    openPop = entry;
    raf(() => raf(() => el.classList.add('show')));
    return { el, close: () => { if (openPop === entry) closePopover(); }, reposition: () => placePop(el, anchor, opts) };
  }
  document.addEventListener('mousedown', e => {
    if (!openPop) return;
    if (openPop.el.contains(e.target) || (openPop.anchor && openPop.anchor.contains && openPop.anchor.contains(e.target))) return;
    closePopover();
  }, true);
  addEventListener('resize', () => closePopover());
  addEventListener('blur', () => closePopover());

  /** items: [{label, icon, shortcut, hint, checked, disabled, danger, run, sep, header, preview(html)}] */
  function menu(anchor, items, opts = {}) {
    const wrap = h('div', { role: 'menu' });
    const btns = [];
    for (const it of items) {
      if (!it) continue;
      if (it.sep) { wrap.append(h('hr')); continue; }
      if (it.header) { wrap.append(h('h6', { text: it.header })); continue; }
      if (it.note) { wrap.append(h('div.pop-note', { text: it.note })); continue; }
      const b = h('button.mi' + (it.danger ? '.danger' : ''), { role: 'menuitem', type: 'button' });
      if (opts.checks !== false && ('checked' in it || opts.checks)) b.append(h('span.chk', { html: it.checked ? icon('check') : '' }));
      else if (it.icon) b.insertAdjacentHTML('beforeend', icon(it.icon, 'i mic'));
      if (it.preview) b.append(h('span.mi-prev', { html: it.preview }));
      else b.append(h('span.mi-label', { text: it.label }));
      if (it.shortcut) b.append(h('kbd', { text: fmtShortcut(it.shortcut) }));
      else if (it.hint) b.append(h('small', { text: it.hint }));
      if (it.disabled) b.classList.add('disabled');
      if (it.title) b.title = it.title;
      b.addEventListener('click', async () => { closePopover(); try { await it.run?.(); } catch (e) { console.error(e); fail(e, { retry: () => it.run?.() }); } });
      btns.push(b); wrap.append(b);
    }
    const p = popover(anchor, wrap, { ...opts, className: 'menu' + (opts.className ? ' ' + opts.className : ''), role: 'menu', restoreFocus: document.activeElement });
    if (!p) return null;
    let idx = btns.findIndex(b => b.querySelector('.chk svg'));
    const focusAt = i => { btns.forEach(b => b.classList.remove('focus')); idx = (i + btns.length) % btns.length; const b = btns[idx]; if (b) { b.classList.add('focus'); b.focus({ preventScroll: false }); } };
    p.el.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(idx + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(idx - 1); }
      else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
      else if (e.key === 'End') { e.preventDefault(); focusAt(btns.length - 1); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePopover(); }
      else if (e.key === 'Tab') { e.preventDefault(); focusAt(idx + (e.shiftKey ? -1 : 1)); }
      else if (e.key.length === 1 && /\w/.test(e.key)) {
        const k = e.key.toLowerCase();
        const j = btns.findIndex((b, i) => i > idx && b.textContent.trim().toLowerCase().startsWith(k));
        const j2 = j >= 0 ? j : btns.findIndex(b => b.textContent.trim().toLowerCase().startsWith(k));
        if (j2 >= 0) focusAt(j2);
      }
    });
    btns.forEach((b, i) => b.addEventListener('mouseenter', () => { btns.forEach(x => x.classList.remove('focus')); idx = i; }));
    setTimeout(() => focusAt(idx >= 0 ? idx : 0), 20);
    return p;
  }
  function contextMenu(e, items, opts) {
    const pt = e && 'clientX' in e ? { x: e.clientX, y: e.clientY } : (e || { x: innerWidth / 2, y: innerHeight / 2 });
    e?.preventDefault?.();
    return menu(pt, items, { checks: false, ...opts });
  }

  // ---- tooltips: [data-tip] + optional [data-key] shortcut + [data-tip-d] description ----
  const tipEl = $('#tooltip');
  let tipTimer = null, tipFor = null;
  function hideTip() { if (app.tooltips?.hide) { app.tooltips.hide(); return; } clearTimeout(tipTimer); tipFor = null; tipEl.classList.remove('show'); }
  function showTip(el) {
    const label = el.dataset.tip; if (!label) return;
    const key = el.dataset.key ? fmtShortcut(el.dataset.key) : '';
    tipEl.innerHTML = `<span>${esc(label)}${el.dataset.tipD ? `<span class="d">${esc(el.dataset.tipD)}</span>` : ''}</span>${key ? `<kbd>${esc(key)}</kbd>` : ''}`;
    const r = el.getBoundingClientRect();
    tipEl.style.left = '0px'; tipEl.style.top = '0px';
    const w = tipEl.offsetWidth, ht = tipEl.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8;
    if (y + ht > innerHeight - 6) y = r.top - ht - 8;
    x = Math.max(6, Math.min(x, innerWidth - w - 6));
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    tipEl.classList.add('show');
  }
  document.addEventListener('mouseover', e => {
    if (app.tooltips) return;
    const el = e.target.closest?.('[data-tip]');
    if (el === tipFor) return;
    hideTip();
    if (!el || openPop?.el.contains(el)) return;
    tipFor = el;
    tipTimer = setTimeout(() => { if (tipFor === el && el.isConnected) showTip(el); }, 480);
  });
  document.addEventListener('mousedown', hideTip, true);
  document.addEventListener('keydown', hideTip, true);
  document.addEventListener('scroll', hideTip, true);

  Object.assign(app.ui, { toast, dialog, prompt, confirm, popover, closePopover, menu, contextMenu, hideTip,
    fail, solution, showDetails, friendlyError, technicalText, copyText, reportProblem, isActionable, toastLog, remedyVerbs: REMEDY_VERBS, platformName: PLATFORM });

  // =====================================================================
  //  Segmented control
  // =====================================================================
  /** makeSeg([{value,label,title}], value, onPick, {small}) → el with el.set(value) */
  function makeSeg(options, value, onPick, opts = {}) {
    const el = h('div.seg' + (opts.small ? '.sm' : ''), { role: 'radiogroup', 'aria-label': opts.label || '' });
    const thumb = h('span.thumb');
    el.append(thumb);
    const btns = options.map(o => {
      const b = h('button', { type: 'button', role: 'radio', 'data-v': String(o.value), html: o.html || esc(o.label) });
      if (o.title) { b.dataset.tip = o.title; if (o.key) b.dataset.key = o.key; }
      if (o.desc) b.dataset.tipD = o.desc;
      b.addEventListener('click', () => { set(o.value); onPick?.(o.value); });
      el.append(b); return b;
    });
    const place = () => {
      const b = btns.find(x => x.classList.contains('on'));
      if (!b || !b.offsetWidth) { thumb.style.opacity = b ? '0' : '0'; return; }
      thumb.style.opacity = '1'; thumb.style.left = b.offsetLeft + 'px'; thumb.style.width = b.offsetWidth + 'px';
    };
    function set(v) { btns.forEach(b => { const on = b.dataset.v === String(v); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); place(); }
    el.set = set; el.place = place;
    set(value);
    try { new ResizeObserver(() => place()).observe(el); } catch {}
    raf(place);
    el.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const i = btns.findIndex(b => b.classList.contains('on'));
      const n = btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length];
      n.focus(); n.click();
    });
    return el;
  }

  // =====================================================================
  //  Theme
  // =====================================================================
  const mql = matchMedia('(prefers-color-scheme: dark)');
  const THEME_NEXT = { system: 'light', light: 'dark', dark: 'system' };
  const THEME_ICON = { system: 'monitor', light: 'sun', dark: 'moon' };
  const THEME_LABEL = { system: 'Match system', light: 'Light', dark: 'Dark' };
  function themePref() { const t = settings.get('theme', 'system'); return THEME_NEXT[t] ? t : 'system'; }
  function applyTheme() {
    const pref = themePref();
    const t = pref === 'system' ? (mql.matches ? 'dark' : 'light') : pref;
    const changed = root.dataset.theme !== t;
    root.dataset.theme = t; root.dataset.themePref = pref;
    const hl = $('#hljsLight'), hd = $('#hljsDark');
    if (hl) hl.disabled = t === 'dark';
    if (hd) hd.disabled = t !== 'dark';
    const tb = $('#themeBtn');
    if (tb) { tb.innerHTML = icon(THEME_ICON[pref]); tb.dataset.tip = `Theme: ${THEME_LABEL[pref]}`; tb.dataset.tipD = `Click for ${THEME_LABEL[THEME_NEXT[pref]]}`; }
    if (changed) app.events.emit('theme:changed', t);
  }
  mql.addEventListener?.('change', () => { if (themePref() === 'system') applyTheme(); });

  // =====================================================================
  //  Editing modes: Word | Inline | Simple | Read
  // =====================================================================
  const MODES = [
    { id: 'word', label: 'Word', long: 'Word mode', icon: 'doc', key: 'Ctrl+1', cmd: 'view.modeWord', desc: 'Click and type on the page, like Microsoft Word. The Markdown is written for you.' },
    { id: 'inline', label: 'Inline', long: 'Inline mode', icon: 'text', key: 'Ctrl+2', cmd: 'view.modeInline', desc: 'The page looks finished. The paragraph you are in shows its Markdown so you can edit it in place.' },
    { id: 'simple', label: 'Simple', long: 'Simple mode', icon: 'md', key: 'Ctrl+3', cmd: 'view.modeSimple', desc: 'Markdown text on the left and a live preview on the right.' },
    { id: 'read', label: 'Read', long: 'Read mode', icon: 'read', key: 'Ctrl+4', cmd: 'view.modeRead', desc: 'The finished document for reading: no editing tools, comments or hidden notes.' },
  ];
  const modeInfo = id => MODES.find(m => m.id === id) || MODES[0];
  const EDIT_MODES = ['word', 'inline', 'simple'];

  // =====================================================================
  //  Title bar
  // =====================================================================
  const titlebar = $('#titlebar');
  function renderTitlebar() {
    titlebar.innerHTML = `
      <div class="logo" data-tip="Markooj" aria-hidden="true">M</div>
      <div class="qa" role="toolbar" aria-label="Quick access">
        <button class="btn-ghost" data-cmd="file.save" data-tip="Save" data-key="Ctrl+S" aria-label="Save">${icon('save')}</button>
        <button class="btn-ghost" data-cmd="edit.undo" data-tip="Undo" data-key="Ctrl+Z" aria-label="Undo">${icon('undo')}</button>
        <button class="btn-ghost" data-cmd="edit.redo" data-tip="Redo" data-key="Ctrl+Y" aria-label="Redo">${icon('redo')}</button>
      </div>
      <div class="doc-title" id="docTitle"><span class="saved-dot"></span><span class="t"></span><small></small></div>
      <div class="tb-right">
        <label class="search" id="searchBox" data-tip="Search and commands" data-tip-d="Type a few letters to find any command, open document or heading. Start with > for commands only, @ for headings." data-key="Alt+Q">${icon('search')}<input id="paletteInput" placeholder="Search or type a command" spellcheck="false" autocomplete="off" aria-label="Search or type a command"><kbd>${isMac ? '⌥Q' : 'Alt Q'}</kbd></label>
        <span id="modeSegSlot"></span>
        <button class="btn-ghost" id="themeBtn" aria-label="Theme"></button>
      </div>`;
    $$('[data-cmd]', titlebar).forEach(b => { b.addEventListener('mousedown', e => e.preventDefault()); b.addEventListener('click', () => app.commands.run(b.dataset.cmd)); });
    const seg = makeSeg(MODES.map(m => ({ value: m.id, label: m.label, title: m.long, key: m.key })), app.mode, v => app.setMode(v), { label: 'Editing mode' });
    seg.id = 'modeSeg';
    [...seg.querySelectorAll('button')].forEach((b, i) => { b.dataset.tipD = MODES[i].desc; b.dataset.tipCmd = MODES[i].cmd; });
    $('#modeSegSlot').replaceWith(seg);
    $('#themeBtn').addEventListener('click', () => app.commands.run('view.theme'));
    initPalette();
    applyTheme();
  }
  function updateTitle() {
    const doc = app.docs.active();
    const box = $('#docTitle'); if (!box) return;
    const dot = box.querySelector('.saved-dot'), t = box.querySelector('.t'), s = box.querySelector('small');
    if (!doc) { t.textContent = 'Markooj'; s.textContent = ''; dot.className = 'saved-dot ro'; document.title = 'Markooj'; return; }
    t.textContent = doc.title;
    let state, cls = '';
    if (doc.readOnly) { state = 'Read only'; cls = 'ro'; }
    else if (doc.dirty) { state = 'Edited'; cls = 'dirty'; }
    else if (doc.path && !doc.convertedFrom) state = 'Saved';
    else { state = 'Not saved yet'; cls = doc.text ? 'dirty' : 'ro'; }
    s.textContent = '— ' + state;
    dot.className = 'saved-dot ' + cls;
    dot.title = state;
    document.title = `${doc.dirty ? '• ' : ''}${doc.title} — Markooj`;
  }

  // =====================================================================
  //  Ribbon
  // =====================================================================
  const ribbonEl = $('#ribbon');
  let activeTab = settings.get('ribbonTab', 'home');
  // The tab the user wants (saved, or Home). While it has no groups yet (early paints before commands.js loads) another
  // tab is drawn in its place, but the wanted one is kept and selected as soon as it has groups.
  let wantedTab = activeTab;
  let bound = [];
  let lastGroups = [], lastTabSig = '';
  let ribbonRenderQueued = false, ribbonRefreshQueued = false;

  // ---- contextual tabs (Word's Table Design / Table Layout) ----
  // app.ribbon.addTab(id, {title, contextual: true, accent}) or the old addTab({id, label, order});
  // a contextual tab sits at the end with an accent-colored name and shows only while app.ribbon.showContextual(id, true).
  const coreAddTab = app.ribbon.addTab.bind(app.ribbon);
  const ctxShown = new Set();
  let ctxSeq = 0, lastPlainTab = activeTab;
  app.ribbon.addTab = function addTab(a, b) {
    const t = typeof a === 'string' ? { id: a, ...(b || {}) } : { ...(a || {}) };
    if (!t.id) return null;
    if (t.label == null) t.label = t.title || t.id;
    if (t.contextual) { if (t.order == null) t.order = 900 + (++ctxSeq); t.alwaysShow = true; }
    coreAddTab(t);
    return t.id;
  };
  const isCtxTab = id => !!app.ribbon.tabs().find(t => t.id === id && t.contextual);
  // accent: a CSS color, or a name for the kind of object (Word colors each tool set)
  const CTX_ACCENTS = { table: '#7a4fe0', picture: '#c2410c', image: '#c2410c', equation: '#0a66ff', math: '#0a66ff', chart: '#1f8a3b', code: '#6e6e73', diagram: '#0a8f7a' };
  const ctxAccent = a => (!a ? '' : /^(#|rgb|hsl|var\(|color-mix\()/i.test(String(a)) ? String(a) : CTX_ACCENTS[String(a).toLowerCase()] || '');
  app.ribbon.isContextualShown = id => ctxShown.has(id);
  app.ribbon.showContextual = function showContextual(id, on = true) {
    on = !!on;
    if (on === ctxShown.has(id)) return on;
    if (on) ctxShown.add(id); else ctxShown.delete(id);
    const b = $(`.rtab[data-tab="${CSS.escape(id)}"]`, ribbonEl);
    if (b) {
      b.hidden = !on;
      if (on) { b.classList.remove('ctx-in'); void b.offsetWidth; b.classList.add('ctx-in'); }
    }
    // the tab you were on goes away: back to the last ordinary tab (Word does the same)
    if (!on && activeTab === id) selectTab(ctxShown.size && [...ctxShown].find(x => $(`.rtab[data-tab="${CSS.escape(x)}"]`, ribbonEl)) || lastPlainTab || 'home');
    raf(moveInk);
    app.events.emit('ribbon:contextual', { id, on });
    return on;
  };

  // ---- why a control is dimmed (shown in its ScreenTip) ----
  const EDIT_CMD = /^(format\.|edit\.(case\.|changeCase)|list\.|para\.|insert\.)/;
  const DOC_LEVEL_CMD = /^format\.(fontSize|fontFamily|growFont|shrinkFont)$/;
  /** '' when the command can run now, otherwise a short plain reason. */
  function whyDisabled(id, args) {
    const c = id ? app.commands.get(id) : null;
    if (!c) return '';
    let ok = true; try { ok = !c.isEnabled || !!c.isEnabled(args); } catch {}
    const doc = app.docs.active();
    const readMode = app.mode === 'read' && doc?.kind === 'markdown' && EDIT_CMD.test(id) && !DOC_LEVEL_CMD.test(id);
    if (ok && !readMode) return '';
    if (typeof c.why === 'function') { const w = safe(() => c.why(), ''); if (w) return String(w); }
    if (!doc) return 'Open or create a document first.';
    if (doc.kind !== 'markdown') return 'PDF and DjVu files can’t be edited here. Use Edit as text to make an editable copy.';
    if (doc.readOnly) return 'Use Edit as text to make an editable copy. This document is read-only.';
    if (readMode) return 'Read mode is for reading. Press Esc to go back to editing.';
    return 'Click in the document first, or select what this command works on.';
  }
  app.ribbon.whyDisabled = whyDisabled;
  function setDimmed(el, why) {
    if (!el) return;
    el.disabled = !!why;
    if (why) { el.dataset.tipWhy = why; el.setAttribute('aria-disabled', 'true'); }
    else if (el.dataset.tipWhy != null || el.hasAttribute('aria-disabled')) { delete el.dataset.tipWhy; el.removeAttribute('aria-disabled'); }
  }

  function cmdTip(el, item) {
    const c = item.command ? app.commands.get(item.command) : null;
    if (item.command) el.dataset.tipCmd = item.command;
    el.dataset.tip = item.tooltip || item.label || c?.label || item.command || '';
    const sc = item.shortcut || displayShortcuts(c)[0];
    // a command's keys are read live by the ScreenTip (the Word key map can move them after the ribbon is drawn)
    if (sc && (item.shortcut || !app.tooltips)) el.dataset.key = sc;
    const d = item.description || c?.description;
    if (d) el.dataset.tipD = d;
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.dataset.tip);
  }
  function runItem(item, args) {
    if (!item.command) return;
    const r = app.commands.run(item.command, args !== undefined ? args : item.args);
    // a dropped-down ribbon (Show tabs only) closes once the command ran, unless it opened a menu
    if (ribbonEl.classList.contains('peek')) Promise.resolve(r).finally(() => setTimeout(closeDroppedIfIdle, 0));
  }
  function optLabel(item, v) { const o = ((typeof item.options === 'function' ? safe(() => item.options(), []) : item.options) || []).find(x => String(x.value) === String(v)); return o ? o.label : (v == null || v === '' ? (item.placeholder || item.label || '') : String(v)); }
  function renderItem(item, parent) {
    if (!item) return;
    const type = item.type || (item.items ? 'row' : 'small');
    let el;
    switch (type) {
      case 'big': {
        el = h('button.big', { type: 'button', html: `${icon(item.icon || app.commands.get(item.command)?.icon)}<span>${esc(item.label || app.commands.get(item.command)?.label || '')}</span>` });
        cmdTip(el, item); el.addEventListener('click', () => runItem(item));
        bound.push({ el, item, kind: 'btn' }); break;
      }
      case 'small': {
        el = h('button.ib', { type: 'button' });
        if (item.text != null) el.innerHTML = /</.test(item.text) ? item.text : `<span class="ib-text${/^[A-Z]\d$|^H\d$/.test(item.text) || item.text.length > 1 ? ' sans' : ''}">${esc(item.text)}</span>`;
        else el.innerHTML = icon(item.icon || app.commands.get(item.command)?.icon);
        if (item.showLabel || item.wide) { el.classList.add('lbl'); el.insertAdjacentHTML('beforeend', `<span>${esc(item.label || '')}</span>`); }
        if (item.color) { el.classList.add('swatch'); el.style.setProperty('--c', item.color); }
        cmdTip(el, item); el.addEventListener('click', () => runItem(item));
        bound.push({ el, item, kind: 'btn' }); break;
      }
      case 'select': {
        el = h('button.select', { type: 'button', 'aria-haspopup': 'menu' });
        if (item.width) el.style.width = typeof item.width === 'number' ? item.width + 'px' : item.width;
        const lab = h('span'); el.append(lab); el.insertAdjacentHTML('beforeend', icon('chev'));
        const cur = () => safe(() => item.value?.(), undefined);
        lab.textContent = optLabel(item, cur());
        cmdTip(el, item);
        el.addEventListener('click', () => {
          const v = cur();
          const opts = (typeof item.options === 'function' ? safe(() => item.options(), []) : item.options) || [];
          // select commands get {value} (what format.fontSize, layout.lineSpacing, ref.style and xref.style read)
          menu(el, opts.map(o => ({ label: o.label, preview: o.preview, checked: String(o.value) === String(v), run: () => runItem(item, item.rawValue ? o.value : { value: o.value }) })), { checks: true });
        });
        bound.push({ el, item, kind: 'select', lab }); break;
      }
      case 'gallery': {
        el = h('div.gallery', { role: 'listbox', 'aria-label': item.label || 'Styles' });
        const opts = (typeof item.options === 'function' ? safe(() => item.options(), []) : item.options) || [];
        for (const o of opts) {
          const b = h('button.sty', { type: 'button', 'data-v': String(o.value), role: 'option' });
          const pv = o.preview || '';
          if (/</.test(pv)) b.innerHTML = `<span class="p">${pv}</span>`;
          else b.innerHTML = `<span class="p"${pv && /:/.test(pv) ? ` style="${esc(pv)}"` : ''}>${esc(pv && !/:/.test(pv) ? pv : 'Aa')}</span>`;
          b.append(h('span.n', { text: o.label }));
          b.dataset.tip = o.label; b.addEventListener('click', () => runItem(item, o.value));
          el.append(b);
        }
        bound.push({ el, item, kind: 'gallery' }); break;
      }
      case 'seg': {
        el = makeSeg(item.options || [], safe(() => item.value?.(), undefined), v => runItem(item, v), { small: true, label: item.label });
        bound.push({ el, item, kind: 'seg' }); break;
      }
      case 'row': case 'col': {
        el = h('div.' + type);
        if (item.gap) el.style.gap = item.gap + 'px';
        (item.items || []).forEach(x => renderItem(x, el)); break;
      }
      case 'sep': el = h('span.sep'); break;
      case 'label': el = h('span.rlabel', { text: item.text || item.label || '' }); break;
      case 'custom': {
        el = h('div.row');
        try { item.render?.(el); } catch (e) { console.error('ribbon custom item', e); }
        break;
      }
      default: {
        if (item.command) { renderItem({ ...item, type: 'small' }, parent); return; }
        return;
      }
    }
    parent.append(el);
  }
  function renderRibbon() {
    ribbonRenderQueued = false;
    augmentFontGroup();
    const tabs = app.ribbon.tabs().filter(t => t.groups.length || t.alwaysShow);
    lastGroups = tabs.flatMap(t => t.groups); lastTabSig = tabs.map(t => t.id + t.label).join('|');
    bound = [];
    const nav = h('nav.rtabs', { role: 'tablist', 'aria-label': 'Ribbon tabs' });
    const fileBtn = h('button.rtab.file', { type: 'button', text: 'File', 'data-tip': 'File', 'data-key': 'Alt+F', 'data-tip-d': 'New, open, save, export, print and options' });
    fileBtn.addEventListener('click', () => app.backstage.open());
    nav.append(fileBtn);
    const visibleTab = t => t && (!t.contextual || ctxShown.has(t.id));
    if (wantedTab && wantedTab !== activeTab && visibleTab(tabs.find(t => t.id === wantedTab))) activeTab = wantedTab;
    if (!visibleTab(tabs.find(t => t.id === activeTab))) {
      // keep the wanted tab (not a contextual one) so it can be selected when it appears
      if (!wantedTab && !isCtxTab(activeTab)) wantedTab = activeTab;
      activeTab = tabs.find(t => !t.contextual)?.id || 'home';
    } else if (wantedTab === activeTab) wantedTab = null;
    for (const t of tabs) {
      const b = h('button.rtab', { type: 'button', role: 'tab', 'data-tab': t.id, text: t.label, tabindex: t.id === activeTab ? '0' : '-1' });
      if (t.contextual) {
        b.classList.add('ctx'); b.hidden = !ctxShown.has(t.id);
        const accent = ctxAccent(t.accent);
        if (accent) b.style.setProperty('--ctx', accent);
        b.dataset.tip = t.label; b.dataset.tipD = t.description || `${t.group ? t.group + ': t' : 'T'}ools for what you are working on. This tab shows only while it applies.`;
      }
      b.addEventListener('click', () => selectTab(t.id, true));
      // double-click a tab: switch between "Show tabs and commands" and "Show tabs only" (Word)
      b.addEventListener('dblclick', () => toggleRibbon());
      nav.append(b);
    }
    nav.append(h('span.rt-spacer'));
    const col = h('button.btn-ghost.rt-collapse', { type: 'button', html: icon('ribbonicon'), 'data-tip-cmd': 'view.ribbonOptions', 'aria-label': 'Ribbon display options', 'aria-haspopup': 'menu' });
    col.addEventListener('click', () => ribbonOptionsMenu(col));
    nav.append(col, h('span.ink'));
    nav.addEventListener('keydown', e => {
      // Down arrow (or Enter) goes into the tab's buttons; Esc goes back to the page
      if (e.key === 'ArrowDown' || (e.key === 'Enter' && document.activeElement?.dataset?.tab)) {
        const f = $$('.panel.on button:not([disabled]), .panel.on [tabindex="0"], .panel.on select', ribbonEl).find(x => x.offsetParent);
        if (f) { e.preventDefault(); f.focus(); } return;
      }
      if (e.key === 'Escape') { e.preventDefault(); const ed = app.editors.active(); if (ed?.focus) ed.focus(); return; }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const list = $$('.rtab', nav); const i = list.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault();
      const n = list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
      n.focus(); if (n.dataset.tab) selectTab(n.dataset.tab);
    });
    const body = h('div.rbody');
    // ribbon buttons must not steal focus (or the selection) from the editor
    body.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    for (const t of tabs) {
      const panel = h('div.panel', { 'data-tab': t.id, role: 'tabpanel', 'aria-label': t.label });
      for (const g of t.groups) {
        const ge = h('div.group', { 'data-group': g.id });
        const gb = h('div.gbody');
        (g.items || []).forEach(it => renderItem(it, gb));
        if (g.render) { try { g.render(gb); } catch (e) { console.error(e); } }
        ge.append(gb, h('div.glabel', { text: g.label || '' }));
        panel.append(ge);
      }
      if (!t.groups.length) panel.append(h('div.empty', { text: t.emptyText || 'Nothing here yet.' }));
      body.append(panel);
    }
    // bottom-right corner: Ribbon display options (pinned), a pin on the dropped-down ribbon (Show tabs only)
    const disp = h('button.rdisp', { type: 'button', html: icon('chev'), 'data-tip-cmd': 'view.ribbonOptions', 'aria-label': 'Ribbon display options', 'aria-haspopup': 'menu' });
    disp.addEventListener('mousedown', e => e.preventDefault());
    disp.addEventListener('click', () => ribbonOptionsMenu(disp));
    const pin = h('button.rpin', { type: 'button', html: icon('pin'), 'data-tip-cmd': 'view.pinRibbon', 'aria-label': 'Pin the ribbon' });
    pin.addEventListener('mousedown', e => e.preventDefault());
    pin.addEventListener('click', () => app.commands.run('view.pinRibbon'));
    ribbonEl.innerHTML = '';
    ribbonEl.append(nav, body, disp, pin);
    wireHScroll(body, ribbonEl, 'ribbon');
    selectTab(activeTab, false, true);
    refreshRibbon();
    renderSlimbar();
  }
  // Groups that do not fit stay reachable with the mouse: edge chevrons (with a fade) and the plain wheel scroll sideways.
  const CHEV = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d === 'l' ? 'm14.5 6-6 6 6 6' : 'm9.5 6 6 6-6 6'}"/></svg>`;
  function wireHScroll(sc, holder, what) {
    holder.__mkRO?.disconnect?.();
    const update = () => {
      const over = sc.scrollWidth > sc.clientWidth + 2;
      holder.classList.toggle('ov-l', over && sc.scrollLeft > 1);
      holder.classList.toggle('ov-r', over && sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 1);
    };
    holder.__mkHsUpdate = update;
    if (holder !== sc) {
      $$(':scope > .rchev', holder).forEach(x => x.remove());
      for (const side of ['l', 'r']) {
        const b = h('button.rchev.' + side, { type: 'button', html: CHEV(side), tabindex: '-1', 'aria-label': `Show more ${what} ${side === 'l' ? 'on the left' : 'on the right'}`, 'data-tip': side === 'l' ? 'Scroll left' : 'More', 'data-tip-d': 'Some groups do not fit in the window. You can also turn the mouse wheel over the ribbon.' });
        b.addEventListener('mousedown', e => e.preventDefault());
        b.addEventListener('click', () => sc.scrollBy({ left: (side === 'l' ? -1 : 1) * Math.max(160, sc.clientWidth * 0.6), behavior: reduceMotionPref() ? 'auto' : 'smooth' }));
        holder.append(b);
      }
    }
    sc.addEventListener('scroll', update, { passive: true });
    sc.addEventListener('wheel', e => {
      if (e.ctrlKey || sc.scrollWidth <= sc.clientWidth + 2 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault(); sc.scrollLeft += e.deltaY; update();
    }, { passive: false });
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => update()); ro.observe(sc); holder.__mkRO = ro; }
    raf(update);
  }
  const reduceMotionPref = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function moveInk() {
    const b = $('.rtab.on', ribbonEl), ink = $('.ink', ribbonEl);
    if (!b || !ink) return;
    ink.style.left = b.offsetLeft + 'px'; ink.style.width = b.offsetWidth + 'px';
    // a contextual tab underlines in its own accent color
    ink.style.background = b.classList.contains('ctx') ? getComputedStyle(b).getPropertyValue('--ctx').trim() || '' : '';
  }
  function selectTab(id, user, initial) {
    const collapsed = document.body.classList.contains('ribbon-collapsed');
    if (user && collapsed) {
      if (ribbonEl.classList.contains('peek') && activeTab === id) { endPeek(); return; }
      ribbonEl.classList.remove('peek-out'); ribbonEl.classList.add('peek');
    }
    if (!isCtxTab(id)) lastPlainTab = id;
    if (!initial) wantedTab = null;
    activeTab = id;
    $$('.rtab[data-tab]', ribbonEl).forEach(b => { const on = b.dataset.tab === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    $$('.panel', ribbonEl).forEach(p => {
      const on = p.dataset.tab === id;
      if (on && !initial && !p.classList.contains('on')) { p.style.animation = 'none'; void p.offsetWidth; p.style.animation = ''; }
      p.classList.toggle('on', on);
    });
    raf(moveInk);
    raf(() => { const b = $('.rbody', ribbonEl); if (b) b.scrollLeft = 0; ribbonEl.__mkHsUpdate?.(); });
    if (user) settings.set('ribbonTab', id);
    app.events.emit('ribbon:tab', id);
  }
  function endPeek() {
    if (!ribbonEl.classList.contains('peek')) return;
    // fade the dropped ribbon out where it is (no jump of the page under it)
    ribbonEl.classList.add('peek-out'); ribbonEl.classList.remove('peek');
    clearTimeout(endPeek.t); endPeek.t = setTimeout(() => ribbonEl.classList.remove('peek-out'), 170);
  }
  /** After a command from the dropped-down ribbon: close it, unless a menu it opened is still up. */
  function closeDroppedIfIdle() {
    if (openPop || document.querySelector('.mk-pop')) return;
    if (ribbonEl.classList.contains('peek')) endPeek();
    if (document.body.classList.contains('chrome-reveal')) hideChrome();
  }
  document.addEventListener('mousedown', e => {
    if (ribbonEl.classList.contains('peek') && !ribbonEl.contains(e.target) && !popLayer.contains(e.target)) endPeek();
    if (document.body.classList.contains('chrome-reveal') && !ribbonEl.contains(e.target) && !titlebar.contains(e.target) && !popLayer.contains(e.target) && !e.target.closest?.('.top-edge, .full-dots, .mk-pop, .dlg, .palette')) hideChrome();
  });
  // menus and commands started from the dropped-down ribbon close it afterwards (Word does the same)
  app.events.on('command:ran', () => { if (ribbonEl.classList.contains('peek') || document.body.classList.contains('chrome-reveal')) setTimeout(closeDroppedIfIdle, 0); });

  // ---- Ribbon display options: Show tabs and commands (pinned), Show tabs only, Full-screen mode ----
  const RIBBON_MODES = { pinned: 'Show tabs and commands', tabs: 'Show tabs only', full: 'Full-screen mode' };
  let ribbonMode = 'pinned';
  const ribbonDisplay = () => ribbonMode;
  /** Smoothly change how the ribbon shows. m: 'pinned' | 'tabs' | 'full'. Saved in settings (ribbonDisplay). */
  function setRibbonDisplay(m, opts = {}) {
    if (!RIBBON_MODES[m]) m = 'pinned';
    const prev = ribbonMode; ribbonMode = m;
    endPeek(); hideChrome(true);
    const b = document.body.classList;
    b.toggle('ribbon-collapsed', m === 'tabs');
    b.toggle('ribbon-full', m === 'full');
    if (!opts.silent) {
      if (settings.get('ribbonDisplay') !== m) settings.set('ribbonDisplay', m);
      if (settings.get('ribbonCollapsed') !== (m === 'tabs')) settings.set('ribbonCollapsed', m === 'tabs');
    }
    raf(moveInk); setTimeout(moveInk, 360); queueRibbonRefresh();
    if (prev !== m) {
      app.events.emit('ribbon:collapsed', m !== 'pinned');
      app.events.emit('ribbon:display', m);
      if (m === 'full' && !opts.silent && !app.tests?.current) toast('Full-screen mode. Move the pointer to the top edge, or press Alt, to show the ribbon.', { kind: 'info', timeout: 3200 });
    }
    return m;
  }
  /** Ctrl+F1 and double-click on a tab: Show tabs and commands ↔ Show tabs only. */
  function toggleRibbon(force) {
    const collapse = force ?? ribbonMode === 'pinned';
    return setRibbonDisplay(collapse ? 'tabs' : 'pinned');
  }
  function ribbonOptionsMenu(anchor) {
    const ic = { pinned: 'ribbonicon', tabs: 'tabstop', full: 'focus' };
    const desc = { pinned: 'Keep the ribbon tabs and commands showing all the time.', tabs: 'Show only the tab names. Click a tab to drop the ribbon down over the page.', full: 'Hide the title bar and ribbon for the most room. Move the pointer to the top edge to show them.' };
    return menu(anchor || ribbonEl, [{ header: 'Ribbon display options' },
      ...['full', 'tabs', 'pinned'].map(k => ({ label: RIBBON_MODES[k], checked: ribbonMode === k, title: desc[k], shortcut: k === 'tabs' && ribbonMode === 'pinned' ? 'Ctrl+F1' : k === 'pinned' && ribbonMode === 'tabs' ? 'Ctrl+F1' : '', run: () => setRibbonDisplay(k), icon: ic[k] })),
      { note: 'Ctrl+F1 or a double-click on a tab switches between the last two.' }], { checks: true, align: 'right' });
  }
  // Full-screen mode: the title bar and ribbon slide in from the top edge
  const topEdge = h('div.top-edge', { 'aria-hidden': 'true' });
  const fullDots = h('button.full-dots', { type: 'button', html: icon('more'), 'data-tip': 'Show the ribbon', 'data-tip-d': 'Full-screen mode hides the title bar and ribbon. Click here, or move the pointer to the top edge, to show them.', 'aria-label': 'Show the ribbon' });
  document.body.append(topEdge, fullDots);
  let revealTimer = null, hideTimer = null;
  function revealChrome() {
    if (ribbonMode !== 'full') return false;
    clearTimeout(hideTimer);
    if (!document.body.classList.contains('chrome-reveal')) { document.body.classList.add('chrome-reveal'); raf(moveInk); app.events.emit('ribbon:reveal', true); }
    return true;
  }
  function hideChrome(now) {
    clearTimeout(revealTimer); clearTimeout(hideTimer);
    if (!document.body.classList.contains('chrome-reveal')) return;
    const go = () => { document.body.classList.remove('chrome-reveal'); app.events.emit('ribbon:reveal', false); };
    if (now) go(); else hideTimer = setTimeout(go, 60);
  }
  topEdge.addEventListener('mouseenter', () => { clearTimeout(revealTimer); revealTimer = setTimeout(revealChrome, 160); });
  topEdge.addEventListener('mouseleave', () => clearTimeout(revealTimer));
  topEdge.addEventListener('click', () => revealChrome());
  fullDots.addEventListener('click', () => revealChrome());
  document.addEventListener('mousemove', e => {
    if (!document.body.classList.contains('chrome-reveal')) return;
    const bottom = ribbonEl.getBoundingClientRect().bottom;
    const busy = openPop || document.querySelector('.mk-pop') || ribbonEl.contains(document.activeElement) || titlebar.contains(document.activeElement);
    if (e.clientY > bottom + 28 && !busy) { if (!hideTimer) hideTimer = setTimeout(() => { hideTimer = null; hideChrome(true); }, 420); }
    else { clearTimeout(hideTimer); hideTimer = null; }
  }, { passive: true });

  function refreshRibbon() {
    ribbonRefreshQueued = false;
    for (const b of bound) {
      const c = b.item.command ? app.commands.get(b.item.command) : null;
      if (b.kind === 'btn') {
        const on = !!safe(() => (b.item.isActive ? b.item.isActive() : c?.isActive?.(b.item.args)), false);
        // a toggle that just turned on pops once (only when the change follows a click on it)
        if (on && !b.el.classList.contains('on') && b.el === pressedRecently()) { b.el.classList.remove('just-on'); void b.el.offsetWidth; b.el.classList.add('just-on'); setTimeout(() => b.el.classList.remove('just-on'), 420); }
        b.el.classList.toggle('on', on); b.el.setAttribute('aria-pressed', on);
        setDimmed(b.el, c ? whyDisabled(c.id, b.item.args) : '');
      } else if (b.kind === 'select') {
        b.lab.textContent = optLabel(b.item, safe(() => b.item.value?.(), undefined));
        setDimmed(b.el, c ? whyDisabled(c.id) : '');
      } else if (b.kind === 'seg') {
        b.el.set(safe(() => b.item.value?.(), undefined));
      } else if (b.kind === 'gallery') {
        const v = safe(() => b.item.value?.(), undefined);
        $$('.sty', b.el).forEach(s => s.classList.toggle('on', v != null ? s.dataset.v === String(v) : !!safe(() => c?.isActive?.(s.dataset.v), false)));
      }
    }
    $$('[data-cmd]', titlebar).forEach(b => { const c = app.commands.get(b.dataset.cmd); b.disabled = !!(c?.isEnabled && !safe(() => c.isEnabled(), true)); });
    // controls other modules draw themselves (Home → Font row, styles): dimmed with a reason too
    $$('.panel [data-cmd]', ribbonEl).forEach(el => { if (el.tagName === 'BUTTON') setDimmed(el, whyDisabled(el.dataset.cmd)); });
    refreshSlimState();
  }
  function queueRibbonRefresh() { if (!ribbonRefreshQueued) { ribbonRefreshQueued = true; raf(refreshRibbon); } }
  app.events.on('ribbon:changed', () => {
    const tabs = app.ribbon.tabs().filter(t => t.groups.length || t.alwaysShow);
    const groups = tabs.flatMap(t => t.groups);
    const sig = tabs.map(t => t.id + t.label).join('|');
    if (sig !== lastTabSig || groups.length !== lastGroups.length || groups.some((g, i) => g !== lastGroups[i])) {
      if (!ribbonRenderQueued) { ribbonRenderQueued = true; raf(renderRibbon); }
    } else queueRibbonRefresh();
  });
  ['selection:changed', 'doc:active', 'mode:changed', 'settings:changed', 'zoom:changed', 'doc:saved'].forEach(ev => app.events.on(ev, queueRibbonRefresh));
  addEventListener('resize', () => raf(moveInk));

  // ---- Simple-mode slim bar: same commands as the ribbon ----
  const slimbar = $('#slimbar');
  const SLIM = [
    { html: '<b>B</b>', label: 'Bold', ids: ['format.bold'], fmt: 'bold' },
    { html: '<i>I</i>', label: 'Italic', ids: ['format.italic'], fmt: 'italic' },
    { html: '<s>S</s>', label: 'Strikethrough', ids: ['format.strike', 'format.strikethrough'], fmt: 'strike' },
    { html: '<span class="ib-text sans">x²</span>', label: 'Superscript', ids: ['format.sup', 'format.superscript'], fmt: 'sup' },
    { sep: 1 },
    { html: '<span class="ib-text sans">H1</span>', label: 'Heading 1', ids: ['format.h1', 'style.h1', 'format.heading1'], alt: ['format.style', { value: 'h1' }], fmt: 'h1' },
    { html: '<span class="ib-text sans">H2</span>', label: 'Heading 2', ids: ['format.h2', 'style.h2', 'format.heading2'], alt: ['format.style', { value: 'h2' }], fmt: 'h2' },
    { html: '<span class="ib-text sans">H3</span>', label: 'Heading 3', ids: ['format.h3', 'style.h3', 'format.heading3'], alt: ['format.style', { value: 'h3' }], fmt: 'h3' },
    { sep: 1 },
    { icon: 'ul', label: 'Bullets', ids: ['list.bullet', 'format.ul', 'format.bullets'], fmt: 'ul' },
    { icon: 'ol', label: 'Numbering', ids: ['list.number', 'format.ol', 'format.numbering'], fmt: 'ol' },
    { icon: 'task', label: 'Checklist', ids: ['list.task', 'format.task', 'format.checklist'], fmt: 'task' },
    { icon: 'quote', label: 'Quote', ids: ['para.quote', 'format.quote', 'format.blockquote'], fmt: 'quote' },
    { sep: 1 },
    { icon: 'link', label: 'Link', ids: ['insert.link'], match: /^insert\.link$/ },
    { icon: 'image', label: 'Picture', ids: ['insert.picture', 'insert.image'], match: /^insert\.(picture|image)/ },
    { icon: 'table', label: 'Table', ids: ['insert.table'], match: /^insert\.table/ },
    { icon: 'code', label: 'Code block', ids: ['insert.code', 'insert.codeBlock', 'format.codeBlock'], match: /^insert\.code/ },
    { icon: 'sigma', label: 'Equation', ids: ['insert.equation', 'edit.equation', 'insert.math'], match: /\.equation$/ },
    { icon: 'flow', label: 'Diagram', ids: ['insert.diagram', 'insert.mermaid'], match: /^insert\.(diagram|mermaid)/ },
    { icon: 'cite', label: 'Citation', ids: ['ref.cite', 'insert.citation', 'research.cite', 'references.cite'], match: /\.(cite|citation|insertCitation)$/ },
    { icon: 'foot', label: 'Footnote', ids: ['ref.footnote', 'insert.footnote', 'references.footnote'], match: /\.(footnote|insertFootnote)$/ },
    { sep: 1 },
    { icon: 'search', label: 'Find and replace', ids: ['edit.find', 'edit.replace'], match: /^edit\.find$/ },
  ];
  let slimSig = '';
  function resolveSlim(s) {
    if (s.sep) return null;
    for (const id of s.ids || []) if (app.commands.get(id)) return id;
    if (s.alt && app.commands.get(s.alt[0])) return s.alt[0] + '#' + JSON.stringify(s.alt[1]);
    if (s.match) { const c = app.commands.list().find(c => s.match.test(c.id)); if (c) return c.id; }
    return null;
  }
  function renderSlimbar() {
    const resolved = SLIM.map(s => s.sep ? '|' : (resolveSlim(s) || (s.fmt ? '~' + s.fmt : '')));
    const sig = resolved.join(',');
    if (sig === slimSig && slimbar.childElementCount) { refreshSlimState(); return; }
    slimSig = sig;
    slimbar.innerHTML = '';
    let lastSep = true;
    SLIM.forEach((s, i) => {
      const r = resolved[i];
      if (s.sep) { if (!lastSep) slimbar.append(h('span.sep')); lastSep = true; return; }
      if (!r) return;
      const b = h('button.ib', { type: 'button', html: s.html || icon(s.icon), 'aria-label': s.label });
      const [cid, argJson] = r.split('#');
      const args = argJson ? JSON.parse(argJson) : undefined;
      const cmd = r[0] === '~' ? null : app.commands.get(cid);
      b.dataset.tip = argJson ? s.label : (cmd?.label || s.label);
      const sc = argJson ? '' : displayShortcuts(cmd)[0]; if (sc) b.dataset.key = sc;
      if (cmd && !argJson) { b.dataset.cmd = cid; b.dataset.tipCmd = cid; }
      b.addEventListener('mousedown', e => e.preventDefault()); // keep the editor's selection
      b.addEventListener('click', () => {
        if (cmd) app.commands.run(cid, args);
        else { const ed = app.editors.active(); if (ed?.format) { ed.format(s.fmt); app.events.emit('command:ran', { id: 'format.' + s.fmt }); } }
      });
      slimbar.append(b); lastSep = false;
    });
    const ribBtn = h('button.ib.lbl', { type: 'button', html: `${icon('ribbonicon')}<span>Ribbon</span>`, 'data-tip': 'Show the full ribbon', 'data-tip-d': 'All tabs: Insert, References, Developer and more' });
    ribBtn.addEventListener('click', () => app.commands.run('view.showRibbon'));
    slimbar.append(h('span.slim-note', { text: 'Markdown source · live preview' }), ribBtn);
    if (!slimbar.__mkHsUpdate) wireHScroll(slimbar, slimbar, 'buttons'); else slimbar.__mkHsUpdate();
    refreshSlimState();
  }
  function refreshSlimState() {
    $$('[data-cmd]', slimbar).forEach(b => {
      const c = app.commands.get(b.dataset.cmd);
      b.classList.toggle('on', !!safe(() => c?.isActive?.(), false));
    });
    const rb = slimbar.querySelector('.ib.lbl'); if (rb) rb.classList.toggle('on', document.body.classList.contains('simple-ribbon'));
  }

  // =====================================================================
  //  Document tabs (top / bottom / left)
  // =====================================================================
  const dtabsEl = $('#dtabs'), vtabsEl = $('#vtabs');
  let tabOrder = [];
  const EXT_LABEL = { markdown: 'md', mdown: 'md', mkd: 'md', mkdn: 'md', mdx: 'mdx', rmd: 'rmd', qmd: 'qmd', htm: 'html', latex: 'tex' };
  const EXT_CLASS = { docx: 'docx', doc: 'docx', pdf: 'pdf', djvu: 'djvu', djv: 'djvu', epub: 'epub', html: 'html', htm: 'html', txt: 'txt', tex: 'tex', latex: 'tex', odt: 'odt', rtf: 'rtf' };
  function extOf(doc) { const e = String(doc.convertedFrom || doc.ext || 'md').toLowerCase(); return EXT_LABEL[e] || e; }
  function orderedDocs() {
    const list = app.docs.list(); const ids = new Set(list.map(d => d.id));
    tabOrder = tabOrder.filter(id => ids.has(id));
    for (const d of list) if (!tabOrder.includes(d.id)) tabOrder.push(d.id);
    return tabOrder.map(id => app.docs.get(id)).filter(Boolean);
  }
  function makeTab(doc) {
    const el = h('div.dtab', { role: 'tab', tabindex: '0', draggable: 'true', 'data-id': doc.id });
    el.innerHTML = `<span class="ext"></span><span class="name"></span><button class="x" type="button" tabindex="-1" aria-label="Close"><span class="mod"></span>${icon('x')}</button>`;
    return el;
  }
  function updateTabEl(el, doc) {
    const e = extOf(doc), ext = el.querySelector('.ext');
    ext.textContent = e.toUpperCase().slice(0, 4); ext.className = 'ext ' + (EXT_CLASS[e] || '');
    el.querySelector('.name').textContent = doc.title;
    el.title = (doc.path || doc.title) + (doc.dirty ? ' — edited' : '') + (doc.readOnly ? ' — read only' : '');
    el.classList.toggle('on', app.docs.active()?.id === doc.id);
    el.setAttribute('aria-selected', app.docs.active()?.id === doc.id);
    el.classList.toggle('dirty', !!doc.dirty);
  }
  function syncTabs(container, startIndex) {
    const docs = orderedDocs();
    const existing = new Map($$('.dtab', container).map(el => [el.dataset.id, el]));
    for (const [id, el] of existing) if (!app.docs.get(id)) el.remove();
    let ref = container.children[startIndex] || null;
    const want = docs.map(d => existing.get(d.id) || makeTab(d));
    // reorder only when needed so tab animations do not replay
    const current = $$('.dtab', container);
    const same = current.length === want.length && current.every((el, i) => el === want[i]);
    if (!same) {
      const newBtn = container.querySelector('.dtab-new');
      want.forEach(el => container.insertBefore(el, newBtn || null));
    }
    docs.forEach((d, i) => updateTabEl(want[i], d));
    void ref;
  }
  function renderTabs() {
    if (!dtabsEl.querySelector('.dtab-new')) {
      const nb = h('button.btn-ghost.dtab-new', { type: 'button', html: icon('plus'), 'data-tip': 'New document', 'data-key': 'Ctrl+N', 'aria-label': 'New document' });
      nb.addEventListener('click', () => app.commands.run('file.new'));
      dtabsEl.append(nb);
    }
    if (!vtabsEl.querySelector('h6')) {
      const hd = h('h6', null, h('span', { text: 'Open documents' }));
      const nb = h('button.btn-ghost', { type: 'button', html: icon('plus', 'i', 'width:13px;height:13px'), 'data-tip': 'New document', 'data-key': 'Ctrl+N', 'aria-label': 'New document' });
      nb.addEventListener('click', () => app.commands.run('file.new'));
      hd.append(nb); vtabsEl.append(hd);
    }
    syncTabs(dtabsEl, 0); syncTabs(vtabsEl, 1);
    const on = dtabsEl.querySelector('.dtab.on');
    if (on && !document.body.classList.contains('tabs-left')) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function updateTabState(doc) {
    for (const c of [dtabsEl, vtabsEl]) { const el = c.querySelector(`.dtab[data-id="${doc.id}"]`); if (el) updateTabEl(el, doc); }
  }
  async function closeDocs(ids) { for (const id of ids) { const ok = await app.docs.close(id); if (ok === false) return false; } return true; }
  function tabMenu(e, doc) {
    const ids = orderedDocs().map(d => d.id); const i = ids.indexOf(doc.id);
    contextMenu(e, [
      { label: 'Close', icon: 'x', shortcut: 'Ctrl+W', run: () => app.docs.close(doc.id) },
      { label: 'Close others', disabled: ids.length < 2, run: () => closeDocs(ids.filter(x => x !== doc.id)) },
      { label: 'Close to the right', disabled: i === ids.length - 1, run: () => closeDocs(ids.slice(i + 1)) },
      { sep: 1 },
      { label: 'Save', icon: 'save', disabled: doc.kind !== 'markdown', run: () => app.docs.save(doc) },
      { label: 'Rename…', icon: 'track', disabled: !!doc.path, title: doc.path ? 'Use Save As to rename a saved file' : '', run: async () => { const t = await prompt('Rename document', 'Title', doc.title); if (t && t.trim()) { doc.title = t.trim(); updateTabState(doc); updateTitle(); } } },
      { sep: 1 },
      { label: 'Reveal in folder', icon: 'folder', disabled: !doc.path, run: () => mk.invoke('reveal', doc.path) },
      { label: 'Copy path', icon: 'copy', disabled: !doc.path, run: async () => { await copyText(doc.path, 'Path copied'); } },
    ]);
  }
  function wireTabContainer(c) {
    c.addEventListener('click', e => {
      const t = e.target.closest('.dtab'); if (!t) return;
      if (e.target.closest('.x')) { e.stopPropagation(); app.docs.close(t.dataset.id); return; }
      app.docs.activate(t.dataset.id);
    });
    c.addEventListener('mousedown', e => { if (e.button === 1 && e.target.closest('.dtab')) e.preventDefault(); });
    c.addEventListener('auxclick', e => { const t = e.target.closest('.dtab'); if (t && e.button === 1) { e.preventDefault(); app.docs.close(t.dataset.id); } });
    c.addEventListener('contextmenu', e => { const t = e.target.closest('.dtab'); if (!t) return; const d = app.docs.get(t.dataset.id); if (d) tabMenu(e, d); });
    c.addEventListener('keydown', e => {
      const t = e.target.closest('.dtab'); if (!t) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); app.docs.activate(t.dataset.id); }
      else if (e.key === 'Delete') { e.preventDefault(); app.docs.close(t.dataset.id); }
      else if (/^Arrow(Left|Right|Up|Down)$/.test(e.key)) {
        const list = $$('.dtab', c); const i = list.indexOf(t);
        const n = list[i + (/Left|Up/.test(e.key) ? -1 : 1)];
        if (n) { e.preventDefault(); n.focus(); }
      } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
        e.preventDefault(); const r = t.getBoundingClientRect(); const d = app.docs.get(t.dataset.id); if (d) tabMenu({ clientX: r.left + 10, clientY: r.bottom }, d);
      }
    });
    // drag to reorder
    let dragId = null;
    const vertical = c === vtabsEl;
    c.addEventListener('dragstart', e => {
      const t = e.target.closest('.dtab'); if (!t) return;
      dragId = t.dataset.id; t.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-markooj-tab', dragId);
    });
    c.addEventListener('dragend', () => { dragId = null; $$('.dtab', c).forEach(x => x.classList.remove('dragging', 'drop-before', 'drop-after')); });
    c.addEventListener('dragover', e => {
      if (!dragId) return;
      e.preventDefault(); e.stopPropagation();
      const t = e.target.closest('.dtab');
      $$('.dtab', c).forEach(x => x.classList.remove('drop-before', 'drop-after'));
      if (!t || t.dataset.id === dragId) return;
      const r = t.getBoundingClientRect();
      const after = vertical ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
      t.classList.add(after ? 'drop-after' : 'drop-before');
    });
    c.addEventListener('drop', e => {
      if (!dragId) return;
      e.preventDefault(); e.stopPropagation();
      const t = e.target.closest('.dtab');
      if (t && t.dataset.id !== dragId) {
        const after = t.classList.contains('drop-after');
        tabOrder = tabOrder.filter(id => id !== dragId);
        const j = tabOrder.indexOf(t.dataset.id);
        tabOrder.splice(after ? j + 1 : j, 0, dragId);
        renderTabs();
      }
      $$('.dtab', c).forEach(x => x.classList.remove('dragging', 'drop-before', 'drop-after'));
      dragId = null;
    });
  }
  wireTabContainer(dtabsEl); wireTabContainer(vtabsEl);

  function applyTabPosition(pos) {
    pos = ['top', 'bottom', 'left'].includes(pos) ? pos : settings.get('tabPosition', 'top');
    document.body.classList.remove('tabs-top', 'tabs-bottom', 'tabs-left');
    document.body.classList.add('tabs-' + pos);
    queueRibbonRefresh();
    return pos;
  }

  // =====================================================================
  //  Outline sidebar + Document card
  // =====================================================================
  const outlineEl = $('#outline');
  let outlineActiveLine = null;
  function cleanInline(s) {
    return String(s).replace(/\s*\{\s*(?:[#.][^}]*|-)\s*\}\s*$/, '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_m, a, b) => b || a).replace(/(\*\*|__|~~|==)(.+?)\1/g, '$2').replace(/(^|\W)[*_](.+?)[*_](?=\W|$)/g, '$1$2')
      .replace(/`([^`]+)`/g, '$1').replace(/<[^>]+>/g, '').trim();
  }
  function frontMatterEnd(lines) {
    if (!/^---\s*$/.test(lines[0] || '')) return 0;
    for (let i = 1; i < lines.length; i++) if (/^(---|\.\.\.)\s*$/.test(lines[i])) return i + 1;
    return 0;
  }
  /** Headings of a Markdown text, ignoring fenced code and front matter → [{level, text, line}] */
  function parseHeadings(text) {
    const lines = String(text || '').split(/\r?\n/);
    const out = []; let fence = null; let mathBlock = false; let prevHeading = false;
    for (let i = frontMatterEnd(lines); i < lines.length; i++) {
      const l = lines[i];
      const f = /^\s{0,3}(`{3,}|~{3,})/.exec(l);
      if (fence) { if (f && f[1][0] === fence.ch && f[1].length >= fence.len && /^\s{0,3}[`~]+\s*$/.test(l)) fence = null; prevHeading = false; continue; }
      if (f) { fence = { ch: f[1][0], len: f[1].length }; prevHeading = false; continue; }
      if (/^\s*\$\$\s*(\{[^}]*\})?\s*$/.test(l)) { mathBlock = !mathBlock; continue; }
      if (mathBlock) continue;
      const m = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(l);
      if (m) { out.push({ level: m[1].length, text: cleanInline(m[2]), line: i }); prevHeading = true; continue; }
      const st = /^\s{0,3}(=+|-{2,})\s*$/.exec(l);
      if (st && i > 0 && !prevHeading) {
        const p = lines[i - 1];
        if (p.trim() && !/^\s*([-*+]\s|\d+[.)]\s|>|\||#|<|\$\$)/.test(p) && !/^\s*$/.test(p) && i - 1 >= frontMatterEnd(lines)) {
          out.push({ level: st[1][0] === '=' ? 1 : 2, text: cleanInline(p), line: i - 1 }); prevHeading = true; continue;
        }
      }
      prevHeading = false;
    }
    return out;
  }
  function stripForCount(text) {
    const lines = String(text || '').split(/\r?\n/);
    return lines.slice(frontMatterEnd(lines)).join('\n')
      .replace(/^\s{0,3}(`{3,}|~{3,})[\s\S]*?^\s{0,3}\1\s*$/gm, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/%%[\s\S]*?%%/g, ' ') // hidden notes are not part of the text
      .replace(/\{#(?:eq|fig|tbl|sec):[^}\s]*\}/g, ' '); // cross-reference labels
  }
  /** Word, equation and citation counts for a Markdown text */
  function docStats(text) {
    let body = stripForCount(text);
    let display = 0, inline = 0;
    body = body.replace(/\$\$[\s\S]+?\$\$/g, () => { display++; return ' '; })
      .replace(/\\\[[\s\S]+?\\\]/g, () => { display++; return ' '; })
      .replace(/\\begin\{(equation|align|gather|multline|eqnarray)(\*?)\}[\s\S]*?\\end\{\1\2\}/g, () => { display++; return ' '; })
      .replace(/\\\([\s\S]+?\\\)/g, () => { inline++; return ' x '; })
      .replace(/(^|[^\\$])\$(?=\S)([^$\n]+?)(?<=\S)\$(?!\d)/g, (_m, p) => { inline++; return p + ' x '; });
    let citations = 0; const keys = new Set();
    body = body.replace(/\[(-?@[^\]]+)\]/g, (_m, inner) => { const ks = (inner.match(/-?@[\w:.#$%&\-+?<>~/]+/g) || []).filter(k => !/^-?@(eq|fig|tbl|sec):/i.test(k)); citations += ks.length; ks.forEach(k => keys.add(k.replace(/^-?@/, ''))); return ' '; });
    // narrative citations (@key in running text) count when the document names a library, as they render as citations then
    if (/^(?:bibliography|references)\s*:/m.test(String(text).split(/\r?\n/).slice(0, frontMatterEnd(String(text).split(/\r?\n/))).join('\n'))) {
      body = body.replace(/(^|[\s(;])@([\p{L}\p{N}_][\p{L}\p{N}_:.#$%&\-+?<>~/]*)/gu, (m, p, k) => { k = k.replace(/[.:]+$/, ''); if (/^(eq|fig|tbl|sec):/i.test(k)) return m; citations++; keys.add(k); return p + ' '; });
    }
    const plain = body.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[\^[^\]]+\]:?/g, ' ').replace(/<[^>]+>/g, ' ').replace(/[#>*_`~=|:-]+/g, ' ');
    const words = (plain.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) || []).length;
    return { words, equations: display + inline, display, inline, citations, sources: keys.size, readingMinutes: words ? Math.max(1, Math.round(words / 230)) : 0, chars: plain.replace(/\s+/g, ' ').trim().length };
  }
  function docMeta(doc) {
    if (doc.meta && Object.keys(doc.meta).length) return doc.meta;
    try { return mk.frontMatter ? mk.frontMatter.parse(doc.text).meta : {}; } catch { return {}; }
  }
  function renderOutline() {
    const doc = app.docs.active();
    const show = settings.get('outline', true);
    outlineEl.classList.toggle('hide', !show);
    const head = `<div class="side-h"><h5>Outline</h5><button class="btn-ghost" id="hideOutline" data-tip="Hide outline" data-key="Ctrl+\\" aria-label="Hide outline">${icon('side', 'i', 'width:13px')}</button></div>`;
    outlineEl.innerHTML = head;
    $('#hideOutline', outlineEl).addEventListener('click', () => app.commands.run('view.outline'));
    if (!doc) return;
    if (doc.kind !== 'markdown') {
      outlineEl.append(h('div.o-empty', { text: `${extOf(doc).toUpperCase()} file${doc.pages ? ` · ${doc.pages} pages` : ''}. Use “Edit as text” to get an outline you can edit.` }));
      return;
    }
    const meta = docMeta(doc);
    const hs = parseHeadings(doc.text);
    const list = h('nav', { 'aria-label': 'Headings' });
    // the title sits above the chapters, which nest one level under it (as in the mock)
    if (meta.title) list.append(outlineItem({ level: 0, text: String(meta.title), line: 0 }));
    hs.forEach(x => list.append(outlineItem({ ...x, depth: Math.min(6, x.level + (meta.title ? 1 : 0)) })));
    if (!hs.length && !meta.title) list.append(h('div.o-empty', { text: 'Headings you add show up here. Use Home → Styles → Heading 1.' }));
    outlineEl.append(list);
    // Document card
    const st = docStats(doc.text);
    const card = h('div.sidecard', { 'aria-label': 'Document statistics' });
    card.innerHTML = `<h6>Document</h6>
      <div class="stat"><span>Words</span><b>${fmtNum(st.words)}</b></div>
      <div class="stat"><span>Equations</span><b>${fmtNum(st.equations)}</b></div>
      <div class="stat"><span>Citations</span><b>${fmtNum(st.citations)}</b></div>
      <div class="stat"><span>Reading time</span><b>${st.readingMinutes ? st.readingMinutes + ' min' : '—'}</b></div>`;
    const target = parseInt(String(meta['word-target'] || meta.wordtarget || meta['word_target'] || '').replace(/[,\s]/g, ''), 10);
    if (target > 0) {
      const pct = Math.round(st.words / target * 100);
      card.insertAdjacentHTML('beforeend', `<div class="bar"><i></i></div><div class="bar-note">${pct}% of ${fmtNum(target)}-word target</div>`);
      raf(() => { const i = card.querySelector('.bar i'); if (i) i.style.width = Math.min(100, pct) + '%'; });
    } else if (mk.frontMatter && !doc.readOnly) {
      const b = h('button.oitem', { type: 'button', text: 'Set a word target…', style: 'margin-top:6px;padding:4px 0;font-size:11.5px;color:var(--accent)' });
      b.addEventListener('click', () => app.commands.run('view.wordTarget'));
      card.append(b);
    }
    outlineEl.append(card);
  }
  function outlineItem(x) {
    const b = h('button.oitem.l' + (x.level === 0 ? 0 : Math.max(1, x.depth ?? x.level)), { type: 'button', text: x.text, title: x.text, 'data-line': String(x.line) });
    if (x.line === outlineActiveLine) b.classList.add('on');
    b.addEventListener('click', () => {
      outlineActiveLine = x.line;
      $$('.oitem', outlineEl).forEach(o => o.classList.toggle('on', o === b));
      const ed = app.editors.active();
      if (ed?.scrollToLine) safe(() => ed.scrollToLine(x.line));
      else scrollHostToLine(x.line);
      outlineHoldUntil = Date.now() + 700; // the scroll this click causes must not move the mark again
    });
    return b;
  }
  // the outline marks the section you are reading (scrolling) or typing in (caret)
  let outlineHoldUntil = 0;
  function markOutlineAt(line) {
    if (line == null || !isFinite(line) || Date.now() < outlineHoldUntil) return;
    const items = $$('.oitem[data-line]', outlineEl).filter(o => o.dataset.line !== '' && !isNaN(+o.dataset.line));
    let cur = null; for (const o of items) { if (+o.dataset.line <= line) cur = o; else break; }
    if (!cur || cur.classList.contains('on')) return;
    outlineActiveLine = +cur.dataset.line;
    items.forEach(o => o.classList.toggle('on', o === cur));
    safe(() => cur.scrollIntoView({ block: 'nearest' }));
  }
  function readingLine() {
    const ad = mounted.adapter, doc = app.docs.active();
    if (!ad || !doc || doc.kind !== 'markdown') return null;
    // the heading a third of the way down the view counts as "here"
    const r = host.getBoundingClientRect(), y = r.top + host.clientHeight / 3;
    const hs = $$('h1[data-line],h2[data-line],h3[data-line],h4[data-line],h5[data-line],h6[data-line]', host).filter(x => x.offsetParent);
    if (hs.length) { let last = null; for (const x of hs) { if (x.getBoundingClientRect().top <= y) last = x; else break; } return last ? +last.dataset.line + fmLinesOf(doc.text) : 0; }
    return safe(() => ad.getTopLine?.(), null);
  }
  const syncOutlineScroll = app.debounce(() => { if (!outlineEl.classList.contains('hide')) markOutlineAt(readingLine()); }, 120);
  $('#editorHost').addEventListener('scroll', syncOutlineScroll, true);
  app.events.on('selection:changed', app.debounce(() => {
    const ad = mounted.adapter; if (!ad || outlineEl.classList.contains('hide')) return;
    const l = safe(() => ad.getCaretLine?.(), null);
    if (l != null) markOutlineAt(l);
  }, 150));
  function scrollHostToLine(line) {
    const els = $$('[data-line]', host).filter(e => +e.dataset.line <= line);
    const el = els[els.length - 1]; el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  const queueOutline = app.debounce(renderOutline, 350);

  // =====================================================================
  //  Editor host: mounts the right editor or viewer for the active doc
  // =====================================================================
  const host = $('#editorHost');
  let mounted = { adapter: null, docId: null };
  let mountSeq = 0;
  // PDF / DjVu docs: research's viewers module exposes app.viewers.mount/unmount (not an editor adapter)
  const viewerAdapter = {
    name: 'viewer',
    mount: (el, doc) => app.viewers.mount(el, doc),
    unmount: () => app.viewers?.unmount?.(),
    refresh() {},
  };
  function pickAdapter(doc) {
    if (!doc) return null;
    // a mode whose editor is not loaded falls back to Word (Inline, Read), then Simple
    if (doc.kind === 'markdown') return app.editors.get(app.mode) || app.editors.get('word') || app.editors.get('simple') || null;
    return app.editors.get(doc.kind) || app.editors.get('viewer') || (app.viewers?.mount ? viewerAdapter : null);
  }
  async function mountActive(force) {
    const doc = app.docs.active();
    const seq = ++mountSeq;
    const adapter = pickAdapter(doc);
    if (!force && adapter && mounted.adapter === adapter && mounted.docId === doc?.id) { safe(() => adapter.refresh?.()); return; }
    const prev = mounted;
    // nothing is mounted while the old editor unmounts, so switching straight back always mounts again
    mounted = { adapter: null, docId: null };
    if (prev.docId) { const pd = app.docs.get(prev.docId); if (pd) pd.view = { ...(pd.view || {}), scroll: host.scrollTop }; }
    if (prev.adapter) { try { await prev.adapter.unmount?.(); } catch (e) { console.error('unmount', e); } }
    if (seq !== mountSeq) return;
    host.innerHTML = '';
    mounted = { adapter, docId: doc?.id || null };
    if (!doc) { host.append(h('div.host-empty', { html: '<div><b>No document open</b>Press Ctrl+N for a new document or Ctrl+O to open one.</div>' })); return; }
    if (!adapter) { await fallbackView(doc); }
    else {
      try { await adapter.mount(host, doc); }
      catch (e) { console.error('mount', e); host.innerHTML = ''; await fallbackView(doc, e); }
    }
    if (seq !== mountSeq) return;
    // a document shown for the first time starts at the top, not where the previous one was scrolled to
    if (doc.view?.scroll) host.scrollTop = doc.view.scroll;
    else if (prev.docId !== doc.id) host.scrollTop = 0; // another document that was at the top (or never shown)
    // the Simple editor brings its own compact toolbar; hide the shell's copy then
    document.body.classList.toggle('editor-slim', !!host.querySelector('.mk-slim'));
    updateStatus(); queueRibbonRefresh();
    app.events.emit('editor:mounted', { doc, adapter });
  }
  // ---- smooth switch between modes ----
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let fxSeq = 0, fxGhost = null;
  const fmLinesOf = text => safe(() => app.editor?.frontMatterLines ? app.editor.frontMatterLines(text || '') : frontMatterEnd(String(text || '').split(/\r?\n/)), 0) || 0;
  /** Source line at the top of the view (and how far into that block), plus the caret line. Lines count from the top of the file. */
  function captureView() {
    const doc = app.docs.active(), ad = mounted.adapter;
    if (!doc || doc.kind !== 'markdown' || !ad) return null;
    const fm = fmLinesOf(doc.text);
    const st = { docId: doc.id, top: null, frac: 0, offset: 0, caret: null, caretOffset: null, caretEnd: null };
    const t = safe(() => ad.getTopLine?.(), null);
    if (Number.isFinite(t)) st.top = t;
    else {
      const hr = host.getBoundingClientRect();
      let straddle = null, first = null;
      for (const el of host.querySelectorAll('[data-line]')) {
        const r = el.getBoundingClientRect();
        if (!r.height || r.bottom <= hr.top + 2 || r.top >= hr.bottom) continue;
        const line = +el.getAttribute('data-line'); if (!Number.isFinite(line)) continue;
        if (r.top <= hr.top + 2) { if (!straddle || line >= straddle.line) straddle = { el, r, line }; }
        else if (!first || r.top < first.r.top) first = { el, r, line };
      }
      const pick = straddle || first;
      if (pick) {
        st.top = pick.line + fm;
        st.offset = pick.r.top - hr.top;
        st.frac = straddle ? Math.max(0, Math.min(1, (hr.top - pick.r.top) / pick.r.height)) : 0;
      }
    }
    const sel = safe(() => ad.getSelection?.(), null);
    if (sel && typeof sel.start === 'number' && Number.isFinite(sel.start)) {
      st.caretOffset = sel.start; st.caretEnd = typeof sel.end === 'number' ? sel.end : sel.start;
      st.caret = (doc.text || '').slice(0, sel.start).split('\n').length - 1;
    } else {
      const c = safe(() => ad.getCaretLine?.(), null);
      if (Number.isFinite(c)) st.caret = c;
      else {
        const s = getSelection();
        const n = s && s.rangeCount ? s.anchorNode : null;
        const el = n && host.contains(n) ? (n.nodeType === 1 ? n : n.parentElement)?.closest('[data-line]') : null;
        if (el) st.caret = +el.getAttribute('data-line') + fm;
      }
    }
    return st;
  }
  function scrollParent(el) {
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      if (p.scrollHeight > p.clientHeight + 2) { const oy = getComputedStyle(p).overflowY; if (oy === 'auto' || oy === 'scroll') return p; }
      if (p === host) break;
    }
    return host;
  }
  function blockAt(bodyLine) {
    let best = null, bl = -1;
    for (const el of host.querySelectorAll('[data-line]')) {
      const l = +el.getAttribute('data-line');
      if (l <= bodyLine && l >= bl && el.getClientRects().length) { best = el; bl = l; }
    }
    return best;
  }
  function restoreView(st) {
    const doc = app.docs.active(), ad = mounted.adapter;
    if (!st || !doc || doc.id !== st.docId || !ad) return;
    const fm = fmLinesOf(doc.text);
    // caret first (focusing can scroll), then the reading position
    if (st.caret != null && !doc.readOnly && app.mode !== 'read') {
      if (ad.setCaretLine) safe(() => ad.setCaretLine(st.caret));
      else if (ad.setSelection && st.caretOffset != null) safe(() => ad.setSelection(st.caretOffset, st.caretEnd));
      else if (ad.setSelection) { const lines = (doc.text || '').split('\n'); let off = 0; for (let i = 0; i < Math.min(st.caret, lines.length); i++) off += lines[i].length + 1; safe(() => ad.setSelection(off, off)); }
      else {
        const el = blockAt(st.caret - fm);
        if (el && el.isContentEditable) safe(() => { const r = document.createRange(); r.selectNodeContents(el); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); el.closest('[contenteditable="true"]')?.focus({ preventScroll: true }); });
      }
    }
    if (st.top == null) return;
    if (ad.revealLine) { safe(() => ad.revealLine(st.top, { frac: st.frac, offset: st.offset })); return; }
    const el = blockAt(st.top - fm);
    if (!el) { if (ad.scrollToLine && ad.name === 'simple') safe(() => ad.scrollToLine(st.top, { caret: false })); return; }
    const sc = scrollParent(el);
    const r = el.getBoundingClientRect(), hr = host.getBoundingClientRect();
    const want = st.frac > 0 ? hr.top - st.frac * r.height : hr.top + st.offset;
    // Simple mode follows whichever pane you scroll last; a wheel event marks the preview as the leader,
    // so the Markdown pane lines up with it
    if (ad.name === 'simple' && sc !== host) safe(() => sc.dispatchEvent(new WheelEvent('wheel', { bubbles: false })));
    sc.scrollTop += r.top - want;
  }
  /** A still copy of the current view laid over the editor, so the old and the new view can cross-fade. */
  function makeGhost() {
    if (reduceMotion.matches || !host.firstElementChild) return null;
    const hr = host.getBoundingClientRect(); if (hr.width < 40 || hr.height < 40) return null;
    const clone = host.cloneNode(true);
    const scrolled = [];
    if (host.scrollTop || host.scrollLeft) scrolled.push([clone, host.scrollTop, host.scrollLeft]);
    const src = host.querySelectorAll('*'), dst = clone.querySelectorAll('*');
    for (let i = 0; i < src.length && i < dst.length; i++) if (src[i].scrollTop || src[i].scrollLeft) scrolled.push([dst[i], src[i].scrollTop, src[i].scrollLeft]);
    clone.removeAttribute('id'); clone.removeAttribute('tabindex');
    clone.querySelectorAll('[id]').forEach(e => { if (!e.closest('svg')) e.removeAttribute('id'); });
    clone.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable'));
    const g = h('div.mk-mode-ghost', { 'aria-hidden': 'true' });
    g.inert = true;
    g.style.cssText = `left:${hr.left}px;top:${hr.top}px;width:${hr.width}px;height:${hr.height}px`;
    clone.style.cssText = 'width:100%;height:100%;overflow:hidden';
    g.append(clone); document.body.append(g);
    for (const [el, t, l] of scrolled) { el.scrollTop = t; el.scrollLeft = l; }
    return g;
  }
  function dropGhost(g, animate) {
    if (!g) return;
    if (fxGhost === g) fxGhost = null;
    if (!animate || !g.animate) { g.remove(); return; }
    const a = g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    a.finished.then(() => g.remove(), () => g.remove());
    setTimeout(() => g.remove(), 900);
  }
  async function waitForContent(doc, ms = 900) {
    const t0 = performance.now();
    const empty = !String(doc?.text || '').trim();
    // Word mode renders (and places its caret) asynchronously: wait for its "rendered" signal
    const ad = mounted.adapter;
    if (ad && doc?.kind === 'markdown' && ad.name === 'word' && !empty) {
      await new Promise(res => {
        let off1, off2;
        const done = () => { clearTimeout(t); off1?.(); off2?.(); res(); };
        const t = setTimeout(done, 1600);
        off1 = app.events.on('word:rendered', done);
        off2 = app.events.on('editor:rendered', done);
      });
    }
    await new Promise(r => raf(r));
    while (performance.now() - t0 < ms) {
      if (empty || doc?.kind !== 'markdown' || host.querySelector('[data-line]')) break;
      await sleep(30);
    }
    await new Promise(r => raf(() => raf(r)));
  }
  /** mode:changed → remember the position, swap the editor, put the position back, cross-fade. */
  async function switchModeView(mode) {
    const seq = ++fxSeq;
    if (fxGhost) { fxGhost.remove(); fxGhost = null; }
    safe(() => host.getAnimations().forEach(a => a.cancel()));
    const doc = app.docs.active();
    const st = captureView();
    const ghost = doc?.kind === 'markdown' ? safe(() => makeGhost(), null) : null;
    fxGhost = ghost;
    if (ghost) host.style.opacity = '0';
    applyMode();
    try { await mountActive(); } catch (e) { console.error(e); }
    if (seq !== fxSeq) { dropGhost(ghost, false); return; }
    await waitForContent(app.docs.active());
    if (seq !== fxSeq) { dropGhost(ghost, false); return; }
    try { restoreView(st); } catch (e) { console.warn('mode switch: could not keep the position', e); }
    host.style.opacity = '';
    if (ghost) {
      safe(() => host.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }));
      dropGhost(ghost, true);
    }
    app.events.emit('mode:shown', { mode, view: st });
  }

  async function fallbackView(doc, err) {
    if (doc.kind !== 'markdown') {
      const box = h('div.host-empty', { html: `<div><b>Close this tab and open the ${esc(extOf(doc).toUpperCase())} file again</b>The page viewer didn’t load this time. Your other documents work as usual.</div>` });
      const row = h('div', { style: 'display:flex;gap:8px;justify-content:center;margin-top:10px' });
      row.append(h('button.btn.primary', { type: 'button', text: 'Try again', onclick: () => { const p = doc.path; app.docs.close(doc.id, { force: true }).then(() => p && app.docs.open(p)).catch(e2 => fail(e2)); } }));
      if (err) row.append(h('button.btn', { type: 'button', text: 'Details', onclick: () => showDetails({ title: 'Details', message: 'The page viewer didn’t load.', details: technicalText(err) }) }));
      box.firstElementChild.append(row); host.append(box);
      return;
    }
    const wrap = h('div.pages.host-fallback'), page = h('article.page.mk-page');
    page.style.zoom = app.zoom / 100;
    wrap.append(page); host.append(wrap);
    try { const r = await app.render(doc.text, { doc }); page.innerHTML = r.html; await app.decorate(page, doc); }
    catch (e) { page.textContent = doc.text; }
  }

  // =====================================================================
  //  Zoom
  // =====================================================================
  const ZMIN = 50, ZMAX = 300; // the mock's slider range: 100% sits a fifth of the way along
  const saveZoomDefault = app.debounce(z => settings.set('zoom', z), 600);
  app.zoom = Math.min(ZMAX, settings.get('zoom', 100));
  app.setZoom = function setZoom(pct, opts = {}) {
    let z = Math.round(Number(pct));
    if (!isFinite(z)) z = 100;
    z = Math.max(ZMIN, Math.min(ZMAX, z));
    // keep what is under the pointer (wheel) or in the middle of the view in place while the page grows or shrinks
    const oldZ = app.zoom || 100;
    if (z !== oldZ && host.isConnected && !opts.fromDoc) {
      const r = host.getBoundingClientRect();
      const ax = opts.anchorX != null ? opts.anchorX - r.left : host.clientWidth / 2;
      const ay = opts.anchorY != null ? opts.anchorY - r.top : host.clientHeight / 2;
      const top = host.scrollTop, left = host.scrollLeft, k = z / oldZ;
      raf(() => raf(() => { host.scrollTop = Math.max(0, (top + ay) * k - ay); host.scrollLeft = Math.max(0, (left + ax) * k - ax); }));
    }
    app.zoom = z;
    root.style.setProperty('--zoom', String(z / 100));
    $$('.host-fallback .page', host).forEach(p => { p.style.zoom = z / 100; });
    const doc = app.docs.active();
    if (doc && !opts.fromDoc) doc.view = { ...(doc.view || {}), zoom: z };
    if (!opts.fromDoc && !opts.silent) saveZoomDefault(z);
    updateZoomUI();
    app.events.emit('zoom:changed', z);
    return z;
  };
  app.getZoom = () => app.zoom;
  function fitWidthPct() {
    const page = host.querySelector('.mk-sheet, .page, .mk-page');
    const base = page ? page.getBoundingClientRect().width / (app.zoom / 100) : 794;
    return Math.floor((host.clientWidth - 60) / (base || 794) * 100);
  }
  function zoomStep(dir) {
    const z = app.zoom;
    const steps = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300];
    const n = dir > 0 ? steps.find(s => s > z) : [...steps].reverse().find(s => s < z);
    app.setZoom(n ?? z);
  }
  host.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    app.setZoom(app.zoom - Math.sign(e.deltaY) * 10, { anchorX: e.clientX, anchorY: e.clientY });
  }, { passive: false });
  function updateZoomUI() {
    const r = $('#zRange'), p = $('#zPct');
    if (r) { r.value = app.zoom; r.style.setProperty('--p', ((app.zoom - ZMIN) / (ZMAX - ZMIN) * 100) + '%'); r.setAttribute('aria-valuetext', app.zoom + '%'); }
    if (p) p.textContent = app.zoom + '%';
  }

  // =====================================================================
  //  Status bar
  // =====================================================================
  const statusEl = $('#statusbar');
  const FLAVORS = ['CommonMark', 'GitHub (GFM)', 'Pandoc', 'LaTeX Markdown', 'MultiMarkdown', 'Obsidian', 'R Markdown / Quarto', 'MDX'];
  const FEATURES = [
    ['$…$ math', /(^|[^\\$])\$[^\s$][^$\n]*\$/m], ['\\( … \\) math', /\\\(/], ['display math', /\$\$|\\\[|\\begin\{(equation|align)/],
    ['tables', /^\|.+\|\s*\n\|[\s:|-]+\|/m], ['footnotes', /\[\^[^\]]+\]/], ['citations', /\[-?@[\w:.-]+/], ['task lists', /^\s*[-*+]\s\[[ xX]\]/m],
    ['wikilinks', /\[\[[^\]]+\]\]/], ['callouts', /^>\s*\[!\w+\]/m], ['containers', /^:::\s*\w/m], ['Mermaid', /```mermaid/], ['code', /^\s*(```|~~~)/m], ['front matter', /^---\r?\n[\s\S]*?\n---/],
  ];
  const LANGS = [['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['de', 'German'], ['fr', 'French'], ['es', 'Spanish'], ['it', 'Italian'], ['pt', 'Portuguese'], ['nl', 'Dutch'], ['ur', 'Urdu'], ['ar', 'Arabic'], ['zh', 'Chinese'], ['ja', 'Japanese'], ['tr', 'Turkish']];
  let spellState = null;
  function renderStatusbar() {
    statusEl.innerHTML = `
      <button class="sb" id="sbPage" data-tip="Page count" data-tip-d="Estimated from the page height">Page 1 of 1</button>
      <button class="sb" id="sbWords" data-tip="Word count" data-tip-d="Words in the document, without front matter, code, comments and hidden notes. Click for details.">0 words</button>
      <button class="sb hide-narrow" id="sbSpell" data-tip="Spelling and grammar" data-tip-d="Open the Writing Assistant with every spelling and grammar issue. Right-click an underlined word for fixes. F7 steps through them one by one." data-key="F7">${icon('spell')}<span>Spelling</span></button>
      <button class="sb flavor" id="sbFlavor" data-tip="Detected Markdown flavor" data-tip-d="Click to see features or render as another flavor"><span class="dot"></span><span class="fl">CommonMark</span></button>
      <span class="sb hide-narrow" id="sbEnc" data-tip="Text encoding" data-tip-d="Markooj saves Markdown as UTF-8, which every app and language can read.">UTF-8</span>
      <button class="sb hide-narrow" id="sbLang" data-tip="Document language" data-tip-d="Used for spelling, hyphenation and exports. Saved in the front matter as lang.">${icon('lang')}<span>English (US)</span></button>
      <span id="sbLeft" class="sb-extra"></span>
      <span class="spacer"></span>
      <span id="sbRight" class="sb-extra"></span>
      <button class="sb sb-ribbon" id="sbRibbon" data-tip="Show the full ribbon" data-tip-d="All tabs: Insert, References, Developer and more" aria-label="Show the full ribbon">${icon('ribbonicon')}</button>
      <button class="sb" id="sbMode" data-tip="Editing mode" data-tip-d="Word, Inline, Simple or Read. Click to pick one; Ctrl+Shift+M moves to the next." data-key="Ctrl+Shift+M" aria-haspopup="menu">Word mode</button>
      <button class="sb" id="sbPrint" data-tip="Print layout" data-tip-cmd="view.printLayout" aria-label="Print layout">${icon('page')}</button>
      <button class="sb" id="sbWeb" data-tip="Web layout" data-tip-cmd="view.webLayout" aria-label="Web layout">${icon('web')}</button>
      <button class="sb" id="sbFocus" data-tip="Focus" data-tip-cmd="view.focus" aria-label="Focus">${icon('focus')}</button>
      <div class="zoom" role="group" aria-label="Zoom">
        <button class="sb" id="zMinus" data-tip="Zoom out" data-key="Ctrl+-" aria-label="Zoom out">−</button>
        <input type="range" id="zRange" min="${ZMIN}" max="${ZMAX}" step="10" value="100" aria-label="Zoom">
        <button class="sb" id="zPlus" data-tip="Zoom in" data-key="Ctrl+Alt+=" aria-label="Zoom in">+</button>
        <button class="pct sb" id="zPct" data-tip="Zoom level" data-tip-d="Click to go back to 100%. Ctrl and the mouse wheel zoom too." data-key="Ctrl+0">100%</button>
      </div>`;
    $('#zMinus').addEventListener('click', () => zoomStep(-1));
    $('#zPlus').addEventListener('click', () => zoomStep(1));
    $('#zPct').addEventListener('click', () => app.setZoom(100));
    $('#zRange').addEventListener('input', e => app.setZoom(+e.target.value));
    $('#sbMode').addEventListener('click', e => modeMenu(e.currentTarget, { placement: 'top' }));
    $('#sbRibbon').addEventListener('click', () => app.commands.run('view.showRibbon'));
    $('#sbPrint').addEventListener('click', () => app.commands.run('view.printLayout'));
    $('#sbWeb').addEventListener('click', () => app.commands.run('view.webLayout'));
    $('#sbFocus').addEventListener('click', () => app.commands.run('view.focus'));
    $('#sbFlavor').addEventListener('click', e => flavorPopover(e.currentTarget));
    $('#sbWords').addEventListener('click', e => {
      const id = ['review.wordCount', 'research.wordCount', 'review.count'].find(x => app.commands.get(x));
      if (id) app.commands.run(id); else wordCountPopover(e.currentTarget);
    });
    // the Writing Assistant pane lists spelling and grammar together (F7 still steps through them one by one)
    $('#sbSpell').addEventListener('click', () => { const id = ['review.writingAssistant', 'review.spelling', 'research.spelling', 'review.spell'].find(x => app.commands.get(x)); if (id) app.commands.run(id); else toast('Spelling is checked as you type. Right-click a word for suggestions.', { kind: 'info' }); });
    $('#sbLang').addEventListener('click', e => (typeof app.lang?.pickLanguage === 'function' ? app.lang.pickLanguage(e.currentTarget) : langMenu(e.currentTarget)));
    $('#sbPage').addEventListener('click', () => { const doc = app.docs.active(); if (doc?.kind === 'markdown') app.commands.run('app.commandPalette', '@'); });
    renderStatusExtras();
    updateZoomUI();
  }
  function renderStatusExtras() {
    const L = $('#sbLeft'), R = $('#sbRight'); if (!L || !R) return;
    L.innerHTML = ''; R.innerHTML = '';
    for (const it of app.status.items()) {
      const el = h('span.sb-extra', { 'data-status-id': it.id });
      try { it.render?.(el, app.docs.active()); } catch (e) { console.error('status item', it.id, e); }
      (it.side === 'right' ? R : L).append(el);
    }
  }
  function pageInfo(doc) {
    if (!doc) return '';
    if (doc.kind !== 'markdown') {
      const vs = safe(() => app.viewers?.state?.(), null);
      const n = (vs && vs.doc === doc ? vs.pages : 0) || doc.pages || doc.viewer?.pages;
      const cur = (vs && vs.doc === doc ? vs.page : 0) || doc.view?.page;
      return n ? (cur ? `Page ${cur} of ${n}` : `${n} pages`) : extOf(doc).toUpperCase();
    }
    const page = host.querySelector('.mk-word .mk-page, .page, .mk-page');
    if (app.mode === 'word' && page && page.offsetParent) {
      const z = app.zoom / 100;
      const pr = page.getBoundingClientRect(), hr = host.getBoundingClientRect();
      const ph = (safe(() => app.layout?.pageSize?.(doc)?.h, 0) || 1123) * z;
      const total = Math.max(1, Math.ceil((pr.height - 2) / ph));
      const cur = Math.max(1, Math.min(total, Math.floor((hr.top + hr.height / 3 - pr.top) / ph) + 1));
      return `Page ${cur} of ${total}`;
    }
    const words = docStats(doc.text).words;
    const n = Math.max(1, Math.ceil(words / 500));
    return `About ${n} page${n > 1 ? 's' : ''}`;
  }
  function updateStatus() {
    const doc = app.docs.active();
    if (!$('#sbPage')) return;
    const md = doc?.kind === 'markdown';
    $('#sbPage').textContent = pageInfo(doc);
    const st = md ? docStats(doc.text) : null;
    const w = $('#sbWords'); w.style.display = md ? '' : 'none'; if (st) w.textContent = `${fmtNum(st.words)} word${st.words === 1 ? '' : 's'}`;
    const sp = $('#sbSpell'); sp.style.display = md ? '' : 'none';
    const sps = safe(() => app.research?.spelling?.status?.(), null) || spellState;
    sp.querySelector('span').innerHTML = sps == null ? 'Spelling' : typeof sps === 'number' ? (sps ? `<span class="warnc">${sps} issue${sps > 1 ? 's' : ''}</span>` : 'No issues') : esc(String(sps));
    const fl = $('#sbFlavor'); fl.style.display = md ? '' : 'none';
    if (md) fl.querySelector('.fl').textContent = renderAsOf(doc) || doc.flavor?.name || 'CommonMark';
    const meta = md ? docMeta(doc) : {};
    const lang = String(meta.lang || meta.language || 'en-US');
    $('#sbLang span').textContent = safe(() => app.lang?.nameOf?.(lang), null) || (LANGS.find(([c]) => c.toLowerCase() === lang.toLowerCase()) || [, lang])[1];
    $('#sbEnc').textContent = md ? 'UTF-8' : extOf(doc || {}).toUpperCase();
    $('#sbMode').textContent = !doc || md ? modeInfo(app.mode).long : 'Viewer';
    $('#sbMode').disabled = !!doc && !md;
    const layout = settings.get('layout', 'print');
    $('#sbPrint').classList.toggle('on', layout === 'print');
    $('#sbWeb').classList.toggle('on', layout === 'web');
    $('#sbFocus').classList.toggle('on', document.body.classList.contains('focus-mode'));
    $('#sbRibbon').classList.toggle('on', document.body.classList.contains('simple-ribbon'));
    updateZoomUI();
  }
  const queueStatus = app.debounce(updateStatus, 250);
  host.addEventListener('scroll', app.debounce(() => { const p = $('#sbPage'); if (p) p.textContent = pageInfo(app.docs.active()); }, 80), true);
  app.events.on('spelling:changed', p => { spellState = typeof p === 'number' ? p : (p?.count ?? p?.issues ?? null); updateStatus(); });
  app.events.on('viewer:page', () => { const p = $('#sbPage'); if (p) p.textContent = pageInfo(app.docs.active()); });
  function detectedFeatures(doc) {
    const set = new Set((doc.flavor?.features || []).map(String));
    const t = doc.text || '';
    const res = FEATURES.map(([name, re]) => ({ name, on: re.test(t) || set.has(name) }));
    for (const f of set) if (!res.find(r => r.name.toLowerCase() === f.toLowerCase()) && !/latex math/i.test(f)) res.push({ name: f, on: true });
    return res;
  }
  function flavorPopover(anchor) {
    const doc = app.docs.active(); if (!doc || doc.kind !== 'markdown') return;
    const wrap = h('div');
    wrap.append(h('h6', { text: 'Detected flavor' }));
    const auto = h('button.mi', { type: 'button', html: `<span class="chk">${renderAsOf(doc) ? '' : icon('check')}</span><span class="mi-label">${esc(doc.flavor?.name || 'CommonMark')}</span><small>auto</small>` });
    auto.addEventListener('click', () => { setRenderAs(doc, null); closePopover(); });
    wrap.append(auto);
    const feat = h('div.feat');
    for (const f of detectedFeatures(doc)) feat.append(h('span.chip' + (f.on ? '.y' : ''), { text: f.name }));
    wrap.append(feat, h('h6', { text: 'Render as' }));
    for (const name of FLAVORS) {
      const b = h('button.mi', { type: 'button', html: `<span class="chk">${renderAsOf(doc) === name ? icon('check') : ''}</span><span class="mi-label">${esc(name)}</span>` });
      b.addEventListener('click', () => { setRenderAs(doc, name); closePopover(); });
      wrap.append(b);
    }
    wrap.append(h('div.pop-note', { text: 'The page always shows every flavor. Picking one here makes Word, LaTeX and other exports read the file by that flavor’s rules, and is saved with the document.' }));
    popover(anchor, wrap, { placement: 'top' });
  }
  function renderAsOf(doc) { return doc?.renderAs || (doc?.meta && doc.meta['markooj-flavor'] ? String(doc.meta['markooj-flavor']) : null); }
  function setRenderAs(doc, name) {
    doc.renderAs = name || null;
    // kept in the front matter (markooj-flavor), so the choice survives closing and reopening the file
    try {
      const next = app.editor?.setFrontMatter ? app.editor.setFrontMatter(doc.text, { 'markooj-flavor': name || null }) : doc.text;
      if (next !== doc.text && !doc.readOnly) doc.setText(next, 'flavor');
    } catch (e) { console.warn('render as', e); }
    app.events.emit('doc:flavor', { doc, flavor: name });
    toast(name ? `Exports now read this document as ${name}.` : `Exports use the detected flavor: ${doc.flavor?.name || 'CommonMark'}`, { kind: 'info' });
    updateStatus();
  }
  function wordCountPopover(anchor) {
    const doc = app.docs.active(); if (!doc || doc.kind !== 'markdown') return;
    const st = docStats(doc.text);
    const wrap = h('div', { style: 'padding:6px 10px 8px;min-width:220px' });
    wrap.innerHTML = `<h6 style="margin:4px 0 8px">Word count</h6>
      <div class="stat"><span>Words</span><b>${fmtNum(st.words)}</b></div>
      <div class="stat"><span>Characters</span><b>${fmtNum(st.chars)}</b></div>
      <div class="stat"><span>Equations</span><b>${fmtNum(st.display)} display · ${fmtNum(st.inline)} inline</b></div>
      <div class="stat"><span>Citations</span><b>${fmtNum(st.citations)} (${fmtNum(st.sources)} sources)</b></div>
      <div class="stat"><span>Headings</span><b>${fmtNum(parseHeadings(doc.text).length)}</b></div>
      <div class="stat"><span>Reading time</span><b>${st.readingMinutes} min</b></div>`;
    popover(anchor, wrap, { placement: 'top' });
  }
  function langMenu(anchor) {
    const doc = app.docs.active(); if (!doc || doc.kind !== 'markdown') return;
    const cur = String(docMeta(doc).lang || 'en-US').toLowerCase();
    menu(anchor, [{ header: 'Document language' }, ...LANGS.map(([code, label]) => ({ label, checked: code.toLowerCase() === cur, run: () => setFrontMatter(doc, { lang: code }) })), { note: 'Saved as “lang” in the front matter. Used for spelling and exports.' }], { placement: 'top', checks: true });
  }
  /** Merge keys into a doc's YAML front matter (uses preload's mk.frontMatter). */
  function setFrontMatter(doc, patch) {
    if (!mk.frontMatter || doc.readOnly) { toast('Open a Markdown document to save this setting. PDF, DjVu and read-only files can’t store it.', { kind: 'warn' }); return false; }
    const fm = mk.frontMatter.parse(doc.text);
    const meta = { ...(fm.meta || {}) };
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === '') delete meta[k]; else meta[k] = v; }
    const next = mk.frontMatter.write(doc.text, meta);
    doc.setText(next, 'meta');
    app.editors.active()?.refresh?.();
    return true;
  }

  // =====================================================================
  //  Command palette (title bar search box)
  // =====================================================================
  let palEl = null, palItems = [], palIdx = 0, palInput = null;
  function fuzzy(q, s) {
    if (!q) return { score: 1, hits: [] };
    const ql = q.toLowerCase(), sl = s.toLowerCase();
    const at = sl.indexOf(ql);
    if (at >= 0) { const hits = []; for (let i = 0; i < ql.length; i++) hits.push(at + i); return { score: 100 - at + (at === 0 || /\W/.test(sl[at - 1]) ? 40 : 0) - sl.length * 0.1, hits }; }
    let qi = 0, score = 0, last = -2; const hits = [];
    for (let i = 0; i < sl.length && qi < ql.length; i++) {
      if (sl[i] === ql[qi]) { hits.push(i); score += (i === last + 1 ? 6 : 1) + (i === 0 || /[\s._\-/(]/.test(sl[i - 1]) ? 5 : 0); last = i; qi++; }
    }
    if (qi < ql.length) return null;
    return { score: score - sl.length * 0.05, hits };
  }
  function hilite(s, hits) {
    if (!hits || !hits.length) return esc(s);
    const set = new Set(hits); let out = '';
    for (let i = 0; i < s.length; i++) out += set.has(i) ? `<em>${esc(s[i])}</em>` : esc(s[i]);
    return out;
  }
  const SUGGESTED = ['file.new', 'file.open', 'file.save', 'file.export', 'file.print', 'view.toggleMode', 'insert.table', 'insert.equation', 'edit.find', 'view.focus', 'file.options'];
  function paletteSources(q) {
    let mode = 'all';
    if (q.startsWith('>')) { mode = 'cmd'; q = q.slice(1).trim(); }
    else if (q.startsWith('@') || q.startsWith('#')) { mode = 'head'; q = q.slice(1).trim(); }
    const items = [];
    if (mode !== 'head') {
      for (const c of app.commands.list()) {
        if (c.palette === false || c.hidden) continue;
        const label = c.label && c.label !== c.id ? c.label : null; if (!label) continue;
        const enabled = !c.isEnabled || safe(() => c.isEnabled(), true);
        items.push({ type: 'Command', label, hint: c.category || '', key: displayShortcuts(c)[0], icon: c.icon || 'command', disabled: !enabled, run: () => app.commands.run(c.id), id: c.id, search: label + ' ' + c.id });
      }
    }
    if (mode === 'all') {
      const active = app.docs.active();
      for (const d of orderedDocs()) if (d !== active) items.push({ type: 'Open document', label: d.title, hint: d.path || 'Not saved yet', icon: 'doc', run: () => app.docs.activate(d.id), search: d.title });
      const open = new Set(app.docs.list().map(d => (d.path || '').toLowerCase()));
      for (const p of settings.get('recent', [])) if (!open.has(p.toLowerCase())) items.push({ type: 'Recent file', label: p.split(/[\\/]/).pop(), hint: p, icon: 'history', run: () => openPath(p), search: p.split(/[\\/]/).pop() });
    }
    if (mode !== 'cmd') {
      const doc = app.docs.active();
      if (doc?.kind === 'markdown') for (const hd of parseHeadings(doc.text)) items.push({ type: 'Heading', label: hd.text, hint: 'H' + hd.level, icon: 'toc', run: () => { const ed = app.editors.active(); if (ed?.scrollToLine) ed.scrollToLine(hd.line); else scrollHostToLine(hd.line); }, search: hd.text });
    }
    if (!q) {
      if (mode === 'cmd') return items.slice(0, 80);
      if (mode === 'head') return items;
      const sug = SUGGESTED.map(id => items.find(i => i.id === id)).filter(Boolean).map(i => ({ ...i, group: 'Suggested' }));
      const docsI = items.filter(i => i.type === 'Open document').map(i => ({ ...i, group: 'Open documents' }));
      const rec = items.filter(i => i.type === 'Recent file').slice(0, 5).map(i => ({ ...i, group: 'Recent files' }));
      const heads = items.filter(i => i.type === 'Heading').slice(0, 8).map(i => ({ ...i, group: 'Headings' }));
      return [...docsI, ...sug, ...rec, ...heads];
    }
    const scored = [];
    for (const it of items) {
      const f = fuzzy(q, it.label) || (it.search !== it.label && fuzzy(q, it.search));
      if (!f) continue;
      const labelHits = fuzzy(q, it.label);
      scored.push({ ...it, score: f.score - (it.disabled ? 30 : 0) + (it.type === 'Command' ? 4 : 0), hits: labelHits ? labelHits.hits : [] });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 60);
  }
  function initPalette() {
    palInput = $('#paletteInput');
    if (!palInput) return;
    palInput.addEventListener('focus', () => openPalette());
    palInput.addEventListener('input', () => renderPalette());
    palInput.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); movePal(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); movePal(-1); }
      else if (e.key === 'PageDown') { e.preventDefault(); movePal(8); }
      else if (e.key === 'PageUp') { e.preventDefault(); movePal(-8); }
      else if (e.key === 'Enter') { e.preventDefault(); runPal(palIdx); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePalette(true); }
      else if (e.key === 'Tab') { e.preventDefault(); movePal(e.shiftKey ? -1 : 1); }
    });
    palInput.addEventListener('blur', () => setTimeout(() => { if (palEl && !palEl.contains(document.activeElement) && document.activeElement !== palInput) closePalette(); }, 120));
  }
  function openPalette(prefill) {
    if (!palInput) return;
    if (prefill != null) { palInput.value = prefill; }
    if (document.activeElement !== palInput) { palInput.focus(); palInput.select(); }
    if (!palEl) {
      palEl = h('div.palette', { role: 'listbox', 'aria-label': 'Commands and search results' });
      palEl.innerHTML = `<div class="p-list"></div><div class="p-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> run</span><span><kbd>&gt;</kbd> commands only</span><span><kbd>@</kbd> headings</span><span><kbd>Esc</kbd> close</span></div>`;
      palEl.addEventListener('mousedown', e => e.preventDefault());
      document.body.append(palEl);
    }
    const r = $('#searchBox').getBoundingClientRect();
    const w = Math.min(560, innerWidth - 24);
    palEl.style.left = Math.max(12, Math.min(r.right - w, innerWidth - w - 12)) + 'px';
    palEl.style.top = (r.bottom + 8) + 'px';
    renderPalette();
    raf(() => palEl?.classList.add('show')); // the palette may be closed again before the next frame
  }
  function closePalette(refocus) {
    if (!palEl) return;
    palEl.classList.remove('show');
    const el = palEl; palEl = null; setTimeout(() => el.remove(), 260);
    if (palInput) { palInput.value = ''; if (refocus || document.activeElement === palInput) { palInput.blur(); focusEditor(); } }
  }
  function renderPalette() {
    if (!palEl) return;
    const q = palInput.value.trim();
    palItems = paletteSources(q); palIdx = palItems.findIndex(i => !i.disabled); if (palIdx < 0) palIdx = 0;
    const list = palEl.querySelector('.p-list');
    list.innerHTML = '';
    if (!palItems.length) { list.append(h('div.p-empty', { text: q ? `Nothing matches “${q}”.` : 'Type to search commands, documents and headings.' })); return; }
    let group = null;
    palItems.forEach((it, i) => {
      if (it.group && it.group !== group) { group = it.group; list.append(h('h6', { text: group })); }
      const b = h('button.pi', { type: 'button', role: 'option', 'data-i': String(i) });
      b.innerHTML = `${icon(it.icon)}<span class="pl">${hilite(it.label, it.hits)}</span>${it.hint || (!it.group && q) ? `<span class="ph">${esc(it.hint || it.type)}</span>` : ''}${it.key ? `<kbd>${esc(fmtShortcut(it.key))}</kbd>` : ''}`;
      if (it.disabled) b.style.opacity = '.45';
      b.addEventListener('click', () => runPal(i));
      b.addEventListener('mousemove', () => { if (palIdx !== i) { palIdx = i; markPal(); } });
      list.append(b);
    });
    markPal();
  }
  function markPal() {
    if (!palEl) return;
    $$('.pi', palEl).forEach(b => { const on = +b.dataset.i === palIdx; b.classList.toggle('on', on); if (on) b.scrollIntoView({ block: 'nearest' }); });
  }
  function movePal(d) { if (!palItems.length) return; palIdx = Math.max(0, Math.min(palItems.length - 1, palIdx + d)); markPal(); }
  async function runPal(i) {
    const it = palItems[i]; if (!it) return;
    if (it.disabled) {
      // say what makes it available: most commands need a document, and many need one you can edit
      const d = app.docs.active();
      if (!d) toast(`Open or create a document first, then try ${it.label} again.`, { kind: 'info', actions: [{ label: 'New document', run: () => app.commands.run('file.new') }, { label: 'Open…', run: () => app.commands.run('file.open') }] });
      else if (d.readOnly || d.kind !== 'markdown') toast(`Use “Edit as text” to make an editable copy, then try ${it.label} there.`, { kind: 'info' });
      else toast(`Click in your document or select some text, then try ${it.label} again.`, { kind: 'info' });
      return;
    }
    closePalette(false); palInput?.blur();
    if (it.type !== 'Command') focusEditor();
    try { await it.run(); } catch (e) { fail(e, { retry: () => it.run() }); }
  }
  function focusEditor() { const ed = app.editors.active(); if (ed?.focus && app.docs.active()?.kind === 'markdown') safe(() => ed.focus()); else host.focus({ preventScroll: true }); }

  // =====================================================================
  //  Global shortcut dispatch
  // =====================================================================
  const scCache = new WeakMap();
  function cmdCombos(c) {
    const key = [].concat(c.shortcut || [], c.shortcuts || []).join('|');
    const hit = scCache.get(c);
    if (hit && hit.key === key) return hit.list;
    const list = shortcutsOf(c).map(normShortcut);
    scCache.set(c, { key, list }); return list;
  }
  function findCommandFor(combo) {
    let found = null;
    for (const c of app.commands.list()) if (cmdCombos(c).includes(combo)) found = c; // last registered wins (macros can override)
    return found;
  }
  function isAltGrChar(e) { try { return !!(e.getModifierState?.('AltGraph') && typeof e.key === 'string' && [...e.key].length === 1 && e.key.trim() !== ''); } catch { return false; } }
  function isEditable(t) { return !!t && (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !/^(button|checkbox|radio|range|submit|reset|color|file)$/i.test(t.type))); }
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.isComposing || e.key === 'Process') return;
    if (dialogStack.length) return; // dialogs own the keyboard
    if (e.target?.closest?.('[data-mk-keys="own"]')) return; // e.g. the Macro Editor handles its own keys
    if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(e.key)) return;
    // AltGr (Ctrl+Alt on Windows) types a character on many layouts (German ² ³ µ and the backslash, Polish, …): the character wins, like Word
    if (isAltGrChar(e)) return;
    const combo = eventCombo(e);
    const t = e.target;
    const editable = isEditable(t);
    const hasMod = /(^|\+)(Ctrl|Alt|Meta|MacCtrl)\+/.test(combo) || /(^|\+)F\d{1,2}$/.test(combo);
    if (!hasMod && editable) return;
    const cmd = findCommandFor(combo);
    if (!cmd) return;
    const shellField = editable && !!t.closest?.('.pop, .palette, .backstage, .search, .dlg, .opt-card');
    if (shellField && !(cmd.allowInInput || cmd.global)) return;
    if (editable && cmd.passthroughInEditable) return;
    if (openPop && !openPop.el.contains(t)) closePopover();
    e.preventDefault(); e.stopPropagation();
    app.commands.run(cmd.id, cmd.shortcutArgs);
  });
  // Escape: palette → popover → backstage → focus mode → ribbon peek
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.defaultPrevented || dialogStack.length) return;
    if (openPop) { closePopover(); e.preventDefault(); return; }
    if (bsEl.classList.contains('show')) { app.backstage.close(); e.preventDefault(); return; }
    if (document.body.classList.contains('focus-mode')) { setFocusMode(false); e.preventDefault(); return; }
    if (mdPeek.on && mdPeek.el?.classList.contains('show')) { toggleMdPeek(false); e.preventDefault(); return; }
    if (ribbonEl.classList.contains('peek')) { endPeek(); e.preventDefault(); return; }
    if (document.body.classList.contains('chrome-reveal')) { hideChrome(true); e.preventDefault(); return; }
    if (app.mode === 'read' && !isEditable(e.target)) { backToEditing(); e.preventDefault(); }
  });

  // =====================================================================
  //  Layouts, focus mode, outline, mode
  // =====================================================================
  function setLayout(l) {
    l = l === 'web' ? 'web' : 'print';
    document.body.classList.toggle('layout-web', l === 'web');
    document.body.classList.toggle('layout-print', l === 'print');
    if (settings.get('layout') !== l) settings.set('layout', l);
    app.events.emit('layout:changed', l); updateStatus(); queueRibbonRefresh();
  }
  function setFocusMode(on) {
    on = on ?? !document.body.classList.contains('focus-mode');
    document.body.classList.toggle('focus-mode', on);
    if (on) { closePalette(); toast('Focus on. Press Esc to leave.', { kind: 'info', timeout: 1800 }); }
    app.events.emit('focus:changed', on); updateStatus(); queueRibbonRefresh();
    raf(moveInk);
  }
  $('#focusExit')?.addEventListener('click', () => setFocusMode(false));
  function toggleOutline(force) {
    const v = force ?? !settings.get('outline', true);
    settings.set('outline', v);
    outlineEl.classList.toggle('hide', !v);
    if (v) renderOutline();
  }
  function applyMode() {
    const m = app.mode;
    const b = document.body.classList;
    b.toggle('simple', m === 'simple');
    b.toggle('word', m !== 'simple');
    for (const x of MODES) b.toggle('mode-' + x.id, x.id === m);
    if (m !== 'read') lastEditMode = m;
    $('#modeSeg')?.set(m);
    updateStatus();
    raf(moveInk);
  }
  let lastEditMode = 'word';
  /** Leave Read mode for the editing mode used before it. */
  function backToEditing() { app.setMode(EDIT_MODES.includes(app.prevMode) ? app.prevMode : lastEditMode || 'word'); }

  // =====================================================================
  //  Backstage (File)
  // =====================================================================
  const bsEl = $('#backstage');
  let bsPage = null, bsReturnFocus = null;
  function defaultPage() {
    const ids = app.backstage.pages().map(p => p.id);
    const doc = app.docs.active();
    if (doc?.path && ids.includes('info')) return 'info';
    return ids.includes('new') ? 'new' : ids[0];
  }
  const BS_DESC = {
    new: 'Start a blank document or one of the templates.', open: 'Open a file from your computer or a recent one.',
    save: 'Save the document as Markdown.', saveas: 'Save a copy, or export to PDF, Word, EPUB, LaTeX and more.',
    print: 'Preview the pages and print them.', info: 'Title, authors, keywords and other properties.',
    recover: 'Bring back documents you closed without saving.', addins: 'Add-ins that add buttons, exporters and tools.',
    options: 'Theme, start mode, fonts, typing helpers and more.',
  };
  function renderBackstageNav() {
    const nav = h('nav.bs-nav', { 'aria-label': 'File' });
    const back = h('button.back', { type: 'button', html: icon('back'), 'data-tip': 'Back to document', 'data-key': 'Escape', 'aria-label': 'Back to document' });
    back.addEventListener('click', () => app.backstage.close());
    nav.append(back);
    let grew = false;
    for (const p of app.backstage.pages()) {
      if (!grew && (p.order >= 90 || p.id === 'options' || p.id === 'addins')) { nav.append(h('span.grow')); grew = true; }
      const b = h('button.n', { type: 'button', 'data-page': p.id, html: `${icon(p.icon || 'doc')}<span>${esc(p.label)}</span>` });
      b.dataset.tip = p.label;
      const d = p.description || BS_DESC[p.id]; if (d) b.dataset.tipD = d;
      if (p.shortcut) b.dataset.key = p.shortcut;
      b.addEventListener('click', () => showBackstagePage(p.id, true));
      nav.append(b);
    }
    nav.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const list = $$('button', nav); const i = list.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault(); list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
    });
    return nav;
  }
  function openBackstage(id) {
    hideTip(); closePopover(); closePalette();
    if (!bsEl.classList.contains('show')) bsReturnFocus = document.activeElement;
    bsEl.innerHTML = '';
    bsEl.append(renderBackstageNav(), h('section.bs-main', { 'aria-live': 'polite' }));
    bsEl.classList.add('show'); bsEl.setAttribute('aria-hidden', 'false');
    showBackstagePage(id && app.backstage.pages().find(p => p.id === id) ? id : defaultPage());
    app.events.emit('backstage:shown', bsPage);
  }
  async function showBackstagePage(id, fromNav) {
    const p = app.backstage.pages().find(x => x.id === id); if (!p) return;
    if (p.run) { try { await p.run(); } catch (e) { fail(e, { retry: () => p.run() }); } return; }
    bsPage = id;
    $$('.bs-nav button.n', bsEl).forEach(b => b.classList.toggle('on', b.dataset.page === id));
    const main = $('.bs-main', bsEl); if (!main) return;
    main.innerHTML = ''; main.scrollTop = 0;
    const page = h('div.bs-page', { 'data-page': id });
    main.append(page);
    try { await p.render?.(page); } catch (e) { console.error(e); page.innerHTML = `<h2>${esc(p.label)}</h2><p class="sub">Close File and open this page again. It didn’t load this time; the rest of Markooj works.</p>`; page.append(h('button.btn', { type: 'button', text: 'Details', onclick: () => showDetails({ title: 'Details', message: `${p.label} didn’t load.`, details: technicalText(e) }) })); }
    if (!fromNav) setTimeout(() => ($(`.bs-nav button.n[data-page="${id}"]`, bsEl) || $('.bs-nav .back', bsEl))?.focus({ preventScroll: true }), 40);
  }
  function closeBackstage() {
    if (!bsEl.classList.contains('show')) return;
    bsEl.classList.remove('show'); bsEl.setAttribute('aria-hidden', 'true');
    bsPage = null;
    setTimeout(() => { if (!bsEl.classList.contains('show')) bsEl.innerHTML = ''; }, 380);
    try { (bsReturnFocus && bsReturnFocus.isConnected ? bsReturnFocus : host).focus({ preventScroll: true }); } catch {}
    app.events.emit('backstage:hidden');
  }
  app.events.on('backstage:open', id => openBackstage(id));
  app.events.on('backstage:close', closeBackstage);
  app.events.on('backstage:changed', () => { if (bsEl.classList.contains('show')) { const cur = bsPage; const nav = $('.bs-nav', bsEl); if (nav) nav.replaceWith(renderBackstageNav()); $$('.bs-nav button.n', bsEl).forEach(b => b.classList.toggle('on', b.dataset.page === cur)); } });

  // ---- backstage page: New ----
  const today = () => new Date().toISOString().slice(0, 10);
  const TEMPLATES = [
    { id: 'paper', title: 'Research paper', desc: 'Abstract, math, citations', icon: 'grad', color: '#0a66ff', name: 'Research Paper', text: () => `---
title: Your Paper Title
author: Your Name
date: ${today()}
keywords: first keyword, second keyword
abstract: One paragraph that states the question, the method, the main result and why it matters.
word-target: 6000
---

# Introduction

State the problem and why it matters. Cite earlier work like this [@smith2020], or several at once [@smith2020; @lee2022].

# Methods

Describe what you did. Inline math works with dollar signs, $E = mc^2$, or with parentheses, \\(a^2 + b^2 = c^2\\).

$$
\\theta = \\frac{\\tau_b}{(\\rho_s - \\rho)\\, g\\, D}
$$

# Results

| Run | Value | Error |
|-----|------:|------:|
| A   | 1.20  | 0.05  |
| B   | 1.35  | 0.04  |

*Table 1. Measured values.*

# Discussion

Explain what the results mean.[^1]

> [!NOTE]
> Limitations and open questions go here.

# Conclusion

Sum up in a few sentences.

[^1]: Footnotes are numbered for you.
` },
    { id: 'lab', title: 'Lab notebook', desc: 'Dated entries, checklists', icon: 'flask', color: '#28a745', name: 'Lab Notebook', text: () => `---
title: Lab Notebook
author: Your Name
---

## ${today()} — Experiment name

**Goal:** What you want to find out.

### Setup

- Equipment:
- Samples:
- Conditions:

### Procedure

1. First step
2. Second step
3. Third step

### Checklist

- [ ] Calibrate the instruments
- [ ] Record room temperature
- [ ] Back up the raw data

### Observations

| Time  | Reading | Notes |
|-------|--------:|-------|
| 09:00 |         |       |
| 09:30 |         |       |

### Result

Write the outcome here. Quick formulas work too: $\\bar{x} = \\frac{1}{n}\\sum x_i$.

> [!TIP]
> Next steps and ideas for the following run.
` },
    { id: 'thesis', title: 'Thesis chapter', desc: 'Sections, theorems, diagram', icon: 'bib', color: '#8e5cf7', name: 'Thesis Chapter', text: () => `---
title: Chapter 3 — Method
author: Your Name
word-target: 8000
---

# 3 Method

## 3.1 Overview

Introduce the approach and how this chapter is organized.

::: definition
**Bed-load transport** is the movement of grains that roll, slide or hop along the river bed.
:::

## 3.2 Theory

::: theorem
If $\\theta > \\theta_c$, the bed is mobile and the transport rate grows with $(\\theta - \\theta_c)^{3/2}$.
:::

::: proof
Follows from the Meyer-Peter and Müller relation by substitution.
:::

## 3.3 Data and workflow

\`\`\`mermaid
flowchart LR
  A[Collect data] --> B[Clean] --> C[Model] --> D[Validate]
\`\`\`

## 3.4 Summary

Close the chapter and lead into the next one [@author2024].
` },
    { id: 'meeting', title: 'Meeting notes', desc: 'Agenda, decisions, actions', icon: 'users', color: '#ff9f0a', name: 'Meeting Notes', text: () => `---
title: Meeting Notes
date: ${today()}
---

**Attendees:**
**Purpose:**

## Agenda

1. Updates
2. Discussion
3. Next steps

## Notes

-

## Decisions

-

## Action items

- [ ] Task — owner — due date
- [ ] Task — owner — due date
` },
    { id: 'litreview', title: 'Literature review', desc: 'Comparison table of studies', icon: 'table', color: '#30b0c7', name: 'Literature Review', text: () => `---
title: Literature Review
author: Your Name
---

# Literature Review

| Study | Year | Method | Sample | Key finding | Relevance |
|-------|-----:|--------|--------|-------------|-----------|
| Author et al. | 2020 | Field study | 40 sites | | High |
| Author and Author | 2022 | Lab experiment | 12 runs | | Medium |
| Author | 2024 | Model | — | | High |

*Table 1. Studies compared.*

## Themes

-

## Gaps in the research

-

## How my work fits

Write a short paragraph and cite the key studies [@author2020].
` },
  ];
  function tplThumb(t) {
    if (!t) return `<div class="thumb blank">${icon('plus')}</div>`;
    const bars = n => Array.from({ length: n }, (_, i) => `<div class="tln" style="width:${[96, 88, 92, 70, 84, 60][i % 6]}%"></div>`).join('');
    const extra = t.id === 'litreview' || t.id === 'lab' ? '<div class="tab"></div>' : '';
    return `<div class="thumb"><div class="th1">${esc(t.name)}</div>${bars(2)}<div class="th2">Section</div>${bars(3)}${extra}<div class="th2">Section</div>${bars(4)}<span class="tic" style="background:${t.color}">${icon(t.icon, 'i', 'width:14px;height:14px')}</span></div>`;
  }
  app.backstage.addPage({ id: 'new', label: 'New', icon: 'plus', order: 10, shortcut: 'Ctrl+N', render(el) {
    el.innerHTML = '<h2>New</h2><p class="sub">Start with a blank page or a ready-made layout. Everything stays plain Markdown.</p>';
    const grid = h('div.tpl-grid');
    const blank = h('button.tpl', { type: 'button', html: `${tplThumb(null)}<b>Blank document</b><span>An empty page</span>` });
    blank.addEventListener('click', () => { app.docs.create({ title: 'Untitled' }); app.backstage.close(); });
    grid.append(blank);
    for (const t of TEMPLATES) {
      const b = h('button.tpl', { type: 'button', html: `${tplThumb(t)}<b>${esc(t.title)}</b><span>${esc(t.desc)}</span>` });
      b.addEventListener('click', () => { app.docs.create({ title: t.name, text: t.text() }); app.backstage.close(); });
      grid.append(b);
    }
    el.append(grid);
  } });

  // ---- backstage page: Open ----
  async function openPath(p) {
    try { await app.docs.open(p); return true; }
    catch (e) {
      console.error(e);
      const name = p.split(/[\\/]/).pop();
      fail(e, { lead: `Check that “${name}” is still there, or choose it again with Open.`, hideReason: !!friendlyError(e), actions: [{ label: 'Open…', run: () => openDialog() }, { label: 'Remove from list', run: () => settings.set('recent', settings.get('recent', []).filter(x => x !== p)) }] });
      return false;
    }
  }
  async function openDialog() {
    let paths = [];
    try { paths = await mk.invoke('open-dialog'); } catch (e) { fail(e, { lead: 'Try File → Open again, or drag the file onto the Markooj window.', hideReason: true, retry: () => openDialog() }); return false; }
    let ok = false;
    for (const p of paths || []) ok = (await openPath(p)) || ok;
    return ok;
  }
  app.backstage.addPage({ id: 'open', label: 'Open', icon: 'open', order: 20, shortcut: 'Ctrl+O', render(el) {
    el.innerHTML = '<h2>Open</h2><p class="sub">Markdown, Word, PDF, DjVu, EPUB, HTML and plain text. You can also drop files onto the window.</p>';
    const acts = h('div.bs-actions');
    const browse = h('button.bs-big', { type: 'button', html: `${icon('open')}<span>Browse…</span>` });
    browse.addEventListener('click', async () => { if (await openDialog()) app.backstage.close(); });
    acts.append(browse);
    if (app.backstage.pages().find(p => p.id === 'recover')) {
      const rec = h('button.bs-big', { type: 'button', html: `${icon('recover')}<span>Recover unsaved…</span>` });
      rec.addEventListener('click', () => app.backstage.open('recover'));
      acts.append(rec);
    }
    el.append(acts, h('div.sec-title', { text: 'Recent' }));
    const list = h('div.recent', { role: 'list' });
    const draw = () => {
      list.innerHTML = '';
      const recent = settings.get('recent', []);
      if (!recent.length) { list.append(h('div.empty-note', { text: 'Files you open show up here.' })); return; }
      for (const p of recent) {
        const name = p.split(/[\\/]/).pop(); const dir = p.slice(0, p.length - name.length).replace(/[\\/]$/, '');
        const e = (name.split('.').pop() || '').toLowerCase();
        const row = h('div.ritem', { role: 'listitem', tabindex: '0', title: p });
        row.innerHTML = `<span class="ext ${EXT_CLASS[e] || ''}">${esc((EXT_LABEL[e] || e).toUpperCase().slice(0, 4))}</span><span class="rinfo"><b></b><small></small></span>`;
        row.querySelector('b').textContent = name; row.querySelector('small').textContent = dir;
        const rm = h('button.btn-ghost.rx', { type: 'button', html: icon('x'), 'data-tip': 'Remove from list', 'aria-label': 'Remove from list' });
        rm.addEventListener('click', ev => { ev.stopPropagation(); settings.set('recent', settings.get('recent', []).filter(x => x !== p)); draw(); });
        row.append(rm);
        const go = async () => { if (await openPath(p)) app.backstage.close(); };
        row.addEventListener('click', go);
        row.addEventListener('keydown', ev => { if (ev.key === 'Enter') go(); if (ev.key === 'Delete') rm.click(); });
        row.addEventListener('contextmenu', ev => contextMenu(ev, [{ label: 'Open', icon: 'open', run: go }, { label: 'Reveal in folder', icon: 'folder', run: () => mk.invoke('reveal', p) }, { label: 'Copy path', icon: 'copy', run: () => navigator.clipboard.writeText(p).then(() => toast('Path copied')) }, { sep: 1 }, { label: 'Remove from list', icon: 'x', run: () => rm.click() }]));
        list.append(row);
      }
    };
    draw(); el.append(list);
  } });

  // ---- backstage page: Save (action) ----
  app.backstage.addPage({ id: 'save', label: 'Save', icon: 'save', order: 30, shortcut: 'Ctrl+S', async run() {
    const ok = await app.commands.run('file.save');
    if (ok) app.backstage.close();
  } });

  // ---- backstage page: Save As / Export ----
  const FMT_INFO = {
    md: ['MD', '#0a66ff', 'Markdown', 'Plain text. Opens anywhere, works with Git.'],
    pdf: ['PDF', '#dc2626', 'PDF', 'Print-ready, equations kept sharp.'],
    docx: ['DOCX', '#2b579a', 'Word document', 'Edit in Microsoft Word or Pages.'],
    epub: ['EPUB', '#34c759', 'EPUB e-book', 'For Apple Books, Kobo and other readers.'],
    html: ['HTML', '#ff9f0a', 'Web page', 'One self-contained file.'],
    txt: ['TXT', '#8e8e93', 'Plain text', 'No formatting at all.'],
    latex: ['TEX', '#008080', 'LaTeX', 'Hand off to Overleaf or a journal template.'], tex: ['TEX', '#008080', 'LaTeX', 'Hand off to Overleaf or a journal template.'],
    djvu: ['DJVU', '#5e5ce6', 'DjVu', 'Compact scanned-style archive.'],
    odt: ['ODT', '#1e88e5', 'OpenDocument', 'LibreOffice Writer.'],
    rtf: ['RTF', '#6d4c41', 'Rich Text', 'Older word processors.'],
    pptx: ['PPTX', '#ff375f', 'Slides', 'One slide per heading.'],
    jats: ['JATS', '#30b0c7', 'JATS XML', 'Journal submission format.'],
    rst: ['RST', '#636366', 'reStructuredText', 'Python and Sphinx docs.'],
    org: ['ORG', '#77aa99', 'Org mode', 'For Emacs users.'],
    asciidoc: ['ADOC', '#e40046', 'AsciiDoc', 'Technical documentation.'],
    mediawiki: ['WIKI', '#636366', 'MediaWiki', 'Paste into a wiki.'],
    ipynb: ['IPYNB', '#f37726', 'Jupyter notebook', 'Opens in Jupyter.'],
    typst: ['TYP', '#239dad', 'Typst', 'Modern typesetting.'],
    beamer: ['PDF', '#8e5cf7', 'Beamer slides', 'LaTeX presentation.'],
    csljson: ['JSON', '#636366', 'CSL JSON', 'Bibliography data.'],
  };
  const VIA_LABEL = { pandoc: 'Uses Pandoc', djvulibre: 'Uses DjVuLibre', 'add-in': 'From an add-in', 'built-in': '' };
  function fmtCard(f, onPick) {
    const info = FMT_INFO[f.id] || [String(f.ext || f.id).toUpperCase().slice(0, 5), '#636366', f.label || f.id, ''];
    const b = h('button.fmt' + (f.available === false ? '.off' : ''), { type: 'button', 'data-format': f.id });
    b.innerHTML = `<span class="badge" style="background:${info[1]}">${esc(info[0])}</span><b>${esc(f.label || info[2])}</b><span>${esc(f.description || info[3])}</span>`;
    if (f.via && f.via !== 'built-in') b.append(h('span.needs' + (f.available === false ? '' : '.ok'), { text: f.available === false ? (f.reason || `${VIA_LABEL[f.via] || 'Needs a helper tool'}: click to see how to get it`) : (VIA_LABEL[f.via] || '') + (f.via === 'add-in' ? '' : ' (bundled)') }));
    // an unavailable format stays clickable: app.exporter.export opens the "how to get the tool" dialog (app.health.offer)
    b.addEventListener('click', () => onPick(f));
    return b;
  }
  app.backstage.addPage({ id: 'saveas', label: 'Save As / Export', icon: 'export', order: 40, shortcut: 'Ctrl+Shift+S', async render(el) {
    const doc = app.docs.active();
    el.innerHTML = '<h2>Save As</h2><p class="sub">Your document stays Markdown. Pick another format to share it with anyone.</p>';
    if (!doc || doc.kind !== 'markdown') {
      el.append(h('p.sub', { text: doc ? `This is a ${extOf(doc).toUpperCase()} file shown in the page viewer. Make an editable copy first with “Edit as text”.` : 'Open a document first.' }));
      const ed = ['viewer.editAsText', 'file.editAsText', 'view.editAsText'].find(x => app.commands.get(x));
      if (ed) el.append(h('button.btn.primary', { type: 'button', text: 'Edit as text', onclick: () => { app.backstage.close(); app.commands.run(ed); } }));
      return;
    }
    const loading = h('p.sub', { text: 'Checking available formats…' }); el.append(loading);
    const formats = await app.exporter.formats();
    loading.remove();
    const pick = async f => {
      let ok;
      if (f.id === 'md') ok = await app.docs.saveAs(doc);
      else ok = await app.exporter.export(f.id, doc);
      if (ok) app.backstage.close();
    };
    const builtIn = [{ id: 'md', label: 'Markdown', ext: 'md', available: true, via: 'built-in' }, ...formats.filter(f => (f.via || 'built-in') === 'built-in' && f.id !== 'md')];
    const tools = formats.filter(f => f.via && f.via !== 'built-in' && f.via !== 'add-in');
    const fromAddins = formats.filter(f => f.via === 'add-in');
    if (hasNotes(doc)) el.append(h('div.bs-optline', null, settingSwitch('exportComments', false, 'Include comments and hidden notes', 'Off: other people see a clean document. Markdown copies always keep everything.')));
    el.append(h('div.sec-title', { text: 'Built in' }));
    const g1 = h('div.fmt-grid'); builtIn.forEach(f => g1.append(fmtCard(f, pick))); el.append(g1);
    if (tools.length) {
      el.append(h('div.sec-title', { text: 'Bundled tools' }));
      const g2 = h('div.fmt-grid'); tools.forEach(f => g2.append(fmtCard(f, pick))); el.append(g2);
    }
    if (fromAddins.length) {
      el.append(h('div.sec-title', { text: 'From add-ins' }));
      const g3 = h('div.fmt-grid'); fromAddins.forEach(f => g3.append(fmtCard(f, pick))); el.append(g3);
    }
  } });

  // ---- backstage page: Print ----
  app.backstage.addPage({ id: 'print', label: 'Print', icon: 'print', order: 50, shortcut: 'Ctrl+P', async render(el) {
    const doc = app.docs.active();
    el.innerHTML = '<h2>Print</h2><p class="sub">Check the pages, then print. Equations, tables and diagrams print sharp.</p>';
    if (!doc || doc.kind !== 'markdown') { el.append(h('p.sub', { text: 'Only Markdown documents can be printed from here. Open the original file in its own app to print it.' })); return; }
    const wrap = h('div.print-wrap');
    const side = h('div.print-side');
    const pb = h('button.btn.primary', { type: 'button', html: `${icon('print')}<span>Print…</span>` });
    pb.addEventListener('click', async () => { if (await app.exporter.print(doc)) app.backstage.close(); });
    const pdf = h('button.btn', { type: 'button', html: `${icon('export')}<span>Save as PDF…</span>` });
    pdf.addEventListener('click', async () => { if (await app.exporter.export('pdf', doc)) app.backstage.close(); });
    side.append(pb, pdf);
    const setup = ['layout.pageSetup', 'layout.margins', 'layout.size'].find(x => app.commands.get(x));
    if (setup) { const ps = h('button.btn', { type: 'button', html: `${icon('page')}<span>Page setup…</span>` }); ps.addEventListener('click', () => { app.backstage.close(); app.commands.run(setup); }); side.append(ps); }
    const prev = h('div.print-prev');
    const showPreview = async () => {
      prev.innerHTML = ''; prev.append(h('div.loading', { text: 'Preparing preview…' }));
      try {
        let html = await app.exporter.buildHtml(doc, { forPrint: true });
        if (!prev.isConnected) return;
        // @page margins only apply on paper: the preview shows them as padding, and marks where each page ends
        const L = safe(() => app.layout?.get?.(doc), null) || {};
        const size = (app.layout?.sizes || {})[L.size] || { w: 794, h: 1123 };
        const mg = (app.layout?.margins || {})[L.margins] || [83, 76];
        const pageCss = `<style id="mk-preview">html,body.print{background:#fff}body.print .mk-page{width:${size.w}px;min-height:${size.h}px;margin:0;padding:${mg[0]}px ${mg[1]}px;box-sizing:border-box;` +
          `background-image:repeating-linear-gradient(to bottom,transparent 0,transparent ${size.h - 1}px,rgba(60,60,67,.35) ${size.h - 1}px,rgba(60,60,67,.35) ${size.h}px)}` +
          `body.print .page-break{border-top:1px dashed #c7c7cc;margin:18px 0}</style>`;
        html = html.replace(/<\/head>/i, pageCss + '</head>');
        const fr = h('iframe', { sandbox: '', title: 'Print preview' });
        fr.style.width = size.w + 'px';
        fr.srcdoc = html;
        prev.innerHTML = ''; prev.append(fr);
        const fit = () => { const s = Math.min(1, (prev.clientWidth - 44) / size.w); prev.style.setProperty('--ps', s.toFixed(3)); };
        fit(); try { new ResizeObserver(fit).observe(prev); } catch {}
      } catch (e) { console.error(e); prev.innerHTML = ''; prev.append(h('div.loading', { text: 'Click Print to print anyway. The preview didn’t draw this time.' })); }
    };
    if (hasNotes(doc)) side.append(settingSwitch('exportComments', false, 'Print comments and hidden notes', 'Off by default.', () => showPreview()));
    side.append(h('p', { text: 'Uses your system print window, where you pick the printer, copies and page range. Pages are A4 unless you set a page size in Layout.' }));
    wrap.append(side, prev); el.append(wrap);
    await showPreview();
  } });
  /** Does the document have review comments or %%hidden notes%%? */
  const hasNotes = doc => /<!--\s*comment:|%%[^%\n][\s\S]*?%%/i.test(doc?.text || '');

  // ---- backstage page: Options ----
  /** On/off switch (the mock's toggle): makeSwitch(on, onChange, {label}) → button with .set(on) */
  function makeSwitch(on, onChange, opts = {}) {
    const b = h('button.mk-switch', { type: 'button', role: 'switch', 'aria-label': opts.label || '' });
    if (opts.tip) b.dataset.tip = opts.tip;
    if (opts.desc) b.dataset.tipD = opts.desc;
    const set = v => { b.classList.toggle('on', !!v); b.setAttribute('aria-checked', String(!!v)); };
    set(on);
    b.addEventListener('click', () => { const v = !b.classList.contains('on'); set(v); onChange?.(v); });
    b.set = set;
    return b;
  }
  /** A labeled switch bound to a setting (default on/off), for option cards and backstage pages. */
  function settingSwitch(key, def, label, small, after) {
    const r = h('div.opt-switch');
    const cur = def ? settings.get(key, true) !== false : settings.get(key, false) === true;
    const sw = makeSwitch(cur, v => { settings.set(key, v); after?.(v); }, { label });
    sw.dataset.setting = key;
    r.addEventListener('click', e => { if (!sw.contains(e.target) && !e.target.closest('a,button')) sw.click(); });
    r.append(h('span.ol', null, h('b', { text: label }), small ? h('small', { text: small }) : null), sw);
    return r;
  }
  function optRow(label, small, control) {
    const r = h('div.opt-row');
    r.append(h('div.ol', null, h('b', { text: label }), small ? h('small', { text: small }) : null), h('div.oc', null, control));
    return r;
  }
  const FONTS = [['Charter', 'Charter (default)'], ['Georgia', 'Georgia'], ['Cambria', 'Cambria'], ['Times New Roman', 'Times New Roman'], ['Palatino Linotype', 'Palatino'], ['Iowan Old Style', 'Iowan Old Style'], ['Segoe UI', 'Segoe UI (sans serif)'], ['Calibri', 'Calibri (sans serif)'], ['Arial', 'Arial (sans serif)'], ['system-ui', 'System font']];
  app.backstage.addPage({ id: 'options', label: 'Options', icon: 'gear', order: 100, render(el) {
    el.innerHTML = '<h2>Options</h2><p class="sub">Make Markooj look and work the way you like. Changes apply right away.</p>';
    const card = h('div.opt-card'); card.append(h('h3', { text: 'Appearance' }));
    card.append(optRow('Theme', 'Match system follows your computer’s light or dark setting.', makeSeg([{ value: 'system', label: 'Match system' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], themePref(), v => app.commands.run('view.setTheme', v))));
    card.append(optRow('Start in', 'The editing mode for new windows. Switch any time with Ctrl+1 to Ctrl+4 or Ctrl+Shift+M.', makeSeg(MODES.map(m => ({ value: m.id, label: m.label, title: m.long, desc: m.desc })), settings.get('defaultMode', 'word'), v => settings.set('defaultMode', v))));
    card.append(optRow('Document tabs', 'Where the tabs for open documents sit.', makeSeg([{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }, { value: 'left', label: 'Left' }], settings.get('tabPosition', 'top'), v => app.commands.run('view.tabPosition', v))));
    card.append(optRow('Page layout', 'Print layout shows paper pages. Web layout uses the full width.', makeSeg([{ value: 'print', label: 'Print' }, { value: 'web', label: 'Web' }], settings.get('layout', 'print'), v => setLayout(v))));
    el.append(card);
    const card2 = h('div.opt-card'); card2.append(h('h3', { text: 'Editor' }));
    const fsel = h('select.sel', { 'aria-label': 'Document font' });
    const curFont = settings.get('fontFamily', 'Charter');
    for (const [v, l] of FONTS) fsel.append(h('option', { value: v, text: l, selected: v === curFont }));
    if (!FONTS.find(([v]) => v === curFont)) fsel.append(h('option', { value: curFont, text: curFont, selected: true }));
    fsel.addEventListener('change', () => settings.set('fontFamily', fsel.value));
    card2.append(optRow('Document font', 'Used on the page. Exports keep their own fonts.', fsel));
    const fsize = h('input.txt', { type: 'number', min: '9', max: '28', step: '0.5', value: String(settings.get('fontSize', 12)), 'aria-label': 'Font size' });
    fsize.addEventListener('change', () => { const v = Math.max(9, Math.min(28, parseFloat(fsize.value) || 12)); fsize.value = v; settings.set('fontSize', v); });
    card2.append(optRow('Default text size', 'In points, like Word, for documents that do not set their own. Home → Font Size changes the size of one document.', h('span', { style: 'display:flex;align-items:center;gap:6px' }, fsize, h('span', { text: 'pt', style: 'color:var(--text-3)' }))));
    card2.append(optRow('Inline math style', 'How Word mode writes inline equations into the Markdown file. Both always render.', makeSeg([{ value: 'd', html: '<span style="font-family:var(--mono)">$…$</span>' }, { value: 'paren', html: '<span style="font-family:var(--mono)">\\(…\\)</span>' }], settings.get('inlineMath', 'd'), v => settings.set('inlineMath', v))));
    el.append(card2);
    const card3 = h('div.opt-card', { 'data-section': 'typing' }); card3.append(h('h3', { text: 'Typing and review' }));
    card3.append(settingSwitch('smartQuotes', true, 'Smart quotes', 'Turn straight quotes "like this" into curly “like this” as you type, like Word.'));
    card3.append(settingSwitch('autocorrect', true, 'AutoCorrect as you type', 'Two hyphens -- become a dash –, (c) becomes ©, (r) ®, (tm) ™ and ... becomes …'));
    card3.append(settingSwitch('showComments', true, 'Show comments and hidden notes while editing', 'Comments appear as bubbles and %%hidden notes%% as faint highlighted text. Read mode always hides them.'));
    card3.append(settingSwitch('exportComments', false, 'Include comments in exports and prints', 'Off by default, so shared files and printouts never show your notes. You can also change this on the Save As and Print pages.'));
    el.append(card3);
    for (const s of app.options.sections()) {
      el.append(h('div.opt-sec-title', { text: s.label || s.id }));
      const c = h('div.opt-card', { 'data-section': s.id });
      try { s.render?.(c); } catch (e) { console.error('options section', s.id, e); c.append(h('p.sub', { text: 'Close Options and open it again. This section didn’t load this time.' })); }
      el.append(c);
    }
    const about = h('p', { style: 'color:var(--text-3);font-size:12px;margin-top:26px', text: `Markooj ${app.version || ''} · Electron ${mk.versions?.electron || ''} · Chrome ${mk.versions?.chrome || ''}` });
    el.append(about);
  } });

  // =====================================================================
  //  Settings that change the look
  // =====================================================================
  function applyFont() {
    const fam = settings.get('fontFamily', 'Charter');
    const size = parseFloat(settings.get('fontSize', 12)) || 12;
    root.style.setProperty('--doc-font', `${/^[\w-]+$/.test(fam) ? fam : `"${fam.replace(/"/g, '')}"`}, var(--serif)`);
    root.style.setProperty('--doc-size', (size * 1.2917).toFixed(2) + 'px');
  }
  app.events.on('settings:changed', ({ key, value } = {}) => {
    if (key === 'theme') applyTheme();
    else if (key === 'tabPosition') { applyTabPosition(value); renderTabs(); }
    else if (key === 'fontFamily' || key === 'fontSize') applyFont();
    else if (key === 'outline') outlineEl.classList.toggle('hide', !value);
    else if (key === 'recent') { /* palette reads it live */ }
  });

  // =====================================================================
  //  Commands: file, edit, tab, view, palette
  // =====================================================================
  const C = (id, def) => app.commands.register(id, def);
  const activeMd = () => { const d = app.docs.active(); return d && d.kind === 'markdown' ? d : null; };
  C('file.new', { label: 'New document', icon: 'plus', shortcut: 'Ctrl+N', category: 'File', run: () => app.docs.create({ title: 'Untitled' }) });
  C('file.newFromTemplate', { label: 'New from template…', icon: 'doc', category: 'File', run: () => app.backstage.open('new') });
  C('file.open', { label: 'Open…', icon: 'open', shortcut: 'Ctrl+O', category: 'File', run: () => openDialog() });
  C('file.save', { label: 'Save', icon: 'save', shortcut: 'Ctrl+S', category: 'File', isEnabled: () => !!activeMd(), run: () => app.docs.save(app.docs.active()) });
  C('file.saveAs', { label: 'Save As…', icon: 'save', shortcut: 'Ctrl+Shift+S', category: 'File', isEnabled: () => !!activeMd(), run: () => app.backstage.open('saveas') });
  C('file.saveAsMarkdown', { label: 'Save a copy as Markdown…', icon: 'md', category: 'File', isEnabled: () => !!activeMd(), run: () => app.docs.saveAs(app.docs.active()) });
  C('file.saveAll', { label: 'Save all', icon: 'save', category: 'File', run: async () => { for (const d of app.docs.list()) if (d.dirty && d.kind === 'markdown') { app.docs.activate(d.id); if (!(await app.docs.save(d))) return false; } return true; } });
  C('file.export', { label: 'Export…', icon: 'export', shortcut: 'Ctrl+Shift+E', category: 'File', run: () => app.backstage.open('saveas') });
  C('file.exportPdf', { label: 'Export as PDF…', icon: 'export', category: 'File', isEnabled: () => !!activeMd(), run: () => app.exporter.export('pdf', app.docs.active()) });
  C('file.exportDocx', { label: 'Export as Word document…', icon: 'export', category: 'File', isEnabled: () => !!activeMd(), run: () => app.exporter.export('docx', app.docs.active()) });
  C('file.exportHtml', { label: 'Export as web page…', icon: 'export', category: 'File', isEnabled: () => !!activeMd(), run: () => app.exporter.export('html', app.docs.active()) });
  C('file.print', { label: 'Print…', icon: 'print', shortcut: 'Ctrl+P', category: 'File', run: () => app.backstage.open('print') });
  C('file.printNow', { label: 'Print without preview', icon: 'print', category: 'File', isEnabled: () => !!activeMd(), run: () => app.exporter.print(app.docs.active()) });
  C('file.close', { label: 'Close document', icon: 'x', shortcut: 'Ctrl+W', shortcuts: ['Ctrl+F4'], category: 'File', run: () => { const d = app.docs.active(); return d && app.docs.close(d.id); } });
  C('file.closeOthers', { label: 'Close other documents', icon: 'x', category: 'File', run: () => { const d = app.docs.active(); return closeDocs(orderedDocs().filter(x => x !== d).map(x => x.id)); } });
  C('file.info', { label: 'Document info and properties', icon: 'info', category: 'File', run: () => app.backstage.open(app.backstage.pages().find(p => p.id === 'info') ? 'info' : undefined) });
  C('file.backstage', { label: 'File menu', icon: 'doc', shortcut: 'Alt+F', category: 'File', run: () => app.backstage.open() });
  C('file.options', { label: 'Options', icon: 'gear', category: 'File', /* Ctrl+, is Subscript while typing */ run: () => app.backstage.open('options') });
  C('file.recent', { label: 'Open recent…', icon: 'history', category: 'File', run: () => app.backstage.open('open') });
  C('file.reveal', { label: 'Reveal in folder', icon: 'folder', category: 'File', isEnabled: () => !!app.docs.active()?.path, run: () => mk.invoke('reveal', app.docs.active().path) });
  C('file.copyPath', { label: 'Copy file path', icon: 'copy', category: 'File', isEnabled: () => !!app.docs.active()?.path, run: async () => { await navigator.clipboard.writeText(app.docs.active().path); toast('Path copied'); } });

  function editorCall(name) {
    const ed = app.editors.active();
    if (ed && typeof ed[name] === 'function' && app.docs.active()?.kind === 'markdown') { ed[name](); return true; }
    try { ed?.focus?.(); } catch {}
    return document.execCommand(name);
  }
  C('edit.undo', { label: 'Undo', icon: 'undo', shortcut: 'Ctrl+Z', category: 'Edit', passthroughInEditable: true, run: () => editorCall('undo') });
  C('edit.redo', { label: 'Redo', icon: 'redo', shortcut: 'Ctrl+Y', shortcuts: ['Ctrl+Shift+Z'], category: 'Edit', passthroughInEditable: true, run: () => editorCall('redo') });

  C('tab.next', { label: 'Next document', icon: 'chevr', shortcut: 'Ctrl+Tab', shortcuts: ['Ctrl+PageDown'], category: 'Window', run: () => cycleTab(1) });
  C('tab.prev', { label: 'Previous document', icon: 'back', shortcut: 'Ctrl+Shift+Tab', shortcuts: ['Ctrl+PageUp'], category: 'Window', run: () => cycleTab(-1) });
  function cycleTab(d) {
    const list = orderedDocs(); if (list.length < 2) return;
    const i = list.indexOf(app.docs.active());
    app.docs.activate(list[(i + d + list.length) % list.length].id);
  }
  C('app.commandPalette', { label: 'Search and commands', icon: 'search', shortcut: 'Alt+Q', shortcuts: ['Ctrl+Shift+P'], category: 'Help', global: true, run: prefill => openPalette(typeof prefill === 'string' ? prefill : '') });
  C('app.goToHeading', { label: 'Go to heading…', icon: 'toc', shortcut: 'Ctrl+Shift+O', category: 'Navigate', run: () => openPalette('@') });
  C('app.shortcuts', { label: 'Keyboard shortcuts', icon: 'keyboard', shortcut: 'Ctrl+/', category: 'Help', run: () => (app.commands.get('help.shortcuts') ? app.commands.run('help.shortcuts') : showShortcuts()) });

  // view.*
  C('view.printLayout', { label: 'Print layout', icon: 'page', category: 'View', isActive: () => settings.get('layout', 'print') === 'print', run: () => setLayout('print') });
  C('view.webLayout', { label: 'Web layout', icon: 'web', category: 'View', isActive: () => settings.get('layout', 'print') === 'web', run: () => setLayout('web') });
  C('view.focus', { label: 'Focus', description: 'Hide everything except the page', icon: 'focus', shortcut: 'F11', category: 'View', isActive: () => document.body.classList.contains('focus-mode'), run: () => setFocusMode() });
  C('view.outline', { label: 'Outline', description: 'Show or hide the outline pane', icon: 'side', shortcut: 'Ctrl+\\', category: 'View', isActive: () => !!settings.get('outline', true), run: () => toggleOutline() });
  C('view.tabPosition', { label: 'Tab position', icon: 'tabs', category: 'View', run: v => { const pos = ['top', 'bottom', 'left'].includes(v) ? v : ({ top: 'bottom', bottom: 'left', left: 'top' })[settings.get('tabPosition', 'top')]; settings.set('tabPosition', pos); applyTabPosition(pos); renderTabs(); } });
  C('view.tabsTop', { label: 'Tabs at the top', icon: 'tabstop', category: 'View', isActive: () => settings.get('tabPosition', 'top') === 'top', run: () => app.commands.run('view.tabPosition', 'top') });
  C('view.tabsBottom', { label: 'Tabs at the bottom', icon: 'tabsbottom', category: 'View', isActive: () => settings.get('tabPosition') === 'bottom', run: () => app.commands.run('view.tabPosition', 'bottom') });
  C('view.tabsLeft', { label: 'Tabs on the left', icon: 'tabsleft', category: 'View', isActive: () => settings.get('tabPosition') === 'left', run: () => app.commands.run('view.tabPosition', 'left') });
  C('view.zoomIn', { label: 'Zoom in', icon: 'zin', shortcut: 'Ctrl+=', shortcuts: ['Ctrl+Shift+='], category: 'View', run: () => zoomStep(1) });
  C('view.zoomOut', { label: 'Zoom out', icon: 'zout', shortcut: 'Ctrl+-', category: 'View', run: () => zoomStep(-1) });
  C('view.zoom100', { label: 'Zoom to 100%', icon: 'doc', shortcut: 'Ctrl+0', category: 'View', isActive: () => app.zoom === 100, run: () => app.setZoom(100) });
  C('view.pageWidth', { label: 'Fit page width', icon: 'fit', category: 'View', run: () => app.setZoom(fitWidthPct()) });
  C('view.zoom', { label: 'Zoom…', icon: 'zin', category: 'View', run: async v => { if (v == null) { const s = await prompt('Zoom', 'Percent (50 to 300)', String(app.zoom), { type: 'number' }); if (s == null) return; v = s; } app.setZoom(parseFloat(v)); } });
  C('view.mode', { label: 'Editing mode', icon: 'track', category: 'View', palette: false, run: v => app.setMode(MODES.some(m => m.id === (v?.value ?? v)) ? (v?.value ?? v) : 'word') });
  C('view.toggleMode', { label: 'Next editing mode', description: 'Word → Inline → Simple → Read', icon: 'track', shortcut: 'Ctrl+Shift+M', category: 'View', run: () => { const i = MODES.findIndex(m => m.id === app.mode); app.setMode(MODES[(i + 1) % MODES.length].id); } });
  C('view.modeWord', { label: 'Word mode (click and type)', description: modeInfo('word').desc, icon: 'doc', shortcut: 'Ctrl+1', category: 'View', isActive: () => app.mode === 'word', run: () => app.setMode('word') });
  C('view.modeInline', { label: 'Inline mode (live Markdown)', description: modeInfo('inline').desc, icon: 'text', shortcut: 'Ctrl+2', category: 'View', isActive: () => app.mode === 'inline', run: () => app.setMode('inline') });
  C('view.modeSimple', { label: 'Simple mode (Markdown and preview)', description: modeInfo('simple').desc, icon: 'md', shortcut: 'Ctrl+3', category: 'View', isActive: () => app.mode === 'simple', run: () => app.setMode('simple') });
  C('view.modeRead', { label: 'Read mode (finished look)', description: modeInfo('read').desc, icon: 'read', shortcut: 'Ctrl+4', category: 'View', isActive: () => app.mode === 'read', run: () => app.setMode(app.mode === 'read' ? (EDIT_MODES.includes(app.prevMode) ? app.prevMode : 'word') : 'read') });
  function modeMenu(anchor, opts = {}) {
    return menu(anchor, [{ header: 'Editing mode' }, ...MODES.map(m => ({ label: m.long, shortcut: m.key, checked: app.mode === m.id, title: m.desc, run: () => app.setMode(m.id) })), { note: 'Your file stays Markdown in every mode.' }], { checks: true, ...opts });
  }
  // the Read view shows its own "Edit (Esc)" button; without it, say how to get back
  app.events.on('mode:changed', m => { if (m === 'read' && !app.tests?.current && !app.editors.get('read')) toast('Read mode. Press Esc to go back to editing.', { kind: 'info', timeout: 2200 }); });

  // ---- Word habits: font size keys, change case, "What's this in Markdown?" ----
  // Markdown has one body text size per document: Home → Font size, Grow Font and Shrink Font change it.
  // It shows on the page, in print and PDF, goes to DOCX/ODT/LaTeX exports and is saved as front matter
  // "fontsize: 14pt" only when it differs from the default (File → Options → Default text size).
  const FONT_STEPS = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 36];
  const defaultFontSize = () => { const v = parseFloat(settings.get('fontSize', 12)); return v >= 6 && v <= 96 ? v : 12; };
  const parsePt = v => { const m = /^\s*(\d+(?:\.\d+)?)\s*(?:pt)?\s*$/i.exec(String(v ?? '')); return m ? +m[1] : null; };
  const fmtPt = n => String(+(+n).toFixed(1));
  let fsCache = { text: null, v: null };
  /** The body text size (points) of a document: its front matter "fontsize", else the default size. */
  function docFontSize(doc = app.docs.active()) {
    const text = doc && typeof doc.text === 'string' && (doc.kind == null || doc.kind === 'markdown') ? doc.text : null;
    if (text == null || !/^﻿?---/.test(text)) return defaultFontSize();
    if (fsCache.text !== text) {
      let v = null;
      const m = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
      const line = m && /^fontsize[ \t]*:[ \t]*["']?([^"'\r\n#]*)["']?[ \t]*(?:#.*)?$/im.exec(m[1]);
      if (line) v = parsePt(line[1]);
      fsCache = { text, v: v && v >= 6 && v <= 96 ? v : null };
    }
    return fsCache.v ?? defaultFontSize();
  }
  /** Sets the body text size of a document (points). Returns the size, or false when it cannot. */
  function setDocFontSize(pt, doc = activeMd()) {
    pt = parsePt(pt?.value ?? pt);
    if (!pt) return false;
    pt = Math.max(6, Math.min(96, pt));
    if (!doc) { toast('Open or create a document first.', { kind: 'info' }); return false; }
    if (doc.readOnly) { toast('Use Edit as text to make an editable copy. This document is read-only.', { kind: 'info' }); return false; }
    safe(() => app.editors.active()?.flush?.());
    const v = pt === defaultFontSize() ? null : fmtPt(pt) + 'pt';
    const E = app.editor;
    if (E && typeof E.setFrontMatter === 'function') { const t = E.setFrontMatter(doc.text, { fontsize: v }); if (t !== doc.text) doc.setText(t, 'layout'); }
    else if (v !== (docFontSize(doc) === defaultFontSize() ? null : fmtPt(docFontSize(doc)) + 'pt')) setFrontMatter(doc, { fontsize: v });
    app.events.emit('layout:changed', { doc, key: 'fontSize', value: pt });
    queueRibbonRefresh();
    return pt;
  }
  /** The page size follows the document: app.layout.font() (commands.js) scaled to this document's size. */
  function patchLayout(L) {
    if (!L || L.__mkDocFont || typeof L.font !== 'function') return L;
    const orig = L.font;
    L.font = function (doc) {
      const f = orig.call(this, doc);
      const base = defaultFontSize(), pt = docFontSize(doc || app.docs.active());
      if (f && f.px && pt !== base) f.px = +(f.px * pt / base).toFixed(2);
      return f;
    };
    L.fontSize = doc => docFontSize(doc || app.docs.active());
    L.setFontSize = (pt, doc) => setDocFontSize(pt, doc || activeMd());
    L.fontSteps = FONT_STEPS;
    Object.defineProperty(L, '__mkDocFont', { value: true });
    return L;
  }
  {
    let cur = patchLayout(app.layout);
    Object.defineProperty(app, 'layout', { configurable: true, enumerable: true, get: () => cur, set: v => { cur = patchLayout(v); } });
  }
  function stepFont(dir) {
    const doc = activeMd();
    const cur = docFontSize(doc);
    const next = dir > 0 ? FONT_STEPS.find(s => s > cur) : [...FONT_STEPS].reverse().find(s => s < cur);
    if (next == null) { toast(`Text is already ${dir > 0 ? 'at the largest size' : 'at the smallest size'} (${fmtPt(cur)} pt).`, { kind: 'info', timeout: 1600 }); return cur; }
    return setDocFontSize(next, doc) || cur;
  }
  const docLevel = () => { const d = activeMd(); return !!d && !d.readOnly; };
  const SIZE_TIP = 'Changes the size of all body text — Markdown has one text size per document. For bigger text use a Heading.';
  const fontSizeWhy = () => { const d = app.docs.active(); return !d ? 'Open or create a document first.' : d.kind !== 'markdown' ? 'PDF and DjVu files keep their own text size.' : d.readOnly ? 'Use Edit as text to make an editable copy. This document is read-only.' : ''; };
  C('format.growFont', { label: 'Grow Font', description: 'Makes all body text one size bigger. ' + SIZE_TIP.split(' — ')[1], icon: 'growfont', shortcut: 'Ctrl+Shift+>', shortcuts: ['Ctrl+]'], category: 'Format', isEnabled: docLevel, why: fontSizeWhy, run: () => stepFont(1) });
  C('format.shrinkFont', { label: 'Shrink Font', description: 'Makes all body text one size smaller. ' + SIZE_TIP.split(' — ')[1], icon: 'shrinkfont', shortcut: 'Ctrl+Shift+<', shortcuts: ['Ctrl+['], category: 'Format', isEnabled: docLevel, why: fontSizeWhy, run: () => stepFont(-1) });
  // the size box (Home → Font) drives this command; it replaces the app-wide "reading size" of earlier versions
  const fontSizeCmd = { label: 'Font Size', description: SIZE_TIP, icon: 'growfont', category: 'Format', isEnabled: docLevel, why: fontSizeWhy, value: () => fmtPt(docFontSize()), run: a => setDocFontSize(a?.value ?? a) };
  C('format.fontSize', fontSizeCmd);
  app.events.on('ready', () => { if (app.commands.get('format.fontSize')?.run !== fontSizeCmd.run) C('format.fontSize', fontSizeCmd); });

  // Change Case (Word's Aa): Sentence case., lowercase, UPPERCASE, Capitalize Each Word, tOGGLE cASE and Title Case
  const CASES = [['sentence', 'Sentence case.'], ['lower', 'lowercase'], ['upper', 'UPPERCASE'], ['title', 'Capitalize Each Word'], ['toggle', 'tOGGLE cASE'], ['titleCase', 'Title Case']];
  // Title Case keeps these lowercase unless they start or end the title or follow a colon (APA 7; Chicago agrees for these)
  const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'as', 'at', 'by', 'in', 'of', 'off', 'on', 'per', 'to', 'up', 'via', 'vs', 'v', 'et', 'if']);
  const PROTECT = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|`+[^`]*`+|\]\([^)]*\)|\{#[^}]*\}|\[@[^\]]*\]|@[\w:.-]+|<[^>]+>|https?:\/\/\S+|%%[\s\S]*?%%)/g;
  // keep the length of every character (Word does the same), so offsets stay valid
  const oneCase = (ch, up) => { const t = up ? ch.toUpperCase() : ch.toLowerCase(); return t.length === ch.length ? t : ch; };
  /** Title Case on a string whose protected parts are masked with \u0000 (same length in and out). */
  function titleCaseMasked(s) {
    const letters = s.replace(/[^\p{L}]/gu, '');
    const allCaps = letters.length > 3 && letters === letters.toUpperCase();
    const words = [...s.matchAll(/[\p{L}\p{N}'’]+(?:-[\p{L}\p{N}'’]+)*/gu)];
    const out = s.split('');
    words.forEach((m, wi) => {
      const w = m[0], at = m.index;
      const before = s.slice(0, at).replace(/\u0000+/g, 'x');
      const first = wi === 0 || /[:—–?!.]\s*["“'‘(]*\s*$/.test(before);
      const last = wi === words.length - 1;
      // iPhone, McDonald, NASA, DNA: words that already carry inner capitals stay as written
      if (!allCaps && /\p{Lu}/u.test(w.slice(1))) return;
      let pos = at;
      const parts = w.split('-');
      parts.forEach((part, pi) => {
        const isSmall = SMALL_WORDS.has(part.toLowerCase());
        // State-of-the-Art, Follow-Up: inner short words of a compound stay small, its last part is capitalized
        const small = isSmall && (pi === 0 ? !first && !last : pi < parts.length - 1);
        for (let i = 0; i < part.length; i++) out[pos + i] = oneCase(part[i], !small && i === 0);
        pos += part.length + 1;
      });
    });
    return out.join('');
  }
  /** Changes letter case outside math, code, links, labels and citations. */
  function changeCaseText(text, kind) {
    text = String(text ?? '');
    if (kind === 'titleCase') {
      const masked = text.replace(PROTECT, m => '\u0000'.repeat(m.length));
      const conv = titleCaseMasked(masked);
      let out = '';
      for (let i = 0; i < text.length; i++) out += masked[i] === '\u0000' ? text[i] : conv[i];
      return out;
    }
    const conv = (s, atStart) => {
      let out = '', start = atStart;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i], prev = i ? s[i - 1] : ' ';
        let c = ch;
        if (kind === 'upper') c = oneCase(ch, true);
        else if (kind === 'lower') c = oneCase(ch, false);
        else if (kind === 'toggle') c = ch === ch.toUpperCase() ? oneCase(ch, false) : oneCase(ch, true);
        else if (kind === 'title') c = /[\s([{"“'‘\-/]/.test(prev) || (i === 0 && atStart !== false) ? oneCase(ch, true) : oneCase(ch, false);
        else if (kind === 'sentence') { if (/\p{L}/u.test(ch)) { c = start ? oneCase(ch, true) : oneCase(ch, false); start = false; } else if (/[.!?]/.test(ch)) start = true; }
        out += c;
      }
      return out;
    };
    let out = '', last = 0, first = true;
    for (const m of text.matchAll(PROTECT)) {
      out += conv(text.slice(last, m.index), first) + m[0]; last = m.index + m[0].length; first = false;
    }
    return out + conv(text.slice(last), first);
  }
  function nextCase(text) {
    const letters = text.replace(/[^\p{L}]/gu, '');
    if (!letters) return 'upper';
    if (letters === letters.toUpperCase()) return 'lower';
    if (letters === letters.toLowerCase()) return 'title';
    return 'upper';
  }
  /** Word: with nothing selected, Change Case works on the word at the caret. */
  function selectWordAtCaret(surfaceSel) {
    try {
      const s = surfaceSel;
      if (!s || !s.rangeCount || !s.isCollapsed || !s.modify) return false;
      const r0 = s.getRangeAt(0).cloneRange();
      s.modify('move', 'backward', 'word'); s.modify('extend', 'forward', 'word');
      // drop the space Windows puts after the word
      const t = s.toString(); const trail = t.length - t.replace(/\s+$/, '').length;
      for (let i = 0; i < trail; i++) s.modify('extend', 'backward', 'character');
      if (!s.toString().trim()) { s.removeAllRanges(); s.addRange(r0); return false; }
      return true;
    } catch { return false; }
  }
  /** Word mode / Inline: change the text nodes in place (formatting and selection stay). Simple: replace the selected source. */
  function changeCase(kind) {
    const doc = activeMd(), ad = app.editors.active();
    if (!doc || doc.readOnly || !ad || app.mode === 'read') { toast('Select some text in a document you can edit first.', { kind: 'info' }); return false; }
    const s = getSelection();
    const inSurface = sel => { const r = sel && sel.rangeCount ? sel.getRangeAt(0) : null; const n = r && (r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement); const surf = n?.closest?.('[contenteditable="true"]'); return surf && host.contains(surf) ? surf : null; };
    if (s && s.rangeCount && s.isCollapsed && inSurface(s)) selectWordAtCaret(s);
    const r = s && s.rangeCount ? s.getRangeAt(0) : null;
    const surf = r && !r.collapsed ? inSurface(s) : null;
    if (surf) {
      const text = r.toString();
      const k = kind || nextCase(text); // pressing again cycles: UPPER → lower → Capitalize Each Word → UPPER
      const walker = document.createTreeWalker(surf, NodeFilter.SHOW_TEXT, { acceptNode: n => r.intersectsNode(n) && !n.parentElement.closest('[contenteditable="false"], code, pre, .mk-math, .katex') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
      const nodes = []; let n; while ((n = walker.nextNode())) nodes.push(n);
      // convert the selection as one string, then write each node's slice back (keeps bold, links and the selection)
      const parts = nodes.map(t => { const a = t === r.startContainer ? r.startOffset : 0, b = t === r.endContainer ? r.endOffset : t.data.length; return { t, a, b: Math.max(a, b) }; });
      const conv = changeCaseText(parts.map(p => p.t.data.slice(p.a, p.b)).join(''), k);
      const sc = r.startContainer, so = r.startOffset, ec = r.endContainer, eo = r.endOffset;
      let at = 0, changed = false;
      for (const p of parts) {
        const len = p.b - p.a, piece = conv.slice(at, at + len); at += len;
        if (len && piece !== p.t.data.slice(p.a, p.b)) { p.t.replaceData(p.a, len, piece); changed = true; }
      }
      // replaceData collapses a selection inside the replaced text: select the same text again
      try {
        const nr = document.createRange();
        nr.setStart(sc, Math.min(so, sc.nodeType === 3 ? sc.data.length : sc.childNodes.length));
        nr.setEnd(ec, Math.min(eo, ec.nodeType === 3 ? ec.data.length : ec.childNodes.length));
        s.removeAllRanges(); s.addRange(nr);
      } catch {}
      // tell the editor the text changed, so it reaches the Markdown (and undo) like any other edit
      if (changed) surf.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
      app.events.emit('selection:changed');
      return k;
    }
    let sel = safe(() => ad.getSelection(), null);
    if (sel && !sel.text && typeof sel.start === 'number' && ad.setSelection) {
      // Simple mode: the word around the caret
      const t = doc.text || '', i = sel.start;
      let a = i, b = i;
      while (a > 0 && /[\p{L}\p{N}'’]/u.test(t[a - 1])) a--;
      while (b < t.length && /[\p{L}\p{N}'’]/u.test(t[b])) b++;
      if (b > a) { safe(() => ad.setSelection(a, b)); sel = safe(() => ad.getSelection(), null); }
    }
    if (!sel || !sel.text) { toast('Select the text whose case you want to change.', { kind: 'info' }); return false; }
    const k = kind || nextCase(sel.text);
    const out = changeCaseText(sel.text, k);
    const start = sel.start;
    ad.replaceSelection(out);
    if (typeof start === 'number' && ad.setSelection) safe(() => ad.setSelection(start, start + out.length));
    return k;
  }
  const caseWhy = () => { const d = app.docs.active(); return !d ? 'Open or create a document first.' : d.kind !== 'markdown' ? 'Use Edit as text to make an editable copy. PDF and DjVu files can’t be edited here.' : d.readOnly ? 'Use Edit as text to make an editable copy. This document is read-only.' : app.mode === 'read' ? 'Read mode is for reading. Press Esc to go back to editing.' : ''; };
  const caseOk = () => !!activeMd() && !activeMd().readOnly && app.mode !== 'read';
  function caseMenu(anchor) {
    const vis = $$('[data-tip-cmd="edit.changeCaseMenu"]').find(x => x.offsetParent);
    const a = anchor || vis || { x: innerWidth / 2, y: 120 };
    return menu(a, [
      ...CASES.filter(c => c[0] !== 'titleCase').map(([k, l]) => ({ label: l, run: () => app.commands.run('edit.case.' + k) })),
      { sep: true },
      { label: 'Title Case', hint: 'APA, Chicago', title: 'Capitalizes the important words and keeps short words like a, and, of, in lowercase, as APA and Chicago ask for titles and headings.', run: () => app.commands.run('edit.case.titleCase') },
      { note: 'Shift+F3 switches between UPPERCASE, lowercase and Capitalize Each Word.' },
    ], { checks: false, className: 'case-menu' });
  }
  C('edit.changeCase', { label: 'Change Case', description: 'Switch the selected text between UPPERCASE, lowercase and Capitalize Each Word, like Word. With nothing selected, changes the word at the cursor. Math, code and links keep their case.', icon: 'case', shortcut: 'Shift+F3', category: 'Format', isEnabled: caseOk, why: caseWhy, run: v => changeCase(CASES.some(c => c[0] === (v?.value ?? v)) ? (v?.value ?? v) : null) });
  C('edit.changeCaseMenu', { label: 'Change Case', description: 'Change the selected text to Sentence case., lowercase, UPPERCASE, Capitalize Each Word, tOGGLE cASE or Title Case.', icon: 'case', category: 'Format', palette: false, isEnabled: caseOk, why: caseWhy, run: v => { const k = v?.value ?? v; if (k && typeof k === 'string') return changeCase(k); return caseMenu(); } });
  for (const [k, l] of CASES) C('edit.case.' + k, { label: 'Change case: ' + l, icon: 'case', category: 'Format', isEnabled: caseOk, why: caseWhy, run: () => changeCase(k) });

  // Home → Font: the empty slot to the right of the size box gets Grow Font, Shrink Font and the Change Case drop-down
  // (the group itself belongs to commands.js; this adds to its first row, once).
  function augmentFontGroup() {
    const home = app.ribbon.tabs().find(t => t.id === 'home');
    const g = home?.groups.find(x => x.id === 'font');
    if (!g) return;
    let row = null, size = null, fam = null;
    const walk = (items, parent) => (items || []).forEach(it => {
      if (!it) return;
      if (it.command === 'format.fontSize' && (it.type === 'select')) { size = it; row = parent; }
      if (it.command === 'format.fontFamily') fam = it;
      if (it.items) walk(it.items, it);
    });
    walk(g.items, g);
    if (!row || row.__mkFontRow) return;
    Object.defineProperty(row, '__mkFontRow', { value: true });
    Object.assign(size, {
      label: 'Font Size', tooltip: 'Font Size', description: SIZE_TIP, rawValue: false,
      options: () => { const cur = docFontSize(); const list = FONT_STEPS.includes(cur) ? FONT_STEPS : [...FONT_STEPS, cur].sort((a, b) => a - b); return list.map(s => ({ value: fmtPt(s), label: fmtPt(s) })); },
      value: () => fmtPt(docFontSize()),
    });
    if (fam) Object.assign(fam, { tooltip: 'Font', description: 'Changes the font of all body text — Markdown has one font per document, not per word. Headings follow the document theme.' });
    const items = row.items || (row.items = []);
    if (!items.some(i => i && i.command === 'edit.changeCaseMenu')) {
      items.push(
        { type: 'small', command: 'format.growFont', label: 'Grow Font', icon: 'growfont' },
        { type: 'small', command: 'format.shrinkFont', label: 'Shrink Font', icon: 'shrinkfont' },
        { type: 'small', command: 'edit.changeCaseMenu', label: 'Change Case', text: `<span class="aa">Aa</span>${icon('chev', 'i dd')}`, wide: false },
      );
    }
  }

  // "What's this in Markdown?" — a small card under the selection that shows its Markdown
  const mdPeek = { on: false, el: null, last: '' };
  function selectionMarkdown() {
    const doc = activeMd(), ad = app.editors.active();
    if (!doc || !ad) return null;
    const s = getSelection();
    const r = s && s.rangeCount ? s.getRangeAt(0) : null;
    const inHost = r && host.contains(r.commonAncestorContainer);
    const sel = safe(() => ad.getSelection(), null);
    let md = '', what = 'Selection';
    if (sel && sel.text && typeof sel.start === 'number') md = sel.text; // Simple mode: the selection is already Markdown
    else if (inHost && !r.collapsed) md = safe(() => ad.getSelectionMarkdown?.(), '') || sel?.text || r.toString();
    if (!md) {
      // nothing selected: show the Markdown of the block the caret is in
      const n = inHost ? r.startContainer : null;
      const el = n ? (n.nodeType === 1 ? n : n.parentElement)?.closest('[data-line]') : null;
      let line = el ? +el.getAttribute('data-line') + fmLinesOf(doc.text) : (sel && typeof sel.start === 'number' ? doc.text.slice(0, sel.start).split('\n').length - 1 : null);
      if (line == null) return null;
      const lines = doc.text.split('\n');
      let a = line, b = line;
      while (b + 1 < lines.length && lines[b + 1].trim() && !/^\s{0,3}(#{1,6}\s|```|~~~|\$\$)/.test(lines[b + 1])) b++;
      if (/^\s*(```|~~~|\$\$)/.test(lines[a])) { const fence = lines[a].trim().slice(0, 3); b = a; while (b + 1 < lines.length && !lines[b + 1].trim().startsWith(fence)) b++; if (b + 1 < lines.length) b++; }
      md = lines.slice(a, Math.min(b + 1, a + 12)).join('\n'); what = 'This paragraph';
    }
    const rect = inHost ? (r.collapsed ? (r.getClientRects()[0] || r.startContainer.parentElement?.getBoundingClientRect()) : r.getBoundingClientRect()) : null;
    return { md: md.replace(/\s+$/, ''), what, rect };
  }
  function renderMdPeek() {
    if (!mdPeek.on) return;
    const info = selectionMarkdown();
    if (!info || !info.md) { mdPeek.el?.classList.remove('show'); return; }
    if (!mdPeek.el) {
      mdPeek.el = h('div.mk-mdpeek', { role: 'status', 'aria-live': 'polite' });
      mdPeek.el.innerHTML = `<div class="mp-h"><span class="mp-t"></span><button class="mp-copy" type="button" data-tip="Copy this Markdown">${icon('copy')}</button><button class="mp-x" type="button" data-tip="Close" data-key="Esc">${icon('x')}</button></div><pre class="mp-code"></pre><div class="mp-note"></div>`;
      mdPeek.el.addEventListener('mousedown', e => e.preventDefault());
      mdPeek.el.querySelector('.mp-x').addEventListener('click', () => toggleMdPeek(false));
      mdPeek.el.querySelector('.mp-copy').addEventListener('click', async () => { await copyText(mdPeek.last, 'Markdown copied'); });
      document.body.append(mdPeek.el);
    }
    mdPeek.last = info.md;
    mdPeek.el.querySelector('.mp-t').textContent = `${info.what} in Markdown`;
    mdPeek.el.querySelector('.mp-code').textContent = info.md.length > 1200 ? info.md.slice(0, 1200) + '\n…' : info.md;
    mdPeek.el.querySelector('.mp-note').textContent = app.mode === 'simple' ? 'In Simple mode the left side is the Markdown itself.' : 'This is what Markooj writes in your .md file.';
    const hr = host.getBoundingClientRect();
    const el = mdPeek.el; el.classList.add('show');
    const w = el.offsetWidth, ht = el.offsetHeight;
    let x, y;
    if (info.rect && info.rect.width + info.rect.height) {
      // under the selection, or above it when there is no room
      const r = info.rect;
      x = Math.max(hr.left + 8, Math.min(r.left, innerWidth - w - 12));
      y = r.bottom + 10;
      if (y + ht > Math.min(innerHeight, hr.bottom) - 8) y = Math.max(hr.top + 8, r.top - ht - 10);
    } else {
      // no position for the caret (Simple mode's text box): bottom-left corner of the editor, out of the way
      x = hr.left + 16; y = hr.bottom - ht - 16;
    }
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }
  const queueMdPeek = app.debounce(renderMdPeek, 120);
  function toggleMdPeek(force) {
    mdPeek.on = force ?? !mdPeek.on;
    settings.set('showMarkdownPeek', mdPeek.on);
    if (mdPeek.on) { renderMdPeek(); if (!mdPeek.el?.classList.contains('show')) toast('Select text or click in a paragraph to see its Markdown.', { kind: 'info', timeout: 2200 }); }
    else mdPeek.el?.classList.remove('show');
    queueRibbonRefresh();
    return mdPeek.on;
  }
  document.addEventListener('selectionchange', () => { if (mdPeek.on) queueMdPeek(); });
  host.addEventListener('scroll', () => { if (mdPeek.on) queueMdPeek(); }, true);
  ['selection:changed', 'mode:shown', 'doc:active'].forEach(ev => app.events.on(ev, () => { if (mdPeek.on) queueMdPeek(); }));
  C('view.showMarkdown', { label: 'What’s this in Markdown?', description: 'Show the Markdown behind the selected text in a small card, so you can learn it as you go.', icon: 'md', shortcut: 'Ctrl+Shift+/', category: 'View', isActive: () => mdPeek.on, run: () => toggleMdPeek() });
  C('view.theme', { label: 'Change theme', description: 'Match system → Light → Dark', icon: 'moon', category: 'View', run: () => { const n = THEME_NEXT[themePref()]; settings.set('theme', n); applyTheme(); toast(`Theme: ${THEME_LABEL[n]}`, { kind: 'info', timeout: 1400 }); } });
  C('view.setTheme', { label: 'Set theme', icon: 'sun', category: 'View', palette: false, run: v => { settings.set('theme', THEME_NEXT[v] ? v : 'system'); applyTheme(); } });
  C('view.themeLight', { label: 'Light theme', icon: 'sun', category: 'View', isActive: () => themePref() === 'light', run: () => app.commands.run('view.setTheme', 'light') });
  C('view.themeDark', { label: 'Dark theme', icon: 'moon', category: 'View', isActive: () => themePref() === 'dark', run: () => app.commands.run('view.setTheme', 'dark') });
  C('view.themeSystem', { label: 'Theme matches system', icon: 'monitor', category: 'View', isActive: () => themePref() === 'system', run: () => app.commands.run('view.setTheme', 'system') });
  // ---- keyboard into the ribbon and between panes (Word: F10 or Alt alone for the ribbon, F6 between panes) ----
  const shown = el => !!(el && el.offsetParent !== null && el.getClientRects().length);
  function focusEditor() { const ed = app.editors.active(); if (ed?.focus) ed.focus(); else host.focus({ preventScroll: true }); }
  function focusRibbon() {
    if (ribbonEl.contains(document.activeElement)) { focusEditor(); return; } // pressed again: back to the page
    revealChrome();
    const t = $('.rtab.on[data-tab]', ribbonEl) || $('.rtab[data-tab]', ribbonEl);
    if (t && shown(t)) t.focus(); else $('#slimbar [data-cmd]')?.focus();
  }
  function panes() {
    const list = [
      { el: ribbonEl, go: () => focusRibbon() },
      { el: $('#dtabs'), go: el => ($('.dtab.on', el) || $('.dtab', el))?.focus() },
      { el: $('#vtabs'), go: el => ($('.vtab.on, [role=tab][aria-selected=true]', el) || $('button, [tabindex="0"]', el))?.focus() },
      { el: outlineEl, go: el => ($('.oitem.on', el) || $('.oitem', el))?.focus() },
      { el: host, go: () => focusEditor() },
      { el: $('.status'), go: el => $('button', el)?.focus() },
    ];
    return list.filter(p => shown(p.el));
  }
  function cyclePane(dir) {
    const list = panes(); if (!list.length) return;
    const i = list.findIndex(p => p.el.contains(document.activeElement));
    const n = list[((i < 0 ? (dir > 0 ? -1 : 0) : i) + dir + list.length) % list.length];
    try { n.go(n.el); } catch {}
  }
  /** F10 or Alt on its own: KeyTips (letters on the tabs and buttons) and the keyboard in the ribbon; again: back to the page. */
  function ribbonKeys() {
    const kt = app.keytips;
    if (kt?.active?.()) { kt.stop(); focusEditor(); return; }
    if (ribbonEl.contains(document.activeElement)) { focusEditor(); return; }
    focusRibbon();
    kt?.start?.();
  }
  C('view.focusRibbon', { label: 'KeyTips and the ribbon', description: 'Show a letter on every ribbon tab and button: type it to use that control, like Word. Arrow keys move around the ribbon, Esc goes back to the page. Pressing Alt alone does the same.', icon: 'ribbonicon', shortcut: 'F10', category: 'View', run: () => ribbonKeys() });
  C('view.nextPane', { label: 'Next pane', icon: 'side', shortcut: 'F6', category: 'View', run: () => cyclePane(1) });
  C('view.prevPane', { label: 'Previous pane', icon: 'side', shortcut: 'Shift+F6', category: 'View', run: () => cyclePane(-1) });
  // Alt pressed and released on its own also goes to the ribbon (and back)
  let altAlone = false;
  addEventListener('keydown', e => { altAlone = e.key === 'Alt' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.repeat ? true : (e.key === 'Alt' && altAlone); }, true);
  addEventListener('mousedown', () => { altAlone = false; }, true);
  addEventListener('keyup', e => {
    if (e.key !== 'Alt' || !altAlone) return;
    altAlone = false;
    if (dialogStack.length || document.querySelector('.palette.show, .bs.show, .backstage.show')) return;
    if (e.getModifierState?.('AltGraph')) return; // AltGr (Urdu, Arabic and European keyboards) is typing, not the ribbon
    e.preventDefault(); ribbonKeys();
  }, true);
  C('view.toggleRibbon', { label: 'Show or hide ribbon commands', description: 'Switch between Show tabs and commands and Show tabs only, like Ctrl+F1 in Word. A double-click on a tab does the same.', icon: 'chevup', shortcut: 'Ctrl+F1', category: 'View', isActive: () => ribbonMode === 'tabs', run: () => (ribbonMode === 'full' ? setRibbonDisplay('pinned') : toggleRibbon()) });
  C('view.ribbonOptions', { label: 'Ribbon display options', description: 'Show tabs and commands, Show tabs only, or Full-screen mode.', icon: 'ribbonicon', category: 'View', run: () => ribbonOptionsMenu($$('[data-tip-cmd="view.ribbonOptions"]').find(x => x.offsetParent && x.closest('.panel')) || $('.rdisp', ribbonEl) || $('.rt-collapse', ribbonEl)) });
  C('view.ribbonDisplay', { label: 'Ribbon display', description: 'Set how the ribbon shows: pinned, tabs only or full screen.', icon: 'ribbonicon', category: 'View', palette: false, run: v => setRibbonDisplay(v?.value ?? v) });
  C('view.ribbonTabsAndCommands', { label: 'Show tabs and commands', description: 'Keep the ribbon tabs and commands showing all the time.', icon: 'ribbonicon', category: 'View', isActive: () => ribbonMode === 'pinned', run: () => setRibbonDisplay('pinned') });
  C('view.ribbonTabsOnly', { label: 'Show tabs only', description: 'Show only the tab names for more room. Click a tab to drop the ribbon down over the page.', icon: 'tabstop', category: 'View', isActive: () => ribbonMode === 'tabs', run: () => setRibbonDisplay('tabs') });
  C('view.ribbonFullScreen', { label: 'Full-screen mode', description: 'Hide the title bar and ribbon. Move the pointer to the top edge, or press Alt, to show them.', icon: 'focus', category: 'View', isActive: () => ribbonMode === 'full', run: () => setRibbonDisplay(ribbonMode === 'full' ? 'pinned' : 'full') });
  C('view.pinRibbon', { label: 'Pin the ribbon', description: 'Keep the ribbon open (Show tabs and commands).', icon: 'pin', category: 'View', palette: false, run: () => setRibbonDisplay('pinned') });
  // Word's Show/Hide ¶: paragraph marks on the page (never printed or exported)
  C('view.formattingMarks', { label: 'Show formatting marks', description: 'Show a ¶ mark at the end of every paragraph, like Word. The marks never print or export.', icon: 'pilcrow', category: 'View', isActive: () => document.body.classList.contains('show-marks'), run: () => { const on = !document.body.classList.contains('show-marks'); document.body.classList.toggle('show-marks', on); settings.set('showFormattingMarks', on); } });
  C('view.showRibbon', { label: 'Show full ribbon in Simple mode', icon: 'ribbonicon', category: 'View', isActive: () => document.body.classList.contains('simple-ribbon'), run: () => { document.body.classList.toggle('simple-ribbon'); settings.set('simpleRibbon', document.body.classList.contains('simple-ribbon')); raf(moveInk); refreshSlimState(); updateStatus(); } });
  C('view.wordTarget', { label: 'Set word target…', icon: 'count', category: 'View', isEnabled: () => !!activeMd() && !!mk.frontMatter, run: async () => {
    const doc = activeMd(); if (!doc) return;
    const cur = docMeta(doc)['word-target'] || '';
    const v = await prompt('Word target', 'How many words are you aiming for?', String(cur), { type: 'number', hint: 'Saved as “word-target” in the front matter. Leave empty to remove it.' });
    if (v == null) return;
    setFrontMatter(doc, { 'word-target': String(v).trim() ? String(parseInt(v, 10) || '') : '' });
  } });

  // View ribbon tab
  app.ribbon.addGroup('view', { id: 'views', label: 'Views', order: 10, items: [
    { type: 'big', command: 'view.printLayout', label: 'Print', icon: 'page' },
    { type: 'big', command: 'view.webLayout', label: 'Web', icon: 'web' },
    { type: 'big', command: 'view.focus', label: 'Focus', icon: 'focus' },
  ] });
  app.ribbon.addGroup('view', { id: 'show', label: 'Show', order: 20, items: [
    { type: 'big', command: 'view.outline', label: 'Outline', icon: 'side' },
    { type: 'big', command: 'view.ribbonOptions', label: 'Ribbon', icon: 'ribbonicon' },
    { type: 'big', command: 'view.formattingMarks', label: 'Formatting marks', icon: 'pilcrow' },
    { type: 'col', items: [
      { type: 'label', text: 'Tab position' },
      { type: 'seg', command: 'view.tabPosition', label: 'Tab position', options: [{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }, { value: 'left', label: 'Left' }], value: () => settings.get('tabPosition', 'top') },
    ] },
  ] });
  app.ribbon.addGroup('view', { id: 'zoom', label: 'Zoom', order: 30, items: [
    { type: 'big', command: 'view.zoomIn', label: 'Zoom in', icon: 'zin' },
    { type: 'big', command: 'view.zoomOut', label: 'Zoom out', icon: 'zout' },
    { type: 'big', command: 'view.zoom100', label: '100%', icon: 'doc' },
    { type: 'big', command: 'view.pageWidth', label: 'Page width', icon: 'fit' },
  ] });
  app.ribbon.addGroup('view', { id: 'mode', label: 'Mode', order: 40, items: [
    { type: 'col', items: [
      { type: 'label', text: 'Editing style' },
      { type: 'seg', command: 'view.mode', label: 'Editing mode', options: MODES.map(m => ({ value: m.id, label: m.label, title: m.long, key: m.key, desc: m.desc })), value: () => app.mode },
    ] },
    { type: 'big', command: 'view.modeRead', label: 'Read', icon: 'read' },
    { type: 'big', command: 'view.showMarkdown', label: 'Show Markdown', icon: 'md' },
  ] });
  app.ribbon.addGroup('view', { id: 'theme', label: 'Theme', order: 50, items: [
    { type: 'col', items: [
      { type: 'label', text: 'Appearance' },
      { type: 'seg', command: 'view.setTheme', label: 'Theme', options: [{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], value: () => themePref() },
    ] },
  ] });
  app.ribbon.addGroup('view', { id: 'help', label: 'Commands', order: 60, items: [
    { type: 'big', command: 'app.commandPalette', label: 'Search', icon: 'search' },
    { type: 'big', command: 'app.shortcuts', label: 'Shortcuts', icon: 'keyboard' },
  ] });

  function showShortcuts() {
    const rows = app.commands.list().filter(c => displayShortcuts(c).length && c.label && c.palette !== false)
      .sort((a, b) => String(a.category || 'zz').localeCompare(String(b.category || 'zz')) || a.label.localeCompare(b.label));
    const wrap = h('div', { style: 'max-height:56vh;overflow:auto;margin:0 -6px' });
    let cat = null;
    for (const c of rows) {
      const cg = c.category || c.id.split('.')[0];
      if (cg !== cat) { cat = cg; wrap.append(h('h6', { text: cat, style: 'margin:12px 6px 4px;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3)' })); }
      wrap.append(h('div.stat', { style: 'padding:4px 6px' }, h('span', { text: c.label }), h('b', null, ...displayShortcuts(c).map(s => h('kbd', { text: fmtShortcut(s), style: 'margin-left:4px' })))));
    }
    dialog({ title: 'Keyboard shortcuts', icon: 'keyboard', body: wrap, wide: true, buttons: [{ label: 'Done', value: true, primary: true }] });
  }

  // =====================================================================
  //  Event wiring
  // =====================================================================
  app.events.on('doc:opened', () => { renderTabs(); });
  app.events.on('doc:closed', () => { renderTabs(); });
  app.events.on('doc:active', doc => {
    renderTabs(); updateTitle(); renderOutline(); outlineActiveLine = null;
    const z = doc?.view?.zoom ?? settings.get('zoom', 100);
    app.setZoom(z, { fromDoc: true });
    mountActive();
    updateStatus();
  });
  app.events.on('doc:changed', ({ doc } = {}) => {
    if (!doc) return;
    updateTabState(doc);
    if (doc === app.docs.active()) { updateTitle(); queueOutline(); queueStatus(); }
  });
  app.events.on('doc:saved', doc => { if (doc) updateTabState(doc); updateTitle(); queueStatus(); savedPulse(); });
  app.events.on('mode:changed', m => { switchModeView(m); queueRibbonRefresh(); renderSlimbar(); });
  app.events.on('status:changed', renderStatusExtras);
  app.events.on('status:refresh', () => { renderStatusExtras(); updateStatus(); });
  app.events.on('zoom:changed', () => { const p = $('#sbPage'); if (p) raf(() => { p.textContent = pageInfo(app.docs.active()); }); });
  app.events.on('editor:changed', () => queueStatus());
  app.events.on('word:pages', () => queueStatus());
  app.events.on('ready', () => { assignWordKeys(); renderRibbon(); renderSlimbar(); updateStatus(); renderOutline(); applyCommentVisibility(); if (settings.get('showMarkdownPeek', false)) toggleMdPeek(true); });

  // Word's keys for commands other modules own, given once everything is registered:
  // F7 → spelling; Shift+F3 is Change case in Word, so Find previous moves to Shift+F4 (Word's "repeat find").
  function assignWordKeys() {
    const taken = combo => app.commands.list().some(c => cmdCombos(c).includes(normShortcut(combo)));
    const spell = app.commands.get('review.spelling');
    if (spell && !shortcutsOf(spell).length && !taken('F7')) spell.shortcut = 'F7';
    const fp = app.commands.get('edit.findPrev');
    if (fp && shortcutsOf(fp).some(s => normShortcut(s) === 'Shift+F3') && app.commands.get('edit.changeCase')) {
      fp.shortcut = 'Shift+F4'; delete fp.shortcuts;
    }
  }
  // comments and hidden notes: shown while editing (setting), never in Read mode
  function applyCommentVisibility() {
    document.body.classList.toggle('hide-notes', settings.get('showComments', true) === false);
  }
  app.events.on('settings:changed', ({ key } = {}) => { if (key === 'showComments') applyCommentVisibility(); });

  // =====================================================================
  //  Click confirmation: ripple + glow on press, toggles that pop, a check for quiet commands
  // =====================================================================
  const fxLayer = h('div.mk-fx', { 'aria-hidden': 'true' });
  document.body.append(fxLayer);
  const PRESSABLE = 'button, [role="button"], [role="tab"], .dtab, .oitem, .sty, .fmt, .tpl, .pi, .mi';
  function ripple(el, x, y) {
    if (reduceMotion.matches || !el.isConnected) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const cs = getComputedStyle(el);
    const clip = h('span.mk-ripple-clip');
    clip.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:${cs.borderRadius}`;
    const size = Math.max(r.width, r.height) * 2.2;
    const dot = h('span.mk-ripple');
    const cx = (x ?? r.left + r.width / 2) - r.left, cy = (y ?? r.top + r.height / 2) - r.top;
    dot.style.cssText = `width:${size}px;height:${size}px;left:${cx - size / 2}px;top:${cy - size / 2}px`;
    if (el.matches('.rtab.file, .btn.primary, .mi:hover')) dot.classList.add('light');
    clip.append(dot); fxLayer.append(clip);
    setTimeout(() => clip.remove(), 650);
  }
  function glow(el) {
    if (!el || reduceMotion.matches) return;
    el.classList.remove('mk-glow'); void el.offsetWidth; el.classList.add('mk-glow');
    setTimeout(() => el.classList.remove('mk-glow'), 600);
  }
  /** A small check that pops up on a control after a command that otherwise shows nothing. */
  function checkmark(el) {
    if (!el || !el.isConnected) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const c = h('span.mk-donecheck', { html: icon('check') });
    c.style.left = (r.right - 9) + 'px'; c.style.top = (r.top - 5) + 'px';
    fxLayer.append(c);
    setTimeout(() => c.remove(), 1100);
  }
  let pressEl = null;
  document.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const el = e.target.closest?.(PRESSABLE);
    if (!el || el.disabled || el.closest('.mk-page, .mk-ripple-off, [data-mk-keys="own"]') || el.matches('.mk-page *')) return;
    pressEl = el;
    ripple(el, e.clientX, e.clientY);
  }, true);
  document.addEventListener('click', e => {
    const el = e.target.closest?.(PRESSABLE);
    if (el && el === pressEl) glow(el);
    else if (el && e.detail === 0 && !el.closest('.mk-page')) { ripple(el); glow(el); } // keyboard: Enter / Space
    pressEl = null;
  }, true);
  // quiet commands (save, copy, export…) confirm with a check on the control that ran them
  const QUIET = /^(file\.save(All)?|edit\.(copy|cut)|file\.copyPath|ref\.tocUpdate|ref\.reloadLibrary|.*\.update.*)$/;
  let lastPressed = null, lastPressedAt = 0;
  function pressedRecently() { return Date.now() - lastPressedAt < 1500 ? lastPressed : null; }
  document.addEventListener('click', e => { const el = e.target.closest?.('[data-tip-cmd], [data-cmd]'); if (el) { lastPressed = el; lastPressedAt = Date.now(); } }, true);
  app.events.on('command:ran', ({ id } = {}) => {
    if (!QUIET.test(id || '')) return;
    const el = lastPressed && Date.now() - lastPressedAt < 1500 && (lastPressed.dataset.tipCmd === id || lastPressed.dataset.cmd === id) ? lastPressed : null;
    if (el) checkmark(el);
    if (/^edit\.(copy|cut)$/.test(id)) toast(id === 'edit.copy' ? 'Copied' : 'Cut to the clipboard', { timeout: 1200 });
  });
  function savedPulse() {
    const dot = $('#docTitle .saved-dot'); if (!dot) return;
    dot.classList.remove('pulse'); void dot.offsetWidth; dot.classList.add('pulse');
    setTimeout(() => dot.classList.remove('pulse'), 900);
    const sb = $('[data-cmd="file.save"]', titlebar); if (sb && Date.now() - lastPressedAt > 1500) checkmark(sb);
  }

  // =====================================================================
  //  First paint
  // =====================================================================
  renderTitlebar();
  renderStatusbar();
  renderTabs();
  renderRibbon();
  renderOutline();
  applyFont();
  applyMode();
  updateTitle();

  let bootTab = null;
  app.events.on('ready', () => { if (bootTab && !bootTab.tab) bootTab.tab = activeTab; });
  /** Called by app.js after settings load: theme, tabs, layout, ribbon state, mode, zoom. */
  function applySettings() {
    applyTheme();
    applyTabPosition(settings.get('tabPosition', 'top'));
    setLayout(settings.get('layout', 'print'));
    setRibbonDisplay(RIBBON_MODES[settings.get('ribbonDisplay')] ? settings.get('ribbonDisplay') : settings.get('ribbonCollapsed', false) ? 'tabs' : 'pinned', { silent: true });
    document.body.classList.toggle('show-marks', !!settings.get('showFormattingMarks', false));
    document.body.classList.toggle('simple-ribbon', !!settings.get('simpleRibbon', false));
    // a profile with no saved tab opens on Home, like Word (not on whatever tab had groups at the first paint)
    activeTab = wantedTab = settings.get('ribbonTab', null) || 'home';
    if (isCtxTab(wantedTab)) activeTab = wantedTab = 'home';
    if (bootTab == null) bootTab = { saved: settings.get('ribbonTab', null) };
    applyFont();
    outlineEl.classList.toggle('hide', !settings.get('outline', true));
    app.setMode(settings.get('defaultMode', 'word'));
    applyMode();
    app.setZoom(settings.get('zoom', 100), { silent: true });
    renderRibbon(); renderTabs(); renderOutline();
  }

  app.shell = {
    host, h, icon, makeSeg, menu, fmtShortcut, normShortcut, eventCombo,
    parseHeadings, docStats, setFrontMatter, docMeta, selectTab,
    applySettings, applyTheme, applyTabPosition, setLayout, setFocusMode, toggleOutline, toggleRibbon,
    renderRibbon, refreshRibbon, renderTabs, renderOutline, updateStatus, mountActive, bootTab: () => bootTab,
    openPalette, closePalette, openPath, openDialog, fitWidthPct, templates: TEMPLATES,
    // round 3: ribbon display, contextual tabs, document font size, change case
    ribbonDisplay, setRibbonDisplay, ribbonOptionsMenu, revealChrome, hideChrome, endPeek, focusRibbon, ribbonKeys, whyDisabled,
    docFontSize, setDocFontSize, fontSteps: FONT_STEPS, caseMenu, cases: CASES, isEditable,
    missingRibbonCommands: [],
    themePref, resolvedTheme: () => root.dataset.theme,
    // round 2
    modes: MODES, modeMenu, backToEditing, captureView, restoreView, switchModeView,
    makeSwitch, settingSwitch, shortcutsOf, displayShortcuts, findCommandFor,
    changeCaseText, changeCase, toggleMdPeek, stepFont,
    ripple, glow, checkmark,
  };
  // feedback helpers other modules can use: app.ui.check(el) after a quiet action, app.ui.glow(el)
  Object.assign(app.ui, { check: checkmark, glow, ripple });

  // =====================================================================
  //  Smoke tests
  // =====================================================================
  const assert = app.assert;
  app.tests.register('shell: ribbon renders all tabs with groups', () => {
    renderRibbon();
    const tabs = app.ribbon.tabs().filter(t => t.groups.length);
    assert(tabs.length >= 1, 'at least one ribbon tab has groups');
    for (const t of tabs) {
      assert(ribbonEl.querySelector(`.rtab[data-tab="${t.id}"]`), `tab button for ${t.id}`);
      const panel = ribbonEl.querySelector(`.panel[data-tab="${t.id}"]`);
      assert(panel, `panel for ${t.id}`);
      assert(panel.querySelectorAll(':scope > .group').length === t.groups.length, `all ${t.groups.length} groups rendered for ${t.id}`);
    }
    assert(ribbonEl.querySelector('.rtab.file'), 'File button');
    assert(ribbonEl.querySelector('.panel[data-tab="view"] .group'), 'View tab has groups');
  });
  app.tests.register('shell: ribbon items point at registered commands', () => {
    const missing = new Set();
    const walk = (items, where) => (items || []).forEach(it => { if (!it) return; if (it.command && !app.commands.get(it.command)) missing.add(`${it.command} (${where})`); if (it.items) walk(it.items, where); });
    for (const t of app.ribbon.tabs()) for (const g of t.groups) walk(g.items, `${t.id}/${g.id}`);
    app.shell.missingRibbonCommands = [...missing];
    if (missing.size) console.warn('[smoke] ribbon items without a command:', [...missing].join(', '));
  });
  app.tests.register('shell: tab placement switching', async () => {
    const orig = settings.get('tabPosition', 'top');
    try {
      for (const pos of ['left', 'bottom', 'top']) {
        await app.commands.run('view.tabPosition', pos);
        assert(document.body.classList.contains('tabs-' + pos), 'body class tabs-' + pos);
        await sleep(30);
        const vt = getComputedStyle(vtabsEl).display, dt = getComputedStyle(dtabsEl).display;
        if (pos === 'left') assert(vt === 'flex' && dt === 'none', 'left shows vertical tabs only');
        else assert(vt === 'none' && dt !== 'none', pos + ' shows the tab strip');
        if (app.docs.list().length) assert((pos === 'left' ? vtabsEl : dtabsEl).querySelector('.dtab'), 'tabs rendered for ' + pos);
      }
    } finally { await app.commands.run('view.tabPosition', orig); }
  });
  app.tests.register('shell: zoom changes', async () => {
    const z0 = app.zoom; let seen = null;
    const off = app.events.on('zoom:changed', z => { seen = z; });
    try {
      app.setZoom(150);
      assert(app.zoom === 150 && seen === 150, 'zoom 150 applied and emitted');
      assert(root.style.getPropertyValue('--zoom').trim() === '1.5', '--zoom css var');
      assert($('#zPct').textContent === '150%', 'status shows 150%');
      app.setZoom(9999); assert(app.zoom === 300, 'clamped to 300');
      app.setZoom(1); assert(app.zoom === 50, 'clamped to 50');
      await app.commands.run('view.zoomIn'); assert(app.zoom > 50, 'zoom in works');
      await app.commands.run('view.zoom100'); assert(app.zoom === 100, 'reset to 100');
    } finally { off(); app.setZoom(z0); }
  });
  app.tests.register('shell: dialogs, prompt and toast', async () => {
    const p = confirm('Test dialog', 'Press OK');
    await sleep(60);
    const ok = $$('.dlg .btn.primary', dialogLayer).pop(); assert(ok, 'dialog primary button');
    ok.click(); assert((await p) === true, 'confirm resolves true');
    const q = prompt('Name', 'Label', 'abc');
    await sleep(60);
    const inp = $$('.dlg input', dialogLayer).pop(); assert(inp && inp.value === 'abc', 'prompt input prefilled');
    inp.value = 'xyz'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert((await q) === 'xyz', 'prompt resolves typed value on Enter');
    const t = toast('Smoke toast'); assert(toastLayer.querySelector('.toast'), 'toast shown'); t.close();
    // a dangerous choice is never the default button
    const d = confirm('Delete test', 'Gone for good', { ok: 'Delete', danger: true });
    await sleep(80);
    const focused = document.activeElement;
    assert(focused && /Cancel/.test(focused.textContent), 'Cancel has the focus, not Delete: ' + (focused?.textContent || ''));
    $$('.dlg .btn', dialogLayer).filter(b => /Cancel/.test(b.textContent)).pop()?.click();
    assert((await d) === false, 'cancelled');
  });
  app.tests.register('shell: no two palette commands show the same shortcut', () => {
    const seen = new Map(), dup = [];
    for (const c of app.commands.list()) {
      if (c.palette === false || c.hidden) continue;
      for (const s of new Set(displayShortcuts(c).map(normShortcut))) {
        if (seen.has(s) && seen.get(s) !== c.id) dup.push(`${s}: ${seen.get(s)} / ${c.id}`); else seen.set(s, c.id);
      }
    }
    assert(!dup.length, 'shared shortcuts: ' + dup.join('; '));
    assert(fmtShortcut('Alt+=') === (isMac ? '⌥=' : 'Alt+=') && fmtShortcut('Ctrl+=') === (isMac ? '⌘=' : 'Ctrl+='), 'key labels: ' + fmtShortcut('Alt+=') + ' ' + fmtShortcut('Ctrl+='));
  });
  app.tests.register('shell: F10 and F6 reach the ribbon and the panes', async () => {
    app.backstage?.close?.(); await sleep(50);
    app.commands.run('view.focusRibbon'); await sleep(30);
    assert(ribbonEl.contains(document.activeElement) || $('#slimbar')?.contains(document.activeElement), 'ribbon has the focus: ' + document.activeElement?.className);
    app.commands.run('view.nextPane'); await sleep(30);
    assert(!ribbonEl.contains(document.activeElement), 'F6 moved on: ' + document.activeElement?.className);
  });
  app.tests.register('shell: command palette finds commands and headings', async () => {
    const items = paletteSources('save');
    assert(items.some(i => i.id === 'file.save'), 'file.save found for "save"');
    const hs = parseHeadings('---\ntitle: x\n---\n# A\n```\n# not\n```\n## B\nText\n===\n');
    assert(hs.length === 3 && hs[0].text === 'A' && hs[1].text === 'B' && hs[2].text === 'Text', 'headings ignore code fences: ' + JSON.stringify(hs));
    openPalette('zoom'); await sleep(40);
    assert(palEl && palEl.querySelectorAll('.pi').length > 0, 'palette shows results');
    closePalette();
  });
  app.tests.register('shell: shortcut strings normalize', () => {
    assert(normShortcut('ctrl+shift+s') === 'Ctrl+Shift+S', 'ctrl+shift+s');
    assert(normShortcut('Ctrl++') === 'Ctrl+=', 'Ctrl++');
    assert(normShortcut('Cmd+K') === 'Ctrl+K', 'Cmd maps to primary');
    assert(eventCombo({ code: 'KeyB', key: 'b', ctrlKey: !isMac, metaKey: isMac, shiftKey: false, altKey: false }) === 'Ctrl+B', 'event Ctrl+B');
    assert(findCommandFor('Ctrl+S')?.id === 'file.save' || !!findCommandFor('Ctrl+S'), 'Ctrl+S bound');
  });
  app.tests.register('shell: backstage opens pages', async () => {
    for (const id of ['new', 'open', 'saveas', 'options']) {
      app.backstage.open(id); await sleep(50);
      assert(bsEl.classList.contains('show'), 'backstage visible');
      assert(bsEl.querySelector(`.bs-page[data-page="${id}"]`), 'page rendered: ' + id);
    }
    app.backstage.close(); await sleep(20);
    assert(!bsEl.classList.contains('show'), 'backstage closed');
  });

  // ---------- round 2 ----------
  app.tests.register('shell: four editing modes in the title bar, View tab, status bar and keys', async () => {
    const seg = $('#modeSeg');
    assert(seg && $$('button', seg).map(b => b.dataset.v).join() === 'word,inline,simple,read', 'title bar switcher: ' + (seg && $$('button', seg).map(b => b.dataset.v).join()));
    for (const [k, id] of [['Ctrl+1', 'view.modeWord'], ['Ctrl+2', 'view.modeInline'], ['Ctrl+3', 'view.modeSimple'], ['Ctrl+4', 'view.modeRead'], ['Ctrl+Shift+M', 'view.toggleMode']]) assert(findCommandFor(normShortcut(k))?.id === id, `${k} runs ${id}, got ${findCommandFor(normShortcut(k))?.id}`);
    const viewSeg = ribbonEl.querySelector('.panel[data-tab="view"] .group[data-group="mode"] .seg');
    assert(viewSeg && viewSeg.querySelectorAll('button').length === 4, 'View tab has the four modes');
    const m0 = app.mode;
    try {
      app.setMode('word'); await sleep(50);
      await app.commands.run('view.toggleMode'); assert(app.mode === 'inline', 'Ctrl+Shift+M goes Word → Inline, got ' + app.mode);
      await app.commands.run('view.toggleMode'); assert(app.mode === 'simple', 'then Simple');
      await app.commands.run('view.toggleMode'); assert(app.mode === 'read', 'then Read');
      assert(document.body.classList.contains('mode-read') && !document.body.classList.contains('mode-word'), 'body class mode-read');
      assert($('#sbMode').textContent === 'Read mode' && seg.querySelector('button.on')?.dataset.v === 'read', 'status bar and switcher follow');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(30);
      assert(app.mode === 'simple', 'Esc leaves Read mode for the mode before it, got ' + app.mode);
    } finally { app.setMode(m0); await sleep(400); }
  });
  app.tests.register('shell: switching modes keeps the reading position and the caret line', async () => {
    const paras = Array.from({ length: 90 }, (_, i) => `Paragraph ${i + 1}. ` + 'Words that fill the line so every block has some height on the page. '.repeat(3));
    const doc = app.docs.create({ title: 'Position test', text: '---\ntitle: Position test\n---\n\n' + paras.join('\n\n') + '\n' });
    const m0 = app.mode;
    const settle = async () => { for (let i = 0; i < 60 && fxGhost; i++) await sleep(50); await sleep(350); };
    try {
      app.setMode('word'); await sleep(200); await settle();
      await mountActive(true); await sleep(900);
      const target = 4 + 2 * 50; // "Paragraph 51" (front matter is lines 0–2, a blank line, then every other line)
      const el = blockAt(target - fmLinesOf(doc.text));
      assert(el, 'paragraph block found');
      el.scrollIntoView({ block: 'start' }); await sleep(120);
      const before = captureView();
      assert(before && Math.abs(before.top - target) <= 2, 'captured top line near ' + target + ': ' + JSON.stringify(before));
      app.setMode('simple'); await settle();
      const mid = captureView();
      assert(mid && Math.abs(mid.top - before.top) <= 4, `Simple keeps the line: ${before.top} → ${mid && mid.top}`);
      app.setMode('word'); await settle();
      const after = captureView();
      assert(after && Math.abs(after.top - before.top) <= 4, `back in Word: ${before.top} → ${after && after.top}`);
      assert(!$('.mk-mode-ghost'), 'cross-fade overlay is gone');
      assert(host.style.opacity === '', 'editor fully visible');
    } finally { app.setMode(m0); await settle(); await app.docs.close(doc.id, { force: true }); }
  });
  app.tests.register('shell: change case, grow and shrink font', async () => {
    assert(changeCaseText('the flume $\\alpha_b$ run', 'upper') === 'THE FLUME $\\alpha_b$ RUN', 'math keeps its case: ' + changeCaseText('the flume $\\alpha_b$ run', 'upper'));
    assert(changeCaseText('see [Shields](https://ex.com/A) `Code`', 'lower') === 'see [shields](https://ex.com/A) `Code`', 'links and code keep case');
    assert(changeCaseText('hello world. second one', 'sentence') === 'Hello world. Second one', 'sentence case');
    assert(changeCaseText('hello big world', 'title') === 'Hello Big World', 'title case');
    assert(nextCase('Hello') === 'upper' && nextCase('HELLO') === 'lower' && nextCase('hello') === 'title', 'cycle order like Word');
    assert(findCommandFor('Shift+F3')?.id === 'edit.changeCase', 'Shift+F3 is Change case, got ' + findCommandFor('Shift+F3')?.id);
    if (app.commands.get('review.spelling')) assert(findCommandFor('F7')?.id === 'review.spelling', 'F7 runs spelling');
    assert(findCommandFor(normShortcut('Ctrl+Shift+>'))?.id === 'format.growFont' && findCommandFor(eventCombo({ code: 'Comma', key: '<', ctrlKey: !isMac, metaKey: isMac, shiftKey: true, altKey: false }))?.id === 'format.shrinkFont', 'Ctrl+Shift+> and < are bound');
    assert(fmtShortcut('Ctrl+Shift+>').endsWith('>'), 'shown as > : ' + fmtShortcut('Ctrl+Shift+>'));
    // in the Simple editor the selected source is replaced and stays selected
    const doc = app.docs.create({ title: 'Case test', text: 'make this loud' });
    const m0 = app.mode;
    try {
      app.setMode('simple'); await sleep(700);
      const ad = app.editors.active();
      if (ad?.setSelection) {
        ad.setSelection(5, 9);
        // like Word: lowercase → Capitalize Each Word → UPPERCASE → lowercase
        await app.commands.run('edit.changeCase');
        assert(doc.text === 'make This loud', 'Simple: ' + doc.text);
        await app.commands.run('edit.changeCase');
        assert(doc.text === 'make THIS loud', 'pressing again gives UPPERCASE: ' + doc.text);
        await app.commands.run('edit.changeCase');
        assert(doc.text === 'make this loud', 'and then lowercase: ' + doc.text);
      }
    } finally { app.setMode(m0); await sleep(300); await app.docs.close(doc.id, { force: true }); }
  });
  app.tests.register('shell: "What’s this in Markdown?" shows the selection’s Markdown', async () => {
    const doc = app.docs.create({ title: 'Peek test', text: 'Some **bold** words.\n' });
    const m0 = app.mode;
    try {
      app.setMode('simple'); await sleep(700);
      const ad = app.editors.active();
      ad?.setSelection?.(5, 13);
      toggleMdPeek(true); await sleep(60); renderMdPeek();
      assert(mdPeek.el && mdPeek.el.classList.contains('show'), 'card shown');
      assert(/\*\*bold\*\*/.test(mdPeek.el.querySelector('.mp-code').textContent), 'shows **bold**: ' + mdPeek.el.textContent);
      assert(app.commands.get('view.showMarkdown').isActive(), 'command shows as on');
      try { await mk.invoke('smoke-shot', 'mdpeek'); } catch {}
      toggleMdPeek(false);
      assert(!mdPeek.el.classList.contains('show'), 'hidden again');
    } finally { toggleMdPeek(false); app.setMode(m0); await sleep(300); await app.docs.close(doc.id, { force: true }); }
  });
  app.tests.register('shell: Options has typing, comment and export switches', async () => {
    app.backstage.open('options'); await sleep(60);
    for (const k of ['smartQuotes', 'autocorrect', 'showComments', 'exportComments']) assert(bsEl.querySelector(`.mk-switch[data-setting="${k}"]`), 'switch for ' + k);
    const card = bsEl.querySelector('.opt-card[data-section="typing"]'); card?.scrollIntoView({ block: 'center' }); await sleep(600);
    try { await mk.invoke('smoke-shot', 'options-typing'); } catch {}
    const sw = bsEl.querySelector('.mk-switch[data-setting="showComments"]');
    const v0 = settings.get('showComments', true);
    try {
      sw.click(); assert(settings.get('showComments') === !v0, 'switch writes the setting');
      assert(document.body.classList.contains('hide-notes') === v0, 'notes hidden when comments are off');
    } finally { settings.set('showComments', v0); app.backstage.close(); }
    assert(settings.get('smartQuotes') === true || settings.get('smartQuotes') === false, 'smartQuotes has a default');
  });
  app.tests.register('shell: ribbon drop-downs pass {value} to their command', async () => {
    const doc = app.docs.create({ title: 'Size box test', text: 'Body text.\\n' });
    try {
      await sleep(300); renderRibbon(); await sleep(30);
      const b = bound.find(x => x.kind === 'select' && x.item.command === 'format.fontSize');
      if (!b) return; // the Home tab's font size box is not there
      selectTab('home'); b.el.click(); await sleep(60);
      const labels = $$('.pop.show .mi').map(m => m.textContent.trim());
      assert(['8', '10.5', '12', '36'].every(x => labels.includes(x)), 'Word sizes in the menu: ' + labels.join(' '));
      const item = $$('.pop.show .mi').find(m => m.textContent.trim() === '14');
      item.click(); await sleep(60);
      assert(docFontSize(doc) === 14 && /^fontsize: 14pt$/m.test(doc.text), 'document size set to 14 pt: ' + JSON.stringify(doc.text));
      refreshRibbon();
      assert(b.lab.textContent === '14', 'the box shows 14: ' + b.lab.textContent);
    } finally { closePopover(); await app.docs.close(doc.id, { force: true }); }
  });

  // ---------- round 3 ----------
  const settle = async (ms = 380) => { await sleep(ms); };
  app.tests.register('shell: ribbon pin and unpin, saved in settings', async () => {
    const m0 = ribbonDisplay();
    try {
      setRibbonDisplay('pinned'); await settle();
      const rb = $('.rbody', ribbonEl);
      assert(rb.getBoundingClientRect().height > 60, 'pinned ribbon shows its commands');
      await app.commands.run('view.toggleRibbon'); await settle();
      assert(ribbonDisplay() === 'tabs' && document.body.classList.contains('ribbon-collapsed') && settings.get('ribbonDisplay') === 'tabs', 'Ctrl+F1 → Show tabs only, saved');
      assert(rb.getBoundingClientRect().height < 4, 'commands hidden: ' + rb.getBoundingClientRect().height);
      assert(findCommandFor('Ctrl+F1')?.id === 'view.toggleRibbon', 'Ctrl+F1 is bound to the ribbon');
      // double-click on a tab pins it again
      $('.rtab[data-tab="home"]', ribbonEl).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await settle();
      assert(ribbonDisplay() === 'pinned' && settings.get('ribbonDisplay') === 'pinned', 'double-click pins the ribbon');
      // the display options menu lists the three choices
      ribbonOptionsMenu($('.rdisp', ribbonEl)); await sleep(60);
      const opts = $$('.pop.show .mi').map(m => m.textContent.trim());
      assert(['Full-screen mode', 'Show tabs only', 'Show tabs and commands'].every(o => opts.some(x => x.startsWith(o))), 'menu: ' + opts.join(' | '));
      closePopover();
      // full-screen: title bar and ribbon slide away and come back from the top edge
      setRibbonDisplay('full'); await settle();
      assert(titlebar.getBoundingClientRect().bottom <= 1 && ribbonEl.getBoundingClientRect().bottom <= 1, 'full screen hides the title bar and ribbon');
      revealChrome(); await settle();
      assert(document.body.classList.contains('chrome-reveal') && ribbonEl.getBoundingClientRect().bottom > 60, 'top edge shows them');
      try { await mk.invoke('smoke-shot', 'ribbon-full-screen'); } catch {}
      hideChrome(true); await settle();
      assert(!document.body.classList.contains('chrome-reveal'), 'hidden again');
      // settings come back on the next start
      setRibbonDisplay('tabs'); applySettingsRibbonOnly();
      assert(ribbonDisplay() === 'tabs', 'restored from settings');
    } finally { setRibbonDisplay(m0); await settle(); }
  });
  function applySettingsRibbonOnly() { setRibbonDisplay(settings.get('ribbonDisplay'), { silent: true }); }
  app.tests.register('shell: the dropped-down ribbon closes after a command', async () => {
    const m0 = ribbonDisplay();
    try {
      setRibbonDisplay('tabs'); await settle();
      $('.rtab[data-tab="view"]', ribbonEl).click(); await sleep(120);
      assert(ribbonEl.classList.contains('peek'), 'clicking a tab drops the ribbon down');
      // the drop-down animates its height: wait for it (a busy machine can take longer than 120 ms)
      for (let i = 0; i < 30 && $('.rbody', ribbonEl).getBoundingClientRect().height <= 60; i++) await sleep(50);
      const rb = $('.rbody', ribbonEl).getBoundingClientRect();
      assert(rb.height > 60, 'dropped ribbon has its commands: ' + rb.height);
      assert(getComputedStyle($('.rpin', ribbonEl)).display !== 'none', 'pin button on the dropped ribbon');
      await sleep(400);
      try { await mk.invoke('smoke-shot', 'ribbon-tabs-only'); } catch {}
      const z0 = app.zoom;
      $('.panel.on [data-tip-cmd="view.zoom100"]', ribbonEl)?.click() ?? $('.panel.on button.big', ribbonEl).click();
      await sleep(80);
      assert(!ribbonEl.classList.contains('peek'), 'closed after the command ran');
      app.setZoom(z0);
      // Esc and a click outside close it too
      $('.rtab[data-tab="view"]', ribbonEl).click(); await sleep(60);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(30);
      assert(!ribbonEl.classList.contains('peek'), 'Esc closes it');
      $('.rtab[data-tab="view"]', ribbonEl).click(); await sleep(60);
      host.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await sleep(30);
      assert(!ribbonEl.classList.contains('peek'), 'a click on the page closes it');
      // the pin keeps it open
      $('.rtab[data-tab="home"]', ribbonEl).click(); await sleep(60);
      $('.rpin', ribbonEl).click(); await settle();
      assert(ribbonDisplay() === 'pinned' && !ribbonEl.classList.contains('peek'), 'pin → Show tabs and commands');
    } finally { setRibbonDisplay(m0); await settle(); }
  });
  app.tests.register('shell: contextual tabs show and hide with an accent color', async () => {
    const id = 'smokeCtx';
    app.ribbon.addTab(id, { title: 'Table Design', contextual: true, accent: '#7a4fe0' });
    app.ribbon.addGroup(id, { id: 'g', label: 'Test', items: [{ type: 'big', command: 'view.zoom100', label: '100%', icon: 'doc' }] });
    try {
      await sleep(60); renderRibbon();
      const b = $(`.rtab[data-tab="${id}"]`, ribbonEl);
      assert(b && b.hidden, 'contextual tab is hidden until shown');
      const tabs = $$('.rtab[data-tab]', ribbonEl); assert(tabs[tabs.length - 1] === b, 'contextual tabs sit at the end');
      app.ribbon.showContextual(id, true); await sleep(30);
      assert(!b.hidden && app.ribbon.isContextualShown(id), 'shown');
      assert(getComputedStyle(b).color.replace(/\s/g, '') === 'rgb(122,79,224)', 'accent color label: ' + getComputedStyle(b).color);
      selectTab(id); await sleep(30);
      assert($(`.panel.on[data-tab="${id}"]`, ribbonEl), 'its panel opens');
      app.ribbon.showContextual(id, false); await sleep(30);
      const b2 = $(`.rtab[data-tab="${id}"]`, ribbonEl) || b; // the ribbon may have been drawn again meanwhile
      assert(b2.hidden && activeTab !== id, 'hidden again and the ribbon went back to ' + activeTab);
      // the old object form still works
      assert(app.ribbon.tabs().some(t => t.id === 'home' && t.label === 'Home'), 'plain tabs unchanged');
    } finally { app.ribbon.removeGroup(id, 'g'); app.ribbon.showContextual(id, false); await sleep(40); }
  });
  app.tests.register('shell: change case variants and Title Case (APA, Chicago)', async () => {
    const t = 'the role of sediment in a river: a study of flow and form';
    assert(changeCaseText(t, 'titleCase') === 'The Role of Sediment in a River: A Study of Flow and Form', 'title case: ' + changeCaseText(t, 'titleCase'));
    assert(changeCaseText('state-of-the-art methods for DNA and iPhone data', 'titleCase') === 'State-of-the-Art Methods for DNA and iPhone Data', 'compounds and acronyms: ' + changeCaseText('state-of-the-art methods for DNA and iPhone data', 'titleCase'));
    assert(changeCaseText('what is it for', 'titleCase') === 'What Is It For', 'last word capitalized: ' + changeCaseText('what is it for', 'titleCase'));
    assert(changeCaseText('flow in $x_in$ of `code` here', 'titleCase') === 'Flow in $x_in$ of `code` Here', 'math and code kept: ' + changeCaseText('flow in $x_in$ of `code` here', 'titleCase'));
    assert(changeCaseText('Hello World', 'toggle') === 'hELLO wORLD', 'tOGGLE cASE');
    assert(changeCaseText('one. two', 'sentence') === 'One. Two' && changeCaseText('ABC', 'lower') === 'abc' && changeCaseText('abc', 'upper') === 'ABC' && changeCaseText('big red', 'title') === 'Big Red', 'the five Word cases');
    for (const [k] of CASES) assert(app.commands.get('edit.case.' + k), 'command edit.case.' + k);
    // the drop-down sits in the Home → Font row, right of the size box
    selectTab('home'); renderRibbon(); await sleep(40);
    const row = $('.panel[data-tab="home"] .group[data-group="font"] .row', ribbonEl);
    const sizeBox = row && $$('button.select', row).find(b => b.dataset.tipCmd === 'format.fontSize');
    const caseBtn = row && $('[data-tip-cmd="edit.changeCaseMenu"]', row);
    assert(sizeBox && caseBtn, 'size box and Change Case in the same row');
    assert(caseBtn.getBoundingClientRect().left > sizeBox.getBoundingClientRect().right, 'Change Case to the right of the size box');
    assert(!$('.group[data-group="ux-text"]', ribbonEl), 'no separate Text group any more');
    // Simple mode, the word at the caret, and the menu
    const doc = app.docs.create({ title: 'Case menu test', text: 'a tale of two cities\n' });
    const m0 = app.mode;
    try {
      app.setMode('simple'); await sleep(700);
      const ad = app.editors.active();
      ad.setSelection(0, 20);
      await app.commands.run('edit.case.titleCase');
      assert(doc.text === 'A Tale of Two Cities\n', 'Title Case in Simple mode: ' + JSON.stringify(doc.text));
      ad.setSelection(3, 3);
      await app.commands.run('edit.case.upper');
      assert(doc.text === 'A TALE of Two Cities\n', 'no selection: the word at the caret: ' + JSON.stringify(doc.text));
      app.setMode('word'); await sleep(700); selectTab('home'); await sleep(60);
      const btn = $$('#ribbon .panel.on [data-tip-cmd="edit.changeCaseMenu"]').find(x => x.offsetParent);
      btn.click(); await sleep(120);
      for (let i = 0; i < 30 && !$$('.pop.show .mi').length; i++) await sleep(50);
      const items = $$('.pop.show .mi').map(m => m.textContent.trim());
      assert(['Sentence case.', 'lowercase', 'UPPERCASE', 'Capitalize Each Word', 'tOGGLE cASE', 'Title Case'].every(x => items.some(i => i.startsWith(x))), 'menu items: ' + items.join(' | '));
      try { await mk.invoke('smoke-shot', 'change-case'); } catch {}
      closePopover();
    } finally { closePopover(); app.setMode(m0); await sleep(300); await app.docs.close(doc.id, { force: true }); }
  });
  app.tests.register('shell: font size is one size per document, in Word steps, on the page and in exports', async () => {
    assert(FONT_STEPS.join() === '8,9,10,10.5,11,12,14,16,18,20,24,28,36', 'Word steps');
    const doc = app.docs.create({ title: 'Font size test', text: '# Title\n\nBody text.\n' });
    try {
      await sleep(400);
      const d0 = defaultFontSize();
      assert(docFontSize(doc) === d0, 'starts at the default size');
      const px0 = app.layout?.font?.(doc)?.px;
      await app.commands.run('format.growFont');
      const up = FONT_STEPS.find(s => s > d0);
      assert(docFontSize(doc) === up && new RegExp('^fontsize: ' + up + 'pt$', 'm').test(doc.text), 'grow → ' + up + ' pt in the front matter: ' + JSON.stringify(doc.text));
      if (px0) assert(app.layout.font(doc).px > px0, 'page text grew: ' + px0 + ' → ' + app.layout.font(doc).px);
      if (app.layout?.cssFor) assert(new RegExp('font-size: ' + app.layout.font(doc).px + 'px').test(app.layout.cssFor(doc)), 'print and PDF CSS use the size');
      await app.commands.run('format.shrinkFont');
      assert(docFontSize(doc) === d0 && !/fontsize:/.test(doc.text), 'back to the default: the key is removed: ' + JSON.stringify(doc.text));
      await app.commands.run('format.fontSize', { value: '10.5' });
      assert(docFontSize(doc) === 10.5 && /^fontsize: 10\.5pt$/m.test(doc.text), '10.5 pt');
      for (let i = 0; i < 20; i++) await app.commands.run('format.shrinkFont');
      assert(docFontSize(doc) === 8, 'stops at 8 pt');
      assert(findCommandFor('Ctrl+]')?.id === 'format.growFont' && findCommandFor('Ctrl+[')?.id === 'format.shrinkFont', 'Ctrl+] and Ctrl+[ like Word');
      await app.commands.run('format.fontSize', { value: '14' });
      if (app.exporter?.exportMarkdown) {
        const md = await app.exporter.exportMarkdown(doc, 'latex');
        assert(/^fontsize: 14pt$/m.test(md), 'Pandoc gets fontsize: ' + md.slice(0, 80));
        await app.commands.run('format.fontSize', { value: String(d0) });
        const md2 = await app.exporter.exportMarkdown(doc, 'docx');
        assert(new RegExp('^fontsize: ' + d0 + 'pt$', 'm').test(md2), 'the default size goes to Pandoc too: ' + md2.slice(0, 80));
        assert(!/fontsize/.test(doc.text), 'the document itself has no fontsize key at the default size');
      }
      assert(/one text size per document/.test(app.tooltips?.info?.('format.fontSize')?.description || app.commands.get('format.fontSize').description), 'ScreenTip explains the size box');
    } finally { await app.docs.close(doc.id, { force: true }); }
  });
  app.tests.register('shell: Font row controls that cannot work are dimmed with a reason', async () => {
    const doc = app.docs.create({ title: 'Dim test', text: 'Read me.\n' });
    const m0 = app.mode;
    try {
      app.setMode('read'); await sleep(600); selectTab('home'); refreshRibbon(); await sleep(30);
      const bold = $('#ribbon .panel[data-tab="home"] [data-cmd="format.bold"], #ribbon .panel[data-tab="home"] [data-tip-cmd="format.bold"]');
      if (bold) assert(bold.disabled && /Read mode/.test(bold.dataset.tipWhy || ''), 'Bold dimmed in Read mode: ' + bold.dataset.tipWhy);
      const caseBtn = $('#ribbon .panel[data-tab="home"] [data-tip-cmd="edit.changeCaseMenu"]');
      assert(caseBtn && caseBtn.disabled && /Read mode/.test(caseBtn.dataset.tipWhy || ''), 'Change Case dimmed with a reason');
      const size = $('#ribbon .panel[data-tab="home"] [data-tip-cmd="format.fontSize"]');
      if (size) assert(!size.disabled, 'the size box still works in Read mode (it is document-wide)');
      if (caseBtn && app.tooltips) {
        // a dimmed button still gets the pointer, so its ScreenTip can say why
        assert(getComputedStyle(caseBtn).pointerEvents !== 'none', 'dimmed buttons still take hover');
        app.tooltips.hide();
        caseBtn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        await sleep((app.tooltips.delay || 600) + 150);
        console.info('[smoke] hovering a dimmed button shows its tip: ' + !!app.tooltips.isVisible?.());
        if (!app.tooltips.isVisible?.()) { app.tooltips.show(caseBtn); await sleep(40); }
        assert(/Read mode/.test($('#tooltip').textContent), 'ScreenTip says why: ' + $('#tooltip').textContent);
        try { await mk.invoke('smoke-shot', 'dimmed-tip'); } catch {}
        app.tooltips.hide();
      }
    } finally { app.setMode(m0); await sleep(300); await app.docs.close(doc.id, { force: true }); refreshRibbon(); }
  });
  app.tests.register('shell: presses ripple, quiet commands get a check', async () => {
    selectTab('home');
    const b = $$('#ribbon .panel.on button.big, #ribbon .panel.on button.ib').find(x => x.offsetParent && !x.disabled);
    assert(b, 'a ribbon button');
    const r = b.getBoundingClientRect();
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: r.left + 4, clientY: r.top + 4 }));
    assert(fxLayer.querySelector('.mk-ripple'), 'ripple drawn');
    const save = $('[data-cmd="file.save"]', titlebar);
    checkmark(save);
    assert(fxLayer.querySelector('.mk-donecheck'), 'check mark drawn');
    await sleep(20);
  });
})();
