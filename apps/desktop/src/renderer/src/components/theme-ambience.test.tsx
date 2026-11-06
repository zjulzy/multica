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
  it("keeps nature decorations accessible only as background and supplies matching animated details", () => {
    render(<ThemeAmbience />);
    for (const theme of ["daisy-garden", "hydrangea-rain", "osmanthus-courtyard", "starlit-dream"]) {
      const group = screen.getByTestId("theme-ambience").querySelector(`[data-nature-theme="${theme}"]`);
      expect(group).not.toBeNull();
      expect(group!.querySelector("svg")).not.toBeNull();
      expect(group!.querySelectorAll("[data-nature-particle]").length).toBeGreaterThan(0);
    }
  });
});
