import { describe, it, expect, vi, beforeEach } from 'vitest';

function createMockAdClient() {
  return {
    get: vi.fn().mockResolvedValue({ data: 'ok' }),
    post: vi.fn().mockResolvedValue({ data: 'ok' }),
    put: vi.fn().mockResolvedValue({ data: 'ok' }),
    delete: vi.fn().mockResolvedValue({ data: 'ok' }),
  } as any;
}

describe('AdvertisingApi', () => {
  let client: any;
  let api: any;

  beforeEach(async () => {
    client = createMockAdClient();
    const { AdvertisingApi } = await import('../../src/api/advertising/advertising-api.js');
    api = new AdvertisingApi(client);
  });

  it('getCampaigns should GET /v1/campaigns with params', async () => {
    await api.getCampaigns({ status: 'enabled' });
    expect(client.get).toHaveBeenCalledWith('/v1/campaigns', { status: 'enabled' });
  });

  it('createCampaign should POST /v1/campaigns', async () => {
    await api.createCampaign({ name: 'Q4' });
    expect(client.post).toHaveBeenCalledWith('/v1/campaigns', { name: 'Q4' });
  });

  it('updateCampaign should PUT /v1/campaigns', async () => {
    await api.updateCampaign({ campaignId: 1 });
    expect(client.put).toHaveBeenCalledWith('/v1/campaigns', { campaignId: 1 });
  });

  it('deleteCampaign should PUT /v1/campaigns/delete', async () => {
    await api.deleteCampaign({ campaignId: 1 });
    expect(client.put).toHaveBeenCalledWith('/v1/campaigns/delete', { campaignId: 1 });
  });

  it('getAdGroups should GET /v1/adGroups', async () => {
    await api.getAdGroups({ campaignId: 1 });
    expect(client.get).toHaveBeenCalledWith('/v1/adGroups', { campaignId: 1 });
  });

  it('addKeywords should POST /v1/keywords', async () => {
    await api.addKeywords({ keywords: [] });
    expect(client.post).toHaveBeenCalledWith('/v1/keywords', { keywords: [] });
  });

  it('getKeywordAnalytics should POST /v1/keywords/analytics', async () => {
    await api.getKeywordAnalytics({ keywordIds: [1] });
    expect(client.post).toHaveBeenCalledWith('/v1/keywords/analytics', { keywordIds: [1] });
  });

  it('createPlacementBids should POST /v1/bid-multipliers/placement', async () => {
    await api.createPlacementBids({ bids: [] });
    expect(client.post).toHaveBeenCalledWith('/v1/bid-multipliers/placement', { bids: [] });
  });

  it('createPlatformBids should POST /v1/bid-multipliers/platform', async () => {
    await api.createPlatformBids({ bids: [] });
    expect(client.post).toHaveBeenCalledWith('/v1/bid-multipliers/platform', { bids: [] });
  });

  it('createReportSnapshot should POST /v2/snapshots/reports', async () => {
    await api.createReportSnapshot({ reportType: 'keyword' });
    expect(client.post).toHaveBeenCalledWith('/v2/snapshots/reports', { reportType: 'keyword' });
  });

  it('getRealtimeStats should POST /v1/stats', async () => {
    await api.getRealtimeStats({ campaignId: 1 });
    expect(client.post).toHaveBeenCalledWith('/v1/stats', { campaignId: 1 });
  });

  it('getLatestReportDate should GET /v1/latest-report-date', async () => {
    await api.getLatestReportDate();
    expect(client.get).toHaveBeenCalledWith('/v1/latest-report-date');
  });

  it('getSearchTrends should POST /v1/insights/top-search-trends', async () => {
    await api.getSearchTrends({ category: 'Home' });
    expect(client.post).toHaveBeenCalledWith('/v1/insights/top-search-trends', { category: 'Home' });
  });

  it('getSbaProfile should GET /v2/sba_profile', async () => {
    await api.getSbaProfile();
    expect(client.get).toHaveBeenCalledWith('/v2/sba_profile');
  });
});
