import { describe, expect, it } from "vitest";
import { combineLiworkSnapshot, resolveLiworkTerminal } from "./liwork-monitor";

const registry = {
  a: { status: "active", issue_id: "i1", identifier: "ZC-1", title: "Issue one", handle: "term_a", pane_key: "tab:leaf", started_at: 1700000000 },
  b: { status: "active", issue_id: "i2", identifier: "ZC-2", title: "Issue two", handle: "term_b", pane_key: "old:pane" },
  c: { status: "ended", issue_id: "i3", identifier: "ZC-3", title: "Old issue" },
};
const terminals = [{ handle: "term_a", tabId: "tab", leafId: "leaf", ptyId: "pty-a", connected: true, lastOutputAt: 1700001000000, agentIdentity: "claude" }];
const memory = { worktrees: [{ worktreeName: "main", sessions: [{ paneKey: "tab:leaf", sessionId: "pty-a", pid: 123, cpu: 2.5, memory: 104857600, privateMemory: 209715200 }] }] };

describe("LiWork bridge monitoring", () => {
  it("matches active sessions to their exact terminal and resource sample", () => {
    const result = combineLiworkSnapshot(registry, terminals, memory);
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0]).toMatchObject({ identifier: "ZC-1", state: "connected", cpu: 2.5, memory: 104857600 });
    expect(result.sessions[0]).toMatchObject({ startedAt: 1700000000000, lastOutputAt: 1700001000000, agent: "claude", worktreeName: "main", privateMemory: 209715200, pid: 123 });
    expect(result.sessions[1]).toMatchObject({ identifier: "ZC-2", state: "unconfirmed", cpu: null, memory: null });
  });

  it("never assigns another terminal's metrics when a pane is reused", () => {
    const result = combineLiworkSnapshot(registry, [{ ...terminals[0], ptyId: "different" }], memory);
    expect(result.sessions[0]).toMatchObject({ state: "connected", cpu: null, memory: null });
  });

  it("distinguishes unavailable diagnostics from measured zero", () => {
    const result = combineLiworkSnapshot(registry, null, null);
    expect(result.sessions[0]).toMatchObject({ state: "unconfirmed", cpu: null, memory: null });
    expect(result.terminalsAvailable).toBe(false);
    expect(result.metricsAvailable).toBe(false);
  });

  it("reports a truncated terminal list as incomplete while retaining verified samples", () => {
    const result = combineLiworkSnapshot(registry, terminals, memory, false);
    expect(result.terminalsAvailable).toBe(false);
    expect(result.sessions[0]).toMatchObject({ state: "connected", memory: 104857600 });
  });

  it("opens only the still-connected terminal belonging to the requested bridge session", () => {
    expect(resolveLiworkTerminal(registry, terminals, "a")).toBe("term_a");
    expect(resolveLiworkTerminal(registry, [{ ...terminals[0], leafId: "reused" }], "a")).toBeNull();
    expect(resolveLiworkTerminal(registry, terminals, "b")).toBeNull();
    expect(resolveLiworkTerminal(registry, terminals, "c")).toBeNull();
  });
});
