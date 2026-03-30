export type LlmChatResponse = {
  mock?: boolean;
  content: string;
  model: string;
  provider?: string;
  error?: string;
};

export type LlmModelInfo = { id: string; name: string };

export type LlmModelsResponse = {
  source?: string;
  baseUrl?: string;
  models: LlmModelInfo[];
  error?: string;
};

/** Avoid `response.json()` on empty proxy bodies (e.g. API down → empty 502). */
async function readJsonBody<T>(r: Response): Promise<{
  data?: T;
  empty: boolean;
  parseError: boolean;
}> {
  const raw = await r.text();
  const trimmed = raw.trim();
  if (!trimmed) {
    return { empty: true, parseError: false };
  }
  try {
    return { data: JSON.parse(trimmed) as T, empty: false, parseError: false };
  } catch {
    return { empty: false, parseError: true };
  }
}

export async function fetchLlmModels(): Promise<LlmModelsResponse> {
  let r: Response;
  try {
    r = await fetch("/api/llm/models");
  } catch (e) {
    return {
      models: [],
      error:
        e instanceof Error
          ? e.message
          : "Network error — check that `npm run dev` is running (API on port 3001).",
    };
  }

  const { data, empty, parseError } = await readJsonBody<LlmModelsResponse>(r);

  if (empty) {
    return {
      models: [],
      error: r.ok
        ? "Empty response from /api/llm/models."
        : `API unreachable (HTTP ${r.status}). Start the backend: npm run dev — both Vite and the Node API must be up.`,
    };
  }

  if (parseError || !data) {
    return {
      models: [],
      error: `Invalid response from server (HTTP ${r.status}).`,
    };
  }

  if (!r.ok) {
    return {
      models: data.models ?? [],
      error: data.error ?? `HTTP ${r.status}`,
    };
  }

  return {
    source: data.source,
    baseUrl: data.baseUrl,
    models: Array.isArray(data.models) ? data.models : [],
    error: data.error,
  };
}

export async function postLlmChat(body: {
  model?: string;
  messages: { role: string; content: string }[];
  provider?: "openai" | "ollama";
  temperature?: number;
}): Promise<LlmChatResponse> {
  let r: Response;
  try {
    r = await fetch("/api/llm/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "Network error — is the API server running?"
    );
  }

  type ChatJson = LlmChatResponse & { error?: string };
  const { data: j, empty, parseError } = await readJsonBody<ChatJson>(r);

  if (empty) {
    throw new Error(
      r.ok
        ? "Empty response from /api/llm/chat."
        : `API unreachable (HTTP ${r.status}). Run \`npm run dev\` so port 3001 is up, or check the Vite proxy.`
    );
  }

  if (parseError || !j) {
    throw new Error(`Invalid JSON from /api/llm/chat (HTTP ${r.status}).`);
  }

  if (!r.ok) {
    throw new Error(j.error || r.statusText || "LLM request failed");
  }
  if (typeof j.content !== "string") {
    throw new Error("Unexpected LLM response (missing content).");
  }
  return j;
}

export type SqlRowsResponse = {
  kind: "rows";
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated?: boolean;
};

export type SqlRunResponse = {
  kind: "run";
  changes: number;
  lastInsertRowid: number | null;
};

export type SqlResponse = SqlRowsResponse | SqlRunResponse;

export async function postSql(body: {
  sql: string;
  params?: unknown[];
}): Promise<SqlResponse> {
  let r: Response;
  try {
    r = await fetch("/api/sql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Network error — is the API server running?");
  }

  type SqlJson = SqlResponse & { error?: string };
  const { data: j, empty, parseError } = await readJsonBody<SqlJson>(r);

  if (empty) {
    throw new Error(
      r.ok ? "Empty response from /api/sql." : `API unreachable (HTTP ${r.status}).`
    );
  }
  if (parseError || !j) {
    throw new Error(`Invalid JSON from /api/sql (HTTP ${r.status}).`);
  }
  if (!r.ok) {
    throw new Error(j.error || r.statusText || "SQL request failed");
  }
  if (j.kind === "rows" || j.kind === "run") {
    return j as SqlResponse;
  }
  throw new Error("Unexpected API response");
}

export type DiscordApiResponse = {
  ok: boolean;
  op: "validate" | "send_message";
  summary?: string;
  bot?: { id: string; username: string; discriminator: string };
  messageId?: string;
  channelId?: string;
  error?: string;
};

export async function postDiscord(body: {
  op: "validate" | "send_message";
  channelId?: string;
  content?: string;
  token?: string;
}): Promise<DiscordApiResponse> {
  let r: Response;
  try {
    r = await fetch("/api/discord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Network error — is the API server running?");
  }

  const { data: j, empty, parseError } = await readJsonBody<DiscordApiResponse & { error?: string }>(r);

  if (empty) {
    throw new Error(
      r.ok ? "Empty response from /api/discord." : `API unreachable (HTTP ${r.status}).`
    );
  }
  if (parseError || !j) {
    throw new Error(`Invalid JSON from /api/discord (HTTP ${r.status}).`);
  }
  if (!r.ok) {
    throw new Error(j.error || r.statusText || "Discord request failed");
  }
  if (!j.ok) {
    throw new Error(j.error || "Discord request failed");
  }
  return j;
}
