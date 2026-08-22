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

$allowedExt = @('.png','.jpg','.jpeg','.gif','.webp','.bmp')

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
}

function Send-JsonResponse($response, $obj, $statusCode = 200) {
    try {
        $body = ($obj | ConvertTo-Json -Compress -Depth 10)
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $response.StatusCode = $statusCode
        $response.ContentType = 'application/json; charset=utf-8'
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
        # 客户端提前断开时，响应写入失败不应终止服务器
    } finally {
        try { $response.Close() } catch {}
    }
}

function Send-BytesResponse($response, $bytes, $contentType) {
    try {
        $response.ContentType = $contentType
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
        # 客户端提前断开时，响应写入失败不应终止服务器
    } finally {
        try { $response.Close() } catch {}
    }
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

Write-Host "服务器已启动: http://localhost:$Port/app0801.html"
Write-Host "项目目录: $root"
Write-Host "壁纸目录: $wallpaperDir"

try {
    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
        } catch {
            if ($listener.IsListening) {
                Write-Warning "接收请求失败：$($_.Exception.Message)"
                continue
            }
            break
        }
        try {
            $request = $context.Request
            $response = $context.Response
            $path = $request.Url.LocalPath
            $method = $request.HttpMethod

            # CORS 头
            $response.Headers.Add('Access-Control-Allow-Origin', '*')
            $response.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
            $response.Headers.Add('Access-Control-Allow-Headers', 'Content-Type')

            if ($method -eq 'OPTIONS') {
                $response.StatusCode = 204
                $response.Close()
                continue
            }

            if ($path -eq '/api/wallpapers' -and $method -eq 'GET') {
                $files = Get-ChildItem -Path $wallpaperDir -File -ErrorAction SilentlyContinue |
                    Where-Object { $allowedExt -contains $_.Extension.ToLower() } |
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
                $securityProtocol = [System.Net.SecurityProtocolType]::Tls12
                if ([System.Enum]::GetNames([System.Net.SecurityProtocolType]) -contains 'Tls13') {
                    $securityProtocol = $securityProtocol -bor ([System.Net.SecurityProtocolType][System.Enum]::Parse([System.Net.SecurityProtocolType], 'Tls13'))
                }
                [System.Net.ServicePointManager]::SecurityProtocol = $securityProtocol
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
                    $statusCode = 502
                    if ($we.Exception.Response) {
                        $statusCode = [int]$we.Exception.Response.StatusCode
                    }
                    $status = 'HTTP ' + $statusCode
                    $errBody = ''
                    try {
                        if (-not $we.Exception.Response) { throw '上游未返回 HTTP 响应' }
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
            else {
                # 静态文件服务
                $relative = $path.TrimStart('/').Replace('/', '\')
                if ([string]::IsNullOrWhiteSpace($relative)) {
                    $relative = 'app0801.html'
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
            try { Send-ErrorResponse $response $_.Exception.Message } catch {}
        }
    }
} finally {
    try { $listener.Stop() } catch {}
    try { $listener.Close() } catch {}
}
