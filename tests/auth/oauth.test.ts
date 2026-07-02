import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { WalmartOAuthClient } from '../../src/auth/oauth.js';
import type { WalmartConfig } from '../../src/config/environment.js';

vi.mock('axios');
vi.mock('../../src/utils/env-file.js', () => ({
  upsertEnvVars: vi.fn(),
}));

const mockedPost = vi.mocked(axios.post);

function makeConfig(overrides: Partial<WalmartConfig> = {}): WalmartConfig {
  return {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    environment: 'production',
    market: 'us',
    svcName: 'Walmart Marketplace',
    logLevel: 'error',
    enableFileLogging: false,
    ...overrides,
  };
}

function tokenResponse(token = 'tok-1', expiresIn = 900) {
  return { data: { access_token: token, token_type: 'Bearer', expires_in: expiresIn } };
}

describe('WalmartOAuthClient', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getAccessToken', () => {
    it('fetches a token on first call and reuses the cached token while valid', async () => {
      mockedPost.mockResolvedValueOnce(tokenResponse('tok-A', 900));
      const client = new WalmartOAuthClient(makeConfig());

      const first = await client.getAccessToken();
      const second = await client.getAccessToken();

      expect(first).toBe('tok-A');
      expect(second).toBe('tok-A');
      expect(mockedPost).toHaveBeenCalledTimes(1); // cached, no second HTTP call
    });

    it('refreshes when the token is inside the 2-minute expiry margin', async () => {
      vi.useFakeTimers();
      // expires_in 150s → with the 120s safety margin the token is only
      // "fresh" for 30s.
      mockedPost
        .mockResolvedValueOnce(tokenResponse('tok-short', 150))
        .mockResolvedValueOnce(tokenResponse('tok-renewed', 900));
      const client = new WalmartOAuthClient(makeConfig());

      expect(await client.getAccessToken()).toBe('tok-short');
      await vi.advanceTimersByTimeAsync(60_000); // now inside the margin

      expect(await client.getAccessToken()).toBe('tok-renewed');
      expect(mockedPost).toHaveBeenCalledTimes(2);
    });

    it('deduplicates concurrent refreshes (single HTTP call for parallel callers)', async () => {
      let resolveToken: (v: unknown) => void;
      mockedPost.mockImplementationOnce(
        () => new Promise((resolve) => { resolveToken = resolve; }),
      );
      const client = new WalmartOAuthClient(makeConfig());

      // Prime the refresh, then pile on concurrent callers while in flight.
      const p1 = client.refreshToken();
      const p2 = client.getAccessToken();
      const p3 = client.getAccessToken();
      resolveToken!(tokenResponse('tok-conc', 900));

      await p1;
      expect(await p2).toBe('tok-conc');
      expect(await p3).toBe('tok-conc');
      expect(mockedPost).toHaveBeenCalledTimes(1);
    });
  });

  describe('_doRefresh error handling', () => {
    it('throws a setup-guide error when credentials are missing (no HTTP call)', async () => {
      const client = new WalmartOAuthClient(makeConfig({ clientId: '', clientSecret: '' }));

      await expect(client.refreshToken()).rejects.toThrow(/credentials are not configured/i);
      expect(mockedPost).not.toHaveBeenCalled();
    });

    it('wraps Walmart auth failures with the error_description', async () => {
      mockedPost.mockRejectedValueOnce({
        isAxiosError: true,
        message: 'Request failed with status code 401',
        response: { data: { error_description: 'invalid client credentials' } },
      });
      vi.mocked(axios.isAxiosError).mockReturnValueOnce(true as never);
      const client = new WalmartOAuthClient(makeConfig());

      await expect(client.refreshToken()).rejects.toThrow(/Authentication failed/);
    });

    it('recovers on the next call after a failed refresh', async () => {
      mockedPost
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValueOnce(tokenResponse('tok-after-fail', 900));
      const client = new WalmartOAuthClient(makeConfig());

      await expect(client.getAccessToken()).rejects.toThrow();
      expect(await client.getAccessToken()).toBe('tok-after-fail');
      expect(mockedPost).toHaveBeenCalledTimes(2);
    });
  });

  describe('initialize', () => {
    it('reuses a still-valid cached token from config without an HTTP call', async () => {
      const client = new WalmartOAuthClient(makeConfig({
        accessToken: 'tok-cached',
        accessTokenExpiry: Date.now() + 10 * 60_000,
      }));

      await client.initialize();

      expect(mockedPost).not.toHaveBeenCalled();
      expect(await client.getAccessToken()).toBe('tok-cached');
    });

    it('swallows initial fetch failures so the server can still boot', async () => {
      mockedPost.mockRejectedValueOnce(new Error('creds not set yet'));
      const client = new WalmartOAuthClient(makeConfig());

      await expect(client.initialize()).resolves.toBeUndefined();
    });
  });
});
