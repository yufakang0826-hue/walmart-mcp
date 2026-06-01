import { describe, it, expect } from 'vitest';
import { WalmartApiError, formatWalmartError } from '../../src/utils/api-error.js';

describe('formatWalmartError', () => {
  it('formats a structured errors[] body with code, description and field', () => {
    const data = {
      errors: [
        { code: 'INVALID_REQUEST', description: 'SKU not found', field: 'sku' },
      ],
    };
    expect(formatWalmartError(400, 'Bad Request', data)).toBe(
      'HTTP 400: INVALID_REQUEST: SKU not found (field: sku)',
    );
  });

  it('supports the alternate error[] (singular) shape and joins multiple entries', () => {
    const data = {
      error: [
        { code: 'A', description: 'first' },
        { code: 'B', message: 'second' },
      ],
    };
    expect(formatWalmartError(422, 'Unprocessable', data)).toBe(
      'HTTP 422: A: first; B: second',
    );
  });

  it('falls back to the raw JSON body when there is no structured error array', () => {
    const data = { reason: 'service unavailable', traceId: 'abc' };
    const msg = formatWalmartError(503, 'Service Unavailable', data);
    expect(msg).toContain('HTTP 503:');
    expect(msg).toContain('service unavailable');
    expect(msg).toContain('abc');
  });

  it('falls back to a string body', () => {
    expect(formatWalmartError(404, 'Not Found', 'Not Found')).toBe('HTTP 404: Not Found');
  });

  it('falls back to status + statusText when the body is empty', () => {
    expect(formatWalmartError(404, 'Not Found', undefined)).toBe('HTTP 404: Not Found');
    expect(formatWalmartError(404, 'Not Found', {})).toBe('HTTP 404: Not Found');
  });

  it('truncates very large bodies', () => {
    const data = { blob: 'x'.repeat(2000) };
    const msg = formatWalmartError(500, 'Server Error', data);
    expect(msg).toContain('…(truncated)');
    expect(msg.length).toBeLessThan(600);
  });
});

describe('WalmartApiError', () => {
  it('carries status and raw details', () => {
    const details = { errors: [{ code: 'X' }] };
    const err = new WalmartApiError('HTTP 400: X', 400, details);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('WalmartApiError');
    expect(err.status).toBe(400);
    expect(err.details).toBe(details);
  });
});
