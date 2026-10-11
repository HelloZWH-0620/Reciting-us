[简体中文](README.md) | [English](README_EN.md) | 文言文

# 背书哇！

> 助黉门学子诵习文言诗词之利器也

[![正式之 Release](https://img.shields.io/github/v/release/HelloZWH-0620/Reciting-us?label=正式版)](https://github.com/HelloZWH-0620/Reciting-us/releases/latest)
[![测试之 Release](https://img.shields.io/github/v/release/HelloZWH-0620/Reciting-us?include_prereleases&label=测试版)](https://github.com/HelloZWH-0620/Reciting-us/releases/)
![平台](https://img.shields.io/badge/platform-Windows%20%7C%20Android-blueviolet)
![License](https://img.shields.io/badge/license-MIT-green)

> 欲知诸版本之详，或下载应用，参阅 [Releases](https://github.com/HelloZWH-0620/Reciting-us/releases/)。

---

## 项目缘起

「背书哇！」者，助学子研习、背诵文言诗词之应用也。其具课文研习、互动习练、间隔复习、学业统计与可选 AI 辅弼诸能。

此仓库今存二种应用形态：荐用 `RecitingUsApp/` 中之 .NET 多端应用，兼有 Windows 桌面版与 Android 版；`Memorization UI/` 则为旧 Web/PowerShell 兼容程序，仍留仓中。多端应用之网页资源在 `RecitingUsApp/web/`，由共用核心项目打包；旧目录之文件不与主应用自动同步。应用数据存于本地；AI 功能须自行配置兼容 OpenAI 接口之服务。

### 核心特色

- 📚 **课文丰赡** — 收录高中必背文言文与古诗词，具原文、译文、注释与赏析
- ✍️ **习练多方** — 填空默写、上下句对接、情境默写、虚词通关、词语通关、词类活用等
- 🤖 **AI 辅弼** — 具 AI 语法检校、AI 智能出题之能（须配置外部 AI API）
- 🔄 **间隔重复** — 依艾宾浩斯遗忘曲线设闪卡复习与错题本
- 📊 **学业统计** — 以折线、柱状、饼、热力诸图可视化学习数据
- 🎨 **壁纸随心** — 可自上传背景壁纸，管理之，定时切换之
- 💾 **数据经管** — 学习进度可导出导入，便于多设备同步

---

## 功能概览

### 一、课文学习

应用所含课文，凡二类：

| 类 | 释 |
|------|------|
| **文言文** | 《论语十二章》《劝学》《屈原列传》《谏太宗十思疏》《师说》《阿房宫赋》《六国论》等经典篇目 |
| **古诗词** | 《春江花月夜》《短歌行》《念奴娇·赤壁怀古》等必背诗词 |

每篇课文，具以下学习模式：

- **显示模式** — 全示原文、译文、注释与赏析
- **背诵模式** — 逐句逐段诵习，隐其部分以助记忆
- **练习模式** — 据当前课文生成习题
- **词语模式** — 重点字词释义与词类活用辨析

### 二、互动练习

所设练习题型甚夥，覆盖高考文言文考点：

| 练习类型 | 释 |
|----------|------|
| **填空默写** | 依上下文填所缺之句，练名句默写之能 |
| **上下句对接** | 出上句或下句，配其另一半 |
| **情境默写** | 模拟高考情境，依提示书相关名句 |
| **虚词通关** | 就一十八个常见文言虚词（而、何、乎、乃、其、且、若、所、为、焉、也、以等）作选择与辨析练习 |
| **词语通关** | 重点实词释义与用法之练习 |
| **词类活用** | 词类活用辨析（名词作状语、使动用法、意动用法等） |

题库之中，预置之题凡 **七十有二**，盖三类：

- **虚词辨析**（一十八题）：选择题也，辨虚词于特定语境中之用法
- **填空默写**（三十六题）：依提示补全经典之句
- **例句匹配**（一十八题）：依虚词释义配正确例句

此外，启用 AI 之能后，可由 AI 动态生成更多题目。

### 三、AI 辅弼之能

应用内置 AI 代理（由本地服务器转发请求），支持以下 AI 之能：

- ✨ **AI 语法检校** — 对用户所输入之文言文句作语法分析
- ✨ **AI 虚词出题** — AI 就全部文言虚词智能生成练习题
- ✨ **AI 情境默写出题** — AI 据课文内容生成情境默写题

> **注意**：AI 之能须配置外部 AI API（如 OpenAI 兼容接口），于应用设置中填入 API 地址与密钥方可用之。

### 四、记诵与温习

- **闪卡系统** — 依间隔重复算法之闪卡复习，科学安排温习之时
- **错题本** — 自动收录练习中之错题，专设错题复习模式
- **背诵进度追踪** — 标记每篇课文掌握之态（已背/未掌握），实时显示学习进度
- **每日复习提醒** — 依遗忘曲线推算下次温习之时

### 五、学业统计

应用内置数据可视化模块，提供以下统计图表：

- 📈 **折线图** — 示每日练习量变化之趋势
- 📊 **柱状图** — 各类练习正确率之对比
- 🥧 **饼图** — 练习类型分布之占比
- 🗺️ **热力图** — 学习活跃度之日历

### 六、作者与朝代

- **作者详情** — 收录经典作者一十八位（孔子、荀子、司马迁、韩愈、苏轼等）之朝代与生平简介
- **朝代卡片** — 按历史朝代浏览相关作者与作品
- **在线查询** — 可跳转外部资源以进一步了解

### 七、随心之设

- 🖼️ **自定义壁纸** — 上传本地图片为应用背景，支持 PNG/JPG/GIF/WebP/BMP 诸格式
- ⏰ **壁纸轮播** — 定时自动切换壁纸
- 🔤 **自定义字体** — 内置 Regular.ttf 字体，安装后阅读体验更佳
- 📝 **笔记批注** — 于课文上添加个人笔记
- 📏 **字体大小调节** — 可调整正文字体大小

### 八、数据经管

- 📤 **数据导出** — 将学习进度、错题记录等数据导出为文件
- 📥 **数据导入** — 自文件导入学习数据，恢复学习进度
- 🗑️ **数据重置** — 一键清除所有本地数据

---

## 项目结构

> [!important]
> 项目今正开发，目录结构或时有更易。下列所示非最终定式。

```
Reciting-us/
├── README.md / README_EN.md / README_Classical-Chinese.md
├── .github/workflows/build.yml     # Windows 与 Android 发布 CI
├── Memorization UI/                # 旧 Web/PowerShell 兼容程序
└── RecitingUsApp/                  # 今之 .NET 多端应用
    ├── RecitingUs.slnx
    ├── Directory.Build.props       # .NET 目标与共用编译设置
    ├── Directory.Packages.props    # NuGet 包版本集中管理
    ├── src/
    │   ├── RecitingUs.Core/        # API、HTTP 服务、数据存储、平台抽象
    │   ├── RecitingUs.App/         # Avalonia Windows 桌面端
    │   ├── RecitingUs.Android/     # Android 应用与原生平台服务
    │   ├── RecitingUs.Tests/       # xUnit 自动化测试
    │   └── _recovered/             # 历史恢复资料，不参与构建
    ├── web/                        # 多端应用前端权威源，随 Core 嵌入
    ├── build/                      # 资源处理、发布、签名诸脚本
    ├── installer/                  # Windows 安装包配置
    └── BUILD.md                    # 结构与构建指南
```

---

## 下载与运行

于 [GitHub Releases](https://github.com/HelloZWH-0620/Reciting-us/releases/) 下载与所用设备相应之发布附件：

- **Windows**：下载 `RecitingUs-Setup-<版本>.exe` 并运行安装器；安装后自开始菜单或桌面快捷方式启之。桌面程序虽自包含，仍须 Microsoft Edge WebView2 Runtime；若系统未有，可依应用提示安装，或循[此安装指引](https://developer.microsoft.com/zh-cn/microsoft-edge/webview2/#download)办理。
- **Android**：下载并安装 `recitingus-<版本>.apk`。

应用之主要功能可离线使用；AI 功能须联网，并由用户自行配置 AI 服务。

### 直接运行 Web 程序

若欲运行仓库中之 Web 程序，而非 Windows/Android 多端应用：

1. [Fork 并克隆](https://github.com/HelloZWH-0620/Reciting-us/fork)仓库，或下载仓库 ZIP 并解压。
2. 双击 `Memorization UI/setup.bat`，或运行 `Memorization UI/setuptools/start.bat`，以启本地服务器并开浏览器。
3. 若欲手动启服务器，于仓库根目录之 PowerShell 运行：
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File ".\Memorization UI\setuptools\server.ps1" 8000
   ```
   而后访问 `http://localhost:8000/app.html`。
4. 根目录之 `__psserver.ps1` 仅供快速静态预览，监听 8765 端口，不提供任何本地服务器 API。

## 初用指南

1. **开箱引导（OOBE）** — 首次打开应用将进入引导流程，介绍主要功能
2. **浏览课文** — 于侧边栏选择课文分类（文言文/古诗词），点击篇目进入学习
3. **切换学习模式** — 于课文页面顶部切换「显示/背诵/练习/词语」模式
4. **开始练习** — 进入「互动练习」页面，选择练习类型开始答题
5. **查看统计** — 于统计页面查看学习数据图表
6. **自定义壁纸** — 于设置中上传喜爱之图片作为应用背景

---

## 配置 AI 之能

AI 请求经本地服务器代理转发，以避浏览器 CORS 之限。配置步骤如下：

1. 于应用设置页面寻得 AI 配置选项
2. 填入所用 AI API 地址（兼容 OpenAI 接口格式）
3. 填入 API 密钥
4. 选择模型名称
5. 保存配置后，即可使用 AI 出题、语法检校等能

---

## 技术栈

| 组件 | 技术 |
|------|------|
| 多端应用 | .NET 10、C#、Avalonia；Windows 桌面与 Android |
| 前端 | HTML / CSS / JavaScript，置于 `RecitingUsApp/web/` 并嵌入应用 |
| 共用核心 | 本地 HTTP API、SQLite、AI 代理、TTS 平台抽象 |
| 旧 Web 程序 | `Memorization UI/` 中之 Web 应用与 PowerShell HTTP 服务器 |

---

## 旧 Web 程序 API

下列接口仅由 `Memorization UI/setuptools/server.ps1` 提供，新桌面与 Android 应用不适用：

| 接口 | 法 | 释 |
|------|------|------|
| `/api/wallpapers` | GET | 获取壁纸文件列表 |
| `/api/upload-wallpaper` | POST | 上传壁纸图片（Base64 格式） |
| `/api/wallpapers/{filename}` | DELETE | 删除指定壁纸 |
| `/api/ai-proxy` | POST | AI 请求代理转发（绕过 CORS） |
| 其他路径 | GET | 静态文件服务 |

---

## 贡献指南

荐诸君入吾等 QQ 群组：[950739151](https://qun.qq.com/universal-share/share?ac=1&authKey=xb2zqLolbPjWo5ukfQNE4FIXNikYa25bAZdOdhJ9tPwDnyeiGq7FtGe4xflFlxdl&busi_data=eyJncm91cENvZGUiOiI5NTA3MzkxNTEiLCJ0b2tlbiI6IjNsQm1WVlBtdVFPdk5qc1BmT0JHSTZ3cXlIV2wyMnFtdE1nNHhhdXlSWDNkRmFGdjF5MEx3TkFJK09pSGVHajUiLCJ1aW4iOiIyODA5ODc0NjI1In0%3D&data=bsTmftVzmLq9iWmvpCXoInjn7UgcuOhndlMPrXR_DH3JQlDsBTLG-mHm0OcCIdqgqBK-fljO_-w80hYzsr4Ahg&svctype=4&tempid=h5_group_info) 以共襄协作之益。

有 Bug 或建议，请至 [Issues](https://github.com/HelloZWH-0620/Reciting-us/issues) 提交；欲贡献改进，请提 [Pull Request](https://github.com/HelloZWH-0620/Reciting-us/pulls)。多端应用之主要贡献目录如下：

- **应用逻辑与平台功能**：`RecitingUsApp/src/RecitingUs.Core/`、`RecitingUsApp/src/RecitingUs.App/`、`RecitingUsApp/src/RecitingUs.Android/`。
- **前端、课文与配置数据**：`RecitingUsApp/web/`。此乃多端应用所用之权威版本；勿以 `Memorization UI/` 中旧文件为同步源。
- **自动化测试**：`RecitingUsApp/src/RecitingUs.Tests/`。
- **构建、打包与安装器**：`RecitingUsApp/build/`、`RecitingUsApp/installer/`；.NET 版本与 NuGet 包版本，分别由 `Directory.Build.props`、`Directory.Packages.props` 管理。

### 本地开发与验证

开发多端应用须有 .NET 10 SDK。克隆仓库后，于仓库根目录运行：

```powershell
dotnet test .\RecitingUsApp\src\RecitingUs.Tests\RecitingUs.Tests.csproj
dotnet build .\RecitingUsApp\src\RecitingUs.App\RecitingUs.App.csproj -c Debug
```

首条命令运行核心单元测试；次条构建 Windows 桌面应用。开发 Android，另须 Android SDK、JDK 21 与 .NET Android workload。完整构建、发布及环境说明，见 [`RecitingUsApp/BUILD.md`](RecitingUsApp/BUILD.md)。提交前请运行相关测试，勿提交 API 密钥、签名密钥、构建产物或个人数据。

若所维护者乃旧 Web/PowerShell 程序，请专改 `Memorization UI/`；其课文与配置数据，皆在该目录之 `config/` 中。

---

## 许可证

本项目依 [MIT License](https://opensource.org/licenses/MIT) 而开源。

---

## 致谢

- 感谢所有为文言文与古诗词教育奉献之教育工作者
- 感谢开源社区提供之工具与资源
