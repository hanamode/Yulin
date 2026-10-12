/* ============================================================
   语林 —— wiki.js
   术语百科（按分支学科组织）的数据模型与检索
   ============================================================ */
(function () {
  'use strict';
  var LG = window.LG;

  var CATS = (window.LINGUA_CATEGORIES || []).slice();
  var ENTRIES = (window.LINGUA_ENTRIES || []).slice();

  var catById = {};
  CATS.forEach(function (c) { catById[c.id] = c; });
  var byId = {};
  ENTRIES.forEach(function (e) { byId[e.id] = e; });

  var catOrder = {};
  CATS.forEach(function (c, i) { catOrder[c.id] = i; });

  var ORDERED = ENTRIES.slice().sort(function (a, b) {
    var d = (catOrder[a.category] || 0) - (catOrder[b.category] || 0);
    if (d) return d;
    return String(a.title).localeCompare(String(b.title), 'zh-Hans-CN');
  });

  /* ---- 索引 ---- */
  function build(e) {
    var heads = [], headsEn = [], paras = [], parasEn = [];
    (e.sections || []).forEach(function (s) {
      heads.push(String(s.h || ''));
      headsEn.push(String(s.hEn || ''));
      (s.p || []).forEach(function (p) { paras.push(LG.stripMd(p)); });
      (s.pEn || []).forEach(function (p) { parasEn.push(LG.stripMd(p)); });
    });
    var terms = (e.terms || []).map(function (t) { return t.t + '：' + t.d; }).join(' ');
    var termsEn = (e.terms || []).map(function (t) {
      return String(t.tEn || '') + ': ' + String(t.dEn || '');
    }).join(' ');
    headsEn = headsEn.filter(Boolean);
    var sumEn = LG.stripMd(e.summaryEn || '');
    var cat = catById[e.category] || { name: '' };
    var catNameAll = [cat.name || '', cat.nameEn || ''];
    return {
      kind: 'wiki',
      id: e.id,
      entry: e,
      title: e.title || '',
      titleNorm: LG.norm(e.title),
      en: e.en || '',
      enNorm: LG.norm(e.en),
      catName: cat.name,
      catId: e.category,
      catNorm: LG.norm(catNameAll.join(' ')),
      tags: e.tags || [],
      tagNorms: (e.tags || []).map(LG.norm),
      summary: LG.stripMd(e.summary || ''),
      sumNorm: LG.norm(LG.stripMd(e.summary || '') + ' ' + sumEn),
      zhNorm: LG.norm(LG.stripMd(e.summary || '') + ' ' + paras.join(' ') + ' ' + terms),
      enAllNorm: LG.norm(sumEn + ' ' + headsEn.join(' ') + ' ' + parasEn.join(' ') + ' ' + termsEn),
      summaryEn: sumEn,
      headNorms: heads.map(LG.norm),
      bodyNorm: LG.norm(paras.join('\n') + ' ' + terms),
      bodyText: paras.join('\n')
    };
  }
  var INDEX = ENTRIES.map(build);
  var indexById = {};
  INDEX.forEach(function (x) { indexById[x.id] = x; });

  var TAGS = (function () {
    var m = {};
    ENTRIES.forEach(function (e) {
      (e.tags || []).forEach(function (t) { m[t] = (m[t] || 0) + 1; });
    });
    return Object.keys(m).map(function (t) { return { name: t, n: m[t] }; })
      .sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name, 'zh'); });
  })();

  /* ---- 检索：多个关键词之间为「与」关系 ---- */
  function search(q) {
    var tokens = LG.norm(q).split(' ').filter(Boolean);
    if (!tokens.length) return [];
    var out = [];
    INDEX.forEach(function (x) {
      var score = 0, where = {};
      for (var i = 0; i < tokens.length; i++) {
        var tk = tokens[i], s = 0;
        if (x.titleNorm === tk) { s += 220; where.title = 1; }
        else if (x.titleNorm.indexOf(tk) !== -1) { s += 130; where.title = 1; }
        if (x.enNorm.indexOf(tk) !== -1) { s += 65; where.en = 1; }
        if (x.enAllNorm && x.enAllNorm.indexOf(tk) !== -1) { s += 30; where.en = 1; }
        if (x.catNorm.indexOf(tk) !== -1) { s += 22; where.cat = 1; }
        x.tagNorms.forEach(function (t) { if (t.indexOf(tk) !== -1) { s += 48; where.tag = 1; } });
        if (x.sumNorm.indexOf(tk) !== -1) { s += 28; where.sum = 1; }
        var hh = 0;
        x.headNorms.forEach(function (h) { if (h.indexOf(tk) !== -1) hh++; });
        if (hh) { s += Math.min(hh, 3) * 16; where.head = 1; }
        var bh = LG.countOcc(x.bodyNorm, tk);
        if (bh) { s += Math.min(bh, 8) * 6; where.body = 1; }
        if (s === 0) return;
        score += s;
      }
      if (score > 0) out.push({ kind: 'wiki', x: x, score: score, where: where });
    });
    return out.sort(function (a, b) { return b.score - a.score; });
  }

  /* 分类名按当前界面语言取用 */
  function catName(c) { return (LG.lang === 'en' && c.nameEn) ? c.nameEn : c.name; }
  function catDesc(c) { return (LG.lang === 'en' && c.descEn) ? c.descEn : c.desc; }
  LG.catName = catName;
  LG.catDesc = catDesc;

  /* ---------- 关键词链接索引 ----------
     只用「词条名」本身作为链接目标，另加少量别名与缩写；
     复合题名按「与 / 和 / 、」拆分，但拆分出的片段必须 ≥3 字，
     以免「语言」「言语」这类通名在每个页面上到处成链。            */
  var ALIAS = {
    'ipa': ['国际音标'],
    'universal-grammar': ['普遍语法', 'UG'],
    'head-driven-phrase-structure-grammar': ['HPSG'],
    'lexical-functional-grammar': ['LFG'],
    'synchronic-diachronic': ['共时语言学', '历时语言学'],
    'syntagmatic-paradigmatic': ['组合关系', '聚合关系'],
    'free-bound-morpheme': ['自由语素', '黏着语素'],
    'language-endangerment': ['语言濒危', '语言消亡'],
    'competence-performance': ['语言能力', '语言运用'],
    'pidgin-creole': ['皮钦语', '克里奥尔语'],
    'reference-sense': ['指称与涵义'],
    'metaphor-metonymy': ['隐喻与转喻'],
    'brown-levinson': ['Brown & Levinson', 'Brown and Levinson'],
    'sign-language': ['American Sign Language', 'ASL'],
    'cooperative-principle': ['合作原则'],
    'minimal-pair': ['最小对立对']
  };

  function buildLinks(entries) {
    var zhMap = {}, enMap = {}, exact = {};
    function add(text, id) {
      if (!text) return;
      var t = String(text).trim();
      if (!t) return;
      if (/[\u4e00-\u9fff]/.test(t)) {
        if (t.length >= 2) { zhMap[t] = zhMap[t] || id; exact[t] = exact[t] || id; }
      } else {
        if (t.length >= 3) {
          var k = t.toLowerCase();
          enMap[k] = enMap[k] || id;
          exact[k] = exact[k] || id;
        }
      }
    }
    entries.forEach(function (e) {
      add(e.title, e.id);
      add(e.en, e.id);
      String(e.title || '').split(/[与和、]/).forEach(function (part) {
        if (part.trim().length >= 3) add(part, e.id);
      });
      (ALIAS[e.id] || []).forEach(function (a) { add(a, e.id); });
    });
    function makeRe(map, flags) {
      var keys = Object.keys(map).sort(function (a, b) { return b.length - a.length; });
      if (!keys.length) return null;
      return new RegExp('(' + keys.map(function (k) {
        return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('|') + ')', flags);
    }
    window.LG_WIKI_LINKS = {
      zhMap: zhMap, enMap: enMap, exact: exact,
      zhRe: makeRe(zhMap, 'g'),
      enRe: makeRe(enMap, 'gi'),
      exactMap: exact,
      size: Object.keys(zhMap).length + Object.keys(enMap).length
    };
  }
  buildLinks(ENTRIES);

  var WIKI = LG.WIKI = {
    catName: catName,
    catDesc: catDesc,
    cats: CATS,
    catById: catById,
    entries: ENTRIES,
    byId: byId,
    ordered: ORDERED,
    indexById: indexById,
    tags: TAGS,
    search: search,
    linkCount: function () { return window.LG_WIKI_LINKS ? window.LG_WIKI_LINKS.size : 0; },
    lookup: function (text) { return LG.termLink(text); },
    countByCat: function () {
      var m = {};
      ENTRIES.forEach(function (e) { m[e.category] = (m[e.category] || 0) + 1; });
      return m;
    },
    ofCat: function (id) {
      return ORDERED.filter(function (e) { return e.category === id; });
    }
  };
})();
