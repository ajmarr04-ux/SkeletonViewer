// M9 session AI: the soft-tissue tree (plan decision 11), soft groups, and the
// soft-tissue search with group synonyms (decision 12).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readSoftIds } from "../scripts/lib/content-files";
import { readSearchDocuments, readSoftSearchDocuments } from "../scripts/lib/search-data";
import { readSoftTree } from "../scripts/lib/soft-tree-data";
import {
  ancestorsOf,
  crumbGroups,
  groupAncestors,
  groupAnnouncement,
  groupCounts,
  groupLayer,
  groupOf,
  isGroupKey,
  registerSoftTree,
  resetSoftTree,
} from "../src/content/groups";
import { buildIndex, makeSearcher, mergeSearchers } from "../src/content/search";
import { looksLikeTreeGroup as looksLikeSoftGroup } from "../src/systems/registry";
import { isSoftNode, nodeMembers, type SoftTreeItem, type SoftTreeNode } from "../src/tree/types";
import { SOFT_ROOT_KEYS, TOP_KEYS, treeKey, visibleRows } from "../src/content/tree";
import { groupView } from "../src/scene/isolation";
import { parseUrlState, serialiseUrlState } from "../src/state/url";

const tree = readSoftTree();
const soft = readSoftIds();
const byId = new Map(soft.map((e) => [e.id, e]));

function find(key: string, nodes: readonly SoftTreeItem[] = tree.roots): SoftTreeNode | undefined {
  for (const n of nodes) {
    if (!isSoftNode(n)) continue;
    if (n.key === key) return n;
    const f = find(key, n.children);
    if (f) return f;
  }
  return undefined;
}
/** Every structure in the tree (leaves and parts), with how often it appears. */
function leafCounts(): Map<string, number> {
  const out = new Map<string, number>();
  const walk = (i: SoftTreeItem) => {
    if (isSoftNode(i)) return i.children.forEach(walk);
    out.set(i.id, (out.get(i.id) ?? 0) + 1);
    for (const p of i.parts ?? []) out.set(p.id, (out.get(p.id) ?? 0) + 1);
  };
  tree.roots.forEach(walk);
  return out;
}

describe("soft tree (M9 plan decision 11)", () => {
  it("lists every soft-tissue structure exactly once, under its layer's root", () => {
    const counts = leafCounts();
    expect(counts.size).toBe(soft.length);
    expect([...counts.values()].every((n) => n === 1)).toBe(true);
    tree.roots.forEach((r) => {
      for (const id of nodeMembers(r)) expect(byId.get(id)!.layer).toBe(r.key);
    });
  });
  it("Muscles: region → compartment → muscle (both sides) → parts", () => {
    const post = find("muscles.upper_limb.arm.arm_posterior")!;
    expect(post.label).toBe("Posterior compartment of the arm");
    const [left, right] = post.children as { id: string; label: string; parts?: { id: string; label: string }[] }[];
    expect(left).toMatchObject({ id: "triceps_brachii_left", label: "Triceps brachii (left)" });
    expect(right!.id).toBe("triceps_brachii_right");
    expect(left!.parts!.map((p) => p.label).sort()).toEqual(["Lateral head", "Long head", "Medial head"]);
    expect(find("muscles.upper_limb")!.name).toBe("Muscles of the upper limb");
    expect(find("muscles.upper_limb.shoulder.rotator_cuff")!.name).toBe("Rotator cuff");
  });
  it("puts a part with no muscle where the first muscle it serves is (linea alba)", () => {
    const wall = find("muscles.abdomen.anterolateral_abdominal_wall")!;
    expect(wall.children.some((c) => !isSoftNode(c) && c.id === "linea_alba")).toBe(true);
  });
  it("Ligaments: by functional joint, then pair joint; no joint → Other ligaments", () => {
    const knee = find("ligaments.knee_joint_left")!;
    expect(nodeMembers(knee)).toContain("anterior_cruciate_ligament_left");
    expect(nodeMembers(knee)).not.toContain("anterior_cruciate_ligament_right");
    const ac = find("ligaments.shoulder_girdle_left.acromioclavicular_joint_left")!;
    expect(nodeMembers(ac)).toEqual(expect.arrayContaining(["acromioclavicular_ligament_left", "conoid_ligament_left", "trapezoid_ligament_left"]));
    const other = find("ligaments.other")!;
    expect(nodeMembers(other)).toContain("inguinal_ligament_left");
    expect(tree.roots[1]!.children[tree.roots[1]!.children.length - 1]).toBe(other);
  });
  it("Cartilage: by kind, then joint (a joint with one structure has no level of its own)", () => {
    expect(tree.roots[2]!.children.map((c) => (c as SoftTreeNode).key)).toEqual(["cartilage.cartilage", "cartilage.disc", "cartilage.meniscus"]);
    expect(nodeMembers(find("cartilage.meniscus.knee_joint_left")!).sort()).toEqual(["lateral_meniscus_left", "medial_meniscus_left"]);
    const costal = find("cartilage.cartilage")!;
    expect(costal.children.some((c) => !isSoftNode(c) && c.id === "costal_cartilage_1_left")).toBe(true);
  });
  it("group keys have a recognisable form", () => {
    expect(looksLikeSoftGroup("muscles.upper_limb.shoulder.rotator_cuff")).toBe(true);
    expect(looksLikeSoftGroup("ligaments")).toBe(true);
    expect(looksLikeSoftGroup("axial.skull")).toBe(false);
    expect(looksLikeSoftGroup("attached:femur_left")).toBe(false);
  });
  it("the group synonyms' own sets add the right side", () => {
    const quads = tree.sets.find((s) => s.key === "muscles.sets.quadriceps_femoris")!;
    expect(quads.members).toHaveLength(8);
    expect(quads.members).toContain("vastus_medialis_right");
  });
});

describe("soft groups, registered", () => {
  const partsOf = (id: string) => byId.get(id)?.parts ?? [];
  const hasMesh = (id: string) => byId.get(id)?.meshAvailable === true;
  beforeAll(() => registerSoftTree(tree));
  afterAll(() => resetSoftTree());

  it("are unknown until the tree registers, then known", () => {
    resetSoftTree();
    expect(isGroupKey("muscles.upper_limb.shoulder.rotator_cuff")).toBe(false);
    expect(visibleRows(new Set(["muscles"])).filter((r) => r.parent === "muscles")).toEqual([]);
    expect(visibleRows(new Set()).find((r) => r.key === "muscles")!.count).toBeNull();
    registerSoftTree(tree);
    expect(isGroupKey("muscles.upper_limb.shoulder.rotator_cuff")).toBe(true);
    expect(isGroupKey("muscles.sets.quadriceps_femoris")).toBe(true);
  });
  it("carry their layer, trail, members and ancestors", () => {
    const g = groupOf("muscles.upper_limb.shoulder.rotator_cuff")!;
    expect(g).toMatchObject({ label: "Rotator cuff", name: "Rotator cuff", layer: "muscles", parent: "muscles.upper_limb.shoulder" });
    expect(g.trail).toEqual(["Muscles", "Upper limb", "Shoulder", "Rotator cuff"]);
    expect(g.members).toHaveLength(8);
    expect(groupLayer("ligaments.knee_joint_left")).toBe("ligaments");
    expect(groupLayer("attached:femur_left")).toBe("muscles");
    expect(groupLayer("axial.skull")).toBeNull();
    expect(groupAncestors("muscles.upper_limb.shoulder.rotator_cuff")).toEqual(["muscles", "muscles.upper_limb", "muscles.upper_limb.shoulder"]);
    expect(ancestorsOf("triceps_brachii_long_head_left")).toEqual(["muscles", "muscles.upper_limb", "muscles.upper_limb.arm", "muscles.upper_limb.arm.arm_posterior"]);
    expect(ancestorsOf("anterior_cruciate_ligament_left")).toEqual(["ligaments", "ligaments.knee_joint_left"]);
  });
  it("count and announce what is drawn before the ID table loads", () => {
    expect(groupCounts("muscles.upper_limb.arm.arm_posterior")).toEqual({ shown: 2, total: 2 });
    expect(groupAnnouncement("muscles.upper_limb.shoulder.rotator_cuff")).toBe("Rotator cuff: 8 shown.");
  });
  it("draw a muscle with parts as its parts", () => {
    const v = groupView("muscles.upper_limb.arm.arm_posterior", "ghost", hasMesh, partsOf);
    expect([...v.solid!].sort()).toEqual([...partsOf("triceps_brachii_left"), ...partsOf("triceps_brachii_right")].sort());
  });
  it("make the soft panel's region crumb a link", () => {
    expect(crumbGroups(["Muscles", "Upper limb", "Triceps brachii"], ancestorsOf("triceps_brachii_left"))).toEqual(["muscles", "muscles.upper_limb", null]);
  });
  it("tree rows: the roots, then a muscle that opens to its parts", () => {
    const open = new Set(["muscles", "muscles.upper_limb", "muscles.upper_limb.arm", "muscles.upper_limb.arm.arm_posterior"]);
    const rows = visibleRows(open);
    expect(rows.slice(0, 3).map((r) => r.key)).toEqual([...TOP_KEYS]);
    const tri = rows.find((r) => r.key === "triceps_brachii_left")!;
    expect(tri).toMatchObject({ kind: "leaf", expandable: true, level: 5, soft: true, drawn: true });
    expect(rows.some((r) => r.key === "triceps_brachii_long_head_left")).toBe(false);
    expect(treeKey(rows, open, "triceps_brachii_left", "ArrowRight")).toEqual({ kind: "open", key: "triceps_brachii_left" });
    const opened = new Set([...open, "triceps_brachii_left"]);
    const rows2 = visibleRows(opened);
    const long = rows2.find((r) => r.key === "triceps_brachii_long_head_left")!;
    expect(long).toMatchObject({ kind: "leaf", label: "Long head", level: 6, parent: "triceps_brachii_left" });
    expect(treeKey(rows2, opened, "triceps_brachii_left", "ArrowLeft")).toEqual({ kind: "close", key: "triceps_brachii_left" });
    expect(treeKey(rows2, opened, "triceps_brachii_long_head_left", "ArrowLeft")).toEqual({ kind: "focus", key: "triceps_brachii_left" });
    expect(rows2.find((r) => r.key === "muscles")!.count).toBe(nodeMembers(tree.roots[0]!).length);
    expect(SOFT_ROOT_KEYS).toEqual(["muscles", "ligaments", "cartilage"]);
  });
  it("a soft group key round-trips through the URL", () => {
    const q = serialiseUrlState({ grp: "muscles.upper_limb.shoulder.rotator_cuff" }, "");
    expect(q).toBe("?grp=muscles.upper_limb.shoulder.rotator_cuff");
    expect(parseUrlState(q, () => true, isGroupKey).grp).toBe("muscles.upper_limb.shoulder.rotator_cuff");
  });
});

describe("soft-tissue search (M9 plan decision 12)", () => {
  const softDocs = readSoftSearchDocuments();
  const softSearch = makeSearcher(buildIndex(softDocs), softDocs);
  const boneDocs = readSearchDocuments();
  const search = mergeSearchers(makeSearcher(buildIndex(boneDocs), boneDocs), softSearch);
  const ids = (q: string) => search(q).map((h) => h.id);

  it("indexes every structure and every group synonym", () => {
    expect(softDocs.filter((d) => !d.group)).toHaveLength(soft.length);
    expect(softDocs.filter((d) => d.group).map((d) => d.id).sort()).toEqual([
      "muscles.back.erector_spinae",
      "muscles.lower_limb.thigh.thigh_medial",
      "muscles.lower_limb.thigh.thigh_posterior",
      "muscles.sets.quadriceps_femoris",
      "muscles.sets.triceps_surae",
      "muscles.upper_limb.shoulder.rotator_cuff",
    ]);
  });
  it("finds abbreviations, on both sides, and narrows by side", () => {
    expect(ids("ACL").slice(0, 2).sort()).toEqual(["anterior_cruciate_ligament_left", "anterior_cruciate_ligament_right"]);
    expect(ids("left ACL")[0]).toBe("anterior_cruciate_ligament_left");
    expect(ids("MCL").slice(0, 4)).toEqual(expect.arrayContaining(["tibial_collateral_ligament_deep_part_left", "tibial_collateral_ligament_superficial_part_right"]));
    expect(search("ACL")[0]).toMatchObject({ label: "Anterior cruciate ligament (left)", match: "ACL", group: false, drawn: true });
  });
  it("group synonyms resolve to a group, first", () => {
    expect(search("rotator cuff")[0]).toMatchObject({ id: "muscles.upper_limb.shoulder.rotator_cuff", group: true, label: "Rotator cuff" });
    expect(search("hamstrings")[0]).toMatchObject({ id: "muscles.lower_limb.thigh.thigh_posterior", group: true, match: "Hamstrings" });
    expect(ids("quadriceps")[0]).toBe("muscles.sets.quadriceps_femoris");
    expect(ids("erector spinae")[0]).toBe("muscles.back.erector_spinae");
    expect(ids("left rotator cuff")).not.toContain("muscles.upper_limb.shoulder.rotator_cuff");
  });
  it("finds names, Latin and common names, and marks structures with nothing drawn", () => {
    expect(ids("triceps brachii").slice(0, 2).sort()).toEqual(["triceps_brachii_left", "triceps_brachii_right"]);
    expect(search("Achilles tendon")[0]!.id).toMatch(/^calcaneal_tendon_/);
    expect(search("patellar ligament").find((h) => h.id === "patellar_ligament_left")!.drawn).toBe(false);
  });
  it("bone results keep their place in the merged list", () => {
    expect(ids("femur").slice(0, 2).sort()).toEqual(["femur_left", "femur_right"]);
    expect(ids("kneecap").slice(0, 2).sort()).toEqual(["patella_left", "patella_right"]);
    expect(ids("left femur")[0]).toBe("femur_left");
  });
});
