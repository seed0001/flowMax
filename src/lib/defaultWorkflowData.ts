import type { WorkflowBlockDef, WorkflowBlockId } from "@/lib/workflowBlocks";
import type { WorkflowBlockNodeData } from "@/lib/workflowTypes";

export function buildDefaultWorkflowData(
  kind: WorkflowBlockId,
  def: WorkflowBlockDef
): WorkflowBlockNodeData {
  const base: WorkflowBlockNodeData = {
    kind,
    label: def.label,
    description: def.description,
    accent: def.accent,
    runStatus: "idle",
  };

  switch (kind) {
    case "input":
      return { ...base, text: "Hello!" };
    case "conversation":
      return {
        ...base,
        conversationAgentALabel: "Agent A",
        conversationAgentBLabel: "Agent B",
        conversationFirstSpeaker: "agentA",
        conversationAgentADelayMs: 2800,
        conversationAgentBDelayMs: 3400,
        conversationMaxMessages: 0,
      };
    case "persona":
      return {
        ...base,
        systemPrompt: "You are a helpful, concise assistant. Follow these instructions.",
      };
    case "llm":
      return {
        ...base,
        llmProvider: "ollama",
        model: "llama3.2",
        temperature: 0.7,
        llmPrompt: "",
      };
    case "llmModels":
      return { ...base };
    case "memory":
      return {
        ...base,
        memoryContainerKey: "default",
        memoryContainerOp: "write",
        memoryWriteMode: "replace",
      };
    case "sql":
      return {
        ...base,
        sqlTemplate: "SELECT id, title, body FROM notes ORDER BY id DESC LIMIT 10;",
      };
    case "timer":
      return { ...base, timerDelayMs: 1000 };
    case "discord":
      return {
        ...base,
        discordOp: "validate",
        discordChannelId: "",
        discordBotToken: "",
      };
    case "output":
      return { ...base, outputTts: false };
    default:
      return base;
  }
}
