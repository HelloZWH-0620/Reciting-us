namespace RecitingUs.Core;

/// <summary>跨平台 TTS 抽象：桌面 (SAPI/WinRT) 与 Android (TextToSpeech) 各自实现，Web 端经 /api/tts/* 调用。</summary>
public interface ITtsService
{
    bool IsAvailable { get; }

    /// <summary>朗读文本（异步启动，立即返回）。</summary>
    void Speak(string text, float rate, string? voiceId = null);

    void Stop();

    IReadOnlyList<TtsVoice> GetVoices();
}

public sealed record TtsVoice(string Id, string Name, string Lang);
