"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlarmClock, Plus, Zap } from "@multica/ui/icons";
import { IconButton } from "@multica/ui/components/common/icon-button";
import { autopilotListOptions } from "@multica/core/autopilots/queries";
import { useAutopilotsViewStore } from "@multica/core/autopilots/stores";
import { useCurrentWorkspace, useWorkspacePaths } from "@multica/core/paths";
import type { Autopilot } from "@multica/core/types";
import { useNavigation } from "../../navigation";
import { useT } from "../../i18n";
import { AUTOPILOT_TEMPLATES } from "../../autopilots/components/autopilot-templates";
import { usePersistentPins } from "../persistent-pins-context";
import { SharedPinnedSection } from "./shared-pinned-section";
import {
  isWakeupsTab,
  wakeupCountsOptions,
  wakeupsHref,
} from "../../autopilots/components/wakeups-tab";
import {
  PanelBody,
  PanelCount,
  PanelHeader,
  PanelLink,
  PanelList,
  PanelSection,
} from "../panel-nav";

const EMPTY_AUTOPILOTS: Autopilot[] = [];
const PANEL_TEMPLATE_LIMIT = 3;

export function AutopilotsPanel() {
  const persistentPins = usePersistentPins();
  const { t } = useT("layout");
  const { t: tAutopilots } = useT("autopilots");
  const p = useWorkspacePaths();
  const { pathname, searchParams, push } = useNavigation();
  const wsId = useCurrentWorkspace()?.id;
  const setScope = useAutopilotsViewStore((s) => s.setScope);
  const { data: autopilots = EMPTY_AUTOPILOTS } = useQuery({
    ...autopilotListOptions(wsId ?? ""),
    enabled: !!wsId,
  });
  const { data: wakeups } = useQuery({
    ...wakeupCountsOptions(wsId ?? ""),
    enabled: !!wsId,
  });
  const visible = useMemo(
    () => autopilots.filter((autopilot) => autopilot.status !== "archived"),
    [autopilots],
  );
  const onList = pathname === p.autopilots();
  const onWakeups = onList && isWakeupsTab(searchParams);

  return (
    <>
      <PanelHeader title={t(($) => $.nav.autopilots)}>
        <IconButton
          label={tAutopilots(($) => $.page.new_autopilot)}
          tooltipSide="bottom"
          className="text-muted-foreground"
          onClick={() => push(`${p.autopilots()}?create=1`)}
        >
          <Plus />
        </IconButton>
      </PanelHeader>
      <PanelBody>
        <PanelList>
          <PanelLink
            href={p.autopilots()}
            icon={<Zap />}
            label={t(($) => $.panels.autopilots.all)}
            active={onList && !onWakeups}
            trailing={<PanelCount value={visible.length} />}
            onNavigate={() => setScope("all")}
          />
          <PanelLink
            href={wakeupsHref(p.autopilots())}
            icon={<AlarmClock />}
            label={tAutopilots(($) => $.wakeups.title)}
            active={onWakeups}
            trailing={<PanelCount value={wakeups?.counts.active ?? 0} />}
          />
        </PanelList>

        <PanelSection label={t(($) => $.panels.autopilots.templates)}>
          <PanelList>
            {AUTOPILOT_TEMPLATES.slice(0, PANEL_TEMPLATE_LIMIT).map((template) => {
              const Icon = template.icon;
              return (
                <PanelLink
                  key={template.id}
                  href={`${p.autopilots()}?template=${template.id}`}
                  icon={<Icon />}
                  label={tAutopilots(($) => $.templates[template.id].title)}
                  active={false}
                  className="text-muted-foreground"
                />
              );
            })}
          </PanelList>
        </PanelSection>
        {persistentPins && <SharedPinnedSection />}
      </PanelBody>
    </>
  );
}
