import { describe, expect, it } from "vitest";

import { BadgeConfig, BadgePosition } from "../src/api";
import { alignItems, anchorStyle, appPageAnchor } from "../src/lib/badgeStyle";

function cfg(position: BadgePosition, offsetX = 10, offsetY = 20): BadgeConfig {
  return { enabled: true, size: 32, position, offsetX, offsetY };
}

describe("anchorStyle", () => {
  it("top/bottom map offsetY to the right edge", () => {
    expect(anchorStyle(cfg("top-left"))).toMatchObject({ top: "20px", left: "10px" });
    expect(anchorStyle(cfg("bottom-right"))).toMatchObject({ bottom: "20px", right: "10px" });
  });

  it("center uses translateX with offsetX as a nudge", () => {
    const s = anchorStyle(cfg("top-center", 8, 30));
    expect(s.top).toBe("30px");
    expect(s.left).toBe("50%");
    expect(s.transform).toBe("translateX(calc(-50% + 8px))");
    expect(s.right).toBeUndefined();
  });

  it("bottom-center anchors to bottom", () => {
    const s = anchorStyle(cfg("bottom-center", 0, 16));
    expect(s.bottom).toBe("16px");
    expect(s.left).toBe("50%");
  });
});

describe("appPageAnchor (anchors within the game header box)", () => {
  it("top starts below the status header, offsetY as the gap beneath it", () => {
    const s = appPageAnchor(cfg("top-right", 20, 20), 400);
    expect(s.top).toBe("60px"); // fallback STATUS_HEADER_PX (40) + offsetY (20)
    expect(s.right).toBe("20px");
    expect(s.transform).toBe("translate(0px, 0px)");
  });

  it("top uses the live-measured status-header height when provided", () => {
    // friends-pill present → header measured taller; gap stays offsetY beneath it
    expect(appPageAnchor(cfg("top-right", 20, 20), 400, 74).top).toBe("94px");
    expect(appPageAnchor(cfg("top-left", 20, 12), 400, 40).top).toBe("52px");
  });

  it("bottom measures from the header bottom (headerH - offsetY, translateY -100%)", () => {
    const s = appPageAnchor(cfg("bottom-left", 20, 40), 400);
    expect(s.top).toBe("360px"); // 400 - 40
    expect(s.left).toBe("20px");
    expect(s.transform).toBe("translate(0px, -100%)");
  });

  it("bottom-center combines center nudge + bottom anchor", () => {
    const s = appPageAnchor(cfg("bottom-center", 8, 30), 300);
    expect(s.top).toBe("270px");
    expect(s.left).toBe("50%");
    expect(s.transform).toBe("translate(calc(-50% + 8px), -100%)");
  });

  it("falls back to a default header height of 320 when unmeasured", () => {
    const s = appPageAnchor(cfg("bottom-right", 0, 20), 0);
    expect(s.top).toBe("300px"); // 320 - 20
  });
});

describe("alignItems", () => {
  it("maps horizontal anchor", () => {
    expect(alignItems(cfg("top-left"))).toBe("flex-start");
    expect(alignItems(cfg("top-right"))).toBe("flex-end");
    expect(alignItems(cfg("top-center"))).toBe("center");
    expect(alignItems(cfg("bottom-center"))).toBe("center");
  });
});
