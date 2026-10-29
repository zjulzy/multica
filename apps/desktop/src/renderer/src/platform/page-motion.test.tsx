import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePageMotion } from "./page-motion";

describe("page motion", () => {
  it("animates navigation only when enabled, not on initial render", () => {
    const element = document.createElement("div");
    const animate = vi.fn();
    element.animate = animate;
    const host = document.createElement("div");
    host.appendChild(element);
    const hostRef = { current: host };
    const { rerender } = renderHook(({ url, enabled }) => usePageMotion(hostRef, url, enabled), {
      initialProps: { url: "/one", enabled: false },
    });
    expect(animate).not.toHaveBeenCalled();
    rerender({ url: "/two", enabled: false });
    expect(animate).not.toHaveBeenCalled();
    rerender({ url: "/two", enabled: true });
    expect(animate).not.toHaveBeenCalled();
    rerender({ url: "/three", enabled: true });
    expect(animate).toHaveBeenCalledOnce();
  });

  it("ignores query-only changes and can animate a newly mounted tab", () => {
    const element = document.createElement("div");
    element.animate = vi.fn();
    const host = document.createElement("div");
    host.appendChild(element);
    const ref = { current: host };
    const { rerender } = renderHook(({ url }) => usePageMotion(ref, url, true, true), {
      initialProps: { url: "/one?filter=a" },
    });
    expect(element.animate).toHaveBeenCalledOnce();
    rerender({ url: "/one?filter=b" });
    expect(element.animate).toHaveBeenCalledOnce();
    rerender({ url: "/two" });
    expect(element.animate).toHaveBeenCalledTimes(2);
  });
});
