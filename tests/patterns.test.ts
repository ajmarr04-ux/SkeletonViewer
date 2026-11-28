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
  PATTERN_FRAGMENT_PARS,
  PATTERN_MIN_CSS,
  PATTERN_MIN_PX_UNIFORM,
  PATTERN_PERIOD_M,
  PATTERN_VERTEX,
  patternAlpha,
  patternCells,
  patternMark,
  patternOfAlpha,
  patternPath,
  setPatternPixelRatio,
  surfaceMark,
  withPattern,
  type Pattern,
} from "../src/scene/patterns";
import { TINT_ROLES } from "../src/scene/tints";
import { DEFAULT_MODES } from "../src/systems/registry";

// M14 BX (plan decision 8): the pattern cue on the role tints; M14 CA: surface-locked.

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
  it("the smallest on-screen period follows the pixel ratio (the same CSS px on every screen)", () => {
    setPatternPixelRatio(2);
    expect(PATTERN_MIN_PX_UNIFORM.value).toBe(2 * PATTERN_MIN_CSS);
    setPatternPixelRatio(1);
    expect(PATTERN_MIN_PX_UNIFORM.value).toBe(PATTERN_MIN_CSS);
  });
});

// M14 CA: the marks are on the surface (world space, triplanar), not the screen.
describe("surface-locked marks (the shader's rule, in JS)", () => {
  const P = PATTERN_PERIOD_M;
  const sharp = P / 1000; // a close view: one device pixel is a thousandth of a period
  it("seen squarely and close, they are the legend's marks on the plane the surface faces", () => {
    for (const p of PATTERNS)
      for (let y = 0; y < 12; y++)
        for (let x = 0; x < 12; x++) {
          const [u, v] = [(x + 0.37) / 12, (y + 0.41) / 12];
          const want = patternMark(p, u, v, 1) ? 1 : 0;
          expect(surfaceMark(p, [u * P, v * P, 0.3 * P], [0, 0, 1], sharp).mark).toBeCloseTo(want, 3); // front: x, y
          expect(surfaceMark(p, [0.3 * P, u * P, v * P], [-1, 0, 0], sharp).mark).toBeCloseTo(want, 3); // side: y, z
          expect(surfaceMark(p, [v * P, 0.3 * P, u * P], [0, 1, 0], sharp).mark).toBeCloseTo(want, 3); // top: z, x
        }
  });
  it("stay on the surface: the same point gives the same mark whatever the camera, until the octave changes", () => {
    // Pan and orbit change neither the point nor (much) the pixel footprint; zoom changes only the footprint.
    for (const p of PATTERNS)
      for (const px of [P / 200, P / 40, P / 20]) {
        const a = surfaceMark(p, [0.0031, 0.0017, 0], [0, 0, 1], px);
        expect(a.lod).toBe(0);
        expect(surfaceMark(p, [0.0031 + P, 0.0017 - P, 0], [0, 0, 1], px).mark).toBeCloseTo(a.mark, 6);
      }
  });
  it("never smaller than the smallest period on screen: zoomed out they coarsen by octaves, cross-faded", () => {
    for (const zoomOut of [1, 2, 3, 8, 50]) {
      const px = (P / PATTERN_MIN_CSS) * zoomOut; // metres per device pixel
      const { lod } = surfaceMark("dots", [0, 0, 0], [0, 0, 1], px);
      expect(lod).toBeCloseTo(Math.log2(zoomOut), 6);
      // The coarser octave drawn spans at least the smallest period on screen.
      expect((P * 2 ** Math.ceil(lod)) / px).toBeGreaterThanOrEqual(PATTERN_MIN_CSS - 1e-9);
    }
    // Continuous across an octave boundary (no pop while zooming).
    const at = (px: number) => surfaceMark("stripes", [0.0023, 0.0041, 0], [0, 0, 1], px).mark;
    const edge = (P / PATTERN_MIN_CSS) * 2;
    expect(Math.abs(at(edge * 0.9999) - at(edge * 1.0001))).toBeLessThan(0.01);
  });
  it("anti-aliased: a mark's edge ramps over about a pixel, not a hard step", () => {
    const px = P / 18; // the default framing: 18 device px per period
    const ramp = Array.from({ length: 40 }, (_, i) => surfaceMark("stripes", [(i / 40) * P, 0, 0], [0, 0, 1], px).mark);
    expect(ramp.some((m) => m > 0.05 && m < 0.95)).toBe(true);
    expect(ramp.filter((m) => m > 0.05 && m < 0.95).length).toBeLessThanOrEqual(6);
  });
  it("blend between the planes where the surface faces none of them squarely", () => {
    const n: [number, number, number] = [1, 1, 0];
    const m = surfaceMark("stripes", [0.001, 0.002, 0.003], n, sharp).mark;
    expect(m).toBeGreaterThanOrEqual(0);
    expect(m).toBeLessThanOrEqual(1);
  });
});

describe("the shader", () => {
  it("is part of the bone and layer material, after the tint, with the shared period uniform", () => {
    const m = createBoneMaterial();
    const shader = {
      fragmentShader: "#include <common>\nvoid main() {\n#include <color_fragment>\n}",
      vertexShader: "#include <common>\nvoid main() {\n#include <color_vertex>\n#include <project_vertex>\n}",
      uniforms: {} as Record<string, unknown>,
    };
    m.onBeforeCompile(shader as never, undefined as never);
    expect(AO_COLOR_FRAGMENT).toContain(PATTERN_FRAGMENT);
    expect(AO_COLOR_FRAGMENT.indexOf("vTint.rgb")).toBeLessThan(AO_COLOR_FRAGMENT.indexOf("vTint.a"));
    expect(shader.fragmentShader).toContain(PATTERN_FRAGMENT_PARS);
    expect(shader.fragmentShader).toContain("uniform float uPatternMinPx;");
    expect(shader.uniforms.uPatternMinPx).toBe(PATTERN_MIN_PX_UNIFORM);
    // Surface-locked (M14 CA): world-space position from the vertex shader, never the screen's.
    expect(shader.vertexShader).toContain(PATTERN_VERTEX);
    expect(shader.vertexShader.indexOf("vPatPos =")).toBeLessThan(shader.vertexShader.indexOf("#include <project_vertex>"));
    expect(PATTERN_FRAGMENT).not.toContain("gl_FragCoord");
    expect(PATTERN_FRAGMENT).toContain(PATTERN_PERIOD_M.toFixed(3));
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
