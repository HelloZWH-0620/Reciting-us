using Xunit;
using RecitingUs.Core;
using RecitingUs.Core.Platform;

namespace RecitingUs.Tests;

/// <summary>临时目录平台服务（隔离测试，不触碰真实用户数据目录）。</summary>
internal sealed class TempPlatformServices : IPlatformServices
{
    public string Root { get; } = Path.Combine(Path.GetTempPath(), "recitingus_tests_" + Guid.NewGuid().ToString("N"));

    public string DataDir { get; }
    public string OverrideDir { get; }

    public TempPlatformServices()
    {
        DataDir = Path.Combine(Root, "data");
        OverrideDir = Path.Combine(Root, "override");
        Directory.CreateDirectory(DataDir);
        Directory.CreateDirectory(OverrideDir);
    }

    public bool IsExtraAiHostAllowed(string host) => host == "extra.host.example";

    public string? GetSecret(string name) =>
        File.Exists(Path.Combine(DataDir, "secrets", name + ".txt"))
            ? File.ReadAllText(Path.Combine(DataDir, "secrets", name + ".txt"))
            : null;

    public void SetSecret(string name, string value)
    {
        Directory.CreateDirectory(Path.Combine(DataDir, "secrets"));
        File.WriteAllText(Path.Combine(DataDir, "secrets", name + ".txt"), value);
    }
}

public class AppDbTests : IDisposable
{
    private readonly TempPlatformServices _platform = new();

    [Fact]
    public void Initialize_CreatesSchema()
    {
        using var db = new AppDb(Path.Combine(_platform.DataDir, "t.db"));
        var rows = db.ExecuteReadAsync(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
            r => r.GetString(0)).GetAwaiter().GetResult();
        Assert.Contains("progress", rows);
        Assert.Contains("wrong_book", rows);
        Assert.Contains("stats_daily", rows);
        Assert.Contains("flashcard", rows);
        Assert.Contains("kv_store", rows);
        Assert.Contains("schema_version", rows);
    }

    [Fact]
    public async Task WriteLock_AllowsConcurrentReads()
    {
        using var db = new AppDb(Path.Combine(_platform.DataDir, "t2.db"));
        await db.ExecuteWriteAsync(
            "INSERT INTO wrong_book(profile_id, type, prompt, created_at) VALUES ('p1', 'blank', 'q', 1);");
        // WAL 下读写并发
        var readTask = db.ExecuteReadAsync("SELECT COUNT(*) FROM wrong_book", r => r.GetInt64(0));
        var writeTask = db.ExecuteWriteAsync(
            "INSERT INTO wrong_book(profile_id, type, prompt, created_at) VALUES ('p1', 'blank', 'q2', 2);");
        await Task.WhenAll(readTask, writeTask);
        Assert.Equal(1, readTask.Result[0]);
    }

    [Fact]
    public async Task Transaction_RollsBack_OnFailure()
    {
        using var db = new AppDb(Path.Combine(_platform.DataDir, "t3.db"));
        try
        {
            await db.ExecuteInTransactionAsync((conn, tx) =>
            {
                using (var ok = conn.CreateCommand())
                {
                    ok.Transaction = tx;
                    ok.CommandText = "INSERT INTO kv_store(profile_id, key, value, updated_at) VALUES ('p', 'k', 'v', 1);";
                    ok.ExecuteNonQuery();
                }
                using (var bad = conn.CreateCommand())
                {
                    bad.Transaction = tx;
                    bad.CommandText = "INSERT INTO not_exists VALUES (1);"; // 触发失败
                    bad.ExecuteNonQuery();
                }
                return Task.CompletedTask;
            });
        }
        catch { /* 预期失败 */ }

        var rows = await db.ExecuteReadAsync("SELECT COUNT(*) FROM kv_store", r => r.GetInt64(0));
        Assert.Equal(0, rows[0]); // 原子回滚：成功语句也被撤销
    }

    public void Dispose()
    {
        try { Directory.Delete(_platform.Root, recursive: true); } catch { }
    }
}
