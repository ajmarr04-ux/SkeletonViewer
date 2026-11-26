import { BUDGET_PROMPT } from "../scene/budget";
import { dismissBudgetPrompt } from "../state/budget";
import { useViewer } from "../state/store";
import { openRegionPicker } from "./RegionPickerHost";

/**
 * The budget governor's step 2 (M13 plan decision 10): a non-blocking prompt
 * above the toolbar while the view is still over the device budget. "Choose a
 * body region" opens the picker (which also dismisses the prompt for this
 * view); "Not now" dismisses it until the layers or the region change. The
 * text is announced once by the live region (`composeAnnouncement`).
 */
export function BudgetPrompt() {
  const shown = useViewer((s) => s.budgetPrompt !== null);
  if (!shown) return null;
  return (
    <section className="budget-prompt" aria-label="Heavy view" data-testid="budget-prompt">
      <p>{BUDGET_PROMPT}</p>
      <div className="budget-prompt-actions">
        <button type="button" className="button primary" onClick={openRegionPicker}>
          Choose a body region
        </button>
        <button type="button" className="button" onClick={dismissBudgetPrompt}>
          Not now
        </button>
      </div>
    </section>
  );
}
