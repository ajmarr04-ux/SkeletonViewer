# Handoff — written 2026-11-25 at the end of M12 BF

## Next session
BG (routine): announcements, tier wording, display names and label priority from descriptors (plan step 8, decision 12).
Done when: `announce.ts`, `names.ts` (and `softPanel.ts`'s `softAnnouncement`) off the allowlist; `InfoPanel.tsx`'s `tierWords` on the tier rules; `announce.test.ts` unchanged and passing; e2e `announce`, `labels-layers`, `tiers` pass; `npm run check` green.

## State
- Last commit: M12 BF: sidebar trees from each layer's TreeSpec (see `git log`).
- `npm run check`: pass (652 tests, the five goldens unchanged). E2E sidebar/soft-sidebar/keyboard/fixture: 19 pass.
- Open fan-out work: none

## Waiting on the user
none

## Things the next session must know
- Trees: `TreeSpec` on every layer (`src/systems/types.ts`), builders in `src/tree/`, registry `TREE_ROOTS` / `EAGER_TREE` / `looksLikeTreeGroup`. `src/content/softTree.ts` is gone; the shipped tree types are `src/tree/types.ts`.
- `InfoPanel.tsx`'s `tierWords` (bone / muscle / other tier button wording) is BE's stopgap for BG.
- `attachedTo` (`groups.ts`), `patch-check.ts`, `migrate-attachments.ts` and `softContent.test.ts` still read the muscles chunk's `derived` lists; BH can move them onto the graph.
- Allowlist M12 entries left (7): announce, names, schema, softPanel, softValidate, validate, patch-check.
- Goldens: never `--write --force` without the user's approval. QUESTIONS: next is 140.
