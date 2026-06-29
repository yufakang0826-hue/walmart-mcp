/**
 * walmart-mcp diagnose
 * ------------------------------------------------------------
 * Self-check script. Run via `npm run diagnose`.
 *
 * Reports environment readiness, credential validity, and MCP-client config
 * presence without revealing credential values. Use `--export` to dump a
 * JSON report suitable for attaching to bug reports.
 *
 * Exit codes:
 *   0  all checks passed (or only warnings)
 *   1  one or more errors — configuration must be fixed before the MCP works
 *   2  fatal (script itself crashed)
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import * as dotenv from 'dotenv';
import { getBaseUrl, type WalmartEnvironment } from '../config/environment.js';

// ---------- Tiny tty helpers — no chalk dep on purpose ----------
const isTty = process.stdout.isTTY === true;
const c = {
  red:    (s: string) => (isTty ? `\x1b[31m${s}\x1b[0m` : s),
  green:  (s: string) => (isTty ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s: string) => (isTty ? `\x1b[33m${s}\x1b[0m` : s),
  dim:    (s: string) => (isTty ? `\x1b[2m${s}\x1b[0m` : s),
  bold:   (s: string) => (isTty ? `\x1b[1m${s}\x1b[0m` : s),
};

type Severity = 'ok' | 'warn' | 'error' | 'info';
interface CheckResult {
  section: string;
  severity: Severity;
  message: string;
}
const results: CheckResult[] = [];

function record(section: string, severity: Severity, message: string): void {
  results.push({ section, severity, message });
  const icon =
    severity === 'ok'    ? c.green('OK  ') :
    severity === 'warn'  ? c.yellow('WARN') :
    severity === 'error' ? c.red('ERR ') :
    c.dim('..  ');
  console.log(`   ${icon} ${message}`);
}

function section(num: string, total: string, title: string): void {
  console.log('');
  console.log(c.bold(`[${num}/${total}] ${title}`));
}

// ---------- Placeholder & secret-safe rendering ----------
const PLACEHOLDER_PATTERNS = [
  /^REPLACE_WITH_/i,
  /^YOUR_/i,
  /^xxx+$/i,
  /^<.*>$/,
  /^\$\{.*\}$/,
];

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return false;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(value));
}

function safeRender(value: string | undefined, label: string): string {
  if (!value) return `${label} not set`;
  if (isPlaceholder(value)) return `${label} is a placeholder ("${value}")`;
  const masked = value.length > 12
    ? `${value.slice(0, 4)}...${value.slice(-4)}`
    : '***';
  return `${label} = ${masked} (${value.length} chars)`;
}

// ===================================================================
// Step 1: Node runtime
// ===================================================================
function checkNode(): void {
  section('1', '7', 'Node runtime');
  const v = process.versions.node;
  const major = parseInt(v.split('.')[0] ?? '0', 10);
  if (major >= 22) {
    record('node', 'ok', `Node v${v} (>= 22 required)`);
  } else if (major >= 20) {
    record('node', 'warn', `Node v${v} works but >= 22 recommended`);
  } else {
    record('node', 'error', `Node v${v} too old — install Node 22+ from https://nodejs.org/`);
  }
}

// ===================================================================
// Step 2: env file presence
// ===================================================================
function checkEnvFile(): void {
  section('2', '7', 'Environment file');
  const cwd = process.cwd();
  const envPath = join(cwd, '.env');
  if (!existsSync(envPath)) {
    record('env-file', 'warn', `No .env at ${envPath} — relying on env vars from MCP client config`);
    return;
  }
  dotenv.config({ path: envPath });
  record('env-file', 'ok', `Found .env at ${envPath}`);
}

// ===================================================================
// Step 3: Required env vars
// ===================================================================
function checkRequiredEnv(): void {
  section('3', '7', 'Required env vars');

  const clientId = process.env.WALMART_CLIENT_ID;
  if (!clientId) {
    record('env', 'error', 'WALMART_CLIENT_ID not set');
  } else if (isPlaceholder(clientId)) {
    record('env', 'error', `WALMART_CLIENT_ID is a placeholder ("${clientId}")`);
  } else {
    record('env', 'ok', safeRender(clientId, 'WALMART_CLIENT_ID'));
  }

  const secret = process.env.WALMART_CLIENT_SECRET;
  if (!secret) {
    record('env', 'error', 'WALMART_CLIENT_SECRET not set');
  } else if (isPlaceholder(secret)) {
    record('env', 'error', 'WALMART_CLIENT_SECRET is a placeholder');
  } else {
    record('env', 'ok', safeRender(secret, 'WALMART_CLIENT_SECRET'));
  }

  const env = process.env.WALMART_ENVIRONMENT || 'sandbox';
  if (env !== 'sandbox' && env !== 'production') {
    record('env', 'error', `WALMART_ENVIRONMENT="${env}" — must be "sandbox" or "production"`);
  } else {
    record('env', 'ok', `WALMART_ENVIRONMENT = "${env}"`);
  }

  const market = (process.env.WALMART_MARKET || 'us').toLowerCase();
  if (!['us', 'mx', 'ca', 'cl'].includes(market)) {
    record('env', 'error', `WALMART_MARKET="${market}" — must be us|mx|ca|cl`);
  } else {
    record('env', 'ok', `WALMART_MARKET = "${market}"`);
  }
}

// ===================================================================
// Step 4: Optional env vars (advertising)
// ===================================================================
function checkOptionalEnv(): void {
  section('4', '7', 'Optional env vars (Walmart Connect advertising)');
  const adId = process.env.WALMART_AD_CONSUMER_ID;
  const adKey = process.env.WALMART_AD_PRIVATE_KEY;
  if (!adId && !adKey) {
    record('ads', 'info', 'WALMART_AD_CONSUMER_ID + WALMART_AD_PRIVATE_KEY not set');
    record('ads', 'info', '25 walmart_ad_* tools will return a friendly "credentials not configured" error');
  } else if (adId && adKey) {
    record('ads', 'ok', safeRender(adId, 'WALMART_AD_CONSUMER_ID'));
    record('ads', 'ok', safeRender(adKey, 'WALMART_AD_PRIVATE_KEY'));
  } else {
    record('ads', 'warn', 'Only one of AD_CONSUMER_ID / AD_PRIVATE_KEY is set — both required');
  }
}

// ===================================================================
// Step 5: Walmart token exchange
// ===================================================================
async function checkTokenExchange(): Promise<boolean> {
  section('5', '7', 'Walmart token exchange');

  const id = process.env.WALMART_CLIENT_ID;
  const secret = process.env.WALMART_CLIENT_SECRET;
  if (!id || !secret || isPlaceholder(id) || isPlaceholder(secret)) {
    record('token', 'info', 'Skipped (credentials missing or placeholder — fix step [3] first)');
    return false;
  }

  const env = (process.env.WALMART_ENVIRONMENT === 'production' ? 'production' : 'sandbox') as WalmartEnvironment;
  const tokenUrl = `${getBaseUrl(env)}/v3/token`;

  try {
    const basicAuth = Buffer.from(`${id}:${secret}`).toString('base64');
    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'WM_QOS.CORRELATION_ID': 'diagnose-' + Date.now(),
        'WM_SVC.NAME': process.env.WALMART_SVC_NAME || 'Walmart Marketplace',
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (resp.ok) {
      const body = (await resp.json()) as { token_type?: string; expires_in?: number };
      record('token', 'ok', `Token exchange OK (type=${body.token_type}, expires_in=${body.expires_in}s)`);
      return true;
    }

    const bodyText = await resp.text();
    record('token', 'error', `Token exchange failed: ${resp.status} ${resp.statusText}`);
    if (bodyText) {
      record('token', 'error', `  Body: ${bodyText.slice(0, 300)}`);
    }
    if (resp.status === 400) {
      record(
        'token',
        'info',
        '  Hint: 400 usually means wrong Client ID/Secret, or sandbox creds against production endpoint (or vice versa)',
      );
    }
    return false;
  } catch (err) {
    record('token', 'error', `Network error: ${err instanceof Error ? err.message : String(err)}`);
    record('token', 'info', '  Hint: check HTTPS_PROXY / firewall / DNS to marketplace.walmartapis.com');
    return false;
  }
}

// ===================================================================
// Step 6: Walmart API connectivity sanity
// ===================================================================
function checkApiCall(hadToken: boolean): void {
  section('6', '7', 'Walmart API connectivity');
  if (!hadToken) {
    record('api', 'info', 'Skipped (no token from step [5])');
    return;
  }
  record('api', 'ok', 'Token endpoint reachable — same host as all other APIs');
}

// ===================================================================
// Step 7: MCP client config (best effort, read-only)
// ===================================================================
function checkMcpClientConfig(): void {
  section('7', '7', 'MCP client config (best effort)');

  const home = homedir();
  const plat = platform();
  const candidates: Array<{ name: string; path: string }> = [];

  if (plat === 'darwin') {
    candidates.push({
      name: 'Claude Desktop',
      path: join(home, 'Library/Application Support/Claude/claude_desktop_config.json'),
    });
  } else if (plat === 'win32') {
    const appdata = process.env.APPDATA || join(home, 'AppData', 'Roaming');
    candidates.push({
      name: 'Claude Desktop',
      path: join(appdata, 'Claude', 'claude_desktop_config.json'),
    });
  } else {
    candidates.push({
      name: 'Claude Desktop',
      path: join(home, '.config/Claude/claude_desktop_config.json'),
    });
  }
  candidates.push({ name: 'Claude Code CLI', path: join(home, '.claude.json') });
  candidates.push({ name: 'Cursor', path: join(home, '.cursor', 'mcp.json') });

  let foundAny = false;
  for (const cand of candidates) {
    if (!existsSync(cand.path)) continue;
    foundAny = true;
    record('mcp-config', 'ok', `${cand.name} config found at ${cand.path}`);

    try {
      const raw = readFileSync(cand.path, 'utf8');
      const json = JSON.parse(raw) as { mcpServers?: Record<string, unknown>; servers?: Record<string, unknown> };
      const servers = json.mcpServers ?? json.servers;
      if (!servers) {
        record('mcp-config', 'warn', `  No mcpServers section in ${cand.name}`);
        continue;
      }
      const walmartKey = Object.keys(servers).find((k) => k.toLowerCase().startsWith('walmart'));
      if (!walmartKey) {
        record('mcp-config', 'warn', '  No "walmart*" entry in mcpServers — server not registered');
        continue;
      }
      record('mcp-config', 'ok', `  "${walmartKey}" entry present in mcpServers`);

      const entry = servers[walmartKey] as { env?: Record<string, string> } | undefined;
      const envBlock = entry?.env ?? {};
      const idInBlock = envBlock.WALMART_CLIENT_ID;
      const secretInBlock = envBlock.WALMART_CLIENT_SECRET;
      if (isPlaceholder(idInBlock) || isPlaceholder(secretInBlock)) {
        record('mcp-config', 'warn', `  env block in ${cand.name} still has placeholder credentials`);
      }
    } catch (err) {
      record('mcp-config', 'error', `  Failed to parse: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!foundAny) {
    record('mcp-config', 'warn', 'No supported MCP client config found in expected paths');
    record('mcp-config', 'info', '  walmart-mcp will still work via direct stdio, but no client knows about it yet');
  }
}

// ===================================================================
// Overall + export
// ===================================================================
async function main(): Promise<void> {
  console.log(c.bold('=== walmart-mcp diagnose ==='));

  checkNode();
  checkEnvFile();
  checkRequiredEnv();
  checkOptionalEnv();
  const hadToken = await checkTokenExchange();
  checkApiCall(hadToken);
  checkMcpClientConfig();

  console.log('');
  const errors = results.filter((r) => r.severity === 'error').length;
  const warnings = results.filter((r) => r.severity === 'warn').length;
  const summary =
    errors > 0
      ? c.red(`Overall: ${errors} errors, ${warnings} warnings`)
      : warnings > 0
        ? c.yellow(`Overall: ${warnings} warnings`)
        : c.green('Overall: all checks passed');
  console.log(summary);

  if (process.argv.includes('--export')) {
    const reportPath = join(process.cwd(), 'walmart-mcp-diagnose.json');
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          node: process.versions.node,
          platform: process.platform,
          cwd: process.cwd(),
          environment: process.env.WALMART_ENVIRONMENT || 'sandbox',
          market: process.env.WALMART_MARKET || 'us',
          results,
          summary: { errors, warnings },
        },
        null,
        2,
      ),
    );
    console.log(c.dim(`Report exported to ${reportPath}`));
  }

  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error(c.red('Fatal:'), err);
  process.exit(2);
});
