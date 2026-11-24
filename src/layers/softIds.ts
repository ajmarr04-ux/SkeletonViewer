// The soft-tissue ID table as the viewer uses it (M7 plan decisions 12, 15).
// Pure: no three.js or React, so Vitest covers it directly.

import type { LazyLayerId } from "../systems/registry";
import { depthOf, type Depth } from "../content/muscleDepth";

export type SoftKind = "muscle" | "muscle_part" | "ligament" | "cartilage" | "disc" | "meniscus";
export type PartType = "head" | "belly" | "portion" | "tendon" | "aponeurosis";

/** One entry of content/soft-ids.json (M6), as generated. */
export type RawSoftId = {
  id: string;
  name: string;
  kind: SoftKind;
  layer: LazyLayerId;
  side: "left" | "right" | "midline";
  meshAvailable: boolean;
  parent?: string | null;
  parts?: string[];
  partType?: PartType;
  [other: string]: unknown;
};

/** The trimmed entry shipped to the browser. Optional fields are left out when empty. */
export type SoftId = {
  id: string;
  name: string;
  kind: SoftKind;
  layer: LazyLayerId;
  side: "left" | "right" | "midline";
  /** False for the 58 parent muscles and the structures the source lacks. */
  mesh: boolean;
  parent?: string;
  parts?: string[];
  partType?: PartType;
  /** Muscles and parts: their depth from content/muscle-depth.json, resolved (a part inherits its muscle's). */
  depth?: Depth;
};

export function trimSoftIds(raw: readonly RawSoftId[], depths: Readonly<Record<string, Depth>> = {}): SoftId[] {
  return raw.map((e) => {
    const out: SoftId = { id: e.id, name: e.name, kind: e.kind, layer: e.layer, side: e.side, mesh: e.meshAvailable };
    if (e.parent) out.parent = e.parent;
    if (e.parts && e.parts.length > 0) out.parts = [...e.parts];
    if (e.partType) out.partType = e.partType;
    const depth = depthOf(e, depths);
    if (depth !== undefined) out.depth = depth;
    return out;
  });
}

/** Tendons and aponeuroses get the lighter muscle colour (spec §6.3). */
export function isTendinous(e: SoftId | undefined): boolean {
  return e?.partType === "tendon" || e?.partType === "aponeurosis";
}

/** The IDs with a mesh in one layer's files, in table order. */
export function meshIdsOf(table: readonly SoftId[], layer: LazyLayerId): string[] {
  return table.filter((e) => e.layer === layer && e.mesh).map((e) => e.id);
}
