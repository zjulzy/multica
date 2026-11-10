import { Activity, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Retains only visited pinned pages. Identity is supplied by the host and must include workspace. */
export function PinnedIssueCache({ enabled, activeId, pinnedIds, renderIssue, renderBackground }: {
  enabled: boolean;
  activeId: string | null;
  pinnedIds: readonly string[];
  renderIssue: (id: string, active: boolean) => ReactNode;
  renderBackground?: (id: string) => ReactNode;
}) {
  const [visited, setVisited] = useState<string[]>([]);
  const pinned = new Set(pinnedIds);
  const retained = enabled ? visited.filter((id) => pinned.has(id)) : [];
  const visible = activeId && !retained.includes(activeId) ? [...retained, activeId] : retained;
  const lastActive = useRef<string | null>(null);
  useEffect(() => {
    if (import.meta.env.DEV && activeId && activeId !== lastActive.current) {
      console.info("[pinned-issue-cache]", JSON.stringify({ kind: "activate", hit: visited.includes(activeId), cached: retained.length }));
    }
    lastActive.current = activeId;
  }, [activeId, visited, retained.length]);

  useLayoutEffect(() => {
    setVisited((previous) => {
      const next = enabled ? previous.filter((id) => pinnedIds.includes(id)) : [];
      if (enabled && activeId && pinnedIds.includes(activeId) && !next.includes(activeId)) next.push(activeId);
      return next.length === previous.length && next.every((id, i) => id === previous[i]) ? previous : next;
    });
  }, [enabled, activeId, pinnedIds]);

  return visible.map((id) => <Activity key={id} mode={id === activeId ? "visible" : "hidden"}>{renderIssue(id, id === activeId)}</Activity>).concat(
    renderBackground ? retained.filter((id) => id !== activeId).map((id) => <Activity key={`background:${id}`} mode="visible">{renderBackground(id)}</Activity>) : [],
  );
}
