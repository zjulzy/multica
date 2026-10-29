import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const current = vi.hoisted(() => ({ resolvedTheme: "light" }));
vi.mock("@multica/ui/components/common/theme-provider", () => ({ useTheme: () => current }));
import { DesktopThemeSync } from "./desktop-theme-sync";

describe("DesktopThemeSync", () => {
  afterEach(() => { cleanup(); delete document.documentElement.dataset.desktopTheme; });
  it.each(["graphite-copper", "mist-celadon", "cream-gold"])("sets a desktop-only marker for %s and removes it when switching away", (theme) => {
    current.resolvedTheme = theme;
    const view = render(<DesktopThemeSync />);
    expect(document.documentElement.dataset.desktopTheme).toBe(theme);
    current.resolvedTheme = "dark";
    view.rerender(<DesktopThemeSync />);
    expect(document.documentElement.dataset.desktopTheme).toBeUndefined();
  });
});
