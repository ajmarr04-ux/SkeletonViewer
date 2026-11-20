declare module "virtual:skeleton-content" {
  const content: import("./compile").CompiledContent;
  export default content;
}
declare module "virtual:skeleton-search" {
  const data: import("./search").SearchData;
  export default data;
}
declare module "virtual:skeleton-attribution" {
  const html: string;
  export default html;
}
declare module "virtual:skeleton-model-versions" {
  /** File stem (`muscles-high`) → content hash (scripts/lib/model-versions-plugin.ts). */
  const versions: Record<string, string>;
  export default versions;
  /** File stem → size in bytes. */
  export const sizes: Record<string, number>;
}
declare module "virtual:skeleton-soft-ids" {
  /** content/soft-ids.json, trimmed (scripts/lib/soft-ids-plugin.ts). */
  const table: import("../layers/softIds").SoftId[];
  export default table;
}
declare module "virtual:skeleton-soft-content-muscles" {
  /** content/muscles/*.md compiled (src/content/softCompile.ts; M8 plan decision 11). */
  const content: import("./softCompile").SoftLayerContent;
  export default content;
}
declare module "virtual:skeleton-soft-content-ligaments" {
  /** content/ligaments/*.md compiled (src/content/softCompile.ts; M8 plan decision 11). */
  const content: import("./softCompile").SoftLayerContent;
  export default content;
}
declare module "virtual:skeleton-soft-content-cartilage" {
  /** content/cartilage/*.md compiled (src/content/softCompile.ts; M8 plan decision 11). */
  const content: import("./softCompile").SoftLayerContent;
  export default content;
}
