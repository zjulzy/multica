// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ content: vi.fn() }));
vi.mock("@multica/ui/components/ui/popover", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@multica/ui/components/ui/popover")>();
  return { ...actual, PopoverContent: () => { calls.content(); return <div>Emoji choices</div>; } };
});
import { QuickEmojiPicker } from "./quick-emoji-picker";

describe("quick emoji picker", () => {
  it("creates its choices only after opening", () => {
    calls.content.mockClear();
    render(<QuickEmojiPicker onSelect={() => {}} />);
    expect(calls.content).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add reaction" }));
    expect(screen.getByText("Emoji choices")).toBeTruthy();
    expect(calls.content).toHaveBeenCalled();
  });
});
