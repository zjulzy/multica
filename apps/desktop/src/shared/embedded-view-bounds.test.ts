import { describe, expect, it } from "vitest";
import { embeddedViewBounds } from "./embedded-view-bounds";

describe("embedded issue view bounds", () => {
  it("clips to the content area and converts fractional CSS pixels to integer DIPs", () => {
    expect(embeddedViewBounds({ x: 210.4, y: 47.7, width: 800.2, height: 500.9 }, { width: 1000, height: 600 }))
      .toEqual({ x: 210, y: 48, width: 790, height: 501 });
  });
  it("prevents an offscreen or invalid view from covering the window", () => {
    expect(embeddedViewBounds({ x: 1200, y: 10, width: 50, height: 50 }, { width: 1000, height: 600 })).toBeNull();
    expect(embeddedViewBounds({ x: 1, y: 1, width: 0, height: 50 }, { width: 1000, height: 600 })).toBeNull();
    expect(embeddedViewBounds({ x: NaN, y: 0, width: 200, height: 50 }, { width: 1000, height: 600 })).toBeNull();
    expect(embeddedViewBounds({ x: -10, y: -20, width: 100, height: 80 }, { width: 1000, height: 600 })).toEqual({ x: 0, y: 0, width: 90, height: 60 });
  });
});
