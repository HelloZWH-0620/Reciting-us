# 背书哇 App —— 构建说明（v2.0 源码恢复版）

> ✅ **状态更新（2026-09-05）**：源码已通过「反编译恢复 + 按蓝图重写」完整重建并入库。
> 解决方案：`RecitingUsApp/RecitingUs.slnx`（RecitingUs.Core / RecitingUs.App / RecitingUs.Android / RecitingUs.Tests）。
> 旧的「源码丢失」告警作废；`src/_recovered/` 保留反编译结果仅作考古参考，**不参与编译**。

## 一、解决方案结构

| 工程 | TFM | 职责 |
|---|---|---|
| `src/RecitingUs.Core` | net10.0 | 内嵌 HTTP 服务器（回环 only）、全部 `/api/*`、SQLite(WAL)、AI 代理（白名单/限流/断路器）、TTS 抽象、结构化日志；`web/` 全量内嵌为程序集资源 |
| `src/RecitingUs.App` | net10.0 | 桌面壳（Avalonia + WebView2）、WebView2 运行时检测、Windows TTS(SAPI) + DPAPI 密钥 |
| `src/RecitingUs.Android` | net10.0-android | Activity + 原生 WebView、Android TTS + Keystore 密钥、生命周期绑定（返回键/OnPause/OnResume） |
| `src/RecitingUs.Tests` | net10.0 | xUnit 单元测试（56 用例：路径穿越/断路器/限流/迁移原子性/MIME/错误码） |

前端权威源：**`RecitingUsApp/web/`**（从原程序集提取 + 本次修复；漂移分析见 `DRIFT_REPORT.md`）。
`Memorization UI/` 降级为 PowerShell 单文件模式兼容副本，仅增量同步。

## 二、签名密钥（三处备份，已验证 SHA256 一致）

- 主文件：`artifacts\recitingus-signing.keystore`（alias `recitingus`，口令 `recitingus2026`）
- 备份 1：`C:\Users\18948\Documents\RecitingUsBackup-1\`
- 备份 2：`C:\Users\18948\RecitingUsKeystoreBackup-D2\`
- **已加入 .gitignore（`*.keystore`），严禁入库**；CI 口令走环境变量 `RECITINGUS_KEYSTORE_PASS`
- ⚠️ 今后所有 APK 更新必须用这个 keystore，换签名 = 用户数据清空

## 三、构建

```powershell
# 一键三端（桌面自包含文件夹 + Inno 安装包 + APK 签名 + SHA256SUMS）
RecitingUsApp/build/pack.ps1 [-Ver x.y.z] [-SkipAndroid] [-SkipInstaller]

# 仅调试构建
dotnet build RecitingUsApp/RecitingUs.slnx -c Debug

# 单元测试
dotnet test RecitingUsApp/src/RecitingUs.Tests/RecitingUs.Tests.csproj

# Android 单独构建（需 Android SDK + JDK21）
dotnet publish RecitingUsApp/src/RecitingUs.Android/RecitingUs.Android.csproj -c Release `
  -p:AndroidSdkDirectory="$env:LOCALAPPDATA\Android\Sdk" `
  -p:JavaSdkDirectory="C:\Program Files\Android\openjdk\jdk-21.0.8"
```

CI：`.github/workflows/build.yml`（tag `v*` 触发；需在仓库 secrets 配置 `KEYSTORE_PASS`）。

## 四、热更（免重编改前端）

- 桌面：把改动的文件放进 `%APPDATA%\RecitingUs\ResourceOverride\`（如 `app.html`），刷新即生效——覆盖目录优先于程序集内嵌资源。
- Android：`adb push app.html /data/data/com.recitingus.app/files/ResourceOverride/`。

## 五、产物级维护方式（历史遗留，源码已恢复后不再必需）

见 git 历史 v0.3.1 的 BUILD.md 第三节（rcedit 换图标 / zip 级换 APK 图标）。

## 六、版本记录

### v0.38 · 2026-09-06

1. **个人中心**：数据面板核查（无多余返回按钮）；**AI 设置绑定对应用户**——`ai_config__<档案>.json` 独立存取 + 档案 payload 随存随取 + 旧全局 `ai_config.json` 一次性迁入 + 新建用户隔离实测（互不串用）；`syncKey` 持久化挂钩恢复接线。
2. **拼音功能（新增）**：顶栏「拼音」开关 → 正文 ruby 逐字注音；字典 `js/pinyin-dict.js`（3297 字，42KB，`build/gen-pinyin-dict.py` 生成）覆盖课文/UI 全部用字，缺字自动回退；MutationObserver 自动跟随重渲染。
3. **翻译/注释字体统一**：阅读区（原文/译文/注释）统一内嵌霞鹜文楷，消除系统楷体/文楷混排错乱；`@font-face` 接入子集 `Regular.subset.woff2`（523KB，秒加载，TTF 兜底）；注释行字体规则不再受分栏模式限定。
4. **虚词 AI 收集例句（新增）**：词卡新增「📚 AI 收集例句」——按义项分组收集教材课文例句，含未配置提醒/加载态/错误展示；修复上游错误对象显示 `[object Object]` 的问题。
5. **作者朝代切换样式**：`.dynasty-sel` 增强（主色左竖条 + 加深渐变 + 加粗，暗色主题适配）。
6. **练习模式目录视觉修复**：类型/返回/随机按钮改用 `.sbtn`（缩进统一）；修复「选中高亮被 `showPlaceholder→hideAllViews` 抹掉」的顺序缺陷；侧栏按钮焦点圈收敛（`.focus-visible` 内描边）。
7. 版本号全链路 0.38.0（version.json / Directory.Build.props / Android 0.38 code 38）。

回归证据：单元测试 56/56、冒烟 SMOKE_OK、浏览器实测（拼音 315 注音/朝代高亮/练习选中态保持/AI 例句全链路 401 错误路径/隔离性磁盘证据）。

### v0.38.1 · 2026-09-06（音频内置 + 图标更新）

- **安装包内置音频**：72 篇高考必背古诗文真人朗读（aac）按课文标题命名复制进 `web/resource/audio/`（+9 个标题注记别名，共 86 文件 352MB），随 Core.dll 内嵌进桌面与 Android 安装包；`/api/audio-files` 合并内嵌清单，播放器按标题自动命中（60/80 课文有音频，其余为初中篇目本就无音频）。
- **应用图标全面更新**（黑底金卷轴书新设计）：桌面 EXE `app.ico`、Inno `logoblack.ico`、favicon、PWA 8 尺寸、Android 全密度 mipmap（方形+圆形）。
- 版本 0.38.1 / Android versionCode 39。
- 音频源文件不入 git（352MB）：`build/fetch-audio.py` 在打包时从下载目录复制（源目录可参数化），`.gitignore` 已排除 `web/resource/audio/`。
- 产物实测：APK 276MB adb 安装到真机（6b8aebc9）成功，冷启动 1363ms，`/api/audio-files` 86 项、内嵌音频 `/resource/audio/论语十二章.aac` 200（6MB）；桌面 86 项、`陈情表.aac` 200（8.1MB）、TTS 204。

### 模拟器回归（Android 15 x86_64 AVD，2026-09-06）

安装→首启 OOBE→建户→课文渲染（霞鹜文楷）→上次状态恢复 全通过；内置服务器 API（health/version/tts/app.html）经 `adb forward` 全 200；**原生 TTS 桥 available:true + speak 204 实际合成**；生命周期 OnPause→503 / OnResume→200；返回键最小化不退出；桌面图标渲染正确；崩溃 0。冷启动 COLD 2559ms（Debug 未裁剪构建，仅参考；Release+AOT 真机为准）。

回归抓到并修复 2 个 Android 端真实缺陷（桌面端不会暴露）：
1. `MainActivity.CustomizeAppBuilder` 缺 `UseAndroid()` → 启动即崩 "No runtime platform services configured"（v3 蓝图示例的缺陷）；
2. `/api/tts/speak` payload 反序列化大小写敏感 → 前端小写 `text` 恒 400，朗读不可用。

### v2.1 · 2026-09-05（模块化拆分）

app.html 8081→231 行：`css/app.css` + `js/data/*5` + `js/app.main.js`（bootApp 整体，god-function 保作用域）+ `profile/error-display/account/reveal/boot` 顶层模块；CSS 外置后 16 处相对 url 修复；error-boundary 自检清单修正；Cache-Control 改 `no-cache`+ETag。

## 七、v3 蓝图落地对照

| Wave | 状态 | 说明 |
|---|---|---|
| Wave 0 源码恢复 | ✅ 完成 | ilspycmd 反编译 → 按蓝图重建 → 全绿 → 入库；资源漂移校验见 `DRIFT_REPORT.md` |
| Wave 1 后端 C# 化 | ✅ 完成 | 有界并发/中间件/ETag/gzip/CSP/请求体限制/限流/断路器/SQLite WAL/原子迁移/AI 密钥托管/TTS 桥/health/log |
| Wave 2 前端治理 | ✅ 完成 | 模块化拆分（入口 231 行）、断链清零、error-boundary、migrate、字体子集接入、拼音/AI 例句等新功能 |
| Wave 3 发布与质量 | 🟡 部分 | pack/sign/CI/subset-font ✅、56 测试 ✅；真机回归 ⏳（需实体设备） |

已知有意偏离 v3 文档的记录（均写入代码注释）：AI 代理上游超时 120s（文档 30s）；前端权威源为 `web/`（程序集快照，实测 `Memorization UI/` 滞后）；`js/app.main.js`（bootApp god-function，5637 行）保持整体——拆分需重构函数作用域，风险不可接受，留待专项重构。`Memorization UI/` 自 v2.1 起不再同步（PowerShell 单文件模式兼容副本）。
