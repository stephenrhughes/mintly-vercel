import { type JsonLd as JsonLdData, serialiseJsonLd } from "@/lib/marketing/json-ld";

/** Structured data for a page (WEB-02), as the Next.js JSON-LD guide shows. */
export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialiseJsonLd(data) }}
    />
  );
}
