import { describe, expect, it } from "vitest";

import { GameDetails, VendorInfo } from "../src/api";
import { hasThreat, verdict } from "../src/lib/verdict";

function d(over: Partial<GameDetails>): GameDetails {
  return { appid: 1, found: true, ...over } as GameDetails;
}

function vendor(name: string, rusPub: number, totalPub: number): VendorInfo {
  return {
    Name: name,
    TotalGamesPublished: totalPub,
    TotalGamesDeveloped: 0,
    UkrainianGamesPublished: 0,
    UkrainianGamesDeveloped: 0,
    RussianGamesPublished: rusPub,
    RussianGamesDeveloped: 0,
  };
}

describe("verdict", () => {
  it("clean game → no threat, developer as sub", () => {
    const v = verdict(d({ developers: ["Larian Studios"], loc: "text", official: true }));
    expect(v.tone).toBe("clean");
    expect(v.title).toBe("Загроз не виявлено");
    expect(v.sub).toBe("Larian Studios");
  });

  it("vendor → amber tone, minority phrasing", () => {
    const v = verdict(d({ threatLevel: "vendor" }));
    expect(v.tone).toBe("vendor");
    expect(v.title).toBe("Видавець видавав рос. ігри");
    expect(v.sub).toContain("меншість");
  });

  it("suspect → red tone, names the majority vendor", () => {
    const v = verdict(d({ threatLevel: "suspect", vendors: [vendor("Versus Evil", 17, 27)] }));
    expect(v.tone).toBe("suspect");
    expect(v.title).toBe("Ймовірно сумнівна гра");
    expect(v.sub).toContain("Versus Evil");
  });

  it("russian → notes Ukrainian exists but game is russian", () => {
    const v = verdict(d({ threatLevel: "russian", loc: "text" }));
    expect(v.tone).toBe("russian");
    expect(v.title).toBe("Російська гра");
    expect(v.sub).toContain("Українська є");
  });

  it("russian without loc → no Ukrainian note", () => {
    expect(verdict(d({ threatLevel: "russian", loc: "none" })).sub).not.toContain("Українська є");
  });

  it("russian links only → suspect title, vendor (amber) tone", () => {
    const v = verdict(d({ russianLinks: ["VK"] }));
    expect(v.tone).toBe("vendor");
    expect(v.title).toBe("Ймовірно сумнівна гра");
  });
});

describe("hasThreat", () => {
  it("true for any threat signal", () => {
    expect(hasThreat(d({ threatLevel: "vendor" }))).toBe(true);
    expect(hasThreat(d({ russianLinks: ["VK"] }))).toBe(true);
  });
  it("false for a plain game", () => {
    expect(hasThreat(d({ loc: "text" }))).toBe(false);
  });
});
