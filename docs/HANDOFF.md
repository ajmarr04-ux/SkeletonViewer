# Handoff — written 2026-11-21 at the end of M9-AH

## Next session
**M9-AI: sidebar and search** (`docs/PLAN-milestone-9.md`, step 5; decisions 11–12). Trigger: "begin session AI".
Done when: Muscles / Ligaments / Cartilage tree roots (lazy tree chunk), soft groups in `grp=` (isolating one turns its layer On), the soft search index with synonyms and group synonyms ("ACL", "rotator cuff" …); `content-writer` fan-out for synonyms only if the list runs to ~60+ structures; e2e: expand Muscles → Upper limb → triceps → long head, "ACL" selects, "rotator cuff" isolates, keyboard pass; chunk sizes recorded.

## State
- Last commit: M9-AH (panels, bone Origins/Insertions links, "Show attached muscles") plus its notes, on `claude/keen-clarke-32a10a`.
- `npm run check`: pass. Vitest 508 tests. E2E: `attached.spec.ts` (new, 7/7) plus 15 touched specs, 116/116 in one run (15.3 min).
- Main chunk 298.98 kB gzipped (Vite's figure; AG 296.51). Bone content chunk 31.6 → 41.6 kB gzipped.
- Open fan-out work: none.

## Waiting on the user (none blocks AI)
- The patch report, `assets/build/REPORT-patches.md` (QUESTIONS 132–134), any time before AJ.
- From AF: should a **bone's** related set gain its muscles, ligaments and cartilage when those layers are on (built that way)?
- Still open from earlier: the real-device muscles-layer load time (M7), the per-browser `?bench` table (M5 step 12), the content review of `content/QUESTIONS.md`.

## Things the next session must know
- `groupOf`/`isGroupKey` (`src/content/groups.ts`) now also build dynamic groups (`attached:<bone>`, from `attachedTo` in `softRelations.ts`); soft groups for the tree can follow the same pattern (a `Group` with members, drawn by `groupView`, which expands a muscle into its parts). `showMusclesFor` in `selection.ts` turns a layer On for a group link; generalise it for soft groups.
- `grp=` keeps `:` unescaped in the URL.
- Links to soft structures go through `selectLink` (loads the soft table first); tree rows and search results for soft IDs need the same.
- `content/synonyms.json` is checked by `validate-content`; it accepts bone IDs only today.
- M9's QUESTIONS continue at **135**.
