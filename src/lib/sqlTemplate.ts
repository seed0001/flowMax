/** Escape a value as a single-quoted SQLite string literal. */
export function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export type SqlTemplateContext = {
  user: string;
  llmOutput: string;
  memory: string;
  memoryBank: Record<string, string>;
};

/**
 * Build SQL from a template. Tokens become quoted literals (safe for values, not identifiers).
 *
 * - {{user}} — pipeline user / last text
 * - {{lastModel}} or {{llm}} — last LLM reply, else same as user
 * - {{memory}} — ephemeral scratch (e.g. after a Memory read)
 * - {{bank:NAME}} — string stored in the named memory container
 */
export function compileSqlTemplate(template: string, ctx: SqlTemplateContext): string {
  let out = template;

  out = out.replace(/\{\{\s*bank:([\w.-]+)\s*\}\}/gi, (_, rawKey: string) =>
    sqlStringLiteral(ctx.memoryBank[rawKey] ?? "")
  );
  out = out.replace(/\{\{\s*user\s*\}\}/gi, () => sqlStringLiteral(ctx.user));
  out = out.replace(/\{\{\s*lastModel\s*\}\}/gi, () =>
    sqlStringLiteral(ctx.llmOutput || ctx.user)
  );
  out = out.replace(/\{\{\s*llm\s*\}\}/gi, () => sqlStringLiteral(ctx.llmOutput || ctx.user));
  out = out.replace(/\{\{\s*memory\s*\}\}/gi, () => sqlStringLiteral(ctx.memory));

  const leftover = out.match(/\{\{[\s\S]*?\}\}/);
  if (leftover) {
    throw new Error(
      `Unknown SQL template token: ${leftover[0].slice(0, 80)} — use {{user}}, {{lastModel}}, {{memory}}, or {{bank:key}}`
    );
  }

  return out.trim();
}
