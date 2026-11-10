// Each MDX file in src/content exports its facts alongside the content.
declare module "*.mdx" {
  export const metadata: import("@/content/articles").ContentMeta;
}
