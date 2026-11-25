export type P4DiffLine =
  | { kind: "hunk"; text: string }
  | { kind: "message"; text: string }
  | { kind: "add" | "remove" | "context"; text: string; oldLine: number | null; newLine: number | null };

export function parseP4Diff(diff: string): P4DiffLine[] {
  const source = diff.replace(/\r\n/g, "\n").split("\n");
  if (source.at(-1) === "") source.pop();
  const lines: P4DiffLine[] = [];
  let oldLine = 1, newLine = 1, started = false, headers = 0;
  for (const text of source) {
    const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (header) { oldLine = Number(header[1]); newLine = Number(header[2]); started = true; lines.push({ kind: "hunk", text }); continue; }
    if (!started && headers === 0 && text.startsWith("--- ")) { headers = 1; continue; }
    if (!started && headers === 1 && text.startsWith("+++ ")) { headers = 2; continue; }
    const prefix = text[0];
    if (prefix === "+") { started = true; lines.push({ kind: "add", oldLine: null, newLine: newLine++, text: text.slice(1) }); }
    else if (prefix === "-") { started = true; lines.push({ kind: "remove", oldLine: oldLine++, newLine: null, text: text.slice(1) }); }
    else if (prefix === " ") { started = true; lines.push({ kind: "context", oldLine: oldLine++, newLine: newLine++, text: text.slice(1) }); }
    else lines.push({ kind: "message", text });
  }
  return lines;
}
