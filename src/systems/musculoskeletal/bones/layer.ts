// The bones layer: bones and teeth (`content/ids.json`), loaded with the main chunk.
import type { KindTiers } from "../../../graph/types";
import { defineLayer } from "../../types";

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
  t1: { steps: [PARTNERS, { follow: NAMED_BY, order: "anatomical" }] },
  t2: { steps: [PARTNERS, { follow: "region_neighbour", order: "written" }, { follow: NAMED_BY, from: "result", order: "anatomical" }] },
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
  // Below every other layer for the labels' focus; teeth are counted as bones.
  kinds: [
    { id: "bone", noun: { one: "bone", many: "bones" }, labelPriority: 6, tiers: BONE_TIERS },
    { id: "tooth", noun: { one: "bone", many: "bones" }, labelPriority: 6, tiers: BONE_TIERS },
  ],
});
