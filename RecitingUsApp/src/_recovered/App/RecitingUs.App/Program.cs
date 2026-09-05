using System;
using Avalonia;
using Avalonia.Logging;
using Avalonia.WebView.Desktop;

namespace RecitingUs.App;

internal static class Program
{
	[STAThread]
	public static void Main(string[] args)
	{
		BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
	}

	public static AppBuilder BuildAvaloniaApp()
	{
		return AppBuilder.Configure<App>().UsePlatformDetect().LogToTrace(LogEventLevel.Warning)
			.UseDesktopWebView();
	}
}
