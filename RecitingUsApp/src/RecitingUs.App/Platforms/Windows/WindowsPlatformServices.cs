using System.Security.Cryptography;
using System.Text;
using RecitingUs.Core.Platform;

namespace RecitingUs.App.Platforms.Windows;

/// <summary>Windows 平台服务：密钥经 DPAPI（当前用户作用域）加密后落盘。</summary>
public sealed class WindowsPlatformServices : DefaultPlatformServices
{
    public override string? GetSecret(string name)
    {
        var path = SecretPath(name);
        if (!File.Exists(path)) return null;
        try
        {
            var cipher = File.ReadAllBytes(path);
            var plain = ProtectedData.Unprotect(cipher, optionalEntropy: null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(plain);
        }
        catch (CryptographicException)
        {
            return null; // 换机器/换用户后旧密文不可解，按未配置处理
        }
    }

    public override void SetSecret(string name, string value)
    {
        var path = SecretPath(name);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var cipher = ProtectedData.Protect(Encoding.UTF8.GetBytes(value), optionalEntropy: null, DataProtectionScope.CurrentUser);
        File.WriteAllBytes(path, cipher);
    }
}
