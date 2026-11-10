import type { QueryClient } from "@tanstack/react-query";
import { issueKeys } from "@multica/core/issues/queries";

/** Revalidate the small child list after a cached page is shown again. */
export function createEmbeddedChildRefresh(client: QueryClient, workspaceId: string, issueId: string) {
  let shown = false;
  return async () => {
    if (!shown) { shown = true; return; }
    await client.invalidateQueries({ queryKey: issueKeys.children(workspaceId, issueId), exact: true, refetchType: "active" });
  };
}
