import { describe, it, expect, beforeAll, vi } from 'vitest';
import { generateKeyPairSync, createVerify } from 'crypto';

// Generate a throwaway RSA keypair to validate the signing logic without
// hitting the real Walmart Connect API.
let publicKey: string;
let privateKey: string;

beforeAll(() => {
  const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  publicKey = pair.publicKey;
  privateKey = pair.privateKey;
});

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    clientId: 'cid',
    clientSecret: 'secret',
    environment: 'sandbox',
    market: 'us',
    svcName: 'Walmart Marketplace',
    logLevel: 'error',
    enableFileLogging: false,
    adConsumerId: 'consumer-123',
    adPrivateKey: privateKey,
    adKeyVersion: '1',
    ...overrides,
  } as any;
}

describe('WalmartAdClient signing', () => {
  it('generateSignature produces a valid RSA-SHA256 signature over the canonical string', async () => {
    const { WalmartAdClient } = await import('../../src/api/advertising/ad-client.js');
    const client = new WalmartAdClient(makeConfig());

    const url = 'https://example.com/v1/campaigns';
    const method = 'GET';
    const timestamp = '1700000000000';

    // Private TS method is reachable at runtime.
    const signature: string = (client as any).generateSignature(url, method, timestamp);

    expect(typeof signature).toBe('string');
    expect(signature.length).toBeGreaterThan(0);

    // The signer builds: consumerId\nurl\nMETHOD\ntimestamp\n
    const stringToSign = `consumer-123\n${url}\n${method}\n${timestamp}\n`;
    const verify = createVerify('RSA-SHA256');
    verify.update(stringToSign);
    expect(verify.verify(publicKey, signature, 'base64')).toBe(true);
  });

  it('generateSignature uppercases the HTTP method in the signed payload', async () => {
    const { WalmartAdClient } = await import('../../src/api/advertising/ad-client.js');
    const client = new WalmartAdClient(makeConfig());

    const url = 'https://example.com/v1/keywords';
    const timestamp = '1700000000001';
    const signature: string = (client as any).generateSignature(url, 'post', timestamp);

    const stringToSign = `consumer-123\n${url}\nPOST\n${timestamp}\n`;
    const verify = createVerify('RSA-SHA256');
    verify.update(stringToSign);
    expect(verify.verify(publicKey, signature, 'base64')).toBe(true);
  });

  it('generateSignature throws when the private key is missing', async () => {
    const { WalmartAdClient } = await import('../../src/api/advertising/ad-client.js');
    const client = new WalmartAdClient(makeConfig({ adPrivateKey: undefined }));

    expect(() => (client as any).generateSignature('https://x', 'GET', '1')).toThrow(
      /WALMART_AD_PRIVATE_KEY is required/i,
    );
  });

  it('serializeParams encodes scalars and arrays in insertion order', async () => {
    const { WalmartAdClient } = await import('../../src/api/advertising/ad-client.js');
    const client = new WalmartAdClient(makeConfig());

    const qs = (client as any).serializeParams({
      page: 2,
      name: 'a b&c',
      tags: ['x', 'y'],
      skip: undefined,
      none: null,
    });

    // undefined/null dropped; spaces and & percent-encoded; arrays repeat the key.
    expect(qs).toBe('page=2&name=a%20b%26c&tags=x&tags=y');
  });
});

describe('WalmartAdClient request signing (query string coverage)', () => {
  it('folds query params into the URL and signs the full URL including the query string', async () => {
    const { WalmartAdClient } = await import('../../src/api/advertising/ad-client.js');
    const client = new WalmartAdClient(makeConfig());

    // Avoid the real token network call.
    vi.spyOn(client as any, 'getAccessToken').mockResolvedValue('fake-access-token');

    // Replace the adapter so no HTTP happens; capture the final config that the
    // request interceptor produced.
    let captured: any;
    (client as any).http.defaults.adapter = async (config: any) => {
      captured = config;
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    };

    await client.get('/v1/campaigns', { advertiserId: '123', page: 2 });

    // Params were embedded into the URL and cleared so axios won't re-append them.
    expect(captured.url).toBe('/v1/campaigns?advertiserId=123&page=2');
    expect(captured.params).toBeUndefined();

    // The signature must verify over the FULL url (base + path + query).
    const signature = captured.headers['WM_SEC.AUTH_SIGNATURE'];
    const timestamp = captured.headers['WM_CONSUMER.INTIMESTAMP'];
    const fullUrl = `${captured.baseURL}${captured.url}`;
    const stringToSign = `consumer-123\n${fullUrl}\nGET\n${timestamp}\n`;

    const verify = createVerify('RSA-SHA256');
    verify.update(stringToSign);
    expect(verify.verify(publicKey, signature, 'base64')).toBe(true);
    // Sanity: the signed string genuinely contains the query string.
    expect(fullUrl).toContain('?advertiserId=123&page=2');
  });
});
