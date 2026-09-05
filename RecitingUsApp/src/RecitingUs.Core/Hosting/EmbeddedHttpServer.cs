using System.Net;
using RecitingUs.Core.Platform;

namespace RecitingUs.Core;

/// <summary>
/// 嵌入式 HTTP 服务器（v3 §5.1）：仅绑定回环地址；端口占用自动递增；
/// 有界并发（SemaphoreSlim）防止线程池耗尽；支持 Pause/Resume（Android 生命周期）。
/// </summary>
public sealed class EmbeddedHttpServer : IDisposable
{
    public static EmbeddedHttpServer Instance { get; } = new();

    private HttpListener? _listener;
    private CancellationTokenSource _cts = new();
    private readonly SemaphoreSlim _concurrencyLimiter = new(Math.Max(4, Environment.ProcessorCount * 2));
    private volatile bool _paused;
    private long _startedAtUtc;
    private AppDb? _db;

    public int Port { get; private set; }
    public string BaseUrl => $"http://localhost:{Port}/";

    /// <summary>平台服务（宿主启动时替换为平台实现；默认通用实现）。</summary>
    public IPlatformServices Platform { get; set; } = new DefaultPlatformServices();

    /// <summary>AI 代理（懒建，需 Platform 就绪）。</summary>
    public AiProxyService Ai => _ai ??= new AiProxyService(Platform);
    private AiProxyService? _ai;

    /// <summary>SQLite 数据库（首次访问时打开，位于平台数据目录）。</summary>
    public AppDb Db => _db ??= new AppDb(Path.Combine(Platform.DataDir, "recitingus.db"));

    /// <summary>TTS 服务（平台注入，缺省不可用 → 前端回退 Web Speech）。</summary>
    public ITtsService? Tts { get; set; }

    public MigrationService Migration => _migration ??= new MigrationService(Db);
    private MigrationService? _migration;

    public long UptimeSeconds => _startedAtUtc == 0 ? 0 : (DateTimeOffset.UtcNow.ToUnixTimeSeconds() - _startedAtUtc);

    /// <summary>启动（幂等）。返回实际监听端口。</summary>
    public int Start(int preferredPort = 8000)
    {
        if (_listener is not null && _listener.IsListening) return Port;
        StaticAssetResolver.Configure(Platform);
        AppLogger.Init(Path.Combine(Platform.DataDir, "logs"));
        StartupTimer.Mark("宿主初始化");

        WebAssets.Initialize(typeof(EmbeddedHttpServer).Assembly);
        _cts = new CancellationTokenSource();
        _startedAtUtc = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        Exception? lastError = null;
        for (var port = preferredPort; port < preferredPort + 50; port++)
        {
            var listener = new HttpListener();
            listener.Prefixes.Add($"http://localhost:{port}/");
            listener.Prefixes.Add($"http://127.0.0.1:{port}/");
            try
            {
                listener.Start();
                _listener = listener;
                Port = port;
                break;
            }
            catch (HttpListenerException e)
            {
                lastError = e;
                listener.Close();
            }
        }

        if (_listener is null)
            throw new InvalidOperationException($"无法在端口 {preferredPort}-{preferredPort + 49} 上启动本地服务器", lastError);

        var acceptThread = new Thread(AcceptLoop) { IsBackground = true, Name = "WebServer.Accept" };
        acceptThread.Start();
        StartupTimer.Mark($"HTTP 服务器启动 (:{Port})");
        AppLogger.Info($"服务器就绪 {BaseUrl} (DB: {Platform.DataDir})");
        return Port;
    }

    private void AcceptLoop()
    {
        var listener = _listener!;
        var token = _cts.Token;
        while (!token.IsCancellationRequested && listener.IsListening)
        {
            HttpListenerContext ctx;
            try
            {
                ctx = listener.GetContext();
            }
            catch
            {
                break; // Stop() 触发
            }
            ThreadPool.QueueUserWorkItem(async _ =>
            {
                await ProcessRequestAsync(ctx).ConfigureAwait(false);
            });
        }
    }

    private async Task ProcessRequestAsync(HttpListenerContext ctx)
    {
        try
        {
            if (_paused)
            {
                ctx.Response.StatusCode = 503;
                ctx.Response.Close();
                return;
            }
            await _concurrencyLimiter.WaitAsync().ConfigureAwait(false);
            try
            {
                await Router.DispatchAsync(ctx, this).ConfigureAwait(false);
            }
            finally
            {
                _concurrencyLimiter.Release();
            }
        }
        catch (Exception ex)
        {
            AppLogger.Error("请求处理异常", ex);
            try { ApiResponse.Error(ctx.Response, 500, "internal error"); } catch { }
        }
        finally
        {
            try { ctx.Response.Close(); } catch { }
        }
    }

    /// <summary>暂停接受新请求（Android OnPause）；在途请求继续完成。</summary>
    public void Pause() => _paused = true;

    public void Resume() => _paused = false;

    public void Stop()
    {
        try { _cts.Cancel(); } catch { }
        try { _listener?.Stop(); } catch { }
        try { _listener?.Close(); } catch { }
        _listener = null;
        AppLogger.Info("服务器已停止");
    }

    public void Dispose()
    {
        Stop();
        _concurrencyLimiter.Dispose();
        _db?.Dispose();
    }
}
