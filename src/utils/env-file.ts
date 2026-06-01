import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Insert or update `KEY=VALUE` pairs in a .env file, preserving the rest of
 * the file. An existing (optionally commented-out) line for a key is replaced
 * in place; otherwise the pair is appended.
 *
 * The replacement uses a *function* form of `String.prototype.replace` so that
 * values containing `$` sequences (e.g. `$1`, `$&`, `$$`) are written literally
 * instead of being interpreted as regex replacement patterns. Walmart access
 * tokens and client secrets are opaque and can contain `$`, which would
 * otherwise corrupt the persisted value and break authentication on restart.
 */
export function upsertEnvVars(
  updates: Record<string, string>,
  envPath: string = join(process.cwd(), '.env'),
): void {
  let content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^(#\\s*)?${key}=.*$`, 'gm');
    const newLine = `${key}=${value}`;

    if (regex.test(content)) {
      content = content.replace(regex, () => newLine);
    } else {
      content += `\n${newLine}`;
    }
  }

  writeFileSync(envPath, content, 'utf-8');
}
