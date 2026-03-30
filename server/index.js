import cors from "cors";
import express from "express";
import { db, initSchema } from "./db.js";

initSchema();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "512kb" }));

function ollamaBase() {
  return String(process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
}

function normalizeSql(sql) {
  return String(sql ?? "").trim();
}

/** Reject obvious multi-statement abuse; trailing semicolon is OK. */
function assertSingleStatement(sql) {
  const s = sql.replace(/;+\s*$/u, "").trim();
  if (s.includes(";")) {
    const err = new Error("Only one SQL statement at a time is allowed.");
    err.status = 400;
    throw err;
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, db: "sqlite", file: "data/app.db" });
});

/** List models from local Ollama (`OLLAMA_HOST`, default http://127.0.0.1:11434). */
app.get("/api/llm/models", async (_req, res) => {
  try {
    const base = ollamaBase();
    const r = await fetch(`${base}/api/tags`, { method: "GET" });
    const text = await r.text();
    let j;
    try {
      j = JSON.parse(text);
    } catch {
      return res.json({
        source: "ollama",
        baseUrl: base,
        models: [],
        error: `Ollama returned non-JSON (${r.status})`,
      });
    }
    if (!r.ok) {
      return res.json({
        source: "ollama",
        baseUrl: base,
        models: [],
        error: typeof j.error === "string" ? j.error : `Ollama ${r.status}`,
      });
    }
    const models = (j.models || []).map((m) => ({
      id: m.name,
      name: m.name,
    }));
    return res.json({ source: "ollama", baseUrl: base, models });
  } catch (e) {
    return res.json({
      source: "ollama",
      models: [],
      error: e.message || "Cannot reach Ollama — is it running?",
    });
  }
});

/**
 * Chat: `provider` "ollama" (default) uses local Ollama; "openai" uses the cloud API when key is set.
 */
app.post("/api/llm/chat", async (req, res) => {
  try {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array required" });
    }

    const provider = req.body?.provider === "openai" ? "openai" : "ollama";
    const rawT = req.body?.temperature;
    const temperature =
      typeof rawT === "number" && !Number.isNaN(rawT)
        ? Math.min(2, Math.max(0, rawT))
        : 0.7;

    if (provider === "ollama") {
      const model =
        typeof req.body?.model === "string" && req.body.model.trim()
          ? req.body.model.trim()
          : "llama3.2";
      const base = ollamaBase();
      const r = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({
            role: String(m.role || "user"),
            content: String(m.content ?? ""),
          })),
          stream: false,
          options: { temperature },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg =
          typeof j.error === "string"
            ? j.error
            : j.error?.message || JSON.stringify(j).slice(0, 400);
        return res.status(r.status >= 400 ? r.status : 502).json({
          error: msg || "Ollama request failed",
        });
      }
      const content = j.message?.content ?? "";
      return res.json({
        mock: false,
        content,
        model: j.model || model,
        provider: "ollama",
      });
    }

    const model =
      typeof req.body?.model === "string" && req.body.model.trim()
        ? req.body.model.trim()
        : "gpt-4o-mini";
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const preview = String(lastUser?.content ?? "").trim().slice(0, 160);
      return res.json({
        mock: true,
        content: `[Demo — no OPENAI_API_KEY] Would answer. Your line: "${preview || "…"}"`,
        model: "mock",
        provider: "openai",
      });
    }

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
      }),
    });

    const j = await r.json();
    if (!r.ok) {
      const msg = j?.error?.message || JSON.stringify(j?.error || j);
      return res.status(r.status).json({ error: msg });
    }

    const content = j.choices?.[0]?.message?.content ?? "";
    return res.json({
      mock: false,
      content,
      model: j.model || model,
      provider: "openai",
    });
  } catch (e) {
    console.error("[api/llm/chat]", e);
    return res.status(500).json({ error: e.message || "LLM error" });
  }
});

/**
 * Discord: validate bot token (GET /users/@me) or send a channel message.
 * Prefer `DISCORD_BOT_TOKEN` on this process; body.token overrides for local dev only.
 */
app.post("/api/discord", async (req, res) => {
  try {
    const op = req.body?.op === "send_message" ? "send_message" : "validate";
    const fromBody =
      typeof req.body?.token === "string" && req.body.token.trim()
        ? req.body.token.trim()
        : "";
    const token = fromBody || String(process.env.DISCORD_BOT_TOKEN || "").trim();
    if (!token) {
      return res.status(400).json({
        error:
          "No bot token. Set DISCORD_BOT_TOKEN in the environment for the API server, or send token in the JSON body (dev only — do not commit tokens).",
      });
    }
    const auth = `Bot ${token}`;

    if (op === "validate") {
      const r = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: auth },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg =
          typeof j.message === "string"
            ? j.message
            : r.status === 401
              ? "Invalid or unauthorized bot token."
              : "Discord validation failed.";
        return res.status(r.status >= 400 && r.status < 500 ? r.status : 502).json({
          error: msg,
        });
      }
      const username = typeof j.username === "string" ? j.username : "bot";
      const disc = j.discriminator && j.discriminator !== "0" ? `#${j.discriminator}` : "";
      return res.json({
        ok: true,
        op: "validate",
        summary: `Connected as ${username}${disc} (id ${j.id})`,
        bot: { id: j.id, username: j.username, discriminator: j.discriminator },
      });
    }

    const channelId = String(req.body?.channelId ?? "").replace(/\s+/g, "");
    if (!/^\d{10,22}$/.test(channelId)) {
      return res.status(400).json({
        error: "channelId must be a numeric Discord channel id (snowflake).",
      });
    }
    const contentRaw = String(req.body?.content ?? "").trim();
    if (!contentRaw) {
      return res.status(400).json({
        error: "Message content is empty.",
      });
    }
    const content = contentRaw.slice(0, 2000);

    const r = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg =
        typeof j.message === "string"
          ? j.message
          : `Discord send failed (${r.status})`;
      return res.status(r.status >= 400 && r.status < 500 ? r.status : 502).json({
        error: msg,
      });
    }
    return res.json({
      ok: true,
      op: "send_message",
      summary: `Message sent (id ${j.id})`,
      messageId: j.id,
      channelId: j.channel_id,
    });
  } catch (e) {
    console.error("[api/discord]", e);
    return res.status(500).json({ error: e.message || "Discord error" });
  }
});

app.post("/api/sql", (req, res) => {
  try {
    const sql = normalizeSql(req.body?.sql);
    if (!sql) {
      return res.status(400).json({ error: "Missing sql" });
    }

    assertSingleStatement(sql);

    const params = Array.isArray(req.body?.params) ? req.body.params : [];

    const upper = sql.toUpperCase();
    const isSelect = upper.startsWith("SELECT") || upper.startsWith("WITH");

    if (isSelect) {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);
      const max = 500;
      const trimmed = rows.length > max ? rows.slice(0, max) : rows;
      return res.json({
        kind: "rows",
        rows: trimmed,
        rowCount: rows.length,
        truncated: rows.length > max,
      });
    }

    const stmt = db.prepare(sql);
    const info = stmt.run(...params);
    return res.json({
      kind: "run",
      changes: info.changes,
      lastInsertRowid:
        info.lastInsertRowid !== undefined && info.lastInsertRowid !== null
          ? Number(info.lastInsertRowid)
          : null,
    });
  } catch (e) {
    const status = e.status || 500;
    const message = e.message || "SQL error";
    console.error("[api/sql]", message);
    return res.status(status).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`[api] SQLite API http://localhost:${PORT}  (data/app.db)`);
});
