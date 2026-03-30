import type { Node } from "@xyflow/react";
import { postLlmChat } from "@/lib/api";
import {
  hubDisplayLabels,
  hubFirstSpeaker,
  hubTurnDelaysMs,
  normalizeDualAgentSlot,
} from "@/lib/dualAgentConfig";
import type { DualAgentSlot, RunStatus, WorkflowBlockNodeData } from "@/lib/workflowTypes";

type Line = { slot: DualAgentSlot; text: string };

function asData(n: Node): WorkflowBlockNodeData {
  return n.data as WorkflowBlockNodeData;
}

function wfBlocks(nodes: Node[]): Node[] {
  return nodes.filter((n) => n.type === "workflowBlock");
}

export function findDualAgentSetup(nodes: Node[]) {
  const wf = wfBlocks(nodes);
  const hub = wf.find((n) => asData(n).kind === "conversation");
  const agentA = wf.find(
    (n) => asData(n).kind === "llm" && normalizeDualAgentSlot(asData(n)) === "agentA"
  );
  const agentB = wf.find(
    (n) => asData(n).kind === "llm" && normalizeDualAgentSlot(asData(n)) === "agentB"
  );
  const seedInput = wf.find((n) => asData(n).kind === "input");
  const output = wf.find((n) => asData(n).kind === "output");
  return { hub, agentA, agentB, seedInput, output };
}

export function canRunDualAgentConversation(nodes: Node[]): boolean {
  const { agentA, agentB } = findDualAgentSetup(nodes);
  return Boolean(agentA && agentB);
}

function labelForSlot(slot: DualAgentSlot, labels: { a: string; b: string }): string {
  return slot === "agentA" ? labels.a : labels.b;
}

function buildUserPrompt(
  seed: string,
  lines: Line[],
  slot: DualAgentSlot,
  displayLabels: { a: string; b: string }
): string {
  const transcript = lines
    .map((l) => `${labelForSlot(l.slot, displayLabels)}: ${l.text}`)
    .join("\n\n");
  const who = labelForSlot(slot, displayLabels);
  return [
    `Opening topic:\n${seed}`,
    transcript ? `Conversation so far:\n${transcript}` : "",
    "",
    `Write only your next reply as "${who}". Stay in character. One turn only — no stage directions or meta commentary. Keep length reasonable unless the topic needs more detail.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = window.setTimeout(() => resolve(), ms);
    const onAbort = () => {
      window.clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function callAgent(
  node: Node,
  seed: string,
  lines: Line[],
  slot: DualAgentSlot,
  displayLabels: { a: string; b: string }
): Promise<string> {
  const data = asData(node);
  const system = (data.llmSystemOverride ?? "").trim() || "You are a helpful assistant.";
  const provider = data.llmProvider === "openai" ? "openai" : "ollama";
  const model =
    data.model?.trim() || (provider === "ollama" ? "llama3.2" : "gpt-4o-mini");
  const temperature =
    typeof data.temperature === "number" && !Number.isNaN(data.temperature)
      ? Math.min(2, Math.max(0, data.temperature))
      : 0.7;
  const extra = (data.llmPrompt ?? "").trim();
  let userContent = buildUserPrompt(seed, lines, slot, displayLabels);
  if (extra) {
    userContent += `\n\nAdditional note for this agent: ${extra}`;
  }
  const res = await postLlmChat({
    provider,
    model,
    temperature,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
  });
  return res.content;
}

export type DualAgentPatch = {
  nodeId: string;
  runStatus: RunStatus;
  runMessage?: string;
};

function otherSlot(s: DualAgentSlot): DualAgentSlot {
  return s === "agentA" ? "agentB" : "agentA";
}

export async function runDualAgentConversation(
  nodes: Node[],
  options: {
    signal: AbortSignal;
    onPatches: (patches: DualAgentPatch[]) => void;
  }
): Promise<{ ok: boolean; error?: string; stopped?: boolean }> {
  const { hub, agentA, agentB, seedInput, output } = findDualAgentSetup(nodes);
  if (!agentA || !agentB) {
    return {
      ok: false,
      error: "Need two LLM blocks: set slot to Agent A on one and Agent B on the other.",
    };
  }

  const hubData = hub ? asData(hub) : undefined;
  const displayLabels = hubDisplayLabels(hubData);
  const delays = hubTurnDelaysMs(hubData);
  const maxMessages =
    typeof hubData?.conversationMaxMessages === "number" &&
    !Number.isNaN(hubData.conversationMaxMessages)
      ? Math.max(0, Math.floor(hubData.conversationMaxMessages))
      : 0;

  const seed =
    (seedInput && (asData(seedInput).text ?? "").trim()) ||
    "Begin a substantive conversation based on the agents’ instructions.";

  const lines: Line[] = [];
  let messagesSpoken = 0;
  let current: DualAgentSlot = hubFirstSpeaker(hubData);

  const apply = (patches: DualAgentPatch[]) => options.onPatches(patches);

  if (hub) {
    apply([
      {
        nodeId: hub.id,
        runStatus: "running",
        runMessage: "Conversation running… use Stop to end.",
      },
    ]);
  }

  try {
    while (true) {
      if (options.signal.aborted) {
        if (hub) {
          apply([{ nodeId: hub.id, runStatus: "ok", runMessage: "Stopped by you." }]);
        }
        return { ok: true, stopped: true };
      }
      if (maxMessages > 0 && messagesSpoken >= maxMessages) {
        if (hub) {
          apply([
            {
              nodeId: hub.id,
              runStatus: "ok",
              runMessage: `Finished after ${maxMessages} message(s).`,
            },
          ]);
        }
        return { ok: true };
      }

      const node = current === "agentA" ? agentA : agentB;
      const delayMs = current === "agentA" ? delays.a : delays.b;
      const name = labelForSlot(current, displayLabels);

      apply([{ nodeId: node.id, runStatus: "running", runMessage: "Thinking…" }]);
      const reply = await callAgent(node, seed, lines, current, displayLabels);
      lines.push({ slot: current, text: reply });
      messagesSpoken += 1;
      const preview = reply.length > 420 ? `${reply.slice(0, 420)}…` : reply;
      const outPatches: DualAgentPatch[] = [
        { nodeId: node.id, runStatus: "ok", runMessage: preview },
      ];
      if (output) {
        outPatches.push({
          nodeId: output.id,
          runStatus: "ok",
          runMessage: `${name}: ${preview}`,
        });
      }
      apply(outPatches);

      if (maxMessages > 0 && messagesSpoken >= maxMessages) {
        if (hub) {
          apply([
            {
              nodeId: hub.id,
              runStatus: "ok",
              runMessage: `Finished after ${maxMessages} message(s).`,
            },
          ]);
        }
        return { ok: true };
      }

      try {
        await sleep(delayMs, options.signal);
      } catch {
        if (hub) {
          apply([{ nodeId: hub.id, runStatus: "ok", runMessage: "Stopped by you." }]);
        }
        return { ok: true, stopped: true };
      }

      current = otherSlot(current);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    apply([
      { nodeId: agentA.id, runStatus: "error", runMessage: msg },
      { nodeId: agentB.id, runStatus: "error", runMessage: msg },
    ]);
    if (hub) {
      apply([{ nodeId: hub.id, runStatus: "error", runMessage: msg }]);
    }
    return { ok: false, error: msg };
  }
}
