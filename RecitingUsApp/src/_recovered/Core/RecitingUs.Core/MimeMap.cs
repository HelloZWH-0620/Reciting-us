using System;
using System.Collections.Generic;
using System.IO;

namespace RecitingUs.Core;

public static class MimeMap
{
	private static readonly Dictionary<string, string> _map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
	{
		[".html"] = "text/html",
		[".htm"] = "text/html",
		[".css"] = "text/css",
		[".js"] = "application/javascript",
		[".json"] = "application/json",
		[".png"] = "image/png",
		[".jpg"] = "image/jpeg",
		[".jpeg"] = "image/jpeg",
		[".gif"] = "image/gif",
		[".webp"] = "image/webp",
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

	private static readonly HashSet<string> _imageExt = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp" };

	private static readonly HashSet<string> _audioExt = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".mp3", ".wav", ".m4a", ".aac" };

	public static string Get(string path)
	{
		string key = Path.GetExtension(path).ToLowerInvariant();
		if (!_map.TryGetValue(key, out string value))
		{
			return "application/octet-stream";
		}
		return value;
	}

	public static bool IsImage(string path)
	{
		return _imageExt.Contains(Path.GetExtension(path));
	}

	public static bool IsAudio(string path)
	{
		return _audioExt.Contains(Path.GetExtension(path));
	}

	public static bool MagicMatches(ReadOnlySpan<byte> head, string ext)
	{
		if (head.Length < 4)
		{
			return false;
		}
		switch (ext.ToLowerInvariant())
		{
		case ".png":
			if (head[0] == 137 && head[1] == 80 && head[2] == 78)
			{
				return head[3] == 71;
			}
			return false;
		case ".jpg":
		case ".jpeg":
			if (head[0] == byte.MaxValue && head[1] == 216)
			{
				return head[2] == byte.MaxValue;
			}
			return false;
		case ".gif":
			if (head[0] == 71 && head[1] == 73)
			{
				return head[2] == 70;
			}
			return false;
		case ".bmp":
			if (head[0] == 66)
			{
				return head[1] == 77;
			}
			return false;
		case ".webp":
			if (head[0] == 82 && head[1] == 73 && head[2] == 70)
			{
				return head[3] == 70;
			}
			return false;
		default:
			return false;
		}
	}
}
