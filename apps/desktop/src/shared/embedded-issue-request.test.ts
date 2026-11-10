import { describe, expect, it } from "vitest";
import { parseEmbeddedIssueRequest } from "./embedded-issue-request";

describe("embedded issue request validation", () => {
  const valid = { userId: "user", workspaceId: "workspace", issueId: "issue-1", path: "/team/issues/TES-1", title: "Task", bounds: { x: 200, y: 40, width: 500, height: 300 } };
  it("accepts a bounded issue request belonging to the active account and workspace", () => {
    const result = parseEmbeddedIssueRequest(valid, { userId: "user", workspaceId: "workspace", workspaceSlug: "team", issueRefs: ["issue-1", "TES-1"], viewport: { width: 1000, height: 600 } });
    expect(result?.context.path).toBe("/team/issues/TES-1");
    expect(result?.key).toBe(JSON.stringify(["user", "workspace", "issue-1"]));
    expect(result?.bounds).toEqual(valid.bounds);
  });
  it("rejects mismatched user, workspace, route, and invalid geometry", () => {
    const authority = { userId: "user", workspaceId: "workspace", workspaceSlug: "team", issueRefs: ["issue-1", "TES-1"], viewport: { width: 1000, height: 600 } };
    expect(parseEmbeddedIssueRequest({ ...valid, userId: "other" }, authority)).toBeNull();
    expect(parseEmbeddedIssueRequest({ ...valid, workspaceId: "other" }, authority)).toBeNull();
    expect(parseEmbeddedIssueRequest({ ...valid, path: "/other/issues/TES-1" }, authority)).toBeNull();
    expect(parseEmbeddedIssueRequest({ ...valid, path: "/team/issues/TES-2" }, authority)).toBeNull();
    expect(parseEmbeddedIssueRequest({ ...valid, path: "https://external.invalid/" }, authority)).toBeNull();
    expect(parseEmbeddedIssueRequest({ ...valid, bounds: { ...valid.bounds, width: -1 } }, authority)).toBeNull();
  });
});
