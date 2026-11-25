// The test registry's authoring half: the real content halves plus the fixture's,
// and (M12 plan decision 14) the registries the graph compiler reads.
import type { LayerContent } from "../../../src/systems/contentTypes";
import type { SystemDescriptor } from "../../../src/systems/types";
import { CONTENT_REGISTRY, SYSTEM_CONTENT, type ContentRegistry } from "../../../src/systems/registry.content";
import { demoContent } from "./demo/content";
import { demo } from "./demo/system";
import { widgetsContent } from "./demo/widgets/content";
import { widgets } from "./demo/widgets/layer";
import { REGISTRY, SYSTEMS } from "./registry";

export const FIXTURE_CONTENT: Readonly<Record<string, LayerContent>> = { ...CONTENT_REGISTRY, widgets: widgetsContent };

/** The whole test registry, as the graph compiler reads it: every system's edge types, the real systems' sources and rules plus the demo's. */
export const FIXTURE_GRAPH_REGISTRY: ContentRegistry = {
  layers: REGISTRY,
  content: FIXTURE_CONTENT,
  systems: [...SYSTEM_CONTENT, demoContent],
  types: (SYSTEMS as readonly SystemDescriptor[]).flatMap((s) => s.edgeTypes ?? []),
};

/** The demo system alone: what the widgets' content chunk is compiled from (its edges name only widgets). */
export const DEMO_GRAPH_REGISTRY: ContentRegistry = { layers: [widgets], content: { widgets: widgetsContent }, systems: [demoContent], types: demo.edgeTypes };
