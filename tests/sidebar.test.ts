import { describe, expect, it } from "vitest";
import { cursorStops, tabCursor } from "../src/camera/input";
import { ancestorsOf, crumbGroups, GROUPS, groupAnnouncement, groupCounts, groupOf, isGroupKey } from "../src/content/groups";
import { SOFT_ROOT_KEYS, TOP_KEYS, treeKey, typeAhead, visibleRows } from "../src/content/tree";
import { groupView, isolationView } from "../src/scene/isolation";
import ids from "../content/ids.json";

const meshed = new Set((ids as { id: string; meshAvailable: boolean }[]).filter((e) => e.meshAvailable).map((e) => e.id));
const hasMesh = (id: string) => meshed.has(id);

describe("cursorStops (M10 plan decision 5)", () => {
  // A bone, a muscle with three parts, a muscle without parts, a ligament.
  const PARENT: Record<string, string> = { tri_long: "tri", tri_lat: "tri", tri_med: "tri" };
  const parentOf = (id: string) => PARENT[id] ?? null;
  const solid = ["femur", "tri_long", "tri_lat", "tri_med", "deltoid", "acl"];
  it("a muscle is one stop, at its first part's place", () => {
    expect(cursorStops(solid, null, parentOf)).toEqual(["femur", "tri", "deltoid", "acl"]);
    expect(cursorStops(solid, "femur", parentOf)).toEqual(["femur", "tri", "deltoid", "acl"]);
  });
  it("its parts are stops once the muscle or one of its parts is selected", () => {
    expect(cursorStops(solid, "tri", parentOf)).toEqual(["femur", "tri_long", "tri_lat", "tri_med", "deltoid", "acl"]);
    expect(cursorStops(solid, "tri_lat", parentOf)).toEqual(["femur", "tri_long", "tri_lat", "tri_med", "deltoid", "acl"]);
  });
  it("Tab walks the stops; a muscle stop leads into its parts after Enter selects it", () => {
    const before = cursorStops(solid, null, parentOf);
    expect(tabCursor(before, "femur", false)).toBe("tri");
    const after = cursorStops(solid, "tri", parentOf);
    expect(tabCursor(after, null, false)).toBe("femur");
    expect(tabCursor(after, "femur", false)).toBe("tri_long");
  });
});

describe("tabCursor (plan step 4)", () => {
  const list = ["a", "b", "c"];
  it("starts at the first (Tab) or last (Shift+Tab)", () => {
    expect(tabCursor(list, null, false)).toBe("a");
    expect(tabCursor(list, null, true)).toBe("c");
    expect(tabCursor(list, "gone", false)).toBe("a");
  });
  it("steps through and returns null past either end (no keyboard trap)", () => {
    expect(tabCursor(list, "a", false)).toBe("b");
    expect(tabCursor(list, "b", true)).toBe("a");
    expect(tabCursor(list, "c", false)).toBeNull();
    expect(tabCursor(list, "a", true)).toBeNull();
    expect(tabCursor([], null, false)).toBeNull();
  });
});

describe("groups (plan decision 5)", () => {
  it("has every inner node of the hierarchy plus the four tooth types", () => {
    expect(isGroupKey("axial.skull.ossicles")).toBe(true);
    expect(isGroupKey("dentition.type.molars")).toBe(true);
    expect(isGroupKey("femur_left")).toBe(false);
    expect(groupOf("dentition")!.members).toHaveLength(32);
    expect(groupOf("axial")!.members.length + groupOf("appendicular")!.members.length).toBe(206);
  });
  it("names groups so they stand alone", () => {
    expect(groupOf("dentition.upper.right.molars")!.name).toBe("Molars, upper right");
    expect(groupOf("appendicular.upper_limb.left.carpals")!.name).toBe("Carpals, left");
    expect(groupOf("dentition.type.molars")!.name).toBe("Molars, upper and lower");
    expect(groupOf("axial.skull.ossicles")!.trail).toEqual(["Skull", "Ossicles"]);
    expect(groupOf("dentition.upper.right.molars")!.trail).toEqual(["Teeth", "Upper right", "Molars"]);
  });
  it("counts members with a 3D model (wisdom teeth are missing)", () => {
    expect(groupCounts("dentition.type.molars")).toEqual({ shown: 8, total: 12 });
    expect(groupAnnouncement("dentition.type.molars")).toBe("Molars, upper and lower: 8 shown, 8 of 12 have a 3D model.");
    expect(groupAnnouncement("axial.skull.ossicles", true)).toBe("Back to Ossicles: 6 shown.");
  });
  it("the group view draws its meshed members solid, with no focus", () => {
    const v = isolationView(null, 0, "ghost", hasMesh, "dentition.type.molars");
    expect(v.isolated).toBe(true);
    expect(v.focus).toBeNull();
    expect([...v.solid!].sort()).toEqual(groupOf("dentition.type.molars")!.members.filter(hasMesh).sort());
    expect(groupView("dentition.type.molars", "hide", hasMesh).ghosts).toBe(false);
    // Selection wins over a stale group.
    expect(isolationView("femur_left", 0, "ghost", hasMesh, "dentition.type.molars").focus).toBe("femur_left");
  });
  it("breadcrumb levels link to the object's groups", () => {
    expect(ancestorsOf("tooth_13")).toEqual(["dentition", "dentition.upper", "dentition.upper.right", "dentition.upper.right.canines"]);
    expect(crumbGroups(["Teeth", "Upper right", "Canines", "Upper right canine"], ancestorsOf("tooth_13"))).toEqual([
      "dentition",
      "dentition.upper.right",
      "dentition.upper.right.canines",
      null,
    ]);
    expect(crumbGroups(["Lower limb", "Femur"], ancestorsOf("femur_left"))).toEqual(["appendicular.lower_limb", null]);
  });
  it("every group key is unique and every member is a known ID", () => {
    const known = new Set((ids as { id: string }[]).map((e) => e.id));
    for (const g of GROUPS.values()) for (const m of g.members) expect(known.has(m)).toBe(true);
  });
});

describe("tree (plan step 2)", () => {
  it("shows the top level, and children of open groups", () => {
    expect(visibleRows(new Set()).map((r) => r.key)).toEqual([...TOP_KEYS, ...SOFT_ROOT_KEYS]);
    const rows = visibleRows(new Set(["dentition"]));
    expect(rows.map((r) => r.key)).toContain("dentition.type.molars");
    const molars = rows.find((r) => r.key === "dentition.type.molars")!;
    expect(molars).toMatchObject({ kind: "type", level: 2, count: 12, parent: "dentition" });
  });
  it("moves like a WAI-ARIA tree", () => {
    const open = new Set(["axial"]);
    const rows = visibleRows(open);
    expect(treeKey(rows, open, "axial", "ArrowDown")).toEqual({ kind: "focus", key: "axial.skull" });
    expect(treeKey(rows, open, "axial", "ArrowRight")).toEqual({ kind: "focus", key: "axial.skull" });
    expect(treeKey(rows, open, "axial.skull", "ArrowRight")).toEqual({ kind: "open", key: "axial.skull" });
    expect(treeKey(rows, open, "axial", "ArrowLeft")).toEqual({ kind: "close", key: "axial" });
    expect(treeKey(rows, open, "axial.skull", "ArrowLeft")).toEqual({ kind: "focus", key: "axial" });
    expect(treeKey(rows, open, "axial.skull", "Home")).toEqual({ kind: "focus", key: "axial" });
    expect(treeKey(rows, open, "axial", "End")).toEqual({ kind: "focus", key: "cartilage" });
    expect(treeKey(rows, open, "axial.skull", "*")).toEqual({ kind: "openSiblings", keys: ["axial.skull", "axial.vertebral_column", "axial.thorax"] });
  });
  it("type-ahead finds the next row by its label", () => {
    const rows = visibleRows(new Set(["axial"]));
    expect(typeAhead(rows, "axial", "t")).toBe("axial.thorax");
    expect(typeAhead(rows, "axial.thorax", "t")).toBe("dentition");
    expect(typeAhead(rows, "axial", "ve", true)).toBe("axial.vertebral_column");
    expect(typeAhead(rows, "axial", "zz")).toBeNull();
  });
});
