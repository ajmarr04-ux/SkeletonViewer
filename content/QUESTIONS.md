# Open questions for a reviewer

Things in `content/` that were drafted without a reviewing anatomist (spec §13) and need a decision. Spec §12 says: if unsure whether two bones articulate, leave the pair out and list it here. Each entry says what was done and what to check. Answer by editing the data and deleting the entry.

## Articulations (`articulations.json`)

Drafted in Milestone 4, session J, from standard descriptions (Gray's Anatomy style), not checked line by line against a reference. 357 pairs.

### Left out (not sure they count, or they're variable)

1. **Cuboid–navicular.** Gray's says the cuboid "occasionally" articulates with the navicular (often only a fibrous union). Left out.
2. **Base of metatarsal 1–metatarsal 2.** Occasionally a small facet. Left out; intermetatarsal pairs 2–3, 3–4 and 4–5 are in.
3. **Metacarpal 1–metacarpal 2.** No intermetacarpal joint is usually described for the thumb. Left out; 2–3, 3–4 and 4–5 are in.
4. **Sphenoid–maxilla.** Sometimes described at the maxillary tuberosity. Left out.
5. **Rib 10–T9.** Rib 10's head usually has a single facet for T10, sometimes also T9. Only T10 recorded.
6. **Ulna–triquetrum.** The ulna is separated from the carpus by the articular disc of the distal radio-ulnar joint. Left out; the radiocarpal joint is recorded as radius–scaphoid and radius–lunate.
7. **Interchondral joints (costal cartilages 6 to 9) and rib–rib contact.** Cartilage to cartilage, not bone to bone, and cartilage isn't in the model. Left out.
8. **Clavicle–rib 1.** Joined by the costoclavicular ligament, not a joint. Left out (rib 1 is in the clavicle's region set instead).
9. **Hyoid.** No bony articulation (spec §9 allowlist).

### Recorded, but please check

10. **Sternocostal joints go through the costal cartilage**, which the model leaves out. Ribs 1 to 7 are recorded as articulating with the sternum ("through costal cartilage"); ribs 8 to 10 (which reach it only through the cartilage above) and 11 and 12 (floating) aren't. Is that the right rule for the app?
11. **Stapes–temporal bone: tympanostapedial syndesmosis** (the footplate in the oval window, held by the annular ligament). Recorded as an articulation so the stapes shows its housing at tier 1. The malleus and incus are attached to the temporal bone by ligaments only, so they aren't paired with it.
12. **Lunate–hamate.** Recorded (Gray's lists five bones for the lunate, including the hamate), although a lunate–hamate facet is absent in some people.
13. **Lateral cuneiform–metatarsal 4.** Recorded (Gray's lists the 2nd, 3rd and 4th metatarsals).
14. **Spheno-occipital synchondrosis.** Fused in the adult; kept as the sphenoid–occipital contact.
15. **Joints named here without a standard Latin name** use a plain description with an en dash, for example "Sphenoid–palatine articulation", "Ethmoid–nasal articulation", "Vomer–maxilla articulation", "Ethmoid–inferior nasal concha articulation". Replace with the reference names if wanted.
16. **One entry per pair:** where two bones meet at more than one joint, the pair is stored once with a combined name: radius–ulna ("Proximal and distal radio-ulnar joints"), tibia–fibula ("Tibiofibular joints"), and a rib with its own vertebra ("Joint of head and costotransverse joint").

## Region sets (`regions.json`)

Tier 2 is "curated" (spec §5). The first draft follows simple rules, with the femur exactly as the spec's worked example. Please check whether these are the right "regions":

17. **Skull and face bones, and every tooth:** the whole skull (cranial and facial bones, mandible included) plus both dental arches. Ossicles and hyoid not included.
18. **Ossicles:** the other two ossicles of the same ear and that side's temporal bone.
19. **Hyoid:** mandible, both temporal bones (stylohyoid ligaments) and C2 to C4 (its level in the neck). It has no tier 1.
20. **Vertebrae, sacrum and coccyx:** two levels above and below, the ribs that articulate with any of those vertebrae, plus the occipital bone for C1 and C2, and both hip bones for L4, L5, sacrum and coccyx.
21. **Ribs:** the ribs above and below on the same side, the same rib on the other side, the sternum, and the thoracic vertebrae one level either side; plus the clavicle for rib 1.
22. **Sternum:** the whole thoracic cage (all ribs and thoracic vertebrae).
23. **Shoulder and arm:** clavicle → other clavicle, humerus, rib 1; scapula → sternum and ribs 2 to 7 (the chest wall under it); humerus → clavicle and sternum.
24. **Forearm, wrist and hand:** radius and ulna → all the carpals; carpals → all carpals, metacarpals, radius and ulna; metacarpals → the whole hand; finger bones → all metacarpals and phalanges.
25. **Pelvis and lower limb:** hip bone → coccyx, L5 and the other femur; femur → the spec's example; patella → tibia and fibula; tibia → patella and calcaneus; fibula → femur and calcaneus; tarsals → all tarsals, metatarsals, tibia and fibula; metatarsals → the whole foot; toe bones → all metatarsals and phalanges.

## Content text (`content/bones/*.md`)

Drafted in Milestone 4, session K (axial skeleton and teeth, 73 written files plus 39 mirrored), from standard descriptions in Claude's own knowledge, not checked line by line against a reference (plan decision 11). Every file is `reviewed: false` and every `ta2` is `null`. Things a reviewer should look at first:

26. **Bone type of the small facial bones.** Classifications differ between textbooks. Used here: nasal, lacrimal and vomer as `flat`; palatine and inferior nasal concha as `irregular`; the occipital and parietal as `flat`; the ossicles, vertebrae, sacrum, coccyx, temporal, sphenoid, ethmoid, maxilla, zygomatic, mandible and hyoid as `irregular`; ribs and sternum as `flat`.
27. **Latin names.** Taken from Terminologia Anatomica from memory. Vertebrae use "Vertebra cervicalis III", "Vertebra thoracica I", "Vertebra lumbalis I" (and "Atlas", "Axis", "Vertebra prominens" for C1, C2, C7); ribs "Costa I" to "Costa XII". Teeth use the type name only ("Dens incisivus medialis", "Dens caninus", "Dens premolaris primus", "Dens molaris tertius"), with no upper/lower qualifier. Check the spelling and whether the teeth need one.
28. **Muscle attachments of vertebrae and ribs.** Listed level by level from the usual ranges (for example trapezius C7 to T12, rhomboid major T2 to T5, splenius cervicis T3 to T6, serratus posterior superior C7 to T3 and ribs 2 to 5, serratus posterior inferior T11 to L2 and ribs 9 to 12, psoas major T12 to L4, quadratus lumborum L1 to L4 and rib 12, diaphragm crura L1 to L3). The ends of these ranges vary between sources and between people. Muscles that reach a rib only through its costal cartilage say so.
29. **Eruption ages of the permanent teeth** follow the usual chart (upper central incisor 7 to 8 years, lower central incisor 6 to 7, first molars about 6, second molars about 12, third molars 17 to 21). Check against the reviewer's preferred source.
30. **Common names.** "Front tooth" for the central incisors, "Eye tooth" for the upper canine only, "Bicuspid" for the premolars, "Six-year molar" and "Twelve-year molar", "Wisdom tooth", "Inferior turbinate", "Hammer", "Anvil" and "Stirrup". Most other bones have no common name (`null`), and the panel then hides that line.
31. **Vertebral levels in the clinical notes** (jugular notch at T2–T3, sternal angle at T4–T5, IVC through the diaphragm at T8, oesophagus at T10, aortic bifurcation at L4, end of the spinal cord at L1–L2, carotid tubercle on C6) are the usual teaching levels; they vary between people.

### Appendicular skeleton (session L)

Drafted in Milestone 4, session L: 63 written files (left side) plus 63 mirrored, the same way as above.

32. **Bone type.** The hip bone is `irregular` (some textbooks call it flat); the patella and pisiform are `sesamoid`; carpals and tarsals (talus and calcaneus included) are `short`; metacarpals, metatarsals and all phalanges are `long`.
33. **Latin names.** Metacarpals and metatarsals use "Os metacarpi I" and "Os metatarsi I" (TA98 style; TA2 has "Os metacarpale"), and phalanges "Phalanx proximalis digiti secundi manus" and so on, with "pollicis" and "hallucis" for the thumb and big toe. The fibular muscles are named "Fibularis longus" (not "Peroneus").
34. **Common names.** "Collarbone", "Shoulder blade", "Innominate bone" (for the hip bone; strictly an older anatomical name), "Thigh bone", "Kneecap", "Shinbone", "Calf bone", "Ankle bone" (talus) and "Heel bone". Every other appendicular bone has none.
35. **Muscle attachments of the hand and foot.** Interossei are assigned to the phalanx bases and metacarpals/metatarsals by the usual pattern (hand: dorsal 1 to 4 and palmar 1 to 3; foot: dorsal 1 to 4 from adjacent metatarsals, plantar 1 to 3 from metatarsals 3 to 5). Lumbricals, which insert into the extensor expansion rather than bone, aren't listed. The small slips of tibialis posterior to the cuneiforms and cuboid, and of the oblique head of adductor pollicis to the trapezoid and capitate, are listed; check whether they're worth keeping.
36. **Fused little-toe phalanges.** The middle and distal phalanges of the little toe are described as often fused; the model has them separate (as the 206 count assumes), and the text says so without giving a percentage.

## Soft tissue: mapping (Milestone 6, session Q)

How the source's soft-tissue meshes became IDs (`content/soft-ids.json`, `assets/mapping/soft-to-id.json`, generated by `scripts/mapping/generate_soft_ids.py`). The audit behind them is `assets/audit/REPORT-soft-tissue.md`. Items 37 to 39 follow defaults the user accepted on 2026-11-20; the rest are session Q's choices.

### Muscles

37. **Calcaneal tendon:** a tendon part of **gastrocnemius**, with `alsoServes: soleus` (spec §3 allows one parent only). Plantaris, which often joins it, isn't listed.
38. **Iliotibial tract:** a tendon part of **tensor fasciae latae**, also serving gluteus maximus. Because the muscle now has a part, its own mesh became a part too, "Belly of tensor fasciae latae" (a parent muscle has no mesh of its own, spec §2.7). **Palmar aponeurosis** is handled the same way, as an aponeurosis part of palmaris longus beside "Belly of palmaris longus".
39. **Common tendinous ring:** the shared tendon of origin of the four recti, given to **superior rectus**, with the other three under `alsoServes`. The choice of superior rectus is arbitrary; any of the four would do. "Belly of superior rectus" follows from it, as in 38.
40. **Linea alba: left out**, against the accepted default. The source has it as one midline mesh, so it can't be a part of the left or the right rectus abdominis (a part has one parent of its own side). Options: leave it out (now), make it a midline structure in the ligaments layer, or allow midline parts with two parents.
41. **Epicranius:** the source's `Frontalis` and `Occipitalis` became the **frontal and occipital bellies of occipitofrontalis** (TA), with the epicranial aponeurosis as a third part that also serves temporoparietalis. Temporoparietalis stays a muscle of its own.
42. **Adductor magnus:** the source has `(Adductor minimus)` as a separate mesh, so adductor magnus has two parts. The remaining mesh is called **"Main part of adductor magnus"**, which isn't a TA term (TA splits it into an adductor part and a hamstring part, which the mesh doesn't). Better name wanted.
43. **Extensor digitorum longus** has a separate tendon mesh, so it's "Belly of extensor digitorum longus" plus "Tendon of extensor digitorum longus".
44. **Oblique arytenoid** has only one mesh, its ary-epiglottic part, so it's a parent muscle with a single part.
45. **Groups kept as separate muscles,** not parents with parts, as the source has them: iliopsoas (iliacus, psoas major), levator ani (pubococcygeus, iliococcygeus, pubo-analis), erector spinae (iliocostalis, longissimus, spinalis, by region), triceps surae and quadriceps femoris. They are groups in the tree (`group`), and their patches name all their members (item 58).
46. **One mesh for several muscles:** the dorsal and palmar or plantar interossei, the lumbricals, the three intercostal layers, the rotatores, the interspinales, the multifidus and the levatores costarum, one mesh per side and region. Each is one ID with a plural name.
47. **Divisions the source doesn't split:** sternocleidomastoid (sternal and clavicular heads), omohyoid (two bellies), medial pterygoid (two heads) and rectus femoris (straight and reflected heads) are single meshes, so they're single selectable muscles. Noted in the mapping's `notes`.
48. **Laryngeal, pharyngeal and tongue muscles are included** (spec §12 default), although the laryngeal cartilage isn't. So is the external anal sphincter.
49. **Inconstant structures** (in parentheses in the source) are flagged `inconstant: true`: abdominal part of pectoralis major, adductor minimus, opponens digiti minimi of the foot.
50. **Source names kept** that differ from TA's preferred English: "Iliocostalis colli" (TA: cervicis), "Longissimus colli", "Spinalis colli", "Levator nasolabialis" (levator labii superioris alaeque nasi), "Rectus anterior/lateralis capitis" (rectus capitis anterior/lateralis), "Scapular spinal part of deltoid" (spinal part). M8 content can set the display names.

### Ligaments

51. **Ligament parts are separate ligaments:** the deep and superficial parts of the tibial collateral ligament, and the descending and transverse parts of the iliofemoral ligament. Spec §3 defines parts for muscles only. Should ligaments get parents too?
52. **Membranes as ligaments:** the interosseous membranes of forearm and leg, the oblique cord, the external and internal intercostal membranes and the obturator membrane are in the ligaments layer (fibrous sheets between bones, not synovial membranes). The **inguinal ligament**, modelled under external oblique in the source, is in the ligaments layer too.
53. **Left out** (user defaults): the laryngeal ligaments and the quadrangular membrane (they join excluded cartilage), the superficial transverse metacarpal and metatarsal ligaments, the plantar aponeurosis and the tendinous arch of levator ani (fascia).
54. **The patellar ligament has no mesh** in the source. It has an ID (`patellar_ligament_left/right`, `meshAvailable: false`, as for the wisdom teeth) because patches refer to it. So does **articularis genus**. Other absent structures are recorded in `missingNoId` without IDs (craniovertebral ligaments, quadriceps tendon, anterior tibiotalar ligament, some small muscles). Should any of them get IDs too?

### Cartilage

55. **Glenoid and acetabular labra** are in the cartilage layer, kind `cartilage` (fibrocartilage; not in the spec's list).
56. **Sacrococcygeal symphysis** is a `disc`. The **pubic symphysis** mesh is left out, because it overlaps the separate interpubic disc, which is kept.
57. **Nucleus pulposus** meshes are joined into their discs (`merged`): each is inside its disc and not visible on its own. **Articular cartilage** is absent from the source, and the user decided to go on without it (2026-11-20).

### Muscular-insertion patches (`attachments` in the mapping)

58. **Patches named for a group** list the muscles they serve, from standard anatomy: quadriceps femoris (rectus femoris, the three vasti), triceps surae (gastrocnemius, soleus), iliopsoas (iliacus, psoas major), erector spinae origin (iliocostalis lumborum, longissimus thoracis, spinalis thoracis), levator ani origin (its three parts), the **common extensor tendon** (extensor carpi radialis brevis, extensor digitorum, extensor digiti minimi, humeral head of extensor carpi ulnaris) and the **common flexor tendon** (superficial head of pronator teres, flexor carpi radialis, palmaris longus, humero-ulnar head of flexor digitorum superficialis, humeral head of flexor carpi ulnaris). Please check the two common tendons.
59. **"Trochanteric insertion"** is a pair of patches on the greater trochanter. The name doesn't say which muscle (gluteus minimus? obturator internus and the gemelli? piriformis?), so it's kept with **no muscle** assigned.
60. **Rectus abdominis:** its insertion patches lie 144 mm from any bone and are **left out**; its origin patches lie on costal cartilages 5 to 7, where the muscle inserts, so the source's labels **look swapped**. They're kept with a `flag`. Origins and insertions in the content come from references, never from patch labels.
61. **Missing twins:** Some patches exist on one side only, often under the other side's name (12 entries, 23 patches: serratus anterior and serratus posterior, plantar interossei, pronator quadratus, piriformis, pectineus, procerus, short heads of biceps brachii and biceps femoris). The missing side is listed in `attachmentsMissing`. Nothing is mirrored.
62. **Patches on excluded structures are dropped:** thyrohyoid's insertion (thyroid cartilage), and the adductor hallucis patches on the hallux sesamoids.
