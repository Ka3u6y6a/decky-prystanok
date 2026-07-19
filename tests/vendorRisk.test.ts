import { describe, expect, it } from "vitest";

import { VendorInfo } from "../src/api";
import { formatVendorRisk, riskyVendors } from "../src/lib/vendorRisk";

function vendor(over: Partial<VendorInfo>): VendorInfo {
  return {
    Name: "V",
    TotalGamesPublished: 0,
    TotalGamesDeveloped: 0,
    UkrainianGamesPublished: 0,
    UkrainianGamesDeveloped: 0,
    RussianGamesPublished: 0,
    RussianGamesDeveloped: 0,
    ...over,
  };
}

describe("riskyVendors", () => {
  it("drops vendors with no russian games", () => {
    expect(riskyVendors([vendor({ Name: "Clean", TotalGamesPublished: 10 })])).toEqual([]);
  });

  it("computes combined counts and share", () => {
    const [v] = riskyVendors([
      vendor({ Name: "Versus Evil", TotalGamesPublished: 27, RussianGamesPublished: 17 }),
    ]);
    expect(v).toMatchObject({ name: "Versus Evil", rus: 17, total: 27, majority: true });
    expect(Math.round(v.share * 100)).toBe(63);
  });

  it("sums published + developed for both russian and total", () => {
    const [v] = riskyVendors([
      vendor({
        Name: "X",
        TotalGamesPublished: 5,
        TotalGamesDeveloped: 5,
        RussianGamesPublished: 2,
        RussianGamesDeveloped: 1,
      }),
    ]);
    expect(v.rus).toBe(3);
    expect(v.total).toBe(10);
    expect(v.majority).toBe(false);
  });

  it("sorts by share descending (worst offender first)", () => {
    const res = riskyVendors([
      vendor({ Name: "Minor", TotalGamesPublished: 20, RussianGamesDeveloped: 1 }), // 5%
      vendor({ Name: "Major", TotalGamesPublished: 27, RussianGamesPublished: 17 }), // 63%
    ]);
    expect(res.map((v) => v.name)).toEqual(["Major", "Minor"]);
    expect(res[0].majority).toBe(true);
    expect(res[1].majority).toBe(false);
  });

  it("treats russian games with zero total as 100%", () => {
    const [v] = riskyVendors([vendor({ Name: "Ghost", RussianGamesPublished: 1 })]);
    expect(v.share).toBe(1);
    expect(v.majority).toBe(true);
  });

  it("handles undefined input", () => {
    expect(riskyVendors(undefined)).toEqual([]);
  });
});

describe("formatVendorRisk", () => {
  it("renders the site-style share string", () => {
    expect(
      formatVendorRisk({ name: "Versus Evil", rus: 17, total: 27, share: 17 / 27, majority: true })
    ).toBe("рос. ігор: 17 з 27 (63%)");
  });
});
