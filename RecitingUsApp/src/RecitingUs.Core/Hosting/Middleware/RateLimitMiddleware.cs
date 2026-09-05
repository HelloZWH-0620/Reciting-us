namespace RecitingUs.Core;

/// <summary>
/// 令牌桶限流（v3 §5.5）：容量 maxRequests，按 windowSeconds 匀速回填。
/// 相对文档伪代码修正了「回填未与取用对账」的缺陷，直接维护令牌数。
/// </summary>
public sealed class TokenBucketRateLimiter : IDisposable
{
    private readonly object _lock = new();
    private readonly int _capacity;
    private readonly double _refillPerSecond;
    private readonly Timer _timer;
    private double _tokens;
    private DateTime _lastRefill = DateTime.UtcNow;
    private bool _disposed;

    public TokenBucketRateLimiter(int maxRequests, int windowSeconds)
    {
        if (maxRequests < 1) throw new ArgumentOutOfRangeException(nameof(maxRequests));
        if (windowSeconds < 1) throw new ArgumentOutOfRangeException(nameof(windowSeconds));
        _capacity = maxRequests;
        _tokens = maxRequests;
        _refillPerSecond = (double)maxRequests / windowSeconds;
        _timer = new Timer(_ => Refill(), null, TimeSpan.FromSeconds(windowSeconds), TimeSpan.FromSeconds(windowSeconds));
    }

    public bool TryAcquire()
    {
        lock (_lock)
        {
            if (_disposed) return false;
            RefillLocked();
            if (_tokens >= 1)
            {
                _tokens -= 1;
                return true;
            }
            return false;
        }
    }

    private void Refill() => RefillLocked();

    private void RefillLocked()
    {
        var now = DateTime.UtcNow;
        var elapsed = (now - _lastRefill).TotalSeconds;
        if (elapsed <= 0) return;
        _lastRefill = now;
        _tokens = Math.Min(_capacity, _tokens + elapsed * _refillPerSecond);
    }

    public void Dispose()
    {
        lock (_lock)
        {
            if (_disposed) return;
            _disposed = true;
            _timer.Dispose();
        }
    }
}

/// <summary>AI 代理限流入口（按端点复用）。</summary>
public static class RateLimitMiddleware
{
    public static readonly TokenBucketRateLimiter AiProxy = new(maxRequests: 10, windowSeconds: 60);

    public static bool TryAcquireAiProxy() => AiProxy.TryAcquire();
}
