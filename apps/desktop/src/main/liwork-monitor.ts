import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { LiworkSession, LiworkSnapshot } from "../shared/liwork-monitor";

const exec = promisify(execFile);
type Obj = Record<string, unknown>;
const object = (value: unknown): Obj => value && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
const str = (value: unknown): string => typeof value === "string" ? value : "";
const metric = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const timestamp = (value: unknown): number | null => {
  const n = metric(value);
  if (!n) return null;
  return n < 100_000_000_000 ? n * 1000 : n;
};
const ACTIVE_STATUSES = ["active", "starting", "stalled"];

function findTerminal(record: Obj, terminalRows: Obj[] | null): Obj | undefined {
  const pane = str(record.pane_key);
  return terminalRows?.find((row) => str(row.handle) === str(record.handle) && !!pane && `${str(row.tabId)}:${str(row.leafId)}` === pane && row.connected === true);
}

/** Resolve a requested bridge session against a freshly retrieved terminal list. */
export function resolveLiworkTerminal(registry: unknown, terminals: unknown, sessionId: string): string | null {
  const record = object(object(registry)[sessionId]);
  if (!ACTIVE_STATUSES.includes(str(record.status)) || !Array.isArray(terminals)) return null;
  const terminal = findTerminal(record, terminals.map(object));
  const handle = str(terminal?.handle);
  return /^term_[a-z0-9_-]{1,120}$/i.test(handle) ? handle : null;
}

/** Only associate usage when handle, pane and process session all agree. */
export function combineLiworkSnapshot(registry: unknown, terminals: unknown, memory: unknown, terminalsComplete = true): LiworkSnapshot {
  const terminalRows = Array.isArray(terminals) ? terminals.map(object) : null;
  const worktrees = object(memory).worktrees;
  const metricsAvailable = Array.isArray(worktrees);
  const metrics = new Map<string, { usage: Obj; worktreeName: string | null }>();
  if (Array.isArray(worktrees)) for (const tree of worktrees) {
    const sessions = object(tree).sessions;
    if (Array.isArray(sessions)) for (const session of sessions) {
      const row = object(session);
      if (str(row.paneKey)) metrics.set(str(row.paneKey), { usage: row, worktreeName: str(object(tree).worktreeName) || null });
    }
  }
  const sessions: LiworkSession[] = [];
  for (const [sessionId, raw] of Object.entries(object(registry))) {
    const record = object(raw);
    if (!ACTIVE_STATUSES.includes(str(record.status))) continue;
    const issueId = str(record.issue_id);
    if (!issueId) continue;
    const pane = str(record.pane_key);
    const terminal = findTerminal(record, terminalRows);
    const sample = terminal ? metrics.get(pane) : undefined;
    const usage = sample?.usage;
    const verified = usage && str(terminal?.ptyId) && str(terminal?.ptyId) === str(usage.sessionId) ? usage : undefined;
    sessions.push({ sessionId, issueId, identifier: str(record.identifier), title: str(record.title), state: terminal ? "connected" : "unconfirmed", cpu: metric(verified?.cpu), memory: metric(verified?.memory), privateMemory: metric(verified?.privateMemory), pid: metric(verified?.pid), startedAt: timestamp(record.started_at), lastOutputAt: timestamp(terminal?.lastOutputAt), agent: str(terminal?.agentIdentity) || null, worktreeName: verified ? sample?.worktreeName ?? null : null, bridgeStatus: str(record.status) });
  }
  return { sessions, terminalsAvailable: !!terminalRows && terminalsComplete, metricsAvailable, sampledAt: Date.now() };
}

async function queryCli(executable: string, args: string[], userData: string): Promise<unknown> {
  const { stdout } = await exec(executable, args, { windowsHide: true, timeout: 15000, maxBuffer: 12 * 1024 * 1024, encoding: "utf8", env: { ...process.env, ORCA_USER_DATA_PATH: userData } });
  const response = object(JSON.parse(stdout));
  if (response.ok !== true) throw new Error("LiWork runtime unavailable");
  return response.result;
}

let pending: Promise<LiworkSnapshot> | null = null;
let cached: LiworkSnapshot | null = null;

function localPaths() {
  return {
    registry: join(homedir(), ".liwork-bridge", "sessions.json"),
    executable: join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "Programs", "liwork", "resources", "bin", "liwork.exe"),
    userData: join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "liwork"),
  };
}

/** The user's click switches only to a freshly verified bridge terminal. */
export async function switchLiworkSession(sessionId: string): Promise<void> {
  if (process.platform !== "win32" || !/^[a-z0-9._:-]{1,128}$/i.test(sessionId)) throw new Error("Invalid LiWork session");
  const paths = localPaths();
  const [raw, terminalResult] = await Promise.all([
    readFile(paths.registry, "utf8"),
    queryCli(paths.executable, ["terminal", "list", "--limit", "1000", "--json"], paths.userData),
  ]);
  const handle = resolveLiworkTerminal(JSON.parse(raw), object(terminalResult).terminals, sessionId);
  if (!handle) throw new Error("LiWork session is no longer available");
  await queryCli(paths.executable, ["terminal", "switch", "--terminal", handle, "--json"], paths.userData);
}

/** Fixed read-only commands, bounded execution and a shared cache across windows. */
export function getLiworkSnapshot(): Promise<LiworkSnapshot> {
  if (cached && Date.now() - cached.sampledAt < 10000) return Promise.resolve(cached);
  if (pending) return pending;
  pending = (async () => {
    if (process.platform !== "win32") throw new Error("LiWork monitoring is available on Windows only");
    const { registry: registryPath, executable, userData } = localPaths();
    const registry = JSON.parse(await readFile(registryPath, "utf8")) as unknown;
    const [terminalResult, memoryResult] = await Promise.allSettled([
      queryCli(executable, ["terminal", "list", "--limit", "1000", "--json"], userData),
      queryCli(executable, ["diagnostics", "memory", "--json"], userData),
    ]);
    const terminalData = terminalResult.status === "fulfilled" ? object(terminalResult.value) : {};
    const terminals = terminalData.terminals ?? null;
    const memory = memoryResult.status === "fulfilled" ? memoryResult.value : null;
    cached = combineLiworkSnapshot(registry, terminals, memory, terminalData.truncated !== true);
    return cached;
  })().finally(() => { pending = null; });
  return pending;
}
