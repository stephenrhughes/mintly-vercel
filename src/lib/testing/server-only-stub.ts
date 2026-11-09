// Vitest runs outside React Server Components, where importing "server-only"
// throws. vitest.config.mts points the import here so server modules can be
// unit-tested; the real guard still applies in the Next.js build.
export {};
