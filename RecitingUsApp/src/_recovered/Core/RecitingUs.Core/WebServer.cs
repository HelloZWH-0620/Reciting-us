using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;

namespace RecitingUs.Core;

public sealed class WebServer
{
	private sealed class WallpaperPayload
	{
		public string? Data { get; set; }

		public string? Filename { get; set; }
	}

	private HttpListener? _listener;

	private CancellationTokenSource _cts = new CancellationTokenSource();

	private readonly object _lock = new object();

	private string _dataDir;

	private string _wallpapersDir;

	private string _userdataDir;

	private string _audioDir;

	private static readonly HashSet<string> _aiAllowedHosts;

	private const long MaxUploadBytes = 8388608L;

	public static WebServer Instance { get; }

	public int Port { get; private set; }

	public string BaseUrl => $"http://localhost:{Port}/";

	static WebServer()
	{
		Instance = new WebServer();
		_aiAllowedHosts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "api.openai.com", "api.deepseek.com", "api.siliconflow.cn", "dashscope.aliyuncs.com", "open.bigmodel.cn", "api.moonshot.cn", "api.moonshot.com", "localhost", "127.0.0.1" };
		WebAssets.Initialize(typeof(WebAssets).Assembly);
	}

	public void Start(int preferredPort = 8000)
	{
		ResolveDataDirs();
		_cts = new CancellationTokenSource();
		HttpListener listener = new HttpListener();
		int num = FindFreePort(preferredPort);
		listener.Prefixes.Add($"http://localhost:{num}/");
		listener.Prefixes.Add($"http://127.0.0.1:{num}/");
		listener.Start();
		Port = num;
		_listener = listener;
		Thread thread = new Thread((ThreadStart)delegate
		{
			AcceptLoop(listener, _cts.Token);
		});
		thread.IsBackground = true;
		thread.Name = "WebServer";
		thread.Start();
	}

	public void Stop()
	{
		_cts.Cancel();
		try
		{
			_listener?.Stop();
		}
		catch
		{
		}
		try
		{
			_listener?.Close();
		}
		catch
		{
		}
	}

	private void ResolveDataDirs()
	{
		string text = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
		if (string.IsNullOrEmpty(text))
		{
			text = AppContext.BaseDirectory;
		}
		_dataDir = Path.Combine(text, "RecitingUs");
		_wallpapersDir = Path.Combine(_dataDir, "wallpapers");
		_userdataDir = Path.Combine(_dataDir, "userdata");
		_audioDir = Path.Combine(_dataDir, "audio");
		Directory.CreateDirectory(_wallpapersDir);
		Directory.CreateDirectory(_userdataDir);
		Directory.CreateDirectory(_audioDir);
	}

	private static int FindFreePort(int preferred)
	{
		for (int i = preferred; i < preferred + 50; i++)
		{
			TcpListener tcpListener = new TcpListener(IPAddress.Loopback, i);
			try
			{
				tcpListener.Start();
				tcpListener.Stop();
				return i;
			}
			catch
			{
			}
		}
		return preferred;
	}

	private void AcceptLoop(HttpListener listener, CancellationToken token)
	{
		while (!token.IsCancellationRequested && listener.IsListening)
		{
			HttpListenerContext ctx;
			try
			{
				ctx = listener.GetContext();
			}
			catch
			{
				break;
			}
			ThreadPool.QueueUserWorkItem(delegate
			{
				try
				{
					Handle(ctx);
				}
				catch
				{
				}
			});
		}
	}

	private void Handle(HttpListenerContext ctx)
	{
		HttpListenerRequest request = ctx.Request;
		HttpListenerResponse response = ctx.Response;
		string text = request.Url?.AbsolutePath ?? "/";
		string httpMethod = request.HttpMethod;
		response.Headers.Add("Access-Control-Allow-Origin", $"http://localhost:{Port}");
		response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
		response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");
		if (httpMethod == "OPTIONS")
		{
			response.StatusCode = 204;
			response.Close();
			return;
		}
		try
		{
			if (text == "/api/wallpapers" && httpMethod == "GET")
			{
				string[] files = (from f in Directory.EnumerateFiles(_wallpapersDir).Select(Path.GetFileName)
					where MimeMap.IsImage(f)
					orderby f
					select f).ToArray();
				OkJson(response, Json(new
				{
					success = true,
					files = files
				}));
			}
			else if (text == "/api/version" && httpMethod == "GET")
			{
				ServeEmbeddedOr404(response, request, "/config/version.json", fileFallback: true);
			}
			else if (text == "/api/audio-files" && httpMethod == "GET")
			{
				string[] files2 = (from f in Directory.EnumerateFiles(_audioDir).Select(Path.GetFileName)
					where MimeMap.IsAudio(f)
					orderby f
					select f).ToArray();
				OkJson(response, Json(new
				{
					success = true,
					files = files2
				}));
			}
			else if (text == "/api/upload-wallpaper" && httpMethod == "POST")
			{
				UploadWallpaper(ctx, response);
			}
			else if (text.StartsWith("/api/wallpapers/") && httpMethod == "DELETE")
			{
				string fileName = Path.GetFileName(text.Substring("/api/wallpapers/".Length));
				string path = Path.Combine(_wallpapersDir, fileName);
				if (File.Exists(path))
				{
					File.Delete(path);
				}
				OkJson(response, Json(new
				{
					success = true
				}));
			}
			else if (text == "/api/ai-proxy" && httpMethod == "POST")
			{
				AiProxy(ctx, response);
			}
			else if (text == "/api/userdata/list" && httpMethod == "GET")
			{
				string[] files3 = (from f in (from f in Directory.EnumerateFiles(_userdataDir)
						where Path.GetExtension(f).Equals(".json", StringComparison.OrdinalIgnoreCase)
						select f).Select(Path.GetFileName)
					orderby f
					select f).ToArray();
				OkJson(response, Json(new
				{
					success = true,
					files = files3
				}));
			}
			else if (text.StartsWith("/api/userdata/file/"))
			{
				UserDataFile(ctx, response, httpMethod);
			}
			else
			{
				ServeStatic(response, request, text);
			}
		}
		catch (Exception ex)
		{
			try
			{
				response.StatusCode = 200;
				OkJson(response, Json(new
				{
					success = false,
					error = ex.Message
				}));
			}
			catch
			{
			}
		}
	}

	private void ServeEmbeddedOr404(HttpListenerResponse resp, HttpListenerRequest req, string fullResourcePath, bool fileFallback = false)
	{
		string text = WebAssets.Resolve(fullResourcePath);
		if (text == null)
		{
			resp.StatusCode = 404;
			resp.Close();
			return;
		}
		using Stream stream = WebAssets.Open(text);
		if (stream == null)
		{
			resp.StatusCode = 404;
			resp.Close();
		}
		else
		{
			byte[] bytes = ReadAll(stream);
			SendBytes(resp, bytes, MimeMap.Get(fullResourcePath));
		}
	}

	private void ServeStatic(HttpListenerResponse resp, HttpListenerRequest req, string path)
	{
		string text = WebAssets.Resolve(path);
		if (text == null)
		{
			resp.StatusCode = 404;
			resp.Close();
			return;
		}
		using Stream stream = WebAssets.Open(text);
		if (stream == null)
		{
			resp.StatusCode = 404;
			resp.Close();
		}
		else
		{
			byte[] bytes = ReadAll(stream);
			SendBytes(resp, bytes, MimeMap.Get(path));
		}
	}

	private void UploadWallpaper(HttpListenerContext ctx, HttpListenerResponse resp)
	{
		using StreamReader streamReader = new StreamReader(ctx.Request.InputStream, Encoding.UTF8);
		WallpaperPayload wallpaperPayload = JsonSerializer.Deserialize<WallpaperPayload>(streamReader.ReadToEnd());
		if (wallpaperPayload == null || string.IsNullOrEmpty(wallpaperPayload.Data))
		{
			Bad(resp, "图片数据格式错误");
			return;
		}
		Match match = Regex.Match(wallpaperPayload.Data, "^data:image/[^;]+;base64,(.+)$");
		if (!match.Success)
		{
			Bad(resp, "图片数据格式错误");
			return;
		}
		string text = Path.GetExtension(wallpaperPayload.Filename ?? "").ToLowerInvariant();
		if (!MimeMap.IsImage("x" + text))
		{
			Bad(resp, "不支持的图片格式");
			return;
		}
		byte[] array;
		try
		{
			array = Convert.FromBase64String(match.Groups[1].Value);
		}
		catch
		{
			Bad(resp, "图片数据格式错误");
			return;
		}
		if ((long)array.Length > 8388608L)
		{
			resp.StatusCode = 413;
			Bad(resp, "图片超过 8MB 大小限制");
			return;
		}
		if (!MimeMap.MagicMatches(array, text))
		{
			Bad(resp, "图片内容与扩展名不符");
			return;
		}
		string text2 = Regex.Replace(wallpaperPayload.Filename, "[^a-zA-Z0-9\\-_\\.]", "_");
		if (string.IsNullOrWhiteSpace(text2))
		{
			text2 = "wallpaper" + text;
		}
		string path = Path.Combine(_wallpapersDir, text2);
		string fileNameWithoutExtension = Path.GetFileNameWithoutExtension(text2);
		int num = 1;
		while (File.Exists(path))
		{
			path = Path.Combine(_wallpapersDir, $"{fileNameWithoutExtension}_{num}{text}");
			text2 = Path.GetFileName(path);
			num++;
		}
		File.WriteAllBytes(path, array);
		OkJson(resp, Json(new
		{
			success = true,
			filename = text2
		}));
	}

	private void UserDataFile(HttpListenerContext ctx, HttpListenerResponse resp, string method)
	{
		string fileName = Path.GetFileName(ctx.Request.Url.AbsolutePath.Substring("/api/userdata/file/".Length));
		string path = Path.Combine(_userdataDir, fileName);
		switch (method)
		{
		case "GET":
		{
			object data = null;
			if (File.Exists(path))
			{
				try
				{
					data = JsonSerializer.Deserialize<object>(File.ReadAllText(path, Encoding.UTF8));
				}
				catch
				{
					data = null;
				}
			}
			OkJson(resp, Json(new
			{
				success = true,
				data = data
			}));
			break;
		}
		case "POST":
		{
			using StreamReader streamReader = new StreamReader(ctx.Request.InputStream, Encoding.UTF8);
			using JsonDocument jsonDocument = JsonDocument.Parse(streamReader.ReadToEnd());
			string rawText = jsonDocument.RootElement.GetProperty("data").GetRawText();
			File.WriteAllText(path, rawText, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
			OkJson(resp, Json(new
			{
				success = true
			}));
			break;
		}
		case "DELETE":
			if (File.Exists(path))
			{
				File.Delete(path);
			}
			OkJson(resp, Json(new
			{
				success = true
			}));
			break;
		default:
			resp.StatusCode = 405;
			resp.Close();
			break;
		}
	}

	private async void AiProxy(HttpListenerContext ctx, HttpListenerResponse resp)
	{
		_ = 3;
		try
		{
			using StreamReader reader = new StreamReader(ctx.Request.InputStream, Encoding.UTF8);
			using JsonDocument doc = JsonDocument.Parse(await reader.ReadToEndAsync());
			JsonElement rootElement = doc.RootElement;
			string text = rootElement.GetProperty("url").GetString();
			if (string.IsNullOrEmpty(text))
			{
				Bad(resp, "缺少目标 URL");
				return;
			}
			string text2 = new Uri(text).Host.ToLowerInvariant();
			if (!_aiAllowedHosts.Contains(text2))
			{
				resp.StatusCode = 403;
				Bad(resp, "目标域名不在白名单: " + text2);
				return;
			}
			Dictionary<string, object> dictionary = new Dictionary<string, object>
			{
				["model"] = rootElement.GetProperty("model").GetString(),
				["messages"] = rootElement.GetProperty("messages"),
				["temperature"] = (rootElement.TryGetProperty("temperature", out var value) ? value.GetDouble() : 0.7),
				["stream"] = false
			};
			if (rootElement.TryGetProperty("extra", out var value2) && value2.ValueKind == JsonValueKind.Object)
			{
				foreach (JsonProperty item in value2.EnumerateObject())
				{
					dictionary[item.Name] = JsonSerializer.Deserialize<object>(item.Value.GetRawText());
				}
			}
			string text3 = (rootElement.TryGetProperty("apiKey", out var value3) ? value3.GetString() : null);
			using HttpClient client = new HttpClient
			{
				Timeout = TimeSpan.FromSeconds(120L)
			};
			if (!string.IsNullOrEmpty(text3))
			{
				client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", text3);
			}
			StringContent content = new StringContent(JsonSerializer.Serialize(dictionary), Encoding.UTF8, "application/json");
			HttpResponseMessage up = await client.PostAsync(text, content);
			string s = await up.Content.ReadAsStringAsync();
			resp.StatusCode = (int)up.StatusCode;
			resp.ContentType = "application/json; charset=utf-8";
			byte[] bytes = Encoding.UTF8.GetBytes(s);
			resp.ContentLength64 = bytes.Length;
			await resp.OutputStream.WriteAsync(bytes);
			resp.OutputStream.Close();
		}
		catch (Exception ex)
		{
			try
			{
				resp.StatusCode = 502;
				Bad(resp, ex.Message);
			}
			catch
			{
			}
		}
	}

	private static byte[] ReadAll(Stream s)
	{
		using MemoryStream memoryStream = new MemoryStream();
		s.CopyTo(memoryStream);
		return memoryStream.ToArray();
	}

	private static void SendBytes(HttpListenerResponse resp, byte[] bytes, string contentType)
	{
		resp.ContentType = contentType;
		resp.SendChunked = true;
		resp.OutputStream.Write(bytes, 0, bytes.Length);
		resp.OutputStream.Close();
	}

	private static void Bad(HttpListenerResponse resp, string msg)
	{
		try
		{
			OkJson(resp, Json(new
			{
				success = false,
				error = msg
			}));
		}
		catch
		{
		}
	}

	private static void OkJson(HttpListenerResponse resp, string json)
	{
		resp.ContentType = "application/json; charset=utf-8";
		resp.SendChunked = true;
		byte[] bytes = Encoding.UTF8.GetBytes(json);
		resp.OutputStream.Write(bytes, 0, bytes.Length);
		resp.OutputStream.Close();
	}

	private static string Json(object o)
	{
		return JsonSerializer.Serialize(o);
	}
}
