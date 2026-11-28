// Markooj website. Copyright (C) 2026 Ahmed Bilal and contributors. AGPL-3.0-or-later.
// "Try it": a tiny preview of the four modes with one short sample document.
// Everything stays inside this page: nothing typed here is sent or saved anywhere.
// Marked and KaTeX load when the preview comes near the screen; Mermaid loads only when a diagram is added.
(function () {
  'use strict';

  var root = document.getElementById('demo');
  if (!root) return;

  var SAMPLE = [
    '# A short note on rivers',
    '',
    'Markooj looks like **Word** while you write, and it keeps plain _Markdown_ underneath.',
    '',
    'The flow in a channel is $Q = vA$, where $v$ is the speed of the water and $A$ the area it fills.',
    '',
    '- Click a paragraph in **Inline** mode to see its Markdown.',
    '- Open **Simple** mode to change the Markdown itself.',
    '',
    '> Plain text files stay readable for decades.'
  ].join('\n');

  var EQUATIONS = [
    'Q = \\frac{1}{n}\\, A\\, R^{2/3} S^{1/2}',
    'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    '\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}',
    'e^{i\\pi} + 1 = 0'
  ];
  var TABLE = [
    '| River | Length (km) | Mean flow (m³/s) |',
    '| --- | ---: | ---: |',
    '| Indus | 3,180 | 6,600 |',
    '| Nile | 6,650 | 2,830 |',
    '| Danube | 2,850 | 6,500 |'
  ].join('\n');
  var DIAGRAM = [
    '```mermaid',
    'flowchart LR',
    '  A[Write on the page] --> B[Markooj saves Markdown]',
    '  B --> C[Open it anywhere]',
    '  B --> D[Save as PDF or Word]',
    '```'
  ].join('\n');

  var MODES = { word: 'Word mode', inline: 'Inline mode', simple: 'Simple mode', read: 'Read mode' };
  var state = { md: SAMPLE, mode: 'word', blocks: [], active: -1, lastInline: -1, eq: 0 };
  var lastEditMode = 'word';
  var canvas = document.getElementById('demo-canvas');
  var toastEl = document.getElementById('demo-toast');
  var titleEl = document.getElementById('demo-title');
  var modeNameEl = document.getElementById('demo-mode-name');
  var wordsEl = document.getElementById('demo-words');
  var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var dark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false };
  var parser = null, booted = false, booting = null;
  var savedRange = null;

  // ---------- small helpers ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var attr = esc;
  function toNode(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function $(sel) { return canvas.querySelector(sel); }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { s.remove(); reject(new Error('The file ' + src + ' did not load.')); };
      document.head.appendChild(s);
    });
  }
  function loadCss(href) {
    if (document.querySelector('link[href="' + href + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }
  var toastTimer = 0;
  function hint(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, Math.max(3500, text.length * 55));
  }
  // a problem, written with what to do first, then what still works, details folded away
  function problem(todo, stillWorks, err, retryAct) {
    return '<div class="dm-error" role="note"><p><strong>' + esc(todo) + '</strong> ' + esc(stillWorks) + '</p>' +
      (retryAct ? '<button type="button" class="dbtn" data-act="' + retryAct + '">Try again</button>' : '') +
      (err ? '<details><summary>Details</summary>' + esc(err && err.message ? err.message : String(err)) + '</details>' : '') +
      '</div>';
  }
  function flash(el) {
    if (!el || reduce) return;
    el.classList.remove('dm-new');
    void el.offsetWidth;
    el.classList.add('dm-new');
    setTimeout(function () { el.classList.remove('dm-new'); }, 2000);
  }
  function scrollWithin(box, el) {
    if (!box || !el) return;
    var b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
    var top = r.top - b.top + box.scrollTop - 24;
    if (box.scrollTo) box.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
    else box.scrollTop = Math.max(0, top);
  }

  // ---------- loading the libraries ----------
  function boot() {
    if (booting) return booting;
    loadCss('vendor/katex/katex.min.css');
    booting = Promise.all([loadScript('vendor/marked/marked.umd.js'), loadScript('vendor/katex/katex.min.js')])
      .then(function () {
        if (!window.marked || !window.marked.Marked || !window.katex) throw new Error('Marked or KaTeX did not start in this browser.');
        parser = makeParser();
        booted = true;
        render();
      })
      .catch(function (err) {
        booting = null;
        canvas.innerHTML = problem('Reload the page to try the preview again.',
          'If you are offline, the pictures above show each mode, and Markooj itself works without the internet.', err, 'retry');
      });
    return booting;
  }

  function tex(s, display) {
    try {
      return window.katex.renderToString(s, { displayMode: display, throwOnError: false, strict: 'ignore' });
    } catch (e) {
      return '<code>' + esc(s) + '</code>';
    }
  }

  function makeParser() {
    var M = new window.marked.Marked({ gfm: true, breaks: false });
    M.use({
      extensions: [{
        name: 'mathBlock',
        level: 'block',
        start: function (src) { var i = src.indexOf('$$'); return i < 0 ? undefined : i; },
        tokenizer: function (src) {
          var m = /^\$\$[ \t]*\n?([\s\S]+?)\n?[ \t]*\$\$[ \t]*(?:\n+|$)/.exec(src);
          if (m) return { type: 'mathBlock', raw: m[0], text: m[1].trim() };
        },
        renderer: function (t) {
          return '<div class="dm-math" contenteditable="false" data-tex="' + attr(t.text) + '">' + tex(t.text, true) + '</div>';
        }
      }, {
        name: 'mathInline',
        level: 'inline',
        start: function (src) { var i = src.indexOf('$'); return i < 0 ? undefined : i; },
        tokenizer: function (src) {
          var m = /^\$([^\s$](?:[^$\n]*?[^\s$])?)\$(?!\d)/.exec(src);
          if (m) return { type: 'mathInline', raw: m[0], text: m[1] };
        },
        renderer: function (t) {
          return '<span class="dm-imath" contenteditable="false" data-tex="' + attr(t.text) + '">' + tex(t.text, false) + '</span>';
        }
      }],
      renderer: {
        // raw HTML is shown as text: the preview only does Markdown
        html: function (t) { return esc(t.text || t.raw || ''); },
        code: function (t) {
          if (String(t.lang || '').trim().toLowerCase() === 'mermaid') {
            return '<div class="dm-diagram" contenteditable="false" data-src="' + attr(t.text) + '"><p class="dm-wait">Drawing the diagram…</p></div>';
          }
          return false;
        },
        link: function (t) {
          var href = String(t.href || '');
          var inner = this.parser.parseInline(t.tokens);
          if (!/^(https?:|mailto:|#)/i.test(href)) return inner;
          return '<a href="' + attr(href) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>';
        },
        // pictures are not fetched, so nothing leaves the page
        image: function (t) {
          return '<span class="dm-img" contenteditable="false" data-md="' + attr(t.raw || '') + '">[picture: ' + esc(t.text || 'no description') + ']</span>';
        }
      }
    });
    return M;
  }
  function html(md) { return parser.parse(md); }
  function splitBlocks(md) {
    var out = [];
    parser.lexer(md).forEach(function (t) {
      if (t.type === 'space' || t.type === 'def') return;
      var r = String(t.raw || '').replace(/^\n+/, '').replace(/\s+$/, '');
      if (r) out.push(r);
    });
    return out;
  }
  function joinBlocks(blocks) {
    return blocks.filter(function (b) { return String(b).trim(); }).join('\n\n');
  }

  // ---------- rendering each mode ----------
  function render() {
    root.setAttribute('data-mode', state.mode);
    if (titleEl) titleEl.textContent = 'sample.md · ' + MODES[state.mode];
    if (modeNameEl) modeNameEl.textContent = MODES[state.mode];
    if (!booted) return;
    if (state.mode === 'word') renderWord();
    else if (state.mode === 'inline') renderInline();
    else if (state.mode === 'simple') renderSimple();
    else renderRead();
    count();
  }

  // Word: a page you type on, with a small ribbon
  function renderWord() {
    var blocks = splitBlocks(state.md);
    canvas.innerHTML = '<div class="dm-desk"><div class="dm-page dm-doc" contenteditable="true" role="textbox" aria-multiline="true" ' +
      'aria-label="Sample document in Word mode. Type here as in Word." spellcheck="false">' +
      blocks.map(function (b) { return '<div class="dm-blk">' + html(b) + '</div>'; }).join('') + '</div></div>';
    var page = $('.dm-page');
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
      document.execCommand('styleWithCSS', false, false);
    } catch (e) { /* older browsers: the defaults are fine */ }
    page.addEventListener('input', countSoon);
    page.addEventListener('paste', function (e) {
      // paste as plain text, so the page stays tidy Markdown
      var text = e.clipboardData && e.clipboardData.getData('text/plain');
      if (text == null) return;
      e.preventDefault();
      document.execCommand('insertText', false, text);
    });
    page.addEventListener('drop', function (e) { e.preventDefault(); });
    savedRange = null;
    drawDiagrams(page);
  }

  // Inline: the page looks finished, and the paragraph you click shows its Markdown
  function renderInline() {
    state.blocks = splitBlocks(state.md);
    if (state.active >= state.blocks.length) state.active = -1;
    var out = '<div class="dm-inline dm-doc"><p class="dm-tip" id="dm-inline-tip">Click any paragraph to see its Markdown. Press Esc when you are done.</p>';
    state.blocks.forEach(function (b, i) { out += blockHtml(b, i); });
    canvas.innerHTML = out + '</div>';
    drawDiagrams(canvas);
    if (state.active >= 0) {
      var ta = $('.dm-line');
      if (ta) { autosize(ta); ta.focus({ preventScroll: true }); }
    }
  }
  function blockHtml(b, i) {
    if (i === state.active) {
      return '<div class="dm-blk is-src" data-i="' + i + '"><textarea class="dm-line" spellcheck="false" rows="1" ' +
        'aria-label="Markdown of this paragraph. Press Esc when you are done.">' + esc(b) + '</textarea></div>';
    }
    return '<div class="dm-blk" data-i="' + i + '" tabindex="0" aria-describedby="dm-inline-tip">' + html(b) + '</div>';
  }
  function autosize(ta) {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }
  function commitInline() {
    if (state.active < 0) return;
    var ta = $('.dm-line');
    if (ta) state.blocks[state.active] = ta.value;
    state.md = joinBlocks(state.blocks);
    state.active = -1;
  }
  function deactivate(focusBlock) {
    var i = state.active;
    if (i < 0) return;
    commitInline();
    var fresh = splitBlocks(state.md);
    if (fresh.length !== state.blocks.length) { renderInline(); return; }
    state.blocks = fresh;
    var node = canvas.querySelector('.dm-blk[data-i="' + i + '"]');
    if (!node) return;
    var nn = toNode(blockHtml(fresh[i], i));
    node.parentNode.replaceChild(nn, node);
    drawDiagrams(nn);
    if (focusBlock) nn.focus({ preventScroll: true });
  }
  function activate(i) {
    if (state.active === i) return;
    if (state.active >= 0) deactivate(false);
    if (i >= state.blocks.length) return;
    state.active = i;
    state.lastInline = i;
    var node = canvas.querySelector('.dm-blk[data-i="' + i + '"]');
    if (!node) { renderInline(); return; }
    var nn = toNode(blockHtml(state.blocks[i], i));
    node.parentNode.replaceChild(nn, node);
    var ta = nn.querySelector('textarea');
    autosize(ta);
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  // Simple: Markdown on the left, the result on the right
  var pvTimer = 0;
  function renderSimple() {
    canvas.innerHTML = '<div class="dm-simple"><div class="dm-srcpane"><textarea class="dm-src" spellcheck="false" ' +
      'aria-label="Markdown of the sample document"></textarea></div>' +
      '<div class="dm-preview dm-doc" role="region" aria-label="Result"></div></div>';
    var ta = $('.dm-src');
    ta.value = state.md;
    // new things go at the end until you put the cursor somewhere else
    ta.setSelectionRange(ta.value.length, ta.value.length);
    updatePreview();
    ta.addEventListener('input', function () {
      state.md = ta.value;
      clearTimeout(pvTimer);
      pvTimer = setTimeout(updatePreview, 140);
      countSoon();
    });
  }
  function updatePreview() {
    var pv = $('.dm-preview');
    if (!pv) return;
    pv.innerHTML = html(state.md);
    drawDiagrams(pv);
  }

  // Read: the finished document, nothing else
  function renderRead() {
    canvas.innerHTML = '<article class="dm-read dm-doc" aria-label="Sample document in Read mode">' + html(state.md) + '</article>';
    drawDiagrams(canvas);
  }

  // take the text back from whichever view is open
  function syncFromView() {
    if (!booted) return;
    if (state.mode === 'word') {
      var page = $('.dm-page');
      if (page) state.md = domToMd(page);
    } else if (state.mode === 'inline') {
      commitInline();
    } else if (state.mode === 'simple') {
      var ta = $('.dm-src');
      if (ta) state.md = ta.value;
    }
  }
  function currentMd() {
    if (state.mode === 'word') { var p = $('.dm-page'); return p ? domToMd(p) : state.md; }
    if (state.mode === 'inline' && state.active >= 0) {
      var ta = $('.dm-line');
      var b = state.blocks.slice();
      if (ta) b[state.active] = ta.value;
      return joinBlocks(b);
    }
    return state.md;
  }

  // ---------- Word mode: from the page back to Markdown ----------
  var BLOCK = /^(P|DIV|H[1-6]|UL|OL|BLOCKQUOTE|PRE|TABLE|HR|SECTION|ARTICLE)$/;
  function domToMd(node) {
    var out = [];
    blocks(node, out);
    return out.filter(Boolean).join('\n\n');
  }
  function blocks(node, out) {
    var run = '';
    function flush() { var t = run.trim(); if (t) out.push(t); run = ''; }
    Array.prototype.forEach.call(node.childNodes, function (n) {
      if (n.nodeType === 3) { run += inl(n); return; }
      if (n.nodeType !== 1) return;
      var tag = n.tagName, cls = n.classList;
      if (cls.contains('dm-math')) { flush(); out.push('$$\n' + n.getAttribute('data-tex') + '\n$$'); return; }
      if (cls.contains('dm-diagram')) { flush(); out.push('```mermaid\n' + String(n.getAttribute('data-src') || '').replace(/\n+$/, '') + '\n```'); return; }
      if (!BLOCK.test(tag)) { if (tag !== 'BR') run += inl(n); else { flush(); } return; }
      flush();
      if (/^H[1-6]$/.test(tag)) { var h = kids(n).trim(); if (h) out.push(new Array(+tag.charAt(1) + 1).join('#') + ' ' + h); return; }
      if (tag === 'UL' || tag === 'OL') { var l = list(n, tag === 'OL'); if (l) out.push(l); return; }
      if (tag === 'BLOCKQUOTE') {
        var inner = [];
        blocks(n, inner);
        var q = inner.join('\n\n');
        if (q.trim()) out.push(q.split('\n').map(function (s) { return s ? '> ' + s : '>'; }).join('\n'));
        return;
      }
      if (tag === 'PRE') { out.push('```\n' + n.textContent.replace(/\n+$/, '') + '\n```'); return; }
      if (tag === 'TABLE') { var t = table(n); if (t) out.push(t); return; }
      if (tag === 'HR') { out.push('---'); return; }
      if (tag === 'P') { var p = kids(n).trim(); if (p) out.push(p); return; }
      // DIV, SECTION, ARTICLE: a wrapper of blocks, or a paragraph the browser made
      var hasBlock = Array.prototype.some.call(n.children, function (c) { return BLOCK.test(c.tagName); });
      if (hasBlock) blocks(n, out);
      else { var d = kids(n).trim(); if (d) out.push(d); }
    });
    flush();
  }
  function kids(node) { return Array.prototype.map.call(node.childNodes, inl).join(''); }
  function wrap(s, m) {
    var t = s.trim();
    if (!t) return s;
    return s.match(/^\s*/)[0] + m + t + m + s.match(/\s*$/)[0];
  }
  function inl(node) {
    if (node.nodeType === 3) return node.nodeValue.replace(/ /g, ' ').replace(/\s*\n\s*/g, ' ');
    if (node.nodeType !== 1) return '';
    var tag = node.tagName, cls = node.classList;
    if (cls.contains('dm-imath')) return '$' + node.getAttribute('data-tex') + '$';
    if (cls.contains('dm-img')) return node.getAttribute('data-md') || '';
    if (tag === 'INPUT') return '';
    if (tag === 'BR') return ' ';
    var inner = kids(node);
    switch (tag) {
      case 'B': case 'STRONG': return wrap(inner, '**');
      case 'I': case 'EM': return wrap(inner, '_');
      case 'S': case 'DEL': case 'STRIKE': return wrap(inner, '~~');
      case 'CODE': return '`' + node.textContent + '`';
      case 'A': { var h = node.getAttribute('href'); return h ? '[' + inner + '](' + h + ')' : inner; }
      default: {
        var st = node.getAttribute('style') || '';
        if (/font-weight:\s*(bold|[6-9]00)/i.test(st)) return wrap(inner, '**');
        if (/font-style:\s*italic/i.test(st)) return wrap(inner, '_');
        return inner;
      }
    }
  }
  function list(n, ordered) {
    var k = 0;
    return Array.prototype.filter.call(n.children, function (c) { return c.tagName === 'LI'; }).map(function (li) {
      k++;
      var box = li.querySelector('input[type="checkbox"]');
      var text = '', nested = '';
      Array.prototype.forEach.call(li.childNodes, function (c) {
        if (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')) {
          nested += '\n' + list(c, c.tagName === 'OL').split('\n').map(function (s) { return '   ' + s; }).join('\n');
        } else if (c.nodeType === 1 && c.tagName === 'P') {
          text += (text ? ' ' : '') + kids(c);
        } else {
          text += inl(c);
        }
      });
      var mark = box ? (box.checked ? '[x] ' : '[ ] ') : '';
      return (ordered ? k + '. ' : '- ') + mark + text.trim() + nested;
    }).join('\n');
  }
  function table(t) {
    var rows = Array.prototype.slice.call(t.querySelectorAll('tr'));
    if (!rows.length) return '';
    var cells = function (tr) {
      return Array.prototype.map.call(tr.children, function (c) { return kids(c).trim().replace(/\|/g, '\\|'); });
    };
    var head = rows[0];
    var aligns = Array.prototype.map.call(head.children, function (c) {
      var a = (c.getAttribute('align') || c.style.textAlign || '').toLowerCase();
      return a === 'right' ? '---:' : a === 'center' ? ':---:' : a === 'left' ? ':---' : '---';
    });
    var lines = ['| ' + cells(head).join(' | ') + ' |', '| ' + aligns.join(' | ') + ' |'];
    rows.slice(1).forEach(function (tr) { lines.push('| ' + cells(tr).join(' | ') + ' |'); });
    return lines.join('\n');
  }

  // ---------- word count ----------
  function words(md) {
    var t = md.replace(/```[\s\S]*?```/g, ' ')
      .replace(/\$\$[\s\S]*?\$\$/g, ' ')
      .replace(/\$[^$\n]+\$/g, ' x ')
      .replace(/^\s*\|?\s*:?-{3,}.*$/gm, ' ')
      .replace(/[#>*_`~|\[\]()!]/g, ' ');
    var m = t.match(/[A-Za-z0-9À-￿]+(?:['’][A-Za-z]+)?/g);
    return m ? m.length : 0;
  }
  var countTimer = 0;
  function count() {
    if (!wordsEl) return;
    var n = words(currentMd());
    wordsEl.textContent = n + (n === 1 ? ' word' : ' words');
  }
  function countSoon() { clearTimeout(countTimer); countTimer = setTimeout(count, 300); }

  // ---------- diagrams (Mermaid, loaded on first use) ----------
  var mermaidLoad = null, svgCache = {}, cacheSize = 0, diagN = 0;
  function themeKey() { return dark.matches ? 'dark' : 'neutral'; }
  function mermaidConfig() {
    return { startOnLoad: false, securityLevel: 'strict', theme: themeKey(), fontFamily: getComputedStyle(document.body).fontFamily };
  }
  function loadMermaid() {
    if (!mermaidLoad) {
      mermaidLoad = loadScript('vendor/mermaid/mermaid.min.js').then(function () {
        var m = window.mermaid;
        if (!m || !m.render) throw new Error('Mermaid did not start in this browser.');
        m.initialize(mermaidConfig());
        return m;
      });
      mermaidLoad.catch(function () { mermaidLoad = null; });
    }
    return mermaidLoad;
  }
  function drawDiagrams(scope) {
    var els = Array.prototype.slice.call(scope.querySelectorAll('.dm-diagram'));
    if (scope.classList && scope.classList.contains('dm-diagram')) els.push(scope);
    var pending = [];
    els.forEach(function (d) {
      var key = themeKey() + '|' + d.getAttribute('data-src');
      if (svgCache[key]) d.innerHTML = svgCache[key];
      else pending.push(d);
    });
    if (!pending.length) return;
    pending.forEach(function (d) {
      if (!window.mermaid) d.innerHTML = '<p class="dm-wait">Loading the diagram tool… This happens once.</p>';
    });
    loadMermaid().then(function (m) {
      return pending.reduce(function (chain, d) {
        return chain.then(function () {
          if (!d.isConnected) return;
          var src = d.getAttribute('data-src') || '';
          var key = themeKey() + '|' + src;
          if (svgCache[key]) { d.innerHTML = svgCache[key]; return; }
          var id = 'dm-diagram-' + (++diagN);
          return Promise.resolve(m.render(id, src)).then(function (r) {
            if (cacheSize > 40) { svgCache = {}; cacheSize = 0; }
            svgCache[key] = r.svg;
            cacheSize++;
            if (d.isConnected) d.innerHTML = r.svg;
          }).catch(function (err) {
            ['#' + id, '#d' + id].forEach(function (s) { var x = document.querySelector(s); if (x) x.remove(); });
            if (d.isConnected) {
              d.innerHTML = problem('Check the diagram’s Markdown in Simple mode: it starts with ```mermaid, and each line joins two boxes, such as A --> B.',
                'The rest of the document still works.', err);
            }
          });
        });
      }, Promise.resolve());
    }, function (err) {
      pending.forEach(function (d) {
        if (d.isConnected) {
          d.innerHTML = problem('Check your internet connection, then click Try again.',
            'Everything else in this preview still works, and Markooj itself draws diagrams offline.', err, 'diagram-retry');
        }
      });
    });
  }

  // ---------- commands ----------
  function restoreSelection(page) {
    if (!page || !savedRange || !page.contains(savedRange.commonAncestorContainer)) return false;
    page.focus({ preventScroll: true });
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    return true;
  }
  function wrapSel(ta, m, label) {
    var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    if (s === e) {
      // no selection: use the word the cursor is in, as Word does
      var a = s, b = s;
      while (a > 0 && /[\wÀ-￿'’]/.test(v.charAt(a - 1))) a--;
      while (b < v.length && /[\wÀ-￿'’]/.test(v.charAt(b))) b++;
      if (a === b) {
        hint('Select a few words first, then click ' + label + '. Ctrl+' + (m === '**' ? 'B' : 'I') + ' works too.');
        return;
      }
      s = a; e = b;
    }
    var sel = v.slice(s, e), text, from = s, to = e;
    if (sel.length > 2 * m.length && sel.slice(0, m.length) === m && sel.slice(-m.length) === m) {
      text = sel.slice(m.length, -m.length);
    } else if (v.slice(s - m.length, s) === m && v.slice(e, e + m.length) === m) {
      from = s - m.length; to = e + m.length; text = sel;
    } else {
      text = m + sel + m;
    }
    ta.focus();
    ta.setSelectionRange(from, to);
    var done = false;
    try { done = document.execCommand('insertText', false, text); } catch (err) { done = false; }
    if (!done) {
      ta.setRangeText(text, from, to, 'end');
      ta.dispatchEvent(new Event('input'));
    }
    if (text.slice(0, m.length) === m && text.slice(-m.length) === m) ta.setSelectionRange(from + m.length, from + text.length - m.length);
    else ta.setSelectionRange(from, from + text.length);
    if (ta.classList.contains('dm-line')) autosize(ta);
  }
  function format(cmd) {
    var label = cmd === 'bold' ? 'Bold' : 'Italic';
    var mark = cmd === 'bold' ? '**' : '_';
    if (state.mode === 'read') {
      hint('Read mode only shows the finished page. Switch to Word, Inline or Simple to make words ' + (cmd === 'bold' ? 'bold' : 'italic') + '.');
      return;
    }
    if (state.mode === 'word') {
      var page = $('.dm-page');
      if (!restoreSelection(page)) {
        hint('Click on the page and select a few words, then click ' + label + '. Ctrl+' + label.charAt(0) + ' works too.');
        return;
      }
      document.execCommand(cmd, false, null);
      if (savedRange && savedRange.collapsed) hint(label + ' is on: what you type next is ' + (cmd === 'bold' ? 'bold' : 'in italics') + '. Or select words first.');
      countSoon();
      return;
    }
    if (state.mode === 'inline') {
      var line = $('.dm-line');
      if (!line) {
        hint('Click a paragraph to see its Markdown, select a few words, then click ' + label + '.');
        return;
      }
      wrapSel(line, mark, label);
      return;
    }
    var src = $('.dm-src');
    if (src) wrapSel(src, mark, label);
  }
  function heading() {
    if (state.mode !== 'word') return;
    var page = $('.dm-page');
    if (!restoreSelection(page)) { hint('Click in a paragraph on the page, then click Heading.'); return; }
    var n = savedRange.startContainer;
    var elx = n.nodeType === 1 ? n : n.parentNode;
    var b = elx.closest && elx.closest('h1, h2, h3, h4, h5, h6, p, li, div');
    var isHeading = b && /^H[1-6]$/.test(b.tagName);
    document.execCommand('formatBlock', false, isHeading ? '<p>' : '<h2>');
    countSoon();
  }
  function topChild(page, node) {
    var n = node && (node.nodeType === 1 ? node : node.parentNode);
    while (n && n.parentNode !== page) n = n.parentNode;
    return n && n.parentNode === page ? n : null;
  }
  function insertBlock(md) {
    if (state.mode === 'word') {
      var page = $('.dm-page');
      var after = savedRange ? topChild(page, savedRange.endContainer) : null;
      var div = document.createElement('div');
      div.className = 'dm-blk';
      div.innerHTML = html(md);
      if (after) page.insertBefore(div, after.nextSibling);
      else page.appendChild(div);
      drawDiagrams(div);
      flash(div);
      scrollWithin(canvas, div);
      countSoon();
      return;
    }
    if (state.mode === 'inline') {
      var at = state.active >= 0 ? state.active : state.lastInline;
      commitInline();
      var list = splitBlocks(state.md);
      if (at < 0 || at >= list.length) at = list.length - 1;
      list.splice(at + 1, 0, md);
      state.md = joinBlocks(list);
      state.lastInline = at + 1;
      renderInline();
      var nb = canvas.querySelector('.dm-blk[data-i="' + (at + 1) + '"]');
      flash(nb);
      scrollWithin(canvas, nb);
      count();
      return;
    }
    if (state.mode === 'simple') {
      var ta = $('.dm-src');
      var v = ta.value, pos = ta.selectionEnd;
      var next = v.indexOf('\n\n', pos);
      var cut = next < 0 ? v.length : next;
      var before = v.slice(0, cut).replace(/\s+$/, ''), rest = v.slice(cut).replace(/^\s+/, '');
      var lead = before ? '\n\n' : '';
      ta.value = before + lead + md + (rest ? '\n\n' + rest : '\n');
      var start = before.length + lead.length;
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(start, start + md.length);
      var lineH = parseFloat(getComputedStyle(ta).lineHeight) || 22;
      ta.scrollTop = Math.max(0, (before.split('\n').length + 1) * lineH - ta.clientHeight / 3);
      state.md = ta.value;
      updatePreview();
      var pv = $('.dm-preview');
      var k = before ? splitBlocks(before).length : 0;
      var el = pv && pv.children[k];
      flash(el);
      scrollWithin(pv, el);
      count();
    }
  }
  function insert(kind) {
    var md = kind === 'table' ? TABLE
      : kind === 'math' ? '$$\n' + EQUATIONS[state.eq++ % EQUATIONS.length] + '\n$$'
      : DIAGRAM;
    var what = kind === 'table' ? 'a table' : kind === 'math' ? 'an equation' : 'a diagram';
    var fromRead = state.mode === 'read';
    if (fromRead) switchMode(lastEditMode, false);
    insertBlock(md);
    var tail = {
      word: 'Underneath, it is a few plain lines of Markdown.',
      inline: 'Click it to see its Markdown.',
      simple: 'Its Markdown is selected on the left.'
    }[state.mode];
    hint((fromRead ? 'Read mode has no editing tools, so the preview switched to ' + MODES[state.mode] + '. ' : '') +
      'Added ' + what + '. ' + tail);
  }
  function reset() {
    state.md = SAMPLE;
    state.active = -1;
    state.lastInline = -1;
    state.eq = 0;
    savedRange = null;
    canvas.scrollTop = 0;
    render();
    hint('Back to the sample document.');
  }
  function act(name) {
    if (name === 'retry') { boot(); return; }
    if (!booted) { hint('The preview is still opening. Try again in a moment.'); boot(); return; }
    if (name === 'diagram-retry') { drawDiagrams(canvas); return; }
    if (name === 'reset') { reset(); return; }
    if (name === 'bold' || name === 'italic') { format(name); return; }
    if (name === 'heading') { heading(); return; }
    if (name === 'table' || name === 'math' || name === 'diagram') insert(name);
  }

  function switchMode(mode, focusTab) {
    if (!MODES[mode]) return;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-mode') === mode;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && focusTab) t.focus();
    });
    if (mode === state.mode) return;
    if (toastEl) { clearTimeout(toastTimer); toastEl.classList.remove('on'); }
    syncFromView();
    state.mode = mode;
    state.active = -1;
    if (mode !== 'read') lastEditMode = mode;
    canvas.scrollTop = 0;
    render();
  }

  // ---------- events ----------
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { switchMode(tab.getAttribute('data-mode'), false); });
    tab.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') n = tabs[0];
      else if (e.key === 'End') n = tabs[tabs.length - 1];
      if (n) { e.preventDefault(); switchMode(n.getAttribute('data-mode'), true); }
    });
  });
  // the buttons keep the text selection where it is
  root.addEventListener('mousedown', function (e) {
    if (e.target.closest && e.target.closest('.dbtn, .rb')) e.preventDefault();
  });
  root.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-act]');
    if (b && root.contains(b)) { act(b.getAttribute('data-act')); return; }
    if (state.mode === 'inline' && booted) {
      var blk = e.target.closest && e.target.closest('.dm-blk');
      if (blk && canvas.contains(blk) && !blk.classList.contains('is-src') && !e.target.closest('a')) {
        activate(+blk.getAttribute('data-i'));
      }
    }
  });
  canvas.addEventListener('keydown', function (e) {
    var t = e.target;
    var mod = (e.ctrlKey || e.metaKey) && !e.altKey;
    if (state.mode === 'inline' && t.classList.contains('dm-blk') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      activate(+t.getAttribute('data-i'));
      return;
    }
    if (t.tagName === 'TEXTAREA') {
      if (mod && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); wrapSel(t, '**', 'Bold'); return; }
      if (mod && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); wrapSel(t, '_', 'Italic'); return; }
      if (e.key === 'Escape' && t.classList.contains('dm-line')) { e.preventDefault(); deactivate(true); }
    }
  });
  canvas.addEventListener('input', function (e) {
    var t = e.target;
    if (t.classList && t.classList.contains('dm-line')) {
      if (state.active >= 0) state.blocks[state.active] = t.value;
      autosize(t);
      countSoon();
    }
  });
  canvas.addEventListener('focusout', function (e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('dm-line')) return;
    var to = e.relatedTarget;
    if (to && (to.closest('.dbtn, .rb') || t.parentNode.contains(to))) return;
    // a click on another paragraph opens that one; anything else closes this one
    setTimeout(function () {
      if (state.mode === 'inline' && state.active >= 0 && document.activeElement !== t) deactivate(false);
    }, 0);
  });
  document.addEventListener('selectionchange', function () {
    if (state.mode !== 'word') return;
    var page = $('.dm-page');
    var sel = window.getSelection();
    if (!page || !sel || !sel.rangeCount) return;
    var r = sel.getRangeAt(0);
    if (page.contains(r.commonAncestorContainer)) savedRange = r.cloneRange();
  });
  if (dark.addEventListener) {
    dark.addEventListener('change', function () {
      if (window.mermaid) { try { window.mermaid.initialize(mermaidConfig()); } catch (e) { /* keeps the old colors */ } }
      if (booted) { syncFromView(); render(); }
    });
  }

  // open the preview when it comes near the screen, or as soon as someone reaches for it
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) {
      if (en.some(function (x) { return x.isIntersecting; })) { io.disconnect(); boot(); }
    }, { rootMargin: '500px 0px' });
    io.observe(root);
    root.addEventListener('pointerenter', boot, { once: true });
    root.addEventListener('focusin', boot, { once: true });
  } else {
    boot();
  }
})();
