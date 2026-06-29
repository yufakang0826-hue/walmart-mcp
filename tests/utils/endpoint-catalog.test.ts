import { describe, it, expect } from 'vitest';
import { searchEndpoints, ENDPOINT_CATALOG } from '../../src/utils/endpoint-catalog.js';

describe('searchEndpoints', () => {
  it('finds the right wrapped tool for "feed status"', () => {
    const matches = searchEndpoints('feed status');
    expect(matches.length).toBeGreaterThan(0);
    const tools = matches.map((m) => m.wrappedTool);
    expect(tools).toContain('walmart_get_feed_status');
  });

  it('finds "promo" / "promotion" / "discount" via tags', () => {
    const matches = searchEndpoints('promo');
    expect(matches[0]!.wrappedTool).toBe('walmart_submit_promo_price_feed');
  });

  it('ranks higher-scoring matches first', () => {
    const matches = searchEndpoints('inventory');
    expect(matches.length).toBeGreaterThan(0);
    // First entry should be inventory-related.
    expect(matches[0]!.tags.some((t) => t.toLowerCase().includes('inventory'))).toBe(true);
  });

  it('returns [] for empty query', () => {
    expect(searchEndpoints('')).toEqual([]);
    expect(searchEndpoints('   ')).toEqual([]);
  });

  it('returns [] when nothing matches', () => {
    expect(searchEndpoints('xenomorph-quintessence-zzz')).toEqual([]);
  });

  it('honors limit', () => {
    const matches = searchEndpoints('order', 2);
    expect(matches.length).toBeLessThanOrEqual(2);
  });

  it('multi-token queries combine scores (AND-ish)', () => {
    // "return refund" should rank issue_return_refund highest.
    const matches = searchEndpoints('return refund');
    expect(matches[0]!.wrappedTool).toBe('walmart_issue_return_refund');
  });
});

describe('ENDPOINT_CATALOG integrity', () => {
  it('every entry has tags + signature + description', () => {
    for (const entry of ENDPOINT_CATALOG) {
      expect(entry.tags.length).toBeGreaterThan(0);
      expect(entry.signature.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('has at least 30 entries spanning major modules', () => {
    expect(ENDPOINT_CATALOG.length).toBeGreaterThanOrEqual(30);
  });

  it('wrapped tool names follow walmart_ prefix convention', () => {
    for (const entry of ENDPOINT_CATALOG) {
      if (entry.wrappedTool) expect(entry.wrappedTool).toMatch(/^walmart_/);
    }
  });
});
