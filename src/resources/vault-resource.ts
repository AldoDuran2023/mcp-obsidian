/**
 * resources/vault-resource.ts
 *
 * MCP Resources expose static or dynamic data that the model can read as
 * context without invoking a tool. Think of them as "files the model can open".
 *
 * Registered resources:
 *   - obsidian://vault/index   – live list of all notes (URI template)
 *   - obsidian://vault/note/{path} – content of a specific note (URI template)
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { VAULT_ROOT, safePath, fsError, collectMarkdownFiles } from "../config.js";

// ---------------------------------------------------------------------------
// obsidian://vault/index  — index of all notes
// ---------------------------------------------------------------------------

export function registerVaultIndexResource(server: McpServer): void {
  server.registerResource(
    "vault-index",
    "obsidian://vault/index",
    {
      title: "Vault Note Index",
      description:
        "A live index of every Markdown note in the Obsidian vault. " +
        "Returns a JSON object with total_notes and a sorted list of relative paths.",
      mimeType: "application/json",
    },
    async (_uri) => {
      const notes = await collectMarkdownFiles(VAULT_ROOT);
      const payload = {
        vault_path: VAULT_ROOT,
        total_notes: notes.length,
        notes,
      };
      return {
        contents: [
          {
            uri: "obsidian://vault/index",
            mimeType: "application/json",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  );
}

// ---------------------------------------------------------------------------
// obsidian://vault/note/{path}  — content of a single note
// ---------------------------------------------------------------------------

export function registerNoteContentResource(server: McpServer): void {
  server.registerResource(
    "vault-note",
    new ResourceTemplate("obsidian://vault/note/{path}", { list: undefined }),
    {
      title: "Vault Note Content",
      description:
        "Read the raw Markdown content of a specific note. " +
        "Use the URI pattern obsidian://vault/note/<relative-path>, " +
        "e.g. obsidian://vault/note/Projects/ideas.md",
      mimeType: "text/markdown",
    },
    async (uri: URL) => {
      // Extract the relative path from the URI
      const prefix = "obsidian://vault/note/";
      const rawPath = decodeURIComponent(uri.href.slice(prefix.length));

      try {
        const abs = safePath(rawPath);
        const content = await fs.readFile(abs, "utf-8");
        const stat = await fs.stat(abs);

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/markdown",
              text: content,
            },
          ],
        };
      } catch (error) {
        // Resources cannot return isError — surface error as text content
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: fsError(error, rawPath),
            },
          ],
        };
      }
    }
  );
}
