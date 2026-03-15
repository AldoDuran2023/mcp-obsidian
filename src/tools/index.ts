/**
 * tools/index.ts
 *
 * Barrel that registers every tool on the MCP server.
 * Import this once from server.ts — order doesn't matter.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerReadNote, registerSearchNotes, registerListNotes } from "./notes-read.js";
import { registerCreateNote, registerEditNote, registerAppendToNote, registerDeleteNote } from "./notes-write.js";
import { registerGetVaultStats } from "./vault.js";

export function registerAllTools(server: McpServer): void {
  // Read-only
  registerReadNote(server);
  registerSearchNotes(server);
  registerListNotes(server);

  // Mutating
  registerCreateNote(server);
  registerEditNote(server);
  registerAppendToNote(server);
  registerDeleteNote(server);

  // Vault-level
  registerGetVaultStats(server);
}
