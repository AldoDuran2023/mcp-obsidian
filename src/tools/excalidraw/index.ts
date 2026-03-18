/**
 * tools/excalidraw/index.ts
 *
 * Barrel — registers all Excalidraw tools on the MCP server.
 * Import this from tools/index.ts.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerExcalidrawCreate } from "./create.js";
import { registerExcalidrawRead } from "./read.js";
import { registerExcalidrawAddElements } from "./add-elements.js";
import { registerExcalidrawList } from "./list.js";

export function registerAllExcalidrawTools(server: McpServer): void {
  registerExcalidrawCreate(server);
  registerExcalidrawRead(server);
  registerExcalidrawAddElements(server);
  registerExcalidrawList(server);
}

// Re-export individual registers for direct use if needed
export {
  registerExcalidrawCreate,
  registerExcalidrawRead,
  registerExcalidrawAddElements,
  registerExcalidrawList,
};
