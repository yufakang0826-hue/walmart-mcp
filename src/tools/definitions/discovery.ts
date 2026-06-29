import { z } from 'zod';

/**
 * Discovery-pattern escape hatch for Walmart Marketplace endpoints not covered
 * by a dedicated wrapped tool. The 127 wrapped tools cover ~90 % of common
 * seller workflows, but Walmart ships new endpoints frequently and the long
 * tail (esoteric report types, partner-only beta endpoints, etc.) can be
 * reached via this single meta-tool until a dedicated wrapper is added.
 *
 * Trade-offs vs a wrapped tool:
 *   - No business-rule validation (LLM must build the payload).
 *   - No known-issues hint specific to the call (still gets the generic
 *     endpoint + tool fields in error responses).
 *   - Auth headers + rate limiting + retry still applied — the call goes
 *     through the same WalmartApiClient.
 *
 * Use sparingly. If you find yourself calling the same custom endpoint
 * repeatedly, open an issue requesting a wrapped tool.
 */

const MethodSchema = z
  .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
  .describe('HTTP method, uppercase.');

const PathSchema = z
  .string()
  .regex(/^\/v\d+\//, "path must start with /v<digit>/ (e.g. '/v3/items')")
  .max(500, 'path too long');

const QueryParamsSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .optional()
  .describe('Optional query string parameters.');

const BodySchema = z
  .record(z.string(), z.unknown())
  .optional()
  .describe(
    'Optional request body. Use a plain JSON object — the MCP serializes it to JSON. ' +
      'Walmart will respond with its own validation error if fields are missing.',
  );

export const discoveryTools = [
  {
    name: 'walmart_call_endpoint',
    description:
      'Discovery escape hatch: call any Walmart Marketplace endpoint by method + path. Auth, ' +
      'correlation ID, rate limiting, and 401/429/5xx retry are still applied — this is NOT a ' +
      'raw socket. The response is wrapped with the same EXTERNAL DATA marker as wrapped tools. ' +
      'Use this only for endpoints not covered by a dedicated walmart_* tool. If you call the ' +
      'same endpoint repeatedly, open an issue requesting a wrapped tool with a strict schema. ' +
      "Example: walmart_call_endpoint({ method: 'GET', path: '/v3/items', params: { limit: 5 } }).",
    inputSchema: {
      method: MethodSchema,
      path: PathSchema,
      params: QueryParamsSchema,
      body: BodySchema,
    },
  },
  {
    name: 'walmart_search_endpoints',
    description:
      'Search known Walmart Marketplace endpoint patterns by keyword. Returns suggestions for ' +
      'the dedicated wrapped tool to use (if any), plus the raw method + path so you can fall ' +
      'back to walmart_call_endpoint. Use this when you do not know which tool wraps a given ' +
      'Walmart capability.',
    inputSchema: {
      query: z
        .string()
        .min(2, 'query too short')
        .describe("Search keyword, e.g. 'feed status', 'return refund', 'lag time'."),
      limit: z.number().int().min(1).max(20).default(10).optional(),
    },
  },
];
