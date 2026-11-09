type IssuePerformance = { startedAt: number; requestAt?: number; responseAt?: number };
const pending = new Map<string, IssuePerformance>();
const enabled = () => process.env.NODE_ENV !== "production" && typeof performance !== "undefined";

export function beginIssuePerformance(issueId: string) {
  if (!enabled()) return;
  pending.clear();
  pending.set(issueId, { startedAt: performance.now() });
  console.info("[issue-load-performance]", JSON.stringify({ kind: "click" }));
}

export function hasPendingIssuePerformance(issueId: string) {
  return enabled() && pending.has(issueId);
}

export function startTimelineRequest(issueId: string) {
  if (!enabled()) return;
  const entry = pending.get(issueId);
  if (entry) entry.requestAt = performance.now();
}

export function finishTimelineRequest(issueId: string) {
  if (!enabled()) return;
  const entry = pending.get(issueId);
  if (entry?.requestAt !== undefined) entry.responseAt = performance.now();
}

export function finishIssuePerformance(issueId: string, sizes: { entries: number; replies: number; characters: number; longestReply: number }) {
  if (!enabled()) return;
  const entry = pending.get(issueId);
  if (!entry) return;
  pending.delete(issueId);
  const totalMs = Math.round(performance.now() - entry.startedAt);
  const timelineMs = entry.requestAt !== undefined && entry.responseAt !== undefined
    ? Math.round(entry.responseAt - entry.requestAt) : null;
  console.info("[issue-load-performance]", JSON.stringify({ totalMs, timelineMs, ...sizes }));
}
