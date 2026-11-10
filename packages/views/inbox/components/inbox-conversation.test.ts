import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "@multica/core/types";
import { selectInboxConversation } from "./inbox-conversation";

function comment(id: string, parent: string | null): TimelineEntry {
  return { type: "comment", id, parent_id: parent, actor_type: "member", actor_id: "user", created_at: "2026-01-01", content: id };
}

describe("lightweight inbox conversation", () => {
  it("shows the target's thread, its root and a bounded set of recent replies", () => {
    const entries = [comment("root", null), ...Array.from({ length: 20 }, (_, i) => comment(`reply-${i}`, "root")), comment("other", null)];
    const result = selectInboxConversation(entries, "reply-2", 4);
    expect(result.rootId).toBe("root");
    expect(result.entries.map((entry) => entry.id)).toEqual(["root", "reply-2", "reply-17", "reply-18", "reply-19"]);
    expect(result.targetMissing).toBe(false);
  });
  it("uses the latest thread when the notification does not target a comment", () => {
    const result = selectInboxConversation([comment("a", null), comment("b", null), comment("b-reply", "b")], undefined, 4);
    expect(result.rootId).toBe("b");
    expect(result.entries.map((entry) => entry.id)).toEqual(["b", "b-reply"]);
  });
  it("never silently replies to another thread if the target is missing", () => {
    expect(selectInboxConversation([comment("other", null)], "missing", 4)).toMatchObject({ rootId: null, targetMissing: true, entries: [] });
  });
  it("retains the target's parent context when selecting recent replies", () => {
    const entries = [comment("root", null), comment("parent", "root"), comment("target", "parent"), ...Array.from({ length: 8 }, (_, i) => comment(`new-${i}`, "root"))];
    expect(selectInboxConversation(entries, "target", 4).entries.map((entry) => entry.id)).toEqual(["root", "parent", "target", "new-6", "new-7"]);
  });
  it("handles broken or cyclic parent links without looping", () => {
    expect(selectInboxConversation([comment("a", "b"), comment("b", "a")], "a", 4)).toMatchObject({ rootId: null, targetMissing: true, entries: [] });
  });
});
