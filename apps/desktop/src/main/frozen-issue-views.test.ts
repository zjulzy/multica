import { describe, expect, it, vi } from "vitest";
import { FrozenIssueViews, type FrozenIssueView } from "./frozen-issue-views";

function createView(): FrozenIssueView & { events: string[] } {
  const events: string[] = [];
  return {
    events,
    setVisible: (visible) => { events.push(`visible:${visible}`); },
    setBounds: (bounds) => { events.push(`bounds:${bounds.width}x${bounds.height}`); },
    freeze: vi.fn(async () => { events.push("freeze"); }),
    resume: vi.fn(async () => { events.push("resume"); }),
    send: (channel) => { events.push(`message:${channel}`); },
    destroy: () => { events.push("destroy"); },
  };
}
const bounds = { x: 200, y: 40, width: 600, height: 400 };

describe("independent frozen issue views", () => {
  it("keeps one visible page and pauses the previous page before switching", async () => {
    const views = new Map<string, ReturnType<typeof createView>>();
    const manager = new FrozenIssueViews((id) => { const view = createView(); views.set(id, view); return view; });
    await manager.show("a", bounds);
    await manager.show("b", bounds);
    expect(views.get("a")!.events).toEqual(["bounds:600x400", "visible:true", "visible:false", "freeze"]);
    expect(views.get("b")!.events).toEqual(["bounds:600x400", "visible:true"]);
    await manager.show("a", bounds);
    expect(views.get("b")!.events.slice(-2)).toEqual(["visible:false", "freeze"]);
    expect(views.get("a")!.events.slice(-3)).toEqual(["resume", "bounds:600x400", "visible:true"]);
    expect(views.size).toBe(2);
    await manager.dispose();
  });
  it("does not deliver page messages while the page is hidden", async () => {
    const views = new Map<string, ReturnType<typeof createView>>();
    const manager = new FrozenIssueViews((id) => { const view = createView(); views.set(id, view); return view; });
    await manager.show("a", bounds);
    await manager.show("b", bounds);
    expect(manager.sendIfVisible("a", "navigate", "old")).toBe(false);
    expect(manager.sendIfVisible("b", "navigate", "current")).toBe(true);
    expect(views.get("a")!.events).not.toContain("message:navigate");
    expect(views.get("b")!.events).toContain("message:navigate");
    await manager.dispose();
  });
  it("resizes only the currently displayed view without restarting it", async () => {
    const views = new Map<string, ReturnType<typeof createView>>();
    const manager = new FrozenIssueViews((id) => { const view = createView(); views.set(id, view); return view; });
    await manager.show("a", bounds); await manager.show("b", bounds);
    expect(manager.resize("a", { ...bounds, height: 100 })).toBe(false);
    expect(manager.resize("b", { ...bounds, height: 100 })).toBe(true);
    expect(views.get("a")!.events).not.toContain("bounds:600x100");
    expect(views.get("b")!.events.at(-1)).toBe("bounds:600x100");
    expect(views.get("b")!.resume).not.toHaveBeenCalled();
    await manager.dispose();
  });
  it("hides the current issue when the shell navigates elsewhere", async () => {
    const view = createView();
    const manager = new FrozenIssueViews(() => view);
    await manager.show("a", bounds);
    await manager.hide();
    expect(view.events.slice(-2)).toEqual(["visible:false", "freeze"]);
    expect(manager.isVisible("a")).toBe(false);
    await manager.show("a", bounds);
    expect(view.events.slice(-3)).toEqual(["resume", "bounds:600x400", "visible:true"]);
    await manager.dispose();
  });
  it("releases an unpinned page and creates a fresh one when reopened", async () => {
    const create = vi.fn(() => createView());
    const manager = new FrozenIssueViews(create);
    await manager.show("a", bounds);
    await manager.remove("a");
    expect(create.mock.results[0]!.value.events).toContain("destroy");
    await manager.show("a", bounds);
    expect(create).toHaveBeenCalledTimes(2);
    await manager.dispose();
  });
  it("removes only pages absent from the latest pin set", async () => {
    const views = new Map<string, ReturnType<typeof createView>>();
    const manager = new FrozenIssueViews((id) => { const view = createView(); views.set(id, view); return view; });
    await manager.show("a", bounds); await manager.show("b", bounds);
    await manager.retain(new Set(["b"]));
    expect(views.get("a")!.events).toContain("destroy");
    expect(views.get("b")!.events).not.toContain("destroy");
    await manager.dispose();
  });
  it("never reveals an intermediate page when navigation changes during freeze", async () => {
    const views = new Map<string, ReturnType<typeof createView>>();
    let finishFreeze!: () => void;
    const manager = new FrozenIssueViews((id) => {
      const view = createView();
      if (id === "a") view.freeze = () => new Promise((resolve) => { finishFreeze = resolve; });
      views.set(id, view); return view;
    });
    await manager.show("a", bounds);
    const toB = manager.show("b", bounds);
    await Promise.resolve();
    const toC = manager.show("c", bounds);
    finishFreeze();
    await Promise.all([toB, toC]);
    expect(views.has("b")).toBe(false);
    expect(views.get("c")!.events).toContain("visible:true");
    expect(manager.sendIfVisible("a", "navigate", "stale")).toBe(false);
    await manager.dispose();
  });
  it("blocks old page messages as soon as a switch is requested", async () => {
    const views = new Map<string, ReturnType<typeof createView>>();
    const manager = new FrozenIssueViews((id) => { const view = createView(); views.set(id, view); return view; });
    await manager.show("a", bounds);
    expect(manager.isVisible("a")).toBe(true);
    const pending = manager.show("b", bounds);
    expect(manager.isVisible("a")).toBe(false);
    expect(manager.sendIfVisible("a", "navigate", "stale")).toBe(false);
    await pending;
    expect(manager.isVisible("b")).toBe(true);
    expect(views.get("a")!.events).not.toContain("message:navigate");
    await manager.dispose();
  });
  it("destroys a view if freezing fails instead of leaving hidden background work running", async () => {
    const views = new Map<string, ReturnType<typeof createView>>();
    const manager = new FrozenIssueViews((id) => {
      const view = createView();
      if (id === "a") view.freeze = async () => { throw new Error("freeze failed"); };
      views.set(id, view); return view;
    });
    await manager.show("a", bounds);
    await expect(manager.show("b", bounds)).rejects.toThrow("freeze failed");
    expect(views.get("a")!.events).toContain("destroy");
    expect(manager.sendIfVisible("a", "navigate", "stale")).toBe(false);
    await manager.show("b", bounds);
    expect(views.get("b")!.events).toContain("visible:true");
    await manager.dispose();
  });
  it("does not reveal a page whose asynchronous creation finished after a newer request", async () => {
    let finishCreate!: (view: FrozenIssueView) => void;
    const late = createView(), newest = createView();
    const manager = new FrozenIssueViews((id) => id === "a" ? new Promise((resolve) => { finishCreate = resolve; }) : newest);
    const toA = manager.show("a", bounds);
    await Promise.resolve();
    const toB = manager.show("b", bounds);
    finishCreate(late);
    await Promise.all([toA, toB]);
    expect(late.events).not.toContain("visible:true");
    expect(late.events).toContain("destroy");
    expect(newest.events).toContain("visible:true");
    await manager.dispose();
  });
  it("destroys an obsolete page if it cannot be frozen after a delayed resume", async () => {
    const a = createView(), b = createView(), c = createView();
    let finishResume!: () => void;
    const manager = new FrozenIssueViews((id) => ({ a, b, c })[id]!);
    await manager.show("a", bounds); await manager.show("b", bounds);
    a.resume = () => new Promise((resolve) => { finishResume = resolve; });
    a.freeze = async () => { throw new Error("refreeze failed"); };
    const toA = manager.show("a", bounds);
    await Promise.resolve(); await Promise.resolve();
    const toC = manager.show("c", bounds);
    finishResume();
    await expect(toA).rejects.toThrow("refreeze failed");
    await toC;
    expect(a.events).toContain("destroy");
    expect(c.events).toContain("visible:true");
    await manager.dispose();
  });
});
