import { useEffect, useRef, useState } from "react";
import { groupAnnouncement, groupOf } from "../content/groups";
import { announcement, jointAnnouncement } from "../content/placeholder";
import { relations } from "../content/relations";
import { isolationView } from "../scene/isolation";
import { hasMesh } from "../state/selection";
import { useViewer } from "../state/store";

/**
 * Polite live region (spec §10): announces each change of isolation:
 * "Femur, left, selected. Isolated.", the related bones at tier 1, the region's
 * size at tier 2, and "Full skeleton". Not the state the page opened with, only
 * changes.
 */
export function Announcer() {
  const sel = useViewer((s) => s.sel);
  const tier = useViewer((s) => s.tier);
  const grp = useViewer((s) => s.grp);
  const [text, setText] = useState("");
  const prev = useRef<{ sel: string | null; tier: 0 | 1 | 2; grp: string | null } | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = { sel, tier, grp };
    if (before === null) return;
    if (sel === null && grp !== null) {
      // "Back to …" when returning from one of the group's own members.
      setText(groupAnnouncement(grp, before.sel !== null && (groupOf(grp)?.members.includes(before.sel) ?? false)));
      return;
    }
    const solid = isolationView(sel, tier, "ghost", hasMesh).solid;
    setText(announcement({ sel, tier }, before, (id) => relations.tier1(id), solid?.size ?? 0));
  }, [sel, tier, grp]);
  // Other announcements (the Tab cursor, the share toast): any change of `announce`.
  const announce = useViewer((s) => s.announce);
  useEffect(() => {
    if (announce) setText(announce.text);
  }, [announce]);
  // Joint highlighting (plan step 7): "Hip joint: femur and hip bone highlighted." Only when it turns on.
  const joint = useViewer((s) => s.joint);
  useEffect(() => {
    if (joint) setText(jointAnnouncement(joint.name, joint.a, joint.b));
  }, [joint]);
  return (
    <div className="visually-hidden" aria-live="polite" role="status" data-testid="announcer">
      {text}
    </div>
  );
}
