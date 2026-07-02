import { describe, it, expect, vi, beforeEach } from 'vitest';

function createMockClient() {
  return {
    get: vi.fn().mockResolvedValue({ data: 'ok' }),
    post: vi.fn().mockResolvedValue({ data: 'ok' }),
    put: vi.fn().mockResolvedValue({ data: 'ok' }),
    delete: vi.fn().mockResolvedValue({ data: 'ok' }),
  } as any;
}

describe('ReportsApi', () => {
  let client: any;
  let api: any;

  beforeEach(async () => {
    client = createMockClient();
    const { ReportsApi } = await import('../../src/api/reports/reports-api.js');
    api = new ReportsApi(client);
  });

  it('createReport should POST with query params and empty body (bodied POST 404s)', async () => {
    await api.createReport({ reportType: 'ITEM', reportVersion: 'v4' });
    expect(client.post).toHaveBeenCalledWith(
      '/v3/reports/reportRequests?reportType=ITEM&reportVersion=v4',
    );
  });

  it('getReportRequests should GET with params', async () => {
    await api.getReportRequests({ reportType: 'ITEM', reportVersion: 'v4' });
    expect(client.get).toHaveBeenCalledWith('/v3/reports/reportRequests', {
      reportType: 'ITEM',
      reportVersion: 'v4',
    });
  });

  it('getReportStatus should encode requestId in path', async () => {
    await api.getReportStatus('req/123');
    expect(client.get).toHaveBeenCalledWith('/v3/reports/reportRequests/req%2F123');
  });

  it('getReportStatus should throw on empty requestId', async () => {
    await expect(api.getReportStatus('')).rejects.toThrow(/requestId is required/i);
  });

  it('downloadReport should GET /v3/reports/downloadReport with params', async () => {
    await api.downloadReport({ requestId: 'R1' });
    expect(client.get).toHaveBeenCalledWith('/v3/reports/downloadReport', { requestId: 'R1' });
  });

  it('createReportSchedule should POST /v3/reports/schedules', async () => {
    await api.createReportSchedule({ cron: '0 0 * * *' });
    expect(client.post).toHaveBeenCalledWith('/v3/reports/schedules', { cron: '0 0 * * *' });
  });

  it('updateReportSchedule should PUT with encoded scheduleId', async () => {
    await api.updateReportSchedule('S 1', { active: true });
    expect(client.put).toHaveBeenCalledWith('/v3/reports/schedules/S%201', { active: true });
  });

  it('updateReportSchedule should throw on empty scheduleId', async () => {
    await expect(api.updateReportSchedule('', {})).rejects.toThrow(/scheduleId is required/i);
  });

  it('deleteReportSchedule should DELETE with encoded scheduleId', async () => {
    await api.deleteReportSchedule('S1');
    expect(client.delete).toHaveBeenCalledWith('/v3/reports/schedules/S1');
  });

  it('getUnpublishedItems should GET insights endpoint', async () => {
    await api.getUnpublishedItems({ limit: 20, offset: 0 });
    expect(client.get).toHaveBeenCalledWith('/v3/insights/items/unpublished', {
      limit: 20,
      offset: 0,
    });
  });

  it('getListingQuality should GET listingQuality/score', async () => {
    await api.getListingQuality({ category: 'Home' });
    expect(client.get).toHaveBeenCalledWith('/v3/insights/items/listingQuality/score', {
      category: 'Home',
    });
  });

  it('getQualityCategories should GET listingQuality/categories', async () => {
    await api.getQualityCategories();
    expect(client.get).toHaveBeenCalledWith('/v3/insights/items/listingQuality/categories', undefined);
  });

  it('getItemQualityDetails should GET listingQuality/items', async () => {
    await api.getItemQualityDetails({ category: 'Home', limit: 10 });
    expect(client.get).toHaveBeenCalledWith('/v3/insights/items/listingQuality/items', {
      category: 'Home',
      limit: 10,
    });
  });
});
