import { z } from 'zod';

export const notificationTools = [
  {
    name: 'walmart_create_subscription',
    description: 'Create a webhook subscription for event notifications. Events: PO_CREATED, PO_LINE_AUTOCANCELLED, OFFER_UNPUBLISHED, BUYBOX_CHANGED, etc.',
    inputSchema: {
      subscriptionData: z.record(z.string(), z.unknown()).describe('Subscription details including eventType, destinationUrl, and optional filters'),
    },
  },
  {
    name: 'walmart_get_subscriptions',
    description: 'List all webhook subscriptions with optional event type filter.',
    inputSchema: {
      eventType: z.string().optional().describe('Filter by event type'),
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
      subscriptionData: z.record(z.string(), z.unknown()).describe('Updated subscription configuration'),
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
