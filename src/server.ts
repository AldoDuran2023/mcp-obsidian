#!/usr/bin/env node
/**
 * MCP Server for Obsidian Vault.
 *
 * Provides tools for AI agents to interact with an Obsidian vault
 * stored on the local filesystem. All operations are pure filesystem
 * operations — no Obsidian API dependency.
 *
 * Transport: stdio
 * Logging: stderr only (never stdout)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

dotenv.config();

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH;

if (!VAULT_PATH) {
  console.error(
    "ERROR: OBSIDIAN_VAULT_PATH environment variable is required.\n" +
      "Set it in a .env file or pass it directly."
  );
  process.exit(1);
}

const VAULT_ROOT = path.resolve(VAULT_PATH);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a relative note path to an absolute path inside the vault.
 *  Throws if the resolved path escapes the vault root (path traversal). */
function safePath(relativePath: string): string {
  const resolved = path.resolve(VAULT_ROOT, relativePath);
  if (!resolved.startsWith(VAULT_ROOT + path.sep) && resolved !== VAULT_ROOT) {
    throw new Error(
      `Security error: path "${relativePath}" resolves outside the vault.`
    );
  }
  return resolved;
}

/** Human-readable filesystem error messages. */
function fsError(error: unknown, context: string): string {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    switch (code) {
      case "ENOENT":
        return `Not found: ${context}`;
      case "EACCES":
        return `Permission denied: ${context}`;
      case "EEXIST":
        return `Already exists: ${context}`;
      case "EISDIR":
        return `Is a directory, not a file: ${context}`;
      default:
        return `Filesystem error (${code ?? "unknown"}): ${error.message}`;
    }
  }
  return `Unexpected error: ${String(error)}`;
}

/** Recursively collect all .md files under a directory.
 *  Returns paths relative to the vault root. */
async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return; // skip unreadable dirs
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(path.relative(VAULT_ROOT, full));
      }
    }
  }

  await walk(dir);
  return results.sort();
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "obsidian-mcp-server",
  version: "1.0.0",
});

// ---- 1. read_note --------------------------------------------------------

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

// ---- 2. create_note ------------------------------------------------------

server.registerTool(
  "create_note",
  {
    title: "Create Note",
    description:
      "Create a new Markdown note in the Obsidian vault. Intermediate directories are created automatically.\n\n" +
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

      // Check existence when overwrite is false
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

      // Create intermediate directories
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

// ---- 3. edit_note --------------------------------------------------------

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

      // Verify file exists first
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

// ---- 4. append_to_note ---------------------------------------------------

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

      // Verify file exists
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

// ---- 5. search_notes -----------------------------------------------------

const SearchInEnum = z.enum(["content", "filename", "both"]);

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

        // Filename search
        if (search_in === "filename" || search_in === "both") {
          const name = path.basename(relPath).toLowerCase();
          if (name.includes(lowerQuery)) {
            matchCount += 1;
            preview = relPath;
          }
        }

        // Content search
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
              // Extract a preview around the first match
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

      const output = {
        query,
        total_results: results.length,
        results,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: fsError(error, "search") }],
      };
    }
  }
);

// ---- 6. list_notes -------------------------------------------------------

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

      // Verify directory exists
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

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: fsError(error, directory || "/") }],
      };
    }
  }
);

// ---- 7. delete_note ------------------------------------------------------

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

      // Verify file exists
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

// ---- 8. get_vault_stats --------------------------------------------------

server.registerTool(
  "get_vault_stats",
  {
    title: "Get Vault Stats",
    description:
      "Get statistics about the Obsidian vault: total notes, total size, directory count, last modified note, and vault path.\n\n" +
      "Args: none\n\n" +
      "Returns: Object with vault statistics.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    try {
      const allFiles = await collectMarkdownFiles(VAULT_ROOT);
      let totalSizeBytes = 0;
      const directories = new Set<string>();
      let lastModified = { path: "", mtime: new Date(0) };

      for (const relPath of allFiles) {
        const abs = path.join(VAULT_ROOT, relPath);
        try {
          const stat = await fs.stat(abs);
          totalSizeBytes += stat.size;

          const dir = path.dirname(relPath);
          if (dir !== ".") directories.add(dir);

          if (stat.mtime > lastModified.mtime) {
            lastModified = { path: relPath, mtime: stat.mtime };
          }
        } catch {
          // skip unreadable files
        }
      }

      const output = {
        total_notes: allFiles.length,
        total_size_kb: Math.round(totalSizeBytes / 1024),
        directories: directories.size,
        last_modified_note: lastModified.path || null,
        vault_path: VAULT_ROOT,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: fsError(error, "vault stats") }],
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Validate vault path
  try {
    const stat = await fs.stat(VAULT_ROOT);
    if (!stat.isDirectory()) {
      console.error(`ERROR: OBSIDIAN_VAULT_PATH is not a directory: ${VAULT_ROOT}`);
      process.exit(1);
    }
  } catch {
    console.error(`ERROR: Cannot access vault at: ${VAULT_ROOT}`);
    process.exit(1);
  }

  // Log startup info to stderr
  const noteCount = (await collectMarkdownFiles(VAULT_ROOT)).length;
  console.error(`Obsidian MCP Server starting...`);
  console.error(`  Vault: ${VAULT_ROOT}`);
  console.error(`  Notes found: ${noteCount}`);

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server running via stdio");
}

main().catch((error) => {
  console.error("Fatal server error:", error);
  process.exit(1);
});
