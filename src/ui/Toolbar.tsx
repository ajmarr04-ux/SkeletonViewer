import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { PRESETS, type Preset } from "../camera/math";
import { explodeMovers } from "../scene/Explode";
import { isolationView } from "../scene/isolation";
import { expandRegion, hasMesh, setColourMode, setGhostMode, showRelated } from "../state/selection";
import { GHOST_OPACITY, useViewer } from "../state/store";
import { takeScreenshot } from "./capture";
import { ExplodeSlider } from "./ExplodeSlider";
import {
  CameraIcon,
  ColourIcon,
  ExplodeIcon,
  GhostIcon,
  HomeIcon,
  LabelsIcon,
  MoreIcon,
  OpacityIcon,
  RegionIcon,
  RelatedIcon,
  SearchIcon,
  SettingsIcon,
  ShareIcon,
  ViewsIcon,
} from "./icons";
import { Popover } from "./Popover";
import { Settings } from "./Settings";
import { shareView } from "./share";
import { closeSidebar, openSearch, SIDEBAR_ID } from "./Sidebar";
import { chooseToolbarFit, type ToolbarFit, type ToolItem } from "./toolbarFit";

export const PRESET_LABELS: Record<Preset, string> = {
  anterior: "Anterior (front)",
  posterior: "Posterior (back)",
  left: "Left side",
  right: "Right side",
  superior: "Superior (top)",
  inferior: "Inferior (bottom)",
};

let measureCtx: CanvasRenderingContext2D | null | undefined;
function measureLabel(text: string): number {
  if (measureCtx === undefined) {
    measureCtx = document.createElement("canvas").getContext("2d");
    if (measureCtx) measureCtx.font = `14px ${getComputedStyle(document.documentElement).fontFamily || "system-ui"}`;
  }
  return measureCtx ? measureCtx.measureText(text).width : text.length * 8;
}

function useWindowWidth(): number {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

/** One toolbar entry: how it looks in the bar and, for overflow items, inside "More". */
type Tool = ToolItem & { key: string; bar: ReactNode; more?: (close: () => void) => ReactNode };

/**
 * Floating toolbar, bottom centre (spec §7). Search, Home, Views, the isolation
 * button (Related / Region) and Ghosts always stay in the bar; Ghost opacity,
 * Explode, Labels, Colour by region, Screenshot, Share and Settings move into a
 * "More" menu when the bar wouldn't fit (always on phones, plan decision 12).
 * With room to spare the buttons show their labels; else icons only.
 */
export function Toolbar() {
  const requestCamera = useViewer((s) => s.requestCamera);
  const sidebarOpen = useViewer((s) => s.sidebarOpen);
  const sel = useViewer((s) => s.sel);
  const tier = useViewer((s) => s.tier);
  const isolated = useViewer((s) => isolationView(s.sel, s.tier, "ghost", hasMesh, s.grp).isolated);
  const ghostMode = useViewer((s) => s.ghostMode);
  const labelsOn = useViewer((s) => s.labelsOn);
  const colourOn = useViewer((s) => s.colourMode === "region");
  const panelRight = useViewer((s) => s.panelInset.right);
  const sidebarLeft = useViewer((s) => s.sidebarLeft);
  const width = useWindowWidth();
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  const ghosts = ghostMode === "ghost";
  const tools: Tool[] = [
    {
      key: "search",
      label: "Search",
      overflow: false,
      bar: (
        <button
          type="button"
          id="sidebar-toggle"
          className="tool"
          aria-label="Search and browse"
          aria-expanded={sidebarOpen}
          aria-controls={sidebarOpen ? SIDEBAR_ID : undefined}
          title="Search and browse (/)"
          data-testid="sidebar-toggle"
          onClick={() => (sidebarOpen ? closeSidebar(false) : openSearch())}
        >
          <SearchIcon />
          <span className="tool-label">Search</span>
        </button>
      ),
    },
    {
      key: "home",
      label: "Home",
      overflow: false,
      bar: (
        <button type="button" className="tool" aria-label="Home view" title="Home view (H)" onClick={() => requestCamera({ kind: "reset" })}>
          <HomeIcon />
          <span className="tool-label">Home</span>
        </button>
      ),
    },
    {
      key: "views",
      label: "Views",
      overflow: false,
      bar: (
        <Popover label="Views" icon={<ViewsIcon />} kind="menu">
          {(close) =>
            PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="menu-item"
                data-preset={p}
                onClick={() => {
                  requestCamera({ kind: "preset", preset: p });
                  close();
                }}
              >
                {PRESET_LABELS[p]}
              </button>
            ))
          }
        </Popover>
      ),
    },
  ];
  // Show related / Expand region (spec §7 toolbar: one button, the next tier). A group has no tiers.
  if (sel !== null && tier === 0) {
    tools.push({
      key: "related",
      label: "Related",
      overflow: false,
      bar: (
        <button type="button" className="tool" aria-label="Related" data-testid="tool-related" title="Show related bones" onClick={showRelated}>
          <RelatedIcon />
          <span className="tool-label">Related</span>
        </button>
      ),
    });
  }
  if (sel !== null && tier === 1) {
    tools.push({
      key: "region",
      label: "Region",
      overflow: false,
      bar: (
        <button type="button" className="tool" aria-label="Region" data-testid="tool-region" title="Expand to the region" onClick={expandRegion}>
          <RegionIcon />
          <span className="tool-label">Region</span>
        </button>
      ),
    });
  }
  // The ghost / hide toggle and the ghost-opacity slider (spec §6), while something is isolated.
  if (isolated) {
    tools.push({
      key: "ghosts",
      label: "Ghosts",
      overflow: false,
      bar: (
        <button
          type="button"
          className="tool"
          aria-pressed={ghosts}
          aria-label="Ghosts"
          data-testid="ghost-toggle"
          title={ghosts ? "Other bones are ghosted: press to hide them" : "Other bones are hidden: press to show them as ghosts"}
          onClick={() => setGhostMode(ghosts ? "hide" : "ghost")}
        >
          <GhostIcon />
          <span className="tool-label">Ghosts</span>
        </button>
      ),
    });
    if (ghosts) {
      tools.push({
        key: "opacity",
        label: "Ghost opacity",
        overflow: true,
        bar: (
          <Popover label="Ghost opacity" icon={<OpacityIcon />} kind="dialog">
            {() => <GhostOpacity />}
          </Popover>
        ),
        more: () => <GhostOpacity />,
      });
    }
  }
  // Explode at tiers 1 and 2 (plan step 8).
  if (isolated && sel !== null && explodeMovers(sel, tier) !== null) {
    tools.push({
      key: "explode",
      label: "Explode",
      overflow: true,
      bar: (
        <Popover label="Explode" icon={<ExplodeIcon />} kind="dialog">
          {() => <ExplodeSlider />}
        </Popover>
      ),
      more: () => <ExplodeSlider />,
    });
  }
  const labelsButton = (inMore: boolean) => (
    <button
      type="button"
      className={inMore ? "menu-item more-item" : "tool"}
      aria-pressed={labelsOn}
      aria-label="Labels"
      data-testid="labels-toggle"
      title={labelsOn ? "Labels are on: press to hide them" : "Show labels"}
      onClick={() => useViewer.getState().setLabelsOn(!labelsOn)}
    >
      <LabelsIcon />
      <span className={inMore ? undefined : "tool-label"}>Labels</span>
    </button>
  );
  const colourButton = (inMore: boolean) => (
    <button
      type="button"
      className={inMore ? "menu-item more-item" : "tool"}
      aria-pressed={colourOn}
      aria-label="Colour by region"
      data-testid="colour-toggle"
      title={colourOn ? "Colour by region is on: press for plain bone" : "Colour by region"}
      onClick={() => setColourMode(colourOn ? "bone" : "region")}
    >
      <ColourIcon />
      <span className={inMore ? undefined : "tool-label"}>{inMore ? "Colour by region" : "Colour"}</span>
    </button>
  );
  const actionButton = (inMore: boolean, close: () => void, key: "screenshot" | "share") => (
    <button
      type="button"
      className={inMore ? "menu-item more-item" : "tool"}
      data-testid={key}
      aria-label={key === "screenshot" ? "Screenshot" : "Share"}
      title={key === "screenshot" ? "Save a screenshot (PNG)" : "Share a link to this view"}
      onClick={() => {
        close();
        if (key === "screenshot") void takeScreenshot();
        else void shareView(setManualUrl);
      }}
    >
      {key === "screenshot" ? <CameraIcon /> : <ShareIcon />}
      <span className={inMore ? undefined : "tool-label"}>{key === "screenshot" ? "Screenshot" : "Share"}</span>
    </button>
  );
  const none = () => {};
  tools.push(
    { key: "labels", label: "Labels", overflow: true, bar: labelsButton(false), more: () => labelsButton(true) },
    { key: "colour", label: "Colour", overflow: true, bar: colourButton(false), more: () => colourButton(true) },
    { key: "screenshot", label: "Screenshot", overflow: true, bar: actionButton(false, none, "screenshot"), more: (c) => actionButton(true, c, "screenshot") },
    { key: "share", label: "Share", overflow: true, bar: actionButton(false, none, "share"), more: (c) => actionButton(true, c, "share") },
    {
      key: "settings",
      label: "Settings",
      overflow: true,
      bar: (
        <Popover label="Settings" icon={<SettingsIcon />} kind="dialog">
          {() => <Settings />}
        </Popover>
      ),
      more: () => <Settings />,
    },
  );

  const available = width - sidebarLeft - panelRight;
  const fit: ToolbarFit = chooseToolbarFit(tools, available, width, measureLabel);
  const inBar = fit === "more" ? tools.filter((t) => !t.overflow) : tools;
  const inMore = fit === "more" ? tools.filter((t) => t.overflow) : [];

  return (
    <>
      <nav className="toolbar" aria-label="View controls" data-fit={fit}>
        {inBar.map((t) => (
          <Fragment key={t.key}>{t.bar}</Fragment>
        ))}
        {inMore.length > 0 && (
          <Popover label="More" icon={<MoreIcon />} kind="dialog">
            {(close) => (
              <div className="more-menu">
                {inMore.map((t) => (
                  <div key={t.key} className="more-section" data-tool={t.key}>
                    {t.more?.(close)}
                  </div>
                ))}
              </div>
            )}
          </Popover>
        )}
      </nav>
      {manualUrl !== null && <ManualShare url={manualUrl} onClose={() => setManualUrl(null)} />}
    </>
  );
}

function GhostOpacity() {
  const opacity = useViewer((s) => s.ghostOpacity);
  const setOpacity = useViewer((s) => s.setGhostOpacity);
  return (
    <div className="ghost-opacity">
      <label htmlFor="ghost-opacity">Ghost opacity</label>
      <input
        id="ghost-opacity"
        type="range"
        data-testid="ghost-opacity"
        min={GHOST_OPACITY.min}
        max={GHOST_OPACITY.max}
        step={0.01}
        value={opacity}
        onChange={(e) => setOpacity(Number(e.currentTarget.value))}
      />
      <output htmlFor="ghost-opacity">{Math.round(opacity * 100)}%</output>
    </div>
  );
}

/** Share's last resort (plan decision 10): the link in a read-only field, selected, to copy by hand. */
function ManualShare({ url, onClose }: { url: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    input.current?.select();
  }, []);
  return (
    <dialog ref={dialog} className="manual-share" aria-labelledby="manual-share-title" onClose={onClose}>
      <h2 id="manual-share-title">Copy this link</h2>
      <label htmlFor="manual-share-url" className="visually-hidden">
        Link to this view
      </label>
      <input id="manual-share-url" ref={input} readOnly value={url} data-testid="share-url" onFocus={(e) => e.currentTarget.select()} />
      <form method="dialog">
        <button type="submit" className="button">
          Close
        </button>
      </form>
    </dialog>
  );
}
