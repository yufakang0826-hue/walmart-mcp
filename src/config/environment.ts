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

/**
 * Current Walmart Item Spec 5.0 version string.
 *
 * Walmart requires the FULL dated version (e.g. "5.0.20260501-19_21_29-api")
 * in MPItemFeedHeader.version and in GET /v3/items/spec. The short form "5.0"
 * fails spec-mode resolution with ERR_INT_SYS_0801003 / WM_SPEC_MODE
 * ("It looks like there was a glitch on our end") and the feed dies with
 * itemsReceived=0.
 *
 * Walmart announces new spec versions on the developer portal "What's new"
 * page. Override with WALMART_ITEM_SPEC_VERSION when a newer one ships.
 * Verified working against production on 2026-07-02 (also: 5.0.20260114-19_40_57-api).
 */
export const DEFAULT_ITEM_SPEC_VERSION = '5.0.20260501-19_21_29-api';

export function getItemSpecVersion(): string {
  return process.env.WALMART_ITEM_SPEC_VERSION || DEFAULT_ITEM_SPEC_VERSION;
}

/** Map the configured market to the businessUnit value Walmart expects in item feeds. */
export function getBusinessUnit(market: WalmartMarket = 'us'): string {
  const map: Record<string, string> = { us: 'WALMART_US', CA: 'WALMART_CA', mx: 'WALMART_MX' };
  return map[market] ?? 'WALMART_US';
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
      '\n┌─ walmart-mcp: setup required ────────────────────────────────────\n'
      + '│ No API credentials found. The server will start, but Walmart calls\n'
      + '│ will fail until you provide credentials. To fix:\n'
      + '│   1. Get a Client ID + Secret at https://developer.walmart.com/\n'
      + '│   2. Set WALMART_CLIENT_ID and WALMART_CLIENT_SECRET in your MCP\n'
      + '│      server "env" (or a .env file), then restart — OR call the\n'
      + '│      walmart_set_credentials tool at runtime.\n'
      + '│   Run the walmart_setup_guide tool for full setup steps.\n'
      + `│ Environment: ${config.environment}   Market: ${config.market}\n`
      + '└──────────────────────────────────────────────────────────────────\n',
    );
  }
}
