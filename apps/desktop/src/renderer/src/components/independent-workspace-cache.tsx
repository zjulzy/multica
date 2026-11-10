import { useLayoutEffect, useRef, type ReactNode } from "react";
import { IndependentIssueCache } from "./independent-issue-cache";

/** Experimental: a workspace's page roots share no React render tree with the shell. */
export function IndependentWorkspaceCache({ activeId, pinnedIds, headerHost, renderIssue }: {
  activeId: string | null;
  pinnedIds: readonly string[];
  headerHost: HTMLElement | null;
  renderIssue: (id: string, header: HTMLElement | null) => ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const cache = useRef<IndependentIssueCache | null>(null);

  useLayoutEffect(() => {
    if (!host.current) return;
    const instance = new IndependentIssueCache(host.current, headerHost ?? undefined);
    cache.current = instance;
    return () => {
      cache.current = null;
      instance.clear(true);
    };
  }, [headerHost]);

  useLayoutEffect(() => {
    const instance = cache.current;
    if (!instance) return;
    instance.retain(new Set(pinnedIds));
    if (activeId && pinnedIds.includes(activeId)) instance.show(activeId, (header) => renderIssue(activeId, header));
    else instance.hide();
  }, [activeId, pinnedIds, headerHost, renderIssue]);

  return <div ref={host} style={{ display: "contents" }} />;
}
