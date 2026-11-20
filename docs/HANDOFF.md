# Handoff — written 2026-11-20 at the end of M8-AC

## Next session
M8-AD: finish the `muscleAttachments` migration, remove the field, make validation strict, run the no-regression checks and ship `/m8/` (plan steps 9–11).
Done when: `validate-content` passes without `--allow-missing-soft`; no bone file has `muscleAttachments`; the full e2e suite passes (run it through the `verifier` agent); main chunk ≤ +5 kB gzipped over M7; `/m8/` is live and linked in `README.md`.

## State
- Last commit: d7bd73a M8-AC: ligament and cartilage content (batches H, I, J + integration), 9 functional joints per side, questions 120-131
- `npm run check`: pass (still with `--allow-missing-soft`; 0 soft-tissue files missing)
- Open fan-out work: none

## Waiting on the user
Nothing blocks AD from starting. Before `muscleAttachments` is removed, the user should answer QUESTIONS 70 (6 old strings naming muscles the source doesn't have); if unanswered, ask at the start of AD.

## Things the next session must know
- Two-way migration check: a string is accounted for when the muscle **or one of its parts** attaches to that bone, **or** a part it is listed in `alsoServes` of does (soleus → calcaneus through the calcaneal tendon, QUESTIONS 109). The `indirect` strings (costal cartilage, fascia, patellar ligament) are expected misses.
- `--allow-missing-soft` lives in the `validate-content` npm script itself (plan decision 10); remove it there.
- `content-writer`, `verifier` and `mesh-auditor` are in `.claude/agents/`; this session couldn't call them by type (created mid-session), a fresh session should.
- The M8 PR (#19) merged sessions X–AB; X–AC's later commits (workflow setup + AC) are on `claude/keen-clarke-32a10a`, not yet in a PR.
