// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "../../test/i18n";

const env = vi.hoisted(() => ({ entries: [] as any[], submitReply: vi.fn(), submitComment: vi.fn(), update: vi.fn(), navigate: vi.fn(), error: false, loading: false }));
vi.mock("@tanstack/react-query", async (importOriginal) => ({ ...(await importOriginal<typeof import("@tanstack/react-query")>()), useQuery: () => ({ data: { id: "issue-1", identifier: "ZC-1", title: "Task", status: "in_progress", project_id: null }, isLoading: false }) }));
vi.mock("@multica/core/auth", () => ({ useAuthStore: (select: (state: any) => unknown) => select({ user: { id: "user" } }) }));
vi.mock("@multica/core/hooks", () => ({ useWorkspaceId: () => "ws" }));
vi.mock("@multica/core/workspace/actor-directory", () => ({ ActorDirectoryBoundary: ({ children }: any) => <>{children}</> }));
vi.mock("@multica/core/paths", () => ({ useWorkspacePaths: () => ({ issueDetail: (id: string) => `/team/issues/${id}` }) }));
vi.mock("../../navigation", () => ({ useNavigation: () => ({ push: env.navigate }) }));
vi.mock("../../issues/hooks/use-issue-timeline", () => ({ useIssueTimeline: () => ({ timeline: env.entries, loading: env.loading, isError: env.error, refetch: vi.fn(), submitReply: env.submitReply, submitComment: env.submitComment }) }));
vi.mock("../../issues/actions/use-issue-actions", () => ({ useIssueActions: () => ({ updateField: env.update }) }));
vi.mock("../../issues/components/pickers", () => ({ StatusPicker: ({ onUpdate }: any) => <button onClick={() => onUpdate({ status: "done" })}>Change status</button>, AssigneePicker: ({ onUpdate }: any) => <button onClick={() => onUpdate({ assignee_id: "member" })}>Change assignee</button>, PriorityPicker: () => <span>Priority picker</span>, LabelPicker: () => <span>Label picker</span>, DueDatePicker: () => <span>Due date picker</span> }));
vi.mock("../../projects/components/issue-project-picker", () => ({ IssueProjectPicker: () => <span>Project picker</span> }));
vi.mock("../../issues/components/reply-input", () => ({ ReplyInput: ({ onSubmit }: any) => <button onClick={() => onSubmit("reply text")}>Send reply</button> }));
vi.mock("../../issues/components/comment-input", () => ({ CommentInput: ({ onSubmit }: any) => <button onClick={() => onSubmit("new text")}>Send comment</button> }));
vi.mock("../../common/actor-avatar", () => ({ ActorAvatar: () => null }));
vi.mock("../../editor", () => ({ ReadonlyContent: ({ content }: any) => <span>{content}</span>, AttachmentDownloadProvider: ({ children }: any) => <>{children}</> }));
import { InboxIssuePreview, LightweightInboxProvider } from "./inbox-issue-preview";

function comment(id: string, parent: string | null) { return { type: "comment", id, parent_id: parent, actor_type: "member", actor_id: "user", actor_name: "Ada", created_at: "2026-01-01", content: id }; }
beforeEach(() => { env.entries = []; env.submitReply.mockReset().mockResolvedValue("new"); env.submitComment.mockReset().mockResolvedValue("new"); env.update.mockReset(); env.navigate.mockReset(); env.error = false; env.loading = false; });
afterEach(cleanup);

describe("lightweight inbox issue preview", () => {
  it("uses the configured reply count", () => {
    env.entries = [comment("root", null), ...Array.from({ length: 8 }, (_, i) => comment(`reply-${i}`, "root"))];
    renderWithI18n(<LightweightInboxProvider value={{ enabled: true, replyLimit: 3 }}><InboxIssuePreview issueId="issue-1" /></LightweightInboxProvider>);
    expect(screen.getByText("root")).toBeTruthy();
    expect(screen.getByText("reply-5")).toBeTruthy();
    expect(screen.queryByText("reply-4")).toBeNull();
  });
  it("shows issue properties in a collapsible sidebar and keeps them editable", () => {
    env.entries = [comment("root", null)];
    renderWithI18n(<InboxIssuePreview issueId="issue-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Change assignee" }));
    expect(env.update).toHaveBeenCalledWith({ assignee_id: "member" });
    expect(screen.getByText("Project picker")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /sidebar/i }));
    expect(screen.queryByText("Project picker")).toBeNull();
  });
  it("shows a bounded context, replies in the target thread, and changes status", () => {
    env.entries = [comment("root", null), ...Array.from({ length: 20 }, (_, i) => comment(`reply-${i}`, "root"))];
    renderWithI18n(<InboxIssuePreview issueId="issue-1" highlightCommentId="reply-2" />);
    expect(screen.getByText("root")).toBeTruthy();
    expect(screen.getByText("reply-2")).toBeTruthy();
    expect(screen.getByText("reply-19")).toBeTruthy();
    expect(screen.queryByText("reply-3")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    expect(env.submitReply).toHaveBeenCalledWith("root", "reply text", undefined, undefined, undefined);
    fireEvent.click(screen.getByRole("button", { name: "Change status" }));
    expect(env.update).toHaveBeenCalledWith({ status: "done" });
  });
  it("does not expose a reply that would target the wrong thread when a message is missing", () => {
    env.entries = [comment("another-root", null)];
    renderWithI18n(<InboxIssuePreview issueId="issue-1" highlightCommentId="missing" />);
    expect(screen.queryByRole("button", { name: "Send reply" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /open.*issue/i }));
    expect(env.navigate).toHaveBeenCalledWith("/team/issues/ZC-1#comment-missing");
  });
});
