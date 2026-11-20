// The `muscleAttachments` migration table (musculoskeletal spec §4.6; M8 plan
// decision 13, session X): every old string on every left or midline bone file
// → the muscle or part IDs it means, written to content/attachment-migration.json.
//   npx tsx scripts/content/migrate-attachments.ts [--check]
// --check fails if any match names an unknown ID, or the two-way check against
// the derived attachments fails (scripts/content/attachment-check.ts). Session
// AD removed the field from the bone files, so the table is now frozen: it is
// the record of the migration, rebuilt only while a bone file still has the
// field (none should: validate-content rejects it).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { splitFrontMatter } from "../../src/content/frontmatter";
import { compileSoftFromDisk, readContentFiles, readIds, readSoftIds, root } from "../lib/content-files";
import { checkMigration, type MigrationRow, type SoftEntry } from "./attachment-check";
import { matchAttachment, nameIndex, type Match } from "./attachment-match";

const out = join(root, "content/attachment-migration.json");
const soft = readSoftIds();
const names = nameIndex(soft);
const known = new Set(soft.map((e) => e.id.replace(/_(left|right)$/, "")));
const files = readContentFiles();

type Row = Omit<Match, "ids"> & { bones: Record<string, string[]> };
const table: Record<string, Row> = {};
const errors: string[] = [];
let withField = 0;
for (const e of readIds()) {
  if (e.side === "right") continue; // mirrored from the left
  const text = files.get(e.id);
  if (!text) continue;
  const fm = splitFrontMatter(text).data as { muscleAttachments?: string[] };
  if (fm.muscleAttachments) withField++;
  for (const s of fm.muscleAttachments ?? []) {
    const m = matchAttachment(s, e.id, names);
    for (const id of m.ids) if (!known.has(id)) errors.push(`"${s}" on ${e.id}: ${id} is not a muscle or part in soft-ids.json`);
    const row = (table[s] ??= { rule: m.rule, ...(m.indirect ? { indirect: true } : {}), ...(m.series ? { series: true } : {}), ...(m.note ? { note: m.note } : {}), ...(m.question ? { question: m.question } : {}), bones: {} });
    if (m.rule !== row.rule) row.rule = "variant"; // hand/foot splits: still a variant
    row.bones[e.id] = m.ids;
  }
}
const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
const json = JSON.stringify(sorted, null, 2) + "\n";
let committed = "";
try {
  committed = readFileSync(out, "utf8");
} catch {
  /* missing */
}
/** The table to check: rebuilt while bone files still carry the field, else the committed (frozen) one. */
const frozen = withField === 0;
const rows = (frozen ? JSON.parse(committed || "{}") : sorted) as Record<string, MigrationRow>;
const counts = { name: 0, variant: 0, unmatched: 0 };
for (const r of Object.values(rows)) counts[r.rule]++;
const summary = `${Object.keys(rows).length} strings: ${counts.name} by name, ${counts.variant} by variant, ${counts.unmatched} unmatched`;
if (frozen) for (const r of Object.values(rows)) for (const [bone, ids] of Object.entries(r.bones)) for (const id of ids) if (!known.has(id)) errors.push(`${bone}: ${id} is not a muscle or part in soft-ids.json`);

// Two-way check (plan decision 13): each matched string's muscle really attaches to the bone.
const derived = compileSoftFromDisk("muscles").derived!;
const questions = readFileSync(join(root, "content/QUESTIONS.md"), "utf8");
const answered = (n: number) => new RegExp(`^${n}\\. .*answered by the user`, "mi").test(questions);
const two = checkMigration(rows, soft as SoftEntry[], (s) => derived.attached[s] ?? { origins: [], insertions: [] }, answered);
errors.push(...two.errors);
const twoWay = `two-way: ${two.confirmed} confirmed, ${two.accepted.indirect} indirect, ${two.accepted.unmatched} unmatched with an answered question`;

if (process.argv.includes("--check")) {
  if (!frozen && committed !== json) errors.push("content/attachment-migration.json is out of date (run npm run content:migrate-attachments)");
  if (errors.length) {
    console.error(`migrate-attachments FAILED:\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`migrate-attachments: OK (${summary}; ${twoWay}${frozen ? "; table frozen" : ""})`);
} else {
  if (frozen) {
    console.error("migrate-attachments: no bone file has muscleAttachments any more (removed in session AD); the table is frozen. Use --check.");
    process.exit(1);
  }
  if (errors.length) {
    console.error(`migrate-attachments FAILED:\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  writeFileSync(out, json);
  console.log(`migrate-attachments: wrote content/attachment-migration.json (${summary}; ${twoWay})`);
  for (const [s, r] of Object.entries(sorted)) if (r.rule === "unmatched") console.log(`  unmatched: "${s}" on ${Object.keys(r.bones).join(", ")} (${r.note ?? ""})`);
}
