# How to work in this repo: sessions, handoffs and subagents

Read this at the start of every session, together with `CLAUDE.md` and `docs/HANDOFF.md`.

This file decides **how** work is done. The milestone specs (`SPEC (2).md`, `SPEC-musculoskeletal.md`) decide **what** is built. `docs/PLAN-milestone-<N>.md` breaks one milestone into sessions.

---

## 1. The model in one paragraph

You are the **main agent**. Each session does **one serial task**: a piece of work whose steps depend on each other and need judgement, for example designing a schema, wiring a reducer, or fixing a failing build. **Most sessions use no subagents at all.** Subagents are for one thing only: **large batches where every item needs its own judgement, written as prose or a classification**. Examples are drafting 150+ content files, or mapping hundreds of source names to IDs. Counting, measuring, auditing with scripts, and running tests stay in the main session, done by scripts. At the end of the session you write `docs/HANDOFF.md`, stop, and the user clears the context and starts the next session.

**Why.** Every subagent starts cold: it re-reads the brief, the spec sections and the examples before doing any work. The M10 audit used five auditors to run the same 5-second Blender job five times, at about 220k tokens. One script run plus one analysis would have cost a fraction of that. A subagent only pays for itself when the per-item work is large compared with that cold start.

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

**Default: no subagents.** Use them only when **all** of these are true:

1. There are **at least about 100 items**.
2. Each item needs **judgement written as prose or a classification**: content files, or mapping source names to IDs. Mechanical work never qualifies.
3. Doing it all in the main session would overflow its context. If it would fit, do it yourself across one or two sessions instead.

| Job | How |
| --- | --- |
| Content drafting, 100+ files | `content-writer` subagents (§6) |
| Mapping hundreds of source names to IDs, per system | `mapper` subagents (§6), working from a table the main session's script produced |
| Audits, counts, statistics, bounds checks | **One script, run by the main session.** Make the script robust first, and commit it. Never fan out a measuring job. |
| Playwright / long test runs | **The main session runs them in the background**, writing output to a log file, then greps the log for failures. Run one at a time (they share port 4173). |
| Repo-wide search | Grep and glob in the main session. The built-in `Explore` subagent only when the search is genuinely open-ended. |
| Anything under about 100 items | The main session, serially |
| Decisions across items, shared files, integration bugs | The main session, always |

**Cost rules (Pro plan).**
- **Fewer, bigger batches:** 30 to 50 items per batch and **at most 3 at once**. The cold start is paid once per batch, so small batches waste most of their tokens on it.
- **Keep briefs short.** Point the subagent at exact spec sections and one example file, not at whole documents.
- **Record the cost.** After each fan-out, write the subagent tokens (shown in each result) into the plan's session notes. If a fan-out cost more than the main session would have, say so and adjust the next one.
- **Pilot first.** Run **one** batch, check it, fix the brief, then run the rest. Never launch a full wave on an untested brief.
- **Model choice for the main session:** the user may run routine sessions (content fixes, wiring, tests) on Sonnet and keep the stronger model for design sessions (schemas, architecture, the relationship graph). Say at the start of each session plan which kind it is.
- Always ask for the short summary format (§4), never for file contents back.

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

### `.claude/agents/mapper.md` (replaces `mesh-auditor.md`; delete that file and `verifier.md`)
```markdown
---
name: mapper
description: Maps an assigned slice of source objects (from a table the main session's script produced) to stable IDs, kinds and whole/part/excluded decisions. Use only for mapping batches of 100+ names.
tools: Read, Write, Glob, Grep
model: sonnet
---
You map 3D source objects to stable IDs for the anatomy viewer.

Read the BRIEF.md you are given. It names your rows in the source table, the ID rules,
the whole-vs-part policy for this system, and the one output file you may write.
Do not run Blender or any script; the measurements are already in the table.

For each row decide: stable ID, kind, parent (if a part), or merged-into / excluded with a
one-line reason. When unsure, mark it "doubt" with the reason; don't guess.

Rules:
- Write only your assigned output file. No git commands, no installs, no subagents.
- Return ONLY the summary format from the brief.
```

The `verifier` subagent is retired: background test runs with a log file and a grep do the same job for less.

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

1. Make sure `.claude/agents/` holds exactly the two definitions in §6 (`content-writer`, `mapper`); delete `mesh-auditor.md` and `verifier.md` if present.
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
| M8-S2 | Upper-limb and shoulder-girdle muscle and part content | `content-writer`: 1 pilot batch, then 2–3 batches of 30–50 |
| M8-S3 | Lower-limb and hip muscle content | `content-writer`, 2–3 batches of 30–50 |
| M8-S4 | Head, neck, trunk, back and pelvic-floor muscle content | `content-writer`, 2–3 batches of 30–50 |
| M8-S5 | Ligament and cartilage content | `content-writer`, 4–5 batches of 40–50 |
| M8-S6 | `muscle-depth.json` and `muscle-hierarchy.json`; mirror; fix validation across all new content | none (needs cross-file judgement) |
| M8-S7 | Migrate bone `muscleAttachments` to derived data and remove the field | none |
| M8-S8 | Wrap-up: full checks, Playwright in the background with a log grep, QUESTIONS.md tidy, plan notes, handoff for M9 | none |

Notes:
- S1 is serial on purpose. Every later batch copies its examples, so its quality sets the quality of hundreds of files.
- S6 and S7 are serial on purpose. They touch shared files and need to see all the content at once.
- Before each fan-out session, check usage with `/usage`. If the weekly allowance is low, run fewer batches per session and split the session in two in the plan.
