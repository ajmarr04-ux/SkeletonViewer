# Handoff — written 2026-11-21 at the end of M9-AG

## Next session
**M9-AH: panels and the bone cross-link** (`docs/PLAN-milestone-9.md`, step 4; decisions 9–10). Trigger: "begin session AH".
Done when: every kind's panel sections (pure model in `softPanel.ts`, tested) rendered by `InfoPanel.tsx` with links; the bone panel's Origins/Insertions link lists replacing M8's plain text, with row hover highlighting; "Show attached muscles" as `grp=attached:<bone>` (store, URL, reducer, turns the muscles layer On, disabled "No muscles attach here"); e2e: panel sections, a link selecting a part, `grp=attached:femur_left` round trip, 200% reflow and axe on the new sections.

## State
- Last commit: M9-AG (origins, insertions, antagonists), on `claude/keen-clarke-32a10a`.
- `npm run check`: pass. Vitest 487 tests. E2E: E2E_RESULT. Main chunk MAIN_SIZE.
- Open fan-out work: none.

## Waiting on the user (none blocks AH)
- The patch report, `assets/build/REPORT-patches.md` (QUESTIONS 132–134): 185 patches never drawn because the content disagrees, 1,373 content attachments drawn as whole-bone tints, 846 synergist/antagonist overlaps shown as synergists, and the 4-outline cap for "both origin and insertion" bones. Any time before AJ.
- From AF: should a **bone's** related set gain its muscles, ligaments and cartilage when those layers are on (built that way)?
- Still open from earlier: the real-device muscles-layer load time (M7), the per-browser `?bench` table (M5 step 12), the content review of `content/QUESTIONS.md`.

## Things the next session must know
- Each muscle's roles (`softRoles(id)` in `softRelations.ts`: `o`/`i` = patches + whole-structure fallbacks, `ant`) come from the muscles content chunk; AH's Origin/Insertion sections can read the front matter directly (`useSoftContent`), but should agree with these.
- The derived `attached` map (`SoftDerived.attached`, structure → origins/insertions) already exists in the muscles chunk: use it for the bone panel's link lists and for `grp=attached:<bone>`.
- `setIsolation` now takes `ant`, and every isolation step writes `ant` off; a new group kind must keep that (pass nothing).
- Soft `sel=` links now keep their tier (`selectSoftFromUrl`).
- M9's QUESTIONS continue at **135**. The plan's ΔE ≥ 20 for the tints was relaxed to the spec's ≥ 8 except for neighbouring pairs (session notes).
