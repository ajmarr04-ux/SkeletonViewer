// The fixture system (M11 plan decision 8): one layer, no presets, its own edge
// types (M12 plan decision 14). Never shipped.
import { defineSystem } from "../../../../src/systems/types";
import { DEMO_EDGES } from "./edges";

export const demo = defineSystem({ id: "demo", label: "Demo", edgeTypes: DEMO_EDGES, presets: [] });
