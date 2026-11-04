import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RailAgentRegion } from "./rail-agent-region";

let resize: () => void;
class MockResizeObserver {
  constructor(callback: ResizeObserverCallback) { resize = () => callback([], this as unknown as ResizeObserver); }
  observe() {}
  disconnect() {}
}

describe("RailAgentRegion", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("shows an overlay indicator only when the agent list overflows and updates it while scrolling", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    render(<RailAgentRegion><div>Agents</div></RailAgentRegion>);
    const viewport = screen.getByTestId("rail-agent-scroll");
    Object.defineProperties(viewport, { clientHeight: { configurable: true, value: 100 }, scrollHeight: { configurable: true, value: 100 } });
    act(() => resize());
    expect(screen.queryByTestId("rail-agent-scroll-thumb")).not.toBeInTheDocument();
    Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 400 });
    act(() => resize());
    const thumb = screen.getByTestId("rail-agent-scroll-thumb");
    expect(thumb.style.height).toBe("25px");
    viewport.scrollTop = 150;
    fireEvent.scroll(viewport);
    expect(thumb.style.transform).toBe("translateY(37.5px)");
    expect(viewport.className).toContain("[scrollbar-width:none]");
    expect(viewport.className).not.toContain("scrollbar-width:thin");
  });
});
