# Audit: the remaining Z-Anatomy collections (5–9)

Written 2026-11-24 at the end of M10 (for `STATUS-M10.md` §9). Source: the same pinned `Startup.blend` (Z-Anatomy commit `71919ee`) that the bones and the soft tissue came from. Nothing was changed or built; the `.blend` was opened read-only.

**Method.** One read-only Blender script, run per collection, records every object: type, collection path, parent, side from the name suffix and from x (patient's right is −X), modifiers, materials, linked data, and, for meshes **and curves**, the evaluated world-space mesh statistics from the repo's `mesh_stats` (`scripts/blender/audit_source.py`, the same function behind `assets/audit/z-anatomy.json`). Curves count through their evaluated (bevelled) mesh, so their triangle counts are what an export would produce. One `mesh-auditor` subagent per collection analysed the output (`docs/WORKFLOW.md`). The main session checked each batch's totals against the raw rows and ran two whole-file checks (sex-specific names; skin, gut and heart names). The script lived in the session's scratch folder and is not in the repo. Raw per-object rows and each batch's summary are in **`assets/audit/body-systems.json`** (columns listed at its top).

Caveat for collection 8: the script failed on an undecodable text label, so its batch reran a copy that skips bad text. Geometry is unaffected; label text for that collection is unreliable.

## Summary

| | 5 Cardiovascular | 6 Lymphoid | 7 Nervous & sense organs | 8 Visceral | 9 Regions |
| --- | --- | --- | --- | --- | --- |
| Objects (all types) | 757 | 276 | 842 | 479 | 343 |
| MESH / CURVE / FONT | 60 / 654 / 43 | 220 / 0 / 56 | 460 / 249 / 133 | 254 / 44 / 181 | 299 / 0 / 44 |
| Objects with faces | 676 (22 mesh + 654 curve) | 164 | 583 | 121 (77 + 44) | 257 |
| Triangles, mesh | 189,336 | 128,353 | 1,260,276 | 493,859 | 136,121 |
| Triangles, curve | 3,654,432 | 0 | 1,148,092 | 221,184 | 0 |
| **Triangles, total** | **3.84 M** | **0.13 M** | **2.41 M** | **0.72 M** | **0.14 M** |
| Separate or merged | separate: one curve per named vessel segment | separate: one blob per node group | separate: gyri, nuclei, tracts; one curve per nerve branch | separate: organs, lobes, segments, bronchi | separate: one skin patch per region |
| Left/right | separate (258 `.l` / 258 `.r`; 51 use a "Left/Right" prefix instead) | separate (54 / 54) | separate (266 / 267) | only paired glands and gonads (17 / 19); lobes and segments are single objects | separate (127 / 127) |
| Negative-scale linked duplicates | 246 pairs | 54 pairs | 262 | 13 | 127 |
| Naming | English (TA style), mappable with a side rule table | English, mappable | English, mappable with a small table (asterisks, a double space, `'` copies) | English, mappable by exact name | English, mappable |
| Non-manifold objects | 701 (mostly open curve tubes) | 1 | 509 | 61 of 121 | 85 |
| Shares data or geometry with collections 1–4 | none | none | none | none | none |
| What it is | vessel atlas plus heart chambers and valves | lymph node groups, thymus, spleen, tonsils | brain, spinal cord, nerves, eye, ear | gut, airway, liver, urinary, endocrine, male genital | **not anatomy**: skin-surface region patches, hair, nails |

Grand total: **about 7.2 million triangles** in collections 5–9 (5.0 M from bevelled curves), against the **1.5 M** that every musculoskeletal layer draws at high detail today (`assets/build/manifest*.json`).

**Overlap with the built layers.** No object in 5–9 shares mesh data with collections 1–4, and none has a world bounding box within 1 mm of any built bone or soft-tissue object (2,105 compared). So nothing is duplicated. Containment (brain in the skull, organs inside the ribcage) is expected and was not measured.

**Whole-file checks.** Searching every object name in the file:
- Sex-specific structures: **male only**. Testis, epididymis, ductus deferens, seminal gland, ejaculatory duct, prostate and penis (glans, corpus cavernosum, corpus spongiosum) are in 8. Testicular and penile vessels are in 5. There is no uterus, ovary, vagina, vulva or breast tissue anywhere, including the "Bonus collection". Collection 9 has "Mammary region" and "Inframammary region" skin patches only.
- **Not in the file at all:** skin, ileum, rectum and anal canal, pericardium, a whole-heart mesh, a whole-lung mesh, lymphatic vessels and the thoracic duct. Laryngeal cartilage (thyroid cartilage) is in collection 1, excluded since M6.

## 5: Cardiovascular system
- **Counts:** 757 objects: 654 CURVE, 60 MESH (22 with faces), 43 FONT labels, and 38 zero-triangle `.j` label anchors.
- **Structure:** every vessel is its own **named curve segment** with a 0.5 mm bevel (e.g. `Superior gluteal artery.r`, `Anterior tibial veins.l`), not one tree per system. The heart is modelled as **parts only**: right and left atrium and ventricle, 4 papillary muscles, 11 valve leaflets (`Non-coronary leaflet`, `Septal leaflet of right atrioventricular valve`), coronaries (`Right coronary artery`, `Circumflex artery of heart`, `Coronary sinus`), aortic segments, venae cavae, dural sinuses (`Cavernous sinus.l/.r`, `Basilar venous plexus`). There is no whole heart and no pericardium.
- **Largest:** Central retinal artery.r and .l (CURVE, **207,360 each**, grossly over-tessellated for a vessel under 1 mm), Right superior intercostal vein (62,784), Basilar venous plexus (MESH, 56,192), Left superior intercostal vein (50,976).
- **Sides:** by suffix 258 left, 258 right, 198 none; by x 351 left, 327 right, 36 midline. 51 objects carry the side as a prefix ("Right superior intercostal vein"), not a suffix.
- **Problems:** 47,008 non-manifold edges over 701 objects, mostly open tube ends from the bevel. 306 objects have inward normals. 755 of 757 are hidden in render, which is normal in this file.
- **Sex-specific:** male vessels only (testicular artery and vein, deep and dorsal arteries of the penis, deep dorsal vein of the penis).

## 6: Lymphoid organs
- **Counts:** 276 objects: 220 MESH (164 with faces, 56 zero-triangle hook anchors) and 56 FONT.
- **Structure:** about 100 named **node groups** as separate small blobs (median 672 triangles), e.g. `Pretracheal nodes.r`, `Jugulodigastric node.l`. The thymus has two lobes (largest objects: 9,188 and 6,452). `Spleen` is one mesh (1,330) plus 11 landmark hooks (hilum, impressions) with no geometry. Palatine tonsils are left and right.
- **Absent by name:** lymphatic vessels, thoracic duct, bone marrow, adenoids, Peyer's patches.
- **Problems:** only `Lymphoid organs.g`, a stray title mesh, is non-manifold. 5 objects use a geometry-nodes modifier (median sacral and lacunar nodes).

## 7: Nervous system and sense organs
- **Counts:** 842 objects: 460 MESH, 249 CURVE, 133 FONT; 583 with faces; 120 empty `.j` group meshes.
- **Structure:** separate named parts:
  - cerebrum by gyrus and sulcus per lobe (`Precentral gyrus.l`), plus the basal ganglia (caudate, putamen, globus pallidus), hippocampus, amygdala, thalamus and hypothalamus
  - brainstem with about 25 cranial-nerve nuclei, and cerebellar lobules
  - ventricles and choroid plexus, falx cerebri, tentorium cerebelli and the spinal dura
  - about 30 spinal cord tracts, the cauda equina and roots
  - nerves as **bevelled curves, one per branch**: cranial nerves I–XII and their branches, plexus branches, the sympathetic trunk
  - eye: cornea, sclera, iris, lens, retina, vitreous body, zonular fibres and the lacrimal apparatus
  - ear: tympanic membrane, cochlea, vestibule and auditory tube; the semicircular canals are only empty `.j` groups
- **Largest:** White matter of telencephalon.l and .r (MESH, 135,288 each), Zonular fibres.r (68,288), Intercostal nerves.r and .l (CURVE, 51,552 each).
- **Sides:** suffix 266 left, 267 right, 309 none; by x 274, 318, 117 midline.
- **Problems:** 509 objects are non-manifold (Spinal dura 8,818 edges; Olfactory nerve (I) 1,104 each side), and 255 have inward normals. The source uses heavy modifiers (SUBSURF 65, HOOK 40, MIRROR 35, ARRAY 30, CURVE 30), all evaluated in these counts.

## 8: Visceral systems
- **Counts:** 479 objects, but only **121 are geometry** (77 meshes + 44 curves). The rest are 181 FONT labels and 177 two-vertex `.j` pointer marks.
- **Structure:** separate named objects:
  - airway: lung **lobes** (3 right, 2 left; there is no whole lung) and the bronchial tree down to the segmental bronchi (10 right, 9 left, e.g. `Superior segmental bronchus of right lung (BVI)`)
  - liver: **8 segments (I–VIII)** plus a whole `Liver` that overlaps them
  - gut: stomach and `Mucosa of stomach` (which overlap), duodenum, jejunum (a curve), the colon by part with 3 taeniae, appendix and meso-appendix, and the oesophagus (a curve)
  - pancreas and its ducts, bile duct, gallbladder
  - urinary: kidney, renal pelvis, ureter, bladder, urethra
  - pharynx (3 parts), soft palate, uvula, tongue, gingiva, epiglottis, trachea
  - endocrine: thyroid, pineal, adeno- and neurohypophysis, 4 parathyroids, suprarenals
  - greater and lesser omentum, mesocolon, pleura
- **Largest:** Pleura (112,288), Greater omentum (77,968), Pancreatic duct (curve, 55,824), Jejunum (curve, 27,648), Descending colon (24,744).
- **Sex-specific:** male genital organs only (above).
- **Problems:** 61 of 121 are non-manifold (segmental bronchi around 200 edges each), 31 have inward normals, and `Liver` has 47 loose vertices. The whole-organ/segment overlap (liver) and the organ/mucosa overlap (stomach) need a rule before mapping.

## 9: Regions of human body
- **Not anatomy.** It holds **surface-anatomy region patches**: thin solidified shells lying over where the skin would be (`Anterior region of thigh.l`, `Umbilical region.l`, `Palm.l`). SOLIDIFY is used on 204 objects. It also holds accessories: hair of the head, pubic hair, eyebrows, eyelashes, nail plates and perionyx, plus the parts of the auricle (helix, antihelix, tragus, antitragus, scapha, concha, lobule, cymba conchae). Skin itself is not in the file.
- **Counts:** 343 objects: 299 MESH (257 with faces), 44 FONT; 136,121 triangles. Largest: Hairs of head (16,563).
- **Sides:** 127 left, 127 right, all left ones being negative-scale linked duplicates.
- **Problems:** 85 non-manifold objects (2,573 edges) and 24 with inward normals. Each collection's `*.g` title is a lettering mesh (material "Text"), not anatomy. The same holds for the stray `.g` meshes in 6, 7 and 8.

## Conventions shared by every collection
- Suffixes: `.l` and `.r` for sides; `.g` for group headings (FONT, sometimes a lettering mesh); `.t` for text labels; `.j` for zero-triangle anchor or hook meshes. There are no `.001` copies in any of 5–9.
- Left-side objects are mostly **linked duplicates with negative scale**, as in collection 1, so the bone pipeline's handling (single-user data, apply the world transform, fix winding) applies unchanged.
- Nearly every object is hidden in render. Viewport visibility is what the file uses.
