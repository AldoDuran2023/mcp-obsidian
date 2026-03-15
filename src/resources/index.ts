/**
 * resources/index.ts
 *
 * Barrel that registers every MCP resource on the server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerVaultIndexResource,
  registerNoteContentResource,
} from "./vault-resource.js";

export function registerAllResources(server: McpServer): void {
  registerVaultIndexResource(server);
  registerNoteContentResource(server);
}
