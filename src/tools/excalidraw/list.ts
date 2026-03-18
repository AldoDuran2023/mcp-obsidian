/**
 * tools/excalidraw/list.ts
 *
 * Tool: excalidraw_list
 * Lists all Excalidraw diagrams (.excalidraw.md) in the vault or a subfolder,
 * enriched with element counts and file metadata.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { VAULT_ROOT, safePath, fsError } from "../../config.js";
import { collectExcalidrawFiles, parseExcalidrawMd } from "./helpers.js";

export function registerExcalidrawList(server: McpServer): void {
  server.registerTool(
    "excalidraw_list",
    {
      title: "List Excalidraw Diagrams",
      description:
        "List all Excalidraw diagrams (.excalidraw.md) in the vault or a subdirectory.\n\n" +
        "Args:\n" +
        "  - directory (string): Subdirectory relative to vault root (default: '' = entire vault)\n\n" +
        "Returns: Sorted list of diagram paths with element counts, file size, and last modified date.",
      inputSchema: {
        directory: z
          .string()
          .default("")
          .describe(
            "Subdirectory to search, relative to vault root. " +
              "Empty string = entire vault."
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ directory }) => {
      try {
        const targetDir = directory ? safePath(directory) : VAULT_ROOT;

        const stat = await fs.stat(targetDir);
        if (!stat.isDirectory()) {
          return {
            isError: true,
            content: [
              { type: "text", text: `Error: '${directory}' is not a directory.` },
            ],
          };
        }

        const files = await collectExcalidrawFiles(targetDir);

        const diagrams = await Promise.all(
          files.map(async (relPath) => {
            try {
              const abs = path.join(VAULT_ROOT, relPath);
              const content = await fs.readFile(abs, "utf-8");
              const payload = parseExcalidrawMd(content);
              const elementCount = payload
                ? payload.elements.filter((e) => !e.isDeleted).length
                : null;
              const fileStat = await fs.stat(abs);
              return {
                path: relPath,
                element_count: elementCount,
                size_kb: Math.round(fileStat.size / 1024),
                modified: fileStat.mtime.toISOString(),
              };
            } catch {
              return { path: relPath, element_count: null, size_kb: null, modified: null };
            }
          })
        );

        const output = {
          directory: directory || "/",
          total_diagrams: diagrams.length,
          diagrams,
        };

        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: fsError(error, directory || "/") }],
        };
      }
    }
  );
}
