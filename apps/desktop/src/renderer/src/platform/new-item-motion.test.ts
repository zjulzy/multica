import { afterEach, describe, expect, it, vi } from "vitest";
import { watchNewItem } from "./new-item-motion";

describe("new item motion", () => {
  afterEach(() => { document.body.innerHTML = ""; vi.useRealTimers(); });

  it("animates a newly rendered item once and ignores later remounts", async () => {
    vi.useFakeTimers();
    const stop = watchNewItem("data-motion-inbox-id", "item-1");
    const row = document.createElement("div");
    row.setAttribute("data-motion-inbox-id", "item-1");
    row.animate = vi.fn();
    document.body.append(row);
    await vi.waitFor(() => expect(row.animate).toHaveBeenCalledOnce());
    row.remove();
    const replacement = row.cloneNode() as HTMLElement;
    replacement.animate = vi.fn();
    document.body.append(replacement);
    await Promise.resolve();
    expect(replacement.animate).not.toHaveBeenCalled();
    stop();
  });

  it("cancels an in-flight animation when motion is disabled", () => {
    const row = document.createElement("div");
    row.setAttribute("data-motion-inbox-id", "item-2");
    const cancel = vi.fn();
    row.animate = vi.fn(() => ({ cancel } as unknown as Animation));
    document.body.append(row);
    const stop = watchNewItem("data-motion-inbox-id", "item-2");
    expect(row.animate).toHaveBeenCalledOnce();
    stop();
    expect(cancel).toHaveBeenCalledOnce();
  });
});
