#!/bin/bash
# 语林 —— 一键重建：从素材到可发布的静态站点
#   用法：bash build_all.sh
set -e
cd "$(dirname "$0")"

NODE="${NODE:-/Users/hanamo/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node}"
EPUB="${1:-$HOME/Library/Mobile Documents/com~apple~CloudDocs/Downloads/Essentials-of-Linguistics-2nd-edition-1789526864.epub}"

echo "== 1/5 从 EPUB 提取章节结构、正文与媒体 =="
python3 extract_book.py "$EPUB"

echo
echo "== 2/5 生成精编素材与任务清单 =="
python3 prepare_content.py

echo
echo "== 3/5 合并中英双语精编 -> data/book/condense-*.js =="
python3 build_book.py

echo
echo "== 4/5 合并百科词条（新词条 + 英文补全 + 维基来源）=="
python3 build_wiki.py --check

echo
echo "== 5/5 冒烟测试 =="
if [ -x "$NODE" ]; then "$NODE" test/smoke.js; else node test/smoke.js; fi

echo
echo "✓ 重建完成。用浏览器打开 index.html 即可。"
