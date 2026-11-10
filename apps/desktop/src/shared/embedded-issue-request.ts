import { parseIssueWindowRequest, type IssueWindowContext } from "./issue-window";
import { frozenIssueKey } from "./frozen-issue-key";
import { embeddedViewBounds } from "./embedded-view-bounds";
type Bounds = { x: number; y: number; width: number; height: number };
type Authority = { userId: string; workspaceId: string; workspaceSlug: string; issueRefs: readonly string[]; viewport: { width: number; height: number } };
type Valid = { context: IssueWindowContext; key: string; bounds: Bounds };
export function parseEmbeddedIssueRequest(value: unknown, authority: Authority): Valid | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.userId !== authority.userId || input.workspaceId !== authority.workspaceId || typeof input.issueId !== "string" || !authority.issueRefs.includes(input.issueId)) return null;
  const context = parseIssueWindowRequest(input);
  if (!context || context.workspaceSlug !== authority.workspaceSlug || !authority.issueRefs.includes(context.issueId)) return null;
  if (!input.bounds || typeof input.bounds !== "object" || Array.isArray(input.bounds)) return null;
  const rect = input.bounds as Bounds;
  const bounds = embeddedViewBounds(rect, authority.viewport);
  if (!bounds) return null;
  try { return { context, key: frozenIssueKey({ userId: authority.userId, workspaceId: authority.workspaceId, issueId: input.issueId }), bounds }; }
  catch { return null; }
}
