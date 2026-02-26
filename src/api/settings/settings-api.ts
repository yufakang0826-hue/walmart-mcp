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
    return await this.client.get('/v3/settings/partner');
  }
}
