using System.Diagnostics;
using System.Net;
using System.IO.Compression;
using System.Text;
using System.Text.Json;

namespace RecitingUs.Core;

/// <summary>
/// 请求调度（v3 §5.2 中间件管道）：日志 → 安全头 → 限流 → API 路由 / 静态资源（ETag + gzip）。
/// API 响应保持与既有前端契约一致：{success: true/false, ...}。
/// </summary>
public static class Router
{
    private const long DefaultBodyLimit = 10 * 1024 * 1024;
    private const long WallpaperBodyLimit = 8 * 1024 * 1024;

    private static readonly JsonSerializerOptions _caseInsensitive = new() { PropertyNameCaseInsensitive = true };

    public static async Task DispatchAsync(HttpListenerContext ctx, EmbeddedHttpServer server)
    {
        var req = ctx.Request;
        var resp = ctx.Response;
        var path = req.Url?.AbsolutePath ?? "/";
        var method = req.HttpMethod;
        var sw = Stopwatch.StartNew();

        CspMiddleware.Apply(resp);
        ApplyCors(resp, req);

        if (method == "OPTIONS")
        {
            resp.StatusCode = 204;
            resp.OutputStream.Close();
            return;
        }

        try
        {
            if (path.StartsWith("/api/"))
            {
                await DispatchApiAsync(ctx, server, path, method).ConfigureAwait(false);
            }
            else
            {
                ServeStatic(ctx, path);
            }
        }
        catch (Exception ex)
        {
            AppLogger.Error($"处理 {method} {path} 失败", ex);
            // 兼容旧前端：业务异常以 200 + success:false 返回（前端按 data.success 判断）
            try { ApiResponse.Json(resp, new { success = false, error = ex.Message }); } catch { }
        }
        finally
        {
            AppLogger.Info($"{method} {path} -> {resp.StatusCode} {sw.ElapsedMilliseconds}ms");
        }
    }

    private static void ApplyCors(HttpListenerResponse resp, HttpListenerRequest req)
    {
        // 同源部署本不需要 CORS；回显 loopback 来源以兼容 127.0.0.1/localhost 混用场景
        var origin = req.Headers["Origin"];
        if (string.IsNullOrEmpty(origin)) return;
        if (origin.Contains("localhost", StringComparison.OrdinalIgnoreCase) ||
            origin.Contains("127.0.0.1", StringComparison.OrdinalIgnoreCase))
        {
            resp.Headers["Access-Control-Allow-Origin"] = origin;
            resp.Headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS";
            resp.Headers["Access-Control-Allow-Headers"] = "Content-Type";
        }
    }

    // ---------------- API 路由 ----------------

    private static async Task DispatchApiAsync(HttpListenerContext ctx, EmbeddedHttpServer server, string path, string method)
    {
        var resp = ctx.Response;

        // 请求体大小限制（v3 §10.2）
        if (method is "POST" or "PUT")
        {
            var limit = path == "/api/upload-wallpaper" ? WallpaperBodyLimit : DefaultBodyLimit;
            if (ctx.Request.ContentLength64 > limit)
            {
                ApiResponse.Error(resp, 413, "请求体超过大小限制");
                return;
            }
        }

        switch (path, method)
        {
            case ("/api/version", "GET"):
                ServeVersion(resp);
                return;
            case ("/api/health", "GET"):
                ApiResponse.Json(resp, new
                {
                    ok = true,
                    success = true,
                    status = "ok",
                    dbSchema = AppDb.CurrentSchemaVersion,
                    apiLevel = 2,
                    uptime = server.UptimeSeconds,
                    port = server.Port
                });
                return;
            case ("/api/log", "POST") or ("/api/logs", "POST"):
                await HandleLogPostAsync(ctx).ConfigureAwait(false);
                return;
            case ("/api/logs", "GET"):
                ApiResponse.Json(resp, new
                {
                    success = true,
                    logs = AppLogger.GetRecent(50).Select(e => new { e.Timestamp, e.Level, e.Message })
                });
                return;
            case ("/api/wallpapers", "GET"):
                ApiResponse.Json(resp, new { success = true, files = ListFiles(server, "wallpapers", MimeMap.IsImage) });
                return;
            case ("/api/audio-files", "GET"):
                ApiResponse.Json(resp, new { success = true, files = ListFiles(server, "audio", MimeMap.IsAudio) });
                return;
            case ("/api/upload-wallpaper", "POST"):
                await UploadWallpaperAsync(ctx, server).ConfigureAwait(false);
                return;
            case var p when p.Item1.StartsWith("/api/wallpapers/") && p.Item2 == "DELETE":
                DeleteWallpaper(server, resp, path);
                return;
            case ("/api/ai-proxy", "POST"):
                await HandleAiProxyAsync(ctx, server).ConfigureAwait(false);
                return;
            case ("/api/userdata/list", "GET"):
                ApiResponse.Json(resp, new
                {
                    success = true,
                    files = ListFiles(server, "userdata", f => f.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
                });
                return;
            case var p when p.Item1.StartsWith("/api/userdata/file/"):
                await HandleUserDataFileAsync(ctx, server, path, method).ConfigureAwait(false);
                return;
            case ("/api/progress", "GET"):
                await HandleProgressGetAsync(server, resp).ConfigureAwait(false);
                return;
            case ("/api/progress", "POST"):
                await HandleProgressPostAsync(ctx, server).ConfigureAwait(false);
                return;
            case ("/api/wrong-book", "GET"):
                await HandleWrongBookGetAsync(server, resp).ConfigureAwait(false);
                return;
            case ("/api/wrong-book", "POST"):
                await HandleWrongBookPostAsync(ctx, server).ConfigureAwait(false);
                return;
            case var p when p.Item1.StartsWith("/api/wrong-book/") && p.Item2 == "DELETE":
                await HandleWrongBookDeleteAsync(server, resp, path).ConfigureAwait(false);
                return;
            case ("/api/stats", "GET"):
                await HandleStatsGetAsync(ctx, server, resp).ConfigureAwait(false);
                return;
            case ("/api/import", "POST"):
                await HandleImportAsync(ctx, server).ConfigureAwait(false);
                return;
            case ("/api/export", "POST") or ("/api/export", "GET"):
                await HandleExportAsync(server, resp).ConfigureAwait(false);
                return;
            case ("/api/tts/voices", "GET"):
                HandleTtsVoices(server, resp);
                return;
            case ("/api/tts/speak", "POST"):
                await HandleTtsSpeakAsync(ctx, server).ConfigureAwait(false);
                return;
            case ("/api/tts/stop", "POST"):
                HandleTtsStop(server, resp);
                return;
            case ("/api/content/articles", "GET"):
                ServeContentJson(resp, "config/articles.json");
                return;
            case ("/api/content/poems", "GET"):
                ServeContentJson(resp, "config/poem.json");
                return;
            case ("/api/content/games", "GET"):
                ServeContentJson(resp, "config/game.json");
                return;
            case ("/api/content/writers", "GET"):
                ServeContentJson(resp, "config/writer.json");
                return;
            default:
                ApiResponse.Error(resp, 404, $"未知 API: {method} {path}");
                return;
        }
    }

    // ---------------- 版本 / 内容 ----------------

    /// <summary>与原版一致：直接回传内嵌 config/version.json。</summary>
    private static void ServeVersion(HttpListenerResponse resp) => ServeAsset(resp, "/config/version.json");

    private static void ServeContentJson(HttpListenerResponse resp, string assetPath) => ServeAsset(resp, assetPath);

    private static void ServeAsset(HttpListenerResponse resp, string assetPath)
    {
        using var stream = StaticAssetResolver.Open(assetPath, out var mime, out _);
        if (stream is null)
        {
            ApiResponse.Error(resp, 404, "内容不存在");
            return;
        }
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        var bytes = ms.ToArray();
        resp.ContentType = mime;
        resp.ContentLength64 = bytes.Length;
        resp.OutputStream.Write(bytes, 0, bytes.Length);
        resp.OutputStream.Close();
    }

    // ---------------- 文件列表 / 壁纸 ----------------

    private static string[] ListFiles(EmbeddedHttpServer server, string subDir, Func<string, bool> filter)
    {
        var dir = Path.Combine(server.Platform.DataDir, subDir);
        if (!Directory.Exists(dir)) return Array.Empty<string>();
        return Directory.EnumerateFiles(dir)
            .Select(Path.GetFileName)
            .Where(f => f is not null && filter(f))
            .Cast<string>()
            .OrderBy(f => f, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static async Task UploadWallpaperAsync(HttpListenerContext ctx, EmbeddedHttpServer server)
    {
        var resp = ctx.Response;
        string raw;
        using (var reader = new StreamReader(ctx.Request.InputStream, Encoding.UTF8))
            raw = await reader.ReadToEndAsync().ConfigureAwait(false);

        WallpaperPayload? payload;
        try { payload = JsonSerializer.Deserialize<WallpaperPayload>(raw); }
        catch (JsonException) { payload = null; }

        if (payload is null || string.IsNullOrEmpty(payload.Data))
        {
            ApiResponse.Error(resp, 400, "图片数据格式错误");
            return;
        }

        // data:image/xxx;base64,....
        var match = System.Text.RegularExpressions.Regex.Match(payload.Data, "^data:image/[^;]+;base64,(.+)$",
            System.Text.RegularExpressions.RegexOptions.Singleline);
        if (!match.Success)
        {
            ApiResponse.Error(resp, 400, "图片数据格式错误");
            return;
        }

        var ext = Path.GetExtension(payload.Filename ?? "").ToLowerInvariant();
        if (!MimeMap.IsImage("x" + ext))
        {
            ApiResponse.Error(resp, 400, "不支持的图片格式");
            return;
        }

        byte[] bytes;
        try { bytes = Convert.FromBase64String(match.Groups[1].Value); }
        catch (FormatException)
        {
            ApiResponse.Error(resp, 400, "图片数据格式错误");
            return;
        }

        if (bytes.Length > WallpaperBodyLimit)
        {
            ApiResponse.Error(resp, 413, "图片超过 8MB 大小限制");
            return;
        }
        if (!MimeMap.MagicMatches(bytes, ext))
        {
            ApiResponse.Error(resp, 400, "图片内容与扩展名不符");
            return;
        }

        // 去除路径成分 + 去重命名
        var name = Path.GetFileName(System.Text.RegularExpressions.Regex.Replace(payload.Filename ?? "", "[^a-zA-Z0-9\\-_\\.]", "_"));
        if (string.IsNullOrWhiteSpace(name)) name = "wallpaper" + ext;
        var dir = Path.Combine(server.Platform.DataDir, "wallpapers");
        Directory.CreateDirectory(dir);
        var target = Path.Combine(dir, name);
        var stem = Path.GetFileNameWithoutExtension(name);
        var index = 1;
        while (File.Exists(target))
        {
            target = Path.Combine(dir, $"{stem}_{index}{ext}");
            name = Path.GetFileName(target);
            index++;
        }
        await File.WriteAllBytesAsync(target, bytes).ConfigureAwait(false);
        ApiResponse.Json(resp, new { success = true, ok = true, filename = name });
    }

    private sealed record WallpaperPayload(string? Data, string? Filename);

    private static void DeleteWallpaper(EmbeddedHttpServer server, HttpListenerResponse resp, string path)
    {
        var name = Path.GetFileName(path.Substring("/api/wallpapers/".Length));
        var target = Path.Combine(server.Platform.DataDir, "wallpapers", name);
        try
        {
            if (File.Exists(target)) File.Delete(target);
            ApiResponse.Json(resp, new { success = true });
        }
        catch (Exception e)
        {
            ApiResponse.Error(resp, 500, "删除失败: " + e.Message);
        }
    }

    // ---------------- 用户数据（文件型，兼容原版协议） ----------------

    private static async Task HandleUserDataFileAsync(HttpListenerContext ctx, EmbeddedHttpServer server, string path, string method)
    {
        var resp = ctx.Response;
        var name = Path.GetFileName(Uri.UnescapeDataString(path.Substring("/api/userdata/file/".Length)));
        if (string.IsNullOrWhiteSpace(name) || !name.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
        {
            ApiResponse.Error(resp, 400, "无效的文件名");
            return;
        }
        var dir = Path.Combine(server.Platform.DataDir, "userdata");
        Directory.CreateDirectory(dir);
        var file = Path.Combine(dir, name);

        switch (method)
        {
            case "GET":
            {
                object? data = null;
                if (File.Exists(file))
                {
                    try { data = JsonSerializer.Deserialize<object>(await File.ReadAllTextAsync(file).ConfigureAwait(false)); }
                    catch { data = null; }
                }
                ApiResponse.Json(resp, new { success = true, data });
                return;
            }
            case "POST" or "PUT":
            {
                try
                {
                    using var reader = new StreamReader(ctx.Request.InputStream, Encoding.UTF8);
                    using var doc = JsonDocument.Parse(await reader.ReadToEndAsync().ConfigureAwait(false));
                    var raw = doc.RootElement.GetProperty("data").GetRawText();
                    await File.WriteAllTextAsync(file, raw, new UTF8Encoding(false)).ConfigureAwait(false);
                    ApiResponse.Json(resp, new { success = true });
                }
                catch (Exception e) when (e is JsonException or KeyNotFoundException)
                {
                    ApiResponse.Error(resp, 400, "请求数据格式错误");
                }
                return;
            }
            case "DELETE":
                if (File.Exists(file)) File.Delete(file);
                ApiResponse.Json(resp, new { success = true });
                return;
            default:
                ApiResponse.Error(resp, 405, "方法不允许");
                return;
        }
    }

    // ---------------- AI 代理 ----------------

    private static async Task HandleAiProxyAsync(HttpListenerContext ctx, EmbeddedHttpServer server)
    {
        var resp = ctx.Response;

        if (!RateLimitMiddleware.TryAcquireAiProxy())
        {
            ApiResponse.Error(resp, 429, "请求过于频繁（10 次/分钟）");
            return;
        }

        AiProxyRequest? req;
        using (var reader = new StreamReader(ctx.Request.InputStream, Encoding.UTF8))
        {
            try
            {
                req = JsonSerializer.Deserialize<AiProxyRequest>(await reader.ReadToEndAsync().ConfigureAwait(false), _caseInsensitive);
            }
            catch (JsonException e)
            {
                ApiResponse.Error(resp, 400, $"请求格式错误: {e.Message}");
                return;
            }
        }
        if (req is null)
        {
            ApiResponse.Error(resp, 400, "请求体为空");
            return;
        }

        var (status, body) = await server.Ai.ForwardAsync(req, CancellationToken.None).ConfigureAwait(false);
        resp.StatusCode = status;
        resp.ContentType = "application/json; charset=utf-8";
        var bytes = Encoding.UTF8.GetBytes(body);
        resp.ContentLength64 = bytes.Length;
        await resp.OutputStream.WriteAsync(bytes).ConfigureAwait(false);
        resp.OutputStream.Close();
    }

    // ---------------- 进度 / 错题 / 统计（SQLite） ----------------

    private static async Task HandleProgressGetAsync(EmbeddedHttpServer server, HttpListenerResponse resp)
    {
        var rows = await server.Db.ExecuteReadAsync(
            "SELECT profile_id, article_id, mode, recited, mastery, due_at, last_review, review_count FROM progress",
            r => new ProgressRecord(r.GetString(0), r.GetString(1), r.GetString(2), r.GetInt64(3) != 0, r.GetInt32(4),
                r.IsDBNull(5) ? null : r.GetInt64(5), r.IsDBNull(6) ? null : r.GetInt64(6), r.GetInt32(7))).ConfigureAwait(false);
        ApiResponse.Json(resp, new { success = true, ok = true, records = rows });
    }

    private static async Task HandleProgressPostAsync(HttpListenerContext ctx, EmbeddedHttpServer server)
    {
        var records = await ReadJsonListAsync<ProgressRecord>(ctx.Request).ConfigureAwait(false);
        if (records is null) { ApiResponse.Error(ctx.Response, 400, "请求格式错误"); return; }
        var count = 0;
        await server.Db.ExecuteInTransactionAsync(async (conn, tx) =>
        {
            foreach (var p in records)
            {
                using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = """
                    INSERT INTO progress(profile_id, article_id, mode, recited, mastery, due_at, last_review, review_count)
                    VALUES (@p, @a, @m, @r, @ma, @d, @lr, @rc)
                    ON CONFLICT(profile_id, article_id, mode) DO UPDATE SET
                      recited=excluded.recited, mastery=excluded.mastery, due_at=excluded.due_at,
                      last_review=excluded.last_review, review_count=excluded.review_count;
                    """;
                cmd.Parameters.AddWithValue("@p", p.ProfileId);
                cmd.Parameters.AddWithValue("@a", p.ArticleId);
                cmd.Parameters.AddWithValue("@m", p.Mode);
                cmd.Parameters.AddWithValue("@r", p.Recited ? 1 : 0);
                cmd.Parameters.AddWithValue("@ma", p.Mastery);
                cmd.Parameters.AddWithValue("@d", p.DueAt ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("@lr", p.LastReview ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("@rc", p.ReviewCount);
                await cmd.ExecuteNonQueryAsync().ConfigureAwait(false);
                count++;
            }
        }).ConfigureAwait(false);
        ApiResponse.Json(ctx.Response, new { success = true, ok = true, imported = count });
    }

    private static async Task HandleWrongBookGetAsync(EmbeddedHttpServer server, HttpListenerResponse resp)
    {
        var rows = await server.Db.ExecuteReadAsync(
            "SELECT id, profile_id, article_id, type, prompt, answer, user_answer, mastered, created_at FROM wrong_book ORDER BY created_at DESC LIMIT 2000",
            r => new WrongItem(r.GetInt64(0), r.GetString(1), r.IsDBNull(2) ? null : r.GetString(2), r.GetString(3),
                r.GetString(4), r.IsDBNull(5) ? null : r.GetString(5), r.IsDBNull(6) ? null : r.GetString(6),
                r.GetInt64(7) != 0, r.GetInt64(8))).ConfigureAwait(false);
        ApiResponse.Json(resp, new { success = true, ok = true, items = rows });
    }

    private static async Task HandleWrongBookPostAsync(HttpListenerContext ctx, EmbeddedHttpServer server)
    {
        var items = await ReadJsonListAsync<WrongItem>(ctx.Request).ConfigureAwait(false);
        if (items is null) { ApiResponse.Error(ctx.Response, 400, "请求格式错误"); return; }
        var ids = new List<long>();
        await server.Db.ExecuteInTransactionAsync(async (conn, tx) =>
        {
            foreach (var w in items)
            {
                using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = """
                    INSERT INTO wrong_book(profile_id, article_id, type, prompt, answer, user_answer, mastered, created_at)
                    VALUES (@p, @a, @t, @pr, @an, @ua, @m, @c);
                    SELECT last_insert_rowid();
                    """;
                cmd.Parameters.AddWithValue("@p", w.ProfileId);
                cmd.Parameters.AddWithValue("@a", w.ArticleId ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("@t", w.Type);
                cmd.Parameters.AddWithValue("@pr", w.Prompt);
                cmd.Parameters.AddWithValue("@an", w.Answer ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("@ua", w.UserAnswer ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("@m", w.Mastered ? 1 : 0);
                cmd.Parameters.AddWithValue("@c", w.CreatedAt == 0 ? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() : w.CreatedAt);
                var id = await cmd.ExecuteScalarAsync().ConfigureAwait(false);
                ids.Add(Convert.ToInt64(id));
            }
        }).ConfigureAwait(false);
        ApiResponse.Json(ctx.Response, new { success = true, ok = true, ids });
    }

    private static async Task HandleWrongBookDeleteAsync(EmbeddedHttpServer server, HttpListenerResponse resp, string path)
    {
        var idStr = path.Substring("/api/wrong-book/".Length);
        if (!long.TryParse(idStr, out var id))
        {
            ApiResponse.Error(resp, 400, "无效的 id");
            return;
        }
        await server.Db.ExecuteWriteAsync("DELETE FROM wrong_book WHERE id = @id", ("@id", id)).ConfigureAwait(false);
        ApiResponse.Json(resp, new { success = true });
    }

    private static async Task HandleStatsGetAsync(HttpListenerContext ctx, EmbeddedHttpServer server, HttpListenerResponse resp)
    {
        var query = ctx.Request.Url?.Query ?? "";
        var from = QueryParam(query, "from");
        var to = QueryParam(query, "to");
        var sql = "SELECT day, practice_count, correct_count, study_seconds, articles_read FROM stats_daily WHERE profile_id = @p";
        if (!string.IsNullOrEmpty(from)) sql += " AND day >= @from";
        if (!string.IsNullOrEmpty(to)) sql += " AND day <= @to";
        sql += " ORDER BY day";

        var rows = await server.Db.ExecuteReadAsync(sql,
            r => new StatsPoint(r.GetString(0), r.GetInt32(1), r.GetInt32(2), r.GetInt32(3), r.GetInt32(4)),
            ("@p", "default"), ("@from", (object?)from), ("@to", (object?)to)).ConfigureAwait(false);
        ApiResponse.Json(resp, new { success = true, ok = true, points = rows });
    }

    private static string? QueryParam(string query, string name)
    {
        if (string.IsNullOrEmpty(query)) return null;
        foreach (var pair in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var kv = pair.Split('=', 2);
            if (kv.Length == 2 && kv[0] == name) return Uri.UnescapeDataString(kv[1]);
        }
        return null;
    }

    // ---------------- 导入 / 导出 ----------------

    private static async Task HandleImportAsync(HttpListenerContext ctx, EmbeddedHttpServer server)
    {
        try
        {
            var summary = await server.Migration.ImportAsync(ctx.Request.InputStream).ConfigureAwait(false);
            ApiResponse.Json(ctx.Response, summary);
        }
        catch (InvalidOperationException e)
        {
            ApiResponse.Error(ctx.Response, 409, e.Message, "CONFLICT");
        }
        catch (InvalidDataException e)
        {
            ApiResponse.Error(ctx.Response, 400, e.Message, "BAD_REQUEST");
        }
    }

    private static async Task HandleExportAsync(EmbeddedHttpServer server, HttpListenerResponse resp)
    {
        var archive = await server.Migration.ExportAsync().ConfigureAwait(false);
        ApiResponse.Json(resp, archive);
    }

    // ---------------- TTS ----------------

    private static void HandleTtsVoices(EmbeddedHttpServer server, HttpListenerResponse resp)
    {
        var tts = server.Tts;
        var voices = (tts?.IsAvailable == true ? tts.GetVoices() : Array.Empty<TtsVoice>())
            .Select(v => new { id = v.Id, name = v.Name, lang = v.Lang });
        ApiResponse.Json(resp, new { success = true, ok = true, available = tts?.IsAvailable == true, voices });
    }

    private static async Task HandleTtsSpeakAsync(HttpListenerContext ctx, EmbeddedHttpServer server)
    {
        TtsSpeakPayload? payload = null;
        try
        {
            using var reader = new StreamReader(ctx.Request.InputStream, Encoding.UTF8);
            payload = JsonSerializer.Deserialize<TtsSpeakPayload>(await reader.ReadToEndAsync().ConfigureAwait(false));
        }
        catch (JsonException) { }

        if (payload is null || string.IsNullOrWhiteSpace(payload.Text))
        {
            ApiResponse.Error(ctx.Response, 400, "缺少 text");
            return;
        }
        var tts = server.Tts;
        if (tts is null || !tts.IsAvailable)
        {
            // 前端据此回退 speechSynthesis
            ApiResponse.Json(ctx.Response, new { success = false, ok = false, fallback = true, error = "原生 TTS 不可用" }, 501);
            return;
        }
        tts.Speak(payload.Text, (float)(payload.Rate ?? 1.0), payload.Voice);
        ctx.Response.StatusCode = 204;
        ctx.Response.OutputStream.Close();
    }

    private sealed record TtsSpeakPayload(string? Text, double? Rate, string? Voice);

    private static void HandleTtsStop(EmbeddedHttpServer server, HttpListenerResponse resp)
    {
        try { server.Tts?.Stop(); } catch (Exception e) { AppLogger.Warn("TTS stop 失败: " + e.Message); }
        resp.StatusCode = 204;
        resp.OutputStream.Close();
    }

    // ---------------- 前端日志上报 ----------------

    private static async Task HandleLogPostAsync(HttpListenerContext ctx)
    {
        try
        {
            using var reader = new StreamReader(ctx.Request.InputStream, Encoding.UTF8);
            using var doc = JsonDocument.Parse(await reader.ReadToEndAsync().ConfigureAwait(false));
            var level = doc.RootElement.TryGetProperty("level", out var lv) ? lv.GetString() ?? "INFO" : "INFO";
            var message = doc.RootElement.TryGetProperty("message", out var msg) ? msg.GetString() ?? "" : "";
            var normalized = level.ToUpperInvariant() is "INFO" or "WARN" or "ERROR" ? level.ToUpperInvariant() : "INFO";
            if (normalized == "ERROR") AppLogger.Error($"[web] {message}");
            else if (normalized == "WARN") AppLogger.Warn($"[web] {message}");
            else AppLogger.Info($"[web] {message}");
            ApiResponse.Json(ctx.Response, new { success = true });
        }
        catch
        {
            ApiResponse.Json(ctx.Response, new { success = false });
        }
    }

    // ---------------- 静态资源（ETag + gzip） ----------------

    private static void ServeStatic(HttpListenerContext ctx, string path)
    {
        var resp = ctx.Response;
        var ifNoneMatch = ctx.Request.Headers["If-None-Match"];

        using var stream = StaticAssetResolver.Open(path, out var mime, out var etag);
        if (stream is null)
        {
            resp.StatusCode = 404;
            resp.ContentType = "text/plain; charset=utf-8";
            var notFound = Encoding.UTF8.GetBytes("404 Not Found");
            resp.ContentLength64 = notFound.Length;
            resp.OutputStream.Write(notFound, 0, notFound.Length);
            resp.OutputStream.Close();
            return;
        }

        if (etag is not null && string.Equals(ifNoneMatch, etag, StringComparison.Ordinal))
        {
            resp.StatusCode = 304;
            resp.OutputStream.Close();
            return;
        }

        resp.ContentType = mime;
        if (etag is not null) resp.Headers["ETag"] = etag;
        resp.Headers["Cache-Control"] = "public, max-age=3600";

        var acceptEncoding = ctx.Request.Headers["Accept-Encoding"] ?? "";
        if (IsCompressible(mime) && acceptEncoding.Contains("gzip", StringComparison.OrdinalIgnoreCase))
        {
            resp.Headers["Content-Encoding"] = "gzip";
            resp.SendChunked = true;
            using var gzip = new GZipStream(resp.OutputStream, CompressionLevel.Fastest, leaveOpen: true);
            stream.CopyTo(gzip);
            gzip.Flush();
        }
        else
        {
            resp.SendChunked = true;
            stream.CopyTo(resp.OutputStream);
        }
        resp.OutputStream.Close();
    }

    private static bool IsCompressible(string mime) =>
        mime.StartsWith("text/") || mime.Contains("json") || mime.Contains("javascript") || mime.Contains("svg");

    // ---------------- 工具：接受单对象或数组的 JSON 读取 ----------------

    private static async Task<List<T>?> ReadJsonListAsync<T>(HttpListenerRequest request)
    {
        try
        {
            using var reader = new StreamReader(request.InputStream, Encoding.UTF8);
            using var doc = JsonDocument.Parse(await reader.ReadToEndAsync().ConfigureAwait(false));
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.Array)
                return JsonSerializer.Deserialize<List<T>>(root.GetRawText(), _caseInsensitive);
            var single = JsonSerializer.Deserialize<T>(root.GetRawText(), _caseInsensitive);
            return single is null ? null : new List<T> { single };
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
