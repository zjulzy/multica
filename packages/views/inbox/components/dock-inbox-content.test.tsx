import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScrollRestorationProvider } from "../../platform";
import { DockInboxContent } from "./dock-inbox-content";

describe("DockInboxContent", () => {
  it("captures scroll before removing the contents", () => {
    const captureElements = vi.fn((root: HTMLElement) => {
      expect(root.querySelector('[data-tab-scroll-root="list"]')).not.toBeNull();
    });
    const view = render(<ScrollRestorationProvider adapter={{ get: () => undefined, captureElements }}>
      <DockInboxContent inert={false}><div data-tab-scroll-root="list" /></DockInboxContent>
    </ScrollRestorationProvider>);
    view.unmount();
    expect(captureElements).toHaveBeenCalledOnce();
  });
  it("records position changes while a detail stays mounted", () => {
    const captureElement = vi.fn();
    const view = render(<ScrollRestorationProvider adapter={{ get: () => undefined, captureElement }}>
      <DockInboxContent inert={false}><div data-testid="detail" data-tab-scroll-root="main:one" /></DockInboxContent>
    </ScrollRestorationProvider>);
    const detail = view.getByTestId("detail");
    detail.scrollTop = 300;
    fireEvent.scroll(detail);
    expect(captureElement).toHaveBeenCalledWith(detail);
  });
});
