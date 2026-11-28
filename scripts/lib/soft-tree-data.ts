// The lazy layers' sidebar trees, read from disk and built by the builders their
// `TreeSpec`s name (src/tree/; M12 plan decision 10). Shared by the Vite plugin,
// the search index, validate-content and the tests.
import { splitFrontMatter } from "../../src/content/frontmatter";
import { splitSynonyms, type SynonymsFile } from "../../src/content/schema";
import { LAZY_LAYERS, TREE_ROOTS } from "../../src/systems/registry";
import { buildSoftTrees } from "../../src/tree/build";
import type { FunctionalJoint, TreeEntry } from "../../src/tree/leaves";
import type { SoftSet, SoftTreeData } from "../../src/tree/types";
import { readJointNames, readJson, readSoftFiles, readSoftIds } from "./content-files";

/** Every lazy structure's front matter, by ID. */
function readFrontMatter(): Map<string, Record<string, unknown>> {
  const files = readSoftFiles();
  const out = new Map<string, Record<string, unknown>>();
  for (const layer of LAZY_LAYERS)
    for (const [name, text] of files[layer]) {
      const fm = splitFrontMatter(text).data as Record<string, unknown>;
      out.set((fm.id as string | undefined) ?? name, fm);
    }
  return out;
}

/** content/synonyms.json's sets (group synonyms with `members`). */
export function readSoftSets(): SoftSet[] {
  const { groups } = splitSynonyms(readJson("content/synonyms.json") as SynonymsFile);
  return Object.entries(groups).flatMap(([key, g]) => (g.members && g.label ? [{ key, label: g.label, members: g.members }] : []));
}

export function readSoftTree(): SoftTreeData {
  const fm = readFrontMatter();
  return buildSoftTrees(
    {
      entries: readSoftIds() as unknown as TreeEntry[],
      readJson,
      field: (id, name) => fm.get(id)?.[name] ?? null,
      functionalJoints: readJson("content/joints.json") as FunctionalJoint[],
      jointNames: readJointNames(),
    },
    readSoftSets(),
  );
}

/**
 * One system's tree chunk (M14 plan decision 6, `virtual:skeleton-tree-<system>`): its lazy roots and the sets
 * under them. `roots` names each root's system (the registry's `TREE_ROOTS`; the fixture passes its own).
 */
export function systemTree(system: string, data: SoftTreeData, roots: readonly { key: string; system: string }[] = TREE_ROOTS): SoftTreeData {
  const mine = new Set(roots.filter((r) => r.system === system).map((r) => r.key));
  return { roots: data.roots.filter((r) => mine.has(r.key)), sets: data.sets.filter((s) => s.root !== undefined && mine.has(s.root)) };
}
