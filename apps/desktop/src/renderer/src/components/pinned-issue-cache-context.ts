import { createContext, useContext } from "react";
export interface PinnedIssueCacheSnapshot { enabled: boolean; workspaceId: string; pinnedIds: ReadonlySet<string> }
export const PinnedIssueCacheContext = createContext<PinnedIssueCacheSnapshot | null>(null);
export function usePinnedIssueCacheSnapshot() { return useContext(PinnedIssueCacheContext); }
