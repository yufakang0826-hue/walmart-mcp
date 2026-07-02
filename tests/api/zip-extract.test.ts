import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'zlib';
import { extractFirstZipEntry } from '../../src/api/reports/reports-api.js';

/** Build a minimal single-entry ZIP (local file header + payload). */
function makeZip(content: string, method: 0 | 8): Buffer {
  const name = Buffer.from('report.csv');
  const raw = Buffer.from(content, 'utf-8');
  const data = method === 8 ? deflateRawSync(raw) : raw;

  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
  header.writeUInt16LE(20, 4); // version needed
  header.writeUInt16LE(0, 6); // flags
  header.writeUInt16LE(method, 8); // compression method
  header.writeUInt32LE(data.length, 18); // compressed size
  header.writeUInt32LE(raw.length, 22); // uncompressed size
  header.writeUInt16LE(name.length, 26); // name length
  header.writeUInt16LE(0, 28); // extra length

  return Buffer.concat([header, name, data]);
}

describe('extractFirstZipEntry', () => {
  const csv = 'SKU,PRODUCT NAME,DESCRIPTION\nABC-1,Widget,"A widget, deluxe"\n';

  it('extracts a deflate-compressed entry', () => {
    expect(extractFirstZipEntry(makeZip(csv, 8))).toBe(csv);
  });

  it('extracts a stored (uncompressed) entry', () => {
    expect(extractFirstZipEntry(makeZip(csv, 0))).toBe(csv);
  });

  it('rejects non-ZIP data', () => {
    expect(() => extractFirstZipEntry(Buffer.from('not a zip at all, sorry'))).toThrow(/Not a ZIP/);
  });

  it('handles multibyte UTF-8 content', () => {
    const zh = 'SKU,标题\nABC-1,无人机桨叶保护罩\n';
    expect(extractFirstZipEntry(makeZip(zh, 8))).toBe(zh);
  });
});
