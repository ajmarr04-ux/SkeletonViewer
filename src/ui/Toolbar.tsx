import { PRESETS, type Preset } from "../camera/math";
import { useViewer } from "../state/store";
import { HomeIcon, SettingsIcon, ViewsIcon } from "./icons";
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
 * Settings. Icons only on phones. Later milestones add their buttons here.
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
      <Popover label="Settings" icon={<SettingsIcon />} kind="dialog">
        {() => <Settings />}
      </Popover>
    </nav>
  );
}
