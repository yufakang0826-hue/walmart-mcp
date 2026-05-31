# walmart-mcp

A Model Context Protocol (MCP) server for the Walmart Marketplace Seller API. Provides 126 tools covering the full Walmart seller workflow — items, inventory, orders, pricing, fulfillment (WFS), returns, reports, notifications, and advertising (Walmart Connect).

## Features

- **126 Tools** across 12 modules
- **OAuth 2.0** with 15-minute token auto-refresh and proactive renewal
- **Walmart Connect Advertising** with separate RSA-SHA256 signed authentication
- **Feed polling** with progressive intervals (15s → 30s → 1m → 2m → 4m)
- **Auto-retry** on 401 (token refresh), 429 (rate limit), 423 (resource lock), 5xx (exponential backoff)
- **Sandbox & Production** environment support

## Modules

| Module | Tools | Description |
|--------|-------|-------------|
| Token Management | 5 | Credentials, token lifecycle |
| Items | 12 | CRUD, taxonomy, feeds, WFS conversion |
| Inventory | 10 | Single/multi-node, lag time, feeds |
| Orders | 10 | Fulfill, ship, cancel, refund, labels |
| Pricing | 10 | Price updates, repricer strategies |
| Feeds | 5 | Submit, poll, status tracking |
| WFS Fulfillment | 19 | Inbound shipments, MCS, carrier booking |
| Returns | 8 | Approve, reject, refund, labels |
| Reports | 12 | On-demand, scheduled, listing quality |
| Notifications | 6 | Webhook subscriptions |
| Advertising | 25 | Campaigns, keywords, bids, analytics |
| Settings | 4 | Shipping, fulfillment centers, partner |

## Installation

### From npm

```bash
npm install -g @yufakang0826-hue/walmart-mcp
```

> Note: the unscoped name `walmart-mcp` on npm belongs to a different author. Use the scoped package `@yufakang0826-hue/walmart-mcp` above.

### From source

```bash
git clone https://github.com/yufakang0826-hue/walmart-mcp.git
cd walmart-mcp
npm install
npm run build
```

## Configuration

### Claude Code (claude_desktop_config.json or ~/.claude.json)

```json
{
  "mcpServers": {
    "walmart-mcp": {
      "type": "stdio",
      "command": "walmart-mcp",
      "env": {
        "WALMART_CLIENT_ID": "your-client-id",
        "WALMART_CLIENT_SECRET": "your-client-secret",
        "WALMART_ENVIRONMENT": "sandbox",
        "WALMART_MARKET": "us"
      }
    }
  }
}
```

### Environment Variables

```bash
# Required — Marketplace API
WALMART_CLIENT_ID=your-client-id
WALMART_CLIENT_SECRET=your-client-secret

# Optional (defaults shown)
WALMART_ENVIRONMENT=sandbox        # sandbox | production
WALMART_MARKET=us                  # us | CA | mx
WALMART_SVC_NAME=Walmart Marketplace

# Optional — Advertising (Walmart Connect)
WALMART_AD_CONSUMER_ID=your-ad-consumer-id
WALMART_AD_PRIVATE_KEY=your-private-key
WALMART_AD_KEY_VERSION=1

# Logging
WALMART_LOG_LEVEL=info             # error | warn | info | http | debug
WALMART_ENABLE_FILE_LOGGING=false
```

## Getting Walmart API Credentials

1. Sign up at [Walmart Developer Portal](https://developer.walmart.com/)
2. Create a new application under **Marketplace**
3. Copy the **Client ID** and **Client Secret**
4. For advertising, apply for [Walmart Connect](https://www.walmartconnect.com/) access

## Usage Examples

Once configured, the tools are available through any MCP-compatible client:

```
"Get all my Walmart orders from the last 7 days"
→ walmart_get_all_orders

"Update inventory for SKU ABC-123 to 50 units"
→ walmart_update_inventory

"Check the status of feed 12345"
→ walmart_get_feed_status

"Create an advertising campaign with $50 daily budget"
→ walmart_ad_create_campaign

"Show my listing quality score"
→ walmart_get_listing_quality
```

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Test MCP protocol
node test-mcp.mjs

# MCP Inspector (interactive debugging)
npm run inspect
```

## Testing

```bash
# Unit tests (112 tests, no network — uses mocked HTTP clients)
npm run test:run        # single run
npm test                # watch mode

# Live sandbox smoke test (read-only GETs against the real API)
npm run test:sandbox
```

The unit suite covers the tool dispatcher, every API module, the RSA-SHA256
advertising signature, the sliding-window rate limiter, and config validation.

`test:sandbox` exercises read-only calls (token, partner info, items, orders,
returns, feeds, pricing strategies, listing quality) end-to-end. It requires real
credentials in `.env` and **skips gracefully** (exit 0) when they are absent, so it
is safe to run in CI.

## Architecture

```
src/
├── index.ts                    # MCP server entry point
├── config/environment.ts       # Config & env vars
├── auth/oauth.ts               # OAuth 2.0 token management
├── utils/logger.ts             # Winston logger (stderr only)
├── api/
│   ├── client.ts               # Marketplace HTTP client + interceptors
│   ├── index.ts                # API facade
│   ├── advertising/
│   │   ├── ad-client.ts        # Advertising HTTP client (RSA-SHA256)
│   │   └── advertising-api.ts  # 25 advertising methods
│   ├── items/items-api.ts
│   ├── inventory/inventory-api.ts
│   ├── orders/orders-api.ts
│   ├── pricing/pricing-api.ts
│   ├── feeds/feeds-api.ts
│   ├── fulfillment/fulfillment-api.ts
│   ├── returns/returns-api.ts
│   ├── reports/reports-api.ts
│   ├── notifications/notifications-api.ts
│   └── settings/settings-api.ts
└── tools/
    ├── index.ts                # Tool registry + dispatcher
    └── definitions/            # Zod schema definitions (12 files)
```

## License

MIT
