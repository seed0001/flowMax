import type { Edge, Node } from "@xyflow/react";
import { buildDefaultWorkflowData } from "@/lib/defaultWorkflowData";
import { WORKFLOW_BLOCKS, type WorkflowBlockId } from "@/lib/workflowBlocks";
import type { WorkflowBlockNodeData } from "@/lib/workflowTypes";

/**
 * Library sample derived from this repo’s actual runtime surface:
 * - Input / Instruction / LLM / Output — core chat path (`POST /api/llm/chat`)
 * - LLM models — `GET /api/llm/models` (Ollama tags)
 * - SQL, Memory, Timer, Conversation blocks exist for other flows but are optional here
 *
 * Wire: user ask → persona → refresh model list → LLM reasons with list → output
 */
function blockDef(id: WorkflowBlockId) {
  const b = WORKFLOW_BLOCKS.find((x) => x.id === id);
  if (!b) throw new Error(`Missing workflow block: ${id}`);
  return b;
}

const edgeStyle = {
  animated: true as const,
  style: { stroke: "rgba(139, 146, 163, 0.55)", strokeWidth: 2 },
};

export function buildFlowCanvasStackAgentWorkflow(): { nodes: Node[]; edges: Edge[] } {
  const inputId = "fca-input";
  const instId = "fca-instruction";
  const modelsId = "fca-llm-models";
  const llmId = "fca-llm";
  const outId = "fca-output";

  const inputData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("input", blockDef("input")),
    text: "Using the model list attached below: pick one installed model that’s a good default for short, clear answers in this app, and say why in two sentences.",
  };

  const instData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("persona", blockDef("persona")),
    systemPrompt: `You are the in-app assistant for Flow Canvas. The stack is: a Vite/React UI, an Express API on port 3001 (proxied as /api), local Ollama for LLM calls, and SQLite (data/app.db) with tables like notes and kv_store. You give concise, accurate guidance. If model data is missing or errored, say what to check (Ollama running, npm run dev, etc.).`,
  };

  const modelsData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("llmModels", blockDef("llmModels")),
  };

  const llmData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("llm", blockDef("llm")),
    llmPrompt:
      "Follow the user’s request. The previous block appended the live Ollama model list (or an error) to the conversation text.",
  };

  const outputData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("output", blockDef("output")),
  };

  const nodes: Node[] = [
    {
      id: inputId,
      type: "workflowBlock",
      position: { x: 40, y: 140 },
      style: { width: 280, minHeight: 150 },
      data: inputData,
    },
    {
      id: instId,
      type: "workflowBlock",
      position: { x: 360, y: 120 },
      style: { width: 300, minHeight: 260 },
      data: instData,
    },
    {
      id: modelsId,
      type: "workflowBlock",
      position: { x: 360, y: 420 },
      style: { width: 280, minHeight: 160 },
      data: modelsData,
    },
    {
      id: llmId,
      type: "workflowBlock",
      position: { x: 700, y: 180 },
      style: { width: 320, minHeight: 420 },
      data: llmData,
    },
    {
      id: outId,
      type: "workflowBlock",
      position: { x: 1060, y: 220 },
      style: { width: 280, minHeight: 190 },
      data: outputData,
    },
  ];

  const edges: Edge[] = [
    { id: "fca-e1", source: inputId, target: instId, sourceHandle: "out", targetHandle: "in", ...edgeStyle },
    { id: "fca-e2", source: instId, target: modelsId, sourceHandle: "out", targetHandle: "in", ...edgeStyle },
    { id: "fca-e3", source: modelsId, target: llmId, sourceHandle: "out", targetHandle: "in", ...edgeStyle },
    { id: "fca-e4", source: llmId, target: outId, sourceHandle: "out", targetHandle: "in", ...edgeStyle },
  ];

  return { nodes, edges };
}
