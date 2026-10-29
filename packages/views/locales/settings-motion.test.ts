import { describe, expect, it } from "vitest";
import { RESOURCES } from "./index";

describe("desktop interface motion translations", () => {
  it("contains readable labels and descriptions in every supported language", () => {
    for (const bundle of Object.values(RESOURCES)) {
      const appearance = bundle.settings.desktop.appearance;
      expect(appearance.interface_motion_title).not.toContain("?");
      expect(appearance.interface_motion_description).not.toContain("?");
    }
    expect(RESOURCES["zh-Hans"].settings.desktop.appearance.interface_motion_title).toBe("界面动效");
  });
});
