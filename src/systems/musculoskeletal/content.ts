// The musculoskeletal system's authoring half (M12 plan decisions 1 and 2):
// the edges from files that aren't one structure's front matter, the joints as
// graph nodes, and the one rule across layers. Scripts, Vite plugins and tests only.
//
// - `articulations.json` → `articulates_with` (meta `joint`), in file order;
// - `regions.json` → `region_neighbour`, as written;
// - `joints.json` → `member_of_joint`, each pair joint to its functional joint;
// - the joints (pair joints and functional joints) are nodes `node: "joint"`;
// - `shares_joint_with`: two ligaments or cartilages whose joints are the same
//   joint (M9 plan decision 4): a functional joint stands for its pairs, a pair
//   for itself and every pair of a functional joint containing it, and two
//   joints are the same when those sets overlap.

import type { Edge, GraphNode } from "../../graph/types";
import { defineSystemContent, type GraphContext } from "../contentTypes";

type Articulation = { a: string; b: string; joint: string; name: string };
type FunctionalJoint = { id: string; name: string; articulations: string[] };

const ARTICULATIONS = "content/articulations.json";
const REGIONS = "content/regions.json";
const JOINTS = "content/joints.json";
const JOINT = "joint";

function jointNodes(ctx: GraphContext): GraphNode[] {
  const out = new Map<string, GraphNode>();
  for (const a of ctx.readJson(ARTICULATIONS) as Articulation[]) if (!out.has(a.joint)) out.set(a.joint, { id: a.joint, node: JOINT, name: a.name });
  for (const j of ctx.readJson(JOINTS) as FunctionalJoint[]) if (!out.has(j.id)) out.set(j.id, { id: j.id, node: JOINT, name: j.name });
  return [...out.values()];
}

function sources(ctx: GraphContext): { where: string; edges: Edge[] }[] {
  const arts = ctx.readJson(ARTICULATIONS) as Articulation[];
  const regions = ctx.readJson(REGIONS) as Record<string, string[]>;
  const joints = ctx.readJson(JOINTS) as FunctionalJoint[];
  return [
    { where: ARTICULATIONS, edges: arts.map((a) => ({ from: a.a, type: "articulates_with", to: a.b, meta: { joint: a.joint } })) },
    { where: REGIONS, edges: Object.entries(regions).flatMap(([from, list]) => list.map((to) => ({ from, type: "region_neighbour", to }))) },
    { where: JOINTS, edges: joints.flatMap((j) => j.articulations.map((p) => ({ from: p, type: "member_of_joint", to: j.id }))) },
  ];
}

/** Each joint ID → the articulation pairs it stands for, for the same-joint test (was `jointScope`, src/content/softTiers.ts). */
export function jointScopes(edges: readonly Edge[]): (joint: string) => ReadonlySet<string> {
  const pairs = new Set<string>();
  for (const e of edges) if (e.type === "articulates_with" && e.meta?.joint) pairs.add(e.meta.joint);
  const members = new Map<string, string[]>();
  const containing = new Map<string, string[]>();
  for (const e of edges)
    if (e.type === "member_of_joint" && pairs.has(e.from)) {
      members.set(e.to, [...(members.get(e.to) ?? []), e.from]);
      containing.set(e.from, [...(containing.get(e.from) ?? []), e.to]);
    }
  const cache = new Map<string, ReadonlySet<string>>();
  return (joint) => {
    let s = cache.get(joint);
    if (!s) {
      const fj = members.get(joint);
      if (fj) s = new Set(fj);
      else if (pairs.has(joint)) s = new Set([joint, ...(containing.get(joint) ?? []).flatMap((f) => members.get(f) ?? [])]);
      else s = new Set();
      cache.set(joint, s);
    }
    return s;
  };
}

/** `shares_joint_with` between every two structures (not joints) whose `member_of_joint` joints overlap. */
export function sharesJointEdges(edges: readonly Edge[]): Edge[] {
  const scope = jointScopes(edges);
  const joints = new Set<string>();
  for (const e of edges) if (e.type === "articulates_with" && e.meta?.joint) joints.add(e.meta.joint);
  const jointed: { id: string; scope: ReadonlySet<string> }[] = [];
  for (const e of edges) if (e.type === "member_of_joint" && !joints.has(e.from)) jointed.push({ id: e.from, scope: scope(e.to) });
  jointed.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out: Edge[] = [];
  for (let i = 0; i < jointed.length; i++)
    for (let k = i + 1; k < jointed.length; k++) {
      const a = jointed[i]!;
      const b = jointed[k]!;
      if (a.id !== b.id && [...b.scope].some((p) => a.scope.has(p))) out.push({ from: a.id, type: "shares_joint_with", to: b.id });
    }
  return out;
}

export const musculoskeletalContent = defineSystemContent({
  id: "musculoskeletal",
  nodes: jointNodes,
  sources,
  rules: [sharesJointEdges],
});
