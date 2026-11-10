import { afterEach, expect, it, vi } from "vitest";
import { observeSurfaceBounds } from "./surface-bounds";

afterEach(() => vi.unstubAllGlobals());
it("measures the new target immediately so the previous position cannot flash", () => {
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const host = document.createElement("div"), target = document.createElement("div");
  host.appendChild(target);
  vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ left: 20, top: 30, width: 800, height: 600 } as DOMRect);
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue({ left: 120, top: 130, width: 500, height: 300 } as DOMRect);
  const report = vi.fn();
  const stop = observeSurfaceBounds(host, target, report);
  expect(report).toHaveBeenCalledWith({ left: 100, top: 100, width: 500, height: 300 });
  stop();
});
it("tracks a dock surface during translation and clips it to the host", () => {
  let frame: FrameRequestCallback | undefined, changed!: () => void;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("MutationObserver", class { constructor(callback: () => void) { changed = callback; } observe() {} disconnect() {} });
  const host = document.createElement("div"), dock = document.createElement("div"), target = document.createElement("div");
  dock.dataset.testid = "dock-inbox-content"; dock.appendChild(target); host.appendChild(dock);
  vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue({ left: 100, top: 500, width: 600, height: 200 } as DOMRect);
  const report = vi.fn(); const stop = observeSurfaceBounds(host, target, report);
  frame!(0);
  expect(report).toHaveBeenCalledWith({ left: 100, top: 500, width: 600, height: 200, clipPath: "inset(0px 0px 100px 0px)" });
  dock.dataset.dockMotionPhase = "opening"; changed(); frame!(0);
  expect(frame).toBeDefined();
  stop();
});
