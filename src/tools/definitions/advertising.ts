import { z } from 'zod';

export const advertisingTools = [
  // ===== Campaigns =====
  {
    name: 'walmart_ad_get_campaigns',
    description: 'List Walmart Connect advertising campaigns. Supports Sponsored Products (auto/keyword), Sponsored Brands, and Sponsored Videos.',
    inputSchema: {
      campaignId: z.number().int().optional().describe('Filter by campaign ID'),
      status: z.string().optional().describe('Filter by status: enabled, paused, completed'),
      name: z.string().optional().describe('Filter by campaign name'),
    },
  },
  {
    name: 'walmart_ad_create_campaign',
    description: 'Create a new advertising campaign. Types: sponsoredProducts (auto/manual), sba (Sponsored Brands), video.',
    inputSchema: {
      campaignData: z.record(z.string(), z.unknown()).describe('Campaign config including name, campaignType, targetingType, budgetType, dailyBudget, startDate'),
    },
  },
  {
    name: 'walmart_ad_update_campaign',
    description: 'Update an existing advertising campaign (name, budget, status, dates).',
    inputSchema: {
      campaignData: z.record(z.string(), z.unknown()).describe('Updated campaign data including campaignId'),
    },
  },
  {
    name: 'walmart_ad_delete_campaign',
    description: 'Delete a pre-launch campaign (not yet started). Running campaigns should be paused instead.',
    inputSchema: {
      deleteData: z.record(z.string(), z.unknown()).describe('Deletion data including campaignId'),
    },
  },

  // ===== Ad Groups =====
  {
    name: 'walmart_ad_get_ad_groups',
    description: 'List ad groups within a campaign. Ad groups organize items and keywords with shared bids.',
    inputSchema: {
      campaignId: z.number().int().optional().describe('Filter by campaign ID'),
      adGroupId: z.number().int().optional().describe('Filter by ad group ID'),
    },
  },
  {
    name: 'walmart_ad_create_ad_groups',
    description: 'Create ad groups in a campaign. Each group can have its own default bid and targeting.',
    inputSchema: {
      adGroupData: z.record(z.string(), z.unknown()).describe('Ad group config including campaignId, name, and defaultBid'),
    },
  },
  {
    name: 'walmart_ad_update_ad_groups',
    description: 'Update ad group settings (name, bid, status).',
    inputSchema: {
      adGroupData: z.record(z.string(), z.unknown()).describe('Updated ad group data including adGroupId'),
    },
  },

  // ===== Ad Items =====
  {
    name: 'walmart_ad_get_ad_items',
    description: 'List advertised items. Shows which products are being promoted in each ad group.',
    inputSchema: {
      campaignId: z.number().int().optional().describe('Filter by campaign ID'),
      adGroupId: z.number().int().optional().describe('Filter by ad group ID'),
      status: z.string().optional().describe('Filter by item status'),
    },
  },
  {
    name: 'walmart_ad_add_ad_items',
    description: 'Add items to an ad group for advertising. Items must be published on Walmart.',
    inputSchema: {
      itemData: z.record(z.string(), z.unknown()).describe('Items to add including campaignId, adGroupId, and item IDs/SKUs'),
    },
  },
  {
    name: 'walmart_ad_update_ad_items',
    description: 'Update ad item settings (bid, status).',
    inputSchema: {
      itemData: z.record(z.string(), z.unknown()).describe('Updated item data including adItemId'),
    },
  },

  // ===== Keywords =====
  {
    name: 'walmart_ad_get_keywords',
    description: 'List keywords for manual keyword campaigns. Shows match type, bid, and status.',
    inputSchema: {
      campaignId: z.number().int().optional().describe('Filter by campaign ID'),
      adGroupId: z.number().int().optional().describe('Filter by ad group ID'),
      keywordId: z.number().int().optional().describe('Filter by keyword ID'),
    },
  },
  {
    name: 'walmart_ad_add_keywords',
    description: 'Add targeting keywords to a manual campaign ad group. Match types: exact, phrase, broad.',
    inputSchema: {
      keywordData: z.record(z.string(), z.unknown()).describe('Keywords to add including campaignId, adGroupId, keywords with matchType and bid'),
    },
  },
  {
    name: 'walmart_ad_update_keywords',
    description: 'Update keyword bids, match types, or status.',
    inputSchema: {
      keywordData: z.record(z.string(), z.unknown()).describe('Updated keyword data including keywordId'),
    },
  },
  {
    name: 'walmart_ad_get_keyword_analytics',
    description: 'Get keyword performance analytics: impressions, clicks, spend, sales, ACOS, ROAS.',
    inputSchema: {
      analyticsData: z.record(z.string(), z.unknown()).describe('Analytics query with date range, campaignId, and optional filters'),
    },
  },

  // ===== Bid Multipliers =====
  {
    name: 'walmart_ad_create_placement_bids',
    description: 'Set placement bid multipliers. Adjust bids for Buy Box, Search In-grid, and other placements.',
    inputSchema: {
      bidData: z.record(z.string(), z.unknown()).describe('Placement bid config including campaignId and placement multipliers'),
    },
  },
  {
    name: 'walmart_ad_get_placement_bids',
    description: 'Get current placement bid multipliers for a campaign.',
    inputSchema: {
      campaignId: z.number().int().optional().describe('Campaign ID'),
    },
  },
  {
    name: 'walmart_ad_create_platform_bids',
    description: 'Set platform bid multipliers for desktop vs mobile targeting.',
    inputSchema: {
      bidData: z.record(z.string(), z.unknown()).describe('Platform bid config including campaignId and platform multipliers'),
    },
  },

  // ===== Reports & Stats =====
  {
    name: 'walmart_ad_create_report_snapshot',
    description: 'Request an advertising performance report. Types: campaign, adGroup, adItem, keyword. Reports are async.',
    inputSchema: {
      reportData: z.record(z.string(), z.unknown()).describe('Report request including reportType, dateRange, and metrics'),
    },
  },
  {
    name: 'walmart_ad_get_report_snapshots',
    description: 'Get status and download URL for advertising report snapshots.',
    inputSchema: {
      snapshotId: z.string().optional().describe('Specific snapshot ID'),
      reportType: z.string().optional().describe('Filter by report type'),
    },
  },
  {
    name: 'walmart_ad_get_realtime_stats',
    description: 'Get near-real-time advertising statistics. Data is delayed by ~3 hours.',
    inputSchema: {
      statsData: z.record(z.string(), z.unknown()).describe('Stats query with date range, campaignIds, and metric selections'),
    },
  },
  {
    name: 'walmart_ad_get_latest_report_date',
    description: 'Get the latest available date for advertising reports. Use this to determine date range for report requests.',
    inputSchema: {},
  },

  // ===== Recommendations & Insights =====
  {
    name: 'walmart_ad_get_item_recommendations',
    description: 'Get item recommendations for advertising. Suggests which items would benefit most from advertising.',
    inputSchema: {
      recommendationData: z.record(z.string(), z.unknown()).describe('Recommendation query parameters'),
    },
  },
  {
    name: 'walmart_ad_get_keyword_recommendations',
    description: 'Get keyword suggestions for a campaign based on item catalog and category.',
    inputSchema: {
      recommendationData: z.record(z.string(), z.unknown()).describe('Keyword recommendation query including items or category'),
    },
  },
  {
    name: 'walmart_ad_get_search_trends',
    description: 'Get top search trends on Walmart.com. Discover trending keywords for campaign targeting.',
    inputSchema: {
      trendData: z.record(z.string(), z.unknown()).describe('Search trend query including category and date range'),
    },
  },

  // ===== Sponsored Brands =====
  {
    name: 'walmart_ad_get_sba_profile',
    description: 'Get Sponsored Brands (SBA) advertiser profile. Shows eligibility, brand info, and account status.',
    inputSchema: {},
  },
];
