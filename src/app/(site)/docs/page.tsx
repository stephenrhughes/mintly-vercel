import type { Metadata } from "next";

import { ApiDocsPage } from "@/components/site/docs/api-docs-page";
import { BANK_CHECKER_SPEC } from "@/lib/docs/specs";
import { routeMetadata } from "@/lib/marketing/metadata";

import swagger from "../../../../public/assets/swagger.json";

export const metadata: Metadata = routeMetadata("/docs");

export default function DocsPage() {
  return <ApiDocsPage spec={BANK_CHECKER_SPEC} document={swagger} />;
}
