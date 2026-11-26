// The test registry as the Node side reads it (M11 plan decision 8): the index
// plugin's option, and (M13) the scripts' with SKV_REGISTRY=fixture
// (scripts/lib/registry-option.ts). Kept apart from ./vite.ts so the scripts
// don't load Vite's plugins.
import type { RegistryOption } from "../../../scripts/lib/index-plugin";
import { WIDGETS_MEMBERSHIP } from "./demo/widgets/membership";
import { FIXTURE_CONTENT } from "./registry.content";
import { REGISTRY } from "./registry";

const WIDGETS_DIR = "tests/fixtures/systems/demo/widgets/models";
export const fixtureRegistry: RegistryOption = {
  layers: REGISTRY,
  content: FIXTURE_CONTENT,
  extraMembership: [WIDGETS_MEMBERSHIP],
  modelFiles: { widgets: { dir: WIDGETS_DIR, manifest: `${WIDGETS_DIR}/manifest.json` } },
};
