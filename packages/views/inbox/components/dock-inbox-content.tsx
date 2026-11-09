import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@multica/ui/lib/utils";
import { useScrollRestorationAdapter } from "../../platform";

export function DockInboxContent({ children, inert }: { children: ReactNode; inert: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollAdapter = useScrollRestorationAdapter();
  useLayoutEffect(() => {
    const root = ref.current;
    const capture = (event: Event) => {
      if (event.target instanceof HTMLElement && event.target.dataset.tabScrollRoot) scrollAdapter?.captureElement?.(event.target);
    };
    root?.addEventListener("scroll", capture, true);
    return () => {
      if (root) scrollAdapter?.captureElements?.(root);
      root?.removeEventListener("scroll", capture, true);
      if (root) window.dispatchEvent(new CustomEvent("multica:flush-scoped-editors", { detail: root }));
    };
  }, [scrollAdapter]);
  return <div ref={ref} inert={inert || undefined} aria-hidden={inert || undefined} className={cn("flex min-h-0 flex-1 flex-col", inert && "pointer-events-none")}>{children}</div>;
}
