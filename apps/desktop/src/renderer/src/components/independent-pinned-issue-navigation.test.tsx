import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { memo, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { NavigationProvider, useNavigation, type NavigationAdapter } from "@multica/views/navigation";

const aliases = vi.hoisted(() => ({ values: {} as Record<string, string> }));
vi.mock("@multica/core/realtime", () => ({ useWS: () => ({ subscribe: vi.fn(), onReconnect: vi.fn() }) }));
vi.mock("@multica/core/issues/queries", () => ({ issueKeys: { timeline: (id: string) => ["timeline", id] } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: {} }) }));
vi.mock("./independent-issue-providers", async () => {
  const { NavigationBridgeProvider } = await import("@multica/views/navigation");
  const { PageHeaderPortalProvider } = await import("../../../../../../packages/views/layout/page-header");
  return { IndependentIssueProviders: ({ navigation, header, children }: { navigation: any; header: HTMLElement | null; children: React.ReactNode }) =>
    <NavigationBridgeProvider value={navigation}><PageHeaderPortalProvider value={header}>{children}</PageHeaderPortalProvider></NavigationBridgeProvider> };
});
vi.mock("@multica/core/auth", () => ({ useAuthStore: (selector: (s: { user: { id: string } }) => unknown) => selector({ user: { id: "user" } }) }));
vi.mock("@multica/core/platform", () => ({ getCurrentSlug: () => "team", subscribeToCurrentSlug: () => () => {} }));
vi.mock("@multica/core/hooks", () => ({ useWorkspaceId: () => "ws" }));
vi.mock("@multica/core/issues/canonical-id", () => ({ useCanonicalIssue: (_ws: string, id: string) => ({ canonicalId: (aliases.values[id] ?? id) || null, issue: id ? { id: aliases.values[id] ?? id, identifier: id, title: id } : undefined }) }));
vi.mock("@multica/core/workspace", () => ({ workspaceListOptions: () => ({ queryKey: ["workspaces"], queryFn: async () => [] }) }));
vi.mock("@multica/core/pins/queries", () => ({ pinListOptions: (ws: string, user: string) => ({ queryKey: ["pins", ws, user], queryFn: async () => [] }) }));
vi.mock("@multica/core/paths", () => ({ WorkspaceSlugProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@multica/views/issues/hooks", () => ({ useIssueTimeline: vi.fn() }));
vi.mock("@/hooks/use-document-title", () => ({ useDocumentTitle: () => {} }));
vi.mock("@multica/views/issues/components", async () => {
  const { PageHeader } = await import("../../../../../../packages/views/layout/page-header");
  return { CachedIssueDetail: memo(({ issueId }: { issueId: string }) => {
    const [count, setCount] = useState(0);
    const navigation = useNavigation();
    return <><PageHeader><span>header:{issueId}</span></PageHeader><button data-path={navigation.pathname} onClick={() => setCount(count + 1)}>{issueId}:{count}</button></>;
  }),
  IssueDetailRoute: ({ routeId, suppressDetail }: { routeId: string; suppressDetail?: boolean }) => suppressDetail ? null : <><PageHeader><span>normal-header:{routeId}</span></PageHeader><span>duplicate:{routeId}</span></>,
}; });

import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";
import { useRenderedRouteStore } from "@/stores/rendered-route-store";
import { IssueDetailPage } from "../pages/issue-detail-page";
import { IndependentPinnedIssueHost } from "./independent-pinned-issue-host";
import { PageHeaderPortalProvider } from "../../../../../../packages/views/layout/page-header";

function Shell() {
  const { pathname } = useLocation();
  useLayoutEffect(() => { useRenderedRouteStore.getState().setPathname(pathname); }, [pathname]);
  return <Outlet />;
}

function Harness({ qc, header, router }: { qc: QueryClient; header: HTMLElement; router: ReturnType<typeof createMemoryRouter> }) {
  const [pathname, setPathname] = useState(router.state.location.pathname);
  useEffect(() => router.subscribe((state) => setPathname(state.location.pathname)), [router]);
  const navigation = useMemo<NavigationAdapter>(() => ({ pathname, searchParams: new URLSearchParams(), hash: "", push: (url) => { void router.navigate(url); }, replace: (url) => { void router.navigate(url, { replace: true }); }, back: () => { void router.navigate(-1); }, getShareableUrl: (p) => p }), [pathname, router]);
  return <QueryClientProvider client={qc}><NavigationProvider value={navigation}><PageHeaderPortalProvider value={header}><IndependentPinnedIssueHost><RouterProvider router={router} /></IndependentPinnedIssueHost></PageHeaderPortalProvider></NavigationProvider></QueryClientProvider>;
}

describe("independent pinned issue navigation integration", () => {
  it("does not duplicate the issue body or header while navigating and reuses page state", async () => {
    aliases.values = {};
    useDesktopPrefsStore.setState({ pinnedIssueCacheEnabled: true });
    useRenderedRouteStore.setState({ pathname: "/team/issues/one" });
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    qc.setQueryData(["workspaces"], [{ id: "ws", slug: "team" }]);
    qc.setQueryData(["pins", "ws", "user"], [{ item_type: "issue", item_id: "one" }, { item_type: "issue", item_id: "two" }]);
    const header = document.createElement("div"); header.id = "header"; document.body.appendChild(header);
    const router = createMemoryRouter([{ element: <Shell />, children: [
      { path: "/team/issues/:id", element: <IssueDetailPage /> },
      { path: "/team/projects", element: <div>projects</div> },
      { path: "/team/settings", element: <div>settings</div> },
    ] }], { initialEntries: ["/team/issues/one"] });
    const { unmount } = render(<Harness qc={qc} header={header} router={router} />);
    fireEvent.click(await screen.findByRole("button", { name: "one:0" }));
    expect(screen.queryByText("duplicate:one")).toBeNull();
    await act(async () => { await router.navigate("/team/issues/two"); });
    expect(screen.getByRole("button", { name: "two:0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "two:0" })).toHaveAttribute("data-path", "/team/issues/two");
    expect(screen.queryByText("duplicate:two")).toBeNull();
    expect(screen.getByText("header:one")).not.toBeVisible();
    expect(screen.getByText("header:two")).toBeVisible();
    await act(async () => { await router.navigate("/team/projects"); });
    expect(screen.getByText("projects")).toBeInTheDocument();
    await act(async () => { await router.navigate("/team/settings"); });
    expect(screen.getByText("settings")).toBeInTheDocument();
    expect(screen.getByText("header:two")).not.toBeVisible();
    await act(async () => { await router.navigate("/team/issues/one"); });
    expect(screen.getByRole("button", { name: "one:1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "one:1" })).toHaveAttribute("data-path", "/team/issues/one");
    expect(screen.getByText("header:one")).toBeVisible();
    expect(screen.getByText("header:two")).not.toBeVisible();
    await act(async () => { unmount(); await Promise.resolve(); }); header.remove(); router.dispose();
  });
  it("keeps the same page and a single header while the issue URL becomes canonical", async () => {
    aliases.values = { "ZC-1": "issue-uuid" };
    useDesktopPrefsStore.setState({ pinnedIssueCacheEnabled: true });
    useRenderedRouteStore.setState({ pathname: "/team/issues/issue-uuid" });
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    qc.setQueryData(["workspaces"], [{ id: "ws", slug: "team" }]);
    qc.setQueryData(["pins", "ws", "user"], [{ item_type: "issue", item_id: "issue-uuid" }]);
    const header = document.createElement("div"); header.id = "header"; document.body.appendChild(header);
    const router = createMemoryRouter([{ element: <Shell />, children: [{ path: "/team/issues/:id", element: <IssueDetailPage /> }] }], { initialEntries: ["/team/issues/issue-uuid"] });
    const { unmount } = render(<Harness qc={qc} header={header} router={router} />);
    fireEvent.click(await screen.findByRole("button", { name: "issue-uuid:0" }));
    await act(async () => { await router.navigate("/team/issues/ZC-1", { replace: true }); });
    expect(screen.getByRole("button", { name: "issue-uuid:1" })).toBeInTheDocument();
    expect(screen.getAllByText("header:issue-uuid")).toHaveLength(1);
    expect(screen.queryByText("duplicate:ZC-1")).toBeNull();
    await act(async () => { unmount(); await Promise.resolve(); }); header.remove(); router.dispose(); aliases.values = {};
  });
  it("switches the route and cache to the same pin snapshot when a pin arrives", async () => {
    aliases.values = {};
    useDesktopPrefsStore.setState({ pinnedIssueCacheEnabled: true });
    useRenderedRouteStore.setState({ pathname: "/team/issues/one" });
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    qc.setQueryData(["workspaces"], [{ id: "ws", slug: "team" }]);
    qc.setQueryData(["pins", "ws", "user"], []);
    const header = document.createElement("div"); header.id = "header"; document.body.appendChild(header);
    const router = createMemoryRouter([{ element: <Shell />, children: [{ path: "/team/issues/:id", element: <IssueDetailPage /> }] }], { initialEntries: ["/team/issues/one"] });
    const { unmount } = render(<Harness qc={qc} header={header} router={router} />);
    expect(screen.getByText("normal-header:one")).toBeVisible();
    await act(async () => { qc.setQueryData(["pins", "ws", "user"], [{ item_type: "issue", item_id: "one" }]); });
    await waitFor(() => expect(screen.getByText("header:one")).toBeVisible());
    expect(screen.queryByText("normal-header:one")).toBeNull();
    expect(within(header).getAllByText(/header:one/)).toHaveLength(1);
    await act(async () => { unmount(); await Promise.resolve(); }); header.remove(); router.dispose();
  });
  it("does not leave a cached header beside a non-pinned issue header", async () => {
    aliases.values = {};
    useDesktopPrefsStore.setState({ pinnedIssueCacheEnabled: true });
    useRenderedRouteStore.setState({ pathname: "/team/issues/one" });
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    qc.setQueryData(["workspaces"], [{ id: "ws", slug: "team" }]);
    qc.setQueryData(["pins", "ws", "user"], [{ item_type: "issue", item_id: "one" }]);
    const header = document.createElement("div"); document.body.appendChild(header);
    const router = createMemoryRouter([{ element: <Shell />, children: [{ path: "/team/issues/:id", element: <IssueDetailPage /> }] }], { initialEntries: ["/team/issues/one"] });
    const { unmount } = render(<Harness qc={qc} header={header} router={router} />);
    expect(await screen.findByText("header:one")).toBeVisible();
    await act(async () => { await router.navigate("/team/issues/unpinned"); });
    expect(screen.getByText("header:one")).not.toBeVisible();
    expect(screen.getByText("normal-header:unpinned")).toBeVisible();
    await act(async () => { unmount(); await Promise.resolve(); }); header.remove(); router.dispose();
  });
});
