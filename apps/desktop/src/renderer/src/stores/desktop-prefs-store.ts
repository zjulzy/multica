import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Desktop-only UI preferences. Renderer-local (localStorage) because every
 * consumer lives in the renderer; nothing in main needs them.
 */
interface DesktopPrefsStore {
  /** Hide the tab strip and route every "open in new tab" in place. */
  singleTabMode: boolean;
  setSingleTabMode: (enabled: boolean) => void;
}

export const useDesktopPrefsStore = create<DesktopPrefsStore>()(
  persist(
    (set) => ({
      singleTabMode: false,
      setSingleTabMode: (enabled) => set({ singleTabMode: enabled }),
    }),
    { name: "multica_desktop_prefs", version: 1 },
  ),
);

/** Non-hook read for imperative call sites (navigation adapter, shortcuts). */
export function isSingleTabMode(): boolean {
  return useDesktopPrefsStore.getState().singleTabMode;
}
