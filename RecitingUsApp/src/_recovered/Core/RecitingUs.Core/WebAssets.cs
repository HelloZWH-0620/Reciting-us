using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;

namespace RecitingUs.Core;

public static class WebAssets
{
	private static readonly Dictionary<string, string> _map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

	public static void Initialize(Assembly assembly)
	{
		_map.Clear();
		string[] manifestResourceNames = assembly.GetManifestResourceNames();
		foreach (string text in manifestResourceNames)
		{
			if (text.StartsWith("web/", StringComparison.OrdinalIgnoreCase))
			{
				string text2 = text.Substring("web/".Length).Replace('\\', '/');
				_map["/" + text2] = text;
			}
		}
	}

	public static string? Resolve(string path)
	{
		if (string.IsNullOrEmpty(path) || path == "/")
		{
			path = "/app.html";
		}
		path = path.Replace('\\', '/').TrimStart('/');
		if (path.EndsWith("/", StringComparison.Ordinal))
		{
			path += "app.html";
		}
		string text = "/" + path;
		if (_map.TryGetValue(text, out string value))
		{
			return value;
		}
		if (_map.TryGetValue("/index.html".Replace("/index.html", text + "index.html"), out value))
		{
			return value;
		}
		return null;
	}

	public static Stream? Open(string resourceName)
	{
		return Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName);
	}

	public static IEnumerable<string> AllPaths()
	{
		return _map.Keys.OrderBy<string, string>((string k) => k, StringComparer.Ordinal);
	}
}
