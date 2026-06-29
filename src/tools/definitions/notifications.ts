import { z } from 'zod';

const WalmartEventTypeSchema = z.enum([
  'PO_CREATED',
  'PO_LINE_AUTOCANCELLED',
  'OFFER_UNPUBLISHED',
  'BUYBOX_CHANGED',
  'PRICE_CHANGED',
  'INVENTORY_CHANGED',
  'RETURN_CREATED',
  'ITEM_PUBLISHED',
  'ITEM_UNPUBLISHED',
]);

const SubscriptionBodySchema = z
  .object({
    eventType: WalmartEventTypeSchema,
    destinationUrl: z
      .string()
      .url('destinationUrl must be a valid HTTPS URL'),
    format: z.enum(['JSON', 'XML']).default('JSON'),
    isActive: z.boolean().default(true),
  })
  .passthrough()
  .refine((s) => s.destinationUrl.startsWith('https://'), {
    message: 'Walmart requires HTTPS for webhook destinations',
    path: ['destinationUrl'],
  });

export const notificationTools = [
  {
    name: 'walmart_create_subscription',
    description:
      'Create a webhook subscription for event notifications. Required: eventType + destinationUrl ' +
      '(HTTPS only). Events: PO_CREATED, PO_LINE_AUTOCANCELLED, OFFER_UNPUBLISHED, BUYBOX_CHANGED, ' +
      'PRICE_CHANGED, INVENTORY_CHANGED, RETURN_CREATED, ITEM_PUBLISHED, ITEM_UNPUBLISHED.',
    inputSchema: {
      subscriptionData: SubscriptionBodySchema,
    },
  },
  {
    name: 'walmart_get_subscriptions',
    description: 'List all webhook subscriptions with optional event type filter.',
    inputSchema: {
      eventType: WalmartEventTypeSchema.optional().describe('Filter by event type'),
    },
  },
  {
    name: 'walmart_get_subscription',
    description: 'Get details of a specific webhook subscription.',
    inputSchema: {
      subscriptionId: z.string().describe('Subscription ID'),
    },
  },
  {
    name: 'walmart_update_subscription',
    description: 'Update an existing webhook subscription (e.g., change URL or status).',
    inputSchema: {
      subscriptionId: z.string().describe('Subscription ID to update'),
      subscriptionData: SubscriptionBodySchema,
    },
  },
  {
    name: 'walmart_delete_subscription',
    description: 'Delete a webhook subscription. Events will no longer be sent to the destination URL.',
    inputSchema: {
      subscriptionId: z.string().describe('Subscription ID to delete'),
    },
  },
  {
    name: 'walmart_test_subscription',
    description: 'Send a test event to a webhook subscription to verify the endpoint is working correctly.',
    inputSchema: {
      subscriptionId: z.string().describe('Subscription ID to test'),
    },
  },
];
