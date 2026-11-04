import { useLayoutEffect, type RefObject } from "react";

/** Keep the dock inside the detail pane on pages with their own navigation list. */
export function useDockAlignment(contentRef: RefObject<HTMLElement | null>, dockRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    const content = contentRef.current;
    const dock = dockRef.current;
    if (!enabled || !content || !dock) return;

    let target: HTMLElement | null = null;
    let frame = 0;
    const selector = '[data-liwork-monitor-page], [data-settings-page]';
    const findTarget = () => content.querySelector<HTMLElement>(`:is(${selector}) [data-slot="list-page-main"]`) ?? content;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; update(); });
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    const update = () => {
      const next = findTarget();
      if (next !== target) {
        observer?.disconnect();
        target = next;
        observer?.observe(content);
        if (target !== content) observer?.observe(target);
      }
      const contentRect = content.getBoundingClientRect();
      const targetRect = next.getBoundingClientRect();
      const left = `${Math.round(Math.max(0, Math.min(targetRect.left - contentRect.left, contentRect.width)))}px`;
      if (dock.style.left !== left) dock.style.left = left;
    };
    const mutations = new MutationObserver((records) => {
      const paneAdded = records.some((record) => Array.from(record.addedNodes).some((node) =>
        node instanceof Element && (node.matches(selector) || node.querySelector(selector)),
      ));
      if ((target && !target.isConnected) || paneAdded) {
        if (findTarget() !== target) schedule();
      }
    });
    mutations.observe(content, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      observer?.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
      dock.style.removeProperty("left");
    };
  }, [contentRef, dockRef, enabled]);
}
