# 背书哇一键构建三端（v3 §9.1）
# 用法: ./build/pack.ps1 [-Ver 2.0.0]
# 产物: artifacts/desktop/win-x64/ + artifacts/installer/*.exe + artifacts/android/apk/*.apk + SHA256SUMS
param(
    [string]$Ver = "2.0.0",
    [switch]$SkipAndroid,
    [switch]$SkipInstaller
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$env:ANDROID_HOME = $env:ANDROID_HOME ?? "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = $env:JAVA_HOME ?? "C:\Program Files\Android\openjdk\jdk-21.0.8"

# 0) 版本号：优先命令行，其次 git tag（vX.Y.Z）
if ($Ver -eq "2.0.0") {
    $gitVer = git -C $root describe --tags --always 2>$null
    if ($gitVer -match '^v(\d+\.\d+\.\d+)') { $Ver = $matches[1] }
}
Write-Host "== 构建版本: $Ver ==" -ForegroundColor Cyan

# 0.5) 前端资源体检（内嵌进 RecitingUs.Core.dll，杜绝断链上线）
$web = "$root\web"
if (-not (Test-Path "$web\app.html")) { throw "缺少 $web\app.html" }
foreach ($js in @("liquid-glass.js", "js\error-boundary.js", "js\migrate.js", "config\version.json", "config\manifest.json")) {
    if (-not (Test-Path "$web\$js")) { throw "缺少前端资源: web\$js" }
}

# 0.9) 字体子集化（可选：需 python + fonttools；未安装则跳过并沿用整字库）
$subsetFont = "$PSScriptRoot\subset-font.py"
if (Get-Command python -ErrorAction SilentlyContinue) {
    python -c "import fontTools" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "== 字体子集化 =="
        python $subsetFont
    } else {
        Write-Warning "未安装 fonttools（pip install fonttools brotli），跳过字体子集化（APK 体积将偏大）"
    }
}

# 1) 桌面（自包含文件夹；libSkiaSharp 约束禁用 SingleFile）
Write-Host "== 桌面发布 =="
dotnet publish "$root\src\RecitingUs.App\RecitingUs.App.csproj" -c Release -r win-x64 --self-contained `
    -o "$root\artifacts\desktop\win-x64" -p:Version=$Ver --nologo
if ($LASTEXITCODE -ne 0) { throw "桌面发布失败" }

# 2) Inno Setup 安装包
if (-not $SkipInstaller) {
    $iscc = @("C:\Program Files\Inno Setup 7\ISCC.exe", "C:\Program Files (x86)\Inno Setup 6\ISCC.exe") |
        Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($iscc) {
        Write-Host "== Inno Setup =="
        & $iscc "/dAppVersion=$Ver" "$root\installer\setup.iss"
    } else {
        Write-Warning "未找到 ISCC.exe，跳过安装包（可安装 Inno Setup 后重跑 -SkipAndroid）"
    }
}

# 3) Android APK（arm64-v8a；沿用既有 keystore 保签名一致）
if (-not $SkipAndroid) {
    Write-Host "== Android 发布 =="
    dotnet publish "$root\src\RecitingUs.Android\RecitingUs.Android.csproj" -c Release `
        -o "$root\artifacts\android\apk" `
        -p:AndroidSdkDirectory=$env:ANDROID_HOME -p:JavaSdkDirectory=$env:JAVA_HOME `
        -p:Version=$Ver --nologo
    if ($LASTEXITCODE -ne 0) { throw "Android 发布失败" }

    & "$PSScriptRoot\sign-android.ps1" -Ver $Ver
}

# 4) SHA256 校验和
Write-Host "== 生成 SHA256SUMS =="
$hashLines = @()
Get-ChildItem "$root\artifacts\desktop\win-x64\RecitingUs.exe",
              "$root\artifacts\installer\*.exe",
              "$root\artifacts\android\apk\*.apk" -ErrorAction SilentlyContinue |
    ForEach-Object {
        $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
        $hashLines += "$hash  $($_.Name)"
    }
$hashLines | Out-File "$root\artifacts\SHA256SUMS" -Encoding utf8
Write-Host "构建完成。校验和: artifacts\SHA256SUMS" -ForegroundColor Green
