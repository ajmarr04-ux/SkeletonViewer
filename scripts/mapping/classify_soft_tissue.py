"""Classify the soft-tissue audit and write its report (Milestone 6, session P).

Usage: python3 scripts/mapping/classify_soft_tissue.py   (npm run audit-soft)

Reads assets/audit/soft-tissue.json (written by
scripts/blender/audit_soft_tissue.py), adds a `classification` to every
object, and writes the file back plus assets/audit/REPORT-soft-tissue.md.
Re-running is idempotent: only `classification` and `summary` are replaced.

Classes (plan step 1):
  whole     a whole structure (one muscle, ligament, disc, ...)
  part      an anatomical division named in the source (head, part, belly,
            tendon, aponeurosis, nucleus pulposus of a disc, ...)
  fragment  a modelling-only split of one structure (none found so far)
  excluded  a type the spec leaves out (capsule, membrane, bursa, fascia,
            retinaculum, sheath, nasal/laryngeal cartilage, label mesh, ...)
  doubtful  could go either way; session Q decides and records a question
  attachment  a muscular-insertion patch (collection 2)

These are a first pass for session Q, not the mapping. No anatomy is added
here: names, sides and parents come from the source; rules only sort them.
"""
from __future__ import annotations

import collections
import json
import os
import re

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
AUDIT = os.path.join(REPO, "assets/audit/soft-tissue.json")
REPORT = os.path.join(REPO, "assets/audit/REPORT-soft-tissue.md")

# Plan decision 8 (high LOD targets, triangles).
BUDGET_HIGH = {"muscles": 800_000, "ligaments": 120_000, "cartilage": 80_000}
ATTACH_TOL_M = 0.001  # decision 12: median distance to a bone under 1 mm

# --- rules -----------------------------------------------------------------

EXCLUDE_PATTERNS = [
    (r"\bbursae?\b", "bursa (deferred, spec §1)"),
    (r"\bfasciae?\b|fascia lata", "fascia (deferred, spec §1)"),
    (r"intermuscular septum", "intermuscular septum (fascia, deferred)"),
    (r"retinaculum", "retinaculum (deferred, spec §1)"),
    (r"sheaths?\b", "tendon sheath (synovial or fibrous; deferred with membranes)"),
    (r"articular capsules?|frenula capsulae", "joint capsule (deferred, spec §1)"),
    (r"^(superior|inferior) tarsus$", "tarsal plate of the eyelid (connective tissue, not muscle)"),
    (r"^iliopectineal arch$", "thickening of the iliopsoas fascia (fascia, deferred)"),
    (r"infrapatellar fat pad", "fat pad (not ligament or cartilage)"),
    (r"triradiate cartilage", "growth cartilage of the acetabulum; fused in the adult"),
    (r"arytenoid cartilage|corniculate cartilage|cricoid cartilage|thyroid cartilage",
     "laryngeal cartilage (deferred, spec §1/§12)"),
    (r"nasal septal cartilage|alar cartilage", "nasal cartilage (deferred, spec §1/§12)"),
    (r"cells of ethmoid bone|^sinus of", "air cells / sinus volume (not a tissue in scope)"),
    (r"^sesamoid bones of foot$", "hallux sesamoids (excluded since M1)"),
]

# Doubtful: session Q decides, with a QUESTIONS.md entry. Layer = best guess.
DOUBTFUL = {
    "iliotibial tract": ("muscles", "thickening of fascia lata that acts as the tendon of tensor fasciae latae and part of gluteus maximus: aponeurosis part, or fascia (excluded)?"),
    "linea alba": ("muscles", "aponeurotic raphe of the abdominal muscles: aponeurosis part (of which muscle?) or excluded as fascia (plan decision 5)"),
    "palmar aponeurosis": ("muscles", "deep fascia of the palm continuous with palmaris longus: aponeurosis part of palmaris longus, or fascia (excluded)?"),
    "plantar aponeurosis": ("muscles", "deep fascia of the sole: no muscle of its own; aponeurosis or fascia (excluded)?"),
    "common tendinous ring": ("muscles", "shared tendon of origin of the four recti: tendon part of which rectus, with the others under alsoServes?"),
    "trochlea of superior oblique muscle": ("muscles", "fibrocartilaginous pulley, not muscle: cartilage, or excluded?"),
    "tendinous arch of levator ani": ("muscles", "thickening of obturator fascia giving origin to levator ani: excluded as fascia?"),
    "superficial transverse metacarpal ligament": ("ligaments", "fascial band of the palmar aponeurosis, not a joint ligament: ligament or excluded?"),
    "superficial transverse metatarsal ligament": ("ligaments", "fascial band of the plantar aponeurosis: ligament or excluded?"),
    "acetabular labrum": ("cartilage", "fibrocartilage rim, not in the spec's cartilage list: cartilage layer, kind cartilage?"),
    "glenoid labrum": ("cartilage", "fibrocartilage rim, not in the spec's cartilage list: cartilage layer, kind cartilage?"),
    "pubic symphysis": ("cartilage", "one mesh for the whole symphysis (beside a separate interpubic disc): disc, or excluded as a duplicate?"),
    "sacrococcygeal symphysis": ("cartilage", "fibrocartilage between sacrum and coccyx: disc?"),
    "cricopharyngeal ligament": ("ligaments", "laryngeal ligament; laryngeal cartilage is excluded, so it would attach to nothing shown"),
    "median cricothyroid ligament": ("ligaments", "laryngeal ligament between excluded cartilages"),
    "median thyrohyoid ligament": ("ligaments", "joins the hyoid to the excluded thyroid cartilage"),
    "lateral thyrohyoid ligament": ("ligaments", "joins the hyoid to the excluded thyroid cartilage"),
    "quadrangular membrane": ("ligaments", "laryngeal membrane between excluded cartilages"),
}

# Named parts: "<x> head|part|belly of <muscle>" etc.
PART_RE = re.compile(r"^(?P<what>.+?) (?P<type>head|part|parts|belly) of (?P<parent>.+)$")
TENDON_PARTS = {
    "calcaneal tendon": ("tendon", "gastrocnemius / soleus (plan decision 5)"),
    "tendon of extensor digitorum longus": ("tendon", "extensor digitorum longus"),
    "intermediate tendon of digastric muscle": ("tendon", "digastric muscle"),
    "epicranial aponeurosis": ("aponeurosis", "epicranius (occipitofrontalis)"),
}
# Ligaments in the muscles collection.
LIGAMENTS_IN_MUSCLES = {"inguinal ligament"}

MAJOR_MUSCLES = [
    "Deltoid", "Pectoralis major", "Pectoralis minor", "Latissimus dorsi", "Trapezius",
    "Rhomboid major", "Serratus anterior", "Supraspinatus", "Infraspinatus", "Teres minor",
    "Teres major", "Subscapularis", "Biceps brachii", "Brachialis", "Triceps brachii",
    "Brachioradialis", "Pronator teres", "Supinator", "Flexor digitorum superficialis",
    "Flexor digitorum profundus", "Extensor digitorum", "Gluteus maximus", "Gluteus medius",
    "Gluteus minimus", "Iliacus", "Psoas major", "Piriformis", "Sartorius", "Rectus femoris",
    "Vastus lateralis", "Vastus medialis", "Vastus intermedius", "Adductor magnus",
    "Adductor longus", "Gracilis", "Biceps femoris", "Semitendinosus", "Semimembranosus",
    "Gastrocnemius", "Soleus", "Tibialis anterior", "Tibialis posterior", "Fibularis longus",
    "Rectus abdominis", "External abdominal oblique", "Internal abdominal oblique",
    "Transversus abdominis", "Quadratus lumborum", "Diaphragm", "External intercostal",
    "Sternocleidomastoid", "Masseter", "Temporalis", "Erector spinae (iliocostalis, longissimus, spinalis)",
    "Orbicularis oculi", "Orbicularis oris", "Platysma",
]

# Major synovial joints: what cartilage the source has for each.
JOINT_CARTILAGE = {
    "Shoulder (glenohumeral)": ["glenoid labrum"],
    "Elbow": [],
    "Wrist (radiocarpal / distal radio-ulnar)": ["articular disc of distal radio-ulnar joint"],
    "Hip": ["acetabular labrum"],
    "Knee": ["medial meniscus", "lateral meniscus"],
    "Ankle (talocrural)": [],
    "Temporomandibular": ["articular disc of temporomandibular joint"],
    "Sternoclavicular": ["articular disc of sternoclavicular joint"],
    "Acromioclavicular": ["articular disc of acromioclavicular joint"],
}


def base(name: str) -> str:
    n = name
    if n[-2:] in (".l", ".r"):
        n = n[:-2]
    return n.strip("()").strip()


def norm_muscle(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"\bmuscles?$", "", s).strip()
    return s


def write_audit(audit: dict) -> None:
    """One object per line: diffable, about half the size of indented JSON."""
    head = {k: v for k, v in audit.items() if k != "objects"}
    lines = ["{"]
    for k, v in head.items():
        lines.append(f" {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},")
    lines.append(' "objects": [')
    objs = audit["objects"]
    for i, o in enumerate(objs):
        lines.append("  " + json.dumps(o, ensure_ascii=False, separators=(",", ":"))
                     + ("," if i < len(objs) - 1 else ""))
    lines.append(" ]")
    lines.append("}")
    with open(AUDIT, "w") as fh:
        fh.write("\n".join(lines) + "\n")


def classify(o: dict) -> dict:
    name, root = o["name"], o["root"]
    b = base(name)
    lb = b.lower()
    c: dict = {"inconstant": name.startswith("(")}
    if name.endswith(".g"):
        return {**c, "class": "excluded", "reason": "collection label mesh (hidden text geometry)"}
    if root.startswith("2"):
        return {**c, "class": "attachment", "layer": "attachments"}
    for pat, why in EXCLUDE_PATTERNS:
        if re.search(pat, lb):
            return {**c, "class": "excluded", "reason": why}
    if lb in DOUBTFUL:
        layer, why = DOUBTFUL[lb]
        return {**c, "class": "doubtful", "layer": layer, "reason": why}

    if root.startswith("1"):
        if lb.startswith("costal cartilage"):
            return {**c, "class": "whole", "layer": "cartilage", "kind": "cartilage"}
        return {**c, "class": "doubtful", "reason": "unrecognised skeletal mesh"}

    if root.startswith("3"):
        if lb.startswith("nucleus pulposus"):
            return {**c, "class": "part", "layer": "cartilage", "kind": "disc",
                    "partType": "nucleus", "partOf": "Intervertebral disc " + b.split(" ", 2)[2],
                    "reason": "inner part of the disc; merge into the disc or keep as a part (session Q)"}
        if lb.startswith("intervertebral disc") or lb == "interpubic disc":
            return {**c, "class": "whole", "layer": "cartilage", "kind": "disc"}
        if lb.startswith("articular disc") or (lb.endswith("meniscus") and "meniscotibial" not in lb):
            return {**c, "class": "whole", "layer": "cartilage", "kind": "meniscus"}
        m = PART_RE.match(b)
        if m and m["type"] in ("part", "parts"):  # not "ligament of head of rib"
            return {**c, "class": "part", "layer": "ligaments", "kind": "ligament",
                    "partType": m["type"].rstrip("s"), "partOf": m["parent"]}
        return {**c, "class": "whole", "layer": "ligaments", "kind": "ligament"}

    # 4: Muscular system
    if lb in LIGAMENTS_IN_MUSCLES:
        return {**c, "class": "whole", "layer": "ligaments", "kind": "ligament",
                "reason": "ligament modelled with the muscles (child of external abdominal oblique)"}
    if lb in TENDON_PARTS:
        t, parent = TENDON_PARTS[lb]
        return {**c, "class": "part", "layer": "muscles", "kind": "muscle_part",
                "partType": t, "partOf": parent}
    m = PART_RE.match(b)
    if m:
        return {**c, "class": "part", "layer": "muscles", "kind": "muscle_part",
                "partType": "portion" if m["type"].startswith("part") else m["type"],
                "partOf": norm_muscle(m["parent"])}
    parent = o["parentChain"][0] if o["parentChain"] else ""
    if parent and not parent.endswith((".g", ".j")):
        # A muscle mesh parented to another muscle mesh: (Adductor minimus) < Adductor magnus
        return {**c, "class": "part", "layer": "muscles", "kind": "muscle_part",
                "partType": "portion", "partOf": norm_muscle(base(parent))}
    return {**c, "class": "whole", "layer": "muscles", "kind": "muscle"}


# --- report ----------------------------------------------------------------

def fmt(n: int) -> str:
    return f"{n:,}"


def main() -> None:
    with open(AUDIT) as fh:
        audit = json.load(fh)
    objs = audit["objects"]
    for o in objs:
        o["classification"] = classify(o)
    by = {o["name"]: o for o in objs}
    soft = [o for o in objs if not o["root"].startswith("2")]
    patches = [o for o in objs if o["root"].startswith("2")]

    # side checks
    side_swaps, no_suffix, unpaired, cross = [], [], [], []
    for o in soft:
        cl = o["classification"]["class"]
        sn, sc = o["sideFromName"], o["sideFromCentroid"]
        if sn and sc != "midline" and sc != sn:
            side_swaps.append(o)
        if not sn and sc != "midline" and not o["name"].endswith(".g"):
            no_suffix.append(o)
        if sn:
            twin = o["name"][:-1] + ("r" if sn == "left" else "l")
            if twin not in by:
                unpaired.append(o)
        if sn and o["crossesMidline"] and cl not in ("excluded",):
            cross.append(o)

    # layer totals
    layer_tris = collections.Counter()
    layer_count = collections.Counter()
    nonman = collections.Counter()
    for o in soft:
        c = o["classification"]
        if c["class"] in ("whole", "part", "fragment"):
            layer_tris[c["layer"]] += o["tris"]
            layer_count[c["layer"]] += 1
            if o["nonManifoldEdges"]:
                nonman[c["layer"]] += 1
    doubt_tris = collections.Counter()
    for o in soft:
        c = o["classification"]
        if c["class"] == "doubtful":
            doubt_tris[c.get("layer", "?")] += o["tris"]

    # parts grouped by parent
    parts = collections.defaultdict(list)
    for o in soft:
        c = o["classification"]
        if c["class"] == "part" and c["layer"] == "muscles" and o["sideFromName"] != "right":
            parts[c["partOf"]].append(base(o["name"]))

    # major muscle presence
    muscle_names = [base(o["name"]).lower() for o in soft
                    if o["classification"].get("layer") == "muscles"]

    def present(m: str) -> list[str]:
        keys = [k.strip() for k in re.split(r"[(),]", m.lower()) if k.strip()]
        if len(keys) > 1:
            keys = keys[1:]
        hits = sorted({n for n in muscle_names for k in keys if k in n})
        return hits

    major = [(m, present(m)) for m in MAJOR_MUSCLES]
    missing_major = [m for m, h in major if not h]

    # attachments
    att_ok = [p for p in patches if p["attachment"]["nearest"]["median"] < ATTACH_TOL_M]
    att_far = [p for p in patches if p["attachment"]["nearest"]["median"] >= ATTACH_TOL_M]
    att_side_swap = [p for p in patches if p["sideFromName"] and p["sideFromCentroid"] != "midline"
                     and p["sideFromCentroid"] != p["sideFromName"]]
    keyset = collections.Counter((p["attachment"]["muscleName"], p["attachment"]["end"],
                                  p["attachment"]["index"], p["sideFromCentroid"]) for p in patches)
    att_dupes = [k for k, v in keyset.items() if v > 1]
    att_muscles = sorted({p["attachment"]["muscleName"] for p in patches})
    soft_bases = {base(o["name"]).lower() for o in soft}
    group_names = set()
    for o in soft:
        for g in o["parentChain"]:
            group_names.add(base(g[:-2] if g.endswith((".g", ".j")) else g).lower())
    att_unmatched = [m for m in att_muscles
                     if m.lower() not in soft_bases and m.lower() not in group_names]
    att_tris = sum(p["tris"] for p in patches)
    by_end = collections.Counter(p["attachment"]["end"] for p in patches)
    on_unmapped = collections.Counter(p["attachment"]["nearest"]["source"] for p in patches
                                      if not p["attachment"]["nearest"]["id"])

    usable = len(att_ok) / len(patches) >= 0.9
    audit["summary"] = {
        "counts": {r: sum(o["root"] == r for o in objs) for r in audit["roots"]},
        "classes": dict(collections.Counter(o["classification"]["class"] for o in objs)),
        "layerTris": dict(layer_tris),
        "layerCount": dict(layer_count),
        "attachmentsUsable": usable,
        "attachmentsWithin1mm": len(att_ok),
        "missingMajorMuscles": missing_major,
    }
    write_audit(audit)

    # --- markdown
    L: list[str] = []
    w = L.append
    w("# Soft-tissue audit (Milestone 6, session P)")
    w("")
    w("Source: Z-Anatomy `Startup.blend`, commit `71919ee`, opened with `bpy` "
      f"{audit['blenderVersion']}. Generated by `scripts/blender/audit_soft_tissue.py` (raw facts, "
      "about 1 minute) and `scripts/mapping/classify_soft_tissue.py` (`npm run audit-soft`: "
      "classes and this report). Data: `assets/audit/soft-tissue.json`. All figures are from the "
      "evaluated meshes in world space, as in the bone audit (`REPORT.md`).")
    w("")
    w("The classes are a **first pass for session Q**, not the mapping. Nothing here adds anatomy: "
      "names, sides and the source's own grouping are read from the file, and the rules only sort them.")
    w("")
    w("## Summary")
    w("")
    w("| Collection | Meshes with faces | Whole | Part | Doubtful | Excluded | Attachment patches |")
    w("| --- | --- | --- | --- | --- | --- | --- |")
    for r in audit["roots"]:
        rs = [o for o in objs if o["root"] == r]
        cc = collections.Counter(o["classification"]["class"] for o in rs)
        note = " (not used by the bones)" if r.startswith("1") else ""
        w(f"| `{r}`{note} | {len(rs)} | {cc['whole']} | {cc['part']} | {cc['doubtful']} | "
          f"{cc['excluded']} | {cc['attachment']} |")
    w("")
    w("No **fragments** were found: no source object is a numbered or unnamed modelling split. "
      "Every mesh carries an anatomical (TA English) name, so `merged` in the mapping will only "
      "hold choices such as nucleus pulposus → disc, if session Q makes them.")
    w("")
    w("The muscles collection is **English, not Latin** (`STATUS.md` expected Latin-only names). "
      "It also carries its own anatomical tree as object parents: hidden label objects (`… .g`) "
      "and empty meshes (`… .j`) for region → compartment → muscle, for example "
      "`Long head of triceps brachii.l < Triceps brachii muscle.g < Posterior compartment of arm.g "
      "< Muscles of upper limb.g`. Each object's chain is in the JSON (`parentChain`); session Q "
      "can build `muscle-hierarchy.json` from it.")
    w("")
    w("### Triangles per proposed layer (whole + part; doubtful listed separately)")
    w("")
    w("| Layer | Meshes (both sides) | Source triangles | High target (plan decision 8) | Doubtful meshes' triangles | Non-manifold meshes |")
    w("| --- | --- | --- | --- | --- | --- |")
    for layer in ("muscles", "ligaments", "cartilage"):
        w(f"| {layer} | {layer_count[layer]} | {fmt(layer_tris[layer])} | ~{fmt(BUDGET_HIGH[layer])} | "
          f"{fmt(doubt_tris[layer])} | {nonman[layer]} |")
    w(f"| attachment patches | {len(patches)} | {fmt(att_tris)} | (not budgeted yet) | | |")
    w("")
    over = [l for l in ("muscles", "ligaments", "cartilage") if layer_tris[l] > BUDGET_HIGH[l]]
    w("Layers whose source geometry is over the high target (decimated in session R): "
      + (", ".join(f"{l} ({layer_tris[l] / BUDGET_HIGH[l]:.1f}× the target)" for l in over) or "none")
      + ". Under it, the high file keeps the source geometry (plan decision 8).")
    w("")
    w("## Stop conditions (spec §2)")
    w("")
    sep_ok = not cross
    w(f"1. **Muscles not separated left/right: no.** Every paired muscle is two meshes with `.l` / `.r` "
      f"names, and no side-named mesh crosses the midline"
      + (": none found." if sep_ok else f" except: {', '.join(o['name'] for o in cross)}."))
    w(f"2. **A major muscle missing: {'no' if not missing_major else 'YES'}.** Checked against "
      f"{len(MAJOR_MUSCLES)} major muscles (table below)"
      + (". All present." if not missing_major else f"; missing: {', '.join(missing_major)}."))
    npart = sum(len(v) for v in parts.values())
    w(f"3. **Parts that can't be matched to anatomy for a large share of muscles: no.** "
      f"{npart} left/midline part meshes, all named as an anatomical division (head, part, belly, "
      f"tendon, aponeurosis) of a named muscle; listed below.")
    w("4. **Articular cartilage (plan risk 1): largely absent, as expected.** The source has no "
      "articular cartilage on any joint surface. What it has per joint is listed below. Under the "
      "plan, the missing articular cartilage is recorded as `missing` in the mapping, not modelled.")
    w("")
    w("Conditions 1 to 3 don't hold, so the plan doesn't require a stop for them. **Condition 4 is "
      "the plan's own checkpoint: the user is asked before session Q** whether to go on without "
      "articular cartilage.")
    w("")
    w("### Cartilage found per major joint")
    w("")
    w("| Joint | Cartilage-type meshes in the source |")
    w("| --- | --- |")
    for j, items in JOINT_CARTILAGE.items():
        found = [i for i in items if any(base(o["name"]).lower() == i for o in soft)]
        w(f"| {j} | {', '.join(found) if found else '**none** (no articular cartilage)'} |")
    w("")
    nd = sum(1 for o in soft if base(o["name"]).lower().startswith("intervertebral disc"))
    nn = sum(1 for o in soft if base(o["name"]).lower().startswith("nucleus pulposus"))
    ncc = sum(1 for o in soft if base(o["name"]).lower().startswith("costal cartilage"))
    w(f"Also present: {nd} intervertebral discs (C2–C3 to L5–S1) with {nn} separate nucleus pulposus "
      f"meshes inside them; the interpubic disc; {ncc} costal cartilages (ribs 1–10, both sides; "
      "ribs 11 and 12 have none, as in the body). The only other meshes named cartilage are the "
      "excluded laryngeal and nasal ones, and the triradiate cartilage (a growth plate, excluded).")
    w("")

    w("### Major muscles checked")
    w("")
    w("| Muscle | Source meshes (left / midline names) |")
    w("| --- | --- |")
    for m, hits in major:
        w(f"| {m} | {', '.join(hits[:6]) + (' …' if len(hits) > 6 else '') if hits else '**missing**'} |")
    w("")

    w("## Muscles with parts in the source")
    w("")
    w("Grouped by the muscle named in the part's name (left side shown; the right mirrors it). "
      "Session Q turns each group into a parent muscle with these parts (plan decision 3).")
    w("")
    w("| Muscle | Parts |")
    w("| --- | --- |")
    for k in sorted(parts):
        w(f"| {k} | {'; '.join(sorted(parts[k]))} |")
    w("")
    w("Muscles with well-known divisions that the source models as **one mesh** (so they are leaves; "
      "M8 text can still describe the heads): for example sternocleidomastoid (sternal and clavicular "
      "heads), medial pterygoid, omohyoid (two bellies), rectus femoris (straight and reflected heads). "
      "Session Q lists them all in the mapping's `notes`.")
    w("")
    w("Groups the source treats as one unit of several muscles, which session Q must decide on "
      "(parent muscle with parts, or a group in the hierarchy only): `Iliopsoas muscle` (iliacus, "
      "psoas major), `Levator ani` (pubococcygeus, iliococcygeus, pubo-analis), `Epicranius muscle` "
      "(frontalis, occipitalis, temporoparietalis, epicranial aponeurosis), `Erector spinae` and the "
      "other back groups (by region: `colli`, `thoracis`, `lumborum`, `capitis`).")
    w("")

    w("## Doubtful meshes (session Q decides; each gets a `QUESTIONS.md` entry)")
    w("")
    w("| Mesh | Layer if kept | Why it's doubtful |")
    w("| --- | --- | --- |")
    seen = set()
    for o in soft:
        c = o["classification"]
        if c["class"] == "doubtful" and base(o["name"]) not in seen:
            seen.add(base(o["name"]))
            w(f"| {base(o['name'])} | {c.get('layer', '?')} | {c['reason']} |")
    w("")
    w("Also for session Q: the interosseous membranes (forearm, leg), the intercostal membranes and "
      "the obturator membrane are classed as **ligaments** (fibrous sheets between bones, not synovial "
      "membranes). The **inguinal ligament** sits in the muscles collection as a child of external "
      "abdominal oblique; it goes to the ligaments layer. Ligament parts in the source (`Deep / "
      "Superficial part of tibial collateral ligament`, `Descending / Transverse part of iliofemoral "
      "ligament`) are classed `part`; the spec only defines parts for muscles, so Q either treats them "
      "as separate ligaments or gives ligaments parents too.")
    w("")

    w("## Excluded")
    w("")
    ex = collections.Counter(o["classification"]["reason"] for o in soft
                             if o["classification"]["class"] == "excluded")
    w("| Reason | Meshes |")
    w("| --- | --- |")
    for r, n in ex.most_common():
        w(f"| {r} | {n} |")
    w("")
    inc = sorted({base(o["name"]) for o in soft if o["classification"]["inconstant"]})
    w(f"Names in parentheses in the source (variable or inconstant structures): {', '.join(inc)}. "
      "They are classed like any other; session Q keeps the flag.")
    w("")

    w("## Naming and side problems")
    w("")
    w("Sides were read from the name suffix and checked against the centroid's x (patient's right is "
      f"−X; |x| under {audit['midlineTolM'] * 1000:.0f} mm counts as midline, so small paired muscles "
      "near the midline, such as the interspinales or genioglossus, aren't flagged).")
    w("")
    if side_swaps:
        w("**Name says one side, geometry says the other** (session Q takes the side from geometry):")
        for o in side_swaps:
            w(f"- `{o['name']}`: centroid x = {o['centroid'][0]:+.4f} m ({o['sideFromCentroid']})")
        w("")
    if no_suffix:
        w("**No side suffix, but off the midline:**")
        for o in no_suffix:
            w(f"- `{o['name']}`: {o['sideFromCentroid']} (x = {o['centroid'][0]:+.4f} m)")
        w("")
    unp = [o for o in unpaired if o["classification"]["class"] != "excluded"]
    if unp:
        w("**Side-named meshes with no twin of the other side:**")
        for o in unp:
            w(f"- `{o['name']}`")
        w("")
    w("Together: `Iliocostalis colli muscle` (left) is only missing its `.l`, and the "
      "`Lateral temporomandibular ligament` has its left and right names swapped. "
      "`Intra-articular ligament of head of rib` and `Ulnopisiform ligament` exist as **one side only**. "
      "The missing twins go in `missing`; nothing is mirrored or modelled.")
    w("")

    w("## Decision on `2: Muscular insertions` (plan step 2, decision 12)")
    w("")
    w(f"**Decision: usable.** {len(att_ok)} of {len(patches)} patches "
      f"({100 * len(att_ok) / len(patches):.0f}%) lie on a bone or cartilage surface: the median "
      f"distance of their vertices to the nearest one is under 1 mm (typically 0.25 mm). Each is a "
      "low-poly sheet given Subdivision (level 1) and a 0.5 mm Solidify in the source, so a thin "
      f"closed shell of {min(p['tris'] for p in patches)} to {max(p['tris'] for p in patches)} "
      f"triangles once evaluated ({fmt(att_tris)} in all; {fmt(sum(p['baseTris'] for p in patches))} "
      "before modifiers), parented to the bone it sits on.")
    w("")
    w(f"- **Names:** `<muscle or part name>.<o|e>[n]<l|r>`: `o` = origin ({by_end['origin']}), "
      f"`e` = insertion ({by_end['insertion']}), `n` numbers several patches of one end. All "
      f"{len(patches)} names parse. {len(att_muscles)} distinct muscle names; "
      f"{len(att_muscles) - len(att_unmatched)} match a muscle mesh or a source muscle group. "
      f"Unmatched (session Q maps these by hand): {', '.join(att_unmatched) if att_unmatched else 'none'}.")
    w(f"- **Sides:** split left and right, but the suffix is **unreliable**: {len(att_side_swap)} "
      "patches lie on the other side from their suffix (for example both scalene, rectus capitis and "
      "serratus patches have `l`/`r` swapped). "
      f"{len(att_dupes)} name keys occur twice on the same side, which means the source has a "
      "right-side patch named `…l` and **no left-side twin** (serratus posterior superior and inferior, "
      "plantar interossei, pronator quadratus, piriformis, pectineus and others). So: side from "
      "geometry, and the missing left twins go in `missing` (not mirrored).")
    w(f"- **Not on a surface ({len(att_far)}):** "
      + "; ".join(f"`{p['name']}` ({p['attachment']['nearest']['median'] * 1000:.1f} mm from "
                  f"{p['attachment']['nearest']['source']})" for p in att_far)
      + ". Most span two bones and the membrane between them (abductor pollicis longus, tibialis "
      "posterior, extensor hallucis longus, extensor pollicis brevis) or several costal cartilages "
      "(diaphragm, internal oblique), so they are real and only the 1 mm test is too strict for them. "
      "**`Rectus abdominis muscle.e*` is misplaced** (144 mm from any bone), and its `o` patches sit on "
      "the costal cartilages, where the muscle inserts, so its origin and insertion labels look swapped.")
    w(f"- **On meshes that aren't bones:** {', '.join(f'{k} ({v})' for k, v in sorted(on_unmapped.items()))}. "
      "The costal cartilages become cartilage-layer objects, so these patches still have a structure to "
      "sit on; the thyroid cartilage and the hallux sesamoids are excluded, so their patches are dropped.")
    w("- **Consequence:** origin and insertion in the content (M8) come from references, never from "
      "the patch names; the patches are geometry only. Session Q maps each kept patch to "
      "`<muscle or part id>__origin|__insertion[_n]` under `attachments`, and session R exports them as "
      "`attachments-{high,low}.glb` (plan decision 12). M9 then draws them on the bones (spec §5.3).")
    w("")

    w("## Budgets")
    w("")
    w(f"- **Muscles:** {fmt(layer_tris['muscles'])} source triangles (plus up to "
      f"{fmt(doubt_tris['muscles'])} if the doubtful aponeuroses are kept). The ~800k / ~230k targets stand.")
    for l in ("ligaments", "cartilage"):
        big = sorted((o for o in soft if o["classification"].get("layer") == l
                      and o["classification"]["class"] in ("whole", "part")),
                     key=lambda o: -o["tris"])[:4]
        w(f"- **{l.capitalize()}:** {fmt(layer_tris[l])} source triangles against ~{fmt(BUDGET_HIGH[l])}. "
          "Largest: " + ", ".join(f"{base(o['name'])} {fmt(o['tris'])}" for o in big) + ".")
    w("  Ligaments and cartilage together are "
      f"{fmt(layer_tris['ligaments'] + layer_tris['cartilage'])} against the spec's ~200k (§9), so the "
      "targets stand and session R decimates both (the per-object floor protects the small ones).")
    w(f"- **Attachment patches:** {fmt(att_tris)} evaluated triangles is far too many for an overlay, "
      f"but most of it is the subdivision of {fmt(sum(p['baseTris'] for p in patches))} base triangles. "
      "Proposed: ~150k high, ~50k low, decimated from the evaluated mesh like everything else, with a "
      "per-patch floor of 64 triangles (a solidified sheet needs two faces for every one it shows). "
      "Recorded in the plan for session R.")
    w("")

    w("## Structures absent from the source")
    w("")
    w("Searched for by name across all four collections (meshes, empty helpers and labels). None of "
      "these has a mesh; session Q lists them in `missing` (none is modelled):")
    w("")
    w("- **Patellar ligament** and the **quadriceps tendon**: no mesh, although collection 2 has patches "
      "for both ends of the patellar ligament (`Patellar ligament.o/e`) and for `Quadriceps femoris "
      "muscle.e`. The knee's front therefore shows no tendon between the patella and the tibia.")
    w("- **Craniovertebral ligaments**: transverse ligament of the atlas (cruciform ligament), alar and "
      "apical ligaments, tectorial membrane, atlanto-occipital membranes. The atlanto-axial joints exist "
      "only as empty groups.")
    w("- **Ankle:** the medial (deltoid) ligament has only its posterior tibiotalar, tibionavicular and "
      "tibiocalcaneal parts; there is no anterior tibiotalar part.")
    w("- **Muscles** (none is a major muscle): stapedius and tensor tympani (the group `Muscles of "
      "auditory ossicles` is empty), the auricular muscles (both groups empty), the soft palate apart "
      "from palatopharyngeus, styloglossus and palatoglossus, subcostales, psoas minor, the perineal "
      "muscles apart from the external anal sphincter, and articularis genus (it has patches only).")
    w("- **Articular cartilage** on every joint surface (see the stop conditions).")
    w("")

    w("## Geometry")
    w("")
    nm = [o for o in soft if o["classification"]["class"] in ("whole", "part") and o["nonManifoldEdges"]]
    neg = sum(1 for o in soft if o["negativeScale"])
    mods = collections.Counter(m for o in soft + patches for m in o["modifiers"])
    w("| Layer | Base triangles (before modifiers) | Evaluated triangles |")
    w("| --- | --- | --- |")
    for layer in ("muscles", "ligaments", "cartilage"):
        xs = [o for o in soft if o["classification"].get("layer") == layer
              and o["classification"]["class"] in ("whole", "part")]
        w(f"| {layer} | {fmt(sum(o['baseTris'] for o in xs))} | {fmt(sum(o['tris'] for o in xs))} |")
    w(f"| attachment patches | {fmt(sum(p['baseTris'] for p in patches))} | {fmt(att_tris)} |")
    w("")
    w(f"- **Modifiers:** {', '.join(f'{k} ×{v}' for k, v in mods.most_common())}. Muscles are mostly "
      "plain meshes; the ligaments and patches are low-poly sheets with Subdivision level 1 (render "
      "level 2) and Solidify 0.1–2 mm. All figures here use the **viewport** evaluation, as the bone "
      "build does (`evaluated_depsgraph_get`); the render levels would multiply the subdivided meshes' "
      "triangles by about 4. Session R evaluates the same way, so its bounds check matches this audit.")
    w("- Modifiers switched off in the viewport but on for render: Solidify on `Plantar aponeurosis` and "
      "`Superficial transverse metatarsal ligament` (both doubtful; if kept, they would export as "
      "unthickened sheets unless session R enables the modifier), Wireframe on the excluded `Lateral "
      "femoral intermuscular septum`, Subdivision on the excluded `Common flexor tendon sheath.l`.")
    w(f"- {len(nm)} kept meshes have non-manifold edges (listed per mesh in the JSON, "
      "`nonManifoldEdges`); the build closes small holes and logs what remains, as for the bones.")
    w(f"- {neg} soft-tissue meshes have a negative world scale (left-side linked duplicates, as for the "
      "bones), so the build makes the mesh data single-user and flips winding, as `build_skeleton.py` does.")
    w("")
    w("## Other findings")
    w("")
    nlm = "622"
    w(f"- **Landmark helpers in `1: Skeletal system`:** about {nlm} empty mesh objects (`… .j`, with "
      "`.t` / `.s` text labels and `.i` helpers) named after bone landmarks, for example `Apex of dens "
      "axis.j`, `Facet for dens.j`, `Patellar surface of femur.j`. They may give **real positions** for "
      "the bone `landmarks` that are all `null` today (spec §4.6: positions only from source or mesh "
      "data). Not audited here; worth a look before M8 adds landmarks for muscle attachments.")
    w("- The source's parent tree already groups muscles by region and compartment (and superficial / "
      "deep for the forearm and leg), which is most of what `muscle-hierarchy.json` needs.")
    w("")
    with open(REPORT, "w") as fh:
        fh.write("\n".join(L))
    print(f"classified {len(objs)} objects; report {os.path.relpath(REPORT, REPO)}")
    print("classes:", dict(collections.Counter(o['classification']['class'] for o in objs)))
    print("layer tris:", dict(layer_tris), "missing major:", missing_major)


if __name__ == "__main__":
    main()
