namespace RecitingUs.Core;

/// <summary>
/// 断路器（v3 §5.5）：连续失败 failureThreshold 次后熔断 openDurationSeconds 秒；
/// 超时后半开（失败计数清零，允许试探性请求）。
/// </summary>
public sealed class CircuitBreaker
{
    private readonly int _failureThreshold;
    private readonly TimeSpan _openDuration;
    private readonly object _lock = new();
    private int _failures;
    private DateTime _openedAt = DateTime.MinValue;

    public CircuitBreaker(int failureThreshold = 5, int openDurationSeconds = 60)
    {
        _failureThreshold = Math.Max(1, failureThreshold);
        _openDuration = TimeSpan.FromSeconds(openDurationSeconds);
    }

    public bool IsOpen
    {
        get
        {
            lock (_lock)
            {
                if (_failures < _failureThreshold) return false;
                if (DateTime.UtcNow - _openedAt < _openDuration) return true;
                _failures = 0; // 半开：放行试探
                return false;
            }
        }
    }

    public void RecordSuccess()
    {
        lock (_lock) _failures = 0;
    }

    public void RecordFailure()
    {
        lock (_lock)
        {
            _failures++;
            if (_failures >= _failureThreshold) _openedAt = DateTime.UtcNow;
        }
    }
}
