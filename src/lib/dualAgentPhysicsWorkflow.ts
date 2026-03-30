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
 * Example two-agent graph (physics tutoring). Labels here are sample data only — the engine uses whatever you set on the Conversation hub + LLM blocks.
 */
export function buildDualAgentPhysicsWorkflow(): { nodes: Node[]; edges: Edge[] } {
  const inputId = "da-input";
  const hubId = "da-conversation";
  const agentAId = "da-agent-a";
  const agentBId = "da-agent-b";
  const outputId = "da-output";

  const inputData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("input", blockDef("input")),
    text: "I'd like to understand Newton's second law, F = m·a. Why does a heavy box feel harder to accelerate than a light one, even if I push the same way?",
  };

  const hubData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("conversation", blockDef("conversation")),
    conversationAgentALabel: "Physics teacher",
    conversationAgentBLabel: "Student",
    conversationFirstSpeaker: "agentA",
    conversationAgentADelayMs: 3000,
    conversationAgentBDelayMs: 3800,
    conversationMaxMessages: 0,
  };

  const agentAData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("llm", blockDef("llm")),
    dualAgentSlot: "agentA",
    temperature: 0.65,
    llmSystemOverride: `You are Ms. Rivera, a patient high school physics teacher. You explain clearly, use concrete examples, and gently correct mistakes. You sometimes ask a short check-for-understanding question. You are warm and never condescending. Keep each reply to a few short paragraphs.`,
    llmPrompt:
      "Stay on the opening topic unless your partner has clearly moved to a related physics question. Nudge toward real understanding, not jargon dumps.",
  };

  const agentBData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("llm", blockDef("llm")),
    dualAgentSlot: "agentB",
    temperature: 0.88,
    llmSystemOverride: `You are Alex, a curious tenth grader in Ms. Rivera's class. You speak casually, ask real questions, and sometimes confuse force, mass, and acceleration — that's okay. You can mention everyday stuff (sports, carts, phones) but stay in the conversation.`,
    llmPrompt: "Respond to what your partner just said. It's fine to be wrong sometimes; you're learning out loud.",
  };

  const outputData: WorkflowBlockNodeData = {
    ...buildDefaultWorkflowData("output", blockDef("output")),
  };

  const nodes: Node[] = [
    {
      id: inputId,
      type: "workflowBlock",
      position: { x: 32, y: 100 },
      style: { width: 280, minHeight: 150 },
      data: inputData,
    },
    {
      id: hubId,
      type: "workflowBlock",
      position: { x: 32, y: 290 },
      style: { width: 300, minHeight: 380 },
      data: hubData,
    },
    {
      id: agentAId,
      type: "workflowBlock",
      position: { x: 380, y: 20 },
      style: { width: 320, minHeight: 480 },
      data: agentAData,
    },
    {
      id: agentBId,
      type: "workflowBlock",
      position: { x: 380, y: 360 },
      style: { width: 320, minHeight: 480 },
      data: agentBData,
    },
    {
      id: outputId,
      type: "workflowBlock",
      position: { x: 760, y: 200 },
      style: { width: 280, minHeight: 200 },
      data: outputData,
    },
  ];

  const edges: Edge[] = [
    {
      id: "da-e-in-hub",
      source: inputId,
      target: hubId,
      sourceHandle: "out",
      targetHandle: "in",
      ...edgeStyle,
    },
    {
      id: "da-e-hub-a",
      source: hubId,
      target: agentAId,
      sourceHandle: "out",
      targetHandle: "in",
      ...edgeStyle,
    },
    {
      id: "da-e-hub-b",
      source: hubId,
      target: agentBId,
      sourceHandle: "out",
      targetHandle: "in",
      ...edgeStyle,
    },
    {
      id: "da-e-a-out",
      source: agentAId,
      target: outputId,
      sourceHandle: "out",
      targetHandle: "in",
      ...edgeStyle,
    },
    {
      id: "da-e-b-out",
      source: agentBId,
      target: outputId,
      sourceHandle: "out",
      targetHandle: "in",
      ...edgeStyle,
    },
  ];

  return { nodes, edges };
}
