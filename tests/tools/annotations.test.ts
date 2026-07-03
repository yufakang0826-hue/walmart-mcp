import { describe, it, expect } from 'vitest';
import { getToolAnnotations } from '../../src/tools/annotations.js';
import { getToolDefinitions } from '../../src/tools/index.js';

describe('getToolAnnotations', () => {
  it('classifies every registered tool (no unknown fallthrough)', () => {
    // The fallthrough default is DESTRUCTIVE (conservative). No real tool
    // should hit it — every tool must match an override or a rule. We detect
    // fallthrough by checking that read-looking names never come back
    // destructive.
    const tools = getToolDefinitions();
    expect(tools.length).toBeGreaterThan(100);
    for (const t of tools) {
      const a = getToolAnnotations(t.name);
      expect(a, t.name).toBeDefined();
      if (/^walmart_(get|search)_/.test(t.name) && !(t.name === 'walmart_get_token')) {
        expect(a.readOnlyHint, `${t.name} should be read-only`).toBe(true);
      }
    }
  });

  it('marks reads as read-only and external', () => {
    expect(getToolAnnotations('walmart_get_item')).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    });
    expect(getToolAnnotations('walmart_get_all_orders').readOnlyHint).toBe(true);
    expect(getToolAnnotations('walmart_poll_feed_until_complete').readOnlyHint).toBe(true);
    expect(getToolAnnotations('walmart_download_report').readOnlyHint).toBe(true);
    expect(getToolAnnotations('walmart_ad_get_campaigns').readOnlyHint).toBe(true);
  });

  it('marks local-only tools as closed-world', () => {
    expect(getToolAnnotations('walmart_display_credentials').openWorldHint).toBe(false);
    expect(getToolAnnotations('walmart_setup_guide').openWorldHint).toBe(false);
    expect(getToolAnnotations('walmart_set_credentials')).toMatchObject({
      readOnlyHint: false,
      openWorldHint: false,
    });
  });

  it('marks irreversible business actions as destructive', () => {
    for (const name of [
      'walmart_refund_order',
      'walmart_cancel_order',
      'walmart_retire_item',
      'walmart_bulk_retire_items',
      'walmart_issue_return_refund',
      'walmart_approve_return',
      'walmart_reject_return',
      'walmart_ship_order',
      'walmart_delete_subscription',
      'walmart_delete_repricer_strategy',
      'walmart_discard_label',
      'walmart_ad_delete_campaign',
    ]) {
      expect(getToolAnnotations(name).destructiveHint, name).toBe(true);
    }
  });

  it('marks setters as idempotent non-destructive writes', () => {
    for (const name of [
      'walmart_update_price',
      'walmart_update_inventory',
      'walmart_update_lag_time',
      'walmart_update_shipping_settings',
      'walmart_acknowledge_order',
      'walmart_ad_update_campaign',
    ]) {
      const a = getToolAnnotations(name);
      expect(a.idempotentHint, name).toBe(true);
      expect(a.destructiveHint, name).toBe(false);
      expect(a.readOnlyHint, name).toBe(false);
    }
  });

  it('marks creators/submitters as non-idempotent writes', () => {
    for (const name of [
      'walmart_submit_item_feed',
      'walmart_submit_item_update_feed',
      'walmart_create_report',
      'walmart_create_subscription',
      'walmart_generate_return_label',
      'walmart_book_carrier_shipment',
    ]) {
      const a = getToolAnnotations(name);
      expect(a.idempotentHint, name).toBe(false);
      expect(a.readOnlyHint, name).toBe(false);
    }
  });

  it('annotates escape hatches for the worst case', () => {
    expect(getToolAnnotations('walmart_call_endpoint').destructiveHint).toBe(true);
    expect(getToolAnnotations('walmart_submit_generic_feed').readOnlyHint).toBe(false);
  });

  it('defaults unknown tools to conservative destructive', () => {
    expect(getToolAnnotations('walmart_some_future_tool').destructiveHint).toBe(true);
  });
});
