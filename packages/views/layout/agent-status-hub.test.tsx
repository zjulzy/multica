import React from "react";
import { renderWithI18n } from "../test/i18n";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent, AgentTask, InboxItem } from "@multica/core/types";
import { AgentStatusHub } from "./agent-status-hub";

const data = vi.hoisted(() => ({ agents: [] as Agent[], tasks: [] as AgentTask[], inbox: [] as InboxItem[] }));
vi.mock("@multica/core/paths", () => ({
  useCurrentWorkspace: () => ({ id: "ws-1" }),
  useWorkspacePaths: () => ({ agentDetail: (id: string) => `/acme/agents/${id}`, inbox: () => "/acme/inbox" }),
}));
vi.mock("@multica/core/workspace/queries", () => ({ agentListOptions: () => ({ queryKey: ["agents"] }) }));
vi.mock("@multica/core/agents/queries", () => ({ agentTaskSnapshotOptions: () => ({ queryKey: ["tasks"] }) }));
vi.mock("@multica/core/inbox/queries", async (importOriginal) => ({ ...(await importOriginal<typeof import("@multica/core/inbox/queries")>()), inboxListOptions: () => ({ queryKey: ["inbox"] }) }));
vi.mock("@multica/core/api", () => ({ api: { getBaseUrl: () => "https://example.test" } }));
vi.mock("@tanstack/react-query", () => ({ useQuery: (options: { queryKey: string[] }) => ({ data: options.queryKey[0] === "agents" ? data.agents : options.queryKey[0] === "inbox" ? data.inbox : data.tasks }) }));
vi.mock("../navigation", () => ({ AppLink: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@multica/ui/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ render, children }: { render: React.ReactElement<{ children?: React.ReactNode }>; children: React.ReactNode }) => React.cloneElement(render, {}, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const agent = (id: string, name: string) => ({ id, name, avatar_url: null } as Agent);
const task = (agentId: string, status: AgentTask["status"], id: string) => ({ id, agent_id: agentId, status } as AgentTask);
const notification = (overrides: Partial<InboxItem> = {}): InboxItem => ({
  id: "notice-1", workspace_id: "ws-1", recipient_type: "member", recipient_id: "user-1",
  actor_type: "agent", actor_id: "a", type: "status_changed", severity: "info", issue_id: "issue-1",
  title: "Issue", body: null, issue_status: null, read: false, archived: false, created_at: "2026-10-29T01:00:00Z", details: null,
  ...overrides,
});

describe("AgentStatusHub", () => {
  beforeEach(() => { data.agents = []; data.tasks = []; data.inbox = []; });

  it("shows each active agent once with running and queued counts and an agent page link", () => {
    data.agents = [agent("a", "Alice"), agent("b", "Bob"), agent("c", "Carol")];
    data.tasks = [task("a", "running", "1"), task("a", "running", "2"), task("a", "queued", "3"), task("b", "waiting_local_directory", "4"), task("c", "completed", "5")];
    renderWithI18n(<AgentStatusHub />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Alice/ })).toHaveAttribute("href", "/acme/agents/a");
    expect(screen.getByText("Running: 2 · Queued: 1")).toBeInTheDocument();
    expect(screen.getByText("Running: 0 · Queued: 1")).toBeInTheDocument();
    expect(screen.queryByText("Carol")).not.toBeInTheDocument();
  });

  it("hides the hub when there are no active agents", () => {
    data.agents = [agent("a", "Alice")];
    data.tasks = [task("a", "failed", "1")];
    const { container } = renderWithI18n(<AgentStatusHub />);
    expect(container).toBeEmptyDOMElement();
  });

  it("updates from queued to running and disappears when the task completes", () => {
    data.agents = [agent("a", "Alice")];
    data.tasks = [task("a", "dispatched", "1")];
    const { rerender, container } = renderWithI18n(<AgentStatusHub />);
    expect(screen.getByText("Running: 0 · Queued: 1")).toBeInTheDocument();
    data.tasks = [task("a", "running", "1")];
    rerender(<AgentStatusHub />);
    expect(screen.getByText("Running: 1 · Queued: 0")).toBeInTheDocument();
    data.tasks = [task("a", "completed", "1")];
    rerender(<AgentStatusHub />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an idle agent with an unread visible notification and opens its latest Inbox item", () => {
    data.agents = [agent("a", "Alice")];
    data.inbox = [notification(), notification({ id: "notice-2", issue_id: "issue-2", created_at: "2026-10-29T02:00:00Z" })];
    const { rerender, container } = renderWithI18n(<AgentStatusHub />);
    expect(screen.getByRole("link", { name: /Alice/ })).toHaveAttribute("href", "/acme/inbox?issue=issue-2");
    data.inbox = data.inbox.map((item) => ({ ...item, read: true }));
    rerender(<AgentStatusHub />);
    expect(container).toBeEmptyDOMElement();
  });

  it("matches the Inbox visible grouped row, not an older hidden notification", () => {
    data.agents = [agent("a", "Alice"), agent("b", "Bob")];
    data.inbox = [notification(), notification({ id: "notice-2", actor_id: "b", created_at: "2026-10-29T02:00:00Z" })];
    renderWithI18n(<AgentStatusHub />);
    expect(screen.queryByRole("link", { name: /Alice/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Bob/ })).toHaveAttribute("href", "/acme/inbox?issue=issue-1");
  });

  it("prioritizes unread navigation for a running agent without losing its running state", () => {
    data.agents = [agent("a", "Alice")];
    data.tasks = [task("a", "running", "1"), task("a", "queued", "2")];
    data.inbox = [notification({ issue_id: null, id: "notice-1" })];
    renderWithI18n(<AgentStatusHub />);
    const link = screen.getByRole("link", { name: /Alice/ });
    expect(link).toHaveAttribute("href", "/acme/inbox?issue=notice-1");
    expect(screen.getByText("Running: 1 · Queued: 1")).toBeInTheDocument();
    expect(link.querySelector('[data-agent-workload="running"]')).toBeInTheDocument();
    expect(link.querySelector('[data-agent-unread]')).toBeInTheDocument();
    expect(link.querySelector(".lucide-hourglass")).not.toBeInTheDocument();
  });

  it("shows unread and queued indicators together", () => {
    data.agents = [agent("a", "Alice")];
    data.tasks = [task("a", "queued", "1")];
    data.inbox = [notification()];
    renderWithI18n(<AgentStatusHub />);
    const link = screen.getByRole("link", { name: /Alice/ });
    expect(link.querySelector('[data-agent-workload="queued"]')).toBeInTheDocument();
    expect(link.querySelector('[data-agent-unread]')).toBeInTheDocument();
    expect(link.querySelector(".lucide-hourglass")).toBeInTheDocument();
  });

});
