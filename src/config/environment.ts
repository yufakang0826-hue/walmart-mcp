import * as dotenv from 'dotenv';
dotenv.config();

export type WalmartEnvironment = 'sandbox' | 'production';
export type WalmartMarket = 'us' | 'CA' | 'mx';

export interface WalmartConfig {
  clientId: string;
  clientSecret: string;
  environment: WalmartEnvironment;
  market: WalmartMarket;
  svcName: string;
  consumerChannelType?: string;
  partnerId?: string;
  accessToken?: string;
  accessTokenExpiry?: number;
  logLevel: string;
  enableFileLogging: boolean;
  // Advertising (Walmart Connect) - separate credentials
  adConsumerId?: string;
  adPrivateKey?: string;
  adKeyVersion?: string;
}

const BASE_URLS: Record<WalmartEnvironment, string> = {
  production: 'https://marketplace.walmartapis.com',
  sandbox: 'https://sandbox.walmartapis.com',
};

const AD_BASE_URLS: Record<WalmartEnvironment, string> = {
  production: 'https://developer.api.walmart.com/api-proxy/service/WPA/Api',
  sandbox: 'https://developer.api.stg.walmart.com/api-proxy/service/WPA/Api',
};

export function getBaseUrl(env: WalmartEnvironment): string {
  return BASE_URLS[env];
}

export function getAdBaseUrl(env: WalmartEnvironment): string {
  return AD_BASE_URLS[env];
}

export function getConfig(): WalmartConfig {
  return {
    clientId: process.env.WALMART_CLIENT_ID || '',
    clientSecret: process.env.WALMART_CLIENT_SECRET || '',
    environment: (process.env.WALMART_ENVIRONMENT as WalmartEnvironment) || 'sandbox',
    market: (process.env.WALMART_MARKET as WalmartMarket) || 'us',
    svcName: process.env.WALMART_SVC_NAME || 'Walmart Marketplace',
    consumerChannelType: process.env.WALMART_CONSUMER_CHANNEL_TYPE || undefined,
    partnerId: process.env.WALMART_PARTNER_ID || undefined,
    accessToken: process.env.WALMART_ACCESS_TOKEN || undefined,
    accessTokenExpiry: process.env.WALMART_ACCESS_TOKEN_EXPIRY
      ? parseInt(process.env.WALMART_ACCESS_TOKEN_EXPIRY, 10)
      : undefined,
    logLevel: process.env.WALMART_LOG_LEVEL || 'info',
    enableFileLogging: process.env.WALMART_ENABLE_FILE_LOGGING === 'true',
    adConsumerId: process.env.WALMART_AD_CONSUMER_ID || undefined,
    adPrivateKey: process.env.WALMART_AD_PRIVATE_KEY || undefined,
    adKeyVersion: process.env.WALMART_AD_KEY_VERSION || '1',
  };
}

export function validateConfig(config: WalmartConfig): void {
  if (!config.clientId || !config.clientSecret) {
    console.error(
      'Warning: WALMART_CLIENT_ID and/or WALMART_CLIENT_SECRET not set. ' +
      'Use walmart_set_credentials tool or set environment variables.',
    );
  }
}
