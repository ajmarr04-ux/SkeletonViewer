// The muscles layer: muscles and their parts (M6), the outermost layer.
import type { KindTiers } from "../../../graph/types";
import { defineLayer, type RolesSpec } from "../../types";
import { MUSCLE_SECTIONS, PART_SECTIONS, muscleChrome } from "./panel";
import { muscleRoles, patchIndex, type PatchIndex } from "./roles";
import { STRUCTURE_SEARCH } from "../search";

const LABEL = "Muscles";
/** Tendons and aponeuroses get the lighter muscle colour, the layer's `tendon` shade (spec §6.3). */
const PART_TYPES = [
  { id: "head", label: "Head" },
  { id: "belly", label: "Belly" },
  { id: "portion", label: "Portion" },
  { id: "tendon", label: "Tendon", shade: "tendon" },
  { id: "aponeurosis", label: "Aponeurosis", shade: "tendon" },
] as const;

const ATTACHMENTS = ["originates_on", "inserts_on"];

/**
 * Tiers (M12 plan decision 6; musculoskeletal spec §5.2), each sorted by ID.
 * Tier 1: the muscle as its parts, and every structure named in its (and its
 * parts') origin and insertion; a part's `inherit` is its own inherited edges.
 * Tier 2: + its synergists and their attachments. `ant`: the antagonists that
 * aren't synergists, a muscle replaced by its parts (the tints, spec §5.3).
 */
const MUSCLE_TIERS = {
  t1: {
    steps: [{ self: true }, { follow: ATTACHMENTS, from: "self+parts" }],
    order: "id",
    wording: { label: "attachments", button: { text: "Show attachments", title: "Show the structures it attaches to", shown: "Shown" } },
  },
  t2: {
    steps: [{ tier: "t1" }, { follow: "synergist_of" }, { follow: ATTACHMENTS, from: "previous" }],
    order: "id",
    wording: { label: "functional group", button: { text: "Show functional group", title: "Show the muscles that work with it", shown: "Shown" } },
  },
  ant: {
    steps: [{ follow: "antagonist_of", exclude: "synergist_of" }],
    order: "id",
    parts: "instead",
    // The toggle's title once on is what pressing it does then.
    wording: { label: "Antagonists", button: { text: "Show antagonists", title: "Show the muscles that oppose it, in their own colour", shown: "Hide the antagonists" } },
  },
} as const satisfies KindTiers;

/** Origin and insertion tints from the graph and the attachment patches (M12 plan decision 8). */
const ROLES: RolesSpec = { index: patchIndex, roles: (graph, id, index) => muscleRoles(graph, id, index as PatchIndex) };

export const muscles = defineLayer({
  id: "muscles",
  system: "musculoskeletal",
  code: "m",
  label: LABEL,
  ghostOrder: 3,
  // M10 session AL (M7: #a8483f): the old swatch was under 3:1 on the legend.
  // The tendon shade (M14 BW, from src/layers/colours.ts): M10 session AL (M7: #c98a7c) moved it off the thorax's region colour under protanopia.
  // Dimmed 35 % (M14 BW): at the plan's 40 % it came within ΔE 7.5 of a bone ghost under protanopia.
  colour: { material: "#b44d43", debug: "#a8524c", shades: { tendon: "#c18274" }, dim: 0.35 },
  models: {
    file: "muscles",
    eager: false,
    chunking: "single",
    debugManifest: () => import("../../../../assets/build/manifest-muscles.json"),
    budgets: { high: { maxMiB: 10, targetTris: 800_000 }, low: { maxMiB: 4, targetTris: 230_000 } },
  },
  contentChunk: "virtual:skeleton-soft-content-muscles",
  defaultSetting: "off",
  // Region → compartment → muscle → parts (content/muscle-hierarchy.json); the group synonyms' sets sit under this root (M9 plan decisions 11, 12).
  tree: {
    builder: "regionCompartment",
    root: { label: LABEL, name: "All muscles", order: 0 },
    file: "content/muscle-hierarchy.json",
    innerName: (label) => `Muscles of the ${label.toLowerCase()}`,
    sets: true,
  },
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
      label: "Muscle",
      noun: { one: "muscle", many: "muscles" },
      labelPriority: 0,
      searchFields: STRUCTURE_SEARCH,
      // The most parts any muscle has (checked against content/soft-ids.json in tests/nestedSelection.test.ts).
      // A part's `alsoServes` is a `part_of` edge with meta `also`: not one of the muscle's parts.
      parentOf: { childKind: "muscle_part", selection: "nested", maxParts: 3, via: { type: "part_of", except: "also" } },
      tiers: MUSCLE_TIERS,
      roles: ROLES,
      panel: MUSCLE_SECTIONS,
      chrome: muscleChrome("Muscle", LABEL),
    },
    {
      id: "muscle_part",
      label: "Muscle part",
      noun: { one: "part", many: "parts" },
      labelPriority: 1,
      searchFields: STRUCTURE_SEARCH,
      tiers: MUSCLE_TIERS,
      roles: ROLES,
      partTypes: PART_TYPES,
      panel: PART_SECTIONS,
      chrome: muscleChrome("Muscle part", LABEL, PART_TYPES),
    },
  ],
});
