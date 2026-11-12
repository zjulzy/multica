import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

const ipc = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => any>(), listeners: new Map<string, (...args: any[]) => any>(), owner: null as any, openExternal: vi.fn() }));
vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: () => ipc.owner },
  ipcMain: { handle: (name: string, fn: (...args: any[]) => any) => ipc.handlers.set(name, fn), on: (name: string, fn: (...args: any[]) => any) => ipc.listeners.set(name, fn) },
  shell: { openExternal: ipc.openExternal },
}));
import { clearEmbeddedWebviews, installEmbeddedWebviewHost, setupEmbeddedWebviewExperiment } from "./embedded-webview-experiment";

describe("embedded issue warm pool", () => {
  it("allows only the packaged renderer file for a guest", () => {
    const contents = Object.assign(new EventEmitter(), { send: vi.fn() });
    const owner = Object.assign(new EventEmitter(), { webContents: contents, isDestroyed: () => false });
    const guest = Object.assign(new EventEmitter(), { send: vi.fn(), isDestroyed: () => false, close: vi.fn(), setWindowOpenHandler: vi.fn(), debugger: { isAttached: () => false } });
    ipc.owner = owner;
    setupEmbeddedWebviewExperiment({ isMain: () => true, userId: () => "user", workspaceSlug: () => "team", locale: () => "en", rendererUrl: "file:///C:/app/renderer/index.html" });
    installEmbeddedWebviewHost(owner as never);
    const pool = ipc.handlers.get("embedded-pool:prepare")!({ sender: contents }, { userId: "user", workspaceId: "ws", workspaceSlug: "team" });
    const attach = { preventDefault: vi.fn() };
    contents.emit("will-attach-webview", attach, {}, { src: pool.url });
    expect(attach.preventDefault).not.toHaveBeenCalled();
    contents.emit("did-attach-webview", {}, guest);
    const windowOpen = guest.setWindowOpenHandler.mock.calls[0][0];
    ipc.openExternal.mockClear();
    expect(windowOpen({ url: "https://project.feishu.cn/example" })).toEqual({ action: "deny" });
    expect(ipc.openExternal).toHaveBeenCalledWith("https://project.feishu.cn/example");
    ipc.openExternal.mockClear();
    expect(windowOpen({ url: "file:///C:/secret" })).toEqual({ action: "deny" });
    expect(ipc.openExternal).not.toHaveBeenCalled();
    const navigation = { preventDefault: vi.fn() };
    guest.emit("will-navigate", navigation, "file:///C:/elsewhere/other.html");
    expect(navigation.preventDefault).toHaveBeenCalled();
    clearEmbeddedWebviews(owner as never);
  });
  it("assigns a ready container only once and only to its original workspace", () => {
    const contents = Object.assign(new EventEmitter(), { send: vi.fn() });
    const owner = Object.assign(new EventEmitter(), { webContents: contents, isDestroyed: () => false });
    const guest = Object.assign(new EventEmitter(), { send: vi.fn(), isDestroyed: () => false, close: vi.fn(), setWindowOpenHandler: vi.fn(), debugger: { isAttached: () => false } });
    ipc.owner = owner;
    setupEmbeddedWebviewExperiment({ isMain: () => true, userId: () => "user", workspaceSlug: () => "team", locale: () => "en", rendererUrl: "http://localhost:5173/" });
    installEmbeddedWebviewHost(owner as never);
    const event = { sender: contents };
    const pool = ipc.handlers.get("embedded-pool:prepare")!(event, { userId: "user", workspaceId: "ws", workspaceSlug: "team" });
    expect(pool).toBeTruthy();
    const attach = { preventDefault: vi.fn() };
    contents.emit("will-attach-webview", attach, {}, { src: pool.url });
    expect(attach.preventDefault).not.toHaveBeenCalled();
    contents.emit("did-attach-webview", {}, guest);
    const request = { userId: "user", workspaceId: "ws", issueId: "issue-1", path: "/team/issues/issue-1", title: "Issue" };
    expect(ipc.handlers.get("embedded-pool:assign")!(event, pool.token, request)).toBe(false);
    ipc.listeners.get("embedded-pool:ready")!({ sender: guest });
    expect(ipc.handlers.get("embedded-pool:assign")!(event, pool.token, { ...request, workspaceId: "other" })).toBe(false);
    expect(ipc.handlers.get("embedded-pool:assign")!(event, pool.token, request)).toBe(true);
    expect(guest.send).toHaveBeenCalledWith("embedded-pool:assigned", expect.objectContaining({ issueId: "issue-1" }));
    expect(ipc.handlers.get("embedded-pool:assign")!(event, pool.token, request)).toBe(false);
    clearEmbeddedWebviews(owner as never);
  });
});
