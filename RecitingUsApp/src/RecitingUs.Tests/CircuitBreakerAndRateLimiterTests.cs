using Xunit;
using RecitingUs.Core;

namespace RecitingUs.Tests;

public class CircuitBreakerTests
{
    [Fact]
    public void StartsClosed()
    {
        var breaker = new CircuitBreaker(failureThreshold: 5, openDurationSeconds: 60);
        Assert.False(breaker.IsOpen);
    }

    [Fact]
    public void Opens_AfterConsecutiveFailures()
    {
        var breaker = new CircuitBreaker(failureThreshold: 5, openDurationSeconds: 60);
        for (var i = 0; i < 4; i++) breaker.RecordFailure();
        Assert.False(breaker.IsOpen); // 阈值未到
        breaker.RecordFailure();
        Assert.True(breaker.IsOpen);  // 第 5 次 → 熔断
    }

    [Fact]
    public void HalfOpens_AfterTimeout()
    {
        // openDuration = 0：熔断即刻超时，首次 IsOpen 即为半开（返回 false 且清零计数）
        var breaker = new CircuitBreaker(failureThreshold: 2, openDurationSeconds: 0);
        breaker.RecordFailure();
        breaker.RecordFailure();
        Assert.False(breaker.IsOpen);   // 半开放行
        breaker.RecordFailure();
        Assert.False(breaker.IsOpen);   // 计数已重置，需重新累积到阈值
    }

    [Fact]
    public void Success_ResetsFailureCount()
    {
        var breaker = new CircuitBreaker(failureThreshold: 3, openDurationSeconds: 60);
        breaker.RecordFailure();
        breaker.RecordFailure();
        breaker.RecordSuccess();
        breaker.RecordFailure();
        breaker.RecordFailure();
        Assert.False(breaker.IsOpen);
    }
}

public class TokenBucketRateLimiterTests
{
    [Fact]
    public void AllowsBurst_UpToCapacity()
    {
        using var limiter = new TokenBucketRateLimiter(maxRequests: 3, windowSeconds: 60);
        Assert.True(limiter.TryAcquire());
        Assert.True(limiter.TryAcquire());
        Assert.True(limiter.TryAcquire());
        Assert.False(limiter.TryAcquire()); // 桶空
    }

    [Fact]
    public void Refills_AfterWindow()
    {
        using var limiter = new TokenBucketRateLimiter(maxRequests: 1, windowSeconds: 1);
        Assert.True(limiter.TryAcquire());
        Assert.False(limiter.TryAcquire());
        Thread.Sleep(1200); // 回填 ~1 token
        Assert.True(limiter.TryAcquire());
    }
}
