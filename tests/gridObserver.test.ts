// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { GameStatus } from "../src/api";
import { badgesFor, hasTileBadge, parseAppId, parseFeaturedAppId } from "../src/lib/gridObserver";
import { CC, HAND, SHIELD, SPEAKER, TRIANGLE } from "../src/lib/iconPaths";
import { WARN } from "../src/lib/badgeTokens";
import { TILE_ATTR } from "../src/lib/chipStyle";

function status(over: Partial<GameStatus>): GameStatus {
  return { appid: 1, found: true, ...over };
}

describe("parseAppId", () => {
  it("local steamloopback capsule", () => {
    expect(
      parseAppId("https://steamloopback.host/assets/646570/library_600x900.jpg?c=278114312")
    ).toBe(646570);
  });

  it("cdn apps capsule", () => {
    expect(
      parseAppId(
        "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1643320/abc/library_600x900.jpg"
      )
    ).toBe(1643320);
  });

  it("legacy underscore capsule", () => {
    expect(parseAppId("https://x/289620_library_600x900.jpg")).toBe(289620);
  });

  it("home-screen landscape capsule (library_capsule with hash dir)", () => {
    expect(
      parseAppId("https://steamloopback.host/assets/2536520/abc123/library_capsule.jpg?c=1")
    ).toBe(2536520);
  });

  it("home-screen library_header capsule", () => {
    expect(parseAppId("https://steamloopback.host/assets/489630/library_header.jpg")).toBe(489630);
  });

  it("does not treat the featured card face (bare header.jpg) as a capsule", () => {
    // header.jpg is handled separately (parseFeaturedAppId), gated on app-page.
    expect(parseAppId("https://steamloopback.host/assets/560130/header.jpg")).toBeUndefined();
    expect(parseAppId("https://steamloopback.host/assets/560130/library_hero.jpg")).toBeUndefined();
  });

  it("ignores avatars and unrelated urls", () => {
    expect(parseAppId("https://avatars.steamstatic.com/abc_full.jpg")).toBeUndefined();
    expect(parseAppId("")).toBeUndefined();
    expect(parseAppId("https://x/spinner.png")).toBeUndefined();
  });
});

describe("parseFeaturedAppId (home featured card face)", () => {
  it("matches the card's bare header.jpg", () => {
    expect(parseFeaturedAppId("https://steamloopback.host/assets/1287840/header.jpg?c=1")).toBe(1287840);
  });

  it("does not match capsules, library_header, or the full-bleed library_hero", () => {
    expect(parseFeaturedAppId("https://steamloopback.host/assets/646570/library_600x900.jpg")).toBeUndefined();
    expect(parseFeaturedAppId("https://steamloopback.host/assets/489630/library_header.jpg")).toBeUndefined();
    expect(parseFeaturedAppId("https://steamloopback.host/assets/560130/library_hero.jpg")).toBeUndefined();
  });
});

describe("badgesFor", () => {
  it("not found → none", () => {
    expect(badgesFor(status({ found: false }))).toEqual([]);
  });

  it("russian → hand icon only (no text)", () => {
    const b = badgesFor(status({ threatLevel: "russian", loc: "text" }));
    expect(b).toHaveLength(1);
    expect(b[0].icon).toBe(HAND);
    expect(b[0].text).toBeUndefined();
  });

  it("suspect → triangle icon above the UA flag chip", () => {
    const b = badgesFor(status({ threatLevel: "suspect", loc: "text" }));
    expect(b[0].icon).toBe(TRIANGLE);
    expect(b[1].flag).toBe(true);
  });

  it("suspect alone → triangle icon", () => {
    const b = badgesFor(status({ threatLevel: "suspect", loc: "none" }));
    expect(b).toHaveLength(1);
    expect(b[0].icon).toBe(TRIANGLE);
  });

  it("vendor → shield icon (amber)", () => {
    const b = badgesFor(status({ loc: "none", threatLevel: "vendor" }));
    expect(b[0].icon).toBe(SHIELD);
    expect(b[0].background).toBe(WARN);
  });

  it("russian links → triangle icon (amber)", () => {
    const b = badgesFor(status({ loc: "none", russianLinks: ["VK"] }));
    expect(b[0].icon).toBe(TRIANGLE);
    expect(b[0].background).toBe(WARN);
  });

  it("UA official loc → flag + type icons (text → CC, audio → CC+speaker)", () => {
    const t = badgesFor(status({ loc: "text" }))[0];
    expect(t.flag).toBe(true);
    expect(t.text).toBeUndefined();
    expect(t.icons).toEqual([CC]);
    expect(badgesFor(status({ loc: "audio" }))[0].icons).toEqual([CC, SPEAKER]);
  });

  it("UA fan → flag + icons, dashed border", () => {
    const b = badgesFor(status({ loc: "text", official: false }))[0];
    expect(b.flag).toBe(true);
    expect(b.icons).toEqual([CC]);
    expect(b.border).toContain("dashed");
  });

  it("UA semi-official → flag + icons (official look on the tiny capsule)", () => {
    const b = badgesFor(status({ loc: "text", semiOfficial: true }))[0];
    expect(b.flag).toBe(true);
    expect(b.icons).toEqual([CC]);
    expect(b.border).not.toContain("dashed");
  });

  it("ukrainian game (origin, no loc) → flag only", () => {
    const b = badgesFor(status({ loc: "none", ukrainian: true }));
    expect(b[0].flag).toBe(true);
    expect(b[0].icons).toBeUndefined();
  });

  it("non-uk target → language-code text + green ✓ + type icons, no flag", () => {
    const b = badgesFor(status({ loc: "text", locLang: "pl" }));
    expect(b[0].text).toBe("PL");
    expect(b[0].flag).toBeFalsy();
    expect(b[0].lead).toBe("✓");
    expect(b[0].icons).toEqual([CC]);
    expect(badgesFor(status({ loc: "audio", locLang: "de" }))[0].icons).toEqual([CC, SPEAKER]);
  });

  it("showLoc=false → threat icon stays, loc dropped", () => {
    const b = badgesFor(status({ threatLevel: "vendor", loc: "text" }), true, false);
    expect(b).toHaveLength(1);
    expect(b[0].icon).toBe(SHIELD);
    expect(badgesFor(status({ loc: "text" }), true, false)).toEqual([]); // no threat → empty
  });

  it("surface off → only russian (icon); softer warnings dropped", () => {
    expect(badgesFor(status({ threatLevel: "vendor", loc: "text" }), false, true)).toEqual([]);
    expect(badgesFor(status({ threatLevel: "suspect" }), false, true)).toEqual([]);
    expect(badgesFor(status({ russianLinks: ["VK"] }), false, true)).toEqual([]);
    expect(badgesFor(status({ loc: "text" }), false, true)).toEqual([]);
    expect(badgesFor(status({ threatLevel: "russian" }), false, false)[0].icon).toBe(HAND);
  });

  it("non-game types are not badged", () => {
    expect(badgesFor(status({ threatLevel: "russian", appType: "Music" }))).toEqual([]);
    expect(badgesFor(status({ loc: "text", appType: "Hardware" }))).toEqual([]);
    expect(badgesFor(status({ loc: "text", appType: "Game" })).length).toBeGreaterThan(0);
  });

  it("plain game → none", () => {
    expect(badgesFor(status({ loc: "none" }))).toEqual([]);
  });
});

describe("hasTileBadge (React tile patch owns the capsule)", () => {
  // Shape measured on device: root > cover > img, badge 1 level under root
  // (nesting 1) or 2 levels via a wrapper (nesting 2, landscape home tiles).
  function tile(badgeAppid?: number, nesting: 1 | 2 = 2) {
    const root = document.createElement("div");
    const cover = document.createElement("div");
    const img = document.createElement("img");
    cover.appendChild(img);
    root.appendChild(cover);
    if (badgeAppid !== undefined) {
      const badge = document.createElement("div");
      badge.setAttribute(TILE_ATTR, String(badgeAppid));
      if (nesting === 1) {
        root.appendChild(badge);
      } else {
        const inner = document.createElement("div");
        inner.appendChild(badge);
        root.appendChild(inner);
      }
    }
    return { root, img };
  }

  it("sees a badge rendered directly under the tile root", () => {
    expect(hasTileBadge(tile(10, 1).img, 10)).toBe(true);
  });

  it("sees a badge wrapped one level deeper (landscape home tiles double-badged before)", () => {
    expect(hasTileBadge(tile(10, 2).img, 10)).toBe(true);
  });

  it("no tile badge → observer draws it", () => {
    expect(hasTileBadge(tile().img, 10)).toBe(false);
  });

  it("ignores a badge for another game", () => {
    expect(hasTileBadge(tile(20).img, 10)).toBe(false);
  });

  it("doesn't pick up a neighbouring tile's badge", () => {
    const row = document.createElement("div");
    const mine = tile();
    const neighbour = tile(10); // same appid shown twice, only the neighbour badged
    row.append(mine.root, neighbour.root);
    expect(hasTileBadge(mine.img, 10)).toBe(false);
  });
});

