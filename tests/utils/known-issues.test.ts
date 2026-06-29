import { describe, it, expect } from 'vitest';
import { findKnownIssueHint, KNOWN_ISSUES } from '../../src/utils/known-issues.js';

describe('findKnownIssueHint', () => {
  // ---------- Insights ----------
  it('returns a hint for the unpublished-counts Aurora regression', () => {
    const hint = findKnownIssueHint('GET', '/v3/insights/items/unpublished/counts');
    expect(hint).toBeTruthy();
    expect(hint!).toMatch(/walmart_get_all_items/);
    expect(hint!).toMatch(/publishedStatus/);
  });

  it('returns a hint for the removed quality categories endpoint', () => {
    const hint = findKnownIssueHint('GET', '/v3/insights/items/listingQuality/categories');
    expect(hint).toBeTruthy();
    expect(hint!).toMatch(/walmart_get_listing_quality/);
  });

  it('returns a hint for the changed quality items endpoint', () => {
    const hint = findKnownIssueHint('GET', '/v3/insights/items/listingQuality/items');
    expect(hint).toBeTruthy();
    expect(hint!).toMatch(/walmart_get_listing_quality/);
  });

  // ---------- Returns ----------
  it('returns a hint for the removed returns/count endpoint', () => {
    const hint = findKnownIssueHint('GET', '/v3/returns/count');
    expect(hint).toBeTruthy();
    expect(hint!).toMatch(/walmart_get_all_returns/);
  });

  // ---------- Settings ----------
  it('returns a hint for the shipping settings 404', () => {
    const hint = findKnownIssueHint('GET', '/v3/settings/shipping');
    expect(hint).toBeTruthy();
    expect(hint!).toMatch(/Seller Center/);
  });

  // ---------- WFS program gating ----------
  it('returns a hint for WFS inbound-shipments program gating', () => {
    const hint = findKnownIssueHint('GET', '/v3/fulfillment/inbound-shipments');
    expect(hint).toBeTruthy();
    expect(hint!).toMatch(/Walmart Fulfillment Services/);
  });

  it('returns a hint for Ship with Walmart carriers', () => {
    const hint = findKnownIssueHint('GET', '/v3/fulfillment/carriers');
    expect(hint).toBeTruthy();
    expect(hint!).toMatch(/Ship with Walmart/);
  });

  // ---------- Repricer program gating ----------
  it('returns a hint for repricer GET (403 enrollment)', () => {
    const hint = findKnownIssueHint('GET', '/v3/repricer/strategies');
    expect(hint).toBeTruthy();
    expect(hint!).toMatch(/Repricer/);
  });

  it('returns a hint for repricer POST (403 enrollment)', () => {
    const hint = findKnownIssueHint('POST', '/v3/repricer/strategies');
    expect(hint).toBeTruthy();
    expect(hint!).toMatch(/enrolled/);
  });

  // ---------- Notifications ----------
  it('returns a hint for the webhooks allowlist gate', () => {
    const hint = findKnownIssueHint('GET', '/v3/notifications/subscriptions');
    expect(hint).toBeTruthy();
    expect(hint!).toMatch(/allowlist/i);
  });

  // ---------- Reports ----------
  it('returns a hint for expired report download URLs', () => {
    const hint = findKnownIssueHint('GET', '/v3/reports/reportRequests/abc123/download');
    expect(hint).toBeTruthy();
    expect(hint!).toMatch(/30 days|expired/i);
  });

  // ---------- Ads ----------
  it('returns a hint for Walmart Connect ads base path', () => {
    const hint = findKnownIssueHint('GET', '/api-proxy/service/WPA/Api/campaigns');
    expect(hint).toBeTruthy();
    expect(hint!).toMatch(/Walmart Connect/);
  });

  // ---------- Boilerplate behavior ----------
  it('is case-insensitive on the HTTP method', () => {
    expect(findKnownIssueHint('get', '/v3/returns/count')).toBeTruthy();
    expect(findKnownIssueHint('GET', '/v3/returns/count')).toBeTruthy();
  });

  it('returns undefined for unknown endpoints', () => {
    expect(findKnownIssueHint('GET', '/v3/items')).toBeUndefined();
    expect(findKnownIssueHint('POST', '/v3/feeds')).toBeUndefined();
  });

  it('returns undefined when method or URL is missing', () => {
    expect(findKnownIssueHint(undefined, '/v3/returns/count')).toBeUndefined();
    expect(findKnownIssueHint('GET', undefined)).toBeUndefined();
    expect(findKnownIssueHint('', '')).toBeUndefined();
  });

  it('does not match when method differs from registered entry', () => {
    // unpublished-counts is registered as GET; POST should not hit.
    expect(findKnownIssueHint('POST', '/v3/insights/items/unpublished/counts')).toBeUndefined();
  });

  it('matches by regex even with trailing path segments / query suffix logic', () => {
    expect(findKnownIssueHint('GET', '/v3/insights/items/unpublished/counts/extra')).toBeTruthy();
  });
});

describe('KNOWN_ISSUES table', () => {
  it('contains at least 12 documented entries', () => {
    expect(KNOWN_ISSUES.length).toBeGreaterThanOrEqual(12);
  });

  it('has every entry with method, pathPattern and hint', () => {
    for (const issue of KNOWN_ISSUES) {
      expect(issue.method).toMatch(/^(GET|POST|PUT|DELETE|PATCH)$/);
      expect(issue.pathPattern).toBeInstanceOf(RegExp);
      expect(issue.hint.length).toBeGreaterThan(20);
    }
  });

  it('has unique (method, pathPattern.source) tuples', () => {
    const keys = new Set<string>();
    for (const issue of KNOWN_ISSUES) {
      const key = `${issue.method}::${issue.pathPattern.source}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
  });
});
