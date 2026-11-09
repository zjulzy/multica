import type { TimelineEntry } from "@multica/core/types";
import { isDeletedComment } from "@multica/core/issues/comment-deletion";
import { orderThreadWithRuns, type CommentRun, type ThreadRunSlot } from "./comment-runs";
import { deriveThreadResolution } from "./thread-utils";

export type ThreadTimelineItem =
  | { kind: "thread-root"; id: string; root: TimelineEntry }
  | { kind: "thread-fold-bar" | "thread-resolution-bar" | "thread-composer"; id: string; root: TimelineEntry }
  | { kind: "thread-reply"; id: string; root: TimelineEntry; row: TimelineEntry | ThreadRunSlot; latestReplyId?: string; resolutionReplyId?: string; lockedExpanded?: boolean };

/** Project a thread without changing its existing ordering or resolution rules. */
export function projectThreadItems(root: TimelineEntry, replies: TimelineEntry[], runs: readonly CommentRun[], collapsed: boolean, resolutionExpanded: boolean): ThreadTimelineItem[] {
  const result: ThreadTimelineItem[] = [{ kind: "thread-root", id: root.id, root }];
  if (collapsed) return result;
  const resolution = deriveThreadResolution(root, replies);
  const resolutionId = resolution.kind === "reply" ? resolution.resolutionId : undefined;
  const folded = !!resolutionId && !resolutionExpanded;
  if (folded && replies.some((reply) => reply.id !== resolutionId && !isDeletedComment(reply))) {
    result.push({ kind: "thread-fold-bar", id: root.id, root });
  } else if (resolutionId && resolutionExpanded) {
    result.push({ kind: "thread-resolution-bar", id: root.id, root });
  }
  const visibleReplies = folded ? replies.filter((reply) => reply.id === resolutionId) : replies;
  const visibleRuns = folded ? runs.filter((run) => !run.hasReply && (run.anchorCommentId === root.id || run.anchorCommentId === resolutionId)) : runs;
  const rows = orderThreadWithRuns(root, visibleReplies, visibleRuns);
  const last = [...rows].reverse().find((row) => {
    const reply = "run" in row ? row.reply : row;
    return reply && !isDeletedComment(reply);
  });
  const latestReplyId = last ? ("run" in last ? last.reply?.id : last.id) : undefined;
  for (const row of rows) {
    if (!("run" in row) && isDeletedComment(row)) continue;
    result.push({ kind: "thread-reply", id: "run" in row ? row.reply?.id ?? row.run.task.id : row.id, root, row, latestReplyId, resolutionReplyId: resolutionId, lockedExpanded: folded });
  }
  if (!folded) result.push({ kind: "thread-composer", id: root.id, root });
  return result;
}
