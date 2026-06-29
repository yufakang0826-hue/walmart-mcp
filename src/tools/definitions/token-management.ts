import { z } from 'zod';

export const tokenManagementTools = [
  {
    name: 'walmart_get_token',
    description: 'Request a new access token from Walmart API. Tokens expire in 15 minutes. This tool automatically caches the token.',
    inputSchema: {},
  },
  {
    name: 'walmart_get_token_status',
    description: 'Check the current token validity, scopes, and expiration time. Returns detailed token information from Walmart API.',
    inputSchema: {},
  },
  {
    name: 'walmart_get_token_info',
    description: 'Get local token cache info including expiry time and environment. Does not call the Walmart API.',
    inputSchema: {},
  },
  {
    name: 'walmart_set_credentials',
    description: 'Set Walmart API credentials (Client ID and Client Secret). Saves to .env file for persistence.',
    inputSchema: {
      clientId: z.string().describe('Walmart API Client ID'),
      clientSecret: z.string().describe('Walmart API Client Secret'),
    },
  },
  {
    name: 'walmart_display_credentials',
    description: 'Display current Walmart API credentials (Client ID shown in full, Client Secret masked). Shows environment and market configuration.',
    inputSchema: {},
  },
  {
    name: 'walmart_setup_guide',
    description: 'Get step-by-step setup instructions and a checklist for configuring this MCP server. Reports what is already configured (environment, market, whether marketplace and advertising credentials are set) and what is still needed. Call this first when getting started or when calls fail due to missing credentials.',
    inputSchema: {},
  },
  {
    name: 'walmart_get_rate_budget',
    description: 'Get current rate-limit budget for the Walmart Marketplace client. Returns the local sliding-window state (requests issued by this MCP in the last 60s) plus the latest Walmart-server-reported token bucket (x-current-token-count + x-next-replenish-time from the most recent response). Call this before bulk operations to see how much headroom you have. Note: Walmart Marketplace uses client_credentials + per-endpoint token buckets; there is no OAuth user-token flow to unlock higher rate limits, only the seller-account tier set by Walmart.',
    inputSchema: {},
  },
];
