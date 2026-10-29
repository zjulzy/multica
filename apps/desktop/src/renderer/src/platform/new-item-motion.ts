/** Watch briefly for an event's row to arrive; once seen it never replays on
 * virtual-list remounts. Initial data and pagination do not create watches. */
export function watchNewItem(attribute: string, id: string): () => void {
  const animations: Animation[] = [];
  const stop = () => {
    observer.disconnect();
    clearTimeout(timeout);
    for (const animation of animations) animation.cancel();
    animations.length = 0;
  };
  const find = () => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(`[${attribute}]`))
      .filter((element) => element.getAttribute(attribute) === id);
    if (!rows.length) return;
    observer.disconnect();
    clearTimeout(timeout);
    for (const row of rows) {
      const animation = row.animate?.([{ opacity: 0.6, translate: "0 4px" }, { opacity: 1, translate: "0 0" }],
        { duration: 240, easing: "ease-out" });
      if (animation) animations.push(animation);
    }
  };
  const observer = new MutationObserver(find);
  observer.observe(document.body, { childList: true, subtree: true });
  const timeout = setTimeout(stop, 4000);
  find();
  return stop;
}
