param([string]$root)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'

# App name: 背书哇 (Unicode-safe)
$appName = [string]::new([char[]]@(0x80cc, 0x4e66, 0x54c7))
$lnkName = "$appName.lnk"

$serverDir    = Join-Path $root 'setuptools'
$serverScript = Join-Path $serverDir 'server.ps1'
$configPath   = Join-Path $serverDir 'config.json'
$userdataDir  = Join-Path $root 'userdata'

$desktop   = [Environment]::GetFolderPath('Desktop')
$startMenu = [Environment]::GetFolderPath('StartMenu')

# ========== Step 0: Two-step confirmation ==========
Add-Type -AssemblyName System.Windows.Forms

$r1 = [System.Windows.Forms.MessageBox]::Show(
    "你确定要卸载 ""$appName"" 吗？`n`n所有背诵数据将被清除。",
    "卸载确认",
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Warning
)
if ($r1 -ne [System.Windows.Forms.DialogResult]::Yes) {
    Write-Host "卸载已取消。"
    exit 0
}

$r2 = [System.Windows.Forms.MessageBox]::Show(
    "警告：这将永久删除所有数据，此操作不可恢复！`n`n确认要继续吗？",
    "最终确认",
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Error
)
if ($r2 -ne [System.Windows.Forms.DialogResult]::Yes) {
    Write-Host "卸载已取消。"
    exit 0
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       $appName 卸载程序" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ========== Step 1: Clear localStorage ==========
# Replicates the "全部" reset button in app.html: localStorage.clear()
Write-Host "[1/3] 清除应用数据 (localStorage)..." -ForegroundColor Yellow

$serverRunning = $false

# Check if server is already running on port 8000
try {
    $null = Invoke-WebRequest -Uri 'http://localhost:8000/' -UseBasicParsing -TimeoutSec 2
    $serverRunning = $true
} catch {}

# Start server temporarily if not running
if (-not $serverRunning -and (Test-Path $serverScript)) {
    Start-Process powershell -ArgumentList "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$serverScript`" 8000" -WindowStyle Hidden
    Start-Sleep -Seconds 3
    try {
        $null = Invoke-WebRequest -Uri 'http://localhost:8000/' -UseBasicParsing -TimeoutSec 2
        $serverRunning = $true
    } catch {
        Write-Host "  [!] 无法启动本地服务器,跳过数据清除" -ForegroundColor Red
    }
}

if ($serverRunning) {
    # Temporary HTML page served from localhost:8000 to clear localStorage
    $clearHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Clear</title></head><body style="background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif"><div style="text-align:center"><h2 style="color:#4caf50;font-size:24px;margin:0">数据已清除</h2><p style="color:#888;margin-top:12px">此窗口将自动关闭</p></div><script>try{localStorage.clear();}catch(e){}setTimeout(function(){try{window.close();}catch(e){}},2000);</script></body></html>'
    $clearPath = Join-Path $root 'clear_storage_temp.html'
    [System.IO.File]::WriteAllText($clearPath, $clearHtml, [System.Text.Encoding]::UTF8)

    try {
        Start-Process 'http://localhost:8000/clear_storage_temp.html'
        Start-Sleep -Seconds 3
        Write-Host "  [OK] 应用数据已清除" -ForegroundColor Green
    } catch {
        Write-Host "  [!] 无法打开浏览器清除数据" -ForegroundColor Red
    } finally {
        Remove-Item $clearPath -Force -ErrorAction SilentlyContinue
    }
}

# ========== Step 2: Stop server, then clear user data ==========
Write-Host "[2/3] 停止服务并清空用户数据 (userdata)..." -ForegroundColor Yellow

# Stop all server.ps1 processes first so no file is locked
try {
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like '*server.ps1*' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
} catch {}
Start-Sleep -Milliseconds 500

# Delete the entire userdata directory (per-user profile_*.json files, etc.)
if (Test-Path $userdataDir) {
    try {
        Remove-Item $userdataDir -Recurse -Force -ErrorAction Stop
        Write-Host "  [OK] 已清空并删除 userdata 目录" -ForegroundColor Green
    } catch {
        Write-Host "  [!] 删除 userdata 失败: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  [-] userdata 目录不存在" -ForegroundColor DarkGray
}

# ========== Step 3: Delete config and shortcuts ==========
Write-Host "[3/3] 删除配置文件与快捷方式..." -ForegroundColor Yellow

# Delete config file (retry a few times in case it is briefly locked by the dying server)
if (Test-Path $configPath) {
    $deleted = $false
    for ($i = 0; $i -lt 5; $i++) {
        try {
            Remove-Item $configPath -Force -ErrorAction Stop
            $deleted = $true
            break
        } catch {
            Start-Sleep -Milliseconds 400
        }
    }
    if ($deleted) {
        Write-Host "  [OK] 已删除配置文件 (config.json)" -ForegroundColor Green
    } else {
        Write-Host "  [!] 无法删除 config.json,请手动删除: $configPath" -ForegroundColor Red
    }
} else {
    Write-Host "  [-] 配置文件不存在" -ForegroundColor DarkGray
}

# Delete desktop shortcut
$desktopLnk = Join-Path $desktop $lnkName
if (Test-Path $desktopLnk) {
    Remove-Item $desktopLnk -Force
    Write-Host "  [OK] 已删除桌面快捷方式" -ForegroundColor Green
} else {
    Write-Host "  [-] 桌面快捷方式不存在" -ForegroundColor DarkGray
}

# Delete Start Menu shortcut
$startMenuLnk = Join-Path $startMenu $lnkName
if (Test-Path $startMenuLnk) {
    Remove-Item $startMenuLnk -Force
    Write-Host "  [OK] 已删除开始菜单快捷方式" -ForegroundColor Green
} else {
    Write-Host "  [-] 开始菜单快捷方式不存在" -ForegroundColor DarkGray
}

# ========== Done ==========
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  卸载完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
