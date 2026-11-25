// The muscles layer: muscles and their parts (M6), the outermost layer.
import type { KindTiers } from "../../../graph/types";
import { defineLayer } from "../../types";

const ATTACHMENTS = ["originates_on", "inserts_on"];

/**
 * Tiers (M12 plan decision 6; musculoskeletal spec §5.2), each sorted by ID.
 * Tier 1: the muscle as its parts, and every structure named in its (and its
 * parts') origin and insertion; a part's `inherit` is its own inherited edges.
 * Tier 2: + its synergists and their attachments. `ant`: the antagonists that
 * aren't synergists, a muscle replaced by its parts (the tints, spec §5.3).
 */
const MUSCLE_TIERS = {
  t1: { steps: [{ self: true }, { follow: ATTACHMENTS, from: "self+parts" }], order: "id" },
  t2: { steps: [{ tier: "t1" }, { follow: "synergist_of" }, { follow: ATTACHMENTS, from: "previous" }], order: "id" },
  ant: { steps: [{ follow: "antagonist_of", exclude: "synergist_of" }], order: "id", parts: "instead" },
} as const satisfies KindTiers;

export const muscles = defineLayer({
  id: "muscles",
  system: "musculoskeletal",
  code: "m",
  label: "Muscles",
  ghostOrder: 3,
  // M10 session AL (M7: #a8483f): the old swatch was under 3:1 on the legend.
  colour: { material: "#b44d43", debug: "#a8524c" },
  models: {
    file: "muscles",
    eager: false,
    chunking: "single",
    debugManifest: () => import("../../../../assets/build/manifest-muscles.json"),
    budgets: { high: { maxMiB: 10, targetTris: 800_000 }, low: { maxMiB: 4, targetTris: 230_000 } },
  },
  contentChunk: "virtual:skeleton-soft-content-muscles",
  defaultSetting: "off",
  // Three stops, each one layer deeper (session V; the spec's fourth, "Deep only", was the same as the third).
  // `3` was "Deep only" while the control had four stops (session V's first build): the same as 2.
  depth: { stops: ["All", "Hide superficial", "Hide superficial + intermediate"], legacy: { 3: 2 } },
  overlays: [
    {
      id: "attachments",
      debugCode: "a",
      file: "attachments",
      // Patches in amber so they read against bone.
      colour: { debug: "#e0a33a" },
      when: "selected-tier",
      debugManifest: () => import("../../../../assets/build/manifest-attachments.json"),
      budgets: { high: { maxMiB: 3, targetTris: 150_000 }, low: { maxMiB: 1, targetTris: 50_000 } },
    },
  ],
  kinds: [
    {
      id: "muscle",
      noun: { one: "muscle", many: "muscles" },
      labelPriority: 0,
      // The most parts any muscle has (checked against content/soft-ids.json in tests/nestedSelection.test.ts).
      // A part's `alsoServes` is a `part_of` edge with meta `also`: not one of the muscle's parts.
      parentOf: { childKind: "muscle_part", selection: "nested", maxParts: 3, via: { type: "part_of", except: "also" } },
      tiers: MUSCLE_TIERS,
    },
    {
      id: "muscle_part",
      noun: { one: "part", many: "parts" },
      labelPriority: 1,
      tiers: MUSCLE_TIERS,
      // Tendons and aponeuroses get the lighter muscle colour (spec §6.3).
      partTypes: [{ id: "head" }, { id: "belly" }, { id: "portion" }, { id: "tendon", tendinous: true }, { id: "aponeurosis", tendinous: true }],
    },
  ],
});
