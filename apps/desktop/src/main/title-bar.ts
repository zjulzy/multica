import type { BrowserWindowConstructorOptions } from "electron";

export type WindowKind = "main" | "issue";

export interface TitleBarOverlayColors {
  color: string;
  symbolColor: string;
}

/**
 * First-frame colors for the Windows title bar overlay. The renderer resyncs
 * them from the live theme (see platform/title-bar-overlay-sync.tsx) as soon
 * as it mounts, so these only need to match the light theme's --app-shell /
 * --muted-foreground closely enough to avoid a flash.
 */
export const DEFAULT_OVERLAY_COLORS: TitleBarOverlayColors = {
  color: "#f5f5f6",
  symbolColor: "#78788a",
};

const MAIN_TOP_BAR_HEIGHT = 40; // matches TOP_BAR_HEIGHT_CLASS "h-10"
const ISSUE_DRAG_STRIP_HEIGHT = 32; // matches issue-window.tsx "h-8"

/**
 * `titleBarStyle: "hiddenInset"` is macOS-only; Electron ignores it on
 * Windows and shows the native title bar. On Windows we hide the title bar
 * and let Electron draw the native min/max/close buttons as an overlay inside
 * the renderer's top bar, so the tab strip reaches the window edge.
 */
export function titleBarOptionsFor(
  platform: NodeJS.Platform,
  kind: WindowKind,
): Pick<
  BrowserWindowConstructorOptions,
  "titleBarStyle" | "titleBarOverlay" | "trafficLightPosition"
> {
  if (platform === "win32") {
    return {
      titleBarStyle: "hidden",
      titleBarOverlay: {
        ...DEFAULT_OVERLAY_COLORS,
        height: kind === "main" ? MAIN_TOP_BAR_HEIGHT : ISSUE_DRAG_STRIP_HEIGHT,
      },
    };
  }
  return {
    titleBarStyle: "hiddenInset",
    // Center the native controls in the main window's 40px tab toolbar.
    trafficLightPosition: kind === "main" ? { x: 16, y: 13 } : { x: 16, y: 17 },
  };
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Validate the renderer's overlay color payload; null when malformed. */
export function parseTitleBarOverlayColors(
  value: unknown,
): TitleBarOverlayColors | null {
  if (typeof value !== "object" || value === null) return null;
  const { color, symbolColor } = value as Partial<TitleBarOverlayColors>;
  if (typeof color !== "string" || !HEX_COLOR.test(color)) return null;
  if (typeof symbolColor !== "string" || !HEX_COLOR.test(symbolColor)) return null;
  return { color, symbolColor };
}
