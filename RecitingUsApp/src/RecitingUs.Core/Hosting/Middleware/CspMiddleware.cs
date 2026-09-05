using System.Net;
namespace RecitingUs.Core;

/// <summary>所有响应附加安全头（v3 §10.1）。CSP 允许内联 script/style（经典零构建模式需要）。</summary>
public static class CspMiddleware
{
    public const string Policy =
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; " +
        "font-src 'self' data:; " +
        "connect-src 'self'; " +
        "media-src 'self' blob:; " +
        "object-src 'none'; " +
        "frame-ancestors 'none'";

    public static void Apply(HttpListenerResponse response)
    {
        try
        {
            response.Headers["Content-Security-Policy"] = Policy;
            response.Headers["X-Content-Type-Options"] = "nosniff";
            response.Headers["X-Frame-Options"] = "DENY";
            response.Headers["Referrer-Policy"] = "no-referrer";
        }
        catch { /* 某些受限头在特定平台抛异常，忽略 */ }
    }
}
