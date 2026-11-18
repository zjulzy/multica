import { describe, expect, it, vi } from "vitest";
import { showMainWindow } from "./preview-window";

describe("development preview window", () => {
  it("opens without taking focus or maximizing the user's window", () => {
    const window = { show: vi.fn(), showInactive: vi.fn(), maximize: vi.fn(), setFullScreen: vi.fn() };
    showMainWindow(window, { isMaximized: true, isFullScreen: false }, true);
    expect(window.showInactive).toHaveBeenCalledOnce();
    expect(window.show).not.toHaveBeenCalled();
    expect(window.maximize).not.toHaveBeenCalled();
  });
  it("preserves normal fullscreen restoration", () => {
    const window = { show: vi.fn(), showInactive: vi.fn(), maximize: vi.fn(), setFullScreen: vi.fn() };
    showMainWindow(window, { isMaximized: false, isFullScreen: true }, false);
    expect(window.setFullScreen).toHaveBeenCalledWith(true);
    expect(window.show).toHaveBeenCalledOnce();
  });
});
