import { describe, expect, it } from "vitest";
import { parseEmbeddedIssuePresentation } from "./embedded-issue-presentation";

describe("embedded issue presentation", () => {
  it("accepts inbox comment targets without accepting arbitrary input", () => {
    expect(parseEmbeddedIssuePresentation({ surface: "dock", highlightCommentId: "comment-1", highlightRequestToken: 2 })).toEqual({ surface: "dock", highlightCommentId: "comment-1", highlightRequestToken: 2 });
    expect(parseEmbeddedIssuePresentation({ surface: "other" })).toBeNull();
    expect(parseEmbeddedIssuePresentation({ surface: "dock", highlightCommentId: "../unsafe" })).toBeNull();
  });
  it("accepts the regular main surface", () => {
    expect(parseEmbeddedIssuePresentation({ surface: "main" })).toEqual({ surface: "main" });
  });
});
