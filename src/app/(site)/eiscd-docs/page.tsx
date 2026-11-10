import type { Metadata } from "next";

import { ApiDocsPage } from "@/components/site/docs/api-docs-page";
import { SpecPicker } from "@/components/site/docs/spec-picker";
import { DEFAULT_FREQUENCY, DEFAULT_VERSION, findSpec } from "@/lib/docs/specs";
import { routeMetadata } from "@/lib/marketing/metadata";

import { EISCD_DOCUMENTS } from "./specs";

export const metadata: Metadata = routeMetadata("/eiscd-docs");

// Weekly v2, the default, lives here so the URL everything links to is canonical.
export default function EiscdDocsPage() {
  const spec = findSpec(DEFAULT_FREQUENCY, DEFAULT_VERSION)!;
  return (
    <ApiDocsPage
      spec={spec}
      document={EISCD_DOCUMENTS[spec.slug]}
      toolbar={<SpecPicker current={spec} />}
    />
  );
}
