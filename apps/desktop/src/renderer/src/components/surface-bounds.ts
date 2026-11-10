import type { CSSProperties } from "react";

export function observeSurfaceBounds(host: HTMLElement, target: HTMLElement, report: (bounds: CSSProperties) => void): () => void {
  let frame = 0, stopped = false;
  const dock = target.closest<HTMLElement>('[data-testid="dock-inbox-content"]');
  const measure = () => {
    const a = host.getBoundingClientRect(), b = target.getBoundingClientRect();
    const left = b.left - a.left, top = b.top - a.top;
    const clip = dock ? `inset(${Math.max(0, -top)}px ${Math.max(0, left + b.width - a.width)}px ${Math.max(0, top + b.height - a.height)}px ${Math.max(0, -left)}px)` : undefined;
    report({ left, top, width: b.width, height: b.height, ...(clip ? { clipPath: clip } : {}) });
  };
  const schedule = () => {
    if (stopped) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (stopped) return;
      measure();
      if (dock?.dataset.dockMotionPhase) schedule();
    });
  };
  const resize = new ResizeObserver(schedule); resize.observe(host); resize.observe(target);
  const mutation = dock && typeof MutationObserver !== "undefined" ? new MutationObserver(schedule) : null;
  mutation?.observe(dock!, { attributes: true, attributeFilter: ["data-dock-motion-phase"] });
  window.addEventListener("resize", schedule); window.addEventListener("scroll", schedule, true); measure(); schedule();
  return () => { stopped = true; resize.disconnect(); mutation?.disconnect(); window.removeEventListener("resize", schedule); window.removeEventListener("scroll", schedule, true); cancelAnimationFrame(frame); };
}
