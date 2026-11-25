import type { QueryClient } from "@tanstack/react-query";
import { issueKeys } from "@multica/core/issues/queries";
import { quickActionKeys } from "@multica/core/quick-actions";

/** Revalidate lightweight sidebar data after a cached page is shown again. */
export function createEmbeddedChildRefresh(client: QueryClient, workspaceId: string, issueId: string) {
  let shown = false;
  return async () => {
    if (!shown) { shown = true; return; }
    await Promise.all([
      client.invalidateQueries({ queryKey: issueKeys.children(workspaceId, issueId), exact: true, refetchType: "active" }),
      client.invalidateQueries({ queryKey: quickActionKeys.all(workspaceId), refetchType: "active" }),
    ]);
  };
}
