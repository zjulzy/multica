"use client";

import { TriangleAlert } from "@multica/ui/icons";
import { useChatStore } from "@multica/core/chat";
import { useCurrentWorkspace, useWorkspacePaths } from "@multica/core/paths";
import { useIsMobile } from "@multica/ui/hooks/use-mobile";
import { ChatBar } from "../chat/components/chat-bar";
import { isFloatingChatRouteSuppressed } from "../chat/floating-chat-visibility";
import { useT } from "../i18n";
import { AppLink, useNavigation } from "../navigation";
import { useAppShell } from "./app-shell-context";
import { useTeamAgentStatus } from "./panels/team-status";

/**
 * Work that cannot start because its runtime is offline. Links to Team,
 * which names the agents. Keeps the left slot occupied when there is no alert
 * so quick chat stays on the right.
 */
function TeamStatus({ wsId }: { wsId: string }) {
  const { t } = useT("layout");
  const p = useWorkspacePaths();
  const shell = useAppShell();
  const { stuck, byAgent } = useTeamAgentStatus(wsId);
  const teamHref = shell?.spaceHref("team", p.agents()) ?? p.agents();
  const waitingTasks = stuck.reduce(
    (total, agent) => total + (byAgent.get(agent.id)?.queuedCount ?? 0),
    0,
  );

  return (
    <div data-slot="team-status" className="flex min-w-0 max-w-32 items-center gap-1">
      {waitingTasks > 0 && (
        <AppLink
          href={teamHref}
          className="inline-flex h-[22px] min-w-0 items-center gap-1.5 rounded-md bg-page-canvas pr-2 pl-1.5 text-caption font-medium text-foreground ring-1 ring-surface-border outline-none transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-ring"
        >
          <TriangleAlert aria-hidden className="size-3.5 shrink-0 text-warning" />
          <span className="truncate">{t(($) => $.panels.team.stuck, { count: waitingTasks })}</span>
        </AppLink>
      )}
    </div>
  );
}

/**
 * The bar under the content card: workspace status on the left, quick chat on
 * the right. It sits on the app shell, in the strip the card's bottom margin
 * used to take. Below `md` there is no bar and quick chat is the floating
 * launcher.
 */
export function AppBottomBar({ placement = "bottom", chatDockVisible = false }: { placement?: "top" | "bottom"; chatDockVisible?: boolean } = {}) {
  const { t } = useT("layout");
  const wsId = useCurrentWorkspace()?.id;
  const isMobile = useIsMobile();
  const floatingChatEnabled = useChatStore((s) => s.floatingChatEnabled);
  const { pathname } = useNavigation();
  const chatPath = useWorkspacePaths().chat();

  if (!wsId || (isMobile && placement !== "top")) return null;
  // Same gates as the floating window: the Settings preference, and the Chat
  // tab, which already shows the conversation full-page.
  const showChat = floatingChatEnabled && (placement === "top" || !isFloatingChatRouteSuppressed(pathname, chatPath));

  return (
    <footer
      aria-label={t(($) => $.bottom_bar.label)}
      data-slot={placement === "top" ? "app-top-controls" : "app-bottom-bar"}
      data-mc="bottom-bar"
      style={placement === "top" ? { WebkitAppRegion: "no-drag" } as React.CSSProperties : undefined}
      // pr: the card's mr-2 plus a gutter that puts the last icon on the same
      // column as the page header's trailing action.
      className={placement === "top"
        ? "relative z-10 flex h-full w-[min(45%,42rem)] min-w-48 shrink items-center justify-end gap-2 pr-2"
        : "hidden h-8 shrink-0 items-center justify-between gap-4 pr-[18px] pl-3 md:flex"}
    >
      <TeamStatus wsId={wsId} />
      {showChat && <ChatBar placement={placement} inlineChat={placement === "top" && (chatDockVisible || isFloatingChatRouteSuppressed(pathname, chatPath))} />}
    </footer>
  );
}
