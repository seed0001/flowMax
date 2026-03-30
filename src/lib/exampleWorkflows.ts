import type { Edge, Node } from "@xyflow/react";
import { buildDualAgentPhysicsWorkflow } from "@/lib/dualAgentPhysicsWorkflow";
import { buildFlowCanvasStackAgentWorkflow } from "@/lib/flowCanvasStackAgentWorkflow";
import { buildLunaStyleAgentWorkflow } from "@/lib/lunaAgentWorkflow";
import { buildDirectLlmChatWorkflow, buildSampleChatAgentWorkflow } from "@/lib/sampleChatAgentWorkflow";

export type ExampleWorkflowEntry = {
  id: string;
  label: string;
  description: string;
  build: () => { nodes: Node[]; edges: Edge[] };
};

/**
 * Curated graphs users can load from the Library sidebar.
 * Add entries here as you ship more templates.
 */
export const EXAMPLE_WORKFLOWS: ExampleWorkflowEntry[] = [
  {
    id: "simple-chat-agent",
    label: "Simple chat agent",
    description: "Input → Instruction → LLM → Output with starter prompts.",
    build: buildSampleChatAgentWorkflow,
  },
  {
    id: "direct-llm",
    label: "Direct LLM reply",
    description: "Input → LLM → Output, no Instruction block.",
    build: buildDirectLlmChatWorkflow,
  },
  {
    id: "dual-agent-physics",
    label: "Dual agent: physics tutoring",
    description:
      "Two LLM agents (example: physics tutor + student) with configurable labels and pauses. Run conversation, then Stop.",
    build: buildDualAgentPhysicsWorkflow,
  },
  {
    id: "flow-canvas-stack-agent",
    label: "This repo: stack assistant",
    description:
      "Maps this project’s API: Instruction → LLM models list → LLM → Output. Needs dev server + Ollama.",
    build: buildFlowCanvasStackAgentWorkflow,
  },
  {
    id: "luna-style-agent",
    label: "Luna-style agent (inner mono → reply)",
    description:
      "Modeled on christossolonos-bit/Luna-Agent-4.0 (Luna-5.0-UI): save user line, SOUL-style Instruction, inner-thought LLM, Timer, Memory read, reply LLM, Output.",
    build: buildLunaStyleAgentWorkflow,
  },
];

export function getExampleWorkflowById(id: string): ExampleWorkflowEntry | undefined {
  return EXAMPLE_WORKFLOWS.find((w) => w.id === id);
}
