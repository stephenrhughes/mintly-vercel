import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { NewTrialInput, ReviewOps } from "@/lib/billing/provision";

import { dnsSignals } from "./dns-signals";
import { companyMatchesDomain, decideReview, normaliseDomain } from "./rules";

// Decides whether a new trial organisation is reviewed (plan §6.11), and
// collects the signals the review queue shows (APPR-04). The keys stored in
// signup_signals are read by src/lib/review/queries.ts.

export type SignupSignals = {
  email: string;
  domain: string | null;
  company_name: string | null;
  company_matches_domain: boolean | null;
  phone: string | null;
  price_id: string;
  tier: string | null;
  interval: string | null;
  trialing: boolean;
  ip_hash: string | null;
  country: string | null;
  mx: boolean | null;
  website: boolean | null;
  decision: string;
  approved_org_id?: string;
  collected_at: string;
};

export function createReviewOps(db: SupabaseClient): ReviewOps {
  return {
    async decide(input: NewTrialInput) {
      const domain = normaliseDomain(input.ownerEmail.split("@").pop());

      const [trusted, approvedOrg, dns] = await Promise.all([
        domain
          ? db.from("trusted_domains").select("domain").eq("domain", domain).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        domain
          ? db.rpc("approved_org_for_domain", { p_domain: domain })
          : Promise.resolve({ data: null, error: null }),
        domain ? dnsSignals(domain) : Promise.resolve({ mx: null, website: null }),
      ]);
      if (trusted.error)
        throw new Error(`reading trusted domains failed: ${trusted.error.message}`);
      if (approvedOrg.error) {
        throw new Error(`checking approved organisations failed: ${approvedOrg.error.message}`);
      }

      const decision = decideReview({
        trustedDomain: Boolean(trusted.data),
        approvedOrgDomain: Boolean(approvedOrg.data),
        // SSO tenants (sso_domains) arrive with phase 4.
        ssoDomain: false,
      });

      const signals: SignupSignals = {
        email: input.ownerEmail.toLowerCase(),
        domain,
        company_name: input.companyName,
        company_matches_domain: domain ? companyMatchesDomain(input.companyName, domain) : null,
        phone: input.phone,
        price_id: input.stripePriceId,
        tier: input.tier,
        interval: input.interval,
        trialing: input.trialing,
        ip_hash: input.metadata.signup_ip_hash ?? null,
        country: input.metadata.signup_country ?? null,
        mx: dns.mx,
        website: dns.website,
        decision: decision.reason,
        ...(typeof approvedOrg.data === "string" ? { approved_org_id: approvedOrg.data } : {}),
        collected_at: new Date().toISOString(),
      };
      return { status: decision.status, signals };
    },
  };
}
