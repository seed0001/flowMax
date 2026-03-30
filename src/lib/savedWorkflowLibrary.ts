import type { Edge, Node } from "@xyflow/react";

const STORAGE_KEY = "flow-canvas:user-workflows-v1";

export type UserWorkflowRecord = {
  id: string;
  name: string;
  description: string;
  savedAt: number;
  nodes: Node[];
  edges: Edge[];
};

function safeClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function loadUserWorkflows(): UserWorkflowRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isUserWorkflowRecord);
  } catch {
    return [];
  }
}

function isUserWorkflowRecord(x: unknown): x is UserWorkflowRecord {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.description === "string" &&
    typeof o.savedAt === "number" &&
    Array.isArray(o.nodes) &&
    Array.isArray(o.edges)
  );
}

function persist(list: UserWorkflowRecord[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // quota or private mode
  }
}

export function addUserWorkflow(
  name: string,
  nodes: Node[],
  edges: Edge[]
): UserWorkflowRecord | { error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Enter a name for this workflow." };
  if (nodes.length === 0) return { error: "Nothing to save — add blocks to the canvas first." };

  const record: UserWorkflowRecord = {
    id: `user-${crypto.randomUUID()}`,
    name: trimmed.slice(0, 120),
    description: `Saved workflow · ${nodes.length} block${nodes.length === 1 ? "" : "s"} · ${edges.length} connection${edges.length === 1 ? "" : "s"}`,
    savedAt: Date.now(),
    nodes: safeClone(nodes),
    edges: safeClone(edges),
  };

  const next = [record, ...loadUserWorkflows()];
  persist(next);
  return record;
}

export function removeUserWorkflow(id: string): void {
  const next = loadUserWorkflows().filter((w) => w.id !== id);
  persist(next);
}

export function getUserWorkflowById(id: string): UserWorkflowRecord | undefined {
  return loadUserWorkflows().find((w) => w.id === id);
}
