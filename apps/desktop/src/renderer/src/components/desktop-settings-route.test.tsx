import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DesktopSettingsRoute } from "./desktop-settings-route";

vi.mock("@multica/views/i18n", () => ({
  useT: () => ({ t: (selector: (value: unknown) => unknown) => selector({ desktop: { tabs: { appearance: "Interface", custom_options: "Custom options", updates: "Updates" }, daemon: { title: "Daemon" } } }) }),
}));
vi.mock("@multica/views/settings", () => ({
  SettingsPage: ({ extraDeviceTabs }: { extraDeviceTabs: { value: string; label: string }[] }) => <>{extraDeviceTabs.map((tab) => <div key={tab.value} data-testid={`tab-${tab.value}`}>{tab.label}</div>)}</>,
}));
vi.mock("./appearance-settings-tab", () => ({ AppearanceSettingsTab: () => null }));
vi.mock("./daemon-settings-tab", () => ({ DaemonSettingsTab: () => null }));
vi.mock("./updates-settings-tab", () => ({ UpdatesSettingsTab: () => null }));

describe("desktop settings tabs", () => {
  it("keeps the custom interface page separate from the official appearance page", () => {
    render(<DesktopSettingsRoute />);
    expect(screen.getByTestId("tab-interface")).toHaveTextContent("Custom options");
    expect(screen.queryByTestId("tab-appearance")).toBeNull();
  });
});
