// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { QuickEmojiPicker } from "./quick-emoji-picker";

it("opens and selects a quick emoji with the real popover", async () => {
  const selected = vi.fn();
  render(<QuickEmojiPicker onSelect={selected} />);
  fireEvent.click(screen.getByRole("button", { name: "Add reaction" }));
  const more = await screen.findByRole("button", { name: "More emojis..." });
  const choices = more.parentElement!.querySelectorAll("div > button");
  expect(choices.length).toBeGreaterThan(0);
  fireEvent.click(choices[0]!);
  expect(selected).toHaveBeenCalledOnce();
});
