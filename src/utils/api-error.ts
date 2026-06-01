/**
 * Error raised for a non-2xx Walmart API response. Carries the HTTP status and
 * the raw response body so callers (and the LLM) get the full Walmart error
 * detail instead of a lossy `"HTTP 404: Not Found"` string.
 */
export class WalmartApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'WalmartApiError';
  }
}

interface WalmartErrorEntry {
  code?: string;
  field?: string;
  description?: string;
  message?: string;
  info?: string;
}

/** Walmart uses both `{ errors: [...] }` and `{ error: [...] }` across services. */
function extractErrors(data: unknown): WalmartErrorEntry[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  const raw = obj.errors ?? obj.error;
  if (Array.isArray(raw)) return raw as WalmartErrorEntry[];
  if (raw && typeof raw === 'object') return [raw as WalmartErrorEntry];
  return [];
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…(truncated)` : s;
}

/**
 * Build a human/LLM-readable message from a Walmart error response, preserving
 * as much detail as the body provides:
 *  - structured `error[]`/`errors[]` → `CODE: description (field: x)`, joined
 *  - otherwise the raw body (JSON or text), so nothing is silently dropped
 *  - finally falls back to status + statusText
 */
export function formatWalmartError(
  status: number,
  statusText: string,
  data: unknown,
): string {
  const entries = extractErrors(data);
  if (entries.length) {
    const parts = entries.map((e) => {
      const code = e.code ? `${e.code}: ` : '';
      const desc = e.description || e.message || e.info || '';
      const field = e.field ? ` (field: ${e.field})` : '';
      return `${code}${desc}${field}`.trim();
    });
    return `HTTP ${status}: ${parts.join('; ')}`;
  }

  if (data && typeof data === 'object') {
    const json = JSON.stringify(data);
    if (json && json !== '{}') return `HTTP ${status}: ${truncate(json, 500)}`;
  } else if (typeof data === 'string' && data.trim()) {
    return `HTTP ${status}: ${truncate(data.trim(), 500)}`;
  }

  return `HTTP ${status}: ${statusText}`;
}
