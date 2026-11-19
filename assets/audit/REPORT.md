# Source audit: Z-Anatomy (Milestone 1, steps 1 and 2)

**Decision: use Z-Anatomy.** All 206 bones are present as separate meshes, and 28 of the 32 teeth are separate meshes. The four third molars are missing (see below).

| | |
| --- | --- |
| Source | `Z-Anatomy.zip` → `Startup.blend` from github.com/Z-Anatomy/Models-of-human-anatomy, commit `71919ee` |
| Collection audited | `1: Skeletal system` (278 mesh objects with geometry) |
| Tool | Blender 5.3.0 as the `bpy` Python module (`scripts/setup-blender.sh`) |
| Raw data | `assets/audit/z-anatomy.json` (made by `scripts/blender/audit_source.py`) |
| ID list and mapping | `content/ids.json` and `assets/mapping/source-to-id.json` (made and checked by `scripts/mapping/generate_ids.py`) |

## Coordinate space
- Metres, **Z up, facing −Y**, feet at z ≈ 0.009 and vertex at z ≈ 1.706 (height about 1.70 m).
- The patient's right is −X. The script checks every `.r`/`.l` object against its centroid, and all agree.
- glTF export converts (x, y, z) to (x, z, −y), which gives the spec's **Y up, facing +Z** with no manual rotation.
- The vertebrae, ribs and sternum have an object scale of 10 with geometry stored at 1/10. The left-side bones are linked duplicates of the right, mirrored with negative scale (119 objects). The pipeline must **apply the world transforms** (and fix the winding on mirrored objects) before export. This changes how the data is stored, not where any bone sits.

## Teeth
- **28 separate tooth meshes** (`Anterior teeth` and `Posterior teeth` collections): upper and lower central incisors, lateral incisors, canines, first and second premolars, and first and second molars, on both sides.
- **Third molars (FDI 18, 28, 38, 48) are missing.** No object with a matching name exists anywhere in the file.
- What I did: the four IDs stay in `content/ids.json` (so it still has 238 entries) with `meshAvailable: false`, and they're listed under `missing` in the mapping. Following your instruction, I haven't looked for them anywhere else yet.

## How the source maps to the 206 bones
- Each bone is one object, **except the sternum**. The source splits it into `Manubrium of sternum`, `Body of sternum` and `Xiphoid process`, which will be joined into `sternum`, the standard way it's counted in the 206.
- The hip bone, sacrum and coccyx are already single meshes. Every bone of the hands and feet is its own mesh, including the 14 phalanges per hand and foot.
- **Excluded (42 objects):** the frontal and sphenoid sinus volumes, the ethmoid air cells, the hallux sesamoids (not in the 206), and all cartilage (costal, nasal and laryngeal), which the spec puts out of scope. Each exclusion and its reason is in `source-to-id.json`.

## Geometry (from the evaluated mesh, with modifiers applied)
- **Triangle count:** 580k for the mapped objects. The largest is the scapula (25k triangles each) and the smallest are the distal phalanges of the fingers (~130 triangles). The high LOD (~500k) needs only light decimation. For the low LOD (~150k), the smallest bones should be left almost untouched.
- **Normals:** after allowing for the mirroring, all mapped objects have outward-facing normals.
- **Holes or non-manifold edges** (fixable by script): frontal bone (32 edges, where the sinus mesh sits), sphenoid (32), occipital (79), mandible (70), ethmoid (54, after its Boolean modifiers are applied), T8 (61), sacrum (16), xiphoid (33), humerus (6 each side), body of sternum (2).
- **Loose vertices** to delete: atlas, axis, clavicles, coccyx, fibulae, manubrium and body of sternum, occipital, sacrum, scapulae, sixth ribs, C4, L3, T8, vomer.
- **Modifiers to apply:** Boolean ×6 on the ethmoid, Subdivision on the lunate and pisiform, Mirror on the xiphoid.

## Licence and attribution (feeds `public/ATTRIBUTION.md` in step 5)
- Z-Anatomy: **CC BY-SA 4.0** (Gauthier Kervyn and Marcin Zielinski).
- Its meshes come from **BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 Japan**. Note that the spec lists BodyParts3D as CC BY 4.0, but Z-Anatomy credits it as CC BY-SA 2.1 JP. The attribution will credit both.

## Questions for review before step 3
1. **Third molars:** ship Milestone 1 with 234 meshes and the four wisdom-tooth IDs marked "no model"? (Recommended.) Or look for third molars in another source later?
2. **Sternum:** join the three parts into a single `sternum` object? (Recommended; it matches the 206 count.)
3. **Costal cartilages:** excluded, as the spec says. Without them, the ribs end short of the sternum. That's worth a look in phase 5, when the spec asks whether the joints still read clearly without cartilage.
