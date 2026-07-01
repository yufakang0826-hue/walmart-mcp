/**
 * walmart-mcp setup
 * ------------------------------------------------------------
 * Interactive wizard. Run via `npm run setup` (or `npx walmart-mcp setup`).
 *
 * What it does:
 *   1. Ask for environment + market (sandbox/production, us/mx/ca/cl)
 *   2. Ask for WALMART_CLIENT_ID and WALMART_CLIENT_SECRET (masked input)
 *   3. Live-validate credentials via OAuth token exchange
 *   4. Optionally ask for Walmart Connect advertising credentials
 *   5. Detect installed MCP clients (Claude Desktop, Claude Code CLI,
 *      Cursor, Cline, Continue, Windsurf, Zed) and offer multi-select
 *      write — backs up each client's config before modifying it.
 *
 * Zero new runtime deps. Uses node:readline/promises.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { getBaseUrl, type WalmartEnvironment } from '../config/environment.js';
import {
  CLIENT_SPECS,
  writeWalmartEntry,
  type ClientSpec,
  type WalmartMcpEntry,
} from './client-configs.js';

// ---------- Tty helpers — no chalk dep ----------
const isTty = stdout.isTTY === true;
const c = {
  red:    (s: string) => (isTty ? `\x1b[31m${s}\x1b[0m` : s),
  green:  (s: string) => (isTty ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s: string) => (isTty ? `\x1b[33m${s}\x1b[0m` : s),
  cyan:   (s: string) => (isTty ? `\x1b[36m${s}\x1b[0m` : s),
  dim:    (s: string) => (isTty ? `\x1b[2m${s}\x1b[0m` : s),
  bold:   (s: string) => (isTty ? `\x1b[1m${s}\x1b[0m` : s),
};

const rl = readline.createInterface({ input: stdin, output: stdout });

function logBanner(): void {
  console.log('');
  console.log(c.bold('======================================'));
  console.log(c.bold('   walmart-mcp setup wizard'));
  console.log(c.bold('======================================'));
  console.log(c.dim('   Press Ctrl+C to abort at any time'));
  console.log('');
}

function logStep(label: string): void {
  console.log('');
  console.log(c.cyan(`>> ${label}`));
}

// ---------- Masked input ----------
/**
 * Whether we can safely mask keyboard input. The raw-mode + per-char echo
 * approach works reliably on Unix TTYs but LEAKS on Windows PowerShell:
 * pasted characters get echoed by the terminal's line-editing layer before
 * Node.js can toggle raw mode for that batch. A real user reported this in
 * v0.5.5 — their production Walmart client_secret was echoed in full into
 * the terminal (and then into a chat log). We now refuse to attempt masked
 * input on Windows and any non-TTY stdin, and route the user to a `.env`
 * file where the secret never touches the terminal.
 */
function canReliablyMaskInput(): boolean {
  return process.platform !== 'win32' && stdin.isTTY === true;
}

async function askMasked(prompt: string): Promise<string> {
  if (!canReliablyMaskInput()) {
    // Guardrail: don't accept the secret via terminal at all on Windows.
    // Print the prompt with a red warning and take a plain-text line so we
    // don't leave the user hanging, but strongly discourage this path.
    process.stdout.write(prompt);
    console.log('');
    console.log(c.red('   ⚠  Masked terminal input is unreliable on this platform'));
    console.log(c.red('      (Windows PowerShell echoes pasted secrets before Node.js can hide them).'));
    console.log(c.yellow('      RECOMMENDED: Ctrl+C now, put the secret in a `.env` file next to the'));
    console.log(c.yellow('                   package (WALMART_CLIENT_SECRET=...), then re-run `walmart-mcp setup`.'));
    console.log(c.dim('      Or press Enter with an empty value to abort this step.'));
    const value = (await rl.question('   Value (will be echoed): ')).trim();
    return value;
  }

  process.stdout.write(prompt);
  let value = '';
  await new Promise<void>((resolve) => {
    const onData = (chunk: Buffer): void => {
      const s = chunk.toString('utf8');
      for (const ch of s) {
        if (ch === '\n' || ch === '\r') {
          stdin.removeListener('data', onData);
          stdin.setRawMode(false);
          process.stdout.write('\n');
          resolve();
          return;
        }
        if (ch === '') {
          process.stdout.write('\n');
          process.exit(130);
        }
        if (ch === '' || ch === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        value += ch;
        process.stdout.write('*');
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
  return value.trim();
}

async function chooseFromList<T extends string>(
  label: string,
  options: ReadonlyArray<{ value: T; description?: string }>,
  defaultIdx = 0,
): Promise<T> {
  console.log(label);
  options.forEach((opt, i) => {
    const marker = i === defaultIdx ? c.green(' (default)') : '';
    console.log(`  ${i + 1}) ${opt.value}${opt.description ? c.dim(' - ' + opt.description) : ''}${marker}`);
  });
  const answer = (await rl.question(`Pick [1-${options.length}] (default ${defaultIdx + 1}): `)).trim();
  if (!answer) return options[defaultIdx]!.value;
  const idx = parseInt(answer, 10) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx >= options.length) {
    console.log(c.yellow(`  Not a valid choice, using default ${options[defaultIdx]!.value}`));
    return options[defaultIdx]!.value;
  }
  return options[idx]!.value;
}

/**
 * Parse a comma-separated list of 1-based indices into a deduped set.
 * "1,3,4" -> Set{0,2,3}. Out-of-range entries are dropped silently.
 */
function parseMultiSelect(answer: string, maxIdx: number): ReadonlySet<number> {
  const out = new Set<number>();
  for (const part of answer.split(/[,\s]+/)) {
    if (!part) continue;
    const n = parseInt(part, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= maxIdx) out.add(n - 1);
  }
  return out;
}

async function validateCredentials(
  clientId: string,
  clientSecret: string,
  env: WalmartEnvironment,
): Promise<{ ok: true; expiresIn: number } | { ok: false; reason: string }> {
  const url = `${getBaseUrl(env)}/v3/token`;
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'WM_QOS.CORRELATION_ID': 'setup-' + Date.now(),
        'WM_SVC.NAME': 'Walmart Marketplace',
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (resp.ok) {
      const body = (await resp.json()) as { expires_in?: number };
      return { ok: true, expiresIn: body.expires_in ?? 0 };
    }
    const bodyText = await resp.text();
    return {
      ok: false,
      reason: `HTTP ${resp.status} ${resp.statusText}${bodyText ? ': ' + bodyText.slice(0, 200) : ''}`,
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function main(): Promise<void> {
  logBanner();

  logStep('1/5 Choose Walmart environment');
  const environment = await chooseFromList<'sandbox' | 'production'>(
    '   Which environment will you use?',
    [
      { value: 'sandbox', description: 'testing, mock data, no real listings' },
      { value: 'production', description: 'real store, real money' },
    ],
    0,
  );

  logStep('2/5 Choose marketplace');
  const market = await chooseFromList<'us' | 'mx' | 'ca' | 'cl'>(
    '   Walmart marketplace:',
    [
      { value: 'us', description: 'United States' },
      { value: 'mx', description: 'Mexico' },
      { value: 'ca', description: 'Canada' },
      { value: 'cl', description: 'Chile' },
    ],
    0,
  );

  logStep('3/5 Walmart credentials');
  let clientId = '';
  let clientSecret = '';
  while (true) {
    clientId = (await rl.question('   WALMART_CLIENT_ID: ')).trim();
    clientSecret = await askMasked('   WALMART_CLIENT_SECRET (hidden): ');
    if (!clientId || !clientSecret) {
      console.log(c.red('   Both fields required.'));
      continue;
    }
    process.stdout.write(c.dim('   Validating against Walmart... '));
    const result = await validateCredentials(clientId, clientSecret, environment);
    if (result.ok) {
      console.log(c.green(`OK (token expires in ${result.expiresIn}s)`));
      break;
    }
    console.log(c.red('FAIL'));
    console.log(c.red('   ' + result.reason));
    const retry = (await rl.question('   Try again? [Y/n]: ')).trim().toLowerCase();
    if (retry === 'n') {
      console.log(c.yellow('   Aborting. Fix credentials at https://developer.walmart.com/ and re-run.'));
      process.exit(1);
    }
  }

  logStep('4/5 Walmart Connect advertising (optional)');
  const wantsAds = (await rl.question('   Configure now? [y/N]: ')).trim().toLowerCase() === 'y';
  let adConsumerId: string | undefined;
  let adPrivateKey: string | undefined;
  if (wantsAds) {
    adConsumerId = (await rl.question('   WALMART_AD_CONSUMER_ID: ')).trim() || undefined;
    if (adConsumerId) adPrivateKey = (await askMasked('   WALMART_AD_PRIVATE_KEY (hidden): ')) || undefined;
  } else {
    console.log(c.dim('   Skipped. 25 walmart_ad_* tools will return a friendly error until configured.'));
  }

  logStep('5/5 Register MCP server in your AI clients');
  // Resolve a build/index.js that actually exists, regardless of how setup
  // is being invoked:
  //   - `walmart-mcp setup` from a global npm install
  //     -> setup.js lives in <prefix>/node_modules/@lehaotech/walmart-mcp/build/scripts/
  //   - `npm run setup` in a git clone (tsx src/scripts/setup.ts)
  //     -> setup.ts lives in <repo>/src/scripts/, build sibling to src/
  // Use import.meta.url to anchor — independent of process.cwd().
  function resolveServerEntry(): {
    command: WalmartMcpEntry['command'];
    args: string[];
    warn?: string;
  } {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      resolve(here, '..', 'index.js'),                  // build/scripts/setup.js -> build/index.js
      resolve(here, '..', '..', 'build', 'index.js'),   // src/scripts/setup.ts -> <root>/build/index.js
    ];
    const found = candidates.find(existsSync);
    if (found) return { command: 'node', args: [found] };
    // Last resort: trust the PATH shim. walmart-mcp will be on PATH after
    // `npm install -g`. Best for users who installed globally and never
    // looked at where the package landed.
    return {
      command: 'walmart-mcp',
      args: [],
      warn: `build/index.js not found next to ${here}. Falling back to PATH-based "walmart-mcp" command. If your AI client cannot find that, run 'npm run build' (from a git clone) or 'npm install -g @lehaotech/walmart-mcp'.`,
    };
  }
  const entry = resolveServerEntry();
  if (entry.warn) console.log(c.yellow(`   WARN: ${entry.warn}`));

  // Detect installed clients.
  const installed: Array<ClientSpec & { path: string }> = [];
  const notInstalled: ClientSpec[] = [];
  for (const spec of CLIENT_SPECS) {
    const p = spec.resolvePath();
    if (p && existsSync(p)) installed.push({ ...spec, path: p });
    else notInstalled.push(spec);
  }

  if (installed.length === 0) {
    console.log(c.yellow('   No supported MCP client config files found in expected paths.'));
    console.log(c.dim('   Looked for:'));
    for (const spec of CLIENT_SPECS) console.log(c.dim(`     - ${spec.name}: ${spec.resolvePath()}`));
    console.log(c.yellow('   Skipping write — install at least one MCP client and re-run.'));
    process.exit(0);
  }

  console.log('   Detected MCP clients:');
  installed.forEach((spec, i) => console.log(`     ${i + 1}) ${spec.name}  ${c.dim('(' + spec.path + ')')}`));
  console.log('');
  const answer = (
    await rl.question(
      '   Select which to configure (comma-separated, e.g. "1,3"; empty = all): ',
    )
  ).trim();
  const picked: ReadonlySet<number> =
    answer === ''
      ? new Set(installed.map((_, i) => i))
      : parseMultiSelect(answer, installed.length);
  if (picked.size === 0) {
    console.log(c.yellow('   Nothing selected, aborting.'));
    process.exit(0);
  }

  const walmartEntry: WalmartMcpEntry = {
    type: 'stdio',
    command: entry.command,
    args: entry.args,
    env: {
      WALMART_CLIENT_ID: clientId,
      WALMART_CLIENT_SECRET: clientSecret,
      WALMART_ENVIRONMENT: environment,
      WALMART_MARKET: market,
      ...(adConsumerId ? { WALMART_AD_CONSUMER_ID: adConsumerId } : {}),
      ...(adPrivateKey ? { WALMART_AD_PRIVATE_KEY: adPrivateKey } : {}),
    },
  };

  let okCount = 0;
  let failCount = 0;
  for (const idx of picked) {
    const target = installed[idx]!;
    process.stdout.write(c.dim(`   Writing ${target.name}... `));
    try {
      const r = writeWalmartEntry(target, target.path, walmartEntry);
      const tag = r.overwrote ? c.yellow('updated') : c.green('added');
      const backupTag = r.backedUp ? c.dim(' (backup at .before-walmart-setup.bak)') : '';
      console.log(`${tag}${backupTag}`);
      okCount += 1;
    } catch (err) {
      console.log(c.red(`FAIL: ${err instanceof Error ? err.message : String(err)}`));
      failCount += 1;
    }
  }

  console.log('');
  console.log(c.bold('================= Done ================='));
  if (failCount === 0) console.log(c.green(`Configured ${okCount} client(s).`));
  else console.log(c.yellow(`Configured ${okCount} client(s), ${failCount} failed.`));
  console.log('');
  console.log('Next:');
  console.log('  1. If you have not built yet:   ' + c.cyan('npm run build'));
  console.log('  2. Restart each configured AI client');
  console.log('  3. Try in chat: ' + c.cyan('"Show me my recent Walmart orders"'));
  console.log('');
  console.log(c.dim('If anything fails, run ' + c.cyan('npm run diagnose') + c.dim(' for a self-check.')));
  rl.close();
}

main().catch((err) => {
  console.error(c.red('Setup failed:'), err);
  rl.close();
  process.exit(2);
});
