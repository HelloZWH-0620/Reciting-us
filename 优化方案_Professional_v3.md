# 背书哇！专业级工程优化蓝图 v3.0

> **技术主线**：C# 13 / .NET 10 (LTS) / Avalonia 11.x / WebView（桌面 WebView2 + Android 原生 WebView）
> **目标平台**：Windows 桌面端、Android 移动端（同源 Web UI + C# 平台服务层）
> **文档版本**：v3.0（深度优化版）　**日期**：2026-09-05
> **一句话结论**：业务 UI（8059 行 Web SPA）保留为表现层并治理；**全部平台能力与数据下沉到 C#**；第一步是从现存程序集**恢复可编译源码并入库**，随后按四波里程碑推进。
>
> **v2.0 → v3.0 核心增量**：
> 1. 修正 `HttpListener` 请求并发模型（每请求一线程 → 有界并发 + SemaphoreSlim）
> 2. 修正嵌入式资源 csproj 语法（`LogicalPath` 非标准 → 改用 `GenerateEmbeddedFilesManifest` + `EmbeddedFile`）
> 3. 新增 HTTP 响应缓存（ETag / Cache-Control）、gzip 压缩、CSP 安全头
> 4. 新增 SQLite WAL 模式 + 连接池 + 原子化数据迁移（事务回滚）
> 5. 新增 AI 代理限流（令牌桶）+ 断路器模式
> 6. 新增「错误处理与弹性策略」「日志与可观测性」「更新与热更机制」三大章节
> 7. 新增 WebView2 运行时检测与引导安装
> 8. 新增 Android Activity 生命周期与 HTTP 服务器绑定管理
> 9. 细化里程碑验收标准（每子任务设 exit criteria）
> 10. 修正字体子集脚本 API 用法

---

## 1. 执行摘要

### 1.1 现状的本质问题

项目不是"性能差"，而是**工程主权丢失**：

1. **壳源码已灭失**：`RecitingUs.App` / `RecitingUs.Android` / `RecitingUs.Core` 三个 C# 工程于 2026-09-03 被删除且未提交 git（`RecitingUsApp/BUILD.md` 顶部有告警）。当前只能对 EXE/APK 做"产物级资源替换"（rcedit 换图标、zip 换 APK 图标），**无法改任何 C# 逻辑**。
2. **Web 资源被锁死在程序集内**：`RecitingUs.Core.dll` = 32 MB，内嵌 app.html、config JSON、图片、25 MB 字体。改 `Memorization UI/app.html` **进不了桌面/手机产物**。
3. **前端是 8059 行单文件**：519 KB、311 个函数、84 处 `innerHTML`、无模块化、无构建、无测试。
4. **后端逻辑在 PowerShell**：`server.ps1`（19 KB）承担 HTTP/上传/AI 代理/用户数据，无法进入 Android（Android 端靠的是已丢失的 C# WebServer）。
5. **资源与配置带病运行**：`liquid-glass.js` 被引用但**文件不存在**；`manifest.json` 的 8 个 PWA 图标全部断链；25 MB 整字库字体内嵌。

### 1.2 战略决策：路线对比

| 路线 | 做法 | 工作量 | 风险 | 结论 |
|---|---|---|---|---|
| **A. 纯 WebView 壳维持** | 恢复壳源码，UI 永远是 HTML/JS，C# 只做服务器 | 小 | 中（能力受限、体验天花板低） | 过渡态 |
| **B. 全原生 Avalonia 重写** | 8059 行 JS + Canvas 图表 + 多种练习游戏全部用 XAML/C# 重写 | 极大（≥3 月） | 高（回归面巨大、字体/排版难还原） | ❌ 不推荐 |
| **C. 混合架构（推荐）** | **恢复壳 → 后端全量 C# 化 → Web UI 治理拆分 → 原生能力经桥接下沉 → 新功能按需原生** | 中（分 4 波） | 低-中 | ✅ **采用** |

> **为什么选 C**：应用的核心价值是"文言文内容 + 练习/统计/AI"，其复杂度集中在**内容与交互逻辑**而非原生控件。Web UI 已成熟（液态玻璃、Canvas 图表、Markdown、多种题型），重写 ROI 极低；而文件系统、TTS、存储、通知、AI 密钥、更新等**平台能力恰恰是 WebView 的短板**，应由 C# 接管。C 路线让 C# 成为"平台与数据层"，Web 成为"可热更的表现层"。

### 1.3 目标架构一图

```
┌──────────────────────────────────────────────────────────────┐
│  RecitingUs.App (net10.0, 桌面)      RecitingUs.Android (net10.0-android) │
│  Avalonia Window + WebView2          Avalonia Activity + 原生 WebView      │
│            └──────────────┬───────────────┘                              │
│                           │  MainView (共享 UserControl)                  │
│        ┌──────────────────┴───────────────────┐                          │
│        │  RecitingUs.Core (net10.0, 平台无关)   │                          │
│        │  ┌────────────────────────────────┐  │                          │
│        │  │ EmbeddedHttpServer (HttpListener)│ │  ← localhost:8000        │
│        │  │  /api/* 路由  / 静态资源(内嵌+覆盖)│  │  + ETag缓存 + gzip        │
│        │  ├────────────────────────────────┤  │                          │
│        │  │ Services: 数据/壁纸/音频/AI代理/TTS│  │  + 限流 + 断路器          │
│        │  │ Data: SQLite WAL (Microsoft.Data  │  │                          │
│        │  │   .Sqlite) + 连接池               │  │                          │
│        │  │ Assets: 嵌入 wwwroot (app.html…)  │  │                          │
│        │  │ Logging: 结构化日志 + 诊断覆盖层   │  │                          │
│        │  └────────────────────────────────┘  │                          │
│        └──────────────────────────────────────┘                          │
│  平台特定: RecitingUs.Platforms.Windows / .Android (TTS、文件、返回键)      │
└──────────────────────────────────────────────────────────────┘
           ▲ fetch('/api/...')        ▲ 可选 native bridge (postMessage)
           │                          │
┌──────────┴──────────────────────────┴─────────────────────────┐
│  Web UI (wwwroot/app.html + js/* + assets/*)   ← 表现层，可热更  │
│  学习/练习/飞花令/闪卡/统计图表/AI/壁纸/设置                       │
│  + 错误边界 + 模块加载容错 + 调试覆盖层                           │
└───────────────────────────────────────────────────────────────┘
```

### 1.4 架构决策记录（ADR 摘要）

| ID | 决策 | 理由 | 代价 |
|---|---|---|---|
| ADR-01 | 选用 HttpListener 而非 Kestrel | 零额外依赖、桌面+Android 均可用；API 量小（<20 端点） | 无 WebSocket 支持（当前不需要） |
| ADR-02 | SQLite 而非 LiteDB | 生态成熟、SQL 可查询、Android 原生兼容 | 需手写迁移 |
| ADR-03 | 经典 `<script>` 而非 ESM | 兼容 file:// 直开与 server.ps1；零构建 | 无 tree-shaking（可接受） |
| ADR-04 | 端口递增而非固定 | 避免多实例/端口占用崩溃 | BaseUrl 需动态传递给 WebView |
| ADR-05 | AI 代理走 C# 而非前端直连 | 密钥不下前端；可限流/审计 | 增一跳延迟（<1ms 本地） |
| ADR-06 | 自包含文件夹而非 SingleFile | libSkiaSharp 原生 DLL 加载约束 | 体积大（字体子集后可控） |
| ADR-07 | 仅 arm64-v8a ABI | 覆盖 >98% Android 设备，减包 | x86 模拟器需临时加 ABI |

---

## 2. 现状审计（证据化）

### 2.1 资产与健康度

| 模块 | 路径 | 规模 | git | 健康 |
|---|---|:--:|:--:|:--:|
| 前端 SPA | `Memorization UI/app.html` | 772 KB / **8059 行** / 311 函数 / 84 `innerHTML` / 42 `localStorage` | ✅ | 🟡 |
| 数据 JSON | `Memorization UI/config/*.json` | articles 18KB、poem 36KB、game 28KB、writer 7KB、bundled 21KB | ✅ | 🟢 |
| PowerShell 后端 | `Memorization UI/setuptools/server.ps1` | 19 KB / 7 个 API | ✅ | 🟡 |
| 桌面壳产物 | `RecitingUsApp/artifacts/desktop/win-x64/` | ~149 MB / 248 文件 | ❌ | 🔴 源码丢失 |
| Android 产物 | `…/apk/com.recitingus.app-Signed.apk` | 39 MB | ❌ | 🔴 源码丢失 |
| 签名密钥 | `RecitingUsApp/artifacts/recitingus-signing.keystore` | 2.7 KB，单点 | ❌ | 🔴 |
| 字体 | `resource/wordtype/Regular.ttf` | **25.4 MB** 整字库 | ✅ | 🟠 |
| 背景图 | `resource/background/background.png` | 5.5 MB | ✅ | 🟠 |
| liquid-glass | `app.html:1862` 引用 | **文件不存在** | — | 🔴 断链 |
| PWA 图标 | `config/manifest.json` 引用 8 个 | **全部不存在** | — | 🔴 断链 |

### 2.2 技术栈与版本（从产物程序集实测）

| 组件 | 实测版本 | 目标 |
|---|---|---|
| 运行时 | .NET **10.0.11**（`runtimeconfig.json` tfm=net10.0） | .NET 10 LTS |
| Avalonia | **11.0.0.0** | 11.0.x → 评估升 11.2/11.3 |
| WebView.Avalonia | **11.0.0.1** | 锁定 11.0.x |
| WebView2 (Microsoft.Web.WebView2.Core) | 1.0.x | 随 Evergreen Runtime |
| 目标框架 | 桌面 `net10.0`；Android `net10.0-android` | 同 |
| 发布方式 | 自包含文件夹（**非** SingleFile，libSkiaSharp 约束） | 同 |

### 2.3 前端模块地图（按函数扫描，8059 行拆解）

| 行区间 | 模块 | 关键函数/对象 | 下沉到 C# 的部分 |
|---|---|---|---|
| 1741–1869 | 静态数据 | `JUSHI`(句式)、`CILEI`(词类) | → 数据 JSON / SQLite 种子 |
| 1870–2044 | 基础设施 | `bootApp`、`Store`(localStorage)、`UserDataAPI`、`fileMap`、`_CRITICAL_KEYS` | `Store`→数据服务；`UserDataAPI`→`/api/userdata` |
| 2045–2132 | 通知 | `buildNotice/pushNotice/showToast/showErrorAlert` | 保留 Web（UI） |
| 2201–2381 | 主题/壁纸 | `applyTheme`、`applyWallpaper`、壁纸定时切换、上传/删除 | 壁纸文件 IO → C# |
| 2406–2535 | 导航/模式 | `hideAllViews`、`setSystemMode`(learn/word/practice/exercise) | 保留 Web |
| 2536–3220 | 课文/字词/作者 | `renderArticleNav`、`renderDynastyNav`、`renderStudyPanel`、`renderText/Translation`、`WORD_DEFS`、`MASTERWORKS` | 数据查询 → C# API |
| 3255–3420 | AI 语法/词类 | `showAIGrammarCheck`、`showAICileiCheck` | AI 调用 → C# `/api/ai-proxy` |
| 3553–3703 | 词语通关游戏 | `wordGame*`、题库 `game.json` | 题库 → JSON；判分保留 Web |
| 3704–4762 | 练习引擎 | 填空/情境/上下句/作者配对/飞花令 | 题目生成保留 Web；**错题**→ C# |
| 4763–4942 | 错题本/重练 | `showWrongBook`、`wrongReviewState` | → SQLite `wrong_book` |
| 4943–5409 | 统计图表 | Canvas `drawLine/Bar/Pie/Heatmap` | 数据 → C# `/api/stats`；绘图保留 Web |
| 5410–5528 | 闪卡(间隔重复) | `flashcardState`、`generateFlashcardQueue`、`syncProgress` | 进度/SRS → SQLite |
| 5529–5631 | 音频 | `loadAudioFiles`、`resolveAudio`、`loadAudio` | 文件列表 → `/api/audio-files` |
| 5576–6708 | TTS 朗读 | `TTS` 对象（speechSynthesis） | **→ 原生 ITtsService（桥接）** |
| 5749–6071 | AI 出题/代理 | `getProxyBase`、`normalizeApiUrl`、aiConfig | → C# 代理 + 密钥保管 |
| 6072–6172 | 数据导出导入 | `exportData/importData` | → C# 文件对话框 + 归档 |
| 6212–6531 | 课文视图/模式 | `selectArticle`、`setArtMode`(仅原文/翻译/字解) | 保留 Web |
| 6971–7360 | 复习卡/链式背诵 | `ReviewCards`、`ChainRecall` | 进度 → SQLite |
| 7296–7346 | 液态玻璃 | `glass*` 系列（依赖缺失的 liquid-glass.js） | **修复断链或移除** |

### 2.4 后端 API 现状（server.ps1 实测端点）

| 方法 | 路径 | 功能 | 现状问题 |
|---|---|---|---|
| GET | `/api/version` | 版本信息 | — |
| GET | `/api/audio-files` | 音频列表 | — |
| POST | `/api/upload-wallpaper` | 壁纸上传（魔数+8MB 校验） | 仅 PS 有 |
| GET | `/api/wallpapers` | 壁纸列表 | — |
| DELETE | `/api/wallpapers/{name}` | 删除壁纸 | 需防路径穿越 |
| POST | `/api/ai-proxy` | AI 转发（域名白名单） | 密钥在前端 |
| GET | `/api/userdata/list` | 用户数据文件列表 | — |
| GET/POST/DELETE | `/api/userdata/file/{name}` | 用户数据读写删 | 文件型，无事务 |
| GET | `/config/*.json`、`/resource/*` | 静态资源 | — |

---

## 3. 目标解决方案结构

```
RecitingUs/                         # 新的解决方案根（纳入 git）
├── RecitingUs.sln
├── Directory.Build.props           # 统一版本/语言版本/可空
├── Directory.Packages.props        # 中央包版本管理 (CPM)
├── build/
│   ├── pack.ps1                    # 一键构建三端
│   ├── sign-android.ps1            # APK 签名
│   ├── subset-font.py              # 字体子集化
│   └── stamp-version.ps1           # 从 git tag 注入版本号
├── src/
│   ├── RecitingUs.Core/            # net10.0；平台无关：服务器/服务/数据/模型/资产
│   │   ├── RecitingUs.Core.csproj
│   │   ├── Assets/                 # wwwroot 源（app.html, js, assets, config）
│   │   ├── Hosting/
│   │   │   ├── EmbeddedHttpServer.cs
│   │   │   ├── Router.cs
│   │   │   ├── StaticAssetResolver.cs   # 内嵌优先 + 外置覆盖 + ETag
│   │   │   ├── Middleware/              # 管道中间件
│   │   │   │   ├── CompressionMiddleware.cs   # gzip 响应压缩
│   │   │   │   ├── CspMiddleware.cs           # Content-Security-Policy
│   │   │   │   ├── LoggingMiddleware.cs       # 请求日志
│   │   │   │   └── RateLimitMiddleware.cs     # AI 代理限流
│   │   │   ├── ApiResponse.cs
│   │   │   └── HealthCheck.cs
│   │   ├── Services/
│   │   │   ├── IWallpaperService.cs / WallpaperService.cs
│   │   │   ├── IAudioService.cs     / AudioService.cs
│   │   │   ├── IAiProxyService.cs  / AiProxyService.cs   # + 断路器
│   │   │   ├── IUserDataService.cs / UserDataService.cs
│   │   │   ├── IStatsService.cs    / StatsService.cs
│   │   │   ├── ITtsService.cs      # 抽象，平台实现
│   │   │   └── CircuitBreaker.cs   # AI 代理断路器
│   │   ├── Data/
│   │   │   ├── AppDb.cs            # SQLite (Microsoft.Data.Sqlite) + WAL + 连接池
│   │   │   ├── Migrations/
│   │   │   └── Repositories/       # Progress/WrongBook/Stats/Flashcard
│   │   ├── Models/                 # Article/Poem/Exercise/UserProfile…
│   │   ├── Content/                # 课文 JSON 加载与查询
│   │   │   └── ContentCatalog.cs
│   │   ├── Diagnostics/
│   │   │   ├── AppLogger.cs        # 结构化日志（文件轮转）
│   │   │   └── DebugOverlay.cs     # 诊断信息覆盖层
│   │   └── Platform/               # 平台抽象（路径、安全区、文件选择）
│   │       └── IPlatformServices.cs
│   ├── RecitingUs.App/             # net10.0 桌面
│   │   ├── RecitingUs.App.csproj
│   │   ├── App.axaml(.cs)
│   │   ├── MainWindow.axaml(.cs)
│   │   ├── MainView.axaml(.cs)     # 共享 WebView 宿主
│   │   └── Platforms/Windows/
│   │       ├── WindowsTtsService.cs
│   │       ├── WindowsPlatformServices.cs
│   │       └── WebView2Checker.cs  # 运行时检测与引导安装
│   ├── RecitingUs.Android/         # net10.0-android
│   │   ├── RecitingUs.Android.csproj
│   │   ├── MainActivity.cs
│   │   ├── Platforms/Android/
│   │   │   ├── AndroidTtsService.cs
│   │   │   └── AndroidPlatformServices.cs
│   │   └── Resources/              # mipmap/ic_launcher、styles、manifest
│   └── RecitingUs.Tests/           # xUnit 单元测试
├── installer/
│   ├── setup.iss                   # Inno Setup 7
│   └── app.ico
└── web/                            # 前端源（从 app.html 拆分治理）
    ├── app.html
    ├── css/app.css
    ├── js/
    │   ├── store.js  api.js  tts.js  charts.js  exercises.js
    │   ├── feihua.js  flashcard.js  stats.js  wallpaper.js  ai.js
    │   ├── error-boundary.js        # 全局错误捕获
    │   └── boot.js
    ├── config/*.json
    └── assets/                     # 子集字体 woff2、webp 图片、svg
```

### 3.1 `Directory.Build.props`（统一约束）

```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>13.0</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>false</TreatWarningsAsErrors>
    <Version>2.0.0</Version>
    <Company>RecitingUs</Company>
    <Product>背书哇</Product>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
    <Deterministic>true</Deterministic>
    <ContinuousIntegrationBuild Condition="'$(GITHUB_ACTIONS)' == 'true'">true</ContinuousIntegrationBuild>
  </PropertyGroup>
</Project>
```

### 3.2 `Directory.Packages.props`（中央包版本管理）

```xml
<Project>
  <ItemGroup>
    <PackageVersion Include="Microsoft.Data.Sqlite" Version="10.0.0" />
    <PackageVersion Include="Avalonia" Version="11.0.0" />
    <PackageVersion Include="Avalonia.Desktop" Version="11.0.0" />
    <PackageVersion Include="Avalonia.Themes.Fluent" Version="11.0.0" />
    <PackageVersion Include="Avalonia.Fonts.Inter" Version="11.0.0" />
    <PackageVersion Include="Avalonia.Android" Version="11.0.0" />
    <PackageVersion Include="WebView.Avalonia" Version="11.0.0.1" />
    <PackageVersion Include="WebView.Avalonia.Desktop" Version="11.0.0.1" />
    <PackageVersion Include="WebView.Avalonia.Android" Version="11.0.0.1" />
    <PackageVersion Include="xunit" Version="2.9.2" />
    <PackageVersion Include="xunit.runner.visualstudio" Version="2.8.2" />
  </ItemGroup>
</Project>
```

### 3.3 核心工程职责

| 工程 | TFM | 职责 | 关键依赖 |
|---|---|---|---|
| **RecitingUs.Core** | `net10.0` | HTTP 服务器、API 服务、SQLite、内容加载、嵌入资产、平台抽象、日志 | `Microsoft.Data.Sqlite`、`System.Text.Json`、`Avalonia`（仅共享 MainView 所需） |
| **RecitingUs.App** | `net10.0` | 桌面 Window、WebView2 宿主、Windows 平台实现 | `Avalonia.Desktop`、`WebView.Avalonia.Desktop`、Core |
| **RecitingUs.Android** | `net10.0-android` | Activity、原生 WebView、Android 平台实现（TTS/返回键） | `Avalonia.Android`、`WebView.Avalonia.Android`、Core（链接共享 XAML/CS） |
| **RecitingUs.Tests** | `net10.0` | 服务/路由/数据迁移单元测试 | `xUnit`、Core |

---

## 4. 源码恢复工程（Wave 0，最高优先级）

### 4.1 恢复流程（从现存程序集）

1. **ILSpy 反编译**（命令行 `ilspycmd`）：
   ```powershell
   dotnet tool install -g ilspycmd
   ilspycmd "RecitingUsApp\artifacts\desktop\win-x64\RecitingUs.Core.dll" -p -o src\_recovered\Core
   ilspycmd "RecitingUsApp\artifacts\desktop\win-x64\RecitingUs.dll"      -p -o src\_recovered\App
   ```
2. **提取嵌入资源**：`RecitingUs.Core.dll` 内的 wwwroot（app.html/config/resource）用 `dotnet` 脚本枚举 `ManifestResourceNames` 并落盘到 `web/`。
3. **资源漂移校验（v3 新增）**：将提取的 wwwroot 与 `Memorization UI/app.html` 做 diff，确认二者是否一致。若不一致，以 `Memorization UI/` 为准（因为它是开发源），记录差异原因。
4. **重建工程文件**：以 §3 结构新建干净 csproj，把反编译结果按命名空间归位（反编译仅作参考，关键类按本蓝图重写）。
5. **当日入库**：`git add src/ web/ build/ installer/ && git commit`。规则：**可编译代码当天必须入库**；`*.keystore` 入 `.gitignore`。
6. **密钥备份**：`recitingus-signing.keystore` 立即复制到 ≥2 处（网盘 + 其他盘），口令改由环境变量 `RECITINGUS_KEYSTORE_PASS` 注入。

### 4.2 `RecitingUs.Core.csproj`（v3 修正嵌入式资源语法）

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <RootNamespace>RecitingUs.Core</RootNamespace>
    <AssemblyName>RecitingUs.Core</AssemblyName>
    <GenerateEmbeddedFilesManifest>true</GenerateEmbeddedFilesManifest>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.Data.Sqlite" />
    <PackageReference Include="Avalonia" />
  </ItemGroup>

  <!-- v3 修正：使用标准 EmbeddedFile 而非非标准 LogicalPath -->
  <!-- 构建前由 pack.ps1 将 web/ 同步到 Assets/wwwroot/ -->
  <ItemGroup>
    <EmbeddedFiles Include="Assets\wwwroot\**\*" />
  </ItemGroup>
</Project>
```

> **v2 问题说明**：v2 使用 `<EmbeddedResource Include="..." LogicalPath="...">`，但 `LogicalPath` 不是 MSBuild 内置元数据，`GetManifestResourceStream` 无法按预期名称解析。v3 改用 `Microsoft.Extensions.FileProviders.Embedded` 的 `GenerateEmbeddedFilesManifest` + `<EmbeddedFiles>` 标准方案，资源名格式为 `RecitingUs.Core.Assets.wwwroot.app.html`，可通过 `ManifestResourceNames` 稳定查找。

### 4.3 `RecitingUs.App.csproj`（桌面）

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <ApplicationIcon>app.ico</ApplicationIcon>
    <RuntimeIdentifiers>win-x64</RuntimeIdentifiers>
    <SelfContained>true</SelfContained>
    <PublishSingleFile>false</PublishSingleFile>   <!-- libSkiaSharp 约束：必须文件夹发布 -->
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Avalonia.Desktop" />
    <PackageReference Include="Avalonia.Themes.Fluent" />
    <PackageReference Include="Avalonia.Fonts.Inter" />
    <PackageReference Include="WebView.Avalonia" />
    <PackageReference Include="WebView.Avalonia.Desktop" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\RecitingUs.Core\RecitingUs.Core.csproj" />
  </ItemGroup>
</Project>
```

### 4.4 `RecitingUs.Android.csproj`（移动）

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0-android</TargetFramework>
    <OutputType>Exe</OutputType>
    <RootNamespace>RecitingUs.App</RootNamespace>
    <AssemblyName>RecitingUs</AssemblyName>
    <ApplicationId>com.recitingus.app</ApplicationId>
    <ApplicationTitle>背书哇</ApplicationTitle>
    <ApplicationDisplayVersion>2.0.0</ApplicationDisplayVersion>
    <ApplicationVersion>2</ApplicationVersion>
    <SupportedOSPlatformVersion>21</SupportedOSPlatformVersion>
    <AndroidSupportedAbis>arm64-v8a</AndroidSupportedAbis>   <!-- 减包：仅 arm64 -->
    <AndroidManifest>..\RecitingUs.App\Platforms\Android\AndroidManifest.xml</AndroidManifest>
    <AndroidEnableProfiledAot>false</AndroidEnableProfiledAot>
    <_DisableParallelAot>true</_DisableParallelAot>
    <TrimMode>partial</TrimMode>
    <AvaloniaUseCompiledBindingsByDefault>true</AvaloniaUseCompiledBindingsByDefault>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Avalonia.Android" />
    <PackageReference Include="Avalonia.Themes.Fluent" />
    <PackageReference Include="WebView.Avalonia" />
    <PackageReference Include="WebView.Avalonia.Android" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\RecitingUs.Core\RecitingUs.Core.csproj" />
  </ItemGroup>
  <!-- 链接共享 App 的 XAML/CS（MainView），桌面专用 MainWindow 不参与 -->
  <ItemGroup>
    <AvaloniaXaml Include="..\RecitingUs.App\App.axaml" Link="App.axaml" />
    <AvaloniaXaml Include="..\RecitingUs.App\MainView.axaml" Link="MainView.axaml" />
    <Compile Include="..\RecitingUs.App\App.axaml.cs" Link="App.axaml.cs" />
    <Compile Include="..\RecitingUs.App\MainView.axaml.cs" Link="MainView.axaml.cs" />
    <Compile Include="MainActivity.cs" Link="MainActivity.cs" />
  </ItemGroup>
</Project>
```

### 4.5 应用入口与 Lifetime 分支（避免历史坑）

```csharp
// App.axaml.cs
public partial class App : Avalonia.Application
{
    public override void Initialize() => AvaloniaXamlLoader.Load(this);

    public override void RegisterServices()
    {
        base.RegisterServices();
        AvaloniaWebViewBuilder.Initialize(default);   // 跨平台 WebView 服务
    }

    public override void OnFrameworkInitializationCompleted()
    {
        // 关键：Android 单视图，桌面 Window；Android 上 new Window() 会抛 NotSupportedException
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
            desktop.MainWindow = new MainWindow();
        else if (ApplicationLifetime is ISingleViewApplicationLifetime single)
            single.MainView = new MainView();
        base.OnFrameworkInitializationCompleted();
    }
}
```

```csharp
// MainView.axaml.cs —— 共享：启动服务器 + 加载页面
public partial class MainView : UserControl
{
    public MainView()
    {
        InitializeComponent();
        var server = EmbeddedHttpServer.Instance;
        server.Start(preferredPort: 8000);          // 端口占用自动 +1
        WebViewControl.Url = new Uri(server.BaseUrl + "app.html");
    }
}
```

> **v3 补充——Android 生命周期绑定**：Android Activity 在 `OnPause`/`OnDestroy` 时应暂停/停止 HTTP 服务器，避免后台占用端口和资源；`OnResume` 时恢复。桌面端在 `Window.Closed` 事件中调用 `server.Stop()`。

```csharp
// Android MainActivity.cs —— 返回键用 BackRequested（勿 override OnBackPressed）
[Activity(Label = "背书哇", MainLauncher = true, Theme = "@style/MyTheme",
          ConfigurationChanges = ConfigChanges.Orientation | ConfigChanges.ScreenSize)]
public class MainActivity : AvaloniaMainActivity<App>
{
    protected override AppBuilder CustomizeAppBuilder(AppBuilder b) =>
        b.UseAndroidWebView();

    protected override void OnCreate(Bundle? s)
    {
        base.OnCreate(s);
        BackRequested += (_, e) =>
        {
            // WebView 可后退则后退，否则最小化（不直接退出）
            if (WebViewHost.CanGoBack) { WebViewHost.GoBack(); e.Handled = true; }
        };
    }

    // v3 新增：生命周期与服务器绑定
    protected override void OnPause()
    {
        base.OnPause();
        EmbeddedHttpServer.Instance.Pause();  // 停止接受新请求，等待在途完成
    }

    protected override void OnResume()
    {
        base.OnResume();
        EmbeddedHttpServer.Instance.Resume();
    }
}
```

> Android 主题 `styles.xml` 的 `MyTheme` parent 必须是 `Theme.AppCompat.Light.NoActionBar`（Avalonia Activity 基于 AppCompatActivity，否则启动崩 `You need to use a Theme.AppCompat theme`）。

---

## 5. C# 后端服务设计（全面替代 PowerShell）

### 5.1 嵌入式 HTTP 服务器（v3 修正并发模型）

**v2 问题**：`LoopAsync` 中 `_ = Task.Run(() => Router.DispatchAsync(ctx))` 对每个请求无限制地创建 Task，高并发下线程池可能耗尽。虽然本应用并发量低，但应从设计上杜绝隐患。

**v3 方案**：使用 `SemaphoreSlim` 限制并发请求数（桌面 8、Android 4），超出时排队等待。

```csharp
public sealed class EmbeddedHttpServer
{
    public static EmbeddedHttpServer Instance { get; } = new();
    public string BaseUrl => $"http://127.0.0.1:{_port}/";

    private HttpListener? _listener;
    private int _port;
    private readonly SemaphoreSlim _concurrencyLimiter =
        new(Environment.ProcessorCount * 2, Environment.ProcessorCount * 2);
    private volatile bool _paused;

    public void Start(int preferredPort)
    {
        for (_port = preferredPort; _port < preferredPort + 50; _port++)
        {
            try
            {
                _listener = new HttpListener();
                _listener.Prefixes.Add($"http://127.0.0.1:{_port}/");
                _listener.Start();
                break;
            }
            catch (HttpListenerException)
            {
                _listener?.Close();
                _listener = null;
            }
        }

        if (_listener is null)
            throw new InvalidOperationException("无法在指定端口范围启动 HTTP 服务器");

        _ = LoopAsync();
    }

    private async Task LoopAsync()
    {
        while (_listener!.IsListening)
        {
            var ctx = await _listener.GetContextAsync();

            // v3: 暂停状态下拒绝新请求
            if (_paused)
            {
                ctx.Response.StatusCode = 503;
                ctx.Response.Close();
                continue;
            }

            // v3: 有界并发，避免线程池耗尽
            _ = ProcessRequestAsync(ctx);
        }
    }

    private async Task ProcessRequestAsync(HttpListenerContext ctx)
    {
        await _concurrencyLimiter.WaitAsync();
        try
        {
            // 中间件管道：日志 → CSP → 压缩 → 限流 → 路由
            await Router.DispatchAsync(ctx);
        }
        catch (Exception ex)
        {
            AppLogger.Error("请求处理异常", ex);
            ApiResponse.Error(ctx.Response, 500, "internal error");
        }
        finally
        {
            _concurrencyLimiter.Release();
            ctx.Response.Close();
        }
    }

    public void Pause() => _paused = true;
    public void Resume() => _paused = false;

    public void Stop()
    {
        _listener?.Stop();
        _listener?.Close();
        _listener = null;
    }
}
```

### 5.2 中间件管道（v3 新增）

```csharp
// 路由调度入口，按顺序执行中间件
public static class Router
{
    public static async Task DispatchAsync(HttpListenerContext ctx)
    {
        var path = ctx.Request.Url!.AbsolutePath;

        // 1) 请求日志
        LoggingMiddleware.Log(ctx);

        // 2) CSP 安全头（所有响应）
        CspMiddleware.Apply(ctx.Response);

        // 3) AI 代理限流
        if (path.StartsWith("/api/ai-proxy"))
        {
            if (!await RateLimitMiddleware.TryAcquireAsync("ai-proxy",
                    maxRequests: 10, windowSeconds: 60))
            {
                ApiResponse.Error(ctx.Response, 429, "rate limit exceeded");
                return;
            }
        }

        // 4) 路由匹配
        if (path.StartsWith("/api/"))
            await ApiRouteTable.DispatchAsync(ctx);
        else
            await ServeStaticAsset(ctx);
    }

    private static async Task ServeStaticAsset(HttpListenerContext ctx)
    {
        var path = ctx.Request.Url!.AbsolutePath.TrimStart('/');
        var stream = StaticAssetResolver.Open(path, out var mime, out var etag);

        // v3: ETag 缓存校验
        if (etag is not null && ctx.Request.Headers["If-None-Match"] == etag)
        {
            ctx.Response.StatusCode = 304;
            return;
        }

        if (stream is null)
        {
            ctx.Response.StatusCode = 404;
            return;
        }

        ctx.Response.ContentType = mime;
        if (etag is not null)
            ctx.Response.Headers["ETag"] = etag;

        // v3: 静态资源长期缓存（内容变更通过文件哈希自动更新 ETag）
        ctx.Response.Headers["Cache-Control"] = "public, max-age=3600";

        // v3: gzip 压缩（文本类资源）
        if (ShouldCompress(mime) && ctx.Request.Headers["Accept-Encoding"]?.Contains("gzip") == true)
        {
            ctx.Response.Headers["Content-Encoding"] = "gzip";
            using var gzip = new GZipStream(ctx.Response.OutputStream, CompressionMode.Compress);
            await stream.CopyToAsync(gzip);
        }
        else
        {
            await stream.CopyToAsync(ctx.Response.OutputStream);
        }
    }

    private static bool ShouldCompress(string mime) =>
        mime.StartsWith("text/") || mime.Contains("json") || mime.Contains("javascript");
}
```

### 5.3 静态资源：内嵌优先 + 外置覆盖 + ETag（v3 增强）

```csharp
public static class StaticAssetResolver
{
    // 1) 外置覆盖目录（开发热更，免重编）：
    //    Win: %LOCALAPPDATA%\Programs\RecitingUs\ResourceOverride\
    //    Android: <filesDir>/ResourceOverride/
    // 2) 否则返回程序集内嵌 wwwroot 快照
    public static Stream? Open(string path, out string mime, out string? etag)
    {
        var safe = Normalize(path);                       // 防路径穿越
        etag = null;

        // 外置覆盖
        var overridePath = Path.Combine(Platform.OverrideDir, safe);
        if (File.Exists(overridePath))
        {
            etag = ComputeEtag(overridePath);
            mime = MimeMap.For(safe);
            return File.OpenRead(overridePath);
        }

        // 内嵌资源（v3 修正资源名格式）
        var asm = typeof(StaticAssetResolver).Assembly;
        var resourceName = $"RecitingUs.Core.Assets.wwwroot.{safe.Replace('/', '.')}";
        var name = asm.GetManifestResourceNames()
                      .FirstOrDefault(n => n == resourceName);
        if (name is null) { mime = "application/octet-stream"; return null; }

        etag = $"\"{name.GetHashCode():x}\"";   // 内嵌资源用程序集版本作为 ETag
        mime = MimeMap.For(safe);
        return asm.GetManifestResourceStream(name);
    }

    private static string Normalize(string p) =>
        Path.GetFileName(p.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));

    private static string ComputeEtag(string filePath)
    {
        var lastWrite = File.GetLastWriteTimeUtc(filePath).Ticks;
        var len = new FileInfo(filePath).Length;
        return $"\"{len:x}-{lastWrite:x}\"";
    }
}
```

> **价值**：前端改 `app.html` 后，桌面只需把文件放进 `ResourceOverride/` 立即生效；Android 可 `adb push` 调试。正式发版把 `web/` 编译进程序集。ETag 让浏览器缓存命中时仅返回 304，减少本地回环流量。

### 5.4 完整 API 契约（v2 + v3 补充错误码）

| 方法 | 路径 | 请求 | 响应 | 说明 |
|---|---|---|---|---|
| GET | `/api/version` | — | `{version,channel,releasedAt,notes}` | 版本 |
| GET | `/api/health` | — | `{status:"ok",uptime,dbVersion}` | **v3 新增：健康检查** |
| GET | `/api/content/articles` | — | `Article[]` | 课文目录（替代前端内嵌） |
| GET | `/api/content/article/{id}` | — | `ArticleDetail` | 原文/译文/注释/赏析 |
| GET | `/api/content/poems`、`/games`、`/writers` | — | JSON | 其余数据 JSON |
| GET | `/api/wallpapers` | — | `{files:[{name,url,size}]}` | 壁纸列表 |
| POST | `/api/upload-wallpaper` | multipart | `{ok,name}` | 魔数校验 + ≤8MB |
| DELETE | `/api/wallpapers/{name}` | — | `{ok}` | `GetFileName` 防穿越 |
| GET | `/api/audio-files` | — | `{files:[{name,url}]}` | 音频 |
| POST | `/api/ai-proxy` | `{provider,endpoint,model,messages,…}`（**不含 key**） | 透传上游或 `{ok:false,error}` | key 由 C# 安全存储注入；**限流 10 次/分钟** |
| GET | `/api/userdata/list` | — | `{files:[…]}` | 多用户 profile |
| GET/PUT/DELETE | `/api/userdata/file/{name}` | JSON 体 | `{ok}` | 落 SQLite/文件 |
| GET | `/api/progress` | — | `ProgressRecord[]` | 学习进度（SRS） |
| POST | `/api/progress` | `ProgressRecord` | `{ok}` | 上报进度 |
| GET | `/api/wrong-book` | — | `WrongItem[]` | 错题本 |
| POST | `/api/wrong-book` | `WrongItem` | `{ok}` | 加错题 |
| DELETE | `/api/wrong-book/{id}` | — | `{ok}` | 移除/已掌握 |
| GET | `/api/stats?from&to` | — | `StatsPoint[]` | 统计图表数据源 |
| POST | `/api/tts/speak` | `{text,rate,voice?}` | 204（原生朗读） | 走 ITtsService |
| POST | `/api/tts/stop` | — | 204 | 停止 |
| GET | `/api/tts/voices` | — | `{voices:[{id,name,lang}]}` | **v3 新增：可用语音列表** |
| POST | `/api/export` | — | 文件流（.json 归档） | 全量导出 |
| POST | `/api/import` | 归档文件 | `{ok,summary}` | 导入 + schema 迁移（原子事务） |

**统一错误码（v3 新增）**：

| HTTP | code 字段 | 含义 |
|---|---|---|
| 400 | `BAD_REQUEST` | 参数缺失/格式错误 |
| 403 | `FORBIDDEN_HOST` | AI 代理域名不在白名单 |
| 404 | `NOT_FOUND` | 资源/记录不存在 |
| 409 | `CONFLICT` | 版本冲突（导入时 schema 不兼容） |
| 429 | `RATE_LIMITED` | AI 代理限流 |
| 503 | `CIRCUIT_OPEN` | AI 代理断路器开启（上游不可用） |
| 500 | `INTERNAL` | 服务器内部错误 |

```csharp
public static class ApiResponse
{
    public static void Json(HttpListenerResponse r, object obj, int code = 200)
    {
        r.StatusCode = code;
        r.ContentType = "application/json; charset=utf-8";
        var json = JsonSerializer.Serialize(obj);
        var bytes = Encoding.UTF8.GetBytes(json);
        r.ContentLength64 = bytes.Length;
        r.OutputStream.Write(bytes, 0, bytes.Length);
    }

    public static void Error(HttpListenerResponse r, int code, string msg, string? errorCode = null) =>
        Json(r, new { ok = false, error = msg, errorCode = errorCode ?? DefaultErrorCode(code) }, code);

    private static string DefaultErrorCode(int code) => code switch
    {
        400 => "BAD_REQUEST",
        403 => "FORBIDDEN",
        404 => "NOT_FOUND",
        429 => "RATE_LIMITED",
        503 => "CIRCUIT_OPEN",
        _ => "INTERNAL"
    };
}
```

### 5.5 AI 代理：密钥保管 + 限流 + 断路器（v3 大幅增强）

```csharp
public sealed class AiProxyService(IPlatformServices plat) : IAiProxyService
{
    private static readonly string[] AllowedHosts =
        { "api.openai.com","api.deepseek.com","api.siliconflow.cn",
          "dashscope.aliyuncs.com","open.bigmodel.cn","api.moonshot.cn","api.moonshot.com" };

    // v3: 断路器 —— 连续失败 5 次后熔断 60 秒
    private static readonly CircuitBreaker _breaker = new(
        failureThreshold: 5, openDurationSeconds: 60);

    public async Task<(int status, string body)> ForwardAsync(AiRequest req, CancellationToken ct)
    {
        // 1) 断路器检查
        if (_breaker.IsOpen)
            return (503, """{"ok":false,"error":"circuit breaker open","errorCode":"CIRCUIT_OPEN"}""");

        // 2) 域名白名单
        var uri = new Uri(req.Endpoint);
        if (!AllowedHosts.Contains(uri.Host) && !plat.IsAllowedAiHost(uri.Host))
            return (403, """{"ok":false,"error":"host not allowed","errorCode":"FORBIDDEN_HOST"}""");

        // 3) 密钥从原生安全存储获取（绝不进前端）
        var key = plat.GetSecret("ai:" + req.Provider);
        if (string.IsNullOrEmpty(key))
            return (500, """{"ok":false,"error":"api key not configured","errorCode":"NO_KEY"}""");

        // 4) 转发（超时 30s）
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        using var up = new HttpRequestMessage(HttpMethod.Post, uri)
        {
            Content = JsonContent.Create(req with { ApiKey = key })
        };
        up.Headers.Add("Authorization", $"Bearer {key}");

        try
        {
            var resp = await http.SendAsync(up, ct);
            _breaker.RecordSuccess();
            return ((int)resp.StatusCode, await resp.Content.ReadAsStringAsync(ct));
        }
        catch (TaskCanceledException)
        {
            _breaker.RecordFailure();
            return (504, """{"ok":false,"error":"upstream timeout","errorCode":"TIMEOUT"}""");
        }
        catch (HttpRequestException ex)
        {
            _breaker.RecordFailure();
            AppLogger.Error("AI 代理请求失败", ex);
            return (502, """{"ok":false,"error":"upstream error","errorCode":"BAD_GATEWAY"}""");
        }
    }
}
```

```csharp
// v3 新增：断路器
public sealed class CircuitBreaker(int failureThreshold, int openDurationSeconds)
{
    private int _failures;
    private DateTime _openedAt = DateTime.MinValue;
    private readonly object _lock = new();

    public bool IsOpen
    {
        get
        {
            lock (_lock)
            {
                if (_failures < failureThreshold) return false;
                if ((DateTime.UtcNow - _openedAt).TotalSeconds < openDurationSeconds) return true;
                // 超时后半开
                _failures = 0;
                return false;
            }
        }
    }

    public void RecordSuccess() { lock (_lock) _failures = 0; }

    public void RecordFailure()
    {
        lock (_lock)
        {
            _failures++;
            if (_failures >= failureThreshold)
                _openedAt = DateTime.UtcNow;
        }
    }
}
```

```csharp
// v3 新增：令牌桶限流
public sealed class TokenBucketRateLimiter
{
    private readonly SemaphoreSlim _semaphore;
    private readonly Timer _refillTimer;
    private readonly int _maxTokens;
    private int _currentTokens;

    public TokenBucketRateLimiter(int maxTokens, TimeSpan refillInterval)
    {
        _maxTokens = maxTokens;
        _currentTokens = maxTokens;
        _semaphore = new SemaphoreSlim(maxTokens, maxTokens);
        _refillTimer = new Timer(_ => Refill(), null, refillInterval, refillInterval);
    }

    public async Task<bool> TryAcquireAsync(TimeSpan timeout)
    {
        return await _semaphore.WaitAsync(timeout);
    }

    private void Refill()
    {
        var toAdd = _maxTokens - _currentTokens;
        if (toAdd <= 0) return;
        _currentTokens = _maxTokens;
        _semaphore.Release(toAdd);
    }
}
```

---

## 6. 数据层设计

### 6.1 选型

- **结构化数据**（进度、错题、统计、闪卡 SRS、用户配置）→ **SQLite**（`Microsoft.Data.Sqlite`），位于平台 App 数据目录。事务、索引、可查询，替代 localStorage 的容量与并发短板。
- **内容数据**（课文/诗词/题目）→ 只读 JSON 种子，随资产发布；运行期经 `ContentCatalog` 查询。
- **大文件**（壁纸、音频）→ 文件系统，DB 只存元数据。
- **UI 偏好**（主题、字号）→ 仍可 localStorage，但关键状态同步到 `/api/progress`。

### 6.2 SQLite 配置（v3 新增 WAL + 连接池）

```csharp
public sealed class AppDb : IDisposable
{
    private readonly string _connectionString;
    private readonly SemaphoreSlim _writeLock = new(1, 1);  // 写串行化

    public AppDb(string dbPath)
    {
        _connectionString = $"Data Source={dbPath};Cache=Shared;Mode=ReadWriteCreate";
        Initialize();
    }

    private void Initialize()
    {
        using var conn = new SqliteConnection(_connectionString);
        conn.Open();

        // v3: 启用 WAL 模式 —— 读写不互斥，并发性能提升
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "PRAGMA journal_mode=WAL;";
            cmd.ExecuteScalar();
        }
        // v3: 正常同步级别（性能与安全的平衡）
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "PRAGMA synchronous=NORMAL;";
            cmd.ExecuteScalar();
        }
        // v3: 外键约束
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "PRAGMA foreign_keys=ON;";
            cmd.ExecuteScalar();
        }

        RunMigrations(conn);
    }

    // v3: 写操作统一加锁，保证事务隔离
    public async Task<int> ExecuteWriteAsync(string sql, params (string, object)[] parameters)
    {
        await _writeLock.WaitAsync();
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            foreach (var (name, value) in parameters)
                cmd.Parameters.AddWithValue(name, value);
            return await cmd.ExecuteNonQueryAsync();
        }
        finally { _writeLock.Release(); }
    }

    // v3: 读操作无锁（WAL 模式下读写不互斥）
    public async Task<List<T>> ExecuteReadAsync<T>(string sql,
        Func<SqliteDataReader, T> map, params (string, object)[] parameters)
    {
        using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        foreach (var (name, value) in parameters)
            cmd.Parameters.AddWithValue(name, value);
        using var reader = await cmd.ExecuteReaderAsync();
        var results = new List<T>();
        while (await reader.ReadAsync())
            results.Add(map(reader));
        return results;
    }

    public void Dispose() => _writeLock.Dispose();
}
```

### 6.3 SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS profile (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL, article_id TEXT NOT NULL,
  mode TEXT NOT NULL,                 -- learn/practice/flashcard…
  recited INTEGER NOT NULL DEFAULT 0, -- 已背诵
  mastery INTEGER NOT NULL DEFAULT 0, -- 0-5 SRS 等级
  due_at INTEGER, last_review INTEGER, review_count INTEGER DEFAULT 0,
  UNIQUE(profile_id, article_id, mode),
  FOREIGN KEY (profile_id) REFERENCES profile(id));

CREATE TABLE IF NOT EXISTS wrong_book (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL, article_id TEXT, type TEXT NOT NULL,  -- blank/match/feihua…
  prompt TEXT NOT NULL, answer TEXT, user_answer TEXT,
  mastered INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
  FOREIGN KEY (profile_id) REFERENCES profile(id));
CREATE INDEX IF NOT EXISTS idx_wrong_profile ON wrong_book(profile_id, mastered);

CREATE TABLE IF NOT EXISTS stats_daily (
  profile_id TEXT NOT NULL, day TEXT NOT NULL,   -- yyyy-MM-dd
  practice_count INTEGER DEFAULT 0, correct_count INTEGER DEFAULT 0,
  study_seconds INTEGER DEFAULT 0, articles_read INTEGER DEFAULT 0,
  PRIMARY KEY(profile_id, day),
  FOREIGN KEY (profile_id) REFERENCES profile(id));

CREATE TABLE IF NOT EXISTS flashcard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL, article_id TEXT NOT NULL,
  front TEXT, back TEXT, ease REAL DEFAULT 2.5, interval_days REAL DEFAULT 0,
  due_at INTEGER, last_review INTEGER,
  FOREIGN KEY (profile_id) REFERENCES profile(id));

CREATE TABLE IF NOT EXISTS kv_store (           -- 兼容旧 userdata 文件
  profile_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
  updated_at INTEGER NOT NULL, PRIMARY KEY(profile_id, key));

-- v3 新增：迁移版本表
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL);
INSERT OR IGNORE INTO schema_version VALUES (1, strftime('%s','now'));
```

### 6.4 数据模型（C#）

```csharp
public sealed record Article(string Id, string Title, string Author, string AuthorId,
    string Cat, string? Audio, string Text);

public sealed record ArticleDetail(Article Article, string? Translation,
    IReadOnlyList<Note> Notes, string? Appreciation);

public sealed record Note(int Id, string Term, string Explain);

public sealed record ProgressRecord(string ProfileId, string ArticleId, string Mode,
    bool Recited, int Mastery, DateTime? DueAt, DateTime? LastReview, int ReviewCount);

public sealed record WrongItem(long? Id, string ProfileId, string? ArticleId, string Type,
    string Prompt, string? Answer, string? UserAnswer, bool Mastered, DateTime CreatedAt);

public sealed record StatsPoint(string Day, int Practice, int Correct, int StudySeconds, int ArticlesRead);
```

### 6.5 localStorage → 服务端迁移（v3 增强原子性）

**v2 问题**：迁移只是"打包 POST"，如果 C# 端写入到一半失败，数据会处于半迁移状态。

**v3 方案**：C# 端在**单个 SQLite 事务**中完成全部导入，失败则整体回滚，前端 `migrated_v2` 标志仅在收到 200 后才写入。

```csharp
public sealed class MigrationService(AppDb db)
{
    private const int EXPORT_SCHEMA_VERSION = 1;

    public async Task<MigrationSummary> ImportAsync(Stream archiveStream)
    {
        var archive = await JsonSerializer.DeserializeAsync<ExportArchive>(archiveStream)
            ?? throw new ArgumentException("无效的归档格式");

        if (archive.SchemaVersion > EXPORT_SCHEMA_VERSION)
            throw new InvalidOperationException($"不支持的 schema 版本: {archive.SchemaVersion}");

        // v3: 全量事务 —— 要么全成功，要么全回滚
        using var conn = new SqliteConnection(db.ConnectionString);
        await conn.OpenAsync();
        using var transaction = await conn.BeginTransactionAsync();

        try
        {
            var summary = new MigrationSummary();

            // 导入进度
            if (archive.Progress is not null)
                foreach (var p in archive.Progress)
                    await InsertProgressAsync(conn, transaction, p, summary);

            // 导入错题
            if (archive.WrongBook is not null)
                foreach (var w in archive.WrongBook)
                    await InsertWrongAsync(conn, transaction, w, summary);

            // 导入闪卡
            if (archive.Flashcards is not null)
                foreach (var f in archive.Flashcards)
                    await InsertFlashcardAsync(conn, transaction, f, summary);

            // 导入 KV 存储
            if (archive.KvStore is not null)
                foreach (var kv in archive.KvStore)
                    await InsertKvAsync(conn, transaction, kv, summary);

            await transaction.CommitAsync();
            return summary;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;  // 前端收到 500，migrated_v2 不写入，下次重试
        }
    }
}

public sealed record MigrationSummary(
    int ProgressImported, int WrongBookImported,
    int FlashcardsImported, int KvImported);
```

前端迁移逻辑（增强容错）：

```javascript
// js/migrate.js (v3 新增)
async function migrateLocalStorageToServer() {
    if (localStorage.getItem('migrated_v2') === '1') return;

    const archive = {
        schemaVersion: 1,
        progress: collectProgress(),
        wrongBook: collectWrongBook(),
        flashcards: collectFlashcards(),
        kvStore: collectKvStore()
    };

    // 空归档不需要迁移
    if (Object.values(archive).every(v => !v || v.length === 0)) {
        localStorage.setItem('migrated_v2', '1');
        return;
    }

    try {
        const resp = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(archive)
        });

        if (resp.ok) {
            localStorage.setItem('migrated_v2', '1');
            const summary = await resp.json();
            console.info('[迁移完成]', summary);
        } else {
            console.warn('[迁移失败] HTTP', resp.status, '将在下次启动重试');
        }
    } catch (e) {
        console.warn('[迁移异常]', e.message, '将在下次启动重试');
    }
}
```

---

## 7. 前端（Web UI）治理

### 7.1 拆分（保持"零构建可直开"）

把 8059 行按 §2.3 模块地图拆为 `web/js/*.js`（经典 `<script>` 顺序加载，**不引入 ESM**，以兼容 file:// 直开与 server.ps1）：

```html
<!-- app.html 底部 -->
<script src="js/store.js"></script>      <!-- localStorage + /api 封装 -->
<script src="js/api.js"></script>        <!-- fetch 包装、_url 兼容 -->
<script src="js/error-boundary.js"></script> <!-- v3: 全局错误捕获 -->
<script src="js/content.js"></script>    <!-- 课文/诗词/作者渲染 -->
<script src="js/exercises.js"></script>  <!-- 填空/情境/上下句/配对 -->
<script src="js/feihua.js"></script>     <!-- 飞花令 -->
<script src="js/flashcard.js"></script>  <!-- 闪卡 SRS -->
<script src="js/wrongbook.js"></script>  <!-- 错题本 -->
<script src="js/charts.js"></script>     <!-- Canvas 图表 -->
<script src="js/stats.js"></script>
<script src="js/wallpaper.js"></script>
<script src="js/ai.js"></script>
<script src="js/tts.js"></script>        <!-- 优先原生桥，回退 speechSynthesis -->
<script src="js/migrate.js"></script>    <!-- v3: localStorage 迁移 -->
<script src="js/boot.js"></script>
```

- 所有 `innerHTML` 拼接走统一 `escapeHtml()`（已有 `escapeHtml`，强制全部调用），消除 XSS。
- 数据访问收敛到 `api.js`，UI 不再直接 `fetch`。

### 7.2 v3 新增：模块加载容错与错误边界

```javascript
// js/error-boundary.js
window.addEventListener('error', function(e) {
    console.error('[全局错误]', e.message, e.filename + ':' + e.lineno);
    // 上报到 C# 日志
    fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            level: 'error',
            message: e.message,
            source: e.filename + ':' + e.lineno,
            stack: e.error?.stack
        })
    }).catch(() => {});  // 日志上报失败不阻塞
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('[未捕获 Promise]', e.reason);
});

// 模块加载检查
function checkModulesLoaded() {
    var required = ['Store', 'UserDataAPI', 'bootApp', 'renderArticleNav'];
    var missing = required.filter(function(name) {
        return typeof window[name] === 'undefined';
    });
    if (missing.length > 0) {
        document.body.innerHTML = '<div style="padding:2rem;text-align:center">' +
            '<h2>模块加载失败</h2>' +
            '<p>缺失: ' + missing.join(', ') + '</p>' +
            '<button onclick="location.reload()">重新加载</button>' +
            '</div>';
    }
}
window.addEventListener('DOMContentLoaded', function() {
    setTimeout(checkModulesLoaded, 100);
});
```

### 7.3 资源瘦身

| 资源 | 现状 | 处理 | 目标 |
|---|---|---|---|
| Regular.ttf | 25.4 MB | `pyftsubset` 按 33 篇课文+释义+UI 用字子集化 → woff2 | ≤ 3 MB |
| background.png | 5.5 MB | 转 WebP/AVIF + 降采样；夜间深色版 | ≤ 600 KB |
| PWA 图标 | 断链 | 生成 72/96/128/144/192/384/512 PNG 或修 manifest | 0 断链 |
| liquid-glass.js | **缺失** | 二选一：补文件，或移除 `glass*` 调用回退普通毛玻璃 CSS | 0 控制台 404 |

字体子集脚本（`build/subset-font.py`，v3 修正 API 用法）：

```python
#!/usr/bin/env python3
"""字体子集化：从 Regular.ttf 生成仅含所需字符的 woff2"""
import sys
from pathlib import Path
from fontTools import subset

def collect_chars():
    """收集所有需要保留的字符"""
    chars = set()
    # config/*.json 全文
    for f in Path('web/config').glob('*.json'):
        chars.update(f.read_text(encoding='utf-8'))
    # app.html 可见文案
    chars.update(Path('web/app.html').read_text(encoding='utf-8'))
    # js/*.js 中的中文
    for f in Path('web/js').glob('*.js'):
        chars.update(f.read_text(encoding='utf-8'))
    # 常用 3500 汉字兜底
    chars.update(Path('build/common_3500.txt').read_text(encoding='utf-8'))
    return chars

def main():
    chars = collect_chars()
    options = subset.Options()
    options.flavor = 'woff2'
    options.with_zopfli = True
    options.layout_features = ['*']  # 保留 OpenType 特性

    font = subset.load_font('resource/wordtype/Regular.ttf', options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=''.join(chars))
    subsetter.subset(font)
    subset.save_font(font, 'web/assets/Regular.woff2', options)
    print(f'子集化完成: {len(chars)} 字 → web/assets/Regular.woff2')

if __name__ == '__main__':
    main()
```

> **v2 问题说明**：v2 使用了 `SubsetLoader` 和 `ss.populate` 等非标准 API 名称，实际 fontTools 的正确用法是 `subset.load_font()` + `subset.Subsetter()` + `subsetter.subset(font)` + `subset.save_font()`。

### 7.4 TTS：原生桥优先 + 语音选择（v3 增强）

历史 bug：部分 Android WebView 的 `window.speechSynthesis.cancel/speak` 未实现，抛 `Cannot read properties of undefined (reading 'cancel')`。方案：**C# 原生 TTS** 经 HTTP/桥接提供，Web 端优先调用。

```csharp
// Core 抽象（v3 增加 voice 枚举）
public interface ITtsService {
    void Speak(string text, float rate, string? voiceId = null);
    void Stop();
    bool IsAvailable { get; }
    IReadOnlyList<TtsVoice> GetVoices();
}

public sealed record TtsVoice(string Id, string Name, string Lang);

// Android 实现：Android.Speech.Tts.TextToSpeech（setLanguage zh-CN）
// Windows 实现：Windows.Media.SpeechSynthesis（或 System.Speech）
```

```javascript
// js/tts.js (v3 增强：语音列表 + 队列 + 错误处理)
const TtsState = {
    voices: [],
    speaking: false,
    queue: []
};

async function loadVoices() {
    try {
        const resp = await fetch('/api/tts/voices');
        if (resp.ok) {
            TtsState.voices = (await resp.json()).voices || [];
        }
    } catch(e) {}
    // 回退：Web Speech API 语音
    if (TtsState.voices.length === 0 && 'speechSynthesis' in window) {
        TtsState.voices = speechSynthesis.getVoices()
            .filter(v => v.lang.startsWith('zh'))
            .map(v => ({ id: v.voiceURI, name: v.name, lang: v.lang }));
    }
}

async function speak(text, rate, voiceId) {
    TtsState.queue.push({ text, rate, voiceId });
    if (TtsState.speaking) return;
    TtsState.speaking = true;

    while (TtsState.queue.length > 0) {
        const item = TtsState.queue.shift();
        try {
            // 原生优先
            await fetch('/api/tts/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: item.text, rate: item.rate, voice: item.voiceId })
            });
            continue;  // 原生 TTS 是同步的，返回即完成
        } catch(e) {}
        // 回退 Web Speech
        if ('speechSynthesis' in window) {
            try {
                const utter = new SpeechSynthesisUtterance(item.text);
                utter.rate = item.rate || 1.0;
                utter.lang = 'zh-CN';
                if (item.voiceId) {
                    const v = speechSynthesis.getVoices()
                        .find(v => v.voiceURI === item.voiceId);
                    if (v) utter.voice = v;
                }
                await new Promise(resolve => {
                    utter.onend = resolve;
                    utter.onerror = resolve;
                    speechSynthesis.speak(utter);
                });
            } catch(e) {
                console.warn('[TTS 回退失败]', e.message);
            }
        }
    }
    TtsState.speaking = false;
}

async function stopSpeak() {
    TtsState.queue = [];
    TtsState.speaking = false;
    try { await fetch('/api/tts/stop', { method: 'POST' }); } catch(e) {}
    if ('speechSynthesis' in window) {
        try { speechSynthesis.cancel(); } catch(e) {}
    }
}
```

---

## 8. 跨平台专项

### 8.1 Windows 桌面

- 发布：自包含 **文件夹**（非 SingleFile，规避 `libSkiaSharp.dll` 加载失败）。
- 安装：Inno Setup，`DefaultDirName={localappdata}\Programs\RecitingUs`、`PrivilegesRequired=lowest`（装 Program Files 会黑屏）、`Excludes: "*.WebView2"`。
- WebView2：依赖 Evergreen Runtime（Win11 自带）。
- 图标：`app.ico` 多尺寸；EXE 图标经 csproj `ApplicationIcon` 直接编入（不再 rcedit）。

**v3 新增：WebView2 运行时检测与引导**

```csharp
// Platforms/Windows/WebView2Checker.cs
public static class WebView2Checker
{
    /// <summary>检测 WebView2 Evergreen Runtime 是否安装</summary>
    public static bool IsInstalled()
    {
        try
        {
            // 检查注册表（用户级 + 机器级）
            using var key = Microsoft.Win32.Registry.LocalMachine
                .OpenSubKey(@"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}");
            if (key?.GetValue("pv") is string version && version != "0.0.0.0")
                return true;
        }
        catch { }

        try
        {
            using var key = Microsoft.Win32.Registry.CurrentUser
                .OpenSubKey(@"Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}");
            if (key?.GetValue("pv") is string version && version != "0.0.0.0")
                return true;
        }
        catch { }

        return false;
    }

    /// <summary>提示用户安装 WebView2 Runtime</summary>
    public static void PromptInstall()
    {
        var result = MessageBox.Show(
            "背书哇需要 WebView2 运行时才能运行。\n是否立即下载安装？",
            "WebView2 未安装",
            MessageBoxButton.YesNo,
            MessageBoxImage.Warning);
        if (result == MessageBoxResult.Yes)
        {
            System.Diagnostics.Process.Start(
                new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "https://go.microsoft.com/fwlink/p/?LinkId=2124703",
                    UseShellExecute = true
                });
        }
    }
}
```

```csharp
// MainWindow.axaml.cs 中调用
public MainWindow()
{
    if (!WebView2Checker.IsInstalled())
    {
        WebView2Checker.PromptInstall();
        Close();
        return;
    }
    InitializeComponent();
}
```

### 8.2 Android

| 项 | 配置/做法 |
|---|---|
| TFM | `net10.0-android`，minSdk 21 / targetSdk 36 |
| ABI | 仅 `arm64-v8a`（减包；老 x86 模拟器可临时加） |
| AOT | `AndroidEnableProfiledAot=false` + `_DisableParallelAot=true`（防 `UnsatisfiedLinkError: n_onCreate`） |
| Trim | `TrimMode=partial` |
| 返回键 | 订阅 `AvaloniaActivity.BackRequested`（WebView 可后退则后退） |
| 主题 | `Theme.AppCompat.Light.NoActionBar`（防 AppCompat 崩溃） |
| 安全区 | `viewport-fit=cover` + `env(safe-area-inset-*)`（已用于 player/顶栏/侧栏，需回归） |
| 图标 | `mipmap-anydpi-v26` adaptive（fg 居中 66%）+ 5 密度 legacy |
| 权限 | 仅 `INTERNET`；`usesCleartextTraffic=true`（本地回环 http） |
| 存储 | `<filesDir>` 私有目录存 SQLite/壁纸/音频 |
| 签名 | 统一 `recitingus-signing.keystore`，**保签名一致**（否则用户需卸载重装、数据清空） |
| **生命周期** | **v3：OnPause 暂停 HTTP 服务器，OnResume 恢复，OnDestroy 停止** |
| **内存压力** | **v3：订阅 `OnTrimMemory(TrimMemoryUiHidden)` 时清空 WebView 缓存** |

```csharp
// v3 新增：Android 内存压力处理
public override void OnTrimMemory(TrimMemory level)
{
    base.OnTrimMemory(level);
    if (level >= TrimMemory.Moderate)
    {
        // 清空 WebView 缓存，释放内存
        WebViewHost?.ClearCache();
        AppLogger.Info($"内存压力清理: level={level}");
    }
}
```

### 8.3 v3 新增：BaseUrl 动态传递

由于端口可能递增，WebView 加载页面的 URL 不是固定的。需要确保前端知道实际的 BaseUrl：

```csharp
// MainView.axaml.cs
public MainView()
{
    InitializeComponent();
    var server = EmbeddedHttpServer.Instance;
    server.Start(preferredPort: 8000);
    WebViewControl.Url = new Uri(server.BaseUrl + "app.html");
}
```

前端所有 API 调用使用**相对路径**（`fetch('/api/...')`），不硬编码端口号，确保端口递增后仍然正常工作。

---

## 9. 构建与发布流水线

### 9.1 一键构建 `build/pack.ps1`（v3 增强版本注入与校验）

```powershell
param([string]$Ver = "2.0.0")
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

# v3: 从 git tag 自动推断版本（未打 tag 时用默认值）
if ($Ver -eq "2.0.0") {
    $gitVer = git describe --tags --always 2>$null
    if ($gitVer -match '^v(\d+\.\d+\.\d+)') { $Ver = $matches[1] }
}
Write-Host "构建版本: $Ver"

# 0) 同步 web/ -> Core/Assets/wwwroot
Copy-Item "$root\web\*" "$root\src\RecitingUs.Core\Assets\wwwroot\" -Recurse -Force

# 0.5) v3: 字体子集化
python "$PSScriptRoot\subset-font.py"

# 1) 桌面（自包含文件夹）
dotnet publish "$root\src\RecitingUs.App\RecitingUs.App.csproj" -c Release `
  -r win-x64 --self-contained -o "$root\artifacts\desktop\win-x64" `
  -p:Version=$Ver

# 2) Inno Setup
& "C:\Program Files\Inno Setup 7\ISCC.exe" "/dAppVersion=$Ver" "$root\installer\setup.iss"

# 3) Android APK/AAB
dotnet publish "$root\src\RecitingUs.Android\RecitingUs.Android.csproj" -c Release `
  -o "$root\artifacts\android\apk" `
  -p:AndroidSdkDirectory=$env:ANDROID_HOME `
  -p:JavaSdkDirectory="C:\Program Files\Android\openjdk\jdk-21.0.8" `
  -p:Version=$Ver

# 4) 签名 + 对齐 + 校验
& "$PSScriptRoot\sign-android.ps1" -Ver $Ver

# 5) v3: 生成校验和
$hashes = @()
Get-ChildItem "$root\artifacts\desktop\win-x64\RecitingUs.exe",
               "$root\artifacts\android\apk\*-Signed.apk" |
    ForEach-Object {
        $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
        $hashes += "$hash  $($_.Name)"
    }
$hashes | Out-File "$root\artifacts\SHA256SUMS" -Encoding utf8
Write-Host "构建完成，校验和已写入 artifacts/SHA256SUMS"
```

### 9.2 APK 签名 `build/sign-android.ps1`（要点）

```powershell
param([string]$Ver = "2.0.0")
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

$bt = "$env:ANDROID_HOME\build-tools"
$zipalign = (Get-ChildItem $bt -Recurse -Filter zipalign.exe | Sort-Object FullName -Desc | Select-Object -First 1).FullName
$apksigner = (Get-ChildItem $bt -Recurse -Filter apksigner.bat | Sort-Object FullName -Desc | Select-Object -First 1).FullName

$inApk = "$root\artifacts\android\apk\com.recitingus.app-Signed.apk"
$alignedApk = "$root\artifacts\android\apk\aligned.apk"
$signedApk = "$root\artifacts\android\apk\recitingus-$Ver.apk"

& $zipalign -f -p 4 $inApk $alignedApk
& $apksigner sign --ks "$root\artifacts\recitingus-signing.keystore" `
  --ks-key-alias recitingus --ks-pass "env:RECITINGUS_KEYSTORE_PASS" `
  --key-pass "env:RECITINGUS_KEYSTORE_PASS" --out $signedApk $alignedApk
& $apksigner verify --verbose $signedApk

Write-Host "APK 签名完成: $signedApk"
Remove-Item $alignedApk -ErrorAction SilentlyContinue
```

### 9.3 CI（GitHub Actions 要点，v3 增强校验步骤）

```yaml
# .github/workflows/build.yml
name: Build & Release
on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '10.0.x'
      - uses: actions/setup-java@v4
        with:
          distribution: 'microsoft'
          java-version: '21'
      - name: Setup Android SDK
        uses: android-actions/setup-android@v3
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Install fonttools
        run: pip install fonttools
      - name: Build all
        env:
          RECITINGUS_KEYSTORE_PASS: ${{ secrets.KEYSTORE_PASS }}
          ANDROID_HOME: ${{ env.ANDROID_SDK_ROOT }}
        run: ./build/pack.ps1 -Ver ${{ github.ref_name }}
      - name: Verify APK signature
        run: |
          $bt = "$env:ANDROID_SDK_ROOT\build-tools"
          $apksigner = (Get-ChildItem $bt -Recurse -Filter apksigner.bat | Select -First 1).FullName
          & $apksigner verify --verbose artifacts/android/apk/*.apk
      - name: Run tests
        run: dotnet test --no-build -c Release
      - name: Upload artifacts
        uses: softprops/action-gh-release@v2
        with:
          files: |
            artifacts/desktop/win-x64/RecitingUs-Setup.exe
            artifacts/android/apk/*.apk
            artifacts/SHA256SUMS
          draft: true
```

---

## 10. 安全（v3 增强）

| 领域 | 措施 |
|---|---|
| 监听面 | 仅绑定 `127.0.0.1`，不监听 0.0.0.0；不暴露局域网 |
| 路径穿越 | 所有文件名经 `Path.GetFileName` 归一化；静态资源白名单扩展名 |
| 上传 | 魔数校验（PNG/JPG/GIF/WebP/BMP）+ 8MB 上限 + 解码尺寸校验 |
| AI 代理 | 域名白名单；**apiKey 仅存原生安全存储**（Windows DPAPI / Android Keystore），绝不下发前端、不入 localStorage、不入日志 |
| 密钥 | keystore 不入库；口令走环境变量/CI Secret |
| XSS | 前端所有动态 HTML 走 `escapeHtml`；C# 静态资源不反射任意路径 |
| 明文 | 本地回环 http 可接受；对外仅 AI 代理走 https |
| **CSP** | **v3：所有响应附加 `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'`（禁止外部资源加载，仅允许本地回环 fetch）** |
| **限流** | **v3：AI 代理端点限流 10 次/分钟（令牌桶）；超出返回 429** |
| **请求体大小** | **v3：所有 POST 请求体限制 10MB（AI 代理 1MB）；超出返回 413** |
| **CORS** | **v3：不设置 `Access-Control-Allow-Origin`（同源策略，本地回环天然同源）** |
| **日志脱敏** | **v3：AI 代理日志中 request/response body 仅记录前 200 字符，不记录 Authorization 头** |

### 10.1 v3 新增：CSP 中间件

```csharp
public static class CspMiddleware
{
    private const string CspHeader =
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline'; " +   // unsafe-inline: 经典 script 模式需要
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; " +
        "font-src 'self' data:; " +
        "connect-src 'self'; " +                    // 仅本地回环
        "media-src 'self' blob:; " +
        "object-src 'none'; " +
        "frame-ancestors 'none'";

    public static void Apply(HttpListenerResponse response)
    {
        response.Headers["Content-Security-Policy"] = CspHeader;
        response.Headers["X-Content-Type-Options"] = "nosniff";
        response.Headers["X-Frame-Options"] = "DENY";
        response.Headers["Referrer-Policy"] = "no-referrer";
    }
}
```

### 10.2 v3 新增：请求体大小限制

```csharp
public static class RequestSizeLimiter
{
    private static readonly Dictionary<string, long> Limits = new()
    {
        ["/api/ai-proxy"] = 1 * 1024 * 1024,        // 1MB
        ["/api/upload-wallpaper"] = 8 * 1024 * 1024,  // 8MB
        ["/api/import"] = 10 * 1024 * 1024,            // 10MB
    };
    private const long DefaultLimit = 10 * 1024 * 1024;  // 10MB

    public static bool Validate(HttpListenerRequest request, string path)
    {
        var limit = Limits.GetValueOrDefault(path, DefaultLimit);
        if (request.ContentLength64 > limit)
        {
            return false;
        }
        return true;
    }
}
```

---

## 11. 测试与质量（v3 增强）

### 11.1 单元测试（xUnit，RecitingUs.Tests）

| 测试类 | 覆盖范围 | 关键用例 |
|---|---|---|
| `StaticAssetResolverTests` | 路径穿越防护 | `../`、绝对路径、URL 编码、空路径、超长路径 |
| `AiProxyServiceTests` | 白名单拦截 | 非白名单域名返回 403；白名单域名正常转发 |
| `CircuitBreakerTests` | 断路器状态转换 | 连续失败触发熔断；超时后半开；成功后重置 |
| `RateLimiterTests` | 令牌桶限流 | 突发请求通过；超限返回 429；窗口恢复 |
| `MigrationServiceTests` | 数据迁移 | v1 归档完整导入；部分失败回滚；空归档跳过 |
| `AppDbTests` | SQLite 操作 | WAL 模式读写并发；外键约束；事务回滚 |
| `MimeMapTests` | MIME 映射 | 常见扩展名覆盖；未知扩展名兜底 |
| `EmbeddedHttpServerTests` | 端口递增 | 首选端口被占时递增；全部被占时抛异常 |
| `ApiResponseTests` | 响应格式 | JSON 序列化正确；错误码映射 |

### 11.2 v3 新增：覆盖率目标

| 层 | 覆盖率工具 | 目标 | 说明 |
|---|---|---|---|
| Core.Services | coverlet | >= 80% | 所有服务逻辑 |
| Core.Data | coverlet | >= 85% | 数据访问与迁移 |
| Core.Hosting | coverlet | >= 70% | HTTP 服务器与路由 |
| 前端 JS | -- | 手动冒烟 | 无自动化覆盖率工具（零构建约束） |

### 11.3 集成冒烟（三端同清单）

启动 -> `/api/version` 200 -> `/api/health` 200 -> 建用户 -> 打开课文 -> 提交一道练习 -> 错题入库 -> 统计出图 -> TTS 朗读 -> 导出数据 -> 导入数据 -> 验证数据一致。

### 11.4 前端

拆分后可加轻量 Playwright 冒烟（跑 C# 服务器，截图关键视图）：
- 首页加载（检查控制台无 404/报错）
- 课文阅读模式切换
- 练习题提交
- 统计图表渲染
- 设置页面

### 11.5 回归真机

Redmi/荣耀等 >=3 台，验证安全区、TTS、返回键、图标遮罩、冷启动。

---

## 12. 性能预算（v3 增强）

| 指标 | 现状 | 目标 | v3 测量方式 |
|---|---|---|---|
| 桌面文件夹体积 | ~149 MB | <= 100 MB | `du -sh artifacts/desktop/` |
| APK 体积 | 39 MB（arm64+x86_64） | <= 22 MB（仅 arm64 + 字体子集） | `ls -la *.apk` |
| 字体资源 | 25.4 MB | <= 3 MB（woff2 子集） | 字符覆盖率 >= 99.5% |
| 背景图 | 5.5 MB | <= 600 KB（WebP） | PSNR >= 40dB |
| Android 冷启动 | ~1.2 s | <= 800 ms | `adb shell am start -W` |
| 首屏可交互 | 基准 | -50%（资源外置缓存 + 字体按需） | Performance API |
| 前端主文件 | 8059 行单文件 | 入口 <= 600 行，模块各 <= 800 行 | 行数统计 |
| 控制台 404/报错 | liquid-glass、图标断链、TTS 异常 | 0 | 手动 + Playwright |
| **HTTP 请求延迟** | -- | **静态资源 < 5ms；API < 20ms** | **v3：`/api/health` 计时** |
| **内存占用（Android）** | -- | **<= 150 MB** | **v3：`adb shell dumpsys meminfo`** |
| **内存占用（桌面）** | -- | **<= 200 MB** | **v3：任务管理器** |
| **SQLite 查询延迟** | -- | **单表 < 5ms；聚合 < 50ms** | **v3：`EXPLAIN QUERY PLAN` + 计时** |

### 12.1 v3 新增：启动性能剖析

```csharp
// Diagnostics/AppLogger.cs
public static class AppLogger
{
    private static readonly List<LogEntry> _entries = new();
    private static readonly object _lock = new();

    public static void Info(string message) => Add("INFO", message);
    public static void Warn(string message) => Add("WARN", message);
    public static void Error(string message, Exception? ex = null) =>
        Add("ERROR", $"{message}{(ex is null ? "" : $"\n{ex}")}");

    private static void Add(string level, string message)
    {
        lock (_lock)
        {
            _entries.Add(new LogEntry(DateTime.UtcNow, level, message));
            if (_entries.Count > 500) _entries.RemoveAt(0);
        }
        WriteToFile(level, message);
    }

    public static IReadOnlyList<LogEntry> GetRecent(int count = 50) =>
        _entries.TakeLast(count).ToList();
}

public sealed record LogEntry(DateTime Timestamp, string Level, string Message);
```

```csharp
// v3 新增：启动计时器
public static class StartupTimer
{
    private static readonly Stopwatch _sw = Stopwatch.StartNew();
    private static readonly List<(string, long)> _marks = new();

    public static void Mark(string label) =>
        _marks.Add((label, _sw.ElapsedMilliseconds));

    public static string GetReport() =>
        string.Join("\n", _marks.Select(m => $"  +{m.Item2,5}ms  {m.Item1}"));
}

// 使用：
// StartupTimer.Mark("程序集加载");
// StartupTimer.Mark("SQLite 初始化");
// StartupTimer.Mark("HTTP 服务器启动");
// StartupTimer.Mark("WebView 加载");
// AppLogger.Info($"启动报告:\n{StartupTimer.GetReport()}");
```

---

## 13. 错误处理与弹性策略（v3 新增）

### 13.1 错误分级

| 级别 | 含义 | 处理方式 | 用户可见 |
|---|---|---|---|
| `FATAL` | 应用无法继续运行（DB 损坏、服务器无法启动） | 记录日志 -> 显示错误页 -> 退出 | 错误对话框 |
| `ERROR` | 单个功能失败（API 500、AI 代理失败） | 记录日志 -> 返回错误响应 -> 前端降级 | Toast 提示 |
| `WARN` | 可恢复异常（端口占用递增、限流触发） | 记录日志 -> 自动恢复 | 否 |
| `INFO` | 正常事件（启动、迁移完成） | 记录日志 | 否 |

### 13.2 前端降级策略

```javascript
// js/error-boundary.js (续)
const FallbackStrategies = {
    'ai-proxy': function() {
        showToast('AI 功能暂时不可用，请稍后重试');
        document.querySelectorAll('[data-feature="ai"]').forEach(function(el) {
            el.classList.add('feature-unavailable');
        });
    },
    'stats': function() {
        var cached = Store.get('cachedStats');
        if (cached) renderStatsFromCache(cached);
        else showToast('统计数据加载中…');
    },
    'tts': function() {
        window._ttsAvailable = false;
        document.querySelectorAll('.tts-btn').forEach(function(btn) {
            btn.disabled = true;
            btn.title = '语音朗读暂不可用';
        });
    }
};

function handleFeatureFailure(feature) {
    var strategy = FallbackStrategies[feature];
    if (strategy) strategy();
}
```

### 13.3 重试策略

| 场景 | 重试次数 | 退避 | 说明 |
|---|---|---|---|
| 静态资源 404 | 0 | -- | 不重试 |
| API 500 | 1 | 1s | 单次重试 |
| AI 代理超时 | 0 | -- | 断路器接管 |
| SQLite 写入失败 | 2 | 100ms, 500ms | WAL 检查点可能阻塞 |
| TTS 原生调用失败 | 0 | -- | 立即回退 Web Speech |

```javascript
// js/api.js (v3 增强：自动重试)
async function apiFetch(path, options, retries) {
    options = options || {};
    retries = retries !== undefined ? retries : 1;
    try {
        var resp = await fetch(path, options);
        if (resp.status === 500 && retries > 0) {
            await new Promise(function(r) { setTimeout(r, 1000); });
            return apiFetch(path, options, retries - 1);
        }
        return resp;
    } catch (e) {
        if (retries > 0) {
            await new Promise(function(r) { setTimeout(r, 1000); });
            return apiFetch(path, options, retries - 1);
        }
        throw e;
    }
}
```

---

## 14. 日志与可观测性（v3 新增）

### 14.1 日志架构

```
日志来源
  C# 服务层 / HTTP 中间件 / 前端 JS
      |
      v
  AppLogger (内存 500 条 + 文件轮转 1MB x 3)
      |
      v
  调试覆盖层
    /api/logs  -> 最近 50 条
    /api/health -> 健康状态
```

### 14.2 文件日志（轮转）

```csharp
// v3: 日志文件路径
//   Win: %LOCALAPPDATA%\Programs\RecitingUs\logs\app.log
//   Android: <filesDir>/logs/app.log
// 轮转策略：单文件 1MB，保留 3 份

public static class FileLogger
{
    private static readonly object _fileLock = new();
    private static string _logDir = "";
    private static long _maxSize = 1024 * 1024;  // 1MB
    private static int _maxFiles = 3;

    public static void Init(string logDir)
    {
        _logDir = logDir;
        Directory.CreateDirectory(_logDir);
    }

    public static void Write(string level, string message)
    {
        lock (_fileLock)
        {
            var path = Path.Combine(_logDir, "app.log");
            var line = $"[{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ssZ}] {level} {message}\n";
            File.AppendAllText(path, line, Encoding.UTF8);
            if (new FileInfo(path).Length > _maxSize)
                Rotate(path);
        }
    }

    private static void Rotate(string path)
    {
        for (int i = _maxFiles - 1; i > 0; i--)
        {
            var old = $"{path}.{i}";
            var newer = $"{path}.{i - 1}";
            if (File.Exists(newer)) File.Move(newer, old, overwrite: true);
        }
        File.Move(path, $"{path}.0", overwrite: true);
    }
}
```

### 14.3 前端日志上报

```javascript
async function reportToServer(level, message, extra) {
    try {
        await fetch('/api/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level: level, message: message, extra: extra })
        });
    } catch(e) { /* 静默失败 */ }
}
```

### 14.4 调试覆盖层

在开发模式下（`ResourceOverride/debug.json` 存在时），前端右下角显示调试按钮，点击展开：
- 服务器版本与运行时间
- 最近 50 条日志
- SQLite 表行数统计
- BaseUrl 与端口
- 内存占用（桌面端）

---

## 15. 更新与热更机制（v3 新增）

### 15.1 Web 资源热更（免重编）

| 场景 | 桌面 | Android |
|---|---|---|
| 开发热更 | 改 `web/app.html` -> 复制到 `ResourceOverride/` -> 刷新 | `adb push app.html <filesDir>/ResourceOverride/` -> 刷新 |
| 正式发布 | `web/` 编入程序集 `Assets/wwwroot/` | 同 |
| 紧急修复 | 发布补丁包，用户解压到 `ResourceOverride/` | 发布新 APK（无法热更原生层） |

### 15.2 API 版本兼容

```csharp
public sealed record VersionInfo(
    string Version,
    int ApiLevel,           // v3 新增：API 兼容版本
    string Channel,
    DateTime ReleasedAt,
    string[]? Notes);
```

| API Level | 对应版本 | 变更 |
|---|---|---|
| 1 | v2.0 | 初始 API 集 |
| 2 | v2.1+ | 新增 `/api/tts/voices`、`/api/log`、`/api/health` |

### 15.3 数据库迁移版本化

```csharp
private void RunMigrations(SqliteConnection conn)
{
    var currentVersion = GetSchemaVersion(conn);
    var migrations = new (int Version, string Sql)[]
    {
        (1, SchemaV1),  // 初始建表
        (2, SchemaV2),  // 未来：新增字段/表
    };

    foreach (var (version, sql) in migrations)
    {
        if (version > currentVersion)
        {
            using var transaction = conn.BeginTransaction();
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.Transaction = transaction;
                cmd.CommandText = sql;
                cmd.ExecuteNonQuery();
                cmd.CommandText = "INSERT OR REPLACE INTO schema_version VALUES (@v, strftime('%s','now'))";
                cmd.Parameters.AddWithValue("@v", version);
                cmd.ExecuteNonQuery();
                transaction.Commit();
                AppLogger.Info($"数据库迁移到 v{version}");
            }
            catch { transaction.Rollback(); throw; }
        }
    }
}
```

### 15.4 回滚策略

| 场景 | 回滚方式 |
|---|---|
| Web 资源热更出错 | 删除 `ResourceOverride/` 目录，恢复使用程序集内嵌版本 |
| 数据库迁移失败 | 迁移在事务内执行，失败自动回滚；`schema_version` 不更新 |
| 新版本 APK 崩溃 | 用户卸载重装旧版 APK（同 keystore，数据在 `<filesDir>` 保留） |
| 新版本 EXE 崩溃 | Inno Setup 安装旧版覆盖；用户数据在 `%LOCALAPPDATA%` 保留 |

---

## 16. 里程碑与交付（v3 细化验收标准）

### Wave 0：夺回工程主权（3-5 天）

| 子任务 | 交付物 | Exit Criteria |
|---|---|---|
| 密钥备份 | keystore -> 网盘 + 物理盘；环境变量 | 2 处备份可验证；`echo $RECITINGUS_KEYSTORE_PASS` 有值 |
| 反编译 | `src/_recovered/Core`、`src/_recovered/App` | ilspycmd 无报错；C# 文件可阅读 |
| 资源提取 | `web/` 目录（app.html + config + assets） | `ManifestResourceNames` 枚举完整；wwwroot 文件数 >= 10 |
| 资源漂移校验 | diff 报告 | 提取资源与 `Memorization UI/` 差异已记录并决策 |
| 建解决方案 | sln + 4 工程 + props | `dotnet build` 成功（0 error） |
| 当日 git 提交 | 全部源码 + web + build + installer | `git log` 可见；`.gitignore` 排除 keystore |
| 最小闭环 | Core 起 HTTP -> WebView 加载 app.html | `localhost:8000/app.html` 返回 200 |
| 签名验证 | `install -r` 新 APK | 旧版用户数据保留 |

### Wave 1：后端 C# 化（1.5-2 周）

| 子任务 | 交付物 | Exit Criteria |
|---|---|---|
| EmbeddedHttpServer | HTTP 服务器 + 有界并发 + 中间件 | `/api/health` 返回 200；并发 50 请求无异常 |
| API 路由表 | 全部 `/api/*` 端点 | 每个端点单元测试通过 |
| SQLite + 迁移 | AppDb + Schema + MigrationService | WAL 启用；迁移回滚测试通过 |
| AI 代理 | AiProxyService + 断路器 + 限流 | 白名单拦截通过；连续 5 次失败触发断路器 |
| 静态资源 | StaticAssetResolver + ETag + gzip | 路径穿越测试通过；ETag 304 正确 |
| 前端切到 C# API | `api.js` 封装 | server.ps1 不再运行，全功能通过 |

### Wave 2：前端治理 + 资源（1.5-2 周）

| 子任务 | 交付物 | Exit Criteria |
|---|---|---|
| app.html 拆模块 | `web/js/*.js` 13 个模块 | 入口 <= 600 行；每模块 <= 800 行；控制台 0 报错 |
| 错误边界 | `error-boundary.js` | 模拟 API 失败时降级 UI 正常 |
| 字体子集 | `web/assets/Regular.woff2` | <= 3 MB；覆盖率 >= 99.5% |
| 图片优化 | `web/assets/background.webp` | <= 600 KB；视觉无明显降质 |
| 修断链 | liquid-glass + PWA 图标 | 控制台 0 个 404 |
| TTS 原生桥 | `/api/tts/*` + `tts.js` | Android TTS 无异常；语音列表可获取 |

### Wave 3：发布与质量（1-2 周）

| 子任务 | 交付物 | Exit Criteria |
|---|---|---|
| 构建流水线 | `pack.ps1` + Inno + APK 签名 | 一键出三端产物 + SHA256SUMS |
| CI | GitHub Actions workflow | tag push 自动构建 + Release 草稿 |
| 单元测试 | RecitingUs.Tests | 覆盖率达标（Core >= 80%） |
| 冒烟测试 | Playwright 脚本 | 5 个关键视图截图通过 |
| 真机回归 | 3 台 Android 设备 | 安全区/TTS/返回键/图标/冷启动全过 |
| 性能验收 | 性能预算表 | 所有指标达标 |

---

## 17. 风险登记册（v3 增强）

| 风险 | 等级 | 缓解 | v3 新增措施 |
|---|---|---|---|
| 反编译源码质量差 | 高 | 反编译仅作参考，按蓝图重写 | 资源漂移校验步骤 |
| 换 keystore 致数据清空 | 高 | 沿用现有 keystore；多处备份 | -- |
| Android HttpListener 兼容性 | 中 | 历史已验证；保留 shouldInterceptRequest 回退 | -- |
| WebView.Avalonia 版本锁死 | 中 | 锁定 11.0.0.1；升级单独分支验证 | -- |
| 字体子集缺字 | 中 | 全文 + 3500 字兜底；font-display: swap | 覆盖率测试 |
| 前端拆分引入回归 | 中 | 逐模块拆、每拆一个跑冒烟 | 错误边界 + 模块加载检查 |
| AOT/Trim 崩溃 | 中 | 沿用已验证配置 | -- |
| **WebView2 未安装** | **中** | -- | **启动时检测注册表，引导安装** |
| **端口被防火墙拦截** | **低** | -- | **仅绑定 127.0.0.1，不触发弹窗** |
| **AI 上游不可用** | **中** | -- | **断路器 5 次熔断 60s；前端降级** |
| **数据迁移中断** | **中** | -- | **事务原子化，失败回滚；前端可重试** |
| **Android 后台资源泄漏** | **低** | -- | **OnPause/OnResume 绑定服务器** |
| **SQLite 并发写冲突** | **低** | -- | **WAL 模式 + 写串行化锁** |

---

## 18. 立即行动清单（今天可做）

1. **备份密钥**：`recitingus-signing.keystore` -> 网盘 + 另一物理盘；设置环境变量口令。
2. **反编译**：`ilspycmd` 导出 `RecitingUs.Core.dll` / `RecitingUs.dll`；提取嵌入 wwwroot 到 `web/`。
3. **资源漂移校验**：对比提取的 wwwroot 与 `Memorization UI/` 中的文件，记录差异。
4. **建解决方案**：按 S3 创建 sln + 4 工程 + props。
5. **当日 git 提交**（源码、web、build、installer；排除 keystore）。
6. **跑通最小闭环**：Core 起 HTTP -> WebView 加载 app.html -> 手机 `install -r` 验证数据保留。
7. 建 `web/` 拆分分支，先抽 `css/app.css` 与 `js/api.js`（最低风险）。

> 完成第 1-6 项即达成 Wave 0：项目从"不可再编译"回到"可持续工程化"状态，后续 Wave 1-3 均为在安全地基上的增量交付。

---

## 附录 A：v2.0 -> v3.0 变更对照

| 章节 | 变更类型 | 内容 |
|---|---|---|
| S1 | 新增 | ADR 决策记录表 |
| S3 | 增强 | 新增 Directory.Packages.props (CPM)、中间件目录、诊断目录、error-boundary.js |
| S4.2 | **修正** | 嵌入式资源 csproj 语法 (LogicalPath -> GenerateEmbeddedFilesManifest) |
| S4.1 | 新增 | 资源漂移校验步骤 |
| S4.5 | 新增 | Android 生命周期绑定 (OnPause/OnResume) |
| S5.1 | **修正** | HTTP 服务器并发模型 (无限制 Task.Run -> SemaphoreSlim 有界并发) |
| S5.2 | **新增** | 中间件管道、ETag 缓存、gzip 压缩 |
| S5.3 | **修正** | 静态资源名格式与 ETag 逻辑 |
| S5.4 | 增强 | 新增 /api/health、/api/tts/voices、统一错误码表 |
| S5.5 | **大幅增强** | AI 代理增加断路器、令牌桶限流、超时处理 |
| S6.2 | **增强** | SQLite WAL 模式、写串行化、外键约束、schema_version 表 |
| S6.5 | **增强** | 数据迁移原子化 (事务回滚)、前端容错重试 |
| S7.2 | **新增** | 模块加载容错与错误边界 |
| S7.3 | **修正** | 字体子集脚本 API 用法 |
| S7.4 | **增强** | TTS 语音列表、队列管理、增强回退 |
| S8.1 | **新增** | WebView2 运行时检测与引导安装 |
| S8.2 | **新增** | Android 内存压力处理、生命周期绑定 |
| S9.1 | 增强 | 版本注入、字体子集化集成、SHA256SUMS |
| S9.3 | 增强 | CI 增加 fonttools、APK 签名验证、测试步骤 |
| S10 | **新增** | CSP 中间件、请求体大小限制、CORS、日志脱敏 |
| S11 | **增强** | 覆盖率目标、测试用例细化表 |
| S12 | **增强** | 新增 HTTP 延迟/内存/SQLite 延迟预算、启动计时器 |
| S13 | **新增** | 完整的「错误处理与弹性策略」章节 |
| S14 | **新增** | 完整的「日志与可观测性」章节 |
| S15 | **新增** | 完整的「更新与热更机制」章节 |
| S16 | **增强** | 每个子任务细化 Exit Criteria |
| S17 | **增强** | 新增 6 项风险及缓解措施 |
