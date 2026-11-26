// Hands `virtual:skeleton-index` (and the eager edges, `virtual:skeleton-graph`) to src/content/index.ts (M12 plan decision 7).
// Imported first by the app's entry (src/main.tsx) and by Vitest's setup file
// (tests/setup.ts), so every module sees the whole index from the start.
import ids from "../../content/ids.json";
import data, { regions } from "virtual:skeleton-index";
import edges from "virtual:skeleton-graph";
import { setEagerEdges, setIndex } from "./index";
import { decodeIndex } from "./indexCodec";
import { decodeRegions } from "../regions/codec";
import { setRegionIndex } from "../regions/index";

const index = decodeIndex(data);
setIndex(index);
// The body regions (M13 plan decision 5): every structure's `located_in`, in index order (the eager ID file's, then the lazy entries').
setRegionIndex(decodeRegions(regions, [...(ids as { id: string }[]).map((e) => e.id), ...index.entries.map((e) => e.id)]));
// The eager layer's edges (M12 plan decision 3): registered with the runtime graph on its first use (src/content/appGraph.ts).
setEagerEdges(edges);
