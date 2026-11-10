import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { IndependentWorkspaceCache } from "./independent-workspace-cache";

describe("independent workspace issue cache", () => {
  it("retains page state, hides its title on ordinary routes, and releases unpinned pages", async () => {
    const header = document.createElement("div"); document.body.appendChild(header);
    function Page({ id }: { id: string }) {
      const [count, setCount] = useState(0);
      return <button onClick={() => setCount(count + 1)}>{id}:{count}</button>;
    }
    const page = (id: string) => <Page id={id} />;
    const view = (activeId: string | null, pinnedIds: readonly string[]) =>
      <IndependentWorkspaceCache activeId={activeId} pinnedIds={pinnedIds} headerHost={header} renderIssue={page} />;
    const result = render(view("a", ["a", "b"]));
    fireEvent.click(screen.getByRole("button", { name: "a:0" }));
    result.rerender(view("b", ["a", "b"]));
    expect(screen.getByRole("button", { name: "b:0" })).toBeVisible();
    expect(screen.getByText("a:1")).not.toBeVisible();
    result.rerender(view(null, ["a", "b"]));
    expect(screen.getByText("b:0")).not.toBeVisible();
    result.rerender(view("a", ["a", "b"]));
    expect(screen.getByRole("button", { name: "a:1" })).toBeVisible();
    await act(async () => { result.rerender(view(null, ["b"])); await Promise.resolve(); });
    expect(screen.queryByText("a:1")).toBeNull();
    await act(async () => { result.unmount(); await Promise.resolve(); });
    expect(hostChildren(header)).toBe(0);
    header.remove();
  });

  it("does not synchronously unmount a child root during a React commit", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const page = () => <span>content</span>;
    const result = render(<IndependentWorkspaceCache activeId="a" pinnedIds={["a"]} headerHost={null} renderIssue={page} />);
    await act(async () => { result.rerender(<IndependentWorkspaceCache activeId={null} pinnedIds={[]} headerHost={null} renderIssue={page} />); await Promise.resolve(); });
    await act(async () => { result.unmount(); await Promise.resolve(); });
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

function hostChildren(host: HTMLElement) { return host.childElementCount; }
