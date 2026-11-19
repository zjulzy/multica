import { createContext, useContext, type ReactNode } from "react";

const EmbeddedHeaderMode = createContext(false);
export function EmbeddedHeaderModeProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <EmbeddedHeaderMode.Provider value={enabled}>{children}</EmbeddedHeaderMode.Provider>;
}
export function useEmbeddedHeaderMode() { return useContext(EmbeddedHeaderMode); }
