import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "@multica/core/api";
import { P4Dock } from "./p4-dock";

const routeState = vi.hoisted(() => ({ pathname: "/ws/issues/ZGA-6594" }));
vi.mock("@/stores/rendered-route-store", () => ({ useRenderedRouteStore: Object.assign((selector: (s: { pathname: string }) => unknown) => selector(routeState), { getState: () => routeState }) }));
vi.mock("@multica/core/auth", () => ({ useAuthStore: (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: "me" } }) }));
vi.mock("@multica/core/api", async (original) => ({ ...(await original<typeof import("@multica/core/api")>()), api: { listAgents: vi.fn(), listMembers: vi.fn(), listTasksByIssue: vi.fn() } }));
vi.mock("@multica/core/issues/canonical-id", () => ({ useCanonicalIssue: () => ({ canonicalId: "issue-1", issue: { id: "issue-1", identifier: "ZGA-6594", title: "[STORY-7148266388] 需求", description: "", assignee_type: "member", assignee_id: "me" } }) }));

const change = { client: "local", change: "123", desc: "ZGA-6594 work" };
const file = { depotFile: "//depot/file.cs", action: "edit", client: "local", change: "123" };
const agentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function renderDock() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><P4Dock workspaceId="ws" /></QueryClientProvider>);
}

describe("P4 dock", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    routeState.pathname = "/ws/issues/ZGA-6594";
    Object.assign(window, { desktopAPI: { p4IssueChanges: vi.fn().mockResolvedValue([change]), p4ChangeFiles: vi.fn().mockResolvedValue([file]), p4FileDiff: vi.fn().mockResolvedValue("--- old\n+++ new\n+code"), p4RevertFile: vi.fn().mockResolvedValue(false) } });
    vi.spyOn(api, "listAgents").mockResolvedValue([{ id: agentId, name: "[lizeyu] 助手", owner_id: "me", archived_at: null, runtime_id: "runtime", permission_mode: "private", invocation_targets: [] }] as never);
    vi.spyOn(api, "listMembers").mockResolvedValue([{ user_id: "me", role: "member" }] as never);
    vi.spyOn(api, "listTasksByIssue").mockResolvedValue([{ issue_id: "issue-1", agent_id: agentId, created_at: "2026-11-26T00:00:00Z" }] as never);
  });
  it("loads matching CLs and files, then offers the selected diff as an issue draft", async () => {
    const listener = vi.fn(); window.addEventListener("multica:append-issue-comment", listener);
    renderDock();
    fireEvent.click(await screen.findByText("CL 123"));
    fireEvent.click(await screen.findByText("file.cs"));
    const diff = await screen.findByText("code");
    const range = document.createRange(); range.selectNodeContents(diff);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    fireEvent.mouseUp(diff);
    fireEvent.click(screen.getByRole("button", { name: "问 AI" }));
    await waitFor(() => expect(listener).toHaveBeenCalledOnce());
    expect((listener.mock.calls[0]![0] as CustomEvent).detail).toMatchObject({ issueId: "issue-1", text: expect.stringContaining("code") });
    expect((listener.mock.calls[0]![0] as CustomEvent).detail.text).toContain(`[@\\[lizeyu\\] 助手](mention://agent/${agentId})`);
    expect(window.desktopAPI.p4IssueChanges).toHaveBeenCalledWith(["ZGA-6594", "7148266388"]);
    window.removeEventListener("multica:append-issue-comment", listener);
  });
  it("shows an error instead of silently hiding P4 failures", async () => {
    vi.mocked(window.desktopAPI.p4IssueChanges).mockRejectedValue(new Error("P4 unavailable"));
    renderDock();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("P4 unavailable"));
  });
  it("still inserts the selected code without a mention when agents cannot be loaded", async () => {
    vi.mocked(api.listAgents).mockRejectedValue(new Error("offline"));
    const listener = vi.fn(); window.addEventListener("multica:append-issue-comment", listener);
    renderDock();
    fireEvent.click(await screen.findByText("CL 123"));
    fireEvent.click(await screen.findByText("file.cs"));
    const code = await screen.findByText("code");
    const range = document.createRange(); range.selectNodeContents(code);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    fireEvent.mouseUp(code); fireEvent.click(screen.getByRole("button", { name: "问 AI" }));
    await waitFor(() => expect(listener).toHaveBeenCalledOnce());
    const text = (listener.mock.calls[0]![0] as CustomEvent).detail.text as string;
    expect(text).toContain("code");
    expect(text).not.toContain("mention://agent/");
    window.removeEventListener("multica:append-issue-comment", listener);
  });
  it("does not insert into another issue when the user navigates during lookup", async () => {
    let finish!: (value: never[]) => void;
    vi.mocked(api.listTasksByIssue).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const listener = vi.fn(); window.addEventListener("multica:append-issue-comment", listener);
    renderDock();
    fireEvent.click(await screen.findByText("CL 123"));
    fireEvent.click(await screen.findByText("file.cs"));
    const code = await screen.findByText("code");
    const range = document.createRange(); range.selectNodeContents(code);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    fireEvent.mouseUp(code); fireEvent.click(screen.getByRole("button", { name: "问 AI" }));
    routeState.pathname = "/ws/issues/OTHER-2";
    finish([]);
    await waitFor(() => expect(screen.getByRole("button", { name: "问 AI" })).toBeEnabled());
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener("multica:append-issue-comment", listener);
  });
  it("makes the selected changelist and file clear and shows a loading state", async () => {
    let resolveFiles!: (rows: typeof file[]) => void;
    vi.mocked(window.desktopAPI.p4ChangeFiles).mockReturnValue(new Promise((resolve) => { resolveFiles = resolve; }));
    renderDock();
    const changeButton = (await screen.findByText("CL 123")).closest("button")!;
    fireEvent.click(changeButton);
    expect(changeButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("正在加载文件…")).toBeInTheDocument();
    resolveFiles([file]);
    const fileButton = (await screen.findByText("file.cs")).closest("button")!;
    fireEvent.click(fileButton);
    expect(fileButton).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("code")).toBeInTheDocument();
  });
  it("explains an empty changelist after loading", async () => {
    vi.mocked(window.desktopAPI.p4ChangeFiles).mockResolvedValue([]);
    renderDock();
    fireEvent.click(await screen.findByText("CL 123"));
    expect(await screen.findByText("这个 CL 没有待提交文件")).toBeInTheDocument();
  });
  it("constrains long diff content within the code area", async () => {
    const { container } = renderDock();
    fireEvent.click(await screen.findByText("CL 123"));
    fireEvent.click(await screen.findByText("file.cs"));
    const diff = await screen.findByRole("region", { name: "Diff" });
    expect(container.querySelector(".p4-dock")).toHaveClass("min-w-0");
    expect(screen.getByRole("region", { name: "代码差异" })).toHaveClass("min-w-0");
    expect(diff).toHaveClass("min-w-0");
  });
});
