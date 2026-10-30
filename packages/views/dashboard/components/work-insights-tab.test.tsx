import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "@multica/core/types";
import { WorkInsightsTab } from "./work-insights-tab";

const api = vi.hoisted(() => ({ listAgentTasksPage: vi.fn(), listIssues: vi.fn() }));
vi.mock("@multica/core/api", () => ({ api }));
vi.mock("../../i18n", () => ({ useT: () => ({ i18n: { language: "zh-CN" } }) }));

describe("work insights filters", () => {
  beforeEach(() => {
    api.listAgentTasksPage.mockReset();
    api.listIssues.mockReset();
    api.listAgentTasksPage.mockImplementation(async (id: string) => ({ tasks: [{ id, agent_id: id, issue_id: id === "a" ? "i" : "j", started_at: new Date().toISOString(), completed_at: null }], nextCursor: null }));
    api.listIssues.mockResolvedValue({ issues: [{ id: "i" }], total: 1 });
  });
  it("filters the four modules using project and agent selections", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const toolbar = document.createElement("div");
    document.body.append(toolbar);
    render(<QueryClientProvider client={client}><WorkInsightsTab filterTarget={toolbar} wsId="w" agents={[{ id: "a", name: "A" }, { id: "b", name: "B" }] as Agent[]} agentsLoading={false} agentsError={false} projectId="p" timeZone="UTC" /></QueryClientProvider>);
    expect(toolbar.querySelector("#insights-period")).not.toBeNull();
    expect(toolbar.querySelector("#insights-agent")).not.toBeNull();
    await waitFor(() => expect(screen.getByText("次运行").previousSibling).toHaveTextContent("1"));
    expect(screen.getByText("工作日历")).toBeInTheDocument();
    expect(screen.getByText("荣誉墙")).toBeInTheDocument();
    expect(screen.getByText("工作节奏")).toBeInTheDocument();
    expect(screen.getByLabelText("运行次数纵轴")).toHaveTextContent("1");
    expect(screen.getByLabelText("运行次数纵轴")).toHaveTextContent("0");
    expect(screen.getByText("工作空间 · 工作概览")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("智能体"), "b");
    await waitFor(() => expect(screen.getByText("次运行").previousSibling).toHaveTextContent("0"));
  });
});
