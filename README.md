简体中文 | [English](README_EN.md) | [文言文](README_Classical-Chinese.md)

# 背书哇！

> 一款帮助中国高中生背诵和学习文言文与古诗词的辅助工具

[![正式版 Release](https://img.shields.io/github/v/release/HelloZWH-0620/Reciting-us?label=正式版)](https://github.com/HelloZWH-0620/Reciting-us/releases/latest)
[![测试版 Release](https://img.shields.io/github/v/release/HelloZWH-0620/Reciting-us?include_prereleases&label=测试版)](https://github.com/HelloZWH-0620/Reciting-us/releases/)
![平台](https://img.shields.io/badge/platform-Windows%20%7C%20Android-blueviolet)
![许可证](https://img.shields.io/badge/license-MIT-green)

> 有关各版本的详情或下载应用，参见  [Releases](https://github.com/HelloZWH-0620/Reciting-us/releases/)。

---

## 项目介绍

「背书哇！」是一款帮助学习和背诵文言文与古诗词的应用，提供课文学习、互动练习、间隔重复、学习统计和可选的 AI 辅助功能。

目前仓库包含两种应用形态：推荐使用 `RecitingUsApp/` 中的 .NET 多端应用，提供 Windows 桌面版和 Android 版；`Memorization UI/` 是保留的旧版 Web/PowerShell 兼容程序。多端应用使用 `RecitingUsApp/web/` 中的网页资源，并由共享核心项目打包；旧版目录中的文件不与主应用自动同步。应用数据保存在本地，AI 功能需要自行配置兼容 OpenAI 接口的服务。

### 核心特色

- 📚 **丰富的课文库** — 收录高中必背文言文与古诗词，含原文、译文、注释与赏析
- ✍️ **多种练习模式** — 填空默写、上下句对接、情境默写、飞花令、虚词通关、词语通关、词类活用等
- 🤖 **AI 辅助** — 支持 AI 语法检查、AI 智能出题（需配置外部 AI API）
- 🔄 **间隔重复** — 基于艾宾浩斯遗忘曲线的闪卡复习与错题本功能
- 📊 **学习统计** — 可视化折线图、柱状图、饼图、热力图展示学习数据
- 🎨 **个性化壁纸** — 支持自定义背景壁纸上传、管理与定时切换
- 💾 **数据管理** — 支持学习进度导出与导入，方便多设备同步

---

## 功能概览

### 1. 课文学习

应用包含两大类课文内容：

| 分类 | 说明 |
| --- | --- |
| **文言文** | 《论语十二章》《劝学》《屈原列传》《谏太宗十思疏》《师说》《阿房宫赋》《六国论》等经典篇目 |
| **古诗词** | 《春江花月夜》《短歌行》《念奴娇·赤壁怀古》等必背诗词 |

每篇课文提供以下学习模式：

- **显示模式** — 完整展示原文、译文、注释与赏析
- **背诵模式** — 逐句/逐段背诵练习，隐藏部分内容辅助记忆
- **练习模式** — 基于当前课文生成练习题
- **词语模式** — 重点字词释义与词类活用分析

### 2. 互动练习

提供多种练习题型，覆盖高考文言文考点：

| 练习类型 | 说明 |
| --- | --- |
| **填空默写** | 根据上下文填写缺失的句子，训练名句默写能力 |
| **上下句对接** | 给出上句或下句，匹配对应的另一半 |
| **情境默写** | 模拟高考情境，根据提示写出相关名句 |
| **飞花令** | 限时说出含指定字的古诗文，连击挑战（基于已收录篇目自动生成字库） |
| **虚词通关** | 针对 18 个常见文言虚词（而、何、乎、乃、其、且、若、所、为、焉、也、以等）的选择与辨析练习 |
| **词语通关** | 重点实词的释义与用法练习 |
| **词类活用** | 词类活用辨析（名词作状语、使动用法、意动用法等） |

题库包含 **72 道预置题目**，涵盖三类题型：
- **虚词辨析**（18 题）：选择题，判断虚词在特定语境中的用法
- **填空默写**（36 题）：根据提示补全经典句子
- **例句匹配**（18 题）：根据虚词释义匹配正确例句

此外，启用 AI 功能后可由 AI 动态生成更多练习题目。

### 3. AI 辅助功能

应用内置 AI 代理（通过本地服务器转发请求），支持以下 AI 功能：

- ✨ **AI 语法检查** — 对用户输入的文言文句子进行语法分析
- ✨ **AI 虚词出题** — AI 针对全部文言虚词智能生成练习题
- ✨ **AI 情境默写出题** — AI 根据课文内容生成情境默写题

> **注意**：AI 功能需要配置外部 AI API（如 OpenAI 兼容接口），需在应用设置中填入 API 地址和密钥。

### 4. 记忆与复习

- **闪卡系统** — 支持基于间隔重复算法的闪卡复习，科学安排复习时间
- **错题本** — 自动收录练习中的错题，支持专门的错题复习模式
- **背诵进度追踪** — 标记每篇课文的掌握状态（已背/未掌握），实时显示学习进度
- **每日复习提醒** — 基于遗忘曲线计算下次复习时间

### 5. 学习统计

应用内置数据可视化模块，提供以下统计图表：

- 📈 **折线图** — 展示每日练习量变化趋势
- 📊 **柱状图** — 各类练习正确率对比
- 🥧 **饼图** — 练习类型分布占比
- 🗺️ **热力图** — 学习活跃度日历

### 6. 作者与朝代

- **作者详情** — 收录 18 位经典作者（孔子、荀子、司马迁、韩愈、苏轼等）的朝代与生平简介
- **朝代卡片** — 按历史朝代浏览相关作者与作品
- **在线查询** — 支持跳转外部资源进一步了解

### 7. 个性化设置

- 🖼️ **自定义壁纸** — 上传本地图片作为应用背景，支持 PNG/JPG/GIF/WebP/BMP 格式
- ⏰ **壁纸轮播** — 支持定时自动切换壁纸
- 🔤 **自定义字体** — 内置 Regular.ttf 字体，安装后获得更好的阅读体验
- 📝 **笔记批注** — 在课文上添加个人笔记
- 📏 **字体大小调节** — 支持调整正文字体大小

### 8. 数据管理

- 📤 **数据导出** — 将学习进度、错题记录等数据导出为文件
- 📥 **数据导入** — 从文件导入学习数据，恢复学习进度
- 🗑️ **数据重置** — 一键清除所有本地数据

---

## 项目结构

> [!important]
> 项目正处于开发阶段，结构会不定期改动。此处的结构不代表最终结构。

```
Reciting-us/
├── README.md / README_EN.md / README_Classical-Chinese.md
├── .github/workflows/build.yml     # Windows + Android 发布 CI
├── Memorization UI/                # 旧版 Web/PowerShell 兼容程序
└── RecitingUsApp/                  # 当前 .NET 多端应用
    ├── RecitingUs.slnx
    ├── Directory.Build.props       # .NET 目标与通用编译设置
    ├── Directory.Packages.props    # 集中管理 NuGet 版本
    ├── src/
    │   ├── RecitingUs.Core/        # API、HTTP 服务、数据存储、平台抽象
    │   ├── RecitingUs.App/         # Avalonia Windows 桌面端
    │   ├── RecitingUs.Android/     # Android 应用与原生平台服务
    │   ├── RecitingUs.Tests/       # xUnit 自动化测试
    │   └── _recovered/             # 历史恢复资料，不参与当前构建
    ├── web/                        # 多端应用的前端权威源，随 Core 嵌入
    ├── build/                      # 资源处理、发布和签名脚本
    ├── installer/                  # Windows 安装包配置
    └── BUILD.md                    # 项目结构及构建说明
```

---

## 下载与运行

从 [GitHub Releases](https://github.com/HelloZWH-0620/Reciting-us/releases) 下载与设备平台对应的发布附件：

- **Windows**：下载 `RecitingUs-Setup-<版本>.exe` 并运行安装程序；安装后从开始菜单或桌面快捷方式启动。桌面发布需 Microsoft Edge WebView2 Runtime；若系统缺少该运行时，请按应用提示安装，或根据 [此处的引导](https://developer.microsoft.com/zh-cn/microsoft-edge/webview2/#download) 安装。
- **Android**：下载 `recitingus-<版本>.apk` 并安装。

应用主要功能可离线使用；AI 功能需要网络连接及用户自行配置的 AI 服务。

### 直接运行 Web 程序

如果需要直接运行仓库中的 Web 程序，而非 Windows/Android 多端应用：

1. [克隆](https://github.com/HelloZWH-0620/Reciting-us/fork) 仓库，或下载仓库 ZIP 并解压。
2. 双击 `Memorization UI/setup.bat` 运行安装脚本；也可以直接运行 `Memorization UI/setuptools/start.bat`，启动本地服务器并打开浏览器。
3. 如需手动启动服务器，可在项目根目录的 PowerShell 中运行：
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File ".\Memorization UI\setuptools\server.ps1" 8000
   ```
   然后访问 `http://localhost:8000/app.html`。
4. 仓库根目录的 `__psserver.ps1` 仅用于快速静态预览（端口 8765），不提供任何本地服务器 API。

## 首次使用指南

1. **开箱引导（OOBE）** — 首次打开应用会进入引导流程，介绍主要功能
2. **浏览课文** — 在侧边栏选择课文分类（文言文/古诗词），点击篇目进入学习
3. **切换学习模式** — 在课文页面顶部切换「显示/背诵/练习/词语」模式
4. **开始练习** — 进入「互动练习」页面，选择练习类型开始答题
5. **查看统计** — 在统计页面查看学习数据图表
6. **自定义壁纸** — 在设置中上传喜欢的图片作为应用背景

---

## 配置 AI 功能

AI 功能通过本地服务器代理转发请求，绕过浏览器 CORS 限制。配置步骤：

1. 在应用的设置页面找到 AI 配置选项
2. 填入你使用的 AI API 地址（兼容 OpenAI 接口格式）
3. 填入 API 密钥
4. 选择模型名称
5. 保存配置后即可使用 AI 出题、语法检查等功能

---

## 技术栈

| 组件 | 技术 |
| --- | --- |
| 多端应用 | .NET 10、C#、Avalonia；Windows 桌面端与 Android 端 |
| 前端 | HTML / CSS / JavaScript，资源位于 `RecitingUsApp/web/` 并嵌入应用 |
| 共享核心 | 本地 HTTP API、SQLite、AI 代理、TTS 平台抽象 |
| Web 核心程序 | `Memorization UI/` 中的 Web 应用与 PowerShell HTTP 服务器 |

---

## 旧版 Web 程序 API

以下接口仅由 `Memorization UI/setuptools/server.ps1` 提供，不适用于新的桌面和 Android 应用：

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/wallpapers` | GET | 获取壁纸文件列表 |
| `/api/upload-wallpaper` | POST | 上传壁纸图片（Base64 格式） |
| `/api/wallpapers/{filename}` | DELETE | 删除指定壁纸 |
| `/api/ai-proxy` | POST | AI 请求代理转发（绕过 CORS） |
| 其他路径 | GET | 静态文件服务 |

---

## 贡献指南

推荐您加入我们的 QQ 群组：[950739151](https://qun.qq.com/universal-share/share?ac=1&authKey=xb2zqLolbPjWo5ukfQNE4FIXNikYa25bAZdOdhJ9tPwDnyeiGq7FtGe4xflFlxdl&busi_data=eyJncm91cENvZGUiOiI5NTA3MzkxNTEiLCJ0b2tlbiI6IjNsQm1WVlBtdVFPdk5qc1BmT0JHSTZ3cXlIV2wyMnFtdE1nNHhhdXlSWDNkRmFGdjF5MEx3TkFJK09pSGVHajUiLCJ1aW4iOiIyODA5ODc0NjI1In0%3D&data=bsTmftVzmLq9iWmvpCXoInjn7UgcuOhndlMPrXR_DH3JQlDsBTLG-mHm0OcCIdqgqBK-fljO_-w80hYzsr4Ahg&svctype=4&tempid=h5_group_info) 以获得更好的协作体验。

欢迎通过 [Issue](https://github.com/HelloZWH-0620/Reciting-us/issues) 报告问题或提出建议，并通过 [Pull Request](https://github.com/HelloZWH-0620/Reciting-us/pulls) 贡献改进。当前多端应用的主要贡献入口如下：

- **应用逻辑与平台功能**：`RecitingUsApp/src/RecitingUs.Core/`、`RecitingUsApp/src/RecitingUs.App/`、`RecitingUsApp/src/RecitingUs.Android/`。
- **前端界面、课文和配置数据**：`RecitingUsApp/web/`。该目录是多端应用使用的权威版本；不要把 `Memorization UI/` 中的旧版文件当作同步源。
- **自动化测试**：`RecitingUsApp/src/RecitingUs.Tests/`。
- **构建、打包和安装器**：`RecitingUsApp/build/`、`RecitingUsApp/installer/`；版本号和 NuGet 包版本分别由 `Directory.Build.props`、`Directory.Packages.props` 管理。

### 本地开发与验证

开发多端应用需要 .NET 10 SDK。克隆仓库后，在仓库根目录运行：

```powershell
dotnet test .\RecitingUsApp\src\RecitingUs.Tests\RecitingUs.Tests.csproj
dotnet build .\RecitingUsApp\src\RecitingUs.App\RecitingUs.App.csproj -c Debug
```

第一条命令运行核心单元测试；第二条构建 Windows 桌面项目。Android 开发还需要 Android SDK、JDK 21 和 .NET Android workload；完整构建、发布与环境说明见 [`RecitingUsApp/BUILD.md`](RecitingUsApp/BUILD.md)。提交改动前请运行相关测试，并避免提交 API 密钥、签名密钥、构建产物或个人数据。

如果你要维护的是旧版 Web/PowerShell 程序，请明确针对 `Memorization UI/` 修改；其课文和配置数据分别位于该目录的 `config/` 中。

---

## 许可证

本项目基于 [MIT License](https://opensource.org/licenses/MIT) 开源。

---

## 致谢

- 感谢所有为文言文与古诗词教育奉献的教育工作者
- 感谢开源社区提供的工具与资源
