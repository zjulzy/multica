import { useEffect } from "react";
import { useTheme } from "@multica/ui/components/common/theme-provider";
import { isWindowsDesktop } from "./desktop-os";

export interface OverlayColors {
  color: string;
  symbolColor: string;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Read `--app-shell` / `--muted-foreground` and normalize them to `#rrggbb`.
 * The tokens are `oklch(...)`, which `titleBarOverlay` does not accept;
 * assigning any CSS color to a 2D canvas `fillStyle` and reading it back
 * yields the normalized hex form for opaque colors.
 */
export function resolveOverlayColors(
  readVariable: (name: string) => string = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
  canvas: HTMLCanvasElement = document.createElement("canvas"),
): OverlayColors | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const toHex = (value: string): string | null => {
    if (!value) return null;
    ctx.fillStyle = "#000000";
    ctx.fillStyle = value;
    const out = String(ctx.fillStyle);
    return HEX_COLOR.test(out) ? out : null;
  };
  const color = toHex(readVariable("--app-shell"));
  const symbolColor = toHex(readVariable("--muted-foreground"));
  if (!color || !symbolColor) return null;
  return { color, symbolColor };
}

/**
 * Keeps the Windows native window-control overlay on the same background as
 * the top bar. Runs once on mount (first frame) and on every resolved theme
 * change (light/dark/system flips).
 */
export function TitleBarOverlaySync({
  resolve = resolveOverlayColors,
}: {
  resolve?: () => OverlayColors | null;
}) {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (!isWindowsDesktop()) return;
    // next-themes applies the `.dark` class in an effect too; defer one frame
    // so the computed variables reflect the new theme.
    const frame = requestAnimationFrame(() => {
      const colors = resolve();
      if (colors) window.desktopAPI.setTitleBarOverlay(colors);
    });
    return () => cancelAnimationFrame(frame);
  }, [resolve, resolvedTheme]);
  return null;
}
