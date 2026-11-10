"use client";
import { createContext, createElement, useContext, type ReactNode } from "react";
import { useActorName } from "./hooks";

type ActorDirectory = ReturnType<typeof useActorName>;
const ActorDirectoryContext = createContext<ActorDirectory | null>(null);

function ActorDirectoryProvider({ children }: { children: ReactNode }) {
  const directory = useActorName();
  return createElement(ActorDirectoryContext.Provider, { value: directory }, children);
}

export function ActorDirectoryBoundary({ children }: { children: ReactNode }) {
  const parent = useContext(ActorDirectoryContext);
  return parent ? children : createElement(ActorDirectoryProvider, null, children);
}

export function useActorDirectory(): ActorDirectory {
  const directory = useContext(ActorDirectoryContext);
  if (!directory) throw new Error("useActorDirectory requires ActorDirectoryBoundary");
  return directory;
}
