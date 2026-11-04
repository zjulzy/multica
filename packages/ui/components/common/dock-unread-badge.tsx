/** Unread count positioned at the top-right corner of a dock tab button. */
export function DockUnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span data-slot="dock-unread-badge" aria-label={String(count)} className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white tabular-nums">{count > 99 ? "99+" : count}</span>;
}
