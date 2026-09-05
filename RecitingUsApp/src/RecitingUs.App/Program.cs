using RecitingUs.Core;
using Avalonia;
using Avalonia.WebView.Desktop;
using Avalonia.Logging;

namespace RecitingUs.App;

internal static class Program
{
    [STAThread]
    public static void Main(string[] args)
    {
        StartupTimer.Mark("进程启动");
        BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
    }

    public static AppBuilder BuildAvaloniaApp() =>
        AppBuilder.Configure<App>()
            .UsePlatformDetect()
            .LogToTrace(LogEventLevel.Warning)
            .UseDesktopWebView();
}
