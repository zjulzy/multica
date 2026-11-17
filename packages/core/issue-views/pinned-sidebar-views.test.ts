// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { usePinnedSidebarViews } from "./pinned-sidebar-views";

describe("pinned sidebar views", () => {
  it("keeps builtin and saved views per account and workspace", () => {
    const store = usePinnedSidebarViews.getState();
    store.pin("one", "builtin:my_issues");
    store.pin("one", "view:abc");
    store.pin("one", "view:abc");
    store.pin("two", "builtin:all_issues");
    expect(usePinnedSidebarViews.getState().byScope.one).toEqual(["builtin:my_issues", "view:abc"]);
    store.unpin("one", "builtin:my_issues");
    expect(usePinnedSidebarViews.getState().byScope.one).toEqual(["view:abc"]);
    expect(usePinnedSidebarViews.getState().byScope.two).toEqual(["builtin:all_issues"]);
  });
});
