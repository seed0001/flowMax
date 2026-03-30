import type { Edge, Node } from "@xyflow/react";
import { fetchLlmModels, postDiscord, postLlmChat, postSql } from "@/lib/api";
import { normalizeDualAgentSlot } from "@/lib/dualAgentConfig";
import { compileSqlTemplate } from "@/lib/sqlTemplate";
import { speakText } from "@/lib/tts";
import type { WorkflowBlockId } from "@/lib/workflowBlocks";
import type { RunStatus, WorkflowBlockNodeData } from "@/lib/workflowTypes";

const KIND_ORDER: Record<WorkflowBlockId, number> = {
  input: 0,
  conversation: 1,
  persona: 2,
  memory: 3,
  sql: 4,
  timer: 5,
  llmModels: 6,
  llm: 7,
  discord: 8,
  output: 9,
};

export type RunStep = {
  nodeId: string;
  kind: string;
  status: RunStatus;
  message: string;
};

export type WorkflowRunResult = {
  ok: boolean;
  error?: string;
  summary?: string;
  steps: RunStep[];
  finalText?: string;
};

type ExecState = {
  system: string;
  user: string;
  memory: string;
  llmOutput: string;
  /** Named buckets — survives until the workflow run ends */
  memoryBank: Record<string, string>;
};

function memoryBankKey(data: WorkflowBlockNodeData): string {
  const k = (data.memoryContainerKey ?? "").trim() || "default";
  return k.slice(0, 64);
}

function workflowNodes(nodes: Node[]): Node[] {
  return nodes.filter((n) => n.type === "workflowBlock");
}

/** Nodes reachable from sources (in-degree 0) following edges forward. */
function reachableFromSources(nodes: Node[], edges: Edge[]): Set<string> {
  const ids = new Set(nodes.map((n) => n.id));
  const incomingTargets = new Set(edges.map((e) => e.target));
  const sources = nodes.filter((n) => !incomingTargets.has(n.id)).map((n) => n.id);

  if (sources.length === 0 && nodes.length > 0) {
    return ids;
  }

  const visited = new Set<string>();
  const queue = [...sources];
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const e of edges) {
      if (e.source === id && ids.has(e.target)) {
        queue.push(e.target);
      }
    }
  }
  return visited;
}

function topologicalSort(nodes: Node[], edges: Edge[]): string[] | null {
  const ids = nodes.map((n) => n.id);
  const idSet = new Set(ids);
  const inDegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const id of ids) {
    inDegree.set(id, 0);
    outgoing.set(id, []);
  }

  for (const e of edges) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
    outgoing.get(e.source)!.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const id of ids) {
    if ((inDegree.get(id) ?? 0) === 0) queue.push(id);
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const kindOf = (nid: string): WorkflowBlockId =>
    (byId.get(nid)?.data as WorkflowBlockNodeData).kind;

  const result: string[] = [];
  while (queue.length) {
    queue.sort((a, b) => KIND_ORDER[kindOf(a)] - KIND_ORDER[kindOf(b)]);
    const id = queue.shift()!;
    result.push(id);
    for (const next of outgoing.get(id) ?? []) {
      const d = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  if (result.length !== nodes.length) return null;
  return result;
}

function asData(n: Node): WorkflowBlockNodeData {
  return n.data as WorkflowBlockNodeData;
}

/**
 * Runs the workflow: walks blocks in topological order, applies input/instruction/memory,
 * calls LLM nodes in sequence (each call can chain from the previous output), writes final text to output nodes.
 */
export async function executeWorkflow(nodes: Node[], edges: Edge[]): Promise<WorkflowRunResult> {
  const wf = workflowNodes(nodes);
  if (wf.length === 0) {
    return { ok: false, error: "Add at least one block to the canvas.", steps: [] };
  }

  const reachable = reachableFromSources(wf, edges);
  const subNodes = wf.filter((n) => reachable.has(n.id));
  const subEdges = edges.filter(
    (e) => reachable.has(e.source) && reachable.has(e.target) && e.source !== e.target
  );

  const order = topologicalSort(subNodes, subEdges);
  if (!order) {
    return {
      ok: false,
      error: "The graph has a cycle. Remove a connection so execution can run in order.",
      steps: [],
    };
  }

  const state: ExecState = {
    system: "You are a helpful assistant.",
    user: "",
    memory: "",
    llmOutput: "",
    memoryBank: {},
  };

  const steps: RunStep[] = [];

  const pushStep = (nodeId: string, kind: string, status: RunStatus, message: string) => {
    steps.push({ nodeId, kind, status, message });
  };

  for (const id of order) {
    const node = subNodes.find((n) => n.id === id);
    if (!node) continue;
    const data = asData(node);
    const kind = data.kind;

    try {
      switch (kind) {
        case "input": {
          const t = (data.text ?? "").trim();
          state.user = t || "(empty input)";
          pushStep(id, kind, "ok", `User message set (${state.user.length} chars).`);
          break;
        }
        case "conversation": {
          pushStep(
            id,
            kind,
            "ok",
            "Dual-agent hub (labels, pauses, first speaker). Linear run does not loop — use Run conversation."
          );
          break;
        }
        case "persona": {
          const s = (data.systemPrompt ?? "").trim();
          if (s) state.system = s;
          pushStep(id, kind, "ok", "Instructions applied.");
          break;
        }
        case "memory": {
          if (data.memoryContainerOp === undefined) {
            const m = (data.memoryText ?? "").trim();
            if (m) {
              state.memory = state.memory ? `${state.memory}\n\n${m}` : m;
            }
            pushStep(
              id,
              kind,
              "ok",
              m ? "Legacy: static text merged into LLM context." : "Legacy memory block (empty)."
            );
            break;
          }

          const key = memoryBankKey(data);
          const op = data.memoryContainerOp;

          if (op === "write") {
            const payload = (state.llmOutput || state.user || "").trim();
            const mode = data.memoryWriteMode === "append" ? "append" : "replace";
            if (mode === "append") {
              const cur = state.memoryBank[key] ?? "";
              state.memoryBank[key] =
                cur && payload ? `${cur}\n\n${payload}` : cur || payload;
            } else {
              state.memoryBank[key] = payload;
            }
            pushStep(
              id,
              kind,
              "ok",
              `Container "${key}" ${mode === "append" ? "appended" : "set"} (${payload.length} chars).`
            );
            break;
          }

          if (op === "read") {
            const v = state.memoryBank[key] ?? "";
            state.memory = v;
            pushStep(
              id,
              kind,
              "ok",
              v ? `Read "${key}" into LLM context (${v.length} chars).` : `Container "${key}" is empty.`
            );
            break;
          }

          if (op === "clear") {
            state.memoryBank[key] = "";
            pushStep(id, kind, "ok", `Container "${key}" cleared.`);
            break;
          }

          pushStep(id, kind, "ok", "Memory: unknown operation.");
          break;
        }
        case "sql": {
          const template = (data.sqlTemplate ?? "").trim();
          if (!template) {
            const err = "SQL block has an empty template.";
            pushStep(id, kind, "error", err);
            return { ok: false, error: err, steps, finalText: state.llmOutput };
          }
          let compiled: string;
          try {
            compiled = compileSqlTemplate(template, {
              user: state.user,
              llmOutput: state.llmOutput,
              memory: state.memory,
              memoryBank: state.memoryBank,
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            pushStep(id, kind, "error", msg);
            return { ok: false, error: msg, steps, finalText: state.llmOutput };
          }
          const res = await postSql({ sql: compiled });
          if (res.kind === "rows") {
            const text = JSON.stringify(res.rows, null, 2);
            state.user = text;
            state.llmOutput = text;
            const note = res.truncated ? ` (truncated to ${res.rows.length} rows)` : "";
            pushStep(
              id,
              kind,
              "ok",
              `SELECT ${res.rowCount} row(s)${note}.`
            );
          } else {
            const text = `SQL run: changes=${res.changes}, lastInsertRowid=${res.lastInsertRowid ?? "null"}`;
            state.user = text;
            state.llmOutput = text;
            pushStep(id, kind, "ok", text);
          }
          state.memory = "";
          break;
        }
        case "timer": {
          const raw = typeof data.timerDelayMs === "number" && !Number.isNaN(data.timerDelayMs) ? data.timerDelayMs : 1000;
          const ms = Math.min(600_000, Math.max(0, Math.round(raw)));
          await new Promise<void>((r) => setTimeout(r, ms));
          pushStep(id, kind, "ok", `Waited ${ms} ms.`);
          break;
        }
        case "llmModels": {
          const r = await fetchLlmModels();
          const ids = (r.models ?? []).map((m) => m.id).join(", ");
          const modelBlock = r.error
            ? `Model list error: ${r.error}`
            : ids
              ? `Installed Ollama models (from /api/llm/models): ${ids}`
              : "No models returned from /api/llm/models — is Ollama running?";
          const prior = (state.user ?? "").trim();
          const merged = prior ? `${prior}\n\n---\n${modelBlock}` : modelBlock;
          state.user = merged;
          state.llmOutput = merged;
          state.memory = "";
          pushStep(id, kind, "ok", modelBlock.slice(0, 500));
          break;
        }
        case "discord": {
          const op = data.discordOp === "send_message" ? "send_message" : "validate";
          const tokenOverride = (data.discordBotToken ?? "").trim();
          const token = tokenOverride || undefined;
          const channelId = (data.discordChannelId ?? "").trim();

          if (op === "send_message") {
            if (!channelId) {
              const err = "Discord: set a channel id to send messages.";
              pushStep(id, kind, "error", err);
              return { ok: false, error: err, steps, finalText: state.llmOutput };
            }
            const content = (state.llmOutput || state.user || "").trim();
            if (!content) {
              const err = "Discord: nothing to send — upstream text is empty.";
              pushStep(id, kind, "error", err);
              return { ok: false, error: err, steps, finalText: state.llmOutput };
            }
            const res = await postDiscord({
              op: "send_message",
              channelId,
              content,
              token,
            });
            const line = res.summary ?? "Message sent.";
            state.user = line;
            state.llmOutput = line;
            state.memory = "";
            pushStep(id, kind, "ok", line);
            break;
          }

          const res = await postDiscord({ op: "validate", token });
          const line = res.summary ?? "Discord token ok.";
          state.user = line;
          state.llmOutput = line;
          state.memory = "";
          pushStep(id, kind, "ok", line);
          break;
        }
        case "llm": {
          {
            const dualSlot = normalizeDualAgentSlot(data);
            if (dualSlot) {
              pushStep(
                id,
                kind,
                "ok",
                `Skipped — dual-agent LLM (${dualSlot}). Use Run conversation.`
              );
              break;
            }
          }
          const provider = data.llmProvider === "openai" ? "openai" : "ollama";
          const model =
            data.model?.trim() ||
            (provider === "ollama" ? "llama3.2" : "gpt-4o-mini");
          const temperature =
            typeof data.temperature === "number" && !Number.isNaN(data.temperature)
              ? Math.min(2, Math.max(0, data.temperature))
              : 0.7;
          const blockPrompt = (data.llmPrompt ?? "").trim();
          const contextParts = [state.user, state.memory].filter(Boolean);
          const userContent = blockPrompt
            ? [...contextParts, blockPrompt].join("\n\n").trim()
            : contextParts.join("\n\n") || "Hello.";
          const systemContent = (data.llmSystemOverride ?? "").trim() || state.system;
          const res = await postLlmChat({
            provider,
            model,
            temperature,
            messages: [
              { role: "system", content: systemContent },
              { role: "user", content: userContent },
            ],
          });
          state.llmOutput = res.content;
          state.user = res.content;
          state.memory = "";
          pushStep(
            id,
            kind,
            "ok",
            res.mock
              ? `[Demo] ${res.content.slice(0, 200)}${res.content.length > 200 ? "…" : ""}`
              : res.content.slice(0, 400) + (res.content.length > 400 ? "…" : "")
          );
          break;
        }
        case "output": {
          const out = state.llmOutput || state.user || "(no upstream text)";
          if (data.outputTts) {
            await speakText(out);
          }
          pushStep(id, kind, "ok", out);
          break;
        }
        default:
          pushStep(id, kind, "ok", "Skipped.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      pushStep(id, kind, "error", msg);
      return {
        ok: false,
        error: msg,
        steps,
        finalText: state.llmOutput,
      };
    }
  }

  const lastOutput = [...order]
    .reverse()
    .map((nid) => subNodes.find((n) => n.id === nid))
    .find((n) => n && asData(n).kind === "output");

  const finalText = lastOutput
    ? steps.filter((s) => s.nodeId === lastOutput.id).pop()?.message ?? state.llmOutput
    : state.llmOutput;

  const summary = state.llmOutput
    ? `Finished. Last model output: ${state.llmOutput.slice(0, 120)}${state.llmOutput.length > 120 ? "…" : ""}`
    : "Finished (no LLM node ran — connect Input → Instruction → LLM or add an LLM block).";

  return {
    ok: true,
    summary,
    steps,
    finalText: finalText || state.llmOutput,
  };
}
