import { useEffect, useRef, useState } from "react";
import { announcement } from "../content/placeholder";
import { useViewer } from "../state/store";

/**
 * Polite live region (spec §10): announces each change of selection,
 * "Femur, left, selected. Isolated." or "Full skeleton". Not the state the
 * page opened with, only changes.
 */
export function Announcer() {
  const sel = useViewer((s) => s.sel);
  const [text, setText] = useState("");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setText(announcement(sel));
  }, [sel]);
  return (
    <div className="visually-hidden" aria-live="polite" role="status" data-testid="announcer">
      {text}
    </div>
  );
}
