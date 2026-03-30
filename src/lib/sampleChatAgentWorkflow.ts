import type { Edge, Node } from "@xyflow/react";
import { buildDefaultWorkflowData } from "@/lib/defaultWorkflowData";
import { WORKFLOW_BLOCKS, type WorkflowBlockId } from "@/lib/workflowBlocks";
import type { WorkflowBlockNodeData } from "@/lib/workflowTypes";

function blockDef(id: WorkflowBlockId) {
  const b = WORKFLOW_BLOCKS.find((x) => x.id === id);
  if (!b) throw new Error(`Missing workflow block: ${id}`);
  return b;
}

const edgeStyle = {
  animated: true as const,
  style: { stroke: "rgba(139, 146, 163, 0.55)", strokeWidth: 2 },
};

/**
 * Example graph: user message → instruction → local LLM → final reply.
 * Load from Library → Example workflows (not placed on canvas by default).
 */
export function buildSampleChatAgentWorkflow(): { nodes: Node[]; edges: Edge[] } {
  const inputId = "sample-chat-input";
  const instructionId = "sample-chat-instruction";
  const llmId = "sample-chat-llm";
  const outputId = "sample-chat-output";

  const inputData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("input", blockDef("input")),
    text: "Hi! Can you explain what you do in one short paragraph?",
  };

  const instructionData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("persona", blockDef("persona")),
    systemPrompt: `You are a friendly chat assistant for a small app. Be warm, clear, and concise. Use short paragraphs. If you don't know something, say so honestly.`,
  };

  const llmData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("llm", blockDef("llm")),
    llmPrompt:
      "Answer the user's message following the instructions above. Be brief unless they ask for detail.",
  };

  const outputData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("output", blockDef("output")),
  };

  const nodes: Node[] = [
    {
      id: inputId,
      type: "workflowBlock",
      position: { x: 32, y: 140 },
      style: { width: 280, minHeight: 150 },
      data: inputData,
    },
    {
      id: instructionId,
      type: "workflowBlock",
      position: { x: 340, y: 100 },
      style: { width: 300, minHeight: 240 },
      data: instructionData,
    },
    {
      id: llmId,
      type: "workflowBlock",
      position: { x: 668, y: 72 },
      style: { width: 320, minHeight: 420 },
      data: llmData,
    },
    {
      id: outputId,
      type: "workflowBlock",
      position: { x: 1020, y: 140 },
      style: { width: 280, minHeight: 170 },
      data: outputData,
    },
  ];

  const edges: Edge[] = [
    {
      id: "e-sample-in-instruction",
      source: inputId,
      target: instructionId,
      sourceHandle: "out",
      targetHandle: "in",
      ...edgeStyle,
    },
    {
      id: "e-sample-instruction-llm",
      source: instructionId,
      target: llmId,
      sourceHandle: "out",
      targetHandle: "in",
      ...edgeStyle,
    },
    {
      id: "e-sample-llm-out",
      source: llmId,
      target: outputId,
      sourceHandle: "out",
      targetHandle: "in",
      ...edgeStyle,
    },
  ];

  return { nodes, edges };
}

/** Input → LLM → Output only (no Instruction block). */
export function buildDirectLlmChatWorkflow(): { nodes: Node[]; edges: Edge[] } {
  const inputId = "sample-direct-input";
  const llmId = "sample-direct-llm";
  const outputId = "sample-direct-output";

  const inputData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("input", blockDef("input")),
    text: "Summarize what a workflow canvas is in two sentences.",
  };

  const llmData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("llm", blockDef("llm")),
    llmPrompt: "Answer the user's message directly. Be clear and concise.",
  };

  const outputData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("output", blockDef("output")),
  };

  const nodes: Node[] = [
    {
      id: inputId,
      type: "workflowBlock",
      position: { x: 80, y: 160 },
      style: { width: 280, minHeight: 150 },
      data: inputData,
    },
    {
      id: llmId,
      type: "workflowBlock",
      position: { x: 420, y: 120 },
      style: { width: 320, minHeight: 420 },
      data: llmData,
    },
    {
      id: outputId,
      type: "workflowBlock",
      position: { x: 800, y: 180 },
      style: { width: 280, minHeight: 170 },
      data: outputData,
    },
  ];

  const edges: Edge[] = [
    {
      id: "e-direct-in-llm",
      source: inputId,
      target: llmId,
      sourceHandle: "out",
      targetHandle: "in",
      ...edgeStyle,
    },
    {
      id: "e-direct-llm-out",
      source: llmId,
      target: outputId,
      sourceHandle: "out",
      targetHandle: "in",
      ...edgeStyle,
    },
  ];

  return { nodes, edges };
}
