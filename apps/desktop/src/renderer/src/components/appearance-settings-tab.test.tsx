import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const translations = {
  desktop: {
    appearance: {
      title: "Appearance",
      single_tab_mode_title: "Single-tab mode",
      single_tab_mode_description: "Use one tab",
      inbox_dock_title: "Bottom inbox panel",
      inbox_dock_description: "Keep Inbox at the bottom",
      agent_hub_title: "Agent status hub",
      agent_hub_description: "Show active agents in the sidebar",
      interface_motion_title: "Interface motion",
      interface_motion_description: "Animate interface interactions",
    },
  },
};

vi.mock("@multica/views/i18n", () => ({
  useT: () => ({
    t: (selector: (resources: typeof translations) => string) => selector(translations),
  }),
}));

import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";
import { AppearanceSettingsTab } from "./appearance-settings-tab";

describe("AppearanceSettingsTab", () => {
  beforeEach(() => {
    useDesktopPrefsStore.setState({
      singleTabMode: false,
      inboxDockEnabled: false,
      inboxDockOpen: false,
      agentStatusHubEnabled: true,
      interfaceMotionEnabled: false,
    });
  });

  it("reflects the persisted Inbox dock preference", () => {
    useDesktopPrefsStore.setState({ inboxDockEnabled: true });

    render(<AppearanceSettingsTab />);

    expect(
      screen.getByRole("switch", { name: "Bottom inbox panel" }),
    ).toBeChecked();
  });

  it("toggles only the Inbox dock preference", () => {
    useDesktopPrefsStore.setState({ singleTabMode: true });
    render(<AppearanceSettingsTab />);

    fireEvent.click(screen.getByRole("switch", { name: "Bottom inbox panel" }));

    expect(useDesktopPrefsStore.getState().inboxDockEnabled).toBe(true);
    expect(useDesktopPrefsStore.getState().singleTabMode).toBe(true);
  });

  it("lets the user toggle the agent hub without changing Inbox or single-tab settings", () => {
    useDesktopPrefsStore.setState({ agentStatusHubEnabled: true, inboxDockEnabled: true, singleTabMode: true });
    render(<AppearanceSettingsTab />);
    const toggle = screen.getByRole("switch", { name: "Agent status hub" });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(useDesktopPrefsStore.getState().agentStatusHubEnabled).toBe(false);
    expect(useDesktopPrefsStore.getState().inboxDockEnabled).toBe(true);
    expect(useDesktopPrefsStore.getState().singleTabMode).toBe(true);
  });

  it("toggles interface motion independently of the agent hub", () => {
    render(<AppearanceSettingsTab />);
    const toggle = screen.getByRole("switch", { name: "Interface motion" });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(useDesktopPrefsStore.getState().interfaceMotionEnabled).toBe(true);
    expect(useDesktopPrefsStore.getState().agentStatusHubEnabled).toBe(true);
  });
});
