#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把「新词条」与「已有条目的英文补全」合并成 data/entries.js。

    python3 build_wiki.py            # 合并
    python3 build_wiki.py --check    # 合并并列出所有外部来源链接
"""
import os, re, sys, json, glob
from urllib.parse import quote
from collections import OrderedDict, Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ENTRIES = os.path.join(HERE, 'data', 'entries.js')
GEN = os.path.join(HERE, 'data', 'gen2')
GEN_EN = os.path.join(GEN, 'en')

VALID_CAT = ['branches', 'concepts', 'theories', 'methods', 'people', 'writing']
ID_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
REQ = ['id', 'title', 'en', 'category', 'tags', 'summary', 'summaryEn', 'sections', 'terms', 'related', 'sources']


def load_existing():
    """基线取原始快照（data/tasks2/entries/），保证脚本可反复运行而不重复合并。"""
    snap = os.path.join(HERE, 'data', 'tasks2', 'entries')
    files = sorted(glob.glob(os.path.join(snap, '*.json')))
    if files:
        out = []
        for fp in files:
            out.append(json.load(open(fp, encoding='utf-8')))
        return out
    txt = open(ENTRIES, encoding='utf-8').read()
    m = re.search(r'window\.LINGUA_ENTRIES\s*=\s*(\[.*\]);', txt, re.S)
    return json.loads(m.group(1))


def txt(v):
    return str(v if v is not None else '').strip()


def main():
    problems = []
    existing = load_existing()
    by_id = OrderedDict((e['id'], e) for e in existing)

    # ---------- 1. 已有条目补英文 ----------
    en_files = sorted(glob.glob(os.path.join(GEN_EN, '*.json')))
    patched = 0
    for fp in en_files:
        try:
            data = json.load(open(fp, encoding='utf-8'))
        except Exception as e:
            problems.append('%s 解析失败：%s' % (os.path.basename(fp), e))
            continue
        for sid, en in (data.get('entries') or {}).items():
            e = by_id.get(sid)
            if not e:
                problems.append('%s 中的 id 不在现有条目里：%s' % (os.path.basename(fp), sid))
                continue
            e['summaryEn'] = txt(en.get('summaryEn'))
            secs_en = en.get('sectionsEn') or []
            for i, s in enumerate(e.get('sections') or []):
                if i < len(secs_en):
                    s['hEn'] = txt(secs_en[i].get('hEn'))
                    s['pEn'] = [txt(x) for x in (secs_en[i].get('pEn') or [])]
                else:
                    s.setdefault('hEn', ''); s.setdefault('pEn', [])
            terms_en = en.get('termsEn') or []
            for i, t in enumerate(e.get('terms') or []):
                if i < len(terms_en):
                    t['tEn'] = txt(terms_en[i].get('tEn'))
                    t['dEn'] = txt(terms_en[i].get('dEn'))
                else:
                    t.setdefault('tEn', ''); t.setdefault('dEn', '')
            patched += 1

    # ---------- 1b. 为尚无链接来源的条目补上维基百科条目 ----------
    src_map = {}
    for fp in sorted(glob.glob(os.path.join(GEN, 'wiki-src', '*.json'))):
        try:
            data = json.load(open(fp, encoding='utf-8'))
        except Exception as e:
            problems.append('%s 解析失败：%s' % (os.path.basename(fp), e))
            continue
        for sid, title in (data.get('titles') or {}).items():
            title = txt(title)
            if sid and title:
                src_map[sid] = title
    linked = 0
    for sid, title in src_map.items():
        e = by_id.get(sid)
        if not e:
            problems.append('wiki-src 中的 id 不存在：%s' % sid)
            continue
        if any('http' in x for x in (e.get('sources') or [])):
            continue
        url = 'https://en.wikipedia.org/wiki/' + quote(title.replace(' ', '_'), safe="()',:_-!.")
        e.setdefault('sources', []).append('Wikipedia, "%s", %s' % (title, url))
        linked += 1

    # ---------- 2. 新词条 ----------
    added = 0
    for fp in sorted(glob.glob(os.path.join(GEN, 'batch-*.json'))):
        try:
            data = json.load(open(fp, encoding='utf-8'))
        except Exception as e:
            problems.append('%s 解析失败：%s' % (os.path.basename(fp), e))
            continue
        items = data.get('entries') or []
        if isinstance(items, dict):
            items = list(items.values())
        for raw in items:
            if not isinstance(raw, dict):
                continue
            sid = txt(raw.get('id'))
            if sid in by_id:
                problems.append('id 重复，跳过：%s' % sid)
                continue
            e = {
                'id': sid,
                'title': txt(raw.get('title')),
                'en': txt(raw.get('en')),
                'category': txt(raw.get('category')),
                'tags': [txt(x) for x in (raw.get('tags') or []) if txt(x)],
                'summary': txt(raw.get('summary')),
                'summaryEn': txt(raw.get('summaryEn')),
                'sections': [],
                'terms': [],
                'related': [txt(x) for x in (raw.get('related') or []) if txt(x)],
                'sources': [txt(x) for x in (raw.get('sources') or []) if txt(x)],
            }
            for s in (raw.get('sections') or []):
                e['sections'].append({
                    'h': txt(s.get('h')), 'hEn': txt(s.get('hEn')),
                    'p': [txt(x) for x in (s.get('p') or []) if txt(x)],
                    'pEn': [txt(x) for x in (s.get('pEn') or []) if txt(x)],
                })
            for t in (raw.get('terms') or []):
                e['terms'].append({
                    't': txt(t.get('t')), 'tEn': txt(t.get('tEn')),
                    'd': txt(t.get('d')), 'dEn': txt(t.get('dEn')),
                })
            by_id[sid] = e
            added += 1

    entries = list(by_id.values())

    # ---------- 3. 校验与清洗 ----------
    all_ids = {e['id'] for e in entries}
    for e in entries:
        for k in REQ:
            if e.get(k) in (None, '', []):
                problems.append('%s 缺少字段 %s' % (e['id'], k))
        if not ID_RE.match(e['id']):
            problems.append('%s id 格式不合法' % e['id'])
        if e.get('category') not in VALID_CAT:
            problems.append('%s 分类非法：%s' % (e['id'], e.get('category')))
        e['related'] = [r for r in dict.fromkeys(e.get('related') or [])
                        if r in all_ids and r != e['id']][:5]
        for s in e.get('sections') or []:
            if not s.get('h') or not s.get('p'):
                problems.append('%s 有空小节' % e['id'])
            if not s.get('hEn') or not s.get('pEn'):
                problems.append('%s 小节缺英文' % e['id'])
        for t in e.get('terms') or []:
            if not t.get('t') or not t.get('d'):
                problems.append('%s 有空术语' % e['id'])
            if not t.get('tEn') or not t.get('dEn'):
                problems.append('%s 术语缺英文：%s' % (e['id'], t.get('t')))

    order = {c: i for i, c in enumerate(VALID_CAT)}
    entries.sort(key=lambda e: (order.get(e['category'], 9),
                                e['title']))

    payload = json.dumps(entries, ensure_ascii=False, indent=1)
    with open(ENTRIES, 'w', encoding='utf-8') as f:
        f.write('/* 语林 · 语言学百科 —— 词条数据（由 build_wiki.py 自动合并生成，请勿手工编辑） */\n')
        f.write('window.LINGUA_ENTRIES = ')
        f.write(payload)
        f.write(';\n')

    # ---------- 4. 报告 ----------
    print('✓ 百科词条 %d 条（原有 %d + 新增 %d，英文补全 %d 条）'
          % (len(entries), len(existing), added, patched))
    print('  分类分布：' + '，'.join('%s %d' % (c, n) for c, n in
                                 Counter(e['category'] for e in entries).most_common()))
    print('  补入维基来源 %d 条（另 %d 条已有链接来源）' % (linked, len(src_map) - linked))
    print('  小节 %d 个 · 术语 %d 条 · 来源 %d 条'
          % (sum(len(e['sections']) for e in entries),
             sum(len(e['terms']) for e in entries),
             sum(len(e['sources']) for e in entries)))

    urls = []
    for e in entries:
        for s in e['sources']:
            for u in re.findall(r'https?://\S+', s):
                u = u.rstrip('.,;:!?、。；：！？”\'"】》')
                while u.endswith(')') and u.count('(') < u.count(')'):
                    u = u[:-1]
                urls.append(u)
    wiki = [u for u in urls if 'wikipedia.org' in u]
    print('  外部链接 %d 条（其中维基百科 %d 条）' % (len(urls), len(wiki)))
    if '--check' in sys.argv:
        with open(os.path.join(HERE, 'data', 'source-urls.txt'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(sorted(set(urls))))
        print('  已写出 data/source-urls.txt')

    if problems:
        print('\n⚠ 问题 %d 条：' % len(problems))
        for p in problems[:40]:
            print('   - ' + p)
    return 0 if not problems else 1


if __name__ == '__main__':
    sys.exit(main())
