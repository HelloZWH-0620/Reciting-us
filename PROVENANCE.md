# PROVENANCE — 非代码资产来源清单

> 依据《总体方案 V3》§3.1/§3.2 建立。任何进入 Release 的非代码资产都必须在此登记来源与许可;
> **来源不明的资产不得随 Release 分发**。

## 音频(resource/audio/*.mp3)

| 资产 | 来源 | 许可 | 备注 |
|------|------|------|------|
| 16 个课文朗读 mp3 | 关于页标注:人民教育出版社(仅供个人学习参考) | 未获得明确再分发授权 | **过渡期保留**:仅随开源仓库用于教学目的;长期方案为 TTS 重制或社区自录替换(方案 V3 §3.1 方案 A+C) |

## 文本(config/ 内嵌数据,迁移后为 config/articles.json)

| 资产 | 来源 | 许可 |
|------|------|------|
| 古诗文原文 | 公有领域(作者逝世均超 50 年);部分篇目文字参考 https://github.com/clover-yan/gaokao-poetry | 公有领域 |
| 译文/注释/赏析 | 项目自写(自译) | 随项目 MIT 分发 |

## 字体 / 图片

| 资产 | 来源 | 许可 | 待办 |
|------|------|------|------|
| resource/wordtype/Regular.ttf(LXGW WenKai 霞鹜文楷) | 字体名声明为 LXGW WenKai | 需核实 OFL 授权文件是否随附 | [ ] 补充授权文件 |
| resource/background/bg.png、resource/OOBE/*.png | 项目自绘(待确认) | 项目自有 | [ ] 确认 |

## AI 生成的位移贴图(liquid-glass.js)

| 资产 | 来源 | 许可 |
|------|------|------|
| standard/polar 位移贴图、SVG 滤镜链、位移图生成器 | 照抄开源项目 liquid-glass-react(https://github.com/rdev/liquid-glass-react) | MIT(保留原仓库声明,见文件头注释) |

## 数据处理声明(方案 V3 §3.4)

- 学习记录、错题、统计:仅存于本机浏览器 localStorage,永不上传
- 壁纸/偏好备份:仅写入本机 userdata/ 目录
- AI 功能(出题/对话):你输入的文本发往你在设置中填写的 AI 服务商,本项目不经手、不存储;
  本地代理仅做转发,并带有目标域名白名单(setuptools/ai-hosts.txt 可扩展)
