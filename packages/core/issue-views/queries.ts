import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";
import { getCurrentSlug, getCurrentWsId } from "../platform/workspace-storage";

/** The (scope_type, scope_id) container a surface's views live in. */
export interface IssueViewScope {
  scope_type: "workspace" | "my" | "project";
  scope_id?: string | null;
}

export const issueViewKeys = {
  all: (wsId: string) => ["issue-views", wsId] as const,
  list: (wsId: string, scope: IssueViewScope) =>
    [...issueViewKeys.all(wsId), scope.scope_type, scope.scope_id ?? null] as const,
  detail: (wsId: string, id: string) =>
    [...issueViewKeys.all(wsId), "detail", id] as const,
  everywhere: (wsId: string) => [...issueViewKeys.all(wsId), "everywhere"] as const,
};

/** Every view the caller can open, across workspace, my and project scopes. */
export function issueViewEverywhereOptions(wsId: string) {
  const workspaceSlug = getCurrentWsId() === wsId ? getCurrentSlug() : null;
  return queryOptions({
    queryKey: issueViewKeys.everywhere(wsId),
    queryFn: async () => {
      if (!workspaceSlug) throw new Error("Workspace identity is unavailable for issue views");
      try {
        return await api.listIssueViews({ scope_type: "all" }, workspaceSlug);
      } catch (error) {
        if ((error as { status?: number }).status !== 400) throw error;
        // Backends without the cross-scope list reject scope_type=all.
        const [workspace, my, projects] = await Promise.all([
          api.listIssueViews({ scope_type: "workspace" }, workspaceSlug),
          api.listIssueViews({ scope_type: "my" }, workspaceSlug),
          api.listProjects(undefined, workspaceSlug),
        ]);
        const projectViews = await Promise.all(projects.projects.map(async (project) => {
          try {
            return await api.listIssueViews({ scope_type: "project", scope_id: project.id }, workspaceSlug);
          } catch (projectError) {
            const status = (projectError as { status?: number }).status;
            if (status === 403 || status === 404) return [];
            throw projectError;
          }
        }));
        return [...workspace, ...my, ...projectViews.flat()];
      }
    },
    enabled: !!wsId && !!workspaceSlug,
  });
}

export function issueViewListOptions(wsId: string, scope: IssueViewScope) {
  return queryOptions({
    queryKey: issueViewKeys.list(wsId, scope),
    queryFn: () => api.listIssueViews(scope),
    enabled: !!wsId,
  });
}

/** One view by id — the sidebar pin rows resolve their label/target here. */
export function issueViewDetailOptions(wsId: string, id: string) {
  return queryOptions({
    queryKey: issueViewKeys.detail(wsId, id),
    queryFn: () => api.getIssueView(id),
    enabled: !!wsId && !!id,
  });
}

/**
 * Client-side mirror of the server's canManageIssueView: the owner, or a
 * workspace owner/admin for views shared to the workspace. Drives which
 * affordances render — the server re-checks on every write.
 */
export function canManageIssueView(
  view: { owner_id: string; visibility: string },
  userId: string | null,
  role: string | null | undefined,
): boolean {
  if (!userId) return false;
  if (view.owner_id === userId) return true;
  return view.visibility === "workspace" && (role === "owner" || role === "admin");
}
