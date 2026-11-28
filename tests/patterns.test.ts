import { describe, expect, it } from "vitest";
import { BufferAttribute, BufferGeometry, Color, Matrix4, MeshStandardMaterial, Vector4 } from "three";
import { batchSkeleton, type BonePart } from "../src/scene/batchSkeleton";
import { applyLayerView, isolationView, sceneView } from "../src/scene/isolation";
import { AO_COLOR_FRAGMENT, createBoneMaterial } from "../src/scene/material";
import {
  markColour,
  PATTERN_DARKEN,
  PATTERN_FRAGMENT,
  PATTERN_INDEX,
  PATTERN_OF,
  PATTERN_PERIOD_CSS,
  PATTERN_PERIOD_UNIFORM,
  patternAlpha,
  patternCells,
  patternMark,
  patternOfAlpha,
  patternPath,
  setPatternPixelRatio,
  withPattern,
  type Pattern,
} from "../src/scene/patterns";
import { TINT_ROLES } from "../src/scene/tints";
import { DEFAULT_MODES } from "../src/systems/registry";

// M14 BX (plan decision 8): the pattern cue on the role tints.

const PATTERNS: Pattern[] = ["stripes", "dots", "hatch"];
const share = (p: Pattern, n = 60) => {
  let on = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (patternMark(p, x + 0.5, y + 0.5, 6)) on++;
  return on / (n * n);
};

describe("pattern table", () => {
  it("origin stripes, insertion dots, antagonist cross-hatch (spec §12), one pattern per role", () => {
    expect(PATTERN_OF).toEqual({ origin: "stripes", insertion: "dots", antagonist: "hatch" });
    expect(new Set(TINT_ROLES.map((r) => PATTERN_OF[r])).size).toBe(TINT_ROLES.length);
    expect(TINT_ROLES.every((r) => PATTERN_INDEX[PATTERN_OF[r]] > 0)).toBe(true);
    expect(PATTERN_INDEX.none).toBe(0);
  });
  it("the index rides in the colour's alpha; the colours texture's default 1 means none", () => {
    expect(patternOfAlpha(1)).toBe("none");
    for (const p of [...PATTERNS, "none" as const]) expect(patternOfAlpha(patternAlpha(p))).toBe(p);
    // Float texture filtering or interpolation never moves it by half a step.
    expect(patternOfAlpha(patternAlpha("dots") + 0.3)).toBe("dots");
    const v = withPattern(new Vector4(), new Color(0.2, 0.4, 0.6), "hatch");
    expect(v.toArray()).toEqual([0.2, 0.4, 0.6, 4]);
  });
});

describe("pattern marks (the shader's rule, in JS)", () => {
  it("each pattern marks part of the surface and leaves the rest: two shades across a tinted structure", () => {
    expect(share("stripes")).toBeCloseTo(0.5, 1);
    expect(share("dots")).toBeGreaterThan(0.2);
    expect(share("dots")).toBeLessThan(0.35);
    expect(share("hatch")).toBeGreaterThan(0.4);
    expect(share("hatch")).toBeLessThan(0.65);
    expect(share("none")).toBe(0);
  });
  it("repeats every period, in both directions", () => {
    for (const p of PATTERNS)
      for (let y = 0; y < 12; y++)
        for (let x = 0; x < 12; x++) {
          // Off the cell centres, so a mark's exact edge (x + y = a multiple of 3) isn't decided by rounding.
          const m = patternMark(p, x + 0.37, y + 0.41, 6);
          expect(patternMark(p, x + 6.37, y + 0.41, 6)).toBe(m);
          expect(patternMark(p, x + 0.37, y + 6.41, 6)).toBe(m);
        }
  });
  it("the patterns differ from each other", () => {
    const cells = PATTERNS.map((p) => JSON.stringify(patternCells(p, 12)));
    expect(new Set(cells).size).toBe(PATTERNS.length);
  });
  it("the period follows the pixel ratio (about 6 CSS px on every screen)", () => {
    setPatternPixelRatio(2);
    expect(PATTERN_PERIOD_UNIFORM.value).toBe(2 * PATTERN_PERIOD_CSS);
    setPatternPixelRatio(1);
    expect(PATTERN_PERIOD_UNIFORM.value).toBe(PATTERN_PERIOD_CSS);
  });
});

describe("the shader", () => {
  it("is part of the bone and layer material, after the tint, with the shared period uniform", () => {
    const m = createBoneMaterial();
    const shader = {
      fragmentShader: "#include <common>\nvoid main() {\n#include <color_fragment>\n}",
      vertexShader: "#include <common>\nvoid main() {\n#include <color_vertex>\n}",
      uniforms: {} as Record<string, unknown>,
    };
    m.onBeforeCompile(shader as never, undefined as never);
    expect(AO_COLOR_FRAGMENT).toContain(PATTERN_FRAGMENT);
    expect(AO_COLOR_FRAGMENT.indexOf("vTint.rgb")).toBeLessThan(AO_COLOR_FRAGMENT.indexOf("vTint.a"));
    expect(shader.fragmentShader).toContain("uniform float uPatternPeriod;");
    expect(shader.uniforms.uPatternPeriod).toBe(PATTERN_PERIOD_UNIFORM);
    expect(PATTERN_FRAGMENT).toContain("gl_FragCoord"); // screen space: static, nothing animates
    expect(PATTERN_FRAGMENT).toContain(`1.0 - ${PATTERN_DARKEN.toFixed(3)} * mark`);
  });
});

describe("legend swatches", () => {
  it("the darker shade is the shader's 25 % (linear) darker, not black", () => {
    const a = new Color("#F0E442");
    const b = new Color(markColour("#F0E442"));
    for (const k of ["r", "g", "b"] as const) if (a[k] > 0.05) expect(b[k] / a[k]).toBeCloseTo(1 - PATTERN_DARKEN, 1);
    expect(markColour("#000000")).toBe("#000000");
  });
  it("draws the same cells as the shader, one SVG path per pattern", () => {
    expect(patternPath("none")).toBe("");
    for (const p of PATTERNS) expect(patternPath(p)).toMatch(/^M/);
    // Rows run top to bottom on screen, gl_FragCoord's y bottom to top: row r is y = n - r - 0.5.
    const n = 12;
    for (const p of PATTERNS)
      patternCells(p, n).forEach((row, r) => row.forEach((on, x) => expect(on).toBe(patternMark(p, x + 0.5, n - r - 0.5, n))));
    // So on screen the stripes (x + y constant, y up) run down to the right, as in the shader.
    const c = patternCells("stripes", n);
    for (let r = 0; r < n - 1; r++) for (let x = 0; x < n - 1; x++) expect(c[r + 1]![x + 1]).toBe(c[r]![x]);
  });
});

describe("applyLayerView sets the pattern with the tint", () => {
  const tri = (o: number) => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array([o, 0, 0, o + 1, 0, 0, o, 1, 0]), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
    g.setIndex([0, 1, 2]);
    return g;
  };
  const ids = ["femur_left", "tibia_left", "fibula_left", "patella_left"];
  const parts = (): BonePart[] => ids.map((id, i) => ({ id, geometry: tri(i * 2), matrixWorld: new Matrix4() }));
  const white = new Color(1, 1, 1);
  const accent = new Color(0, 0, 1);
  const tint = { origin: new Color(1, 1, 0), insertion: new Color(0, 0.5, 1), antagonist: new Color(1, 0, 1) };
  const alpha = (b: ReturnType<typeof batchSkeleton>, id: string) => b.mesh.getColorAt(b.instanceOf.get(id)!, new Vector4()).w;

  it("origin stripes, insertion dots, antagonist hatch; the focus and the rest none; cleared when the tint goes", () => {
    const solid = batchSkeleton(parts(), new MeshStandardMaterial(), { instanceColours: true });
    const base = isolationView(null, 0, "ghost", () => true);
    const tints = new Map([
      ["tibia_left", "origin"],
      ["fibula_left", "insertion"],
      ["patella_left", "antagonist"],
    ] as const);
    const view = sceneView({ ...base, tints }, DEFAULT_MODES);
    applyLayerView("bones", solid, null, view, [], () => white, accent, tint);
    expect(patternOfAlpha(alpha(solid, "tibia_left"))).toBe("stripes");
    expect(patternOfAlpha(alpha(solid, "fibula_left"))).toBe("dots");
    expect(patternOfAlpha(alpha(solid, "patella_left"))).toBe("hatch");
    expect(patternOfAlpha(alpha(solid, "femur_left"))).toBe("none");
    expect(solid.mesh.getColorAt(solid.instanceOf.get("tibia_left")!, new Color()).toArray()).toEqual([1, 1, 0]);

    // The tints go (the previously tinted are in `previous`): colour and pattern both back.
    applyLayerView("bones", solid, null, sceneView(base, DEFAULT_MODES), [...tints.keys()], () => white, accent, tint);
    for (const id of ids) expect(patternOfAlpha(alpha(solid, id))).toBe("none");
  });
});
