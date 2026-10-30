import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeAmbience } from "./theme-ambience";

describe("ThemeAmbience", () => {
  it("has a bounded decorative layer that does not intercept input", () => {
    render(<ThemeAmbience />);
    const layer = screen.getByTestId("theme-ambience");
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toHaveClass("pointer-events-none");
    for (const theme of ["graphite-copper", "mist-celadon", "cream-gold", "moon-lavender", "deep-ocean"]) {
      const group = layer.querySelector(`[data-ambience-theme="${theme}"]`);
      expect(group).not.toBeNull();
      expect(group!.children.length).toBeGreaterThan(1);
      expect(group!.children.length).toBeLessThanOrEqual(6);
    }
  });
});
