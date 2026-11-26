// Which registry a model script reads (M13): the real one, or with
// SKV_REGISTRY=fixture the test registry (the fixture layer's chunks are made
// by the same scripts as a real layer's, plan decision 11).
import type { RegistryOption } from "./index-plugin";

/** undefined = the real registry (the functions' default). */
export async function registryOption(): Promise<RegistryOption | undefined> {
  if (process.env.SKV_REGISTRY === "fixture") return (await import("../../tests/fixtures/systems/option")).fixtureRegistry;
  if (process.env.SKV_REGISTRY) throw new Error(`SKV_REGISTRY=${process.env.SKV_REGISTRY}: only "fixture" is known`);
  return undefined;
}
