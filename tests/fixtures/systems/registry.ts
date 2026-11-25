// The test registry (M11 plan decision 8): the real systems and layers, in the
// real order, plus the fixture system `demo` and its layer `widgets`. The
// fixture build (`vite build --mode fixture`) resolves src/systems/registered.ts
// to this file; Vitest swaps it in with `vi.mock`. tests/fixture.test.ts checks
// it is exactly the real list plus the demo.
import { bones } from "../../../src/systems/musculoskeletal/bones/layer";
import { cartilage } from "../../../src/systems/musculoskeletal/cartilage/layer";
import { ligaments } from "../../../src/systems/musculoskeletal/ligaments/layer";
import { muscles } from "../../../src/systems/musculoskeletal/muscles/layer";
import { musculoskeletal } from "../../../src/systems/musculoskeletal/system";
import type { LayerDescriptor, SystemDescriptor } from "../../../src/systems/types";
import { demo } from "./demo/system";
import { widgets } from "./demo/widgets/layer";

export const SYSTEMS = [musculoskeletal, demo] as const satisfies readonly SystemDescriptor[];
export const REGISTRY = [bones, cartilage, ligaments, muscles, widgets] as const satisfies readonly LayerDescriptor[];
