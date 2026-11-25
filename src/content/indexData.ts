// Hands `virtual:skeleton-index` (and the eager edges, `virtual:skeleton-graph`) to src/content/index.ts (M12 plan decision 7).
// Imported first by the app's entry (src/main.tsx) and by Vitest's setup file
// (tests/setup.ts), so every module sees the whole index from the start.
import data from "virtual:skeleton-index";
import edges from "virtual:skeleton-graph";
import { setEagerEdges, setIndex } from "./index";
import { decodeIndex } from "./indexCodec";

setIndex(decodeIndex(data));
// The eager layer's edges (M12 plan decision 3): registered with the runtime graph on its first use (src/content/appGraph.ts).
setEagerEdges(edges);
