"use client";

import { useCallback } from "react";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useAuthStore } from "../auth";
import { defaultStorage } from "../platform/storage";
import type { IssueViewPreference } from "../api/schemas";
import { useWorkspaceSlug } from "../paths/hooks";
import { getCurrentSlug, getCurrentWsId } from "../platform/workspace-storage";
import type { IssueViewScope } from "./queries";

/**
 * A preference container: a view surface, the user's starred sidebar views,
 * or the sidebar's Projects section.
 */
export type IssueViewPreferenceScope =
  | IssueViewScope
  | { scope_type: "sidebar" | "sidebar_projects"; scope_id?: null };

export interface ViewBarPrefs {
  hidden: string[];
  order: string[];
}

export const EMPTY_VIEW_BAR_PREFS: ViewBarPrefs = { hidden: [], order: [] };

/** A whole preference document; scopes other than view bars add their own keys. */
export type IssueViewPreferenceDoc = Partial<ViewBarPrefs> & Record<string, unknown>;

export const issueViewPrefKeys = {
  all: (wsId: string) => ["issue-view-prefs", wsId] as const,
  scope: (wsId: string, scope: IssueViewPreferenceScope) =>
    [...issueViewPrefKeys.all(wsId), scope.scope_type, scope.scope_id ?? null] as const,
};

type LocalPreference = IssueViewPreference & { localOnly?: true };

function localPreferenceKey(wsId: string, scope: IssueViewPreferenceScope): string | null {
  if (scope.scope_type !== "sidebar" && scope.scope_type !== "sidebar_projects") return null;
  const userId = useAuthStore.getState?.()?.user?.id;
  if (!userId) return null;
  return `multica-sidebar-preference:${encodeURIComponent(api.getBaseUrl())}:${encodeURIComponent(wsId)}:${encodeURIComponent(userId)}:${scope.scope_type}`;
}

function readLocalPreference(key: string, scope: IssueViewPreferenceScope): LocalPreference {
  const raw = defaultStorage.getItem(key);
  let stored: { prefs?: IssueViewPreferenceDoc; updated_at?: string } = {};
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) stored = parsed;
    } catch { /* Ignore invalid local data. */ }
  }
  return {
    scope_type: scope.scope_type,
    scope_id: scope.scope_id ?? null,
    prefs: { ...EMPTY_VIEW_BAR_PREFS, ...(stored.prefs ?? {}) },
    updated_at: stored.updated_at ?? "",
    localOnly: true,
  };
}

export function issueViewPreferenceOptions(wsId: string, scope: IssueViewPreferenceScope) {
  const workspaceSlug = getCurrentWsId() === wsId ? getCurrentSlug() : null;
  const localKey = localPreferenceKey(wsId, scope);
  return queryOptions({
    queryKey: issueViewPrefKeys.scope(wsId, scope),
    queryFn: async () => {
      if (!workspaceSlug) throw new Error("Workspace identity is unavailable for issue view preferences");
      try {
        const remote = await api.getIssueViewPreference(scope, workspaceSlug);
        // Local fallback stays authoritative on this device until an explicit
        // migration is available; a different device must not overwrite it.
        if (localKey) {
          const local = readLocalPreference(localKey, scope);
          if (local.updated_at) return local;
        }
        return remote;
      } catch (error) {
        const key = (error as { status?: number }).status === 400 ? localKey : null;
        if (!key) throw error;
        return readLocalPreference(key, scope);
      }
    },
    enabled: !!wsId && !!workspaceSlug,
  });
}

interface PreferenceWrite {
  prefs: IssueViewPreferenceDoc;
  workspaceId: string;
  workspaceSlug?: string;
  localKey: string | null;
}

/**
 * Whole-document upsert with an optimistic patch: show/hide toggles and
 * drag-reorder are the canonical optimistic case (locally predictable, same
 * screen, trivial rollback). Returns `save(prefs)`.
 */
export function useUpdateIssueViewPreference(wsId: string, scope: IssueViewPreferenceScope) {
  const queryClient = useQueryClient();
  const routeSlug = useWorkspaceSlug();
  const queryKey = issueViewPrefKeys.scope(wsId, scope);
  const { mutate } = useMutation({
    mutationKey: queryKey,
    // Each write replaces the whole document and builds on the one before it,
    // so writes to one document go out one at a time, in order: run side by
    // side, an older write could land last and undo a newer one.
    scope: { id: queryKey.join(":") },
    // A queued write can go out after the user has switched workspace, so the
    // write names its own workspace rather than inherit the current one.
    mutationFn: ({ prefs, workspaceId, workspaceSlug, localKey }: PreferenceWrite) => {
      const current = queryClient.getQueryData<LocalPreference>(issueViewPrefKeys.scope(workspaceId, scope));
      if (current?.localOnly && localKey) {
        defaultStorage.setItem(localKey, JSON.stringify({ prefs, updated_at: new Date().toISOString() }));
        return Promise.resolve(readLocalPreference(localKey, scope));
      }
      if (current?.localOnly) return Promise.reject(new Error("Local preference has no user identity"));
      return api.putIssueViewPreference({ ...scope, prefs }, workspaceSlug);
    },
    onMutate: async ({ prefs, workspaceId }) => {
      const key = issueViewPrefKeys.scope(workspaceId, scope);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<IssueViewPreference>(key);
      const optimistic: IssueViewPreference = {
        ...previous,
        scope_type: scope.scope_type,
        scope_id: scope.scope_id ?? null,
        // Non-empty: an empty updated_at means "never saved" to readers.
        updated_at: previous?.updated_at || new Date().toISOString(),
        prefs: { ...EMPTY_VIEW_BAR_PREFS, ...prefs },
      };
      queryClient.setQueryData<IssueViewPreference>(key, optimistic);
      return { previous };
    },
    onError: (_err, { workspaceId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(issueViewPrefKeys.scope(workspaceId, scope), context.previous);
      }
    },
    onSettled: (_data, _err, { workspaceId }) => {
      const key = issueViewPrefKeys.scope(workspaceId, scope);
      // A later write still queued refetches when it settles; refetching now
      // could paint this older document over its optimistic one.
      if (queryClient.isMutating({ mutationKey: key, exact: true }) === 1) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
  return useCallback(
    (prefs: IssueViewPreferenceDoc) =>
      mutate({ prefs, workspaceId: wsId, workspaceSlug: routeSlug ?? getCurrentSlug() ?? undefined, localKey: localPreferenceKey(wsId, scope) }),
    [mutate, wsId, routeSlug, scope],
  );
}

/**
 * Compose the view bar: apply the user's order, drop hidden items, keep the
 * anchor built-in ("builtin:" first item) always visible so nobody locks
 * themselves out of a surface. Unknown ids in prefs (deleted views) are
 * ignored; items absent from `order` append in their natural position.
 */
export function applyViewBarPrefs<T extends { barItemId: string }>(
  items: T[],
  prefs: ViewBarPrefs | undefined,
  anchorId: string,
): { visible: T[]; hiddenSet: Set<string>; ordered: T[] } {
  const order = prefs?.order ?? [];
  const hiddenSet = new Set(prefs?.hidden ?? []);
  hiddenSet.delete(anchorId);

  const byId = new Map(items.map((item) => [item.barItemId, item]));
  const ordered: T[] = [];
  for (const id of order) {
    const item = byId.get(id);
    if (item) {
      ordered.push(item);
      byId.delete(id);
    }
  }
  for (const item of items) {
    if (byId.has(item.barItemId)) ordered.push(item);
  }

  return {
    ordered,
    hiddenSet,
    visible: ordered.filter((item) => !hiddenSet.has(item.barItemId)),
  };
}
