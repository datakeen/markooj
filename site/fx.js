// Markooj website. Copyright (C) 2026 Ahmed Bilal and contributors. AGPL-3.0-or-later.
// Small, quiet effects on the theme "Markdown that feels like Word":
//  - a lens over the headline that shows the Markdown under the formatting,
//  - Markdown symbols that drift away from the pointer and turn into what they mean,
//  - a chip on the hero picture that types Markdown and then shows the result,
//  - a slight tilt of the hero picture, and a soft light that follows the mouse on cards.
// Mouse-only effects stay off on touch screens; everything stays still for reduced motion.
(function () {
  'use strict';

  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var reduce = mq('(prefers-reduced-motion: reduce)');
  var fine = mq('(hover: hover) and (pointer: fine)');
  var hero = document.querySelector('.hero');

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // ---------- 1. the Markdown lens over the headline ----------
  var lens = null; // {host, src, ring, x, y, r, tr, raf}
  function setupLens() {
    var host = document.querySelector('.lens-host');
    var h1 = host && host.querySelector('h1');
    if (!host || !h1 || !fine) return;
    var src = h1.cloneNode(true);
    src.removeAttribute('id');
    src.className = 'lens-src';
    src.setAttribute('aria-hidden', 'true');
    // the Markdown marks hang outside the words, so the text keeps exactly the same place
    var mh = el('span', 'mk mk-h');
    src.insertBefore(mh, src.firstChild);
    var w = src.querySelector('.hw');
    if (w) {
      w.insertBefore(el('span', 'mk mk-l'), w.firstChild);
      w.appendChild(el('span', 'mk mk-r'));
    }
    var ring = el('span', 'lens-ring');
    ring.setAttribute('aria-hidden', 'true');
    ring.appendChild(el('span', 'lens-tag', 'Markdown'));
    host.appendChild(src);
    host.appendChild(ring);
    lens = { host: host, h1: h1, src: src, ring: ring, x: 0, y: 0, r: 0, tr: 0, raf: 0 };
  }
  function lensRadius() {
    var fs = parseFloat(getComputedStyle(lens.h1).fontSize) || 80;
    return Math.max(56, Math.min(118, fs * 1.18));
  }
  function lensFrame() {
    lens.raf = 0;
    var k = reduce ? 1 : 0.22;
    lens.r += (lens.tr - lens.r) * k;
    if (Math.abs(lens.tr - lens.r) < 0.4) lens.r = lens.tr;
    var r = Math.max(0, lens.r);
    // the clone is padded by 80px on every side
    lens.src.style.clipPath = 'circle(' + r.toFixed(1) + 'px at ' + (lens.x + 80).toFixed(1) + 'px ' + (lens.y + 80).toFixed(1) + 'px)';
    var d = r * 2;
    lens.ring.style.width = d + 'px';
    lens.ring.style.height = d + 'px';
    lens.ring.style.transform = 'translate(' + (lens.x - r).toFixed(1) + 'px,' + (lens.y - r).toFixed(1) + 'px)';
    lens.ring.classList.toggle('on', r > 6);
    if (lens.r !== lens.tr) lens.raf = requestAnimationFrame(lensFrame);
  }
  function lensMove(e) {
    if (!lens) return false;
    var b = lens.host.getBoundingClientRect();
    var x = e.clientX - b.left, y = e.clientY - b.top;
    // only near the words themselves, not the empty ends of a wide line
    var pad = 22, inside = false;
    if (!lens.range) { lens.range = document.createRange(); lens.range.selectNodeContents(lens.h1); }
    var rects = lens.range.getClientRects();
    for (var i = 0; i < rects.length && !inside; i++) {
      var q = rects[i];
      inside = e.clientX > q.left - pad && e.clientX < q.right + pad && e.clientY > q.top - pad && e.clientY < q.bottom + pad;
    }
    var overButton = e.target && e.target.closest && e.target.closest('a, button');
    lens.x = x; lens.y = y;
    lens.tr = inside && !overButton ? lensRadius() : 0;
    if (!lens.raf) lens.raf = requestAnimationFrame(lensFrame);
    return inside;
  }
  function lensHide() {
    if (!lens) return;
    lens.tr = 0;
    if (!lens.raf) lens.raf = requestAnimationFrame(lensFrame);
  }

  // ---------- 2. Markdown that drifts away from the pointer and resolves ----------
  var TOKENS = [
    ['**bold**', '<b>bold</b>'],
    ['# Title', '<span class="h">Title</span>'],
    ['_italic_', '<i>italic</i>'],
    ['$x^2$', '<span class="m">x</span><sup>2</sup>'],
    ['> quote', '<span class="q">quote</span>'],
    ['- item', '• item'],
    ['`code`', '<code>code</code>'],
    ['~~old~~', '<s>old</s>'],
    ['$\\pi r^2$', '<span class="m">πr</span><sup>2</sup>'],
    ['[link](…)', '<u>link</u>'],
    ['## Results', '<span class="h">Results</span>'],
    ['1. first', '1. first']
  ];
  var layer = null, alive = 0, travel = 0, last = null, tokenIndex = 0;
  function setupDrift() {
    if (!hero || !fine || reduce || !Element.prototype.animate) return;
    window.addEventListener('resize', function () { textBox = null; });
    layer = el('div', 'fx-layer');
    layer.setAttribute('aria-hidden', 'true');
    hero.appendChild(layer);
  }
  var textBox = null;
  function measureText() {
    // the column of words in the hero; symbols appear only beside it and drift away from it
    var parts = hero.querySelectorAll('.hero-text h1, .hero-text .lead, .hero-text .cta, .hero-text .eyebrow, .hero-text .meta');
    var hb = hero.getBoundingClientRect(), l = 1e9, r = -1e9, t = 1e9, b = -1e9;
    Array.prototype.forEach.call(parts, function (p) {
      var q = p.getBoundingClientRect();
      if (!q.width) return;
      if (p.classList.contains('lead') || p.tagName === 'H1') {
        // a centered paragraph is narrower than its box: use the lines themselves
        var rg = document.createRange(); rg.selectNodeContents(p);
        var rr = rg.getBoundingClientRect(); if (rr.width) q = rr;
      }
      l = Math.min(l, q.left - hb.left); r = Math.max(r, q.right - hb.left);
      t = Math.min(t, q.top - hb.top); b = Math.max(b, q.bottom - hb.top);
    });
    textBox = { l: l - 36, r: r + 36, t: t - 30, b: b + 30, cx: (l + r) / 2 };
  }
  function quietSpot(target, x, y) {
    // no symbols over words, buttons or the picture: only in the open space beside them
    if (target && target.closest && target.closest('a, button, figure, .chip, .lens-host')) return false;
    if (!textBox) measureText();
    // beside the column of words, or above it; never under it, where symbols would drift into the text
    if (x > textBox.l && x < textBox.r) return y < textBox.t;
    return true;
  }
  function spawn(x, y) {
    if (alive >= 7) return;
    var t = TOKENS[tokenIndex++ % TOKENS.length];
    var p = el('span', 'pt');
    p.appendChild(el('span', 'pt-raw')).textContent = t[0];
    var f = p.appendChild(el('span', 'pt-fmt', t[1]));
    var raw = p.firstChild;
    layer.appendChild(p);
    alive++;
    // up and away from the words: left of them drifts left, right of them drifts right
    var side = textBox && x < textBox.cx ? -1 : 1;
    var deg = side < 0 ? -90 - (25 + Math.random() * 55) : -90 + (25 + Math.random() * 55);
    var ang = deg * Math.PI / 180;
    var dist = 46 + Math.random() * 44;
    var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
    var at = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%)';
    var dur = 2000 + Math.random() * 500;
    var a = p.animate([
      { transform: at + ' translate(0,0) scale(.92)', opacity: 0 },
      { transform: at + ' translate(' + (dx * .18) + 'px,' + (dy * .18) + 'px) scale(1)', opacity: 1, offset: .12 },
      { transform: at + ' translate(' + (dx * .8) + 'px,' + (dy * .8) + 'px) scale(1)', opacity: 1, offset: .8 },
      { transform: at + ' translate(' + dx + 'px,' + dy + 'px) scale(1)', opacity: 0 }
    ], { duration: dur, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
    raw.animate([{ opacity: 1 }, { opacity: 1, offset: .2 }, { opacity: 0, offset: .34 }, { opacity: 0 }], { duration: dur, fill: 'forwards' });
    f.animate([{ opacity: 0 }, { opacity: 0, offset: .22 }, { opacity: 1, offset: .36 }, { opacity: 1 }], { duration: dur, fill: 'forwards' });
    a.onfinish = function () { p.remove(); alive--; };
  }
  function driftMove(e) {
    if (!layer) return;
    var b = hero.getBoundingClientRect();
    var x = e.clientX - b.left, y = e.clientY - b.top;
    if (last) travel += Math.hypot(x - last.x, y - last.y);
    last = { x: x, y: y };
    if (travel > 95 && quietSpot(e.target, x, y)) {
      travel = 0;
      spawn(x, y);
    }
  }

  // ---------- 3. the typing chip ----------
  var TYPED = [
    ['**Bold**', '<b>Bold</b>'],
    ['# Heading', '<span class="f-h">Heading</span>'],
    ['_in italics_', '<i>in italics</i>'],
    ['$E = mc^2$', '<span class="f-math"><i>E</i> = <i>mc</i><sup>2</sup></span>'],
    ['- [x] Done', '<span class="f-task"><span class="box"></span>Done</span>'],
    ['> A quiet quote', '<span class="f-q">A quiet quote</span>'],
    ['`plain text`', '<span class="f-code">plain text</span>'],
    ['[Markooj](…)', '<span class="f-link">Markooj</span>']
  ];
  function setupChip() {
    var chip = document.querySelector('.chip-type');
    if (!chip) return;
    var text = chip.querySelector('.tc-text'), fmt = chip.querySelector('.tc-fmt');
    if (!text || !fmt) return;
    var i = 0, timer = 0, visible = true, running = false;
    function wait(ms, fn) { timer = setTimeout(fn, ms); }
    function show(item) { text.textContent = item[0]; fmt.innerHTML = item[1]; }
    if (reduce) {
      // still: show one pair at a time, no typing, no movement
      show(TYPED[0]);
      chip.classList.add('is-fmt');
      setInterval(function () {
        if (document.hidden || !visible) return;
        if (chip.classList.contains('is-fmt')) { i = (i + 1) % TYPED.length; show(TYPED[i]); chip.classList.remove('is-fmt'); }
        else chip.classList.add('is-fmt');
      }, 3200);
      observe();
      return;
    }
    function typeItem() {
      if (!visible || document.hidden) { running = false; return; }
      running = true;
      var item = TYPED[i];
      chip.classList.remove('is-fmt');
      text.textContent = '';
      var n = 0;
      // let the last result fade out before the next one is typed
      wait(420, function step() {
        if (!visible || document.hidden) { running = false; return; }
        n++;
        text.textContent = item[0].slice(0, n);
        if (n < item[0].length) wait(55 + Math.random() * 70, step);
        else wait(650, function () {
          fmt.innerHTML = item[1];
          chip.classList.add('is-fmt');
          wait(1900, function () { i = (i + 1) % TYPED.length; typeItem(); });
        });
      });
    }
    function resume() { if (!running && visible && !document.hidden) { clearTimeout(timer); typeItem(); } }
    function observe() {
      if (!('IntersectionObserver' in window)) return;
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (!reduce) resume();
      }).observe(chip);
    }
    document.addEventListener('visibilitychange', resume);
    observe();
    wait(900, typeItem);
  }

  // ---------- 4. a slight tilt of the hero picture, and depth for the chips ----------
  function setupDepth() {
    var stage = document.querySelector('.hero-stage');
    var shot = stage && stage.querySelector('.hero-shot');
    if (!stage || !shot || reduce) return;
    var chips = Array.prototype.slice.call(stage.querySelectorAll('.chip'));
    var depth = [1.6, 2.4];
    var cur = { x: 0, y: 0 }, tgt = { x: 0, y: 0 }, raf = 0, scrollY = 0;
    function frame() {
      raf = 0;
      cur.x += (tgt.x - cur.x) * 0.1;
      cur.y += (tgt.y - cur.y) * 0.1;
      var settled = Math.abs(tgt.x - cur.x) < 0.001 && Math.abs(tgt.y - cur.y) < 0.001;
      if (settled) { cur.x = tgt.x; cur.y = tgt.y; }
      if (cur.x === 0 && cur.y === 0) shot.style.transform = '';
      else shot.style.transform = 'perspective(1800px) rotateX(' + (-cur.y * 2.2).toFixed(3) + 'deg) rotateY(' + (cur.x * 2.6).toFixed(3) + 'deg)';
      chips.forEach(function (c, i) {
        var d = depth[i] || 2;
        var px = cur.x * 9 * d, py = cur.y * 7 * d - scrollY * 0.05 * d;
        c.style.transform = 'translate3d(' + px.toFixed(2) + 'px,' + py.toFixed(2) + 'px,0)';
      });
      if (!settled) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    if (fine) {
      stage.addEventListener('pointermove', function (e) {
        var b = stage.getBoundingClientRect();
        tgt.x = ((e.clientX - b.left) / b.width - 0.5) * 2;
        tgt.y = ((e.clientY - b.top) / b.height - 0.5) * 2;
        kick();
      });
      stage.addEventListener('pointerleave', function () { tgt.x = 0; tgt.y = 0; kick(); });
    }
    // the chips float a little slower than the page while it scrolls past
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var y = window.scrollY || 0;
        if (y > window.innerHeight * 1.5) return;
        scrollY = y;
        chips.forEach(function (c, i) {
          var d = depth[i] || 2;
          c.style.transform = 'translate3d(' + (cur.x * 9 * d).toFixed(2) + 'px,' + (cur.y * 7 * d - y * 0.05 * d).toFixed(2) + 'px,0)';
        });
      });
    }, { passive: true });
  }

  // ---------- 5. a soft light that follows the mouse on cards ----------
  function setupSpot() {
    if (!fine) return;
    var cards = document.querySelectorAll('.feat, .step, .lang, .dl, .lang-en, .note-card');
    Array.prototype.forEach.call(cards, function (c) {
      c.classList.add('spot');
      c.addEventListener('pointermove', function (e) {
        var b = c.getBoundingClientRect();
        c.style.setProperty('--mx', (e.clientX - b.left).toFixed(0) + 'px');
        c.style.setProperty('--my', (e.clientY - b.top).toFixed(0) + 'px');
      });
    });
  }

  function init() {
    if (fine) document.documentElement.classList.add('fx-fine');
    setupLens();
    setupDrift();
    setupChip();
    setupDepth();
    setupSpot();
    if (hero && fine) {
      hero.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
        var overHeadline = lensMove(e);
        if (!overHeadline) driftMove(e);
      });
      hero.addEventListener('pointerleave', function () { lensHide(); last = null; travel = 0; });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
