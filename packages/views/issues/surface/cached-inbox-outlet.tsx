"use client";
import { createContext, useContext, type ReactNode } from "react";

export type CachedInboxOutletProps = {
  issueId: string;
  workspaceId: string;
  source: "page" | "dock";
  active: boolean;
  cacheAllowed?: boolean;
  interactive?: boolean;
  highlightCommentId?: string;
  highlightRequestToken?: number;
  onDone: () => void;
  onDelete: () => void;
  children: ReactNode;
};
type Renderer = (props: CachedInboxOutletProps) => ReactNode;
const Context = createContext<Renderer | null>(null);
export const CachedInboxOutletProvider = Context.Provider;
export function CachedInboxOutlet(props: CachedInboxOutletProps) {
  const render = useContext(Context);
  return render ? render(props) : props.children;
}
