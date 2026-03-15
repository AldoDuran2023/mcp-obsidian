#!/usr/bin/env node
/**
 * server.ts — Entry point for the Obsidian MCP Server.
 *
 * This file is intentionally thin: it creates the McpServer instance,
 * delegates registration to the tools / resources / prompts modules,
 * then connects via stdio transport.
 *
 * Transport: stdio
 * Logging:   stderr only  (stdout is reserved for MCP protocol messages)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { VAULT_ROOT, collectMarkdownFiles } from "./config.js";
import { registerAllTools } from "./tools/index.js";
import { registerAllResources } from "./resources/index.js";
import { registerAllPrompts } from "./prompts/index.js";
import fs from "node:fs/promises";

// ---------------------------------------------------------------------------
// Server instance
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "obsidian-mcp-server",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Register capabilities
// ---------------------------------------------------------------------------

registerAllTools(server);
registerAllResources(server);
registerAllPrompts(server);

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Validate vault path
  try {
    const stat = await fs.stat(VAULT_ROOT);
    if (!stat.isDirectory()) {
      console.error(`ERROR: OBSIDIAN_VAULT_PATH is not a directory: ${VAULT_ROOT}`);
      process.exit(1);
    }
  } catch {
    console.error(`ERROR: Cannot access vault at: ${VAULT_ROOT}`);
    process.exit(1);
  }

  // Log startup info to stderr
  const noteCount = (await collectMarkdownFiles(VAULT_ROOT)).length;
  console.error(`Obsidian MCP Server starting...`);
  console.error(`  Vault : ${VAULT_ROOT}`);
  console.error(`  Notes : ${noteCount}`);

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server running via stdio");
}

main().catch((error) => {
  console.error("Fatal server error:", error);
  process.exit(1);
});
