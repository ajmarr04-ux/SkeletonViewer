// The `muscleAttachments` migration's matcher (musculoskeletal spec §4.6; M8
// plan decision 13): an old free-text string on a bone → the side-free muscle
// or part IDs it means. Exact names first, then the variant table below. Pure,
// so the tests can check it; scripts/content/migrate-attachments.ts runs it on
// every bone file.

export type MatchRule = "name" | "variant" | "unmatched";
export type Match = {
  /** Side-free muscle or part IDs (`triceps_brachii_long_head`). Empty when unmatched. */
  ids: string[];
  rule: MatchRule;
  /**
   * The old string names an attachment made through something else (a costal
   * cartilage, the patellar ligament, a fascia): the muscle's own attachment
   * is on that structure, not on the bone. Session AD's two-way check allows it.
   */
  indirect?: boolean;
  note?: string;
  /** QUESTIONS.md entry for an unmatched string. */
  question?: number;
};

type Variant = Omit<Match, "rule"> | ((bone: string) => Omit<Match, "rule">);

const HAND = /hand|metacarpal|pisiform|hamate|capitate|trapezium|trapezoid|scaphoid|lunate|triquetrum/;
const FOOT = /foot|metatarsal|calcaneus|talus|cuboid|navicular|cuneiform/;
/** The hand or foot version of a muscle named the same in both, by the bone it was listed on. */
const handOrFoot =
  (base: string): Variant =>
  (bone) => {
    if (HAND.test(bone)) return { ids: [`${base}_hand`] };
    if (FOOT.test(bone)) return { ids: [`${base}_foot`] };
    return { ids: [], note: `${bone} is in neither the hand nor the foot` };
  };
const interosseus =
  (kind: "dorsal" | "palmar" | "plantar"): Variant =>
  (bone) => {
    if (kind === "palmar") return { ids: ["palmar_interossei"], note: "The source has the palmar interossei as one object" };
    if (kind === "plantar") return { ids: ["plantar_interossei"], note: "The source has the plantar interossei as one object" };
    const v = (handOrFoot("dorsal_interossei") as (b: string) => Omit<Match, "rule">)(bone);
    return { ...v, note: "The source has the dorsal interossei of each hand and foot as one object" };
  };
const unmatched = (question: number, note: string): Variant => ({ ids: [], note, question });

/** Old strings that aren't a source name, by string (plan decision 13). */
export const VARIANTS: Record<string, Variant> = {
  "Abductor digiti minimi": handOrFoot("abductor_digiti_minimi"),
  "Flexor digiti minimi brevis": handOrFoot("flexor_digiti_minimi"),
  "Opponens digiti minimi": handOrFoot("opponens_digiti_minimi"),
  "First dorsal interosseous": interosseus("dorsal"),
  "Second dorsal interosseous": interosseus("dorsal"),
  "Third dorsal interosseous": interosseus("dorsal"),
  "Fourth dorsal interosseous": interosseus("dorsal"),
  "First palmar interosseous": interosseus("palmar"),
  "Second palmar interosseous": interosseus("palmar"),
  "Third palmar interosseous": interosseus("palmar"),
  "First plantar interosseous": interosseus("plantar"),
  "Second plantar interosseous": interosseus("plantar"),
  "Third plantar interosseous": interosseus("plantar"),
  "Adductor hallucis (oblique head)": { ids: ["adductor_hallucis_oblique_head"] },
  "Adductor pollicis (oblique head)": { ids: ["adductor_pollicis_oblique_head"] },
  "Adductor pollicis (transverse head)": { ids: ["adductor_pollicis_transverse_head"] },
  "Biceps femoris (long head)": { ids: ["biceps_femoris_long_head"] },
  "Biceps femoris (short head)": { ids: ["biceps_femoris_short_head"] },
  "Digastric (anterior belly)": { ids: ["digastric_anterior_belly"] },
  "Digastric (posterior belly)": { ids: ["digastric_posterior_belly"] },
  "Digastric (through a fibrous loop)": { ids: ["digastric_intermediate_tendon"], indirect: true, note: "The intermediate tendon is held to the hyoid by a fibrous sling" },
  "Flexor digitorum superficialis (humero-ulnar head)": { ids: ["flexor_digitorum_superficialis_humero_ulnar_head"] },
  "Flexor digitorum superficialis (radial head)": { ids: ["flexor_digitorum_superficialis_radial_head"] },
  "Occipitofrontalis (occipital belly)": { ids: ["occipitofrontalis_occipital_belly"] },
  "Orbicularis oculi (orbital part)": { ids: ["orbicularis_oculi_orbital_part"] },
  "Orbicularis oculi (lacrimal part)": { ids: ["orbicularis_oculi_palpebral_part"], note: "The source has no lacrimal part; it is the deep palpebral part" },
  "Pronator teres (ulnar head)": { ids: ["pronator_teres_deep_head"], note: "The source calls the ulnar head the deep head" },
  "Triceps brachii (long head)": { ids: ["triceps_brachii_long_head"] },
  "Triceps brachii (lateral and medial heads)": { ids: ["triceps_brachii_lateral_head", "triceps_brachii_medial_head"] },
  "Medial pterygoid (superficial head)": { ids: ["medial_pterygoid"], note: "The source has medial pterygoid as one object, without heads" },
  "Sternocleidomastoid (sternal head)": { ids: ["sternocleidomastoid"], note: "The source has sternocleidomastoid as one object, without heads" },
  Buccinator: { ids: ["bucinator"], note: "The source spells it bucinator (TA2)" },
  "External oblique": { ids: ["external_abdominal_oblique"] },
  "Internal oblique": { ids: ["internal_abdominal_oblique"] },
  "Obliquus capitis inferior": { ids: ["obliquus_inferior_capitis"] },
  "Obliquus capitis superior": { ids: ["obliquus_superior_capitis"] },
  "Rectus capitis anterior": { ids: ["rectus_anterior_capitis"] },
  "Rectus capitis lateralis": { ids: ["rectus_lateralis_capitis"] },
  "Rectus capitis posterior major": { ids: ["rectus_posterior_major_capitis"] },
  "Rectus capitis posterior minor": { ids: ["rectus_posterior_minor_capitis"] },
  "Semispinalis cervicis": { ids: ["semispinalis_colli"], note: "The source uses colli for cervicis" },
  "Splenius cervicis": { ids: ["splenius_colli"], note: "The source uses colli for cervicis" },
  "Common extensor origin": {
    ids: ["extensor_carpi_radialis_brevis", "extensor_digitorum", "extensor_digiti_minimi", "extensor_carpi_ulnaris_humeral_head"],
    note: "The common extensor tendon on the lateral epicondyle",
  },
  "Common flexor origin": {
    ids: ["pronator_teres_superficial_head", "flexor_carpi_radialis", "palmaris_longus", "flexor_digitorum_superficialis_humero_ulnar_head", "flexor_carpi_ulnaris_humeral_head"],
    note: "The common flexor tendon on the medial epicondyle",
  },
  "Diaphragm (crus)": { ids: ["diaphragm"], note: "The source has the diaphragm as one object" },
  "Diaphragm (through its costal cartilage)": { ids: ["diaphragm"], indirect: true, note: "Attached to the costal cartilages, not the ribs" },
  "Rectus abdominis (through its costal cartilage)": { ids: ["rectus_abdominis"], indirect: true, note: "Attached to the costal cartilages, not the ribs" },
  "Transversus abdominis (through its costal cartilage)": { ids: ["transversus_abdominis"], indirect: true, note: "Attached to the costal cartilages, not the ribs" },
  "Quadriceps femoris (through the patellar ligament)": {
    ids: ["rectus_femoris", "vastus_lateralis", "vastus_medialis", "vastus_intermedius"],
    indirect: true,
    note: "The four heads are separate muscles in the source; they reach the tibia through the patellar ligament",
  },
  "Latissimus dorsi (through the thoracolumbar fascia)": { ids: ["latissimus_dorsi"], indirect: true, note: "Through the thoracolumbar fascia" },
  "External anal sphincter (through the anococcygeal ligament)": { ids: ["external_anal_sphincter"], indirect: true, note: "Through the anococcygeal ligament" },
  "Extra-ocular muscles (from the common tendinous ring)": { ids: ["common_tendinous_ring"], note: "The ring is a part of superior rectus serving the four recti (QUESTIONS 39)" },
  "Erector spinae": {
    ids: ["iliocostalis_lumborum", "longissimus_thoracis", "spinalis_thoracis"],
    note: "The common origin of erector spinae; the source has its columns as separate muscles",
  },
  Iliocostalis: { ids: ["iliocostalis_lumborum", "iliocostalis_thoracis", "iliocostalis_colli"], note: "The source has iliocostalis in three parts" },
  Iliopsoas: { ids: ["psoas_major", "iliacus"], note: "The source has psoas major and iliacus as separate muscles" },
  "Intercostal muscles": { ids: ["external_intercostal", "internal_intercostal", "innermost_intercostal"] },
  Interspinales: { ids: ["interspinales_colli", "interspinales_thoracis", "interspinales_lumborum"] },
  Multifidus: { ids: ["multifidus_colli", "multifidus_thoracis", "multifidus_lumborum"] },
  "Levatores costarum": { ids: ["levatores_breves_costarum", "levatores_longi_costarum"] },
  "Levator ani": { ids: ["iliococcygeus", "pubococcygeus", "pubo_analis"], note: "The source has the parts of levator ani as separate muscles" },
  "Levator ani (iliococcygeus)": { ids: ["iliococcygeus"] },
  "Musculus uvulae": unmatched(70, "Not in the source"),
  "Semispinalis capitis": unmatched(70, "Not in the source (it has semispinalis colli and thoracis only)"),
  Stapedius: unmatched(70, "Not in the source"),
  Styloglossus: unmatched(70, "Not in the source"),
  "Tensor tympani": unmatched(70, "Not in the source"),
  "Tensor veli palatini": unmatched(70, "Not in the source"),
};

/** Side-free ID by lower-case name, for every left or midline muscle and part with a unique name. */
export function nameIndex(entries: readonly { id: string; name: string; layer: string; side: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  const dup = new Set<string>();
  for (const e of entries) {
    if (e.layer !== "muscles" || e.side === "right") continue;
    const key = e.name.toLowerCase();
    const id = e.id.replace(/_left$/, "");
    if (out.has(key) && out.get(key) !== id) dup.add(key);
    out.set(key, id);
  }
  for (const d of dup) out.delete(d);
  return out;
}

/** What an old string on a bone means. */
export function matchAttachment(text: string, bone: string, names: Map<string, string>): Match {
  const v = VARIANTS[text];
  if (v) {
    const m = typeof v === "function" ? v(bone) : v;
    return { ...m, rule: m.ids.length ? "variant" : "unmatched" };
  }
  const id = names.get(text.toLowerCase());
  return id ? { ids: [id], rule: "name" } : { ids: [], rule: "unmatched", note: "No muscle of that name; add it to VARIANTS" };
}
