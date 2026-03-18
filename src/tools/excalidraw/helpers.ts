/**
 * tools/excalidraw/helpers.ts
 *
 * Pure utility functions shared by all Excalidraw tools:
 *  - emptyPayload()          — build a blank Excalidraw JSON object
 *  - buildExcalidrawMd()     — render a payload as .excalidraw.md content
 *  - parseExcalidrawMd()     — extract the payload from .excalidraw.md content
 *  - updateExcalidrawMd()    — replace the JSON block inside existing md content
 *  - collectExcalidrawFiles()— recursively find all .excalidraw.md files
 *  - randomId()              — short random ID (Excalidraw style)
 *  - buildElements()         — convert LLM element descriptors → raw elements
 */

import fs from "node:fs/promises";
import path from "node:path";
import { VAULT_ROOT } from "../../config.js";
import type { ExcalidrawElement, ExcalidrawPayload, ElementInput } from "./types.js";

// ---------------------------------------------------------------------------
// Payload factories
// ---------------------------------------------------------------------------

/** Build a fresh, empty Excalidraw JSON payload. */
export function emptyPayload(): ExcalidrawPayload {
  return {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements: [],
    appState: {
      gridSize: null,
      viewBackgroundColor: "#ffffff",
    },
    files: {},
  };
}

// ---------------------------------------------------------------------------
// Markdown serialisation / deserialisation
// ---------------------------------------------------------------------------

/**
 * Wrap a payload in the `.excalidraw.md` Markdown format that the
 * Obsidian Excalidraw plugin expects.
 */
export function buildExcalidrawMd(payload: ExcalidrawPayload, title: string): string {
  const json = JSON.stringify(payload, null, 2);

  const textLines = payload.elements
    .filter((el) => el.type === "text" && el.text)
    .map((el) => `${el.text} ^${el.id}`)
    .join("\n\n");

  return [
    `---`,
    `excalidraw-plugin: parsed`,
    `tags: [excalidraw]`,
    `---`,
    ``,
    `==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==`,
    ``,
    ``,
    `# ${title}`,
    ``,
    `%%`,
    `# Drawing`,
    `\`\`\`json`,
    json,
    `\`\`\``,
    `%%`,
    ``,
    `## Text Elements`,
    textLines || "",
    ``,
  ].join("\n");
}

/**
 * Parse the Excalidraw JSON payload out of an `.excalidraw.md` file.
 * Returns null if the file does not contain a valid payload.
 */
export function parseExcalidrawMd(content: string): ExcalidrawPayload | null {
  const match = content.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const payload = JSON.parse(match[1]) as ExcalidrawPayload;
    if (payload.type !== "excalidraw") return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Replace the JSON code block inside an `.excalidraw.md` file with a
 * freshly serialised payload, then regenerate the Text Elements section.
 */
export function updateExcalidrawMd(content: string, payload: ExcalidrawPayload): string {
  const json = JSON.stringify(payload, null, 2);

  const updated = content.replace(
    /(```json\s*)([\s\S]*?)(```)/,
    `$1${json}\n$3`
  );

  const textLines = payload.elements
    .filter((el) => el.type === "text" && el.text)
    .map((el) => `${el.text} ^${el.id}`)
    .join("\n\n");

  return updated.replace(
    /(## Text Elements\n)([\s\S]*?)(\n*$)/,
    `$1${textLines}\n`
  );
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

/**
 * Recursively collect all `.excalidraw.md` files under a directory.
 * Returns paths relative to the vault root, sorted alphabetically.
 */
export async function collectExcalidrawFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".excalidraw.md")) {
        results.push(path.relative(VAULT_ROOT, full));
      }
    }
  }

  await walk(dir);
  return results.sort();
}

// ---------------------------------------------------------------------------
// Element building
// ---------------------------------------------------------------------------

/** Generate a short, random id (Excalidraw style). */
export function randomId(): string {
  return Math.random().toString(36).slice(2, 11);
}

const BASE_DEFAULTS = {
  angle: 0,
  strokeStyle: "solid" as const,
  opacity: 100,
  groupIds: [] as string[],
  frameId: null,
  roundness: null,
  isDeleted: false,
  boundElements: [] as unknown[],
  link: null,
  locked: false,
  version: 1,
};

/**
 * Convert high-level ElementInput descriptors (from LLM) into raw
 * ExcalidrawElement objects ready to be pushed into the payload.
 */
export function buildElements(inputs: ElementInput[]): ExcalidrawElement[] {
  const result: ExcalidrawElement[] = [];

  for (const inp of inputs) {
    const id = randomId();
    const now = Date.now();

    const base: Partial<ExcalidrawElement> = {
      ...BASE_DEFAULTS,
      id,
      x: inp.x,
      y: inp.y,
      width: inp.width,
      height: inp.height,
      strokeColor: inp.strokeColor,
      backgroundColor: inp.backgroundColor,
      fillStyle: inp.fillStyle,
      roughness: inp.roughness,
      strokeWidth: inp.strokeWidth,
      seed: Math.floor(Math.random() * 2 ** 31),
      versionNonce: Math.floor(Math.random() * 2 ** 31),
      updated: now,
    };

    // ── text ──────────────────────────────────────────────────────────────
    if (inp.type === "text") {
      result.push({
        ...base,
        type: "text",
        text: inp.label ?? "",
        originalText: inp.label ?? "",
        fontSize: inp.fontSize,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: null,
        baseline: inp.fontSize ? Math.round(inp.fontSize * 0.8) : 16,
      } as ExcalidrawElement);
      continue;
    }

    // ── arrow / line ──────────────────────────────────────────────────────
    if (inp.type === "arrow" || inp.type === "line") {
      const points: [number, number][] =
        inp.points && inp.points.length >= 2 ? inp.points : [[0, 0], [inp.width, 0]];
      result.push({
        ...base,
        type: inp.type,
        points,
        startArrowhead: inp.startArrowhead ?? null,
        endArrowhead: inp.type === "arrow" ? (inp.endArrowhead ?? "arrow") : null,
        startBinding: null,
        endBinding: null,
        roundness: { type: 2 },
      } as ExcalidrawElement);
      continue;
    }

    // ── rectangle / ellipse / diamond ─────────────────────────────────────
    const shapeId = id;
    result.push({
      ...base,
      id: shapeId,
      type: inp.type,
      roundness: inp.type === "rectangle" ? { type: 3 } : null,
    } as ExcalidrawElement);

    // Bound text label
    if (inp.label) {
      const textId = randomId();
      const labelWidth = inp.label.length * (inp.fontSize / 2);
      result.push({
        ...BASE_DEFAULTS,
        id: textId,
        type: "text",
        x: inp.x + inp.width / 2 - labelWidth / 2,
        y: inp.y + inp.height / 2 - inp.fontSize / 2,
        width: labelWidth,
        height: inp.fontSize * 1.25,
        text: inp.label,
        originalText: inp.label,
        fontSize: inp.fontSize,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: shapeId,
        baseline: Math.round(inp.fontSize * 0.8),
        strokeColor: inp.strokeColor,
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: inp.strokeWidth,
        roughness: inp.roughness,
        seed: Math.floor(Math.random() * 2 ** 31),
        versionNonce: Math.floor(Math.random() * 2 ** 31),
        updated: now,
      } as ExcalidrawElement);

      // Register bound text on the shape
      const shape = result[result.length - 2];
      shape.boundElements = [{ type: "text", id: textId }];
    }
  }

  return result;
}
