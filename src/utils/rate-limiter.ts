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

  constructor(
    private maxRequests: number,
    private windowMs: number,
    private name: string = 'default',
  ) {}

  /**
   * Check if a request can proceed. If not, returns the wait time in ms.
   * Returns 0 if the request is allowed.
   */
  check(): number {
    this.prune();
    if (this.timestamps.length < this.maxRequests) {
      return 0;
    }
    const oldest = this.timestamps[0];
    const waitMs = oldest + this.windowMs - Date.now();
    return Math.max(0, waitMs);
  }

  /**
   * Record a request. Throws if rate limit would be exceeded.
   * Call this before making the actual HTTP request.
   */
  acquire(): void {
    const waitMs = this.check();
    if (waitMs > 0) {
      apiLogger.warn(
        `[RateLimiter:${this.name}] Rate limit reached (${this.maxRequests}/${this.windowMs}ms). ` +
        `Need to wait ${waitMs}ms.`,
      );
      throw new RateLimitError(
        `Rate limit reached for ${this.name}. Try again in ${Math.ceil(waitMs / 1000)} seconds.`,
        waitMs,
      );
    }
    this.timestamps.push(Date.now());
  }

  /**
   * Async version that waits instead of throwing.
   */
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
   * Update limits based on response headers from Walmart API.
   */
  updateFromHeaders(headers: Record<string, string>): void {
    const remaining = headers['x-current-token-count'];
    if (remaining !== undefined) {
      const count = parseInt(remaining, 10);
      if (count <= 5) {
        apiLogger.warn(
          `[RateLimiter:${this.name}] Only ${count} API tokens remaining. ` +
          `Replenish at: ${headers['x-next-replenish-time'] || 'unknown'}`,
        );
      }
    }
  }

  /** Remove timestamps outside the current window */
  private prune(): void {
    const cutoff = Date.now() - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0] <= cutoff) {
      this.timestamps.shift();
    }
  }

  /** Current request count in the window */
  get currentCount(): number {
    this.prune();
    return this.timestamps.length;
  }

  /** Remaining requests before limit */
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
