import { execFile } from "node:child_process";
import { hostname } from "node:os";
import { promisify } from "node:util";
import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative } from "node:path";
import { matchesIssueDescription } from "../shared/p4-issue-match";

type RecordRow = Record<string, string>;
const exec = promisify(execFile);

export function parseTaggedRecords(text: string, firstKey: string): RecordRow[] {
  const rows: RecordRow[] = [];
  let current: RecordRow | undefined;
  let last = "";
  for (const line of text.split(/\r?\n/)) {
    const tagged = /^\.\.\. (\S+) ?(.*)$/.exec(line);
    if (tagged) {
      const [, key, value] = tagged;
      if (key === firstKey) { current = {}; rows.push(current); }
      if (current && key) { current[key] = value ?? ""; last = key; }
    } else if (current && last && line) current[last] += `\n${line}`;
  }
  return rows;
}

export function filterLocalChanges(clients: RecordRow[], changes: RecordRow[], host: string, user: string, ids: string[]): RecordRow[] {
  const local = new Set(clients.filter((row) => row.Root && (row.Host?.toLowerCase() === host.toLowerCase() || (!row.Host && row.localRoot === "true"))).map((row) => row.client));
  return changes.filter((row) => local.has(row.client) && row.user?.toLowerCase() === user.toLowerCase() && matchesIssueDescription(row.desc ?? "", ids));
}

async function p4(args: string[]): Promise<string> {
  const { stdout } = await exec("p4", args, { timeout: 20000, maxBuffer: 16 * 1024 * 1024, windowsHide: true, encoding: "utf8" });
  return stdout;
}

export async function listIssueChanges(ids: string[]): Promise<RecordRow[]> {
  if (!Array.isArray(ids) || ids.length > 16 || ids.some((id) => typeof id !== "string" || !/^(?:[a-z][a-z0-9]*-)?\d{1,20}$/i.test(id))) throw new Error("Invalid issue identifiers");
  if (!ids.length) return [];
  const info = parseTaggedRecords(await p4(["-ztag", "info"]), "userName")[0];
  const user = info?.userName;
  if (!user || user === "*unknown*") throw new Error("P4 user is not configured");
  const [clientText, changesText] = await Promise.all([
    p4(["-ztag", "clients", "-u", user]),
    p4(["-ztag", "changes", "-s", "pending", "-u", user, "-l"]),
  ]);
  const clients = parseTaggedRecords(clientText, "client");
  await Promise.all(clients.filter((row) => !row.Host && row.Root).map(async (row) => {
    try { if ((await stat(row.Root)).isDirectory()) row.localRoot = "true"; } catch { /* Root is not available locally. */ }
  }));
  return filterLocalChanges(clients, parseTaggedRecords(changesText, "change"), hostname(), user, ids);
}

/** Resolve a changelist through the same local-user and host checks used for listing. */
async function verifiedChange(ids: string[], client: string, change: string): Promise<void> {
  if (!/^[A-Za-z0-9_.-]{1,200}$/.test(client) || !/^\d{1,12}$/.test(change)) throw new Error("Invalid P4 changelist");
  const matches = await listIssueChanges(ids);
  if (!matches.some((row) => row.client === client && row.change === change)) throw new Error("Changelist no longer belongs to this issue or local workspace");
}

export async function listChangeFiles(ids: string[], client: string, change: string): Promise<RecordRow[]> {
  await verifiedChange(ids, client, change);
  return parseTaggedRecords(await p4(["-c", client, "-ztag", "opened", "-c", change]), "depotFile")
    .filter((row) => row.client === client && row.change === change && !!row.depotFile);
}

async function verifiedFile(ids: string[], client: string, change: string, file: string): Promise<RecordRow> {
  if (typeof file !== "string" || file.length > 4096 || !file.startsWith("//") || /[\r\n\0*#@]/.test(file) || file.includes("...")) throw new Error("Invalid P4 file");
  const row = (await listChangeFiles(ids, client, change)).find((entry) => entry.depotFile === file);
  if (!row) throw new Error("File no longer belongs to this changelist");
  return row;
}

export async function diffChangeFile(ids: string[], client: string, change: string, file: string, fullContext = false): Promise<string> {
  const row = await verifiedFile(ids, client, change, file);
  if (/^(binary|apple|resource|ubinary)/i.test(row.type ?? "")) return "二进制文件不支持文本 Diff。";
  if (row.action === "add" || row.action === "move/add") {
    const clientSpec = parseTaggedRecords(await p4(["-c", client, "-ztag", "client", "-o", client]), "Client")[0];
    const location = parseTaggedRecords(await p4(["-c", client, "-ztag", "where", file]), "depotFile")[0];
    if (!clientSpec?.Root || !location?.path) throw new Error("Unable to locate local file");
    const [root, path] = await Promise.all([realpath(clientSpec.Root), realpath(location.path)]);
    const within = relative(root, path);
    if (!within || within.startsWith("..") || isAbsolute(within)) throw new Error("File is outside the workspace root");
    if ((await stat(path)).size > 4 * 1024 * 1024) throw new Error("File exceeds the 4 MB diff limit");
    const contents = await readFile(path, "utf8");
    if (contents.includes("\0")) throw new Error("Binary or unsupported text encoding");
    return `--- /dev/null\n+++ ${file}\n${contents.split(/\r?\n/).map((line) => `+${line}`).join("\n")}`;
  }
  if (row.action === "delete" || row.action === "move/delete") {
    if (!/^\d+$/.test(row.haveRev ?? "")) throw new Error("Missing base revision");
    const contents = await p4(["-c", client, "print", "-q", `${file}#${row.haveRev}`]);
    if (contents.includes("\0")) throw new Error("Binary or unsupported text encoding");
    return `--- ${file}\n+++ /dev/null\n${contents.split(/\r?\n/).map((line) => `-${line}`).join("\n")}`;
  }
  return p4(["-c", client, "diff", fullContext === true ? "-du1000000" : "-du", file]);
}

export async function revertChangeFile(ids: string[], client: string, change: string, file: string): Promise<void> {
  const row = await verifiedFile(ids, client, change, file);
  if (row.action?.startsWith("move/")) throw new Error("Moved files must be reverted as a pair; single-file revert is unavailable");
  await p4(["-c", client, "revert", "-c", change, file]);
}
