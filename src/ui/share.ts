// Share link (spec §7, plan decision 10). The URL already holds the whole view
// (sel, tier, grp, ghost, color, cam), so sharing is sharing the address.

import { useViewer } from "../state/store";
import { coarsePointer } from "./capture";

export type ShareOutcome = "shared" | "copied" | "manual" | "cancelled";

/**
 * Share the current view: the share sheet on phones (Web Share API), else copy
 * the URL to the clipboard with a "Link copied" toast (also announced). If the
 * clipboard is unavailable, `onManual` is called with the URL so the UI can
 * show it in a read-only field, selected, for the user to copy.
 */
export async function shareView(onManual: (url: string) => void): Promise<ShareOutcome> {
  const url = window.location.href;
  const st = useViewer.getState();
  if (coarsePointer() && typeof navigator.share === "function") {
    try {
      await navigator.share({ url, title: document.title });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  try {
    if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
    await navigator.clipboard.writeText(url);
    st.showToast("Link copied");
    return "copied";
  } catch {
    onManual(url);
    return "manual";
  }
}
