/* ============================================================
   语林 · 语言学百科  —  app.js
   纯前端、零依赖、可离线（file:// 直接打开即可运行）
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 数据 ---------------- */
  var CATS = (window.LINGUA_CATEGORIES || []).slice();
  var ENTRIES = (window.LINGUA_ENTRIES || []).slice();

  var CAT_BY_ID = {};
  CATS.forEach(function (c) { CAT_BY_ID[c.id] = c; });
  var ENTRY_BY_ID = {};
  ENTRIES.forEach(function (e) { ENTRY_BY_ID[e.id] = e; });

  var CAT_ORDER = {};
  CATS.forEach(function (c, i) { CAT_ORDER[c.id] = i; });

  /* 全局排序：先按分类，再按标题 */
  var ORDERED = ENTRIES.slice().sort(function (a, b) {
    var d = (CAT_ORDER[a.category] || 0) - (CAT_ORDER[b.category] || 0);
    if (d) return d;
    return String(a.title).localeCompare(String(b.title), 'zh-Hans-CN');
  });

  /* ---------------- 工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[\u3000\s]+/g, ' ').trim();
  }
  function stripMd(s) {
    return String(s == null ? '' : s)
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^\s*[-*]\s+/gm, '');
  }
  function debounce(fn, ms) {
    var t; return function () {
      var a = arguments, self = this;
      clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms);
    };
  }
  function clampText(s, n) {
    s = stripMd(s);
    return s.length > n ? s.slice(0, n) + '…' : s;
  }
  function encodeHash(s) { return encodeURIComponent(String(s)); }

  /* IPA 片段自动排版：[...] 内若为音标字符则套用等宽样式 */
  var IPA_RE = /^[a-zA-Z\u0250-\u02FF\u1D00-\u1DBF\uA700-\uA71F\u02B0-\u02FF\u0300-\u036F\u2190-\u2199\u2C70-\u2C7F\u1DC0-\u1DFF\u207F\u02E5-\u02E9\u2016|ˈˌ.]+$/;
  function isIpa(s) { return !!s && s.length <= 26 && /[\u0250-\u02FF\u1D00-\u1DBF\u02E5-\u02E9]/.test(s) && IPA_RE.test(s); }

  function inline(s) {
    var t = esc(stripMd(s));
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/`([^`\n]+)`/g, '<span class="ipa">$1</span>');
    t = t.replace(/\[([^\[\]\n]{1,26})\]/g, function (m, inner) {
      return isIpa(inner) ? '<span class="ipa">[' + inner + ']</span>' : m;
    });
    return t;
  }

  /* 高亮：只在文本节点内匹配，避免破坏 HTML 标签与属性 */
  function highlight(html, tokens) {
    if (!tokens || !tokens.length) return html;
    var pats = [];
    var seen = {};
    tokens.slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (tk) {
      if (!tk || seen[tk]) return;
      seen[tk] = 1;
      pats.push(tk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    });
    if (!pats.length) return html;
    var re = new RegExp('(' + pats.join('|') + ')', 'gi');
    return String(html).split(/(<[^>]*>)/).map(function (part) {
      return part.charAt(0) === '<' ? part : part.replace(re, '<mark>$1</mark>');
    }).join('');
  }

  /* ---------------- 索引 ---------------- */
  function buildIndex(e) {
    var heads = [], paras = [];
    (e.sections || []).forEach(function (s) {
      heads.push(String(s.h || ''));
      (s.p || []).forEach(function (p) { paras.push(stripMd(p)); });
    });
    var terms = (e.terms || []).map(function (t) { return t.t + '：' + t.d; }).join(' ');
    var cat = CAT_BY_ID[e.category] || { name: '' };
    return {
      raw: e,
      id: e.id,
      title: e.title || '',
      en: e.en || '',
      catName: cat.name,
      catId: e.category,
      tags: e.tags || [],
      summary: stripMd(e.summary || ''),
      titleNorm: norm(e.title),
      enNorm: norm(e.en),
      sumNorm: norm(stripMd(e.summary || '')),
      tagNorms: (e.tags || []).map(norm),
      headNorms: heads.map(norm),
      catNorm: norm(cat.name),
      bodyNorm: norm(paras.join('\n') + ' ' + terms),
      bodyText: paras.join('\n'),
      heads: heads
    };
  }
  var INDEX = ENTRIES.map(buildIndex);
  var INDEX_BY_ID = {};
  INDEX.forEach(function (x) { INDEX_BY_ID[x.id] = x; });

  /* 标签统计 */
  var TAGS = (function () {
    var m = {};
    ENTRIES.forEach(function (e) {
      (e.tags || []).forEach(function (t) { m[t] = (m[t] || 0) + 1; });
    });
    return Object.keys(m).map(function (t) { return { name: t, n: m[t] }; })
      .sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name, 'zh'); });
  })();

  /* ---------------- 搜索 ---------------- */
  function tokenize(q) {
    return norm(q).split(' ').filter(Boolean);
  }
  function countOcc(hay, needle) {
    if (!needle) return 0;
    var n = 0, i = 0;
    while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; if (n > 40) break; }
    return n;
  }
  function snippet(text, tokens) {
    var low = text.toLowerCase(), best = -1;
    tokens.forEach(function (t) {
      var i = low.indexOf(t);
      if (i !== -1 && (best === -1 || i < best)) best = i;
    });
    if (best === -1) return clampText(text, 110);
    var start = Math.max(0, best - 46);
    var end = Math.min(text.length, best + 92);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }

  function searchAll(q) {
    var tokens = tokenize(q);
    if (!tokens.length) return [];
    var out = [];
    INDEX.forEach(function (x) {
      var score = 0, where = {}, total = 0;
      for (var i = 0; i < tokens.length; i++) {
        var tk = tokens[i], s = 0;
        if (x.titleNorm === tk) { s += 220; where.title = 1; }
        else if (x.titleNorm.indexOf(tk) !== -1) { s += 130; where.title = 1; }
        if (x.enNorm.indexOf(tk) !== -1) { s += 65; where.en = 1; }
        if (x.catNorm.indexOf(tk) !== -1) { s += 22; where.cat = 1; }
        for (var j = 0; j < x.tagNorms.length; j++) if (x.tagNorms[j].indexOf(tk) !== -1) { s += 48; where.tag = 1; }
        if (x.sumNorm.indexOf(tk) !== -1) { s += 28; where.sum = 1; }
        var hh = 0;
        for (var k = 0; k < x.headNorms.length; k++) if (x.headNorms[k].indexOf(tk) !== -1) hh++;
        if (hh) { s += Math.min(hh, 3) * 16; where.head = 1; }
        var bh = countOcc(x.bodyNorm, tk);
        if (bh) { s += Math.min(bh, 8) * 6; where.body = 1; }
        if (s === 0) return;           /* 所有词都必须命中（AND） */
        total += s;
        score += s;
      }
      if (score > 0) out.push({ x: x, score: score, where: where });
    });
    return out.sort(function (a, b) {
      return b.score - a.score || String(a.x.title).localeCompare(String(b.x.title), 'zh-Hans-CN');
    });
  }

  /* ---------------- 复用片段 ---------------- */
  function chipRow(e, withCat) {
    var cat = CAT_BY_ID[e.category];
    var html = '<div class="chip-row">';
    if (withCat && cat) html += '<span class="chip cat">' + esc(cat.name) + '</span>';
    (e.tags || []).slice(0, 4).forEach(function (t) { html += '<span class="chip">' + esc(t) + '</span>'; });
    html += '</div>';
    return html;
  }
  function entryCard(e, tokens) {
    return '<a class="entry-card" href="#/entry/' + encodeHash(e.id) + '">' +
      '<h3><span>' + highlight(esc(e.title), tokens) + '</span>' +
      (e.en ? '<span class="en">' + highlight(esc(e.en), tokens) + '</span>' : '') + '</h3>' +
      '<p>' + highlight(esc(clampText(e.summary, 118)), tokens) + '</p>' +
      chipRow(e, true) + '</a>';
  }
  function relCard(e) {
    return '<a class="rel-card" href="#/entry/' + encodeHash(e.id) + '">' +
      '<b>' + esc(e.title) + '</b><span>' + esc(e.en || '') + '</span>' +
      '<p>' + esc(clampText(e.summary, 62)) + '</p></a>';
  }

  /* ---------------- 视图：首页 ---------------- */
  function viewHome() {
    var termCount = ENTRIES.reduce(function (a, e) { return a + ((e.terms || []).length); }, 0);
    var byCat = {};
    ENTRIES.forEach(function (e) { byCat[e.category] = (byCat[e.category] || 0) + 1; });

    var h = '';
    h += '<section class="hero">' +
      '<span class="hero-kicker">LINGUISTICS ENCYCLOPEDIA</span>' +
      '<h1>语林 <span class="thin">· 语言学百科</span></h1>' +
      '<p class="lead">从音位的对立到语篇的礼貌，从索绪尔的《教程》到乔姆斯基的最简方案。' +
      '这里收录语言学各分支学科、核心概念、理论学派、研究方法、语言学家与语系文字的条目，' +
      '每个条目都配有定义、实例与关键术语。</p>' +
      '<div class="hero-stats">' +
      '<div class="stat"><b>' + ENTRIES.length + '</b><span>条百科条目</span></div>' +
      '<div class="stat"><b>' + CATS.length + '</b><span>个知识分类</span></div>' +
      '<div class="stat"><b>' + termCount + '</b><span>条术语释义</span></div>' +
      '<div class="stat"><b>' + TAGS.length + '</b><span>个关键词</span></div>' +
      '</div></section>';

    /* 分类卡片 */
    h += '<div class="section-head"><h2>按分类浏览</h2><span class="hint">' + ENTRIES.length + ' 条</span></div>';
    h += '<div class="cat-grid">';
    CATS.forEach(function (c) {
      h += '<a class="cat-card" href="#/cat/' + encodeHash(c.id) + '">' +
        '<span class="c-n">' + (byCat[c.id] || 0) + ' 条</span>' +
        '<span class="c-ico" aria-hidden="true">' + c.icon + '</span>' +
        '<h3>' + esc(c.name) + '</h3><p>' + esc(c.desc) + '</p></a>';
    });
    h += '</div>';

    /* 精选 */
    var featured = ['phoneme', 'saussure', 'cooperative-principle', 'ipa', 'generativism', 'sociolinguistics']
      .map(function (id) { return ENTRY_BY_ID[id]; })
      .filter(Boolean);
    if (!featured.length) featured = ORDERED.slice(0, 6);
    h += '<div class="section-head"><h2>精选条目</h2><span class="hint">编辑推荐</span></div>';
    h += '<div class="entry-list">' + featured.map(function (e) { return entryCard(e); }).join('') + '</div>';

    /* 全部入口 */
    h += '<div class="section-head"><h2>全部条目</h2><span class="hint">A — Z</span></div>';
    h += '<div class="entry-list">' + ORDERED.slice(0, 9).map(function (e) { return entryCard(e); }).join('') + '</div>';
    if (ORDERED.length > 9) {
      h += '<p style="margin-top:22px"><a href="#/all">查看全部 ' + ORDERED.length + ' 个条目 →</a></p>';
    }
    return h;
  }

  /* ---------------- 视图：全部条目 ---------------- */
  var allSort = 'cat';
  function viewAll() {
    var list = allSort === 'title'
      ? ENTRIES.slice().sort(function (a, b) { return String(a.title).localeCompare(String(b.title), 'zh-Hans-CN'); })
      : ORDERED;

    var h = '<nav class="breadcrumb"><a href="#/">首页</a><span class="sep">/</span><span>全部条目</span></nav>';
    h += '<div class="section-head"><h2>全部条目</h2><span class="hint">' + ENTRIES.length + ' 条</span></div>';
    h += '<div class="toolbar"><span class="tb-label">排序</span>' +
      '<div class="seg" id="sortSeg">' +
      '<button data-sort="cat" aria-pressed="' + (allSort === 'cat') + '">按分类</button>' +
      '<button data-sort="title" aria-pressed="' + (allSort === 'title') + '">按标题</button>' +
      '</div><span class="spacer"></span><span class="tb-label">共 ' + ENTRIES.length + ' 条</span></div>';

    if (allSort === 'cat') {
      CATS.forEach(function (c) {
        var items = list.filter(function (e) { return e.category === c.id; });
        if (!items.length) return;
        h += '<div class="section-head"><h2>' + c.icon + ' ' + esc(c.name) + '</h2><span class="hint">' + items.length + '</span></div>';
        h += '<div class="entry-list">' + items.map(function (e) { return entryCard(e); }).join('') + '</div>';
      });
    } else {
      h += '<div class="entry-list">' + list.map(function (e) { return entryCard(e); }).join('') + '</div>';
    }
    return h;
  }

  /* ---------------- 视图：分类 ---------------- */
  function viewCat(id) {
    var c = CAT_BY_ID[id];
    if (!c) return viewNotFound('找不到这个分类');
    var items = ORDERED.filter(function (e) { return e.category === id; });
    var h = '<nav class="breadcrumb"><a href="#/">首页</a><span class="sep">/</span>' +
      '<a href="#/all">全部条目</a><span class="sep">/</span><span>' + esc(c.name) + '</span></nav>';
    h += '<section class="hero" style="padding:30px 30px 26px">' +
      '<span class="hero-kicker">CATEGORY</span>' +
      '<h1 style="font-size:clamp(24px,3.4vw,34px)">' + c.icon + ' ' + esc(c.name) + '</h1>' +
      '<p class="lead" style="margin-bottom:0">' + esc(c.desc) + '</p></section>';
    h += '<div class="section-head"><h2>本类条目</h2><span class="hint">' + items.length + ' 条</span></div>';
    h += items.length
      ? '<div class="entry-list">' + items.map(function (e) { return entryCard(e); }).join('') + '</div>'
      : '<p class="muted">该分类暂无条目。</p>';
    return h;
  }

  /* ---------------- 视图：标签 ---------------- */
  function viewTag(name) {
    var items = ORDERED.filter(function (e) {
      return (e.tags || []).some(function (t) { return t === name; });
    });
    var h = '<nav class="breadcrumb"><a href="#/">首页</a><span class="sep">/</span><span>标签</span>' +
      '<span class="sep">/</span><span>' + esc(name) + '</span></nav>';
    h += '<div class="section-head"><h2>标签：' + esc(name) + '</h2><span class="hint">' + items.length + ' 条</span></div>';
    h += items.length
      ? '<div class="entry-list">' + items.map(function (e) { return entryCard(e); }).join('') + '</div>'
      : '<div class="empty"><span class="big">🕳️</span><h2>没有使用该标签的条目</h2><p><a href="#/all">浏览全部条目</a></p></div>';
    return h;
  }

  /* ---------------- 视图：条目详情 ---------------- */
  var HEADING_IDS = {};
  function headingId(id, i) { return 'sec-' + (i + 1); }

  function viewEntry(id, secAnchor) {
    var e = ENTRY_BY_ID[id];
    if (!e) return viewNotFound('找不到条目「' + id + '」');
    var cat = CAT_BY_ID[e.category];
    var idx = ORDERED.indexOf(e);
    var prev = idx > 0 ? ORDERED[idx - 1] : null;
    var next = idx < ORDERED.length - 1 ? ORDERED[idx + 1] : null;

    var sections = e.sections || [];
    var charCount = 0;
    sections.forEach(function (s) { (s.p || []).forEach(function (p) { charCount += stripMd(p).length; }); });
    var minutes = Math.max(1, Math.round(charCount / 380));

    HEADING_IDS = {};
    sections.forEach(function (s, i) { HEADING_IDS[i] = headingId(id, i); });

    var h = '<nav class="breadcrumb"><a href="#/">首页</a><span class="sep">/</span>' +
      (cat ? '<a href="#/cat/' + encodeHash(cat.id) + '">' + esc(cat.name) + '</a><span class="sep">/</span>' : '') +
      '<span>' + esc(e.title) + '</span></nav>';

    h += '<header class="entry-head">' +
      '<h1>' + esc(e.title) + '</h1>' +
      (e.en ? '<p class="en-name">' + esc(e.en) + '</p>' : '') +
      '<div class="entry-meta">' +
      (cat ? '<a class="chip cat" href="#/cat/' + encodeHash(cat.id) + '">' + esc(cat.name) + '</a>' : '') +
      (e.tags || []).map(function (t) {
        return '<a class="chip" href="#/tag/' + encodeHash(t) + '">' + esc(t) + '</a>';
      }).join('') +
      '<span class="chip plain">约 ' + minutes + ' 分钟</span>' +
      '</div>' +
      '<p class="entry-summary">' + inline(e.summary || '') + '</p>' +
      '</header>';

    var toc = sections.length >= 3
      ? '<nav class="toc" aria-label="本页目录"><div class="toc-title">目录 CONTENTS</div><ul>' +
        sections.map(function (s, i) {
          return '<li><a href="#/entry/' + encodeHash(id) + '~' + headingId(id, i) + '" data-sec="' + headingId(id, i) + '">' +
            esc(s.h || ('第 ' + (i + 1) + ' 节')) + '</a></li>';
        }).join('') + '</ul></nav>'
      : '';

    var body = sections.map(function (s, i) {
      return '<h2 id="' + headingId(id, i) + '">' + esc(s.h || '') +
        '<a class="anchor" href="#/entry/' + encodeHash(id) + '~' + headingId(id, i) + '" aria-label="本节链接">¶</a></h2>' +
        (s.p || []).map(function (p) { return '<p>' + inline(p) + '</p>'; }).join('');
    }).join('');

    h += '<div class="entry-body' + (toc ? ' has-toc' : '') + '">' +
      '<div class="entry-main"><article class="prose">' + body + '</article>';

    /* 术语表 */
    if ((e.terms || []).length) {
      h += '<section class="panel"><h2 class="panel-title">关键词汇</h2><dl class="gloss">' +
        e.terms.map(function (t) {
          return '<div class="gloss-row"><dt>' + esc(t.t) + '</dt><dd>' + inline(t.d) + '</dd></div>';
        }).join('') + '</dl></section>';
    }

    /* 参考文献 */
    if ((e.sources || []).length) {
      h += '<section class="panel"><h2 class="panel-title">参考与延伸阅读</h2><ul class="src-list">' +
        e.sources.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></section>';
    }

    /* 相关条目 */
    var rel = (e.related || []).map(function (r) { return ENTRY_BY_ID[r]; }).filter(Boolean);
    if (rel.length) {
      h += '<section class="panel rel-panel"><h2 class="panel-title">相关条目</h2><div class="rel-grid">' +
        rel.map(relCard).join('') + '</div></section>';
    }

    /* 上下篇 */
    h += '<nav class="pager">';
    h += prev ? '<a class="prev" href="#/entry/' + encodeHash(prev.id) + '"><span class="pg-dir">← 上一条</span><span class="pg-t">' + esc(prev.title) + '</span></a>'
      : '<a hidden></a>';
    h += next ? '<a class="next" href="#/entry/' + encodeHash(next.id) + '"><span class="pg-dir">下一条 →</span><span class="pg-t">' + esc(next.title) + '</span></a>'
      : '<a hidden></a>';
    h += '</nav>';

    h += '</div>' + toc + '</div>';
    return h;
  }

  /* ---------------- 视图：搜索结果 ---------------- */
  function viewSearch(q) {
    var tokens = tokenize(q);
    var res = searchAll(q);
    var h = '<nav class="breadcrumb"><a href="#/">首页</a><span class="sep">/</span><span>搜索</span></nav>';
    h += '<div class="search-head"><h1>搜索 <span class="q">“' + esc(q) + '”</span></h1>' +
      '<p class="muted">找到 ' + res.length + ' 个条目' +
      (tokens.length > 1 ? '（需同时包含：' + tokens.map(esc).join(' · ') + '）' : '') + '</p></div>';

    if (!res.length) {
      h += '<div class="empty"><span class="big">🔍</span><h2>没有找到匹配的条目</h2>' +
        '<p>试试更短的关键词，或直接浏览分类：</p>' +
        '<p style="margin-top:16px">' + CATS.map(function (c) {
          return '<a class="tag-pill" href="#/cat/' + encodeHash(c.id) + '">' + c.icon + ' ' + esc(c.name) + '</a>';
        }).join(' ') + '</p></div>';
      return h;
    }

    h += res.map(function (r) {
      var x = r.x;
      var where = [];
      if (r.where.title) where.push('标题');
      if (r.where.en) where.push('英文名');
      if (r.where.tag) where.push('标签');
      if (r.where.sum) where.push('概述');
      if (r.where.head) where.push('小节标题');
      if (r.where.body) where.push('正文');
      var text = x.summary + '\n' + x.bodyText;
      var snip = highlight(esc(snippet(text, tokens)), tokens);
      return '<article class="result">' +
        '<h3><a href="#/entry/' + encodeHash(x.id) + '">' + highlight(esc(x.title), tokens) + '</a>' +
        (x.en ? '<span class="en">' + highlight(esc(x.en), tokens) + '</span>' : '') + '</h3>' +
        '<p>' + snip + '</p>' +
        '<div class="where">命中：<b>' + where.join(' / ') + '</b> · ' + esc(x.catName) + '</div>' +
        '</article>';
    }).join('');
    return h;
  }

  /* ---------------- 视图：关于 / 404 ---------------- */
  function viewAbout() {
    return '<nav class="breadcrumb"><a href="#/">首页</a><span class="sep">/</span><span>关于</span></nav>' +
      '<header class="entry-head"><h1>关于语林</h1>' +
      '<p class="en-name">About the Lingua Encyclopedia</p>' +
      '<p class="entry-summary">一个不依赖任何后端服务的中文语言学百科：全部数据、样式与检索逻辑都在本地，双击 HTML 即可离线使用。</p>' +
      '</header>' +
      '<div class="prose">' +
      '<h2>内容范围<a class="anchor" href="#/about">¶</a></h2>' +
      '<p>语林目前收录 <strong>' + ENTRIES.length + '</strong> 个条目，分为六个大类：' +
      CATS.map(function (c) { return '「' + c.name + '」'; }).join('、') + '。' +
      '条目结构统一，包含概述、3–5 个小节正文、关键词汇表、相关条目与参考文献，并尽量给出真实语言中的音标与例句。</p>' +
      '<h2>功能<a class="anchor" href="#/about">¶</a></h2>' +
      '<p>站内检索对标题、英文名、分类、标签、概述、小节标题与正文分别加权计分，多个检索词之间为「与」关系；' +
      '结果页会列出每个条目命中的字段并给出上下文片段。条目页提供右侧目录与滚动位置跟随，' +
      '以及「上一条 / 下一条」连续阅读。界面支持深浅色主题与响应式布局，窄屏下侧栏收起为抽屉。</p>' +
      '<h2>快捷键<a class="anchor" href="#/about">¶</a></h2>' +
      '<p><kbd>/</kbd> 聚焦搜索框；<kbd>R</kbd> 随机跳转条目；<kbd>T</kbd> 切换主题；' +
      '<kbd>↑</kbd><kbd>↓</kbd> 在搜索建议中选择，<kbd>Enter</kbd> 打开，<kbd>Esc</kbd> 关闭建议或返回首页。</p>' +
      '<h2>说明<a class="anchor" href="#/about">¶</a></h2>' +
      '<p>本百科为学习与教学用途整理，条目内容经编写与校订，但术语的中文译名在不同教材中可能略有差异。' +
      '引用具体观点或数据时，请核对条目末尾列出的原始文献。</p>' +
      '</div>';
  }

  function viewNotFound(msg) {
    return '<div class="empty"><span class="big">🧭</span><h2>' + esc(msg || '页面不存在') + '</h2>' +
      '<p>也许你想<button class="text-btn" onclick="location.hash=\'#/\'" style="all:unset;color:var(--accent);cursor:pointer">回到首页</button>，' +
      '或者看看<a href="#/all">全部条目</a>。</p></div>';
  }

  /* ---------------- 路由 ---------------- */
  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, '');
    if (!raw) return { name: 'home', arg: '', sec: '' };
    var sec = '';
    var tilde = raw.indexOf('~');
    if (tilde !== -1) { sec = raw.slice(tilde + 1); raw = raw.slice(0, tilde); }
    var parts = raw.split('/');
    var name = parts[0] || 'home';
    var arg = parts.slice(1).join('/');
    return { name: name, arg: arg, sec: sec };
  }

  var viewEl, sidebarEl, searchInput;

  function render(scrollTarget) {
    var r = parseHash();
    var html, title = '语林 · 语言学百科';
    var activeCat = '';

    switch (r.name) {
      case 'home': html = viewHome(); title = '语林 · 语言学百科'; break;
      case 'all': html = viewAll(); title = '全部条目 · 语林'; break;
      case 'cat':
        html = viewCat(decodeURIComponent(r.arg));
        activeCat = decodeURIComponent(r.arg);
        title = (CAT_BY_ID[activeCat] ? CAT_BY_ID[activeCat].name : '分类') + ' · 语林';
        break;
      case 'entry': {
        var eid = decodeURIComponent(r.arg);
        html = viewEntry(eid, r.sec);
        var ee = ENTRY_BY_ID[eid];
        title = (ee ? ee.title : '条目') + ' · 语林';
        break;
      }
      case 'tag':
        var tg = decodeURIComponent(r.arg);
        html = viewTag(tg); title = '标签 ' + tg + ' · 语林'; break;
      case 'search': {
        var q = decodeURIComponent(r.arg);
        html = viewSearch(q); title = '搜索 ' + q + ' · 语林';
        break;
      }
      case 'about': html = viewAbout(); title = '关于 · 语林'; break;
      case 'random': {
        var pick = ENTRIES[Math.floor(Math.random() * ENTRIES.length)];
        location.replace('#/entry/' + encodeHash(pick.id));
        return;
      }
      default: html = viewNotFound('没有这个页面：' + r.name);
    }

    document.title = title;
    viewEl.innerHTML = html;
    window.scrollTo(0, 0);
    bindView();
    renderSidebar(activeCat, r);

    if (r.sec) {
      setTimeout(function () {
        var el = document.getElementById(r.sec);
        if (el) {
          var y = el.getBoundingClientRect().top + window.pageYOffset - 78;
          window.scrollTo({ top: y, behavior: 'smooth' });
          el.style.transition = 'background .5s';
          var old = el.style.background;
          el.style.background = 'color-mix(in srgb, var(--accent) 14%, transparent)';
          setTimeout(function () { el.style.background = old; }, 900);
        }
      }, 60);
    }
  }

  /* ---------------- 侧栏 ---------------- */
  function renderSidebar(activeCat, route) {
    var byCat = {};
    ENTRIES.forEach(function (e) { byCat[e.category] = (byCat[e.category] || 0) + 1; });

    var h = '<div class="side-heading">浏览</div><ul class="side-nav">';
    h += sideLink('#/', '🏠', '首页', '', route.name === 'home');
    h += sideLink('#/all', '📚', '全部条目', ENTRIES.length, route.name === 'all');
    CATS.forEach(function (c) {
      h += sideLink('#/cat/' + encodeHash(c.id), c.icon, c.name, byCat[c.id] || 0, activeCat === c.id);
    });
    h += sideLink('#/about', 'ℹ️', '关于本站', '', route.name === 'about');
    h += '</ul>';

    h += '<div class="side-heading">关键词</div><div class="tagcloud">';
    TAGS.slice(0, 40).forEach(function (t) {
      h += '<a class="tag-pill" href="#/tag/' + encodeHash(t.name) + '">' + esc(t.name) +
        '<span class="n">' + t.n + '</span></a>';
    });
    h += '</div>';

    sidebarEl.innerHTML = h;
  }
  function sideLink(href, ico, name, count, active) {
    return '<li><a class="side-link' + (active ? ' is-active' : '') + '" href="' + href + '">' +
      '<span class="ico" aria-hidden="true">' + ico + '</span>' +
      '<span class="nm">' + esc(name) + '</span>' +
      (count !== '' && count != null ? '<span class="ct">' + count + '</span>' : '') +
      '</a></li>';
  }

  /* ---------------- 目录滚动跟随 ---------------- */
  var spyObserver = null;
  function setupSpy() {
    if (spyObserver) { spyObserver.disconnect(); spyObserver = null; }
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a[data-sec]'));
    if (!tocLinks.length || !('IntersectionObserver' in window)) return;

    var map = {};
    tocLinks.forEach(function (a) { map[a.dataset.sec] = a; });
    var visible = {};

    spyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      var current = null;
      document.querySelectorAll('.prose h2[id]').forEach(function (h2) {
        if (!current && visible[h2.id]) current = h2.id;
      });
      if (!current) {
        /* 兜底：最靠近顶部的小节 */
        var best = null, bestTop = -1e9;
        document.querySelectorAll('.prose h2[id]').forEach(function (h2) {
          var t = h2.getBoundingClientRect().top - 90;
          if (t <= 0 && t > bestTop) { bestTop = t; best = h2.id; }
        });
        current = best;
      }
      tocLinks.forEach(function (a) { a.classList.toggle('is-current', a.dataset.sec === current); });
    }, { rootMargin: '-78px 0px -68% 0px', threshold: [0, 1] });

    document.querySelectorAll('.prose h2[id]').forEach(function (h2) { spyObserver.observe(h2); });
  }

  /* ---------------- 视图内交互绑定 ---------------- */
  function bindView() {
    var seg = $('#sortSeg');
    if (seg) {
      seg.addEventListener('click', function (ev) {
        var b = ev.target.closest('button[data-sort]');
        if (!b) return;
        allSort = b.dataset.sort;
        render();
      });
    }
    setupSpy();
  }

  /* ---------------- 搜索建议 ---------------- */
  var sgIndex = -1, sgItems = [];
  function closeSuggest() {
    var box = $('#suggestBox');
    box.hidden = true; box.innerHTML = '';
    searchInput.setAttribute('aria-expanded', 'false');
    sgIndex = -1; sgItems = [];
  }
  function renderSuggest(q) {
    var box = $('#suggestBox');
    if (!q || !norm(q)) { closeSuggest(); return; }
    var found = searchAll(q);
    var res = found.slice(0, 7);
    var tokens = tokenize(q);
    if (!res.length) {
      box.innerHTML = '<div class="suggest-foot">没有匹配的条目 — 回车查看完整搜索</div>';
      box.hidden = false;
      searchInput.setAttribute('aria-expanded', 'true');
      sgItems = []; sgIndex = -1;
      return;
    }
    box.innerHTML = res.map(function (r, i) {
      return '<a class="suggest-item' + (i === 0 ? ' is-active' : '') + '" role="option" href="#/entry/' + encodeHash(r.x.id) + '">' +
        '<span class="s-t">' + highlight(esc(r.x.title), tokens) + '</span>' +
        (r.x.en ? '<span class="s-e">' + highlight(esc(r.x.en), tokens) + '</span>' : '') +
        '<span class="s-x">' + esc(clampText(r.x.summary, 62)) + '</span></a>';
    }).join('') +
      '<div class="suggest-foot">共 ' + found.length + ' 条结果 · 按 <kbd>Enter</kbd> 查看全部</div>';
    box.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
    sgItems = Array.prototype.slice.call(box.querySelectorAll('.suggest-item'));
    sgIndex = sgItems.length ? 0 : -1;
  }
  function moveSuggest(delta) {
    if (!sgItems.length) return;
    sgIndex = (sgIndex + delta + sgItems.length) % sgItems.length;
    sgItems.forEach(function (el, i) { el.classList.toggle('is-active', i === sgIndex); });
    sgItems[sgIndex].scrollIntoView({ block: 'nearest' });
  }

  /* ---------------- 提示条 ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1900);
  }

  /* ---------------- 主题 ---------------- */
  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    try { localStorage.setItem('lingua-theme', mode); } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'dark' ? '#14161a' : '#f6f3ec');
  }
  function initTheme() {
    /* 允许用 ?theme=dark / ?theme=light 强制指定，便于分享与截图 */
    var forced = /[?&]theme=(dark|light)\b/.exec(location.search || '');
    if (forced) { applyTheme(forced[1]); return; }
    var saved = null;
    try { saved = localStorage.getItem('lingua-theme'); } catch (e) {}
    if (!saved) {
      saved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(saved);
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme');
    var next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    toast(next === 'dark' ? '已切换到深色主题' : '已切换到浅色主题');
  }

  /* ---------------- 移动端抽屉 ---------------- */
  function setNav(open) {
    document.body.classList.toggle('nav-open', open);
    $('#scrim').hidden = !open;
    $('#menuBtn').setAttribute('aria-expanded', String(open));
  }

  /* ---------------- 顶栏搜索行为 ---------------- */
  function doSearch(q) {
    q = String(q || '').trim();
    if (!q) return;
    location.hash = '#/search/' + encodeHash(q);
    closeSuggest();
    searchInput.blur();
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    viewEl = $('#view');
    sidebarEl = $('#sidebar');
    searchInput = $('#searchInput');

    initTheme();

    var foot = $('#footCount');
    if (foot) foot.textContent = String(ENTRIES.length);

    /* 搜索输入 */
    searchInput.addEventListener('input', debounce(function () {
      renderSuggest(searchInput.value);
    }, 110));

    searchInput.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); moveSuggest(1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); moveSuggest(-1); }
      else if (ev.key === 'Enter') {
        ev.preventDefault();
        if (sgIndex >= 0 && sgItems[sgIndex]) { sgItems[sgIndex].click(); closeSuggest(); searchInput.blur(); }
        else doSearch(searchInput.value);
      } else if (ev.key === 'Escape') {
        searchInput.value = ''; closeSuggest(); searchInput.blur();
      }
    });

    searchInput.addEventListener('focus', function () {
      if (searchInput.value) renderSuggest(searchInput.value);
    });

    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('.search')) closeSuggest();
    });

    /* 顶栏按钮 */
    $('#themeBtn').addEventListener('click', toggleTheme);
    $('#randomBtn').addEventListener('click', function () {
      if (!ENTRIES.length) return;
      var pick = ENTRIES[Math.floor(Math.random() * ENTRIES.length)];
      location.hash = '#/entry/' + encodeHash(pick.id);
    });
    $('#menuBtn').addEventListener('click', function () {
      setNav(!document.body.classList.contains('nav-open'));
    });
    $('#scrim').addEventListener('click', function () { setNav(false); });

    /* 侧栏点击后关闭抽屉 */
    sidebarEl.addEventListener('click', function (ev) {
      if (ev.target.closest('a')) setNav(false);
    });

    /* 回到顶部 */
    var toTop = $('#toTop');
    toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    var onScroll = function () { toTop.hidden = window.pageYOffset < 600; };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* 快捷键 */
    document.addEventListener('keydown', function (ev) {
      var tag = (ev.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || ev.target.isContentEditable;
      if (ev.key === '/' && !typing) { ev.preventDefault(); searchInput.focus(); searchInput.select(); return; }
      if (typing) {
        if (ev.key === 'Escape') { closeSuggest(); ev.target.blur(); }
        return;
      }
      var k = ev.key.toLowerCase();
      if (k === 'r' && !ev.metaKey && !ev.ctrlKey) { $('#randomBtn').click(); }
      else if (k === 't' && !ev.metaKey && !ev.ctrlKey) { toggleTheme(); }
      else if (ev.key === 'Escape') {
        if (document.body.classList.contains('nav-open')) setNav(false);
        else if (parseHash().name !== 'home') location.hash = '#/';
      }
    });

    /* 路由 */
    window.addEventListener('hashchange', function () { render(); });
    if (!location.hash) location.replace('#/');
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
