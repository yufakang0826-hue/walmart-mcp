import { describe, it, expect } from 'vitest';
import {
  SkuSchema,
  GtinSchema,
  ShipNodeSchema,
  Iso4217CurrencySchema,
  MoneySchema,
  Iso8601UtcSchema,
  QuantitySchema,
  QuantityUnitSchema,
  ProcessModeSchema,
} from '../../src/tools/definitions/shared-schemas.js';

describe('SkuSchema', () => {
  it('accepts normal SKUs', () => {
    expect(SkuSchema.parse('ABC-123')).toBe('ABC-123');
    expect(SkuSchema.parse('SKU.WITH.DOTS')).toBe('SKU.WITH.DOTS');
    expect(SkuSchema.parse('a_b-c.d:e/f+g')).toBe('a_b-c.d:e/f+g');
  });

  it('rejects empty SKU', () => {
    expect(() => SkuSchema.parse('')).toThrow();
  });

  it('rejects SKU over 50 chars', () => {
    expect(() => SkuSchema.parse('x'.repeat(51))).toThrow();
  });

  it('rejects SKU with forbidden characters', () => {
    expect(() => SkuSchema.parse('SKU WITH SPACE')).toThrow();
    expect(() => SkuSchema.parse('SKU#HASH')).toThrow();
    expect(() => SkuSchema.parse('SKU@AT')).toThrow();
  });
});

describe('GtinSchema', () => {
  it('accepts 8/12/13/14-digit GTINs', () => {
    expect(GtinSchema.parse('00123456')).toBe('00123456');
    expect(GtinSchema.parse('123456789012')).toBe('123456789012');
    expect(GtinSchema.parse('1234567890123')).toBe('1234567890123');
    expect(GtinSchema.parse('00755225111344')).toBe('00755225111344');
  });

  it('rejects non-numeric and short/long GTINs', () => {
    expect(() => GtinSchema.parse('1234567')).toThrow();
    expect(() => GtinSchema.parse('123456789012345')).toThrow();
    expect(() => GtinSchema.parse('1234567A')).toThrow();
  });
});

describe('Iso4217CurrencySchema', () => {
  it('accepts the 4 supported markets', () => {
    expect(Iso4217CurrencySchema.parse('USD')).toBe('USD');
    expect(Iso4217CurrencySchema.parse('MXN')).toBe('MXN');
    expect(Iso4217CurrencySchema.parse('CAD')).toBe('CAD');
    expect(Iso4217CurrencySchema.parse('CLP')).toBe('CLP');
  });

  it('rejects unsupported currencies', () => {
    expect(() => Iso4217CurrencySchema.parse('EUR')).toThrow();
    expect(() => Iso4217CurrencySchema.parse('usd')).toThrow();
  });
});

describe('MoneySchema', () => {
  it('accepts a positive USD amount', () => {
    expect(MoneySchema.parse({ currency: 'USD', amount: 9.99 })).toEqual({
      currency: 'USD',
      amount: 9.99,
    });
  });

  it('rejects zero or negative amounts', () => {
    expect(() => MoneySchema.parse({ currency: 'USD', amount: 0 })).toThrow();
    expect(() => MoneySchema.parse({ currency: 'USD', amount: -1 })).toThrow();
  });

  it('rejects unknown extra fields under strict', () => {
    expect(() => MoneySchema.parse({ currency: 'USD', amount: 9.99, foo: 'bar' })).toThrow();
  });
});

describe('Iso8601UtcSchema', () => {
  it('accepts UTC datetimes', () => {
    expect(Iso8601UtcSchema.parse('2026-06-01T00:00:00Z')).toBe('2026-06-01T00:00:00Z');
    expect(Iso8601UtcSchema.parse('2026-06-01T00:00:00+00:00')).toBe('2026-06-01T00:00:00+00:00');
  });

  it('rejects bare dates and human-readable forms', () => {
    expect(() => Iso8601UtcSchema.parse('2026-06-01')).toThrow();
    expect(() => Iso8601UtcSchema.parse('June 1, 2026')).toThrow();
  });
});

describe('QuantitySchema', () => {
  it('defaults unit to EACH when omitted', () => {
    const parsed = QuantitySchema.parse({ amount: 5 });
    expect(parsed.unit).toBe('EACH');
    expect(parsed.amount).toBe(5);
  });

  it('rejects negative or fractional amounts', () => {
    expect(() => QuantitySchema.parse({ amount: -1 })).toThrow();
    expect(() => QuantitySchema.parse({ amount: 1.5 })).toThrow();
  });

  it('accepts CASE unit', () => {
    expect(QuantitySchema.parse({ unit: 'CASE', amount: 2 }).unit).toBe('CASE');
  });
});

describe('QuantityUnitSchema', () => {
  it('accepts EACH and CASE only', () => {
    expect(QuantityUnitSchema.parse('EACH')).toBe('EACH');
    expect(QuantityUnitSchema.parse('CASE')).toBe('CASE');
    expect(() => QuantityUnitSchema.parse('PALLET')).toThrow();
  });
});

describe('ProcessModeSchema', () => {
  it('defaults to UPSERT', () => {
    expect(ProcessModeSchema.parse(undefined)).toBe('UPSERT');
  });

  it('accepts UPSERT and DELETE', () => {
    expect(ProcessModeSchema.parse('UPSERT')).toBe('UPSERT');
    expect(ProcessModeSchema.parse('DELETE')).toBe('DELETE');
  });

  it('rejects other modes', () => {
    expect(() => ProcessModeSchema.parse('CREATE')).toThrow();
  });
});

describe('ShipNodeSchema', () => {
  it('accepts typical Walmart shipNode IDs', () => {
    expect(ShipNodeSchema.parse('10003072111')).toBe('10003072111');
  });

  it('rejects empty', () => {
    expect(() => ShipNodeSchema.parse('')).toThrow();
  });
});
