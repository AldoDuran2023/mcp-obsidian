/**
 * prompts/excalidraw-prompts.ts
 *
 * MCP Prompts that guide the model to create and explore Excalidraw diagrams
 * autonomously — without asking the user for vault paths or diagram locations.
 *
 * Registered prompts:
 *   - create_excalidraw_diagram  → scaffold a diagram from a description
 *   - review_excalidraw_diagrams → list and summarise all diagrams in the vault
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// create_excalidraw_diagram
// ---------------------------------------------------------------------------

export function registerCreateExcalidrawDiagramPrompt(server: McpServer): void {
  server.registerPrompt(
    "create_excalidraw_diagram",
    {
      title: "Create Excalidraw Diagram",
      description:
        "Scaffold an Excalidraw diagram (.excalidraw.md) from a plain-text description. " +
        "The model will autonomously explore the vault structure, pick a suitable location, " +
        "and create the file — no path information required from the user.",
      argsSchema: {
        description: z
          .string()
          .min(1)
          .describe(
            "Natural-language description of what to draw. " +
              "Example: 'UML deployment diagram for a Next.js app on Vercel with a Postgres DB on Render'"
          ),
        diagram_type: z
          .enum([
            "flowchart",
            "uml-deployment",
            "uml-class",
            "uml-sequence",
            "architecture",
            "mind-map",
            "entity-relationship",
            "free-form",
          ])
          .default("free-form")
          .describe("The type of diagram to draw (guides element layout)"),
        related_note: z
          .string()
          .optional()
          .describe(
            "Optional: a keyword or partial path of an existing note related to this diagram. " +
              "The model will search for it and place the diagram nearby."
          ),
      },
    },
    ({ description, diagram_type, related_note }) => {
      const discoverySteps = related_note
        ? `2. Use search_notes to find notes matching "${related_note}" and identify the best ` +
          `folder for the diagram (place it alongside the related note or in a sibling folder).\n`
        : `2. Use list_notes to browse the vault structure and choose the most suitable folder ` +
          `(prefer existing 'Diagrams', 'Assets', 'Media', or 'Arquitectura' folders; ` +
          `create a 'Diagramas/' folder next to related notes if none exist).\n`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `Create an Excalidraw diagram for the following:\n\n` +
                `Description : ${description}\n` +
                `Diagram type: ${diagram_type}\n\n` +
                `--- INSTRUCTIONS ---\n\n` +
                `Follow these steps strictly. Do NOT ask the user for vault paths or ` +
                `diagram locations — discover them yourself using the available tools.\n\n` +
                `1. Call get_vault_stats to learn the vault root and overall structure.\n` +
                discoverySteps +
                `3. Derive a descriptive filename in snake_case ending in ".excalidraw.md", ` +
                `e.g. "deployment_architecture.excalidraw.md".\n` +
                `4. Design the diagram elements based on the description and diagram type:\n` +
                `   - ${diagram_type === "uml-deployment" ? "Use rectangles for servers/services, diamonds for databases, arrows for connections. Label every node." : ""}\n`.replace(/\n   - \n/, "\n") +
                `   - ${diagram_type === "flowchart" ? "Use rectangles for steps, diamonds for decisions, arrows for flow." : ""}\n`.replace(/\n   - \n/, "\n") +
                `   - ${diagram_type === "architecture" ? "Use rectangles for components/layers, arrows for data flow, text labels for protocols." : ""}\n`.replace(/\n   - \n/, "\n") +
                `   - For generic types: use rectangles for main concepts, arrows for relationships, text for labels.\n` +
                `   - Lay elements out clearly (spread x/y coordinates so elements do not overlap).\n` +
                `   - Use at least 6 elements for a non-trivial diagram.\n` +
                `5. Call excalidraw_create with the chosen path, title, and elements.\n` +
                `6. Report back with:\n` +
                `   - The relative path where the diagram was created\n` +
                `   - A brief list of elements that were drawn\n` +
                `   - Any design decisions made (folder choice, naming, etc.)\n\n` +
                `Remember: the vault root is already configured in the MCP server — ` +
                `only use relative paths in tool calls.`,
            },
          },
        ],
      };
    }
  );
}

// ---------------------------------------------------------------------------
// review_excalidraw_diagrams
// ---------------------------------------------------------------------------

export function registerReviewExcalidrawDiagramsPrompt(server: McpServer): void {
  server.registerPrompt(
    "review_excalidraw_diagrams",
    {
      title: "Review Excalidraw Diagrams",
      description:
        "List all Excalidraw diagrams in the vault and provide a concise summary of each, " +
        "including element count and suggested improvements.",
      argsSchema: {
        directory: z
          .string()
          .default("")
          .describe("Subdirectory to scope the review (empty = entire vault)"),
      },
    },
    ({ directory }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Review all Excalidraw diagrams in the vault${directory ? ` under '${directory}'` : ""}.\n\n` +
              `Steps:\n` +
              `1. Call excalidraw_list${directory ? ` with directory="${directory}"` : ""} to get all diagram paths.\n` +
              `2. For each diagram, call excalidraw_read to inspect its elements.\n` +
              `3. Produce a structured report with:\n` +
              `   - Diagram path and element count\n` +
              `   - Short description of what the diagram represents (inferred from elements)\n` +
              `   - Suggestions for improvement (missing labels, missing connections, etc.)\n` +
              `Keep the report concise and prioritise actionable insights.`,
          },
        },
      ],
    })
  );
}
