import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLIENT_SPECS,
  writeWalmartEntry,
  type ClientSpec,
  type WalmartMcpEntry,
} from '../../src/scripts/client-configs.js';

const baselineEntry: WalmartMcpEntry = {
  type: 'stdio',
  command: 'node',
  args: ['/tmp/test/walmart-mcp/build/index.js'],
  env: {
    WALMART_CLIENT_ID: 'test-id',
    WALMART_CLIENT_SECRET: 'test-secret',
    WALMART_ENVIRONMENT: 'sandbox',
    WALMART_MARKET: 'us',
  },
};

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'walmart-mcp-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('CLIENT_SPECS', () => {
  it('exports at least 7 client specs', () => {
    expect(CLIENT_SPECS.length).toBeGreaterThanOrEqual(7);
  });

  it('every spec has id, name, resolvePath and serverKey', () => {
    for (const spec of CLIENT_SPECS) {
      expect(spec.id).toBeTruthy();
      expect(spec.name).toBeTruthy();
      expect(typeof spec.resolvePath).toBe('function');
      expect(['mcpServers', 'servers']).toContain(spec.serverKey);
    }
  });

  it('client ids are unique', () => {
    const ids = new Set(CLIENT_SPECS.map((s) => s.id));
    expect(ids.size).toBe(CLIENT_SPECS.length);
  });
});

describe('writeWalmartEntry (Claude Desktop shape)', () => {
  const spec: ClientSpec = {
    id: 'claude-desktop',
    name: 'Test',
    serverKey: 'mcpServers',
    resolvePath: () => null,
  };

  it('creates the config file when missing and adds walmart entry', () => {
    const path = join(tmpDir, 'cfg.json');
    const result = writeWalmartEntry(spec, path, baselineEntry);
    expect(result.backedUp).toBe(false);
    expect(result.overwrote).toBe(false);
    expect(existsSync(path)).toBe(true);
    const written = JSON.parse(readFileSync(path, 'utf8'));
    expect(written.mcpServers.walmart).toEqual(baselineEntry);
  });

  it('preserves unrelated mcpServers entries', () => {
    const path = join(tmpDir, 'cfg.json');
    writeFileSync(
      path,
      JSON.stringify({
        mcpServers: { someOther: { type: 'stdio', command: 'other', args: [], env: {} } },
      }),
    );
    writeWalmartEntry(spec, path, baselineEntry);
    const written = JSON.parse(readFileSync(path, 'utf8'));
    expect(written.mcpServers.someOther).toBeTruthy();
    expect(written.mcpServers.walmart).toEqual(baselineEntry);
  });

  it('backs up the original config before overwriting', () => {
    const path = join(tmpDir, 'cfg.json');
    writeFileSync(path, JSON.stringify({ mcpServers: {} }));
    const result = writeWalmartEntry(spec, path, baselineEntry);
    expect(result.backedUp).toBe(true);
    expect(existsSync(`${path}.before-walmart-setup.bak`)).toBe(true);
  });

  it('overwrote=true when walmart already exists', () => {
    const path = join(tmpDir, 'cfg.json');
    writeFileSync(
      path,
      JSON.stringify({
        mcpServers: { walmart: { type: 'stdio', command: 'old', args: [], env: {} } },
      }),
    );
    const result = writeWalmartEntry(spec, path, baselineEntry);
    expect(result.overwrote).toBe(true);
    const written = JSON.parse(readFileSync(path, 'utf8'));
    expect(written.mcpServers.walmart.command).toBe('node');
  });
});

describe('writeWalmartEntry (Zed nested mcp.servers shape)', () => {
  const spec: ClientSpec = {
    id: 'zed',
    name: 'Zed Editor',
    serverKey: 'servers',
    resolvePath: () => null,
  };

  it('nests walmart under mcp.servers, not top-level', () => {
    const path = join(tmpDir, 'zed.json');
    writeWalmartEntry(spec, path, baselineEntry);
    const written = JSON.parse(readFileSync(path, 'utf8'));
    expect(written.mcp).toBeTruthy();
    expect(written.mcp.servers.walmart).toEqual(baselineEntry);
    expect(written.mcpServers).toBeUndefined();
  });

  it('preserves Zed top-level settings that are unrelated to MCP', () => {
    const path = join(tmpDir, 'zed.json');
    writeFileSync(
      path,
      JSON.stringify({
        theme: 'One Dark',
        mcp: { servers: { someOther: { command: 'foo', args: [], env: {} } } },
      }),
    );
    writeWalmartEntry(spec, path, baselineEntry);
    const written = JSON.parse(readFileSync(path, 'utf8'));
    expect(written.theme).toBe('One Dark');
    expect(written.mcp.servers.someOther).toBeTruthy();
    expect(written.mcp.servers.walmart).toEqual(baselineEntry);
  });
});
