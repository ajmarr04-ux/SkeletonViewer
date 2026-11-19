import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { NO_PANEL } from "../camera/math";
import { groupCounts, groupOf, type Group } from "../content/groups";
import { useContent } from "../content/loader";
import { displayName } from "../content/names";
import { panelModel, type PanelLink, type PanelModel } from "../content/panel";
import { NOT_WRITTEN } from "../content/placeholder";
import { expandRegion, goBack, hasMesh, selectObject, showRelated, switchSide } from "../state/selection";
import { useViewer, type JointHighlight } from "../state/store";
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
 * Info panel (spec §7) with the compiled content (placeholder text for files
 * not written yet): a right-hand
 * panel on desktop (collapsible), a bottom sheet on phones. It reports the
 * canvas area it covers to the store, so `F` and double-click frame the bone
 * beside it, and to CSS (`--panel-right`, `--panel-bottom`) for the toolbar.
 */
export function InfoPanel() {
  const sel = useViewer((s) => s.sel);
  const grp = useViewer((s) => s.grp);
  const phone = useMedia(PHONE_QUERY);
  const content = useContent();
  const model = sel === null ? null : panelModel(sel, content);
  // A group (plan step 3): its name, member count and members as links.
  const group = sel === null && grp !== null ? (groupOf(grp) ?? null) : null;
  const setInset = useViewer((s) => s.setPanelInset);
  const open = model !== null || group !== null;

  // Clear the inset once the panel is gone.
  useEffect(() => {
    if (open) return;
    setInset(NO_PANEL);
    setCssInset(0, 0);
  }, [open, setInset]);

  let view: PanelView;
  if (model) view = { id: model.id, group: null, head: <Title model={model} />, body: <Body model={model} /> };
  else if (group) view = { id: null, group: group.key, head: <GroupTitle group={group} />, body: <GroupBody group={group} /> };
  else return null;
  return phone ? <Sheet key="sheet" view={view} /> : <SidePanel key="side" view={view} />;
}

/** What the panel shows: an object or a group, its title and its body. */
type PanelView = { id: string | null; group: string | null; head: React.ReactNode; body: React.ReactNode };

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

function SidePanel({ view }: { view: PanelView }) {
  const ref = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  useReportInset(ref, "right");
  return (
    <aside
      ref={ref}
      className={`info-panel${collapsed ? " collapsed" : ""}`}
      aria-labelledby="panel-title"
      data-testid="info-panel"
      data-id={view.id ?? undefined}
      data-group={view.group ?? undefined}
      onKeyDown={onPanelKey}
    >
      <div className="panel-head">
        {view.head}
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
          {view.body}
        </div>
      )}
    </aside>
  );
}

function Sheet({ view }: { view: PanelView }) {
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
      data-id={view.id ?? undefined}
      data-group={view.group ?? undefined}
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
        {view.head}
      </div>
      <div className="panel-body" id="panel-body" hidden={snap === "peek" && dragH === null}>
        {view.body}
      </div>
    </aside>
  );
}

function Title({ model }: { model: PanelModel }) {
  return (
    <div className="panel-title">
      <h2 id="panel-title" tabIndex={-1}>
        {model.name}
      </h2>
      <p className="latin" lang="la">
        {model.latin ?? (model.written ? "" : "Latin name not written yet")}
      </p>
    </div>
  );
}

function GroupTitle({ group }: { group: Group }) {
  const { shown, total } = groupCounts(group.key);
  return (
    <div className="panel-title">
      <h2 id="panel-title" tabIndex={-1}>
        {group.name}
      </h2>
      <p className="latin" data-testid="group-count">
        Group · {shown === total ? `${total} ${total === 1 ? "object" : "objects"}` : `${shown} of ${total} have a 3D model`}
      </p>
    </div>
  );
}

/** A group's members (plan step 3): each a link that makes it the focus at tier 0; Back returns here. */
function GroupBody({ group }: { group: Group }) {
  return (
    <>
      <section className="panel-section" aria-labelledby="h-members" data-testid="section-members">
        <h3 id="h-members">Members</h3>
        <ul className="links">
          {group.members.map((id) => (
            <li key={id}>
              <LinkButton link={{ id, label: displayName(id) }} detail={hasMesh(id) ? undefined : "No 3D model"} />
            </li>
          ))}
        </ul>
      </section>
      <div className="panel-actions">
        <button type="button" className="button primary" data-testid="panel-back" onClick={back}>
          Back
        </button>
      </div>
    </>
  );
}

/** A related object in the panel: selecting it makes it the new focus; focus moves to the panel's title. */
function selectFromPanel(id: string) {
  selectObject(id);
  requestAnimationFrame(() => document.getElementById("panel-title")?.focus());
}

function Body({ model }: { model: PanelModel }) {
  const tier = useViewer((s) => s.tier);
  const isTooth = model.kind === "tooth";
  return (
    <>
      {(!model.written || model.common) && (
        <p className="common" data-testid="common-name">
          <span className="muted">Common name:</span> {model.common ?? NOT_WRITTEN}
        </p>
      )}
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
      <Section title="Summary" testId="summary">
        {model.summary !== null ? <div className="summary" dangerouslySetInnerHTML={{ __html: model.summary }} /> : <Unwritten />}
      </Section>
      <Section title="Functions" testId="functions">
        {model.functions ? <List items={model.functions} /> : <Unwritten />}
      </Section>
      <Section title="Articulations" testId="articulations">
        {model.articulations.length ? (
          <ul className="links">
            {model.articulations.map((a) => (
              <li key={a.joint}>
                <LinkButton link={a} detail={a.name} joint={{ a: model.id, b: a.id, name: a.name }} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No bony articulation.</p>
        )}
        {isTooth && model.neighbours.length > 0 && (
          <>
            <h4>Neighbouring teeth</h4>
            <ul className="links">
              {model.neighbours.map((n) => (
                <li key={n.id}>
                  <LinkButton link={n} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
      <Section title="Key landmarks" testId="landmarks">
        {model.landmarks ? model.landmarks.length ? <List items={model.landmarks} inline /> : <p className="muted">None listed.</p> : <Unwritten />}
        <label className={`toggle${model.landmarkPositions === 0 ? " disabled" : ""}`}>
          <input type="checkbox" disabled={model.landmarkPositions === 0} /> Show landmarks
          {model.landmarkPositions === 0 && <span className="muted"> (no positions yet)</span>}
        </label>
      </Section>
      <Section title="Major muscle attachments" testId="muscles">
        {model.muscles ? (
          model.muscles.length ? <List items={model.muscles} inline /> : <p className="muted">{isTooth ? "None (teeth have no muscle attachments)." : "None."}</p>
        ) : (
          <Unwritten />
        )}
      </Section>
      <Section title="Clinical note" testId="clinical">
        {model.clinical ? <p>{model.clinical}</p> : model.written ? <p className="muted">None.</p> : <Unwritten />}
      </Section>
      <div className="panel-actions">
        <button
          type="button"
          className="button"
          data-testid="show-related"
          disabled={tier !== 0}
          title={tier === 0 ? "Show the bones it articulates with" : "Related bones are shown"}
          onClick={showRelated}
        >
          Show related
        </button>
        <button
          type="button"
          className="button"
          data-testid="expand-region"
          disabled={tier !== 1}
          title={tier === 1 ? "Show the surrounding region" : tier === 2 ? "The region is shown" : "Show related first"}
          onClick={expandRegion}
        >
          Expand region
        </button>
        <button type="button" className="button primary" data-testid="panel-back" onClick={back}>
          Back
        </button>
      </div>
    </>
  );
}

const Unwritten = () => <p className="muted">{NOT_WRITTEN}</p>;

function List({ items, inline = false }: { items: string[]; inline?: boolean }) {
  return (
    <ul className={inline ? "inline-list" : "plain-list"}>
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

/** Press-and-hold time that highlights a joint on a touch screen (plan step 7). */
export const JOINT_HOLD_MS = 450;

/**
 * A link to another object. For an articulation (`joint`), hovering or focusing
 * it highlights both bones (spec §6, plan step 7); on a touch screen a
 * press-and-hold does, and a tap still selects the partner.
 */
function LinkButton({ link, detail, joint }: { link: PanelLink; detail?: string; joint?: JointHighlight }) {
  const hold = useRef<{ timer: number; held: boolean } | null>(null);
  const setJoint = useViewer((s) => s.setJoint);
  const on = () => joint && setJoint(joint);
  const off = () => {
    if (!joint) return;
    const cur = useViewer.getState().joint;
    if (cur && cur.a === joint.a && cur.b === joint.b) setJoint(null);
  };
  // Clear the highlight if the button goes away while it is on (a new selection clears it anyway).
  useEffect(() => off, []); // eslint-disable-line react-hooks/exhaustive-deps
  const endHold = () => {
    if (!hold.current) return;
    window.clearTimeout(hold.current.timer);
    if (hold.current.held) off();
  };
  return (
    <button
      type="button"
      className="link-button"
      data-testid={`link-${link.id}`}
      onClick={(e) => {
        const held = hold.current?.held;
        hold.current = null;
        if (held) {
          e.preventDefault();
          return;
        }
        selectFromPanel(link.id);
      }}
      onPointerEnter={joint ? (e) => e.pointerType === "mouse" && on() : undefined}
      onPointerLeave={joint ? (e) => e.pointerType === "mouse" && off() : undefined}
      onFocus={joint ? (e) => e.currentTarget.matches(":focus-visible") && on() : undefined}
      onBlur={joint ? off : undefined}
      onPointerDown={
        joint
          ? (e) => {
              if (e.pointerType === "mouse") return;
              const h = { timer: 0, held: false };
              h.timer = window.setTimeout(() => {
                h.held = true;
                on();
              }, JOINT_HOLD_MS);
              hold.current = h;
            }
          : undefined
      }
      onPointerUp={joint ? endHold : undefined}
      onPointerCancel={
        joint
          ? () => {
              endHold();
              hold.current = null;
            }
          : undefined
      }
      onContextMenu={joint ? (e) => e.preventDefault() : undefined}
      data-joint={joint ? "true" : undefined}
    >
      <span className="link-name">{link.label}</span>
      {detail && <span className="link-detail">{detail}</span>}
    </button>
  );
}

function Section({ title, testId, children }: { title: string; testId: string; children?: React.ReactNode }) {
  return (
    <section className="panel-section" data-testid={`section-${testId}`} aria-labelledby={`h-${testId}`}>
      <h3 id={`h-${testId}`}>{title}</h3>
      {children}
    </section>
  );
}

/** Paired bones (spec §6): jump to the other side at the same tier; the pivot follows, the view stays. */
function SideToggle({ pair, current }: { pair: { left: string; right: string }; current: string }) {
  return (
    <div className="side-toggle" role="group" aria-label="Side">
      {(["left", "right"] as const).map((side) => (
        <button
          key={side}
          type="button"
          aria-pressed={pair[side] === current}
          data-testid={`side-${side}`}
          onClick={() => pair[side] !== current && switchSide(pair[side])}
        >
          {side === "left" ? "Left" : "Right"}
        </button>
      ))}
    </div>
  );
}
