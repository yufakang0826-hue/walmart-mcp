import { inflateRawSync } from 'zlib';
import { WalmartApiClient } from '../client.js';

/**
 * Extract the first file entry from a ZIP archive (Walmart report ZIPs
 * contain exactly one CSV). Supports stored (0) and deflate (8) methods —
 * no external unzip dependency needed.
 */
export function extractFirstZipEntry(zip: Buffer): string {
  // ZIP local file header signature: PK\x03\x04
  if (zip.length < 30 || zip.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('Not a ZIP archive (missing PK local file header)');
  }
  const method = zip.readUInt16LE(8);
  const flags = zip.readUInt16LE(6);
  let compressedSize = zip.readUInt32LE(18);
  const nameLen = zip.readUInt16LE(26);
  const extraLen = zip.readUInt16LE(28);
  const dataStart = 30 + nameLen + extraLen;

  // Bit 3 set → sizes live in the data descriptor after the payload. Locate
  // the central directory entry instead, which always has the real size.
  if ((flags & 0x08) !== 0 || compressedSize === 0xffffffff || compressedSize === 0) {
    const cdSig = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
    const cdOffset = zip.indexOf(cdSig);
    if (cdOffset > 0) compressedSize = zip.readUInt32LE(cdOffset + 20);
    else compressedSize = zip.length - dataStart; // best effort
  }

  const data = zip.subarray(dataStart, dataStart + compressedSize);
  if (method === 0) return data.toString('utf-8');
  if (method === 8) return inflateRawSync(data).toString('utf-8');
  throw new Error(`Unsupported ZIP compression method: ${method}`);
}

export class ReportsApi {
  constructor(private client: WalmartApiClient) {}

  // ===== Report Requests =====

  async createReport(data: object) {
    // Walmart's on-request report API takes ALL parameters as query string
    // with an empty POST body. A bodied POST without query params 404s with
    // "No static resource v3/reports/reportRequests" (same gateway behavior
    // as /v3/feeds). Verified against production 2026-07-02.
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (value !== undefined && value !== null) params.set(key, String(value));
    }
    return await this.client.post(`/v3/reports/reportRequests?${params.toString()}`);
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
    extract?: boolean;
  }) {
    const { extract, ...query } = params;
    const status = (await this.client.get('/v3/reports/downloadReport', query)) as {
      downloadURL?: string;
      [key: string]: unknown;
    };

    // By default, fetch the signed URL and return the extracted CSV inline.
    // The bare downloadURL is nearly useless to an AI caller: it expires in
    // ~18 minutes and most MCP client sandboxes cannot fetch it themselves.
    if (extract === false || !status.downloadURL) return status;

    try {
      const zipBytes = await this.client.getBinary(status.downloadURL);
      const csv = extractFirstZipEntry(zipBytes);
      const lines = csv.split(/\r?\n/).filter((l) => l.length > 0);
      return {
        ...status,
        extracted: true,
        rowCount: Math.max(0, lines.length - 1),
        header: lines[0] ?? '',
        content: csv,
      };
    } catch (error) {
      // Fall back to URL-only response rather than failing the call.
      return {
        ...status,
        extracted: false,
        extractError: String(error),
        hint: 'Automatic extraction failed - download the downloadURL manually before it expires.',
      };
    }
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
