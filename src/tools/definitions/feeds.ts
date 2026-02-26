import { z } from 'zod';

export const feedTools = [
  {
    name: 'walmart_get_all_feed_statuses',
    description: 'Get status of all feeds with optional filtering. Returns feedId, feedType, status, and timestamps.',
    inputSchema: {
      limit: z.number().int().min(1).max(50).optional().describe('Results per page (default 50)'),
      offset: z.number().int().min(0).optional().describe('Pagination offset'),
      feedType: z.string().optional().describe('Filter by feed type (e.g., item, inventory, price)'),
    },
  },
  {
    name: 'walmart_get_feed_status',
    description: 'Get the status of a specific feed by feedId. Returns overall feed status: RECEIVED, INPROGRESS, PROCESSED, or ERROR.',
    inputSchema: {
      feedId: z.string().describe('Feed ID returned from a feed submission'),
    },
  },
  {
    name: 'walmart_get_feed_item_status',
    description: 'Get per-item results for a feed. Shows SUCCESS, DATA_ERROR, SYSTEM_ERROR, or TIMEOUT_ERROR for each item in the feed.',
    inputSchema: {
      feedId: z.string().describe('Feed ID to get item-level details for'),
    },
  },
  {
    name: 'walmart_submit_generic_feed',
    description: 'Submit a feed of any type. Use specific feed tools (walmart_submit_item_feed, etc.) when possible. This is for custom feed types.',
    inputSchema: {
      feedType: z.string().describe('Feed type (e.g., item, MP_MAINTENANCE, inventory, price, PROMO_PRICE, LAGTIME)'),
      feedData: z.record(z.string(), z.unknown()).describe('Feed payload data'),
    },
  },
  {
    name: 'walmart_poll_feed_until_complete',
    description: 'Poll a feed status until it completes (PROCESSED or ERROR) or times out. Uses progressive polling intervals: 15s, 30s, 1m, 2m, then every 4m. Max wait: 2 hours.',
    inputSchema: {
      feedId: z.string().describe('Feed ID to poll'),
      maxWaitSeconds: z.number().int().min(30).max(7200).optional().describe('Max wait time in seconds (default 7200 = 2 hours)'),
    },
  },
];
