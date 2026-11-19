import { describe, expect, it } from "vitest";
import { parseEmbeddedIssueMutation } from "./embedded-issue-mutation";

describe("embedded issue mutation synchronization", () => {
  it("only accepts successful, tagged mutations in the active workspace", () => {
    const event = (operation: string, variables: unknown, status = "success") => ({ type: "updated", action: { type: status }, mutation: { options: { meta: { embeddedIssueSync: operation, workspaceId: "ws" } }, state: { variables } } });
    expect(parseEmbeddedIssueMutation(event("update", { id: "issue-1" }), "ws")).toEqual({ operation: "update", issueIds: ["issue-1"] });
    const moved = event("update", { id: "child", parent_issue_id: "new-parent" });
    const withContext = { ...moved, mutation: { ...moved.mutation, state: { ...moved.mutation.state, context: { parentId: "old-parent" } } } };
    expect(parseEmbeddedIssueMutation(withContext, "ws")).toEqual({ operation: "update", issueIds: ["child", "old-parent", "new-parent"] });
    expect(parseEmbeddedIssueMutation(event("update-many", { ids: ["issue-1", "issue-2"] }), "ws")).toEqual({ operation: "update", issueIds: ["issue-1", "issue-2"] });
    expect(parseEmbeddedIssueMutation(event("delete", "issue-1"), "ws")).toEqual({ operation: "delete", issueIds: ["issue-1"] });
    const deletedBatch = event("delete-many", ["a", "b"]);
    expect(parseEmbeddedIssueMutation({ ...deletedBatch, action: { type: "success", data: { deleted: 2 } } }, "ws")).toEqual({ operation: "delete", issueIds: ["a", "b"] });
    expect(parseEmbeddedIssueMutation({ ...deletedBatch, action: { type: "success", data: { deleted: 1 } } }, "ws")).toEqual({ operation: "update", issueIds: ["a", "b"] });
    expect(parseEmbeddedIssueMutation(event("delete", "issue-1", "error"), "ws")).toBeNull();
    expect(parseEmbeddedIssueMutation(event("delete", "issue-1"), "other")).toBeNull();
    expect(parseEmbeddedIssueMutation(event("delete", { id: "issue-1" }), "ws")).toBeNull();
    expect(parseEmbeddedIssueMutation(event("unrelated", "issue-1"), "ws")).toBeNull();
    const created = { ...event("create", {}), action: { type: "success", data: { parent_issue_id: "parent-1" } } };
    expect(parseEmbeddedIssueMutation(created, "ws")).toEqual({ operation: "update", issueIds: ["parent-1"] });
    expect(parseEmbeddedIssueMutation({ ...created, action: { type: "success", data: {} } }, "ws")).toBeNull();
  });
});
