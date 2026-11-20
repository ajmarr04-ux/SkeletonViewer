// The `muscleAttachments` migration table (musculoskeletal spec §4.6; M8 plan
// decision 13, session X): every old string on every left or midline bone file
// → the muscle or part IDs it means, written to content/attachment-migration.json.
//   npx tsx scripts/content/migrate-attachments.ts [--check]
// --check fails if the file is out of date or any match names an unknown ID.
// Session AD adds the two-way check against the derived attachments and then
// removes the field.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { splitFrontMatter } from "../../src/content/frontmatter";
import { readContentFiles, readIds, readSoftIds, root } from "../lib/content-files";
import { matchAttachment, nameIndex, type Match } from "./attachment-match";

const out = join(root, "content/attachment-migration.json");
const soft = readSoftIds();
const names = nameIndex(soft);
const known = new Set(soft.map((e) => e.id.replace(/_(left|right)$/, "")));
const files = readContentFiles();

type Row = Omit<Match, "ids"> & { bones: Record<string, string[]> };
const table: Record<string, Row> = {};
const errors: string[] = [];
for (const e of readIds()) {
  if (e.side === "right") continue; // mirrored from the left
  const text = files.get(e.id);
  if (!text) continue;
  const fm = splitFrontMatter(text).data as { muscleAttachments?: string[] };
  for (const s of fm.muscleAttachments ?? []) {
    const m = matchAttachment(s, e.id, names);
    for (const id of m.ids) if (!known.has(id)) errors.push(`"${s}" on ${e.id}: ${id} is not a muscle or part in soft-ids.json`);
    const row = (table[s] ??= { rule: m.rule, ...(m.indirect ? { indirect: true } : {}), ...(m.note ? { note: m.note } : {}), ...(m.question ? { question: m.question } : {}), bones: {} });
    if (m.rule !== row.rule) row.rule = "variant"; // hand/foot splits: still a variant
    row.bones[e.id] = m.ids;
  }
}
const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
const json = JSON.stringify(sorted, null, 2) + "\n";
const counts = { name: 0, variant: 0, unmatched: 0 };
for (const r of Object.values(sorted)) counts[r.rule]++;
const summary = `${Object.keys(sorted).length} strings: ${counts.name} by name, ${counts.variant} by variant, ${counts.unmatched} unmatched`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(out, "utf8");
  } catch {
    /* missing */
  }
  if (current !== json) errors.push("content/attachment-migration.json is out of date (run npm run content:migrate-attachments)");
  if (errors.length) {
    console.error(`migrate-attachments FAILED:\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`migrate-attachments: OK (${summary})`);
} else {
  if (errors.length) {
    console.error(`migrate-attachments FAILED:\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  writeFileSync(out, json);
  console.log(`migrate-attachments: wrote content/attachment-migration.json (${summary})`);
  for (const [s, r] of Object.entries(sorted)) if (r.rule === "unmatched") console.log(`  unmatched: "${s}" on ${Object.keys(r.bones).join(", ")} (${r.note ?? ""})`);
}
