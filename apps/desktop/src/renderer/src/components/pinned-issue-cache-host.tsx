import { createContext, memo, useContext, useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@multica/core/auth";
import { useCanonicalIssue } from "@multica/core/issues/canonical-id";
import { pinListOptions } from "@multica/core/pins/queries";
import { getCurrentSlug, subscribeToCurrentSlug } from "@multica/core/platform";
import { WorkspaceSlugProvider } from "@multica/core/paths";
import { workspaceListOptions } from "@multica/core/workspace";
import { CachedIssueDetail } from "@multica/views/issues/components";
import { useIssueTimeline } from "@multica/views/issues/hooks";
import { useNavigation, type NavigationAdapter } from "@multica/views/navigation";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";
import { useRenderedRouteStore } from "@/stores/rendered-route-store";
import { PinnedIssueCache } from "./pinned-issue-cache";
import { parsePinnedIssueRoute } from "./pinned-issue-route";
import { PinnedIssueCacheContext } from "./pinned-issue-cache-context";
import { StableIssueNavigation } from "./stable-issue-navigation";

const ManagedIssueContext = createContext<string | null>(null);
export function useCachedIssueId() { return useContext(ManagedIssueContext); }
const subscribeWorkspace = (notify: () => void) => subscribeToCurrentSlug(() => notify());

type VisitedWorkspace = { id: string; slug: string };

function BackgroundTimeline({ issueId, userId }: { issueId: string; userId: string }) {
  useIssueTimeline(issueId, userId);
  return null;
}

const CachedPage = memo(function CachedPage({ issueId, navigation, committedPath }: { issueId: string; navigation: NavigationAdapter | null; committedPath: string | null }) {
  const content = useMemo(() => <CachedIssueDetail issueId={issueId} />, [issueId]);
  return <StableIssueNavigation navigation={navigation} committedPath={committedPath}>{content}</StableIssueNavigation>;
});

function WorkspaceCache({ workspace, userId, active, enabled, current, committedPath, navigation }: {
  workspace: VisitedWorkspace; userId: string; active: string | null; enabled: boolean; current: boolean; committedPath: string | null; navigation: NavigationAdapter;
}) {
  const { data } = useQuery({ ...pinListOptions(workspace.id, userId), enabled: false });
  const ids = useMemo(() => (data ?? []).filter((pin) => pin.item_type === "issue").map((pin) => pin.item_id), [data]);
  return <WorkspaceSlugProvider slug={workspace.slug}>
    <PinnedIssueCache enabled={enabled} activeId={active} pinnedIds={ids}
      renderIssue={(id, isActive) => <CachedPage issueId={id} navigation={isActive ? navigation : null} committedPath={isActive ? committedPath : null} />}
      renderBackground={current ? (id) => <BackgroundTimeline issueId={id} userId={userId} /> : undefined} />
  </WorkspaceSlugProvider>;
}

/** Lives above the tab host so its hidden issue pages survive route and tab changes. */
export function PinnedIssueCacheHost({ children }: { children: ReactNode }) {
  const enabled = useDesktopPrefsStore((s) => s.pinnedIssueCacheEnabled);
  const navigation = useNavigation();
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const currentSlug = useSyncExternalStore(subscribeWorkspace, getCurrentSlug, getCurrentSlug);
  const renderedPath = useRenderedRouteStore((s) => s.pathname);
  const route = parsePinnedIssueRoute(renderedPath);
  const { data: workspaces } = useQuery(workspaceListOptions());
  const workspace = workspaces?.find((ws) => ws.slug === currentSlug);
  const wsId = workspace?.id ?? "";
  const workspaceReady = !!currentSlug && (!route || currentSlug === route.slug);
  const issue = useCanonicalIssue(enabled && workspaceReady ? wsId : "", route?.issue ?? "");
  const { data: pins } = useQuery({ ...pinListOptions(wsId, userId), enabled: enabled && workspaceReady && !!wsId && !!userId && !!route });
  const pinnedIds = useMemo(() => new Set((pins ?? []).filter((pin) => pin.item_type === "issue").map((pin) => pin.item_id)), [pins]);
  const snapshot = useMemo(() => ({ enabled: enabled && workspaceReady, workspaceId: wsId, pinnedIds }), [enabled, workspaceReady, wsId, pinnedIds]);
  const activeId = enabled && workspaceReady && route && issue.canonicalId && pins?.some((pin) => pin.item_type === "issue" && pin.item_id === issue.canonicalId)
    ? issue.canonicalId : null;
  const [visited, setVisited] = useState<VisitedWorkspace[]>([]);
  useLayoutEffect(() => {
    setVisited((old) => {
      if (!enabled || !userId) return old.length ? [] : old;
      const next = workspaces ? old.filter((item) => workspaces.some((ws) => ws.id === item.id)) : old;
      if (activeId && workspace && !next.some((item) => item.id === workspace.id)) return [...next, { id: workspace.id, slug: workspace.slug }];
      return next.length === old.length ? old : next;
    });
  }, [enabled, userId, workspaces, activeId, workspace]);
  const all = workspace && activeId && !visited.some((item) => item.id === workspace.id)
    ? [...visited, { id: workspace.id, slug: workspace.slug }] : visited;
  return <PinnedIssueCacheContext.Provider value={snapshot}><ManagedIssueContext.Provider value={activeId}>
    {enabled && userId && all.map((item) => <WorkspaceCache key={`${userId}:${item.id}`} workspace={item} userId={userId}
      active={item.id === wsId ? activeId : null} current={workspaceReady && item.id === wsId} enabled={enabled} committedPath={renderedPath} navigation={navigation} />)}
    {children}
  </ManagedIssueContext.Provider></PinnedIssueCacheContext.Provider>;
}
