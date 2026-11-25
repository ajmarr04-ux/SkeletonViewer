import { useGraphVersion } from "../content/appGraph";
import { useContent } from "../content/loader";
import { oppositeOf } from "../content/placeholder";
import { useSoftContent } from "../content/softContentLoader";
import { softLayerOf, softOpposite } from "../content/softRegistry";
import { oppositeAcross, panelModel, type LayerContent, type PanelModel } from "../panel/model";
import { EAGER_LAYER } from "../systems/registry";

const opposite = oppositeAcross(oppositeOf, softOpposite);

/**
 * The generic panel model (src/panel/model.ts) for the selection, re-read as
 * its layer's content and the graph arrive. The eager layer's content is
 * always loaded (its landmarks name the muscles' attachments); a lazy layer's
 * when one of its structures is selected.
 */
export function usePanelModel(sel: string | null): PanelModel | null {
  useGraphVersion();
  const eager = useContent();
  const layer = sel === null ? null : softLayerOf(sel);
  const lazy = useSoftContent(layer);
  if (sel === null) return null;
  const content = (l: string): LayerContent | null =>
    l === EAGER_LAYER ? (eager as LayerContent | null) : l === layer ? (lazy as unknown as LayerContent | null) : null;
  return panelModel(sel, { content, opposite });
}
