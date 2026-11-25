export type EmbeddedHeaderCommand = { token: string; command: "toggle-sidebar" | "open-wakeups" | "refresh-issue" } | { token: string; command: "jump-to-run"; taskId: string } | { token: string; command: "append-comment"; issueId: string; text: string };

export function parseEmbeddedHeaderCommand(value: unknown): EmbeddedHeaderCommand | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.token !== "string" || input.token.length < 1 || input.token.length > 256) return null;
  if (input.command === "toggle-sidebar" || input.command === "open-wakeups" || input.command === "refresh-issue") return { token: input.token, command: input.command };
  if (input.command === "jump-to-run" && typeof input.taskId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(input.taskId)) return { token: input.token, command: input.command, taskId: input.taskId };
  if (input.command === "append-comment" && typeof input.issueId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(input.issueId) && typeof input.text === "string" && input.text.length > 0 && input.text.length <= 50000) return { token: input.token, command: input.command, issueId: input.issueId, text: input.text };
  return null;
}
