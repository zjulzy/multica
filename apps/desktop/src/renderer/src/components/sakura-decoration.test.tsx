import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SakuraDecoration } from "./sakura-decoration";

describe("SakuraDecoration", () => {
  it("is decorative, ignores input, and contains a small fixed number of petals", () => {
    render(<SakuraDecoration />);
    const layer = screen.getByTestId("sakura-decoration");
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toHaveClass("pointer-events-none");
    expect(layer.querySelectorAll("[data-sakura-petal]")).toHaveLength(4);
  });
  it("only animates petals for the sakura theme when motion is enabled", () => {
    const css = readFileSync("src/renderer/src/desktop-themes.css", "utf8");
    expect(css).toContain('html[data-desktop-theme="sakura-blush"][data-interface-motion="on"] [data-sakura-petal]');
    expect(css).toContain("prefers-reduced-motion: no-preference");
  });
});
