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
