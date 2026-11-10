import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PerformanceDashboard } from "./performance-dashboard";

const data = vi.hoisted(() => ({ desktop: vi.fn(), liwork: vi.fn() }));
vi.mock("@multica/core/paths", () => ({ useCurrentWorkspace: () => ({ id: "ws", slug: "team" }), useWorkspacePaths: () => ({ agentDetail: (id: string) => `/team/agents/${id}` }), paths: { workspace: (slug: string) => ({ issueDetail: (id: string) => `/${slug}/issues/${id}` }) } }));
vi.mock("@multica/core/workspace/queries", () => ({ agentListOptions: () => ({ queryKey: ["agents"], queryFn: async () => [{ id: "agent", name: "Agent A" }] }) }));
vi.mock("@multica/core/agents/queries", () => ({ agentTaskSnapshotOptions: () => ({ queryKey: ["tasks"], queryFn: async () => [{ id: "task", agent_id: "agent", status: "running", issue_id: "issue" }] }) }));
vi.mock("@multica/core/workspace", () => ({ workspaceListOptions: () => ({ queryKey: ["workspaces"], queryFn: async () => [] }) }));
vi.mock("@multica/views/i18n", () => ({ useLocale: () => "zh-Hans" }));
vi.mock("@multica/views/layout", () => ({ PageHeader: ({ children }: any) => <header>{children}</header> }));
vi.mock("@multica/views/navigation", () => ({ AppLink: ({ href, children }: any) => <a href={href}>{children}</a> }));
beforeEach(() => {
  data.desktop.mockReset().mockResolvedValue({ totalCpu: 3, totalMemory: 104857600, sampledAt: Date.now(), processes: [{ pid: 42, kind: "window", cpu: 3, memory: 104857600 }] });
  data.liwork.mockReset().mockResolvedValue({ sessions: [], terminalsAvailable: true, metricsAvailable: true, sampledAt: Date.now() });
  Object.defineProperty(window, "desktopAPI", { configurable: true, value: { getDesktopPerformanceSnapshot: data.desktop, getLiworkSnapshot: data.liwork } });
});
describe("performance dashboard", () => {
  it("shows live client usage and active agents without inventing agent resource data", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><PerformanceDashboard /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText("Agent A")).toBeInTheDocument());
    expect(screen.getAllByText("100 MB").length).toBeGreaterThan(0);
    expect(screen.getByText(/资源占用不可用/)).toBeInTheDocument();
    expect(data.desktop).toHaveBeenCalled();
    view.unmount(); client.clear();
  });
});
