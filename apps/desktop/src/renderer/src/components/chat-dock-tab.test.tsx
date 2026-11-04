import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatDockTab } from "./chat-dock-tab";

const state = vi.hoisted(() => ({ foreground: true, activeSessionId: "s1", sessions: [{ id: "s1", unread_count: 2 }, { id: "s2", unread_count: 3 }] }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: state.sessions }) }));
vi.mock("@multica/core/chat/queries", () => ({ chatSessionsOptions: () => ({ queryKey: ["chat"] }) }));
vi.mock("@multica/core/chat", () => ({ useChatStore: (selector: (value: typeof state) => unknown) => selector(state) }));
vi.mock("@multica/views/chat", () => ({ useAppForeground: () => state.foreground }));
vi.mock("@multica/views/i18n", () => ({ useT: () => ({ t: (selector: (value: { page: { title: string } }) => string) => selector({ page: { title: "Chat" } }) }) }));

describe("chat dock unread badge", () => {
  it("excludes the viewed session only when the chat is visible and the window is foreground", () => {
    const onClick = vi.fn();
    state.foreground = true;
    const { rerender } = render(<ChatDockTab workspaceId="ws" selected visible onClick={onClick} />);
    expect(screen.getByRole("button", { name: /Chat/ })).toHaveClass("bg-primary/15", "border-primary/40", "text-primary");
    expect(screen.getByRole("button", { name: /Chat/ })).not.toHaveClass("bg-background");
    expect(screen.getByLabelText("3")).toBeInTheDocument();
    expect(screen.getByLabelText("3")).toHaveAttribute("data-slot", "dock-unread-badge");
    rerender(<ChatDockTab workspaceId="ws" selected={false} visible={false} onClick={onClick} />);
    expect(screen.getByRole("button", { name: /Chat/ })).toHaveClass("bg-background");
    expect(screen.getByLabelText("5")).toBeInTheDocument();
    state.foreground = false;
    rerender(<ChatDockTab workspaceId="ws" selected visible onClick={onClick} />);
    expect(screen.getByLabelText("5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Chat/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
