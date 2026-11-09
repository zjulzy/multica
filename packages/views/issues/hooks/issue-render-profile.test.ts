import { expect, it } from "vitest";
import { recordIssueRender, takeIssueRenderSummary } from "./issue-render-profile";

it("summarizes render counts and durations without retaining user content", () => {
  takeIssueRenderSummary();
  recordIssueRender("reply-header", 8.4);
  recordIssueRender("reply-header", 3.1);
  recordIssueRender("reply-content", 12.2);
  expect(takeIssueRenderSummary()).toEqual({
    "reply-header": { commits: 2, totalMs: 12, maxMs: 8 },
    "reply-content": { commits: 1, totalMs: 12, maxMs: 12 },
  });
  expect(takeIssueRenderSummary()).toEqual({});
});
