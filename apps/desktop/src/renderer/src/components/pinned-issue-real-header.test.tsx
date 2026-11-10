import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader, PageHeaderPortalProvider } from "@multica/views/layout";
import { PinnedIssueCache } from "./pinned-issue-cache";

describe("cached issue real header portal", () => {
  it("shows only the active issue header when switching cached pages", () => {
    const header = document.createElement("div"); document.body.appendChild(header);
    const renderIssue = (id: string) => <PageHeader><span>issue-header:{id}</span></PageHeader>;
    const view = (id: string | null) => <PageHeaderPortalProvider value={header}><PinnedIssueCache enabled activeId={id} pinnedIds={["one", "two"]} renderIssue={renderIssue} /></PageHeaderPortalProvider>;
    const { rerender, unmount } = render(view("one"));
    rerender(view("two"));
    expect(screen.getByText("issue-header:one")).not.toBeVisible();
    expect(screen.getByText("issue-header:two")).toBeVisible();
    rerender(view("one"));
    expect(screen.getByText("issue-header:one")).toBeVisible();
    expect(screen.getByText("issue-header:two")).not.toBeVisible();
    unmount(); header.remove();
  });
});
