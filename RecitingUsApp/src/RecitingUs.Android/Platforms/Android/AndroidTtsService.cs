using Android.Speech.Tts;
using Java.Util;
using RecitingUs.Core;

namespace RecitingUs.PlatformAndroid;

/// <summary>
/// Android 原生 TTS（Android.Speech.Tts.TextToSpeech，zh-CN 优先）。
/// 修复部分 Android WebView 缺失 window.speechSynthesis 的历史缺陷（v3 §7.4）。
/// </summary>
public sealed class AndroidTtsService : Java.Lang.Object, ITtsService, TextToSpeech.IOnInitListener
{
    private readonly Android.Content.Context _context;
    private TextToSpeech? _tts;
    private readonly TaskCompletionSource<bool> _initTcs = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly List<TtsVoice> _voices = new();
    private bool _ready;

    public AndroidTtsService(Android.Content.Context context)
    {
        _context = context;
        try
        {
            _tts = new TextToSpeech(context, this);
        }
        catch (Exception e)
        {
            AppLogger.Warn("Android TTS 初始化失败: " + e.Message);
            _initTcs.TrySetResult(false);
        }
    }

    public void OnInit(OperationResult status)
    {
        if (status != OperationResult.Success || _tts is null)
        {
            AppLogger.Warn("Android TTS 初始化未成功: " + status);
            _initTcs.TrySetResult(false);
            return;
        }

        try
        {
            var result = _tts.SetLanguage(Locale.China);
            if (result == LanguageAvailableResult.MissingData || result == LanguageAvailableResult.NotSupported)
                _ = _tts.SetLanguage(Locale.SimplifiedChinese); // 兜底
            _voices.AddRange(_tts.Voices?
                .Where(v => v?.Locale is not null)
                .Select(v => new TtsVoice(v.Name, v.Name,
                    v.Locale.Language + (string.IsNullOrEmpty(v.Locale.Country) ? "" : "-" + v.Locale.Country)))
                .OrderByDescending(v => v.Lang.StartsWith("zh", StringComparison.OrdinalIgnoreCase)) ?? Enumerable.Empty<TtsVoice>());
            _ready = true;
        }
        catch (Exception e)
        {
            AppLogger.Warn("Android TTS 语言设置失败: " + e.Message);
        }
        _initTcs.TrySetResult(_ready);
    }

    public bool IsAvailable => _ready && _tts is not null;

    public void Speak(string text, float rate, string? voiceId = null)
    {
        var tts = _tts;
        if (tts is null || !_ready) return;
        try
        {
            tts.SetSpeechRate(Math.Clamp(rate, 0.25f, 4f));
            tts.Speak(text, QueueMode.Flush, new Bundle(), Guid.NewGuid().ToString("N"));
        }
        catch (Exception e)
        {
            AppLogger.Warn("Android TTS speak 失败: " + e.Message);
        }
    }

    public void Stop()
    {
        try { _tts?.Stop(); } catch { }
    }

    public IReadOnlyList<TtsVoice> GetVoices() => _voices;

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            try
            {
                _tts?.Stop();
                _tts?.Shutdown();
                _tts = null;
            }
            catch { }
        }
        base.Dispose(disposing);
    }
}
