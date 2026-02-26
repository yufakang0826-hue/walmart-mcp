import { z } from 'zod';

export const settingsTools = [
  {
    name: 'walmart_get_shipping_settings',
    description: 'Get current shipping configuration including shipping methods, transit times, and regions.',
    inputSchema: {},
  },
  {
    name: 'walmart_update_shipping_settings',
    description: 'Update shipping configuration (methods, transit times, regions, shipping templates).',
    inputSchema: {
      settingsData: z.record(z.string(), z.unknown()).describe('Updated shipping settings'),
    },
  },
  {
    name: 'walmart_get_fulfillment_centers',
    description: 'Get list of configured fulfillment centers (ship nodes) with addresses and capabilities.',
    inputSchema: {},
  },
  {
    name: 'walmart_get_partner_info',
    description: 'Get Walmart partner account information including seller ID, status, and onboarding state.',
    inputSchema: {},
  },
];
