import { describe, expect, it } from "vitest";

import { GameDetails } from "../src/api";
import { locSourceLabel } from "../src/lib/locSource";

function d(over: Partial<GameDetails>): GameDetails {
  return { appid: 1, found: true, ...over } as GameDetails;
}

describe("locSourceLabel", () => {
  it("null when there's no localization at all", () => {
    expect(locSourceLabel(d({ loc: "none" }))).toBeNull();
    expect(locSourceLabel(d({ loc: "none", ukrainian: false, locSource: null }))).toBeNull();
  });

  it("Steam-only official", () => {
    expect(locSourceLabel(d({ loc: "text", official: true, locSource: "steam" }))).toBe(
      "Офіційна — джерело Steam"
    );
  });

  it("both sources", () => {
    expect(locSourceLabel(d({ loc: "audio", official: true, locSource: "both" }))).toBe(
      "Офіційна — Steam + Пристанок"
    );
  });

  it("Prystanok official", () => {
    expect(locSourceLabel(d({ loc: "text", official: true, locSource: "prystanok" }))).toBe(
      "Офіційна — джерело Пристанок"
    );
  });

  it("Prystanok unofficial → українізатор", () => {
    expect(locSourceLabel(d({ loc: "text", official: false, locSource: "prystanok" }))).toBe(
      "Українізатор — джерело Пристанок"
    );
  });

  it("no source but ukrainian flag → null (nothing to attribute)", () => {
    expect(locSourceLabel(d({ loc: "none", ukrainian: true, locSource: null }))).toBeNull();
  });
});
