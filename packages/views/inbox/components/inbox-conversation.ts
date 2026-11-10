import type { TimelineEntry } from "@multica/core/types";

/** Select a bounded part of one thread without ever redirecting a reply to a different thread. */
export function selectInboxConversation(timeline: TimelineEntry[], targetId?: string, maxReplies = 6) {
  const comments = timeline.filter((entry) => entry.type === "comment");
  const byId = new Map(comments.map((entry) => [entry.id, entry]));
  const target = targetId ? byId.get(targetId) : comments.at(-1);
  if (!target) return { rootId: null, entries: [] as TimelineEntry[], targetMissing: !!targetId, hiddenCount: 0 };
  const rootCache = new Map<string, string | null>();
  const findRoot = (entry: TimelineEntry): string | null => {
    const visited = new Set<string>();
    const path: string[] = [];
    let current = entry;
    let root: string | null = null;
    while (current.parent_id) {
      if (rootCache.has(current.id)) { root = rootCache.get(current.id) ?? null; break; }
      if (visited.has(current.id)) break;
      visited.add(current.id);
      path.push(current.id);
      const parent = byId.get(current.parent_id);
      if (!parent) break;
      current = parent;
    }
    if (!current.parent_id) root = current.id;
    for (const id of path) rootCache.set(id, root);
    rootCache.set(current.id, root);
    return root;
  };
  const rootId = findRoot(target);
  if (!rootId) return { rootId: null, entries: [] as TimelineEntry[], targetMissing: true, hiddenCount: 0 };
  const replies = comments.filter((entry) => entry.id !== rootId && findRoot(entry) === rootId);
  const limit = Math.max(1, Math.floor(maxReplies));
  const selected = new Set<string>();
  let ancestor = target;
  while (ancestor.id !== rootId) {
    if (selected.size >= limit) return { rootId: null, entries: [] as TimelineEntry[], targetMissing: true, hiddenCount: 0 };
    selected.add(ancestor.id);
    ancestor = byId.get(ancestor.parent_id!)!;
  }
  for (const entry of [...replies].reverse()) {
    if (selected.size >= limit) break;
    selected.add(entry.id);
  }
  return { rootId, entries: comments.filter((entry) => entry.id === rootId || selected.has(entry.id)), targetMissing: false, hiddenCount: Math.max(0, replies.length - selected.size) };
}
