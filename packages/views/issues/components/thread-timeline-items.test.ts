import { describe, expect, it } from "vitest";
import type { AgentTask, TimelineEntry } from "@multica/core/types";
import { projectThreadItems } from "./thread-timeline-items";

function comment(id: string, parent: string | null, time: string, resolved?: string): TimelineEntry {
  return { id, parent_id: parent, type: "comment", actor_type: "member", actor_id: "user", content: id, created_at: time, resolved_at: resolved } as TimelineEntry;
}

describe("single timeline thread projection", () => {
  const root = comment("root", null, "2026-01-01T00:00:00Z");
  const older = comment("older", "root", "2026-01-01T00:00:01Z");
  const newer = comment("newer", "root", "2026-01-01T00:00:02Z");
  it("projects each reply and the reply composer as separate stable rows", () => {
    expect(projectThreadItems(root, [older, newer], [], false, false).map((item) => [item.kind, item.id])).toEqual([
      ["thread-root", "root"], ["thread-reply", "older"], ["thread-reply", "newer"], ["thread-composer", "root"],
    ]);
  });
  it("omits replies and composer when the thread is collapsed", () => {
    expect(projectThreadItems(root, [older, newer], [], true, false).map((item) => item.kind)).toEqual(["thread-root"]);
  });
  it("shows only the resolution and a fold bar for a resolved reply", () => {
    const resolution = { ...newer, resolved_at: "2026-01-02T00:00:00Z" };
    expect(projectThreadItems(root, [older, resolution], [], false, false).map((item) => item.kind)).toEqual(["thread-root", "thread-fold-bar", "thread-reply"]);
    expect(projectThreadItems(root, [older, resolution], [], false, true).map((item) => item.kind)).toEqual(["thread-root", "thread-resolution-bar", "thread-reply", "thread-reply", "thread-composer"]);
  });
  it("retains an active run in chronological position", () => {
    const task = { id: "task-1", status: "running", created_at: "2026-01-01T00:00:01.500Z" } as AgentTask;
    const items = projectThreadItems(root, [older, newer], [{ task, anchorCommentId: older.id, hasReply: false }], false, false);
    expect(items.map((item) => item.id)).toEqual(["root", "older", "task-1", "newer", "root"]);
  });
  it("does not emit a zero-height item for a deleted reply", () => {
    const deleted = { ...older, deleted_at: "2026-01-03T00:00:00Z" };
    expect(projectThreadItems(root, [deleted, newer], [], false, false).map((item) => item.id)).toEqual(["root", "newer", "root"]);
  });
});
