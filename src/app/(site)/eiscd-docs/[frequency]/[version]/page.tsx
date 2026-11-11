import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ApiDocsPage } from "@/components/site/docs/api-docs-page";
import { SpecPicker } from "@/components/site/docs/spec-picker";
import { EISCD_SPECS, findSpec } from "@/lib/docs/specs";
import { routeMetadata } from "@/lib/marketing/metadata";

import { EISCD_DOCUMENTS } from "../../specs";

// The other EISCD references. /eiscd-docs/weekly/v2 redirects to /eiscd-docs.
export function generateStaticParams() {
  return EISCD_SPECS.filter((spec) => spec.path !== "/eiscd-docs").map(
    ({ frequency, version }) => ({
      frequency,
      version,
    }),
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/eiscd-docs/[frequency]/[version]">): Promise<Metadata> {
  const { frequency, version } = await params;
  if (!findSpec(frequency, version)) return {};
  return routeMetadata(`/eiscd-docs/${frequency}/${version}`);
}

export default async function EiscdDocsVariantPage({
  params,
}: PageProps<"/eiscd-docs/[frequency]/[version]">) {
  const { frequency, version } = await params;
  const spec = findSpec(frequency, version);
  if (!spec) notFound();
  return (
    <ApiDocsPage
      spec={spec}
      document={EISCD_DOCUMENTS[spec.slug]}
      toolbar={<SpecPicker current={spec} />}
    />
  );
}
