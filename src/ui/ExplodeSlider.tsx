import { useEffect } from "react";
import { EXPLODE, releaseValue } from "../scene/explode";
import { useViewer } from "../state/store";

let releaseToken = 0;

/** Ease the Explode value back to 0 (plan step 8): 400 ms, or at once with reduced motion. */
export function releaseExplode(): void {
  const st = useViewer.getState();
  const token = ++releaseToken;
  const from = st.explode;
  if (from === 0) return;
  if (st.reducedMotion || typeof requestAnimationFrame === "undefined") {
    st.setExplode(0);
    return;
  }
  const start = performance.now();
  const step = () => {
    if (token !== releaseToken) return; // grabbed again, or a newer release
    const v = releaseValue(from, performance.now() - start, EXPLODE.releaseMs);
    useViewer.getState().setExplode(v);
    if (v > 0) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Stop any release in progress (the slider was grabbed again). */
function holdExplode(): void {
  releaseToken++;
}

/**
 * The Explode slider (spec §6), in a toolbar popover at tiers 1 and 2: the
 * tier-1 bones move apart while it is held and ease back when it is let go
 * (pointer up, key up or blur). Zero by default; never stays exploded.
 */
export function ExplodeSlider() {
  const value = useViewer((s) => s.explode);
  const setExplode = useViewer((s) => s.setExplode);
  // Closing the popover (unmount) lets go too.
  useEffect(() => () => releaseExplode(), []);
  return (
    <div className="ghost-opacity">
      <label htmlFor="explode">Explode</label>
      <input
        id="explode"
        type="range"
        data-testid="explode"
        min={0}
        max={1}
        step={0.01}
        value={value}
        aria-valuetext={value === 0 ? "Together" : `${Math.round(value * 100)}% apart`}
        onPointerDown={holdExplode}
        onKeyDown={holdExplode}
        onChange={(e) => {
          holdExplode();
          setExplode(Number(e.currentTarget.value));
        }}
        onPointerUp={releaseExplode}
        onPointerCancel={releaseExplode}
        onKeyUp={releaseExplode}
        onBlur={releaseExplode}
      />
      <output htmlFor="explode">{Math.round(value * 100)}%</output>
    </div>
  );
}
