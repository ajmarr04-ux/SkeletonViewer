// Screen-reader announcements (spec §10 of `SPEC (2).md`, extended for the
// musculoskeletal layers in M10 plan decision 4). Every message the polite
// live region (`src/ui/Announcer.tsx`) speaks after a change of isolation,
// layers, depth, hidden structures or antagonists is built here, by pure
// functions, and `composeAnnouncement` folds what one user action changed into
// one message (risk 3: the selection wins, the layer change is folded in).

import ids from "../../content/ids.json";
import { isolationView, withTints } from "../scene/isolation";
import type { Tier } from "../state/isolation";
import { type Layer, type LayerMode, type LayerModes, type MuscleDepth } from "../state/url";
import { COUNT_ORDER, countKind, isLazyLayer, kindNoun, LAYER_IDS, LAZY_LAYERS, layerLabel, presetDescriptor, presetOf, systemDescriptor, systemMode, type KindId, type LazyLayerId, type SystemId } from "../systems/registry";
import { groupAnnouncement, groupOf } from "./groups";
import { displayName } from "./names";
import { announcement as boneAnnouncement } from "./placeholder";
import { relations } from "./relations";
import { softEntry } from "./softRegistry";

// ---------------------------------------------------------------------------
// Names and counts

const BONE_KINDS = new Map((ids as { id: string; kind: KindId }[]).map((e) => [e.id, e.kind]));

/** "Femur, left", "Biceps brachii, left", "Sternum", "Upper right canine". */
export function spokenName(id: string): string {
  return displayName(id).replace(/ \((left|right)\)$/, ", $1");
}

/** What a structure counts as in "2 bones and 3 parts" (the kinds' nouns; a tooth counts as a bone). */
export type CountKind = KindId;
export type KindCounts = Partial<Record<CountKind, number>>;

/** "3 bones", "1 meniscus". */
export const counted = (n: number, kind: CountKind): string => `${n} ${kindNoun(kind, n)}`;

/** "2 bones and 3 parts", "8 bones, 12 muscles and 2 ligaments"; "" when empty. Kinds in the registry's `COUNT_ORDER`. */
export function countsPhrase(counts: KindCounts): string {
  const parts = COUNT_ORDER.filter((k) => (counts[k] ?? 0) > 0).map((k) => counted(counts[k]!, k));
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** The kind a structure is counted as: bones and teeth are bones; a soft structure its kind. */
export function countKindOf(id: string): CountKind | null {
  const kind = BONE_KINDS.get(id) ?? softEntry(id)?.kind;
  return kind === undefined ? null : countKind(kind);
}

/**
 * Count structures by kind. A part counts as a part only when it belongs to
 * `ownMuscle` (the focus muscle, or a focus part's muscle); any other part
 * counts once as its muscle, so a functional group is "6 muscles", not their heads.
 */
export function countByKind(idsIn: Iterable<string>, ownMuscle: string | null = null, kindOf: (id: string) => CountKind | null = countKindOf, parentOf: (id: string) => string | null = (id) => softEntry(id)?.parent ?? null): KindCounts {
  const seen = new Set<string>();
  const counts: KindCounts = {};
  for (const id of idsIn) {
    const parent = parentOf(id);
    const key = parent !== null && parent !== ownMuscle ? parent : id;
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = key === id ? kindOf(id) : "muscle";
    if (kind === null) continue;
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Layers, presets, depth, loading

const lower = (l: Layer): string => layerLabel(l).toLowerCase();
const MODE_WORDS: Record<LayerMode, string> = { on: "on", ghost: "ghosted", off: "off" };

/** "Muscles on." / "Muscles ghosted." / "Muscles off."; "Muscles on, loading." while its files load. */
export function layerModeAnnouncement(layer: Layer, mode: LayerMode, loading = false): string {
  return `${layerLabel(layer)} ${MODE_WORDS[mode]}${loading && mode !== "off" ? ", loading" : ""}.`;
}

/** "muscles, ligaments and cartilage". */
function listLayers(layers: readonly Layer[]): string {
  const names = layers.map(lower);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "Musculoskeletal: all on." / "… all ghosted." / "… all off."; "Musculoskeletal: mixed." when its layers differ (the group control's state, M11 plan decision 5). */
export function systemModeAnnouncement(system: SystemId, mode: LayerMode | "mixed"): string {
  return `${systemDescriptor(system).label}: ${mode === "mixed" ? "mixed" : `all ${MODE_WORDS[mode]}`}.`;
}

/**
 * A change of layer modes. One layer: its own message. A system's group
 * control (`via`): "Musculoskeletal: all on." Several at once that land on a
 * preset: "Full musculoskeletal: all layers on." / "Skeleton: bones only."
 * (`PresetDescriptor.summary`); otherwise each change in panel order.
 * `loading` lists the layers whose files are still to come.
 */
export function layersAnnouncement(before: LayerModes, now: LayerModes, loading: readonly LazyLayerId[] = [], via: SystemId | null = null): string | null {
  const changed = LAYER_IDS.filter((l) => before[l] !== now[l]);
  if (changed.length === 0) return null;
  const waiting = changed.filter((l): l is LazyLayerId => isLazyLayer(l) && now[l] !== "off" && loading.includes(l));
  const loadingSuffix = waiting.length ? ` Loading ${listLayers(waiting)}.` : "";
  const group = via === null ? "mixed" : systemMode(via, now);
  if (via !== null && group !== "mixed") return `${systemModeAnnouncement(via, group)}${loadingSuffix}`;
  const preset = changed.length > 1 ? presetOf(now) : null;
  if (preset !== null) {
    const p = presetDescriptor(preset);
    return `${p.label}: ${p.summary}.${loadingSuffix}`;
  }
  return changed.map((l) => layerModeAnnouncement(l, now[l], waiting.includes(l as LazyLayerId))).join(" ");
}

/**
 * A depth stop (spec §6.2; M7 plan step 7): "Superficial muscles hidden: 41
 * muscles." Without the count (the table not loaded yet) the first sentence only.
 */
export function depthAnnouncement(stop: MuscleDepth, count: number | null): string {
  if (stop === 0) return "All muscles shown.";
  const what = stop === 1 ? "Superficial muscles hidden" : "Superficial and intermediate muscles hidden, deep muscles only";
  return count === null ? `${what}.` : `${what}: ${counted(count, "muscle")}.`;
}

/** A layer's files: "Muscles loaded." once the low LOD shows; "Muscles failed to load. Retry available."; "Muscles loading again." on Retry. */
export function layerLoadAnnouncement(layer: LazyLayerId, what: "loaded" | "failed" | "retry"): string {
  if (what === "loaded") return `${layerLabel(layer)} loaded.`;
  if (what === "failed") return `${layerLabel(layer)} failed to load. Retry available.`;
  return `${layerLabel(layer)} loading again.`;
}

// ---------------------------------------------------------------------------
// Hide, antagonists

/** "Biceps brachii, left, hidden. 3 hidden." */
export const hiddenAnnouncement = (id: string, total: number): string => `${spokenName(id)}, hidden. ${total} hidden.`;
export const ALL_SHOWN_ANNOUNCEMENT = "All hidden structures shown.";

/** "Antagonists shown: 4 muscles." / "Antagonists hidden."; none in a layer that shows: says so. */
export function antagonistAnnouncement(on: boolean, muscles: number): string {
  if (!on) return "Antagonists hidden.";
  return muscles === 0 ? "Antagonists shown: none in the layers showing." : `Antagonists shown: ${counted(muscles, "muscle")}.`;
}

// ---------------------------------------------------------------------------
// Selections and tiers

export type Isolated = { sel: string | null; tier: Tier; grp: string | null };

/**
 * A soft structure's selection (M10 plan decision 4):
 * - tier 0: "Biceps brachii, left, selected. Isolated."; a part: "Long head of
 *   triceps brachii, left, selected. Part of triceps brachii."; Back from a part
 *   to its muscle: "Triceps brachii, left, selected."; back from a higher tier:
 *   "Triceps brachii, left, isolated.";
 * - tier 1: "Triceps brachii, left: attachments shown, 2 bones and 3 parts."
 *   (a ligament or cartilage: "related structures shown");
 * - tier 2: "…: functional group shown, 6 muscles." (a ligament or cartilage: "joint shown").
 * `others` is what the set shows besides the focus, counted by kind.
 */
export function softSelectionAnnouncement(id: string, tier: Tier, prev: Isolated | null, others: KindCounts): string | null {
  const e = softEntry(id);
  if (!e) return null;
  const name = spokenName(id);
  if (tier > 0) {
    const muscle = e.layer === "muscles";
    const what = tier === 1 ? (muscle ? "attachments" : "related structures") : muscle ? "functional group" : "joint";
    const list = countsPhrase(others);
    return `${name}: ${what} shown, ${list || "nothing else in the layers showing"}.`;
  }
  const drawn = e.mesh || (e.parts?.length ?? 0) > 0;
  if (!drawn) return `${name}, selected. No 3D model.`;
  if (prev?.sel === id && prev.tier > 0) return `${name}, isolated.`;
  if (prev?.sel != null && softEntry(prev.sel)?.parent === id) return `${name}, selected.`;
  const parent = e.parent ? softEntry(e.parent) : undefined;
  if (parent) return `${name}, selected. Part of ${parent.name[0]!.toLowerCase()}${parent.name.slice(1)}.`;
  return `${name}, selected. Isolated.`;
}

/**
 * A bone's tier with soft layers on (M10 plan decision 4): M5's wording, then
 * the soft structures of the set. Tier 1: "Femur, left: related bones shown.
 * Hip bone, patella, tibia. Also 23 muscles and 4 ligaments."; tier 2:
 * "Femur, left: region shown, 8 bones and 40 muscles."
 */
export function boneSelectionAnnouncement(now: Isolated, prev: Isolated | null, related: (id: string) => string[], counts: KindCounts): string {
  const bones = counts.bone ?? 0;
  const soft: KindCounts = { ...counts, bone: 0 };
  const extra = countsPhrase(soft);
  const base = boneAnnouncement({ sel: now.sel, tier: now.tier }, prev, related, bones);
  if (!extra || now.tier === 0) return base;
  if (now.tier === 1) return `${base} Also ${extra}.`;
  return base.replace(/, \d+ bones?\.$/, `, ${countsPhrase(counts)}.`);
}

/**
 * "Show attached muscles" (spec §5.4): "Femur, left: attached muscles shown,
 * 20 muscles and 3 parts."; while the muscles' content loads "Femur, left:
 * attached muscles loading."; none: "…: no muscles attach here.". `back`
 * (returning from one of its members) starts "Back to".
 */
export function attachedAnnouncement(bone: string, members: readonly string[], loading: boolean, back = false): string {
  const name = `${back ? "Back to " : ""}${spokenName(bone)}`;
  if (loading) return `${name}: attached muscles loading.`;
  const others = members.filter((m) => m !== bone);
  if (others.length === 0) return `${name}: no muscles attach here.`;
  // A part listed on its own (only that head attaches) counts as a part.
  const counts = countByKind(others, null, countKindOf, () => null);
  return `${name}: attached muscles shown, ${countsPhrase(counts)}.`;
}

/** A group isolation: an attached-muscles group by `attachedAnnouncement`, any other by M5's `groupAnnouncement`. */
export function groupIsolationAnnouncement(grp: string, back = false): string {
  const g = groupOf(grp);
  if (g?.attached) return attachedAnnouncement(g.attached.bone, g.members, g.attached.loading, back);
  return groupAnnouncement(grp, back);
}

/**
 * What the isolation change from `prev` to `now` says, with the layers that
 * are on (they decide the tier sets, M9 plan decision 3).
 */
export function isolationAnnouncement(
  now: Isolated,
  prev: Isolated | null,
  modes: LayerModes,
  hasMesh: (id: string) => boolean,
): string {
  if (now.sel === null && now.grp !== null) {
    // "Back to" from one of its members; an attached group's own bone is where it was opened from, not a member stepped back from.
    const g = groupOf(now.grp);
    const back = prev?.sel != null && prev.sel !== g?.attached?.bone && (g?.members.includes(prev.sel) ?? false);
    return groupIsolationAnnouncement(now.grp, back);
  }
  if (now.sel === null) return "Full skeleton";
  const view = isolationView(now.sel, now.tier, "ghost", hasMesh, null, undefined, undefined, modes);
  const solid = [...(view.solid ?? [])].filter((x) => x !== now.sel);
  const e = softEntry(now.sel);
  if (e) {
    const own = e.parent ?? now.sel;
    return softSelectionAnnouncement(now.sel, now.tier, prev, now.tier === 0 ? {} : countByKind(solid, own)) ?? "Full skeleton";
  }
  // A bone: its own mesh counts among "N bones" (M5's wording).
  const all = [...(view.solid ?? [])];
  return boneSelectionAnnouncement(now, prev, (id) => relations.tier1(id), countByKind(all));
}

/** How many muscles the antagonist toggle adds (parts count once, as their muscle). */
export function antagonistCount(sel: string | null, tier: Tier, modes: LayerModes, hasMesh: (id: string) => boolean): number {
  if (sel === null || tier !== 2) return 0;
  const view = isolationView(sel, tier, "ghost", hasMesh, null, undefined, undefined, modes);
  const tinted = withTints(view, sel, tier, true, hasMesh, modes);
  const ant = [...(tinted.tints ?? new Map()).entries()].filter(([, r]) => r === "antagonist").map(([x]) => x);
  return countByKind(ant).muscle ?? 0;
}

// ---------------------------------------------------------------------------
// One message per user action

/** What the composer compares: the store's state before and after one action. */
export type AnnounceState = Isolated & {
  antagonists: boolean;
  layers: LayerModes;
  /** The system whose group control made the layer change, if any (store `layersVia`). */
  layersVia?: SystemId | null;
  depth: MuscleDepth;
  /** Per tissue layer: is a LOD on screen yet, and is its load failing. */
  load: Partial<Record<LazyLayerId, { shown: boolean; status: "loading" | "ready" | "error"; attempt: number }>>;
};

export type AnnounceDeps = {
  /** The isolation message (`isolationAnnouncement` bound to the registries). */
  isolation: (now: Isolated, prev: Isolated) => string;
  /** Muscles the antagonist toggle adds at `now`. */
  antagonists: (now: AnnounceState) => number;
  /** Muscles a depth stop peels, or null before the soft table has loaded. */
  peeled: (stop: MuscleDepth) => number | null;
};

const isolationChanged = (a: Isolated, b: Isolated): boolean => a.sel !== b.sel || a.tier !== b.tier || a.grp !== b.grp;

/**
 * Fold everything one user action changed into one message (M10 risk 3):
 * an explicit message (`say`: Hide, the Tab cursor, a toast) or the isolation
 * change comes first, then the antagonists, then the layers ("… Muscles on,
 * loading."), then the depth stop, then the layers' files ("Muscles loaded.").
 * `awaiting` holds the layers announced as loading, so "loaded" is said only
 * after a change the user made (no announcement on page load); it is updated
 * in place. `hushed`: the changes are part of opening the page, so only an
 * explicit message is said. Null when nothing is worth saying.
 */
export function composeAnnouncement(
  before: AnnounceState,
  now: AnnounceState,
  said: string | null,
  deps: AnnounceDeps,
  awaiting: Set<LazyLayerId>,
  hushed = false,
): string | null {
  // Changes that are part of opening the page (a soft link applied late): nothing said, nothing awaited.
  if (hushed) return said;
  const out: string[] = [];
  const iso = isolationChanged(before, now);
  if (said !== null) out.push(said);
  else if (iso) out.push(deps.isolation(now, before));
  if (now.antagonists !== before.antagonists && (now.antagonists || !iso)) out.push(antagonistAnnouncement(now.antagonists, now.antagonists ? deps.antagonists(now) : 0));
  const loading = LAZY_LAYERS.filter((l) => !now.load[l]?.shown);
  const layers = layersAnnouncement(before.layers, now.layers, loading, now.layersVia ?? null);
  if (layers !== null) out.push(layers);
  for (const t of LAZY_LAYERS) {
    if (before.layers[t] === "off" && now.layers[t] !== "off" && loading.includes(t)) awaiting.add(t);
    if (now.layers[t] === "off") awaiting.delete(t);
  }
  // A preset that sets the depth says the preset only.
  const preset = presetOf(now.layers);
  const presetDepth = layers !== null && preset !== null && presetDescriptor(preset).depth === now.depth;
  if (now.depth !== before.depth && !presetDepth) out.push(depthAnnouncement(now.depth, now.depth === 0 ? 0 : deps.peeled(now.depth)));
  for (const t of LAZY_LAYERS) {
    const a = before.load[t];
    const b = now.load[t];
    if (!b || now.layers[t] === "off") continue;
    if (b.shown && !a?.shown && awaiting.delete(t)) out.push(layerLoadAnnouncement(t, "loaded"));
    else if (b.status === "error" && a?.status !== "error") out.push(layerLoadAnnouncement(t, "failed"));
    else if (b.status === "loading" && a?.status === "error" && b.attempt > (a?.attempt ?? 0)) {
      awaiting.add(t);
      out.push(layerLoadAnnouncement(t, "retry"));
    }
  }
  return out.length ? out.join(" ") : null;
}
