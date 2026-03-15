/**
 * tools/notes-read.ts
 *
 * Read-only tools for accessing note content and searching.
 *   - read_note
 *   - search_notes
 *   - list_notes
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { VAULT_ROOT, safePath, fsError, collectMarkdownFiles } from "../config.js";

// ---------------------------------------------------------------------------
// read_note
// ---------------------------------------------------------------------------

export function registerReadNote(server: McpServer): void {
  server.registerTool(
    "read_note",
    {
      title: "Read Note",
      description:
        "Read the full content of a Markdown note from the Obsidian vault.\n\n" +
        "Args:\n" +
        "  - path (string): Relative path to the note, e.g. 'Projects/ideas.md'\n\n" +
        "Returns: The complete file content as a string.",
      inputSchema: {
        path: z
          .string()
          .min(1, "Path is required")
          .describe("Relative path to the note inside the vault, e.g. 'Projects/ideas.md'"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ path: notePath }) => {
      try {
        const abs = safePath(notePath);
        const content = await fs.readFile(abs, "utf-8");
        return { content: [{ type: "text", text: content }] };
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
// search_notes
// ---------------------------------------------------------------------------

const SearchInEnum = z.enum(["content", "filename", "both"]);

export function registerSearchNotes(server: McpServer): void {
  server.registerTool(
    "search_notes",
    {
      title: "Search Notes",
      description:
        "Search for notes in the vault by filename and/or content. Case-insensitive.\n\n" +
        "Args:\n" +
        "  - query (string): Search term\n" +
        "  - search_in ('content' | 'filename' | 'both'): Where to search (default: 'both')\n" +
        "  - max_results (number): Maximum results to return (default: 20)\n\n" +
        "Returns: Array of matching notes with path, preview, and match count.",
      inputSchema: {
        query: z.string().min(1).describe("Search term (case-insensitive)"),
        search_in: SearchInEnum.default("both").describe(
          "Where to search: 'content', 'filename', or 'both'"
        ),
        max_results: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .describe("Maximum number of results to return"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, search_in, max_results }) => {
      try {
        const files = await collectMarkdownFiles(VAULT_ROOT);
        const lowerQuery = query.toLowerCase();

        interface SearchResult {
          path: string;
          preview: string;
          match_count: number;
        }
        const results: SearchResult[] = [];

        for (const relPath of files) {
          if (results.length >= max_results) break;

          let matchCount = 0;
          let preview = "";

          if (search_in === "filename" || search_in === "both") {
            const name = path.basename(relPath).toLowerCase();
            if (name.includes(lowerQuery)) {
              matchCount += 1;
              preview = relPath;
            }
          }

          if (search_in === "content" || search_in === "both") {
            try {
              const abs = path.join(VAULT_ROOT, relPath);
              const content = await fs.readFile(abs, "utf-8");
              const lowerContent = content.toLowerCase();
              let idx = 0;
              let contentMatches = 0;
              while ((idx = lowerContent.indexOf(lowerQuery, idx)) !== -1) {
                contentMatches++;
                idx += lowerQuery.length;
              }
              if (contentMatches > 0) {
                matchCount += contentMatches;
                const firstIdx = lowerContent.indexOf(lowerQuery);
                const start = Math.max(0, firstIdx - 40);
                const end = Math.min(content.length, firstIdx + 200);
                preview = content.slice(start, end).replace(/\n/g, " ");
              }
            } catch {
              // Skip unreadable files
            }
          }

          if (matchCount > 0) {
            results.push({
              path: relPath,
              preview: preview.slice(0, 200),
              match_count: matchCount,
            });
          }
        }

        const output = { query, total_results: results.length, results };
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: fsError(error, "search") }],
        };
      }
    }
  );
}

// ---------------------------------------------------------------------------
// list_notes
// ---------------------------------------------------------------------------

export function registerListNotes(server: McpServer): void {
  server.registerTool(
    "list_notes",
    {
      title: "List Notes",
      description:
        "List all Markdown (.md) notes in the vault or a subdirectory, recursively.\n\n" +
        "Args:\n" +
        "  - directory (string): Subdirectory relative to vault root (default: '' = entire vault)\n\n" +
        "Returns: Alphabetically sorted array of relative paths.",
      inputSchema: {
        directory: z
          .string()
          .default("")
          .describe(
            "Subdirectory to list, relative to vault root. Empty string = entire vault."
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

        const files = await collectMarkdownFiles(targetDir);
        const output = {
          directory: directory || "/",
          total_notes: files.length,
          notes: files,
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
