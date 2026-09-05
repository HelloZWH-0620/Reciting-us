namespace RecitingUs.Core.Platform;

/// <summary>平台差异抽象：路径、扩展配置、密钥保管、TTS。</summary>
public interface IPlatformServices
{
    /// <summary>应用数据根目录（SQLite、壁纸、音频、用户数据、日志）。</summary>
    string DataDir { get; }

    /// <summary>前端资源热更覆盖目录（免重编生效）。</summary>
    string OverrideDir { get; }

    /// <summary>除内置白名单外，是否额外允许该 AI 代理域名（ai-hosts.txt）。</summary>
    bool IsExtraAiHostAllowed(string host);

    /// <summary>读取原生安全存储中的密钥（Windows DPAPI / Android Keystore）。</summary>
    string? GetSecret(string name);

    /// <summary>写入原生安全存储。</summary>
    void SetSecret(string name, string value);
}

/// <summary>默认实现：数据目录回退到应用基目录；密钥以受权文件形式存放。</summary>
public class DefaultPlatformServices : IPlatformServices
{
    private readonly object _lock = new();

    public virtual string DataDir
    {
        get
        {
            var baseDir = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            if (string.IsNullOrEmpty(baseDir)) baseDir = AppContext.BaseDirectory;
            var dir = Path.Combine(baseDir, "RecitingUs");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    public virtual string OverrideDir
    {
        get
        {
            var dir = Path.Combine(DataDir, "ResourceOverride");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    public virtual bool IsExtraAiHostAllowed(string host)
    {
        foreach (var file in new[] { Path.Combine(DataDir, "ai-hosts.txt"), Path.Combine(OverrideDir, "ai-hosts.txt") })
        {
            if (!File.Exists(file)) continue;
            foreach (var raw in File.ReadAllLines(file))
            {
                var line = raw.Trim();
                if (line.Length == 0 || line.StartsWith("#")) continue;
                if (string.Equals(line, host, StringComparison.OrdinalIgnoreCase)) return true;
            }
        }
        return false;
    }

    public virtual string? GetSecret(string name)
    {
        var path = SecretPath(name);
        return File.Exists(path) ? File.ReadAllText(path) : null;
    }

    public virtual void SetSecret(string name, string value)
    {
        lock (_lock)
        {
            var path = SecretPath(name);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, value);
        }
    }

    protected virtual string SecretPath(string name)
    {
        var safe = string.Concat(name.Select(c => char.IsLetterOrDigit(c) || c is '.' or '-' or '_' ? c : '_'));
        return Path.Combine(DataDir, "secrets", safe + ".secret");
    }
}
