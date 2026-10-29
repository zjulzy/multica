import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "@multica/ui/components/common/theme-provider";
import { DesktopThemeProvider } from "./desktop-theme-provider";

function Picker() {
  const { setTheme } = useTheme();
  return <><button onClick={() => setTheme("graphite-copper")}>Copper</button><button onClick={() => setTheme("mist-celadon")}>Celadon</button><button onClick={() => setTheme("cream-gold")}>Gold</button><button onClick={() => setTheme("light")}>Light</button></>;
}

describe("DesktopThemeProvider", () => {
  afterEach(() => { cleanup(); localStorage.clear(); document.documentElement.className = ""; delete document.documentElement.dataset.desktopTheme; vi.unstubAllGlobals(); });
  it.each([["Copper", "graphite-copper", "dark"], ["Celadon", "mist-celadon", "light"], ["Gold", "cream-gold", "light"]])("persists %s with the correct base styles and restores light on switch", async (label, theme, base) => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<DesktopThemeProvider><Picker /></DesktopThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-desktop-theme", theme));
    expect(document.documentElement).toHaveClass(base);
    expect(localStorage.getItem("theme")).toBe(theme);
    cleanup();
    render(<DesktopThemeProvider><Picker /></DesktopThemeProvider>);
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-desktop-theme", theme));
    expect(document.documentElement).toHaveClass(base);
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    await waitFor(() => expect(document.documentElement).not.toHaveAttribute("data-desktop-theme"));
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
  });
  it("falls back to dark if the discontinued preview theme was saved", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    localStorage.setItem("theme", "pink");
    render(<DesktopThemeProvider><Picker /></DesktopThemeProvider>);
    await waitFor(() => expect(localStorage.getItem("theme")).toBe("dark"));
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveAttribute("data-desktop-theme");
  });
});
