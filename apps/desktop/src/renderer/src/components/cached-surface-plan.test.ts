import { describe, expect, it } from "vitest";
import { planCachedSurfaces } from "./cached-surface-plan";

describe("cached issue surfaces", () => {
  it("keeps independently visible main and dock issues alive", () => {
    expect(planCachedSurfaces({ main: "issue-a", dock: "issue-b", inbox: null })).toEqual([
      { surface: "main", issueId: "issue-a", instanceKey: "issue-a" },
      { surface: "dock", issueId: "issue-b", instanceKey: "issue-b" },
    ]);
  });
  it("does not steal one live page when the same issue is visible twice", () => {
    expect(planCachedSurfaces({ main: "issue-a", dock: "issue-a", inbox: null })).toEqual([
      { surface: "main", issueId: "issue-a", instanceKey: "issue-a" },
      { surface: "dock", issueId: "issue-a", instanceKey: "issue-a::dock" },
    ]);
  });
  it("lets the inbox reuse the ordinary cached instance when the main issue is hidden", () => {
    expect(planCachedSurfaces({ main: null, inbox: "issue-a", dock: null })).toEqual([
      { surface: "inbox", issueId: "issue-a", instanceKey: "issue-a" },
    ]);
  });
});
