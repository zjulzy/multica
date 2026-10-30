import { describe, expect, it } from "vitest";
import { buildPersonalTrend, isoWeekFromDate, isoWeekStart, loadPersonalSnapshot, summarizePersonalWork } from "./personal-work";

describe("personal work summary", () => {
  it("groups long ranges by month or year while preserving action counts", () => {
    const days = { "2024-01-01": 2, "2024-02-20": 3, "2025-04-01": 4 };
    const monthly = buildPersonalTrend(days, "2024-01-01", "2025-04-01");
    expect(monthly.grain).toBe("month");
    expect(monthly.buckets[0]).toEqual({ label: "2024-01", count: 2 });
    expect(monthly.buckets[1]).toEqual({ label: "2024-02", count: 3 });
    expect(monthly.buckets.at(-1)).toEqual({ label: "2025-04", count: 4 });
    const yearly = buildPersonalTrend(days, "2000-01-01", "2025-04-01");
    expect(yearly.grain).toBe("year");
    expect(yearly.buckets.find((row) => row.label === "2024")?.count).toBe(5);
    expect(yearly.buckets.find((row) => row.label === "2025")?.count).toBe(4);
  });
  it("converts ISO weeks across calendar years without timezone shifts", () => {
    expect(isoWeekFromDate("2026-01-01")).toBe("2026-W01");
    expect(isoWeekStart("2026-W01")).toBe("2025-12-29");
    expect(isoWeekFromDate("2021-01-01")).toBe("2020-W53");
    expect(isoWeekStart("2020-W53")).toBe("2020-12-28");
    expect(isoWeekStart("2021-W53")).toBeNull();
    expect(isoWeekStart("")).toBeNull();
  });
  it("limits issue scanning and reports timeline failures instead of claiming completeness", async () => {
    const issue = { id: "i", identifier: "ZC-1", title: "Task", creator_type: "member", creator_id: "me", created_at: "2026-10-30T00:00:00Z" };
    const snapshot = await loadPersonalSnapshot(async () => ({ issues: [issue], total: 2 }), async () => { throw new Error("offline"); }, new AbortController().signal, 1);
    expect(snapshot.issues).toHaveLength(1);
    expect(snapshot.truncated).toBe(true);
    expect(snapshot.failed).toBe(1);
  });
  it("stops issuing timeline requests when the user leaves the view", async () => {
    const abort = new AbortController();
    const issue = { id: "i", identifier: "ZC-1", title: "Task", creator_type: "member", creator_id: "me", created_at: "2026-10-30T00:00:00Z" };
    let calls = 0;
    await expect(loadPersonalSnapshot(async () => ({ issues: [issue], total: 1 }), async () => { calls++; abort.abort(); return { entries: [], truncated: false }; }, abort.signal)).rejects.toBeDefined();
    expect(calls).toBe(1);
  });
  it("counts only the member's own records in the viewing timezone", () => {
    const issue = { id: "i", identifier: "ZC-1", title: "Task", creator_type: "member", creator_id: "me", created_at: "2026-10-29T16:10:00Z" };
    const events = [
      { issue, entry: { type: "comment", id: "c", actor_type: "member", actor_id: "me", created_at: "2026-10-30T01:00:00Z" } },
      { issue, entry: { type: "comment", id: "x", actor_type: "agent", actor_id: "me", created_at: "2026-10-30T01:00:00Z" } },
      { issue, entry: { type: "activity", id: "s", action: "status_changed", details: { to: "complete_custom" }, actor_type: "member", actor_id: "me", created_at: "2026-10-30T03:00:00Z" } },
      { issue, entry: { type: "comment", id: "deleted", deleted_at: "2026-10-30T04:00:00Z", actor_type: "member", actor_id: "me", created_at: "2026-10-30T03:00:00Z" } },
      { issue, entry: { type: "comment", id: "agent-provenance", source_task_id: "run-1", actor_type: "member", actor_id: "me", created_at: "2026-10-30T03:00:00Z" } },
    ];
    const result = summarizePersonalWork([issue], events, { userId: "me", start: "2026-10-30", end: "2026-10-30", timeZone: "Asia/Shanghai", doneStatuses: new Set(["done", "complete_custom"]) });
    expect(result.counts).toEqual({ created: 1, comments: 1, statuses: 1, completed: 1 });
    expect(result.hours[0]).toBe(1);
    expect(result.hours[9]).toBe(1);
    expect(result.days["2026-10-30"]).toBe(3);
    expect(result.records).toHaveLength(3);
    expect(result.activeDays).toBe(1);
    expect(result.touchedIssues).toBe(1);
    expect(result.busiestDay).toEqual({ date: "2026-10-30", count: 3 });
    expect(result.peakHour).toEqual({ hour: 0, count: 1 });
  });

  it("does not invent a busiest day or peak hour for an empty range", () => {
    const result = summarizePersonalWork([], [], { userId: "me", start: "2026-10-30", end: "2026-10-30", timeZone: "UTC", doneStatuses: new Set(["done"]) });
    expect(result.activeDays).toBe(0);
    expect(result.touchedIssues).toBe(0);
    expect(result.busiestDay).toBeNull();
    expect(result.peakHour).toBeNull();
  });

  it("counts a task completed more than once as one completed task", () => {
    const issue = { id: "i", identifier: "ZC-1", title: "Task", creator_type: "member", creator_id: "other", created_at: "2026-10-29T00:00:00Z" };
    const events = ["a", "b"].map((id) => ({ issue, entry: { type: "activity", id, action: "status_changed", details: { to: "done" }, actor_type: "member", actor_id: "me", created_at: "2026-10-30T03:00:00Z" } }));
    const result = summarizePersonalWork([issue], events, { userId: "me", start: "2026-10-30", end: "2026-10-30", timeZone: "UTC", doneStatuses: new Set(["done"]) });
    expect(result.counts.completed).toBe(2);
    expect(result.completedIssues).toBe(1);
  });

  it("includes owned agents' completions without counting their other activity", () => {
    const issue = { id: "i", identifier: "ZC-1", title: "Task", creator_type: "member", creator_id: "other", created_at: "2026-10-29T00:00:00Z" };
    const issue2 = { ...issue, id: "i2" };
    const status = (id: string, actor_id: string) => ({ type: "activity", id, action: "status_changed", details: { to: "done" }, actor_type: "agent", actor_id, created_at: "2026-10-30T03:00:00Z" });
    const events = [{ issue, entry: status("a", "mine") }, { issue, entry: status("b", "mine") }, { issue: issue2, entry: status("c", "other") }, { issue, entry: { type: "comment", id: "d", actor_type: "agent", actor_id: "mine", created_at: "2026-10-30T03:00:00Z" } }];
    const result = summarizePersonalWork([issue, issue2], events, { userId: "me", agentIds: new Set(["mine"]), start: "2026-10-30", end: "2026-10-30", timeZone: "UTC", doneStatuses: new Set(["done"]) });
    expect(result.completedIssues).toBe(1);
    expect(result.agentCompletedIssues).toBe(1);
    expect(result.counts.statuses).toBe(0);
    expect(result.records).toHaveLength(0);
    expect(result.hours[3]).toBe(0);
    const memberEvent = { issue, entry: { ...status("e", "me"), actor_type: "member" } };
    const overlapping = summarizePersonalWork([issue], [...events, memberEvent], { userId: "me", agentIds: new Set(["mine"]), start: "2026-10-30", end: "2026-10-30", timeZone: "UTC", doneStatuses: new Set(["done"]) });
    expect(overlapping.completedIssues).toBe(1);
  });

  it("does not classify another member, out-of-range events or unknown status as completed", () => {
    const issue = { id: "i", identifier: "ZC-1", title: "Task", creator_type: "agent", creator_id: "me", created_at: "2026-10-30T00:00:00Z" };
    const events = [{ issue, entry: { type: "activity", id: "1", actor_type: "member", actor_id: "me", action: "status_changed", details: { to: "unknown" }, created_at: "2026-10-30T12:00:00Z" } }, { issue, entry: { type: "comment", id: "2", actor_type: "member", actor_id: "other", created_at: "2026-10-30T12:00:00Z" } }];
    const result = summarizePersonalWork([issue], events, { userId: "me", start: "2026-10-30", end: "2026-10-30", timeZone: "UTC", doneStatuses: new Set(["done"]) });
    expect(result.counts).toEqual({ created: 0, comments: 0, statuses: 1, completed: 0 });
  });
});
