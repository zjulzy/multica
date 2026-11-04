import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@multica/core/i18n/react";
import { RESOURCES } from "@multica/views/locales";
import { LIWORK_BRIDGE_WORKSPACE_ID } from "../../../shared/liwork-monitor";
import { LiworkMonitorPage } from "./liwork-monitor-page";

const state = vi.hoisted(() => ({ workspace: "", snapshot: vi.fn(), switchSession: vi.fn(), getIssue: vi.fn(), getProject: vi.fn() }));
vi.mock("@multica/core/api", () => ({ api: { getIssue: state.getIssue, getProject: state.getProject } }));
vi.mock("@multica/core/paths", () => ({
  useCurrentWorkspace: () => ({ id: state.workspace, slug: "zgameclient" }),
  paths: { workspace: (slug: string) => ({ issueDetail: (id: string) => `/${slug}/issues/${id}` }) },
}));
vi.mock("@multica/core/workspace", () => ({ workspaceListOptions: () => ({ queryKey: ["workspaces"], queryFn: async () => [] }) }));
vi.mock("@multica/views/layout", () => ({
  ListColumn: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
  PageHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  SharedPinnedSection: () => null,
  useListColumnCollapsed: () => false,
}));
vi.mock("@multica/views/navigation", () => ({ AppLink: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));

beforeEach(() => {
  state.workspace = LIWORK_BRIDGE_WORKSPACE_ID;
  state.snapshot.mockReset().mockResolvedValue({
    sampledAt: Date.now(), terminalsAvailable: true, metricsAvailable: true,
    sessions: [
      { sessionId: "a", issueId: "i1", identifier: "ZC-1", title: "First issue", state: "connected", cpu: 2.5, memory: 104857600, startedAt: 1700000000000, lastOutputAt: 1700001000000, agent: "claude", worktreeName: "main", privateMemory: 209715200, pid: 123, bridgeStatus: "active" },
      { sessionId: "b", issueId: "i2", identifier: "ZC-2", title: "Second issue", state: "unconfirmed", cpu: null, memory: null },
    ],
  });
  state.switchSession.mockReset().mockResolvedValue(undefined);
  state.getIssue.mockReset().mockResolvedValue({ id: "i1", workspace_id: LIWORK_BRIDGE_WORKSPACE_ID, title: "Current issue title", status: "blocked", project_id: "p1", updated_at: "2026-11-04T00:00:00Z" });
  state.getProject.mockReset().mockResolvedValue({ id: "p1", workspace_id: LIWORK_BRIDGE_WORKSPACE_ID, title: "Main project" });
  Object.defineProperty(window, "desktopAPI", { configurable: true, value: { getLiworkSnapshot: state.snapshot, switchLiworkSession: state.switchSession } });
});

function mount(sourceVisible = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  if (sourceVisible) client.setQueryData(["workspaces"], [{ id: LIWORK_BRIDGE_WORKSPACE_ID, slug: "zgameclient" }]);
  return render(<QueryClientProvider client={client}><I18nProvider locale="en" resources={RESOURCES}><LiworkMonitorPage /></I18nProvider></QueryClientProvider>);
}

describe("LiWork monitor page", () => {
  it("shows verified metrics and allows selecting an unconfirmed issue", async () => {
    mount();
    expect((await screen.findAllByText(/100 MB/)).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Open issue" })).toHaveAttribute("href", "/zgameclient/issues/i1");
    fireEvent.click(screen.getByRole("button", { name: /ZC-2/ }));
    expect(screen.getByRole("link", { name: "Open issue" })).toHaveAttribute("href", "/zgameclient/issues/i2");
    expect(screen.getByText(/Terminal not found/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open LiWork session" })).not.toBeInTheDocument();
  });

  it("shows live task and session details and opens the verified LiWork session", async () => {
    mount();
    expect(await screen.findByText("Current issue title")).toBeInTheDocument();
    expect(await screen.findByText("Main project")).toBeInTheDocument();
    expect(state.getIssue).toHaveBeenCalledWith("i1", expect.objectContaining({ workspaceSlug: "zgameclient" }));
    expect(state.getProject).toHaveBeenCalledWith("p1", "zgameclient");
    expect(screen.getByText("claude")).toBeInTheDocument();
    expect(screen.getByText("200 MB")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open LiWork session" }));
    await waitFor(() => expect(state.switchSession).toHaveBeenCalledWith("a"));
  });

  it("explains a failed session switch", async () => {
    state.switchSession.mockRejectedValue(new Error("gone"));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Open LiWork session" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The session could not be opened");
  });

  it("does not open an issue in a different workspace", async () => {
    state.workspace = "another-workspace";
    mount();
    expect(await screen.findByText(/different workspace/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open issue" })).not.toBeInTheDocument();
  });

  it("links to the source workspace when it is available from another workspace", async () => {
    state.workspace = "another-workspace";
    mount(true);
    expect(await screen.findByRole("link", { name: "Open issue" })).toHaveAttribute("href", "/zgameclient/issues/i1");
  });

  it("shows a readable error instead of inventing data", async () => {
    state.snapshot.mockRejectedValue(new Error("missing"));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to read LiWork bridge data");
    expect(screen.queryByRole("link", { name: "Open issue" })).not.toBeInTheDocument();
    expect(screen.queryByText("0 / 0")).not.toBeInTheDocument();
  });
});
