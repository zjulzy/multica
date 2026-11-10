import { memo } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavigationProvider, useIsNavigating, useNavigation, useReportNavigating, type NavigationAdapter } from "@multica/views/navigation";
import { StableIssueNavigation } from "./stable-issue-navigation";

describe("cached issue navigation isolation", () => {
  it("keeps the background page on its own navigation snapshot until active again", () => {
    const renders = vi.fn();
    const Probe = memo(function Probe() { const nav = useNavigation(); renders(nav.pathname); return <span>{nav.pathname}</span>; });
    const child = <Probe />;
    const adapter = (pathname: string): NavigationAdapter => ({ pathname, searchParams: new URLSearchParams(), hash: "", push: vi.fn(), replace: vi.fn(), back: vi.fn(), getShareableUrl: (p) => p });
    const view = (path: string, active: boolean, committedPath = path) => <NavigationProvider value={adapter(path)}><StableIssueNavigation navigation={active ? adapter(path) : null} committedPath={committedPath}>{child}</StableIssueNavigation></NavigationProvider>;
    const { rerender } = render(view("/team/issues/one", true));
    expect(screen.getByText("/team/issues/one")).toBeInTheDocument();
    const count = renders.mock.calls.length;
    rerender(view("/team/issues/two", true, "/team/issues/one"));
    expect(renders).toHaveBeenCalledTimes(count);
    rerender(view("/team/issues/two", false));
    rerender(view("/team/projects", false));
    expect(renders).toHaveBeenCalledTimes(count);
    expect(screen.getByText("/team/issues/one")).toBeInTheDocument();
    rerender(view("/team/issues/one#again", true));
    expect(screen.getByText("/team/issues/one#again")).toBeInTheDocument();
  });
  it("keeps navigation progress connected to the outer shell", () => {
    const adapter: NavigationAdapter = { pathname: "/team/issues/one", searchParams: new URLSearchParams(), hash: "", push: vi.fn(), replace: vi.fn(), back: vi.fn(), getShareableUrl: (p) => p };
    function Report() { useReportNavigating(true); return null; }
    function Shell() { return <span>{useIsNavigating() ? "pending" : "idle"}</span>; }
    render(<NavigationProvider value={adapter}><Shell /><StableIssueNavigation navigation={adapter} committedPath={adapter.pathname}><Report /></StableIssueNavigation></NavigationProvider>);
    expect(screen.getByText("pending")).toBeInTheDocument();
  });
});
