import { WalmartApiClient } from '../client.js';
import { feedLogger } from '../../utils/logger.js';

export class FeedsApi {
  private basePath = '/v3/feeds';

  constructor(private client: WalmartApiClient) {}

  async getAllFeedStatuses(params?: {
    limit?: number;
    offset?: number;
    feedType?: string;
  }) {
    return await this.client.get(this.basePath, params);
  }

  async getFeedStatus(feedId: string, includeDetails = false) {
    if (!feedId) throw new Error('feedId is required');
    const params = includeDetails ? { includeDetails: 'true' } : undefined;
    return await this.client.get(`${this.basePath}/${encodeURIComponent(feedId)}`, params);
  }

  async getFeedItemStatus(feedId: string) {
    if (!feedId) throw new Error('feedId is required');
    return await this.client.get(`${this.basePath}/${encodeURIComponent(feedId)}`, {
      includeDetails: 'true',
    });
  }

  async submitFeed(feedType: string, data: object) {
    if (!feedType) throw new Error('feedType is required');
    return await this.client.post(
      `${this.basePath}?feedType=${encodeURIComponent(feedType)}`,
      data,
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  async pollFeedUntilComplete(
    feedId: string,
    maxWaitMs = 7_200_000,
    initialDelayMs = 15_000,
  ): Promise<unknown> {
    if (!feedId) throw new Error('feedId is required');

    const intervals = [15_000, 30_000, 60_000, 120_000, 240_000];
    const startTime = Date.now();
    let attempt = 0;

    feedLogger.info(`Polling feed ${feedId} until complete (max ${maxWaitMs / 1000}s)`);

    while (Date.now() - startTime < maxWaitMs) {
      const delay = attempt < intervals.length ? intervals[attempt] : 240_000;
      if (attempt === 0 && initialDelayMs > 0) {
        await new Promise((r) => setTimeout(r, initialDelayMs));
      } else {
        await new Promise((r) => setTimeout(r, delay));
      }

      const result = await this.getFeedStatus(feedId, true) as {
        feedStatus?: string;
        [key: string]: unknown;
      };

      feedLogger.info(`Feed ${feedId} status: ${result.feedStatus} (attempt ${attempt + 1})`);

      if (result.feedStatus === 'PROCESSED' || result.feedStatus === 'ERROR') {
        return result;
      }

      attempt++;
    }

    throw new Error(`Feed ${feedId} did not complete within ${maxWaitMs / 1000} seconds`);
  }
}
