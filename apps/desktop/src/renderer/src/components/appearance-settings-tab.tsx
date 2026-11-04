import { Switch } from "@multica/ui/components/ui/switch";
import { useT } from "@multica/views/i18n";
import { SettingsCard, SettingsRow, SettingsTab } from "@multica/views/settings";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";

export function AppearanceSettingsTab() {
  const { t } = useT("settings");
  const singleTabMode = useDesktopPrefsStore((s) => s.singleTabMode);
  const setSingleTabMode = useDesktopPrefsStore((s) => s.setSingleTabMode);
  const inboxDockEnabled = useDesktopPrefsStore((s) => s.inboxDockEnabled);
  const setInboxDockEnabled = useDesktopPrefsStore((s) => s.setInboxDockEnabled);
  const agentStatusHubEnabled = useDesktopPrefsStore((s) => s.agentStatusHubEnabled);
  const setAgentStatusHubEnabled = useDesktopPrefsStore((s) => s.setAgentStatusHubEnabled);
  const interfaceMotionEnabled = useDesktopPrefsStore((s) => s.interfaceMotionEnabled);
  const setInterfaceMotionEnabled = useDesktopPrefsStore((s) => s.setInterfaceMotionEnabled);
  const sidebarFontSize = useDesktopPrefsStore((s) => s.sidebarFontSize);
  const setSidebarFontSize = useDesktopPrefsStore((s) => s.setSidebarFontSize);
  const liworkMonitorEnabled = useDesktopPrefsStore((s) => s.liworkMonitorEnabled);
  const setLiworkMonitorEnabled = useDesktopPrefsStore((s) => s.setLiworkMonitorEnabled);

  return (
    <SettingsTab title={t(($) => $.desktop.appearance.title)}>
      <SettingsCard>
        <SettingsRow label={t(($) => $.desktop.appearance.liwork_title)} description={t(($) => $.desktop.appearance.liwork_description)}>
          <Switch checked={liworkMonitorEnabled} onCheckedChange={setLiworkMonitorEnabled} aria-label={t(($) => $.desktop.appearance.liwork_title)} />
        </SettingsRow>
        <SettingsRow label={t(($) => $.desktop.appearance.sidebar_font_title)} description={t(($) => $.desktop.appearance.sidebar_font_description)}>
          <select
            aria-label={t(($) => $.desktop.appearance.sidebar_font_title)}
            value={sidebarFontSize}
            onChange={(event) => setSidebarFontSize(event.target.value as "small" | "standard" | "large")}
            className="h-9 rounded-md border bg-background px-3 text-body text-foreground"
          >
            <option value="small">{t(($) => $.desktop.appearance.sidebar_font_small)}</option>
            <option value="standard">{t(($) => $.desktop.appearance.sidebar_font_standard)}</option>
            <option value="large">{t(($) => $.desktop.appearance.sidebar_font_large)}</option>
          </select>
        </SettingsRow>
        <SettingsRow
          label={t(($) => $.desktop.appearance.interface_motion_title)}
          description={t(($) => $.desktop.appearance.interface_motion_description)}
        >
          <Switch checked={interfaceMotionEnabled} onCheckedChange={setInterfaceMotionEnabled}
            aria-label={t(($) => $.desktop.appearance.interface_motion_title)} />
        </SettingsRow>
        <SettingsRow
          label={t(($) => $.desktop.appearance.single_tab_mode_title)}
          description={t(($) => $.desktop.appearance.single_tab_mode_description)}
        >
          <Switch
            checked={singleTabMode}
            onCheckedChange={setSingleTabMode}
            aria-label={t(($) => $.desktop.appearance.single_tab_mode_title)}
          />
        </SettingsRow>
        <SettingsRow
          label={t(($) => $.desktop.appearance.inbox_dock_title)}
          description={t(($) => $.desktop.appearance.inbox_dock_description)}
        >
          <Switch
            checked={inboxDockEnabled}
            onCheckedChange={setInboxDockEnabled}
            aria-label={t(($) => $.desktop.appearance.inbox_dock_title)}
          />
        </SettingsRow>
        <SettingsRow
          label={t(($) => $.desktop.appearance.agent_hub_title)}
          description={t(($) => $.desktop.appearance.agent_hub_description)}
        >
          <Switch
            checked={agentStatusHubEnabled}
            onCheckedChange={setAgentStatusHubEnabled}
            aria-label={t(($) => $.desktop.appearance.agent_hub_title)}
          />
        </SettingsRow>
      </SettingsCard>
    </SettingsTab>
  );
}
