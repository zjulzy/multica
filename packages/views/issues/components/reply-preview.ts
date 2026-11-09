import type { TimelineEntry } from "@multica/core/types";
import { descriptionPreview } from "./description-preview";

const cache = new WeakMap<TimelineEntry, { content: string; preview: string }>();
const MAX_SOURCE_LENGTH = 4096;

/** Build a bounded summary once per immutable reply, not on every rerender. */
export function replyPreview(reply: TimelineEntry): string {
  const content = reply.content ?? "";
  const saved = cache.get(reply);
  if (saved?.content === content) return saved.preview;
  const preview = descriptionPreview(content.slice(0, MAX_SOURCE_LENGTH));
  cache.set(reply, { content, preview });
  return preview;
}
