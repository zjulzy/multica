import { describe, expect, it } from "vitest";
import {
  DEFAULT_OVERLAY_COLORS,
  parseTitleBarOverlayColors,
  titleBarOptionsFor,
} from "./title-bar";

describe("titleBarOptionsFor", () => {
  it("uses hidden + overlay on Windows for the main window (40px)", () => {
    expect(titleBarOptionsFor("win32", "main")).toEqual({
      titleBarStyle: "hidden",
      titleBarOverlay: { ...DEFAULT_OVERLAY_COLORS, height: 40 },
    });
  });

  it("uses a 32px overlay for issue windows on Windows", () => {
    expect(titleBarOptionsFor("win32", "issue")).toEqual({
      titleBarStyle: "hidden",
      titleBarOverlay: { ...DEFAULT_OVERLAY_COLORS, height: 32 },
    });
  });

  it("keeps hiddenInset + traffic light position on macOS", () => {
    expect(titleBarOptionsFor("darwin", "main")).toEqual({
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 13 },
    });
    expect(titleBarOptionsFor("darwin", "issue")).toEqual({
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 17 },
    });
  });

  it("leaves Linux on the macOS-style options (out of scope, unchanged)", () => {
    expect(titleBarOptionsFor("linux", "main").titleBarStyle).toBe("hiddenInset");
  });
});

describe("parseTitleBarOverlayColors", () => {
  it("accepts 6-digit hex colors", () => {
    expect(
      parseTitleBarOverlayColors({ color: "#f5f5f6", symbolColor: "#6B6B76" }),
    ).toEqual({ color: "#f5f5f6", symbolColor: "#6B6B76" });
  });

  it("rejects anything that is not a plain hex color", () => {
    expect(parseTitleBarOverlayColors({ color: "red", symbolColor: "#000000" })).toBeNull();
    expect(parseTitleBarOverlayColors({ color: "#fff", symbolColor: "#000000" })).toBeNull();
    expect(parseTitleBarOverlayColors(null)).toBeNull();
    expect(parseTitleBarOverlayColors({ color: "#f5f5f6" })).toBeNull();
  });
});
