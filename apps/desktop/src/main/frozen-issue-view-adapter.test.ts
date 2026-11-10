import { describe, expect, it, vi } from "vitest";
import { createFrozenIssueView, type NativeIssueView } from "./frozen-issue-view-adapter";

function nativeView() {
  const debuggerApi = { attach: vi.fn(), detach: vi.fn(), isAttached: vi.fn(() => true), sendCommand: vi.fn(async () => ({})) };
  const contents = { debugger: debuggerApi, isDestroyed: vi.fn(() => false), close: vi.fn(), send: vi.fn() };
  const view = { setVisible: vi.fn(), setBounds: vi.fn(), webContents: contents } satisfies NativeIssueView;
  return { view, debuggerApi, contents };
}

describe("native frozen issue view adapter", () => {
  it("initializes hidden, freezes/resumes and detaches on destruction", async () => {
    const { view, debuggerApi, contents } = nativeView();
    const add = vi.fn(), remove = vi.fn(), load = vi.fn(async () => {});
    const adapter = await createFrozenIssueView({ view, add, remove, load });
    expect(view.setVisible).toHaveBeenCalledWith(false);
    expect(add).toHaveBeenCalledWith(view);
    expect(debuggerApi.sendCommand).toHaveBeenCalledWith("Page.enable");
    await adapter.freeze(); await adapter.resume();
    expect(debuggerApi.sendCommand).toHaveBeenCalledWith("Page.setWebLifecycleState", { state: "frozen" });
    expect(debuggerApi.sendCommand).toHaveBeenCalledWith("Page.setWebLifecycleState", { state: "active" });
    adapter.send("test", { value: 1 });
    expect(contents.send).toHaveBeenCalledWith("test", { value: 1 });
    adapter.destroy(); adapter.destroy();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(debuggerApi.detach).toHaveBeenCalledTimes(1);
    expect(contents.close).toHaveBeenCalledTimes(1);
  });
  it("removes and closes the view if page loading fails", async () => {
    const { view, contents } = nativeView();
    const add = vi.fn(), remove = vi.fn();
    await expect(createFrozenIssueView({ view, add, remove, load: async () => { throw new Error("load failed"); } })).rejects.toThrow("load failed");
    expect(remove).toHaveBeenCalledWith(view);
    expect(contents.close).toHaveBeenCalledTimes(1);
  });
  it("closes the view if the debugger cannot attach", async () => {
    const { view, contents, debuggerApi } = nativeView();
    const add = vi.fn(), remove = vi.fn();
    debuggerApi.attach.mockImplementation(() => { throw new Error("already attached"); });
    await expect(createFrozenIssueView({ view, add, remove, load: async () => {} })).rejects.toThrow("already attached");
    expect(remove).toHaveBeenCalledWith(view);
    expect(contents.close).toHaveBeenCalledTimes(1);
    expect(debuggerApi.detach).not.toHaveBeenCalled();
  });
  it("refuses to freeze if the debugger was detached", async () => {
    const { view, debuggerApi } = nativeView();
    const adapter = await createFrozenIssueView({ view, add: vi.fn(), remove: vi.fn(), load: async () => {} });
    debuggerApi.isAttached.mockReturnValue(false);
    await expect(adapter.freeze()).rejects.toThrow("unavailable");
    adapter.destroy();
  });
});
