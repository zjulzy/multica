import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { P4DiffView } from "./p4-diff-view";

describe("P4 diff view", () => {
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
