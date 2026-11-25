import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { P4Dock } from "./p4-dock";

vi.mock("@/stores/rendered-route-store", () => ({ useRenderedRouteStore: (selector: (s: { pathname: string }) => unknown) => selector({ pathname: "/ws/issues/ZGA-6594" }) }));
vi.mock("@multica/core/issues/canonical-id", () => ({ useCanonicalIssue: () => ({ canonicalId: "issue-1", issue: { identifier: "ZGA-6594", title: "[STORY-7148266388] 需求", description: "" } }) }));

const change = { client: "local", change: "123", desc: "ZGA-6594 work" };
const file = { depotFile: "//depot/file.cs", action: "edit", client: "local", change: "123" };

describe("P4 dock", () => {
  beforeEach(() => {
    Object.assign(window, { desktopAPI: { p4IssueChanges: vi.fn().mockResolvedValue([change]), p4ChangeFiles: vi.fn().mockResolvedValue([file]), p4FileDiff: vi.fn().mockResolvedValue("--- old\n+++ new\n+code"), p4RevertFile: vi.fn().mockResolvedValue(false) } });
  });
  it("loads matching CLs and files, then offers the selected diff as an issue draft", async () => {
    const listener = vi.fn(); window.addEventListener("multica:append-issue-comment", listener);
    render(<P4Dock workspaceId="ws" />);
    fireEvent.click(await screen.findByText("CL 123"));
    fireEvent.click(await screen.findByText("edit · file.cs"));
    const diff = await screen.findByText("code");
    const range = document.createRange(); range.selectNodeContents(diff);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    fireEvent.mouseUp(diff);
    fireEvent.click(screen.getByRole("button", { name: "问 AI" }));
    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0]![0] as CustomEvent).detail).toMatchObject({ issueId: "issue-1", text: expect.stringContaining("code") });
    expect(window.desktopAPI.p4IssueChanges).toHaveBeenCalledWith(["ZGA-6594", "7148266388"]);
    window.removeEventListener("multica:append-issue-comment", listener);
  });
  it("shows an error instead of silently hiding P4 failures", async () => {
    vi.mocked(window.desktopAPI.p4IssueChanges).mockRejectedValue(new Error("P4 unavailable"));
    render(<P4Dock workspaceId="ws" />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("P4 unavailable"));
  });
});
