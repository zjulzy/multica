export function showMainWindow(
  window: { show(): void; showInactive(): void; maximize(): void; setFullScreen(value: boolean): void },
  state: { isMaximized?: boolean; isFullScreen?: boolean },
  inactive: boolean,
): void {
  if (inactive) { window.showInactive(); return; }
  if (state.isFullScreen) window.setFullScreen(true);
  else if (state.isMaximized) window.maximize();
  window.show();
}
