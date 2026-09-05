using Java.Security;
using Javax.Crypto;
using Javax.Crypto.Spec;
using RecitingUs.Core.Platform;

namespace RecitingUs.PlatformAndroid;

/// <summary>
/// Android 平台服务：数据目录用 App 私有 filesDir；
/// 密钥保管用 AndroidKeyStore 生成的 AES-GCM 密钥加密后落盘（密钥不出安全芯片）。
/// </summary>
public sealed class AndroidPlatformServices : DefaultPlatformServices
{
    private const string KeyStoreName = "AndroidKeyStore";
    private const string KeyAlias = "recitingus_secret_key";
    private readonly Android.Content.Context _context;

    public AndroidPlatformServices(Android.Content.Context context) => _context = context;

    public override string DataDir => _context.FilesDir!.AbsolutePath;

    public override string? GetSecret(string name)
    {
        var path = SecretPath(name);
        if (!File.Exists(path)) return null;
        try
        {
            var blob = File.ReadAllBytes(path);
            var iv = new byte[12];
            Array.Copy(blob, iv, 12);
            var cipherText = new byte[blob.Length - 12];
            Array.Copy(blob, 12, cipherText, 0, cipherText.Length);

            var key = GetOrCreateKey();

            using var cipher = Cipher.GetInstance("AES/GCM/NoPadding");
            cipher.Init(CipherMode.DecryptMode, key, new GCMParameterSpec(128, iv));
            var plain = cipher.DoFinal(cipherText);
            return System.Text.Encoding.UTF8.GetString(plain);
        }
        catch (Exception e)
        {
            RecitingUs.Core.AppLogger.Warn("Android 密钥解密失败: " + e.Message);
            return null;
        }
    }

    public override void SetSecret(string name, string value)
    {
        var path = SecretPath(name);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        try
        {
            var key = GetOrCreateKey();
            using var cipher = Cipher.GetInstance("AES/GCM/NoPadding");
            cipher.Init(CipherMode.EncryptMode, key);
            var iv = cipher.GetIV();
            var plain = System.Text.Encoding.UTF8.GetBytes(value);
            var cipherText = cipher.DoFinal(plain);

            using var fs = File.Create(path);
            fs.Write(iv, 0, iv.Length);
            fs.Write(cipherText, 0, cipherText.Length);
        }
        catch (Exception e)
        {
            RecitingUs.Core.AppLogger.Error("Android 密钥加密失败", e);
        }
    }

    private static ISecretKey GetOrCreateKey()
    {
        using var ks = KeyStore.GetInstance(KeyStoreName);
        ks.Load(null);
        if (ks.GetKey(KeyAlias, null) is ISecretKey existing) return existing;

        var generator = KeyGenerator.GetInstance(Android.Security.Keystore.KeyProperties.KeyAlgorithmAes, KeyStoreName);
        generator.Init(new Android.Security.Keystore.KeyGenParameterSpec.Builder(KeyAlias,
                Android.Security.Keystore.KeyStorePurpose.Encrypt)
            .SetBlockModes(Android.Security.Keystore.KeyProperties.BlockModeGcm)
            .SetEncryptionPaddings(Android.Security.Keystore.KeyProperties.EncryptionPaddingNone)
            .SetKeySize(256)
            .Build());
        return generator.GenerateKey();
    }

    protected override string SecretPath(string name)
    {
        var safe = string.Concat(name.Select(c => char.IsLetterOrDigit(c) || c is '.' or '-' or '_' ? c : '_'));
        return Path.Combine(DataDir, "secrets", safe + ".bin");
    }
}
