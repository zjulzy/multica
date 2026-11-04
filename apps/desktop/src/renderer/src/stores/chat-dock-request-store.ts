import { create } from "zustand";

export interface ChatDockRequest { workspaceSlug: string; path: string; id: number }
interface ChatDockRequestState {
  request: ChatDockRequest | null;
  open: (workspaceSlug: string, path: string) => void;
  consume: (id: number) => void;
  clear: () => void;
}
let nextRequestId = 0;
export const useChatDockRequestStore = create<ChatDockRequestState>((set) => ({
  request: null,
  open: (workspaceSlug, path) => set({ request: { workspaceSlug, path, id: ++nextRequestId } }),
  consume: (id) => set((state) => state.request?.id === id ? { request: null } : state),
  clear: () => set({ request: null }),
}));
