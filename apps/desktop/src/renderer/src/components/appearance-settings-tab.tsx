import { Switch } from "@multica/ui/components/ui/switch";
import { useT } from "@multica/views/i18n";
import { SettingsCard, SettingsRow, SettingsTab } from "@multica/views/settings";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";

export function AppearanceSettingsTab() {
  const { t } = useT("settings");
  const singleTabMode = useDesktopPrefsStore((s) => s.singleTabMode);
  const setSingleTabMode = useDesktopPrefsStore((s) => s.setSingleTabMode);

  return (
    <SettingsTab title={t(($) => $.desktop.appearance.title)}>
      <SettingsCard>
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
      </SettingsCard>
    </SettingsTab>
  );
}
