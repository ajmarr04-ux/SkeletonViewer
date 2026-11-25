// The lazy layers' sidebar trees as shipped data (M9 plan decision 11; M12
// plan decision 10): built at build time by the builders in this folder from
// each layer's `TreeSpec`, shipped as `virtual:skeleton-soft-tree`. Group keys
// are the layer, then the path of keys (`muscles.upper_limb.shoulder`,
// `ligaments.knee_joint_left`). Labels only: no anatomy is added (spec §12).

export type SoftTreeLeaf = {
  id: string;
  label: string;
  /** Something is drawn for it: its own mesh, or (a structure with parts) its parts'. */
  drawn: boolean;
  /** Its parts, in table order. */
  parts?: SoftTreeLeaf[];
};

export type SoftTreeNode = {
  key: string;
  /** The tree's label ("Rotator cuff", "Elbow joint (left)"). */
  label: string;
  /** A name that stands on its own ("Muscles of the shoulder", "Ligaments of the elbow joint (left)"). */
  name: string;
  children: SoftTreeItem[];
};

export type SoftTreeItem = SoftTreeNode | SoftTreeLeaf;
export const isSoftNode = (i: SoftTreeItem): i is SoftTreeNode => "key" in i;

/** A group that isn't a tree node: a group synonym's own set ("Quadriceps femoris"), from content/synonyms.json; `root` is the root it sits under. */
export type SoftSet = { key: string; label: string; members: string[]; root?: string };

/** The roots, in sidebar order; each root's key is its layer's ID. */
export type SoftTreeData = { roots: SoftTreeNode[]; sets: SoftSet[] };

/** Every structure under a node (leaves; a structure with parts counts once), in tree order. */
export function nodeMembers(n: SoftTreeNode): string[] {
  return n.children.flatMap((c) => (isSoftNode(c) ? nodeMembers(c) : [c.id]));
}
