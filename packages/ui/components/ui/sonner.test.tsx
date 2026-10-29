import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

const state = vi.hoisted(() => ({ resolvedTheme: "dark" }));
vi.mock("next-themes", () => ({ useTheme: () => state }));
import { Toaster } from "./sonner";

describe("Toaster", () => {
  it.each([["graphite-copper", "dark"], ["mist-celadon", "light"], ["cream-gold", "light"]])("uses Sonner's %s styling as %s", async (theme, base) => {
    state.resolvedTheme = theme;
    const { container } = render(<Toaster />);
    act(() => { toast("Title", { description: "Details" }); });
    await waitFor(() => expect(container.querySelector(`[data-sonner-theme="${base}"]`)).not.toBeNull());
  });
});
