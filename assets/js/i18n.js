/* ============================================================
   语林 · 语言学百科 —— i18n.js
   界面语言状态与文案。内容层的双语由 HTML 中的 .bi 标记 + CSS 控制，
   切换语言即时生效且不丢失滚动位置。
   ============================================================ */
(function () {
  'use strict';

  var LG = window.LG = window.LG || {};

  /* 可选语言。pending 的语言按钮会显示为「制作中」。 */
  LG.LANGS = [
    { code: 'zh', label: '中文', short: '中' },
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'ja', label: '日本語', short: 'JA', pending: true }
  ];
  LG.DEFAULT_LANG = 'zh';

  var I18N = {
    zh: {
      'nav.home': '首页',
      'nav.toc': '全书目录',
      'nav.wiki': '术语百科',
      'nav.about': '关于本站',
      'nav.book': '本书',
      'nav.contents': '目录',
      'nav.tags': '关键词',
      'nav.search': '搜索',
      'nav.theme': '切换深浅色主题（T）',
      'nav.random': '随机一节（R）',
      'nav.menu': '打开导航',
      'nav.lang': '切换语言',

      'home.kicker': '中英双语精读',
      'home.subtitle': '以《Essentials of Linguistics》第二版为底本，按原书章节顺序逐节精编：中英对照的摘要、要点、关键术语与例证，并附该节英文原文全文。',
      'home.start': '开始阅读',
      'home.toc': '查看全书目录',
      'home.by': '作者',
      'home.chapters': '章节目录',
      'home.chaptersHint': '与原书章节顺序一致',
      'home.featured': '精选小节',
      'home.featuredHint': '编辑推荐',
      'home.wikiTitle': '语言学百科',
      'home.wikiDesc': '本站另收录一部按分支学科组织的语言学百科，可作本书的背景补充。',
      'home.wikiLink': '进入术语百科',
      'home.frontMatter': '前置页',
      'stat.sections': '节双语精编',
      'stat.chars': '字英文原文',
      'stat.figures': '幅图表示例',
      'stat.terms': '条术语对照',

      'toc.title': '全书目录',
      'toc.hint': '原书顺序',
      'toc.condensed': '已精编',
      'toc.rawOnly': '原文',
      'toc.chapterIntro': '章节导言',

      'book.summary': '摘要',
      'book.points': '要点',
      'book.terms': '关键术语',
      'book.examples': '例证',
      'book.body': '精编正文',
      'book.original': '英文原文',
      'book.originalNote': '以下为该节英文全文，逐字提取自原书 EPUB，未作改动。视频资源未随本站分发。',
      'book.prev': '上一节',
      'book.next': '下一节',
      'book.inChapter': '本章小节',
      'book.mode.single': '单语',
      'book.mode.parallel': '对照',
      'book.minutes': '分钟',
      'book.sourceChars': '原文',
      'book.chars': '字符',
      'book.condensed': '精编',
      'book.expand': '展开原文',
      'book.collapse': '收起原文',
      'book.notCondensed': '本节为版式页，仅提供英文原文。',
      'book.termEn': '英文',
      'book.termZh': '中文',
      'book.termDef': '释义',
      'book.about': '关于本书',
      'book.license': '授权',
      'book.publisher': '出版',
      'book.source': '原书地址',
      'book.authors': '作者',

      'search.title': '搜索',
      'search.found': '找到 {n} 个结果',
      'search.none': '没有找到匹配的内容',
      'search.noneHint': '试试更短的关键词，或直接浏览全书目录。',
      'search.inBook': '本书',
      'search.inWiki': '术语百科',
      'search.hit': '命中',
      'search.condensed': '双语精编',
      'search.original': '英文原文',

      'wiki.title': '术语百科',
      'wiki.subtitle': '按分支学科组织的语言学百科条目',
      'wiki.cats': '分类',
      'wiki.entries': '个条目',
      'wiki.all': '全部条目',
      'wiki.related': '相关条目',
      'wiki.gloss': '关键词汇',
      'wiki.sources': '参考与延伸阅读',
      'wiki.langNote': '词条均为中英双语；释义综合维基百科与语言学经典教材，来源见每条末尾。',

      'about.title': '关于本站',
      'about.book': '关于本书',
      'about.features': '网站功能',
      'about.lang': '语言切换',
      'about.keys': '快捷键',
      'about.notice': '说明',

      'common.home': '首页',
      'common.backHome': '回到首页',
      'common.notFound': '页面不存在',
      'common.none': '暂无内容',
      'common.chapter': '第 {n} 章',
      'common.of': '共',
      'common.entry': '条目'
    },

    en: {
      'nav.home': 'Home',
      'nav.toc': 'Contents',
      'nav.wiki': 'Glossary',
      'nav.about': 'About',
      'nav.book': 'Book',
      'nav.contents': 'Contents',
      'nav.tags': 'Keywords',
      'nav.search': 'Search',
      'nav.theme': 'Toggle theme (T)',
      'nav.random': 'Random section (R)',
      'nav.menu': 'Open navigation',
      'nav.lang': 'Switch language',

      'home.kicker': 'BILINGUAL READER',
      'home.subtitle': 'A section-by-section bilingual companion to Essentials of Linguistics, 2nd edition, following the original chapter order: summaries, key points, terms and examples in Chinese and English, with the full original text of each section.',
      'home.start': 'Start reading',
      'home.toc': 'Full contents',
      'home.by': 'By',
      'home.chapters': 'Chapters',
      'home.chaptersHint': 'Same order as the original book',
      'home.featured': 'Featured sections',
      'home.featuredHint': 'Editor’s picks',
      'home.wikiTitle': 'Linguistics glossary',
      'home.wikiDesc': 'The site also keeps an encyclopaedia of linguistics organised by subfield, as background reading.',
      'home.wikiLink': 'Open the glossary',
      'home.frontMatter': 'Front matter',
      'stat.sections': 'bilingual sections',
      'stat.chars': 'characters of source text',
      'stat.figures': 'figures and examples',
      'stat.terms': 'term pairs',

      'toc.title': 'Contents',
      'toc.hint': 'Original order',
      'toc.condensed': 'Condensed',
      'toc.rawOnly': 'Original',
      'toc.chapterIntro': 'Chapter intro',

      'book.summary': 'Summary',
      'book.points': 'Key points',
      'book.terms': 'Key terms',
      'book.examples': 'Examples',
      'book.body': 'Condensed text',
      'book.original': 'Original text',
      'book.originalNote': 'The full English text of this section, extracted verbatim from the source EPUB. Video assets are not distributed with this site.',
      'book.prev': 'Previous',
      'book.next': 'Next',
      'book.inChapter': 'In this chapter',
      'book.mode.single': 'Single',
      'book.mode.parallel': 'Side by side',
      'book.minutes': 'min read',
      'book.sourceChars': 'source',
      'book.chars': 'characters',
      'book.condensed': 'Condensed',
      'book.expand': 'Show original text',
      'book.collapse': 'Hide original text',
      'book.notCondensed': 'This is a front-matter page; only the original text is available.',
      'book.termEn': 'English',
      'book.termZh': 'Chinese',
      'book.termDef': 'Definition',
      'book.about': 'About the book',
      'book.license': 'Licence',
      'book.publisher': 'Publisher',
      'book.source': 'Source',
      'book.authors': 'Authors',

      'search.title': 'Search',
      'search.found': '{n} results',
      'search.none': 'No matching content',
      'search.noneHint': 'Try a shorter keyword, or browse the contents.',
      'search.inBook': 'Book',
      'search.inWiki': 'Glossary',
      'search.hit': 'Matched',
      'search.condensed': 'Bilingual',
      'search.original': 'Original text',

      'wiki.title': 'Linguistics glossary',
      'wiki.subtitle': 'Encyclopaedia entries organised by subfield',
      'wiki.cats': 'Categories',
      'wiki.entries': 'entries',
      'wiki.all': 'All entries',
      'wiki.related': 'Related',
      'wiki.gloss': 'Key vocabulary',
      'wiki.sources': 'References',
      'wiki.langNote': 'All entries are bilingual; definitions draw on Wikipedia and standard linguistics references, listed at the end of each entry.',

      'about.title': 'About',
      'about.book': 'About the book',
      'about.features': 'Features',
      'about.lang': 'Language switching',
      'about.keys': 'Keyboard shortcuts',
      'about.notice': 'Notes',

      'common.home': 'Home',
      'common.backHome': 'Back home',
      'common.notFound': 'Page not found',
      'common.none': 'No content',
      'common.chapter': 'Chapter {n}',
      'common.of': 'of',
      'common.entry': 'entries'
    }
  };

  LG.I18N = I18N;
  LG.lang = LG.DEFAULT_LANG;

  /* 取文案；缺失时回退到英文，再回退到 key 本身 */
  LG.t = function (key, vars) {
    var table = I18N[LG.lang] || I18N.en;
    var s = table[key];
    if (s == null) s = I18N.en[key];
    if (s == null) s = key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) {
        return vars[k] != null ? vars[k] : m;
      });
    }
    return s;
  };

  /* 同时输出中英文案，交给 CSS 按当前语言显隐 */
  LG.t2 = function (key, vars) {
    function fill(s) {
      if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
      return s;
    }
    var zh = I18N.zh[key] != null ? I18N.zh[key] : key;
    var en = I18N.en[key] != null ? I18N.en[key] : key;
    return LG.bi(LG.esc(fill(zh)), LG.esc(fill(en)));
  };

  var LS_KEY = 'lingua-lang';
  LG.setLang = function (code) {
    var lang = LG.LANGS.filter(function (l) { return l.code === code; })[0];
    if (!lang || lang.pending) return false;
    LG.lang = code;
    document.documentElement.setAttribute('data-lang', code);
    document.documentElement.setAttribute('lang', code === 'zh' ? 'zh-CN' : code);
    try { localStorage.setItem(LS_KEY, code); } catch (e) {}
    return true;
  };

  LG.initLang = function () {
    var forced = /[?&]lang=(zh|en|ja)\b/.exec(location.search || '');
    var code = forced ? forced[1] : null;
    if (!code) {
      try { code = localStorage.getItem(LS_KEY); } catch (e) {}
    }
    if (!code) {
      var nav = (navigator.language || 'zh').toLowerCase();
      code = nav.indexOf('zh') === 0 ? 'zh' : 'en';
    }
    LG.setLang(code) || LG.setLang(LG.DEFAULT_LANG);
  };

  /* 语言切换按钮组 */
  LG.langSwitcher = function () {
    return '<div class="lang-switch" role="group" aria-label="' + LG.esc(LG.t('nav.lang')) + '">' +
      LG.LANGS.map(function (l) {
        var cls = 'lang-btn' + (l.code === LG.lang ? ' is-on' : '') + (l.pending ? ' is-pending' : '');
        var title = l.pending ? l.label + '（制作中 / in progress）' : l.label;
        return '<button type="button" class="' + cls + '" data-lang="' + l.code + '"' +
          (l.pending ? ' disabled' : '') + ' title="' + LG.esc(title) + '">' +
          '<span class="lb-full">' + LG.esc(l.label) + '</span>' +
          '<span class="lb-short">' + LG.esc(l.short) + '</span></button>';
      }).join('') + '</div>';
  };
})();
