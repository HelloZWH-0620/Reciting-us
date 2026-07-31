$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$setupDir = Join-Path $base 'setuptools'
$target = Join-Path $setupDir 'start.bat'
$icon = Join-Path $base 'setuptools\logoblack.ico'
$setupImg = Join-Path $base 'setuptools\Setup.png'

# Build the shortcut name "背书哇.lnk" using Unicode escapes so the script stays ASCII-safe.
$appName = [string]::new([char[]]@(0x80cc, 0x4e66, 0x54c7))
$lnkName = "$appName.lnk"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Create a borderless, topmost splash window that does not appear on the taskbar.
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Installing'
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.BackColor = [System.Drawing.Color]::Black

$img = $null
if (Test-Path $setupImg) {
    $img = [System.Drawing.Image]::FromFile($setupImg)
    $form.ClientSize = $img.Size

    $pic = New-Object System.Windows.Forms.PictureBox
    $pic.Dock = [System.Windows.Forms.DockStyle]::Fill
    $pic.Image = $img
    $pic.SizeMode = [System.Windows.Forms.PictureBoxSizeMode]::Normal
    $form.Controls.Add($pic)
} else {
    $form.ClientSize = New-Object System.Drawing.Size(500, 300)
    $label = New-Object System.Windows.Forms.Label
    $label.Text = 'Installing, please wait...'
    $label.ForeColor = [System.Drawing.Color]::White
    $label.BackColor = [System.Drawing.Color]::Black
    $label.Dock = [System.Windows.Forms.DockStyle]::Fill
    $label.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
    $label.Font = New-Object System.Drawing.Font('Microsoft YaHei', 16)
    $form.Controls.Add($label)
}

# Show the splash window first, before creating shortcuts, so the image is visible immediately.
$form.Show()
[System.Windows.Forms.Application]::DoEvents()
Start-Sleep -Milliseconds 300

# Ensure setup directory exists and write config.json with the absolute root path.
if (-not (Test-Path $setupDir)) {
    New-Item -ItemType Directory -Path $setupDir -Force | Out-Null
}
$config = @{ root = $base } | ConvertTo-Json -Compress
$configPath = Join-Path $setupDir 'config.json'
$config | Out-File -FilePath $configPath -Encoding utf8

# Create desktop and Start Menu shortcuts.
$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$startMenu = [Environment]::GetFolderPath('StartMenu')

foreach ($dir in @($desktop, $startMenu)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $path = Join-Path $dir $lnkName
    $sc = $ws.CreateShortcut($path)
    $sc.TargetPath = $target
    $sc.IconLocation = $icon
    $sc.WorkingDirectory = $setupDir
    $sc.Save()
    # Keep the window responsive while shortcuts are being created.
    [System.Windows.Forms.Application]::DoEvents()
}

# Close the splash window automatically once installation is finished.
$form.Close()
if ($img) { $img.Dispose() }
