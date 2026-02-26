import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter, RateLimitError } from '../../src/utils/rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(5, 1000, 'test');
  });

  it('should allow requests under the limit', () => {
    expect(limiter.check()).toBe(0);
    limiter.acquire();
    limiter.acquire();
    limiter.acquire();
    expect(limiter.currentCount).toBe(3);
    expect(limiter.remaining).toBe(2);
  });

  it('should block when limit is reached', () => {
    for (let i = 0; i < 5; i++) {
      limiter.acquire();
    }
    expect(limiter.remaining).toBe(0);
    expect(() => limiter.acquire()).toThrow(RateLimitError);
  });

  it('should return correct wait time when at limit', () => {
    for (let i = 0; i < 5; i++) {
      limiter.acquire();
    }
    const waitMs = limiter.check();
    expect(waitMs).toBeGreaterThan(0);
    expect(waitMs).toBeLessThanOrEqual(1000);
  });

  it('should reset after window expires', async () => {
    const shortLimiter = new RateLimiter(2, 100, 'short');
    shortLimiter.acquire();
    shortLimiter.acquire();
    expect(shortLimiter.remaining).toBe(0);

    await new Promise((r) => setTimeout(r, 150));

    expect(shortLimiter.remaining).toBe(2);
    expect(shortLimiter.check()).toBe(0);
  });

  it('should acquireAsync and wait when throttled', async () => {
    const fastLimiter = new RateLimiter(2, 200, 'fast');
    fastLimiter.acquire();
    fastLimiter.acquire();

    const start = Date.now();
    await fastLimiter.acquireAsync();
    const elapsed = Date.now() - start;

    // Should have waited ~200ms for window to slide
    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(fastLimiter.currentCount).toBe(1); // old ones pruned, new one added
  });

  it('should throw RateLimitError with waitMs', () => {
    for (let i = 0; i < 5; i++) {
      limiter.acquire();
    }
    try {
      limiter.acquire();
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError);
      expect((e as RateLimitError).waitMs).toBeGreaterThan(0);
    }
  });

  it('should handle updateFromHeaders without crashing', () => {
    expect(() => {
      limiter.updateFromHeaders({});
      limiter.updateFromHeaders({ 'x-current-token-count': '100' });
      limiter.updateFromHeaders({ 'x-current-token-count': '3' });
    }).not.toThrow();
  });
});
