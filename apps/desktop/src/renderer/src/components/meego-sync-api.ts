export interface MeegoSchedule { mode: "daily" | "interval" | "off"; times: string[]; every: number; label: string; next: string | null; intervals: { every: number; label: string }[] }
export interface MeegoRun { id: string; started: string; mode: string; trigger: string; target: string; args: string; running: boolean; exit: number | null; lines: number; seconds: number | null; counts: { created: number; updated: number; closed: number; failed: number } | null }
export interface MeegoStatus { workspace: string; user: string; running: boolean; schedule: MeegoSchedule; runs: MeegoRun[]; groups: { name: string; team_name: string; projects: Record<string, string> }[]; exclude: string[] }
export interface MeegoActionResult { ok: boolean; message?: string; log?: string; seconds?: number; schedule?: MeegoSchedule }

export function createMeegoSyncApi(baseUrl: string, getToken: () => string | null, getCurrentBaseUrl: () => string = () => baseUrl) {
  const base = new URL(baseUrl);
  if (!["https:", "http:"].includes(base.protocol) || base.username || base.password) throw new Error("invalid_server");
  const root = new URL("/ext/meego-sync/api/", base);
  async function request<T>(endpoint: string, body?: unknown): Promise<T> {
    if (new URL(getCurrentBaseUrl()).origin !== base.origin) throw new Error("server_changed");
    const token = getToken();
    if (!token) throw new Error("not_authenticated");
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (body !== undefined) { headers["Content-Type"] = "application/json"; headers["X-Zp-Request"] = "1"; }
    const response = await fetch(new URL(endpoint, root).toString(), { method: body === undefined ? "GET" : "POST", headers, credentials: "include", redirect: "error", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data === "object" && data && "error" in data && typeof data.error === "string" ? data.error : `HTTP ${response.status}`);
    return data as T;
  }
  const status = async () => {
    const value = await request<MeegoStatus>("status");
    if (!value || typeof value.workspace !== "string" || typeof value.running !== "boolean" || !value.schedule || !Array.isArray(value.schedule.times) || !Array.isArray(value.schedule.intervals) || !Array.isArray(value.runs) || !Array.isArray(value.groups) || !Array.isArray(value.exclude)) throw new Error("invalid_response");
    return value;
  };
  const scopedWrite = async (workspace: string, endpoint: string, body: unknown) => {
    const token = getToken();
    const latest = await status();
    if (!workspace || latest.workspace !== workspace) throw new Error("workspace_mismatch");
    if (!token || token !== getToken()) throw new Error("session_changed");
    return request<MeegoActionResult>(endpoint, body);
  };
  return {
    status,
    log: (id: string) => request<{ log: string }>(`run_log?id=${encodeURIComponent(id)}`),
    syncIds: (workspace: string, ids: string) => scopedWrite(workspace, "sync_ids", { ids }),
    syncAll: (workspace: string) => scopedWrite(workspace, "sync_all", {}),
    saveSchedule: (workspace: string, schedule: { mode: string; times: string[]; every: number }) => scopedWrite(workspace, "schedule", schedule),
  };
}
