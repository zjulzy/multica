type Surface = "main" | "inbox" | "dock";
type Slot = { surface: Surface; issueId: string; instanceKey: string };

/** One cached instance may occupy one location at a time. */
export function planCachedSurfaces(targets: Record<Surface, string | null>): Slot[] {
  const used = new Set<string>();
  const result: Slot[] = [];
  for (const surface of ["main", "inbox", "dock"] as const) {
    const issueId = targets[surface];
    if (!issueId) continue;
    const instanceKey = used.has(issueId) ? `${issueId}::${surface}` : issueId;
    used.add(issueId);
    result.push({ surface, issueId, instanceKey });
  }
  return result;
}
