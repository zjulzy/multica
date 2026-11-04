"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** A floating scrollbar keeps the rail centered when the list overflows. */
export function RailAgentRegion({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; scrollTop: number } | null>(null);
  const [thumb, setThumb] = useState<{ height: number; top: number } | null>(null);
  const update = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { clientHeight, scrollHeight, scrollTop } = viewport;
    if (clientHeight <= 0 || scrollHeight <= clientHeight + 1) {
      setThumb((current) => current === null ? current : null);
      return;
    }
    const height = Math.min(clientHeight, Math.max(18, clientHeight * clientHeight / scrollHeight));
    const top = Math.max(0, Math.min(clientHeight - height, scrollTop / (scrollHeight - clientHeight) * (clientHeight - height)));
    setThumb((current) => current?.height === height && current.top === top ? current : { height, top });
  }, []);
  useLayoutEffect(() => {
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (viewportRef.current) observer?.observe(viewportRef.current);
    if (contentRef.current) observer?.observe(contentRef.current);
    window.addEventListener("resize", update);
    update();
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); };
  }, [update]);

  return <div data-slot="rail-agent-region" className="group/agent-scroll relative flex min-h-0 max-h-[35vh] w-16 shrink flex-col overflow-hidden">
    <div ref={viewportRef} data-testid="rail-agent-scroll" onScroll={update} className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div ref={contentRef}>{children}</div>
    </div>
    {thumb && <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-2 opacity-0 transition-opacity group-hover/agent-scroll:opacity-100 group-hover/agent-scroll:[&>*]:pointer-events-auto">
      <div data-testid="rail-agent-scroll-thumb" className="absolute right-0.5 w-1 cursor-grab touch-none rounded-full bg-muted-foreground/50 active:cursor-grabbing" style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
        onPointerDown={(event) => { event.preventDefault(); const viewport = viewportRef.current; if (!viewport) return; dragRef.current = { pointerId: event.pointerId, startY: event.clientY, scrollTop: viewport.scrollTop }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { const drag = dragRef.current; const viewport = viewportRef.current; if (!drag || !viewport || drag.pointerId !== event.pointerId) return; const available = viewport.clientHeight - thumb.height; if (available > 0) viewport.scrollTop = drag.scrollTop + (event.clientY - drag.startY) * (viewport.scrollHeight - viewport.clientHeight) / available; }}
        onPointerUp={(event) => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }} />
    </div>}
  </div>;
}
