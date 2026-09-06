using System.Runtime.Versioning;
using Android.Content;
using Android.Content.PM;
using Android.OS;
using Avalonia;
using Avalonia.Android;
using Avalonia.WebView.Android;
using RecitingUs.Core;
using RecitingUs.PlatformAndroid;

namespace RecitingUs.App;

[Activity(Label = "背书哇", Theme = "@style/MyTheme", MainLauncher = true,
    ConfigurationChanges = ConfigChanges.Orientation | ConfigChanges.ScreenSize | ConfigChanges.UiMode)]
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

        // 返回键：WebView 可后退则后退，否则交系统（不直接退出）。
        // WebView.Avalonia 11 的 WebView 控件未直接暴露导航历史，经反射探测（不存在则静默降级）。
        BackRequested += (_, e) =>
        {
            var webview = MainView.Instance?.WebViewControl;
            if (webview is null) return;
            try
            {
                var canGoBack = webview.GetType().GetProperty("CanGoBack");
                var goBack = webview.GetType().GetMethod("GoBack", Type.EmptyTypes);
                if (canGoBack is not null && goBack is not null &&
                    true.Equals(canGoBack.GetValue(webview)))
                {
                    goBack.Invoke(webview, null);
                    e.Handled = true;
                }
            }
            catch (Exception ex)
            {
                AppLogger.Warn("WebView 返回键处理失败: " + ex.Message);
            }
        };
        StartupTimer.Mark("Android Activity 创建");
    }

    // v3 §8.2：生命周期与本地服务器绑定，避免后台占端口/资源
    protected override void OnPause()
    {
        base.OnPause();
        EmbeddedHttpServer.Instance.Pause();
    }

    protected override void OnResume()
    {
        base.OnResume();
        EmbeddedHttpServer.Instance.Resume();
    }

    protected override void OnDestroy()
    {
        EmbeddedHttpServer.Instance.Stop();
        base.OnDestroy();
    }

    public override void OnTrimMemory(TrimMemory level)
    {
        base.OnTrimMemory(level);
        if (level >= TrimMemory.Moderate)
            AppLogger.Info($"内存压力 level={level}：回收由 GC/WebView 处理");
    }
}
