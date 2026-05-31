#!/usr/bin/env node

import { type ZodType } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getConfig, validateConfig } from './config/environment.js';
import { WalmartSellerApi } from './api/index.js';
import { getToolDefinitions, executeTool } from './tools/index.js';
import { serverLogger } from './utils/logger.js';

class WalmartMcpServer {
  private server: McpServer;
  private api: WalmartSellerApi;

  constructor() {
    const config = getConfig();
    validateConfig(config);

    this.server = new McpServer({
      name: 'walmart-mcp',
      version: '0.2.0',
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
      }, async (args: Record<string, unknown>) => {
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
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ error: errorMsg }, null, 2),
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

const server = new WalmartMcpServer();
server.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
