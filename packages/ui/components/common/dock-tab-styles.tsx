import { cn } from "../../lib/utils";

/** Shared styling for every bottom-dock tab, with no competing background classes. */
export function dockTabClassName(selected: boolean) {
  return cn(
    "relative inline-flex h-7 shrink-0 items-center gap-2 rounded-md border bg-background px-2.5 text-left text-muted-foreground shadow-sm outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
    selected && "border-primary/40 bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary",
  );
}
