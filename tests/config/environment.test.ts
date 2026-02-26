import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig, getBaseUrl, getAdBaseUrl, validateConfig, type WalmartConfig } from '../../src/config/environment.js';

describe('environment config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('getConfig', () => {
    it('should return default values when env vars are not set', () => {
      delete process.env.WALMART_CLIENT_ID;
      delete process.env.WALMART_CLIENT_SECRET;
      delete process.env.WALMART_ENVIRONMENT;
      delete process.env.WALMART_MARKET;

      const config = getConfig();
      expect(config.clientId).toBe('');
      expect(config.clientSecret).toBe('');
      expect(config.environment).toBe('sandbox');
      expect(config.market).toBe('us');
      expect(config.svcName).toBe('Walmart Marketplace');
      expect(config.logLevel).toBe('info');
      expect(config.enableFileLogging).toBe(false);
    });

    it('should read env vars correctly', () => {
      process.env.WALMART_CLIENT_ID = 'test-id';
      process.env.WALMART_CLIENT_SECRET = 'test-secret';
      process.env.WALMART_ENVIRONMENT = 'production';
      process.env.WALMART_MARKET = 'CA';
      process.env.WALMART_ENABLE_FILE_LOGGING = 'true';

      const config = getConfig();
      expect(config.clientId).toBe('test-id');
      expect(config.clientSecret).toBe('test-secret');
      expect(config.environment).toBe('production');
      expect(config.market).toBe('CA');
      expect(config.enableFileLogging).toBe(true);
    });

    it('should read advertising config', () => {
      process.env.WALMART_AD_CONSUMER_ID = 'ad-id';
      process.env.WALMART_AD_PRIVATE_KEY = 'ad-key';
      process.env.WALMART_AD_KEY_VERSION = '2';

      const config = getConfig();
      expect(config.adConsumerId).toBe('ad-id');
      expect(config.adPrivateKey).toBe('ad-key');
      expect(config.adKeyVersion).toBe('2');
    });
  });

  describe('getBaseUrl', () => {
    it('should return sandbox URL', () => {
      expect(getBaseUrl('sandbox')).toBe('https://sandbox.walmartapis.com');
    });

    it('should return production URL', () => {
      expect(getBaseUrl('production')).toBe('https://marketplace.walmartapis.com');
    });
  });

  describe('getAdBaseUrl', () => {
    it('should return sandbox ad URL', () => {
      expect(getAdBaseUrl('sandbox')).toContain('stg.walmart.com');
    });

    it('should return production ad URL', () => {
      expect(getAdBaseUrl('production')).toContain('developer.api.walmart.com');
    });
  });

  describe('validateConfig', () => {
    it('should not throw when credentials are set', () => {
      const config = { clientId: 'id', clientSecret: 'secret' } as WalmartConfig;
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should warn but not crash when credentials are missing', () => {
      const config = { clientId: '', clientSecret: '' } as WalmartConfig;
      // validateConfig now only warns, does not exit
      expect(() => validateConfig(config)).not.toThrow();
    });
  });
});
