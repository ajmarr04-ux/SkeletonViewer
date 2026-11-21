import { useEffect, useRef, useState } from "react";
import { displayName } from "../content/names";
import { resolveClick } from "../state/isolation";
import { parentOf } from "../state/selection";
import { useViewer } from "../state/store";

/** Hover delay before the name shows (spec §6: about 150 ms). */
export const TOOLTIP_DELAY_MS = 150;
/** Offset from the pointer, CSS px (below and to the right, clear of the cursor). */
const OFFSET = { x: 14, y: 18 };

/**
 * Desktop hover tooltip (spec §6): the bone's name after the pointer has
 * rested on it for 150 ms. Hover is mouse-only (the rig never sets it for
 * touch or pen, nor during a drag). Hidden on wheel until the pointer moves
 * again, and never for the selected bone, which the info panel names. It
 * names what a click would select: a muscle's part names the muscle until the
 * muscle (or a sibling part) is selected (spec §5.1).
 */
export function Tooltip() {
  const hovered = useViewer((s) => s.hovered);
  const sel = useViewer((s) => s.sel);
  const [shown, setShown] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const wheelHidden = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      wheelHidden.current = false;
      setPos({ x: e.clientX, y: e.clientY });
    };
    const onWheel = () => {
      wheelHidden.current = true;
      setShown(null);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  useEffect(() => {
    setShown(null);
    if (hovered === null || hovered === sel) return;
    const t = window.setTimeout(() => {
      if (!wheelHidden.current) setShown(hovered);
    }, TOOLTIP_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [hovered, sel]);

  // The Tab cursor (plan step 4): the name at once, beside the bone's centre.
  const cursor = useViewer((s) => s.keyCursor);
  if (cursor) {
    const w = ref.current?.offsetWidth ?? 160;
    const left = Math.min(Math.max(4, cursor.x + OFFSET.x), window.innerWidth - w - 4);
    const top = Math.min(Math.max(4, cursor.y - OFFSET.y), window.innerHeight - 32);
    return (
      <div ref={ref} className="tooltip" role="tooltip" data-testid="tooltip" data-id={cursor.id} data-cursor="true" style={{ left, top }}>
        {displayName(resolveClick(cursor.id, sel, parentOf))}
      </div>
    );
  }
  if (shown === null) return null;
  // Keep it on screen: flip to the left / above near the right and bottom edges.
  const w = ref.current?.offsetWidth ?? 160;
  const h = ref.current?.offsetHeight ?? 28;
  const left = pos.x + OFFSET.x + w > window.innerWidth ? pos.x - OFFSET.x - w : pos.x + OFFSET.x;
  const top = pos.y + OFFSET.y + h > window.innerHeight ? pos.y - OFFSET.y - h : pos.y + OFFSET.y;
  return (
    <div ref={ref} className="tooltip" role="tooltip" data-testid="tooltip" data-id={shown} style={{ left, top }}>
      {displayName(resolveClick(shown, sel, parentOf))}
    </div>
  );
}
