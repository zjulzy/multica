import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@multica/core/i18n/react";
import { useSidebar } from "@multica/ui/components/ui/sidebar";
import { RESOURCES } from "@multica/views/locales";

// The shell resolves the mocked `getCurrentSlug()` against the workspace list
// before mounting workspace-scoped chrome, so the list has to contain it or
// the rail under test never renders. Gating behaviour itself is covered by
// desktop-layout.workspace-gate.test.tsx.
const WORKSPACES = [{ id: "ws-1", slug: "acme" }];

// The shell is the only thing under test here, so everything it mounts around
// the rail is stubbed out. What survives is the pair that has to agree:
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
  AppLink: ({ href, children, ...props }: { href: string; children: ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("@multica/views/platform", () => ({
  useDesktopUnreadBadge: () => {},
}));

vi.mock("@multica/views/layout", () => ({
  AppRail: ({ bottomSlot, extraItems }: { bottomSlot?: ReactNode; extraItems?: ReactNode }) => <div data-testid="rail-hub">{bottomSlot}<ul>{extraItems}</ul></div>,
  AgentStatusHub: ({ compact }: { compact?: boolean }) => <div data-testid={compact ? "compact-hub" : "expanded-hub"} />,
  PageHeaderPortalProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  PersistentPinsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  AppShellProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  CompactNavSheet: () => null,
  GlobalShortcuts: () => null,
  NavigationProgress: () => null,
  NewIssueButton: () => null,
  SearchButton: () => null,
  ShellRouteDataPrefetch: ({ children }: { children: ReactNode }) => <>{children}</>,
  SpacePanel: ({ bottomSlot }: { bottomSlot?: ReactNode }) => {
    const { open } = useSidebar();
    return open ? <div data-testid="panel-hub">{bottomSlot}</div> : null;
  },
  // In a panel space the shell's toggleNav is the sidebar toggle.
  useAppShell: () => ({ hasPanel: true, toggleNav: useSidebar().toggleSidebar }),
  useTabPresentation: () => ({ visual: { kind: "icon", icon: "Inbox" }, title: "" }),
  ResourceLeadingVisual: () => null,
}));

vi.mock("@multica/views/modals/registry", () => ({ ModalRegistry: () => null }));
vi.mock("@multica/views/search", () => ({
  SearchCommand: () => null,
}));
vi.mock("@multica/views/chat", () => ({ FloatingChat: () => null, ChatDockVisibilityProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("./tab-bar", () => ({ TabBar: () => null }));
vi.mock("./window-overlay", () => ({ WindowOverlay: () => null }));

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
const { useDesktopPrefsStore } = await import("@/stores/desktop-prefs-store");

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
  useDesktopPrefsStore.setState({ liworkMonitorEnabled: true });
});

describe("DesktopShell sidebar trigger", () => {
  it("offers the LiWork entry and respects its preference", () => {
    const view = renderShell();
    const link = view.getByRole("link", { name: "LiWork" });
    expect(link).toHaveAttribute("href", "/acme/liwork");
    expect(link.querySelector("svg path")).not.toBeNull();
    act(() => useDesktopPrefsStore.getState().setLiworkMonitorEnabled(false));
    expect(view.queryByRole("link", { name: "LiWork" })).not.toBeInTheDocument();
  });
  it("keeps the agent hub in the rail when the sidebar is expanded or collapsed", () => {
    const { getByTestId, queryByTestId } = renderShell();
    expect(getByTestId("compact-hub")).toBeInTheDocument();
    expect(queryByTestId("expanded-hub")).toBeNull();
    fireEvent.click(getByTestId("page-content").querySelector("button")!);
    expect(getByTestId("compact-hub")).toBeInTheDocument();
    expect(queryByTestId("expanded-hub")).toBeNull();
  });
  // The window toolbar parks a trigger beside the traffic lights that never
  // scrolls away, so nothing inside the canvas may add a second one. Desktop
  // windows often sit in the band where `PageHeader`'s fallback trigger
  // renders, so every page used to stack an identical icon 50px under
  // this one — and a third when a list/detail surface brought its own header
  // along (MUL-6218).
  it("keeps exactly one trigger and tells page headers not to add another", () => {
    const { container, getByTestId, queryByRole } = renderShell();

    expect(container.querySelectorAll("[data-slot='sidebar-trigger']")).toHaveLength(1);
    expect(getByTestId("page-content")).toHaveAttribute(
      "data-external-trigger",
      "true",
    );
    // The toolbar floats over the 64px rail; the tabs start past the rest
    // of it whether or not the panel inside the card is open.
    const mainTopBar = container.querySelector('[data-slot="main-top-bar"]');
    expect(mainTopBar).toHaveStyle({ paddingLeft: "136px" });

    fireEvent.click(
      container.querySelector('[data-slot="sidebar-trigger"]')!,
    );
    expect(getByTestId("page-content")).toHaveAttribute(
      "data-sidebar-state",
      "collapsed",
    );
    expect(mainTopBar).toHaveStyle({ paddingLeft: "136px" });
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
