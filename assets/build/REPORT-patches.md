# Attachment patches against the content (M9 plan decision 6)

Written by `npm run content:patch-check`; do not edit by hand. Informational: the content decides what is drawn.
A patch is drawn as an origin (or insertion) of the selected muscle or part only if it serves that structure (or the muscle's parts, or the part's muscle) **and** the content names the bone it lies on in that role. A structure the content names with no agreeing patch is tinted whole (fallback).

## Summary

| | All | Left and midline |
| --- | --- | --- |
| Patches | 697 | 343 |
| Patches drawn for at least one muscle or part | 512 | 252 |
| Patches with no matching content attachment (never drawn) | 185 | 91 |
| Content attachments with no patch (whole-structure tint) | 1373 | 700 |
| Muscles and parts | 537 | 270 |
| Muscles and parts with a structure both origin and insertion, no patch (origin tint + outline) | 30 | 15 |
| Structures both synergist and antagonist of a muscle or part (shown as synergists) | 846 | 423 |

The tables below list the left and midline, then any right-side row that isn't the mirror of a left one: the content mirrors, but the source's patches don't always come in pairs (22 exist on the right only, 1 on the left only, and serratus anterior's are numbered differently).

## Patches with no matching content attachment

Either the patch's name is wrong (M6 found some), or the content leaves out an attachment the source models. Never drawn.

| Patch | Serves | End | Lies on | What the content says |
| --- | --- | --- | --- | --- |
| `adductor_hallucis_oblique_head_left__origin_2` | `adductor_hallucis_oblique_head_left` | origin | `cuboid_left` | adductor_hallucis_oblique_head_left: metatarsal_2_left, metatarsal_3_left, metatarsal_4_left, soft: sheath of the fibularis longus tendon |
| `adductor_hallucis_transverse_head_left__insertion` | `adductor_hallucis_transverse_head_left` | insertion | `metatarsal_5_left` | adductor_hallucis_transverse_head_left: insertion inherited |
| `adductor_hallucis_transverse_head_left__insertion_2` | `adductor_hallucis_transverse_head_left` | insertion | `metatarsal_4_left` | adductor_hallucis_transverse_head_left: insertion inherited |
| `adductor_hallucis_transverse_head_left__insertion_3` | `adductor_hallucis_transverse_head_left` | insertion | `metatarsal_3_left` | adductor_hallucis_transverse_head_left: insertion inherited |
| `adductor_pollicis_left__insertion_2` | `adductor_pollicis_left` | insertion | `capitate_left` | adductor_pollicis_left: proximal_phalanx_hand_1_left, soft: ulnar sesamoid of the thumb and the extensor expansion of the thumb |
| `digastric_anterior_belly_left__insertion` | `digastric_anterior_belly_left` | insertion | `mandible` | digastric_anterior_belly_left: digastric_intermediate_tendon_left |
| `extensor_carpi_ulnaris_left__insertion` | `extensor_carpi_ulnaris_left` | insertion | `triquetrum_left` | extensor_carpi_ulnaris_left: metacarpal_5_left |
| `extensor_digitorum_left__insertion` | `extensor_digitorum_left` | insertion | `proximal_phalanx_hand_4_left` | extensor_digitorum_left: middle_phalanx_hand_2_left, distal_phalanx_hand_2_left, middle_phalanx_hand_3_left, distal_phalanx_hand_3_left, middle_phalanx_hand_4_left, distal_phalanx_hand_4_left, middle_phalanx_hand_5_left, distal_phalanx_hand_5_left |
| `extensor_digitorum_left__insertion_2` | `extensor_digitorum_left` | insertion | `proximal_phalanx_hand_3_left` | extensor_digitorum_left: middle_phalanx_hand_2_left, distal_phalanx_hand_2_left, middle_phalanx_hand_3_left, distal_phalanx_hand_3_left, middle_phalanx_hand_4_left, distal_phalanx_hand_4_left, middle_phalanx_hand_5_left, distal_phalanx_hand_5_left |
| `extensor_digitorum_left__insertion_3` | `extensor_digitorum_left` | insertion | `proximal_phalanx_hand_2_left` | extensor_digitorum_left: middle_phalanx_hand_2_left, distal_phalanx_hand_2_left, middle_phalanx_hand_3_left, distal_phalanx_hand_3_left, middle_phalanx_hand_4_left, distal_phalanx_hand_4_left, middle_phalanx_hand_5_left, distal_phalanx_hand_5_left |
| `extensor_digitorum_left__insertion_8` | `extensor_digitorum_left` | insertion | `proximal_phalanx_hand_5_left` | extensor_digitorum_left: middle_phalanx_hand_2_left, distal_phalanx_hand_2_left, middle_phalanx_hand_3_left, distal_phalanx_hand_3_left, middle_phalanx_hand_4_left, distal_phalanx_hand_4_left, middle_phalanx_hand_5_left, distal_phalanx_hand_5_left |
| `extensor_hallucis_longus_left__insertion` | `extensor_hallucis_longus_left` | insertion | `proximal_phalanx_foot_1_left` | extensor_hallucis_longus_left: distal_phalanx_foot_1_left |
| `external_abdominal_oblique_left__origin_4` | `external_abdominal_oblique_left` | origin | `hip_bone_left` | external_abdominal_oblique_left: rib_5_left, rib_6_left, rib_7_left, rib_8_left, rib_9_left, rib_10_left, rib_11_left, rib_12_left |
| `external_abdominal_oblique_left__origin_5` | `external_abdominal_oblique_left` | origin | `hip_bone_left` | external_abdominal_oblique_left: rib_5_left, rib_6_left, rib_7_left, rib_8_left, rib_9_left, rib_10_left, rib_11_left, rib_12_left |
| `flexor_hallucis_brevis_lateral_head_left__origin` | `flexor_hallucis_brevis_lateral_head_left` | origin | `metatarsal_1_left` | flexor_hallucis_brevis_lateral_head_left: origin inherited |
| `flexor_hallucis_brevis_lateral_head_left__origin_2` | `flexor_hallucis_brevis_lateral_head_left` | origin | `medial_cuneiform_left` | flexor_hallucis_brevis_lateral_head_left: origin inherited |
| `flexor_pollicis_brevis_deep_head_left__origin` | `flexor_pollicis_brevis_deep_head_left` | origin | `metacarpal_1_left` | flexor_pollicis_brevis_deep_head_left: trapezoid_left, capitate_left |
| `flexor_pollicis_longus_left__origin_2` | `flexor_pollicis_longus_left` | origin | `ulna_left` | flexor_pollicis_longus_left: radius_left, interosseous_membrane_forearm_left |
| `internal_abdominal_oblique_left__origin` | `internal_abdominal_oblique_left` | origin | `costal_cartilage_10_left` | internal_abdominal_oblique_left: soft: thoracolumbar fascia, hip_bone_left, inguinal_ligament_left |
| `internal_abdominal_oblique_left__origin_2` | `internal_abdominal_oblique_left` | origin | `rib_10_left` | internal_abdominal_oblique_left: soft: thoracolumbar fascia, hip_bone_left, inguinal_ligament_left |
| `internal_abdominal_oblique_left__origin_4` | `internal_abdominal_oblique_left` | origin | `rib_11_left` | internal_abdominal_oblique_left: soft: thoracolumbar fascia, hip_bone_left, inguinal_ligament_left |
| `internal_abdominal_oblique_left__origin_5` | `internal_abdominal_oblique_left` | origin | `rib_12_left` | internal_abdominal_oblique_left: soft: thoracolumbar fascia, hip_bone_left, inguinal_ligament_left |
| `lateral_pterygoid_left__origin` | `lateral_pterygoid_left` | origin | `maxilla_left` | lateral_pterygoid_left: no origin |
| `lateral_pterygoid_left__origin_2` | `lateral_pterygoid_left` | origin | `palatine_bone_left` | lateral_pterygoid_left: no origin |
| `latissimus_dorsi_left__insertion` | `latissimus_dorsi_left` | insertion | `scapula_left` | latissimus_dorsi_left: humerus_left |
| `levatores_longi_costarum_left__insertion_11` | `levatores_longi_costarum_left` | insertion | `rib_2_left` | levatores_longi_costarum_left: rib_9_left, rib_10_left, rib_11_left, rib_12_left |
| `levatores_longi_costarum_left__insertion_2` | `levatores_longi_costarum_left` | insertion | `rib_3_left` | levatores_longi_costarum_left: rib_9_left, rib_10_left, rib_11_left, rib_12_left |
| `levatores_longi_costarum_left__insertion_3` | `levatores_longi_costarum_left` | insertion | `rib_4_left` | levatores_longi_costarum_left: rib_9_left, rib_10_left, rib_11_left, rib_12_left |
| `levatores_longi_costarum_left__insertion_4` | `levatores_longi_costarum_left` | insertion | `rib_5_left` | levatores_longi_costarum_left: rib_9_left, rib_10_left, rib_11_left, rib_12_left |
| `levatores_longi_costarum_left__insertion_5` | `levatores_longi_costarum_left` | insertion | `rib_6_left` | levatores_longi_costarum_left: rib_9_left, rib_10_left, rib_11_left, rib_12_left |
| `levatores_longi_costarum_left__insertion_6` | `levatores_longi_costarum_left` | insertion | `rib_7_left` | levatores_longi_costarum_left: rib_9_left, rib_10_left, rib_11_left, rib_12_left |
| `levatores_longi_costarum_left__insertion_7` | `levatores_longi_costarum_left` | insertion | `rib_8_left` | levatores_longi_costarum_left: rib_9_left, rib_10_left, rib_11_left, rib_12_left |
| `long_plantar_ligament_left__origin` | `long_plantar_ligament_left` | origin | `metatarsal_1_left` | long_plantar_ligament_left: not a muscle (ligament) |
| `long_plantar_ligament_left__origin_2` | `long_plantar_ligament_left` | origin | `metatarsal_2_left` | long_plantar_ligament_left: not a muscle (ligament) |
| `long_plantar_ligament_left__origin_3` | `long_plantar_ligament_left` | origin | `metatarsal_3_left` | long_plantar_ligament_left: not a muscle (ligament) |
| `long_plantar_ligament_left__origin_4` | `long_plantar_ligament_left` | origin | `metatarsal_4_left` | long_plantar_ligament_left: not a muscle (ligament) |
| `long_plantar_ligament_left__origin_5` | `long_plantar_ligament_left` | origin | `calcaneus_left` | long_plantar_ligament_left: not a muscle (ligament) |
| `longissimus_thoracis_left__insertion_11` | `longissimus_thoracis_left` | insertion | `vertebra_l2` | longissimus_thoracis_left: vertebra_t1, vertebra_t2, vertebra_t3, vertebra_t4, vertebra_t5, vertebra_t6, vertebra_t7, vertebra_t8, vertebra_t9, vertebra_t10, vertebra_t11, vertebra_t12, rib_3_left, rib_4_left, rib_5_left, rib_6_left, rib_7_left, rib_8_left, rib_9_left, rib_10_left, rib_11_left, rib_12_left |
| `longissimus_thoracis_left__insertion_14` | `longissimus_thoracis_left` | insertion | `rib_2_left` | longissimus_thoracis_left: vertebra_t1, vertebra_t2, vertebra_t3, vertebra_t4, vertebra_t5, vertebra_t6, vertebra_t7, vertebra_t8, vertebra_t9, vertebra_t10, vertebra_t11, vertebra_t12, rib_3_left, rib_4_left, rib_5_left, rib_6_left, rib_7_left, rib_8_left, rib_9_left, rib_10_left, rib_11_left, rib_12_left |
| `longissimus_thoracis_left__insertion_16` | `longissimus_thoracis_left` | insertion | `rib_1_left` | longissimus_thoracis_left: vertebra_t1, vertebra_t2, vertebra_t3, vertebra_t4, vertebra_t5, vertebra_t6, vertebra_t7, vertebra_t8, vertebra_t9, vertebra_t10, vertebra_t11, vertebra_t12, rib_3_left, rib_4_left, rib_5_left, rib_6_left, rib_7_left, rib_8_left, rib_9_left, rib_10_left, rib_11_left, rib_12_left |
| `longissimus_thoracis_left__insertion_19` | `longissimus_thoracis_left` | insertion | `vertebra_l1` | longissimus_thoracis_left: vertebra_t1, vertebra_t2, vertebra_t3, vertebra_t4, vertebra_t5, vertebra_t6, vertebra_t7, vertebra_t8, vertebra_t9, vertebra_t10, vertebra_t11, vertebra_t12, rib_3_left, rib_4_left, rib_5_left, rib_6_left, rib_7_left, rib_8_left, rib_9_left, rib_10_left, rib_11_left, rib_12_left |
| `longissimus_thoracis_left__insertion_27` | `longissimus_thoracis_left` | insertion | `vertebra_l3` | longissimus_thoracis_left: vertebra_t1, vertebra_t2, vertebra_t3, vertebra_t4, vertebra_t5, vertebra_t6, vertebra_t7, vertebra_t8, vertebra_t9, vertebra_t10, vertebra_t11, vertebra_t12, rib_3_left, rib_4_left, rib_5_left, rib_6_left, rib_7_left, rib_8_left, rib_9_left, rib_10_left, rib_11_left, rib_12_left |
| `longus_capitis_left__origin` | `longus_capitis_left` | origin | `occipital_bone` | longus_capitis_left: vertebra_c3, vertebra_c4, vertebra_c5, vertebra_c6 |
| `nasalis_left__origin` | `nasalis_left` | origin | `nasal_bone_left` | nasalis_left: maxilla_left |
| `obliquus_inferior_capitis_left__insertion` | `obliquus_inferior_capitis_left` | insertion | `vertebra_c2` | obliquus_inferior_capitis_left: vertebra_c1 |
| `obliquus_inferior_capitis_left__origin` | `obliquus_inferior_capitis_left` | origin | `vertebra_c1` | obliquus_inferior_capitis_left: vertebra_c2 |
| `obliquus_superior_capitis_left__origin` | `obliquus_superior_capitis_left` | origin | `occipital_bone` | obliquus_superior_capitis_left: vertebra_c1 |
| `occipitofrontalis_frontal_belly_left__origin` | `occipitofrontalis_frontal_belly_left` | origin | `frontal_bone` | occipitofrontalis_frontal_belly_left: epicranial_aponeurosis_left |
| `patellar_ligament_left__insertion` | `patellar_ligament_left` | insertion | `tibia_left` | patellar_ligament_left: not a muscle (ligament) |
| `patellar_ligament_left__origin` | `patellar_ligament_left` | origin | `patella_left` | patellar_ligament_left: not a muscle (ligament) |
| `pectoralis_major_abdominal_part_left__origin` | `pectoralis_major_abdominal_part_left` | origin | `costal_cartilage_7_left` | pectoralis_major_abdominal_part_left: soft: aponeurosis of external abdominal oblique, soft: anterior layer of the rectus sheath |
| `pectoralis_major_sternocostal_head_left__insertion` | `pectoralis_major_sternocostal_head_left` | insertion | `sternum` | pectoralis_major_sternocostal_head_left: insertion inherited |
| `pectoralis_major_sternocostal_head_left__insertion_2` | `pectoralis_major_sternocostal_head_left` | insertion | `sternum` | pectoralis_major_sternocostal_head_left: insertion inherited |
| `pectoralis_major_sternocostal_head_left__insertion_3` | `pectoralis_major_sternocostal_head_left` | insertion | `costal_cartilage_6_left` | pectoralis_major_sternocostal_head_left: insertion inherited |
| `pectoralis_minor_left__insertion` | `pectoralis_minor_left` | insertion | `rib_4_left` | pectoralis_minor_left: scapula_left |
| `pectoralis_minor_left__insertion_2` | `pectoralis_minor_left` | insertion | `rib_5_left` | pectoralis_minor_left: scapula_left |
| `pectoralis_minor_left__insertion_3` | `pectoralis_minor_left` | insertion | `rib_3_left` | pectoralis_minor_left: scapula_left |
| `pectoralis_minor_left__origin` | `pectoralis_minor_left` | origin | `scapula_left` | pectoralis_minor_left: rib_3_left, rib_4_left, rib_5_left |
| `procerus_left__insertion` | `procerus_left` | insertion | `nasal_bone_right` | procerus_left: soft: skin between the eyebrows |
| `procerus_left__origin` | `procerus_left` | origin | `frontal_bone` | procerus_left: nasal_bone_left, soft: upper part of the lateral nasal cartilage |
| `rectus_abdominis_left__origin` | `rectus_abdominis_left` | origin | `costal_cartilage_5_left` | rectus_abdominis_left: hip_bone_left, hip_bone_left |
| `rectus_anterior_capitis_left__insertion` | `rectus_anterior_capitis_left` | insertion | `vertebra_c1` | rectus_anterior_capitis_left: occipital_bone |
| `rectus_anterior_capitis_left__origin` | `rectus_anterior_capitis_left` | origin | `occipital_bone` | rectus_anterior_capitis_left: vertebra_c1 |
| `rectus_lateralis_capitis_left__origin` | `rectus_lateralis_capitis_left` | origin | `occipital_bone` | rectus_lateralis_capitis_left: vertebra_c1 |
| `rectus_posterior_major_capitis_left__insertion` | `rectus_posterior_major_capitis_left` | insertion | `vertebra_c2` | rectus_posterior_major_capitis_left: occipital_bone |
| `rectus_posterior_major_capitis_left__origin` | `rectus_posterior_major_capitis_left` | origin | `occipital_bone` | rectus_posterior_major_capitis_left: vertebra_c2 |
| `rectus_posterior_minor_capitis_left__insertion` | `rectus_posterior_minor_capitis_left` | insertion | `vertebra_c1` | rectus_posterior_minor_capitis_left: occipital_bone |
| `rectus_posterior_minor_capitis_left__origin` | `rectus_posterior_minor_capitis_left` | origin | `occipital_bone` | rectus_posterior_minor_capitis_left: vertebra_c1 |
| `scalenus_anterior_left__insertion` | `scalenus_anterior_left` | insertion | `vertebra_c5` | scalenus_anterior_left: rib_1_left |
| `scalenus_anterior_left__insertion_2` | `scalenus_anterior_left` | insertion | `vertebra_c6` | scalenus_anterior_left: rib_1_left |
| `scalenus_anterior_left__insertion_3` | `scalenus_anterior_left` | insertion | `vertebra_c4` | scalenus_anterior_left: rib_1_left |
| `scalenus_anterior_left__origin` | `scalenus_anterior_left` | origin | `rib_1_left` | scalenus_anterior_left: vertebra_c3, vertebra_c4, vertebra_c5, vertebra_c6 |
| `scalenus_medius_left__insertion` | `scalenus_medius_left` | insertion | `vertebra_c7` | scalenus_medius_left: rib_1_left |
| `scalenus_medius_left__insertion_2` | `scalenus_medius_left` | insertion | `vertebra_c6` | scalenus_medius_left: rib_1_left |
| `scalenus_medius_left__origin` | `scalenus_medius_left` | origin | `rib_1_left` | scalenus_medius_left: vertebra_c2, vertebra_c3, vertebra_c4, vertebra_c5, vertebra_c6, vertebra_c7 |
| `scalenus_posterior_left__insertion` | `scalenus_posterior_left` | insertion | `vertebra_c5` | scalenus_posterior_left: rib_2_left |
| `serratus_anterior_left__insertion` | `serratus_anterior_left` | insertion | `rib_3_left` | serratus_anterior_left: scapula_left |
| `serratus_anterior_left__insertion_2` | `serratus_anterior_left` | insertion | `rib_4_left` | serratus_anterior_left: scapula_left |
| `serratus_anterior_left__insertion_3` | `serratus_anterior_left` | insertion | `rib_5_left` | serratus_anterior_left: scapula_left |
| `serratus_anterior_left__insertion_4` | `serratus_anterior_left` | insertion | `rib_6_left` | serratus_anterior_left: scapula_left |
| `serratus_anterior_left__insertion_5` | `serratus_anterior_left` | insertion | `rib_7_left` | serratus_anterior_left: scapula_left |
| `serratus_anterior_left__insertion_6` | `serratus_anterior_left` | insertion | `rib_8_left` | serratus_anterior_left: scapula_left |
| `serratus_anterior_left__insertion_7` | `serratus_anterior_left` | insertion | `rib_1_left` | serratus_anterior_left: scapula_left |
| `serratus_anterior_left__origin` | `serratus_anterior_left` | origin | `scapula_left` | serratus_anterior_left: rib_1_left, rib_2_left, rib_3_left, rib_4_left, rib_5_left, rib_6_left, rib_7_left, rib_8_left |
| `subclavius_left__origin` | `subclavius_left` | origin | `clavicle_left` | subclavius_left: rib_1_left, costal_cartilage_1_left |
| `thyrohyoid_left__origin` | `thyrohyoid_left` | origin | `hyoid_bone` | thyrohyoid_left: soft: oblique line of the thyroid cartilage |
| `trapezius_ascending_part_left__insertion` | `trapezius_ascending_part_left` | insertion | `occipital_bone` | trapezius_ascending_part_left: scapula_left |
| `trapezius_ascending_part_left__origin` | `trapezius_ascending_part_left` | origin | `clavicle_left` | trapezius_ascending_part_left: vertebra_t5, vertebra_t6, vertebra_t7, vertebra_t8, vertebra_t9, vertebra_t10, vertebra_t11, vertebra_t12 |
| `trapezius_descending_part_left__origin` | `trapezius_descending_part_left` | origin | `scapula_left` | trapezius_descending_part_left: occipital_bone, occipital_bone, nuchal_ligament |
| `trapezius_transverse_part_left__origin` | `trapezius_transverse_part_left` | origin | `scapula_left` | trapezius_transverse_part_left: vertebra_c7, vertebra_t1, vertebra_t2, vertebra_t3, vertebra_t4 |
| `trochanteric_insertion_left__insertion` | none | insertion | `femur_left` | serves no structure |
| `biceps_femoris_short_head_right__insertion` | `biceps_femoris_short_head_right` | insertion | `femur_right` | biceps_femoris_short_head_right: insertion inherited |
| `serratus_anterior_right__insertion` | `serratus_anterior_right` | insertion | `rib_2_right` | serratus_anterior_right: scapula_right |
| `serratus_anterior_right__insertion_2` | `serratus_anterior_right` | insertion | `rib_3_right` | serratus_anterior_right: scapula_right |
| `serratus_anterior_right__insertion_3` | `serratus_anterior_right` | insertion | `rib_4_right` | serratus_anterior_right: scapula_right |
| `serratus_anterior_right__insertion_4` | `serratus_anterior_right` | insertion | `rib_5_right` | serratus_anterior_right: scapula_right |
| `serratus_anterior_right__insertion_5` | `serratus_anterior_right` | insertion | `rib_6_right` | serratus_anterior_right: scapula_right |
| `serratus_anterior_right__insertion_6` | `serratus_anterior_right` | insertion | `rib_7_right` | serratus_anterior_right: scapula_right |
| `serratus_anterior_right__insertion_7` | `serratus_anterior_right` | insertion | `rib_8_right` | serratus_anterior_right: scapula_right |
| `serratus_anterior_right__insertion_8` | `serratus_anterior_right` | insertion | `rib_9_right` | serratus_anterior_right: scapula_right |
| `serratus_anterior_right__insertion_9` | `serratus_anterior_right` | insertion | `rib_1_right` | serratus_anterior_right: scapula_right |
| `serratus_posterior_superior_right__insertion_3` | `serratus_posterior_superior_right` | insertion | `rib_5_right` | serratus_posterior_superior_right: rib_2_right, rib_3_right, rib_4_right |

## Content attachments with no patch

Attachments the content declares itself (not inherited) that no patch of the structure (or its parts, or its muscle) covers. Drawn as a whole-structure tint.

| Muscle or part | Role | Structure |
| --- | --- | --- |
| `abductor_digiti_minimi_foot_left` | origin | `calcaneus_left` |
| `abductor_pollicis_brevis_left` | origin | `scaphoid_left` |
| `abductor_pollicis_brevis_left` | origin | `trapezium_left` |
| `abductor_pollicis_brevis_left` | insertion | `proximal_phalanx_hand_1_left` |
| `abductor_pollicis_longus_left` | origin | `interosseous_membrane_forearm_left` |
| `abductor_pollicis_longus_left` | origin | `radius_left` |
| `adductor_brevis_left` | origin | `hip_bone_left` |
| `adductor_brevis_left` | insertion | `femur_left` |
| `adductor_hallucis_left` | insertion | `proximal_phalanx_foot_1_left` |
| `adductor_hallucis_oblique_head_left` | origin | `metatarsal_2_left` |
| `adductor_hallucis_oblique_head_left` | origin | `metatarsal_3_left` |
| `adductor_hallucis_transverse_head_left` | origin | `deep_transverse_metatarsal_ligament_left` |
| `adductor_hallucis_transverse_head_left` | origin | `plantar_metatarsophalangeal_ligaments_left` |
| `adductor_minimus_left` | origin | `hip_bone_left` |
| `adductor_minimus_left` | insertion | `femur_left` |
| `adductor_pollicis_oblique_head_left` | origin | `capitate_left` |
| `adductor_pollicis_oblique_head_left` | origin | `metacarpal_2_left` |
| `adductor_pollicis_oblique_head_left` | origin | `metacarpal_3_left` |
| `adductor_pollicis_oblique_head_left` | origin | `trapezoid_left` |
| `adductor_pollicis_transverse_head_left` | origin | `metacarpal_3_left` |
| `biceps_brachii_long_head_left` | origin | `glenoid_labrum_left` |
| `biceps_brachii_short_head_left` | origin | `scapula_left` |
| `biceps_femoris_long_head_left` | origin | `sacrotuberous_ligament_left` |
| `biceps_femoris_short_head_left` | origin | `femur_left` |
| `coccygeus_left` | origin | `hip_bone_left` |
| `coccygeus_left` | insertion | `coccyx` |
| `coccygeus_left` | insertion | `sacrum` |
| `common_tendinous_ring_left` | origin | `sphenoid_bone` |
| `coracobrachialis_left` | insertion | `humerus_left` |
| `corrugator_supercilii_left` | origin | `frontal_bone` |
| `diaphragm` | origin | `costal_cartilage_10_left` |
| `diaphragm` | origin | `costal_cartilage_10_right` |
| `diaphragm` | origin | `costal_cartilage_8_left` |
| `diaphragm` | origin | `costal_cartilage_8_right` |
| `diaphragm` | origin | `costal_cartilage_9_left` |
| `diaphragm` | origin | `costal_cartilage_9_right` |
| `diaphragm` | origin | `sternum` |
| `digastric_anterior_belly_left` | origin | `mandible` |
| `digastric_anterior_belly_left` | insertion | `digastric_intermediate_tendon_left` |
| `digastric_intermediate_tendon_left` | insertion | `hyoid_bone` |
| `digastric_posterior_belly_left` | origin | `temporal_bone_left` |
| `digastric_posterior_belly_left` | insertion | `digastric_intermediate_tendon_left` |
| `dorsal_interossei_foot_left` | origin | `metatarsal_1_left` |
| `dorsal_interossei_foot_left` | origin | `metatarsal_2_left` |
| `dorsal_interossei_foot_left` | origin | `metatarsal_3_left` |
| `dorsal_interossei_foot_left` | origin | `metatarsal_4_left` |
| `dorsal_interossei_foot_left` | origin | `metatarsal_5_left` |
| `dorsal_interossei_foot_left` | insertion | `proximal_phalanx_foot_2_left` |
| `dorsal_interossei_foot_left` | insertion | `proximal_phalanx_foot_3_left` |
| `dorsal_interossei_foot_left` | insertion | `proximal_phalanx_foot_4_left` |
| `dorsal_interossei_hand_left` | insertion | `proximal_phalanx_hand_2_left` |
| `dorsal_interossei_hand_left` | insertion | `proximal_phalanx_hand_3_left` |
| `dorsal_interossei_hand_left` | insertion | `proximal_phalanx_hand_4_left` |
| `epicranial_aponeurosis_left` | origin | `occipital_bone` |
| `extensor_carpi_radialis_brevis_left` | origin | `radial_collateral_ligament_left` |
| `extensor_carpi_ulnaris_left` | insertion | `metacarpal_5_left` |
| `extensor_digiti_minimi_left` | insertion | `distal_phalanx_hand_5_left` |
| `extensor_digiti_minimi_left` | insertion | `middle_phalanx_hand_5_left` |
| `extensor_digitorum_brevis_left` | origin | `calcaneus_left` |
| `extensor_digitorum_brevis_left` | insertion | `distal_phalanx_foot_2_left` |
| `extensor_digitorum_brevis_left` | insertion | `distal_phalanx_foot_3_left` |
| `extensor_digitorum_brevis_left` | insertion | `distal_phalanx_foot_4_left` |
| `extensor_digitorum_left` | insertion | `distal_phalanx_hand_2_left` |
| `extensor_digitorum_left` | insertion | `distal_phalanx_hand_3_left` |
| `extensor_digitorum_left` | insertion | `distal_phalanx_hand_4_left` |
| `extensor_digitorum_left` | insertion | `distal_phalanx_hand_5_left` |
| `extensor_digitorum_longus_belly_left` | origin | `interosseous_membrane_leg_left` |
| `extensor_digitorum_longus_left` | insertion | `middle_phalanx_foot_2_left` |
| `extensor_digitorum_longus_left` | insertion | `middle_phalanx_foot_3_left` |
| `extensor_digitorum_longus_left` | insertion | `middle_phalanx_foot_4_left` |
| `extensor_hallucis_brevis_left` | insertion | `proximal_phalanx_foot_1_left` |
| `extensor_hallucis_longus_left` | origin | `interosseous_membrane_leg_left` |
| `extensor_hallucis_longus_left` | insertion | `distal_phalanx_foot_1_left` |
| `extensor_indicis_left` | origin | `interosseous_membrane_forearm_left` |
| `extensor_indicis_left` | insertion | `middle_phalanx_hand_2_left` |
| `extensor_pollicis_brevis_left` | origin | `interosseous_membrane_forearm_left` |
| `extensor_pollicis_longus_left` | origin | `interosseous_membrane_forearm_left` |
| `external_abdominal_oblique_left` | origin | `rib_10_left` |
| `external_abdominal_oblique_left` | origin | `rib_11_left` |
| `external_abdominal_oblique_left` | origin | `rib_12_left` |
| `external_abdominal_oblique_left` | origin | `rib_9_left` |
| `external_abdominal_oblique_left` | insertion | `hip_bone_left` |
| `external_abdominal_oblique_left` | insertion | `inguinal_ligament_left` |
| `external_abdominal_oblique_left` | insertion | `linea_alba` |
| `external_intercostal_left` | origin | `rib_10_left` |
| `external_intercostal_left` | origin | `rib_11_left` |
| `external_intercostal_left` | origin | `rib_1_left` |
| `external_intercostal_left` | origin | `rib_2_left` |
| `external_intercostal_left` | origin | `rib_3_left` |
| `external_intercostal_left` | origin | `rib_4_left` |
| `external_intercostal_left` | origin | `rib_5_left` |
| `external_intercostal_left` | origin | `rib_6_left` |
| `external_intercostal_left` | origin | `rib_7_left` |
| `external_intercostal_left` | origin | `rib_8_left` |
| `external_intercostal_left` | origin | `rib_9_left` |
| `external_intercostal_left` | insertion | `rib_10_left` |
| `external_intercostal_left` | insertion | `rib_11_left` |
| `external_intercostal_left` | insertion | `rib_12_left` |
| `external_intercostal_left` | insertion | `rib_2_left` |
| `external_intercostal_left` | insertion | `rib_3_left` |
| `external_intercostal_left` | insertion | `rib_4_left` |
| `external_intercostal_left` | insertion | `rib_5_left` |
| `external_intercostal_left` | insertion | `rib_6_left` |
| `external_intercostal_left` | insertion | `rib_7_left` |
| `external_intercostal_left` | insertion | `rib_8_left` |
| `external_intercostal_left` | insertion | `rib_9_left` |
| `fibularis_longus_left` | insertion | `medial_cuneiform_left` |
| `fibularis_longus_left` | insertion | `metatarsal_1_left` |
| `fibularis_tertius_left` | origin | `interosseous_membrane_leg_left` |
| `flexor_carpi_radialis_left` | insertion | `metacarpal_2_left` |
| `flexor_carpi_radialis_left` | insertion | `metacarpal_3_left` |
| `flexor_carpi_ulnaris_left` | insertion | `hamate_left` |
| `flexor_carpi_ulnaris_left` | insertion | `metacarpal_5_left` |
| `flexor_digiti_minimi_foot_left` | origin | `metatarsal_5_left` |
| `flexor_digitorum_brevis_left` | insertion | `middle_phalanx_foot_4_left` |
| `flexor_digitorum_profundus_left` | origin | `interosseous_membrane_forearm_left` |
| `flexor_digitorum_profundus_left` | origin | `ulna_left` |
| `flexor_digitorum_superficialis_humero_ulnar_head_left` | origin | `ulna_left` |
| `flexor_digitorum_superficialis_humero_ulnar_head_left` | origin | `ulnar_collateral_ligament_left` |
| `flexor_hallucis_brevis_left` | origin | `cuboid_left` |
| `flexor_hallucis_brevis_left` | origin | `lateral_cuneiform_left` |
| `flexor_hallucis_longus_left` | origin | `interosseous_membrane_leg_left` |
| `flexor_pollicis_brevis_deep_head_left` | origin | `capitate_left` |
| `flexor_pollicis_brevis_deep_head_left` | origin | `trapezoid_left` |
| `flexor_pollicis_brevis_left` | insertion | `proximal_phalanx_hand_1_left` |
| `flexor_pollicis_brevis_superficial_head_left` | origin | `trapezium_left` |
| `flexor_pollicis_longus_left` | origin | `interosseous_membrane_forearm_left` |
| `gastrocnemius_left` | insertion | `calcaneal_tendon_left` |
| `genioglossus_left` | origin | `mandible` |
| `genioglossus_left` | insertion | `hyoid_bone` |
| `gluteus_maximus_left` | origin | `coccyx` |
| `gluteus_maximus_left` | origin | `sacrotuberous_ligament_left` |
| `gluteus_maximus_left` | origin | `sacrum` |
| `gluteus_maximus_left` | insertion | `iliotibial_tract_left` |
| `gluteus_minimus_left` | insertion | `femur_left` |
| `hyoglossus_left` | origin | `hyoid_bone` |
| `iliacus_left` | origin | `sacrum` |
| `iliococcygeus_left` | insertion | `coccyx` |
| `iliocostalis_colli_left` | origin | `rib_3_left` |
| `iliocostalis_colli_left` | origin | `rib_4_left` |
| `iliocostalis_colli_left` | origin | `rib_5_left` |
| `iliocostalis_colli_left` | origin | `rib_6_left` |
| `iliocostalis_colli_left` | insertion | `vertebra_c5` |
| `iliocostalis_colli_left` | insertion | `vertebra_c6` |
| `iliocostalis_lumborum_left` | origin | `sacrum` |
| `iliocostalis_lumborum_left` | origin | `vertebra_l1` |
| `iliocostalis_lumborum_left` | origin | `vertebra_l2` |
| `iliocostalis_lumborum_left` | origin | `vertebra_l3` |
| `iliocostalis_lumborum_left` | origin | `vertebra_l4` |
| `iliocostalis_lumborum_left` | origin | `vertebra_l5` |
| `iliocostalis_lumborum_left` | insertion | `rib_10_left` |
| `iliocostalis_lumborum_left` | insertion | `rib_11_left` |
| `iliocostalis_lumborum_left` | insertion | `rib_12_left` |
| `iliocostalis_lumborum_left` | insertion | `rib_6_left` |
| `iliocostalis_lumborum_left` | insertion | `rib_7_left` |
| `iliocostalis_lumborum_left` | insertion | `rib_8_left` |
| `iliocostalis_lumborum_left` | insertion | `rib_9_left` |
| `iliocostalis_lumborum_left` | insertion | `vertebra_l1` |
| `iliocostalis_lumborum_left` | insertion | `vertebra_l2` |
| `iliocostalis_lumborum_left` | insertion | `vertebra_l3` |
| `iliocostalis_lumborum_left` | insertion | `vertebra_l4` |
| `iliocostalis_thoracis_left` | origin | `rib_10_left` |
| `iliocostalis_thoracis_left` | origin | `rib_11_left` |
| `iliocostalis_thoracis_left` | origin | `rib_12_left` |
| `iliocostalis_thoracis_left` | origin | `rib_7_left` |
| `iliocostalis_thoracis_left` | origin | `rib_8_left` |
| `iliocostalis_thoracis_left` | origin | `rib_9_left` |
| `iliocostalis_thoracis_left` | insertion | `rib_1_left` |
| `iliocostalis_thoracis_left` | insertion | `rib_2_left` |
| `iliocostalis_thoracis_left` | insertion | `rib_3_left` |
| `iliocostalis_thoracis_left` | insertion | `rib_4_left` |
| `iliocostalis_thoracis_left` | insertion | `rib_5_left` |
| `iliocostalis_thoracis_left` | insertion | `rib_6_left` |
| `iliocostalis_thoracis_left` | insertion | `vertebra_c7` |
| `iliotibial_tract_left` | insertion | `tibia_left` |
| `inferior_gemellus_left` | insertion | `femur_left` |
| `inferior_oblique_left` | origin | `maxilla_left` |
| `inferior_rectus_left` | origin | `common_tendinous_ring_left` |
| `innermost_intercostal_left` | origin | `rib_10_left` |
| `innermost_intercostal_left` | origin | `rib_11_left` |
| `innermost_intercostal_left` | origin | `rib_2_left` |
| `innermost_intercostal_left` | origin | `rib_3_left` |
| `innermost_intercostal_left` | origin | `rib_4_left` |
| `innermost_intercostal_left` | origin | `rib_5_left` |
| `innermost_intercostal_left` | origin | `rib_6_left` |
| `innermost_intercostal_left` | origin | `rib_7_left` |
| `innermost_intercostal_left` | origin | `rib_8_left` |
| `innermost_intercostal_left` | origin | `rib_9_left` |
| `innermost_intercostal_left` | insertion | `rib_10_left` |
| `innermost_intercostal_left` | insertion | `rib_11_left` |
| `innermost_intercostal_left` | insertion | `rib_12_left` |
| `innermost_intercostal_left` | insertion | `rib_3_left` |
| `innermost_intercostal_left` | insertion | `rib_4_left` |
| `innermost_intercostal_left` | insertion | `rib_5_left` |
| `innermost_intercostal_left` | insertion | `rib_6_left` |
| `innermost_intercostal_left` | insertion | `rib_7_left` |
| `innermost_intercostal_left` | insertion | `rib_8_left` |
| `innermost_intercostal_left` | insertion | `rib_9_left` |
| `internal_abdominal_oblique_left` | origin | `inguinal_ligament_left` |
| `internal_abdominal_oblique_left` | insertion | `hip_bone_left` |
| `internal_abdominal_oblique_left` | insertion | `linea_alba` |
| `internal_abdominal_oblique_left` | insertion | `rib_10_left` |
| `internal_abdominal_oblique_left` | insertion | `rib_11_left` |
| `internal_abdominal_oblique_left` | insertion | `rib_12_left` |
| `internal_intercostal_left` | origin | `rib_10_left` |
| `internal_intercostal_left` | origin | `rib_11_left` |
| `internal_intercostal_left` | origin | `rib_1_left` |
| `internal_intercostal_left` | origin | `rib_2_left` |
| `internal_intercostal_left` | origin | `rib_3_left` |
| `internal_intercostal_left` | origin | `rib_4_left` |
| `internal_intercostal_left` | origin | `rib_5_left` |
| `internal_intercostal_left` | origin | `rib_6_left` |
| `internal_intercostal_left` | origin | `rib_7_left` |
| `internal_intercostal_left` | origin | `rib_8_left` |
| `internal_intercostal_left` | origin | `rib_9_left` |
| `internal_intercostal_left` | insertion | `rib_10_left` |
| `internal_intercostal_left` | insertion | `rib_11_left` |
| `internal_intercostal_left` | insertion | `rib_12_left` |
| `internal_intercostal_left` | insertion | `rib_2_left` |
| `internal_intercostal_left` | insertion | `rib_3_left` |
| `internal_intercostal_left` | insertion | `rib_4_left` |
| `internal_intercostal_left` | insertion | `rib_5_left` |
| `internal_intercostal_left` | insertion | `rib_6_left` |
| `internal_intercostal_left` | insertion | `rib_7_left` |
| `internal_intercostal_left` | insertion | `rib_8_left` |
| `internal_intercostal_left` | insertion | `rib_9_left` |
| `interspinales_colli_left` | origin | `vertebra_c3` |
| `interspinales_colli_left` | origin | `vertebra_c4` |
| `interspinales_colli_left` | origin | `vertebra_c5` |
| `interspinales_colli_left` | origin | `vertebra_c6` |
| `interspinales_colli_left` | origin | `vertebra_c7` |
| `interspinales_colli_left` | origin | `vertebra_t1` |
| `interspinales_colli_left` | insertion | `vertebra_c2` |
| `interspinales_colli_left` | insertion | `vertebra_c3` |
| `interspinales_colli_left` | insertion | `vertebra_c4` |
| `interspinales_colli_left` | insertion | `vertebra_c5` |
| `interspinales_colli_left` | insertion | `vertebra_c6` |
| `interspinales_colli_left` | insertion | `vertebra_c7` |
| `interspinales_lumborum_left` | origin | `sacrum` |
| `interspinales_lumborum_left` | origin | `vertebra_l2` |
| `interspinales_lumborum_left` | origin | `vertebra_l3` |
| `interspinales_lumborum_left` | origin | `vertebra_l4` |
| `interspinales_lumborum_left` | origin | `vertebra_l5` |
| `interspinales_lumborum_left` | insertion | `vertebra_l1` |
| `interspinales_lumborum_left` | insertion | `vertebra_l2` |
| `interspinales_lumborum_left` | insertion | `vertebra_l3` |
| `interspinales_lumborum_left` | insertion | `vertebra_l4` |
| `interspinales_lumborum_left` | insertion | `vertebra_l5` |
| `interspinales_thoracis_left` | origin | `vertebra_t12` |
| `interspinales_thoracis_left` | origin | `vertebra_t2` |
| `interspinales_thoracis_left` | insertion | `vertebra_t1` |
| `interspinales_thoracis_left` | insertion | `vertebra_t11` |
| `lateral_intertransversarii_lumborum_dorsal_parts_left` | origin | `vertebra_l2` |
| `lateral_intertransversarii_lumborum_dorsal_parts_left` | origin | `vertebra_l3` |
| `lateral_intertransversarii_lumborum_dorsal_parts_left` | origin | `vertebra_l4` |
| `lateral_intertransversarii_lumborum_dorsal_parts_left` | origin | `vertebra_l5` |
| `lateral_intertransversarii_lumborum_dorsal_parts_left` | insertion | `vertebra_l1` |
| `lateral_intertransversarii_lumborum_dorsal_parts_left` | insertion | `vertebra_l2` |
| `lateral_intertransversarii_lumborum_dorsal_parts_left` | insertion | `vertebra_l3` |
| `lateral_intertransversarii_lumborum_dorsal_parts_left` | insertion | `vertebra_l4` |
| `lateral_intertransversarii_lumborum_ventral_parts_left` | origin | `vertebra_l2` |
| `lateral_intertransversarii_lumborum_ventral_parts_left` | origin | `vertebra_l3` |
| `lateral_intertransversarii_lumborum_ventral_parts_left` | origin | `vertebra_l4` |
| `lateral_intertransversarii_lumborum_ventral_parts_left` | origin | `vertebra_l5` |
| `lateral_intertransversarii_lumborum_ventral_parts_left` | insertion | `vertebra_l1` |
| `lateral_intertransversarii_lumborum_ventral_parts_left` | insertion | `vertebra_l2` |
| `lateral_intertransversarii_lumborum_ventral_parts_left` | insertion | `vertebra_l3` |
| `lateral_intertransversarii_lumborum_ventral_parts_left` | insertion | `vertebra_l4` |
| `lateral_pterygoid_inferior_head_left` | origin | `sphenoid_bone` |
| `lateral_pterygoid_left` | insertion | `mandible` |
| `lateral_pterygoid_superior_head_left` | origin | `sphenoid_bone` |
| `lateral_pterygoid_superior_head_left` | insertion | `articular_disc_temporomandibular_joint_left` |
| `lateral_pterygoid_superior_head_left` | insertion | `mandible` |
| `lateral_rectus_left` | origin | `common_tendinous_ring_left` |
| `latissimus_dorsi_left` | origin | `rib_10_left` |
| `latissimus_dorsi_left` | origin | `rib_11_left` |
| `latissimus_dorsi_left` | origin | `rib_12_left` |
| `latissimus_dorsi_left` | origin | `rib_9_left` |
| `latissimus_dorsi_left` | origin | `scapula_left` |
| `latissimus_dorsi_left` | origin | `vertebra_t10` |
| `latissimus_dorsi_left` | origin | `vertebra_t11` |
| `latissimus_dorsi_left` | origin | `vertebra_t12` |
| `latissimus_dorsi_left` | origin | `vertebra_t7` |
| `latissimus_dorsi_left` | origin | `vertebra_t8` |
| `latissimus_dorsi_left` | origin | `vertebra_t9` |
| `latissimus_dorsi_left` | insertion | `humerus_left` |
| `levator_labii_superioris_left` | origin | `zygomatic_bone_left` |
| `levator_palpebrae_superioris_left` | origin | `sphenoid_bone` |
| `levatores_breves_costarum_left` | origin | `vertebra_c7` |
| `levatores_breves_costarum_left` | origin | `vertebra_t1` |
| `levatores_breves_costarum_left` | origin | `vertebra_t10` |
| `levatores_breves_costarum_left` | origin | `vertebra_t11` |
| `levatores_breves_costarum_left` | origin | `vertebra_t2` |
| `levatores_breves_costarum_left` | origin | `vertebra_t3` |
| `levatores_breves_costarum_left` | origin | `vertebra_t4` |
| `levatores_breves_costarum_left` | origin | `vertebra_t5` |
| `levatores_breves_costarum_left` | origin | `vertebra_t6` |
| `levatores_breves_costarum_left` | origin | `vertebra_t7` |
| `levatores_breves_costarum_left` | origin | `vertebra_t8` |
| `levatores_breves_costarum_left` | origin | `vertebra_t9` |
| `levatores_breves_costarum_left` | insertion | `rib_10_left` |
| `levatores_breves_costarum_left` | insertion | `rib_11_left` |
| `levatores_breves_costarum_left` | insertion | `rib_12_left` |
| `levatores_breves_costarum_left` | insertion | `rib_1_left` |
| `levatores_breves_costarum_left` | insertion | `rib_2_left` |
| `levatores_breves_costarum_left` | insertion | `rib_3_left` |
| `levatores_breves_costarum_left` | insertion | `rib_4_left` |
| `levatores_breves_costarum_left` | insertion | `rib_5_left` |
| `levatores_breves_costarum_left` | insertion | `rib_6_left` |
| `levatores_breves_costarum_left` | insertion | `rib_7_left` |
| `levatores_breves_costarum_left` | insertion | `rib_8_left` |
| `levatores_breves_costarum_left` | insertion | `rib_9_left` |
| `levatores_longi_costarum_left` | origin | `vertebra_t10` |
| `levatores_longi_costarum_left` | origin | `vertebra_t7` |
| `levatores_longi_costarum_left` | origin | `vertebra_t8` |
| `levatores_longi_costarum_left` | origin | `vertebra_t9` |
| `linea_alba` | origin | `sternum` |
| `linea_alba` | insertion | `interpubic_disc` |
| `longissimus_capitis_left` | origin | `vertebra_c4` |
| `longissimus_capitis_left` | origin | `vertebra_c5` |
| `longissimus_capitis_left` | origin | `vertebra_c6` |
| `longissimus_capitis_left` | origin | `vertebra_c7` |
| `longissimus_capitis_left` | origin | `vertebra_t1` |
| `longissimus_capitis_left` | origin | `vertebra_t2` |
| `longissimus_capitis_left` | origin | `vertebra_t3` |
| `longissimus_capitis_left` | origin | `vertebra_t4` |
| `longissimus_capitis_left` | origin | `vertebra_t5` |
| `longissimus_capitis_left` | insertion | `temporal_bone_left` |
| `longissimus_colli_left` | origin | `vertebra_t1` |
| `longissimus_colli_left` | origin | `vertebra_t2` |
| `longissimus_colli_left` | origin | `vertebra_t3` |
| `longissimus_colli_left` | origin | `vertebra_t4` |
| `longissimus_colli_left` | origin | `vertebra_t5` |
| `longissimus_colli_left` | insertion | `vertebra_c2` |
| `longissimus_colli_left` | insertion | `vertebra_c3` |
| `longissimus_colli_left` | insertion | `vertebra_c4` |
| `longissimus_colli_left` | insertion | `vertebra_c5` |
| `longissimus_colli_left` | insertion | `vertebra_c6` |
| `longissimus_thoracis_left` | origin | `sacrum` |
| `longissimus_thoracis_left` | origin | `vertebra_l1` |
| `longissimus_thoracis_left` | origin | `vertebra_l2` |
| `longissimus_thoracis_left` | origin | `vertebra_l3` |
| `longissimus_thoracis_left` | origin | `vertebra_l4` |
| `longissimus_thoracis_left` | origin | `vertebra_l5` |
| `longus_capitis_left` | origin | `vertebra_c3` |
| `longus_capitis_left` | origin | `vertebra_c4` |
| `longus_capitis_left` | origin | `vertebra_c5` |
| `longus_capitis_left` | origin | `vertebra_c6` |
| `longus_capitis_left` | insertion | `occipital_bone` |
| `longus_colli_left` | origin | `vertebra_c3` |
| `longus_colli_left` | origin | `vertebra_c4` |
| `longus_colli_left` | origin | `vertebra_c5` |
| `longus_colli_left` | origin | `vertebra_c6` |
| `longus_colli_left` | origin | `vertebra_c7` |
| `longus_colli_left` | origin | `vertebra_t1` |
| `longus_colli_left` | origin | `vertebra_t2` |
| `longus_colli_left` | origin | `vertebra_t3` |
| `longus_colli_left` | insertion | `vertebra_c1` |
| `longus_colli_left` | insertion | `vertebra_c2` |
| `longus_colli_left` | insertion | `vertebra_c3` |
| `longus_colli_left` | insertion | `vertebra_c4` |
| `longus_colli_left` | insertion | `vertebra_c5` |
| `longus_colli_left` | insertion | `vertebra_c6` |
| `lumbrical_foot_left` | origin | `flexor_digitorum_longus_left` |
| `lumbrical_hand_left` | origin | `flexor_digitorum_profundus_left` |
| `masseter_superficial_part_left` | origin | `maxilla_left` |
| `medial_pterygoid_left` | origin | `maxilla_left` |
| `medial_pterygoid_left` | origin | `palatine_bone_left` |
| `medial_rectus_left` | origin | `common_tendinous_ring_left` |
| `middle_pharyngeal_constrictor_left` | origin | `hyoid_bone` |
| `middle_pharyngeal_constrictor_left` | origin | `stylohyoid_ligament_left` |
| `multifidus_colli_left` | origin | `vertebra_c4` |
| `multifidus_colli_left` | origin | `vertebra_c5` |
| `multifidus_colli_left` | origin | `vertebra_c6` |
| `multifidus_colli_left` | origin | `vertebra_c7` |
| `multifidus_colli_left` | insertion | `vertebra_c2` |
| `multifidus_colli_left` | insertion | `vertebra_c3` |
| `multifidus_colli_left` | insertion | `vertebra_c4` |
| `multifidus_colli_left` | insertion | `vertebra_c5` |
| `multifidus_lumborum_left` | origin | `hip_bone_left` |
| `multifidus_lumborum_left` | origin | `sacrum` |
| `multifidus_lumborum_left` | origin | `vertebra_l1` |
| `multifidus_lumborum_left` | origin | `vertebra_l2` |
| `multifidus_lumborum_left` | origin | `vertebra_l3` |
| `multifidus_lumborum_left` | origin | `vertebra_l4` |
| `multifidus_lumborum_left` | origin | `vertebra_l5` |
| `multifidus_lumborum_left` | insertion | `vertebra_l1` |
| `multifidus_lumborum_left` | insertion | `vertebra_l2` |
| `multifidus_lumborum_left` | insertion | `vertebra_l3` |
| `multifidus_lumborum_left` | insertion | `vertebra_l4` |
| `multifidus_lumborum_left` | insertion | `vertebra_l5` |
| `multifidus_lumborum_left` | insertion | `vertebra_t11` |
| `multifidus_lumborum_left` | insertion | `vertebra_t12` |
| `multifidus_thoracis_left` | origin | `vertebra_t1` |
| `multifidus_thoracis_left` | origin | `vertebra_t10` |
| `multifidus_thoracis_left` | origin | `vertebra_t11` |
| `multifidus_thoracis_left` | origin | `vertebra_t12` |
| `multifidus_thoracis_left` | origin | `vertebra_t2` |
| `multifidus_thoracis_left` | origin | `vertebra_t3` |
| `multifidus_thoracis_left` | origin | `vertebra_t4` |
| `multifidus_thoracis_left` | origin | `vertebra_t5` |
| `multifidus_thoracis_left` | origin | `vertebra_t6` |
| `multifidus_thoracis_left` | origin | `vertebra_t7` |
| `multifidus_thoracis_left` | origin | `vertebra_t8` |
| `multifidus_thoracis_left` | origin | `vertebra_t9` |
| `multifidus_thoracis_left` | insertion | `vertebra_c6` |
| `multifidus_thoracis_left` | insertion | `vertebra_c7` |
| `multifidus_thoracis_left` | insertion | `vertebra_t1` |
| `multifidus_thoracis_left` | insertion | `vertebra_t10` |
| `multifidus_thoracis_left` | insertion | `vertebra_t2` |
| `multifidus_thoracis_left` | insertion | `vertebra_t3` |
| `multifidus_thoracis_left` | insertion | `vertebra_t4` |
| `multifidus_thoracis_left` | insertion | `vertebra_t5` |
| `multifidus_thoracis_left` | insertion | `vertebra_t6` |
| `multifidus_thoracis_left` | insertion | `vertebra_t7` |
| `multifidus_thoracis_left` | insertion | `vertebra_t8` |
| `multifidus_thoracis_left` | insertion | `vertebra_t9` |
| `mylohyoid_left` | insertion | `hyoid_bone` |
| `nasalis_left` | origin | `maxilla_left` |
| `obliquus_inferior_capitis_left` | origin | `vertebra_c2` |
| `obliquus_inferior_capitis_left` | insertion | `vertebra_c1` |
| `obliquus_superior_capitis_left` | origin | `vertebra_c1` |
| `obliquus_superior_capitis_left` | insertion | `occipital_bone` |
| `obturator_externus_left` | origin | `obturator_membrane_left` |
| `obturator_externus_left` | insertion | `femur_left` |
| `obturator_internus_left` | origin | `obturator_membrane_left` |
| `obturator_internus_left` | insertion | `femur_left` |
| `occipitofrontalis_frontal_belly_left` | origin | `epicranial_aponeurosis_left` |
| `occipitofrontalis_occipital_belly_left` | origin | `temporal_bone_left` |
| `occipitofrontalis_occipital_belly_left` | insertion | `epicranial_aponeurosis_left` |
| `opponens_digiti_minimi_foot_left` | origin | `long_plantar_ligament_left` |
| `opponens_digiti_minimi_foot_left` | insertion | `metatarsal_5_left` |
| `opponens_digiti_minimi_hand_left` | insertion | `metacarpal_5_left` |
| `opponens_pollicis_left` | origin | `trapezium_left` |
| `opponens_pollicis_left` | insertion | `metacarpal_1_left` |
| `orbicularis_oculi_orbital_part_left` | origin | `frontal_bone` |
| `orbicularis_oculi_palpebral_part_left` | origin | `lacrimal_bone_left` |
| `orbicularis_oris_left` | origin | `maxilla_left` |
| `palatopharyngeus_left` | origin | `palatine_bone_left` |
| `palmar_aponeurosis_left` | insertion | `deep_transverse_metacarpal_ligament_left` |
| `palmar_interossei_left` | origin | `metacarpal_2_left` |
| `palmar_interossei_left` | origin | `metacarpal_4_left` |
| `palmar_interossei_left` | origin | `metacarpal_5_left` |
| `palmar_interossei_left` | insertion | `proximal_phalanx_hand_2_left` |
| `palmar_interossei_left` | insertion | `proximal_phalanx_hand_4_left` |
| `palmar_interossei_left` | insertion | `proximal_phalanx_hand_5_left` |
| `palmaris_longus_left` | insertion | `palmar_aponeurosis_left` |
| `pectineus_left` | insertion | `femur_left` |
| `pectoralis_major_sternocostal_head_left` | origin | `costal_cartilage_1_left` |
| `pectoralis_major_sternocostal_head_left` | origin | `costal_cartilage_2_left` |
| `pectoralis_major_sternocostal_head_left` | origin | `costal_cartilage_3_left` |
| `pectoralis_major_sternocostal_head_left` | origin | `costal_cartilage_4_left` |
| `pectoralis_major_sternocostal_head_left` | origin | `costal_cartilage_5_left` |
| `pectoralis_major_sternocostal_head_left` | origin | `costal_cartilage_6_left` |
| `pectoralis_major_sternocostal_head_left` | origin | `sternum` |
| `pectoralis_minor_left` | origin | `rib_3_left` |
| `pectoralis_minor_left` | origin | `rib_4_left` |
| `pectoralis_minor_left` | origin | `rib_5_left` |
| `pectoralis_minor_left` | insertion | `scapula_left` |
| `piriformis_left` | origin | `sacrotuberous_ligament_left` |
| `piriformis_left` | insertion | `femur_left` |
| `plantar_interossei_left` | origin | `metatarsal_3_left` |
| `plantar_interossei_left` | origin | `metatarsal_4_left` |
| `plantar_interossei_left` | origin | `metatarsal_5_left` |
| `plantar_interossei_left` | insertion | `proximal_phalanx_foot_3_left` |
| `plantar_interossei_left` | insertion | `proximal_phalanx_foot_4_left` |
| `plantar_interossei_left` | insertion | `proximal_phalanx_foot_5_left` |
| `plantaris_left` | origin | `oblique_popliteal_ligament_left` |
| `plantaris_left` | insertion | `calcaneus_left` |
| `platysma_left` | insertion | `mandible` |
| `popliteus_left` | origin | `lateral_meniscus_left` |
| `procerus_left` | origin | `nasal_bone_left` |
| `pronator_quadratus_left` | origin | `ulna_left` |
| `pronator_quadratus_left` | insertion | `radius_left` |
| `pronator_teres_deep_head_left` | origin | `ulna_left` |
| `psoas_major_left` | origin | `vertebra_l1` |
| `psoas_major_left` | origin | `vertebra_l2` |
| `psoas_major_left` | origin | `vertebra_l3` |
| `psoas_major_left` | origin | `vertebra_l4` |
| `psoas_major_left` | origin | `vertebra_l5` |
| `psoas_major_left` | origin | `vertebra_t12` |
| `pubococcygeus_left` | insertion | `coccyx` |
| `pyramidalis_left` | origin | `hip_bone_left` |
| `pyramidalis_left` | insertion | `linea_alba` |
| `quadratus_lumborum_left` | origin | `hip_bone_left` |
| `quadratus_lumborum_left` | origin | `iliolumbar_ligament_left` |
| `quadratus_lumborum_left` | insertion | `rib_12_left` |
| `quadratus_lumborum_left` | insertion | `vertebra_l1` |
| `quadratus_lumborum_left` | insertion | `vertebra_l2` |
| `quadratus_lumborum_left` | insertion | `vertebra_l3` |
| `quadratus_lumborum_left` | insertion | `vertebra_l4` |
| `quadratus_plantae_left` | origin | `calcaneus_left` |
| `quadratus_plantae_left` | origin | `long_plantar_ligament_left` |
| `quadratus_plantae_left` | insertion | `flexor_digitorum_longus_left` |
| `rectus_abdominis_left` | origin | `hip_bone_left` |
| `rectus_abdominis_left` | insertion | `costal_cartilage_5_left` |
| `rectus_abdominis_left` | insertion | `costal_cartilage_6_left` |
| `rectus_abdominis_left` | insertion | `costal_cartilage_7_left` |
| `rectus_abdominis_left` | insertion | `sternum` |
| `rectus_anterior_capitis_left` | origin | `vertebra_c1` |
| `rectus_anterior_capitis_left` | insertion | `occipital_bone` |
| `rectus_femoris_left` | insertion | `patellar_ligament_left` |
| `rectus_lateralis_capitis_left` | origin | `vertebra_c1` |
| `rectus_lateralis_capitis_left` | insertion | `occipital_bone` |
| `rectus_posterior_major_capitis_left` | origin | `vertebra_c2` |
| `rectus_posterior_major_capitis_left` | insertion | `occipital_bone` |
| `rectus_posterior_minor_capitis_left` | origin | `vertebra_c1` |
| `rectus_posterior_minor_capitis_left` | insertion | `occipital_bone` |
| `rhomboid_major_left` | origin | `vertebra_t2` |
| `rhomboid_major_left` | origin | `vertebra_t3` |
| `rhomboid_major_left` | origin | `vertebra_t4` |
| `rhomboid_major_left` | origin | `vertebra_t5` |
| `rhomboid_minor_left` | origin | `nuchal_ligament` |
| `rhomboid_minor_left` | origin | `vertebra_c7` |
| `rhomboid_minor_left` | origin | `vertebra_t1` |
| `rotatores_left` | origin | `vertebra_t10` |
| `rotatores_left` | origin | `vertebra_t11` |
| `rotatores_left` | origin | `vertebra_t12` |
| `rotatores_left` | origin | `vertebra_t2` |
| `rotatores_left` | origin | `vertebra_t3` |
| `rotatores_left` | origin | `vertebra_t4` |
| `rotatores_left` | origin | `vertebra_t5` |
| `rotatores_left` | origin | `vertebra_t6` |
| `rotatores_left` | origin | `vertebra_t7` |
| `rotatores_left` | origin | `vertebra_t8` |
| `rotatores_left` | origin | `vertebra_t9` |
| `rotatores_left` | insertion | `vertebra_t1` |
| `rotatores_left` | insertion | `vertebra_t10` |
| `rotatores_left` | insertion | `vertebra_t11` |
| `rotatores_left` | insertion | `vertebra_t2` |
| `rotatores_left` | insertion | `vertebra_t3` |
| `rotatores_left` | insertion | `vertebra_t4` |
| `rotatores_left` | insertion | `vertebra_t5` |
| `rotatores_left` | insertion | `vertebra_t6` |
| `rotatores_left` | insertion | `vertebra_t7` |
| `rotatores_left` | insertion | `vertebra_t8` |
| `rotatores_left` | insertion | `vertebra_t9` |
| `scalenus_anterior_left` | origin | `vertebra_c3` |
| `scalenus_anterior_left` | origin | `vertebra_c4` |
| `scalenus_anterior_left` | origin | `vertebra_c5` |
| `scalenus_anterior_left` | origin | `vertebra_c6` |
| `scalenus_anterior_left` | insertion | `rib_1_left` |
| `scalenus_medius_left` | origin | `vertebra_c2` |
| `scalenus_medius_left` | origin | `vertebra_c3` |
| `scalenus_medius_left` | origin | `vertebra_c4` |
| `scalenus_medius_left` | origin | `vertebra_c5` |
| `scalenus_medius_left` | origin | `vertebra_c6` |
| `scalenus_medius_left` | origin | `vertebra_c7` |
| `scalenus_medius_left` | insertion | `rib_1_left` |
| `scalenus_posterior_left` | origin | `vertebra_c4` |
| `scalenus_posterior_left` | origin | `vertebra_c5` |
| `scalenus_posterior_left` | origin | `vertebra_c6` |
| `scalenus_posterior_left` | insertion | `rib_2_left` |
| `semimembranosus_left` | insertion | `oblique_popliteal_ligament_left` |
| `semispinalis_colli_left` | origin | `vertebra_t1` |
| `semispinalis_colli_left` | origin | `vertebra_t2` |
| `semispinalis_colli_left` | origin | `vertebra_t3` |
| `semispinalis_colli_left` | origin | `vertebra_t4` |
| `semispinalis_colli_left` | origin | `vertebra_t5` |
| `semispinalis_colli_left` | origin | `vertebra_t6` |
| `semispinalis_colli_left` | insertion | `vertebra_c2` |
| `semispinalis_colli_left` | insertion | `vertebra_c3` |
| `semispinalis_colli_left` | insertion | `vertebra_c4` |
| `semispinalis_colli_left` | insertion | `vertebra_c5` |
| `semispinalis_thoracis_left` | origin | `vertebra_t10` |
| `semispinalis_thoracis_left` | origin | `vertebra_t6` |
| `semispinalis_thoracis_left` | origin | `vertebra_t7` |
| `semispinalis_thoracis_left` | origin | `vertebra_t8` |
| `semispinalis_thoracis_left` | origin | `vertebra_t9` |
| `semispinalis_thoracis_left` | insertion | `vertebra_c6` |
| `semispinalis_thoracis_left` | insertion | `vertebra_c7` |
| `semispinalis_thoracis_left` | insertion | `vertebra_t1` |
| `semispinalis_thoracis_left` | insertion | `vertebra_t2` |
| `semispinalis_thoracis_left` | insertion | `vertebra_t3` |
| `semispinalis_thoracis_left` | insertion | `vertebra_t4` |
| `serratus_anterior_left` | origin | `rib_1_left` |
| `serratus_anterior_left` | origin | `rib_2_left` |
| `serratus_anterior_left` | origin | `rib_3_left` |
| `serratus_anterior_left` | origin | `rib_4_left` |
| `serratus_anterior_left` | origin | `rib_5_left` |
| `serratus_anterior_left` | origin | `rib_6_left` |
| `serratus_anterior_left` | origin | `rib_7_left` |
| `serratus_anterior_left` | origin | `rib_8_left` |
| `serratus_anterior_left` | insertion | `scapula_left` |
| `serratus_posterior_inferior_left` | origin | `vertebra_l1` |
| `serratus_posterior_inferior_left` | origin | `vertebra_l2` |
| `serratus_posterior_inferior_left` | origin | `vertebra_t11` |
| `serratus_posterior_inferior_left` | origin | `vertebra_t12` |
| `serratus_posterior_inferior_left` | insertion | `rib_10_left` |
| `serratus_posterior_inferior_left` | insertion | `rib_11_left` |
| `serratus_posterior_inferior_left` | insertion | `rib_12_left` |
| `serratus_posterior_inferior_left` | insertion | `rib_9_left` |
| `serratus_posterior_superior_left` | origin | `nuchal_ligament` |
| `serratus_posterior_superior_left` | origin | `vertebra_c7` |
| `serratus_posterior_superior_left` | origin | `vertebra_t1` |
| `serratus_posterior_superior_left` | origin | `vertebra_t2` |
| `serratus_posterior_superior_left` | origin | `vertebra_t3` |
| `serratus_posterior_superior_left` | insertion | `rib_2_left` |
| `serratus_posterior_superior_left` | insertion | `rib_3_left` |
| `serratus_posterior_superior_left` | insertion | `rib_4_left` |
| `soleus_left` | insertion | `calcaneal_tendon_left` |
| `spinalis_capitis_left` | origin | `vertebra_c7` |
| `spinalis_capitis_left` | origin | `vertebra_t1` |
| `spinalis_colli_left` | origin | `nuchal_ligament` |
| `spinalis_colli_left` | origin | `vertebra_c7` |
| `spinalis_colli_left` | origin | `vertebra_t1` |
| `spinalis_colli_left` | origin | `vertebra_t2` |
| `spinalis_colli_left` | insertion | `vertebra_c2` |
| `spinalis_colli_left` | insertion | `vertebra_c3` |
| `spinalis_colli_left` | insertion | `vertebra_c4` |
| `spinalis_thoracis_left` | origin | `vertebra_l1` |
| `spinalis_thoracis_left` | origin | `vertebra_l2` |
| `spinalis_thoracis_left` | origin | `vertebra_t11` |
| `spinalis_thoracis_left` | origin | `vertebra_t12` |
| `spinalis_thoracis_left` | insertion | `vertebra_t1` |
| `spinalis_thoracis_left` | insertion | `vertebra_t2` |
| `spinalis_thoracis_left` | insertion | `vertebra_t3` |
| `spinalis_thoracis_left` | insertion | `vertebra_t4` |
| `spinalis_thoracis_left` | insertion | `vertebra_t5` |
| `spinalis_thoracis_left` | insertion | `vertebra_t6` |
| `spinalis_thoracis_left` | insertion | `vertebra_t7` |
| `spinalis_thoracis_left` | insertion | `vertebra_t8` |
| `splenius_capitis_left` | origin | `nuchal_ligament` |
| `splenius_capitis_left` | origin | `vertebra_c7` |
| `splenius_capitis_left` | origin | `vertebra_t1` |
| `splenius_capitis_left` | origin | `vertebra_t2` |
| `splenius_capitis_left` | origin | `vertebra_t3` |
| `splenius_capitis_left` | insertion | `occipital_bone` |
| `splenius_capitis_left` | insertion | `temporal_bone_left` |
| `splenius_colli_left` | origin | `vertebra_t3` |
| `splenius_colli_left` | origin | `vertebra_t4` |
| `splenius_colli_left` | origin | `vertebra_t5` |
| `splenius_colli_left` | origin | `vertebra_t6` |
| `splenius_colli_left` | insertion | `vertebra_c3` |
| `sternocleidomastoid_left` | insertion | `occipital_bone` |
| `sternohyoid_left` | origin | `sternum` |
| `sternothyroid_left` | origin | `sternum` |
| `stylohyoid_left` | origin | `temporal_bone_left` |
| `stylohyoid_left` | insertion | `hyoid_bone` |
| `stylopharyngeus_left` | origin | `temporal_bone_left` |
| `subclavius_left` | origin | `costal_cartilage_1_left` |
| `subclavius_left` | origin | `rib_1_left` |
| `subclavius_left` | insertion | `clavicle_left` |
| `superior_gemellus_left` | insertion | `femur_left` |
| `superior_oblique_left` | origin | `sphenoid_bone` |
| `superior_pharyngeal_constrictor_left` | origin | `mandible` |
| `superior_pharyngeal_constrictor_left` | origin | `sphenoid_bone` |
| `superior_pharyngeal_constrictor_left` | insertion | `occipital_bone` |
| `superior_rectus_belly_left` | origin | `common_tendinous_ring_left` |
| `supinator_left` | origin | `annular_ligament_radius_left` |
| `supinator_left` | origin | `humerus_left` |
| `supinator_left` | origin | `radial_collateral_ligament_left` |
| `temporoparietalis_left` | origin | `epicranial_aponeurosis_left` |
| `tensor_fasciae_latae_left` | insertion | `iliotibial_tract_left` |
| `teres_major_left` | insertion | `humerus_left` |
| `thyrohyoid_left` | insertion | `hyoid_bone` |
| `tibialis_anterior_left` | origin | `interosseous_membrane_leg_left` |
| `tibialis_posterior_left` | origin | `interosseous_membrane_leg_left` |
| `tibialis_posterior_left` | origin | `tibia_left` |
| `tibialis_posterior_left` | insertion | `calcaneus_left` |
| `tibialis_posterior_left` | insertion | `cuboid_left` |
| `tibialis_posterior_left` | insertion | `intermediate_cuneiform_left` |
| `tibialis_posterior_left` | insertion | `lateral_cuneiform_left` |
| `tibialis_posterior_left` | insertion | `medial_cuneiform_left` |
| `tibialis_posterior_left` | insertion | `navicular_left` |
| `transversus_abdominis_left` | origin | `costal_cartilage_10_left` |
| `transversus_abdominis_left` | origin | `costal_cartilage_7_left` |
| `transversus_abdominis_left` | origin | `costal_cartilage_8_left` |
| `transversus_abdominis_left` | origin | `costal_cartilage_9_left` |
| `transversus_abdominis_left` | origin | `inguinal_ligament_left` |
| `transversus_abdominis_left` | origin | `rib_11_left` |
| `transversus_abdominis_left` | origin | `rib_12_left` |
| `transversus_abdominis_left` | insertion | `hip_bone_left` |
| `transversus_abdominis_left` | insertion | `linea_alba` |
| `transversus_thoracis_left` | insertion | `costal_cartilage_2_left` |
| `transversus_thoracis_left` | insertion | `costal_cartilage_3_left` |
| `transversus_thoracis_left` | insertion | `costal_cartilage_4_left` |
| `transversus_thoracis_left` | insertion | `costal_cartilage_5_left` |
| `transversus_thoracis_left` | insertion | `costal_cartilage_6_left` |
| `trapezius_ascending_part_left` | origin | `vertebra_t10` |
| `trapezius_ascending_part_left` | origin | `vertebra_t11` |
| `trapezius_ascending_part_left` | origin | `vertebra_t12` |
| `trapezius_ascending_part_left` | origin | `vertebra_t5` |
| `trapezius_ascending_part_left` | origin | `vertebra_t6` |
| `trapezius_ascending_part_left` | origin | `vertebra_t7` |
| `trapezius_ascending_part_left` | origin | `vertebra_t8` |
| `trapezius_ascending_part_left` | origin | `vertebra_t9` |
| `trapezius_ascending_part_left` | insertion | `scapula_left` |
| `trapezius_descending_part_left` | origin | `nuchal_ligament` |
| `trapezius_descending_part_left` | origin | `occipital_bone` |
| `trapezius_descending_part_left` | insertion | `clavicle_left` |
| `trapezius_transverse_part_left` | origin | `vertebra_c7` |
| `trapezius_transverse_part_left` | origin | `vertebra_t1` |
| `trapezius_transverse_part_left` | origin | `vertebra_t2` |
| `trapezius_transverse_part_left` | origin | `vertebra_t3` |
| `trapezius_transverse_part_left` | origin | `vertebra_t4` |
| `trapezius_transverse_part_left` | insertion | `scapula_left` |
| `vastus_intermedius_left` | insertion | `patellar_ligament_left` |
| `vastus_lateralis_left` | insertion | `patellar_ligament_left` |
| `vastus_medialis_left` | insertion | `patellar_ligament_left` |

## Both origin and insertion, no patch

Drawn in the origin tint plus an insertion-coloured outline, at most 4 at once (QUESTIONS 133).

| Muscle or part | Structures |
| --- | --- |
| `external_intercostal_left` | `rib_10_left`, `rib_11_left`, `rib_2_left`, `rib_3_left`, `rib_4_left`, `rib_5_left`, `rib_6_left`, `rib_7_left`, `rib_8_left`, `rib_9_left` |
| `iliocostalis_lumborum_left` | `vertebra_l1`, `vertebra_l2`, `vertebra_l3`, `vertebra_l4` |
| `innermost_intercostal_left` | `rib_10_left`, `rib_11_left`, `rib_3_left`, `rib_4_left`, `rib_5_left`, `rib_6_left`, `rib_7_left`, `rib_8_left`, `rib_9_left` |
| `internal_intercostal_left` | `rib_10_left`, `rib_11_left`, `rib_2_left`, `rib_3_left`, `rib_4_left`, `rib_5_left`, `rib_6_left`, `rib_7_left`, `rib_8_left`, `rib_9_left` |
| `interspinales_colli_left` | `vertebra_c3`, `vertebra_c4`, `vertebra_c5`, `vertebra_c6`, `vertebra_c7` |
| `interspinales_lumborum_left` | `vertebra_l2`, `vertebra_l3`, `vertebra_l4`, `vertebra_l5` |
| `lateral_intertransversarii_lumborum_dorsal_parts_left` | `vertebra_l2`, `vertebra_l3`, `vertebra_l4` |
| `lateral_intertransversarii_lumborum_left` | `vertebra_l2`, `vertebra_l3`, `vertebra_l4` |
| `lateral_intertransversarii_lumborum_ventral_parts_left` | `vertebra_l2`, `vertebra_l3`, `vertebra_l4` |
| `longus_colli_left` | `vertebra_c3`, `vertebra_c4`, `vertebra_c5`, `vertebra_c6` |
| `multifidus_colli_left` | `vertebra_c4`, `vertebra_c5` |
| `multifidus_lumborum_left` | `vertebra_l1`, `vertebra_l2`, `vertebra_l3`, `vertebra_l4`, `vertebra_l5` |
| `multifidus_thoracis_left` | `vertebra_t1`, `vertebra_t10`, `vertebra_t2`, `vertebra_t3`, `vertebra_t4`, `vertebra_t5`, `vertebra_t6`, `vertebra_t7`, `vertebra_t8`, `vertebra_t9` |
| `occipitofrontalis_left` | `epicranial_aponeurosis_left` |
| `rotatores_left` | `vertebra_t10`, `vertebra_t11`, `vertebra_t2`, `vertebra_t3`, `vertebra_t4`, `vertebra_t5`, `vertebra_t6`, `vertebra_t7`, `vertebra_t8`, `vertebra_t9` |

## Both synergist and antagonist

Derived from different actions (plan decision 7): shown as synergists, never in the antagonist tint (QUESTIONS 134).

| Muscle or part | Also an antagonist |
| --- | --- |
| `abductor_digiti_minimi_foot_left` | `plantar_interossei_left` |
| `abductor_digiti_minimi_hand_left` | `palmar_interossei_left` |
| `abductor_hallucis_left` | `adductor_hallucis_left` |
| `adductor_brevis_left` | `sartorius_left`, `tensor_fasciae_latae_left` |
| `adductor_hallucis_left` | `abductor_hallucis_left` |
| `adductor_hallucis_oblique_head_left` | `abductor_hallucis_left` |
| `adductor_hallucis_transverse_head_left` | `abductor_hallucis_left` |
| `adductor_longus_left` | `sartorius_left`, `tensor_fasciae_latae_left` |
| `adductor_magnus_main_part_left` | `adductor_brevis_left`, `adductor_longus_left`, `gluteus_maximus_left`, `pectineus_left` |
| `biceps_brachii_left` | `pronator_teres_left` |
| `biceps_brachii_long_head_left` | `pronator_teres_left` |
| `biceps_brachii_short_head_left` | `latissimus_dorsi_left`, `pronator_teres_left`, `teres_major_left`, `triceps_brachii_long_head_left` |
| `biceps_femoris_left` | `gracilis_left`, `popliteus_left`, `sartorius_left`, `semimembranosus_left`, `semitendinosus_left` |
| `biceps_femoris_long_head_left` | `gracilis_left`, `popliteus_left`, `sartorius_left`, `semimembranosus_left`, `semitendinosus_left` |
| `biceps_femoris_short_head_left` | `gracilis_left`, `popliteus_left`, `sartorius_left`, `semimembranosus_left`, `semitendinosus_left` |
| `coracobrachialis_left` | `latissimus_dorsi_left`, `teres_major_left`, `triceps_brachii_long_head_left` |
| `deltoid_clavicular_part_left` | `coracobrachialis_left`, `latissimus_dorsi_left`, `pectoralis_major_left`, `subscapularis_left`, `teres_major_left` |
| `deltoid_scapular_spinal_part_left` | `latissimus_dorsi_left`, `teres_major_left`, `teres_minor_left`, `triceps_brachii_long_head_left` |
| `dorsal_interossei_foot_left` | `plantar_interossei_left` |
| `dorsal_interossei_hand_left` | `extensor_digiti_minimi_left`, `extensor_digitorum_left`, `extensor_indicis_left`, `flexor_digitorum_profundus_left`, `flexor_digitorum_superficialis_left`, `palmar_interossei_left` |
| `extensor_carpi_radialis_brevis_left` | `extensor_carpi_ulnaris_left`, `flexor_carpi_radialis_left` |
| `extensor_carpi_radialis_longus_left` | `extensor_carpi_ulnaris_left`, `flexor_carpi_radialis_left` |
| `extensor_carpi_ulnaris_humeral_head_left` | `extensor_carpi_radialis_brevis_left`, `extensor_carpi_radialis_longus_left`, `flexor_carpi_ulnaris_left` |
| `extensor_carpi_ulnaris_left` | `extensor_carpi_radialis_brevis_left`, `extensor_carpi_radialis_longus_left`, `flexor_carpi_ulnaris_left` |
| `extensor_carpi_ulnaris_ulnar_head_left` | `extensor_carpi_radialis_brevis_left`, `extensor_carpi_radialis_longus_left`, `flexor_carpi_ulnaris_left` |
| `extensor_digiti_minimi_left` | `dorsal_interossei_hand_left`, `lumbrical_hand_left`, `palmar_interossei_left` |
| `extensor_digitorum_brevis_left` | `lumbrical_foot_left` |
| `extensor_digitorum_left` | `dorsal_interossei_hand_left`, `lumbrical_hand_left`, `palmar_interossei_left` |
| `extensor_digitorum_longus_belly_left` | `extensor_hallucis_longus_left`, `fibularis_brevis_left`, `fibularis_longus_left`, `lumbrical_foot_left`, `tibialis_anterior_left` |
| `extensor_digitorum_longus_left` | `extensor_hallucis_longus_left`, `fibularis_brevis_left`, `fibularis_longus_left`, `lumbrical_foot_left`, `tibialis_anterior_left` |
| `extensor_digitorum_longus_tendon_left` | `extensor_hallucis_longus_left`, `fibularis_brevis_left`, `fibularis_longus_left`, `lumbrical_foot_left`, `tibialis_anterior_left` |
| `extensor_hallucis_longus_left` | `extensor_digitorum_longus_left`, `fibularis_tertius_left`, `flexor_digitorum_longus_left`, `flexor_hallucis_longus_left`, `tibialis_posterior_left` |
| `extensor_indicis_left` | `dorsal_interossei_hand_left`, `lumbrical_hand_left`, `palmar_interossei_left` |
| `external_abdominal_oblique_left` | `iliocostalis_lumborum_left`, `iliocostalis_lumborum_right`, `iliocostalis_thoracis_left`, `iliocostalis_thoracis_right`, `longissimus_thoracis_left`, `longissimus_thoracis_right`, `multifidus_lumborum_left`, `multifidus_lumborum_right`, `multifidus_thoracis_left`, `multifidus_thoracis_right`, `quadratus_lumborum_left`, `quadratus_lumborum_right`, `semispinalis_thoracis_left`, `semispinalis_thoracis_right` |
| `fibularis_brevis_left` | `extensor_digitorum_longus_left`, `fibularis_tertius_left`, `flexor_digitorum_longus_left`, `flexor_hallucis_longus_left`, `tibialis_posterior_left` |
| `fibularis_longus_left` | `extensor_digitorum_longus_left`, `fibularis_tertius_left`, `flexor_digitorum_longus_left`, `flexor_hallucis_longus_left`, `tibialis_posterior_left` |
| `fibularis_tertius_left` | `extensor_hallucis_longus_left`, `fibularis_brevis_left`, `fibularis_longus_left`, `tibialis_anterior_left` |
| `flexor_carpi_radialis_left` | `extensor_carpi_radialis_brevis_left`, `extensor_carpi_radialis_longus_left`, `flexor_carpi_ulnaris_left` |
| `flexor_carpi_ulnaris_humeral_head_left` | `extensor_carpi_ulnaris_left`, `flexor_carpi_radialis_left` |
| `flexor_carpi_ulnaris_left` | `extensor_carpi_ulnaris_left`, `flexor_carpi_radialis_left` |
| `flexor_carpi_ulnaris_ulnar_head_left` | `extensor_carpi_ulnaris_left`, `flexor_carpi_radialis_left` |
| `flexor_digitorum_brevis_left` | `lumbrical_foot_left` |
| `flexor_digitorum_longus_left` | `extensor_hallucis_longus_left`, `fibularis_brevis_left`, `fibularis_longus_left`, `lumbrical_foot_left`, `tibialis_anterior_left` |
| `flexor_digitorum_profundus_left` | `dorsal_interossei_hand_left`, `lumbrical_hand_left`, `palmar_interossei_left` |
| `flexor_digitorum_superficialis_humero_ulnar_head_left` | `dorsal_interossei_hand_left`, `lumbrical_hand_left`, `palmar_interossei_left` |
| `flexor_digitorum_superficialis_left` | `dorsal_interossei_hand_left`, `lumbrical_hand_left`, `palmar_interossei_left` |
| `flexor_digitorum_superficialis_radial_head_left` | `dorsal_interossei_hand_left`, `lumbrical_hand_left`, `palmar_interossei_left` |
| `flexor_hallucis_longus_left` | `extensor_hallucis_longus_left`, `fibularis_brevis_left`, `fibularis_longus_left`, `tibialis_anterior_left` |
| `gluteus_maximus_left` | `gluteus_medius_left`, `gluteus_minimus_left`, `sartorius_left`, `tensor_fasciae_latae_left` |
| `gluteus_medius_left` | `gluteus_maximus_left`, `obturator_internus_left`, `piriformis_left`, `sartorius_left` |
| `gluteus_minimus_left` | `gluteus_maximus_left`, `obturator_internus_left`, `piriformis_left`, `sartorius_left` |
| `gracilis_left` | `biceps_femoris_left`, `sartorius_left` |
| `iliocostalis_colli_left` | `longus_colli_left`, `longus_colli_right`, `scalenus_anterior_left`, `scalenus_anterior_right`, `sternocleidomastoid_left`, `sternocleidomastoid_right` |
| `iliocostalis_lumborum_left` | `external_abdominal_oblique_left`, `external_abdominal_oblique_right`, `internal_abdominal_oblique_left`, `internal_abdominal_oblique_right` |
| `iliocostalis_thoracis_left` | `external_abdominal_oblique_left`, `external_abdominal_oblique_right`, `internal_abdominal_oblique_left`, `internal_abdominal_oblique_right` |
| `iliotibial_tract_left` | `adductor_brevis_left`, `adductor_longus_left`, `gluteus_maximus_left`, `obturator_internus_left`, `pectineus_left`, `piriformis_left`, `sartorius_left` |
| `internal_abdominal_oblique_left` | `iliocostalis_lumborum_left`, `iliocostalis_lumborum_right`, `iliocostalis_thoracis_left`, `iliocostalis_thoracis_right`, `longissimus_thoracis_left`, `longissimus_thoracis_right`, `multifidus_lumborum_left`, `multifidus_lumborum_right`, `multifidus_thoracis_left`, `multifidus_thoracis_right`, `quadratus_lumborum_left`, `quadratus_lumborum_right`, `semispinalis_thoracis_left`, `semispinalis_thoracis_right` |
| `lateral_pterygoid_inferior_head_left` | `medial_pterygoid_left` |
| `lateral_pterygoid_left` | `medial_pterygoid_left` |
| `lateral_pterygoid_superior_head_left` | `medial_pterygoid_left` |
| `latissimus_dorsi_left` | `coracobrachialis_left`, `deltoid_clavicular_part_left`, `deltoid_scapular_spinal_part_left`, `teres_minor_left` |
| `levator_scapulae_left` | `pectoralis_minor_left` |
| `longissimus_capitis_left` | `longus_colli_left`, `longus_colli_right`, `scalenus_anterior_left`, `scalenus_anterior_right`, `sternocleidomastoid_left`, `sternocleidomastoid_right` |
| `longissimus_colli_left` | `longus_colli_left`, `longus_colli_right`, `scalenus_anterior_left`, `scalenus_anterior_right`, `sternocleidomastoid_left`, `sternocleidomastoid_right` |
| `longissimus_thoracis_left` | `external_abdominal_oblique_left`, `external_abdominal_oblique_right`, `internal_abdominal_oblique_left`, `internal_abdominal_oblique_right` |
| `longus_capitis_left` | `sternocleidomastoid_left`, `sternocleidomastoid_right` |
| `longus_colli_left` | `iliocostalis_colli_left`, `iliocostalis_colli_right`, `longissimus_capitis_left`, `longissimus_capitis_right`, `longissimus_colli_left`, `longissimus_colli_right`, `multifidus_colli_left`, `multifidus_colli_right`, `semispinalis_colli_left`, `semispinalis_colli_right`, `splenius_capitis_left`, `splenius_capitis_right`, `splenius_colli_left`, `splenius_colli_right` |
| `lumbrical_foot_left` | `extensor_digitorum_brevis_left`, `extensor_digitorum_longus_left`, `flexor_digitorum_brevis_left`, `flexor_digitorum_longus_left` |
| `lumbrical_hand_left` | `extensor_digiti_minimi_left`, `extensor_digitorum_left`, `extensor_indicis_left`, `flexor_digitorum_profundus_left`, `flexor_digitorum_superficialis_left` |
| `masseter_deep_part_left` | `medial_pterygoid_left` |
| `masseter_superficial_part_left` | `lateral_pterygoid_left`, `temporalis_left` |
| `medial_pterygoid_left` | `lateral_pterygoid_left`, `temporalis_left` |
| `multifidus_colli_left` | `longus_colli_left`, `longus_colli_right` |
| `multifidus_lumborum_left` | `external_abdominal_oblique_left`, `external_abdominal_oblique_right`, `internal_abdominal_oblique_left`, `internal_abdominal_oblique_right` |
| `multifidus_thoracis_left` | `external_abdominal_oblique_left`, `external_abdominal_oblique_right`, `internal_abdominal_oblique_left`, `internal_abdominal_oblique_right` |
| `obturator_internus_left` | `gluteus_medius_left`, `gluteus_minimus_left`, `tensor_fasciae_latae_left` |
| `palmar_interossei_left` | `abductor_digiti_minimi_hand_left`, `dorsal_interossei_hand_left`, `extensor_digiti_minimi_left`, `extensor_digitorum_left`, `extensor_indicis_left`, `flexor_digitorum_profundus_left`, `flexor_digitorum_superficialis_left` |
| `pectineus_left` | `sartorius_left`, `tensor_fasciae_latae_left` |
| `pectoralis_major_abdominal_part_left` | `teres_minor_left` |
| `pectoralis_major_clavicular_head_left` | `latissimus_dorsi_left`, `teres_major_left`, `teres_minor_left`, `triceps_brachii_long_head_left` |
| `pectoralis_major_left` | `teres_minor_left` |
| `pectoralis_major_sternocostal_head_left` | `coracobrachialis_left`, `deltoid_clavicular_part_left`, `deltoid_scapular_spinal_part_left`, `teres_minor_left` |
| `pectoralis_minor_left` | `levator_scapulae_left`, `rhomboid_major_left`, `rhomboid_minor_left`, `serratus_anterior_left` |
| `piriformis_left` | `gluteus_medius_left`, `gluteus_minimus_left`, `tensor_fasciae_latae_left` |
| `plantar_interossei_left` | `abductor_digiti_minimi_foot_left`, `dorsal_interossei_foot_left` |
| `popliteus_left` | `biceps_femoris_left` |
| `pronator_teres_deep_head_left` | `biceps_brachii_left` |
| `pronator_teres_left` | `biceps_brachii_left` |
| `pronator_teres_superficial_head_left` | `biceps_brachii_left` |
| `quadratus_lumborum_left` | `external_abdominal_oblique_left`, `external_abdominal_oblique_right`, `internal_abdominal_oblique_left`, `internal_abdominal_oblique_right` |
| `rectus_femoris_left` | `sartorius_left` |
| `rhomboid_major_left` | `pectoralis_minor_left`, `trapezius_left` |
| `rhomboid_minor_left` | `pectoralis_minor_left`, `trapezius_left` |
| `sartorius_left` | `adductor_brevis_left`, `adductor_longus_left`, `biceps_femoris_left`, `gluteus_maximus_left`, `gluteus_medius_left`, `gluteus_minimus_left`, `gracilis_left`, `pectineus_left`, `rectus_femoris_left`, `semimembranosus_left`, `semitendinosus_left`, `tensor_fasciae_latae_left` |
| `scalenus_anterior_left` | `iliocostalis_colli_left`, `iliocostalis_colli_right`, `longissimus_capitis_left`, `longissimus_capitis_right`, `longissimus_colli_left`, `longissimus_colli_right`, `splenius_capitis_left`, `splenius_capitis_right`, `splenius_colli_left`, `splenius_colli_right` |
| `semimembranosus_left` | `biceps_femoris_left`, `sartorius_left` |
| `semispinalis_colli_left` | `longus_colli_left`, `longus_colli_right` |
| `semispinalis_thoracis_left` | `external_abdominal_oblique_left`, `external_abdominal_oblique_right`, `internal_abdominal_oblique_left`, `internal_abdominal_oblique_right` |
| `semitendinosus_left` | `biceps_femoris_left`, `sartorius_left` |
| `serratus_anterior_left` | `pectoralis_minor_left`, `trapezius_left` |
| `spinalis_capitis_left` | `sternocleidomastoid_left`, `sternocleidomastoid_right` |
| `splenius_capitis_left` | `longus_colli_left`, `longus_colli_right`, `scalenus_anterior_left`, `scalenus_anterior_right`, `sternocleidomastoid_left`, `sternocleidomastoid_right` |
| `splenius_colli_left` | `longus_colli_left`, `longus_colli_right`, `scalenus_anterior_left`, `scalenus_anterior_right`, `sternocleidomastoid_left`, `sternocleidomastoid_right` |
| `sternocleidomastoid_left` | `iliocostalis_colli_left`, `iliocostalis_colli_right`, `longissimus_capitis_left`, `longissimus_capitis_right`, `longissimus_colli_left`, `longissimus_colli_right`, `longus_capitis_left`, `longus_capitis_right`, `spinalis_capitis_left`, `spinalis_capitis_right`, `splenius_capitis_left`, `splenius_capitis_right`, `splenius_colli_left`, `splenius_colli_right` |
| `subscapularis_left` | `teres_minor_left` |
| `temporalis_left` | `medial_pterygoid_left` |
| `tensor_fasciae_latae_belly_left` | `adductor_brevis_left`, `adductor_longus_left`, `gluteus_maximus_left`, `obturator_internus_left`, `pectineus_left`, `piriformis_left`, `sartorius_left` |
| `tensor_fasciae_latae_left` | `adductor_brevis_left`, `adductor_longus_left`, `gluteus_maximus_left`, `obturator_internus_left`, `pectineus_left`, `piriformis_left`, `sartorius_left` |
| `teres_major_left` | `coracobrachialis_left`, `deltoid_clavicular_part_left`, `deltoid_scapular_spinal_part_left`, `teres_minor_left` |
| `teres_minor_left` | `latissimus_dorsi_left`, `pectoralis_major_left`, `subscapularis_left`, `teres_major_left` |
| `tibialis_anterior_left` | `extensor_digitorum_longus_left`, `fibularis_tertius_left`, `flexor_digitorum_longus_left`, `flexor_hallucis_longus_left`, `tibialis_posterior_left` |
| `tibialis_posterior_left` | `extensor_hallucis_longus_left`, `fibularis_brevis_left`, `fibularis_longus_left`, `tibialis_anterior_left` |
| `trapezius_ascending_part_left` | `pectoralis_minor_left`, `rhomboid_major_left`, `rhomboid_minor_left`, `serratus_anterior_left` |
| `trapezius_descending_part_left` | `levator_scapulae_left`, `rhomboid_major_left`, `rhomboid_minor_left`, `serratus_anterior_left` |
| `trapezius_left` | `rhomboid_major_left`, `rhomboid_minor_left`, `serratus_anterior_left` |
| `trapezius_transverse_part_left` | `rhomboid_major_left`, `rhomboid_minor_left`, `serratus_anterior_left` |
| `triceps_brachii_long_head_left` | `coracobrachialis_left` |
