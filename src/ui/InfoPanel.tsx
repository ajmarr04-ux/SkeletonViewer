import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { NO_PANEL } from "../camera/math";
import { panelModel, type PanelModel } from "../content/placeholder";
import { goBack, selectObject } from "../state/selection";
import { useViewer } from "../state/store";
import { focusCanvas } from "./canvasFocus";
import { PHONE_QUERY, useMedia } from "./useMedia";

/** Bottom-sheet snap points (spec §7: peek shows the name, half the summary, full everything). */
export type Snap = "peek" | "half" | "full";
export const SNAPS: readonly Snap[] = ["peek", "half", "full"];
export const PEEK_PX = 76;
/** Space kept above a full sheet so the breadcrumb stays visible. */
const FULL_TOP_PX = 48;
/** The breadcrumb's band at the top (shown whenever the panel is), kept clear when framing. */
export const BREADCRUMB_INSET_PX = 56;

/** Height of each snap point for a window `h` CSS px tall. */
export function snapHeights(h: number): Record<Snap, number> {
  const full = Math.max(PEEK_PX, h - FULL_TOP_PX);
  return { peek: PEEK_PX, half: Math.min(full, Math.max(PEEK_PX, Math.round(h * 0.5))), full };
}

/** The snap point nearest a dragged height. */
export function nearestSnap(height: number, heights: Record<Snap, number>): Snap {
  let best: Snap = "peek";
  for (const s of SNAPS) if (Math.abs(heights[s] - height) < Math.abs(heights[best] - height)) best = s;
  return best;
}

/** The next snap point on a tap: peek → half → full → peek. */
export const nextSnap = (s: Snap): Snap => SNAPS[(SNAPS.indexOf(s) + 1) % SNAPS.length]!;

/**
 * Info panel (spec §7) with placeholder content (Milestone 3): a right-hand
 * panel on desktop (collapsible), a bottom sheet on phones. It reports the
 * canvas area it covers to the store, so `F` and double-click frame the bone
 * beside it, and to CSS (`--panel-right`, `--panel-bottom`) for the toolbar.
 */
export function InfoPanel() {
  const sel = useViewer((s) => s.sel);
  const phone = useMedia(PHONE_QUERY);
  const model = sel === null ? null : panelModel(sel);
  const setInset = useViewer((s) => s.setPanelInset);
  const open = model !== null;

  // Clear the inset once the panel is gone.
  useEffect(() => {
    if (open) return;
    setInset(NO_PANEL);
    setCssInset(0, 0);
  }, [open, setInset]);

  if (!model) return null;
  return phone ? <Sheet key="sheet" model={model} /> : <SidePanel key="side" model={model} />;
}

function setCssInset(right: number, bottom: number): void {
  const root = document.documentElement;
  root.style.setProperty("--panel-right", `${right}px`);
  root.style.setProperty("--panel-bottom", `${bottom}px`);
  // Lets CSS make the toolbar icons-only when the side panel leaves it too little room.
  if (right > 0) root.dataset.panel = "side";
  else delete root.dataset.panel;
}

/** Report the element's covered area (right or bottom) while it is mounted. */
function useReportInset(ref: React.RefObject<HTMLElement | null>, edge: "right" | "bottom") {
  const setInset = useViewer((s) => s.setPanelInset);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => {
      const r = el.getBoundingClientRect();
      const right = edge === "right" ? Math.max(0, Math.round(window.innerWidth - r.left)) : 0;
      const bottom = edge === "bottom" ? Math.max(0, Math.round(window.innerHeight - r.top)) : 0;
      setInset({ right, bottom, top: BREADCRUMB_INSET_PX });
      setCssInset(right, bottom);
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    window.addEventListener("resize", report);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", report);
      setInset(NO_PANEL);
      setCssInset(0, 0);
    };
  }, [ref, edge, setInset]);
}

const onPanelKey = (e: KeyboardEvent) => {
  if (e.key !== "Escape" || e.defaultPrevented) return;
  e.preventDefault();
  back();
};

function back() {
  goBack();
  focusCanvas();
}

function SidePanel({ model }: { model: PanelModel }) {
  const ref = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  useReportInset(ref, "right");
  return (
    <aside
      ref={ref}
      className={`info-panel${collapsed ? " collapsed" : ""}`}
      aria-labelledby="panel-title"
      data-testid="info-panel"
      data-id={model.id}
      onKeyDown={onPanelKey}
    >
      <div className="panel-head">
        <Title model={model} />
        <button
          type="button"
          className="icon-button"
          aria-expanded={!collapsed}
          aria-controls="panel-body"
          aria-label={collapsed ? "Expand the information panel" : "Collapse the information panel"}
          title={collapsed ? "Expand" : "Collapse"}
          data-testid="panel-collapse"
          onClick={() => setCollapsed((c) => !c)}
        >
          <span aria-hidden="true">{collapsed ? "‹" : "›"}</span>
        </button>
      </div>
      {!collapsed && (
        <div className="panel-body" id="panel-body">
          <Body model={model} />
        </div>
      )}
    </aside>
  );
}

function Sheet({ model }: { model: PanelModel }) {
  const ref = useRef<HTMLElement>(null);
  const [snap, setSnap] = useState<Snap>("peek");
  const [dragH, setDragH] = useState<number | null>(null);
  const [winH, setWinH] = useState(() => window.innerHeight);
  const drag = useRef<{ id: number; y0: number; h0: number; h: number; moved: boolean } | null>(null);
  useReportInset(ref, "bottom");
  useEffect(() => {
    const onResize = () => setWinH(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const heights = snapHeights(winH);
  const height = dragH ?? heights[snap];

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button:not(.sheet-handle)")) return;
    drag.current = { id: e.pointerId, y0: e.clientY, h0: height, h: height, moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Not an active pointer (synthetic events): the drag still works while over the header.
    }
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.abs(dy) <= 5) return;
    d.moved = true;
    d.h = Math.min(heights.full, Math.max(heights.peek, d.h0 - dy));
    setDragH(d.h);
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.moved) {
      setSnap(nearestSnap(d.h, heights));
      setDragH(null);
    } else if (!(e.target as HTMLElement).closest("button")) {
      setSnap(nextSnap); // a tap on the header (the handle button handles its own clicks)
    }
  };
  const onCancel = () => {
    drag.current = null;
    setDragH(null);
  };

  return (
    <aside
      ref={ref}
      className="sheet"
      aria-labelledby="panel-title"
      data-testid="info-panel"
      data-id={model.id}
      data-snap={snap}
      style={{ height }}
      onKeyDown={onPanelKey}
    >
      <div className="sheet-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}>
        <button
          type="button"
          className="sheet-handle"
          aria-label={snap === "full" ? "Shrink the information panel" : "Expand the information panel"}
          aria-expanded={snap !== "peek"}
          aria-controls="panel-body"
          data-testid="sheet-handle"
          onClick={() => setSnap(nextSnap)}
        >
          <span aria-hidden="true" />
        </button>
        <Title model={model} />
      </div>
      <div className="panel-body" id="panel-body" hidden={snap === "peek" && dragH === null}>
        <Body model={model} />
      </div>
    </aside>
  );
}

function Title({ model }: { model: PanelModel }) {
  return (
    <div className="panel-title">
      <h2 id="panel-title">{model.name}</h2>
      <p className="latin">{model.latin ?? "Latin name not written yet"}</p>
    </div>
  );
}

function Body({ model }: { model: PanelModel }) {
  const [summary, ...rest] = model.sections;
  return (
    <>
      <p className="common">
        <span className="muted">Common name:</span> {model.common ?? "Not written yet"}
      </p>
      {model.pair && <SideToggle pair={model.pair} current={model.id} />}
      <ul className="badges" aria-label="Classification">
        <li className="badge">{model.badges.region}</li>
        <li className="badge">{model.badges.type}</li>
        {model.badges.draft && <li className="badge draft">Draft — not yet reviewed</li>}
      </ul>
      {model.note && (
        <p className="no-model" data-testid="no-model-note">
          {model.note}
        </p>
      )}
      {summary && <Section title={summary.title} text={summary.text} />}
      {rest.map((s) => (
        <Section key={s.title} title={s.title} text={s.text}>
          {s.title === "Key landmarks" && (
            <label className="toggle disabled">
              <input type="checkbox" disabled /> Show landmarks
            </label>
          )}
        </Section>
      ))}
      <div className="panel-actions">
        <button type="button" className="button" disabled title="Arrives in Milestone 4">
          Show related
        </button>
        <button type="button" className="button" disabled title="Arrives in Milestone 4">
          Expand region
        </button>
        <button type="button" className="button primary" data-testid="panel-back" onClick={back}>
          Back
        </button>
      </div>
    </>
  );
}

function Section({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <section className="panel-section">
      <h3>{title}</h3>
      <p className="muted">{text}</p>
      {children}
    </section>
  );
}

/** Paired bones (spec §6): jump to the other side; the pivot follows, the view stays. */
function SideToggle({ pair, current }: { pair: { left: string; right: string }; current: string }) {
  return (
    <div className="side-toggle" role="group" aria-label="Side">
      {(["left", "right"] as const).map((side) => (
        <button
          key={side}
          type="button"
          aria-pressed={pair[side] === current}
          data-testid={`side-${side}`}
          onClick={() => pair[side] !== current && selectObject(pair[side])}
        >
          {side === "left" ? "Left" : "Right"}
        </button>
      ))}
    </div>
  );
}
