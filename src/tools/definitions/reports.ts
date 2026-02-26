import { z } from 'zod';

export const reportTools = [
  // ===== Report Requests =====
  {
    name: 'walmart_create_report',
    description: 'Request generation of a report. Types include: ITEM, BUYBOX, CANCELLATION, DELIVERY_DEFECT, CPA, ITEM_PERFORMANCE, RETURN_OVERRIDES, PROMO.',
    inputSchema: {
      reportData: z.record(z.string(), z.unknown()).describe('Report request details including reportType and optional filters'),
    },
  },
  {
    name: 'walmart_get_report_requests',
    description: 'List all report generation requests with optional filtering by type.',
    inputSchema: {
      reportType: z.string().optional().describe('Filter by report type'),
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
    description: 'Download a completed report. Report must be in READY status.',
    inputSchema: {
      requestId: z.string().optional().describe('Report request ID'),
      reportType: z.string().optional().describe('Report type to download the latest for'),
    },
  },

  // ===== Report Schedules =====
  {
    name: 'walmart_create_report_schedule',
    description: 'Create a recurring report schedule. Reports will be auto-generated on the specified frequency.',
    inputSchema: {
      scheduleData: z.record(z.string(), z.unknown()).describe('Schedule details including reportType, frequency, and optional filters'),
    },
  },
  {
    name: 'walmart_get_report_schedules',
    description: 'List all configured report schedules.',
    inputSchema: {
      reportType: z.string().optional().describe('Filter by report type'),
    },
  },
  {
    name: 'walmart_update_report_schedule',
    description: 'Update an existing report schedule configuration.',
    inputSchema: {
      scheduleId: z.string().describe('Report schedule ID to update'),
      scheduleData: z.record(z.string(), z.unknown()).describe('Updated schedule configuration'),
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
