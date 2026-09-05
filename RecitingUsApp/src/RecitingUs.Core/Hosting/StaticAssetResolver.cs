using RecitingUs.Core.Platform;

namespace RecitingUs.Core;

/// <summary>
/// 静态资源解析：外置覆盖目录（热更）优先 → 程序集内嵌快照兜底。
/// 所有路径经 Normalize 归一化，杜绝路径穿越。
/// </summary>
public static class StaticAssetResolver
{
    private static Func<string>? _overrideDirProvider;

    /// <summary>设置热更覆盖目录（宿主启动时调用；传 null 禁用）。</summary>
    public static void Configure(IPlatformServices? platform)
    {
        _overrideDirProvider = platform is null ? null : () => platform.OverrideDir;
    }

    public static Stream? Open(string path, out string mime, out string? etag)
    {
        mime = "application/octet-stream";
        etag = null;
        var safe = Normalize(path);
        if (safe is null) return null;

        // 1) 外置覆盖（开发热更 / adb push 调试）
        var overrideDir = _overrideDirProvider?.Invoke();
        if (!string.IsNullOrEmpty(overrideDir))
        {
            var physical = Path.Combine(overrideDir, safe.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(physical))
            {
                mime = MimeMap.Get(safe);
                etag = ComputeEtag(physical);
                return File.OpenRead(physical);
            }
        }

        // 2) 内嵌快照
        var resourceName = WebAssets.Resolve("/" + safe);
        if (resourceName is null) return null;
        mime = MimeMap.Get(safe);
        etag = EmbeddedEtag(resourceName);
        return WebAssets.Open(resourceName);
    }

    /// <summary>是否存在（覆盖目录或内嵌），不打开流。</summary>
    public static bool Exists(string path)
    {
        var safe = Normalize(path);
        if (safe is null) return false;
        var overrideDir = _overrideDirProvider?.Invoke();
        if (!string.IsNullOrEmpty(overrideDir) &&
            File.Exists(Path.Combine(overrideDir, safe.Replace('/', Path.DirectorySeparatorChar))))
            return true;
        return WebAssets.Resolve("/" + safe) is not null;
    }

    /// <summary>
    /// 归一化请求路径：URL 解码、拒绝穿越段与盘符、拒绝隐藏非法字符。
    /// 返回形如 "config/articles.json" 的相对路径；非法输入返回 null。
    /// </summary>
    public static string? Normalize(string? rawPath)
    {
        if (string.IsNullOrWhiteSpace(rawPath)) return null;

        // 先解码再校验，防止 %2e%2e 绕过
        string decoded;
        try { decoded = Uri.UnescapeDataString(rawPath); }
        catch (UriFormatException) { return null; }

        decoded = decoded.Replace('\\', '/');
        var trimmed = decoded.TrimStart('/');
        if (trimmed.Contains(':', StringComparison.Ordinal) || trimmed.StartsWith('/')) return null;

        var segments = trimmed.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length == 0) return null;
        foreach (var seg in segments)
        {
            if (seg is ".." or ".") return null;
            if (seg != Path.GetFileName(seg)) return null; // 段内再含路径符（空字符等）
            if (seg.StartsWith('.')) return null;           // 隐藏文件/目录
        }
        return string.Join('/', segments);
    }

    private static string ComputeEtag(string filePath)
    {
        var info = new FileInfo(filePath);
        return $"\"{info.Length:x}-{info.LastWriteTimeUtc.Ticks:x}\"";
    }

    private static string EmbeddedEtag(string resourceName)
    {
        var moduleVersion = typeof(StaticAssetResolver).Assembly.ManifestModule.ModuleVersionId.ToString("N");
        return $"\"{moduleVersion[..8]}-{resourceName.GetHashCode():x}\"";
    }
}
