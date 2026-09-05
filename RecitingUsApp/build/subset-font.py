#!/usr/bin/env python3
"""字体子集化（v3 §7.3，API 已按 fontTools 实际接口修正）：
从 web/resource/wordtype/Regular.ttf（25.4MB 整字库）生成仅含所需字符的 woff2。
用字集 = web/config/*.json 全文 + web/app.html + web/js/*.js + 常用字兜底文件（可选）。
输出: web/resource/wordtype/Regular.subset.woff2
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # RecitingUsApp/
WEB = ROOT / "web"
FONT_IN = WEB / "resource" / "wordtype" / "Regular.ttf"
FONT_OUT = WEB / "resource" / "wordtype" / "Regular.subset.woff2"
COMMON_3500 = ROOT / "build" / "common_3500.txt"


def collect_chars() -> set:
    chars: set = set()
    # config/*.json 全部课文/诗词/题库/作者数据
    for f in (WEB / "config").glob("*.json"):
        chars.update(f.read_text(encoding="utf-8"))
    # app.html（含全部 UI 文案与内联 JS）
    chars.update((WEB / "app.html").read_text(encoding="utf-8"))
    # js/*.js 模块
    for f in (WEB / "js").glob("*.js"):
        chars.update(f.read_text(encoding="utf-8"))
    # 常用字兜底（可选文件，缺省跳过）
    if COMMON_3500.exists():
        chars.update(COMMON_3500.read_text(encoding="utf-8").split())
    # ASCII 可打印字符兜底（数字/标点/英文）
    chars.update(chr(c) for c in range(0x20, 0x7F))
    return {c for c in chars if not c.isspace()}


def main() -> int:
    try:
        from fontTools import subset
    except ImportError:
        print("需要 fonttools + brotli:  pip install fonttools brotli", file=sys.stderr)
        return 1

    if not FONT_IN.exists():
        print(f"找不到字体: {FONT_IN}", file=sys.stderr)
        return 1

    chars = collect_chars()
    text = "".join(chars)
    print(f"用字集: {len(chars)} 字符")

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]  # 保留 OpenType 特性
    options.name_IDs = ["*"]
    options.notdef_outline = True

    font = subset.load_font(str(FONT_IN), options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    subset.save_font(font, str(FONT_OUT), options)

    size_kb = FONT_OUT.stat().st_size / 1024
    print(f"完成: {FONT_OUT.name} = {size_kb:.0f} KB（原 {FONT_IN.stat().st_size // 1024} KB）")
    print("提示: 将 app.html 的 @font-face src 指向 Regular.subset.woff2 以启用")
    return 0


if __name__ == "__main__":
    sys.exit(main())
