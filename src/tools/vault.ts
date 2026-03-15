/**
 * tools/vault.ts
 *
 * Vault-level informational tools.
 *   - get_vault_stats
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";
import { VAULT_ROOT, fsError, collectMarkdownFiles } from "../config.js";

export function registerGetVaultStats(server: McpServer): void {
  server.registerTool(
    "get_vault_stats",
    {
      title: "Get Vault Stats",
      description:
        "Get statistics about the Obsidian vault: total notes, total size, " +
        "directory count, last modified note, and vault path.\n\n" +
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
}
