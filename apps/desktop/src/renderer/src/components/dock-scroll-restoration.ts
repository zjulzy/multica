import type { ScrollRestorationAdapter, ScrollRestorationEntry } from "@multica/views/platform";

/** In-memory memento scoped to one Dock and workspace. */
export function createDockScrollRestoration() {
  const positions = new Map<string, ScrollRestorationEntry>();
  const state = new Map<string, string>();
  const captureElement = (element: HTMLElement) => {
    const key = element.dataset.tabScrollRoot;
    if (key) positions.set(key, { top: element.scrollTop, height: element.scrollHeight });
  };
  return {
    get: (key: string) => positions.get(key),
    getViewState: (key: string) => state.get(key),
    setViewState: (key: string, value: string | undefined) => {
      if (value === undefined) state.delete(key);
      else state.set(key, value);
    },
    captureElements: (root: HTMLElement) => {
      root.querySelectorAll<HTMLElement>("[data-tab-scroll-root]").forEach(captureElement);
    },
    captureElement,
  } satisfies ScrollRestorationAdapter & { captureElements(root: HTMLElement): void };
}
