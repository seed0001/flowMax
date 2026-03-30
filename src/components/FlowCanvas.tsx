import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { RunWorkflowPanel } from "@/components/RunWorkflowPanel";
import { WorkflowBlockNode } from "@/components/WorkflowBlockNode";
import { buildDefaultWorkflowData } from "@/lib/defaultWorkflowData";
import { getAllLibraryEntries, resolveLibraryWorkflow, type LibraryEntry } from "@/lib/libraryCatalog";
import { addUserWorkflow, removeUserWorkflow } from "@/lib/savedWorkflowLibrary";
import { WORKFLOW_BLOCKS, type WorkflowBlockId } from "@/lib/workflowBlocks";

type SidebarPage = "blocks" | "library";

const nodeTypes: NodeTypes = {
  workflowBlock: WorkflowBlockNode,
};

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: "rgba(139, 146, 163, 0.55)", strokeWidth: 2 },
};

function FlowWithBlocks() {
  const [sidebarPage, setSidebarPage] = useState<SidebarPage>("blocks");
  const [libraryTick, setLibraryTick] = useState(0);
  const [selectedExampleId, setSelectedExampleId] = useState(() => getAllLibraryEntries()[0]?.id ?? "");
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const rfRef = useRef<ReactFlowInstance | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const allLibraryEntries = useMemo(() => getAllLibraryEntries(), [libraryTick]);

  const builtinEntries = useMemo(() => allLibraryEntries.filter((e) => e.source === "builtin"), [allLibraryEntries]);
  const userEntries = useMemo(() => allLibraryEntries.filter((e) => e.source === "user"), [allLibraryEntries]);

  const selectedExample: LibraryEntry | undefined = useMemo(
    () => allLibraryEntries.find((e) => e.id === selectedExampleId),
    [allLibraryEntries, selectedExampleId]
  );

  useEffect(() => {
    if (allLibraryEntries.length === 0) return;
    const ids = new Set(allLibraryEntries.map((e) => e.id));
    if (!selectedExampleId || !ids.has(selectedExampleId)) {
      setSelectedExampleId(allLibraryEntries[0]!.id);
    }
  }, [allLibraryEntries, selectedExampleId]);

  const refreshLibrary = useCallback(() => setLibraryTick((t) => t + 1), []);

  const loadSelectedExample = useCallback(() => {
    const wf = resolveLibraryWorkflow(selectedExampleId);
    if (!wf) return;
    setNodes(wf.nodes);
    setEdges(wf.edges);
    requestAnimationFrame(() => {
      rfRef.current?.fitView({ padding: 0.2, duration: 220 });
    });
  }, [selectedExampleId, setNodes, setEdges]);

  const saveCurrentToLibrary = useCallback(() => {
    setSaveError(null);
    const result = addUserWorkflow(saveName, nodes, edges);
    if ("error" in result) {
      setSaveError(result.error);
      return;
    }
    setSaveName("");
    refreshLibrary();
    setSelectedExampleId(result.id);
  }, [saveName, nodes, edges, refreshLibrary]);

  const removeSelectedUserWorkflow = useCallback(() => {
    if (!selectedExample || selectedExample.source !== "user") return;
    removeUserWorkflow(selectedExample.id);
    refreshLibrary();
  }, [selectedExample, refreshLibrary]);

  const addBlock = useCallback(
    (kind: WorkflowBlockId) => {
      const def = WORKFLOW_BLOCKS.find((b) => b.id === kind);
      if (!def) return;

      setNodes((nds) => {
        const n = nds.length;
        const id = `block-${crypto.randomUUID().slice(0, 10)}`;
        const data = buildDefaultWorkflowData(kind, def);
        const isLlm = kind === "llm";
        const isLlmModels = kind === "llmModels";
        const isSql = kind === "sql";
        const isConversation = kind === "conversation";
        const isTimer = kind === "timer";
        const isDiscord = kind === "discord";
        const isOutput = kind === "output";
        return [
          ...nds,
          {
            id,
            type: "workflowBlock",
            position: {
              x: 60 + (n % 4) * 48,
              y: 80 + (n % 5) * 40,
            },
            style: {
              width: isLlm ? 320 : isSql || isConversation || isDiscord ? 300 : 280,
              minHeight: isLlm
                ? 420
                : isSql
                  ? 340
                  : isConversation
                    ? 300
                    : isDiscord
                      ? 320
                      : isLlmModels
                        ? 160
                        : isTimer
                          ? 200
                          : isOutput
                            ? 200
                            : 120,
            },
            data,
          },
        ];
      });
    },
    [setNodes]
  );

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, ...defaultEdgeOptions }, eds)),
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    rfRef.current = instance;
    instance.fitView({ padding: 0.2 });
  }, []);

  const defaultEdgesOpts = useMemo(() => defaultEdgeOptions, []);

  return (
    <div className="app-work">
      <aside className="presets-panel" aria-label="Workflow sidebar">
        <nav className="sidebar-nav" aria-label="Sidebar pages">
          <button
            type="button"
            className={`sidebar-nav__tab${sidebarPage === "blocks" ? " sidebar-nav__tab--active" : ""}`}
            onClick={() => setSidebarPage("blocks")}
          >
            Blocks
          </button>
          <button
            type="button"
            className={`sidebar-nav__tab${sidebarPage === "library" ? " sidebar-nav__tab--active" : ""}`}
            onClick={() => setSidebarPage("library")}
          >
            Library
          </button>
        </nav>

        {sidebarPage === "blocks" ? (
          <>
            <h2 className="presets-panel__title presets-panel__title--page">All blocks</h2>
            <p className="presets-panel__hint">
              Click a block to add it to the canvas. Connect handles, edit fields, then <strong>Run workflow</strong>.
            </p>
            <ul className="presets-panel__list">
              {WORKFLOW_BLOCKS.map((b) => (
                <li key={b.id}>
                  <button type="button" className="presets-panel__item" onClick={() => addBlock(b.id)}>
                    <span className="presets-panel__item-title">{b.label}</span>
                    <span className="presets-panel__item-sub">{b.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h2 className="presets-panel__title presets-panel__title--page">Library</h2>
            <p className="presets-panel__hint">
              Load a built-in example or a workflow you saved. Loading <strong>replaces</strong> the current graph.
            </p>
            <div className="library-panel">
              <label className="library-field" htmlFor="example-workflow-select">
                <span className="library-field__label">Workflow</span>
                <select
                  id="example-workflow-select"
                  className="library-select"
                  value={selectedExampleId}
                  onChange={(e) => setSelectedExampleId(e.target.value)}
                >
                  <optgroup label="Examples">
                    {builtinEntries.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="My workflows">
                    {userEntries.length === 0 ? (
                      <option value="__none__" disabled>
                        No saved workflows yet
                      </option>
                    ) : (
                      userEntries.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label}
                        </option>
                      ))
                    )}
                  </optgroup>
                </select>
              </label>
              {selectedExample ? (
                <p className="library-desc">{selectedExample.description}</p>
              ) : null}
              <button
                type="button"
                className="library-load-btn"
                onClick={loadSelectedExample}
                disabled={!selectedExampleId || !resolveLibraryWorkflow(selectedExampleId)}
              >
                Load on canvas
              </button>
              {selectedExample?.source === "user" ? (
                <button type="button" className="library-remove-btn" onClick={removeSelectedUserWorkflow}>
                  Remove from library
                </button>
              ) : null}

              <div className="library-save">
                <span className="library-field__label">Save current canvas</span>
                <div className="library-save-row">
                  <input
                    type="text"
                    className="library-save-input"
                    value={saveName}
                    onChange={(e) => {
                      setSaveName(e.target.value);
                      setSaveError(null);
                    }}
                    placeholder="Name…"
                    maxLength={120}
                    aria-label="Name for saved workflow"
                  />
                  <button type="button" className="library-save-btn" onClick={saveCurrentToLibrary}>
                    Save
                  </button>
                </div>
                {saveError ? <p className="library-error">{saveError}</p> : null}
                <p className="library-save-hint">Stored in this browser (local storage).</p>
              </div>
            </div>
          </>
        )}
      </aside>
      <main className="app-main">
        <div style={{ width: "100%", height: "100%" }}>
          <ReactFlow
            className="flow-root"
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={onInit}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgesOpts}
            fitView
            minZoom={0.08}
            maxZoom={1.75}
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={["Backspace", "Delete"]}
            selectionOnDrag
            zoomOnScroll
            zoomOnPinch
            nodesDraggable
            nodesConnectable
            elementsSelectable
          >
            <RunWorkflowPanel />
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.1} color="rgba(255,255,255,0.055)" />
            <Controls showInteractive={false} />
            <div className="hint">
              Run workflow (once) · Run conversation + Stop for dual-agent loops · Ollama + API · Library templates
            </div>
          </ReactFlow>
        </div>
      </main>
    </div>
  );
}

export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <div className="flow-canvas-root">
        <FlowWithBlocks />
      </div>
    </ReactFlowProvider>
  );
}
