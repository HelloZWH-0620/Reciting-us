using System.Runtime.Versioning;
using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using AvaloniaWebView;
using RecitingUs.Core;

namespace RecitingUs.App;

public class App : Avalonia.Application
{
    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    public override void RegisterServices()
    {
        base.RegisterServices();
        AvaloniaWebViewBuilder.Initialize(null);
    }

    public override void OnFrameworkInitializationCompleted()
    {
#if WINDOWS
        // 平台服务先于服务器装配（数据目录/密钥/TTS 依赖平台）；Android 端由 MainActivity.OnCreate 装配
        EmbeddedHttpServer.Instance.Platform = new RecitingUs.App.Platforms.Windows.WindowsPlatformServices();
        EmbeddedHttpServer.Instance.Tts = new RecitingUs.App.Platforms.Windows.WindowsTtsService();
#endif

        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
#if WINDOWS
            if (!Platforms.Windows.WebView2Checker.IsInstalled())
            {
                Platforms.Windows.WebView2Checker.PromptInstall();
                desktop.Shutdown();
                return;
            }
#endif
            var window = new MainWindow();
            window.Closed += (_, _) => EmbeddedHttpServer.Instance.Stop();
            desktop.MainWindow = window;
            StartupTimer.Mark("桌面窗口创建");
        }
        else if (ApplicationLifetime is ISingleViewApplicationLifetime single)
        {
            // Android 单视图；桌面 new Window() 会抛 NotSupportedException，务必分支
            single.MainView = new MainView();
            StartupTimer.Mark("单视图创建");
        }

        base.OnFrameworkInitializationCompleted();
        AppLogger.Info(StartupTimer.GetReport());
    }
}
