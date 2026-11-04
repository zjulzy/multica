import { createContext, useContext, type ReactNode } from "react";

const ChatDockVisibility = createContext(false);
export function ChatDockVisibilityProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <ChatDockVisibility.Provider value={value}>{children}</ChatDockVisibility.Provider>;
}
export function useChatDockVisible() { return useContext(ChatDockVisibility); }
