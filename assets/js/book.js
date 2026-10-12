/* ============================================================
   语林 —— book.js
   把 data/book/ 下加载进来的原始数据整理成可直接渲染的模型
   ============================================================ */
(function () {
  'use strict';
  var LG = window.LG;

  var TOC = window.LINGUA_BOOK_TOC || [];
  var RAW = (window.LINGUA_BOOK || {}).en || {};        /* 原书英文全文 */
  var CON = (window.LINGUA_BOOK || {}).condense || {};  /* 双语精编 */
  var META = window.LINGUA_BOOK_META || {};

  var byId = {};
  TOC.forEach(function (t) { byId[t.id] = t; });

  var order = TOC.map(function (t) { return t.id; });
  var index = {};
  order.forEach(function (id, i) { index[id] = i; });

  /* 每节所属的顶层章节 */
  function topOf(id) {
    var cur = byId[id];
    while (cur && cur.depth > 1) cur = byId[cur.parent];
    return cur ? cur.id : id;
  }

  var roots = TOC.filter(function (t) { return t.depth === 1; });

  /* 顶层章节 -> 其下全部小节（含自身） */
  var childrenOf = {};
  roots.forEach(function (r) { childrenOf[r.id] = [r.id]; });
  TOC.forEach(function (t) {
    if (t.depth === 1) return;
    var top = topOf(t.id);
    if (childrenOf[top]) childrenOf[top].push(t.id);
  });

  /* 章节序号：从标题里抽 "Chapter 3" / "Appendix 1" 等 */
  function chapterNo(title) {
    var m = /^\[?\s*(?:in progress\]?\s*)?Chapter\s+(\d+)/i.exec(title || '');
    if (m) return m[1];
    m = /^Appendix\s+(\d+)/i.exec(title || '');
    if (m) return 'A' + m[1];
    return null;
  }

  /* 纯版式页（无正文） */
  var LAYOUT_ONLY = {
    'front-cover': 1, 'title-page': 1, 'copyright': 1, 'table-of-contents': 1
  };

  var BOOK = LG.BOOK = {
    meta: META,
    toc: TOC,
    byId: byId,
    order: order,
    index: index,
    roots: roots,
    childrenOf: childrenOf,
    topOf: topOf,
    LAYOUT_ONLY: LAYOUT_ONLY,

    raw: function (id) { return RAW[id] || null; },
    cond: function (id) { return CON[id] || null; },
    hasCond: function (id) { return !!CON[id]; },
    isLayout: function (id) { return !!LAYOUT_ONLY[id]; },
    chapterNo: chapterNo,

    title: function (id) {
      var t = byId[id];
      return t ? t.title : id;
    },
    /* 该节的显示标题（精编里有双语标题时优先用） */
    titleOf: function (id, lang) {
      var c = CON[id];
      if (c && c.title && c.title[lang]) return c.title[lang];
      return BOOK.title(id);
    },
    /* 所属章节标题 */
    chapterTitle: function (id) {
      var top = topOf(id);
      return BOOK.title(top);
    },
    /* 相邻小节（按全书顺序） */
    prev: function (id) {
      var i = index[id];
      return i > 0 ? order[i - 1] : null;
    },
    next: function (id) {
      var i = index[id];
      return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
    },

    /* 统计 */
    stats: function () {
      var condensed = 0, terms = 0, figures = 0, chars = 0;
      order.forEach(function (id) {
        var r = RAW[id];
        if (r) chars += r.chars || 0;
        var c = CON[id];
        if (c) {
          condensed++;
          terms += (c.terms || []).length;
        }
      });
      /* 图片数量按实际引用的唯一文件计 */
      var seen = {};
      order.forEach(function (id) {
        var r = RAW[id];
        if (!r) return;
        (r.html.match(/media\/[^"']+/g) || []).forEach(function (m) { seen[m] = 1; });
      });
      figures = Object.keys(seen).length;
      return {
        sections: order.length,
        condensed: condensed,
        terms: terms,
        figures: figures,
        chars: chars
      };
    },

    /* 全文检索索引：对精编内容与原文分别建索引 */
    searchIndex: function () {
      var out = [];
      order.forEach(function (id) {
        var t = byId[id];
        var c = CON[id];
        var raw = RAW[id];
        var zh = [], en = [], heads = [];
        if (raw) {
          (raw.html.match(/<h[2-4][^>]*>(.*?)<\/h[2-4]>/g) || []).forEach(function (h) {
            heads.push(h.replace(/<[^>]+>/g, ''));
          });
        }
        if (c) {
          if (c.summary) { zh.push(c.summary.zh); en.push(c.summary.en); }
          (c.points || []).forEach(function (p) { zh.push(p.zh); en.push(p.en); });
          (c.body || []).forEach(function (p) { zh.push(p.zh); en.push(p.en); });
          (c.terms || []).forEach(function (p) {
            zh.push(p.zh + ' ' + p.defZh); en.push(p.en + ' ' + p.defEn);
          });
          (c.examples || []).forEach(function (p) { zh.push(p.noteZh); en.push(p.noteEn || ''); });
        }
        var rawText = raw ? LG.stripMd(raw.html.replace(/<[^>]+>/g, ' ')) : '';
        out.push({
          kind: 'book',
          id: id,
          num: t.title.split(/\s+/)[0],
          title: LG.norm(t.title),
          titleRaw: t.title,
          zh: LG.norm(zh.join(' ')),
          en: LG.norm(en.join(' ') + ' ' + heads.join(' ')),
          raw: LG.norm(rawText),
          snippet: c && c.summary ? c.summary : null,
          terms: c ? (c.terms || []) : []
        });
      });
      return out;
    }
  };
})();
