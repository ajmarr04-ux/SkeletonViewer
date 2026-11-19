import { PRESETS, type Preset } from "../camera/math";
import { hasMesh, setGhostMode } from "../state/selection";
import { GHOST_OPACITY, useViewer } from "../state/store";
import { GhostIcon, HomeIcon, OpacityIcon, SettingsIcon, ViewsIcon } from "./icons";
import { Popover } from "./Popover";
import { Settings } from "./Settings";

export const PRESET_LABELS: Record<Preset, string> = {
  anterior: "Anterior (front)",
  posterior: "Posterior (back)",
  left: "Left side",
  right: "Right side",
  superior: "Superior (top)",
  inferior: "Inferior (bottom)",
};

/**
 * Floating toolbar, bottom centre (spec §7): Home, the preset views and
 * Settings, plus the ghost/hide toggle and ghost opacity while a bone is
 * isolated. Icons only on phones. Later milestones add their buttons here.
 */
export function Toolbar() {
  const requestCamera = useViewer((s) => s.requestCamera);
  return (
    <nav className="toolbar" aria-label="View controls">
      <button type="button" className="tool" aria-label="Home view" title="Home view (H)" onClick={() => requestCamera({ kind: "reset" })}>
        <HomeIcon />
        <span className="tool-label">Home</span>
      </button>
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
      <IsolationTools />
      <Popover label="Settings" icon={<SettingsIcon />} kind="dialog">
        {() => <Settings />}
      </Popover>
    </nav>
  );
}

/** Ghost / hide toggle and the ghost-opacity slider (spec §6), shown only while something is isolated. */
function IsolationTools() {
  const isolated = useViewer((s) => s.sel !== null && hasMesh(s.sel));
  const ghostMode = useViewer((s) => s.ghostMode);
  const opacity = useViewer((s) => s.ghostOpacity);
  const setOpacity = useViewer((s) => s.setGhostOpacity);
  if (!isolated) return null;
  const ghosts = ghostMode === "ghost";
  return (
    <>
      <button
        type="button"
        className="tool"
        aria-pressed={ghosts}
        data-testid="ghost-toggle"
        title={ghosts ? "Other bones are ghosted: press to hide them" : "Other bones are hidden: press to show them as ghosts"}
        onClick={() => setGhostMode(ghosts ? "hide" : "ghost")}
      >
        <GhostIcon />
        <span className="tool-label">Ghosts</span>
      </button>
      {ghosts && (
        <Popover label="Ghost opacity" icon={<OpacityIcon />} kind="dialog">
          {() => (
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
          )}
        </Popover>
      )}
    </>
  );
}
