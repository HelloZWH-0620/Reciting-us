# APK 对齐 + 签名 + 校验（v3 §9.2）
# 口令从环境变量 RECITINGUS_KEYSTORE_PASS 读取；本地调试可用 -PlainPass 显式传入（勿写入脚本/仓库）
param(
    [string]$Ver = "2.0.0",
    [string]$PlainPass = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }

if ($env:RECITINGUS_KEYSTORE_PASS) { $passSpec = "env:RECITINGUS_KEYSTORE_PASS" }
elseif ($PlainPass) { $passSpec = "pass:$PlainPass" }
else { throw "请设置环境变量 RECITINGUS_KEYSTORE_PASS（或用 -PlainPass 本地临时传入）" }

$bt = "$env:ANDROID_HOME\build-tools"
if (-not (Test-Path $bt)) { throw "找不到 Android build-tools: $bt" }
$zipalign = (Get-ChildItem $bt -Recurse -Filter zipalign.exe | Sort-Object FullName -Desc | Select-Object -First 1).FullName
$apksigner = (Get-ChildItem $bt -Recurse -Filter apksigner.bat | Sort-Object FullName -Desc | Select-Object -First 1).FullName
$keystore = "$root\artifacts\recitingus-signing.keystore"
if (-not (Test-Path $keystore)) { throw "找不到签名密钥: $keystore（务必另行备份！）" }

$unsigned = Get-ChildItem "$root\artifacts\android\apk\*.apk" -Exclude *-Signed.apk, *-aligned.apk, recitingus-*.apk |
    Sort-Object LastWriteTime -Desc | Select-Object -First 1
if (-not $unsigned) { throw "apk 目录中未找到未签名产物" }
$aligned = "$root\artifacts\android\apk\aligned.apk"
$signed = "$root\artifacts\android\apk\recitingus-$Ver.apk"

Write-Host "== zipalign $($unsigned.Name) =="
& $zipalign -f -p 4 $unsigned.FullName $aligned
if ($LASTEXITCODE -ne 0) { throw "zipalign 失败" }

Write-Host "== apksigner =="
& $apksigner sign --ks $keystore --ks-key-alias recitingus `
    --ks-pass $passSpec --key-pass $passSpec `
    --out $signed $aligned
if ($LASTEXITCODE -ne 0) { throw "APK 签名失败" }

& $apksigner verify $signed
if ($LASTEXITCODE -ne 0) { throw "签名校验失败" }

Remove-Item $aligned -ErrorAction SilentlyContinue
Write-Host "签名完成: $signed" -ForegroundColor Green
