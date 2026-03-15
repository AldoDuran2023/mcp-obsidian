/**
 * config.ts
 *
 * Shared configuration, path-safety helpers and filesystem utilities.
 * All other modules import from here — never from each other.
 */

import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";

dotenv.config();

// ---------------------------------------------------------------------------
// Vault configuration
// ---------------------------------------------------------------------------

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH;

if (!VAULT_PATH) {
  console.error(
    "ERROR: OBSIDIAN_VAULT_PATH environment variable is required.\n" +
      "Set it in a .env file or pass it directly."
  );
  process.exit(1);
}

export const VAULT_ROOT = path.resolve(VAULT_PATH);

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a relative note path to an absolute path inside the vault.
 * Throws if the resolved path escapes the vault root (path traversal).
 */
export function safePath(relativePath: string): string {
  const resolved = path.resolve(VAULT_ROOT, relativePath);
  if (!resolved.startsWith(VAULT_ROOT + path.sep) && resolved !== VAULT_ROOT) {
    throw new Error(
      `Security error: path "${relativePath}" resolves outside the vault.`
    );
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Error formatting
// ---------------------------------------------------------------------------

/** Convert a filesystem error into a human-readable message. */
export function fsError(error: unknown, context: string): string {
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

// ---------------------------------------------------------------------------
// Filesystem utilities
// ---------------------------------------------------------------------------

/**
 * Recursively collect all .md files under a directory.
 * Returns paths relative to the vault root, sorted alphabetically.
 */
export async function collectMarkdownFiles(dir: string): Promise<string[]> {
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
