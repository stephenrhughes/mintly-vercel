import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Code } from "@/components/admin/ui";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listSsoDomains, organisationOptions } from "@/lib/admin/server";
import { supabaseProjectRef } from "@/lib/admin/sso";
import { requireAdmin } from "@/lib/auth/session";
import { longDate } from "@/lib/billing/format";
import { appPath } from "@/lib/hosts";
import { roleLabels } from "@/lib/nav";

import { RemoveSsoForm, SsoForm } from "./sso-forms";

export const metadata: Metadata = { title: "SSO" };

const title = "SSO";

export default function SsoPage() {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <Sso />
    </Suspense>
  );
}

// SSO tenants (plan §6.1, §6.8, SSO-05, SSO-07): which domain signs in
// through which identity provider and joins which organisation.
async function Sso() {
  await requireAdmin("/admin/sso");
  const [domains, orgs] = await Promise.all([listSsoDomains(), organisationOptions()]);
  const ref = supabaseProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? "<project-ref>";

  return (
    <div className="grid gap-8">
      <PageHeader
        title={title}
        description="Users from these domains sign in through their company's identity provider and join the organisation on their first sign-in."
      />

      <Card>
        <CardHeader>
          <CardTitle>Setting up a tenant</CardTitle>
          <CardDescription>
            The identity provider is registered with the Supabase CLI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid list-decimal gap-3 pl-5 text-sm">
            <li>
              Give the customer&apos;s IT team these SAML settings: ACS URL{" "}
              <Code>{`https://${ref}.supabase.co/auth/v1/sso/saml/acs`}</Code> and entity ID{" "}
              <Code>{`https://${ref}.supabase.co/auth/v1/sso/saml/metadata`}</Code>. Ask for their
              metadata URL and the names of their email, first name and last name attributes.
            </li>
            <li>
              Register the provider, with an attribute mapping file (docs/supabase-setup.md §6):
              <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">
                {`npx supabase sso add --type saml --project-ref ${ref} \\
  --metadata-url 'https://idp.example.com/saml/metadata' \\
  --domains acme.co.uk \\
  --attribute-mapping-file acme-attributes.json`}
              </pre>
            </li>
            <li>
              Copy the provider ID it prints (<Code>npx supabase sso list --project-ref {ref}</Code>{" "}
              shows it again) and add the domain below.
            </li>
            <li>
              Test with a user from their domain: <strong>Sign in with SSO</strong> on the sign-in
              page. They join only while the organisation has a live subscription; seat limits
              aren&apos;t enforced for SSO users.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domains ({domains.length})</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          {domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">No SSO domains yet.</p>
          ) : (
            domains.map((d) => (
              <div key={d.domain} className="grid gap-3 border-b pb-6 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{d.domain}</h3>
                  {d.enabled ? <Badge>On</Badge> : <Badge variant="outline">Off</Badge>}
                  <span className="text-sm text-muted-foreground">
                    {d.orgName ? (
                      <Link
                        href={appPath(`/admin/organisations/${d.orgId}`)}
                        className="text-primary hover:underline"
                      >
                        {d.orgName}
                      </Link>
                    ) : (
                      "Unknown organisation"
                    )}
                    , joins as {roleLabels[d.defaultRole]}, changed {longDate(d.updatedAt)}
                  </span>
                </div>
                <details>
                  <summary className="cursor-pointer text-sm text-primary">Edit or remove</summary>
                  <div className="mt-3 grid gap-4">
                    <SsoForm orgs={orgs} values={d} />
                    <RemoveSsoForm domain={d.domain} />
                  </div>
                </details>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add a domain</CardTitle>
        </CardHeader>
        <CardContent>
          <SsoForm orgs={orgs} />
        </CardContent>
      </Card>
    </div>
  );
}
