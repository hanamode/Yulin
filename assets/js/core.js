/* ============================================================
   语林 · 语言学百科 —— core.js
   通用工具：DOM、转义、高亮、双语内联标记、提示条
   ============================================================ */
(function () {
  'use strict';

  var LG = window.LG = window.LG || {};

  LG.$ = function (sel, root) { return (root || document).querySelector(sel); };
  LG.$$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  LG.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  LG.norm = function (s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[\u3000\s]+/g, ' ').trim();
  };

  LG.stripMd = function (s) {
    return String(s == null ? '' : s)
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^\s*[-*]\s+/gm, '');
  };

  LG.clamp = function (s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n) + '…' : s;
  };

  LG.debounce = function (fn, ms) {
    var t;
    return function () {
      var a = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, a); }, ms);
    };
  };

  LG.encode = function (s) { return encodeURIComponent(String(s)); };

  /* ---------- 双语片段 ----------
     所有双语内容都同时渲染中英两份，由 <html data-lang> 与 data-parallel 控制显隐，
     因此切换语言是纯 CSS 行为，瞬时生效且不丢失阅读位置。          */
  LG.bi = function (zh, en, tag) {
    tag = tag || 'span';
    return '<' + tag + ' class="b zh">' + zh + '</' + tag + '>' +
           '<' + tag + ' class="b en">' + en + '</' + tag + '>';
  };
  /* 一个块级双语对照 */
  LG.pair = function (zh, en, cls) {
    return '<div class="bi-pair ' + (cls || '') + '">' +
      '<div class="b zh">' + zh + '</div>' +
      '<div class="b en">' + en + '</div></div>';
  };

  /* ---------- IPA 自动排版 ---------- */
  var IPA_RE = /^[a-zA-Z\u0250-\u02FF\u1D00-\u1DBF\uA700-\uA71F\u0300-\u036F\u2190-\u2199\u207F\u2016|ˈˌ.\u0020]+$/;
  LG.isIpa = function (s) {
    return !!s && s.length <= 26 &&
      /[\u0250-\u02FF\u1D00-\u1DBF\u02E5-\u02E9]/.test(s) && IPA_RE.test(s);
  };

  /* 行内标记：转义 + **粗体** + `代码` + [IPA] */
  LG.inline = function (s) {
    var t = LG.esc(LG.stripMd(s));
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/`([^`\n]+)`/g, '<span class="ipa">$1</span>');
    t = t.replace(/\[([^\[\]\n]{1,26})\]/g, function (m, inner) {
      return LG.isIpa(inner) ? '<span class="ipa">[' + inner + ']</span>' : m;
    });
    return t;
  };

  /* ---------- 高亮（只在文本节点内匹配，绝不破坏标签） ---------- */
  LG.highlight = function (html, tokens) {
    if (!tokens || !tokens.length) return html;
    var seen = {}, pats = [];
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
  };

  LG.countOcc = function (hay, needle) {
    if (!needle) return 0;
    var n = 0, i = 0;
    while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; if (n > 40) break; }
    return n;
  };

  /* ---------- 提示条 ---------- */
  var toastTimer = null;
  LG.toast = function (msg) {
    var t = LG.$('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2000);
  };


  /* ---------- 关键词自动链接 ----------
     把正文里出现的术语自动变成指向术语词条的链接：
       · 每个词条在同一语言区内只链一次，避免满屏链接；
       · 同一位置取最长匹配（「音位变体」优先于「音位」）；
       · 只在文本节点内替换，绝不动标签与属性；
       · 当前正在浏览的词条不自链。                                   */
  /* 整页共享的链接状态：同一词条在整页只链一次 */
  var pageUsed = {}, pageCount = 0;

  var VOID_TAGS = { img: 1, br: 1, hr: 1, input: 1, meta: 1, link: 1, source: 1,
                    area: 1, base: 1, col: 1, embed: 1, param: 1, track: 1, wbr: 1 };
  /* 解析开标签，返回 {tag, lang}；lang 只在 class 同时含 b 与 zh/en 时给出 */
  function openInfo(part) {
    var m = /^<(\w+)([^>]*)>/.exec(part);
    if (!m) return null;
    var tag = m[1].toLowerCase();
    var cls = /class="([^"]*)"/.exec(m[2]);
    var lang = null;
    if (cls) {
      var list = cls[1].split(/\s+/);
      if (list.indexOf('b') !== -1) {
        if (list.indexOf('zh') !== -1) lang = 'zh';
        else if (list.indexOf('en') !== -1) lang = 'en';
      }
    }
    return { tag: tag, lang: lang, void: !!VOID_TAGS[tag] || /\/>$/.test(part) };
  }

  LG.autolink = function (html, opts) {
    opts = opts || {};
    if (!html || !window.LG_WIKI_LINKS) return html;
    var L = window.LG_WIKI_LINKS;
    if (!L.zhRe && !L.enRe) return html;

    var selfId = opts.self || null;
    var budget = opts.max || 45;
    var fallback = opts.lang || 'both';
    var used = pageUsed;
    var stack = [];

    return String(html).split(/(<[^>]*>)/).map(function (part) {
      if (!part) return part;

      if (part.charAt(0) === '<') {
        var close = /^<\/(\w+)/.exec(part);
        if (close) {
          var t = close[1].toLowerCase();
          for (var q = stack.length - 1; q >= 0; q--) {
            if (stack[q].tag === t) { stack.length = q; break; }
          }
        } else {
          var info = openInfo(part);
          if (info && !info.void) stack.push(info);
        }
        return part;
      }

      if (pageCount >= budget) return part;
      var ctx = stack.length && stack[stack.length - 1].lang
        ? stack[stack.length - 1].lang : fallback;

      var hits = [];
      function collect(re, map) {
        if (!re) return;
        re.lastIndex = 0;
        var m;
        while ((m = re.exec(part)) !== null) {
          var id = map[m[0]] !== undefined ? map[m[0]] : map[m[0].toLowerCase()];
          if (id) hits.push({ i: m.index, len: m[0].length, id: id, text: m[0] });
          if (re.lastIndex === m.index) re.lastIndex++;
        }
      }
      if (ctx !== 'en') collect(L.zhRe, L.zhMap);
      if (ctx !== 'zh') collect(L.enRe, L.enMap);
      if (!hits.length) return part;

      /* 位置升序、同位置长者优先；跳过长者内部的重叠匹配 */
      hits.sort(function (a, b) { return a.i - b.i || b.len - a.len; });
      var out = '', pos = 0, last = 0;
      for (var k = 0; k < hits.length; k++) {
        var h = hits[k];
        if (h.i < last) continue;
        var key = h.id + '|' + ctx;
        if (used[key] || h.id === selfId) continue;
        used[key] = 1;
        out += part.slice(pos, h.i) + '<a class="kw" href="#/entry/' +
          encodeURIComponent(h.id) + '" title="' + LG.esc(h.id) + '">' + h.text + '</a>';
        pos = h.i + h.len;
        last = h.i + h.len;
        if (++pageCount >= budget) break;
      }
      return out + part.slice(pos);
    }).join('');
  };

  /* 每次渲染页面前重置，使「一词一链」以整页为单位 */
  LG.autolink.reset = function () { pageUsed = {}; pageCount = 0; };

  /* 术语表里的词，若与某个词条同名则直接给出链接 */
  LG.termLink = function (text) {
    if (!window.LG_WIKI_LINKS || !text) return null;
    var L = window.LG_WIKI_LINKS;
    var id = L.exactMap[text] || L.exactMap[text.toLowerCase()];
    return id || null;
  };

  /* ---------- 阅读时长 ---------- */
  LG.readMinutes = function (chars) {
    return Math.max(1, Math.round((chars || 0) / 400));
  };
})();
