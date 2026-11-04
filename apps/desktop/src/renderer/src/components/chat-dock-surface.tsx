import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@multica/core/api";
import { chatKeys } from "@multica/core/chat/queries";
import { getCurrentSlug, getCurrentWsId } from "@multica/core/platform";
import { useT } from "@multica/views/i18n";
import { Button } from "@multica/ui/components/ui/button";
import { toast } from "sonner";
import { ChatPage } from "@multica/views/chat";
import { AppShellProvider } from "@multica/views/layout";
import { NavigationProvider, useNavigation, type NavigationAdapter } from "@multica/views/navigation";

/** A chat-specific location; selecting a thread must not navigate the main tab. */
export function ChatDockSurface({ workspaceId, workspaceSlug, path, onPathChange, visible, validateSession = false, validationId = 0, onValidated }: {
  workspaceId: string;
  workspaceSlug: string;
  path: string;
  onPathChange: (path: string, expectedRequestId?: number) => void;
  visible: boolean;
  validateSession?: boolean;
  validationId?: number;
  onValidated?: (path: string, requestId: number) => void;
}) {
  const { t } = useT("chat");
  const queryClient = useQueryClient();
  const parent = useNavigation();
  const chatPath = `/${encodeURIComponent(workspaceSlug)}/chat`;
  const parsed = new URL(path, "https://multica.invalid");
  const sessionId = parsed.searchParams.get("session");
  const mustVerify = !!(validateSession && sessionId);
  const targetRef = useRef<{ path: string; validationId: number; visible: boolean } | null>(null);
  targetRef.current = { path, validationId, visible };
  useEffect(() => {
    targetRef.current = { path, validationId, visible };
    return () => { targetRef.current = null; };
  }, [path, validationId, visible]);
  const verification = useQuery({
    queryKey: ["chat-dock-target", workspaceId, workspaceSlug, sessionId, validationId],
    enabled: visible && mustVerify,
    retry: false,
    queryFn: async () => {
      const [session, sessions] = await Promise.all([
        api.getChatSession(sessionId!, workspaceSlug),
        api.listChatSessions({ status: "all" }, workspaceSlug),
      ]);
      if (session.id !== sessionId) throw new Error("Invalid chat session response");
      if (session.workspace_id !== workspaceId) throw Object.assign(new Error("Wrong workspace"), { status: 403 });
      if (getCurrentWsId() !== workspaceId || getCurrentSlug() !== workspaceSlug) throw new Error("Workspace changed");
      if (!targetRef.current?.visible || targetRef.current.path !== path || targetRef.current.validationId !== validationId) throw new Error("Chat target changed");
      queryClient.setQueryData(chatKeys.sessions(workspaceId), (current: typeof sessions | undefined) => {
        const base = current ?? sessions;
        return base.some((item) => item.id === session.id) ? base : [session, ...base];
      });
      return session;
    },
  });
  const status = (verification.error as { status?: number } | null)?.status;
  const denied = status === 403 || status === 404;
  const handledFailure = useRef<number | null>(null);
  useEffect(() => {
    if (!mustVerify || !verification.isError || !denied || handledFailure.current === validationId) return;
    handledFailure.current = validationId;
    toast.error(t(($) => $.page.session_link_unavailable));
    onPathChange(chatPath, validationId);
  }, [mustVerify, verification.isError, denied, path, t, onPathChange, chatPath, validationId]);
  useEffect(() => {
    if (mustVerify && verification.isSuccess) onValidated?.(path, validationId);
  }, [mustVerify, verification.isSuccess, onValidated, path, validationId]);
  const nav = useMemo<NavigationAdapter>(() => {
    const route = (next: string, replace: boolean) => {
      const url = new URL(next, "https://multica.invalid");
      if (url.pathname === chatPath) onPathChange(`${url.pathname}${url.search}${url.hash}`);
      else if (replace) parent.replace(next);
      else parent.push(next);
    };
    return { ...parent, pathname: parsed.pathname, searchParams: parsed.searchParams, hash: parsed.hash,
      push: (next) => route(next, false), replace: (next) => route(next, true) };
  }, [parent, path, chatPath, onPathChange]);
  if (mustVerify && !verification.isSuccess) {
    if (verification.isError && !denied) return <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-muted-foreground"><p>{t(($) => $.page.session_link_retry_hint)}</p><Button variant="outline" size="sm" onClick={() => void verification.refetch()}>{t(($) => $.page.session_link_retry)}</Button></div>;
    return <div role="status" className="flex flex-1 items-center justify-center text-muted-foreground">{t(($) => $.page.session_link_loading)}</div>;
  }
  return <NavigationProvider value={nav}><AppShellProvider><ChatPage dock visible={visible} /></AppShellProvider></NavigationProvider>;
}
