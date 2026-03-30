import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const dbPath = path.join(dataDir, "app.db");

fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notes_created ON notes (created_at DESC);
  `);

  const count = db.prepare("SELECT COUNT(*) AS c FROM notes").get().c;
  if (count === 0) {
    const ins = db.prepare(
      "INSERT INTO notes (title, body) VALUES (@title, @body)"
    );
    ins.run({
      title: "Welcome",
      body: "SQLite is wired — run SELECT * FROM notes in a SQL query node.",
    });
    ins.run({
      title: "Key-value",
      body: "Use kv_store for simple storage: SELECT * FROM kv_store",
    });
  }
}
