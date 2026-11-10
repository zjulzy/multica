import { describe, expect, it, vi } from "vitest";
import { EmbeddedVisibleSet } from "./embedded-visible-set";

describe("embedded visible pages", () => {
  it("keeps the main and inbox pages active together and freezes only pages leaving both surfaces", async () => {
    const resume = vi.fn(async (_id: string) => {}), freeze = vi.fn(async (_id: string) => {});
    const visible = new EmbeddedVisibleSet({ resume, freeze });
    await visible.show(["main"]);
    await visible.show(["main", "inbox"]);
    expect(freeze).not.toHaveBeenCalled();
    expect(resume.mock.calls.map(([id]) => id)).toEqual(["main", "inbox"]);
    await visible.show(["main"]);
    expect(freeze.mock.calls.map(([id]) => id)).toEqual(["inbox"]);
    expect(visible.has("main")).toBe(true);
    expect(visible.has("inbox")).toBe(false);
  });
  it("does not reactivate the same page twice if it is requested by two surfaces", async () => {
    const resume = vi.fn(async (_id: string) => {}), freeze = vi.fn(async (_id: string) => {});
    const visible = new EmbeddedVisibleSet({ resume, freeze });
    await visible.show(["one", "one"]);
    expect(resume).toHaveBeenCalledTimes(1);
  });
});
