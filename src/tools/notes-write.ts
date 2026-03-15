/**
 * tools/notes-write.ts
 *
 * Mutating tools for creating and modifying notes.
 *   - create_note
 *   - edit_note
 *   - append_to_note
 *   - delete_note
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { safePath, fsError } from "../config.js";

// ---------------------------------------------------------------------------
// create_note
// ---------------------------------------------------------------------------

export function registerCreateNote(server: McpServer): void {
  server.registerTool(
    "create_note",
    {
      title: "Create Note",
      description:
        "Create a new Markdown note in the Obsidian vault. " +
        "Intermediate directories are created automatically.\n\n" +
        "Args:\n" +
        "  - path (string): Relative path for the new note\n" +
        "  - content (string): Markdown content to write\n" +
        "  - overwrite (boolean): If true, overwrite an existing file (default: false)\n\n" +
        "Returns: Confirmation with the absolute path of the created file.",
      inputSchema: {
        path: z.string().min(1).describe("Relative path for the new note"),
        content: z.string().describe("Markdown content to write"),
        overwrite: z
          .boolean()
          .default(false)
          .describe("If true, overwrite an existing file"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ path: notePath, content, overwrite }) => {
      try {
        const abs = safePath(notePath);

        if (!overwrite) {
          try {
            await fs.access(abs);
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Error: Note already exists at '${notePath}'. Set overwrite=true to replace it.`,
                },
              ],
            };
          } catch {
            // File doesn't exist — good, proceed
          }
        }

        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, content, "utf-8");

        return {
          content: [
            {
              type: "text",
              text: `Note created successfully.\nPath: ${abs}`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: fsError(error, notePath) }],
        };
      }
    }
  );
}

// ---------------------------------------------------------------------------
// edit_note
// ---------------------------------------------------------------------------

export function registerEditNote(server: McpServer): void {
  server.registerTool(
    "edit_note",
    {
      title: "Edit Note",
      description:
        "Replace the entire content of an existing note. The file must already exist.\n\n" +
        "Args:\n" +
        "  - path (string): Relative path to the note\n" +
        "  - content (string): New Markdown content\n\n" +
        "Returns: Confirmation with the modification timestamp.",
      inputSchema: {
        path: z.string().min(1).describe("Relative path to the existing note"),
        content: z.string().describe("New content to replace the file with"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ path: notePath, content }) => {
      try {
        const abs = safePath(notePath);

        await fs.access(abs);
        await fs.writeFile(abs, content, "utf-8");
        const stat = await fs.stat(abs);

        return {
          content: [
            {
              type: "text",
              text:
                `Note updated successfully.\n` +
                `Path: ${notePath}\n` +
                `Modified: ${stat.mtime.toISOString()}`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: fsError(error, notePath) }],
        };
      }
    }
  );
}

// ---------------------------------------------------------------------------
// append_to_note
// ---------------------------------------------------------------------------

export function registerAppendToNote(server: McpServer): void {
  server.registerTool(
    "append_to_note",
    {
      title: "Append to Note",
      description:
        "Append content to the end of an existing note without erasing existing text.\n\n" +
        "Args:\n" +
        "  - path (string): Relative path to the note\n" +
        "  - content (string): Content to append\n" +
        "  - add_newline (boolean): Prepend a newline before the appended content (default: true)\n\n" +
        "Returns: Total character count of the file after the operation.",
      inputSchema: {
        path: z.string().min(1).describe("Relative path to the note"),
        content: z.string().describe("Content to append to the file"),
        add_newline: z
          .boolean()
          .default(true)
          .describe("Prepend a newline before the appended content"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ path: notePath, content, add_newline }) => {
      try {
        const abs = safePath(notePath);

        await fs.access(abs);

        const prefix = add_newline ? "\n" : "";
        await fs.appendFile(abs, prefix + content, "utf-8");

        const updated = await fs.readFile(abs, "utf-8");

        return {
          content: [
            {
              type: "text",
              text:
                `Content appended to '${notePath}'.\n` +
                `Total characters: ${updated.length}`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: fsError(error, notePath) }],
        };
      }
    }
  );
}

// ---------------------------------------------------------------------------
// delete_note
// ---------------------------------------------------------------------------

export function registerDeleteNote(server: McpServer): void {
  server.registerTool(
    "delete_note",
    {
      title: "Delete Note",
      description:
        "Delete a note from the vault. Requires explicit confirmation.\n\n" +
        "Args:\n" +
        "  - path (string): Relative path to the note\n" +
        "  - confirm (boolean): Must be true to actually delete. If false, performs a dry run.\n\n" +
        "Returns: Confirmation of deletion or a dry-run preview.",
      inputSchema: {
        path: z.string().min(1).describe("Relative path to the note to delete"),
        confirm: z
          .boolean()
          .describe("Set to true to actually delete the file. false = dry run."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ path: notePath, confirm }) => {
      try {
        const abs = safePath(notePath);

        const stat = await fs.stat(abs);
        if (!stat.isFile()) {
          return {
            isError: true,
            content: [
              { type: "text", text: `Error: '${notePath}' is not a file.` },
            ],
          };
        }

        if (!confirm) {
          return {
            content: [
              {
                type: "text",
                text:
                  `Dry run — would delete:\n` +
                  `  Path: ${notePath}\n` +
                  `  Size: ${stat.size} bytes\n` +
                  `  Modified: ${stat.mtime.toISOString()}\n\n` +
                  `Set confirm=true to proceed with deletion.`,
              },
            ],
          };
        }

        await fs.unlink(abs);

        return {
          content: [
            {
              type: "text",
              text: `Note deleted: ${notePath}`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: fsError(error, notePath) }],
        };
      }
    }
  );
}
