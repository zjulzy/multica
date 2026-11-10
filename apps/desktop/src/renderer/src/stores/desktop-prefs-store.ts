import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Desktop-only UI preferences. Renderer-local (localStorage) because every
 * consumer lives in the renderer; nothing in main needs them.
 */
interface DesktopPrefsStore {
  /** Hide the tab strip and route every "open in new tab" in place. */
  singleTabMode: boolean;
  /** Keep the workspace Inbox available in a bottom dock. */
  inboxDockEnabled: boolean;
  lightweightInboxEnabled: boolean;
  lightweightInboxReplyLimit: number;
  /** Restore the bottom Inbox dock's expanded/collapsed state. */
  inboxDockOpen: boolean;
  /** Last expanded Inbox dock height as a percentage of the canvas. */
  inboxDockSize: number;
  /** Show the active-agent status hub in the sidebar. */
  agentStatusHubEnabled: boolean;
  interfaceMotionEnabled: boolean;
  sidebarFontSize: "small" | "standard" | "large";
  liworkMonitorEnabled: boolean;
  pinnedIssueCacheEnabled: boolean;
  setSingleTabMode: (enabled: boolean) => void;
  setInboxDockEnabled: (enabled: boolean) => void;
  setLightweightInboxEnabled: (enabled: boolean) => void;
  setLightweightInboxReplyLimit: (limit: number) => void;
  setInboxDockOpen: (open: boolean) => void;
  setInboxDockSize: (size: number) => void;
  setAgentStatusHubEnabled: (enabled: boolean) => void;
  setInterfaceMotionEnabled: (enabled: boolean) => void;
  setSidebarFontSize: (size: "small" | "standard" | "large") => void;
  setLiworkMonitorEnabled: (enabled: boolean) => void;
  setPinnedIssueCacheEnabled: (enabled: boolean) => void;
}

export const useDesktopPrefsStore = create<DesktopPrefsStore>()(
  persist(
    (set) => ({
      singleTabMode: false,
      inboxDockEnabled: false,
      lightweightInboxEnabled: true,
      lightweightInboxReplyLimit: 6,
      inboxDockOpen: false,
      inboxDockSize: 38,
      agentStatusHubEnabled: true,
      interfaceMotionEnabled: false,
      sidebarFontSize: "standard",
      liworkMonitorEnabled: true,
      pinnedIssueCacheEnabled: true,
      setSingleTabMode: (enabled) => set({ singleTabMode: enabled }),
      setInboxDockEnabled: (enabled) =>
        set(enabled ? { inboxDockEnabled: true } : { inboxDockEnabled: false, inboxDockOpen: false }),
      setLightweightInboxEnabled: (enabled) => set({ lightweightInboxEnabled: enabled }),
      setLightweightInboxReplyLimit: (limit) => set({ lightweightInboxReplyLimit: Number.isFinite(limit) ? Math.min(50, Math.max(1, Math.floor(limit))) : 6 }),
      setInboxDockOpen: (open) => set({ inboxDockOpen: open }),
      setInboxDockSize: (size) =>
        set({ inboxDockSize: Math.min(70, Math.max(0, size)) }),
      setAgentStatusHubEnabled: (enabled) => set({ agentStatusHubEnabled: enabled }),
      setInterfaceMotionEnabled: (enabled) => set({ interfaceMotionEnabled: enabled }),
      setSidebarFontSize: (size) => set({ sidebarFontSize: size }),
      setLiworkMonitorEnabled: (enabled) => set({ liworkMonitorEnabled: enabled }),
      setPinnedIssueCacheEnabled: (enabled) => set({ pinnedIssueCacheEnabled: enabled }),
    }),
    {
      name: "multica_desktop_prefs",
      version: 10,
      migrate: (persistedState) => {
        const state = persistedState as Partial<DesktopPrefsStore>;
        return {
          ...state,
          singleTabMode: state.singleTabMode ?? false,
          inboxDockEnabled: state.inboxDockEnabled ?? false,
          lightweightInboxEnabled: state.lightweightInboxEnabled ?? true,
          lightweightInboxReplyLimit: typeof state.lightweightInboxReplyLimit === "number" && Number.isFinite(state.lightweightInboxReplyLimit) ? Math.min(50, Math.max(1, Math.floor(state.lightweightInboxReplyLimit))) : 6,
          inboxDockOpen: state.inboxDockOpen ?? false,
          inboxDockSize: state.inboxDockSize ?? 38,
          agentStatusHubEnabled: state.agentStatusHubEnabled ?? true,
          interfaceMotionEnabled: state.interfaceMotionEnabled ?? false,
          sidebarFontSize: state.sidebarFontSize === "small" || state.sidebarFontSize === "large" ? state.sidebarFontSize : "standard",
          liworkMonitorEnabled: state.liworkMonitorEnabled ?? true,
          pinnedIssueCacheEnabled: state.pinnedIssueCacheEnabled ?? true,
        } as DesktopPrefsStore;
      },
    },
  ),
);

/** Non-hook read for imperative call sites (navigation adapter, shortcuts). */
export function isSingleTabMode(): boolean {
  return useDesktopPrefsStore.getState().singleTabMode;
}
