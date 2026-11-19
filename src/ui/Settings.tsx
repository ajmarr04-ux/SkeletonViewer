import { LOD_SETTING_KEY, type LodSetting } from "../scene/lod";
import { useViewer } from "../state/store";

const OPTIONS: { value: LodSetting; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "chosen for this device" },
  { value: "low", label: "Low", hint: "about 150k triangles" },
  { value: "high", label: "High", hint: "about 500k triangles" },
];

function store(setting: LodSetting): void {
  try {
    if (setting === "auto") window.localStorage.removeItem(LOD_SETTING_KEY);
    else window.localStorage.setItem(LOD_SETTING_KEY, setting);
  } catch {
    // Private mode or storage disabled: the choice lasts for this page only.
  }
}

/** Settings panel: model detail (kept in localStorage) and the LOD on screen. */
export function Settings() {
  const setting = useViewer((s) => s.lodSetting);
  const active = useViewer((s) => s.lodActive);
  const setSetting = useViewer((s) => s.setLodSetting);
  return (
    <div className="settings">
      <fieldset>
        <legend>Model detail</legend>
        {OPTIONS.map((o) => (
          <label key={o.value}>
            <input
              type="radio"
              name="lod-setting"
              value={o.value}
              checked={setting === o.value}
              onChange={() => {
                store(o.value);
                setSetting(o.value);
              }}
            />
            {o.label} <span className="muted">({o.hint})</span>
          </label>
        ))}
      </fieldset>
      <p className="muted" data-testid="lod-active" aria-live="polite">
        Showing: {active ? `${active} detail` : "loading…"}
      </p>
    </div>
  );
}
