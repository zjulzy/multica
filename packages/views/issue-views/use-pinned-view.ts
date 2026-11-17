import { api } from "@multica/core/api";
import { useAuthStore } from "@multica/core/auth";
import { pinnedViewScope, usePinnedSidebarViews } from "@multica/core/issue-views/pinned-sidebar-views";

const EMPTY: string[] = [];
export function usePinnedView(wsId: string, id: string) {
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const scope = pinnedViewScope(api.getBaseUrl(), wsId, userId);
  const ids = usePinnedSidebarViews((s) => s.byScope[scope] ?? EMPTY);
  const pin = usePinnedSidebarViews((s) => s.pin);
  const unpin = usePinnedSidebarViews((s) => s.unpin);
  return { pinned: ids.includes(id), toggle: () => ids.includes(id) ? unpin(scope, id) : pin(scope, id) };
}
