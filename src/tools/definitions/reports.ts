import { z } from 'zod';
import { Iso8601UtcSchema } from './shared-schemas.js';

// Walmart on-demand report types.
const ReportTypeSchema = z.enum([
  'ITEM',
  'BUYBOX',
  'CANCELLATION',
  'DELIVERY_DEFECT',
  'CPA',
  'ITEM_PERFORMANCE',
  'RETURN_OVERRIDES',
  'PROMO',
  'INVENTORY',
  'SETTLEMENT',
  'PERFORMANCE',
  'ITEM_LISTING_AUDIT',
]);

// Recurring schedule frequencies.
const ScheduleFrequencySchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY']);

// Create-report body. reportType required, rest passthrough so we don't
// re-document every per-report-type filter set.
const CreateReportBodySchema = z
  .object({
    reportType: ReportTypeSchema.describe('Walmart report type'),
    reportVersion: z.string().optional().describe('Optional report version'),
    startDate: Iso8601UtcSchema.optional().describe('Date-range start (ISO 8601)'),
    endDate: Iso8601UtcSchema.optional().describe('Date-range end (ISO 8601)'),
  })
  .passthrough()
  .refine(
    (r) => !(r.startDate && r.endDate) || new Date(r.endDate).getTime() >= new Date(r.startDate).getTime(),
    { message: 'endDate must be >= startDate', path: ['endDate'] },
  );

const CreateScheduleBodySchema = z
  .object({
    reportType: ReportTypeSchema,
    reportVersion: z.string().optional(),
    frequency: ScheduleFrequencySchema,
    timeOfDay: z
      .string()
      .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'timeOfDay must be HH:MM (24-hour)')
      .optional(),
    dayOfWeek: z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
  })
  .passthrough();

export const reportTools = [
  // ===== Report Requests =====
  {
    name: 'walmart_create_report',
    description:
      'Request generation of a report. reportType is required; supported types: ITEM, BUYBOX, ' +
      'CANCELLATION, DELIVERY_DEFECT, CPA, ITEM_PERFORMANCE, RETURN_OVERRIDES, PROMO, INVENTORY, ' +
      'SETTLEMENT, PERFORMANCE, ITEM_LISTING_AUDIT. Most types also require reportVersion ' +
      '(e.g. ITEM → "v4"). Optional startDate/endDate (ISO 8601); per-type filters pass ' +
      'through (all sent as query parameters). The ITEM report is the authoritative backend ' +
      'source of full listing content per SKU (title, description, key features, images, ' +
      'attributes) — use it for content audits instead of scraping product pages. Returns a ' +
      'requestId; poll walmart_get_report_status.',
    inputSchema: {
      reportData: CreateReportBodySchema,
    },
  },
  {
    name: 'walmart_get_report_requests',
    description: 'List all report generation requests with optional filtering by type.',
    inputSchema: {
      reportType: ReportTypeSchema.optional().describe('Filter by report type'),
      reportVersion: z.string().optional().describe('Filter by report version'),
    },
  },
  {
    name: 'walmart_get_report_status',
    description: 'Check the status of a specific report request. Status: RECEIVED, INPROGRESS, READY, ERROR.',
    inputSchema: {
      requestId: z.string().describe('Report request ID'),
    },
  },
  {
    name: 'walmart_download_report',
    description:
      'Download a completed report (must be READY). By default this fetches the signed URL ' +
      'server-side, extracts the ZIP, and returns the CSV content inline ' +
      '({ content, header, rowCount }) — the raw downloadURL expires in ~18 minutes and is ' +
      'usually unreachable from AI sandboxes. Pass extract: false to get just the signed URL.',
    inputSchema: {
      requestId: z.string().optional().describe('Report request ID'),
      reportType: ReportTypeSchema.optional().describe('Report type to download the latest for'),
      extract: z
        .boolean()
        .optional()
        .describe('Fetch + unzip the report and return CSV inline (default true)'),
    },
    // Permissive shape hints for the auto-extract projection.
    outputSchema: {
      requestId: z.string().optional(),
      requestStatus: z.string().optional(),
      reportType: z.string().optional(),
      reportVersion: z.string().optional(),
      downloadURL: z.string().optional(),
      downloadURLExpirationTime: z.string().optional(),
      extracted: z.boolean().optional(),
      rowCount: z.number().optional(),
      header: z.string().optional(),
      content: z.string().optional(),
      extractError: z.string().optional(),
      hint: z.string().optional(),
    },
  },

  // ===== Report Schedules =====
  {
    name: 'walmart_create_report_schedule',
    description:
      'Create a recurring report schedule. Required: reportType + frequency (DAILY/WEEKLY/MONTHLY). ' +
      'Optional: timeOfDay (HH:MM 24h), dayOfWeek (MON-SUN), dayOfMonth (1-31). Walmart enforces ' +
      'reportType + frequency combinations.',
    inputSchema: {
      scheduleData: CreateScheduleBodySchema,
    },
  },
  {
    name: 'walmart_get_report_schedules',
    description: 'List all configured report schedules.',
    inputSchema: {
      reportType: ReportTypeSchema.optional().describe('Filter by report type'),
    },
  },
  {
    name: 'walmart_update_report_schedule',
    description: 'Update an existing report schedule configuration.',
    inputSchema: {
      scheduleId: z.string().describe('Report schedule ID to update'),
      scheduleData: CreateScheduleBodySchema,
    },
  },
  {
    name: 'walmart_delete_report_schedule',
    description: 'Delete a recurring report schedule.',
    inputSchema: {
      scheduleId: z.string().describe('Report schedule ID to delete'),
    },
  },

  // ===== Insights =====
  {
    name: 'walmart_get_unpublished_items',
    description: 'Get items that are not published on Walmart.com with reasons. Helps fix listing issues.',
    inputSchema: {
      limit: z.number().int().min(1).max(200).optional().describe('Results per page'),
      offset: z.number().int().min(0).optional().describe('Pagination offset'),
    },
  },
  {
    name: 'walmart_get_listing_quality',
    description: 'Get overall listing quality score. Higher scores improve search visibility and Buy Box win rate.',
    inputSchema: {
      category: z.string().optional().describe('Filter by category'),
    },
  },
  {
    name: 'walmart_get_quality_categories',
    description: 'Get listing quality issues grouped by category. Identifies which categories need improvement.',
    inputSchema: {
      limit: z.number().int().min(1).max(200).optional().describe('Results per page'),
      offset: z.number().int().min(0).optional().describe('Pagination offset'),
    },
  },
  {
    name: 'walmart_get_item_quality_details',
    description: 'Get item-level listing quality details. Shows specific quality issues per item for targeted fixes.',
    inputSchema: {
      category: z.string().optional().describe('Filter by category'),
      limit: z.number().int().min(1).max(200).optional().describe('Results per page'),
      offset: z.number().int().min(0).optional().describe('Pagination offset'),
    },
  },
];
