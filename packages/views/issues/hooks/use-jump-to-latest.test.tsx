import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JUMP_FOLLOW_MS, useJumpToLatest } from "./use-jump-to-latest";

let resizeCallback: ResizeObserverCallback;
const disconnect = vi.fn();
function Harness({ metrics }: { metrics: { scrollHeight: number; clientHeight: number } }) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const { visible, jump } = useJumpToLatest(element);
  return <div data-testid="scroller" ref={(node) => {
    if (!node || node === element) return;
    let top = 0;
    Object.defineProperties(node, {
      scrollHeight: { configurable: true, get: () => metrics.scrollHeight },
      clientHeight: { configurable: true, get: () => metrics.clientHeight },
      scrollTop: { configurable: true, get: () => top, set: (value: number) => { top = Math.max(0, Math.min(value, metrics.scrollHeight - metrics.clientHeight)); } },
    });
    setElement(node);
  }}><div data-testid="content" />{visible && <button onClick={jump}>latest</button>}</div>;
}
beforeEach(() => {
  vi.useFakeTimers();
  disconnect.mockReset();
  vi.stubGlobal("ResizeObserver", class { constructor(cb: ResizeObserverCallback) { resizeCallback = cb; } observe() {} disconnect() { disconnect(); } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("useJumpToLatest", () => {
  it("keeps the button visible without monitoring or measuring while idle", () => {
    const observer = vi.spyOn(globalThis, "ResizeObserver");
    render(<Harness metrics={{ scrollHeight: 900, clientHeight: 500 }} />);
    const scroller = screen.getByTestId("scroller");
    const height = vi.spyOn(scroller, "scrollHeight", "get");
    fireEvent.scroll(scroller);
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole("button", { name: "latest" })).toBeTruthy();
    expect(observer).not.toHaveBeenCalled();
    expect(height).not.toHaveBeenCalled();
  });
  it("jumps immediately, then coalesces late content changes", () => {
    const metrics = { scrollHeight: 2000, clientHeight: 500 };
    render(<Harness metrics={metrics} />);
    const scroller = screen.getByTestId("scroller");
    fireEvent.click(screen.getByRole("button", { name: "latest" }));
    expect(scroller.scrollTop).toBe(1500);
    metrics.scrollHeight = 2600;
    act(() => { resizeCallback([], {} as ResizeObserver); resizeCallback([], {} as ResizeObserver); });
    expect(scroller.scrollTop).toBe(1500);
    act(() => vi.advanceTimersByTime(120));
    expect(scroller.scrollTop).toBe(2100);
  });
  it("stops following on user input or after the deadline", () => {
    const metrics = { scrollHeight: 2000, clientHeight: 500 };
    render(<Harness metrics={metrics} />);
    const scroller = screen.getByTestId("scroller");
    fireEvent.click(screen.getByRole("button", { name: "latest" }));
    fireEvent.wheel(scroller);
    metrics.scrollHeight = 2600;
    act(() => vi.advanceTimersByTime(JUMP_FOLLOW_MS));
    expect(scroller.scrollTop).toBe(1500);
    expect(disconnect).toHaveBeenCalled();
  });
  it("stops following on keyboard input outside the scroller", () => {
    render(<Harness metrics={{ scrollHeight: 2000, clientHeight: 500 }} />);
    fireEvent.click(screen.getByRole("button", { name: "latest" }));
    fireEvent.keyDown(document.body, { key: "PageUp" });
    expect(disconnect).toHaveBeenCalled();
  });
  it("follows late growth until the deadline and removes observers afterwards", () => {
    const metrics = { scrollHeight: 2000, clientHeight: 500 };
    render(<Harness metrics={metrics} />);
    const scroller = screen.getByTestId("scroller");
    fireEvent.click(screen.getByRole("button", { name: "latest" }));
    act(() => vi.advanceTimersByTime(1000));
    metrics.scrollHeight = 3000;
    act(() => { resizeCallback([], {} as ResizeObserver); vi.advanceTimersByTime(120); });
    expect(scroller.scrollTop).toBe(2500);
    act(() => vi.advanceTimersByTime(JUMP_FOLLOW_MS));
    expect(disconnect).toHaveBeenCalledOnce();
    metrics.scrollHeight = 4000;
    act(() => { resizeCallback([], {} as ResizeObserver); vi.advanceTimersByTime(200); });
    expect(scroller.scrollTop).toBe(2500);
  });
});
