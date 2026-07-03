import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ItemsApi } from '../../src/api/items/items-api.js';
import type { WalmartApiClient } from '../../src/api/client.js';

function createMockClient() {
  return {
    get: vi.fn().mockResolvedValue({ ok: true }),
    post: vi.fn().mockResolvedValue({ ok: true }),
    put: vi.fn().mockResolvedValue({ ok: true }),
    delete: vi.fn().mockResolvedValue({ ok: true }),
  } as unknown as WalmartApiClient & Record<string, any>;
}

const SPEC_FIXTURE = {
  schema: {
    properties: {
      MPItemFeedHeader: {
        required: ['businessUnit', 'locale', 'version'],
        properties: { businessUnit: {}, locale: {}, version: {} },
      },
      MPItem: {
        items: {
          properties: {
            Orderable: {
              required: ['sku', 'price'],
              properties: {
                sku: { type: 'string' },
                price: { type: 'number' },
                brand: { type: 'string' },
              },
            },
            Visible: {
              properties: {
                'Drone Propellers': {
                  required: ['productName'],
                  properties: {
                    productName: { type: 'string', maxLength: 199 },
                    color: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

describe('ItemsApi spec-version resolution', () => {
  let client: any;
  let api: ItemsApi;

  beforeEach(() => {
    client = createMockClient();
    api = new ItemsApi(client);
  });

  it('probes candidates and caches the first working version', async () => {
    await api.getItemSpec({ productType: 'Drone Propellers' });
    await api.getItemSpec({ productType: 'Drone Propellers' });
    // 1 probe + 2 real calls — the probe must not repeat once resolved.
    expect(client.post).toHaveBeenCalledTimes(3);
    const versions = client.post.mock.calls.map((c: any[]) => c[1]?.version);
    expect(versions.every((v: string) => /^5\.0\./.test(v))).toBe(true);
  });

  it('falls through to the next candidate when the first is retired', async () => {
    client.post
      .mockRejectedValueOnce(new Error('WM_SPEC_MODE'))
      .mockResolvedValue(SPEC_FIXTURE);
    const result = (await api.getItemSpec({ productType: 'Drone Propellers' })) as any;
    expect(result.summarized).toBe(true);
    // Probe call 1 failed, probe call 2 succeeded → real call used candidate #2
    const usedVersion = client.post.mock.calls.at(-1)?.[1]?.version;
    expect(usedVersion).toBe('5.0.20260114-19_40_57-api');
  });

  it('falls back to the first candidate when every probe fails', async () => {
    client.post.mockRejectedValue(new Error('offline'));
    await expect(api.getItemSpec({ productType: 'X' })).rejects.toThrow();
    // Even after total probe failure, submissions still get a version.
    client.post.mockResolvedValue({ feedId: 'F1' });
    const res = (await api.submitItemUpdateFeed({
      MPItem: [{ Orderable: { sku: 'A' } }],
    })) as { feedId: string };
    expect(res.feedId).toBe('F1');
  });
});

describe('ItemsApi.getItemSpec requiredOnly projection', () => {
  it('summarizes the JSON Schema by default', async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(SPEC_FIXTURE);
    const api = new ItemsApi(client);

    const result = (await api.getItemSpec({ productType: 'Drone Propellers' })) as any;
    expect(result.summarized).toBe(true);
    expect(result.headerRequired).toEqual(['businessUnit', 'locale', 'version']);
    expect(Object.keys(result.orderable.required)).toEqual(['sku', 'price']);
    expect(result.orderable.optionalAttributes).toContain('brand');
    expect(result.visible['Drone Propellers'].required.productName.maxLength).toBe(199);
  });

  it('returns the raw schema when requiredOnly: false', async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(SPEC_FIXTURE);
    const api = new ItemsApi(client);

    const result = await api.getItemSpec({ productType: 'Drone Propellers', requiredOnly: false });
    expect(result).toBe(SPEC_FIXTURE);
  });
});

describe('ItemsApi.getTaxonomy category filter', () => {
  const TREE = {
    itemTaxonomy: [
      { category: 'Cameras & Photography', description: 'Cameras', productTypeGroup: [] },
      {
        category: 'Home & Garden',
        description: 'Home',
        productTypeGroup: [
          {
            productTypeGroupName: 'Decorative Accents',
            productType: [
              { productTypeName: 'Cigar Cases' },
              { productTypeName: 'Vases' },
            ],
          },
        ],
      },
    ],
  };

  it('filters the tree client-side by category substring', async () => {
    const client = createMockClient();
    client.get.mockResolvedValue(TREE);
    const api = new ItemsApi(client);

    const result = (await api.getTaxonomy({ category: 'camera' })) as any;
    expect(result.filtered).toBe(true);
    expect(result.matchCount).toBe(1);
    expect(result.itemTaxonomy[0].category).toBe('Cameras & Photography');
  });

  it('matches productTypeName leaves, not just top-level categories', async () => {
    const client = createMockClient();
    client.get.mockResolvedValue(TREE);
    const api = new ItemsApi(client);

    // "cigar" appears only as a productTypeName under Home & Garden.
    const result = (await api.getTaxonomy({ category: 'cigar' })) as any;
    expect(result.matchCount).toBe(1);
    expect(result.itemTaxonomy[0].category).toBe('Home & Garden');
    expect(result.matchedProductTypes).toEqual([
      {
        productTypeName: 'Cigar Cases',
        category: 'Home & Garden',
        productTypeGroup: 'Decorative Accents',
      },
    ]);
  });
});
