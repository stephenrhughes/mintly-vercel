import type { MDXComponents } from "mdx/types";

import { mdxComponents } from "@/components/site/mdx";

// Required by @next/mdx in the App Router: maps Markdown elements in the
// articles, guides, release notes and legal pages to site components.
export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  return { ...mdxComponents, ...components };
}
