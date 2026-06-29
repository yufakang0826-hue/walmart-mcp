/**
 * Tiny searchable catalog of Walmart Marketplace endpoint patterns and the
 * dedicated wrapped tools that already cover them. Used by
 * walmart_search_endpoints to suggest "use this existing tool first".
 *
 * Keep this short — it is a discoverability aid, not a full API reference.
 */

export interface EndpointEntry {
  /** Tags for keyword matching. */
  tags: string[];
  /** "GET /v3/feeds" — human-friendly. */
  signature: string;
  /** Wrapped tool that covers this endpoint, if any. */
  wrappedTool?: string;
  /** One-line description. */
  description: string;
}

export const ENDPOINT_CATALOG: ReadonlyArray<EndpointEntry> = [
  // ---------- Items ----------
  { tags: ['item', 'list', 'catalog'], signature: 'GET /v3/items', wrappedTool: 'walmart_get_all_items', description: 'List items in seller catalog.' },
  { tags: ['item', 'single', 'sku'], signature: 'GET /v3/items/{sku}', wrappedTool: 'walmart_get_item', description: 'Get single item by SKU.' },
  { tags: ['item', 'retire', 'delist'], signature: 'DELETE /v3/items/{sku}', wrappedTool: 'walmart_retire_item', description: 'Retire (unpublish) an item.' },
  { tags: ['taxonomy', 'category'], signature: 'GET /v3/items/taxonomy', wrappedTool: 'walmart_get_taxonomy', description: 'Get Walmart category taxonomy.' },
  { tags: ['spec', 'attribute'], signature: 'GET /v3/items/spec', wrappedTool: 'walmart_get_item_spec', description: 'Get required attributes for a product type.' },
  { tags: ['hazmat', 'onhold'], signature: 'POST /v3/items/onhold/search', wrappedTool: 'walmart_get_hazmat_items', description: 'Search items on hold for hazmat review.' },

  // ---------- Inventory ----------
  { tags: ['inventory', 'stock', 'sku'], signature: 'GET /v3/inventory', wrappedTool: 'walmart_get_inventory', description: 'Get inventory for a SKU.' },
  { tags: ['inventory', 'update', 'stock'], signature: 'PUT /v3/inventory', wrappedTool: 'walmart_update_inventory', description: 'Update inventory for a SKU.' },
  { tags: ['inventory', 'multi-node', 'ship-node'], signature: 'GET /v3/inventories', wrappedTool: 'walmart_get_inventory_all_nodes', description: 'Get inventory across all ship nodes.' },
  { tags: ['lag', 'lag-time'], signature: 'GET /v3/lagtime', wrappedTool: 'walmart_get_lag_time', description: 'Get fulfillment lag time for a SKU.' },

  // ---------- Pricing ----------
  { tags: ['price', 'update', 'base'], signature: 'PUT /v3/price', wrappedTool: 'walmart_update_price', description: 'Update base price for a SKU.' },
  { tags: ['promo', 'promotion', 'sale', 'discount'], signature: 'POST /v3/feeds?feedType=PROMO_PRICE', wrappedTool: 'walmart_submit_promo_price_feed', description: 'Submit a promotional price feed.' },
  { tags: ['repricer', 'buy-box', 'compete'], signature: 'GET /v3/repricer/strategies', wrappedTool: 'walmart_get_repricer_strategies', description: 'List repricer strategies (Pro Seller).' },

  // ---------- Feeds ----------
  { tags: ['feed', 'status'], signature: 'GET /v3/feeds/{feedId}', wrappedTool: 'walmart_get_feed_status', description: 'Get feed processing status.' },
  { tags: ['feed', 'list', 'history'], signature: 'GET /v3/feeds', wrappedTool: 'walmart_get_all_feed_statuses', description: 'List recent feeds.' },
  { tags: ['feed', 'submit'], signature: 'POST /v3/feeds', wrappedTool: 'walmart_submit_inventory_feed', description: 'Submit a bulk feed. Use feed-type-specific tools (walmart_submit_inventory_feed, walmart_submit_item_feed, walmart_submit_promo_price_feed) for strict validation.' },

  // ---------- Orders ----------
  { tags: ['order', 'list'], signature: 'GET /v3/orders', wrappedTool: 'walmart_get_all_orders', description: 'List orders with filters.' },
  { tags: ['order', 'released', 'ready'], signature: 'GET /v3/orders/released', wrappedTool: 'walmart_get_released_orders', description: 'List orders ready for fulfillment.' },
  { tags: ['order', 'single', 'purchase-order'], signature: 'GET /v3/orders/{poId}', wrappedTool: 'walmart_get_order', description: 'Get single order by purchase order ID.' },
  { tags: ['acknowledge', 'ack', 'order'], signature: 'POST /v3/orders/{poId}/acknowledge', wrappedTool: 'walmart_acknowledge_order', description: 'Acknowledge a new order.' },
  { tags: ['ship', 'shipment', 'tracking'], signature: 'POST /v3/orders/{poId}/shipping', wrappedTool: 'walmart_ship_order', description: 'Mark order lines as shipped.' },
  { tags: ['cancel', 'order'], signature: 'POST /v3/orders/{poId}/cancel', wrappedTool: 'walmart_cancel_order', description: 'Cancel order lines.' },
  { tags: ['refund', 'order'], signature: 'POST /v3/orders/{poId}/refund', wrappedTool: 'walmart_refund_order', description: 'Refund order lines (negative amount).' },

  // ---------- Returns ----------
  { tags: ['return', 'list'], signature: 'GET /v3/returns', wrappedTool: 'walmart_get_all_returns', description: 'List returns.' },
  { tags: ['return', 'single'], signature: 'GET /v3/returns/{returnOrderId}', wrappedTool: 'walmart_get_return', description: 'Get single return.' },
  { tags: ['return', 'approve'], signature: 'POST /v3/returns/approve', wrappedTool: 'walmart_approve_return', description: 'Approve a return.' },
  { tags: ['return', 'reject'], signature: 'POST /v3/returns/reject', wrappedTool: 'walmart_reject_return', description: 'Reject a return.' },
  { tags: ['return', 'refund'], signature: 'POST /v3/returns/{rid}/items/{iid}/refund', wrappedTool: 'walmart_issue_return_refund', description: 'Issue refund for a return.' },
  { tags: ['return', 'label', 'shipping'], signature: 'POST /v3/returns/{rid}/items/{iid}/shippinglabel', wrappedTool: 'walmart_generate_return_label', description: 'Generate return shipping label.' },

  // ---------- Reports ----------
  { tags: ['report', 'request', 'generate'], signature: 'POST /v3/reports/reportRequests', wrappedTool: 'walmart_create_report', description: 'Request generation of a report.' },
  { tags: ['report', 'status'], signature: 'GET /v3/reports/reportRequests/{id}', wrappedTool: 'walmart_get_report_status', description: 'Check report generation status.' },
  { tags: ['report', 'download'], signature: 'GET /v3/reports/reportRequests/{id}/download', wrappedTool: 'walmart_download_report', description: 'Download a READY report.' },
  { tags: ['report', 'schedule', 'recurring'], signature: 'POST /v3/reports/reportSchedules', wrappedTool: 'walmart_create_report_schedule', description: 'Create a recurring report schedule.' },

  // ---------- Notifications / Webhooks ----------
  { tags: ['webhook', 'subscription', 'notification'], signature: 'GET /v3/notifications/subscriptions', wrappedTool: 'walmart_get_subscriptions', description: 'List webhook subscriptions.' },
  { tags: ['webhook', 'create'], signature: 'POST /v3/notifications/subscriptions', wrappedTool: 'walmart_create_subscription', description: 'Create a webhook subscription.' },

  // ---------- Insights ----------
  { tags: ['quality', 'listing-quality', 'score'], signature: 'GET /v3/insights/items/listingQuality', wrappedTool: 'walmart_get_listing_quality', description: 'Get store listing quality score.' },

  // ---------- Settings / Partner ----------
  { tags: ['partner', 'seller-info', 'account'], signature: 'GET /v3/partner/info', wrappedTool: 'walmart_get_partner_info', description: 'Get partner account info.' },
  { tags: ['fulfillment-center', 'ship-node'], signature: 'GET /v3/shipping/labels/fulfillmentcenters', wrappedTool: 'walmart_get_fulfillment_centers', description: 'List fulfillment centers.' },

  // ---------- Auth / Diagnostics ----------
  { tags: ['token', 'auth', 'oauth'], signature: 'POST /v3/token', wrappedTool: 'walmart_get_token', description: 'Get OAuth Bearer token.' },
  { tags: ['rate', 'budget', 'limit'], signature: '(internal)', wrappedTool: 'walmart_get_rate_budget', description: 'Snapshot local + server rate-limit state.' },
];

/** Case-insensitive substring + tag-match search. */
export function searchEndpoints(
  query: string,
  limit = 10,
): ReadonlyArray<EndpointEntry & { matchScore: number }> {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);

  const scored: Array<EndpointEntry & { matchScore: number }> = [];
  for (const entry of ENDPOINT_CATALOG) {
    let score = 0;
    const tagBag = entry.tags.join(' ').toLowerCase();
    const sigBag = entry.signature.toLowerCase();
    const descBag = entry.description.toLowerCase();
    const toolBag = (entry.wrappedTool ?? '').toLowerCase();
    for (const tok of tokens) {
      if (tagBag.includes(tok)) score += 3;
      if (toolBag.includes(tok)) score += 2;
      if (sigBag.includes(tok)) score += 2;
      if (descBag.includes(tok)) score += 1;
    }
    if (score > 0) scored.push({ ...entry, matchScore: score });
  }
  scored.sort((a, b) => b.matchScore - a.matchScore);
  return scored.slice(0, limit);
}
