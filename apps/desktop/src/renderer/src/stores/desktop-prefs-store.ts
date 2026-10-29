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
  /** Restore the bottom Inbox dock's expanded/collapsed state. */
  inboxDockOpen: boolean;
  /** Last expanded Inbox dock height as a percentage of the canvas. */
  inboxDockSize: number;
  /** Show the active-agent status hub in the sidebar. */
  agentStatusHubEnabled: boolean;
  setSingleTabMode: (enabled: boolean) => void;
  setInboxDockEnabled: (enabled: boolean) => void;
  setInboxDockOpen: (open: boolean) => void;
  setInboxDockSize: (size: number) => void;
  setAgentStatusHubEnabled: (enabled: boolean) => void;
}

export const useDesktopPrefsStore = create<DesktopPrefsStore>()(
  persist(
    (set) => ({
      singleTabMode: false,
      inboxDockEnabled: false,
      inboxDockOpen: false,
      inboxDockSize: 38,
      agentStatusHubEnabled: true,
      setSingleTabMode: (enabled) => set({ singleTabMode: enabled }),
      setInboxDockEnabled: (enabled) =>
        set(enabled ? { inboxDockEnabled: true } : { inboxDockEnabled: false, inboxDockOpen: false }),
      setInboxDockOpen: (open) => set({ inboxDockOpen: open }),
      setInboxDockSize: (size) =>
        set({ inboxDockSize: Math.min(70, Math.max(0, size)) }),
      setAgentStatusHubEnabled: (enabled) => set({ agentStatusHubEnabled: enabled }),
    }),
    {
      name: "multica_desktop_prefs",
      version: 4,
      migrate: (persistedState) => {
        const state = persistedState as Partial<DesktopPrefsStore>;
        return {
          ...state,
          singleTabMode: state.singleTabMode ?? false,
          inboxDockEnabled: state.inboxDockEnabled ?? false,
          inboxDockOpen: state.inboxDockOpen ?? false,
          inboxDockSize: state.inboxDockSize ?? 38,
          agentStatusHubEnabled: state.agentStatusHubEnabled ?? true,
        } as DesktopPrefsStore;
      },
    },
  ),
);

/** Non-hook read for imperative call sites (navigation adapter, shortcuts). */
export function isSingleTabMode(): boolean {
  return useDesktopPrefsStore.getState().singleTabMode;
}
