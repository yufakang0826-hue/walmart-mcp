#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z, ZodError, type ZodType } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getConfig, validateConfig } from './config/environment.js';
import { WalmartSellerApi } from './api/index.js';
import { getToolDefinitions, executeTool } from './tools/index.js';
import { serverLogger } from './utils/logger.js';
import { WalmartApiError } from './utils/api-error.js';

// Resolve package.json once at module load so the MCP server's reported
// version stays in lockstep with what's actually installed. Avoids drift like
// the earlier hard-coded '0.3.2' which lagged through five releases.
function readPackageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // build/index.js -> ../package.json. Works the same when running via tsx
    // from src/ because tsx evaluates in place under the repo root.
    const pkgPath = join(here, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
const PACKAGE_VERSION = readPackageVersion();

class WalmartMcpServer {
  private server: McpServer;
  private api: WalmartSellerApi;

  constructor() {
    const config = getConfig();
    validateConfig(config);

    this.server = new McpServer({
      name: 'walmart-mcp',
      version: PACKAGE_VERSION,
    });

    this.api = new WalmartSellerApi(config);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    const tools = getToolDefinitions();
    serverLogger.info(`Registering ${tools.length} tools`);

    for (const toolDef of tools) {
      const hasSchema = Object.keys(toolDef.inputSchema).length > 0;
      this.server.registerTool(toolDef.name, {
        description: toolDef.description,
        inputSchema: hasSchema
          ? (toolDef.inputSchema as Record<string, ZodType>)
          : undefined,
      }, async (rawArgs: Record<string, unknown>) => {
        // Re-parse args through the tool's zod schema. The MCP SDK does shape
        // validation against the inputSchema, but explicit z.object(...).parse
        // here also runs any .refine() business rules and fills in defaults so
        // the downstream dispatcher always sees a fully-resolved payload.
        let args: Record<string, unknown> = rawArgs;
        try {
          if (hasSchema) {
            const schemaObj = z.object(toolDef.inputSchema as Record<string, ZodType>);
            args = schemaObj.parse(rawArgs) as Record<string, unknown>;
          }
        } catch (validationError: unknown) {
          if (validationError instanceof ZodError) {
            serverLogger.warn(
              `Tool ${toolDef.name} input validation failed: ${validationError.message}`,
            );
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  error: 'Input validation failed before any Walmart API call.',
                  tool: toolDef.name,
                  issues: validationError.issues.map((iss) => ({
                    path: iss.path,
                    message: iss.message,
                    code: iss.code,
                  })),
                }, null, 2),
              }],
              isError: true,
            };
          }
          throw validationError;
        }

        try {
          const result = await executeTool(this.api, toolDef.name, args);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          serverLogger.error(`Tool ${toolDef.name} failed: ${errorMsg}`);
          let payload: Record<string, unknown>;
          if (error instanceof WalmartApiError) {
            // Attach the MCP tool name so the LLM can correlate the failing
            // call to a tool it knows about. endpoint + hint are already set
            // by the API client's interceptor.
            error.tool = toolDef.name;
            payload = error.toResponse();
          } else {
            payload = { error: errorMsg, tool: toolDef.name };
          }
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(payload, null, 2),
            }],
            isError: true,
          };
        }
      });
    }
  }

  async run(): Promise<void> {
    await this.api.initialize();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    serverLogger.info('Walmart MCP Server running on stdio');

    process.on('SIGINT', async () => {
      serverLogger.info('Shutting down...');
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      serverLogger.info('Shutting down...');
      await this.server.close();
      process.exit(0);
    });
  }
}

// ============================================================
// Subcommand dispatch — make a single bin handle:
//   walmart-mcp           -> run the MCP server (default)
//   walmart-mcp setup     -> run the interactive setup wizard
//   walmart-mcp diagnose  -> run the self-check (--export OK)
//   walmart-mcp version   -> print the package version
// Everything after the subcommand is forwarded as process.argv to the
// child script (so `walmart-mcp diagnose --export` works).
// ============================================================
const subcommand = process.argv[2];

async function dispatch(): Promise<void> {
  if (subcommand === 'setup') {
    process.argv = [process.argv[0]!, 'setup', ...process.argv.slice(3)];
    await import('./scripts/setup.js');
    return;
  }
  if (subcommand === 'diagnose') {
    process.argv = [process.argv[0]!, 'diagnose', ...process.argv.slice(3)];
    await import('./scripts/diagnose.js');
    return;
  }
  if (subcommand === 'version' || subcommand === '--version' || subcommand === '-v') {
    console.log(`walmart-mcp v${PACKAGE_VERSION}`);
    return;
  }
  if (subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    console.log('walmart-mcp — Walmart Marketplace MCP server');
    console.log('');
    console.log('Usage:');
    console.log('  walmart-mcp                Run the MCP server over stdio (default).');
    console.log('  walmart-mcp setup          Interactive setup wizard.');
    console.log('  walmart-mcp diagnose       Self-check (env / token / config).');
    console.log('  walmart-mcp version        Print version.');
    console.log('');
    console.log('Docs: https://github.com/yufakang0826-hue/walmart-mcp');
    return;
  }
  const server = new WalmartMcpServer();
  await server.run();
}

dispatch().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
