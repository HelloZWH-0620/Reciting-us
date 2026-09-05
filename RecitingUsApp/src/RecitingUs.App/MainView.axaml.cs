using Avalonia.Controls;
using Avalonia.Markup.Xaml;
using AvaloniaWebView;
using RecitingUs.Core;

namespace RecitingUs.App;

/// <summary>共享 WebView 宿主：启动本地服务器并加载 app.html（端口可能递增，用动态 BaseUrl）。</summary>
public partial class MainView : UserControl
{
    public static MainView? Instance { get; private set; }

    public MainView()
    {
        InitializeComponent();
        Instance = this;

        var server = EmbeddedHttpServer.Instance;
        server.Start(preferredPort: 8000);
        if (WebViewControl is not null)
        {
            WebViewControl.Url = new Uri(server.BaseUrl + "app.html");
        }
        StartupTimer.Mark("WebView 加载开始");
    }
}
