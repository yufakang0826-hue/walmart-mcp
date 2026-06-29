import { type WalmartConfig } from '../config/environment.js';
import { WalmartApiClient } from './client.js';
import { WalmartOAuthClient } from '../auth/oauth.js';
import { ItemsApi } from './items/items-api.js';
import { InventoryApi } from './inventory/inventory-api.js';
import { OrdersApi } from './orders/orders-api.js';
import { PricingApi } from './pricing/pricing-api.js';
import { FeedsApi } from './feeds/feeds-api.js';
import { FulfillmentApi } from './fulfillment/fulfillment-api.js';
import { ReturnsApi } from './returns/returns-api.js';
import { ReportsApi } from './reports/reports-api.js';
import { NotificationsApi } from './notifications/notifications-api.js';
import { WalmartAdClient } from './advertising/ad-client.js';
import { AdvertisingApi } from './advertising/advertising-api.js';
import { SettingsApi } from './settings/settings-api.js';

export class WalmartSellerApi {
  private client: WalmartApiClient;
  public auth: WalmartOAuthClient;
  public items: ItemsApi;
  public inventory: InventoryApi;
  public orders: OrdersApi;
  public pricing: PricingApi;
  public feeds: FeedsApi;
  public fulfillment: FulfillmentApi;
  public returns: ReturnsApi;
  public reports: ReportsApi;
  public notifications: NotificationsApi;
  public advertising: AdvertisingApi;
  public settings: SettingsApi;

  constructor(config: WalmartConfig) {
    this.client = new WalmartApiClient(config);
    this.auth = this.client.getAuthClient();

    this.items = new ItemsApi(this.client);
    this.inventory = new InventoryApi(this.client);
    this.orders = new OrdersApi(this.client);
    this.pricing = new PricingApi(this.client);
    this.feeds = new FeedsApi(this.client);
    this.fulfillment = new FulfillmentApi(this.client);
    this.returns = new ReturnsApi(this.client);
    this.reports = new ReportsApi(this.client);
    this.notifications = new NotificationsApi(this.client);
    this.settings = new SettingsApi(this.client);

    // Advertising uses a separate HTTP client with different auth
    const adClient = new WalmartAdClient(config);
    this.advertising = new AdvertisingApi(adClient);
  }

  async initialize(): Promise<void> {
    await this.client.initialize();
  }
  /** Snapshot the rate limiter state for the walmart_get_rate_budget tool. */
  getRateLimiterStatus() {
    return this.client.getRateLimiter().getStatus();
  }

  /** Expose the marketplace client for the walmart_call_endpoint discovery tool. */
  getMarketplaceClient() {
    return this.client;
  }
}
