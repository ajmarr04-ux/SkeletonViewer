import { describe, expect, it } from "vitest";
import { screenshotFileName, slug, stripBox } from "../src/scene/screenshot";

describe("screenshot", () => {
  it("names the file after the selection or group", () => {
    expect(screenshotFileName("femur_left", null)).toBe("skeleton-femur-left.png");
    expect(screenshotFileName("sternum", null)).toBe("skeleton-sternum.png");
    expect(screenshotFileName(null, "dentition.type.molars")).toBe("skeleton-molars-upper-and-lower.png");
    expect(screenshotFileName(null, null)).toBe("skeleton.png");
    expect(slug("Côte (gauche)!")).toBe("cote-gauche");
  });

  it("puts the strip bottom right, scaled, and never wider than the image", () => {
    const s = stripBox(2560, 1600, 800, 2);
    expect(s.x + s.w).toBe(2560);
    expect(s.y + s.h).toBe(1600);
    expect(s.fontPx).toBe(24);
    expect(s.w).toBe(800 + 24);
    const narrow = stripBox(300, 600, 500, 1);
    expect(narrow.x).toBe(0);
    expect(narrow.w).toBe(300);
  });
});
