import { useEffect, useRef, useState } from "react";
import { announcement } from "../content/placeholder";
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
  const [text, setText] = useState("");
  const prev = useRef<{ sel: string | null; tier: 0 | 1 | 2 } | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = { sel, tier };
    if (before === null) return;
    const solid = isolationView(sel, tier, "ghost", hasMesh).solid;
    setText(announcement({ sel, tier }, before, (id) => relations.tier1(id), solid?.size ?? 0));
  }, [sel, tier]);
  return (
    <div className="visually-hidden" aria-live="polite" role="status" data-testid="announcer">
      {text}
    </div>
  );
}
