import { z } from 'zod';

export const returnTools = [
  {
    name: 'walmart_get_all_returns',
    description: 'Get all returns with optional filters. Returns include status, reason, and refund details.',
    inputSchema: {
      limit: z.number().int().min(1).max(200).optional().describe('Results per page'),
      offset: z.number().int().min(0).optional().describe('Pagination offset'),
      status: z.string().optional().describe('Filter by return status'),
      returnCreationStartDate: z.string().optional().describe('Start date filter (ISO 8601)'),
      returnCreationEndDate: z.string().optional().describe('End date filter (ISO 8601)'),
      customerOrderId: z.string().optional().describe('Filter by customer order ID'),
    },
  },
  {
    name: 'walmart_get_return',
    description: 'Get a single return by return order ID. Returns full details including items, reason, and refund info.',
    inputSchema: {
      returnOrderId: z.string().describe('Return order ID'),
    },
  },
  {
    name: 'walmart_approve_return',
    description: 'Approve a customer return request. Required for seller-fulfilled returns.',
    inputSchema: {
      approvalData: z.record(z.string(), z.unknown()).describe('Return approval details including returnOrderId and items'),
    },
  },
  {
    name: 'walmart_reject_return',
    description: 'Reject a customer return request with a reason.',
    inputSchema: {
      rejectionData: z.record(z.string(), z.unknown()).describe('Return rejection details including returnOrderId, items, and reason'),
    },
  },
  {
    name: 'walmart_issue_return_refund',
    description: 'Issue a refund for a returned item. Refund amount cannot exceed the original charge.',
    inputSchema: {
      returnOrderId: z.string().describe('Return order ID'),
      itemId: z.string().describe('Return item ID to refund'),
      refundData: z.record(z.string(), z.unknown()).describe('Refund details including amount'),
    },
  },
  {
    name: 'walmart_generate_return_label',
    description: 'Generate a prepaid return shipping label for a return item.',
    inputSchema: {
      returnOrderId: z.string().describe('Return order ID'),
      itemId: z.string().describe('Return item ID'),
      labelData: z.record(z.string(), z.unknown()).describe('Label generation details'),
    },
  },
  {
    name: 'walmart_get_wfs_returns',
    description: 'Get WFS (Walmart Fulfillment Services) returns. These are view-only as Walmart handles WFS returns.',
    inputSchema: {
      limit: z.number().int().min(1).max(200).optional().describe('Results per page'),
      offset: z.number().int().min(0).optional().describe('Pagination offset'),
    },
  },
  {
    name: 'walmart_get_return_count',
    description: 'Get count of returns grouped by status. Useful for dashboard metrics.',
    inputSchema: {
      status: z.string().optional().describe('Filter by return status'),
    },
  },
];
