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

function fakeCanvas(normalize: (value: string) => string) {
  let current = "";
  const ctx = {
    get fillStyle() {
      return current;
    },
    set fillStyle(value: string) {
      current = normalize(value);
    },
  };
  return { getContext: () => ctx } as unknown as HTMLCanvasElement;
}

describe("resolveOverlayColors", () => {
  it("normalizes CSS variable colors to 6-digit hex via canvas", () => {
    // jsdom's canvas stub does not normalize; emulate Chromium's behavior.
    const canvas = fakeCanvas((v) =>
      v === "rgb(245, 245, 246)" ? "#f5f5f6" : v === "rgb(120, 120, 138)" ? "#78788a" : v,
    );
    const read = (name: string) =>
      name === "--app-shell" ? "rgb(245, 245, 246)" : "rgb(120, 120, 138)";
    expect(resolveOverlayColors(read, canvas)).toEqual({
      color: "#f5f5f6",
      symbolColor: "#78788a",
    });
  });

  it("returns null when the canvas cannot normalize to hex", () => {
    const canvas = fakeCanvas((v) => v);
    expect(resolveOverlayColors(() => "", canvas)).toBeNull();
    expect(resolveOverlayColors(() => "oklch(0.5 0 0)", canvas)).toBeNull();
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
    expect(setTitleBarOverlay).toHaveBeenCalledWith(colors);
    theme.resolvedTheme = "dark";
    rerender(<TitleBarOverlaySync resolve={resolve} />);
    expect(setTitleBarOverlay).toHaveBeenCalledTimes(2);
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
