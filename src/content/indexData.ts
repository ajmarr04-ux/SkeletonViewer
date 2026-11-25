// Hands `virtual:skeleton-index` to src/content/index.ts (M12 plan decision 7).
// Imported first by the app's entry (src/main.tsx) and by Vitest's setup file
// (tests/setup.ts), so every module sees the whole index from the start.
import data from "virtual:skeleton-index";
import { setIndex } from "./index";
import { decodeIndex } from "./indexCodec";

setIndex(decodeIndex(data));
