/**
 * tools/excalidraw/read.ts
 *
 * Tool: excalidraw_read
 * Reads and parses an existing Excalidraw diagram (.excalidraw.md) from the vault.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "node:fs/promises";
import { safePath, fsError } from "../../config.js";
import { parseExcalidrawMd } from "./helpers.js";

export function registerExcalidrawRead(server: McpServer): void {
  server.registerTool(
    "excalidraw_read",
    {
      title: "Read Excalidraw Diagram",
      description:
        "Read and parse an existing Excalidraw diagram (.excalidraw.md) from the vault.\n\n" +
        "Args:\n" +
        "  - path (string): Relative path to the .excalidraw.md file\n\n" +
        "Returns: Parsed diagram data — element count, per-element details, and app state.",
      inputSchema: {
        path: z
          .string()
          .min(1)
          .describe(
            "Relative path to the Excalidraw diagram inside the vault, " +
              "e.g. 'Diagrams/flow.excalidraw.md'"
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ path: diagPath }) => {
      try {
        const abs = safePath(diagPath);
        const content = await fs.readFile(abs, "utf-8");
        const payload = parseExcalidrawMd(content);

        if (!payload) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text:
                  `Error: '${diagPath}' does not contain a valid Excalidraw JSON payload. ` +
                  `Make sure it's a .excalidraw.md file created by the Obsidian Excalidraw plugin.`,
              },
            ],
          };
        }

        const elements = payload.elements
          .filter((el) => !el.isDeleted)
          .map((el) => ({
            id: el.id,
            type: el.type,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            ...(el.text !== undefined ? { text: el.text } : {}),
            strokeColor: el.strokeColor,
            backgroundColor: el.backgroundColor,
          }));

        const output = {
          path: diagPath,
          version: payload.version,
          background_color: payload.appState.viewBackgroundColor,
          total_elements: elements.length,
          elements,
          app_state: payload.appState,
        };

        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: fsError(error, diagPath) }],
        };
      }
    }
  );
}
