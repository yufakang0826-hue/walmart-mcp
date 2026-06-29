import { apiLogger } from './logger.js';

/**
 * Sliding window rate limiter.
 * Tracks requests in a time window and proactively blocks
 * before hitting Walmart's API limits.
 *
 * Walmart Marketplace: ~20 requests/second (token bucket)
 * Walmart Advertising: ~10 requests/second
 */
export class RateLimiter {
  private timestamps: number[] = [];

  /** Latest x-current-token-count reported by Walmart (per-endpoint bucket). */
  private latestServerTokens: number | null = null;
  /** Latest x-next-replenish-time ISO 8601 string reported by Walmart. */
  private latestReplenishTime: string | null = null;
  /** When latestServerTokens was last updated (epoch ms). */
  private latestServerSeenAt: number | null = null;

  constructor(
    private maxRequests: number,
    private windowMs: number,
    private name: string = 'default',
  ) {}

  /** Returns wait-time in ms (0 if allowed now). */
  check(): number {
    this.prune();
    if (this.timestamps.length < this.maxRequests) return 0;
    const oldest = this.timestamps[0];
    const waitMs = (oldest ?? Date.now()) + this.windowMs - Date.now();
    return Math.max(0, waitMs);
  }

  /** Synchronous acquire: throws if the request would exceed the limit. */
  acquire(): void {
    const waitMs = this.check();
    if (waitMs > 0) {
      apiLogger.warn(
        `[RateLimiter:${this.name}] Rate limit reached (${this.maxRequests}/${this.windowMs}ms). Need to wait ${waitMs}ms.`,
      );
      throw new RateLimitError(
        `Rate limit reached for ${this.name}. Try again in ${Math.ceil(waitMs / 1000)} seconds.`,
        waitMs,
      );
    }
    this.timestamps.push(Date.now());
  }

  /** Async acquire: waits instead of throwing. */
  async acquireAsync(): Promise<void> {
    const waitMs = this.check();
    if (waitMs > 0) {
      apiLogger.warn(
        `[RateLimiter:${this.name}] Throttling for ${waitMs}ms (${this.maxRequests}/${this.windowMs}ms)`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.timestamps.push(Date.now());
  }

  /**
   * Update from Walmart response headers. Caches the latest token count +
   * replenish time so getStatus() can surface them via the
   * walmart_get_rate_budget MCP tool.
   */
  updateFromHeaders(headers: Record<string, string>): void {
    const remaining = headers['x-current-token-count'];
    if (remaining !== undefined) {
      const count = parseInt(remaining, 10);
      if (!Number.isNaN(count)) {
        this.latestServerTokens = count;
        this.latestServerSeenAt = Date.now();
        if (count <= 5) {
          apiLogger.warn(
            `[RateLimiter:${this.name}] Only ${count} API tokens remaining. Replenish at: ${headers['x-next-replenish-time'] || 'unknown'}`,
          );
        }
      }
    }
    const replenish = headers['x-next-replenish-time'];
    if (replenish !== undefined) this.latestReplenishTime = replenish;
  }

  /** Snapshot for the rate-budget MCP tool. */
  getStatus(): {
    name: string;
    localMaxRequests: number;
    localWindowMs: number;
    localCurrentCount: number;
    localRemaining: number;
    serverTokensRemaining: number | null;
    serverReplenishTime: string | null;
    serverTokensSeenAt: string | null;
  } {
    return {
      name: this.name,
      localMaxRequests: this.maxRequests,
      localWindowMs: this.windowMs,
      localCurrentCount: this.currentCount,
      localRemaining: this.remaining,
      serverTokensRemaining: this.latestServerTokens,
      serverReplenishTime: this.latestReplenishTime,
      serverTokensSeenAt:
        this.latestServerSeenAt != null ? new Date(this.latestServerSeenAt).toISOString() : null,
    };
  }

  private prune(): void {
    const cutoff = Date.now() - this.windowMs;
    while (this.timestamps.length > 0 && (this.timestamps[0] ?? 0) <= cutoff) {
      this.timestamps.shift();
    }
  }

  get currentCount(): number {
    this.prune();
    return this.timestamps.length;
  }

  get remaining(): number {
    this.prune();
    return Math.max(0, this.maxRequests - this.timestamps.length);
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public waitMs: number,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}
