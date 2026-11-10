import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createMemoryRouter,
  RouterProvider,
  useParams,
  useRouteError,
} from "react-router-dom";
import { AlertTriangle, RotateCw, X } from "@multica/ui/icons";
import { useAuthStore } from "@multica/core/auth";
import { setCurrentWorkspace } from "@multica/core/platform";
import { WorkspaceSlugProvider } from "@multica/core/paths";
import { useWorkspaceList } from "@multica/core/workspace";
import { Button } from "@multica/ui/components/ui/button";
import { MulticaIcon } from "@multica/ui/components/common/multica-icon";
import { ModalRegistry } from "@multica/views/modals/registry";
import { WorkspacePresencePrefetch } from "@multica/views/layout";
import { DragStrip } from "@multica/views/platform";
import { parseIssueWindowRequest, type IssueWindowContext } from "../../../shared/issue-window";
import { DesktopAuthRecoveryPage } from "../pages/auth-recovery";
import { IssueDetailPage } from "../pages/issue-detail-page";
import { IssueWindowNavigationProvider } from "../platform/issue-window-navigation";
import { EmbeddedIssueNavigationProvider } from "../platform/embedded-issue-navigation";
import { useCanonicalIssue } from "@multica/core/issues/canonical-id";
import { parseEmbeddedIssuePresentation, type EmbeddedIssuePresentation } from "../../../shared/embedded-issue-presentation";
import { useQueryClient } from "@tanstack/react-query";
import { createEmbeddedChildRefresh } from "./embedded-child-refresh";

/** Boot auth, workspace and shared issue dependencies before assignment. */
export function EmbeddedPoolWindow({ context }: { context: IssueWindowContext }) {
  const [assigned, setAssigned] = useState<IssueWindowContext | null>(null);
  const sent = useRef(false);
  const { workspaces, ready, unavailable } = useWorkspaceList({ enabled: true });
  const workspace = workspaces.find((item) => item.slug === context.workspaceSlug);
  if (workspace) setCurrentWorkspace(context.workspaceSlug, workspace.id);
  useEffect(() => window.desktopAPI.onEmbeddedPoolAssigned((raw) => {
    const next = parseIssueWindowRequest(raw);
    if (next && next.workspaceSlug === context.workspaceSlug) setAssigned(next);
  }), [context.workspaceSlug]);
  useEffect(() => {
    if (!assigned && ready && !unavailable && workspace && !sent.current) {
      sent.current = true;
      window.desktopAPI.sendEmbeddedPoolReady();
    }
  }, [assigned, ready, unavailable, workspace]);
  if (assigned) return <IssueWindow context={assigned} />;
  return workspace ? <WorkspaceSlugProvider slug={context.workspaceSlug}><WorkspacePresencePrefetch /></WorkspaceSlugProvider> : null;
}

export function IssueWindow({ context }: { context: IssueWindowContext }) {
  const router = useMemo(
    () =>
      createMemoryRouter(
        [
          {
            path: ":workspaceSlug/issues/:id",
            element: <IssueWindowRoute />,
            errorElement: <IssueWindowRouteError />,
          },
        ],
        { initialEntries: [context.path] },
      ),
    [context.path],
  );

  return <RouterProvider router={router} />;
}

function IssueWindowRoute() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const user = useAuthStore((state) => state.user);
  const { workspaces, ready, unavailable, isFetching, refetch } =
    useWorkspaceList({
      enabled: !!user && !!workspaceSlug,
    });
  const workspace = workspaces.find((item) => item.slug === workspaceSlug);

  if (workspace && workspaceSlug) {
    setCurrentWorkspace(workspaceSlug, workspace.id);
  }

  if (unavailable) {
    return (
      <DesktopAuthRecoveryPage
        isRetrying={isFetching}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (!ready) {
    return (
      <IssueWindowFrame>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <MulticaIcon mode="launch" size={40} />
        </div>
      </IssueWindowFrame>
    );
  }

  if (!workspace || !workspaceSlug) {
    return <IssueWindowUnavailable />;
  }

  return (
    <WorkspaceSlugProvider slug={workspaceSlug}>
      {window.desktopAPI.isEmbeddedIssue ? <EmbeddedIssueContent workspaceSlug={workspaceSlug} workspaceId={workspace.id} /> : <IssueWindowNavigationProvider>
        <WorkspacePresencePrefetch />
        <IssueWindowFrame>
          <IssueDetailPage onDelete={() => window.desktopAPI.closeWindow()} />
        </IssueWindowFrame>
        <ModalRegistry />
      </IssueWindowNavigationProvider>}
    </WorkspaceSlugProvider>
  );
}

function EmbeddedIssueContent({ workspaceSlug, workspaceId }: { workspaceSlug: string; workspaceId: string }) {
  const { id = "" } = useParams<{ id: string }>();
  const { canonicalId, issue } = useCanonicalIssue(workspaceId, id);
  const queryClient = useQueryClient();
  const refreshChildren = useMemo(() => canonicalId ? createEmbeddedChildRefresh(queryClient, workspaceId, canonicalId) : null, [queryClient, workspaceId, canonicalId]);
  const refs = useMemo(() => [id, canonicalId, issue?.identifier].filter((value): value is string => !!value), [id, canonicalId, issue?.identifier]);
  const notifyReady = useCallback(() => window.desktopAPI.sendEmbeddedGuestReady(), []);
  const [presentation, setPresentation] = useState<EmbeddedIssuePresentation>({ surface: "main" });
  useEffect(() => window.desktopAPI.onEmbeddedGuestPresentation((raw) => {
    const next = parseEmbeddedIssuePresentation(raw);
    if (next) { setPresentation(next); void refreshChildren?.(); }
  }), [refreshChildren]);
  const navigate = useCallback((message: Parameters<typeof window.desktopAPI.sendEmbeddedIssueNavigation>[0]) => {
    if (presentation.surface !== "main" && message && typeof message === "object" && "kind" in message && message.kind === "current-issue") return;
    window.desktopAPI.sendEmbeddedIssueNavigation(message);
  }, [presentation.surface]);
  const config = window.desktopAPI.runtimeConfig;
  return <EmbeddedIssueNavigationProvider workspaceSlug={workspaceSlug} issueRefs={refs} appUrl={config.ok ? config.config.appUrl : ""} send={navigate}>
    <WorkspacePresencePrefetch />
    <IssueWindowFrame embedded><IssueDetailPage onInitialContentReady={notifyReady}
      inboxPresentation={presentation.surface === "main" ? undefined : { surface: presentation.surface, highlightCommentId: presentation.highlightCommentId, highlightRequestToken: presentation.highlightRequestToken }}
      onDone={presentation.surface === "main" ? undefined : () => window.desktopAPI.sendEmbeddedGuestAction("done")}
      onDelete={() => presentation.surface === "main" ? window.desktopAPI.sendEmbeddedIssueNavigation({ kind: "back" }) : window.desktopAPI.sendEmbeddedGuestAction("delete")} /></IssueWindowFrame>
    <ModalRegistry />
  </EmbeddedIssueNavigationProvider>;
}

function IssueWindowFrame({ children, embedded = false }: { children: React.ReactNode; embedded?: boolean }) {
  return (
    <div
      data-dedicated-issue-window="true"
      className="flex h-screen min-h-0 flex-col bg-page-canvas text-foreground"
    >
      {!embedded && <DragStrip />}
      <div className="flex min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

function IssueWindowUnavailable() {
  return (
    <IssueWindowFrame>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-full bg-muted p-3 text-muted-foreground">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h1 className="text-title font-semibold">Issue unavailable</h1>
          <p className="text-body text-muted-foreground">
            This workspace is no longer available in your account.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.desktopAPI.closeWindow()}>
          Close window
        </Button>
      </div>
    </IssueWindowFrame>
  );
}

function IssueWindowRouteError() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Unknown route error";

  return (
    <IssueWindowFrame>
      <div
        role="alert"
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
      >
        <div className="rounded-full bg-destructive/10 p-3 text-destructive">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h1 className="text-title font-semibold">Something went wrong</h1>
          <p className="max-w-lg truncate text-body text-muted-foreground">
            {message}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RotateCw className="size-4" aria-hidden="true" />
            Reload
          </Button>
          <Button variant="outline" onClick={() => window.desktopAPI.closeWindow()}>
            <X className="size-4" aria-hidden="true" />
            Close window
          </Button>
        </div>
      </div>
    </IssueWindowFrame>
  );
}
