using Xunit;
using System.Text;
using System.Text.Json;
using RecitingUs.Core;
using RecitingUs.Core.Platform;

namespace RecitingUs.Tests;

public class MigrationServiceTests : IDisposable
{
    private readonly TempPlatformServices _platform = new();

    [Fact]
    public async Task Import_PersistsAllSections()
    {
        using var db = new AppDb(Path.Combine(_platform.DataDir, "m1.db"));
        var svc = new MigrationService(db);
        var archive = new ExportArchive(
            SchemaVersion: 1,
            Progress: new() { new ProgressRecord("p1", "article-1", "learn", Recited: true, Mastery: 3, DueAt: 100, LastReview: 90, ReviewCount: 2) },
            WrongBook: new() { new WrongItem(null, "p1", "article-1", "blank", "问", "答", "错答", Mastered: false, 123) },
            Flashcards: new() { new FlashcardItem(null, "p1", "article-1", "front", "back", 2.5, 0, 200, 190) },
            KvStore: new() { new KvEntry("p1", "aiConfig", "{}", 170) });

        var summary = await svc.ImportAsync(new MemoryStream(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(archive))));

        Assert.Equal(1, summary.ProgressImported);
        Assert.Equal(1, summary.WrongBookImported);
        Assert.Equal(1, summary.FlashcardsImported);
        Assert.Equal(1, summary.KvImported);

        var wrong = await db.ExecuteReadAsync("SELECT prompt, user_answer FROM wrong_book", r => (r.GetString(0), r.GetString(1)));
        Assert.Equal(("问", "错答"), wrong[0]);
    }

    [Fact]
    public async Task Import_RejectsFutureSchemaVersion()
    {
        using var db = new AppDb(Path.Combine(_platform.DataDir, "m2.db"));
        var svc = new MigrationService(db);
        var archive = new ExportArchive(SchemaVersion: 99, null, null, null, null);
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.ImportAsync(new MemoryStream(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(archive)))));
    }

    [Fact]
    public async Task Import_IsCaseInsensitive_ForFrontendPayload()
    {
        using var db = new AppDb(Path.Combine(_platform.DataDir, "m3.db"));
        var svc = new MigrationService(db);
        const string json = """
            {"schemaVersion":1,"progress":[{"profileId":"default","articleId":"a1","mode":"learn","recited":true,"mastery":3,"reviewCount":2}]}
            """;
        var summary = await svc.ImportAsync(new MemoryStream(Encoding.UTF8.GetBytes(json)));
        Assert.Equal(1, summary.ProgressImported);
    }

    [Fact]
    public async Task Import_ThenExport_RoundTrips()
    {
        using var db = new AppDb(Path.Combine(_platform.DataDir, "m4.db"));
        var svc = new MigrationService(db);
        var archive = new ExportArchive(1,
            new() { new ProgressRecord("default", "a1", "learn", true, 4, null, null, 7) },
            null, null, null);
        await svc.ImportAsync(new MemoryStream(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(archive))));

        var exported = await svc.ExportAsync("default");
        var p = Assert.Single(exported.Progress!);
        Assert.Equal("a1", p.ArticleId);
        Assert.Equal(4, p.Mastery);
        Assert.Equal(7, p.ReviewCount);
    }

    public void Dispose()
    {
        try { Directory.Delete(_platform.Root, recursive: true); } catch { }
    }
}

public class ApiResponseErrorCodeTests
{
    [Theory]
    [InlineData(400, "BAD_REQUEST")]
    [InlineData(403, "FORBIDDEN_HOST")]
    [InlineData(404, "NOT_FOUND")]
    [InlineData(409, "CONFLICT")]
    [InlineData(429, "RATE_LIMITED")]
    [InlineData(503, "CIRCUIT_OPEN")]
    [InlineData(500, "NO_KEY")]
    public void DefaultErrorCode_MapsKnownStatuses(int code, string expected)
        => Assert.Equal(expected, ApiResponse.DefaultErrorCode(code));
}

public class AiProxyWhitelistTests
{
    [Theory]
    [InlineData("api.deepseek.com", true)]
    [InlineData("api.openai.com", true)]
    [InlineData("dashscope.aliyuncs.com", true)]
    [InlineData("evil.example.com", false)]
    [InlineData("localhost", true)]
    public async Task ForwardAsync_BlocksNonWhitelistedHosts(string host, bool allowed)
    {
        var platform = new StaticHostPlatform();
        var svc = new AiProxyService(platform);
        var req = new RecitingUs.Core.AiProxyRequest(
            Url: $"https://{host}/v1/chat/completions",
            ApiKey: "sk-test",
            Model: "test-model",
            Messages: null, Temperature: null, Extra: null, Body: null);

        var (status, body) = await svc.ForwardAsync(req, CancellationToken.None);

        if (allowed) Assert.NotEqual(403, status);      // 白名单域名走真实转发（无网络时可能 502/超时，但不 403）
        else
        {
            Assert.Equal(403, status);
            Assert.Contains("FORBIDDEN_HOST", body);
        }
    }

    private sealed class StaticHostPlatform : IPlatformServices
    {
        public string DataDir { get; } = Path.Combine(Path.GetTempPath(), "recitingus_tests_ai_" + Guid.NewGuid().ToString("N"));
        public string OverrideDir { get; } = Path.Combine(Path.GetTempPath(), "recitingus_tests_ai_" + Guid.NewGuid().ToString("N"));
        public bool IsExtraAiHostAllowed(string host) => false;
        public string? GetSecret(string name) => null;
        public void SetSecret(string name, string value) { }
    }
}
