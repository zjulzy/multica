export type PersonalIssue = { id: string; identifier: string; title: string; creator_type: string; creator_id: string; created_at: string };
export type PersonalEntry = { id: string; type: string; actor_type: string; actor_id: string; created_at: string; action?: string; details?: Record<string, unknown>; deleted_at?: string | null; source_task_id?: string | null };
export type PersonalRecord = { id: string; issue: PersonalIssue; time: string; date: string; hour: number; kind: "created" | "comment" | "status"; completed: boolean; destination?: string };

export function buildPersonalTrend(days: Record<string, number>, start: string, end: string) {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  const dayCount = Math.floor((endTime - startTime) / 86400000) + 1;
  const monthCount = (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(end.slice(5, 7)) - Number(start.slice(5, 7)) + 1;
  const grain = dayCount <= 366 ? "day" : monthCount <= 240 ? "month" : "year";
  const aggregated: Record<string, number> = {};
  for (const [date, count] of Object.entries(days)) {
    if (date < start || date > end) continue;
    const key = grain === "day" ? date : grain === "month" ? date.slice(0, 7) : date.slice(0, 4);
    aggregated[key] = (aggregated[key] ?? 0) + count;
  }
  const buckets: { label: string; count: number }[] = [];
  if (grain === "day") {
    for (let i = 0; i < dayCount; i++) { const label = new Date(startTime + i * 86400000).toISOString().slice(0, 10); buckets.push({ label, count: aggregated[label] ?? 0 }); }
  } else if (grain === "month") {
    const firstMonth = Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7)) - 1;
    for (let i = 0; i < monthCount; i++) { const n = firstMonth + i; const label = `${Math.floor(n / 12)}-${String(n % 12 + 1).padStart(2, "0")}`; buckets.push({ label, count: aggregated[label] ?? 0 }); }
  } else {
    for (let year = Number(start.slice(0, 4)); year <= Number(end.slice(0, 4)); year++) { const label = String(year).padStart(4, "0"); buckets.push({ label, count: aggregated[label] ?? 0 }); }
  }
  return { grain, buckets, dayCount };
}

export function isoWeekFromDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const value = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0, 10) !== date) return "";
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
  const year = value.getUTCFullYear();
  const first = Date.UTC(year, 0, 1);
  const week = Math.ceil(((value.getTime() - first) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function isoWeekStart(week: string): string | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!match) return null;
  const year = Number(match[1]);
  const weekNumber = Number(match[2]);
  if (year < 100 || weekNumber < 1 || weekNumber > 53) return null;
  const day = new Date(Date.UTC(year, 0, 4));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7) + (weekNumber - 1) * 7);
  const date = day.toISOString().slice(0, 10);
  return isoWeekFromDate(date) === week ? date : null;
}

export async function loadPersonalSnapshot<I extends PersonalIssue, E extends PersonalEntry>(fetchIssues: (offset: number, limit: number) => Promise<{ issues: I[]; total: number }>, fetchTimeline: (id: string) => Promise<{ entries: E[]; truncated: boolean }>, signal: AbortSignal, limit = 500) {
  const issues: I[] = [];
  const ids = new Set<string>();
  let offset = 0;
  let total = 0;
  while (offset < limit) {
    signal.throwIfAborted();
    const page = await fetchIssues(offset, Math.min(100, limit - offset));
    total = page.total;
    for (const issue of page.issues) if (!ids.has(issue.id)) { ids.add(issue.id); issues.push(issue); }
    offset += page.issues.length;
    if (!page.issues.length || offset >= total) break;
  }
  const entries: { issue: I; entry: E }[] = [];
  let index = 0;
  let failed = 0;
  let truncatedTimelines = 0;
  await Promise.all(Array.from({ length: Math.min(4, issues.length) }, async () => {
    while (index < issues.length) {
      signal.throwIfAborted();
      const issue = issues[index++]!;
      try {
        const timeline = await fetchTimeline(issue.id);
        signal.throwIfAborted();
        if (timeline.truncated) truncatedTimelines++;
        for (const entry of timeline.entries) entries.push({ issue, entry });
      } catch (error) {
        if (signal.aborted) throw error;
        failed++;
      }
    }
  }));
  return { issues, entries, failed, truncatedTimelines, truncated: offset < total || issues.length < Math.min(offset, total), total };
}

export function summarizePersonalWork(issues: PersonalIssue[], entries: { issue: PersonalIssue; entry: PersonalEntry }[], scope: { userId: string; agentIds?: Set<string>; start: string; end: string; timeZone: string; doneStatuses: Set<string> }) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: scope.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
  const records: PersonalRecord[] = [];
  const seen = new Set<string>();
  const add = (id: string, issue: PersonalIssue, time: string, kind: PersonalRecord["kind"], destination?: string) => {
    const stamp = Date.parse(time);
    if (!Number.isFinite(stamp) || seen.has(id)) return;
    const parts = Object.fromEntries(formatter.formatToParts(stamp).map((p) => [p.type, p.value]));
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    if (date < scope.start || date > scope.end) return;
    seen.add(id);
    records.push({ id, issue, time, date, hour: Number(parts.hour), kind, completed: kind === "status" && !!destination && scope.doneStatuses.has(destination), destination });
  };
  for (const issue of issues) if (issue.creator_type === "member" && issue.creator_id === scope.userId) add(`created:${issue.id}`, issue, issue.created_at, "created");
  for (const { issue, entry } of entries) {
    if (entry.actor_type !== "member" || entry.actor_id !== scope.userId || entry.source_task_id) continue;
    if (entry.type === "comment" && !entry.deleted_at) add(`comment:${entry.id}`, issue, entry.created_at, "comment");
    else if (entry.type === "activity" && entry.action === "status_changed") add(`status:${entry.id}`, issue, entry.created_at, "status", typeof entry.details?.to === "string" ? entry.details.to : undefined);
  }
  const agentCompleted = new Set<string>();
  for (const { issue, entry } of entries) {
    if (entry.type !== "activity" || entry.action !== "status_changed" || entry.actor_type !== "agent" || !scope.agentIds?.has(entry.actor_id) || typeof entry.details?.to !== "string" || !scope.doneStatuses.has(entry.details.to)) continue;
    const timestamp = Date.parse(entry.created_at);
    if (!Number.isFinite(timestamp)) continue;
    const parts = Object.fromEntries(formatter.formatToParts(timestamp).map((p) => [p.type, p.value]));
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    if (date >= scope.start && date <= scope.end) agentCompleted.add(issue.id);
  }
  const counts = { created: 0, comments: 0, statuses: 0, completed: 0 };
  const hours = Array<number>(24).fill(0);
  const days: Record<string, number> = {};
  for (const row of records) {
    if (row.kind === "created") counts.created++;
    else if (row.kind === "comment") counts.comments++;
    else counts.statuses++;
    if (row.completed) counts.completed++;
    hours[row.hour] = (hours[row.hour] ?? 0) + 1;
    days[row.date] = (days[row.date] ?? 0) + 1;
  }
  records.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  const busiest = Object.entries(days).sort(([aDate, aCount], [bDate, bCount]) => bCount - aCount || aDate.localeCompare(bDate))[0];
  const peak = Math.max(...hours);
  return {
    records, counts, hours, days,
    activeDays: Object.keys(days).length,
    touchedIssues: new Set(records.map((row) => row.issue.id)).size,
    completedIssues: new Set([...records.filter((row) => row.completed).map((row) => row.issue.id), ...agentCompleted]).size,
    agentCompletedIssues: agentCompleted.size,
    busiestDay: busiest ? { date: busiest[0], count: busiest[1] } : null,
    peakHour: peak > 0 ? { hour: hours.indexOf(peak), count: peak } : null,
  };
}
