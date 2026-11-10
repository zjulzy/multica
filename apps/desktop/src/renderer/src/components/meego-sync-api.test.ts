import { afterEach, describe, expect, it, vi } from "vitest";
import { createMeegoSyncApi } from "./meego-sync-api";

afterEach(() => vi.unstubAllGlobals());
describe("Meego sync API", () => {
  const status = { workspace: "zgame", running: false, schedule: { times: [], intervals: [] }, runs: [], groups: [], exclude: [] };
  it("uses the configured server and current credential for status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(status), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = createMeegoSyncApi("https://server.example", () => "session-token");
    await api.status();
    expect(fetchMock).toHaveBeenCalledWith("https://server.example/ext/meego-sync/api/status", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer session-token" }) }));
  });
  it("checks the workspace before sending a write and never runs it when the scope changed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...status, workspace: "other" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = createMeegoSyncApi("https://server.example", () => "token");
    await expect(api.syncAll("zgame")).rejects.toThrow("workspace_mismatch");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("sends a manual request only when explicitly called", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(status), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = createMeegoSyncApi("https://server.example", () => "token");
    await api.syncIds("zgame", "123 456");
    expect(fetchMock).toHaveBeenLastCalledWith("https://server.example/ext/meego-sync/api/sync_ids", expect.objectContaining({ method: "POST", body: JSON.stringify({ ids: "123 456" }), headers: expect.objectContaining({ "X-Zp-Request": "1" }) }));
  });
  it("does not send credentials after the configured server changes", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const api = createMeegoSyncApi("https://old.example", () => "token", () => "https://new.example");
    await expect(api.status()).rejects.toThrow("server_changed");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not issue a write when the signed-in account changes during validation", async () => {
    let token = "first";
    const fetchMock = vi.fn().mockImplementation(async () => { token = "second"; return new Response(JSON.stringify(status), { status: 200 }); });
    vi.stubGlobal("fetch", fetchMock);
    const api = createMeegoSyncApi("https://server.example", () => token);
    await expect(api.syncAll("zgame")).rejects.toThrow("session_changed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
