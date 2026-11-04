import { useRef } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHeaderAlignment } from "./use-header-alignment";

let resize: (() => void) | undefined;
let animationFrame: FrameRequestCallback | undefined;
class FakeResizeObserver {
  constructor(callback: () => void) { resize = callback; }
  observe() {}
  disconnect() {}
}

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  useHeaderAlignment(ref);
  return <><div data-testid="header-parent"><div ref={ref} data-testid="header" /></div><div data-slot="desktop-content-card"><div data-slot="desktop-list-page"><div data-slot="list-page-main" /></div></div></>;
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); resize = undefined; animationFrame = undefined; });

function mockAnimationFrames() {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { animationFrame = callback; return 1; });
  vi.stubGlobal("cancelAnimationFrame", () => { animationFrame = undefined; });
}
function flushFrame() { const callback = animationFrame; animationFrame = undefined; callback?.(0); }

describe("single tab header alignment", () => {
  it("follows the main pane as it moves and clamps to leave the title room", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    mockAnimationFrames();
    let paneLeft = 304;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const left = this.dataset.slot === "list-page-main" ? paneLeft : 200;
      return { left, width: 500 } as DOMRect;
    });
    const { getByTestId } = render(<Harness />);
    expect(getByTestId("header")).toHaveStyle({ marginLeft: "104px" });
    paneLeft = 364;
    act(() => { resize?.(); flushFrame(); });
    expect(getByTestId("header")).toHaveStyle({ marginLeft: "164px" });
    paneLeft = 190;
    act(() => { resize?.(); flushFrame(); });
    expect(getByTestId("header")).toHaveStyle({ marginLeft: "0px" });
    paneLeft = 900;
    act(() => { resize?.(); flushFrame(); });
    expect(getByTestId("header")).toHaveStyle({ marginLeft: "340px" });
  });

  it("realigns when the current page replaces a list-and-detail pane", async () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    mockAnimationFrames();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const left = this.dataset.slot === "list-page-main" ? 320 : this.dataset.slot === "desktop-content-card" ? 250 : 200;
      return { left, width: 500 } as DOMRect;
    });
    const { getByTestId, container } = render(<Harness />);
    const header = getByTestId("header");
    expect(header).toHaveStyle({ marginLeft: "120px" });
    const listPage = container.querySelector('[data-slot="desktop-list-page"]')!;
    act(() => listPage.remove());
    await waitFor(() => expect(animationFrame).toBeDefined());
    act(flushFrame);
    await waitFor(() => expect(header).toHaveStyle({ marginLeft: "50px" }));
    act(() => container.querySelector('[data-slot="desktop-content-card"]')!.appendChild(listPage));
    await waitFor(() => expect(animationFrame).toBeDefined());
    act(flushFrame);
    await waitFor(() => expect(header).toHaveStyle({ marginLeft: "120px" }));
  });
});
