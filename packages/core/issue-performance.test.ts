import { afterEach, describe, expect, it, vi } from "vitest";
import { beginIssuePerformance, finishIssuePerformance, finishTimelineRequest, startTimelineRequest } from "./issue-performance";

describe("issue load diagnostics", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reports elapsed stages and content sizes without identifiers or comment text", () => {
    let time = 100;
    vi.spyOn(performance, "now").mockImplementation(() => time);
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    beginIssuePerformance("private-issue-id");
    time = 120;
    startTimelineRequest("private-issue-id");
    time = 220;
    finishTimelineRequest("private-issue-id");
    time = 500;
    finishIssuePerformance("private-issue-id", { entries: 100, replies: 80, characters: 4000, longestReply: 1000 });
    expect(log).toHaveBeenCalledWith("[issue-load-performance]", expect.stringContaining('"totalMs":400'));
    const output = JSON.stringify(log.mock.calls);
    expect(output).toContain('timelineMs');
    expect(output).not.toContain("private-issue-id");
  });
});
