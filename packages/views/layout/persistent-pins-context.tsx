"use client";

import { createContext, useContext, type ReactNode } from "react";

const PersistentPinsContext = createContext(false);

export function PersistentPinsProvider({ children }: { children: ReactNode }) {
  return <PersistentPinsContext.Provider value>{children}</PersistentPinsContext.Provider>;
}

export function usePersistentPins() {
  return useContext(PersistentPinsContext);
}
