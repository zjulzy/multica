import { describe, expect, it, vi } from "vitest";
import { scheduleTimelineScrollSynchronization, synchronizeUnmeasuredTimeline } from "./timeline-scroll-initialization";

describe("virtual timeline initialization", () => {
  it("synchronizes the visible scroll container if the mounted list has no height", () => {
    const scroller = document.createElement("div");
    const list = document.createElement("div");
    Object.defineProperty(scroller, "clientHeight", { value: 700 });
    vi.spyOn(list, "getBoundingClientRect").mockReturnValue({ height: 0 } as DOMRect);
    const listener = vi.fn(); scroller.addEventListener("scroll", listener);
    expect(synchronizeUnmeasuredTimeline(scroller, list)).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    expect(scroller.scrollTop).toBe(0);
  });
  it("leaves measured or hidden containers alone", () => {
    const scroller = document.createElement("div");
    const list = document.createElement("div");
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 700 });
    vi.spyOn(list, "getBoundingClientRect").mockReturnValue({ height: 12 } as DOMRect);
    const listener = vi.fn(); scroller.addEventListener("scroll", listener);
    expect(synchronizeUnmeasuredTimeline(scroller, list)).toBe(false);
    Object.defineProperty(scroller, "clientHeight", { value: 0 });
    vi.spyOn(list, "getBoundingClientRect").mockReturnValue({ height: 0 } as DOMRect);
    expect(synchronizeUnmeasuredTimeline(scroller, list)).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });
  it("retries initialization briefly until the list has measured, then stops", () => {
    vi.useFakeTimers();
    try {
      const scroller = document.createElement("div");
      const list = document.createElement("div");
      Object.defineProperty(scroller, "clientHeight", { value: 700 });
      let height = 0;
      vi.spyOn(list, "getBoundingClientRect").mockImplementation(() => ({ height }) as DOMRect);
      const listener = vi.fn(); scroller.addEventListener("scroll", listener);
      const cancel = scheduleTimelineScrollSynchronization(scroller, () => list);
      vi.advanceTimersByTime(100);
      expect(listener).toHaveBeenCalled();
      height = 100;
      vi.runAllTimers();
      const calls = listener.mock.calls.length;
      vi.advanceTimersByTime(10000);
      expect(listener).toHaveBeenCalledTimes(calls);
      cancel();
    } finally { vi.useRealTimers(); }
  });
});
