import { lazy, Suspense, useEffect, useRef } from "react";
import { regionCounts } from "../content/announce";
import { regionList } from "../regions/index";
import { chooseRegion, hasMesh } from "../state/selection";
import { useViewer } from "../state/store";
import { focusCanvas } from "./canvasFocus";

// The picker's chunk imports only React and its map data; everything it needs from the app comes in as props.
const RegionPicker = lazy(() => import("./RegionPicker"));

/** Open the body-region picker (M13 plan decision 8). */
export const openRegionPicker = (): void => useViewer.getState().setRegionPickerOpen(true);

/**
 * Mounts the region picker (a lazy chunk) while it is open, and on closing
 * returns focus to the toolbar's "Body region" button, or the "More" button
 * that held it on a phone, or the 3D view.
 */
export function RegionPickerHost() {
  const open = useViewer((s) => s.regionPickerOpen);
  const reg = useViewer((s) => s.reg);
  const modes = useViewer((s) => s.layers);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const back = document.querySelector<HTMLElement>("[data-testid=region-tool]") ?? document.querySelector<HTMLElement>(".toolbar button[aria-label=More]");
    if (back) back.focus();
    else focusCanvas();
  }, [open]);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <RegionPicker
        regions={regionList()}
        current={reg}
        count={(key) => Object.values(regionCounts(key, modes, hasMesh)).reduce((a, b) => a + (b ?? 0), 0)}
        onChoose={chooseRegion}
        onClosed={() => useViewer.getState().setRegionPickerOpen(false)}
      />
    </Suspense>
  );
}
