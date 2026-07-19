import { describe, expect, it } from "vitest";

import { GameStatus } from "../src/api";
import { badgeContents, ORANGE, RED, UA, UA_BLUE } from "../src/components/badgeContent";
import { LANG_LOC_BG } from "../src/lib/badgeTokens";

function status(over: Partial<GameStatus>): GameStatus {
  return { appid: 1, found: true, ...over };
}

describe("badgeContents", () => {
  it("returns nothing when not found", () => {
    expect(badgeContents(status({ found: false }), true)).toEqual([]);
  });

  it("returns nothing for a plain non-UA, non-threat game", () => {
    expect(badgeContents(status({ loc: "none" }), true)).toEqual([]);
  });

  it("russian-origin game → single red 'російська гра' badge", () => {
    const b = badgeContents(status({ threatLevel: "russian", loc: "text" }), true);
    expect(b).toHaveLength(1);
    expect(b[0].label).toBe("російська гра");
    expect(b[0].background).toBe(RED);
  });

  it("russian-origin suppresses the localization badge", () => {
    const b = badgeContents(status({ threatLevel: "russian", loc: "audio", ukrainian: true }), true);
    expect(b).toHaveLength(1);
    expect(b[0].label).toBe("російська гра");
  });

  it("suspect (russian publisher) → red 'ймовірно сумнівна гра', not 'російська гра'", () => {
    const b = badgeContents(status({ threatLevel: "suspect", loc: "none" }), true);
    expect(b).toHaveLength(1);
    expect(b[0].label).toBe("ймовірно сумнівна гра");
    expect(b[0].background).toBe(RED);
  });

  it("warning is on top, localization below", () => {
    const b = badgeContents(status({ threatLevel: "suspect", loc: "text" }), true);
    expect(b).toHaveLength(2);
    expect(b[0].label).toBe("ймовірно сумнівна гра");
    expect(b[0].background).toBe(RED);
    expect(b[1].background).toBe(UA);
  });

  it("suspect short label in non-detailed mode", () => {
    const b = badgeContents(status({ threatLevel: "suspect", loc: "none" }), false);
    expect(b[0].label).toBe("сумнівна");
  });

  it("loc type shown as icons, not words (detailed): text → 1, audio → 2", () => {
    const text = badgeContents(status({ loc: "text" }), true);
    expect(text[0].label).toBe("УКР"); // prefix only, no ": текст"
    expect(text[0].typeIcons).toHaveLength(1); // CC
    const audio = badgeContents(status({ loc: "audio" }), true);
    expect(audio[0].label).toBe("УКР");
    expect(audio[0].typeIcons).toHaveLength(2); // CC + speaker
    expect(audio[0].background).toBe(UA);
  });

  it("official localization → scrim badge with UA-blue border", () => {
    const b = badgeContents(status({ loc: "text", official: true }), true);
    expect(b[0].label).toBe("УКР");
    expect(b[0].background).toBe(UA); // SCRIM (re-exported as UA)
    expect(b[0].border).toContain(UA_BLUE);
  });

  it("null official (Steam-listed, no KULI) is treated as built-in", () => {
    const b = badgeContents(status({ loc: "text", official: null }), true);
    expect(b[0].label).toBe("УКР");
    expect(b[0].background).toBe(UA);
  });

  it("unofficial localization → 'Українізатор', dashed border", () => {
    const b = badgeContents(status({ loc: "audio", official: false }), true);
    expect(b[0].label).toBe("Українізатор");
    expect(b[0].background).toBe(UA); // SCRIM
    expect(b[0].border).toContain("dashed");
  });

  it("non-detailed drops type icons (prefix stays)", () => {
    expect(badgeContents(status({ loc: "audio" }), false)[0].typeIcons).toBeUndefined();
    expect(badgeContents(status({ loc: "audio" }), false)[0].label).toBe("УКР");
    expect(badgeContents(status({ loc: "text", official: false }), false)[0].label).toBe("Українізатор");
  });

  it("non-uk target → language-code badge, plain blue, no українізатор", () => {
    const b = badgeContents(status({ loc: "text", locLang: "pl", official: true }), true);
    expect(b[0].label).toBe("PL");
    expect(b[0].typeIcons).toHaveLength(1);
    expect(b[0].background).toBe(LANG_LOC_BG);
    // even official===false stays plain code (no dashed "українізатор") for non-UA
    const b2 = badgeContents(status({ loc: "audio", locLang: "de", official: false }), false);
    expect(b2[0].label).toBe("DE");
    expect(b2[0].background).toBe(LANG_LOC_BG);
  });

  it("ukrainian game without localization", () => {
    const b = badgeContents(status({ loc: "none", ukrainian: true }), true);
    expect(b).toHaveLength(1);
    expect(b[0].label).toBe("українська гра");
  });

  it("vendor-level threat adds an orange warning alongside the UA badge", () => {
    const b = badgeContents(status({ loc: "text", threatLevel: "vendor" }), true);
    expect(b).toHaveLength(2);
    expect(b[0].background).toBe(ORANGE);
    expect(b[0].label).toBe("видавець видавав рос. ігри");
    expect(b[1].background).toBe(UA);
  });

  it("vendor-level threat alone (no localization)", () => {
    const b = badgeContents(status({ loc: "none", threatLevel: "vendor" }), true);
    expect(b).toHaveLength(1);
    expect(b[0].background).toBe(ORANGE);
  });

  it("vendor warning short label in non-detailed mode", () => {
    const b = badgeContents(status({ loc: "none", threatLevel: "vendor" }), false);
    expect(b[0].label).toBe("видавець");
  });

  it("russian links → orange 'ймовірно сумнівна гра' (Disciples-like, no vendor signal)", () => {
    const b = badgeContents(status({ loc: "none", russianLinks: ["VK"] }), true);
    expect(b).toHaveLength(1);
    expect(b[0].label).toBe("ймовірно сумнівна гра");
    expect(b[0].background).toBe(ORANGE);
  });

  it("russian links coexist with localization; short label is 'сумнівна'", () => {
    const det = badgeContents(status({ loc: "text", russianLinks: ["VK"] }), true);
    expect(det.map((x) => x.label)).toEqual(["ймовірно сумнівна гра", "УКР"]);
    expect(det[0].background).toBe(ORANGE);
    const short = badgeContents(status({ loc: "none", russianLinks: ["VK", "Rutube"] }), false);
    expect(short[0].label).toBe("сумнівна");
  });

  it("showLoc=false → warning stays, localization dropped", () => {
    const b = badgeContents(status({ threatLevel: "vendor", loc: "text", official: true }), true, true, false);
    expect(b).toHaveLength(1);
    expect(b[0].label).toBe("видавець видавав рос. ігри");
  });

  it("showLoc=false with no threat → empty", () => {
    expect(badgeContents(status({ loc: "text", official: true }), true, true, false)).toEqual([]);
  });

  it("surface off → only a russian game badges; softer warnings are dropped", () => {
    expect(badgeContents(status({ threatLevel: "vendor", loc: "text" }), true, false, true)).toEqual([]);
    expect(badgeContents(status({ threatLevel: "suspect" }), true, false, true)).toEqual([]);
    expect(badgeContents(status({ russianLinks: ["VK"] }), true, false, true)).toEqual([]);
    expect(badgeContents(status({ loc: "text", official: true }), true, false, true)).toEqual([]);
  });

  it("russian badge always shows even with the surface off", () => {
    expect(
      badgeContents(status({ threatLevel: "russian", loc: "text" }), true, false, false)[0].label
    ).toBe("російська гра");
  });

  it("a stronger threat suppresses the orange links verdict (no duplicate)", () => {
    const suspect = badgeContents(status({ threatLevel: "suspect", russianLinks: ["VK"] }), true);
    expect(suspect.map((x) => x.label)).toEqual(["ймовірно сумнівна гра"]);
    expect(suspect[0].background).toBe(RED);
    const russian = badgeContents(status({ threatLevel: "russian", russianLinks: ["VK"] }), true);
    expect(russian.map((x) => x.label)).toEqual(["російська гра"]);
  });

  it("semi-official localization → 'Напівофіційна', official look", () => {
    const det = badgeContents(status({ loc: "text", semiOfficial: true }), true);
    expect(det[0].label).toBe("Напівофіційна");
    expect(det[0].background).toBe(UA); // scrim (official look, not fan)
    expect(det[0].typeIcons).toHaveLength(1);
  });

  it("non-game types are not badged (soundtracks, trailers, hardware)", () => {
    expect(badgeContents(status({ threatLevel: "russian", appType: "Music" }), true)).toEqual([]);
    expect(badgeContents(status({ loc: "text", appType: "Video" }), true)).toEqual([]);
    // a real game type (or unknown type) still badges
    expect(badgeContents(status({ loc: "text", appType: "Game" }), true).length).toBeGreaterThan(0);
    expect(badgeContents(status({ loc: "text" }), true).length).toBeGreaterThan(0);
  });
});
