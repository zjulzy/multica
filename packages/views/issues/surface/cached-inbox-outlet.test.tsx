import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CachedInboxOutlet, CachedInboxOutletProvider } from "./cached-inbox-outlet";

describe("cached inbox outlet", () => {
  const props = { issueId: "issue-1", workspaceId: "workspace-1", source: "dock" as const, active: true, onDone: () => {}, onDelete: () => {} };
  it("keeps the normal detail if no cache host is installed", () => {
    render(<CachedInboxOutlet {...props}><div>normal detail</div></CachedInboxOutlet>);
    expect(screen.getByText("normal detail")).toBeTruthy();
  });
  it("passes the selection and message target to the cache host", () => {
    render(<CachedInboxOutletProvider value={(value) => <div>{value.issueId}:{value.highlightCommentId}</div>}><CachedInboxOutlet {...props} highlightCommentId="reply-1"><div>normal detail</div></CachedInboxOutlet></CachedInboxOutletProvider>);
    expect(screen.getByText("issue-1:reply-1")).toBeTruthy();
    expect(screen.queryByText("normal detail")).toBeNull();
  });
});
