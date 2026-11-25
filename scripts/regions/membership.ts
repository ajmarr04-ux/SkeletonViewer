// Body-region membership (M13 plan decision 4, step 2).
//   npm run regions                        volumes, then membership: writes
//                                          assets/build/located-in.json and REPORT-regions.md
//   npm run regions:membership -- --check  fails if located-in.json is stale (in `npm run check`)
// Reads assets/build/region-volumes.json, content/regions/overrides.json, every
// layer's high-LOD model (vertex shares) and build manifest (triangle totals),
// and, for the structures without a mesh, the relationship graph (tier 1).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createGraph } from "../../src/graph/graph";
import { tierEngine } from "../../src/graph/query";
import {
  applyOverrides,
  checkOverrides,
  inheritRegions,
  memberIndices,
  regionTester,
  round3,
  triangleTotals,
  vertexShares,
  type LocatedInFile,
  type Overrides,
  type StructureMembership,
} from "../../src/regions/membership";
import type { RegionVolumes } from "../../src/regions/volume";
import { EAGER_LAYER, EDGE_TYPES, indexRank, LAYER_IDS, REGIONS, layerLabel, tierContext, type LayerId } from "../../src/systems/registry";
import { compileGraphFromDisk, readIds, readSoftIds, root } from "../lib/content-files";
import { readNodePoints } from "../lib/glb-points";
import { fileStem } from "../lib/model-checks";
import { manifestPath, meshLayers } from "../lib/region-files";

const VOLUMES = REGIONS.volumesFile;
const OVERRIDES = "content/regions/overrides.json";
const OUT = REGIONS.membershipFile;
const REPORT = "assets/build/REPORT-regions.md";
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const volumesText = read(VOLUMES);
const overridesText = read(OVERRIDES);
const volumes = JSON.parse(volumesText) as RegionVolumes;
const overrides = JSON.parse(overridesText) as Overrides;
const regionOrder = volumes.regions.map((r) => r.key);
const coarseKeys = volumes.coarse.map((c) => c.key);
const coarse = volumes.coarse.map((c) => ({ key: c.key, regions: volumes.regions.filter((r) => r.coarse === c.key).map((r) => r.key) }));

type Row = { id: string; kind: string; meshAvailable: boolean; layer?: string; parts?: string[] };
const rows: Row[] = [...(readIds() as unknown as Row[]), ...(readSoftIds() as unknown as Row[])];
const layerOf = meshLayers();
/** Every structure → its layer (with or without a mesh), for the report. */
const anyLayer = new Map<string, LayerId>(rows.map((r) => [r.id, (r.layer ?? EAGER_LAYER) as LayerId]));
const allIds = rows.map((r) => r.id);
const errors = checkOverrides(overrides, (id) => allIds.includes(id), new Set(regionOrder));

// 1. Structures with a mesh: vertex shares in every layer's high-LOD file.
const test = regionTester(volumes.regions);
const out = new Map<string, StructureMembership>();
const t0 = performance.now();
let vertices = 0;
for (const layer of LAYER_IDS) {
  const pts = await readNodePoints(join(root, `public/models/${fileStem(layer)}-high.glb`));
  for (const [id, l] of layerOf) {
    if (l !== layer) continue;
    const p = pts.get(id);
    if (!p) {
      errors.push(`${id}: no node in ${fileStem(layer)}-high.glb`);
      continue;
    }
    vertices += p.length / 3;
    const { shares, home } = vertexShares(p, volumes.regions, coarseKeys, test);
    const touched = Object.fromEntries(shares.flatMap((s, k) => (round3(s) > 0 ? [[regionOrder[k]!, round3(s)]] : [])));
    out.set(id, { regions: memberIndices(shares, volumes.threshold).map((k) => regionOrder[k]!), shares: touched, home });
  }
}
const seconds = ((performance.now() - t0) / 1000).toFixed(1);
errors.push(...applyOverrides(out, overrides, regionOrder, (id) => layerOf.has(id)));

// 2. Structures without a mesh inherit (decision 4): parts first, then tier-1 neighbours.
const graph = createGraph(EDGE_TYPES);
graph.add("all", compileGraphFromDisk().edges);
const kinds = new Map(rows.map((r) => [r.id, r.kind]));
const engine = tierEngine(tierContext(graph, { kindOf: (id) => kinds.get(id), rank: indexRank(rows) }));
const noMesh = rows.filter((r) => !layerOf.has(r.id));
const regionsOf = (id: string) => out.get(id)?.regions;
for (const r of [...noMesh.filter((x) => x.parts?.length), ...noMesh.filter((x) => !x.parts?.length)])
  out.set(r.id, inheritRegions(r.parts ?? [], () => engine.evaluate(r.id, "t1") ?? [], regionsOf, regionOrder));
errors.push(...applyOverrides(out, overrides, regionOrder, (id) => !layerOf.has(id)));
for (const id of allIds) if (out.get(id)!.regions.length === 0) errors.push(`${id}: no region (${layerOf.has(id) ? "no vertex in any volume" : "nothing to inherit from"})`);
for (const k of regionOrder) if (![...out.values()].some((m) => m.regions.includes(k))) errors.push(`region ${k}: contains no structure`);

// 3. Triangle totals per layer, LOD and region, from the build manifests.
type Manifest = { objects: Record<string, { lods: Record<"high" | "low", { tris: number }> }> };
const triangles: LocatedInFile["triangles"] = {};
for (const layer of LAYER_IDS) {
  const m = JSON.parse(read(manifestPath(layer))) as Manifest;
  const ids = [...layerOf].filter(([, l]) => l === layer).map(([id]) => id);
  const tris = (lod: "high" | "low") => (id: string) => m.objects[id]?.lods[lod]?.tris ?? 0;
  triangles[layer] = triangleTotals(ids, (id) => out.get(id)!.regions, { high: tris("high"), low: tris("low") }, coarse);
}

if (errors.length) {
  console.error(`regions: ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

const file: LocatedInFile = {
  $comment: `Generated by scripts/regions/membership.ts from ${VOLUMES}, ${OVERRIDES} and the layers' high-LOD models (npm run regions). Do not edit.`,
  threshold: volumes.threshold,
  sourceHash: createHash("sha256").update(volumesText).update("\0").update(overridesText).digest("hex"),
  regions: regionOrder,
  coarse,
  structures: Object.fromEntries(allIds.map((id) => [id, out.get(id)!])),
  triangles,
};
// One structure per line: readable diffs.
const json =
  "{\n" +
  Object.entries(file)
    .map(([k, v]) =>
      k === "structures"
        ? `"structures": {\n${Object.entries(v as Record<string, unknown>).map(([id, m]) => `  ${JSON.stringify(id)}: ${JSON.stringify(m)}`).join(",\n")}\n}`
        : `${JSON.stringify(k)}: ${JSON.stringify(v)}`,
    )
    .join(",\n") +
  "\n}\n";

// ------------------------------------------------------------ the report
function report(): string {
  const name = new Map([...volumes.regions.map((r) => [r.key, r.name] as const), ...volumes.coarse.map((c) => [c.key, c.name] as const)]);
  const layerOfAny = (id: string): LayerId | undefined => anyLayer.get(id);
  const lines: string[] = [
    "# Body-region membership (M13 BL)",
    "",
    `Generated by \`npm run regions\` (scripts/regions/membership.ts). Threshold ${volumes.threshold * 100} %: a structure is \`located_in\` every fine region holding at least that share of its high-LOD vertices, else its single best. ${allIds.length} structures (${layerOf.size} with a mesh, ${vertices.toLocaleString("en")} vertices, ${seconds} s), ${regionOrder.length} fine regions.`,
    "",
    "## Members per region",
    "",
    `| Region | Coarse | ${LAYER_IDS.map(layerLabel).join(" | ")} | Triangles (high) |`,
    `| --- | --- | ${LAYER_IDS.map(() => "---:").join(" | ")} | ---: |`,
  ];
  for (const r of volumes.regions) {
    const counts = LAYER_IDS.map((l) => allIds.filter((id) => layerOfAny(id) === l && out.get(id)!.regions.includes(r.key)).length);
    const tris = LAYER_IDS.reduce((s, l) => s + triangles[l]!.high[r.key]!, 0);
    lines.push(`| ${r.name} (\`${r.key}\`) | ${name.get(r.coarse)} | ${counts.join(" | ")} | ${tris.toLocaleString("en")} |`);
  }
  lines.push("", "Coarse regions (each structure once):", "", `| Coarse | ${LAYER_IDS.map(layerLabel).join(" | ")} | Triangles high | Triangles low |`, `| --- | ${LAYER_IDS.map(() => "---:").join(" | ")} | ---: | ---: |`);
  for (const c of coarse) {
    const counts = LAYER_IDS.map((l) => allIds.filter((id) => layerOfAny(id) === l && out.get(id)!.regions.some((k) => c.regions.includes(k))).length);
    const hi = LAYER_IDS.reduce((s, l) => s + triangles[l]!.high[c.key]!, 0);
    const lo = LAYER_IDS.reduce((s, l) => s + triangles[l]!.low[c.key]!, 0);
    lines.push(`| ${name.get(c.key)} | ${counts.join(" | ")} | ${hi.toLocaleString("en")} | ${lo.toLocaleString("en")} |`);
  }
  const homes = new Map<string, number>();
  for (const id of layerOf.keys()) homes.set(out.get(id)!.home!, (homes.get(out.get(id)!.home!) ?? 0) + 1);
  lines.push("", `Home coarse region (decision 9, the chunk a structure would go in): ${coarse.map((c) => `${c.key} ${homes.get(c.key) ?? 0}`).join(", ")}.`);

  const many = allIds.filter((id) => layerOf.has(id) && out.get(id)!.regions.length >= 4);
  lines.push("", `## Structures in four or more regions (${many.length})`, "", "| Structure | Regions (share) |", "| --- | --- |");
  for (const id of many) {
    const m = out.get(id)!;
    lines.push(`| \`${id}\` | ${m.regions.map((k) => `${k} ${Math.round((m.shares?.[k] ?? 0) * 100)} %`).join(", ")} |`);
  }
  lines.push("", `## Overrides (${overrides.add.length} added, ${overrides.remove.length} removed)`, "");
  if (overrides.add.length + overrides.remove.length === 0) lines.push("None.");
  else {
    lines.push("| | Structure | Region | Share | Reason |", "| --- | --- | --- | ---: | --- |");
    for (const [what, list] of [["add", overrides.add], ["remove", overrides.remove]] as const)
      for (const x of list) lines.push(`| ${what} | \`${x.id}\` | ${x.region} | ${Math.round((out.get(x.id)!.shares?.[x.region] ?? 0) * 100)} % | ${x.reason} |`);
  }
  const inherited = allIds.filter((id) => out.get(id)!.inherited);
  lines.push("", `## Inherited (structures without a mesh: ${inherited.length})`, "", "| Structure | From | Regions |", "| --- | --- | --- |");
  for (const id of inherited) {
    const m = out.get(id)!;
    lines.push(`| \`${id}\` | ${m.inherited}: ${m.from!.join(", ")} | ${m.regions.join(", ")} |`);
  }
  return lines.join("\n") + "\n";
}

const summary = `${allIds.length} structures, ${[...out.values()].reduce((s, m) => s + m.regions.length, 0)} located_in edges, ${overrides.add.length + overrides.remove.length} overrides`;
if (process.argv.includes("--check")) {
  if (read(OUT) !== json) {
    const committed = JSON.parse(read(OUT)) as LocatedInFile;
    const why = committed.sourceHash !== file.sourceHash ? "region-volumes.json or overrides.json changed since it was generated" : "the memberships differ (a model, the IDs or the code changed)";
    console.error(`${OUT} is stale (${why}). Run: npm run regions`);
    process.exit(1);
  }
  console.log(`${OUT}: up to date (${summary})`);
} else {
  writeFileSync(join(root, OUT), json);
  writeFileSync(join(root, REPORT), report());
  console.log(`wrote ${OUT} and ${REPORT}: ${summary} (${seconds} s for ${vertices.toLocaleString("en")} vertices)`);
}
