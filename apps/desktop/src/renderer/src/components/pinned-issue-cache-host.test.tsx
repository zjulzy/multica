import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ url: "/team/issues/one", slug: "team", current: "team" }));
vi.mock("@/stores/tab-store", () => ({
  useActiveTabUrl: () => env.url,
  useTabStore: (selector: (s: { activeWorkspaceSlug: string }) => unknown) => selector({ activeWorkspaceSlug: env.slug }),
  splitTabUrl: (url: string) => ({ pathname: url.split(/[?#]/)[0], suffix: "" }),
}));
vi.mock("@multica/core/auth", () => ({ useAuthStore: (selector: (s: { user: { id: string } }) => unknown) => selector({ user: { id: "user" } }) }));
vi.mock("@multica/core/platform", () => ({ getCurrentSlug: () => env.current, subscribeToCurrentSlug: () => () => {} }));
vi.mock("@multica/core/issues/canonical-id", () => ({ useCanonicalIssue: (_ws: string, id: string) => ({ canonicalId: id || null }) }));
vi.mock("@multica/core/workspace", () => ({ workspaceListOptions: () => ({ queryKey: ["workspaces"], queryFn: async () => [] }) }));
vi.mock("@multica/core/pins/queries", () => ({ pinListOptions: (ws: string, user: string) => ({ queryKey: ["pins", ws, user], queryFn: async () => [] }) }));
vi.mock("@multica/core/paths", () => ({ WorkspaceSlugProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@multica/views/issues/hooks", () => ({ useIssueTimeline: vi.fn() }));
vi.mock("@multica/views/navigation", () => ({ useNavigation: () => ({ pathname: env.url }) }));
vi.mock("./stable-issue-navigation", () => ({ StableIssueNavigation: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@multica/views/issues/components", () => ({ CachedIssueDetail: ({ issueId }: { issueId: string }) => {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{issueId}:{count}</button>;
} }));

import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";
import { useRenderedRouteStore } from "@/stores/rendered-route-store";
import { useIssueTimeline } from "@multica/views/issues/hooks";
import { PinnedIssueCacheHost, useCachedIssueId } from "./pinned-issue-cache-host";

function Current() { return <span data-testid="managed">{useCachedIssueId() ?? "none"}</span>; }

describe("pinned issue cache host", () => {
  beforeEach(() => {
    env.url = "/team/issues/one"; env.slug = "team"; env.current = "team";
    useRenderedRouteStore.setState({ pathname: env.url });
    useDesktopPrefsStore.setState({ pinnedIssueCacheEnabled: true });
  });
  it("retains a visited pin across route changes and removes it when unpinned", () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    client.setQueryData(["workspaces"], [{ id: "ws", slug: "team" }]);
    client.setQueryData(["pins", "ws", "user"], [{ item_type: "issue", item_id: "one" }]);
    const view = () => <QueryClientProvider client={client}><PinnedIssueCacheHost><Current /></PinnedIssueCacheHost></QueryClientProvider>;
    const { rerender } = render(view());
    expect(screen.getByTestId("managed")).toHaveTextContent(/^one$/);
    fireEvent.click(screen.getByRole("button", { name: "one:0" }));
    act(() => { env.url = "/team/projects"; useRenderedRouteStore.setState({ pathname: env.url }); }); rerender(view());
    expect(screen.getByTestId("managed")).toHaveTextContent("none");
    expect(useIssueTimeline).toHaveBeenCalledWith("one", "user");
    act(() => { env.url = "/team/issues/one"; useRenderedRouteStore.setState({ pathname: env.url }); }); rerender(view());
    expect(screen.getByRole("button", { name: "one:1" })).toBeInTheDocument();
    act(() => client.setQueryData(["pins", "ws", "user"], []));
    return vi.waitFor(() => expect(screen.queryByText("one:1")).toBeNull());
  });

  it("separates the same issue id across workspaces and clears all pages when disabled", () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    client.setQueryData(["workspaces"], [{ id: "ws1", slug: "team" }, { id: "ws2", slug: "other" }]);
    client.setQueryData(["pins", "ws1", "user"], [{ item_type: "issue", item_id: "one" }]);
    client.setQueryData(["pins", "ws2", "user"], [{ item_type: "issue", item_id: "one" }]);
    const view = () => <QueryClientProvider client={client}><PinnedIssueCacheHost><Current /></PinnedIssueCacheHost></QueryClientProvider>;
    const { rerender } = render(view());
    fireEvent.click(screen.getByRole("button", { name: "one:0" }));
    act(() => { env.slug = "other"; env.current = "other"; env.url = "/other/issues/one"; useRenderedRouteStore.setState({ pathname: env.url }); }); rerender(view());
    expect(screen.getByRole("button", { name: "one:0" })).toBeInTheDocument();
    act(() => { env.slug = "team"; env.current = "team"; env.url = "/team/issues/one"; useRenderedRouteStore.setState({ pathname: env.url }); }); rerender(view());
    expect(screen.getByRole("button", { name: "one:1" })).toBeInTheDocument();
    act(() => useDesktopPrefsStore.getState().setPinnedIssueCacheEnabled(false));
    expect(screen.queryByText("one:1")).toBeNull();
    expect(screen.queryByText("one:0")).toBeNull();
    expect(screen.getByTestId("managed")).toHaveTextContent("none");
  });

  it("does not activate a cached page while the workspace singleton is still changing", () => {
    env.slug = "other"; env.current = "team"; env.url = "/other/issues/one";
    useRenderedRouteStore.setState({ pathname: env.url });
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    client.setQueryData(["workspaces"], [{ id: "ws2", slug: "other" }]);
    client.setQueryData(["pins", "ws2", "user"], [{ item_type: "issue", item_id: "one" }]);
    const view = () => <QueryClientProvider client={client}><PinnedIssueCacheHost><Current /></PinnedIssueCacheHost></QueryClientProvider>;
    const { rerender } = render(view());
    expect(screen.getByTestId("managed")).toHaveTextContent("none");
    expect(screen.queryByText("one:0")).toBeNull();
    act(() => { env.current = "other"; }); rerender(view());
    expect(screen.getByRole("button", { name: "one:0" })).toBeInTheDocument();
  });

  it("keeps the committed page managed while the next route is still pending", () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    client.setQueryData(["workspaces"], [{ id: "ws", slug: "team" }]);
    client.setQueryData(["pins", "ws", "user"], [{ item_type: "issue", item_id: "one" }]);
    const view = () => <QueryClientProvider client={client}><PinnedIssueCacheHost><Current /></PinnedIssueCacheHost></QueryClientProvider>;
    const { rerender } = render(view());
    fireEvent.click(screen.getByRole("button", { name: "one:0" }));
    env.url = "/team/projects";
    rerender(view());
    expect(screen.getByTestId("managed")).toHaveTextContent(/^one$/);
    expect(screen.getByRole("button", { name: "one:1" })).toBeInTheDocument();
  });
});
