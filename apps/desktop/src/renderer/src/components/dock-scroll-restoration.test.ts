import { describe, expect, it } from "vitest";
import { createDockScrollRestoration } from "./dock-scroll-restoration";

describe("dock scroll restoration", () => {
  it("captures independent list and issue positions and keeps highlight state", () => {
    const adapter = createDockScrollRestoration();
    const root = document.createElement("div");
    root.innerHTML = '<div data-tab-scroll-root="list"></div><div data-tab-scroll-root="main:issue-1"></div>';
    const [list, issue] = Array.from(root.children) as HTMLElement[];
    list!.scrollTop = 34;
    issue!.scrollTop = 123;
    adapter.captureElements(root);
    adapter.setViewState("highlight:issue-1", "comment-1");
    expect(adapter.get("list")?.top).toBe(34);
    expect(adapter.get("main:issue-1")?.top).toBe(123);
    expect(adapter.getViewState("highlight:issue-1")).toBe("comment-1");
    expect(adapter.get("main:issue-2")).toBeUndefined();
  });
});
