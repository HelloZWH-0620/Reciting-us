#!/usr/bin/env python3
"""音频获取与命名映射（v0.38.1）：
从 JiJiDown 下载目录复制 72 篇高考必背古诗文朗读音频到 web/resource/audio/，
按课文标题命名（audioMap 匹配）并为标题注记差异补别名副本。
源目录不存在或已就绪时跳过。"""
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DST = ROOT / "web" / "resource" / "audio"
DEFAULT_SRC = Path(r"C:\Program Files\JiJiDown\Download\【高考必背古诗文】72篇【人声朗读】文言文_古文_诗词_唐诗_宋词_背诵_默写_高中")

# 标题注记差异 → 额外别名副本（与课文/诗词 title 精确匹配）
ALIAS = {
    '屈原列传': ['屈原列传（节选）'],
    '报任安书': ['报任安书（节选）'],
    '过秦论': ['过秦论（上）'],
    '礼记·大道之行也': ['礼运（节选）'],
    '归去来兮辞·并序': ['归去来兮辞（并序）'],
    '归园田居': ['归园田居（其一）'],
    '邶风·静女': ['静女'],
    '秦风·无衣': ['无衣'],
    '离骚': ['离骚（节选）'],
    '拟行路难·其四': ['拟行路难（其四）'],
    '琵琶行': ['琵琶行（并序）'],
    '苏幕遮·燎沉香': ['苏幕遮（燎沉香）'],
    '扬州慢·淮左名都': ['扬州慢（淮左名都）'],
    '长亭送别【正宫】【端正好】': ['长亭送别（节选）'],
}


def clean(name: str) -> str:
    s = re.sub(r'^\d+\.\d*', '', Path(name).stem)
    s = re.sub(r'_\d+$', '', s)
    return s.replace('《', '').replace('》', '').strip()


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    if not src.exists():
        print(f"[fetch-audio] 源目录不存在，跳过: {src}")
        return 0
    DST.mkdir(parents=True, exist_ok=True)
    n = 0
    for f in sorted(src.glob('*.aac')):
        stem = clean(f.name)
        shutil.copy2(f, DST / (stem + '.aac'))
        n += 1
        for alias in ALIAS.get(stem, []):
            shutil.copy2(f, DST / (alias + '.aac'))
            n += 1
    total = sum(f.stat().st_size for f in DST.glob('*.aac')) // 1024 // 1024
    print(f"[fetch-audio] 就绪 {n} 个复制操作，共 {total} MB（web/resource/audio/）")
    return 0


if __name__ == '__main__':
    sys.exit(main())
