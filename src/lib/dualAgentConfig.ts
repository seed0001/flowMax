import type { DualAgentSlot, WorkflowBlockNodeData } from "@/lib/workflowTypes";

/** Resolve slot from current or legacy saved graphs. */
export function normalizeDualAgentSlot(d: WorkflowBlockNodeData): DualAgentSlot | undefined {
  if (d.dualAgentSlot === "agentA" || d.dualAgentSlot === "agentB") {
    return d.dualAgentSlot;
  }
  if (d.conversationAgentRole === "teacher") return "agentA";
  if (d.conversationAgentRole === "student") return "agentB";
  return undefined;
}

export function hubDisplayLabels(hub?: WorkflowBlockNodeData): { a: string; b: string } {
  const a = (hub?.conversationAgentALabel ?? "").trim() || "Agent A";
  const b = (hub?.conversationAgentBLabel ?? "").trim() || "Agent B";
  return { a, b };
}

export function hubTurnDelaysMs(hub?: WorkflowBlockNodeData): { a: number; b: number } {
  let rawA = hub?.conversationAgentADelayMs;
  let rawB = hub?.conversationAgentBDelayMs;
  if (typeof rawA !== "number" || Number.isNaN(rawA)) {
    const leg = hub?.conversationTeacherDelayMs;
    rawA = typeof leg === "number" && !Number.isNaN(leg) ? leg : 2800;
  }
  if (typeof rawB !== "number" || Number.isNaN(rawB)) {
    const leg = hub?.conversationStudentDelayMs;
    rawB = typeof leg === "number" && !Number.isNaN(leg) ? leg : 3400;
  }
  return {
    a: Math.min(120_000, Math.max(0, Math.round(rawA))),
    b: Math.min(120_000, Math.max(0, Math.round(rawB))),
  };
}

export function hubFirstSpeaker(hub?: WorkflowBlockNodeData): DualAgentSlot {
  return hub?.conversationFirstSpeaker === "agentB" ? "agentB" : "agentA";
}
