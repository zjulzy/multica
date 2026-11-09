type RenderTotals = { commits: number; totalMs: number; maxMs: number };
const totals = new Map<string, RenderTotals>();

export function recordIssueRender(name: string, duration: number) {
  const entry = totals.get(name) ?? { commits: 0, totalMs: 0, maxMs: 0 };
  entry.commits += 1;
  entry.totalMs += duration;
  entry.maxMs = Math.max(entry.maxMs, duration);
  totals.set(name, entry);
}

export function takeIssueRenderSummary() {
  const result: Record<string, RenderTotals> = {};
  for (const [name, entry] of totals) result[name] = { commits: entry.commits, totalMs: Math.round(entry.totalMs), maxMs: Math.round(entry.maxMs) };
  totals.clear();
  return result;
}
