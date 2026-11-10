// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { scrollInboxTargetIntoView } from "./scroll-inbox-target";

describe("inbox message positioning", () => {
  it("scrolls only the inbox container when the target is below it", () => {
    const container = document.createElement("div"), target = document.createElement("div");
    container.appendChild(target);
    container.scrollTop = 100;
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({ top: 200, bottom: 500 } as DOMRect);
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({ top: 550, bottom: 600 } as DOMRect);
    const scrollIntoView = vi.fn(); target.scrollIntoView = scrollIntoView;
    scrollInboxTargetIntoView(container, target);
    expect(container.scrollTop).toBe(200);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
  it("does not change the scroll position for an already visible target", () => {
    const container = document.createElement("div"), target = document.createElement("div");
    container.appendChild(target); container.scrollTop = 25;
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({ top: 100, bottom: 300 } as DOMRect);
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({ top: 130, bottom: 180 } as DOMRect);
    scrollInboxTargetIntoView(container, target);
    expect(container.scrollTop).toBe(25);
  });
});
