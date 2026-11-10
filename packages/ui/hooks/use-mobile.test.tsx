import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsCompact, useIsMobile } from "./use-mobile";

describe("responsive breakpoint", () => {
  const originalWidth = Object.getOwnPropertyDescriptor(window, "innerWidth")!;
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); Object.defineProperty(window, "innerWidth", originalWidth); });
  it("uses the media query result without synchronously measuring the window", () => {
    let change: ((event: MediaQueryListEvent) => void) | undefined;
    const media = { matches: true, addEventListener: vi.fn((_type, listener) => { change = listener; }), removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", vi.fn(() => media));
    const width = vi.fn(() => 1024);
    Object.defineProperty(window, "innerWidth", { configurable: true, get: width });
    const { result, unmount } = renderHook(() => ({ mobile: useIsMobile(), compact: useIsCompact() }));
    expect(result.current).toEqual({ mobile: true, compact: true });
    expect(width).not.toHaveBeenCalled();
    act(() => change!({ matches: false } as MediaQueryListEvent));
    expect(result.current.compact).toBe(false);
    expect(width).not.toHaveBeenCalled();
    unmount();
    expect(media.removeEventListener).toHaveBeenCalledTimes(2);
  });
});
