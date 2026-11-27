// The system's search fields (M14 plan decision 4): every kind fills its name,
// common name, synonyms and Latin name; teeth add their FDI number.
import type { SearchField } from "../types";

export const STRUCTURE_SEARCH = ["name", "common", "synonyms", "latin"] as const satisfies readonly SearchField[];
export const TOOTH_SEARCH = [...STRUCTURE_SEARCH, "fdi"] as const satisfies readonly SearchField[];
