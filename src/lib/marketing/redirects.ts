// Permanent redirects for old sales-site URLs (WEB-03), carried over from
// mintly-web next.config.mjs. next.config.ts serves them before proxy.ts
// runs. Old portal URLs (/dashboard, /tools …) are handled separately by
// the app routing in src/lib/hosts.ts (APP-09).

export type SiteRedirect = { source: string; destination: string };

export const siteRedirects: SiteRedirect[] = [
  { source: "/check-bank-account", destination: "/sort-code-checker" },
  { source: "/ApiDocs", destination: "/docs" },
  { source: "/c29ydC1jb2", destination: "/sort-code-checker" },
  { source: "/bank-account-and-sort-code-checker", destination: "/sort-code-checker" },

  // Trailing slashes. Next.js strips these by default too; listing them
  // keeps the parity test honest about every old URL.
  { source: "/sort-code-checker/", destination: "/sort-code-checker" },
  { source: "/release-notes/", destination: "/release-notes" },
  { source: "/docs/", destination: "/docs" },
  { source: "/faq/", destination: "/faq" },
  { source: "/get-started/", destination: "/get-started" },
  { source: "/bank-account-and-sort-code-checker/", destination: "/sort-code-checker" },
  { source: "/about/", destination: "/about" },
  { source: "/eiscd-docs/", destination: "/eiscd-docs" },

  // EISCD reference: one URL per documented spec. The default combination
  // is served from /eiscd-docs itself, and monthly is documented at v2 only.
  { source: "/eiscd-docs/weekly/v2", destination: "/eiscd-docs" },
  { source: "/eiscd-docs/monthly/v1", destination: "/eiscd-docs/monthly/v2" },

  // Articles
  { source: "/auddis", destination: "/articles/auddis" },
  { source: "/automation", destination: "/articles/automation" },
  { source: "/bacs-and-direct-debit", destination: "/articles/bacs-and-direct-debit" },
  { source: "/bank-validation-api", destination: "/articles/bank-validation-api" },
  { source: "/gdpr-and-security", destination: "/articles/gdpr-and-security" },
  { source: "/modulus-checking", destination: "/articles/modulus-checking" },
  { source: "/reasons", destination: "/articles/reasons" },
  { source: "/sortcodes", destination: "/articles/sortcodes" },
  { source: "/swift-iban", destination: "/articles/swift-iban" },
  { source: "/what-is-eiscd", destination: "/articles/eiscd-data-file" },
  { source: "/articles/what-is-eiscd", destination: "/articles/eiscd-data-file" },

  // Integration guides
  { source: "/mcp-server-python", destination: "/integration-guides/mcp-server-python" },
  { source: "/nodejs-integration", destination: "/integration-guides/nodejs-integration" },
  {
    source: "/power-automate-integration",
    destination: "/integration-guides/power-automate-integration",
  },
  { source: "/python-integration", destination: "/integration-guides/python-integration" },
  { source: "/salesforce-integration", destination: "/integration-guides/salesforce-integration" },
  { source: "/zapier-integration", destination: "/integration-guides/zapier-integration" },
];
