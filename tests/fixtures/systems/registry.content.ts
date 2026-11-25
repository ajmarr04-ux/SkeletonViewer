// The test registry's authoring half: the real content halves plus the fixture's.
import type { LayerContent } from "../../../src/systems/contentTypes";
import { CONTENT_REGISTRY } from "../../../src/systems/registry.content";
import { widgetsContent } from "./demo/widgets/content";

export const FIXTURE_CONTENT: Readonly<Record<string, LayerContent>> = { ...CONTENT_REGISTRY, widgets: widgetsContent };
