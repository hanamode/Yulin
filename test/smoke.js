/* 语林 —— 无浏览器的冒烟测试：用最小 DOM 桩加载 app.js，检查各视图能否正常渲染 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let errors = [];
let checks = 0;

function check(name, cond, extra) {
  checks++;
  if (cond) console.log('  ✓ ' + name);
  else { console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); errors.push(name); }
}

/* ---------- 极小 DOM 桩 ---------- */
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    _html: '', hidden: false, textContent: '', value: '',
    dataset: {}, style: {}, children: [],
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { if (on === undefined) on = !this._s.has(c); on ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    setAttribute(k, v) { this['attr_' + k] = v; },
    getAttribute(k) { return this['attr_' + k]; },
    addEventListener() {}, removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    querySelector() { return makeEl('div'); },
    querySelectorAll() { return []; },
    closest() { return null; },
    focus() {}, blur() {}, click() {}, select() {},
    scrollIntoView() {},
    getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 20 }; },
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return this._html; },
    set(v) { this._html = String(v); }
  });
  return el;
}

const els = {};
function getEl(sel) {
  if (!els[sel]) { els[sel] = makeEl(sel === '#view' || sel === '#sidebar' ? 'div' : 'div'); els[sel].id = sel.replace('#', ''); }
  return els[sel];
}

const listeners = {};
const document = {
  readyState: 'complete',
  title: '',
  documentElement: makeEl('html'),
  body: makeEl('body'),
  querySelector(sel) { return getEl(sel); },
  querySelectorAll() { return []; },
  getElementById(id) { return els['#' + id] || null; },
  addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
  createElement(t) { return makeEl(t); },
};

const location = { hash: '', href: 'file:///index.html', replace(h) { if (h.startsWith('#')) this.hash = h; } };
const win = {
  LINGUA_CATEGORIES: null, LINGUA_ENTRIES: null,
  document, location,
  pageYOffset: 0,
  addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
  scrollTo() {},
  setTimeout, clearTimeout,
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  location,
  console,
};
win.window = win;
const localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } };

const ctx = vm.createContext(Object.assign(win, {
  document, localStorage, console, setTimeout, clearTimeout, Math, JSON, Object, Array, String, Number, RegExp, Date, Set, Map, Error, encodeURIComponent, decodeURIComponent,
}));
ctx.globalThis = ctx;

/* ---------- 加载数据 + 应用 ---------- */
const sandbox = ctx;
try {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'data/categories.js'), 'utf8'), sandbox, { filename: 'categories.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'data/entries.js'), 'utf8'), sandbox, { filename: 'entries.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/app.js'), 'utf8'), sandbox, { filename: 'app.js' });
} catch (e) {
  console.error('✗ 脚本执行失败：\n' + (e && e.stack || e));
  process.exit(1);
}

const ENTRIES = sandbox.LINGUA_ENTRIES;
console.log('\n数据：' + ENTRIES.length + ' 个条目，' + sandbox.LINGUA_CATEGORIES.length + ' 个分类\n');

function nav(hash) {
  location.hash = hash;
  (listeners['hashchange'] || []).forEach(fn => fn());
  return getEl('#view').innerHTML;
}
function sidebar() { return getEl('#sidebar').innerHTML; }

/* ---------- 断言 ---------- */
console.log('首页');
const home = getEl('#view').innerHTML;
check('渲染出 hero 区块', home.includes('class="hero"'));
check('包含条目统计数字', home.includes('>' + ENTRIES.length + '<'), '期望 ' + ENTRIES.length);
check('渲染分类卡片数量正确', (home.match(/class="cat-card"/g) || []).length === sandbox.LINGUA_CATEGORIES.length);
check('无 undefined 泄漏', !home.includes('undefined'), (home.match(/.{40}undefined.{40}/) || [''])[0]);
check('无 [object Object]', !home.includes('[object Object]'));
check('侧栏已渲染', sidebar().includes('side-link'));

console.log('\n分类页');
const cat = nav('#/cat/branches');
check('分类标题出现', cat.includes('分支学科'));
check('至少一个条目卡片', cat.includes('class="entry-card"'));
check('侧栏高亮当前分类', sidebar().includes('is-active'));

console.log('\n条目页');
const first = ENTRIES[0];
const det = nav('#/entry/' + first.id);
check('标题渲染', det.includes(first.title));
check('概述渲染', det.includes('entry-summary'));
check('正文小节渲染', det.includes('class="prose"'));
check('目录生成', det.includes('class="toc"'), '小节数 ' + first.sections.length);
check('术语表渲染', det.includes('class="gloss"'));
check('参考文献渲染', det.includes('src-list'));
check('上下条导航', det.includes('class="pager"'));
check('无 undefined 泄漏', !det.includes('undefined'));

console.log('\n锚点跳转');
const anc = nav('#/entry/' + first.id + '~sec-2');
check('指定小节页面仍渲染', anc.includes('class="prose"'));

console.log('\n搜索');
const s1 = nav('#/search/' + encodeURIComponent(first.title));
check('按标题能搜到', s1.includes('class="result"'));
check('显示命中字段', s1.includes('命中：'));
const s2 = nav('#/search/' + encodeURIComponent('音位'));
check('按关键词能搜到', s2.includes('class="result"'));
check('结果含高亮标签', s2.includes('<mark>'));
const s3 = nav('#/search/' + encodeURIComponent('zzzz不存在的词'));
check('无结果时有空状态', s3.includes('class="empty"'));
const s4 = nav('#/search/a');
check('单字母搜索不破坏 HTML 标签', !/<[a-zA-Z]+[^>]*<mark/i.test(s4), (s4.match(/<[a-zA-Z]+[^>]*<mark.{0,20}/) || [''])[0]);
check('搜索结果标签配对完整', (s4.match(/<mark/g) || []).length === (s4.match(/<\/mark>/g) || []).length);
const s5 = nav('#/search/' + encodeURIComponent('Phoneme'));
check('英文名可被搜索到', s5.includes('class="result"'));

console.log('\n标签 / 全部 / 关于 / 404');
const tg = nav('#/tag/' + encodeURIComponent(ENTRIES[0].tags[0]));
check('标签页渲染', tg.includes('标签：'));
check('全部条目页渲染', nav('#/all').includes('class="entry-card"'));
check('关于页渲染', nav('#/about').includes('关于语林'));
check('未知路由有兜底', nav('#/nope/nope').includes('class="empty"'));

console.log('\n数据完整性');
const ids = new Set(ENTRIES.map(e => e.id));
check('id 唯一', ids.size === ENTRIES.length);
let badRel = [];
ENTRIES.forEach(e => (e.related || []).forEach(r => { if (!ids.has(r)) badRel.push(e.id + '→' + r); }));
check('related 全部指向存在的条目', badRel.length === 0, badRel.slice(0, 5).join(', '));
let emptySec = ENTRIES.filter(e => !e.sections || !e.sections.length).map(e => e.id);
check('每个条目都有正文小节', emptySec.length === 0, emptySec.join(', '));
let noTerm = ENTRIES.filter(e => !e.terms || !e.terms.length).map(e => e.id);
check('每个条目都有关键词', noTerm.length === 0, noTerm.join(', '));
let noSrc = ENTRIES.filter(e => !e.sources || !e.sources.length).map(e => e.id);
check('每个条目都有参考文献', noSrc.length === 0, noSrc.join(', '));
const cats = new Set(sandbox.LINGUA_CATEGORIES.map(c => c.id));
let badCat = ENTRIES.filter(e => !cats.has(e.category)).map(e => e.id);
check('分类 id 合法', badCat.length === 0, badCat.join(', '));

console.log('\n' + (errors.length
  ? '✗ ' + errors.length + '/' + checks + ' 项检查未通过'
  : '✓ 全部 ' + checks + ' 项检查通过'));
process.exit(errors.length ? 1 : 0);
