using System;
using System.ComponentModel;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Markup.Xaml.XamlIl.Runtime;
using Avalonia.Media.Immutable;
using CompiledAvaloniaXaml;

namespace RecitingUs.App;

public class MainWindow : Window
{
	private static Action<object> _0021XamlIlPopulateOverride;

	public MainWindow()
	{
		InitializeComponent();
	}

	public void InitializeComponent(bool loadXaml = true)
	{
		if (loadXaml)
		{
			_0021XamlIlPopulateTrampoline(this);
		}
	}

	static void _0021XamlIlPopulate(IServiceProvider P_0, MainWindow P_1)
	{
		CompiledAvaloniaXaml.XamlIlContext.Context<MainWindow> context = new CompiledAvaloniaXaml.XamlIlContext.Context<MainWindow>(P_0, new object[1] { _0021AvaloniaResources.NamespaceInfo_003A_002FMainWindow_002Eaxaml.Singleton }, "avares://RecitingUs/MainWindow.axaml");
		context.RootObject = P_1;
		context.IntermediateRoot = P_1;
		((ISupportInitialize)P_1).BeginInit();
		P_1.Title = "背书哇！";
		P_1.Width = 1280.0;
		P_1.Height = 820.0;
		P_1.MinWidth = 900.0;
		P_1.MinHeight = 640.0;
		P_1.Background = new ImmutableSolidColorBrush(uint.MaxValue);
		MainView mainView2;
		MainView mainView = (mainView2 = new MainView());
		((ISupportInitialize)mainView).BeginInit();
		P_1.Content = mainView;
		((ISupportInitialize)mainView2).EndInit();
		((ISupportInitialize)P_1).EndInit();
		if (P_1 is StyledElement styled)
		{
			NameScope.SetNameScope(styled, context.AvaloniaNameScope);
		}
		context.AvaloniaNameScope.Complete();
	}

	private static void _0021XamlIlPopulateTrampoline(MainWindow P_0)
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
