import { useQuery } from "@tanstack/react-query";
import { useChatStore } from "@multica/core/chat";
import { chatSessionsOptions } from "@multica/core/chat/queries";
import { countUnreadChatMessages } from "@multica/core/chat/unread";
import { useAppForeground } from "@multica/views/chat";
import { useT } from "@multica/views/i18n";
import { MessageSquare } from "lucide-react";
import { DockUnreadBadge } from "@multica/ui/components/common/dock-unread-badge";
import { dockTabClassName } from "@multica/ui/components/common/dock-tab-styles";

export function ChatDockTab({ workspaceId, selected, visible, onClick }: { workspaceId: string; selected: boolean; visible: boolean; onClick: () => void }) {
  const { t } = useT("chat");
  const { data: sessions } = useQuery({ ...chatSessionsOptions(workspaceId), enabled: !!workspaceId });
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const foreground = useAppForeground();
  const unread = countUnreadChatMessages(sessions, visible && foreground ? activeSessionId : null);
  return <button type="button" aria-expanded={selected} onClick={onClick} className={dockTabClassName(selected)}>
    <MessageSquare aria-hidden className="size-4" /><span className="text-body font-semibold">{t(($) => $.page.title)}</span>
    <DockUnreadBadge count={unread} />
  </button>;
}
