import { describe, expect, it } from "vitest";
import en from "./en/settings.json";
import fr from "./fr/settings.json";
import ja from "./ja/settings.json";
import ko from "./ko/settings.json";
import hans from "./zh-Hans/settings.json";
import hant from "./zh-Hant/settings.json";

describe("lightweight inbox setting translations", () => {
  it("keeps all four labels free of replacement characters and question marks", () => {
    for (const settings of [en, fr, ja, ko, hans, hant]) {
      const appearance = settings.desktop.appearance;
      for (const value of [appearance.lightweight_inbox_title, appearance.lightweight_inbox_description, appearance.lightweight_inbox_count_title, appearance.lightweight_inbox_count_description]) {
        expect(value).toBeTruthy();
        expect(value).not.toMatch(/[?\uFFFD]/);
      }
    }
    expect(hans.desktop.appearance.lightweight_inbox_title).toBe("收件箱轻量任务视图");
  });
});
