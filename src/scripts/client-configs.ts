/**
 * MCP client config detection + write helpers used by `npm run setup`.
 *
 * Each client uses a slightly different config schema. Most follow Claude
 * Desktop's `{ mcpServers: { name: { command, args, env } } }` shape, but
 * Cursor and Zed differ.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, platform } from 'node:os';

export type ClientId =
  | 'claude-desktop'
  | 'claude-code-cli'
  | 'cursor'
  | 'cline'
  | 'continue'
  | 'windsurf'
  | 'zed';

export interface ClientSpec {
  id: ClientId;
  name: string;
  /** Get the OS-resolved absolute config path for this client. */
  resolvePath: () => string | null;
  /** How the `mcpServers` block is keyed in this client's config. */
  serverKey: 'mcpServers' | 'servers';
}

const APP_DATA = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
const LOCAL_APP_DATA = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');

export const CLIENT_SPECS: ReadonlyArray<ClientSpec> = [
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    serverKey: 'mcpServers',
    resolvePath: () => {
      const plat = platform();
      if (plat === 'darwin') {
        return join(homedir(), 'Library/Application Support/Claude/claude_desktop_config.json');
      }
      if (plat === 'win32') {
        return join(APP_DATA, 'Claude', 'claude_desktop_config.json');
      }
      return join(homedir(), '.config/Claude/claude_desktop_config.json');
    },
  },
  {
    id: 'claude-code-cli',
    name: 'Claude Code CLI',
    serverKey: 'mcpServers',
    resolvePath: () => join(homedir(), '.claude.json'),
  },
  {
    id: 'cursor',
    name: 'Cursor',
    serverKey: 'mcpServers',
    resolvePath: () => join(homedir(), '.cursor', 'mcp.json'),
  },
  {
    id: 'cline',
    name: 'Cline (VSCode extension)',
    serverKey: 'mcpServers',
    resolvePath: () => {
      const plat = platform();
      const segment = 'User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json';
      if (plat === 'darwin') {
        return join(homedir(), 'Library/Application Support/Code', segment);
      }
      if (plat === 'win32') {
        return join(APP_DATA, 'Code', segment);
      }
      return join(homedir(), '.config/Code', segment);
    },
  },
  {
    id: 'continue',
    name: 'Continue.dev',
    serverKey: 'mcpServers',
    resolvePath: () => join(homedir(), '.continue', 'config.json'),
  },
  {
    id: 'windsurf',
    name: 'Windsurf (Codeium)',
    serverKey: 'mcpServers',
    resolvePath: () => join(homedir(), '.codeium', 'windsurf', 'mcp_config.json'),
  },
  {
    id: 'zed',
    name: 'Zed Editor',
    serverKey: 'servers',
    resolvePath: () => {
      const plat = platform();
      if (plat === 'darwin') {
        return join(homedir(), 'Library/Application Support/Zed/settings.json');
      }
      if (plat === 'win32') {
        return join(LOCAL_APP_DATA, 'Zed', 'settings.json');
      }
      return join(homedir(), '.config/zed/settings.json');
    },
  },
];

/** Returns the subset of clients whose config files already exist. */
export function detectInstalled(): ReadonlyArray<ClientSpec & { path: string }> {
  const found: Array<ClientSpec & { path: string }> = [];
  for (const spec of CLIENT_SPECS) {
    const p = spec.resolvePath();
    if (p && existsSync(p)) found.push({ ...spec, path: p });
  }
  return found;
}

export interface WalmartMcpEntry {
  type: 'stdio';
  /**
   * Either `'node'` (with `args: [absolute path to build/index.js]`) when the
   * package's `build/` is found next to the setup script — works for both
   * `npm install -g` and `git clone` modes — or `'walmart-mcp'` (with empty
   * args) when falling back to the PATH shim.
   */
  command: 'node' | 'walmart-mcp';
  args: string[];
  env: Record<string, string>;
}

/**
 * Read existing config (or start from empty), insert / overwrite the
 * `walmart` entry under the appropriate server-key, and write back. Backs up
 * the original to `.before-walmart-setup.bak` on first write.
 */
export function writeWalmartEntry(
  spec: ClientSpec,
  configPath: string,
  walmartEntry: WalmartMcpEntry,
): { backedUp: boolean; overwrote: boolean } {
  let backedUp = false;
  let overwrote = false;

  let config: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    const backup = `${configPath}.before-walmart-setup.bak`;
    writeFileSync(backup, readFileSync(configPath));
    backedUp = true;
  } else {
    mkdirSync(dirname(configPath), { recursive: true });
  }

  let servers = (config[spec.serverKey] as Record<string, unknown> | undefined) ?? {};
  if (spec.id === 'zed') {
    // Zed nests MCP under `mcp.servers`; load the nested level.
    const mcp = (config.mcp as Record<string, unknown> | undefined) ?? {};
    servers = (mcp.servers as Record<string, unknown> | undefined) ?? {};
    if ('walmart' in servers) overwrote = true;
    servers.walmart = walmartEntry;
    mcp.servers = servers;
    config.mcp = mcp;
  } else {
    if ('walmart' in servers) overwrote = true;
    servers.walmart = walmartEntry;
    config[spec.serverKey] = servers;
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2));
  return { backedUp, overwrote };
}
