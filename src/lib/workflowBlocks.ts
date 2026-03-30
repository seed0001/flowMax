/** Starter blocks for the left palette — click adds a node you can wire on the canvas. */

export type WorkflowBlockId =
  | "input"
  | "conversation"
  | "persona"
  | "llm"
  | "llmModels"
  | "memory"
  | "sql"
  | "timer"
  | "discord"
  | "output";

export type WorkflowBlockDef = {
  id: WorkflowBlockId;
  label: string;
  description: string;
  accent: number;
};

export const WORKFLOW_BLOCKS: WorkflowBlockDef[] = [
  {
    id: "input",
    label: "Input",
    description: "Message or trigger in",
    accent: 0,
  },
  {
    id: "conversation",
    label: "Conversation",
    description: "Two-agent hub: names, pauses, who speaks first",
    accent: 7,
  },
  {
    id: "persona",
    label: "Instruction",
    description: "System instructions for the model",
    accent: 1,
  },
  {
    id: "llm",
    label: "LLM",
    description: "Model call",
    accent: 2,
  },
  {
    id: "llmModels",
    label: "LLM models",
    description: "List Ollama models via /api/llm/models",
    accent: 8,
  },
  {
    id: "memory",
    label: "Memory",
    description: "Container: save pipeline text, read into context, or clear",
    accent: 3,
  },
  {
    id: "sql",
    label: "SQL",
    description: "Run SQLite on app.db (template + placeholders)",
    accent: 6,
  },
  {
    id: "timer",
    label: "Timer",
    description: "Wait, then continue the flow",
    accent: 5,
  },
  {
    id: "discord",
    label: "Discord",
    description: "Validate bot token or send upstream text to a channel",
    accent: 9,
  },
  {
    id: "output",
    label: "Output",
    description: "Reply or channel out",
    accent: 4,
  },
];
