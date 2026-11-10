import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PinnedIssueCache } from "./pinned-issue-cache";

describe("pinned issue page cache", () => {
  it("hides the header portal of a cached page when another page is active", () => {
    const header = document.createElement("div");
    document.body.appendChild(header);
    const renderIssue = (id: string) => createPortal(<div>header:{id}</div>, header);
    const { rerender, unmount } = render(<PinnedIssueCache enabled activeId="one" pinnedIds={["one", "two"]} renderIssue={renderIssue} />);
    rerender(<PinnedIssueCache enabled activeId="two" pinnedIds={["one", "two"]} renderIssue={renderIssue} />);
    expect(screen.getByText("header:one")).not.toBeVisible();
    expect(screen.getByText("header:two")).toBeVisible();
    unmount();
    header.remove();
  });
  it("does not preload pins, and suspends background effects", () => {
    const starts = vi.fn();
    const stops = vi.fn();
    function Page({ id }: { id: string }) {
      useEffect(() => { starts(id); return () => stops(id); }, [id]);
      return <div>{id}</div>;
    }
    const renderIssue = (id: string) => <Page id={id} />;
    const { rerender } = render(<PinnedIssueCache enabled activeId="one" pinnedIds={["one", "two", "three"]} renderIssue={renderIssue} />);
    expect(starts).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("two")).toBeNull();
    rerender(<PinnedIssueCache enabled activeId="two" pinnedIds={["one", "two", "three"]} renderIssue={renderIssue} />);
    expect(stops).toHaveBeenCalledWith("one");
    expect(starts).toHaveBeenCalledWith("two");
    expect(screen.getByText("one")).not.toBeVisible();
    expect(screen.queryByText("three")).toBeNull();
  });
  it("retains visited pinned pages and releases them when unpinned or disabled", () => {
    const cleanup = vi.fn();
    function Page({ id }: { id: string }) {
      const [count, setCount] = useState(0);
      useEffect(() => () => cleanup(id), [id]);
      return <button onClick={() => setCount((n) => n + 1)}>{id}:{count}</button>;
    }
    const renderIssue = (id: string) => <Page id={id} />;
    const { rerender } = render(<PinnedIssueCache enabled activeId="one" pinnedIds={["one", "two"]} renderIssue={renderIssue} />);
    fireEvent.click(screen.getByRole("button", { name: "one:0" }));
    rerender(<PinnedIssueCache enabled activeId="two" pinnedIds={["one", "two"]} renderIssue={renderIssue} />);
    expect(screen.getByRole("button", { name: "two:0" })).toBeInTheDocument();
    rerender(<PinnedIssueCache enabled activeId="one" pinnedIds={["one", "two"]} renderIssue={renderIssue} />);
    expect(screen.getByRole("button", { name: "one:1" })).toBeInTheDocument();
    rerender(<PinnedIssueCache enabled activeId="one" pinnedIds={["two"]} renderIssue={renderIssue} />);
    rerender(<PinnedIssueCache enabled activeId="two" pinnedIds={["two"]} renderIssue={renderIssue} />);
    expect(screen.queryByText("one:1")).toBeNull();
    rerender(<PinnedIssueCache enabled={false} activeId={null} pinnedIds={["two"]} renderIssue={renderIssue} />);
    expect(screen.queryByText("two:0")).toBeNull();
    expect(cleanup).toHaveBeenCalled();
  });
});
