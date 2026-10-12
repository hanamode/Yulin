#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 data/src/*.json 的分批条目合并、校验为 data/entries.js。"""
import json, glob, os, sys, re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'data', 'src')
OUT = os.path.join(HERE, 'data', 'entries.js')

CAT_ORDER = ['branches', 'concepts', 'theories', 'methods', 'people', 'writing']
VALID_CAT = set(CAT_ORDER)
REQ = ['id', 'title', 'en', 'category', 'tags', 'summary', 'sections', 'terms', 'related', 'sources']

ID_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')


def fail(msg):
    print('✗ ' + msg)
    sys.exit(1)


def main():
    files = sorted(glob.glob(os.path.join(SRC, '*.json')))
    if not files:
        fail('data/src/ 下没有找到任何 .json')

    entries, seen = [], {}
    problems = []
    normalized = 0

    for fp in files:
        name = os.path.basename(fp)
        try:
            with open(fp, encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            fail('%s 解析失败：%s' % (name, e))

        if isinstance(data, dict):
            data = data.get('entries', [])
        if not isinstance(data, list):
            fail('%s 顶层不是数组' % name)

        for e in data:
            if not isinstance(e, dict):
                problems.append('%s: 非对象元素' % name)
                continue
            eid = e.get('id', '?')
            for k in REQ:
                if k not in e or e[k] in (None, '', []):
                    problems.append('%s/%s 缺少字段 %s' % (name, eid, k))
            if not ID_RE.match(str(eid)):
                problems.append('%s/%s id 格式不合法' % (name, eid))
            if eid in seen:
                problems.append('id 重复：%s（%s 与 %s）' % (eid, seen[eid], name))
                continue
            if e.get('category') not in VALID_CAT:
                problems.append('%s/%s 分类非法：%s' % (name, eid, e.get('category')))
            seen[eid] = name
            entries.append(e)

    all_ids = {e['id'] for e in entries}

    # 归一化：去掉标题上误加的书名号与首尾空白
    for e in entries:
        before = e['title']
        e['title'] = str(e['title']).strip().strip('《》').strip()
        e['en'] = str(e.get('en', '')).strip()
        e['summary'] = str(e['summary']).strip()
        if before != e['title']:
            normalized += 1

    # 清洗 related：去掉自引用与不存在的 id
    for e in entries:
        rel = [r for r in (e.get('related') or []) if r in all_ids and r != e['id']]
        dedup = []
        for r in rel:
            if r not in dedup:
                dedup.append(r)
        e['related'] = dedup[:6]
        if not e['related']:
            problems.append('%s: related 为空（原有 %r）' % (e['id'], e.get('related')))

    entries.sort(key=lambda e: (CAT_ORDER.index(e['category']),
                                e['title']))

    payload = json.dumps(entries, ensure_ascii=False, indent=1)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('/* 语林 · 语言学百科 —— 条目数据（由 build.py 自动合并生成，请勿手工编辑） */\n')
        f.write('window.LINGUA_ENTRIES = ')
        f.write(payload)
        f.write(';\n')

    print('✓ 合并 %d 个文件 / %d 个条目 -> data/entries.js (%.1f KB)'
          % (len(files), len(entries), os.path.getsize(OUT) / 1024.0))
    print('  分类分布：' + '，'.join('%s %d' % (c, n)
          for c, n in Counter(e['category'] for e in entries).most_common()))
    if normalized:
        print('  已归一化 %d 个标题（去除出版社书名号/空白）' % normalized)
    print('  术语 %d 条，参考文献 %d 条，平均正文 %.0f 字'
          % (sum(len(e['terms']) for e in entries),
             sum(len(e['sources']) for e in entries),
             sum(sum(len(p) for s in e['sections'] for p in s['p']) for e in entries) / max(1, len(entries))))
    if problems:
        print('\n⚠ 发现 %d 个问题：' % len(problems))
        for p in problems[:40]:
            print('  - ' + p)


if __name__ == '__main__':
    main()
