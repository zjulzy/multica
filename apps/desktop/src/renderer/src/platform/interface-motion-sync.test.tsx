import { render, act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";
import { InterfaceMotionSync } from "./interface-motion-sync";

describe("InterfaceMotionSync", () => {
  afterEach(() => {
    delete document.documentElement.dataset.interfaceMotion;
    delete document.documentElement.dataset.sidebarFontSize;
    useDesktopPrefsStore.setState({ interfaceMotionEnabled: false, sidebarFontSize: "standard" });
  });

  it("applies sidebar size immediately and removes it on unmount", () => {
    useDesktopPrefsStore.setState({ sidebarFontSize: "small" });
    const view = render(<InterfaceMotionSync />);
    expect(document.documentElement.dataset.sidebarFontSize).toBe("small");
    act(() => useDesktopPrefsStore.getState().setSidebarFontSize("large"));
    expect(document.documentElement.dataset.sidebarFontSize).toBe("large");
    view.unmount();
    expect(document.documentElement.dataset.sidebarFontSize).toBeUndefined();
  });

  it("applies the persisted setting to the document, including portals", () => {
    useDesktopPrefsStore.setState({ interfaceMotionEnabled: false });
    const view = render(<InterfaceMotionSync />);
    expect(document.documentElement.dataset.interfaceMotion).toBe("off");
    act(() => useDesktopPrefsStore.getState().setInterfaceMotionEnabled(true));
    expect(document.documentElement.dataset.interfaceMotion).toBe("on");
    view.unmount();
    expect(document.documentElement.dataset.interfaceMotion).toBeUndefined();
  });
});
