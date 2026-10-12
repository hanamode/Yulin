#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 EPUB 提取《Essentials of Linguistics, 2nd edition》的章节结构与正文，
输出可在 file:// 下直接加载的 JS 数据文件。

用法：
    python3 extract_book.py /path/to/book.epub
"""
import os, re, sys, json, html, shutil, zipfile, hashlib
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(HERE, 'data', 'book')
MEDIADIR = os.path.join(HERE, 'media')

# ---------------------------------------------------------------- 工具

def text_of(frag):
    """去标签取纯文本"""
    frag = re.sub(r'(?s)<(script|style)\b.*?</\1>', ' ', frag)
    frag = re.sub(r'<[^>]+>', ' ', frag)
    return re.sub(r'\s+', ' ', html.unescape(frag)).strip()


def slug_id(href):
    return href.rsplit('/', 1)[-1][:-len('.xhtml')]


DIV_OPEN = re.compile(r'<div\b[^>]*>', re.I)
DIV_TOK = re.compile(r'<div\b[^>]*>|</div\s*>', re.I)


def div_inner(html, start):
    """给定 '<div ...>' 的起始下标，返回其内部内容（用配对计数，容忍嵌套）"""
    m = DIV_OPEN.match(html, start)
    if not m:
        return None, None
    depth = 0
    for tok in DIV_TOK.finditer(html, start):
        depth += 1 if tok.group(0).lower().startswith('<div') else -1
        if depth == 0:
            return html[m.end():tok.start()], tok.end()
    return None, None


def strip_div_with_class(html, cls):
    """删除第一个 class 含 cls 的 div（含其配对闭合标签）"""
    for m in re.finditer(r'<div\b[^>]*class="[^"]*"[^>]*>', html, re.I):
        if cls in m.group(0):
            _, end = div_inner(html, m.start())
            if end is not None:
                return html[:m.start()] + html[end:]
    return html


def keep_ugc(html):
    """若存在 class 含 ugc 的容器，只保留其内部内容"""
    for m in re.finditer(r'<div\b[^>]*class="[^"]*"[^>]*>', html, re.I):
        if 'ugc' in m.group(0):
            inner, _ = div_inner(html, m.start())
            if inner is not None:
                return inner
    return html


# ---------------------------------------------------------------- 主流程

def main(epub_path):
    zf = zipfile.ZipFile(epub_path)
    names = zf.namelist()

    def read(n):
        return zf.read(n).decode('utf-8', 'replace')

    # ---- 1. 解析 toc.xhtml 得到层级目录 ----
    toc_raw = read('EPUB/toc.xhtml')
    nav = re.search(r'(?s)<nav\b.*?</nav>', toc_raw)
    nav = nav.group(0) if nav else toc_raw

    toc = []          # 扁平有序列表，带 depth
    depth = 0
    for tok in re.finditer(r'(?s)<ol\b[^>]*>|</ol>|<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', nav):
        t = tok.group(0)
        if t.startswith('<ol'):
            depth += 1
        elif t.startswith('</ol'):
            depth -= 1
        else:
            href = html.unescape(tok.group(1)).split('#')[0]
            label = text_of(tok.group(2))
            if href and not href.startswith(('http', 'mailto')):
                toc.append({'href': href, 'title': label, 'depth': depth})

    # ---- 2. 规范化：给每项分配 id / 父子关系 ----
    items = OrderedDict()
    order = []
    stack = {}
    for entry in toc:
        sid = slug_id(entry['href'])
        if sid in items:
            continue
        d = entry['depth']
        parent = stack.get(d - 1) if d > 1 else None
        node = {
            'id': sid,
            'file': entry['href'],
            'title': entry['title'],
            'depth': d,
            'parent': parent,
        }
        stack[d] = sid
        for k in list(stack):
            if k > d:
                del stack[k]
        items[sid] = node
        order.append(sid)

    # ---- 3. 逐个提取正文 ----
    sections = OrderedDict()
    media_used = set()
    link_map = {it['file']: it['id'] for it in items.values()}

    def rewrite(m):
        attr, url = m.group(1), m.group(2)
        if url.startswith(('http://', 'https://', 'mailto:', 'data:')):
            return m.group(0)
        if url.startswith('#'):
            frag = url[1:]
            return '%s="#/book/%s%s"' % (attr, cur_id, ('~b-' + frag) if frag else '')
        base, _, frag = url.partition('#')
        if base.endswith('.xhtml'):
            tgt = link_map.get(base) or slug_id(base)
            return '%s="#/book/%s%s"' % (attr, tgt, ('~' + frag) if frag else '')
        if base.startswith('assets/') or '/assets/' in base:
            fn = base.rsplit('/', 1)[-1]
            media_used.add(fn)
            return '%s="media/%s"' % (attr, fn)
        return m.group(0)

    for sid in order:
        cur_id = sid
        node = items[sid]
        path = 'EPUB/' + node['file']
        if path not in names:
            node['missing'] = True
            continue
        raw = read(path)
        body = re.search(r'(?s)<body\b[^>]*>(.*)</body>', raw)
        body = body.group(1) if body else raw

        # 标题
        h1 = re.search(r'(?s)<h1[^>]*class="[^"]*chapter-title[^"]*"[^>]*>(.*?)</h1>', body)
        if not h1:
            h1 = re.search(r'(?s)<h1[^>]*>(.*?)</h1>', body)
        book_title = text_of(h1.group(1)) if h1 else node['title']

        # 正文：只取 .ugc 容器内部（原文正文区）
        content = keep_ugc(body)
        content = strip_div_with_class(content, 'chapter-title-wrap')
        # 兜底：去掉可能残留的 h1 / 章号
        content = re.sub(r'(?s)<h1[^>]*class="[^"]*chapter-title[^"]*"[^>]*>.*?</h1>', '', content, count=1)
        content = re.sub(r'(?s)<p[^>]*class="[^"]*chapter-number[^"]*"[^>]*>\s*</p>', '', content, count=1)
        content = re.sub(r'(?s)^\s*<section[^>]*>', '', content)
        content = re.sub(r'(?s)</section>\s*$', '', content)

        # 视频处理：不复制视频文件，替换为占位说明（原书视频仅在 EPUB 内）
        def video_placeholder(m):
            block = m.group(0)
            srcs = re.findall(r'src="([^"]+)"', block)
            poster = re.search(r'poster="([^"]+)"', block)
            names = [s.rsplit('/', 1)[-1] for s in srcs if s.lower().endswith(('.mp4', '.mov', '.webm', '.m4v'))]
            p = ''
            if poster:
                fn = poster.group(1).rsplit('/', 1)[-1]
                media_used.add(fn)
                p = '<img src="media/%s" alt="" loading="lazy">' % fn
            if not names:
                return ''
            return ('<div class="video-placeholder" data-video="%s">%s'
                    '<div class="vp-body"><span class="vp-icon">[VIDEO]</span>'
                    '<span class="vp-text">原书视频：<code>%s</code><br>'
                    '<small>视频资源未随本站分发，可在原 EPUB 中查看。</small></span></div></div>'
                    % (names[0], p, '、'.join(names)))

        content = re.sub(r'(?s)<video\b.*?</video>', video_placeholder, content)

        # 链接 / 媒体重写
        content = re.sub(r'(?s)\b(href|src)\s*=\s*"([^"]*)"', rewrite, content)
        content = re.sub(r'(?s)\bsrcset\s*=\s*"[^"]*"', '', content)
        content = re.sub(r'(?s)\bposter\s*=\s*"([^"]*)"',
                         lambda m: 'poster="media/%s"' % m.group(1).rsplit('/', 1)[-1], content)

        # 原书表格（IPA 表、词形变化表等）在窄屏上会撑破版心，套一层可横向滚动的容器
        content = re.sub(r'(?s)(<table\b.*?</table>)',
                         lambda m: ('<div class="table-wrap">' + m.group(1) + '</div>')
                         if 'table-wrap' not in m.group(1) else m.group(1), content)

        # 清理内联尺寸（原书从 WordPress 导出，figure 上带 style="width: 4226px" 会撑破版心）
        def clean_style(m):
            keep = [d.strip() for d in m.group(1).split(';')
                    if d.strip() and not re.match(r'(width|height|max-width|min-width)\s*:', d.strip(), re.I)]
            return (' style="%s"' % '; '.join(keep)) if keep else ''

        content = re.sub(r'\s+style="([^"]*)"', clean_style, content)

        # id 加前缀，保证站内锚点可用且不与路由冲突
        content = re.sub(r'\s+id="([^"]*)"', lambda m: ' id="b-%s"' % m.group(1), content)
        # 去掉 epub 专用属性
        content = re.sub(r'\s+epub:type="[^"]*"', '', content)
        content = re.sub(r'\s+role="doc-[^"]*"', '', content)
        content = re.sub(r'\s+title="[^"]*"', '', content)
        content = re.sub(r'(?s)<!--.*?-->', '', content)
        content = re.sub(r'\n{3,}', '\n\n', content).strip()

        sections[sid] = {
            'id': sid,
            'title': node['title'],
            'bookTitle': book_title,
            'parent': node['parent'],
            'file': node['file'],
            'html': content,
            'chars': len(text_of(content)),
        }

    # ---- 4. 复制媒体 ----
    os.makedirs(MEDIADIR, exist_ok=True)
    copied = 0
    total_bytes = 0
    for fn in sorted(media_used):
        src = None
        for cand in ('EPUB/assets/' + fn, 'EPUB/' + fn):
            if cand in names:
                src = cand
                break
        if not src:
            continue
        dst = os.path.join(MEDIADIR, fn)
        if not os.path.exists(dst):
            with zf.open(src) as f, open(dst, 'wb') as o:
                shutil.copyfileobj(f, o)
        copied += 1
        total_bytes += os.path.getsize(dst)

    # ---- 5. 输出 ----
    os.makedirs(OUTDIR, exist_ok=True)

    toc_out = []
    for sid in order:
        n = items[sid]
        s = sections.get(sid)
        toc_out.append({
            'id': sid,
            'title': n['title'],
            'depth': n['depth'],
            'parent': n['parent'],
            'chars': (s or {}).get('chars', 0),
        })
    with open(os.path.join(OUTDIR, 'toc.js'), 'w', encoding='utf-8') as f:
        f.write('/* 目录结构：提取自原书 toc.xhtml，顺序与层级与原文一致 */\n')
        f.write('window.LINGUA_BOOK_TOC = ')
        json.dump(toc_out, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

    # 正文按「顶层章节」分片，便于浏览器加载
    chapter_of = {}
    for sid in order:
        n = items[sid]
        if n['depth'] == 1:
            cur = sid
        chapter_of[sid] = chapter_of.get(sid) if n['depth'] > 1 else sid
        if n['depth'] == 1:
            chapter_of[sid] = sid
    # 修正：depth>1 的归属
    tops = [s for s in order if items[s]['depth'] == 1]
    def top_of(sid):
        best = tops[0] if tops else sid
        for t in tops:
            if order.index(t) <= order.index(sid):
                best = t
        return best
    for sid in order:
        chapter_of[sid] = top_of(sid)

    chunks = OrderedDict()
    for sid in order:
        chunks.setdefault(chapter_of[sid], []).append(sid)

    for i, (top, ids) in enumerate(chunks.items(), 1):
        payload = OrderedDict()
        for sid in ids:
            if sid in sections:
                payload[sid] = sections[sid]
        fp = os.path.join(OUTDIR, 'en-%02d.js' % i)
        with open(fp, 'w', encoding='utf-8') as f:
            f.write('/* 英文原文：%s（提取自 EPUB，未改动用语） */\n' % items[top]['title'])
            f.write('(window.LINGUA_BOOK=window.LINGUA_BOOK||{}).en=Object.assign(window.LINGUA_BOOK.en||{},')
            json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))
            f.write(');\n')

    # ---- 6. 报告 ----
    total_chars = sum(s['chars'] for s in sections.values())
    print('✓ 目录项 %d 个（顶层 %d）' % (len(toc_out), len(tops)))
    print('✓ 正文小节 %d 个，字符总数 %s' % (len(sections), format(total_chars, ',')))
    print('✓ 媒体复制 %d 个，%.1f MB' % (copied, total_bytes / 1048576))
    print('✓ 输出 %d 个英文分片 -> data/book/en-XX.js' % len(chunks))
    print('  分片：' + '，'.join('%s(%d节)' % (items[t]['title'][:14], len(v)) for t, v in chunks.items()))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else
         os.path.expanduser('~/Library/Mobile Documents/com~apple~CloudDocs/Downloads/'
                            'Essentials-of-Linguistics-2nd-edition-1789526864.epub'))
