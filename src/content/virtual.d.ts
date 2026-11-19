declare module "virtual:skeleton-content" {
  const content: import("./compile").CompiledContent;
  export default content;
}
declare module "virtual:skeleton-search" {
  const data: import("./search").SearchData;
  export default data;
}
