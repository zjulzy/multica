import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@multica/core/auth";
import { useCanonicalIssue } from "@multica/core/issues/canonical-id";
import { issueKeys } from "@multica/core/issues/queries";
import { pinListOptions } from "@multica/core/pins/queries";
import { getCurrentSlug, subscribeToCurrentSlug } from "@multica/core/platform";
import { WorkspaceSlugProvider } from "@multica/core/paths";
import { useWS } from "@multica/core/realtime";
import { workspaceListOptions } from "@multica/core/workspace";
import { CachedIssueDetail } from "@multica/views/issues/components";
import { useIssueTimeline } from "@multica/views/issues/hooks";
import { usePageHeaderPortalTarget } from "@multica/views/layout";
import { useNavigationBridge } from "@multica/views/navigation";
import { ErrorBoundary } from "@multica/ui/components/common/error-boundary";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";
import { useRenderedRouteStore } from "@/stores/rendered-route-store";
import { IndependentWorkspaceCache } from "./independent-workspace-cache";
import { IndependentIssueProviders } from "./independent-issue-providers";
import { PinnedIssueCacheContext } from "./pinned-issue-cache-context";
import { parsePinnedIssueRoute } from "./pinned-issue-route";

const subscribeWorkspace = (notify: () => void) => subscribeToCurrentSlug(() => notify());
type Workspace = { id: string; slug: string };

function BackgroundTimeline({ id, userId }: { id: string; userId: string }) {
  useIssueTimeline(id, userId);
  return null;
}

function WorkspaceCache({ workspace, userId, activeId, current, header, committedPath }: {
  workspace: Workspace; userId: string; activeId: string | null; current: boolean; header: HTMLElement | null; committedPath: string | null;
}) {
  const queryClient = useQueryClient();
  const ws = useWS();
  const { i18n } = useTranslation();
  const nextNavigation = useNavigationBridge();
  const committedNavigation = useRef(nextNavigation);
  if (nextNavigation.navigation.pathname === committedPath) committedNavigation.current = nextNavigation;
  const navigation = committedNavigation.current;
  const { data: pins } = useQuery({ ...pinListOptions(workspace.id, userId), enabled: false });
  const pinnedIds = useMemo(() => (pins ?? []).filter((pin) => pin.item_type === "issue").map((pin) => pin.item_id), [pins]);
  const [visited, setVisited] = useState<string[]>([]);
  useLayoutEffect(() => {
    setVisited((previous) => {
      // An unavailable pin snapshot is not evidence that the user removed pins.
      if (!pins) return previous;
      const next = previous.filter((id) => pinnedIds.includes(id));
      if (activeId && pinnedIds.includes(activeId) && !next.includes(activeId)) next.push(activeId);
      return next.length === previous.length && next.every((id, index) => id === previous[index]) ? previous : next;
    });
  }, [pins, pinnedIds, activeId]);
  useLayoutEffect(() => {
    if (current) return;
    // Other workspaces cannot receive this workspace's live events. Validate on return.
    for (const id of visited) void queryClient.invalidateQueries({ queryKey: issueKeys.timeline(id), refetchType: "none" });
  }, [current, queryClient, visited]);
  const renderIssue = useCallback((id: string, target: HTMLElement | null) =>
    <IndependentIssueProviders queryClient={queryClient} ws={ws} i18n={i18n} navigation={navigation} slug={workspace.slug} header={target}>
      <ErrorBoundary><CachedIssueDetail issueId={id} /></ErrorBoundary>
    </IndependentIssueProviders>, [queryClient, ws, i18n, navigation, workspace.slug]);
  // During a transient absent snapshot, retain all previously visited pages.
  const retainedIds = pins ? pinnedIds : visited;
  return <>
    <IndependentWorkspaceCache activeId={activeId} pinnedIds={retainedIds} headerHost={header} renderIssue={renderIssue} />
    {current && <WorkspaceSlugProvider slug={workspace.slug}>{visited.filter((id) => id !== activeId && retainedIds.includes(id)).map((id) =>
      <BackgroundTimeline key={id} id={id} userId={userId} />)}</WorkspaceSlugProvider>}
  </>;
}

/** Experimental host; deliberately not mounted in the desktop shell yet. */
export function IndependentPinnedIssueHost({ children }: { children: ReactNode }) {
  const enabled = useDesktopPrefsStore((s) => s.pinnedIssueCacheEnabled);
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const slug = useSyncExternalStore(subscribeWorkspace, getCurrentSlug, getCurrentSlug);
  const renderedPath = useRenderedRouteStore((s) => s.pathname);
  const route = parsePinnedIssueRoute(renderedPath);
  const header = usePageHeaderPortalTarget();
  const { data: workspaces } = useQuery(workspaceListOptions());
  const workspace = workspaces?.find((item) => item.slug === slug);
  const workspaceId = workspace?.id ?? "";
  const ready = !!slug && (!route || slug === route.slug);
  const issue = useCanonicalIssue(enabled && ready ? workspaceId : "", route?.issue ?? "");
  const { data: pins } = useQuery({ ...pinListOptions(workspaceId, userId), enabled: enabled && ready && !!workspaceId && !!userId && !!route });
  const pinnedIds = useMemo(() => new Set((pins ?? []).filter((pin) => pin.item_type === "issue").map((pin) => pin.item_id)), [pins]);
  const snapshot = useMemo(() => ({ enabled: enabled && ready, workspaceId, pinnedIds }), [enabled, ready, workspaceId, pinnedIds]);
  const activeId = enabled && ready && route && issue.canonicalId && pinnedIds.has(issue.canonicalId) ? issue.canonicalId : null;
  const [visited, setVisited] = useState<Workspace[]>([]);
  useLayoutEffect(() => {
    setVisited((previous) => {
      if (!enabled || !userId) return previous.length ? [] : previous;
      const next = workspaces ? previous.filter((item) => workspaces.some((ws) => ws.id === item.id)) : previous;
      if (activeId && workspace && !next.some((item) => item.id === workspace.id)) return [...next, { id: workspace.id, slug: workspace.slug }];
      return next.length === previous.length ? previous : next;
    });
  }, [enabled, userId, workspaces, activeId, workspace]);
  const all = workspace && activeId && !visited.some((item) => item.id === workspace.id) ? [...visited, { id: workspace.id, slug: workspace.slug }] : visited;
  return <PinnedIssueCacheContext.Provider value={snapshot}>
    {enabled && userId && all.map((item) => <WorkspaceCache key={`${userId}:${item.id}`} workspace={item} userId={userId}
      activeId={item.id === workspaceId ? activeId : null} current={ready && item.id === workspaceId} header={header} committedPath={renderedPath} />)}
    {children}
  </PinnedIssueCacheContext.Provider>;
}
