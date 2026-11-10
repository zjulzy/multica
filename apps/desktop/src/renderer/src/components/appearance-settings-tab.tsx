import { Switch } from "@multica/ui/components/ui/switch";
import { useEffect, useState } from "react";
import { useT } from "@multica/views/i18n";
import { SettingsCard, SettingsRow, SettingsTab } from "@multica/views/settings";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";

export function AppearanceSettingsTab() {
  const { t } = useT("settings");
  const singleTabMode = useDesktopPrefsStore((s) => s.singleTabMode);
  const setSingleTabMode = useDesktopPrefsStore((s) => s.setSingleTabMode);
  const lightweightInboxEnabled = useDesktopPrefsStore((s) => s.lightweightInboxEnabled);
  const setLightweightInboxEnabled = useDesktopPrefsStore((s) => s.setLightweightInboxEnabled);
  const lightweightInboxReplyLimit = useDesktopPrefsStore((s) => s.lightweightInboxReplyLimit);
  const setLightweightInboxReplyLimit = useDesktopPrefsStore((s) => s.setLightweightInboxReplyLimit);
  const [replyLimitDraft, setReplyLimitDraft] = useState(String(lightweightInboxReplyLimit));
  useEffect(() => setReplyLimitDraft(String(lightweightInboxReplyLimit)), [lightweightInboxReplyLimit]);
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
  const pinnedIssueCacheEnabled = useDesktopPrefsStore((s) => s.pinnedIssueCacheEnabled);
  const setPinnedIssueCacheEnabled = useDesktopPrefsStore((s) => s.setPinnedIssueCacheEnabled);

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
        <SettingsRow label={t(($) => $.desktop.appearance.lightweight_inbox_title)} description={t(($) => $.desktop.appearance.lightweight_inbox_description)}>
          <Switch checked={lightweightInboxEnabled} onCheckedChange={setLightweightInboxEnabled} aria-label={t(($) => $.desktop.appearance.lightweight_inbox_title)} />
        </SettingsRow>
        <SettingsRow label={t(($) => $.desktop.appearance.lightweight_inbox_count_title)} description={t(($) => $.desktop.appearance.lightweight_inbox_count_description)}>
          <input type="number" min={1} max={50} step={1} disabled={!lightweightInboxEnabled}
            aria-label={t(($) => $.desktop.appearance.lightweight_inbox_count_title)}
            value={replyLimitDraft} onChange={(event) => setReplyLimitDraft(event.target.value)}
            onBlur={() => { const value = Number(replyLimitDraft); if (replyLimitDraft.trim() && Number.isFinite(value)) { const next = Math.min(50, Math.max(1, Math.floor(value))); setLightweightInboxReplyLimit(next); setReplyLimitDraft(String(next)); } else setReplyLimitDraft(String(lightweightInboxReplyLimit)); }}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
            className="h-9 w-20 rounded-md border bg-background px-3 text-body text-foreground disabled:opacity-50" />
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
        {(import.meta.env.PROD || import.meta.env.VITE_PINNED_ISSUE_CACHE_EXPERIMENT === "1" || import.meta.env.VITE_NATIVE_ISSUE_CACHE_EXPERIMENT === "1") && <SettingsRow
          label={t(($) => $.desktop.appearance.pinned_issue_cache_title)}
          description={t(($) => $.desktop.appearance.pinned_issue_cache_description)}
        >
          <Switch checked={pinnedIssueCacheEnabled} onCheckedChange={setPinnedIssueCacheEnabled}
            aria-label={t(($) => $.desktop.appearance.pinned_issue_cache_title)} />
        </SettingsRow>}
      </SettingsCard>
    </SettingsTab>
  );
}
