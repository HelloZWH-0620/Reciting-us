namespace RecitingUs.Core;

/// <summary>扩展名 → MIME 映射与图片/音频判定、魔数校验（自恢复源码整理并扩充）。</summary>
public static class MimeMap
{
    private static readonly Dictionary<string, string> _map = new(StringComparer.OrdinalIgnoreCase)
    {
        [".html"] = "text/html; charset=utf-8",
        [".htm"] = "text/html; charset=utf-8",
        [".css"] = "text/css; charset=utf-8",
        [".js"] = "application/javascript; charset=utf-8",
        [".mjs"] = "application/javascript; charset=utf-8",
        [".json"] = "application/json; charset=utf-8",
        [".map"] = "application/json; charset=utf-8",
        [".txt"] = "text/plain; charset=utf-8",
        [".xml"] = "application/xml",
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".gif"] = "image/gif",
        [".webp"] = "image/webp",
        [".avif"] = "image/avif",
        [".bmp"] = "image/bmp",
        [".ico"] = "image/x-icon",
        [".svg"] = "image/svg+xml",
        [".woff"] = "font/woff",
        [".woff2"] = "font/woff2",
        [".ttf"] = "font/ttf",
        [".eot"] = "application/vnd.ms-fontobject",
        [".mp3"] = "audio/mpeg",
        [".wav"] = "audio/wav",
        [".m4a"] = "audio/mp4",
        [".aac"] = "audio/aac"
    };

    private static readonly HashSet<string> _imageExt = new(StringComparer.OrdinalIgnoreCase)
        { ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp" };

    private static readonly HashSet<string> _audioExt = new(StringComparer.OrdinalIgnoreCase)
        { ".mp3", ".wav", ".m4a", ".aac" };

    public static string Get(string path)
    {
        var ext = Path.GetExtension(path);
        return ext.Length > 0 && _map.TryGetValue(ext, out var mime) ? mime : "application/octet-stream";
    }

    public static bool IsImage(string path) => _imageExt.Contains(Path.GetExtension(path));

    public static bool IsAudio(string path) => _audioExt.Contains(Path.GetExtension(path));

    /// <summary>校验文件头魔数与扩展名相符（防伪造扩展名的上传）。</summary>
    public static bool MagicMatches(ReadOnlySpan<byte> head, string ext)
    {
        if (head.Length < 4) return false;
        switch (ext.ToLowerInvariant())
        {
            case ".png":
                return head[0] == 0x89 && head[1] == 0x50 && head[2] == 0x4E && head[3] == 0x47;
            case ".jpg":
            case ".jpeg":
                return head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF;
            case ".gif":
                return head[0] == 0x47 && head[1] == 0x49 && head[2] == 0x46;
            case ".bmp":
                return head[0] == 0x42 && head[1] == 0x4D;
            case ".webp":
                return head[0] == 0x52 && head[1] == 0x49 && head[2] == 0x46 && head[3] == 0x46;
            case ".avif":
                return head[4] == 0x66 && head[5] == 0x74 && head[6] == 0x79 && head[7] == 0x70; // "ftyp"
            default:
                return false;
        }
    }
}
