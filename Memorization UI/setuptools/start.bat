@echo off
chcp 65001 >nul
set "ROOT=%~dp0.."

:: Install fonts from resource\wordtype (system-wide if admin, otherwise current user)
powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -Command "& {$root='%ROOT%'; $fontDir=Join-Path $root 'resource\wordtype'; $sysFonts='C:\Windows\Fonts'; $userFonts=Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Fonts'; $dst=$userFonts; $isAdmin=(New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator); if($isAdmin){$dst=$sysFonts}; if(-not (Test-Path $dst)){New-Item -ItemType Directory -Path $dst -Force | Out-Null}; $shell=New-Object -ComObject Shell.Application; Get-ChildItem -Path $fontDir -File -Include '*.ttf','*.otf','*.ttc' | ForEach-Object { $src=$_.FullName; $name=$_.Name; $target=Join-Path $dst $name; if(-not (Test-Path $target)){ try { Copy-Item $src $target -Force -ErrorAction Stop; $regPath='HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts'; if($isAdmin){$regPath='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts'}; $fontName=[System.IO.Path]::GetFileNameWithoutExtension($name); Set-ItemProperty -Path $regPath -Name \"$fontName (TrueType)\" -Value $name -ErrorAction SilentlyContinue } catch {} } }"

start "" /min powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" 8000
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000/app.html"
