using Xunit;
using RecitingUs.Core;

namespace RecitingUs.Tests;

public class StaticAssetResolverTests
{
    // ---- Normalize：路径穿越与非法输入 ----

    [Theory]
    [InlineData("../etc/passwd")]
    [InlineData("..\\..\\secret")]
    [InlineData("%2e%2e/%2e%2e/etc/passwd")]        // URL 编码穿越
    [InlineData("a/../../b")]
    [InlineData("config/..")]
    [InlineData("C:/Windows/system.ini")]            // 盘符
    [InlineData("/.hidden")]                          // 隐藏文件
    [InlineData("dir/.secret")]
    [InlineData("")]
    [InlineData("   ")]
    public void Normalize_RejectsTraversalAndIllegalPaths(string input)
        => Assert.Null(StaticAssetResolver.Normalize(input));

    [Theory]
    [InlineData("app.html", "app.html")]
    [InlineData("/app.html", "app.html")]
    [InlineData("config/articles.json", "config/articles.json")]
    [InlineData("config%2Farticles.json", "config/articles.json")] // 解码后合法
    public void Normalize_AcceptsWellFormedPaths(string input, string expected)
        => Assert.Equal(expected, StaticAssetResolver.Normalize(input));

    [Fact]
    public void Open_ServesEmbeddedAppHtml()
    {
        WebAssets.Initialize(typeof(EmbeddedHttpServer).Assembly);
        using var stream = StaticAssetResolver.Open("/app.html", out var mime, out _);
        Assert.NotNull(stream);
        Assert.StartsWith("text/html", mime);
        Assert.True(stream!.Length > 100_000);
    }

    [Fact]
    public void Open_ReturnsNullForMissing()
    {
        WebAssets.Initialize(typeof(EmbeddedHttpServer).Assembly);
        using var stream = StaticAssetResolver.Open("/no/such/file.bin", out _, out _);
        Assert.Null(stream);
    }

    [Fact]
    public void Open_EmbeddedEtag_IsStableAcrossCalls()
    {
        WebAssets.Initialize(typeof(EmbeddedHttpServer).Assembly);
        StaticAssetResolver.Open("/app.html", out _, out var etag1);
        StaticAssetResolver.Open("/app.html", out _, out var etag2);
        Assert.Equal(etag1, etag2);
        Assert.NotEmpty(etag1!);
    }
}
