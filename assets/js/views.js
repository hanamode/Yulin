/* ============================================================
   语林 —— views.js
   全部页面渲染：书籍首页 / 目录 / 小节 / 百科 / 搜索 / 关于
   ============================================================ */
(function () {
  'use strict';
  var LG = window.LG, B = LG.BOOK, W = LG.WIKI;
  var V = LG.views = {};
  var esc = LG.esc, bi = LG.bi, pair = LG.pair, t = LG.t, t2 = LG.t2;

  /* 大数按语言格式化：中文用「万」，英文用「M/k」 */
  function fmtBig(n) {
    if (LG.lang === 'en') {
      if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
      if (n >= 1e3) return Math.round(n / 1e3) + 'k';
      return String(n);
    }
    if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + ' 万';
    return n.toLocaleString('zh-CN');
  }
  LG.fmtBig = fmtBig;

  /* 供侧栏等外部模块取章节中文名 */
  V.chapZh = function (id) { return chapName(id).zh; };

  /* ---------------------------------------------------------- 通用件 */

  function crumb(parts) {
    return '<nav class="breadcrumb">' + parts.map(function (p, i) {
      var sep = i ? '<span class="sep">/</span>' : '';
      return sep + (p.href ? '<a href="' + p.href + '">' + p.label + '</a>'
                           : '<span>' + p.label + '</span>');
    }).join('') + '</nav>';
  }

  /* 来源里的 URL 变成可点击链接 */
  function srcItem(text) {
    var raw = String(text || '');
    var m = /https?:\/\/\S+/.exec(raw);
    if (!m) return esc(raw);
    var u = m[0];
    while (u.length && /[.,;:!?、。；：！？”"'）】》]$/.test(u)) u = u.slice(0, -1);
    /* 维基标题常含括号，如 Agreement_(linguistics)，要去掉的是不成对的右括号 */
    while (u.slice(-1) === ')' && (u.match(/\(/g) || []).length < (u.match(/\)/g) || []).length) {
      u = u.slice(0, -1);
    }
    return esc(raw.slice(0, m.index)) +
      '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(u) + '</a>' +
      esc(raw.slice(m.index + u.length));
  }

  /* 术语表里的词，若与某个百科词条同名则链过去 */
  function termCell(text) {
    var id = LG.termLink ? LG.termLink(text) : null;
    if (!id) return esc(text);
    return '<a class="kw" href="#/entry/' + LG.encode(id) + '">' + esc(text) + '</a>';
  }

  /* 小节标题：中文为主、英文为辅。
     带 keep 的一侧不随语言隐藏，因此中文界面下英文以小字副标题常显。 */
  function biTitle(id) {
    var zh = B.titleOf(id, 'zh'), en = B.titleOf(id, 'en');
    if (zh === en) return '<span class="b zh keep">' + esc(zh) + '</span>' +
                          '<span class="b en keep">' + esc(en) + '</span>';
    return '<span class="b zh">' + esc(zh) + '</span>' +
           '<span class="b en keep">' + esc(en) + '</span>';
  }
  /* 小节页大标题：中英均常显，主次随语言 */
  function biH1(id) {
    var zh = B.titleOf(id, 'zh'), en = B.titleOf(id, 'en');
    if (zh === en) return '<span class="b zh keep">' + esc(zh) + '</span>' +
                          '<span class="b en keep">' + esc(en) + '</span>';
    return '<span class="b zh keep">' + esc(zh) + '</span>' +
           '<span class="b en keep">' + esc(en) + '</span>';
  }
  /* 章节名的中英对照 */
  function biChap(topId) {
    var n = chapName(topId);
    if (n.zh === n.en) return '<span class="b zh keep">' + esc(n.zh) + '</span>' +
                              '<span class="b en keep">' + esc(n.en) + '</span>';
    return '<span class="b zh">' + esc(n.zh) + '</span>' +
           '<span class="b en keep">' + esc(n.en) + '</span>';
  }

  function numOf(id) {
    var m = /^([\dA-Z]+(?:\.\d+)*)/.exec(B.title(id) || '');
    return m ? m[1] : '';
  }

  function chapLabel(topId) {
    var title = B.title(topId);
    var no = B.chapterNo(title);
    var zh = title, en = title;
    /* 章节标题中文化：用该章首节的中文小节名推断不出，故保留英文并给出中文意译表 */
    return { title: title, no: no, zh: CHAPTER_ZH[topId] || title, en: title };
  }

  /* 各章中文名（依据书内用语逐章对应） */
  var CHAPTER_ZH = {
    'part-001-chapter-1-language-science': '第 1 章　人类语言与语言科学',
    'part-002-chapter-2-language-power-privilege': '第 2 章　语言、权力与特权',
    'part-003-slug-3-phonetics': '第 3 章　语音学',
    'part-004-chapter-4-phonology': '第 4 章　音系学',
    'part-005-chapter-5-morphology': '第 5 章　形态学',
    'part-006-chapter-6-syntax': '第 6 章　句法学',
    'part-007-chapter-7-semantics': '第 7 章　语义学',
    'part-008-chapter-8-pragmatics': '第 8 章　语用学',
    'part-009-chapter-9-reclaiming': '第 9 章　原住民语言的复兴',
    'part-010-chapter-10-language-variation-and-change': '第 10 章　语言变异与变化',
    'part-011-chapter-11-child-language-acquisition': '第 11 章　儿童语言习得',
    'part-012-chapter-12-adult-language-learning': '第 12 章　成人语言学习',
    'part-013-chapter-13-psycholinguistics-and-neurolinguistics': '第 13 章　心理语言学与神经语言学（编写中）',
    'part-014-chapter-14-historical-linguistics': '第 14 章　历史语言学（编写中）',
    'part-016-appendix-1-alternative-to-6-14-6-21': '附录一　短语结构规则与扁平树结构',
    'part-017-appendex-2-a-history-of-linguistics': '附录二　语言学史',
    'part-019-phonemic-restoration': '语音复原效应',
    'back-matter-001-check-yourself-questions': '自测题',
    'front-matter-001-accessibility-statement': '无障碍声明',
    'front-matter-002-about-the-authors': '关于作者',
    'front-matter-003-acknowledgements': '致谢',
    'front-matter-004-note-to-instructors': '致授课教师',
    'front-matter-005-revisions': '修订说明',
    'title-page': '书名页',
    'copyright': '版权页',
    'front-cover': '封面',
    'table-of-contents': '原书目录'
  };

  function chapName(topId) {
    var en = B.title(topId);
    var zh = CHAPTER_ZH[topId] || en;
    return { zh: zh, en: en };
  }
  /* 按当前语言取章节名 */
  function chapOf(topId) {
    var n = chapName(topId);
    return LG.lang === 'en' ? n.en : n.zh;
  }

  /* ---------- 小节卡片 ---------- */
  function sectionCard(id) {
    var meta = [];
    var c = B.cond(id);
    var raw = B.raw(id);
    if (c) meta.push('<span class="sc-tag on">' + t2('toc.condensed') + '</span>');
    else meta.push('<span class="sc-tag">' + t2('toc.rawOnly') + '</span>');
    if (raw) meta.push('<span class="sc-tag plain">' + raw.chars.toLocaleString() +
      ' <span class="b zh">字符</span><span class="b en">chars</span></span>');
    var snip = c && c.summary
      ? pair(LG.inline(c.summary.zh), LG.inline(c.summary.en), 'sc-sum')
      : (raw ? pair(LG.clamp(LG.stripMd(raw.html.replace(/<[^>]+>/g, ' ')), 110), '', 'sc-sum') : '');

    return '<a class="sec-card" href="#/book/' + LG.encode(id) + '">' +
      '<div class="sc-head"><span class="sc-num">' + esc(numOf(id)) + '</span>' +
      '<span class="sc-title">' + biTitle(id) + '</span></div>' +
      snip +
      '<div class="sc-meta">' + meta.join('') + '</div></a>';
  }

  /* ---------- 百科条目卡片 ---------- */
  function entryCard(e, tokens) {
    var cat = W.catById[e.category];
    var catN = cat ? LG.catName(cat) : '';
    return '<a class="entry-card" href="#/entry/' + LG.encode(e.id) + '">' +
      '<h3><span>' + LG.highlight(esc(e.title), tokens) + '</span>' +
      (e.en ? '<span class="en">' + LG.highlight(esc(e.en), tokens) + '</span>' : '') + '</h3>' +
      '<p>' + LG.highlight(esc(LG.clamp(e.summary, 118)), tokens) +
      (e.summaryEn ? '<span class="b en keep en-sum">' + LG.highlight(esc(LG.clamp(e.summaryEn, 150)), tokens) + '</span>' : '') + '</p>' +
      '<div class="chip-row">' +
      (cat ? '<span class="chip cat">' + esc(catN) + '</span>' : '') +
      (e.tags || []).slice(0, 3).map(function (x) { return '<span class="chip">' + esc(x) + '</span>'; }).join('') +
      '</div></a>';
  }

  function relCard(e) {
    return '<a class="rel-card" href="#/entry/' + LG.encode(e.id) + '">' +
      '<b>' + esc(e.title) + '</b><span>' + esc(e.en || '') + '</span>' +
      '<p>' + esc(LG.clamp(e.summary, 60)) + '</p></a>';
  }

  /* ---------------------------------------------------------- 首页 */

  V.home = function () {
    var s = B.stats();
    var m = B.meta.book || {};
    /* 版式页不进卡片；前置页单列一行，其余（章、附录、专题）保持原书顺序 */
    var hidden = { 'front-cover': 1, 'table-of-contents': 1 };
    var roots = B.roots.filter(function (r) { return !hidden[r.id]; });
    var front = roots.filter(function (r) { return /^front-matter-|^title-page$|^copyright$/.test(r.id); });
    var main = roots.filter(function (r) { return front.indexOf(r) === -1; });

    var h = '';
    h += '<section class="hero book-hero">' +
      '<span class="hero-kicker">' + esc(t('home.kicker')) + '</span>' +
      '<h1>' + '<span class="b zh">' + esc(m.titleZh || '语言学基础') + '</span>' +
        '<span class="b en keep">' + esc(m.title || 'Essentials of Linguistics') + '</span>' + '</h1>' +
      '<p class="lead">' + esc(t('home.subtitle')) + '</p>' +
      '<div class="hero-actions">' +
      '<a class="btn btn-primary" href="#/book/' + LG.encode(firstSection()) + '">' + t2('home.start') + '</a>' +
      '<a class="btn" href="#/toc">' + t2('home.toc') + '</a>' +
      '</div>' +
      '<div class="hero-stats">' +
      '<div class="stat"><b>' + s.condensed + '</b><span>' + esc(t('stat.sections')) + '</span></div>' +
      '<div class="stat"><b>' + fmtBig(s.chars) + '</b><span>' + esc(t('stat.chars')) + '</span></div>' +
      '<div class="stat"><b>' + s.figures + '</b><span>' + esc(t('stat.figures')) + '</span></div>' +
      '<div class="stat"><b>' + s.terms + '</b><span>' + esc(t('stat.terms')) + '</span></div>' +
      '</div></section>';

    /* 书目信息 */
    h += '<div class="book-meta">' +
      '<div class="bm-row"><span class="bm-k">' + t2('book.authors') + '</span><span class="bm-v">' +
      esc((m.authors || []).join(' · ')) + '</span></div>' +
      '<div class="bm-row"><span class="bm-k">' + t2('book.publisher') + '</span><span class="bm-v">' +
      esc(m.publisher || '') + '，' + esc(m.year || '') + '</span></div>' +
      '<div class="bm-row"><span class="bm-k">' + t2('book.license') + '</span><span class="bm-v">' +
      esc(m.license || '') + '</span></div>' +
      '</div>';

    /* 章节 */
    h += '<div class="section-head"><h2>' + t2('home.chapters') + '</h2>' +
      '<span class="hint">' + esc(t('home.chaptersHint')) + '</span></div>';
    h += '<div class="chap-grid">';
    main.forEach(function (r) {
      var n = B.childrenOf[r.id].length;
      var nm = chapName(r.id);
      var condensed = B.childrenOf[r.id].filter(B.hasCond).length;
      h += '<a class="chap-card" href="#/book/' + LG.encode(r.id) + '">' +
        '<span class="cc-no">' + esc(B.chapterNo(r.title) || '·') + '</span>' +
        '<span class="cc-title">' + biChap(r.id) + '</span>' +
        '<span class="cc-meta">' + n + ' <span class="b zh">节</span><span class="b en">sections</span>' +
        ' · ' + condensed + ' <span class="b zh">节精编</span><span class="b en">condensed</span></span></a>';
    });
    h += '</div>';
    if (front.length) {
      h += '<div class="front-row"><span class="fr-label">' + t2('home.frontMatter') + '</span>' +
        front.map(function (r) {
          return '<a class="fr-link" href="#/book/' + LG.encode(r.id) + '">' + biChap(r.id) + '</a>';
        }).join('') + '</div>';
    }

    /* 精选 */
    var feat = ['chapter-030-slug-4-1-phonemes-and-allophones',
                'chapter-093-slug-8-5-the-cooperative-principle',
                'chapter-023-slug-3-6-the-international-phonetic-alphabet',
                'chapter-056-functional-categories',
                'chapter-116-slug-10-1-what-is-variationist-sociolinguistics',
                'chapter-153-slug-14-3-phonological-change']
      .filter(function (id) { return B.byId[id]; });
    if (!feat.length) feat = B.order.slice(0, 6);
    h += '<div class="section-head"><h2>' + t2('home.featured') + '</h2>' +
      '<span class="hint">' + esc(t('home.featuredHint')) + '</span></div>';
    h += '<div class="sec-grid">' + feat.map(sectionCard).join('') + '</div>';

    /* 百科入口 */
    h += '<div class="section-head"><h2>' + t2('home.wikiTitle') + '</h2></div>';
    h += '<div class="wiki-promo"><p>' + esc(t('home.wikiDesc')) + '</p>' +
      '<a class="btn" href="#/wiki">' + t2('home.wikiLink') + ' →</a></div>';

    return h;
  };

  /* 「开始阅读」指向正文第 1 章的第 1 节，跳过前置页 */
  function firstSection() {
    var first = null;
    B.roots.forEach(function (r) {
      if (first) return;
      if (/^Chapter\s+1\b/i.test(r.title)) {
        var kids = B.childrenOf[r.id] || [];
        first = kids.filter(function (id) { return id !== r.id; })[0] || r.id;
      }
    });
    if (first) return first;
    for (var i = 0; i < B.order.length; i++) {
      if (!B.LAYOUT_ONLY[B.order[i]] && B.order[i].indexOf('front-matter') !== 0) return B.order[i];
    }
    return B.order[0] || '';
  }

  /* ---------------------------------------------------------- 全书目录 */

  V.toc = function () {
    var h = crumb([{ label: t('common.home'), href: '#/' },
                   { label: t('nav.toc') }]);
    h += '<div class="section-head"><h2>' + t2('toc.title') + '</h2>' +
      '<span class="hint">' + esc(t('toc.hint')) + '</span></div>';

    B.roots.forEach(function (r) {
      var kids = B.childrenOf[r.id];
      var nm = chapName(r.id);
      h += '<section class="toc-chap">';
      h += '<h3 class="toc-chap-head">' +
        '<a href="#/book/' + LG.encode(r.id) + '">' +
        '<span class="tc-no">' + esc(B.chapterNo(r.title) || '') + '</span>' +
        biChap(r.id) + '</a>' +
        '<span class="tc-count">' + kids.length + '</span></h3>';
      h += '<ol class="toc-list">';
      kids.forEach(function (id) {
        var raw = B.raw(id);
        var c = B.cond(id);
        h += '<li class="' + (c ? '' : 'is-raw') + '"><a href="#/book/' + LG.encode(id) + '">' +
          '<span class="tl-num">' + esc(numOf(id)) + '</span>' +
          '<span class="tl-title">' + biTitle(id) + '</span>' +
          '<span class="tl-tag">' + (c ? t('toc.condensed') : t('toc.rawOnly')) + '</span>' +
          '<span class="tl-chars">' + (raw ? raw.chars.toLocaleString() : '0') + '</span>' +
          '</a></li>';
      });
      h += '</ol></section>';
    });
    return h;
  };

  /* ---------------------------------------------------------- 小节页 */

  V.section = function (id) {
    var item = B.byId[id];
    if (!item) return V.notFound(t('common.notFound'));
    var raw = B.raw(id);
    var c = B.cond(id);
    var top = B.topOf(id);
    var nm = chapName(top);
    var prev = B.prev(id), next = B.next(id);

    var h = crumb([
      { label: t('common.home'), href: '#/' },
      { label: esc(chapOf(top)), href: '#/book/' + LG.encode(top) },
      { label: esc(B.titleOf(id, LG.lang)) }
    ]);

    /* 头部 */
    h += '<header class="entry-head sec-head">' +
      '<h1 class="bi-h1">' + biH1(id) + '</h1>' +
      '<div class="entry-meta">' +
      '<a class="chip cat" href="#/book/' + LG.encode(top) + '">' + esc(chapOf(top)) + '</a>' +
      (raw ? '<span class="chip plain">' + t2('book.sourceChars') + ' ' + raw.chars.toLocaleString() +
        ' <span class="b zh">字符</span><span class="b en">chars</span></span>' : '') +
      (c ? '<span class="chip">' + t2('book.condensed') + '</span>' : '') +
      '</div></header>';

    if (!c) {
      h += '<div class="notice">' + esc(t('book.notCondensed')) + '</div>';
      if (raw) h += rawBlock(raw, true);
      h += pager(prev, next);
      return h;
    }

    /* 单语 / 对照 切换 */
    h += '<div class="toolbar read-toolbar">' +
      '<span class="tb-label">' + t2('book.mode.single') + '</span>' +
      '<div class="seg" id="viewSeg">' +
      '<button data-mode="single" aria-pressed="false">' + t2('book.mode.single') + '</button>' +
      '<button data-mode="parallel" aria-pressed="false">' + t2('book.mode.parallel') + '</button>' +
      '</div><span class="spacer"></span>' +
      (prev ? '<a class="tb-nav" href="#/book/' + LG.encode(prev) + '">← ' +
        esc(B.titleOf(prev, LG.lang)) + '</a>' : '') +
      (next ? '<a class="tb-nav" href="#/book/' + LG.encode(next) + '">' +
        esc(B.titleOf(next, LG.lang)) + ' →</a>' : '') +
      '</div>';

    h += '<div class="entry-body has-toc"><div class="entry-main">';
    var tocItems = [];

    /* 摘要 */
    if (c.summary) {
      tocItems.push(['book-summary', 'book.summary']);
      h += '<section class="blk blk-summary" id="book-summary"><h2 class="panel-title">' + t2('book.summary') + '</h2>' +
        pair(LG.autolink(LG.inline(c.summary.zh)), LG.autolink(LG.inline(c.summary.en)), 'lead-pair') +
        '</section>';
    }

    /* 要点 */
    if ((c.points || []).length) {
      tocItems.push(['book-points', 'book.points']);
      h += '<section class="blk" id="book-points"><h2 class="panel-title">' + t2('book.points') + '</h2>' +
        '<ol class="point-list">' + c.points.map(function (p) {
          return '<li>' + pair(LG.autolink(LG.inline(p.zh)), LG.autolink(LG.inline(p.en))) + '</li>';
        }).join('') + '</ol></section>';
    }

    /* 关键术语 */
    if ((c.terms || []).length) {
      tocItems.push(['book-terms', 'book.terms']);
      h += '<section class="blk" id="book-terms"><h2 class="panel-title">' + t2('book.terms') + '</h2>' +
        '<div class="term-table"><div class="tt-head">' +
        '<span>' + t2('book.termEn') + '</span><span>' + t2('book.termZh') + '</span><span>' +
        t2('book.termDef') + '</span></div>' +
        c.terms.map(function (x) {
          return '<div class="tt-row"><span class="tt-en">' + termCell(x.en) + '</span>' +
            '<span class="tt-zh">' + termCell(x.zh) + '</span>' +
            '<span class="tt-def">' + pair(LG.autolink(LG.inline(x.defZh)),
                                           LG.autolink(LG.inline(x.defEn))) + '</span></div>';
        }).join('') + '</div></section>';
    }

    /* 例证 */
    if ((c.examples || []).length) {
      tocItems.push(['book-examples', 'book.examples']);
      h += '<section class="blk" id="book-examples"><h2 class="panel-title">' + t2('book.examples') + '</h2>' +
        '<div class="ex-list">' + c.examples.map(function (x) {
          return '<div class="ex-card"><div class="ex-text">' + esc(x.text) + '</div>' +
            pair(LG.autolink(LG.inline(x.noteZh)), LG.autolink(LG.inline(x.noteEn)), 'ex-note') + '</div>';
        }).join('') + '</div></section>';
    }

    /* 精编正文 */
    if ((c.body || []).length) {
      tocItems.push(['book-body', 'book.body']);
      h += '<section class="blk" id="book-body"><h2 class="panel-title">' + t2('book.body') + '</h2>' +
        '<div class="prose bi-prose">' +
        c.body.map(function (p) {
          return pair(LG.autolink(LG.inline(p.zh)), LG.autolink(LG.inline(p.en)));
        }).join('') + '</div></section>';
    }

    /* 英文原文 */
    if (raw) {
      tocItems.push(['book-original', 'book.original']);
      h += rawBlock(raw, false);
    }

    h += pager(prev, next);
    h += '</div>' + tocAside(tocItems) + '</div>';
    return h;
  };

  function rawBlock(raw, open) {
    return '<details class="blk raw-block" id="book-original"' + (open ? ' open' : '') + '>' +
      '<summary><span class="rb-label">' + t2('book.original') + '</span>' +
      '<span class="rb-hint">' + esc(t('book.expand')) + '</span></summary>' +
      '<p class="rb-note">' + esc(t('book.originalNote')) + '</p>' +
      '<div class="prose book-raw">' + raw.html + '</div></details>';
  }

  function tocAside(items) {
    if (!items || items.length < 2) return '';
    return '<nav class="toc" aria-label="' + esc(t('nav.contents')) + '"><div class="toc-title">' +
      esc(t('nav.contents')) + '</div><ul>' +
      items.map(function (it) {
        return '<li><a href="#' + it[0] + '" data-sec="' + it[0] + '">' +
          esc(t(it[1])) + '</a></li>';
      }).join('') + '</ul></nav>';
  }

  function pager(prev, next) {
    var h = '<nav class="pager">';
    h += prev
      ? '<a class="prev" href="#/book/' + LG.encode(prev) + '"><span class="pg-dir">← ' + esc(t('book.prev')) +
        '</span><span class="pg-t">' + esc(B.titleOf(prev, LG.lang)) + '</span></a>'
      : '<a hidden></a>';
    h += next
      ? '<a class="next" href="#/book/' + LG.encode(next) + '"><span class="pg-dir">' + esc(t('book.next')) +
        ' →</span><span class="pg-t">' + esc(B.titleOf(next, LG.lang)) + '</span></a>'
      : '<a hidden></a>';
    return h + '</nav>';
  }

  /* ---------------------------------------------------------- 百科 */

  V.wiki = function () {
    var counts = W.countByCat();
    var h = crumb([{ label: t('common.home'), href: '#/' }, { label: t('nav.wiki') }]);
    h += '<section class="hero wiki-hero"><span class="hero-kicker">GLOSSARY</span>' +
      '<h1>' + esc(t('wiki.title')) + '</h1>' +
      '<p class="lead">' + esc(t('wiki.subtitle')) + '（' + W.entries.length + ' ' + t('wiki.entries') + '）</p>' +
      '</section>';
    h += '<div class="notice small">' + esc(t('wiki.langNote')) + '</div>';
    h += '<div class="section-head"><h2>' + t2('wiki.cats') + '</h2></div>';
    h += '<div class="cat-grid">' + W.cats.map(function (c) {
      return '<a class="cat-card" href="#/cat/' + LG.encode(c.id) + '">' +
        '<span class="c-n">' + (counts[c.id] || 0) + '</span>' +
        '<h3>' + esc(LG.catName(c)) + '</h3>' +
        '<p>' + esc(LG.catDesc(c)) + '</p></a>';
    }).join('') + '</div>';
    h += '<div class="section-head"><h2>' + t2('wiki.all') + '</h2>' +
      '<span class="hint">' + W.entries.length + '</span></div>';
    h += '<div class="entry-list">' + W.ordered.map(function (e) { return entryCard(e); }).join('') + '</div>';
    return h;
  };

  V.wikiCat = function (id) {
    var c = W.catById[id];
    if (!c) return V.notFound(t('common.notFound'));
    var items = W.ofCat(id);
    var h = crumb([{ label: t('common.home'), href: '#/' },
                   { label: t('nav.wiki'), href: '#/wiki' },
                   { label: esc(LG.catName(c)) }]);
    h += '<section class="hero wiki-hero"><span class="hero-kicker">CATEGORY</span>' +
      '<h1>' + esc(LG.catName(c)) + '</h1>' +
      '<p class="lead">' + esc(LG.catDesc(c)) + '</p></section>';
    h += '<div class="section-head"><h2>' + t2('wiki.entries') + '</h2>' +
      '<span class="hint">' + items.length + '</span></div>';
    h += '<div class="entry-list">' + items.map(function (e) { return entryCard(e); }).join('') + '</div>';
    return h;
  };

  V.tag = function (name) {
    var items = W.ordered.filter(function (e) {
      return (e.tags || []).indexOf(name) !== -1;
    });
    var h = crumb([{ label: t('common.home'), href: '#/' },
                   { label: t('nav.wiki'), href: '#/wiki' },
                   { label: esc(name) }]);
    h += '<div class="section-head"><h2>' + esc(name) + '</h2><span class="hint">' + items.length + '</span></div>';
    h += items.length
      ? '<div class="entry-list">' + items.map(function (e) { return entryCard(e); }).join('') + '</div>'
      : '<div class="empty"><h2>' + esc(t('search.none')) + '</h2></div>';
    return h;
  };

  V.entry = function (id) {
    var e = W.byId[id];
    if (!e) return V.notFound(t('common.notFound'));
    var cat = W.catById[e.category];
    var idx = W.ordered.indexOf(e);
    var prev = idx > 0 ? W.ordered[idx - 1] : null;
    var next = idx < W.ordered.length - 1 ? W.ordered[idx + 1] : null;
    var chars = 0;
    (e.sections || []).forEach(function (s) { (s.p || []).forEach(function (p) { chars += LG.stripMd(p).length; }); });

    var h = crumb([{ label: t('common.home'), href: '#/' },
                   { label: t('nav.wiki'), href: '#/wiki' },
                   (cat ? { label: esc(LG.catName(cat)), href: '#/cat/' + LG.encode(cat.id) } : null),
                   { label: esc(e.title) }].filter(Boolean));

    h += '<header class="entry-head"><h1>' + esc(e.title) + '</h1>' +
      (e.en ? '<p class="en-name">' + esc(e.en) + '</p>' : '') +
      '<div class="entry-meta">' +
      (cat ? '<a class="chip cat" href="#/cat/' + LG.encode(cat.id) + '">' + esc(LG.catName(cat)) + '</a>' : '') +
      (e.tags || []).map(function (x) {
        return '<a class="chip" href="#/tag/' + LG.encode(x) + '">' + esc(x) + '</a>';
      }).join('') +
      '<span class="chip plain">' + LG.readMinutes(chars) + ' ' + esc(t('book.minutes')) + '</span>' +
      '</div>' +
      '<div class="entry-summary">' +
      pair(LG.autolink(LG.inline(e.summary || ''), { self: id }),
           LG.autolink(LG.inline(e.summaryEn || ''), { self: id })) + '</div></header>';

    var toc = (e.sections || []).length >= 3
      ? '<nav class="toc"><div class="toc-title">' + esc(t('nav.contents')) + '</div><ul>' +
        e.sections.map(function (s, i) {
          return '<li><a href="#/entry/' + LG.encode(id) + '~sec-' + (i + 1) +
            '" data-sec="sec-' + (i + 1) + '">' + esc(s.h || '') + '</a></li>';
        }).join('') + '</ul></nav>' : '';

    var body = (e.sections || []).map(function (s, i) {
      var ps = s.p || [], psEn = s.pEn || [];
      var paras = [];
      for (var k = 0; k < Math.max(ps.length, psEn.length); k++) {
        paras.push(pair(LG.autolink(LG.inline(ps[k] || ''), { self: id }),
                        LG.autolink(LG.inline(psEn[k] || ''), { self: id })));
      }
      return '<h2 id="sec-' + (i + 1) + '">' + bi(esc(s.h || ''), esc(s.hEn || s.h || '')) +
        '<a class="anchor" href="#/entry/' + LG.encode(id) + '~sec-' + (i + 1) + '">¶</a></h2>' +
        paras.join('');
    }).join('');

    h += '<div class="entry-body' + (toc ? ' has-toc' : '') + '"><div class="entry-main">' +
      '<article class="prose">' + body + '</article>';

    if ((e.terms || []).length) {
      h += '<section class="panel"><h2 class="panel-title">' + esc(t('wiki.gloss')) + '</h2><dl class="gloss">' +
        e.terms.map(function (x) {
          return '<div class="gloss-row"><dt>' + bi(esc(x.t), esc(x.tEn || x.t)) + '</dt>' +
            '<dd>' + pair(LG.inline(x.d), LG.inline(x.dEn || '')) + '</dd></div>';
        }).join('') + '</dl></section>';
    }
    if ((e.sources || []).length) {
      h += '<section class="panel"><h2 class="panel-title">' + esc(t('wiki.sources')) + '</h2><ul class="src-list">' +
        e.sources.map(function (x) { return '<li>' + srcItem(x) + '</li>'; }).join('') + '</ul></section>';
    }
    var rel = (e.related || []).map(function (r) { return W.byId[r]; }).filter(Boolean);
    if (rel.length) {
      h += '<section class="panel rel-panel"><h2 class="panel-title">' + esc(t('wiki.related')) +
        '</h2><div class="rel-grid">' + rel.map(relCard).join('') + '</div></section>';
    }

    h += '<nav class="pager">';
    h += prev ? '<a class="prev" href="#/entry/' + LG.encode(prev.id) + '"><span class="pg-dir">← ' +
      esc(t('book.prev')) + '</span><span class="pg-t">' + esc(prev.title) + '</span></a>' : '<a hidden></a>';
    h += next ? '<a class="next" href="#/entry/' + LG.encode(next.id) + '"><span class="pg-dir">' +
      esc(t('book.next')) + ' →</span><span class="pg-t">' + esc(next.title) + '</span></a>' : '<a hidden></a>';
    h += '</nav></div>' + toc + '</div>';
    return h;
  };

  /* ---------------------------------------------------------- 搜索 */

  V.search = function (q, res) {
    var h = crumb([{ label: t('common.home'), href: '#/' }, { label: t('nav.search') }]);
    h += '<div class="search-head"><h1>' + esc(t('search.title')) + ' <span class="q">“' + esc(q) + '”</span></h1>' +
      '<p class="muted">' + esc(t('search.found', { n: res.length })) + '</p></div>';

    if (!res.length) {
      h += '<div class="empty"><h2>' + esc(t('search.none')) + '</h2>' +
        '<p>' + esc(t('search.noneHint')) + '</p>' +
        '<p style="margin-top:14px"><a class="btn" href="#/toc">' + t2('home.toc') + '</a></p></div>';
      return h;
    }

    var bookRes = res.filter(function (r) { return r.kind === 'book'; });
    var wikiRes = res.filter(function (r) { return r.kind === 'wiki'; });

    if (bookRes.length) {
      h += '<div class="section-head"><h2>' + t2('search.inBook') + '</h2>' +
        '<span class="hint">' + bookRes.length + '</span></div>';
      h += bookRes.map(function (r) {
        var c = B.cond(r.id);
        var snip = r.snippet
          ? pair(LG.highlight(LG.inline(LG.clamp(r.snippet.zh, 160)), r.tokens),
                 LG.highlight(LG.inline(LG.clamp(r.snippet.en, 200)), r.tokens), 'sc-sum')
          : pair(LG.highlight(esc(LG.clamp(r.text, 150)), r.tokens), '', 'sc-sum');
        return '<article class="result"><h3><a href="#/book/' + LG.encode(r.id) + '">' +
          biTitle(r.id) + '</a></h3>' + snip +
          '<div class="where">' + esc(t('search.hit')) + '：<b>' + r.hits.join(' / ') + '</b> · ' +
          esc(B.chapterTitle(r.id)) + '</div></article>';
      }).join('');
    }
    if (wikiRes.length) {
      h += '<div class="section-head"><h2>' + t2('search.inWiki') + '</h2>' +
        '<span class="hint">' + wikiRes.length + '</span></div>';
      h += wikiRes.map(function (r) {
        var x = W.indexById[r.id];
        return '<article class="result"><h3><a href="#/entry/' + LG.encode(r.id) + '">' +
          LG.highlight(esc(x.title), r.tokens) + '</a>' +
          (x.en ? '<span class="en">' + LG.highlight(esc(x.en), r.tokens) + '</span>' : '') + '</h3>' +
          '<p>' + LG.highlight(esc(LG.clamp(x.summary, 150)), r.tokens) +
          (x.summaryEn ? '<span class="b en keep en-sum">' +
            LG.highlight(esc(LG.clamp(x.summaryEn, 200)), r.tokens) + '</span>' : '') + '</p>' +
          '<div class="where">' + esc(t('search.hit')) + '：<b>' + r.hits.join(' / ') + '</b> · ' +
          esc(x.catName) + '</div></article>';
      }).join('');
    }
    return h;
  };

  /* ---------------------------------------------------------- 关于 / 404 */

  V.about = function () {
    var m = B.meta.book || {};
    var s = B.stats();
    return crumb([{ label: t('common.home'), href: '#/' }, { label: t('nav.about') }]) +
      '<header class="entry-head"><h1>' + esc(t('about.title')) + '</h1>' +
      '<p class="entry-summary">' + esc(t('home.subtitle')) + '</p></header>' +
      '<div class="prose">' +
      '<h2>' + esc(t('about.book')) + '</h2>' +
      '<p><em>' + esc(m.title || '') + '</em>（' + esc(m.titleZh || '') + '），' +
      esc((m.authors || []).join('、')) + '，' + esc(m.publisher || '') + '，' + esc(m.year || '') +
      '。原书以 <strong>' + esc(m.license || '') + '</strong> 协议发布，本站为非商业性的学习用途改编，' +
      '章节顺序、术语与例证均依照原书；每节英文原文逐字取自原书 EPUB，未作改动。' +
      '原书地址：<a href="' + esc(m.source || '#') + '" target="_blank" rel="noopener">' + esc(m.source || '') + '</a>。</p>' +
      '<h2>' + esc(t('about.lang')) + '</h2>' +
      '<p>本站提供 <strong>中文</strong> 与 <strong>English</strong> 两种界面语言。顶栏的语言按钮可一键切换整页语言；' +
      '切换是纯样式行为，不会重新加载页面，也不会丢失阅读位置。在小节页还可开启「对照」模式，' +
      '把中英文并排显示。日文界面已预留位置，内容正在制作中。</p>' +
      '<p>语言也可以用网址强制指定，便于分享，例如 <code>index.html?lang=en#/book/…</code>。' +
      '此外 <code>?theme=dark</code> 可直接指定深色主题。</p>' +
      '<h2>' + esc(t('about.features')) + '</h2>' +
      '<p>全书按原书顺序收录 ' + s.sections + ' 个小节，其中 ' + s.condensed + ' 节配有中英双语精编' +
      '（摘要 · 要点 · 关键术语 · 例证 · 精编正文），并附该节英文原文全文；' +
      '共整理 ' + s.terms + ' 条术语对照与 ' + s.figures + ' 幅图表示例。' +
      '站内检索同时覆盖本书与术语百科，并对标题、标签、概述与正文分别加权计分。</p>' +
      '<h2>关键词跳转</h2>' +
      '<p>正文中出现的专业名词带有灰色下划线，点击即可跳到对应的术语词条；' +
      '每个词条在同一页只链一次，当前正在阅读的词条不再自链。' +
      '书籍各节末尾的关键术语表若与某个词条同名，也会直接给出链接。' +
      '原书英文原文一栏保持逐字原样，不插入任何链接。</p>' +
      '<h2>术语百科</h2>' +
      '<p>百科共收录 ' + W.entries.length + ' 个词条，按分支学科、核心概念、理论学派、研究方法、' +
      '语言学家、语系与文字六类编排，每条均为中英双语，并在末尾列出所参考的维基百科条目与经典文献。' +
      '词条正文中的专业名词同样可以点击跳转。</p>' +
      '<h2>' + esc(t('about.keys')) + '</h2>' +
      '<p><kbd>/</kbd> 聚焦搜索；<kbd>R</kbd> 随机一节；<kbd>T</kbd> 切换主题；' +
      '<kbd>L</kbd> 切换语言；<kbd>Esc</kbd> 返回首页。</p>' +
      '<h2>' + esc(t('about.notice')) + '</h2>' +
      '<p>精编部分是对原书内容的忠实提炼，用于快速把握要点；学术引用与细节核对请以每节末尾的英文原文及原书为准。' +
      '原书第 13、14 章在出版时标记为「编写中」，本站保留其原有标题与顺序。' +
      '原书内嵌的 20 个手语演示视频未随本站分发，相应位置保留了视频名称。</p>' +
      '</div>';
  };

  V.notFound = function (msg) {
    return '<div class="empty"><h2>' + esc(msg || t('common.notFound')) + '</h2>' +
      '<p><a href="#/">' + esc(t('common.backHome')) + '</a> · <a href="#/toc">' + esc(t('nav.toc')) + '</a></p></div>';
  };
})();
