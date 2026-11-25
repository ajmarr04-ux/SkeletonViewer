// `npm run content:patch-check` (M9 plan decision 6): every disagreement
// between the attachment patches (M6, soft-to-id.json `attachments`) and the
// muscle content, written to assets/build/REPORT-patches.md. Informational:
// it never fails. The content decides what is drawn; a disagreement only
// means a patch that is never drawn, or a structure tinted whole.
//
// `--check`: exit 1 if the committed report is out of date.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileAllSoftFromDisk, compileGraphFromDisk, readPatches, root } from "../lib/content-files";
import { createGraph } from "../../src/graph/graph";
import { EDGE_TYPES, rolesSpecOf } from "../../src/systems/registry";
import { bothSynergistAndAntagonist, muscleRoles, synergyLists, patchAgreement, patchIndex, type Disagreement } from "../../src/systems/musculoskeletal/muscles/roles";
import type { MuscleFm, MusclePartFm, SoftFm } from "../../src/content/softSchema";
import { MAX_BOTH_OUTLINES } from "../../src/scene/tints";

const out = join(root, "assets/build/REPORT-patches.md");

export function patchReport(): string {
  const layers = compileAllSoftFromDisk();
  const fm: Record<string, SoftFm> = {};
  for (const c of Object.values(layers)) for (const [id, e] of Object.entries(c.entries)) fm[id] = e.fm;
  const patches = readPatches();
  // The same model the app's tints run on (M12 plan decision 8): the graph and the patch list.
  const graph = createGraph(EDGE_TYPES);
  graph.add("all", compileGraphFromDisk(layers).edges);
  const index = patchIndex(patches);
  const muscles = Object.keys(fm)
    .sort()
    .filter((id) => rolesSpecOf(fm[id]!.kind) !== undefined);
  const all = patchAgreement(graph, muscles, index);
  // Left and midline, plus any right-side row that isn't the mirror of a left one (the content
  // mirrors, but the source's patches don't always come in pairs).
  const isRight = (id: string) => id.endsWith("_right") || id.includes("_right__");
  const keep = (id: string) => !isRight(id);
  const noContent = all.filter((d): d is Extract<Disagreement, { kind: "patch-without-content" }> => d.kind === "patch-without-content");
  const noPatch = all.filter((d): d is Extract<Disagreement, { kind: "content-without-patch" }> => d.kind === "content-without-patch");
  const roles = Object.fromEntries(muscles.map((id) => [id, muscleRoles(graph, id, index)]));
  const drawnPatches = new Set(Object.values(roles).flatMap((r) => [...r.o.p, ...r.i.p].map(([p]) => p)));
  // Synergists and antagonists off the same graph (M12 plan decision 13).
  const both = bothSynergistAndAntagonist(synergyLists(graph, muscles));
  const overlap = both.filter(([a]) => keep(a));
  const bothFallback = Object.entries(roles)
    .map(([id, r]) => [id, r.o.f.filter((x) => r.i.f.includes(x))] as const)
    .filter(([id, xs]) => xs.length > 0 && keep(id));

  const toLeft = (row: string) => row.replace(/_right(?=\b|_|`)/g, "_left");
  /** Rows of a table: the left and midline ones, then right ones with no left mirror. */
  const rowsOf = <T,>(items: T[], idOf: (x: T) => string, row: (x: T) => string): string[] => {
    const left = items.filter((x) => !isRight(idOf(x))).map(row);
    const have = new Set(left);
    const right = items.filter((x) => isRight(idOf(x))).map(row).filter((r) => !have.has(toLeft(r)));
    return [...left, ...right];
  };
  const lines: string[] = [];
  lines.push("# Attachment patches against the content (M9 plan decision 6)");
  lines.push("");
  lines.push("Written by `npm run content:patch-check`; do not edit by hand. Informational: the content decides what is drawn.");
  lines.push("A patch is drawn as an origin (or insertion) of the selected muscle or part only if it serves that structure (or the muscle's parts, or the part's muscle) **and** the content names the bone it lies on in that role. A structure the content names with no agreeing patch is tinted whole (fallback).");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`| | All | Left and midline |`);
  lines.push(`| --- | --- | --- |`);
  lines.push(`| Patches | ${Object.keys(patches).length} | ${Object.keys(patches).filter(keep).length} |`);
  lines.push(`| Patches drawn for at least one muscle or part | ${drawnPatches.size} | ${[...drawnPatches].filter(keep).length} |`);
  lines.push(`| Patches with no matching content attachment (never drawn) | ${noContent.length} | ${noContent.filter((d) => keep(d.patch)).length} |`);
  lines.push(`| Content attachments with no patch (whole-structure tint) | ${noPatch.length} | ${noPatch.filter((d) => keep(d.id)).length} |`);
  lines.push(`| Muscles and parts | ${muscles.length} | ${muscles.filter(keep).length} |`);
  lines.push(`| Muscles and parts with a structure both origin and insertion, no patch (origin tint + outline) | ${Object.values(roles).filter((r) => r.o.f.some((x) => r.i.f.includes(x))).length} | ${bothFallback.length} |`);
  lines.push(`| Structures both synergist and antagonist of a muscle or part (shown as synergists) | ${both.length} | ${overlap.length} |`);
  lines.push("");
  lines.push("The tables below list the left and midline, then any right-side row that isn't the mirror of a left one: the content mirrors, but the source's patches don't always come in pairs (22 exist on the right only, 1 on the left only, and serratus anterior's are numbered differently).");
  lines.push("");
  lines.push("## Patches with no matching content attachment");
  lines.push("");
  lines.push("Either the patch's name is wrong (M6 found some), or the content leaves out an attachment the source models. Never drawn.");
  lines.push("");
  lines.push("| Patch | Serves | End | Lies on | What the content says |");
  lines.push("| --- | --- | --- | --- | --- |");
  lines.push(
    ...rowsOf(noContent, (d) => d.patch, (d) => {
      const says = d.structures.length === 0 ? "serves no structure" : d.structures.map((s) => `${s}: ${describe(fm, s, d.end)}`).join("; ");
      return `| \`${d.patch}\` | ${d.structures.map((s) => `\`${s}\``).join(", ") || "none"} | ${d.end} | \`${d.on ?? "?"}\` | ${says} |`;
    }),
  );
  lines.push("");
  lines.push("## Content attachments with no patch");
  lines.push("");
  lines.push("Attachments the content declares itself (not inherited) that no patch of the structure (or its parts, or its muscle) covers. Drawn as a whole-structure tint.");
  lines.push("");
  lines.push("| Muscle or part | Role | Structure |");
  lines.push("| --- | --- | --- |");
  lines.push(...rowsOf(noPatch, (d) => d.id, (d) => `| \`${d.id}\` | ${d.role} | \`${d.structure}\` |`));
  lines.push("");
  lines.push("## Both origin and insertion, no patch");
  lines.push("");
  lines.push(`Drawn in the origin tint plus an insertion-coloured outline, at most ${MAX_BOTH_OUTLINES} at once (QUESTIONS 133).`);
  lines.push("");
  lines.push("| Muscle or part | Structures |");
  lines.push("| --- | --- |");
  for (const [id, xs] of bothFallback) lines.push(`| \`${id}\` | ${xs.map((x) => `\`${x}\``).join(", ")} |`);
  lines.push("");
  lines.push("## Both synergist and antagonist");
  lines.push("");
  lines.push("Derived from different actions (plan decision 7): shown as synergists, never in the antagonist tint (QUESTIONS 134).");
  lines.push("");
  lines.push("| Muscle or part | Also an antagonist |");
  lines.push("| --- | --- |");
  const byId = new Map<string, string[]>();
  for (const [a, b] of overlap) byId.set(a, [...(byId.get(a) ?? []), b]);
  for (const [a, bs] of byId) lines.push(`| \`${a}\` | ${bs.map((b) => `\`${b}\``).join(", ")} |`);
  lines.push("");
  return lines.join("\n");
}

function describe(fm: Record<string, SoftFm>, id: string, role: "origin" | "insertion"): string {
  const f = fm[id];
  if (!f) return "no content file";
  if (rolesSpecOf(f.kind) === undefined) return `not a muscle (${f.kind})`;
  // A kind with roles has origins and insertions.
  const m = f as MuscleFm | MusclePartFm;
  const list = role === "origin" ? m.origin : m.insertion;
  if (list === "inherit") return `${role} inherited`;
  const named = list.map((a) => ("structure" in a ? a.structure : `soft: ${a.soft}`));
  return named.length ? named.join(", ") : `no ${role}`;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!);
if (isMain) {
  const text = patchReport();
  if (process.argv.includes("--check")) {
    const have = readFileSync(out, "utf8");
    if (have !== text) {
      console.error("assets/build/REPORT-patches.md is out of date: run npm run content:patch-check");
      process.exit(1);
    }
    console.log("REPORT-patches.md is up to date.");
  } else {
    writeFileSync(out, text);
    console.log(`Wrote ${out.replace(root + "/", "")}`);
  }
}
