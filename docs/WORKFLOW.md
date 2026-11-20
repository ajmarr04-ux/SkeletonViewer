# How to work in this repo: sessions, handoffs and subagents

Read this at the start of every session, together with `CLAUDE.md` and `docs/HANDOFF.md`.

This file decides **how** work is done. The milestone specs (`SPEC (2).md`, `SPEC-musculoskeletal.md`) decide **what** is built. `docs/PLAN-milestone-<N>.md` breaks one milestone into sessions.

---

## 1. The model in one paragraph

You are the **main agent**. Each session does **one serial task**: a piece of work whose steps depend on each other and need judgement, for example designing a schema, wiring a reducer, or fixing a failing build. Inside a session, any part that splits into **many independent items of the same kind** goes to **Sonnet subagents** in parallel. Examples: writing 140 muscle content files, auditing meshes collection by collection, adding synonyms per region. You plan the split, hand out the batches, check what comes back, and integrate it. At the end of the session you write `docs/HANDOFF.md`, stop, and the user clears the context and starts the next session.

```
Milestone ─┬─ Session 1 (serial task) ── main agent only
           ├─ Session 2 (serial task) ── main agent ─┬─ subagent batch A ─┐
           │                                         ├─ subagent batch B ─┼─ main verifies + integrates
           │                                         └─ subagent batch C ─┘
           ├─ Session 3 …
           └─ Session N: milestone wrap-up (checks, snapshot, STATUS.md)
```

---

## 2. Planning a milestone into sessions

At the start of a milestone, before any code, write a **Sessions** table into `docs/PLAN-milestone-<N>.md`:

| Session | Serial task (one sentence) | Fan-out step (if any) | Inputs | Done when |
| --- | --- | --- | --- | --- |
| M8-S1 | Write the zod schemas, `movements.json` and the depth file format | none | SPEC-musculoskeletal §4 | `npm run check` passes with empty content folders |
| M8-S2 | Draft upper-limb muscle content | 6 batches by compartment → `content-writer` | S1 schemas, mapping | all upper-limb files validate |
| … | | | | |

**Rules for cutting sessions**

1. **One serial task per session.** If you have to write "and then" between two unrelated pieces of work, make them two sessions.
2. **Size by context, not by clock.** A session should finish with plenty of context to spare. A session that would read most of the codebase, or hold more than about 20 files in mind, is too big. Split it.
3. **Every session ends green.** `npm run check` must pass, or the session's task is explicitly "fix X" and the handoff says what still fails.
4. **Gates are their own sessions.** Anything the spec says to report back on (for example the M6 audit counts), or that needs a human check on a real device, ends a session. The next one starts only after the user replies.
5. **The last session of a milestone is the wrap-up:** the full checklist, the Playwright run, the `/m<N>/` snapshot (set `deploy/pages.json` `current` first) and the `STATUS.md` update.

The plan may change. When it does, edit the table and note why in the plan's session notes. Don't silently drift.

---

## 3. When to use subagents

Use a subagent **only** when one of these is true:

| Use | Example | Agent |
| --- | --- | --- |
| **Parallel batch**: many independent items of the same kind, each needing the same instructions | Content files per region; landmarks per bone; synonyms per region; audit of one Blender collection each | Sonnet, from `.claude/agents/` (§6) |
| **Context offload**: one long, noisy job whose output you only need summarised | The full Playwright run (~19 min, huge logs); a repo-wide search; reading a large report | Sonnet `verifier` or built-in `Explore` |

**Don't** use a subagent for:
- Anything that needs decisions across items: schema design, reducer and state changes, rendering architecture, shared config.
- Tasks with fewer than about 5 items. Doing them yourself is cheaper than briefing a subagent.
- Anything that edits a **shared file** (§5).
- Fixing your own integration bugs. You have the context; a subagent would have to rebuild it.

**Usage budget (Pro plan).** Subagents count against the same limits as the main session. So:
- Run at most **4 subagents at once**. Start the next wave when a wave finishes.
- Size each batch at **10 to 25 items**.
- Always ask for the short summary format (§4), never for file contents back.
- If a wave is rejected wholesale for the same reason, fix the brief and re-run **one** batch first before re-running the rest.

---

## 4. Running a fan-out step

### 4.1 Prepare (main agent)
1. Write the **item list** to a file: `docs/batches/<session>/items.json`. Each entry gets an ID, the files it may write, and any per-item inputs (such as source mesh names).
2. Split it into batches. **Each batch owns a disjoint set of output files.** No file appears in two batches.
3. Write one **brief** per fan-out step: `docs/batches/<session>/BRIEF.md`. It holds the exact spec sections to follow, one finished example file to copy the style from, and the rules from §5. Every batch gets the same brief. Only the item list differs.
4. Make sure everything a subagent needs is **on disk**: schemas committed, example files present, `npm run validate-content` working. Subagents don't see this conversation.

### 4.2 Dispatch
Call the subagent with a prompt shaped like this:

```
Use the content-writer subagent.
Brief: docs/batches/M8-S2/BRIEF.md
Your batch: docs/batches/M8-S2/items.json, entries 1–18 (batch B).
You may create or edit ONLY the files listed for those entries.
Write any doubts to docs/batches/M8-S2/questions-B.md.
Return the summary format from the brief, nothing else.
```

### 4.3 Summary format (every subagent returns exactly this)
```
BATCH: B
DONE: 16 — <ids>
SKIPPED: 2 — <id>: <one-line reason>
VALIDATION: pass | fail (<first 3 errors, one line each>)
QUESTIONS: <n> written to questions-B.md
NOTES: <at most 3 lines, only if something affects other batches>
```

### 4.4 Verify and integrate (main agent, always)
1. Run the checks yourself (`npm run validate-content`, `npm run check`). Don't rely on a subagent's "pass".
2. **Spot-check**: read at least 2 files per batch in full against the spec and the example. Pick ones from different sub-regions.
3. Re-dispatch **only** failed or skipped items, with a corrected brief if the failure was systematic.
4. Merge `questions-*.md` into `content/QUESTIONS.md` under the right heading, then delete the batch question files.
5. Commit once per fan-out step, with a message that names the batches.

---

## 5. Rules for subagents (copy these into every brief)

1. Edit **only** the files assigned to your batch. Never edit shared files: `package.json`, lock files, anything in `src/`, `scripts/`, the schemas, `content/ids.json`, `hierarchy.json`, `articulations.json`, `content/QUESTIONS.md`, `CLAUDE.md`, `docs/HANDOFF.md`, plans or specs.
2. **Never invent anatomy.** No made-up attachments, actions, innervation, landmark positions, TA2 IDs or depths. If unsure, leave it out and write the doubt to your batch's questions file.
3. Don't run `git commit`, `git push`, `npm install`, or anything that deploys.
4. Don't spawn subagents.
5. Run the validation command named in the brief before you finish, and report the result honestly.
6. Return only the summary format. No file contents, no long explanations.

---

## 6. Subagent definitions

The first session that uses this workflow creates these files. Edit them as the project needs; record the changes in the milestone plan.

### `.claude/agents/content-writer.md`
```markdown
---
name: content-writer
description: Drafts content files (bones, muscles, parts, ligaments, cartilage) for an assigned batch, following a BRIEF.md. Use for parallel content batches only.
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---
You draft anatomy content files for the Skeleton Viewer, one batch at a time.

Start by reading the BRIEF.md you are given, the spec sections it names, and its example file.
Then write only the files assigned to your batch.

Rules:
- Edit only your assigned files. Never touch shared files (see the brief).
- Never invent anatomy: attachments, actions, innervation, landmark positions, TA2 IDs and depths come from standard references. If unsure, leave it out and write the doubt to your batch's questions file.
- English name, Latin name, 40–80-word body (20–60 for parts), reviewed: false.
- No git commands, no installs, no subagents.
- Before finishing, run the validation command from the brief.
- Return ONLY the summary format from the brief.
```

### `.claude/agents/mesh-auditor.md`
```markdown
---
name: mesh-auditor
description: Audits one Blender collection or a slice of objects with the repo's bpy scripts and writes a per-batch report. Use for parallel audit or mapping batches.
tools: Read, Write, Glob, Grep, Bash
model: sonnet
---
You audit 3D source meshes for the Skeleton Viewer.

Read the BRIEF.md you are given. Run only the scripts it names, on only your assigned
collection or object list. Write your results only to the output file the brief assigns to you
(JSON plus a short Markdown report).

Rules:
- Never modify the source .blend file, the pipeline scripts or the shared mapping files.
- Classify each object as whole structure / anatomical part / modelling fragment / excluded, with a one-line reason. When unsure, say so; don't guess.
- No git commands, no installs, no subagents.
- Return ONLY the summary format from the brief.
```

### `.claude/agents/verifier.md`
```markdown
---
name: verifier
description: Runs long or noisy checks (the Playwright suite, full builds, perf scripts) and returns a short summary of failures. Use to keep long logs out of the main context.
tools: Read, Glob, Grep, Bash
model: sonnet
---
You run the command you are given and report back briefly.

Return:
RESULT: pass | fail
TOTALS: <passed>/<total>, duration
FAILURES: for each failure (max 10): test name, file:line, the first meaningful error line
LIKELY CAUSE: at most 3 lines, only if obvious from the logs

Never edit any file. Never retry more than once. No git commands.
```

---

## 7. Session start and end protocol

### Start of every session
1. Read `CLAUDE.md`, this file, `docs/HANDOFF.md`, and the current `docs/PLAN-milestone-<N>.md`. (A SessionStart hook loads `HANDOFF.md` automatically; see §8.)
2. Confirm in one or two lines which session you are on and what "done" means for it. Then start. Don't re-plan the milestone unless the handoff says the plan is wrong.
3. If the handoff says a gate is waiting on the user, ask for that first and do nothing else.

### End of every session
1. Run `npm run check`. Make sure it passes, or record exactly what fails and why that's expected.
2. Commit, with the session ID in the message (for example `M8-S2: upper-limb muscle content`).
3. Tick the session in the plan's Sessions table, and add short session notes: decisions, surprises, anything the plan got wrong.
4. **Overwrite** `docs/HANDOFF.md` using the template below.
5. Tell the user, in one short message: what was done, whether a gate needs them, and "Ready for `/clear`" followed by the next session's ID.
6. Stop. Don't start the next session's work in the same context.

### `docs/HANDOFF.md` template
```markdown
# Handoff — written <date> at the end of <session ID>

## Next session
<session ID>: <the serial task, one sentence>
Done when: <criteria from the plan>

## State
- Last commit: <hash> <message>
- `npm run check`: pass | fail (<what and why>)
- Open fan-out work: none | <session, batches still to run or re-run>

## Waiting on the user
none | <the question or hand-check, exactly as asked>

## Things the next session must know
- <at most 5 bullets: decisions, traps, files that matter>
```

Keep it under about 40 lines. It's a pointer, not a diary. Detail goes in the plan's session notes.

---

## 8. One-time setup (the first session that adopts this file)

1. Create the three files in `.claude/agents/` (§6).
2. Add a SessionStart hook to `.claude/settings.json` (merge with what's there) so the handoff loads on startup, after `/clear`, and on resume:
   ```json
   {
     "hooks": {
       "SessionStart": [
         {
           "matcher": "startup|clear|resume",
           "hooks": [{ "type": "command", "command": "cat \"$CLAUDE_PROJECT_DIR/docs/HANDOFF.md\" 2>/dev/null || true" }]
         }
       ]
     }
   }
   ```
3. Add `docs/batches/` to the repo (keep the briefs and item lists; they document how content was made).
4. Add this line near the top of `CLAUDE.md`: *"Workflow: read `docs/WORKFLOW.md` at the start of every session."*
5. Write the first `docs/HANDOFF.md`, pointing at the next session in the current milestone plan.
6. Commit as `workflow: sessions, handoffs and subagents`.

---

## 9. Worked example: M8 (data model and content) from `SPEC-musculoskeletal.md`

| Session | Serial task | Fan-out |
| --- | --- | --- |
| M8-S1 | Schemas (zod) for all new kinds, `movements.json`, the depth file format, and derived synergist/antagonist functions with unit tests. Write one complete example file per kind by hand. | none |
| M8-S2 | Upper-limb and shoulder-girdle muscle and part content | `content-writer` × 4–6 batches by compartment |
| M8-S3 | Lower-limb and hip muscle content | `content-writer` by compartment |
| M8-S4 | Head, neck, trunk, back and pelvic-floor muscle content | `content-writer` by region |
| M8-S5 | Ligament and cartilage content | `content-writer` by joint region |
| M8-S6 | `muscle-depth.json` and `muscle-hierarchy.json`; mirror; fix validation across all new content | none (needs cross-file judgement) |
| M8-S7 | Migrate bone `muscleAttachments` to derived data and remove the field | none |
| M8-S8 | Wrap-up: full checks, `verifier` for Playwright, QUESTIONS.md tidy, plan notes, handoff for M9 | `verifier` × 1 (context offload) |

Notes:
- S1 is serial on purpose. Every later batch copies its examples, so its quality sets the quality of hundreds of files.
- S6 and S7 are serial on purpose. They touch shared files and need to see all the content at once.
- Before each fan-out session, check usage with `/usage`. If the weekly allowance is low, run fewer batches per session and split the session in two in the plan.
