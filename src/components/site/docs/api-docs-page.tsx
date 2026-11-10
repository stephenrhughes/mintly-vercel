import { ApiReference } from "@/components/site/docs/api-reference";
import { RedocFallback } from "@/components/site/docs/redoc-fallback";
import { JsonLd } from "@/components/site/json-ld";
import { summariseSpec } from "@/lib/docs/openapi-summary";
import { type SpecInfo, specUrls } from "@/lib/docs/specs";
import { apiReferenceJsonLd } from "@/lib/marketing/json-ld";
import { pageInfo, siteRoute } from "@/lib/marketing/routes";

/** A ReDoc reference page for one spec, with its server-rendered summary. */
export function ApiDocsPage({ spec, document, toolbar }: { spec: SpecInfo; document: object; toolbar?: React.ReactNode }) {
  const summary = summariseSpec(document as Parameters<typeof summariseSpec>[0]);
  const { specUrl, specJsonUrl } = specUrls(spec.slug);
  const route = siteRoute(spec.path);
  return (
    <>
      <JsonLd
        data={apiReferenceJsonLd(pageInfo(spec.path, route.title, spec.published), {
          name: spec.jsonLdName,
          version: summary.version,
          abstract: spec.abstract,
          aboutId: spec.aboutId,
        })}
      />
      {toolbar}
      <ApiReference
        key={specUrl}
        specUrl={specUrl}
        specJsonUrl={specJsonUrl}
        skillHref={`/assets/${spec.skill}-skill.zip`}
        skillName={spec.skill}
      >
        <RedocFallback summary={summary} specUrl={specUrl} specJsonUrl={specJsonUrl} />
      </ApiReference>
    </>
  );
}
