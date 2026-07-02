import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('FeedsApi', () => {
  let client: any;
  let api: any;

  beforeEach(async () => {
    vi.useFakeTimers();
    client = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ feedId: 'F1' }),
    } as any;
    const { FeedsApi } = await import('../../src/api/feeds/feeds-api.js');
    api = new FeedsApi(client);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('getAllFeedStatuses should GET /v3/feeds with params', async () => {
    client.get.mockResolvedValue({ feeds: [] });
    await api.getAllFeedStatuses({ limit: 10, feedType: 'item' });
    expect(client.get).toHaveBeenCalledWith('/v3/feeds', { limit: 10, feedType: 'item' });
  });

  it('getFeedStatus should GET /v3/feeds/{feedId}', async () => {
    client.get.mockResolvedValue({ status: 'PROCESSED' });
    await api.getFeedStatus('FEED-1');
    expect(client.get).toHaveBeenCalledWith('/v3/feeds/FEED-1', undefined);
  });

  it('getFeedStatus should throw on empty feedId', async () => {
    await expect(api.getFeedStatus('')).rejects.toThrow('feedId is required');
  });

  it('submitFeed should POST with feedType query param', async () => {
    await api.submitFeed('inventory', { items: [] });
    expect(client.post).toHaveBeenCalledWith(
      '/v3/feeds?feedType=inventory',
      { items: [] },
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
    );
  });

  describe('pollFeedUntilComplete', () => {
    it('should return when feed is PROCESSED after first poll', async () => {
      client.get.mockResolvedValue({ feedStatus: 'PROCESSED', feedId: 'F1' });

      const promise = api.pollFeedUntilComplete('F1', 60000);
      // Advance past the initial delay (15s)
      await vi.advanceTimersByTimeAsync(15_000);

      const result = await promise;
      expect(result.feedStatus).toBe('PROCESSED');
      expect(client.get).toHaveBeenCalledTimes(1);
    });

    it('should return when feed is ERROR after first poll', async () => {
      client.get.mockResolvedValue({ feedStatus: 'ERROR', feedId: 'F1' });

      const promise = api.pollFeedUntilComplete('F1', 60000);
      await vi.advanceTimersByTimeAsync(15_000);

      const result = await promise;
      expect(result.feedStatus).toBe('ERROR');
    });

    it('should poll multiple times until complete', async () => {
      client.get
        .mockResolvedValueOnce({ feedStatus: 'INPROGRESS' })
        .mockResolvedValueOnce({ feedStatus: 'INPROGRESS' })
        .mockResolvedValueOnce({ feedStatus: 'PROCESSED' });

      const promise = api.pollFeedUntilComplete('F1', 600_000);

      // First poll at 15s
      await vi.advanceTimersByTimeAsync(15_000);
      // Second poll at +30s
      await vi.advanceTimersByTimeAsync(30_000);
      // Third poll at +60s
      await vi.advanceTimersByTimeAsync(60_000);

      const result = await promise;
      expect(result.feedStatus).toBe('PROCESSED');
      expect(client.get).toHaveBeenCalledTimes(3);
    });

    it('should return partial status with pollTimedOut on budget exhaustion', async () => {
      client.get.mockResolvedValue({ feedStatus: 'INPROGRESS' });

      const promise = api.pollFeedUntilComplete('F1', 10_000);
      await vi.advanceTimersByTimeAsync(15_000);
      const result = await promise as {
        pollTimedOut?: boolean; feedStatus?: string; hint?: string;
      };

      // Budget exhaustion RETURNS the latest status instead of throwing, so
      // MCP callers can re-invoke the tool to keep waiting.
      expect(result.pollTimedOut).toBe(true);
      expect(result.feedStatus).toBe('INPROGRESS');
      expect(result.hint).toMatch(/still processing/i);
    });
  });
});
