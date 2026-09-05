#!/usr/bin/env python3
"""拼音字典生成（v0.38）：pypinyin 覆盖课文/UI 全部 CJK 用字 -> web/js/pinyin-dict.js"""
import sys
from pathlib import Path
from pypinyin import pinyin, Style

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"


def main() -> int:
    chars = set()
    for f in (WEB / "config").glob("*.json"):
        chars.update(f.read_text(encoding="utf-8"))
    chars.update((WEB / "app.html").read_text(encoding="utf-8"))
    for f in (WEB / "js").rglob("*.js"):
        if f.name == "pinyin-dict.js":
            continue
        chars.update(f.read_text(encoding="utf-8"))
    cjk = {c for c in chars if '\u3400' <= c <= '\u9fff'}

    d = {}
    for c in sorted(cjk):
        py = pinyin(c, style=Style.TONE, errors='ignore', heteronym=False)
        if py and py[0] and py[0][0]:
            d[c] = py[0][0]
    js = ("/* ===== 拼音字典（v0.38 自动生成：pypinyin，覆盖课文/UI 全部用字）=====\n"
          "   由 build/gen-pinyin-dict.py 生成，请勿手改；缺字自动回退无注音。 */\n"
          "window.PINYIN_DICT = {" + ",".join(f'"{k}":"{v}"' for k, v in d.items()) + "};\n")
    out = WEB / "js" / "pinyin-dict.js"
    out.write_text(js, encoding="utf-8")
    print(f"pinyin dict: {len(d)} chars -> {out.name} ({out.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
