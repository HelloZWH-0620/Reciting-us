using System;
using System.ComponentModel;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Markup.Xaml.XamlIl.Runtime;
using Avalonia.Media.Immutable;
using AvaloniaWebView;
using CompiledAvaloniaXaml;
using RecitingUs.Core;

namespace RecitingUs.App;

public class MainView : UserControl
{
	internal WebView WebViewControl;

	private static Action<object?>? _0021XamlIlPopulateOverride;

	public static MainView? Instance { get; private set; }

	public MainView()
	{
		InitializeComponent();
		Instance = this;
		WebServer.Instance.Start();
		WebViewControl.Url = new Uri(WebServer.Instance.BaseUrl + "app.html");
	}

	public void InitializeComponent(bool loadXaml = true)
	{
		if (loadXaml)
		{
			_0021XamlIlPopulateTrampoline(this);
		}
		WebViewControl = this.FindNameScope()?.Find<WebView>("WebViewControl");
	}

	static void _0021XamlIlPopulate(IServiceProvider? P_0, MainView? P_1)
	{
		CompiledAvaloniaXaml.XamlIlContext.Context<MainView> context = new CompiledAvaloniaXaml.XamlIlContext.Context<MainView>(P_0, new object[1] { _0021AvaloniaResources.NamespaceInfo_003A_002FMainView_002Eaxaml.Singleton }, "avares://RecitingUs/MainView.axaml");
		context.RootObject = P_1;
		context.IntermediateRoot = P_1;
		((ISupportInitialize)P_1).BeginInit();
		P_1.Background = new ImmutableSolidColorBrush(uint.MaxValue);
		WebView webView2;
		WebView webView = (webView2 = new WebView());
		((ISupportInitialize)webView).BeginInit();
		P_1.Content = webView;
		webView2.Name = "WebViewControl";
		object element = webView2;
		context.AvaloniaNameScope.Register("WebViewControl", element);
		((ISupportInitialize)webView2).EndInit();
		((ISupportInitialize)P_1).EndInit();
		if (P_1 is StyledElement styled)
		{
			NameScope.SetNameScope(styled, context.AvaloniaNameScope);
		}
		context.AvaloniaNameScope.Complete();
	}

	private static void _0021XamlIlPopulateTrampoline(MainView? P_0)
	{
		if (_0021XamlIlPopulateOverride != null)
		{
			_0021XamlIlPopulateOverride(P_0);
		}
		else
		{
			_0021XamlIlPopulate(XamlIlRuntimeHelpers.CreateRootServiceProviderV3(null), P_0);
		}
	}
}
