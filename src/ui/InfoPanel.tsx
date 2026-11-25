import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { NO_PANEL } from "../camera/math";
import { groupCounts, groupOf, type Group } from "../content/groups";
import { displayName } from "../content/names";
import { isEagerId } from "../content/index";
import { NOT_WRITTEN, type ActionRow, type PanelLink, type PanelModel, type SectionModel } from "../panel/model";
import type { AttachmentList } from "../systems/musculoskeletal/muscles/panel";
import { expandRegion, goBack, hasMesh, hideSelected, isMuscleKind, isolateAttached, selectLink, setAntagonists, showRelated, switchSide, tierBlockedReason } from "../state/selection";
import { useGraphVersion } from "../content/appGraph";
import { useViewer, type JointHighlight } from "../state/store";
import { focusCanvas } from "./canvasFocus";
import { usePanelModel } from "./usePanelModel";
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
/**
 * Info panel (spec §7): a right-hand panel on desktop (collapsible), a bottom
 * sheet on phones. A structure's panel is the generic model (src/panel/model.ts)
 * rendered section by section in its kind's descriptor order (M12 BE); a group
 * shows its members. It reports the canvas area it covers to the store, so `F`
 * and double-click frame the structure beside it, and to CSS (`--panel-right`,
 * `--panel-bottom`) for the toolbar.
 */
export function InfoPanel() {
  const sel = useViewer((s) => s.sel);
  const grp = useViewer((s) => s.grp);
  const phone = useMedia(PHONE_QUERY);
  const model = usePanelModel(sel);
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
  else if (group?.attached) view = { id: null, group: group.key, head: <GroupTitle group={group} />, body: <AttachedGroupBody group={group} /> };
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

/** The name, the Latin name (or the kind's type line) and, for a part, the structure it belongs to. */
function Title({ model }: { model: PanelModel }) {
  const { subtitle, partOf } = model;
  return (
    <div className="panel-title">
      <h2 id="panel-title" tabIndex={-1}>
        {model.title}
      </h2>
      {subtitle.latin ? (
        <p className="latin" lang="la">
          {subtitle.text}
        </p>
      ) : (
        <p className="latin">{subtitle.text}</p>
      )}
      {partOf && (
        <p className="part-of-title" data-testid="part-of">
          <span className="muted">Part of</span>{" "}
          <button type="button" className="link-inline" data-testid={`link-${partOf.id}`} onClick={() => selectFromPanel(partOf.id)}>
            {partOf.name}
          </button>
        </p>
      )}
    </div>
  );
}

function GroupTitle({ group }: { group: Group }) {
  useGraphVersion(); // an attached-muscles group fills in when the muscles' content arrives
  const { shown, total } = groupCounts(group.key);
  if (group.attached) {
    const n = group.members.length - 1;
    return (
      <div className="panel-title">
        <h2 id="panel-title" tabIndex={-1}>
          {group.name}
        </h2>
        <p className="latin" data-testid="group-count">
          {group.attached.loading ? "Loading the muscles…" : `Group · ${n} ${n === 1 ? "muscle or part" : "muscles and parts"}`}
        </p>
      </div>
    );
  }
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

/**
 * "Show attached muscles" (spec §5.4): the bone, then its Origins and
 * Insertions as links (hovering one highlights it); Back returns to the bone.
 */
function AttachedGroupBody({ group }: { group: Group }) {
  useGraphVersion();
  const a = group.attached!;
  const bone = { id: a.bone, label: displayName(a.bone) };
  const rows = (ids: readonly string[]) => ids.map((id) => ({ id, label: displayName(id) })).sort((x, y) => x.label.localeCompare(y.label));
  return (
    <>
      <section className="panel-section" aria-labelledby="h-bone" data-testid="section-bone">
        <h3 id="h-bone">Bone</h3>
        <ul className="links">
          <li>
            <LinkButton link={bone} />
          </li>
        </ul>
      </section>
      {a.loading ? (
        <p className="muted">Loading the muscles…</p>
      ) : (
        <Section title="Attached muscles" testId="muscles">
          <AttachedList title="Origins" testId="origins" bone={a.bone} rows={rows(a.origins)} role="origin" />
          <AttachedList title="Insertions" testId="insertions" bone={a.bone} rows={rows(a.insertions)} role="insertion" />
        </Section>
      )}
      <div className="panel-actions">
        <button type="button" className="button primary" data-testid="panel-back" onClick={back}>
          Back
        </button>
      </div>
    </>
  );
}

/**
 * A bone's Origins or Insertions (spec §5.4; M9 plan decision 9): each muscle
 * or part a link that selects it; hovering or focusing a row (press-and-hold
 * on touch) highlights it with the bone, as an articulation row does.
 */
function AttachedList({ title, testId, bone, rows, role }: { title: string; testId: string; bone: string; rows: PanelLink[]; role: string }) {
  return (
    <div data-testid={`attached-${testId}`}>
      <h4>{title}</h4>
      {rows.length ? (
        <ul className="links">
          {rows.map((r) => (
            <li key={r.id}>
              <LinkButton link={r} joint={{ a: bone, b: r.id, name: r.label, text: `${r.label}: ${role} on ${displayName(bone)}, highlighted.` }} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">None.</p>
      )}
    </div>
  );
}

/** A related object in the panel: selecting it makes it the new focus; focus moves to the panel's title. */
function selectFromPanel(id: string) {
  void selectLink(id).then(() => requestAnimationFrame(() => document.getElementById("panel-title")?.focus()));
}

type Grouped = Extract<SectionModel, { render: "grouped-links" }>;

/** The attached-structures section (grouped links), if the kind has one: it drives "Show attached muscles". */
const groupedOf = (model: PanelModel): Grouped | undefined => model.sections.find((s): s is Grouped => s.render === "grouped-links");
/** Written, and every group empty. */
const allEmpty = (s: Grouped | undefined): boolean => s?.groups != null && s.groups.every((g) => g.links.length === 0);

/** The chrome (common name, side toggle, badges, no-model note), the sections in descriptor order, then the actions. */
function Body({ model }: { model: PanelModel }) {
  const grouped = groupedOf(model);
  const noAttached = allEmpty(grouped);
  const showCommon = model.common !== null || (model.commonShown === "always" && !model.written);
  return (
    <>
      {showCommon && (
        <p className="common" data-testid="common-name">
          <span className="muted">Common name:</span> {model.common ?? NOT_WRITTEN}
        </p>
      )}
      {model.pair && <SideToggle pair={model.pair} current={model.id} />}
      <ul className="badges" aria-label="Classification">
        {model.badges.map((b) => (
          <li key={b} className="badge">
            {b}
          </li>
        ))}
        {model.draft && <li className="badge draft">Draft — not yet reviewed</li>}
      </ul>
      {model.note && (
        <p className="no-model" data-testid="no-model-note">
          {model.note}
        </p>
      )}
      <Sections model={model} />
      <div className="panel-actions">
        <TierButtons id={model.id} />
        {grouped && (
          <button
            type="button"
            className="button"
            data-testid="show-attached"
            disabled={grouped.groups === null || noAttached}
            aria-describedby={noAttached ? "attached-reason" : undefined}
            title={noAttached ? "No muscles attach here" : "Show the bone with every muscle attached to it"}
            onClick={() => isolateAttached(model.id)}
          >
            Show attached muscles
          </button>
        )}
        {model.meshAvailable && <HideButton />}
        <button type="button" className="button primary" data-testid="panel-back" onClick={back}>
          Back
        </button>
      </div>
      <TierReason id={model.id} />
      {noAttached && (
        <p className="muted" id="attached-reason" data-testid="attached-reason">
          Show attached muscles: no muscles attach here.
        </p>
      )}
    </>
  );
}

/** The sections by render type (SPEC-platform §5.1): each in its kind's order, with its test ID. */
function Sections({ model }: { model: PanelModel }) {
  return (
    <>
      {model.sections.map((s) => (
        <Section key={s.testId} title={s.title} testId={s.testId}>
          <SectionBody s={s} model={model} />
        </Section>
      ))}
    </>
  );
}

function SectionBody({ s, model }: { s: SectionModel; model: PanelModel }) {
  switch (s.render) {
    case "text":
      return <TextSection s={s} written={model.written} />;
    case "list":
      return <ListSection s={s} />;
    case "links":
      return <LinksSection s={s} />;
    case "grouped-links":
      return <GroupedLinksSection s={s} focus={model.id} />;
    case "actions-table":
      return <ActionsTable s={s} />;
    case "custom": {
      const View = CUSTOM[s.component];
      if (!View) throw new Error(`InfoPanel: no custom section "${s.component}"`);
      return <View data={s.data} />;
    }
  }
}

/** What a section says while empty: its own text once written; "Not written yet" before (or with no text of its own). */
const Empty = ({ s, written = true }: { s: SectionModel; written?: boolean }) => <p className="muted">{written && s.empty !== undefined ? s.empty : NOT_WRITTEN}</p>;

function TextSection({ s, written }: { s: Extract<SectionModel, { render: "text" }>; written: boolean }) {
  if (!s.value) return <Empty s={s} written={written} />;
  if (s.format === "html") return <div className="summary" dangerouslySetInnerHTML={{ __html: s.value }} />;
  return (
    <p>
      {s.value}
      {s.inherited && <span className="muted"> (as the whole muscle)</span>}
    </p>
  );
}

function ListSection({ s }: { s: Extract<SectionModel, { render: "list" }> }) {
  return (
    <>
      {s.items === null ? <Empty s={s} written={false} /> : s.items.length === 0 && s.empty !== undefined ? <Empty s={s} /> : <List items={s.items} inline={s.inline} />}
      {s.count !== null && s.toggle !== null && (
        // The 3D positions of a list's items (the landmarks): none placed yet (M4 plan decision 9).
        <label className={`toggle${s.count === 0 ? " disabled" : ""}`}>
          <input type="checkbox" disabled={s.count === 0} /> {s.toggle}
          {s.count === 0 && <span className="muted"> (no positions yet)</span>}
        </label>
      )}
    </>
  );
}

/** Links, each selecting its target; with `highlight`, hovering one highlights the pair (an articulation). */
function LinkList({ links, highlight }: { links: PanelLink[]; highlight?: boolean }) {
  return (
    <ul className="links">
      {links.map((l) => (
        <li key={l.node === undefined ? l.id : `${l.id} ${l.node}`}>
          <LinkButton link={l} detail={l.detail} joint={highlight ? l.joint : undefined} />
        </li>
      ))}
    </ul>
  );
}

function LinksSection({ s }: { s: Extract<SectionModel, { render: "links" }> }) {
  if (s.links === null) return <Empty s={s} written={false} />;
  return (
    <>
      {s.links.length === 0 ? (
        s.empty !== undefined && <Empty s={s} />
      ) : s.nameOnly ? (
        <p>{s.links.map((l) => l.label).join(", ")}</p>
      ) : (
        <LinkList links={s.links} highlight={s.highlight} />
      )}
      {s.also && (
        <>
          <h4>{s.also.title}</h4>
          <LinkList links={s.also.links} />
        </>
      )}
    </>
  );
}

function GroupedLinksSection({ s, focus }: { s: Grouped; focus: string }) {
  if (s.groups === null) return <Empty s={s} written={false} />;
  if (allEmpty(s)) return <Empty s={s} />;
  return (
    <>
      {s.groups.map((g) => (
        <AttachedList key={g.testId} title={g.title} testId={g.testId} bone={focus} rows={g.links} role={g.role} />
      ))}
    </>
  );
}

const actionText = (a: ActionRow) => `${a.joint} · ${a.movement} · ${a.role}`;

/** Actions ("Elbow joint · extension · prime mover"); a part's inherited ones under their own heading; else the fallback list. */
function ActionsTable({ s }: { s: Extract<SectionModel, { render: "actions-table" }> }) {
  return (
    <>
      {s.rows.length > 0 && <List items={s.rows.map(actionText)} />}
      {s.inherited.length > 0 && (
        <>
          <h4>With the whole muscle</h4>
          <List items={s.inherited.map(actionText)} />
        </>
      )}
      {s.rows.length + s.inherited.length === 0 && (s.fallback.length ? <List items={s.fallback} /> : <Empty s={s} />)}
    </>
  );
}

/** An origin or insertion: each structure a link with its landmark, or the free text; a part's inherited one says so. */
function Attachments({ data }: { data: unknown }) {
  const list = data as AttachmentList;
  return (
    <>
      {list.inheritedFrom && <p className="muted">As the whole muscle ({list.inheritedFrom.label}):</p>}
      {list.rows.length === 0 ? (
        <p className="muted">None listed.</p>
      ) : (
        <ul className="links">
          {list.rows.map((r, i) => (
            <li key={`${r.link?.id ?? r.text}-${i}`}>
              {r.link ? (
                <LinkButton link={r.link} detail={[r.landmark, r.part].filter(Boolean).join(" · ") || undefined} />
              ) : (
                <p className="soft-attachment">
                  {r.text}
                  {r.part && <span className="muted"> · {r.part}</span>}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The `custom` sections' views by `component` (M12 plan decision 11: the escape hatch, `attachments` only). */
const CUSTOM: Readonly<Record<string, (p: { data: unknown }) => React.ReactNode>> = { attachments: Attachments };

/** Hide the selected structure (spec §5.5); `X` does the same. Focus goes back to the 3D view. */
function HideButton() {
  return (
    <button
      type="button"
      className="button"
      data-testid="panel-hide"
      aria-keyshortcuts="X"
      title="Hide it (X). Browser Back or Show all brings it back"
      onClick={() => {
        hideSelected();
        focusCanvas();
      }}
    >
      Hide
    </button>
  );
}

/** The tier buttons' wording: bones (spec §6), muscles and parts (M9 plan decision 5), the other structures. BG moves it onto the tier rules. */
function tierWords(id: string) {
  if (isMuscleKind(id))
    return { related: "Show attachments", expand: "Show functional group", relatedTitle: "Show the structures it attaches to", expandTitle: "Show the muscles that work with it", relatedShown: "Shown", expandShown: "Shown" };
  if (isEagerId(id))
    return { related: "Show related", expand: "Expand region", relatedTitle: "Show the bones it articulates with", expandTitle: "Show the surrounding region", relatedShown: "Related bones are shown", expandShown: "The region is shown" };
  return { related: "Show related", expand: "Expand region", relatedTitle: "Show the structures it joins", expandTitle: "Show the joint's other structures", relatedShown: "Shown", expandShown: "Shown" };
}

/**
 * Tier 1 and 2 (spec §6; M9 plan decisions 4 and 5). Disabled, with the
 * reason, while the layer's content loads, and Expand for a structure that has
 * no joint. "Show antagonists" at a muscle's tier 2.
 */
function TierButtons({ id }: { id: string }) {
  useGraphVersion();
  const tier = useViewer((s) => s.tier);
  const w = tierWords(id);
  const r1 = tierBlockedReason(id, 1);
  const r2 = tierBlockedReason(id, 2);
  const reason = r1 ?? r2;
  return (
    <>
      <button
        type="button"
        className="button"
        data-testid="show-related"
        aria-keyshortcuts="R"
        disabled={tier !== 0 || r1 !== null}
        title={r1 ?? (tier === 0 ? w.relatedTitle : w.relatedShown)}
        aria-describedby={reason ? "tier-reason" : undefined}
        onClick={showRelated}
      >
        {w.related}
      </button>
      <button
        type="button"
        className="button"
        data-testid="expand-region"
        aria-keyshortcuts="E"
        disabled={tier !== 1 || r2 !== null}
        title={r2 ?? (tier === 1 ? w.expandTitle : tier === 2 ? w.expandShown : `${w.related} first`)}
        aria-describedby={reason ? "tier-reason" : undefined}
        onClick={expandRegion}
      >
        {w.expand}
      </button>
      {isMuscleKind(id) && tier === 2 && <AntagonistToggle />}
    </>
  );
}

/** "Show antagonists" (spec §5.2, M9 plan decision 7): only at a muscle's tier 2, off by default; `ant=1`. */
function AntagonistToggle() {
  const on = useViewer((s) => s.antagonists);
  return (
    <button
      type="button"
      className="button"
      data-testid="show-antagonists"
      aria-pressed={on}
      title={on ? "Hide the antagonists" : "Show the muscles that oppose it, in their own colour"}
      onClick={() => setAntagonists(!on)}
    >
      Show antagonists
    </button>
  );
}

/** The reason a tier button is off, written out (a title alone isn't read on touch). */
function TierReason({ id }: { id: string }) {
  useGraphVersion();
  const r1 = tierBlockedReason(id, 1);
  const r2 = tierBlockedReason(id, 2);
  if (r1 === null && r2 === null) return null;
  const w = tierWords(id);
  const label = r1 !== null ? `${w.related} and ${w.expand}` : w.expand;
  return (
    <p className="muted" id="tier-reason" data-testid="tier-reason">
      {label}: {r1 ?? r2}.
    </p>
  );
}

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
