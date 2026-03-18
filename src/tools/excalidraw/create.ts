/**
 * tools/excalidraw/create.ts
 *
 * Tool: excalidraw_create
 * Creates a new blank (or pre-populated) Excalidraw diagram (.excalidraw.md)
 * inside the Obsidian vault.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { safePath, fsError } from "../../config.js";
import { ElementSchema } from "./types.js";
import { emptyPayload, buildExcalidrawMd, buildElements } from "./helpers.js";

export function registerExcalidrawCreate(server: McpServer): void {
  server.registerTool(
    "excalidraw_create",
    {
      title: "Create Excalidraw Diagram",
      description:
        "Create a new Excalidraw diagram (.excalidraw.md) inside the Obsidian vault.\n\n" +
        "IMPORTANT — vault discovery:\n" +
        "  Before calling this tool, use list_notes or get_vault_stats to understand the\n" +
        "  vault structure and pick a sensible relative path for the diagram. Never ask\n" +
        "  the user for the vault root; it is already configured in the server.\n\n" +
        "Args:\n" +
        "  - path (string): Relative path for the new file, e.g. 'Diagrams/my-flow.excalidraw.md'\n" +
        "  - title (string): Human-readable title shown at the top of the file (default: filename)\n" +
        "  - background_color (string): Canvas background colour (default: '#ffffff')\n" +
        "  - elements (array): Optional initial elements to draw\n" +
        "  - overwrite (boolean): Overwrite an existing file (default: false)\n\n" +
        "Returns: Confirmation with the relative path of the created diagram.",
      inputSchema: {
        path: z
          .string()
          .min(1)
          .describe(
            "Relative path for the new diagram inside the vault. " +
              "Must end in '.excalidraw.md', e.g. 'Diagrams/architecture.excalidraw.md'. " +
              "Derive this path from list_notes output — do NOT ask the user for the vault root."
          ),
        title: z
          .string()
          .optional()
          .describe("Human-readable title displayed inside the file (defaults to filename)"),
        background_color: z
          .string()
          .default("#ffffff")
          .describe("Canvas background colour as CSS colour string (default '#ffffff')"),
        elements: z
          .array(ElementSchema)
          .default([])
          .describe("Optional initial elements to place on the canvas"),
        overwrite: z
          .boolean()
          .default(false)
          .describe("If true, overwrite an existing diagram"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ path: diagPath, title, background_color, elements, overwrite }) => {
      try {
        // Enforce .excalidraw.md extension
        const normPath = diagPath.endsWith(".excalidraw.md")
          ? diagPath
          : diagPath.replace(/\.md$/, "") + ".excalidraw.md";

        const abs = safePath(normPath);

        if (!overwrite) {
          try {
            await fs.access(abs);
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text:
                    `Error: Diagram already exists at '${normPath}'. ` +
                    `Set overwrite=true to replace it.`,
                },
              ],
            };
          } catch {
            // File doesn't exist — proceed
          }
        }

        const resolvedTitle = title ?? path.basename(normPath, ".excalidraw.md");
        const payload = emptyPayload();
        payload.appState.viewBackgroundColor = background_color;

        if (elements.length > 0) {
          payload.elements = buildElements(elements);
        }

        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, buildExcalidrawMd(payload, resolvedTitle), "utf-8");

        return {
          content: [
            {
              type: "text",
              text:
                `Excalidraw diagram created successfully.\n` +
                `Path     : ${normPath}\n` +
                `Elements : ${payload.elements.length}\n` +
                `Open it in Obsidian with the Excalidraw plugin to view the diagram.`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: fsError(error, diagPath) }],
        };
      }
    }
  );
}
