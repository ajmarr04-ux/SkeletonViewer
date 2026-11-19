import { useEffect, useState } from "react";
import { useViewer } from "../state/store";

const SHOW_MS = 2500;

/**
 * A short message above the toolbar ("Link copied"), for 2.5 s. The text is
 * announced through the live region by `showToast`, so this is `aria-hidden`
 * and the screen reader hears it once.
 */
export function Toast() {
  const toast = useViewer((s) => s.toast);
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    setShown(toast.text);
    const t = window.setTimeout(() => setShown(null), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [toast]);
  if (shown === null) return null;
  return (
    <div className="toast" aria-hidden="true" data-testid="toast">
      {shown}
    </div>
  );
}
