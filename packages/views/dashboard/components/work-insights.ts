export type InsightTask = { id: string; agent_id: string; issue_id: string; started_at: string | null; completed_at: string | null };

export function dateFromParts(formatter: Intl.DateTimeFormat, timestamp: number): string {
  const parts = Object.fromEntries(formatter.formatToParts(timestamp).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export async function loadTaskHistory<T>(agentIds: string[], fetchPage: (id: string, before?: string) => Promise<{ tasks: T[]; nextCursor: string | null }>): Promise<T[]> {
  const result: T[] = [];
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(4, agentIds.length) }, async () => {
    while (index < agentIds.length) {
      const id = agentIds[index++]!;
      let cursor: string | undefined;
      const seen = new Set<string>();
      do {
        const page = await fetchPage(id, cursor);
        result.push(...page.tasks);
        cursor = page.nextCursor ?? undefined;
        if (cursor && seen.has(cursor)) throw new Error("Repeated task history cursor");
        if (cursor) seen.add(cursor);
      } while (cursor);
    }
  }));
  return result;
}

export function calculateInsights(tasks: InsightTask[], scope: { start: string; end: string; timeZone: string; agentId: string | null; issueIds: Set<string> | null }) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: scope.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
  const days: Record<string, number> = {};
  const hours = Array<number>(24).fill(0);
  const byAgent = new Map<string, { id: string; count: number; nightCount: number; dates: Set<string> }>();
  let longest: { agentId: string; seconds: number } | null = null;
  let total = 0;
  let totalSeconds = 0;
  for (const task of tasks) {
    if (!task.started_at || (scope.agentId && task.agent_id !== scope.agentId) || (scope.issueIds && !scope.issueIds.has(task.issue_id))) continue;
    const timestamp = Date.parse(task.started_at);
    if (!Number.isFinite(timestamp)) continue;
    const parts = Object.fromEntries(formatter.formatToParts(timestamp).map((part) => [part.type, part.value]));
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    if (date < scope.start || date > scope.end) continue;
    const hour = Number(parts.hour);
    total++;
    days[date] = (days[date] ?? 0) + 1;
    hours[hour] = (hours[hour] ?? 0) + 1;
    const agent = byAgent.get(task.agent_id) ?? { id: task.agent_id, count: 0, nightCount: 0, dates: new Set<string>() };
    agent.count++;
    if (hour >= 22 || hour < 6) agent.nightCount++;
    agent.dates.add(date);
    byAgent.set(task.agent_id, agent);
    const end = task.completed_at ? Date.parse(task.completed_at) : NaN;
    const seconds = (end - timestamp) / 1000;
    if (Number.isFinite(seconds) && seconds >= 0) {
      totalSeconds += seconds;
      if (!longest || seconds > longest.seconds) longest = { agentId: task.agent_id, seconds };
    }
  }
  const agents = [...byAgent.values()].map(({ dates, ...agent }) => ({ ...agent, activeDays: dates.size })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  return { total, totalSeconds, days, hours, agents, longest };
}
