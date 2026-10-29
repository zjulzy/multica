import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@multica/core/i18n/react";
import { useSidebar } from "@multica/ui/components/ui/sidebar";
import { RESOURCES } from "@multica/views/locales";

// The shell resolves the mocked `getCurrentSlug()` against the workspace list
// before mounting workspace-scoped chrome, so the list has to contain it or
// the sidebar under test never renders. Gating behaviour itself is covered by
// desktop-layout.workspace-gate.test.tsx.
const WORKSPACES = [{ id: "ws-1", slug: "acme" }];

// The shell is the only thing under test here, so everything it mounts around
// the sidebar is stubbed out. What survives is the pair that has to agree:
// `WindowToolbar`'s own trigger, and the `hasExternalTrigger` the provider
// publishes to every page header inside the canvas.
vi.mock("@/hooks/use-tab-history", () => ({
  useTabHistory: () => ({
    canGoBack: false,
    canGoForward: false,
    historyEntries: [],
    historyIndex: 0,
    browsingHistory: [],
    goBack: vi.fn(),
    goForward: vi.fn(),
    goToHistoryIndex: vi.fn(),
  }),
  useNavigationInputBindings: () => {},
}));

vi.mock("@/platform/navigation", () => ({
  DesktopNavigationProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  routeContentLinkPath: vi.fn(),
}));

vi.mock("@multica/core/paths", () => ({
  WorkspaceSlugProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  paths: { workspace: () => ({ inbox: () => "/acme/inbox" }) },
  useCurrentWorkspace: () => null,
}));

vi.mock("@multica/core/platform", () => ({
  getCurrentSlug: () => "acme",
  subscribeToCurrentSlug: () => () => {},
}));

vi.mock("@multica/core/workspace", () => ({
  workspaceListOptions: () => ({
    queryKey: ["workspace-list"],
    queryFn: async () => WORKSPACES,
  }),
}));

vi.mock("@multica/views/navigation", () => ({
  useNavigation: () => ({ push: vi.fn() }),
}));

vi.mock("@multica/views/platform", () => ({
  useDesktopUnreadBadge: () => {},
}));

vi.mock("@multica/views/layout", () => ({
  AppSidebar: ({ hideInboxNav, showAgentStatusHub, onAgentUnreadOpen }: { hideInboxNav?: boolean; showAgentStatusHub?: boolean; onAgentUnreadOpen?: (workspaceId: string, key: string) => void }) => (
    <div data-testid="app-sidebar" data-hide-inbox={hideInboxNav} data-agent-status-hub={showAgentStatusHub}><button onClick={() => onAgentUnreadOpen?.("ws-1", "issue-9")}>Hub unread</button></div>
  ),
  GlobalShortcuts: () => null,
  NavigationProgress: () => null,
  PageHeaderPortalProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  ResourceLeadingVisual: () => null,
  useTabPresentation: () => ({ visual: { kind: "icon", icon: "issues" }, title: "" }),
}));

vi.mock("@multica/views/modals/registry", () => ({ ModalRegistry: () => null }));
vi.mock("@multica/views/search", () => ({
  SearchCommand: () => null,
  SearchTrigger: () => null,
}));
vi.mock("@multica/views/chat", () => ({ FloatingChat: () => null }));
vi.mock("./tab-bar", () => ({ TabBar: () => <div data-testid="tab-bar" /> }));
vi.mock("./window-overlay", () => ({ WindowOverlay: () => null }));
vi.mock("./inbox-dock", () => ({
  DesktopInboxDockLayout: ({
    children,
    enabled,
    workspaceId,
    openRequest,
    onTemporaryClose,
  }: {
    children: ReactNode;
    enabled: boolean;
    workspaceId: string | null;
    openRequest?: { workspaceId: string; key: string } | null;
    onTemporaryClose?: () => void;
  }) => (
    <div>
      <div>{children}</div>
      {enabled && workspaceId && <div data-testid="inbox-dock-layout" data-workspace-id={workspaceId} data-target={openRequest?.key}>
        <div data-testid="dock-inbox-surface" />
        {onTemporaryClose && <button onClick={onTemporaryClose}>Dismiss temporary dock</button>}
      </div>}
    </div>
  ),
}));

// Stands in for whatever page the active tab is showing. Reports the one fact
// a `PageHeader` reads before deciding to render its own fallback trigger.
vi.mock("./tab-content", () => ({
  TabContent: () => {
    const { hasExternalTrigger, isCompact, setOpen, state } = useSidebar();
    return (
      <div
        data-compact={isCompact}
        data-external-trigger={hasExternalTrigger}
        data-sidebar-state={state}
        data-testid="page-content"
      >
        <button type="button" onClick={() => setOpen(false)}>
          Collapse sidebar
        </button>
        <button type="button" onClick={() => setOpen(true)}>
          Expand sidebar
        </button>
      </div>
    );
  },
}));

const { DesktopShell } = await import("./desktop-layout");

function renderShell() {
  (
    window as unknown as { desktopAPI: Record<string, unknown> }
  ).desktopAPI = {
    onNavigationGesture: () => () => {},
    onInboxOpen: () => () => {},
  };

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  qc.setQueryData(["workspace-list"], WORKSPACES);

  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider locale="en" resources={RESOURCES}>
        <DesktopShell />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1280,
  });
  localStorage.clear();
  useDesktopPrefsStore.setState({
    singleTabMode: false,
    inboxDockEnabled: false,
    inboxDockOpen: false,
    agentStatusHubEnabled: true,
  });
});

describe("DesktopShell sidebar trigger", () => {
  // The window toolbar parks a trigger beside the traffic lights that never
  // scrolls away, so nothing inside the canvas may add a second one. Desktop
  // windows sit below `xl`, exactly the band where `PageHeader`'s fallback
  // trigger renders, so every page used to stack an identical icon 50px under
  // this one — and a third when a list/detail surface brought its own header
  // along (MUL-6218).
  it("keeps exactly one trigger and tells page headers not to add another", () => {
    const { container, getByTestId, queryByRole } = renderShell();

    expect(container.querySelectorAll("[data-slot='sidebar-trigger']")).toHaveLength(1);
    expect(getByTestId("page-content")).toHaveAttribute(
      "data-external-trigger",
      "true",
    );
    const mainTopBar = container.querySelector('[data-slot="main-top-bar"]');
    expect(mainTopBar).toHaveAttribute("data-sidebar-resize-consumer");
    expect(mainTopBar).toHaveClass("transition-[padding-left]");
    expect(mainTopBar).toHaveStyle({
      paddingLeft:
        "max(0px, calc(200px - var(--sidebar-live-width, var(--sidebar-width))))",
    });

    fireEvent.click(
      container.querySelector('[data-slot="sidebar-trigger"]')!,
    );
    expect(mainTopBar).toHaveStyle({ paddingLeft: "200px" });
    expect(queryByRole("status", { name: /loading workspace/i })).toBeNull();
  });

  it("keeps full clearance for compact layouts in either sidebar state", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 700,
    });

    const { container, getByRole, getByTestId } = renderShell();
    const mainTopBar = container.querySelector('[data-slot="main-top-bar"]');

    expect(getByTestId("page-content")).toHaveAttribute("data-compact", "true");
    expect(getByTestId("page-content")).toHaveAttribute(
      "data-sidebar-state",
      "expanded",
    );
    expect(mainTopBar).toHaveStyle({ paddingLeft: "200px" });

    fireEvent.click(getByRole("button", { name: "Collapse sidebar" }));
    expect(getByTestId("page-content")).toHaveAttribute(
      "data-sidebar-state",
      "collapsed",
    );
    expect(mainTopBar).toHaveStyle({ paddingLeft: "200px" });

    fireEvent.click(getByRole("button", { name: "Expand sidebar" }));
    expect(getByTestId("page-content")).toHaveAttribute(
      "data-sidebar-state",
      "expanded",
    );
    expect(mainTopBar).toHaveStyle({ paddingLeft: "200px" });
  });
});

import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";

describe("single-tab mode", () => {
  afterEach(() => useDesktopPrefsStore.setState({ singleTabMode: false }));

  it("renders the tab bar by default", async () => {
    renderShell();
    expect(await screen.findByTestId("tab-bar")).toBeInTheDocument();
  });

  it("hides the tab bar but keeps the top bar when enabled", async () => {
    useDesktopPrefsStore.setState({ singleTabMode: true });
    renderShell();
    expect(await screen.findByTestId("main-top-bar")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-bar")).toBeNull();
  });
});

describe("single-tab mode header slot", () => {
  afterEach(() => useDesktopPrefsStore.setState({ singleTabMode: false }));

  it("offers a page-header slot in the top bar instead of the tab bar", async () => {
    useDesktopPrefsStore.setState({ singleTabMode: true });
    const { container } = renderShell();
    expect(await screen.findByTestId("main-top-bar")).toBeInTheDocument();
    expect(container.querySelector("[data-slot='page-header-slot']")).not.toBeNull();
  });

  it("has no header slot in tabbed mode", async () => {
    const { container } = renderShell();
    expect(await screen.findByTestId("tab-bar")).toBeInTheDocument();
    expect(container.querySelector("[data-slot='page-header-slot']")).toBeNull();
  });
});

describe("Inbox dock integration", () => {
  it("opens the Dock from an unread Hub item without changing the disabled preference or main page", () => {
    renderShell();
    const page = screen.getByTestId("page-content");
    fireEvent.click(screen.getByRole("button", { name: "Hub unread" }));
    expect(screen.getByTestId("inbox-dock-layout")).toHaveAttribute("data-target", "issue-9");
    expect(useDesktopPrefsStore.getState().inboxDockEnabled).toBe(false);
    expect(useDesktopPrefsStore.getState().inboxDockOpen).toBe(false);
    expect(screen.getByTestId("page-content")).toBe(page);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss temporary dock" }));
    expect(screen.queryByTestId("inbox-dock-layout")).not.toBeInTheDocument();
    expect(useDesktopPrefsStore.getState().inboxDockEnabled).toBe(false);
  });

  it("opens a collapsed enabled Dock for the selected Hub item", () => {
    useDesktopPrefsStore.setState({ inboxDockEnabled: true, inboxDockOpen: false });
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Hub unread" }));
    expect(useDesktopPrefsStore.getState().inboxDockOpen).toBe(true);
    expect(screen.getByTestId("inbox-dock-layout")).toHaveAttribute("data-target", "issue-9");
  });
  it("mounts the Dock for the resolved workspace and hides the sidebar Inbox row", () => {
    useDesktopPrefsStore.setState({ inboxDockEnabled: true });

    renderShell();

    expect(screen.getByTestId("inbox-dock-layout")).toHaveAttribute(
      "data-workspace-id",
      "ws-1",
    );
    expect(screen.getByTestId("app-sidebar")).toHaveAttribute("data-hide-inbox", "true");
    expect(screen.getAllByTestId("page-content")).toHaveLength(1);
    expect(screen.getByTestId("dock-inbox-surface")).toBeInTheDocument();
  });

  it("keeps the previous content tree and sidebar entry when disabled", () => {
    renderShell();

    expect(screen.queryByTestId("inbox-dock-layout")).not.toBeInTheDocument();
    expect(screen.getByTestId("app-sidebar")).toHaveAttribute("data-hide-inbox", "false");
    expect(screen.getByTestId("app-sidebar")).toHaveAttribute("data-agent-status-hub", "true");
    expect(screen.getAllByTestId("page-content")).toHaveLength(1);
  });

  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    "keeps one active page with single-tab=%s and Inbox dock=%s",
    (singleTabMode, inboxDockEnabled) => {
      useDesktopPrefsStore.setState({ singleTabMode, inboxDockEnabled });

      renderShell();

      expect(screen.getAllByTestId("page-content")).toHaveLength(1);
      expect(screen.queryByTestId("inbox-dock-layout") !== null).toBe(inboxDockEnabled);
    },
  );
});

describe("agent hub preference", () => {
  it("updates the sidebar when the preference is disabled and enabled", () => {
    useDesktopPrefsStore.setState({ agentStatusHubEnabled: true });
    renderShell();
    expect(screen.getByTestId("app-sidebar")).toHaveAttribute("data-agent-status-hub", "true");
    act(() => useDesktopPrefsStore.getState().setAgentStatusHubEnabled(false));
    expect(screen.getByTestId("app-sidebar")).toHaveAttribute("data-agent-status-hub", "false");
    act(() => useDesktopPrefsStore.getState().setAgentStatusHubEnabled(true));
    expect(screen.getByTestId("app-sidebar")).toHaveAttribute("data-agent-status-hub", "true");
  });
});
