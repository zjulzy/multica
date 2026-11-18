import { SettingsPage } from "@multica/views/settings";
import { useT } from "@multica/views/i18n";
import { Download, Server } from "@multica/ui/icons";
import { PanelTop } from "lucide-react";
import { AppearanceSettingsTab } from "./appearance-settings-tab";
import { DaemonSettingsTab } from "./daemon-settings-tab";
import { UpdatesSettingsTab } from "./updates-settings-tab";

export function DesktopSettingsRoute() {
  const { t } = useT("settings");
  return <SettingsPage extraDeviceTabs={[
    { value: "interface", label: t(($) => $.desktop.tabs.custom_options), icon: PanelTop, content: <AppearanceSettingsTab /> },
    { value: "daemon", label: t(($) => $.desktop.daemon.title), icon: Server, content: <DaemonSettingsTab /> },
    { value: "updates", label: t(($) => $.desktop.tabs.updates), icon: Download, content: <UpdatesSettingsTab /> },
  ]} />;
}
