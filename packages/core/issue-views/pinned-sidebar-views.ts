import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { defaultStorage } from "../platform/storage";

interface PinnedSidebarViews {
  byScope: Record<string, string[]>;
  orderByScope: Record<string, string[]>;
  pin: (scope: string, id: string) => void;
  unpin: (scope: string, id: string) => void;
  reorder: (scope: string, ids: string[]) => void;
  reorderAll: (scope: string, ids: string[]) => void;
}

export const usePinnedSidebarViews = create<PinnedSidebarViews>()(persist((set) => ({
  byScope: {},
  orderByScope: {},
  pin: (scope, id) => set((state) => {
    const current = state.byScope[scope] ?? [];
    return current.includes(id) ? state : { byScope: { ...state.byScope, [scope]: [...current, id] } };
  }),
  unpin: (scope, id) => set((state) => ({ byScope: { ...state.byScope, [scope]: (state.byScope[scope] ?? []).filter((value) => value !== id) } })),
  reorder: (scope, ids) => set((state) => ({ byScope: { ...state.byScope, [scope]: [...new Set(ids)] } })),
  reorderAll: (scope, ids) => set((state) => ({ orderByScope: { ...state.orderByScope, [scope]: [...new Set(ids)] } })),
}), { name: "multica-pinned-sidebar-views", storage: createJSONStorage(() => defaultStorage) }));

export const pinnedViewScope = (server: string, workspaceId: string, userId: string) => JSON.stringify([server, workspaceId, userId]);
