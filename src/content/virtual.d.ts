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
declare module "virtual:skeleton-index" {
  /** The always-loaded ID index's lazy half: the lazy layers' trimmed entries and the joint nodes, packed (scripts/lib/index-plugin.ts, src/content/indexCodec.ts; M12 plan decision 7). */
  const data: import("./indexCodec").PackedIndex;
  export default data;
}
declare module "virtual:skeleton-graph" {
  /** The eager layer's edges, for the main chunk (scripts/lib/content-plugin.ts, src/graph/codec.ts; M12 plan decision 3). */
  const edges: import("../graph/codec").EdgeWire;
  export default edges;
}
declare module "virtual:skeleton-soft-content-*" {
  /** A lazy layer's content chunk, its descriptor's `contentChunk`: content/<folder>/*.md compiled (src/content/softCompile.ts; M8 plan decision 11). */
  const content: import("./softCompile").SoftLayerContent;
  export default content;
}
declare module "virtual:skeleton-layer-importers" {
  /** Layer → its content chunk's `import()`, generated from the registry (scripts/lib/content-plugin.ts, M11 AV); none for a layer without a `contentChunk`. */
  const importers: Partial<Record<import("../systems/registry").LazyLayerId, () => Promise<{ default: import("./softCompile").SoftLayerContent }>>>;
  export default importers;
}
declare module "virtual:skeleton-soft-tree" {
  /** The sidebar's Muscles, Ligaments and Cartilage roots (src/content/softTree.ts; M9 plan decision 11). */
  const tree: import("./softTree").SoftTreeData;
  export default tree;
}
declare module "virtual:skeleton-search-soft" {
  /** The soft-tissue search index with the group synonyms (src/content/search.ts; M9 plan decision 12). */
  const data: import("./search").SearchData;
  export default data;
}
