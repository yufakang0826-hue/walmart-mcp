import { WalmartApiClient } from '../client.js';

export class NotificationsApi {
  private basePath = '/v3/notifications/subscriptions';

  constructor(private client: WalmartApiClient) {}

  async createSubscription(data: object) {
    return await this.client.post(this.basePath, data);
  }

  async getSubscriptions(params?: {
    eventType?: string;
  }) {
    return await this.client.get(this.basePath, params);
  }

  async getSubscription(subscriptionId: string) {
    if (!subscriptionId) throw new Error('subscriptionId is required');
    return await this.client.get(`${this.basePath}/${encodeURIComponent(subscriptionId)}`);
  }

  async updateSubscription(subscriptionId: string, data: object) {
    if (!subscriptionId) throw new Error('subscriptionId is required');
    return await this.client.put(
      `${this.basePath}/${encodeURIComponent(subscriptionId)}`,
      data,
    );
  }

  async deleteSubscription(subscriptionId: string) {
    if (!subscriptionId) throw new Error('subscriptionId is required');
    return await this.client.delete(
      `${this.basePath}/${encodeURIComponent(subscriptionId)}`,
    );
  }

  async testSubscription(subscriptionId: string) {
    if (!subscriptionId) throw new Error('subscriptionId is required');
    return await this.client.post(
      `${this.basePath}/${encodeURIComponent(subscriptionId)}/test`,
    );
  }
}
