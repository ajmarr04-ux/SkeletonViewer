// M14 session BS: the search golden difference report (plan step 1, the gate).
// `npm run search:report` writes assets/build/REPORT-search-golden.md: for every
// golden query whose top 10 changes under the new ranking, the recorded list
// against the new one, each new row with its facts and the rule that placed it
// below the row above. Skipped in `vitest run` (it only writes a report).

import { readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { SEARCH_QUERIES } from "./golden/harness";

const RUN = process.env.SEARCH_REPORT === "1";
const OUT = "assets/build/REPORT-search-golden.md";

type Hit = import("../src/content/search").SearchHit;
type Ctx = import("../src/content/searchRank").RankContext;

const row = (h: Hit) => `${h.id} | ${h.label}${h.match ? ` | ${h.match}` : ""}${h.group ? " | group" : ""}${h.drawn != null ? ` | drawn ${h.drawn}` : ""}`;
const idOf = (r: string) => r.slice(0, r.indexOf(" | "));
const BAND_NAME = ["name", "common/synonym", "partial"];
const facts = (h: Hit) => `band ${h.facts.band} (${BAND_NAME[h.facts.band]})${h.facts.group ? ", group" : ""}, exact ${h.facts.exact}, prefix ${h.facts.prefix}, ${h.facts.nameLength} words`;

/** The first rule of the comparator that orders b after a (mirrors `compareHits` with no region or visibility). */
function decidedBy(a: Hit, b: Hit, rank: (id: string) => number): string {
  if (a.facts.band !== b.facts.band) return "band";
  if (a.facts.band === 1 && a.facts.group !== b.facts.group) return "group first";
  if (a.facts.exact !== b.facts.exact) return "exact words";
  if (a.facts.prefix !== b.facts.prefix) return "prefix words";
  if (a.facts.nameLength !== b.facts.nameLength) return "shorter name";
  const ra = rank(a.id);
  const rb = rank(b.id);
  if (ra !== rb && (Number.isFinite(ra) || Number.isFinite(rb))) return "index order";
  return "ID";
}

const cell = (s: string) => s.replace(/\|/g, "·");

/** For the gate (plan step 1): where BS departs from the plan's decisions, and what is the user's to choose. */
const QUESTIONS = `## For the gate: departures from the plan, and choices

Approving the differences above rewrites \`tests/golden/search.json\` only (the other five goldens pass unchanged). BS departs from decisions 1–3 in these places; each is one line to change if you'd rather have the plan's version:

1. **Generic words: each layer's first kind's noun only** (\`bone\`, \`muscle\`, \`ligament\`, \`cartilage\`, one and many), not every kind's noun. With every noun, \`meniscus\` (a golden query) would return nothing, and so would \`disc\` and \`part\`. (A tooth's noun is "bone", so \`tooth\` stays a search word either way.) Layers can add more with \`searchStopWords\` (none today).
2. **The last tie-break is the ID files' order** (\`searchOrder\`), not \`indexRank\`: \`indexRank\` sorts the lazy layers' IDs as strings, which puts "rib 10" before "rib 1" and the lumbar discs before the thoracic ones.
3. **Name length counts words, not letters.** Letters put every "left" before "right", "medial" before "lateral" and "glenoid" before "acetabular", for no reason a user would see.
4. **Prefix words** come after exact words: a word that starts a document's word beats a fuzzy-only match.
5. **A band-1 group comes before the structures that carry its term** (decision 2 said groups compete "as structures do"). Without it \`quadriceps\` lists the set last, behind its four muscles that have "quadriceps" as a synonym; the M9 test expects the set first.
6. **A group's own name counts like one of its terms** for band 1 (\`erector spinae\`, \`rotator cuff\`).
7. A match label can change with the band rules: \`pelvis\` now shows the synonym it equals ("Pelvis") on the hip bones, not their common name ("Pelvic bone").

Choices:

- **A. The 10 differences above.** Approve as they are?
- **B. The visibility tie-break at the default layers.** The golden is ranked with no region and no visibility (decision 5: the harness passes the default, region-free context). Once BU passes the store's layers, the app at its default (bones On, the rest Off) puts visible structures first inside each band: of the 60 queries only \`trapezius\` changes (Trapezium, a bone, moves above the trapezius's parts in band 2). Recommended: keep it as the spec says (visible layers first); the alternative is to apply it only once the user has turned a layer on.
- **C. A query of only a generic word** (\`muscle\`, \`ligament\`) returns nothing, as decision 3 reads the spec. The alternative is to list that layer's structures.`;

describe.skipIf(!RUN)("search golden report", () => {
  it("writes the report", { timeout: 120_000 }, async () => {
    const { buildSearch } = await import("./golden/harness");
    await buildSearch(); // loads the content and both indexes
    const { loadSearch, loadSoftSearch } = await import("../src/content/searchLoader");
    const { mergeSearchers } = await import("../src/content/searchMerge");
    const { layerOfId } = await import("../src/content/index");
    const { DEFAULT_MODES } = await import("../src/systems/registry");
    const search = mergeSearchers(await loadSearch(), await loadSoftSearch());
    const { searchOrder } = await import("../src/content/searchMerge");
    const rank = searchOrder();
    const old = JSON.parse(readFileSync("tests/golden/search.json", "utf8")) as Record<string, string[]>;

    const changed: string[] = [];
    const same: string[] = [];
    const sections: string[] = [];
    const causes = new Map<string, number>();
    for (const q of SEARCH_QUERIES) {
      const hits = search(q, 30).slice(0, 10);
      const was = old[q] ?? [];
      const now = hits.map(row);
      if (JSON.stringify(was) === JSON.stringify(now)) {
        same.push(q);
        continue;
      }
      changed.push(q);
      const oldIds = was.map(idOf);
      const newIds = hits.map((h) => h.id);
      const lines = [`### "${q}"`, ""];
      if (hits.length === 0) lines.push(`Now returns nothing (was ${was.length} results).`, "");
      lines.push("| # | Recorded (M13) | New | Was | Facts | Placed after the row above by |", "| --- | --- | --- | --- | --- | --- |");
      for (let i = 0; i < Math.max(was.length, hits.length); i++) {
        const h = hits[i];
        const prev = oldIds.indexOf(h?.id ?? "");
        const by = h && i > 0 ? decidedBy(hits[i - 1]!, h, rank) : "";
        if (by) causes.set(by, (causes.get(by) ?? 0) + 1);
        lines.push(`| ${i + 1} | ${cell(was[i] ?? "")} | ${h ? cell(row(h)) : ""} | ${h ? (prev < 0 ? "new" : prev === i ? "=" : `#${prev + 1}`) : ""} | ${h ? facts(h) : ""} | ${by} |`);
      }
      const dropped = oldIds.filter((id) => !newIds.includes(id));
      if (dropped.length > 0) lines.push("", `Left the top 10: ${dropped.map((d) => `\`${d}\``).join(", ")}.`);
      sections.push(lines.join("\n"));
    }

    // Decision 1.2's visibility tie-break with the app's default layers (bones On, the rest Off): what it would change on top.
    const visible: Ctx = { visible: (id) => DEFAULT_MODES[(layerOfId(id) ?? id.slice(0, id.indexOf("."))) as keyof typeof DEFAULT_MODES] !== "off" };
    const withVis: string[] = [];
    for (const q of SEARCH_QUERIES) {
      const a = search(q, 30).slice(0, 10).map((h) => h.id);
      const b = search(q, 30, visible).slice(0, 10).map((h) => h.id);
      if (JSON.stringify(a) !== JSON.stringify(b)) withVis.push(q);
    }

    const md = [
      "# Search golden differences (M14 session BS)",
      "",
      "Generated by `npm run search:report` (`tests/searchGoldenReport.test.ts`). The recorded lists are `tests/golden/search.json` (M13); the new ones are the sidebar's merge with the new ranking (`rankHits`, `src/content/searchRank.ts`), asked for 30 and cut to 10, with **no region and no visibility tie-break** (the golden harness's context).",
      "",
      "## The ranking",
      "",
      "minisearch still finds the candidates (same fields, prefix, fuzzy, AND); only the order changes, and it no longer reads the BM25 score. In order:",
      "",
      "1. **Band.** 0: the query's words (side, stop and generic words removed) are the name's words, or the FDI number. 1: one common name or synonym holds every query word (a group: one of its terms, or its name, is exactly the query). 2: anything else.",
      "2. In the current body region first; then on a visible layer first (both off here).",
      "3. In band 1, a group before the structures that carry its term as a synonym.",
      "4. More query words matched exactly; then more matched as a prefix (so a fuzzy-only match comes last).",
      "5. Fewer words in the name.",
      "6. The ID files' order (`searchOrder`: the layers in registry order, each as its ID file lists it, which is anatomical), then the ID. Not `indexRank`, whose lazy layers are sorted by ID (\"rib 10\" before \"rib 1\").",
      "",
      "**Generic words** (decision 3): `left`, `right`, and each layer's first kind's noun, one and many: `bone(s)`, `muscle(s)`, `ligament(s)`, `cartilage(s)`. Alone they return nothing; next to another word they keep only that layer's results (`hip bone` searches `hip` among the bones).",
      "",
      `## Summary`,
      "",
      `- ${changed.length} of ${SEARCH_QUERIES.length} queries change; ${same.length} are unchanged: ${same.map((q) => `"${q}"`).join(", ")}.`,
      `- What separates neighbouring rows in the changed lists: ${[...causes].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(", ")}.`,
      `- With the visibility tie-break at the app's default layers (bones On, others Off), ${withVis.length} more or different lists: ${withVis.map((q) => `"${q}"`).join(", ") || "none"}. Not in the golden (see the questions at the end).`,
      "",
      "## Changed queries",
      "",
      sections.join("\n\n"),
      "",
      QUESTIONS,
      "",
    ].join("\n");
    writeFileSync(OUT, md);
  });
});
