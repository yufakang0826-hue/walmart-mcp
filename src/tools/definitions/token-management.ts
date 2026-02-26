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
];
