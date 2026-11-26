// The body regions' descriptor (SPEC-platform §6; M13 plan decision 5): the
// `located_in` edge type, the node kind of a region and the generated
// membership file. Listed in `registered.ts` next to the systems, so the
// fixture build swaps it with them. Data only (main chunk).

import { defineRegions } from "./types";

export const regions = defineRegions({
  edgeType: { id: "located_in", label: "located in", inverse: "contains", symmetric: false },
  node: "region",
  membershipFile: "assets/build/located-in.json",
  volumesFile: "assets/build/region-volumes.json",
});
