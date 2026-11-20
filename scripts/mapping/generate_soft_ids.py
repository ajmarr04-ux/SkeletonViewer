"""Generate content/soft-ids.json and assets/mapping/soft-to-id.json (M6, session Q).

Usage: python3 scripts/mapping/generate_soft_ids.py   (npm run soft-ids)

Reads the classified soft-tissue audit (assets/audit/soft-tissue.json, from
`npm run audit-soft`) and content/ids.json (the bone IDs). Writes:

  content/soft-ids.json           one entry per soft-tissue ID (plan decision 1)
  assets/mapping/soft-to-id.json  map, merged, missing, excluded, attachments,
                                  attachmentsMissing, notes

Fails (non-zero exit) if any audited mesh is unaccounted for or used twice, an
ID repeats or collides with a bone ID, a part's parent is missing, a named
side disagrees with the geometry without a recorded reason, or the left and
right ID sets don't mirror each other.

Nothing here adds geometry or anatomy beyond names and grouping: sides come
from the source (corrected from geometry where the source is wrong), parts
from the source's own splits, and every judgement call is listed in
content/QUESTIONS.md ("Soft tissue").
"""
from __future__ import annotations

import collections
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
AUDIT = ROOT / "assets/audit/soft-tissue.json"
BONES = ROOT / "content/ids.json"
IDS_OUT = ROOT / "content/soft-ids.json"
MAP_OUT = ROOT / "assets/mapping/soft-to-id.json"

LAYER_ORDER = {"muscles": 0, "ligaments": 1, "cartilage": 2}
ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh",
       "eighth", "ninth", "tenth", "eleventh", "twelfth"]
STOP = {"of", "the", "muscle", "muscles"}

errors: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


# --- names and IDs -----------------------------------------------------------

def base(name: str) -> str:
    n = name[:-2] if name[-2:] in (".l", ".r") else name
    return n.strip("()").strip()


def snake(text: str) -> str:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return "_".join(w for w in words if w not in STOP)


def display(text: str) -> str:
    """Source name → display name: drop the word 'muscle' (singular)."""
    t = re.sub(r"\s+muscle\b", "", text).strip()
    return t[0].upper() + t[1:]


def sided(id_: str, side: str) -> str:
    return id_ if side == "midline" else f"{id_}_{side}"


# --- decisions (plan decisions 3-7; session Q choices, each in QUESTIONS.md) --

# Doubtful meshes from the audit, resolved with the user's defaults (2026-11-20).
DOUBTFUL = {
    "Iliotibial tract": ("part", dict(parent="tensor_fasciae_latae", partType="tendon",
                                      id="iliotibial_tract", alsoServes=["gluteus_maximus"])),
    "Palmar aponeurosis": ("part", dict(parent="palmaris_longus", partType="aponeurosis",
                                        id="palmar_aponeurosis")),
    "Common tendinous ring": ("part", dict(parent="superior_rectus", partType="tendon",
                                           id="common_tendinous_ring",
                                           alsoServes=["inferior_rectus", "medial_rectus", "lateral_rectus"])),
    "Acetabular labrum": ("whole", dict(layer="cartilage", kind="cartilage")),
    "Glenoid labrum": ("whole", dict(layer="cartilage", kind="cartilage")),
    "Sacrococcygeal symphysis": ("whole", dict(layer="cartilage", kind="disc")),
    "Linea alba": ("excluded", "one midline mesh shared by both sides' abdominal muscles, so it can't be a "
                               "part of one rectus abdominis (the data model needs a sided parent); see QUESTIONS.md"),
    "Plantar aponeurosis": ("excluded", "deep fascia of the sole (fascia, deferred); user default 2026-11-20"),
    "Tendinous arch of levator ani": ("excluded", "thickening of the obturator fascia (fascia, deferred)"),
    "Superficial transverse metacarpal ligament": ("excluded", "fascial band of the palmar aponeurosis, not a joint ligament"),
    "Superficial transverse metatarsal ligament": ("excluded", "fascial band of the plantar aponeurosis, not a joint ligament"),
    "Trochlea of superior oblique muscle": ("excluded", "fibrocartilaginous pulley of the eye, not muscle, ligament or joint cartilage"),
    "Pubic symphysis": ("excluded", "whole-joint mesh overlapping the separate interpubic disc"),
    "Cricopharyngeal ligament": ("excluded", "laryngeal ligament; the laryngeal cartilage it joins is excluded"),
    "Median cricothyroid ligament": ("excluded", "laryngeal ligament; the laryngeal cartilage it joins is excluded"),
    "Median thyrohyoid ligament": ("excluded", "joins the hyoid to the excluded thyroid cartilage"),
    "Lateral thyrohyoid ligament": ("excluded", "joins the hyoid to the excluded thyroid cartilage"),
    "Quadrangular membrane": ("excluded", "laryngeal membrane between excluded cartilages"),
}

# Parent muscles: key (as the audit's partOf, or the parent ID) → (ID, display name).
PARENTS = {
    "adductor hallucis": ("adductor_hallucis", "Adductor hallucis"),
    "adductor magnus": ("adductor_magnus", "Adductor magnus"),
    "adductor pollicis": ("adductor_pollicis", "Adductor pollicis"),
    "biceps brachii": ("biceps_brachii", "Biceps brachii"),
    "biceps femoris": ("biceps_femoris", "Biceps femoris"),
    "cricothyroid": ("cricothyroid", "Cricothyroid"),
    "deltoid": ("deltoid", "Deltoid"),
    "digastric": ("digastric", "Digastric"),
    "digastric muscle": ("digastric", "Digastric"),
    "epicranius (occipitofrontalis)": ("occipitofrontalis", "Occipitofrontalis"),
    "extensor carpi ulnaris": ("extensor_carpi_ulnaris", "Extensor carpi ulnaris"),
    "extensor digitorum longus": ("extensor_digitorum_longus", "Extensor digitorum longus"),
    "flexor carpi ulnaris": ("flexor_carpi_ulnaris", "Flexor carpi ulnaris"),
    "flexor digitorum superficialis": ("flexor_digitorum_superficialis", "Flexor digitorum superficialis"),
    "flexor hallucis brevis": ("flexor_hallucis_brevis", "Flexor hallucis brevis"),
    "flexor pollicis brevis": ("flexor_pollicis_brevis", "Flexor pollicis brevis"),
    "gastrocnemius": ("gastrocnemius", "Gastrocnemius"),
    "gastrocnemius / soleus (plan decision 5)": ("gastrocnemius", "Gastrocnemius"),
    "lateral intertransversarii lumborum": ("lateral_intertransversarii_lumborum", "Lateral intertransversarii lumborum"),
    "lateral pterygoid": ("lateral_pterygoid", "Lateral pterygoid"),
    "masseter": ("masseter", "Masseter"),
    "oblique arytenoid": ("oblique_arytenoid", "Oblique arytenoid"),
    "orbicularis oculi": ("orbicularis_oculi", "Orbicularis oculi"),
    "pectoralis major": ("pectoralis_major", "Pectoralis major"),
    "pronator teres": ("pronator_teres", "Pronator teres"),
    "thyro-arytenoid": ("thyro_arytenoid", "Thyro-arytenoid"),
    "trapezius": ("trapezius", "Trapezius"),
    "triceps brachii": ("triceps_brachii", "Triceps brachii"),
    # parents created by the doubtful decisions above
    "tensor_fasciae_latae": ("tensor_fasciae_latae", "Tensor fasciae latae"),
    "palmaris_longus": ("palmaris_longus", "Palmaris longus"),
    "superior_rectus": ("superior_rectus", "Superior rectus"),
    "occipitofrontalis": ("occipitofrontalis", "Occipitofrontalis"),
    "adductor_magnus": ("adductor_magnus", "Adductor magnus"),
    "extensor_digitorum_longus": ("extensor_digitorum_longus", "Extensor digitorum longus"),
}

# Part IDs and names that don't follow "<parent>_<division>_<type>".
PART_IDS = {
    "Calcaneal tendon": ("calcaneal_tendon", "Calcaneal tendon"),
    "Adductor minimus": ("adductor_minimus", "Adductor minimus"),
    "Intermediate tendon of digastric muscle": ("digastric_intermediate_tendon", "Intermediate tendon of digastric"),
    "Tendon of extensor digitorum longus": ("extensor_digitorum_longus_tendon", "Tendon of extensor digitorum longus"),
    "Epicranial aponeurosis": ("epicranial_aponeurosis", "Epicranial aponeurosis"),
}
ALSO_SERVES = {
    "Calcaneal tendon": ["soleus"],
    "Epicranial aponeurosis": ["temporoparietalis"],
}

# Whole muscle meshes that become a part of a parent (the parent has other
# parts, so it can't keep a mesh of its own: spec §2.7, §3).
WHOLE_TO_PART = {
    "Frontalis muscle": ("occipitofrontalis", "occipitofrontalis_frontal_belly", "Frontal belly of occipitofrontalis", "belly"),
    "Occipitalis muscle": ("occipitofrontalis", "occipitofrontalis_occipital_belly", "Occipital belly of occipitofrontalis", "belly"),
    "Adductor magnus": ("adductor_magnus", "adductor_magnus_main_part", "Main part of adductor magnus", "portion"),
    "Extensor digitorum longus": ("extensor_digitorum_longus", "extensor_digitorum_longus_belly", "Belly of extensor digitorum longus", "belly"),
    "Tensor fasciae latae": ("tensor_fasciae_latae", "tensor_fasciae_latae_belly", "Belly of tensor fasciae latae", "belly"),
    "Palmaris longus muscle": ("palmaris_longus", "palmaris_longus_belly", "Belly of palmaris longus", "belly"),
    "Superior rectus muscle": ("superior_rectus", "superior_rectus_belly", "Belly of superior rectus", "belly"),
}

# Ligaments modelled with the muscles.
LIGAMENT_OVERRIDE = {"Inguinal ligament"}

# Structures the anatomy has but the source lacks (session P report). Only the
# two that patches refer to get an ID (meshAvailable: false); the rest are
# recorded here for the record and for later milestones.
MISSING_WITH_ID = {
    "patellar_ligament": dict(name="Patellar ligament", kind="ligament", layer="ligaments", paired=True,
                              group=["joints_free_lower_limb", "knee_joint"],
                              reason="no mesh in the source; collection 2 has patches for both its ends"),
    "articularis_genus": dict(name="Articularis genus", kind="muscle", layer="muscles", paired=True,
                              group=["muscles_lower_limb", "anterior_compartment_thigh"],
                              reason="no mesh in the source; collection 2 has its origin patches"),
}
MISSING_RECORD = [
    ("Quadriceps tendon", "ligaments/muscles", "no mesh; collection 2 has the quadriceps insertion patch on the patella"),
    ("Articular cartilage of every synovial joint", "cartilage", "not modelled in the source; user decision 2026-11-20: go on without it"),
    ("Transverse ligament of atlas (cruciform ligament)", "ligaments", "craniovertebral ligaments absent from the source"),
    ("Alar ligaments", "ligaments", "craniovertebral ligaments absent from the source"),
    ("Apical ligament of dens", "ligaments", "craniovertebral ligaments absent from the source"),
    ("Tectorial membrane", "ligaments", "craniovertebral ligaments absent from the source"),
    ("Anterior and posterior atlanto-occipital membranes", "ligaments", "craniovertebral ligaments absent from the source"),
    ("Anterior tibiotalar ligament (part of the deltoid ligament)", "ligaments", "the source has the other three parts only"),
    ("Stapedius, tensor tympani", "muscles", "group 'Muscles of auditory ossicles' is empty"),
    ("Auricular muscles", "muscles", "both auricular groups are empty"),
    ("Muscles of the soft palate other than palatopharyngeus", "muscles", "absent"),
    ("Styloglossus, palatoglossus", "muscles", "absent"),
    ("Subcostales", "muscles", "absent"),
    ("Psoas minor", "muscles", "absent (inconstant in the body too)"),
    ("Perineal muscles other than the external anal sphincter", "muscles", "absent"),
]

# Patch muscle names that are groups, not one muscle (session Q, QUESTIONS.md).
PATCH_GROUPS = {
    "Quadriceps femoris muscle": ["rectus_femoris", "vastus_lateralis", "vastus_medialis", "vastus_intermedius"],
    "Triceps surae muscle": ["gastrocnemius", "soleus"],
    "Iliopsoas muscle": ["iliacus", "psoas_major"],
    "Erector spinae": ["iliocostalis_lumborum", "longissimus_thoracis", "spinalis_thoracis"],
    "Common extensor tendon": ["extensor_carpi_radialis_brevis", "extensor_digitorum", "extensor_digiti_minimi",
                               "extensor_carpi_ulnaris_humeral_head"],
    "Common flexor tendon": ["pronator_teres_superficial_head", "flexor_carpi_radialis", "palmaris_longus",
                             "flexor_digitorum_superficialis_humero_ulnar_head", "flexor_carpi_ulnaris_humeral_head"],
    "Levator ani": ["pubococcygeus", "iliococcygeus", "pubo_analis"],
    "Trochanteric insertion": [],  # ambiguous; QUESTIONS.md
}
PATCH_TARGET = {
    "Patellar ligament": "patellar_ligament",
    "Articularis genus muscle": "articularis_genus",
}
PATCH_EXCLUDE = {
    "Rectus abdominis muscle.el": "misplaced: 144 mm from any bone or cartilage",
    "Rectus abdominis muscle.er": "misplaced: 144 mm from any bone or cartilage",
}
PATCH_FLAGS = {
    "Rectus abdominis muscle": "origin patches lie on the costal cartilages, where the muscle inserts: labels look swapped",
}
PATCH_FAR_OK_M = 0.02  # patches spanning two bones and a membrane are kept (report, step 2)

# Muscles the source models as one mesh although anatomy names divisions.
SINGLE_MESH_NOTES = {
    "sternocleidomastoid": "single mesh; sternal and clavicular heads not separated in the source",
    "omohyoid": "single mesh; superior and inferior bellies not separated in the source",
    "medial_pterygoid": "single mesh; deep and superficial heads not separated in the source",
    "rectus_femoris": "single mesh; straight and reflected heads not separated in the source",
    "flexor_digitorum_profundus": "single mesh for all four tendons",
    "dorsal_interossei_hand": "one mesh for the four dorsal interossei of the hand",
    "palmar_interossei": "one mesh for the palmar interossei",
    "dorsal_interossei_foot": "one mesh for the four dorsal interossei of the foot",
    "plantar_interossei": "one mesh for the three plantar interossei",
    "lumbrical_hand": "one mesh for the four lumbricals of the hand",
    "lumbrical_foot": "one mesh for the four lumbricals of the foot",
    "external_intercostal": "one mesh for all external intercostals of one side",
    "internal_intercostal": "one mesh for all internal intercostals of one side",
    "innermost_intercostal": "one mesh for all innermost intercostals of one side",
    "rotatores": "one mesh for all rotatores of one side",
}


# --- build ---------------------------------------------------------------

def side_of(o: dict) -> tuple[str, str | None]:
    """(side, note) from the name, corrected from the geometry."""
    sn, sc = o["sideFromName"], o["sideFromCentroid"]
    if sn and sc != "midline" and sc != sn:
        return sc, f"source name says {sn}, geometry says {sc}: side taken from geometry"
    if sn:
        return sn, None
    if sc == "midline" or o["crossesMidline"]:
        return "midline", None
    return sc, f"source name has no side suffix; {sc} from geometry"


def group_of(o: dict, drop_self: str | None = None) -> list[str]:
    chain = [g for g in reversed(o["parentChain"]) if g.endswith(".g")]
    chain = [g for g in chain if g not in ("Muscular system.g", "Joints.g", "Skeletal system.g")]
    keys = [snake(g[:-2]) for g in chain]
    if drop_self:
        keys = [k for k in keys if k != drop_self]
    return keys


def main() -> int:
    audit = json.loads(AUDIT.read_text())["objects"]
    bone_ids = {e["id"] for e in json.loads(BONES.read_text())}
    bone_of_source = {n: i for i, ns in json.loads((ROOT / "assets/mapping/source-to-id.json").read_text())["map"].items() for n in ns}

    entries: dict[str, dict] = {}       # id → soft-ids entry
    mapping: dict[str, list[str]] = {}  # id → source names
    merged: dict[str, dict] = {}
    excluded: dict[str, str] = {}
    notes: dict[str, list[str]] = collections.defaultdict(list)
    used: collections.Counter = collections.Counter()
    source_to_id: dict[str, str] = {}

    def add(id_: str, entry: dict, sources: list[str]) -> None:
        if id_ in entries:
            fail(f"duplicate ID {id_} ({sources} and {mapping.get(id_)})")
        if id_ in bone_ids:
            fail(f"ID {id_} collides with a bone ID")
        entries[id_] = {"id": id_, **entry}
        if sources:
            mapping[id_] = sources
            for s in sources:
                used[s] += 1
                source_to_id[s] = id_

    def ensure_parent(pid: str, side: str, name: str, group: list[str]) -> str:
        full = sided(pid, side)
        if full not in entries:
            add(full, {"name": name, "latin": None, "kind": "muscle", "layer": "muscles", "side": side,
                       "group": group, "parts": [], "meshAvailable": False}, [])
        return full

    soft = [o for o in audit if not o["root"].startswith("2")]
    patches = [o for o in audit if o["root"].startswith("2")]
    nuclei = []

    for o in soft:
        name, c = o["name"], o["classification"]
        b = base(name)
        cls = c["class"]
        override = DOUBTFUL.get(b)
        if cls == "doubtful" and not override:
            fail(f"doubtful mesh without a decision: {name}")
            continue
        if override:
            cls, extra = override
            if cls == "excluded":
                excluded[name] = extra
                used[name] += 1
                continue
        if cls == "excluded":
            excluded[name] = c["reason"]
            used[name] += 1
            continue
        if cls == "fragment":
            fail(f"fragment without a merge rule: {name}")
            continue
        side, side_note = side_of(o)
        layer = c.get("layer")
        if b in LIGAMENT_OVERRIDE:
            layer = "ligaments"

        if b.lower().startswith("nucleus pulposus"):
            nuclei.append(o)
            continue

        inconstant = c.get("inconstant", False)
        common = {"latin": None, "side": side}
        if inconstant:
            common["inconstant"] = True

        # --- muscle parts --------------------------------------------------
        if layer == "muscles" and (cls == "part" or b in WHOLE_TO_PART or (override and cls == "part")):
            if override and cls == "part":
                pkey, pid_base, pname, ptype = extra["parent"], extra["id"], b, extra["partType"]
                also = extra.get("alsoServes", [])
            elif b in WHOLE_TO_PART:
                pkey, pid_base, pname, ptype = WHOLE_TO_PART[b]
                also = []
            else:
                pkey = c["partOf"]
                ptype = c["partType"]
                if b in PART_IDS:
                    pid_base, pname = PART_IDS[b]
                else:
                    m = re.match(r"^(?P<what>.+?) (?P<t>head|part|parts|belly) of ", b)
                    pid_base = f"{PARENTS[pkey][0]}_{snake(m['what'])}_{snake(m['t'])}"
                    pname = display(b)
                also = ALSO_SERVES.get(b, [])
            if pkey not in PARENTS:
                fail(f"part {name}: unknown parent {pkey!r}")
                continue
            parent_id, parent_name = PARENTS[pkey]
            grp = group_of(o, drop_self=parent_id)
            parent_full = ensure_parent(parent_id, side, parent_name, grp)
            pid = sided(pid_base, side)
            add(pid, {"name": pname, **common, "kind": "muscle_part", "layer": "muscles", "group": grp,
                      "parent": parent_full, "partType": ptype,
                      "alsoServes": [sided(a, side) for a in also], "meshAvailable": True}, [name])
            entries[parent_full]["parts"].append(pid)
        # --- whole structures ------------------------------------------------
        else:
            if layer == "muscles":
                kind = "muscle"
            elif layer == "ligaments":
                kind = "ligament"
            else:
                kind = (extra.get("kind") if override else None) or c.get("kind") or "cartilage"
                layer = (extra.get("layer") if override else None) or layer
            nm = b
            if b.lower().startswith("costal cartilage of "):
                n = ORD.index(b.split()[3]) + 1
                id_base, nm = f"costal_cartilage_{n}", f"Costal cartilage of rib {n}"
            else:
                id_base = snake(b)
            if kind == "ligament" and cls == "part":
                pm = re.match(r"^(?P<what>.+?) parts? of (?P<lig>.+)$", b)
                id_base = f"{snake(pm['lig'])}_{snake(pm['what'])}_part"
                notes[sided(id_base, side)].append(
                    f"a named part of the {c['partOf'].lower()}; kept as its own ligament (spec parts are muscle-only)")
            mid = sided(id_base, side)
            add(mid, {"name": display(nm), **common, "kind": kind, "layer": layer,
                      "group": group_of(o), "meshAvailable": True}, [name])
            if kind == "muscle" and id_base in SINGLE_MESH_NOTES:
                notes[mid].append(SINGLE_MESH_NOTES[id_base])
        if side_note:
            notes[source_to_id.get(name, name)].append(side_note)

    # nucleus pulposus → merged into its disc
    for o in nuclei:
        level = base(o["name"]).split(" ", 2)[2]
        disc = "intervertebral_disc_" + snake(level)
        if disc not in entries:
            fail(f"{o['name']}: no disc {disc}")
            continue
        mapping[disc].append(o["name"])
        used[o["name"]] += 1
        merged[disc] = {"sources": mapping[disc][:], "reason": "the nucleus pulposus is the disc's inner part and lies inside it; one structure"}

    # missing structures with an ID
    for mid_, m in MISSING_WITH_ID.items():
        for side in (["left", "right"] if m["paired"] else ["midline"]):
            add(sided(mid_, side), {"name": m["name"], "latin": None, "side": side, "kind": m["kind"],
                                    "layer": m["layer"], "group": m["group"], "meshAvailable": False}, [])
    missing = {sided(k, s): v["reason"] for k, v in MISSING_WITH_ID.items() for s in ("left", "right")}

    # --- attachment patches -------------------------------------------------
    cart_id = {n: i for n, i in source_to_id.items() if entries.get(i, {}).get("layer") == "cartilage"}
    base_to_ids: dict[str, list[str]] = collections.defaultdict(list)
    for s, i in source_to_id.items():
        base_to_ids[base(s).lower()].append(i)
    parent_by_key = {k.lower(): v[0] for k, v in PARENTS.items()}

    def strip_side(i: str) -> str:
        return re.sub(r"_(left|right)$", "", i)

    attachments: dict[str, dict] = {}
    att_excluded: dict[str, str] = {}
    keys = collections.Counter()
    for p in sorted(patches, key=lambda p: p["name"]):
        a = p["attachment"]
        nm, mname = p["name"], a["muscleName"]
        used[nm] += 1
        if nm in PATCH_EXCLUDE:
            att_excluded[nm] = PATCH_EXCLUDE[nm]
            continue
        near = a["nearest"]
        on = near["id"] or cart_id.get(near["source"])
        if on is None:
            att_excluded[nm] = f"lies on {near['source']}, which is excluded"
            continue
        if near["median"] > PATCH_FAR_OK_M:
            att_excluded[nm] = f"{near['median'] * 1000:.0f} mm from any bone"
            continue
        side = p["sideFromCentroid"]
        if side == "midline":
            # On the midline: one patch for both sides if it crosses it, else the named side.
            side = "midline" if p["crossesMidline"] else (a["side"] or "midline")
        key = mname.strip("()")
        muscles: list[str] = []
        if key in PATCH_GROUPS:
            target = snake(key)
            muscles = PATCH_GROUPS[key]
        elif key in PATCH_TARGET:
            target = PATCH_TARGET[key]
            muscles = [target]
        else:
            ids = base_to_ids.get(key.lower())
            if ids:
                target = strip_side(ids[0])
            elif snake(key) in {strip_side(e) for e in entries} :
                target = snake(key)
            elif norm := re.sub(r"\s+muscles?$", "", key.lower()):
                if norm in parent_by_key:
                    target = parent_by_key[norm]
                elif snake(norm) in {strip_side(e) for e in entries}:
                    target = snake(norm)
                else:
                    fail(f"patch {nm}: no structure for {mname!r}")
                    continue
            muscles = [target]
        if key in PATCH_GROUPS or sided(target, side) in entries:
            tid = sided(target, side)
        elif target in entries:
            tid = target  # a midline muscle (diaphragm, transverse arytenoid)
        else:
            fail(f"patch {nm}: target {target} ({side}) is not an ID")
            continue
        midline_target = tid == target and entries.get(target, {}).get("side") == "midline"
        k = (tid, a["end"], side if midline_target else None)
        keys[k] += 1
        n = keys[k]
        aid = f"{tid}__{a['end']}" + (f"_{side}" if midline_target else "") + (f"_{n}" if n > 1 else "")
        def resolve(m: str) -> list[str]:
            if entries.get(m, {}).get("side") == "midline":
                return [m]
            if side == "midline":
                return [sided(m, "left"), sided(m, "right")]
            return [sided(m, side)]
        if side == "midline" and tid != target:
            tid = target
        entry = {"source": nm, "structures": [x for m in muscles for x in resolve(m)],
                 "end": a["end"], "side": side, "on": on}
        if key in PATCH_GROUPS:
            entry["group"] = key
        if mname in PATCH_FLAGS or key in PATCH_FLAGS:
            entry["flag"] = PATCH_FLAGS.get(mname) or PATCH_FLAGS[key]
        if near["median"] >= 0.001:
            entry["flag"] = (entry.get("flag", "") + "; " if entry.get("flag") else "") + \
                f"{near['median'] * 1000:.1f} mm from the nearest bone (spans two bones or several cartilages)"
        attachments[aid] = entry
        for s in entry["structures"]:
            if s not in entries:
                fail(f"patch {nm}: structure {s} is not an ID")

    # missing left/right twins of patches
    att_missing = []
    sig = collections.Counter()
    for e in attachments.values():
        sig[(re.sub(r"_(left|right)", "", e["source"].rsplit(".", 1)[0]), e["end"],
             tuple(sorted(strip_side(s) for s in e["structures"])), e["side"])] += 1
    for (src, end, structs, side), n in sig.items():
        if side not in ("left", "right"):
            continue
        other = "right" if side == "left" else "left"
        m = sig.get((src, end, structs, other), 0)
        if m < n:
            att_missing.append({"muscle": src, "end": end, "side": other, "count": n - m,
                                "reason": "the source has the other side only (its patch is misnamed); not mirrored"})

    # --- checks ---------------------------------------------------------------
    names = {o["name"] for o in audit}
    for n in names:
        if used[n] != 1:
            fail(f"{n} used {used[n]} times")
    for e in entries.values():
        if e["kind"] == "muscle_part":
            par = entries.get(e["parent"])
            if not par or par["kind"] != "muscle" or e["id"] not in par["parts"]:
                fail(f"part {e['id']} has a bad parent {e['parent']}")
            for s in e["alsoServes"]:
                if s not in entries:
                    fail(f"{e['id']}: alsoServes {s} is not an ID")
        if e["kind"] == "muscle" and e.get("parts") == [] and not e["meshAvailable"] and e["id"] not in missing:
            fail(f"muscle {e['id']} has neither a mesh nor parts")
        if e.get("parts"):
            for p in e["parts"]:
                if not entries[p]["meshAvailable"]:
                    fail(f"{p} (part of {e['id']}) has no mesh")
        if e["side"] != "midline" and not e["id"].endswith("_" + e["side"]):
            fail(f"{e['id']}: side suffix")
        if not re.fullmatch(r"[a-z][a-z0-9]*(_[a-z0-9]+)*", e["id"]):
            fail(f"bad ID {e['id']}")
    ids = set(entries)
    for i in ids:
        m = re.match(r"^(.*)_(left|right)$", i)
        if m and entries[i]["side"] != "midline":
            twin = f"{m[1]}_{'right' if m[2] == 'left' else 'left'}"
            if twin not in ids:
                fail(f"{i} has no twin {twin}")

    if errors:
        for e in errors:
            print("ERROR:", e, file=sys.stderr)
        return 1

    # --- write ----------------------------------------------------------------
    def natural(i: str) -> tuple:
        # vertebral levels c < t < l < s, numbers numerically, left before right
        i = i.replace("_right", "_~")
        out = []
        for tok in re.findall(r"[a-z~]+|\d+", i):
            if tok.isdigit():
                out.append((1, int(tok), ""))
            else:
                out.append((0, 0, tok))
        lvl = re.findall(r"_([ctls])(\d+)", i)
        return (tuple(("ctls".index(a), int(b)) for a, b in lvl), tuple(out))

    def order(e: dict) -> tuple:
        return (LAYER_ORDER[e["layer"]], e["group"], natural(e.get("parent") or e["id"]),
                e["kind"] == "muscle_part", natural(e["id"]))

    out = []
    for e in sorted(entries.values(), key=order):
        r = {k: e[k] for k in ("id", "name", "latin", "kind", "layer", "side", "group")}
        if e["kind"] == "muscle_part":
            r.update(parent=e["parent"], partType=e["partType"])
            if e["alsoServes"]:
                r["alsoServes"] = e["alsoServes"]
        if e.get("parts"):
            r["parts"] = e["parts"]
        if e.get("inconstant"):
            r["inconstant"] = True
        r["meshAvailable"] = e["meshAvailable"]
        out.append(r)
    IDS_OUT.write_text("[\n" + ",\n".join("  " + json.dumps(r, ensure_ascii=False) for r in out) + "\n]\n")

    doc = {
        "source": "Z-Anatomy Startup.blend, commit 71919ee: collections 1 (cartilage), 2, 3, 4",
        "notes": ("Generated by scripts/mapping/generate_soft_ids.py from assets/audit/soft-tissue.json. "
                  "map: ID -> source objects to join (nucleus pulposus joined into its disc, see merged). "
                  "attachments: muscular-insertion patches (plan decision 12), keyed "
                  "<structure or group id>__origin|insertion[_side][_n]; 'structures' are the muscles or "
                  "parts the patch belongs to; 'on' is the bone or cartilage it lies on. Sides come from "
                  "geometry. Patch ends are the source's labels: content (M8) decides origin and insertion."),
        "map": {i: mapping[i] for i in sorted(mapping)},
        "merged": merged,
        "missing": missing,
        "missingNoId": [{"structure": s, "layer": l, "reason": r} for s, l, r in MISSING_RECORD],
        "excluded": dict(sorted({**excluded, **att_excluded}.items())),
        "attachments": dict(sorted(attachments.items())),
        "attachmentsMissing": sorted(att_missing, key=lambda x: (x["muscle"], x["end"])),
        "notes": {k: "; ".join(v) for k, v in sorted(notes.items())},
    }
    MAP_OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")

    cnt = collections.Counter((e["layer"], e["kind"], e["meshAvailable"]) for e in out)
    print(f"wrote {len(out)} IDs to {IDS_OUT.relative_to(ROOT)}; {len(attachments)} attachment patches")
    for k, v in sorted(cnt.items()):
        print(f"  {k}: {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
