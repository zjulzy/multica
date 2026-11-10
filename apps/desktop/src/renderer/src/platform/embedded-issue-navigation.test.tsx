import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useNavigation } from "@multica/views/navigation";
import { EmbeddedIssueNavigationProvider } from "./embedded-issue-navigation";

describe("embedded issue navigation bridge", () => {
  it("sends other pages to the shell while keeping the cached issue in place", () => {
    const send = vi.fn();
    function Probe() {
      const nav = useNavigation(), location = useLocation();
      return <><span>{location.pathname}{location.hash}</span><button onClick={() => nav.push("/team/projects")}>project</button><button onClick={() => nav.replace("/team/issues/ZC-1#comment-a")}>comment</button></>;
    }
    render(<MemoryRouter initialEntries={["/team/issues/ZC-1"]}><Routes><Route path="/:workspaceSlug/issues/:id" element={<EmbeddedIssueNavigationProvider workspaceSlug="team" issueRefs={["ZC-1", "uuid"]} appUrl="https://example.invalid" send={send}><Probe /></EmbeddedIssueNavigationProvider>} /></Routes></MemoryRouter>);
    act(() => screen.getByText("project").click());
    expect(send).toHaveBeenCalledWith({ kind: "shell", path: "/team/projects", replace: false });
    expect(screen.getByText("/team/issues/ZC-1")).toBeInTheDocument();
    act(() => screen.getByText("comment").click());
    expect(send).toHaveBeenCalledWith({ kind: "current-issue", path: "/team/issues/ZC-1#comment-a", replace: true });
    expect(screen.getByText("/team/issues/ZC-1#comment-a")).toBeInTheDocument();
  });
  it("ignores invalid content link requests", () => {
    const send = vi.fn();
    render(<MemoryRouter initialEntries={["/team/issues/ZC-1"]}><EmbeddedIssueNavigationProvider workspaceSlug="team" issueRefs={["ZC-1"]} appUrl="https://example.invalid" send={send}><div /></EmbeddedIssueNavigationProvider></MemoryRouter>);
    act(() => window.dispatchEvent(new CustomEvent("multica:navigate", { detail: { path: "https://attacker.invalid/" } })));
    expect(send).not.toHaveBeenCalled();
  });
});
