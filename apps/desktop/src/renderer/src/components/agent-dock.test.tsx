import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  agents: [{ id: "a", name: "Alice", avatar_url: null }, { id: "b", name: "Bob", avatar_url: null }],
  tasks: [{ id: "t1", agent_id: "a", status: "running", issue_id: "i1", started_at: null }, { id: "t2", agent_id: "b", status: "queued", issue_id: "", chat_session_id: "chat-2", trigger_summary: "Review code" }],
  failTasks: false,
  seenTasks: [] as string[],
  refetch: vi.fn(),
}));
vi.mock("@multica/core/agents/queries", () => ({ agentTaskSnapshotOptions: () => ({ queryKey: ["tasks"] }) }));
vi.mock("@multica/core/workspace/queries", () => ({ agentListOptions: () => ({ queryKey: ["agents"] }) }));
vi.mock("@multica/core/issues", () => ({ issueDetailOptions: (_ws: string, id: string) => ({ queryKey: ["issue", id] }) }));
vi.mock("@multica/core/chat/queries", () => ({ useTaskMessages: (id: string) => { state.seenTasks.push(id); return { data: [{ seq: 1, type: "text", content: "Checking references" }] }; } }));
vi.mock("@multica/views/common/task-transcript", () => ({ buildTimeline: (messages: unknown[]) => messages }));
vi.mock("@tanstack/react-query", () => ({ useQuery: ({ queryKey }: { queryKey: string[] }) => ({ data: queryKey[0] === "agents" ? state.agents : queryKey[0] === "tasks" ? (state.failTasks ? undefined : state.tasks) : { identifier: "MUL-7", title: "Fix issue" }, isLoading: false, isError: queryKey[0] === "tasks" && state.failTasks, refetch: state.refetch }) }));
vi.mock("@multica/core/paths", () => ({ useWorkspacePaths: () => ({ agentDetail: (id: string) => `/agents/${id}`, issueDetail: (id: string) => `/issues/${id}`, chatSession: (id: string) => `/chat/${id}` }) }));
vi.mock("@multica/core/workspace/avatar-url", () => ({ resolvePublicFileUrl: () => null }));
vi.mock("@multica/ui/components/common/actor-avatar", () => ({ ActorAvatar: ({ name }: { name: string }) => <span>{name[0]}</span> }));
vi.mock("@multica/views/navigation", () => ({ AppLink: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
const strings = { dock: { loading: "Loading", empty: "None", load_error: "Could not load agents", retry: "Retry", active: "Active", running: "Running", queued: "Queued", minutes: "minutes", open_agent: "Open agent", current_task: "Current task", no_issue: "No issue", recent: "Recent", no_progress: "Waiting", chat_task: "Chat task", open_chat: "Open chat" } };
vi.mock("@multica/views/i18n", () => ({ useT: () => ({ t: (fn: (value: typeof strings) => string) => fn(strings) }) }));
import { AgentDock } from "./agent-dock";

describe("AgentDock", () => {
  it("selects the requested active agent and switches between real task summaries", () => {
    const { rerender } = render(<AgentDock workspaceId="ws" requestedAgent={{ agentId: "a" }} />);
    expect(screen.getByRole("link", { name: "MUL-7 Fix issue" })).toHaveAttribute("href", "/issues/i1");
    expect(screen.getByText("Checking references")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Bob/ }));
    expect(screen.getByText("Review code")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open chat/ })).toHaveAttribute("href", "/chat/chat-2");
    expect(screen.getByRole("link", { name: /Open agent/ })).toHaveAttribute("href", "/agents/b");
    rerender(<AgentDock workspaceId="ws" requestedAgent={{ agentId: "a" }} />);
    expect(screen.getByRole("link", { name: "MUL-7 Fix issue" })).toHaveAttribute("href", "/issues/i1");
  });
  it("starts with the requested agent without loading the first agent's task", () => {
    state.seenTasks = [];
    render(<AgentDock workspaceId="ws" requestedAgent={{ agentId: "b" }} />);
    expect(state.seenTasks).not.toContain("t1");
    expect(screen.getByText("Review code")).toBeInTheDocument();
  });
  it("shows an error and retry instead of an empty state when loading fails", () => {
    state.failTasks = true;
    try {
      render(<AgentDock workspaceId="ws" requestedAgent={null} />);
      expect(screen.getByText("Could not load agents")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(state.refetch).toHaveBeenCalled();
    } finally { state.failTasks = false; }
  });
});
