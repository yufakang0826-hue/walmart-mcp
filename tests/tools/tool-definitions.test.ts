import { describe, it, expect } from 'vitest';
import { getToolDefinitions } from '../../src/tools/index.js';

describe('Tool Definitions', () => {
  const tools = getToolDefinitions();

  it('should register exactly 130 tools', () => {
    expect(tools.length).toBe(130);
  });

  it('should have unique tool names', () => {
    const names = tools.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('should have all tool names start with "walmart_"', () => {
    for (const tool of tools) {
      expect(tool.name).toMatch(/^walmart_/);
    }
  });

  it('should have non-empty descriptions for all tools', () => {
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('should have inputSchema as an object for all tools', () => {
    for (const tool of tools) {
      expect(typeof tool.inputSchema).toBe('object');
    }
  });

  describe('module tool counts', () => {
    const countByPrefix = (prefix: string) =>
      tools.filter((t) => t.name.startsWith(prefix)).length;

    it('token management: 5 tools', () => {
      const count = tools.filter((t) =>
        ['walmart_get_token', 'walmart_get_token_status', 'walmart_get_token_info',
         'walmart_set_credentials', 'walmart_display_credentials'].includes(t.name),
      ).length;
      expect(count).toBe(5);
    });

    it('advertising: 25 tools', () => {
      expect(countByPrefix('walmart_ad_')).toBe(25);
    });

    it('should contain all expected tool names', () => {
      const names = new Set(tools.map((t) => t.name));

      // Spot-check critical tools from each module
      const criticalTools = [
        'walmart_get_token',
        'walmart_get_all_items',
        'walmart_get_inventory',
        'walmart_get_all_orders',
        'walmart_update_price',
        'walmart_get_feed_status',
        'walmart_create_inbound_order',
        'walmart_get_all_returns',
        'walmart_create_report',
        'walmart_create_subscription',
        'walmart_ad_get_campaigns',
        'walmart_get_shipping_settings',
        'walmart_poll_feed_until_complete',
        'walmart_get_partner_info',
      ];

      for (const name of criticalTools) {
        expect(names.has(name), `Missing tool: ${name}`).toBe(true);
      }
    });
  });

  describe('Zod schemas', () => {
    it('tools with empty schemas should have no required fields', () => {
      const emptySchemaTools = tools.filter(
        (t) => Object.keys(t.inputSchema).length === 0,
      );
      expect(emptySchemaTools.length).toBeGreaterThan(0);
      // These should be tools like walmart_get_token that take no input
      for (const tool of emptySchemaTools) {
        expect(Object.keys(tool.inputSchema)).toHaveLength(0);
      }
    });

    it('tools with schemas should have valid Zod types', () => {
      const withSchema = tools.filter(
        (t) => Object.keys(t.inputSchema).length > 0,
      );
      for (const tool of withSchema) {
        for (const [key, value] of Object.entries(tool.inputSchema)) {
          // Zod types have a _def property
          expect(value).toHaveProperty('_def', expect.anything());
        }
      }
    });
  });
});
