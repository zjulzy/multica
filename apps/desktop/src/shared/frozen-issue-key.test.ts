import { describe, expect, it } from "vitest";
import { frozenIssueKey } from "./frozen-issue-key";

describe("frozen issue identity", () => {
  it("distinguishes users, workspaces, issues and delimiter-containing identifiers", () => {
    const base = frozenIssueKey({ userId: "user", workspaceId: "workspace", issueId: "issue" });
    expect(frozenIssueKey({ userId: "other", workspaceId: "workspace", issueId: "issue" })).not.toBe(base);
    expect(frozenIssueKey({ userId: "user", workspaceId: "other", issueId: "issue" })).not.toBe(base);
    expect(frozenIssueKey({ userId: "user", workspaceId: "workspace", issueId: "other" })).not.toBe(base);
    expect(frozenIssueKey({ userId: "a:b", workspaceId: "c", issueId: "d" })).not.toBe(frozenIssueKey({ userId: "a", workspaceId: "b:c", issueId: "d" }));
  });
  it("rejects absent identity components", () => {
    expect(() => frozenIssueKey({ userId: "", workspaceId: "workspace", issueId: "issue" })).toThrow();
    expect(() => frozenIssueKey({ userId: "user", workspaceId: "", issueId: "issue" })).toThrow();
    expect(() => frozenIssueKey({ userId: "user", workspaceId: "workspace", issueId: "" })).toThrow();
    expect(() => frozenIssueKey({ userId: null as never, workspaceId: "workspace", issueId: "issue" })).toThrow();
    expect(() => frozenIssueKey({ userId: " ", workspaceId: "workspace", issueId: "issue" })).toThrow();
    expect(() => frozenIssueKey({ userId: "x".repeat(1025), workspaceId: "workspace", issueId: "issue" })).toThrow();
  });
});
