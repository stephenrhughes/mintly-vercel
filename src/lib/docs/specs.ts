// The API references on the sales site (DOC-01, DOC-02), ported from
// mintly-web src/utils/eiscdSpecs.js. Each spec's YAML in public/assets is
// the hand-edited source; scripts/sync-openapi.mjs generates the JSON.

export type SpecInfo = {
  slug: string;
  path: string;
  pageTitle: string;
  jsonLdName: string;
  abstract: string;
  published: string;
  aboutId: string;
  skill: "mintly-api" | "eiscd-api";
};

export const BANK_CHECKER_SPEC: SpecInfo = {
  slug: "swagger",
  path: "/docs",
  pageTitle: "Bank Account Checker API Documentation",
  jsonLdName: "Mintly Bank Account Checker API",
  abstract:
    "REST API reference for validating UK sort codes, bank account numbers, IBANs and SWIFT/BIC codes.",
  published: "2022-10-05",
  aboutId: "https://www.mintly.uk/#application",
  skill: "mintly-api",
};

export const FREQUENCIES = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
] as const;
export const VERSIONS = [
  { id: "v2", label: "V2" },
  { id: "v1", label: "V1" },
] as const;
export type Frequency = (typeof FREQUENCIES)[number]["id"];
export type Version = (typeof VERSIONS)[number]["id"];

export type EiscdSpec = SpecInfo & { frequency: Frequency; version: Version };

export const DEFAULT_FREQUENCY: Frequency = "weekly";
export const DEFAULT_VERSION: Version = "v2";

const eiscd = (spec: Omit<EiscdSpec, "aboutId" | "skill" | "path">): EiscdSpec => ({
  ...spec,
  aboutId: "https://www.mintly.uk/#eiscd",
  skill: "eiscd-api",
  path: docsPathFor(spec.frequency, spec.version),
});

/** The default combination is /eiscd-docs itself, so the URL everything links to stays canonical. */
export function docsPathFor(frequency: Frequency, version: Version): string {
  return frequency === DEFAULT_FREQUENCY && version === DEFAULT_VERSION
    ? "/eiscd-docs"
    : `/eiscd-docs/${frequency}/${version}`;
}

export const EISCD_SPECS: EiscdSpec[] = [
  eiscd({
    frequency: "weekly",
    version: "v2",
    slug: "eiscd-openapi-weekly-v2",
    pageTitle: "EISCD API Documentation",
    jsonLdName: "Mintly EISCD API",
    abstract:
      "REST API reference for downloading the Extended Industry Sort Code Directory and its weekly delta files.",
    published: "2025-11-27",
  }),
  eiscd({
    frequency: "weekly",
    version: "v1",
    // Kept as the bare name: it's a published download URL customers fetch.
    slug: "eiscd-openapi",
    pageTitle: "EISCD API Documentation (v1)",
    jsonLdName: "Mintly EISCD API v1",
    abstract:
      "REST API reference for version 1 of the Mintly EISCD API, which returns XML error bodies with a 200 status.",
    published: "2025-11-27",
  }),
  eiscd({
    frequency: "monthly",
    version: "v2",
    slug: "eiscd-openapi-monthly-v2",
    pageTitle: "EISCD API Documentation (Monthly)",
    jsonLdName: "Mintly EISCD API (Monthly)",
    abstract:
      "REST API reference for downloading the Extended Industry Sort Code Directory on a monthly plan.",
    published: "2026-09-08",
  }),
];

export function findSpec(frequency: string, version: string): EiscdSpec | undefined {
  return EISCD_SPECS.find((spec) => spec.frequency === frequency && spec.version === version);
}

/** Changing frequency falls back to that frequency's newest documented version. */
export function resolveCombo(frequency: Frequency, version: Version): EiscdSpec | undefined {
  return findSpec(frequency, version) ?? VERSIONS.map(({ id }) => findSpec(frequency, id)).find(Boolean);
}

export const specUrls = (slug: string) => ({
  specUrl: `/assets/${slug}.yaml`,
  specJsonUrl: `/assets/${slug}.json`,
});
