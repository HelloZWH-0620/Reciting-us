using System.Diagnostics;
using System.Collections.Concurrent;

namespace RecitingUs.Core;

public sealed record LogEntry(DateTime Timestamp, string Level, string Message);

/// <summary>
/// 结构化日志：内存保留最近 500 条（供 /api/logs 诊断覆盖层），同时落盘轮转文件。
/// </summary>
public static class AppLogger
{
    private const int MaxMemoryEntries = 500;
    private const long MaxFileBytes = 1024 * 1024; // 1MB
    private const int MaxFiles = 3;

    private static readonly ConcurrentQueue<LogEntry> _entries = new();
    private static readonly object _fileLock = new();
    private static string _logDir = "";
    private static bool _initialized;

    public static void Init(string logDir)
    {
        _logDir = logDir;
        _initialized = true;
        try { Directory.CreateDirectory(logDir); } catch { _initialized = false; }
    }

    public static void Info(string message) => Add("INFO", message);
    public static void Warn(string message) => Add("WARN", message);
    public static void Error(string message, Exception? ex = null) =>
        Add("ERROR", $"{message}{(ex is null ? "" : $" :: {ex.GetType().Name}: {ex.Message}")}");

    private static void Add(string level, string message)
    {
        var entry = new LogEntry(DateTime.UtcNow, level, message);
        _entries.Enqueue(entry);
        while (_entries.Count > MaxMemoryEntries && _entries.TryDequeue(out _)) { }
        try { Console.WriteLine($"[{entry.Timestamp:HH:mm:ss}] {level} {message}"); } catch { }
        WriteToFile(level, message);
    }

    public static IReadOnlyList<LogEntry> GetRecent(int count = 50)
    {
        var snapshot = _entries.ToArray();
        return snapshot.TakeLast(Math.Clamp(count, 1, MaxMemoryEntries)).ToArray();
    }

    private static void WriteToFile(string level, string message)
    {
        if (!_initialized || string.IsNullOrEmpty(_logDir)) return;
        try
        {
            lock (_fileLock)
            {
                var path = Path.Combine(_logDir, "app.log");
                var line = $"[{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ssZ}] {level} {message}{Environment.NewLine}";
                File.AppendAllText(path, line);
                if (new FileInfo(path).Length > MaxFileBytes) Rotate(path);
            }
        }
        catch { /* 日志失败不影响业务 */ }
    }

    private static void Rotate(string path)
    {
        for (var i = MaxFiles - 1; i > 0; i--)
        {
            var older = $"{path}.{i}";
            var newer = $"{path}.{i - 1}";
            if (File.Exists(newer)) File.Move(newer, older, overwrite: true);
        }
        File.Move(path, $"{path}.0", overwrite: true);
    }
}

/// <summary>启动性能计时：各关键阶段耗时打点，启动完成后整体输出。</summary>
public static class StartupTimer
{
    private static readonly Stopwatch _sw = Stopwatch.StartNew();
    private static readonly List<(string Label, long Ms)> _marks = new();
    private static readonly object _lock = new();

    public static void Mark(string label)
    {
        lock (_lock) _marks.Add((label, _sw.ElapsedMilliseconds));
    }

    public static string GetReport()
    {
        lock (_lock)
        {
            return "启动报告:\n" + string.Join("\n", _marks.Select(m => $"  +{m.Ms,5}ms  {m.Label}"));
        }
    }
}
