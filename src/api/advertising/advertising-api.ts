import { WalmartAdClient } from './ad-client.js';

export class AdvertisingApi {
  constructor(private client: WalmartAdClient) {}

  // ===== Campaigns =====

  async getCampaigns(params?: {
    campaignId?: number;
    status?: string;
    name?: string;
  }) {
    return await this.client.get('/v1/campaigns', params);
  }

  async createCampaign(data: object) {
    return await this.client.post('/v1/campaigns', data);
  }

  async updateCampaign(data: object) {
    return await this.client.put('/v1/campaigns', data);
  }

  async deleteCampaign(data: object) {
    return await this.client.put('/v1/campaigns/delete', data);
  }

  // ===== Ad Groups =====

  async getAdGroups(params?: {
    campaignId?: number;
    adGroupId?: number;
  }) {
    return await this.client.get('/v1/adGroups', params);
  }

  async createAdGroups(data: object) {
    return await this.client.post('/v1/adGroups', data);
  }

  async updateAdGroups(data: object) {
    return await this.client.put('/v1/adGroups', data);
  }

  // ===== Ad Items =====

  async getAdItems(params?: {
    campaignId?: number;
    adGroupId?: number;
    status?: string;
  }) {
    return await this.client.get('/v1/adItems', params);
  }

  async addAdItems(data: object) {
    return await this.client.post('/v1/adItems', data);
  }

  async updateAdItems(data: object) {
    return await this.client.put('/v1/adItems', data);
  }

  // ===== Keywords =====

  async getKeywords(params?: {
    campaignId?: number;
    adGroupId?: number;
    keywordId?: number;
  }) {
    return await this.client.get('/v1/keywords', params);
  }

  async addKeywords(data: object) {
    return await this.client.post('/v1/keywords', data);
  }

  async updateKeywords(data: object) {
    return await this.client.put('/v1/keywords', data);
  }

  async getKeywordAnalytics(data: object) {
    return await this.client.post('/v1/keywords/analytics', data);
  }

  // ===== Bid Multipliers =====

  async createPlacementBids(data: object) {
    return await this.client.post('/v1/bid-multipliers/placement', data);
  }

  async getPlacementBids(params?: {
    campaignId?: number;
  }) {
    return await this.client.get('/v1/bid-multipliers/placement', params);
  }

  async createPlatformBids(data: object) {
    return await this.client.post('/v1/bid-multipliers/platform', data);
  }

  // ===== Reports & Stats =====

  async createReportSnapshot(data: object) {
    return await this.client.post('/v2/snapshots/reports', data);
  }

  async getReportSnapshots(params?: {
    snapshotId?: string;
    reportType?: string;
  }) {
    return await this.client.get('/v2/snapshots/reports', params);
  }

  async getRealtimeStats(data: object) {
    return await this.client.post('/v1/stats', data);
  }

  async getLatestReportDate() {
    return await this.client.get('/v1/latest-report-date');
  }

  // ===== Recommendations & Insights =====

  async getItemRecommendations(data: object) {
    return await this.client.post('/v1/recommendations/items', data);
  }

  async getKeywordRecommendations(data: object) {
    return await this.client.post('/v1/recommendations/keywords', data);
  }

  async getSearchTrends(data: object) {
    return await this.client.post('/v1/insights/top-search-trends', data);
  }

  // ===== Sponsored Brands =====

  async getSbaProfile() {
    return await this.client.get('/v2/sba_profile');
  }
}
