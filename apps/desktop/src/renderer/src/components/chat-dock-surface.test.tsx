import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { NavigationProvider, useNavigation, type NavigationAdapter } from "@multica/views/navigation";
import { ChatDockSurface } from "./chat-dock-surface";

const apiMocks = vi.hoisted(() => ({ getChatSession: vi.fn(), listChatSessions: vi.fn(), error: vi.fn() }));
vi.mock("@multica/core/api", () => ({ api: apiMocks }));
vi.mock("@multica/core/platform", () => ({ getCurrentSlug: () => "acme", getCurrentWsId: () => "ws-1" }));
vi.mock("sonner", () => ({ toast: { error: apiMocks.error } }));
vi.mock("@multica/views/i18n", () => ({ useT: () => ({ t: (selector: (value: unknown) => unknown) => {
  const strings = { page: { session_link_loading: "Checking", session_link_retry_hint: "Cannot check", session_link_retry: "Retry", session_link_unavailable: "Unavailable" } };
  return selector(strings);
} }) }));

vi.mock("@multica/views/layout", () => ({ AppShellProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@multica/views/chat", () => ({ ChatPage: ({ visible }: { visible: boolean }) => {
  const nav = useNavigation();
  return <div data-testid="chat-page" data-visible={String(visible)} data-path={nav.pathname} data-session={nav.searchParams.get("session") ?? ""}>
    <button onClick={() => nav.replace("/acme/chat?session=next")}>Select session</button>
    <button onClick={() => nav.push("/acme/agents/a")}>Open agent</button>
  </div>;
} }));

describe("ChatDockSurface", () => {
  it("keeps chat selection local and delegates non-chat navigation to the main page", () => {
    const push = vi.fn();
    const onPathChange = vi.fn();
    const nav: NavigationAdapter = { pathname: "/acme/issues", searchParams: new URLSearchParams(), hash: "", push, replace: vi.fn(), back: vi.fn(), getShareableUrl: (path) => path };
    render(<QueryClientProvider client={new QueryClient()}><NavigationProvider value={nav}><ChatDockSurface workspaceId="ws-1" workspaceSlug="acme" path="/acme/chat?session=one" onPathChange={onPathChange} visible /></NavigationProvider></QueryClientProvider>);
    expect(screen.getByTestId("chat-page")).toHaveAttribute("data-session", "one");
    fireEvent.click(screen.getByText("Select session"));
    expect(onPathChange).toHaveBeenCalledWith("/acme/chat?session=next");
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Open agent"));
    expect(push).toHaveBeenCalledWith("/acme/agents/a");
  });

  it("verifies a valid session missing from a stale list before opening it", async () => {
    apiMocks.getChatSession.mockReset().mockResolvedValue({ id: "new", workspace_id: "ws-1" });
    apiMocks.listChatSessions.mockReset().mockResolvedValue([{ id: "old", workspace_id: "ws-1" }]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const nav: NavigationAdapter = { pathname: "/acme/issues", searchParams: new URLSearchParams(), hash: "", push: vi.fn(), replace: vi.fn(), back: vi.fn(), getShareableUrl: (path) => path };
    render(<QueryClientProvider client={qc}><NavigationProvider value={nav}><ChatDockSurface workspaceId="ws-1" workspaceSlug="acme" path="/acme/chat?session=new" onPathChange={vi.fn()} visible validateSession /></NavigationProvider></QueryClientProvider>);
    expect(await screen.findByTestId("chat-page")).toHaveAttribute("data-session", "new");
    expect(qc.getQueryData<Array<{ id: string }>>(["chat", "ws-1", "sessions"])?.map((item) => item.id)).toEqual(["new", "old"]);
    expect(apiMocks.getChatSession).toHaveBeenCalledWith("new", "acme");
  });

  it("keeps the requested session on a network failure and retries", async () => {
    apiMocks.getChatSession.mockReset().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ id: "new", workspace_id: "ws-1" });
    apiMocks.listChatSessions.mockReset().mockResolvedValue([]);
    const onPathChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const nav: NavigationAdapter = { pathname: "/acme/issues", searchParams: new URLSearchParams(), hash: "", push: vi.fn(), replace: vi.fn(), back: vi.fn(), getShareableUrl: (path) => path };
    render(<QueryClientProvider client={qc}><NavigationProvider value={nav}><ChatDockSurface workspaceId="ws-1" workspaceSlug="acme" path="/acme/chat?session=new" onPathChange={onPathChange} visible validateSession /></NavigationProvider></QueryClientProvider>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot check");
    expect(onPathChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByTestId("chat-page")).toHaveAttribute("data-session", "new"));
  });

  it("reports a session confirmed unavailable and returns to the chat list", async () => {
    apiMocks.error.mockClear();
    apiMocks.getChatSession.mockReset().mockRejectedValue(Object.assign(new Error("missing"), { status: 404 }));
    apiMocks.listChatSessions.mockReset().mockResolvedValue([]);
    const onPathChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const nav: NavigationAdapter = { pathname: "/acme/issues", searchParams: new URLSearchParams(), hash: "", push: vi.fn(), replace: vi.fn(), back: vi.fn(), getShareableUrl: (path) => path };
    render(<QueryClientProvider client={qc}><NavigationProvider value={nav}><ChatDockSurface workspaceId="ws-1" workspaceSlug="acme" path="/acme/chat?session=gone" onPathChange={onPathChange} visible validateSession /></NavigationProvider></QueryClientProvider>);
    await waitFor(() => expect(onPathChange).toHaveBeenCalledWith("/acme/chat", 0));
    expect(apiMocks.error).toHaveBeenCalledWith("Unavailable");
  });

  it("rechecks a repeated session link instead of reusing the earlier success", async () => {
    apiMocks.error.mockClear();
    apiMocks.getChatSession.mockReset().mockResolvedValueOnce({ id: "same", workspace_id: "ws-1" }).mockRejectedValueOnce(Object.assign(new Error("missing"), { status: 404 }));
    apiMocks.listChatSessions.mockReset().mockResolvedValue([]);
    const onPathChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const nav: NavigationAdapter = { pathname: "/acme/issues", searchParams: new URLSearchParams(), hash: "", push: vi.fn(), replace: vi.fn(), back: vi.fn(), getShareableUrl: (path) => path };
    const ui = (id: number) => <QueryClientProvider client={qc}><NavigationProvider value={nav}><ChatDockSurface workspaceId="ws-1" workspaceSlug="acme" path="/acme/chat?session=same" validationId={id} onPathChange={onPathChange} visible validateSession /></NavigationProvider></QueryClientProvider>;
    const { rerender } = render(ui(1));
    expect(await screen.findByTestId("chat-page")).toBeInTheDocument();
    rerender(ui(2));
    await waitFor(() => expect(onPathChange).toHaveBeenCalledWith("/acme/chat", 2));
    expect(apiMocks.getChatSession).toHaveBeenCalledTimes(2);
    expect(apiMocks.error).toHaveBeenCalledWith("Unavailable");
  });

  it("reports an unavailable session again when the same link is opened again", async () => {
    apiMocks.error.mockClear();
    apiMocks.getChatSession.mockReset().mockRejectedValue(Object.assign(new Error("missing"), { status: 404 }));
    apiMocks.listChatSessions.mockReset().mockResolvedValue([]);
    const onPathChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const nav: NavigationAdapter = { pathname: "/acme/issues", searchParams: new URLSearchParams(), hash: "", push: vi.fn(), replace: vi.fn(), back: vi.fn(), getShareableUrl: (path) => path };
    const ui = (id: number) => <QueryClientProvider client={qc}><NavigationProvider value={nav}><ChatDockSurface workspaceId="ws-1" workspaceSlug="acme" path="/acme/chat?session=gone" validationId={id} onPathChange={onPathChange} visible validateSession /></NavigationProvider></QueryClientProvider>;
    const { rerender } = render(ui(1));
    await waitFor(() => expect(onPathChange).toHaveBeenCalledWith("/acme/chat", 1));
    rerender(ui(2));
    await waitFor(() => expect(onPathChange).toHaveBeenCalledWith("/acme/chat", 2));
    expect(apiMocks.error).toHaveBeenCalledTimes(2);
  });

  it("does not let an older request overwrite the newer session list", async () => {
    let resolveOld!: (value: { id: string; workspace_id: string }) => void;
    apiMocks.getChatSession.mockReset().mockImplementation((id: string) => id === "old" ? new Promise((resolve) => { resolveOld = resolve; }) : Promise.resolve({ id: "new", workspace_id: "ws-1" }));
    apiMocks.listChatSessions.mockReset().mockResolvedValue([]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const nav: NavigationAdapter = { pathname: "/acme/issues", searchParams: new URLSearchParams(), hash: "", push: vi.fn(), replace: vi.fn(), back: vi.fn(), getShareableUrl: (path) => path };
    const ui = (id: string, generation: number) => <QueryClientProvider client={qc}><NavigationProvider value={nav}><ChatDockSurface workspaceId="ws-1" workspaceSlug="acme" path={`/acme/chat?session=${id}`} validationId={generation} onPathChange={vi.fn()} visible validateSession /></NavigationProvider></QueryClientProvider>;
    const { rerender } = render(ui("old", 1));
    rerender(ui("new", 2));
    expect(await screen.findByTestId("chat-page")).toHaveAttribute("data-session", "new");
    await act(async () => { resolveOld({ id: "old", workspace_id: "ws-1" }); });
    expect(qc.getQueryData<Array<{ id: string }>>(["chat", "ws-1", "sessions"])?.map((item) => item.id)).toEqual(["new"]);
  });
});
