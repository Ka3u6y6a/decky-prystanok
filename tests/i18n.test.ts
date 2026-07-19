import { afterEach, describe, expect, it } from "vitest";

import { setLangForTest, t } from "../src/lib/i18n";

afterEach(() => setLangForTest(null));

describe("i18n", () => {
  it("Ukrainian is the source language", () => {
    setLangForTest("uk");
    expect(t("badge.russian")).toBe("російська гра");
    expect(t("verdict.clean.title")).toBe("Загроз не виявлено");
  });

  it("English resolves when the UI language is English", () => {
    setLangForTest("en");
    expect(t("badge.russian")).toBe("Russian game");
    expect(t("verdict.clean.title")).toBe("No threats found");
    expect(t("set.langAuto")).toBe("Same as Steam");
  });

  it("interpolates {name}/{n} placeholders", () => {
    setLangForTest("uk");
    expect(t("vendor.risk", { rus: 1, total: 16, pct: 6 })).toBe("рос. ігор: 1 з 16 (6%)");
    setLangForTest("en");
    expect(t("verdict.suspect.sub", { name: "Versus Evil" })).toContain("Versus Evil");
  });

  it("unknown key falls back to the key itself", () => {
    expect(t("does.not.exist")).toBe("does.not.exist");
  });
});
