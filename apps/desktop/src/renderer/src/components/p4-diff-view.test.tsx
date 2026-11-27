import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { P4DiffView } from "./p4-diff-view";

describe("P4 diff view", () => {
  it("moves to each contiguous change block and wraps around", () => {
    const { container } = render(<P4DiffView path="file.txt" diff={"--- old\n+++ new\n@@ -1,3 +1,3 @@\n-old\n+new\n context\n-before\n+after"} onSelection={vi.fn()} />);
    const viewport = screen.getByRole("region", { name: "Diff" });
    Object.defineProperty(viewport, "clientHeight", { value: 100 });
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({ top: 0 } as DOMRect);
    const rows = container.querySelectorAll<HTMLElement>('[data-kind="remove"]');
    vi.spyOn(rows[0]!, "getBoundingClientRect").mockReturnValue({ top: 120 } as DOMRect);
    vi.spyOn(rows[1]!, "getBoundingClientRect").mockReturnValue({ top: 220 } as DOMRect);
    fireEvent.click(screen.getByRole("button", { name: "下一个变更" }));
    expect(viewport.scrollTop).toBe(70);
    fireEvent.click(screen.getByRole("button", { name: "下一个变更" }));
    expect(viewport.scrollTop).toBe(240);
    fireEvent.click(screen.getByRole("button", { name: "下一个变更" }));
    expect(viewport.scrollTop).toBe(310);
  });
  it("loads hidden context on demand and can collapse it again", async () => {
    const load = vi.fn().mockResolvedValue("--- old\n+++ new\n@@ -1,2 +1,2 @@\n hidden context\n-old\n+new");
    render(<P4DiffView path="file.cs" diff={"--- old\n+++ new\n@@ -2 +2 @@\n-old\n+new"} onSelection={vi.fn()} onLoadFullContext={load} />);
    fireEvent.click(screen.getByRole("button", { name: "展开完整代码" }));
    expect(await screen.findByText("hidden context")).toBeInTheDocument();
    expect(load).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "收起上下文" }));
    expect(screen.queryByText("hidden context")).not.toBeInTheDocument();
  });
  it("searches the full file and reports matches from hidden context", async () => {
    const load = vi.fn().mockResolvedValue("--- old\n+++ new\n@@ -1,2 +1,2 @@\n hidden needle\n-old\n+new");
    render(<P4DiffView path="file.cs" diff={"--- old\n+++ new\n@@ -2 +2 @@\n-old\n+new"} onSelection={vi.fn()} onLoadFullContext={load} />);
    fireEvent.keyDown(screen.getByRole("region", { name: "Diff" }), { key: "f", ctrlKey: true });
    fireEvent.change(screen.getByRole("textbox", { name: "搜索当前文件" }), { target: { value: "needle" } });
    await waitFor(() => expect(screen.getByText("1 / 1")).toBeInTheDocument());
    expect(screen.getByText("hidden needle")).toBeInTheDocument();
  });
  it("shows numbered changes without exposing source headers as code", () => {
    const { container } = render(<P4DiffView path="file.cs" diff={"--- old\n+++ new\n@@ -12 +12 @@\n-old\n+new"} onSelection={vi.fn()} />);
    expect(screen.getByText("old")).toBeInTheDocument();
    expect(screen.getByText("new")).toBeInTheDocument();
    expect(container.querySelector('[data-kind="remove"]')).toHaveTextContent("12");
    expect(container.querySelector('[data-kind="add"]')).toHaveTextContent("12");
    expect(screen.queryByText("--- old")).not.toBeInTheDocument();
  });
  it("keeps adjacent source rows in one continuous text flow for character selection", () => {
    const { container } = render(<P4DiffView path="file.cs" diff={"--- old\n+++ new\n@@ -1,2 +1,2 @@\n first line\n second line"} onSelection={vi.fn()} />);
    const rows = container.querySelectorAll('[data-kind="context"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.tagName).toBe("SPAN");
    expect(rows[0]?.parentElement?.tagName).toBe("PRE");
    expect(rows[0]?.nextSibling?.textContent).toBe("\n");
  });
  it("preserves highlighted text nodes when releasing a selection updates the parent", () => {
    function Harness() {
      const [selection, setSelection] = useState("");
      return <><button disabled={!selection}>Ask</button><P4DiffView path="file.cs" diff={"--- old\n+++ new\n@@ -1 +1 @@\n+int total = 123;"} onSelection={setSelection} /></>;
    }
    const { container } = render(<Harness />);
    const code = container.querySelector(".hljs")!;
    const node = code.lastChild!;
    const range = document.createRange();
    range.setStart(node, 0); range.setEnd(node, Math.min(1, node.textContent!.length));
    const selected = window.getSelection()!; selected.removeAllRanges(); selected.addRange(range);
    fireEvent.mouseUp(code);
    expect(container.querySelector(".hljs")!.lastChild).toBe(node);
    expect(screen.getByRole("button", { name: "Ask" })).toBeEnabled();
  });
});
