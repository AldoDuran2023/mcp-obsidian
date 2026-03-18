/**
 * tools/excalidraw/types.ts
 *
 * Shared TypeScript interfaces and the Zod element schema used across all
 * Excalidraw tool modules.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Core domain types
// ---------------------------------------------------------------------------

/** Minimal representation of a single Excalidraw element. */
export interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: string | null;
  roundness: { type: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: unknown[];
  updated: number;
  link: string | null;
  locked: boolean;
  /** Only for text elements */
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  baseline?: number;
  containerId?: string | null;
  originalText?: string;
  /** Only for arrow / line elements */
  points?: [number, number][];
  startBinding?: unknown;
  endBinding?: unknown;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  [key: string]: unknown;
}

/** Top-level structure of the Excalidraw JSON payload. */
export interface ExcalidrawPayload {
  type: "excalidraw";
  version: number;
  source: string;
  elements: ExcalidrawElement[];
  appState: {
    gridSize: number | null;
    viewBackgroundColor: string;
    [key: string]: unknown;
  };
  files: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Zod schema for LLM-provided element descriptors
// ---------------------------------------------------------------------------

export const ElementSchema = z
  .object({
    type: z
      .enum(["rectangle", "ellipse", "diamond", "arrow", "line", "text", "freedraw"])
      .describe("Type of element to draw"),
    x: z.number().describe("X coordinate of the element on the canvas"),
    y: z.number().describe("Y coordinate of the element on the canvas"),
    width: z.number().default(160).describe("Width in pixels (default 160)"),
    height: z.number().default(80).describe("Height in pixels (default 80)"),
    label: z
      .string()
      .optional()
      .describe(
        "Text label. For 'text' elements this is the text itself. " +
          "For shapes it becomes an embedded text element bound to the shape."
      ),
    strokeColor: z
      .string()
      .default("#1e1e1e")
      .describe("Stroke colour as CSS colour string (default '#1e1e1e')"),
    backgroundColor: z
      .string()
      .default("transparent")
      .describe("Fill colour (default 'transparent')"),
    fillStyle: z
      .enum(["hachure", "cross-hatch", "solid", "zigzag", "dots"])
      .default("solid")
      .describe("Fill style (default 'solid')"),
    roughness: z
      .number()
      .int()
      .min(0)
      .max(2)
      .default(1)
      .describe("Roughness: 0 = smooth, 1 = normal, 2 = hand-drawn (default 1)"),
    strokeWidth: z.number().default(2).describe("Stroke width in pixels (default 2)"),
    fontSize: z.number().default(20).describe("Font size for text/label (default 20)"),
    points: z
      .array(z.tuple([z.number(), z.number()]))
      .optional()
      .describe(
        "For 'arrow' and 'line': list of [dx, dy] points relative to (x, y). " +
          "e.g. [[0, 0], [200, 0]] draws a horizontal line of 200 px."
      ),
    startArrowhead: z
      .enum([
        "arrow",
        "bar",
        "circle",
        "circle_outline",
        "triangle",
        "triangle_outline",
        "dot",
        "diamond",
        "diamond_outline",
      ])
      .nullable()
      .default(null)
      .describe("Arrowhead at the start of an arrow element (default null)"),
    endArrowhead: z
      .enum([
        "arrow",
        "bar",
        "circle",
        "circle_outline",
        "triangle",
        "triangle_outline",
        "dot",
        "diamond",
        "diamond_outline",
      ])
      .nullable()
      .default("arrow")
      .describe("Arrowhead at the end of an arrow element (default 'arrow')"),
  })
  .describe("Description of a single Excalidraw element to add to the diagram");

export type ElementInput = z.infer<typeof ElementSchema>;
