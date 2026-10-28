/**
 * Renderer-side OS check. `desktopAPI` is absent in some unit tests, so this
 * degrades to "not Windows" (the macOS layout) instead of throwing.
 */
export function isWindowsDesktop(): boolean {
  return window.desktopAPI?.appInfo?.os === "windows";
}

/** Width reserved on the right of the top bar for the native overlay buttons. */
export const WINDOWS_CONTROLS_CLEARANCE = 138;
