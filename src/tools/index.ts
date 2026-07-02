import { type WalmartSellerApi } from '../api/index.js';
import { upsertEnvVars } from '../utils/env-file.js';
import { tokenManagementTools } from './definitions/token-management.js';
import { itemTools } from './definitions/items.js';
import { inventoryTools } from './definitions/inventory.js';
import { orderTools } from './definitions/orders.js';
import { pricingTools } from './definitions/pricing.js';
import { feedTools } from './definitions/feeds.js';
import { fulfillmentTools } from './definitions/fulfillment.js';
import { returnTools } from './definitions/returns.js';
import { reportTools } from './definitions/reports.js';
import { notificationTools } from './definitions/notifications.js';
import { advertisingTools } from './definitions/advertising.js';
import { settingsTools } from './definitions/settings.js';
import { discoveryTools } from './definitions/discovery.js';
import { searchEndpoints } from '../utils/endpoint-catalog.js';

export function getToolDefinitions() {
  return [
    ...tokenManagementTools,
    ...itemTools,
    ...inventoryTools,
    ...orderTools,
    ...pricingTools,
    ...feedTools,
    ...fulfillmentTools,
    ...returnTools,
    ...reportTools,
    ...notificationTools,
    ...advertisingTools,
    ...settingsTools,
    ...discoveryTools,
  ];
}

export async function executeTool(
  api: WalmartSellerApi,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (toolName) {
    // ===== Token Management =====
    case 'walmart_get_token':
      await api.auth.refreshToken();
      return api.auth.getTokenInfo();

    case 'walmart_get_token_status':
      return await api.auth.getTokenDetail();

    case 'walmart_get_token_info':
      return api.auth.getTokenInfo();

    case 'walmart_set_credentials': {
      upsertEnvVars({
        WALMART_CLIENT_ID: args.clientId as string,
        WALMART_CLIENT_SECRET: args.clientSecret as string,
      });
      return { success: true, message: 'Credentials saved to .env. Restart the server to apply.' };
    }

    case 'walmart_display_credentials':
      return {
        clientId: process.env.WALMART_CLIENT_ID || '(not set)',
        clientSecret: process.env.WALMART_CLIENT_SECRET
          ? `${process.env.WALMART_CLIENT_SECRET.substring(0, 8)}...${process.env.WALMART_CLIENT_SECRET.slice(-4)}`
          : '(not set)',
        environment: process.env.WALMART_ENVIRONMENT || 'sandbox',
        market: process.env.WALMART_MARKET || 'us',
        svcName: process.env.WALMART_SVC_NAME || 'Walmart Marketplace',
      };

    case 'walmart_setup_guide': {
      const hasMarketplaceCreds = !!(process.env.WALMART_CLIENT_ID && process.env.WALMART_CLIENT_SECRET);
      const hasAdCreds = !!(process.env.WALMART_AD_CONSUMER_ID && process.env.WALMART_AD_PRIVATE_KEY);
      const environment = process.env.WALMART_ENVIRONMENT || 'sandbox';
      return {
        status: hasMarketplaceCreds ? 'ready' : 'credentials_required',
        configured: {
          marketplaceCredentials: hasMarketplaceCreds,
          advertisingCredentials: hasAdCreds,
          environment,
          market: process.env.WALMART_MARKET || 'us',
        },
        steps: [
          '1. Get API credentials: sign in at https://developer.walmart.com/, create an app under Marketplace, and copy the Client ID and Client Secret.',
          '2. Provide credentials one of two ways: (a) set WALMART_CLIENT_ID and WALMART_CLIENT_SECRET in your MCP server "env" (or a .env file in the project root) and restart, or (b) call the walmart_set_credentials tool now with your Client ID and Secret.',
          '3. Choose the environment: set WALMART_ENVIRONMENT to "sandbox" (default, for testing) or "production" (for live selling).',
          '4. Verify: call walmart_get_token to confirm authentication works, then walmart_display_credentials to review the active configuration.',
          '5. (Optional) For Walmart Connect advertising tools, also set WALMART_AD_CONSUMER_ID and WALMART_AD_PRIVATE_KEY (apply at https://www.walmartconnect.com/).',
        ],
        nextAction: hasMarketplaceCreds
          ? 'Credentials are set. Call walmart_get_token to verify, then use any tool.'
          : 'No marketplace credentials yet. Call walmart_set_credentials, or set the env vars and restart.',
        docs: 'https://developer.walmart.com/',
      };
    }

    case 'walmart_get_rate_budget': {
      const status = api.getRateLimiterStatus();
      return {
        ...status,
        notes: [
          'localRemaining = requests this MCP can issue right now under the sliding-window limiter.',
          'serverTokensRemaining = most recent x-current-token-count from Walmart (null if no API call has been made yet).',
          'serverReplenishTime = most recent x-next-replenish-time (ISO 8601) — when Walmart will top your bucket back up.',
          'Walmart Marketplace does not have an OAuth user-token flow; rate limits depend on your seller-account tier.',
        ],
      };
    }

    // ===== Items =====
    case 'walmart_get_all_items':
      return await api.items.getAllItems(args as Parameters<typeof api.items.getAllItems>[0]);

    case 'walmart_get_item':
      return await api.items.getItem(args.sku as string);

    case 'walmart_retire_item':
      return await api.items.retireItem(args.sku as string);

    case 'walmart_bulk_retire_items':
      return await api.items.bulkRetireItems(args.skus as { sku: string }[]);

    case 'walmart_get_item_count':
      return await api.items.getItemCount(args as Parameters<typeof api.items.getItemCount>[0]);

    case 'walmart_get_taxonomy':
      return await api.items.getTaxonomy(
        args as Parameters<typeof api.items.getTaxonomy>[0],
      );

    case 'walmart_get_item_spec':
      return await api.items.getItemSpec(args as Parameters<typeof api.items.getItemSpec>[0]);

    case 'walmart_submit_item_feed':
      return await api.items.submitItemFeed(args.feedData as object);

    case 'walmart_submit_item_update_feed':
      return await api.items.submitItemUpdateFeed(args.feedData as object);

    case 'walmart_submit_wfs_item_feed':
      return await api.items.submitWfsItemFeed(args.feedData as object);

    case 'walmart_convert_to_wfs':
      return await api.items.convertToWfs(args.feedData as object);

    case 'walmart_get_hazmat_items':
      return await api.items.getHazmatItems(args.requestData as object | undefined);

    // ===== Inventory =====
    case 'walmart_get_inventory':
      return await api.inventory.getInventory(args.sku as string);

    case 'walmart_update_inventory':
      return await api.inventory.updateInventory(args as {
        sku: string; quantity: number; shipNode?: string;
      });

    case 'walmart_get_inventory_all_nodes':
      return await api.inventory.getInventoryAllNodes(args.sku as string);

    case 'walmart_update_inventory_multi_node':
      return await api.inventory.updateInventoryMultiNode(
        args.sku as string,
        args.inventoryData as object,
      );

    case 'walmart_get_all_inventory':
      return await api.inventory.getAllInventory(
        args as Parameters<typeof api.inventory.getAllInventory>[0],
      );

    case 'walmart_submit_inventory_feed':
      return await api.inventory.submitInventoryFeed(args.feedData as object);

    case 'walmart_submit_multi_node_inventory_feed':
      return await api.inventory.submitMultiNodeInventoryFeed(args.feedData as object);

    case 'walmart_get_lag_time':
      return await api.inventory.getLagTime(args.sku as string);

    case 'walmart_update_lag_time':
      return await api.inventory.updateLagTime(args as {
        sku: string; fulfillmentLagTime: number;
      });

    case 'walmart_submit_lagtime_feed':
      return await api.inventory.submitLagTimeFeed(args.feedData as object);

    // ===== Orders =====
    case 'walmart_get_all_orders':
      return await api.orders.getAllOrders(
        args as Parameters<typeof api.orders.getAllOrders>[0],
      );

    case 'walmart_get_released_orders':
      return await api.orders.getReleasedOrders(
        args as Parameters<typeof api.orders.getReleasedOrders>[0],
      );

    case 'walmart_get_order':
      return await api.orders.getOrder(args.purchaseOrderId as string);

    case 'walmart_acknowledge_order':
      return await api.orders.acknowledgeOrder(args.purchaseOrderId as string);

    case 'walmart_ship_order':
      return await api.orders.shipOrder(
        args.purchaseOrderId as string,
        args.shipmentData as object,
      );

    case 'walmart_cancel_order':
      return await api.orders.cancelOrder(
        args.purchaseOrderId as string,
        args.cancelData as object,
      );

    case 'walmart_refund_order':
      return await api.orders.refundOrder(
        args.purchaseOrderId as string,
        args.refundData as object,
      );

    case 'walmart_get_shipping_carriers':
      return await api.orders.getShippingCarriers();

    case 'walmart_create_shipping_label':
      return await api.orders.createShippingLabel(args.labelData as object);

    case 'walmart_get_shipping_estimate':
      return await api.orders.getShippingEstimate(args.estimateParams as object);

    // ===== Pricing =====
    case 'walmart_update_price':
      return await api.pricing.updatePrice(
        args as { sku: string; amount: number; currency?: string },
      );

    case 'walmart_submit_price_feed':
      return await api.pricing.submitPriceFeed(args.feedData as object);

    case 'walmart_submit_mp_price_feed':
      return await api.pricing.submitMpPriceFeed(args.feedData as object);

    case 'walmart_submit_promo_price_feed':
      return await api.pricing.submitPromoPriceFeed(args.feedData as object);

    case 'walmart_get_repricer_strategies':
      return await api.pricing.getRepricerStrategies();

    case 'walmart_create_repricer_strategy':
      return await api.pricing.createRepricerStrategy(args.strategyData as object);

    case 'walmart_update_repricer_strategy':
      return await api.pricing.updateRepricerStrategy(args.strategyData as object);

    case 'walmart_delete_repricer_strategy':
      return await api.pricing.deleteRepricerStrategy(args.strategyId as string);

    case 'walmart_assign_items_to_strategy':
      return await api.pricing.assignItemsToStrategy(args as {
        strategyId: string; items: object[];
      });

    case 'walmart_unassign_items_from_strategy':
      return await api.pricing.unassignItemsFromStrategy(args as {
        strategyId: string; skus: string[];
      });

    // ===== Feeds =====
    case 'walmart_get_all_feed_statuses':
      return await api.feeds.getAllFeedStatuses(
        args as Parameters<typeof api.feeds.getAllFeedStatuses>[0],
      );

    case 'walmart_get_feed_status':
      return await api.feeds.getFeedStatus(args.feedId as string);

    case 'walmart_get_feed_item_status':
      return await api.feeds.getFeedItemStatus(args.feedId as string);

    case 'walmart_submit_generic_feed':
      return await api.feeds.submitFeed(args.feedType as string, args.feedData as object);

    case 'walmart_poll_feed_until_complete': {
      // MCP clients abort tool calls at ~60s, so clamp the per-invocation
      // budget to 50s; longer waits are achieved by calling the tool again
      // (it returns pollTimedOut: true + latest status instead of throwing).
      const requestedMs = args.maxWaitSeconds
        ? (args.maxWaitSeconds as number) * 1000
        : undefined;
      const maxWaitMs = Math.min(requestedMs ?? 45_000, 50_000);
      return await api.feeds.pollFeedUntilComplete(args.feedId as string, maxWaitMs);
    }

    // ===== WFS Fulfillment =====
    case 'walmart_create_inbound_order':
      return await api.fulfillment.createInboundOrder(args.orderData as object);

    case 'walmart_get_inbound_shipments':
      return await api.fulfillment.getInboundShipments(
        args as Parameters<typeof api.fulfillment.getInboundShipments>[0],
      );

    case 'walmart_get_inbound_errors':
      return await api.fulfillment.getInboundErrors(
        args as Parameters<typeof api.fulfillment.getInboundErrors>[0],
      );

    case 'walmart_get_shipment_items':
      return await api.fulfillment.getShipmentItems(
        args as Parameters<typeof api.fulfillment.getShipmentItems>[0],
      );

    case 'walmart_get_shipment_quantities':
      return await api.fulfillment.getShipmentQuantities(
        args as Parameters<typeof api.fulfillment.getShipmentQuantities>[0],
      );

    case 'walmart_get_shipment_label':
      return await api.fulfillment.getShipmentLabel(args.shipmentId as string);

    case 'walmart_update_shipment_tracking':
      return await api.fulfillment.updateShipmentTracking(args.trackingData as object);

    case 'walmart_cancel_inbound_order':
      return await api.fulfillment.cancelInboundOrder(args.inboundOrderId as string);

    case 'walmart_get_purchased_label':
      return await api.fulfillment.getShippingLabel(args.purchaseOrderId as string);

    case 'walmart_get_label_by_tracking':
      return await api.fulfillment.getLabelByTracking(
        args.carrierId as string,
        args.trackingNo as string,
      );

    case 'walmart_discard_label':
      return await api.fulfillment.discardLabel(args.labelData as object);

    case 'walmart_get_package_types':
      return await api.fulfillment.getPackageTypes(args.carrierId as string);

    case 'walmart_create_mcs_order':
      return await api.fulfillment.createMcsOrder(args.orderData as object);

    case 'walmart_cancel_mcs_order':
      return await api.fulfillment.cancelMcsOrder(args.cancelData as object);

    case 'walmart_get_mcs_order_status':
      return await api.fulfillment.getMcsOrderStatus(args.orderId as string);

    case 'walmart_get_carrier_rate_quotes':
      return await api.fulfillment.getCarrierRateQuotes(args.quoteData as object);

    case 'walmart_book_carrier_shipment':
      return await api.fulfillment.bookCarrierShipment(args.bookingData as object);

    case 'walmart_get_carrier_label':
      return await api.fulfillment.getCarrierLabel(args.shipmentId as string);

    case 'walmart_schedule_carrier_pickup':
      return await api.fulfillment.scheduleCarrierPickup(args.pickupData as object);

    // ===== Returns & Refunds =====
    case 'walmart_get_all_returns':
      return await api.returns.getAllReturns(
        args as Parameters<typeof api.returns.getAllReturns>[0],
      );

    case 'walmart_get_return':
      return await api.returns.getReturn(args.returnOrderId as string);

    case 'walmart_approve_return':
      return await api.returns.approveReturn(args.approvalData as object);

    case 'walmart_reject_return':
      return await api.returns.rejectReturn(args.rejectionData as object);

    case 'walmart_issue_return_refund':
      return await api.returns.issueReturnRefund(
        args.returnOrderId as string,
        args.itemId as string,
        args.refundData as object,
      );

    case 'walmart_generate_return_label':
      return await api.returns.generateReturnLabel(
        args.returnOrderId as string,
        args.itemId as string,
        args.labelData as object,
      );

    case 'walmart_get_wfs_returns':
      return await api.returns.getWfsReturns(
        args as Parameters<typeof api.returns.getWfsReturns>[0],
      );

    case 'walmart_get_return_count':
      return await api.returns.getReturnCount(
        args as Parameters<typeof api.returns.getReturnCount>[0],
      );

    // ===== Reports & Analytics =====
    case 'walmart_create_report':
      return await api.reports.createReport(args.reportData as object);

    case 'walmart_get_report_requests':
      return await api.reports.getReportRequests(
        args as Parameters<typeof api.reports.getReportRequests>[0],
      );

    case 'walmart_get_report_status':
      return await api.reports.getReportStatus(args.requestId as string);

    case 'walmart_download_report':
      return await api.reports.downloadReport(
        args as Parameters<typeof api.reports.downloadReport>[0],
      );

    case 'walmart_create_report_schedule':
      return await api.reports.createReportSchedule(args.scheduleData as object);

    case 'walmart_get_report_schedules':
      return await api.reports.getReportSchedules(
        args as Parameters<typeof api.reports.getReportSchedules>[0],
      );

    case 'walmart_update_report_schedule':
      return await api.reports.updateReportSchedule(
        args.scheduleId as string,
        args.scheduleData as object,
      );

    case 'walmart_delete_report_schedule':
      return await api.reports.deleteReportSchedule(args.scheduleId as string);

    case 'walmart_get_unpublished_items':
      return await api.reports.getUnpublishedItems(
        args as Parameters<typeof api.reports.getUnpublishedItems>[0],
      );

    case 'walmart_get_listing_quality':
      return await api.reports.getListingQuality(
        args as Parameters<typeof api.reports.getListingQuality>[0],
      );

    case 'walmart_get_quality_categories':
      return await api.reports.getQualityCategories(
        args as Parameters<typeof api.reports.getQualityCategories>[0],
      );

    case 'walmart_get_item_quality_details':
      return await api.reports.getItemQualityDetails(
        args as Parameters<typeof api.reports.getItemQualityDetails>[0],
      );

    // ===== Notifications =====
    case 'walmart_create_subscription':
      return await api.notifications.createSubscription(args.subscriptionData as object);

    case 'walmart_get_subscriptions':
      return await api.notifications.getSubscriptions(
        args as Parameters<typeof api.notifications.getSubscriptions>[0],
      );

    case 'walmart_get_subscription':
      return await api.notifications.getSubscription(args.subscriptionId as string);

    case 'walmart_update_subscription':
      return await api.notifications.updateSubscription(
        args.subscriptionId as string,
        args.subscriptionData as object,
      );

    case 'walmart_delete_subscription':
      return await api.notifications.deleteSubscription(args.subscriptionId as string);

    case 'walmart_test_subscription':
      return await api.notifications.testSubscription(args.subscriptionId as string);

    // ===== Advertising (Walmart Connect) =====
    case 'walmart_ad_get_campaigns':
      return await api.advertising.getCampaigns(
        args as Parameters<typeof api.advertising.getCampaigns>[0],
      );

    case 'walmart_ad_create_campaign':
      return await api.advertising.createCampaign(args.campaignData as object);

    case 'walmart_ad_update_campaign':
      return await api.advertising.updateCampaign(args.campaignData as object);

    case 'walmart_ad_delete_campaign':
      return await api.advertising.deleteCampaign(args.deleteData as object);

    case 'walmart_ad_get_ad_groups':
      return await api.advertising.getAdGroups(
        args as Parameters<typeof api.advertising.getAdGroups>[0],
      );

    case 'walmart_ad_create_ad_groups':
      return await api.advertising.createAdGroups(args.adGroupData as object);

    case 'walmart_ad_update_ad_groups':
      return await api.advertising.updateAdGroups(args.adGroupData as object);

    case 'walmart_ad_get_ad_items':
      return await api.advertising.getAdItems(
        args as Parameters<typeof api.advertising.getAdItems>[0],
      );

    case 'walmart_ad_add_ad_items':
      return await api.advertising.addAdItems(args.itemData as object);

    case 'walmart_ad_update_ad_items':
      return await api.advertising.updateAdItems(args.itemData as object);

    case 'walmart_ad_get_keywords':
      return await api.advertising.getKeywords(
        args as Parameters<typeof api.advertising.getKeywords>[0],
      );

    case 'walmart_ad_add_keywords':
      return await api.advertising.addKeywords(args.keywordData as object);

    case 'walmart_ad_update_keywords':
      return await api.advertising.updateKeywords(args.keywordData as object);

    case 'walmart_ad_get_keyword_analytics':
      return await api.advertising.getKeywordAnalytics(args.analyticsData as object);

    case 'walmart_ad_create_placement_bids':
      return await api.advertising.createPlacementBids(args.bidData as object);

    case 'walmart_ad_get_placement_bids':
      return await api.advertising.getPlacementBids(
        args as Parameters<typeof api.advertising.getPlacementBids>[0],
      );

    case 'walmart_ad_create_platform_bids':
      return await api.advertising.createPlatformBids(args.bidData as object);

    case 'walmart_ad_create_report_snapshot':
      return await api.advertising.createReportSnapshot(args.reportData as object);

    case 'walmart_ad_get_report_snapshots':
      return await api.advertising.getReportSnapshots(
        args as Parameters<typeof api.advertising.getReportSnapshots>[0],
      );

    case 'walmart_ad_get_realtime_stats':
      return await api.advertising.getRealtimeStats(args.statsData as object);

    case 'walmart_ad_get_latest_report_date':
      return await api.advertising.getLatestReportDate();

    case 'walmart_ad_get_item_recommendations':
      return await api.advertising.getItemRecommendations(args.recommendationData as object);

    case 'walmart_ad_get_keyword_recommendations':
      return await api.advertising.getKeywordRecommendations(args.recommendationData as object);

    case 'walmart_ad_get_search_trends':
      return await api.advertising.getSearchTrends(args.trendData as object);

    case 'walmart_ad_get_sba_profile':
      return await api.advertising.getSbaProfile();

    // ===== Settings & Configuration =====
    case 'walmart_get_shipping_settings':
      return await api.settings.getShippingSettings();

    case 'walmart_update_shipping_settings':
      return await api.settings.updateShippingSettings(args.settingsData as object);

    case 'walmart_get_fulfillment_centers':
      return await api.settings.getFulfillmentCenters();

    case 'walmart_get_partner_info':
      return await api.settings.getPartnerInfo();


    // ===== Discovery / escape hatch =====
    case 'walmart_call_endpoint': {
      const method = (args.method as string).toUpperCase();
      const path = args.path as string;
      const params = args.params as Record<string, string | number | boolean> | undefined;
      const body = args.body as Record<string, unknown> | undefined;
      const client = api.getMarketplaceClient();
      // client.post/put take no axios config for params, so fold query params
      // into the path for body-carrying methods. (Previously params were
      // silently dropped for POST/PUT/PATCH — e.g. POST /v3/feeds?feedType=X
      // 404ed unless the caller embedded the query in `path` manually.)
      const withQuery = (): string => {
        if (!params || Object.keys(params).length === 0) return path;
        const qs = new URLSearchParams(
          Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
        ).toString();
        return `${path}${path.includes('?') ? '&' : '?'}${qs}`;
      };
      switch (method) {
        case 'GET':    return await client.get(path, params);
        case 'DELETE': return await client.delete(path, params);
        case 'POST':   return await client.post(withQuery(), body);
        case 'PUT':    return await client.put(withQuery(), body);
        case 'PATCH':  return await client.post(withQuery(), body);
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }
    }

    case 'walmart_search_endpoints': {
      const q = args.query as string;
      const limit = (args.limit as number | undefined) ?? 10;
      return { query: q, matches: searchEndpoints(q, limit) };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
