// Terms and privacy versions (LEGAL-01). Sign-up stores the versions the
// user accepted on their profile. When either document changes, update its
// version here and announce the change by email; users aren't asked to
// accept again in the app.

import { siteConfig } from "@/lib/site";

export const legalDocuments = {
  terms: { version: "2025-01", url: `${siteConfig.canonicalUrl}/terms` },
  privacy: { version: "2025-01", url: `${siteConfig.canonicalUrl}/privacy` },
} as const;
