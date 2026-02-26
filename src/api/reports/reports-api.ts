import { WalmartApiClient } from '../client.js';

export class ReportsApi {
  constructor(private client: WalmartApiClient) {}

  // ===== Report Requests =====

  async createReport(data: object) {
    return await this.client.post('/v3/reports/reportRequests', data);
  }

  async getReportRequests(params?: {
    reportType?: string;
    reportVersion?: string;
  }) {
    return await this.client.get('/v3/reports/reportRequests', params);
  }

  async getReportStatus(requestId: string) {
    if (!requestId) throw new Error('requestId is required');
    return await this.client.get(
      `/v3/reports/reportRequests/${encodeURIComponent(requestId)}`,
    );
  }

  async downloadReport(params: {
    requestId?: string;
    reportType?: string;
  }) {
    return await this.client.get('/v3/reports/downloadReport', params);
  }

  // ===== Report Schedules =====

  async createReportSchedule(data: object) {
    return await this.client.post('/v3/reports/schedules', data);
  }

  async getReportSchedules(params?: {
    reportType?: string;
  }) {
    return await this.client.get('/v3/reports/schedules', params);
  }

  async updateReportSchedule(scheduleId: string, data: object) {
    if (!scheduleId) throw new Error('scheduleId is required');
    return await this.client.put(
      `/v3/reports/schedules/${encodeURIComponent(scheduleId)}`,
      data,
    );
  }

  async deleteReportSchedule(scheduleId: string) {
    if (!scheduleId) throw new Error('scheduleId is required');
    return await this.client.delete(
      `/v3/reports/schedules/${encodeURIComponent(scheduleId)}`,
    );
  }

  // ===== Insights =====

  async getUnpublishedItems(params?: {
    limit?: number;
    offset?: number;
  }) {
    return await this.client.get('/v3/insights/items/unpublished', params);
  }

  async getListingQuality(params?: {
    category?: string;
  }) {
    return await this.client.get('/v3/insights/items/listingQuality/score', params);
  }

  async getQualityCategories(params?: {
    limit?: number;
    offset?: number;
  }) {
    return await this.client.get('/v3/insights/items/listingQuality/categories', params);
  }

  async getItemQualityDetails(params?: {
    category?: string;
    limit?: number;
    offset?: number;
  }) {
    return await this.client.get('/v3/insights/items/listingQuality/items', params);
  }
}
