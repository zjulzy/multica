import { afterEach, describe, expect, it, vi } from "vitest";
import { observeEmbeddedGeometry } from "./embedded-view-geometry";

describe("embedded issue geometry", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("sends the latest position once per frame and stops after cleanup", () => {
    let resize!: () => void;
    let scheduled: FrameRequestCallback | undefined;
    const cancel = vi.fn();
    vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect() {} });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { scheduled = callback; return 1; });
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const element = document.createElement("div");
    const measure = vi.spyOn(element, "getBoundingClientRect").mockReturnValue({ x: 10, y: 20, width: 500, height: 300 } as DOMRect);
    const send = vi.fn();
    const cleanup = observeEmbeddedGeometry(element, send);
    resize(); resize();
    expect(measure).not.toHaveBeenCalled();
    scheduled!(0);
    expect(measure).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ x: 10, y: 20, width: 500, height: 300 });
    resize(); cleanup();
    expect(cancel).toHaveBeenCalledWith(1);
  });
});
