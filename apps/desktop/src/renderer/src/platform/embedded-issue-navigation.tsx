import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NavigationProvider, type NavigationAdapter } from "@multica/views/navigation";
import { embeddedIssueNavigation } from "../../../shared/embedded-issue-navigation";
type Result = NonNullable<ReturnType<typeof embeddedIssueNavigation>> | { kind: "back" };
export function EmbeddedIssueNavigationProvider({ workspaceSlug, issueRefs, appUrl, send, children }: { workspaceSlug: string; issueRefs: readonly string[]; appUrl: string; send: (message: Result) => void; children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const route = useCallback((path: string, mode: "push" | "replace") => {
    const message = embeddedIssueNavigation({ workspaceSlug, issueRefs }, path, mode);
    if (!message) return;
    if (message.kind === "current-issue") void navigate(message.path, { replace: message.replace });
    send(message);
  }, [workspaceSlug, issueRefs, navigate, send]);
  useEffect(() => {
    const handler = (event: Event) => {
      const path = (event as CustomEvent<{ path?: unknown }>).detail?.path;
      if (typeof path === "string") route(path, "push");
    };
    window.addEventListener("multica:navigate", handler);
    return () => window.removeEventListener("multica:navigate", handler);
  }, [route]);
  const adapter = useMemo<NavigationAdapter>(() => ({
    pathname: location.pathname,
    searchParams: new URLSearchParams(location.search),
    hash: location.hash,
    push: (path) => route(path, "push"),
    replace: (path) => route(path, "replace"),
    back: () => send({ kind: "back" }),
    openInNewTab: (path) => route(path, "push"),
    getShareableUrl: (path) => `${appUrl.replace(/\/$/, "")}${path}`,
  }), [location.pathname, location.search, location.hash, route, send, appUrl]);
  return <NavigationProvider value={adapter}>{children}</NavigationProvider>;
}
