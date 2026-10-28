import { useEffect } from "react";
import { useTheme } from "@multica/ui/components/common/theme-provider";
import { isWindowsDesktop } from "./desktop-os";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";

/** Top bar heights (px); must match desktop-layout.tsx and window-toolbar.tsx. */
export const TOP_BAR_HEIGHT_TABBED = 40;
export const TOP_BAR_HEIGHT_SINGLE_TAB = 48;

export interface OverlayColors {
  color: string;
  symbolColor: string;
}

function toHexByte(n: number): string {
  return n.toString(16).padStart(2, "0");
}

/**
 * Read `--app-shell` / `--muted-foreground` and normalize them to `#rrggbb`.
 * The tokens are `oklch(...)`, which `titleBarOverlay` does not accept and
 * which canvas `fillStyle` serialization does not fold to hex either. Painting
 * one pixel and reading it back does: the rasterized sRGB value is what the
 * window would show anyway.
 */
export function resolveOverlayColors(
  readVariable: (name: string) => string = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
  canvas: HTMLCanvasElement = document.createElement("canvas"),
): OverlayColors | null {
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const toHex = (value: string): string | null => {
    if (!value) return null;
    ctx.clearRect(0, 0, 1, 1);
    // Sentinel first: if `value` fails to parse, fillStyle keeps the sentinel
    // and the painted pixel reveals it.
    ctx.fillStyle = "#010203";
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a !== 255) return null;
    const hex = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
    return hex === "#010203" ? null : hex;
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
  const singleTabMode = useDesktopPrefsStore((s) => s.singleTabMode);
  const height = singleTabMode ? TOP_BAR_HEIGHT_SINGLE_TAB : TOP_BAR_HEIGHT_TABBED;
  useEffect(() => {
    if (!isWindowsDesktop()) return;
    // next-themes applies the `.dark` class in an effect too; defer one frame
    // so the computed variables reflect the new theme.
    const frame = requestAnimationFrame(() => {
      const colors = resolve();
      if (colors) window.desktopAPI.setTitleBarOverlay({ ...colors, height });
    });
    return () => cancelAnimationFrame(frame);
  }, [resolve, resolvedTheme, height]);
  return null;
}
