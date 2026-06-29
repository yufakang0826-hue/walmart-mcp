import { z } from 'zod';

// ---------- Shared Ad atoms ----------
const StatusSchema = z.enum(['enabled', 'paused', 'completed', 'archived']);
const CampaignTypeSchema = z.enum(['sponsoredProducts', 'sba', 'video']);
const TargetingTypeSchema = z.enum(['auto', 'manual']);
const BudgetTypeSchema = z.enum(['daily', 'total']);
const MatchTypeSchema = z.enum(['exact', 'phrase', 'broad']);
const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

// Walmart Connect uses arrays at the top level for batch ops.
const CampaignCreateEntry = z
  .object({
    name: z.string().min(1).max(200),
    campaignType: CampaignTypeSchema,
    targetingType: TargetingTypeSchema,
    budgetType: BudgetTypeSchema.default('daily'),
    dailyBudget: z.number().positive(),
    totalBudget: z.number().positive().optional(),
    startDate: DateOnlySchema,
    endDate: DateOnlySchema.optional(),
    status: StatusSchema.default('enabled'),
  })
  .passthrough()
  .refine((c) => !c.endDate || c.endDate >= c.startDate, {
    message: 'endDate must be >= startDate',
    path: ['endDate'],
  });

const CampaignUpdateEntry = z
  .object({
    campaignId: z.number().int().positive(),
    name: z.string().min(1).max(200).optional(),
    status: StatusSchema.optional(),
    dailyBudget: z.number().positive().optional(),
    totalBudget: z.number().positive().optional(),
    endDate: DateOnlySchema.optional(),
  })
  .passthrough();

const AdGroupCreateEntry = z
  .object({
    campaignId: z.number().int().positive(),
    name: z.string().min(1).max(200),
    status: StatusSchema.default('enabled'),
    defaultBid: z.number().positive(),
  })
  .passthrough();

const AdGroupUpdateEntry = z
  .object({
    adGroupId: z.number().int().positive(),
    name: z.string().min(1).max(200).optional(),
    status: StatusSchema.optional(),
    defaultBid: z.number().positive().optional(),
  })
  .passthrough();

const AdItemAddEntry = z
  .object({
    campaignId: z.number().int().positive(),
    adGroupId: z.number().int().positive(),
    itemId: z.string().min(1),
    bid: z.number().positive(),
    status: StatusSchema.default('enabled'),
  })
  .passthrough();

const AdItemUpdateEntry = z
  .object({
    adItemId: z.number().int().positive(),
    bid: z.number().positive().optional(),
    status: StatusSchema.optional(),
  })
  .passthrough();

const KeywordAddEntry = z
  .object({
    campaignId: z.number().int().positive(),
    adGroupId: z.number().int().positive(),
    keywordText: z.string().min(1).max(80),
    matchType: MatchTypeSchema,
    bid: z.number().positive(),
    state: StatusSchema.default('enabled'),
  })
  .passthrough();

const KeywordUpdateEntry = z
  .object({
    keywordId: z.number().int().positive(),
    bid: z.number().positive().optional(),
    state: StatusSchema.optional(),
  })
  .passthrough();

const PlacementBidEntry = z
  .object({
    campaignId: z.number().int().positive(),
    placement: z.string().min(1),
    bidMultiplier: z.number().positive(),
  })
  .passthrough();

const PlatformBidEntry = z
  .object({
    campaignId: z.number().int().positive(),
    platform: z.enum(['desktop', 'mobile', 'app']),
    bidMultiplier: z.number().positive(),
  })
  .passthrough();

const ReportSnapshotCreateSchema = z
  .object({
    reportType: z.enum([
      'campaign',
      'adGroup',
      'keyword',
      'item',
      'pageType',
      'platform',
      'placement',
    ]),
    reportDate: DateOnlySchema,
    format: z.enum(['JSON', 'CSV']).default('JSON'),
  })
  .passthrough();

export const advertisingTools = [
  // ===== Campaigns =====
  {
    name: 'walmart_ad_get_campaigns',
    description: 'List Walmart Connect advertising campaigns. Supports Sponsored Products (auto/keyword), Sponsored Brands, and Sponsored Videos.',
    inputSchema: {
      campaignId: z.number().int().optional().describe('Filter by campaign ID'),
      status: StatusSchema.optional().describe('Filter by status'),
      name: z.string().optional().describe('Filter by campaign name'),
    },
  },
  {
    name: 'walmart_ad_create_campaign',
    description:
      'Create new advertising campaign(s). Body is an ARRAY of campaign objects (Walmart Connect ' +
      'batch API). Each: { name, campaignType, targetingType, budgetType, dailyBudget, startDate ' +
      '(YYYY-MM-DD), endDate?, status }. Default budgetType=daily, status=enabled.',
    inputSchema: {
      campaignData: z.array(CampaignCreateEntry).min(1, 'Need at least 1 campaign'),
    },
  },
  {
    name: 'walmart_ad_update_campaign',
    description:
      'Update existing campaigns. Body is ARRAY; each entry needs campaignId; updatable: name, ' +
      'status, dailyBudget, totalBudget, endDate.',
    inputSchema: {
      campaignData: z.array(CampaignUpdateEntry).min(1),
    },
  },
  {
    name: 'walmart_ad_delete_campaign',
    description: 'Archive/delete a campaign by ID. Cannot be undone.',
    inputSchema: {
      campaignId: z.number().int().positive().describe('Campaign ID to delete'),
    },
  },

  // ===== Ad Groups =====
  {
    name: 'walmart_ad_get_ad_groups',
    description: 'List ad groups, optionally filtered by campaign.',
    inputSchema: {
      campaignId: z.number().int().optional().describe('Filter by campaign ID'),
      adGroupId: z.number().int().optional().describe('Filter by ad group ID'),
      status: StatusSchema.optional(),
    },
  },
  {
    name: 'walmart_ad_create_ad_groups',
    description:
      'Create ad groups. Body is ARRAY; each entry needs campaignId, name, defaultBid. Status ' +
      'defaults to enabled.',
    inputSchema: {
      groupData: z.array(AdGroupCreateEntry).min(1),
    },
  },
  {
    name: 'walmart_ad_update_ad_groups',
    description: 'Update ad groups. Body is ARRAY; each needs adGroupId; updatable: name, status, defaultBid.',
    inputSchema: {
      groupData: z.array(AdGroupUpdateEntry).min(1),
    },
  },

  // ===== Ad Items =====
  {
    name: 'walmart_ad_get_ad_items',
    description: 'List ad items (SKUs in ad groups).',
    inputSchema: {
      campaignId: z.number().int().optional(),
      adGroupId: z.number().int().optional(),
    },
  },
  {
    name: 'walmart_ad_add_ad_items',
    description:
      'Add SKUs to an ad group. Body is ARRAY; each entry needs campaignId, adGroupId, itemId, bid.',
    inputSchema: {
      itemData: z.array(AdItemAddEntry).min(1),
    },
  },
  {
    name: 'walmart_ad_update_ad_items',
    description: 'Update ad items. Body is ARRAY; each needs adItemId; updatable: bid, status.',
    inputSchema: {
      itemData: z.array(AdItemUpdateEntry).min(1),
    },
  },

  // ===== Keywords =====
  {
    name: 'walmart_ad_get_keywords',
    description: 'List keywords in an ad group.',
    inputSchema: {
      campaignId: z.number().int().optional(),
      adGroupId: z.number().int().optional(),
      state: StatusSchema.optional(),
    },
  },
  {
    name: 'walmart_ad_add_keywords',
    description:
      'Add keywords to an ad group. Body is ARRAY; each entry needs campaignId, adGroupId, ' +
      'keywordText, matchType (exact|phrase|broad), bid.',
    inputSchema: {
      keywordData: z.array(KeywordAddEntry).min(1),
    },
  },
  {
    name: 'walmart_ad_update_keywords',
    description: 'Update keywords. Body is ARRAY; each needs keywordId; updatable: bid, state.',
    inputSchema: {
      keywordData: z.array(KeywordUpdateEntry).min(1),
    },
  },
  {
    name: 'walmart_ad_get_keyword_analytics',
    description: 'Get keyword performance analytics (impressions, clicks, conversions).',
    inputSchema: {
      campaignId: z.number().int().optional(),
      adGroupId: z.number().int().optional(),
      keywordId: z.number().int().optional(),
      startDate: DateOnlySchema.optional(),
      endDate: DateOnlySchema.optional(),
    },
  },

  // ===== Placement / Platform Bids =====
  {
    name: 'walmart_ad_create_placement_bids',
    description:
      'Set placement-specific bid multipliers. Body is ARRAY; each entry needs campaignId, ' +
      'placement, bidMultiplier (e.g. 1.25 for +25%).',
    inputSchema: {
      bidData: z.array(PlacementBidEntry).min(1),
    },
  },
  {
    name: 'walmart_ad_get_placement_bids',
    description: 'Get current placement bids for a campaign.',
    inputSchema: {
      campaignId: z.number().int().describe('Campaign ID'),
    },
  },
  {
    name: 'walmart_ad_create_platform_bids',
    description:
      'Set platform-specific (desktop/mobile/app) bid multipliers. Body is ARRAY; each entry ' +
      'needs campaignId, platform, bidMultiplier.',
    inputSchema: {
      bidData: z.array(PlatformBidEntry).min(1),
    },
  },

  // ===== Reports / Insights =====
  {
    name: 'walmart_ad_create_report_snapshot',
    description:
      'Request a Walmart Connect report snapshot. reportType: campaign|adGroup|keyword|item|' +
      'pageType|platform|placement. reportDate is YYYY-MM-DD.',
    inputSchema: {
      reportData: ReportSnapshotCreateSchema,
    },
  },
  {
    name: 'walmart_ad_get_report_snapshots',
    description: 'List previously requested report snapshots.',
    inputSchema: {
      reportType: z.string().optional(),
    },
  },
  {
    name: 'walmart_ad_get_realtime_stats',
    description: 'Get realtime campaign stats (latency ~1-5 min, partial data).',
    inputSchema: {
      campaignId: z.number().int().optional(),
    },
  },
  {
    name: 'walmart_ad_get_latest_report_date',
    description: 'Get the latest available data date for analytic reports.',
    inputSchema: {},
  },
  {
    name: 'walmart_ad_get_item_recommendations',
    description: 'Get item recommendations to add to a campaign based on performance.',
    inputSchema: {
      campaignId: z.number().int().describe('Campaign ID'),
    },
  },
  {
    name: 'walmart_ad_get_keyword_recommendations',
    description: 'Get keyword suggestions for an ad group based on indexed items.',
    inputSchema: {
      adGroupId: z.number().int().describe('Ad group ID'),
      campaignId: z.number().int().optional(),
    },
  },
  {
    name: 'walmart_ad_get_search_trends',
    description: 'Get top search trends on Walmart.com to inform keyword strategy.',
    inputSchema: {
      category: z.string().optional(),
    },
  },
  {
    name: 'walmart_ad_get_sba_profile',
    description: 'Get Sponsored Brands (SBA) advertiser profile. Shows eligibility, brand info, and account status.',
    inputSchema: {},
  },
];
