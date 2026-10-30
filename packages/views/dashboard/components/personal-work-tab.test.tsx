import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalWorkTab } from "./personal-work-tab";
import type { ComponentProps } from "react";

const mocks = vi.hoisted(() => ({ listIssues: vi.fn(), listTimelineForStats: vi.fn(), listIssueStatuses: vi.fn(), push: vi.fn() }));
vi.mock("@multica/core/api", () => ({ api: mocks }));
vi.mock("@multica/core/auth", () => ({ useAuthStore: (selector: (value: { user: { id: string } }) => unknown) => selector({ user: { id: "me" } }) }));
vi.mock("@multica/core/paths", () => ({ useWorkspacePaths: () => ({ issueDetail: (id: string) => `/issues/${id}` }) }));
vi.mock("../../navigation", () => ({ useNavigation: () => ({ push: mocks.push }) }));
vi.mock("../../i18n", () => ({ useT: () => ({ i18n: { language: "zh-CN" } }) }));

describe("personal work tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const now = new Date().toISOString();
    mocks.listIssues.mockResolvedValue({ issues: [{ id: "i", identifier: "ZC-1", title: "测试任务", creator_type: "member", creator_id: "me", created_at: now }], total: 1 });
    mocks.listTimelineForStats.mockResolvedValue({ entries: [{ id: "c", type: "comment", actor_type: "member", actor_id: "me", created_at: now }, { id: "old", type: "comment", actor_type: "member", actor_id: "me", created_at: "2020-01-02T12:00:00Z" }, { id: "a", type: "comment", actor_type: "agent", actor_id: "agent", created_at: now }, { id: "done", type: "activity", action: "status_changed", details: { to: "done" }, actor_type: "agent", actor_id: "agent", created_at: now }], truncated: false });
    mocks.listIssueStatuses.mockResolvedValue({ statuses: [] });
  });
  it("shows aggregate insights without individual activity details", async () => {
    const toolbar = document.createElement("div"); document.body.append(toolbar);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><PersonalWorkTab wsId="ws" projectId="p" timeZone="UTC" filterTarget={toolbar} agents={[{ id: "agent", owner_id: "me" }]} agentsLoading={false} agentsError={false} /></QueryClientProvider>);
    expect(within(toolbar).getByLabelText("统计范围")).toBeInTheDocument();
    await screen.findByText("操作构成");
    expect(mocks.listIssues).toHaveBeenCalledWith(expect.objectContaining({ project_id: "p" }), expect.objectContaining({ strict: true, signal: expect.any(AbortSignal) }));
    expect(screen.queryByText("操作明细")).toBeNull();
    expect(screen.getByText("活跃天数")).toBeInTheDocument();
    expect(screen.getByText("任务覆盖")).toBeInTheDocument();
    expect(screen.getByText("完成任务")).toBeInTheDocument();
    expect(screen.getByText("完成任务").parentElement).toHaveTextContent("1");
    expect(screen.queryByText("标记完成")).toBeNull();
    expect(screen.getByText("最忙的一天")).toBeInTheDocument();
    expect(screen.getByText("活跃时段")).toBeInTheDocument();
    await userEvent.selectOptions(within(toolbar).getByLabelText("统计范围"), "custom");
    expect(within(toolbar).getByLabelText("开始日期")).toBeInTheDocument();
    await userEvent.selectOptions(within(toolbar).getByLabelText("统计范围"), "week");
    const week = within(toolbar).getByLabelText("选择周");
    expect(week).toHaveAttribute("type", "week");
    fireEvent.change(week, { target: { value: "2026-W01" } });
    expect(screen.getAllByText("2025-12-29").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2026-01-04").length).toBeGreaterThan(0);
    expect(screen.getByText("每日趋势")).toBeInTheDocument();
    await userEvent.selectOptions(within(toolbar).getByLabelText("统计范围"), "all");
    expect(within(toolbar).queryByLabelText("选择周")).toBeNull();
    expect(screen.getByText("2020-01-02")).toBeInTheDocument();
    expect(screen.getByText("每月趋势")).toBeInTheDocument();
  });
  it("does not present an incomplete agent ownership list as a valid completion count", async () => {
    const toolbar = document.createElement("div"); document.body.append(toolbar);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const agents = [{ id: "agent" }] as unknown as ComponentProps<typeof PersonalWorkTab>["agents"];
    render(<QueryClientProvider client={client}><PersonalWorkTab wsId="ws" projectId={null} timeZone="UTC" filterTarget={toolbar} agents={agents} agentsLoading={false} agentsError={false} /></QueryClientProvider>);
    await screen.findByText("操作构成");
    expect(screen.getByText("完成任务").parentElement).toHaveTextContent("—");
    expect(screen.getByText(/智能体列表读取失败/)).toBeInTheDocument();
  });
});
