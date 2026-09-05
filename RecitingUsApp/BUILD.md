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

## 六、v3 蓝图落地对照

| Wave | 状态 | 说明 |
|---|---|---|
| Wave 0 源码恢复 | ✅ 完成 | ilspycmd 反编译 → 按蓝图重建 → 全绿 → 入库；资源漂移校验见 `DRIFT_REPORT.md` |
| Wave 1 后端 C# 化 | ✅ 完成 | 有界并发/中间件/ETag/gzip/CSP/请求体限制/限流/断路器/SQLite WAL/原子迁移/AI 密钥托管/TTS 桥/health/log |
| Wave 2 前端治理 | 🟡 部分 | liquid-glass 补齐、PWA 图标、error-boundary、migrate、断链清零 ✅；8059 行全量拆分模块（低风险渐进）⏳ |
| Wave 3 发布与质量 | 🟡 部分 | pack/sign/CI/subset-font ✅、56 测试 ✅；字体子集实际运行与真机回归 ⏳ |

已知有意偏离 v3 文档的两处（均记录于代码注释）：AI 代理上游超时保留 120s（文档 30s，避免长文出题被截断）；数据迁移以 `web/`（程序集快照）为权威源而非 `Memorization UI/`（实测后者滞后）。
