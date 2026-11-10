import { splitTabUrl } from "@/stores/tab-store";

export function parsePinnedIssueRoute(url: string | null): { slug: string; issue: string } | null {
  if (!url) return null;
  const match = /^\/([^/]+)\/issues\/([^/]+)\/?$/.exec(splitTabUrl(url).pathname);
  if (!match) return null;
  try { return { slug: decodeURIComponent(match[1]), issue: decodeURIComponent(match[2]) }; }
  catch { return null; }
}

/** Start the guest with its known canonical ID so timeline loading can begin
 * while the issue record itself is being fetched. */
export function embeddedCanonicalIssuePath(path: string, slug: string, issueId: string): string {
  const url = new URL(path, "https://desktop.multica.invalid");
  return `/${encodeURIComponent(slug)}/issues/${encodeURIComponent(issueId)}${url.search}${url.hash}`;
}
