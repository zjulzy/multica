import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ replace: vi.fn(), hash: "#comment-reply-1" }));
vi.mock("../../navigation", () => ({ useNavigation: () => nav }));
vi.mock("./issue-detail", () => ({
  IssueDetail: ({ issueId, highlightCommentId }: { issueId: string; highlightCommentId?: string }) => <div>{issueId}:{highlightCommentId}</div>,
  IssueDetailSkeleton: () => null,
  IssueNotFound: () => null,
}));
vi.mock("./issue-peek", () => ({ IssuePeekHost: ({ children }: { children: React.ReactNode }) => children }));

import { CachedIssueDetail } from "./issue-detail-route";

describe("cached issue detail", () => {
  it("renders the resolved issue and comment highlight without rewriting navigation", () => {
    render(<CachedIssueDetail issueId="issue-1" />);
    expect(screen.getByText("issue-1:reply-1")).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
