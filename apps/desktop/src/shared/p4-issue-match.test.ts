import { describe, expect, it } from "vitest";
import { issueIdentifiers, matchesIssueDescription } from "./p4-issue-match";

describe("P4 issue matching", () => {
  it("extracts the Multica identifier and explicitly marked external IDs", () => {
    expect(issueIdentifiers("ZGA-6594", "[STORY-7148266388] 滑索", "External-Id: STORY-7148266388")).toEqual(["ZGA-6594", "7148266388"]);
  });
  it("matches whole identifiers without partial numeric or identifier matches", () => {
    const ids = ["ZGA-6594", "7148266388"];
    expect(matchesIssueDescription("ZGA-6594 修复", ids)).toBe(true);
    expect(matchesIssueDescription("7148266388 修复", ids)).toBe(true);
    expect(matchesIssueDescription("ZGA-65940 修复", ids)).toBe(false);
    expect(matchesIssueDescription("17148266388 修复", ids)).toBe(false);
  });
  it("does not extract unrelated numbers from issue text", () => {
    expect(issueIdentifiers("ZGA-1", "CL 12345", "版本 1234567890")).toEqual(["ZGA-1"]);
  });
});
