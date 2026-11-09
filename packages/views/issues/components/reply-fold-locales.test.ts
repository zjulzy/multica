import { describe, expect, it } from "vitest";
import en from "../../locales/en/issues.json";
import fr from "../../locales/fr/issues.json";
import ja from "../../locales/ja/issues.json";
import ko from "../../locales/ko/issues.json";
import zhHans from "../../locales/zh-Hans/issues.json";
import zhHant from "../../locales/zh-Hant/issues.json";

describe("reply fold labels", () => {
  it.each([en, fr, ja, ko, zhHans, zhHant])("has readable expand and collapse labels", (locale) => {
    for (const label of [locale.comment.expand_reply, locale.comment.collapse_reply]) {
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/\?{2,}|\uFFFD/);
    }
  });
});
