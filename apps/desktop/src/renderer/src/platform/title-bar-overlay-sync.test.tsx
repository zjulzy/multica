import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const theme = vi.hoisted(() => ({ resolvedTheme: "light" as string | undefined }));
vi.mock("@multica/ui/components/common/theme-provider", () => ({
  useTheme: () => theme,
}));

vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
  cb(0);
  return 1;
});
vi.stubGlobal("cancelAnimationFrame", () => {});

import { TitleBarOverlaySync, resolveOverlayColors } from "./title-bar-overlay-sync";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";

/**
 * jsdom has no 2D raster. Emulate the parts resolveOverlayColors relies on:
 * fillStyle keeps the last *parseable* color (unknown values are ignored,
 * like Chromium), fillRect paints it, getImageData reads it back.
 */
function fakeCanvas(parse: (value: string) => [number, number, number] | null) {
  let current: [number, number, number] = [0, 0, 0];
  let painted: [number, number, number, number] = [0, 0, 0, 0];
  const ctx = {
    set fillStyle(value: string) {
      const rgb = parse(value);
      if (rgb) current = rgb;
    },
    clearRect() {
      painted = [0, 0, 0, 0];
    },
    fillRect() {
      painted = [...current, 255];
    },
    getImageData() {
      return { data: Uint8ClampedArray.from(painted) };
    },
  };
  return { getContext: () => ctx } as unknown as HTMLCanvasElement;
}

const parseKnown = (v: string): [number, number, number] | null => {
  if (v === "#010203") return [1, 2, 3];
  if (v === "oklch(0.964 0.0013 286)") return [245, 245, 246];
  if (v === "oklch(0.505 0.016 286)") return [120, 120, 138];
  return null;
};

describe("resolveOverlayColors", () => {
  it("rasterizes CSS variable colors (incl. oklch) to 6-digit hex", () => {
    const read = (name: string) =>
      name === "--app-shell" ? "oklch(0.964 0.0013 286)" : "oklch(0.505 0.016 286)";
    expect(resolveOverlayColors(read, fakeCanvas(parseKnown))).toEqual({
      color: "#f5f5f6",
      symbolColor: "#78788a",
    });
  });

  it("returns null for empty or unparseable colors", () => {
    expect(resolveOverlayColors(() => "", fakeCanvas(parseKnown))).toBeNull();
    expect(resolveOverlayColors(() => "not-a-color", fakeCanvas(parseKnown))).toBeNull();
  });
});

describe("TitleBarOverlaySync", () => {
  const setTitleBarOverlay = vi.fn();
  beforeEach(() => {
    setTitleBarOverlay.mockReset();
    theme.resolvedTheme = "light";
    Object.defineProperty(window, "desktopAPI", {
      configurable: true,
      value: { appInfo: { os: "windows", version: "x" }, setTitleBarOverlay },
    });
  });

  it("sends colors on mount and again when the theme changes", () => {
    const colors = { color: "#f5f5f6", symbolColor: "#78788a" };
    const resolve = () => colors;
    const { rerender } = render(<TitleBarOverlaySync resolve={resolve} />);
    expect(setTitleBarOverlay).toHaveBeenCalledTimes(1);
    expect(setTitleBarOverlay).toHaveBeenCalledWith({ ...colors, height: 40 });
    theme.resolvedTheme = "dark";
    rerender(<TitleBarOverlaySync resolve={resolve} />);
    expect(setTitleBarOverlay).toHaveBeenCalledTimes(2);
    theme.resolvedTheme = "graphite-copper";
    rerender(<TitleBarOverlaySync resolve={resolve} />);
    expect(setTitleBarOverlay).toHaveBeenCalledTimes(3);
  });

  it("uses the taller bar height in single-tab mode", () => {
    useDesktopPrefsStore.setState({ singleTabMode: true });
    try {
      const colors = { color: "#f5f5f6", symbolColor: "#78788a" };
      render(<TitleBarOverlaySync resolve={() => colors} />);
      expect(setTitleBarOverlay).toHaveBeenCalledWith({ ...colors, height: 48 });
    } finally {
      useDesktopPrefsStore.setState({ singleTabMode: false });
    }
  });

  it("does nothing off Windows", () => {
    Object.defineProperty(window, "desktopAPI", {
      configurable: true,
      value: { appInfo: { os: "macos", version: "x" }, setTitleBarOverlay },
    });
    render(
      <TitleBarOverlaySync resolve={() => ({ color: "#000000", symbolColor: "#ffffff" })} />,
    );
    expect(setTitleBarOverlay).not.toHaveBeenCalled();
  });
});
