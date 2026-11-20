// The trimmed soft-tissue table (lazy). Importing this module registers it with
// the main chunk's registry (`src/content/softRegistry.ts`).
import softIds from "virtual:skeleton-soft-ids";
import { registerSoftIds } from "../content/softRegistry";
import type { SoftId } from "./softIds";

export const SOFT_IDS: readonly SoftId[] = softIds;
registerSoftIds(SOFT_IDS);
