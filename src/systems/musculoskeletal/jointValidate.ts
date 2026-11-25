// The cross-file checks shared by the ligaments and the cartilage kinds (M8
// plan decision 3), moved from src/content/softValidate.ts onto their content
// halves (M12 plan decision 13): the joint (or `null` for a structure on the
// layer's no-joint list), then each referenced structure. Authoring half only.

import type { EntryCheck } from "../contentTypes";

const sideFree = (id: string) => id.replace(/_(left|right)$/, "");

type JointFm = { id: string; joint: string | null };

/** The joint field: null only on the no-joint list (side-free keys); else a joint on the structure's side. */
function checkJoint(d: JointFm, noJoint: ReadonlySet<string>, ctx: EntryCheck): string[] {
  const { where, entry: e } = ctx;
  if (d.joint === null) return noJoint.has(sideFree(d.id)) ? [] : [`${where}: joint is null, but ${sideFree(d.id)} isn't on the no-joint list (plan decision 3)`];
  if (!ctx.isJoint(d.joint)) return [`${where}: joint ${d.joint} is in neither articulations.json nor joints.json`];
  if ((e.side === "left" && d.joint.endsWith("_right")) || (e.side === "right" && d.joint.endsWith("_left"))) return [`${where}: joint ${d.joint} is on the other side`];
  return [];
}

/** A kind's check: its joint, then every ID in `field` (in order). */
export const jointStructureCheck =
  <F extends string>(field: F, noJoint: ReadonlySet<string>) =>
  (d: JointFm & Record<F, readonly string[]>, ctx: EntryCheck): string[] => [
    ...checkJoint(d, noJoint, ctx),
    ...d[field].flatMap((x, i) => ctx.ref(`${field}[${i}]`, x)),
  ];
