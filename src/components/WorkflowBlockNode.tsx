import { useCallback, useEffect, useState } from "react";
import {
  Handle,
  Position,
  useNodeId,
  useReactFlow,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import type { WorkflowBlockId } from "@/lib/workflowBlocks";
import { fetchLlmModels, type LlmModelInfo } from "@/lib/api";
import { hubTurnDelaysMs } from "@/lib/dualAgentConfig";
import type {
  DiscordBlockOp,
  DualAgentSlot,
  LlmProvider,
  MemoryContainerOp,
  WorkflowBlockNodeData,
} from "@/lib/workflowTypes";

function patchData(
  setNodes: (fn: (nodes: Node[]) => Node[]) => void,
  nodeId: string | null,
  partial: Partial<WorkflowBlockNodeData>
) {
  if (!nodeId) return;
  setNodes((nds) =>
    nds.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...partial } } : n
    )
  );
}

export function WorkflowBlockNode({ data, selected }: NodeProps) {
  const d = data as WorkflowBlockNodeData;
  const { setNodes } = useReactFlow();
  const nodeId = useNodeId();

  const patch = useCallback(
    (partial: Partial<WorkflowBlockNodeData>) => patchData(setNodes, nodeId, partial),
    [nodeId, setNodes]
  );

  const runBadge =
    d.runStatus && d.runStatus !== "idle" ? (
      <div
        className={`workflow-block__run workflow-block__run--${d.runStatus}`}
        title={d.runMessage ?? ""}
      >
        {d.runStatus === "ok" ? "✓" : d.runStatus === "error" ? "!" : "…"}
      </div>
    ) : null;

  const accentMod = d.accent === 9 ? 9 : d.accent % 9;
  const outputTts = d.kind === "output" && Boolean(d.outputTts);

  return (
    <div
      className={`workflow-block workflow-block--accent-${accentMod} ${selected ? "workflow-block--selected" : ""}${outputTts ? " workflow-block--output-tts" : ""}`}
    >
      <Handle type="target" position={Position.Left} id="in" className="wf-handle" />
      {runBadge}
      <span className="workflow-block__kicker">Block</span>
      <span className="workflow-block__title">{d.label}</span>
      <span className="workflow-block__desc">{d.description}</span>

      <BlockFields kind={d.kind} data={d} patch={patch} />

      {outputTts ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="out"
            className="wf-handle wf-handle--output-branch"
            style={{ top: "34%" }}
          />
          <div className="workflow-block__tts-tail">
            <span className="workflow-block__tts-tail-label">
              After speech — wire next blocks from either handle
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id="afterSpeak"
              className="wf-handle wf-handle--output-branch wf-handle--after-speak"
            />
          </div>
        </>
      ) : (
        <Handle type="source" position={Position.Right} id="out" className="wf-handle" />
      )}
    </div>
  );
}

function OllamaModelPicker({
  model,
  patch,
}: {
  model: string;
  patch: (p: Partial<WorkflowBlockNodeData>) => void;
}) {
  const [models, setModels] = useState<LlmModelInfo[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetchLlmModels();
      setModels(r.models);
      setErr(r.error ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ids = new Set(models.map((m) => m.id));
  const selectValue = ids.has(model) ? model : "";

  return (
    <div className="workflow-block__field">
      <div className="workflow-block__field-row">
        <span className="workflow-block__field-label">Model</span>
        <button
          type="button"
          className="workflow-block__icon-btn nodrag"
          onClick={() => void refresh()}
          disabled={loading}
          title="Refresh models from Ollama"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {loading ? "…" : "↻"}
        </button>
      </div>
      <select
        className="workflow-block__select nodrag"
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v) patch({ model: v });
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <option value="">— pick installed —</option>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.id}
          </option>
        ))}
      </select>
      <input
        type="text"
        className="workflow-block__input nodrag workflow-block__input--tight"
        value={model}
        onChange={(e) => patch({ model: e.target.value })}
        placeholder="e.g. llama3.2"
        onPointerDown={(e) => e.stopPropagation()}
      />
      {err && <p className="workflow-block__field-hint">{err}</p>}
    </div>
  );
}

function LlmBlockFields({
  data,
  patch,
}: {
  data: WorkflowBlockNodeData;
  patch: (p: Partial<WorkflowBlockNodeData>) => void;
}) {
  const provider: LlmProvider = data.llmProvider === "openai" ? "openai" : "ollama";
  const t = typeof data.temperature === "number" && !Number.isNaN(data.temperature) ? data.temperature : 0.7;

  return (
    <>
      <label className="workflow-block__field">
        <span className="workflow-block__field-label">Provider</span>
        <select
          className="workflow-block__select nodrag"
          value={provider}
          onChange={(e) => patch({ llmProvider: e.target.value as LlmProvider })}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <option value="ollama">Local (Ollama)</option>
          <option value="openai">OpenAI</option>
        </select>
      </label>

      {provider === "ollama" ? (
        <OllamaModelPicker model={data.model ?? ""} patch={patch} />
      ) : (
        <label className="workflow-block__field">
          <span className="workflow-block__field-label">Model id</span>
          <input
            type="text"
            className="workflow-block__input nodrag"
            value={data.model ?? ""}
            onChange={(e) => patch({ model: e.target.value })}
            placeholder="gpt-4o-mini"
            onPointerDown={(e) => e.stopPropagation()}
          />
        </label>
      )}

      <label className="workflow-block__field">
        <span className="workflow-block__field-label">Temperature ({t.toFixed(2)})</span>
        <input
          type="range"
          className="workflow-block__range nodrag"
          min={0}
          max={2}
          step={0.05}
          value={t}
          onChange={(e) => patch({ temperature: parseFloat(e.target.value) })}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </label>

      <label className="workflow-block__field">
        <span className="workflow-block__field-label">Prompt</span>
        <textarea
          className="workflow-block__textarea nodrag"
          value={data.llmPrompt ?? ""}
          onChange={(e) => patch({ llmPrompt: e.target.value })}
          rows={4}
          spellCheck={false}
          placeholder="What to ask the model for this step. Upstream Input/Memory is prepended when present."
          onPointerDown={(e) => e.stopPropagation()}
        />
      </label>

      <label className="workflow-block__field">
        <span className="workflow-block__field-label">System override (this LLM only)</span>
        <textarea
          className="workflow-block__textarea nodrag"
          value={data.llmSystemOverride ?? ""}
          onChange={(e) => patch({ llmSystemOverride: e.target.value })}
          rows={3}
          spellCheck={false}
          placeholder="Optional. If set, replaces the Instruction block for this node only."
          onPointerDown={(e) => e.stopPropagation()}
        />
      </label>

      <label className="workflow-block__field">
        <span className="workflow-block__field-label">Dual-agent slot</span>
        <select
          className="workflow-block__select nodrag"
          value={
            data.dualAgentSlot ??
            (data.conversationAgentRole === "teacher"
              ? "agentA"
              : data.conversationAgentRole === "student"
                ? "agentB"
                : "")
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === "agentA" || v === "agentB") {
              patch({ dualAgentSlot: v as DualAgentSlot, conversationAgentRole: undefined });
            } else {
              patch({ dualAgentSlot: undefined, conversationAgentRole: undefined });
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <option value="">— not in a two-agent loop —</option>
          <option value="agentA">Agent A</option>
          <option value="agentB">Agent B</option>
        </select>
      </label>
    </>
  );
}

function ConversationHubFields({
  data,
  patch,
}: {
  data: WorkflowBlockNodeData;
  patch: (p: Partial<WorkflowBlockNodeData>) => void;
}) {
  const delays = hubTurnDelaysMs(data);
  const max =
    typeof data.conversationMaxMessages === "number" && !Number.isNaN(data.conversationMaxMessages)
      ? data.conversationMaxMessages
      : 0;
  const first = data.conversationFirstSpeaker === "agentB" ? "agentB" : "agentA";

  return (
    <>
      <label className="workflow-block__field">
        <span className="workflow-block__field-label">Agent A display name</span>
        <input
          type="text"
          className="workflow-block__input nodrag"
          value={data.conversationAgentALabel ?? ""}
          onChange={(e) => patch({ conversationAgentALabel: e.target.value })}
          placeholder="Agent A"
          maxLength={80}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </label>
      <label className="workflow-block__field">
        <span className="workflow-block__field-label">Agent B display name</span>
        <input
          type="text"
          className="workflow-block__input nodrag"
          value={data.conversationAgentBLabel ?? ""}
          onChange={(e) => patch({ conversationAgentBLabel: e.target.value })}
          placeholder="Agent B"
          maxLength={80}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </label>
      <label className="workflow-block__field">
        <span className="workflow-block__field-label">First speaker</span>
        <select
          className="workflow-block__select nodrag"
          value={first}
          onChange={(e) =>
            patch({
              conversationFirstSpeaker: e.target.value === "agentB" ? "agentB" : "agentA",
            })
          }
          onPointerDown={(e) => e.stopPropagation()}
        >
          <option value="agentA">Agent A</option>
          <option value="agentB">Agent B</option>
        </select>
      </label>
      <label className="workflow-block__field">
        <span className="workflow-block__field-label">Pause after Agent A (ms)</span>
        <input
          type="number"
          className="workflow-block__input nodrag"
          min={0}
          max={120_000}
          step={100}
          value={delays.a}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            patch({ conversationAgentADelayMs: Number.isFinite(v) ? v : 0 });
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </label>
      <label className="workflow-block__field">
        <span className="workflow-block__field-label">Pause after Agent B (ms)</span>
        <input
          type="number"
          className="workflow-block__input nodrag"
          min={0}
          max={120_000}
          step={100}
          value={delays.b}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            patch({ conversationAgentBDelayMs: Number.isFinite(v) ? v : 0 });
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </label>
      <label className="workflow-block__field">
        <span className="workflow-block__field-label">Max replies (0 = until Stop)</span>
        <input
          type="number"
          className="workflow-block__input nodrag"
          min={0}
          max={500}
          step={1}
          value={max}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            patch({ conversationMaxMessages: Number.isFinite(v) ? Math.max(0, v) : 0 });
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </label>
      <p className="workflow-block__field-caption">
        Names appear in the transcript sent to each LLM. Match two LLM blocks to Agent A / B. Run conversation and
        Stop live in the top-right panel.
      </p>
    </>
  );
}

function MemoryContainerFields({
  data,
  patch,
}: {
  data: WorkflowBlockNodeData;
  patch: (p: Partial<WorkflowBlockNodeData>) => void;
}) {
  const op: MemoryContainerOp = data.memoryContainerOp ?? "write";
  const key = data.memoryContainerKey ?? "default";
  const mode = data.memoryWriteMode === "append" ? "append" : "replace";

  return (
    <>
      <label className="workflow-block__field">
        <span className="workflow-block__field-label">Container name</span>
        <input
          type="text"
          className="workflow-block__input nodrag"
          value={key}
          onChange={(e) => patch({ memoryContainerKey: e.target.value })}
          placeholder="default"
          maxLength={64}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </label>
      <label className="workflow-block__field">
        <span className="workflow-block__field-label">Operation</span>
        <select
          className="workflow-block__select nodrag"
          value={op}
          onChange={(e) => patch({ memoryContainerOp: e.target.value as MemoryContainerOp })}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <option value="write">Write — store pipeline text here</option>
          <option value="read">Read — put container text into next LLM context</option>
          <option value="clear">Clear — empty this container</option>
        </select>
      </label>
      {op === "write" ? (
        <label className="workflow-block__field">
          <span className="workflow-block__field-label">Write mode</span>
          <select
            className="workflow-block__select nodrag"
            value={mode}
            onChange={(e) =>
              patch({ memoryWriteMode: e.target.value === "append" ? "append" : "replace" })
            }
            onPointerDown={(e) => e.stopPropagation()}
          >
            <option value="replace">Replace</option>
            <option value="append">Append</option>
          </select>
        </label>
      ) : null}
    </>
  );
}

function BlockFields({
  kind,
  data,
  patch,
}: {
  kind: WorkflowBlockId;
  data: WorkflowBlockNodeData;
  patch: (p: Partial<WorkflowBlockNodeData>) => void;
}) {
  switch (kind) {
    case "input":
      return (
        <label className="workflow-block__field">
          <span className="workflow-block__field-label">Text</span>
          <textarea
            className="workflow-block__textarea nodrag"
            value={data.text ?? ""}
            onChange={(e) => patch({ text: e.target.value })}
            rows={3}
            spellCheck={false}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </label>
      );
    case "persona":
      return (
        <label className="workflow-block__field">
          <span className="workflow-block__field-label">Instructions</span>
          <textarea
            className="workflow-block__textarea nodrag"
            value={data.systemPrompt ?? ""}
            onChange={(e) => patch({ systemPrompt: e.target.value })}
            rows={4}
            spellCheck={false}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </label>
      );
    case "llm":
      return <LlmBlockFields data={data} patch={patch} />;
    case "llmModels":
      return (
        <p className="workflow-block__field-caption nodrag" onPointerDown={(e) => e.stopPropagation()}>
          Runs when the workflow reaches this block: fetches <code className="workflow-block__code">GET /api/llm/models</code> and
          merges the list with upstream text so the next LLM can see it.
        </p>
      );
    case "conversation":
      return <ConversationHubFields data={data} patch={patch} />;
    case "memory":
      if (data.memoryContainerOp === undefined) {
        return (
          <label className="workflow-block__field">
            <span className="workflow-block__field-label">Context (legacy)</span>
            <textarea
              className="workflow-block__textarea nodrag"
              value={data.memoryText ?? ""}
              onChange={(e) => patch({ memoryText: e.target.value })}
              rows={3}
              spellCheck={false}
              onPointerDown={(e) => e.stopPropagation()}
            />
            <span className="workflow-block__field-caption">
              Old format: text is merged into the next LLM call. Add a new Memory block for containers.
            </span>
          </label>
        );
      }
      return <MemoryContainerFields data={data} patch={patch} />;
    case "sql":
      return (
        <>
          <label className="workflow-block__field">
            <span className="workflow-block__field-label">SQL template</span>
            <textarea
              className="workflow-block__textarea nodrag"
              value={data.sqlTemplate ?? ""}
              onChange={(e) => patch({ sqlTemplate: e.target.value })}
              rows={6}
              spellCheck={false}
              placeholder={`SELECT * FROM notes WHERE title = {{user}} LIMIT 5;`}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </label>
          <p className="workflow-block__field-caption">
            One statement. Placeholders become quoted literals:{" "}
            <code className="workflow-block__code">{"{{user}}"}</code>,{" "}
            <code className="workflow-block__code">{"{{lastModel}}"}</code>,{" "}
            <code className="workflow-block__code">{"{{memory}}"}</code>,{" "}
            <code className="workflow-block__code">{"{{bank:default}}"}</code> · app.db (see server/db.js)
          </p>
        </>
      );
    case "timer": {
      const ms =
        typeof data.timerDelayMs === "number" && !Number.isNaN(data.timerDelayMs)
          ? data.timerDelayMs
          : 1000;
      return (
        <label className="workflow-block__field">
          <span className="workflow-block__field-label">Delay (ms)</span>
          <input
            type="number"
            className="workflow-block__input nodrag"
            min={0}
            max={600_000}
            step={100}
            value={ms}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              patch({ timerDelayMs: Number.isFinite(v) ? v : 0 });
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
          <span className="workflow-block__field-caption">0–600000 · blocks after this run when the wait ends</span>
        </label>
      );
    }
    case "discord": {
      const discordOp: DiscordBlockOp = data.discordOp === "send_message" ? "send_message" : "validate";
      return (
        <>
          <label className="workflow-block__field">
            <span className="workflow-block__field-label">Action</span>
            <select
              className="workflow-block__select nodrag"
              value={discordOp}
              onChange={(e) => patch({ discordOp: e.target.value as DiscordBlockOp })}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <option value="validate">Validate connection — check bot token</option>
              <option value="send_message">Send message — post upstream text to channel</option>
            </select>
          </label>
          {discordOp === "send_message" ? (
            <label className="workflow-block__field">
              <span className="workflow-block__field-label">Channel id</span>
              <input
                type="text"
                className="workflow-block__input nodrag"
                value={data.discordChannelId ?? ""}
                onChange={(e) => patch({ discordChannelId: e.target.value })}
                placeholder="1234567890123456789"
                spellCheck={false}
                autoComplete="off"
                onPointerDown={(e) => e.stopPropagation()}
              />
            </label>
          ) : null}
          <label className="workflow-block__field">
            <span className="workflow-block__field-label">Bot token (optional)</span>
            <input
              type="password"
              className="workflow-block__input nodrag"
              value={data.discordBotToken ?? ""}
              onChange={(e) => patch({ discordBotToken: e.target.value })}
              placeholder="Leave empty to use DISCORD_BOT_TOKEN on server"
              spellCheck={false}
              autoComplete="off"
              onPointerDown={(e) => e.stopPropagation()}
            />
          </label>
          <p className="workflow-block__field-caption">
            Server route <code className="workflow-block__code">POST /api/discord</code>. Enable{" "}
            <strong>Message Content Intent</strong> only if your bot reads messages; sending does not require it. Do not
            commit tokens in saved workflows.
          </p>
        </>
      );
    }
    case "output":
      return (
        <>
          <label className="workflow-block__field workflow-block__toggle">
            <input
              type="checkbox"
              className="workflow-block__toggle-input nodrag"
              checked={Boolean(data.outputTts)}
              onChange={(e) => patch({ outputTts: e.target.checked })}
              onPointerDown={(e) => e.stopPropagation()}
            />
            <span className="workflow-block__toggle-label">Speak reply (TTS)</span>
          </label>
          <div className="workflow-block__field">
            <span className="workflow-block__field-label">Last run</span>
            <pre className="workflow-block__preview nodrag" onPointerDown={(e) => e.stopPropagation()}>
              {data.runMessage ?? "—"}
            </pre>
          </div>
        </>
      );
    default:
      return null;
  }
}
