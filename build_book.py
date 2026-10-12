#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
合并双语精编结果，生成站点数据文件，并自动更新 index.html 里的数据脚本标签。

    python3 build_book.py
"""
import os, re, json, glob, sys
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
BOOK = os.path.join(HERE, 'data', 'book')
GEN = os.path.join(BOOK, 'gen')
INDEX = os.path.join(HERE, 'index.html')

START = '<!-- BOOK_DATA_START -->'
END = '<!-- BOOK_DATA_END -->'


def fail(msg):
    print('✗ ' + msg)
    sys.exit(1)


def load_toc():
    txt = open(os.path.join(BOOK, 'toc.js'), encoding='utf-8').read()
    return json.loads(re.search(r'window\.LINGUA_BOOK_TOC\s*=\s*(\[.*?\]);', txt, re.S).group(1))


def load_meta():
    p = os.path.join(BOOK, 'manifest.json')
    if os.path.exists(p):
        return json.load(open(p, encoding='utf-8'))
    return {}


def normalize_sec(s):
    """把一节的数据规整为统一结构，缺字段补空"""
    out = {}
    def pair_field(key, required=True):
        v = s.get(key)
        if isinstance(v, dict):
            return {'en': str(v.get('en', '') or ''), 'zh': str(v.get('zh', '') or '')}
        if isinstance(v, str):
            return {'en': v, 'zh': v}
        return None

    for k in ('title', 'summary'):
        p = pair_field(k)
        if p:
            out[k] = p

    def pair_list(key, fields):
        arr = s.get(key) or []
        res = []
        if isinstance(arr, dict):
            arr = [arr]
        for it in arr:
            if not isinstance(it, dict):
                continue
            row = {}
            for f in fields:
                row[f] = str(it.get(f, '') or '')
            if any(row.values()):
                res.append(row)
        return res

    out['points'] = pair_list('points', ['en', 'zh'])
    out['terms'] = pair_list('terms', ['en', 'zh', 'defEn', 'defZh'])
    out['examples'] = pair_list('examples', ['text', 'noteEn', 'noteZh'])
    out['body'] = pair_list('body', ['en', 'zh'])
    return out


def main():
    toc = load_toc()
    meta = load_meta()
    ids = [t['id'] for t in toc]
    by_id = {t['id']: t for t in toc}

    condense, problems = {}, []
    files = sorted(glob.glob(os.path.join(GEN, 'batch-*.json')))
    if not files:
        fail('data/book/gen/ 下没有任何 batch-*.json')

    for fp in files:
        try:
            data = json.load(open(fp, encoding='utf-8'))
        except Exception as e:
            problems.append('%s 解析失败：%s' % (os.path.basename(fp), e))
            continue
        secs = data.get('sections') or {}
        if isinstance(secs, list):
            secs = {x.get('id'): x for x in secs if isinstance(x, dict)}
        for sid, raw in secs.items():
            if sid not in by_id:
                problems.append('%s 中的 id 不在目录里：%s' % (os.path.basename(fp), sid))
                continue
            if sid in condense:
                problems.append('重复小节：%s' % sid)
                continue
            condense[sid] = normalize_sec(raw if isinstance(raw, dict) else {})

    # 完整性检查
    skip = set(meta.get('skipCondense') or [])
    expected = [i for i in ids if i not in skip]
    missing = [i for i in expected if i not in condense]
    empty = [i for i, v in condense.items()
             if not v.get('summary', {}).get('zh') and not v.get('body')]

    # ---- 分组写文件（按顶层章节聚合，每片最多 18 节） ----
    def top_of(sid):
        cur = by_id[sid]
        while cur and cur.get('depth', 1) > 1:
            cur = by_id.get(cur.get('parent'))
        return cur['id'] if cur else sid

    groups = OrderedDict()
    for sid in ids:
        if sid not in condense:
            continue
        groups.setdefault(top_of(sid), []).append(sid)

    for f in glob.glob(os.path.join(BOOK, 'condense-*.js')):
        os.remove(f)

    chunks, cur, n = [], [], 0
    for top, sids in groups.items():
        cur.extend(sids)
        n += len(sids)
        if n >= 18:
            chunks.append(cur)
            cur, n = [], 0
    if cur:
        chunks.append(cur)

    for i, sids in enumerate(chunks, 1):
        payload = OrderedDict((s, condense[s]) for s in sids)
        fp = os.path.join(BOOK, 'condense-%02d.js' % i)
        with open(fp, 'w', encoding='utf-8') as f:
            f.write('/* 中英双语精编（自动合并生成，请勿手工编辑） */\n')
            f.write('(window.LINGUA_BOOK=window.LINGUA_BOOK||{}).condense='
                    'Object.assign(window.LINGUA_BOOK.condense||{},')
            json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))
            f.write(');\n')

    # ---- 书目信息 ----
    with open(os.path.join(BOOK, 'meta.js'), 'w', encoding='utf-8') as f:
        f.write('/* 书目信息 */\nwindow.LINGUA_BOOK_META=')
        json.dump({'book': meta.get('book', {}),
                   'skipCondense': sorted(skip),
                   'batchCount': meta.get('batchCount', 0)},
                  f, ensure_ascii=False, indent=1)
        f.write(';\n')

    # ---- 更新 index.html 的脚本标签 ----
    html = open(INDEX, encoding='utf-8').read()
    if START not in html or END not in html:
        fail('index.html 缺少 BOOK_DATA_START / BOOK_DATA_END 标记')
    script_files = (['data/book/toc.js', 'data/book/meta.js'] +
                    sorted(os.path.basename(p) and 'data/book/' + os.path.basename(p)
                           for p in glob.glob(os.path.join(BOOK, 'en-*.js'))) +
                    sorted('data/book/' + os.path.basename(p)
                           for p in glob.glob(os.path.join(BOOK, 'condense-*.js'))))
    tags = '\n'.join('<script src="%s"></script>' % s for s in script_files)
    html = re.sub(re.escape(START) + r'.*?' + re.escape(END),
                  START + '\n' + tags + '\n' + END, html, flags=re.S)
    open(INDEX, 'w', encoding='utf-8').write(html)

    # ---- 报告 ----
    terms = sum(len(v['terms']) for v in condense.values())
    points = sum(len(v['points']) for v in condense.values())
    examples = sum(len(v['examples']) for v in condense.values())
    zh_chars = sum(len(p['zh']) for v in condense.values() for p in v['body'])
    en_words = sum(len(p['en'].split()) for v in condense.values() for p in v['body'])

    print('✓ 精编小节 %d / %d 节（跳过版式页 %d）' % (len(condense), len(expected), len(skip)))
    print('  术语 %d 条 · 要点 %d 条 · 例证 %d 条' % (terms, points, examples))
    print('  精编正文：中文 %s 字 / 英文 %s 词'
          % (format(zh_chars, ','), format(en_words, ',')))
    print('✓ 输出 %d 个精编分片 + meta.js，并更新 index.html（%d 个数据脚本）'
          % (len(chunks), len(script_files)))
    if missing:
        print('\n⚠ 尚未精编 %d 节：' % len(missing))
        for m in missing[:30]:
            print('   - %s  %s' % (m, by_id[m]['title']))
    if empty:
        print('\n⚠ 内容为空 %d 节：%s' % (len(empty), ', '.join(empty[:10])))
    if problems:
        print('\n⚠ 数据问题 %d 条：' % len(problems))
        for p in problems[:25]:
            print('   - ' + p)
    return 0 if not missing else 1


if __name__ == '__main__':
    sys.exit(main())
