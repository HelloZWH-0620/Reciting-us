using System.Text;
using System.Text.Json;
using RecitingUs.Core.Platform;

namespace RecitingUs.Core;

/// <summary>AI 代理请求体（与前端 callAI 的 {url, apiKey, model, messages, temperature, extra} 协议一致）。</summary>
public sealed record AiProxyRequest(
    string? Url,
    string? ApiKey,
    string? Model,
    JsonElement? Messages,
    double? Temperature,
    JsonElement? Extra,
    JsonElement? Body);

/// <summary>
/// AI 代理（v3 §5.5）：域名白名单 + 密钥原生保管（请求带 key 优先，否则查平台安全存储）
/// + 断路器（5 次失败熔断 60 秒）。日志只记录前 200 字符、绝不记录 Authorization。
/// </summary>
public sealed class AiProxyService(IPlatformServices platform)
{
    private static readonly HashSet<string> _allowedHosts = new(StringComparer.OrdinalIgnoreCase)
    {
        "api.openai.com", "api.deepseek.com", "api.siliconflow.cn",
        "dashscope.aliyuncs.com", "open.bigmodel.cn", "api.moonshot.cn", "api.moonshot.com",
        "localhost", "127.0.0.1"
    };

    // 生成式 AI 上游响应可能远超 30 秒（长文出题/批改），沿用原版 120 秒（对 v3 30s 的有意偏离，保兼容）。
    private static readonly TimeSpan UpstreamTimeout = TimeSpan.FromSeconds(120);
    internal static readonly CircuitBreaker Breaker = new(failureThreshold: 5, openDurationSeconds: 60);

    public bool IsHostAllowed(string host) =>
        _allowedHosts.Contains(host) || platform.IsExtraAiHostAllowed(host);

    public async Task<(int Status, string Body)> ForwardAsync(AiProxyRequest req, CancellationToken ct)
    {
        if (Breaker.IsOpen)
            return (503, """{"ok":false,"success":false,"error":"AI 上游连续失败，已熔断 60 秒","errorCode":"CIRCUIT_OPEN"}""");

        if (string.IsNullOrWhiteSpace(req.Url))
            return (400, """{"ok":false,"success":false,"error":"缺少目标 URL","errorCode":"BAD_REQUEST"}""");

        string host;
        var uri = new Uri(req.Url);
        host = uri.Host;
        if (!IsHostAllowed(host))
            return (403, """{"ok":false,"success":false,"error":"目标域名不在白名单","errorCode":"FORBIDDEN_HOST"}""");

        // 密钥：请求自带优先；否则从原生安全存储取（按主机名分段），绝不下发前端
        var key = req.ApiKey;
        if (string.IsNullOrEmpty(key)) key = platform.GetSecret("ai:" + host);
        if (string.IsNullOrEmpty(key)) key = platform.GetSecret("ai:" + req.Model);

        using var http = new HttpClient { Timeout = UpstreamTimeout };
        using var upstream = new HttpRequestMessage(HttpMethod.Post, uri)
        {
            Content = new StringContent(BuildUpstreamBody(req), Encoding.UTF8, "application/json")
        };
        if (!string.IsNullOrEmpty(key))
            upstream.Headers.Add("Authorization", $"Bearer {key}");

        try
        {
            var resp = await http.SendAsync(upstream, ct).ConfigureAwait(false);
            var body = await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            AppLogger.Info($"AI 代理 {host} -> {(int)resp.StatusCode} ({body.Length}B) {Truncate(body)}");
            Breaker.RecordSuccess();
            return ((int)resp.StatusCode, body);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            Breaker.RecordFailure();
            return (504, """{"ok":false,"success":false,"error":"上游超时","errorCode":"TIMEOUT"}""");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or IOException)
        {
            Breaker.RecordFailure();
            AppLogger.Error("AI 代理请求失败", ex);
            return (502, """{"ok":false,"success":false,"error":"上游连接失败","errorCode":"BAD_GATEWAY"}""");
        }
    }

    /// <summary>按原版协议组装上游请求体：{model, messages, temperature, stream:false} + extra 展开。</summary>
    private static string BuildUpstreamBody(AiProxyRequest req)
    {
        // 前端已发送完整 OpenAI 兼容体时直接透传
        if (req.Body is { ValueKind: JsonValueKind.Object } body)
            return body.GetRawText();

        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            writer.WriteString("model", req.Model ?? "");
            if (req.Messages is { ValueKind: JsonValueKind.Array } messages)
            {
                writer.WritePropertyName("messages");
                messages.WriteTo(writer);
            }
            writer.WriteNumber("temperature", req.Temperature ?? 0.7);
            writer.WriteBoolean("stream", false);
            if (req.Extra is { ValueKind: JsonValueKind.Object } extra)
            {
                foreach (var prop in extra.EnumerateObject())
                {
                    writer.WritePropertyName(prop.Name);
                    prop.Value.WriteTo(writer);
                }
            }
            writer.WriteEndObject();
        }
        return Encoding.UTF8.GetString(stream.ToArray());
    }

    private static string Truncate(string s) =>
        s.Length <= 200 ? s : s[..200] + "…";
}
