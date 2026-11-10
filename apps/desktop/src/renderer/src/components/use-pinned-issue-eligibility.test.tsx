import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PinnedIssueCacheContext } from "./pinned-issue-cache-context";
import { usePinnedIssueEligibility } from "./use-pinned-issue-eligibility";

describe("pinned issue eligibility", () => {
  it("requires a cache host, enabled setting, matching pin and an eligible window", () => {
    const snapshot = { enabled: true, workspaceId: "ws", pinnedIds: new Set(["i1"]) };
    const render = (available: boolean, allow = true) => renderHook(() => usePinnedIssueEligibility("ws", "i1", allow), {
      wrapper: ({ children }) => <PinnedIssueCacheContext.Provider value={available ? snapshot : null}>{children}</PinnedIssueCacheContext.Provider>,
    }).result;
    expect(render(false).current).toBe(false);
    expect(render(true, false).current).toBe(false);
    expect(render(true).current).toBe(true);
  });
});
