# flowMax

Visual **node-based workflows** for chaining inputs, instructions, local/cloud LLMs, memory, SQL, timers, Discord, and outputs. The UI is a React Flow canvas; execution runs in the browser and talks to a small **Express** API beside it.

**Stack:** Vite · React 19 · TypeScript · [@xyflow/react](https://reactflow.dev/) · Express · better-sqlite3 · Ollama (optional) · OpenAI (optional).

---

## Requirements

- **Node.js** 20+ (recommended)
- **npm**
- **Ollama** — for local models (`ollama serve`, default `http://127.0.0.1:11434`)
- **Python 3** — optional; `launch.py` starts the dev stack and can open the browser

---

## Quick start

```bash
npm install
npm run dev
```

- **Frontend:** [http://localhost:5173](http://localhost:5173) (Vite proxies `/api` to the API)
- **API:** [http://localhost:3001](http://localhost:3001)

Or, from the project root:

```bash
python launch.py
```

(which runs `npm run dev` and opens the app after a short delay.)

### Production build

```bash
npm run build
npm run preview   # static UI only — API is not started by preview
```

For a full production setup, serve `dist/` behind your HTTP server and run `node server/index.js` (or use a process manager) with `PORT` and env vars set as needed.

---

## How it works

1. Add **blocks** from the sidebar and connect **in → out** handles on the canvas.
2. Edit block fields (model name, prompts, memory keys, SQL templates, etc.).
3. **Run workflow** executes nodes in topological order (respecting dependencies).
4. **Library** can load/save example and custom workflows (stored in the browser).

**Dual-agent flows** use a **Conversation** hub plus two **LLM** blocks set to Agent A / B; use **Run conversation** in the panel (not the linear runner).

---

## Blocks (summary)

| Block | Role |
|--------|------|
| **Input** | Seed user text into the pipeline |
| **Instruction** | System prompt for downstream LLM calls |
| **LLM** | Chat completion via Ollama or OpenAI |
| **LLM models** | Fetches installed Ollama models and merges into context |
| **Memory** | Named read/write/clear containers for text between steps |
| **SQL** | Single statement against SQLite `data/app.db` (templated placeholders) |
| **Timer** | Async delay before continuing |
| **Discord** | Validate bot token or send upstream text to a channel (via API) |
| **Output** | Final text; optional browser TTS |
| **Conversation** | Hub for two-agent dialogue configuration |

---

## API & environment variables

The API lives in `server/index.js`. Relevant variables:

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default **3001**) |
| `OLLAMA_HOST` | Ollama base URL (default `http://127.0.0.1:11434`) |
| `OPENAI_API_KEY` | If set, **LLM** blocks with provider OpenAI call the cloud API; if unset, OpenAI mode returns a short demo string |
| `DISCORD_BOT_TOKEN` | Used by **POST /api/discord** when the block does not send an override token |

### Discord

1. Create an application and bot in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Set `DISCORD_BOT_TOKEN` for the Node API process (preferred over pasting a token into a saved workflow).
3. Invite the bot with permissions appropriate for your channel; copy the **channel ID** (Developer Mode) for **Send message**.

Endpoints include:

- `GET /api/health` — SQLite path ping  
- `GET /api/llm/models` — Ollama tags  
- `POST /api/llm/chat` — chat (Ollama or OpenAI)  
- `POST /api/sql` — one SQL statement  
- `POST /api/discord` — `validate` or `send_message`  

---

## Project layout

```
├── launch.py              # Optional: npm run dev + browser
├── server/
│   ├── index.js           # Express API
│   └── db.js              # SQLite schema + app.db
├── src/
│   ├── components/        # FlowCanvas, blocks, run panel
│   ├── lib/               # executeWorkflow, blocks defs, examples, API client
│   └── styles/
├── data/                  # Created at runtime (app.db, etc.; gitignored)
└── vite.config.ts         # Proxies /api → :3001
```

---

## Repository

Published as **[flowMax](https://github.com/seed0001/flowMax)** on GitHub. The npm package name in `package.json` is still `flow-canvas`; rename there if you want the names aligned.

---

## License

Private / unlicensed unless you add a `LICENSE` file.
