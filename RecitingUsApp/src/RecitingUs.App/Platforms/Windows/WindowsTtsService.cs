using System.Speech.Synthesis;
using RecitingUs.Core;

namespace RecitingUs.App.Platforms.Windows;

/// <summary>Windows 原生 TTS（SAPI，System.Speech）：中文语音优先排序。</summary>
public sealed class WindowsTtsService : ITtsService
{
    private readonly SpeechSynthesizer _synth = new();
    private readonly bool _available;
    private readonly List<TtsVoice> _voices = new();

    public WindowsTtsService()
    {
        try
        {
            var voices = _synth.GetInstalledVoices();
            _voices.AddRange(voices
                .Select(v => new TtsVoice(v.VoiceInfo.Id, v.VoiceInfo.Name, v.VoiceInfo.Culture.Name))
                .OrderByDescending(v => v.Lang.StartsWith("zh", StringComparison.OrdinalIgnoreCase)));
            _available = _voices.Count > 0;
        }
        catch (Exception e)
        {
            AppLogger.Warn("Windows TTS 初始化失败: " + e.Message);
            _available = false;
        }
    }

    public bool IsAvailable => _available;

    public void Speak(string text, float rate, string? voiceId = null)
    {
        try
        {
            _synth.SpeakAsyncCancelAll();
            var selected = _voices.FirstOrDefault(v => v.Id == voiceId)
                ?? _voices.FirstOrDefault(); // 已按 zh 优先排序
            if (selected is not null)
            {
                try { _synth.SelectVoice(selected.Name); } catch { }
            }
            _synth.Rate = (int)Math.Clamp(rate * 2f, -10f, 10f); // SAPI 范围 -10..10，1.0x → 2
            _synth.SpeakAsync(text);
        }
        catch (Exception e)
        {
            AppLogger.Warn("Windows TTS speak 失败: " + e.Message);
        }
    }

    public void Stop()
    {
        try { _synth.SpeakAsyncCancelAll(); } catch { }
    }

    public IReadOnlyList<TtsVoice> GetVoices() => _voices;
}
