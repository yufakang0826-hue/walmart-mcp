import { WalmartApiClient } from '../client.js';
import { feedLogger } from '../../utils/logger.js';

/**
 * Attach an actionable `ingestionHint` when Walmart returns one of its
 * cryptic feed-envelope errors. Both were reverse-engineered against
 * production (2026-07-02); Walmart's own descriptions are misleading
 * ("glitch on our end, try again" for what is actually a permanent
 * payload-format error).
 */
function annotateFeedErrors<T>(result: T): T {
  const feed = result as {
    ingestionErrors?: { ingestionError?: Array<{ code?: string; field?: string }> };
    ingestionHint?: string;
  };
  const errors = feed?.ingestionErrors?.ingestionError;
  if (!Array.isArray(errors)) return result;

  for (const err of errors) {
    if (err.code === 'ERR_INT_SYS_0801003' || err.field === 'WM_SPEC_MODE') {
      feed.ingestionHint =
        'WM_SPEC_MODE means the spec version could not be resolved — NOT a transient glitch. ' +
        'MPItemFeedHeader.version must be the FULL dated spec string (e.g. ' +
        '"5.0.20260501-19_21_29-api"), not "5.0". Resubmit with the full version.';
      break;
    }
    if (err.code === 'ERR_INT_DATA_01010092' || err.field === 'PGW') {
      feed.ingestionHint =
        'PGW NullPointerException is triggered by forbidden MPItemFeedHeader fields — NOT by ' +
        'malformed JSON. For spec 5.0 item feeds the header may ONLY contain ' +
        '{ businessUnit, locale, version }. Remove sellingChannel/processMode/subset/requestId ' +
        'and resubmit.';
      break;
    }
  }
  return result;
}

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
    const result = await this.client.get(
      `${this.basePath}/${encodeURIComponent(feedId)}`,
      params,
    );
    return annotateFeedErrors(result);
  }

  async getFeedItemStatus(feedId: string) {
    if (!feedId) throw new Error('feedId is required');
    const result = await this.client.get(`${this.basePath}/${encodeURIComponent(feedId)}`, {
      includeDetails: 'true',
    });
    return annotateFeedErrors(result);
  }

  async submitFeed(feedType: string, data: object) {
    if (!feedType) throw new Error('feedType is required');
    return await this.client.post(
      `${this.basePath}?feedType=${encodeURIComponent(feedType)}`,
      data,
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  /**
   * Poll a feed until it completes or the time budget runs out.
   *
   * IMPORTANT: MCP clients kill long-running tool calls (~60s observed), so
   * the default budget is 45s per invocation. On budget exhaustion this
   * RETURNS the latest status with `pollTimedOut: true` instead of throwing —
   * the caller should simply invoke the tool again with the same feedId.
   * Content feeds (MP_ITEM / MP_MAINTENANCE) routinely take minutes to hours.
   */
  async pollFeedUntilComplete(
    feedId: string,
    maxWaitMs = 45_000,
    initialDelayMs = 3_000,
  ): Promise<unknown> {
    if (!feedId) throw new Error('feedId is required');

    const intervals = [5_000, 10_000, 15_000, 20_000, 30_000];
    const startTime = Date.now();
    let attempt = 0;
    let last: { feedStatus?: string; [key: string]: unknown } | undefined;

    feedLogger.info(`Polling feed ${feedId} until complete (budget ${maxWaitMs / 1000}s)`);

    while (Date.now() - startTime < maxWaitMs) {
      const delay = attempt === 0
        ? initialDelayMs
        : (intervals[Math.min(attempt - 1, intervals.length - 1)] ?? 30_000);
      const remaining = maxWaitMs - (Date.now() - startTime);
      // Don't start a sleep we can't finish — return partial status instead.
      if (attempt > 0 && delay >= remaining) break;
      await new Promise((r) => setTimeout(r, Math.min(delay, remaining)));

      last = await this.getFeedStatus(feedId, true) as {
        feedStatus?: string;
        [key: string]: unknown;
      };

      feedLogger.info(`Feed ${feedId} status: ${last.feedStatus} (attempt ${attempt + 1})`);

      if (last.feedStatus === 'PROCESSED' || last.feedStatus === 'ERROR') {
        return last;
      }

      attempt++;
    }

    return {
      ...(last ?? { feedId }),
      pollTimedOut: true,
      hint:
        `Feed ${feedId} is still processing after ${Math.round((Date.now() - startTime) / 1000)}s. ` +
        'This is normal for item/content feeds (minutes to hours). Call ' +
        'walmart_poll_feed_until_complete again with the same feedId to keep waiting.',
    };
  }
}
