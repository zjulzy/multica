/** Synchronize Virtuoso when its first offscreen measurement left the list empty. */
export function synchronizeUnmeasuredTimeline(scroller: HTMLElement, list: HTMLElement): boolean {
  if (scroller.clientHeight <= 0 || list.getBoundingClientRect().height > 0) return false;
  scroller.dispatchEvent(new Event("scroll"));
  return true;
}

/** Retry only during initial layout; a suspended guest can attach Virtuoso late. */
export function scheduleTimelineScrollSynchronization(scroller: HTMLElement, getList: () => HTMLElement | null): () => void {
  const delays = [0, 100, 300, 700, 1500, 3000];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let index = 0;
  const check = () => {
    const list = getList();
    if (list && list.getBoundingClientRect().height > 0) return;
    if (list) synchronizeUnmeasuredTimeline(scroller, list);
    const delay = delays[index++];
    if (delay !== undefined) timer = setTimeout(check, delay);
  };
  timer = setTimeout(check, delays[index++]);
  return () => { if (timer !== undefined) clearTimeout(timer); };
}
