/**
 * Centralized MCP tool annotations (readOnlyHint / destructiveHint /
 * idempotentHint / openWorldHint) for all walmart_* tools.
 *
 * Clients use these hints to decide whether a call needs user confirmation
 * and whether calls can run in parallel — without them, walmart_get_item and
 * walmart_refund_order look equally risky.
 *
 * Design: rule-based classification by name pattern, with an explicit
 * override map for the exceptions. A table test in
 * tests/tools/annotations.test.ts pins the classification of every
 * registered tool so drift is caught in CI.
 *
 * Annotation semantics (MCP spec):
 * - readOnlyHint:    tool does not modify its environment
 * - destructiveHint: tool may perform destructive/irreversible updates
 *                    (only meaningful when readOnlyHint is false)
 * - idempotentHint:  repeated calls with the same args have no extra effect
 * - openWorldHint:   tool interacts with external entities (the Walmart API)
 */

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
};

/** Local-only reads (no Walmart API call at all). */
const LOCAL_READ: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
};

/** Sets a value; re-sending the same value changes nothing further. */
const IDEMPOTENT_WRITE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

/** Creates something new each call (feeds, reports, campaigns, labels…). */
const NON_IDEMPOTENT_WRITE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

/** Irreversible business actions: money moves, listings die, orders cancel. */
const DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

/**
 * Explicit overrides — checked before the name-pattern rules.
 * Keep this list SHORT; prefer fixing the rules if a whole family is wrong.
 */
const OVERRIDES: Record<string, ToolAnnotations> = {
  // ----- Local-only tools (no network) -----
  walmart_display_credentials: LOCAL_READ,
  walmart_get_token_info: LOCAL_READ,
  walmart_setup_guide: LOCAL_READ,
  walmart_search_endpoints: LOCAL_READ,
  // Writes the local .env only — reversible, no Walmart call.
  walmart_set_credentials: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },

  // ----- Escape hatches: capability depends on caller's args -----
  // call_endpoint can GET or DELETE anything; generic_feed can submit any
  // feed type. Annotate for the worst case so clients stay cautious.
  walmart_call_endpoint: DESTRUCTIVE,
  walmart_submit_generic_feed: NON_IDEMPOTENT_WRITE,

  // ----- Reads that don't match the get_/search_ prefix -----
  walmart_poll_feed_until_complete: READ_ONLY,
  walmart_download_report: READ_ONLY,

  // ----- Writes that look like reads or need special casing -----
  // Acknowledge transitions Created→Acknowledged once; re-acking is a no-op.
  walmart_acknowledge_order: IDEMPOTENT_WRITE,
  // Ship/refund/cancel are irreversible business actions.
  walmart_ship_order: DESTRUCTIVE,
  walmart_refund_order: DESTRUCTIVE,
  walmart_issue_return_refund: DESTRUCTIVE,
  walmart_approve_return: DESTRUCTIVE,
  walmart_reject_return: DESTRUCTIVE,
  // Token refresh mutates server-side token state (invalidates nothing
  // critical, but it's not a pure read).
  walmart_get_token: IDEMPOTENT_WRITE,
};

/** Name-pattern rules, evaluated top-down after OVERRIDES. */
const RULES: Array<{ pattern: RegExp; annotations: ToolAnnotations }> = [
  // Destructive verbs
  { pattern: /^walmart_(retire|bulk_retire|cancel|delete|discard|reject)_/, annotations: DESTRUCTIVE },
  { pattern: /^walmart_ad_delete_/, annotations: DESTRUCTIVE },

  // Idempotent setters
  { pattern: /^walmart_(update|assign_items_to|unassign_items_from|convert_to)_/, annotations: IDEMPOTENT_WRITE },
  { pattern: /^walmart_ad_update_/, annotations: IDEMPOTENT_WRITE },

  // Non-idempotent creators/submitters
  {
    pattern: /^walmart_(submit|create|add|book|schedule|generate|test)_/,
    annotations: NON_IDEMPOTENT_WRITE,
  },
  { pattern: /^walmart_ad_(create|add)_/, annotations: NON_IDEMPOTENT_WRITE },

  // Reads
  { pattern: /^walmart_(get|search)_/, annotations: READ_ONLY },
  { pattern: /^walmart_ad_get_/, annotations: READ_ONLY },
];

/**
 * Resolve annotations for a tool name. Unknown names get conservative
 * defaults (treated as a potentially destructive external write) so a newly
 * added tool is never silently under-labeled.
 */
export function getToolAnnotations(toolName: string): ToolAnnotations {
  const override = OVERRIDES[toolName];
  if (override) return override;
  for (const rule of RULES) {
    if (rule.pattern.test(toolName)) return rule.annotations;
  }
  return DESTRUCTIVE;
}
