import { parseIssueWindowPath } from "./issue-window";
type CurrentIssue = { workspaceSlug: string; issueRefs: readonly string[] };
type Result = { kind: "current-issue" | "shell"; path: string; replace: boolean };
export function embeddedIssueNavigation(current: CurrentIssue, path: string, mode: "push" | "replace"): Result | null {
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 2048 || /[\u0000-\u001f\\]/.test(path)) return null;
  let url: URL;
  try { url = new URL(path, "https://desktop.multica.invalid"); } catch { return null; }
  if (url.origin !== "https://desktop.multica.invalid") return null;
  const issue = parseIssueWindowPath(path);
  const ownIssue = issue && issue.workspaceSlug === current.workspaceSlug && current.issueRefs.includes(issue.issueId);
  return { kind: ownIssue ? "current-issue" : "shell", path: `${url.pathname}${url.search}${url.hash}`, replace: mode === "replace" };
}
