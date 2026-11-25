/** Collect only explicitly identified issue numbers, not incidental build numbers. */
export function issueIdentifiers(identifier: string, title: string, description: string): string[] {
  const result = new Set<string>();
  if (/^[a-z][a-z0-9]*-\d+$/i.test(identifier)) result.add(identifier.toUpperCase());
  for (const text of [title, description]) {
    for (const match of text.matchAll(/(?:\[(?:BUG|STORY)-(\d+)\]|\bExternal-Id:\s*(?:BUG|STORY)-(\d+)\b)/gi)) {
      result.add(match[1] ?? match[2]!);
    }
  }
  return [...result];
}

export function matchesIssueDescription(description: string, identifiers: readonly string[]): boolean {
  return identifiers.some((id) => {
    if (!/^(?:[A-Z][A-Z0-9]*-)?\d+$/i.test(id)) return false;
    return new RegExp(`(?:^|[^A-Za-z0-9])${id}(?![A-Za-z0-9])`, "i").test(description);
  });
}
