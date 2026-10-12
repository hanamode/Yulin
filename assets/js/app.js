/* ============================================================
   语林 —— app.js
   路由、检索、侧栏、语言切换、快捷键
   ============================================================ */
(function () {
  'use strict';

  var LG = window.LG, B = LG.BOOK, W = LG.WIKI, V = LG.views;
  var $ = LG.$, $$ = LG.$$, t = LG.t;

  /* ---------------------------------------------------- 状态 */
  var state = { parallel: false };
  var BOOK_IDX = null;
  var bookIdx = function () { return BOOK_IDX || (BOOK_IDX = B.searchIndex()); };

  /* ---------------------------------------------------- 检索 */
  function searchBook(q) {
    var tokens = LG.norm(q).split(' ').filter(Boolean);
    if (!tokens.length) return [];
    var out = [];
    bookIdx().forEach(function (x) {
      var score = 0, hits = {};
      for (var i = 0; i < tokens.length; i++) {
        var tk = tokens[i], s = 0;
        if (x.title === tk) { s += 240; hits['标题'] = 1; }
        else if (x.title.indexOf(tk) !== -1) { s += 140; hits['标题'] = 1; }
        if (x.num && x.num.toLowerCase() === tk) { s += 120; hits['编号'] = 1; }
        if (x.zh.indexOf(tk) !== -1) { s += 42; hits['精编'] = 1; }
        if (x.en.indexOf(tk) !== -1) { s += 34; hits['原文小标题'] = 1; }
        for (var j = 0; j < x.terms.length; j++) {
          if (LG.norm(x.terms[j].en) === tk || LG.norm(x.terms[j].zh) === tk) { s += 55; hits['术语'] = 1; }
        }
        var rh = LG.countOcc(x.raw, tk);
        if (rh) { s += Math.min(rh, 6) * 10; hits['英文原文'] = 1; }
        if (s === 0) return;
        score += s;
      }
      if (score > 0) {
        var c = B.cond(x.id);
        out.push({
          kind: 'book', id: x.id, score: score,
          hits: Object.keys(hits), tokens: tokens,
          snippet: c && c.summary ? c.summary : null,
          text: x.raw.slice(0, 200)
        });
      }
    });
    return out;
  }

  function searchAll(q) {
    var b = searchBook(q);
    var w = W.search(q).map(function (r) {
      return {
        kind: 'wiki', id: r.x.id, score: r.score,
        hits: Object.keys(r.where).map(function (k) {
          return { title: '标题', en: '英文名', tag: '标签', sum: '概述', head: '小节标题', body: '正文', cat: '分类' }[k] || k;
        }),
        tokens: LG.norm(q).split(' ').filter(Boolean)
      };
    });
    return b.concat(w).sort(function (a, c) { return c.score - a.score; }).slice(0, 60);
  }

  /* ---------------------------------------------------- 路由 */
  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, '');
    if (!raw) return { name: 'home', arg: '', sec: '' };
    var sec = '';
    var tilde = raw.indexOf('~');
    if (tilde !== -1) { sec = raw.slice(tilde + 1); raw = raw.slice(0, tilde); }
    var parts = raw.split('/');
    return { name: parts[0] || 'home', arg: parts.slice(1).join('/'), sec: sec };
  }

  var viewEl, sidebarEl, searchInput;

  function render() {
    var r = parseHash();
    if (LG.autolink && LG.autolink.reset) LG.autolink.reset();
    var html, title = '语林 · 语言学百科';
    var ctx = { activeCat: '', chapterId: null };

    switch (r.name) {
      case 'home': html = V.home(); title = '语林 · 语言学百科'; break;
      case 'toc': html = V.toc(); title = t('nav.toc') + ' · 语林'; break;
      case 'book': {
        var id = decodeURIComponent(r.arg);
        html = V.section(id, r.sec);
        ctx.chapterId = B.topOf(id);
        var it = B.byId[id];
        title = (it ? it.title : '') + ' · Essentials of Linguistics';
        break;
      }
      case 'wiki': html = V.wiki(); title = t('wiki.title') + ' · 语林'; break;
      case 'cat': {
        var cid = decodeURIComponent(r.arg);
        html = V.wikiCat(cid); ctx.activeCat = cid;
        title = (W.catById[cid] ? W.catById[cid].name : '') + ' · 语林';
        break;
      }
      case 'entry': {
        var eid = decodeURIComponent(r.arg);
        html = V.entry(eid);
        title = (W.byId[eid] ? W.byId[eid].title : '') + ' · 语林';
        break;
      }
      case 'tag': {
        var tg = decodeURIComponent(r.arg);
        html = V.tag(tg); title = tg + ' · 语林'; break;
      }
      case 'search': {
        var q = decodeURIComponent(r.arg);
        html = V.search(q, searchAll(q)); title = t('search.title') + ' ' + q + ' · 语林';
        break;
      }
      case 'about': html = V.about(); title = t('about.title') + ' · 语林'; break;
      case 'random': {
        var pool = B.order.filter(function (x) { return !B.LAYOUT_ONLY[x]; });
        location.replace('#/book/' + LG.encode(pool[Math.floor(Math.random() * pool.length)]));
        return;
      }
      default: html = V.notFound(t('common.notFound'));
    }

    document.title = title;
    viewEl.innerHTML = html;
    viewEl.classList.toggle('is-book', r.name === 'book');
    window.scrollTo(0, 0);
    renderSidebar(ctx, r);
    bindView();

    if (r.sec) {
      setTimeout(function () {
        var el = document.getElementById(r.sec);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 90, behavior: 'smooth' });
      }, 60);
    }
  }

  /* ---------------------------------------------------- 侧栏 */
  function renderSidebar(ctx, route) {
    var counts = W.countByCat();
    var h = '<div class="side-heading">' + t('nav.book') + '</div><ul class="side-nav">';
    h += sideLink('#/', t('nav.home'), '', route.name === 'home');
    h += sideLink('#/toc', t('nav.toc'), B.order.length, route.name === 'toc');
    h += sideLink('#/random', t('nav.random').replace(/（.*?）/, ''), '', false);
    h += '</ul>';

    /* 本章小节：仅在阅读页出现 */
    if (ctx.chapterId && B.childrenOf[ctx.chapterId]) {
      var nm = B.byId[ctx.chapterId];
      var kids = B.childrenOf[ctx.chapterId];
      var curId = decodeURIComponent(route.arg);
      h += '<div class="side-heading">' + t('book.inChapter') + '</div>';
      h += '<div class="side-chap">' + LG.esc(LG.lang === 'en' ? (nm ? nm.title : '') :
        (LG.views.chapZh(ctx.chapterId) || (nm ? nm.title : ''))) + '</div><ul class="side-nav side-nav-sm">';
      kids.forEach(function (id) {
        h += '<li><a class="side-link' + (id === curId ? ' is-active' : '') + '" href="#/book/' +
          LG.encode(id) + '"><span class="nm">' + LG.esc(B.titleOf(id, LG.lang)) + '</span></a></li>';
      });
      h += '</ul>';
    }

    h += '<div class="side-heading">' + t('nav.wiki') + '</div><ul class="side-nav">';
    h += sideLink('#/wiki', t('wiki.all'), W.entries.length, route.name === 'wiki');
    W.cats.forEach(function (c) {
      h += sideLink('#/cat/' + LG.encode(c.id), W.catName(c), counts[c.id] || 0, ctx.activeCat === c.id);
    });
    h += sideLink('#/about', t('nav.about'), '', route.name === 'about');
    h += '</ul>';

    h += '<div class="side-heading">' + t('nav.tags') + '</div><div class="tagcloud">';
    W.tags.slice(0, 24).forEach(function (tag) {
      h += '<a class="tag-pill" href="#/tag/' + LG.encode(tag.name) + '">' + LG.esc(tag.name) +
        '<span class="n">' + tag.n + '</span></a>';
    });
    h += '</div>';

    sidebarEl.innerHTML = h;
  }

  function sideLink(href, name, count, active) {
    return '<li><a class="side-link' + (active ? ' is-active' : '') + '" href="' + href + '">' +
      '<span class="nm">' + LG.esc(name) + '</span>' +
      (count !== '' && count != null ? '<span class="ct">' + count + '</span>' : '') +
      '</a></li>';
  }

  /* ---------------------------------------------------- 视图内交互 */
  var spyObserver = null;

  function bindView() {
    /* 单语 / 对照 */
    var seg = $('#viewSeg');
    if (seg) {
      $$('button[data-mode]', seg).forEach(function (b) {
        b.setAttribute('aria-pressed', String((b.dataset.mode === 'parallel') === state.parallel));
        b.addEventListener('click', function () {
          state.parallel = b.dataset.mode === 'parallel';
          applyParallel();
          $$('button[data-mode]', seg).forEach(function (o) {
            o.setAttribute('aria-pressed', String((o.dataset.mode === 'parallel') === state.parallel));
          });
        });
      });
    }

    /* 目录点击：平滑滚动，不触发路由 */
    $$('.toc a[data-sec]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        var el = document.getElementById(a.dataset.sec);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 90, behavior: 'smooth' });
      });
    });

    setupSpy();
  }

  /* 目录滚动跟随 */
  function setupSpy() {
    if (spyObserver) { spyObserver.disconnect(); spyObserver = null; }
    var links = $$('.toc a[data-sec]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var targets = $$('.entry-main [id^="book-"], .entry-main h2[id^="sec-"]');
    if (!targets.length) return;

    spyObserver = new IntersectionObserver(function () {
      var current = null, bestTop = -1e9;
      targets.forEach(function (el) {
        var top = el.getBoundingClientRect().top - 100;
        if (top <= 0 && top > bestTop) { bestTop = top; current = el.id; }
      });
      links.forEach(function (a) { a.classList.toggle('is-current', a.dataset.sec === current); });
    }, { rootMargin: '-90px 0px -70% 0px', threshold: [0, 1] });

    targets.forEach(function (el) { spyObserver.observe(el); });
  }

  /* ---------------------------------------------------- 主题 / 语言 / 对照 */

  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    try { localStorage.setItem('lingua-theme', mode); } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'dark' ? '#0d1117' : '#f7f8fa');
  }
  function initTheme() {
    var forced = /[?&]theme=(dark|light)\b/.exec(location.search || '');
    if (forced) return applyTheme(forced[1]);
    var saved = null;
    try { saved = localStorage.getItem('lingua-theme'); } catch (e) {}
    if (!saved) saved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(saved);
  }
  function toggleTheme() {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    LG.toast(next === 'dark' ? '已切换到深色主题' : '已切换到浅色主题');
  }

  function applyParallel() {
    document.documentElement.setAttribute('data-parallel', state.parallel ? 'on' : 'off');
    try { localStorage.setItem('lingua-parallel', state.parallel ? '1' : '0'); } catch (e) {}
  }
  function initParallel() {
    var forced = /[?&]view=(parallel|single)\b/.exec(location.search || '');
    if (forced) {
      state.parallel = forced[1] === 'parallel';
    } else {
      try { state.parallel = localStorage.getItem('lingua-parallel') === '1'; } catch (e) {}
    }
    applyParallel();
  }

  function renderLangSwitcher() {
    var box = $('#langSwitch');
    if (box) box.innerHTML = LG.langSwitcher();
  }
  function switchLang(code) {
    if (!LG.setLang(code)) return;
    renderLangSwitcher();
    if (!location.hash) location.replace('#/');
    render();                       /* 重渲染以刷新标题、侧栏文案与页面 <title> */
    LG.toast(code === 'en' ? 'Language: English' : '界面语言：中文');
  }

  /* ---------------------------------------------------- 搜索建议 */
  var sgIndex = -1, sgItems = [];
  function closeSuggest() {
    var box = $('#suggestBox');
    if (!box) return;
    box.hidden = true; box.innerHTML = '';
    searchInput.setAttribute('aria-expanded', 'false');
    sgIndex = -1; sgItems = [];
  }
  function renderSuggest(q) {
    var box = $('#suggestBox');
    if (!q || !LG.norm(q)) return closeSuggest();
    var all = searchAll(q);
    var res = all.slice(0, 8);
    var tokens = LG.norm(q).split(' ').filter(Boolean);
    if (!res.length) {
      box.innerHTML = '<div class="suggest-foot">' + LG.esc(t('search.none')) + '</div>';
      box.hidden = false; searchInput.setAttribute('aria-expanded', 'true');
      sgItems = []; sgIndex = -1;
      return;
    }
    box.innerHTML = res.map(function (r, i) {
      if (r.kind === 'book') {
        return '<a class="suggest-item' + (i === 0 ? ' is-active' : '') + '" role="option" href="#/book/' + LG.encode(r.id) + '">' +
          '<span class="s-t">' + LG.highlight(LG.esc(B.titleOf(r.id, 'zh')), tokens) + '</span>' +
          '<span class="s-e">' + LG.highlight(LG.esc(B.titleOf(r.id, 'en')), tokens) + '</span>' +
          '<span class="s-x">' + LG.esc(B.chapterTitle(r.id)) + '</span></a>';
      }
      var x = W.indexById[r.id];
      return '<a class="suggest-item' + (i === 0 ? ' is-active' : '') + '" role="option" href="#/entry/' + LG.encode(r.id) + '">' +
        '<span class="s-t">' + LG.highlight(LG.esc(x.title), tokens) + '</span>' +
        (x.en ? '<span class="s-e">' + LG.highlight(LG.esc(x.en), tokens) + '</span>' : '') +
        '<span class="s-x">' + LG.esc(LG.clamp(x.summary, 58)) + '</span></a>';
    }).join('') + '<div class="suggest-foot">' + LG.esc(t('search.found', { n: all.length })) +
      ' · <kbd>Enter</kbd></div>';
    box.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
    sgItems = $$('.suggest-item', box);
    sgIndex = sgItems.length ? 0 : -1;
  }
  function moveSuggest(d) {
    if (!sgItems.length) return;
    sgIndex = (sgIndex + d + sgItems.length) % sgItems.length;
    sgItems.forEach(function (el, i) { el.classList.toggle('is-active', i === sgIndex); });
    sgItems[sgIndex].scrollIntoView({ block: 'nearest' });
  }

  /* ---------------------------------------------------- 移动端抽屉 */
  function setNav(open) {
    document.body.classList.toggle('nav-open', open);
    var scrim = $('#scrim');
    if (scrim) scrim.hidden = !open;
    var btn = $('#menuBtn');
    if (btn) btn.setAttribute('aria-expanded', String(open));
  }

  /* ---------------------------------------------------- 启动 */
  function boot() {
    viewEl = $('#view');
    sidebarEl = $('#sidebar');
    searchInput = $('#searchInput');

    initTheme();
    initParallel();
    LG.initLang();
    renderLangSwitcher();

    var foot = $('#footCount');
    if (foot) foot.textContent = B.order.length;

    searchInput.addEventListener('input', LG.debounce(function () { renderSuggest(searchInput.value); }, 110));
    searchInput.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); moveSuggest(1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); moveSuggest(-1); }
      else if (ev.key === 'Enter') {
        ev.preventDefault();
        if (sgIndex >= 0 && sgItems[sgIndex]) { sgItems[sgIndex].click(); closeSuggest(); searchInput.blur(); }
        else {
          var q = searchInput.value.trim();
          if (q) { location.hash = '#/search/' + LG.encode(q); closeSuggest(); searchInput.blur(); }
        }
      } else if (ev.key === 'Escape') { searchInput.value = ''; closeSuggest(); searchInput.blur(); }
    });
    searchInput.addEventListener('focus', function () { if (searchInput.value) renderSuggest(searchInput.value); });
    document.addEventListener('click', function (ev) { if (!ev.target.closest('.search')) closeSuggest(); });

    /* 语言切换（顶栏） */
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('.lang-btn');
      if (b && !b.disabled) switchLang(b.dataset.lang);
    });

    $('#themeBtn').addEventListener('click', toggleTheme);
    $('#randomBtn').addEventListener('click', function () { location.hash = '#/random'; });
    $('#menuBtn').addEventListener('click', function () {
      setNav(!document.body.classList.contains('nav-open'));
    });
    $('#scrim').addEventListener('click', function () { setNav(false); });
    sidebarEl.addEventListener('click', function (ev) { if (ev.target.closest('a')) setNav(false); });

    var toTop = $('#toTop');
    toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    var onScroll = function () { toTop.hidden = window.pageYOffset < 700; };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    document.addEventListener('keydown', function (ev) {
      var tag = (ev.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || ev.target.isContentEditable;
      if (typing) {
        if (ev.key === 'Escape') { closeSuggest(); ev.target.blur(); }
        return;
      }
      if (ev.key === '/' && !ev.metaKey && !ev.ctrlKey) { ev.preventDefault(); searchInput.focus(); searchInput.select(); return; }
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var k = ev.key.toLowerCase();
      if (k === 'r') location.hash = '#/random';
      else if (k === 't') toggleTheme();
      else if (k === 'l') {
        var order = LG.LANGS.filter(function (l) { return !l.pending; });
        var i = order.map(function (l) { return l.code; }).indexOf(LG.lang);
        switchLang(order[(i + 1) % order.length].code);
      } else if (ev.key === 'Escape') {
        if (document.body.classList.contains('nav-open')) setNav(false);
        else if (parseHash().name !== 'home') location.hash = '#/';
      }
    });

    window.addEventListener('hashchange', render);
    if (!location.hash) location.replace('#/');
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
