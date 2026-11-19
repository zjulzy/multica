import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Issue } from "@multica/core/types";

const mock = vi.hoisted(() => ({ pin: vi.fn(), update: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: null }) }));
vi.mock("@multica/core/hooks", () => ({ useWorkspaceId: () => "workspace" }));
vi.mock("@multica/core/paths", () => ({ useWorkspacePaths: () => ({ issueDetail: (id: string) => `/issue/${id}`, projectDetail: (id: string) => `/project/${id}`, issues: () => "/issues" }) }));
vi.mock("@multica/core/workspace/actor-directory", () => ({ ActorDirectoryBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@multica/core/issues", () => ({ issueBehavesAsAny: () => false }));
vi.mock("@multica/core/issues/queries", () => ({ issueDetailOptions: () => ({ queryKey: ["issue"] }) }));
vi.mock("@multica/core/projects/queries", () => ({ projectDetailOptions: () => ({ queryKey: ["project"] }) }));
vi.mock("../../i18n", () => ({ useT: (name: string) => ({ t: (select: (x: unknown) => string) => select(name === "common" ? { more_actions: "More" } : { detail: { unpin_tooltip: "Unpin", pin_tooltip: "Pin", sidebar_tooltip: "Properties" } }) }) }));
vi.mock("../../navigation", () => ({ AppLink: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("../../projects/components/project-icon", () => ({ ProjectIcon: () => null }));
vi.mock("../../layout/panels/show-in-sidebar", () => ({ useShowInSidebar: () => undefined }));
vi.mock("../../common/shortcut-keycaps", () => ({ ActionShortcutKeycaps: () => null }));
vi.mock("@multica/ui/components/common/icon-button", () => ({ IconButton: ({ label, onClick, children, variant }: { label: string; onClick?: () => void; children: React.ReactNode; variant?: string }) => <button aria-label={label} data-variant={variant} onClick={onClick}>{children}</button> }));
vi.mock("../actions", () => ({
  useIssueActions: () => ({ isPinned: true, togglePin: mock.pin, updateField: mock.update }),
  useArchivedInboxItemId: () => undefined,
  IssueInboxActions: () => <span>Inbox actions</span>,
  IssueActionsDropdown: ({ issue }: { issue: Issue }) => <span>Menu for {issue.identifier}</span>,
}));
vi.mock("./issue-agent-header-chip", () => ({ IssueAgentHeaderChip: ({ onJumpToRun }: { onJumpToRun: (id: string) => void }) => <button onClick={() => onJumpToRun("task-1")}>Run</button> }));
vi.mock("./issue-wakeup-header-chip", () => ({ IssueWakeupHeaderChip: ({ onOpen }: { onOpen: () => void }) => <button onClick={onOpen}>Wakeups</button> }));

import { EmbeddedIssueShellHeader } from "./embedded-issue-shell-header";

describe("cached issue header", () => {
  it("shows the current issue, preserves its actions and forwards guest commands", () => {
    const command = vi.fn();
    const issue = { id: "one", identifier: "ZGA-1", title: "First task", status: "todo" } as Issue;
    const view = render(<EmbeddedIssueShellHeader issue={issue} sidebarOpen onCommand={command} />);
    expect(screen.getByText("ZGA-1 First task")).toBeInTheDocument();
    expect(screen.getByText("Menu for ZGA-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Properties" })).toHaveAttribute("data-variant", "secondary");
    fireEvent.click(screen.getByRole("button", { name: "Properties" }));
    fireEvent.click(screen.getByRole("button", { name: "Wakeups" }));
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    fireEvent.click(screen.getByRole("button", { name: "Unpin" }));
    expect(command.mock.calls).toEqual([[{ command: "toggle-sidebar" }], [{ command: "open-wakeups" }], [{ command: "jump-to-run", taskId: "task-1" }]]);
    expect(mock.pin).toHaveBeenCalled();
    view.rerender(<EmbeddedIssueShellHeader issue={{ ...issue, id: "two", identifier: "ZGA-2", title: "Second task" }} sidebarOpen={false} onCommand={command} />);
    expect(screen.queryByText("ZGA-1 First task")).toBeNull();
    expect(screen.getByText("ZGA-2 Second task")).toBeInTheDocument();
    expect(screen.getByText("Menu for ZGA-2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Properties" })).toHaveAttribute("data-variant", "ghost");
  });
});
