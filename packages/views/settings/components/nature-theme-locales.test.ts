import { describe, expect, it } from "vitest";
import en from "../../locales/en/settings.json";
import fr from "../../locales/fr/settings.json";
import ja from "../../locales/ja/settings.json";
import ko from "../../locales/ko/settings.json";
import zhHans from "../../locales/zh-Hans/settings.json";
import zhHant from "../../locales/zh-Hant/settings.json";

describe("nature theme translations", () => {
  it("keeps the new theme names readable in every supported language", () => {
    const cases = [
      [en, ["Daisy Garden", "Hydrangea Rain", "Osmanthus Courtyard", "Starlit Dream"]],
      [fr, ["Jardin de marguerites", "Pluie d’hortensias", "Cour aux osmanthes", "Rêve étoilé"]],
      [ja, ["デイジーガーデン", "雨上がりの紫陽花", "金木犀の庭", "星空の夢"]],
      [ko, ["데이지 정원", "비 온 뒤 수국", "금목서 정원", "별빛 꿈"]],
      [zhHans, ["雏菊花园", "雨后绣球", "金桂秋庭", "星空梦境"]],
      [zhHant, ["雛菊花園", "雨後繡球", "金桂秋庭", "星空夢境"]],
    ] as const;
    for (const [locale, expected] of cases) {
      const t = locale.preferences.theme;
      expect([t.daisy_garden, t.hydrangea_rain, t.osmanthus_courtyard, t.starlit_dream]).toEqual(expected);
    }
  });
});
