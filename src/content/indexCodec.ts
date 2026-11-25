// The ID index's wire format (M12 BB, plan decision 7). The index ships in the
// main chunk, so it is packed: positional rows instead of objects, and a
// right-side structure (or joint node) that is the exact mirror of its left one (`_left` →
// `_right` in its ID, parent and parts; everything else equal: all 432 of
// them today, and 165 of the joint nodes) is a reference instead of a row.
// Lossless by construction: the encoder only uses a reference where the
// decoder's mirror gives back the entry exactly (tests/idIndex.test.ts checks
// the round trip on the real and the fixture data).
//
// `decodeIndex` is the main chunk's half; `encodeIndex` runs in the Vite plugin.

import type { GraphNode } from "../graph/types";
import type { SoftId } from "../layers/softIds";
import type { IndexData } from "./index";

/** Side codes: midline, left, left followed by its mirror, right (not a mirror). */
const enum Side {
  Midline = 0,
  Left = 1,
  LeftThenMirror = 2,
  Right = 3,
}
const SIDES = ["midline", "left", "left", "right"] as const;

/** `[id, name, kind, layer, side, mesh, parts?, partType?, depth?]` (trailing zeros dropped), or the index of the entry this one mirrors. */
type EntryRow = (string | number | string[])[] | number;
/** `[id, name, node]`, or the index of the node this one mirrors. */
type NodeRow = string[] | number;
export type PackedIndex = { eager: IndexData["eager"]; entries: EntryRow[]; nodes: NodeRow[] };

const toRight = (s: string): string => s.replace(/_left$/, "_right");

function mirrorEntry(e: SoftId): SoftId {
  const out: SoftId = { ...e, id: toRight(e.id), side: "right" };
  if (e.parent) out.parent = toRight(e.parent);
  if (e.parts) out.parts = e.parts.map(toRight);
  return out;
}
const mirrorNode = (n: GraphNode): GraphNode => ({ ...n, id: toRight(n.id) });

export function decodeIndex(p: PackedIndex): IndexData {
  const entries: SoftId[] = [];
  for (const row of p.entries) {
    if (typeof row === "number") {
      entries.push(mirrorEntry(entries[row]!));
      continue;
    }
    const [id, name, kind, layer, side, mesh, parts, partType, depth] = row as [string, string, SoftId["kind"], SoftId["layer"], Side, number, (string[] | 0)?, (SoftId["partType"] | 0)?, (SoftId["depth"] | 0)?];
    const e: SoftId = { id, name, kind, layer, side: SIDES[side], mesh: mesh === 1 };
    if (parts) e.parts = parts;
    if (partType) e.partType = partType;
    if (depth) e.depth = depth;
    entries.push(e);
    if (side === Side.LeftThenMirror) entries.push(mirrorEntry(e));
  }
  // A part's parent is the structure that lists it (the encoder checks they agree).
  const parentOf = new Map(entries.flatMap((e) => (e.parts ?? []).map((part) => [part, e.id] as const)));
  for (const e of entries) {
    const parent = parentOf.get(e.id);
    if (parent) e.parent = parent;
  }
  const nodes: GraphNode[] = [];
  for (const row of p.nodes) {
    if (typeof row === "number") nodes.push(mirrorNode(nodes[row]!));
    else nodes.push({ id: row[0]!, node: row[2]!, name: row[1]! });
  }
  return { eager: p.eager, entries, nodes };
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export function encodeIndex(data: IndexData): PackedIndex {
  const E = data.entries;
  // Parents are rebuilt from the parts lists: refuse data where they disagree.
  const listedBy = new Map(E.flatMap((e) => (e.parts ?? []).map((part) => [part, e.id] as const)));
  for (const e of E) {
    if ((e.parent ?? null) !== (listedBy.get(e.id) ?? null)) {
      throw new Error(`ID index: ${e.id}'s parent (${e.parent ?? "none"}) isn't the structure listing it as a part (${listedBy.get(e.id) ?? "none"})`);
    }
  }
  const at = new Map(E.map((e, i) => [e.id, i]));
  const entries: EntryRow[] = [];
  for (let i = 0; i < E.length; i++) {
    const e = E[i]!;
    if (e.side === "right") {
      const l = at.get(e.id.replace(/_right$/, "_left"));
      if (l !== undefined && l < i && same(mirrorEntry(E[l]!), e)) {
        entries.push(l);
        continue;
      }
    }
    const thenMirror = e.side === "left" && i + 1 < E.length && same(mirrorEntry(e), E[i + 1]);
    const side = e.side === "midline" ? Side.Midline : e.side === "right" ? Side.Right : thenMirror ? Side.LeftThenMirror : Side.Left;
    const row: (string | number | string[])[] = [e.id, e.name, e.kind, e.layer, side, e.mesh ? 1 : 0, e.parts ?? 0, e.partType ?? 0, e.depth ?? 0];
    while (row.length > 6 && row[row.length - 1] === 0) row.pop();
    entries.push(row);
    if (thenMirror) i++;
  }
  const N = data.nodes;
  const nodes: NodeRow[] = [];
  const nodeAt = new Map(N.map((n, i) => [n.id, i]));
  for (let i = 0; i < N.length; i++) {
    const n = N[i]!;
    const l = /_right$/.test(n.id) ? nodeAt.get(n.id.replace(/_right$/, "_left")) : undefined;
    nodes.push(l !== undefined && l < i && same(mirrorNode(N[l]!), n) ? l : [n.id, n.name, n.node]);
  }
  return { eager: data.eager, entries, nodes };
}
