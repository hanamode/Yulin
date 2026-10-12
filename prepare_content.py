#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
为「中英双语精编」准备素材：
  1. data/book/manifest.json  —— 供站点与子代理使用的书稿结构
  2. data/book/src/<id>.txt   —— 每节正文的纯文本（保留标题层级/列表/图片标记）
  3. data/book/tasks/batch-NN.json —— 分派给子代理的任务清单
"""
import os, re, json, html, math, sys
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
BOOK = os.path.join(HERE, 'data', 'book')
SRC = os.path.join(BOOK, 'src')
TASKS = os.path.join(BOOK, 'tasks')

BATCH_SIZE = 3
# 纯版式页，不做精编，只展示原文
SKIP = {'front-cover', 'title-page', 'copyright', 'table-of-contents'}


def html_to_text(frag):
    s = frag
    s = re.sub(r'(?s)<(script|style)\b.*?</\1>', '', s)
    s = re.sub(r'(?s)<div class="video-placeholder".*?</div>\s*</div>',
               lambda m: '\n[视频：%s]\n' % (re.search(r'data-video="([^"]*)"', m.group(0)) or ['', ''])[1], s)
    s = re.sub(r'(?s)<img[^>]*src="media/([^"]+)"[^>]*>', r'\n[图片：\1]\n', s)
    s = re.sub(r'(?s)<img[^>]*alt="([^"]*)"[^>]*>', r'\n[图片：\1]\n', s)
    s = re.sub(r'(?s)<(h2|h3|h4)[^>]*>(.*?)</\1>',
               lambda m: '\n\n## ' + re.sub(r'<[^>]+>', '', m.group(2)).strip() + '\n', s)
    s = re.sub(r'(?s)<(ul|ol)[^>]*>(.*?)</\1>',
               lambda m: '\n' + '\n'.join('- ' + re.sub(r'<[^>]+>', '', li).strip()
                                          for li in re.findall(r'(?s)<li[^>]*>(.*?)</li>', m.group(2))) + '\n', s)
    s = re.sub(r'(?s)<blockquote[^>]*>(.*?)</blockquote>',
               lambda m: '\n> ' + re.sub(r'<[^>]+>', '', m.group(1)).strip() + '\n', s)
    s = re.sub(r'(?s)<table[^>]*>(.*?)</table>',
               lambda m: '\n[表格]\n' + re.sub(r'<[^>]+>', ' | ', m.group(1)).strip() + '\n', s)
    s = re.sub(r'(?s)<(p|div|br|tr|figure|figcaption)[^>]*>', '\n', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s)
    s = re.sub(r'[ \t\u00a0]+', ' ', s)
    s = re.sub(r' *\n *', '\n', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()


def main():
    for d in (SRC, TASKS):
        os.makedirs(d, exist_ok=True)
    for f in os.listdir(TASKS):
        os.remove(os.path.join(TASKS, f))

    toc = json.loads(re.search(r'window\.LINGUA_BOOK_TOC\s*=\s*(\[.*?\]);',
                               open(os.path.join(BOOK, 'toc.js'), encoding='utf-8').read(), re.S).group(1))
    book = {}
    for f in sorted(os.listdir(BOOK)):
        if f.startswith('en-') and f.endswith('.js'):
            txt = open(os.path.join(BOOK, f), encoding='utf-8').read()
            m = re.search(r'Object\.assign\(window\.LINGUA_BOOK\.en\|\|\{\},(\{.*\})\);', txt, re.S)
            if m:
                book.update(json.loads(m.group(1)))

    # ---- 每节导出一个纯文本 ----
    items = []
    for t in toc:
        sec = book.get(t['id'])
        if not sec:
            continue
        text = html_to_text(sec['html'])
        with open(os.path.join(SRC, t['id'] + '.txt'), 'w', encoding='utf-8') as f:
            f.write('# %s\n\n%s\n' % (t['title'], text))
        items.append({
            'id': t['id'],
            'title': t['title'],
            'depth': t['depth'],
            'parent': t['parent'],
            'chars': sec['chars'],
            'textChars': len(text),
        })

    # ---- 章节标题查找 ----
    by_id = {i['id']: i for i in items}
    def top_title(sid):
        cur = by_id.get(sid)
        while cur and cur['depth'] > 1:
            cur = by_id.get(cur['parent'])
        return cur['title'] if cur else ''

    # ---- 切分任务：同章内每 3 节一批 ----
    todo = [i for i in items if i['id'] not in SKIP]
    batches, cur, cur_top = [], [], None
    for it in todo:
        top = top_title(it['id']) or it['id']
        if cur and (top != cur_top or len(cur) >= BATCH_SIZE):
            batches.append(cur)
            cur = []
        cur_top = top
        cur.append(it)
    if cur:
        batches.append(cur)

    for n, grp in enumerate(batches, 1):
        payload = {
            'batch': n,
            'chapter': top_title(grp[0]['id']),
            'out': 'data/book/gen/batch-%02d.json' % n,
            'sections': [
                {'id': g['id'], 'title': g['title'],
                 'src': 'data/book/src/%s.txt' % g['id'], 'chars': g['chars']}
                for g in grp
            ],
        }
        with open(os.path.join(TASKS, 'batch-%02d.json' % n), 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=1)

    manifest = {
        'book': {
            'title': 'Essentials of Linguistics, 2nd edition',
            'titleZh': '语言学基础（第二版）',
            'authors': ['Catherine Anderson', 'Bronwyn Bjorkman', 'Derek Denis',
                        'Julianne Doner', 'Margaret Grant', 'Nathan Sanders', 'Ai Taniguchi'],
            'publisher': 'eCampusOntario',
            'year': 2022,
            'license': 'CC BY-NC-SA 4.0',
            'source': 'https://ecampusontario.pressbooks.pub/essentialsoflinguistics2/',
        },
        'toc': [{**t, 'chapter': top_title(t['id'])} for t in items],
        'skipCondense': sorted(SKIP),
        'batchCount': len(batches),
    }
    with open(os.path.join(BOOK, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)

    print('✓ 纯文本 %d 节 -> data/book/src/' % len(items))
    print('✓ 任务批次 %d 个（每批 ≤%d 节）-> data/book/tasks/' % (len(batches), BATCH_SIZE))
    print('✓ 书稿清单 -> data/book/manifest.json')
    print('✓ 待精编 %d 节，源文本 %s 字符'
          % (len(todo), format(sum(i['chars'] for i in todo), ',')))


if __name__ == '__main__':
    main()
