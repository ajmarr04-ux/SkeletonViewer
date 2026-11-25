// The demo system's edge types (M12 plan decision 14): declared in its own
// folder, like the musculoskeletal system's (src/systems/musculoskeletal/edges.ts),
// and listed by the registry only because the system is. One symmetric type and
// one directed type with an inverse label, so tiers and panels can read both ways.
import type { EdgeTypeDescriptor } from "../../../../src/graph/types";

export const DEMO_EDGES = [
  { id: "meshes_with", label: "meshes with", inverse: null, symmetric: true },
  { id: "drives", label: "drives", inverse: "driven by", symmetric: false },
] as const satisfies readonly EdgeTypeDescriptor[];
