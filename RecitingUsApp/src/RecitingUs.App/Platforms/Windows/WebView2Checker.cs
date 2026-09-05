using Microsoft.Win32;

namespace RecitingUs.App.Platforms.Windows;

/// <summary>WebView2 Evergreen Runtime 检测与引导安装（v3 §8.1）。</summary>
public static class WebView2Checker
{
    private const string RuntimeRegKey =
        @"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
    private const string RuntimeRegKeyWow64 =
        @"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
    private const string DownloadUrl = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";

    public static bool IsInstalled()
    {
        foreach (var (root, keyPath) in new[]
                 {
                     (Registry.LocalMachine, RuntimeRegKeyWow64),
                     (Registry.LocalMachine, RuntimeRegKey),
                     (Registry.CurrentUser, RuntimeRegKey)
                 })
        {
            try
            {
                using var key = root.OpenSubKey(keyPath);
                if (key?.GetValue("pv") is string version && version.Length > 0 && version != "0.0.0.0")
                    return true;
            }
            catch { /* 权限不足等，继续尝试下一处 */ }
        }
        return false;
    }

    /// <summary>弹原生对话框引导下载（避免 Avalonia 窗口尚未就绪的黑屏体验）。</summary>
    public static void PromptInstall()
    {
        const int MB_ICONWARNING = 0x30;
        const int MB_YESNO = 0x04;
        var result = MessageBoxW(IntPtr.Zero,
            "背书哇需要 WebView2 运行时才能显示界面。\n\n是否立即打开官网下载安装？\n（安装完成后重新打开背书哇）",
            "WebView2 未安装", MB_YESNO | MB_ICONWARNING);
        if (result == 6 /* IDYES */)
        {
            try
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = DownloadUrl,
                    UseShellExecute = true
                });
            }
            catch { /* 浏览器打开失败则静默 */ }
        }
    }

    [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
    private static extern int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);
}
