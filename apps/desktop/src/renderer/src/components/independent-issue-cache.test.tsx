import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useId, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IndependentIssueCache } from "./independent-issue-cache";

describe("independent cached issue roots", () => {
  afterEach(() => { document.body.replaceChildren(); });
  it("preserves visited pages without rerendering inactive roots and releases unpinned pages", () => {
    const host = document.createElement("div"); document.body.appendChild(host);
    const renders = vi.fn();
    function Page({ id }: { id: string }) {
      const [count, setCount] = useState(0);
      renders(id);
      return <button onClick={() => setCount(count + 1)}>{id}:{count}</button>;
    }
    const cache = new IndependentIssueCache(host);
    act(() => cache.show("a", <Page id="a" />));
    fireEvent.click(screen.getByRole("button", { name: "a:0" }));
    act(() => cache.show("b", <Page id="b" />));
    const aRenders = renders.mock.calls.filter(([id]) => id === "a").length;
    act(() => cache.show("c", <Page id="c" />));
    expect(renders.mock.calls.filter(([id]) => id === "a")).toHaveLength(aRenders);
    act(() => cache.show("a", <Page id="a" />));
    expect(screen.getByRole("button", { name: "a:1" })).toBeInTheDocument();
    act(() => cache.remove("a"));
    expect(screen.queryByText("a:1")).toBeNull();
    act(() => cache.clear());
    expect(host.childElementCount).toBe(0);
  });
  it("hides each inactive page's independently portaled header", () => {
    const host = document.createElement("div"), header = document.createElement("div");
    document.body.append(host, header);
    const cache = new IndependentIssueCache(host, header);
    act(() => cache.show("a", (target) => createPortal(<span>header-a</span>, target!)));
    act(() => cache.show("b", (target) => createPortal(<span>header-b</span>, target!)));
    expect(screen.getByText("header-a")).not.toBeVisible();
    expect(screen.getByText("header-b")).toBeVisible();
    act(() => cache.remove("b"));
    expect(screen.queryByText("header-b")).toBeNull();
    act(() => cache.clear());
    expect(header.childElementCount).toBe(0);
  });
  it("suspends hidden pages' global listeners and restores them on activation", () => {
    const host = document.createElement("div"); document.body.appendChild(host);
    const received = vi.fn();
    function Page({ id }: { id: string }) {
      useEffect(() => { const handler = () => received(id); document.addEventListener("keydown", handler); return () => document.removeEventListener("keydown", handler); }, [id]);
      return <span>{id}</span>;
    }
    const cache = new IndependentIssueCache(host);
    act(() => cache.show("a", <Page id="a" />));
    act(() => cache.show("b", <Page id="b" />));
    fireEvent.keyDown(document, { key: "x" });
    expect(received).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenLastCalledWith("b");
    act(() => cache.show("a", <Page id="a" />));
    fireEvent.keyDown(document, { key: "x" });
    expect(received).toHaveBeenLastCalledWith("a");
    act(() => cache.clear());
  });
  it("hides the issue and its header when navigating to a normal page", () => {
    const host = document.createElement("div"), header = document.createElement("div");
    document.body.append(host, header);
    const received = vi.fn();
    function Page({ target }: { target: HTMLElement }) {
      useEffect(() => { document.addEventListener("keydown", received); return () => document.removeEventListener("keydown", received); }, []);
      return <>{createPortal(<span>issue-header</span>, target)}<span>issue-content</span></>;
    }
    const cache = new IndependentIssueCache(host, header);
    act(() => cache.show("a", (target) => <Page target={target!} />));
    act(() => cache.hide());
    expect(screen.getByText("issue-header")).not.toBeVisible();
    expect(screen.getByText("issue-content")).not.toBeVisible();
    fireEvent.keyDown(document, { key: "x" });
    expect(received).not.toHaveBeenCalled();
    act(() => cache.clear());
  });
  it("keeps generated ids distinct across independent pages", () => {
    const host = document.createElement("div"); document.body.appendChild(host);
    function Page() { const id = useId(); return <span data-testid="generated" id={id} />; }
    const cache = new IndependentIssueCache(host);
    act(() => cache.show("a", <Page />));
    act(() => cache.show("b", <Page />));
    const ids = screen.getAllByTestId("generated").map((element) => element.id);
    expect(new Set(ids).size).toBe(2);
    act(() => cache.clear());
  });
  it("releases only removed pins and starts a fresh page if pinned again", async () => {
    const host = document.createElement("div"); document.body.appendChild(host);
    function Page({ id }: { id: string }) {
      const [count, setCount] = useState(0);
      return <button onClick={() => setCount(count + 1)}>{id}:{count}</button>;
    }
    const cache = new IndependentIssueCache(host);
    act(() => cache.show("a", <Page id="a" />));
    fireEvent.click(screen.getByRole("button", { name: "a:0" }));
    act(() => cache.show("b", <Page id="b" />));
    fireEvent.click(screen.getByRole("button", { name: "b:0" }));
    await act(async () => { cache.retain(new Set(["b"])); await Promise.resolve(); });
    expect(screen.queryByText("a:1")).toBeNull();
    expect(screen.getByRole("button", { name: "b:1" })).toBeVisible();
    act(() => cache.show("a", <Page id="a" />));
    expect(screen.getByRole("button", { name: "a:0" })).toBeVisible();
    act(() => cache.show("b", <Page id="b" />));
    expect(screen.getByRole("button", { name: "b:1" })).toBeVisible();
    act(() => cache.clear());
  });
  it("removes an unpinned root safely during the parent shell's commit", async () => {
    const host = document.createElement("div"); document.body.appendChild(host);
    const cache = new IndependentIssueCache(host);
    act(() => cache.show("a", <span>cached-a</span>));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    function Shell({ pinned }: { pinned: boolean }) {
      useLayoutEffect(() => { cache.retain(new Set(pinned ? ["a"] : [])); }, [pinned]);
      return null;
    }
    const view = render(<Shell pinned />);
    await act(async () => { view.rerender(<Shell pinned={false} />); await Promise.resolve(); });
    expect(screen.queryByText("cached-a")).toBeNull();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    view.unmount();
  });
});
