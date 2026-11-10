import type { FrozenIssueView, ViewBounds } from "./frozen-issue-views";
export interface NativeIssueView {
  setVisible(visible: boolean): void;
  setBounds(bounds: ViewBounds): void;
  webContents: {
    debugger: { attach(version: string): void; detach(): void; isAttached(): boolean; sendCommand(method: string, params?: Record<string, unknown>): Promise<unknown> };
    isDestroyed(): boolean;
    close(): void;
    send(channel: string, payload: unknown): void;
  };
}
export async function createFrozenIssueView({ view, add, remove, load }: { view: NativeIssueView; add: (view: NativeIssueView) => void; remove: (view: NativeIssueView) => void; load: () => Promise<void> }): Promise<FrozenIssueView> {
  const contents = view.webContents;
  let destroyed = false;
  let added = false;
  let attached = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    if (added) remove(view);
    if (!contents.isDestroyed()) {
      if (attached && contents.debugger.isAttached()) contents.debugger.detach();
      contents.close();
    }
  };
  try {
    view.setVisible(false);
    add(view); added = true;
    await load();
    contents.debugger.attach("1.3"); attached = true;
    await contents.debugger.sendCommand("Page.enable");
  } catch (error) { destroy(); throw error; }
  const state = async (value: "frozen" | "active") => {
    if (destroyed || contents.isDestroyed() || !contents.debugger.isAttached()) throw new Error("Issue view is unavailable");
    await contents.debugger.sendCommand("Page.setWebLifecycleState", { state: value });
  };
  return {
    setVisible: (visible) => view.setVisible(visible),
    setBounds: (bounds) => view.setBounds(bounds),
    freeze: () => state("frozen"),
    resume: () => state("active"),
    send: (channel, payload) => contents.send(channel, payload),
    destroy,
  };
}
