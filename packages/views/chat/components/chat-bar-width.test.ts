import { describe, expect, it } from "vitest";
import { chatBarMaxChips } from "./chat-bar-width";

describe("chat bar width", () => {
  it("reserves room for workspace alerts before deciding how many sessions fit", () => {
    expect(chatBarMaxChips(500, "top", 0)).toBe(1);
    expect(chatBarMaxChips(500, "top", 140)).toBe(1);
    expect(chatBarMaxChips(500, "top", 180)).toBe(0);
    expect(chatBarMaxChips(900, "top", 100)).toBe(3);
    expect(chatBarMaxChips(200, "bottom", 0)).toBe(1);
  });
});
