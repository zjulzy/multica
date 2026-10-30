import { describe, expect, it } from "vitest";
import { calculateInsights, dateFromParts, loadTaskHistory } from "./work-insights";

describe("work insights", () => {
  it("builds an ISO date from parts regardless of locale display order", () => {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });
    expect(dateFromParts(formatter, Date.parse("2026-10-29T16:30:00Z"))).toBe("2026-10-30");
  });
  it("uses the viewing timezone and applies all filters consistently", () => {
    const tasks = [
      { id: "1", agent_id: "a", issue_id: "i", started_at: "2026-10-29T16:30:00Z", completed_at: "2026-10-29T18:30:00Z" },
      { id: "2", agent_id: "b", issue_id: "i", started_at: "2026-10-30T15:00:00Z", completed_at: null },
      { id: "3", agent_id: "a", issue_id: "other", started_at: "2026-10-30T16:00:00Z", completed_at: null },
      { id: "4", agent_id: "a", issue_id: "i", started_at: null, completed_at: null },
    ];
    const result = calculateInsights(tasks, { start: "2026-10-30", end: "2026-10-30", timeZone: "Asia/Shanghai", agentId: "a", issueIds: new Set(["i"]) });
    expect(result.total).toBe(1);
    expect(result.days["2026-10-30"]).toBe(1);
    expect(result.hours[0]).toBe(1);
    expect(result.longest?.seconds).toBe(7200);
    expect(result.agents[0]).toMatchObject({ id: "a", count: 1, activeDays: 1, nightCount: 1 });
  });

  it("does not count incomplete or invalid durations as completed runs", () => {
    const result = calculateInsights([{ id: "1", agent_id: "a", issue_id: "", started_at: "2026-10-30T08:00:00Z", completed_at: null }, { id: "2", agent_id: "a", issue_id: "", started_at: "2026-10-30T08:00:00Z", completed_at: "2026-10-30T07:00:00Z" }], { start: "2026-10-30", end: "2026-10-30", timeZone: "UTC", agentId: null, issueIds: null });
    expect(result.total).toBe(2);
    expect(result.longest).toBeNull();
  });

  it("reads every page even when old created tasks can have recent starts", async () => {
    const cursors: (string | undefined)[] = [];
    const tasks = await loadTaskHistory(["a"], async (_id, before) => {
      cursors.push(before);
      return before ? { tasks: [{ id: "old" }], nextCursor: null } : { tasks: [{ id: "new" }], nextCursor: "next" };
    });
    expect(cursors).toEqual([undefined, "next"]);
    expect(tasks.map((t) => t.id)).toEqual(["new", "old"]);
  });
});
