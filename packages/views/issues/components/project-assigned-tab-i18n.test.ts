import { describe, expect, it } from "vitest";
import en from "../../locales/en/issues.json";
import zhHans from "../../locales/zh-Hans/issues.json";
import zhHant from "../../locales/zh-Hant/issues.json";
import ja from "../../locales/ja/issues.json";
import ko from "../../locales/ko/issues.json";
import fr from "../../locales/fr/issues.json";

describe("project assigned-to-me tab translations", () => {
  it("uses readable simplified Chinese", () => {
    expect(zhHans.scope.mine_label).toBe("分配给我");
    expect(zhHans.scope.mine_description).toBe("当前项目中由我负责的任务");
  });

  it.each([["en", en], ["zh-Hans", zhHans], ["zh-Hant", zhHant], ["ja", ja], ["ko", ko], ["fr", fr]])(
    "has intact text for %s",
    (_language, locale) => {
      expect(locale.scope.mine_label).not.toMatch(/[?\uFFFD]/);
      expect(locale.scope.mine_description).not.toMatch(/[?\uFFFD]/);
    },
  );
});
