# Handoff — written 2026-11-25 at the end of M12 AZ

## Next session
BA (design): the query engine (`src/graph/graph.ts` runtime index, `src/graph/query.ts`) and tier rules as data on every `KindDescriptor` (plan decisions 5–6), proven offline against `tests/golden/tiers.json`.
Done when: the engine over the Node-compiled graph (`compileGraphFromDisk`) gives `tiers.json` exactly for all 1,138 IDs (t1, t2 all On, `bonesOnly`, `ant`); engine unit tests (step types, `from` modes, three orders, parts expansion, Off-layer filter, memoisation); the app still runs on the old tier code until BC; `npm run check` green.

## State
- Last commit: dcae4f7 M12 AZ: graph core; tree golden in `5dc9ec8`.
- `npm run check`: pass (618 tests, five goldens unchanged). Main chunk 472.7 kB.
- Open fan-out work: none

## Waiting on the user
none (AZ amended decisions 2 and 4: `synergist_of`, `antagonist_of`, `adjacent_tooth` are directed to keep today's behaviour; see the plan's AZ notes)

## Things the next session must know
- Graph core: `src/graph/{types,edgeTypes,compile}.ts`; edge types `src/systems/musculoskeletal/edges.ts`; extractors `KindContent.edges`, rules `LayerContent.rules`, system half `src/systems/musculoskeletal/content.ts`; `compileContentGraph` (registry.content), `compileGraphFromDisk` (scripts/lib/content-files.ts). 17,640 edges, 0 errors.
- Parts' `inherit` is resolved into the part's own `originates_on`/`inserts_on` with meta `inherited: "true"`; `derivedLists` (attached muscles) ignores those, tiers should include them.
- Order is behaviour: soft tier lists ID-sorted, bone partners in `ids.json` order, region neighbours as written (edges keep written order). Today's ligament/cartilage t2 = `shares_joint_with` minus t1; `t2: null` when the structure has no `member_of_joint`.
- The isolation test now also flags edge type IDs and inverse labels: `src/graph/` must name none (tier rules live in descriptors).
- Goldens: never `--write --force` without the user's approval. QUESTIONS: next is 140.
