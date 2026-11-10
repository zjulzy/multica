import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCommentComposerStore } from "@multica/core/issues/stores";
import { useStickyComposer } from "./use-sticky-composer";

// jsdom does not evaluate media queries, so provide a viewport-aware matchMedia.
const DESKTOP_WIDTH = 1280;
const PHONE_WIDTH = 390;

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

describe("useStickyComposer", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: window.innerWidth <= Number(query.match(/max-width:\s*(\d+)px/)?.[1] ?? -1), addEventListener: () => {}, removeEventListener: () => {} }));
    useCommentComposerStore.setState({ sticky: true });
    setViewportWidth(DESKTOP_WIDTH);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useCommentComposerStore.setState({ sticky: true });
    setViewportWidth(DESKTOP_WIDTH);
  });

  it("pins the composer when the preference is on and the viewport has room", () => {
    const { result } = renderHook(() => useStickyComposer());

    expect(result.current).toBe(true);
  });

  it("does not pin when the preference is off", () => {
    useCommentComposerStore.setState({ sticky: false });

    const { result } = renderHook(() => useStickyComposer());

    expect(result.current).toBe(false);
  });

  it("does not pin below the mobile breakpoint even with the preference on", () => {
    setViewportWidth(PHONE_WIDTH);

    const { result } = renderHook(() => useStickyComposer());

    expect(result.current).toBe(false);
  });

  it("still pins at exactly the breakpoint — 768px is not a phone", () => {
    setViewportWidth(768);

    const { result } = renderHook(() => useStickyComposer());

    expect(result.current).toBe(true);
  });

  // The narrow-screen override is a rendering decision, not a settings change.
  // Rewriting the stored preference would silently unpin the composer on the
  // desktop too, the next time that user opened an issue there.
  it("leaves the stored preference alone, so a wider viewport pins again", () => {
    setViewportWidth(PHONE_WIDTH);
    renderHook(() => useStickyComposer());

    expect(useCommentComposerStore.getState().sticky).toBe(true);

    setViewportWidth(DESKTOP_WIDTH);
    const { result } = renderHook(() => useStickyComposer());

    expect(result.current).toBe(true);
  });
});
