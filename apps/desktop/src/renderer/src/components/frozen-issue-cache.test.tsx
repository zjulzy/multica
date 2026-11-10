import { act, fireEvent, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { FrozenQueryMirror } from "./frozen-query-mirror";
import { FrozenIssueCache } from "./frozen-issue-cache";

describe("frozen issue cache prototype", () => {
  it("preserves real DOM and state while pausing registered background work", () => {
    const host = document.createElement("div"), header = document.createElement("div");
    document.body.append(host, header);
    const start = vi.fn(() => vi.fn());
    const effects = vi.fn();
    const cache = new FrozenIssueCache(host, header);
    const page = (id: string) => (target: HTMLElement | null, lifecycle: Parameters<Parameters<typeof cache.show>[1]>[1]) => {
      function Content() {
        const [count, setCount] = useState(0);
        useEffect(() => { effects(id); return lifecycle.track(start); }, []);
        return <>{createPortal(<span>header-{id}</span>, target!)}<button onClick={() => setCount(count + 1)}>{id}:{count}</button></>;
      }
      return <Content />;
    };
    act(() => cache.show("a", page("a")));
    fireEvent.click(screen.getByRole("button", { name: "a:0" }));
    const original = screen.getByRole("button", { name: "a:1" });
    act(() => cache.show("b", page("b")));
    expect(original).not.toBeVisible();
    expect(screen.getByText("header-a")).not.toBeVisible();
    expect(start.mock.results[0]!.value).toHaveBeenCalledTimes(1);
    act(() => cache.show("a", page("a")));
    expect(screen.getByRole("button", { name: "a:1" })).toBe(original);
    expect(screen.getByText("header-a")).toBeVisible();
    expect(effects.mock.calls.filter(([id]) => id === "a")).toHaveLength(1);
    act(() => cache.clear());
    host.remove(); header.remove();
  });
  it("exposes the remaining limitation: hidden query observers still rerender", async () => {
    const host = document.createElement("div"); document.body.append(host);
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    client.setQueryData(["issue"], "old");
    const renders = vi.fn();
    function Content() {
      const { data } = useQuery({ queryKey: ["issue"], queryFn: async () => "server" });
      renders(data);
      return <span>{data}</span>;
    }
    const cache = new FrozenIssueCache(host);
    act(() => cache.show("a", () => <QueryClientProvider client={client}><Content /></QueryClientProvider>));
    act(() => cache.show("b", () => <span>other</span>));
    const before = renders.mock.calls.length;
    act(() => client.setQueryData(["issue"], "new"));
    await vi.waitFor(() => expect(renders.mock.calls.length).toBeGreaterThan(before));
    expect(screen.getByText("new")).not.toBeVisible();
    act(() => cache.clear()); host.remove();
  });
  it("keeps a hidden page unchanged until its pending data is reconciled", async () => {
    const host = document.createElement("div"); document.body.append(host);
    const shared = new QueryClient(), local = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    shared.setQueryData(["issue"], "old");
    const mirror = new FrozenQueryMirror(shared, local);
    const renders = vi.fn();
    function Content() {
      const { data } = useQuery({ queryKey: ["issue"], queryFn: async () => "server" });
      renders(data);
      return <span>{data}</span>;
    }
    const cache = new FrozenIssueCache(host);
    act(() => cache.show("a", () => <QueryClientProvider client={local}><Content /></QueryClientProvider>));
    const original = screen.getByText("old");
    act(() => { mirror.setVisible(false); cache.show("b", () => <span>other</span>); });
    const before = renders.mock.calls.length;
    act(() => shared.setQueryData(["issue"], "new"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(renders).toHaveBeenCalledTimes(before);
    act(() => cache.show("a", () => <span>should not remount</span>));
    expect(screen.getByText("old")).toBe(original);
    act(() => mirror.setVisible(true));
    await vi.waitFor(() => expect(screen.getByText("new")).toBe(original));
    act(() => cache.clear()); mirror.dispose(); host.remove();
  });
  it("immediately discards an unpinned page and its header", () => {
    const host = document.createElement("div"), header = document.createElement("div"); document.body.append(host, header);
    const cache = new FrozenIssueCache(host, header);
    act(() => cache.show("a", (target) => <>{createPortal(<span>heading</span>, target!)}<span>content</span></>));
    act(() => cache.remove("a"));
    expect(screen.queryByText("heading")).toBeNull();
    expect(screen.queryByText("content")).toBeNull();
    expect(host.childElementCount).toBe(0);
    expect(header.childElementCount).toBe(0);
    host.remove(); header.remove();
  });
  it("exposes the remaining limitation: ordinary global listeners are not frozen automatically", () => {
    const host = document.createElement("div"); document.body.append(host);
    const received = vi.fn();
    function Page() {
      useEffect(() => { document.addEventListener("keydown", received); return () => document.removeEventListener("keydown", received); }, []);
      return <span>page</span>;
    }
    const cache = new FrozenIssueCache(host);
    act(() => cache.show("a", () => <Page />));
    act(() => cache.show("b", () => <span>other</span>));
    fireEvent.keyDown(document, { key: "x" });
    expect(received).toHaveBeenCalledTimes(1);
    act(() => cache.clear()); host.remove();
  });
});
