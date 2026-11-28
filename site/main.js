// Markooj website. Copyright (C) 2026 Ahmed Bilal and contributors. AGPL-3.0-or-later.
// Small and dependency-free: download links from the latest GitHub release, OS detection,
// the four-modes switcher, a screenshot lightbox and a gentle reveal on scroll.
(function () {
  'use strict';

  var RELEASES = 'https://github.com/datakeen/markooj/releases/latest';
  var API = 'https://api.github.com/repos/datakeen/markooj/releases/latest';
  var CACHE_KEY = 'markooj-latest-release';
  var CACHE_MS = 30 * 60 * 1000;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // file name endings of the release assets (the shared naming contract)
  var ASSETS = {
    'win-setup': /-win-x64-setup\.exe$/i,
    'win-portable': /-win-x64-portable\.zip$/i,
    'mac-arm64': /-mac-arm64\.dmg$/i,
    'mac-x64': /-mac-x64\.dmg$/i,
    'linux-appimage': /-linux-x86_64\.AppImage$/i,
    'linux-deb': /-linux-amd64\.deb$/i,
    'linux-tar': /-linux-x64\.tar\.gz$/i
  };
  var OS_NAMES = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // ---------- which computer is this? ----------
  function detectOS() {
    var p = '';
    try { p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ''; } catch (e) {}
    var ua = navigator.userAgent || '';
    var s = (p + ' ' + ua).toLowerCase();
    if (/android|iphone|ipad|ipod/.test(s)) return null; // phones and tablets: show every option
    if (/win/.test(s)) return 'windows';
    if (/mac/.test(s)) return 'mac';
    if (/linux|x11|cros/.test(s)) return 'linux';
    return null;
  }
  var os = detectOS();
  var macArch = null; // 'arm' or 'x86', only where the browser says so

  function markMyCard() {
    if (!os) return;
    var card = $('.dl[data-os="' + os + '"]');
    if (!card) return;
    card.classList.add('is-mine');
    var badge = $('.badge', card);
    if (badge) badge.hidden = false;
    // put this computer's card first on narrow screens, where cards stack
    var grid = card.parentNode;
    if (grid && window.matchMedia('(max-width: 900px)').matches) grid.insertBefore(card, grid.firstChild);
  }

  function heroButton(release) {
    var link = $('#hero-download'), label = $('#hero-download-label');
    if (!link || !label || !os) return;
    label.textContent = 'Download for ' + OS_NAMES[os];
    // one obvious file for Windows, and for a Mac whose chip we know; otherwise go to the choices
    var key = os === 'windows' ? 'win-setup' : os === 'mac' && macArch ? (macArch === 'arm' ? 'mac-arm64' : 'mac-x64') : null;
    var a = key && release && release.assets[key];
    link.href = a ? a.url : '#download';
  }

  // ---------- the latest release ----------
  function formatSize(bytes) {
    if (!bytes) return '';
    var mb = bytes / (1024 * 1024);
    return (mb >= 100 ? Math.round(mb) : mb.toFixed(1)) + ' MB';
  }
  function formatDate(iso) {
    try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return ''; }
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (c && Date.now() - c.at < CACHE_MS && c.release) return c.release;
    } catch (e) {}
    return null;
  }
  function writeCache(release) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), release: release })); } catch (e) {}
  }

  // keep only what the page needs
  function simplify(json) {
    if (!json || !json.tag_name || !Array.isArray(json.assets)) return null;
    var out = { version: String(json.tag_name).replace(/^v/i, ''), date: json.published_at || '', url: json.html_url || RELEASES, assets: {} };
    json.assets.forEach(function (asset) {
      Object.keys(ASSETS).forEach(function (key) {
        if (!out.assets[key] && ASSETS[key].test(asset.name || '') && /^https:\/\/github\.com\//.test(asset.browser_download_url || '')) {
          out.assets[key] = { name: asset.name, size: asset.size || 0, url: asset.browser_download_url };
        }
      });
    });
    return out;
  }

  function fetchRelease() {
    var cached = readCache();
    if (cached) return Promise.resolve(cached);
    if (!window.fetch) return Promise.resolve(null);
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    return fetch(API, { headers: { Accept: 'application/vnd.github+json' }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) {
        clearTimeout(timer);
        var rel = simplify(json);
        if (rel) writeCache(rel);
        return rel;
      })
      .catch(function () { clearTimeout(timer); return null; });
  }

  function fillDownloads(release) {
    $$('.dl-file[data-asset]').forEach(function (el) {
      var a = release && release.assets[el.getAttribute('data-asset')];
      var detail = $('.dl-detail', el);
      if (a) {
        el.href = a.url;
        if (detail) detail.textContent = a.name + (a.size ? ' · ' + formatSize(a.size) : '');
      } else {
        el.href = RELEASES; // no release yet, offline or rate-limited: the Releases page always works
        if (detail && release) detail.textContent = (detail.getAttribute('data-pattern') || '').replace('{v}', release.version);
      }
    });
    if (release && release.version) {
      var meta = $('#hero-meta');
      if (meta) meta.textContent = 'Version ' + release.version + ' · For Windows, macOS and Linux · Free under the AGPL';
      var line = $('#release-line');
      if (line) {
        var when = formatDate(release.date);
        line.textContent = 'Markooj ' + release.version + (when ? ', released ' + when + '. ' : '. ');
        var more = document.createElement('a');
        more.href = release.url || RELEASES;
        more.textContent = 'All files and release notes';
        line.appendChild(more);
      }
    }
    heroButton(release);
  }

  function init() {
    markMyCard();
    heroButton(null);
    var archCheck = Promise.resolve();
    if (os === 'mac' && navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      archCheck = navigator.userAgentData.getHighEntropyValues(['architecture']).then(function (v) {
        if (v && v.architecture === 'arm') macArch = 'arm';
        else if (v && v.architecture === 'x86') macArch = 'x86';
      }).catch(function () {});
    }
    Promise.all([fetchRelease(), archCheck]).then(function (r) { fillDownloads(r[0]); });

    setupModes();
    setupLightbox();
    setupReveal();
  }

  // ---------- four modes ----------
  function setupModes() {
    var root = $('[data-modes]');
    if (!root) return;
    var tabs = $$('[role="tab"]', root);
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab, false); });
      tab.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') n = tabs[0];
        else if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
    // the next picture is loaded before it is asked for
    root.addEventListener('pointerenter', function () {
      $$('.mode-panel img', root).forEach(function (img) { img.loading = 'eager'; });
    }, { once: true });
  }

  // ---------- lightbox ----------
  function setupLightbox() {
    var dlg = $('#lightbox');
    var shots = $$('.gallery .shot');
    if (!dlg || !shots.length || typeof dlg.showModal !== 'function') return;
    var img = $('#lb-img'), cap = $('#lb-cap');
    var index = 0;
    function show(i) {
      index = (i + shots.length) % shots.length;
      var b = shots[index];
      var thumb = $('img', b);
      img.src = b.getAttribute('data-full');
      img.alt = thumb ? thumb.alt : '';
      var fc = b.parentNode.querySelector('figcaption');
      cap.innerHTML = '';
      if (fc) {
        var strong = fc.querySelector('strong');
        var s = document.createElement('strong');
        s.textContent = strong ? strong.textContent : fc.textContent;
        cap.appendChild(s);
      }
    }
    var opener = null;
    shots.forEach(function (b, i) {
      b.addEventListener('click', function () {
        opener = b;
        show(i);
        dlg.showModal();
      });
    });
    dlg.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-lb]') : null;
      if (t) { show(index + (t.getAttribute('data-lb') === 'next' ? 1 : -1)); return; }
      if (e.target === dlg) dlg.close(); // a click on the backdrop
    });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
    });
    dlg.addEventListener('close', function () {
      img.removeAttribute('src');
      if (opener) opener.focus();
    });
  }

  // ---------- reveal on scroll ----------
  function setupReveal() {
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    var els = $$('.section .center, .gallery > li, .feat, .lang, .lang-en, .note-card, .step, .credit, .dl, .pillars > li, .support-text, .support-ways > li, .point-list > li, .modes, .demo');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var t = en.target;
        io.unobserve(t);
        t.classList.add('in');
        // once it has arrived, hand the element back to its own hover effects
        var delay = parseFloat(t.style.transitionDelay) || 0;
        setTimeout(function () { t.classList.remove('reveal', 'in'); t.style.transitionDelay = ''; }, 950 + delay);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach(function (el) {
      // anything already on screen shows at once
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) return;
      // cards side by side arrive one after another
      var row = el.parentNode ? Array.prototype.filter.call(el.parentNode.children, function (c) { return els.indexOf(c) >= 0; }) : [];
      var k = row.indexOf(el);
      if (k > 0) el.style.transitionDelay = (k % 3) * 90 + 'ms';
      el.classList.add('reveal');
      io.observe(el);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
