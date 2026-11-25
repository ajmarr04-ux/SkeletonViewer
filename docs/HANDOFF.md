# Handoff — written 2026-11-25 at the end of M12 BE

## Next session
BF (routine): tree builders from `TreeSpec` for all four layers, bones included (plan step 7, decision 10).
Done when: `TreeSpec` per layer, `src/tree/` builders, `soft-tree-data.ts` reduced to running them; `SOFT_ROOTS`, `CARTILAGE_KINDS`, `looksLikeSoftGroup`'s literal pattern, `groupLayer`'s and the tooth-type groups' literals gone; tree golden unchanged; e2e `sidebar`, `soft-sidebar`, `keyboard` (tree part) pass; `npm run check` green.

## State
- Last commit: M12 BE: InfoPanel renders the generic panel model section by section (see `git log`).
- `npm run check`: pass (652 tests, the five goldens unchanged). E2E panel/soft-content/attached/nested/a11y/tiers/related/joints: 48 pass; all-objects/layers/tints: 28 pass.
- Open fan-out work: none

## Waiting on the user
none

## Things the next session must know
- The panel is now `usePanelModel` (`src/ui/usePanelModel.ts`) → `panelModel` → `InfoPanel.tsx`'s `Sections`; `Breadcrumb.tsx` reads the same model. `src/content/panel.ts` is gone; `placeholder.ts` keeps `oppositeOf` and the bone announcements, `softPanel.ts` only `softAnnouncement` (both for BG).
- `InfoPanel.tsx`'s `tierWords` (bone / muscle / other tier button wording) is a stopgap for BG, which moves it onto the tier rules.
- The muscles chunk's `derived` lists are still read by `attachedTo` (`groups.ts`), `patch-check.ts`, `migrate-attachments.ts` and `softContent.test.ts`; BF or BH can move them onto the graph.
- Goldens: never `--write --force` without the user's approval. QUESTIONS: next is 140.
