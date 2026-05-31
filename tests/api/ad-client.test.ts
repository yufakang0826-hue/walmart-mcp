import { describe, it, expect, beforeAll } from 'vitest';
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
});
