// The soft-tissue tree's input, read from disk (M9 plan decision 11): the
// soft-tissue table, the muscle hierarchy, each ligament's and cartilage's
// `joint`, the functional joints and joint names, and the group synonyms that
// define their own set. Shared by the Vite plugin, the search index and the tests.
import { splitFrontMatter } from "../../src/content/frontmatter";
import { splitSynonyms, type SynonymsFile } from "../../src/content/schema";
import { buildSoftTree, type SoftSet, type SoftTreeData } from "../../src/content/softTree";
import { readJointNames, readJson, readSoftFiles, readSoftIds } from "./content-files";

export function readJointOf(): Record<string, string | null> {
  const files = readSoftFiles();
  const out: Record<string, string | null> = {};
  for (const layer of ["ligaments", "cartilage"] as const)
    for (const [name, text] of files[layer]) {
      const fm = splitFrontMatter(text).data as { id?: string; joint?: string | null };
      out[fm.id ?? name] = fm.joint ?? null;
    }
  return out;
}

/** content/synonyms.json's sets (group synonyms with `members`). */
export function readSoftSets(): SoftSet[] {
  const { groups } = splitSynonyms(readJson("content/synonyms.json") as SynonymsFile);
  return Object.entries(groups).flatMap(([key, g]) => (g.members && g.label ? [{ key, label: g.label, members: g.members }] : []));
}

export function readSoftTree(): SoftTreeData {
  return buildSoftTree({
    softIds: readSoftIds() as Parameters<typeof buildSoftTree>[0]["softIds"],
    muscleHierarchy: readJson("content/muscle-hierarchy.json") as Parameters<typeof buildSoftTree>[0]["muscleHierarchy"],
    jointOf: readJointOf(),
    functionalJoints: readJson("content/joints.json") as Parameters<typeof buildSoftTree>[0]["functionalJoints"],
    jointNames: readJointNames(),
    sets: readSoftSets(),
  });
}
