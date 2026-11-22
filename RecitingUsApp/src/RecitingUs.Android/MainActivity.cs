using System.Runtime.Versioning;
using Android.Content;
using Android.Content.PM;
using Android.OS;
using Android.Window;
using Avalonia;
using Avalonia.Android;
using Avalonia.WebView.Android;
using RecitingUs.Core;
using RecitingUs.PlatformAndroid;

namespace RecitingUs.App;

[Activity(Label = "背书哇", Theme = "@style/MyTheme", MainLauncher = true,
    // 尽量让配置变化走 onConfigurationChanged 而不是销毁重建 Activity：
    // Avalonia 11.0.0 的 AvaloniaView 在 Activity 重建后可能因 native handle 失配
    // 抛 "Unable to activate instance of type Avalonia.Android.AvaloniaView"。
    ConfigurationChanges =
        ConfigChanges.Orientation | ConfigChanges.ScreenSize | ConfigChanges.UiMode |
        ConfigChanges.Density | ConfigChanges.LayoutDirection | ConfigChanges.FontScale |
        ConfigChanges.Keyboard | ConfigChanges.KeyboardHidden | ConfigChanges.Navigation |
        ConfigChanges.SmallestScreenSize | ConfigChanges.Touchscreen | ConfigChanges.Locale)]
public class MainActivity : AvaloniaMainActivity<App>
{
    // UseAndroid() 注册 Avalonia 主平台服务（缺失会在 AppBuilder.Setup 抛
    // "No runtime platform services configured"）；UseAndroidWebView() 注册 WebView 平台
    protected override AppBuilder CustomizeAppBuilder(AppBuilder builder) =>
        builder.UseAndroid().UseAndroidWebView();

    protected override void OnCreate(Bundle? savedInstanceState)
    {
        // 平台服务必须先于 Avalonia 初始化装配（MainView 构造时会启动 HTTP 服务器）
        EmbeddedHttpServer.Instance.Platform = new AndroidPlatformServices(this);
        EmbeddedHttpServer.Instance.Tts = new AndroidTtsService(this);
        base.OnCreate(savedInstanceState);

        // 保险：Activity 重建时 MainView 不一定会重新构造（Avalonia 复用单视图），
        // 若上一轮 OnDestroy 已 Stop 服务器，这里幂等重启，避免 WebView 永久转圈。
        try { EmbeddedHttpServer.Instance.Start(preferredPort: 8000); }
        catch (Exception ex) { AppLogger.Warn("服务器重启失败: " + ex.Message); }

        // 返回键：Android 13+ 走预测性返回（OnBackInvokedCallback），
        // Avalonia 11.0.0 的 BackRequested 在该路径下不会被调用，系统会直接 finish Activity。
        // 这里自己注册最高优先级回调：能后退就后退，否则整任务退到后台，
        // 避免 Activity 销毁 → 服务器被停 → 重建后 WebView 空白。
        if (Build.VERSION.SdkInt >= BuildVersionCodes.Tiramisu)
        {
            _backCallback = new BackInvokedCallback(this);
            OnBackInvokedDispatcher.RegisterOnBackInvokedCallback(0, _backCallback);
        }

        StartupTimer.Mark("Android Activity 创建");
    }

    private BackInvokedCallback? _backCallback;

    private sealed class BackInvokedCallback : Java.Lang.Object, IOnBackInvokedCallback
    {
        private readonly MainActivity _owner;
        public BackInvokedCallback(MainActivity owner) => _owner = owner;
        public void OnBackInvoked() => _owner.HandleBack();
    }

    /// <summary>返回：WebView 有历史则后退，否则退到桌面（不 finish Activity）。</summary>
    internal void HandleBack()
    {
        var webview = MainView.Instance?.WebViewControl;
        if (webview is not null)
        {
            try
            {
                var canGoBack = webview.GetType().GetProperty("CanGoBack");
                var goBack = webview.GetType().GetMethod("GoBack", Type.EmptyTypes);
                if (canGoBack is not null && goBack is not null &&
                    true.Equals(canGoBack.GetValue(webview)))
                {
                    goBack.Invoke(webview, null);
                    return;
                }
            }
            catch (Exception ex)
            {
                AppLogger.Warn("WebView 返回键处理失败: " + ex.Message);
            }
        }

        try { MoveTaskToBack(true); }
        catch (Exception ex) { AppLogger.Warn("退到后台失败: " + ex.Message); }
    }

    [Obsolete("Android 13+ 使用 OnBackInvokedCallback，此方法仅覆盖旧系统")]
    public override void OnBackPressed() => HandleBack();

    // v3 §8.2：生命周期与本地服务器绑定，避免后台占端口/资源
    protected override void OnPause()
    {
        base.OnPause();
        EmbeddedHttpServer.Instance.Pause();
    }

    protected override void OnResume()
    {
        base.OnResume();
        var server = EmbeddedHttpServer.Instance;
        server.Resume();

        // 保险：系统若仍重建了 Activity，新 WebView 可能没有地址
        // （实测只请求 /favicon.ico 不请求 /app.html → 白屏）。延迟补一次地址。
        try
        {
            var handler = new Handler(Looper.MainLooper!);
            handler.PostDelayed(new Java.Lang.Runnable(ReloadWebViewIfNeeded), 600);
        }
        catch (Exception ex)
        {
            AppLogger.Warn("安排 WebView 恢复失败: " + ex.Message);
        }
    }

    private void ReloadWebViewIfNeeded()
    {
        try
        {
            var server = EmbeddedHttpServer.Instance;
            var webview = MainView.Instance?.WebViewControl;
            if (webview is null) return;
            var expected = new Uri(server.BaseUrl + "app.html");
            if (webview.Url != expected) webview.Url = expected;
        }
        catch (Exception ex)
        {
            AppLogger.Warn("恢复 WebView 地址失败: " + ex.Message);
        }
    }

    protected override void OnDestroy()
    {
        if (_backCallback is not null && Build.VERSION.SdkInt >= BuildVersionCodes.Tiramisu)
        {
            try { OnBackInvokedDispatcher.UnregisterOnBackInvokedCallback(_backCallback); } catch { }
            _backCallback = null;
        }

        // 只有用户真正退出（finish）才停服务器；配置变化/系统回收导致的销毁只暂停，
        // 否则重建后 MainView 不再构造，静态单例永远停在 Stopped → WebView 永久白屏。
        if (IsFinishing)
            EmbeddedHttpServer.Instance.Stop();
        else
            EmbeddedHttpServer.Instance.Pause();
        base.OnDestroy();
    }

    public override void OnTrimMemory(TrimMemory level)
    {
        base.OnTrimMemory(level);
        if (level >= TrimMemory.Moderate)
            AppLogger.Info($"内存压力 level={level}：回收由 GC/WebView 处理");
    }
}
