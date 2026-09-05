using System;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml.XamlIl.Runtime;
using Avalonia.Styling;
using Avalonia.Themes.Fluent;
using AvaloniaWebView;
using CompiledAvaloniaXaml;

namespace RecitingUs.App;

public class App : Application
{
	private static Action<object> _0021XamlIlPopulateOverride;

	public override void Initialize()
	{
		_0021XamlIlPopulateTrampoline(this);
	}

	public override void RegisterServices()
	{
		base.RegisterServices();
		AvaloniaWebViewBuilder.Initialize(null);
	}

	public override void OnFrameworkInitializationCompleted()
	{
		if (base.ApplicationLifetime is IClassicDesktopStyleApplicationLifetime classicDesktopStyleApplicationLifetime)
		{
			classicDesktopStyleApplicationLifetime.MainWindow = new MainWindow();
		}
		else if (base.ApplicationLifetime is ISingleViewApplicationLifetime singleViewApplicationLifetime)
		{
			singleViewApplicationLifetime.MainView = new MainView();
		}
		base.OnFrameworkInitializationCompleted();
	}

	static void _0021XamlIlPopulate(IServiceProvider P_0, App P_1)
	{
		CompiledAvaloniaXaml.XamlIlContext.Context<App> context = new CompiledAvaloniaXaml.XamlIlContext.Context<App>(P_0, new object[1] { _0021AvaloniaResources.NamespaceInfo_003A_002FApp_002Eaxaml.Singleton }, "avares://RecitingUs/App.axaml");
		context.RootObject = P_1;
		context.IntermediateRoot = P_1;
		App app2;
		App app = (app2 = P_1);
		context.PushParent(app2);
		app2.RequestedThemeVariant = ThemeVariant.Default;
		app2.Styles.Add(new FluentTheme(context));
		context.PopParent();
		if (app is StyledElement styled)
		{
			NameScope.SetNameScope(styled, context.AvaloniaNameScope);
		}
		context.AvaloniaNameScope.Complete();
	}

	private static void _0021XamlIlPopulateTrampoline(App P_0)
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
