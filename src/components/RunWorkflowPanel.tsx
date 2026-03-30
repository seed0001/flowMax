import { useCallback, useRef, useState } from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import { executeWorkflow } from "@/lib/executeWorkflow";
import {
  canRunDualAgentConversation,
  runDualAgentConversation,
} from "@/lib/runDualAgentConversation";
import type { WorkflowBlockNodeData } from "@/lib/workflowTypes";

type RunMode = "idle" | "workflow" | "conversation";

export function RunWorkflowPanel() {
  const { getNodes, getEdges, setNodes } = useReactFlow();
  const [mode, setMode] = useState<RunMode>("idle");
  const [log, setLog] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const resetNodeRunUi = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type !== "workflowBlock") return n;
        const d = n.data as WorkflowBlockNodeData;
        return {
          ...n,
          data: { ...d, runStatus: "idle" as const, runMessage: undefined },
        };
      })
    );
  }, [setNodes]);

  const run = useCallback(async () => {
    setMode("workflow");
    setLog(null);
    resetNodeRunUi();
    await new Promise((r) => requestAnimationFrame(r));

    try {
      const result = await executeWorkflow(getNodes(), getEdges());
      const stepByNode = new Map(result.steps.map((s) => [s.nodeId, s]));

      setNodes((nds) =>
        nds.map((n) => {
          if (n.type !== "workflowBlock") return n;
          const step = stepByNode.get(n.id);
          const d = n.data as WorkflowBlockNodeData;
          if (!step) {
            return {
              ...n,
              data: { ...d, runStatus: "idle" as const, runMessage: undefined },
            };
          }
          return {
            ...n,
            data: {
              ...d,
              runStatus: step.status,
              runMessage: step.message,
            },
          };
        })
      );

      if (result.ok) {
        setLog(result.summary ?? "Done.");
      } else {
        setLog(result.error ?? "Run failed.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLog(msg);
    } finally {
      setMode("idle");
    }
  }, [getEdges, getNodes, resetNodeRunUi, setNodes]);

  const stopConversation = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMode("idle");
    setLog("Stopped.");
  }, []);

  const runConversation = useCallback(async () => {
    const nodes = getNodes();
    if (!canRunDualAgentConversation(nodes)) {
      setLog("Need two LLM blocks: set Dual-agent slot to Agent A on one and Agent B on the other.");
      return;
    }

    setMode("conversation");
    setLog(null);
    resetNodeRunUi();
    await new Promise((r) => requestAnimationFrame(r));

    const ac = new AbortController();
    abortRef.current = ac;

    const result = await runDualAgentConversation(nodes, {
      signal: ac.signal,
      onPatches: (patches) => {
        setNodes((nds) => {
          const map = new Map(patches.map((p) => [p.nodeId, p]));
          return nds.map((n) => {
            const p = map.get(n.id);
            if (!p || n.type !== "workflowBlock") return n;
            const d = n.data as WorkflowBlockNodeData;
            return {
              ...n,
              data: {
                ...d,
                runStatus: p.runStatus,
                runMessage: p.runMessage,
              },
            };
          });
        });
      },
    });

    abortRef.current = null;
    setMode("idle");

    if (!result.ok) {
      setLog(result.error ?? "Conversation error.");
    } else if (result.stopped) {
      setLog("Conversation stopped.");
    } else {
      setLog("Conversation finished (turn limit reached).");
    }
  }, [getNodes, resetNodeRunUi, setNodes]);

  const busy = mode !== "idle";
  const showConversation = canRunDualAgentConversation(getNodes());

  return (
    <Panel position="top-right" className="run-panel">
      <div className="run-panel__row">
        <button
          type="button"
          className="run-panel__btn"
          disabled={busy}
          onClick={() => void run()}
        >
          {mode === "workflow" ? "Running…" : "Run workflow"}
        </button>
        {showConversation ? (
          mode === "conversation" ? (
            <button type="button" className="run-panel__btn run-panel__btn--stop" onClick={stopConversation}>
              Stop
            </button>
          ) : (
            <button
              type="button"
              className="run-panel__btn run-panel__btn--secondary"
              disabled={busy}
              onClick={() => void runConversation()}
            >
              Run conversation
            </button>
          )
        ) : null}
      </div>
      {log && (
        <p className="run-panel__log" role="status">
          {log}
        </p>
      )}
    </Panel>
  );
}
