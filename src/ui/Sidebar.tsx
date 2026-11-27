import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { ancestorsOf, groupAncestors, groupOf, softTreeVersion, subscribeSoftTree, treeLoaded } from "../content/groups";
import type { SearchHit, Searcher } from "../content/search";
import { loadLayerSearch, loadSearch, mergeSearchers } from "../content/searchLoader";
import { isSoftId, softEntry } from "../content/softRegistry";
import { loadTree } from "../content/softTreeLoader";
import { TOP_KEYS, openable, sidebarRows, systemOfRowKey, systemRowKey, treeKey, typeAhead, type TreeRow } from "../content/tree";
import { hasMesh, isolateGroup, selectAndFrame, selectLink } from "../state/selection";
import { useViewer } from "../state/store";
import { layerOfId } from "../content/index";
import { isInRegion } from "../regions/index";
import type { RankContext } from "../content/searchRank";
import { EAGER_LAYER, EAGER_SYSTEM, LAYER_IDS, SYSTEMS, TREE_ROOTS, TREE_SYSTEMS, isLayerId, layerDescriptor, layerLabel, treeSystemOf, type LayerId, type SystemId } from "../systems/registry";
import { focusCanvas } from "./canvasFocus";
import { PHONE_QUERY, useMedia } from "./useMedia";

export const SIDEBAR_ID = "sidebar";
const TOGGLE_ID = "sidebar-toggle";
const SEARCH_ID = "sidebar-search";
const rowId = (key: string) => `tree-${key}`;
const optionId = (id: string) => `result-${id}`;

/** True when a key press is meant for a text field, not a shortcut. */
function typingIn(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** Open the sidebar and put the cursor in the search field. */
export function openSearch(): void {
  useViewer.getState().setSidebarOpen(true);
  requestAnimationFrame(() => document.getElementById(SEARCH_ID)?.focus());
}

/** Close the sidebar; focus returns to the toolbar's Search button (or the canvas). */
export function closeSidebar(refocus = true): void {
  useViewer.getState().setSidebarOpen(false);
  if (!refocus) return;
  requestAnimationFrame(() => {
    const t = document.getElementById(TOGGLE_ID);
    if (t && t.offsetParent !== null) t.focus();
    else focusCanvas();
  });
}

/**
 * The sidebar (spec §7, plan step 2): search above the hierarchy tree, the
 * accessible twin of the 3D view. Left and collapsible on desktop (its width is
 * reported for framing); a full-screen sheet on phones. `/` opens it from
 * anywhere but a text field.
 */
export function Sidebar() {
  const open = useViewer((s) => s.sidebarOpen);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || typingIn(e.target)) return;
      e.preventDefault();
      openSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return open ? <SidebarPanel /> : null;
}

function SidebarPanel() {
  const phone = useMedia(PHONE_QUERY);
  const ref = useRef<HTMLElement>(null);
  const setLeft = useViewer((s) => s.setSidebarLeft);

  // Desktop: report the width it covers, for framing and for CSS (breadcrumb, toolbar).
  useLayoutEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    const report = () => {
      const px = phone || !el ? 0 : Math.max(0, Math.round(el.getBoundingClientRect().right));
      setLeft(px);
      root.style.setProperty("--sidebar-left", `${px}px`);
      // Lets CSS make the toolbar icons-only when the sidebar leaves it too little room.
      if (px > 0) root.dataset.sidebar = "open";
      else delete root.dataset.sidebar;
    };
    report();
    const ro = el ? new ResizeObserver(report) : null;
    if (el) ro!.observe(el);
    window.addEventListener("resize", report);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", report);
      setLeft(0);
      root.style.setProperty("--sidebar-left", "0px");
      delete root.dataset.sidebar;
    };
  }, [phone, setLeft]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape" && !e.defaultPrevented) {
      e.preventDefault();
      closeSidebar();
      return;
    }
    // Phones: a full-screen dialog keeps Tab inside it.
    if (phone && e.key === "Tab") {
      const items = [...(ref.current?.querySelectorAll<HTMLElement>("button, input, [tabindex='0']") ?? [])].filter((x) => !x.hasAttribute("disabled"));
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const done = () => {
    if (phone) closeSidebar(false);
  };

  return (
    <aside
      ref={ref}
      id={SIDEBAR_ID}
      className={`sidebar${phone ? " sidebar-phone" : ""}`}
      data-testid="sidebar"
      aria-label="Search and browse"
      role={phone ? "dialog" : undefined}
      aria-modal={phone ? true : undefined}
      onKeyDown={onKeyDown}
    >
      <div className="sidebar-head">
        <h2 className="sidebar-title">Search and browse</h2>
        <button type="button" className="icon-button" aria-label="Close search and browse" title="Close" data-testid="sidebar-close" onClick={() => closeSidebar()}>
          <span aria-hidden="true">{phone ? "✕" : "‹"}</span>
        </button>
      </div>
      <Search onChosen={done} tree={<Tree onChosen={done} />} />
    </aside>
  );
}

/** "a", "a and b", "a, b and c". */
const listOf = (xs: readonly string[]): string => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** A hit's layer: a structure's from the index, a group's from its key's prefix (bone groups: the eager layer's). */
function layerOfHit(id: string): LayerId {
  const p = id.slice(0, id.indexOf("."));
  return layerOfId(id) ?? (isLayerId(p) ? p : EAGER_LAYER);
}

/**
 * The search field (combobox) with its results (listbox); the tree shows while
 * the field is empty. One index per layer (M14 plan decision 4): the eager
 * layer's from the moment the sidebar opens, a lazy layer's while that layer
 * isn't Off, every layer's from the first keystroke; results from an index
 * still loading appear when it arrives.
 */
function Search({ onChosen, tree }: { onChosen: () => void; tree: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const layers = useViewer((s) => s.layers);
  const typed = query.trim() !== "";
  const wanted = LAYER_IDS.filter((l) => typed || l === EAGER_LAYER || layers[l] !== "off").join(" ");
  const [loaded, setLoaded] = useState<Partial<Record<LayerId, Searcher>>>({});
  useEffect(() => {
    let live = true;
    for (const l of wanted.split(" ") as LayerId[]) void loadLayerSearch(l).then((s) => live && setLoaded((m) => (m[l] ? m : { ...m, [l]: s })));
    return () => {
      live = false;
    };
  }, [wanted]);
  // Filter chips (M14 plan decision 5): one per system with a loaded index, shown only with two or more.
  // A system's results are its layers' indexes' (a group's index is its tree's layer's).
  const [system, setSystem] = useState<SystemId | null>(null);
  const chips = SYSTEMS.filter((x) => LAYER_IDS.some((l) => loaded[l] && layerDescriptor(l).system === x.id));
  const chosen = chips.length > 1 ? system : null;
  const searcher = useMemo(() => {
    const list = LAYER_IDS.flatMap((l) => (chosen === null || layerDescriptor(l).system === chosen ? (loaded[l] ?? []) : []));
    return list.length === 0 ? null : list.length === 1 ? list[0]! : mergeSearchers(...list);
  }, [loaded, chosen]);
  const loading = LAYER_IDS.filter((l) => !loaded[l]);
  // The ranking's context (decision 1.2): the body region in focus, then the layers that are On or Ghost.
  const reg = useViewer((s) => s.reg);
  const context = useMemo<RankContext>(
    () => ({ inRegion: reg === null ? undefined : (id) => isInRegion(id, reg), visible: (id) => layers[layerOfHit(id)] !== "off" }),
    [reg, layers],
  );
  const hits: SearchHit[] = useMemo(() => (searcher && query.trim() ? searcher(query, 30, context) : []), [searcher, query, context]);
  useEffect(() => setActive(0), [hits]);
  const said = useRef<SystemId | null | undefined>(undefined);
  useEffect(() => {
    if (said.current === undefined || said.current === chosen) return void (said.current = chosen);
    said.current = chosen;
    const n = query.trim() ? ` ${hits.length} ${hits.length === 1 ? "result" : "results"}.` : "";
    const label = SYSTEMS.find((x) => x.id === chosen)?.label;
    useViewer.getState().say(`${label ? `Search limited to ${label}.` : "Search in all systems."}${n}`);
  }, [chosen, hits, query]);
  const searching = query.trim() !== "";
  const current = hits[active];

  useEffect(() => {
    if (current) document.getElementById(optionId(current.id))?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const choose = (hit: SearchHit) => {
    if (hit.group) void isolateGroup(hit.id);
    else void selectAndFrame(hit.id);
    onChosen();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!hits.length) return;
      e.preventDefault();
      const n = hits.length;
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
    } else if (e.key === "Enter") {
      if (!current) return;
      e.preventDefault();
      choose(current);
    } else if (e.key === "Escape" && query !== "") {
      // The first Escape clears the field; the next closes the sidebar.
      e.preventDefault();
      setQuery("");
    }
  };

  const status = !searching
    ? ""
    : !searcher
      ? "Loading the search index…"
      : hits.length === 0 && loading.length > 0
        ? `Searching ${listOf(loading.map((l) => layerLabel(l).toLowerCase()))}…`
        : hits.length === 0
          ? "No matches."
          : `${hits.length} ${hits.length === 1 ? "match" : "matches"}.`;
  return (
    <>
      <div className="search">
        <label htmlFor={SEARCH_ID} className="visually-hidden">
          Search bones, teeth, muscles, ligaments and cartilage
        </label>
        <input
          id={SEARCH_ID}
          type="search"
          className="search-input"
          placeholder="Search the body"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={searching && hits.length > 0}
          aria-controls="search-results"
          aria-activedescendant={searching && current ? optionId(current.id) : undefined}
          aria-describedby="search-status"
          data-testid="search-input"
          value={query}
          onFocus={() => void loadSearch()}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={onKeyDown}
        />
        {chips.length > 1 && (
          <fieldset className="search-chips" data-testid="search-chips">
            <legend className="visually-hidden">Search in</legend>
            {[{ id: null, label: "All" }, ...chips].map((x) => (
              <label key={x.id ?? ""}>
                <input type="radio" name="search-system" checked={chosen === x.id} data-testid={`search-chip-${x.id ?? "all"}`} onChange={() => setSystem(x.id as SystemId | null)} />
                {x.label}
              </label>
            ))}
          </fieldset>
        )}
        <p id="search-status" className="search-status muted" role="status" data-testid="search-status">
          {status}
        </p>
      </div>
      <ul id="search-results" role="listbox" aria-label="Search results" className="search-results" data-testid="search-results" hidden={!searching || hits.length === 0}>
        {hits.map((h, i) => (
          <li
            key={h.id}
            id={optionId(h.id)}
            role="option"
            aria-selected={i === active}
            className="search-result"
            data-id={h.id}
            onPointerMove={() => setActive(i)}
            onClick={() => choose(h)}
          >
            <span className="result-label">{h.label}</span>
            {h.match && <span className="result-match">{h.match}</span>}
            {h.group && <span className="result-match">Group</span>}
            {!(h.drawn ?? hasMesh(h.id)) && <span className="result-match">No 3D model</span>}
          </li>
        ))}
      </ul>
      <div hidden={searching}>{tree}</div>
    </>
  );
}

/** The system of a lazy root's row (`muscles` → musculoskeletal); undefined for any other row. */
const rootSystem = (key: string): string | undefined => TREE_ROOTS.find((t) => t.key === key)?.system;

/** Type-ahead resets after this pause (ms). */
const TYPE_AHEAD_MS = 600;

/**
 * The hierarchy tree (spec §7, §10; plan decision 4): an ARIA tree with roving
 * focus. Leaves select (as a click on the bone does); groups open and close,
 * and "Isolate" (or I) isolates the whole group. The selected object's branch
 * opens and scrolls into view whenever the selection changes.
 */
function Tree({ onChosen }: { onChosen: () => void }) {
  const sel = useViewer((s) => s.sel);
  const grp = useViewer((s) => s.grp);
  const [groupsOpen, setOpen] = useState<ReadonlySet<string>>(() => new Set(TOP_KEYS));
  const [focusKey, setFocusKey] = useState<string>(TOP_KEYS[0] ?? "");
  // The system rows (M14 plan decision 6): open unless collapsed, shared with the Layers panel.
  const collapsed = useViewer((s) => s.collapsedSystems);
  const toggleSystem = useViewer((s) => s.toggleSystem);
  const open = useMemo(
    () => new Set([...groupsOpen, ...TREE_SYSTEMS.filter((t) => !collapsed.has(t.id)).map((t) => systemRowKey(t.id))]),
    [groupsOpen, collapsed],
  );
  // A lazy root's rows arrive with its system's tree chunk (M9 plan decision 11; one per system, M14 decision 6).
  const treeVersion = useSyncExternalStore(subscribeSoftTree, softTreeVersion);
  // treeVersion is a dependency on purpose (the rows read the registered trees).
  const rows = useMemo(() => sidebarRows(open), [open, treeVersion]);
  /** The systems with an open lazy root whose tree hasn't loaded. */
  const loadingSystems = useMemo(
    () => [...new Set(TREE_ROOTS.filter((r) => open.has(r.key) && open.has(systemRowKey(r.system)) && !treeLoaded(r.system)).map((r) => r.system))],
    // treeVersion: `treeLoaded` reads the registered trees.
    [open, treeVersion],
  );
  useEffect(() => {
    for (const system of loadingSystems) void loadTree(system);
  }, [loadingSystems]);
  const moveFocus = useRef(false);
  const typed = useRef({ text: "", at: 0 });

  // Follow the selection (however it changed): open its branch and scroll it into view.
  const target = sel ?? grp;
  useEffect(() => {
    if (target === null) return;
    // A soft structure (M9): its branch is known once its system's tree has loaded; a part opens its muscle too.
    const layer = sel !== null && isSoftId(sel) ? layerOfId(sel) : null;
    const system = layer === null ? EAGER_SYSTEM : layerDescriptor(layer).system;
    if (layer !== null && !treeLoaded(system)) void loadTree(system);
    const parent = sel !== null ? (softEntry(sel)?.parent ?? null) : null;
    const branch = sel !== null ? [...ancestorsOf(sel), ...(parent ? [parent] : [])] : groupAncestors(target);
    if (branch.length === 0 && sel !== null) return;
    setOpen((o) => (branch.every((k) => o.has(k)) ? o : new Set([...o, ...branch])));
    // Its system row opens too (a group's system: its root's, else the eager layer's).
    const own = sel !== null ? system : (treeSystemOf(target) ?? EAGER_SYSTEM);
    if (useViewer.getState().collapsedSystems.has(own)) toggleSystem(own);
    // A tooth-type group isn't in the tree's branches: its row sits under Teeth.
    setFocusKey(target);
  }, [target, sel, treeVersion]);
  useEffect(() => {
    if (target === null) return;
    document.getElementById(rowId(target))?.scrollIntoView({ block: "nearest" });
  }, [target, rows]);

  // Move DOM focus after a keyboard move (not after a selection elsewhere).
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    document.getElementById(rowId(focusKey))?.focus();
  }, [focusKey, rows]);
  // If the focused row is hidden (its group closed), fall back to the first row.
  const tabKey = rows.some((r) => r.key === focusKey) ? focusKey : (rows[0]?.key ?? "");

  const toggle = (key: string) => {
    const system = systemOfRowKey(key);
    if (system !== null) toggleSystem(system);
    else toggleGroup(key);
  };
  const toggleGroup = (key: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const activate = (row: TreeRow) => {
    if (row.kind === "leaf") {
      // A soft structure may need its table loaded first (and turns its layer on), as a panel link does.
      void selectLink(row.key);
      onChosen();
    } else if (row.kind === "type") isolate(row.key);
    else toggle(row.key);
  };
  const isolate = (key: string) => {
    void isolateGroup(key);
    onChosen();
  };
  const focusRow = (key: string) => {
    moveFocus.current = true;
    setFocusKey(key);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const row = rows.find((r) => r.key === tabKey);
    if (!row) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate(row);
      return;
    }
    if ((e.key === "i" || e.key === "I") && (row.kind === "group" || row.kind === "type")) {
      e.preventDefault();
      isolate(row.key);
      return;
    }
    const move = treeKey(rows, open, row.key, e.key);
    if (move.kind !== "none") {
      e.preventDefault();
      if (move.kind === "focus") focusRow(move.key);
      else if (move.kind === "open" || move.kind === "close") toggle(move.key);
      else if (move.kind === "openSiblings") {
        for (const k of move.keys) if (!open.has(k) && systemOfRowKey(k) !== null) toggle(k);
        setOpen((o) => new Set([...o, ...move.keys.filter((k) => systemOfRowKey(k) === null)]));
      }
      return;
    }
    if (e.key.length === 1 && /\S/.test(e.key)) {
      e.preventDefault();
      const now = e.timeStamp;
      const t = typed.current;
      const text = now - t.at < TYPE_AHEAD_MS ? t.text + e.key : e.key;
      typed.current = { text, at: now };
      const repeat = text.length > 1 && [...text].every((c) => c === text[0]);
      const hit = repeat ? typeAhead(rows, row.key, text[0]!) : typeAhead(rows, row.key, text, text.length > 1);
      if (hit) focusRow(hit);
    }
  };

  return (
    <>
      <ul role="tree" aria-label="Body" aria-describedby="tree-help" className="tree" data-testid="tree" onKeyDown={onKeyDown}>
        {rows.map((r) => {
          const selected = r.key === sel || (sel === null && r.key === grp);
          return (
            <li
              key={r.key}
              id={rowId(r.key)}
              role="treeitem"
              aria-level={r.level}
              aria-posinset={r.pos}
              aria-setsize={r.size}
              aria-expanded={openable(r) ? open.has(r.key) : undefined}
              aria-busy={open.has(r.key) && loadingSystems.some((sys) => sys === rootSystem(r.key)) ? true : undefined}
              aria-selected={selected}
              tabIndex={r.key === tabKey ? 0 : -1}
              className={`tree-row tree-${r.kind}`}
              data-key={r.key}
              style={{ paddingLeft: 4 + (r.level - 1) * 16 }}
              onClick={(e) => {
                e.stopPropagation();
                setFocusKey(r.key);
                activate(r);
              }}
            >
              {(r.kind === "group" || r.kind === "system") && (
                <span className="tree-chevron" aria-hidden="true">
                  {open.has(r.key) ? "▾" : "▸"}
                </span>
              )}
              {r.expandable && (
                // A muscle with parts: the row selects the muscle; the chevron opens its parts (keyboard: arrows).
                <span
                  className="tree-chevron tree-chevron-toggle"
                  aria-hidden="true"
                  data-testid={`expand-${r.key}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFocusKey(r.key);
                    toggle(r.key);
                  }}
                >
                  {open.has(r.key) ? "▾" : "▸"}
                </span>
              )}
              <span className="tree-label">
                {r.label}
                {(r.kind === "group" || r.kind === "type") && r.count !== null && <span className="tree-count"> ({r.count})</span>}
                {r.kind === "leaf" && !(r.drawn ?? hasMesh(r.key)) && <span className="tree-count"> · no 3D model</span>}
              </span>
              {(r.kind === "group" || r.kind === "type") && (
                <button
                  type="button"
                  tabIndex={-1}
                  className="tree-isolate"
                  aria-label={`Isolate ${groupOf(r.key)?.name ?? r.label}`}
                  title="Isolate this group"
                  data-testid={`isolate-${r.key}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFocusKey(r.key);
                    isolate(r.key);
                  }}
                >
                  Isolate
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p id="tree-help" className="tree-help muted">
        Arrow keys move (Right opens a group or a muscle's parts); Enter opens a group or selects; I isolates a group; / searches.
      </p>
    </>
  );
}
