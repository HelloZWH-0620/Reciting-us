using System.Reflection;

namespace RecitingUs.Core;

/// <summary>
/// 程序集内嵌 Web 资源索引（自恢复源码整理）。
/// 资源名形如 "web/app.html"、"web/config\articles.json"，查询键统一为 "/app.html"、"/config/articles.json"。
/// </summary>
public static class WebAssets
{
    private static readonly Dictionary<string, string> _map = new(StringComparer.OrdinalIgnoreCase);
    private static Assembly _assembly = typeof(WebAssets).Assembly;

    /// <summary>扫描程序集中以 web/ 开头的内嵌资源并建立路由映射。</summary>
    public static void Initialize(Assembly? assembly = null)
    {
        _assembly = assembly ?? typeof(WebAssets).Assembly;
        _map.Clear();
        foreach (var name in _assembly.GetManifestResourceNames())
        {
            if (!name.StartsWith("web/", StringComparison.OrdinalIgnoreCase)) continue;
            var key = "/" + name.Substring("web/".Length).Replace('\\', '/');
            _map[key] = name;
        }
    }

    /// <summary>解析请求路径到内嵌资源名；"/" 与目录尾斜杠回退到 app.html。</summary>
    public static string? Resolve(string path)
    {
        if (string.IsNullOrEmpty(path) || path == "/") path = "/app.html";
        path = path.Replace('\\', '/').TrimStart('/');
        if (path.EndsWith("/")) path += "app.html";
        var key = "/" + path;
        if (_map.TryGetValue(key, out var value)) return value;
        if (_map.TryGetValue(key + "index.html", out value)) return value;
        return null;
    }

    public static Stream? Open(string resourceName) =>
        _assembly.GetManifestResourceStream(resourceName);

    public static IEnumerable<string> AllPaths() => _map.Keys.OrderBy(k => k, StringComparer.Ordinal);
}
