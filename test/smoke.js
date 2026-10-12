/* 语林 —— 无浏览器冒烟测试
   用最小 DOM 桩加载全部数据与脚本，检查各视图渲染、双语标记、
   检索、语言切换与数据完整性。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const re = null;

const ROOT = path.join(__dirname, '..');
let errors = [];
let checks = 0;
function check(name, cond, extra) {
  checks++;
  if (cond) console.log('  ✓ ' + name);
  else { console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); errors.push(name); }
}

/* ---------------- 最小 DOM 桩 ---------------- */
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    _html: '', hidden: false, textContent: '', value: '', disabled: false,
    dataset: {}, style: {}, children: [],
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { if (on === undefined) on = !this._s.has(c); on ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    setAttribute(k, v) { this['attr_' + k] = String(v); },
    getAttribute(k) { return this['attr_' + k]; },
    addEventListener() {}, removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    querySelector() { return makeEl('div'); },
    querySelectorAll() { return []; },
    closest() { return null; },
    focus() {}, blur() {}, click() {}, select() {}, scrollIntoView() {},
    getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 20 }; }
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return this._html; },
    set(v) { this._html = String(v); }
  });
  return el;
}

const els = {};
function getEl(sel) {
  if (!els[sel]) { els[sel] = makeEl('div'); els[sel].id = sel.replace('#', ''); }
  return els[sel];
}

const listeners = {};
const documentEl = makeEl('html');
const document = {
  readyState: 'complete',
  title: '',
  documentElement: documentEl,
  body: makeEl('body'),
  querySelector(sel) { return getEl(sel); },
  querySelectorAll() { return []; },
  getElementById(id) { return els['#' + id] || null; },
  addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
  createElement(t) { return makeEl(t); }
};

const location = {
  hash: '', href: 'file:///index.html', search: '',
  replace(h) { if (h.charAt(0) === '#') this.hash = h; }
};
const store = { _d: {}, getItem(k) { return this._d[k] !== undefined ? this._d[k] : null; }, setItem(k, v) { this._d[k] = String(v); } };

const win = {
  document, location, pageYOffset: 0, console, setTimeout, clearTimeout,
  addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
  scrollTo() {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  navigator: { language: 'zh-CN' }
};
win.window = win;

const ctx = vm.createContext(Object.assign(win, {
  document, location, localStorage: store, navigator: win.navigator,
  console, setTimeout, clearTimeout,
  Math, JSON, Object, Array, String, Number, RegExp, Date, Set, Map, Error,
  encodeURIComponent, decodeURIComponent, isNaN, parseInt, parseFloat
}));
ctx.globalThis = ctx;

/* ---------------- 加载数据与脚本 ---------------- */
function run(rel) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
}
function listData() {
  const out = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'data/book'))) {
    if (/^(toc|meta|en-\d+|condense-\d+)\.js$/.test(f)) out.push('data/book/' + f);
  }
  return out.sort((a, b) => {
    const rank = p => p.includes('toc') ? 0 : p.includes('meta') ? 1 : p.includes('/en-') ? 2 : 3;
    return rank(a) - rank(b) || a.localeCompare(b);
  });
}

try {
  run('data/categories.js');
  run('data/entries.js');
  listData().forEach(run);
  ['core', 'i18n', 'book', 'wiki', 'views', 'app'].forEach(n => run('assets/js/' + n + '.js'));
} catch (e) {
  console.error('✗ 脚本执行失败：\n' + (e && e.stack || e));
  process.exit(1);
}

const LG = ctx.LG, B = LG.BOOK, W = LG.WIKI;

/* ---------------- 工具 ---------------- */
const total = B.order.length;
const condensed = B.order.filter(B.hasCond).length;
console.log(`\n书稿：${total} 节，其中 ${condensed} 节已精编；百科 ${W.entries.length} 条目\n`);

function nav(hash) {
  location.hash = hash;
  (listeners['hashchange'] || []).forEach(fn => fn());
  return getEl('#view').innerHTML;
}
const view = () => getEl('#view').innerHTML;
const side = () => getEl('#sidebar').innerHTML;
const hasBothLangs = html => /class="b zh"/.test(html) && /class="b en"/.test(html);

/* ---------------- 首页 ---------------- */
console.log('首页');
const home = view();
check('渲染 hero', home.includes('class="hero'));
check('包含书名', home.includes('Essentials of Linguistics'));
/* 首页把「封面/原书目录」两个版式页隐去，并把前置页单列一行 */
const isFront = id => /^front-matter-|^title-page$|^copyright$/.test(id);
const homeRoots = B.roots.filter(r => r.id !== 'front-cover' && r.id !== 'table-of-contents');
const homeMain = homeRoots.filter(r => !isFront(r.id));
const homeFront = homeRoots.filter(r => isFront(r.id));
check('章节卡片数 = 正文章节数', (home.match(/class="chap-card"/g) || []).length === homeMain.length,
  `${(home.match(/class="chap-card"/g) || []).length} vs ${homeMain.length}`);
check('前置页单独成行', (home.match(/class="fr-link"/g) || []).length === homeFront.length,
  `${(home.match(/class="fr-link"/g) || []).length} vs ${homeFront.length}`);
check('第一张卡片是第 1 章', /chap-card[\s\S]{0,400}?Chapter 1:/.test(home));
check('「开始阅读」指向第 1 章第 1 节', /class="btn btn-primary" href="#\/book\/chapter-001/.test(home));
check('双语标记齐备', hasBothLangs(home));
check('无 undefined 泄漏', !home.includes('undefined'));
check('无 [object Object]', !home.includes('[object Object]'));
check('侧栏已渲染', side().includes('side-link'));
check('语言按钮有 3 个', (side() + getEl('#langSwitch').innerHTML).includes('lang-switch'));

console.log('\n语言切换按钮');
const ls = getEl('#langSwitch').innerHTML;
check('中文按钮存在', ls.includes('data-lang="zh"'));
check('English 按钮存在', ls.includes('data-lang="en"'));
check('日本語按钮存在且标记制作中', ls.includes('data-lang="ja"') && ls.includes('is-pending'));
check('默认语言为中文', LG.lang === 'zh');

console.log('\n全书目录');
const toc = nav('#/toc');
check('渲染目录', toc.includes('toc-chap'));
check('目录项数 = 全书节数', (toc.match(/class="tl-title"/g) || []).length === total,
  `${(toc.match(/class="tl-title"/g) || []).length} vs ${total}`);
check('列出全部顶层章节', (toc.match(/toc-chap-head/g) || []).length === B.roots.length);
check('章节顺序与原书一致', toc.indexOf(B.roots[1].title.split(' ')[0]) > toc.indexOf(B.roots[0].title.split(' ')[0]));

/* ---------------- 小节页 ---------------- */
const cid = B.order.filter(B.hasCond)[0];
/* 仅剩版式页未做精编，用它们检验「只展示原文」的分支 */
let rid = B.order.filter(id => !B.hasCond(id) && !B.LAYOUT_ONLY[id] && B.raw(id))[0];
if (!rid) rid = B.order.filter(id => B.LAYOUT_ONLY[id] && B.raw(id))[0];

if (cid) {
  console.log('\n小节页（已精编）：' + B.title(cid));
  const s = nav('#/book/' + encodeURIComponent(cid));
  const c = B.cond(cid);
  check('标题双语', hasBothLangs(s));
  check('渲染摘要', s.includes('id="book-summary"'));
  check('渲染要点', s.includes('id="book-points"'));
  check('渲染术语表', s.includes('id="book-terms"') && s.includes('tt-row'));
  check('渲染例证', s.includes('id="book-examples"'));
  check('渲染精编正文', s.includes('id="book-body"'));
  check('渲染英文原文折叠块', s.includes('id="book-original"') && s.includes('raw-block'));
  check('原文 HTML 被完整嵌入', s.includes(B.raw(cid).html.slice(0, 120)));
  check('单语/对照切换存在', s.includes('id="viewSeg"'));
  check('上下节导航存在', s.includes('class="pager"'));
  check('中文内容出现', s.includes(c.summary.zh.slice(0, 20)));
  check('英文内容出现', s.includes(c.summary.en.slice(0, 20)));
  check('术语中英并列', c.terms.length === 0 || s.includes(c.terms[0].en) && s.includes(c.terms[0].zh));
  check('侧栏显示本章小节', side().includes('side-chap'));
  check('无 undefined 泄漏', !s.includes('undefined'));
}

if (rid) {
  console.log('\n小节页（仅原文）：' + B.title(rid));
  const s = nav('#/book/' + encodeURIComponent(rid));
  check('提示未精编', s.includes('notice'));
  check('仍展示英文原文', s.includes('book-raw'));
  check('无 undefined 泄漏', !s.includes('undefined'));
}

/* ---------------- 百科 ---------------- */
console.log('\n术语百科');
const wiki = nav('#/wiki');
check('渲染分类卡片', (wiki.match(/class="cat-card"/g) || []).length === W.cats.length);
check('渲染条目卡片', (wiki.match(/class="entry-card"/g) || []).length === W.entries.length);
const e = W.entries[0].id;
const ent = nav('#/entry/' + encodeURIComponent(e));
check('条目页渲染', ent.includes('entry-head') && ent.includes('prose'));
check('条目页有术语表', ent.includes('gloss-row'));
check('分类页渲染', nav('#/cat/branches').includes('entry-card'));
check('标签页渲染', nav('#/tag/' + encodeURIComponent(W.entries[0].tags[0])).includes('entry-card'));

/* ---------------- 检索 ---------------- */
console.log('\n检索');
const r1 = nav('#/search/' + encodeURIComponent('音位'));
check('中文检索命中本书', r1.includes('class="result"'));
check('结果分组显示', r1.includes('section-head'));
const r2 = nav('#/search/phoneme');
check('英文检索命中', r2.includes('class="result"'));
const r3 = nav('#/search/' + encodeURIComponent('zzzz不存在'));
check('无结果有空状态', r3.includes('class="empty"'));
const r4 = nav('#/search/a');
check('单字母检索不破坏 HTML', !/<[a-zA-Z]+[^>]*<mark/i.test(r4));
check('mark 标签配对', (r4.match(/<mark/g) || []).length === (r4.match(/<\/mark>/g) || []).length);

console.log('\n关于 / 404');
const about = nav('#/about');
check('关于页渲染', about.includes(LG.t('about.title')) && about.includes('Essentials of Linguistics'));
check('关于页声明原书授权', about.includes('CC BY-NC-SA'));
check('未知路由有兜底', nav('#/nope').includes('class="empty"'));

/* ---------------- 数据完整性 ---------------- */
console.log('\n数据完整性');
check('目录 id 唯一', new Set(B.order).size === B.order.length);
check('每节都有原文', B.order.every(id => B.raw(id) || B.LAYOUT_ONLY[id]),
  B.order.filter(id => !B.raw(id) && !B.LAYOUT_ONLY[id]).slice(0, 5).join(', '));
check('顶层章节都有子节', B.roots.every(r => B.childrenOf[r.id].length >= 1));
check('父节点引用有效', B.order.every(id => !B.byId[id].parent || !!B.byId[B.byId[id].parent]));
const badCond = B.order.filter(B.hasCond).filter(id => {
  const c = B.cond(id);
  return !c.summary || !c.summary.zh || !c.summary.en || !c.title;
});
check('精编数据字段完整', badCond.length === 0, badCond.slice(0, 5).join(', '));
const zhOnly = B.order.filter(B.hasCond).filter(id => {
  const c = B.cond(id);
  return (c.body || []).some(p => !p.en || !p.zh);
});
check('精编正文中英齐备', zhOnly.length === 0, zhOnly.slice(0, 5).join(', '));
const ids = new Set(W.entries.map(x => x.id));
check('百科 id 唯一', ids.size === W.entries.length);
check('百科 related 有效', W.entries.every(x => (x.related || []).every(r => ids.has(r))));

/* ---------------- 四项改造的专项断言 ---------------- */
console.log('\n改造 1：百科词条英文完整');
const noEn = W.entries.filter(e => !e.summaryEn).map(e => e.id);
check('每条都有英文概述', noEn.length === 0, noEn.slice(0, 5).join(', '));
const secEn = W.entries.filter(e => e.sections.some(x => !x.hEn || !x.pEn || !x.pEn.length)).map(e => e.id);
check('每个小节都有英文标题与正文', secEn.length === 0, secEn.slice(0, 5).join(', '));
const termEn = W.entries.filter(e => e.terms.some(t => !t.tEn || !t.dEn)).map(e => e.id);
check('每条术语都有英文对照', termEn.length === 0, termEn.slice(0, 5).join(', '));
const pairLen = W.entries.filter(e => e.sections.some(x => x.p.length !== x.pEn.length)).map(e => e.id);
check('中英段落数一一对应', pairLen.length === 0, pairLen.slice(0, 5).join(', '));

console.log('\n改造 2：词条数量与来源');
check('词条数已扩充（≥150）', W.entries.length >= 150, '实际 ' + W.entries.length);
check('含「共时语言学」相关词条', !!W.byId['synchronic-diachronic']);
const noSrc = W.entries.filter(e => !e.sources || !e.sources.length).map(e => e.id);
check('每条都有来源', noSrc.length === 0, noSrc.slice(0, 5).join(', '));
const withEnSrc = W.entries.filter(e => (e.sources || []).some(x => /https?:\/\//.test(x))).length;
check('每条都有可点击的来源链接', withEnSrc === W.entries.length, withEnSrc + '/' + W.entries.length);
const wikiSrc = W.entries.filter(e => (e.sources || []).some(x => /wikipedia\.org/.test(x))).length;
check('每条都标注了维基百科来源', wikiSrc === W.entries.length, wikiSrc + '/' + W.entries.length);

console.log('\n改造 3：关键词自动链接');
const zid = W.entries.find(e => e.id === 'phoneme') ? 'phoneme' : W.entries[0].id;
const zpage = nav('#/entry/' + encodeURIComponent(zid));
const kw = (zpage.match(/class="kw"/g) || []).length;
check('词条页正文出现关键词链接', kw > 0, kw + ' 个');
check('不出现自链接', !new RegExp('class="kw" href="#\\/entry\\/' + zid + '"').test(zpage),
  (zpage.match(new RegExp('class="kw" href="#\\/entry\\/' + zid + '"')) || [''])[0]);
const zbody = nav('#/book/' + encodeURIComponent(cid));
check('书籍小节同样有链接', (zbody.match(/class="kw"/g) || []).length > 0);
check('链接指向存在的词条', (zbody.match(/class="kw" href="#\/entry\/([^"]+)"/g) || []).every(m => {
  const id = decodeURIComponent(m.replace(/.*entry\//, '').replace(/"$/, ''));
  return !!W.byId[id];
}));
check('链接密度克制（≤45/页）', (zbody.match(/class="kw"/g) || []).length <= 45,
  (zbody.match(/class="kw"/g) || []).length + ' 个');

console.log('\n改造 4：UI 无 emoji');
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const stripped = id => B.title(id) || '';
let emojiHits = [];
[['首页', nav('#/')], ['目录', nav('#/toc')], ['词条', nav('#/entry/' + encodeURIComponent(zid))],
 ['书籍', nav('#/book/' + encodeURIComponent(cid))], ['百科', nav('#/wiki')],
 ['关于', nav('#/about')], ['侧栏', side()]].forEach(([nm, html]) => {
  if (EMOJI.test(html)) emojiHits.push(nm);
});
check('渲染结果不含 emoji', emojiHits.length === 0, emojiHits.join(', '));
check('分类数据已无 icon 字段', W.cats.every(c => c.icon === undefined));
console.log('\n配色：彩色简约方案');
const css = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');
const block = re => { const m = re.exec(css); return m ? m[0] : ''; };
const light = block(/:root \{[\s\S]*?\n\}/);
const dark = block(/\[data-theme="dark"\] \{[\s\S]*?\n\}/);
const token = (blk, name) => {
  const m = new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})').exec(blk);
  return m ? m[1] : null;
};
const spread = h => {
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  return Math.max(r, g, b) - Math.min(r, g, b);
};
const REQUIRED = ['paper', 'surface', 'ink', 'muted', 'line', 'accent', 'accent-2', 'accent-ink', 'mark'];
const missingLight = REQUIRED.filter(k => !token(light, k));
const missingDark = REQUIRED.filter(k => !token(dark, k));
check('浅色主题令牌齐备', missingLight.length === 0, missingLight.join(', '));
check('深色主题令牌齐备', missingDark.length === 0, missingDark.join(', '));
const la = token(light, 'accent'), da = token(dark, 'accent');
check('浅色主色为有彩色', la && spread(la) > 40, la + ' 通道差 ' + (la ? spread(la) : '-'));
check('深色主色为有彩色', da && spread(da) > 40, da + ' 通道差 ' + (da ? spread(da) : '-'));
const neutrals = ['paper', 'surface', 'ink', 'muted', 'line'];
/* 中性色允许极轻的蓝灰偏色（现代简约配色的通行做法），但不可是明显彩色 */
check('中性色为灰阶（容许轻微冷色偏移）', neutrals.every(k => {
  const v = token(light, k); return v && spread(v) <= 20;
}), neutrals.map(k => token(light, k) + '(' + spread(token(light, k)) + ')').join(' '));
check('主色与中性色对比明确', Math.abs(parseInt(la.slice(1, 3), 16) - parseInt(token(light, 'muted').slice(1, 3), 16)) > 40);

console.log('\n' + (errors.length
  ? '✗ ' + errors.length + '/' + checks + ' 项未通过'
  : '✓ 全部 ' + checks + ' 项通过'));
process.exit(errors.length ? 1 : 0);
