import { useEffect, useState } from "react";
import { antagonistCount, composeAnnouncement, isolationAnnouncement, type AnnounceDeps, type AnnounceState } from "../content/announce";
import { jointAnnouncement } from "../content/placeholder";
import { peeledMuscleCount } from "../content/softRegistry";
import { hasMesh } from "../state/selection";
import { useViewer, type ViewerState } from "../state/store";
import { LAZY_LAYERS, type LazyLayerId } from "../systems/registry";

/** The part of the store the announcements compare (M10 plan decision 4). */
function snapshot(s: ViewerState): AnnounceState {
  const load: AnnounceState["load"] = {};
  for (const l of LAZY_LAYERS) {
    const x = s.layerLoad[l];
    if (x) load[l] = { shown: x.lod !== null, status: x.status, attempt: x.attempt };
  }
  return { sel: s.sel, tier: s.tier, grp: s.grp, reg: s.reg, antagonists: s.antagonists, layers: s.layers, layersVia: s.layersVia, depth: s.muscleDepth, load };
}

const DEPS: AnnounceDeps = {
  isolation: (now, prev) => isolationAnnouncement(now, prev, useViewer.getState().layers, hasMesh),
  antagonists: (now) => antagonistCount(now.sel, now.tier, now.layers, hasMesh),
  peeled: (stop) => peeledMuscleCount(stop),
};

/**
 * Polite live region (spec §10; M10 plan decision 4): one message per user
 * action. Every store change made in one task (a selection that turns its
 * layer on, a preset, Hide) is collected and composed after it into one
 * message by `composeAnnouncement`: an explicit `say` or the isolation first,
 * then antagonists, layers, depth and the layers' files. The layer messages
 * come from the store, so the panel, a preset, a selection and Back/Forward
 * say the same. Not the state the page opened with, only changes.
 */
export function Announcer() {
  const [text, setText] = useState("");
  useEffect(() => {
    let before = snapshot(useViewer.getState());
    let said: string | null = null;
    let hushed = false;
    let pending = false;
    const awaiting = new Set<LazyLayerId>();
    const flush = () => {
      pending = false;
      const now = snapshot(useViewer.getState());
      const msg = composeAnnouncement(before, now, said, DEPS, awaiting, hushed);
      before = now;
      said = null;
      hushed = false;
      if (msg !== null) setText(msg);
    };
    return useViewer.subscribe((s, p) => {
      if (s.announce !== p.announce && s.announce) said = s.announce.text;
      if (s.hushed !== p.hushed) hushed = true;
      if (!pending) {
        pending = true;
        queueMicrotask(flush);
      }
    });
  }, []);
  // Joint highlighting (plan step 7): "Hip joint: femur and hip bone highlighted." Only when it turns on.
  const joint = useViewer((s) => s.joint);
  useEffect(() => {
    if (joint) setText(joint.text ?? jointAnnouncement(joint.name, joint.a, joint.b));
  }, [joint]);
  return (
    <div className="visually-hidden" aria-live="polite" role="status" data-testid="announcer">
      {text}
    </div>
  );
}
