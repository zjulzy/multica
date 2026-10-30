import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@multica/ui/lib/utils";

export function DockInboxContent({ children, inert }: { children: ReactNode; inert: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    return () => {
      if (root) window.dispatchEvent(new CustomEvent("multica:flush-scoped-editors", { detail: root }));
    };
  }, []);
  return <div ref={ref} inert={inert || undefined} aria-hidden={inert || undefined} className={cn("flex min-h-0 flex-1 flex-col", inert && "pointer-events-none")}>{children}</div>;
}
