using System.Net;
using System.Text;
using System.Text.Json;

namespace RecitingUs.Core;

/// <summary>统一 JSON 响应与错误码（v3 §5.4）。</summary>
public static class ApiResponse
{
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping // 中文直出
    };

    public static void Json(HttpListenerResponse r, object obj, int code = 200)
    {
        try
        {
            r.StatusCode = code;
            r.ContentType = "application/json; charset=utf-8";
            var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(obj, _jsonOptions));
            r.ContentLength64 = bytes.Length;
            r.OutputStream.Write(bytes, 0, bytes.Length);
            r.OutputStream.Close();
        }
        catch { /* 客户端断开等 */ }
    }

    public static void Error(HttpListenerResponse r, int code, string msg, string? errorCode = null) =>
        Json(r, new { ok = false, success = false, error = msg, errorCode = errorCode ?? DefaultErrorCode(code) }, code);

    public static string DefaultErrorCode(int code) => code switch
    {
        400 => "BAD_REQUEST",
        403 => "FORBIDDEN_HOST",
        404 => "NOT_FOUND",
        409 => "CONFLICT",
        413 => "PAYLOAD_TOO_LARGE",
        429 => "RATE_LIMITED",
        500 => "NO_KEY",
        502 => "BAD_GATEWAY",
        503 => "CIRCUIT_OPEN",
        504 => "TIMEOUT",
        _ => "INTERNAL"
    };
}
