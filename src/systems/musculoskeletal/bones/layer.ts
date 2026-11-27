// The bones layer: bones and teeth (`content/ids.json`), loaded with the main chunk.
import type { KindTiers } from "../../../graph/types";
import { defineLayer } from "../../types";
import { BONE_PANEL, TOOTH_PANEL } from "./panel";
import { STRUCTURE_SEARCH, TOOTH_SEARCH } from "../search";

/** The soft structures that name a bone: cartilage on it, ligaments connecting it, muscles attached (layer order, then ID). */
const NAMED_BY = ["has attached", "connected by", "origin of", "insertion of"];
const PARTNERS = { follow: ["articulates_with", "adjacent_tooth"], order: "anatomical" } as const;

/**
 * Tiers (M12 plan decision 6; spec §6). Tier 1: the articulation partners and
 * neighbouring teeth, then the soft structures naming the bone. Tier 2: the
 * partners, the region set as written, then the soft structures naming each of
 * those bones in turn. With only the bones layer on, the bones alone.
 */
const BONE_TIERS = {
  t1: {
    steps: [PARTNERS, { follow: NAMED_BY, order: "anatomical" }],
    wording: { label: "related bones", button: { text: "Show related", title: "Show the bones it articulates with", shown: "Related bones are shown" } },
  },
  t2: {
    steps: [PARTNERS, { follow: "region_neighbour", order: "written" }, { follow: NAMED_BY, from: "result", order: "anatomical" }],
    wording: { label: "region", button: { text: "Expand region", title: "Show the surrounding region", shown: "The region is shown" } },
  },
} as const satisfies KindTiers;

export const bones = defineLayer({
  id: "bones",
  system: "musculoskeletal",
  code: "b",
  label: "Bones",
  ghostOrder: 0,
  colour: { material: "#d8cdb8", keyLabel: "Bone" },
  models: {
    file: "skeleton",
    eager: true,
    chunking: "single",
    budgets: { high: { maxMiB: 15, targetTris: 500_000 }, low: { maxMiB: 6, targetTris: 150_000 } },
  },
  defaultSetting: "on",
  // The sidebar: content/hierarchy.json, then one group per tooth type across all four quadrants (Milestone 5 plan decision 5).
  tree: {
    builder: "hierarchy",
    qualifiers: ["left", "right", "upper", "lower"],
    skipInNames: ["axial", "appendicular"],
    typeGroups: {
      parent: "dentition",
      kind: "tooth",
      groups: [
        { key: "dentition.type.incisors", label: "All incisors", name: "Incisors, upper and lower", segment: "incisors" },
        { key: "dentition.type.canines", label: "All canines", name: "Canines, upper and lower", segment: "canines" },
        { key: "dentition.type.premolars", label: "All premolars", name: "Premolars, upper and lower", segment: "premolars" },
        { key: "dentition.type.molars", label: "All molars", name: "Molars, upper and lower", segment: "molars" },
      ],
    },
  },
  // Below every other layer for the labels' focus; teeth are counted as bones.
  kinds: [
    { id: "bone", label: "Bone", noun: { one: "bone", many: "bones" }, labelPriority: 6, searchFields: STRUCTURE_SEARCH, tiers: BONE_TIERS, ...BONE_PANEL },
    { id: "tooth", label: "Tooth", sideInName: false, noun: { one: "bone", many: "bones" }, labelPriority: 6, searchFields: TOOTH_SEARCH, tiers: BONE_TIERS, ...TOOTH_PANEL },
  ],
});
