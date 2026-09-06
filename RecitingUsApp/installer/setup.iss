#define MyAppName "背书哇"
#define MyAppNameEngine "RecitingUs"
#define MyAppVersion "0.38.1"
#define MyAppPublisher "RecitingUs"
#define MyAppExeName "RecitingUs.exe"

[Setup]
AppId={{7F3B4E1A-6C2D-4A9E-B5F0-3D8C2E9A6B41}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
; 不能装到 {autopf}（Program Files）：WebView2 要在程序目录旁建用户数据目录
; （RecitingUs.exe.WebView2），Program Files 默认不可写会导致 WebView2 初始化失败 → 黑屏。
; 改用 {localappdata}\Programs（用户可写、免 UAC）。
DefaultDirName={localappdata}\Programs\{#MyAppNameEngine}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
PrivilegesRequired=lowest
OutputDir=..\artifacts\installer
OutputBaseFilename=RecitingUs-Setup-{#MyAppVersion}
SetupIconFile=logoblack.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}

[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加任务："; Flags: unchecked

[Files]
; 自包含文件夹发布：exe 与 libSkiaSharp.dll / WebView2Loader.dll 等原生库必须一起打包。
; 排除 .WebView2 运行时缓存目录，避免把上次运行的垃圾打进去。
Source: "..\artifacts\desktop\win-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.WebView2"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "立即启动 {#MyAppName}"; Flags: nowait postinstall skipifsilent
