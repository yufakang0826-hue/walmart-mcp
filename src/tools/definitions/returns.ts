import { z } from 'zod';
import { SkuSchema, MoneySchema } from './shared-schemas.js';

// Walmart return line — used in approve/reject body.
// Each entry references one return order line.
const ReturnOrderLineSchema = z
  .object({
    returnOrderLineNumber: z.number().int().min(1),
    returnReason: z.string().optional(),
    actionType: z.enum(['APPROVE', 'REJECT', 'KEEP_IT']).optional(),
  })
  .passthrough();

const ApproveReturnBodySchema = z
  .object({
    returnOrderId: z.string().min(1, 'returnOrderId required'),
    returnOrderLines: z
      .array(ReturnOrderLineSchema)
      .min(1, 'Need at least 1 return order line to approve'),
  })
  .strict();

const RejectReturnBodySchema = z
  .object({
    returnOrderId: z.string().min(1, 'returnOrderId required'),
    returnOrderLines: z
      .array(
        ReturnOrderLineSchema.and(
          z.object({
            rejectionReason: z.string().min(1, 'rejectionReason required for each line'),
          }),
        ),
      )
      .min(1),
  })
  .strict();

// Refund charges per line.
const ChargeRefundSchema = z
  .object({
    chargeType: z.enum(['PRODUCT', 'SHIPPING', 'TAX', 'FEE']),
    chargeName: z.string().min(1),
    chargeAmount: MoneySchema,
    taxRefundAmount: MoneySchema.optional(),
  })
  .passthrough();

const RefundBodySchema = z
  .object({
    refundReason: z.string().min(1, 'refundReason required'),
    chargeRefunds: z
      .array(ChargeRefundSchema)
      .min(1, 'Need at least 1 charge refund entry'),
    sku: SkuSchema.optional(),
  })
  .passthrough();

// Generate return label body — typically empty or carrier preference.
const LabelBodySchema = z
  .object({
    carrierName: z.string().optional(),
    carrierId: z.string().optional(),
    methodCode: z.string().optional(),
  })
  .passthrough();

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
    description:
      'Approve a customer return request. Required for seller-fulfilled returns. Body must include ' +
      'returnOrderId and a non-empty returnOrderLines array.',
    inputSchema: {
      approvalData: ApproveReturnBodySchema,
    },
  },
  {
    name: 'walmart_reject_return',
    description:
      'Reject a customer return request. Each returnOrderLine must include a rejectionReason string.',
    inputSchema: {
      rejectionData: RejectReturnBodySchema,
    },
  },
  {
    name: 'walmart_issue_return_refund',
    description:
      'Issue a refund for a returned item. refundData requires refundReason and a non-empty ' +
      'chargeRefunds array. Refund amount cannot exceed the original charge.',
    inputSchema: {
      returnOrderId: z.string().describe('Return order ID'),
      itemId: z.string().describe('Return item ID to refund'),
      refundData: RefundBodySchema,
    },
  },
  {
    name: 'walmart_generate_return_label',
    description: 'Generate a prepaid return shipping label for a return item.',
    inputSchema: {
      returnOrderId: z.string().describe('Return order ID'),
      itemId: z.string().describe('Return item ID'),
      labelData: LabelBodySchema,
    },
  },
  {
    name: 'walmart_get_wfs_returns',
    description:
      'Get WFS (Walmart Fulfillment Services) returns by sending GET /v3/returns?isWFSEnabled=Y. ' +
      'For sellers without WFS enrollment, Walmart returns the same set as walmart_get_all_returns.',
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
