import { RefreshCw } from "@multica/ui/icons";
import { useLocale } from "@multica/views/i18n";
import { AppLink, useNavigation } from "@multica/views/navigation";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";
import { useMeegoSync } from "./meego-sync-hooks";

export function MeegoSyncNav() {
  const enabled = useDesktopPrefsStore((state) => state.meegoSyncEnabled);
  const { workspace, matches } = useMeegoSync(enabled);
  const { pathname } = useNavigation();
  const zh = useLocale().startsWith("zh");
  if (!enabled || !workspace || !matches) return null;
  const href = `/${encodeURIComponent(workspace.slug)}/meego-sync`;
  const label = zh ? "Meego 同步" : "Meego sync";
  return <li><AppLink href={href} aria-label={label} title={label} aria-current={pathname === href ? "page" : undefined} className="group relative flex h-[52px] w-[52px] flex-col items-center justify-center gap-1 rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground"><RefreshCw className="size-5" /><span className="whitespace-nowrap text-micro leading-[14px]">Meego</span></AppLink></li>;
}
