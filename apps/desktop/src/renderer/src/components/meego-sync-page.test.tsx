import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ status: vi.fn(), syncIds: vi.fn(), syncAll: vi.fn(), saveSchedule: vi.fn(), log: vi.fn() }));
vi.mock("@multica/core/api", () => ({ api: { getBaseUrl: () => "https://example.test", getToken: () => "token" } }));
vi.mock("@multica/core/auth", () => ({ useAuthStore: (selector: (value: any) => unknown) => selector({ user: { id: "u1" } }) }));
vi.mock("@multica/core/paths", () => ({ useCurrentWorkspace: () => ({ id: "ws", slug: "zgame" }) }));
vi.mock("@multica/views/i18n", () => ({ useLocale: () => "zh-Hans" }));
vi.mock("@multica/views/layout", () => ({ PageHeader: ({ children }: any) => <header>{children}</header> }));
vi.mock("./meego-sync-api", () => ({ createMeegoSyncApi: () => state }));
import { MeegoSyncPage } from "./meego-sync-page";

const snapshot = { workspace: "zgame", user: "user", running: false, schedule: { mode: "daily", times: ["00:00"], every: 60, label: "Daily", next: "Tomorrow", intervals: [{ every: 60, label: "1h" }] }, runs: [], groups: [], exclude: [] };
beforeEach(() => { for (const fn of Object.values(state)) fn.mockReset(); state.status.mockResolvedValue(snapshot); state.syncIds.mockResolvedValue({ ok: true, message: "done" }); state.syncAll.mockResolvedValue({ ok: true }); state.saveSchedule.mockResolvedValue({ ok: true }); });
function mount() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); const view = render(<QueryClientProvider client={client}><MeegoSyncPage /></QueryClientProvider>); return { ...view, client }; }
describe("Meego sync page", () => {
  it("does not run sync on load and sends selected IDs only when clicked", async () => {
    mount(); await screen.findByText("手动同步");
    expect(state.syncIds).not.toHaveBeenCalled(); expect(state.syncAll).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Meego 单号或链接"), { target: { value: "123 456" } });
    fireEvent.click(screen.getByRole("button", { name: "同步这些单" }));
    await waitFor(() => expect(state.syncIds).toHaveBeenCalledWith("zgame", "123 456"));
  });
  it("keeps unsaved schedule edits when a status refresh arrives", async () => {
    const { client } = mount(); await screen.findByText("定时同步");
    fireEvent.change(screen.getByLabelText("同步时间 1"), { target: { value: "09:30" } });
    client.setQueryData(["meego-sync", "https://example.test", "u1", "ws"], { ...snapshot, schedule: { ...snapshot.schedule, times: ["10:00"] } });
    expect(screen.getByLabelText("同步时间 1")).toHaveValue("09:30");
  });
  it("requires confirmation for full sync", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    mount(); await screen.findByText("手动同步");
    fireEvent.click(screen.getByRole("button", { name: "立即全量同步" }));
    expect(state.syncAll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "立即全量同步" }));
    await waitFor(() => expect(state.syncAll).toHaveBeenCalledWith("zgame"));
    confirm.mockRestore();
  });
  it("saves the edited schedule only on explicit action", async () => {
    mount(); await screen.findByText("定时同步");
    fireEvent.change(screen.getByLabelText("同步时间 1"), { target: { value: "09:30" } });
    expect(state.saveSchedule).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(state.saveSchedule).toHaveBeenCalledWith("zgame", { mode: "daily", times: ["09:30"], every: 60 }));
  });
  it("explains unavailable actions and shows the selected sync in progress", async () => {
    state.syncIds.mockReturnValue(new Promise(() => {}));
    mount(); await screen.findByText("手动同步");
    expect(screen.getByText("请先输入单号或链接")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Meego 单号或链接"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "同步这些单" }));
    expect(await screen.findByRole("button", { name: "同步中…" })).toBeDisabled();
  });
  it("explains when a full sync is already running", async () => {
    state.status.mockResolvedValue({ ...snapshot, running: true });
    mount(); await screen.findByText("手动同步");
    expect(screen.getByRole("button", { name: "已有同步任务运行中" })).toBeDisabled();
  });
  it("shows schedule feedback in the schedule section", async () => {
    mount(); await screen.findByText("定时同步");
    fireEvent.change(screen.getByLabelText("同步时间 1"), { target: { value: "09:30" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    const section = screen.getByText("定时同步").closest("section")!;
    expect(await within(section).findByText("操作完成")).toBeInTheDocument();
  });
  it("prevents operations in a different workspace", async () => {
    state.status.mockResolvedValue({ ...snapshot, workspace: "other" });
    mount(); expect(await screen.findByRole("alert")).toHaveTextContent("other");
    expect(screen.queryByRole("button", { name: "立即全量同步" })).toBeNull();
  });
  it("loads a run log only after expanding that run", async () => {
    state.status.mockResolvedValue({ ...snapshot, runs: [{ id: "r1", started: "10:00", mode: "full", trigger: "cron", running: false, exit: 0, lines: 2, counts: null }] });
    state.log.mockResolvedValue({ log: "sync complete" });
    mount(); await screen.findByText("运行记录");
    expect(state.log).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /10:00.*全量/ }));
    expect(await screen.findByText("sync complete")).toBeInTheDocument();
    expect(state.log).toHaveBeenCalledWith("r1");
  });
});
