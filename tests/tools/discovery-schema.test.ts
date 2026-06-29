import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { discoveryTools } from '../../src/tools/definitions/discovery.js';

function find(name: string) {
  const t = discoveryTools.find((tool) => tool.name === name);
  if (!t) throw new Error(`Tool ${name} not found`);
  return z.object(t.inputSchema);
}

describe('walmart_call_endpoint schema', () => {
  const schema = find('walmart_call_endpoint');

  it('accepts a minimal GET call', () => {
    expect(() => schema.parse({ method: 'GET', path: '/v3/items' })).not.toThrow();
  });

  it('accepts a POST call with body + query params', () => {
    expect(() =>
      schema.parse({
        method: 'POST',
        path: '/v3/feeds',
        params: { feedType: 'inventory' },
        body: { Inventory: [] },
      }),
    ).not.toThrow();
  });

  it('rejects lowercase methods', () => {
    expect(() => schema.parse({ method: 'get', path: '/v3/items' })).toThrow();
  });

  it('rejects paths not starting with /vN/', () => {
    expect(() => schema.parse({ method: 'GET', path: 'items' })).toThrow();
    expect(() => schema.parse({ method: 'GET', path: '/items' })).toThrow();
  });

  it('rejects unsupported methods (HEAD/OPTIONS)', () => {
    expect(() => schema.parse({ method: 'HEAD', path: '/v3/items' })).toThrow();
    expect(() => schema.parse({ method: 'OPTIONS', path: '/v3/items' })).toThrow();
  });
});

describe('walmart_search_endpoints schema', () => {
  const schema = find('walmart_search_endpoints');

  it('accepts a short keyword', () => {
    expect(() => schema.parse({ query: 'feed' })).not.toThrow();
  });

  it('rejects a 1-char query', () => {
    expect(() => schema.parse({ query: 'f' })).toThrow();
  });

  it('accepts an explicit limit', () => {
    expect(() => schema.parse({ query: 'feed', limit: 5 })).not.toThrow();
  });

  it('rejects limit out of range', () => {
    expect(() => schema.parse({ query: 'feed', limit: 0 })).toThrow();
    expect(() => schema.parse({ query: 'feed', limit: 999 })).toThrow();
  });
});
