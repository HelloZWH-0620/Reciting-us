using Xunit;
using RecitingUs.Core;

namespace RecitingUs.Tests;

public class MimeMapTests
{
    [Theory]
    [InlineData("app.html", "text/html; charset=utf-8")]
    [InlineData("js/app.js", "application/javascript; charset=utf-8")]
    [InlineData("config/articles.json", "application/json; charset=utf-8")]
    [InlineData("icon.svg", "image/svg+xml")]
    [InlineData("font.woff2", "font/woff2")]
    [InlineData("song.mp3", "audio/mpeg")]
    [InlineData("unknown.xyz", "application/octet-stream")]
    public void Get_MapsCommonExtensions(string path, string expected)
        => Assert.Equal(expected, MimeMap.Get(path));

    [Theory]
    [InlineData("a.png", true)]
    [InlineData("a.webp", true)]
    [InlineData("a.svg", false)]
    [InlineData("a.mp3", false)]
    public void IsImage_Discriminates(string path, bool expected)
        => Assert.Equal(expected, MimeMap.IsImage(path));

    [Fact]
    public void MagicMatches_Png()
    {
        ReadOnlySpan<byte> png = stackalloc byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A };
        Assert.True(MimeMap.MagicMatches(png, ".png"));
        Assert.False(MimeMap.MagicMatches(png, ".jpg"));
    }

    [Fact]
    public void MagicMatches_Jpeg_RequiresFFD8FF()
    {
        ReadOnlySpan<byte> jpeg = stackalloc byte[] { 0xFF, 0xD8, 0xFF, 0xE0 };
        Assert.True(MimeMap.MagicMatches(jpeg, ".jpeg"));
    }

    [Fact]
    public void MagicMatches_RejectsShortData()
        => Assert.False(MimeMap.MagicMatches(stackalloc byte[] { 0x89 }, ".png"));
}
