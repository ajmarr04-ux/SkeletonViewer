# Handoff — written 2026-11-25 at the end of M12 BG

## Next session
BH (routine): validation and compile rules per kind onto the content halves (plan step 9, decision 13).
Done when: `schema.ts`, `validate.ts`, `softValidate.ts`, `softCompile.ts`, `patch-check.ts` off the allowlist; the output of `validate-content`, `content:patch-check`, `content:migrate-attachments --check` and `npm run content` diffed before and after and unchanged; `npm run check` green.

## State
- Last commit: M12 BG: announcements, tier wording and display names from descriptors (see `git log`).
- `npm run check`: pass (652 tests, the five goldens unchanged). E2E announce/labels-layers/tiers: 12 pass; `fixture`: 2 pass.
- Open fan-out work: none

## Waiting on the user
none

## Things the next session must know
- Tier wording: `TierRule.wording` (`label`, `button`), registry `tierWording` (generic `t1`/`t2` fallback), `hasTier`, `tierCountKind`, `depthKind`; `kindOfId` in `src/content/index.ts`. `src/content/softPanel.ts` is gone.
- `isMuscleKind` (`selection.ts`, used by `Toolbar.tsx`, `Legend.tsx`, the `ant=1` URL check) is a layer comparison, no literal; BI could make it `hasTier(kind, "ant")` if the fixture needs it.
- `attachedTo` (`groups.ts`), `patch-check.ts`, `migrate-attachments.ts` and `softContent.test.ts` still read the muscles chunk's `derived` lists; BH can move them onto the graph.
- Allowlist M12 entries left (4): schema, softValidate, validate, patch-check.
- Goldens: never `--write --force` without the user's approval. QUESTIONS: next is 140.
