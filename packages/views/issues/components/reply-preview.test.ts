import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "@multica/core/types";
import { replyPreview } from "./reply-preview";

describe("folded reply preview", () => {
  it("bounds long replies and refreshes if content changes", () => {
    const reply = { id: "r", content: "a".repeat(100_000) } as TimelineEntry;
    expect(replyPreview(reply).length).toBeLessThanOrEqual(300);
    reply.content = "new content";
    expect(replyPreview(reply)).toBe("new content");
  });
});
