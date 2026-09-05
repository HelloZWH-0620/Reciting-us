# 背书哇！专业级工程优化蓝图

> **技术主线**：C# 13 / .NET 10 (LTS) / Avalonia 11.x / WebView（桌面 WebView2 + Android 原生 WebView）
> **目标平台**：Windows 桌面端、Android 移动端（同源 Web UI + C# 平台服务层）
> **文档版本**：v2.0（工程蓝图版）　**日期**：2026-09-04
> **一句话结论**：业务 UI（8059 行 Web SPA）保留为表现层并治理；**全部平台能力与数据下沉到 C#**；第一步是从现存程序集**恢复可编译源码并入库**，随后按四波里程碑推进。

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
│        │  │  /api/* 路由  / 静态资源(内嵌+覆盖)│  │                          │
│        │  ├────────────────────────────────┤  │                          │
│        │  │ Services: 数据/壁纸/音频/AI代理/TTS│  │                          │
│        │  │ Data: SQLite (Microsoft.Data.Sqlite)│ │                          │
│        │  │ Assets: 嵌入 wwwroot (app.html…)  │  │                          │
│        │  └────────────────────────────────┘  │                          │
│        └──────────────────────────────────────┘                          │
│  平台特定: RecitingUs.Platforms.Windows / .Android (TTS、文件、返回键)      │
└──────────────────────────────────────────────────────────────┘
           ▲ fetch('/api/...')        ▲ 可选 native bridge (postMessage)
           │                          │
┌──────────┴──────────────────────────┴─────────────────────────┐
│  Web UI (wwwroot/app.html + js/* + assets/*)   ← 表现层，可热更  │
│  学习/练习/飞花令/闪卡/统计图表/AI/壁纸/设置                       │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. 现状审计（证据化）

### 2.1 资产与健康度

| 模块 | 路径 | 规模 | git | 健康 |
|---|---|---|:--:|:--:|
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
├── build/
│   ├── pack.ps1                    # 一键构建三端
│   ├── sign-android.ps1            # APK 签名
│   └── subset-font.py              # 字体子集化
├── src/
│   ├── RecitingUs.Core/            # net10.0；平台无关：服务器/服务/数据/模型/资产
│   │   ├── RecitingUs.Core.csproj
│   │   ├── Assets/                 # wwwroot 源（app.html, js, assets, config）
│   │   ├── Hosting/
│   │   │   ├── EmbeddedHttpServer.cs
│   │   │   ├── Router.cs
│   │   │   ├── StaticAssetResolver.cs   # 内嵌优先 + 外置覆盖
│   │   │   └── ApiResponse.cs
│   │   ├── Services/
│   │   │   ├── IWallpaperService.cs / WallpaperService.cs
│   │   │   ├── IAudioService.cs     / AudioService.cs
│   │   │   ├── IAiProxyService.cs  / AiProxyService.cs
│   │   │   ├── IUserDataService.cs / UserDataService.cs
│   │   │   ├── IStatsService.cs    / StatsService.cs
│   │   │   └── ITtsService.cs      # 抽象，平台实现
│   │   ├── Data/
│   │   │   ├── AppDb.cs            # SQLite (Microsoft.Data.Sqlite)
│   │   │   ├── Migrations/
│   │   │   └── Repositories/       # Progress/WrongBook/Stats/Flashcard
│   │   ├── Models/                 # Article/Poem/Exercise/UserProfile…
│   │   ├── Content/                # 课文 JSON 加载与查询
│   │   │   └── ContentCatalog.cs
│   │   └── Platform/               # 平台抽象（路径、安全区、文件选择）
│   │       └── IPlatformServices.cs
│   ├── RecitingUs.App/             # net10.0 桌面
│   │   ├── RecitingUs.App.csproj
│   │   ├── App.axaml(.cs)
│   │   ├── MainWindow.axaml(.cs)
│   │   ├── MainView.axaml(.cs)     # 共享 WebView 宿主
│   │   └── Platforms/Windows/
│   │       ├── WindowsTtsService.cs
│   │       └── WindowsPlatformServices.cs
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
  </PropertyGroup>
</Project>
```

### 3.2 核心工程职责

| 工程 | TFM | 职责 | 关键依赖 |
|---|---|---|---|
| **RecitingUs.Core** | `net10.0` | HTTP 服务器、API 服务、SQLite、内容加载、嵌入资产、平台抽象 | `Microsoft.Data.Sqlite`、`System.Text.Json`、`Avalonia`（仅共享 MainView 所需） |
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
3. **重建工程文件**：以 §3 结构新建干净 csproj，把反编译结果按命名空间归位（反编译仅作参考，关键类按本蓝图重写）。
4. **当日入库**：`git add src/ web/ build/ installer/ && git commit`。规则：**可编译代码当天必须入库**；`*.keystore` 入 `.gitignore`。
5. **密钥备份**：`recitingus-signing.keystore` 立即复制到 ≥2 处（网盘 + 其他盘），口令改由环境变量 `RECITINGUS_KEYSTORE_PASS` 注入。

### 4.2 `RecitingUs.Core.csproj`

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <RootNamespace>RecitingUs.Core</RootNamespace>
    <AssemblyName>RecitingUs.Core</AssemblyName>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.Data.Sqlite" Version="10.0.*" />
    <PackageReference Include="Avalonia" Version="11.0.0" />
  </ItemGroup>

  <!-- 嵌入 Web 资产（发布快照）；构建时从 web/ 复制 -->
  <ItemGroup>
    <EmbeddedResource Include="Assets\wwwroot\**\*">
      <LogicalPath>wwwroot\%(RecursiveDir)%(FileName)%(Extension)</LogicalPath>
    </EmbeddedResource>
  </ItemGroup>
</Project>
```

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
    <PackageReference Include="Avalonia.Desktop" Version="11.0.0" />
    <PackageReference Include="Avalonia.Themes.Fluent" Version="11.0.0" />
    <PackageReference Include="Avalonia.Fonts.Inter" Version="11.0.0" />
    <PackageReference Include="WebView.Avalonia" Version="11.0.0.1" />
    <PackageReference Include="WebView.Avalonia.Desktop" Version="11.0.0.1" />
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
    <PackageReference Include="Avalonia.Android" Version="11.0.0" />
    <PackageReference Include="Avalonia.Themes.Fluent" Version="11.0.0" />
    <PackageReference Include="WebView.Avalonia" Version="11.0.0.1" />
    <PackageReference Include="WebView.Avalonia.Android" Version="11.0.0.1" />
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
}
```

> Android 主题 `styles.xml` 的 `MyTheme` parent 必须是 `Theme.AppCompat.Light.NoActionBar`（Avalonia Activity 基于 AppCompatActivity，否则启动崩 `You need to use a Theme.AppCompat theme`）。

---

## 5. C# 后端服务设计（全面替代 PowerShell）

### 5.1 嵌入式 HTTP 服务器

- 用 `HttpListener`（桌面/Android 均可用；仅绑定 `127.0.0.1`，不暴露局域网）。
- 端口：首选 8000，占用则递增到 8050。
- 路由表驱动，异步处理，统一 JSON 响应。

```csharp
public sealed class EmbeddedHttpServer
{
    public static EmbeddedHttpServer Instance { get; } = new();
    public string BaseUrl => $"http://127.0.0.1:{_port}/";
    private HttpListener? _listener; private int _port;

    public void Start(int preferredPort)
    {
        for (_port = preferredPort; _port < preferredPort + 50; _port++)
        {
            try { _listener = new HttpListener();
                  _listener.Prefixes.Add($"http://127.0.0.1:{_port}/");
                  _listener.Start(); break; }
            catch (HttpListenerException) { _listener?.Close(); _listener = null; }
        }
        _ = Task.Run(LoopAsync);
    }

    private async Task LoopAsync()
    {
        while (_listener!.IsListening)
        {
            var ctx = await _listener.GetContextAsync();
            _ = Task.Run(() => Router.DispatchAsync(ctx));   // 每请求一线程
        }
    }
}
```

### 5.2 静态资源：内嵌优先 + 外置覆盖（热更关键）

```csharp
public static class StaticAssetResolver
{
    // 1) 外置覆盖目录（开发热更，免重编）：
    //    Win: %LOCALAPPDATA%\Programs\RecitingUs\ResourceOverride\
    //    Android: <filesDir>/ResourceOverride/
    // 2) 否则返回程序集内嵌 wwwroot 快照
    public static Stream? Open(string path, out string mime)
    {
        var safe = Normalize(path);                       // 防路径穿越
        var overridePath = Path.Combine(Platform.OverrideDir, safe);
        if (File.Exists(overridePath))
            return (File.OpenRead(overridePath), MimeMap.For(safe)) is var (s,m)
                   ? (mime = m, s) : default;
        var asm = typeof(StaticAssetResolver).Assembly;
        var name = asm.GetManifestResourceNames()
                      .FirstOrDefault(n => n.EndsWith("wwwroot." + safe.Replace('/', '.')));
        if (name is null) { mime = "application/octet-stream"; return null; }
        mime = MimeMap.For(safe);
        return asm.GetManifestResourceStream(name);
    }

    private static string Normalize(string p) =>
        Path.GetFileName(p.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
}
```

> 价值：前端改 `app.html` 后，桌面只需把文件放进 `ResourceOverride/` 立即生效；Android 可 `adb push` 调试。正式发版把 `web/` 编译进程序集。

### 5.3 完整 API 契约（v2）

| 方法 | 路径 | 请求 | 响应 | 说明 |
|---|---|---|---|---|
| GET | `/api/version` | — | `{version,channel,releasedAt,notes}` | 版本 |
| GET | `/api/content/articles` | — | `Article[]` | 课文目录（替代前端内嵌） |
| GET | `/api/content/article/{id}` | — | `ArticleDetail` | 原文/译文/注释/赏析 |
| GET | `/api/content/poems`、`/games`、`/writers` | — | JSON | 其余数据 JSON |
| GET | `/api/wallpapers` | — | `{files:[{name,url,size}]}` | 壁纸列表 |
| POST | `/api/upload-wallpaper` | multipart | `{ok,name}` | 魔数校验 + ≤8MB |
| DELETE | `/api/wallpapers/{name}` | — | `{ok}` | `GetFileName` 防穿越 |
| GET | `/api/audio-files` | — | `{files:[{name,url}]}` | 音频 |
| POST | `/api/ai-proxy` | `{provider,endpoint,model,messages,…}`（**不含 key**） | 透传上游 | key 由 C# 安全存储注入 |
| GET | `/api/userdata/list` | — | `{files:[…]}` | 多用户 profile |
| GET/PUT/DELETE | `/api/userdata/file/{name}` | JSON 体 | `{ok}` | 落 SQLite/文件 |
| GET | `/api/progress` | — | `ProgressRecord[]` | 学习进度（SRS） |
| POST | `/api/progress` | `ProgressRecord` | `{ok}` | 上报进度 |
| GET | `/api/wrong-book` | — | `WrongItem[]` | 错题本 |
| POST | `/api/wrong-book` | `WrongItem` | `{ok}` | 加错题 |
| DELETE | `/api/wrong-book/{id}` | — | `{ok}` | 移除/已掌握 |
| GET | `/api/stats?from&to` | — | `StatsPoint[]` | 统计图表数据源 |
| POST | `/api/tts/speak` | `{text,rate}` | 204（原生朗读） | 走 ITtsService |
| POST | `/api/tts/stop` | — | 204 | 停止 |
| POST | `/api/export` | — | 文件流（.json 归档） | 全量导出 |
| POST | `/api/import` | 归档文件 | `{ok,summary}` | 导入 + schema 迁移 |

统一响应/错误：
```csharp
public static class ApiResponse
{
    public static void Json(HttpListenerResponse r, object obj, int code = 200) { … 写 UTF-8 JSON … }
    public static void Error(HttpListenerResponse r, int code, string msg) =>
        Json(r, new { ok = false, error = msg }, code);
}
```

### 5.4 AI 代理（密钥不下前端）

```csharp
public sealed class AiProxyService(IPlatformServices plat) : IAiProxyService
{
    private static readonly string[] AllowedHosts =
        { "api.openai.com","api.deepseek.com","api.siliconflow.cn",
          "dashscope.aliyuncs.com","open.bigmodel.cn","api.moonshot.cn","api.moonshot.com" };

    public async Task<(int status, string body)> ForwardAsync(AiRequest req, CancellationToken ct)
    {
        var uri = new Uri(req.Endpoint);
        if (!AllowedHosts.Contains(uri.Host) && !plat.IsAllowedAiHost(uri.Host))
            return (403, """{"ok":false,"error":"host not allowed"}""");

        var key = plat.GetSecret("ai:" + req.Provider);   // 原生安全存储，绝不进前端
        using var http = new HttpClient();
        using var up = new HttpRequestMessage(HttpMethod.Post, uri) { Content = JsonContent.Create(req with { ApiKey = key }) };
        var resp = await http.SendAsync(up, ct);
        return ((int)resp.StatusCode, await resp.Content.ReadAsStringAsync(ct));
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

### 6.2 SQLite Schema

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
  UNIQUE(profile_id, article_id, mode));

CREATE TABLE IF NOT EXISTS wrong_book (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL, article_id TEXT, type TEXT NOT NULL,  -- blank/match/feihua…
  prompt TEXT NOT NULL, answer TEXT, user_answer TEXT,
  mastered INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_wrong_profile ON wrong_book(profile_id, mastered);

CREATE TABLE IF NOT EXISTS stats_daily (
  profile_id TEXT NOT NULL, day TEXT NOT NULL,   -- yyyy-MM-dd
  practice_count INTEGER DEFAULT 0, correct_count INTEGER DEFAULT 0,
  study_seconds INTEGER DEFAULT 0, articles_read INTEGER DEFAULT 0,
  PRIMARY KEY(profile_id, day));

CREATE TABLE IF NOT EXISTS flashcard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL, article_id TEXT NOT NULL,
  front TEXT, back TEXT, ease REAL DEFAULT 2.5, interval_days REAL DEFAULT 0,
  due_at INTEGER, last_review INTEGER);

CREATE TABLE IF NOT EXISTS kv_store (           -- 兼容旧 userdata 文件
  profile_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
  updated_at INTEGER NOT NULL, PRIMARY KEY(profile_id, key));
```

### 6.3 数据模型（C#）

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

### 6.4 localStorage → 服务端迁移

前端启动时执行一次性迁移：读 localStorage 的 `aiConfig/wrongbook/aiQuestions/practiceStats/recited/flashcard`（`_CRITICAL_KEYS`），打包 POST 到 `/api/import`；C# 端按 `EXPORT_SCHEMA_VERSION` 做版本化迁移并写入 SQLite。迁移成功后写 `localStorage['migrated_v2']=1`，不再重复。

---

## 7. 前端（Web UI）治理

### 7.1 拆分（保持"零构建可直开"）

把 8059 行按 §2.3 模块地图拆为 `web/js/*.js`（经典 `<script>` 顺序加载，**不引入 ESM**，以兼容 file:// 直开与 server.ps1）：

```html
<!-- app.html 底部 -->
<script src="js/store.js"></script>      <!-- localStorage + /api 封装 -->
<script src="js/api.js"></script>        <!-- fetch 包装、_url 兼容 -->
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
<script src="js/boot.js"></script>
```

- 所有 `innerHTML` 拼接走统一 `escapeHtml()`（已有 `escapeHtml`，强制全部调用），消除 XSS。
- 数据访问收敛到 `api.js`，UI 不再直接 `fetch`。

### 7.2 资源瘦身

| 资源 | 现状 | 处理 | 目标 |
|---|---|---|---|
| Regular.ttf | 25.4 MB | `pyftsubset` 按 33 篇课文+释义+UI 用字子集化 → woff2 | ≤ 3 MB |
| background.png | 5.5 MB | 转 WebP/AVIF + 降采样；夜间深色版 | ≤ 600 KB |
| PWA 图标 | 断链 | 生成 72/96/128/144/192/384/512 PNG 或修 manifest | 0 断链 |
| liquid-glass.js | **缺失** | 二选一：补文件，或移除 `glass*` 调用回退普通毛玻璃 CSS | 0 控制台 404 |

字体子集脚本（`build/subset-font.py`）：
```python
from fontTools.subset import SubsetLoader, Options, Subsetter
# 用字集 = config/*.json 全文 + app.html 可见文案 + 常用 3500 汉字
chars = set(open('used_chars.txt', encoding='utf-8').read())
opt = Options(); opt.flavor='woff2'; opt.with_zopfli=True
ss = Subsetter(options=opt); ss.populate(text=''.join(chars))
font = SubsetLoader('Regular.ttf'); ss.subset(font)
font.save('assets/Regular.woff2')
```

### 7.3 TTS：原生桥优先（解决 Android speechSynthesis 缺陷）

历史 bug：部分 Android WebView 的 `window.speechSynthesis.cancel/speak` 未实现，抛 `Cannot read properties of undefined (reading 'cancel')`。方案：**C# 原生 TTS** 经 HTTP/桥接提供，Web 端优先调用。

```csharp
// Core 抽象
public interface ITtsService {
    void Speak(string text, float rate);
    void Stop();
    bool IsAvailable { get; }
}
// Android 实现：Android.Speech.Tts.TextToSpeech（setLanguage zh-CN）
// Windows 实现：Windows.Media.SpeechSynthesis（或 System.Speech）
```

```js
// js/tts.js
async function speak(text, rate){
  try { await fetch('/api/tts/speak', {method:'POST',
        body: JSON.stringify({text, rate})}); return; }   // 原生优先
  catch(e){}
  if (!('speechSynthesis' in window)) return;             // 回退 Web Speech
  try { speechSynthesis.cancel(); /* …speak… */ } catch(e){}
}
```

---

## 8. 跨平台专项

### 8.1 Windows 桌面

- 发布：自包含 **文件夹**（非 SingleFile，规避 `libSkiaSharp.dll` 加载失败）。
- 安装：Inno Setup，`DefaultDirName={localappdata}\Programs\RecitingUs`、`PrivilegesRequired=lowest`（装 Program Files 会黑屏）、`Excludes: "*.WebView2"`。
- WebView2：依赖 Evergreen Runtime（Win11 自带）。
- 图标：`app.ico` 多尺寸；EXE 图标经 csproj `ApplicationIcon` 直接编入（不再 rcedit）。

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

---

## 9. 构建与发布流水线

### 9.1 一键构建 `build/pack.ps1`

```powershell
param([string]$Ver = "2.0.0")
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

# 0) 同步 web/ -> Core/Assets/wwwroot
Copy-Item "$root\web\*" "$root\src\RecitingUs.Core\Assets\wwwroot\" -Recurse -Force

# 1) 桌面（自包含文件夹）
dotnet publish "$root\src\RecitingUs.App\RecitingUs.App.csproj" -c Release `
  -r win-x64 --self-contained -o "$root\artifacts\desktop\win-x64"

# 2) Inno Setup
& "C:\Program Files\Inno Setup 7\ISCC.exe" "$root\installer\setup.iss"

# 3) Android APK/AAB
dotnet publish "$root\src\RecitingUs.Android\RecitingUs.Android.csproj" -c Release `
  -o "$root\artifacts\android\apk" `
  -p:AndroidSdkDirectory=$env:ANDROID_HOME `
  -p:JavaSdkDirectory="C:\Program Files\Android\openjdk\jdk-21.0.8"

# 4) 签名 + 对齐 + 校验（见 sign-android.ps1）
& "$PSScriptRoot\sign-android.ps1" -Ver $Ver
```

### 9.2 APK 签名 `build/sign-android.ps1`（要点）

```powershell
$bt = "$env:ANDROID_HOME\build-tools"
$zipalign = (Get-ChildItem $bt -Recurse -Filter zipalign.exe | Sort-Object FullName -Desc | Select-Object -First 1).FullName
$apksigner = (Get-ChildItem $bt -Recurse -Filter apksigner.bat | Sort-Object FullName -Desc | Select-Object -First 1).FullName
& $zipalign -f -p 4 in.apk aligned.apk
& $apksigner sign --ks "$root\artifacts\recitingus-signing.keystore" `
  --ks-key-alias recitingus --ks-pass "env:RECITINGUS_KEYSTORE_PASS" `
  --key-pass "env:RECITINGUS_KEYSTORE_PASS" --out signed.apk aligned.apk
& $apksigner verify --verbose signed.apk
```

### 9.3 CI（GitHub Actions 要点）

`setup-dotnet@v4`（10.x）→ `setup-java`（21）→ Android SDK → `pack.ps1` → `apksigner verify` → 上传 EXE/APK 为 Release 草稿。密钥用 GitHub Secrets 注入，不入仓库。

---

## 10. 安全

| 领域 | 措施 |
|---|---|
| 监听面 | 仅绑定 `127.0.0.1`，不监听 0.0.0.0；不暴露局域网 |
| 路径穿越 | 所有文件名经 `Path.GetFileName` 归一化；静态资源白名单扩展名 |
| 上传 | 魔数校验（PNG/JPG/GIF/WebP/BMP）+ 8MB 上限 + 解码尺寸校验 |
| AI 代理 | 域名白名单；**apiKey 仅存原生安全存储**（Windows DPAPI / Android Keystore），绝不下发前端、不入 localStorage、不入日志 |
| 密钥 | keystore 不入库；口令走环境变量/CI Secret |
| XSS | 前端所有动态 HTML 走 `escapeHtml`；C# 静态资源不反射任意路径 |
| 明文 | 本地回环 http 可接受；对外仅 AI 代理走 https |

---

## 11. 测试与质量

- **单元测试（xUnit，RecitingUs.Tests）**：
  - `StaticAssetResolver` 路径穿越用例（`../`、绝对路径、URL 编码）
  - `AiProxyService` 白名单拦截
  - SQLite 迁移：v1 localStorage 归档 → v2 schema 数据正确
  - MIME 映射、端口递增、壁纸魔数校验
- **集成冒烟（三端同清单）**：启动 → `/api/version` 200 → 建用户 → 打开课文 → 提交一道练习 → 错题入库 → 统计出图 → 导出数据。
- **前端**：拆分后可加轻量 Playwright 冒烟（跑 server.ps1 / C# 服务器，截图关键视图）。
- **回归真机**：Redmi/荣耀等 ≥3 台，验证安全区、TTS、返回键、图标遮罩、冷启动。

---

## 12. 性能预算

| 指标 | 现状 | 目标 |
|---|---|---|
| 桌面文件夹体积 | ~149 MB | ≤ 100 MB |
| APK 体积 | 39 MB（arm64+x86_64） | ≤ 22 MB（仅 arm64 + 字体子集） |
| 字体资源 | 25.4 MB | ≤ 3 MB（woff2 子集） |
| 背景图 | 5.5 MB | ≤ 600 KB（WebP） |
| Android 冷启动 | ~1.2 s | ≤ 800 ms |
| 首屏可交互 | 基准 | -50%（资源外置缓存 + 字体按需） |
| 前端主文件 | 8059 行单文件 | 入口 ≤ 600 行，模块各 ≤ 800 行 |
| 控制台 404/报错 | liquid-glass、图标断链、TTS 异常 | 0 |

---

## 13. 里程碑与交付

| 波次 | 周期 | 交付物 | 验收 |
|---|---|---|---|
| **Wave 0：夺回工程主权** | 3–5 天 | 反编译恢复 + 新建 §3 解决方案；web/ 资产入库；keystore 备份；`pack.ps1` 一键出三端 | git 可编译；同 keystore `install -r` 升级**数据保留**；HTTP 200 |
| **Wave 1：后端 C# 化** | 1.5–2 周 | EmbeddedHttpServer + 全部 `/api/*`；SQLite + 迁移；AI 代理密钥托管；静态资源内嵌+覆盖 | PowerShell 不再是运行依赖；前端切到 C# API 全功能通过 |
| **Wave 2：前端治理 + 资源** | 1.5–2 周 | app.html 拆模块；字体子集 woff2；图片 WebP；修 liquid-glass/图标断链；TTS 原生桥 | 控制台 0 报错；包体/字体达标；Android TTS 无异常 |
| **Wave 3：发布与质量** | 1–2 周 | Inno/APK 签名流水线；CI；单元测试 + 冒烟；三端真机回归 | 一键发版；性能预算达标；回归清单全过 |

---

## 14. 风险登记册

| 风险 | 等级 | 缓解 |
|---|---|---|
| 反编译源码质量差/不可编译 | 高 | 反编译仅作参考，按本蓝图重写关键类；资源直接从程序集提取 |
| 换 keystore 致用户数据清空 | 高 | 全程沿用现有 keystore；立即多处备份；口令环境变量 |
| Android HttpListener 兼容性 | 中 | 历史已验证可用；保留回退到 WebView `shouldInterceptRequest` 直接供资源 |
| WebView.Avalonia 版本锁死 | 中 | 锁定 11.0.0.1；升级 11.2/11.3 单独开分支验证 |
| 字体子集缺字 | 中 | 用字集由全文 + 常用 3500 字生成；运行期 `font-display: swap` + 系统楷体兜底 |
| 前端拆分引入回归 | 中 | 逐模块拆、每拆一个跑冒烟；保持零构建直开 |
| AOT/Trim 崩溃 | 中 | 沿用已验证配置（关并行/profiled AOT、partial trim） |

---

## 15. 立即行动清单（今天可做）

1. **备份密钥**：`recitingus-signing.keystore` → 网盘 + 另一物理盘；设置环境变量口令。
2. **反编译**：`ilspycmd` 导出 `RecitingUs.Core.dll` / `RecitingUs.dll`；提取嵌入 wwwroot 到 `web/`。
3. **建解决方案**：按 §3 创建 `RecitingUs.sln` + 四个工程 + `Directory.Build.props`。
4. **当日 git 提交**（源码、web、build、installer；排除 keystore）。
5. **跑通最小闭环**：Core 起 HTTP → App/Android 宿主 WebView 加载 `app.html` → 手机 `install -r` 验证数据保留。
6. 建 `web/` 拆分分支，先抽 `css/app.css` 与 `js/api.js`（最低风险）。

> 完成第 1–5 项即达成 Wave 0：项目从"不可再编译"回到"可持续工程化"状态，后续 Wave 1–3 均为在安全地基上的增量交付。
