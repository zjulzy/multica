export interface FrozenIssueIdentity { userId: string; workspaceId: string; issueId: string }
export function frozenIssueKey({ userId, workspaceId, issueId }: FrozenIssueIdentity): string {
  if (![userId, workspaceId, issueId].every((value) => typeof value === "string" && value.length <= 1024 && value.trim().length > 0)) throw new Error("Incomplete issue identity");
  return JSON.stringify([userId, workspaceId, issueId]);
}
