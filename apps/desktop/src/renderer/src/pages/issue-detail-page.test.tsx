import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ eligible: true, loaded: true }));
vi.mock("react-router-dom", () => ({ useParams: () => ({ id: "ZC-1" }) }));
vi.mock("@multica/core/hooks", () => ({ useWorkspaceId: () => "ws" }));
vi.mock("@multica/core/issues/canonical-id", () => ({ useCanonicalIssue: () => ({ canonicalId: "issue-1", issue: state.loaded ? { id: "issue-1", identifier: "ZC-1", title: "Title" } : undefined }) }));
vi.mock("@/hooks/use-document-title", () => ({ useDocumentTitle: () => {} }));
vi.mock("@/components/use-pinned-issue-eligibility", () => ({ usePinnedIssueEligibility: (_ws: string, _id: string, allow: boolean) => allow && state.eligible }));
vi.mock("@multica/views/issues/components", () => ({ IssueDetailRoute: ({ suppressDetail }: { suppressDetail?: boolean }) => <div>{suppressDetail ? "route only" : "route and page"}</div> }));
import { IssueDetailPage } from "./issue-detail-page";
describe("cached issue route", () => {
  it("keeps the route mounted while the cache owns its body", () => {
    state.eligible = true;
    const { rerender } = render(<IssueDetailPage />);
    expect(screen.getByText("route only")).toBeInTheDocument();
    state.eligible = false;
    rerender(<IssueDetailPage />);
    expect(screen.getByText("route and page")).toBeInTheDocument();
  });
  it("keeps dedicated issue windows independent", () => {
    state.eligible = true;
    render(<IssueDetailPage onDelete={() => {}} />);
    expect(screen.getByText("route and page")).toBeInTheDocument();
  });
  it("does not mount a duplicate while a canonical issue is loading", () => {
    state.eligible = true; state.loaded = false;
    render(<IssueDetailPage />);
    expect(screen.getByText("route only")).toBeInTheDocument();
    state.loaded = true;
  });
});
