import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ current: "team", user: "user" }));
vi.mock("@multica/core/auth", () => ({ useAuthStore: (select: (s: unknown) => unknown) => select({ user: env.user ? { id: env.user } : null }) }));
vi.mock("@multica/core/platform", () => ({ getCurrentSlug: () => env.current, subscribeToCurrentSlug: () => () => {} }));
vi.mock("@multica/core/issues/canonical-id", () => ({ useCanonicalIssue: (_ws: string, id: string) => ({ canonicalId: id || null }) }));
vi.mock("@multica/core/issues/queries", () => ({ issueKeys: { timeline: (id: string) => ["timeline", id] } }));
vi.mock("@multica/core/workspace", () => ({ workspaceListOptions: () => ({ queryKey: ["workspaces"], queryFn: async () => [] }) }));
vi.mock("@multica/core/pins/queries", () => ({ pinListOptions: (ws: string, user: string) => ({ queryKey: ["pins", ws, user], queryFn: async () => [] }) }));
vi.mock("@multica/core/paths", () => ({ WorkspaceSlugProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@multica/core/realtime", () => ({ useWS: () => ({ subscribe: vi.fn(), onReconnect: vi.fn() }) }));
vi.mock("@multica/views/issues/hooks", () => ({ useIssueTimeline: vi.fn() }));
vi.mock("@multica/views/layout", () => ({ usePageHeaderPortalTarget: () => null }));
vi.mock("@multica/views/navigation", () => ({ useNavigationBridge: () => ({ navigation: {}, pending: false, report: null }) }));
vi.mock("./independent-issue-providers", () => ({ IndependentIssueProviders: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@multica/views/issues/components", () => ({ CachedIssueDetail: ({ issueId }: { issueId: string }) => {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{issueId}:{count}</button>;
} }));

import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";
import { useRenderedRouteStore } from "@/stores/rendered-route-store";
import { IndependentPinnedIssueHost } from "./independent-pinned-issue-host";
import { usePinnedIssueCacheSnapshot } from "./pinned-issue-cache-context";

function Snapshot() { const value = usePinnedIssueCacheSnapshot(); return <span data-testid="snapshot">{value?.enabled ? value.workspaceId : "disabled"}</span>; }

describe("independent pinned issue host", () => {
  beforeEach(() => {
    env.current = "team"; env.user = "user";
    useRenderedRouteStore.setState({ pathname: "/team/issues/one" });
    useDesktopPrefsStore.setState({ pinnedIssueCacheEnabled: true });
  });
  it("keeps a fixed issue across routes and discards it when unpinned", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    client.setQueryData(["workspaces"], [{ id: "ws", slug: "team" }]);
    client.setQueryData(["pins", "ws", "user"], [{ item_type: "issue", item_id: "one" }]);
    const view = render(<QueryClientProvider client={client}><IndependentPinnedIssueHost><Snapshot /></IndependentPinnedIssueHost></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "one:0" }));
    act(() => useRenderedRouteStore.setState({ pathname: "/team/projects" }));
    expect(screen.getByText("one:1")).not.toBeVisible();
    act(() => useRenderedRouteStore.setState({ pathname: "/team/issues/one" }));
    expect(screen.getByRole("button", { name: "one:1" })).toBeVisible();
    act(() => client.setQueryData(["pins", "ws", "user"], []));
    await waitFor(() => expect(screen.queryByText("one:1")).toBeNull());
    await act(async () => { view.unmount(); await Promise.resolve(); });
  });
  it("does not mix pages from workspaces with matching issue ids", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    client.setQueryData(["workspaces"], [{ id: "ws1", slug: "team" }, { id: "ws2", slug: "other" }]);
    client.setQueryData(["pins", "ws1", "user"], [{ item_type: "issue", item_id: "one" }]);
    client.setQueryData(["pins", "ws2", "user"], [{ item_type: "issue", item_id: "one" }]);
    const component = <QueryClientProvider client={client}><IndependentPinnedIssueHost><Snapshot /></IndependentPinnedIssueHost></QueryClientProvider>;
    const view = render(component);
    fireEvent.click(screen.getByRole("button", { name: "one:0" }));
    act(() => { env.current = "other"; useRenderedRouteStore.setState({ pathname: "/other/issues/one" }); });
    expect(screen.getByRole("button", { name: "one:0" })).toBeVisible();
    act(() => { env.current = "team"; useRenderedRouteStore.setState({ pathname: "/team/issues/one" }); });
    expect(screen.getByRole("button", { name: "one:1" })).toBeVisible();
    await act(async () => { view.unmount(); await Promise.resolve(); });
  });
});
