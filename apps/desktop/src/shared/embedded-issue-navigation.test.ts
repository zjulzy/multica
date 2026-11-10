import { describe, expect, it } from "vitest";
import { embeddedIssueNavigation } from "./embedded-issue-navigation";

describe("embedded issue navigation", () => {
  const current = { workspaceSlug: "team", issueRefs: ["issue-uuid", "ZC-10"] };
  it("keeps the current issue's canonical address and comment hash in the child and informs the shell", () => {
    expect(embeddedIssueNavigation(current, "/team/issues/ZC-10#comment-123", "replace")).toEqual({ kind: "current-issue", path: "/team/issues/ZC-10#comment-123", replace: true });
  });
  it("routes another issue or application page back through the main shell", () => {
    expect(embeddedIssueNavigation(current, "/team/issues/ZC-11", "push")).toEqual({ kind: "shell", path: "/team/issues/ZC-11", replace: false });
    expect(embeddedIssueNavigation(current, "/team/projects", "push")).toEqual({ kind: "shell", path: "/team/projects", replace: false });
    expect(embeddedIssueNavigation(current, "/other/issues/ZC-10", "push")).toEqual({ kind: "shell", path: "/other/issues/ZC-10", replace: false });
  });
  it("rejects external and malformed URLs", () => {
    expect(embeddedIssueNavigation(current, "https://attacker.invalid/x", "push")).toBeNull();
    expect(embeddedIssueNavigation(current, "//attacker.invalid/x", "push")).toBeNull();
    expect(embeddedIssueNavigation(current, "javascript:alert(1)", "push")).toBeNull();
  });
});
