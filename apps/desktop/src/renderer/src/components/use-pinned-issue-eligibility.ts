import { usePinnedIssueCacheSnapshot } from "./pinned-issue-cache-context";

/** Decide from the target route itself, before the committed-path notification arrives. */
export function usePinnedIssueEligibility(wsId: string, issueId: string | null, allow: boolean) {
  const snapshot = usePinnedIssueCacheSnapshot();
  return !!(snapshot?.enabled && allow && snapshot.workspaceId === wsId && issueId && snapshot.pinnedIds.has(issueId));
}
