#!/usr/bin/env python3
"""app.html 机械等价拆分工具（Wave 2 收尾）。

原则：零语义变更 —— 提取内容按字节原样落盘，构建过程逐块断言与原文件
对应行完全一致。经典 <script src> 顺序加载，保持"零构建可直开"。

实测结构（app.html 8081 行）：
  - 10-700    <style> 整块
  - 897-1866  五个纯数据 <script> 块（var D/AUTHORS/JUSHI/CILEI/SITUATIONAL_QUIZ）
  - 1877-8079 一个 <script> 块，其中：
      1878-7514  function bootApp() { ... }（god-function，内部含列 0 的 OOBE IIFE；
                 函数局部作用域承载全部子系统，且在账户流程后才被调用——
                 跨文件拆分会破坏共享作用域与执行时序，故整体保留，见 BUILD.md）
      7516-8078  真正的顶层语句（escapeHtml/ProfileAPI/账户流/错误条/启动接线）
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "web" / "app.html"

# (起始行, 结束行, 剥标签模式, 目标文件)   行号 1-based 含端点
# 剥标签模式: "both"=完整 <script>/<style> 对 | "first"=仅开头 <script>
#             | "last"=仅结尾 </script> | "none"=纯内容
PLAN = [
    (10,   700,  "both",  "css/app.css"),
    (897,  1617, "both",  "js/data/articles.js"),
    (1618, 1741, "both",  "js/data/authors.js"),
    (1742, 1804, "both",  "js/data/jushi.js"),
    (1805, 1857, "both",  "js/data/ci-lei-huo-yong.js"),
    (1858, 1866, "both",  "js/data/situational-questions.js"),
    (1877, 7514, "first", "js/app.main.js"),   # function bootApp(){ ... }（含内部 OOBE IIFE）
    (7516, 7677, "none",  "js/profile.js"),    # escapeHtml/ProfileAPI/档案落盘/登出
    (7678, 7699, "none",  "js/error-display.js"),  # 含所属注释行,
    (7701, 8035, "none",  "js/account.js"),    # startAccountFlow
    (8036, 8061, "none",  "js/reveal.js"),     # UWP Reveal 手电筒
    (8062, 8079, "last",  "js/boot.js"),       # DOMContentLoaded 接线 + 原块闭合 </script>
]


def main() -> int:
    lines = HTML.read_text(encoding="utf-8", newline="").splitlines(keepends=True)
    original = "".join(lines)

    # ---- 边界校验 ----
    for start, end, mode, rel in PLAN:
        first = lines[start - 1].lstrip()
        last = lines[end - 1].lstrip()
        if mode in ("both", "first") and not first.startswith("<script>") and not first.startswith("<style>"):
            print(f"边界异常(块首) @{start} {rel}: {first[:50]!r}", file=sys.stderr)
            return 1
        if mode in ("both", "last") and not last.startswith("</script>") and not last.startswith("</style>"):
            print(f"边界异常(块尾) @{end} {rel}: {last[:50]!r}", file=sys.stderr)
            return 1
        if mode == "none" and (first.startswith("<script") or first.startswith("<style")):
            print(f"意外标签 @{start} {rel}", file=sys.stderr)
            return 1

    # ---- 提取内容 ----
    extracted: list[tuple[str, str]] = []
    rebuild: list[str] = []
    cursor = 1

    for start, end, mode, rel in PLAN:
        while cursor < start:
            rebuild.append(lines[cursor - 1])
            cursor += 1
        if mode == "both":
            content = "".join(lines[start:end - 1])    # 内容 = 第 start+1 .. end-1 行
            tag = '<link rel="stylesheet" href="css/app.css">\n' if rel.endswith(".css") \
                else f'<script src="{rel}"></script>\n'
        elif mode == "first":
            content = "".join(lines[start:end])        # 去掉块首 <script>
            tag = f'<script src="{rel}"></script>\n'
        elif mode == "last":
            content = "".join(lines[start - 1:end - 1])  # 去掉块尾 </script>
            tag = f'<script src="{rel}"></script>\n'
        else:
            content = "".join(lines[start - 1:end])
            tag = f'<script src="{rel}"></script>\n'
        extracted.append((rel, content))
        rebuild.append(tag)
        cursor = end + 1

    while cursor <= len(lines):
        rebuild.append(lines[cursor - 1])
        cursor += 1

    # ---- 字节等价断言：每个提取文件 == 原文件对应行逐字节拼接 ----
    for start, end, mode, rel in PLAN:
        content = dict(extracted)[rel]
        if mode == "both":
            expected = "".join(lines[start:end - 1])
        elif mode == "first":
            expected = "".join(lines[start:end])
        elif mode == "last":
            expected = "".join(lines[start - 1:end - 1])
        else:
            expected = "".join(lines[start - 1:end])
        if content != expected:
            print(f"内容不等价: {rel}", file=sys.stderr)
            return 1

    # ---- 独立校验：任何提取文件不得含标签行（防差一错误自洽通过）----
    for rel, content in extracted:
        for ln in content.splitlines():
            s = ln.strip()
            if s in ("<script>", "</script>", "<style>", "</style>") or s.startswith("<script "):
                print(f"提取内容混入标签行: {rel}: {s[:40]!r}", file=sys.stderr)
                return 1

    new_html = "".join(rebuild)

    # ---- 落盘 ----
    for rel, content in extracted:
        dst = ROOT / "web" / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(content.encode("utf-8"))
        print(f"  写出 {rel:34s} {len(content.encode('utf-8')):>9,} B {content.count(chr(10)):>6,} 行")
    HTML.write_bytes(new_html.encode("utf-8"))
    print(f"  重写 app.html{'':20s} {len(new_html.encode('utf-8')):>9,} B {new_html.count(chr(10)):>6,} 行"
          f"（原 {len(original.encode('utf-8')):,} B / {original.count(chr(10)):,} 行）")

    inline = re.findall(r"<script>\s*\n", new_html)
    print(f"  剩余内联 <script>: {len(inline)}（预期 0）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
