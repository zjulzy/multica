import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDockAlignment } from "./use-dock-alignment";

let notifyResize: () => void;
let paneLeft = 360;
class FakeResizeObserver {
  constructor(callback: ResizeObserverCallback) { notifyResize = () => callback([], this as unknown as ResizeObserver); }
  observe() {}
  disconnect() {}
}
function Fixture({ hasPane = true, liwork = true, settings = false }: { hasPane?: boolean; liwork?: boolean; settings?: boolean }) {
  const content = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  useDockAlignment(content, dock, true);
  return <div><div ref={content} data-testid="content">{hasPane && <div data-liwork-monitor-page={liwork ? "" : undefined} data-settings-page={settings ? "" : undefined}><div data-slot="list-page-main" /></div>}</div><div ref={dock} data-testid="dock" /></div>;
}
describe("dock alignment", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it("follows the main pane as the sidebar changes width and resets without a list pane", async () => {
    paneLeft = 360;
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    let frame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frame = callback; return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const left = this.dataset.slot === "list-page-main" ? paneLeft : 100;
      return { left, right: 1000, width: 900, top: 0, bottom: 600, height: 600, x: left, y: 0, toJSON: () => ({}) };
    });
    const { getByTestId, rerender } = render(<Fixture />);
    expect(getByTestId("dock").style.left).toBe("260px");
    paneLeft = 440;
    act(() => { notifyResize(); frame?.(0); });
    expect(getByTestId("dock").style.left).toBe("340px");
    rerender(<Fixture hasPane={false} />);
    await act(async () => { await Promise.resolve(); });
    act(() => frame?.(0));
    expect(getByTestId("dock").style.left).toBe("0px");
  });
  it("leaves other pages at full width", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const left = this.dataset.slot === "list-page-main" ? 360 : 100;
      return { left, right: 1000, width: 900, top: 0, bottom: 600, height: 600, x: left, y: 0, toJSON: () => ({}) };
    });
    const { getByTestId } = render(<Fixture liwork={false} />);
    expect(getByTestId("dock").style.left).toBe("0px");
  });
  it("aligns with the settings detail pane", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const left = this.dataset.slot === "list-page-main" ? 360 : 100;
      return { left, right: 1000, width: 900, top: 0, bottom: 600, height: 600, x: left, y: 0, toJSON: () => ({}) };
    });
    const { getByTestId } = render(<Fixture liwork={false} settings />);
    expect(getByTestId("dock").style.left).toBe("260px");
  });
});
