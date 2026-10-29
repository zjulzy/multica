import { render, act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";
import { InterfaceMotionSync } from "./interface-motion-sync";

describe("InterfaceMotionSync", () => {
  afterEach(() => {
    delete document.documentElement.dataset.interfaceMotion;
    useDesktopPrefsStore.setState({ interfaceMotionEnabled: false });
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
