import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { upsertEnvVars } from '../../src/utils/env-file.js';

const tmpFiles: string[] = [];

function tmpEnvPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'wm-env-'));
  const p = join(dir, '.env');
  tmpFiles.push(p);
  return p;
}

afterEach(() => {
  for (const p of tmpFiles.splice(0)) {
    try {
      rmSync(p, { force: true });
    } catch {
      /* ignore */
    }
  }
});

describe('upsertEnvVars', () => {
  it('writes values containing $-sequences literally (regression: $ replacement corruption)', () => {
    const envPath = tmpEnvPath();
    writeFileSync(envPath, 'WALMART_ACCESS_TOKEN=old\n', 'utf-8');

    // A token containing $1, $&, $$ — all special in String.replace replacement strings.
    const token = 'abc$1def$&ghi$$jkl';
    upsertEnvVars({ WALMART_ACCESS_TOKEN: token }, envPath);

    const content = readFileSync(envPath, 'utf-8');
    expect(content).toContain(`WALMART_ACCESS_TOKEN=${token}`);
    expect(content).not.toContain('old');
  });

  it('updates an existing key in place without duplicating it', () => {
    const envPath = tmpEnvPath();
    writeFileSync(envPath, 'FOO=1\nWALMART_CLIENT_ID=old\nBAR=2\n', 'utf-8');

    upsertEnvVars({ WALMART_CLIENT_ID: 'new' }, envPath);

    const content = readFileSync(envPath, 'utf-8');
    expect(content).toContain('WALMART_CLIENT_ID=new');
    expect(content).toContain('FOO=1');
    expect(content).toContain('BAR=2');
    // Exactly one occurrence of the key.
    expect(content.match(/^WALMART_CLIENT_ID=/gm)?.length).toBe(1);
  });

  it('uncomments and overwrites a commented-out key', () => {
    const envPath = tmpEnvPath();
    writeFileSync(envPath, '# WALMART_CLIENT_SECRET=placeholder\n', 'utf-8');

    upsertEnvVars({ WALMART_CLIENT_SECRET: 'real-secret' }, envPath);

    const content = readFileSync(envPath, 'utf-8');
    expect(content).toContain('WALMART_CLIENT_SECRET=real-secret');
    expect(content).not.toContain('# WALMART_CLIENT_SECRET=placeholder');
  });

  it('appends a new key when absent, and creates the file if missing', () => {
    const envPath = tmpEnvPath();
    expect(existsSync(envPath)).toBe(false);

    upsertEnvVars({ WALMART_ENVIRONMENT: 'production' }, envPath);

    const content = readFileSync(envPath, 'utf-8');
    expect(content).toContain('WALMART_ENVIRONMENT=production');
  });

  it('writes multiple keys in one call', () => {
    const envPath = tmpEnvPath();
    upsertEnvVars(
      { WALMART_CLIENT_ID: 'id-1', WALMART_CLIENT_SECRET: 's$ecret' },
      envPath,
    );

    const content = readFileSync(envPath, 'utf-8');
    expect(content).toContain('WALMART_CLIENT_ID=id-1');
    expect(content).toContain('WALMART_CLIENT_SECRET=s$ecret');
  });
});
