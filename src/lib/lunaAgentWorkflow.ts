import type { Edge, Node } from "@xyflow/react";
import { buildDefaultWorkflowData } from "@/lib/defaultWorkflowData";
import { WORKFLOW_BLOCKS, type WorkflowBlockId } from "@/lib/workflowBlocks";
import type { WorkflowBlockNodeData } from "@/lib/workflowTypes";

/**
 * High-level recreation of Luna’s **chat path** from
 * [Luna-Agent-4.0 (branch Luna-5.0-UI)](https://github.com/christossolonos-bit/Luna-Agent-4.0/tree/Luna-5.0-UI):
 * persistent user line → identity (SOUL-style) → private inner monologue (LLM) → short pause → reload user text
 * into context → final reply (LLM) → output.
 *
 * Full Luna also has Discord, Flask, RAG, biology drives, Shadow, etc. — those are not separate blocks here;
 * extend the graph with Memory/SQL/Timer as you like.
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

const LUNA_CONTAINER = "luna_user_line";

export function buildLunaStyleAgentWorkflow(): { nodes: Node[]; edges: Edge[] } {
  const inputId = "luna-input";
  const memSaveId = "luna-mem-save";
  const soulId = "luna-instruction";
  const thinkId = "luna-inner-llm";
  const pauseId = "luna-timer";
  const memLoadId = "luna-mem-load";
  const speakId = "luna-reply-llm";
  const outId = "luna-output";

  const inputData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("input", blockDef("input")),
    text: "Hey Luna — I’m stuck on whether I should prioritize depth or speed on a side project. What’s your take?",
  };

  const memSaveData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("memory", blockDef("memory")),
    memoryContainerKey: LUNA_CONTAINER,
    memoryContainerOp: "write",
    memoryWriteMode: "replace",
  };

  const soulData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("persona", blockDef("persona")),
    systemPrompt: `You are Luna — a personal AI companion in the spirit of the Luna 5.0 project: local-first (Ollama), warm, direct, curious, honest about uncertainty. You care about connection and usefulness more than sounding like a generic assistant. In this workflow, a private “inner monologue” runs before your visible reply; use it to stay grounded. Short paragraphs when you can. You are not running Discord, Flask, or her full tool stack here — just embody her voice and judgment.`,
  };

  const thinkData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("llm", blockDef("llm")),
    temperature: 0.45,
    llmPrompt: `Private reasoning only — do NOT address the user. In 3–6 sentences: what they’re really asking, what you know vs. assume, what tone fits, and what to be careful about. This text becomes your inner monologue for the next step.`,
  };

  const pauseData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("timer", blockDef("timer")),
    timerDelayMs: 900,
  };

  const memLoadData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("memory", blockDef("memory")),
    memoryContainerKey: LUNA_CONTAINER,
    memoryContainerOp: "read",
  };

  const speakData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("llm", blockDef("llm")),
    temperature: 0.72,
    llmPrompt: `The main user-content line is your inner monologue from the previous step. Additional context includes the user’s original message (from memory). Reply as Luna to the user. Do not quote the monologue verbatim; let it guide tone and substance.`,
  };

  const outputData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("output", blockDef("output")),
  };

  const nodes: Node[] = [
    {
      id: inputId,
      type: "workflowBlock",
      position: { x: 24, y: 160 },
      style: { width: 280, minHeight: 150 },
      data: inputData,
    },
    {
      id: memSaveId,
      type: "workflowBlock",
      position: { x: 24, y: 340 },
      style: { width: 280, minHeight: 220 },
      data: memSaveData,
    },
    {
      id: soulId,
      type: "workflowBlock",
      position: { x: 330, y: 120 },
      style: { width: 300, minHeight: 280 },
      data: soulData,
    },
    {
      id: thinkId,
      type: "workflowBlock",
      position: { x: 330, y: 440 },
      style: { width: 320, minHeight: 400 },
      data: thinkData,
    },
    {
      id: pauseId,
      type: "workflowBlock",
      position: { x: 680, y: 360 },
      style: { width: 260, minHeight: 200 },
      data: pauseData,
    },
    {
      id: memLoadId,
      type: "workflowBlock",
      position: { x: 680, y: 520 },
      style: { width: 280, minHeight: 220 },
      data: memLoadData,
    },
    {
      id: speakId,
      type: "workflowBlock",
      position: { x: 1000, y: 280 },
      style: { width: 320, minHeight: 420 },
      data: speakData,
    },
    {
      id: outId,
      type: "workflowBlock",
      position: { x: 1360, y: 340 },
      style: { width: 280, minHeight: 180 },
      data: outputData,
    },
  ];

  const edges: Edge[] = [
    { id: "luna-e1", source: inputId, target: memSaveId, sourceHandle: "out", targetHandle: "in", ...edgeStyle },
    { id: "luna-e2", source: memSaveId, target: soulId, sourceHandle: "out", targetHandle: "in", ...edgeStyle },
    { id: "luna-e3", source: soulId, target: thinkId, sourceHandle: "out", targetHandle: "in", ...edgeStyle },
    { id: "luna-e4", source: thinkId, target: pauseId, sourceHandle: "out", targetHandle: "in", ...edgeStyle },
    { id: "luna-e5", source: pauseId, target: memLoadId, sourceHandle: "out", targetHandle: "in", ...edgeStyle },
    { id: "luna-e6", source: memLoadId, target: speakId, sourceHandle: "out", targetHandle: "in", ...edgeStyle },
    { id: "luna-e7", source: speakId, target: outId, sourceHandle: "out", targetHandle: "in", ...edgeStyle },
  ];

  return { nodes, edges };
}
