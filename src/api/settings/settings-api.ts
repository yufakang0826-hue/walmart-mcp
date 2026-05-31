import { WalmartApiClient } from '../client.js';

export class SettingsApi {
  constructor(private client: WalmartApiClient) {}

  async getShippingSettings() {
    return await this.client.get('/v3/settings/shipping');
  }

  async updateShippingSettings(data: object) {
    return await this.client.put('/v3/settings/shipping', data);
  }

  async getFulfillmentCenters() {
    return await this.client.get('/v3/settings/shippingprofile');
  }

  async getPartnerInfo() {
    // Walmart has no dedicated partner endpoint; the seller/partner record is
    // returned as the `partner` object on the shipping-profile settings payload.
    const data = await this.client.get<{ partner?: object }>('/v3/settings/shippingprofile');
    return data?.partner ?? data;
  }
}
