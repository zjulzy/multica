import { vi } from "vitest";

/** Give width-based media queries the same result as the configured viewport. */
export function mockViewportMedia() {
  return vi.spyOn(window, "matchMedia").mockImplementation((query) => {
    const minimum = /min-width:\s*(\d+)px/.exec(query);
    const maximum = /max-width:\s*(\d+)px/.exec(query);
    return {
      matches: !!(minimum || maximum) && (!minimum || window.innerWidth >= Number(minimum[1])) && (!maximum || window.innerWidth <= Number(maximum[1])),
      media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
      dispatchEvent: () => false,
    } as MediaQueryList;
  });
}
