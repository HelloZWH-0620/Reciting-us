using System;
using System.ComponentModel;
using RecitingUs.App;

namespace CompiledAvaloniaXaml;

[EditorBrowsable(EditorBrowsableState.Never)]
public class _0021XamlLoader
{
	public static object TryLoad(IServiceProvider P_0, string P_1)
	{
		if (string.Equals(P_1, "avares://RecitingUs/App.axaml", StringComparison.OrdinalIgnoreCase))
		{
			return new App();
		}
		if (string.Equals(P_1, "avares://RecitingUs/MainView.axaml", StringComparison.OrdinalIgnoreCase))
		{
			return new MainView();
		}
		if (string.Equals(P_1, "avares://RecitingUs/MainWindow.axaml", StringComparison.OrdinalIgnoreCase))
		{
			return new MainWindow();
		}
		return null;
	}

	public static object TryLoad(string P_0)
	{
		return TryLoad(null, P_0);
	}
}
