import { useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavigationBridgeProvider, NavigationProvider, useIsNavigating, useNavigationBridge, useReportNavigating } from "./context";
import type { NavigationAdapter } from "./types";

describe("navigation context bridge", () => {
  it("keeps a separate page root connected to the shell's progress reporter", () => {
    const adapter: NavigationAdapter = { pathname: "/team/issues/a", searchParams: new URLSearchParams(), hash: "", push: vi.fn(), replace: vi.fn(), back: vi.fn(), getShareableUrl: (p) => p };
    let snapshot: ReturnType<typeof useNavigationBridge> | undefined;
    function Capture() { const value = useNavigationBridge(); useLayoutEffect(() => { snapshot = value; }, [value]); return <span>{useIsNavigating() ? "pending" : "idle"}</span>; }
    function Report() { useReportNavigating(true); return null; }
    const shell = render(<NavigationProvider value={adapter}><Capture /></NavigationProvider>);
    const host = document.createElement("div"); document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<NavigationBridgeProvider value={snapshot!}><Report /></NavigationBridgeProvider>));
    expect(screen.getByText("pending")).toBeInTheDocument();
    act(() => root.unmount()); host.remove(); shell.unmount();
  });
});
