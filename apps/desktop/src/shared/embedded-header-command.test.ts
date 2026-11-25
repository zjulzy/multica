import { describe, expect, it } from "vitest";
import { parseEmbeddedHeaderCommand } from "./embedded-header-command";

describe("embedded issue header commands", () => {
  it("only accepts the supported command and a bounded guest token", () => {
    expect(parseEmbeddedHeaderCommand({ token: "guest-1", command: "toggle-sidebar" })).toEqual({ token: "guest-1", command: "toggle-sidebar" });
    expect(parseEmbeddedHeaderCommand({ token: "guest-1", command: "append-comment", issueId: "issue-1", text: "code" })).toEqual({ token: "guest-1", command: "append-comment", issueId: "issue-1", text: "code" });
    expect(parseEmbeddedHeaderCommand({ token: "guest-1", command: "append-comment", issueId: "issue-1", text: "x".repeat(50001) })).toBeNull();
    expect(parseEmbeddedHeaderCommand({ token: "", command: "toggle-sidebar" })).toBeNull();
    expect(parseEmbeddedHeaderCommand({ token: "guest-1", command: "delete" })).toBeNull();
    expect(parseEmbeddedHeaderCommand({ token: "x".repeat(257), command: "toggle-sidebar" })).toBeNull();
    expect(parseEmbeddedHeaderCommand({ token: "guest-1", command: "open-wakeups" })).toEqual({ token: "guest-1", command: "open-wakeups" });
    expect(parseEmbeddedHeaderCommand({ token: "guest-1", command: "jump-to-run", taskId: "task-1" })).toEqual({ token: "guest-1", command: "jump-to-run", taskId: "task-1" });
    expect(parseEmbeddedHeaderCommand({ token: "guest-1", command: "jump-to-run", taskId: "../unsafe" })).toBeNull();
  });
});
