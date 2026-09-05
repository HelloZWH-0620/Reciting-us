# 资源漂移校验报告（Wave 0）

> 日期：2026-09-05　|　依据：《优化方案_Professional_v3.md》§4.1 第 3 步

## 校验对象

| 来源 | 说明 |
|---|---|
| A. `RecitingUsApp/web/`（从 `RecitingUs.Core.dll` 内嵌资源提取，28 项） | 实际发版产物（2026-09-03 构建，随桌面 EXE 与 Android APK 分发） |
| B. `Memorization UI/`（git 工作副本） | 历史开发源，含未提交修改 |

## 校验结果

| 文件 | 结果 |
|---|---|
| `config/*.json`（7 个）+ `config/bundled.js` | ✅ 完全一致 |
| `resource/background/background.png`、`resource/icon/*.svg`（15 个）、`resource/wordtype/Regular.ttf` | ✅ 完全一致 |
| `resource/OOBE/page1-3.png` | ⚠️ 仅存在于程序集（B 缺失）——OOBE 引导页属壳层资源，A 为准 |
| `app.html` | ⚠️ **双向漂移 165 行**：A 在 B 之上多出「移动端安全区适配」一整批改动（`viewport-fit=cover`、`env(safe-area-inset-*)`、汉堡/顶栏/播放器定位），B 无反向新增 |

## 决策（偏离 v3 文档 §4.1 假设的说明）

v3 文档假设「开发源 `Memorization UI/` 更新」，但实测相反：**程序集快照 = 工作副本 + 已上机的移动端适配补丁**，是严格的超集（A 独有 70 行均为安全区适配；B 独有 49 行均为同一批规则的旧版写法，无独立新功能）。

因此：

1. **`RecitingUsApp/web/`（提取快照）自即日起为唯一权威前端源**，构建时整体嵌入 `RecitingUs.Core.dll`；
2. `Memorization UI/` 降级为「PowerShell 单文件运行模式」的兼容副本，不再参与打包；
3. 本次优化对 `Memorization UI/` 仅做**增量同步**（新增 `liquid-glass.js`、`js/error-boundary.js`、`js/migrate.js`、PWA 图标与 2 行 script 引用），不改动其 `app.html` 既有内容，避免覆盖未提交的工作区状态。

## 后续约定

- 前端改动一律改 `RecitingUsApp/web/`，经 `build/pack.ps1` 同步进程序集；或调试期放进 `ResourceOverride/` 热更目录免重编生效。
