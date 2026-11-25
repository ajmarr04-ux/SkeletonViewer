// The tier engine (SPEC-platform §4.3; M12 plan decision 5): evaluates a
// kind's tier rules over the runtime graph. Generic: the rules are data on the
// kind descriptors, and the context says what a structure's kind, layer and
// parts are; nothing here names a system, layer, kind or edge type.
//
// Evaluation of one rule:
// - Each step gives an ordered list. `self`: the structure. `follow`: for each
//   source (from `from`), its neighbours along every step name in turn, sorted
//   by the step's `order` source by source, minus `exclude`. `tier`: another
//   tier, in full. `filter`: drops what doesn't match from everything so far.
// - Parts expansion is generic: a structure with parts in a step's output is
//   followed by its parts (or replaced by them, `parts: "instead"`).
// - The result is the steps' outputs in order, first occurrence kept, the
//   structure itself removed; the rule's `order` then sorts what it added
//   itself after its `tier` steps (so a `t2` keeps its `t1` first and excludes
//   what that holds).
// - "Off layers add nothing" (STATUS §1) is applied after evaluation, by layer
//   mode (`related`).
// Results are memoised per graph version: labels re-rank every 100 ms while
// the camera moves.

import type { Graph } from "./graph";
import type { KindTiers, TierOrder, TierRule, TierStep } from "./types";

export type TierContext = {
  graph: Graph;
  /** The tier rules of a structure's kind, or undefined (a joint node, an unknown ID). */
  rulesOf(id: string): KindTiers | undefined;
  /** A structure's parts, in order (empty for a structure without). */
  partsOf(id: string): readonly string[];
  kindOf(id: string): string | undefined;
  layerOf(id: string): string | undefined;
  /** Position in the ID index, for `anatomical` order. */
  rank(id: string): number;
};

export type LayerModes = Readonly<Record<string, "on" | "ghost" | "off">>;

export type TierEngine = {
  /** Does the structure have this tier (its kind has the rule and the rule's `requires` holds)? */
  hasTier(id: string, tier: string): boolean;
  /** The tier's structures (not the structure itself), every layer; null when the structure has no such tier. */
  evaluate(id: string, tier: string): readonly string[] | null;
  /** As `evaluate`, without the structures in layers that are Off (or in no layer). */
  related(id: string, tier: string, modes: LayerModes): readonly string[] | null;
};

const list = (x: string | readonly string[] | undefined): readonly string[] => (x === undefined ? [] : typeof x === "string" ? [x] : x);
const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function tierEngine(ctx: TierContext): TierEngine {
  const { graph } = ctx;
  let version = -1;
  const memo = new Map<string, readonly string[] | null>();
  const filtered = new Map<string, readonly string[] | null>();
  const fresh = () => {
    if (graph.version !== version) {
      version = graph.version;
      memo.clear();
      filtered.clear();
    }
  };

  const sorter = (order: TierOrder): ((xs: string[]) => string[]) => {
    if (order === "id") return (xs) => xs.sort(byId);
    if (order === "anatomical") return (xs) => xs.sort((a, b) => ctx.rank(a) - ctx.rank(b) || byId(a, b));
    return (xs) => xs;
  };

  const ruleOf = (id: string, tier: string): TierRule | null => {
    const r = ctx.rulesOf(id)?.[tier];
    if (!r) return null;
    if (r.requires !== undefined && !graph.has(id, r.requires)) return null;
    return r;
  };

  const evaluate = (id: string, tier: string, stack: readonly string[] = []): readonly string[] | null => {
    fresh();
    const key = `${id}\u0000${tier}`;
    if (memo.has(key)) return memo.get(key)!;
    if (stack.includes(tier)) throw new Error(`tier rule ${tier} includes itself (${[...stack, tier].join(" → ")})`);
    const rule = ruleOf(id, tier);
    const result = rule ? run(id, rule, [...stack, tier]) : null;
    memo.set(key, result);
    return result;
  };

  const run = (id: string, rule: TierRule, stack: readonly string[]): readonly string[] => {
    const instead = rule.parts === "instead";
    const expand = (xs: readonly string[]): string[] =>
      xs.flatMap((x) => {
        const parts = ctx.partsOf(x);
        return parts.length === 0 ? [x] : instead ? [...parts] : [x, ...parts];
      });
    const withParts = (xs: readonly string[]): string[] => xs.flatMap((x) => [x, ...ctx.partsOf(x)]);

    /** Everything so far: the included tiers' results, then the rule's own additions. */
    let included: string[] = [];
    let own: string[] = [];
    let previous: readonly string[] = [];
    const sofar = () => [...included, ...own];

    for (const step of rule.steps as readonly TierStep[]) {
      let outp: readonly string[];
      if ("self" in step) outp = expand([id]);
      else if ("tier" in step) {
        outp = evaluate(id, step.tier, stack) ?? [];
        included = [...included, ...outp];
        previous = outp;
        continue;
      } else if ("filter" in step) {
        const { kind, layer } = step.filter;
        const keep = (x: string) => (!kind || kind.includes(ctx.kindOf(x) ?? "")) && (!layer || layer.includes(ctx.layerOf(x) ?? ""));
        included = included.filter(keep);
        own = own.filter(keep);
        previous = previous.filter(keep);
        continue;
      } else {
        const from = step.from ?? "self";
        const sources =
          from === "self" ? [id] : from === "self+parts" ? [id, ...ctx.partsOf(id)] : from === "previous" ? previous : [...new Set([id, ...sofar()])];
        const sort = sorter(step.order ?? "written");
        const names = list(step.follow);
        const out: string[] = [];
        for (const s of sources) out.push(...sort(expand(names.flatMap((n) => graph.neighbours(s, n)))));
        const ex = list(step.exclude);
        if (ex.length > 0) {
          const drop = new Set(withParts(ex.flatMap((n) => graph.neighbours(id, n))));
          outp = out.filter((x) => !drop.has(x));
        } else outp = out;
      }
      own = [...own, ...outp];
      previous = outp;
    }

    const first = new Set(included);
    first.delete(id);
    const added = [...new Set(own)].filter((x) => x !== id && !first.has(x));
    return [...first, ...(rule.order ? sorter(rule.order)(added) : added)];
  };

  return {
    hasTier: (id, tier) => ruleOf(id, tier) !== null,
    evaluate: (id, tier) => evaluate(id, tier),
    related(id, tier, modes) {
      fresh();
      const key = `${id}\u0000${tier}\u0000${Object.keys(modes)
        .sort()
        .map((l) => `${l}=${modes[l]}`)
        .join(",")}`;
      if (filtered.has(key)) return filtered.get(key)!;
      const all = evaluate(id, tier);
      const result =
        all &&
        all.filter((x) => {
          const l = ctx.layerOf(x);
          return l !== undefined && modes[l] !== undefined && modes[l] !== "off";
        });
      filtered.set(key, result);
      return result;
    },
  };
}
