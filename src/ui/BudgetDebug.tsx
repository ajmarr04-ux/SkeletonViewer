import { formatCount } from "../scene/lod";
import { usePatchBatch } from "../scene/layerRegistry";
import { useViewer } from "../state/store";

/**
 * `?debug`: the budget governor's line (M13 plan decision 10): the drawn
 * total (index estimate), the budget, the caps, held layers and the patches
 * (reported, not counted). data-* attributes are read by the e2e tests.
 */
export function BudgetDebug() {
  const b = useViewer((s) => s.budget);
  const held = useViewer((s) => s.budgetHeld);
  const prompt = useViewer((s) => s.budgetPrompt);
  const patches = usePatchBatch((s) => s.batch?.solid.triangles ?? 0);
  if (!b) return null;
  return (
    <p
      className="debug-budget"
      data-testid="debug-budget"
      data-budget={b.limit}
      data-budget-source={b.limitSource}
      data-drawn={b.drawn}
      data-caps={b.caps.join(",")}
      data-over={String(b.over)}
      data-held={held.join(",")}
      data-prompt={prompt !== null ? "true" : "false"}
      data-patches={patches}
    >
      Budget: {formatCount(b.drawn)} of {formatCount(b.limit)} triangles ({b.limitSource === "url" ? "?budget=" : b.phone ? "phone" : "desktop"}, plan{" "}
      {b.planLod}, {b.source}){b.caps.length > 0 && ` · capped to low: ${b.caps.join(", ")}`}
      {held.length > 0 && ` · held: ${held.join(", ")}`}
      {b.over && " · over"}
      {patches > 0 && ` · patches ${formatCount(patches)} (not counted)`}
    </p>
  );
}
