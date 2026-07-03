/**
 * Shared zod atom schemas used across multiple write tools.
 *
 * Keep this file conservative — only schemas that genuinely repeat across
 * 2+ tools belong here. If a schema is unique to one tool's feed body,
 * keep it inline in that tool's definition file.
 */

import { z } from 'zod';

// ---------- Identifier atoms ----------

/**
 * Seller-defined SKU. Walmart allows up to 50 chars. Spaces ARE legal —
 * production catalogs contain SKUs like "SDF-1140477 P" and
 * "MXJ-DJI OSMO Action6/5 Pro" (verified 2026-07-02, when the stricter
 * regex blocked a bulk relist of real SKUs).
 */
export const SkuSchema = z
  .string()
  .min(1, 'SKU cannot be empty')
  .max(50, 'SKU max 50 chars')
  .regex(/^[A-Za-z0-9._\-:/+ ]+$/, 'SKU may only contain letters, digits, spaces, and . _ - : / +')
  .refine((s) => s.trim() === s, { message: 'SKU cannot have leading/trailing spaces' });

/** GTIN / UPC / EAN — Walmart accepts 8 / 12 / 13 / 14 digit numeric strings. */
export const GtinSchema = z
  .string()
  .regex(/^[0-9]{8,14}$/, 'GTIN must be 8-14 digit numeric');

/** Walmart ship node ID. Numeric string in practice but kept as string for safety. */
export const ShipNodeSchema = z.string().min(1).max(50);

// ---------- Money / time atoms ----------

export const Iso4217CurrencySchema = z
  .enum(['USD', 'MXN', 'CAD', 'CLP'])
  .describe('ISO 4217 currency. us->USD, mx->MXN, ca->CAD, cl->CLP.');

export const MoneySchema = z
  .object({
    currency: Iso4217CurrencySchema,
    amount: z.number().positive('Money amount must be positive'),
  })
  .strict();

export const Iso8601UtcSchema = z
  .string()
  .datetime({ offset: true })
  .describe('ISO 8601 UTC datetime, e.g. 2026-06-01T00:00:00Z');

// ---------- Inventory / quantity atoms ----------

/** Walmart inventory unit. EACH is overwhelmingly the common value. */
export const QuantityUnitSchema = z.enum(['EACH', 'CASE']);

export const QuantitySchema = z
  .object({
    unit: QuantityUnitSchema.default('EACH'),
    amount: z.number().int('Quantity amount must be integer').min(0, 'Quantity cannot be negative'),
  })
  .strict();

// ---------- Feed-control atoms ----------

/** Most feed entries support an UPSERT/DELETE process mode. */
export const ProcessModeSchema = z.enum(['UPSERT', 'DELETE']).default('UPSERT');
