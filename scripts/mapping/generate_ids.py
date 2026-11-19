"""Generate content/ids.json and assets/mapping/source-to-id.json.

Usage: python3 scripts/mapping/generate_ids.py
Reads assets/audit/z-anatomy.json and fails if any mapped source object is
missing, if any audited object is neither mapped nor explicitly excluded, or
if a side suffix disagrees with the mesh position (patient right = -X in the
Z-Anatomy file, which faces -Y).
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
AUDIT = ROOT / "assets/audit/z-anatomy.json"
IDS_OUT = ROOT / "content/ids.json"
MAP_OUT = ROOT / "assets/mapping/source-to-id.json"

SIDES = {"left": "l", "right": "r"}
ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh",
       "eighth", "ninth", "tenth", "eleventh", "twelfth"]

entries = []  # (id, name, kind, side, group, [source objects])


def mid(id_, name, group, sources=None):
    entries.append((id_, name, "bone", "midline", group, sources or [name]))


def pair(base, name, group, source=None, kind="bone"):
    for side, s in SIDES.items():
        entries.append((f"{base}_{side}", name, kind, side, group, [f"{source or name}.{s}"]))


# --- Axial: skull ---------------------------------------------------------
CRAN = ["axial", "skull", "cranial"]
FACE = ["axial", "skull", "facial"]
mid("frontal_bone", "Frontal bone", CRAN)
pair("parietal_bone", "Parietal bone", CRAN)
mid("occipital_bone", "Occipital bone", CRAN)
pair("temporal_bone", "Temporal bone", CRAN)
mid("sphenoid_bone", "Sphenoid bone", CRAN)
mid("ethmoid_bone", "Ethmoid bone", CRAN)
pair("maxilla", "Maxilla", FACE)
pair("zygomatic_bone", "Zygomatic bone", FACE)
pair("nasal_bone", "Nasal bone", FACE)
pair("lacrimal_bone", "Lacrimal bone", FACE)
pair("palatine_bone", "Palatine bone", FACE)
pair("inferior_nasal_concha", "Inferior nasal concha", FACE, "Inferior nasal concha bone")
mid("vomer", "Vomer", FACE)
mid("mandible", "Mandible", FACE)
OSS = ["axial", "skull", "ossicles"]
pair("malleus", "Malleus", OSS)
pair("incus", "Incus", OSS)
pair("stapes", "Stapes", OSS)
mid("hyoid_bone", "Hyoid bone", ["axial", "skull", "hyoid"], ["Hyoid bone"])

# --- Axial: vertebral column ---------------------------------------------
for i in range(1, 8):
    src = {1: "Atlas (C1)", 2: "Axis (C2)"}.get(i, f"Vertebra C{i}")
    name = {1: "Atlas (C1)", 2: "Axis (C2)"}.get(i, f"C{i} vertebra")
    mid(f"vertebra_c{i}", name, ["axial", "vertebral_column", "cervical"], [src])
for i in range(1, 13):
    mid(f"vertebra_t{i}", f"T{i} vertebra", ["axial", "vertebral_column", "thoracic"], [f"Vertebra T{i}"])
for i in range(1, 6):
    mid(f"vertebra_l{i}", f"L{i} vertebra", ["axial", "vertebral_column", "lumbar"], [f"Vertebra L{i}"])
mid("sacrum", "Sacrum", ["axial", "vertebral_column", "sacrococcygeal"])
mid("coccyx", "Coccyx", ["axial", "vertebral_column", "sacrococcygeal"])

# --- Axial: thorax --------------------------------------------------------
# The sternum is one bone in the 206 count; the source splits it in three.
mid("sternum", "Sternum", ["axial", "thorax"],
    ["Manubrium of sternum", "Body of sternum", "Xiphoid process"])
for i in range(1, 13):
    pair(f"rib_{i}", f"Rib {i}", ["axial", "thorax", "ribs"], f"{ORD[i-1].capitalize()} rib")

# --- Appendicular: upper limb --------------------------------------------
PEC = ["appendicular", "pectoral_girdle"]
ARM = ["appendicular", "upper_limb"]
CARP = ["appendicular", "upper_limb", "carpals"]
MC = ["appendicular", "upper_limb", "metacarpals"]
PH_H = ["appendicular", "upper_limb", "phalanges"]
pair("clavicle", "Clavicle", PEC)
pair("scapula", "Scapula", PEC)
pair("humerus", "Humerus", ARM)
pair("radius", "Radius", ARM)
pair("ulna", "Ulna", ARM)
for b in ["Scaphoid", "Lunate", "Triquetrum", "Pisiform", "Trapezium", "Trapezoid", "Capitate", "Hamate"]:
    pair(b.lower(), b, CARP, f"{b} bone")
for i in range(1, 6):
    pair(f"metacarpal_{i}", f"Metacarpal {i}", MC, f"{ORD[i-1].capitalize()} metacarpal bone")
for kind_ in ["proximal", "middle", "distal"]:
    for i in range(1, 6):
        if kind_ == "middle" and i == 1:
            continue  # the thumb has no middle phalanx
        pair(f"{kind_}_phalanx_hand_{i}", f"{kind_.capitalize()} phalanx of hand, digit {i}", PH_H,
             f"{kind_.capitalize()} phalanx of {ORD[i-1]} finger of hand")

# --- Appendicular: lower limb --------------------------------------------
PEL = ["appendicular", "pelvic_girdle"]
LEG = ["appendicular", "lower_limb"]
TARS = ["appendicular", "lower_limb", "tarsals"]
MT = ["appendicular", "lower_limb", "metatarsals"]
PH_F = ["appendicular", "lower_limb", "phalanges"]
pair("hip_bone", "Hip bone", PEL)
pair("femur", "Femur", LEG)
pair("patella", "Patella", LEG)
pair("tibia", "Tibia", LEG)
pair("fibula", "Fibula", LEG)
pair("talus", "Talus", TARS)
pair("calcaneus", "Calcaneus", TARS)
pair("navicular", "Navicular", TARS, "Navicular bone")
pair("cuboid", "Cuboid", TARS, "Cuboid bone")
for c in ["Medial", "Intermediate", "Lateral"]:
    pair(f"{c.lower()}_cuneiform", f"{c} cuneiform", TARS, f"{c} cuneiform bone")
for i in range(1, 6):
    pair(f"metatarsal_{i}", f"Metatarsal {i}", MT, f"{ORD[i-1].capitalize()} metatarsal bone")
for kind_ in ["proximal", "middle", "distal"]:
    for i in range(1, 6):
        if kind_ == "middle" and i == 1:
            continue  # the hallux has no middle phalanx
        pair(f"{kind_}_phalanx_foot_{i}", f"{kind_.capitalize()} phalanx of foot, digit {i}", PH_F,
             f"{kind_.capitalize()} phalanx of {ORD[i-1]} finger of foot")

# --- Dentition (FDI) ------------------------------------------------------
QUAD = {1: ("upper", "right", "r"), 2: ("upper", "left", "l"),
        3: ("lower", "left", "l"), 4: ("lower", "right", "r")}
POS = {1: ("Central incisor", "medial incisor", "incisors"),
       2: ("Lateral incisor", "lateral incisor", "incisors"),
       3: ("Canine", "canine", "canines"),
       4: ("First premolar", "first premolar", "premolars"),
       5: ("Second premolar", "second premolar", "premolars"),
       6: ("First molar", "first molar tooth", "molars"),
       7: ("Second molar", "second molar tooth", "molars"),
       8: ("Third molar", None, "molars")}
for q, (jaw, side, s) in QUAD.items():
    for p, (name, src, tgroup) in POS.items():
        sources = [f"{jaw.capitalize()} {src}.{s}"] if src else []
        entries.append((f"tooth_{q}{p}", f"{jaw.capitalize()} {side} {name.lower()}", "tooth", side,
                        ["dentition", jaw, side, tgroup], sources))

EXCLUDED = {
    "Skeletal system.g": "Collection helper / label backdrop, not anatomy",
    "Sinus of frontal bone": "Air sinus volume, not bone (scope: bones and teeth only)",
    "Sinus of sphenoid bone": "Air sinus volume, not bone",
    "Anterior cells of ethmoid bone.l": "Ethmoid air-cell volume (hidden from render in source)",
    "Anterior cells of ethmoid bone.r": "Ethmoid air-cell volume (hidden from render in source)",
    "Middle cells of ethmoid bone.l": "Ethmoid air-cell volume (hidden from render in source)",
    "Middle cells of ethmoid bone.r": "Ethmoid air-cell volume (hidden from render in source)",
    "Posterior cells of ethmoid bone.l": "Ethmoid air-cell volume (hidden from render in source)",
    "Posterior cells of ethmoid bone.r": "Ethmoid air-cell volume (hidden from render in source)",
    "Sesamoid bones of foot.l": "Hallux sesamoids are not counted in the standard 206",
    "Sesamoid bones of foot.r": "Hallux sesamoids are not counted in the standard 206",
}
CARTILAGE_PREFIXES = ("Costal cartilage", "Major alar cartilage", "Lateral process of nasal septal cartilage",
                      "Nasal septal cartilage", "Thyroid cartilage", "Cricoid cartilage",
                      "Arytenoid cartilage", "Corniculate cartilage")

MISSING = {f"tooth_{q}8": "Third molar has no mesh in Z-Anatomy (no third molars anywhere in the source file)"
           for q in QUAD}


def main():
    audit = {o["name"]: o for o in json.loads(AUDIT.read_text())["objects"]}
    errors = []
    ids = [e[0] for e in entries]
    if len(ids) != len(set(ids)):
        errors.append("duplicate ids")
    used = set()
    for id_, _, _, side, _, sources in entries:
        for src in sources:
            if src not in audit:
                errors.append(f"{id_}: source object '{src}' not found in audit")
                continue
            if src in used:
                errors.append(f"{src} mapped twice")
            used.add(src)
            cx = audit[src]["centroid"][0]
            if side == "right" and cx >= 0 or side == "left" and cx <= 0:
                errors.append(f"{id_}: side '{side}' disagrees with centroid x={cx}")
        if not sources and id_ not in MISSING:
            errors.append(f"{id_}: no source and not listed as missing")
    for name in audit:
        if name in used or name in EXCLUDED:
            continue
        if name.startswith(CARTILAGE_PREFIXES):
            EXCLUDED[name] = "Cartilage (out of scope per spec §1)"
            continue
        errors.append(f"audited object '{name}' is neither mapped nor excluded")
    bones = sum(1 for e in entries if e[2] == "bone")
    teeth = sum(1 for e in entries if e[2] == "tooth")
    if (bones, teeth) != (206, 32):
        errors.append(f"expected 206 bones + 32 teeth, got {bones} + {teeth}")
    if errors:
        print("\n".join(errors))
        sys.exit(1)

    IDS_OUT.write_text(json.dumps([
        {"id": i, "name": n, "kind": k, "side": s, "group": g, "meshAvailable": bool(src)}
        for i, n, k, s, g, src in entries], indent=1) + "\n")
    MAP_OUT.write_text(json.dumps({
        "source": "Z-Anatomy Startup.blend, collection '1: Skeletal system'",
        "notes": "Keys are stable IDs; values are the source object names joined to form that object.",
        "map": {i: src for i, _, _, _, _, src in entries if src},
        "missing": MISSING,
        "excluded": dict(sorted(EXCLUDED.items())),
    }, indent=1) + "\n")
    print(f"ok: {bones} bones + {teeth} teeth = {len(entries)} ids; "
          f"{len(entries) - len(MISSING)} with meshes, {len(MISSING)} missing; {len(EXCLUDED)} source objects excluded")


main()
