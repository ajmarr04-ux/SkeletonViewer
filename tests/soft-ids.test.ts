import { describe, expect, it } from "vitest";
import softIds from "../content/soft-ids.json";
import boneIds from "../content/ids.json";
import mapping from "../assets/mapping/soft-to-id.json";
import audit from "../assets/audit/soft-tissue.json";

// M6 session Q: the soft-tissue ID list and its mapping to the source
// (docs/PLAN-milestone-6.md, steps 3 and 4).

type Soft = {
  id: string;
  name: string;
  latin: string | null;
  kind: "muscle" | "muscle_part" | "ligament" | "cartilage" | "disc" | "meniscus";
  layer: "muscles" | "ligaments" | "cartilage";
  side: "left" | "right" | "midline";
  group: string[];
  parent?: string;
  partType?: "head" | "belly" | "portion" | "tendon" | "aponeurosis";
  alsoServes?: string[];
  parts?: string[];
  inconstant?: boolean;
  meshAvailable: boolean;
};
type Attachment = { source: string; structures: string[]; end: "origin" | "insertion"; side: string; on: string; group?: string; flag?: string };

const entries = softIds as Soft[];
const byId = new Map(entries.map((e) => [e.id, e]));
const map = mapping.map as Record<string, string[]>;
const missing = mapping.missing as Record<string, string>;
const excluded = mapping.excluded as Record<string, string>;
const attachments = mapping.attachments as Record<string, Attachment>;
const audited = (audit as { objects: { name: string }[] }).objects.map((o) => o.name);
const bones = new Set((boneIds as { id: string }[]).map((b) => b.id));

const LAYER_OF: Record<Soft["kind"], Soft["layer"]> = {
  muscle: "muscles",
  muscle_part: "muscles",
  ligament: "ligaments",
  cartilage: "cartilage",
  disc: "cartilage",
  meniscus: "cartilage",
};

describe("soft-tissue ID list", () => {
  it("has unique snake_case IDs that never collide with a bone ID", () => {
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    for (const e of entries) {
      expect(e.id).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
      expect(bones.has(e.id), e.id).toBe(false);
    }
  });

  it("puts the side suffix last, and only on sided structures", () => {
    for (const e of entries) {
      if (e.side === "midline") expect(e.id, e.id).not.toMatch(/_(left|right)$/);
      else expect(e.id.endsWith(`_${e.side}`), e.id).toBe(true);
    }
  });

  it("mirrors left and right exactly", () => {
    const left = entries.filter((e) => e.side === "left").map((e) => e.id.replace(/_left$/, ""));
    const right = entries.filter((e) => e.side === "right").map((e) => e.id.replace(/_right$/, ""));
    expect(new Set(left)).toEqual(new Set(right));
  });

  it("files every kind in its layer", () => {
    for (const e of entries) expect(e.layer, e.id).toBe(LAYER_OF[e.kind]);
  });

  it("links parts and parent muscles both ways (spec §3)", () => {
    for (const e of entries.filter((x) => x.kind === "muscle_part")) {
      const parent = byId.get(e.parent!);
      expect(parent?.kind, e.id).toBe("muscle");
      expect(parent?.parts, e.id).toContain(e.id);
      expect(parent?.side).toBe(e.side);
      for (const s of e.alsoServes ?? []) expect(byId.has(s), `${e.id} alsoServes ${s}`).toBe(true);
    }
    for (const m of entries.filter((x) => x.parts)) {
      expect(m.kind).toBe("muscle");
      expect(m.meshAvailable, `${m.id} has parts, so no mesh of its own`).toBe(false);
      for (const p of m.parts!) {
        expect(byId.get(p)?.parent).toBe(m.id);
        expect(byId.get(p)?.meshAvailable, p).toBe(true);
      }
    }
  });

  it("gives the calcaneal tendon to gastrocnemius, also serving soleus (plan decision 5)", () => {
    for (const side of ["left", "right"]) {
      const t = byId.get(`calcaneal_tendon_${side}`)!;
      expect(t.kind).toBe("muscle_part");
      expect(t.partType).toBe("tendon");
      expect(t.parent).toBe(`gastrocnemius_${side}`);
      expect(t.alsoServes).toEqual([`soleus_${side}`]);
    }
  });

  it("keeps the source's anatomical parts, e.g. the three heads of triceps", () => {
    expect(byId.get("triceps_brachii_left")?.parts?.sort()).toEqual([
      "triceps_brachii_lateral_head_left",
      "triceps_brachii_long_head_left",
      "triceps_brachii_medial_head_left",
    ]);
    expect(byId.get("biceps_brachii_right")?.parts).toHaveLength(2);
    expect(byId.get("deltoid_left")?.parts).toHaveLength(3);
  });
});

describe("soft-tissue mapping", () => {
  it("maps every ID with a mesh, and lists every other ID as missing or a parent", () => {
    for (const e of entries) {
      if (e.meshAvailable) expect(map[e.id]?.length, e.id).toBeGreaterThan(0);
      else {
        expect(map[e.id], e.id).toBeUndefined();
        expect(Boolean(missing[e.id]) || Boolean(e.parts?.length), e.id).toBe(true);
      }
    }
  });

  it("accounts for every audited mesh exactly once (mapped, merged, excluded or a patch)", () => {
    const seen = [
      ...Object.values(map).flat(),
      ...Object.keys(excluded),
      ...Object.values(attachments).map((a) => a.source),
    ];
    expect(new Set(seen).size).toBe(seen.length);
    expect(new Set(seen)).toEqual(new Set(audited));
  });

  it("joins only the nucleus pulposus into its disc", () => {
    for (const [id, sources] of Object.entries(map)) {
      if (sources.length > 1) {
        expect(id).toMatch(/^intervertebral_disc_/);
        expect(sources).toHaveLength(2);
        expect(sources[1]).toMatch(/^Nucleus pulposus /);
      }
    }
  });

  it("points every attachment patch at known structures on a known bone or cartilage", () => {
    for (const [id, a] of Object.entries(attachments)) {
      expect(id).toMatch(/^[a-z0-9_]+__(origin|insertion)(_(left|right))?(_\d+)?$/);
      for (const s of a.structures) expect(byId.has(s), `${id}: ${s}`).toBe(true);
      expect(bones.has(a.on) || byId.get(a.on)?.layer === "cartilage", `${id} on ${a.on}`).toBe(true);
      if (!a.group) expect(a.structures.length, id).toBeGreaterThan(0);
    }
  });

  it("takes patch sides from geometry, so a patch's structures are on its side", () => {
    for (const [id, a] of Object.entries(attachments)) {
      for (const s of a.structures) {
        const side = byId.get(s)!.side;
        if (side !== "midline" && a.side !== "midline") expect(side, id).toBe(a.side);
      }
    }
  });
});
