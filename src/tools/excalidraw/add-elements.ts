/**
 * tools/excalidraw/add-elements.ts
 *
 * Tool: excalidraw_add_elements
 * Appends one or more elements to an existing Excalidraw diagram without
 * erasing its current content.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "node:fs/promises";
import { safePath, fsError } from "../../config.js";
import { ElementSchema } from "./types.js";
import { parseExcalidrawMd, updateExcalidrawMd, buildElements } from "./helpers.js";

export function registerExcalidrawAddElements(server: McpServer): void {
  server.registerTool(
    "excalidraw_add_elements",
    {
      title: "Add Elements to Excalidraw Diagram",
      description:
        "Append one or more new elements (shapes, text, arrows, lines) to an existing " +
        "Excalidraw diagram without erasing current content.\n\n" +
        "Supported element types:\n" +
        "  • rectangle, ellipse, diamond — basic shapes\n" +
        "  • text    — standalone text block\n" +
        "  • arrow   — directed connector (with configurable arrowheads)\n" +
        "  • line    — undirected line\n" +
        "  • freedraw — freehand stroke\n\n" +
        "Args:\n" +
        "  - path (string): Relative path to the .excalidraw.md file\n" +
        "  - elements (array): One or more element descriptors\n\n" +
        "Returns: Updated total element count and the IDs of just-added elements.",
      inputSchema: {
        path: z
          .string()
          .min(1)
          .describe("Relative path to the existing Excalidraw diagram inside the vault"),
        elements: z
          .array(ElementSchema)
          .min(1)
          .describe("Elements to add. Each item describes one drawable object."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ path: diagPath, elements }) => {
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
                text: `Error: '${diagPath}' does not contain a valid Excalidraw JSON payload.`,
              },
            ],
          };
        }

        const newElements = buildElements(elements);
        payload.elements.push(...newElements);

        await fs.writeFile(abs, updateExcalidrawMd(content, payload), "utf-8");

        const addedIds = newElements.map((el) => el.id);
        const totalActive = payload.elements.filter((e) => !e.isDeleted).length;

        return {
          content: [
            {
              type: "text",
              text:
                `Elements added successfully to '${diagPath}'.\n` +
                `Total elements now : ${totalActive}\n` +
                `Added IDs          : ${addedIds.join(", ")}`,
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
