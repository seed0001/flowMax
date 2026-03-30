import type { WorkflowBlockId } from "@/lib/workflowBlocks";

/** LLM participates in Run conversation as one side of a pair. */
export type DualAgentSlot = "agentA" | "agentB";

export type MemoryContainerOp = "write" | "read" | "clear";

export type MemoryWriteMode = "append" | "replace";

export type RunStatus = "idle" | "running" | "ok" | "error";

export type LlmProvider = "ollama" | "openai";

export type DiscordBlockOp = "validate" | "send_message";

/** Persisted on each workflow block node — drives UI and execution. */
export type WorkflowBlockNodeData = {
  kind: WorkflowBlockId;
  label: string;
  description: string;
  accent: number;
  /** Last run (optional UI) */
  runStatus?: RunStatus;
  runMessage?: string;
  /** input */
  text?: string;
  /** instruction block (system prompt) */
  systemPrompt?: string;
  /** llm */
  llmProvider?: LlmProvider;
  model?: string;
  /** 0–2, passed to Ollama / OpenAI */
  temperature?: number;
  /** User message for this LLM step (merged with upstream context) */
  llmPrompt?: string;
  /** Overrides global Instruction for this LLM only (required for distinct agent personas). */
  llmSystemOverride?: string;
  /** Dual-agent: this LLM is Agent A or B (Run conversation only). */
  dualAgentSlot?: DualAgentSlot;
  /** @deprecated Old saves — maps to agentA / agentB in runner */
  conversationAgentRole?: "teacher" | "student";
  /** conversation hub — display names for transcript & prompts */
  conversationAgentALabel?: string;
  conversationAgentBLabel?: string;
  /** Who speaks first in the loop */
  conversationFirstSpeaker?: DualAgentSlot;
  /** Pause after each agent’s turn (ms) */
  conversationAgentADelayMs?: number;
  conversationAgentBDelayMs?: number;
  /** @deprecated use conversationAgentADelayMs / conversationAgentBDelayMs */
  conversationTeacherDelayMs?: number;
  conversationStudentDelayMs?: number;
  /** Total agent replies (A + B each count); 0 = unlimited until Stop */
  conversationMaxMessages?: number;
  /** memory — legacy static line merged into LLM context when memoryContainerOp is unset */
  memoryText?: string;
  /** memory container key (shared across blocks in one run) */
  memoryContainerKey?: string;
  memoryContainerOp?: MemoryContainerOp;
  memoryWriteMode?: MemoryWriteMode;
  /** sql */
  sqlTemplate?: string;
  /** timer — delay in milliseconds before downstream blocks run */
  timerDelayMs?: number;
  /** discord — validate token or post pipeline text to a channel */
  discordOp?: DiscordBlockOp;
  discordChannelId?: string;
  /** Dev override; prefer DISCORD_BOT_TOKEN on the API server */
  discordBotToken?: string;
  /** output — speak the resolved reply with Web Speech API before continuing */
  outputTts?: boolean;
};
