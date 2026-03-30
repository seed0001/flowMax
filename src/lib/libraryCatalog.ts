import type { Edge, Node } from "@xyflow/react";
import { EXAMPLE_WORKFLOWS } from "@/lib/exampleWorkflows";
import { getUserWorkflowById, loadUserWorkflows, type UserWorkflowRecord } from "@/lib/savedWorkflowLibrary";

/** Single entry for the Library dropdown — built-in or user-saved. */
export type LibraryEntry = {
  id: string;
  label: string;
  description: string;
  source: "builtin" | "user";
};

export function getBuiltinLibraryEntries(): LibraryEntry[] {
  return EXAMPLE_WORKFLOWS.map((w) => ({
    id: w.id,
    label: w.label,
    description: w.description,
    source: "builtin" as const,
  }));
}

export function getUserLibraryEntries(): LibraryEntry[] {
  return loadUserWorkflows().map((w) => ({
    id: w.id,
    label: w.name,
    description: w.description,
    source: "user" as const,
  }));
}

export function getAllLibraryEntries(): LibraryEntry[] {
  return [...getBuiltinLibraryEntries(), ...getUserLibraryEntries()];
}

/** Resolve graph for load — built-ins use builders, user entries use stored snapshot. */
export function resolveLibraryWorkflow(id: string): { nodes: Node[]; edges: Edge[] } | null {
  const builtin = EXAMPLE_WORKFLOWS.find((w) => w.id === id);
  if (builtin) return builtin.build();

  const user = getUserWorkflowById(id);
  if (user) return { nodes: user.nodes, edges: user.edges };

  return null;
}

export function describeUserRecord(r: UserWorkflowRecord): string {
  return r.description;
}
