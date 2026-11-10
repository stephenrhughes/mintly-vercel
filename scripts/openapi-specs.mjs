// The OpenAPI specs in public/assets, by basename. The YAML is the
// hand-edited source; scripts/sync-openapi.mjs writes the JSON from it.
// src/lib/docs/specs.test.ts checks this list matches the docs pages.
export const OPENAPI_SPECS = [
  "swagger",
  "eiscd-openapi-weekly-v2",
  "eiscd-openapi",
  "eiscd-openapi-monthly-v2",
];
