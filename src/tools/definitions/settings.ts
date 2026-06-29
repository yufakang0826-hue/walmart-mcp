import { z } from 'zod';

// Walmart shipping-settings payload structure (per Walmart docs):
//   { shippingTemplates: [{ templateName, methods: [...] }] }
// Method enum / region structure varies — we gate the envelope.
const ShippingTemplateSchema = z
  .object({
    templateName: z.string().min(1).max(100),
    isDefault: z.boolean().optional(),
    methods: z
      .array(
        z
          .object({
            methodCode: z.enum(['Standard', 'Expedited', 'OneDay', 'TwoDay', 'Freight', 'Value']),
            transitTime: z.number().int().min(0).max(99).optional(),
            isActive: z.boolean().default(true),
          })
          .passthrough(),
      )
      .min(1, 'Each shipping template must have at least 1 method'),
  })
  .passthrough();

const ShippingSettingsBodySchema = z
  .object({
    shippingTemplates: z
      .array(ShippingTemplateSchema)
      .min(1, 'Need at least 1 shipping template'),
  })
  .strict();

export const settingsTools = [
  {
    name: 'walmart_get_shipping_settings',
    description: 'Get current shipping configuration including shipping methods, transit times, and regions.',
    inputSchema: {},
  },
  {
    name: 'walmart_update_shipping_settings',
    description:
      'Update shipping configuration. Body: { shippingTemplates: [{ templateName, methods: ' +
      '[{ methodCode, transitTime?, isActive? }] }] }. methodCode must be one of Standard, ' +
      'Expedited, OneDay, TwoDay, Freight, Value.',
    inputSchema: {
      settingsData: ShippingSettingsBodySchema,
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
