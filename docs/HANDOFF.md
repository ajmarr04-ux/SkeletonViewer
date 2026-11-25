# Handoff — written 2026-11-25 at the end of M12 BD

## Next session
BE (routine): `InfoPanel.tsx` renders the sections in descriptor order (plan step 6).
Done when: one `Sections` component maps `render` → `TextSection`, `ListSection`, `LinksSection`, `GroupedLinksSection`, `ActionsTable` and the `custom` map (`attachments` only); `Body`, `SoftBody`, `MuscleSectionsView`, `JoinSectionsView` deleted; the BD adapters deleted; test IDs kept; e2e `panel`, `soft-content`, `attached`, `nested`, `a11y`, `all-objects` pass unchanged; `npm run check` green.

## State
- Last commit: M12 BD: panel sections as data, one generic panel model (see `git log`).
- `npm run check`: pass (652 tests, the five goldens unchanged). E2E panel/attached/soft-content/nested/tiers/related/joints/tints/a11y: 53 pass.
- Open fan-out work: none

## Waiting on the user
none

## Things the next session must know
- The model is `src/panel/model.ts` (`panelModel(id, { content(layer), opposite })`, `SectionModel` by `render`); sections and chrome live on the kinds (`bones/panel.ts`, `muscles/panel.ts`, `jointPanel.ts`). Each section carries `testId` and `empty`; `written` false → "Not written yet". Chrome: `commonShown`, `note`, `partOf`, `parentCrumb` (undefined = the kind doesn't show it). Use `oppositeAcross(oppositeOf, softOpposite)` for `opposite`.
- Adapters to delete in BE: `panel.ts` (whole), `placeholder.ts`'s `panelModel`/`SECTION_TITLES` (keep `oppositeOf`, announcements for BG), `softPanel.ts`'s `softPanelModel`/`softSections` and types (keep `softAnnouncement` for BG). `Breadcrumb.tsx` reads `trail`/`parentCrumb` from them too. Tests `panel.test.ts`, `softPanel.test.ts`, `placeholder.test.ts`, `nestedSelection.test.ts`, `sceneView.test.ts` import them: rewrite against the model, listing why.
- The bones' content chunk now exports `edges` (attachment edges into bones), registered by `loader.ts`; `CompiledEntry.attached` is gone. The muscles chunk's `derived` is no longer read by the panel (still by `attachedTo`, patch-check, migrate-attachments).
- `Graph.add`: a chunk holding a node's whole list sets its order (written order no longer depends on load order).
- Goldens: never `--write --force` without the user's approval. QUESTIONS: next is 140.
