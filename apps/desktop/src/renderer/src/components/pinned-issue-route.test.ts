import { describe, expect, it } from "vitest";
import { embeddedCanonicalIssuePath, parsePinnedIssueRoute } from "./pinned-issue-route";

describe("pinned issue routes", () => {
  it("extracts the workspace and issue without treating nested or malformed paths as issue pages", () => {
    expect(parsePinnedIssueRoute("/team/issues/ZC-42?x=1#comment-a")).toEqual({ slug: "team", issue: "ZC-42" });
    expect(parsePinnedIssueRoute("/team/issues/a/extra")).toBeNull();
    expect(parsePinnedIssueRoute("/team/projects/ZC-42")).toBeNull();
    expect(parsePinnedIssueRoute("/team/issues/%ZZ")).toBeNull();
  });
  it("starts a guest using the known issue id while preserving the target comment", () => {
    expect(embeddedCanonicalIssuePath("/team/issues/ZC-42?x=1#comment-a", "team", "abc-123"))
      .toBe("/team/issues/abc-123?x=1#comment-a");
  });
});
