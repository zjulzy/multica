import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync("src/renderer/src/desktop-themes.css", "utf8");
function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const rgb = hex.match(/[\da-f]{2}/gi)!.map((part) => {
      const c = parseInt(part, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
  };
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe("desktop theme colors", () => {
  afterEach(() => { document.head.querySelector("#theme-test")?.remove(); delete document.documentElement.dataset.desktopTheme; });
  it.each(["graphite-copper", "mist-celadon", "cream-gold", "sakura-blush", "moon-lavender", "deep-ocean"])("keeps %s text and buttons readable", (theme) => {
    const style = document.createElement("style");
    style.id = "theme-test";
    style.textContent = css;
    document.documentElement.dataset.desktopTheme = theme;
    document.head.append(style);
    const root = getComputedStyle(document.documentElement);
    const token = (name: string) => root.getPropertyValue(name).trim();
    for (const background of ["--page-canvas", "--surface", "--surface-raised", "--surface-hover", "--surface-selected", "--sidebar-accent"]) {
      expect(contrast(token("--foreground"), token(background))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token("--muted-foreground"), token(background))).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(token("--brand-foreground"), token("--brand"))).toBeGreaterThanOrEqual(4.5);
  });
});
