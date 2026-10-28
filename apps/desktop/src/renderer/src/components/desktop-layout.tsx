import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@multica/ui/lib/utils";
import { MulticaIcon } from "@multica/ui/components/common/multica-icon";
import {
  useNavigationInputBindings,
  useTabHistory,
} from "@/hooks/use-tab-history";
import {
  SidebarProvider,
  useSidebar,
} from "@multica/ui/components/ui/sidebar";
import { ModalRegistry } from "@multica/views/modals/registry";
import {
  AppSidebar,
  GlobalShortcuts,
  NavigationProgress,
  PageHeaderPortalProvider,
  ResourceLeadingVisual,
  useTabPresentation,
} from "@multica/views/layout";
import { useActiveTabUrl } from "@/stores/tab-store";
import { SearchCommand, SearchTrigger } from "@multica/views/search";
import { FloatingChat } from "@multica/views/chat";
import { WorkspaceSlugProvider, paths, useCurrentWorkspace } from "@multica/core/paths";
import { workspaceListOptions } from "@multica/core/workspace";
import {
  useNavigation,
  type LinkClickIntent,
} from "@multica/views/navigation";
import { getCurrentSlug, subscribeToCurrentSlug } from "@multica/core/platform";
import { useDesktopUnreadBadge } from "@multica/views/platform";
import { useT } from "@multica/views/i18n";
import {
  DesktopNavigationProvider,
  routeContentLinkPath,
} from "@/platform/navigation";
import { TabBar } from "./tab-bar";
import { TabContent } from "./tab-content";
import { WindowOverlay } from "./window-overlay";
import { WindowToolbar, windowToolbarClearance } from "./window-toolbar";
import { DesktopInboxDockLayout } from "./inbox-dock";
import { isWindowsDesktop, WINDOWS_CONTROLS_CLEARANCE } from "@/platform/desktop-os";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";

// Tabbed: 40px; single-tab mode: 48px (page-header height). Keep in sync with
// TOP_BAR_HEIGHT_* in platform/title-bar-overlay-sync.tsx and window-toolbar.tsx.
function useTopBarHeightClass(): string {
  const singleTabMode = useDesktopPrefsStore((s) => s.singleTabMode);
  return singleTabMode ? "h-12" : "h-10";
}
const toolbarMotion = {
  type: "spring",
  stiffness: 420,
  damping: 38,
  mass: 0.8,
} as const;

function SidebarTopSpacer() {
  return <div className={cn("shrink-0", useTopBarHeightClass())} />;
}

function useNativeNavigationGestures() {
  const { goBack, goForward } = useTabHistory();

  useEffect(() => {
    return window.desktopAPI.onNavigationGesture((gesture) => {
      if (gesture === "back") {
        goBack();
      } else {
        goForward();
      }
    });
  }, [goBack, goForward]);
}


// The main area's top bar doubles as a window drag region. When the sidebar
// is not occupying enough main-flow width, leave the remainder here so tabs
// do not land beneath the traffic lights / navigation controls. The matching
// 200ms transition cancels the sidebar gap's movement during toggle; live
// resize previews disable it through data-sidebar-resize-consumer.
function MainTopBar({
  sidebarMounted,
  headerSlotRef,
}: {
  sidebarMounted: boolean;
  /** Single-tab mode: where page headers portal their breadcrumb/actions. */
  headerSlotRef: (el: HTMLDivElement | null) => void;
}) {
  const { state, isCompact } = useSidebar();
  const sidebarHidden = !sidebarMounted || state === "collapsed" || isCompact;
  const clearance = windowToolbarClearance();
  const toolbarClearance: React.CSSProperties["paddingLeft"] = sidebarHidden
    ? clearance
    : `max(0px, calc(${clearance}px - var(--sidebar-live-width, var(--sidebar-width))))`;
  // Windows draws the native window buttons over the top-right corner; keep
  // tabs and the "+" button out from under them. The drag region still
  // extends to the edge so the strip stays grabbable.
  const controlsClearance = isWindowsDesktop() ? WINDOWS_CONTROLS_CLEARANCE : 0;
  // Single-tab mode keeps the bar (drag region, nav buttons, Windows window
  // controls) and drops only the strip itself.
  const singleTabMode = useDesktopPrefsStore((s) => s.singleTabMode);
  const topBarHeightClass = useTopBarHeightClass();

  return (
    <header
      data-slot="main-top-bar"
      data-testid="main-top-bar"
      data-sidebar-resize-consumer
      className={cn(
        "relative shrink-0 flex items-center gap-2 transition-[padding-left] duration-200 ease-out motion-reduce:transition-none",
        topBarHeightClass,
      )}
      style={{ paddingLeft: toolbarClearance, paddingRight: controlsClearance }}
    >
      <div
        aria-hidden
        className="absolute inset-y-0 right-0"
        style={
          {
            left: toolbarClearance,
            WebkitAppRegion: "drag",
          } as React.CSSProperties
        }
      />
      <div
        data-slot="main-top-bar-content"
        className="relative z-10 flex h-full min-w-0 max-w-full flex-1 items-center"
      >
        {singleTabMode ? (
          <SingleTabHeaderSlot headerSlotRef={headerSlotRef} />
        ) : (
          <TabBar />
        )}
      </div>
    </header>
  );
}

// Single-tab mode: the top bar hosts the page header (breadcrumb + actions)
// through a portal. A leading visual derived from the active URL — the same
// icon/status the tab strip would show — makes it read as a title bar rather
// than a bare breadcrumb.
function SingleTabHeaderSlot({
  headerSlotRef,
}: {
  headerSlotRef: (el: HTMLDivElement | null) => void;
}) {
  const activeUrl = useActiveTabUrl();
  const { visual } = useTabPresentation(activeUrl ?? "");
  return (
    <div className="group/slot flex h-full min-w-0 flex-1 items-center gap-2.5 px-4">
      {/* Collection headers bring their own icon (data-page-header-icon);
          hide ours so the bar never shows two. */}
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-muted-foreground group-has-[[data-page-header-icon]]/slot:hidden"
      >
        <ResourceLeadingVisual visual={visual} />
      </span>
      <div
        ref={headerSlotRef}
        data-slot="page-header-slot"
        className="flex h-full min-w-0 flex-1 items-center text-[15px] [&_h1]:font-semibold [&_.font-medium]:font-semibold"
      />
    </div>
  );
}

// The canvas hugs the expanded sidebar with a hairline gap. When the sidebar
// leaves the main flow, the left margin must grow to mirror the fixed mr-2 so
// the floating canvas sits symmetrically inside the window frame.
function MainCanvas({
  children,
  showWorkspaceLoading,
}: {
  children: React.ReactNode;
  showWorkspaceLoading: boolean;
}) {
  const { state, isCompact } = useSidebar();
  const { t } = useT("layout");
  const sidebarHidden = state === "collapsed" || isCompact;
  const loadingLabel = t(($) => $.workspace_loader.loading_workspace);

  return (
    <motion.div
      animate={{ marginLeft: sidebarHidden ? 8 : 2 }}
      className="relative flex flex-1 min-h-0 flex-col overflow-hidden mr-2 mb-2 rounded-xl bg-page-canvas ring-1 ring-surface-border shadow-[var(--surface-shadow)]"
      initial={false}
      transition={toolbarMotion}
    >
      {children}
      {showWorkspaceLoading && (
        <div
          aria-label={loadingLabel}
          aria-live="polite"
          className="absolute inset-0 z-20 flex items-center justify-center bg-page-canvas"
          role="status"
        >
          <div className="flex flex-col items-center gap-4">
            <MulticaIcon className="size-8 animate-pulse" />
            <p className="text-body text-muted-foreground">{loadingLabel}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function useInternalLinkHandler() {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (
        e as CustomEvent<{ path?: string; disposition?: LinkClickIntent }>
      ).detail;
      if (!detail?.path) return;
      routeContentLinkPath(detail.path, detail.disposition);
    };
    window.addEventListener("multica:navigate", handler);
    return () => window.removeEventListener("multica:navigate", handler);
  }, []);
}

/**
 * Bridge between the renderer and the Electron main process for inbox-level
 * OS integration. Mounted inside WorkspaceSlugProvider so it can resolve the
 * current workspace's id for the badge hook.
 *
 * Two responsibilities:
 *   1. Mirror the unread inbox count onto the dock/taskbar badge.
 *   2. When the user clicks an OS notification, open the notified
 *      workspace's inbox focused on that item. The route uses the `slug`
 *      that the notification was *emitted* with — not the currently active
 *      workspace — so a notification from workspace A always opens A's
 *      inbox even if the user has since switched to workspace B. Marking
 *      the row read is handled by InboxPage's selected-item effect, which
 *      covers both click-to-select and URL-param-select paths.
 *
 * The click routes through `useNavigation().push` — NOT the
 * `multica:navigate` event, whose handler `openTab`s into the ACTIVE
 * workspace's tab group. The navigation adapter detects a cross-workspace
 * path and translates it into `switchWorkspace(slug, path)`, so clicking a
 * workspace-A notification while B is active performs a real workspace
 * switch instead of mounting A's inbox inside B's tab group (#3766).
 */
function DesktopInboxBridge() {
  const workspace = useCurrentWorkspace();
  useDesktopUnreadBadge(workspace?.id ?? null);
  const { push } = useNavigation();
  // The adapter identity changes with the active tab's location; the ref
  // keeps the main-process subscription stable across navigations.
  const pushRef = useRef(push);
  useEffect(() => {
    pushRef.current = push;
  }, [push]);

  useEffect(() => {
    return window.desktopAPI.onInboxOpen(({ slug, issueKey }) => {
      if (!slug) return;
      const inboxPath = `${paths.workspace(slug).inbox()}?issue=${encodeURIComponent(issueKey)}`;
      pushRef.current(inboxPath);
    });
  }, []);

  return null;
}

export function DesktopShell() {
  useInternalLinkHandler();
  useNativeNavigationGestures();
  useNavigationInputBindings();

  // Reactive read of current workspace slug from the platform singleton.
  // On first mount, it is null until WorkspaceRouteLayout (inside the tab
  // router) sets it. Once set, the sidebar and other shell-level components
  // can resolve workspace-scoped paths via useWorkspacePaths().
  const currentSlug = useSyncExternalStore(
    subscribeToCurrentSlug,
    getCurrentSlug,
    () => null,
  );
  // Chrome gates on "the slug still resolves to a workspace", NOT on "the
  // singleton is non-null" (MUL-6231 / #7021). The singleton is mutable
  // process state that no single owner keeps in lockstep with the workspace
  // list, so after the active workspace is deleted it can still hold the dead
  // slug for a beat. Everything below mounts workspace-scoped components —
  // SearchCommand calls useWorkspaceId(), which THROWS when the workspace is
  // gone from the list. Nothing above this in the desktop tree is an error
  // boundary, so that throw used to unmount the whole renderer and leave a
  // blank, unresponsive window.
  //
  // Deriving from the list cache makes this the same gate web uses
  // (DashboardGuard's `!workspace` check in packages/views/layout), so both
  // shells drop workspace-scoped chrome on exactly the same signal instead of
  // diverging. TabContent stays outside the gate: it must always render so
  // the tab router can mount WorkspaceRouteLayout, which is what populates
  // the singleton in the first place.
  const { data: workspaces = [] } = useQuery(workspaceListOptions());
  const resolvedWorkspace = currentSlug
    ? workspaces.find((workspace) => workspace.slug === currentSlug) ?? null
    : null;
  const slug = resolvedWorkspace?.slug ?? null;
  // Single-tab mode: page headers render into the top bar instead of the
  // page. The slot element lives in MainTopBar; pages read it via context.
  const singleTabMode = useDesktopPrefsStore((s) => s.singleTabMode);
  const inboxDockEnabled = useDesktopPrefsStore((s) => s.inboxDockEnabled);
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);

  return (
    <DesktopNavigationProvider>
      {/* WorkspaceSlugProvider accepts null — components that need slug
          use useWorkspaceSlug() (nullable) or useRequiredWorkspaceSlug()
          (throws). TabContent MUST always render so the tab router can
          mount WorkspaceRouteLayout, which calls setCurrentWorkspace()
          to populate the slug. The sidebar gates on the resolved slug
          (see above) to avoid the useRequiredWorkspaceSlug and
          useWorkspaceId throws. Zero-workspace users see the
          window-level overlay (new-workspace flow) triggered by
          IndexRedirect, not a route. */}
      <WorkspaceSlugProvider slug={slug}>
        <DesktopInboxBridge />
        <div className="flex h-screen bg-app-shell">
          {/* bg-app-shell is the wrapper's non-inset fill, so it also owns the
              non-inset half of --sidebar-wrapper-fill. sidebar.tsx supplies the
              inset half of both. Anything that has to paint an opaque layer
              over this wrapper (the tab flares) reads the variable rather than
              re-deriving which of the two is in play. */}
          {/* hasExternalTrigger: WindowToolbar below parks a SidebarTrigger
              beside the traffic lights, where it is always reachable. Page
              headers inside the canvas must not add their own fallback one on
              top of it — desktop windows sit below `xl`, exactly where that
              fallback renders, so every page showed a second identical icon
              50px under this one (MUL-6218). */}
          <SidebarProvider
            hasExternalTrigger
            className="flex-1 bg-app-shell [--sidebar-wrapper-fill:var(--app-shell)]"
          >
            {slug && <GlobalShortcuts />}
            {slug && <WindowToolbar />}
            {slug && (
              <AppSidebar
                hideInboxNav={inboxDockEnabled}
                topSlot={<SidebarTopSpacer />}
                searchSlot={<SearchTrigger />}
              />
            )}
            {/* Right side: header + content container */}
            <div className="flex flex-1 min-w-0 flex-col">
              <MainTopBar
                sidebarMounted={Boolean(slug)}
                headerSlotRef={setHeaderSlot}
              />
              <MainCanvas showWorkspaceLoading={!slug}>
                {/* Same indicator, same anchor as web: DashboardLayout puts it
                    at the top of SidebarInset, and MainCanvas is desktop's
                    equivalent relative/overflow-hidden content box. Desktop
                    used to have no navigation feedback at all — a click just
                    froze until the destination committed (MUL-6404). */}
                <NavigationProgress />
                <DesktopInboxDockLayout
                  enabled={inboxDockEnabled}
                  workspaceId={resolvedWorkspace?.id ?? null}
                >
                  <PageHeaderPortalProvider value={singleTabMode ? headerSlot : null}>
                    <TabContent />
                  </PageHeaderPortalProvider>
                </DesktopInboxDockLayout>
                {slug && <FloatingChat />}
              </MainCanvas>
            </div>
          </SidebarProvider>
        </div>
        {slug && <ModalRegistry />}
        {slug && <SearchCommand />}
        <WindowOverlay />
      </WorkspaceSlugProvider>
    </DesktopNavigationProvider>
  );
}
