import { WalmartApiClient } from '../client.js';
import { makePagination } from '../../utils/pagination.js';

export class ReturnsApi {
  private basePath = '/v3/returns';

  constructor(private client: WalmartApiClient) {}

  async getAllReturns(params?: {
    limit?: number;
    offset?: number;
    status?: string;
    returnCreationStartDate?: string;
    returnCreationEndDate?: string;
    customerOrderId?: string;
  }) {
    const raw = await this.client.get(this.basePath, params);
    // Attach uniform pagination metadata (non-destructive).
    const returns = (raw as { returnOrders?: unknown[] })?.returnOrders;
    const meta = (raw as { meta?: { totalCount?: number; nextCursor?: string } })?.meta;
    if (Array.isArray(returns)) {
      (raw as Record<string, unknown>).pagination = makePagination({
        returned: returns.length,
        totalCount: meta?.totalCount,
        nextCursor: meta?.nextCursor,
        offset: params?.offset ?? null,
      });
    }
    return raw;
  }

  async getReturn(returnOrderId: string) {
    if (!returnOrderId) throw new Error('returnOrderId is required');
    return await this.client.get(`${this.basePath}/${encodeURIComponent(returnOrderId)}`);
  }

  async approveReturn(data: object) {
    return await this.client.post(`${this.basePath}/approve`, data);
  }

  async rejectReturn(data: object) {
    return await this.client.post(`${this.basePath}/reject`, data);
  }

  async issueReturnRefund(returnOrderId: string, itemId: string, data: object) {
    if (!returnOrderId || !itemId) throw new Error('returnOrderId and itemId are required');
    return await this.client.post(
      `${this.basePath}/${encodeURIComponent(returnOrderId)}/items/${encodeURIComponent(itemId)}/refund`,
      data,
    );
  }

  async generateReturnLabel(returnOrderId: string, itemId: string, data: object) {
    if (!returnOrderId || !itemId) throw new Error('returnOrderId and itemId are required');
    return await this.client.post(
      `${this.basePath}/${encodeURIComponent(returnOrderId)}/items/${encodeURIComponent(itemId)}/shippinglabel`,
      data,
    );
  }

  async getWfsReturns(params?: {
    limit?: number;
    offset?: number;
  }) {
    return await this.client.get(this.basePath, { ...params, isWFSEnabled: 'Y' });
  }

  async getReturnCount(params?: {
    status?: string;
  }) {
    return await this.client.get(`${this.basePath}/count`, params);
  }
}
