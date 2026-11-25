import { describe, expect, it } from "vitest";
import { parseTaggedRecords, filterLocalChanges } from "./p4-dock";

describe("P4 dock data", () => {
  it("parses tagged records and multiline descriptions", () => {
    expect(parseTaggedRecords("... change 123\n... client a\n... desc ZGA-1 first\nsecond\n\n... change 124\n... client b\n", "change"))
      .toEqual([{ change: "123", client: "a", desc: "ZGA-1 first\nsecond" }, { change: "124", client: "b" }]);
  });
  it("only returns whole-identifier matches from local workspaces owned by the user", () => {
    const clients = [{ client: "local", Host: "MY-PC", Root: "D:\\Repo" }, { client: "remote", Host: "OTHER", Root: "D:\\Repo" }];
    const changes = [{ change: "1", client: "local", user: "me", desc: "ZGA-6594 fix" }, { change: "2", client: "remote", user: "me", desc: "ZGA-6594 fix" }, { change: "3", client: "local", user: "me", desc: "ZGA-65940 fix" }, { change: "4", client: "local", user: "other", desc: "ZGA-6594" }];
    expect(filterLocalChanges(clients, changes, "MY-PC", "me", ["ZGA-6594"]).map((x) => x.change)).toEqual(["1"]);
  });
  it("includes hostless workspaces only when their root exists locally", () => {
    const clients: Record<string, string>[] = [{ client: "worktree", Host: "", Root: "D:\\Repo", localRoot: "true" }, { client: "server", Host: "", Root: "/remote" }];
    const changes = [{ change: "1", client: "worktree", user: "me", desc: "ZGA-1 fix" }, { change: "2", client: "server", user: "me", desc: "ZGA-1 fix" }];
    expect(filterLocalChanges(clients, changes, "MY-PC", "me", ["ZGA-1"]).map((x) => x.change)).toEqual(["1"]);
  });
});
