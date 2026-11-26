// The body-region picker (M13 plan decision 8, SPEC-platform §6.4): a modal
// dialog with the region list (an ARIA tree, the primary control) and the
// generated front and back body maps. Its own lazy chunk (src/ui/RegionPickerHost.tsx
// loads it the first time the picker opens), so the maps stay out of the main chunk.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import map from "virtual:skeleton-region-map";
import type { RegionInfo } from "../regions/codec";

/**
 * What the picker needs from the app, passed in by src/ui/RegionPickerHost.tsx
 * so that this chunk imports nothing of the app's own (a lazy chunk sharing the
 * app's modules would make the bundler split the main chunk differently, at a
 * cost of a few kB: the BK lesson in the plan's session notes).
 */
export type RegionPickerProps = {
  /** Fine regions, then coarse, in file order. */
  regions: readonly RegionInfo[];
  /** The region in focus, or null. */
  current: string | null;
  /** How many structures each region shows on the layers showing. */
  count: (key: string) => number;
  /** Choose a region (with its volume's box) or, with null, the whole body. */
  onChoose: (key: string | null, box: { min: [number, number, number]; max: [number, number, number] } | null) => void;
  /** The dialog closed (Esc, Close, the backdrop or a choice). */
  onClosed: () => void;
};

type Row = { info: RegionInfo; level: 1 | 2; parent: string | null; pos: number; size: number };

/** Coarse regions in file order, each followed by its fine regions while it is open. */
function treeRows(all: readonly RegionInfo[], open: ReadonlySet<string>): Row[] {
  const coarse = all.filter((r) => !r.fine);
  const rows: Row[] = [];
  coarse.forEach((c, i) => {
    rows.push({ info: c, level: 1, parent: null, pos: i + 1, size: coarse.length });
    if (!open.has(c.key)) return;
    const fine = all.filter((r) => r.fine && r.coarse === c.key);
    fine.forEach((f, j) => rows.push({ info: f, level: 2, parent: c.key, pos: j + 1, size: fine.length }));
  });
  return rows;
}

export default function RegionPicker({ regions, current: reg, count: countOf, onChoose, onClosed }: RegionPickerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const current = reg !== null ? regions.find((r) => r.key === reg) : undefined;
  const [open, setOpenRows] = useState<Set<string>>(() => new Set(current ? [current.fine ? current.coarse! : current.key] : []));
  const rows = useMemo(() => treeRows(regions, open), [regions, open]);
  const [active, setActive] = useState<string>(() => reg ?? rows[0]?.info.key ?? "");
  const items = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    d.showModal();
    items.current.get(active)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => dialog.current?.close();
  const choose = (key: string | null) => {
    onChoose(key, key === null ? null : (map.boxes[key] ?? null));
    close();
  };
  const toggle = (key: string, to?: boolean) =>
    setOpenRows((o) => {
      const n = new Set(o);
      if (to ?? !n.has(key)) n.add(key);
      else n.delete(key);
      return n;
    });
  const moveTo = (key: string) => {
    setActive(key);
    items.current.get(key)?.focus();
  };

  const onTreeKey = (e: KeyboardEvent) => {
    const i = rows.findIndex((r) => r.info.key === active);
    const row = rows[i];
    if (!row) return;
    const isOpen = open.has(row.info.key);
    switch (e.key) {
      case "ArrowDown":
        if (rows[i + 1]) moveTo(rows[i + 1]!.info.key);
        break;
      case "ArrowUp":
        if (rows[i - 1]) moveTo(rows[i - 1]!.info.key);
        break;
      case "Home":
        moveTo(rows[0]!.info.key);
        break;
      case "End":
        moveTo(rows[rows.length - 1]!.info.key);
        break;
      case "ArrowRight":
        if (row.level === 1 && !isOpen) toggle(row.info.key, true);
        else if (row.level === 1 && rows[i + 1]?.parent === row.info.key) moveTo(rows[i + 1]!.info.key);
        break;
      case "ArrowLeft":
        if (row.level === 1 && isOpen) toggle(row.info.key, false);
        else if (row.parent) moveTo(row.parent);
        break;
      case "Enter":
      case " ":
        choose(row.info.key);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <dialog
      ref={dialog}
      className="region-picker"
      aria-labelledby="region-picker-title"
      data-testid="region-picker"
      onClose={onClosed}
      onClick={(e) => {
        // A click on the backdrop (the dialog element itself, outside its box) closes it.
        if (e.target === dialog.current) close();
      }}
    >
      <div className="region-picker-head">
        <h2 id="region-picker-title">Body region</h2>
        <button type="button" className="icon-button" aria-label="Close" title="Close (Esc)" onClick={close}>
          ×
        </button>
      </div>
      <p className="muted region-picker-hint">Show only what lies in one part of the body, on every layer. Counts are for the layers showing.</p>
      <button type="button" className="button region-whole" data-testid="region-whole" aria-pressed={reg === null} onClick={() => choose(null)}>
        Whole body
      </button>
      <div className="region-picker-body">
        <ul className="tree region-tree" role="tree" aria-label="Body regions" data-testid="region-tree" onKeyDown={onTreeKey}>
          {rows.map((r) => {
            const key = r.info.key;
            const isOpen = open.has(key);
            const count = countOf(key);
            return (
              <li
                key={key}
                ref={(el) => {
                  if (el) items.current.set(key, el);
                  else items.current.delete(key);
                }}
                role="treeitem"
                className={`tree-row ${r.level === 1 ? "tree-group" : "tree-leaf"}`}
                style={{ paddingLeft: 6 + (r.level - 1) * 18 }}
                aria-level={r.level}
                aria-posinset={r.pos}
                aria-setsize={r.size}
                aria-expanded={r.level === 1 ? isOpen : undefined}
                aria-selected={reg === key}
                aria-label={`${r.info.name}, ${count}`}
                tabIndex={key === active ? 0 : -1}
                data-region={key}
                onFocus={() => setActive(key)}
                onClick={() => choose(key)}
              >
                {r.level === 1 && (
                  <span
                    className="tree-chevron"
                    aria-hidden="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(key);
                      moveTo(key);
                    }}
                  >
                    {isOpen ? "▾" : "▸"}
                  </span>
                )}
                <span className="tree-label">{r.info.name}</span>
                <span className="tree-count" aria-hidden="true">
                  {count}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="region-maps">
          {map.views.map((v) => (
            <MapView key={v.view} view={v} current={reg} onChoose={choose} />
          ))}
        </div>
      </div>
    </dialog>
  );
}

function MapView({ view, current, onChoose }: { view: (typeof map.views)[number]; current: string | null; onChoose: (key: string) => void }) {
  const label = view.view === "front" ? "Front" : "Back";
  const [w, h] = view.viewBox.split(" ").slice(2).map(Number) as [number, number];
  // One stop in the Tab order per map (roving tabindex): the arrow keys move between its regions.
  const [active, setActive] = useState(() => Math.max(0, view.shapes.findIndex((s) => s.key === current)));
  const refs = useRef<(SVGGElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = view.shapes.length;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChoose(view.shapes[i]!.key);
      return;
    }
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  };
  // The patient's right is on the viewer's left from the front, on the right from the back.
  const [l, r] = view.view === "front" ? ["R", "L"] : ["L", "R"];
  return (
    <figure className="region-map" data-view={view.view}>
      <figcaption>{label}</figcaption>
      <svg viewBox={`0 0 ${w} ${h + 60}`} role="group" aria-label={`Body map, ${label.toLowerCase()} view`} data-testid={`region-map-${view.view}`}>
        {view.shapes.map((s, i) => (
          <g
            key={s.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="button"
            className="map-region"
            aria-label={s.name}
            aria-pressed={current === s.key}
            tabIndex={i === active ? 0 : -1}
            data-region={s.key}
            onFocus={() => setActive(i)}
            onClick={() => onChoose(s.key)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <title>{s.name}</title>
            <path d={s.d} />
          </g>
        ))}
        <text x={20} y={h + 45} aria-hidden="true">
          {l}
        </text>
        <text x={w - 20} y={h + 45} textAnchor="end" aria-hidden="true">
          {r}
        </text>
      </svg>
    </figure>
  );
}
