import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AxiosInstance } from 'axios';
import { WalmartApiError } from '../../src/utils/api-error.js';

// Stub auth so getAccessToken returns instantly without hitting Walmart.
vi.mock('../../src/auth/oauth.js', () => {
  class StubOAuth {
    initialize = vi.fn().mockResolvedValue(undefined);
    getAccessToken = vi.fn().mockResolvedValue('stub-bearer-token');
    refreshToken = vi.fn().mockResolvedValue(undefined);
    getTokenInfo = vi.fn().mockReturnValue({ token: 'stub' });
    getTokenDetail = vi.fn().mockResolvedValue({ ok: true });
  }
  return { WalmartOAuthClient: StubOAuth };
});

// Quiet the logger.
vi.mock('../../src/utils/logger.js', async () => {
  const noop = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), http: vi.fn(), debug: vi.fn() };
  return {
    apiLogger: noop,
    serverLogger: noop,
    authLogger: noop,
    createLogger: () => noop,
    truncateData: (d: unknown) => d,
  };
});

import { WalmartApiClient } from '../../src/api/client.js';
import type { WalmartConfig } from '../../src/config/environment.js';

function makeClient(): WalmartApiClient {
  const config: WalmartConfig = {
    clientId: 'test-id',
    clientSecret: 'test-secret',
    environment: 'sandbox',
    market: 'us',
    svcName: 'Walmart Marketplace',
    logLevel: 'error',
    enableFileLogging: false,
  };
  return new WalmartApiClient(config);
}

/**
 * Install a custom axios adapter on the client's internal http instance so we
 * control every response without touching the network. The adapter receives a
 * config and returns either a success response or rejects with an axios-like
 * error.
 */
function setAdapter(
  client: WalmartApiClient,
  adapter: (config: import('axios').InternalAxiosRequestConfig) => Promise<unknown>,
): void {
  const http = (client as unknown as { http: AxiosInstance }).http;
  http.defaults.adapter = adapter as unknown as AxiosInstance['defaults']['adapter'];
}

// =====================================================================
// 1) 404 with known-issue path → endpoint + hint + isKnownIssue
// =====================================================================
describe('client interceptor — 404 on a known-broken endpoint', () => {
  it('throws WalmartApiError with endpoint and hint populated', async () => {
    const client = makeClient();
    setAdapter(client, async (config) =>
      Promise.reject({
        isAxiosError: true,
        config,
        response: {
          status: 404,
          statusText: 'Not Found',
          data: {},
          headers: {},
        },
        message: 'Request failed with status code 404',
      }),
    );

    try {
      await client.get('/v3/returns/count');
      throw new Error('expected reject');
    } catch (err) {
      expect(err).toBeInstanceOf(WalmartApiError);
      const e = err as WalmartApiError;
      expect(e.status).toBe(404);
      expect(e.endpoint).toBe('GET /v3/returns/count');
      expect(e.hint).toBeTruthy();
      expect(e.hint!).toMatch(/walmart_get_all_returns/);
      // toResponse should mark it as known issue.
      const payload = e.toResponse();
      expect(payload.isKnownIssue).toBe(true);
    }
  });

  it('strips query string before hint lookup', async () => {
    const client = makeClient();
    setAdapter(client, async (config) =>
      Promise.reject({
        isAxiosError: true,
        config,
        response: { status: 404, statusText: 'Not Found', data: {}, headers: {} },
        message: 'failed',
      }),
    );

    try {
      await client.get('/v3/returns/count', { status: 'Approved' });
      throw new Error('expected reject');
    } catch (err) {
      const e = err as WalmartApiError;
      expect(e.hint).toBeTruthy(); // query string did not break the regex
      expect(e.endpoint).toContain('/v3/returns/count');
    }
  });
});

// =====================================================================
// 2) 4xx on a NON-known-issue path → endpoint set, hint absent
// =====================================================================
describe('client interceptor — 4xx on a healthy path', () => {
  it('attaches endpoint but no hint', async () => {
    const client = makeClient();
    setAdapter(client, async (config) =>
      Promise.reject({
        isAxiosError: true,
        config,
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: { errors: [{ code: 'INVALID_REQUEST', description: 'oops' }] },
          headers: {},
        },
        message: 'Request failed',
      }),
    );

    try {
      await client.get('/v3/items');
      throw new Error('expected reject');
    } catch (err) {
      const e = err as WalmartApiError;
      expect(e.status).toBe(400);
      expect(e.endpoint).toBe('GET /v3/items');
      expect(e.hint).toBeUndefined();
      expect(e.message).toContain('INVALID_REQUEST');
      const payload = e.toResponse();
      expect(payload.isKnownIssue).toBeUndefined();
    }
  });
});

// =====================================================================
// 3) 401 → refresh token + retry once (succeeds the second time)
// =====================================================================
describe('client interceptor — 401 triggers refresh and retry', () => {
  it('retries with a fresh token after a 401', async () => {
    const client = makeClient();
    let callCount = 0;
    setAdapter(client, async (config) => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.reject({
          isAxiosError: true,
          config,
          response: { status: 401, statusText: 'Unauthorized', data: {}, headers: {} },
        });
      }
      // Second call succeeds.
      return {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    });

    const result = await client.get<{ ok: boolean }>('/v3/items');
    expect(result.ok).toBe(true);
    expect(callCount).toBe(2);
  });

  it('does NOT retry a 401 more than once (prevents infinite loop)', async () => {
    const client = makeClient();
    let callCount = 0;
    setAdapter(client, async (config) => {
      callCount += 1;
      return Promise.reject({
        isAxiosError: true,
        config,
        response: { status: 401, statusText: 'Unauthorized', data: {}, headers: {} },
      });
    });

    await expect(client.get('/v3/items')).rejects.toBeDefined();
    expect(callCount).toBe(2); // one original attempt + one retry, then give up
  });
});

// =====================================================================
// 4) 429 → throw rate-limit error (no automatic retry inside interceptor)
// =====================================================================
describe('client interceptor — 429 rate limit', () => {
  it('throws a rate-limit error mentioning retry-after seconds', async () => {
    const client = makeClient();
    setAdapter(client, async (config) =>
      Promise.reject({
        isAxiosError: true,
        config,
        response: {
          status: 429,
          statusText: 'Too Many Requests',
          data: {},
          headers: { 'retry-after': '45' },
        },
      }),
    );

    await expect(client.get('/v3/items')).rejects.toThrow(/Rate limit/);
    await expect(client.get('/v3/items')).rejects.toThrow(/45/);
  });

  it('auto-waits and retries once when retry-after is short (<=30s)', async () => {
    vi.useFakeTimers();
    try {
      const client = makeClient();
      let calls = 0;
      setAdapter(client, async (config) => {
        calls++;
        if (calls === 1) {
          return Promise.reject({
            isAxiosError: true,
            config,
            response: {
              status: 429,
              statusText: 'Too Many Requests',
              data: {},
              headers: { 'retry-after': '2' },
            },
          });
        }
        return { status: 200, statusText: 'OK', data: { ok: true }, headers: {}, config };
      });

      const promise = client.get('/v3/items');
      await vi.advanceTimersByTimeAsync(2_000);
      const result = await promise;

      expect(calls).toBe(2);
      expect(result).toEqual({ ok: true });
    } finally {
      vi.useRealTimers();
    }
  });
});

// =====================================================================
// 5) 5xx → exponential backoff retry, max 3
// =====================================================================
describe('client interceptor — 5xx retry', () => {
  it('retries 5xx up to 3 times before giving up', async () => {
    vi.useFakeTimers();
    const client = makeClient();
    let callCount = 0;
    setAdapter(client, async (config) => {
      callCount += 1;
      return Promise.reject({
        isAxiosError: true,
        config,
        response: { status: 503, statusText: 'Service Unavailable', data: {}, headers: {} },
      });
    });

    const promise = client.get('/v3/items');
    // Attach a no-op catch so Node sees the rejection is observed; we still
    // assert via `await expect(...).rejects` below.
    promise.catch(() => {});
    // Advance through 1s, 2s, 4s backoffs.
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    await expect(promise).rejects.toBeDefined();
    expect(callCount).toBe(4); // 1 original + 3 retries
    vi.useRealTimers();
  });

  it('returns success if the retry succeeds on attempt 2', async () => {
    vi.useFakeTimers();
    const client = makeClient();
    let callCount = 0;
    setAdapter(client, async (config) => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.reject({
          isAxiosError: true,
          config,
          response: { status: 502, statusText: 'Bad Gateway', data: {}, headers: {} },
        });
      }
      return {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    });

    const promise = client.get<{ ok: boolean }>('/v3/items');
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;
    expect(result.ok).toBe(true);
    expect(callCount).toBe(2);
    vi.useRealTimers();
  });
});
