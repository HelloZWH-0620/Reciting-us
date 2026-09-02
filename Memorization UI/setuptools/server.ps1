# 背书哇！本地 PowerShell 服务器
# 运行：powershell -NoProfile -ExecutionPolicy Bypass -File setup\server.ps1 [端口]
# 说明：为网页提供静态文件服务，并处理壁纸上传/列表/删除。

param([int]$Port = 8000)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $scriptDir 'config.json'
$root = Split-Path -Parent $scriptDir

# 如果存在配置文件，读取项目根目录
if (Test-Path $configPath) {
    try {
        $cfg = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($cfg.root -and (Test-Path $cfg.root)) {
            $root = $cfg.root
        }
    } catch {
        # 配置文件损坏时回退到脚本上级目录
    }
}

$wallpaperDir = Join-Path $root 'resource\background'
if (-not (Test-Path $wallpaperDir)) {
    New-Item -ItemType Directory -Path $wallpaperDir -Force | Out-Null
}

$audioDir = Join-Path $root 'resource\audio'
if (-not (Test-Path $audioDir)) {
    New-Item -ItemType Directory -Path $audioDir -Force | Out-Null
}

$userdataDir = Join-Path $root 'userdata'
if (-not (Test-Path $userdataDir)) {
    New-Item -ItemType Directory -Path $userdataDir -Force | Out-Null
}

$allowedExt = @('.png','.jpg','.jpeg','.gif','.webp','.bmp')
$audioExt = @('.mp3','.wav','.m4a','.aac')
$maxUploadBytes = 8MB   # 上传壁纸解码后大小上限（M1 加固：原实现无大小校验）

# AI 代理目标域名白名单（M1 加固：原实现可被当作 SSRF 跳板向任意外网地址转发）
# 用户如需自定义服务商（如本地 Ollama、中转站），在 setuptools/ai-hosts.txt 每行写一个域名即可追加
$aiAllowedHosts = @(
    'api.openai.com',
    'api.deepseek.com',
    'api.siliconflow.cn',
    'dashscope.aliyuncs.com',
    'open.bigmodel.cn',
    'api.moonshot.cn',
    'api.moonshot.com',
    'localhost',
    '127.0.0.1'
)
$aiHostsFile = Join-Path $scriptDir 'ai-hosts.txt'
if (Test-Path $aiHostsFile) {
    try {
        Get-Content $aiHostsFile -Encoding UTF8 | ForEach-Object {
            $h = $_.Trim().ToLower()
            if ($h -and -not $h.StartsWith('#') -and ($aiAllowedHosts -notcontains $h)) { $aiAllowedHosts += $h }
        }
    } catch {}
}

# 校验图片魔数与扩展名一致（M1 加固）
function Test-ImageMagic([byte[]]$bytes, [string]$ext) {
    if ($bytes.Length -lt 12) { return $false }
    switch ($ext) {
        '.png'  { return ($bytes[0] -eq 0x89) -and ($bytes[1] -eq 0x50) -and ($bytes[2] -eq 0x4E) -and ($bytes[3] -eq 0x47) }
        '.jpg'  { return ($bytes[0] -eq 0xFF) -and ($bytes[1] -eq 0xD8) -and ($bytes[2] -eq 0xFF) }
        '.jpeg' { return ($bytes[0] -eq 0xFF) -and ($bytes[1] -eq 0xD8) -and ($bytes[2] -eq 0xFF) }
        '.gif'  { return ($bytes[0] -eq 0x47) -and ($bytes[1] -eq 0x49) -and ($bytes[2] -eq 0x46) }
        '.bmp'  { return ($bytes[0] -eq 0x42) -and ($bytes[1] -eq 0x4D) }
        '.webp' { return ($bytes[0] -eq 0x52) -and ($bytes[1] -eq 0x49) -and ($bytes[2] -eq 0x46) -and ($bytes[3] -eq 0x46) }
        default { return $false }
    }
}

$mimeMap = @{
    '.html' = 'text/html'
    '.htm'  = 'text/html'
    '.css'  = 'text/css'
    '.js'   = 'application/javascript'
    '.json' = 'application/json'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.webp' = 'image/webp'
    '.bmp'  = 'image/bmp'
    '.ico'  = 'image/x-icon'
    '.svg'  = 'image/svg+xml'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
    '.ttf'  = 'font/ttf'
    '.eot'  = 'application/vnd.ms-fontobject'
    '.mp3'  = 'audio/mpeg'
    '.wav'  = 'audio/wav'
    '.m4a'  = 'audio/mp4'
    '.aac'  = 'audio/aac'
}

function Send-JsonResponse($response, $obj, $statusCode = 200) {
    $body = ($obj | ConvertTo-Json -Compress -Depth 10)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    # 使用 chunked 输出，不设置 ContentLength64：
    # .NET Framework 的 HttpListenerResponse 在 PowerShell 5.1 下设置 ContentLength64
    # 偶发 "response has been submitted" 异常，会杀死整个服务器。
    $response.ContentType = 'application/json; charset=utf-8'
    $response.SendChunked = $true
    $response.StatusCode = $statusCode
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    $response.OutputStream.Close()
}

function Send-BytesResponse($response, $bytes, $contentType) {
    # 与 Send-JsonResponse 相同的 chunked 策略，规避 ContentLength64 提交竞态
    $response.ContentType = $contentType
    $response.SendChunked = $true
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    $response.OutputStream.Close()
}

function Send-ErrorResponse($response, $message, $statusCode = 500) {
    Send-JsonResponse $response @{success=$false; error=$message} $statusCode
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try {
    $listener.Start()
} catch {
    Write-Host "无法启动端口 $Port，可能已被占用：$_"
    exit 1
}

Write-Host "服务器已启动: http://localhost:$Port/app.html"
Write-Host "项目目录: $root"
Write-Host "壁纸目录: $wallpaperDir"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $path = $request.Url.LocalPath
        $method = $request.HttpMethod

        # CORS 头（M1 加固：收紧为同源。原实现 '*' 允许任意恶意网页静默调用本机 API）
        $response.Headers.Add('Access-Control-Allow-Origin', "http://localhost:$Port")
        $response.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        $response.Headers.Add('Access-Control-Allow-Headers', 'Content-Type')

        if ($method -eq 'OPTIONS') {
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        try {
            if ($path -eq '/api/wallpapers' -and $method -eq 'GET') {
                $files = Get-ChildItem -Path $wallpaperDir -File -ErrorAction SilentlyContinue |
                    Where-Object { $allowedExt -contains $_.Extension.ToLower() } |
                    Select-Object -ExpandProperty Name | Sort-Object
                Send-JsonResponse $response @{success=$true; files=@($files)}
            }
            elseif ($path -eq '/api/version' -and $method -eq 'GET') {
                # 版本信息（V3 §2.1）：供前端与后续更新器读取 config/version.json
                $versionFile = Join-Path $root 'config\version.json'
                if (Test-Path $versionFile) {
                    try {
                        $ver = Get-Content $versionFile -Raw -Encoding UTF8 | ConvertFrom-Json
                        Send-JsonResponse $response @{success=$true; version=$ver.version; channel=$ver.channel; releasedAt=$ver.releasedAt; notes=$ver.notes}
                    } catch {
                        Send-ErrorResponse $response 'version.json 解析失败' 500
                    }
                } else {
                    Send-ErrorResponse $response '缺少 config/version.json' 404
                }
            }
            elseif ($path -eq '/api/audio-files' -and $method -eq 'GET') {
                $files = Get-ChildItem -Path $audioDir -File -ErrorAction SilentlyContinue |
                    Where-Object { $audioExt -contains $_.Extension.ToLower() } |
                    Select-Object -ExpandProperty Name | Sort-Object
                Send-JsonResponse $response @{success=$true; files=@($files)}
            }
            elseif ($path -eq '/api/upload-wallpaper' -and $method -eq 'POST') {
                # 显式使用 UTF-8 读取：浏览器发来的 POST 体是 UTF-8，若省略 charset，$request.ContentEncoding 会回退到系统默认编码（中文 Windows 为 GBK），导致中文 JSON 乱码无法解析
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $json = $reader.ReadToEnd()
                $reader.Dispose()
                $payload = $json | ConvertFrom-Json

                $dataUrl = $payload.data
                $filename = [System.IO.Path]::GetFileName($payload.filename)

                if (-not ($dataUrl -match '^data:image/[^;]+;base64,(.+)$')) {
                    Send-ErrorResponse $response '图片数据格式错误' 400
                    continue
                }
                $base64 = $Matches[1]
                $ext = [System.IO.Path]::GetExtension($filename).ToLower()
                if ($allowedExt -notcontains $ext) {
                    Send-ErrorResponse $response '不支持的图片格式' 400
                    continue
                }

                $safeName = [System.Text.RegularExpressions.Regex]::Replace($filename, '[^a-zA-Z0-9\-_\.]', '_')
                if ([string]::IsNullOrWhiteSpace($safeName)) {
                    $safeName = 'wallpaper' + $ext
                }
                $targetPath = Join-Path $wallpaperDir $safeName
                $counter = 1
                $base = [System.IO.Path]::GetFileNameWithoutExtension($safeName)
                while (Test-Path $targetPath) {
                    $safeName = "$base`_$counter$ext"
                    $targetPath = Join-Path $wallpaperDir $safeName
                    $counter++
                }

                $bytes = [System.Convert]::FromBase64String($base64)
                if ($bytes.Length -gt $maxUploadBytes) {
                    Send-ErrorResponse $response '图片超过 8MB 大小限制' 413
                    continue
                }
                if (-not (Test-ImageMagic $bytes $ext)) {
                    Send-ErrorResponse $response '图片内容与扩展名不符' 400
                    continue
                }
                [System.IO.File]::WriteAllBytes($targetPath, $bytes)
                Send-JsonResponse $response @{success=$true; filename=$safeName}
            }
            elseif ($path -like '/api/wallpapers/*' -and $method -eq 'DELETE') {
                $filename = [System.IO.Path]::GetFileName($path.Substring('/api/wallpapers/'.Length))
                $targetPath = Join-Path $wallpaperDir $filename
                if (-not (Test-Path $targetPath)) {
                    Send-ErrorResponse $response '文件不存在' 404
                    continue
                }
                Remove-Item $targetPath -Force
                Send-JsonResponse $response @{success=$true}
            }
            elseif ($path -eq '/api/ai-proxy' -and $method -eq 'POST') {
                # 浏览器同源代理：由本地服务器转发到外部 AI API，规避 CORS 拦截
                # 显式使用 UTF-8 读取：浏览器发来的 POST 体是 UTF-8，若省略 charset，$request.ContentEncoding 会回退到系统默认编码（中文 Windows 为 GBK），导致中文 JSON 乱码无法解析
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $json = $reader.ReadToEnd()
                $reader.Dispose()
                try {
                    $payload = $json | ConvertFrom-Json
                } catch {
                    Send-ErrorResponse $response '请求体不是合法 JSON' 400
                    continue
                }
                $targetUrl = $payload.url
                if (-not $targetUrl) {
                    Send-ErrorResponse $response '缺少目标 URL' 400
                    continue
                }
                # M1 加固：目标域名白名单校验（防 SSRF）。自定义服务商请编辑 setuptools/ai-hosts.txt
                $targetHost = ''
                try { $targetHost = [System.Uri]::new($targetUrl).Host.ToLower() } catch {
                    Send-ErrorResponse $response '目标 URL 非法' 400
                    continue
                }
                if ($aiAllowedHosts -notcontains $targetHost) {
                    Send-ErrorResponse $response ("目标域名不在白名单: " + $targetHost + "。可在 setuptools/ai-hosts.txt 中添加后重启") 403
                    continue
                }
                [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13
                $fwd = @{
                    model = $payload.model
                    messages = $payload.messages
                    temperature = if ($null -ne $payload.temperature) { $payload.temperature } else { 0.7 }
                    stream = $false
                }
                if ($payload.extra -and $payload.extra.PSObject.Properties.Count) {
                    foreach ($k in $payload.extra.PSObject.Properties.Name) { $fwd[$k] = $payload.extra.$k }
                }
                $fwdJson = $fwd | ConvertTo-Json -Depth 20 -Compress
                try {
                    $uri = [System.Uri]::new($targetUrl)
                    $req = [System.Net.HttpWebRequest]::Create($uri)
                    $req.Method = 'POST'
                    $req.ContentType = 'application/json'
                    $req.Timeout = 120000
                    $req.Headers.Add('Authorization', 'Bearer ' + $payload.apiKey)
                    $enc = [System.Text.Encoding]::UTF8
                    $bytes = $enc.GetBytes($fwdJson)
                    $req.ContentLength = $bytes.Length
                    $out = $req.GetRequestStream()
                    $out.Write($bytes, 0, $bytes.Length)
                    $out.Close()
                    $upResp = $req.GetResponse()
                    $upStream = $upResp.GetResponseStream()
                    $upReader = New-Object System.IO.StreamReader($upStream, $enc)
                    $upText = $upReader.ReadToEnd()
                    $upReader.Close(); $upStream.Close(); $upResp.Close()
                    $outBytes = $enc.GetBytes($upText)
                    $response.StatusCode = 200
                    $response.ContentType = 'application/json; charset=utf-8'
                    $response.ContentLength64 = $outBytes.Length
                    $response.OutputStream.Write($outBytes, 0, $outBytes.Length)
                    $response.OutputStream.Close()
                } catch [System.Net.WebException] {
                    $we = $_
                    $status = 'HTTP ' + [int]$we.Exception.Response.StatusCode
                    $errBody = ''
                    try {
                        $es = $we.Exception.Response.GetResponseStream()
                        $er = New-Object System.IO.StreamReader($es, [System.Text.Encoding]::UTF8)
                        $errBody = $er.ReadToEnd(); $er.Close(); $es.Close()
                    } catch {}
                    Send-JsonResponse $response @{success=$false; error=($status + ' ' + $errBody)} 502
                    continue
                } catch {
                    $msg = $_.Exception.Message
                    if ($_.Exception.InnerException) { $msg = $msg + ' | ' + $_.Exception.InnerException.Message }
                    Send-JsonResponse $response @{success=$false; error=$msg} 502
                    continue
                }
                continue
            }
            elseif ($path -eq '/api/userdata/list' -and $method -eq 'GET') {
                # 列出 userdata 目录下所有 .json 文件（含前缀文件名，供前端筛选用户配置文件）
                $files = Get-ChildItem -Path $userdataDir -File -ErrorAction SilentlyContinue |
                    Where-Object { $_.Extension.ToLower() -eq '.json' } |
                    Select-Object -ExpandProperty Name | Sort-Object
                Send-JsonResponse $response @{success=$true; files=@($files)}
            }
            elseif ($path -like '/api/userdata/file/*') {
                # 用户数据文件读写：userdata/{name}.json（preferences/ai_config/ai_questions）
                $fname = [System.IO.Path]::GetFileName($path.Substring('/api/userdata/file/'.Length))
                $fpath = Join-Path $userdataDir $fname
                if ($method -eq 'GET') {
                    if (Test-Path $fpath) {
                        try {
                            $content = Get-Content $fpath -Raw -Encoding UTF8 | ConvertFrom-Json
                        } catch {
                            # 配置文件损坏（如写入被中断产生半截 JSON）时返回空数据，避免 500 导致无法登录
                            $content = $null
                        }
                        Send-JsonResponse $response @{success=$true; data=$content}
                    } else {
                        Send-JsonResponse $response @{success=$true; data=$null}
                    }
                }
                elseif ($method -eq 'POST') {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                    $json = $reader.ReadToEnd()
                    $reader.Dispose()
                    $payload = $json | ConvertFrom-Json
                    $dataJson = $payload.data | ConvertTo-Json -Depth 10 -Compress
                    [System.IO.File]::WriteAllText($fpath, $dataJson, (New-Object System.Text.UTF8Encoding($false)))
                    Send-JsonResponse $response @{success=$true}
                }
                elseif ($method -eq 'DELETE') {
                    if (Test-Path $fpath) { Remove-Item $fpath -Force }
                    Send-JsonResponse $response @{success=$true}
                }
                else {
                    $response.StatusCode = 405
                    $response.Close()
                }
            }
            else {
                # 静态文件服务
                $relative = $path.TrimStart('/').Replace('/', '\')
                if ([string]::IsNullOrWhiteSpace($relative)) {
                    $relative = 'app.html'
                }
                $filePath = Join-Path $root $relative
                $filePath = [System.IO.Path]::GetFullPath($filePath)
                $rootFull = [System.IO.Path]::GetFullPath($root)

                # 防止目录遍历
                if (-not $filePath.StartsWith($rootFull)) {
                    $response.StatusCode = 403
                    $response.Close()
                    continue
                }

                if (-not (Test-Path $filePath -PathType Leaf)) {
                    $response.StatusCode = 404
                    $response.Close()
                    continue
                }

                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = $mimeMap[$ext]
                if (-not $contentType) { $contentType = 'application/octet-stream' }

                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                Send-BytesResponse $response $bytes $contentType
            }
        }
        catch {
            # 错误响应本身失败时不能让异常冒泡杀死服务器循环
            try { Send-ErrorResponse $response $_.Exception.Message } catch {}
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
