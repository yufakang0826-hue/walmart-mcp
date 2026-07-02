import { describe, it, expect, vi } from 'vitest';
import { executeTool } from '../../src/tools/index.js';

// Create a mock WalmartSellerApi
function createMockApi() {
  return {
    auth: {
      refreshToken: vi.fn().mockResolvedValue(undefined),
      getTokenInfo: vi.fn().mockReturnValue({ token: 'test', expiresAt: Date.now() + 900000 }),
      getTokenDetail: vi.fn().mockResolvedValue({ valid: true }),
    },
    items: {
      getAllItems: vi.fn().mockResolvedValue({ items: [] }),
      getItem: vi.fn().mockResolvedValue({ sku: 'TEST' }),
      retireItem: vi.fn().mockResolvedValue({ success: true }),
      bulkRetireItems: vi.fn().mockResolvedValue({ success: true }),
      getItemCount: vi.fn().mockResolvedValue({ count: 42 }),
      getTaxonomy: vi.fn().mockResolvedValue({ categories: [] }),
      getItemSpec: vi.fn().mockResolvedValue({ spec: {} }),
      submitItemFeed: vi.fn().mockResolvedValue({ feedId: 'f1' }),
      submitItemUpdateFeed: vi.fn().mockResolvedValue({ feedId: 'f2' }),
      submitWfsItemFeed: vi.fn().mockResolvedValue({ feedId: 'f3' }),
      convertToWfs: vi.fn().mockResolvedValue({ feedId: 'f4' }),
      getHazmatItems: vi.fn().mockResolvedValue({ items: [] }),
    },
    inventory: {
      getInventory: vi.fn().mockResolvedValue({ sku: 'TEST', quantity: 10 }),
      updateInventory: vi.fn().mockResolvedValue({ success: true }),
      getInventoryAllNodes: vi.fn().mockResolvedValue({ nodes: [] }),
      updateInventoryMultiNode: vi.fn().mockResolvedValue({ success: true }),
      getAllInventory: vi.fn().mockResolvedValue({ inventory: [] }),
      submitInventoryFeed: vi.fn().mockResolvedValue({ feedId: 'f5' }),
      submitMultiNodeInventoryFeed: vi.fn().mockResolvedValue({ feedId: 'f6' }),
      getLagTime: vi.fn().mockResolvedValue({ lagTime: 2 }),
      updateLagTime: vi.fn().mockResolvedValue({ success: true }),
      submitLagTimeFeed: vi.fn().mockResolvedValue({ feedId: 'f7' }),
    },
    orders: {
      getAllOrders: vi.fn().mockResolvedValue({ orders: [] }),
      getReleasedOrders: vi.fn().mockResolvedValue({ orders: [] }),
      getOrder: vi.fn().mockResolvedValue({ orderId: 'PO1' }),
      acknowledgeOrder: vi.fn().mockResolvedValue({ success: true }),
      shipOrder: vi.fn().mockResolvedValue({ success: true }),
      cancelOrder: vi.fn().mockResolvedValue({ success: true }),
      refundOrder: vi.fn().mockResolvedValue({ success: true }),
      getShippingCarriers: vi.fn().mockResolvedValue({ carriers: [] }),
      createShippingLabel: vi.fn().mockResolvedValue({ labelId: 'L1' }),
      getShippingEstimate: vi.fn().mockResolvedValue({ estimate: {} }),
    },
    pricing: {
      updatePrice: vi.fn().mockResolvedValue({ success: true }),
      submitPriceFeed: vi.fn().mockResolvedValue({ feedId: 'f8' }),
      submitMpPriceFeed: vi.fn().mockResolvedValue({ feedId: 'f9' }),
      submitPromoPriceFeed: vi.fn().mockResolvedValue({ feedId: 'f10' }),
      getRepricerStrategies: vi.fn().mockResolvedValue({ strategies: [] }),
      createRepricerStrategy: vi.fn().mockResolvedValue({ strategyId: 's1' }),
      updateRepricerStrategy: vi.fn().mockResolvedValue({ success: true }),
      deleteRepricerStrategy: vi.fn().mockResolvedValue({ success: true }),
      assignItemsToStrategy: vi.fn().mockResolvedValue({ success: true }),
      unassignItemsFromStrategy: vi.fn().mockResolvedValue({ success: true }),
    },
    feeds: {
      getAllFeedStatuses: vi.fn().mockResolvedValue({ feeds: [] }),
      getFeedStatus: vi.fn().mockResolvedValue({ status: 'PROCESSED' }),
      getFeedItemStatus: vi.fn().mockResolvedValue({ items: [] }),
      submitFeed: vi.fn().mockResolvedValue({ feedId: 'f11' }),
      pollFeedUntilComplete: vi.fn().mockResolvedValue({ status: 'PROCESSED' }),
    },
    fulfillment: {
      createInboundOrder: vi.fn().mockResolvedValue({ orderId: 'IN1' }),
      getInboundShipments: vi.fn().mockResolvedValue({ shipments: [] }),
      getInboundErrors: vi.fn().mockResolvedValue({ errors: [] }),
      getShipmentItems: vi.fn().mockResolvedValue({ items: [] }),
      getShipmentQuantities: vi.fn().mockResolvedValue({ quantities: {} }),
      getShipmentLabel: vi.fn().mockResolvedValue({ label: 'base64...' }),
      updateShipmentTracking: vi.fn().mockResolvedValue({ success: true }),
      cancelInboundOrder: vi.fn().mockResolvedValue({ success: true }),
      getShippingLabel: vi.fn().mockResolvedValue({ label: {} }),
      getLabelByTracking: vi.fn().mockResolvedValue({ label: {} }),
      discardLabel: vi.fn().mockResolvedValue({ success: true }),
      getPackageTypes: vi.fn().mockResolvedValue({ types: [] }),
      createMcsOrder: vi.fn().mockResolvedValue({ orderId: 'MCS1' }),
      cancelMcsOrder: vi.fn().mockResolvedValue({ success: true }),
      getMcsOrderStatus: vi.fn().mockResolvedValue({ status: 'SHIPPED' }),
      getCarrierRateQuotes: vi.fn().mockResolvedValue({ quotes: [] }),
      bookCarrierShipment: vi.fn().mockResolvedValue({ bookingId: 'B1' }),
      getCarrierLabel: vi.fn().mockResolvedValue({ label: {} }),
      scheduleCarrierPickup: vi.fn().mockResolvedValue({ pickupId: 'P1' }),
    },
    returns: {
      getAllReturns: vi.fn().mockResolvedValue({ returns: [] }),
      getReturn: vi.fn().mockResolvedValue({ returnOrderId: 'R1' }),
      approveReturn: vi.fn().mockResolvedValue({ success: true }),
      rejectReturn: vi.fn().mockResolvedValue({ success: true }),
      issueReturnRefund: vi.fn().mockResolvedValue({ success: true }),
      generateReturnLabel: vi.fn().mockResolvedValue({ label: {} }),
      getWfsReturns: vi.fn().mockResolvedValue({ returns: [] }),
      getReturnCount: vi.fn().mockResolvedValue({ count: 5 }),
    },
    reports: {
      createReport: vi.fn().mockResolvedValue({ requestId: 'RQ1' }),
      getReportRequests: vi.fn().mockResolvedValue({ requests: [] }),
      getReportStatus: vi.fn().mockResolvedValue({ status: 'READY' }),
      downloadReport: vi.fn().mockResolvedValue({ data: '...' }),
      createReportSchedule: vi.fn().mockResolvedValue({ scheduleId: 'S1' }),
      getReportSchedules: vi.fn().mockResolvedValue({ schedules: [] }),
      updateReportSchedule: vi.fn().mockResolvedValue({ success: true }),
      deleteReportSchedule: vi.fn().mockResolvedValue({ success: true }),
      getUnpublishedItems: vi.fn().mockResolvedValue({ items: [] }),
      getListingQuality: vi.fn().mockResolvedValue({ score: 85 }),
      getQualityCategories: vi.fn().mockResolvedValue({ categories: [] }),
      getItemQualityDetails: vi.fn().mockResolvedValue({ items: [] }),
    },
    notifications: {
      createSubscription: vi.fn().mockResolvedValue({ subscriptionId: 'SUB1' }),
      getSubscriptions: vi.fn().mockResolvedValue({ subscriptions: [] }),
      getSubscription: vi.fn().mockResolvedValue({ subscriptionId: 'SUB1' }),
      updateSubscription: vi.fn().mockResolvedValue({ success: true }),
      deleteSubscription: vi.fn().mockResolvedValue({ success: true }),
      testSubscription: vi.fn().mockResolvedValue({ success: true }),
    },
    advertising: {
      getCampaigns: vi.fn().mockResolvedValue({ campaigns: [] }),
      createCampaign: vi.fn().mockResolvedValue({ campaignId: 1 }),
      updateCampaign: vi.fn().mockResolvedValue({ success: true }),
      deleteCampaign: vi.fn().mockResolvedValue({ success: true }),
      getAdGroups: vi.fn().mockResolvedValue({ adGroups: [] }),
      createAdGroups: vi.fn().mockResolvedValue({ success: true }),
      updateAdGroups: vi.fn().mockResolvedValue({ success: true }),
      getAdItems: vi.fn().mockResolvedValue({ adItems: [] }),
      addAdItems: vi.fn().mockResolvedValue({ success: true }),
      updateAdItems: vi.fn().mockResolvedValue({ success: true }),
      getKeywords: vi.fn().mockResolvedValue({ keywords: [] }),
      addKeywords: vi.fn().mockResolvedValue({ success: true }),
      updateKeywords: vi.fn().mockResolvedValue({ success: true }),
      getKeywordAnalytics: vi.fn().mockResolvedValue({ analytics: {} }),
      createPlacementBids: vi.fn().mockResolvedValue({ success: true }),
      getPlacementBids: vi.fn().mockResolvedValue({ bids: [] }),
      createPlatformBids: vi.fn().mockResolvedValue({ success: true }),
      createReportSnapshot: vi.fn().mockResolvedValue({ snapshotId: 'SNAP1' }),
      getReportSnapshots: vi.fn().mockResolvedValue({ snapshots: [] }),
      getRealtimeStats: vi.fn().mockResolvedValue({ stats: {} }),
      getLatestReportDate: vi.fn().mockResolvedValue({ date: '2026-02-26' }),
      getItemRecommendations: vi.fn().mockResolvedValue({ recommendations: [] }),
      getKeywordRecommendations: vi.fn().mockResolvedValue({ keywords: [] }),
      getSearchTrends: vi.fn().mockResolvedValue({ trends: [] }),
      getSbaProfile: vi.fn().mockResolvedValue({ profile: {} }),
    },
    settings: {
      getShippingSettings: vi.fn().mockResolvedValue({ settings: {} }),
      updateShippingSettings: vi.fn().mockResolvedValue({ success: true }),
      getFulfillmentCenters: vi.fn().mockResolvedValue({ centers: [] }),
      getPartnerInfo: vi.fn().mockResolvedValue({ partnerId: 'P1' }),
    },
  } as any;
}

describe('Tool Dispatcher', () => {
  it('should throw on unknown tool', async () => {
    const api = createMockApi();
    await expect(executeTool(api, 'walmart_nonexistent', {})).rejects.toThrow('Unknown tool');
  });

  describe('Token Management', () => {
    it('walmart_get_token should refresh and return info', async () => {
      const api = createMockApi();
      const result = await executeTool(api, 'walmart_get_token', {});
      expect(api.auth.refreshToken).toHaveBeenCalled();
      expect(api.auth.getTokenInfo).toHaveBeenCalled();
      expect(result).toHaveProperty('token');
    });

    it('walmart_get_token_status should return token detail', async () => {
      const api = createMockApi();
      await executeTool(api, 'walmart_get_token_status', {});
      expect(api.auth.getTokenDetail).toHaveBeenCalled();
    });

    it('walmart_display_credentials should return masked credentials', async () => {
      process.env.WALMART_CLIENT_ID = 'test-id-123';
      process.env.WALMART_CLIENT_SECRET = 'super-secret-key-long';

      const api = createMockApi();
      const result = (await executeTool(api, 'walmart_display_credentials', {})) as any;
      expect(result.clientId).toBe('test-id-123');
      expect(result.clientSecret).toContain('...');
      expect(result.clientSecret).not.toBe('super-secret-key-long');
    });
  });

  describe('Items', () => {
    it('walmart_get_all_items should call items.getAllItems', async () => {
      const api = createMockApi();
      await executeTool(api, 'walmart_get_all_items', { limit: 10 });
      expect(api.items.getAllItems).toHaveBeenCalledWith({ limit: 10 });
    });

    it('walmart_get_item should call with sku', async () => {
      const api = createMockApi();
      await executeTool(api, 'walmart_get_item', { sku: 'ABC-123' });
      expect(api.items.getItem).toHaveBeenCalledWith('ABC-123');
    });
  });

  describe('Orders', () => {
    it('walmart_ship_order should pass purchaseOrderId and shipmentData', async () => {
      const api = createMockApi();
      const shipData = { orderLines: [] };
      await executeTool(api, 'walmart_ship_order', {
        purchaseOrderId: 'PO1',
        shipmentData: shipData,
      });
      expect(api.orders.shipOrder).toHaveBeenCalledWith('PO1', shipData);
    });
  });

  describe('Feeds', () => {
    it('walmart_poll_feed_until_complete should convert seconds to ms and clamp to 50s', async () => {
      const api = createMockApi();
      await executeTool(api, 'walmart_poll_feed_until_complete', {
        feedId: 'F1',
        maxWaitSeconds: 120,
      });
      // 120s requested, but the per-call budget is clamped to 50_000 ms so
      // MCP clients (which abort tool calls at ~60s) never kill the request.
      expect(api.feeds.pollFeedUntilComplete).toHaveBeenCalledWith('F1', 50000);
    });
  });

  describe('Fulfillment', () => {
    it('walmart_get_label_by_tracking should pass both params', async () => {
      const api = createMockApi();
      await executeTool(api, 'walmart_get_label_by_tracking', {
        carrierId: 'USPS',
        trackingNo: '123456',
      });
      expect(api.fulfillment.getLabelByTracking).toHaveBeenCalledWith('USPS', '123456');
    });
  });

  describe('Returns', () => {
    it('walmart_issue_return_refund should pass all three params', async () => {
      const api = createMockApi();
      await executeTool(api, 'walmart_issue_return_refund', {
        returnOrderId: 'R1',
        itemId: 'I1',
        refundData: { amount: -10 },
      });
      expect(api.returns.issueReturnRefund).toHaveBeenCalledWith('R1', 'I1', { amount: -10 });
    });
  });

  describe('Advertising', () => {
    it('walmart_ad_create_campaign should pass campaign data', async () => {
      const api = createMockApi();
      const data = { name: 'Test Campaign', dailyBudget: 50 };
      await executeTool(api, 'walmart_ad_create_campaign', { campaignData: data });
      expect(api.advertising.createCampaign).toHaveBeenCalledWith(data);
    });

    it('walmart_ad_get_sba_profile should call with no args', async () => {
      const api = createMockApi();
      await executeTool(api, 'walmart_ad_get_sba_profile', {});
      expect(api.advertising.getSbaProfile).toHaveBeenCalled();
    });
  });

  describe('Settings', () => {
    it('walmart_get_partner_info should call settings.getPartnerInfo', async () => {
      const api = createMockApi();
      await executeTool(api, 'walmart_get_partner_info', {});
      expect(api.settings.getPartnerInfo).toHaveBeenCalled();
    });
  });

  describe('All 126 tools have dispatch cases', () => {
    it('every registered tool name should be handled', async () => {
      const { getToolDefinitions } = await import('../../src/tools/index.js');
      const tools = getToolDefinitions();
      const api = createMockApi();

      // Skip walmart_set_credentials as it writes to .env
      const toolNames = tools.map((t: any) => t.name).filter((n: string) => n !== 'walmart_set_credentials');

      for (const name of toolNames) {
        // Should not throw "Unknown tool"
        try {
          await executeTool(api, name, {});
        } catch (e: any) {
          if (e.message.includes('Unknown tool')) {
            throw new Error(`Tool "${name}" has no dispatch case`);
          }
          // Other errors are OK (e.g., missing args) - we just want to verify dispatch exists
        }
      }
    });
  });
});
