/**
 * prompts/vault-prompts.ts
 *
 * MCP Prompts are reusable, parameterized prompt templates that the model
 * (or the client) can invoke to get a structured conversation starter.
 * They differ from tools (which execute actions) and resources (which expose
 * data) — prompts guide HOW the model should reason about a task.
 *
 * Registered prompts:
 *   - summarize_note      → ask the model to summarize a note
 *   - create_note_draft   → scaffold a new note with a given topic and format
 *   - review_vault        → high-level vault review / organisation suggestions
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// summarize_note
// ---------------------------------------------------------------------------

export function registerSummarizeNotePrompt(server: McpServer): void {
  server.registerPrompt(
    "summarize_note",
    {
      title: "Summarize Note",
      description:
        "Generate a concise summary of an Obsidian note. " +
        "The model will read the note via read_note and produce a structured summary " +
        "covering key ideas, action items, and open questions.",
      argsSchema: {
        path: z
          .string()
          .min(1)
          .describe("Relative path to the note, e.g. 'Projects/ideas.md'"),
        style: z
          .enum(["bullet", "paragraph", "tldr"])
          .default("bullet")
          .describe("Output style: 'bullet' list, 'paragraph', or 'tldr' (one line)"),
      },
    },
    ({ path, style }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Please summarize the Obsidian note at path: "${path}".\n\n` +
              `Steps:\n` +
              `1. Use the read_note tool to read its content.\n` +
              `2. Produce a ${style === "tldr" ? "one-line TL;DR" : style === "paragraph" ? "paragraph summary" : "bullet-point summary"} covering:\n` +
              `   - Main topic / purpose\n` +
              `   - Key ideas or facts\n` +
              `   - Any action items or next steps\n` +
              `   - Open questions (if any)\n\n` +
              `Keep the summary concise and faithful to the original content.`,
          },
        },
      ],
    })
  );
}

// ---------------------------------------------------------------------------
// create_note_draft
// ---------------------------------------------------------------------------

export function registerCreateNoteDraftPrompt(server: McpServer): void {
  server.registerPrompt(
    "create_note_draft",
    {
      title: "Create Note Draft",
      description:
        "Scaffold a new Obsidian note for a given topic. " +
        "The model will produce a complete Markdown draft with YAML front-matter, " +
        "then optionally save it using the create_note tool.",
      argsSchema: {
        topic: z
          .string()
          .min(1)
          .describe("Topic or title for the new note"),
        format: z
          .enum(["meeting", "research", "task-list", "journal", "free-form"])
          .default("free-form")
          .describe("Template format to use"),
        save_to: z
          .string()
          .optional()
          .describe(
            "If provided, save the draft to this relative path using create_note. " +
            "Leave blank to only display the draft."
          ),
      },
    },
    ({ topic, format, save_to }) => {
      const saveInstruction = save_to
        ? `\n5. Once the draft is ready, save it to "${save_to}" using the create_note tool.`
        : "\n5. Display the draft to the user without saving.";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `Create a new Obsidian note draft about: "${topic}"\n\n` +
                `Format: ${format}\n\n` +
                `Steps:\n` +
                `1. Write a complete Markdown document with YAML front-matter (tags, date, status).\n` +
                `2. Follow the "${format}" template structure:\n` +
                `   - meeting: Attendees, Agenda, Notes, Action Items\n` +
                `   - research: Abstract, Context, Findings, References\n` +
                `   - task-list: Goal, Checklist, Notes\n` +
                `   - journal: Date, Reflection, Highlights, Tomorrow\n` +
                `   - free-form: Introduction, Body, Conclusion\n` +
                `3. Use clear headings, bullet points, and Obsidian-flavored Markdown where useful.\n` +
                `4. Leave placeholder text (e.g. <!-- TODO: ... -->) for sections that need human input.` +
                saveInstruction,
            },
          },
        ],
      };
    }
  );
}

// ---------------------------------------------------------------------------
// review_vault
// ---------------------------------------------------------------------------

export function registerReviewVaultPrompt(server: McpServer): void {
  server.registerPrompt(
    "review_vault",
    {
      title: "Review Vault",
      description:
        "Perform a high-level review of the Obsidian vault structure. " +
        "The model will inspect statistics and note distribution to provide " +
        "organisation suggestions, detect stale or orphaned notes, and highlight " +
        "areas of high activity.",
      argsSchema: {
        focus: z
          .enum(["structure", "activity", "full"])
          .default("full")
          .describe(
            "'structure' = folder organisation, " +
            "'activity' = recently modified notes, " +
            "'full' = both"
          ),
      },
    },
    ({ focus }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Perform a ${focus} review of my Obsidian vault.\n\n` +
              `Steps:\n` +
              `1. Call get_vault_stats to get an overview.\n` +
              `2. Call list_notes to see all note paths.\n` +
              (focus !== "structure"
                ? `3. Identify the most recently modified notes (hint: sort by modification date if possible).\n`
                : "") +
              (focus !== "activity"
                ? `3. Analyse the folder structure for depth, naming patterns, and potential clutter.\n`
                : "") +
              `4. Produce a structured report with:\n` +
              `   - Summary of vault size and organisation\n` +
              (focus !== "structure" ? `   - Activity hot-spots (folders/notes updated recently)\n` : "") +
              (focus !== "activity"
                ? `   - Structure observations (deep nesting, inconsistent naming, etc.)\n` +
                  `   - Top 3 actionable improvement suggestions\n`
                : "") +
              `Keep the report concise and prioritise actionable insights.`,
          },
        },
      ],
    })
  );
}
