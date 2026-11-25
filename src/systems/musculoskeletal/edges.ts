// The musculoskeletal system's edge types (SPEC-platform §4.2; M12 plan
// decisions 1, 2 and 4). Data only (main chunk). Compiled from the authoring
// files by each kind's extractor (`content.ts` in the layer folders) and the
// system's sources (`../content.ts`); the derived ones by the rules next to them.
//
// Two differences from the spec's table, both to keep today's behaviour
// (golden tiers and panels): `synergist_of` and `antagonist_of` are directed,
// because the M8 rule isn't symmetric (a part that matches only through its
// muscle's actions lists the other muscle, which lists the muscle instead; 508
// and 572 one-way pairs in the real content); and `adjacent_tooth` is directed
// and written both ways in the rule's order, which is the panel's "Neighbouring
// teeth" order (mesial neighbour first).

import type { EdgeTypeDescriptor } from "../../graph/types";

export const MUSCULOSKELETAL_EDGES = [
  { id: "articulates_with", label: "articulates with", inverse: null, symmetric: true },
  { id: "member_of_joint", label: "member of joint", inverse: "has structure", symmetric: false },
  { id: "part_of", label: "part of", inverse: "has part", symmetric: false },
  { id: "originates_on", label: "originates on", inverse: "origin of", symmetric: false },
  { id: "inserts_on", label: "inserts on", inverse: "insertion of", symmetric: false },
  { id: "connects", label: "connects", inverse: "connected by", symmetric: false },
  { id: "attached_to", label: "attached to", inverse: "has attached", symmetric: false },
  { id: "acts_on", label: "acts on", inverse: "acted on by", symmetric: false },
  { id: "region_neighbour", label: "region neighbour", inverse: null, symmetric: false },
  { id: "synergist_of", label: "synergist of", inverse: null, symmetric: false, derived: true },
  { id: "antagonist_of", label: "antagonist of", inverse: null, symmetric: false, derived: true },
  { id: "adjacent_tooth", label: "adjacent tooth", inverse: null, symmetric: false, derived: true },
  { id: "shares_joint_with", label: "shares a joint with", inverse: null, symmetric: true, derived: true },
] as const satisfies readonly EdgeTypeDescriptor[];
