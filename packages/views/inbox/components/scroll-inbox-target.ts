/** Move only the inbox scroller; native scrollIntoView may also move outer pages. */
export function scrollInboxTargetIntoView(container: HTMLElement, target: HTMLElement): void {
  const view = container.getBoundingClientRect();
  const item = target.getBoundingClientRect();
  if (item.top < view.top) container.scrollTop += item.top - view.top;
  else if (item.bottom > view.bottom) container.scrollTop += item.bottom - view.bottom;
}
