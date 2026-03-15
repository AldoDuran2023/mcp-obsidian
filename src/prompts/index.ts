/**
 * prompts/index.ts
 *
 * Barrel that registers every MCP prompt on the server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerSummarizeNotePrompt,
  registerCreateNoteDraftPrompt,
  registerReviewVaultPrompt,
} from "./vault-prompts.js";

export function registerAllPrompts(server: McpServer): void {
  registerSummarizeNotePrompt(server);
  registerCreateNoteDraftPrompt(server);
  registerReviewVaultPrompt(server);
}
