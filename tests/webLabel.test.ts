import { describe, expect, it } from "vitest";

import WebLabel from "../src/components/WebLabel";
import { FaGlobe } from "../src/components/icons";

// The jsx-runtime mock returns { type, props }, so we can inspect the tree.
describe("WebLabel", () => {
  it("renders the globe icon before the label text, in one shared span", () => {
    const el: any = (WebLabel as any)({ children: "Пристанок" });
    expect(el.type).toBe("span");
    const kids = el.props.children;
    expect(Array.isArray(kids)).toBe(true);
    // icon first (the FaGlobe component), label span second
    expect(kids[0].type).toBe(FaGlobe);
    expect(JSON.stringify(kids[1])).toContain("Пристанок");
  });
});
