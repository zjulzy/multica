import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { issueKeys } from "@multica/core/issues/queries";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@multica/core/auth", () => ({ useAuthStore: (select: (value: unknown) => unknown) => select({ user: { id: "user" } }) }));
vi.mock("@multica/core/workspace", () => ({ useWorkspaceList: () => ({ workspaces: [{ id: "ws", slug: "team" }], ready: true, unavailable: false, isFetching: false, refetch: vi.fn() }) }));
vi.mock("@multica/core/platform", () => ({ setCurrentWorkspace: vi.fn() }));
vi.mock("@multica/core/paths", () => ({ WorkspaceSlugProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@multica/core/issues/canonical-id", () => ({ useCanonicalIssue: () => ({ canonicalId: "one", issue: { id: "one", identifier: "T-1" } }) }));
vi.mock("@multica/ui/components/common/multica-icon", () => ({ MulticaIcon: () => null }));
vi.mock("@multica/views/modals/registry", () => ({ ModalRegistry: () => null }));
vi.mock("@multica/views/layout", () => ({ WorkspacePresencePrefetch: () => null }));
vi.mock("@multica/views/voice", () => ({ VoiceWorkspaceWords: () => null }));
vi.mock("@multica/views/platform", () => ({ DragStrip: () => null, WindowTitleBarProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@multica/views/issues/components", () => ({ EmbeddedHeaderModeProvider: ({ enabled, children }: { enabled: boolean; children: React.ReactNode }) => <div data-testid="header-mode" data-enabled={String(enabled)}>{children}</div> }));
vi.mock("./embedded-child-refresh", () => ({ createEmbeddedChildRefresh: () => () => {} }));
vi.mock("./window-toolbar", () => ({ TRAFFIC_LIGHT_CLEARANCE: 88 }));
vi.mock("../pages/issue-detail-page", () => ({ IssueDetailPage: () => <div data-testid="issue-content" /> }));
vi.mock("../pages/auth-recovery", () => ({ DesktopAuthRecoveryPage: () => null }));
vi.mock("../platform/issue-window-navigation", () => ({ IssueWindowNavigationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("../platform/embedded-issue-navigation", () => ({ EmbeddedIssueNavigationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import { IssueWindow } from "./issue-window";

describe("cached issue window header bridge", () => {
  it("enables header replacement only on the main surface and forwards commands and state", async () => {
    let presentation!: (value: unknown) => void;
    let command!: (value: unknown) => void;
    const state = vi.fn();
    const refreshAck = vi.fn();
    const ack = vi.fn((requestId: number) => {
      expect(screen.getByTestId("header-mode")).toHaveAttribute("data-enabled", requestId === 1 ? "true" : "false");
    });
    Object.defineProperty(window, "desktopAPI", { configurable: true, value: {
      isEmbeddedIssue: true,
      runtimeConfig: { ok: true, config: { appUrl: "http://localhost" } },
      onEmbeddedHeaderCommand: (callback: (value: unknown) => void) => { command = callback; return () => {}; },
      onEmbeddedGuestPresentation: (callback: (value: unknown) => void) => { presentation = callback; return () => {}; },
      sendEmbeddedHeaderState: state,
      acknowledgeEmbeddedGuestPresentation: ack,
      acknowledgeEmbeddedGuestRefresh: refreshAck,
      sendEmbeddedGuestReady: vi.fn(), sendEmbeddedIssueNavigation: vi.fn(), sendEmbeddedGuestAction: vi.fn(),
    } });
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    render(<QueryClientProvider client={client}><IssueWindow context={{ kind: "issue", path: "/team/issues/one", title: "Issue", workspaceSlug: "team", issueId: "one" }} /></QueryClientProvider>);
    expect(await screen.findByTestId("issue-content")).toBeInTheDocument();
    expect(screen.getByTestId("header-mode")).toHaveAttribute("data-enabled", "false");
    act(() => presentation({ surface: "main", shellHeader: true, presentationRequestId: 1 }));
    expect(screen.getByTestId("header-mode")).toHaveAttribute("data-enabled", "true");
    expect(ack).toHaveBeenCalledWith(1);
    const toggle = vi.fn(), action = vi.fn();
    window.addEventListener("multica:embedded-toggle-sidebar", toggle);
    window.addEventListener("multica:embedded-header-command", action);
    act(() => command({ command: "toggle-sidebar" }));
    act(() => command({ command: "jump-to-run", taskId: "task-1" }));
    expect(toggle).toHaveBeenCalledOnce();
    expect((action.mock.calls[0][0] as CustomEvent).detail).toEqual({ command: "jump-to-run", taskId: "task-1" });
    await act(async () => command({ command: "refresh-issue", refreshRequestId: 4 }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: issueKeys.detail("ws", "one"), exact: true, refetchType: "active" }, { throwOnError: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: issueKeys.children("ws", "one"), refetchType: "active" }, { throwOnError: true });
    expect(refreshAck).toHaveBeenCalledWith(4, true);
    invalidate.mockRejectedValueOnce(new Error("offline"));
    await act(async () => command({ command: "refresh-issue", refreshRequestId: 5 }));
    expect(refreshAck).toHaveBeenCalledWith(5, false);
    act(() => window.dispatchEvent(new CustomEvent("multica:embedded-header-state", { detail: { sidebarOpen: true } })));
    expect(state).toHaveBeenCalledWith({ sidebarOpen: true });
    act(() => presentation({ surface: "dock", presentationRequestId: 2 }));
    expect(screen.getByTestId("header-mode")).toHaveAttribute("data-enabled", "false");
    expect(ack).toHaveBeenCalledWith(2);
    window.removeEventListener("multica:embedded-toggle-sidebar", toggle);
    window.removeEventListener("multica:embedded-header-command", action);
  });
});
