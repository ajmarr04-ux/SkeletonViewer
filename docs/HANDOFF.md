# Handoff — written 2026-11-25 at the end of M12 BH

## Next session
BI (design): the fixture layer gains edges, tier rules, a panel and a tree (plan step 10, decision 14).
Done when: fixture Vitest and e2e prove graph, tiers, panel and tree; the allowlist has no M12 entry (already true after BH: only M14 and M15 entries remain).

## State
- Last commit: M12 BH: validation rules per kind onto the content halves (see `git log`).
- `npm run check`: pass (652 tests, the five goldens unchanged). E2E `fixture`: 2 pass.
- Open fan-out work: none

## Waiting on the user
none

## Things the next session must know
- Validation hooks: `KindContent.validate(fm, ctx: EntryCheck)` and `LayerContent.validate(ctx: LayerCheck)` / `listedKeys` (`src/systems/contentTypes.ts`); `softValidate.ts` dispatches through `entryCheckOf(kind)` and runs every lazy layer's `validate`. The fixture's widgets can declare a `validate` too.
- The bones' schemas and validator are `src/systems/musculoskeletal/bones/{schema,validate}.ts`; `src/content/schema.ts`/`validate.ts` keep only the shared parts (word count, synonyms, depth, `zodLines`).
- Registry `SYNONYM_SETS` (prefix, member kind, noun): safe when no layer's tree has `sets` (the fixture build).
- The muscles chunk's `derived` lists are still shipped (`attachedTo` in `groups.ts`, `migrate-attachments.ts`, `softContent.test.ts` read them); `patch-check.ts` now reads the graph (`synergyLists`).
- Goldens: never `--write --force` without the user's approval. QUESTIONS: next is 140.
